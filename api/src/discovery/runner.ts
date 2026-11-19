import { pool, withTransaction } from "../db/pool.js";
import { writeAudit } from "../lib/audit.js";
import { AppError } from "../lib/errors.js";
import { normalizeWebsite } from "../lib/normalize.js";
import { enrichWebsite } from "./enrich.js";
import { ingestDiscoveryHit } from "./ingest.js";
import { getSearchProvider } from "./providers/index.js";
import { mockBusinessHtml } from "./providers/mock.js";
import { extractBusinessFromHtml } from "./extract.js";
import type { DiscoveryRunConfig, SearchHit } from "./types.js";

export async function createDiscoveryRun(input: {
  name: string;
  provider?: string;
  config?: DiscoveryRunConfig;
  createdBy?: string;
  seedHits?: SearchHit[];
}) {
  const provider = input.provider ?? input.config?.provider ?? "mock";
  const config: DiscoveryRunConfig = {
    limitPerQuery: 5,
    maxQueries: 25,
    enrichWebsites: true,
    dryRun: false,
    ...input.config,
    provider,
  };

  const inserted = await pool.query(
    `INSERT INTO discovery_runs (name, status, provider, config, created_by)
     VALUES ($1, 'queued', $2, $3, $4)
     RETURNING *`,
    [input.name, provider, JSON.stringify({ ...config, seedHits: input.seedHits }), input.createdBy ?? "api"],
  );

  return inserted.rows[0];
}

export async function getDiscoveryRun(id: string) {
  const result = await pool.query(`SELECT * FROM discovery_runs WHERE id = $1`, [id]);
  if (!result.rowCount) throw new AppError(404, "Discovery run not found", "NOT_FOUND");
  return result.rows[0];
}

export async function listDiscoveryRuns(limit = 20) {
  const result = await pool.query(
    `SELECT * FROM discovery_runs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function listDiscoveryCandidates(runId: string, limit = 100) {
  const result = await pool.query(
    `SELECT * FROM discovery_candidates WHERE run_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [runId, limit],
  );
  return result.rows;
}

/**
 * Execute a queued discovery run:
 * 1) claim pending queries
 * 2) search via provider
 * 3) optional website enrichment (robots + rate limit)
 * 4) ingest into suppliers
 */
export async function executeDiscoveryRun(runId: string) {
  const run = await getDiscoveryRun(runId);
  if (!["queued", "failed"].includes(run.status)) {
    throw new AppError(409, `Run cannot start from status ${run.status}`, "INVALID_RUN_STATE");
  }

  const config = (run.config ?? {}) as DiscoveryRunConfig & { seedHits?: SearchHit[] };
  const provider = getSearchProvider(run.provider, { seedHits: config.seedHits });
  const maxQueries = config.maxQueries ?? 25;
  const limitPerQuery = config.limitPerQuery ?? 5;

  await pool.query(
    `UPDATE discovery_runs
     SET status = 'running', started_at = now(), error_message = NULL
     WHERE id = $1`,
    [runId],
  );

  const queryFilter: unknown[] = [];
  const where = [`q.status = 'pending'`];

  if (config.serviceSlugs?.length) {
    queryFilter.push(config.serviceSlugs.map((s) => s.toLowerCase()));
    where.push(`lower(s.slug) = ANY($${queryFilter.length})`);
  }
  if (config.locationIds?.length) {
    queryFilter.push(config.locationIds);
    where.push(`q.location_id = ANY($${queryFilter.length})`);
  }

  queryFilter.push(maxQueries);
  const queries = await pool.query<{
    id: string;
    query_text: string;
    service_id: string;
    location_id: string;
    service_slug: string;
    service_name: string;
    category_id: string;
    location_name: string;
    location_type: string;
    country_code: string;
  }>(
    `SELECT q.id, q.query_text, q.service_id, q.location_id,
            s.slug AS service_slug, s.name AS service_name, s.category_id,
            l.name AS location_name, l.location_type, l.country_code
     FROM discovery_queries q
     JOIN services s ON s.id = q.service_id
     JOIN locations l ON l.id = q.location_id
     WHERE ${where.join(" AND ")}
     ORDER BY q.priority ASC, q.created_at ASC
     LIMIT $${queryFilter.length}`,
    queryFilter,
  );

  await pool.query(
    `UPDATE discovery_runs SET queries_total = $2 WHERE id = $1`,
    [runId, queries.rowCount ?? 0],
  );

  let queriesCompleted = 0;
  let queriesFailed = 0;
  let candidatesFound = 0;
  let suppliersCreated = 0;
  let suppliersSkipped = 0;

  try {
    for (const query of queries.rows) {
      await pool.query(
        `INSERT INTO discovery_run_queries (run_id, query_id, status, started_at)
         VALUES ($1, $2, 'running', now())
         ON CONFLICT (run_id, query_id) DO UPDATE
           SET status = 'running', started_at = now()`,
        [runId, query.id],
      );
      await pool.query(
        `UPDATE discovery_queries
         SET status = 'running', attempts = attempts + 1, last_run_at = now()
         WHERE id = $1`,
        [query.id],
      );

      try {
        const hits = await provider.search({
          queryText: query.query_text,
          serviceSlug: query.service_slug,
          serviceName: query.service_name,
          locationName: query.location_name,
          locationType: query.location_type,
          countryCode: query.country_code,
          limit: limitPerQuery,
        });

        for (const hit of hits) {
          candidatesFound += 1;
          const websiteNorm = normalizeWebsite(hit.website ?? hit.sourceUrl);

          const candidate = await pool.query(
            `INSERT INTO discovery_candidates
               (run_id, query_id, company_name, website, website_normalised, source_url, snippet, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'new')
             RETURNING *`,
            [
              runId,
              query.id,
              hit.companyName ?? null,
              hit.website ?? null,
              websiteNorm,
              hit.sourceUrl,
              hit.snippet ?? null,
            ],
          );

          let extracted = undefined;
          let robotsAllowed: boolean | null = null;
          let httpStatus: number | null = null;

          if (config.enrichWebsites !== false && (hit.website || hit.sourceUrl)) {
            const target = hit.website || hit.sourceUrl;
            // Synthetic enrichment for .example hosts (mock provider)
            if (target.includes(".example")) {
              const html = mockBusinessHtml({
                companyName: hit.companyName ?? "Business",
                email: hit.email ?? `info@${websiteNorm}`,
                phone: hit.phone ?? "+441000000000",
                website: target.startsWith("http") ? target : `https://${target}`,
              });
              extracted = extractBusinessFromHtml(html, target);
              robotsAllowed = true;
              httpStatus = 200;
            } else {
              const enrich = await enrichWebsite(pool, target);
              robotsAllowed = enrich.allowed;
              httpStatus = enrich.httpStatus ?? null;
              extracted = enrich.extracted;
              if (!enrich.allowed) {
                await pool.query(
                  `UPDATE discovery_candidates
                   SET status = 'rejected',
                       rejection_reason = $2,
                       robots_allowed = FALSE,
                       http_status = $3,
                       extracted = $4
                   WHERE id = $1`,
                  [
                    candidate.rows[0].id,
                    enrich.error ?? "robots_disallowed",
                    httpStatus,
                    JSON.stringify(extracted ?? {}),
                  ],
                );
                suppliersSkipped += 1;
                continue;
              }
            }
          }

          const ingest = await ingestDiscoveryHit({
            db: pool,
            hit,
            extracted,
            serviceId: query.service_id,
            categoryId: query.category_id,
            locationId: query.location_id,
            locationName: query.location_name,
            queryText: query.query_text,
            dryRun: config.dryRun,
          });

          if (ingest.status === "created") {
            suppliersCreated += 1;
            await pool.query(
              `UPDATE discovery_candidates
               SET status = 'ingested',
                   supplier_id = $2,
                   robots_allowed = $3,
                   http_status = $4,
                   extracted = $5
               WHERE id = $1`,
              [
                candidate.rows[0].id,
                ingest.supplierId,
                robotsAllowed,
                httpStatus,
                JSON.stringify(extracted ?? {}),
              ],
            );
          } else if (ingest.status === "dry_run") {
            await pool.query(
              `UPDATE discovery_candidates
               SET status = 'enriched',
                   robots_allowed = $2,
                   http_status = $3,
                   extracted = $4
               WHERE id = $1`,
              [
                candidate.rows[0].id,
                robotsAllowed,
                httpStatus,
                JSON.stringify(extracted ?? {}),
              ],
            );
          } else {
            suppliersSkipped += 1;
            await pool.query(
              `UPDATE discovery_candidates
               SET status = $2,
                   rejection_reason = $3,
                   robots_allowed = $4,
                   http_status = $5,
                   extracted = $6
               WHERE id = $1`,
              [
                candidate.rows[0].id,
                ingest.status === "duplicate"
                  ? "duplicate"
                  : ingest.status === "suppressed"
                    ? "suppressed"
                    : "rejected",
                ingest.reason,
                robotsAllowed,
                httpStatus,
                JSON.stringify(extracted ?? {}),
              ],
            );
          }
        }

        await pool.query(
          `UPDATE discovery_queries
           SET status = 'completed', completed_at = now(), last_error = NULL
           WHERE id = $1`,
          [query.id],
        );
        await pool.query(
          `UPDATE discovery_run_queries
           SET status = 'completed', finished_at = now()
           WHERE run_id = $1 AND query_id = $2`,
          [runId, query.id],
        );
        queriesCompleted += 1;
      } catch (error) {
        queriesFailed += 1;
        const message = error instanceof Error ? error.message : "query_failed";
        await pool.query(
          `UPDATE discovery_queries
           SET status = 'failed', last_error = $2
           WHERE id = $1`,
          [query.id, message],
        );
        await pool.query(
          `UPDATE discovery_run_queries
           SET status = 'failed', finished_at = now(), error_message = $3
           WHERE run_id = $1 AND query_id = $2`,
          [runId, query.id, message],
        );
      }

      await pool.query(
        `UPDATE discovery_runs SET
           queries_completed = $2,
           queries_failed = $3,
           candidates_found = $4,
           suppliers_created = $5,
           suppliers_skipped = $6
         WHERE id = $1`,
        [
          runId,
          queriesCompleted,
          queriesFailed,
          candidatesFound,
          suppliersCreated,
          suppliersSkipped,
        ],
      );
    }

    const completed = await pool.query(
      `UPDATE discovery_runs
       SET status = 'completed', completed_at = now()
       WHERE id = $1
       RETURNING *`,
      [runId],
    );

    await writeAudit(pool, {
      entityType: "discovery_run",
      entityId: runId,
      action: "create",
      actor: "discovery",
      after: completed.rows[0],
    });

    return completed.rows[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : "run_failed";
    await pool.query(
      `UPDATE discovery_runs
       SET status = 'failed', error_message = $2, completed_at = now()
       WHERE id = $1`,
      [runId, message],
    );
    throw error;
  }
}

export async function resetFailedQueries() {
  return withTransaction(async (db) => {
    const result = await db.query(
      `UPDATE discovery_queries
       SET status = 'pending', last_error = NULL
       WHERE status = 'failed'
       RETURNING id`,
    );
    return { reset: result.rowCount ?? 0 };
  });
}

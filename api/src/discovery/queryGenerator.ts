import { createHash } from "node:crypto";
import type { DbClient } from "../db/pool.js";

export type GenerateQueryOptions = {
  serviceSlugs?: string[];
  locationTypes?: string[];
  locationIds?: string[];
  countryCode?: string;
  /** Prefer first search alias when present (e.g. "Wedding Florist"). */
  preferAlias?: boolean;
  limit?: number;
};

function hashQuery(text: string, serviceId: string, locationId: string): string {
  return createHash("sha256")
    .update(`${serviceId}|${locationId}|${text.toLowerCase()}`)
    .digest("hex");
}

/**
 * Build service × location search strings:
 *   "Florist Swansea", "Wedding DJ Cardiff", …
 */
export async function generateDiscoveryQueries(
  db: DbClient,
  opts: GenerateQueryOptions = {},
) {
  const locationTypes = opts.locationTypes ?? ["city", "town", "county", "unitary_authority"];
  const params: unknown[] = [opts.countryCode ?? "GB", locationTypes];
  const where: string[] = [
    `s.is_active`,
    `l.is_active`,
    `l.country_code = $1`,
    `l.location_type::text = ANY($2)`,
  ];

  if (opts.serviceSlugs?.length) {
    params.push(opts.serviceSlugs.map((s) => s.toLowerCase()));
    where.push(`lower(s.slug) = ANY($${params.length})`);
  }

  if (opts.locationIds?.length) {
    params.push(opts.locationIds);
    where.push(`l.id = ANY($${params.length})`);
  }

  let sql = `
    SELECT s.id AS service_id,
           s.slug AS service_slug,
           s.name AS service_name,
           s.search_aliases,
           l.id AS location_id,
           l.name AS location_name,
           l.location_type
    FROM services s
    CROSS JOIN locations l
    WHERE ${where.join(" AND ")}
    ORDER BY s.sort_order, l.name
  `;

  if (opts.limit) {
    params.push(opts.limit);
    sql += ` LIMIT $${params.length}`;
  }

  const rows = await db.query<{
    service_id: string;
    service_slug: string;
    service_name: string;
    search_aliases: string[];
    location_id: string;
    location_name: string;
    location_type: string;
  }>(sql, params);

  let inserted = 0;
  let skipped = 0;

  for (const row of rows.rows) {
    const label =
      opts.preferAlias !== false && row.search_aliases?.[0]
        ? row.search_aliases[0]
        : row.service_name;
    const queryText = `${label} ${row.location_name}`.replace(/\s+/g, " ").trim();
    const queryHash = hashQuery(queryText, row.service_id, row.location_id);

    const result = await db.query(
      `INSERT INTO discovery_queries
         (service_id, location_id, query_text, query_hash, priority, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (query_hash) DO NOTHING
       RETURNING id`,
      [
        row.service_id,
        row.location_id,
        queryText,
        queryHash,
        row.location_type === "city" ? 10 : row.location_type === "town" ? 20 : 50,
        JSON.stringify({
          service_slug: row.service_slug,
          location_type: row.location_type,
        }),
      ],
    );

    if (result.rowCount) inserted += 1;
    else skipped += 1;
  }

  return {
    considered: rows.rowCount ?? 0,
    inserted,
    skipped,
  };
}

export async function countPendingQueries(db: DbClient) {
  const result = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM discovery_queries WHERE status = 'pending'`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

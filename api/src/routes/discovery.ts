import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import {
  countPendingQueries,
  generateDiscoveryQueries,
} from "../discovery/queryGenerator.js";
import {
  createDiscoveryRun,
  executeDiscoveryRun,
  getDiscoveryRun,
  listDiscoveryCandidates,
  listDiscoveryRuns,
  resetFailedQueries,
} from "../discovery/runner.js";
import { paginationSchema, uuidSchema } from "../schemas/common.js";
import { createRunSchema, generateQueriesSchema } from "../schemas/discovery.js";

export async function discoveryRoutes(app: FastifyInstance) {
  app.get("/discovery/stats", async () => {
    const [pending, totals, runs] = await Promise.all([
      countPendingQueries(pool),
      pool.query<{ status: string; count: string }>(
        `SELECT status::text, count(*)::text AS count
         FROM discovery_queries
         GROUP BY status
         ORDER BY status`,
      ),
      pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM discovery_runs`),
    ]);

    return {
      pendingQueries: pending,
      queriesByStatus: Object.fromEntries(
        totals.rows.map((r) => [r.status, Number(r.count)]),
      ),
      totalRuns: Number(runs.rows[0]?.count ?? 0),
    };
  });

  app.get("/discovery/queries", async (req) => {
    const query = paginationSchema
      .extend({
        status: z
          .enum(["pending", "running", "completed", "failed", "skipped"])
          .optional(),
      })
      .parse(req.query);

    const params: unknown[] = [];
    const where: string[] = [];
    if (query.status) {
      params.push(query.status);
      where.push(`q.status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM discovery_queries q ${whereSql}`,
      params,
    );

    params.push(query.pageSize, (query.page - 1) * query.pageSize);
    const rows = await pool.query(
      `SELECT q.id, q.query_text, q.status, q.priority, q.attempts,
              q.last_run_at, q.completed_at,
              s.slug AS service_slug, s.name AS service_name,
              l.name AS location_name, l.location_type
       FROM discovery_queries q
       JOIN services s ON s.id = q.service_id
       JOIN locations l ON l.id = q.location_id
       ${whereSql}
       ORDER BY q.priority ASC, q.created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      data: rows.rows,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: Number(count.rows[0]?.count ?? 0),
      },
    };
  });

  app.post("/discovery/queries/generate", async (req, reply) => {
    const body = generateQueriesSchema.parse(req.body ?? {});
    const result = await generateDiscoveryQueries(pool, body);
    return reply.code(201).send(result);
  });

  app.post("/discovery/queries/reset-failed", async () => resetFailedQueries());

  app.get("/discovery/runs", async () => ({ data: await listDiscoveryRuns() }));

  app.post("/discovery/runs", async (req, reply) => {
    const body = createRunSchema.parse(req.body);
    const run = await createDiscoveryRun({
      name: body.name,
      provider: body.provider,
      config: { ...body.config, provider: body.provider },
      createdBy: body.createdBy,
      seedHits: body.seedHits,
    });

    if (body.execute) {
      const completed = await executeDiscoveryRun(run.id);
      return reply.code(201).send(completed);
    }

    return reply.code(201).send(run);
  });

  app.get("/discovery/runs/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    return getDiscoveryRun(id);
  });

  app.post("/discovery/runs/:id/execute", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    return executeDiscoveryRun(id);
  });

  app.get("/discovery/runs/:id/candidates", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    return { data: await listDiscoveryCandidates(id) };
  });
}

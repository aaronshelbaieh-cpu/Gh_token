import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { writeAudit } from "../lib/audit.js";
import { AppError, isUniqueViolation } from "../lib/errors.js";
import { normalizeEmail, normalizePhone } from "../lib/normalize.js";
import { paginationSchema } from "../schemas/common.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", async () => {
    const result = await pool.query(`SELECT * FROM v_admin_overview`);
    return result.rows[0];
  });

  app.get("/admin/duplicate-candidates", async (req) => {
    const query = paginationSchema.parse(req.query);
    const offset = (query.page - 1) * query.pageSize;

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM suppliers WHERE status = 'duplicate_candidate'`,
    );

    const rows = await pool.query(
      `SELECT id, company_name, website, town, county, date_found
       FROM suppliers
       WHERE status = 'duplicate_candidate'
       ORDER BY date_found DESC
       LIMIT $1 OFFSET $2`,
      [query.pageSize, offset],
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

  app.get("/admin/audit-logs", async (req) => {
    const query = paginationSchema
      .extend({
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
      })
      .parse(req.query);

    const params: unknown[] = [];
    const where: string[] = [];

    if (query.entityType) {
      params.push(query.entityType);
      where.push(`entity_type = $${params.length}`);
    }
    if (query.entityId) {
      params.push(query.entityId);
      where.push(`entity_id = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_logs ${whereSql}`,
      params,
    );

    params.push(query.pageSize, (query.page - 1) * query.pageSize);
    const rows = await pool.query(
      `SELECT id, entity_type, entity_id, action, actor, context, created_at
       FROM audit_logs
       ${whereSql}
       ORDER BY created_at DESC
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

  app.get("/admin/suppressions", async (req) => {
    const query = paginationSchema.parse(req.query);
    const offset = (query.page - 1) * query.pageSize;

    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM suppression_list`,
    );
    const rows = await pool.query(
      `SELECT * FROM suppression_list
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [query.pageSize, offset],
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

  app.post("/admin/suppressions", async (req, reply) => {
    const body = z
      .object({
        channel: z.enum(["email", "phone", "contact_page", "form"]),
        value: z.string().trim().min(1),
        reason: z.string().default("opt_out"),
        source: z.string().optional(),
        supplierId: z.string().uuid().optional(),
        actor: z.string().optional(),
      })
      .parse(req.body);

    const valueNormalised =
      body.channel === "email"
        ? normalizeEmail(body.value)
        : body.channel === "phone"
          ? normalizePhone(body.value)
          : body.value.trim().toLowerCase();

    if (!valueNormalised) {
      throw new AppError(400, "Invalid suppression value", "INVALID_VALUE");
    }

    try {
      const inserted = await pool.query(
        `INSERT INTO suppression_list
           (channel, value, value_normalised, reason, source, supplier_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          body.channel,
          body.value,
          valueNormalised,
          body.reason,
          body.source ?? null,
          body.supplierId ?? null,
        ],
      );

      if (body.channel === "email" || body.channel === "phone") {
        await pool.query(
          `UPDATE suppliers s
           SET status = 'suppressed'
           WHERE EXISTS (
             SELECT 1 FROM supplier_contacts sc
             WHERE sc.supplier_id = s.id
               AND sc.channel = $1
               AND sc.value_normalised = $2
           )
           AND s.status NOT IN ('merged', 'archived')`,
          [body.channel, valueNormalised],
        );
      }

      await writeAudit(pool, {
        entityType: "suppression",
        entityId: inserted.rows[0].id,
        action: "suppress",
        actor: body.actor ?? "api",
        after: inserted.rows[0],
      });

      return reply.code(201).send(inserted.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "Already suppressed", "DUPLICATE_SUPPRESSION");
      }
      throw error;
    }
  });
}

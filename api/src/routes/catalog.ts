import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { AppError } from "../lib/errors.js";
import { paginationSchema, offsetLimit, uuidSchema } from "../schemas/common.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/categories", async () => {
    const result = await pool.query(
      `SELECT id, slug, name, description, sort_order, is_active
       FROM categories
       WHERE is_active
       ORDER BY sort_order, name`,
    );
    return { data: result.rows };
  });

  app.get("/categories/:idOrSlug/services", async (req) => {
    const { idOrSlug } = z.object({ idOrSlug: z.string() }).parse(req.params);
    const category = await pool.query(
      `SELECT id, slug, name FROM categories
       WHERE id::text = $1 OR slug = $1`,
      [idOrSlug],
    );
    if (!category.rowCount) {
      throw new AppError(404, "Category not found", "NOT_FOUND");
    }

    const services = await pool.query(
      `SELECT id, slug, name, search_aliases, sort_order
       FROM services
       WHERE category_id = $1 AND is_active
       ORDER BY sort_order, name`,
      [category.rows[0].id],
    );

    return { category: category.rows[0], data: services.rows };
  });

  app.get("/services", async (req) => {
    const query = paginationSchema
      .extend({
        category: z.string().optional(),
        q: z.string().optional(),
      })
      .parse(req.query);

    const { offset, limit } = offsetLimit(query.page, query.pageSize);
    const params: unknown[] = [];
    const where: string[] = ["s.is_active"];

    if (query.category) {
      params.push(query.category.toLowerCase());
      where.push(`(lower(c.slug) = $${params.length} OR lower(c.name) = $${params.length})`);
    }
    if (query.q) {
      params.push(`%${query.q.toLowerCase()}%`);
      where.push(
        `(lower(s.name) LIKE $${params.length} OR lower(s.slug) LIKE $${params.length})`,
      );
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM services s
       JOIN categories c ON c.id = s.category_id
       ${whereSql}`,
      params,
    );

    params.push(limit, offset);
    const rows = await pool.query(
      `SELECT s.id, s.slug, s.name, s.search_aliases, s.sort_order,
              c.id AS category_id, c.slug AS category_slug, c.name AS category_name
       FROM services s
       JOIN categories c ON c.id = s.category_id
       ${whereSql}
       ORDER BY c.sort_order, s.sort_order, s.name
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

  app.get("/locations", async (req) => {
    const query = paginationSchema
      .extend({
        type: z
          .enum([
            "country",
            "nation",
            "county",
            "unitary_authority",
            "city",
            "town",
            "village",
            "district",
          ])
          .optional(),
        parentId: uuidSchema.optional(),
        q: z.string().optional(),
        countryCode: z.string().length(2).optional(),
      })
      .parse(req.query);

    const { offset, limit } = offsetLimit(query.page, query.pageSize);
    const params: unknown[] = [];
    const where: string[] = ["is_active"];

    if (query.type) {
      params.push(query.type);
      where.push(`location_type = $${params.length}`);
    }
    if (query.parentId) {
      params.push(query.parentId);
      where.push(`parent_id = $${params.length}`);
    }
    if (query.countryCode) {
      params.push(query.countryCode.toUpperCase());
      where.push(`country_code = $${params.length}`);
    }
    if (query.q) {
      params.push(`%${query.q.toLowerCase()}%`);
      where.push(`name_normalised LIKE $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const count = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM locations ${whereSql}`,
      params,
    );

    params.push(limit, offset);
    const rows = await pool.query(
      `SELECT id, parent_id, country_code, location_type, slug, name,
              admin_code, latitude, longitude
       FROM locations
       ${whereSql}
       ORDER BY name
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

  app.get("/locations/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const result = await pool.query(`SELECT * FROM locations WHERE id = $1`, [id]);
    if (!result.rowCount) {
      throw new AppError(404, "Location not found", "NOT_FOUND");
    }

    const children = await pool.query(
      `SELECT id, slug, name, location_type
       FROM locations
       WHERE parent_id = $1 AND is_active
       ORDER BY name`,
      [id],
    );

    return { ...result.rows[0], children: children.rows };
  });
}

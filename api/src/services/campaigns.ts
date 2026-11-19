import type { DbClient } from "../db/pool.js";
import { withTransaction } from "../db/pool.js";
import { writeAudit } from "../lib/audit.js";
import { AppError, isUniqueViolation } from "../lib/errors.js";
import { slugify } from "../lib/normalize.js";
import { offsetLimit } from "../schemas/common.js";
import type {
  CampaignFilter,
  CreateCampaign,
} from "../schemas/campaigns.js";
import { buildSupplierFilters } from "./suppliers.js";

function toSearchFilters(filter: CampaignFilter) {
  return {
    q: filter.q,
    categorySlugs: filter.categorySlugs,
    serviceSlugs: filter.serviceSlugs,
    county: filter.county,
    town: filter.town,
    nation: filter.nation,
    locationId: filter.locationId,
    minRating: filter.minRating,
    hasEmail: filter.hasEmail,
    hasPhone: filter.hasPhone,
    countryCode: filter.countryCode,
  };
}

export async function estimateCampaignCount(db: DbClient, filter: CampaignFilter) {
  const parts = buildSupplierFilters(toSearchFilters(filter));
  const whereSql = parts.where.length ? `WHERE ${parts.where.join(" AND ")}` : "";
  const result = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM suppliers s ${whereSql}`,
    parts.params,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function materializeCampaign(db: DbClient, campaignId: string, filter: CampaignFilter) {
  await db.query(`DELETE FROM campaign_suppliers WHERE campaign_id = $1`, [campaignId]);

  const parts = buildSupplierFilters(toSearchFilters(filter));
  const whereSql = parts.where.length ? `WHERE ${parts.where.join(" AND ")}` : "";
  const params = [campaignId, ...parts.params];

  // Remap placeholders in where clause after inserting campaignId as $1
  let remapped = whereSql;
  for (let i = parts.params.length; i >= 1; i -= 1) {
    remapped = remapped.replaceAll(`$${i}`, `$${i + 1}`);
  }

  const inserted = await db.query(
    `INSERT INTO campaign_suppliers (campaign_id, supplier_id, match_reason)
     SELECT $1, s.id, 'filter_match'
     FROM suppliers s
     ${remapped}
     ON CONFLICT DO NOTHING
     RETURNING supplier_id`,
    params,
  );

  await db.query(
    `UPDATE campaigns
     SET estimated_count = $2, status = CASE WHEN status = 'archived' THEN status ELSE 'ready' END
     WHERE id = $1`,
    [campaignId, inserted.rowCount ?? 0],
  );

  return inserted.rowCount ?? 0;
}

export async function listCampaigns(
  db: DbClient,
  opts: { page: number; pageSize: number; status?: string },
) {
  const { offset, limit } = offsetLimit(opts.page, opts.pageSize);
  const params: unknown[] = [];
  const where: string[] = [];

  if (opts.status) {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM campaigns ${whereSql}`,
    params,
  );

  params.push(limit, offset);
  const rows = await db.query(
    `SELECT * FROM campaigns ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    data: rows.rows,
    pagination: {
      page: opts.page,
      pageSize: opts.pageSize,
      total: Number(count.rows[0]?.count ?? 0),
    },
  };
}

export async function getCampaign(db: DbClient, id: string) {
  const result = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [id]);
  if (!result.rowCount) {
    throw new AppError(404, "Campaign not found", "NOT_FOUND");
  }

  const members = await db.query(
    `SELECT count(*)::int AS count FROM campaign_suppliers WHERE campaign_id = $1`,
    [id],
  );

  return {
    ...result.rows[0],
    member_count: members.rows[0]?.count ?? 0,
  };
}

export async function createCampaign(input: CreateCampaign) {
  try {
    return await withTransaction(async (db) => {
      const slug = input.slug ?? slugify(input.name);
      const estimate = await estimateCampaignCount(db, input.filterCriteria);

      const inserted = await db.query(
        `INSERT INTO campaigns (name, slug, description, filter_criteria, estimated_count, created_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft')
         RETURNING *`,
        [
          input.name,
          slug,
          input.description ?? null,
          JSON.stringify(input.filterCriteria),
          estimate,
          input.createdBy ?? "api",
        ],
      );

      const campaign = inserted.rows[0];

      if (input.materialize) {
        await materializeCampaign(db, campaign.id, input.filterCriteria);
      }

      await writeAudit(db, {
        entityType: "campaign",
        entityId: campaign.id,
        action: "create",
        actor: input.createdBy ?? "api",
        after: campaign,
      });

      return getCampaign(db, campaign.id);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Campaign slug already exists", "DUPLICATE_CAMPAIGN");
    }
    throw error;
  }
}

export async function updateCampaign(
  id: string,
  input: {
    name?: string;
    slug?: string;
    description?: string | null;
    filterCriteria?: CampaignFilter;
    status?: string;
    materialize?: boolean;
    actor?: string;
  },
) {
  return withTransaction(async (db) => {
    const existing = await getCampaign(db, id);

    const updated = await db.query(
      `UPDATE campaigns SET
         name = COALESCE($2, name),
         slug = COALESCE($3, slug),
         description = COALESCE($4, description),
         filter_criteria = COALESCE($5, filter_criteria),
         status = COALESCE($6, status),
         archived_at = CASE WHEN $6 = 'archived' THEN now() ELSE archived_at END
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.name ?? null,
        input.slug ?? null,
        input.description ?? null,
        input.filterCriteria ? JSON.stringify(input.filterCriteria) : null,
        input.status ?? null,
      ],
    );

    const filter = (input.filterCriteria ??
      existing.filter_criteria) as CampaignFilter;

    if (input.filterCriteria || input.materialize) {
      await materializeCampaign(db, id, filter);
    }

    await writeAudit(db, {
      entityType: "campaign",
      entityId: id,
      action: "update",
      actor: input.actor ?? "api",
      before: existing,
      after: updated.rows[0],
    });

    return getCampaign(db, id);
  });
}

export async function listCampaignSuppliers(
  db: DbClient,
  campaignId: string,
  page: number,
  pageSize: number,
) {
  await getCampaign(db, campaignId);
  const { offset, limit } = offsetLimit(page, pageSize);

  const count = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM campaign_suppliers WHERE campaign_id = $1`,
    [campaignId],
  );

  const rows = await db.query(
    `SELECT s.id, s.company_name, s.town, s.county, s.website, s.google_rating,
            (
              SELECT sc.value FROM supplier_contacts sc
              WHERE sc.supplier_id = s.id AND sc.channel = 'email' AND sc.is_primary
              LIMIT 1
            ) AS primary_email,
            (
              SELECT sc.value FROM supplier_contacts sc
              WHERE sc.supplier_id = s.id AND sc.channel = 'phone' AND sc.is_primary
              LIMIT 1
            ) AS primary_phone
     FROM campaign_suppliers cs
     JOIN suppliers s ON s.id = cs.supplier_id
     WHERE cs.campaign_id = $1
     ORDER BY s.company_name
     LIMIT $2 OFFSET $3`,
    [campaignId, limit, offset],
  );

  return {
    data: rows.rows,
    pagination: {
      page,
      pageSize,
      total: Number(count.rows[0]?.count ?? 0),
    },
  };
}

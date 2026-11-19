import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { DbClient } from "../db/pool.js";
import { withTransaction } from "../db/pool.js";
import { env } from "../config.js";
import { writeAudit } from "../lib/audit.js";
import { AppError } from "../lib/errors.js";
import type { CampaignFilter, ExportRequest } from "../schemas/campaigns.js";
import { buildSupplierFilters } from "./suppliers.js";
import { getCampaign } from "./campaigns.js";

type ExportRow = {
  company_name: string;
  service: string | null;
  category: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  latitude: string | null;
  longitude: string | null;
  google_rating: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  contact_page: string | null;
  source_url: string | null;
  date_found: string | null;
  last_verified: string | null;
};

async function fetchExportRows(
  db: DbClient,
  opts: { campaignId?: string; filter?: CampaignFilter },
): Promise<ExportRow[]> {
  if (opts.campaignId) {
    const result = await db.query<ExportRow>(
      `SELECT
         s.company_name,
         svc.name AS service,
         c.name AS category,
         (
           SELECT sc.value FROM supplier_contacts sc
           WHERE sc.supplier_id = s.id AND sc.channel = 'email' AND sc.is_primary
           LIMIT 1
         ) AS email,
         (
           SELECT sc.value FROM supplier_contacts sc
           WHERE sc.supplier_id = s.id AND sc.channel = 'phone' AND sc.is_primary
           LIMIT 1
         ) AS phone,
         s.website,
         s.town,
         s.county,
         s.postcode,
         s.latitude::text,
         s.longitude::text,
         s.google_rating::text,
         (
           SELECT ss.url FROM supplier_socials ss
           WHERE ss.supplier_id = s.id AND ss.platform = 'facebook' LIMIT 1
         ) AS facebook_url,
         (
           SELECT ss.url FROM supplier_socials ss
           WHERE ss.supplier_id = s.id AND ss.platform = 'instagram' LIMIT 1
         ) AS instagram_url,
         (
           SELECT ss.url FROM supplier_socials ss
           WHERE ss.supplier_id = s.id AND ss.platform = 'linkedin' LIMIT 1
         ) AS linkedin_url,
         (
           SELECT sc.value FROM supplier_contacts sc
           WHERE sc.supplier_id = s.id AND sc.channel = 'contact_page'
           LIMIT 1
         ) AS contact_page,
         s.source_url,
         s.date_found::text,
         s.last_verified::text
       FROM campaign_suppliers cs
       JOIN suppliers s ON s.id = cs.supplier_id
       LEFT JOIN services svc ON svc.id = s.primary_service_id
       LEFT JOIN categories c ON c.id = s.primary_category_id
       WHERE cs.campaign_id = $1
       ORDER BY s.company_name`,
      [opts.campaignId],
    );
    return result.rows;
  }

  const parts = buildSupplierFilters(opts.filter ?? {});
  const whereSql = parts.where.length ? `WHERE ${parts.where.join(" AND ")}` : "";

  const result = await db.query<ExportRow>(
    `SELECT
       s.company_name,
       svc.name AS service,
       c.name AS category,
       (
         SELECT sc.value FROM supplier_contacts sc
         WHERE sc.supplier_id = s.id AND sc.channel = 'email' AND sc.is_primary
         LIMIT 1
       ) AS email,
       (
         SELECT sc.value FROM supplier_contacts sc
         WHERE sc.supplier_id = s.id AND sc.channel = 'phone' AND sc.is_primary
         LIMIT 1
       ) AS phone,
       s.website,
       s.town,
       s.county,
       s.postcode,
       s.latitude::text,
       s.longitude::text,
       s.google_rating::text,
       (
         SELECT ss.url FROM supplier_socials ss
         WHERE ss.supplier_id = s.id AND ss.platform = 'facebook' LIMIT 1
       ) AS facebook_url,
       (
         SELECT ss.url FROM supplier_socials ss
         WHERE ss.supplier_id = s.id AND ss.platform = 'instagram' LIMIT 1
       ) AS instagram_url,
       (
         SELECT ss.url FROM supplier_socials ss
         WHERE ss.supplier_id = s.id AND ss.platform = 'linkedin' LIMIT 1
       ) AS linkedin_url,
       (
         SELECT sc.value FROM supplier_contacts sc
         WHERE sc.supplier_id = s.id AND sc.channel = 'contact_page'
         LIMIT 1
       ) AS contact_page,
       s.source_url,
       s.date_found::text,
       s.last_verified::text
     FROM suppliers s
     LEFT JOIN services svc ON svc.id = s.primary_service_id
     LEFT JOIN categories c ON c.id = s.primary_category_id
     ${whereSql}
     ORDER BY s.company_name`,
    parts.params,
  );

  return result.rows;
}

function toCsv(rows: ExportRow[]): string {
  const headers = [
    "company_name",
    "service",
    "category",
    "email",
    "phone",
    "website",
    "town",
    "county",
    "postcode",
    "latitude",
    "longitude",
    "google_rating",
    "facebook_url",
    "instagram_url",
    "linkedin_url",
    "contact_page",
    "source_url",
    "date_found",
    "last_verified",
  ] as const;

  const escape = (value: string | null | undefined) => {
    const v = value ?? "";
    if (/[",\n]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
    return v;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function toXlsx(rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GED";
  const sheet = workbook.addWorksheet("Suppliers");

  sheet.columns = [
    { header: "company_name", key: "company_name", width: 30 },
    { header: "service", key: "service", width: 24 },
    { header: "category", key: "category", width: 20 },
    { header: "email", key: "email", width: 28 },
    { header: "phone", key: "phone", width: 18 },
    { header: "website", key: "website", width: 30 },
    { header: "town", key: "town", width: 16 },
    { header: "county", key: "county", width: 18 },
    { header: "postcode", key: "postcode", width: 12 },
    { header: "latitude", key: "latitude", width: 12 },
    { header: "longitude", key: "longitude", width: 12 },
    { header: "google_rating", key: "google_rating", width: 12 },
    { header: "facebook_url", key: "facebook_url", width: 28 },
    { header: "instagram_url", key: "instagram_url", width: 28 },
    { header: "linkedin_url", key: "linkedin_url", width: 28 },
    { header: "contact_page", key: "contact_page", width: 28 },
    { header: "source_url", key: "source_url", width: 28 },
    { header: "date_found", key: "date_found", width: 14 },
    { header: "last_verified", key: "last_verified", width: 22 },
  ];

  for (const row of rows) {
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function createExport(input: ExportRequest) {
  return withTransaction(async (db) => {
    let filterSnapshot: CampaignFilter = input.filterCriteria ?? {};

    if (input.campaignId) {
      const campaign = await getCampaign(db, input.campaignId);
      filterSnapshot = (campaign.filter_criteria ?? {}) as CampaignFilter;
    }

    const job = await db.query(
      `INSERT INTO lead_exports
         (campaign_id, name, format, status, filter_snapshot, requested_by, started_at)
       VALUES ($1, $2, $3, 'processing', $4, $5, now())
       RETURNING *`,
      [
        input.campaignId ?? null,
        input.name,
        input.format,
        JSON.stringify(filterSnapshot),
        input.requestedBy ?? "api",
      ],
    );

    const exportRow = job.rows[0];

    try {
      const rows = await fetchExportRows(db, {
        campaignId: input.campaignId,
        filter: input.filterCriteria,
      });

      await mkdir(env.EXPORT_DIR, { recursive: true });
      const filename = `${exportRow.id}.${input.format}`;
      const filePath = path.join(env.EXPORT_DIR, filename);

      if (input.format === "csv") {
        await writeFile(filePath, toCsv(rows), "utf8");
      } else {
        await writeFile(filePath, await toXlsx(rows));
      }

      const completed = await db.query(
        `UPDATE lead_exports
         SET status = 'completed',
             row_count = $2,
             file_path = $3,
             completed_at = now()
         WHERE id = $1
         RETURNING *`,
        [exportRow.id, rows.length, filePath],
      );

      if (input.campaignId) {
        await db.query(
          `UPDATE campaigns SET status = 'exported' WHERE id = $1 AND status <> 'archived'`,
          [input.campaignId],
        );
      }

      await writeAudit(db, {
        entityType: "lead_export",
        entityId: exportRow.id,
        action: "export",
        actor: input.requestedBy ?? "api",
        after: completed.rows[0],
        context: { rowCount: rows.length, format: input.format },
      });

      return completed.rows[0];
    } catch (error) {
      await db.query(
        `UPDATE lead_exports
         SET status = 'failed',
             error_message = $2,
             completed_at = now()
         WHERE id = $1`,
        [exportRow.id, error instanceof Error ? error.message : "Export failed"],
      );
      throw error;
    }
  });
}

export async function getExport(db: DbClient, id: string) {
  const result = await db.query(`SELECT * FROM lead_exports WHERE id = $1`, [id]);
  if (!result.rowCount) {
    throw new AppError(404, "Export not found", "NOT_FOUND");
  }
  return result.rows[0];
}

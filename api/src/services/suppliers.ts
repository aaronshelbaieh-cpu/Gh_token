import type { DbClient } from "../db/pool.js";
import { withTransaction } from "../db/pool.js";
import { writeAudit } from "../lib/audit.js";
import { AppError, isUniqueViolation } from "../lib/errors.js";
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeUrl,
  normalizeWebsite,
} from "../lib/normalize.js";
import { offsetLimit } from "../schemas/common.js";
import type {
  CreateSupplier,
  SupplierSearch,
  UpdateSupplier,
} from "../schemas/suppliers.js";

type SqlParts = {
  where: string[];
  params: unknown[];
};

function pushParam(parts: SqlParts, value: unknown): string {
  parts.params.push(value);
  return `$${parts.params.length}`;
}

/** Shared filter builder for search + campaign matching. */
export function buildSupplierFilters(
  filters: {
    q?: string;
    category?: string;
    service?: string;
    county?: string;
    town?: string;
    nation?: string;
    locationId?: string;
    minRating?: number;
    hasEmail?: boolean;
    hasPhone?: boolean;
    status?: string;
    countryCode?: string;
    categorySlugs?: string[];
    serviceSlugs?: string[];
  },
  alias = "s",
): SqlParts {
  const parts: SqlParts = {
    where: [`${alias}.status NOT IN ('merged', 'archived', 'suppressed')`],
    params: [],
  };

  if (filters.q) {
    const p = pushParam(parts, `%${normalizeName(filters.q)}%`);
    parts.where.push(`${alias}.company_name_normalised ILIKE ${p}`);
  }

  if (filters.category) {
    const p = pushParam(parts, filters.category.toLowerCase());
    parts.where.push(
      `EXISTS (
         SELECT 1 FROM categories c
         WHERE c.id = ${alias}.primary_category_id
           AND (lower(c.slug) = ${p} OR lower(c.name) = ${p})
       )`,
    );
  }

  if (filters.categorySlugs?.length) {
    const p = pushParam(parts, filters.categorySlugs.map((s) => s.toLowerCase()));
    parts.where.push(
      `EXISTS (
         SELECT 1 FROM categories c
         WHERE c.id = ${alias}.primary_category_id
           AND lower(c.slug) = ANY(${p})
       )`,
    );
  }

  if (filters.service) {
    const p = pushParam(parts, filters.service.toLowerCase());
    parts.where.push(
      `(
         EXISTS (
           SELECT 1 FROM services svc
           WHERE svc.id = ${alias}.primary_service_id
             AND (lower(svc.slug) = ${p} OR lower(svc.name) = ${p})
         )
         OR EXISTS (
           SELECT 1
           FROM supplier_services ss
           JOIN services svc ON svc.id = ss.service_id
           WHERE ss.supplier_id = ${alias}.id
             AND (lower(svc.slug) = ${p} OR lower(svc.name) = ${p})
         )
       )`,
    );
  }

  if (filters.serviceSlugs?.length) {
    const p = pushParam(parts, filters.serviceSlugs.map((s) => s.toLowerCase()));
    parts.where.push(
      `(
         EXISTS (
           SELECT 1 FROM services svc
           WHERE svc.id = ${alias}.primary_service_id
             AND lower(svc.slug) = ANY(${p})
         )
         OR EXISTS (
           SELECT 1
           FROM supplier_services ss
           JOIN services svc ON svc.id = ss.service_id
           WHERE ss.supplier_id = ${alias}.id
             AND lower(svc.slug) = ANY(${p})
         )
       )`,
    );
  }

  if (filters.county) {
    const p = pushParam(parts, filters.county.toLowerCase());
    parts.where.push(`lower(${alias}.county) = ${p}`);
  }

  if (filters.town) {
    const p = pushParam(parts, filters.town.toLowerCase());
    parts.where.push(`lower(${alias}.town) = ${p}`);
  }

  if (filters.nation) {
    const p = pushParam(parts, filters.nation.toLowerCase());
    parts.where.push(
      `EXISTS (
         WITH RECURSIVE ancestors AS (
           SELECT l.id, l.parent_id, l.slug, l.name, l.location_type
           FROM locations l
           WHERE l.id = ${alias}.location_id
           UNION ALL
           SELECT p.id, p.parent_id, p.slug, p.name, p.location_type
           FROM locations p
           JOIN ancestors a ON a.parent_id = p.id
         )
         SELECT 1 FROM ancestors
         WHERE location_type = 'nation'
           AND (lower(slug) = ${p} OR lower(name) = ${p})
       )`,
    );
  }

  if (filters.locationId) {
    const p = pushParam(parts, filters.locationId);
    parts.where.push(
      `(
         ${alias}.location_id = ${p}
         OR EXISTS (
           WITH RECURSIVE descendants AS (
             SELECT id FROM locations WHERE id = ${p}
             UNION ALL
             SELECT l.id FROM locations l
             JOIN descendants d ON l.parent_id = d.id
           )
           SELECT 1 FROM descendants WHERE id = ${alias}.location_id
         )
       )`,
    );
  }

  if (filters.minRating !== undefined) {
    const p = pushParam(parts, filters.minRating);
    parts.where.push(`${alias}.google_rating >= ${p}`);
  }

  if (filters.hasEmail === true) {
    parts.where.push(
      `EXISTS (
         SELECT 1 FROM supplier_contacts sc
         WHERE sc.supplier_id = ${alias}.id AND sc.channel = 'email' AND sc.is_business
       )`,
    );
  } else if (filters.hasEmail === false) {
    parts.where.push(
      `NOT EXISTS (
         SELECT 1 FROM supplier_contacts sc
         WHERE sc.supplier_id = ${alias}.id AND sc.channel = 'email' AND sc.is_business
       )`,
    );
  }

  if (filters.hasPhone === true) {
    parts.where.push(
      `EXISTS (
         SELECT 1 FROM supplier_contacts sc
         WHERE sc.supplier_id = ${alias}.id AND sc.channel = 'phone' AND sc.is_business
       )`,
    );
  } else if (filters.hasPhone === false) {
    parts.where.push(
      `NOT EXISTS (
         SELECT 1 FROM supplier_contacts sc
         WHERE sc.supplier_id = ${alias}.id AND sc.channel = 'phone' AND sc.is_business
       )`,
    );
  }

  if (filters.status) {
    const p = pushParam(parts, filters.status);
    parts.where.push(`${alias}.status = ${p}`);
  }

  if (filters.countryCode) {
    const p = pushParam(parts, filters.countryCode.toUpperCase());
    parts.where.push(`${alias}.country_code = ${p}`);
  }

  return parts;
}

export async function searchSuppliers(db: DbClient, query: SupplierSearch) {
  const { offset, limit } = offsetLimit(query.page, query.pageSize);
  const filters = buildSupplierFilters(query);

  const whereSql = filters.where.length ? `WHERE ${filters.where.join(" AND ")}` : "";

  const countResult = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM suppliers s ${whereSql}`,
    filters.params,
  );

  const listParams = [...filters.params, limit, offset];
  const limitPlaceholder = `$${filters.params.length + 1}`;
  const offsetPlaceholder = `$${filters.params.length + 2}`;

  const rows = await db.query(
    `SELECT
        s.id,
        s.company_name,
        s.status,
        s.town,
        s.county,
        s.postcode,
        s.country_code,
        s.website,
        s.google_rating,
        s.google_review_count,
        s.date_found,
        s.last_verified,
        s.location_id,
        c.name AS category_name,
        c.slug AS category_slug,
        svc.name AS primary_service_name,
        svc.slug AS primary_service_slug,
        EXISTS (
          SELECT 1 FROM supplier_contacts sc
          WHERE sc.supplier_id = s.id AND sc.channel = 'email' AND sc.is_business
        ) AS has_email,
        EXISTS (
          SELECT 1 FROM supplier_contacts sc
          WHERE sc.supplier_id = s.id AND sc.channel = 'phone' AND sc.is_business
        ) AS has_phone,
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
     FROM suppliers s
     LEFT JOIN categories c ON c.id = s.primary_category_id
     LEFT JOIN services svc ON svc.id = s.primary_service_id
     ${whereSql}
     ORDER BY s.company_name ASC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    listParams,
  );

  return {
    data: rows.rows,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: Number(countResult.rows[0]?.count ?? 0),
    },
  };
}

async function assertNotSuppressed(
  db: DbClient,
  contacts: CreateSupplier["contacts"],
): Promise<void> {
  for (const contact of contacts) {
    if (contact.channel !== "email" && contact.channel !== "phone") continue;
    const normalised =
      contact.channel === "email"
        ? normalizeEmail(contact.value)
        : normalizePhone(contact.value);
    if (!normalised) continue;

    const hit = await db.query(
      `SELECT id FROM suppression_list
       WHERE channel = $1 AND value_normalised = $2
         AND (expires_at IS NULL OR expires_at > now())
       LIMIT 1`,
      [contact.channel, normalised],
    );
    if (hit.rowCount) {
      throw new AppError(
        409,
        `Contact ${contact.value} is on the suppression list`,
        "SUPPRESSED_CONTACT",
      );
    }
  }
}

async function insertContacts(
  db: DbClient,
  supplierId: string,
  contacts: CreateSupplier["contacts"],
) {
  for (const contact of contacts) {
    const valueNormalised =
      contact.channel === "email"
        ? normalizeEmail(contact.value)
        : contact.channel === "phone"
          ? normalizePhone(contact.value)
          : contact.value.trim().toLowerCase();

    await db.query(
      `INSERT INTO supplier_contacts
         (supplier_id, channel, value, value_normalised, is_primary, is_business, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        supplierId,
        contact.channel,
        contact.value.trim(),
        valueNormalised,
        contact.isPrimary,
        contact.isBusiness,
        contact.sourceUrl ?? null,
      ],
    );
  }
}

async function insertSocials(
  db: DbClient,
  supplierId: string,
  socials: CreateSupplier["socials"],
) {
  for (const social of socials) {
    await db.query(
      `INSERT INTO supplier_socials
         (supplier_id, platform, url, url_normalised, handle)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        supplierId,
        social.platform,
        social.url,
        normalizeUrl(social.url),
        social.handle ?? null,
      ],
    );
  }
}

async function syncServices(
  db: DbClient,
  supplierId: string,
  serviceIds: string[],
  primaryServiceId?: string | null,
) {
  await db.query(`DELETE FROM supplier_services WHERE supplier_id = $1`, [supplierId]);
  const unique = [...new Set(serviceIds)];
  if (primaryServiceId && !unique.includes(primaryServiceId)) {
    unique.push(primaryServiceId);
  }
  for (const serviceId of unique) {
    await db.query(
      `INSERT INTO supplier_services (supplier_id, service_id, is_primary)
       VALUES ($1, $2, $3)`,
      [supplierId, serviceId, serviceId === primaryServiceId],
    );
  }
}

export async function getSupplierById(db: DbClient, id: string) {
  const supplier = await db.query(`SELECT * FROM suppliers WHERE id = $1`, [id]);
  if (!supplier.rowCount) {
    throw new AppError(404, "Supplier not found", "NOT_FOUND");
  }

  // Sequential queries — PoolClient cannot run concurrent queries on one connection.
  const contacts = await db.query(
    `SELECT * FROM supplier_contacts
     WHERE supplier_id = $1
     ORDER BY channel, is_primary DESC`,
    [id],
  );
  const socials = await db.query(
    `SELECT * FROM supplier_socials WHERE supplier_id = $1 ORDER BY platform`,
    [id],
  );
  const services = await db.query(
    `SELECT ss.*, svc.name, svc.slug, svc.category_id
     FROM supplier_services ss
     JOIN services svc ON svc.id = ss.service_id
     WHERE ss.supplier_id = $1`,
    [id],
  );

  return {
    ...supplier.rows[0],
    contacts: contacts.rows,
    socials: socials.rows,
    services: services.rows,
  };
}

export async function createSupplier(input: CreateSupplier) {
  try {
    return await withTransaction(async (db) => {
      await assertNotSuppressed(db, input.contacts);

      const websiteNorm = normalizeWebsite(input.website ?? null);
      const gmbNorm = normalizeUrl(input.googleBusinessUrl ?? null);

      const inserted = await db.query(
        `INSERT INTO suppliers (
           company_name, company_name_normalised,
           primary_category_id, primary_service_id, location_id,
           town, county, postcode, country_code, latitude, longitude,
           website, website_normalised,
           google_rating, google_review_count,
           google_business_url, google_business_url_norm,
           source_url, discovery_query, status, notes, metadata
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
           $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
         )
         RETURNING *`,
        [
          input.companyName,
          normalizeName(input.companyName),
          input.primaryCategoryId ?? null,
          input.primaryServiceId ?? null,
          input.locationId ?? null,
          input.town ?? null,
          input.county ?? null,
          input.postcode ?? null,
          input.countryCode,
          input.latitude ?? null,
          input.longitude ?? null,
          input.website ?? null,
          websiteNorm,
          input.googleRating ?? null,
          input.googleReviewCount ?? null,
          input.googleBusinessUrl ?? null,
          gmbNorm,
          input.sourceUrl ?? null,
          input.discoveryQuery ?? null,
          input.status,
          input.notes ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );

      const supplier = inserted.rows[0];
      await insertContacts(db, supplier.id, input.contacts);
      await insertSocials(db, supplier.id, input.socials);
      await syncServices(db, supplier.id, input.serviceIds, input.primaryServiceId);

      await writeAudit(db, {
        entityType: "supplier",
        entityId: supplier.id,
        action: "create",
        actor: input.actor ?? "api",
        after: supplier,
      });

      return getSupplierById(db, supplier.id);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Duplicate supplier identifier", "DUPLICATE_SUPPLIER", error);
    }
    throw error;
  }
}

export async function updateSupplier(id: string, input: UpdateSupplier) {
  try {
    return await withTransaction(async (db) => {
      const existing = await getSupplierById(db, id);

      if (input.contacts) {
        await assertNotSuppressed(db, input.contacts);
      }

      const companyName = input.companyName ?? existing.company_name;
      const website = input.website !== undefined ? input.website : existing.website;
      const gmb =
        input.googleBusinessUrl !== undefined
          ? input.googleBusinessUrl
          : existing.google_business_url;

      const updated = await db.query(
        `UPDATE suppliers SET
           company_name = $2,
           company_name_normalised = $3,
           primary_category_id = COALESCE($4, primary_category_id),
           primary_service_id = COALESCE($5, primary_service_id),
           location_id = COALESCE($6, location_id),
           town = COALESCE($7, town),
           county = COALESCE($8, county),
           postcode = COALESCE($9, postcode),
           country_code = COALESCE($10, country_code),
           latitude = COALESCE($11, latitude),
           longitude = COALESCE($12, longitude),
           website = $13,
           website_normalised = $14,
           google_rating = COALESCE($15, google_rating),
           google_review_count = COALESCE($16, google_review_count),
           google_business_url = $17,
           google_business_url_norm = $18,
           source_url = COALESCE($19, source_url),
           discovery_query = COALESCE($20, discovery_query),
           status = COALESCE($21, status),
           notes = COALESCE($22, notes),
           metadata = COALESCE($23, metadata)
         WHERE id = $1
         RETURNING *`,
        [
          id,
          companyName,
          normalizeName(companyName),
          input.primaryCategoryId ?? null,
          input.primaryServiceId ?? null,
          input.locationId ?? null,
          input.town ?? null,
          input.county ?? null,
          input.postcode ?? null,
          input.countryCode ?? null,
          input.latitude ?? null,
          input.longitude ?? null,
          website ?? null,
          normalizeWebsite(website ?? null),
          input.googleRating ?? null,
          input.googleReviewCount ?? null,
          gmb ?? null,
          normalizeUrl(gmb ?? null),
          input.sourceUrl ?? null,
          input.discoveryQuery ?? null,
          input.status ?? null,
          input.notes ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
        ],
      );

      if (input.contacts) {
        await db.query(`DELETE FROM supplier_contacts WHERE supplier_id = $1`, [id]);
        await insertContacts(db, id, input.contacts);
      }

      if (input.socials) {
        await db.query(`DELETE FROM supplier_socials WHERE supplier_id = $1`, [id]);
        await insertSocials(db, id, input.socials);
      }

      if (input.serviceIds || input.primaryServiceId !== undefined) {
        await syncServices(
          db,
          id,
          input.serviceIds ?? existing.services.map((s: { service_id: string }) => s.service_id),
          input.primaryServiceId !== undefined
            ? input.primaryServiceId
            : existing.primary_service_id,
        );
      }

      await writeAudit(db, {
        entityType: "supplier",
        entityId: id,
        action: "update",
        actor: input.actor ?? "api",
        before: existing,
        after: updated.rows[0],
      });

      return getSupplierById(db, id);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Duplicate supplier identifier", "DUPLICATE_SUPPLIER", error);
    }
    throw error;
  }
}

export async function deleteSupplier(id: string, actor = "api") {
  return withTransaction(async (db) => {
    const existing = await getSupplierById(db, id);
    await db.query(
      `UPDATE suppliers SET status = 'archived' WHERE id = $1`,
      [id],
    );
    await writeAudit(db, {
      entityType: "supplier",
      entityId: id,
      action: "delete",
      actor,
      before: existing,
    });
    return { id, status: "archived" };
  });
}

export async function verifySupplier(id: string, actor = "api") {
  return withTransaction(async (db) => {
    const existing = await getSupplierById(db, id);
    const updated = await db.query(
      `UPDATE suppliers
       SET status = 'verified', last_verified = now()
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    await db.query(
      `UPDATE supplier_contacts
       SET is_verified = TRUE, verified_at = now()
       WHERE supplier_id = $1`,
      [id],
    );
    await writeAudit(db, {
      entityType: "supplier",
      entityId: id,
      action: "verify",
      actor,
      before: existing,
      after: updated.rows[0],
    });
    return getSupplierById(db, id);
  });
}

export async function mergeSuppliers(
  masterId: string,
  duplicateIds: string[],
  actor = "api",
) {
  if (duplicateIds.includes(masterId)) {
    throw new AppError(400, "masterId cannot be in duplicateIds", "INVALID_MERGE");
  }

  return withTransaction(async (db) => {
    const master = await getSupplierById(db, masterId);

    for (const dupId of duplicateIds) {
      const dup = await getSupplierById(db, dupId);

      await db.query(
        `INSERT INTO supplier_contacts
           (supplier_id, channel, value, value_normalised, is_primary, is_business, source_url)
         SELECT $1, sc.channel, sc.value, sc.value_normalised, FALSE, sc.is_business, sc.source_url
         FROM supplier_contacts sc
         WHERE sc.supplier_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM supplier_contacts existing
             WHERE existing.channel = sc.channel
               AND existing.value_normalised = sc.value_normalised
           )`,
        [masterId, dupId],
      );

      await db.query(
        `INSERT INTO supplier_socials
           (supplier_id, platform, url, url_normalised, handle)
         SELECT $1, ss.platform, ss.url, ss.url_normalised, ss.handle
         FROM supplier_socials ss
         WHERE ss.supplier_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM supplier_socials existing
             WHERE existing.url_normalised = ss.url_normalised
           )
           AND NOT EXISTS (
             SELECT 1 FROM supplier_socials existing
             WHERE existing.supplier_id = $1 AND existing.platform = ss.platform
           )`,
        [masterId, dupId],
      );

      await db.query(
        `INSERT INTO supplier_services (supplier_id, service_id, is_primary, confidence)
         SELECT $1, ss.service_id, FALSE, ss.confidence
         FROM supplier_services ss
         WHERE ss.supplier_id = $2
         ON CONFLICT (supplier_id, service_id) DO NOTHING`,
        [masterId, dupId],
      );

      await db.query(
        `UPDATE suppliers
         SET status = 'merged', master_supplier_id = $1
         WHERE id = $2`,
        [masterId, dupId],
      );

      await writeAudit(db, {
        entityType: "supplier",
        entityId: dupId,
        action: "merge",
        actor,
        before: dup,
        after: { master_supplier_id: masterId, status: "merged" },
        context: { masterId },
      });
    }

    await writeAudit(db, {
      entityType: "supplier",
      entityId: masterId,
      action: "merge",
      actor,
      before: master,
      context: { mergedIds: duplicateIds },
    });

    return getSupplierById(db, masterId);
  });
}

import type { DbClient } from "../db/pool.js";
import { normalizeWebsite } from "../lib/normalize.js";
import { createSupplier } from "../services/suppliers.js";
import { filterBusinessEmails } from "./compliance.js";
import type { ExtractedBusiness, SearchHit } from "./types.js";

export type IngestResult =
  | { status: "created"; supplierId: string }
  | { status: "duplicate"; reason: string }
  | { status: "suppressed"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "dry_run" };

export async function ingestDiscoveryHit(opts: {
  db: DbClient;
  hit: SearchHit;
  extracted?: ExtractedBusiness;
  serviceId: string;
  categoryId: string;
  locationId: string;
  locationName: string;
  queryText: string;
  dryRun?: boolean;
}): Promise<IngestResult> {
  const website = opts.hit.website ?? opts.hit.sourceUrl;
  const websiteNorm = normalizeWebsite(website);

  if (!websiteNorm) {
    return { status: "rejected", reason: "missing_website" };
  }

  // Skip if already a master supplier
  const existing = await opts.db.query(
    `SELECT id FROM suppliers
     WHERE website_normalised = $1
       AND status NOT IN ('merged', 'archived', 'suppressed')
     LIMIT 1`,
    [websiteNorm],
  );
  if (existing.rowCount) {
    return { status: "duplicate", reason: "website_exists" };
  }

  let host: string | null = null;
  try {
    host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
  } catch {
    host = null;
  }

  const emails = filterBusinessEmails(
    [
      ...(opts.hit.email ? [opts.hit.email] : []),
      ...(opts.extracted?.emails ?? []),
    ],
    host,
  );

  const phones = [
    ...new Set(
      [...(opts.hit.phone ? [opts.hit.phone] : []), ...(opts.extracted?.phones ?? [])].map(
        (p) => p.trim(),
      ),
    ),
  ];

  // Suppression check before create
  for (const email of emails) {
    const suppressed = await opts.db.query(
      `SELECT 1 FROM suppression_list
       WHERE channel = 'email' AND value_normalised = $1
         AND (expires_at IS NULL OR expires_at > now())
       LIMIT 1`,
      [email.toLowerCase()],
    );
    if (suppressed.rowCount) {
      return { status: "suppressed", reason: `email:${email}` };
    }
  }

  if (opts.dryRun) {
    return { status: "dry_run" };
  }

  const companyName =
    opts.hit.companyName ||
    opts.extracted?.companyName ||
    websiteNorm.split("/")[0] ||
    "Unknown business";

  try {
    const created = await createSupplier({
      companyName,
      primaryCategoryId: opts.categoryId,
      primaryServiceId: opts.serviceId,
      serviceIds: [opts.serviceId],
      locationId: opts.locationId,
      town: opts.hit.town ?? opts.locationName,
      county: opts.hit.county ?? null,
      countryCode: "GB",
      website: website.startsWith("http") ? website : `https://${website}`,
      googleRating: opts.hit.rating ?? null,
      sourceUrl: opts.hit.sourceUrl,
      discoveryQuery: opts.queryText,
      status: "discovered",
      metadata: {
        discovery: true,
        provider_snippet: opts.hit.snippet ?? null,
      },
      contacts: [
        ...emails.slice(0, 3).map((value, i) => ({
          channel: "email" as const,
          value,
          isPrimary: i === 0,
          isBusiness: true,
          sourceUrl: opts.hit.sourceUrl,
        })),
        ...phones.slice(0, 2).map((value, i) => ({
          channel: "phone" as const,
          value,
          isPrimary: i === 0,
          isBusiness: true,
          sourceUrl: opts.hit.sourceUrl,
        })),
        ...(opts.extracted?.contactPage
          ? [
              {
                channel: "contact_page" as const,
                value: opts.extracted.contactPage,
                isPrimary: true,
                isBusiness: true,
                sourceUrl: opts.hit.sourceUrl,
              },
            ]
          : []),
      ],
      socials: (opts.extracted?.socials ?? []).slice(0, 6).map((s) => ({
        platform: s.platform,
        url: s.url,
      })),
      actor: "discovery",
    });

    return { status: "created", supplierId: created.id };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "DUPLICATE_SUPPLIER"
    ) {
      return { status: "duplicate", reason: "constraint" };
    }
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "SUPPRESSED_CONTACT"
    ) {
      return { status: "suppressed", reason: "contact" };
    }
    throw error;
  }
}

import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const supplierSearchSchema = paginationSchema.extend({
  q: z.string().trim().min(1).optional(),
  category: z.string().trim().optional(),
  service: z.string().trim().optional(),
  county: z.string().trim().optional(),
  town: z.string().trim().optional(),
  nation: z.string().trim().optional(),
  locationId: uuidSchema.optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  hasEmail: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  hasPhone: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  status: z.string().trim().optional(),
  countryCode: z.string().length(2).optional(),
});

export const contactInputSchema = z.object({
  channel: z.enum(["email", "phone", "contact_page", "form"]),
  value: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
  isBusiness: z.boolean().default(true),
  sourceUrl: z.string().url().optional().nullable(),
});

export const socialInputSchema = z.object({
  platform: z.enum([
    "facebook",
    "instagram",
    "linkedin",
    "twitter",
    "tiktok",
    "youtube",
    "google_business",
    "other",
  ]),
  url: z.string().url(),
  handle: z.string().trim().optional().nullable(),
});

export const createSupplierSchema = z.object({
  companyName: z.string().trim().min(1).max(300),
  primaryCategoryId: uuidSchema.optional().nullable(),
  primaryServiceId: uuidSchema.optional().nullable(),
  serviceIds: z.array(uuidSchema).default([]),
  locationId: uuidSchema.optional().nullable(),
  town: z.string().trim().optional().nullable(),
  county: z.string().trim().optional().nullable(),
  postcode: z.string().trim().optional().nullable(),
  countryCode: z.string().length(2).default("GB"),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  website: z.string().trim().optional().nullable(),
  googleRating: z.number().min(0).max(5).optional().nullable(),
  googleReviewCount: z.number().int().min(0).optional().nullable(),
  googleBusinessUrl: z.string().url().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  discoveryQuery: z.string().trim().optional().nullable(),
  status: z
    .enum([
      "discovered",
      "enriched",
      "verified",
      "needs_review",
      "duplicate_candidate",
      "merged",
      "suppressed",
      "archived",
    ])
    .default("discovered"),
  notes: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
  contacts: z.array(contactInputSchema).default([]),
  socials: z.array(socialInputSchema).default([]),
  actor: z.string().trim().optional(),
});

export const updateSupplierSchema = createSupplierSchema
  .partial()
  .omit({ actor: true })
  .extend({
    actor: z.string().trim().optional(),
  });

export const mergeSuppliersSchema = z.object({
  masterId: uuidSchema,
  duplicateIds: z.array(uuidSchema).min(1),
  actor: z.string().trim().optional(),
});

export type SupplierSearch = z.infer<typeof supplierSearchSchema>;
export type CreateSupplier = z.infer<typeof createSupplierSchema>;
export type UpdateSupplier = z.infer<typeof updateSupplierSchema>;

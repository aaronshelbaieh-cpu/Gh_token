import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const campaignFilterSchema = z.object({
  categorySlugs: z.array(z.string()).optional(),
  serviceSlugs: z.array(z.string()).optional(),
  county: z.string().optional(),
  town: z.string().optional(),
  nation: z.string().optional(),
  locationId: uuidSchema.optional(),
  minRating: z.number().min(0).max(5).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  countryCode: z.string().length(2).optional(),
  q: z.string().optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().optional().nullable(),
  filterCriteria: campaignFilterSchema.default({}),
  createdBy: z.string().trim().optional(),
  materialize: z.boolean().default(true),
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(["draft", "ready", "exported", "archived"]).optional(),
});

export const exportRequestSchema = z.object({
  campaignId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(200),
  format: z.enum(["csv", "xlsx"]).default("csv"),
  filterCriteria: campaignFilterSchema.optional(),
  requestedBy: z.string().trim().optional(),
});

export const listCampaignsSchema = paginationSchema.extend({
  status: z.enum(["draft", "ready", "exported", "archived"]).optional(),
});

export type CampaignFilter = z.infer<typeof campaignFilterSchema>;
export type CreateCampaign = z.infer<typeof createCampaignSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;

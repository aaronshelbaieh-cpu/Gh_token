import { z } from "zod";
import { uuidSchema } from "./common.js";

export const generateQueriesSchema = z.object({
  serviceSlugs: z.array(z.string()).optional(),
  locationTypes: z
    .array(
      z.enum([
        "country",
        "nation",
        "county",
        "unitary_authority",
        "city",
        "town",
        "village",
        "district",
      ]),
    )
    .optional(),
  locationIds: z.array(uuidSchema).optional(),
  countryCode: z.string().length(2).default("GB"),
  preferAlias: z.boolean().default(true),
  limit: z.number().int().positive().max(50_000).optional(),
});

export const createRunSchema = z.object({
  name: z.string().trim().min(1).max(200),
  provider: z.enum(["mock", "manual"]).default("mock"),
  createdBy: z.string().optional(),
  execute: z.boolean().default(true),
  config: z
    .object({
      limitPerQuery: z.number().int().min(1).max(20).default(5),
      maxQueries: z.number().int().min(1).max(500).default(25),
      serviceSlugs: z.array(z.string()).optional(),
      locationIds: z.array(uuidSchema).optional(),
      locationTypes: z.array(z.string()).optional(),
      enrichWebsites: z.boolean().default(true),
      dryRun: z.boolean().default(false),
    })
    .default({}),
  seedHits: z
    .array(
      z.object({
        companyName: z.string().optional(),
        website: z.string().optional(),
        sourceUrl: z.string().url(),
        snippet: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        town: z.string().optional(),
        county: z.string().optional(),
        rating: z.number().min(0).max(5).optional(),
      }),
    )
    .optional(),
});

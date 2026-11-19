import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { paginationSchema, uuidSchema } from "../schemas/common.js";
import {
  createCampaignSchema,
  listCampaignsSchema,
  updateCampaignSchema,
} from "../schemas/campaigns.js";
import * as campaignService from "../services/campaigns.js";

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/campaigns", async (req) => {
    const query = listCampaignsSchema.parse(req.query);
    return campaignService.listCampaigns(pool, query);
  });

  app.post("/campaigns", async (req, reply) => {
    const body = createCampaignSchema.parse(req.body);
    const created = await campaignService.createCampaign(body);
    return reply.code(201).send(created);
  });

  app.get("/campaigns/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    return campaignService.getCampaign(pool, id);
  });

  app.patch("/campaigns/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const body = updateCampaignSchema.parse(req.body);
    return campaignService.updateCampaign(id, body);
  });

  app.post("/campaigns/:id/materialize", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const campaign = await campaignService.getCampaign(pool, id);
    const count = await campaignService.materializeCampaign(
      pool,
      id,
      campaign.filter_criteria,
    );
    return { campaignId: id, memberCount: count };
  });

  app.get("/campaigns/:id/suppliers", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const query = paginationSchema.parse(req.query);
    return campaignService.listCampaignSuppliers(
      pool,
      id,
      query.page,
      query.pageSize,
    );
  });
}

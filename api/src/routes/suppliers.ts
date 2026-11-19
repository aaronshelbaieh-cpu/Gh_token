import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { uuidSchema } from "../schemas/common.js";
import {
  createSupplierSchema,
  mergeSuppliersSchema,
  supplierSearchSchema,
  updateSupplierSchema,
} from "../schemas/suppliers.js";
import * as supplierService from "../services/suppliers.js";

export async function supplierRoutes(app: FastifyInstance) {
  app.get("/suppliers", async (req) => {
    const query = supplierSearchSchema.parse(req.query);
    return supplierService.searchSuppliers(pool, query);
  });

  app.get("/suppliers/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    return supplierService.getSupplierById(pool, id);
  });

  app.post("/suppliers", async (req, reply) => {
    const body = createSupplierSchema.parse(req.body);
    const created = await supplierService.createSupplier(body);
    return reply.code(201).send(created);
  });

  app.patch("/suppliers/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const body = updateSupplierSchema.parse(req.body);
    return supplierService.updateSupplier(id, body);
  });

  app.delete("/suppliers/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const actor = z
      .object({ actor: z.string().optional() })
      .parse(req.query).actor;
    return supplierService.deleteSupplier(id, actor ?? "api");
  });

  app.post("/suppliers/:id/verify", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const actor = z
      .object({ actor: z.string().optional() })
      .parse(typeof req.body === "object" && req.body ? req.body : {}).actor;
    return supplierService.verifySupplier(id, actor ?? "api");
  });

  app.post("/suppliers/merge", async (req) => {
    const body = mergeSuppliersSchema.parse(req.body);
    return supplierService.mergeSuppliers(
      body.masterId,
      body.duplicateIds,
      body.actor ?? "api",
    );
  });
}

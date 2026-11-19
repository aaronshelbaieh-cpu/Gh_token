import type { FastifyInstance } from "fastify";
import { pool } from "../db/pool.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "ged-api" }));

  app.get("/ready", async (_req, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ready", database: "up" };
    } catch {
      return reply.code(503).send({ status: "not_ready", database: "down" });
    }
  });
}

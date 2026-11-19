import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { AppError } from "../lib/errors.js";
import { uuidSchema } from "../schemas/common.js";
import { exportRequestSchema } from "../schemas/campaigns.js";
import * as exportService from "../services/exports.js";

export async function exportRoutes(app: FastifyInstance) {
  app.post("/exports", async (req, reply) => {
    const body = exportRequestSchema.parse(req.body);
    const job = await exportService.createExport(body);
    return reply.code(201).send(job);
  });

  app.get("/exports/:id", async (req) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    return exportService.getExport(pool, id);
  });

  app.get("/exports/:id/download", async (req, reply) => {
    const { id } = z.object({ id: uuidSchema }).parse(req.params);
    const job = await exportService.getExport(pool, id);

    if (job.status !== "completed" || !job.file_path) {
      throw new AppError(409, "Export is not ready for download", "EXPORT_NOT_READY");
    }

    try {
      await access(job.file_path);
    } catch {
      throw new AppError(404, "Export file missing on disk", "EXPORT_FILE_MISSING");
    }

    const contentType =
      job.format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv";

    reply
      .header("Content-Type", contentType)
      .header(
        "Content-Disposition",
        `attachment; filename="ged-export-${id}.${job.format}"`,
      );

    return reply.send(createReadStream(job.file_path));
  });
}

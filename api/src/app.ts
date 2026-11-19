import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./config.js";
import { AppError } from "./lib/errors.js";
import { adminRoutes } from "./routes/admin.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { catalogRoutes } from "./routes/catalog.js";
import { discoveryRoutes } from "./routes/discovery.js";
import { exportRoutes } from "./routes/exports.js";
import { healthRoutes } from "./routes/health.js";
import { supplierRoutes } from "./routes/suppliers.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  await app.register(sensible);
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
  });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten(),
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code ?? "APP_ERROR",
        message: error.message,
        details: error.details,
      });
    }

    app.log.error(error);
    const statusCode =
      typeof error === "object" &&
      error &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    return reply.code(statusCode).send({
      error: "INTERNAL_ERROR",
      message: statusCode >= 500 ? "Internal server error" : (error as Error).message,
    });
  });

  await app.register(healthRoutes);
  await app.register(catalogRoutes);
  await app.register(supplierRoutes);
  await app.register(campaignRoutes);
  await app.register(exportRoutes);
  await app.register(discoveryRoutes);
  await app.register(adminRoutes);

  app.get("/", async () => ({
    name: "Global Events Directory API",
    version: "0.3.0",
    phase: 3,
    docs: "/health",
  }));

  return app;
}

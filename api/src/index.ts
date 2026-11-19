import { env } from "./config.js";
import { pool } from "./db/pool.js";
import { buildApp } from "./app.js";

async function main() {
  const app = await buildApp();

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    app.log.error(error, "Failed to connect to PostgreSQL");
    process.exit(1);
  }

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`GED API listening on http://${env.HOST}:${env.PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * CLI for Phase 3 discovery.
 *
 *   npx tsx scripts/discovery-cli.ts generate --service floristry --locations city,town
 *   npx tsx scripts/discovery-cli.ts run --name "Swansea florists" --service floristry --max 5
 */
import { pool } from "../src/db/pool.js";
import {
  countPendingQueries,
  generateDiscoveryQueries,
} from "../src/discovery/queryGenerator.js";
import {
  createDiscoveryRun,
  executeDiscoveryRun,
} from "../src/discovery/runner.js";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === "generate") {
    const service = arg("service");
    const locations = (arg("locations") ?? "city,town").split(",");
    const limit = arg("limit") ? Number(arg("limit")) : undefined;
    const result = await generateDiscoveryQueries(pool, {
      serviceSlugs: service ? [service] : undefined,
      locationTypes: locations as Array<
        "city" | "town" | "county" | "unitary_authority"
      >,
      limit,
      preferAlias: !flag("no-alias"),
    });
    console.log(JSON.stringify({ ...result, pending: await countPendingQueries(pool) }, null, 2));
    return;
  }

  if (cmd === "run") {
    const name = arg("name") ?? `discovery-${new Date().toISOString()}`;
    const service = arg("service");
    const max = Number(arg("max") ?? 10);
    const provider = (arg("provider") ?? "mock") as "mock" | "manual";
    const dryRun = flag("dry-run");

    const run = await createDiscoveryRun({
      name,
      provider,
      config: {
        maxQueries: max,
        limitPerQuery: Number(arg("per-query") ?? 3),
        serviceSlugs: service ? [service] : undefined,
        dryRun,
        enrichWebsites: !flag("no-enrich"),
      },
      createdBy: "cli",
    });

    const completed = await executeDiscoveryRun(run.id);
    console.log(
      JSON.stringify(
        {
          id: completed.id,
          status: completed.status,
          queries_completed: completed.queries_completed,
          candidates_found: completed.candidates_found,
          suppliers_created: completed.suppliers_created,
          suppliers_skipped: completed.suppliers_skipped,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === "stats") {
    const pending = await countPendingQueries(pool);
    console.log(JSON.stringify({ pending }, null, 2));
    return;
  }

  console.log(`Usage:
  discovery-cli generate [--service floristry] [--locations city,town] [--limit N]
  discovery-cli run --name "..." [--service floristry] [--max 10] [--provider mock] [--dry-run]
  discovery-cli stats`);
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

import { createHash } from "node:crypto";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";
import { isBusinessEmail } from "../src/discovery/compliance.js";
import { extractBusinessFromHtml } from "../src/discovery/extract.js";
import { mockBusinessHtml } from "../src/discovery/providers/mock.js";

async function main() {
  // Compliance unit checks
  if (isBusinessEmail("john.smith@gmail.com")) {
    throw new Error("gmail personal email should be rejected");
  }
  if (!isBusinessEmail("info@swanseaflorist.co.uk", "swanseaflorist.co.uk")) {
    throw new Error("business email should be accepted");
  }

  const html = mockBusinessHtml({
    companyName: "Swansea Petals",
    email: "hello@swanseapetals.example",
    phone: "+44 1792 555 010",
    website: "https://swanseapetals.example",
  });
  const extracted = extractBusinessFromHtml(html, "https://swanseapetals.example/");
  if (!extracted.emails.includes("hello@swanseapetals.example")) {
    throw new Error("failed to extract business email");
  }

  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const base = `http://127.0.0.1:${address.port}`;

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
    return json;
  };
  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`);
    const json = await res.json();
    if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(json)}`);
    return json;
  };

  // Clean prior mock artefacts so the smoke run is deterministic.
  await pool.query(
    `DELETE FROM supplier_contacts WHERE supplier_id IN (
       SELECT id FROM suppliers WHERE website_normalised LIKE '%.example%'
         OR website ILIKE '%.example%'
     )`,
  );
  await pool.query(
    `DELETE FROM supplier_socials WHERE supplier_id IN (
       SELECT id FROM suppliers WHERE website_normalised LIKE '%.example%'
         OR website ILIKE '%.example%'
     )`,
  );
  await pool.query(
    `DELETE FROM supplier_services WHERE supplier_id IN (
       SELECT id FROM suppliers WHERE website_normalised LIKE '%.example%'
         OR website ILIKE '%.example%'
     )`,
  );
  await pool.query(
    `DELETE FROM suppliers WHERE website_normalised LIKE '%.example%' OR website ILIKE '%.example%'`,
  );
  await pool.query(
    `UPDATE discovery_queries SET status = 'pending', completed_at = NULL, last_error = NULL
     WHERE status IN ('completed', 'failed', 'running')`,
  );

  console.log("→ generate queries (floristry × city/town, capped)");
  const generated = await post("/discovery/queries/generate", {
    serviceSlugs: ["floristry"],
    locationTypes: ["city", "town"],
    limit: 20,
  });
  if (!generated.inserted && !generated.skipped) {
    throw new Error("expected query generation activity");
  }

  console.log("→ run mock discovery");
  const run = await post("/discovery/runs", {
    name: `smoke-discovery-${Date.now()}`,
    provider: "mock",
    execute: true,
    config: {
      serviceSlugs: ["floristry"],
      maxQueries: 3,
      limitPerQuery: 2,
      enrichWebsites: true,
    },
  });

  if (run.status !== "completed") {
    throw new Error(`run status ${run.status}`);
  }
  if (run.suppliers_created < 1) {
    throw new Error(
      `expected suppliers to be created from mock provider, got ${JSON.stringify(run)}`,
    );
  }

  const candidates = await get(`/discovery/runs/${run.id}/candidates`);
  if (!candidates.data?.length) throw new Error("no candidates");

  const stats = await get("/discovery/stats");
  console.log("✓ discovery smoke passed", {
    generated,
    runId: run.id,
    suppliers_created: run.suppliers_created,
    candidates: candidates.data.length,
    pendingQueries: stats.pendingQueries,
    fingerprint: createHash("sha1").update(JSON.stringify(run.id)).digest("hex").slice(0, 8),
  });

  await app.close();
  await pool.end();
}

main().catch(async (error) => {
  console.error("✗ discovery smoke failed", error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

/**
 * Phase 2 smoke test — exercises core CRM flows against a live DB + API.
 * Usage: API must already be running, or this script starts one in-process.
 */
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

async function main() {
  const app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  const base = `http://127.0.0.1:${address.port}`;

  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`);
    const body = await res.json();
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
    return body;
  };

  const post = async (path: string, payload: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
    return body;
  };

  console.log("→ health");
  await get("/health");
  await get("/ready");

  console.log("→ catalogue");
  const categories = await get("/categories");
  if (!categories.data?.length) throw new Error("expected seeded categories");

  const services = await get("/services?pageSize=5");
  const florist = (
    await get("/services?q=floristry&pageSize=1")
  ).data[0];
  if (!florist) throw new Error("floristry service missing");

  const swansea = (
    await get("/locations?q=swansea&type=city&pageSize=1")
  ).data[0];
  if (!swansea) throw new Error("Swansea location missing");

  console.log("→ create supplier");
  const supplier = await post("/suppliers", {
    companyName: `Smoke Florist ${Date.now()}`,
    primaryCategoryId: florist.category_id,
    primaryServiceId: florist.id,
    serviceIds: [florist.id],
    locationId: swansea.id,
    town: "Swansea",
    county: "Swansea",
    website: `https://smoke-florist-${Date.now()}.example`,
    googleRating: 4.8,
    contacts: [
      { channel: "email", value: `hello+${Date.now()}@smoke.example`, isPrimary: true },
      { channel: "phone", value: `+44770090${String(Date.now()).slice(-4)}`, isPrimary: true },
    ],
    socials: [
      {
        platform: "instagram",
        url: `https://instagram.com/smoke${Date.now()}`,
      },
    ],
  });

  console.log("→ search suppliers");
  const search = await get(
    `/suppliers?service=floristry&town=swansea&hasEmail=true&q=${encodeURIComponent(supplier.company_name)}`,
  );
  if (!search.data.some((row: { id: string }) => row.id === supplier.id)) {
    throw new Error("created supplier not found in search");
  }

  console.log("→ verify supplier");
  await post(`/suppliers/${supplier.id}/verify`, { actor: "smoke" });

  console.log("→ campaign");
  const campaign = await post("/campaigns", {
    name: `Smoke Florists Swansea ${Date.now()}`,
    filterCriteria: {
      serviceSlugs: ["floristry"],
      town: "Swansea",
      hasEmail: true,
    },
    materialize: true,
  });
  if ((campaign.member_count ?? 0) < 1) {
    throw new Error("campaign materialization returned no members");
  }

  console.log("→ export csv");
  const exportJob = await post("/exports", {
    campaignId: campaign.id,
    name: "Smoke export",
    format: "csv",
  });
  if (exportJob.status !== "completed" || !exportJob.row_count) {
    throw new Error(`export failed: ${JSON.stringify(exportJob)}`);
  }

  console.log("→ admin overview");
  const overview = await get("/admin/overview");
  if (overview.total_services < 100) {
    throw new Error("unexpected overview totals");
  }

  console.log("✓ smoke passed");
  console.log(
    JSON.stringify(
      {
        supplierId: supplier.id,
        campaignId: campaign.id,
        exportId: exportJob.id,
        categories: categories.data.length,
        sampleServices: services.data.length,
      },
      null,
      2,
    ),
  );

  await app.close();
  await pool.end();
}

main().catch(async (error) => {
  console.error("✗ smoke failed", error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

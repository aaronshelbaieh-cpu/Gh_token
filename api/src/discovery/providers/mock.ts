import { createHash } from "node:crypto";
import type { SearchHit, SearchProvider, SearchProviderContext } from "../types.js";

/**
 * Deterministic offline provider for tests and dry runs.
 * Produces synthetic .example websites — never hits the public internet.
 */
export class MockSearchProvider implements SearchProvider {
  readonly name = "mock";

  async search(ctx: SearchProviderContext): Promise<SearchHit[]> {
    const slug = `${ctx.serviceSlug}-${slugify(ctx.locationName)}`;
    const base = `https://${slug}.example`;
    // SHA-derived unique mobiles so parallel locations never share phones/emails.
    const phoneA = phoneFromSlug(slug, 0);
    const phoneB = phoneFromSlug(slug, 1);

    const hits: SearchHit[] = [
      {
        companyName: `${ctx.locationName} ${ctx.serviceName} Co`,
        website: base,
        sourceUrl: `${base}/`,
        snippet: `Professional ${ctx.serviceName.toLowerCase()} in ${ctx.locationName}.`,
        email: `info@${slug}.example`,
        phone: phoneA,
        town: ctx.locationName,
        rating: 4.6,
      },
    ];

    if (ctx.limit > 1) {
      hits.push({
        companyName: `Premier ${ctx.serviceName} ${ctx.locationName}`,
        website: `https://premier-${slug}.example`,
        sourceUrl: `https://premier-${slug}.example/about`,
        snippet: `Award-winning ${ctx.serviceName.toLowerCase()}.`,
        email: `bookings@premier-${slug}.example`,
        phone: phoneB,
        town: ctx.locationName,
        rating: 4.9,
      });
    }

    return hits.slice(0, ctx.limit);
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function phoneFromSlug(slug: string, slot: number): string {
  const digest = createHash("sha256").update(`${slug}:${slot}`).digest();
  const n = digest.readUInt32BE(0) % 100_000_000;
  return `+4477${String(n).padStart(8, "0")}`;
}

/** Fixture HTML used by enrichment unit path in smoke tests. */
export function mockBusinessHtml(opts: {
  companyName: string;
  email: string;
  phone: string;
  website: string;
}): string {
  return `<!doctype html>
<html><head><title>${opts.companyName}</title></head>
<body>
  <h1>${opts.companyName}</h1>
  <p>Contact us at <a href="mailto:${opts.email}">${opts.email}</a>
  or call ${opts.phone}.</p>
  <a href="${opts.website}/contact">Contact</a>
  <a href="https://www.instagram.com/${opts.companyName.replace(/\s+/g, "").toLowerCase()}">Instagram</a>
  <a href="https://www.facebook.com/${opts.companyName.replace(/\s+/g, "").toLowerCase()}">Facebook</a>
</body></html>`;
}

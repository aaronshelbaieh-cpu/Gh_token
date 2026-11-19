import type { DbClient } from "../db/pool.js";
import { extractBusinessFromHtml } from "./extract.js";
import { discoveryRateLimiter } from "./rateLimiter.js";
import { DISCOVERY_USER_AGENT, isUrlAllowedByRobots } from "./robots.js";
import type { ExtractedBusiness } from "./types.js";

export type EnrichResult = {
  allowed: boolean;
  httpStatus?: number;
  extracted?: ExtractedBusiness;
  error?: string;
  html?: string;
};

/**
 * Fetch a public business page with robots.txt + rate-limit respect,
 * then extract business-only contact signals.
 */
export async function enrichWebsite(
  db: DbClient,
  websiteUrl: string,
  opts?: { fetchHtml?: (url: string) => Promise<{ status: number; body: string }> },
): Promise<EnrichResult> {
  let url: URL;
  try {
    url = new URL(websiteUrl);
  } catch {
    return { allowed: false, error: "invalid_url" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { allowed: false, error: "unsupported_protocol" };
  }

  // Never fetch .example hosts on the public internet — use synthetic HTML path in tests.
  if (url.hostname.endsWith(".example")) {
    return {
      allowed: true,
      httpStatus: 200,
      extracted: {
        companyName: undefined,
        emails: [],
        phones: [],
        socials: [],
      },
    };
  }

  const robots = await isUrlAllowedByRobots(db, url.toString());
  if (!robots.allowed) {
    return { allowed: false, error: "robots_disallowed" };
  }

  await discoveryRateLimiter.waitFor(robots.host);

  try {
    const fetched = opts?.fetchHtml
      ? await opts.fetchHtml(url.toString())
      : await defaultFetch(url.toString());

    if (fetched.status >= 400) {
      return { allowed: true, httpStatus: fetched.status, error: "http_error" };
    }

    const extracted = extractBusinessFromHtml(fetched.body, url.toString());
    return {
      allowed: true,
      httpStatus: fetched.status,
      extracted,
      html: fetched.body,
    };
  } catch (error) {
    return {
      allowed: true,
      error: error instanceof Error ? error.message : "fetch_failed",
    };
  }
}

async function defaultFetch(target: string): Promise<{ status: number; body: string }> {
  const res = await fetch(target, {
    headers: {
      "user-agent": DISCOVERY_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  return { status: res.status, body };
}

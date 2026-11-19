import type { DbClient } from "../db/pool.js";
import { discoveryRateLimiter } from "./rateLimiter.js";

const DEFAULT_UA = "GEDDiscoveryBot/0.3 (+https://ged.local/bot; business-data-only)";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type RobotsRules = {
  allow: string[];
  disallow: string[];
};

function parseRobots(text: string, userAgent: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  let active = false;
  let wild = false;
  const allow: string[] = [];
  const disallow: string[] = [];
  const wildAllow: string[] = [];
  const wildDisallow: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      const ua = value.toLowerCase();
      active = ua === "*" || userAgent.toLowerCase().includes(ua.replace("*", ""));
      wild = ua === "*";
      continue;
    }

    if (!active && !wild) continue;
    if (key === "disallow") {
      (wild && !active ? wildDisallow : disallow).push(value || "/");
    } else if (key === "allow") {
      (wild && !active ? wildAllow : allow).push(value);
    }
  }

  return {
    allow: allow.length ? allow : wildAllow,
    disallow: disallow.length ? disallow : wildDisallow,
  };
}

function pathAllowed(pathname: string, rules: RobotsRules): boolean {
  const path = pathname || "/";
  let bestAllow = -1;
  let bestDisallow = -1;

  for (const rule of rules.allow) {
    if (rule && path.startsWith(rule)) bestAllow = Math.max(bestAllow, rule.length);
  }
  for (const rule of rules.disallow) {
    if (rule === "") continue; // empty disallow = allow all
    if (path.startsWith(rule)) bestDisallow = Math.max(bestDisallow, rule.length);
  }

  if (bestDisallow < 0) return true;
  if (bestAllow > bestDisallow) return true;
  return false;
}

export async function isUrlAllowedByRobots(
  db: DbClient,
  targetUrl: string,
  userAgent = DEFAULT_UA,
): Promise<{ allowed: boolean; host: string }> {
  const url = new URL(targetUrl);
  const host = url.host.toLowerCase();

  const cached = await db.query<{
    robots_txt: string | null;
    expires_at: Date;
    fetch_status: number | null;
  }>(
    `SELECT robots_txt, expires_at, fetch_status FROM robots_cache WHERE host = $1`,
    [host],
  );

  let robotsTxt = cached.rows[0]?.robots_txt ?? null;
  const expired =
    !cached.rowCount || new Date(cached.rows[0].expires_at).getTime() < Date.now();

  if (expired) {
    await discoveryRateLimiter.waitFor(host);
    try {
      const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
      const res = await fetch(robotsUrl, {
        headers: { "user-agent": userAgent, accept: "text/plain,*/*" },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      robotsTxt = res.ok ? await res.text() : "";
      await db.query(
        `INSERT INTO robots_cache (host, robots_txt, fetched_at, expires_at, fetch_status)
         VALUES ($1, $2, now(), $3, $4)
         ON CONFLICT (host) DO UPDATE SET
           robots_txt = EXCLUDED.robots_txt,
           fetched_at = now(),
           expires_at = EXCLUDED.expires_at,
           fetch_status = EXCLUDED.fetch_status`,
        [host, robotsTxt, new Date(Date.now() + CACHE_TTL_MS), res.status],
      );
    } catch {
      // Fail closed for fetch errors on robots? Prefer fail-open with empty allow-all
      // after recording failure — common practice for public business pages.
      robotsTxt = "";
      await db.query(
        `INSERT INTO robots_cache (host, robots_txt, fetched_at, expires_at, fetch_status)
         VALUES ($1, $2, now(), $3, $4)
         ON CONFLICT (host) DO UPDATE SET
           robots_txt = EXCLUDED.robots_txt,
           fetched_at = now(),
           expires_at = EXCLUDED.expires_at,
           fetch_status = EXCLUDED.fetch_status`,
        [host, robotsTxt, new Date(Date.now() + CACHE_TTL_MS), 0],
      );
    }
  }

  if (!robotsTxt) {
    return { allowed: true, host };
  }

  const rules = parseRobots(robotsTxt, userAgent);
  return { allowed: pathAllowed(url.pathname, rules), host };
}

export const DISCOVERY_USER_AGENT = DEFAULT_UA;

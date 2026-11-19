import type { ExtractedBusiness } from "./types.js";
import { filterBusinessEmails, looksLikeBusinessPhone } from "./compliance.js";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:(?:\+|00)44[\s-]?(?:\d[\s-]?){9,10}|0(?:\d[\s-]?){9,10}|\+?\d[\d\s().-]{8,}\d)/g;

const SOCIAL_PATTERNS: Array<{
  platform: ExtractedBusiness["socials"][number]["platform"];
  re: RegExp;
}> = [
  { platform: "facebook", re: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.%-]+/gi },
  { platform: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.%-]+/gi },
  { platform: "linkedin", re: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.%-]+/gi },
  { platform: "twitter", re: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/gi },
  { platform: "tiktok", re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.%-]+/gi },
  { platform: "youtube", re: /https?:\/\/(?:www\.)?youtube\.com\/(?:c|channel|user|@)[A-Za-z0-9_/-]+/gi },
];

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m?.[1]) return undefined;
  return m[1].replace(/\s+/g, " ").trim().slice(0, 200) || undefined;
}

function extractContactPage(html: string, baseUrl: string): string | undefined {
  const hrefs = [...html.matchAll(/href=["']([^"']*contact[^"']*)["']/gi)];
  for (const match of hrefs) {
    try {
      return new URL(match[1], baseUrl).toString();
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

export function extractBusinessFromHtml(
  html: string,
  pageUrl: string,
): ExtractedBusiness {
  const text = stripTags(html);
  const host = (() => {
    try {
      return new URL(pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  const emails = filterBusinessEmails(text.match(EMAIL_RE) ?? [], host);

  const phones = [...new Set((text.match(PHONE_RE) ?? []).map((p) => p.trim()))].filter(
    looksLikeBusinessPhone,
  );

  const socials: ExtractedBusiness["socials"] = [];
  const seen = new Set<string>();
  for (const { platform, re } of SOCIAL_PATTERNS) {
    for (const match of html.matchAll(re)) {
      const url = match[0].replace(/[),.;]+$/, "");
      const key = `${platform}:${url.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      socials.push({ platform, url });
    }
  }

  return {
    companyName: extractTitle(html),
    emails,
    phones,
    socials,
    contactPage: extractContactPage(html, pageUrl),
  };
}

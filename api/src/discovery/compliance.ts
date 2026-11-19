/**
 * GDPR / PECR / business-contact-only guards for discovery ingestion.
 */

const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "gmx.co.uk",
  "mail.com",
  "yandex.com",
  "btinternet.com",
  "sky.com",
]);

const BUSINESS_LOCAL_PARTS = [
  "info",
  "hello",
  "contact",
  "enquiries",
  "enquiry",
  "bookings",
  "booking",
  "events",
  "weddings",
  "hire",
  "office",
  "admin",
  "sales",
  "studio",
  "team",
  "support",
];

/** Accept only likely business emails — never free-mail personal inboxes. */
export function isBusinessEmail(email: string, websiteHost?: string | null): boolean {
  const normalised = email.trim().toLowerCase();
  const at = normalised.lastIndexOf("@");
  if (at < 1) return false;

  const local = normalised.slice(0, at);
  const domain = normalised.slice(at + 1);

  if (!domain.includes(".") || local.includes(" ")) return false;
  if (CONSUMER_EMAIL_DOMAINS.has(domain)) return false;

  // Same registrable host as the business website is strongly business.
  if (websiteHost) {
    const host = websiteHost.replace(/^www\./, "").toLowerCase();
    if (domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`)) {
      return true;
    }
  }

  // Prefer role-based local parts on any non-consumer domain.
  if (BUSINESS_LOCAL_PARTS.some((p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}+`))) {
    return true;
  }

  // Corporate / org-style domains (not consumer free-mail) with a simple local part.
  return /^[a-z0-9._+-]+$/.test(local) && !/^\d+$/.test(local);
}

export function filterBusinessEmails(
  emails: string[],
  websiteHost?: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    const n = email.trim().toLowerCase();
    if (seen.has(n)) continue;
    if (!isBusinessEmail(n, websiteHost)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** UK-ish phone heuristic; keeps digits for storage normalisation elsewhere. */
export function looksLikeBusinessPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  // Reject obviously private short codes
  if (/^0{4,}/.test(digits)) return false;
  return true;
}

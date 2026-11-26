// shared/companyPaths.js — ⭐ A157 (45q, owner 11-09) · A COMPANY'S OWN ADDRESS, AND ITS JOBS UNDER IT.
//
// Owner 11-09: "companies should have their own page /whatever the company is" (answered: /<name>, not /companies/<name>)
// and "we can route jobs through this companies path, and use the job id to make them distinct" →
//     /<company>            the company's page            e.g. /stripe
//     /<company>/<id>       one of its postings (D128)     e.g. /stripe/48213 — the id keeps two same-titled jobs apart
// ONE rule, used by the server (sitemaps, JSON-LD, redirects) and the client (every link), so they can never disagree.
// ⛔ A company never takes one of draft's own words: a slug in RESERVED lives at /companies/<slug> instead (both forms
// resolve; the canonical one is what these functions return). Old addresses — /companies/<slug> and /jobs/<words>-<id> —
// answer with a 301 to the new ones.

const LEGAL = /\b(inc|llc|ltd|limited|corp|corporation|co|company|the|plc|gmbh|sa|ag|bv)\b\.?/g;

/** A company's slug from its name — lower-case, legal forms dropped, one hyphen between words (the records' own rule). */
export function companySlug(name) {
  return String(name || "").toLowerCase().replace(LEGAL, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Every first path segment draft uses or may use — routes in client/src/App.jsx, server.js and routes/, the public files,
 * and words kept back for later. test/a157CompanyPaths.test.js derives the routes in use and fails when one is missing.
 * ⭐ 47j w1-shell: + "learn" — the server renders /learn/data-engineering-roadmap (D193-5, server.js app.get(ROADMAP_PATH)),
 * a route the derivation could not see (its path is a constant), so /learn was read as a company's address.
 */
export const RESERVED = Object.freeze(new Set([
  "about", "account", "admin", "api", "app", "apply", "assets", "atlas", "ats-score", "audit", "auth", "blog", "careers",
  "companies", "company", "contact", "crawler", "dev", "docs", "draft", "edit", "email", "extension", "faq", "features", "health",
  "help", "home", "how-it-works", "in", "interview", "job", "jobs", "learn", "legal", "login", "logout", "me", "network", "new",
  "oauth", "p", "press", "pricing", "privacy", "products", "profile", "public", "register", "resume", "search", "security",
  "settings", "signup", "static", "status", "support", "survey", "team", "terms", "tools", "try", "user", "users", "www",
]));

export const isReserved = (slug) => RESERVED.has(String(slug || "").toLowerCase());

/** The company page's public path from a slug. */
export function companyPagePathFromSlug(slug) {
  const s = String(slug || "").toLowerCase();
  if (!s) return null;
  return isReserved(s) ? `/companies/${s}` : `/${s}`;
}

/** The company page's public path from a name. */
export function companyPagePath(name) { return companyPagePathFromSlug(companySlug(name)); }

/** One posting's public path: under its company, made distinct by the board id. */
export function jobPagePath(company, id) {
  const base = companyPagePath(company) || "/companies/unknown";
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? `${base}/${n}` : null;
}

/** The board id at the end of a posting path, new form (/<company>/<id>) or old (/jobs/<words>-<id>); null otherwise. */
export function boardIdFromPath(path) {
  const m = /(?:\/|-)(\d{1,12})\/?$/.exec(String(path || ""));
  const n = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

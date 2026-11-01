// services/jobs/publicJobPage.js — ⭐ D128 P1 · a PUBLIC, SERVER-RENDERED page per posting, so search engines can find it.
//
// P0 (43y) measured why no posting showed up anywhere: no public page, robots.txt closed /jobs, no posting in the
// sitemap, and every page the JavaScript shell. This module is the page: plain HTML a crawler reads without running
// the app, with Google's `JobPosting` JSON-LD while the posting is open.
//
// ⛔ WHAT GETS A PAGE: a classified, shown category only (D127 — a 'held' or not-yet-classified posting has none).
// ⛔ CLOSED (D107 / is_active = 0): the page says so, carries NO structured data, is `noindex`, and leaves the sitemap
//    the same day (search engines penalise expired jobs). A duplicate points at the posting it duplicates.
// ⛔ THE EMPLOYER'S WORDS STAY THEIRS (D32, D128 P4): credited, linked to the original, never reworded; draft's
//    reading is its own section. No model call (D17) — string handling over stored columns.
// ⛔ Nothing about any user: the page is the same for everyone, signed in or not.

import { mapJobRow } from "./mapJobRow.js";
import { levelOfRow } from "./levelRead.js";
import { livenessFor } from "./jobHistory.js";
import { salaryLabel, workstyleOf } from "../../shared/postingFacts.js";
import { formatPosting } from "../../shared/postingFormat.js";
import { sponsorshipSignal } from "../kb/sponsorshipSignal.js";

export const JOBS_SITEMAP_MAX = 50000;   // the sitemap protocol's per-file limit
const SLUG_PART_MAX = 60;
const ATLAS_LINKS_MAX = 8;
const SKILLS_SHOWN_MAX = 12;

/** The SQL that decides a posting may have a public page at all (open or closed). */
export const PUBLIC_CATEGORY_SQL = "board_category IS NOT NULL AND board_category <> 'held'";
/** …and the subset that is open — in the sitemap, with structured data. */
export const PUBLIC_OPEN_SQL = `is_active = 1 AND duplicate_of IS NULL AND ${PUBLIC_CATEGORY_SQL}`;

const kebab = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, SLUG_PART_MAX).replace(/-+$/g, "");

/** `/jobs/<company>-<title>-<id>` — the id is scraped_jobs.id, the words are only for people. */
export function jobPath(row) {
  const words = [kebab(row.company), kebab(row.title)].filter(Boolean).join("-");
  return `/jobs/${words ? `${words}-` : ""}${Number(row.id)}`;
}

/** The id at the end of a slug, or null. The words before it are not trusted (the canonical path is re-derived). */
export function idFromSlug(slug) {
  const m = /(?:^|-)(\d{1,12})$/.exec(String(slug || ""));
  const id = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * The posting behind a slug.
 * @returns {null | { kind: "redirect", path } | { kind: "page", row, open }}
 */
export function publicJobFor(db, slug) {
  const id = idFromSlug(slug);
  if (id == null) return null;
  let row = null;
  try { row = db.prepare(`SELECT * FROM scraped_jobs WHERE id = ? AND ${PUBLIC_CATEGORY_SQL}`).get(id); } catch { row = null; }
  if (!row) return null;
  if (row.duplicate_of != null) {
    let canon = null;
    try { canon = db.prepare(`SELECT id, company, title FROM scraped_jobs WHERE job_id = ? AND ${PUBLIC_CATEGORY_SQL}`).get(String(row.duplicate_of)); }
    catch { canon = null; }
    if (canon) return { kind: "redirect", path: jobPath(canon) };
  }
  const canonical = jobPath(row);
  if (`/jobs/${slug}` !== canonical) return { kind: "redirect", path: canonical };
  return { kind: "page", row, open: row.is_active === 1 && row.duplicate_of == null };
}

// ── the sitemap ────────────────────────────────────────────────────────────────────────────────────────────────────

const isoDay = (v) => {
  const t = epochOf(v);
  return t ? new Date(t * 1000).toISOString().slice(0, 10) : null;
};
function epochOf(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/** Open public postings only — a closed posting leaves the sitemap the moment it closes. */
export function jobsSitemapRoutes(db, { max = JOBS_SITEMAP_MAX } = {}) {
  let rows = [];
  try {
    rows = db.prepare(`SELECT id, company, title, COALESCE(updated_at, discovered_at) AS t FROM scraped_jobs
      WHERE ${PUBLIC_OPEN_SQL} ORDER BY id DESC LIMIT ?`).all(max);
  } catch { rows = []; }
  return rows.map(r => ({ path: jobPath(r), changefreq: "daily", priority: "0.7", ...(isoDay(r.t) ? { lastmod: isoDay(r.t) } : {}) }));
}

// ── JSON-LD (Google's JobPosting) ──────────────────────────────────────────────────────────────────────────────────

const EMPLOYMENT_TYPES = Object.freeze({
  full: "FULL_TIME", fulltime: "FULL_TIME", part: "PART_TIME", parttime: "PART_TIME", contract: "CONTRACTOR",
  contractor: "CONTRACTOR", temporary: "TEMPORARY", temp: "TEMPORARY", intern: "INTERN", internship: "INTERN",
});
function employmentTypeOf(raw) {
  const k = String(raw || "").toLowerCase().replace(/[^a-z]/g, "");
  for (const [w, v] of Object.entries(EMPLOYMENT_TYPES)) if (k.startsWith(w)) return v;
  return null;
}

const US_STATE_RE = /^[A-Z]{2}$/;
/** "Boston, MA" / "Austin, TX, United States" → a PostalAddress; anything else → the locality as written. */
function addressOf(location) {
  const parts = String(location || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const region = parts.find((p, i) => i > 0 && US_STATE_RE.test(p));
  return { "@type": "PostalAddress", addressLocality: parts[0], ...(region ? { addressRegion: region } : {}), addressCountry: "US" };
}

const UNIT = Object.freeze({ hourly: "HOUR", monthly: "MONTH", weekly: "WEEK", daily: "DAY" });

function descriptionHtml(text) {
  return formatPosting(text).map(b => b.type === "h" ? `<h3>${esc(b.text.replace(/:\s*$/, ""))}</h3>`
    : b.type === "ul" ? `<ul>${b.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`
    : `<p>${esc(b.text).replace(/\n/g, "<br>")}</p>`).join("\n");
}

/** Google's JobPosting for an OPEN posting. Only stated facts — a field draft does not know is left out, never guessed. */
export function jobPostingJsonLd(row, { base }) {
  const job = mapJobRow(row);
  const posted = epochOf(job.postedAt) ?? epochOf(row.discovered_at);
  const valid = epochOf(row.valid_through);
  const remote = workstyleOf(job) === "Remote";
  const address = addressOf(job.location);
  const lo = Number(job.salaryMin), hi = Number(job.salaryMax);
  const hasPay = (Number.isFinite(lo) && lo > 0) || (Number.isFinite(hi) && hi > 0);
  const out = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: descriptionHtml(job.description) || esc(job.title),
    identifier: { "@type": "PropertyValue", name: job.company, value: String(row.job_id) },
    ...(posted ? { datePosted: new Date(posted * 1000).toISOString().slice(0, 10) } : {}),
    ...(valid ? { validThrough: new Date(valid * 1000).toISOString() } : {}),
    ...(employmentTypeOf(row.employment_type) ? { employmentType: employmentTypeOf(row.employment_type) } : {}),
    hiringOrganization: { "@type": "Organization", name: job.company, ...(job.companyIconUrl && /^https:\/\//.test(job.companyIconUrl) ? { logo: job.companyIconUrl } : {}) },
    ...(address && !remote ? { jobLocation: { "@type": "Place", address } } : {}),
    ...(remote ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "USA" },
      ...(address ? { jobLocation: { "@type": "Place", address } } : {}) } : {}),
    ...(hasPay ? { baseSalary: { "@type": "MonetaryAmount", currency: job.salaryCurrency || "USD", value: {
      "@type": "QuantitativeValue", unitText: UNIT[job.salaryPeriod] || "YEAR",
      ...(Number.isFinite(lo) && lo > 0 ? { minValue: lo } : {}), ...(Number.isFinite(hi) && hi > 0 ? { maxValue: hi } : {}) } } } : {}),
    url: `${base}${jobPath(row)}`,
    directApply: false,
  };
  return out;
}

/** JSON inside <script>: `<` escaped so the employer's text can never close the tag. */
export const jsonLdScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

// ── the page ───────────────────────────────────────────────────────────────────────────────────────────────────────

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
const safeHref = (u) => (/^https?:\/\//i.test(String(u || "")) ? String(u) : null);
const LEVEL_WORDS = Object.freeze({ entry: "Entry level", early: "Early career", mid: "Mid level", senior: "Senior" });

/** Published Atlas pages for the posting's skills (exact term match, case-insensitive). */
function atlasLinksFor(db, skills) {
  const terms = [...new Set(skills.map(s => String(s).trim().toLowerCase()).filter(Boolean))].slice(0, 40);
  if (!terms.length) return [];
  try {
    return db.prepare(`SELECT slug, name FROM atlas_nodes WHERE status = 'published' AND (lower(term) IN (${terms.map(() => "?").join(",")})
      OR lower(name) IN (${terms.map(() => "?").join(",")})) ORDER BY name LIMIT ?`).all(...terms, ...terms, ATLAS_LINKS_MAX);
  } catch { return []; }
}

const STYLE = `
:root{--bg:#f7f5f0;--card:#fffdf8;--ink:#1d1b18;--muted:#6b665d;--line:#e2ddd2;--accent:#2f5d50;--accent-ink:#fff;--warn:#8a4b14;--warn-bg:#fbf0e3}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1d1c1a;--ink:#ece8df;--muted:#a39e93;--line:#34322e;--accent:#7fb8a6;--accent-ink:#10201b;--warn:#f0b37a;--warn-bg:#2b2117}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:min(760px,100%);margin:0 auto;padding:20px 16px 64px}
header.site{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:24px}
header.site a.brand{color:var(--ink);font-weight:800;font-size:22px;text-decoration:none;letter-spacing:-.02em}
a{color:var(--accent);overflow-wrap:anywhere}
h1{font-size:clamp(26px,5vw,38px);line-height:1.2;margin:0 0 8px;overflow-wrap:anywhere}
.facts{color:var(--muted);margin:0 0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:16px 18px;margin:16px 0}
.card h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:0 0 10px}
.mark{display:inline-block;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:6px;padding:1px 8px;margin:0 6px 6px 0;font-size:14px}
.cta{display:inline-block;background:var(--accent);color:var(--accent-ink);border-radius:6px;padding:10px 18px;font-weight:700;text-decoration:none}
.closed{background:var(--warn-bg);color:var(--warn);border-color:var(--warn)}
.small{font-size:13px;color:var(--muted)}
.posting h3{font-size:17px;margin:20px 0 6px}
`;

/** No such public posting (or a held one): a real 404, never the app shell's 200 — a crawler reads that as a soft 404. */
export function renderMissingJobPage() {
  return { status: 404, html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Posting not found | draft</title><meta name="robots" content="noindex"><style>${STYLE}</style></head>
<body><div class="wrap"><header class="site"><a class="brand" href="/" aria-label="draft — home">/draft</a><a href="/login">Sign in</a></header>
<main><h1>This posting isn't here</h1><p>It may have been removed. <a href="/try">See how draft finds, tailors and applies</a>.</p></main></div></body></html>` };
}

/**
 * The page.
 * @returns {{ status: number, html: string }}
 */
export function renderPublicJobPage(db, row, { base, open, now = Math.floor(Date.now() / 1000), ctaHref = "/try" }) {
  const job = mapJobRow(row);
  const canonical = `${base}${jobPath(row)}`;
  const original = safeHref(job.url) || safeHref(job.applyUrl);
  const level = levelOfRow(row);
  let live = null;
  try { live = open ? livenessFor(db, row.job_id, { now }) : null; } catch { live = null; }
  let sponsor = null;
  try { sponsor = sponsorshipSignal(db, row.company, { title: row.title, posting: row }); } catch { sponsor = null; }
  const skills = (job.skills || []).slice(0, SKILLS_SHOWN_MAX);
  const atlas = atlasLinksFor(db, job.skills || []);
  const salary = salaryLabel(job);
  const facts = [job.company, workstyleOf(job), job.location, salary].filter(Boolean);
  const titleText = `${job.title} at ${job.company}${job.location ? ` — ${job.location}` : ""}`;
  const metaDesc = `${job.title} at ${job.company}${job.location ? ` in ${job.location}` : ""}${salary ? `, ${salary}` : ""}. The posting, draft's reading of it, and a tailored résumé for it.`;

  const reading = [
    level?.read && LEVEL_WORDS[level.read] ? `<p><strong>${esc(LEVEL_WORDS[level.read])}</strong>${level.years != null ? ` · asks for ${esc(level.years)}+ years` : ""}${level.disagreement?.text ? ` · ${esc(level.disagreement.text)}` : ""}</p>` : "",
    live?.label ? `<p>${esc(live.label)}</p>` : "",
    skills.length ? `<p>${skills.map(s => `<span class="mark">${esc(s)}</span>`).join("")}</p>` : "",
    sponsor && sponsor.level !== "unknown" ? `<p><strong>Visa sponsorship:</strong> ${esc(sponsor.line)}<br><span class="small">${esc(sponsor.notice || "")}</span></p>` : "",
  ].filter(Boolean).join("\n");

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titleText)} | draft</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${esc(canonical)}">
${open ? "" : `<meta name="robots" content="noindex">`}
<meta property="og:title" content="${esc(titleText)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website">
<style>${STYLE}</style>
${open ? jsonLdScript(jobPostingJsonLd(row, { base })) : ""}
</head><body><div class="wrap">
<header class="site"><a class="brand" href="/" aria-label="draft — home">/draft</a><a href="/login">Sign in</a></header>
<main>
${open ? "" : `<div class="card closed" role="status"><strong>This posting has closed.</strong> ${esc(job.company)} is no longer taking applications for it.</div>`}
<h1>${esc(job.title)}</h1>
<p class="facts">${facts.map(esc).join(" · ")}</p>
<p class="small">Posted by ${esc(job.company)} on their careers site${original ? ` · <a href="${esc(original)}" rel="noopener nofollow">View the original posting</a>` : ""}</p>
${open ? `<p><a class="cta" href="${esc(ctaHref)}">Draft this job</a> <span class="small">a résumé tailored to it, and the application filled in</span></p>` : ""}
${reading ? `<section class="card"><h2>draft's reading</h2>\n${reading}\n</section>` : ""}
${atlas.length ? `<section class="card"><h2>In the Atlas</h2><p>${atlas.map(a => `<a class="mark" href="/atlas/${encodeURIComponent(a.slug)}">${esc(a.name)}</a>`).join("")}</p></section>` : ""}
<section class="card posting"><h2>The posting, as ${esc(job.company)} wrote it</h2>
${descriptionHtml(job.description) || `<p class="small">The posting's text could not be read — see the original.</p>`}
</section>
</main></div></body></html>`;
  return { status: 200, html };
}

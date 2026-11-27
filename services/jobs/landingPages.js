// services/jobs/landingPages.js — ⭐ D179 P7 (45l) · LANDING PAGES FOR SEARCH ENGINES, server-rendered.
//
// D179 (7): "landing pages per category, subcategory and location ('Backend engineer jobs in Boston', 'Construction
// project manager jobs'), and per technology where there are enough real jobs (no thin pages: a minimum count, or no
// page)". This first set: one page per ROLE (a taxonomy subcategory) — /jobs/role/<id> — and per TECHNOLOGY —
// /jobs/tech/<name> — each the newest open postings (D128's PUBLIC_OPEN_SQL: never held, closed or duplicate), a real 404
// under MIN_JOBS (a crawler reads a thin page's 200 as a soft 404), an ItemList JSON-LD, canonical, the sitemap
// (/sitemap-landing.xml, in the jobs sitemap index). The page's links go to the postings' own pages (D128) and to /jobs
// with the same filter, where the rest is browsable.
import { PUBLIC_OPEN_SQL, jobPath, esc, STYLE, PLATE_HEAD, plateNav, plateFooter } from "./publicJobPage.js";
import { offTheMapPage, OTHER_ROADS } from "../publicChrome.js";   // ⭐ 47m (D197 #22): the thin page's 404 is Off the map
import { ogUrl, ogImageMeta } from "../ogImage.js";
import { taxonomy } from "./taxonomyClassify.js";
import { TECHNOLOGIES } from "../../shared/techVocabulary.js";
import { PLACES } from "../../shared/jobTagVocabulary.js";
import { signalSql, NOT_LEGAL_ADVICE } from "../kb/sponsorshipSignal.js";

// ⭐ D179 P7 · a role IN A METRO ("Backend jobs in Boston"): /jobs/role/<id>/in/<metro> — the metro as the place tags store
// it (job_tag_places.metro: boston, sf_bay_area …), its words from the place vocabulary ("the Bay Area").
const METRO = new Map(PLACES.options.filter(o => String(o.value).startsWith("metro:")).map(o => [String(o.value).slice(6), o.label]));
export const metroSlug = (m) => String(m || "").replace(/_/g, "-");
const metroOf = (slug) => { const m = String(slug || "").toLowerCase().replace(/-/g, "_"); return METRO.has(m) ? { id: m, label: METRO.get(m) } : null; };

export const MIN_JOBS = 10;
export const SHOWN = 40;
const OPEN = PUBLIC_OPEN_SQL.replace(/\b(is_active|duplicate_of|board_category)\b/g, "sj.$1");
export const techSlug = (name) => String(name || "").toLowerCase().replace(/\+/g, "plus").replace(/#/g, "sharp").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const TECH_BY_SLUG = new Map(TECHNOLOGIES.map(([name]) => [techSlug(name), name]));

function roleOf(id) {
  let tax = null; try { tax = taxonomy(); } catch { return null; }
  for (const c of tax.categories) {
    if (c.held) continue;
    const s = c.subs.find(x => x.id === id && !x.general);
    if (s) return { id: s.id, name: s.name, category: c.name, categoryId: c.id };
  }
  return null;
}

/** The landing page's rows and total for a role or a technology, or null when unknown. */
export function landingData(db, kind, key) {
  if (kind === "role") {
    const role = roleOf(String(key || "").toLowerCase());
    if (!role) return null;
    const where = `FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id WHERE ${OPEN} AND jt.subcategory = ?`;
    const total = db.prepare(`SELECT COUNT(*) ${where}`).pluck().get(role.id);
    const rows = db.prepare(`SELECT sj.id, sj.title, sj.company, sj.location, sj.posted_at ${where} ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT ?`).all(role.id, SHOWN);
    return { kind, title: `${role.name} jobs`, heading: `${role.name} jobs`, lead: `${role.category} · ${role.name}`, total, rows,
      path: `/jobs/role/${role.id}`, boardHref: `/jobs?category=${encodeURIComponent(role.categoryId)}&subcategory=${encodeURIComponent(role.id)}` };
  }
  if (kind === "role-metro") {
    const role = roleOf(String(key?.role || "").toLowerCase());
    const metro = metroOf(key?.metro);
    if (!role || !metro) return null;
    const where = `FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id
      WHERE ${OPEN} AND jt.subcategory = ? AND EXISTS (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND p.metro = ?)`;
    const total = db.prepare(`SELECT COUNT(*) ${where}`).pluck().get(role.id, metro.id);
    const rows = db.prepare(`SELECT sj.id, sj.title, sj.company, sj.location, sj.posted_at ${where} ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT ?`).all(role.id, metro.id, SHOWN);
    const place = /^the /.test(metro.label) ? metro.label : metro.label;
    return { kind, title: `${role.name} jobs in ${place}`, heading: `${role.name} jobs in ${place}`, lead: `${role.category} · ${role.name} · ${place}`, total, rows,
      path: `/jobs/role/${role.id}/in/${metroSlug(metro.id)}`,
      boardHref: `/jobs?category=${encodeURIComponent(role.categoryId)}&subcategory=${encodeURIComponent(role.id)}&places=${encodeURIComponent(`metro:${metro.id}`)}` };
  }
  // ⭐ D185-6 (45q, owner 11-09 — the beachhead: international / visa-dependent job seekers) · "<role> jobs at companies that
  // sponsor H-1B" and "… in <city>": the same open postings, only at employers with certified H-1B filings (D121's ONE
  // signal, signalSql().filed — the board's own sponsorship filter), each page carrying the employers' DOL filing history.
  // The same minimum real-job count as every landing page (MIN_JOBS — a real 404 below it).
  if (kind === "sponsor" || kind === "sponsor-metro") {
    const role = roleOf(String(key?.role || "").toLowerCase());
    const metro = kind === "sponsor-metro" ? metroOf(key?.metro) : null;
    if (!role || (kind === "sponsor-metro" && !metro)) return null;
    const filed = signalSql("sj").filed;
    const where = `FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id
      WHERE ${OPEN} AND jt.subcategory = ? AND ${filed}${metro ? " AND EXISTS (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND p.metro = ?)" : ""}`;
    const args = metro ? [role.id, metro.id] : [role.id];
    const total = db.prepare(`SELECT COUNT(*) ${where}`).pluck().get(...args);
    const rows = db.prepare(`SELECT sj.id, sj.title, sj.company, sj.location, sj.posted_at ${where} ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT ?`).all(...args, SHOWN);
    // The employers on the page, with their filing history (certified LCAs, the latest period on file) — DOL's own data.
    const history = db.prepare(`SELECT sj.company AS company, COUNT(*) AS open, cl.certified_total AS certified, cl.latest_period AS latest
        ${where.replace("FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id", "FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id JOIN company_lca_sponsorship cl ON cl.company = sj.company")}
        GROUP BY sj.company ORDER BY open DESC, certified DESC LIMIT 12`).all(...args);
    const place = metro ? ` in ${metro.label}` : "";
    const sentence = `${role.name} jobs at companies that sponsor H-1B${place}`;
    return { kind, title: sentence, heading: sentence, lead: `${role.category} · ${role.name}${place} · employers with certified H-1B filings`,
      total, rows, history, sponsor: true,
      path: metro ? `/jobs/sponsor-h1b/${role.id}/in/${metroSlug(metro.id)}` : `/jobs/sponsor-h1b/${role.id}`,
      boardHref: `/jobs?category=${encodeURIComponent(role.categoryId)}&subcategory=${encodeURIComponent(role.id)}&company_sponsorship=filed${metro ? `&places=${encodeURIComponent(`metro:${metro.id}`)}` : ""}` };
  }
  if (kind === "tech") {
    const name = TECH_BY_SLUG.get(String(key || "").toLowerCase());
    if (!name) return null;
    const where = `FROM scraped_jobs sj JOIN job_tech jk ON jk.job_id = sj.job_id WHERE ${OPEN} AND jk.tech = ?`;
    const total = db.prepare(`SELECT COUNT(*) ${where}`).pluck().get(name);
    const rows = db.prepare(`SELECT sj.id, sj.title, sj.company, sj.location, sj.posted_at ${where} ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT ?`).all(name, SHOWN);
    return { kind, title: `Jobs using ${name}`, heading: `Jobs using ${name}`, lead: `Open roles whose own postings name ${name}`, total, rows,
      path: `/jobs/tech/${techSlug(name)}`, boardHref: `/jobs?tech=${encodeURIComponent(name)}` };
  }
  return null;
}

/** { status, html } — a real 404 for an unknown or thin page. */
export function renderLandingPage(db, kind, key, { base }) {
  let d = null; try { d = landingData(db, kind, key); } catch { d = null; }
  if (!d || d.total < MIN_JOBS) {
    // a real 404 + noindex (D179 (7): no thin pages), drawn as Off the map with its one way back
    return offTheMapPage({ status: 404, docTitle: "Not enough jobs here yet", kicker: ["404", "GAZETTEER", "NOT ENOUGH OPEN JOBS"], title: "Not enough open jobs here yet",
      lead: "This corner of the market has too few openings for a page of its own.",
      back: { title: "Browse every open job", go: "Open jobs →", href: "/jobs" }, roads: [OTHER_ROADS[1]] });
  }
  const canonical = `${base}${d.path}`;
  const desc = `${d.total.toLocaleString("en-US")} open ${d.title.toLowerCase()} — the newest first, each linked to its employer's posting. Draft tailors your résumé to each.`;
  const itemList = { "@context": "https://schema.org", "@type": "ItemList", name: d.title, numberOfItems: d.rows.length,
    itemListElement: d.rows.map((r, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}${jobPath(r)}`, name: `${r.title} at ${r.company}` })) };
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.title)} — ${esc(d.total.toLocaleString("en-US"))} open | draft</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(d.title)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website">
${ogImageMeta(ogUrl(new URL(canonical).origin, { eyebrow: "Jobs", title: d.title, line: `${d.total.toLocaleString("en-US")} open · the newest first` }), d.title)}
${PLATE_HEAD}<style>${STYLE}</style>
<script type="application/ld+json">${JSON.stringify(itemList).replace(/</g, "\\u003c")}</script>
</head><body>${plateNav()}<div class="wrap">
<main data-gazetteer-sheet="">
<p class="kicker">Gazetteer · ${esc(d.title)}</p>
<h1>${esc(d.heading)}</h1>
<p class="facts">${esc(d.total.toLocaleString("en-US"))} open · ${esc(d.lead)}</p>
<p><a class="cta" href="${esc(d.boardHref)}">Browse and filter all ${esc(d.total.toLocaleString("en-US"))}</a></p>
<section class="card"><h2>The newest</h2>
<ul>${d.rows.map(r => `<li><a href="${esc(jobPath(r))}">${esc(r.title)}</a> <span class="small">· ${esc(r.company)}${r.location ? ` · ${esc(r.location)}` : ""}</span></li>`).join("\n")}</ul>
</section>${d.sponsor ? sponsorHistoryHtml(d.history) : ""}
</main></div>${plateFooter()}</body></html>`;
  return { status: 200, html };
}

/** D185-6: the employers' filing history, from the U.S. Department of Labor's LCA disclosure data — and what it is not. */
function sponsorHistoryHtml(history = []) {
  if (!history.length) return "";
  return `
<section class="card"><h2>Their H-1B filing history</h2>
<ul>${history.map(h => `<li>${esc(h.company)} <span class="small">· ${esc(Number(h.certified || 0).toLocaleString("en-US"))} certified H-1B filings${h.latest ? ` · latest ${esc(h.latest)}` : ""} · ${esc(String(h.open))} open here</span></li>`).join("\n")}</ul>
<p class="small">From the U.S. Department of Labor's public LCA disclosure data. A filing record is history, not a promise that a role is sponsored. ${esc(NOT_LEGAL_ADVICE)}</p>
</section>`;
}

/** The landing pages that pass MIN_JOBS — for /sitemap-landing.xml. One grouped read per kind. */
export function landingSitemapRoutes(db) {
  const out = [];
  try {
    for (const r of db.prepare(`SELECT jt.subcategory AS id, COUNT(*) AS n FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id
        WHERE ${OPEN} AND jt.subcategory IS NOT NULL GROUP BY jt.subcategory HAVING n >= ?`).all(MIN_JOBS)) {
      if (roleOf(r.id)) out.push({ path: `/jobs/role/${r.id}`, changefreq: "daily", priority: "0.8" });
    }
  } catch { /* no taxonomy yet */ }
  try {
    for (const r of db.prepare(`SELECT jk.tech AS t, COUNT(*) AS n FROM scraped_jobs sj JOIN job_tech jk ON jk.job_id = sj.job_id
        WHERE ${OPEN} GROUP BY jk.tech HAVING n >= ?`).all(MIN_JOBS)) {
      out.push({ path: `/jobs/tech/${techSlug(r.t)}`, changefreq: "daily", priority: "0.7" });
    }
  } catch { /* no extraction yet */ }
  try {
    for (const r of db.prepare(`SELECT jt.subcategory AS id, p.metro AS m, COUNT(DISTINCT sj.job_id) AS n FROM scraped_jobs sj
        JOIN job_taxonomy jt ON jt.job_id = sj.job_id JOIN job_tag_places p ON p.job_id = sj.job_id
        WHERE ${OPEN} AND jt.subcategory IS NOT NULL AND p.metro IS NOT NULL GROUP BY jt.subcategory, p.metro HAVING n >= ?`).all(MIN_JOBS)) {
      if (roleOf(r.id) && METRO.has(r.m)) out.push({ path: `/jobs/role/${r.id}/in/${metroSlug(r.m)}`, changefreq: "daily", priority: "0.7" });
    }
  } catch { /* no place tags */ }
  // ⭐ D185-6: the sponsorship pages that pass MIN_JOBS — by role, and by role in a metro.
  const filed = signalSql("sj").filed;
  try {
    for (const r of db.prepare(`SELECT jt.subcategory AS id, COUNT(*) AS n FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id
        WHERE ${OPEN} AND jt.subcategory IS NOT NULL AND ${filed} GROUP BY jt.subcategory HAVING n >= ?`).all(MIN_JOBS)) {
      if (roleOf(r.id)) out.push({ path: `/jobs/sponsor-h1b/${r.id}`, changefreq: "daily", priority: "0.8" });
    }
  } catch { /* no sponsorship records */ }
  try {
    for (const r of db.prepare(`SELECT jt.subcategory AS id, p.metro AS m, COUNT(DISTINCT sj.job_id) AS n FROM scraped_jobs sj
        JOIN job_taxonomy jt ON jt.job_id = sj.job_id JOIN job_tag_places p ON p.job_id = sj.job_id
        WHERE ${OPEN} AND jt.subcategory IS NOT NULL AND p.metro IS NOT NULL AND ${filed} GROUP BY jt.subcategory, p.metro HAVING n >= ?`).all(MIN_JOBS)) {
      if (roleOf(r.id) && METRO.has(r.m)) out.push({ path: `/jobs/sponsor-h1b/${r.id}/in/${metroSlug(r.m)}`, changefreq: "daily", priority: "0.7" });
    }
  } catch { /* no place tags or records */ }
  return out;
}

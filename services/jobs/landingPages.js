// services/jobs/landingPages.js — ⭐ D179 P7 (45l) · LANDING PAGES FOR SEARCH ENGINES, server-rendered.
//
// D179 (7): "landing pages per category, subcategory and location ('Backend engineer jobs in Boston', 'Construction
// project manager jobs'), and per technology where there are enough real jobs (no thin pages: a minimum count, or no
// page)". This first set: one page per ROLE (a taxonomy subcategory) — /jobs/role/<id> — and per TECHNOLOGY —
// /jobs/tech/<name> — each the newest open postings (D128's PUBLIC_OPEN_SQL: never held, closed or duplicate), a real 404
// under MIN_JOBS (a crawler reads a thin page's 200 as a soft 404), an ItemList JSON-LD, canonical, the sitemap
// (/sitemap-landing.xml, in the jobs sitemap index). The page's links go to the postings' own pages (D128) and to /jobs
// with the same filter, where the rest is browsable.
import { PUBLIC_OPEN_SQL, jobPath, esc, STYLE } from "./publicJobPage.js";
import { taxonomy } from "./taxonomyClassify.js";
import { TECHNOLOGIES } from "../../shared/techVocabulary.js";

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
    return { status: 404, html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not enough jobs here yet | draft</title><meta name="robots" content="noindex"><style>${STYLE}</style></head><body><div class="wrap"><header class="site"><a class="brand" href="/">/draft</a><a href="/login">Sign in</a></header><main><h1>Not enough open jobs here yet.</h1><p><a href="/jobs">Browse every open job</a></p></main></div></body></html>` };
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
<style>${STYLE}</style>
<script type="application/ld+json">${JSON.stringify(itemList).replace(/</g, "\\u003c")}</script>
</head><body><div class="wrap">
<header class="site"><a class="brand" href="/" aria-label="draft — home">/draft</a><a href="/login">Sign in</a></header>
<main>
<h1>${esc(d.heading)}</h1>
<p class="facts">${esc(d.total.toLocaleString("en-US"))} open · ${esc(d.lead)}</p>
<p><a class="cta" href="${esc(d.boardHref)}">Browse and filter all ${esc(d.total.toLocaleString("en-US"))}</a></p>
<section class="card"><h2>The newest</h2>
<ul>${d.rows.map(r => `<li><a href="${esc(jobPath(r))}">${esc(r.title)}</a> <span class="small">· ${esc(r.company)}${r.location ? ` · ${esc(r.location)}` : ""}</span></li>`).join("\n")}</ul>
</section>
</main></div></body></html>`;
  return { status: 200, html };
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
  return out;
}

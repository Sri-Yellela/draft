// services/companies/publicCompany.js — ⭐ D179 P4b + the search dropdown (45l, 11-08).
//
// publicCompany — a page for every distinct company (owner 11-07: "a company page and description for every distinct
// company"; the FIRST version of the sketch, opened inside the shell). Its data, all from our own records — nothing about
// any user, nothing copied from a site whose terms forbid it (D78):
//   header (name, own site, the ATS it uses + the careers link from its board alias) · open jobs by Category ›
//   Subcategory with counts · locations · hiring trend (postings first seen per month, 6 months, our own crawl) · Tech
//   stack with evidence (D179 P5a stackFor: ≥ 2 postings, 180 days) · visa sponsorship history (the DOL LCA / USCIS
//   facts the posting panel already shows — sponsorshipFacts; owner 11-07 (b): yes; "not a promise to sponsor you") ·
//   the newest open jobs. *About in draft's words* (Wikidata facts) is NOT built yet — the page says only what we hold.
// publicSuggest — the ONE search box's dropdown (owner 11-07 override (2): no Companies tab — "a search return as
// suggestions as a dropdown"): grouped Companies (with open jobs) · Roles (the taxonomy's subcategories) · Technologies
// (shared/techVocabulary.js) · Titles (the open board's own, by frequency). Signed out it works the same.
import { stackFor } from "./companyTech.js";
import { sponsorshipFactFor } from "../kb/sponsorshipFacts.js";
import { PUBLIC_OPEN_SQL, jobPath } from "../jobs/publicJobPage.js";
import { taxonomy } from "../jobs/taxonomyClassify.js";
import { TECHNOLOGIES } from "../../shared/techVocabulary.js";
import { canonicalTitle } from "../jobs/searchSuggestions.js";

const OPEN = PUBLIC_OPEN_SQL.replace(/\b(is_active|duplicate_of|board_category)\b/g, "sj.$1");
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,120}$/;
const PAGE_TTL_MS = 5 * 60_000, TITLES_TTL_MS = 30 * 60_000;
const SEC = (col) => `(CASE WHEN ${col} > 100000000000 THEN ${col} / 1000 ELSE ${col} END)`;
const ATS_BOARD = {
  greenhouse: (t) => `https://boards.greenhouse.io/${t}`, lever: (t) => `https://jobs.lever.co/${t}`,
  ashby: (t) => `https://jobs.ashbyhq.com/${t}`, workday: null, smartrecruiters: (t) => `https://jobs.smartrecruiters.com/${t}`,
  workable: (t) => `https://apply.workable.com/${t}`, recruitee: (t) => `https://${t}.recruitee.com`, bamboohr: (t) => `https://${t}.bamboohr.com/careers`,
  icims: null, jobvite: (t) => `https://jobs.jobvite.com/${t}`,
};
const ATS_NAME = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workday: "Workday", smartrecruiters: "SmartRecruiters",
  workable: "Workable", recruitee: "Recruitee", bamboohr: "BambooHR", icims: "iCIMS", jobvite: "Jobvite" };

const pageCache = new Map();

/** The company page's data, or null when no such company. */
export function publicCompany(db, slug, { now = Date.now() } = {}) {
  const s = String(slug || "").toLowerCase();
  if (!SLUG_RE.test(s)) return null;
  const hit = pageCache.get(s);
  if (hit && now - hit.at < PAGE_TTL_MS) return hit.value;
  // The board links by the normalised name (client lib/companySlug.js); a slug that took a "-2" is found by its name alias.
  const co = db.prepare(`SELECT id, slug, name, domain, parent_id FROM companies WHERE slug = ?`).get(s)
    || db.prepare(`SELECT c.id, c.slug, c.name, c.domain, c.parent_id FROM company_aliases a JOIN companies c ON c.id = a.company_id
         WHERE a.alias_key = ?`).get(`name:${s}`);
  if (!co) return null;
  const parent = co.parent_id ? db.prepare(`SELECT slug, name FROM companies WHERE id = ?`).get(co.parent_id) : null;
  const subsidiaries = db.prepare(`SELECT slug, name FROM companies WHERE parent_id = ? ORDER BY name LIMIT 20`).all(co.id);
  const ats = db.prepare(`SELECT alias_key FROM company_aliases WHERE company_id = ? AND alias_key LIKE 'ats:%' ORDER BY created_at LIMIT 1`).pluck().get(co.id);
  const [, provider = null, tenant = null] = ats ? ats.split(":") : [];
  const careers = provider && tenant && ATS_BOARD[provider] ? ATS_BOARD[provider](tenant) : (co.domain ? `https://${co.domain}` : null);

  const open = db.prepare(`SELECT jt.category, jt.subcategory, COUNT(*) AS n FROM job_company jc
      JOIN scraped_jobs sj ON sj.job_id = jc.job_id LEFT JOIN job_taxonomy jt ON jt.job_id = sj.job_id
      WHERE jc.company_id = ? AND ${OPEN} GROUP BY jt.category, jt.subcategory`).all(co.id);
  let tax = null; try { tax = taxonomy(); } catch { tax = null; }
  const byCat = new Map(); let openJobs = 0;
  for (const r of open) {
    openJobs += r.n;
    const cid = r.category && !tax?.byId.get(r.category)?.held ? r.category : null;
    const k = cid || "(other)";
    const c = byCat.get(k) || { id: cid, name: cid ? tax?.byId.get(cid)?.name || cid : "Other", count: 0, subcategories: [] };
    c.count += r.n;
    if (cid && r.subcategory) c.subcategories.push({ id: r.subcategory, name: tax?.byId.get(cid)?.subs.find(x => x.id === r.subcategory)?.name || r.subcategory, count: r.n });
    byCat.set(k, c);
  }
  const locations = db.prepare(`SELECT sj.location, COUNT(*) AS n FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id
      WHERE jc.company_id = ? AND ${OPEN} AND TRIM(COALESCE(sj.location, '')) <> '' GROUP BY sj.location ORDER BY n DESC LIMIT 8`).all(co.id);
  const nowSec = Math.floor(now / 1000), since = nowSec - 183 * 86400;
  const trendRows = db.prepare(`SELECT strftime('%Y-%m', ${SEC("sj.discovered_at")}, 'unixepoch') AS month, COUNT(*) AS n FROM job_company jc
      JOIN scraped_jobs sj ON sj.job_id = jc.job_id WHERE jc.company_id = ? AND ${SEC("sj.discovered_at")} >= ? GROUP BY month ORDER BY month`).all(co.id, since);
  const jobs = db.prepare(`SELECT sj.id, sj.title, sj.location, sj.company, sj.posted_at, jt.category, jt.subcategory FROM job_company jc
      JOIN scraped_jobs sj ON sj.job_id = jc.job_id LEFT JOIN job_taxonomy jt ON jt.job_id = sj.job_id
      WHERE jc.company_id = ? AND ${OPEN} ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT 20`).all(co.id)
    .map(r => ({ id: r.id, title: r.title, location: r.location || null, postedAt: r.posted_at || null, subcategory: r.subcategory || null, path: jobPath(r) }));
  let sponsorship = null; try { sponsorship = sponsorshipFactFor(db, co.name); } catch { sponsorship = null; }
  let stack = null; try { stack = stackFor(db, co.id, nowSec); } catch { stack = null; }

  const value = {
    company: { slug: co.slug, name: co.name, domain: co.domain || null, ats: provider ? ATS_NAME[provider] || provider : null, careersUrl: careers,
      parent: parent || null, subsidiaries },
    openJobs, byCategory: [...byCat.values()].map(c => ({ ...c, subcategories: c.subcategories.sort((a, b) => b.count - a.count) })).sort((a, b) => b.count - a.count),
    locations: locations.map(l => ({ location: l.location, count: l.n })),
    hiringTrend: trendRows.map(t => ({ month: t.month, postings: t.n })),
    stack, sponsorship: sponsorship ? { ...sponsorship, note: "A record of the employer's past filings — not a promise to sponsor you." } : null,
    jobs,
    about: null,   // ⛔ not built yet: "About in draft's own words" from public facts (Wikidata, the company's site) — D179 (4)
  };
  pageCache.set(s, { at: now, value });
  if (pageCache.size > 5000) pageCache.clear();
  return value;
}

// ── the dropdown ──
let titles = { at: 0, list: [], building: null };
async function titleIndex(read, now = Date.now()) {
  if (titles.list.length && now - titles.at < TITLES_TTL_MS) return titles.list;
  if (titles.building) return titles.building;
  titles.building = (async () => {
    const rows = await read.all(`SELECT COALESCE(NULLIF(TRIM(sj.normalized_title), ''), sj.title) AS title FROM scraped_jobs sj WHERE ${OPEN}`, []);
    const counts = new Map();
    for (const r of rows) { const t = canonicalTitle(r.title); if (t) counts.set(t, (counts.get(t) || 0) + 1); }
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20_000).map(([value, count]) => ({ value, count, lc: value.toLowerCase() }));
    titles = { at: Date.now(), list, building: null };
    return list;
  })().catch((e) => { titles.building = null; throw e; });
  return titles.building;
}

const starts = (hay, q) => hay.startsWith(q) || hay.includes(` ${q}`);

/** The grouped dropdown for `q` (≥ 2 characters): { companies, roles, technologies, titles }. */
export async function publicSuggest(db, read, q, { limit = 5 } = {}) {
  const query = String(q || "").trim().toLowerCase().slice(0, 80);
  if (query.length < 2) return { companies: [], roles: [], technologies: [], titles: [] };
  const like = query.replace(/[%_\\]/g, (c) => `\\${c}`);
  const companies = db.prepare(`SELECT co.slug, co.name,
        (SELECT COUNT(*) FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id WHERE jc.company_id = co.id AND ${OPEN}) AS open
      FROM companies co WHERE LOWER(co.name) LIKE ? ESCAPE '\\' OR LOWER(co.name) LIKE ? ESCAPE '\\'
      ORDER BY (LOWER(co.name) LIKE ? ESCAPE '\\') DESC, LENGTH(co.name) LIMIT 25`).all(`${like}%`, `% ${like}%`, `${like}%`)
    .filter(c => c.open > 0).slice(0, limit).map(c => ({ slug: c.slug, name: c.name, openJobs: c.open, path: `/companies/${c.slug}` }));
  let tax = null; try { tax = taxonomy(); } catch { tax = null; }
  const roles = [];
  for (const c of tax?.categories || []) {
    if (c.held) continue;
    for (const s of c.subs) {
      if (s.general) continue;
      const hitName = starts(s.name.toLowerCase(), query) || starts(c.name.toLowerCase(), query);
      const hitAlias = s.aliases.find(a => starts(a.toLowerCase(), query));
      if (hitName || hitAlias) roles.push({ id: s.id, name: s.name, category: c.name, categoryId: c.id, matched: hitAlias || null });
    }
  }
  const technologies = TECHNOLOGIES.filter(([name, , ...aliases]) => starts(name.toLowerCase(), query) || aliases.some(a => starts(a.toLowerCase(), query)))
    .slice(0, limit).map(([name, group]) => ({ name, group }));
  let titleHits = [];
  try { titleHits = (await titleIndex(read)).filter(t => starts(t.lc, query)).slice(0, limit).map(({ value, count }) => ({ value, count })); } catch { titleHits = []; }
  return { companies, roles: roles.slice(0, limit), technologies, titles: titleHits };
}

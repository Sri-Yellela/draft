// services/companies/companyDirectory.js — ⭐ A144 (45o, owner 11-08): THE COMPANIES TAB.
//
// Owner: "the companies tab wasnt supposed to be omitted, it should be built and discoverable by usbsearch as suggestions
// under the search field" — this reverses the 11-07 override (2). The sketch's (d): a fourth view beside All jobs ·
// Starred · Imported — search companies; filter by industry, technology, hiring now, sponsorship; a company opens its page.
//
// ONE SNAPSHOT, built on the READ WORKERS (A126 — a whole-board GROUP BY on the request thread froze the site on 11-05),
// kept DIR_TTL_MS, one build at a time; each request filters it in memory. Every company with ≥ 1 OPEN public posting
// (the board's own rule, PUBLIC_OPEN_SQL), with:
//   openJobs · newThisWeek (first seen in the last 7 days → "hiring now") · industry / hq (company_facts, Wikidata) ·
//   its top technologies (company_tech: ≥ 2 postings, 180 days — the page's own evidence rule) · sponsorship = a
//   PRESENTABLE matched LCA record with certified filings (the same reading the company page and the card use; it says
//   "has filed H-1B LCAs", never "will sponsor you").
// Facets are TRUE counts (D153 (2)): each facet counted over the set the OTHER filters leave, so a number is what you get.
import { PUBLIC_OPEN_SQL } from "../jobs/publicJobPage.js";
import { SHOW_MIN_POSTINGS, FRESH_DAYS } from "./companyTech.js";

export const DIR_TTL_MS = 10 * 60_000;
export const PAGE_SIZE = 30;
export const HIRING_NOW_DAYS = 7;
const PRESENTABLE_MIN_CONFIDENCE = 0.6;   // services/kb/lcaMatch.js — a weaker name match is never shown as a fact
const TOP_TECH = 6;
const SORTS = new Set(["open", "new", "name"]);
const OPEN = PUBLIC_OPEN_SQL.replace(/\b(is_active|duplicate_of|board_category)\b/g, "sj.$1");
const SEC = (col) => `(CASE WHEN ${col} > 100000000000 THEN ${col} / 1000 ELSE ${col} END)`;

let snap = { at: 0, rows: null, building: null };

/** Build the snapshot from the read pool (`read.all(sql, params)`). Exported for tests. */
export async function buildDirectory(read, nowMs = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const weekAgo = nowSec - HIRING_NOW_DAYS * 86400;
  const base = await read.all(`SELECT co.id, co.slug, co.name, COUNT(*) AS open,
        SUM(CASE WHEN ${SEC("sj.discovered_at")} >= ? THEN 1 ELSE 0 END) AS fresh
      FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id JOIN companies co ON co.id = jc.company_id
      WHERE ${OPEN} GROUP BY co.id`, [weekAgo]);
  const facts = new Map();
  try {
    for (const f of await read.all(`SELECT company_id, industry, hq FROM company_facts WHERE status = 'ok'`, [])) facts.set(f.company_id, f);
  } catch { /* table absent on an old copy */ }
  const tech = new Map();
  try {
    for (const t of await read.all(`SELECT company_id, tech, postings FROM company_tech WHERE postings >= ? AND last_seen >= ?
        ORDER BY company_id, postings DESC, tech`, [SHOW_MIN_POSTINGS, nowSec - FRESH_DAYS * 86400])) {
      const list = tech.get(t.company_id) || []; list.push(t.tech); tech.set(t.company_id, list);
    }
  } catch { /* no extraction yet */ }
  const sponsor = new Map();
  try {
    for (const s of await read.all(`SELECT company, certified_total FROM company_lca_sponsorship
        WHERE match_status = 'matched' AND match_confidence >= ? AND certified_total > 0`, [PRESENTABLE_MIN_CONFIDENCE])) {
      sponsor.set(String(s.company).toLowerCase(), s.certified_total);
    }
  } catch { /* no LCA corpus */ }
  return base.map((r) => {
    const f = facts.get(r.id), t = tech.get(r.id) || [];
    const filed = sponsor.get(String(r.name).toLowerCase()) || 0;
    return {
      slug: r.slug, name: r.name, openJobs: r.open, newThisWeek: r.fresh || 0,
      industry: f?.industry || null, hq: f?.hq || null,
      tech: t, techLc: new Set(t.map((x) => x.toLowerCase())),
      sponsorFilings: filed, nameLc: String(r.name).toLowerCase(),
    };
  });
}

async function snapshot(read, nowMs) {
  if (snap.rows && nowMs - snap.at < DIR_TTL_MS) return snap.rows;
  if (snap.building) return snap.rows || snap.building;   // a stale list is served while one rebuild runs
  snap.building = buildDirectory(read, nowMs)
    .then((rows) => { snap = { at: Date.now(), rows, building: null }; return rows; })
    .catch((e) => { snap.building = null; throw e; });
  return snap.rows || snap.building;
}

/** Forget the snapshot (tests). */
export function resetDirectory() { snap = { at: 0, rows: null, building: null }; }

const clean = (v, max = 80) => String(v ?? "").trim().slice(0, max);

/** Filter, count and page the snapshot. Pure — exported for tests. */
export function queryDirectory(rows, query = {}) {
  const q = clean(query.q).toLowerCase();
  const industry = clean(query.industry);
  const techQ = clean(query.tech).toLowerCase();
  const hiring = query.hiring === "now" || query.hiring === "1";
  const sponsor = query.sponsor === "1" || query.sponsor === "true";
  const sort = SORTS.has(query.sort) ? query.sort : "open";
  const page = Math.max(1, Math.min(500, Number.parseInt(query.page, 10) || 1));

  const tests = {
    q: (r) => !q || r.nameLc.includes(q),
    industry: (r) => !industry || r.industry === industry,
    tech: (r) => !techQ || r.techLc.has(techQ),
    hiring: (r) => !hiring || r.newThisWeek > 0,
    sponsor: (r) => !sponsor || r.sponsorFilings > 0,
  };
  const passAll = (r, except) => Object.entries(tests).every(([k, f]) => k === except || f(r));

  const matched = rows.filter((r) => passAll(r));
  const cmp = sort === "name" ? (a, b) => a.name.localeCompare(b.name)
    : sort === "new" ? (a, b) => b.newThisWeek - a.newThisWeek || b.openJobs - a.openJobs
    : (a, b) => b.openJobs - a.openJobs || a.name.localeCompare(b.name);
  matched.sort(cmp);

  // True counts: each facet over what the OTHER filters leave.
  const industries = new Map(), techs = new Map();
  let hiringNow = 0, sponsors = 0;
  for (const r of rows) {
    if (r.industry && passAll(r, "industry")) industries.set(r.industry, (industries.get(r.industry) || 0) + 1);
    if (passAll(r, "tech")) for (const t of r.tech) techs.set(t, (techs.get(t) || 0) + 1);
    if (r.newThisWeek > 0 && passAll(r, "hiring")) hiringNow++;
    if (r.sponsorFilings > 0 && passAll(r, "sponsor")) sponsors++;
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([value, count]) => ({ value, count }));

  return {
    total: matched.length, page, pageSize: PAGE_SIZE, more: page * PAGE_SIZE < matched.length,
    companies: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => ({
      slug: r.slug, name: r.name, openJobs: r.openJobs, newThisWeek: r.newThisWeek, industry: r.industry, hq: r.hq,
      tech: r.tech.slice(0, TOP_TECH), sponsorFilings: r.sponsorFilings || null,
    })),
    facets: { industries: top(industries, 40), technologies: top(techs, 40), hiringNow, sponsors },
    filters: { q, industry: industry || null, tech: techQ || null, hiring, sponsor, sort },
  };
}

/** GET /api/public/companies — the Companies tab's list (signed in or out: only public facts). */
export async function companyDirectory(read, query = {}, { now = Date.now() } = {}) {
  return queryDirectory(await snapshot(read, now), query);
}

// services/jobs/publicEntry.js — ⭐ A147 (45o, owner 11-08: "On /jobs, board below") · THE SIGNED-OUT /jobs ENTRY.
//
// The D179 sketch's (3): "/jobs entry = the landing-page shape — headline with live totals, search, popular landing links,
// Browse by role (category cards with top subcategories and counts), Hiring by technology, Companies hiring now". The
// owner put it ON /jobs, with the deck / list below it. The role cards come from the open board's own facets (the page
// already reads them); THIS answers the rest, from the open board only (PUBLIC_OPEN_SQL), on the READ WORKERS (A126),
// kept ENTRY_TTL_MS, one build at a time (a stale answer is served while one rebuilds):
//   newThisWeek — open postings first seen in the last 7 days
//   technologies — the most-named technologies on open postings (job_tech; a posting counts only when its text names one),
//                  each with its landing page when it has ≥ MIN_JOBS (services/jobs/landingPages.js, D179 P7)
//   companies — the companies with the most new postings this week (the Companies tab's own list, A144)
import { PUBLIC_OPEN_SQL } from "./publicJobPage.js";
import { techSlug, MIN_JOBS } from "./landingPages.js";
import { companyDirectory } from "../companies/companyDirectory.js";

export const ENTRY_TTL_MS = 10 * 60_000;
export const TECH_SHOWN = 12, COMPANIES_SHOWN = 8;
const OPEN = PUBLIC_OPEN_SQL.replace(/\b(is_active|duplicate_of|board_category)\b/g, "sj.$1");
const SEC = (col) => `(CASE WHEN ${col} > 100000000000 THEN ${col} / 1000 ELSE ${col} END)`;

let cache = { at: 0, value: null, building: null };
export function resetEntry() { cache = { at: 0, value: null, building: null }; }

/** Build the entry's numbers. Exported for tests. */
export async function buildEntry(read, nowMs = Date.now()) {
  const weekAgo = Math.floor(nowMs / 1000) - 7 * 86400;
  const head = await read.all(`SELECT COUNT(*) AS total, SUM(CASE WHEN ${SEC("sj.discovered_at")} >= ? THEN 1 ELSE 0 END) AS fresh
      FROM scraped_jobs sj WHERE ${OPEN}`, [weekAgo]);
  let tech = [];
  try {
    tech = await read.all(`SELECT jt.tech AS name, COUNT(*) AS n FROM job_tech jt JOIN scraped_jobs sj ON sj.job_id = jt.job_id
        WHERE ${OPEN} GROUP BY jt.tech ORDER BY n DESC, jt.tech LIMIT ?`, [TECH_SHOWN]);
  } catch { tech = []; }   // no job_tech yet: the section is not drawn
  let companies = [];
  try {
    companies = (await companyDirectory(read, { hiring: "now", sort: "new" }, { now: nowMs })).companies.slice(0, COMPANIES_SHOWN)
      .map((c) => ({ slug: c.slug, name: c.name, openJobs: c.openJobs, newThisWeek: c.newThisWeek }));
  } catch { companies = []; }
  return {
    total: head[0]?.total || 0, newThisWeek: head[0]?.fresh || 0,
    technologies: tech.map((t) => ({ name: t.name, count: t.n, path: t.n >= MIN_JOBS ? `/jobs/tech/${techSlug(t.name)}` : null })),
    companies,
  };
}

/** GET /api/public/jobs/entry. */
export async function publicEntry(read, { now = Date.now() } = {}) {
  if (cache.value && now - cache.at < ENTRY_TTL_MS) return cache.value;
  if (cache.building) return cache.value || cache.building;
  cache.building = buildEntry(read, now)
    .then((value) => { cache = { at: Date.now(), value, building: null }; return value; })
    .catch((e) => { cache.building = null; throw e; });
  return cache.value || cache.building;
}

// services/companies/companyHealth.js — ⭐ A142 (45o, the D179 report's weak point: "production's company records and
// duplicates were never counted — build the count into Admin → Board so it is read without a DB shell").
//
// The counts the stats line lacked, read on the READ WORKERS (A126: a whole-board scan on the request thread froze the
// site), kept HEALTH_TTL_MS, one build at a time:
//   postingsNoRecord — open public postings with NO company record linked (the linker's backlog)
//   sameDomain       — groups of records that share one registrable domain (likely one company twice)
//   sameName         — groups whose names are equal once case, punctuation and legal suffixes are stripped
// Each group lists its records (id, slug, name, open postings) so the admin can open the pair in the review queue.
// Nothing here merges anything: merging stays the admin's decision (decideCompanyReview).
import { PUBLIC_OPEN_SQL } from "../jobs/publicJobPage.js";

export const HEALTH_TTL_MS = 10 * 60_000;
export const GROUPS_SHOWN = 25;
const OPEN = PUBLIC_OPEN_SQL.replace(/\b(is_active|duplicate_of|board_category)\b/g, "sj.$1");
const SUFFIX = /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|sa|bv|holdings|group|technologies|technology|labs)\b\.?/g;

/** A company name as the duplicate check compares it. Pure. */
export function nameKey(name) {
  return String(name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(SUFFIX, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

let cache = { at: 0, value: null, building: null };
export function resetHealth() { cache = { at: 0, value: null, building: null }; }

/** Build the counts from the read pool (`read.all(sql, params)`). Exported for tests. */
export async function buildHealth(read) {
  const head = await read.all(`SELECT COUNT(*) AS open,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM job_company jc WHERE jc.job_id = sj.job_id) THEN 1 ELSE 0 END) AS unlinked
    FROM scraped_jobs sj WHERE ${OPEN}`, []);
  const recs = await read.all(`SELECT co.id, co.slug, co.name, co.domain,
      (SELECT COUNT(*) FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id WHERE jc.company_id = co.id AND ${OPEN}) AS open
    FROM companies co`, []);
  const group = (keyOf) => {
    const m = new Map();
    for (const r of recs) { const k = keyOf(r); if (!k) continue; (m.get(k) || m.set(k, []).get(k)).push(r); }
    const groups = [...m.entries()].filter(([, rs]) => rs.length > 1)
      .map(([key, rs]) => ({ key, records: rs.sort((a, b) => b.open - a.open).map(r => ({ id: r.id, slug: r.slug, name: r.name, domain: r.domain || null, open: r.open })) }))
      .sort((a, b) => b.records.reduce((s, r) => s + r.open, 0) - a.records.reduce((s, r) => s + r.open, 0));
    return { groups: groups.length, records: groups.reduce((s, g) => s + g.records.length, 0), top: groups.slice(0, GROUPS_SHOWN) };
  };
  return {
    openPostings: head[0]?.open || 0,
    postingsNoRecord: head[0]?.unlinked || 0,
    recordsWithOpenJobs: recs.filter(r => r.open > 0).length,
    sameDomain: group(r => r.domain ? String(r.domain).toLowerCase() : null),
    sameName: group(r => nameKey(r.name) || null),
  };
}

/** GET /api/admin/company-records/health — cached; a stale answer is served while one rebuild runs. */
export async function companyHealth(read, { now = Date.now() } = {}) {
  if (cache.value && now - cache.at < HEALTH_TTL_MS) return { ...cache.value, asOf: cache.at };
  if (cache.building) return cache.value ? { ...cache.value, asOf: cache.at, refreshing: true } : cache.building;
  cache.building = buildHealth(read)
    .then((value) => { cache = { at: Date.now(), value, building: null }; return { ...value, asOf: cache.at }; })
    .catch((e) => { cache.building = null; throw e; });
  return cache.value ? { ...cache.value, asOf: cache.at, refreshing: true } : cache.building;
}

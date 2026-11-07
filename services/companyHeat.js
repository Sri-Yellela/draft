// services/companyHeat.js — ⛔ D80 E · THE LOOP: a company list is maintained, not imported.
//
// "Weekly hiring heat per configured company. No new in-scope posting in 60 days = dormant; the agent PROPOSES
// deactivation visibly and reversibly, the owner approves. Target: ≥ 80% of configured companies show a new
// in-scope posting in the last 30 days." (WORKLOG D80 E)
//   · "New" = first seen by our crawl (scraped_jobs.discovered_at) — the crawl's own clock, not the company's
//     posted date, so a re-dated or back-dated posting cannot fake heat.
//   · ⛔ "In-scope" = any row of that company NOT rejected as out_of_scope (D78 B): since scope is enforced at the
//     door, rows written now are in scope; older rows the sweep retired as out_of_scope do not count as heat.
//   · A company added less than DORMANT_DAYS ago with nothing yet is on PROBATION, not dormant — it has not had
//     the chance to post.
//   · ⛔ It only PROPOSES. Nothing here writes; deactivation stays the owner's press in Admin → Companies.

export const HOT_DAYS = 30;
export const DORMANT_DAYS = 60;
export const TARGET_HOT_SHARE = 0.8;
const DAY = 86400;

/** One company's heat. @returns {"hot" | "warm" | "dormant" | "probation"} */
export function heatOf({ last_new_at = null, created_at = null } = {}, now = Math.floor(Date.now() / 1000)) {
  const since = last_new_at == null ? null : (now - last_new_at) / DAY;
  if (since != null && since <= HOT_DAYS) return "hot";
  if (since != null && since <= DORMANT_DAYS) return "warm";
  if (created_at != null && (now - created_at) / DAY < DORMANT_DAYS) return "probation";
  return "dormant";
}

/** Every ACTIVE company with its heat, the summary against the target, and the deactivation proposals. */
export function heatReport(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const rows = db.prepare(`
    SELECT c.id, c.company, c.ats_type, c.ats_slug, c.created_at,
           (SELECT MAX(sj.discovered_at) FROM scraped_jobs sj
             WHERE sj.source = c.ats_type AND lower(sj.company) = lower(c.company)
               AND NOT EXISTS (SELECT 1 FROM rejected_jobs r WHERE r.job_id = sj.job_id AND r.reason = 'out_of_scope')) AS last_new_at,
           (SELECT COUNT(*) FROM scraped_jobs sj
             WHERE sj.source = c.ats_type AND lower(sj.company) = lower(c.company)
               AND sj.discovered_at >= ? AND sj.is_active = 1) AS new_30d,
           (SELECT COUNT(*) FROM scraped_jobs sj
             WHERE sj.source = c.ats_type AND lower(sj.company) = lower(c.company) AND sj.is_active = 1) AS active_rows
      FROM company_ats_list c WHERE c.active = 1 ORDER BY c.company COLLATE NOCASE`).all(now - HOT_DAYS * DAY);
  // ⭐ D170 (4) (owner 11-06: "Intel: all 213 postings outside the US … keep or deactivate"): a board that works and
  // returns ONLY postings the US-only gate holds out is a decision about the company, not a dead slug — proposed too,
  // with its own reason. The same reading as pipeline health's out_of_market (routes/adminDb.js): no active row, and
  // rows held out as out_of_market:*. A database with no rejected_jobs proposes none of these.
  const heldOut = new Map();
  try {
    for (const h of db.prepare(`SELECT source, lower(company) AS company, COUNT(*) AS n FROM rejected_jobs
        WHERE reason LIKE 'out_of_market:%' GROUP BY source, lower(company)`).all()) heldOut.set(`${h.source}|${h.company}`, h.n);
  } catch { /* no rejected_jobs */ }
  const companies = rows.map((r) => ({ ...r, heat: heatOf(r, now),
    heldOutsideUs: (r.active_rows || 0) === 0 ? (heldOut.get(`${r.ats_type}|${String(r.company).toLowerCase()}`) || 0) : 0,
    daysSinceNew: r.last_new_at == null ? null : Math.floor((now - r.last_new_at) / DAY) }));
  const count = (h) => companies.filter((c) => c.heat === h).length;
  const judged = companies.filter((c) => c.heat !== "probation").length;
  const hotShare = judged ? +(count("hot") / judged).toFixed(3) : null;
  return {
    now, hotDays: HOT_DAYS, dormantDays: DORMANT_DAYS, target: TARGET_HOT_SHARE,
    summary: { active: companies.length, hot: count("hot"), warm: count("warm"), dormant: count("dormant"), probation: count("probation"),
               hotShare, meetsTarget: hotShare == null ? null : hotShare >= TARGET_HOT_SHARE },
    proposals: companies.filter((c) => c.heat === "dormant" || c.heldOutsideUs > 0)
      .map((c) => ({ id: c.id, company: c.company, board: `${c.ats_type}:${c.ats_slug}`, daysSinceNew: c.daysSinceNew,
                     kind: c.heldOutsideUs > 0 ? "outside_us" : "dormant",
                     why: c.heldOutsideUs > 0 ? `every posting it returns (${c.heldOutsideUs}) is outside the US`
                       : c.daysSinceNew == null ? "no in-scope posting ever seen" : `no new in-scope posting for ${c.daysSinceNew} days` })),
    companies,
  };
}

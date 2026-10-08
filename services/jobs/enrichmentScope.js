// services/jobs/enrichmentScope.js — ⛔ D84 F8 · DON'T ENRICH WHAT THE BOARD WILL DROP, and enrich the most useful first.
//
// A posting D78's sweep is about to retire (past the age limit, or outside the computer-science scope) is wasted
// effort for the owner's chat loop. So the backlog count and the export leave out every row the ENFORCED policy will
// retire — by D78's own rules (boardAge.ageOf, csScope.csScopeOf over the stored family), never a copy of them. A
// policy switch that is off retires nothing, so it excludes nothing. (Non-US postings are not here: the US gate holds
// them out of the active board at the crawl, so an active row is already US-admitted.)
//
// ⭐ ORDER: rows WITHOUT a fit score first — they are the ones enrichment unlocks — then the newest.
import { readPolicy, ageOf } from "./boardAge.js";
import { storedFamily } from "./boardScope.js";
import { csScopeOf } from "./csScope.js";

/** Split candidates into the ones to enrich and the ones the enforced policy will retire. */
export function excludeRetiring(db, candidates, { now = Math.floor(Date.now() / 1000), policy = readPolicy(db) } = {}) {
  const keep = [], retiring = { aged: 0, outOfScope: 0 };
  for (const r of candidates) {
    if (policy.age_enforce && ageOf({ posted_at: r.posted_at, first_seen: r.discovered_at ?? r.scraped_at },
        { now, limitDays: policy.age_limit_days }).tooOld) { retiring.aged++; continue; }
    if (policy.scope_enforce && !csScopeOf({ title: r.title, roleKey: storedFamily(db, r) }).inScope) { retiring.outOfScope++; continue; }
    keep.push(r);
  }
  return { keep, retiring };
}

/** Rows without a fit score first (enrichment is what gives them one), then the newest first seen. */
export function orderForEnrichment(db, candidates) {
  const ids = candidates.map((r) => r.job_id);
  let scored = new Set();
  try {
    if (ids.length) {
      scored = new Set(db.prepare(`SELECT DISTINCT job_id FROM ats_only_reports WHERE ats_score IS NOT NULL
        AND job_id IN (${ids.map(() => "?").join(", ")})`).pluck().all(...ids));
    }
  } catch { /* no fit cache on this schema: every row reads as unscored */ }
  return [...candidates].sort((a, b) =>
    (scored.has(a.job_id) - scored.has(b.job_id)) || ((b.discovered_at ?? 0) - (a.discovered_at ?? 0)));
}

// services/atsReportRead.js — ⭐ A187 Stage 0 (46i) · SCORE-ONLY STORAGE: the one way to read a stored ATS report.
//
// With the flag ats_store_slim on, the board's bulk scoring (the fit precompute, the match queue) stores a SLIM row — the score
// and what it rested on, `{ slim: 1, score, source, scorable }` — instead of the ~0.65–1 KB report, because almost none
// of a person's ~25k scored postings is ever opened. A reader that needs the report's DETAIL (the deck's card, best
// bets' must-haves, the apply record, interview prep, the daily question, the keywords panel) reads through here: a slim
// row is re-scored ONCE by the expander server.js registers (the same basis + scorer the board uses, local, no model
// call) and written back in full when its inputs still match, so the next read is a plain read.
//
// Off (the default) nothing is slim and this is JSON.parse.

let expander = null;

/** server.js registers ({ userId, profileId, jobId }) => full report | null. */
export function setSlimReportExpander(fn) { expander = typeof fn === "function" ? fn : null; }

// The switch the writer reads is the flag `ats_store_slim` (services/flags.js: registry → ATS_STORE_SLIM → Admin's switch).
// Readers handle slim rows whatever it says — rows written while it was on stay slim.

export const isSlimReport = (r) => !!(r && typeof r === "object" && r.slim === 1);

/** The slim row stored for a report. Keeps exactly what the board reads from the row itself (ats_score is its own column). */
export function slimOf(report) {
  return { slim: 1, score: report?.score ?? null, source: report?.source ?? null, scorable: report?.scorable ?? null };
}

/**
 * A stored report, full. `raw` is the ats_report text (or an already-parsed object); `ctx` names the row.
 * A slim row with no expander (or one that cannot answer — no résumé, the posting gone) comes back as the slim object,
 * whose detail fields are simply absent: every reader already treats a missing field as "nothing to say".
 */
export function fullReport(raw, ctx = {}) {
  let r = raw;
  if (typeof raw === "string") { try { r = JSON.parse(raw); } catch { return null; } }
  if (!isSlimReport(r)) return r ?? null;
  if (!expander || ctx.userId == null || ctx.jobId == null) return r;
  try { return expander({ userId: ctx.userId, profileId: ctx.profileId ?? null, jobId: String(ctx.jobId) }) || r; }
  catch { return r; }
}

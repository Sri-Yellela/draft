/**
 * What is left of the model enrichment pass — the pieces other code still reads.
 *
 * ⛔ D17 (owner, 2026-10-03): ONLY RÉSUMÉ GENERATION MAY CALL A MODEL. This file used to hold the
 * background enrichment pass: `runEnrichment` sent each posting's title, company and description to
 * a model (purpose `enrich_job`, 60.2% of all model spend at its peak) and `drainEnrichment` looped
 * it under a daily budget from the 04:00 cron. A80 V4 removed every trigger; once A76's export →
 * grade → import landed, the call itself was deleted (A80, 10-05), together with the prompt, the
 * pass, the drain and the helpers only they used. The manual path is now the only way enrichment
 * reaches the board: services/jobs/enrichmentTransfer.js (export → enrich outside the product →
 * import), with batch provenance and revert from services/jobs/enrichmentBatches.js.
 *
 * The full pass, with the lessons recorded in its comments (the reversed COALESCE on
 * normalized_title, the all-null extraction treated as a failure, the honest run status), is in
 * git history before this commit. ⚠ Two consequences, stated rather than discovered later:
 *   · services/jobs/detailFetch.js's fillMissingDescriptions was called only from the drain, so the
 *     SmartRecruiters/Workday description fetch has had no trigger since V4.
 *   · company_technographics was written only by the pass, so a company's stack signal no longer
 *     accumulates; the read side (services/kb/*) decays what is there with decayedWeight below.
 */

// ── THE DAILY BUDGET (task AE) ──────────────────────────────────────────────────────────────────
// The drain this bounded is gone. The caps are still read: the admin glance (services/adminGlance.js)
// shows them beside the enrichment spend it reports, so they stay until that card is re-worded.
const envNum = (name, dflt) => {
  const n = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(n) && n >= 0 ? n : dflt;
};
const enrichBudget = () => ({
  maxRows:    envNum('ENRICH_DAILY_MAX_ROWS', 300),
  maxUsd:     envNum('ENRICH_DAILY_MAX_USD', 1.0),
  maxMinutes: envNum('ENRICH_MAX_RUN_MINUTES', 20),
});

// Technographic decay: a skill's accumulated weight halves every DECAY_HALFLIFE_DAYS without
// a new posting reinforcing it, so a company's stack signal fades over time instead of
// acting as permanent ground truth from one old posting. Read by services/kb/companyProfile.js,
// orgLayer.js and formSchemaLayer.js.
const DECAY_HALFLIFE_DAYS = 30;

// Exponential decay: weight halves every DECAY_HALFLIFE_DAYS since it was last reinforced.
function decayedWeight(existingWeight, lastSeenEpoch, nowEpoch) {
  const elapsedDays = Math.max(0, (nowEpoch - lastSeenEpoch) / 86400);
  const factor = Math.pow(0.5, elapsedDays / DECAY_HALFLIFE_DAYS);
  return existingWeight * factor;
}

// ── A52 follow-up (10-02): ENRICHMENT FINISHING MAKES STORED SCORES STALE — SAY SO ──────────────
// A52 tied each stored ATS score to the posting it scored (job_hash), so a row enrichment just
// filled is correctly read as stale — but nothing then rescored it until the next crawl or board
// load. Listeners run after an enrichment write of at least one row — since A80, the manual import
// (enrichmentTransfer.js applyImport); server.js registers the board-fit precompute, which rescores
// exactly the postings whose hash moved. A listener must never fail the write that notified it.
const enrichmentListeners = new Set();
function onEnrichmentApplied(fn) {
  enrichmentListeners.add(fn);
  return () => enrichmentListeners.delete(fn);
}
function notifyEnrichmentApplied(info) {
  for (const fn of enrichmentListeners) {
    try { fn(info); } catch (e) { console.warn(`[enrichJob] enrichment listener threw: ${e.message}`); }
  }
}

export { enrichBudget, onEnrichmentApplied, notifyEnrichmentApplied, decayedWeight, DECAY_HALFLIFE_DAYS };

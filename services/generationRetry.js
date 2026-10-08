// ⭐ D70 Phase 3 · RETRIES: AT MOST ONE AUTOMATIC, AND EVERY RETRY SAYS WHY.
//
// The row: "if a refusal triggers an automatic second generation, cap it at one and say why in the
// response; count them in the ledger by purpose."
//
// What Phase 0 found (production, 10-07): 11 resume_generate rows, 0 claim-guard refusals, and NO
// automatic second generation anywhere in draft — coreGenerateResume calls the tools service once and
// a failure goes back to the person (or to the apply run's held_review) with `retryable` set. A
// retry today is always a PERSON's: the Regenerate button, the Retry on a held Draft, a Draft run
// again. So:
//
//   1. THE CAP. AUTOMATIC_RETRY_CAP is the most automatic re-generations one request may make, and
//      AUTOMATIC_RETRIES_MADE is what draft makes — 0, because D17 forbids a new model call and a
//      cost that has not occurred (Phase 0: refusals 0 of 11) is not worth spending to protect. The
//      guard (test/d70Phase3.test.js) holds MADE <= CAP and holds coreGenerateResume to ONE
//      tools-service call with no loop, so an automatic retry cannot arrive without changing both.
//      ⚠ The automatic retries that DO exist are the Anthropic SDK's own (default maxRetries 2, on
//      a connection error / 429 / 5xx) inside the tools service — that client is constructed in that
//      repository, and capping it at 1 is its change, not this one's.
//
//   2. THE REASON. A generation that follows a FAILED one for the same person and job within the
//      hour is a retry, and its ledger row says so — `retry after: <the failure's code>` in
//      error_text, beside A94's `request failed: <code>` — so the ledger counts retries by purpose
//      (`purpose = 'resume_generate' AND error_text LIKE '%retry after:%'`) without a migration. The
//      /api/generate response carries the same reason as `retry`.

export const AUTOMATIC_RETRY_CAP = 1;
export const AUTOMATIC_RETRIES_MADE = 0;

/** A generation within this long of a failed one, for the same person and job, is a retry of it. */
export const RETRY_WINDOW_SEC = 60 * 60;

const RETRY_PREFIX = "retry after: ";

/**
 * The reason THIS generation is a retry, or null when it is not one: the code of the most recent
 * resume_generate row for (user, job) inside the window, if that row was a failure. A94 writes a
 * withheld résumé (a billed call whose request failed) as success = 1 with `request failed: <code>`;
 * a call that failed inside the tools service is success = 0. A delivered row ends the chain — the next
 * generation after a delivered résumé is a regeneration, not a retry.
 *
 * Never throws: a ledger that cannot be read must not cost a generation the person is waiting for.
 */
export function retryReasonFor(db, { userId, jobId, now = Math.floor(Date.now() / 1000), windowSec = RETRY_WINDOW_SEC } = {}) {
  if (userId == null || jobId == null || jobId === "") return null;
  try {
    const last = db.prepare(`
      SELECT success, error_text FROM usage_events
      WHERE user_id = ? AND job_id = ? AND purpose = 'resume_generate' AND created_at >= ?
      ORDER BY created_at DESC, id DESC LIMIT 1
    `).get(userId, String(jobId), now - windowSec);
    if (!last) return null;
    const text = String(last.error_text || "");
    const failed = /request failed:\s*([a-z0-9_]+)/i.exec(text);
    if (failed) return failed[1];
    if (last.success === 0) return "model_call_failed";
    return null;
  } catch {
    return null;
  }
}

/** The ledger annotation for a retry; null when the generation is not one. */
export function retryLedgerText(reason) {
  return typeof reason === "string" && reason ? `${RETRY_PREFIX}${reason}` : null;
}

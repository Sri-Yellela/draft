// ── What a user DOES with a job — one vocabulary, one set of calls, every surface (A53) ─────────
//
// docs/UI_REDESIGN.md §3.4 "Actions, keys and gestures — one vocabulary on every client". The deck
// (Today) and the board (Jobs, its card and JobDetailPanel) used to disagree: the board said "Queue
// Auto" and put the job in a client-side basket that a reload emptied, while the deck said "Draft"
// and posted the run at once; the board TOGGLED Save and Pass while the deck SET them. Owner
// decision, 10-02: one name and one behaviour. Both surfaces import these calls — there is no
// second copy to drift.
//
//   Draft  POST  /api/apply/runs   { jobIds:[id], mode:"auto", tool, surface }   ⛔ never approvalMode
//          — previewed and parked for review; the route refuses approvalMode from a decision surface.
//          A59: while another draft is running it WAITS IN LINE (202, waiting:true, line:{position,
//          length}) — never refused — and can be edited, reordered or removed in Auto Apply.
//   Pass   PATCH /api/jobs/interact { jobId, disliked:true, starred:false }       a SET, never a toggle
//   Save   PATCH /api/jobs/interact { jobId, starred:true, disliked:false }       a SET, never a toggle
//   Undo   abort the drafted run-job / put back exactly the flags the decision changed
//
// ⛔ A repeat Save or Pass is a no-op that shows the set state — the per-id toggle routes
// (/api/jobs/:id/starred, /disliked) read the current value and write its opposite, so a second
// click (or a retried request) silently UNDID the user's decision with a 200. Reversal is Undo,
// a separate, labelled control — never the same button pressed again.
import { api as defaultApi } from "./api.js";
import { DECISIONS } from "./deckState.js";

export { DECISIONS };

/** The surfaces that decide. The route refuses approvalMode from each (routes/apply.js). */
export const DECISION_SURFACES = Object.freeze({ DECK: "deck", BOARD: "board" });

export const DECISION_TOAST_MS = 5000;
export const DECISION_VERB = Object.freeze({ drafted: "Drafted", passed: "Passed", saved: "Saved" });
export const DECISION_AFTER = Object.freeze({
  drafted: "it waits for your review — nothing is sent until you approve it",
  passed: "it won't come back",
  saved: "it's in Saved on the board",
});

/** A59: the toast's second half for a Draft that waits in line rather than starting now. */
export function lineAfter(line) {
  if (!line?.position) return DECISION_AFTER.drafted;
  return `it waits in line (${line.position} of ${line.length}) and starts when the draft ahead of it finishes — ` +
    "edit, reorder or remove it on the Draft tab";
}

/** The flags a Save or a Pass SETS. They are exclusive: saving a passed job un-passes it, and back. */
export function flagsFor(decision) {
  if (decision === DECISIONS.SAVED) return { starred: true, disliked: false };
  if (decision === DECISIONS.PASSED) return { disliked: true, starred: false };
  throw new Error(`not a flag decision: ${decision}`);
}

/** What Undo writes: exactly the flags the decision changed, put back to what they were. */
export function undoFlagsFor(decision, prior = {}) {
  const set = flagsFor(decision);
  const out = {};
  for (const [k, v] of Object.entries(set)) {
    const was = !!prior[k];
    if (was !== v) out[k] = was;
  }
  return out;
}

/** Is a job already drafted? The deck's own rule (services/dailyDraft.js decisionsFor): any
 *  run-job that was not cancelled. `applyState` is AutoApplyContext's applyStateByJobId entry. */
export function isDrafted(applyState) {
  return !!applyState?.status && applyState.status !== "cancelled";
}

/**
 * Commit one decision on one job. Resolves to `{ runId, line }` for a draft (`line` is null when it
 * started at once, `{ position, length }` when it waits in line — A59), `{}` otherwise; rejects
 * with the server's own sentence on a refusal (409 prerequisite, 429 cap, 400 already drafted).
 */
export async function commitDecision({ jobId, decision, tool, surface, api = defaultApi }) {
  if (!jobId) throw new Error("jobId required");
  if (decision === DECISIONS.DRAFTED) {
    const r = await api("/api/apply/runs", { method: "POST",
      body: JSON.stringify({ jobIds: [jobId], mode: "auto", tool, surface }) });
    return { runId: r?.runId ?? null, line: r?.waiting ? (r.line ?? null) : null };
  }
  await api("/api/jobs/interact", { method: "PATCH",
    body: JSON.stringify({ jobId, ...flagsFor(decision) }) });
  return {};
}

/** Undo one decision. A draft is aborted (claims only from PENDING; the server says what it reached). */
export async function undoDecision({ jobId, decision, runId, prior, api = defaultApi }) {
  if (decision === DECISIONS.DRAFTED) {
    if (!runId) return;
    const run = await api(`/api/apply/runs/${runId}`);
    const rj = (run?.jobs || run?.run?.jobs || []).find(j => String(j.jobId ?? j.job_id) === String(jobId));
    if (rj) await api(`/api/apply/run-jobs/${rj.id}/abort`, { method: "POST" });
    return;
  }
  const flags = undoFlagsFor(decision, prior);
  if (!Object.keys(flags).length) return;
  await api("/api/jobs/interact", { method: "PATCH", body: JSON.stringify({ jobId, ...flags }) });
}

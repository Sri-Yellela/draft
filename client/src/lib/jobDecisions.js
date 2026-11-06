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
    "edit, reorder or remove it in Draft House";
}

// ── D51 · A DRAFT BUTTON IS NEVER A DEAD END ────────────────────────────────────────────────────
//
// The owner drafted a job and the button went grey: no word of why, nor of where the job went. Every
// Draft control (the board's bubble, the posting panel, the card) now takes its state from here, and a
// state that refuses ALWAYS carries the sentence that says why. A drafted job is not refused — its
// button opens Draft House, where the job is.

/** Hours or minutes until `atMs`, for "resets in 3h". */
export function untilLabel(atMs, now = Date.now()) {
  const s = Math.max(0, Math.round((Number(atMs) - now) / 1000));
  if (!Number.isFinite(s)) return null;
  if (s < 3600) return `${Math.max(1, Math.ceil(s / 60))} min`;
  return `${Math.ceil(s / 3600)}h`;
}

/**
 * Why a Draft cannot start right now, or null. Each reason is one the SERVER would refuse with
 * (routes/apply.js startRun), said before the click rather than after it.
 * @param p.slots         GET /api/draft/slots ({ limit, remaining, nextFreeAt })
 * @param p.prereqMissing apply prerequisites missing (integrations status `apply.missing`)
 * @param p.prereqLabels  lib/applyObstacles.js PREREQUISITE_LABELS
 * @param p.paused        the operator's kill switch is on (run bar `mode.auto.killSwitch`)
 */
export function draftBlock({ slots = null, prereqMissing = [], prereqLabels = {}, paused = false, now = Date.now() } = {}) {
  if (paused) return { code: "paused", label: "Paused",
    reason: "Drafting is paused by the operator — nothing new can be drafted right now. Nothing already sent is affected." };
  if (prereqMissing?.length) {
    const what = prereqMissing.map(k => prereqLabels[k]?.obstacle || k).join("; ");
    return { code: "setup", label: "Setup needed", reason: `Can't be drafted yet — ${what}.` };
  }
  if (slots && Number(slots.remaining) <= 0) {
    const when = slots.nextFreeAt ? untilLabel(slots.nextFreeAt, now) : null;
    return { code: "out_of_drafts", label: "Out of drafts",
      reason: `Out of drafts — all ${slots.limit} used in the last 24 hours (a Draft or a new résumé uses one).` +
        (when ? ` Resets in ${when}.` : " The next one frees up 24 hours after the oldest.") };
  }
  return null;
}

/**
 * The one Draft control's state. `disabled` is true ONLY while a Draft is on the wire; a blocked
 * button is aria-disabled but still answers a press with its reason (touch has no tooltip).
 * @returns {{ kind: "idle"|"drafting"|"drafted"|"blocked", label: string, title: string,
 *             disabled: boolean, ariaDisabled: boolean, action: "draft"|"view"|"explain"|null }}
 */
export function draftButtonState({ drafted = false, drafting = false, block = null, canView = true, slots = null } = {}) {
  if (drafting) return { kind: "drafting", label: "Drafting…", title: "Drafting — it is on its way to Draft House.",
    disabled: true, ariaDisabled: true, action: null };
  if (drafted) return { kind: "drafted", label: "Drafted ✓",
    title: canView ? "Drafted — view it in Draft House. Undo on the toast, or remove it there."
                   : "Drafted — it waits for your review in Draft House.",
    disabled: false, ariaDisabled: !canView, action: canView ? "view" : "explain" };
  if (block) return { kind: "blocked", label: block.label, title: block.reason,
    disabled: false, ariaDisabled: true, action: "explain" };
  // D52: the cost is said BEFORE the click — a Draft uses one of the day's drafts.
  const cost = slots && Number.isFinite(Number(slots.remaining))
    ? ` Uses 1 of your ${slots.remaining} draft${Number(slots.remaining) === 1 ? "" : "s"} left (24 hours).` : "";
  return { kind: "idle", label: "Draft", title: `Draft — queue it for your review.${cost} Nothing is sent until you approve it.`,
    disabled: false, ariaDisabled: false, action: "draft" };
}

/**
 * ⭐ D164 (owner 11-05) · THE POSTING'S RÉSUMÉ STATE, said in words: Generating… · Ready · Failed — Try again · none yet.
 * A failure is its own state with its sentence and a retry — never folded into "none" (D156 6: a failure is never shown
 * as "no résumé"). A résumé being REgenerated over a stored one reads Generating…; a failed regeneration keeps saying
 * Failed while the stored résumé stays available underneath.
 * @returns {{ kind: "generating"|"failed"|"ready"|"none", word: string, detail: string|null, retry: boolean }}
 */
export function resumeControlState({ hasArtifact = false, generating = false, error = null, ago = null } = {}) {
  if (generating) return { kind: "generating", word: "Generating…", detail: "Takes about 10–20 seconds.", retry: false };
  if (error) return { kind: "failed", word: "Failed — Try again",
    detail: String(error?.message || error || "The résumé could not be generated."), retry: true };
  if (hasArtifact) return { kind: "ready", word: ago ? `Ready · ${ago}` : "Ready", detail: null, retry: false };
  return { kind: "none", word: "Not made for this job yet", detail: null, retry: false };
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
    // D51: the slots after this Draft, so the board's quota moves without a second request.
    return { runId: r?.runId ?? null, line: r?.waiting ? (r.line ?? null) : null,
             ...(r?.draftSlots ? { slots: r.draftSlots } : {}) };
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

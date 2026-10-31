// ── D102 · ONE STATUS LADDER — Draft House and The Table read the same module ────────────────
//
// A job is ONE row from the moment it is Drafted until it closes, and its status is a step on ONE
// ladder (D102, owner 10-30):
//
//   queued → in_flight → needs_you | ready_to_approve → submitted → interview | assessment | offer | rejected
//   plus failed and skipped, from any pre-submit state; and withdrawn (D113 UI, owner 10-31), terminal, from any sent
//   state: the USER said "I withdrew it" after withdrawing on the company's own site — draft never withdraws anything.
//
// ⛔ THIS IS NOT A THIRD STORED VOCABULARY. Two already exist and stay exactly as they are:
//   our pipeline   apply_run_jobs.status + reason_code   (shared/applyOutcomeGroups.js lists every value)
//   the employer   job_applications.outcome              (shared/applicationResponse.js RESPONSE_OUTCOME)
// The ladder is DERIVED from them by ladderStatus() below — nothing writes a ladder value to a table,
// so the two vocabularies cannot drift from it. In shared/ (the row named `lib/`, which this repository
// does not have) because the server and the client both read it, the applyOutcomeGroups.js convention.
//
// Draft House shows everything BEFORE submit, The Table everything after; the tabs below are each
// surface's, in the owner's order, and every ladder status belongs to exactly one surface.
import { RESPONSE_OUTCOME } from "./applicationResponse.js";

export const LADDER = Object.freeze([
  "queued", "in_flight", "needs_you", "ready_to_approve",
  "submitted", "interview", "assessment", "offer", "rejected", "withdrawn",
  "failed", "skipped",
]);

export const LADDER_LABELS = Object.freeze({
  queued: "Queued", in_flight: "In flight", needs_you: "Needs you", ready_to_approve: "Ready to approve",
  submitted: "Submitted", interview: "Interview", assessment: "Assessment", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
  failed: "Failed", skipped: "Skipped",
});

/** Draft House's tabs — Needs you first and the default (D25: exceptions are the main surface). */
export const DRAFT_HOUSE_TABS = Object.freeze(["needs_you", "ready_to_approve", "in_flight", "queued", "failed", "skipped"]);
export const DRAFT_HOUSE_DEFAULT_TAB = "needs_you";

/** The Table's tabs. `all` is every post-submit row; the rest are ladder statuses. */
export const TABLE_TABS = Object.freeze(["all", "submitted", "interview", "assessment", "offer", "rejected", "withdrawn"]);
export const TABLE_DEFAULT_TAB = "all";

const PRE_SUBMIT = new Set(["queued", "in_flight", "needs_you", "ready_to_approve", "failed", "skipped"]);

/** Which surface lists a ladder status. Every status is on exactly one. */
export function surfaceOf(status) {
  if (!LADDER.includes(status)) return null;
  return PRE_SUBMIT.has(status) ? "draft_house" : "table";
}

// apply_run_jobs.status → the ladder, before anything was sent. `held_review` splits on its reason:
// only `awaiting_approval` is approvable (routes/apply.js — the approve endpoints release nothing else),
// so only it is Ready to approve; every other hold is waiting on the person.
const RUN_JOB = Object.freeze({
  queued: "queued", waiting: "queued",
  running: "in_flight",
  held_gate: "needs_you",
  failed: "failed",
  dismissed: "skipped", cancelled: "skipped", superseded: "skipped",
});

// job_applications.outcome → the ladder, after it was sent. A recruiter SCREEN is the first
// conversation, so it sits on Interview; `assessment` is D103's category (HackerRank, a take-home) and
// is accepted here before the stored vocabulary has it. No reply stays Submitted. WITHDRAWN (the user's "I withdrew
// it") is its own terminal status since D113 UI, whatever the employer had said before; `closedByCandidate` stays.
const OUTCOME = Object.freeze({
  [RESPONSE_OUTCOME.SCREEN]: "interview",
  [RESPONSE_OUTCOME.INTERVIEW]: "interview",
  assessment: "assessment",
  [RESPONSE_OUTCOME.OFFER]: "offer",
  [RESPONSE_OUTCOME.REJECTED]: "rejected",
});

/**
 * The ladder status of one application.
 * @param {{ runJobStatus?: string|null, reasonCode?: string|null, sent?: boolean, outcome?: string|null }} a
 *   `sent` — a submission is recorded (a submitted run-job, or a verified application record).
 * @returns {{ status: string, closedByCandidate: boolean }}
 */
export function ladderStatus({ runJobStatus = null, reasonCode = null, sent = false, outcome = null } = {}) {
  const closedByCandidate = outcome === RESPONSE_OUTCOME.WITHDRAWN;
  if (sent || runJobStatus === "submitted") {
    return { status: closedByCandidate ? "withdrawn" : (OUTCOME[outcome] || "submitted"), closedByCandidate };
  }
  if (runJobStatus === "held_review") {
    return { status: reasonCode === "awaiting_approval" ? "ready_to_approve" : "needs_you", closedByCandidate };
  }
  return { status: RUN_JOB[runJobStatus] || "queued", closedByCandidate };
}

/** Tab counts for one surface: every tab present, zero included (zero-count tabs stay visible, dim). */
export function tabCounts(statuses, surface) {
  const tabs = surface === "table" ? TABLE_TABS : DRAFT_HOUSE_TABS;
  const counts = Object.fromEntries(tabs.map(t => [t, 0]));
  for (const s of statuses) {
    if (surfaceOf(s) !== (surface === "table" ? "table" : "draft_house")) continue;
    if (s in counts) counts[s] += 1;
    if (surface === "table") counts.all += 1;
  }
  return counts;
}

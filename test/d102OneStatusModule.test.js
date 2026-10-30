import test from "node:test";
import assert from "node:assert/strict";
import {
  LADDER, LADDER_LABELS, DRAFT_HOUSE_TABS, DRAFT_HOUSE_DEFAULT_TAB, TABLE_TABS, surfaceOf, ladderStatus, tabCounts,
} from "../shared/applicationStatus.js";
import { RESPONSE_OUTCOMES } from "../shared/applicationResponse.js";

// ⭐ D102 · ONE STATUS LADDER (owner 10-30). Derived from the two stored vocabularies — never a third.
// The "both surfaces import it" half of d102OneStatusModule lands with the PipelineWorkspace UI (D102 P1).

// Every value processRunJob and the routes write to apply_run_jobs.status (shared/applyOutcomeGroups.js).
const RUN_JOB_STATUSES = ["queued", "waiting", "running", "submitted", "held_review", "held_gate", "failed",
  "dismissed", "superseded", "cancelled"];

test("D102 · the ladder is the owner's, in order, and every status has a label", () => {
  assert.deepEqual(LADDER, ["queued", "in_flight", "needs_you", "ready_to_approve", "submitted",
    "interview", "assessment", "offer", "rejected", "failed", "skipped"]);
  for (const s of LADDER) assert.ok(LADDER_LABELS[s], s);
});

test("D102 · every ladder status is on exactly one surface; Draft House before submit, The Table after", () => {
  for (const s of LADDER) assert.ok(["draft_house", "table"].includes(surfaceOf(s)), s);
  for (const t of DRAFT_HOUSE_TABS) assert.equal(surfaceOf(t), "draft_house", t);
  for (const t of TABLE_TABS.filter(t => t !== "all")) assert.equal(surfaceOf(t), "table", t);
  const covered = new Set([...DRAFT_HOUSE_TABS, ...TABLE_TABS]);
  for (const s of LADDER) assert.ok(covered.has(s), `${s} has a tab`);
  assert.equal(surfaceOf("held_review"), null, "a stored value is not a ladder status");
});

test("D102 · Needs you is Draft House's first tab and its default", () => {
  assert.equal(DRAFT_HOUSE_TABS[0], "needs_you");
  assert.equal(DRAFT_HOUSE_DEFAULT_TAB, "needs_you");
});

test("D102 · every stored run-job status maps to a ladder status — a total map", () => {
  for (const s of RUN_JOB_STATUSES) assert.ok(LADDER.includes(ladderStatus({ runJobStatus: s }).status), s);
});

test("D102 · only awaiting_approval is Ready to approve; every other hold Needs you", () => {
  assert.equal(ladderStatus({ runJobStatus: "held_review", reasonCode: "awaiting_approval" }).status, "ready_to_approve");
  for (const reasonCode of ["incomplete_form", "manual_review", "full_auto_not_chosen", "ats_below_threshold", null]) {
    assert.equal(ladderStatus({ runJobStatus: "held_review", reasonCode }).status, "needs_you", String(reasonCode));
  }
  assert.equal(ladderStatus({ runJobStatus: "held_gate", reasonCode: "login_required" }).status, "needs_you");
});

test("D102 · after submit the employer's outcome moves the row; every stored outcome lands on The Table", () => {
  assert.equal(ladderStatus({ runJobStatus: "submitted" }).status, "submitted");
  assert.equal(ladderStatus({ sent: true, outcome: "interview" }).status, "interview");
  assert.equal(ladderStatus({ sent: true, outcome: "screen" }).status, "interview");
  assert.equal(ladderStatus({ sent: true, outcome: "assessment" }).status, "assessment");
  assert.equal(ladderStatus({ sent: true, outcome: "offer" }).status, "offer");
  assert.equal(ladderStatus({ sent: true, outcome: "rejected" }).status, "rejected");
  for (const o of RESPONSE_OUTCOMES) assert.equal(surfaceOf(ladderStatus({ sent: true, outcome: o }).status), "table", o);
  const w = ladderStatus({ sent: true, outcome: "withdrawn" });
  assert.deepEqual(w, { status: "submitted", closedByCandidate: true });
});

test("D102 · tab counts carry every tab, zero included, and partition the rows", () => {
  const rows = ["needs_you", "needs_you", "queued", "submitted", "offer"];
  assert.deepEqual(tabCounts(rows, "draft_house"),
    { needs_you: 2, ready_to_approve: 0, in_flight: 0, queued: 1, failed: 0, skipped: 0 });
  assert.deepEqual(tabCounts(rows, "table"),
    { all: 2, submitted: 1, interview: 0, assessment: 0, offer: 1, rejected: 0 });
});

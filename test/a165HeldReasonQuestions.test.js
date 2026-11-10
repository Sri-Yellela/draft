// ⭐ A165 (owner 11-10): "it held off auto apply for review. didnt specify which questions." A held application says WHY it
// is held and NAMES the questions waiting on the person. Synthetic run: run job held by the full-auto safety gate, with a
// profile-only packet that could not answer two questions and a fill that left one required field empty.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { heldQuestionsOf, heldReasonWords } from "../services/heldQuestions.js";
import { heldStateOf, heldHeadline, heldQuestionsFor, runSteps } from "../client/src/lib/heldApplication.js";
import { describeApplication } from "../client/src/lib/applyObstacles.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const detail = "Held: sending without your review waits until draft's safety checks are green (A daily cost alarm, and today under it; The kill switch tested on production). Nothing was sent.";
const packet = JSON.stringify({ unresolved: [
  { field: "Are you legally authorized to work in the US?", is_required: true, eligibility: true },
  { field: "Desired salary", is_required: false },
  { field: "Resume", type: "file", is_required: true },
  { field: "Why do you want to work at Acme Rails?", is_required: true, from_schema: true },
] });
const blanks = JSON.stringify([{ label: "Desired salary", required: true }, { label: "Middle name", required: false }]);
const open = JSON.stringify([{ question: "Why do you want to work at Acme Rails?", required: true, type: "textarea" }]);

test("a165HeldQuestionsNamed: every open question once, required first, files never asked", () => {
  const qs = heldQuestionsOf({ openQuestionsJson: open, blanksJson: blanks, packetJson: packet });
  assert.deepEqual(qs.map(q => q.question), [
    "Why do you want to work at Acme Rails?", "Desired salary", "Are you legally authorized to work in the US?",
  ]);
  assert.ok(qs.every(q => q.required), "the not-required salary from the packet merged into the required blank");
  assert.ok(!qs.some(q => /resume/i.test(q.question)), "D165 R1: the résumé is draft's to make");
  assert.deepEqual(heldQuestionsOf({}), [], "nothing recorded → nothing listed, no throw");
  assert.deepEqual(heldQuestionsOf({ packetJson: "{not json" }), []);
});

test("a165HeldReasonWords: the safety gate names the checks still to pass; every code reads as a sentence", () => {
  assert.match(heldReasonWords("full_auto_prerequisites", detail), /safety checks.*Still to pass: A daily cost alarm, and today under it; The kill switch tested on production\./);
  for (const c of ["daily_cap_reached", "provider_review_only", "full_auto_not_chosen", "manual_review", "awaiting_approval"]) {
    assert.ok(!/_/.test(heldReasonWords(c)), `${c} reads as words`);
  }
  assert.equal(heldReasonWords("something_new", "The detail the server wrote."), "The detail the server wrote.");
  for (const c of ["full_auto_prerequisites", "daily_cap_reached", "provider_review_only"]) {
    assert.notEqual(describeApplication({ status: "held_review", reasonCode: c }).obstacle, "Held for you to look at", `${c} has its own obstacle`);
  }
});

test("a165HeldViewSaysWhyAndLists: the held row's headline is the reason, its lead counts the questions", () => {
  const row = { id: 9, reasonCode: "full_auto_prerequisites", heldReason: heldReasonWords("full_auto_prerequisites", detail),
    heldQuestions: heldQuestionsOf({ openQuestionsJson: open, blanksJson: blanks, packetJson: packet }) };
  const node = { kind: "held", why: "held", company: "Acme Rails", say: "Stopped and waiting for you.", ref: { primary: { row }, rows: [row] } };
  assert.equal(heldStateOf(node), "held");
  const h = heldHeadline(node);
  assert.equal(h.eyebrow, "Held — nothing was sent");
  assert.match(h.title, /safety checks/);
  assert.equal(h.lead, "3 questions are waiting on you — listed below.");
  assert.equal(heldQuestionsFor(node).length, 3);
  assert.deepEqual(runSteps(node), [], "a hold before the form claims no steps");
  const quiet = { kind: "held", why: "held", company: "Acme Rails", say: "x", ref: { primary: { row: { reasonCode: "daily_cap_reached", heldReason: "Today's limit." } } } };
  assert.match(heldHeadline(quiet).lead, /No question is waiting on you/);
  const ready = { kind: "approval", ref: { answerCount: 12, heldQuestions: [{ question: "Start date", required: true }] } };
  assert.deepEqual(heldQuestionsFor(ready).map(q => q.question), ["Start date"], "a filled application names its open questions too");
});

test("a165Wiring: the runs feed and the pending feed carry the reason + questions; the row renders them", () => {
  const route = read("routes/apply.js");
  assert.match(route, /const publicRunJob = \(r\) => \(\{\n    \.\.\.heldFacts\(r\),/);
  assert.match(route, /heldQuestions: heldQuestionsOf\(\{ openQuestionsJson: r\.open_questions_json, blanksJson: r\.blanks_json, packetJson: latestPacketJson\(r\) \}\)/);
  assert.match(route, /SELECT rj\.\*, r\.mode, r\.tool_type,/, "the pending feed reads the held facts where the columns exist");
  const tracker = read("client/src/components/ApplicationTracker.jsx");
  assert.match(tracker, /data-held-questions=""/);
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /questions: heldQuestionsFor\(node\)/);
});

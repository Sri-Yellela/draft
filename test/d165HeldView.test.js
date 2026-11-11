// ⭐ D165 (5) [T7] · THE HELD APPLICATION, OPENED IN PLACE — docs/sketches/held-application-sketch.html (approved 11-06,
// saved 11-07, O108). Synthetic rows. d165HeldOpensInPlace · d165AnswerSourcesShown · d165EarlierAttemptsQuiet.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { heldStateOf, heldHeadline, runSteps, answerSource, earlierAttempts } from "../client/src/lib/heldApplication.js";
import { answerRows } from "../client/src/lib/draftHouseTree.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const needs = { kind: "held", why: "question", company: "Acme Rails", question: { question: "What salary should we give Acme Rails" },
  ref: { rows: [{ id: 2, reasonCode: "held", createdAt: 1_800_000_100 }, { id: 1, reasonCode: "resume_unavailable", status: "failed", createdAt: 1_800_000_000, obstacle: "The résumé step didn't run." }] } };
const fail = { kind: "held", why: "held", company: "Acme Rails", ref: { primary: { row: { id: 3, reasonCode: "resume_claim_violation" } }, rows: [{ id: 3 }] } };
const ready = { kind: "approval", company: "Acme Rails", ref: { answerCount: 15, openCount: 1 } };
const sent = { kind: "sent", ring: "sent", company: "Acme Rails", ref: {} };

test("d165HeldOpensInPlace: the four states, in the sketch's words", () => {
  assert.deepEqual([needs, fail, ready, sent].map(heldStateOf), ["needs", "fail", "ready", "sent"]);
  assert.equal(heldStateOf({ kind: "pick", ring: "pick" }), null, "a pick is not an application run — the row keeps its own words");
  assert.equal(heldHeadline(needs).title, "What salary should we give Acme Rails?");
  assert.equal(heldHeadline(needs).eyebrow, "Only you can answer this");
  assert.match(heldHeadline(needs).lead, /never makes up salary, eligibility or legal answers/);
  assert.equal(heldHeadline(fail).title, "The résumé couldn't be made");
  assert.match(heldHeadline(fail).lead, /Nothing was sent, and nothing is left for you to fill/);
  assert.equal(heldHeadline(ready).title, "Everything is filled. Submit when you're happy.");
  assert.equal(heldHeadline(sent).title, "Applied to Acme Rails");
});

test("d165HeldOpensInPlace: every step the run took, each done / now / fail / waiting", () => {
  const st = (n, o) => Object.fromEntries(runSteps(n, o).map(s => [s.id, s.state]));
  assert.deepEqual(runSteps(needs).map(s => s.id), ["posting", "resume", "attached", "filled", "you", "ready", "sent"]);
  // ⭐ A179 F1: "Filled the form" is green only on what the run REPORTED (or a sent application) — never claimed blind.
  // ⭐ A182 (owner 11-11: "the run still shows resume … as green"): no résumé yet (deferred to approval) = waiting, not green.
  assert.deepEqual(st(needs), { posting: "done", resume: "", attached: "", filled: "", you: "now", ready: "", sent: "" });
  assert.deepEqual(st({ ...needs, ref: { rows: [{ id: 2, reasonCode: "held", resumeAvailable: true }] } }).resume, "done", "a made résumé is green");
  assert.deepEqual(st(fail), { posting: "done", resume: "fail", attached: "", filled: "", you: "", ready: "", sent: "" });
  assert.deepEqual(st(ready), { posting: "done", resume: "", attached: "", filled: "", you: "done", ready: "now", sent: "" });
  assert.deepEqual(st(ready, { counts: { filled: 15, total: 16 } }).filled, "done");
  assert.deepEqual(st(sent), { posting: "done", resume: "done", attached: "done", filled: "done", you: "done", ready: "done", sent: "done" });
  assert.equal(runSteps(ready, { counts: { filled: 15, total: 16 } }).find(s => s.id === "filled").meta, "15 of 16");
});

test("d165HeldOpensInPlace: the tracker's opened row draws it in place — no modal, nothing blurred (source pin)", () => {
  const tracker = read("client/src/components/ApplicationTracker.jsx");
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(tracker, /export function RowOpen\(\{ row, pane = null, onPane, paneBody, actions = \[\], onClose, children, held = null \}\)/);
  assert.match(tracker, /\{held\?\.title \|\| row\.headline\}/);
  assert.match(tracker, /data-run-steps=""/);
  assert.match(panel, /held=\{heldFor\(node\)\}>/);
  const css = read("client/src/components/ApplicationTracker.css");
  assert.doesNotMatch(css.slice(at(css, ".trk-steps {"), at(css, ".trk-earlier__d")), /backdrop-filter|blur\(|position:\s*fixed/);
});

test("d165AnswerSourcesShown: each answer says where it came from", () => {
  assert.equal(answerSource({ provenance: "field_map_exact" }), "your Profile");
  assert.equal(answerSource({ provenance: "label_fuzzy" }), "your Profile · matched loosely");
  assert.equal(answerSource({ provenance: "saved_answer" }), "you · saved");
  assert.equal(answerSource({ provenance: "work_history" }), "your résumé");
  assert.equal(answerSource({ provenance: "user_consent_setting" }), "your Auto settings");
  assert.equal(answerSource({ label: "Résumé", value: "Jordan_Rivera_Acme.pdf" }), "tailored by draft");
  assert.equal(answerSource({ asked: true }), "needs you");
  assert.equal(answerSource({ own: true }), "left for you");
  assert.equal(answerSource({ provenance: "something_new" }), "by draft");
  const rows = answerRows([{ label: "Work authorisation", value: "Authorised", provenance: "field_map_exact" }], []);
  assert.equal(rows[0].provenance, "field_map_exact", "answerRows carries the provenance through");
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /data-answer-source=\{[^}]+\}>\{answerSource\(a\)\}<\/small>/);
});

test("d165EarlierAttemptsQuiet: one quiet line for the attempts before the latest, its detail on show", () => {
  const e = earlierAttempts(needs.ref.rows);
  assert.equal(e.count, 1);
  assert.match(e.line, /^1 earlier attempt · .+ · stopped before the résumé was made$/);
  assert.equal(e.detail, "The résumé step didn't run.");
  assert.equal(earlierAttempts([{ id: 9 }]), null, "a single attempt has no earlier line");
  assert.match(earlierAttempts([{ id: 3 }, { id: 2 }, { id: 1 }]).line, /^2 earlier attempts/);
  const tracker = read("client/src/components/ApplicationTracker.jsx");
  assert.match(tracker, /\{showEarlier \? "hide" : "show"\}/);
  assert.match(tracker, /\{showEarlier && <div className="trk-earlier__d"/, "the detail is closed until asked");
});

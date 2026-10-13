// D96 §4 (owner 10-13) — THE SAVED-ANSWER LIFECYCLE, lane J8: "tick once and it is remembered; it is not asked
// again unless the user wants to change it. A change is recorded as a change, and the new value is NOT stored until
// the user acknowledges it again." Migration 164, services/answerLifecycle.js, shared/answerKey.js, the routes in
// routes/savedAnswers.js and the packet (services/applyGatePacket.js packetSavedAnswers).
// Each test was shown red with its rule removed (the lane report lists the mutations). Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { createSavedAnswersRouter } from "../routes/savedAnswers.js";
import { readAnswerStore, effectiveCustomAnswers } from "../services/customAnswers.js";
import {
  acknowledgeAnswer, changeAnswer, deleteLifecycleAnswer, reviewDueOf, recordReview, lifecycleInputs, packetLifecycleAnswers,
  REVIEW_INTERVAL_DAYS,
} from "../services/answerLifecycle.js";
import { packetSavedAnswers, buildGatePacket } from "../services/applyGatePacket.js";
import { copySheetRows } from "../services/manualHandoff.js";
import { answerKeyOf, questionLabelKey, optionsKey, neverFillableReason } from "../shared/answerKey.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const DAY = 86400;
const AUTH_Q = "Are you legally authorized to work in the United States?*";
const YES_NO = ["Yes", "No"];

/** A database at 163 with label-only answers, then 164 — the migration's real path. */
function fixture({ legacy = {} } = {}) {
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  const i = MIGRATIONS.findIndex(m => m.id === "164_saved_answer_lifecycle");
  assert.ok(i > 0, "migration 164 is in the list");
  for (const m of MIGRATIONS.slice(0, i)) d.exec(m.sql);
  d.prepare("INSERT INTO users (id, username, password_hash) VALUES (2, 'ada', 'h'), (3, 'grace', 'h')").run();
  d.prepare("INSERT INTO user_profile (user_id, email, custom_answers) VALUES (2, 'ada@example.com', ?), (3, 'grace@example.com', '{}')")
    .run(JSON.stringify(legacy));
  for (const m of MIGRATIONS.slice(i)) d.exec(m.sql);
  return d;
}

function server(d) {
  const buildAutofillPayload = (profile, _mode, company) => ({
    field_map: { email: profile.email }, handler_map: { email: profile.email },
    custom_answers: effectiveCustomAnswers(readAnswerStore(profile), company),
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.headers["x-user"] || 2) }; next(); });
  app.use(createSavedAnswersRouter({ db: d, requireAuth: (q, r, n) => n(), buildAutofillPayload }));
  const s = app.listen(0);
  const url = `http://127.0.0.1:${s.address().port}`;
  const call = async (method, p, body, user = 2) => {
    const r = await fetch(`${url}${p}`, { method, headers: { "content-type": "application/json", "x-user": String(user) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  return { s, call };
}

/** What a fill for this user at this employer would carry — the packet's own function, over the live store. */
function fillFor(d, userId, company = "Zoom") {
  const profile = d.prepare("SELECT * FROM user_profile WHERE user_id=?").get(userId);
  const { records, legacyAcknowledgedAt } = lifecycleInputs(d, userId);
  return packetSavedAnswers({
    custom_answers: effectiveCustomAnswers(readAnswerStore(profile), company),
    saved_answer_records: records, saved_answers_legacy_at: legacyAcknowledgedAt,
  }).savedAnswers || [];
}
const answerTo = (fill, label) => fill.find(s => questionLabelKey(s.question) === questionLabelKey(label));

test("⛔ one acknowledgement is reused by every later fill — eligibility included — with its date and source", async () => {
  const d = fixture();
  const { s, call } = server(d);
  try {
    const r = await call("POST", "/api/saved-answers/acknowledge", { question: AUTH_Q, answer: "Yes", widgetKind: "radio", options: YES_NO, jobId: "zoom-1" });
    assert.equal(r.status, 200);
    assert.equal(r.body.answer.state, "acknowledged");
    assert.equal(r.body.answer.source, "you_acknowledged");
    assert.equal(r.body.answer.category, "work_auth", "an eligibility answer IS remembered (D96 supersedes the tick-each-time rule)");
    for (const company of ["Zoom", "Figma", "Linear"]) {
      const a = answerTo(fillFor(d, 2, company), AUTH_Q);
      assert.ok(a, `the next fill at ${company} carries it — not asked again`);
      assert.equal(a.answer, "Yes");
      assert.equal(a.source, "you_acknowledged");
      assert.match(a.acknowledgedAt, /^\d{4}-\d\d-\d\dT/, "the panel can say when it was acknowledged");
      assert.equal(a.attesting, true, "the Copy sheet says 'you are attesting to this'");
      assert.equal(a.widgetKind, "radio");
      assert.deepEqual(a.options, ["no", "yes"]);
    }
    const f = await call("GET", "/api/saved-answers/fillable?company=Figma");
    assert.equal(answerTo(f.body.savedAnswers, AUTH_Q).answer, "Yes");
    // The real packet builder, end to end, and the Copy sheet's row.
    const { records, legacyAcknowledgedAt } = lifecycleInputs(d, 2);
    const packet = buildGatePacket({ autofillPayload: { field_map: { email: "ada@example.com" }, handler_map: {}, custom_answers: {},
      saved_answer_records: records, saved_answers_legacy_at: legacyAcknowledgedAt }, applyUrl: "https://zoom.wd5.myworkdayjobs.com/x", jobId: "j1", gateReason: "prepared" });
    assert.equal(answerTo(packet.savedAnswers, AUTH_Q).answer, "Yes");
    const row = copySheetRows(packet).rows.find(x => x.provenance === "saved_answer");
    assert.equal(row.attesting, true);
    assert.equal(row.source, "you_acknowledged");
    assert.ok(row.acknowledgedAt);
  } finally { s.close(); }
});

test("⛔ an edit writes a history row; the new value is NOT stored, the old one is not auto-used, the next fill asks again", async () => {
  const d = fixture();
  const { s, call } = server(d);
  try {
    await call("POST", "/api/saved-answers/acknowledge", { question: AUTH_Q, answer: "Yes", widgetKind: "radio", options: YES_NO });
    const r = await call("POST", "/api/saved-answers/change", { question: AUTH_Q, answer: "No", widgetKind: "radio", options: YES_NO, jobId: "zoom-R19749" });
    assert.equal(r.status, 200);
    assert.equal(r.body.stored, false);
    assert.equal(r.body.servesThisApplicationOnly, true);
    assert.equal(r.body.state, "changed");
    const h = d.prepare("SELECT event, from_value, to_value, job_id FROM answer_history WHERE user_id=2").all();
    assert.deepEqual(h, [{ event: "changed", from_value: "Yes", to_value: "No", job_id: "zoom-R19749" }], "what, from → to, which job");
    assert.equal(d.prepare("SELECT answer FROM saved_answers WHERE user_id=2").pluck().get(), null, "neither value is kept as the answer");
    assert.equal(answerTo(fillFor(d, 2), AUTH_Q), undefined, "the old value is no longer auto-used — the next application asks again");
    const list = (await call("GET", "/api/saved-answers")).body.lifecycle;
    assert.equal(list[0].state, "changed");
    assert.equal(list[0].history[0].to, "No", "Settings shows the history");
    // A change to something never remembered stores nothing.
    const u = await call("POST", "/api/saved-answers/change", { question: "Preferred pronouns", answer: "they/them", widgetKind: "text" });
    assert.equal(u.body.state, "unremembered");
    assert.equal(d.prepare("SELECT COUNT(*) FROM saved_answers WHERE question_key='preferred pronouns'").pluck().get(), 0);
  } finally { s.close(); }
});

test("⛔ re-acknowledging the new value stores it, and it fills again", async () => {
  const d = fixture();
  acknowledgeAnswer(d, 2, { question: AUTH_Q, answer: "Yes", widgetKind: "radio", options: YES_NO });
  changeAnswer(d, 2, { question: AUTH_Q, answer: "No", widgetKind: "radio", options: YES_NO, jobId: "j9" });
  assert.equal(answerTo(fillFor(d, 2), AUTH_Q), undefined);
  acknowledgeAnswer(d, 2, { question: AUTH_Q, answer: "No", widgetKind: "radio", options: YES_NO, source: "you_typed", jobId: "j9" });
  const a = answerTo(fillFor(d, 2), AUTH_Q);
  assert.equal(a.answer, "No");
  assert.equal(a.source, "you_typed");
  assert.deepEqual(d.prepare("SELECT event FROM answer_history WHERE user_id=2 ORDER BY id").pluck().all(), ["changed", "acknowledged"]);
  assert.equal(d.prepare("SELECT COUNT(*) FROM saved_answers WHERE user_id=2").pluck().get(), 1, "the newest acknowledgement IS the row");
});

test("⛔ a terms / consent / privacy / attestation / signature control is never remembered and never returned as fillable", async () => {
  const d = fixture({ legacy: { "I agree to the Terms and Conditions": "Yes", "How did you hear about us?": "A friend" } });
  const { s, call } = server(d);
  const NEVER = [
    ["I agree to the Terms and Conditions", "checkbox", ["I agree"]],
    ["Do you consent to the processing of your personal data?", "radio", YES_NO],
    ["I have read the Privacy Notice", "checkbox", []],
    ["Acknowledgement", "checkbox", ["I certify that the information I have provided is true"]],
    ["Electronic signature", "text", null],
    ["Type your full name to sign", "text", null],
    ["Password", "text", null],
  ];
  try {
    for (const [question, widgetKind, options] of NEVER) {
      assert.ok(neverFillableReason(question, options), `the guard reads "${question}" as never-fillable`);
      const r = await call("POST", "/api/saved-answers/acknowledge", { question, answer: "Yes", widgetKind, options });
      assert.equal(r.status, 422, `"${question}" is refused`);
      assert.equal(r.body.error, "never_remembered");
    }
    // Whatever is stored: a row written straight into the table, and a label-only entry, are still never returned.
    d.prepare(`INSERT INTO saved_answers (user_id, question_key, widget_kind, options_key, question, answer, state, source, acknowledged_at)
      VALUES (2, 'i accept the terms of service', 'checkbox', '', 'I accept the terms of service', 'Yes', 'acknowledged', 'you_typed', 1)`).run();
    const fill = fillFor(d, 2);
    assert.deepEqual(fill.map(x => x.question), ["How did you hear about us?"], "only the ordinary answer travels");
    assert.equal(neverFillableReason("Are you legally authorized to work in the United States?", YES_NO), null, "an eligibility question is not caught");
    assert.equal(neverFillableReason("How did you hear about us?"), null);
  } finally { s.close(); }
});

test("⛔ a material change in the options is a NEW question; re-ordering or a placeholder is not", () => {
  const d = fixture();
  const us = answerKeyOf({ question: "Country*", widgetKind: "select", options: ["Select One", "United States", "Canada"] });
  assert.deepEqual(us, answerKeyOf({ question: "Country", widgetKind: "combobox", options: ["Canada", "United States"] }), "order and the placeholder are not material");
  assert.notDeepEqual(us, answerKeyOf({ question: "Country", widgetKind: "select", options: ["United States", "Mexico"] }), "a different country is");
  assert.notDeepEqual(us, answerKeyOf({ question: "Country", widgetKind: "text" }), "a text box is another question");
  assert.equal(optionsKey(["Yes", "No"]) === optionsKey(["Yes", "No, I will require sponsorship"]), false, "different option wording");
  acknowledgeAnswer(d, 2, { question: "Country", answer: "United States", widgetKind: "select", options: ["United States", "Canada"] });
  const fill = fillFor(d, 2);
  assert.deepEqual(answerTo(fill, "Country").options, ["canada", "united states"], "the key travels so the panel matches the options too");
  acknowledgeAnswer(d, 2, { question: "Country", answer: "Mexico", widgetKind: "select", options: ["United States", "Mexico"] });
  assert.equal(d.prepare("SELECT COUNT(*) FROM saved_answers WHERE user_id=2").pluck().get(), 2, "two questions, two answers");
  assert.equal(d.prepare("SELECT COUNT(*) FROM answer_history").pluck().get(), 0, "the second is not a change of the first");
});

test("⛔ the trailing asterisk and surrounding punctuation are ignored: 'First Name*' is an EXACT match", () => {
  for (const l of ["First Name*", "First Name *", "* First Name:", "First Name (required)", "first name", "First Name –", "First Name;", "“First Name”"]) {
    assert.equal(questionLabelKey(l), "first name", l);
  }
  assert.notEqual(questionLabelKey("Do you require sponsorship?"), questionLabelKey("Do you not require sponsorship?"), "every inner word survives");
  const d = fixture();
  acknowledgeAnswer(d, 2, { question: "First Name*", answer: "Ada", widgetKind: "text" });
  acknowledgeAnswer(d, 2, { question: "First Name", answer: "Ada", widgetKind: "text" });
  assert.equal(d.prepare("SELECT COUNT(*) FROM saved_answers WHERE user_id=2").pluck().get(), 1);
});

test("⛔ delete → the next fill asks again, and the answer's history goes with it", async () => {
  const d = fixture();
  const { s, call } = server(d);
  try {
    const { body } = await call("POST", "/api/saved-answers/acknowledge", { question: AUTH_Q, answer: "Yes", widgetKind: "radio", options: YES_NO });
    changeAnswer(d, 2, { question: AUTH_Q, answer: "No", widgetKind: "radio", options: YES_NO });
    acknowledgeAnswer(d, 2, { question: AUTH_Q, answer: "No", widgetKind: "radio", options: YES_NO });
    assert.ok(answerTo(fillFor(d, 2), AUTH_Q));
    assert.equal((await call("DELETE", `/api/saved-answers/lifecycle/${body.answer.id}`)).status, 200);
    assert.equal(answerTo(fillFor(d, 2), AUTH_Q), undefined, "asked again");
    assert.equal(d.prepare("SELECT COUNT(*) FROM answer_history WHERE user_id=2").pluck().get(), 0, "no invisible copy of the values");
    assert.equal((await call("DELETE", `/api/saved-answers/lifecycle/${body.answer.id}`)).status, 404);
  } finally { s.close(); }
});

test("⛔ the 90-day review reminder: quiet, once in the panel, and 'Still right' resets it", async () => {
  const d = fixture();
  const T = 1_760_000_000;
  acknowledgeAnswer(d, 2, { question: AUTH_Q, answer: "Yes", widgetKind: "radio", options: YES_NO, now: T });
  acknowledgeAnswer(d, 2, { question: "How did you hear about us?", answer: "A friend", widgetKind: "text", now: T });
  assert.equal(reviewDueOf(d, 2, { now: T + (REVIEW_INTERVAL_DAYS - 1) * DAY }).due, false);
  const due = reviewDueOf(d, 2, { now: T + REVIEW_INTERVAL_DAYS * DAY });
  assert.equal(due.due, true);
  assert.equal(due.showInPanel, true);
  assert.deepEqual(due.categories, ["work_auth"], "eligibility and disclosure answers only");
  assert.equal(due.count, 1);
  assert.equal(due.lastReviewedAt, new Date(T * 1000).toISOString(), "'You last reviewed … in July'");
  const shown = recordReview(d, 2, "dismissed", { now: T + REVIEW_INTERVAL_DAYS * DAY + 5 });
  assert.equal(shown.due, true, "Settings still says it");
  assert.equal(shown.showInPanel, false, "the panel says it once");
  const ok = recordReview(d, 2, "confirmed", { now: T + 100 * DAY });
  assert.equal(ok.due, false);
  assert.equal(reviewDueOf(d, 3), null, "nothing to review: no reminder at all");
  // A text answer that is not eligibility never asks for review.
  const d2 = fixture();
  acknowledgeAnswer(d2, 2, { question: "How did you hear about us?", answer: "A friend", widgetKind: "text", now: T });
  assert.equal(reviewDueOf(d2, 2, { now: T + 400 * DAY }), null);
  const { s, call } = server(d);
  try {
    const r = await call("GET", "/api/saved-answers/review");
    assert.equal(r.status, 200);
    assert.ok("reviewDue" in r.body);
    assert.equal((await call("POST", "/api/saved-answers/review", { action: "nope" })).status, 400);
  } finally { s.close(); }
});

test("⛔ another user's answers are never visible, editable or deletable", async () => {
  const d = fixture();
  const { s, call } = server(d);
  try {
    const { body } = await call("POST", "/api/saved-answers/acknowledge", { question: AUTH_Q, answer: "Yes", widgetKind: "radio", options: YES_NO }, 2);
    const other = await call("GET", "/api/saved-answers", null, 3);
    assert.deepEqual(other.body.lifecycle, []);
    assert.deepEqual((await call("GET", "/api/saved-answers/fillable", null, 3)).body.savedAnswers, []);
    assert.equal((await call("PUT", `/api/saved-answers/lifecycle/${body.answer.id}`, { answer: "No" }, 3)).status, 404);
    assert.equal((await call("DELETE", `/api/saved-answers/lifecycle/${body.answer.id}`, null, 3)).status, 404);
    assert.equal((await call("POST", "/api/saved-answers/change", { question: AUTH_Q, answer: "No", widgetKind: "radio", options: YES_NO }, 3)).body.state, "unremembered");
    assert.equal(answerTo(fillFor(d, 2), AUTH_Q).answer, "Yes", "user 2's answer untouched");
    assert.equal(fillFor(d, 3).length, 0);
  } finally { s.close(); }
});

test("⛔ legacy answers still fill — acknowledged at migration time, source legacy — and a change retires them", async () => {
  const d = fixture({ legacy: { "How did you hear about {company}?": "A friend", [AUTH_Q.replace("*", "")]: "Yes" } });
  assert.ok(d.prepare("SELECT custom_answers_acknowledged_at FROM user_profile WHERE user_id=2").pluck().get(), "dated by migration 164");
  assert.equal(d.prepare("SELECT custom_answers_acknowledged_at FROM user_profile WHERE user_id=3").pluck().get(), null, "an empty store is not dated");
  const fill = fillFor(d, 2, "Zoom");
  const heard = answerTo(fill, "How did you hear about Zoom?");
  assert.equal(heard.answer, "A friend");
  assert.equal(heard.source, "legacy");
  assert.ok(heard.acknowledgedAt);
  const { s, call } = server(d);
  try {
    const list = (await call("GET", "/api/saved-answers")).body;
    assert.ok(list.entries.every(e => e.state === "acknowledged" && e.source === "legacy" && e.acknowledgedAt));
    // A change from the page retires the label-only entry: history written, not auto-used, the JSON no longer has it.
    const r = await call("POST", "/api/saved-answers/change", { question: AUTH_Q, answer: "No", widgetKind: "radio", options: YES_NO, jobId: "j2" });
    assert.equal(r.body.state, "changed");
    assert.equal(answerTo(fillFor(d, 2), AUTH_Q), undefined);
    assert.deepEqual(Object.keys(readAnswerStore(d.prepare("SELECT * FROM user_profile WHERE user_id=2").get()).answers), ["How did you hear about {company}?"]);
    assert.deepEqual(d.prepare("SELECT from_value, to_value FROM answer_history").all(), [{ from_value: "Yes", to_value: "No" }]);
  } finally { s.close(); }
});

test("migration 164 is additive, byte-identical in both runners, and the routes and packet are wired", () => {
  const blk = (f) => { const src = read(f); const i = at(src, 'id: "164_saved_answer_lifecycle"'); return src.slice(i, at(src, "`,", i)); };
  assert.equal(blk("server.js"), blk("scripts/migrations.js"));
  assert.doesNotMatch(blk("server.js"), /\bDROP\b|DELETE FROM/i, "additive only");
  const apply = read("routes/apply.js");
  assert.match(apply, /packet: withLiveSavedAnswers\(userId, body, row\.job_id\)/, "a released packet carries the answers as they stand now");
  assert.equal((apply.match(/withSavedAnswerRecords\(userId,/g) || []).length >= 4, true, "every packet builder hangs the lifecycle rows on its payload");
  assert.equal(packetLifecycleAnswers({ legacy: { Q: "A" } }).length, 1);
});

test("Settings → Saved answers shows each remembered answer's state, date and history, with Edit, Delete and the 90-day line", () => {
  const ui = read("client/src/panels/SavedAnswersPanel.jsx");
  const section = ui.slice(at(ui, "data-lifecycle-answers"), at(ui, "{/* ── The list ── */}"));
  assert.match(section, /data-lifecycle-row=\{row\.state\}/, "every keyed answer is listed with its state");
  assert.match(section, /markStyle\(row\.state === "acknowledged" \? C\.SUCCESS : C\.WARNING\)/, "the state is a MARK (D60), in theme tokens");
  assert.match(section, /acknowledged \$\{answerDate\(row\.acknowledgedAt\)\}/, "the date acknowledged");
  assert.match(section, /row\.history\.map\(/, "the history");
  assert.match(section, /You are attesting to this/);
  assert.match(ui, /api\(`\/api\/saved-answers\/lifecycle\/\$\{editingKeyed\.id\}`, \{ method: "PUT"/, "Edit");
  assert.match(ui, /api\(`\/api\/saved-answers\/lifecycle\/\$\{row\.id\}`, \{ method: "DELETE" \}\)/, "Delete");
  assert.match(ui, /\{reviewLine\(reviewDue\) && \(/, "the quiet review line");
  assert.match(ui, /JSON\.stringify\(\{ action: "confirmed" \}\)/, "Still right");
  assert.doesNotMatch(section, /borderRadius:\s*(?:999|"50%")|#[0-9a-f]{3,6}\b/i, "no capsule, no colour literal");
});

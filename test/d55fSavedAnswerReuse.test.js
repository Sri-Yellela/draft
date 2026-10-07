import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";

// D55 (f) piece 2 — saved answers that actually get reused (docs/AUTOFILL_TARGET.md §8.1 rows 4–5):
// normalised text, the employer templated as {company}, matched on the normalised template.
// ⛔ Never fuzzy for eligibility, EEO or opt-ins — D36's lesson: `work_authorization` once
// substring-matched an INVERTED sponsorship question.

import { buildAnswers, PROVENANCE } from "../services/applyAutomation.js";
import { rememberAnswer, resolveForCompany, resolvesQuestion, readAnswerStore } from "../services/customAnswers.js";
import {
  normaliseQuestion, templateQuestion, questionKey, isOptInQuestion, isNegativeAnswer, companyNameVariants,
} from "../shared/savedAnswers.js";
import { createSavedAnswersRouter } from "../routes/savedAnswers.js";

const field = (label, over = {}) => ({
  field_id: "q", name: "q", type: "text", label, handler_type: null, is_required: true, options: [], ...over,
});
const YES_NO = [{ value: "Yes", label: "Yes" }, { value: "No", label: "No" }];
const resolve = (label, custom, over = {}, payload = {}) =>
  buildAnswers([field(label, over)], { field_map: {}, handler_map: {}, custom_answers: custom, ...payload })[0];

// ── Normalisation and the template ──────────────────────────────────────────────────────────────

test("normalisation drops what is not a word — and nothing that is", () => {
  assert.equal(normaliseQuestion("  Why Figma? * "), normaliseQuestion("why figma"));
  assert.equal(normaliseQuestion("Phone (required)"), "phone");
  assert.equal(normaliseQuestion("Don’t you?"), normaliseQuestion("Don't you"));
  assert.notEqual(normaliseQuestion("Do you require sponsorship?"), normaliseQuestion("Do you not require sponsorship?"));
});

test("the employer's name becomes {company}, whole words only, legal suffix or not", () => {
  assert.equal(templateQuestion("Have you worked for Figma before?", "Figma"), "Have you worked for {company} before?");
  assert.equal(templateQuestion("Why Stripe? Stripe's mission", "Stripe, Inc."), "Why {company}? {company}'s mission");
  assert.equal(templateQuestion("Check your Inbox", "Box"), "Check your Inbox", "not inside another word");
  assert.equal(templateQuestion("Why us?", null), "Why us?");
  assert.deepEqual(companyNameVariants("Acme Corp."), ["Acme Corp.", "Acme"]);
  assert.equal(questionKey("Have you worked for LINEAR before? *", "Linear"), "have you worked for {company} before");
});

test("ONE saved answer fills the same question at another employer, by exact words after normalising", () => {
  const store = { answers: { "From where do you intend to work?": "Boston, MA", "Have you ever been a contractor for {company}?": "No" }, overrides: {} };
  const { answers } = resolveForCompany(store, "Linear");
  const a = resolve("From where do you intend to work? *", answers);
  assert.equal(a.value, "Boston, MA");
  assert.equal(a.provenance, PROVENANCE.CUSTOM_ANSWER);
  const b = resolve("Have you ever been a contractor for Linear?", answers, { type: "select", options: YES_NO });
  assert.equal(b.value, "No");
  assert.equal(resolvesQuestion(answers, "From where do you intend to work? *"), true);
  assert.equal(resolvesQuestion(answers, "From where do you intend to relocate?"), false);
});

// ── ⛔ Never fuzzy for eligibility, EEO or opt-ins ─────────────────────────────────────────────────

test("⛔ an ELIGIBILITY question is never matched by a saved answer to a different question", () => {
  const saved = { "Are you authorized to work in the US": "Yes" };
  const a = resolve("Are you authorized to work in the US without requiring sponsorship now or in the future?", saved,
    { type: "select", options: YES_NO });
  assert.equal(a?.value ?? null, null, "a containment hit must not answer an eligibility question");
  assert.ok(a.refusals.some(r => r.startsWith("custom:eligibility_class")), JSON.stringify(a.refusals));

  // D36's inversion: an answer to "require sponsorship" never answers "NOT require sponsorship".
  const inv = resolve("Will you not require sponsorship?", { "Will you require sponsorship?": "Yes" }, { type: "select", options: YES_NO });
  assert.equal(inv?.value ?? null, null);

  // The candidate's answer to EXACTLY this question still fills it.
  const exact = resolve("Are you authorized to work in the US? *", saved, { type: "select", options: YES_NO });
  assert.equal(exact.value, "Yes");
});

test("⛔ an EEO question is never matched by containment", () => {
  const a = resolve("What is your gender identity, as defined by the EEOC?", { "What is your gender": "Female" },
    { type: "select", options: [{ value: "f", label: "Female" }, { value: "m", label: "Male" }] });
  assert.equal(a?.value ?? null, null);
  assert.ok(a.refusals.some(r => r.includes("eligibility_class:eeo")), JSON.stringify(a.refusals));
});

test("⛔ never opt the candidate in: only their own exact No answers an opt-in", () => {
  const Q = "Would you like to receive WhatsApp messages from our recruiting team?";
  assert.equal(isOptInQuestion(Q), true);
  assert.equal(isOptInQuestion("I agree to the privacy policy"), false, "required consent is not an opt-in");

  const no = resolve(Q, { [Q]: "No" }, { type: "select", options: YES_NO });
  assert.equal(no.value, "No", "the candidate's own No is placed");

  const yes = resolve(Q, { [Q]: "Yes" }, { type: "select", options: YES_NO });
  assert.equal(yes?.value ?? null, null, "a stated Yes is still never placed");
  assert.ok(yes.refusals.includes("opt_in:never_opt_in"));

  const contained = resolve(`${Q} (optional)`.replace("?", " about new roles?"), { "receive WhatsApp messages": "No" }, { type: "checkbox" });
  assert.equal(contained?.value ?? null, null, "containment never answers an opt-in");

  const viaProfile = buildAnswers([field("Subscribe to job alerts by email", { type: "checkbox" })],
    { field_map: { email: "ada@example.com" }, handler_map: {}, custom_answers: {} })[0];
  assert.equal(viaProfile?.value ?? null, null, "a profile key matched on the label never ticks an opt-in");

  assert.equal(isNegativeAnswer("No thanks"), true);
  assert.equal(isNegativeAnswer("Yes"), false);
});

// ── rememberAnswer ──────────────────────────────────────────────────────────────────────────────

test("remember 'all' templates the employer and keeps ONE entry per question", () => {
  let store = { answers: { "have you worked for {company} before": "Yes" }, overrides: {} };
  const r = rememberAnswer(store, { question: "Have you worked for Figma before?", answer: "No", company: "Figma" });
  assert.deepEqual(r.saved, { scope: "all", question: "Have you worked for {company} before?", templated: true });
  assert.deepEqual(r.store.answers, { "Have you worked for {company} before?": "No" }, "the near-duplicate was replaced");
});

test("remember 'company' — and a motivation question is ALWAYS narrowed to the employer", () => {
  const store = { answers: {}, overrides: {} };
  const why = rememberAnswer(store, { question: "Why do you want to join Figma?", answer: "Because…", company: "Figma", scope: "all" });
  assert.equal(why.saved.scope, "company");
  assert.equal(why.saved.narrowed, "motivation_needs_own_words");
  assert.deepEqual(why.store.answers, {}, "never a generic answer interpolated per employer");
  assert.deepEqual(why.store.overrides, { figma: { "Why do you want to join Figma?": "Because…" } });
  assert.throws(() => rememberAnswer(store, { question: "Q", answer: "A", scope: "company" }), { code: "company_required" });
  assert.throws(() => rememberAnswer(store, { question: "Q", answer: " " }), { code: "answer_required" });
  assert.throws(() => rememberAnswer(store, { question: "Q".repeat(501), answer: "A" }), { code: "too_long" });
});

test("Draft House asks 'Save this answer for next time?' per question, and sends the choice", async () => {
  const fs = await import("node:fs");
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8").replace(/\r\n/g, "\n");
  const ctx = fs.readFileSync("client/src/contexts/AutoApplyContext.jsx", "utf8").replace(/\r\n/g, "\n");
  assert.match(panel, /data-save-for-next-time=""[\s\S]{0,600}checked=\{questionRemember\[q\.question\] !== false\}/);
  assert.match(panel, /Save this answer for next time/);
  assert.match(ctx, /remember\[q\] = questionRemember\[q\] !== false/);
  assert.match(ctx, /answers,\n\s+remember,/, "the remember map goes to /api/apply/answers");
});

// ── The routes ──────────────────────────────────────────────────────────────────────────────────

function server() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, current_company TEXT,
    custom_answers TEXT NOT NULL DEFAULT '{}', custom_answer_overrides TEXT NOT NULL DEFAULT '{}');`);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use(createSavedAnswersRouter({ db, requireAuth: (q, r, n) => n(), buildAutofillPayload: () => ({}) }));
  const s = app.listen(0);
  return { db, s, url: `http://127.0.0.1:${s.address().port}` };
}
const post = (url, p, b) => fetch(`${url}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

test("POST /api/saved-answers/remember stores the candidate's answer for next time", async () => {
  const { db, s, url } = server();
  try {
    const r = await post(url, "/api/saved-answers/remember", { question: "How did you hear about Figma?", answer: "A friend", company: "Figma" });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).saved.question, "How did you hear about {company}?");
    const store = readAnswerStore(db.prepare("SELECT * FROM user_profile WHERE user_id=1").get());
    assert.deepEqual(store.answers, { "How did you hear about {company}?": "A friend" });
    assert.equal((await post(url, "/api/saved-answers/remember", { question: "Q", answer: "A", scope: "x" })).status, 400);
    assert.equal((await post(url, "/api/saved-answers/remember", { question: "", answer: "A" })).status, 400);
  } finally { s.close(); }
});

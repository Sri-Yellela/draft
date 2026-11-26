import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";

// D55 (f) piece 4 — Settings → Saved answers: list / edit / delete, export JSON + CSV, import through
// the five guards (dry run first), and "Test a question" (docs/AUTOFILL_TARGET.md §8.1 rows 6–7).

import { createSavedAnswersRouter } from "../routes/savedAnswers.js";
import { readAnswerStore } from "../services/customAnswers.js";
import { parseCsv, exportCsv } from "../services/savedAnswersManage.js";
import { SAVED_ANSWER_LIMITS } from "../shared/savedAnswers.js";

function server({ answers = {}, overrides = {}, current_company = null } = {}) {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, current_company TEXT, email TEXT,
    custom_answers TEXT NOT NULL DEFAULT '{}', custom_answer_overrides TEXT NOT NULL DEFAULT '{}');`);
  db.prepare("INSERT INTO user_profile (user_id, current_company, email, custom_answers, custom_answer_overrides) VALUES (1, ?, 'ada@example.com', ?, ?)")
    .run(current_company, JSON.stringify(answers), JSON.stringify(overrides));
  // The real resolver's input shape, minimal: buildAutofillPayload proper lives in server.js.
  const buildAutofillPayload = (profile, _mode, company) => ({
    field_map: { email: profile.email }, handler_map: { email: profile.email },
    custom_answers: Object.fromEntries(Object.entries(readAnswerStore(profile).answers)
      .map(([q, a]) => [q.replace(/\{company\}/gi, company || "{company}"), a])),
  });
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use(createSavedAnswersRouter({ db, requireAuth: (q, r, n) => n(), buildAutofillPayload }));
  const s = app.listen(0);
  const url = `http://127.0.0.1:${s.address().port}`;
  const call = (method, p, body) => fetch(`${url}${p}`, {
    method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const store = () => readAnswerStore(db.prepare("SELECT * FROM user_profile WHERE user_id=1").get());
  return { s, call, store };
}

test("list, edit (rename), delete", async () => {
  const { s, call, store } = server({ answers: { "How did you hear about us?": "LinkedIn" }, overrides: { figma: { "Why do you want to join Figma?": "Mine" } } });
  try {
    const list = await (await call("GET", "/api/saved-answers")).json();
    assert.equal(list.entries.length, 2);
    assert.equal(list.entries.find(e => e.company === "figma").kind.motivation, true);
    assert.equal(list.limits.maxEntries, SAVED_ANSWER_LIMITS.maxEntries);

    assert.equal((await call("PUT", "/api/saved-answers", { previousQuestion: "How did you hear about us?", question: "How did you hear about {company}?", answer: "A friend" })).status, 200);
    assert.deepEqual(store().answers, { "How did you hear about {company}?": "A friend" });
    assert.equal((await call("PUT", "/api/saved-answers", { previousQuestion: "nope", question: "Q", answer: "A" })).status, 404);

    assert.equal((await call("DELETE", "/api/saved-answers", { question: "Why do you want to join Figma?", company: "figma" })).status, 200);
    assert.deepEqual(store().overrides, {});
    assert.equal((await call("DELETE", "/api/saved-answers", { question: "missing" })).status, 404);
  } finally { s.close(); }
});

test("export as JSON and as CSV — and the CSV cannot run a formula in a spreadsheet", async () => {
  const { s, call } = server({ answers: { "Salary, expected?": "=HYPERLINK(\"x\")", "Pronouns": "she/her" } });
  try {
    const json = await (await call("GET", "/api/saved-answers/export")).json();
    assert.equal(json.kind, "draft-saved-answers");
    assert.equal(json.answers["Pronouns"], "she/her");
    const r = await call("GET", "/api/saved-answers/export?format=csv");
    assert.match(r.headers.get("content-type"), /text\/csv/);
    const rows = parseCsv(await r.text());
    assert.deepEqual(rows[0], ["question", "answer", "company"]);
    const salary = rows.find(x => x[0] === "Salary, expected?");
    assert.equal(salary[1], "'=HYPERLINK(\"x\")", "a leading = is neutralised");
  } finally { s.close(); }
});

test("⛔ IMPORT GUARDS: eligibility, EEO, opt-ins, profile keys and keyword rules are refused; a dry run writes nothing", async () => {
  const { s, call, store } = server({ answers: { "How did you hear about us?": "LinkedIn" } });
  try {
    const content = JSON.stringify([
      { question: "Are you legally authorized to work in the United States?", answer: "Yes" },
      { question: "Will you now or in the future require sponsorship?", answer: "No" },
      { question: "What is your gender?", answer: "Female" },
      { question: "Sign me up for the talent community newsletter", answer: "Yes" },
      { question: "work_authorization", answer: "US citizen" },
      { question: "Years of experience?", answer: "5", keywords: ["years", "experience"], appearances: 2 },
      { question: "From where do you intend to work?", answer: "Boston" },
      { question: "From where do you intend to work", answer: "Remote" },
      { question: "How did you hear about us?", answer: "A friend" },
      { question: 42, answer: "x" },
    ]);
    const dry = await (await call("POST", "/api/saved-answers/import", { format: "json", content })).json();
    assert.equal(dry.applied, false);
    assert.equal(dry.dryRun, true);
    const reason = (row) => dry.rejected.find(r => r.row === row)?.reason;
    assert.match(reason(1), /^protected_class:eligibility:work_auth/);
    assert.match(reason(2), /^protected_class:eligibility:sponsorship/);
    assert.equal(reason(3), "protected_class:eeo");
    assert.equal(reason(4), "protected_class:opt_in");
    assert.match(reason(5), /^protected_class:/);
    assert.match(reason(6), /^invalid_shape:fuzzy_rule_not_supported/);
    assert.equal(reason(8), "duplicate", "the same question normalised");
    assert.equal(reason(9), "conflict:existing_answer_kept");
    assert.match(reason(10), /^invalid_shape/);
    assert.deepEqual(dry.accepted.map(a => a.question), ["From where do you intend to work?"]);
    assert.deepEqual(store().answers, { "How did you hear about us?": "LinkedIn" }, "a dry run writes nothing");

    const applied = await (await call("POST", "/api/saved-answers/import", { format: "json", content, apply: true, overwrite: true })).json();
    assert.equal(applied.applied, true);
    assert.equal(store().answers["How did you hear about us?"], "A friend", "overwrite replaces the conflict");
    assert.equal(store().answers["From where do you intend to work?"], "Boston");
    assert.equal(Object.keys(store().answers).some(q => /authori|sponsor|gender|newsletter/i.test(q)), false);
  } finally { s.close(); }
});

test("import guards: size limits, CSV columns, and a CSV keyword column", async () => {
  const { s, call } = server();
  try {
    const big = "x".repeat(SAVED_ANSWER_LIMITS.maxImportBytes + 1);
    assert.equal((await call("POST", "/api/saved-answers/import", { format: "csv", content: big })).status, 413);
    const many = JSON.stringify(Array.from({ length: SAVED_ANSWER_LIMITS.maxEntries + 1 }, (_, i) => ({ question: `Q${i}`, answer: "a" })));
    assert.equal((await call("POST", "/api/saved-answers/import", { format: "json", content: many })).status, 413);
    const long = JSON.stringify([{ question: "Q".repeat(SAVED_ANSWER_LIMITS.maxQuestionChars + 1), answer: "a" }]);
    assert.equal((await (await call("POST", "/api/saved-answers/import", { format: "json", content: long })).json()).rejected[0].reason, "too_large:entry");
    assert.equal((await call("POST", "/api/saved-answers/import", { format: "csv", content: "q,a\nx,y\n" })).status, 400);
    const kw = await (await call("POST", "/api/saved-answers/import", { format: "csv", content: "question,answer,keywords\r\nWhy?,Because,why\r\n" })).json();
    assert.match(kw.rejected[0].reason, /fuzzy_rule_not_supported/);
    const ok = await (await call("POST", "/api/saved-answers/import", { format: "csv", content: 'question,answer,company\r\n"Notice period, in weeks?",2,\r\nWhy Acme?,Mine,Acme\r\n', apply: true })).json();
    assert.deepEqual(ok.accepted, [{ question: "Notice period, in weeks?", answer: "2", company: null }, { question: "Why Acme?", answer: "Mine", company: "Acme" }]);
  } finally { s.close(); }
});

test("TEST A QUESTION: which saved answer matches and why — or 'no match: it would stop'", async () => {
  const { s, call } = server({
    answers: { "Have you ever been a contractor for {company}?": "No", "Are you authorized to work in the US": "Yes", "Why do you want to join {company}?": "" },
    current_company: "Acme",
  });
  try {
    const t = async (question, company = "Figma") => (await call("POST", "/api/saved-answers/test", { question, company })).json();

    const tpl = await t("Have you ever been a contractor for Figma? *");
    assert.equal(tpl.outcome, "fills");
    assert.equal(tpl.value, "No");
    assert.deepEqual(tpl.matched, { source: "template", stored: "Have you ever been a contractor for {company}?", tier: "exact" });
    assert.match(tpl.why[0], /exact words/);

    const elig = await t("Are you authorized to work in the US without sponsorship?");
    assert.equal(elig.outcome, "stops", "⛔ an eligibility question is never matched by containment");
    assert.match(elig.why[0], /No match: it would stop/);
    assert.ok(elig.why.some(w => /only your answer to exactly this wording/.test(w)), elig.why.join(" | "));

    const worked = await t("Have you worked for Acme before?", "Acme");
    assert.equal(worked.outcome, "fills");
    assert.equal(worked.value, "Yes");
    assert.equal(worked.matched.source, "work_history");

    const none = await t("What is your favourite colour?");
    assert.equal(none.outcome, "stops");
    assert.deepEqual(none.why, ["No match: it would stop."]);

    const email = await t("Email");
    assert.equal(email.matched.source, "profile", "a standard field still fills from the profile, and says so");

    assert.equal((await call("POST", "/api/saved-answers/test", { question: " " })).status, 400);
  } finally { s.close(); }
});

test("Settings → Saved answers is reachable, and the panel has all four tools", () => {
  const app = fs.readFileSync("client/src/App.jsx", "utf8").replace(/\r\n/g, "\n");
  // (D93 added "customise" after it, with its comment line.)
  // 45o D180 P1 (4aed9e88) added "network" (with its comment) after customise (pin moved on purpose).
  // 46f added "feed", "messages" (with its comment) after network (pin moved on purpose).
  assert.match(app, /"account",\n(?:\s*\/\/.*\n)*\s*"saved-answers",\n(?:\s*\/\/.*\n)*(?:\s*"customise",\n)?(?:\s*\/\/.*\n)*(?:\s*"network",\n)?(?:\s*\/\/.*\n)*(?:\s*"feed", "messages",\n)?\s*\.\.\.ROUTE_ONLY_TABS\]\)/, "saved-answers is navigable");
  // ⭐ D167 (changed on purpose): Saved answers is Profile → Saved answers — /app/saved-answers lands on /app/profile/answers.
  assert.match(fs.readFileSync("client/src/pages/profile/profilePanels.js", "utf8"), /"saved-answers": "answers",/);
  assert.match(fs.readFileSync("client/src/pages/profile/ProfilePage.jsx", "utf8"), /<ProfilePanel section="answers"[^\n]*\/>\r?\n\s+<SavedAnswersPanel \/>/);
  // ⛔ 47j w1-shell (changed on purpose): the profile menu's Saved answers link left with TopBar's ProfileMenuPanel (nothing
  // opened it since D197 #1); the dock peek's Saved answers is the way in.
  const nav = fs.readFileSync("client/src/components/AppNav.jsx", "utf8");
  assert.match(nav, /\{link\("answers", "Saved answers"\)\}/);
  const panel = fs.readFileSync("client/src/panels/SavedAnswersPanel.jsx", "utf8");
  for (const p of ["/api/saved-answers\"", "/api/saved-answers/export?format=", "/api/saved-answers/import", "/api/saved-answers/test", "data-test-a-question"]) {
    assert.ok(panel.includes(p), p);
  }
  assert.match(panel, /method: "DELETE"/);
  assert.match(panel, /method: "PUT"/);
  assert.equal(exportCsv({ answers: {}, overrides: {} }), "question,answer,company\r\n");
});

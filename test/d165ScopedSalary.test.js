import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { createSavedAnswersRouter } from "../routes/savedAnswers.js";
import { buildAnswers } from "../services/applyAutomation.js";
import {
  isSalaryQuestion, locationKeyOf, rememberScoped, resolveScoped, specificity, withScopedAnswers, readScoped, forgetScoped,
} from "../services/scopedAnswers.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";

// ⛔ D165 (3) · A SAVED SALARY ANSWER IS SCOPED PER ROLE + LOCATION (D165 R2: "scoped: per role / location for salary,
// global for eligibility"). Synthetic people and synthetic numbers only.

const SALARY_Q = "Salary Requirement";

test("d165 the salary class: asking for the person's pay is scoped; a yes/no about pay and eligibility are not", () => {
  for (const q of ["Salary Requirement", "What are your salary expectations?", "Desired compensation", "Expected annual base salary (USD)", "Salary"])
    assert.equal(isSalaryQuestion(q), true, q);
  for (const q of ["Are you comfortable with the posted pay range?", "Are you authorized to work in the US?",
    "Will you require sponsorship?", "Why do you want to join Acme?", "Years of professional experience"])
    assert.equal(isSalaryQuestion(q), false, q);
  assert.equal(locationKeyOf("San Francisco, CA"), "us");
  assert.equal(locationKeyOf("London, United Kingdom"), "non_us");
  assert.equal(locationKeyOf(null), null);
});

test("d165SalaryScopedPerRoleLocation: the fill path picks the MOST SPECIFIC matching scope", () => {
  let list = [];
  const t0 = new Date("2026-11-06T10:00:00Z");
  list = rememberScoped(list, { question: SALARY_Q, answer: "100000", now: t0 }).list;                                   // open
  list = rememberScoped(list, { question: SALARY_Q, answer: "120000", locationKey: "us", now: t0 }).list;                // location
  list = rememberScoped(list, { question: SALARY_Q, answer: "140000", roleKey: "full_stack", now: t0 }).list;            // role
  list = rememberScoped(list, { question: SALARY_Q, answer: "150000", roleKey: "full_stack", locationKey: "us", now: t0 }).list;
  list = rememberScoped(list, { question: SALARY_Q, answer: "90000", roleKey: "data_scientist", locationKey: "non_us", now: t0 }).list;
  assert.equal(list.length, 5, "one entry per scope — another scope is never overwritten");

  const pick = (scope) => resolveScoped(list, scope).salary?.answer ?? null;
  assert.equal(pick({ roleKey: "full_stack", locationKey: "us" }), "150000", "role + location");
  assert.equal(pick({ roleKey: "full_stack", locationKey: "non_us" }), "140000", "role beats open when the location differs");
  assert.equal(pick({ roleKey: "backend", locationKey: "us" }), "120000", "location when the role has no entry");
  assert.equal(pick({ roleKey: "backend", locationKey: null }), "100000", "open when nothing narrower matches");
  assert.equal(pick({ roleKey: "data_scientist", locationKey: "non_us" }), "90000");
  assert.equal(specificity({ roleKey: "data_scientist", locationKey: null }, { roleKey: "full_stack" }), -1,
    "an entry naming another role never matches");
  assert.ok(specificity({ roleKey: "r", locationKey: null }, { roleKey: "r" }) > specificity({ roleKey: null, locationKey: "us" }, { locationKey: "us" }),
    "role-only outranks location-only");

  // Saving again for the same scope REPLACES that scope's answer only.
  const again = rememberScoped(list, { question: "salary requirement ", answer: "155000", roleKey: "full_stack", locationKey: "us" });
  assert.equal(again.list.length, 5);
  assert.equal(resolveScoped(again.list, { roleKey: "full_stack", locationKey: "us" }).salary.answer, "155000");

  // Through the real resolver: the salary field (by handler or by its exact label) gets the scoped answer.
  const payload = { field_map: {}, handler_map: { salary: "110000" }, custom_answers: { "Are you authorized to work in the US?": "Yes" } };
  const filled = withScopedAnswers(payload, list, { roleKey: "full_stack", locationKey: "us" });
  assert.equal(filled.handler_map.salary, "150000", "a role/location match beats the Profile's one desired_salary");
  assert.equal(filled.custom_answers["Are you authorized to work in the US?"], "Yes", "the global answers are untouched");
  const field = { field_id: "s", name: "s", type: "text", label: "Salary Requirement *", handler_type: null, is_required: true, options: [] };
  assert.equal(buildAnswers([field], filled)[0].value, "150000");
  const other = withScopedAnswers(payload, list, { roleKey: "data_scientist", locationKey: "non_us" });
  assert.equal(buildAnswers([field], other)[0].value, "90000", "a different role + location fills ITS answer");
  // An open-scope entry never overrides the Profile's salary; it fills only when the Profile has none.
  const openOnly = [{ question: SALARY_Q, answer: "100000", kind: "salary", roleKey: null, locationKey: null, savedAt: null }];
  assert.equal(withScopedAnswers(payload, openOnly, { roleKey: "x" }).handler_map.salary, "110000");
  assert.equal(withScopedAnswers({ ...payload, handler_map: {} }, openOnly, { roleKey: "x" }).handler_map.salary, "100000");
  assert.deepEqual(readScoped({ custom_answer_scoped: "not json" }), [], "a malformed column reads as none — a fill never throws");
  assert.equal(forgetScoped(list, { question: SALARY_Q, roleKey: "full_stack", locationKey: "us" }).length, 4);
});

// ── over real HTTP: POST /api/apply/answers saves with scope; GET /api/saved-answers keeps its shape ──
function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'PRO');
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, custom_answers TEXT, custom_answer_overrides TEXT,
      custom_answers_acknowledged_at INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT, apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE job_role_map (job_id TEXT, role_key TEXT, source_profile_id INTEGER);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT, approval_mode TEXT, tool_type TEXT,
      status TEXT, total_jobs INTEGER, held_count INTEGER DEFAULT 0, submitted_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()), started_at INTEGER, finished_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER, job_id TEXT, status TEXT,
      reason_code TEXT, open_questions_json TEXT, answers_json TEXT, finished_at INTEGER, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_idempotency (user_id INTEGER NOT NULL, idem_key TEXT NOT NULL, endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200, response_json TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, idem_key));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER DEFAULT (unixepoch()));
    INSERT INTO users (id, username) VALUES (1, 'u1');
    INSERT INTO user_profile (user_id, first_name) VALUES (1, 'Ada');
    INSERT INTO scraped_jobs (job_id, title, company, location) VALUES
      ('fs-us', 'Full Stack Engineer', 'Acme', 'Boston, MA'),
      ('fs-us-2', 'Full Stack Engineer', 'Globex', 'Austin, TX'),
      ('ds-uk', 'Data Scientist', 'Initech', 'London, United Kingdom');
    INSERT INTO job_role_map (job_id, role_key) VALUES ('fs-us', 'full_stack'), ('fs-us-2', 'full_stack'), ('ds-uk', 'data_scientist');
  `);
  // migration 222, from the source of truth
  db.exec(MIGRATIONS.find(m => m.id === "222_saved_answer_scopes").sql);
  const hold = (jobId, questions) => {
    const runId = db.prepare("INSERT INTO apply_runs (user_id, mode, status, total_jobs) VALUES (1, 'auto', 'completed', 1)").run().lastInsertRowid;
    db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, open_questions_json)
      VALUES (?, 1, ?, 'held_review', 'needs_answers', ?)`).run(runId, jobId, JSON.stringify(questions.map(question => ({ question }))));
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(), noop, noop, noop, noop);
  app.use(createSavedAnswersRouter({ db, requireAuth: (req, _res, next) => next() }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, p, body) => fetch(`${base}${p}`, { method, headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, json: await r.json() }));
  return { db, hold, call, close: () => { server.close(); db.close(); } };
}

test("d165SalaryScopedPerRoleLocation (route): the answer is saved for the held job's role + location and unblocks only matching jobs", async () => {
  const t = setup();
  try {
    t.hold("fs-us", [SALARY_Q]);
    const r = await t.call("POST", "/api/apply/answers", { answers: { [SALARY_Q]: "150000" } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(r.json.scoped.map(s => [s.roleKey, s.locationKey, s.answer]), [["full_stack", "us", "150000"]]);
    assert.deepEqual(r.json.unblocked, ["fs-us"]);
    const row = t.db.prepare("SELECT custom_answers, custom_answer_scoped FROM user_profile WHERE user_id=1").get();
    assert.ok(!(JSON.parse(row.custom_answers || "{}")[SALARY_Q]), "a salary answer is NOT stored globally");
    assert.equal(JSON.parse(row.custom_answer_scoped).length, 1);

    // A later hold: the same role + location is unblocked by it, a different role + location is not.
    t.hold("fs-us-2", [SALARY_Q]);
    t.hold("ds-uk", [SALARY_Q]);
    const again = await t.call("POST", "/api/apply/answers", { answers: { "How did you hear about us?": "A friend" } });
    assert.deepEqual(again.json.unblocked.sort(), ["fs-us", "fs-us-2"], "ds-uk still needs its own salary");

    // An explicit scope from the caller (the held view's "Use this for similar jobs" choice).
    const uk = await t.call("POST", "/api/apply/answers", { answers: { [SALARY_Q]: "70000" }, scopes: { [SALARY_Q]: { jobId: "ds-uk" } } });
    assert.deepEqual(uk.json.scoped.map(s => [s.roleKey, s.locationKey]), [["data_scientist", "non_us"]]);
    assert.ok(uk.json.unblocked.includes("ds-uk"));

    // The Saved-answers API keeps its keys and lists the scoped entries; one can be forgotten.
    const list = await t.call("GET", "/api/saved-answers");
    for (const k of ["entries", "lifecycle", "reviewDue", "limits"]) assert.ok(k in list.json, `GET /api/saved-answers still has ${k}`);
    assert.equal(list.json.scoped.length, 2);
    const del = await t.call("DELETE", "/api/saved-answers/scoped", { question: SALARY_Q, roleKey: "data_scientist", locationKey: "non_us" });
    assert.equal(del.status, 200);
    assert.equal(del.json.scoped.length, 1);
  } finally { t.close(); }
});

test("d165EligibilityStaysGlobal: an eligibility answer is saved globally and answers every role and location", async () => {
  const t = setup();
  try {
    const Q = "Are you legally authorized to work in the United States?";
    t.hold("fs-us", [Q]);
    t.hold("ds-uk", [Q]);
    const r = await t.call("POST", "/api/apply/answers", { answers: { [Q]: "Yes" } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.scoped, undefined, "nothing scoped");
    assert.deepEqual(r.json.unblocked.sort(), ["ds-uk", "fs-us"], "one answer unblocks every role and location");
    const row = t.db.prepare("SELECT custom_answers, custom_answer_scoped FROM user_profile WHERE user_id=1").get();
    assert.equal(JSON.parse(row.custom_answers)[Q], "Yes");
    assert.equal(row.custom_answer_scoped, null);
  } finally { t.close(); }
});

test("d165 the fill path passes the posting to the payload builder at every apply call site", () => {
  const src = readFileSync(new URL("../routes/apply.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /buildAutofillPayload = \(profile, mode, company = null, jobId = null\) => \{/);
  assert.match(src, /withScopedAnswers\(payload, readScoped\(profile\), jobAnswerScope\(db, jobId\)\)/);
  const calls = src.match(/buildAutofillPayload\(p(?:rofile)?, "APPLY", [^)]*\)/g) || [];
  assert.ok(calls.length >= 6, `found ${calls.length}`);
  for (const c of calls) assert.match(c, /, (?:jobId|job\?\.jobId \?\? null)\)$/, `every call passes the job: ${c}`);
  const a = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const b = readFileSync(new URL("../scripts/migrations.js", import.meta.url), "utf8");
  const block = (s) => s.slice(at(s, 'id: "222_saved_answer_scopes"'), at(s, "`,", at(s, 'id: "222_saved_answer_scopes"')));
  assert.ok(block(a).length > 30);
  assert.equal(block(a), block(b), "migration 222 is byte-identical in server.js and scripts/migrations.js");
});

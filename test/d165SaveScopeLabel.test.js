// ⭐ D165 (5) [T7] · THE INLINE QUESTION NAMES THE SCOPE ITS ANSWER IS KEPT FOR, AND A HELD ROW READS IN THE SKETCH'S ORDER.
// held-application-sketch.html: "Use this for similar jobs (full-stack, US) next time" under the salary box, and
// lead → question → buttons → steps → panes → earlier attempt. A salary answer is saved for the scope of the jobs
// blocked on it (D165 (3), POST /api/apply/answers); GET /api/apply/questions now names that scope so the label
// says what will happen. Synthetic people and postings only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { scopeWords, scopePhrase } from "../services/scopedAnswers.js";
import { saveForNextTimeLabel } from "../client/src/lib/heldApplication.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d165SaveScopeLabel: a scope in plain words", () => {
  assert.equal(scopeWords({ roleKey: "engineering", locationKey: "us" }), "engineering, US");
  assert.equal(scopeWords({ roleKey: "pm", locationKey: "non_us" }), "product, outside the US");
  assert.equal(scopeWords({ roleKey: "hr", locationKey: null }), "people");
  assert.equal(scopeWords({ roleKey: null, locationKey: "remote" }), "remote");
  assert.equal(scopeWords({ roleKey: "general", locationKey: null }), null, "'general' is the absence of a function");
  assert.equal(scopeWords({}), null);
  assert.deepEqual(scopePhrase([{ roleKey: "data", locationKey: "us" }, { roleKey: "data", locationKey: "us" }]), { phrase: "data, US", several: false });
  assert.deepEqual(scopePhrase([{ roleKey: "data", locationKey: "us" }, { roleKey: "engineering", locationKey: "us" }]), { phrase: null, several: true });
  assert.deepEqual(scopePhrase([]), { phrase: null, several: false });
});

test("d165SaveScopeLabel: the label says what will be kept", () => {
  assert.equal(saveForNextTimeLabel({ salary: true, scope: "engineering, US" }), "Use this for similar jobs (engineering, US) next time");
  assert.equal(saveForNextTimeLabel({ salary: true, scopeSeveral: true }), "Use this for similar jobs next time (one answer per role and location)");
  assert.equal(saveForNextTimeLabel({ salary: true }), "Use this for similar jobs next time");
  assert.equal(saveForNextTimeLabel({ salary: false, eligibility: true }), "Save this answer for next time", "eligibility stays global");
  assert.equal(saveForNextTimeLabel(undefined), "Save this answer for next time");
});

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'PRO');
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT,
      full_name TEXT, email TEXT, phone TEXT, custom_answers TEXT NOT NULL DEFAULT '{}', custom_answer_scoped TEXT);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT,
      apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE job_role_map (job_id TEXT NOT NULL, role_key TEXT NOT NULL, role_family TEXT, domain TEXT,
      source_profile_id INTEGER, confidence REAL NOT NULL DEFAULT 1.0, matched_by TEXT NOT NULL DEFAULT 'x',
      created_at INTEGER, PRIMARY KEY (job_id, role_key));
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER,
      job_id TEXT, status TEXT, reason_code TEXT, open_questions_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    INSERT INTO users (id, username) VALUES (1, 'jordan');
    INSERT INTO user_profile (user_id, first_name) VALUES (1, 'Jordan');
    INSERT INTO scraped_jobs (job_id, title, company, location) VALUES
      ('e1', 'Full-stack Engineer', 'Acme Rails', 'Boston, MA'),
      ('e2', 'Backend Engineer', 'Birch Labs', 'Austin, TX'),
      ('d1', 'Data Engineer', 'Cobalt Data', 'London, United Kingdom');
    INSERT INTO job_role_map (job_id, role_key) VALUES ('e1', 'engineering'), ('e2', 'engineering'), ('d1', 'data');
  `);
  const held = db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, open_questions_json) VALUES (?, 1, ?, 'held_review', 'incomplete_form', ?)");
  const salary = { question: "Salary Requirement", type: "text" };
  const sponsor = { question: "Will you require sponsorship?", type: "select", eligibility: true };
  held.run(1, "e1", JSON.stringify([salary, sponsor]));
  held.run(1, "e2", JSON.stringify([salary]));
  held.run(2, "d1", JSON.stringify([{ question: "Desired annual salary", type: "text" }]));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (q, r, n) => n(), noop, noop, noop, noop);
  const server = app.listen(0);
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test("d165SaveScopeLabel: GET /api/apply/questions names a salary question's scope from the jobs blocked on it", async () => {
  const { server, url } = setup();
  try {
    const body = await fetch(`${url}/api/apply/questions`).then(r => r.json());
    const by = Object.fromEntries(body.questions.map(q => [q.question, q]));
    assert.equal(by["Salary Requirement"].salary, true);
    assert.equal(by["Salary Requirement"].scope, "engineering, US", "two US engineering jobs → one scope");
    assert.equal(by["Salary Requirement"].scopeSeveral, false);
    assert.equal(by["Desired annual salary"].scope, "data, outside the US");
    assert.equal(by["Will you require sponsorship?"].salary, false, "eligibility is kept globally — no scope");
    assert.equal(by["Will you require sponsorship?"].scope, undefined);
    assert.equal(saveForNextTimeLabel(by["Salary Requirement"]), "Use this for similar jobs (engineering, US) next time");
  } finally { server.close(); }
});

test("d165SaveScopeLabel: both question boxes read the label; a held row follows the sketch's order (source pin)", () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.equal(panel.split("{saveForNextTimeLabel(").length - 1, 2, "the inline box and the review list");
  assert.doesNotMatch(panel, /^\s*Save this answer for next time\s*$/m, "no hard-coded label left");
  const tracker = read("client/src/components/ApplicationTracker.jsx");
  const body = tracker.slice(at(tracker, "export function RowOpen("));
  const order = ["{!stepsFirst && panes}", "{children}", 'data-row-actions=""', 'data-run-steps=""', "{stepsFirst && panes}", "<EarlierAttempts"]
    .map(m => at(body, m));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "lead → question → buttons → steps → panes → earlier");
  const schemas = read("services/api/mobileSchemas.js");
  assert.match(schemas, /salary: "boolean", scope: "string\|null", scopeSeveral: "boolean\|null"/);
});

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { buildOpenQuestions } from "../services/applyAutomation.js";
import { heldQuestionsOf, waitsOnPerson } from "../services/heldQuestions.js";
import { draftableQuestion, heldDraftQuestion } from "../services/applicationAnswerDraft.js";
import { SAVED_ANSWER_LIMITS } from "../shared/savedAnswers.js";

// ⛔ A189 (written as A185 in the log; owner 11-11: "none of them could be submitted even after answering the questions
// ... one error read too long"). Production's HTTP log for the owner's session (21:04–21:09Z): every POST /api/apply/answers
// answered 409 (no_retryable_jobs) or 400, every POST /api/apply/questions/greenhouse::…/draft answered 400 (not_a_question).
// The causes, each pinned here:
//   (1) the held stepper HID every required:false question while the unblock check REQUIRED all of them — and each
//       low-confidence answer is written required:false (buildOpenQuestions), so such a job could never unblock;
//   (2) a question over 500 characters (the employer's wording) failed the whole save with the bare code "too_long";
//   (3) the draft route matched only a byte-equal board-API label, not the label the run read off the live form.
// Synthetic person (Ada), synthetic job ids.

function setup(HELD) {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'PRO');
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, profile_name TEXT,
      role_family TEXT, domain TEXT, is_active INTEGER DEFAULT 0);
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT,
      full_name TEXT, email TEXT, phone TEXT, custom_answers TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE user_integrations (user_id INTEGER, provider TEXT, status TEXT, account_email TEXT,
      updated_at INTEGER, last_checked_at INTEGER);
    CREATE TABLE profile_base_resumes (profile_id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT,
      content TEXT, enhanced_content TEXT, enhanced_at INTEGER, enhanced_ats_delta REAL, updated_at INTEGER);
    CREATE TABLE base_resume (user_id INTEGER PRIMARY KEY, name TEXT, content TEXT,
      enhanced_content TEXT, enhanced_at INTEGER, enhanced_ats_delta REAL, updated_at INTEGER);
    CREATE TABLE simple_apply_profiles (user_id INTEGER PRIMARY KEY, titles_json TEXT, keywords_json TEXT,
      skills_json TEXT, search_terms_json TEXT, source_hash TEXT, years_experience REAL, updated_at INTEGER);
    CREATE TABLE profile_simple_apply_profiles (profile_id INTEGER PRIMARY KEY, user_id INTEGER,
      titles_json TEXT, keywords_json TEXT, skills_json TEXT, search_terms_json TEXT, source_hash TEXT,
      years_experience REAL, updated_at INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT,
      apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE resumes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, job_id TEXT,
      apply_mode TEXT, ats_score INTEGER, html TEXT, updated_at INTEGER);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT, approval_mode TEXT,
      tool_type TEXT, status TEXT, total_jobs INTEGER, held_count INTEGER DEFAULT 0,
      submitted_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()), started_at INTEGER, finished_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER, approved_at INTEGER, approved_from_run_job_id INTEGER,
      job_id TEXT, status TEXT, reason_code TEXT, reason_detail TEXT, started_at INTEGER,
      finished_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
      answers_json TEXT, resume_artifact_id INTEGER, resume_ats_score INTEGER,
      base_ats_score INTEGER, base_ats_json TEXT,
      screenshot_path TEXT, submit_verified INTEGER, submit_evidence TEXT,
      open_questions_json TEXT, hidden_at INTEGER, UNIQUE(run_id, job_id));
    CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER,
      user_id INTEGER, job_id TEXT, level TEXT DEFAULT 'info', event TEXT, message TEXT,
      details_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE job_applications (user_id INTEGER, job_id TEXT, company TEXT, role TEXT, job_url TEXT,
      source TEXT, location TEXT, apply_mode TEXT, resume_file TEXT, applied_at INTEGER, notes TEXT,
      auto_status TEXT,
      ats_score_at_apply INTEGER, ats_scorer_version TEXT, ats_report_at_apply TEXT, ats_scored_at INTEGER,
      UNIQUE(user_id, job_id));
    CREATE TABLE user_jobs (user_id INTEGER, job_id TEXT, domain_profile_id INTEGER, applied INTEGER DEFAULT 0,
      updated_at INTEGER, UNIQUE(user_id, job_id));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_idempotency (user_id INTEGER NOT NULL, idem_key TEXT NOT NULL, endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200, response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY (user_id, idem_key));
    INSERT INTO users (id, username) VALUES (1, 'ada');
    INSERT INTO domain_profiles (id, user_id, profile_name, is_active) VALUES (10, 1, 'SWE', 1);
    INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (1, 'Ada', 'Lovelace', 'ada@example.com');
    INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at)
      VALUES (10, 1, 'r.txt', 'resume text', unixepoch());
  `);

  const heldQuestions = HELD;
  const run = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs) VALUES (1,'auto','generate','completed',1)").run();
  db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, open_questions_json)
              VALUES (?, 1, 'gh1', 'held_review', 'incomplete_form', ?)`)
    .run(run.lastInsertRowid, JSON.stringify(heldQuestions));

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (q, r, n) => n(), noop, noop, noop, noop);
  const server = app.listen(0);
  return { db, server, url: `http://127.0.0.1:${server.address().port}` };
}

const post = (url, p, b) => fetch(`${url}${p}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b),
});

const LOW = buildOpenQuestions({ lowConfidence: [{ field: "Which of our products have you used?", name: "q1", type: "text", value: "Draft", provenance: "label_fuzzy", confidence: 0.3 }] })[0];
const OPTIONAL = { question: "Pronouns", type: "text", required: false, reason: "unanswered", eligibility: null };
const REQUIRED = { question: "Why do you want to work at Example Co?", type: "text_area", required: true, reason: "unanswered", eligibility: null };

test("a189: one rule — the stepper lists exactly the questions the unblock check waits on", () => {
  assert.equal(LOW.required, false, "precondition: buildOpenQuestions writes a low-confidence answer as required:false");
  assert.equal(waitsOnPerson(LOW), true, "a low-confidence answer is a real blocker — the next run holds on it again");
  assert.equal(waitsOnPerson(OPTIONAL), false, "an optional field never blocks");
  assert.equal(waitsOnPerson({ question: "Resume", type: "file", required: true }), false, "the résumé is draft's");
  const listed = heldQuestionsOf({ openQuestionsJson: JSON.stringify([LOW, OPTIONAL, REQUIRED]) }).map(q => q.question);
  assert.deepEqual(listed.sort(), [LOW.question, REQUIRED.question].sort());
});

test("a189: answering every question the person was SHOWN unblocks and re-runs the job (was 409 forever)", async () => {
  const { server, url } = setup([LOW, OPTIONAL, REQUIRED]);
  try {
    const res = await post(url, "/api/apply/answers", {
      answers: { [LOW.question]: "Draft and its extension", [REQUIRED.question]: "I build tools like yours." },
      retryJobIds: ["gh1"],
    });
    const body = await res.json();
    assert.equal(res.status, 202, JSON.stringify(body));
    assert.deepEqual(body.unblocked, ["gh1"]);
    assert.ok(body.retry?.runId);
  } finally { server.close(); }
});

test("a189: a refused re-run says in words what is still to answer, never the bare code", async () => {
  const { server, url } = setup([LOW, REQUIRED]);
  try {
    const res = await post(url, "/api/apply/answers", { answers: { [REQUIRED.question]: "Because." }, retryJobIds: ["gh1"] });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, "no_retryable_jobs");
    assert.deepEqual(body.waiting, [LOW.question]);
    assert.match(body.message, /^Saved 1 answer\. Still to answer before draft can finish the form: "Which of our products/);
  } finally { server.close(); }
});

test("a189: an employer question over 500 characters saves (was 400 too_long for the whole save)", async () => {
  const long = "Please tell us about a project you are proud of. " + "Include what you built, why, and what you learned. ".repeat(14);
  assert.ok(long.length > 500 && long.length <= SAVED_ANSWER_LIMITS.maxQuestionChars, String(long.length));
  const { server, url } = setup([{ ...REQUIRED, question: long }]);
  try {
    const res = await post(url, "/api/apply/answers", { answers: { [long]: "The board's fit ranking." }, retryJobIds: ["gh1"] });
    assert.equal(res.status, 202, JSON.stringify(await res.clone().json()));
  } finally { server.close(); }
});

test("a189: a save that IS too long says so in words", async () => {
  const { server, url } = setup([REQUIRED]);
  try {
    const res = await post(url, "/api/apply/answers", { answers: { [REQUIRED.question]: "x".repeat(SAVED_ANSWER_LIMITS.maxAnswerChars + 1) }, remember: { [REQUIRED.question]: true } });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "too_long");
    assert.match(body.message, /longer than draft can save .* Shorten it and try again\./);
  } finally { server.close(); }
});

test("a189: the draft route takes the label as read off the live form, and a held run's own question", () => {
  const schema = { fields: [] };
  const rows = [{ open_questions_json: JSON.stringify([REQUIRED, { question: "Are you authorized?", type: "select", options: [{ value: "Yes", label: "Yes" }], required: true }]), blanks_json: null }];
  assert.deepEqual(heldDraftQuestion(rows, "why do you want to work at example co *", heldQuestionsOf), { label: REQUIRED.question, description: null });
  assert.equal(heldDraftQuestion(rows, "Are you authorized?", heldQuestionsOf), null, "a choice is never drafted");
  assert.equal(heldDraftQuestion(rows, "Write me a poem", heldQuestionsOf), null, "never text a caller made up");
  assert.equal(draftableQuestion(schema, REQUIRED.question), null);
});

// ⛔ D175 FA2 · THE FULL-AUTO CANARY NEVER TOUCHES A REAL EMPLOYER (services/fullAutoCanary.js). A production test
// account in Apply for me on a SAMPLE résumé proves the loop nightly; its sends go only to draft's practice form. A test
// account on a real résumé is refused by the scheduler; a run job with no practice-form record is a CRITICAL line.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { canaryRefusal, canaryReport, runCanaryCheck, canaryAlerts, lastCanary } from "../services/fullAutoCanary.js";
import { samples } from "../services/sampleResumes.js";

const T = 1_800_000_000;
function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, test_account INTEGER DEFAULT 0, send_mode TEXT, auto_settings TEXT, auto_last_run_at INTEGER);
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, is_active INTEGER);
    CREATE TABLE profile_base_resumes (profile_id INTEGER, user_id INTEGER, content TEXT);
    CREATE TABLE base_resume (user_id INTEGER, content TEXT);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
    CREATE TABLE picks_runs (id INTEGER PRIMARY KEY, user_id INTEGER, mode TEXT, seen INTEGER, picked INTEGER, summary_sent_at INTEGER, created_at INTEGER);
    CREATE TABLE picks (id INTEGER PRIMARY KEY, run_id INTEGER, user_id INTEGER, job_id TEXT, state TEXT, created_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, status TEXT, resume_artifact_id INTEGER, submit_verified INTEGER, created_at INTEGER);
    CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY, run_job_id INTEGER, event TEXT);
  `);
  return db;
}
const SAMPLE = () => samples().A.resumeText;
const REAL = "Jordan Example\nSoftware engineer, 6 years. Python, Go, Kubernetes.";   // synthetic, not a sample

function seedRun(db, { practice = true, verified = 1, summary = true } = {}) {
  db.prepare(`INSERT INTO picks_runs (id, user_id, mode, seen, picked, summary_sent_at, created_at) VALUES (1, 7, 'apply', 12, 2, ?, ?)`).run(summary ? T - 600 : null, T - 3600);
  for (const [i, job] of [[1, "gh::a"], [2, "lever::b"]]) {
    db.prepare(`INSERT INTO picks (run_id, user_id, job_id, state, created_at) VALUES (1, 7, ?, 'auto', ?)`).run(job, T - 3600);
    db.prepare(`INSERT INTO apply_run_jobs (id, user_id, job_id, status, resume_artifact_id, submit_verified, created_at) VALUES (?, 7, ?, 'submitted', 50, ?, ?)`)
      .run(i, job, verified, T - 3500);
    if (practice || i === 1) db.prepare(`INSERT INTO apply_job_logs (run_job_id, event) VALUES (?, 'practice_form')`).run(i);
  }
}

test("d175CanaryPracticeFormOnly: a test account on a real résumé is refused; on a sample it may run; ordinary accounts are untouched", () => {
  const db = makeDb();
  db.prepare(`INSERT INTO users (id, test_account, send_mode) VALUES (7, 1, 'auto'), (8, 0, 'auto')`).run();
  db.prepare(`INSERT INTO base_resume (user_id, content) VALUES (7, ?), (8, ?)`).run(REAL, REAL);
  assert.match(canaryRefusal(db, 7), /only on a sample résumé/);
  assert.equal(canaryRefusal(db, 8), null, "not a test account — the canary rule does not apply");
  db.prepare(`UPDATE base_resume SET content = ? WHERE user_id = 7`).run(SAMPLE());
  assert.equal(canaryRefusal(db, 7), null);
});

test("d175CanaryPracticeFormOnly: a full green night — every step green", () => {
  const db = makeDb();
  db.prepare(`INSERT INTO users (id, test_account, send_mode) VALUES (7, 1, 'auto')`).run();
  db.prepare(`INSERT INTO base_resume (user_id, content) VALUES (7, ?)`).run(SAMPLE());
  seedRun(db);
  const r = canaryReport(db, 7, { nowSec: T });
  assert.equal(r.ok, true, JSON.stringify(r.steps));
  assert.deepEqual(r.steps.map(s => s.id), ["sample_resume", "scheduled", "picked", "started", "practice_form_only", "resume", "sent", "summary"]);
});

test("d175CanaryPracticeFormOnly: a send with no practice-form record is CRITICAL in pipeline health", () => {
  const db = makeDb();
  db.prepare(`INSERT INTO users (id, test_account, send_mode) VALUES (7, 1, 'auto')`).run();
  db.prepare(`INSERT INTO base_resume (user_id, content) VALUES (7, ?)`).run(SAMPLE());
  seedRun(db, { practice: false });
  const lines = [];
  const out = runCanaryCheck(db, { nowSec: T, log: { log: (m) => lines.push(m), warn: (m) => lines.push(m) } });
  assert.equal(out.ok, false);
  assert.match(lines.join("\n"), /\[canary\] user 7 run 1: RED — practice_form_only: ⛔ 1 run job/);
  const alerts = canaryAlerts(db, { nowSec: T });
  assert.equal(alerts[0].severity, "critical");
  assert.equal(lastCanary(db).reports[0].runId, 1, "kept for Admin");
});

test("d175CanaryPracticeFormOnly: no canary account, or a run that never happened, is a warning — never a pass", () => {
  const db = makeDb();
  const out = runCanaryCheck(db, { nowSec: T, log: { log() {}, warn() {} } });
  assert.equal(out.ok, false);
  assert.deepEqual(canaryAlerts(db, { nowSec: T }), [], "nobody uses Apply for me → nothing to prove, no line");
  db.prepare(`INSERT INTO users (id, test_account, send_mode) VALUES (9, 0, 'auto')`).run();
  assert.match(canaryAlerts(db, { nowSec: T })[0].detail, /1 account\(s\) use Apply for me, but no test account/);
  db.prepare(`INSERT INTO users (id, test_account, send_mode) VALUES (7, 1, 'auto')`).run();
  db.prepare(`INSERT INTO base_resume (user_id, content) VALUES (7, ?)`).run(SAMPLE());
  const r = canaryReport(db, 7, { nowSec: T });
  assert.equal(r.ok, false);
  assert.equal(r.steps.at(-1).id, "scheduled");
});

test("d175CanaryPracticeFormOnly: wired — the scheduler refuses, pipeline health reads it, the cron runs it", () => {
  const sched = fs.readFileSync(new URL("../services/autoScheduler.js", import.meta.url), "utf8");
  assert.match(sched, /const canaryNo = canaryRefusal\(db, u\.id\);/);
  assert.match(fs.readFileSync(new URL("../routes/adminDb.js", import.meta.url), "utf8"), /canaryAlerts\(db, \{ nowSec: now \}\)/);
  assert.match(fs.readFileSync(new URL("../server.js", import.meta.url), "utf8"), /runCanaryCheck\(db\)/);
});

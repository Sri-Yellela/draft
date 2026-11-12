import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { stuckSubmitDecision, SUBMIT_EVENTS, SUBMIT_MAX_ATTEMPTS, SUBMIT_INTERRUPTED } from "../services/submitRetry.js";

// ⭐ A189 (written as A185) · NEXT (agent) 2: an approved application stuck in `running` (the worker died — a deploy
// restart, a lost promise) is swept: REQUEUED when its own log proves Submit was never pressed (counts as an attempt), else
// ended HELD with a sentence that says whether anything could have been sent. On boot and on an interval; the interval's
// read is one LIMITed query on migration 273's partial index. Synthetic user, synthetic job ids; no browser.

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'PRO');
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, profile_name TEXT,
      role_family TEXT, domain TEXT, is_active INTEGER DEFAULT 0, generate_at_queue INTEGER DEFAULT 0);
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, full_name TEXT, email TEXT, phone TEXT);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT, apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT, approval_mode TEXT,
      tool_type TEXT, status TEXT, total_jobs INTEGER, held_count INTEGER DEFAULT 0,
      submitted_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()), started_at INTEGER, finished_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER, approved_at INTEGER,
      approved_from_run_job_id INTEGER, job_id TEXT, status TEXT, reason_code TEXT, reason_detail TEXT, started_at INTEGER,
      finished_at INTEGER, created_at INTEGER DEFAULT (unixepoch()), hidden_at INTEGER, UNIQUE(run_id, job_id));
    CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER,
      user_id INTEGER, job_id TEXT, level TEXT DEFAULT 'info', event TEXT, message TEXT,
      details_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE INDEX idx_apply_logs_run ON apply_job_logs(run_id, run_job_id, created_at);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER DEFAULT (unixepoch()));
    INSERT INTO users (id, username) VALUES (1, 'u1');
  `);
  const migrations = fs.readFileSync("scripts/migrations.js", "utf8");
  for (const id of ["120_apply_run_line", "273_apply_run_jobs_running"]) {
    const m = new RegExp(`id: "${id}",\\s*sql: \`([^\`]*)\``).exec(migrations);
    assert.ok(m, `migration ${id} exists in scripts/migrations.js`);
    db.exec(m[1]);
  }
  const app = express();
  const noop = async () => ({});
  const hooks = applyRoutes(app, db, (req, _res, next) => next(), noop, noop, noop, noop);
  return { db, hooks };
}

const now = () => Math.floor(Date.now() / 1000);
/** A run-job of a run that SENDS (approved), `running` since `ago` seconds, with the given log events. */
function seed(db, { jobId, ago = 3600, events = [], approval = "approved", mode = "auto", runStatus = "running" }) {
  const runId = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (1, ?, 'generate', ?, 1, ?)")
    .run(mode, runStatus, approval).lastInsertRowid;
  const rjId = db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, started_at) VALUES (?, 1, ?, 'running', ?)")
    .run(runId, jobId, now() - ago).lastInsertRowid;
  for (const e of events) db.prepare("INSERT INTO apply_job_logs (run_id, run_job_id, user_id, job_id, event, message) VALUES (?, ?, 1, ?, ?, '')").run(runId, rjId, jobId, e);
  return { runId, rjId };
}
const row = (db, id) => db.prepare("SELECT status, reason_code, reason_detail, started_at FROM apply_run_jobs WHERE id = ?").get(id);

test("a189StuckSubmittingSweeper: the decision — never pressed + attempts left → requeue; pressed / untracked / spent → held, each with its sentence", () => {
  assert.equal(stuckSubmitDecision({ tracked: true, pressed: false, attempts: 1 }).action, "requeue");
  const pressed = stuckSubmitDecision({ tracked: true, pressed: true, attempts: 1 });
  assert.equal(pressed.action, "hold");
  assert.match(pressed.reasonDetail, /after Submit was pressed/);
  assert.match(pressed.reasonDetail, /check your email/);
  const untracked = stuckSubmitDecision({ tracked: false, pressed: false, attempts: 0 });
  assert.equal(untracked.action, "hold");
  assert.match(untracked.reasonDetail, /may or may not/);
  const spent = stuckSubmitDecision({ tracked: true, pressed: false, attempts: SUBMIT_MAX_ATTEMPTS });
  assert.equal(spent.action, "hold");
  assert.match(spent.reasonDetail, /nothing was sent/);
});

test("a189StuckSubmittingSweeper: boot — a tracked, never-pressed row is requeued (and recovery resumes it); a pressed one is held; an untracked one is left to recovery", () => {
  const { db, hooks } = setup();
  const a = seed(db, { jobId: "never-pressed", events: [SUBMIT_EVENTS.attempt] });
  const b = seed(db, { jobId: "pressed", events: [SUBMIT_EVENTS.attempt, SUBMIT_EVENTS.pressed] });
  const c = seed(db, { jobId: "untracked", events: [] });
  const out = hooks.sweepStuckSubmits({ boot: true });
  assert.deepEqual({ requeued: out.requeued, held: out.held, skipped: out.skipped }, { requeued: 1, held: 1, skipped: 1 });

  const ra = row(db, a.rjId);
  assert.equal(ra.status, "queued");
  assert.equal(ra.started_at, null);
  const requeuedMsg = db.prepare("SELECT message FROM apply_job_logs WHERE run_job_id = ? AND event = ?").pluck().get(a.rjId, SUBMIT_EVENTS.requeued);
  assert.match(requeuedMsg, /nothing was sent/);
  assert.match(requeuedMsg, /attempt 2 of 3/);

  const rb = row(db, b.rjId);
  assert.equal(rb.status, "held_review");
  assert.equal(rb.reason_code, SUBMIT_INTERRUPTED);
  assert.match(rb.reason_detail, /check your email/);
  assert.equal(db.prepare("SELECT held_count FROM apply_runs WHERE id = ?").pluck().get(b.runId), 1);

  assert.equal(row(db, c.rjId).status, "running", "untracked at boot: recoverInterruptedRuns' own rule applies, unchanged");
  // Recovery then: the requeued row's run resumes (it has a queued job — never started a browser in this fixture:
  // no scraped_jobs row, so it fails fast with job_not_found), the untracked row is filed as before.
  const rec = hooks.recoverInterruptedRuns();
  assert.equal(rec.runsResumed, 1);
  assert.equal(row(db, c.rjId).reason_code, "interrupted_by_restart");
});

test("a189StuckSubmittingSweeper: attempts are counted across requeues — the third stuck attempt is held, not requeued forever", () => {
  const { db, hooks } = setup();
  const a = seed(db, { jobId: "spent", events: Array(SUBMIT_MAX_ATTEMPTS).fill(SUBMIT_EVENTS.attempt) });
  hooks.sweepStuckSubmits({ boot: true });
  const r = row(db, a.rjId);
  assert.equal(r.status, "held_review");
  assert.match(r.reason_detail, /3 times/);
  assert.match(r.reason_detail, /nothing was sent/);
});

test("a189StuckSubmittingSweeper: interval — only rows past the timeout, only runs that send; a requeued run goes back to the head of the line", () => {
  const { db, hooks } = setup();
  const fresh = seed(db, { jobId: "fresh", ago: 30, events: [SUBMIT_EVENTS.attempt] });
  const preview = seed(db, { jobId: "preview", approval: "required", events: [SUBMIT_EVENTS.attempt] });
  const old = seed(db, { jobId: "old", events: [SUBMIT_EVENTS.attempt], runStatus: "completed" });
  const untracked = seed(db, { jobId: "old-untracked", events: [] });
  // No scraped_jobs rows: a run the line starts again fails fast (job_not_found) — no browser in a unit test.
  const out = hooks.sweepStuckSubmits({ boot: false });
  assert.equal(row(db, fresh.rjId).status, "running", "inside the timeout — a worker may still be on it");
  assert.equal(row(db, preview.rjId).status, "running", "a preview never sends — not this sweeper's");
  assert.equal(out.requeued, 1);
  // The untracked row at the interval: orphaned with no worker here — held, honestly unsure.
  const u = row(db, untracked.rjId);
  assert.equal(u.status, "held_review");
  assert.match(u.reason_detail, /may or may not/);
  // The requeued run was put back in the line and dispatched (it then fails fast: no scraped_jobs row).
  const runStatus = db.prepare("SELECT status FROM apply_runs WHERE id = ?").pluck().get(old.runId);
  assert.ok(["waiting", "queued", "running", "completed"].includes(runStatus), `run moved through the line: ${runStatus}`);
  assert.equal(db.prepare("SELECT COUNT(*) FROM apply_job_logs WHERE run_job_id = ? AND event = ?").pluck().get(old.rjId, SUBMIT_EVENTS.requeued), 1);
});

test("a189StuckSubmittingSweeper: the interval's read is index-backed (migration 273's partial index) and LIMITed", () => {
  const { db } = setup();
  const plan = db.prepare(`EXPLAIN QUERY PLAN
    SELECT rj.id, rj.run_id, rj.user_id, rj.job_id, r.mode, r.approval_mode
    FROM apply_run_jobs rj JOIN apply_runs r ON r.id = rj.run_id
    WHERE rj.status = 'running' AND rj.started_at < ?
    ORDER BY rj.started_at LIMIT ?`).all(now(), 25).map(r => r.detail).join(" | ");
  assert.match(plan, /idx_apply_run_jobs_running/, plan);
  assert.doesNotMatch(plan, /SCAN rj\b(?! USING)/, plan);
  const src = fs.readFileSync("routes/apply.js", "utf8");
  const body = src.slice(src.indexOf("function sweepStuckSubmits("), src.indexOf("function startStuckSubmitSweeper("));
  assert.match(body, /WHERE rj\.status = 'running' AND rj\.started_at < \?/);
  assert.match(body, /LIMIT \?/);
});

test("a189StuckSubmittingSweeper: server.js sweeps at boot BEFORE recovery, then starts the interval; the migration is in both lists, identical", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const sweep = server.indexOf("applyLine.sweepStuckSubmits({ boot: true });");
  const recover = server.indexOf("applyLine.recoverInterruptedRuns();");
  assert.ok(sweep > 0 && recover > sweep, "the boot sweep runs before recoverInterruptedRuns");
  assert.ok(server.indexOf("applyLine.startStuckSubmitSweeper();") > recover);
  const block = (s) => { const i = s.indexOf('id: "273_apply_run_jobs_running"'); return s.slice(s.lastIndexOf("    {", i), s.indexOf("    },", i) + 6); };
  assert.equal(block(server), block(fs.readFileSync("scripts/migrations.js", "utf8")));
});

test("a189StuckSubmittingSweeper: the person reads a sentence, not a code — both new reasons are in the client's obstacle table", async () => {
  const src = fs.readFileSync("client/src/lib/applyObstacles.js", "utf8");
  assert.match(src, /submit_interrupted: \{/);
  assert.match(src, /submit_outcome_unknown: \{/);
});

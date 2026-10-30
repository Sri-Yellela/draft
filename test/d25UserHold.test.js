import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { userHeld, userHoldKey, setUserHold } from "../services/applyUserHold.js";
import { at } from "../test-support/sourceAnchors.js";

// D25: THE RUN BAR — mode, the three caps, and the user's own Stop everything.
//
// The fixture is a59DraftLine's (the real migration 120 for the line), with a second user so a hold
// can be shown to be PER USER. No scraped_jobs rows: a run that does start fails fast with
// job_not_found and never reaches a browser, so "did it start" is read off the rows, not a page.

function setup({ env = {}, planTier = "PRO" } = {}) {
  const prevEnv = {};
  for (const [k, v] of Object.entries(env)) { prevEnv[k] = process.env[k]; process.env[k] = v; }
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'BASIC');
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, profile_name TEXT,
      role_family TEXT, domain TEXT, is_active INTEGER DEFAULT 0, generate_at_queue INTEGER DEFAULT 0);
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT,
      full_name TEXT, email TEXT, phone TEXT);
    CREATE TABLE user_integrations (user_id INTEGER, provider TEXT, status TEXT, account_email TEXT,
      updated_at INTEGER, last_checked_at INTEGER);
    CREATE TABLE profile_base_resumes (profile_id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT,
      content TEXT, enhanced_content TEXT, enhanced_at INTEGER, enhanced_ats_delta REAL, updated_at INTEGER);
    CREATE TABLE base_resume (user_id INTEGER PRIMARY KEY, name TEXT, content TEXT,
      enhanced_content TEXT, enhanced_at INTEGER, enhanced_ats_delta REAL, updated_at INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT,
      apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT, approval_mode TEXT,
      tool_type TEXT, status TEXT, total_jobs INTEGER, held_count INTEGER DEFAULT 0,
      submitted_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()), started_at INTEGER, finished_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER, approved_at INTEGER, approved_from_run_job_id INTEGER,
      job_id TEXT, status TEXT, reason_code TEXT, reason_detail TEXT, started_at INTEGER,
      finished_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
      answers_json TEXT, resume_artifact_id INTEGER, resume_ats_score INTEGER,
      base_ats_score INTEGER, base_ats_json TEXT, blanks_json TEXT,
      screenshot_path TEXT, submit_verified INTEGER, submit_evidence TEXT,
      hidden_at INTEGER, UNIQUE(run_id, job_id));
    CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER,
      user_id INTEGER, job_id TEXT, level TEXT DEFAULT 'info', event TEXT, message TEXT,
      details_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_gate_packets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, run_id INTEGER,
      run_job_id INTEGER, job_id TEXT, apply_url TEXT, expected_origin TEXT, gate_reason TEXT,
      answers_json TEXT, resume_artifact_id INTEGER, token_hash TEXT, expires_at INTEGER,
      consumed_at INTEGER, exchange_attempts INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_idempotency (user_id INTEGER NOT NULL, idem_key TEXT NOT NULL, endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200, response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY (user_id, idem_key));
    INSERT INTO users (id, username, plan_tier) VALUES (1, 'u1', '${planTier}'), (2, 'u2', '${planTier}');
    INSERT INTO domain_profiles (id, user_id, profile_name, is_active) VALUES (20, 2, 'Data', 1);
    INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (2, 'Grace', 'Hopper', 'grace@example.com');
    INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at)
      VALUES (20, 2, 'r2.txt', 'real resume text', unixepoch());
    INSERT INTO domain_profiles (id, user_id, profile_name, is_active) VALUES (10, 1, 'SWE', 1);
    INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (1, 'Ada', 'Lovelace', 'ada@example.com');
    INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at)
      VALUES (10, 1, 'r.txt', 'real resume text', unixepoch());
  `);
  // The real migration, not a hand-rolled column: the line's schema is exactly what production gets.
  const migrations = fs.readFileSync("scripts/migrations.js", "utf8");
  const m = /id: "120_apply_run_line",\s*sql: `([^`]*)`/.exec(migrations);
  assert.ok(m, "migration 120_apply_run_line exists in scripts/migrations.js");
  db.exec(m[1]);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.headers["x-test-user"] || 1), planTier }; next(); });
  const noop = async () => ({});
  const hooks = applyRoutes(app, db, (req, _res, next) => next(), noop, noop, noop, noop);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const restore = () => {
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    server.close();
  };
  return { db, baseUrl, restore, hooks };
}

const call = (baseUrl, method, path, body, user = 1) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-test-user": String(user) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const draft = (baseUrl, jobIds, user = 1) =>
  call(baseUrl, "POST", "/api/apply/runs", { jobIds: [].concat(jobIds), mode: "auto", surface: "deck" }, user);

async function waitFor(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 20)); }
  return fn();
}
const settle = (ms = 150) => new Promise(r => setTimeout(r, ms));
const runStatus = (db, id) => db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(id);
const jobStatuses = (db, id) => db.prepare("SELECT status FROM apply_run_jobs WHERE run_id=? ORDER BY id").pluck().all(id);

test("GET /api/apply/run-bar: SEMI by default, AUTO open (D100), three caps with usage, no hold", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    // One submitted today, so 'used' is a measured number and not a default.
    const r = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (1,'auto','generate','completed',1,'approved')").run();
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, finished_at) VALUES (?, 1, 'sent1', 'submitted', unixepoch())").run(r.lastInsertRowid);
    const bar = await (await call(baseUrl, "GET", "/api/apply/run-bar")).json();
    assert.equal(bar.mode.current, "semi");
    // D100: no proof lock — AUTO is the user's to choose unless the operator's kill switch is on.
    assert.equal(bar.mode.auto.locked, false, "AUTO is not locked by the server");
    assert.equal(bar.mode.auto.reason, null);
    assert.equal(bar.mode.auto.message, null);
    assert.equal(typeof bar.mode.auto.killSwitch, "boolean");
    assert.deepEqual(bar.caps.map(c => c.id), ["queue", "approval", "submission"], "the pipeline's own order");
    const by = Object.fromEntries(bar.caps.map(c => [c.id, c]));
    assert.deepEqual([by.queue.limit, by.approval.limit, by.submission.limit], [40, 30, 25]);
    assert.equal(by.submission.used, 1);
    assert.equal(by.submission.remaining, 24);
    assert.equal(by.approval.used, 1, "the approved run's job counts against approvals");
    assert.equal(by.queue.used, 0, "an approved run does not count as a preview");
    assert.equal(bar.windowHours, 24);
    assert.deepEqual(bar.hold, { held: false, since: null });
  } finally { restore(); }
});

// D100 (owner 10-30) reversed this test's rule on purpose: it pinned "proof is not the same as permission"
// (FULL_AUTO_PROVEN). With the constant removed, the kill switch is the one lock — off means AUTO can be chosen.
test("D100 · with the kill switch off, AUTO can be chosen — the kill switch is the one lock left", async () => {
  const { db, baseUrl, restore } = setup({ env: { APPLY_FULL_AUTO_DISABLED: "0" } });
  try {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_full_auto_disabled', '0')").run();
    const bar = await (await call(baseUrl, "GET", "/api/apply/run-bar")).json();
    assert.equal(bar.mode.auto.killSwitch, false);
    assert.equal(bar.mode.auto.locked, false);
  } finally { restore(); }
});

test("POST /api/apply/hold takes a strict boolean and is stored per user", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    for (const bad of ["true", 1, null, undefined]) {
      const r = await call(baseUrl, "POST", "/api/apply/hold", { held: bad });
      assert.equal(r.status, 400, `held=${JSON.stringify(bad)} is refused`);
    }
    assert.equal(userHeld(db, 1), false, "a refused request changed nothing");
    const on = await (await call(baseUrl, "POST", "/api/apply/hold", { held: true })).json();
    assert.equal(on.hold.held, true);
    assert.ok(on.hold.since > 0);
    assert.equal(db.prepare("SELECT value FROM app_settings WHERE key=?").pluck().get(userHoldKey(1)), "1");
    assert.equal(userHeld(db, 2), false, "user 2 is not held by user 1's stop");
    const off = await (await call(baseUrl, "POST", "/api/apply/hold", { held: false })).json();
    assert.equal(off.hold.held, false);
    assert.equal(db.prepare("SELECT COUNT(*) FROM app_settings WHERE key=?").pluck().get(userHoldKey(1)), 0,
      "released is the same state as never set");
  } finally { restore(); }
});

test("⛔ a held user's new Draft is admitted but WAITS — it does not start", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    setUserHold(db, 1, true);
    const res = await draft(baseUrl, "j1");
    assert.equal(res.status, 202, "admitted — every other check ran now");
    const body = await res.json();
    assert.equal(body.waiting, true);
    assert.equal(body.held, true);
    assert.match(body.message, /you stopped everything/);
    await settle();
    assert.equal(runStatus(db, body.runId), "waiting", "no busy slot was needed to stop it");
    assert.deepEqual(jobStatuses(db, body.runId), ["queued"], "nothing was opened");
    const line = await (await call(baseUrl, "GET", "/api/apply/line")).json();
    assert.equal(line.held.reason, "user_hold");
    assert.match(line.held.message, /You stopped everything/);
  } finally { restore(); }
});

test("⛔ a held user's QUEUED run in the line is not started by the dispatcher (the ticker's body)", async () => {
  const { db, restore, hooks } = setup();
  try {
    const r = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode, line_position) VALUES (1,'semi','generate','waiting',1,'auto',1)").run();
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 'w1', 'queued')").run(r.lastInsertRowid);
    setUserHold(db, 1, true);
    assert.equal(hooks.dispatchAllLines(), 0, "nothing started — and it is a SEMI run, which the kill switch would let through");
    await settle();
    assert.equal(runStatus(db, r.lastInsertRowid), "waiting");
    assert.deepEqual(jobStatuses(db, r.lastInsertRowid), ["queued"]);
  } finally { restore(); }
});

test("⛔ processRun checks the hold BEFORE starting: a held user's orphan is parked, not resumed", async () => {
  const { db, restore, hooks } = setup();
  try {
    // A run left 'queued' by a restart. Boot recovery calls processRun on it directly — the door
    // that does not go through startRun or the line.
    const r = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (1,'auto','generate','queued',1,'required')").run();
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 'o1', 'queued')").run(r.lastInsertRowid);
    setUserHold(db, 1, true);
    hooks.recoverInterruptedRuns();
    assert.ok(await waitFor(() => runStatus(db, r.lastInsertRowid) === "waiting"), "parked in the line");
    assert.deepEqual(jobStatuses(db, r.lastInsertRowid), ["queued"], "its job never started");
    assert.equal(db.prepare("SELECT started_at FROM apply_runs WHERE id=?").pluck().get(r.lastInsertRowid), null,
      "never marked running");
    assert.ok(db.prepare("SELECT COUNT(*) FROM apply_job_logs WHERE run_id=? AND event='user_hold'").pluck().get(r.lastInsertRowid) >= 1,
      "and it says why");
  } finally { restore(); }
});

test("Stop pressed DURING a run starts no further application; the rest wait at the head of the line", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    const { runId } = await (await draft(baseUrl, ["m1", "m2", "m3"])).json();
    // The first job fails fast (no posting row); the next launch waits 1-3 s of jitter first.
    assert.ok(await waitFor(() => jobStatuses(db, runId)[0] === "failed"), "the first application ran");
    await call(baseUrl, "POST", "/api/apply/hold", { held: true });
    assert.ok(await waitFor(() => runStatus(db, runId) === "waiting", 6000), "the run went back to the line");
    assert.deepEqual(jobStatuses(db, runId), ["failed", "queued", "queued"], "nothing after the stop was opened");
    const line = await (await call(baseUrl, "GET", "/api/apply/line")).json();
    assert.equal(line.waiting[0].id, runId, "at the HEAD — resuming must not reorder it");
  } finally { restore(); }
});

test("Resume moves the line at once — the held Draft starts", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    setUserHold(db, 1, true);
    const { runId } = await (await draft(baseUrl, "r1")).json();
    await settle();
    assert.equal(runStatus(db, runId), "waiting");
    const out = await (await call(baseUrl, "POST", "/api/apply/hold", { held: false })).json();
    assert.equal(out.hold.held, false);
    assert.ok(await waitFor(() => runStatus(db, runId) !== "waiting"), "it left the line");
    assert.ok(await waitFor(() => jobStatuses(db, runId)[0] !== "queued"), "and its job ran");
  } finally { restore(); }
});

test("a hold is PER USER — user 2's Draft starts while user 1 is stopped", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    setUserHold(db, 1, true);
    const one = await (await draft(baseUrl, "u1j")).json();
    const two = await (await draft(baseUrl, "u2j", 2)).json();
    assert.equal(two.waiting, false);
    assert.ok(await waitFor(() => jobStatuses(db, two.runId)[0] !== "queued"), "user 2's job ran");
    assert.equal(runStatus(db, one.runId), "waiting");
  } finally { restore(); }
});

test("the kill switch is unchanged by the user hold: it still holds an auto line on its own", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_full_auto_disabled', '1')").run();
    const r = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode, line_position) VALUES (1,'auto','generate','waiting',1,'required',1)").run();
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 'k1', 'queued')").run(r.lastInsertRowid);
    const line = await (await call(baseUrl, "GET", "/api/apply/line")).json();
    assert.equal(line.held.reason, "kill_switch");
  } finally { restore(); }
});

test("a run parked by the hold does not re-dispatch the line on its way out — no ping-pong", () => {
  // If the line's check and processRun's ever disagreed, a dispatch from processRun's finally would
  // start the run, processRun would park it, and the two would loop forever. The injected-violation
  // check that removed the user_hold arm from lineHeldBy hung exactly that way before this guard.
  const src = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
  const body = src.slice(at(src, "const processRun = async (run) => {"), at(src, "// ── Browser readiness"));
  assert.equal((body.match(/parked = true;/g) || []).length, 2, "both park sites mark the run");
  assert.match(body, /\} finally \{[\s\S]*?if \(!parked\) \{\s*\n\s*try \{ dispatchLine\(run\.user_id\); \}/);
});

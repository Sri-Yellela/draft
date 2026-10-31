import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";

// A59 (owner, O44, 10-02): A DRAFT WAITS IN LINE. A Draft made while a run is active used to be
// refused 429 run_already_active; it now waits, server-side, and every waiting Draft can be seen,
// edited, reordered or removed until it starts. A run that has started cannot be edited. The kill
// switch stops the line, and a run orphaned by a restart is recovered at boot so the line moves.
//
// No scraped_jobs rows, as in applyGuards: a run that does start fails fast with job_not_found and
// never reaches a browser. These tests are about the line, not about filling a form.

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
    INSERT INTO users (id, username, plan_tier) VALUES (1, 'u1', '${planTier}');
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
  app.use((req, _res, next) => { req.user = { id: 1, planTier }; next(); });
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

const call = (baseUrl, method, path, body) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const draft = (baseUrl, jobId, extra = {}) =>
  call(baseUrl, "POST", "/api/apply/runs", { jobIds: [jobId], mode: "auto", surface: "deck", ...extra });

/** A run already active for user 1 — what used to make the next Draft a 429. */
function seedActive(db, status = "running") {
  const r = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (1,'auto','generate',?,1,'required')").run(status);
  db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 'active-job', 'running')").run(r.lastInsertRowid);
  return r.lastInsertRowid;
}

async function waitFor(fn, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 20)); }
  return fn();
}

test("a second Draft while a run is active WAITS in line — it is not refused", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    const res = await draft(baseUrl, "j1");
    assert.equal(res.status, 202, "the 429 run_already_active is gone");
    const body = await res.json();
    assert.equal(body.waiting, true);
    assert.deepEqual(body.line, { position: 1, length: 1 });
    assert.match(body.message, /Waiting in line \(1 of 1\)/);
    assert.match(body.message, /edit, reorder or remove/);
    const run = db.prepare("SELECT status, line_position FROM apply_runs WHERE id=?").get(body.runId);
    assert.equal(run.status, "waiting");
    assert.equal(run.line_position, 1);
    assert.equal(db.prepare("SELECT status FROM apply_run_jobs WHERE run_id=?").pluck().get(body.runId), "queued");

    // A later Draft goes BEHIND it.
    const second = await (await draft(baseUrl, "j2")).json();
    assert.deepEqual(second.line, { position: 2, length: 2 });

    // Viewable: the line lists both, in order, with the job and what the run will do.
    const runs = await (await call(baseUrl, "GET", "/api/apply/runs")).json();
    assert.deepEqual(runs.line.waiting.map(r => r.id), [body.runId, second.runId]);
    assert.equal(runs.line.waiting[0].position, 1);
    assert.equal(runs.line.waiting[0].jobs[0].jobId, "j1");
    assert.match(runs.line.waiting[0].willDo, /stops before sending/);
    assert.equal(runs.line.waiting[0].usesProfile, "SWE");
    assert.equal(runs.line.waiting[0].editable.tool, true);
    assert.ok(!runs.inFlight.some(j => j.jobId === "j1"),
      "a waiting job is not 'in flight — clears itself': it is in the line, with its controls");
    const line = await (await call(baseUrl, "GET", "/api/apply/line")).json();
    assert.equal(line.waiting.length, 2);
    assert.equal(line.limits.active, 1);
  } finally { restore(); }
});

test("a duplicate stays refused while it waits (already_drafted)", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    assert.equal((await draft(baseUrl, "j1")).status, 202);
    const again = await draft(baseUrl, "j1");
    assert.equal(again.status, 400);
    assert.equal((await again.json()).code, "already_drafted");
  } finally { restore(); }
});

test("an edit BEFORE start lands; an edit AFTER start is refused and says so", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    const { runId } = await (await draft(baseUrl, "j1")).json();

    const ok = await call(baseUrl, "PATCH", `/api/apply/line/${runId}`, { tool: "a_plus_resume" });
    assert.equal(ok.status, 200);
    assert.equal(db.prepare("SELECT tool_type FROM apply_runs WHERE id=?").pluck().get(runId), "a_plus_resume");
    assert.match((await ok.json()).line.waiting[0].willDo, /A\+ Resume/);

    // It starts (what dispatchLine's claim does) — from here it is an ordinary run.
    db.prepare("UPDATE apply_runs SET status='running', line_position=NULL WHERE id=?").run(runId);
    for (const [method, path, body] of [
      ["PATCH", `/api/apply/line/${runId}`, { tool: "generate" }],
      ["DELETE", `/api/apply/line/${runId}`, undefined],
    ]) {
      const refused = await call(baseUrl, method, path, body);
      assert.equal(refused.status, 409, `${method} after start`);
      const b = await refused.json();
      assert.equal(b.error, "run_started");
      assert.equal(b.status, "running");
      assert.match(b.message, /can no longer be edited/);
    }
    assert.equal(db.prepare("SELECT tool_type FROM apply_runs WHERE id=?").pluck().get(runId), "a_plus_resume",
      "the refused edit changed nothing");
  } finally { restore(); }
});

test("A+ in the line is entitlement-gated exactly as at admission", async () => {
  const { db, baseUrl, restore } = setup({ planTier: "BASIC", env: { MONETISATION_ENABLED: "true" } });
  try {
    seedActive(db);
    const { runId } = await (await draft(baseUrl, "j1")).json();
    const r = await call(baseUrl, "PATCH", `/api/apply/line/${runId}`, { tool: "a_plus_resume" });
    assert.equal(r.status, 403, "a BASIC user may not reach A+ by editing a waiting run");
    assert.equal((await r.json()).error, "upgrade_required");
    assert.equal(db.prepare("SELECT tool_type FROM apply_runs WHERE id=?").pluck().get(runId), "generate");
    assert.equal((await call(baseUrl, "PATCH", `/api/apply/line/${runId}`, { tool: "bogus" })).status, 400);
  } finally { restore(); }
});

test("an approved run in the line sends what was approved — its tool is locked", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    const r = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode, line_position) VALUES (1,'auto','generate','waiting',1,'approved',1)").run();
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 'ap1', 'queued')").run(r.lastInsertRowid);
    const res = await call(baseUrl, "PATCH", `/api/apply/line/${r.lastInsertRowid}`, { tool: "a_plus_resume" });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "approved_run_locked");
    const line = await (await call(baseUrl, "GET", "/api/apply/line")).json();
    assert.equal(line.waiting[0].editable.tool, false);
    assert.match(line.waiting[0].willDo, /already approved/);
  } finally { restore(); }
});

test("reorder takes the WHOLE order; a stale order is refused with the line as it is now", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    const a = (await (await draft(baseUrl, "j1")).json()).runId;
    const b = (await (await draft(baseUrl, "j2")).json()).runId;
    const c = (await (await draft(baseUrl, "j3")).json()).runId;
    const ok = await call(baseUrl, "POST", "/api/apply/line/order", { runIds: [c, a, b] });
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).line.waiting.map(r => r.id), [c, a, b]);

    const stale = await call(baseUrl, "POST", "/api/apply/line/order", { runIds: [a, b] });
    assert.equal(stale.status, 409);
    const body = await stale.json();
    assert.equal(body.error, "line_changed");
    assert.deepEqual(body.line.waiting.map(r => r.id), [c, a, b], "nothing was half-applied");
  } finally { restore(); }
});

test("remove: a whole waiting run, or one job of several — and the job can be drafted again", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    const { runId } = await (await draft(baseUrl, "j1")).json();
    const del = await call(baseUrl, "DELETE", `/api/apply/line/${runId}`);
    assert.equal(del.status, 200);
    assert.match((await del.json()).message, /Nothing was opened or sent/);
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(runId), "cancelled");
    assert.equal(db.prepare("SELECT reason_code FROM apply_run_jobs WHERE run_id=?").pluck().get(runId), "removed_from_line");
    assert.equal((await draft(baseUrl, "j1")).status, 202, "a removed job is not a duplicate");

    // One job of a multi-job waiting run (Auto Apply's manual flow can queue several at once).
    const multi = await (await call(baseUrl, "POST", "/api/apply/runs", { jobIds: ["m1", "m2"], mode: "manual" })).json();
    assert.equal(multi.waiting, true);
    const rjs = db.prepare("SELECT id FROM apply_run_jobs WHERE run_id=? ORDER BY id").pluck().all(multi.runId);
    assert.equal((await call(baseUrl, "DELETE", `/api/apply/line/${multi.runId}/jobs/${rjs[0]}`)).status, 200);
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(multi.runId), "waiting");
    assert.equal(db.prepare("SELECT total_jobs FROM apply_runs WHERE id=?").pluck().get(multi.runId), 1);
    assert.equal((await call(baseUrl, "DELETE", `/api/apply/line/${multi.runId}/jobs/${rjs[1]}`)).status, 200);
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(multi.runId), "cancelled",
      "removing its last job removes the run");
  } finally { restore(); }
});

test("the line MOVES when the active run finishes — head first, never a later one", async () => {
  const { db, baseUrl, restore, hooks } = setup();
  try {
    const active = seedActive(db);
    const a = (await (await draft(baseUrl, "j1")).json()).runId;
    const b = (await (await draft(baseUrl, "j2")).json()).runId;
    db.prepare("UPDATE apply_runs SET status='completed' WHERE id=?").run(active);
    assert.equal(hooks.dispatchAllLines(), 1, "one slot, one start");
    assert.notEqual(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(a), "waiting");
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(b), "waiting");
    assert.equal(db.prepare("SELECT line_position FROM apply_runs WHERE id=?").pluck().get(a), null);
    // a starts, fails fast (no posting), and its processRun's finally starts b with no ticker.
    assert.ok(await waitFor(() =>
      db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(b) !== "waiting"),
      "the run finishing moved the line on its own");
    assert.ok(db.prepare("SELECT COUNT(*) FROM apply_job_logs WHERE event='run_left_line'").pluck().get() >= 1);
  } finally { restore(); }
});

test("a Draft with a free slot still waits behind a non-empty line — it cannot jump it", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_full_auto_disabled','0')").run();
    const a = (await (await draft(baseUrl, "j1")).json()).runId;
    // The active run ends, but nothing has dispatched yet; a new Draft arrives in that window.
    db.prepare("UPDATE apply_runs SET status='completed' WHERE status='running'").run();
    const b = await (await draft(baseUrl, "j2")).json();
    assert.notEqual(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(a), "waiting",
      "the head started first");
    assert.equal(b.waiting, true, "the later Draft waits behind it");
  } finally { restore(); }
});

test("⛔ the kill switch stops the LINE, not only the active run", async () => {
  const { db, baseUrl, restore, hooks } = setup();
  try {
    const active = seedActive(db);
    const a = (await (await draft(baseUrl, "j1")).json()).runId;
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_full_auto_disabled','1')").run();
    db.prepare("UPDATE apply_runs SET status='completed' WHERE id=?").run(active);
    assert.equal(hooks.dispatchAllLines(), 0, "nothing starts while the switch is on");
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(a), "waiting");
    const line = await (await call(baseUrl, "GET", "/api/apply/line")).json();
    assert.equal(line.held.reason, "kill_switch");
    assert.match(line.held.message, /line is not moving/);

    db.prepare("UPDATE app_settings SET value='0' WHERE key='apply_full_auto_disabled'").run();
    assert.equal(hooks.dispatchAllLines(), 1, "released, the line moves (the ticker's job)");
  } finally { restore(); }
});

test("a restart recovers: a run left 'running' is reset, so the user's line moves again", async () => {
  const { db, baseUrl, restore, hooks } = setup();
  try {
    // The orphan: a preview run mid-flight when the process died, one job running, one never started.
    const orphan = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (1,'auto','generate','running',2,'required')").run().lastInsertRowid;
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 'o1', 'running')").run(orphan);
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 'o2', 'queued')").run(orphan);
    // A full-auto orphan whose only job was running: it may have reached the employer.
    const sent = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (1,'auto','generate','running',1,'auto')").run().lastInsertRowid;
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, 's1', 'running')").run(sent);
    const waiting = (await (await draft(baseUrl, "j1")).json()).runId;
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(waiting), "waiting");

    const out = hooks.recoverInterruptedRuns();
    assert.equal(out.runs, 2);
    assert.equal(out.jobsInterrupted, 2);
    assert.equal(out.runsResumed, 1);

    const o1 = db.prepare("SELECT status, reason_code, reason_detail FROM apply_run_jobs WHERE job_id='o1'").get();
    assert.equal(o1.status, "failed");
    assert.equal(o1.reason_code, "interrupted_by_restart");
    assert.match(o1.reason_detail, /Nothing was sent/);
    assert.match(db.prepare("SELECT reason_detail FROM apply_run_jobs WHERE job_id='s1'").pluck().get(),
      /may or may not have reached the employer/, "honest about a run that could have submitted");
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(sent), "interrupted");
    // The never-started job is resumed, not lost; and once it settles the line moves.
    assert.ok(await waitFor(() =>
      db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(waiting) !== "waiting"),
      "the user's line moves after recovery");
    assert.notEqual(db.prepare("SELECT status FROM apply_run_jobs WHERE job_id='o2'").pluck().get(), "queued");
  } finally { restore(); }
});

test("Undo on a waiting Draft (abort its job) takes the run out of the line at once", async () => {
  const { db, baseUrl, restore } = setup();
  try {
    seedActive(db);
    const { runId } = await (await draft(baseUrl, "j1")).json();
    const rj = db.prepare("SELECT id FROM apply_run_jobs WHERE run_id=?").pluck().get(runId);
    assert.equal((await call(baseUrl, "POST", `/api/apply/run-jobs/${rj}/abort`)).status, 200);
    assert.equal(db.prepare("SELECT status FROM apply_runs WHERE id=?").pluck().get(runId), "cancelled");
    assert.deepEqual((await (await call(baseUrl, "GET", "/api/apply/line")).json()).waiting, []);
  } finally { restore(); }
});

test("the line has a length limit, refused with a sentence", async () => {
  const { db, baseUrl, restore } = setup({ env: { APPLY_MAX_WAITING_RUNS_PER_USER: "2" } });
  try {
    seedActive(db);
    await draft(baseUrl, "j1"); await draft(baseUrl, "j2");
    const full = await draft(baseUrl, "j3");
    assert.equal(full.status, 429);
    const b = await full.json();
    assert.equal(b.error, "line_full");
    assert.match(b.message, /Remove one from the line/);
  } finally { restore(); }
});

test("server.js recovers at boot and starts the ticker, after the routes are mounted", () => {
  const src = fs.readFileSync("server.js", "utf8");
  const mount = src.indexOf("const applyLine = applyRoutes(");
  assert.ok(mount > 0);
  assert.ok(src.indexOf("applyLine.recoverInterruptedRuns();", mount) > mount);
  assert.ok(src.indexOf("applyLine.startLineTicker();", mount) > mount);
});

// ── The client: the line is shown, editable, and the Draft toast tells the truth ─────────────

test("a Draft that waits says so in the toast, on the deck and the board alike", async () => {
  const { lineAfter, commitDecision, DECISION_AFTER } = await import("../client/src/lib/jobDecisions.js");
  assert.match(lineAfter({ position: 2, length: 3 }), /waits in line \(2 of 3\)/);
  assert.equal(lineAfter(null), DECISION_AFTER.drafted, "no line: the ordinary sentence");
  const api = async () => ({ runId: 7, waiting: true, line: { position: 1, length: 1 } });
  assert.deepEqual(await commitDecision({ jobId: "j", decision: "drafted", api }), { runId: 7, line: { position: 1, length: 1 } });
  const started = async () => ({ runId: 8, waiting: false });
  assert.deepEqual(await commitDecision({ jobId: "j", decision: "drafted", api: started }), { runId: 8, line: null });

  const toast = fs.readFileSync("client/src/components/DecisionToast.jsx", "utf8");
  assert.match(toast, /toast\.line \? lineAfter\(toast\.line\) : DECISION_AFTER\[toast\.decision\]/);
  assert.match(fs.readFileSync("client/src/panels/DeckView.jsx", "utf8"), /if \(r\.line\) setToast\(/);
  assert.match(fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8"), /runId: r\.runId, line: r\.line/);
});

// D113 UI U7 (owner 10-31) on purpose: the In flight list is gone — a running job is a blue-ringed bubble, and the
// side column's Running block lists them. The line keeps its controls, inside that Running block.
test("Draft House draws the line from the server, with tool, order and remove, in the side column's Running block", () => {
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  const line = panel.indexOf("<WaitingLine");
  assert.ok(line > 0, "the panel mounts the line");
  const running = panel.indexOf("running: (applyLine.waiting || []).length > 0 && (");
  assert.ok(running > 0 && running < line && line < panel.indexOf("tidy: (", running), "inside Running");
  const comp = fs.readFileSync("client/src/components/WaitingLine.jsx", "utf8");
  for (const s of ["onTool(run.id", "onMove(run.id, -1)", "onMove(run.id, 1)", "onRemove(run.id)", "line.held.message", "run.willDo"]) {
    assert.ok(comp.includes(s), `WaitingLine renders ${s}`);
  }
  const ctx = fs.readFileSync("client/src/contexts/AutoApplyContext.jsx", "utf8");
  assert.match(ctx, /setApplyLine\(data\.line/, "loaded with the runs, not a second poll");
  assert.match(ctx, /"\/api\/apply\/line\/order"/);
  assert.match(ctx, /lineJobs\]\)/, "a waiting job counts as drafted on the board");
  // A refusal (run_started, line_changed) shows the server's sentence, not a generic failure.
  assert.match(ctx, /setLineMsg\(e\.message/);
});

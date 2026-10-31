import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import pipelineRoutes from "../routes/pipeline.js";
import { listPipeline, jobDetail } from "../services/pipelineWorkspace.js";
import { normaliseAutoSettings, AUTO_DEFAULTS } from "../shared/autoSettings.js";
import { runAutoTick, runDue, lastSlotAt, pickJobs, localClock } from "../services/autoScheduler.js";

// ⭐ D102 P1 + P4 (owner 10-30) · one row per job, one detail panel; Auto settings and the FULL AUTO
// scheduler. Synthetic user and companies only.

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO'), (2,'eli','x','PRO')").run();
  return db;
}
let seq = 0;
function draft(db, { userId = 1, jobId = `gh::${++seq}`, company = "Northwind", title = "Backend Engineer",
  status = "queued", reason = null, recState = "pending", approval = "required", createdAt = null, answers = null } = {}) {
  db.prepare("INSERT OR IGNORE INTO application_records (user_id, job_id, state, origin, created_at, updated_at) VALUES (?,?,?,?,COALESCE(?,unixepoch()),unixepoch())")
    .run(userId, jobId, recState, "drafted", createdAt);
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (?,'auto','completed',1,?)").run(userId, approval).lastInsertRowid;
  db.prepare(`INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code,posting_title,posting_company,posting_url,answers_json,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,COALESCE(?,unixepoch()))`)
    .run(run, userId, jobId, status, reason, title, company, `https://boards.example.test/${jobId}`, answers, createdAt);
  return db.prepare("SELECT id FROM application_records WHERE user_id=? AND job_id=?").pluck().get(userId, jobId);
}

function mount(db, userId = 1) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  pipelineRoutes(app, db, (_req, _res, next) => next());
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body) => {
    const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json() };
  };
  return { call, stop: () => server.close() };
}

// ── P1 · rows, tabs and the one detail ────────────────────────────────────────────────────────

test("D102 · Draft House lists pre-submit rows, The Table post-submit — every tab counted, zero included", () => {
  const db = freshDb();
  draft(db, { status: "held_review", reason: "incomplete_form" });
  draft(db, { status: "held_review", reason: "awaiting_approval" });
  draft(db, { status: "queued" });
  const sentId = draft(db, { status: "submitted", recState: "verified", jobId: "gh::sent" });
  db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, response_outcome) VALUES (1,'gh::sent','Northwind','Backend','interview')").run();
  const dh = listPipeline(db, 1, "draft_house");
  assert.deepEqual(dh.counts, { needs_you: 1, ready_to_approve: 1, in_flight: 0, queued: 1, failed: 0, skipped: 0 });
  assert.equal(dh.rows.length, 3);
  const tb = listPipeline(db, 1, "table");
  // D113 UI (10-31): The Table gains the terminal Withdrawn tab.
  assert.deepEqual(tb.counts, { all: 1, submitted: 0, interview: 1, assessment: 0, offer: 0, rejected: 0, withdrawn: 0 });
  assert.equal(tb.rows[0].id, sentId);
  assert.equal(tb.rows[0].status, "interview");
});

test("D102 · d102SameDetailEverywhere — one id, one route, the same panel; another user's id is a 404", async () => {
  const db = freshDb();
  const id = draft(db, { status: "held_review", reason: "awaiting_approval",
    answers: JSON.stringify([{ name: "First name", value: "Dana", provenance: "profile" }, { name: "Cover letter", value: null, skipped: true }]) });
  const t = mount(db);
  try {
    const a = await t.call("GET", `/api/pipeline/job/${id}`);
    assert.equal(a.status, 200);
    assert.equal(a.body.id, id);
    assert.equal(a.body.status, "ready_to_approve");
    assert.equal(a.body.form.approvable, true);
    assert.deepEqual(a.body.form.fields.map(f => f.name), ["First name", "Cover letter"]);
    assert.deepEqual(a.body.checklist.map(s => s.step),
      ["posting_read", "resume_tailored", "form_filled", "needs_you", "approved", "submitted", "confirmation_email"]);
    assert.equal(a.body.checklist.find(s => s.step === "form_filled").filled, 1);
    assert.deepEqual(Object.keys(a.body).filter(k => ["checklist", "resume", "form", "job", "emails"].includes(k)).sort(),
      ["checklist", "emails", "form", "job", "resume"], "the five tabs");
    // the row in the list carries the same id the detail opens
    assert.ok((await t.call("GET", "/api/pipeline?surface=draft_house")).body.rows.some(r => r.id === id));
    assert.deepEqual(jobDetail(db, 1, id), a.body);
    // another user's application reads as missing; a bad id is refused
    const other = draft(db, { userId: 2 });
    assert.equal((await t.call("GET", `/api/pipeline/job/${other}`)).status, 404);
    assert.equal((await t.call("GET", "/api/pipeline/job/abc")).status, 400);
    assert.equal((await t.call("GET", "/api/pipeline?surface=board")).status, 400);
  } finally { t.stop(); }
});

test("D102 · d102TableNoOrphans — a sent row keeps its title and company when the posting is gone", () => {
  const db = freshDb();
  const id = draft(db, { status: "submitted", recState: "verified", company: "Contoso", title: "Data Engineer" });
  db.prepare("DELETE FROM scraped_jobs").run();
  const d = jobDetail(db, 1, id);
  assert.equal(d.company, "Contoso");
  assert.equal(d.title, "Data Engineer");
  assert.equal(d.surface, "table");
});

test("D102 · a superseded attempt never speaks for the job; the newest live one does", () => {
  const db = freshDb();
  const id = draft(db, { jobId: "gh::sup", status: "held_review", reason: "awaiting_approval" });
  db.prepare("UPDATE apply_run_jobs SET status='superseded' WHERE job_id='gh::sup'").run();
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','running',1,'approved')").run().lastInsertRowid;
  db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'gh::sup','running')").run(run);
  assert.equal(jobDetail(db, 1, id).status, "in_flight");
});

// ── P4 · Auto settings ─────────────────────────────────────────────────────────────────────────

test("D102 P4 · settings are validated whole — defaults, the cap's range, run times, refused never coerced", async () => {
  assert.deepEqual(normaliseAutoSettings({}).value, { ...AUTO_DEFAULTS, filters: {} });
  assert.equal(AUTO_DEFAULTS.dailyCap, 10);
  assert.equal(AUTO_DEFAULTS.perCompanyLimit30d, null, "per-company limit off by default");
  assert.equal(AUTO_DEFAULTS.pauseCompanyAfterReply, true, "pause after an interview / offer on by default");
  for (const bad of [{ dailyCap: 0 }, { dailyCap: 151 }, { dailyCap: "10" }, { runTimes: [] },
    { runTimes: ["9:00"] }, { runTimes: ["09:00", "10:00", "11:00", "12:00", "13:00"] }, { timeZone: "Mars/Olympus" },
    { perCompanyLimit30d: 0 }, { pauseCompanyAfterReply: "yes" }, { filters: [] }]) {
    assert.equal(normaliseAutoSettings(bad).ok, false, JSON.stringify(bad));
  }
  const ok = normaliseAutoSettings({ dailyCap: 150, runTimes: ["18:00", "09:00"], filters: { role: "backend", cursor: "x", level: ["mid", "senior"] } });
  assert.deepEqual(ok.value.runTimes, ["09:00", "18:00"]);
  assert.deepEqual(ok.value.filters, { role: "backend", level: "mid,senior" }, "the board's own parameters; paging dropped");

  const db = freshDb();
  const t = mount(db);
  try {
    assert.equal((await t.call("GET", "/api/apply/auto-settings")).body.settings.dailyCap, 10);
    assert.equal((await t.call("PUT", "/api/apply/auto-settings", { settings: { dailyCap: 151 } })).status, 400);
    assert.equal(db.prepare("SELECT auto_settings FROM users WHERE id=1").pluck().get(), null, "nothing half-stored");
    const put = await t.call("PUT", "/api/apply/auto-settings", { settings: { dailyCap: 3, filters: { role: "backend" } } });
    assert.equal(put.status, 200);
    assert.equal((await t.call("GET", "/api/apply/auto-settings")).body.settings.dailyCap, 3);
  } finally { t.stop(); }
});

// ── P4 / D100 P7 · the scheduler ───────────────────────────────────────────────────────────────

// 2026-11-02 14:30 UTC = 09:30 in New York (EST after the 11-01 change).
const NOW = Math.floor(Date.UTC(2026, 10, 2, 14, 30) / 1000);

test("D102 P4 · a run is due once per run time — not before it, and not twice", () => {
  const s = normaliseAutoSettings({ runTimes: ["09:00", "17:00"], timeZone: "America/New_York" }).value;
  assert.deepEqual(localClock(NOW, s.timeZone), { date: "2026-11-02", minutes: 570 });
  assert.equal(lastSlotAt(NOW, s), NOW - 30 * 60, "today's 09:00");
  assert.equal(runDue(NOW, s, { lastRunAt: NOW - 3600 }), true, "09:00 passed since the last run");
  assert.equal(runDue(NOW, s, { lastRunAt: NOW - 60 }), false, "already ran for 09:00");
  assert.equal(runDue(NOW, s, { savedAt: NOW - 10 }), false, "saved after 09:00 — waits for 17:00");
  // before today's first slot, the last slot is yesterday's 17:00
  const early = NOW - 3 * 3600; // 06:30
  assert.equal(lastSlotAt(early, s), early - (13 * 60 + 30) * 60);
});

function fullAutoUser(db, settings, extra = {}) {
  db.prepare("UPDATE users SET send_mode='auto', auto_settings=?, auto_last_run_at=? WHERE id=1")
    .run(JSON.stringify({ ...settings, savedAt: 0 }), extra.lastRunAt ?? null);
}
const board = (n, company = (i) => `Company ${i}`) =>
  Array.from({ length: n }, (_, i) => ({ jobId: `b::${i}`, company: company(i), postedAt: null }));
function fakeStart(db, nowSec) {
  const calls = [];
  return {
    calls,
    startAutoRun(userId, jobIds) {
      calls.push(jobIds);
      for (const j of jobIds) draft(db, { userId, jobId: j, approval: "auto", status: "queued", createdAt: nowSec, company: "x" });
      return { status: 202, body: {} };
    },
  };
}

test("D102 · d102AutoSettingsCapEnforced — the 11th job on a cap of 10 waits for tomorrow", async () => {
  const db = freshDb();
  fullAutoUser(db, { dailyCap: 10, runTimes: ["09:00", "09:15"], timeZone: "America/New_York" });
  const s = fakeStart(db, NOW - 20 * 60);
  // 09:10: the 09:00 run takes 10 of 11
  const r1 = await runAutoTick(db, { nowSec: NOW - 20 * 60, fetchBoard: async () => board(11), startAutoRun: s.startAutoRun, env: {} });
  assert.equal(r1[0].started, 10);
  // 09:30: the 09:15 run has nothing left today
  const r2 = await runAutoTick(db, { nowSec: NOW, fetchBoard: async () => board(11), startAutoRun: s.startAutoRun, env: {} });
  assert.equal(r2[0].skipped, "daily_cap");
  assert.equal(s.calls.flat().length, 10);
  // tomorrow 09:00 the 11th goes
  const tomorrow = NOW + 86400 - 25 * 60;
  const s2 = fakeStart(db, tomorrow);
  const r3 = await runAutoTick(db, { nowSec: tomorrow, fetchBoard: async () => board(11), startAutoRun: s2.startAutoRun, env: {} });
  assert.equal(r3[0].started, 1);
  assert.deepEqual(s2.calls, [["b::10"]]);
});

test("D102 · d102PauseOnInterview — a company with an interview in 60 days is skipped; the per-company limit holds", async () => {
  const db = freshDb();
  db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, response_outcome, outcome_at) VALUES (1,'old::1','Fabrikam','SWE','interview',?)").run(NOW - 10 * 86400);
  fullAutoUser(db, { dailyCap: 10, perCompanyLimit30d: 1, timeZone: "America/New_York" });
  const s = fakeStart(db, NOW);
  const jobs = [{ jobId: "f::1", company: "Fabrikam" }, { jobId: "c::1", company: "Contoso" }, { jobId: "c::2", company: "Contoso" }];
  const r = await runAutoTick(db, { nowSec: NOW, fetchBoard: async () => jobs, startAutoRun: s.startAutoRun, env: {} });
  assert.deepEqual(s.calls, [["c::1"]], "Fabrikam paused; Contoso limited to 1 in 30 days");
  assert.equal(r[0].skippedJobs, 2);
  // the pause is the user's to switch off
  const p = pickJobs(jobs, { remaining: 10, drafted: new Set(), companyCounts: new Map(), pausedCompanies: new Set(["fabrikam"]),
    settings: { ...AUTO_DEFAULTS, pauseCompanyAfterReply: false } });
  assert.deepEqual(p.take, ["f::1", "c::1", "c::2"]);
});

test("D102 · the scheduler leaves alone: SEMI users, a held user, the kill switch, already-drafted jobs", async () => {
  const db = freshDb();
  const s = fakeStart(db, NOW);
  const tick = (env = {}) => runAutoTick(db, { nowSec: NOW, fetchBoard: async () => board(3), startAutoRun: s.startAutoRun, env });
  assert.deepEqual(await tick(), [], "nobody is in FULL AUTO");
  fullAutoUser(db, { timeZone: "America/New_York" });
  assert.deepEqual(await tick({ APPLY_FULL_AUTO_DISABLED: "1" }), [{ skipped: "kill_switch" }]);
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_user_hold:1', '1')").run();
  const held = await tick();
  assert.equal(held[0].skipped, "held");
  db.prepare("DELETE FROM app_settings").run();
  draft(db, { jobId: "b::0" });
  await tick();
  assert.deepEqual(s.calls, [["b::1", "b::2"]], "b::0 was already drafted");
});

test("D102 P4 · Auto settings' job profile is the one the run reads — and only one of the user's own", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /boardProfileId: Number\.isInteger\(settings\.profileId\) \? settings\.profileId : undefined/);
  assert.match(src, /SELECT \* FROM domain_profiles WHERE id = \? AND user_id = \?"\)\.get\(req\.boardProfileId, req\.user\.id\)/);
  assert.match(src, /const sessionActiveProfile = namedProfile \|\| getOrRepairActiveProfile\(req\.user\.id\);/);
  const sched = fs.readFileSync("services/autoScheduler.js", "utf8");
  assert.match(sched, /fetchBoard\(u\.id, settings\.filters, settings\)/);
});

// D102 P5 · Draft House knows the JOB id; the same detail is found by it — the caller's own record only.
test("D102 · GET /api/pipeline/job-for/:jobId opens the same detail as the record id; another user's job is 404", async () => {
  const db = freshDb();
  const id = draft(db, { jobId: "gh::by-job", status: "held_review", reason: "incomplete_form" });
  draft(db, { userId: 2, jobId: "gh::theirs" });
  const t = mount(db);
  try {
    const byJob = await t.call("GET", `/api/pipeline/job-for/${encodeURIComponent("gh::by-job")}`);
    const byRec = await t.call("GET", `/api/pipeline/job/${id}`);
    assert.equal(byJob.status, 200);
    assert.deepEqual(byJob.body, byRec.body);
    assert.equal((await t.call("GET", `/api/pipeline/job-for/${encodeURIComponent("gh::theirs")}`)).status, 404);
    assert.equal((await t.call("GET", "/api/pipeline/job-for/nope")).status, 404);
  } finally { t.stop(); }
});

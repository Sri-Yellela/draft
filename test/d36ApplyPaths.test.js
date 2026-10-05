import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tmpPdfPath } from "../routes/apply.js";
import { describeApplication } from "../client/src/lib/applyObstacles.js";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";

// D36 — EVERY APPLY PATH, END TO END. Each test here pins a defect the walk found against the local
// fake ATS on a throwaway server (synthetic user, keys blanked); the walk itself is in the D36 report
// and docs/D36_ATTENDED_RUNBOOK.md. Read the source as text with line endings normalised, because
// the tree is CRLF on Windows and LF elsewhere and neither is what these assertions are about.
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ── 1 · A résumé that was written must not be reported as never written ──────────────────────────
// Walked 10-05: Draft → preview → Approve. The approved run generated the résumé (artifact 8, score
// 90), then held `resume_unavailable` — "No resume was generated, so there was nothing to attach".
// The temp PDF name embedded the job id (`greenhouse::6110219004` shape) and `:` is illegal in a
// Windows path; `catch { return null; }` hid the ENOENT. Two defects: the name, and the silence.

test("D36 · the temp PDF name is portable: a real job id with '::' yields no colon in the file name", () => {
  const p = tmpPdfPath("resume", 83, "greenhouse::6110219004", 1791240074381);
  assert.equal(path.dirname(p), os.tmpdir());
  const base = path.basename(p);
  assert.doesNotMatch(base, /[:<>"|?*\\/]/, `not a portable file name: ${base}`);
  assert.equal(base, "resume_83_greenhouse_6110219004_1791240074381.pdf");
  // Something a person can still trace back to the job and the user.
  assert.match(tmpPdfPath("cl", 7, "lever::abc-123"), /cl_7_lever_abc-123_\d+\.pdf$/);
});

test("D36 · every run-time PDF goes through tmpPdfPath — no raw job id in a temp file name", () => {
  const src = read("routes/apply.js");
  assert.doesNotMatch(src, /path\.join\(os\.tmpdir\(\),\s*`(?:resume|cl)_\$\{userId\}_\$\{jobId\}/,
    "a temp PDF path still interpolates the raw job id");
  assert.ok((src.match(/tmpPdfPath\("resume", userId, jobId\)/g) || []).length >= 3, "the three résumé sites");
  assert.ok((src.match(/tmpPdfPath\("cl", userId, jobId\)/g) || []).length >= 3, "the three cover-letter sites");
});

test("D36 · a failed résumé PDF is RECORDED as resume_pdf_failed, never swallowed into resume_unavailable", () => {
  const src = read("routes/apply.js");
  // Each place a GENERATED résumé is converted for upload (semi's CASE B, approved/auto CASE C).
  const sites = [...src.matchAll(/await htmlToPdf\(gen\.html\);[\s\S]{0,400}?\}\s*catch\s*(\([^)]*\))?\s*\{([\s\S]{0,300}?)\n\s{10}\}/g)];
  assert.equal(sites.length, 2, "expected the two generated-résumé conversion sites");
  for (const m of sites) {
    assert.ok(m[1], "the catch binds the error — a bare `catch {` cannot say what failed");
    assert.match(m[2], /docFailure = resumePdfFailure\(e\)/, "the failure is kept for attribution");
    assert.match(m[2], /logEvent\([^)]*"resume_pdf_failed"/, "and written to the run's own history");
  }
  // And it outranks the browser's downstream symptom when the row's reason is chosen.
  assert.match(src, /: genFailure \? genFailure\.reasonCode\n\s*: docFailure \? docFailure\.reasonCode\n\s*: atsHeld/);
  assert.match(src, /const reasonDetail = genFailure \? genFailure\.detail : docFailure \? docFailure\.detail/);
});

test("D36 · the user is told the résumé EXISTS, and is not offered to generate another", () => {
  const o = describeApplication({ status: "held_review", reasonCode: "resume_pdf_failed" });
  assert.notEqual(o.obstacle, "resume pdf failed", "resume_pdf_failed has no copy in client/src/lib/applyObstacles.js");
  assert.match(o.obstacle, /written/i);
  assert.doesNotMatch(o.obstacle, /no r[ée]sum[ée] was generated/i);
  assert.equal(o.resumeBlocked, false, "a Generate button would point at a résumé the user already has");
  assert.equal(o.retryable, true);
});

// ── shared harness: the real schema, the real routes, no browser ─────────────────────────────────
function mount({ env = {} } = {}) {
  const prev = {};
  for (const [k, v] of Object.entries(env)) { prev[k] = process.env[k]; process.env[k] = v; }
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Dana','Example','dana@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume text',unixepoch())").run();
  // An UNROUTABLE apply URL: any path that wrongly reaches the browser fails at navigation, never
  // at a real employer.
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash)
              VALUES ('gh::1','Backend Engineer','Northwind','http://127.0.0.1:9/gh','http://127.0.0.1:9/gh?ats=boards.greenhouse.io','t','h1')`).run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  const hooks = applyRoutes(app, db, (req, _res, next) => next(),
    () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = (p) => fetch(base + p).then(r => r.json());
  const stop = () => {
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    server.close();
  };
  return { db, post, get, hooks, stop };
}
const waitFor = async (fn, ms = 5000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 25)); }
  return fn();
};
const statusOf = (db, id) => db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(id);

// ── 7 · FULL AUTO RUNS ATTENDED ONLY ──────────────────────────────────────────────────────────────
// Found 10-05: FULL_AUTO_PROVEN = false shaped only the run bar. POST /api/apply/runs with
// approvalMode:'auto' (and /api/apply/answers, "answer-and-send in one step") still started a run that
// SUBMITTED to the employer unattended — test/applyApprovalFlow.test.js even pinned that it did.

test("D36·7 · the lock is a literal at module scope that nothing can reassign or read from config", () => {
  const src = read("routes/apply.js");
  assert.match(src, /\nconst FULL_AUTO_PROVEN = false;\n/, "a module-scope literal false");
  assert.equal((src.match(/FULL_AUTO_PROVEN\s*=(?!=)/g) || []).length, 1, "declared once, never reassigned");
  const at = src.indexOf("const FULL_AUTO_PROVEN");
  assert.doesNotMatch(src.slice(at, at + 60), /process\.env|app_settings|getSetting|envInt/);
  // Read by the bar, by admission and by processing — not by the bar alone.
  assert.ok((src.match(/!FULL_AUTO_PROVEN/g) || []).length >= 3, "autoModeState, startRun and processRunJob all read it");
  assert.match(src, /resolvedMode === "auto" && resolvedApproval === "auto" && !FULL_AUTO_PROVEN/);
  assert.match(src, /mode === "auto" && approvalMode === "auto" && !FULL_AUTO_PROVEN/);
});

test("D36·7 · POST /api/apply/runs refuses approvalMode:'auto' — 403 full_auto_locked, nothing queued", async () => {
  const t = mount();
  try {
    const r = await t.post("/api/apply/runs", { jobIds: ["gh::1"], mode: "auto", approvalMode: "auto" });
    assert.equal(r.status, 403);
    const body = await r.json();
    assert.equal(body.error, "full_auto_locked");
    assert.match(body.message, /wait for your approval/);
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM apply_runs").pluck().get(), 0);
    // The ordinary Draft is untouched: it previews and waits. (A job with no posting row, so the run
    // fails fast with job_not_found instead of opening a browser in a unit test.)
    const ok = await t.post("/api/apply/runs", { jobIds: ["no-posting::1"], mode: "auto", surface: "board" });
    assert.equal(ok.status, 202);
    assert.equal(t.db.prepare("SELECT approval_mode FROM apply_runs").pluck().get(), "required");
    assert.equal((await t.get("/api/apply/run-bar")).mode.auto.locked, true);
  } finally { t.stop(); }
});

test("D36·7 · the answers retry cannot 'answer-and-send in one step' either", async () => {
  const t = mount();
  try {
    const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'required')").run().lastInsertRowid;
    t.db.prepare(`INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code,open_questions_json)
                  VALUES (?,1,'gh::1','held_review','incomplete_form',?)`).run(run, JSON.stringify([{ question: "Start date", reason: "unanswered" }]));
    const r = await t.post("/api/apply/answers", { answers: { "Start date": "11/02/2026" }, retryJobIds: ["gh::1"], approvalMode: "auto" });
    assert.equal(r.status, 403);
    assert.equal((await r.json()).error, "full_auto_locked");
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM apply_runs WHERE approval_mode='auto'").pluck().get(), 0);
  } finally { t.stop(); }
});

test("D36·7 · a run row that would send unattended is HELD before anything opens", async () => {
  const t = mount();
  try {
    // However it got there — a legacy NULL approval_mode reads as 'auto' — boot recovery starts it.
    for (const approval of ["auto", null]) {
      const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','queued',1,?)").run(approval).lastInsertRowid;
      const rj = t.db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'gh::1','queued')").run(run).lastInsertRowid;
      t.hooks.recoverInterruptedRuns();
      assert.ok(await waitFor(() => statusOf(t.db, rj) !== "queued" && statusOf(t.db, rj) !== "running"));
      const row = t.db.prepare("SELECT status, reason_code FROM apply_run_jobs WHERE id=?").get(rj);
      assert.deepEqual([row.status, row.reason_code], ["held_review", "full_auto_locked"], `approval_mode ${approval}`);
      const events = t.db.prepare("SELECT event FROM apply_job_logs WHERE run_job_id=?").pluck().all(rj);
      assert.ok(events.includes("full_auto_locked"));
      assert.ok(!events.includes("site_visit_started"), "no browser was opened");
      await waitFor(() => t.db.prepare("SELECT COUNT(*) FROM apply_runs WHERE status IN ('queued','running')").pluck().get() === 0);
    }
  } finally { t.stop(); }
});

test("D36·7 · the user is told nothing was sent, and how to send it reviewed", () => {
  const o = describeApplication({ status: "held_review", reasonCode: "full_auto_locked" });
  assert.match(o.obstacle, /nothing was opened or sent/);
  assert.match(o.action, /wait for your approval/);
  assert.equal(o.protective, true);
});

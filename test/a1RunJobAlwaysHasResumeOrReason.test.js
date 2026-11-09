// ⭐ FIRST PRIORITY (A)-1 (45o, owner 11-08) · a1RunJobAlwaysHasResumeOrReason — "every run job either has its stored résumé
// or shows 'No résumé was made for this one — Generate it' (one press, no retries, no 404 loop)", and every run job that
// ends without one carries a reason. Run-job 16 (the 11-07 semi run): a semi run's generation failure was logged as an event
// while its row's reason_code was overwritten with 'manual_review' — no résumé, no reason. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createResumeEditorRouter } from "../routes/resumeEditor.js";

function app(db) {
  const a = express();
  a.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  a.use(createResumeEditorRouter({ db, requireAuth: (_q, _s, n) => n(), env: {} }));
  return a;
}
function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'ada', 'x')").run();
  db.prepare("INSERT INTO apply_runs (id, user_id, mode) VALUES (1, 1, 'semi')").run();
  const ins = db.prepare("INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, reason_code, resume_missing_reason, submitted_by) VALUES (?, 1, 1, ?, ?, ?, ?, ?)");
  ins.run(16, "gh::16", "held_review", "manual_review", null, null);                                  // like run-job 16: nothing recorded
  ins.run(17, "gh::17", "held_review", "manual_review", "generation_failed: tools_timeout — 504", null);
  ins.run(18, "gh::18", "submitted", null, null, "auto");                                              // sent: never regenerated
  db.prepare("INSERT INTO apply_job_logs (run_id, run_job_id, user_id, job_id, event, message) VALUES (1, 16, 1, 'gh::16', 'generation_failed', 'Resume generation returned no HTML')").run();
  return db;
}
const get = async (a, path) => {
  const server = a.listen(0);
  try { const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`); return { status: r.status, body: await r.json() }; }
  finally { server.close(); }
};

test("a1RunJobAlwaysHasResumeOrReason · no résumé always answers WHY, and whether one press can make it", async () => {
  const db = freshDb(), a = app(db);
  const r16 = await get(a, "/api/apply/run-jobs/16/resume-doc");
  assert.equal(r16.status, 404);
  assert.equal(r16.body.error, "no_resume_artifact");
  assert.equal(r16.body.message, "No résumé was made for this one.");
  assert.match(r16.body.reason, /^generation_failed: Resume generation returned no HTML/, "an older row: the run's own generation_failed event");
  assert.equal(r16.body.canGenerate, true);
  assert.equal((await get(a, "/api/apply/run-jobs/17/resume-doc")).body.reason, "generation_failed: tools_timeout — 504", "the stored reason first");
  const sent = await get(a, "/api/apply/run-jobs/18/resume-doc");
  assert.equal(sent.body.canGenerate, false, "a sent application is never regenerated");
  assert.match(sent.body.reason, /^not_made:/);
});

test("a1 · the semi run records the reason; one press generates and attaches; the attempt shows Generate it", () => {
  const apply = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(apply, /if \(usedArtifactId == null\) \{\r?\n\s+const why = genFailure \? `generation_failed: \$\{genFailure\.reasonCode\}/);
  assert.match(apply, /app\.post\("\/api\/apply\/run-jobs\/:runJobId\/generate-resume", requireAuth, async/);
  assert.match(apply, /if \(row\.submitted_by != null \|\| String\(row\.status\) === "submitted"\) return res\.status\(409\)/, "never a sent one");
  assert.match(apply, /UPDATE apply_run_jobs SET resume_artifact_id=\?, resume_ats_score=\?, resume_missing_reason=NULL WHERE id=\? AND resume_artifact_id IS NULL/);
  const ui = fs.readFileSync("client/src/components/AttemptResume.jsx", "utf8");
  assert.match(ui, /No résumé was made for this one\{missing\.canGenerate \? " — " : "\."\}/);
  assert.match(ui, /data-attempt-resume="generate"/);
  for (const f of ["server.js", "scripts/migrations.js"]) assert.match(fs.readFileSync(f, "utf8"), /id: "254_run_job_resume_missing_reason",/);
});

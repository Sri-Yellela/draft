// ⭐ FIRST PRIORITY (A)-2 (45o, owner 11-08) · the run trace in Admin → System → Runs — FA1 without database access: each
// pick, the résumé (model, cost, attached when — or why none), every answer and its source, what stopped and why, what was
// sent, the scheduler's picks + summary email, the request id. Read-only. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { listRuns, runTrace, sourceWord } from "../services/admin/runTrace.js";

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'canary', 'x')").run();
  db.prepare("INSERT INTO apply_runs (id, user_id, mode, tool_type, status, total_jobs, submitted_count, held_count, created_at, finished_at) VALUES (5, 1, 'auto', 'generate', 'done', 2, 1, 1, 1000, 2000)").run();
  db.prepare("INSERT INTO resumes (id, user_id, job_id, company, role, html, model_source, created_at) VALUES (40, 1, 'gh::1', 'Northwind', 'Data Engineer', '<p>r</p>', ?, 1100)").run(JSON.stringify({ provider: "anthropic", model: "claude-haiku-5-5", task: "resume.tailor" }));
  db.prepare(`INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, reason_code, resume_artifact_id, resume_ats_score, answers_json, blanks_json, submitted_by, submit_verified, posting_title, posting_company)
    VALUES (11, 5, 1, 'gh::1', 'submitted', NULL, 40, 81, ?, ?, 'auto', 1, 'Data Engineer', 'Northwind')`)
    .run(JSON.stringify([{ label: "Email", value: "c@example.test", provenance: "handler_exact", confidence: 1 }, { label: "Why us?", value: "…", provenance: "custom_answer" }]), JSON.stringify(["Salary expectation"]));
  db.prepare(`INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, reason_code, resume_missing_reason) VALUES (12, 5, 1, 'gh::2', 'held_review', 'ats_below_threshold', 'generation_failed: tools_timeout — 504')`).run();
  db.prepare("INSERT INTO usage_events (user_id, event_type, model, cost_usd, job_id, created_at, success) VALUES (1, 'generate', 'claude-haiku-5-5', 0.0042, 'gh::1', 1100, 1), (1, 'generate', 'claude-haiku-5-5', 0.0011, 'gh::1', 1101, 0), (1, 'generate', 'x', 9, 'gh::1', 99999, 1)").run();
  db.prepare("INSERT INTO apply_job_logs (run_id, run_job_id, user_id, job_id, event, message, created_at) VALUES (5, 11, 1, 'gh::1', 'generation_ready', 'Resume generation completed', 1105)").run();
  db.prepare("INSERT INTO picks_runs (id, user_id, slot_at, mode, seen, picked, left_out_json, expires_at, delivery_claimed_at, summary_sent_at, apply_run_id) VALUES (3, 1, 900, 'auto', 40, 2, ?, 5000, 950, 2100, 5)").run(JSON.stringify({ level: 12, sponsorship: 3 }));
  return db;
}

test("a2 · the run list carries who, mode and the counts", () => {
  const runs = listRuns(freshDb());
  assert.equal(runs.length, 1);
  assert.deepEqual([runs[0].id, runs[0].user.username, runs[0].mode, runs[0].submitted, runs[0].held], [5, "canary", "auto", 1, 1]);
});

test("a2 · one run as one table: résumé model / cost / attached, every answer's source, what stopped, what was sent, the scheduler, the request id", () => {
  const t = runTrace(freshDb(), 5);
  const [a, b] = t.jobs;
  assert.equal(a.resume.model, "claude-haiku-5-5");
  assert.equal(a.resume.costUsd, 0.0053, "the model calls for that job in the run's window only");
  assert.equal(a.resume.failedCalls, 1);
  assert.equal(a.resume.attachedAt, 1105);
  assert.deepEqual(a.answers.map(x => [x.field, x.source]), [["Email", "profile"], ["Why us?", "saved answer"], ["Salary expectation", "held for you"]]);
  assert.deepEqual(a.sent, { submittedBy: "auto", verified: true, evidence: null });
  assert.equal(a.requestId, "run5-job11");
  assert.equal(b.resume.artifactId, null);
  assert.equal(b.resume.missingReason, "generation_failed: tools_timeout — 504", "A-1's reason shows here");
  assert.equal(b.reasonCode, "ats_below_threshold");
  assert.equal(t.scheduler.summarySentAt, 2100);
  assert.equal(t.scheduler.messageAt, 950);
  assert.deepEqual(t.scheduler.leftOut, { level: 12, sponsorship: 3 });
  assert.equal(runTrace(freshDb(), 999), null);
  assert.equal(sourceWord("default"), "routine");
});

test("a2 · Admin → System → Runs; read-only", () => {
  assert.match(fs.readFileSync("client/src/panels/adminMap.js", "utf8"), /\["runs", "Runs"\]/);
  assert.match(fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8"), /\{at\("system", "runs"\) && <RunsTab\/>\}/);
  assert.doesNotMatch(fs.readFileSync("services/admin/runTrace.js", "utf8"), /\b(UPDATE|INSERT|DELETE)\b/, "the trace only reads");
});

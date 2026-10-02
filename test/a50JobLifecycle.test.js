import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { traceJobLifecycle } from "../services/jobTrace.js";
import { ingestJob } from "../services/jobs/jobGateway.js";
import { markPending } from "../services/applicationRecords.js";

// A50 step 5: one posting end to end, every decision with its reason, in time order.
test("the lifecycle names each stage a posting went through, and calls a stale score stale", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'a','x')").run();
  const job = { id: "greenhouse:acme:1", title: "Backend Engineer", company: "Acme", location: "Austin, TX",
                url: "https://job-boards.greenhouse.io/acme/jobs/1", source: "greenhouse", description: "Austin, TX. Go." };
  ingestJob(db, { job, origin: "capture", userId: 1, detectKnownAtsMatch: () => ({ type: "greenhouse", slug: "acme" }) });
  db.prepare("INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, job_hash) VALUES (1, NULL, ?, '{}', 50, 'old')").run(job.id);
  const run = db.prepare("INSERT INTO apply_runs (user_id, mode, status, total_jobs, approval_mode) VALUES (1,'auto','waiting',1,'required')").run().lastInsertRowid;
  db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, ?, 'queued')").run(run, job.id);
  markPending(db, 1, job.id, "opened_posting");

  const t = traceJobLifecycle(db, job.id);
  const stages = t.events.map(e => e.stage);
  for (const s of ["crawl", "enrichment", "scoring", "capture", "draft", "record"]) assert.ok(stages.includes(s), `has ${s}`);
  assert.match(t.events.find(e => e.stage === "scoring").detail, /STALE/);
  assert.match(t.events.find(e => e.stage === "draft").what, /waiting in line/);
  assert.match(t.events.find(e => e.stage === "capture").detail, /greenhouse\/acme/);
  assert.equal(traceJobLifecycle(db, "nope"), null);
});

test("the trace route returns it and the inspector draws it", () => {
  assert.match(fs.readFileSync("routes/adminDb.js", "utf8"), /lifecycle: traceJobLifecycle\(db, jobId\),/);
  assert.match(fs.readFileSync("client/src/pages/admin/DBInspector.jsx", "utf8"), /data-job-lifecycle/);
});

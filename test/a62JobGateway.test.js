import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { ingestJob, previewIngest, atsSlugOf } from "../services/jobs/jobGateway.js";
import { detectKnownAtsMatch } from "../services/jobs/importJob.js";
import { createJobDataRouter } from "../routes/jobData.js";

// A62 (owner, 10-02): job data in and out at will, and the jobs a user brings in through the ONE
// gateway — the same deduper, canonical write and US-only gate as every crawled source, never a
// second writer — with the ATS host + slug recorded for A45.

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  return db;
}
const usJob = (over = {}) => ({
  id: "greenhouse:northwind:101", title: "Backend Engineer", company: "Northwind",
  location: "Boston, MA", url: "https://job-boards.greenhouse.io/northwind/jobs/101", source: "greenhouse",
  description: "Build services in Go. Boston, MA.", ...over,
});

test("a capture goes through the gateway: inserted, recorded with its ATS + slug; the same posting again ATTACHES", () => {
  const db = freshDb();
  const a = ingestJob(db, { job: usJob(), origin: "capture", userId: 1, detectKnownAtsMatch });
  assert.deepEqual(a, { jobId: "greenhouse:northwind:101", action: "inserted", outOfMarket: false });
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id=?").pluck().get(a.jobId), 1);
  const cap = db.prepare("SELECT * FROM job_captures").get();
  assert.equal(cap.ats_type, "greenhouse");
  assert.equal(cap.ats_slug, "northwind", "A45 can read the board slug from the capture");
  assert.equal(cap.origin, "capture");
  assert.equal(cap.user_id, 1);

  // The same posting from a lower-priority source (an import of the same role) attaches.
  const b = ingestJob(db, { job: usJob({ id: "import:x1", source: "import", url: "https://northwind.example/careers/101" }),
    origin: "import_url", userId: 1, detectKnownAtsMatch });
  assert.equal(b.action, "attached");
  assert.equal(b.jobId, "greenhouse:northwind:101", "it attaches to the row already on the board");
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active=1").pluck().get(), 1, "no second board row");
});

test("queue 37's gate applies to a capture: outside the US it is held off the shared board, and recorded so", () => {
  const db = freshDb();
  const r = ingestJob(db, { job: usJob({ id: "greenhouse:northwind:202", location: "Dublin, Ireland",
    description: "Join our Dublin office.", url: "https://job-boards.greenhouse.io/northwind/jobs/202" }),
    origin: "capture", userId: 1, detectKnownAtsMatch });
  assert.equal(r.outOfMarket, true);
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id=?").pluck().get(r.jobId), 0);
  assert.match(db.prepare("SELECT reason FROM rejected_jobs WHERE job_id=?").pluck().get(r.jobId), /^out_of_market:/);
  assert.equal(db.prepare("SELECT out_of_market FROM job_captures WHERE job_id=?").pluck().get(r.jobId), 1);
});

test("the dry-run preview reads the same deduper and agrees with what the apply then does", () => {
  const db = freshDb();
  assert.equal(previewIngest(db, usJob()).action, "insert");
  ingestJob(db, { job: usJob(), origin: "admin_import" });
  const p = previewIngest(db, usJob({ id: "import:x2", source: "import", url: "https://northwind.example/c/101" }));
  assert.equal(p.action, "attach");
  assert.equal(p.existingJobId, "greenhouse:northwind:101");
  const before = db.prepare("SELECT COUNT(*) FROM job_captures").pluck().get();
  previewIngest(db, usJob({ id: "import:x3", source: "import" }));
  assert.equal(db.prepare("SELECT COUNT(*) FROM job_captures").pluck().get(), before, "a preview writes nothing");
  assert.equal(previewIngest(db, usJob({ id: "g:9", title: "Data Engineer", location: "Berlin, Germany",
    description: "Berlin office." })).outOfMarket, true);
});

test("importJob uses the gateway — it no longer calls the deduper or the canonical write itself", () => {
  const src = fs.readFileSync("services/jobs/importJob.js", "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /import \{ ingestJob \} from '\.\/jobGateway\.js';/);
  assert.match(src, /ingestJob\(db, \{/);
  assert.doesNotMatch(src, /reconcileFingerprint\(|upsertCanonicalJob\(/, "a second writer is back in importJob");
  // D33: the wording moved to services/jobs/captureOutcome.js, the one place every outcome is said.
  assert.match(src, /describeCapture\(db, \{/, "the gate is said, never silent");
  assert.match(fs.readFileSync("services/jobs/captureOutcome.js", "utf8"), /NOT on the shared board/);
  assert.deepEqual(atsSlugOf("https://jobs.lever.co/acme/0f8a1c2d-1111", detectKnownAtsMatch), { ats_type: "lever", ats_slug: "acme" });
  assert.deepEqual(atsSlugOf("https://example.com/job/1", detectKnownAtsMatch), { ats_type: null, ats_slug: null });
});

function mountAdmin(db) {
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use((req, _res, next) => { req.user = { id: 1, username: "admin" }; next(); });
  app.use("/api/admin/job-data", createJobDataRouter(db, (_req, _res, next) => next()));
  const server = app.listen(0);
  return { base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}
const post = (base, path, body) => fetch(`${base}${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("admin import: dry by default, then a revertible batch; revert needs the matching count", async () => {
  const db = freshDb();
  ingestJob(db, { job: usJob(), origin: "admin_import" });
  const { base, stop } = mountAdmin(db);
  try {
    const jsonl = [
      JSON.stringify({ title: "Platform Engineer", company: "Contoso", url: "https://contoso.example/jobs/1", location: "Austin, TX", description: "Austin, TX." }),
      JSON.stringify({ title: "Backend Engineer", company: "Northwind", url: "https://northwind.example/c/101", location: "Boston, MA", source: "import" }),
      JSON.stringify({ title: "SRE", company: "Fabrikam", url: "https://fabrikam.example/9", location: "London, UK", description: "London." }),
      JSON.stringify({ company: "No Title Co", url: "https://x.example/1" }),
      "{not json",
    ].join("\n");
    const rows0 = db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get();
    const dry = await (await post(base, "/api/admin/job-data/import", { jsonl })).json();
    assert.equal(dry.dryRun, true);
    assert.equal(dry.valid, 3);
    assert.deepEqual(dry.refused.map(r => r.line), [4, 5]);
    assert.equal(dry.plan.attach, 1);
    assert.equal(dry.plan.insert, 2);
    assert.equal(dry.plan.outOfMarket, 1);
    assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get(), rows0, "the dry run wrote nothing");

    const done = await (await post(base, "/api/admin/job-data/import", { jsonl, apply: true })).json();
    assert.equal(done.applied, true);
    assert.equal(done.inserted, 2);
    assert.equal(done.attached, 1);
    assert.equal(done.held, 1);
    assert.match(done.note, /not enriched yet/);

    const revertDry = await (await post(base, `/api/admin/job-data/import/batches/${done.batchId}/revert`, {})).json();
    assert.equal(revertDry.dryRun, true);
    assert.equal(revertDry.wouldRetire, 1, "the US row it inserted (the London one was already held off the board)");
    assert.match(revertDry.note, /fields they donated stay/);
    assert.equal((await post(base, `/api/admin/job-data/import/batches/${done.batchId}/revert`, { expectRows: 7 })).status, 409);
    const rev = await (await post(base, `/api/admin/job-data/import/batches/${done.batchId}/revert`, { expectRows: 1 })).json();
    assert.equal(rev.retired, 1);
    const contoso = db.prepare("SELECT is_active, retired_reason FROM scraped_jobs WHERE company='Contoso'").get();
    assert.deepEqual(contoso, { is_active: 0, retired_reason: "import_reverted" }, "soft — retired, not deleted");
    assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id='greenhouse:northwind:101'").pluck().get(), 1,
      "the posting a row attached to is untouched");
    assert.equal((await post(base, `/api/admin/job-data/import/batches/${done.batchId}/revert`, { expectRows: 1 })).status, 409);

    const exp = await fetch(`${base}/api/admin/job-data/export`);
    assert.match(exp.headers.get("content-type"), /ndjson/);
    const lines = (await exp.text()).trim().split("\n").map(l => JSON.parse(l));
    assert.ok(lines.some(l => l.job_id === "greenhouse:northwind:101"));
    assert.ok(!lines.some(l => l.company === "Contoso"), "the export is the ACTIVE board by default");
  } finally { stop(); }
});

test("server mounts the job-data router behind requireAdmin, and the Operations tab draws it", () => {
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /app\.use\("\/api\/admin\/job-data", requireAdmin, createJobDataRouter\(db, requireAdmin\)\);/);
  const ops = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(ops, /<JobDataSection theme=\{theme\}\/>/);
  assert.match(ops, /const plan = dry && dry\.forText === text \? dry\.body : null;/, "Import unlocks only for the planned text");
  assert.match(ops, /expectRows: d\.wouldRetire/, "revert sends the count its own dry run reported");
});

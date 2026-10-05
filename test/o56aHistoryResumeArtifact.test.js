// O56(a) — D15's "Download résumé" follows D16's kept copy.
//
// D15 built The Table's download link before D16 existed, so `hasResume` meant "a row in `resumes`
// for this job" — the WORKING résumé, which a regeneration overwrites and a deletion removes. D16 then
// kept the résumé an application sent, per application record, in application_artifacts. The link
// must follow the copy: a kept copy whose working résumé is gone is still downloadable, and a link
// that serves the working résumé must not say it is "the résumé sent".
// SYNTHETIC candidate throughout.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { buildHistory } from "../shared/applicationHistory.js";
import { listHistory } from "../services/applicationRecords.js";
import { snapshotResumeForRecord, SOURCES } from "../services/applicationArtifacts.js";
import applicationArtifactRoutes from "../routes/applicationArtifacts.js";

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;
const roomy = () => ({ bavail: 1e9, bsize: 4096, blocks: 2e9 });

test("buildHistory: the kept copy decides — snapshot, backfill, working résumé, or nothing", () => {
  const records = [
    { id: 11, job_id: "kept", state: "verified" },
    { id: 12, job_id: "late", state: "verified" },
    { id: 13, job_id: "work", state: "recorded" },
    { id: 14, job_id: "none", state: "pending" },
  ];
  const artifacts = [
    { record_id: 11, source: SOURCES.SNAPSHOT, created_at: NOW - 3 * DAY },
    { record_id: 12, source: SOURCES.BACKFILL, created_at: NOW - DAY },
  ];
  // "kept" has NO working résumé any more; "work" has one and no copy.
  const resumes = [{ job_id: "work", created_at: NOW - 2 * DAY }];
  const by = Object.fromEntries(buildHistory({ records, resumes, artifacts }, { now: NOW }).map(r => [r.jobId, r]));

  assert.deepEqual([by.kept.hasResume, by.kept.resumeSource, by.kept.resumeKeptAt], [true, "snapshot_at_record", NOW - 3 * DAY],
    "a kept copy is downloadable even after its working résumé is gone");
  assert.deepEqual([by.late.hasResume, by.late.resumeSource], [true, "backfill"]);
  assert.deepEqual([by.work.hasResume, by.work.resumeSource, by.work.resumeKeptAt], [true, "current_resume", null],
    "no copy: the route serves the working résumé, and the row says so");
  assert.deepEqual([by.none.hasResume, by.none.resumeSource], [false, null]);
});

test("buildHistory: no record, no link — the download is keyed on the record", () => {
  const rows = buildHistory({
    applications: [{ id: 5, job_id: "orphan", applied_at: NOW - DAY }],
    resumes: [{ job_id: "orphan", created_at: NOW - 2 * DAY }],
  }, { now: NOW });
  assert.deepEqual([rows[0].hasResume, rows[0].resumeSource], [false, null]);
});

function seed() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO'), (2,'bob','x','PRO')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,apply_url,search_query,_hash)
              VALUES ('j1','Backend Engineer','Northwind','https://northwind.example/1','t','h1')`).run();
  db.prepare("INSERT INTO resumes (user_id,job_id,company,role,html,created_at) VALUES (1,'j1','Northwind','Backend Engineer','<p>sent v1</p>',?)").run(NOW - 9 * DAY);
  db.prepare("INSERT INTO application_records (user_id,job_id,state,origin,created_at) VALUES (1,'j1','verified','manual',?)").run(NOW - 8 * DAY);
  return db;
}

test("listHistory reads D16's copy; it survives the working résumé, and stays the user's own", async () => {
  const db = seed();
  const app = express();
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  applicationArtifactRoutes(app, db, (_q, _s, next) => next());
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let row = listHistory(db, 1, { now: NOW })[0];
    assert.deepEqual([row.hasResume, row.resumeSource], [true, "current_resume"], "before a copy is kept");

    assert.equal(snapshotResumeForRecord(db, { userId: 1, jobId: "j1", statfs: roomy }).stored, true);
    // The working résumé goes (regenerated elsewhere, or deleted). The kept copy must still be offered…
    db.prepare("DELETE FROM resumes WHERE user_id = 1 AND job_id = 'j1'").run();
    row = listHistory(db, 1, { now: NOW })[0];
    assert.deepEqual([row.hasResume, row.resumeSource], [true, "snapshot_at_record"]);
    assert.ok(row.resumeKeptAt > 0);

    // …and the link it offers is one the route actually serves, as the same source.
    const r = await fetch(`${base}/api/applications/${row.recordId}/resume`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-artifact-source"), row.resumeSource);
    assert.equal(await r.text(), "<p>sent v1</p>");

    // Another user's history never sees this copy.
    db.prepare("INSERT INTO application_records (user_id,job_id,state,origin) VALUES (2,'j1','verified','manual')").run();
    const bob = listHistory(db, 2, { now: NOW })[0];
    assert.deepEqual([bob.hasResume, bob.resumeSource], [false, null]);
    assert.ok(!JSON.stringify(listHistory(db, 1, { now: NOW })).includes("sent v1"), "metadata only — never the body");
  } finally { server.close(); db.close(); }
});

test("the panel words the link by source — only a kept copy is 'the résumé sent'", () => {
  const src = fs.readFileSync("client/src/components/ApplicationHistory.jsx", "utf8");
  assert.match(src, /snapshot_at_record:\s*\{\s*title: "Download the résumé sent with this application"/);
  assert.match(src, /current_resume:\s*\{\s*title: "No copy was kept when you applied/);
  assert.match(src, /backfill:\s*\{/);
  assert.equal((src.match(/title=\{resumeLink\(row\)\.title\}/g) || []).length, 2, "both download controls use it");
  assert.doesNotMatch(src, /title="Download the résumé sent with this application"/, "no fixed claim left on a control");
  assert.doesNotMatch(src, /\.pdf`;/, "the route serves HTML; the fallback name must not say .pdf");
});

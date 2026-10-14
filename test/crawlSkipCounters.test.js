// 43d · The two postings a crawl skipped without counting — so the admin funnel had to state an
// "uncounted" remainder (production greenhouse 10-14: 853 of 15,998), and a run that boarded nothing with
// any such remainder read wrote_nothing even when every posting was held off on purpose.
//
//   retiredReseen — a posting an EARLIER sweep retired (age or scope), fetched again and stopped at the
//                   same gate. Held off on purpose: counted in heldOff, so an all-retired run is all_rejected.
//   noId          — no id and no url, nothing to key a row on. A parse failure, NOT in heldOff: a run of
//                   nothing else still reads wrote_nothing.
//
// Whole crawls through cacheJobs with a fake source (the crawlNoRoleRescue harness). Synthetic postings.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { cacheJobs } from "../services/jobs/aggregator.js";
import { setPolicy } from "../services/jobs/boardAge.js";
import { normalizeJob } from "../services/jobs/schema.js";
import { runFunnel } from "../services/ingestFunnel.js";
import { recordPipelineRun } from "../services/jobs/pipelineRunLog.js";
import { createAdminDbRouter } from "../routes/adminDb.js";

const HOUR = 3600, DAY = 24 * HOUR;
const T0 = 1_900_000_000;

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("UPDATE company_ats_list SET active = 0").run();
  db.prepare("INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, active) VALUES ('Synthco', 'greenhouse', 'synthco', 1)").run();
  return db;
}

function posting(n, overrides = {}) {
  return normalizeJob({
    id: `sk-${n}`, req_id: `sk-${n}`, title: "Backend Software Engineer", company: "Synthco", location: "Austin, TX",
    url: `https://job-boards.greenhouse.io/synthco/jobs/${n}`, source: "greenhouse",
    description: "Synthco is hiring a backend software engineer in Austin, TX to build APIs and services.",
    posted_at: new Date((T0 - 2 * DAY) * 1000).toISOString(),
    ...overrides,
  });
}

async function crawlAt(db, seconds, jobs) {
  const source = { name: "greenhouse", isConfigured: () => true, search: async () => ({ jobs }) };
  const realNow = Date.now;
  Date.now = () => (T0 + seconds) * 1000;
  try { await cacheJobs(db, null, { sources: [source] }); }
  finally { Date.now = realNow; }
  return db.prepare("SELECT * FROM pipeline_runs WHERE source = 'greenhouse' ORDER BY id DESC LIMIT 1").get();
}

const details = (run) => JSON.parse(run.details_json);

test("a posting retired for age, re-seen on the next crawl, is counted retiredReseen — the funnel sums to the fetch", async () => {
  const db = freshDb();
  const job = posting(1);
  const first = await crawlAt(db, 0, [job]);
  assert.equal(first.written, 1, "on the board after the first crawl");

  setPolicy(db, { age_enforce: true });
  const aged = await crawlAt(db, 125 * DAY, [job]);
  assert.equal(details(aged).agedOut, 1, "retired by this run: it was on the board");
  assert.equal(details(aged).retiredReseen, 0);

  const again = await crawlAt(db, 126 * DAY, [job]);
  assert.equal(details(again).agedOut, 0, "already off the board — not news");
  assert.equal(details(again).retiredReseen, 1, "but counted, not lost");
  const f = runFunnel(again);
  assert.equal(f.uncounted, 0, "nothing is left unaccounted for");
  assert.equal(f.heldOff, 1, "held off on purpose");
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE source = 'greenhouse'").pluck().get(), 0, "the gate still stops it before the touch");
});

test("a posting with no id and no url is counted noId", async () => {
  const db = freshDb();
  const idless = { ...posting(2), id: "", url: "" };
  const run = await crawlAt(db, 0, [posting(3), idless]);
  assert.equal(run.fetched, 2);
  assert.equal(run.written, 1);
  assert.equal(details(run).noId, 1);
  assert.equal(runFunnel(run).uncounted, 0);
});

async function healthOf(fields) {
  const db = freshDb();
  const now = Math.floor(Date.now() / 1000);
  recordPipelineRun(db, { runKind: "source_sync", source: "ashby", status: "ok", startedAt: now - 60, ...fields });
  const app = express();
  app.use((req, _res, next) => { req.user = { isAdmin: true }; next(); });
  app.use("/api/admin/db", createAdminDbRouter(db, {}));
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/db/pipeline-health`);
    return (await res.json()).sources.find(s => s.name === "ashby");
  } finally { server.close(); }
}

test("a run whose fetch is all already-retired postings is all_rejected (a warn), not wrote_nothing", async () => {
  const s = await healthOf({ fetched: 40, written: 0, unchanged: 0, details: { tooOld: 10, retiredReseen: 30, noId: 0 } });
  assert.equal(s.funnel.uncounted, 0);
  assert.equal(s.health, "all_rejected");
});

test("a run whose fetch had no ids is still wrote_nothing — a parse failure is not a deliberate hold", async () => {
  const s = await healthOf({ fetched: 40, written: 0, unchanged: 0, details: { noId: 40 } });
  assert.equal(s.funnel.uncounted, 0, "counted");
  assert.equal(s.funnel.heldOff, 0, "but not held off on purpose");
  assert.equal(s.health, "wrote_nothing");
});

test("a run recorded before 43d keeps its stated remainder", () => {
  const f = runFunnel({ fetched: 100, written: 10, unchanged: 0, merged: 0, details_json: JSON.stringify({ tooOld: 60 }) });
  assert.equal(f.skippedTotal, 0);
  assert.equal(f.uncounted, 30);
  assert.match(f.uncountedNote, /before 43d/);
});

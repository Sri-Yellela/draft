// ⭐ D187 HB-INFRA · HB-5 (dedupe + merge), HB-6 (through the one gateway), HB-7 (the runners), HB-8 (the filter) — OFFLINE.
// A fake Hirebase answers the client (d171's rule: no test reaches the live API).
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createHirebaseClient } from "../services/hirebase/client.js";
import { landHirebaseJob } from "../services/hirebase/ingest.js";
import { runSample, runSizing, runIncremental, runExpired, ageOut, INCREMENTAL_OVERLAP_MS } from "../services/hirebase/runners.js";
import { buildSearchBody, requestableCategories, categoryMap } from "../services/hirebase/filter.js";
import { purgeHirebase } from "../scripts/hirebasePurge.mjs";
import { CAPTURE_ORIGINS } from "../services/jobs/jobGateway.js";

const quiet = { log() {}, warn() {}, error() {} };
const ENV_LIVE = { HIREBASE_KEY: "k-test", HIREBASE_ENABLED: "1", HIREBASE_DRY_RUN: "0" };
const db0 = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };
const job = (over = {}) => ({
  _id: "hb1", company_name: "Northwind Analytics", job_title: "Backend Engineer", application_link: "https://jobs.example.com/northwind/123",
  description_raw: "<p>Build services in Go and Postgres for our US customers. Boston, MA office.</p>", locations: [{ city: "Boston", region: "Massachusetts", country: "United States" }],
  location_type: "Hybrid", job_type: "Full Time", date_posted: "2026-11-09", first_ingested: "2026-11-09T12:00:00Z", job_board: "workday",
  platform_job_id: "R-123", md5_hash: "m1", technologies: ["Go"], skills: ["APIs"], contact_email: "hm@example.com", coolness_score: 9, ...over });
const res = (status, json, headers = {}) => ({ status, ok: status < 300, headers: new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])), text: async () => JSON.stringify(json) });

test("hbFilterFromTaxonomy: the body is built from draft's files — requestable categories only, US, raw description, boards excluded only when switched", () => {
  const cats = requestableCategories();
  assert.ok(cats.includes("Software Engineer Jobs"));
  for (const never of categoryMap().never) assert.ok(!cats.includes(never), never);
  const b = buildSearchBody({ categories: ["Software Engineer Jobs"], daysAgo: 1, limit: 100 });
  assert.deepEqual(b.geo_locations, [{ country: "United States" }]);
  assert.equal(b.return_raw_description, "true"); assert.equal(b.hide_recruiting_agencies, "true"); assert.equal(b.filter_incomplete_jobs, "false", "owner 11-10: incomplete listings are requested");
  assert.equal(b.exclude_job_board, undefined, "skipOurBoards is OFF until the sample measures the overlap");
  assert.deepEqual(buildSearchBody({ skipOurBoards: true }).exclude_job_board, ["greenhouse", "lever", "ashby", "smartrecruiters", "workable"]);
  assert.throws(() => buildSearchBody({ categories: ["Healthcare Services Jobs"] }), /not a requestable category/, "D127's held set is never requested");
  assert.equal(buildSearchBody({ limit: 500 }).limit, 100);
});

test("hbIdempotentById + HB-6: a Hirebase job lands through the one gateway; the same _id twice is one posting", () => {
  const db = db0();
  assert.ok(CAPTURE_ORIGINS.includes("hirebase"));
  const a = landHirebaseJob(db, job());
  assert.equal(a.action, "new"); assert.equal(a.jobId, "hirebase::hb1");
  const b = landHirebaseJob(db, job({ md5_hash: "m2" }));
  assert.equal(b.jobId, "hirebase::hb1");
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE source = 'hirebase'").pluck().get(), 1);
  const row = db.prepare("SELECT source, source_id, platform_job_id, first_ingested, is_active FROM scraped_jobs WHERE job_id = 'hirebase::hb1'").get();
  assert.deepEqual(row, { source: "hirebase", source_id: "hb1", platform_job_id: "R-123", first_ingested: "2026-11-09T12:00:00Z", is_active: 1 });
  assert.ok(db.prepare("SELECT 1 FROM job_role_map WHERE job_id = 'hirebase::hb1'").get(), "classified by the same write as any crawled row");
  const raw = db.prepare("SELECT payload_json FROM hirebase_raw WHERE hb_id = 'hb1'").pluck().get();
  assert.doesNotMatch(raw, /hm@example\.com|coolness_score/, "contact fields and scores never stored");
});

test("hbDedupeCrawlWins: our crawled copy (same ATS id) is not rewritten — only its empty fields are filled", () => {
  const db = db0();
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, source, url, description, is_active)
    VALUES ('greenhouse::555', 'q', 'Acme', 'Platform Engineer (crawled)', 'h', 'greenhouse', 'https://boards.greenhouse.io/acme/jobs/555', 'crawled text', 1)`).run();
  const r = landHirebaseJob(db, job({ _id: "hb2", job_board: "greenhouse", platform_job_id: "555", job_title: "Platform Engineer", company_name: "Acme" }));
  assert.equal(r.action, "merged"); assert.equal(r.jobId, "greenhouse::555");
  const row = db.prepare("SELECT title, description, source, source_id, platform_job_id FROM scraped_jobs WHERE job_id = 'greenhouse::555'").get();
  assert.equal(row.title, "Platform Engineer (crawled)"); assert.equal(row.description, "crawled text"); assert.equal(row.source, "greenhouse");
  assert.equal(row.source_id, null, "a crawled row's source id stays the crawl's"); assert.equal(row.platform_job_id, "555");
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get(), 1, "no second posting");
});

test("hbHeldStaysHeld: a posting outside the US is held off the board by the same gate as a crawled one", () => {
  const db = db0();
  const r = landHirebaseJob(db, job({ _id: "hb3", locations: [{ city: "Toronto", region: "Ontario", country: "Canada" }], description_raw: "<p>Toronto office, Canada.</p>" }));
  assert.equal(r.outOfMarket, true);
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = 'hirebase::hb3'").pluck().get(), 0);
});

test("HB-7: the sample is one capped page through the guard; a dry run sends nothing and records the request", async () => {
  const db = db0();
  let sent = null;
  const live = createHirebaseClient({ db, env: ENV_LIVE, log: quiet,
    fetchImpl: async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return res(200, { jobs: [job(), job({ _id: "hb9", platform_job_id: "R-9", application_link: "https://jobs.example.com/9", job_title: "Data Engineer" })], total_pages: 3 },
      { "Hirebase-Usage-Meter": "m_jobs_api_calls", "Hirebase-Usage-Included-Used": 2 }); } });
  const r = await runSample(db, live);
  assert.equal(sent.url, "https://api.hirebase.org/v2/jobs/search");
  assert.deepEqual(sent.body.job_category, ["Software Engineer Jobs"]); assert.equal(sent.body.days_ago, 1); assert.equal(sent.body.limit, 100);
  assert.equal(sent.body.exclude_job_board, undefined, "the sample does NOT skip our boards — it measures the overlap");
  assert.deepEqual(r.counts, { returned: 2, new: 2, merged: 0, dropped: 0, held: 0 });
  const run = db.prepare("SELECT kind, status, units_used, pages_done, dry_run FROM hirebase_runs WHERE id = ?").get(r.runId);
  assert.deepEqual(run, { kind: "sample", status: "done", units_used: 2, pages_done: 1, dry_run: 0 }, "one page only, though 3 exist");
  let calls = 0;
  const dry = createHirebaseClient({ db: db0(), env: { HIREBASE_KEY: "k", HIREBASE_ENABLED: "1" }, log: quiet, fetchImpl: async () => { calls++; return res(200, {}); } });
  const d = await runSample(dry.db || db0(), dry);
  assert.equal(d.dryRun, true); assert.equal(calls, 0);
});

test("HB-7: sizing uses the free estimate (limit 0); the guard is never in the way of a free call", async () => {
  const db = db0();
  const bodies = [];
  const c = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async (url, init) => { bodies.push({ url, body: JSON.parse(init.body) }); return res(200, { cost: 1234 }); } });
  db.prepare("INSERT INTO hirebase_usage (day, meter, units) VALUES ('2026-11-01', 'm_jobs_api_calls', 500)").run();   // at the Free cap
  const r = await runSizing(db, c, [{ label: "SWE 1 day", body: buildSearchBody({ categories: ["Software Engineer Jobs"], daysAgo: 1 }) }]);
  assert.equal(bodies[0].url, "https://api.hirebase.org/v2/jobs/estimate"); assert.equal(bodies[0].body.limit, 0);
  assert.deepEqual(r.estimates, [{ label: "SWE 1 day", count: 1234, dryRun: false }]);
});

test("hbIncrementalOverlap: ingested_after = the last incremental's start − 2 h, oldest first", async () => {
  const db = db0();
  const start = Math.floor(Date.parse("2026-11-10T10:00:00Z") / 1000);
  db.prepare("INSERT INTO hirebase_runs (kind, status, dry_run, started_at) VALUES ('incremental', 'done', 0, ?)").run(start);
  let body = null;
  const c = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async (_u, init) => { body = JSON.parse(init.body); return res(200, { jobs: [], total_pages: 1 }); } });
  await runIncremental(db, c);
  assert.equal(body.ingested_after, new Date(start * 1000 - INCREMENTAL_OVERLAP_MS).toISOString().replace(/\.\d{3}Z$/, "Z"));
  assert.equal(body.sort_by, "first_ingested"); assert.equal(body.sort_order, "asc");
});

test("hbExpiredRemoves + aging: the free expired feed retires Hirebase-only rows; 90 days old retires too; a crawled row is the crawl's", async () => {
  const db = db0();
  landHirebaseJob(db, job());
  landHirebaseJob(db, job({ _id: "old", platform_job_id: "R-old", application_link: "https://jobs.example.com/old", date_posted: "2026-06-01", job_title: "Old Role" }));
  const c = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async (url) => { assert.match(url, /\/v2\/jobs\/expired-jobs\?since=/); return res(200, { jobs: [{ _id: "hb1" }], total_pages: 1 }); } });
  const r = await runExpired(db, c, { nowMs: Date.parse("2026-11-10T12:00:00Z") });
  assert.equal(r.retired, 1);
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = 'hirebase::hb1'").pluck().get(), 0);
  assert.equal(ageOut(db, { nowMs: Date.parse("2026-11-10T12:00:00Z") }), 1);
  assert.equal(db.prepare("SELECT retired_reason FROM scraped_jobs WHERE job_id = 'hirebase::old'").pluck().get(), "hirebase_aged");
});

test("hbPurgeOnCopy: the termination path counts first, then removes every Hirebase posting and reduces snapshots", () => {
  const db = db0();
  landHirebaseJob(db, job());
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, source, url, is_active) VALUES ('lever::1', 'q', 'Keep', 'Kept', 'h', 'lever', 'u', 1)`).run();
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u', 'x')").run();
  const run = db.prepare("INSERT INTO apply_runs (user_id, mode, status, total_jobs) VALUES (1, 'semi', 'completed', 1)").run().lastInsertRowid;
  db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, posting_title, posting_company, posting_description, posting_url)
    VALUES (?, 1, 'hirebase::hb1', 'submitted', 'Backend Engineer', 'Northwind Analytics', 'the text', 'https://jobs.example.com/northwind/123')`).run(run);
  assert.deepEqual(purgeHirebase(db), { dryRun: true, postings: 1, raw: 1, snapshots: 1 });
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get(), 2, "a dry run removes nothing");
  purgeHirebase(db, { dryRun: false });
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE source = 'hirebase'").pluck().get(), 0);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE job_id = 'lever::1'").pluck().get(), 1, "crawled rows untouched");
  assert.equal(db.prepare("SELECT COUNT(*) FROM hirebase_raw").pluck().get(), 0);
  const snap = db.prepare("SELECT posting_title, posting_company, posting_description, posting_url FROM apply_run_jobs").get();
  assert.deepEqual(snap, { posting_title: "Backend Engineer", posting_company: "Northwind Analytics", posting_description: null, posting_url: null });
});

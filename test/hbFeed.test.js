// ⭐ HB-FEED (owner 11-10): Starter as a daily fresh feed — FEED-0's report, FEED-1's paced budget, FEED-2's lagged
// non-overlapping windows, FEED-3's split, FEED-4's 30-day age-out, FEED-5's panel. OFFLINE (a fake Hirebase; d171's rule).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createHirebaseClient } from "../services/hirebase/client.js";
import { landHirebaseJob } from "../services/hirebase/ingest.js";
import { runSample, runIncremental, ageOut, MAX_AGE_DAYS } from "../services/hirebase/runners.js";
import { budget, split, windowFor, runFeedHour, feedState, setShares, shares, setFeedSwitch, validShares, FAMILIES, RESERVE } from "../services/hirebase/feed.js";
import { sampleReport } from "../services/hirebase/sampleReport.js";
import { setSetting } from "../services/appSettings.js";
import { MONTH_CAP_KEY, DAY_CAP_KEY } from "../services/hirebase/spendGuard.js";

const quiet = { log() {}, warn() {}, error() {} };
const ENV_LIVE = { HIREBASE_KEY: "k-test", HIREBASE_ENABLED: "1", HIREBASE_DRY_RUN: "0" };
const db0 = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };
const starter = (db) => { setSetting(db, MONTH_CAP_KEY, "25000"); setSetting(db, DAY_CAP_KEY, "2000"); return db; };
const res = (status, json) => ({ status, ok: status < 300, headers: new Map(), text: async () => JSON.stringify(json) });
let seq = 0;
const job = (over = {}) => ({ _id: `hb${++seq}`, company_name: `Co ${seq}`, job_title: "Backend Engineer", application_link: `https://boards.greenhouse.io/co${seq}/jobs/${seq}`,
  description_raw: "<p>Build services in Go for US customers. Boston, MA.</p>", locations: [{ city: "Boston", region: "Massachusetts", country: "United States" }],
  job_type: "Full Time", date_posted: "2026-11-10", first_ingested: "2026-11-10T09:30:00Z", job_board: "greenhouse", platform_job_id: `P${seq}`, technologies: ["Go"], ...over });
const use = (db, day, units) => db.prepare(`INSERT INTO hirebase_usage (day, meter, units) VALUES (?, 'm_jobs_api_calls', ?)`).run(day, units);

test("feedDailyBudgetPaced: (usable − used before today) ÷ days left, released evenly over the hours left", () => {
  const db = starter(db0());
  const b = budget(db, { nowMs: Date.parse("2026-11-01T00:10:00Z") });
  assert.equal(b.usable, 23750); assert.equal(b.daysLeft, 30);
  assert.equal(b.today, Math.floor(23750 / 30));            // 791
  assert.equal(b.hour, Math.floor(791 / 24));               // 32
  const late = budget(db, { nowMs: Date.parse("2026-11-01T23:10:00Z") });
  assert.equal(late.hour, 791, "the last hour of the day gets what is left of the day");
});

test("feedLeftoverSpreadsNotBanked: a quiet month spreads its leftover over the days left; a busy one shrinks the days after", () => {
  const db = starter(db0());
  setSetting(db, DAY_CAP_KEY, "5000");
  use(db, "2026-11-01", 0);
  const quiet = budget(db, { nowMs: Date.parse("2026-11-20T00:00:00Z") });
  assert.equal(quiet.today, Math.floor(23750 / 11), "unspent allowance spread over the 11 days left, not dumped today");
  use(db, "2026-11-02", 20000);
  const busy = budget(db, { nowMs: Date.parse("2026-11-20T00:00:00Z") });
  assert.equal(busy.today, Math.floor(3750 / 11));
  setSetting(db, DAY_CAP_KEY, "300");
  assert.equal(budget(db, { nowMs: Date.parse("2026-11-20T00:00:00Z") }).today, 300, "the day cap still bounds a day");
});

test("feedReserveKept: 5 % of the month is never budgeted", () => {
  const db = starter(db0());
  use(db, "2026-11-02", 23750);
  const b = budget(db, { nowMs: Date.parse("2026-11-15T00:00:00Z") });
  assert.equal(RESERVE, 0.05); assert.equal(b.reserve, 1250); assert.equal(b.today, 0); assert.equal(b.hour, 0);
});

test("feedLaggedWindowsNoOverlap: [T−3h, T−2h) — consecutive hours tile time with no overlap and no gap", () => {
  const a = windowFor(Date.parse("2026-11-10T12:40:00Z")), b = windowFor(Date.parse("2026-11-10T13:05:00Z"));
  assert.deepEqual(a, { after: "2026-11-10T09:00:00Z", before: "2026-11-10T10:00:00Z" });
  assert.equal(b.after, a.before);
});

test("feedSplitSumsTo100 + feedPanelSharesEditable: defaults total 100; slices sum to the budget; edits must total 100", () => {
  assert.equal(FAMILIES.reduce((a, f) => a + f.share, 0), 100);
  const db = db0();
  for (const n of [0, 1, 7, 32, 791]) assert.equal(Object.values(split(n, shares(db))).reduce((a, x) => a + x, 0), n, `split(${n})`);
  assert.equal(validShares({ software: 50 }).ok, false);
  assert.throws(() => setShares(db, { software: 60, data: 30 }), /must be 100/);
  setShares(db, { software: 60, data: 40 });
  assert.equal(shares(db).software, 60); assert.equal(shares(db).pm, 0);
  assert.equal(split(10, shares(db)).pm, 0, "a 0 % family gets nothing");
});

test("feedOnlyPast24h + feedVisaFirstWithinSlice + no job billed twice: each family asks visa first then non-visa, posted ≤ 1 day, inside the window", async () => {
  const db = starter(db0());
  const bodies = [];
  const c = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async (_u, init) => {
    const b = JSON.parse(init.body); bodies.push(b);
    return res(200, { jobs: b.visa === "true" ? [job({ visa_sponsored: true })] : [], total_pages: 1 });
  } });
  setFeedSwitch(db, { on: true });
  const now = Date.parse("2026-11-01T12:10:00Z");
  const r = await runFeedHour(db, c, { nowMs: now });
  assert.ok(!r.skipped, JSON.stringify(r));
  for (const b of bodies) {
    assert.equal(b.days_ago, 1); assert.equal(b.ingested_after, "2026-11-01T09:00:00Z"); assert.equal(b.ingested_before, "2026-11-01T10:00:00Z");
    assert.ok(b.visa === "true" || b.visa === "false", "visa always set, so the two halves never return the same job");
  }
  const sw = bodies.filter(b => b.job_category.includes("Software Engineer Jobs"));
  assert.equal(sw[0].visa, "true"); assert.equal(sw[1].visa, "false");
  assert.ok(r.perFamily.software.visa >= 1);
  const again = await runFeedHour(db, c, { nowMs: now + 20 * 60_000 });
  assert.equal(again.skipped, "window_done", "a window that ran is never bought again");
});

test("feedUnspentFlowsToNextFamily: a family whose slice comes back short hands the rest to the next", async () => {
  const db = starter(db0());
  setShares(db, { software: 50, data: 50 });
  const limits = [];
  const c = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async (_u, init) => {
    const b = JSON.parse(init.body); limits.push([b.job_category[0], b.visa, b.limit]);
    return res(200, { jobs: [], total_pages: 1 });                       // nothing new anywhere
  } });
  const r = await runFeedHour(db, c, { nowMs: Date.parse("2026-11-01T12:10:00Z"), force: true });
  const slice = r.perFamily.software.slice;
  assert.equal(limits[0][2], slice, "software asks for its slice");
  const dataAsk = limits.find(l => l[0] === "Data Analyst Jobs");
  assert.equal(dataAsk[2], Math.min(100, slice + r.perFamily.data.slice), "data asks for its slice + software's unspent");
});

test("feed OFF by default: no switch → nothing sent; Pause stops it; the client's dry run still sends nothing", async () => {
  const db = starter(db0());
  let calls = 0;
  const live = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async () => { calls++; return res(200, { jobs: [] }); } });
  assert.equal((await runFeedHour(db, live)).skipped, "feed_off");
  setFeedSwitch(db, { on: true, paused: true });
  assert.equal((await runFeedHour(db, live)).skipped, "paused");
  setFeedSwitch(db, { paused: false });
  const dry = createHirebaseClient({ db, env: {}, log: quiet, fetchImpl: async () => { calls++; return res(200, { jobs: [] }); } });
  const r = await runFeedHour(db, dry, { nowMs: Date.parse("2026-11-01T12:10:00Z") });
  assert.equal(r.dryRun, true); assert.equal(calls, 0);
});

test("feed runs don't move the plain incremental's cursor", async () => {
  const db = starter(db0());
  const c = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async () => res(200, { jobs: [], total_pages: 1 }) });
  await runFeedHour(db, c, { nowMs: Date.parse("2026-11-01T12:10:00Z"), force: true });
  let body = null;
  const c2 = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async (_u, init) => { body = JSON.parse(init.body); return res(200, { jobs: [], total_pages: 1 }); } });
  const now = Date.parse("2026-11-01T13:00:00Z");
  await runIncremental(db, c2, { nowMs: now });
  assert.equal(body.ingested_after, new Date(now - 24 * 3600_000).toISOString().replace(/\.\d{3}Z$/, "Z"));
});

test("feedHirebaseRowsAgeOutAt30d: a Hirebase-only row 31 days old leaves the board; 29 days stays", () => {
  const db = db0();
  assert.equal(MAX_AGE_DAYS, 30);
  landHirebaseJob(db, job({ _id: "old31", date_posted: "2026-10-10" }));
  landHirebaseJob(db, job({ _id: "new29", date_posted: "2026-10-13" }));
  assert.equal(ageOut(db, { nowMs: Date.parse("2026-11-11T12:00:00Z") }), 1);
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = 'hirebase::new29'").pluck().get(), 1);
});

test("FEED-0 sampleReport: the sample's jobs — new vs merged, ATS, freshness, on the board; merged rows found by platform id", async () => {
  const db = starter(db0());
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, source, url, is_active, discovered_at) VALUES ('greenhouse::P900', 'q', 'Crawled Co', 'Engineer', 'h', 'greenhouse', 'https://boards.greenhouse.io/x/jobs/900', 1, ?)`)
    .run(Math.floor(Date.parse("2026-11-10T08:00:00Z") / 1000));
  const jobs = [job(), job({ application_link: "https://acme.wd1.myworkdayjobs.com/x", job_board: "workday" }), job({ platform_job_id: "P900", job_board: "greenhouse", company_name: "Crawled Co", job_title: "Engineer" })];
  const c = createHirebaseClient({ db, env: ENV_LIVE, log: quiet, fetchImpl: async () => res(200, { jobs, total_pages: 1 }) });
  await runSample(db, c);
  const r = sampleReport(db);
  assert.equal(r.summary.landed, 3); assert.equal(r.summary.new, 2); assert.equal(r.summary.merged, 1); assert.equal(r.summary.notFound, 0);
  assert.equal(r.summary.ats.greenhouse, 2); assert.equal(r.summary.ats.workday, 1);
  assert.equal(r.summary.ingestLagHours.median, 10, "posted 11-10 (midnight), first ingested 09:30 → 9.5 h, rounded");
  const merged = r.jobs.find(j => j.kind === "merged");
  assert.equal(merged.jobId, "greenhouse::P900"); assert.equal(merged.crawlVsHirebaseHours, -1, "the crawl saw it 1.5 h before Hirebase (Math.round → −1)");
  assert.equal(sampleReport(db0()).run, null);
});

test("FEED-5 feedState + the routes: the panel's table, shares editable, audited; the hourly tick gated", () => {
  const db = starter(db0());
  const s = feedState(db, { nowMs: Date.parse("2026-11-01T00:10:00Z") });
  assert.equal(s.families.length, FAMILIES.length);
  assert.equal(s.families.reduce((a, f) => a + f.todaySlice, 0), s.budget.today);
  assert.equal(s.switches.on, false, "FEED-6: off until the owner's word");
  const src = fs.readFileSync("server.js", "utf8");
  for (const r of ['app.get("/api/admin/hirebase/sample-report", requireAdmin', 'app.get("/api/admin/hirebase/feed", requireAdmin', 'app.put("/api/admin/hirebase/feed", requireAdmin'])
    assert.ok(src.includes(r), r);
  assert.ok(src.includes('action: "hirebase_feed"'));
});

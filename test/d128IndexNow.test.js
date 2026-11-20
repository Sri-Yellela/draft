import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  indexNowConfig, indexNowKey, indexNowTick, noteJobPageChanged, _queueForTests, readState,
  INDEXNOW_ENDPOINT, MAX_URLS_PER_POST, DEFAULT_DAILY_CAP, startIndexNow,
} from "../services/seo/indexNow.js";
import { mountIndexNow } from "../routes/indexNow.js";
import { jobPath } from "../services/jobs/publicJobPage.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D128 P2 (46y): IndexNow — the key file at the root, and a batched, capped, deduped ping when a public job page is
// published or changes. OFF until INDEXNOW_KEY is set. Synthetic postings; the fetch is always injected (no network).

const KEY = "d128testkey0123456789";
const ENV = { INDEXNOW_KEY: KEY, APP_BASE_URL: "https://example-board.test" };   // no NODE_TEST_CONTEXT: the config as production reads it
const cfg = (over = {}) => indexNowConfig({ ...ENV, ...over });
const quiet = { log() {}, warn() {}, error() {} };
const DAY = 24 * 3600 * 1000;
const T0 = Date.parse("2026-11-20T10:00:00Z");

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('public_open_jobs_backfilled', '1')").run();
  return db;
}
let n = 0;
function post(db, o = {}) {
  const jobId = o.job_id || `gh::d128in-${++n}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, board_category, is_active, duplicate_of)
    VALUES (?, 'q', ?, ?, ?, 'https://boards.example.com/x', 'text', ?, ?, ?)`)
    .run(jobId, jobId, o.title || "Data Analyst", o.company || "Acme Data", o.cat === undefined ? "data" : o.cat, o.active ?? 1, o.dup ?? null);
  return db.prepare("SELECT id, company, title, job_id FROM scraped_jobs WHERE job_id = ?").get(jobId);
}
function fakeFetch(status = 200) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { status }; };
  f.calls = calls;
  return f;
}

test("D128 P2 · OFF unless a valid INDEXNOW_KEY is set; never on staging or under node --test; https base only", () => {
  assert.equal(indexNowConfig({}).enabled, false);
  assert.equal(indexNowKey({ INDEXNOW_KEY: "short" }), null, "8–128 characters");
  assert.equal(indexNowKey({ INDEXNOW_KEY: "has space in it" }), null);
  assert.equal(cfg().enabled, true);
  assert.equal(cfg().host, "example-board.test");
  assert.equal(cfg().keyLocation, `https://example-board.test/${KEY}.txt`);
  assert.equal(cfg({ DRAFT_ENV: "staging" }).enabled, false, "A188: staging never pings");
  assert.equal(cfg({ NODE_TEST_CONTEXT: "child" }).enabled, false, "never under node --test");
  assert.equal(cfg({ APP_BASE_URL: "http://localhost:3000" }).enabled, false, "a non-https base is not a public host");
  assert.equal(cfg().dailyCap, DEFAULT_DAILY_CAP);
  assert.equal(cfg({ INDEXNOW_DAILY_CAP: "250" }).dailyCap, 250);
  assert.equal(startIndexNow(db0(), { config: indexNowConfig({}) }), null, "no timer when off");
});

test("D128 P2 · the key file: served at /<key>.txt as plain text only when the key is set", () => {
  const routes = new Map();
  const app = { get: (p, h) => routes.set(p, h) };
  assert.deepEqual(mountIndexNow(app, db0(), { env: {}, start: false }), { keyServed: false, stop: null });
  assert.equal(routes.size, 0, "unset → no route at all (production unchanged)");
  const r = mountIndexNow(app, db0(), { env: ENV, start: false });
  assert.equal(r.keyServed, true);
  const h = routes.get(`/${KEY}.txt`);
  assert.ok(h);
  const res = { headers: {}, set(k, v) { this.headers[k] = v; return this; }, type(t) { this.t = t; return this; }, send(b) { this.body = b; return this; } };
  h({}, res);
  assert.equal(res.body, KEY);
  assert.match(res.t, /^text\/plain/);
});

test("D128 P2 · first pass sets the watermark at today's newest page and sends nothing (no 80k flood)", async () => {
  const db = db0();
  post(db); post(db); const last = post(db);
  const f = fakeFetch();
  const r = await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0, log: quiet });
  assert.equal(r.state, "initialised");
  assert.equal(r.lastId, last.id);
  assert.equal(f.calls.length, 0);
  assert.equal((await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0, log: quiet })).state, "idle");
});

test("D128 P2 · waits for the public_open_jobs backfill; disabled config does nothing", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const f = fakeFetch();
  assert.equal((await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0, log: quiet })).state, "waiting");
  assert.equal((await indexNowTick(db0(), { config: indexNowConfig({}), fetchImpl: f, now: T0, log: quiet })).state, "off");
  assert.equal(f.calls.length, 0);
});

test("D128 P2 · a newly PUBLISHED public page is sent once, in the protocol's body; held / closed / duplicate never", async () => {
  const db = db0();
  post(db);
  const f = fakeFetch();
  await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0, log: quiet });
  const a = post(db, { company: "Forge & Co", title: "Mechanical Engineer" });
  post(db, { cat: "held" }); post(db, { cat: null }); post(db, { active: 0 }); post(db, { dup: "gh::other" });
  const r = await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0 + 1000, log: quiet });
  assert.equal(r.state, "sent");
  assert.equal(f.calls.length, 1);
  const c = f.calls[0];
  assert.equal(c.url, INDEXNOW_ENDPOINT);
  assert.equal(c.init.method, "POST");
  assert.deepEqual(c.body, { host: "example-board.test", key: KEY, keyLocation: `https://example-board.test/${KEY}.txt`,
    urlList: [`https://example-board.test${jobPath(a)}`] });
  assert.equal(readState(db).lastId, a.id, "the watermark moves over what was sent");
  assert.equal((await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0 + 2000, log: quiet })).state, "idle", "not sent twice");
  assert.equal(f.calls.length, 1);
});

test("D128 P2 · a CHANGED page (the crawl's content-changed hook) is sent only while still open + public, deduped per day", async () => {
  const db = db0();
  const a = post(db), b = post(db), held = post(db, { cat: "held" });
  const f = fakeFetch();
  await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0, log: quiet });
  _queueForTests({ on: false, clear: true });
  noteJobPageChanged(a.job_id);
  assert.equal(_queueForTests().size, 0, "a no-op while the pinger is off (tests, unset key)");
  _queueForTests({ on: true });
  try {
    noteJobPageChanged(a.job_id); noteJobPageChanged(a.job_id); noteJobPageChanged(held.job_id); noteJobPageChanged("gh::gone");
    db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE id = ?").run(b.id);
    noteJobPageChanged(b.job_id);
    await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0 + 1000, log: quiet });
    assert.deepEqual(f.calls.map(c => c.body.urlList), [[`https://example-board.test${jobPath(a)}`]]);
    assert.equal(_queueForTests().size, 0, "drained");
    noteJobPageChanged(a.job_id);
    assert.equal((await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0 + 2000, log: quiet })).state, "idle", "same id, same day → not again");
    noteJobPageChanged(a.job_id);
    await indexNowTick(db, { config: cfg(), fetchImpl: f, now: T0 + DAY, log: quiet });
    assert.equal(f.calls.length, 2, "a new UTC day → it may go again");
  } finally { _queueForTests({ on: false, clear: true }); }
});

test("D128 P2 · the daily cap: the rest wait for tomorrow, nothing is lost", async () => {
  const db = db0();
  post(db);
  const f = fakeFetch();
  const c = cfg({ INDEXNOW_DAILY_CAP: "2" });
  await indexNowTick(db, { config: c, fetchImpl: f, now: T0, log: quiet });
  const x = [post(db), post(db), post(db)];
  await indexNowTick(db, { config: c, fetchImpl: f, now: T0 + 1000, log: quiet });
  assert.equal(f.calls[0].body.urlList.length, 2);
  assert.equal((await indexNowTick(db, { config: c, fetchImpl: f, now: T0 + 2000, log: quiet })).state, "capped");
  await indexNowTick(db, { config: c, fetchImpl: f, now: T0 + DAY, log: quiet });
  assert.deepEqual(f.calls[1].body.urlList, [`https://example-board.test${jobPath(x[2])}`]);
});

test("D128 P2 · ≤ 10,000 URLs per POST: a bigger batch is split", async () => {
  const db = db0();
  post(db);
  const f = fakeFetch();
  const c = cfg({ INDEXNOW_DAILY_CAP: String(MAX_URLS_PER_POST + 50) });
  await indexNowTick(db, { config: c, fetchImpl: f, now: T0, log: quiet });
  db.transaction(() => { for (let i = 0; i < MAX_URLS_PER_POST + 5; i++) post(db); })();
  const r = await indexNowTick(db, { config: c, fetchImpl: f, now: T0 + 1000, log: quiet });
  assert.equal(r.posted, MAX_URLS_PER_POST + 5);
  assert.deepEqual(f.calls.map(x => x.body.urlList.length), [MAX_URLS_PER_POST, 5]);
});

test("D128 P2 · a failed POST advances nothing (the same pages go next pass); 429 backs off an hour", async () => {
  const db = db0();
  post(db);
  await indexNowTick(db, { config: cfg(), fetchImpl: fakeFetch(), now: T0, log: quiet });
  const before = readState(db).lastId;
  const a = post(db);
  const bad = fakeFetch(500);
  assert.equal((await indexNowTick(db, { config: cfg(), fetchImpl: bad, now: T0 + 1000, log: quiet })).state, "failed");
  assert.equal(readState(db).lastId, before);
  const thrown = async () => { throw new Error("network down"); };
  assert.equal((await indexNowTick(db, { config: cfg(), fetchImpl: thrown, now: T0 + 2000, log: quiet })).state, "failed");
  const busy = fakeFetch(429);
  await indexNowTick(db, { config: cfg(), fetchImpl: busy, now: T0 + 3000, log: quiet });
  const ok = fakeFetch(202);
  assert.equal((await indexNowTick(db, { config: cfg(), fetchImpl: ok, now: T0 + 4000, log: quiet })).state, "backoff");
  assert.equal(ok.calls.length, 0);
  await indexNowTick(db, { config: cfg(), fetchImpl: ok, now: T0 + 3000 + 3600 * 1000 + 1, log: quiet });
  assert.deepEqual(ok.calls[0].body.urlList, [`https://example-board.test${jobPath(a)}`], "202 Accepted counts as sent");
  assert.equal(readState(db).lastId, a.id);
});

test("D128 P2 · wiring: mounted beside robots.txt (before A157's /<company> catch-all), the crawl's changed path notes, robots allows the root", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const mount = at(server, "mountIndexNow(app, db);");
  const robots = at(server, 'app.get("/robots.txt"');
  const company = at(server, "⭐ A157 (45q, owner 11-09) · a company's own address");
  assert.ok(mount > robots && robots > 0, "mounted after robots.txt");
  assert.ok(company > mount, "mounted before the /<company> catch-all");
  assert.equal(server.split("mountIndexNow(app, db)").length - 1, 1, "mounted once");
  const agg = fs.readFileSync("services/jobs/aggregator.js", "utf8").replace(/\r\n/g, "\n");
  const note = at(agg, "if (exists) noteJobPageChanged(jobId);");
  const unchanged = at(agg, "touchSeenStmt.run(now, now");
  const classify = at(agg, "const verdict = classifyJob(job.title");
  assert.ok(note > unchanged && note < classify, "after the unchanged-touch path (never a change), before classifying the changed row");
  const svc = fs.readFileSync("services/seo/indexNow.js", "utf8");
  assert.ok(!/from "\.\.\/jobs\/publicJobPage\.js"/.test(svc), "no render imports — the aggregator imports this module");
  const robotsBlock = server.slice(robots, mount);
  assert.match(robotsBlock, /"Allow: \/"/);
});

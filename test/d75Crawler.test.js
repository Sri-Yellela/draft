// ⛔ D75 · THE CRAWLER WORKER — the tests the FIRST LIVE TASK waits for (docs/CRAWLER_WORKER.md §6),
// run against local fake careers sites (scripts/fakeAts.js) with NO external network: the ATS URLs the
// fixtures name are recognised, never fetched. Each is red when the guard it pins is removed:
//   robots-disallowed path never requested · deny-listed domain refused at lease time · metadata, localhost
//   and a redirect into a private range refused · the audit log holds only navigation and Apply · the
//   worker's environment holds no secret · CRAWLER_PAUSED stops a task within one page · a task past its
//   budget ends `error: budget`.
// Plus J1's shapes (link, depth, iframe, embed, the browser's network log), J2's two-origin hop and login
// wall, and draft's doors (lease, signature, what a result may write).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { runTask } from "../crawler/worker.js";
import { auditEnvironment } from "../crawler/lib/env.js";
import { checkUrl, deniedBy, parseRobots, robotsVerdict, recordUrl } from "../crawler/lib/guards.js";
import { sign } from "../crawler/lib/signature.js";
import { isAtsUrl } from "../crawler/lib/atsHosts.js";
import { createBrowserStage } from "../crawler/lib/browser.js";
import { harvestPairOf } from "../services/slugHarvest.js";
import { enqueueTask, leaseNext, setState } from "../services/crawlerQueue.js";
import { createCrawlerWorkerRouter, createCrawlerAdminRouter } from "../routes/crawler.js";

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
let PORT, proc, SITE, APPLY, ALLOW;
const requested = [];
const recordingFetch = (url, opts) => { requested.push(String(url)); return fetch(url, opts); };
// The fixtures' only names are localhost / 127.0.0.1 — the tests resolve nothing else.
const noDns = async () => { throw new Error("no DNS in tests"); };
const run = (task, extra = {}) => runTask({ id: 1, ...task }, { fetchImpl: recordingFetch, allowHosts: ALLOW, rateMs: 0, resolve: noDns, ...extra });

test.before(async () => {
  PORT = await freePort();
  proc = spawn(process.execPath, ["scripts/fakeAts.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  SITE = `http://localhost:${PORT}`; APPLY = `http://127.0.0.1:${PORT}`;
  ALLOW = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${SITE}/robots.txt`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error("fake ATS did not start");
});
test.after(() => proc?.kill());

// ── J1: the shapes ──────────────────────────────────────────────────────────────────────────────────
test("D75 J1: a plain link, a link two levels deep, an iframe and an embed — each found, by plain HTTP", async () => {
  const cases = {
    static: ["https://boards.greenhouse.io/acmestatic", "link"],
    deep: ["https://jobs.lever.co/acmedeep", "link"],
    iframe: ["https://jobs.ashbyhq.com/acmeframe/embed", "iframe"],
    embed: ["https://boards.greenhouse.io/embed/job_app?for=acmeembed", "iframe"],
  };
  for (const [name, [url, how]] of Object.entries(cases)) {
    const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/${name}` } });
    assert.equal(r.status, "found", name);
    assert.deepEqual(r.evidence, [{ url, how }], `${name}: the evidence, query dropped except the board's own name`);
  }
  // Draft names the (vendor, slug) from that evidence with its one parser.
  assert.deepEqual(harvestPairOf("https://boards.greenhouse.io/embed/job_app?for=acmeembed"), { atsType: "greenhouse", slug: "acmeembed" });
});

test("D75 J1: a client-rendered shell is reported needsBrowser without a browser — never guessed", async () => {
  const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/spa` } });
  assert.equal(r.status, "none");
  assert.equal(r.needsBrowser, true);
});

const chromePath = [process.env.CRAWLER_CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(p => p && fs.existsSync(p));
test("D75 J1: the browser stage reads the page's own NETWORK request — offline, nothing leaves the machine",
  { skip: chromePath ? false : "no Chrome on this machine — the browser stage is untested here (set CRAWLER_CHROME_PATH)" }, async () => {
  const puppeteer = (await import("puppeteer-core")).default;
  const browserStage = (deps) => createBrowserStage({ puppeteer, executablePath: chromePath, allowHosts: ALLOW, offline: true, settleMs: 800, ...deps });
  const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/spa` } }, { browserStage });
  assert.equal(r.status, "found");
  assert.deepEqual(r.evidence, [{ url: "https://boards-api.greenhouse.io/v1/boards/acmespa/jobs", how: "network" }]);
});

test("D75: the worker's ATS host list agrees with draft's parser on every vendor it names", () => {
  for (const u of ["https://boards.greenhouse.io/x", "https://job-boards.greenhouse.io/x", "https://jobs.lever.co/x/1234abcd-0000-0000-0000-000000000000",
                   "https://jobs.ashbyhq.com/x/1234abcd-0000-0000-0000-000000000000", "https://apply.workable.com/x/j/ABCDEF1234",
                   "https://x.recruitee.com/o/role", "https://acme.wd5.myworkdayjobs.com/External", "https://careers-acme.icims.com/jobs"]) {
    assert.equal(isAtsUrl(u), true, u);
    assert.ok(harvestPairOf(u) !== null || /myworkdayjobs/.test(u), `draft's parser reads ${u}`);
  }
  assert.equal(isAtsUrl("https://www.example.com/careers"), false);
});

// ── the guards the first live task waits for ────────────────────────────────────────────────────────
test("⛔ D75: a robots.txt-disallowed path is NEVER requested", async () => {
  requested.length = 0;
  const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/forbidden` } });
  assert.equal(r.status, "none");
  assert.deepEqual(requested.filter(u => u.includes("/forbidden/")), [], "not one request to the disallowed path");
  assert.ok(requested.some(u => u.endsWith("/robots.txt")), "robots.txt was read first");
  const g = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: DraftCrawler\nDisallow: /x/\n");
  assert.equal(robotsVerdict(g, "/x/y").allowed, false, "our own group wins over *");
  assert.equal(robotsVerdict(g, "/private").allowed, true, "and only our group applies");
});

test("⛔ D75: cloud metadata, localhost and a REDIRECT into a private range are refused — before any request", async () => {
  requested.length = 0;
  for (const name of ["ssrf", "ssrf10"]) {
    const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/${name}` } });
    assert.notEqual(r.status, "found", name);
  }
  assert.deepEqual(requested.filter(u => /169\.254\.169\.254|10\.0\.0\.5/.test(u)), [], "the redirect target was never requested");
  for (const u of ["http://169.254.169.254/latest/meta-data/", "http://localhost:1/", "http://127.0.0.1:1/", "http://[::1]/",
                   "http://10.1.2.3/", "http://192.168.0.1/", "http://metadata.google.internal/", "file:///etc/passwd"]) {
    assert.equal((await checkUrl(u)).ok, false, u);
  }
  assert.equal((await checkUrl("https://evil.example/", { resolve: async () => ["10.0.0.9"] })).ok, false, "a name that RESOLVES private");
  assert.equal((await checkUrl("https://ok.example/", { resolve: async () => ["93.184.216.34"] })).ok, true);
});

test("⛔ D75: the audit log holds navigation and Apply only — no keystroke, submit or click exists in the worker", async () => {
  const r = await run({ type: "j2_apply_hop", input: { postingUrl: `${SITE}/crawler-fixtures/j2/posting/4242` } });
  assert.ok(r.audit.length > 0);
  assert.deepEqual([...new Set(r.audit.map(a => a.kind))].filter(k => !["navigate", "redirect", "apply"].includes(k)), []);
  assert.ok(r.audit.every(a => !String(a.url).includes("?")), "no query string recorded");
  const src = fs.readdirSync("crawler/lib").map(f => fs.readFileSync(path.join("crawler/lib", f), "utf8")).join("\n")
    + fs.readFileSync("crawler/worker.js", "utf8");
  assert.doesNotMatch(src, /\.(type|click|press|focus|tap|select|submit|fill|uploadFile)\s*\(|\.keyboard\b|\.mouse\b/,
    "the worker has no code that types, clicks or submits");
});

test("⛔ D75: the worker's environment holds only allowed variables — no DB path, no API key, no user data", () => {
  assert.deepEqual(auditEnvironment({ CRAWLER_TOKEN: "x".repeat(40), CRAWLER_DRAFT_URL: "https://jobsviadraft.com", PATH: "/bin", HOME: "/home/c", RAILWAY_SERVICE_NAME: "crawler" }),
                   { ok: true, unexpected: [] });
  const bad = auditEnvironment({ CRAWLER_TOKEN: "x", RM_DATA_DIR: "/app/data", RESEND_API_KEY: "re_x", DATABASE_URL: "x", ANTHROPIC_API_KEY: "y", RAILWAY_TOKEN: "z" });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.unexpected.sort(), ["ANTHROPIC_API_KEY", "DATABASE_URL", "RAILWAY_TOKEN", "RESEND_API_KEY", "RM_DATA_DIR"]);
  assert.doesNotMatch(fs.readFileSync("crawler/worker.js", "utf8"), /from\s+["']\.\.\/(services|server|scripts|shared|routes)/, "the worker imports nothing from draft");
});

test("⛔ D75: CRAWLER_PAUSED stops a running task within one page", async () => {
  let calls = 0;
  const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/deep` } }, { isPaused: async () => ++calls > 1 });
  assert.equal(r.status, "error");
  assert.match(r.error, /^paused/);
  assert.equal(r.spent.pages, 1, "one page, then it stopped");
});

test("⛔ D75: a task past its page budget ends `error: budget`, not a hang", async () => {
  const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/budget` }, budget: { pages: 2 } });
  assert.equal(r.status, "error");
  assert.match(r.error, /^budget/);
});

test("D75: a bot challenge is `blocked` — never solved, never retried", async () => {
  const r = await run({ type: "j1_find_board", input: { baseUrl: `${SITE}/crawler-fixtures/challenge` } });
  assert.equal(r.status, "blocked");
});

// ── J2 ──────────────────────────────────────────────────────────────────────────────────────────────
test("D75 J2: the Apply link's two-origin hop (Amazon's shape), and a login wall — it stops at the first form", async () => {
  const r = await run({ type: "j2_apply_hop", input: { postingUrl: `${SITE}/crawler-fixtures/j2/posting/4242` } });
  assert.deepEqual([r.status, r.postingOrigin, r.formOrigin, r.stoppedAt], ["found", SITE, APPLY, "form"]);
  assert.deepEqual(r.hops, [`${SITE}/crawler-fixtures/j2/posting/:id`, `${SITE}/twoorigin/apply/:id`, `${APPLY}/twoorigin/apply/:id`]);
  const w = await run({ type: "j2_apply_hop", input: { postingUrl: `${SITE}/crawler-fixtures/j2login/posting` } });
  assert.equal(w.stoppedAt, "login-wall");
});

// ── draft's doors ───────────────────────────────────────────────────────────────────────────────────
const TOKEN = "t".repeat(48);
function draftApp(env = { CRAWLER_TOKEN: TOKEN }) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  // D75 STEP 0b: a fresh database starts PAUSED and DRY — these tests exercise the live path, so they resume it.
  setState(db, { paused: false, mode: "live" });
  const app = express();
  app.use("/api/crawler", createCrawlerWorkerRouter(db, { env }));
  app.use(express.json());
  app.use("/api/admin/crawler", createCrawlerAdminRouter(db, (_q, _s, n) => n(), { resolve: async () => ["93.184.216.34"] }));
  return { db, app };
}
async function listen(app) {
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
const auth = { authorization: `Bearer ${TOKEN}` };

test("⛔ D75: a deny-listed domain is refused at QUEUE and at LEASE time; the doors need the token", async () => {
  const { db, app } = draftApp();
  const s = await listen(app);
  try {
    const q = await (await fetch(`${s.base}/api/admin/crawler/tasks`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "j1_find_board", urls: ["https://www.linkedin.com/company/acme", "https://acme.example.com", "https://later.example.org"] }) })).json();
    assert.deepEqual(q.tasks.map(t => t.status), ["refused", "queued", "queued"]);
    assert.equal(q.tasks[0].reason, "denied:linkedin.com");
    // A domain denied AFTER it was queued is still never leased.
    db.prepare("INSERT INTO crawler_denylist (domain) VALUES ('example.org')").run();
    const leased = [];
    for (;;) { const r = leaseNext(db, { env: { CRAWLER_TOKEN: TOKEN } }); if (!r.task) break; leased.push(r.task.input.baseUrl); }
    assert.deepEqual(leased, ["https://acme.example.com"]);
    assert.equal(db.prepare("SELECT refused_reason FROM crawler_tasks WHERE target_host = 'later.example.org'").get().refused_reason, "denied:example.org");
    assert.equal((await fetch(`${s.base}/api/crawler/next`)).status, 401, "no token");
  } finally { s.close(); }
  const off = draftApp({});
  const s2 = await listen(off.app);
  try { assert.equal((await fetch(`${s2.base}/api/crawler/next`, { headers: auth })).status, 503, "no CRAWLER_TOKEN on draft = off"); } finally { s2.close(); }
  const paused = draftApp({ CRAWLER_TOKEN: TOKEN, CRAWLER_PAUSED: "1" });
  const s3 = await listen(paused.app);
  try { assert.equal((await fetch(`${s3.base}/api/crawler/next`, { headers: auth })).status, 423, "paused"); } finally { s3.close(); }
});

test("D75: a result must be signed; J1 evidence lands in the harvest POOL (never enabled); J2 records an observed pair, never a shared host", async () => {
  const { db, app } = draftApp();
  const s = await listen(app);
  try {
    await enqueueTask(db, { type: "j1_find_board", input: { baseUrl: "https://acme.example.com" }, resolve: async () => ["93.184.216.34"] });
    await enqueueTask(db, { type: "j2_apply_hop", input: { postingUrl: "https://www.amazon.jobs/en/jobs/1" }, resolve: async () => ["93.184.216.34"] });
    await enqueueTask(db, { type: "j2_apply_hop", input: { postingUrl: "https://acme.wd5.myworkdayjobs.com/External/job/X_JR1" }, resolve: async () => ["93.184.216.34"] });
    const companiesBefore = db.prepare("SELECT COUNT(*) n, SUM(active) a FROM company_ats_list").get();
    const t1 = (await (await fetch(`${s.base}/api/crawler/next`, { headers: auth })).json()).task;
    const r1 = JSON.stringify({ taskId: t1.id, type: t1.type, status: "found", evidence: [{ url: "https://boards.greenhouse.io/acmeco", how: "link" }, { url: "https://acme.icims.com/jobs", how: "link" }] });
    const post = (body, headers) => fetch(`${s.base}/api/crawler/result`, { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
    assert.equal((await post(r1, {})).status, 401, "unsigned");
    assert.equal((await post(r1, sign(r1, "wrong".repeat(10)))).status, 401, "mis-signed");
    assert.equal((await post(r1, sign(r1, TOKEN, Math.floor(Date.now() / 1000) - 3600))).status, 401, "stale (a replay)");
    const ok = await (await post(r1, sign(r1, TOKEN))).json();
    assert.deepEqual(ok.pairs, [{ atsType: "greenhouse", slug: "acmeco", how: "link" }]);
    assert.deepEqual(ok.unsupported, ["icims"], "tallied by vendor — the input to the next adapter");
    const pool = db.prepare("SELECT ats_type, ats_slug, first_query, decision FROM slug_harvest_pool").all();
    assert.deepEqual(pool, [{ ats_type: "greenhouse", ats_slug: "acmeco", first_query: "crawler:acme.example.com", decision: null }]);
    assert.deepEqual(db.prepare("SELECT COUNT(*) n, SUM(active) a FROM company_ats_list").get(), companiesBefore, "nothing added, nothing enabled");
    assert.equal((await post(r1, sign(r1, TOKEN))).status, 409, "a task's result is accepted once");

    const t2 = (await (await fetch(`${s.base}/api/crawler/next`, { headers: auth })).json()).task;
    const r2 = JSON.stringify({ taskId: t2.id, type: t2.type, status: "found", postingOrigin: "https://www.amazon.jobs", formOrigin: "https://account.amazon.jobs", hops: [], stoppedAt: "login-wall" });
    assert.equal((await (await post(r2, sign(r2, TOKEN))).json()).observed.recorded, true);
    const pair = db.prepare("SELECT posting_host, apply_host, promoted_at, crawler_seen_at FROM apply_origin_pairs").get();
    assert.deepEqual([pair.posting_host, pair.apply_host, pair.promoted_at], ["www.amazon.jobs", "account.amazon.jobs", null], "observed, NOT promoted");
    assert.ok(pair.crawler_seen_at);

    const t3 = (await (await fetch(`${s.base}/api/crawler/next`, { headers: auth })).json()).task;
    const r3 = JSON.stringify({ taskId: t3.id, type: t3.type, status: "found", postingOrigin: "https://acme.wd5.myworkdayjobs.com", formOrigin: "https://wd5.myworkdaysite.com", hops: [], stoppedAt: "form" });
    assert.deepEqual((await (await post(r3, sign(r3, TOKEN))).json()).observed, { postingHost: "acme.wd5.myworkdayjobs.com", applyHost: "wd5.myworkdaysite.com", recorded: false, reason: "shared_host" });
    assert.equal(db.prepare("SELECT COUNT(*) n FROM apply_origin_pairs").get().n, 1, "the Workday exception stands");
  } finally { s.close(); }
});

test("D75: the deny-list matches a domain and its subdomains, and only those", () => {
  assert.equal(deniedBy("www.linkedin.com", ["linkedin.com"]), "linkedin.com");
  assert.equal(deniedBy("https://uk.indeed.com/jobs", ["indeed.com"]), "indeed.com");
  assert.equal(deniedBy("notlinkedin.com", ["linkedin.com"]), null);
  assert.equal(recordUrl("https://x.example/a?token=1&utm=2"), "https://x.example/a");
});

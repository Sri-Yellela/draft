// ⛔ D75 STEP 0b · ADMIN → CRAWLER — the controls live in draft's database, not in environment variables.
// Each red when removed: a fresh database starts PAUSED and DRY · Resume lets a lease through and Pause stops
// it again · CRAWLER_PAUSED (the env) still stops everything when the DB says run · the MODE travels in the
// lease and a DRY task writes nothing · a dry run makes NO network request (no DNS, no robots.txt, no page) ·
// the per-run cap holds · the captured-company candidates and the daily schedule (it enqueues, once a day,
// never leases) · the wrong-answer flag · bad input to the controls is refused · the Admin tab exists.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { readState, setState, pausedNow, leaseNext, acceptResult, enqueueTask, enqueueBatch, captureCandidates,
         runSchedule, flagTask, crawlerSummary } from "../services/crawlerQueue.js";
import { runTask } from "../crawler/worker.js";

const resolve = async () => ["93.184.216.34"];
function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const env = { CRAWLER_TOKEN: "t".repeat(40) };

test("⛔ D75 0b: a fresh database starts PAUSED and DRY — nothing runs until the owner presses Resume", () => {
  const db = db0();
  assert.deepEqual([readState(db).paused, readState(db).mode], [1, "dry"]);
  assert.deepEqual(pausedNow(db, env), { paused: true, by: "admin" });
  assert.deepEqual(leaseNext(db, { env }), { paused: true });
});

test("⛔ D75 0b: Resume lets a lease through and Pause stops it; CRAWLER_PAUSED is a second, independent switch", async () => {
  const db = db0();
  await enqueueTask(db, { type: "j1_find_board", input: { baseUrl: "https://acme.example.com" }, resolve });
  await enqueueTask(db, { type: "j1_find_board", input: { baseUrl: "https://beta.example.com" }, resolve });
  setState(db, { paused: false });
  assert.ok(leaseNext(db, { env }).task, "running: a task is leased");
  assert.deepEqual(leaseNext(db, { env: { ...env, CRAWLER_PAUSED: "1" } }), { paused: true }, "the env switch wins over the DB");
  setState(db, { paused: true });
  assert.deepEqual(leaseNext(db, { env }), { paused: true });
  db.exec("DROP TABLE crawler_state");
  assert.deepEqual(pausedNow(db, env), { paused: true, by: "unreadable" }, "controls that cannot be read fail CLOSED");
});

test("⛔ D75 0b: the MODE travels in the lease, and a DRY task writes nothing but its own record", async () => {
  const db = db0();
  await enqueueTask(db, { type: "j1_find_board", input: { baseUrl: "https://acme.example.com" }, resolve });
  setState(db, { paused: false });                                     // still dry
  const { task } = leaseNext(db, { env });
  assert.equal(task.mode, "dry");
  const out = acceptResult(db, { taskId: task.id, type: task.type, status: "found", evidence: [{ url: "https://boards.greenhouse.io/acme", how: "link" }] });
  assert.equal(out.dryRun, true);
  assert.equal(db.prepare("SELECT COUNT(*) FROM slug_harvest_pool").pluck().get(), 0, "a dry result never reaches the pool");
  assert.equal(db.prepare("SELECT result_status FROM crawler_tasks WHERE id = ?").pluck().get(task.id), "dry_run");
  setState(db, { mode: "live" });
  await enqueueTask(db, { type: "j1_find_board", input: { baseUrl: "https://beta.example.com" }, resolve });
  assert.equal(leaseNext(db, { env }).task.mode, "live");
});

test("⛔ D75 0b: a DRY run makes no network request — no DNS, no robots.txt, no page", async () => {
  const requested = [];
  let dns = 0;
  const r = await runTask({ id: 1, type: "j1_find_board", input: { baseUrl: "https://acme.example.com" } }, {
    fetchImpl: async (u) => { requested.push(String(u)); throw new Error("no network in a dry run"); },
    resolve: async () => { dns++; return ["93.184.216.34"]; }, rateMs: 0, dryRun: true });
  assert.deepEqual(requested, []);
  assert.equal(dns, 0, "not even a DNS lookup");
  assert.ok(r.audit.length > 0 && r.audit.every(a => a.dryRun), "it records what it WOULD have requested");
  assert.equal(r.dryRun, true);
  assert.match(fs.readFileSync("crawler/worker.js", "utf8"), /dryRun: dryRun \|\| task\.mode !== "live"/, "the worker runs dry unless the lease says live");
});

test("D75 0b: the per-run cap holds", async () => {
  const db = db0();
  setState(db, { per_run_cap: 2 });
  const r = await enqueueBatch(db, { type: "j1_find_board", urls: ["https://a.example.com", "https://b.example.com", "https://c.example.com", "https://d.example.com"], resolve });
  assert.equal(r.tasks.filter(t => t.status === "queued").length, 2);
  assert.equal(r.capped, 2);
});

test("D75 0b: captured companies we cannot crawl become candidates; the schedule ENQUEUES once a day and never leases", async () => {
  const db = db0();
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  const cap = db.prepare("INSERT INTO job_captures (user_id, job_id, url, origin, action) VALUES (1, ?, ?, ?, 'captured')");
  cap.run("a", "https://careers.acme.example.com/jobs/123?utm=1", "https://careers.acme.example.com");
  cap.run("b", "https://boards.greenhouse.io/stripe/jobs/1", "https://boards.greenhouse.io");      // an ATS — already crawlable
  cap.run("c", "https://careers.acme.example.com/jobs/456", "https://careers.acme.example.com");     // same company, once
  assert.deepEqual(captureCandidates(db).map(c => c.baseUrl), ["https://careers.acme.example.com"]);
  setState(db, { schedule_enabled: true, schedule_hhmm: "09:00", schedule_tasks: 5 });
  assert.equal((await runSchedule(db, { now: new Date("2026-10-09T08:59:00Z"), resolve })).reason, "not_yet");
  const r = await runSchedule(db, { now: new Date("2026-10-09T09:05:00Z"), resolve });
  assert.deepEqual([r.ran, r.queued], [true, 1]);
  assert.equal((await runSchedule(db, { now: new Date("2026-10-09T15:00:00Z"), resolve })).reason, "already_today");
  assert.equal(db.prepare("SELECT status FROM crawler_tasks").pluck().get(), "queued", "queued, not leased");
  assert.deepEqual(captureCandidates(db), [], "a tasked company is not offered again");
});

test("D75 0b: the wrong-answer flag is counted; bad input to the controls is refused", async () => {
  const db = db0();
  const { id } = await enqueueTask(db, { type: "j1_find_board", input: { baseUrl: "https://acme.example.com" }, resolve });
  assert.equal(flagTask(db, id, { wrong: true, note: "named the wrong slug" }), true);
  assert.equal(crawlerSummary(db, { env }).wrongAnswers, 1);
  assert.throws(() => setState(db, { mode: "turbo" }), /mode/);
  assert.throws(() => setState(db, { schedule_hhmm: "25:99" }), /schedule_hhmm/);
  assert.throws(() => setState(db, { per_run_cap: 0 }), /per_run_cap/);
});

test("D75 0b: Admin has a Crawler tab with the switch, the mode, the enqueue, the queue and the deny-list", () => {
  const panel = fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8");
  assert.match(panel, /\{ id:"crawler",\s+label:"Crawler" \}/);
  assert.match(panel, /topTab === "crawler" && <CrawlerTab theme=\{theme\}\/>/);
  const ops = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  for (const s of ["/api/admin/crawler/state", "Resume", "Pause", "Dry-run", "Live", "/api/admin/crawler/tasks/captures", "Flag wrong", "Deny-list"]) {
    assert.ok(ops.includes(s), `the tab carries ${s}`);
  }
});

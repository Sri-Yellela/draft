// ⛔ D75 STEP 1c · THE WORKER'S LIFECYCLE — it has no domain and no healthcheck, and Railway stops it with SIGTERM.
// Each red when removed: every authenticated call is recorded as "worker last seen", and silence past three polls
// reads as silent · a lease is RELEASED (requeued at once) only through a signed request, and only while leased ·
// a worker stopping mid-task releases its lease instead of reporting a failure · the worker handles SIGTERM, stops
// taking tasks, and exits 0 · Admin → Crawler shows the line.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setState, enqueueTask, leaseNext, workerSeen, releaseTask, SILENT_AFTER_SECONDS } from "../services/crawlerQueue.js";
import { createCrawlerWorkerRouter } from "../routes/crawler.js";
import { sign } from "../crawler/lib/signature.js";
import { settle } from "../crawler/worker.js";

const TOKEN = "w".repeat(48);
const env = { CRAWLER_TOKEN: TOKEN };
const resolve = async () => ["93.184.216.34"];
function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  setState(db, { paused: false });
  return db;
}
async function serve(db) {
  const app = express();
  app.use("/api/crawler", createCrawlerWorkerRouter(db, { env }));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  return { base: `http://127.0.0.1:${server.address().port}/api/crawler`, close: () => server.close() };
}

test("⛔ D75 1c: every authenticated call is 'worker last seen'; silence past three polls reads as silent", async () => {
  const db = db0();
  assert.equal(workerSeen(db).silent, true, "never seen = silent");
  const s = await serve(db);
  try {
    await fetch(`${s.base}/next`, { headers: { authorization: `Bearer ${TOKEN}` } });
    let w = workerSeen(db);
    assert.equal(w.silent, false);
    assert.equal(w.lastCall, "lease → 204 nothing");
    setState(db, { paused: true });
    await fetch(`${s.base}/next`, { headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(workerSeen(db).lastCall, "lease → 423 paused");
    await fetch(`${s.base}/next`, { headers: { authorization: "Bearer wrong" } });
    assert.equal(workerSeen(db).lastCall, "lease → 423 paused", "an unauthenticated call is not the worker");
    assert.equal(workerSeen(db, Math.floor(Date.now() / 1000) + SILENT_AFTER_SECONDS + 1).silent, true);
  } finally { s.close(); }
});

test("⛔ D75 1c: a lease is released (requeued at once) only through a signed request, and only while leased", async () => {
  const db = db0();
  await enqueueTask(db, { type: "j1_find_board", input: { baseUrl: "https://acme.example.com" }, resolve });
  const { task } = leaseNext(db, { env });
  const s = await serve(db);
  try {
    const body = JSON.stringify({ taskId: task.id });
    const post = (headers) => fetch(`${s.base}/release`, { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
    assert.equal((await post({})).status, 401, "unsigned");
    assert.equal(db.prepare("SELECT status FROM crawler_tasks").pluck().get(), "leased");
    assert.deepEqual(await (await post(sign(body, TOKEN))).json(), { released: true });
    assert.equal(db.prepare("SELECT status FROM crawler_tasks").pluck().get(), "queued");
    assert.equal(leaseNext(db, { env }).task.id, task.id, "re-leased at once, not after the lease runs out");
    db.prepare("UPDATE crawler_tasks SET status = 'done'").run();
    assert.equal(releaseTask(db, task.id), false, "a finished task is never put back");
  } finally { s.close(); }
});

test("⛔ D75 1c: a worker stopping mid-task RELEASES the lease; a task that finished is reported", async () => {
  const calls = [];
  const post = async (path, payload) => { calls.push([path, payload]); return 200; };
  const task = { id: 7, type: "j1_find_board" };
  const stopped = await settle(task, { taskId: 7, status: "error", error: "paused" }, { stopping: true, post });
  assert.equal(stopped.action, "release");
  assert.deepEqual(calls.pop(), ["/api/crawler/release", { taskId: 7 }]);
  const done = await settle(task, { taskId: 7, status: "found", evidence: [] }, { stopping: true, post });
  assert.equal(done.action, "result", "work finished before the signal is not thrown away");
  const pausedByOwner = await settle(task, { taskId: 7, status: "error", error: "paused" }, { stopping: false, post });
  assert.equal(pausedByOwner.action, "result", "an owner's pause (not a shutdown) is reported as it is");
});

test("⛔ D75 1c: the worker handles SIGTERM — stops taking tasks, stops the current one within a page, exits 0", () => {
  const src = fs.readFileSync("crawler/worker.js", "utf8");
  assert.match(src, /process\.on\("SIGTERM", \(\) => stop\("SIGTERM"\)\)/);
  assert.match(src, /if \(!busy\) process\.exit\(0\);/, "an idle worker exits at once, with 0");
  assert.match(src, /const isPaused = async \(\) => \{\s*if \(stopping\) return true;/, "a running task stops within one page");
  assert.match(src, /if \(stopping\) process\.exit\(0\);/, "and the loop takes no new task");
  assert.doesNotMatch(src, /process\.exit\(1\)/, "a paused or idle worker never exits non-zero");
});

test("D75 1c: Admin → Crawler shows 'worker last seen'", () => {
  const ops = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(ops, /\["worker last seen", d\.worker\?\.lastSeen/);
});

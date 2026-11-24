// ⭐ 47c · the scale suite's loop probe measures the MAIN thread only. A `--import` preload also runs in a worker_threads
// Worker started from a file, so before 47c a read worker inside a long synchronous query wrote its own histogram over
// loop.json and appended its "stall" to .stalls (47b run 2's 26 s "main-thread stall" while every request took ≤ 1.56 s).
// Here a real server-shaped process: the main thread stays free while a file-started worker blocks for 1.6 s.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

test("scaleLoopProbeMainThread47c: a worker's long task is a worker stall, never the main thread's loop or stall", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loop47c-"));
  const loop = path.join(dir, "loop.json");
  const app = path.join(dir, "app.mjs");
  fs.writeFileSync(app, `import { Worker, isMainThread } from "node:worker_threads";
if (isMainThread) {
  const w = new Worker(new URL(import.meta.url));
  w.on("exit", () => setTimeout(() => process.exit(0), 700));   // let the main probe write loop.json after the block
} else { setTimeout(() => { const end = Date.now() + 1600; while (Date.now() < end) {} setTimeout(() => {}, 300); }, 200); }   // a pool worker lives on after a task
`);
  const probe = path.resolve("test-support/scaleLoopProbe.mjs");
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(probe).href, app],
    { env: { ...process.env, SCALE_LOOP_FILE: loop }, encoding: "utf8", timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  const h = JSON.parse(fs.readFileSync(loop, "utf8"));
  assert.ok(h.max < 1000, `the main thread's loop max is its own (${h.max} ms), not the worker's 1.6 s`);
  assert.ok(!fs.existsSync(`${loop}.stalls`) || fs.readFileSync(`${loop}.stalls`, "utf8").trim() === "", "no main-thread stall");
  const ws = fs.readFileSync(`${loop}.worker-stalls`, "utf8").trim().split("\n").map(l => JSON.parse(l));
  assert.ok(ws.some(w => w.thread >= 1 && w.ms >= 1000), JSON.stringify(ws));
  fs.rmSync(dir, { recursive: true, force: true });
});

// ⛔⛔ D151 Rule 1 · LISTEN FIRST, THEN WARM UP (owner 11-04: "we have to look a permanent solution for this issue too").
//
// Production's 11-04 05:25Z boot held the port ≈ 50 s, and the 11-03 deploys took traffic and then stalled in the
// startup cleanup. Measured on an 82,620-posting copy (WORKLOG 44q): on a SETTLED board every boot spent ≈ 18 s in the
// 'general' re-file and ≈ 20 s in the description pass's stale scan before `app.listen`. These tests pin the fix:
//   · the board passes run in the warm-up, after the listener binds, never during module evaluation;
//   · /api/health/ready answers 503 until the warm-up has run, and Railway's healthcheck points at it;
//   · the warm-up yields between steps, records each step, and a failing step is never fatal.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createBootWarmup } from "../services/boot/bootWarmup.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SERVER = read("server.js");
const quiet = { log() {}, error() {}, warn() {} };

// Every whole-board pass that used to run before the listener. Each must appear ONLY inside a BOOT.add(...) step
// (or a function the warm-up / an interval calls), never as a bare statement of module evaluation.
const BOARD_PASSES = ["backfillCategories(db)", "backfillAutomationTier(db)", "backfillProvenance(db)",
  "backfillRoleMap(db)", "remapGeneralRows(db)", "backfillCompanyLogos(db)"];

test("d151NoBoardPassBeforeListen: each board pass is called only inside a BOOT.add warm-up step", () => {
  for (const call of BOARD_PASSES) {
    const i = SERVER.indexOf(call);
    assert.ok(i > 0, `${call} not found in server.js — renamed? update this list`);
    assert.equal(SERVER.indexOf(call, i + 1), -1, `${call} is called twice in server.js`);
    const stepStart = SERVER.lastIndexOf("BOOT.add(", i);
    assert.ok(stepStart > 0 && i - stepStart < 2500, `${call} is not inside a BOOT.add step — it would run before the port binds`);
    // nothing closes that step between its opening and the call
    assert.doesNotMatch(SERVER.slice(stepStart, i), /\n\}\s*\)\s*;\s*\n/, `${call} sits after its BOOT.add step closed`);
  }
  // the boot's first tag slice (the description pass's whole-board stale scan) is a warm-up step too
  assert.match(SERVER, /BOOT\.add\("job tags \(first slice\)", \(\) => runJobTagPassSliced\("boot"\)\)/);
  assert.doesNotMatch(SERVER, /^runJobTagPassSliced\("boot"\);/m, "the first tag slice runs bare during module evaluation");
});

test("d151ListenThenWarm: BOOT.run() starts inside the listen callback, after the startup cleanup is queued", () => {
  const listen = SERVER.indexOf("app.listen(PORT, () => {");
  assert.ok(listen > 0);
  const body = SERVER.slice(listen, listen + 4000);
  assert.ok(body.indexOf("BOOT.listening()") > 0 && body.indexOf("BOOT.listening()") < body.indexOf("BOOT.run()"));
  assert.ok(body.indexOf('BOOT.add("startup expired-jobs cleanup"') < body.indexOf("BOOT.run()"),
    "the startup cleanup must be a warm-up step, so ready stays 503 until it has run");
  // every BOOT.add is textually before BOOT.run() (adding after it throws once ready)
  const lastAdd = SERVER.lastIndexOf("BOOT.add(");
  assert.ok(lastAdd < listen + body.indexOf("BOOT.run()"));
});

test("d151ReadyGatesTraffic: /api/health/ready answers 503 until ready, and Railway's healthcheck points at it", () => {
  const toml = read("railway.toml");
  assert.match(toml, /^healthcheckPath = "\/api\/health\/ready"$/m);
  const i = SERVER.indexOf('app.get("/api/health/ready"');
  assert.ok(i > 0 && i < SERVER.indexOf('app.get("*"'), "ready must be registered before the SPA catch-all");
  const handler = SERVER.slice(i, SERVER.indexOf("\napp.", i + 10));
  assert.match(handler, /BOOT\.ready && dbOk/);
  assert.match(handler, /res\.status\(503\)\.json\(\{ ok: false, error: dbOk \? "warming up"/);
  assert.doesNotMatch(handler, /requireAuth|requireAdmin/, "Railway's probe carries no session");
  assert.match(SERVER, /app\.get\("\/api\/health\/live", \(_req, res\) => res\.json\(\{ ok: true/);
});

test("d151 bootWarmup: steps run in order, after a yield, and ready flips only when all have run", async () => {
  const ran = [];
  const ticks = [];
  const w = createBootWarmup({ log: quiet, yieldFn: (fn) => { ticks.push(ran.length); setImmediate(fn); } });
  w.add("a", () => ran.push("a"));
  w.add("b", async () => { await new Promise(r => setTimeout(r, 5)); ran.push("b"); });
  w.add("c", () => ran.push("c"));
  w.listening();
  assert.equal(w.ready, false);
  const p = w.run();
  assert.deepEqual(ran, [], "nothing runs synchronously inside run()");
  assert.equal(w.state, "warming");
  assert.deepEqual(w.snapshot().pending, ["a", "b", "c"]);
  const snap = await p;
  assert.deepEqual(ran, ["a", "b", "c"]);
  assert.equal(w.ready, true);
  assert.equal(snap.state, "ready");
  assert.deepEqual(snap.pending, []);
  assert.deepEqual(snap.timeline.map(t => t.name), ["a", "b", "c"]);
  assert.ok(ticks.length >= 4, "a yield before every step and before flipping ready");
  assert.ok(snap.readyMs >= snap.listenMs);
  assert.throws(() => w.add("late", () => {}), /too late/);
});

test("d151 bootWarmup: a failing step is recorded and the warm-up continues to ready", async () => {
  const errors = [];
  const w = createBootWarmup({ log: { log() {}, error: (...a) => errors.push(a.join(" ")) } });
  w.add("boom", () => { throw new Error("disk full"); });
  w.add("after", () => {});
  const snap = await w.run();
  assert.equal(snap.state, "ready");
  assert.deepEqual(snap.timeline.map(t => [t.name, t.ok]), [["boom", false], ["after", true]]);
  assert.equal(snap.timeline[0].error, "disk full");
  assert.match(errors[0], /boom.*not fatal.*disk full/);
});

test("d151 bootWarmup: before-listen steps are timed into the same timeline", () => {
  const w = createBootWarmup({ log: quiet });
  assert.equal(w.mark("open db", () => 42), 42);
  w.note("migrations (0 applied)", 12);
  assert.throws(() => w.mark("bad", () => { throw new Error("x"); }), /x/);
  const t = w.snapshot().timeline;
  assert.deepEqual(t.map(s => [s.name, s.phase, s.ok]),
    [["open db", "before-listen", true], ["migrations (0 applied)", "before-listen", true], ["bad", "before-listen", false]]);
});

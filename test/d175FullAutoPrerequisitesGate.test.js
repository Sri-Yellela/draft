// ⛔ D175 FA6 [T7] · NO UNATTENDED SEND UNTIL THE FOUR SAFETY CHECKS ARE GREEN (owner 11-07): D173 (1)'s prompt-injection
// defence · a daily cost alarm (and today under it) · the kill switch tested on production · never-sends-twice tested
// on a copy. A red check HOLDS FULL AUTO's own send; the person's approval and a pick's Apply tap are not gated.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { fullAutoPrerequisites, fullAutoBlocked, recordAttestation, ATTESTED, ATTEST_MAX_AGE_DAYS, HOLD_REASON } from "../services/fullAutoGate.js";
import { setCostAlarmThreshold } from "../services/modelUsage.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const NOW = 1_800_000_000, DAY = 86400;
function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const state = (db, nowSec = NOW) => Object.fromEntries(fullAutoPrerequisites(db, { env: {}, nowSec }).checks.map(c => [c.id, c.ok]));

test("d175FullAutoPrerequisitesGate: red until all four are green; the hold names what is red", () => {
  const db = freshDb();
  assert.deepEqual(state(db), { injection_defence: true, cost_alarm: false, kill_switch_verified: false, never_twice_verified: false });
  const why = fullAutoBlocked(db, { env: {}, nowSec: NOW });
  assert.match(why, /^Held: sending without your review waits until draft's safety checks are green \(/);
  assert.match(why, /A daily cost alarm/); assert.match(why, /kill switch/); assert.match(why, /Nothing was sent\.$/);
  setCostAlarmThreshold(db, 5, { reason: "test" });
  recordAttestation(db, "kill_switch_verified", { reason: "Stopped run 812 mid-fill from Admin within one step", nowSec: NOW });
  assert.equal(fullAutoBlocked(db, { env: {}, nowSec: NOW }) !== null, true, "three of four is still a hold");
  recordAttestation(db, "never_twice_verified", { reason: "idempotency run on the 11-06 copy: 0 duplicates", nowSec: NOW });
  assert.equal(fullAutoPrerequisites(db, { env: {}, nowSec: NOW }).allOk, true);
  assert.equal(fullAutoBlocked(db, { env: {}, nowSec: NOW }), null);
});

test("d175FullAutoPrerequisitesGate: a test recorded more than 30 days ago goes red again; a cleared one is red", () => {
  const db = freshDb();
  setCostAlarmThreshold(db, 5, { reason: "test" });
  for (const id of Object.keys(ATTESTED)) recordAttestation(db, id, { reason: "tested on production today", nowSec: NOW });
  assert.equal(fullAutoPrerequisites(db, { env: {}, nowSec: NOW + (ATTEST_MAX_AGE_DAYS + 1) * DAY }).allOk, false);
  recordAttestation(db, "kill_switch_verified", { clear: true, nowSec: NOW });
  assert.equal(state(db).kill_switch_verified, false);
});

test("d175FullAutoPrerequisitesGate: recording needs a reason, names a known check, and leaves an audit row", () => {
  const db = freshDb();
  assert.throws(() => recordAttestation(db, "kill_switch_verified", { reason: "ok" }), /say what was tested/);
  assert.throws(() => recordAttestation(db, "everything_fine", { reason: "a long enough reason" }), /unknown check/);
  recordAttestation(db, "never_twice_verified", { reason: "idempotency run on a copy: 0 duplicates", nowSec: NOW });
  const row = db.prepare(`SELECT action, target, reason FROM admin_audit_log ORDER BY id DESC LIMIT 1`).get();
  assert.deepEqual(row, { action: "full_auto_prerequisite.record", target: ATTESTED.never_twice_verified, reason: "idempotency run on a copy: 0 duplicates" });
});

test("d175FullAutoPrerequisitesGate: both unattended doors ask the gate; approved sends and pick taps are not gated (source pin)", () => {
  const apply = read("routes/apply.js");
  const gate = apply.indexOf("const blocked = fullAutoBlocked(db);");
  assert.ok(gate > 0 && gate < apply.indexOf('if (mode === "auto" && fullAutoDisabled()) {'), "checked before the kill switch's own hold");
  assert.match(apply, /if \(mode === "auto" && approvalMode === "auto" && !pickAuthorisesSend\(db, userId, jobId\)\) \{\n\s+const blocked = fullAutoBlocked\(db\);/);
  assert.match(apply, /setJobStatus\("held_review", FULL_AUTO_PREREQ_HOLD, blocked\);/);
  const worker = read("services/applyWorker.js");
  assert.match(worker, /if \(!tapped\(\) && fullAutoBlocked\(db, \{ env, nowSec \}\)\) continue;/, "left queued — nothing sealed leaves");
  assert.equal(HOLD_REASON, "full_auto_prerequisites");
  const server = read("server.js");
  assert.match(server, /app\.get\("\/api\/admin\/full-auto\/prerequisites", requireAdmin,/);
  assert.match(server, /app\.post\("\/api\/admin\/full-auto\/prerequisites", requireAdmin,/);
});

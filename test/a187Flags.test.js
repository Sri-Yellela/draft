import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { flagState, flagOn, flagBucket, setFlag, rollbackFlag, flagHistory } from "../services/flags.js";
import { createFlagsAdminRouter } from "../routes/flags.js";
import { FLAGS } from "../shared/flags.js";

// ⭐ A187 Stage 0 (46i) · runtime flags on D162's pattern: registry default → the environment → the admin's switch
// (app_settings, read at call time, audited, rollback one step). The first flag: ats_store_slim.

function mkdb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
    CREATE TABLE admin_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL DEFAULT (unixepoch()), admin_user_id INTEGER,
      action TEXT NOT NULL, target TEXT, before_json TEXT, after_json TEXT, undone_at INTEGER, reason TEXT, actor_kind TEXT, actor TEXT);`);
  return db;
}

test("a187 flags: three layers — default, then the environment, then the admin's switch", () => {
  const db = mkdb();
  assert.deepEqual([flagState(db, "ats_store_slim", {}).state, flagState(db, "ats_store_slim", {}).layer], ["off", "default"]);
  assert.deepEqual([flagState(db, "ats_store_slim", { ATS_STORE_SLIM: "on" }).state, flagState(db, "ats_store_slim", { ATS_STORE_SLIM: "on" }).layer], ["on", "env"]);
  setFlag(db, "ats_store_slim", { state: "off", reason: "hold while measuring" });
  const st = flagState(db, "ats_store_slim", { ATS_STORE_SLIM: "on" });
  assert.deepEqual([st.state, st.layer, st.env], ["off", "override", "on"], "the admin's switch beats the deploy's variable");
  setFlag(db, "ats_store_slim", { state: "inherit", reason: "back to the deploy's setting" });
  assert.equal(flagState(db, "ats_store_slim", { ATS_STORE_SLIM: "on" }).layer, "env");
});

test("a187 flags: a switch takes effect at once (no restart), and every change is audited and undoable", () => {
  const db = mkdb();
  assert.equal(flagOn(db, "ats_store_slim"), false);
  setFlag(db, "ats_store_slim", { state: "on", reason: "storage", actor: { kind: "admin", ref: "admin:1", userId: null } });
  assert.equal(flagOn(db, "ats_store_slim"), true, "no memo survives a write");
  rollbackFlag(db, "ats_store_slim", { reason: "the deck got slower" });
  assert.equal(flagOn(db, "ats_store_slim"), false);
  const h = flagHistory(db, "ats_store_slim");
  assert.deepEqual(h.map(r => r.action), ["flag_rollback", "flag_set"]);
  assert.equal(h[1].reason, "storage");
  assert.ok(h[1].undone_at, "the undone change is marked");
  assert.throws(() => rollbackFlag(db, "ats_store_slim", { reason: "again" }), /nothing to roll back/);
});

test("a187 flags: refusals — no reason, an unknown flag, a cohort on an all-or-nothing flag, a bad state", () => {
  const db = mkdb();
  assert.throws(() => setFlag(db, "ats_store_slim", { state: "on", reason: " " }), /say why/);
  assert.throws(() => setFlag(db, "nope", { state: "on", reason: "x" }), /unknown flag/);
  assert.equal(FLAGS.ats_store_slim.cohort, false);
  assert.throws(() => setFlag(db, "ats_store_slim", { state: "cohort", percent: 10, reason: "x" }), /all-or-nothing/);
  assert.throws(() => setFlag(db, "ats_store_slim", { state: "maybe", reason: "x" }), /state must be one of/);
  assert.throws(() => flagState(db, "nope"), /unknown flag/);
});

test("a187 flags: a cohort bucket is stable per person × flag and spreads", () => {
  assert.equal(flagBucket("x", 42), flagBucket("x", 42));
  const counts = Array(10).fill(0);
  for (let u = 0; u < 5000; u++) counts[Math.floor(flagBucket("x", u) / 10)]++;
  for (const c of counts) assert.ok(c > 380 && c < 620, `a decile holds ${c} of 5000`);
});

test("a187 flags: the admin routes list, switch and roll back; mounted behind requireAdmin", async () => {
  const db = mkdb();
  const app = express(); app.use(express.json());
  app.use("/f", createFlagsAdminRouter(db));
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}/f`;
  try {
    const list = await (await fetch(base)).json();
    // D184 B-8 (46y) added the second flag, board_contextual_tiebreak (on by default, measured) — moved on purpose
    assert.deepEqual(list.flags.map(f => [f.key, f.state, f.layer]), [["ats_store_slim", "off", "default"], ["board_contextual_tiebreak", "on", "default"]]);
    const no = await fetch(`${base}/ats_store_slim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: "on" }) });
    assert.equal(no.status, 400);
    const ok = await (await fetch(`${base}/ats_store_slim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: "on", reason: "storage" }) })).json();
    assert.equal(ok.flag.state, "on");
    const one = await (await fetch(`${base}/ats_store_slim`)).json();
    assert.equal(one.history.length, 1);
    const rb = await (await fetch(`${base}/ats_store_slim/rollback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "undo" }) })).json();
    assert.equal(rb.flag.state, "off");
    assert.equal((await fetch(`${base}/nope`)).status, 404);
  } finally { server.close(); }
  const src = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(src, /app\.use\("\/api\/admin\/flags", requireAdmin, createFlagsAdminRouter\(db\)\);/);
});

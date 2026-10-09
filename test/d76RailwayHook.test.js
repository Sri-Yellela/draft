// ⛔ D76 · POST /api/hooks/railway — a PUBLIC endpoint, tested as hostile-input code. Each red when removed:
// no header → 401 with NO body · an unknown event type is dropped · an oversize payload is refused · the
// endpoint never writes outside deploy_events · a Deployment.failed event shows red in Admin. Plus: only ids
// are kept (no commit message, no author), a malformed id is dropped, and the rate limit holds.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createRailwayHookRouter, deployEventsSummary, RATE_PER_MINUTE } from "../routes/railwayHook.js";
import { isAlarm, parseRailwayEvent } from "../shared/deployEvents.js";

const TOKEN = "r".repeat(48);
const quiet = { warn: () => {}, error: () => {} };
const EVENT = (type = "Deployment.failed", extra = {}) => ({
  type,
  details: { id: "8107edff-4b8e-44fc-b43a-04566e847a2a", source: "GitHub", status: "FAILED", branch: "main",
             commitHash: "7712761abcdef", commitAuthor: "A Person", commitMessage: "feat: something private" },
  resource: { workspace: { id: "w1", name: "ws" }, project: { id: "p1", name: "resume-master" },
              environment: { id: "e1", name: "production", isEphemeral: false }, service: { id: "s1", name: "draft" },
              deployment: { id: "d-123" } },
  severity: "WARNING", timestamp: "2026-10-09T08:00:00.000Z", ...extra,
});

async function harness(env = { RAILWAY_WEBHOOK_TOKEN: TOKEN }) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const app = express();
  app.use("/api/hooks", createRailwayHookRouter(db, { env, log: quiet }));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/hooks/railway`;
  const post = (body, headers = { authorization: `Bearer ${TOKEN}` }) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  return { db, post, close: () => server.close() };
}
const rows = (db) => db.prepare("SELECT * FROM deploy_events ORDER BY id").all();

test("⛔ D76: no header, a wrong one, or no token on the server → 401 with NO body", async () => {
  const h = await harness();
  try {
    for (const headers of [{}, { authorization: "Bearer nope" }, { authorization: TOKEN }, { "x-webhook-secret": TOKEN }]) {
      const r = await h.post(EVENT(), headers);
      assert.equal(r.status, 401, JSON.stringify(headers));
      assert.equal(await r.text(), "", "no body");
    }
    assert.deepEqual(rows(h.db), []);
  } finally { h.close(); }
  const off = await harness({});
  try { assert.equal((await off.post(EVENT())).status, 401, "no token configured = off, not open"); } finally { off.close(); }
});

test("⛔ D76: an unknown event type is dropped; a known one is kept — the answer is the same empty 204", async () => {
  const h = await harness();
  try {
    for (const type of ["Payment.succeeded", "Deployment.exploded", "Deployment", "x".repeat(70), "Deployment.failed; DROP TABLE"]) {
      const r = await h.post(EVENT(type));
      assert.equal(r.status, 204, type);
      assert.equal(await r.text(), "");
    }
    assert.deepEqual(rows(h.db), [], "nothing kept");
    assert.equal((await h.post(EVENT("Deployment.crashed"))).status, 204);
    assert.equal(rows(h.db).length, 1);
  } finally { h.close(); }
});

test("⛔ D76: an oversize payload is refused, and so is a body that is not JSON", async () => {
  const h = await harness();
  try {
    const big = await h.post(EVENT("Deployment.failed", { padding: "x".repeat(20 * 1024) }));
    assert.equal(big.status, 413);
    assert.equal(await big.text(), "");
    assert.equal((await h.post("{not json")).status, 400);
    assert.deepEqual(rows(h.db), []);
  } finally { h.close(); }
});

test("⛔ D76: the endpoint never writes outside deploy_events", async () => {
  const h = await harness();
  try {
    const tables = h.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
    const counts = () => Object.fromEntries(tables.map(t => [t, h.db.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n]));
    const before = counts();
    for (const type of ["Deployment.failed", "Deployment.success", "VolumeAlert.triggered", "Unknown.thing"]) await h.post(EVENT(type));
    await h.post(EVENT(), {});
    const after = counts();
    for (const t of tables) if (t !== "deploy_events") assert.equal(after[t], before[t], `${t} was written`);
    assert.equal(after.deploy_events, 3);
  } finally { h.close(); }
});

test("⛔ D76: only ids are kept — no commit message, no author, and a malformed id is dropped", async () => {
  const h = await harness();
  try {
    await h.post(EVENT("Deployment.failed", { resource: { ...EVENT().resource, service: { id: "<script>", name: "draft" } } }));
    const [r] = rows(h.db);
    assert.deepEqual([r.event_type, r.family, r.state, r.service_name, r.service_id, r.deployment_id, r.commit_hash, r.environment_name],
                     ["Deployment.failed", "deployment", "failed", "draft", null, "d-123", "7712761abcdef", "production"]);
    const stored = JSON.stringify(r);
    assert.doesNotMatch(stored, /A Person|something private|GitHub/, "nothing beyond ids and names");
    assert.equal(parseRailwayEvent([]).ok, false);
    assert.equal(parseRailwayEvent("Deployment.failed").ok, false);
  } finally { h.close(); }
});

test("D76: the rate limit holds", async () => {
  const h = await harness();
  try {
    let last;
    for (let i = 0; i <= RATE_PER_MINUTE; i++) last = await h.post(EVENT("Deployment.success"));
    assert.equal(last.status, 429);
  } finally { h.close(); }
});

test("⛔ D76: a Deployment.failed event is the Admin card's RED, and the card reads it through one rule", async () => {
  const h = await harness();
  try {
    await h.post(EVENT("Deployment.success", { resource: { ...EVENT().resource, service: { id: "s2", name: "resume-master" } } }));
    await h.post(EVENT("Deployment.failed"));
    const { latest } = deployEventsSummary(h.db);
    const byService = Object.fromEntries(latest.map(e => [e.service_name, e]));
    assert.equal(isAlarm(byService.draft), true, "failed → red");
    assert.equal(isAlarm(byService["resume-master"]), false, "success → not red");
    assert.equal(isAlarm({ family: "deployment", state: "crashed" }), true);
    assert.equal(isAlarm({ family: "volume", state: "triggered" }), true, "a volume alert is red too");
  } finally { h.close(); }
  const card = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(card, /isAlarm\(e\) \? C\.DANGER/, "the card colours an alarm with the danger token, from the shared rule");
  assert.match(fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8"), /\{at\("today", "deploys"\) && <DeploymentsPanel theme=\{theme\}\/>\}/,
    "and Today → Deployments shows the card (D83's map; audit #2 + #3 are one panel)");
});

test("D76: Railway's webhook event names (deployed, redeployed, oom_killed …) are kept; oom_killed is an alarm", () => {
  for (const t of ["Deployment.deployed", "Deployment.redeployed", "Deployment.oom_killed", "Deployment.restarted", "Deployment.resumed", "Deployment.slept"]) {
    assert.equal(parseRailwayEvent(EVENT(t)).ok, true, t);
  }
  assert.equal(isAlarm(parseRailwayEvent(EVENT("Deployment.oom_killed")).row), true);
  assert.equal(isAlarm(parseRailwayEvent(EVENT("Deployment.deployed")).row), false);
  assert.equal(parseRailwayEvent(EVENT("VolumeAlert.triggered")).row.family, "volume");
  assert.equal(parseRailwayEvent(EVENT("Monitor.resolved")).row.family, "monitor");
});

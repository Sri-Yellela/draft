import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import portalRoutes, { createApplyWorkerRouter } from "../routes/applyWorker.js";
import { enqueueRemoteRun, storeSession, listPortals, MAX_ATTEMPTS } from "../services/applyWorker.js";
import { sign } from "../crawler/lib/signature.js";

// ⭐ D100 P2 / P4 (owner 10-30) · the apply worker's queue on draft's side: sealed sessions (ciphertext only),
// the signed lease / report API, approval with value verification, and the product rules that stay.
// Synthetic user, synthetic portal (portal.example.test), synthetic "ciphertext".

const TOKEN = "t".repeat(40);
const CT = "c2VhbGVkLWNpcGhlcnRleHQtbm90LXJlYWRhYmxlLWJ5LWRyYWZ0LWF0LWFsbA==";

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO'), (2,'eli','x','PRO')").run();
  return db;
}
const session = (db, userId = 1, over = {}) => storeSession(db, userId, {
  portalFamily: "exampleportal", originHost: "portal.example.test", keyId: "key_abcdef123456", ciphertext: CT, consent: true, ...over,
}).id;

let n = 0;
function heldGate(db, { userId = 1, approval = "required", answers = [{ label: "First Name", value: "Dana" }] } = {}) {
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (?,'auto','completed',1,?)").run(userId, approval).lastInsertRowid;
  const job = `wd::${++n}`;
  const rj = db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code) VALUES (?,?,?,'held_gate','login_required')").run(run, userId, job).lastInsertRowid;
  db.prepare("INSERT INTO application_records (user_id, job_id, state, origin) VALUES (?,?,'pending','drafted')").run(userId, job);
  const packetId = db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,0)`).run(userId, run, rj, job, "https://acme.portal.example.test/apply/1", "https://acme.portal.example.test", "login_required",
    JSON.stringify({ answers, applyUrl: "https://acme.portal.example.test/apply/1" }), `h${n}`).lastInsertRowid;
  return { runJobId: Number(rj), packetId: Number(packetId), job };
}

function mount(db, { env = { APPLY_WORKER_TOKEN: TOKEN }, client = null, userId = 1 } = {}) {
  const submitted = [];
  const app = express();
  app.use("/api/worker", createApplyWorkerRouter(db, { env, hooks: { onSubmitted: (x) => submitted.push(x) } }));
  app.use(express.json({ limit: "3mb" }));
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  portalRoutes(app, db, (_q, _r, nx) => nx(), { client });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json() });
  return {
    submitted,
    lease: (auth = `Bearer ${TOKEN}`) => fetch(base + "/api/worker/lease", { headers: { authorization: auth, "x-worker-id": "w1" } }).then(j),
    report: (obj, { signed = true } = {}) => {
      const body = JSON.stringify(obj);
      return fetch(base + "/api/worker/report", { method: "POST", body,
        headers: { "content-type": "application/json", "x-worker-id": "w1", ...(signed ? sign(body, TOKEN) : {}) } }).then(j);
    },
    call: (method, p, body) => fetch(base + p, { method, headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined }).then(j),
    stop: () => server.close(),
  };
}

test("D100 · d100SessionSealedCiphertextOnly — consent first, ciphertext only, never echoed back", async () => {
  const db = freshDb();
  assert.throws(() => session(db, 1, { consent: false }), /Consent/);
  assert.throws(() => session(db, 1, { ciphertext: '{"cookies":[{"name":"sid","value":"secret"}]}' }), /sealed session/);
  assert.throws(() => session(db, 1, { keyId: "" }), /key id/);
  session(db);
  const t = mount(db);
  try {
    const plain = await t.call("POST", "/api/portals/upload", { portalFamily: "exampleportal", originHost: "portal.example.test",
      storageState: { cookies: [{ name: "sid", value: "secret" }] }, consent: true });
    assert.equal(plain.status, 400, "a plaintext session is refused");
    const list = await t.call("GET", "/api/portals");
    assert.equal(list.body.portals.length, 1);
    assert.doesNotMatch(JSON.stringify(list.body), new RegExp(CT.slice(0, 20)), "the ciphertext is never returned to a page");
    assert.equal(list.body.portals[0].status, "active");
  } finally { t.stop(); }
});

test("D100 · the worker's doors: off without a token, Bearer to lease, a signature to report", async () => {
  const db = freshDb();
  const off = mount(db, { env: {} });
  try { assert.equal((await off.lease()).status, 503); } finally { off.stop(); }
  const t = mount(db);
  try {
    assert.equal((await t.lease("Bearer wrong")).status, 401);
    assert.equal((await t.lease()).status, 204, "nothing queued");
    assert.equal((await t.report({ remoteId: 1, outcome: "filled" }, { signed: false })).status, 401);
  } finally { t.stop(); }
});

test("D100 P4 · SEMI: a gated job with a connected portal is leased with its packet and session, filled, then approved by VALUES", async () => {
  const db = freshDb();
  session(db);
  const g = heldGate(db);
  const remoteId = enqueueRemoteRun(db, { userId: 1, runJobId: g.runJobId, packetId: g.packetId,
    applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: "required" });
  assert.ok(remoteId);
  assert.equal(enqueueRemoteRun(db, { userId: 1, runJobId: 999, packetId: 1, applyUrl: "https://elsewhere.test/x", approvalMode: "required" }),
    null, "no session for that host — the gated handoff stands");
  const t = mount(db);
  try {
    const l = await t.lease();
    assert.equal(l.status, 200);
    assert.equal(l.body.run.mode, "fill");
    assert.equal(l.body.run.session.ciphertext, CT, "the worker gets the ciphertext — only it holds the key");
    assert.deepEqual(l.body.run.rules, { tickConsent: false, answerHumanCheck: false, guessEligibility: false });
    assert.equal(l.body.run.packet.answers[0].label, "First Name");
    assert.equal((await t.lease()).status, 204, "a leased run is not leased twice");
    const r = await t.report({ remoteId, outcome: "filled", fields: [{ label: "First Name", value: "Dana", source: "profile" }] });
    assert.equal(r.body.state, "ready_to_approve");
    assert.deepEqual(db.prepare("SELECT status, reason_code FROM apply_run_jobs WHERE id=?").get(g.runJobId),
      { status: "held_review", reason_code: "awaiting_approval" });
    // approve → the worker refills and must send exactly these values
    assert.equal((await t.call("POST", `/api/portals/approve/${g.runJobId}`)).status, 200);
    const l2 = await t.lease();
    assert.equal(l2.body.run.mode, "submit");
    assert.deepEqual(l2.body.run.approvedValues, { "First Name": "Dana" });
    const s = await t.report({ remoteId, outcome: "submitted", fields: [{ label: "First Name", value: "Dana" }], evidence: { confirmation: "Thank you" } });
    assert.equal(s.body.state, "submitted");
    assert.deepEqual(db.prepare("SELECT status, submitted_by FROM apply_run_jobs WHERE id=?").get(g.runJobId), { status: "submitted", submitted_by: "user" });
    assert.equal(t.submitted.length, 1, "recorded the way every pipeline submit is");
    assert.equal(listPortals(db, 1)[0].uses.length, 2, "the use log shows both uses");
  } finally { t.stop(); }
});

test("D100 · a submit whose values differ from the approved ones is stopped, not recorded", async () => {
  const db = freshDb();
  session(db);
  const g = heldGate(db, { approval: "approved" });
  const remoteId = enqueueRemoteRun(db, { userId: 1, runJobId: g.runJobId, packetId: g.packetId,
    applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: "approved", approvedValues: { "First Name": "Dana" } });
  const t = mount(db);
  try {
    await t.lease();
    const r = await t.report({ remoteId, outcome: "submitted", fields: [{ label: "First Name", value: "Daniel" }] });
    assert.equal(r.body.state, "stopped");
    assert.equal(db.prepare("SELECT reason_code FROM apply_run_jobs WHERE id=?").pluck().get(g.runJobId), "submit_check_failed");
    assert.equal(t.submitted.length, 0);
  } finally { t.stop(); }
});

test("D100 · d100ConsentNeverTicked / d100HumanCheckNeverAnswered — the worker's stop goes to Needs you with its reason", async () => {
  const db = freshDb();
  session(db);
  const t = mount(db);
  try {
    for (const [reason, code] of [["consent_required", "consent_required"], ["human_check", "human_check"],
      ["eligibility_unanswered", "needs_you_eligibility"], ["signed_out", "session_signed_out"]]) {
      const g = heldGate(db);
      const remoteId = enqueueRemoteRun(db, { userId: 1, runJobId: g.runJobId, packetId: g.packetId,
        applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: "required" });
      await t.lease();
      assert.equal((await t.report({ remoteId, outcome: "stopped", reason })).body.state, "stopped");
      assert.equal(db.prepare("SELECT reason_code FROM apply_run_jobs WHERE id=?").pluck().get(g.runJobId), code, reason);
    }
  } finally { t.stop(); }
});

test("D100 · unattended (FULL AUTO, no approved values): only for a FULL AUTO user, and the kill switch stops it", async () => {
  const db = freshDb();
  session(db);
  const g = heldGate(db, { approval: "auto" });
  enqueueRemoteRun(db, { userId: 1, runJobId: g.runJobId, packetId: g.packetId, applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: "auto" });
  const killed = mount(db, { env: { APPLY_WORKER_TOKEN: TOKEN, APPLY_FULL_AUTO_DISABLED: "1" } });
  try {
    db.prepare("UPDATE users SET send_mode='auto' WHERE id=1").run(); // only the kill switch stands in the way
    assert.equal((await killed.lease()).status, 423, "the kill switch: nothing unattended leaves");
    assert.equal(db.prepare("SELECT state FROM apply_remote_runs").pluck().get(), "queued", "held, not spent");
    db.prepare("UPDATE users SET send_mode=NULL WHERE id=1").run();
  } finally { killed.stop(); }
  const t = mount(db);
  try {
    assert.equal((await t.lease()).status, 204, "a SEMI user's unattended run is stopped at the lease");
    assert.equal(db.prepare("SELECT state, outcome FROM apply_remote_runs").get().outcome, "full_auto_not_chosen");
    db.prepare("UPDATE users SET send_mode='auto' WHERE id=1").run();
    const g2 = heldGate(db, { approval: "auto" });
    const id2 = enqueueRemoteRun(db, { userId: 1, runJobId: g2.runJobId, packetId: g2.packetId, applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: "auto" });
    assert.equal((await t.lease()).body.run.id, id2);
    await t.report({ remoteId: id2, outcome: "submitted", fields: [{ label: "First Name", value: "Dana" }] });
    assert.equal(db.prepare("SELECT submitted_by FROM apply_run_jobs WHERE id=?").pluck().get(g2.runJobId), "auto");
  } finally { t.stop(); }
});

test("D100 · d100RevokeMakesUnreadable — Remove destroys the key, cancels queued runs, and nothing is leased again", async () => {
  const db = freshDb();
  const sid = session(db);
  const g = heldGate(db);
  enqueueRemoteRun(db, { userId: 1, runJobId: g.runJobId, packetId: g.packetId, applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: "required" });
  const destroyed = [];
  const t = mount(db, { client: { destroyKey: async (k) => { destroyed.push(k); }, mintKey: async () => ({}) } });
  try {
    assert.equal((await t.call("DELETE", `/api/portals/${sid}`)).body.keyDestroyed, true);
    assert.deepEqual(destroyed, ["key_abcdef123456"]);
    assert.equal(db.prepare("SELECT state FROM apply_remote_runs").pluck().get(), "cancelled");
    assert.equal((await t.lease()).status, 204);
    assert.equal(listPortals(db, 1)[0].status, "removed");
    assert.equal((await t.call("DELETE", `/api/portals/${sid}`)).status, 404, "already removed");
  } finally { t.stop(); }
  // another user cannot remove it
  const other = mount(db, { userId: 2 });
  try { assert.equal((await other.call("DELETE", `/api/portals/${session(db)}`)).status, 404); } finally { other.stop(); }
});

test("D100 · a worker error is retried, never stamped attempted, until the attempts run out", async () => {
  const db = freshDb();
  session(db);
  const g = heldGate(db);
  const remoteId = enqueueRemoteRun(db, { userId: 1, runJobId: g.runJobId, packetId: g.packetId, applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: "required" });
  const t = mount(db);
  try {
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await t.lease();
      assert.equal((await t.report({ remoteId, outcome: "error", error: "timeout" })).body.state, "queued");
    }
    await t.lease();
    assert.equal((await t.report({ remoteId, outcome: "error", error: "timeout" })).body.state, "failed");
    assert.equal(db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(g.runJobId), "failed");
  } finally { t.stop(); }
});

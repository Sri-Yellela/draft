// routes/accountManagement.js over HTTP: recent-sign-in gates, the picture judged by its bytes,
// sessions signed out in the STORE, merge only after proving the other account, delete cleans up.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import session from "express-session";
import multer from "multer";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createAccountManagementRouter } from "../routes/accountManagement.js";
import { recordSession } from "../services/accountService.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const hash = (p) => `h:${p}`;
const verify = (p, h) => h === `h:${p}`;

async function harness(t) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (3, 'owner', 'h:owner-pass', 1)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, password_set, google_auth_id) VALUES (10, 'g10', 'h:rand', 0, 'sub-10')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (11, 'second', 'h:second-pass', 1)").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (11, 'j9', 1)").run();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "acct-"));
  const store = new session.MemoryStore();
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "t", resave: false, saveUninitialized: false, store }));
  app.use((req, _res, next) => { req.logout = (cb) => { delete req.session.uid; cb(); }; next(); });
  // test-only sign-in: ?fresh=1 stamps authAt as a real login does
  app.post("/test/login/:id", (req, res) => {
    req.session.uid = Number(req.params.id);
    if (req.query.fresh) req.session.authAt = Date.now();
    recordSession(db, { sid: req.sessionID, userId: req.session.uid, userAgent: req.get("user-agent") });
    res.json({ ok: true });
  });
  const requireAuth = (req, res, next) => {
    const u = req.session?.uid && db.prepare("SELECT id FROM users WHERE id = ?").get(req.session.uid);
    if (!u) return res.status(401).json({ error: "unauthenticated" });
    req.user = { id: u.id }; next();
  };
  const sent = [];
  app.use(createAccountManagementRouter({
    db, requireAuth, store, dataDir, multer, hashPassword: hash, verifyPassword: verify,
    emailConfigured: () => true, sendVerificationCodeEmail: async (m) => { sent.push(m); return { ok: true }; },
    codePepper: "pepper", revokeBrowserAuthContexts: () => {}, clearSessionCookie: (res) => res.clearCookie("connect.sid"),
    findLoginUser: (id) => db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(id),
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  t.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = "";
    const call = async (method, url, body, headers = {}) => {
      const isForm = body instanceof FormData;
      const r = await fetch(base + url, { method, headers: { ...(cookie ? { cookie } : {}), ...(body && !isForm ? { "content-type": "application/json" } : {}), ...headers },
        body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const ct = r.headers.get("content-type") || "";
      return { status: r.status, headers: r.headers, body: ct.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()) };
    };
    return { call };
  };
  return { db, store, dataDir, client, sent };
}
const storeSids = (store) => new Promise((r) => store.all((_e, all) => r(Object.keys(all || {}))));

test("the account summary; sensitive actions need a recent sign-in", async (t) => {
  const { client } = await harness(t);
  const c = client();
  await c.call("POST", "/test/login/3");
  const a = await c.call("GET", "/api/account");
  assert.equal(a.status, 200);
  assert.equal(a.body.username, "owner");
  assert.equal(a.body.recentAuth, false);
  assert.equal((await c.call("POST", "/api/account/delete", { confirm: "owner" })).body.error, "reauth_required");
  assert.equal((await c.call("POST", "/api/account/reauth", { password: "wrong" })).status, 403);
  assert.equal((await c.call("POST", "/api/account/reauth", { password: "owner-pass" })).status, 200);
  assert.equal((await c.call("GET", "/api/account")).body.recentAuth, true);
});

test("the picture: a PNG is stored and served as image/png with nosniff; an SVG is refused", async (t) => {
  const { client, db, dataDir } = await harness(t);
  const c = client();
  await c.call("POST", "/test/login/3");
  const svg = new FormData(); svg.append("avatar", new Blob(["<svg onload=alert(1)>"], { type: "image/png" }), "x.png");
  assert.equal((await c.call("POST", "/api/account/avatar", svg)).status, 415);
  const png = new FormData(); png.append("avatar", new Blob([PNG], { type: "image/png" }), "me.png");
  const up = await c.call("POST", "/api/account/avatar", png);
  assert.equal(up.status, 200);
  assert.equal(up.body.account.hasAvatar, true);
  const got = await c.call("GET", "/api/account/avatar");
  assert.equal(got.headers.get("content-type"), "image/png");
  assert.equal(got.headers.get("x-content-type-options"), "nosniff");
  const rel = db.prepare("SELECT avatar_path p FROM users WHERE id = 3").get().p;
  assert.ok(fs.existsSync(path.join(dataDir, rel)));
  await c.call("DELETE", "/api/account/avatar");
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(!fs.existsSync(path.join(dataDir, rel)));
});

test("sessions: another browser is signed out in the store; a password change signs out the rest", async (t) => {
  const { client, store } = await harness(t);
  const a = client(), b = client();
  await a.call("POST", "/test/login/3"); await b.call("POST", "/test/login/3");
  const list = await a.call("GET", "/api/account/sessions");
  assert.equal(list.body.sessions.length, 2);
  const other = list.body.sessions.find(s => !s.current);
  assert.equal((await a.call("DELETE", `/api/account/sessions/${other.id}`)).status, 200);
  assert.equal((await b.call("GET", "/api/account")).status, 401);
  assert.equal((await storeSids(store)).length, 1);
  const c = client(); await c.call("POST", "/test/login/3");
  assert.equal((await a.call("POST", "/api/account/password", { current: "owner-pass", next: "new-password-1" })).status, 200);
  assert.equal((await c.call("GET", "/api/account")).status, 401);
  assert.equal((await a.call("GET", "/api/account")).status, 200);
});

test("merge only after proving the other account; then it is gone and its data is here", async (t) => {
  const { client, db } = await harness(t);
  const c = client();
  await c.call("POST", "/test/login/3");
  assert.equal((await c.call("POST", "/api/account/merge", { confirm: true })).body.error, "no_candidate");
  assert.equal((await c.call("POST", "/api/account/merge/verify-password", { identifier: "second", password: "nope" })).status, 403);
  // an OAuth-only account has no password to prove it with
  assert.equal((await c.call("POST", "/api/account/merge/verify-password", { identifier: "g10", password: "rand" })).status, 403);
  const v = await c.call("POST", "/api/account/merge/verify-password", { identifier: "second", password: "second-pass" });
  assert.equal(v.status, 200);
  assert.equal(v.body.preview.counts.user_jobs, 1);
  assert.equal((await c.call("GET", "/api/account")).body.mergeReady.via, "password");
  assert.equal((await c.call("POST", "/api/account/merge", {})).body.error, "confirm_required");
  const m = await c.call("POST", "/api/account/merge", { confirm: true });
  assert.equal(m.status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE id = 11").get().n, 0);
  assert.equal(db.prepare("SELECT starred FROM user_jobs WHERE user_id = 3 AND job_id = 'j9'").get().starred, 1);
});

test("email change: a code to the new address, confirmed; delete needs the username typed", async (t) => {
  const { client, db, sent } = await harness(t);
  const c = client();
  await c.call("POST", "/test/login/3?fresh=1");
  assert.equal((await c.call("POST", "/api/account/email", { email: "not-an-email" })).status, 400);
  assert.equal((await c.call("POST", "/api/account/email", { email: "New@Example.com" })).status, 200);
  assert.equal(sent[0].to, "new@example.com");
  const ok = await c.call("POST", "/api/account/email/confirm", { code: sent[0].code });
  assert.equal(ok.body.account.email, "new@example.com");
  assert.equal(ok.body.account.emailVerified, true);
  assert.equal((await c.call("POST", "/api/account/delete", { confirm: "someone" })).body.error, "confirm_required");
  assert.equal((await c.call("POST", "/api/account/delete", { confirm: "owner" })).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE id = 3").get().n, 0);
  assert.equal((await c.call("GET", "/api/account")).status, 401);
});

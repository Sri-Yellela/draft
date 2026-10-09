// Sessions A′ (owner, 10-09): the admin and the owner's own account open at once, one per tab, in one browser.
// The cookie belongs to whichever account signed in last; each tab acts as ITS token's account. These tests
// run the real account router with a session shaped like production's (passport.user) and a per-tab token.
// The two-tab behaviour end to end is scripts/sessionsTwoTabs.mjs, against a throwaway server.
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
import { at, lastAt } from "../test-support/sourceAnchors.js";

const hash = (p) => `h:${p}`;
const verify = (p, h) => h === `h:${p}`;

async function harness(t) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (3, 'admin', 'h:admin-pass', 1)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (11, 'me', 'h:me-pass', 1)").run();
  const tokens = new Map();                       // token → { userId, authAt, sid }  (the auth_contexts rows)
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "two-acct-"));
  const store = new session.MemoryStore();
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "t", resave: false, saveUninitialized: false, store }));
  app.use((req, _res, next) => { req.logout = (cb) => { delete req.session.passport; cb(); }; next(); });
  // A browser sign-in: the cookie becomes this account, and the tab gets a token stamped "signed in now".
  app.post("/test/login/:id", (req, res) => {
    req.session.passport = { user: Number(req.params.id) };
    req.session.authAt = req.query.stale ? Date.now() - 60 * 60 * 1000 : Date.now();
    const token = `tok-${req.params.id}-${tokens.size}`;
    tokens.set(token, { userId: Number(req.params.id), authAt: req.query.stale ? Date.now() - 60 * 60 * 1000 : Date.now(), sid: req.sessionID });
    res.json({ token });
  });
  // bindAuthContext's shape: a header token wins over the cookie for req.user.
  app.use((req, _res, next) => {
    const tk = req.get("x-tab-token");
    const row = tk && tokens.get(tk);
    if (row) { req.user = { id: row.userId }; req.authContextToken = tk; }
    else if (req.session?.passport?.user) req.user = { id: req.session.passport.user };
    next();
  });
  const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "unauthenticated" }));
  app.use(createAccountManagementRouter({
    db, requireAuth, store, dataDir, multer, hashPassword: hash, verifyPassword: verify,
    emailConfigured: () => true, sendVerificationCodeEmail: async () => ({ ok: true }), codePepper: "p",
    revokeBrowserAuthContexts: () => {}, clearSessionCookie: (res) => res.clearCookie("connect.sid"),
    findLoginUser: (id) => db.prepare("SELECT * FROM users WHERE username = ?").get(id),
    authContextAuthAt: (tk) => { const r = tokens.get(tk); return r ? { authAt: r.authAt, sid: r.sid } : null; },
    stampAuthContextAuthAt: (tk, ms = Date.now()) => { const r = tokens.get(tk); if (r) r.authAt = ms; },
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  t.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";                                  // ONE browser: every tab shares this
  const call = async (method, url, { body, token } = {}) => {
    const r = await fetch(base + url, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-tab-token": token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { call, tokens };
}

test("⛔ A′: the step-up check reads the ACTING tab's sign-in, not the cookie's", async (t) => {
  const { call } = await harness(t);
  const adminTab = (await call("POST", "/test/login/3?stale=1")).body.token;   // the admin signed in an hour ago
  const meTab = (await call("POST", "/test/login/11")).body.token;             // the owner's own account just now — the cookie is now theirs
  const asAdmin = await call("GET", "/api/account", { token: adminTab });
  assert.equal(asAdmin.body.username, "admin");
  assert.equal(asAdmin.body.recentAuth, false, "the admin's change is judged by the ADMIN's sign-in, not tab B's fresh one");
  assert.equal((await call("GET", "/api/account", { token: meTab })).body.recentAuth, true);
});

test("⛔ A′: confirming the admin's password does not hand the OTHER account a recent sign-in", async (t) => {
  const { call } = await harness(t);
  const adminTab = (await call("POST", "/test/login/3?stale=1")).body.token;
  await call("POST", "/test/login/11?stale=1");                                 // the cookie: the owner's account, stale
  assert.equal((await call("POST", "/api/account/reauth", { token: adminTab, body: { password: "admin-pass" } })).status, 200);
  assert.equal((await call("GET", "/api/account", { token: adminTab })).body.recentAuth, true, "the admin's tab is fresh now");
  const cookieOnly = await call("GET", "/api/account");
  assert.equal(cookieOnly.body.username, "me");
  assert.equal(cookieOnly.body.recentAuth, false, "the cookie's account did not re-authenticate");
});

test("A′: one account in both (the common case) — reauth refreshes the tab and the session alike", async (t) => {
  const { call } = await harness(t);
  const tab = (await call("POST", "/test/login/11?stale=1")).body.token;
  await call("POST", "/api/account/reauth", { token: tab, body: { password: "me-pass" } });
  assert.equal((await call("GET", "/api/account", { token: tab })).body.recentAuth, true);
  assert.equal((await call("GET", "/api/account")).body.recentAuth, true, "the session too");
});

const SERVER = fs.readFileSync("server.js", "utf8");
const MIG = fs.readFileSync("scripts/migrations.js", "utf8");

test("⛔ A′: a sign-out whose tab token is ANOTHER account than the cookie revokes that tab only", () => {
  const route = SERVER.slice(at(SERVER, 'app.post("/api/auth/logout"'), at(SERVER, 'app.post("/api/auth/logout"') + 1800);
  assert.match(route, /req\.user\.id !== cookieUserId/);
  assert.match(route, /return res\.json\(\{ ok:true, scope:"tab" \}\)/);
  // and AH1's rule stands for every other case: the machine.
  assert.match(route, /revokeBrowserAuthContexts\(sid, token\)/);
  assert.match(route, /req\.logout\(/);
  assert.match(route, /res\.clearCookie\("connect\.sid"/);
  assert.match(route, /scope:"browser"/);
});

test("A′: a browser token carries its sign-in time; a session-less one does not", () => {
  const fn = SERVER.slice(at(SERVER, "function issueAuthContext"), at(SERVER, "function issueAuthContext") + 1400);
  assert.match(fn, /auth_at\)/);
  assert.match(fn, /options\.sessionLess \? null : now \* 1000/);
  const grab = (s) => { const i = s.indexOf("153_auth_context_auth_at"); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(grab(SERVER), grab(MIG), "migration 153 is byte-identical in both runners");
  assert.match(grab(MIG), /ALTER TABLE auth_contexts ADD COLUMN auth_at INTEGER;/);
});

test("A′: a tab arriving at the other kind's sign-in page is shown the form and told whose session the browser has", () => {
  const app = fs.readFileSync("client/src/App.jsx", "utf8");
  assert.match(app, /authUser\.isAdmin \? <><SignedInElsewhere user=\{authUser\}\/>\{children\}<\/> : <Navigate to="\/app" replace\/>/);
  assert.match(app, /<SignedInElsewhere user=\{authUser\} admin\/>\{children\}/);
  assert.match(app, /that tab stays signed in/);
});

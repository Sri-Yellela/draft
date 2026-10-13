// D95 (owner, 10-12) — AN ADMIN IS NOT A USER. "The admin account is NEVER a user account and must not show up in the
// users list. Admin and general user accounts must never mix." Each guard below is red when its rule is removed.
// Fixtures are synthetic; no real person appears.
import { allowLegacyAdminRows } from "../test-support/legacyAdminRows.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { applyPendingMigrations } from "../scripts/applyMigrations.js";
import {
  createAdminAccount, issueSignInLink, consumeSignInLink, verifyAdminSignIn, createAdminSession, resolveAdminSession,
  disableAdminAccount, isAdminSessionToken, isAdminPublicId, ADMIN_COOKIE, ADMIN_REFUSAL, emailBelongsToAdmin,
} from "../services/adminAccounts.js";
import { createAdminSessionBinder, createRequireAdmin, adminEnforced } from "../services/adminGuard.js";
import { adminActor, userActor, SYSTEM_ACTOR, toActor } from "../services/actor.js";
import { createAdminAuthRouters } from "../routes/adminAuth.js";
import { createAdminPeopleRouter } from "../routes/adminPeople.js";
import { listPeople, personDetail, writeAudit } from "../services/userAdmin.js";
import { mayActAsAdmin } from "../shared/authPolicy.js";
import { registerClient, issueCode, tokenGrant, getClient, verifyAccessToken } from "../services/byom/oauthServer.js";
import { createByomRouters } from "../routes/byom.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const quietLog = { warn() {}, error() {}, info() {} };

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  allowLegacyAdminRows(d);   // Phase 1's tests model the pre-162 legacy row; Phase 2's tests below build their own
  // a person (row 3), the LEGACY admin row (row 1), and the system row 0 that migration 075 adds
  d.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'admin', 'h', 1), (3, 'avery', 'h', 0)").run();
  d.prepare("INSERT INTO user_profile (user_id, email) VALUES (3, 'avery@example.com')").run();
  return d;
}

/** An admin account with a password, through the real link — as the owner would set one. */
function adminWithPassword(d, email = "ops@example.org", { owner = true } = {}) {
  const a = createAdminAccount(d, { email, isOwner: owner });
  const { token } = issueSignInLink(d, a.id);
  consumeSignInLink(d, token, "correct horse battery staple");
  return d.prepare("SELECT * FROM admin_accounts WHERE id = ?").get(a.id);
}

/** An express app with the REAL binder and REAL requireAdmin; `legacyUser` stands in for a passport session. */
async function serve(t, d, { enforced = false, legacyUser = null, emailReady = () => true } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (legacyUser) req.user = legacyUser; req.isAuthenticated = () => !!req.user; next(); });
  app.use(createAdminSessionBinder({ db: d, enforced: () => enforced, log: quietLog }));
  const requireAdmin = createRequireAdmin({ isExtensionRequest: () => false, log: quietLog,
    legacy: (req) => req.isAuthenticated() && mayActAsAdmin(req) });
  const { authRouter, adminsRouter } = createAdminAuthRouters({ db: d, requireAdmin, production: false, log: quietLog,
    sendEmail: async () => ({ ok: true }), baseUrl: () => "http://draft.test", env: {}, emailReady });
  app.use("/api/admin/auth", authRouter);
  app.use("/api/admin/admins", adminsRouter);
  app.use("/api/admin/people", requireAdmin, createAdminPeopleRouter({ db: d, requireAdmin, signOutEverywhere: async () => ({}), sendResetLink: async () => ({}) }));
  app.get("/api/admin/whoami", requireAdmin, (req, res) => res.json({ admin: req.admin?.public_id ?? null, user: req.user?.id ?? null, actor: req.actor?.ref }));
  // a USER route: what identity does it see?
  app.get("/api/jobs/me", (req, res) => res.json({ user: req.user?.id ?? null, admin: req.admin?.public_id ?? null }));
  const s = app.listen(0); t.after(() => s.close());
  return `http://127.0.0.1:${s.address().port}`;
}
const cookieOf = (r) => (r.headers.get("set-cookie") || "").split(";")[0];

test("⛔ D95: the migration is ADDITIVE and IDEMPOTENT, and its backfill is truthful", () => {
  const d = new Database(":memory:");
  d.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER DEFAULT (unixepoch()))");
  const upTo = MIGRATIONS.findIndex(m => m.id === "159_admin_accounts");
  applyPendingMigrations(d, MIGRATIONS.slice(0, upTo));
  d.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'admin', 'h', 1), (3, 'avery', 'h', 0)").run();
  d.prepare("INSERT INTO admin_audit_log (admin_user_id, action, target) VALUES (1, 'user.plan', 'user:3'), (NULL, 'company_add', 'x')").run();
  const rowsBefore = d.prepare("SELECT COUNT(*) FROM admin_audit_log").pluck().get();
  const p1 = MIGRATIONS.slice(0, MIGRATIONS.findIndex(m => m.id === "162_no_admin_in_users"));
  assert.equal(applyPendingMigrations(d, p1), 3, "159, 160, 161 apply");
  assert.equal(d.prepare("SELECT COUNT(*) FROM users WHERE is_admin = 1").pluck().get(), 1, "Phase 1 does not touch users.is_admin");
  assert.equal(d.prepare("SELECT COUNT(*) FROM admin_audit_log").pluck().get(), rowsBefore, "no row lost");
  const rows = d.prepare("SELECT admin_user_id, actor_kind, actor FROM admin_audit_log ORDER BY id").all();
  assert.deepEqual(rows, [{ admin_user_id: 1, actor_kind: "user", actor: "user:1" }, { admin_user_id: null, actor_kind: "system", actor: "system" }]);
  const sql = MIGRATIONS.find(m => m.id === "159_admin_accounts").sql;
  assert.doesNotMatch(sql, /\bDROP\b|\bDELETE FROM\b|UPDATE users/i, "159: nothing destructive, and users is left alone");
  assert.equal(applyPendingMigrations(d, MIGRATIONS), 1, "then 162");
  assert.equal(applyPendingMigrations(d, MIGRATIONS), 0, "and never twice");
});

test("⛔ D95 PHASE 2 (162): the former admin row loses its credentials FIRST, is suspended and audited, and the database refuses an admin flag", () => {
  const d = new Database(":memory:");
  d.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER DEFAULT (unixepoch()))");
  applyPendingMigrations(d, MIGRATIONS.slice(0, MIGRATIONS.findIndex(m => m.id === "162_no_admin_in_users")));
  d.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'admin', 'h', 1), (3, 'avery', 'h', 0)").run();
  d.prepare("INSERT INTO oauth_clients (client_id, client_name, redirect_uris, host) VALUES ('c', 'Claude', '[]', 'claude')").run();
  d.prepare("INSERT INTO oauth_connections (id, user_id, client_id, scope) VALUES (1, 1, 'c', 'resume:read'), (2, 3, 'c', 'resume:read')").run();
  d.prepare("INSERT INTO oauth_tokens (token_hash, connection_id, kind, scope, resource, expires_at) VALUES ('t1', 1, 'access', 'resume:read', 'r', unixepoch()+3600), ('t3', 2, 'access', 'resume:read', 'r', unixepoch()+3600)").run();
  d.prepare("INSERT INTO auth_contexts (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent) VALUES ('a1', 1, unixepoch(), unixepoch(), unixepoch()+3600, 'resume-master-extension'), ('a3', 3, unixepoch(), unixepoch(), unixepoch()+3600, 'resume-master-extension')").run();
  assert.equal(applyPendingMigrations(d, MIGRATIONS), 1);
  const u1 = d.prepare("SELECT is_admin, status, suspended_reason FROM users WHERE id = 1").get();
  assert.equal(u1.is_admin, 0, "no users row is an admin");
  assert.equal(u1.status, "suspended", "the former admin row cannot sign in or call the API as a person");
  assert.match(u1.suspended_reason, /Former admin row \(D95\)/);
  assert.ok(d.prepare("SELECT revoked_at FROM oauth_connections WHERE id = 1").pluck().get(), "its connected app is revoked — or it would start working as a person's");
  assert.ok(d.prepare("SELECT revoked_at FROM oauth_tokens WHERE token_hash = 't1'").pluck().get());
  assert.ok(d.prepare("SELECT revoked_at FROM auth_contexts WHERE token_hash = 'a1'").pluck().get(), "and its extension token");
  assert.equal(d.prepare("SELECT revoked_at FROM oauth_connections WHERE id = 2").pluck().get(), null, "a person's connection is untouched");
  assert.equal(d.prepare("SELECT revoked_at FROM auth_contexts WHERE token_hash = 'a3'").pluck().get(), null);
  assert.equal(d.prepare("SELECT status FROM users WHERE id = 3").pluck().get(), "active");
  assert.deepEqual(d.prepare("SELECT actor_kind, action, target FROM admin_audit_log WHERE action = 'user.admin_flag_cleared'").all(),
    [{ actor_kind: "system", action: "user.admin_flag_cleared", target: "user:1" }]);
  assert.throws(() => d.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES ('x', 'h', 1)").run(), /D95: an admin is an admin account/);
  assert.throws(() => d.prepare("UPDATE users SET is_admin = 1 WHERE id = 3").run(), /D95: an admin is an admin account/);
  d.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES ('y', 'h', 0)").run();   // a person still can be made
  // and server.js backs up first, holding 162 back if it cannot
  const server = read("server.js");
  assert.match(server, /if \(pending162 && hasAdminRows\) \{[\s\S]{0,200}createBackup\("pre-162"\)/);
  assert.match(server, /heldBack\.add\("162_no_admin_in_users"\)/);
  assert.match(server, /applyPendingMigrations\(db, MIGRATIONS, \{ hold: heldBack,/);
  assert.doesNotMatch(server, /ADMIN_PASSWORD \|\| "changeme"/, "the legacy admin/changeme bootstrap is gone");
});

test("⛔ D95: admin identities are TOKENISED — their kind is readable from their shape", () => {
  const d = db();
  const a = adminWithPassword(d);
  assert.ok(isAdminPublicId(a.public_id), a.public_id);
  const token = createAdminSession(d, a.id);
  assert.ok(isAdminSessionToken(token) && token.startsWith("dft_adm_"));
  assert.equal(adminActor(a).ref, `admin:${a.public_id}`);
  assert.equal(userActor({ id: 3 }).ref, "user:3");
  assert.equal(toActor(null).ref, "system");
  assert.equal(toActor(3).ref, "user:3", "a bare integer actor only ever meant a users row");
  // never in users: the admin's email belongs to no person
  assert.equal(d.prepare("SELECT COUNT(*) FROM users WHERE username = ?").pluck().get(a.email), 0);
});

test("⛔ D95: listPeople never returns an admin, counts exclude them, and the person page refuses one", () => {
  const d = db();
  const all = listPeople(d, {});
  assert.deepEqual(all.rows.map(r => r.id), [3]);
  assert.equal(all.total, 1);
  assert.equal(all.counts.total, 1, "the counter never counts an admin");
  assert.ok(!("is_admin" in all.rows[0]));
  assert.equal(listPeople(d, { filter: "admins" }).total, 1, "an 'admins' filter is not a way in — it falls back to everyone, still without admins");
  assert.equal(listPeople(d, { q: "admin" }).total, 0, "search cannot find one");
  assert.throws(() => personDetail(d, 1), /No such user/);
});

test("⛔ D95: People routes treat an admin row as 'no such user' — no write reaches one", async (t) => {
  const d = db();
  const a = adminWithPassword(d);
  const base = await serve(t, d);
  const login = await fetch(`${base}/api/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: a.email, password: "correct horse battery staple" }) });
  const jar = cookieOf(login);
  for (const [m, p] of [["GET", "/api/admin/people/1"], ["POST", "/api/admin/people/1/plan"], ["POST", "/api/admin/people/1/status"], ["POST", "/api/admin/people/1/notes"]]) {
    const r = await fetch(`${base}${p}`, { method: m, headers: { cookie: jar, "content-type": "application/json" }, body: m === "POST" ? JSON.stringify({ reason: "testing it", plan: "PRO", status: "suspended", body: "x" }) : undefined });
    assert.equal(r.status, 404, `${m} ${p}`);
  }
  assert.equal((await fetch(`${base}/api/admin/people/3`, { headers: { cookie: jar } })).status, 200, "a person is reachable");
});

test("⛔ D95: no route can set an admin flag on a user", () => {
  const server = read("server.js");
  const block = server.slice(at(server, 'app.post("/api/admin/users"'), at(server, "// A58 (a): the admin delete"));
  assert.doesNotMatch(block, /isAdmin\s*[?,}]/, "POST /api/admin/users reads no isAdmin");
  assert.match(block, /VALUES \(\?,\?,1,0,\?,\?\)/, "is_admin is the literal 0");
  for (const f of ["server.js", ...fs.readdirSync("routes").map(x => `routes/${x}`).filter(x => x.endsWith(".js")), ...fs.readdirSync("services").map(x => `services/${x}`).filter(x => x.endsWith(".js"))]) {
    const s = read(f);
    // a SET that turns the flag ON (not 162's `SET status … WHERE is_admin = 1`, which reads it)
    for (const m of s.matchAll(/SET\s[^;"`]*?\bis_admin\s*=\s*(1|\?)/gi)) assert.match(m[0], /\bWHERE\b/i, `${f} sets is_admin: ${m[0].slice(0, 120)}`);
    for (const ins of s.match(/INSERT[^;`"]*INTO users \([^)]*is_admin[^)]*\) VALUES \([^)]*\)/g) || []) {
      const cols = ins.match(/\(([^)]*)\) VALUES/)[1].split(",").map(c => c.trim());
      const vals = ins.match(/VALUES \(([^)]*)\)/)[1].split(",").map(v => v.trim());
      assert.equal(vals[cols.indexOf("is_admin")], cols.indexOf("is_admin") >= 0 && f === "server.js" && /ADMIN_USER|username,password_hash,is_admin\) VALUES \(\?,\?,1\)/.test(ins) ? "1" : "0",
        `${f}: ${ins}`);
    }
  }
});

test("⛔ D95: an admin session is refused on user routes — the cookie is Path=/api/admin, and no identity crosses", async (t) => {
  const d = db();
  const a = adminWithPassword(d);
  const base = await serve(t, d);
  const r = await fetch(`${base}/api/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: a.email, password: "correct horse battery staple" }) });
  assert.equal(r.status, 200);
  const set = r.headers.get("set-cookie");
  assert.match(set, new RegExp(`^${ADMIN_COOKIE}=dft_adm_`));
  assert.match(set, /Path=\/api\/admin/, "a user route never receives it");
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Strict/);
  const jar = cookieOf(r);
  // even if a client sent it to a user route anyway, the binder reads it only on /api/admin
  assert.deepEqual(await (await fetch(`${base}/api/jobs/me`, { headers: { cookie: jar } })).json(), { user: null, admin: null });
  // and an admin token as a header is refused outright, on any route
  const token = jar.split("=")[1];
  for (const h of [{ authorization: `Bearer ${token}` }, { "x-rm-auth-context": token }]) {
    const x = await fetch(`${base}/api/jobs/me`, { headers: h });
    assert.equal(x.status, 403);
    assert.equal((await x.json()).code, "admin_credential");
  }
  // on an admin route, the admin is the identity — and ONLY the admin: a person's session alongside is dropped
  const both = await serve(t, d, { legacyUser: { id: 3, username: "avery", isAdmin: false } });
  const who = await (await fetch(`${both}/api/admin/whoami`, { headers: { cookie: jar } })).json();
  assert.equal(who.admin, a.public_id);
  assert.equal(who.user, null, "the person signed in in the same browser is not this request's identity");
  assert.equal(who.actor, `admin:${a.public_id}`);
});

test("⛔ D95: a user session is refused on admin routes once enforced; the flag OFF changes nothing", async (t) => {
  const d = db();
  const legacyAdmin = { id: 1, username: "admin", isAdmin: true };
  const person = { id: 3, username: "avery", isAdmin: false };
  const off = await serve(t, d, { enforced: false, legacyUser: legacyAdmin });
  const offWho = await fetch(`${off}/api/admin/whoami`);
  assert.equal(offWho.status, 200, "flag off: the legacy admin still works, as before");
  assert.equal((await offWho.json()).actor, "user:1", "and is recorded truthfully as a users row");
  const on = await serve(t, d, { enforced: true, legacyUser: legacyAdmin });
  assert.equal((await fetch(`${on}/api/admin/whoami`)).status, 403, "flag on: a users row is never an admin");
  const asPerson = await serve(t, d, { enforced: false, legacyUser: person });
  assert.equal((await fetch(`${asPerson}/api/admin/whoami`)).status, 403, "a person is never an admin");
  // the guard's OWN check, apart from the shared predicate (each refuses on its own — two layers, both pinned)
  const guard = createRequireAdmin({ isExtensionRequest: () => false, legacy: () => true, log: quietLog });
  let status = 0; const res = { status: (s) => { status = s; return { json() {} }; } };
  guard({ adminEnforced: true }, res, () => { status = 200; });
  assert.equal(status, 403, "enforced: a legacy yes is not enough");
  guard({ adminEnforced: false }, res, () => { status = 200; });
  assert.equal(status, 200, "off: the legacy path is unchanged");
  assert.equal(mayActAsAdmin({ adminEnforced: true, user: { isAdmin: true } }), false, "the predicate refuses too");
  // ⛔ Phase 2 (owner 10-13, "now enforce"): ON by default; the variable exists only to roll back
  assert.equal(adminEnforced({}), true, "default ON");
  assert.equal(adminEnforced({ ADMIN_ACCOUNTS_ENFORCE: "1" }), true);
  assert.equal(adminEnforced({ ADMIN_ACCOUNTS_ENFORCE: "0" }), false, "the rollback");
});

test("⛔ D95: the admin sign-in gives ONE answer for unknown, disabled, unset and wrong — and user sign-in never knows admins", async (t) => {
  const d = db();
  const a = adminWithPassword(d);
  const b = adminWithPassword(d, "second@example.org", { owner: false });
  disableAdminAccount(d, { publicId: b.public_id, reason: "left the team", by: adminActor(a) });
  createAdminAccount(d, { email: "unset@example.org" });
  const base = await serve(t, d);
  const tryIt = async (email, password) => { const r = await fetch(`${base}/api/admin/auth/login`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }); return [r.status, await r.json()]; };
  const wrong = await tryIt(a.email, "not the password at all");
  for (const [email] of [["nobody@example.org"], [b.email], ["unset@example.org"]]) {
    assert.deepEqual(await tryIt(email, "correct horse battery staple"), wrong, email);
  }
  assert.deepEqual(wrong, [401, { error: "Invalid credentials." }]);
  // the USER sign-in: an admin's email is not in users at all, and the legacy row under the switch answers like a wrong password
  const server = read("server.js");
  const strategy = server.slice(at(server, "passport.use(new LocalStrategy"), at(server, "passport.serializeUser"));
  assert.match(strategy, /return done\(null, false, \{ message:"Invalid credentials\." \}\);\n\s*\}/, "the wrong-password answer");
  assert.match(strategy, /if \(user\.is_admin && adminEnforced\(\)\) return done\(null, false, \{ message:"Invalid credentials\." \}\);/, "the same words for the admin row");
  assert.equal(verifyAdminSignIn(d, "AVERY@example.com", "x"), null, "a person's email is no admin");
  assert.equal(emailBelongsToAdmin(d, a.email.toUpperCase()), true, "user sign-up can see the clash");
  assert.throws(() => createAdminAccount(d, { email: "avery@example.com" }), /belongs to a user account/, "principle 5: two accounts, two emails");
});

test("⛔ D95: every token door refuses an admin identity — extension, phone, and the backstop in issueAuthContext", () => {
  const server = read("server.js");
  const ext = server.slice(at(server, 'app.get("/api/auth/extension-token"'), at(server, 'app.post("/api/auth/revoke-extension-token"'));
  assert.match(ext, /if \(req\.user\?\.isAdmin\) return refuseAdmin\(res\);[\s\S]*issueAuthContext/, "the extension token");
  const mob = server.slice(at(server, 'app.get("/api/auth/mobile-token"'), at(server, 'app.post("/api/auth/revoke-mobile-token"'));
  assert.match(mob, /if \(req\.user\?\.isAdmin\) return refuseAdmin\(res\);[\s\S]*issueAuthContext/, "the phone token");
  const issue = server.slice(at(server, "function issueAuthContext("), at(server, "function issueAuthContext(") + 600);
  assert.match(issue, /if \(options\.sessionLess && isAdminUserRow\(userId\)\) throw/, "no session-less token is ever minted for an admin row");
  const bind = server.slice(at(server, "function bindAuthContext("), at(server, "function requireAuth("));
  assert.match(bind, /user\.isAdmin && \(row\.user_agent === EXTENSION_USER_AGENT \|\| row\.user_agent === MOBILE_USER_AGENT\)/, "an older admin token is not honoured");
  const auth = server.slice(at(server, "function requireAuth("), at(server, "function requireAdmin(req, res, next) {"));
  assert.match(auth, /if \(req\.adminCredentialRefused\) return refuseAdmin\(res\);/);
  assert.equal(ADMIN_REFUSAL, "This is an administrator account. Use a personal account.");
});

test("⛔ D95: the consent screen refuses an admin session, and no connector code or token is ever issued to one", async (t) => {
  const d = new Database(":memory:");
  d.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, is_admin INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
          CREATE TABLE user_profile (user_id INTEGER, email TEXT);`);
  d.exec(MIGRATIONS.find(m => m.id === "152_byom_oauth").sql);
  d.prepare("INSERT INTO users (id, username, is_admin) VALUES (1, 'admin', 1), (3, 'avery', 0)").run();
  d.prepare("INSERT INTO app_settings (key, value) VALUES ('byom_enabled', '1')").run();
  let sessionUser = { id: 1, username: "admin", isAdmin: true };
  const app = express();
  const { tokenRouter, sessionRouter } = createByomRouters({ db: d, deps: { db: d, briefSecret: "test-brief-secret", appUrl: "http://draft.test" }, production: false, issuerFor: (req) => `http://${req.get("host")}`,
    requireAuth: (_q, _s, n) => n(), requireAdmin: (_q, _s, n) => n(), log: quietLog });
  app.use(tokenRouter);
  app.use((req, _res, next) => { req.user = sessionUser; req.isAuthenticated = () => true; req.session = req.session || {}; next(); });
  app.use(sessionRouter);
  const s = app.listen(0); t.after(() => s.close());
  const base = `http://127.0.0.1:${s.address().port}`;
  const reg = registerClient(d, { redirect_uris: ["http://localhost:9/cb"] }, { production: false });
  const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: "http://localhost:9/cb",
    code_challenge: "a".repeat(43), code_challenge_method: "S256", scope: "resume:read" });
  const page = await fetch(`${base}/oauth/authorize?${q}`);
  assert.equal(page.status, 403);
  const html = await page.text();
  assert.match(html, /This is an administrator account/);
  assert.match(html, /Connectors use a personal account/);
  assert.match(html, /action="\/oauth\/switch-account"[\s\S]*Use a personal account/, "the one way on");
  assert.doesNotMatch(html, /value="allow"/, "no Allow is offered");
  const post = await fetch(`${base}/oauth/authorize`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "decision=allow&nonce=x" });
  assert.ok([400, 403].includes(post.status), "the POST grants nothing either");
  assert.equal(d.prepare("SELECT COUNT(*) FROM oauth_connections").pluck().get(), 0);
  // a person gets the ordinary screen
  sessionUser = { id: 3, username: "avery", isAdmin: false };
  assert.equal((await fetch(`${base}/oauth/authorize?${q}`)).status, 200);
  // the doors behind the screen: a code, a token, a refresh, a verify — each refuses the admin row
  const client = getClient(d, reg.client_id);
  assert.throws(() => issueCode(d, { userId: 1, client, redirectUri: "http://localhost:9/cb", scope: "resume:read", codeChallenge: "x", resource: `${base}/mcp` }),
    /administrator account/);
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const { code } = issueCode(d, { userId: 3, client, redirectUri: "http://localhost:9/cb", scope: "resume:read", codeChallenge: challenge, resource: `${base}/mcp` });
  const tok = tokenGrant(d, { grant_type: "authorization_code", code, redirect_uri: "http://localhost:9/cb", client_id: reg.client_id, code_verifier: verifier }, { resource: `${base}/mcp` });
  assert.ok(verifyAccessToken(d, tok.access_token, { resource: `${base}/mcp` }), "a person's token works");
  d.prepare("UPDATE users SET is_admin = 1 WHERE id = 3").run();   // a grant that predates the rule, on a row that is admin
  assert.equal(verifyAccessToken(d, tok.access_token, { resource: `${base}/mcp` }), null, "an admin row's token is never honoured");
  assert.throws(() => tokenGrant(d, { grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id }, { resource: `${base}/mcp` }),
    /administrator account/, "nor refreshed");
});

test("⛔ D95 / D86 follow-up: a connector access token is refused on every /api/admin route", async (t) => {
  // (1) live: a request carrying only a connector token has no user and no admin, so the real requireAdmin answers 403.
  const d = db();
  const base = await serve(t, d);
  const r = await fetch(`${base}/api/admin/whoami`, { headers: { authorization: "Bearer dft_at_" + "x".repeat(43) } });
  assert.equal(r.status, 403);
  // (2) every /api/admin route in server.js is behind requireAdmin, or is a router that guards itself (named below).
  const server = read("server.js");
  const SELF_GUARDED = new Set(["/api/admin/auth", "/api/admin/admins", "/api/admin/analytics", "/api/admin/db"]);
  const lines = server.split("\n").filter(l => /app\.(get|post|put|patch|delete|use)\("\/api\/admin/.test(l));
  assert.ok(lines.length > 40, `found ${lines.length} admin routes`);
  for (const l of lines) {
    const p = l.match(/\("([^"]+)"/)[1];
    if (SELF_GUARDED.has(p)) continue;
    assert.match(l, /requireAdmin/, l.trim());
  }
  for (const f of ["routes/admin.js", "routes/adminDb.js"]) assert.match(read(f), /if \(!mayActAsAdmin\(req\)\) return res\.status\(403\)/, f);
  const adminAuth = read("routes/adminAuth.js");
  for (const m of adminAuth.match(/adminsRouter\.(get|post)\([^)]*/g)) assert.match(m, /requireAdmin, ownerOnly/, m);
  // (3) and a connector token is not a draft session: bindAuthContext looks only in auth_contexts, never oauth_tokens.
  const bind = server.slice(at(server, "function bindAuthContext("), at(server, "function requireAuth("));
  assert.match(bind, /FROM auth_contexts ac/);
  assert.doesNotMatch(bind, /oauth_tokens/);
});

test("⛔ D95: admin audit rows keep the ACTOR KIND — admin, user or system", () => {
  const d = db();
  const a = adminWithPassword(d);
  const id1 = writeAudit(d, { actor: adminActor(a), action: "t.admin", target: "x" });
  const id2 = writeAudit(d, { actorId: 1, action: "t.legacy", target: "x" });
  const id3 = writeAudit(d, { actorId: null, action: "t.system", target: "x" });
  const row = (id) => d.prepare("SELECT admin_user_id, actor_kind, actor FROM admin_audit_log WHERE id = ?").get(id);
  assert.deepEqual(row(id1), { admin_user_id: null, actor_kind: "admin", actor: `admin:${a.public_id}` }, "an admin id never lands in a users column");
  assert.deepEqual(row(id2), { admin_user_id: 1, actor_kind: "user", actor: "user:1" });
  assert.deepEqual(row(id3), { admin_user_id: null, actor_kind: "system", actor: "system" });
  assert.deepEqual(SYSTEM_ACTOR.kind, "system");
  // every direct INSERT into admin_audit_log in the app names the actor kind
  for (const f of ["server.js", ...fs.readdirSync("services").map(x => `services/${x}`).filter(x => x.endsWith(".js"))]) {
    for (const ins of read(f).match(/INSERT INTO admin_audit_log \([^)]*\)/g) || []) assert.match(ins, /actor_kind, actor/, `${f}: ${ins}`);
  }
});

test("⛔ D95: Admins — owner only, never locks the last owner out, sessions end when disabled, links work once", async (t) => {
  const d = db();
  const owner = adminWithPassword(d);
  const helper = adminWithPassword(d, "helper@example.org", { owner: false });
  assert.throws(() => disableAdminAccount(d, { publicId: owner.public_id, reason: "testing it", by: adminActor(helper) }), /last enabled owner/);
  const tok = createAdminSession(d, helper.id);
  assert.ok(resolveAdminSession(d, tok));
  disableAdminAccount(d, { publicId: helper.public_id, reason: "testing it", by: adminActor(owner) });
  assert.equal(resolveAdminSession(d, tok), null, "a disabled admin's session is gone");
  const { token } = issueSignInLink(d, owner.id);
  assert.ok(consumeSignInLink(d, token, "another long passphrase"));
  assert.equal(consumeSignInLink(d, token, "another long passphrase"), null, "a link works once");
  assert.throws(() => consumeSignInLink(d, issueSignInLink(d, owner.id).token, "short"), /at least 12/);
  // over HTTP: a non-owner admin is refused the panel; no response ever carries a password hash
  const base = await serve(t, d);
  const nonOwner = adminWithPassword(d, "viewer@example.org", { owner: false });
  const jar = cookieOf(await fetch(`${base}/api/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: nonOwner.email, password: "correct horse battery staple" }) }));
  assert.equal((await fetch(`${base}/api/admin/admins`, { headers: { cookie: jar } })).status, 403);
  const ojar = cookieOf(await fetch(`${base}/api/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: owner.email, password: "another long passphrase" }) }));
  const list = await (await fetch(`${base}/api/admin/admins`, { headers: { cookie: ojar } })).text();
  assert.doesNotMatch(list, /password_hash|\$2[aby]\$/, "no password, no hash");
  assert.match(list, /"you":"adm_/);
});

test("⛔ D95 (owner 10-13): until an admin account exists, the sign-in leads with the old login; a username goes there", async (t) => {
  const d = db();
  const base = await serve(t, d);
  const me = await (await fetch(`${base}/api/admin/auth/me`)).json();
  assert.equal(me.accountsExist, false, "no admin account yet");
  assert.equal(me.legacyAvailable, true);
  adminWithPassword(d);
  assert.equal((await (await fetch(`${base}/api/admin/auth/me`)).json()).accountsExist, true);
  const login = read("client/src/pages/AdminLoginPage.jsx");
  assert.match(login, /if \(!chosen && session\?\.legacyAvailable && session\.accountsExist === false\) \{\s*setMode\("legacy"\);/, "no account → the old login leads");
  assert.match(login, /if \(!form\.email\.includes\("@"\)\) \{\s*if \(session\?\.legacyAvailable\) \{/, "a username in the new form is taken to the old login");
  assert.match(login, /placeholder="Admin email" type="text" inputMode="email"/, "no browser email validation blocking a username");
});

test("⛔ D95 (owner 10-13, no email in production): the legacy admin finishes the setup — resend, and the FIRST password — then the door shuts", async (t) => {
  const d = db();
  const legacyAdmin = { id: 1, username: "admin", isAdmin: true };
  const base = await serve(t, d, { legacyUser: legacyAdmin, emailReady: () => false });
  const post = (p, body) => fetch(`${base}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json() }));
  const add = await post("/api/admin/admins", { email: "ops@example.org" });
  assert.equal(add.status, 200);
  assert.equal(add.body.admin.isOwner, true, "the first is an owner");
  assert.equal(add.body.linkSent, false);
  assert.match(add.body.message, /Email is not set up on this server/, "said plainly — not 'the link did not go out'");
  const id = add.body.admin.publicId;
  const resend = await post(`/api/admin/admins/${id}/link`, {});
  assert.equal(resend.status, 200, "the legacy admin may send the link again (it was refused before)");
  const list = await (await fetch(`${base}/api/admin/admins`)).json();
  assert.equal(list.settingUp, true);
  assert.equal(list.emailReady, false);
  assert.equal((await post(`/api/admin/admins/${id}/password`, { password: "short" })).status, 400);
  const set = await post(`/api/admin/admins/${id}/password`, { password: "a-long-admin-passphrase" });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(verifyAdminSignIn(d, "ops@example.org", "a-long-admin-passphrase")?.public_id, id, "the new account signs in with it");
  assert.equal(d.prepare("SELECT actor FROM admin_audit_log WHERE action = 'admin.password_set_bootstrap'").pluck().get(), "user:1", "audited, with its actor");
  // ⛔ once ONE admin account has a password, the legacy admin can no longer manage admin accounts
  assert.equal((await post(`/api/admin/admins/${id}/link`, {})).status, 403);
  assert.equal((await post("/api/admin/admins", { email: "second@example.org" })).status, 403);
  assert.equal((await post(`/api/admin/admins/${id}/password`, { password: "another-long-passphrase" })).status, 403);
  // the sign-in page's link request says email is not set up — a server fact, the same for every address
  const anon = await serve(t, d, { emailReady: () => false });
  for (const email of ["ops@example.org", "nobody@example.org"]) {
    const r = await fetch(`${anon}/api/admin/auth/link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    assert.equal(r.status, 503, email);
    assert.match((await r.json()).error, /Email is not set up on this server/);
  }
});

test("⛔ D95 UI: the client keeps the admin session apart, and People shows no admin", () => {
  const app = read("client/src/App.jsx");
  assert.match(app, /api\("\/api\/admin\/auth\/me"\)/);
  assert.match(app, /if \(adminSession\.authenticated\) return children;/);
  assert.match(app, /if \(!adminSession\.enforced && authStatus === "authenticated" && authUser\?\.isAdmin\) return children;/);
  const login = read("client/src/pages/AdminLoginPage.jsx");
  assert.match(login, /\/api\/admin\/auth\/login/);
  assert.doesNotMatch(login.slice(0, at(login, "const legacySignIn")), /\/api\/auth\/login/, "the admin form never posts to the user sign-in");
  const people = read("client/src/panels/adminPeople.jsx");
  assert.doesNotMatch(people, /\["admins", "Admins"\]/);
  assert.doesNotMatch(read("client/src/panels/AdminPanel.jsx"), /Admin user\s*<\/label>/, "the user-create form offers no admin box");
  assert.match(read("client/src/panels/adminMap.js"), /\["admins", "Admins"\]/);
  const plugin = read("client/src/panels/adminOps.jsx");
  assert.match(plugin, /data-plugin-connections/);
  assert.match(read("routes/byom.js"), /connections: \(\(\) => \{ try \{ return db\.prepare\(`SELECT oc\.id, oc\.user_id AS userId, u\.username, COALESCE\(u\.is_admin, 0\) AS isAdmin, p\.email, cl\.host/);
});

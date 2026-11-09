// ⛔ A148 (45p, owner 11-08): "i logged into the cws tester account and its showing my pfp, probe and fix this."
//
// The cause, read from the code: the picture was served at ONE URL for every account (/api/account/avatar) with
// `Cache-Control: private, max-age=86400`, and the client kept the picture in a module-level cache that no sign-out
// cleared — so the next account signed in on the same browser was handed the previous account's picture (by the HTTP
// cache for a day, by the SPA's memory until a reload). These tests hold the fix: a per-user versioned URL that only
// its owner is answered on, `private, no-store` on every /api answer by default, one client clean-up on a person
// change, Google's sub unique per account, and an uploaded picture never replaced by Google's.
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
import { accountSummary, recordSession } from "../services/accountService.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const PNG_A = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1]);
const PNG_B = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 2]);

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (3, 'owner', 'h:a', 1)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (11, 'tester', 'h:b', 1)").run();
  return db;
}

async function harness(t) {
  const db = freshDb();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "a148-"));
  const store = new session.MemoryStore();
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "t", resave: false, saveUninitialized: false, store }));
  app.post("/test/login/:id", (req, res) => {
    req.session.uid = Number(req.params.id);
    recordSession(db, { sid: req.sessionID, userId: req.session.uid, userAgent: "t" });
    res.json({ ok: true });
  });
  const requireAuth = (req, res, next) => {
    const u = req.session?.uid && db.prepare("SELECT id FROM users WHERE id = ?").get(req.session.uid);
    if (!u) return res.status(401).json({ error: "unauthenticated" });
    req.user = { id: u.id }; next();
  };
  app.use(createAccountManagementRouter({
    db, requireAuth, store, dataDir, multer, hashPassword: (p) => `h:${p}`, verifyPassword: (p, h) => h === `h:${p}`,
    emailConfigured: () => false, sendVerificationCodeEmail: async () => ({ ok: true }), codePepper: "p",
    revokeBrowserAuthContexts: () => {}, clearSessionCookie: (res) => res.clearCookie("connect.sid"),
    findLoginUser: () => null,
  }));
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  t.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = "";
    return async (method, url, body, headers = {}) => {
      const r = await fetch(base + url, { method, headers: { ...(cookie ? { cookie } : {}), ...headers }, body });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const ct = r.headers.get("content-type") || "";
      return { status: r.status, headers: r.headers, body: ct.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()) };
    };
  };
  return { db, client };
}

const upload = (call, bytes) => { const f = new FormData(); f.append("avatar", new Blob([bytes], { type: "image/png" }), "me.png"); return call("POST", "/api/account/avatar", f); };

test("a148AvatarPerUserUrl: each account's picture has its own versioned URL, answered only to its owner, never cached stale", async (t) => {
  const { client } = await harness(t);
  const owner = client(), tester = client();
  await owner("POST", "/test/login/3");
  await tester("POST", "/test/login/11");
  await upload(owner, PNG_A);
  const a = (await owner("GET", "/api/account")).body;
  assert.match(a.avatarUrl, /^\/api\/account\/avatar\/3\?v=[0-9a-f]{12}$/, "the URL names the person and the version");

  const got = await owner("GET", a.avatarUrl);
  assert.equal(got.status, 200);
  assert.deepEqual([...got.body], [...PNG_A]);
  assert.equal(got.headers.get("cache-control"), "private, no-cache", "revalidated every time — never served from a day-long cache");
  const etag = got.headers.get("etag");
  assert.ok(etag);
  assert.equal((await owner("GET", a.avatarUrl, undefined, { "if-none-match": etag })).status, 304);

  // Another account asking for the owner's URL gets nothing of the owner's.
  const cross = await tester("GET", a.avatarUrl);
  assert.equal(cross.status, 404);
  assert.notDeepEqual([...(cross.body.length ? cross.body : [])], [...PNG_A]);

  // The tester's own picture lives elsewhere, and a new upload moves the version.
  await upload(tester, PNG_B);
  const b = (await tester("GET", "/api/account")).body;
  assert.notEqual(b.avatarUrl, a.avatarUrl);
  await upload(owner, PNG_B);
  const a2 = (await owner("GET", "/api/account")).body;
  assert.notEqual(a2.avatarUrl, a.avatarUrl, "a new upload is a new URL");

  // The old shared path is no longer cacheable.
  const old = await owner("GET", "/api/account/avatar");
  assert.doesNotMatch(old.headers.get("cache-control") || "", /max-age=[1-9]/);
});

test("a148PersonalResponsesNoStore: every /api answer defaults to private, no-store; no per-person route keeps a private max-age", () => {
  const server = read("server.js");
  const mw = server.indexOf(`app.use("/api", (req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });`);
  assert.ok(mw > 0, "the /api default is in server.js");
  const firstRoute = server.search(/\napp\.(get|post|put|patch|delete)\("\/api\//);
  assert.ok(firstRoute > mw, "it runs before the first /api route");
  const routers = server.search(/\napp\.use\(create\w+Router\(/);
  if (routers > 0) assert.ok(routers > mw, "and before the first mounted router");

  // A private max-age caches a person's answer under a URL every account shares. Only the atlas ROLE LIST (the same
  // for everyone) may keep one.
  const files = ["server.js", ...fs.readdirSync(path.join(ROOT, "routes")).filter((f) => f.endsWith(".js")).map((f) => `routes/${f}`)];
  const offenders = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;   // a comment that names the old header is history, not a header
      if (/private,\s*max-age=/.test(line) && !/json\(\{ roles \}\)/.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test("a148SignOutClearsClientState: one clean-up on a person change — picture, personal keys, session store; device prefs stay", async () => {
  const mk = () => {
    const m = new Map();
    return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), _m: m };
  };
  const ls = mk(), ss = mk();
  globalThis.window = { localStorage: ls, sessionStorage: ss, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  globalThis.localStorage = ls;
  const { notePerson, PERSONAL_KEYS } = await import("../client/src/lib/personalState.js");

  notePerson(undefined, 3);                       // the owner signs in
  ls.setItem("rm_jobs_profile_ui_v1", "owner's profiles");
  ls.setItem("draft.deck.lastGood.3", "owner's deck");
  ls.setItem("draft.placementSeen.7", "x");
  ls.setItem("draft-theme", "dusk");              // a device preference
  ss.setItem("anything", "owner's");
  assert.equal(notePerson(3, null), true, "signing out clears");
  assert.equal(ls.getItem("rm_jobs_profile_ui_v1"), null);
  assert.equal(ls.getItem("draft.deck.lastGood.3"), null);
  assert.equal(ls.getItem("draft.placementSeen.7"), null);
  assert.equal(ss.length, 0);
  assert.equal(ls.getItem("draft-theme"), "dusk", "the device's theme stays");

  // A different person signing in on a browser an OLD client left keys in is cleared too; the same person is not.
  ls.setItem("rm_board_filters_v1", "left behind");
  assert.equal(notePerson(undefined, 11), true);
  assert.equal(ls.getItem("rm_board_filters_v1"), null);
  ls.setItem("rm_board_filters_v1", "tester's own");
  assert.equal(notePerson(undefined, 11), false, "a reload as the same person keeps their keys");
  assert.equal(ls.getItem("rm_board_filters_v1"), "tester's own");
  assert.ok(PERSONAL_KEYS.includes("rm_jobs_profile_ui_v1"));

  // Wired: App resolves every sign-out path through authUser → notePerson; the avatar module can be reset.
  const app = read("client/src/App.jsx");
  assert.match(app, /notePerson\(personRef\.current, id\)/);
  assert.match(app, /onPersonChangedElsewhere\(/);
  const avatar = read("client/src/lib/accountAvatar.js");
  assert.match(avatar, /export function resetAccountAvatar\(\)/);
  assert.match(avatar, /if \(gen !== generation\)/, "a load started for the previous person never lands after a reset");
  assert.match(avatar, /account\.avatarUrl/);
  delete globalThis.window; delete globalThis.localStorage;
});

test("a148GoogleSubUnique: one Google account links to one draft account", () => {
  const db = freshDb();
  db.prepare("UPDATE users SET google_auth_id = 'sub-owner' WHERE id = 3").run();
  assert.throws(() => db.prepare("UPDATE users SET google_auth_id = 'sub-owner' WHERE id = 11").run(), /UNIQUE/);
  // Linking a Google sign-in that already belongs to another account is refused (Merge accounts is the only way).
  const server = read("server.js");
  const fn = server.slice(server.indexOf("async function findOrCreateOAuthUser("), server.indexOf("function completeProviderAuth("));
  assert.match(fn, /existing && existing\.id !== linkUserId[\s\S]{0,200}status = 409/);
});

test("a148GoogleNeverOverwritesSetPhoto: an uploaded picture wins over Google's; a Google sign-in writes only its own metadata", () => {
  const db = freshDb();
  db.prepare("UPDATE users SET avatar_path = 'avatars/3-abc.png' WHERE id = 3").run();
  db.prepare(`INSERT INTO user_integrations (user_id, provider, provider_user_id, metadata_json) VALUES (3, 'google', 'sub-owner', ?)`)
    .run(JSON.stringify({ picture: "https://lh3.googleusercontent.com/x" }));
  const s = accountSummary(db, 3);
  assert.equal(s.hasAvatar, true);
  assert.match(s.avatarUrl, /^\/api\/account\/avatar\/3\?v=/);
  const avatar = read("client/src/lib/accountAvatar.js");
  assert.match(avatar, /if \(!url && account\.providerPicture\)/, "Google's picture is only the fallback");
  const server = read("server.js");
  const fn = server.slice(server.indexOf("async function findOrCreateOAuthUser("), server.indexOf("function completeProviderAuth("));
  assert.doesNotMatch(fn, /avatar_path/, "a Google sign-in never touches the uploaded picture");
  // The tester has no picture and no Google link: their summary carries nothing of the owner's.
  const t11 = accountSummary(db, 11);
  assert.equal(t11.avatarUrl, null);
  assert.equal(t11.providerPicture, null);
});

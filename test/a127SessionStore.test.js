// A127 / O101 (a) (owner 11-06): the session store moves from connect-sqlite3 (its `sqlite3` driver pulled the
// critical `tar` and node-gyp into every install) to better-sqlite3 — ON THE SAME FILE AND ROWS, so switching signs
// nobody out. The rows below are written exactly as connect-sqlite3 0.9.16 wrote them (its CREATE TABLE, and
// INSERT OR REPLACE of (sid, now + maxAge in MILLISECONDS, JSON)); on 11-06 the agent also ran the real
// connect-sqlite3 against this store once before removing it: sealed rows, a legacy plain row, touch, the per-user
// sweep and destroy all read through (44y TECH note).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { SqliteSessionStore } from "../services/sqliteSessionStore.js";
import { EncryptedSessionStore } from "../services/encryptedSessionStore.js";

const p = (fn) => new Promise((resolve, reject) => fn((e, v) => (e ? reject(e) : resolve(v))));

function oldStoreFile(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a127-sess-"));
  const db = new Database(path.join(dir, "sessions.db"));
  db.exec("CREATE TABLE IF NOT EXISTS sessions (sid PRIMARY KEY, expired, sess)"); // connect-sqlite3's own DDL
  const ins = db.prepare("INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)");
  for (const r of rows) ins.run(r.sid, r.expired, JSON.stringify(r.sess));
  db.close();
  return dir;
}

test("A127 · a session written by connect-sqlite3 reads unchanged; an expired one does not; expired rows are cleaned at start", async (t) => {
  const cookie = { originalMaxAge: 604800000, expires: new Date(Date.now() + 604800000).toISOString() };
  const dir = oldStoreFile([
    { sid: "live", expired: Date.now() + 3_600_000, sess: { cookie, passport: { user: 4 } } },
    { sid: "gone", expired: Date.now() - 1000, sess: { cookie, passport: { user: 4 } } },
  ]);
  const store = new SqliteSessionStore({ db: "sessions.db", dir });
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  assert.deepEqual((await p(cb => store.get("live", cb))).passport, { user: 4 });
  assert.equal(await p(cb => store.get("gone", cb)), undefined);
  assert.equal(await p(cb => store.length(cb)), 1, "the expired row was deleted at start");
});

test("A127 · set / touch / destroy keep connect-sqlite3's semantics (expiry in ms, touch only moves a live row)", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a127-sess-"));
  const store = new SqliteSessionStore({ db: "sessions.db", dir });
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const t0 = Date.now();
  await p(cb => store.set("s1", { cookie: { maxAge: 60_000 }, a: 1 }, cb));
  const exp = store.db.prepare("SELECT expired FROM sessions WHERE sid='s1'").get().expired;
  assert.ok(exp >= t0 + 60_000 && exp <= Date.now() + 60_000, "now + maxAge, in milliseconds");
  await p(cb => store.set("s2", { cookie: {}, a: 2 }, cb));
  const exp2 = store.db.prepare("SELECT expired FROM sessions WHERE sid='s2'").get().expired;
  assert.ok(exp2 >= t0 + 86_400_000 - 5, "no maxAge → one day");
  const later = new Date(Date.now() + 9e8).toISOString();
  await p(cb => store.touch("s1", { cookie: { expires: later } }, cb));
  assert.equal(store.db.prepare("SELECT expired FROM sessions WHERE sid='s1'").get().expired, new Date(later).getTime());
  store.db.prepare("UPDATE sessions SET expired = ? WHERE sid = 's2'").run(Date.now() - 1);
  await p(cb => store.touch("s2", { cookie: { expires: later } }, cb));
  assert.ok(store.db.prepare("SELECT expired FROM sessions WHERE sid='s2'").get().expired < Date.now(), "an expired row is not revived");
  await p(cb => store.destroy("s1", cb));
  assert.equal(await p(cb => store.get("s1", cb)), undefined);
});

test("A127 · behind the sealed store: rows are sealed at rest and the password-change sweep finds a user's sids", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a127-sess-"));
  const inner = new SqliteSessionStore({ db: "sessions.db", dir });
  t.after(() => { inner.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  const store = new EncryptedSessionStore(inner, crypto.randomBytes(32));
  const cookie = { originalMaxAge: 60000, expires: new Date(Date.now() + 60000).toISOString() };
  for (const [sid, user] of [["x", 1], ["y", 2], ["z", 1]]) await p(cb => store.set(sid, { cookie, passport: { user } }, cb));
  assert.ok(inner.db.prepare("SELECT sess FROM sessions").all().every(r => !r.sess.includes("passport")));
  assert.deepEqual((await p(cb => store.sessionsForUser(1, cb))).sort(), ["x", "z"]);
});

test("A127 · connect-sqlite3 and the sqlite3 driver are gone from the server and the dependencies", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.dependencies?.["connect-sqlite3"], undefined);
  assert.equal(pkg.dependencies?.sqlite3, undefined);
  const server = fs.readFileSync("server.js", "utf8");
  assert.doesNotMatch(server, /from "connect-sqlite3"/);
  assert.match(server, /new SqliteSessionStore\(/);
});

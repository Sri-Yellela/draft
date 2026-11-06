// ⛔ Regression: revokeAllUserSessions read the session store's rows as PLAIN JSON. Once sessions
// were sealed (EncryptedSessionStore) that read threw and was swallowed, so a password reset
// destroyed no cookie session. The sweep now asks the store, which opens each sealed row.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { EncryptedSessionStore } from "../services/encryptedSessionStore.js";
import { SqliteSessionStore } from "../services/sqliteSessionStore.js";
import { at } from "../test-support/sourceAnchors.js";

test("sessionsForUser finds a user's SEALED sessions in the real sqlite store", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sess-"));
  // A127: the store the server runs (better-sqlite3); before 11-06 this was connect-sqlite3.
  const inner = new SqliteSessionStore({ db: "s.db", dir });
  t.after(() => {
    inner.close();
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  const store = new EncryptedSessionStore(inner, crypto.randomBytes(32));
  const cookie = { originalMaxAge: 60000, expires: new Date(Date.now() + 60000).toISOString() };
  const put = (sid, user) => new Promise((r, j) => store.set(sid, { cookie, passport: { user } }, (e) => (e ? j(e) : r())));
  await put("a", 3); await put("b", 10); await put("c", 3);
  const raw = inner.db.prepare("SELECT sess FROM sessions").all();
  assert.ok(raw.every(row => !row.sess.includes('"passport"')), "rows are sealed at rest");
  const mine = await new Promise((r, j) => store.sessionsForUser(3, (e, s) => (e ? j(e) : r(s))));
  assert.deepEqual(mine.sort(), ["a", "c"]);
});

test("the server's sweep goes through the store, not the raw rows", () => {
  const src = fs.readFileSync("server.js", "utf8");
  const start = at(src, "function revokeAllUserSessions(");
  const sweep = src.slice(start, at(src, "\n}", start));
  assert.match(sweep, /SStore\.sessionsForUser\(/);
  assert.doesNotMatch(sweep, /SStore\.db\.all/);
});

// ⭐ 46q · A212 (owner 11-16: "link by verified email"). D95 made the admin a separate ADMIN ACCOUNT whose cookie is scoped to
// /api/admin, so the assistant's "available to admins always" could never reach an app session — T3 was reachable only by
// switching it on for everyone. Now the app account whose VERIFIED email is an active admin account's email counts as
// the admin's own (T3 only; no admin power). The real migration 159 builds admin_accounts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { isAdminsOwnAccount, assistantAvailable } from "../services/assistant/assistant.js";

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email_verified_at INTEGER, created_at INTEGER);
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, email TEXT, full_name TEXT, first_name TEXT, last_name TEXT);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE admin_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL DEFAULT (unixepoch()), admin_user_id INTEGER,
      action TEXT NOT NULL, target TEXT, before_json TEXT, after_json TEXT, undone_at INTEGER, reason TEXT);`);
  const m = MIGRATIONS.find(x => x.id === "159_admin_accounts");
  assert.ok(m, "migration 159 exists");
  // the REAL admin_accounts table, exactly as migration 159 creates it (its other statements touch tables not needed here)
  const ddl = m.sql.match(/CREATE TABLE IF NOT EXISTS admin_accounts \([\s\S]*?\n\s*\);/)[0];
  db.exec(ddl);
  return db;
}
const admin = (db, email, { disabled = false, password = true } = {}) =>
  db.prepare("INSERT INTO admin_accounts (public_id, email, password_hash, password_set_at, disabled_at) VALUES (?, ?, ?, ?, ?)")
    .run(`adm_${email}`, email, password ? "h" : null, password ? 1 : null, disabled ? 5 : null);
const user = (db, id, email, verified) => {
  db.prepare("INSERT INTO users (id, username, email_verified_at) VALUES (?, ?, ?)").run(id, `u${id}`, verified ? 100 : null);
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (?, ?)").run(id, email);
};

test("A212 isAdminsOwnAccount — only a VERIFIED email matching an ACTIVE admin account (case-insensitive)", () => {
  const db = makeDb();
  admin(db, "owner@example.test"); admin(db, "gone@example.test", { disabled: true }); admin(db, "unset@example.test", { password: false });
  user(db, 1, "Owner@Example.test", true);     // verified, matches (any case)
  user(db, 2, "owner@example.test", false);    // same email, NOT verified — someone typing the admin's address
  user(db, 3, "gone@example.test", true);      // the admin account is disabled
  user(db, 4, "unset@example.test", true);     // the admin never set a password
  user(db, 5, "someone@example.test", true);   // no admin account
  user(db, 6, "", true);
  assert.equal(isAdminsOwnAccount(db, 1), true);
  for (const id of [2, 3, 4, 5, 6, 99, null]) assert.equal(isAdminsOwnAccount(db, id), false, `user ${id}`);
});

test("A212 the switch off: T3 is available to the admin's own account and to nobody else", () => {
  const db = makeDb(); admin(db, "owner@example.test"); user(db, 1, "owner@example.test", true); user(db, 2, "x@example.test", true);
  assert.equal(assistantAvailable(db, { isAdmin: isAdminsOwnAccount(db, 1) }), true);
  assert.equal(assistantAvailable(db, { isAdmin: isAdminsOwnAccount(db, 2) }), false);
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('assistant_enabled', '1')").run();
  assert.equal(assistantAvailable(db, { isAdmin: isAdminsOwnAccount(db, 2) }), true, "the switch still opens it to everyone");
});

test("A212 the server asks it for the assistant's routes only", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /const assistantAdmin = \(req\) => \{ try \{ return !!mayActAsAdmin\(req\) \|\| isAdminsOwnAccount\(db, req\.user\?\.id\); \} catch \{ return false; \} \};/);
  assert.equal((src.match(/isAdminsOwnAccount\(/g) || []).length, 1, "one call site — the assistant's admin check, nothing else");
});

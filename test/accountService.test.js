// Account management data layer (services/accountService.js), on the REAL schema built from the
// migrations — merge, delete, sign-in methods, password, email codes, sessions, the picture sniffer.
import { allowLegacyAdminRows } from "../test-support/legacyAdminRows.js";
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  MERGE_PLAN, AccountError, changePassword, consumeEmailCode, deleteAccount, exportAccount, issueEmailCode,
  listSessions, mergeAccounts, mergePreview, recordSession, requireRecentAuth, sessionPublicId, setDisplayName,
  setVerifiedEmail, sidsToRevoke, sniffImage, unlinkProvider, accountSummary, RECENT_AUTH_MS,
} from "../services/accountService.js";

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  allowLegacyAdminRows(db);   // these fixtures model a pre-162 admin row (test-support/legacyAdminRows.js)
  return db;
}
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof AccountError, e.message); return e.code; } return null; };
const verify = (plain, hash) => hash === `h:${plain}`;
const hash = (plain) => `h:${plain}`;

// The two real accounts' shape: 3 = password account with data, 10 = an empty Google account.
function twoAccounts(db) {
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (3, 'owner', 'h:pw-owner-1', 1)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, password_set, google_auth_id) VALUES (10, 'g_10', 'h:random', 0, 'google-sub-10')").run();
  db.prepare("INSERT INTO user_profile (user_id, full_name, email) VALUES (3, 'Owner Name', NULL)").run();
  db.prepare("INSERT INTO user_profile (user_id, full_name, email) VALUES (10, 'Owner G', 'owner@example.com')").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (3, 'j1', 0)").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (10, 'j1', 1)").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (10, 'j2', 0)").run();
}

test("every user table has a merge plan — a new table without one fails here, not in production", () => {
  const db = freshDb();
  const userTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    .filter(t => t !== "users" && db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === "user_id"));
  const missing = userTables.filter(t => !(t in MERGE_PLAN));
  assert.deepEqual(missing, [], `add these to MERGE_PLAN: ${missing.join(", ")}`);
});

test("merge moves FROM's data and Google sign-in into INTO, then FROM is gone", () => {
  const db = freshDb(); twoAccounts(db);
  recordSession(db, { sid: "s-from", userId: 10 });
  const preview = mergePreview(db, 3, 10);
  assert.equal(preview.counts.user_jobs, 2);
  assert.equal(preview.from.signInMethods.google, true);
  const r = mergeAccounts(db, 3, 10);
  assert.deepEqual(r.sids, ["s-from"]);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE id = 10").get().n, 0);
  assert.equal(db.prepare("SELECT google_auth_id g FROM users WHERE id = 3").get().g, "google-sub-10");
  const jobs = db.prepare("SELECT job_id, starred FROM user_jobs WHERE user_id = 3 ORDER BY job_id").all();
  assert.deepEqual(jobs.map(j => [j.job_id, j.starred]), [["j1", 1], ["j2", 0]]);
  const p = db.prepare("SELECT full_name, email FROM user_profile WHERE user_id = 3").get();
  assert.equal(p.full_name, "Owner Name");            // INTO's value kept
  assert.equal(p.email, "owner@example.com");         // INTO's empty one filled
  assert.equal(db.prepare("SELECT COUNT(*) n FROM account_merges").get().n, 1);
});

test("merge refuses the same account, admins and two different identities of one provider", () => {
  const db = freshDb(); twoAccounts(db);
  assert.equal(code(() => mergeAccounts(db, 3, 3)), "same_account");
  db.prepare("UPDATE users SET google_auth_id = 'other-sub' WHERE id = 3").run();
  assert.equal(code(() => mergeAccounts(db, 3, 10)), "provider_conflict");
  db.prepare("UPDATE users SET google_auth_id = NULL, is_admin = 1 WHERE id = 3").run();
  assert.equal(code(() => mergeAccounts(db, 3, 10)), "admin_account");
});

test("merge refuses — and changes nothing — when a user table has no plan", () => {
  const db = freshDb(); twoAccounts(db);
  db.exec("CREATE TABLE brand_new (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE)");
  assert.equal(code(() => mergeAccounts(db, 3, 10)), "merge_plan_incomplete");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE id = 10").get().n, 1);
});

test("delete removes the account and its rows, returns the files and sessions to clean up", () => {
  const db = freshDb(); twoAccounts(db);
  db.prepare("UPDATE users SET avatar_path = 'avatars/10.png' WHERE id = 10").run();
  recordSession(db, { sid: "s10", userId: 10 });
  const r = deleteAccount(db, 10);
  assert.deepEqual(r.files, ["avatars/10.png"]);
  assert.deepEqual(r.sids, ["s10"]);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM user_jobs WHERE user_id = 10").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM user_profile WHERE user_id = 10").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM user_jobs WHERE user_id = 3").get().n, 1);
  db.prepare("UPDATE users SET is_admin = 1 WHERE id = 3").run();
  assert.equal(code(() => deleteAccount(db, 3)), "admin_account");
});

test("the last way to sign in cannot be unlinked", () => {
  const db = freshDb(); twoAccounts(db);
  assert.equal(code(() => unlinkProvider(db, 10, "google")), "last_method");
  db.prepare("UPDATE users SET password_set = 1 WHERE id = 10").run();
  unlinkProvider(db, 10, "google");
  assert.equal(accountSummary(db, 10).signInMethods.google, false);
});

test("password: change needs the current one; SETTING one (OAuth account) needs a recent sign-in", () => {
  const db = freshDb(); twoAccounts(db);
  assert.equal(code(() => changePassword(db, 3, { current: "nope", next: "longenough" }, { verify, hash })), "wrong_password");
  assert.equal(code(() => changePassword(db, 3, { current: "pw-owner-1", next: "short" }, { verify, hash })), "weak_password");
  changePassword(db, 3, { current: "pw-owner-1", next: "longenough" }, { verify, hash });
  assert.equal(db.prepare("SELECT password_hash h FROM users WHERE id = 3").get().h, "h:longenough");
  assert.equal(code(() => changePassword(db, 10, { next: "longenough" }, { verify, hash, session: {} })), "reauth_required");
  changePassword(db, 10, { next: "longenough" }, { verify, hash, session: { authAt: Date.now() } });
  assert.equal(accountSummary(db, 10).signInMethods.password, true);
  assert.equal(code(() => requireRecentAuth({ authAt: Date.now() - RECENT_AUTH_MS - 1 })), "reauth_required");
});

test("email codes: one use, expire, lock after five wrong tries", () => {
  const db = freshDb(); twoAccounts(db);
  const pepper = "k";
  const c = issueEmailCode(db, 3, { purpose: "email", email: "new@example.com", pepper });
  assert.match(c, /^\d{6}$/);
  assert.equal(code(() => consumeEmailCode(db, 3, { purpose: "email", code: c === "000000" ? "111111" : "000000", pepper })), "wrong_code");
  assert.equal(consumeEmailCode(db, 3, { purpose: "email", code: c, pepper }), "new@example.com");
  assert.equal(code(() => consumeEmailCode(db, 3, { purpose: "email", code: c, pepper })), "code_expired");
  const c2 = issueEmailCode(db, 3, { purpose: "email", email: "x@example.com", pepper, now: 1000 });
  assert.equal(code(() => consumeEmailCode(db, 3, { purpose: "email", code: c2, pepper, now: 1000 + 16 * 60 })), "code_expired");
  const c3 = issueEmailCode(db, 3, { purpose: "email", email: "y@example.com", pepper });
  const wrong = c3 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) code(() => consumeEmailCode(db, 3, { purpose: "email", code: wrong, pepper }));
  assert.equal(code(() => consumeEmailCode(db, 3, { purpose: "email", code: c3, pepper })), "code_locked");
  assert.equal(code(() => setVerifiedEmail(db, 3, "OWNER@example.com")), "email_taken");
  setVerifiedEmail(db, 3, "fresh@example.com");
  assert.equal(accountSummary(db, 3).emailVerified, true);
});

test("sessions: listed by a hash, never the sid; revoke one or all others", () => {
  const db = freshDb(); twoAccounts(db);
  recordSession(db, { sid: "a", userId: 3, userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130" });
  recordSession(db, { sid: "b", userId: 3, userAgent: "Mozilla/5.0 (iPhone) Safari/1" });
  const list = listSessions(db, 3, "a");
  assert.equal(list.length, 2);
  assert.ok(!JSON.stringify(list).includes('"a"'));
  assert.equal(list.find(s => s.current).device, "Chrome on Windows");
  assert.deepEqual(sidsToRevoke(db, 3, { exceptSid: "a" }), ["b"]);
  assert.deepEqual(sidsToRevoke(db, 3, { publicId: sessionPublicId("b") }), ["b"]);
  assert.deepEqual(sidsToRevoke(db, 10, { publicId: sessionPublicId("b") }), []);   // not another user's
});

test("display name, export without secrets, and the picture is judged by its bytes", () => {
  const db = freshDb(); twoAccounts(db);
  setDisplayName(db, 3, "  Ada   Lovelace ");
  assert.equal(accountSummary(db, 3).displayName, "Ada Lovelace");
  const out = exportAccount(db, 3);
  assert.ok(!("password_hash" in out.account));
  assert.equal(out.data.user_jobs.length, 1);
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])).type, "image/png");
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).ext, "jpg");
  assert.equal(code(() => sniffImage(Buffer.from("<svg onload=alert(1)>"))), "bad_type");
  assert.equal(code(() => sniffImage(Buffer.alloc(3 * 1024 * 1024, 0xff))), "too_large");
});

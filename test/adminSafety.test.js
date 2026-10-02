// A51 (10-02): the admin DB inspector's stop-the-harm fixes — see services/adminSafety.js.
//   1. "Clean Pool" is gone: it deleted a user's Saves and Passes in one click.
//   2. The raw query is read-only BY CONNECTION and stops reading at the cap.
//   3. Credentials never leave the inspector: every raw row is redacted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { REDACTED, RAW_QUERY_ROW_CAP, isSecretColumn, redactRow, runReadOnlyQuery, secretColumnsMentioned } from "../services/adminSafety.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// Code only: a comment may still name what was removed and why.
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function fixtureDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a51-"));
  const file = path.join(dir, "t.db");
  const rw = new Database(file);
  rw.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, password_hash TEXT, input_tokens INTEGER);
           CREATE TABLE t (n INTEGER);`);
  rw.prepare("INSERT INTO users VALUES (1, 'a@example.com', '$2b$hash', 42), (2, 'b@example.com', NULL, 0)").run();
  const ins = rw.prepare("INSERT INTO t VALUES (?)");
  rw.transaction(() => { for (let i = 0; i < RAW_QUERY_ROW_CAP + 50; i++) ins.run(i); })();
  rw.close();
  const ro = new Database(file, { readonly: true, fileMustExist: true });
  return { ro, cleanup: () => { ro.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows lock */ } } };
}

test("credential columns are recognised — and token COUNTS and diagnostic hashes are not", () => {
  for (const c of ["password_hash", "otp_hash", "token_hash", "code_hash", "cookies_enc", "secret_enc", "apify_token",
                   "session_sid", "sid", "session_id", "refresh_token", "api_key"]) {
    assert.ok(isSecretColumn(c), `${c} must be redacted`);
  }
  for (const c of ["input_tokens", "monthly_token_budget", "basis_hash", "content_hash", "email", "id"]) {
    assert.ok(!isSecretColumn(c), `${c} is diagnosis, not a credential`);
  }
});

test("a redacted row says the value was PRESENT; NULL stays NULL; the original is not mutated", () => {
  const row = { id: 1, password_hash: "$2b$x", sid: null };
  const out = redactRow(row);
  assert.deepEqual(out, { id: 1, password_hash: REDACTED, sid: null });
  assert.equal(row.password_hash, "$2b$x");
});

test("⛔ the raw query runs only on a READ-ONLY connection, and SQLite itself refuses a write", () => {
  const { ro, cleanup } = fixtureDb();
  try {
    const rw = new Database(":memory:");
    assert.throws(() => runReadOnlyQuery(rw, "SELECT 1"), /writable connection/);
    rw.close();
    assert.throws(() => runReadOnlyQuery(ro, "INSERT INTO t VALUES (1)"), /return rows/);
    assert.throws(() => runReadOnlyQuery(ro, "PRAGMA user_version = 7"), /return rows/);
    // Even past every application-level check, the connection is the guard.
    assert.throws(() => ro.prepare("DELETE FROM t").run(), /readonly/i);
  } finally { cleanup(); }
});

test("the raw query stops reading at the cap and says it truncated", () => {
  const { ro, cleanup } = fixtureDb();
  try {
    const r = runReadOnlyQuery(ro, "SELECT n FROM t");
    assert.equal(r.count, RAW_QUERY_ROW_CAP);
    assert.equal(r.truncated, true);
    assert.equal(runReadOnlyQuery(ro, "SELECT n FROM t LIMIT 3").truncated, false);
  } finally { cleanup(); }
});

test("⛔ an alias does not unmask a credential — redaction follows the ORIGIN column", () => {
  const { ro, cleanup } = fixtureDb();
  try {
    const r = runReadOnlyQuery(ro, "SELECT id, password_hash AS x, input_tokens FROM users ORDER BY id");
    assert.deepEqual(r.rows, [{ id: 1, x: REDACTED, input_tokens: 42 }, { id: 2, x: null, input_tokens: 0 }]);
    assert.deepEqual(secretColumnsMentioned("SELECT substr(password_hash,1,8) FROM users"), ["password_hash"]);
  } finally { cleanup(); }
});

test("⛔ Clean Pool is gone — no route, no button, nothing in the inspector deletes user_jobs", () => {
  const routes = code(read("routes/adminDb.js"));
  const ui = code(read("client/src/pages/admin/DBInspector.jsx"));
  assert.doesNotMatch(routes, /router\.post\("\/clean-user-pool/);
  assert.doesNotMatch(routes, /DELETE\s+FROM\s+user_jobs/i, "the inspector may never delete a user's saves or passes");
  assert.doesNotMatch(ui, /clean-user-pool|Clean Pool"/);
});

test("every raw-row route goes through redaction, and the raw query through the read-only runner", () => {
  const routes = read("routes/adminDb.js");
  assert.match(routes, /res\.json\(runReadOnlyQuery\(conn, sql\)\)/);
  assert.match(routes, /new Database\(dbPath, \{ readonly: true, fileMustExist: true \}\)/);
  assert.doesNotMatch(routes, /db\.prepare\(sql\)\.all\(\)/, "the old raw query on the read-write handle");
  assert.match(routes, /const rows = redactRows\(db\.prepare\(`SELECT \* FROM "\$\{table\}" ORDER BY rowid DESC LIMIT \? OFFSET \?`\)/);
  assert.match(routes, /scraped_job: redactRow\(scrapedJob\)/);
  assert.match(routes, /const rows = redactRows\(db\.prepare\(`SELECT \* FROM "\$\{table\}" LIMIT 100000`\)\.all\(\)\)/);
});

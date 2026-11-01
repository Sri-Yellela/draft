// ⛔ A107 (agent-raised 10-31, 43v) · Note why's private text (job_applications.rejection_note, "Private: only you see it",
// migration 200) left through whole-row admin reads: GET /api/admin/users/:id/applications (SELECT *) and the job
// inspector's `ja.*` rows (routes/adminDb.js). FIX: rejection_note is one of adminSafety.js's redacted columns, so every
// admin read that redacts (the Table Browser, the raw query, the inspector) hides it, and the users route redacts too.
// The user's own reads keep it (their words, their data); the quick picks (rejection_reasons) are not redacted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { redactRows, isSecretColumn, secretColumnsMentioned } from "../services/adminSafety.js";
import { at } from "../test-support/sourceAnchors.js";

const MARKER = "synthetic-private-note-7f3a";
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A107 · a107AdminReadsOmitRejectionNote — the marker note never appears in an admin read of job_applications", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (5, 'synthetic5@example.test', 'x')").run();
  db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, rejection_note, rejection_reasons)
    VALUES (5, 'j1', 'Northwind', 'Engineer', 1, ?, '["level_mismatch"]')`).run(MARKER);
  // the two whole-row admin reads, as written
  const usersRoute = redactRows(db.prepare("SELECT * FROM job_applications WHERE user_id=? ORDER BY applied_at DESC").all(5));
  const inspector = redactRows(db.prepare(`SELECT ja.*, u.username FROM job_applications ja JOIN users u ON u.id = ja.user_id WHERE ja.job_id = ?`).all("j1"));
  for (const rows of [usersRoute, inspector]) {
    assert.ok(!JSON.stringify(rows).includes(MARKER), "the note leaves through an admin read");
    assert.equal(rows[0].rejection_reasons, '["level_mismatch"]', "the quick picks stay");
  }
  assert.equal(isSecretColumn("rejection_note"), true);
  assert.equal(isSecretColumn("rejection_reasons"), false);
  assert.deepEqual(secretColumnsMentioned("SELECT rejection_note FROM job_applications"), ["rejection_note"], "the raw query refuses to name it");
});

test("A107 · both admin routes pass their job_applications rows through redactRows", () => {
  const server = read("server.js");
  const i = at(server, `app.get("/api/admin/users/:id/applications"`);
  assert.match(server.slice(i, i + 400), /res\.json\(redactRows\(db\.prepare\("SELECT \* FROM job_applications WHERE user_id=\?/);
  const admin = read("routes/adminDb.js");
  assert.match(admin, /applications: redactRows\(applications\),/);
});

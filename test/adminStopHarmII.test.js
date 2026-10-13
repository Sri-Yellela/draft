// A58 (10-02): admin stop-the-harm II — the A50 audit's remaining A51-class controls.
//   (a) User delete refuses the system account and every admin, goes through deleteAccount, and is
//       armed by a per-table preview and the username typed back.
//   (b) Job Review never writes user_jobs; "Hide" is "Unclassify"; every write is logged and undoable.
//   (c) restoreBackup checkpoints the WAL before its safety copy.
//   (d) Revert batch goes through the route's dry run first.
//   (e) The dead force-scrape route (a user's own Apify token) is gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { AccountError, deleteAccount } from "../services/accountService.js";
import {
  adminDeletePreview, adminDeleteUser, checkAdminDeletable, userRowCounts,
} from "../services/adminUserDelete.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// Code only: a comment may still name what was removed and why.
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const errCode = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof AccountError, e.message); return e.code; } return null; };

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}

// Synthetic: admin 1, user 2 (the one deleted), user 3 (a bystander). System (0) comes from 075.
function people(db) {
  db.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, 'admin_a', 'x', 1)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (2, 'user_b', 'x', 0)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (3, 'user_c', 'x', 0)").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (2, 'j1', 1), (2, 'j2', 0), (3, 'j1', 1)").run();
  db.prepare("INSERT INTO usage_events (user_id, event_type, purpose) VALUES (0, 'api_call', 'enrich_job'), (2, 'api_call', 'x')").run();
  db.prepare("UPDATE users SET avatar_path = 'avatars/2.png' WHERE id = 2").run();
}

// ── (a) user delete ──────────────────────────────────────────────────────────────────────────

test("(a) ⛔ the system account (id 0) can never be deleted — not by the admin route, not by deleteAccount", () => {
  const db = freshDb(); people(db);
  assert.equal(db.prepare("SELECT username FROM users WHERE id = 0").get().username, "system", "075 created it");
  assert.equal(errCode(() => adminDeletePreview(db, 0, 1)), "system_account");
  assert.equal(errCode(() => adminDeleteUser(db, 0, { actorId: 1, confirmUsername: "system" })), "system_account");
  assert.equal(errCode(() => deleteAccount(db, 0)), "system_account");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usage_events WHERE user_id = 0").get().n, 1, "the background ledger survives");
  // The id is the guard, not the name: a renamed id-0 row is still the ledger's owner.
  db.prepare("UPDATE users SET username = 'renamed' WHERE id = 0").run();
  assert.equal(errCode(() => checkAdminDeletable(db, 0, 1)), "system_account");
});

test("(a) ⛔ any admin and the caller are refused — not only self", () => {
  const db = freshDb(); people(db);
  db.prepare("INSERT INTO users (id, username, password_hash, is_admin) VALUES (4, 'admin_d', 'x', 1)").run();
  assert.equal(errCode(() => checkAdminDeletable(db, 4, 1)), "admin_account", "another admin");
  assert.equal(errCode(() => checkAdminDeletable(db, 2, 2)), "self");
  assert.equal(errCode(() => checkAdminDeletable(db, 99, 1)), "not_found");
  assert.equal(errCode(() => checkAdminDeletable(db, NaN, 1)), "bad_id");
});

test("(a) the preview counts the user's rows per table and writes nothing", () => {
  const db = freshDb(); people(db);
  const p = adminDeletePreview(db, 2, 1);
  assert.equal(p.confirmWith, "user_b");
  assert.equal(p.counts.user_jobs, 2);
  assert.equal(p.counts.usage_events, 1);
  assert.equal(p.totalRows, Object.values(p.counts).reduce((a, b) => a + b, 0));
  assert.deepEqual(userRowCounts(db, 2), p.counts);
  assert.ok(db.prepare("SELECT 1 FROM users WHERE id = 2").get(), "a preview deletes nothing");
});

test("(a) ⛔ the delete needs the username typed back exactly, and refuses without deleting", () => {
  const db = freshDb(); people(db);
  for (const typed of [undefined, "", "USER_B", "user_b ", "user_c"]) {
    assert.equal(errCode(() => adminDeleteUser(db, 2, { actorId: 1, confirmUsername: typed })), "confirm_mismatch", String(typed));
  }
  assert.ok(db.prepare("SELECT 1 FROM users WHERE id = 2").get());
});

test("(a) the delete goes through deleteAccount: files returned, rows gone, bystanders and the ledger kept, audit logged", () => {
  const db = freshDb(); people(db);
  db.prepare("INSERT INTO usage_tracking_failures (user_id, error_text) VALUES (2, 'e')").run();
  const r = adminDeleteUser(db, 2, { actorId: 1, confirmUsername: "user_b" });
  assert.deepEqual(r.files, ["avatars/2.png"], "the avatar is handed back for removal, as the self-delete does");
  assert.equal(r.counts.user_jobs, 2);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE id = 2").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM user_jobs WHERE user_id = 2").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usage_tracking_failures WHERE user_id = 2").get().n, 0,
    "the no-FK table deleteAccount clears by hand — the raw DELETE left it orphaned");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM user_jobs WHERE user_id = 3").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM usage_events WHERE user_id = 0").get().n, 1);
  const log = db.prepare("SELECT * FROM admin_audit_log WHERE action = 'user.delete'").get();
  assert.equal(log.target, "2");
  assert.equal(log.admin_user_id, 1);
  assert.doesNotMatch(log.before_json, /user_b/, "the record keeps the id and counts, not the username");
});

test("(a) the route: preview, typed confirm, sessions revoked BEFORE the cascade, no raw DELETE FROM users", () => {
  const server = read("server.js");
  const start = at(server, 'app.delete("/api/admin/users/:id"');
  const route = server.slice(start, at(server, "\napp.", start + 10));
  assert.doesNotMatch(route, /DELETE FROM users/, "the raw delete bypassed files, sessions and the system refusal");
  // D95: the actor is a coded identity (an admin account, or the legacy users row) — never a bare req.user.id.
  assert.match(route, /checkAdminDeleteConfirmed\(db, id, \{ actorId: actorOf\(req\), confirmUsername \}\)/);
  assert.ok(route.indexOf("revokeAllUserSessions(id") < route.indexOf("adminDeleteUser("),
    "the sealed store is found through rows the cascade removes — revoke first");
  assert.match(route, /removeDataFiles\(DATA_DIR, files\)/);
  assert.match(server, /app\.get\("\/api\/admin\/users\/:id\/delete-preview", requireAdmin/);
});

test("(a) the UI hides Delete for the system account and arms the delete only with the typed username", () => {
  const ui = code(read("client/src/panels/AdminPanel.jsx"));
  assert.match(ui, /export const isSystemAccount = \(u\) => u\?\.id === 0 \|\| u\?\.username === "system"/);
  // D88 (39d): Delete is on a person's page (panels/adminPeople.jsx), hidden for the system account (the server marks
  // `system` with the same rule), and it opens the same typed-username dialog below. D95: an admin never reaches a
  // person's page at all (the list excludes it and /api/admin/people/:id answers 404), so only `system` locks.
  const people = code(read("client/src/panels/adminPeople.jsx"));
  assert.match(people, /const locked = a\.system;/);
  assert.match(people, /\{!locked && <Btn theme=\{theme\} danger onClick=\{\(\) => onDelete\(id\)\}>Delete the account…<\/Btn>\}/);
  assert.match(ui, /<PeopleUsers theme=\{theme\} onDelete=\{deleteUser\}/);
  assert.match(read("services/userAdmin.js"), /const isSystem = \(u\) => u\?\.id === 0 \|\| u\?\.username === "system";/);
  assert.ok(lastAt);
  assert.doesNotMatch(ui, /confirm\("Delete this user and all their data\?"\)/, "the generic confirm is gone");
  assert.match(ui, /const armed = typed === preview\.confirmWith && !busy;/);
  assert.match(ui, /body:JSON\.stringify\(\{ confirmUsername: typed \}\)/);
  assert.match(ui, /api\(`\/api\/admin\/users\/\$\{id\}\/delete-preview`\)/);
});

// ── (b) Job Review ───────────────────────────────────────────────────────────────────────────
import {
  jobReviewImpact, reassignJob, recentJobReviewChanges, undoJobReview,
} from "../services/adminJobReview.js";

const ROLE_KEYS = new Set(["engineering", "data", "pm", "general"]);

function reviewDb() {
  const db = freshDb(); people(db);
  db.prepare("INSERT INTO scraped_jobs (job_id, title, company, search_query, _hash) VALUES ('j1', 'Data Engineer', 'Acme', 'q', 'h1'), ('j2', 'PM', 'Acme', 'q', 'h2')").run();
  db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (5, 2, 'p5', 'engineering', 'software', 1), (6, 3, 'p6', 'data', 'data', 1)").run();
  // Every user's decision is tagged to their own profile: 2 saved j1 under 5, 3 PASSED j1 under 6.
  db.prepare("DELETE FROM user_jobs").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred, disliked, domain_profile_id) VALUES (2, 'j1', 1, 0, 5), (3, 'j1', 0, 1, 6)").run();
  db.prepare("INSERT INTO job_role_map (job_id, role_key, role_family, domain, matched_by) VALUES ('j1', 'engineering', 'engineering', 'software', 'title')").run();
  return db;
}
const userJobsImage = (db) => db.prepare("SELECT user_id, job_id, starred, disliked, applied, domain_profile_id FROM user_jobs ORDER BY id").all();
const roleMapImage = (db, id) => db.prepare("SELECT role_key, role_family, domain, source_profile_id, confidence, matched_by, created_at FROM job_role_map WHERE job_id = ?").all(id);

test("(b) ⛔ Save and Unclassify never touch user_jobs — a Pass stays a Pass, on its own profile", () => {
  const db = reviewDb();
  const before = userJobsImage(db);
  reassignJob(db, { jobId: "j1", roleKey: "data", domainProfileId: 6, adminUserId: 1, validRoleKeys: ROLE_KEYS });
  assert.deepEqual(userJobsImage(db), before, "Save rewrote a user's decision");
  reassignJob(db, { jobId: "j1", roleKey: "unclassified", adminUserId: 1, validRoleKeys: ROLE_KEYS });
  assert.deepEqual(userJobsImage(db), before, "Unclassify rewrote a user's decision");
});

test("(b) the change is what it says: Save replaces the role map, Unclassify removes it", () => {
  const db = reviewDb();
  const r = reassignJob(db, { jobId: "j1", roleKey: "data", domainProfileId: 6, adminUserId: 1, validRoleKeys: ROLE_KEYS });
  assert.deepEqual(db.prepare("SELECT role_key, matched_by, source_profile_id FROM job_role_map WHERE job_id='j1'").all(),
    [{ role_key: "data", matched_by: "manual_review", source_profile_id: 6 }]);
  assert.equal(r.impact.usersReferencing, 2);
  reassignJob(db, { jobId: "j1", roleKey: "unclassified", adminUserId: 1, validRoleKeys: ROLE_KEYS });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM job_role_map WHERE job_id='j1'").get().n, 0);
  assert.throws(() => reassignJob(db, { jobId: "j1", roleKey: "nonsense", validRoleKeys: ROLE_KEYS }), /Invalid roleKey/);
  assert.throws(() => reassignJob(db, { jobId: "nope", roleKey: "data", validRoleKeys: ROLE_KEYS }), /Job not found/);
});

test("(b) the impact counts who has a decision on the posting", () => {
  const db = reviewDb();
  assert.deepEqual(jobReviewImpact(db, "j1"), { usersReferencing: 2, saved: 1, passed: 1, applied: 0 });
  assert.deepEqual(jobReviewImpact(db, "j2"), { usersReferencing: 0, saved: 0, passed: 0, applied: 0 });
});

test("(b) every write is logged with the value it replaced, and the newest change undoes exactly", () => {
  const db = reviewDb();
  const original = roleMapImage(db, "j1");
  const first = reassignJob(db, { jobId: "j1", roleKey: "data", domainProfileId: 6, adminUserId: 1, validRoleKeys: ROLE_KEYS });
  const second = reassignJob(db, { jobId: "j1", roleKey: "unclassified", adminUserId: 1, validRoleKeys: ROLE_KEYS });
  const log = recentJobReviewChanges(db);
  assert.deepEqual(log[0].before.roleMap.map(r => r.role_key), ["data"]);
  assert.deepEqual(log[1].before.roleMap, original, "the old value is in the record, verbatim");
  assert.throws(() => undoJobReview(db, first.logId), /newer/, "an older change cannot be undone over a newer one");
  undoJobReview(db, second.logId, { adminUserId: 1 });
  undoJobReview(db, first.logId, { adminUserId: 1 });
  assert.deepEqual(roleMapImage(db, "j1"), original);
  assert.equal(db.prepare("SELECT domain_profile_id FROM scraped_jobs WHERE job_id='j1'").get().domain_profile_id, null);
  assert.throws(() => undoJobReview(db, first.logId), /already undone/);
});

// The admin surfaces: every admin router and service, and every /api/admin handler in server.js.
function adminSources() {
  const out = {};
  for (const f of ["routes/adminDb.js", "routes/admin.js", "routes/enrichment.js", "services/adminJobReview.js",
                   "services/adminUserDelete.js", "services/adminSafety.js", "services/adminGlance.js"]) {
    if (fs.existsSync(f)) out[f] = code(read(f));
  }
  const server = code(read("server.js"));
  const handlers = [...server.matchAll(/\napp\.(?:get|post|put|patch|delete)\("\/api\/admin[\s\S]*?(?=\napp\.|\n\/\/ ═)/g)].map(m => m[0]);
  assert.ok(handlers.length > 20, `found ${handlers.length} /api/admin handlers — the extractor has drifted`);
  out["server.js /api/admin handlers"] = handlers.join("\n");
  return out;
}

test("(b) ⛔ no admin route writes user_jobs — no UPDATE, no DELETE, no INSERT", () => {
  for (const [f, src] of Object.entries(adminSources())) {
    assert.doesNotMatch(src, /UPDATE\s+user_jobs\b/i, `${f}: UPDATE user_jobs — a user's Saves/Passes are theirs`);
    assert.doesNotMatch(src, /DELETE\s+FROM\s+user_jobs\b/i, `${f}: DELETE FROM user_jobs`);
    assert.doesNotMatch(src, /(INSERT|REPLACE)(\s+OR\s+\w+)?\s+INTO\s+user_jobs\b/i, `${f}: INSERT INTO user_jobs`);
  }
});

test("(b) Re-tag Pool is gone; Hide is Unclassify and its confirm states the effect and the user count", () => {
  const routes = code(read("routes/adminDb.js"));
  const ui = code(read("client/src/pages/admin/DBInspector.jsx"));
  assert.doesNotMatch(routes, /retag-user-pool/);
  assert.doesNotMatch(ui, /retag-user-pool|Re-tag Pool/);
  assert.match(routes, /res\.json\(reassignJob\(db, \{/);
  assert.match(routes, /router\.get\("\/job-review\/impact\/:jobId"/);
  assert.match(routes, /router\.post\("\/job-review\/undo\/:logId"/);
  assert.doesNotMatch(ui, />\s*Hide\s*</, "the label stated the opposite of the effect");
  assert.match(ui, />\s*Unclassify\s*</);
  assert.match(ui, /SHOWN ON EVERY BOARD/);
  const reassign = ui.slice(at(ui, "const reassign = async"), at(ui, "const undoLast"));
  // D83 (39d): the confirm is the in-page one (useConfirm), still between the count and the write.
  for (const needle of ["/api/admin/db/job-review/impact/", "await ask(", "/api/admin/db/job-review/reassign"]) assert.ok(reassign.includes(needle), needle);
  assert.ok(reassign.indexOf("/api/admin/db/job-review/impact/") < reassign.indexOf("await ask("), "the count is read before the confirm");
  assert.ok(reassign.indexOf("await ask(") < reassign.indexOf("/api/admin/db/job-review/reassign"), "and the confirm comes before the write");
  assert.match(reassign, /describeImpact\(impact\)/);
});

// ── (e) force-scrape ─────────────────────────────────────────────────────────────────────────

test("(e) ⛔ the force-scrape route is gone and the admin router is no longer handed scrapeJobs", () => {
  const routes = code(read("routes/adminDb.js"));
  assert.doesNotMatch(routes, /force-scrape/);
  assert.doesNotMatch(routes, /apify_token/, "no admin route may spend a user's own Apify token");
  assert.doesNotMatch(routes, /scrapeJobs/);
  assert.match(read("server.js"), /createAdminDbRouter\(db, \{ dbPath: DB_PATH \}\)/);
  for (const f of ["client/src/pages/admin/DBInspector.jsx", "client/src/panels/AdminPanel.jsx", "client/src/panels/adminOps.jsx"]) {
    assert.doesNotMatch(read(f), /force-scrape/, `${f} calls a route that no longer exists`);
  }
});

// ── (c) restoreBackup checkpoints before its safety copy ───────────────────────────────────────
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("(c) ⛔ the pre-restore safety copy holds what was still in the WAL — run, not read", () => {
  // The live shape: a committed write still in resume_master.db-wal, not yet in the main file.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a58-restore-"));
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "a58-stage-"));
  const live = path.join(dir, "resume_master.db");
  try {
    fs.mkdirSync(path.join(dir, "backups"));
    const s = new Database(path.join(stage, "s.db"));
    s.pragma("journal_mode = WAL");
    s.pragma("wal_autocheckpoint = 0");
    s.exec("CREATE TABLE t (v INTEGER); INSERT INTO t VALUES (1);");
    s.pragma("wal_checkpoint(TRUNCATE)");
    s.prepare("INSERT INTO t VALUES (2)").run();           // committed, WAL only
    fs.copyFileSync(path.join(stage, "s.db"), live);
    fs.copyFileSync(path.join(stage, "s.db-wal"), `${live}-wal`);
    s.close();
    assert.ok(fs.statSync(`${live}-wal`).size > 0, "the WAL must hold the row for this test to mean anything");
    // The backup being restored: any valid database.
    const b = new Database(path.join(dir, "backups", "bk.db")); b.exec("CREATE TABLE t (v INTEGER);"); b.close();
    fs.writeFileSync(path.join(dir, "backups", "manifest.json"),
      JSON.stringify([{ filename: "bk.db", label: "manual", size: fs.statSync(path.join(dir, "backups", "bk.db")).size }]));

    const url = new URL("../scripts/backup.js", import.meta.url).href;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e",
      `const { restoreBackup } = await import(${JSON.stringify(url)}); restoreBackup("bk.db"); console.log("OK");`],
      { env: { ...process.env, BACKUP_DATA_DIR: dir }, encoding: "utf8" });
    assert.match(r.stdout, /OK/, r.stdout + r.stderr);

    const safe = JSON.parse(fs.readFileSync(path.join(dir, "backups", "manifest.json"), "utf8")).find(e => e.label === "pre-restore");
    assert.ok(safe, "the safety copy is in the manifest");
    assert.equal(safe.walCheckpointed, true, "and records that it was checkpointed");
    // Read the safety copy ALONE — no sidecar — the way a restore of it would.
    const probe = path.join(stage, "probe.db");
    fs.copyFileSync(path.join(dir, "backups", safe.filename), probe);
    const p = new Database(probe);
    const n = p.prepare("SELECT COUNT(*) c FROM t").get().c;
    p.close();
    assert.equal(n, 2, "the row that was only in the WAL is in the safety copy");
  } finally {
    for (const d of [dir, stage]) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); } catch { /* Windows lock */ } }
  }
});

test("(c) the checkpoint runs before the safety copy in the source, as in createBackup", () => {
  const src = read("packages/sqlite-backup/src/index.js");   // A65: the policy's home
  const body = src.slice(at(src, "export function restoreBackup"));
  const cpAt = body.indexOf("const cp = checkpointWal();");
  assert.ok(cpAt > 0 && cpAt < body.indexOf("fs.copyFileSync(DB_PATH, safePath);"));
  assert.match(body, /walCheckpointed: cp\.ok/);
});

// ── (d) Revert batch: dry run first ────────────────────────────────────────────────────────────
import { revertPreview, revertBatch } from "../services/jobs/enrichmentBatches.js";

test("(d) the revert dry run counts what it would restore — and the rows changed since, which it clobbers", () => {
  const db = freshDb();
  db.prepare("INSERT INTO scraped_jobs (job_id, title, company, search_query, _hash, summary, enriched_at, enrichment_batch_id) VALUES " +
    "('a', 'A', 'Acme', 'q', 'ha', 's', 100, 1), ('b', 'B', 'Acme', 'q', 'hb', 's', 100, 2), ('c', 'C', 'Acme', 'q', 'hc', 's', 700, 1)").run();
  db.prepare("INSERT INTO enrichment_batches (id, source, started_at) VALUES (1, 'import', 90), (2, 'import', 400)").run();
  const before = JSON.stringify({ summary: null, enriched_at: null });
  db.prepare("INSERT INTO enrichment_batch_rows (batch_id, job_id, before_json, written_at) VALUES " +
    "(1, 'a', ?, 100), (1, 'b', ?, 100), (1, 'c', ?, 100), (1, 'gone', ?, 100)").run(before, before, before, before);
  const p = revertPreview(db, 1);
  assert.equal(p.recordedRows, 4);
  assert.equal(p.restorable, 3);
  assert.equal(p.missing, 1, "a row deleted since cannot be restored, and says so");
  assert.equal(p.changedSince, 2, "b now belongs to batch 2; c was enriched again (no batch) after batch 1 wrote it");
  assert.deepEqual(p.changedSinceSample.map(r => r.jobId).sort(), ["b", "c"]);
  assert.equal(db.prepare("SELECT summary FROM scraped_jobs WHERE job_id='a'").get().summary, "s", "a preview writes nothing");
  assert.equal(revertPreview(db, 99), null);
  revertBatch(db, 1);
  assert.equal(revertPreview(db, 1).alreadyReverted, true);
});

test("(d) ⛔ the route refuses an apply that did not quote its dry run; the button runs the dry run first", () => {
  const route = read("routes/enrichment.js");
  const body = route.slice(at(route, 'router.post("/batches/:id/revert"'));
  assert.ok(body.indexOf("req.body?.expectRestorable !== preview.restorable") < body.indexOf("revertBatch(db, id)"));
  // D83 audit #21 (39d): the inspector's round trip is retired; Admin → Enrichment's Undo is the one revert button.
  assert.doesNotMatch(code(read("client/src/pages/admin/DBInspector.jsx")), /enrichment\/batches\/.*\/revert/);
  const ui = code(read("client/src/panels/adminEnrichment.jsx"));
  const revert = ui.slice(at(ui, "const askUndo = async (b)"), at(ui, "const doUndo"));
  assert.doesNotMatch(revert, /apply: true/, "the first click is the dry run");
  assert.match(revert, /body: "\{\}"/);
  const doUndo = ui.slice(at(ui, "const doUndo"), at(ui, "};", at(ui, "const doUndo")));
  assert.match(doUndo, /JSON\.stringify\(\{ apply: true, expectRestorable: undoPlan\.restorable \}\)/);
  // the apply is reachable only from the confirm dialog, which states what is restored and what changed since
  const dialog = ui.slice(at(ui, "{undoPlan && ("), at(ui, "{undoPlan && (") + 900);
  assert.match(dialog, /<Dialog title=\{`Undo import #\$\{undoPlan\.batchId\}\?`\}/);
  assert.match(dialog, /onConfirm=\{doUndo\}|doUndo/);
  assert.match(dialog, /undoPlan\.changedSince/);
});

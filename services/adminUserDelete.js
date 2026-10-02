// services/adminUserDelete.js
//
// A58 (a) — the admin's "Delete user", made the same operation as the user's own delete.
//
// The route this replaces ran `DELETE FROM users WHERE id=?` behind a generic confirm and refused
// only the caller's own id. Three things followed:
//   - The `system` account (id 0, migration 075) was listed with a Delete button. Every background
//     usage_events row — enrichment, classifier and import spend, the raw ledger — hangs off it
//     ON DELETE CASCADE, and 075's INSERT never re-runs, so every later background insert would fail
//     its foreign key.
//   - Another ADMIN could be deleted (the UI hid the button; the route did not refuse).
//   - It bypassed accountService.deleteAccount: screenshot and avatar files stayed on disk, the
//     sealed session store was never cleared, usage_tracking_failures (no FK) was orphaned.
//
// Now: the refusals live HERE (and deleteAccount refuses id 0 as well), the caller sees per-table
// row counts before anything happens, and the delete requires the target's username typed back.

import { deleteAccount, AccountError } from "./accountService.js";
import { SYSTEM_USER_ID } from "./modelCall.js";
import path from "node:path";
import fs from "node:fs";

const fail = (status, code, message) => { throw new AccountError(status, code, message); };

/**
 * Every row the user owns, per table: columns that REFERENCE users(id) (what the cascade will
 * delete) plus any `user_id` column without a foreign key (what deleteAccount clears by hand).
 * Read from the live schema, so a table added next month is counted without editing this.
 */
export function userRowCounts(db, userId) {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'users' ORDER BY name"
  ).all().map(r => r.name);
  const counts = {};
  for (const t of tables) {
    const cols = new Set(db.prepare(`SELECT "from" AS c FROM pragma_foreign_key_list(?) WHERE "table" = 'users'`).all(t).map(r => r.c));
    if (db.prepare("SELECT 1 FROM pragma_table_info(?) WHERE name = 'user_id'").get(t)) cols.add("user_id");
    let n = 0;
    for (const c of cols) n += db.prepare(`SELECT COUNT(*) n FROM "${t}" WHERE "${c}" = ?`).get(userId).n;
    if (n) counts[t] = n;
  }
  return counts;
}

/** The refusals, in one place. Returns the target row when it may be deleted. */
export function checkAdminDeletable(db, targetId, actorId) {
  if (!Number.isInteger(targetId)) fail(400, "bad_id", "Not a user id.");
  if (targetId === SYSTEM_USER_ID) {
    fail(409, "system_account", "The system account owns every background usage record and cannot be deleted.");
  }
  if (targetId === actorId) fail(400, "self", "Cannot delete yourself.");
  const u = db.prepare("SELECT id, username, is_admin, created_at FROM users WHERE id = ?").get(targetId);
  if (!u) fail(404, "not_found", "User not found.");
  if (u.username === "system") fail(409, "system_account", "The system account cannot be deleted.");
  if (u.is_admin) fail(409, "admin_account", "An admin account cannot be deleted. Remove its admin role first.");
  return u;
}

/** What the delete would remove — shown to the admin before the typed confirm. Writes nothing. */
export function adminDeletePreview(db, targetId, actorId) {
  const u = checkAdminDeletable(db, targetId, actorId);
  const counts = userRowCounts(db, targetId);
  return {
    user: { id: u.id, username: u.username, createdAt: u.created_at },
    counts,
    totalRows: Object.values(counts).reduce((a, b) => a + b, 0),
    confirmWith: u.username,
  };
}

/** Refuses unless `confirmUsername` is the target's username exactly. Returns the target row. */
export function checkAdminDeleteConfirmed(db, targetId, { actorId, confirmUsername }) {
  const u = checkAdminDeletable(db, targetId, actorId);
  if (typeof confirmUsername !== "string" || confirmUsername !== u.username) {
    fail(400, "confirm_mismatch", "Type the user's username exactly to confirm the delete.");
  }
  return u;
}

/**
 * The delete itself, through deleteAccount. The caller revokes sessions BEFORE this (the sealed
 * store is found through rows this cascade removes) and removes the returned files after.
 * Recorded in admin_audit_log with the row counts — the id and counts, not the username.
 */
export function adminDeleteUser(db, targetId, { actorId, confirmUsername }) {
  checkAdminDeleteConfirmed(db, targetId, { actorId, confirmUsername });
  const counts = userRowCounts(db, targetId);
  const { files, sids } = deleteAccount(db, targetId);
  try {
    db.prepare(`INSERT INTO admin_audit_log (admin_user_id, action, target, before_json)
                VALUES (?, 'user.delete', ?, ?)`).run(actorId ?? null, String(targetId), JSON.stringify({ counts }));
  } catch (e) {
    // The delete has happened; a missing log table (pre-119 schema) must not report it as failed.
    console.warn("[admin] user delete not recorded in admin_audit_log:", e.message);
  }
  return { files, sids, counts };
}

/** Removes files deleteAccount returned — only ever inside the data dir, as the self-delete does. */
export function removeDataFiles(dataDir, files) {
  const root = path.resolve(dataDir) + path.sep;
  for (const rel of files) {
    const abs = path.resolve(dataDir, rel);
    if (!abs.startsWith(root)) continue;
    fs.promises.unlink(abs).catch(() => {});
  }
}

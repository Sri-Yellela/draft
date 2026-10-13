// test-support/legacyAdminRows.js — ⛔ D95 Phase 2 (migration 162): the database refuses an admin flag on a users row
// (triggers users_no_admin_insert / users_no_admin_update). A few fixtures deliberately model a row FROM BEFORE 162 —
// to keep testing the server's leftover guards against one (an admin row cannot be suspended, deleted, merged, listed).
// They say so by calling this, which removes the two triggers in THAT in-memory database only. Never used to test
// the rule itself: test/d95AdminAccounts.test.js proves the triggers refuse.
export function allowLegacyAdminRows(db) {
  db.exec("DROP TRIGGER IF EXISTS users_no_admin_insert; DROP TRIGGER IF EXISTS users_no_admin_update;");
  return db;
}

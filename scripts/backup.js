// scripts/backup.js
// Run directly:  node scripts/backup.js [list|verify|restore <filename>]
// Or via npm:    npm run backup / npm run restore
//
// THE POLICY LIVES IN packages/sqlite-backup (A65, 2026-10-02) — moved there unchanged so Resume
// Master runs the same one. This file points it at draft's database and keeps the CLI.
import path from "path";
import { fileURLToPath } from "url";
import {
  configureBackups, createBackup, listBackups, verifyBackups, restoreBackup, mb,
} from "../packages/sqlite-backup/src/index.js";
export {
  configureBackups, createBackup, createBackupAsync, listBackups, verifyBackups, restoreBackup,
  backupLimits, selectRetained, BackupRefused,
} from "../packages/sqlite-backup/src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// BACKUP_DATA_DIR exists for the tests, which run createBackup against a scratch directory.
configureBackups({
  dataDir: process.env.BACKUP_DATA_DIR || path.join(__dirname, "..", "data"),
  dbFile: "resume_master.db",
  filePrefix: "resume_master",
});

// ── Run as script ──────────────────────────────────────────────
// GUARDED BY AN ENTRY-POINT CHECK, and this is a bug fix rather than tidying. This block used to run
// on IMPORT: server.js imports createBackup for its auto-daily job, so every server boot fell
// through to the `else` branch and wrote a full copy of the DB. That is where 27 of the 30 backups
// in this directory came from — they are restarts, not backups, and at 116 MB each they were the
// entire 442 MB. A module with a side effect at import time cannot be imported safely.
const isEntryPoint = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isEntryPoint) {
  const args = process.argv.slice(2);
  // The checkpoint state is shown, not buried in the manifest: a backup that may be missing WAL data
  // restores just as cleanly as a complete one, so the only place a reader can be warned is here.
  const flag = (e) => e.walCheckpointed === true ? "complete"
    : e.walCheckpointed === false ? "UNVERIFIED-WAL" : "unknown-wal";
  if (args[0] === "list") {
    const entries = listBackups();
    if (!entries.length) { console.log("No backups found."); }
    else entries.forEach((e, i) => console.log(
      `${i+1}. ${e.filename}  (${e.label})  ${e.created}  ${mb(e.size || 0)}  ` +
      `${flag(e)}${e.integrity && e.integrity !== "ok" ? `  integrity=${e.integrity}` : ""}` +
      `${e.schema ? `  schema=${e.schema}` : ""}`));
  } else if (args[0] === "verify") {
    const entries = verifyBackups();
    entries.forEach((e, i) => console.log(
      `${i+1}. ${e.filename}  integrity=${e.integrity}  ${flag(e)}` +
      `${e.schema ? `  schema=${e.schema}` : ""}`));
    console.log(`[verify] ${entries.length} backup(s) checked; manifest updated`);
  } else if (args[0] === "restore") {
    if (!args[1]) { console.error("Usage: node scripts/backup.js restore <filename>"); process.exit(1); }
    restoreBackup(args[1]);
  } else {
    createBackup(args[0] || "manual");
  }
}

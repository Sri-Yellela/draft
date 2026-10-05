#!/usr/bin/env node
/**
 * D16 — re-encode stored application résumés, and (optionally) backfill copies. DRY RUN BY DEFAULT.
 *
 * Every copy services/applicationArtifacts.js writes is already brotli. This is for the others:
 *   · rows stored in another encoding ('identity' when APPLICATION_ARTIFACT_ENCODING=identity, or
 *     'gzip') are re-encoded to the chosen one. Each is decoded, re-encoded and the NEW body decoded
 *     and hash-checked BEFORE its UPDATE; a row that does not decode is REPORTED, never rewritten.
 *   · --backfill copies the résumé onto recorded/verified applications that have none (recorded
 *     before D16). ⚠ Those copies are labelled `backfill`, not `snapshot_at_record`: they are the
 *     résumé as it stands NOW, which a regeneration may have changed since the application.
 *
 * ⛔ Never run against production without the owner's go. It prints the database it opened.
 *
 * Usage: node scripts/d16CompressArtifacts.mjs [--db <path>] [--backfill] [--apply]
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compressArtifacts } from "../services/applicationArtifacts.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const APPLY = args.includes("--apply");
const BACKFILL = args.includes("--backfill");
const dbPath = path.resolve(val("--db") || path.join(ROOT, "data", "resume_master.db"));

const db = new Database(dbPath, { fileMustExist: true });
console.log(`[d16] database: ${dbPath}${APPLY ? "" : "  (DRY RUN — nothing is written; --apply to write)"}`);
const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='application_artifacts'").get();
if (!has) { console.error("[d16] application_artifacts does not exist — boot the server once (migration 125) first."); process.exit(2); }
const run = () => compressArtifacts(db, { apply: APPLY, backfill: BACKFILL });
const out = APPLY ? db.transaction(run)() : run();
const kb = (n) => (n / 1024).toFixed(1);
console.log(`[d16] target encoding ${out.target}: ${out.reencoded} row(s) ${APPLY ? "re-encoded" : "would be re-encoded"} — ${kb(out.before)} KB → ${kb(out.after)} KB`);
if (BACKFILL) console.log(`[d16] backfill: ${out.backfillCandidates} record(s) without a copy; ${APPLY ? `${out.backfilled} copied` : "none copied (dry run)"}`);
if (out.corrupt.length) {
  console.error(`[d16] ⛔ ${out.corrupt.length} CORRUPT row(s), left untouched:`);
  for (const c of out.corrupt) console.error(`   artifact ${c.id} (record ${c.recordId}): ${c.message}`);
  process.exitCode = 1;
}
db.close();

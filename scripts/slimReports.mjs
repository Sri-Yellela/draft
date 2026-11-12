#!/usr/bin/env node
// scripts/slimReports.mjs — ⭐ A187 Stage 0 (46i) · step (4): turn existing FULL rows in ats_only_reports into slim rows
// (services/atsReportRead.js slimOf), in short keyset pages, then optionally VACUUM to give the space back.
//
//   node scripts/slimReports.mjs --db <path to resume_master.db> [--page 2000] [--vacuum] [--dry-run]
//
// A REHEARSAL TOOL: run it on a COPY (staging's fixture) to measure time, the longest write transaction and the size
// won. On production the server must be stopped or this must run inside it (one writer) — the owner's window.
// Readers handle slim rows whatever ATS_STORE_SLIM says (they expand once), so a slimmed database is safe to serve.
// VACUUM rewrites the whole file: it needs about the file's size free on the volume and holds the write lock throughout.
import fs from "node:fs";
import Database from "better-sqlite3";
import { slimOf } from "../services/atsReportRead.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const DB = arg("--db", null);
if (!DB || !fs.existsSync(DB)) { console.error("usage: --db <path to resume_master.db> (a COPY)"); process.exit(2); }
const PAGE = Number(arg("--page", 2000));
const size = () => fs.statSync(DB).size + (fs.existsSync(`${DB}-wal`) ? fs.statSync(`${DB}-wal`).size : 0);
const mb = (n) => `${Math.round(n / 1048576)} MB`;

const db = new Database(DB);
db.pragma("busy_timeout = 5000");
db.pragma("wal_checkpoint(TRUNCATE)");   // the file alone, measured with every committed page in it
const before = size();
const stats0 = db.prepare("SELECT COUNT(*) n, SUM(LENGTH(ats_report)) bytes FROM ats_only_reports").get();
console.log(`before: ${stats0.n} rows, ${mb(stats0.bytes || 0)} of report JSON, file ${mb(before)}`);
const page = db.prepare("SELECT id, ats_report FROM ats_only_reports WHERE id > ? ORDER BY id LIMIT ?");
const upd = db.prepare("UPDATE ats_only_reports SET ats_report = ? WHERE id = ?");
let after = 0, changed = 0, kept = 0, longest = 0;
const t0 = Date.now();
for (;;) {
  const rows = page.all(after, PAGE);
  if (!rows.length) break;
  after = rows[rows.length - 1].id;
  const t = Date.now();
  if (!has("--dry-run")) db.transaction(() => {
    for (const r of rows) {
      let rep; try { rep = JSON.parse(r.ats_report); } catch { kept++; continue; }
      if (!rep || typeof rep !== "object" || rep.slim === 1) { kept++; continue; }
      upd.run(JSON.stringify(slimOf(rep)), r.id); changed++;
    }
  })();
  longest = Math.max(longest, Date.now() - t);
}
db.pragma("wal_checkpoint(TRUNCATE)");
const stats1 = db.prepare("SELECT SUM(LENGTH(ats_report)) bytes FROM ats_only_reports").get();
console.log(`slimmed ${changed} rows (${kept} already slim / unreadable) in ${Date.now() - t0} ms; longest write transaction ${longest} ms (page ${PAGE})`);
console.log(`report JSON now ${mb(stats1.bytes || 0)}; file ${mb(size())} (SQLite keeps the freed pages until VACUUM)`);
if (has("--vacuum")) {
  const t = Date.now();
  db.exec("VACUUM");
  db.pragma("wal_checkpoint(TRUNCATE)");   // in WAL mode the rewritten file lands in the -wal first
  console.log(`VACUUM ${Date.now() - t} ms → file ${mb(size())} (was ${mb(before)})`);
}
db.close();

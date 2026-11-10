#!/usr/bin/env node
// ⭐ D187 HB-7 · THE TERMINATION PATH (Hirebase's terms §11): every Hirebase-sourced posting removed, the landing table
// emptied, and any application snapshot of such a posting reduced to employer + title + date. Run on a COPY first:
//   node scripts/hirebasePurge.mjs <path-to-resume_master.db> [--yes]
// Without --yes it only COUNTS what it would remove.
import Database from "better-sqlite3";
import { DERIVED_TABLES } from "../services/jobs/postingArchive.js";

export function purgeHirebase(db, { dryRun = true } = {}) {
  const count = (sql) => db.prepare(sql).pluck().get();
  const plan = {
    postings: count("SELECT COUNT(*) FROM scraped_jobs WHERE source = 'hirebase'"),
    raw: count("SELECT COUNT(*) FROM hirebase_raw"),
    snapshots: count("SELECT COUNT(*) FROM apply_run_jobs WHERE job_id LIKE 'hirebase::%' AND (posting_description IS NOT NULL OR posting_url IS NOT NULL OR posting_location IS NOT NULL)"),
  };
  if (dryRun) return { dryRun: true, ...plan };
  db.transaction(() => {
    db.prepare("UPDATE apply_run_jobs SET posting_description = NULL, posting_url = NULL, posting_location = NULL WHERE job_id LIKE 'hirebase::%'").run();
    // every per-posting table derived from the posting (the archive's own list), then the postings themselves
    const has = (t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t)
      && db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === "job_id");
    for (const t of DERIVED_TABLES.filter(has)) db.prepare(`DELETE FROM ${t} WHERE job_id IN (SELECT job_id FROM scraped_jobs WHERE source = 'hirebase')`).run();
    db.prepare("DELETE FROM scraped_jobs WHERE source = 'hirebase'").run();
    db.prepare("DELETE FROM hirebase_raw").run();
  })();
  return { dryRun: false, ...plan };
}

if (/hirebasePurge\.mjs$/.test(process.argv[1] || "")) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node scripts/hirebasePurge.mjs <db> [--yes]"); process.exit(2); }
  const db = new Database(file);
  console.log(JSON.stringify(purgeHirebase(db, { dryRun: !process.argv.includes("--yes") })));
  db.close();
}

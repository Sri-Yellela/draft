// ⭐ D151 Rule 4 (45s) · d151ArchiveClosedPostings — the nightly archive of closed postings: only closed, older than 120 days,
// named by no person's history and no other posting's duplicate_of; moved whole, its derived rows with it; small slices;
// behind its switch (OFF). The reference audit is a guard: every table carrying a posting id must be classified.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setSetting } from "../services/appSettings.js";
import { USER_REF_TABLES, DERIVED_TABLES, DERIVED_BY_ROW_ID, LOG_TABLES, ARCHIVE_SETTING, ARCHIVE_AFTER_DAYS, SLICE_ROWS,
  archiveEnabled, archiveSlice, restorePosting, referencedJobIds } from "../services/jobs/postingArchive.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DAY = 86400;
const NOW = 1_800_000_000;
function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'ada', 'x')").run();
  return db;
}
const post = (db, jobId, { active = 0, seen = NOW - 200 * DAY, duplicateOf = null } = {}) =>
  Number(db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, scraped_at, duplicate_of)
    VALUES (?, 'q', 'Northwind', 'Data Engineer', ?, ?, ?, ?)`).run(jobId, `h-${jobId}`, active, seen, duplicateOf).lastInsertRowid);

test("d151ArchiveClosedPostings (the audit): every table carrying a posting's id is classified — a person's history, derived, or a log", () => {
  const db = freshDb();
  const known = new Set([...USER_REF_TABLES, ...DERIVED_TABLES, ...DERIVED_BY_ROW_ID, ...LOG_TABLES]);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all();
  const carrying = tables.filter(t => !["scraped_jobs", "scraped_jobs_archive"].includes(t)
    && db.prepare(`PRAGMA table_info(${JSON.stringify(t)})`).all().some(c => c.name === "job_id" || c.name === "posting_id"));
  assert.deepEqual(carrying.filter(t => !known.has(t)), [], "a new table names postings — put it in USER_REF_TABLES (keeps the posting) or DERIVED_TABLES");
  assert.ok(carrying.length >= 40);
});

test("d151ArchiveClosedPostings: only closed > 120 days and unreferenced; moved whole with its derived rows; restorable; OFF by default", () => {
  const db = freshDb();
  assert.equal(archiveEnabled(db), false);
  const old = post(db, "old-free");
  post(db, "old-applied");
  db.prepare("INSERT INTO user_jobs (user_id, job_id) VALUES (1, 'old-applied')").run();
  const canon = post(db, "old-canonical");
  post(db, "dup-active", { active: 1, seen: NOW, duplicateOf: canon });
  post(db, "recent-closed", { seen: NOW - (ARCHIVE_AFTER_DAYS - 5) * DAY });
  post(db, "active-old", { active: 1 });
  db.prepare("INSERT INTO job_tag_places (job_id, country) VALUES ('old-free', 'US')").run();
  db.prepare("INSERT INTO atlas_posting_match (posting_id, vocab, matched_at) VALUES (?, '', 0)").run(old);
  assert.ok(referencedJobIds(db).has("old-applied"));
  const r = archiveSlice(db, { now: NOW });
  assert.equal(r.moved, 1, "only the one no one points at");
  const left = db.prepare("SELECT job_id FROM scraped_jobs ORDER BY job_id").pluck().all();
  assert.deepEqual(left, ["active-old", "dup-active", "old-applied", "old-canonical", "recent-closed"]);
  assert.equal(db.prepare("SELECT COUNT(*) FROM job_tag_places WHERE job_id = 'old-free'").pluck().get(), 0, "derived rows go with it");
  assert.equal(db.prepare("SELECT COUNT(*) FROM atlas_posting_match WHERE posting_id = ?").pluck().get(old), 0);
  const kept = JSON.parse(db.prepare("SELECT row_json FROM scraped_jobs_archive WHERE job_id = 'old-free'").pluck().get());
  assert.equal(kept.title, "Data Engineer", "the whole row, as JSON");
  assert.equal(restorePosting(db, "old-free"), true);
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = 'old-free'").pluck().get(), 0, "back, closed as it was");
  setSetting(db, ARCHIVE_SETTING, true);
  assert.equal(archiveEnabled(db), true);
});

test("d151SmallWriteTransactions: a slice moves at most SLICE_ROWS, resuming from the last row id", () => {
  const db = freshDb();
  for (let i = 0; i < SLICE_ROWS + 20; i++) post(db, `old-${i}`);
  const a = archiveSlice(db, { now: NOW });
  assert.equal(a.moved, SLICE_ROWS); assert.equal(a.done, false);
  const b = archiveSlice(db, { now: NOW, afterId: a.lastId });
  assert.equal(b.moved, 20); assert.equal(b.done, true);
  const server = read("server.js");
  assert.match(server, /registerJob\("posting_archive", async \(\{ payload, deadline \}\) => \{\n  if \(!archiveEnabled\(db\)\) return \{ done: true \};[\s\S]{0,200}deadline \}\);/);
  // the deadline: out of time after the first row → it stops there, and the next slice resumes at the row it left
  for (let i = 0; i < 3; i++) post(db, `late-${i}`);
  let t = 0;
  const c = archiveSlice(db, { now: NOW, afterId: b.lastId, deadline: 1, clock: () => ++t });
  assert.equal(c.moved, 1); assert.equal(c.done, false);
  assert.equal(archiveSlice(db, { now: NOW, afterId: c.lastId }).moved, 2, "resumed at the row it left");
  assert.match(server, /enqueueJob\(db, "posting_archive", `nightly:\$\{d\.toISOString\(\)\.slice\(0, 10\)\}`/);
  assert.match(read("scripts/migrations.js"), /id: "265_posting_archive"/);
});

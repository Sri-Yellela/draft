// services/jobs/postingArchive.js — ⭐ D151 RULE 4 (45s) · THE NIGHTLY ARCHIVE OF CLOSED POSTINGS: "closed postings older than
// D78's 120 days move to an archive table nightly, so the hot set stays the size of what users can apply to".
//
// ⛔ THE REFERENCE AUDIT (45s, on the 80k-active copy): 42 tables carry a posting's job_id. A posting is archived ONLY when
// no person's history points at it — applications, résumés, picks, packets, messages, feed posts, alerts, captures… —
// (USER_REF_TABLES, read once per slice as one set of ids, never a scan per row) and no other posting names it as its
// canonical (duplicate_of). Its per-posting DERIVED rows (taxonomy, tech, ghost, role map, places, page keys, the Atlas match,
// the ATS form cache, the public-open row) go with it — each is recomputed from the posting if it ever comes back. A log
// that only mentions it (usage_events) is left as it is. test/d151ArchiveClosedPostings.test.js derives every job_id table
// from the migrations and fails when a new one is in neither list.
//
// The archive keeps the WHOLE row as JSON (scraped_jobs_archive, migration 265), so it never breaks when scraped_jobs gains a
// column; restorePosting puts it back. Runs in the job system (D151 Rule 2) in slices of ≤ SLICE_ROWS, each in ONE short
// write transaction (Rule 4: small writes), behind app_settings posting_archive_enabled (OFF until the owner turns it on).
import { getSetting, settingTruthy } from "../appSettings.js";

export const ARCHIVE_SETTING = "posting_archive_enabled";
export const ARCHIVE_AFTER_DAYS = 120;
export const SLICE_ROWS = 100;   // 45s, measured on the 80k copy: ≈ 1.5 ms a row (17 indexes, the triggers, 12 derived tables) — 500 held the thread 0.4–1 s
export const archiveEnabled = (db) => settingTruthy(getSetting(db, ARCHIVE_SETTING));

/** Tables whose rows are a PERSON's history — a posting any of them names is never archived. */
export const USER_REF_TABLES = Object.freeze([
  "resumes", "resume_versions", "job_applications", "user_job_views", "user_jobs", "apply_run_jobs", "apply_job_logs", "rejected_jobs",
  "apply_gate_packets", "ats_only_reports", "daily_drafts", "application_records", "draft_slot_uses", "job_captures", "ats_corpus_grades",
  "byom_briefs", "mcp_audit", "answer_history", "extension_resume_generations", "resume_pdf_artifacts", "picks",
  "picks_left_out", "practice_submissions", "trial_demo_tailoring", "ats_gold_items", "application_signals", "network_messages",
  "match_alerts", "network_posts", "imported_jobs",
  "trial_drafts",   // 46c: A167's trial (migration 267) — the jobs a person spent a trial draft on
]);
/** Per-posting rows derived from the posting itself — removed with it (keyed by job_id, or by the row id for the Atlas). */
export const DERIVED_TABLES = Object.freeze([
  "job_role_map", "enrichment_batch_rows", "job_tag_places", "job_page_keys", "job_ghost", "job_company", "job_tech", "job_tech_scan",
  "job_taxonomy", "posting_application_schemas", "public_open_jobs",
  "posting_input_hashes",   // 46d: A176 (migration 269) — the posting's kept A85 input hash
]);
export const DERIVED_BY_ROW_ID = Object.freeze(["atlas_posting_match", "atlas_posting_dirty"]);
/** Logs that mention a posting and keep their row (the id simply stops resolving). 45s: job_history was first listed as a
 * person's history — on the 80k copy it named EVERY posting (one row each), so nothing could ever be archived. */
export const LOG_TABLES = Object.freeze(["usage_events", "job_history"]);   // job_history is BUILT to outlive its posting (D107: a repost is recognised after the posting is gone)

const DAY = 86400;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const hasTable = (db, t) => !!safe(() => db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(t), null);
const hasColumn = (db, t, c) => safe(() => db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c), false);

/** Every job id a person's history holds (one read per table; these tables are per-person sized, not board sized). */
export function referencedJobIds(db) {
  const out = new Set();
  for (const t of USER_REF_TABLES) {
    if (!hasTable(db, t) || !hasColumn(db, t, "job_id")) continue;
    for (const id of safe(() => db.prepare(`SELECT DISTINCT job_id FROM ${t} WHERE job_id IS NOT NULL`).pluck().all(), [])) out.add(String(id));
  }
  return out;
}

/** The next closed, old, unreferenced postings after `afterId` (by row id), at most `limit`. */
export function archiveCandidates(db, { now = Math.floor(Date.now() / 1000), afterId = 0, limit = SLICE_ROWS, referenced = null } = {}) {
  const cut = now - ARCHIVE_AFTER_DAYS * DAY;
  const refs = referenced || referencedJobIds(db);
  const rows = db.prepare(`SELECT id, job_id FROM scraped_jobs
      WHERE id > ? AND is_active = 0 AND scraped_at < ? AND (retired_at IS NULL OR retired_at < ?)
      ORDER BY id LIMIT ?`).all(afterId, cut, cut, limit * 2);
  const canon = db.prepare(`SELECT 1 FROM scraped_jobs WHERE duplicate_of = ? LIMIT 1`);
  const out = [];
  let lastId = afterId, seen = 0;   // the cursor is the last row EXAMINED — never past a candidate left for the next slice
  for (const r of rows) {
    if (out.length >= limit) break;
    seen++; lastId = r.id;
    if (refs.has(String(r.job_id))) continue;
    if (canon.get(r.id)) continue;
    out.push(r);
  }
  return { rows: out, lastId, more: seen < rows.length || rows.length === limit * 2 };
}

/** One slice: ≤ SLICE_ROWS postings into the archive, in ONE transaction, stopping at `deadline` (ms). → { moved, lastId, done }. */
export function archiveSlice(db, { now = Math.floor(Date.now() / 1000), afterId = 0, limit = SLICE_ROWS, deadline = Infinity, clock = Date.now } = {}) {
  const { rows, lastId: scanned, more } = archiveCandidates(db, { now, afterId, limit });
  let lastId = scanned, cut = false;
  if (!rows.length) return { moved: 0, lastId, done: !more };
  const derived = DERIVED_TABLES.filter(t => hasTable(db, t) && hasColumn(db, t, "job_id"));
  const byRow = DERIVED_BY_ROW_ID.filter(t => hasTable(db, t));
  const get = db.prepare(`SELECT * FROM scraped_jobs WHERE id = ?`);
  const put = db.prepare(`INSERT OR REPLACE INTO scraped_jobs_archive (job_id, archived_at, row_json) VALUES (?, ?, ?)`);
  const delD = derived.map(t => db.prepare(`DELETE FROM ${t} WHERE job_id = ?`));
  const delR = byRow.map(t => db.prepare(`DELETE FROM ${t} WHERE posting_id = ?`));
  const del = db.prepare(`DELETE FROM scraped_jobs WHERE id = ?`);
  let moved = 0;
  db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // Out of time: stop here, and resume at this row next slice (the cursor sits just before it).
      if (i > 0 && clock() >= deadline) { lastId = rows[i - 1].id; cut = true; break; }
      const row = get.get(r.id);
      if (!row) continue;
      put.run(String(row.job_id), now, JSON.stringify(row));
      for (const s of delD) s.run(row.job_id);
      for (const s of delR) s.run(row.id);
      moved += del.run(row.id).changes;
    }
  })();
  return { moved, lastId, done: !more && !cut };
}

/** Put an archived posting back (closed, as it was). → true when restored. */
export function restorePosting(db, jobId) {
  const a = db.prepare(`SELECT row_json FROM scraped_jobs_archive WHERE job_id = ?`).get(String(jobId));
  if (!a) return false;
  const row = JSON.parse(a.row_json);
  const cols = db.prepare(`PRAGMA table_info(scraped_jobs)`).all().map(c => c.name).filter(c => c in row);
  db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO scraped_jobs (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map(c => row[c]));
    db.prepare(`DELETE FROM scraped_jobs_archive WHERE job_id = ?`).run(String(jobId));
  })();
  return true;
}

/** Admin's numbers: archived so far, and the switch. (No board-sized count on a request.) */
export function archiveState(db) {
  return { enabled: archiveEnabled(db), afterDays: ARCHIVE_AFTER_DAYS,
    archived: safe(() => db.prepare(`SELECT COUNT(*) FROM scraped_jobs_archive`).pluck().get(), 0),
    lastRun: safe(() => db.prepare(`SELECT status, slices, duration_ms, finished_at FROM bg_jobs WHERE kind = 'posting_archive' ORDER BY id DESC LIMIT 1`).get(), null) };
}

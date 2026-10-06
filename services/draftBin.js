// ── D53 · CLEAR → A 7-DAY RECYCLE BIN → PURGED (owner, 10-07) ──────────────────────────────────────────
//
// What already existed, found before building (the row said "find it and build on it"): Draft House's
// Remove is DELETE /api/apply/run-jobs/:id, and it was ALREADY a soft hide — `hidden_at`, stopping a
// pending run first (AC4). It was not a hard delete. What it lacked: a way back, a purge, and the same
// behaviour in every unsent state (Remove from the line and Stop CANCELLED instead, with no way back).
//
//   APPLIED (submitted)        not clearable — it is history; The Table keeps it. Hiding it from Draft
//                              House stays AC4's soft hide and is NEVER binned or purged.
//   NOT APPLIED, cleared       hidden_at + purge_after = now + 7 days → in the bin, restorable
//   past purge_after           invisible at READ time (the filter below), and scrubbed by the sweep
//
// ⛔ The purge is a MECHANISM, not only a policy (A57's lesson): the read-time filter hides an expired
// item even when the sweep is late, and the sweep carries the brake cleanup_log id 85 lacked — dry run
// by default, a ceiling it refuses past, and a log of what it purged.
// ⛔ Clear is not Pass: it writes no pass and trains nothing. It removes the QUEUE ENTRY, never the
// posting (D43).
// ⚠ What a purge removes: the run-job's prepared answers and blanks, its handoff packets (the answers
// the extension would fill — a home address, eligibility), and its screenshot. The row itself stays as
// a scrubbed tombstone, because apply_runs keeps stored counters over it (AC4). The résumé is NOT the
// bin's: it is the board's résumé for that job (the resumes table), deleted there.
import fs from "node:fs";
import { markPending, releaseDraftRecord } from "./applicationRecords.js";

export const BIN_DAYS = 7;
const DAY = 86400;
/** The sweep refuses to purge more than this in one pass — a wrong clock or a bad filter stops here. */
export const PURGE_CEILING = 500;

const nowSec = () => Math.floor(Date.now() / 1000);

/** The read-time filter: in the bin = cleared, not yet past its date, not yet purged. */
export const IN_BIN_SQL = "rj.hidden_at IS NOT NULL AND rj.purge_after IS NOT NULL AND rj.purge_after > ? AND rj.purged_at IS NULL";

/** Clearable = never sent. A submitted application is history. */
export const isClearable = (status) => status !== "submitted";

/**
 * Put rows in the bin (the caller has already stopped any that were still pending). Submitted rows are
 * refused, never binned. Releases each job's Draft record, so its Draft button frees and it leaves /d.
 * @returns {{ cleared: number[], refused: number[] }}
 */
export function binRunJobs(db, userId, runJobIds, { now = nowSec() } = {}) {
  const cleared = [], refused = [];
  const get = db.prepare("SELECT id, job_id, status FROM apply_run_jobs WHERE id=? AND user_id=?");
  const set = db.prepare(`UPDATE apply_run_jobs SET hidden_at=COALESCE(hidden_at, ?), purge_after=? WHERE id=? AND user_id=?
    AND status <> 'submitted'`);
  const jobs = new Set();
  db.transaction(() => {
    for (const id of runJobIds) {
      const rj = get.get(Number(id), userId);
      if (!rj || !isClearable(rj.status)) { refused.push(Number(id)); continue; }
      set.run(now, now + BIN_DAYS * DAY, rj.id, userId);
      cleared.push(rj.id); jobs.add(String(rj.job_id));
    }
  })();
  for (const j of jobs) { try { releaseDraftRecord(db, userId, j); } catch {} }
  return { cleared, refused };
}

/** The bin, newest first, with the days left. */
export function listBin(db, userId, { now = nowSec() } = {}) {
  let rows;
  try {
    rows = db.prepare(`SELECT rj.id, rj.run_id, rj.job_id, rj.status, rj.reason_code, rj.hidden_at, rj.purge_after,
        COALESCE(sj.title, rj.posting_title) AS title, COALESCE(sj.company, rj.posting_company) AS company
      FROM apply_run_jobs rj LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.user_id = ? AND ${IN_BIN_SQL} ORDER BY rj.hidden_at DESC, rj.id DESC`).all(userId, now);
  } catch { return []; }   // a database without migration 130
  return rows.map(r => ({
    id: r.id, runId: r.run_id, jobId: r.job_id, title: r.title ?? null, company: r.company ?? null,
    status: r.status, reasonCode: r.reason_code ?? null,
    clearedAt: r.hidden_at * 1000, purgeAfter: r.purge_after * 1000,
    purgesInDays: Math.max(0, Math.ceil((r.purge_after - now) / DAY)),
    // A row that was still running when it was cleared was STOPPED by the clear; it comes back stopped,
    // and Retry starts it again. Everything else comes back exactly as it was.
    stoppedByClear: r.status === "cancelled",
  }));
}

/** Restore one item to its exact prior state; its Draft record comes back with it. */
export function restoreFromBin(db, userId, runJobId, { now = nowSec() } = {}) {
  const rj = db.prepare(`SELECT rj.id, rj.run_id, rj.job_id, rj.status FROM apply_run_jobs rj WHERE rj.id=? AND rj.user_id=? AND ${IN_BIN_SQL}`)
    .get(Number(runJobId), userId, now);
  if (!rj) return { ok: false, code: "not_in_bin" };
  db.prepare("UPDATE apply_run_jobs SET hidden_at=NULL, purge_after=NULL WHERE id=? AND user_id=?").run(rj.id, userId);
  if (rj.status !== "cancelled") { try { markPending(db, userId, String(rj.job_id), "drafted"); } catch {} }
  return { ok: true, id: rj.id, runId: rj.run_id, jobId: rj.job_id, status: rj.status };
}

function scrub(db, ids, now) {
  const screenshots = [];
  const sel = db.prepare("SELECT screenshot_path FROM apply_run_jobs WHERE id=?");
  db.transaction(() => {
    for (const id of ids) {
      const p = sel.get(id)?.screenshot_path; if (p) screenshots.push(p);
      db.prepare("DELETE FROM apply_gate_packets WHERE run_job_id=?").run(id);
      db.prepare(`UPDATE apply_run_jobs SET answers_json=NULL, blanks_json=NULL, screenshot_path=NULL,
        reason_detail=NULL, purged_at=?, purge_after=COALESCE(purge_after, ?) WHERE id=?`).run(now, now, id);
    }
  })();
  for (const p of screenshots) { try { fs.unlinkSync(p); } catch {} }
}

/** "Delete now" — one item out of the bin, purged at once. */
export function purgeNow(db, userId, runJobId, { now = nowSec() } = {}) {
  const rj = db.prepare(`SELECT rj.id FROM apply_run_jobs rj WHERE rj.id=? AND rj.user_id=? AND ${IN_BIN_SQL}`).get(Number(runJobId), userId, now);
  if (!rj) return { ok: false, code: "not_in_bin" };
  scrub(db, [rj.id], now);
  return { ok: true, id: rj.id };
}

/**
 * The sweep. ⛔ DRY RUN BY DEFAULT — it reports what it would purge and touches nothing. With
 * dryRun:false it purges, unless the count exceeds `ceiling`, in which case it REFUSES and purges none.
 * Every real pass (and every refusal) writes a cleanup_log row naming what it did.
 */
export function purgeSweep(db, { now = nowSec(), dryRun = true, ceiling = PURGE_CEILING } = {}) {
  let due;
  try {
    due = db.prepare(`SELECT id FROM apply_run_jobs WHERE hidden_at IS NOT NULL AND purge_after IS NOT NULL
      AND purge_after <= ? AND purged_at IS NULL AND status <> 'submitted' ORDER BY id`).pluck().all(now);
  } catch { return { dryRun, due: 0, purged: 0, refused: false, ids: [] }; }
  const log = (details) => { try { db.prepare("INSERT INTO cleanup_log (jobs_deleted, orphans_cleaned, details) VALUES (0, 0, ?)").run(JSON.stringify(details)); } catch {} };
  if (dryRun) return { dryRun: true, due: due.length, purged: 0, refused: false, ids: due };
  if (due.length > ceiling) {
    log({ kind: "draft_bin_purge", refused: true, due: due.length, ceiling });
    return { dryRun: false, due: due.length, purged: 0, refused: true, ids: [] };
  }
  if (due.length) scrub(db, due, now);
  log({ kind: "draft_bin_purge", refused: false, purged: due.length, runJobIds: due });
  return { dryRun: false, due: due.length, purged: due.length, refused: false, ids: due };
}

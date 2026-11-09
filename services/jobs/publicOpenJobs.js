// services/jobs/publicOpenJobs.js — ⛔ A158 (45r, 11-09) · THE OPEN PUBLIC BOARD, ONE SMALL ROW PER POSTING.
//
// Migration 262's triggers keep public_open_jobs right on every write from the moment it exists. This walk copies in the
// postings that were already open before it: rowid pages read on the offload worker (services/db/offloadWorker.js — the
// read is the expensive part: is_active / duplicate_of / board_category sit after `description` in the row), the small
// rows written here with INSERT OR IGNORE (a trigger's newer row is never overwritten). Once done it records
// `public_open_jobs_backfilled` in app_settings and never walks again.
import { nextRowidRange } from "./rowidWalk.js";

export const OPEN_ROW_SQL = `is_active = 1 AND duplicate_of IS NULL AND board_category IS NOT NULL AND board_category <> 'held'`;
export const DONE_KEY = "public_open_jobs_backfilled";
export const PAGE_ROWS = 500, PAUSE_MS = 25;

/** The walk's read half (the offload worker runs it): the open postings in rowid range (from, from + rows]. */
export function publicOpenRange(db, from, rows = PAGE_ROWS) {
  const range = nextRowidRange(db, from, rows);
  const found = range.to > from ? db.prepare(`SELECT job_id, id, company, title, COALESCE(updated_at, discovered_at) AS t
      FROM scraped_jobs WHERE rowid > ? AND rowid <= ? AND ${OPEN_ROW_SQL}`).all(range.from, range.to) : [];
  return { to: range.to, more: range.more, rows: found.map(r => [r.job_id, r.id, r.company, r.title, r.t]) };
}

export function writePublicOpen(db, rows) {
  const put = db.prepare(`INSERT OR IGNORE INTO public_open_jobs (job_id, id, company, title, t) VALUES (?, ?, ?, ?, ?)`);
  db.transaction(() => { for (const r of rows) put.run(...r); })();
  return rows.length;
}

export function isBackfilled(db) {
  try { return db.prepare("SELECT value FROM app_settings WHERE key = ?").pluck().get(DONE_KEY) === "1"; } catch { return false; }
}

/**
 * @param {object} [o]
 * @param {(args: {from: number, rows: number}) => Promise<ReturnType<typeof publicOpenRange>>} [o.offload]
 *   the read on the offload worker; when it rejects the walk reads here in small pages (100 rows), paced.
 */
export function createPublicOpenBackfill(db, { offload = null, pauseMs = PAUSE_MS, log = console } = {}) {
  let status = { state: "idle", pages: 0, copied: 0, mode: offload ? "offload" : "inline", startedAt: null, finishedAt: null, error: null, maxWriteMs: 0 };
  let running = null;
  function run(trigger = "manual") {
    if (running) return running;
    if (isBackfilled(db)) { status = { ...status, state: "done" }; return Promise.resolve({ ...status }); }
    status = { ...status, state: "running", trigger, pages: 0, copied: 0, startedAt: new Date().toISOString(), error: null };
    let useOffload = !!offload, from = 0;
    running = new Promise((resolve) => {
      const finish = (error) => {
        if (!error) { try { db.prepare("INSERT INTO app_settings (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = unixepoch()").run(DONE_KEY); } catch (e) { error = e; } }
        status = { ...status, state: error ? "failed" : "done", finishedAt: new Date().toISOString(), error: error ? error.message : null };
        running = null;
        if (error) log.error?.(`[public-open] backfill failed at rowid ${from} (the next run resumes from the start; INSERT OR IGNORE):`, error.message);
        else log.log?.(`[public-open] (${trigger}) ${status.copied} open postings copied in ${status.pages} pages (${status.mode})`);
        resolve({ ...status });
      };
      const step = () => {
        const page = useOffload ? offload({ from, rows: PAGE_ROWS }) : Promise.resolve().then(() => publicOpenRange(db, from, 100));
        page.then((r) => {
          const tw = Date.now();
          if (r.rows.length) writePublicOpen(db, r.rows);
          status = { ...status, pages: status.pages + 1, copied: status.copied + r.rows.length, maxWriteMs: Math.max(status.maxWriteMs, Date.now() - tw) };
          const done = !r.more || r.to <= from;
          from = r.to;
          if (done) return finish(null);
          setTimeout(step, pauseMs);
        }).catch((e) => {
          if (useOffload) {
            log.warn?.(`[public-open] offload unavailable (${e.message}) — continuing on the main thread in small pages`);
            useOffload = false; status = { ...status, mode: "inline" };
            return setTimeout(step, pauseMs);
          }
          finish(e);
        });
      };
      setTimeout(step, 0);
    });
    return running;
  }
  return { run, get running() { return !!running; }, status: () => ({ ...status }) };
}

// services/jobs/rowidWalk.js — ⛔ A123 (8) (11-05) · A WHOLE-BOARD PASS WALKS THE BOARD IN ROWID RANGES, WITH A YIELD
// BETWEEN THEM.
//
// Production's 66297c3 boot (11-05 00:16Z) spent 41 of its 44 s to ready in two warm-up steps that found NOTHING to do:
// the provenance backfill (18.7 s, no "backfilled" line) and the first tag slice (22.5 s, no tag / level / description
// line). Each was one statement over all 84k postings, and every column those statements read (is_active,
// enrichment_provenance, tag_basis, level_read_basis, LENGTH(description)) sits AFTER `description` in the row, so
// SQLite walks every row's overflow chain from a cold volume. The 5f3c35f boot measured them at 90 ms / 1.4 s only
// because its one-time scraped_at index build had just read the whole table into the page cache.
//
// A range of `rows` consecutive rowids is a primary-key range read: bounded work, whatever the board's size.
// `{ from, to }` is (from, to]; `more` says whether rows exist past `to`.
export function nextRowidRange(db, from, rows) {
  const start = Number(from) || 0;
  const to = db.prepare("SELECT rowid AS r FROM scraped_jobs WHERE rowid > ? ORDER BY rowid LIMIT 1 OFFSET ?").get(start, Math.max(1, rows) - 1)?.r
    ?? db.prepare("SELECT MAX(rowid) AS r FROM scraped_jobs").get().r ?? start;
  const more = db.prepare("SELECT 1 FROM scraped_jobs WHERE rowid > ? LIMIT 1").get(Math.max(to, start)) != null;
  return { from: start, to, more };
}

/** The SQL condition for a range (bound with `rangeParams`), or "" when there is no range. */
export const rangeSql = (range, alias = "") => (range ? ` AND ${alias}rowid > ? AND ${alias}rowid <= ?` : "");
export const rangeParams = (range) => (range ? [range.from, range.to] : []);

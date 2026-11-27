// ⭐ 47k (the zero-downtime lane, WARMUP_DEFER_TAGS=1) · the job_role_map backfill walked in JOB_ID ranges through the
// (job_id, is_active) index, one range's read + one transaction at a time, yielding to the event loop between ranges —
// so the requests that arrive right after ready interleave with it.
//
// ⛔ WHY NOT backfillRoleMapSliced (backfillRoleMap.js, a ROWID walk): production's first flagged boot (11-27, 84k
// postings) spent 25,961 ms in it after ready, pages answering in 2.9–6.6 s meanwhile. A rowid range searches the
// TABLE by rowid and fetches every row to test is_active, which sits after `description` (its overflow chain) — the
// very read A123 (9) built the (job_id, is_active) index to avoid. Here the range is on job_id with
// INDEXED BY that index: the walk reads the index alone and touches the table only for an unmapped row (the staging
// 250k fixture: 126 ranges, 140 ms in all).
//
// ⛔ Lives in its own file ON PURPOSE: backfillRoleMap.js is one of the classifier-fingerprint files
// (remapGeneralRoles.js CLASSIFIER_FILES) — any edit to it re-runs the 22k-row 'general' re-file on the next boot
// (34.8 s on 11-27's deploy). The decision and the insert are backfillRoleMap.js's own exports, never a copy.
import { UNMAPPED_SQL, backfillDecision, MATCHED_BY, MATCHED_BY_UNCLASSIFIED } from "./backfillRoleMap.js";
import { ACTIVE_JOB_INDEX } from "./rowidWalk.js";

// The index when the boot has built it (its warm-up step runs before ready); a database without it (a test's
// in-memory one) reads the same rows by the job_id key.
function indexedBy(db) {
  const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(ACTIVE_JOB_INDEX);
  return has ? ` INDEXED BY ${ACTIVE_JOB_INDEX}` : "";
}

/** The unmapped-posting read of UNMAPPED_SQL, bounded to after < job_id <= to. */
export function unmappedRangeSql(db) {
  return UNMAPPED_SQL.replace("FROM scraped_jobs sj", `FROM scraped_jobs sj${indexedBy(db)}`)
    .replace("\n  ORDER BY", "\n    AND sj.job_id > ? AND sj.job_id <= ?\n  ORDER BY");
}

/** One range: classify its unmapped active postings with backfillDecision and insert them in one transaction. */
export function backfillRoleMapRange(db, after, to) {
  const rows = db.prepare(unmappedRangeSql(db)).all(after, to);
  const byBucket = {};
  let skippedBlue = 0;
  const decisions = [];
  for (const row of rows) {
    const d = backfillDecision(row);
    if (d.action === "skip") { skippedBlue++; continue; }
    byBucket[d.roleKey] = (byBucket[d.roleKey] || 0) + 1;
    decisions.push({ row, ...d });
  }
  if (decisions.length) {
    const insert = db.prepare(`
      INSERT INTO job_role_map (job_id, role_key, role_family, domain, source_profile_id, confidence, matched_by)
      VALUES (?, ?, ?, ?, NULL, ?, ?)
    `);
    db.transaction(() => {
      for (const d of decisions) {
        insert.run(d.row.job_id, d.roleKey, d.roleKey, d.verdict.domain || null, d.verdict.confidence || 0,
          d.action === "fallback" ? MATCHED_BY_UNCLASSIFIED : MATCHED_BY);
      }
    })();
  }
  return { scanned: rows.length, candidates: decisions.length, skippedBlue, byBucket, inserted: decisions.length };
}

/**
 * The whole walk: job_id ranges of `rows` (boundaries read from the index), a yield between ranges. Resolves with the
 * summed summary — the same shape backfillRoleMap returns, plus `ranges`. A range is classified whole or not at all;
 * the board between ranges reads the rest soft-null (shown, unbucketed), as it does before any backfill.
 */
export function walkRoleMapBackfill(db, { rows = 2000, yieldFn = (fn) => setImmediate(fn) } = {}) {
  const total = { scanned: 0, candidates: 0, skippedBlue: 0, byBucket: {}, inserted: 0, ranges: 0 };
  const boundary = db.prepare(`SELECT job_id FROM scraped_jobs${indexedBy(db)} WHERE job_id > ? ORDER BY job_id LIMIT 1 OFFSET ?`).pluck();
  return new Promise((resolve, reject) => {
    let after = "";
    const step = () => {
      try {
        const to = boundary.get(after, Math.max(1, rows) - 1);   // null: this range runs to the end
        const r = backfillRoleMapRange(db, after, to ?? "￿");
        total.ranges++;
        for (const k of ["scanned", "candidates", "skippedBlue", "inserted"]) total[k] += r[k];
        for (const [k, n] of Object.entries(r.byBucket)) total.byBucket[k] = (total.byBucket[k] || 0) + n;
        if (to == null) return resolve(total);
        after = to;
        yieldFn(step);
      } catch (e) { reject(e); }
    };
    step();
  });
}

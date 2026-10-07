// services/jobs/remapGeneralRoles.js — ⛔ D74 · kept OUT of backfillRoleMap.js on purpose: that file may
// only INSERT (test/jobRoleMapBackfill.test.js holds it to that), and re-filing a row means retiring its
// old 'general' bucket. The one DELETE here is scoped to a classifier row (source_profile_id IS NULL)
// whose role_key is 'general', on a posting that has just been given its family in the same transaction.
"use strict";

import { ROLE_KEY_FALLBACK } from "./classifyJob.js";
import { backfillDecision } from "./backfillRoleMap.js";
// ── D74 · RE-FILE A 'general' ROW THE CLASSIFIER CAN NOW NAME ────────────────────────────────────
//
// D74 (10-07) added strong anchors the live boards showed were missing (services/jobClassifier.js,
// D74_STRONG_ANCHORS). The next crawl classifies a DROPPED posting afresh — it was never stored — but
// an already-stored posting whose text has not changed takes the crawl's cheap path and is never
// re-classified. So a row the old anchors filed under 'general' (which almost no profile's role_key
// maps to — invisible on every board) would stay there. This moves exactly those rows:
//
//   · ONLY a classifier row (source_profile_id IS NULL) whose bucket is 'general', on a posting with
//     no other classifier bucket — a profile-derived bucket is never touched;
//   · ONLY when classifyJob — the ingest path's own function — now returns a family (not 'general');
//   · one transaction; matched_by = REMAP_MATCHED_BY, so it is reversible:
//       UPDATE job_role_map SET role_key = 'general', role_family = 'general', matched_by = 'backfill_classifier_unclassified'
//        WHERE matched_by = 'd74_remap_general';
// Idempotent: after one pass the candidate set holds only rows the classifier still cannot name.
export const REMAP_MATCHED_BY = "d74_remap_general";

export const GENERAL_ONLY_SQL = `
  SELECT sj.job_id, sj.title, sj.company, sj.description
  FROM scraped_jobs sj
  JOIN job_role_map m ON m.job_id = sj.job_id AND m.role_key = '${ROLE_KEY_FALLBACK}' AND m.source_profile_id IS NULL
  WHERE sj.is_active = 1
    AND NOT EXISTS (SELECT 1 FROM job_role_map o WHERE o.job_id = sj.job_id AND o.role_key != '${ROLE_KEY_FALLBACK}' AND o.source_profile_id IS NULL)
  ORDER BY sj.job_id
`;

/**
 * @returns {{ scanned: number, candidates: number, moved: number, byBucket: Record<string, number> }}
 */
export function remapGeneralRows(db, { dryRun = false } = {}) {
  const rows = db.prepare(GENERAL_ONLY_SQL).all();
  const byBucket = {};
  const moves = [];
  for (const row of rows) {
    const d = backfillDecision(row);
    if (d.action !== "bucket" || d.roleKey === ROLE_KEY_FALLBACK) continue;
    byBucket[d.roleKey] = (byBucket[d.roleKey] || 0) + 1;
    moves.push({ row, ...d });
  }
  const base = { scanned: rows.length, candidates: moves.length, byBucket };
  if (dryRun || !moves.length) return { ...base, moved: 0 };
  const insert = db.prepare(`
    INSERT OR IGNORE INTO job_role_map (job_id, role_key, role_family, domain, source_profile_id, confidence, matched_by)
    VALUES (?, ?, ?, ?, NULL, ?, ?)
  `);
  const retire = db.prepare(`DELETE FROM job_role_map WHERE job_id = ? AND role_key = '${ROLE_KEY_FALLBACK}' AND source_profile_id IS NULL`);
  db.transaction(() => {
    for (const m of moves) {
      insert.run(m.row.job_id, m.roleKey, m.roleKey, m.verdict.domain || null, m.verdict.confidence || 0, REMAP_MATCHED_BY);
      retire.run(m.row.job_id);
    }
  })();
  return { ...base, moved: moves.length };
}

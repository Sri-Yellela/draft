// services/jobs/postingInputHashes.js — ⭐ A176 (46d) · THE POSTING SIDE OF "IS THIS STORED SCORE CURRENT", KEPT.
//
// A85's rule: a stored score is current only when its job_hash equals atsJobInputHash(the posting's inputs NOW) — the
// badge (presentedScore), the fit filter and the fit facet all ask it. In SQL that was ats_job_input_hash(title, company,
// category, description, skills_json, normalized_title, description_text, description_basis) PER ROW: measured 46d on the
// 100k fixture, the facets' fit count hashed 49k descriptions (each read through the row's overflow pages) — 9–10 s
// holding a read worker, the slowest statement left on the board's path.
//
// So the posting's hash is KEPT in posting_input_hashes (migration 269), and the questions read
// COALESCE(the kept hash, the computed one) — a posting with no kept hash is computed exactly as before.
//   · WRITTEN only here, by ONE statement on the writer connection that reads the row and hashes it (INSERT … SELECT
//     ats_job_input_hash(…)): the kept value is the hash of the row as it was at that write, never of an earlier read.
//   · DROPPED by migration 269's triggers on scraped_jobs — any UPDATE of a hash input, any INSERT (a REPLACE re-insert
//     included), any DELETE — in SQL, so every writer (the crawler's own connections too) invalidates it.
// Together: a kept hash is always the hash of the posting's current inputs, so COALESCE never changes an answer.
// postingInputHashSql (the COALESCE read) lives in boardFitPrecompute.js beside currentScoreSql, its reader.
import { ATS_JOB_INPUT_FIELDS, POSTING_TEXT_COLUMNS, ATS_INPUT_HASH_FN, registerScoreFreshness } from "./boardFitPrecompute.js";

const INPUTS = [...ATS_JOB_INPUT_FIELDS, ...POSTING_TEXT_COLUMNS];

/**
 * One slice of the fill: the next `scan` active postings after `afterJobId` (job_id order, index-only), and for those with
 * no kept hash, the hash written in batches of `batch` until `deadline`. Returns { done, lastJobId, filled, scanned }.
 * `done` when the walk reached the end of the board with every posting it saw filled.
 */
export function fillPostingInputHashes(db, { afterJobId = "", deadline = Date.now() + 200, scan = 2000, batch = 25 } = {}) {
  registerScoreFreshness(db);
  const window = db.prepare(`SELECT job_id FROM scraped_jobs WHERE is_active = 1 AND job_id > ? ORDER BY job_id LIMIT ?`)
    .pluck().all(String(afterJobId ?? ""), scan);
  if (!window.length) return { done: true, lastJobId: afterJobId, filled: 0, scanned: 0 };
  const has = db.prepare("SELECT 1 FROM posting_input_hashes WHERE job_id = ?").pluck();
  const missing = window.filter(id => !has.get(id));
  let filled = 0;
  let lastJobId = window[window.length - 1];
  for (let i = 0; i < missing.length; i += batch) {
    if (i > 0 && Date.now() >= deadline) {   // the first batch always runs, so a late slice still moves
      // Stop before this batch; resume just before its first id (job_ids are ordered; ids before it are filled or seen).
      const resumeAt = window.indexOf(missing[i]);
      return { done: false, lastJobId: resumeAt > 0 ? window[resumeAt - 1] : afterJobId, filled, scanned: resumeAt };
    }
    const ids = missing.slice(i, i + batch);
    filled += db.prepare(`INSERT OR REPLACE INTO posting_input_hashes (job_id, input_hash)
      SELECT sj.job_id, ${ATS_INPUT_HASH_FN}(${INPUTS.map(c => `sj.${c}`).join(", ")})
      FROM scraped_jobs sj WHERE sj.job_id IN (${ids.map(() => "?").join(",")})`).run(...ids).changes;
  }
  return { done: window.length < scan, lastJobId, filled, scanned: window.length };
}

/** How much of the active board has a kept hash (Admin / logs). */
export function postingInputHashCoverage(db) {
  const active = db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get();
  const kept = db.prepare(`SELECT COUNT(*) FROM posting_input_hashes pih JOIN scraped_jobs sj ON sj.job_id = pih.job_id
    WHERE sj.is_active = 1`).pluck().get();
  return { active, kept };
}

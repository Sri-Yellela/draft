// services/jobs/userReferences.js — D43 (10-06): A POSTING A USER HAS A RELATIONSHIP WITH IS NEVER
// HARD-DELETED. It is retired (is_active = 0) instead.
//
// Production held 4 user_jobs rows and 4 job_applications rows pointing at postings that no longer
// existed (O43, 10-06). The expiry cleanup's DELETE exempted only STARRED and APPLIED user_jobs rows,
// so an application record whose user_jobs flag was unset, a run-job, a capture, an application
// record in progress — or any other user_jobs row — lost its posting under it (cleanup_log id 85
// hard-deleted 1,288 rows in one pass). A record of something the user DID must not depend on a row
// the system can delete.
//
// ONE predicate, so every delete path (the expiry cleanup, the blue-collar reject, the reclassify
// script) asks the same question.

const REFERENCES = [
  ["user_jobs", "ur_uj", ""],
  ["job_applications", "ur_ja", ""],
  ["apply_run_jobs", "ur_rj", ""],
  ["application_records", "ur_ar", ""],
  ["job_captures", "ur_jc", " AND ur_jc.user_id IS NOT NULL"],
];

/**
 * SQL that is true when the posting named by `col` is referenced by any user's record.
 * `col` is a column expression from the caller's own query (e.g. "job_id" or "sj.job_id").
 * With `db`, only tables that exist are named — a fixture or an old database without one of them
 * still prepares; the full schema (every server) names all five.
 */
export function userReferencedSql(col = "job_id", db = null) {
  let have = null;
  if (db) {
    try { have = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name)); }
    catch { have = null; }
  }
  const parts = REFERENCES.filter(([t]) => !have || have.has(t))
    .map(([t, a, extra]) => `EXISTS (SELECT 1 FROM ${t} ${a} WHERE ${a}.job_id = ${col}${extra})`);
  return parts.length ? `(${parts.join(" OR ")})` : "(0)";
}

/** Is this one posting referenced by a user's record? A database missing a table answers per table. */
export function isUserReferenced(db, jobId) {
  const tables = [
    ["user_jobs", ""], ["job_applications", ""], ["apply_run_jobs", ""], ["application_records", ""],
    ["job_captures", " AND user_id IS NOT NULL"],
  ];
  for (const [t, extra] of tables) {
    try {
      if (db.prepare(`SELECT 1 FROM ${t} WHERE job_id = ?${extra} LIMIT 1`).get(String(jobId))) return true;
    } catch { /* a fixture without this table cannot reference the posting through it */ }
  }
  return false;
}

// services/adminJobReview.js
//
// A58 (b) — DB Inspector › Job Review: correct a posting's ROLE CLASSIFICATION, and nothing else.
//
// The route this replaces also ran `UPDATE user_jobs SET domain_profile_id = X / NULL WHERE job_id = ?
// AND applied = 0` — every user's unapplied Save or Pass on that posting. The board LEFT JOINs
// user_jobs on the ACTIVE profile (`uj.domain_profile_id = ?`), so a rewritten PASS stopped matching
// and the posting was dealt again, and a rewritten SAVE fell off that user's Saved tab. A Save or a
// Pass is the user's decision; an admin classifying a posting has no business moving it. Nothing here
// writes user_jobs, and test/adminStopHarmII.test.js refuses the statement in every admin route.
//
// "HIDE" WAS THE OPPOSITE OF ITS EFFECT. It deleted the posting's job_role_map rows. Since CC1b the
// board keeps a row when it matches the profile's bucket OR has no classification at all
// (`jrm.role_key IS NOT NULL OR NOT EXISTS (… job_role_map …)`, server.js), so an unclassified posting
// is shown on EVERY board, ranked as unknown. The control is now "Unclassify", and its confirm says so.
//
// EVERY WRITE IS LOGGED WITH THE VALUE IT REPLACED (admin_audit_log, migration 119), and the newest
// change to a posting can be undone from that record.

import { auditActorColumns } from "./actor.js";

export const JOB_REVIEW_ACTION = "job_review.reassign";
export const JOB_REVIEW_UNDO = "job_review.undo";

/** Who has a decision on this posting. Read-only; shown in the confirm before any write. */
export function jobReviewImpact(db, jobId) {
  const r = db.prepare(`
    SELECT COUNT(DISTINCT user_id) users, COALESCE(SUM(starred), 0) saved,
           COALESCE(SUM(disliked), 0) passed, COALESCE(SUM(applied), 0) applied
    FROM user_jobs WHERE job_id = ?
  `).get(jobId);
  return { usersReferencing: r.users, saved: r.saved, passed: r.passed, applied: r.applied };
}

function snapshot(db, jobId) {
  const sj = db.prepare("SELECT domain_profile_id FROM scraped_jobs WHERE job_id = ?").get(jobId);
  if (!sj) return null;
  const roleMap = db.prepare(`SELECT role_key, role_family, domain, source_profile_id, confidence, matched_by, created_at
                              FROM job_role_map WHERE job_id = ? ORDER BY role_key`).all(jobId);
  return { domainProfileId: sj.domain_profile_id ?? null, roleMap };
}

function writeState(db, jobId, state) {
  db.prepare("DELETE FROM job_role_map WHERE job_id = ?").run(jobId);
  const ins = db.prepare(`INSERT INTO job_role_map
      (job_id, role_key, role_family, domain, source_profile_id, confidence, matched_by, created_at)
    VALUES (@job_id, @role_key, @role_family, @domain, @source_profile_id, @confidence, @matched_by,
            COALESCE(@created_at, unixepoch()))`);
  for (const r of state.roleMap) ins.run({ created_at: null, ...r, job_id: jobId });
  db.prepare("UPDATE scraped_jobs SET domain_profile_id = ? WHERE job_id = ?").run(state.domainProfileId ?? null, jobId);
}

class JobReviewError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export { JobReviewError };

/**
 * Re-classify one posting: roleKey "unclassified" removes its role map (it then shows on every
 * board); any other key replaces it with one manual_review row. Writes job_role_map and
 * scraped_jobs.domain_profile_id ONLY, in one transaction with the audit row.
 */
export function reassignJob(db, { jobId, roleKey, domainProfileId = null, adminUserId = null, validRoleKeys }) {
  jobId = String(jobId || "").trim();
  roleKey = String(roleKey || "").trim().toLowerCase();
  if (!jobId) throw new JobReviewError(400, "jobId required");
  const before = snapshot(db, jobId);
  if (!before) throw new JobReviewError(404, "Job not found");
  let after;
  if (roleKey === "unclassified") {
    after = { domainProfileId: null, roleMap: [] };
  } else {
    if (!validRoleKeys?.has(roleKey)) throw new JobReviewError(400, "Invalid roleKey");
    let profile = null;
    if (domainProfileId) {
      profile = db.prepare("SELECT id, role_family, domain FROM domain_profiles WHERE id = ?").get(domainProfileId);
      if (!profile) throw new JobReviewError(400, "domainProfileId not found");
    }
    after = {
      domainProfileId: profile?.id ?? null,
      roleMap: [{ role_key: roleKey, role_family: profile?.role_family || roleKey, domain: profile?.domain || roleKey,
                  source_profile_id: profile?.id ?? null, confidence: 1.0, matched_by: "manual_review" }],
    };
  }
  const impact = jobReviewImpact(db, jobId);
  let logId;
  db.transaction(() => {
    writeState(db, jobId, after);
    const a = auditActorColumns(adminUserId);
    logId = db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(a.admin_user_id, a.actor_kind, a.actor, JOB_REVIEW_ACTION, jobId, JSON.stringify(before), JSON.stringify({ ...after, impact })).lastInsertRowid;
  })();
  return { ok: true, jobId, roleKey, domainProfileId: after.domainProfileId, logId: Number(logId), impact };
}

/**
 * Put a posting back the way one logged change found it. Only the NEWEST un-undone change to that
 * posting can be undone — undoing an older one would silently discard every change after it.
 */
export function undoJobReview(db, logId, { adminUserId = null } = {}) {
  const row = db.prepare("SELECT * FROM admin_audit_log WHERE id = ? AND action = ?").get(logId, JOB_REVIEW_ACTION);
  if (!row) throw new JobReviewError(404, `no job review change ${logId}`);
  if (row.undone_at) throw new JobReviewError(409, `change ${logId} was already undone`);
  const newer = db.prepare(`SELECT id FROM admin_audit_log WHERE action = ? AND target = ? AND id > ? AND undone_at IS NULL`)
    .get(JOB_REVIEW_ACTION, row.target, logId);
  if (newer) throw new JobReviewError(409, `change ${newer.id} to this posting is newer — undo that first`);
  if (!db.prepare("SELECT 1 FROM scraped_jobs WHERE job_id = ?").get(row.target)) {
    throw new JobReviewError(404, "the posting no longer exists");
  }
  const before = JSON.parse(row.before_json);
  const current = snapshot(db, row.target);
  db.transaction(() => {
    writeState(db, row.target, before);
    db.prepare("UPDATE admin_audit_log SET undone_at = unixepoch() WHERE id = ?").run(logId);
    const a = auditActorColumns(adminUserId);
    db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(a.admin_user_id, a.actor_kind, a.actor, JOB_REVIEW_UNDO, row.target, JSON.stringify(current), JSON.stringify({ ...before, undoes: logId }));
  })();
  return { ok: true, jobId: row.target, restored: before };
}

/** The recent changes, newest first — what the panel's Undo reads. */
export function recentJobReviewChanges(db, { limit = 20 } = {}) {
  return db.prepare(`SELECT id, at, admin_user_id, action, target, before_json, after_json, undone_at
                     FROM admin_audit_log WHERE action IN (?, ?) ORDER BY id DESC LIMIT ?`)
    .all(JOB_REVIEW_ACTION, JOB_REVIEW_UNDO, limit)
    .map(r => ({ ...r, before: JSON.parse(r.before_json || "null"), after: JSON.parse(r.after_json || "null") }));
}

// ── D104 P1 · ONE JOB'S ELIGIBILITY FOR ONE USER — the database side of shared/eligibility.js ──
//
// The posting's requirements are read from its own text NOW (shared/postingRequirements.js — the stored req_* columns
// carry only citizenship and clearance), and compared with the user's Application defaults (D101) and the degrees
// their profile states. Read-only.
import { postingRequirements } from "../shared/postingRequirements.js";
import { normalizePosting } from "../shared/postingNormalize.js";
import { eligibilityOf } from "../shared/eligibility.js";

export function userEligibilityInputs(db, userId) {
  let defaults = {};
  try { defaults = Object.fromEntries(db.prepare(`SELECT key, value FROM application_defaults WHERE user_id = ?`).all(userId).map(r => [r.key, r.value])); }
  catch { defaults = {}; }
  const degrees = [];
  try { degrees.push(...db.prepare(`SELECT degree FROM profile_education WHERE user_id = ?`).pluck().all(userId)); } catch { /* before 173 */ }
  try { const p = db.prepare(`SELECT highest_degree FROM user_profile WHERE user_id = ?`).pluck().get(userId); if (p) degrees.push(p); } catch {}
  return { defaults, degrees: degrees.filter(Boolean) };
}

/** @returns { status, reasons, missing, requirements } — `eligible` with no requirements when the posting is gone. */
export function eligibilityForJob(db, userId, jobId, inputs = null) {
  let row = null;
  try { row = db.prepare(`SELECT * FROM scraped_jobs WHERE job_id = ?`).get(String(jobId)); } catch { row = null; }
  if (!row?.description) return { status: "eligible", reasons: [], missing: [], requirements: null };
  const n = normalizePosting(row.description_full ?? row.description);
  const req = postingRequirements(n);
  const { defaults, degrees } = inputs || userEligibilityInputs(db, userId);
  return { ...eligibilityOf(req, defaults, degrees), requirements: req };
}

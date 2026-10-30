// ── D104 P1 · ONE JOB'S ELIGIBILITY FOR ONE USER — the database side of shared/eligibility.js ──
//
// The posting's requirements are read from its own text NOW (shared/postingRequirements.js — the stored req_* columns
// carry only citizenship and clearance), and compared with the user's Application defaults (D101) and the degrees
// their profile states. Read-only.
import { postingRequirements } from "../shared/postingRequirements.js";
import { normalizePosting } from "../shared/postingNormalize.js";
import { eligibilityOf } from "../shared/eligibility.js";
import { educationOf } from "./structuredProfile.js";

export function userEligibilityInputs(db, userId) {
  let defaults = {};
  try { defaults = Object.fromEntries(db.prepare(`SELECT key, value FROM application_defaults WHERE user_id = ?`).all(userId).map(r => [r.key, r.value])); }
  catch { defaults = {}; }
  // D112 d2: ONE degree — the Education section's highest (or the Profile's Change override). The old block's
  // user_profile.highest_degree is not read (migration 179 moved it into the section).
  const degree = educationOf(db, userId).degree;
  return { defaults, degrees: degree ? [degree] : [] };
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

/** True when the user has set anything a posting's requirement could contradict — otherwise nothing is computed. */
export function hasEligibilityInputs({ defaults = {}, degrees = [] } = {}) {
  return ["citizenship", "clearance", "sponsorship_now", "sponsorship_later"].some(k => defaults[k] != null) || degrees.length > 0;
}

/** One board row (scraped_jobs columns) → its eligibility for these inputs; the requirements read from its own text. */
export function eligibilityForRow(row, inputs) {
  const text = row?.description_full ?? row?.description;
  if (!text) return { status: "eligible", reasons: [], missing: [] };
  return eligibilityOf(postingRequirements(normalizePosting(text)), inputs.defaults, inputs.degrees);
}

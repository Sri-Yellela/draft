// ── D104 P1 · ONE JOB'S ELIGIBILITY FOR ONE USER — the database side of shared/eligibility.js ──
//
// The posting's requirements are read from its own text NOW (shared/postingRequirements.js — the stored req_* columns
// carry only citizenship and clearance), and compared with the user's Application defaults (D101) and the degrees
// their profile states. Read-only.
import { postingRequirements } from "../shared/postingRequirements.js";
import { normalizePosting } from "../shared/postingNormalize.js";
import { eligibilityOf } from "../shared/eligibility.js";
import { BASIS_FN } from "./jobs/descriptionText.js";
import { educationOf } from "./structuredProfile.js";
import { sponsorshipFactFor } from "./kb/sponsorshipFacts.js";

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
  const verdict = eligibilityOf(req, defaults, degrees);
  const context = eligibilityContext(db, row.company, { defaults });
  return { ...verdict, requirements: req, ...(context ? { context } : {}) };
}

/**
 * ⭐ D108 P3 · the employer's public sponsorship facts BESIDE the verdict, for a user who said they need sponsorship —
 * INFORMATION ONLY. ⛔ It never enters eligibilityOf and never changes `status`, `reasons` or `missing`: a posting that
 * says "no sponsorship" stays ineligible for that user even when the employer filed 290 LCAs (the posting's own words
 * win), and a filing record never makes a posting ineligible. Null when the user did not say they need sponsorship, or
 * the company has no safely-matched fact.
 * @returns {{ sponsorship: ReturnType<typeof sponsorshipFactFor> } | null}
 */
export function eligibilityContext(db, company, { defaults = {} } = {}) {
  if (!company || !(defaults.sponsorship_now === "yes" || defaults.sponsorship_later === "yes")) return null;
  let fact = null;
  try { fact = sponsorshipFactFor(db, company); } catch { fact = null; }
  return fact ? { sponsorship: fact } : null;
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

// ── D112 item 6 · THE DEMOTION ACROSS PAGES — the board's FIRST order key, read from the STORED requirement columns ──
//
// D104 P1 demoted an ineligible posting to the end of its own PAGE only; page 2 could still open with one. This key
// puts a posting LAST ON THE BOARD (1 sorts after 0) when its STORED requirements (descriptionText.js: req_citizenship,
// req_clearance, req_clearance_status) contradict an answer THIS user SET. Rules:
//   ⛔ Only the answers they set: no citizenship answer → no citizenship arm; nothing set → null, no key, the order is
//      byte-identical to before.
//   ⛔ The verdicts are eligibilityOf's own: every stored value is put through shared/eligibility.js, so the SQL and the
//      per-row mark cannot disagree on what a value means — this enumerates values, it never re-states the rule.
//   ⛔ Fresh only: req_* count while description_basis still matches the description (jobQuery.js ELIGIBILITY_FREE_SQL's
//      rule). A row not read yet, or read from an older description, is 0 — not demoted.
//   ⚠ Sponsorship and degree are NOT stored columns (postingRequirements reads them from the text at request time), so
//      they cannot order across pages without a migration; the board keeps D104's WITHIN-PAGE demotion for them.
// An ORDER BY key only: the WHERE (and so the count) is untouched. The key's params are signed into the cursor
// (jobCursor.orderSignature), so changing an answer refuses an old cursor instead of resuming in a different order.
const STORED_CITIZENSHIP = ["citizen_only", "us_person"];
const STORED_CLEARANCE = ["unspecified", "confidential", "public_trust", "secret", "top_secret", "ts_sci"];
const STORED_STATUS = ["active_required", "interim_ok", "ability_to_obtain", null];

/** @returns {{ sql: string, params: any[] } | null} — 1 = stored requirements rule this user out, 0 = otherwise. */
export function ineligibleOrderKey(defaults = {}) {
  const arms = [], params = [];
  const contradicts = (req, key) => eligibilityOf(req, { [key]: defaults[key] }, []).reasons.length > 0;
  if (defaults.citizenship != null) {
    const bad = STORED_CITIZENSHIP.filter(c => contradicts({ citizenship: c }, "citizenship"));
    if (bad.length) { arms.push(`sj.req_citizenship IN (${bad.map(() => "?").join(", ")})`); params.push(...bad); }
  }
  if (defaults.clearance != null) {
    for (const c of STORED_CLEARANCE) {
      const bad = STORED_STATUS.filter(s => contradicts({ clearance: c, clearanceStatus: s }, "clearance"));
      if (bad.length === STORED_STATUS.length) { arms.push("sj.req_clearance = ?"); params.push(c); }
      else for (const s of bad) { arms.push("(sj.req_clearance = ? AND sj.req_clearance_status IS ?)"); params.push(c, s); }
    }
  }
  if (!arms.length) return null;
  // The cheap column test first: the basis hash is computed only for a row that states a contradicting requirement.
  return {
    sql: `(CASE WHEN (${arms.join(" OR ")}) AND sj.description_basis IS NOT NULL AND sj.description_basis = ${BASIS_FN}(sj.description) THEN 1 ELSE 0 END)`,
    params,
  };
}

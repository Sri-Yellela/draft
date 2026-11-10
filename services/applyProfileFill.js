// services/applyProfileFill.js — ⭐ A179 F2 (owner 11-10: "even name and email says required, it filled nothing").
//
// WHAT WAS WRONG (46d, production logs 21:34Z + the code): a run's answers come ONLY from the person's user_profile row
// (buildAutofillPayload). The résumé fills that row at onboarding (A33's prefill + D186-1's extras) — once. An account
// whose row was never filled (a résumé from before A33 / D186, or one added from a job profile's own upload) reached the
// form with an EMPTY payload: the Sailor Health run found the Ashby form (13 controls), typed nothing, and the hold listed
// all 24 canonical fields — First Name, Email, Phone … — as "needs you", while the résumé held every one of them and the
// account held the email it signs in with.
//
// THE RULE (D186's, unchanged): automatic by default — a run first fills the profile's EMPTY fields from the active base
// résumé (fillEmptyProfileFields + fillExtras, the same writers onboarding uses: never overwriting a typed value, recorded
// "from your résumé"); a fictional sample résumé fills nothing except on a test account (A140 / D186-6). The account's
// sign-in email answers an empty profile email (in the payload only — it is the person's own address; nothing written).
// What still has no value is then caught BEFORE the browser opens (contactGaps), never reported field by field.
import { activeBaseResume } from "./baseResumeOnly.js";
import { fillEmptyProfileFields } from "./resumeOnboarding.js";
import { fillExtras, isTestAccount } from "./resumeSetup.js";
import { sampleIdForText } from "./sampleResumes.js";

const has = (v) => String(v ?? "").trim() !== "";
/** The fields a run cannot do without, and the ones a résumé usually holds (an empty one triggers the backfill). */
export const CONTACT_REQUIRED = Object.freeze(["full_name", "email"]);
const BACKFILL_TRIGGER = Object.freeze(["full_name", "first_name", "email", "phone", "city", "linkedin_url", "current_job_title", "university"]);

const tried = new Map();   // userId → the base résumé text length + head it was last backfilled from (one attempt per résumé)
const stamp = (text) => `${text.length}:${text.slice(0, 64)}`;

/**
 * The person's profile row as a run should read it: empty fields filled from the active base résumé (written, under
 * D186's rule), and the account email standing in for an empty profile email. Never throws; returns the row it was given
 * when nothing applies. `profile` must carry user_id.
 */
export function completeProfileForApply(db, profile) {
  const userId = profile?.user_id;
  if (userId == null) return profile;
  let row = profile;
  try {
    if (BACKFILL_TRIGGER.some(k => k in row && !has(row[k]))) {
      const text = String(activeBaseResume(db, userId)?.content || "");
      const key = stamp(text);
      const sampleBlocked = !!sampleIdForText(text) && !isTestAccount(db, userId);
      if (text.trim().length >= 200 && !sampleBlocked && tried.get(userId) !== key) {
        tried.set(userId, key);
        if (tried.size > 5000) tried.clear();
        const written = [...fillEmptyProfileFields(db, userId, text)];
        try { written.push(...fillExtras(db, userId, text)); } catch { /* the prefill's fields still stand */ }
        if (written.length) {
          console.log(`[apply] A179: profile filled from the résumé before the run — user=${userId} fields=${written.join(",")}`);
          row = db.prepare("SELECT * FROM user_profile WHERE user_id = ?").get(userId) || row;
        }
      }
    }
  } catch (e) { console.warn(`[apply] A179 backfill: ${e.message}`); }
  if (!has(row?.email)) {
    try {
      // The sign-in identity is users.username — an email address for an email / Google account.
      const account = db.prepare("SELECT username FROM users WHERE id = ?").pluck().get(userId);
      if (has(account) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(account).trim())) row = { ...row, email: String(account).trim() };
    } catch { /* no account email — contactGaps says so */ }
  }
  return row;
}

/** What a run cannot proceed without, after completeProfileForApply: [] when it can. */
export function contactGaps(profile) {
  const name = has(profile?.full_name) || (has(profile?.first_name) && has(profile?.last_name));
  return [...(name ? [] : ["full_name"]), ...(has(profile?.email) ? [] : ["email"])];
}

/** For tests: forget the one-attempt-per-résumé memo. */
export function _resetApplyProfileFill() { tried.clear(); }

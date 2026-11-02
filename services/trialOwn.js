// ⭐ A111 P4 · THE TRIAL'S "USE MY OWN RÉSUMÉ" PATHWAY (owner 11-02: "people would be more hands on and interested in it …
// when it works we can add the pathway to the trial. it should work end to end"). Behind app setting `trial_own_resume`
// (services/appSettings.js), OFF by default — off, nothing here is reachable and /try is today's sample-only page.
//
// The reading BEFORE anything is saved: the résumé's field (the same inference the onboarding uses —
// services/resumeOnboarding.js inferProfileFromResume, then D127's profileCategory) and whether that field has
// PICKS_PER_SAMPLE good picks today (services/trialPicks.js picksFor — the same rule a sample is offered by). ⛔ D127's
// red-flag rule: a field that is held, unknown or short of picks gets the honest "your field isn't live yet" and NOTHING
// is saved — no profile is made, so the board can never be read for a category it does not serve (a profile with no
// category would read the whole board). Only a live field goes on, through the normal onboarding (POST
// /api/domain-profiles/from-resume), exactly as a sample does. No model anywhere (D17).
import crypto from "node:crypto";
import { inferProfileFromResume } from "./resumeOnboarding.js";
import { profileCategory, CATEGORIES } from "./jobs/professionalScope.js";
import { picksFor, PICKS_PER_SAMPLE } from "./trialPicks.js";
import { isTrial, isOwnTrial } from "./trial.js";

/** The levels in plain words (shared/jobFilterOptions.js PROFILE_SENIORITY's four values). */
export const LEVEL_WORDS = Object.freeze({ junior: "entry level", mid: "mid level", senior: "senior", executive: "executive" });
/** D127's categories in the trial's plain words ("Business & finance"), never an internal key. */
export const FIELD_WORDS = Object.freeze({
  computing: "Computing & data", engineering: "Engineering", management: "Management & operations",
  business: "Business & finance", science: "Science & research", legal: "Legal",
  arts_media: "Design, media & communications", sales: "Sales", marketing: "Marketing",
});
/** The picks seniority for a profile's level (services/trialPicks.js LEVEL_FIT's three keys). */
export const picksSeniority = (s) => (["senior", "lead", "manager", "staff", "principal", "executive"].includes(s) ? "senior"
  : ["junior", "entry", "intern"].includes(s) ? "junior" : "mid");

const MIN_TEXT = 200;
const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("base64url").slice(0, 12);

/** The field in plain words: "Business & finance · Financial Analyst · mid level" (or null with no category). */
export function fieldWords({ category, title, seniority }) {
  if (!category) return null;
  return [FIELD_WORDS[category] || CATEGORIES[category]?.label || category, title || null, LEVEL_WORDS[seniority] || null].filter(Boolean).join(" · ");
}

/**
 * The résumé's reading for the trial, nothing saved: { field: { category, title, seniority, words, label }, live, picks,
 * reason } — reason "field_not_live" (held / unknown: no category) or "too_few_picks" (a live category short of 10 today).
 */
export async function readOwnResume(db, userId, { content, registry, now = Date.now() } = {}) {
  const text = String(content ?? "");
  if (text.trim().length < MIN_TEXT) {
    throw Object.assign(new Error("That résumé has too little text to read — try the PDF or Word file, or paste the whole résumé."), { status: 400, code: "resume_too_short" });
  }
  const inferred = inferProfileFromResume(text, registry);
  const category = profileCategory({ role_family: inferred.roleFamily, target_titles: inferred.titles, profile_name: inferred.profileName });
  const field = { category: category || null, title: inferred.titles?.[0] || null, seniority: inferred.seniority || null,
    label: category ? FIELD_WORDS[category] || category : null };
  field.words = fieldWords(field);
  if (!category) return { field, live: false, picks: 0, reason: "field_not_live" };
  const picks = await picksFor(db, { category, seniority: picksSeniority(inferred.seniority), resumeText: text, now,
    cacheKey: `own-read:${userId}:${hash(text)}` });
  const live = picks.length >= PICKS_PER_SAMPLE;
  return { field, live, picks: picks.length, reason: live ? null : "too_few_picks" };
}

/**
 * Admin → Trial's line for the pathway, written on every reading (live or not): the field only — category, level, live —
 * never the résumé's text (trial_events holds names and counts, D124). Server-side only; the client cannot post it.
 */
export function recordOwnReading(db, userId, reading) {
  if (!isTrial(db, userId)) return false;
  try {
    db.prepare("INSERT INTO trial_events (user_id, event, detail) VALUES (?, 'own_resume', ?)").run(userId, JSON.stringify({
      category: reading.field?.category || null, seniority: reading.field?.seniority || null, live: !!reading.live, picks: reading.picks ?? 0 }));
    return true;
  } catch { return false; }
}

/**
 * Admin → Trial: the own-résumé testers' fields. Every reading's latest per tester: { testers, live, notLive, byField:
 * { "Business & finance": n, "(field not read)": n }, rows: [{ userId, field, level, live, at }] }.
 */
export function ownResumeFields(db) {
  let rows = [];
  try {
    rows = db.prepare(`SELECT e.user_id, e.detail, e.created_at FROM trial_events e
      JOIN (SELECT user_id, MAX(id) id FROM trial_events WHERE event = 'own_resume' GROUP BY user_id) last ON last.id = e.id
      ORDER BY e.created_at DESC LIMIT 500`).all();
  } catch { rows = []; }
  const out = rows.map(r => { let d = {}; try { d = JSON.parse(r.detail || "{}"); } catch { /* unreadable */ }
    return { userId: r.user_id, field: d.category ? FIELD_WORDS[d.category] || d.category : "(field not read)", level: LEVEL_WORDS[d.seniority] || null,
      live: !!d.live, picks: d.picks ?? 0, at: r.created_at }; });
  const byField = {};
  for (const r of out) byField[r.field] = (byField[r.field] || 0) + 1;
  return { testers: out.length, live: out.filter(r => r.live).length, notLive: out.filter(r => !r.live).length, byField, rows: out.slice(0, 100) };
}

/** Is this account on the own-résumé pathway? (services/trial.js — the safety rule asks it there, without a cycle.) */
export { isOwnTrial };

// services/scopedAnswers.js — ⛔ D165 (3) · A SAVED SALARY ANSWER IS SCOPED PER ROLE + LOCATION.
//
// D165 R2 (owner 11-06): every answer the person gives during an *Ask me first* run is saved for next time,
// "scoped: per role / location for salary, global for eligibility". A salary is not a fact about the person the way
// a work-authorisation answer is: what they ask of a full-stack role in the US is not what they ask of a data role
// in London. So a salary-class answer is stored with the SCOPE of the job it was given for — the job's role (its
// job_role_map role key) and its location region — and a later fill picks the MOST SPECIFIC saved answer whose scope
// matches the job:
//   role + location (3) > role only (2, location left open) > location only (1) > neither (0).
// An entry that names a role or a location the job does not have never matches (a salary for data roles is not used
// for a full-stack posting). Eligibility, sponsorship and every other question stay in the GLOBAL store
// (services/customAnswers.js) — this module never touches them.
//
// Storage: user_profile.custom_answer_scoped (migration 222), a JSON array of
//   { question, answer, kind: "salary", roleKey: string|null, locationKey: string|null, savedAt: ISO }.
// One entry per (normalised question, roleKey, locationKey): saving again for the same scope replaces it.
// ⛔ USER-STATED ONLY, like the rest of the answer store: nothing here stores an answer the server worked out.
import { normaliseQuestion, SAVED_ANSWER_LIMITS } from "../shared/savedAnswers.js";
import { classifyLocation } from "./jobs/usLocation.js";
import { functionForRole } from "../shared/jobTagVocabulary.js";

// A question asking what the person wants to be paid. Broad on purpose (a missed salary question falls back to the
// global store, which is where it was before), but never a question ABOUT pay that is not asking for a number from
// them: "Are you comfortable with the posted pay range?" is a yes/no eligibility-style question and stays global.
const SALARY_RE = /\b(?:salary|compensation|pay|wages?|remuneration|hourly rate|day rate)\b/i;
const ASKING_RE = /\b(?:desired|expected|expectations?|requirements?|required|requested|target|minimum|ask(?:ing)?|what|how much|range|annual|base|hourly)\b/i;
const NOT_ASKING_RE = /^\s*(?:are|is|do|does|did|can|could|would|will|have|has)\b/i;

/** True when the question asks the person for the pay they want — the answers this module scopes. */
export function isSalaryQuestion(text) {
  const t = String(text ?? "").trim();
  if (!t || !SALARY_RE.test(t)) return false;
  if (NOT_ASKING_RE.test(t)) return false;
  // "Salary" / "Salary Requirement" alone is a label asking for a number.
  return ASKING_RE.test(t) || t.split(/\s+/).length <= 3;
}

/** The location region a job's salary answer is scoped to: "us" | "non_us" | "remote" | null (unknown). */
export function locationKeyOf(location) {
  const v = classifyLocation(location ?? null).verdict;
  if (v === "us") return "us";
  if (v === "non_us") return "non_us";
  if (v === "remote_unqualified") return "remote";
  return null;
}

/** The scope a job's answers are saved under / matched against. Pure: { roleKey, location } → keys. */
export function scopeOf({ roleKey = null, location = null } = {}) {
  return { roleKey: roleKey ? String(roleKey) : null, locationKey: locationKeyOf(location) };
}

// ⭐ D165 (5) · the inline question's "Use this for similar jobs (engineering, US) next time" names the scope the answer
// will be saved under — the same scopes `POST /api/apply/answers` saves it for (every held job blocked on the question).
const REGION_WORDS = Object.freeze({ us: "US", non_us: "outside the US", remote: "remote" });

/** One scope in plain words: "engineering, US" · "US" · "product" · null (open — no role, no location). */
export function scopeWords({ roleKey = null, locationKey = null } = {}) {
  const role = functionForRole(roleKey);
  const region = REGION_WORDS[locationKey] || null;
  return [role, region].filter(Boolean).join(", ") || null;
}

/**
 * The phrase for the scopes an answer will be saved under: one scope → its words; several → null with `several`
 * true (the answer is saved once per role and location); none worth naming → null.
 */
export function scopePhrase(scopes = []) {
  const words = [...new Set((scopes || []).map(scopeWords))];
  if (words.length === 1) return { phrase: words[0], several: false };
  return { phrase: null, several: words.length > 1 };
}

/** The scope of one posting, from the database: its role (the board's role map, not a profile's) and its location. */
export function jobAnswerScope(db, jobId) {
  if (jobId == null) return { roleKey: null, locationKey: null };
  try {
    const row = db.prepare(`
      SELECT sj.location,
             (SELECT m.role_key FROM job_role_map m WHERE m.job_id = sj.job_id AND m.source_profile_id IS NULL
               ORDER BY m.rowid LIMIT 1) AS role_key
        FROM scraped_jobs sj WHERE sj.job_id = ?`).get(String(jobId));
    return row ? scopeOf({ roleKey: row.role_key, location: row.location }) : { roleKey: null, locationKey: null };
  } catch { return { roleKey: null, locationKey: null }; }
}

/** The stored list, tolerating anything SQLite hands back (a malformed blob reads as empty; a fill never throws). */
export function readScoped(profile) {
  let v = profile?.custom_answer_scoped;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
  if (!Array.isArray(v)) return [];
  return v.filter(e => e && typeof e === "object" && typeof e.question === "string" && e.question.trim()
    && e.answer != null && String(e.answer).trim() && typeof e.answer !== "object")
    .map(e => ({ question: e.question, answer: String(e.answer), kind: e.kind || "salary",
      roleKey: e.roleKey ? String(e.roleKey) : null, locationKey: e.locationKey ? String(e.locationKey) : null,
      savedAt: e.savedAt || null }));
}

class ScopedAnswerError extends Error { constructor(code) { super(code); this.code = code; } }

/**
 * Save one salary answer for a scope. Replaces the entry for the same normalised question AND the same scope; an
 * entry for another scope is kept (that is the point). Returns { list, saved }.
 */
export function rememberScoped(list, { question, answer, roleKey = null, locationKey = null, now = new Date() } = {}) {
  const q = String(question ?? "").trim();
  const a = String(answer ?? "").trim();
  if (!q) throw new ScopedAnswerError("question_required");
  if (!a) throw new ScopedAnswerError("answer_required");
  if (q.length > SAVED_ANSWER_LIMITS.maxQuestionChars || a.length > SAVED_ANSWER_LIMITS.maxAnswerChars) throw new ScopedAnswerError("too_long");
  const k = normaliseQuestion(q);
  const r = roleKey ? String(roleKey) : null, l = locationKey ? String(locationKey) : null;
  const next = (list || []).filter(e => !(normaliseQuestion(e.question) === k && (e.roleKey ?? null) === r && (e.locationKey ?? null) === l));
  if (next.length >= SAVED_ANSWER_LIMITS.maxEntries) throw new ScopedAnswerError("too_many");
  const saved = { question: q, answer: a, kind: "salary", roleKey: r, locationKey: l, savedAt: now.toISOString() };
  next.push(saved);
  return { list: next, saved };
}

/** Remove one entry (the Saved-answers surface). Returns the list without it; unchanged when there is none. */
export function forgetScoped(list, { question, roleKey = null, locationKey = null } = {}) {
  const k = normaliseQuestion(question);
  return (list || []).filter(e => !(normaliseQuestion(e.question) === k && (e.roleKey ?? null) === (roleKey ?? null)
    && (e.locationKey ?? null) === (locationKey ?? null)));
}

/** How specifically an entry's scope matches a job's: -1 = not at all; else 3 (role+location) … 0 (open). */
export function specificity(entry, scope = {}) {
  if (entry.roleKey && entry.roleKey !== (scope.roleKey ?? null)) return -1;
  if (entry.locationKey && entry.locationKey !== (scope.locationKey ?? null)) return -1;
  // Role weighs more than location, so role-only beats location-only: 2 bits, role the high one.
  return (entry.roleKey ? 2 : 0) + (entry.locationKey ? 1 : 0);
}

/**
 * The fill path's pick for one job: for every saved question, the most specific matching entry (newest on a tie);
 * plus `salary` — the single best salary answer for the job whatever its wording, which the salary field handler uses
 * (an employer's "Desired compensation" is the same question as another's "Salary requirement").
 * Returns { answers: { [question]: answer }, salary: { answer, question, roleKey, locationKey, specificity } | null }.
 */
export function resolveScoped(list, scope = {}) {
  const best = new Map();
  let salary = null;
  for (const e of list || []) {
    const s = specificity(e, scope);
    if (s < 0) continue;
    const k = normaliseQuestion(e.question);
    const cur = best.get(k);
    if (!cur || s > cur.s || (s === cur.s && String(e.savedAt || "") > String(cur.e.savedAt || ""))) best.set(k, { e, s });
    if (!salary || s > salary.specificity || (s === salary.specificity && String(e.savedAt || "") > String(salary.savedAt || ""))) {
      salary = { answer: e.answer, question: e.question, roleKey: e.roleKey, locationKey: e.locationKey, specificity: s, savedAt: e.savedAt };
    }
  }
  const answers = {};
  for (const { e } of best.values()) answers[e.question] = e.answer;
  return { answers, salary };
}

/** Does the job's scoped pick answer this question? (A salary question is answered by any matching salary entry.) */
export function scopedResolves(resolvedScoped, question) {
  if (!resolvedScoped) return false;
  if (isSalaryQuestion(question) && resolvedScoped.salary) return true;
  const want = normaliseQuestion(question);
  return Object.keys(resolvedScoped.answers || {}).some(q => normaliseQuestion(q) === want);
}

/**
 * Apply the job's scoped pick to an autofill payload: the literal answers join custom_answers (a scoped answer beats a
 * global one for the same question — it was given for this kind of job), and a salary entry that matched the job's
 * role or location (specificity > 0) fills the salary handler ahead of the Profile's one desired_salary. An open-scope
 * entry (0) only fills when the Profile has no salary.
 */
export function withScopedAnswers(payload, list, scope) {
  if (!payload || typeof payload !== "object" || !list?.length) return payload;
  const r = resolveScoped(list, scope);
  if (!Object.keys(r.answers).length) return payload;
  const custom = { ...(payload.custom_answers || {}) };
  for (const [q, a] of Object.entries(r.answers)) {
    const k = normaliseQuestion(q);
    for (const existing of Object.keys(custom)) if (normaliseQuestion(existing) === k) delete custom[existing];
    custom[q] = a;
  }
  const handler = { ...(payload.handler_map || {}) };
  if (r.salary && (r.salary.specificity > 0 || !handler.salary)) handler.salary = r.salary.answer;
  return { ...payload, custom_answers: custom, handler_map: handler };
}

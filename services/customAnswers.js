/**
 * Custom answers — the store of answers only the candidate can write (AF1).
 *
 * WHY THIS MODULE EXISTS
 * `user_profile.custom_answers` has always been a flat map of `question text -> answer`, resolved by
 * buildAnswers() at its exact tier. That works for questions whose wording is the same everywhere
 * ("How did you hear about us?") and fails for the ones that name the employer: a stored answer to
 * "Why do you want to join Figma?" is dead weight at every other company, so the store never filled
 * up and every run held on the same questions.
 *
 * So a stored question may carry a `{company}` placeholder. It is expanded against the employer of
 * the run before it ever reaches buildAnswers, which means the resolver still sees nothing but a
 * flat map of literal question text and its exact-match guarantee is untouched — there is no second
 * matching path and no new way for an answer to reach a question it does not answer.
 *
 * THE ONE THING THIS MUST NOT DO
 * A template plus a company name is not an answer to a motivation question. "Why do you want to
 * join {company}?" answered generically and interpolated per employer is precisely the invented
 * claim §7 forbids — it puts words in the candidate's mouth about a company they may never have
 * read about. So a motivation-class template is WITHHELD from the resolver and surfaced as a draft
 * for the candidate to edit. Only their own per-company override is ever submitted.
 *
 * Non-motivation templates are different in kind and are expanded normally: "Have you ever worked
 * for {company} before?" -> "No" is a fact about the candidate, not a claim about the employer.
 */

import { normaliseText } from "./applyAutomation.js";
import {
  normaliseQuestion, templateQuestion, questionKey, SAVED_ANSWER_LIMITS,
} from "../shared/savedAnswers.js";

/** The placeholder a stored question/answer uses to stand in for the employer's name. */
export const COMPANY_TOKEN = "{company}";

// Matched case-insensitively and tolerant of inner whitespace, because this is typed by hand in a
// settings form: "{Company}" and "{ company }" are the same intent.
//
// TWO regexes, and the duplication is deliberate: `.test()` on a /g/ regex advances lastIndex, so a
// single shared global would return true, then false, then true for the same string. Only `replace`
// gets the global flag.
const COMPANY_TOKEN_TEST = /\{\s*company\s*\}/i;
const COMPANY_TOKEN_RE = /\{\s*company\s*\}/gi;

/**
 * Motivation questions — the ones answered in the candidate's own voice.
 *
 * Deliberately broad. A false positive costs a draft the candidate edits; a false negative
 * auto-submits manufactured enthusiasm to a real employer, which is the failure this exists to
 * prevent. When in doubt, withhold.
 */
const MOTIVATION_PATTERNS = [
  /\bwhy\b[^?]*\b(join|work|apply|applying|interested|interest|want|choose|chose)\b/i,
  /\bwhat\b[^?]*\b(interests?|excites?|draws?|attracts?|appeals?)\b/i,
  /\bmotivat/i,
  /\bwhy (are|do|did) you\b/i,
  /\bexcites? you\b/i,
  /\btell us why\b/i,
];

/** True when the question is one whose answer is the candidate's voice, not a fact about them. */
export function isMotivationQuestion(text) {
  const t = String(text ?? "");
  if (!t) return false;
  return MOTIVATION_PATTERNS.some(re => re.test(t));
}

/** True when the stored question/answer is parameterised by the employer. */
export function isTemplate(text) {
  return COMPANY_TOKEN_TEST.test(String(text ?? ""));
}

/** The key a per-company override is stored under. Normalised so casing/spacing cannot miss. */
export function companyKey(company) {
  return normaliseText(company);
}

/** Substitute the employer's name for every `{company}` placeholder. */
export function expandCompany(text, company) {
  return String(text ?? "").replace(COMPANY_TOKEN_RE, String(company ?? ""));
}

/**
 * Read the two columns that make up the store, tolerating anything SQLite hands back.
 * A malformed blob degrades to empty rather than throwing — this runs inside a live apply run.
 */
export function readAnswerStore(profile) {
  const parse = (raw) => {
    if (raw && typeof raw === "object") return raw;
    try {
      const v = JSON.parse(raw || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  };
  const answers = parse(profile?.custom_answers);
  const overrides = parse(profile?.custom_answer_overrides);
  // Only string values are answers. A nested object here would otherwise reach buildAnswers and be
  // stringified into "[object Object]" and typed into an employer's form.
  const flatAnswers = {};
  for (const [q, a] of Object.entries(answers)) {
    if (a === null || a === undefined) continue;
    if (typeof a === "object") continue;
    flatAnswers[String(q)] = String(a);
  }
  const cleanOverrides = {};
  for (const [company, byQuestion] of Object.entries(overrides)) {
    if (!byQuestion || typeof byQuestion !== "object" || Array.isArray(byQuestion)) continue;
    const inner = {};
    for (const [q, a] of Object.entries(byQuestion)) {
      if (a === null || a === undefined || typeof a === "object") continue;
      inner[String(q)] = String(a);
    }
    if (Object.keys(inner).length) cleanOverrides[companyKey(company)] = inner;
  }
  return { answers: flatAnswers, overrides: cleanOverrides };
}

/**
 * Resolve the store for one employer.
 *
 * Returns both halves of the decision, because the caller needs each for a different surface:
 *   answers  — flat `question -> answer`, ready for buildAnswers. Literal text only.
 *   withheld — motivation templates that were NOT answered, each with the expanded draft the
 *              candidate edits. These become open questions rather than silent omissions.
 *
 * Precedence, strongest first:
 *   1. a per-company override (the candidate wrote this, for this employer)
 *   2. a literal stored question (no placeholder — wording is the same everywhere)
 *   3. an expanded non-motivation template
 * A motivation template never reaches 3.
 */
export function resolveForCompany(store, company) {
  const { answers, overrides } = store || { answers: {}, overrides: {} };
  const key = companyKey(company);
  const perCompany = (key && overrides[key]) || {};
  const known = !!key;

  const resolved = {};
  const withheld = [];

  // 2. Literal questions first, so an override can overwrite them below.
  for (const [q, a] of Object.entries(answers)) {
    if (isTemplate(q)) continue;
    if (a === "") continue;
    // An answer may itself name the company even when the question does not.
    if (isTemplate(a) && !known) continue;
    resolved[q] = expandCompany(a, company);
  }

  // 3. Templates, expanded — but only when we actually know who the employer is. Without a company
  //    an expanded question is a lie about what was asked, so the entry is simply skipped.
  for (const [q, a] of Object.entries(answers)) {
    if (!isTemplate(q)) continue;
    if (!known) continue;
    const expandedQ = expandCompany(q, company);
    const override = perCompany[q] ?? perCompany[expandedQ];
    if (override !== undefined && override !== "") {
      resolved[expandedQ] = expandCompany(override, company);
      continue;
    }
    if (isMotivationQuestion(q)) {
      // The draft is the generic answer expanded — a starting point, explicitly not an answer.
      withheld.push({
        question: expandedQ,
        template: q,
        draft: a === "" ? "" : expandCompany(a, company),
        reason: "motivation_needs_own_words",
      });
      continue;
    }
    if (a === "") continue;
    resolved[expandedQ] = expandCompany(a, company);
  }

  // 1. Overrides for questions that are not templates at all — a per-company answer to a question
  //    whose wording never varies. Highest precedence by construction: applied last.
  for (const [q, a] of Object.entries(perCompany)) {
    if (a === "") continue;
    if (Object.prototype.hasOwnProperty.call(answers, q) && isTemplate(q)) continue; // handled above
    resolved[expandCompany(q, company)] = expandCompany(a, company);
  }

  return { answers: resolved, withheld };
}

/**
 * D55 (f): does a resolved map answer this question? By normalised text — the comparison buildAnswers
 * itself makes — so a stored "Why Figma?" counts as answering a form's "Why Figma? *". Exact words
 * only; this is never a containment test.
 */
export function resolvesQuestion(resolved, question) {
  if (Object.prototype.hasOwnProperty.call(resolved || {}, question)) return true;
  const want = normaliseQuestion(question);
  if (!want) return false;
  return Object.keys(resolved || {}).some(q => normaliseQuestion(q) === want);
}

class RememberError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

/**
 * D55 (f) · "SAVE THIS ANSWER FOR NEXT TIME?" — record an answer the CANDIDATE gave, for reuse.
 *
 * ⛔ USER-STATED ONLY. Nothing in the server calls this with an answer it worked out itself: the
 * only callers are the routes that receive what the candidate typed or picked (Draft House's
 * questions, the review overlay, Settings → Saved answers).
 *
 *   scope 'all'     — reused at every employer. The employer's name in the question is templated as
 *                     `{company}`, so "Have you worked for Figma before?" is stored once as
 *                     "Have you worked for {company} before?" and matches at Linear by exact words.
 *                     One question has ONE entry: an existing entry with the same normalised template
 *                     is replaced, not duplicated.
 *   scope 'company' — this employer only (a per-company override). What a motivation question
 *                     always gets: "why {company}" answered once and interpolated everywhere is the
 *                     invented claim the module header forbids, so 'all' is narrowed to 'company'.
 *
 * Returns { store, saved: { scope, question, company?, templated?, narrowed? } }. Throws a
 * RememberError (code: question_required | answer_required | too_long | company_required | too_many).
 */
export function rememberAnswer(store, { question, answer, company = null, scope = "all" } = {}) {
  const q = String(question ?? "").trim();
  const a = String(answer ?? "").trim();
  if (!q) throw new RememberError("question_required");
  if (!a) throw new RememberError("answer_required");
  if (q.length > SAVED_ANSWER_LIMITS.maxQuestionChars || a.length > SAVED_ANSWER_LIMITS.maxAnswerChars) {
    throw new RememberError("too_long");
  }
  const answers = { ...(store?.answers || {}) };
  const overrides = {};
  for (const [c, byQ] of Object.entries(store?.overrides || {})) overrides[c] = { ...byQ };
  const key = companyKey(company);

  let applied = scope === "company" ? "company" : "all";
  let narrowed = null;
  if (applied === "all" && isMotivationQuestion(q)) { applied = "company"; narrowed = "motivation_needs_own_words"; }

  if (applied === "company") {
    if (!key) throw new RememberError("company_required");
    const byQ = overrides[key] || {};
    const k = questionKey(q, company);
    for (const existing of Object.keys(byQ)) if (questionKey(existing, company) === k) delete byQ[existing];
    byQ[q] = a;
    overrides[key] = byQ;
    return { store: { answers, overrides }, saved: { scope: "company", company: key, question: q, ...(narrowed ? { narrowed } : {}) } };
  }

  const stored = key ? templateQuestion(q, company) : q;
  const k = normaliseQuestion(stored);
  for (const existing of Object.keys(answers)) if (normaliseQuestion(existing) === k) delete answers[existing];
  if (Object.keys(answers).length >= SAVED_ANSWER_LIMITS.maxEntries) throw new RememberError("too_many");
  answers[stored] = a;
  return { store: { answers, overrides }, saved: { scope: "all", question: stored, templated: stored !== q } };
}

/** The flat map buildAnswers consumes. */
export function effectiveCustomAnswers(store, company) {
  return resolveForCompany(store, company).answers;
}

/** The motivation drafts a run should hold on rather than invent. */
export function withheldTemplates(store, company) {
  return resolveForCompany(store, company).withheld;
}

/**
 * The five questions the Figma posting actually asked (AF1 requirement 5), seeded as WORDINGS with
 * no answers.
 *
 * Seeding an answer would defeat the point of the module: three of these are the candidate's own
 * facts and one is their voice. A blank answer never resolves — buildAnswers skips it — so the run
 * still holds, exactly as it does today. What the seed buys is that the settings surface names the
 * five questions the candidate has to answer once, instead of them being rediscovered one held run
 * at a time.
 */
export const SEED_QUESTIONS = [
  { question: "Why do you want to join {company}?", answer: "" },
  { question: "From where do you intend to work?", answer: "" },
  { question: "Have you ever worked for {company} before?", answer: "" },
  { question: "Have you worked as a full-time software engineer (excluding internships)?", answer: "" },
  { question: "Years of professional experience", answer: "" },
];

/** Add any seed wording the store does not already have. Never overwrites an existing answer. */
export function seedQuestions(answers) {
  const next = { ...(answers || {}) };
  for (const { question, answer } of SEED_QUESTIONS) {
    if (!Object.prototype.hasOwnProperty.call(next, question)) next[question] = answer;
  }
  return next;
}

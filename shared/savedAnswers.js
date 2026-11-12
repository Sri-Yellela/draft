// ── D55 (f) · SAVED ANSWERS AND THE EEO DECLINE — the pure half, shared by server and client ──────────
//
// docs/AUTOFILL_TARGET.md §8.1 rows 4–7 and 18, §8.2 items 1–2. Everything here is deterministic and
// local: no model call, nothing sent anywhere (D17). The resolver that USES these lives in
// services/applyAutomation.js (buildAnswers) and services/customAnswers.js; this file holds only what
// the Profile and Settings panels must agree with the server about, so the two cannot drift.
//
// ⛔ THE RULES THIS FILE EXISTS TO KEEP (§7 decided 10-07):
//   · EEO is stated in the profile or left for the candidate — NEVER a default. "Choose not to
//     disclose" is a STATED answer (§7.5: "decline to answer is a stated answer"), so a Voluntary
//     Disclosures / Self-ID step FILLS with the form's own decline option. A field the user never set
//     stays blank — blank and decline are two different values and are never conflated.
//   · Saved answers match on NORMALISED text with the employer templated as `{company}`. That is
//     normalisation, not fuzziness: punctuation, an asterisk and a "(required)" marker are not words.
//     ⛔ Nothing here does keyword or "appearances" matching (SpeedyApply's method), because the class
//     that most needs exactness — the authorisation question — is exactly where D36 watched
//     `work_authorization` substring-match an INVERTED sponsorship question.
//   · "Have you worked here before?" is answered from the profile's work history — Yes only when the
//     company is in it, No only when the profile HAS a work history and the company is not in it.
//     An empty work history states nothing, so it answers nothing.

import { companyNameKey } from "./companyIdentity.js";

// ── EEO ─────────────────────────────────────────────────────────────────────────────────────────

/** The four EEO columns of user_profile, in the order the Profile panel shows them. */
export const EEO_FIELDS = Object.freeze(["gender", "ethnicity", "veteran_status", "disability_status"]);

/**
 * The stored value of an explicit decline. Human-readable on purpose: it is what an export shows and
 * what a free-text EEO box receives, and it reads as the candidate's own choice rather than a code.
 */
export const EEO_DECLINE = "Choose not to disclose";

/** True when a stored EEO value is the explicit decline — and ONLY then. Blank is not a decline. */
export function isEeoDecline(value) {
  return normaliseQuestion(value) === normaliseQuestion(EEO_DECLINE);
}

/**
 * A form's own decline option, however the ATS words it: "Decline to self-identify" (Greenhouse),
 * "I don't wish to answer" (the OFCCP veteran form), "I do not want to answer" (CC-305 disability),
 * "Prefer not to say", "I choose not to disclose". Deliberately does NOT match "I am not a protected
 * veteran" or "No, I do not have a disability" — those are answers, not declines, and choosing one
 * for a candidate who declined would be a false statement.
 */
export const DECLINE_OPTION_RE =
  /\b(?:declin(?:e|ed|es|ing)|prefer\s+not|rather\s+not|choose\s+not|wish\s+not\s+to|(?:do\s+not|don'?t|does\s+not|doesn'?t)\s+(?:wish|want|care)\s+to|not\s+(?:to\s+)?(?:disclose|answer|say|specify|identify|self[\s-]?identify|state)|no\s+answer|undisclosed)\b/i;

/** The value of the first option that is a decline, or null when the form offers none. */
export function pickDeclineOption(options = []) {
  for (const o of options || []) {
    const text = `${o?.label ?? ""} ${o?.value ?? ""}`.replace(/[‘’ʼ]/g, "'");
    if (DECLINE_OPTION_RE.test(text)) return o.value;
  }
  return null;
}

// ── Question normalisation and the {company} template ───────────────────────────────────────────

export const COMPANY_TOKEN = "{company}";

/**
 * The comparison form of a question. Collapses what is not a word — curly quotes, an asterisk, a
 * "(required)"/"(optional)" marker, trailing punctuation, case and whitespace — and NOTHING else.
 * Every word survives, so "Do you require sponsorship" and "Do you not require sponsorship" stay
 * different questions.
 */
export function normaliseQuestion(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\(\s*(?:required|optional)\s*\)/gi, " ")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/[\s?:.!]+$/g, "")
    .trim()
    .toLowerCase();
}

const LEGAL_SUFFIX_RE = /[\s,]+(?:inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|ag|bv)\.?$/i;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The spellings of an employer a form might use: "Stripe, Inc." → ["Stripe, Inc.", "Stripe"]. */
export function companyNameVariants(company) {
  const full = String(company ?? "").trim();
  if (!full) return [];
  const out = new Set([full]);
  let bare = full;
  while (LEGAL_SUFFIX_RE.test(bare)) bare = bare.replace(LEGAL_SUFFIX_RE, "").trim();
  if (bare && bare.length >= 2) out.add(bare);
  return [...out].sort((a, b) => b.length - a.length);
}

/**
 * The question with the employer's name replaced by `{company}`, wording otherwise untouched — so the
 * stored entry reads as the candidate saw it, and expanding it for the same employer gives back the
 * exact text. Whole-word only: "Box" is not replaced inside "Inbox".
 * Returns the question unchanged when the company is unknown or not named in it.
 */
export function templateQuestion(question, company) {
  let q = String(question ?? "");
  for (const name of companyNameVariants(company)) {
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(name)}(?![A-Za-z0-9])`, "gi");
    q = q.replace(re, COMPANY_TOKEN);
  }
  return q;
}

/** The key two questions are compared by: normalised, employer templated. */
export function questionKey(question, company) {
  return normaliseQuestion(templateQuestion(question, company));
}

// ── Opt-ins ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Opt-in questions: marketing, messaging channels, talent pools, job alerts. §7.4 decided: NEVER opt
 * the candidate in — leave it, or answer No only if they said so. Not consent to the privacy policy
 * or to processing the application, which a form requires and which is not a marketing choice.
 */
export const OPT_IN_RE =
  /\b(?:opt[\s-]?(?:in|out)|subscrib\w*|newsletters?|marketing|promotional|whats\s?app|sms|text\s+messages?|receive\s+(?:\w+\s+){0,4}(?:communications?|updates|e-?mails?|messages|notifications|news|alerts|offers|texts)|talent\s+(?:community|network|pool)|job\s+alerts?|keep\s+me\s+(?:informed|updated|posted)|(?:contact|e-?mail|text|notify)\s+me\s+(?:about|of|regarding|when)\s+(?:future|other|new|similar|relevant))\b/i;

export function isOptInQuestion(text) {
  return OPT_IN_RE.test(String(text ?? ""));
}

/** A stored answer that declines: "No", "false", "no thanks", "do not". Anything else is not a No. */
export function isNegativeAnswer(value) {
  return /^(?:no|n|false|0|off|no,?\s+thanks?|no\s+thank\s+you|do\s+not|don'?t|i\s+do\s+not\s+(?:consent|agree|wish))$/i
    .test(normaliseQuestion(value));
}

// ── "Have you worked here before?" ──────────────────────────────────────────────────────────────
//
// §8.2 item 2: answered from the profile's WORK HISTORY — Yes only when the company is in it, No
// otherwise — stated by the profile, never guessed. The work history is what the packet's own
// repeating sections already carry (services/applyGatePacket.js buildPacketEntries: the base
// résumé's EXPERIENCE section, else the profile's current role) plus `current_company`, so the fill
// that types "Acme" into Work Experience is the same fact that answers "Have you worked for Acme?".
// An EMPTY history states nothing, so it answers nothing (no_work_history) — "No" there would be a
// guess dressed as a fact.

// The whole question must be one of these shapes — anything with a qualifier the work history cannot
// speak to ("as an intern", "in a sales role") is not matched and so stops, rather than being answered.
const WORKED_HERE_RES = [
  // Have you (ever) (previously) worked for / at / been employed by X (before)? · Have you worked here?
  /^(?:have|had)\s+you\s+(?:ever\s+)?(?:previously\s+|formerly\s+|already\s+)?(?:been\s+)?(?:worked|employed)\s+(?<prep>for|at|with|by|here)\b\s*(?<rest>.*)$/i,
  // Are you a (current or) former / previous employee of X?
  /^(?:are|were)\s+you\s+(?:a\s+|an\s+)?(?<current>current\s+or\s+)?(?:former|previous|past|ex-?)\s*(?:employee|team\s+member|worker)\s+(?:of|at|with)\s+(?<rest>.*)$/i,
  // Previously employed by X?
  /^(?:previously|formerly)\s+employed\s+(?:by|at|with)\s+(?<rest>.*)$/i,
];
const TAIL_BEFORE_RE = /\s*(?:before|previously|in\s+the\s+past|at\s+any\s+(?:point|time)|ever)\s*$/i;
const TAIL_WIDENED_RE = /\s*,?\s*or\s+(?:any\s+of\s+)?(?:its|their|our)\s+(?:subsidiar(?:y|ies)|affiliates?|parent\s+compan(?:y|ies)|related\s+entit(?:y|ies))(?:\s+or\s+(?:subsidiar(?:y|ies)|affiliates?))?\s*$/i;
const TAIL_TIME_RE = /\s*(?:in|within|during)\s+the\s+(?:last|past)\s+\d+\s+(?:months?|years?)\s*$/i;
const HERE_RE = /^(?:here|us|this\s+company|this\s+organi[sz]ation|our\s+company)$/i;

/**
 * Read a worked-here question. null when the text is not one, else
 *   { named: string|null — the employer it names (null for "here" / "us")
 *     widened   — "or any of its subsidiaries": a No cannot be stated
 *     timeBound — "in the last 12 months": a Yes cannot be stated (no reliable dates)
 *     includesCurrent — "current or former employee" }
 */
export function parseWorkedHereQuestion(text) {
  const raw = normaliseQuestion(text);
  if (!raw) return null;
  for (const re of WORKED_HERE_RES) {
    const m = raw.match(re);
    if (!m) continue;
    let rest = (m.groups?.rest ?? "").trim();
    const prepHere = m.groups?.prep === "here";
    let widened = false, timeBound = false;
    for (let i = 0; i < 4; i++) {
      const before = rest;
      if (TAIL_WIDENED_RE.test(rest)) { widened = true; rest = rest.replace(TAIL_WIDENED_RE, "").trim(); }
      if (TAIL_TIME_RE.test(rest)) { timeBound = true; rest = rest.replace(TAIL_TIME_RE, "").trim(); }
      rest = rest.replace(TAIL_BEFORE_RE, "").trim();
      if (rest === before) break;
    }
    rest = rest.replace(/[,;]+$/, "").trim();
    let named;
    if (prepHere) {
      if (rest) return null;                 // "worked here as an intern" — a qualifier, not answered
      named = null;
    } else if (!rest) {
      return null;
    } else if (HERE_RE.test(rest)) {
      named = null;
    } else {
      // What is left is the employer's name — a few words, no further clause.
      if (rest.split(/\s+/).length > 6 || /\b(?:as|in|on|role|position|capacity|contractor|intern|while|since|during)\b/i.test(rest)) return null;
      named = rest;
    }
    return { named, widened, timeBound, includesCurrent: !!m.groups?.current };
  }
  return null;
}

/**
 * The employers the candidate has stated: the work entries' companies (the packet's `entries.work`)
 * and the profile's `current_company`. De-duplicated, display names kept.
 */
export function workHistoryCompanies({ profile = null, work = [] } = {}) {
  const out = [];
  for (const e of Array.isArray(work) ? work : []) {
    const name = typeof e === "string" ? e : e && typeof e === "object" ? e.company : null;
    if (name && String(name).trim()) out.push(String(name).trim());
  }
  if (profile?.current_company && String(profile.current_company).trim()) out.push(String(profile.current_company).trim());
  return [...new Set(out)];
}

/**
 * The worked-here answer the profile STATES for this question at this employer.
 * Returns { answer: "Yes"|"No"|null, reason, matched? } — null means the profile does not say, and the
 * caller must stop (or use the candidate's own saved answer) rather than guess.
 */
export function workedHereAnswer(question, company, history = []) {
  const parsed = parseWorkedHereQuestion(question);
  if (!parsed) return { answer: null, reason: "not_worked_here_question" };
  const runKey = companyNameKey(company);
  if (!runKey) return { answer: null, reason: "employer_unknown" };
  // A question naming an employer must name THIS one: "Have you worked at Google?" on a Figma form is
  // not a question the history can answer for Figma.
  if (parsed.named && parsed.named !== COMPANY_TOKEN && companyNameKey(parsed.named) !== runKey) {
    return { answer: null, reason: "names_another_employer" };
  }
  const keys = (history || []).map(h => ({ name: h, key: companyNameKey(h) })).filter(h => h.key);
  if (!keys.length) return { answer: null, reason: "no_work_history" };
  const hit = keys.find(h => h.key === runKey);
  if (hit) {
    if (parsed.timeBound) return { answer: null, reason: "time_bound_unknown_dates", matched: hit.name };
    return { answer: "Yes", reason: "in_work_history", matched: hit.name };
  }
  // "Scale" in the history and "Scale AI" on the form may be one company or two — not stated either way.
  const near = keys.find(h => h.key.length >= 3 && runKey.length >= 3 && (h.key.startsWith(runKey) || runKey.startsWith(h.key)));
  if (near) return { answer: null, reason: "ambiguous_company_name", matched: near.name };
  if (parsed.widened) return { answer: null, reason: "subsidiaries_unknown" };
  return { answer: "No", reason: "not_in_work_history" };
}

/** Why a worked-here answer is or is not given, in the candidate's words (Test a question, the overlay). */
export const WORKED_HERE_REASONS = Object.freeze({
  in_work_history: "this employer is in your work history",
  not_in_work_history: "this employer is not in your work history",
  no_work_history: "your profile has no work history, so it states nothing either way",
  ambiguous_company_name: "a similar name is in your work history — it may or may not be this employer",
  names_another_employer: "the question names a different employer",
  time_bound_unknown_dates: "the question asks about a time window, and your work history has no reliable dates",
  subsidiaries_unknown: "the question includes subsidiaries, which your work history cannot rule out",
  employer_unknown: "the employer is not known",
  not_worked_here_question: "not a worked-here question",
});

// ── Limits shared by the Settings UI and the import route ───────────────────────────────────────

export const SAVED_ANSWER_LIMITS = Object.freeze({
  maxEntries: 500,
  // A189 (11-11): 500 -> 2000. The question is the EMPLOYER'S wording, kept as asked so it matches the form again; a
  // Greenhouse question with its explanation runs past 500, and the whole save (every answer with it) was refused too_long.
  maxQuestionChars: 2000,
  maxAnswerChars: 5000,
  maxImportBytes: 256 * 1024,
});

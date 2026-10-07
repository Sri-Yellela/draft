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

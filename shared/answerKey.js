// ── D96 §4 · THE SAVED-ANSWER KEY and the never-fillable guard — the pure half, shared ────────────────
//
// What identifies "the same question" for the answer lifecycle (services/answerLifecycle.js), and what
// is never remembered or filled whatever is stored. Server, client and (by a byte-identical copy, lane
// J4) the extension must agree on both, so they live here, deterministic and with no I/O.
//
// THE KEY = the normalised label + the widget kind + the option wording.
//   · label    normaliseQuestion() (shared/savedAnswers.js: case, curly quotes, "*", "(required)",
//              trailing ?:.!) and then any punctuation still at either END — so "First Name*",
//              "First Name *:" and "* First Name" are one EXACT label, never a guess. Every inner word
//              survives: "Do you require sponsorship" and "Do you not require sponsorship" differ.
//   · kind     one of WIDGET_KINDS. A text box and a dropdown with the same label are two questions.
//   · options  the option wording, each normalised like a label, placeholders ("Select One") dropped,
//              de-duplicated and sorted — so a re-ordered list is the same question and a list with a
//              different country or different wording is a NEW one (D96 §4 safeguard 2).
// Nothing here is fuzzy: no containment, no keywords, no similarity score. Two labels that merely
// resemble each other are two questions (safeguard 6).

import { normaliseQuestion } from "./savedAnswers.js";

// ─── BEGIN the extension copy (J4 copies this block byte for byte; normaliseQuestion is imported) ───

/** The widget kinds a key may name. */
export const WIDGET_KINDS = Object.freeze(["text", "select", "radio", "checkbox", "date"]);

const WIDGET_ALIASES = Object.freeze({
  text: "text", textarea: "text", input: "text", email: "text", tel: "text", number: "text", url: "text",
  select: "select", "select-one": "select", combobox: "select", dropdown: "select", listbox: "select", typeahead: "select",
  radio: "radio", "radio-group": "radio", radiogroup: "radio",
  checkbox: "checkbox", "checkbox-group": "checkbox", multiselect: "checkbox", "select-multiple": "checkbox",
  date: "date", "date-picker": "date", datepicker: "date",
});

/** The canonical widget kind, or null for one the key does not know. */
export function widgetKindOf(kind) {
  const k = String(kind ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(WIDGET_ALIASES, k) ? WIDGET_ALIASES[k] : null;
}

const END_PUNCT_RE = /^[\s*:;,.!?¿¡…–—_"'`|-]+|[\s*:;,.!?¿¡…–—_"'`|-]+$/g;

/** The comparison form of a label: normaliseQuestion, then punctuation at either end removed. */
export function questionLabelKey(label) {
  return normaliseQuestion(label).replace(END_PUNCT_RE, "").replace(/\s+/g, " ").trim();
}

const PLACEHOLDER_OPTION_RE = /^(?:select(?: one| an option| an answer)?|choose(?: one| an option)?|please (?:select|choose)(?: one| an option)?|none selected|-+)$/;

/** The option wording as one comparable string ('' when the control has no options). */
export function optionsKey(options) {
  const words = (Array.isArray(options) ? options : [])
    .map(o => (o && typeof o === "object" ? (o.label ?? o.text ?? o.value ?? "") : o))
    .map(questionLabelKey)
    .filter(w => w && !PLACEHOLDER_OPTION_RE.test(w));
  return words.length ? JSON.stringify([...new Set(words)].sort()) : "";
}

/**
 * The key of one question as a page shows it. Throws a code error (label_required · widget_kind_invalid)
 * rather than returning a key that would match the wrong thing. A text or date control has no options.
 */
export function answerKeyOf({ question, widgetKind, options = null } = {}) {
  const questionKey = questionLabelKey(question);
  if (!questionKey) throw keyError("label_required");
  const kind = widgetKindOf(widgetKind);
  if (!kind) throw keyError("widget_kind_invalid");
  return { questionKey, widgetKind: kind, optionsKey: kind === "text" || kind === "date" ? "" : optionsKey(options) };
}

function keyError(code) { const e = new Error(code); e.code = code; return e; }

/**
 * ⛔ NEVER FILLABLE (D96 §4 safeguard 1): terms, consent, a privacy notice, an attestation ("I certify…"),
 * a signature. These are always the person's own click — never remembered, never returned for a fill,
 * whatever is stored. Read from the label AND the option wording, because a box labelled
 * "Acknowledgement" often carries its "I certify that…" in the option. Deliberately broad: a false
 * positive costs one click; a false negative signs something for the person.
 */
export const NEVER_FILL_RE =
  /\b(?:terms\s+(?:and|&)\s+conditions|terms\s+of\s+(?:use|service|employment)|(?:these|the|our)\s+terms|conditions\s+of\s+(?:use|employment)|consent(?:s|ed|ing)?|privacy\s+(?:notice|policy|statement|terms)|data\s+(?:protection|processing)\s+(?:notice|policy|statement|agreement)|gdpr|ccpa|i\s+(?:hereby\s+)?(?:certify|attest|declare|affirm|acknowledge|agree|understand|authori[sz]e|accept)|certif(?:y|ies|ied)|attest(?:s|ed|ing|ation)?|acknowledg(?:e|es|ed|ing|ement|ment)|signature|e-?sign(?:ed|ature)?|electronic(?:ally)?\s+sign\w*|sign(?:ed)?\s+(?:here|below)|type\s+your\s+(?:full\s+)?(?:legal\s+)?name\s+(?:to|as)\s+(?:sign|your\s+signature)|by\s+(?:checking|ticking|clicking|submitting)|agree(?:s|d)?\s+to)\b/i;

/**
 * ⛔ NEVER READ, NEVER STORED (D96 §7): password and payment fields — and a national identity number,
 * which a saved-answer store has no business holding.
 */
export const SECRET_FIELD_RE =
  /\b(?:password|passcode|passphrase|pin\s+code|card\s*(?:number|holder|verification)|credit\s+card|debit\s+card|cvv2?|cvc2?|security\s+code|iban|routing\s+number|(?:bank\s+)?account\s+number|sort\s+code|social\s+security(?:\s+number)?|ssn)\b/i;

/** Why a question may never be remembered or filled: 'consent_or_attestation' | 'secret' | null. */
export function neverFillableReason(question, options = null) {
  const optionText = (Array.isArray(options) ? options : [])
    .map(o => (o && typeof o === "object" ? `${o.label ?? ""} ${o.text ?? ""} ${o.value ?? ""}` : String(o ?? "")))
    .join(" • ");
  const text = `${String(question ?? "")} • ${optionText}`.replace(/[‘’ʼ]/g, "'");
  if (SECRET_FIELD_RE.test(text)) return "secret";
  if (NEVER_FILL_RE.test(text)) return "consent_or_attestation";
  return null;
}

// ─── END the extension copy ───

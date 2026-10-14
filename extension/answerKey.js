// ── D96 §4 · THE SAVED-ANSWER KEY and the never-fillable guard — the EXTENSION copy (lane J4) ─────────────────────
//
// The block between the markers is copied BYTE FOR BYTE from shared/answerKey.js (the extension is packaged from
// extension/ alone and cannot import shared/). test/j4AnswerKeyCopy.test.js asserts the two blocks are identical, so
// the key the server stores an answer under and the key the extension matches a page question by cannot drift.
// normaliseQuestion is the extension's own byte-identical copy of shared/savedAnswers.js (savedAnswerMatch.js).

import { normaliseQuestion } from "./savedAnswerMatch.js";

// ─── BEGIN COPY of shared/answerKey.js ───

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

// ─── END COPY ───

// ── Outside the copy: the guard applied to a CONTROL on the page (lane J4) ───────────────────────────────────────

// ⚠ shape assumed, re-measure on a live tenant (O73): a SIGNATURE block — Workday's CC-305 self-identification signs
// with a name and a date whose automation ids share a prefix ("selfIdentifiedDisabilityData--name" beside
// "…--dateSignedOn"), so a control is part of a signature when its own ids say so, or when a sibling sharing its
// "<prefix>--" says "signed" / "signature". From the J2 fixture (scripts/fakeAts.js), itself D55's replica conventions.
const SIGNATURE_ID_RE = /signature|signedOn|dateSigned|e-?sign/i;
const idsOf = (f) => `${f?.automationId || ''} ${f?.name || ''} ${f?.id || ''} ${f?.dateGroup?.aid || ''}`;
export function isSignatureField(field, fields = []) {
  if (!field) return false;
  if (SIGNATURE_ID_RE.test(idsOf(field))) return true;
  const prefix = String(field.automationId || '').split('--')[0];
  if (!prefix || prefix === field.automationId) return false;
  // A sibling's own id, or its group's (Workday wraps a date's inputs in "formField-<prefix>--dateSignedOn").
  const ownIds = (f) => [f.automationId, String(f.dateGroup?.aid || '').replace(/^formField-/, '')].filter(Boolean);
  return fields.some(f => f !== field && ownIds(f).some(id => id.startsWith(`${prefix}--`) && SIGNATURE_ID_RE.test(id)));
}

/**
 * ⛔ D96 §4 safeguard 1 / §7 — why a control on the page may never be filled: 'consent_or_attestation' (terms,
 * consent, privacy notice, "I certify…", a signature) · 'secret' (password, payment, national id) · null. Read from the
 * label, the group's question, the option wording and — for a signature — the control's own ids. ONE rule, used by
 * the matcher, the saved-answer placer, the edit path and the panel.
 */
export function neverFillReasonOfField(field, fields = []) {
  if (!field) return null;
  if (field.type === 'password') return 'secret';
  const options = Array.isArray(field.options) ? field.options.map(o => o?.text ?? o) : null;
  const why = neverFillableReason([field.group, field.dateGroup?.label, field.label].filter(Boolean).join(' • '), options);
  if (why) return why;
  return isSignatureField(field, fields) ? 'consent_or_attestation' : null;
}

/** The plan with every never-fillable control taken out — the enforced rule, applied to the WHOLE plan of a step. */
export function withoutNeverFill(plan = [], fields = []) {
  const byIndex = new Map((fields || []).map(f => [f.index, f]));
  const kept = [], refused = [];
  for (const p of plan || []) {
    const f = byIndex.get(p.index) || { label: p.label, name: p.name, id: p.id };
    const why = neverFillReasonOfField(f, fields);
    if (why) refused.push({ field: f.group || f.label || p.label, name: p.name ?? null, reason: why === 'secret' ? 'secret_never_filled' : 'consent_left_for_you', kind: 'consent' });
    else kept.push(p);
  }
  return { plan: kept, refused };
}

// ── D55 (f), the extension's half: saved answers, "have you worked here?" and the EEO decline ─────
//
// docs/AUTOFILL_TARGET.md §8.1 rows 4–7 and 18, §8.2 items 1–2. The server (services/applyGatePacket.js
// packetSavedAnswers) puts three things on the packet for questions it never saw:
//   savedAnswers  [{ question, answer, eligibility, optIn }] — the candidate's own answers, {company}
//                 already expanded for this employer
//   workedHere    { company, answer: 'Yes'|'No'|null, reason } — what the stated work history says
//   eeoDeclines   ['gender'|'ethnicity'|'veteran'|'disability'] — the EEO fields the candidate set to
//                 "Choose not to disclose" (EEO_DECLINE). A field they never set is not in the list.
// placeStatedAnswers() puts them on THIS page's questions, by these rules and no others:
//   · a saved answer is placed only where the page's question is the SAME question —
//     normaliseQuestion() EQUALITY. Never containment, never keywords. For an eligibility, EEO or
//     opt-in question the answer must also be one of the control's options EXACTLY (no closest-option).
//   · an opt-in is only ever given the candidate's own No — a saved Yes to marketing is never placed.
//   · the worked-here answer is placed only on a question parseWorkedHereQuestion() reads as being
//     about THIS employer ("here", "this company", or its own name) — never one that names another
//     employer; never a No where the question widens to subsidiaries; never a Yes on a time window.
//   · an EEO decline picks the FORM's own decline option (pickDeclineOption); a form that offers none
//     is left blank. A decline is never a default: only a field in eeoDeclines is touched.
//
// ⛔ THE BLOCK BELOW IS COPIED, BYTE FOR BYTE, FROM shared/savedAnswers.js. The extension is packaged
// from extension/ alone and cannot import shared/. test/d55SavedAnswersExtension.test.js asserts
// every copied function and regex is textually identical to the shared one, so the rule the server
// applies and the rule the extension applies cannot drift apart.

// ─── BEGIN COPY of shared/savedAnswers.js ───
export const COMPANY_TOKEN = "{company}";

export const EEO_DECLINE = "Choose not to disclose";

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

export const DECLINE_OPTION_RE =
  /\b(?:declin(?:e|ed|es|ing)|prefer\s+not|rather\s+not|choose\s+not|wish\s+not\s+to|(?:do\s+not|don'?t|does\s+not|doesn'?t)\s+(?:wish|want|care)\s+to|not\s+(?:to\s+)?(?:disclose|answer|say|specify|identify|self[\s-]?identify|state)|no\s+answer|undisclosed)\b/i;

export function pickDeclineOption(options = []) {
  for (const o of options || []) {
    const text = `${o?.label ?? ""} ${o?.value ?? ""}`.replace(/[‘’ʼ]/g, "'");
    if (DECLINE_OPTION_RE.test(text)) return o.value;
  }
  return null;
}

const LEGAL_SUFFIX_RE = /[\s,]+(?:inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|ag|bv)\.?$/i;

export function companyNameVariants(company) {
  const full = String(company ?? "").trim();
  if (!full) return [];
  const out = new Set([full]);
  let bare = full;
  while (LEGAL_SUFFIX_RE.test(bare)) bare = bare.replace(LEGAL_SUFFIX_RE, "").trim();
  if (bare && bare.length >= 2) out.add(bare);
  return [...out].sort((a, b) => b.length - a.length);
}

export const OPT_IN_RE =
  /\b(?:opt[\s-]?(?:in|out)|subscrib\w*|newsletters?|marketing|promotional|whats\s?app|sms|text\s+messages?|receive\s+(?:\w+\s+){0,4}(?:communications?|updates|e-?mails?|messages|notifications|news|alerts|offers|texts)|talent\s+(?:community|network|pool)|job\s+alerts?|keep\s+me\s+(?:informed|updated|posted)|(?:contact|e-?mail|text|notify)\s+me\s+(?:about|of|regarding|when)\s+(?:future|other|new|similar|relevant))\b/i;

export function isOptInQuestion(text) {
  return OPT_IN_RE.test(String(text ?? ""));
}

export function isNegativeAnswer(value) {
  return /^(?:no|n|false|0|off|no,?\s+thanks?|no\s+thank\s+you|do\s+not|don'?t|i\s+do\s+not\s+(?:consent|agree|wish))$/i
    .test(normaliseQuestion(value));
}

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
// ─── END COPY ───

/** Which EEO field a question is about, or null. The keys are handler_map's. */
export function eeoClassOf(text) {
  const t = String(text || '').toLowerCase();
  if (/\bgender\b|\bsex\b/.test(t)) return 'gender';
  if (/ethnic|\brace\b|racial|hispanic|latino/.test(t)) return 'ethnicity';
  if (/veteran/.test(t)) return 'veteran';
  if (/disabilit/.test(t)) return 'disability';
  return null;
}

/**
 * A radio group or select whose QUESTION says nothing ("Please check one of the boxes below:" — the
 * CC-305 disability form) is classed by its OPTIONS — but only when at least two of them name the
 * same EEO field and none names another.
 */
function eeoClassOfOptions(labels) {
  const classes = labels.map(eeoClassOf).filter(Boolean);
  const distinct = [...new Set(classes)];
  return classes.length >= 2 && distinct.length === 1 ? distinct[0] : null;
}

/** The page's questions: one per control, except a radio group, which is one question. */
export function questionUnits(fields, taken = new Set()) {
  const units = [];
  const groups = new Map();
  for (const f of fields || []) {
    if (taken.has(f.index)) continue;
    if (f.type === 'radio') {
      const key = f.name || f.group || `#${f.index}`;
      let u = groups.get(key);
      if (!u) { u = { kind: 'radio', question: f.group || '', radios: [] }; groups.set(key, u); units.push(u); }
      u.radios.push(f);
      continue;
    }
    units.push({ kind: f.type, question: f.label || '', field: f });
  }
  return units;
}

const isCombo = (f) => f.widget === 'dropdown';
const isTypeahead = (f) => f.widget === 'typeahead';
const stepFor = (f, value, extra) => ({
  index: f.index, name: f.name, id: f.id, label: extra.label || f.label, value,
  confidence: 1, eligibility: !!extra.eligibility, matchedBy: extra.provenance, provenance: extra.provenance,
  ...(extra.exactOption ? { exactOption: true } : {}),
  ...(extra.declineOption ? { declineOption: true } : {}),
});

/**
 * The step that places `answer` on a unit, or null when the control cannot hold it EXACTLY.
 * `exact` forbids the closest-option pick a custom dropdown would otherwise make.
 */
function valueStep(unit, answer, { exact, optIn, ...extra }) {
  const want = normaliseQuestion(answer);
  if (!want) return null;
  if (unit.kind === 'radio') {
    const r = unit.radios.find(x => normaliseQuestion(x.label) === want || normaliseQuestion(x.label) === normaliseQuestion(answer));
    return r ? stepFor(r, 'true', { ...extra, label: unit.question }) : null;
  }
  const f = unit.field;
  if (f.type === 'checkbox') {
    if (isNegativeAnswer(answer)) return stepFor(f, 'false', extra);
    if (!optIn && /^(?:yes|y|true)$/i.test(want)) return stepFor(f, 'true', extra);
    return null;
  }
  if (f.type === 'select-one' || f.type === 'select-multiple' || Array.isArray(f.options)) {
    const o = (f.options || []).find(x => x.value === String(answer) || normaliseQuestion(x.text) === want);
    return o ? stepFor(f, o.value, extra) : null;
  }
  if (isCombo(f)) return stepFor(f, String(answer), { ...extra, exactOption: !!exact });
  if (isTypeahead(f)) return exact ? null : stepFor(f, String(answer), extra);
  if (optIn) return null;                       // an opt-in is a choice, not a text box
  return stepFor(f, String(answer), extra);
}

/** The step that picks the form's own decline option on an EEO unit, or null (leave it blank). */
function declineStep(unit, extra) {
  if (unit.kind === 'radio') {
    const v = pickDeclineOption(unit.radios.map((r, i) => ({ label: r.label, value: String(i) })));
    return v === null ? null : stepFor(unit.radios[Number(v)], 'true', { ...extra, label: unit.question });
  }
  const f = unit.field;
  if (Array.isArray(f.options)) {
    const v = pickDeclineOption(f.options.map(o => ({ label: o.text, value: o.value })));
    return v === null ? null : stepFor(f, v, extra);
  }
  if (isCombo(f)) return stepFor(f, EEO_DECLINE, { ...extra, declineOption: true });
  if (f.type === 'checkbox' || f.type === 'radio' || isTypeahead(f)) return null;
  return stepFor(f, EEO_DECLINE, extra);         // a free-text EEO box receives the candidate's words
}

/** Is a worked-here reading about THIS employer? Its name, or "here" / "this company" / "us". */
function namesThisEmployer(parsed, company) {
  if (!parsed.named || parsed.named === COMPANY_TOKEN) return true;
  return companyNameVariants(company).some(v => normaliseQuestion(v) === parsed.named);
}

/**
 * Place the packet's saved answers, worked-here answer and EEO declines on the page's questions that
 * the packet's own answers did not take.
 * @param {object}   packet   released.packet
 * @param {object[]} fields   probeFormShape().fields
 * @param {object[]} plan     what matchAnswersToFields already planned (those controls are taken)
 * @param {(label: string) => string} kindOf  gated-handoff.js questionKind
 * @returns {{ plan: object[], notes: object[] }}
 */
export function placeStatedAnswers(packet, fields, plan = [], kindOf = () => 'other') {
  const out = [], notes = [];
  const saved = Array.isArray(packet?.savedAnswers) ? packet.savedAnswers : [];
  const worked = packet?.workedHere?.answer ? packet.workedHere : null;
  const declines = new Set(Array.isArray(packet?.eeoDeclines) ? packet.eeoDeclines : []);
  if (!saved.length && !worked && !declines.size) return { plan: out, notes };

  const taken = new Set((plan || []).map(p => p.index));
  for (const unit of questionUnits(fields, taken)) {
    const question = unit.question;
    if (!question) continue;
    const key = normaliseQuestion(question);
    const kind = kindOf(question);
    const optionLabels = unit.kind === 'radio' ? unit.radios.map(r => r.label) : (unit.field.options || []).map(o => o.text);
    const eeo = kind === 'eeo' || !!eeoClassOf(question) || !!eeoClassOfOptions(optionLabels);

    // 1 · the candidate's own saved answer — the SAME question, nothing looser.
    const sa = saved.find(s => normaliseQuestion(s.question) === key);
    if (sa) {
      const optIn = !!sa.optIn || kind === 'opt_in' || isOptInQuestion(question);
      if (optIn && !isNegativeAnswer(sa.answer)) { notes.push({ field: question, reason: 'opt_in_left_for_you', kind: 'opt_in' }); continue; }
      const eligibility = !!sa.eligibility || kind === 'eligibility';
      const step = valueStep(unit, sa.answer, { exact: eligibility || eeo || optIn, optIn, eligibility, provenance: 'saved_answer' });
      if (step) out.push(step);
      else notes.push({ field: question, reason: 'saved_answer_not_an_option', kind });
      continue;
    }

    // 2 · "have you worked here before?", from the stated work history.
    const parsed = worked ? parseWorkedHereQuestion(question) : null;
    if (parsed) {
      const ok = namesThisEmployer(parsed, worked.company)
        && !(parsed.widened && worked.answer === 'No') && !(parsed.timeBound && worked.answer === 'Yes');
      if (!ok) { notes.push({ field: question, reason: 'worked_here_left_for_you', kind }); continue; }
      const step = valueStep(unit, worked.answer, { exact: true, provenance: 'work_history' });
      if (step) out.push(step);
      else notes.push({ field: question, reason: 'worked_here_not_an_option', kind });
      continue;
    }

    // 3 · an EEO field the candidate DECLINED — the form's own decline option, or blank.
    if (eeo && declines.size) {
      const cls = eeoClassOf(question) || eeoClassOfOptions(optionLabels);
      if (!cls || !declines.has(cls)) continue;
      const step = declineStep(unit, { provenance: 'eeo_decline' });
      if (step) out.push(step);
      else notes.push({ field: question, reason: 'decline_option_absent', kind: 'eeo' });
    }
  }
  return { plan: out, notes };
}

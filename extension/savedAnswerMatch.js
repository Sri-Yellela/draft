import { answerKeyOf, optionsKey, questionLabelKey, widgetKindOf, neverFillableReason } from './answerKey.js';

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

/**
 * The page's questions: one per control, except a radio group, which is one question — and (D96 §7, lane J4) a
 * CHECKBOX GROUP (several boxes under one legend, probeFormShape's `group`) and a DATE (Workday's month / day / year
 * inputs under one group label, probeFormShape's `dateGroup`), which are one question each too.
 */
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
    if (f.type === 'checkbox' && f.group) {
      const key = `cb:${f.name || f.group}`;
      let u = groups.get(key);
      if (!u) { u = { kind: 'checkbox-group', question: f.group, boxes: [] }; groups.set(key, u); units.push(u); }
      u.boxes.push(f);
      continue;
    }
    if (f.dateGroup) {
      const key = `date:${f.dateGroup.id}`;
      let u = groups.get(key);
      if (!u) { u = { kind: 'date', question: f.dateGroup.label || '', parts: [] }; groups.set(key, u); units.push(u); }
      u.parts.push(f);
      continue;
    }
    units.push({ kind: f.type, question: f.label || '', field: f });
  }
  return units;
}

/** Every control a unit is made of. */
export const unitFields = (u) => u.radios || u.boxes || u.parts || (u.field ? [u.field] : []);

/** The options a unit SHOWS on the page now — null when they exist only once it is opened (Workday's widgets). */
export function unitOptions(u) {
  if (u.kind === 'radio') return u.radios.map(r => r.label);
  if (u.kind === 'checkbox-group') return u.boxes.map(b => b.label);
  const f = u.field;
  if (f && Array.isArray(f.options)) return f.options.map(o => o.text);
  return null;
}

/** The D96 §4 widget kind of a unit (extension/answerKey.js WIDGET_KINDS). */
export function unitWidgetKind(u) {
  if (u.kind === 'radio') return 'radio';
  if (u.kind === 'checkbox-group' || u.kind === 'checkbox') return 'checkbox';
  if (u.kind === 'date' || u.kind === 'date-input') return 'date';
  const f = u.field;
  if (f?.type === 'date') return 'date';
  if (f?.widget === 'dropdown' || f?.widget === 'typeahead' || /^select/.test(String(f?.type || ''))) return 'select';
  return 'text';
}

/**
 * ⭐ D96 §4 · THE KEY OF A QUESTION AS THIS PAGE SHOWS IT — answerKeyOf over the unit's label, kind and options.
 * `optionsKnown` is false for a Workday dropdown or typeahead: its options exist only once it is opened, so the
 * option-wording half of the key is checked when the fill opens it (applyPlan's `expectOptions`), never skipped.
 * null when the unit has no label (nothing to key it by).
 */
export function unitAnswerKey(u) {
  try {
    const options = unitOptions(u);
    const k = answerKeyOf({ question: u.question, widgetKind: unitWidgetKind(u), options });
    return { ...k, optionsKnown: options !== null || k.widgetKind === 'text' || k.widgetKind === 'date' };
  } catch { return null; }
}

/**
 * Is this saved answer the SAME question as the unit? A keyed answer: label, widget kind and (where the page shows
 * them) the option wording all equal — a different country or different wording is a NEW question (safeguard 2). A
 * legacy label-only answer (widgetKind 'any'): the label alone, as before.
 */
export function savedAnswerFits(s, uk) {
  if (!s || !uk) return false;
  const sq = s.questionKey || questionLabelKey(s.question);
  if (sq !== uk.questionKey) return false;
  if (!s.widgetKind || s.widgetKind === 'any') return true;
  if (widgetKindOf(s.widgetKind) !== uk.widgetKind) return false;
  return uk.optionsKnown ? optionsKey(s.options) === uk.optionsKey : true;
}

// ── ⭐ T25 (owner 10-15) · A NEAR MATCH: the same question in other words ────────────────────────────────────────
//
// "How did you hear about this job?" reuses the answer saved for "How did you hear about us?". Deterministic and
// explainable — no model: both questions become a SET of content words (normaliseQuestion, then a few curated phrase
// equivalences, then stop words and the words that only name the employer — us / this job / the role / the company —
// set aside), and the two sets must be nearly the same: Jaccard ≥ NEAR_THRESHOLD, the SAME question word (how / why /
// what …), the same negation and the same numbers. "Why do you want to work here?" ({why, want, work}) and "Why are
// you leaving your job?" ({why, leaving}) share one word in four — not the same question.
//
// ⛔ NEVER ACROSS QUESTION KINDS (D96 §7): a question questionKind reads as eligibility / work authorisation /
// sponsorship, EEO / demographic, consent / attestation, an opt-in, or screening (salary, years of experience,
// relocation, clearance …) — on EITHER side — still matches ONLY exactly; so does anything the never-fill guard,
// the EEO classes, the opt-in rule or the worked-here reading recognises, and any saved answer marked eligibility /
// opt-in / attesting. A near match fills a picker only with one of the field's OWN options (valueStep, exact), and it
// lands as Check — the row names the original question — never silently Filled. An exact saved answer and every
// earlier tier (the packet's answers, T18's semantic reading) win: a near match only reaches a question nothing else
// took, and it never takes a control back from a guess (yieldGuessesToStated is exact-only).

export const NEAR_THRESHOLD = 0.75;

const NEAR_STOP_WORDS = new Set(('a an the of to for in on at by with from about into and or but your you yours yourself i me my ' +
  'we our ours is are was were be been being am do does did done have has had having will would could should can may might ' +
  'shall must please kindly briefly tell share let know this that these those it its there as if so any some such ' +
  'currently ever one what which').split(' '));
// Words that only name the employer or the opening — "about us" and "about this job" ask the same thing.
const NEAR_REFERENTS = new Set(('us company companies organization organisation organizations organisations job jobs role roles ' +
  'position positions opportunity opportunities opening openings posting postings vacancy vacancies here team employer firm ' +
  'business {company}').split(' '));
// "What is your GitHub URL?" IS "GitHub URL" — what / which only turn a label into a question (stop words above); these do not.
const NEAR_QUESTION_WORDS = new Set(['how', 'why', 'when', 'where', 'who', 'whom', 'whose']);
const NEAR_NEGATIONS = new Set(['not', 'no', 'never', 'none', 'nor', 'without', 'neither']);
// Curated equivalences, applied to the normalised text before it is split into words.
const NEAR_PHRASES = [
  [/\b(?:how|where)\s+did\s+you\s+(?:first\s+)?(?:hear|heard|learn(?:ed|t)?|find\s+out|found\s+out|discover(?:ed)?|come\s+across)\b/g, 'how did you hear'],
  [/\b(?:find|found|learn(?:ed|t)?|discover(?:ed)?)\s+(?:out\s+)?(?:about|of)\b/g, 'hear about'],
  [/\bheard\b/g, 'hear'],
];
// ⛔ Salary and its relatives — a number about money is never borrowed from another wording.
const NEAR_MONEY_RE = /\b(?:salary|salaries|compensation|pay|paid|wage|wages|rate|ctc|remuneration|bonus|equity|stipend|earnings?|income|\$|usd|eur|gbp)\b/i;
// ⛔ Eligibility words beyond questionKind's own list ("legally", "green card", "require sponsorship").
const NEAR_ELIGIBILITY_RE = /\b(?:authori[sz]\w*|eligib\w*|sponsor\w*|visa|citizen\w*|green\s+card|right\s+to\s+work|legal(?:ly)?|immigration|work\s+permit|i-?9|e-?verify|clearance)\b/i;

/** The content words of a question, as a sorted array — what a near match compares. `company`: this employer's name. */
export function nearQuestionTokens(text, company = '') {
  let t = normaliseQuestion(text).replace(/n't\b/g, ' not').replace(/['"]/g, '');
  for (const [re, to] of NEAR_PHRASES) t = t.replace(re, to);
  const companyWords = new Set(companyNameVariants(company).flatMap(v => normaliseQuestion(v).split(/[^a-z0-9{}]+/)).filter(Boolean));
  const out = new Set();
  for (let w of t.split(/[^a-z0-9{}$]+/)) {
    if (!w || NEAR_STOP_WORDS.has(w) || NEAR_REFERENTS.has(w) || companyWords.has(w)) continue;
    if (w.length > 3 && /s$/.test(w) && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);   // plural → singular, nothing more
    out.add(w);
  }
  return [...out].sort();
}

/**
 * How near two questions are: { score, near, why }. `near` only when the content-word sets are at least
 * NEAR_THRESHOLD alike AND ask with the same question word, the same negation and the same numbers.
 */
export function nearQuestionScore(a, b, company = '') {
  const A = nearQuestionTokens(a, company), B = nearQuestionTokens(b, company);
  if (!A.length || !B.length) return { score: 0, near: false, why: 'no_words' };
  const only = (xs, set) => xs.filter(x => set.has(x)).join(' ');
  const nums = (xs) => xs.filter(x => /\d/.test(x)).join(' ');
  if (only(A, NEAR_QUESTION_WORDS) !== only(B, NEAR_QUESTION_WORDS)) return { score: 0, near: false, why: 'question_word' };
  if (only(A, NEAR_NEGATIONS) !== only(B, NEAR_NEGATIONS)) return { score: 0, near: false, why: 'negation' };
  if (nums(A) !== nums(B)) return { score: 0, near: false, why: 'number' };
  const setB = new Set(B);
  const shared = A.filter(x => setB.has(x)).length;
  const score = shared / new Set([...A, ...B]).size;
  return { score, near: score >= NEAR_THRESHOLD, why: score >= NEAR_THRESHOLD ? 'near' : 'too_different' };
}

/** Why a question may only ever be matched EXACTLY — a kind, a guard's name — or null when a near match may reach it. */
export function nearMatchBarred(question, kindOf = () => 'other', options = null) {
  const kind = kindOf(question);
  // ⭐ Owner 10-16: NOT 'screening' (relocation, years of experience, travel) — the person already chooses what is
  // remembered, so a near-worded screening question may reuse it (as Check). Salary stays barred (NEAR_MONEY_RE), and a
  // security clearance with eligibility (NEAR_ELIGIBILITY_RE).
  if (['eligibility', 'eeo', 'consent', 'opt_in'].includes(kind)) return kind;
  if (NEAR_ELIGIBILITY_RE.test(String(question ?? ''))) return 'eligibility';
  if (NEAR_MONEY_RE.test(String(question ?? ''))) return 'salary';
  if (eeoClassOf(question) || (Array.isArray(options) && eeoClassOfOptions(options.map(String)))) return 'eeo';
  if (isOptInQuestion(question)) return 'opt_in';
  if (parseWorkedHereQuestion(question)) return 'worked_here';
  if (neverFillableReason(question, options)) return 'consent';
  return null;
}

// Widget kinds a near match may cross: a text answer may go in a picker (as one of its own options) and back; a date,
// a single checkbox or a checkbox group only to its own kind.
const NEAR_KIND_FAMILY = { text: 'choice', select: 'choice', radio: 'choice', checkbox: 'checkbox', date: 'date' };

/**
 * The saved answer a unit may borrow from a question worded differently, or null. Both questions must be near-matchable
 * (nearMatchBarred), the widget kinds compatible, and the best score must be held by ONE answer — two different saved
 * answers equally near is ambiguous, and nothing is used.
 */
export function nearSavedAnswer(saved = [], unit, uk, { kindOf = () => 'other', company = '' } = {}) {
  if (!uk || nearMatchBarred(unit.question, kindOf, unitOptions(unit))) return null;
  const family = NEAR_KIND_FAMILY[uk.widgetKind];
  let best = [], bestScore = 0;
  for (const s of saved || []) {
    if (!s || s.eligibility || s.optIn || s.attesting || String(s.answer ?? '').trim() === '') continue;
    if (nearMatchBarred(s.question, kindOf, s.options)) continue;
    const sk = s.widgetKind && s.widgetKind !== 'any' ? widgetKindOf(s.widgetKind) : null;
    if (sk && NEAR_KIND_FAMILY[sk] !== family) continue;
    const { score, near } = nearQuestionScore(s.question, unit.question, company);
    if (!near) continue;
    if (score > bestScore) { best = [s]; bestScore = score; } else if (score === bestScore) best.push(s);
  }
  if (!best.length) return null;
  const answers = new Set(best.map(s => normaliseQuestion(s.answer)));
  if (answers.size > 1) return null;                    // ambiguous: two different answers, equally near
  return { answer: best.sort(newestFirst)[0], score: bestScore };
}

/** Conflicts (safeguard 6): the newest acknowledged answer for a question wins. */
const newestFirst = (a, b) => String(b.acknowledgedAt || '').localeCompare(String(a.acknowledgedAt || ''));

const isCombo = (f) => f.widget === 'dropdown';
const isTypeahead = (f) => f.widget === 'typeahead';
const stepFor = (f, value, extra) => ({
  index: f.index, name: f.name, id: f.id, label: extra.label || f.label, value,
  confidence: 1, eligibility: !!extra.eligibility, matchedBy: extra.provenance, provenance: extra.provenance,
  ...(extra.exactOption ? { exactOption: true } : {}),
  ...(extra.declineOption ? { declineOption: true } : {}),
  // ⭐ D96 §4: where a saved answer came from and when it was acknowledged — the panel says so on its row.
  ...(extra.saved ? { saved: extra.saved } : {}),
  ...(extra.expectOptions ? { expectOptions: extra.expectOptions } : {}),
  ...(extra.unit ? { unit: extra.unit } : {}),
  // ⭐ T25: a near match says so — matched by a similar question, not the same one (the panel's Check band).
  ...(extra.matchedBy ? { matchedBy: extra.matchedBy } : {}),
});

// ⭐ D96 §7 · A DATE, typed in the page's own format. `parts` are the page's inputs (month / day / year), each read off
// its placeholder or label; the answer is read as ISO (2026-11-01), M/D/YYYY, MM/YYYY or YYYY. null when the answer
// is not a date the parts can hold — never a guess at a format.
export function dateParts(answer) {
  const s = String(answer ?? '').trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/))) return { year: m[1], month: m[2], day: m[3] || null };
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return { month: m[1], day: m[2], year: m[3] };
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return { month: m[1], day: null, year: m[2] };
  if ((m = s.match(/^(\d{4})$/))) return { year: m[1], month: null, day: null };
  return null;
}
export function dateStepsFor(unit, answer, extra) {
  const d = dateParts(answer);
  if (!d) return null;
  const two = (n) => String(Number(n)).padStart(2, '0');
  const steps = [];
  for (const f of unit.parts) {
    const part = f.dateGroup?.part;
    const v = part === 'year' ? d.year : part === 'month' ? d.month : part === 'day' ? d.day : null;
    if (v == null) return null;            // the page asks for a part the answer does not have
    steps.push(stepFor(f, part === 'year' ? String(v) : two(v), { ...extra, label: `${unit.question} · ${part}` }));
  }
  return steps.length ? steps : null;
}

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
  // ⭐ D96 §7: a checkbox GROUP takes a list ("Remote (US), Seattle, WA" or a JSON array) — each named box ticked
  // EXACTLY, the others left as they are. A name that is not one of the boxes refuses the whole answer.
  if (unit.kind === 'checkbox-group') {
    let wants;
    try { wants = String(answer).trim().startsWith('[') ? JSON.parse(String(answer)) : null; } catch { wants = null; }
    const labels = unit.boxes.map(b => normaliseQuestion(b.label));
    if (!Array.isArray(wants)) {
      // A label may itself hold a comma ("Seattle, WA"): match the boxes' own labels inside the answer, longest first.
      let rest = `, ${normaliseQuestion(answer)},`;
      wants = [];
      for (const l of [...labels].sort((a, b) => b.length - a.length)) {
        if (l && rest.includes(`, ${l},`)) { wants.push(l); rest = rest.replace(`, ${l},`, ','); }
      }
      if (rest.replace(/[\s,]+/g, '')) return null;
    }
    const picks = wants.map(w => unit.boxes[labels.indexOf(normaliseQuestion(w))]);
    if (!picks.length || picks.some(p => !p)) return null;
    return picks.map(b => stepFor(b, 'true', { ...extra, label: unit.question }));
  }
  if (unit.kind === 'date') return dateStepsFor(unit, answer, extra);
  const f = unit.field;
  if (f.type === 'date') {
    const d = dateParts(answer);
    if (!d || !d.month || !d.day) return null;
    return stepFor(f, `${d.year}-${String(Number(d.month)).padStart(2, '0')}-${String(Number(d.day)).padStart(2, '0')}`, extra);
  }
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
  // ⭐ 10-21: a typeahead takes a sensitive / near answer EXACTLY too (applyPlan's setTypeahead 'exact': only an option
  // whose text IS the answer, else nothing) — Greenhouse's Yes / No and EEO questions are react-select typeaheads, and
  // refusing them left every one of those dropdowns empty even with the answer saved.
  if (isTypeahead(f)) return stepFor(f, String(answer), exact ? { ...extra, exactOption: true } : extra);
  if (optIn) return null;                       // an opt-in is a choice, not a text box
  return stepFor(f, String(answer), extra);
}

/** The step that picks the form's own decline option on an EEO unit, or null (leave it blank). */
function declineStep(unit, extra) {
  if (unit.kind === 'checkbox-group' || unit.kind === 'date') return null;   // a decline is one option, never a set or a date
  if (unit.kind === 'radio') {
    const v = pickDeclineOption(unit.radios.map((r, i) => ({ label: r.label, value: String(i) })));
    return v === null ? null : stepFor(unit.radios[Number(v)], 'true', { ...extra, label: unit.question });
  }
  const f = unit.field;
  if (Array.isArray(f.options)) {
    const v = pickDeclineOption(f.options.map(o => ({ label: o.text, value: o.value })));
    return v === null ? null : stepFor(f, v, extra);
  }
  if (isCombo(f) || isTypeahead(f)) return stepFor(f, EEO_DECLINE, { ...extra, declineOption: true });
  if (f.type === 'checkbox' || f.type === 'radio') return null;
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
/**
 * ⭐ D96 §4 (J9's browser pass, 10-14): A GUESS YIELDS TO THE CANDIDATE'S OWN ANSWER. The packet keeps carrying the
 * profile's guess for a question (a whole-token label match — "Postal Code" from a `postal` key) after the candidate
 * acknowledged an answer to that very question; the guess took the control first, the acknowledged answer behind it
 * never reached the field, and the next fill asked again — "tick once and it is remembered" broken on the second
 * application. So: every planned value that is a guess (its value guessed, or its control matched loosely) is taken
 * back off a control that placeStatedAnswers would give one of the candidate's own stated answers (the SAME question,
 * by the key — nothing looser), and that answer fills it. An exact profile answer is never displaced; a guess with no
 * stated answer for its question stays, and is still a guess the panel asks about.
 */
const GUESSED_PROVENANCE = new Set(['label_fuzzy', 'default', 'sponsorship_assumed_future']);
const isGuess = (p) => GUESSED_PROVENANCE.has(p?.provenance) || p?.matchedBy === 'label';
export function yieldGuessesToStated(plan = [], packet, fields, kindOf = () => 'other') {
  const guesses = (plan || []).filter(isGuess);
  if (!guesses.length) return plan;
  const firm = plan.filter(p => !isGuess(p));
  // ⭐ T25: only the SAME question takes a control back — a near match never displaces anything.
  const claimed = new Set(placeStatedAnswers(packet, fields, firm, kindOf).plan.filter(p => p.matchedBy !== 'near_question').map(p => p.index));
  return plan.filter(p => !isGuess(p) || !claimed.has(p.index));
}

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
    const kind = kindOf(question);
    const optionLabels = unitOptions(unit) || [];
    const eeo = kind === 'eeo' || !!eeoClassOf(question) || !!eeoClassOfOptions(optionLabels);

    // 1 · the candidate's own saved answer — the SAME question, nothing looser. ⭐ D96 §4: by the KEY — label + widget
    // kind + option wording (a legacy label-only answer by its label) — and the newest acknowledgement wins.
    const uk = unitAnswerKey(unit);
    const sa = saved.filter(s => savedAnswerFits(s, uk)).sort(newestFirst)[0] || null;
    if (sa) {
      const optIn = !!sa.optIn || kind === 'opt_in' || isOptInQuestion(question);
      if (optIn && !isNegativeAnswer(sa.answer)) { notes.push({ field: question, reason: 'opt_in_left_for_you', kind: 'opt_in' }); continue; }
      const eligibility = !!sa.eligibility || kind === 'eligibility';
      const saved = { source: sa.source || 'legacy', acknowledgedAt: sa.acknowledgedAt || null, id: sa.id ?? null,
        attesting: !!(sa.attesting ?? eligibility), questionKey: uk?.questionKey ?? null };
      // A dropdown whose options exist only once opened: the fill checks the option wording when it opens it.
      const expectOptions = uk && !uk.optionsKnown && sa.widgetKind && sa.widgetKind !== 'any' && Array.isArray(sa.options) && sa.options.length
        ? sa.options.map(String) : null;
      const step = valueStep(unit, sa.answer, { exact: eligibility || eeo || optIn, optIn, eligibility, provenance: 'saved_answer', saved, expectOptions });
      if (step) out.push(...(Array.isArray(step) ? step : [step]));
      else notes.push({ field: question, reason: 'saved_answer_not_an_option', kind });
      continue;
    }

    // 1b · ⭐ T25: the candidate's saved answer to a SIMILAR question (nearSavedAnswer — never across question kinds).
    // Always exact on a picker (one of this field's own options, or nothing); it lands as Check, naming the original.
    // An answer that fits no option here is simply not used — no note: the question is the candidate's, as before.
    const near = nearSavedAnswer(saved, unit, uk, { kindOf, company: worked?.company || packet?.company || '' });
    if (near) {
      const s = near.answer;
      const savedFrom = { source: s.source || 'legacy', acknowledgedAt: s.acknowledgedAt || null, id: s.id ?? null, attesting: false,
        questionKey: uk.questionKey, near: { question: String(s.question ?? ''), score: Math.round(near.score * 100) / 100 } };
      const step = valueStep(unit, s.answer, { exact: true, optIn: false, eligibility: false, provenance: 'saved_answer',
        matchedBy: 'near_question', saved: savedFrom });
      if (step) { out.push(...(Array.isArray(step) ? step : [step])); continue; }
    }

    // 2 · "have you worked here before?", from the stated work history.
    const parsed = worked ? parseWorkedHereQuestion(question) : null;
    if (parsed) {
      const ok = namesThisEmployer(parsed, worked.company)
        && !(parsed.widened && worked.answer === 'No') && !(parsed.timeBound && worked.answer === 'Yes');
      if (!ok) { notes.push({ field: question, reason: 'worked_here_left_for_you', kind }); continue; }
      const step = valueStep(unit, worked.answer, { exact: true, provenance: 'work_history' });
      if (step) out.push(...(Array.isArray(step) ? step : [step]));
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

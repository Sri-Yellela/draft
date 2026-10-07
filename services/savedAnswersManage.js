// ── D55 (f) piece 4 · Settings → Saved answers: list, edit, delete, export, import, test a question ─────
//
// docs/AUTOFILL_TARGET.md §8.1 rows 6–7. Pure functions over the answer store ({ answers, overrides },
// services/customAnswers.js readAnswerStore); routes/savedAnswers.js does the I/O.
//
// IMPORT RUNS THROUGH FIVE GUARDS, and is a DRY RUN unless the caller says apply:
//   1. too_large        the file, the entry count, or one question/answer over SAVED_ANSWER_LIMITS
//   2. invalid_shape    not { question: string, answer: string, company?: string } — and ⛔ any
//                       keyword / "appearances" / threshold rule (SpeedyApply's matching method) is
//                       refused outright: draft matches exact words only, and a file that says
//                       otherwise is describing a matcher draft does not have
//   3. protected_class  ⛔ eligibility (work authorisation, sponsorship, citizenship, visa, clearance,
//                       criminal history), EEO and opt-in questions are NEVER imported. Each is an
//                       attestation the candidate answers on the exact question, in the product — a
//                       bulk file from another tool, matched there by keywords, is precisely how
//                       `work_authorization` once answered an inverted sponsorship question (D36).
//   4. duplicate        the same normalised question twice in one file — the second is refused
//   5. conflict         an existing entry for the same normalised question with a DIFFERENT answer is
//                       kept, and reported, unless overwrite:true
// Nothing here calls a model (D17).

import { buildAnswers, eligibilityClassOf, ELIGIBILITY_CANONICAL_KEYS, PROVENANCE } from "./applyAutomation.js";
import { resolveForCompany, isMotivationQuestion, isTemplate, expandCompany, companyKey } from "./customAnswers.js";
import {
  normaliseQuestion, questionKey, isOptInQuestion, parseWorkedHereQuestion, SAVED_ANSWER_LIMITS, WORKED_HERE_REASONS,
} from "../shared/savedAnswers.js";

/** What kind of question this is, for the Settings list and the import guard. */
export function classifyQuestion(question) {
  const eligibility = eligibilityClassOf(question);
  return {
    eligibility: eligibility && eligibility !== "eeo" ? eligibility : null,
    eeo: eligibility === "eeo",
    optIn: isOptInQuestion(question),
    motivation: isMotivationQuestion(question),
    workedHere: !!parseWorkedHereQuestion(question),
    template: isTemplate(question),
  };
}

/** The store as rows for Settings: answers (every employer) then per-company overrides. */
export function listEntries(store) {
  const answers = Object.entries(store?.answers || {}).map(([question, answer]) => ({
    question, answer, company: null, kind: classifyQuestion(question),
  }));
  const overrides = [];
  for (const [company, byQ] of Object.entries(store?.overrides || {})) {
    for (const [question, answer] of Object.entries(byQ)) overrides.push({ question, answer, company, kind: classifyQuestion(question) });
  }
  return [...answers, ...overrides];
}

// ── Edit / delete ───────────────────────────────────────────────────────────────────────────────

/** Edit (or rename) one entry. A rename to a question that already exists replaces that entry. */
export function editEntry(store, { question, answer, previousQuestion = null, company = null }) {
  const q = String(question ?? "").trim();
  const a = String(answer ?? "");
  if (!q) throw codeError("question_required");
  if (q.length > SAVED_ANSWER_LIMITS.maxQuestionChars || a.length > SAVED_ANSWER_LIMITS.maxAnswerChars) throw codeError("too_long");
  const next = cloneStore(store);
  const map = company ? (next.overrides[companyKey(company)] ||= {}) : next.answers;
  const prev = previousQuestion != null ? String(previousQuestion) : q;
  if (!Object.prototype.hasOwnProperty.call(map, prev) && previousQuestion != null) throw codeError("not_found");
  delete map[prev];
  const k = normaliseQuestion(q);
  for (const existing of Object.keys(map)) if (normaliseQuestion(existing) === k) delete map[existing];
  if (!company && Object.keys(map).length >= SAVED_ANSWER_LIMITS.maxEntries) throw codeError("too_many");
  map[q] = a;
  return next;
}

export function deleteEntry(store, { question, company = null }) {
  const next = cloneStore(store);
  const key = company ? companyKey(company) : null;
  const map = key ? next.overrides[key] : next.answers;
  if (!map || !Object.prototype.hasOwnProperty.call(map, question)) throw codeError("not_found");
  delete map[question];
  if (key && Object.keys(map).length === 0) delete next.overrides[key];
  return next;
}

// ── Export ──────────────────────────────────────────────────────────────────────────────────────

export function exportJson(store) {
  return { version: 1, kind: "draft-saved-answers", answers: { ...(store?.answers || {}) }, overrides: cloneStore(store).overrides };
}

const csvCell = (v) => {
  const s = String(v ?? "");
  // A leading = + - @ is a formula to a spreadsheet; prefix it so opening the export runs nothing.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function exportCsv(store) {
  const lines = ["question,answer,company"];
  for (const r of listEntries(store)) lines.push([r.question, r.answer, r.company || ""].map(csvCell).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** RFC 4180-ish: quoted cells, doubled quotes, CRLF or LF. Returns rows of strings. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}

// ── Import ──────────────────────────────────────────────────────────────────────────────────────

const FUZZY_KEYS = ["keywords", "keyword", "appearances", "threshold", "match", "matching", "fuzzy", "tags", "pattern", "regex"];
// Profile keys that ARE an eligibility or EEO answer: "gender": "Female" in a file is not a question.
const PROTECTED_KEYS = new Set(Object.values(ELIGIBILITY_CANONICAL_KEYS).flat().map(k => k.toLowerCase()));

/** The file → raw entries [{ question, answer, company, extra }], or a file-level error. */
export function readImportFile({ format, content }) {
  const text = typeof content === "string" ? content : JSON.stringify(content ?? null);
  if (Buffer.byteLength(text, "utf8") > SAVED_ANSWER_LIMITS.maxImportBytes) return { error: "too_large" };
  if (format === "csv") {
    const rows = parseCsv(text);
    if (!rows.length) return { error: "empty" };
    const head = rows[0].map(h => h.trim().toLowerCase());
    const qi = head.indexOf("question"), ai = head.indexOf("answer"), ci = head.indexOf("company");
    if (qi < 0 || ai < 0) return { error: "csv_needs_question_and_answer_columns" };
    const extraCols = head.filter(h => FUZZY_KEYS.includes(h));
    return {
      entries: rows.slice(1).map(r => ({
        question: r[qi], answer: r[ai], company: ci >= 0 ? r[ci] : null,
        extra: extraCols.length ? extraCols : null,
      })),
    };
  }
  let data;
  try { data = typeof content === "string" ? JSON.parse(content) : content; } catch { return { error: "invalid_json" }; }
  const entries = [];
  if (Array.isArray(data)) {
    for (const e of data) {
      const extra = e && typeof e === "object" ? Object.keys(e).filter(k => FUZZY_KEYS.includes(k.toLowerCase())) : [];
      entries.push({ question: e?.question, answer: e?.answer, company: e?.company ?? null, extra: extra.length ? extra : null, raw: e });
    }
  } else if (data && typeof data === "object") {
    for (const [question, answer] of Object.entries(data.answers || {})) entries.push({ question, answer, company: null });
    for (const [company, byQ] of Object.entries(data.overrides || {})) {
      if (!byQ || typeof byQ !== "object") continue;
      for (const [question, answer] of Object.entries(byQ)) entries.push({ question, answer, company });
    }
  } else return { error: "invalid_shape" };
  return { entries };
}

/**
 * Validate an import against the store through the five guards.
 * Returns { accepted: [{question, answer, company}], rejected: [{row, question, reason}], store } — `store`
 * is the store as it WOULD be; the caller writes it only on apply.
 */
export function validateImport(store, rawEntries, { overwrite = false } = {}) {
  const accepted = [], rejected = [];
  if (rawEntries.length > SAVED_ANSWER_LIMITS.maxEntries) {
    return { accepted, rejected: [{ row: null, question: null, reason: "too_large:too_many_entries" }], store, fileRefused: true };
  }
  const next = cloneStore(store);
  const seen = new Set();
  rawEntries.forEach((e, i) => {
    const row = i + 1;
    const reject = (reason) => rejected.push({ row, question: typeof e.question === "string" ? e.question : null, reason });
    if (e.extra) return reject(`invalid_shape:fuzzy_rule_not_supported(${e.extra.join(",")})`);
    if (typeof e.question !== "string" || (typeof e.answer !== "string" && typeof e.answer !== "number" && typeof e.answer !== "boolean")) {
      return reject("invalid_shape:question_and_answer_must_be_text");
    }
    const question = e.question.trim();
    const answer = String(e.answer).trim();
    const company = typeof e.company === "string" && e.company.trim() ? e.company.trim() : null;
    if (!question || !answer) return reject("invalid_shape:empty");
    if (question.length > SAVED_ANSWER_LIMITS.maxQuestionChars || answer.length > SAVED_ANSWER_LIMITS.maxAnswerChars) return reject("too_large:entry");
    const kind = classifyQuestion(question);
    if (PROTECTED_KEYS.has(question.toLowerCase().replace(/\s+/g, "_"))) return reject("protected_class:profile_key");
    if (kind.eligibility) return reject(`protected_class:eligibility:${kind.eligibility}`);
    if (kind.eeo) return reject("protected_class:eeo");
    if (kind.optIn) return reject("protected_class:opt_in");
    const dupKey = `${company ? companyKey(company) : ""}\u0000${normaliseQuestion(question)}`;
    if (seen.has(dupKey)) return reject("duplicate");
    seen.add(dupKey);
    const map = company ? (next.overrides[companyKey(company)] ||= {}) : next.answers;
    const existing = Object.keys(map).find(k => normaliseQuestion(k) === normaliseQuestion(question));
    if (existing !== undefined && map[existing] !== answer && !overwrite) return reject("conflict:existing_answer_kept");
    if (existing !== undefined) delete map[existing];
    if (!company && Object.keys(next.answers).length >= SAVED_ANSWER_LIMITS.maxEntries) return reject("too_large:store_full");
    map[question] = answer;
    accepted.push({ question, answer, company });
  });
  for (const [c, byQ] of Object.entries(next.overrides)) if (!Object.keys(byQ).length) delete next.overrides[c];
  return { accepted, rejected, store: next };
}

// ── Test a question ─────────────────────────────────────────────────────────────────────────────

const REFUSAL_WORDS = [
  [/^custom:eligibility_class:eeo/, "it is an EEO question, so only your answer to exactly this wording may fill it"],
  [/^custom:eligibility_class:(\w+)/, (m) => `it is a ${m[1].replace("_", " ")} question, so only your answer to exactly this wording may fill it`],
  [/^custom:opt_in_exact_only|^opt_in:exact_answer_only/, "it is an opt-in, answered only by your own exact No"],
  [/^opt_in:never_opt_in/, "it is an opt-in and your saved answer is Yes — draft never opts you in"],
  [/^worked_here:(\w+)/, (m) => `work history: ${WORKED_HERE_REASONS[m[1]] || m[1]}`],
  [/^eeo:decline_option_absent/, "you declined, and the form offers no decline option"],
];
const sayRefusal = (r) => {
  for (const [re, say] of REFUSAL_WORDS) { const m = r.match(re); if (m) return typeof say === "function" ? say(m) : say; }
  return r;
};

/**
 * Paste a question → which saved answer matches it and why, or "no match: it would stop".
 * Runs the REAL resolver (buildAnswers) on the real payload for this employer, so the tool cannot
 * disagree with a fill. It tests the question's WORDING; a form's control attributes can still
 * route a standard field (name, email) through the profile.
 */
export function testQuestion({ payload, store, question, company = null, options = null }) {
  const q = String(question ?? "").trim();
  const kind = classifyQuestion(q);
  const opts = Array.isArray(options) && options.length
    ? options.map(o => (typeof o === "string" ? { value: o, label: o } : o)) : [];
  const field = { field_id: "test", name: "", label: q, type: opts.length ? "select" : "text", options: opts, is_required: true, handler_type: null };
  const [res] = buildAnswers([field], payload || {});
  const { withheld } = resolveForCompany(store, company);

  const out = {
    question: q, company: company || null,
    normalised: normaliseQuestion(q), template: questionKey(q, company),
    kind, outcome: "stops", value: null, provenance: null, matched: null,
    refusals: res?.refusals || [], why: [],
  };
  if (res && !res.skipped && res.value != null) {
    out.value = res.value;
    out.provenance = res.provenance;
    if (res.provenance === PROVENANCE.CUSTOM_ANSWER) {
      const src = sourceOf(store, company, res.matched_on);
      const tier = normaliseQuestion(res.matched_on) === normaliseQuestion(q) ? "exact" : "contained";
      out.matched = { source: src.source, stored: src.stored, tier };
      out.outcome = "fills";
      out.why.push(tier === "exact"
        ? `Your saved answer to "${src.stored}" matches these exact words${src.source === "override" ? ` (your answer for ${company} only)` : src.source === "template" ? ` ({company} → ${company})` : ""}.`
        : `Your saved question "${src.stored}" appears inside this one. Containment is never used for eligibility, EEO or opt-in questions.`);
    } else if (String(res.matched_on || "").startsWith("work_history:")) {
      out.matched = { source: "work_history", stored: null, tier: "exact" };
      out.outcome = "fills";
      out.why.push(`Answered "${res.value}" from your work history: ${WORKED_HERE_REASONS[res.matched_on.split(":")[1]]}.`);
    } else {
      out.matched = { source: "profile", stored: res.matched_on, tier: res.provenance };
      const guess = res.provenance === PROVENANCE.LABEL_FUZZY || res.provenance === PROVENANCE.DEFAULT;
      out.outcome = guess ? "guess" : "fills";
      out.why.push(guess
        ? `No saved answer matches. Your profile's "${res.matched_on}" is a guess for these words — the fill would hold for your confirmation.`
        : `No saved answer matches; your profile's "${res.matched_on}" answers it.`);
    }
  } else {
    const held = withheld.find(w => normaliseQuestion(w.question) === normaliseQuestion(q));
    out.why.push(held
      ? `No match: it would stop. "${held.template}" is a motivation question — it needs your own words for ${company}.`
      : "No match: it would stop.");
  }
  for (const r of out.refusals) out.why.push(`Not used: ${sayRefusal(r)}.`);
  return out;
}

function sourceOf(store, company, matchedOn) {
  const want = normaliseQuestion(matchedOn);
  const key = companyKey(company);
  for (const q of Object.keys((key && store?.overrides?.[key]) || {})) {
    if (normaliseQuestion(expandCompany(q, company)) === want) return { source: "override", stored: q };
  }
  for (const q of Object.keys(store?.answers || {})) {
    const expanded = isTemplate(q) ? expandCompany(q, company) : q;
    if (normaliseQuestion(expanded) === want) return { source: isTemplate(q) ? "template" : "saved", stored: q };
  }
  return { source: "saved", stored: matchedOn };
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────

function cloneStore(store) {
  const overrides = {};
  for (const [c, byQ] of Object.entries(store?.overrides || {})) overrides[c] = { ...byQ };
  return { answers: { ...(store?.answers || {}) }, overrides };
}
function codeError(code) { const e = new Error(code); e.code = code; return e; }

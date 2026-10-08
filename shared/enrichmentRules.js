// shared/enrichmentRules.js — THE ENRICHMENT IMPORTER'S RULES, in one place the server, the CLI and the browser all read.
//
// D83 BUILD 1c: the Admin Enrichment page checks a model's reply THE INSTANT it is uploaded, in the browser, against
// the importer's own rules. A second copy of those rules in the client would drift the first time a column or an
// allowed value changed — and a reply the page called "Checked" would then be refused by the server. So the rules
// moved here from services/jobs/enrichmentTransfer.js (validateColumn, parseJsonl) and enrichmentSelection.js
// (ENRICHMENT_COLUMNS); both re-export them, so every server caller is unchanged.
//
// ⛔ Pure: no Node built-ins, no database, no network — it is imported by client/src as well as by the server.
import { EXPERIENCE_LEVELS, WORK_MODELS, valueSet, values } from "./jobFilterOptions.js";

/** The columns enrichment writes. Coverage is reported per column, never as one total. */
export const ENRICHMENT_COLUMNS = [
  'summary', 'normalized_title', 'experience_level', 'workplace_type',
  'salary_min_usd', 'salary_max_usd', 'salary_period', 'skills_json',
  'is_h1b_sponsor', 'requires_work_auth', 'is_clearance_required', 'org_unit_raw',
];

/**
 * The most rows one batch takes. D84 F14 (owner, 10-09: "30 a batch is too small — do it all at once"): 2,000, up from
 * 500. Checked: the import is ONE transaction (all or nothing) and the upload limit is 32 MB (routes/enrichment.js);
 * an import row is ~1.2 KB, so 2,000 rows is ~2.4 MB — nothing below 2,000 is a real limit. The pieces exist only for
 * the chat step, and their size is a separate setting (PIECE_SIZES).
 */
export const IMPORT_ROW_CAP = 2000;

// The same two enums schema.js coerces against and enrichJob.js validates the model against, from
// the same shared table. A third copy of the experience-level vocabulary is exactly what
// shared/jobFilterOptions.js exists to prevent.
const VALID_EXPERIENCE_LEVELS = valueSet(EXPERIENCE_LEVELS);
const VALID_WORKPLACE_TYPES   = valueSet(WORK_MODELS);
export const SALARY_PERIODS   = ['annual', 'hourly', 'monthly'];
const VALID_SALARY_PERIODS    = new Set(SALARY_PERIODS);

export const INT_COLUMNS  = ['salary_min_usd', 'salary_max_usd'];
export const FLAG_COLUMNS = ['is_h1b_sponsor', 'requires_work_auth', 'is_clearance_required'];
export const TEXT_COLUMNS = ['summary', 'normalized_title', 'org_unit_raw'];
export const TEXT_CAPS    = { summary: 300, normalized_title: 200, org_unit_raw: 120 };

/** The allowed values of each enum column, for the prompt and the page — read, never restated. */
export const ALLOWED_VALUES = {
  experience_level: values(EXPERIENCE_LEVELS),
  workplace_type: values(WORK_MODELS),
  salary_period: SALARY_PERIODS,
};

/** Parses JSONL, tolerating blank lines and the `_meta` header. Malformed JSON is a row error. */
export function parseJsonl(text) {
  const rows = [];
  const errors = [];
  let meta = null;
  const lines = String(text ?? '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); }
    catch (e) { errors.push({ line: i + 1, error: `unparseable JSON: ${e.message}` }); continue; }
    if (obj && obj._meta) { meta = obj._meta; continue; }
    rows.push({ line: i + 1, obj });
  }
  return { rows, meta, errors };
}

/**
 * Validates ONE column value. Returns `{ ok, value }` or `{ ok:false, error }`.
 *
 * `undefined` means "not supplied" and is dropped; `null` means "explicitly nothing" and is also
 * dropped, because a null carries no information and writing one is the clobber this file refuses.
 * Neither is an error — a filler leaving a column blank is the normal case.
 *
 * ⛔ ENUMS ARE CHECKED AGAINST THE REGISTRY, NOT AGAINST "IS A STRING". Free text in
 * experience_level does not fail loudly at write time — it lands in the column, the board's filter
 * silently never matches it, and the row is invisible to exactly the query it should answer.
 */
export function validateColumn(column, raw) {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };

  if (column === 'experience_level') {
    return VALID_EXPERIENCE_LEVELS.has(raw)
      ? { ok: true, value: raw }
      : { ok: false, error: `experience_level must be one of ${[...VALID_EXPERIENCE_LEVELS].join(' | ')}, got ${JSON.stringify(raw)}` };
  }
  if (column === 'workplace_type') {
    return VALID_WORKPLACE_TYPES.has(raw)
      ? { ok: true, value: raw }
      : { ok: false, error: `workplace_type must be one of ${[...VALID_WORKPLACE_TYPES].join(' | ')}, got ${JSON.stringify(raw)}` };
  }
  if (column === 'salary_period') {
    return VALID_SALARY_PERIODS.has(raw)
      ? { ok: true, value: raw }
      : { ok: false, error: `salary_period must be one of ${[...VALID_SALARY_PERIODS].join(' | ')}, got ${JSON.stringify(raw)}` };
  }
  if (INT_COLUMNS.includes(column)) {
    // Integers, and a STRING "120000" is rejected rather than coerced. Coercion here would make the
    // importer's contract "whatever JSON.parse and Number happen to agree on", which is not a
    // contract anyone can write a file against.
    if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw)) {
      return { ok: false, error: `${column} must be an integer number, got ${JSON.stringify(raw)}` };
    }
    if (raw < 0) return { ok: false, error: `${column} must not be negative, got ${raw}` };
    return { ok: true, value: raw };
  }
  if (FLAG_COLUMNS.includes(column)) {
    // 0/1 only — and true/false, since JSON's native booleans are what a filler will reach for.
    // Nothing else: "yes", 2 and "" are all rejected.
    if (raw === 0 || raw === 1) return { ok: true, value: raw };
    if (raw === true) return { ok: true, value: 1 };
    if (raw === false) return { ok: true, value: 0 };
    return { ok: false, error: `${column} must be 0, 1, true, false or null, got ${JSON.stringify(raw)}` };
  }
  if (column === 'skills_json') {
    // Accepts the two shapes skills_json already holds board-wide (see mapJobRow's parseSkillsList):
    // plain strings, or { skill, type } objects. Stored as a JSON string, which is what the column is.
    let arr = raw;
    if (typeof raw === 'string') {
      try { arr = JSON.parse(raw); }
      catch (e) { return { ok: false, error: `skills_json is a string but not parseable JSON: ${e.message}` }; }
    }
    if (!Array.isArray(arr)) return { ok: false, error: `skills_json must be an array, got ${typeof arr}` };
    const norm = [];
    for (const entry of arr) {
      if (typeof entry === 'string') {
        if (entry.trim()) norm.push({ skill: entry.trim(), type: 'hard' });
        continue;
      }
      if (entry && typeof entry === 'object' && typeof entry.skill === 'string' && entry.skill.trim()) {
        const type = entry.type === 'soft' ? 'soft' : 'hard';
        norm.push({ skill: entry.skill.trim(), type });
        continue;
      }
      return { ok: false, error: `skills_json entries must be strings or {skill,type} objects, got ${JSON.stringify(entry)}` };
    }
    // An empty array is "no skills", which carries no information and is dropped rather than
    // written as "[]" — a "[]" in the column reads as enriched-and-found-nothing and would keep
    // the row out of any future attempt to fill it.
    return { ok: true, value: norm.length ? JSON.stringify(norm) : undefined };
  }
  if (TEXT_COLUMNS.includes(column)) {
    if (typeof raw !== 'string') return { ok: false, error: `${column} must be a string, got ${typeof raw}` };
    const t = raw.trim();
    if (!t) return { ok: true, value: undefined };
    return { ok: true, value: t.slice(0, TEXT_CAPS[column]) };
  }
  return { ok: false, error: `${column} is not an importable enrichment column` };
}

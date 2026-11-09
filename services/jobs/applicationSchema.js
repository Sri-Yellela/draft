/**
 * D185-1 (45q, owner 11-09) · THE APPLICATION-SCHEMA READER — a posting's real application questions, read from the
 * ATS's own PUBLIC, DOCUMENTED endpoint, cached per posting, and handed to the fill (the gate packet) and to tailoring.
 * ---------------------------------------------------------------------------------------------------------------------
 * WHY (D185 P1b): the plan proposed Jobo's MCP for "clean JSON" of a posting's form. Rejected — draft already reads the
 * source ATS directly, and an MCP hop would put a third party inside the apply path where candidate data flows. This is
 * the same benefit with no dependency: before a form is ever opened, draft knows what it will ask.
 *
 * ⛔ DOCUMENTED ENDPOINTS ONLY. A reader exists for an ATS only when its public job-board API documents the questions:
 *   greenhouse  GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?questions=true
 *               (Job Board API: `questions`, `location_questions`, `compliance`, `demographic_questions`)
 * Lever's postings API, Ashby's posting API, SmartRecruiters' and Workable's public feeds publish NO application form, so
 * those answer `unsupported` — never a scrape of the apply page, never an undocumented GraphQL. `unsupported` is a
 * result, cached like any other, so the fill falls back to discovery on the live form exactly as it did before.
 *
 * THE SHAPE handed on is discoverFields()'s (services/applyAutomation.js), because buildAnswers() consumes that shape and
 * this must not become a second dialect of it (the same rule applyGatePacket.js's CANONICAL_GATE_FIELDS follows).
 */

import axios from 'axios';
import { detectKnownAtsMatch } from './importJob.js';

export const SCHEMA_STATUSES = Object.freeze(['ok', 'unsupported', 'not_found', 'error']);
/** A posting's form rarely changes; a day keeps the read cheap and the fill current. Errors retry sooner. */
export const SCHEMA_MAX_AGE_SEC = 24 * 60 * 60;
export const SCHEMA_ERROR_RETRY_SEC = 60 * 60;

/** The ATS families with a DOCUMENTED public questions endpoint. Adding one needs its documentation cited above. */
export const DOCUMENTED_SCHEMA_ATS = Object.freeze(new Set(['greenhouse']));

const GREENHOUSE_BASE = 'https://boards-api.greenhouse.io/v1/boards';
const SLUG_RE = /^[a-z0-9][a-z0-9_.-]{0,99}$/i;
const ID_RE = /^\d{1,20}$/;

// Greenhouse's standard field names → the handler types buildAnswers looks up (PROFILE_KEY_TO_HANDLER's own strings —
// a near miss resolves nothing). A custom question (question_123…) keeps handler_type null: buildAnswers then matches it
// by its LABEL against the person's own saved answers, which is the only honest way to answer a question we didn't write.
const GREENHOUSE_HANDLER = Object.freeze({
  first_name: 'first-name', last_name: 'last-name', preferred_name: null, email: 'email', phone: 'phone',
  location: 'location',
});

const GREENHOUSE_TYPE = Object.freeze({
  input_text: 'text', textarea: 'textarea', input_file: 'file', input_hidden: 'hidden',
  multi_value_single_select: 'select', multi_value_multi_select: 'multiselect',
});

/**
 * Which ATS posting a stored job is, from its req_uid (`greenhouse:<company>:<id>`) or its URL; the board token comes
 * from company_ats_list (the crawler's own record), never guessed from a company name.
 * @returns {{ ats: string, board: string|null, externalId: string|null } | null}
 */
export function postingRef(db, job) {
  if (!job) return null;
  let ats = null, externalId = null, board = null;
  const uid = String(job.req_uid || '');
  const m = /^([a-z]+):[^:]*:(.+)$/.exec(uid);
  if (m) { ats = m[1]; externalId = m[2]; }
  for (const u of [job.apply_url, job.url]) {
    if (!u) continue;
    const hit = detectKnownAtsMatch(u);
    if (hit && (!ats || hit.type === ats)) {
      ats = ats || hit.type;
      externalId = externalId || hit.externalId || null;
      board = board || hit.slug || null;
    }
    if (!externalId) {
      try { const gh = new URL(u).searchParams.get('gh_jid'); if (gh && ID_RE.test(gh)) { ats = ats || 'greenhouse'; externalId = gh; } } catch { /* not a URL */ }
    }
  }
  if (!ats) ats = String(job.source || '').toLowerCase() || null;
  if (!ats) return null;
  if (!board && db && job.company) {
    try {
      const row = db.prepare('SELECT ats_slug FROM company_ats_list WHERE ats_type = ? AND company = ? LIMIT 1').get(ats, job.company);
      board = row?.ats_slug || null;
    } catch { /* no company_ats_list in a bare test db */ }
  }
  return { ats, board, externalId };
}

/** Greenhouse's documented `questions` (+ location / compliance) → discoverFields()-shaped fields. Pure. */
export function normalizeGreenhouseQuestions(body) {
  const fields = [];
  const groups = [
    ...(Array.isArray(body?.questions) ? body.questions.map(q => ({ q, group: 'application' })) : []),
    ...(Array.isArray(body?.location_questions) ? body.location_questions.map(q => ({ q, group: 'location' })) : []),
  ];
  for (const { q, group } of groups) {
    for (const f of Array.isArray(q?.fields) ? q.fields : []) {
      if (!f?.name) continue;
      // resume_text / cover_letter_text are the same question's paste-instead box (live read, 11-09: Airbnb's form) — the
      // run attaches the file, so they are a file question too, never "unresolved".
      const type = /^(resume|cover_letter)_text$/.test(String(f.name)) ? 'file' : (GREENHOUSE_TYPE[f.type] || 'unknown');
      fields.push({
        field_id: `gh_${f.name}`,
        name: String(f.name),
        label: String(q.label || f.name).trim(),
        type,
        handler_type: Object.prototype.hasOwnProperty.call(GREENHOUSE_HANDLER, f.name) ? GREENHOUSE_HANDLER[f.name] : null,
        is_required: !!q.required,
        options: Array.isArray(f.values) ? f.values.map(v => ({ label: String(v?.label ?? v?.value ?? ''), value: String(v?.value ?? v?.label ?? '') })) : [],
        description: q.description ? String(q.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) : null,
        group,
        custom: /^question_\d+/.test(String(f.name)),
      });
    }
  }
  // Compliance (EEO / OFCCP) questions are voluntary and answered only by the person's own decline / answer — they are
  // listed so the fill knows they exist, never with a handler that could answer them for the person.
  for (const c of Array.isArray(body?.compliance) ? body.compliance : []) {
    for (const q of Array.isArray(c?.questions) ? c.questions : []) {
      for (const f of Array.isArray(q?.fields) ? q.fields : []) {
        if (!f?.name) continue;
        fields.push({
          field_id: `gh_${f.name}`, name: String(f.name), label: String(q.label || f.name).trim(),
          type: GREENHOUSE_TYPE[f.type] || 'unknown', handler_type: null, is_required: !!q.required,
          options: Array.isArray(f.values) ? f.values.map(v => ({ label: String(v?.label ?? ''), value: String(v?.value ?? '') })) : [],
          description: null, group: 'compliance', custom: false,
        });
      }
    }
  }
  return fields;
}

/** Read one posting's schema from its ATS. Never throws: the status says what happened. */
export async function readApplicationSchema(ref, { http = axios, timeoutMs = 8000 } = {}) {
  if (!ref?.ats || !DOCUMENTED_SCHEMA_ATS.has(ref.ats)) return { status: 'unsupported', ats: ref?.ats || null, fields: [] };
  if (ref.ats === 'greenhouse') {
    if (!ref.board || !SLUG_RE.test(ref.board) || !ref.externalId || !ID_RE.test(String(ref.externalId))) {
      return { status: 'not_found', ats: 'greenhouse', fields: [], error: 'no board token or job id' };
    }
    const url = `${GREENHOUSE_BASE}/${encodeURIComponent(ref.board)}/jobs/${encodeURIComponent(ref.externalId)}?questions=true`;
    try {
      const res = await http.get(url, { timeout: timeoutMs, validateStatus: () => true });
      if (res.status === 404) return { status: 'not_found', ats: 'greenhouse', fields: [], error: 'HTTP 404' };
      if (res.status < 200 || res.status >= 300) return { status: 'error', ats: 'greenhouse', fields: [], error: `HTTP ${res.status}` };
      return { status: 'ok', ats: 'greenhouse', fields: normalizeGreenhouseQuestions(res.data) };
    } catch (e) {
      return { status: 'error', ats: 'greenhouse', fields: [], error: String(e?.message || e).slice(0, 200) };
    }
  }
  return { status: 'unsupported', ats: ref.ats, fields: [] };
}

function rowToSchema(row) {
  if (!row) return null;
  let fields = [];
  try { fields = JSON.parse(row.fields_json || '[]'); } catch { fields = []; }
  return { jobId: row.job_id, status: row.status, ats: row.ats, fields, fetchedAt: row.fetched_at, error: row.error || null };
}

/** The cached schema, synchronously — what the (sync) gate-packet builders read. Null when never read. */
export function cachedApplicationSchema(db, jobId) {
  try {
    return rowToSchema(db.prepare('SELECT * FROM posting_application_schemas WHERE job_id = ?').get(String(jobId)));
  } catch { return null; }
}

function isFresh(row, nowSec) {
  if (!row) return false;
  const age = nowSec - Number(row.fetchedAt || 0);
  return row.status === 'error' ? age < SCHEMA_ERROR_RETRY_SEC : age < SCHEMA_MAX_AGE_SEC;
}

/**
 * The posting's schema: the cache when fresh, else one read from the ATS, stored. `job` is a scraped_jobs row
 * (job_id, source, url, apply_url, company, req_uid).
 */
export async function getApplicationSchema(db, job, { http = axios, now = () => Math.floor(Date.now() / 1000), force = false } = {}) {
  if (!job?.job_id) return null;
  const nowSec = now();
  const cached = cachedApplicationSchema(db, job.job_id);
  if (!force && isFresh(cached, nowSec)) return cached;
  const ref = postingRef(db, job);
  const read = await readApplicationSchema(ref, { http });
  db.prepare(`INSERT INTO posting_application_schemas (job_id, ats, status, fields_json, error, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET ats=excluded.ats, status=excluded.status, fields_json=excluded.fields_json,
        error=excluded.error, fetched_at=excluded.fetched_at`)
    .run(String(job.job_id), read.ats, read.status, JSON.stringify(read.fields || []), read.error || null, nowSec);
  return cachedApplicationSchema(db, job.job_id);
}

/** Fire-and-forget warm-up (a job queued for apply, a packet prepared): the next packet reads it from the cache. */
export function warmApplicationSchema(db, job, opts = {}) {
  // The suite never reaches a live ATS (test-support/isolateTrackingSink.mjs sets it off); tests call getApplicationSchema with a fake http.
  if (process.env.DRAFT_SCHEMA_READER === 'off') return;
  getApplicationSchema(db, job, opts).catch(() => { /* a failed warm-up costs nothing: discovery still runs */ });
}

/** The fields the fill should know about before it opens the form — what the gate packet takes as `atsQuestions`. */
export function schemaFieldsForFill(schema) {
  return schema?.status === 'ok' ? schema.fields.filter(f => f.type !== 'hidden') : [];
}

/**
 * The free-text questions worth tailoring an answer for (a "Why do you want to work here?" textarea), with their
 * wording — tailoring may DRAFT for them; the person approves. Short identity / file / select fields are not included.
 */
export function schemaQuestionsForTailoring(schema) {
  return schemaFieldsForFill(schema)
    .filter(f => f.custom && (f.type === 'textarea' || f.type === 'text') && f.label.length >= 12)
    .map(f => ({ name: f.name, label: f.label, required: f.is_required, description: f.description }));
}

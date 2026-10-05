// services/jobs/atsGradeTransfer.js
//
// A76 UNDER D17 — THE VALIDATION CORPUS IS GRADED OUTSIDE THE PRODUCT: EXPORT → GRADE → IMPORT.
//
// D17 (owner, 10-03): only résumé generation may call a model. A76 had been an API loop that graded
// postings with Sonnet; it stopped at 71 when the credit ran out, which is D17's third reason in one
// line — an unfunded balance took the validation work to zero. Now the sample is EXPORTED as a file,
// graded by whoever the owner chooses (by hand, or a free subscription elsewhere), and IMPORTED.
//
// ── REUSED, NOT REWRITTEN ───────────────────────────────────────────────────────────────────────
//
// D17 is explicit: reuse the enrichment manual path. So this file uses the same JSONL shape
// (a `_meta` line, then one row per posting), the same parser (parseJsonl), the same staleness
// interlock (computeContentHash over title + description), the same all-or-nothing refusal, and the
// same provenance (an enrichment_batches row of kind 'ats_grade', enrichment_batch_rows before-images,
// and revertBatch / revertPreview, which dispatch on kind). What is new is only what a grade needs and
// an enrichment column does not: a grade is about a posting AGAINST A PROFILE, by a named grader, so
// it lives in ats_corpus_grades (migration 126), not on scraped_jobs.
//
// ── THE GUARDS (D17's standard: the five the enrichment import has) ────────────────────────────
//
//   invalid_value  fit must be an INTEGER 1..5 — "4", 4.5, 0 and 6 are refused, never coerced
//   stale          the posting's text changed since export — a grade of text that no longer exists
//   unknown id     a job_id the export could not have produced (not on the board, not in the owner's 30)
//   concurrency    the import runs inside ONE immediate transaction; a second writer is refused, not queued
//   refusal that reconciles   any rejected row refuses the WHOLE file, and the counts always add up:
//                  rows in file = would write + unchanged + ungraded + rejected
//
// ── BLIND ───────────────────────────────────────────────────────────────────────────────────────
//
// ⛔ The export carries NO engine score, band, rank, or set label. The owner's 30 were graded without
// the engine's number on the sheet and so is this: the engine's scores are computed only at analysis,
// after the grades are in. The engine score DOES decide the sampling (stratified across its range) —
// so the file is shuffled with the seed, and the order says nothing about the score either.

import { parseJsonl } from './enrichmentTransfer.js';
import { computeContentHash } from './enrichmentSelection.js';
import { openBatch, closeBatch, recordBatchRow, GRADE_BATCH_KIND } from './enrichmentBatches.js';

export const GRADE_FILE_KIND = 'ats_grade';
export const DESC_CHARS = 6000;

/** The rubric the 10-03 model grading used, word for word, minus the "reply with JSON" instruction. */
export const GRADE_RUBRIC =
  'Grade how well each job posting fits the candidate\'s résumé, the way a careful recruiter would. ' +
  'Rate the fit from 1 (poor) to 5 (excellent). Judge from the title and description only. ' +
  'Consider role, seniority, skills and domain.';

export const GRADE_INSTRUCTIONS = [
  'Fill grade.fit on each row with a whole number 1-5 (1 poor, 5 excellent). Leave it null to skip a row.',
  'grade.note is optional free text (at most 300 characters).',
  'Do not edit job_id or content_hash, and do not add keys — an unknown key refuses the whole file.',
  'Keep the first (_meta) line. Grade against the candidate\'s base résumé for the profile named in _meta.',
  'Grade BLIND: the file carries no engine score on purpose; do not look one up before grading.',
];

// ── statistics (the same definitions as am1GradedCorpusVerify and the 10-03 script) ─────────────
function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
  return r;
}
export function spearman(xs, ys) {
  const rx = ranks(xs), ry = ranks(ys), n = xs.length;
  if (n < 2) return NaN;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}
export function kendall(xs, ys) {
  let c = 0, d = 0, tx = 0, ty = 0;
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
    const a = Math.sign(xs[i] - xs[j]), b = Math.sign(ys[i] - ys[j]);
    if (a === 0 && b === 0) continue; if (a === 0) { tx++; continue; } if (b === 0) { ty++; continue; }
    if (a === b) c++; else d++;
  }
  const n0 = c + d + tx + ty;
  return { tau: (c - d) / Math.sqrt((n0 - tx) * (n0 - ty) || 1), misordered: c + d ? d / (c + d) : 0 };
}
/** Quadratic-weighted Cohen's kappa between two ordinal labelings over the same categories. */
export function weightedKappa(a, b, k) {
  const n = a.length; if (!n) return NaN;
  const O = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < n; i++) O[a[i]][b[i]]++;
  const ra = O.map(r => r.reduce((s, x) => s + x, 0)), cb = O[0].map((_, j) => O.reduce((s, r) => s + r[j], 0));
  let num = 0, den = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const w = ((i - j) ** 2) / ((k - 1) ** 2);
    num += w * O[i][j]; den += w * (ra[i] * cb[j] / n);
  }
  return den ? 1 - num / den : 1;
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// SAMPLING — identical to the 10-03 script's sample(), so the 41 postings it graded are the first
// 41 of the same draw (on the same board). The owner's 30 are added by the caller from the fixture.
// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {object[]} boardRows active postings ({job_id, title, description, ...}), owner's 30 excluded
 * @param {(row)=>number|null} scoreJob the engine — used ONLY to stratify, never exported
 * @returns {object[]} the sampled rows in the 10-03 order
 */
export function stratifiedSample(boardRows, scoreJob, { n = 200, seed = 76 } = {}) {
  const rows = boardRows.map(r => ({ ...r, engine: scoreJob(r) }));
  const rand = rng(seed);
  const bins = Array.from({ length: 10 }, () => []);
  const max = Math.max(...rows.map(r => r.engine), 1);
  for (const r of rows) bins[Math.min(9, Math.floor((r.engine / (max + 1)) * 10))].push(r);
  const per = Math.ceil(n / 10);
  const picked = [];
  for (const b of bins) { shuffle(b, rand); for (const r of b.slice(0, per)) picked.push(r); }
  return shuffle(picked.slice(0, n), rand);
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// EXPORT
// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Builds the blind export. `postings` = the rows to grade ({job_id, title, company, location,
 * description}). Everything else about them — engine score, set, bin — stays out of the file.
 */
export function buildGradeExport(postings, { corpus, profileId, seed, note = null } = {}) {
  if (!corpus) throw new Error('buildGradeExport: corpus is required');
  const rand = rng(Number(seed ?? 0) + 1);       // a SECOND shuffle: the file's order is not the sample's
  const rows = shuffle(postings.slice(), rand).map(p => ({
    job_id: p.job_id,
    content_hash: computeContentHash(p.title, p.description),
    posting: {
      title: p.title ?? null, company: p.company ?? null, location: p.location ?? null,
      description: String(p.description ?? '').slice(0, DESC_CHARS),
    },
    grade: { fit: null, note: null },
  }));
  const meta = {
    kind: GRADE_FILE_KIND, corpus, profile_id: profileId ?? null, seed: seed ?? null,
    exportedAt: Math.floor(Date.now() / 1000), count: rows.length,
    rubric: GRADE_RUBRIC, instructions: GRADE_INSTRUCTIONS,
    writable: ['grade.fit', 'grade.note'], readOnly: ['job_id', 'content_hash', 'posting'],
    blind: 'no engine score, band, rank or set label is in this file',
    ...(note ? { note } : {}),
  };
  return { rows, meta };
}

export function toGradeJsonl({ rows, meta }) {
  return [JSON.stringify({ _meta: meta }), ...rows.map(r => JSON.stringify(r))].join('\n') + '\n';
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// IMPORT
// ────────────────────────────────────────────────────────────────────────────────────────────────

const GRADE_KEYS = ['fit', 'note'];

/** Validates one grade object. `{ok, fit, note}`; fit undefined = ungraded (skipped, not an error). */
export function validateGrade(grade) {
  if (grade == null || typeof grade !== 'object' || Array.isArray(grade)) {
    return { ok: false, error: 'row has no `grade` object' };
  }
  const unknown = Object.keys(grade).filter(k => !GRADE_KEYS.includes(k));
  if (unknown.length) return { ok: false, error: `unknown grade field(s): ${unknown.join(', ')}` };
  const raw = grade.fit;
  if (raw === null || raw === undefined) return { ok: true, fit: undefined };
  // An integer, and a STRING "4" is refused rather than coerced — the enrichment importer's rule.
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 5) {
    return { ok: false, error: `fit must be a whole number 1-5, got ${JSON.stringify(raw)}` };
  }
  let note = null;
  if (grade.note != null) {
    if (typeof grade.note !== 'string') return { ok: false, error: `note must be a string, got ${typeof grade.note}` };
    note = grade.note.trim().slice(0, 300) || null;
  }
  return { ok: true, fit: raw, note };
}

/** The default resolver: a posting's CURRENT text, from the board. */
export const boardResolver = (db) => {
  const q = db.prepare('SELECT title, description FROM scraped_jobs WHERE job_id = ?');
  return (jobId) => q.get(jobId) ?? null;
};

/**
 * The dry run. Never writes. applyGradeImport re-runs it INSIDE its write lock, so what was checked
 * is what is written.
 *
 * @param {object} o
 * @param {string} o.corpus   must equal the file's _meta.corpus
 * @param {string} o.grader   who graded this file ("owner", "chatgpt-free", …) — stored on every row
 * @param {(jobId)=>{title,description}|null} [o.resolve] where a posting's current text is read
 * @param {boolean}[o.overwrite] replace this grader's existing DIFFERENT grade (default: skip, reported)
 * @param {boolean}[o.allowStale]
 */
export function planGradeImport(db, text, { corpus, grader, resolve = null, overwrite = false, allowStale = false } = {}) {
  if (!corpus) throw new Error('planGradeImport: corpus is required');
  if (!grader || typeof grader !== 'string') throw new Error('planGradeImport: grader is required');
  const { rows, meta, errors: parseErrors } = parseJsonl(text);
  const rejected = parseErrors.map(e => ({ ...e, jobId: null, kind: 'parse' }));
  const fileErrors = [];
  if (!meta) fileErrors.push({ kind: 'wrong_file', error: 'no _meta line — not an exported grade file' });
  else {
    if (meta.kind !== GRADE_FILE_KIND) fileErrors.push({ kind: 'wrong_file', error: `_meta.kind is ${JSON.stringify(meta.kind)}, not "${GRADE_FILE_KIND}"` });
    if (meta.corpus !== corpus) fileErrors.push({ kind: 'wrong_file', error: `_meta.corpus is ${JSON.stringify(meta.corpus)}, not "${corpus}"` });
  }
  const lookup = resolve ?? boardResolver(db);
  const existingQ = db.prepare('SELECT * FROM ats_corpus_grades WHERE corpus = ? AND job_id = ? AND grader = ?');
  const planned = [];
  let unchanged = 0, ungraded = 0, skippedExisting = 0;
  const seen = new Set();

  for (const { line, obj } of rows) {
    const jobId = obj?.job_id;
    if (typeof jobId !== 'string' || !jobId) { rejected.push({ line, jobId: null, kind: 'no_job_id', error: 'row has no job_id' }); continue; }
    if (seen.has(jobId)) { rejected.push({ line, jobId, kind: 'duplicate', error: 'job_id appears more than once in this file' }); continue; }
    seen.add(jobId);
    const unknownTop = Object.keys(obj).filter(k => !['job_id', 'content_hash', 'posting', 'grade'].includes(k));
    if (unknownTop.length) { rejected.push({ line, jobId, kind: 'invalid_value', error: `unknown key(s): ${unknownTop.join(', ')}` }); continue; }

    const current = lookup(jobId);
    if (!current) { rejected.push({ line, jobId, kind: 'unknown_job_id', error: 'not a posting this export could have produced — never inserted' }); continue; }

    const exportedHash = obj.content_hash ?? null;
    if (exportedHash == null) { rejected.push({ line, jobId, kind: 'no_content_hash', error: 'row has no content_hash — cannot tell whether the posting changed' }); continue; }
    const currentHash = computeContentHash(current.title, current.description);
    const stale = exportedHash !== currentHash;
    if (stale && !allowStale) {
      rejected.push({ line, jobId, kind: 'stale',
        error: `posting changed since export (exported ${String(exportedHash).slice(0, 12)}, now ${currentHash.slice(0, 12)}) — a grade of text that no longer exists` });
      continue;
    }

    const v = validateGrade(obj.grade);
    if (!v.ok) { rejected.push({ line, jobId, kind: 'invalid_value', error: v.error }); continue; }
    if (v.fit === undefined) { ungraded++; continue; }

    const existing = existingQ.get(corpus, jobId, grader) ?? null;
    if (existing && existing.fit === v.fit && existing.content_hash === exportedHash) { unchanged++; continue; }
    if (existing && !overwrite) { skippedExisting++; unchanged++; planned.push({ line, jobId, wouldWrite: false, skipped: { has: existing.fit, file: v.fit } }); continue; }
    planned.push({ line, jobId, wouldWrite: true, fit: v.fit, note: v.note, contentHash: exportedHash, stale, existing });
  }

  const wouldWrite = planned.filter(p => p.wouldWrite).length;
  const rowRejected = rejected.length;
  // ⛔ THE REFUSAL RECONCILES. Every row is in exactly one bucket, or this is a defect in the planner.
  const reconciles = rows.length + parseErrors.length === wouldWrite + unchanged + ungraded + rowRejected;
  if (!reconciles) throw new Error(`planGradeImport: counts do not reconcile (${rows.length + parseErrors.length} rows vs ${wouldWrite}+${unchanged}+${ungraded}+${rowRejected})`);
  return {
    meta, corpus, grader, overwrite, allowStale,
    rowsInFile: rows.length + parseErrors.length, wouldWrite, unchanged, ungraded, skippedExisting,
    rejected: [...fileErrors.map(e => ({ line: null, jobId: null, ...e })), ...rejected],
    planned,
    valid: fileErrors.length === 0 && rejected.length === 0,
  };
}

/**
 * Applies a grade file, all or nothing, with provenance. Refuses the whole file on any rejection.
 * The plan is RE-RUN inside an immediate transaction: a second writer at the same time gets
 * SQLITE_BUSY, which is reported as a refusal (`concurrent_import`) with nothing written.
 */
export function applyGradeImport(db, text, opts = {}) {
  const dry = planGradeImport(db, text, opts);
  if (!dry.valid) {
    return { ok: false, plan: dry, written: 0, batchId: null,
      reason: `${dry.rejected.length} row(s) rejected — the whole file is refused and NOTHING was written.` };
  }
  if (!dry.wouldWrite) return { ok: true, plan: dry, written: 0, batchId: null, reason: 'no row needed a write' };

  const put = db.prepare(`
    INSERT INTO ats_corpus_grades (corpus, job_id, grader, profile_id, fit, content_hash, batch_id, graded_at, note)
    VALUES (@corpus, @job_id, @grader, @profile_id, @fit, @content_hash, @batch_id, @graded_at, @note)
    ON CONFLICT(corpus, job_id, grader) DO UPDATE SET profile_id = excluded.profile_id, fit = excluded.fit,
      content_hash = excluded.content_hash, batch_id = excluded.batch_id, graded_at = excluded.graded_at, note = excluded.note`);
  const run = () => {
    const plan = planGradeImport(db, text, opts);       // under the lock — the plan that is applied
    if (!plan.valid || !plan.wouldWrite) return { plan, batchId: null, written: 0 };
    const batchId = openBatch(db, { source: 'import', provider: opts.grader, model: null, kind: GRADE_BATCH_KIND,
      notes: opts.notes ?? `A76 grades — corpus ${opts.corpus}, grader ${opts.grader}` });
    const now = Math.floor(Date.now() / 1000);
    let written = 0;
    for (const p of plan.planned.filter(x => x.wouldWrite)) {
      const key = { corpus: opts.corpus, job_id: p.jobId, grader: opts.grader };
      const after = { ...key, profile_id: plan.meta?.profile_id ?? null, fit: p.fit, content_hash: p.contentHash,
                      batch_id: batchId, graded_at: now, note: p.note ?? null };
      put.run(after);
      recordBatchRow(db, batchId, p.jobId, p.existing ?? null, {
        filled: p.existing ? [] : ['fit'], corrected: p.existing ? ['fit'] : [], key, after: { fit: p.fit },
      });
      written++;
    }
    closeBatch(db, batchId, { rowsAttempted: plan.rowsInFile, rowsWritten: written, rowsFailed: 0,
      rowsEmpty: plan.unchanged + plan.ungraded, coverage: { kind: GRADE_BATCH_KIND, corpus: opts.corpus, grader: opts.grader,
        ungraded: plan.ungraded, skippedExisting: plan.skippedExisting, overwrite: !!opts.overwrite, allowStale: !!opts.allowStale } });
    return { plan, batchId, written };
  };
  try {
    const r = db.transaction(run).immediate();
    if (!r.plan.valid) return { ok: false, plan: r.plan, written: 0, batchId: null, reason: 'the file no longer validates under the write lock — NOTHING was written' };
    return { ok: true, ...r };
  } catch (e) {
    if (e?.code === 'SQLITE_BUSY' || /database is locked/i.test(String(e?.message))) {
      return { ok: false, plan: dry, written: 0, batchId: null, kind: 'concurrent_import',
        reason: 'another writer holds the database — refused, NOTHING was written; re-run when it finishes' };
    }
    throw e;
  }
}

export function formatGradePlan(plan) {
  const L = [
    `rows in file         ${plan.rowsInFile}`,
    `would write          ${plan.wouldWrite}`,
    `unchanged            ${plan.unchanged}${plan.skippedExisting ? ` (${plan.skippedExisting} differ from this grader's stored grade — pass --overwrite to replace)` : ''}`,
    `ungraded (fit null)  ${plan.ungraded}`,
    `rejected             ${plan.rejected.length}`,
    `grader               ${plan.grader} · corpus ${plan.corpus}${plan.allowStale ? ' · STALE ROWS ALLOWED' : ''}`,
  ];
  if (plan.rejected.length) {
    L.push('', 'REJECTED — the whole file is refused unless these are fixed:');
    for (const r of plan.rejected.slice(0, 25)) L.push(`  ${r.line != null ? `line ${r.line}` : 'file'}${r.jobId ? ` (${r.jobId})` : ''} [${r.kind}]: ${r.error}`);
    if (plan.rejected.length > 25) L.push(`  ... and ${plan.rejected.length - 25} more`);
  }
  L.push('', plan.valid ? 'VALID — this file can be applied.' : 'INVALID — nothing would be written.');
  return L.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────────────────────────
// ANALYSIS — zero model calls. Grades come from ats_corpus_grades; engine scores are computed by the
// caller at analysis time, after the grades are in.
// ────────────────────────────────────────────────────────────────────────────────────────────────

/** Grades in a corpus whose content_hash still matches the posting (stale ones counted, excluded). */
export function loadGrades(db, corpus, resolve) {
  const rows = db.prepare('SELECT * FROM ats_corpus_grades WHERE corpus = ? ORDER BY job_id, grader').all(corpus);
  const fresh = [], stale = [];
  for (const r of rows) {
    const cur = resolve(r.job_id);
    (cur && computeContentHash(cur.title, cur.description) === r.content_hash ? fresh : stale).push(r);
  }
  return { fresh, stale };
}

const toBand = (fit) => (fit >= 4 ? 2 : fit === 3 ? 1 : 0);
const bandOf = (s, st, mo) => (s >= st ? 2 : s >= mo ? 1 : 0);

/**
 * @param {object[]} postings [{job_id, set:'owner30'|'sample', engine:number|null, human_fit?:number}]
 * @param {object[]} grades   fresh ats_corpus_grades rows
 * @param {{strong:number, moderate:number}} cutpoints the current bands
 */
export function analyzeGrades(postings, grades, cutpoints) {
  const byJob = new Map(postings.map(p => [p.job_id, p]));
  const graders = [...new Set(grades.map(g => g.grader))].sort();
  const out = { graders: {}, cutpoints_current: cutpoints };
  const stat = (xs, ys) => { const k = kendall(xs, ys); return { n: xs.length, rho: +spearman(xs, ys).toFixed(4), tau_b: +k.tau.toFixed(4), misordered: +k.misordered.toFixed(4) }; };
  const owner = postings.filter(p => p.set === 'owner30' && Number.isFinite(p.engine) && Number.isFinite(p.human_fit));
  out.engine_vs_owner_30 = stat(owner.map(p => p.engine), owner.map(p => p.human_fit));
  for (const g of graders) {
    const mine = grades.filter(x => x.grader === g).map(x => ({ ...byJob.get(x.job_id), fit: x.fit })).filter(x => x.job_id);
    const declined = mine.filter(x => !Number.isFinite(x.engine)).length;
    const scored = mine.filter(x => Number.isFinite(x.engine));
    const vsOwner = mine.filter(x => x.set === 'owner30' && Number.isFinite(x.human_fit));
    const r = {
      graded: mine.length,
      // ⛔ A declined score is NOT a 0. The 10-03 script stored 20 of its 41 sample scores as null and
      // its ρ ranked them as zeros; they are excluded and counted here.
      engine_declined: declined,
      grader_vs_owner_30: vsOwner.length ? { ...stat(vsOwner.map(x => x.fit), vsOwner.map(x => x.human_fit)),
        exact: vsOwner.filter(x => x.fit === x.human_fit).length, within_one: vsOwner.filter(x => Math.abs(x.fit - x.human_fit) <= 1).length } : null,
      engine_vs_grader_all: stat(scored.map(x => x.engine), scored.map(x => x.fit)),
      engine_vs_grader_sample: stat(scored.filter(x => x.set === 'sample').map(x => x.engine), scored.filter(x => x.set === 'sample').map(x => x.fit)),
      fit_distribution: [1, 2, 3, 4, 5].map(f => mine.filter(x => x.fit === f).length),
    };
    if (scored.length >= 4) {
      const kOn = (rows, st, mo) => weightedKappa(rows.map(x => bandOf(x.engine, st, mo)), rows.map(x => toBand(x.fit)), 3);
      const best = (rows) => { let b = { strong: 0, moderate: 0, kappa: -Infinity };
        for (let st = 10; st <= 90; st++) for (let mo = 5; mo < st; mo++) { const k = kOn(rows, st, mo); if (k > b.kappa) b = { strong: st, moderate: mo, kappa: k }; }
        return b; };
      const even = scored.filter((_, i) => i % 2 === 0), odd = scored.filter((_, i) => i % 2 === 1);
      const bIn = best(scored), bEven = best(even);
      r.cutpoints = {
        current_kappa: +kOn(scored, cutpoints.strong, cutpoints.moderate).toFixed(4),
        best_in_sample: { strong: bIn.strong, moderate: bIn.moderate, kappa: +bIn.kappa.toFixed(4) },
        held_out: { fit_on: 'even rows', strong: bEven.strong, moderate: bEven.moderate,
          kappa_odd: +kOn(odd, bEven.strong, bEven.moderate).toFixed(4),
          current_kappa_odd: +kOn(odd, cutpoints.strong, cutpoints.moderate).toFixed(4) },
      };
    }
    out.graders[g] = r;
  }
  return out;
}

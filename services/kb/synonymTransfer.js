/**
 * services/kb/synonymTransfer.js — skill-synonym proposals by EXPORT → owner → IMPORT (D17, A80 V10).
 *
 * Until 10-05 scripts/al3SkillSynonyms.mjs sent the corpus vocabulary to Haiku in batches of 60 and
 * recorded the pairs it named. D17 confines model calls to résumé generation, so the model's part is
 * now done outside the product: the script EXPORTS the same batches as JSONL, the owner fills in
 * `pairs` (by hand, or with any tool they choose, outside draft), and the script IMPORTS the file.
 *
 * What did not change, and is the reason this is safe: every imported pair still lands as
 * 'proposed'. Nothing reaches the scorer until a person runs --confirm (services/kb/skillSynonyms.js).
 *
 * The import guards follow the enrichment round trip's (services/jobs/enrichmentTransfer.js):
 *   invalid_value   not JSON, wrong kind, a relation outside RELATIONS, a pair with a missing or
 *                   self-paired term
 *   tampered        the batch's term list no longer matches its fingerprint — terms were edited,
 *                   so "only pair terms you were shown" can no longer be checked
 *   unknown_term    a pair names a term that is not in ITS batch — an invented term would enter the
 *                   table with fabricated provenance (the rule the model path enforced too)
 *   duplicate_batch the same batch appears twice — two answers, and no way to say which is meant
 *   stale           a term has left the corpus vocabulary since the export (refused unless allowed:
 *                   its provenance would be empty)
 * Any problem refuses the WHOLE file and lists every problem, so one pass fixes them all.
 * Re-importing the same file is a no-op: a pair already proposed with the same relation and the
 * same supporting postings is counted `unchanged` and not rewritten.
 *
 * Pure functions plus one transaction; the script owns argv and the files.
 */

import crypto from "node:crypto";
import { normaliseAtsTerm } from "../localAtsScorer.js";
import { RELATIONS, canonicalPair, recordSynonymProposals } from "./skillSynonyms.js";

export const SYNONYM_BATCH_KIND = "al3_synonym_batch";
export const SYNONYM_INSTRUCTIONS_KIND = "al3_synonym_instructions";

/** Terms seen in at least this many postings. Below it we are looking at one posting's phrasing. */
export const MIN_DF = 3;
/** Terms per batch. Small enough to hold the whole list in view while pairing. */
export const BATCH = 60;
/** Supporting postings recorded per pair (the stored provenance list caps at 25 anyway). */
const SUPPORT_CAP = 25;

/** The rules the model was given, unchanged — now addressed to whoever fills the file. */
export const SYNONYM_RULES = `Find pairs among the batch's TERMS ONLY that refer to the same or near-same skill.

Two kinds, and the distinction matters more than the coverage:
  "alias"   — the SAME thing under another name. k8s / kubernetes. postgres / postgresql.
              js / javascript. Interchangeable in any sentence.
  "related" — DIFFERENT but so close that a candidate strong in one is credited with the other.
              log analysis / observability. ci cd / continuous integration.

RULES:
- Use ONLY terms that appear verbatim in that line's "terms". Do not invent or generalise a term.
- Do NOT pair two things that merely co-occur or belong to the same area. kubernetes and docker are
  BOTH containers and are NOT equivalent. python and django are NOT equivalent. aws and azure are
  NOT equivalent — they are competitors, not synonyms.
- Do NOT pair a broad field with a specific tool. "machine learning" is not "pytorch".
- If you are not confident, LEAVE IT OUT. An empty list is a correct answer. A wrong pair silently
  changes every score this engine produces, so a missed pair costs far less than a false one.

Fill each line's "pairs" with {"a": "<term>", "b": "<term>", "relation": "alias" | "related"}.
Change nothing else on the line.`;

/** postings-by-term over scraped_jobs.skills_json rows — the vocabulary the scorer matches on. */
export function corpusVocabulary(rows) {
  const postingsByTerm = new Map();
  for (const r of rows) {
    let arr;
    try { arr = JSON.parse(r.skills_json); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    const seen = new Set();
    for (const entry of arr) {
      const t = normaliseAtsTerm(typeof entry === "string" ? entry : entry?.skill);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      let list = postingsByTerm.get(t);
      if (!list) { list = []; postingsByTerm.set(t, list); }
      list.push(r.job_id);
    }
  }
  return { postingsByTerm, corpusSize: rows.length };
}

/** The askable vocabulary: df >= MIN_DF, most-used first (ties by name, so exports are stable). */
export function vocabularyTerms(postingsByTerm, minDf = MIN_DF) {
  return [...postingsByTerm.entries()]
    .filter(([, posts]) => posts.length >= minDf)
    .sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
    .map(([t]) => t);
}

export function fingerprintTerms(terms) {
  return crypto.createHash("sha256").update(JSON.stringify(terms)).digest("hex").slice(0, 16);
}

/** The export: one instructions line, then one line per batch with an empty `pairs`. */
export function buildSynonymExport(terms, { batchSize = BATCH, maxBatches = Infinity, exportedAt = new Date().toISOString() } = {}) {
  const lines = [{ kind: SYNONYM_INSTRUCTIONS_KIND, exportedAt, rules: SYNONYM_RULES }];
  const n = Math.min(maxBatches, Math.ceil(terms.length / batchSize));
  for (let i = 0; i < n; i++) {
    const slice = terms.slice(i * batchSize, (i + 1) * batchSize);
    lines.push({ kind: SYNONYM_BATCH_KIND, batch: i + 1, fingerprint: fingerprintTerms(slice), terms: slice, pairs: [] });
  }
  return lines;
}

/** Parses JSONL text into [{ lineNo, value | error }]. Blank lines are skipped. */
export function parseJsonl(text) {
  const out = [];
  String(text || "").split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    try { out.push({ lineNo: i + 1, value: JSON.parse(raw) }); }
    catch (e) { out.push({ lineNo: i + 1, error: e.message }); }
  });
  return out;
}

/**
 * Validates a filled export against the CURRENT vocabulary and the table, and says what an apply
 * would write. Writes nothing.
 *
 * @returns {{ ok, problems: {lineNo, code, detail}[], proposals: object[], pairs: number,
 *             unchanged: number, alreadyReviewed: number, batches: number }}
 */
export function planSynonymImport(db, parsed, postingsByTerm, { allowStale = false } = {}) {
  const problems = [];
  const bad = (lineNo, code, detail) => problems.push({ lineNo, code, detail });
  const seenBatches = new Set();
  const grouped = new Map();
  let batches = 0;

  for (const { lineNo, value, error } of parsed) {
    if (error) { bad(lineNo, "invalid_value", `not JSON: ${error}`); continue; }
    if (value?.kind === SYNONYM_INSTRUCTIONS_KIND) continue;
    if (value?.kind !== SYNONYM_BATCH_KIND) { bad(lineNo, "invalid_value", `kind is ${JSON.stringify(value?.kind)}`); continue; }
    batches++;
    if (seenBatches.has(value.batch)) { bad(lineNo, "duplicate_batch", `batch ${value.batch} appears twice`); continue; }
    seenBatches.add(value.batch);
    if (!Array.isArray(value.terms) || !Array.isArray(value.pairs)) {
      bad(lineNo, "invalid_value", "terms and pairs must be arrays"); continue;
    }
    if (fingerprintTerms(value.terms) !== value.fingerprint) {
      bad(lineNo, "tampered", `batch ${value.batch}'s terms were edited after export`); continue;
    }
    const inBatch = new Set(value.terms);
    for (const p of value.pairs) {
      if (!p || typeof p !== "object") { bad(lineNo, "invalid_value", "a pair is not an object"); continue; }
      if (!RELATIONS.includes(p.relation)) { bad(lineNo, "invalid_value", `relation ${JSON.stringify(p.relation)} (want ${RELATIONS.join(" | ")})`); continue; }
      const a = normaliseAtsTerm(p.a), b = normaliseAtsTerm(p.b);
      if (!a || !b || a === b) { bad(lineNo, "invalid_value", `pair ${JSON.stringify(p.a)} / ${JSON.stringify(p.b)} is empty or self-paired`); continue; }
      const missing = [a, b].filter(t => !inBatch.has(t));
      if (missing.length) { bad(lineNo, "unknown_term", `${missing.join(", ")} not in batch ${value.batch}`); continue; }
      const gone = [a, b].filter(t => !postingsByTerm.has(t));
      if (gone.length && !allowStale) { bad(lineNo, "stale", `${gone.join(", ")} left the corpus since the export`); continue; }
      const pair = canonicalPair(a, b);
      const key = `${pair.term} ${pair.equivalent}`;
      const prev = grouped.get(key);
      // 'related' is the weaker claim; if any line called it merely related, keep that.
      const relation = prev?.relation === "related" || p.relation === "related" ? "related" : "alias";
      grouped.set(key, { ...pair, relation });
    }
  }

  const existing = db.prepare("SELECT status, relation, source_postings_json FROM skill_synonyms WHERE term=? AND equivalent=?");
  const proposals = [];
  let unchanged = 0, alreadyReviewed = 0;
  for (const g of grouped.values()) {
    const pa = postingsByTerm.get(g.term) || [], pb = postingsByTerm.get(g.equivalent) || [];
    const shared = pa.filter(j => pb.includes(j));
    // Provenance is the postings that support the PAIR; where the two never co-occur, the postings
    // carrying either — still real, and recorded as such. The same rule the model pass used.
    const support = (shared.length ? shared : [...new Set([...pa, ...pb])]).slice(0, SUPPORT_CAP);
    const prior = existing.get(g.term, g.equivalent);
    if (prior && prior.status !== "proposed") { alreadyReviewed++; continue; }
    if (prior) {
      let priorIds = [];
      try { priorIds = JSON.parse(prior.source_postings_json || "[]"); } catch { /* treat as none */ }
      if (prior.relation === g.relation && support.every(j => priorIds.includes(j))) { unchanged++; continue; }
    }
    for (const jobId of support) proposals.push({ term: g.term, equivalent: g.equivalent, relation: g.relation, jobId });
    if (!support.length) proposals.push({ term: g.term, equivalent: g.equivalent, relation: g.relation, jobId: null });
  }
  return { ok: problems.length === 0, problems, proposals, pairs: grouped.size, unchanged, alreadyReviewed, batches };
}

/**
 * Plan and, when the plan is clean, write — in ONE transaction, so the table the plan read is the
 * table the write lands on (the concurrency guard). Refuses the whole file on any problem.
 */
export function applySynonymImport(db, parsed, postingsByTerm, opts = {}) {
  let result;
  db.transaction(() => {
    const plan = planSynonymImport(db, parsed, postingsByTerm, opts);
    result = { ...plan, written: null };
    if (!plan.ok || !plan.proposals.length) return;
    result.written = recordSynonymProposals(db, plan.proposals);
  })();
  return result;
}

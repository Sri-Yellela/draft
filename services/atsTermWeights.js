/**
 * services/atsTermWeights.js — corpus-derived term weights for the local ATS scorer.
 *
 * WHAT THIS FIXES
 * The scorer counted every term the same. Matching `python` was worth exactly what matching
 * `systems` was worth, so a posting could be "matched" on filler and score the same as one matched
 * on the thing the job is actually about. Weighting terms by how rare they are in our own corpus is
 * the standard fix (TF-IDF), and we have the corpus: 1289 postings carrying skills_json.
 *
 * THE REASON THIS IS NOT PLAIN IDF — READ BEFORE CHANGING THE FLOOR
 * skills_json is written by an LLM (services/jobs/enrichJob.js), not chosen from a fixed list, so
 * the corpus vocabulary is open-ended and its tail is phrasing, not skills. Measured on the live
 * board:
 *
 *     6123 distinct normalised terms
 *       appearing in exactly 1 posting : 4279  (69.9%)
 *       appearing in <= 3 postings     : 5373  (87.8%)
 *
 * and the singletons read `passion for mission`, `japanese fluency`, `receptivenes to feedback`,
 * `ability to work with diverse team`. Plain IDF gives every one of those the MAXIMUM weight,
 * because it cannot tell a rare skill from a rare way of saying an ordinary thing. That is the
 * opposite of the intent and it would make the score worse, not better.
 *
 * So there is a DOCUMENT-FREQUENCY FLOOR. A term seen in fewer than MIN_DF postings is not treated
 * as high-signal; it is given NEUTRAL weight. It still counts — a genuinely rare skill should not be
 * silently dropped from the denominator, because then a posting made entirely of rare terms would
 * score on nothing at all — but it cannot outweigh a term we have actually observed enough times to
 * have an opinion about. Weight is EARNED by evidence, and one sighting is not evidence.
 *
 * WEIGHTS AGE, AND A STALE WEIGHT TABLE THAT DOES NOT SAY SO IS THE REPEATED DEFECT SHAPE HERE.
 * Every row carries computed_at and the corpus size it was built from. `loadTermWeights` returns
 * them, `weightsAreStale` judges them, and the scorer degrades to unweighted rather than scoring
 * against weights from a corpus that no longer resembles the board.
 */

// One-way dependency, deliberately. localAtsScorer must NOT import this module back: the scorer
// takes a prepared weight Map as an argument and never touches the database, which is what keeps it
// pure, deterministic and testable without a DB. Loading is the caller's job.
import { roleFamilyForTitle } from "./searchQueryBuilder.js";
import { normaliseAtsTerm, postingTermKeys } from "./localAtsScorer.js";
import { assessRebuildScope, thinBoardConfirmed } from "./jobs/boardSufficiency.js";

/**
 * A term must appear in at least this many postings before its rarity is believed.
 * Set from the measured tail above: at 5, ~88% of distinct terms fall below the floor and are
 * neutral, which is the honest answer for a vocabulary an LLM invents per posting.
 */
export const MIN_DF = 5;

/** Neutral weight. A term with no earned opinion counts exactly once. */
export const NEUTRAL_WEIGHT = 1.0;

/** Bounds. A ubiquitous term is damped, never zeroed — "python" on a Python job still means something. */
export const MIN_WEIGHT = 0.35;
export const MAX_WEIGHT = 2.0;

/**
 * A family whose corpus is smaller than this cannot support its own weights and falls back to the
 * global table. Below it, document frequency is measuring the sample, not the language.
 */
export const MIN_FAMILY_POSTINGS = 60;

/** The pseudo-family holding weights computed over every posting regardless of role. */
export const GLOBAL_FAMILY = "__global__";

/** Weights older than this are refused. The corpus turns over as the board is re-scraped. */
export const MAX_WEIGHT_AGE_DAYS = 45;

/**
 * Rarity -> weight, once the floor is cleared.
 *
 * ln(N/df) normalised by ln(N/MIN_DF) puts a term seen exactly MIN_DF times at 1.0 and a term in
 * every posting at 0, then scales into [MIN_WEIGHT, MAX_WEIGHT]. Bounded on purpose: an unbounded
 * IDF lets one rare term dominate a whole posting's score, which is the same "confidently wrong"
 * failure in a different costume.
 */
export function weightForDf(df, corpusSize) {
  if (!Number.isFinite(df) || df <= 0 || !Number.isFinite(corpusSize) || corpusSize <= 0) {
    return NEUTRAL_WEIGHT;
  }
  if (df < MIN_DF) return NEUTRAL_WEIGHT;
  const ceiling = Math.log(corpusSize / MIN_DF);
  if (!(ceiling > 0)) return NEUTRAL_WEIGHT;
  const rarity = Math.log(corpusSize / Math.min(df, corpusSize)) / ceiling;
  const scaled = rarity * MAX_WEIGHT;
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, Number(scaled.toFixed(4))));
}

function parseSkills(raw) {
  let list = [];
  try { list = JSON.parse(raw || "[]"); } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const entry of list) {
    const value = typeof entry === "string" ? entry : entry?.skill;
    if (typeof value === "string" && value.trim()) out.push(value.trim());
  }
  return out;
}

/**
 * `general` is classifyJob's "could not place this" bucket, and it is deliberately NOT a weight
 * family. Semantically it is the same answer roleFamilyForTitle gives by returning null, and a
 * table built from 200-odd unrelated roles is a second global table over a smaller, noisier
 * corpus — not a per-family refinement. Rows here fall back to `__global__`, which is correct.
 */
const NOT_A_WEIGHT_FAMILY = new Set(["general"]);

/**
 * THE SHIPPED BUCKETER — the title mapper, unchanged, now named so the alternative has something
 * to be compared against rather than silently replacing an anonymous inline call.
 *
 * ⛔ It must agree with server.js's `atsTermWeightsForJob`, which looks weights up the same way.
 * Bucketing by one rule and reading by another means every lookup misses and falls back to the
 * global table — silently, with a plausible score.
 */
export function titleWeightFamily(_db, job) {
  return roleFamilyForTitle(job?.normalized_title || job?.title || "") || null;
}

/**
 * ⛔ MEASURED AND NOT ADOPTED — 2026-09-26. READ THIS BEFORE MAKING IT THE DEFAULT.
 *
 * This is the board's own taxonomy (`job_role_map`, filled by classifyJob) answering "which weight
 * family is this posting in". §6b of docs/ATS_TERM_WEIGHTS_SCHEDULE.md proposed it as a fix: the
 * shipped bucketer, `roleFamilyForTitle`, is a narrow alias-map lookup that leaves 44.2% of the
 * enriched corpus with no family at all — every `account executive`, every `customer success
 * manager` — so most buckets never reach MIN_FAMILY_POSTINGS and PRODUCTION WRITES ONLY
 * `__global__` despite holding 1,179 enriched postings.
 *
 * It does exactly what it was supposed to structurally: 5 families instead of 3, `sales` appears
 * with 208 postings, `pm` grows 94 -> 147, and the graded 30 fall back to global 7 times instead
 * of 12. **And it makes the ranking worse.** Against the human grades (scripts/an3FamilyWeightRho.mjs):
 *
 *     narrow (shipped)        rho 0.7460   tau-b 0.6807   mis-ordered 16.0%
 *     board taxonomy          rho 0.7298   tau-b 0.6677   mis-ordered 16.6%
 *     union of the two        rho 0.7355   tau-b 0.6687   mis-ordered 16.6%
 *     board incl. `general`   rho 0.7281   tau-b 0.6627   mis-ordered 16.9%
 *
 * ⚠ n=30, and the honest reading is NOT "the board taxonomy is worse". A 0.016 difference is far
 * inside what 30 graded postings can resolve. The reading is that **there is no evidence of
 * improvement, and what weak evidence there is points the wrong way** — so the change does not
 * earn a place on the scoring path yet. §6b called the global-only fallback a "loss of
 * resolution"; this is the first measurement of that loss, and it could not find one.
 *
 * Kept exported, and the harness kept, so the question can be re-asked the moment there are more
 * grades. ⛔ If you adopt it: server.js's read path must switch in the SAME commit. Weights
 * bucketed as `sales` and looked up by title miss every time and fall back to global — the exact
 * state this is meant to fix, wearing the costume of a fix.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{job_id?: string, normalized_title?: string, title?: string}} job
 * @returns {string|null} the family, or null meaning "use the global table"
 */
export function weightFamilyForJob(db, job) {
  if (!job) return null;
  if (job.job_id) {
    try {
      const row = db.prepare(
        "SELECT role_family, role_key FROM job_role_map WHERE job_id = ? LIMIT 1"
      ).get(job.job_id);
      const fam = row?.role_family || row?.role_key || null;
      if (fam) return NOT_A_WEIGHT_FAMILY.has(fam) ? null : fam;
    } catch { /* table absent (pre-migration) — fall through to the title mapper */ }
  }
  const byTitle = roleFamilyForTitle(job.normalized_title || job.title || "");
  return byTitle && !NOT_A_WEIGHT_FAMILY.has(byTitle) ? byTitle : null;
}

/**
 * Recompute the whole weight table from scraped_jobs. Idempotent: the table is replaced wholesale
 * inside one transaction, so a crashed recompute leaves the previous table intact rather than a
 * half-written one that would silently score some terms and not others.
 *
 * `familyFor` is injectable so that scripts/an3FamilyWeightRho.mjs can measure one bucketing
 * against another through THIS function rather than through a copy of it — a harness that
 * reimplements what it measures is measuring the reimplementation, which this repository has paid
 * for twice.
 *
 * ⛔ THE DEFAULT IS THE TITLE MAPPER, AND IT STAYED THAT WAY ON PURPOSE. The obvious alternative
 * (`weightFamilyForJob`, the board's own taxonomy) was implemented, measured against the human
 * grades, and NOT adopted because it moved rho 0.7460 -> 0.7298. See the note on that function.
 * It must also match server.js's read path, which is title-based; changing one without the other
 * is a silent no-op.
 */
export function computeTermWeights(db, { now = Math.floor(Date.now() / 1000), familyFor = titleWeightFamily } = {}) {
  return writeTermWeights(db, countCorpusTerms(db, familyFor), now);
}

/** Every corpus row's terms, counted in one pass (on whatever thread calls it — the worker, a script, a test). */
export function countCorpusTerms(db, familyFor = titleWeightFamily) {
  const acc = termAccumulator(db, familyFor);
  for (const row of db.prepare(`SELECT ${corpusColumns(db)} FROM scraped_jobs WHERE ${CORPUS_WHERE}`).iterate()) acc.add(row);
  return acc;
}

/**
 * ⭐ D170 (3) · WHAT server.js RUNS: the count in a worker thread (services/atsTermWeightsWorker.js, its own read-only
 * connection), the write here; if the worker cannot answer, the count runs here in yielding pages instead.
 */
export async function computeTermWeightsOffThread(db, { dbPath, now = Math.floor(Date.now() / 1000), log = console,
                                                       countOffThread = null, pageRows, yieldFn } = {}) {
  try {
    const count = countOffThread || (await import("./atsTermWeightsWorker.js")).countCorpusTermsOffThread;
    const acc = await count(dbPath);
    return { ...writeTermWeights(db, acc, now), counted: "worker" };
  } catch (e) {
    log.warn?.(`[ats-weights] the worker could not count (${e.message}) — counting on the main thread in pages`);
    const r = await computeTermWeightsAsync(db, { now, ...(pageRows ? { pageRows } : {}), ...(yieldFn ? { yieldFn } : {}) });
    return { ...r, counted: "main-thread pages" };
  }
}

/**
 * ⭐ D170 (3) · THE SAME REBUILD, IN YIELDING PAGES — the fallback when the worker (computeTermWeightsOffThread) can't
 * answer. Extracting a posting's scored terms (postingTermKeys) costs ≈ 4–5 ms (measured 11-06 on 801 postings, the
 * machine loaded), so over production's ≈ 18k active postings it is over a minute of CPU in the server process
 * (D151 Rule 2). This pages through the corpus by rowid (`pageRows` at a time — 25 ≈ 100 ms) and yields between
 * pages; only the final write (a few thousand INSERTs in one transaction) runs in one piece. The result is identical
 * to computeTermWeights' (d170WeightsRebuildFromFullBoard pins it).
 */
export async function computeTermWeightsAsync(db, { now = Math.floor(Date.now() / 1000), familyFor = titleWeightFamily,
                                                    pageRows = 25, yieldFn = () => new Promise(r => setImmediate(r)) } = {}) {
  const acc = termAccumulator(db, familyFor);
  const page = db.prepare(
    `SELECT rowid AS _rowid, ${corpusColumns(db)} FROM scraped_jobs WHERE rowid > ? AND (${CORPUS_WHERE}) ORDER BY rowid LIMIT ?`
  );
  let after = 0;
  for (;;) {
    const rows = page.all(after, pageRows);
    if (!rows.length) break;
    for (const row of rows) acc.add(row);
    after = rows[rows.length - 1]._rowid;
    if (rows.length < pageRows) break;
    await yieldFn();
  }
  return writeTermWeights(db, acc, now);
}

/**
 * ⭐ D170 (3) · WHICH POSTINGS THE WEIGHTS ARE COUNTED OVER: every ACTIVE posting (what people are scored against
 * today), plus any posting that carries enrichment skills (the corpus the table was first built from, kept so a
 * rebuild never has less evidence than the one before it).
 *
 * ⛔ It used to be `skills_json` ALONE. Only the retired feeds (D78 C) and the offline enrichment imports ever fill
 * that column, so as those postings aged out the corpus shrank while the board grew: production 11-06 held 82,720
 * postings and the nightly rebuild would have written 362 rows over the 1,666 it had (refused by the thin-board
 * guard, correctly), leaving 34-day-old weights 11 days from being dropped (MAX_WEIGHT_AGE_DAYS).
 */
const CORPUS_COLUMN_NAMES = ["job_id", "title", "normalized_title", "company", "description_text", "description", "skills_json"];
const CORPUS_WHERE = "is_active = 1 OR (skills_json IS NOT NULL AND skills_json != '' AND skills_json != '[]')";
/** The corpus SELECT list; a column an older (or a test's hand-made) scraped_jobs lacks reads as NULL. */
function corpusColumns(db) {
  let have;
  try { have = new Set(db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name)); } catch { have = null; }
  return CORPUS_COLUMN_NAMES.map(c => (!have || have.has(c) ? c : `NULL AS ${c}`)).join(", ");
}

/** The terms one corpus row is scored against — the scorer's own extraction (postingTermKeys). */
export function corpusTermsOf(row) {
  return postingTermKeys({
    title: row?.title || row?.normalized_title || "",
    company: row?.company || "",
    // mapJobRow serves description_text when it is the read of the description held now; for a document
    // frequency either reads the same words, so the plain text wins when present.
    description: row?.description_text || row?.description || "",
    skills_json: row?.skills_json ?? null,
  });
}

/** family -> { postings, df } over the rows given to add(); `rows` counts every row seen. */
function termAccumulator(db, familyFor) {
  const families = new Map();
  let rows = 0, withTerms = 0;
  const bump = (family, terms) => {
    let bucket = families.get(family);
    if (!bucket) { bucket = { postings: 0, df: new Map() }; families.set(family, bucket); }
    bucket.postings += 1;
    for (const term of terms) bucket.df.set(term, (bucket.df.get(term) || 0) + 1);
  };
  return {
    families,
    get rows() { return rows; },
    get withTerms() { return withTerms; },
    add(row) {
      rows += 1;
      const terms = corpusTermsOf(row);
      if (!terms.size) return;
      withTerms += 1;
      bump(GLOBAL_FAMILY, terms);
      const family = familyFor(db, row);
      if (family) bump(family, terms);
    },
  };
}

function writeTermWeights(db, acc, now) {
  const { families } = acc;
  // ⛔ COUNT THE OUTCOME BEFORE DESTROYING THE PREDECESSOR — see services/jobs/boardSufficiency.js.
  //
  // The DELETE below is unconditional and inside the same transaction as the rebuild, so the only
  // moment at which this can be stopped is here, before either runs. `cleanup_log` id 85 took
  // scraped_jobs from 1291 rows to 5; one run of scripts/recomputeAtsTermWeights.js against that
  // board would trade 856 measured weights for a handful and the scorer would carry on, silently
  // neutral, with rho no longer reproducible.
  //
  // Counted with the same two filters the write loop applies, so the estimate cannot disagree with
  // what would actually be inserted.
  let incoming = 0;
  for (const [family, bucket] of families) {
    if (family !== GLOBAL_FAMILY && bucket.postings < MIN_FAMILY_POSTINGS) continue;
    for (const df of bucket.df.values()) if (df >= MIN_DF) incoming++;
  }
  const existing = db.prepare("SELECT COUNT(*) c FROM ats_term_weights").get().c;
  const scope = assessRebuildScope({
    existing, incoming, operation: "computeTermWeights", confirmed: thinBoardConfirmed(),
  });
  if (!scope.allowed) {
    console.error(`[atsTermWeights] ⛔ ${scope.reason}`);
    return { computedAt: now, corpusSize: acc.withTerms, scanned: acc.rows, families: [], skipped: true, reason: scope.reason, incoming, existing };
  }
  if (scope.reason) console.warn(`[atsTermWeights] ${scope.reason}`);

  const written = [];
  const insert = db.prepare(
    `INSERT INTO ats_term_weights (role_family, term, df, corpus_size, weight, computed_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    db.prepare("DELETE FROM ats_term_weights").run();
    for (const [family, bucket] of families) {
      // A family too small to speak for itself is not written at all. An empty result makes the
      // scorer fall back to the global table, which is the correct answer; a table of weights
      // derived from 12 postings would look authoritative and be noise.
      if (family !== GLOBAL_FAMILY && bucket.postings < MIN_FAMILY_POSTINGS) continue;
      let count = 0;
      for (const [term, df] of bucket.df) {
        // Below the floor every weight is NEUTRAL by definition, so storing those rows would
        // triple the table to say nothing. Absence means neutral, and loadTermWeights agrees.
        if (df < MIN_DF) continue;
        insert.run(family, term, df, bucket.postings, weightForDf(df, bucket.postings), now);
        count++;
      }
      written.push({ family, postings: bucket.postings, distinctTerms: bucket.df.size, weighted: count });
    }
  })();

  // corpusSize: the postings that contributed terms (what the weights are frequencies over); scanned: every row read.
  return { computedAt: now, corpusSize: acc.withTerms, scanned: acc.rows, families: written, incoming, existing };
}

/**
 * Load the weight table for one role family, falling back to the global table.
 *
 * Returns `{ weights, computedAt, corpusSize, family, stale }`. `weights` is a Map of normalised
 * term -> weight; a term that is absent is NEUTRAL, never zero.
 */
export function loadTermWeights(db, roleFamily = null, { now = Math.floor(Date.now() / 1000) } = {}) {
  const empty = { weights: new Map(), computedAt: null, corpusSize: 0, family: null, stale: true };
  let rows = [];
  let family = null;
  try {
    if (roleFamily) {
      rows = db.prepare(
        "SELECT term, weight, corpus_size, computed_at FROM ats_term_weights WHERE role_family = ?"
      ).all(roleFamily);
      if (rows.length) family = roleFamily;
    }
    if (!rows.length) {
      rows = db.prepare(
        "SELECT term, weight, corpus_size, computed_at FROM ats_term_weights WHERE role_family = ?"
      ).all(GLOBAL_FAMILY);
      if (rows.length) family = GLOBAL_FAMILY;
    }
  } catch {
    // The table may not exist yet (fresh DB, migration not run). Unweighted is a correct answer.
    return empty;
  }
  if (!rows.length) return empty;

  const weights = new Map();
  for (const r of rows) weights.set(r.term, r.weight);
  const computedAt = rows[0].computed_at ?? null;
  return {
    weights,
    computedAt,
    corpusSize: rows[0].corpus_size ?? 0,
    family,
    stale: weightsAreStale(computedAt, now),
  };
}

export function weightsAreStale(computedAt, now = Math.floor(Date.now() / 1000)) {
  if (!Number.isFinite(computedAt) || computedAt <= 0) return true;
  return (now - computedAt) > MAX_WEIGHT_AGE_DAYS * 86400;
}

/**
 * How old weights may get before the SCHEDULE rebuilds them.
 *
 * ⛔ THIS IS NOT MAX_WEIGHT_AGE_DAYS AND THE DIFFERENCE IS THE WHOLE POINT. That constant is a
 * REFUSAL — the safety net that stops the scorer using weights from a corpus that no longer
 * exists. scripts/recomputeAtsTermWeights.js's own header says so: "That refusal is the safety
 * net, not the schedule." The schedule was the missing half. A system whose only weight-management
 * mechanism is a refusal degrades to unweighted and calls it safety.
 *
 * 14 against a 45-day refusal leaves two further rebuild opportunities before the cliff, so a
 * single failed nightly run cannot reach it.
 */
export const REFRESH_WEIGHT_AGE_DAYS = 14;

/**
 * What state is the weight table actually in? One function, because there are THREE states and the
 * code only ever reported one of them.
 *
 * ⛔ "absent" IS A DISTINCT STATE FROM "stale", AND IT WAS THE INVISIBLE ONE. server.js warned only
 * when `loaded.stale && loaded.weights.size` — so an EMPTY table produced no warning at all, and
 * scoring ran unweighted in complete silence. Production was in exactly that state: 0 rows, never
 * computed, no log line, no symptom. Measured cost of scoring unweighted there: 20.4% of board
 * scores differ by up to 5 points and 2.8% land in a different band.
 *
 * @returns {{ state: "fresh"|"stale"|"absent", terms: number, families: string[],
 *             computedAt: number|null, ageDays: number|null, corpusSize: number }}
 */
export function atsWeightStatus(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const absent = { state: "absent", terms: 0, families: [], computedAt: null, ageDays: null, corpusSize: 0 };
  let row, families;
  try {
    row = db.prepare(
      "SELECT COUNT(*) terms, MAX(computed_at) computed_at, MAX(corpus_size) corpus_size FROM ats_term_weights"
    ).get();
    families = db.prepare(
      "SELECT DISTINCT role_family FROM ats_term_weights ORDER BY role_family"
    ).all().map(r => r.role_family);
  } catch {
    return absent; // table not created yet — indistinguishable from empty, and means the same thing
  }
  if (!row || !row.terms) return absent;
  const computedAt = row.computed_at ?? null;
  const ageDays = Number.isFinite(computedAt) && computedAt > 0 ? (now - computedAt) / 86400 : null;
  return {
    state: weightsAreStale(computedAt, now) ? "stale" : "fresh",
    // ⭐ D170 (3b): past REFRESH_WEIGHT_AGE_DAYS the table is still used ("fresh") but OVERDUE — the schedule should
    // have replaced it. Production sat overdue for 20 days (34.7d, every rebuild refused) with only a boot info line
    // saying "fresh"; pipeline health now raises it from the 14th day, not silently at the 45-day cliff.
    overdue: ageDays != null && ageDays > REFRESH_WEIGHT_AGE_DAYS,
    terms: row.terms,
    families,
    computedAt,
    ageDays,
    corpusSize: row.corpus_size ?? 0,
  };
}

/** True when the schedule should rebuild: no table at all, or older than the refresh threshold. */
export function weightsNeedRefresh(status, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (status.state === "absent") return true;
  if (!Number.isFinite(status.computedAt) || status.computedAt <= 0) return true;
  return (now - status.computedAt) > REFRESH_WEIGHT_AGE_DAYS * 86400;
}

/**
 * Rebuild the weight table if it needs it. The scheduled half of the pair.
 *
 * Callers pass `onInvalidate` and MUST use it: server.js caches loaded weights per role family in
 * a module-level Map, so a recompute that does not clear that cache takes effect only after a
 * restart — which looks exactly like "the recompute did nothing". CC3 hit the identical shape with
 * the synonym cache and its note is worth re-reading before changing this.
 *
 * Never throws. A scorer running unweighted is worse than one running on 20-day-old weights, and
 * both are better than a crashed boot or a dead cron tick.
 *
 * @returns {{ ran: boolean, reason: string, before: object, after: object|null, result: object|null }}
 */
export function maybeRecomputeTermWeights(db, { force = false, now = Math.floor(Date.now() / 1000),
                                                onInvalidate = null, log = console } = {}) {
  const before = atsWeightStatus(db, { now });
  if (!force && !weightsNeedRefresh(before, { now })) {
    return { ran: false, reason: `weights are ${before.state} (${before.ageDays?.toFixed(1)}d old)`, before, after: null, result: null };
  }
  let result = null;
  try {
    result = computeTermWeights(db, { now });
  } catch (e) {
    log.error?.(`[ats-weights] recompute FAILED: ${e.message} — scoring continues unweighted`);
    return { ran: false, reason: `failed: ${e.message}`, before, after: before, result: null };
  }
  return settleRecompute(db, { result, before, force, now, onInvalidate, log });
}

/** ⭐ D170 (3): maybeRecomputeTermWeights through computeTermWeightsAsync — what server.js runs (boot and cron). */
export async function maybeRecomputeTermWeightsAsync(db, { force = false, now = Math.floor(Date.now() / 1000),
                                                           onInvalidate = null, log = console, pageRows, yieldFn,
                                                           dbPath = null, countOffThread = null } = {}) {
  const before = atsWeightStatus(db, { now });
  if (!force && !weightsNeedRefresh(before, { now })) {
    return { ran: false, reason: `weights are ${before.state} (${before.ageDays?.toFixed(1)}d old)`, before, after: null, result: null };
  }
  let result = null;
  try {
    const paging = { ...(pageRows ? { pageRows } : {}), ...(yieldFn ? { yieldFn } : {}) };
    result = dbPath
      ? await computeTermWeightsOffThread(db, { dbPath, now, log, countOffThread, ...paging })
      : await computeTermWeightsAsync(db, { now, ...paging });
  } catch (e) {
    log.error?.(`[ats-weights] recompute FAILED: ${e.message} — scoring continues unweighted`);
    return { ran: false, reason: `failed: ${e.message}`, before, after: before, result: null };
  }
  return settleRecompute(db, { result, before, force, now, onInvalidate, log });
}

function settleRecompute(db, { result, before, force, now, onInvalidate, log }) {
  // assessRebuildScope refuses to replace a good table from a suspiciously thin board. That is a
  // REFUSAL to destroy data, not a failure, and it must be reported as such or the next person
  // reads "0 terms written" as a broken recompute.
  if (result?.skipped) {
    log.warn?.(`[ats-weights] recompute REFUSED (board too thin): ${result.reason} — `
      + `keeping the existing table (${before.terms} terms, ${before.state})`);
    return { ran: false, reason: `refused: ${result.reason}`, before, after: before, result };
  }
  onInvalidate?.();
  const after = atsWeightStatus(db, { now });
  return { ran: true, reason: force ? "forced" : `was ${before.state}`, before, after, result };
}

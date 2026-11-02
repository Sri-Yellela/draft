/**
 * BOARD FIT PRECOMPUTE — score (user, active profile) x active postings AHEAD of the board.
 * ================================================================================================
 *
 * WHY A CACHE, AND WHY IT IS FILLED AHEAD OF TIME
 *
 * The board now ranks by fit (services/jobs/jobCursor.js, FIT_KEYS). Ordering needs EVERY row's
 * score, and scoring is local but not free: ~6.7 ms per posting on an idle machine, so a 2,600-row
 * board is ~17 s — far too slow per request. So the board reads a cache (`ats_only_reports`, keyed
 * (user_id, domain_profile_id, job_id), migration 108) and this module keeps that cache complete.
 *
 * ⛔ IT DOES NOT SCORE. It holds no copy of the scoring path. `basisFor` and `scoreJob` are
 * INJECTED, and server.js injects the same two functions the ATS panel (POST /api/jobs/:id/keywords)
 * and the apply worker call — so a precomputed score and the score the panel shows for the same
 * row are one computation, not two that happen to agree today. A second copy here is exactly how
 * the board's order and the report a user opens would come to disagree.
 *
 * ⛔ ZERO MODEL CALLS. The injected scorer is @draft/ats-scorer, which is deterministic, local and
 * imports no model client. test/boardFitRanking.test.js runs this module against the real scorer
 * with the network stubbed to throw, and scans the module graph for a model SDK import.
 *
 * INCREMENTAL. Each row carries `basis_hash` (migration 110): a hash of the candidate-side scoring
 * inputs — the runtime basis built from the résumé, signal profile, domain profile and claims —
 * plus the scorer version. A row is FRESH when its hash matches the current basis. Only missing
 * rows (a posting that arrived since the last run) and stale rows (the résumé, claims or profile
 * changed, or the scorer did) are scored. A second run over an unchanged board scores nothing.
 *
 * ⛔ "0 SCORED" AND "NOTHING TO DO" ARE DIFFERENT RESULTS AND ARE LOGGED DIFFERENTLY. A run that
 * found work and scored none of it is a failure; a run that found no work is a healthy steady
 * state. This codebase has already shipped one pair of numbers that printed the same for both
 * (Jobo's "complete — 0 jobs cached" for an unconfigured key), so `status` is explicit:
 *
 *   nothing_to_do   every active posting already has a fresh row
 *   scored          work was found and at least one row was written
 *   failed          work was found and NOT ONE row was written          (logged at error level)
 *   no_basis        the profile has no base résumé, so there is nothing to score against
 *   dry_run         the plan only — counts, no scoring, no writes
 *
 * BOUNDED. Rows are read in batches of `batchSize` and scored in time slices of `sliceMs`; between
 * slices it yields to the event loop (setImmediate), so a full-board pass never holds the loop for
 * more than about one slice. A pass's writes happen only AFTER all of its scoring, in a few
 * back-to-back chunked transactions, so the board's order changes in one short window rather than
 * continuously under a user who is paging it (see the commit note in runFor — measured, not
 * supposed).
 *
 * ⛔ A52 · AND EACH ROW SAYS WHICH VERSION OF THE POSTING IT SCORED (`job_hash`, migration 118).
 * `basis_hash` covers only the CANDIDATE side. The posting side moves too — enrichment lands
 * `skills_json` days after a row is first scored, a re-crawl rewrites a description, a fetch-on-open
 * buys one — and before 118 none of that made a row stale: a posting scored "not enough signal"
 * while unenriched kept that verdict forever, while the ATS panel, scoring the same posting fresh,
 * read "Strong match". The card and the panel disagreed on one screen (A52). A row is now fresh
 * only when BOTH hashes match; a NULL `job_hash` (written before 118) reads as stale, never fresh.
 *
 * WHAT IS DELIBERATELY NOT IN THE HASH. Term weights and confirmed synonyms are CORPUS-side inputs
 * that move for everyone at once (the nightly weight recompute). Hashing them would re-score every
 * profile every night; leaving them out means a score can lag a weight refresh until its row is
 * next rescored. That trade is stated here rather than discovered — `force` re-scores everything.
 */
"use strict";

import crypto from "node:crypto";
import { freshText } from "./descriptionText.js";

/** Stable JSON: object keys sorted, so a basis re-read from the database hashes identically. */
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/**
 * The hash of the candidate-side scoring inputs.
 *
 * `termWeights` is dropped from the basis before hashing (see the header: corpus-side, and the
 * callers attach it per job, not per basis). `scorerVersion` is included so a scorer change makes
 * every stored row stale rather than silently mixing two engines' numbers on one board.
 */
export function atsBasisHash(runtimeBasis, { scorerVersion = "" } = {}) {
  if (!runtimeBasis) return null;
  const { termWeights, ...candidateSide } = runtimeBasis;
  void termWeights;
  return crypto.createHash("sha256")
    .update(stableStringify({ v: 1, scorer: String(scorerVersion), basis: candidateSide }))
    .digest("hex")
    .slice(0, 32);
}

/**
 * The hash of the POSTING-side scoring inputs (A52) — exactly the columns the scorer reads off a job
 * (@draft/ats-scorer scoreAtsLocally: title, company, category, description, skills_json) plus
 * normalized_title, which picks the term-weight family. A change to any of them changes the score,
 * so it must change this hash; nothing else on the row may, or a re-crawl that only touched
 * `scraped_at` would re-score the board. (The scorer also reads `requirements` and `skills`, which
 * are not scraped_jobs columns — a stored posting never carries them — so they are not here; the
 * test pins this list against the table.)
 *
 * ⛔ ONE DEFINITION. The precompute's plan, the ATS panel's cache read, the board's read and every
 * writer call this function; a second copy is how they would come to disagree about "fresh".
 */
export const ATS_JOB_INPUT_FIELDS = Object.freeze([
  "title", "company", "category", "description", "skills_json", "normalized_title",
]);
/**
 * ⛔ D59 · THE SCORER READS THE NORMALISED TEXT. `description` in the hash is the text the scorer is
 * handed (services/jobs/descriptionText.js withPostingText): description_text while it is FRESH — read
 * from the description the row holds now — else the stored description. So the two columns that decide
 * it travel with the hash inputs (POSTING_TEXT_COLUMNS), and a re-crawl that changes the description
 * changes the hash at once.
 */
export const POSTING_TEXT_COLUMNS = Object.freeze(["description_text", "description_basis"]);
export function atsJobInputHash(job) {
  if (!job) return null;
  const h = crypto.createHash("sha256").update("job-v1");
  const text = freshText(job);
  for (const k of ATS_JOB_INPUT_FIELDS) {
    const v = k === "description" && text != null ? text : job[k];
    // A separator and an explicit null marker, so ("ab", "") and ("a", "b") cannot collide and a
    // NULL column is not the same posting as an empty one.
    h.update("\u0000").update(k).update("=").update(v == null ? "\u0001" : String(v));
  }
  return h.digest("hex").slice(0, 32);
}

/**
 * THE BOARD'S READ OF A STORED SCORE (A52). The board selects `aor.ats_score` for every row it
 * returns; a stored score is presented only when it is still a statement about THIS posting.
 *
 * `storedScoreSql` is the projection to append to the board's SELECT (the hash inputs under their
 * own aliases, so a trimmed `include_fields` select still carries them, plus the stored job_hash
 * and whether a row exists). `presentedScore(row)` returns the stored score when its job_hash
 * matches the posting as it is now, and null otherwise — null is "no opinion", which every client
 * already renders as nothing. ⛔ A stale score is never shown as a verdict; the next precompute
 * pass (the board load itself schedules one) replaces it.
 */
export const STORED_SCORE_PREFIX = "__atsin_";
export function storedScoreSql(jobAlias = "sj", aorAlias = "aor") {
  return [
    `${aorAlias}.id AS ${STORED_SCORE_PREFIX}row`,
    `${aorAlias}.job_hash AS ${STORED_SCORE_PREFIX}stored_hash`,
    `${aorAlias}.basis_hash AS ${STORED_SCORE_PREFIX}stored_basis`,
    ...[...ATS_JOB_INPUT_FIELDS, ...POSTING_TEXT_COLUMNS].map(c => `${jobAlias}.${c} AS ${STORED_SCORE_PREFIX}${c}`),
  ].join(", ");
}
/**
 * `basisHash` is the caller's CURRENT candidate basis (atsBasisForProfile); a row scored against an
 * earlier résumé, claim set or profile is stale too. Passing undefined skips that half — only for a
 * caller with no basis to compare (no base résumé), where every stored row is stale anyway.
 */
export function storedScoreIsCurrent(row, { basisHash } = {}) {
  if (!row || row[`${STORED_SCORE_PREFIX}row`] == null) return false;
  if (basisHash !== undefined && row[`${STORED_SCORE_PREFIX}stored_basis`] !== basisHash) return false;
  const inputs = {};
  for (const c of [...ATS_JOB_INPUT_FIELDS, ...POSTING_TEXT_COLUMNS]) inputs[c] = row[`${STORED_SCORE_PREFIX}${c}`];
  return row[`${STORED_SCORE_PREFIX}stored_hash`] === atsJobInputHash(inputs);
}
export function presentedScore(row, { basisHash, scoreKey = "matchScore" } = {}) {
  return storedScoreIsCurrent(row, { basisHash }) ? (row[scoreKey] ?? null) : null;
}

// ── A85 · THE FIT FILTER READS THE SAME "CURRENT" THE BADGE DOES ──────────────────────────────────
//
// The badge is presentedScore above: a stored score shows only when its basis_hash is the caller's
// current basis AND its job_hash is the posting's inputs as they are now. The fit filter used to read
// the raw stored cell, so a stale score could file a card under "Strong" while its badge was blank.
// ⛔ ONE DEFINITION OF CURRENT: the same atsJobInputHash, registered as a SQL function so the
// WHERE clause can ask it, and the same basis comparison.
export const ATS_INPUT_HASH_FN = "ats_job_input_hash";
const fnRegistered = new WeakSet();
export function registerScoreFreshness(db) {
  if (fnRegistered.has(db)) return;
  db.function(ATS_INPUT_HASH_FN, { deterministic: true, varargs: true }, (...vals) =>
    atsJobInputHash(Object.fromEntries([...ATS_JOB_INPUT_FIELDS, ...POSTING_TEXT_COLUMNS].map((k, i) => [k, vals[i]]))));
  fnRegistered.add(db);
}
/**
 * The caller's CURRENT stored score as a SQL expression — the score, or NULL when there is none or
 * it is stale. ⛔ The basis is inlined as a literal, which is safe ONLY because it is validated as the
 * hex digest our own atsBasisHash produces; anything else (including no basis: no base résumé, so no
 * stored score is current) yields NULL — exactly what presentedScore answers for that caller.
 */
export function currentScoreSql(basisHash, jobAlias = "sj", aorAlias = "aor") {
  if (typeof basisHash !== "string" || !/^[0-9a-f]{8,128}$/.test(basisHash)) return "NULL";
  // D59: positional — the scorer's inputs, then the two columns that decide which text it reads.
  const inputs = [...ATS_JOB_INPUT_FIELDS, ...POSTING_TEXT_COLUMNS].map(c => `${jobAlias}.${c}`).join(", ");
  return `(CASE WHEN ${aorAlias}.id IS NOT NULL AND ${aorAlias}.basis_hash = '${basisHash}' ` +
    `AND ${aorAlias}.job_hash = ${ATS_INPUT_HASH_FN}(${inputs}) THEN ${aorAlias}.ats_score END)`;
}

const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

/**
 * @param {object}   deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {(userId:number, profile:object) => ({ runtimeBasis:object, basisHash:string } | null)} deps.basisFor
 *        The panel's basis builder. null means "no base résumé".
 * @param {(job:object, runtimeBasis:object) => object} deps.scoreJob   The panel's scorer call.
 * @param {(args:{userId:number, profileId:number, jobId:string, report:object, basisHash:string, jobHash:string}) => void} deps.store
 *        The one ATS-report writer (server.js storeAtsReportForProfile).
 */
export function createBoardFitPrecompute({
  db, basisFor, scoreJob, store,
  // ⭐ 43y (11-01): (userId, profile) -> job ids to score FIRST for a profile with no scores at all (its own category,
  // newest first). Without it a new tester's deck waited for the whole board — measured 320 s for 2,411 postings.
  primeFor = null,
  primeSize = 60,
  // ⭐ A112 (11-02): (userId, profile) -> the board category this profile's board shows, or null for every category.
  // The crawler boost took the board from 3,734 to 79,184 postings, and this scored EVERY active posting for every
  // profile — 418,711 stored reports (≈ 500 MB) for 15 users, ≈ 9 min of scoring per profile per crawl. The board's
  // default view shows the profile's own category (and unclassified rows) only, so only those are precomputed; a
  // posting reached by a search or another function is scored when it is opened, as before.
  scopeFor = null,
  log = console,
  batchSize = 50,
  sliceMs = 40,
  commitChunk = 400,
  now = () => performance.now(),
} = {}) {
  if (!db || typeof basisFor !== "function" || typeof scoreJob !== "function" || typeof store !== "function") {
    throw new Error("createBoardFitPrecompute needs db, basisFor, scoreJob and store");
  }

  // ⛔ `IS NOT ?`, NOT `<> ?`. A row written before migration 110 carries basis_hash NULL, and
  // `NULL <> 'abc'` is NULL — falsy — so a `<>` plan would call every legacy row fresh forever.
  // `IS NOT` is SQLite's null-safe inequality. `domain_profile_id IS ?` for the same reason the
  // board's join uses it.
  //
  // A52: the basis is still judged in SQL; the POSTING side is judged here in JS, because SQLite has
  // no hash function — every row whose basis matches is read with its scorer inputs and its stored
  // `job_hash` is compared with atsJobInputHash.
  // D59: a database without migration 137's columns (a hand-built fixture) hashes the stored description.
  const columns = db.prepare("PRAGMA table_info(scraped_jobs)").all();
  const hasPostingText = columns.some(c => c.name === "description_text");
  // A112: the board's own category clause (server.js /api/jobs) — 'held' never, another category not by default.
  const SCOPE_SQL = columns.some(c => c.name === "board_category")
    ? " AND (sj.board_category IS NULL OR (sj.board_category <> 'held' AND (? IS NULL OR sj.board_category = ?)))"
    : "";
  const planStmt = db.prepare(`
    SELECT sj.job_id AS job_id,
           CASE WHEN aor.id IS NULL THEN 'missing'
                WHEN aor.basis_hash IS NOT ? OR ? = 1 THEN 'stale'
                ELSE 'check' END AS why,
           aor.job_hash AS stored_job_hash,
           ${[...ATS_JOB_INPUT_FIELDS, ...(hasPostingText ? POSTING_TEXT_COLUMNS : [])].map(c => `sj.${c}`).join(", ")}
    FROM scraped_jobs sj
    LEFT JOIN ats_only_reports aor
      ON aor.job_id = sj.job_id AND aor.user_id = ? AND aor.domain_profile_id IS ?
    WHERE sj.is_active = 1${SCOPE_SQL}
    ORDER BY sj.job_id
  `);
  const activeCountStmt = db.prepare(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE sj.is_active = 1${SCOPE_SQL}`);
  const inFlight = new Map();   // "user:profile" -> { promise, rerun }

  /** What would be scored, without scoring it. */
  function plan({ userId, profileId, basisHash, force = false, category = null }) {
    const scope = SCOPE_SQL ? [category, category] : [];
    const all = planStmt.all(basisHash, force ? 1 : 0, userId, profileId ?? null, ...scope);
    const active = activeCountStmt.get(...scope).n;
    let missing = 0, stale = 0, postingChanged = 0;
    const jobIds = [];
    for (const r of all) {
      if (r.why === "missing") { missing++; jobIds.push(r.job_id); continue; }
      if (r.why === "stale") { stale++; jobIds.push(r.job_id); continue; }
      // The basis matches: the row is fresh only if the POSTING is still the one that was scored.
      if (r.stored_job_hash !== atsJobInputHash(r)) { stale++; postingChanged++; jobIds.push(r.job_id); }
    }
    return { active, missing, stale, postingChanged, fresh: active - jobIds.length, jobIds };
  }

  function emit(level, result) {
    const line = `[board-fit] ${JSON.stringify(result)}`;
    if (level === "error") log.error(line); else if (level === "warn") log.warn(line); else log.log(line);
  }

  /** Score one (user, profile). Never throws; the result says what happened. */
  async function runFor({ userId, profile, dryRun = false, force = false, reason = "manual" }) {
    const started = now();
    const base = { userId, profileId: profile?.id ?? null, reason };
    if (!profile?.id) {
      const r = { ...base, status: "no_basis", why: "no_active_profile", ms: 0 };
      emit("warn", r); return r;
    }
    let basis;
    try { basis = basisFor(userId, profile); } catch (e) {
      const r = { ...base, status: "failed", error: `basis: ${e.message}`, ms: Math.round(now() - started) };
      emit("error", r); return r;
    }
    if (!basis?.runtimeBasis || !basis.basisHash) {
      const r = { ...base, status: "no_basis", why: "no_base_resume", ms: Math.round(now() - started) };
      emit("warn", r); return r;
    }

    let category = null;
    try { category = scopeFor ? scopeFor(userId, profile) ?? null : null; } catch { category = null; }
    const p = plan({ userId, profileId: profile.id, basisHash: basis.basisHash, force, category });
    const counts = { active: p.active, fresh: p.fresh, missing: p.missing, stale: p.stale,
                     postingChanged: p.postingChanged, todo: p.jobIds.length };
    if (dryRun) {
      const r = { ...base, status: "dry_run", ...counts, basisHash: basis.basisHash, ms: Math.round(now() - started) };
      emit("log", r); return r;
    }
    if (!p.jobIds.length) {
      const r = { ...base, status: "nothing_to_do", ...counts, scored: 0, ms: Math.round(now() - started) };
      emit("log", r); return r;
    }

    let failed = 0, gone = 0, yields = 0, longestSliceMs = 0;
    const errors = [];
    const results = [];
    const writeChunk = db.transaction((items) => {
      for (const it of items) {
        store({ userId, profileId: profile.id, jobId: it.jobId, report: it.report, basisHash: basis.basisHash, jobHash: it.jobHash });
      }
    });

    // ⭐ 43y · THE FIRST SCORES FOR A NEW PROFILE, NOW. A profile with NOTHING scored has an empty deck until this pass
    // ends (writes come after the whole pass, below — for a board someone is paging). With nothing scored there is no
    // ranked board to disturb, so the prime set (its own category, newest first) is scored and WRITTEN at once; the
    // deal can then deal from it within seconds, and the rest of the pass carries on as before.
    let primed = new Set();
    if (primeFor && p.fresh === 0 && p.jobIds.length > primeSize) {
      let want = [];
      try { want = (primeFor(userId, profile) || []).filter(id => p.jobIds.includes(id)).slice(0, primeSize); } catch { want = []; }
      if (want.length) {
        const jobs = db.prepare(`SELECT * FROM scraped_jobs WHERE is_active = 1 AND job_id IN (${want.map(() => "?").join(",")})`).all(...want);
        const first = [];
        let sliceStart = now();
        for (const job of jobs) {
          try { first.push({ jobId: job.job_id, report: scoreJob(job, basis.runtimeBasis), jobHash: atsJobInputHash(job) }); }
          catch (e) { failed++; if (errors.length < 5) errors.push(`${job.job_id}: ${e.message}`); }
          if (now() - sliceStart >= sliceMs) { yields++; await yieldToEventLoop(); sliceStart = now(); }
        }
        try { writeChunk(first); primed = new Set(first.map(x => x.jobId)); }
        catch (e) { if (errors.length < 5) errors.push(`prime commit: ${e.message}`); }
        emit("log", { ...base, status: "primed", primed: primed.size, ms: Math.round(now() - started) });
      }
    }
    const todoIds = primed.size ? p.jobIds.filter(id => !primed.has(id)) : p.jobIds;

    for (let i = 0; i < todoIds.length; i += batchSize) {
      const ids = todoIds.slice(i, i + batchSize);
      // The panel reads `SELECT * FROM scraped_jobs` for the job it scores; so does this, so the
      // scorer sees the same columns on both paths. Re-checks is_active: a row retired between the
      // plan and this batch is skipped, not scored.
      const jobs = db.prepare(
        `SELECT * FROM scraped_jobs WHERE is_active = 1 AND job_id IN (${ids.map(() => "?").join(",")})`,
      ).all(...ids);
      gone += ids.length - jobs.length;
      let sliceStart = now();
      for (const job of jobs) {
        try {
          results.push({ jobId: job.job_id, report: scoreJob(job, basis.runtimeBasis), jobHash: atsJobInputHash(job) });
        } catch (e) {
          failed++;
          if (errors.length < 5) errors.push(`${job.job_id}: ${e.message}`);
        }
        if (now() - sliceStart >= sliceMs) {
          longestSliceMs = Math.max(longestSliceMs, now() - sliceStart);
          yields++;
          await yieldToEventLoop();
          sliceStart = now();
        }
      }
      longestSliceMs = Math.max(longestSliceMs, now() - sliceStart);
      yields++;
      await yieldToEventLoop();
    }

    // ⛔ WRITTEN AFTER SCORING, NOT INTERLEAVED WITH IT — and this is a measured defect, not
    // tidiness. The first version wrote each slice as it was scored. The fit keys are SORT keys, so
    // every slice commit moved rows across a user's board while they were paging it: a cursor walk
    // of the owner's 681-row board run during a pass returned 680 rows, one skipped because its
    // score landed and carried it behind the cursor mid-walk. Writing only after the whole pass is
    // scored confines the board's change to one short window at the end; the cursor's fit epoch
    // (server.js, jobCursor encodeCursor) then turns a walk that straddles it into a
    // `cursor_sort_mismatch` the client restarts on, instead of a silent skip.
    //
    // In CHUNKS of `commitChunk` with a yield between, because one transaction over the whole board
    // was also measured: 2,616 rows held the event loop for 3.2 s on a loaded machine. Chunks keep
    // each hold to a fraction of that, and they are written back to back, so the window in which
    // the board is partly updated is a few event-loop turns — any cursor issued inside it is refused
    // by the epoch like any other. Memory is bounded by the board: ~850 bytes of report per posting.
    let scored = primed.size, commitMs = 0, commits = 0, longestCommitMs = 0;
    for (let i = 0; i < results.length; i += commitChunk) {
      const chunk = results.slice(i, i + commitChunk);
      const commitStart = now();
      try {
        writeChunk(chunk);
        scored += chunk.length;
      } catch (e) {
        failed += chunk.length;
        if (errors.length < 5) errors.push(`commit: ${e.message}`);
      }
      const took = now() - commitStart;
      commitMs += took; commits++; longestCommitMs = Math.max(longestCommitMs, took);
      if (i + commitChunk < results.length) await yieldToEventLoop();
    }

    const r = {
      ...base, status: scored > 0 ? "scored" : "failed", ...counts,
      scored, failed, gone, yields, longestSliceMs: Math.round(longestSliceMs),
      commits, commitMs: Math.round(commitMs), longestCommitMs: Math.round(longestCommitMs),
      ms: Math.round(now() - started),
      ...(errors.length ? { errors } : {}),
    };
    // A run that found work and wrote NOTHING is an error, not a quiet zero.
    emit(r.status === "failed" ? "error" : failed ? "warn" : "log", r);
    return r;
  }

  /**
   * Coalescing entry point for triggers. One run per (user, profile) at a time; a trigger that
   * lands mid-run asks for ONE more pass afterwards (incremental, so it only picks up what changed)
   * instead of starting a second concurrent pass over the same rows.
   */
  function schedule({ userId, profile, reason = "trigger", force = false }) {
    const key = `${userId}:${profile?.id ?? "none"}`;
    const running = inFlight.get(key);
    if (running) { running.rerun = true; running.force ||= force; return running.promise; }
    const entry = { rerun: false, force: false, promise: null };
    entry.promise = (async () => {
      let last = await runFor({ userId, profile, reason, force });
      while (entry.rerun) {
        const again = entry.force; entry.rerun = false; entry.force = false;
        last = await runFor({ userId, profile, reason: `${reason}+rerun`, force: again });
      }
      return last;
    })().finally(() => inFlight.delete(key));
    inFlight.set(key, entry);
    return entry.promise;
  }

  /** Every user's ACTIVE profile — the one the board is ranked for. Sequential, never parallel. */
  async function runAll({ dryRun = false, force = false, reason = "all", userId = null } = {}) {
    const profiles = db.prepare(`
      SELECT * FROM domain_profiles WHERE is_active = 1 ${userId != null ? "AND user_id = ?" : ""}
      ORDER BY user_id, id
    `).all(...(userId != null ? [userId] : []));
    const results = [];
    for (const profile of profiles) {
      results.push(dryRun
        // `force` passed through (A50): a dry run of a forced pass must plan the forced pass. Without
        // it the plan counted only missing/stale rows, so the admin panel's dry run of "force" showed
        // a smaller job than the real run it was the preview for.
        ? await runFor({ userId: profile.user_id, profile, dryRun: true, force, reason })
        : await schedule({ userId: profile.user_id, profile, reason, force }));
    }
    const summary = {
      reason, dryRun, profiles: results.length,
      byStatus: results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {}),
      scored: results.reduce((a, r) => a + (r.scored || 0), 0),
      todo: results.reduce((a, r) => a + (r.todo || 0), 0),
    };
    emit(summary.byStatus.failed ? "error" : "log", { summary });
    return { summary, results };
  }

  return { plan, runFor, schedule, runAll, isRunning: (userId, profileId) => inFlight.has(`${userId}:${profileId}`) };
}

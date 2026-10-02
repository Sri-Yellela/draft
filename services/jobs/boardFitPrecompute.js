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
 * WHAT IS DELIBERATELY NOT IN THE HASH. Term weights and confirmed synonyms are CORPUS-side inputs
 * that move for everyone at once (the nightly weight recompute). Hashing them would re-score every
 * profile every night; leaving them out means a score can lag a weight refresh until its row is
 * next rescored. That trade is stated here rather than discovered — `force` re-scores everything.
 */
"use strict";

import crypto from "node:crypto";

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

const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

/**
 * @param {object}   deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {(userId:number, profile:object) => ({ runtimeBasis:object, basisHash:string } | null)} deps.basisFor
 *        The panel's basis builder. null means "no base résumé".
 * @param {(job:object, runtimeBasis:object) => object} deps.scoreJob   The panel's scorer call.
 * @param {(args:{userId:number, profileId:number, jobId:string, report:object, basisHash:string}) => void} deps.store
 *        The one ATS-report writer (server.js storeAtsReportForProfile).
 */
export function createBoardFitPrecompute({
  db, basisFor, scoreJob, store,
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
  const planStmt = db.prepare(`
    SELECT sj.job_id AS job_id,
           CASE WHEN aor.id IS NULL THEN 'missing' ELSE 'stale' END AS why
    FROM scraped_jobs sj
    LEFT JOIN ats_only_reports aor
      ON aor.job_id = sj.job_id AND aor.user_id = ? AND aor.domain_profile_id IS ?
    WHERE sj.is_active = 1
      AND (aor.id IS NULL OR aor.basis_hash IS NOT ? OR ? = 1)
    ORDER BY sj.job_id
  `);
  const activeCountStmt = db.prepare("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1");
  const inFlight = new Map();   // "user:profile" -> { promise, rerun }

  /** What would be scored, without scoring it. */
  function plan({ userId, profileId, basisHash, force = false }) {
    const rows = planStmt.all(userId, profileId ?? null, basisHash, force ? 1 : 0);
    const active = activeCountStmt.get().n;
    const missing = rows.filter(r => r.why === "missing").length;
    return {
      active, missing, stale: rows.length - missing, fresh: active - rows.length,
      jobIds: rows.map(r => r.job_id),
    };
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

    const p = plan({ userId, profileId: profile.id, basisHash: basis.basisHash, force });
    const counts = { active: p.active, fresh: p.fresh, missing: p.missing, stale: p.stale, todo: p.jobIds.length };
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
    for (let i = 0; i < p.jobIds.length; i += batchSize) {
      const ids = p.jobIds.slice(i, i + batchSize);
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
          results.push({ jobId: job.job_id, report: scoreJob(job, basis.runtimeBasis) });
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
    let scored = 0, commitMs = 0, commits = 0, longestCommitMs = 0;
    const writeChunk = db.transaction((items) => {
      for (const it of items) {
        store({ userId, profileId: profile.id, jobId: it.jobId, report: it.report, basisHash: basis.basisHash });
      }
    });
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

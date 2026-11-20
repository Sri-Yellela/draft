// ⭐ D151 RULE 3 · BOARD-FIT SCORING OFF THE EVENT LOOP.
//
// Measured 11-08 on the 100k synthetic fixture (one user, after the boot passes settled, a main-thread V8 profile over
// three board loads): the board-fit precompute's scoring (scoreJobForBasis -> scoreAtsLocally) was ≈ 3.8 s of a 4.5 s
// window on the one Node thread. It was already time-sliced (40 ms, then a yield), so no single block was long — but every
// request still queued behind slice after slice. This pool runs the SAME scorer in a worker thread: the main thread
// prepares a batch (the normalised posting text, the term weights once per role family, the synonyms once, the basis),
// the worker scores it, and the reports come back in order.
//
// ⭐ IT NEVER FAILS CLOSED, like the read pool (services/db/readWorker.js): if the worker cannot start, dies, times out
// or answers wrongly, `score` rejects and the caller (boardFitPrecompute scoreMany) scores the batch on the main thread
// exactly as before. A posting the scorer throws on comes back as { error } for that posting only.
//
// ⛔ The worker imports services/localAtsScorer.js — the one scoring entry point — so the two paths cannot diverge
// (test/d151ScoreWorker.test.js compares them report for report).
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);

if (!isMainThread && workerData?.__draftScoreWorker) {
  const { scoreAtsLocally } = await import("../localAtsScorer.js");
  // ⭐ D184 B-8 (46y): with `ctx` ({ shared, items } — services/jobs/boardContextual.js), the contextual number for each scored
  // posting is worked out HERE beside its report (contextualScoreFor, the same pure function the main-thread fallback calls).
  const { contextualScoreFor } = await import("./boardContextual.js");
  parentPort.on("message", ({ id, items, weights, synonyms, runtimeBasis, ctx }) => {
    const out = items.map(({ job, wk }, i) => {
      try {
        const report = scoreAtsLocally({ job, runtimeBasis, termWeights: weights[wk] ?? null, synonyms });
        return ctx ? { report, contextual: contextualScoreFor(job, report, ctx.items?.[i], ctx.shared) } : { report };
      }
      catch (e) { return { error: e?.message || String(e) }; }
    });
    parentPort.postMessage({ id, out });
  });
  parentPort.postMessage({ ready: true });
}

/**
 * @param {object} o
 * @param {number} [o.size]       workers (default 1 — scoring is CPU work; one core off the loop is the point)
 * @param {number} [o.timeoutMs]  a batch not answered by then rejects (the caller scores it on the main thread)
 * @param {boolean} [o.enabled]   false → `score` always rejects at once (DRAFT_SCORE_WORKER=off)
 */
export function createScorePool({ size = 1, timeoutMs = 60_000, enabled = true, log = console } = {}) {
  const workers = [];
  const pending = new Map();
  let nextId = 1, closed = false;
  const stats = { batches: 0, jobs: 0, rejected: 0, restarts: 0, lastError: null };

  const spawn = (slot) => {
    if (closed) return;
    let w;
    try { w = new Worker(HERE, { workerData: { __draftScoreWorker: true } }); }
    catch (err) { stats.lastError = `spawn: ${err.message}`; log.error?.(`[score-pool] worker ${slot} could not start — scoring stays on the main thread: ${err.message}`); workers[slot] = null; return; }
    const entry = { w, ready: false, inflight: 0 };
    workers[slot] = entry;
    w.on("message", (m) => {
      if (m?.ready) { entry.ready = true; return; }
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer); entry.inflight--;
      if (!Array.isArray(m.out) || m.out.length !== p.n) { stats.rejected++; p.reject(new Error("score worker answered the wrong length")); return; }
      stats.batches++; stats.jobs += p.n;
      p.resolve(m.out);
    });
    w.on("error", (err) => { stats.lastError = err.message; log.error?.(`[score-pool] worker ${slot} error: ${err.message}`); });
    w.on("exit", () => {
      entry.ready = false;
      for (const [id, p] of pending) { if (p.entry !== entry) continue; pending.delete(id); clearTimeout(p.timer); stats.rejected++; p.reject(new Error("score worker exited")); }
      if (closed) return;
      stats.restarts++;
      if (stats.restarts <= 20) setTimeout(() => spawn(slot), 1000).unref?.();
    });
    w.unref();
  };
  if (enabled) for (let i = 0; i < size; i++) spawn(i);

  const pick = () => workers.filter(e => e?.ready).sort((a, b) => a.inflight - b.inflight)[0] || null;

  /** Score a prepared batch. @returns Promise<[{ report } | { error }]> in the items' order; rejects → score on the main thread. */
  function score({ items, weights = {}, synonyms = null, runtimeBasis, ctx = null }) {
    const entry = enabled && !closed ? pick() : null;
    if (!entry) { stats.rejected++; return Promise.reject(new Error("no score worker ready")); }
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id); entry.inflight--; stats.rejected++; stats.lastError = `timeout after ${timeoutMs} ms`;
        reject(new Error("score worker timed out"));
      }, timeoutMs);
      timer.unref?.();
      pending.set(id, { resolve, reject, timer, entry, n: items.length });
      entry.inflight++;
      try { entry.w.postMessage({ id, items, weights, synonyms, runtimeBasis, ...(ctx ? { ctx } : {}) }); }
      catch (err) { pending.delete(id); clearTimeout(timer); entry.inflight--; stats.rejected++; reject(err); }
    });
  }

  return {
    score,
    status: () => ({ enabled, size, ready: workers.filter(e => e?.ready).length, inflight: pending.size, ...stats }),
    close: async () => { closed = true; await Promise.all(workers.filter(Boolean).map(e => e.w.terminate().catch(() => {}))); },
  };
}

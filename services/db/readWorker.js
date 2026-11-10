// ⛔ HOTFIX 11-05 (A126) · THE BOARD'S HEAVY READS RUN OFF THE EVENT LOOP.
//
// Measured on production 11-05 16:39–16:45Z: one signed-in person opening Home froze the whole site for six minutes.
// GET /api/jobs (≈ 4–25 s since the 11-02 crawl grew the board to 80k postings) and /api/jobs/facets (5 + N whole-board
// aggregates) are synchronous better-sqlite3 reads on the one Node thread; while one ran, every other request waited —
// the sign-out POST answered after 229 s, a static PNG after 21 s, the board-fit pass took 352 s for 1 s of work.
//
// This is a small pool of worker threads, each with its OWN read-only connection to the same WAL database (WAL lets
// readers run beside the writer). The main thread sends { sql, params } and awaits the rows; the loop stays free.
//
// ⭐ IT NEVER FAILS CLOSED. If a worker cannot start, dies, or a read errors for a reason that is not the SQL's own
// (the worker gone, a timeout), the caller's read runs on the main connection exactly as before — slower, never broken.
// A real SQL error is the SQL's own and is thrown as it would have been.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);

if (!isMainThread && workerData?.__draftReadWorker) {
  const { default: Database } = await import("better-sqlite3");
  const conn = new Database(workerData.dbPath, { readonly: true, fileMustExist: true });
  conn.pragma("busy_timeout = 5000");
  // The board's WHERE / ORDER BY call these SQL functions — the same registrars the main connection uses.
  const [{ registerBoardSearch }, { registerScoreFreshness }, { registerDescriptionBasis }] = await Promise.all([
    import("../jobs/boardSearch.js"), import("../jobs/boardFitPrecompute.js"), import("../jobs/descriptionText.js"),
  ]);
  registerBoardSearch(conn); registerScoreFreshness(conn); registerDescriptionBasis(conn);
  const stmts = new Map();
  const prep = (sql) => {
    let s = stmts.get(sql);
    if (!s) { s = conn.prepare(sql); if (stmts.size > 500) stmts.clear(); stmts.set(sql, s); }
    return s;
  };
  // ⭐ D151 Rule 4 · an opt-in slow-read log (READ_SLOW_MS=<ms>): a read slower than that prints its time, the statement's
  // first 400 characters and its EXPLAIN QUERY PLAN — never its parameters (they can carry a person's search). Off by default.
  const slowMs = Number(process.env.READ_SLOW_MS) || 0;
  parentPort.on("message", ({ id, op, sql, params }) => {
    try {
      const s = prep(sql);
      const t0 = slowMs ? performance.now() : 0;
      const value = op === "get" ? s.get(...params) : s.all(...params);
      if (slowMs) {
        const ms = Math.round(performance.now() - t0);
        if (ms >= slowMs) {
          let plan = "";
          try { plan = conn.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params).map(r => r.detail).join(" | "); } catch { /* the plan is a hint only */ }
          const full = process.env.READ_SLOW_FULL === "1";   // the whole statement and plan (still never the parameters)
          console.log(`[read-slow] ${ms} ms · ${full ? sql.replace(/\s+/g, " ") : sql.replace(/\s+/g, " ").slice(0, 400)} · PLAN ${full ? plan : plan.slice(0, 600)}`);
        }
      }
      parentPort.postMessage({ id, ok: true, value });
    } catch (err) {
      parentPort.postMessage({ id, ok: false, sqlError: true, message: err.message, code: err.code });
    }
  });
  parentPort.postMessage({ ready: true });
}

/**
 * @param {object} o
 * @param {string} o.dbPath
 * @param {import('better-sqlite3').Database} o.fallbackDb   the main connection — used whenever the pool cannot answer
 * @param {number} [o.size]        workers (default 2)
 * @param {number} [o.timeoutMs]   a read the pool has not answered by then runs on the main connection (default 60 s)
 * @param {boolean} [o.enabled]    false → every read runs on the main connection (DRAFT_READ_WORKERS=off)
 */
export function createReadPool({ dbPath, fallbackDb, size = 2, timeoutMs = 60_000, enabled = true, log = console } = {}) {
  const waitMs = Number(process.env.READ_SLOW_MS) || 0;   // A175: the round-trip log's threshold (off unless READ_SLOW_MS)
  const workers = [];
  const pending = new Map();
  let nextId = 1, rr = 0, closed = false;
  const stats = { served: 0, fallback: 0, restarts: 0, lastError: null };

  const fallback = (op, sql, params) => {
    stats.fallback++;
    const s = fallbackDb.prepare(sql);
    return op === "get" ? s.get(...params) : s.all(...params);
  };

  const spawn = (slot) => {
    if (closed) return;
    let w;
    try {
      w = new Worker(HERE, { workerData: { __draftReadWorker: true, dbPath } });
    } catch (err) {
      stats.lastError = `spawn: ${err.message}`;
      log.error?.(`[read-pool] worker ${slot} could not start — reads run on the main connection: ${err.message}`);
      workers[slot] = null;
      return;
    }
    const entry = { w, ready: false, inflight: 0 };
    workers[slot] = entry;
    w.on("message", (m) => {
      if (m?.ready) { entry.ready = true; return; }
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer); entry.inflight--;
      if (m.ok) {
        stats.served++;
        // ⭐ A175 (46d) · READ_SLOW_MS also names the reads that WAITED: the whole round trip (queued behind the worker's
        // other reads + run), beside the worker's own run time it already logs — a busy pool shows up as waits, not runs.
        if (waitMs && p.at && Date.now() - p.at >= waitMs) log.log?.(`[read-wait] ${Date.now() - p.at} ms round trip (worker ${entry.slot ?? "?"}, ${entry.inflight + 1} in flight) · ${String(p.sql).replace(/\s+/g, " ").slice(0, 120)}`);
        p.resolve(m.value); return;
      }
      const e = new Error(m.message); e.code = m.code;
      p.reject(e);
    });
    w.on("error", (err) => { stats.lastError = err.message; log.error?.(`[read-pool] worker ${slot} error: ${err.message}`); });
    w.on("exit", (code) => {
      entry.ready = false;
      // Every read this worker held is answered by the main connection — nobody sees the crash.
      for (const [id, p] of pending) {
        if (p.entry !== entry) continue;
        pending.delete(id); clearTimeout(p.timer);
        try { p.resolve(fallback(p.op, p.sql, p.params)); } catch (e) { p.reject(e); }
      }
      if (closed) return;
      stats.restarts++;
      if (stats.restarts <= 20) setTimeout(() => spawn(slot), 1000).unref?.();
      else log.error?.(`[read-pool] worker ${slot} exited (${code}); restart budget spent — main connection from now on`);
    });
    w.unref();
  };

  if (enabled) for (let i = 0; i < size; i++) spawn(i);

  const pick = () => {
    const live = workers.filter(e => e?.ready);
    if (!live.length) return null;
    // the least busy, round-robin among equals
    rr = (rr + 1) % live.length;
    return live.reduce((best, e, i) => (e.inflight < best.inflight ? e : best), live[rr]);
  };

  const run = (op, sql, params = []) => {
    const entry = enabled && !closed ? pick() : null;
    if (!entry) return Promise.resolve().then(() => fallback(op, sql, params));
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        // Too slow in the pool — answer on the main connection rather than leave the person waiting forever.
        if (!pending.has(id)) return;
        pending.delete(id); entry.inflight--;
        stats.lastError = `timeout after ${timeoutMs} ms`;
        try { resolve(fallback(op, sql, params)); } catch (e) { reject(e); }
      }, timeoutMs);
      timer.unref?.();
      pending.set(id, { resolve, reject, timer, entry, op, sql, params, at: Date.now() });
      entry.inflight++;
      try { entry.w.postMessage({ id, op, sql, params }); }
      catch (err) {
        // params that cannot be cloned, a worker gone between pick and post: the main connection answers.
        pending.delete(id); clearTimeout(timer); entry.inflight--;
        try { resolve(fallback(op, sql, params)); } catch (e) { reject(e); }
      }
    });
  };

  return {
    get: (sql, params) => run("get", sql, params),
    all: (sql, params) => run("all", sql, params),
    status: () => ({ enabled, size, ready: workers.filter(e => e?.ready).length, inflight: pending.size, ...stats }),
    close: async () => { closed = true; await Promise.all(workers.filter(Boolean).map(e => e.w.terminate().catch(() => {}))); },
  };
}

// services/db/offloadWorker.js — ⛔ A158 (45r, 11-09) · WHOLE-BOARD WORK THAT IS NOT A PERSON'S REQUEST RUNS OFF THE LOOP.
//
// Production froze for good ≈ 30 s after `ready` on the 45q deploy (07:27:45Z, the board-fit delay's end) and answered
// nothing after. Two kinds of synchronous whole-board work were on the one Node thread at that moment:
//   · the taxonomy re-read (A141 bumped roles-v1.json 1 → 2, so EVERY active posting was read again — its description
//     and `board_category`, which sit after `description` in the row, so each read walks the row's overflow chain on a
//     cold volume) and classified there, page after page;
//   · crawler-facing pages whose cost grows with the board — the sitemaps (/sitemap-companies.xml, /sitemap-jobs*.xml,
//     /sitemap-landing.xml) and the landing pages (/jobs/role|tech|sponsor-h1b/…) — each a full scan of the open board
//     read the same way. A crawler's request ran to the end even after the crawler hung up, and they queued.
//
// This is ONE worker thread (apart from the read pool, so a person's board reads never wait behind it) with its own
// read-only connection. It runs a fixed list of tasks — never arbitrary code — and returns plain values.
// ⛔ Unlike the read pool it NEVER falls back to the main connection: a task it cannot answer rejects (the sitemaps and
// landing pages answer 503 + Retry-After; the taxonomy walk drops to its small-slice main-thread mode, paced).
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);

if (!isMainThread && workerData?.__draftOffload) {
  const { default: Database } = await import("better-sqlite3");
  const conn = new Database(workerData.dbPath, { readonly: true, fileMustExist: true });
  conn.pragma("busy_timeout = 5000");
  const [{ registerBoardSearch }, { registerScoreFreshness }, { registerDescriptionBasis }, pub, landing, tax] = await Promise.all([
    import("../jobs/boardSearch.js"), import("../jobs/boardFitPrecompute.js"), import("../jobs/descriptionText.js"),
    import("../jobs/publicJobPage.js"), import("../jobs/landingPages.js"), import("../jobs/taxonomyBackfill.js"),
  ]);
  const { publicOpenRange } = await import("../jobs/publicOpenJobs.js");
  const { readAggregate } = await import("../companies/companyTech.js");   // ⛔ A159
  const { readAtlasPass } = await import("../atlas/atlasStats.js");   // ⛔ A123 (5) (46c)
  registerBoardSearch(conn); registerScoreFreshness(conn); registerDescriptionBasis(conn);
  const TASKS = {
    sitemapCompanies: () => pub.companiesSitemapRoutes(conn),
    sitemapJobsPage: ({ page }) => pub.jobsSitemapRoutes(conn, { page }),
    sitemapJobsCount: () => pub.jobsSitemapPageCount(conn),
    sitemapLanding: () => landing.landingSitemapRoutes(conn),
    landingPage: ({ kind, key, base }) => landing.renderLandingPage(conn, kind, key, { base }),
    taxonomyRange: ({ from, rows }) => tax.classifyRange(conn, from, rows),
    publicOpenRange: ({ from, rows }) => publicOpenRange(conn, from, rows),
    companyTechAgg: ({ from, to, nowSec }) => readAggregate(conn, from, to, nowSec),
    atlasPass: () => readAtlasPass(conn),   // ⛔ A123 (5): the Atlas baseline / nightly recount's read (≈ 50 s at 100k)
  };
  parentPort.on("message", ({ id, task, args }) => {
    try {
      const fn = TASKS[task];
      if (!fn) throw new Error(`no such offload task: ${task}`);
      parentPort.postMessage({ id, ok: true, value: fn(args || {}) });
    } catch (err) {
      parentPort.postMessage({ id, ok: false, message: err.message });
    }
  });
  parentPort.postMessage({ ready: true });
}

/**
 * @param {object} o
 * @param {string} o.dbPath
 * @param {number} [o.timeoutMs]  a task not answered by then rejects (default 120 s) — never runs on the main thread
 * @param {boolean} [o.enabled]   false → every task rejects at once (DRAFT_OFFLOAD=off; the callers' own fallbacks apply)
 */
export function createOffload({ dbPath, timeoutMs = 120_000, enabled = true, log = console } = {}) {
  let entry = null, nextId = 1, closed = false;
  const pending = new Map();
  const stats = { served: 0, failed: 0, timeouts: 0, restarts: 0, lastError: null, busyMs: 0 };

  const spawn = () => {
    if (closed || !enabled) return;
    let w;
    try { w = new Worker(HERE, { workerData: { __draftOffload: true, dbPath } }); }
    catch (err) { stats.lastError = `spawn: ${err.message}`; log.error?.(`[offload] could not start: ${err.message}`); entry = null; return; }
    const e = { w, ready: false };
    entry = e;
    w.on("message", (m) => {
      if (m?.ready) { e.ready = true; return; }
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer);
      stats.busyMs += Date.now() - p.at;
      if (m.ok) { stats.served++; p.resolve(m.value); } else { stats.failed++; p.reject(new Error(m.message)); }
    });
    w.on("error", (err) => { stats.lastError = err.message; log.error?.(`[offload] worker error: ${err.message}`); });
    w.on("exit", (code) => {
      e.ready = false;
      for (const [id, p] of pending) { pending.delete(id); clearTimeout(p.timer); p.reject(new Error(`offload worker exited (${code})`)); }
      if (closed) return;
      stats.restarts++;
      if (stats.restarts <= 20) setTimeout(spawn, 1000).unref?.();
      else log.error?.("[offload] restart budget spent — offloaded tasks reject from now on");
    });
    w.unref();
  };
  spawn();

  // A worker still starting (boot, or a restart after a timeout) is waited for, up to READY_WAIT_MS.
  const READY_WAIT_MS = 15_000;
  const whenReady = async () => {
    const until = Date.now() + READY_WAIT_MS;
    while (enabled && !closed && !entry?.ready && Date.now() < until) await new Promise(r => setTimeout(r, 100));
    return enabled && !closed && !!entry?.ready;
  };
  // 46c: a task may ask for its own bound (the Atlas pass: { timeoutMs: 600_000 }); the default stays timeoutMs.
  const run = async (task, args = {}, { timeoutMs: bound = timeoutMs } = {}) => {
    if (!(await whenReady())) throw new Error("offload worker not ready");
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id); stats.timeouts++; stats.lastError = `${task}: timeout after ${bound} ms`;
        reject(new Error(`offload ${task} timed out`));
        // The worker may still be inside a long read: restart it so the next task is not queued behind it.
        try { entry?.w.terminate(); } catch { /* exit handler respawns */ }
      }, bound);
      timer.unref?.();
      pending.set(id, { resolve, reject, timer, at: Date.now() });
      try { entry.w.postMessage({ id, task, args }); }
      catch (err) { pending.delete(id); clearTimeout(timer); reject(err); }
    });
  };

  return {
    run,
    get ready() { return !!entry?.ready; },
    status: () => ({ enabled, ready: !!entry?.ready, inflight: pending.size, ...stats }),
    close: async () => { closed = true; if (entry) await entry.w.terminate().catch(() => {}); },
  };
}

/**
 * A value computed off the loop, kept for `ttlMs`, computed ONCE however many requests ask at the same time
 * (single-flight). While a fresh value is being made, the last one keeps being served (stale-while-revalidate).
 */
export function offloadCache({ ttlMs }) {
  const store = new Map();   // key → { value, at, flight }
  return async function cached(key, make) {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.value !== undefined && now - hit.at < ttlMs) return hit.value;
    if (hit?.flight) return hit.value !== undefined ? hit.value : hit.flight;
    const flight = Promise.resolve().then(make).then((value) => {
      store.set(key, { value, at: Date.now(), flight: null });
      if (store.size > 2000) store.delete(store.keys().next().value);
      return value;
    }, (err) => {
      const cur = store.get(key);
      if (cur) cur.flight = null;
      if (cur && cur.value === undefined) store.delete(key);
      throw err;
    });
    store.set(key, { value: hit?.value, at: hit?.at || 0, flight });
    return hit?.value !== undefined ? hit.value : flight;
  };
}

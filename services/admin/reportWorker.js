// ⛔ A163 (46a, after A162) · THE ADMIN PANEL'S HEAVY REPORTS RUN OFF THE EVENT LOOP.
//
// A162 found Admin → Companies freezing the whole site (11-10 00:14–00:27Z, every request answered in one millisecond).
// Timing every Admin GET on the 100k copy with 3,000 companies (scripts/adminTiming46a.mjs) found three more that held
// the one Node thread while they ran: the glance (35.6 s — pipelineHealth() 12.7–24.8 s), the enrichment overview
// (> 300 s through the server; selectCandidates 14.9 s + columnCoverage 13.4 s alone) and the board policy's two dry
// runs (7.3 s). They are whole-board JavaScript + SQL, not one statement, so the A126 read pool (SQL only) cannot run
// them. This is ONE worker thread with its OWN read-only connection (WAL readers run beside the writer) that builds a
// named report with the SAME code the routes used, and hands back its JSON.
//   · Read-only by construction: a report that tried to write would fail with SQLITE_READONLY, not write.
//   · Each report is cached (TTL_MS); a request inside the TTL is answered from the cache, a stale one is answered from the
//     cache while ONE rebuild runs; nothing waits twice and two admins never build the same report at once.
//   · invalidate(): the next request waits for a fresh build — called on every admin write (server.js), so a page after
//     an admin's own action never shows the numbers from before it.
//   · ⭐ IT NEVER FAILS CLOSED (as A126): if the worker cannot start or dies, the report is built on the main
//     connection exactly as before — slow, never broken. A report's own error is thrown as it would have been.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);
export const TTL_MS = 60_000;
export const REPORTS = Object.freeze(["pipelineHealth", "enrichmentOverview", "boardPolicyDryRuns"]);

/** The reports, by name — the SAME functions the routes call. `conn` is a better-sqlite3 connection. */
export async function buildReport(name, conn, { dbPath = null } = {}) {
  if (name === "pipelineHealth") {
    const { createAdminDbRouter } = await import("../../routes/adminDb.js");
    return createAdminDbRouter(conn, { dbPath }).pipelineHealth();
  }
  if (name === "enrichmentOverview") {
    const { buildEnrichmentOverview } = await import("../../routes/enrichment.js");
    return buildEnrichmentOverview(conn);
  }
  if (name === "boardPolicyDryRuns") {
    const [{ sweepAged }, { sweepScope }] = await Promise.all([import("../jobs/boardAge.js"), import("../jobs/boardScope.js")]);
    return { dryRun: sweepAged(conn, { dryRun: true }), scopeDryRun: sweepScope(conn, { dryRun: true }) };
  }
  throw new Error(`no such admin report: ${name}`);
}

if (!isMainThread && workerData?.__draftAdminReportWorker) {
  const { default: Database } = await import("better-sqlite3");
  const conn = new Database(workerData.dbPath, { readonly: true, fileMustExist: true });
  conn.pragma("busy_timeout = 5000");
  const [{ registerBoardSearch }, { registerScoreFreshness }, { registerDescriptionBasis }] = await Promise.all([
    import("../jobs/boardSearch.js"), import("../jobs/boardFitPrecompute.js"), import("../jobs/descriptionText.js"),
  ]);
  registerBoardSearch(conn); registerScoreFreshness(conn); registerDescriptionBasis(conn);
  parentPort.on("message", async ({ id, name }) => {
    try { parentPort.postMessage({ id, ok: true, value: await buildReport(name, conn, { dbPath: workerData.dbPath }) }); }
    catch (err) { parentPort.postMessage({ id, ok: false, error: String(err?.message || err), code: err?.code || null }); }
  });
  parentPort.postMessage({ ready: true });
}

/**
 * @param {{ dbPath, fallbackDb, enabled?, ttlMs?, timeoutMs?, log?, now? }} o
 * @returns {{ get(name): Promise<object>, invalidate(name?): void, status(): object, close(): Promise<void> }}
 */
export function createAdminReports({ dbPath, fallbackDb, enabled = true, ttlMs = TTL_MS, timeoutMs = 300_000, log = console, now = () => Date.now() } = {}) {
  const cache = new Map();            // name → { at, value, stale }
  const building = new Map();         // name → Promise
  const counts = { builtOnWorker: 0, builtHere: 0, servedFromCache: 0 };
  let worker = null, broken = !enabled || !dbPath, seq = 0;
  const pending = new Map();

  const fail = (why) => {
    if (!broken) log.warn?.(`[admin-reports] worker unavailable (${why}) — reports build on the main connection`);
    broken = true; worker = null;
    for (const p of pending.values()) p.reject(Object.assign(new Error(`worker: ${why}`), { workerGone: true }));
    pending.clear();
  };
  const start = () => {
    if (worker || broken) return worker;
    try {
      worker = new Worker(HERE, { workerData: { __draftAdminReportWorker: true, dbPath } });
      worker.unref();
      worker.on("message", (m) => {
        if (m?.ready) return;
        const p = pending.get(m.id); if (!p) return;
        pending.delete(m.id); clearTimeout(p.timer);
        m.ok ? p.resolve(m.value) : p.reject(Object.assign(new Error(m.error), { code: m.code }));
      });
      worker.on("error", (e) => fail(e.message));
      worker.on("exit", (c) => { if (worker) fail(`exited ${c}`); });
    } catch (e) { fail(e.message); }
    return worker;
  };
  const viaWorker = (name) => new Promise((resolve, reject) => {
    const w = start();
    if (!w) return reject(Object.assign(new Error("no worker"), { workerGone: true }));
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(Object.assign(new Error(`${name} timed out`), { workerGone: true })); }, timeoutMs);
    timer.unref?.();
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, name });
  });
  const build = (name) => {
    if (building.has(name)) return building.get(name);
    const p = (async () => {
      let value;
      try { value = await viaWorker(name); counts.builtOnWorker++; }
      catch (e) {
        if (!e.workerGone) throw e;                                        // the report's own error, as before
        value = await buildReport(name, fallbackDb, { dbPath }); counts.builtHere++;
      }
      cache.set(name, { at: now(), value, stale: false });
      return value;
    })().finally(() => building.delete(name));
    building.set(name, p);
    return p;
  };

  return {
    async get(name) {
      if (!REPORTS.includes(name)) throw new Error(`no such admin report: ${name}`);
      const c = cache.get(name);
      if (c && !c.stale && now() - c.at < ttlMs) { counts.servedFromCache++; return c.value; }
      if (c && !c.stale) { build(name).catch(() => {}); counts.servedFromCache++; return c.value; }   // stale-while-revalidate
      return build(name);                                                                     // none, or invalidated
    },
    invalidate(name = null) { for (const [k, c] of cache) if (!name || k === name) c.stale = true; },
    status() { return { worker: !!worker && !broken, broken, ...counts, reports: [...cache.keys()] }; },
    async close() { const w = worker; worker = null; broken = true; if (w) await w.terminate(); },
  };
}

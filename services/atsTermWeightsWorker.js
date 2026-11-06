// ⭐ D170 (3) · THE ATS TERM WEIGHTS' COUNT RUNS IN A WORKER THREAD.
//
// The weights are document frequencies of the terms the scorer reads in each posting (postingTermKeys: skills_json,
// the company's stack, the registry vocabulary found in the description). Extracting them costs a few milliseconds a
// posting, so over production's ≈ 18k active postings it is a minute of CPU — on the one request thread that is a
// frozen site (D151 Rule 2, A126). This worker opens its OWN read-only connection to the same WAL database (as
// services/db/readWorker.js does), counts, and posts the counts back; the main thread then writes the table in one
// short transaction (services/atsTermWeights.js writeTermWeights — the thin-board guard runs there, unchanged).
//
// ⛔ It never fails closed: if the worker cannot start, errors or exits early, the caller counts on the main thread in
// yielding pages instead (computeTermWeightsAsync) — slower to finish, never a lost rebuild.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);

if (!isMainThread && workerData?.__draftTermWeightsWorker) {
  const [{ default: Database }, { countCorpusTerms }] = await Promise.all([
    import("better-sqlite3"), import("./atsTermWeights.js"),
  ]);
  try {
    const conn = new Database(workerData.dbPath, { readonly: true, fileMustExist: true });
    conn.pragma("busy_timeout = 5000");
    const acc = countCorpusTerms(conn);
    conn.close();
    parentPort.postMessage({
      ok: true, rows: acc.rows, withTerms: acc.withTerms,
      families: [...acc.families].map(([family, b]) => [family, b.postings, [...b.df]]),
    });
  } catch (err) {
    parentPort.postMessage({ ok: false, message: err.message });
  }
}

/**
 * Count the corpus's terms in a worker. Resolves `{ families: Map<family, { postings, df: Map }>, rows, withTerms }`
 * (the accumulator's shape) or rejects — the caller falls back.
 */
export function countCorpusTermsOffThread(dbPath, { timeoutMs = 15 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    let w;
    try {
      w = new Worker(HERE, { workerData: { __draftTermWeightsWorker: true, dbPath } });
    } catch (err) { reject(err); return; }
    let settled = false;
    const done = (fn, v) => { if (settled) return; settled = true; clearTimeout(timer); fn(v); w.terminate().catch(() => {}); };
    const timer = setTimeout(() => done(reject, new Error(`term-weight worker timed out after ${timeoutMs} ms`)), timeoutMs);
    timer.unref?.();
    w.on("message", (m) => {
      if (!m?.ok) { done(reject, new Error(m?.message || "term-weight worker failed")); return; }
      const families = new Map(m.families.map(([family, postings, df]) => [family, { postings, df: new Map(df) }]));
      done(resolve, { families, rows: m.rows, withTerms: m.withTerms });
    });
    w.on("error", (err) => done(reject, err));
    w.on("exit", (code) => done(reject, new Error(`term-weight worker exited (${code}) before answering`)));
  });
}

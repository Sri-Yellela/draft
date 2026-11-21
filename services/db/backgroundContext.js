// services/db/backgroundContext.js — ⭐ 47a (D151 Rule 5, measured at 250k × 20 users) · WORK NOBODY IS WAITING FOR, ON THE
// BACKGROUND READ POOL.
//
// The recounts that run BEHIND a stale board answer (services/jobs/facetsCache.js createRefreshGate) read through the same
// code as a person's request, so they ran on the two REQUEST workers: one of them was always busy with a 10–19 s whole-board
// recount and the Full House's p95 sat at 666 ms. Inside runInBackground() a read made through the request pool's handle
// (routedPool) goes to the background pool instead (A175's bgReadPool) — safe since a slow pool read never falls back onto
// the main thread (services/db/readWorker.js, 47a). Nothing at a call site changes; the context follows the async chain.
import { AsyncLocalStorage } from "node:async_hooks";

const als = new AsyncLocalStorage();

/** Run fn with every read through a routed pool sent to the background pool. */
export function runInBackground(fn) { return als.run(true, fn); }
export function inBackground() { return als.getStore() === true; }

/** A pool handle: reads go to `request`, or to `background` inside runInBackground. status / close are the request pool's. */
export function routedPool(request, background) {
  const pick = () => (inBackground() && background ? background : request);
  return {
    get: (sql, params) => pick().get(sql, params),
    all: (sql, params) => pick().all(sql, params),
    status: () => request.status(),
    close: () => request.close(),
  };
}

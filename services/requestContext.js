// services/requestContext.js — ⛔ D173 (5) · ONE REQUEST ID ACROSS SERVICES (docs/SERVICES.md).
//
// Every request gets an id: the caller's `x-request-id` when it is a plain token, else a fresh UUID. It is answered
// back in the `x-request-id` response header and carried by an AsyncLocalStorage, so anything below — the call to the
// tools service in particular (services/toolsService.js) — sends the same id on without one more parameter. An
// application run's job runs inside "run<runId>-job<jobId>" (routes/apply.js), so one application can be followed
// from draft's log to the tools service's (which logs it as `rid`).
//
// Separate from services/startedByContext.js on purpose: that one says WHO started the work (and is read for money);
// this one only says WHICH work a log line belongs to.
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";
const als = new AsyncLocalStorage();

/** A caller-supplied id when it is a plain token (letters, digits, - _ . :), 6–80 chars; else null. */
export function cleanRequestId(raw) {
  const v = typeof raw === "string" ? raw.trim() : "";
  return /^[\w.:-]{6,80}$/.test(v) ? v : null;
}

/** The id of the work running now, or null outside any (boot, a bare timer). */
export function currentRequestId() {
  return als.getStore()?.id ?? null;
}

/** Run fn with `id` as the current request id (an application run's job, a scheduler tick). */
export function withRequestId(id, fn) {
  return als.run({ id: cleanRequestId(id) || randomUUID() }, fn);
}

/** Express middleware — mount FIRST, before any router, so every handler and everything it awaits sees the id. */
export function requestIdMiddleware(req, res, next) {
  const id = cleanRequestId(typeof req.get === "function" ? req.get(REQUEST_ID_HEADER) : req.headers?.[REQUEST_ID_HEADER]) || randomUUID();
  req.requestId = id;
  try { res.setHeader(REQUEST_ID_HEADER, id); } catch { /* headers already sent — nothing to add */ }
  als.run({ id }, next);
}

/** The id for one application run's job — the string to filter both services' logs by. */
export function runJobRequestId(runId, jobId) {
  return `run${runId}-job${jobId}`;
}

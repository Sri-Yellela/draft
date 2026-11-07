// services/startedByContext.js — ⛔ D171 FIX 1 · WHO STARTED THIS, carried with the work instead of threaded through
// every call. One AsyncLocalStorage: a request runs inside its own context (startedByMiddleware, mounted first in
// server.js), a scheduler tick inside "scheduler" (withStartedBy), an application run's jobs inside the run's own
// started_by (routes/apply.js processRun) — so a model call made anywhere below reads who started it
// (services/usageTracker.js → usage_events.started_by) without one more parameter on twenty call sites.
//
// Outside any context — boot recovery, a sweep, enrichment — it is "system": draft itself, never a person.
// The kinds and the words are in shared/startedBy.js.
import { AsyncLocalStorage } from "node:async_hooks";
import { STARTED_BY, SELF_LABELS, STARTED_BY_HEADER, startedByKind } from "../shared/startedBy.js";

const als = new AsyncLocalStorage();

/** { kind, ref } — ref names the actor: "user:3", "admin:adm_…", "agent:a59LineShots", "scheduler", "system". */
export function startedByValue(kind, ref = null) {
  const k = startedByKind(kind) || STARTED_BY.SYSTEM;
  return Object.freeze({ kind: k, ref: ref ? String(ref).slice(0, 120) : k });
}
export const SYSTEM_STARTED = startedByValue(STARTED_BY.SYSTEM);
export const SCHEDULER_STARTED = startedByValue(STARTED_BY.SCHEDULER);

/** A self-label from the header, or null. Only agent / test (shared/startedBy.js SELF_LABELS). */
function selfLabel(req) {
  const raw = typeof req?.get === "function" ? req.get(STARTED_BY_HEADER) : req?.headers?.[STARTED_BY_HEADER];
  if (!raw) return null;
  const [k, ...name] = String(raw).trim().split(":");
  const kind = startedByKind(k);
  if (!SELF_LABELS.includes(kind)) return null;
  const who = req?.user?.id != null ? `user:${req.user.id}` : null;
  const script = name.join(":").replace(/[^\w.\-]/g, "").slice(0, 60);
  return startedByValue(kind, [kind, script || null, who ? `as ${who}` : null].filter(Boolean).join(":"));
}

/**
 * Who a request is: the admin console's session (req.actor, D95) → admin; a header self-label → agent / test; a
 * signed-in person → user; nobody → system. Read LAZILY (at the model call / the run's insert), because the session and
 * the admin binder run after the middleware that opened the context.
 */
export function startedByOfRequest(req) {
  if (req?.actor?.kind === "admin") return startedByValue(STARTED_BY.ADMIN, req.actor.ref);
  const self = selfLabel(req);
  if (self) return self;
  if (req?.user?.id != null) return startedByValue(STARTED_BY.USER, `user:${req.user.id}`);
  return SYSTEM_STARTED;
}

/** Runs fn (sync or async) with `value` as who started everything inside it. */
export function withStartedBy(value, fn) {
  const v = value?.kind ? value : startedByValue(value);
  return als.run({ value: v }, fn);
}

/** Express middleware: each request is its own context. Mounted before every router (server.js). */
export function startedByMiddleware(req, _res, next) {
  als.run({ req }, next);
}

/** Who started the work this code is running for. Never throws; "system" outside any context. */
export function currentStartedBy() {
  const s = als.getStore();
  if (!s) return SYSTEM_STARTED;
  if (s.value) return s.value;
  try { return startedByOfRequest(s.req); } catch { return SYSTEM_STARTED; }
}

/**
 * ⛔ D171 FIX 1's rule: "never run on a real account unasked". In production a run an agent or a test started is
 * refused unless the account is marked users.test_account = 1 (migration 224). null = allowed; else the refusal.
 * Outside production (a local copy, a throwaway server) it is allowed — that is where agents and tests belong.
 */
export function agentRunRefusal(db, userId, startedBy, { production = false } = {}) {
  const kind = startedBy?.kind ?? startedByKind(startedBy);
  if (!production || (kind !== STARTED_BY.AGENT && kind !== STARTED_BY.TEST)) return null;
  let testAccount = 0;
  try { testAccount = Number(db.prepare("SELECT test_account FROM users WHERE id = ?").pluck().get(userId)) || 0; }
  catch { testAccount = 0; }   // a database without 224 has no test accounts — refused, the safe side
  if (testAccount === 1) return null;
  return { error: "agent_run_refused",
    message: `A run started by ${kind === STARTED_BY.TEST ? "a test" : "the agent"} is refused on a real account in production. ` +
      "Mark a test account (users.test_account = 1) for checks, or let the person start it." };
}

/** The run row's own record, as a value — for the jobs a run processes long after the request that queued it. */
export function startedByOfRun(run) {
  const kind = startedByKind(run?.started_by);
  return kind ? startedByValue(kind, run?.started_by_ref || kind) : SYSTEM_STARTED;
}

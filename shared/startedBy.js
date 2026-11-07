// shared/startedBy.js — ⛔ D171 FIX 1 (owner 11-06: "the prophetic job run took place, which i suppose the agent
// triggered"): WHO OR WHAT STARTED IT. Every application run (apply_runs.started_by, migration 224) and every model
// call (usage_events.started_by) records one of these kinds, and the tracker says it in words on the attempt:
// "Started by you at 1:35 AM" · "Started by the daily run at 6:00 AM".
//
// Pure — read by the server (services/startedByContext.js decides the kind) and by the client (the words).
//
//   user        the person, from their own session (a Draft, an approval, a tap on a pick, a generation)
//   scheduler   the daily run — FULL AUTO / Ask me first's run times (services/autoScheduler.js)
//   admin       an admin, from the admin console's own session (D95)
//   agent       the coding agent or a harness script run on purpose (it says so: the x-draft-started-by header)
//   test        a test or a walk against a throwaway server (the same header)
//   system      draft itself, in the background — boot recovery, a sweep, enrichment — with no person in scope
//
// ⛔ A request may DOWNGRADE its own label to agent / test (so a script's run is never mistaken for the person's), and
// never claim scheduler / admin / system: those come only from the server's own context.

export const STARTED_BY = Object.freeze({
  USER: "user", SCHEDULER: "scheduler", ADMIN: "admin", AGENT: "agent", TEST: "test", SYSTEM: "system",
});
export const STARTED_BY_KINDS = Object.freeze(Object.values(STARTED_BY));
/** The only kinds a request's header may name for itself. */
export const SELF_LABELS = Object.freeze([STARTED_BY.AGENT, STARTED_BY.TEST]);
/** The header a script sends: `x-draft-started-by: agent` (or `agent:a59LineShots`, the part after the colon = its name). */
export const STARTED_BY_HEADER = "x-draft-started-by";

/** A kind, or null for anything unknown (an older row reads "not recorded", never a guess). */
export function startedByKind(v) {
  const k = String(v ?? "").trim().toLowerCase().split(":")[0];
  return STARTED_BY_KINDS.includes(k) ? k : null;
}

const WHO = Object.freeze({
  scheduler: "the daily run",
  admin: "an admin",
  agent: "the agent",
  test: "a test",
  system: "draft, in the background",
});

/** "1:35 AM" in the reader's own clock. */
function clock(ms) {
  try { return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return null; }
}

/**
 * The attempt's line: "Started by you at 1:35 AM" · "Started by the daily run at 6:00 AM" · "Started at 1:35 AM" when
 * the run predates migration 224 (who is not recorded — never guessed). `at` is epoch ms; `mine` is false only when a
 * user-started run was started by someone else's session (an admin acting as the person reads as the admin).
 */
export function startedByPhrase({ startedBy = null, at = null, mine = true } = {}) {
  const kind = startedByKind(startedBy);
  const t = at ? clock(at) : null;
  const when = t ? ` at ${t}` : "";
  if (!kind) return t ? `Started at ${t}` : null;
  if (kind === STARTED_BY.USER) return `Started by ${mine ? "you" : "the account's owner"}${when}`;
  return `Started by ${WHO[kind]}${when}`;
}

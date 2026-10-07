// shared/deployEvents.js — ⛔ D76 · A RAILWAY WEBHOOK EVENT, READ AS HOSTILE INPUT.
//
// The hook is a PUBLIC endpoint and Railway's payloads are NOT signed (docs.railway.com/observability/
// webhooks — "Verifying the sender": a custom header carries the secret). So this file decides what, of a
// body that may be anything, is kept: an event type from a KNOWN family, and the ids that say which
// deployment it was — nothing else. No commit message, no author (a person), nothing echoed back, and no
// field ever drives behaviour: the endpoint records, it never acts.
//
// Known families (the docs, 10-09):
//   Deployment.<state>  — every deployment status change; the states are Railway's DeploymentStatus enum
//   volume / monitor alerts — documented as events but their type strings are NOT published; they are
//   accepted by family prefix (Volume…, Monitor…, Alert…), and every OTHER type is dropped with its name
//   logged, so the owner's "Test Webhook" shows what Railway actually sends.
// Shared (server + the admin card) so "is this event an alarm?" has one answer.

// Railway's DeploymentStatus enum PLUS the webhook event names its own webhook form offers (read from the
// Railway tool's create-webhook enum, 10-07: deployed, redeployed, oom_killed, restarted, resumed, slept are
// event types, not statuses — the first parser dropped them).
export const DEPLOYMENT_STATES = Object.freeze(["building", "crashed", "deploying", "failed", "initializing", "needs_approval",
  "queued", "removed", "removing", "skipped", "sleeping", "success", "waiting",
  "deployed", "redeployed", "oom_killed", "restarted", "resumed", "slept"]);
export const ALARM_STATES = Object.freeze(["failed", "crashed", "oom_killed"]);
export const MAX_BODY_BYTES = 16 * 1024;

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COMMIT = /^[0-9a-f]{7,40}$/i;
const NAME = /^[\w .:@/+-]{1,80}$/;
const TYPE = /^[A-Za-z]{1,32}\.[A-Za-z_]{1,32}$/;
const pick = (v, re) => (typeof v === "string" && re.test(v) ? v : null);

/**
 * @returns {{ ok: true, row: object } | { ok: false, reason: string, type?: string }}
 */
export function parseRailwayEvent(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, reason: "not_an_object" };
  const type = typeof body.type === "string" ? body.type : "";
  if (!TYPE.test(type)) return { ok: false, reason: "unreadable_type" };
  const [prefix, rawState] = type.split(".");
  let family = null, state = rawState.toLowerCase();
  if (prefix === "Deployment") { if (DEPLOYMENT_STATES.includes(state)) family = "deployment"; }
  else if (/^(Volume|Monitor|Alert)/.test(prefix)) family = prefix.startsWith("Volume") ? "volume" : "monitor";
  if (!family) return { ok: false, reason: "unknown_type", type };
  const r = body.resource && typeof body.resource === "object" ? body.resource : {};
  const d = body.details && typeof body.details === "object" ? body.details : {};
  const ts = typeof body.timestamp === "string" && !Number.isNaN(Date.parse(body.timestamp)) ? new Date(body.timestamp).toISOString() : null;
  return { ok: true, row: {
    event_type: type, family, state,
    severity: pick(body.severity, /^[A-Z]{1,16}$/),
    project_name: pick(r.project?.name, NAME), environment_name: pick(r.environment?.name, NAME),
    service_name: pick(r.service?.name, NAME), service_id: pick(r.service?.id, ID),
    deployment_id: pick(r.deployment?.id, ID) || pick(d.id, ID), commit_hash: pick(d.commitHash, COMMIT),
    occurred_at: ts,
  } };
}

/** Is this stored event an alarm — the card's red? */
export function isAlarm(row) {
  return !!row && ((row.family === "deployment" && ALARM_STATES.includes(row.state)) || row.family === "volume" || row.family === "monitor");
}

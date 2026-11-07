// services/modelGateway.js — ⛔⛔ D162 G2 + G4 · THE MODEL GATEWAY: a feature asks for a TASK; configuration picks the
// model; every call is recorded per task × model and its output tagged with its source.
//
//   callTask({ task, anthropic, db, userId, messages, ... })   the ONE way a draft feature calls a model
//
// ── G2 · ROUTING BY CONFIG, three layers, the later wins ─────────────────────────────────────────────────────────────
//   1. the registry default        shared/modelTasks.js — today's model; what runs when nothing is configured
//   2. the environment's config    MODEL_ROUTES (JSON, one per deploy environment): { "<task>": { provider, model,
//                                  params, fallback, budget, candidate } } — a per-environment baseline, set with a deploy
//   3. the admin's runtime switch  app_settings row `model_route:<task>` (the table every runtime switch here lives in —
//                                  the full-auto kill switch, the tailoring mode) — read at CALL time, never cached, so a
//                                  switch or a rollback takes effect on the next call with NO deploy. Every write goes
//                                  through applyRouteChange and leaves an admin_audit_log row: who · when · why · before ·
//                                  after — which is also what makes a rollback one step (rollbackRoute).
//
// ── COHORT ROLLOUT: shadow → a % → default ──────────────────────────────────────────────────────────────────────────
//   A new model enters as the task's CANDIDATE, and can only move one stage at a time:
//     shadow   it runs beside the serving model on real calls; its output is DISCARDED and its usage recorded
//              (route "shadow", event_type "model_shadow", so it never counts against a person's allowance)
//     cohort   it serves `percent` of users — a stable bucket per user × task, so a person does not flip between models
//     default  it serves everyone; `promote` then folds it into the task's route and clears the candidate
//   ⛔ cohort and default need a PASSING evaluation (services/modelEvals.js canTakeTask) — G3: a model takes a task only
//   when it passes. Shadow needs none: it serves nobody.
//
// ── PROVIDERS ───────────────────────────────────────────────────────────────────────────────────────────────────────
//   Only a provider marked callableInDraft (Anthropic) can serve a draft task — A87 / D17 hold draft to one transport.
//   A route naming another provider is REFUSED at write time and at call time, never silently swapped (D123 P3's rule:
//   a broken configuration errors, it does not fall back quietly).
//
// ── G4 · TELEMETRY AND SOURCE ───────────────────────────────────────────────────────────────────────────────────────
//   Each call is one usage_events row (callModel → trackApiCall) carrying task, provider, model, tokens, cost,
//   duration, success and route (migration 221). Every returned message carries `source` (provider · model · task ·
//   route · claude) — non-enumerable, so the message's own shape is unchanged — and services/trainingData.js refuses
//   any row whose source is a Claude call (D160 rule 1).
import crypto from "node:crypto";
import { callModel, isPermanentModelFailure, SYSTEM_USER_ID } from "./modelCall.js";
import { TASKS, PROVIDERS, taskOf, taskForPurpose, routableModel, isClaudeProvider } from "../shared/modelTasks.js";
import { getSetting, setSetting, clearSetting } from "./appSettings.js";
import { auditActorColumns, actorRef, toActor } from "./actor.js";
import { canTakeTask } from "./modelEvals.js";
import { blockedForModel } from "./atlas/sourceRegistry.js";

export const ROUTE_KEY_PREFIX = "model_route:";
export const ROUTES_ENV = "MODEL_ROUTES";
export const STAGES = Object.freeze(["shadow", "cohort", "default"]);
export const ROUTE_LABELS = Object.freeze(["default", "cohort", "shadow", "fallback", "tools-service"]);
export const SHADOW_EVENT_TYPE = "model_shadow";
/** The parameters a route may set — anything else is refused, so a typo cannot ride along to the provider. */
export const ROUTE_PARAMS = Object.freeze({
  max_tokens: (v) => Number.isInteger(v) && v >= 1 && v <= 32_000,
  temperature: (v) => typeof v === "number" && v >= 0 && v <= 1,
  top_p: (v) => typeof v === "number" && v > 0 && v <= 1,
});

export class ModelRouteError extends Error {
  constructor(message, { code = "model_route_invalid", status = 400 } = {}) { super(message); this.code = code; this.status = status; }
}

const routeKey = (task) => ROUTE_KEY_PREFIX + task;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The environment's layer for one task, or {}. An unreadable MODEL_ROUTES is an error, loudly. */
export function envRouteFor(task, env = process.env) {
  const raw = env?.[ROUTES_ENV];
  if (!raw || !String(raw).trim()) return {};
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { throw new ModelRouteError(`${ROUTES_ENV} is not JSON: ${e.message}`, { code: "model_routes_env_unreadable", status: 500 }); }
  if (!isObj(parsed)) throw new ModelRouteError(`${ROUTES_ENV} must be an object of task → route`, { code: "model_routes_env_unreadable", status: 500 });
  for (const k of Object.keys(parsed)) if (!TASKS[k]) throw new ModelRouteError(`${ROUTES_ENV} names an unknown task "${k}"`, { code: "model_routes_env_unreadable", status: 500 });
  return isObj(parsed[task]) ? parsed[task] : {};
}

/** The admin's layer for one task (the app_settings row), or null when none is set. */
export function overrideFor(db, task) {
  const raw = db ? getSetting(db, routeKey(task)) : null;
  if (raw === null || raw === undefined) return null;
  try { const o = JSON.parse(raw); if (isObj(o)) return o; } catch { /* below */ }
  throw new ModelRouteError(`the runtime route for ${task} (app_settings ${routeKey(task)}) is unreadable`, { code: "model_route_override_unreadable", status: 500 });
}

/** Lays the layers over the registry default. Pure. `params` merge field by field; the rest replace. */
export function mergeRoute(base, ...layers) {
  let out = { provider: base.provider, model: base.model, params: { ...(base.params || {}) },
              fallback: base.fallback || null, budget: base.budget || null, candidate: null };
  for (const l of layers) {
    if (!isObj(l)) continue;
    if (l.provider !== undefined) out.provider = l.provider;
    if (l.model !== undefined) out.model = l.model;
    if (isObj(l.params)) out.params = { ...out.params, ...l.params };
    if (l.fallback !== undefined) out.fallback = l.fallback;
    if (l.budget !== undefined) out.budget = l.budget;
    if (l.candidate !== undefined) out.candidate = l.candidate;
  }
  return out;
}

function checkParams(params, where) {
  if (params === undefined || params === null) return;
  if (!isObj(params)) throw new ModelRouteError(`${where}: params must be an object`);
  for (const [k, v] of Object.entries(params)) {
    if (!ROUTE_PARAMS[k]) throw new ModelRouteError(`${where}: parameter "${k}" is not one a route may set (${Object.keys(ROUTE_PARAMS).join(", ")})`);
    if (!ROUTE_PARAMS[k](v)) throw new ModelRouteError(`${where}: parameter ${k}=${JSON.stringify(v)} is out of range`);
  }
}

function checkServable(db, task, r, where, { needsEval = true } = {}) {
  if (!isObj(r)) throw new ModelRouteError(`${where}: not a route`);
  const p = PROVIDERS[r.provider];
  if (!p) throw new ModelRouteError(`${where}: unknown provider "${r.provider}"`);
  if (!p.callableInDraft) throw new ModelRouteError(`${where}: provider "${r.provider}" cannot serve a draft task — ${p.why}`, { code: "model_route_provider_not_callable" });
  if (!routableModel(r.provider, r.model)) throw new ModelRouteError(`${where}: "${r.model}" is not a routable ${r.provider} model (unknown, unpriced or retired)`, { code: "model_route_model_unknown" });
  checkParams(r.params, where);
  if (needsEval && !canTakeTask(db, task, r.provider, r.model)) {
    throw new ModelRouteError(`${where}: ${r.provider}/${r.model} has no passing evaluation for ${task} — record one first (G3)`, { code: "model_route_needs_eval", status: 409 });
  }
}

/** Throws ModelRouteError when an effective route cannot be served. Exported for the admin view's "valid" flag. */
export function validateRoute(db, task, eff) {
  checkServable(db, task, eff, `${task} route`);
  if (eff.fallback) checkServable(db, task, eff.fallback, `${task} fallback`);
  const c = eff.candidate;
  if (c) {
    if (!STAGES.includes(c.stage)) throw new ModelRouteError(`${task} candidate: stage must be one of ${STAGES.join(", ")}`);
    checkServable(db, task, c, `${task} candidate`, { needsEval: c.stage !== "shadow" });
    if (c.stage === "cohort" && !(Number.isInteger(c.percent) && c.percent >= 1 && c.percent <= 99)) {
      throw new ModelRouteError(`${task} candidate: a cohort's percent must be a whole number 1–99`);
    }
  }
  return eff;
}

/** The effective configuration of a task and where it came from. Throws for a tools-service task (not routed here). */
export function effectiveRoute(db, task, { env = process.env } = {}) {
  const t = taskOf(task);
  if (t.runsIn !== "draft") throw new ModelRouteError(`${task} runs in the ${t.runsIn}; its model is chosen there, not by draft's gateway`, { code: "model_task_not_routed_here" });
  const envLayer = envRouteFor(task, env);
  const override = overrideFor(db, task);
  const eff = mergeRoute(t.defaultRoute, envLayer, override);
  return { ...eff, layer: override ? "override" : Object.keys(envLayer).length ? "env" : "default", override, env: envLayer };
}

/** A stable 0–99 bucket for one user on one task. */
export function cohortBucket(task, userId) {
  const h = crypto.createHash("sha256").update(`${task}:${userId ?? SYSTEM_USER_ID}`).digest();
  return h.readUInt32BE(0) % 100;
}

/**
 * Which model serves THIS call: { serve, label, shadow, fallback, route }. Validated every time — a configuration that
 * became unservable (an eval set's version bumped, a model retired) errors rather than serving a model nobody vouches for.
 */
export function resolveRoute(db, task, { userId = SYSTEM_USER_ID, env = process.env } = {}) {
  const eff = validateRoute(db, task, effectiveRoute(db, task, { env }));
  const primary = { provider: eff.provider, model: eff.model, params: eff.params || {} };
  const c = eff.candidate;
  const cand = c ? { provider: c.provider, model: c.model, params: { ...primary.params, ...(c.params || {}) } } : null;
  let serve = primary, label = "default", shadow = null;
  if (c?.stage === "default") { serve = cand; label = "cohort"; }
  else if (c?.stage === "cohort" && cohortBucket(task, userId) < c.percent) { serve = cand; label = "cohort"; }
  else if (c?.stage === "shadow") shadow = cand;
  const fallback = eff.fallback ? { provider: eff.fallback.provider, model: eff.fallback.model, params: { ...primary.params, ...(eff.fallback.params || {}) } } : null;
  return { serve, label, shadow, fallback, route: eff };
}

// ── G4 · the source tag ─────────────────────────────────────────────────────────────────────────────────────────────
export function sourceTag({ provider, model, task, route }) {
  return Object.freeze({ provider, model, task, route, claude: isClaudeProvider(provider) });
}
function tag(message, source) {
  if (message && typeof message === "object") {
    try { Object.defineProperty(message, "source", { value: source, enumerable: false, configurable: true }); } catch { /* frozen: the usage row still has it */ }
  }
  return message;
}
/** The source a gateway output carries, or null (an output that did not come through callTask). */
export const sourceOf = (message) => message?.source ?? null;

// Shadow calls run after the serving call returns and are not awaited by the feature; tests settle them.
const pendingShadows = new Set();
export async function settleShadows() { await Promise.allSettled([...pendingShadows]); }

/**
 * ⛔ THE ONE WAY A DRAFT FEATURE CALLS A MODEL. Names a task, never a model: `model` in the arguments is refused.
 * `purpose` may pick one of the task's ledger purposes (default: its first). Everything else (messages, system,
 * dataClass, jobId, company, onTracked …) passes through to callModel. Returns the provider's message, tagged with source.
 */
export async function callTask({ task, anthropic, db, userId = SYSTEM_USER_ID, purpose = null, env = process.env, sources = null, ...rest } = {}) {
  // ⛔ D176-5: a call carrying text from the learning-centre register names its source ids; a source whose AI terms
  // forbid it (or one the register does not know) is refused before anything is sent — logged, never silently dropped.
  if (Array.isArray(sources) && sources.length) {
    const blocked = blockedForModel(sources);
    if (blocked.length) {
      console.warn(`[d176] model call ${task} REFUSED — restricted source text: ${blocked.map(b => `${b.id} (${b.why})`).join("; ")}`);
      throw Object.assign(new Error(`This text comes from a source whose terms do not allow sending it to a model: ${blocked.map(b => b.id).join(", ")}`),
        { status: 422, code: "restricted_source", blocked });
    }
  }
  const t = taskOf(task);
  if (t.runsIn !== "draft") throw new Error(`callTask(${task}): this task runs in the ${t.runsIn} — ask it there`);
  if ("model" in rest) throw new Error(`callTask(${task}): a feature does not name a model (D162 G1) — configure the task's route instead`);
  const ledger = purpose ?? t.purposes[0];
  if (!t.purposes.includes(ledger)) throw new Error(`callTask(${task}): purpose "${ledger}" is not one of the task's (${t.purposes.join(", ")})`);

  const r = resolveRoute(db, task, { userId, env });
  const send = (target, label, extra = {}) => callModel({
    anthropic, db, userId, purpose: ledger, ...rest, ...extra, ...target.params, model: target.model, task, route: label,
  });

  let message, served = r.serve, label = r.label;
  try {
    message = await send(r.serve, r.label);
  } catch (e) {
    // A fallback is for a model that is down or overloaded — not for an unfunded account or a bad key, which the
    // fallback (the same provider) would fail identically, at a second charge of the caller's patience.
    if (!r.fallback || isPermanentModelFailure(e)) throw e;
    served = r.fallback; label = "fallback";
    message = await send(r.fallback, "fallback");
  }

  if (r.shadow) {
    const p = send(r.shadow, "shadow", { eventType: SHADOW_EVENT_TYPE, onTracked: null })
      .catch(err => console.warn(`[gateway] shadow ${task} ${r.shadow.provider}/${r.shadow.model} failed: ${err?.message || err}`))
      .finally(() => pendingShadows.delete(p));
    pendingShadows.add(p);
  }
  return tag(message, sourceTag({ provider: served.provider, model: served.model, task, route: label }));
}

// ── G2 · THE SWITCH: writes, each with who / when / why ──────────────────────────────────────────────────────────────
export const ROUTE_OPS = Object.freeze(["shadow", "cohort", "default", "promote", "drop_candidate", "fallback", "params", "budget", "clear"]);

function nextOverride(db, task, cur, op, args, env) {
  const eff = effectiveRoute(db, task, { env });
  const o = { ...(cur || {}) };
  const c = eff.candidate;
  switch (op) {
    case "shadow": {
      if (c && c.stage !== "shadow") throw new ModelRouteError(`${task} already has a candidate at ${c.stage} — drop it or roll back first`, { status: 409, code: "model_route_stage_order" });
      o.candidate = { provider: args.provider, model: args.model, params: args.params || {}, stage: "shadow", percent: 0 };
      break;
    }
    case "cohort": {
      if (!c || (c.stage !== "shadow" && c.stage !== "cohort")) throw new ModelRouteError(`${task}: a cohort starts from a shadow candidate (shadow → a % → default)`, { status: 409, code: "model_route_stage_order" });
      o.candidate = { ...c, stage: "cohort", percent: args.percent };
      break;
    }
    case "default": {
      if (!c || c.stage !== "cohort") throw new ModelRouteError(`${task}: a candidate serves everyone only after a cohort (shadow → a % → default)`, { status: 409, code: "model_route_stage_order" });
      o.candidate = { ...c, stage: "default", percent: 100 };
      break;
    }
    case "promote": {
      if (!c || c.stage !== "default") throw new ModelRouteError(`${task}: only a candidate already serving everyone can be promoted`, { status: 409, code: "model_route_stage_order" });
      o.provider = c.provider; o.model = c.model; o.params = { ...eff.params, ...(c.params || {}) }; o.candidate = null;
      break;
    }
    case "drop_candidate": o.candidate = null; break;
    case "fallback": o.fallback = args.fallback ? { provider: args.fallback.provider, model: args.fallback.model, params: args.fallback.params || {} } : null; break;
    case "params": checkParams(args.params, `${task} params`); o.params = { ...(o.params || {}), ...args.params }; break;
    case "budget": {
      const b = args.budget;
      if (!isObj(b) || !["costPerCallUsd", "p50Ms", "p95Ms"].every(k => typeof b[k] === "number" && b[k] > 0)) {
        throw new ModelRouteError(`${task}: budget needs costPerCallUsd, p50Ms and p95Ms (positive numbers)`);
      }
      o.budget = { costPerCallUsd: b.costPerCallUsd, p50Ms: b.p50Ms, p95Ms: b.p95Ms };
      break;
    }
    case "clear": return null;
    default: throw new ModelRouteError(`unknown change "${op}" (${ROUTE_OPS.join(", ")}, or rollback)`);
  }
  return o;
}

function writeOverride(db, task, value) {
  if (value === null) clearSetting(db, routeKey(task));
  else setSetting(db, routeKey(task), JSON.stringify(value));
}

function audit(db, { actor, action, task, before, after, reason }) {
  const a = auditActorColumns(actor);
  return Number(db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason)
    VALUES (?,?,?,?,?,?,?,?)`).run(a.admin_user_id, a.actor_kind, a.actor, action, task,
      before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after), reason).lastInsertRowid);
}

const needReason = (reason) => {
  if (typeof reason !== "string" || !reason.trim()) throw new ModelRouteError("say why (reason) — a model switch is read later by someone deciding whether to undo it", { code: "model_route_reason_required" });
  return reason.trim();
};

/**
 * One switch, applied now, no deploy: computes the new runtime layer, validates the whole effective route it produces
 * (providers, models, the stage order, the evaluation gate), then writes it and its audit row in one transaction.
 * `actor` is a request or an actor (services/actor.js). Returns the new effective route.
 */
export function applyRouteChange(db, task, { op, reason, actor = null, env = process.env, ...args } = {}) {
  const why = needReason(reason);
  const t = taskOf(task);
  if (t.runsIn !== "draft") throw new ModelRouteError(`${task} runs in the ${t.runsIn}; switch it there`, { code: "model_task_not_routed_here" });
  const before = overrideFor(db, task);
  const after = nextOverride(db, task, before, op, args, env);
  validateRoute(db, task, mergeRoute(t.defaultRoute, envRouteFor(task, env), after));
  const who = toActor(actor);
  db.transaction(() => {
    writeOverride(db, task, after);
    audit(db, { actor: who, action: `model_route.${op}`, task, before, after, reason: why });
  })();
  console.warn(`[gateway] ${task}: ${op} by ${actorRef(who)} — ${why}`);
  return effectiveRoute(db, task, { env });
}

/**
 * ⛔ ROLLBACK, INSTANT: restores the runtime layer as it was before the newest change still in force, and marks that
 * change undone. Not gated: it returns to a configuration that was already serving. Repeated rollbacks walk back.
 */
export function rollbackRoute(db, task, { reason, actor = null, env = process.env } = {}) {
  const why = needReason(reason);
  taskOf(task);
  const last = db.prepare(`SELECT id, before_json FROM admin_audit_log
      WHERE target = ? AND action LIKE 'model_route.%' AND action <> 'model_route.rollback' AND undone_at IS NULL
      ORDER BY id DESC LIMIT 1`).get(task);
  if (!last) throw new ModelRouteError(`${task}: nothing to roll back`, { status: 409, code: "model_route_nothing_to_undo" });
  const before = overrideFor(db, task);
  const restored = last.before_json ? JSON.parse(last.before_json) : null;
  const who = toActor(actor);
  db.transaction(() => {
    writeOverride(db, task, restored);
    db.prepare("UPDATE admin_audit_log SET undone_at = unixepoch() WHERE id = ?").run(last.id);
    audit(db, { actor: who, action: "model_route.rollback", task, before, after: restored, reason: why });
  })();
  console.warn(`[gateway] ${task}: ROLLED BACK change #${last.id} by ${actorRef(who)} — ${why}`);
  return effectiveRoute(db, task, { env });
}

/** The switch history of one task (newest first): who · when · why · before · after. */
export function routeHistory(db, task, limit = 30) {
  try {
    return db.prepare(`SELECT id, at, actor, action, before_json, after_json, reason, undone_at FROM admin_audit_log
        WHERE target = ? AND action LIKE 'model_route.%' ORDER BY id DESC LIMIT ?`).all(task, limit)
      .map(r => ({ id: r.id, at: r.at, actor: r.actor, op: r.action.replace("model_route.", ""), reason: r.reason, undoneAt: r.undone_at,
                   before: r.before_json ? JSON.parse(r.before_json) : null, after: r.after_json ? JSON.parse(r.after_json) : null }));
  } catch { return []; }
}

// ── G4 · telemetry per task × model ─────────────────────────────────────────────────────────────────────────────────
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : null);

/**
 * Calls, tokens, cost, latency p50 / p95, errors, fallbacks and shadows per task × provider × model over the last
 * `sinceSec` seconds. A row from before migration 221 (no task column) is attributed by its purpose; a purpose no task
 * claims is reported under "unregistered" rather than dropped. Admin-only, on demand.
 */
export function taskTelemetry(db, { sinceSec = 7 * 86_400, now = Math.floor(Date.now() / 1000) } = {}) {
  let rows;
  const cols = db.prepare("PRAGMA table_info(usage_events)").all().map(c => c.name);
  const hasTask = cols.includes("task") && cols.includes("route");
  rows = db.prepare(`SELECT purpose, event_type, provider, model, input_tokens, output_tokens, cost_usd, duration_ms, success
      ${hasTask ? ", task, route" : ", NULL AS task, NULL AS route"}
      FROM usage_events WHERE created_at >= ?`).all(now - sinceSec);
  const groups = new Map();
  for (const r of rows) {
    const task = r.task || taskForPurpose(r.purpose) || "unregistered";
    const key = `${task}|${r.provider || "anthropic"}|${r.model || "?"}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { task, provider: r.provider || "anthropic", model: r.model || null, calls: 0, errors: 0, fallbacks: 0,
      shadows: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, durations: [] });
    g.calls++;
    if (r.success === 0) g.errors++;
    if (r.route === "fallback") g.fallbacks++;
    if (r.route === "shadow" || r.event_type === SHADOW_EVENT_TYPE) g.shadows++;
    g.inputTokens += r.input_tokens || 0; g.outputTokens += r.output_tokens || 0; g.costUsd += r.cost_usd || 0;
    if (r.duration_ms) g.durations.push(r.duration_ms);
  }
  return [...groups.values()].map(({ durations, ...g }) => {
    durations.sort((a, b) => a - b);
    const budget = TASKS[g.task]?.defaultRoute?.budget ?? null;
    const p50 = pct(durations, 50), p95 = pct(durations, 95);
    const costPerCall = g.calls ? g.costUsd / g.calls : 0;
    return { ...g, costUsd: Number(g.costUsd.toFixed(6)), costPerCallUsd: Number(costPerCall.toFixed(6)), latencyP50Ms: p50, latencyP95Ms: p95,
      overBudget: budget ? { cost: costPerCall > budget.costPerCallUsd, p50: p50 !== null && p50 > budget.p50Ms, p95: p95 !== null && p95 > budget.p95Ms } : null };
  }).sort((a, b) => a.task.localeCompare(b.task) || b.calls - a.calls);
}

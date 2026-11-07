// services/modelUsage.js — ⛔ D171 FIX 2 · WHERE THE TOKENS WENT (owner 11-06: "look at the token and cost today, theres
// also an unknown run at 6am utc … 146,348, costing 0.56$"). D162 G4's Admin card made concrete.
//
//   usageTable(db, { hours })     per HOUR × event type × model × key label × who started it — calls, tokens, cost.
//                                 BOTH services: draft's own calls (route default / cohort / shadow / fallback, paid by
//                                 draft's key) and the résumé generations draft asks the tools service for (route
//                                 "tools-service", paid by the tools service's key — the usage records it returns are
//                                 written to usage_events by services/toolsService.js recordToolsServiceUsage).
//   costAlarmStatus(db)           today's (UTC) spend against the threshold the owner set; over → pipeline health raises
//                                 it, Admin → System shows it, and checkCostAlarm logs `[usage] COST ALARM` once a day.
//   draftKeyLabel / toolsKeyLabel which key paid: ANTHROPIC_KEY_LABEL (the key's name in the Console: "draft-prod",
//                                 "local-dev"); for the tools service, the label its record carries, else
//                                 TOOLS_SERVICE_KEY_LABEL, else "tools-service (unlabelled)".
//   prodKeyOutsideProduction(env) a production key label on a process that is not production — the boot warns (O103:
//                                 local work uses its own key, so local spend can never read as production's).
//
// ⛔ It counts what draft RECORDED. The tools service's calls for other clients (its own site, MCP) are in its own
// model_usage ledger, not here — see the panel's note.
import { getSetting, setSetting, clearSetting } from "./appSettings.js";
import { auditActorColumns, toActor } from "./actor.js";

export const COST_ALARM_KEY = "model_cost_alarm_usd";
export const COST_ALARM_ENV = "MODEL_DAILY_COST_ALARM_USD";
export const UNLABELLED = "(unlabelled)";
export const TOOLS_UNLABELLED = "tools-service (unlabelled)";

/** The label of the key draft's own calls are paid by. */
export function draftKeyLabel(env = process.env) {
  const l = String(env?.ANTHROPIC_KEY_LABEL ?? "").trim();
  return l || UNLABELLED;
}

/** The label of the key a tools-service record was paid by: its own field, else this deploy's setting for it. */
export function toolsKeyLabel(record = {}, env = process.env) {
  const own = record?.key_label ?? record?.keyLabel ?? null;
  if (typeof own === "string" && own.trim()) return own.trim().slice(0, 80);
  const l = String(env?.TOOLS_SERVICE_KEY_LABEL ?? "").trim();
  return l || TOOLS_UNLABELLED;
}

/** Whether this process is production: NODE_ENV=production or Railway's production environment. */
export function isProductionProcess(env = process.env) {
  return env?.NODE_ENV === "production" || String(env?.RAILWAY_ENVIRONMENT_NAME ?? env?.RAILWAY_ENVIRONMENT ?? "").toLowerCase() === "production";
}

const PROD_LABEL = /(^|[^a-z])prod(uction)?([^a-z]|$)/i;
/** A label that names a production key ("draft-prod", "tools-prod", "production"). */
export const isProdLabel = (label) => PROD_LABEL.test(String(label ?? ""));

/**
 * The boot's check: null when fine, else the warning. A process that is not production (NODE_ENV ≠ production and not on
 * Railway's production environment) holding a key labelled prod is the 11-06 suspicion — local work spending on
 * production's key — and must say so at boot, loudly.
 */
export function prodKeyOutsideProduction(env = process.env) {
  const label = String(env?.ANTHROPIC_KEY_LABEL ?? "").trim();
  const hasKey = !!String(env?.ANTHROPIC_KEY ?? env?.ANTHROPIC_API_KEY ?? "").trim();
  if (!hasKey || !isProdLabel(label)) return null;
  if (isProductionProcess(env)) return null;
  return `[boot] ⛔ MODEL KEY: this process is not production (NODE_ENV=${env?.NODE_ENV || "unset"}) but its key is labelled "${label}" — ` +
    "local work must use its own key (O103: label it local-dev), or its spend reads as production's";
}

const cols = new WeakMap();
function usageColumns(db) {
  if (cols.has(db)) return cols.get(db);
  let c = new Set();
  try { c = new Set(db.prepare("PRAGMA table_info(usage_events)").all().map(r => r.name)); } catch { /* no table */ }
  cols.set(db, c);
  return c;
}
/** Test seam: forget the cached column list (a test that migrates after a first read). */
export function forgetUsageColumns(db) { cols.delete(db); }

/** The UTC hour an epoch second falls in, as "YYYY-MM-DDTHH:00Z". */
export const hourOf = (sec) => new Date(Math.floor(sec / 3600) * 3600 * 1000).toISOString().slice(0, 13) + ":00Z";

/**
 * Per hour × event type × model × key label × started by — newest hour first. `service` is "tools" for rows the tools
 * service made (route tools-service), else "draft". A row from before migration 224 has no key label or started_by:
 * it reads "(not recorded)", never a guess.
 */
export function usageTable(db, { hours = 48, now = Math.floor(Date.now() / 1000) } = {}) {
  const c = usageColumns(db);
  if (!c.size) return { hours, since: now - hours * 3600, rows: [], totals: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 } };
  const since = now - Math.max(1, Math.min(24 * 90, hours)) * 3600;
  const opt = (name) => (c.has(name) ? name : `NULL AS ${name}`);
  const raw = db.prepare(`SELECT created_at, event_type, model, ${opt("route")}, ${opt("key_label")}, ${opt("started_by")},
      input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, success
    FROM usage_events WHERE created_at >= ?`).all(since);
  const groups = new Map();
  const totals = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (const r of raw) {
    const service = r.route === "tools-service" ? "tools" : "draft";
    const row = {
      hour: hourOf(r.created_at), eventType: r.event_type || "(none)", model: r.model || "(none)", service,
      keyLabel: r.key_label || "(not recorded)", startedBy: r.started_by || "(not recorded)",
    };
    const key = [row.hour, row.eventType, row.model, row.service, row.keyLabel, row.startedBy].join("|");
    let g = groups.get(key);
    if (!g) groups.set(key, g = { ...row, calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, costUsd: 0 });
    g.calls++;
    if (r.success === 0) g.failed++;
    g.inputTokens += r.input_tokens || 0;
    g.outputTokens += r.output_tokens || 0;
    g.cacheTokens += (r.cache_read_tokens || 0) + (r.cache_creation_tokens || 0);
    g.costUsd += r.cost_usd || 0;
    totals.calls++; totals.inputTokens += r.input_tokens || 0; totals.outputTokens += r.output_tokens || 0; totals.costUsd += r.cost_usd || 0;
  }
  const rows = [...groups.values()].map(g => ({ ...g, tokens: g.inputTokens + g.outputTokens, costUsd: Number(g.costUsd.toFixed(6)) }))
    .sort((a, b) => (a.hour < b.hour ? 1 : a.hour > b.hour ? -1 : b.costUsd - a.costUsd));
  return { hours, since, rows, totals: { ...totals, costUsd: Number(totals.costUsd.toFixed(6)) } };
}

/** The threshold in USD, and where it came from: the admin's setting, else the env var, else none (the alarm is off). */
export function costAlarmThreshold(db, env = process.env) {
  const s = db ? getSetting(db, COST_ALARM_KEY) : null;
  const fromSetting = s != null && Number.isFinite(Number(s)) && Number(s) > 0 ? Number(s) : null;
  if (fromSetting != null) return { usd: fromSetting, source: "admin" };
  const e = Number(env?.[COST_ALARM_ENV]);
  if (Number.isFinite(e) && e > 0) return { usd: e, source: "env" };
  return { usd: null, source: "off" };
}

/** Today (UTC) so far: spend by key label, against the threshold. */
export function costAlarmStatus(db, { env = process.env, now = Math.floor(Date.now() / 1000) } = {}) {
  const dayStart = Math.floor(now / 86400) * 86400;
  const threshold = costAlarmThreshold(db, env);
  const c = usageColumns(db);
  let byKey = [];
  if (c.size) {
    try {
      byKey = db.prepare(`SELECT ${c.has("key_label") ? "COALESCE(key_label, '(not recorded)')" : "'(not recorded)'"} AS keyLabel,
          COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS costUsd, COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
        FROM usage_events WHERE created_at >= ? GROUP BY 1 ORDER BY costUsd DESC`).all(dayStart)
        .map(r => ({ ...r, costUsd: Number(r.costUsd.toFixed(6)) }));
    } catch { byKey = []; }
  }
  const spentUsd = Number(byKey.reduce((s, r) => s + r.costUsd, 0).toFixed(6));
  const over = threshold.usd != null && spentUsd > threshold.usd;
  return { day: new Date(dayStart * 1000).toISOString().slice(0, 10), thresholdUsd: threshold.usd, source: threshold.source, spentUsd, over, byKey };
}

/** Sets (a positive number) or clears (null) the admin's threshold, with an audit row: who · when · why. */
export function setCostAlarmThreshold(db, usd, { actor = null, reason = null } = {}) {
  const before = getSetting(db, COST_ALARM_KEY);
  if (usd === null || usd === undefined || usd === "") clearSetting(db, COST_ALARM_KEY);
  else {
    const n = Number(usd);
    if (!Number.isFinite(n) || n <= 0 || n > 10_000) throw new Error("the daily cost alarm is a positive number of dollars (≤ 10,000), or empty to turn it off");
    setSetting(db, COST_ALARM_KEY, String(n));
  }
  const after = getSetting(db, COST_ALARM_KEY);
  try {
    const a = auditActorColumns(toActor(actor));
    db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason)
      VALUES (?,?,?,?,?,?,?,?)`).run(a.admin_user_id, a.actor_kind, a.actor, "model_cost_alarm.set", COST_ALARM_KEY,
      JSON.stringify(before), JSON.stringify(after), reason ? String(reason).slice(0, 500) : null);
  } catch (e) { console.warn(`[usage] cost alarm audit row not written: ${e.message}`); }
  return costAlarmThreshold(db);
}

// The log line, once per UTC day per process — and checked at most once a minute, so a burst of calls is not a burst
// of SUM queries. The pipeline-health alert does not depend on it (it reads costAlarmStatus itself).
const alarmed = new WeakMap();
let lastCheckAt = 0;
/** Test seam. */
export function resetCostAlarmLog() { lastCheckAt = 0; }
export function checkCostAlarm(db, { env = process.env, now = Math.floor(Date.now() / 1000), force = false, log = console.error } = {}) {
  if (!db) return null;
  if (!force && now - lastCheckAt < 60) return null;
  lastCheckAt = now;
  let st;
  try { st = costAlarmStatus(db, { env, now }); } catch { return null; }
  if (!st.over) return st;
  if (alarmed.get(db) === st.day) return st;
  alarmed.set(db, st.day);
  log(`[usage] COST ALARM ${st.day}: $${st.spentUsd.toFixed(2)} spent on models today (UTC), over the $${st.thresholdUsd.toFixed(2)} alarm (${st.source}) — ` +
    st.byKey.map(k => `${k.keyLabel} $${k.costUsd.toFixed(2)} / ${k.calls} calls`).join(" · ") + " — Admin → System → Model usage");
  return st;
}

// services/entitlementResolver.js — ⭐ D88 P1 · ONE RESOLVER for every per-user cap and permission.
//
// resolveEntitlement(db, userId, feature) → { value, source, detail } — the winning layer, so a screen can
// say WHERE a value came from ("plan: PRO", "override: user_limits", "global: the plugin is switched off").
// Order, top wins: GLOBAL → OVERRIDE → PLAN → SYSTEM; an integer is then clamped to its CEILING.
//
// ⛔ P1 changes NO default and adds no table: the layers read exactly what the old code read —
//   global   app_settings (byom_enabled, byom_daily_cap), the full-auto kill switch, FULL_AUTO_PROVEN (ctx)
//   override user_limits.daily_resumes / monthly_resumes (Admin → Users → Limits), users.aplus_resume
//   plan     users.plan_tier, only while monetisation is on (requireToolEntitlement's rule)
//   system   shared/entitlements.js (the env variables the old code read, with the same fallbacks)
// D88 P2 adds `user_entitlement_overrides` as a second override source; nothing here assumes it yet.
import { FEATURES } from "../shared/entitlements.js";
import { getSetting, settingTruthy, fullAutoDisabled } from "./appSettings.js";
import { monetisationEnabledFromEnv } from "../shared/monetisation.js";

const row = (db, sql, ...args) => { try { return db.prepare(sql).get(...args) ?? null; } catch { return null; } };

// The GLOBAL layer: a value, or undefined when the operator has nothing to say about this feature.
const GLOBAL = {
  plugin_byo: (db) => (settingTruthy(getSetting(db, "byom_enabled")) ? undefined : { value: false, detail: "the plugin is switched off for everyone (Admin → System → Plugin)" }),
  byo_daily_cap: (db) => {
    const n = Number(getSetting(db, "byom_daily_cap"));
    return Number.isInteger(n) && n > 0 && n <= 1000 ? { value: n, detail: "the operator's daily cap (Admin → System → Plugin)" } : undefined;
  },
  auto_apply_mode: (db, ctx, env) => {
    if (!ctx.fullAutoProven) return { value: "locked", detail: "Auto has never run unattended against a real employer (FULL_AUTO_PROVEN)" };
    if (fullAutoDisabled(db, env)) return { value: "locked", detail: "the operator's kill switch" };
    return undefined;
  },
};

// The OVERRIDE layer: a per-user value, or undefined.
const OVERRIDE = {
  resume_generations_per_day: (db, userId) => {
    const r = row(db, "SELECT daily_resumes FROM user_limits WHERE user_id = ?", userId);
    return r && r.daily_resumes != null ? { value: r.daily_resumes, detail: "user_limits.daily_resumes" } : undefined;
  },
  resume_generations_per_month: (db, userId) => {
    const r = row(db, "SELECT monthly_resumes FROM user_limits WHERE user_id = ?", userId);
    return r && r.monthly_resumes != null ? { value: r.monthly_resumes, detail: "user_limits.monthly_resumes" } : undefined;
  },
  a_plus_default: (db, userId) => {
    const r = row(db, "SELECT aplus_resume FROM users WHERE id = ?", userId);
    return r?.aplus_resume ? { value: true, detail: "users.aplus_resume (set by an admin)" } : undefined;
  },
};

/**
 * @param ctx { planTier?, monetisation?, fullAutoProven? } — planTier is read from users when absent;
 *   monetisation from the env (MONETISATION_ENABLED) when absent.
 * @returns {{ value, source: "global"|"override"|"plan"|"system", detail: string|null, ceiling?: number }}
 */
export function resolveEntitlement(db, userId, feature, { env = process.env, ctx = {} } = {}) {
  const f = FEATURES[feature];
  if (!f) throw new Error(`unknown entitlement: ${feature}`);
  const c = { ...ctx };
  if (c.monetisation === undefined) c.monetisation = monetisationEnabledFromEnv(env);
  const clamp = (r) => {
    if (f.kind === "integer" && f.ceiling != null && Number.isFinite(r.value) && r.value > f.ceiling) {
      return { ...r, value: f.ceiling, ceiling: f.ceiling, detail: `${r.detail ?? r.source}, held to the ceiling of ${f.ceiling}` };
    }
    return r;
  };
  const g = GLOBAL[feature]?.(db, c, env);
  if (g !== undefined) return { source: "global", detail: null, ...g };
  if (!f.hard && userId != null) {
    const o = OVERRIDE[feature]?.(db, userId);
    if (o !== undefined) return clamp({ source: "override", detail: null, ...o });
  }
  if (f.plan && userId != null) {
    const tier = c.planTier ?? row(db, "SELECT plan_tier FROM users WHERE id = ?", userId)?.plan_tier ?? "BASIC";
    const p = f.plan(tier, c);
    if (p !== undefined) return { value: p, source: "plan", detail: `plan: ${String(tier || "BASIC").toUpperCase()}` };
  }
  // ⛔ The ceiling holds an OVERRIDE; the system default is the operator's own env value and is not clamped
  // (P1 changes no default: a deploy that set DAILY_DRAFT_SLOTS above the ceiling keeps it).
  return { value: f.system(env), source: "system", detail: null };
}

/** Every feature for one user — the D88 Feature-access module reads this. */
export function resolveAll(db, userId, opts = {}) {
  return Object.fromEntries(Object.keys(FEATURES).map(k => [k, resolveEntitlement(db, userId, k, opts)]));
}

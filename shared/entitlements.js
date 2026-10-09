// shared/entitlements.js — ⭐ D88 P1 · THE FEATURE REGISTRY: every per-user cap and permission, one row each.
//
// Owner, 10-09 (D88): "Plans and feature defaults live in code — versioned, tested, one source." Before this
// file the caps were decided in six places that never met: the plan gate (requireToolEntitlement), the
// admin's silent A+ swap (users.aplus_resume), user_limits rows read by limitEnforcer, the draft-slot window
// (DAILY_DRAFT_SLOTS), the apply caps (APPLY_DAILY_*), the full-auto lock (FULL_AUTO_PROVEN + the kill
// switch) and the plugin's two settings (byom_enabled, byom_daily_cap). Each now has a row here and is read
// through services/entitlementResolver.js `resolveEntitlement()`.
//
// ⛔ P1 CHANGES NO DEFAULT. Every `system` value below is the value the old code computed, from the same env
// variable with the same fallback; every `plan` rule is the old plan gate. test/d88Resolver.test.js compares
// the resolver with the old computation across plans, flags, rows and env values.
//
// The resolver's order, top wins: GLOBAL (a kill switch or an operator setting) → the user's OVERRIDE → the
// PLAN default → the SYSTEM default; then the CEILING clamps an integer, and a HARD lock no row can lift.
// Pure: no database here. `env` and `ctx` come from the caller.

const envInt = (env, name, dflt) => {
  const n = Number(env?.[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
};
const atLeast = (tier, required) => {
  const order = ["BASIC", "PLUS", "PRO"];
  const t = order.includes(String(tier || "").toUpperCase()) ? String(tier).toUpperCase() : "BASIC";
  return order.indexOf(t) >= order.indexOf(required);
};

/** The Daily Deck's size — the draft-slot fallback (services/dailyDraft.js DECK_SIZE). */
export const DECK_SIZE_DEFAULT = 10;
/** The plugin's daily cap fallback (services/byom/policy.js). */
export const BYO_DAILY_CAP_DEFAULT = 50;

/**
 * kind: "boolean" | "integer" | "limit" (an integer or null = unlimited) | "mode".
 * plan(tier, ctx): the plan's say, or undefined when the plan has none (ctx.monetisation false → none).
 * system(env): the default when nothing above speaks.  ceiling: the most any override can reach.
 */
export const FEATURES = Object.freeze({
  draft_slots: {
    kind: "integer", label: "Drafts in the last 24 hours",
    system: (env) => envInt(env, "DAILY_DRAFT_SLOTS", DECK_SIZE_DEFAULT), ceiling: 100,
  },
  resume_generations_per_day: {
    kind: "limit", label: "Résumés a day (draft generations)", system: () => null, ceiling: null,
  },
  resume_generations_per_month: {
    kind: "limit", label: "Résumés a month (draft generations)", system: () => null, ceiling: null,
  },
  generate_enabled: {
    kind: "boolean", label: "Generate a résumé",
    plan: (tier, ctx) => (ctx.monetisation ? atLeast(tier, "PLUS") : undefined), system: () => true,
  },
  a_plus_enabled: {
    kind: "boolean", label: "A+ résumé",
    plan: (tier, ctx) => (ctx.monetisation ? atLeast(tier, "PRO") : undefined), system: () => true,
  },
  a_plus_default: {
    kind: "boolean", label: "Generate runs A+ (the admin's swap)", system: () => false,
  },
  plugin_byo: {
    kind: "boolean", label: "Write résumés in ChatGPT or Claude (D86)", system: () => true,
  },
  byo_daily_cap: {
    kind: "integer", label: "Résumés a day written with the user's own model", system: () => BYO_DAILY_CAP_DEFAULT, ceiling: 1000,
  },
  apply_daily_queue_cap: {
    kind: "integer", label: "Previews in 24 hours", system: (env) => envInt(env, "APPLY_DAILY_QUEUE_CAP", 40), ceiling: null,
  },
  apply_daily_approval_cap: {
    kind: "integer", label: "Approvals in 24 hours", system: (env) => envInt(env, "APPLY_DAILY_APPROVAL_CAP", 30), ceiling: null,
  },
  apply_daily_submission_cap: {
    kind: "integer", label: "Submissions in 24 hours", system: (env) => envInt(env, "APPLY_DAILY_CAP", 25), ceiling: null,
  },
  auto_apply_mode: {
    // ⛔ D36: full auto stays LOCKED whatever a row says. "unlocked" only when the code says full auto has
    // been proven AND the operator's kill switch is off — both GLOBAL; no override can reach it.
    kind: "mode", label: "Automatic sending", system: () => "unlocked", hard: true,
  },
});

export const FEATURE_KEYS = Object.freeze(Object.keys(FEATURES));

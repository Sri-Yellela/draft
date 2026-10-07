// services/baseResumeOnly.js — ⭐ D66 · A BASE-RÉSUMÉ-ONLY PAYLOAD: a setting now, a plan tier later.
//
// Owner, 10-07: "we would potentially have a tier where the user could choose to not have the generated
// résumé option or choose to disable it, and the payload would simply have the base résumé."
//
// When it is on, an application's résumé is the user's BASE résumé — the active profile's, else the
// account's — and ⛔ NO MODEL IS CALLED for it: not at a Draft, not at Prepare, not when a packet is
// given its résumé. The packet says "Base résumé" (answers_json.resumeSource = "base") and its download
// serves that résumé. Nothing about slots changes: a Draft is one application whatever it carries, and
// a generation inside a run was already "the same Draft continuing" (A63), so there is no slot to save.
//
// ON comes from either place:
//   setting  users.base_resume_only (migration 139) — the user's own switch, in Account.
//   plan     BASE_ONLY_TIERS — a plan tier that FORCES it (the tier the owner described). Empty today:
//            no plan forces it yet, so nothing changes for anyone who has not switched it on.
import { buildStructuredResume, renderStructuredResume } from "./resumeFormatter.js";
import { normalisePlanTier } from "./entitlements.js";

export const BASE_ONLY_TIERS = Object.freeze([]);
export const BASE_RESUME_LABEL = "Base résumé";

/** { on, source: "setting" | "plan" | null } — read at request time, never cached. */
export function baseResumeOnlyState(db, userId, { forcedTiers = BASE_ONLY_TIERS } = {}) {
  let row = null;
  try { row = db.prepare("SELECT base_resume_only, plan_tier FROM users WHERE id = ?").get(userId); } catch { row = null; }
  if (!row) {
    try { row = db.prepare("SELECT plan_tier FROM users WHERE id = ?").get(userId); } catch { row = null; }
  }
  if (row && forcedTiers.includes(normalisePlanTier(row.plan_tier))) return { on: true, source: "plan" };
  if (row && Number(row.base_resume_only) === 1) return { on: true, source: "setting" };
  return { on: false, source: null };
}

/** The base résumé an application carries: the ACTIVE profile's, else the account's. */
export function activeBaseResume(db, userId) {
  try {
    const p = db.prepare(`
      SELECT pbr.content, pbr.name FROM profile_base_resumes pbr
        JOIN domain_profiles dp ON dp.id = pbr.profile_id
       WHERE pbr.user_id = ? AND dp.is_active = 1 LIMIT 1`).get(userId);
    if (String(p?.content || "").trim()) return { content: p.content, name: p.name || null, scope: "profile" };
  } catch { /* no per-profile table */ }
  try {
    const b = db.prepare("SELECT content, name FROM base_resume WHERE user_id = ?").get(userId);
    if (String(b?.content || "").trim()) return { content: b.content, name: b.name || null, scope: "account" };
  } catch { /* no base résumé table */ }
  return null;
}

/** The base résumé as the document a form receives — the renderer's own HTML, no model. */
export function baseResumeHtml(content) {
  return renderStructuredResume(buildStructuredResume(content));
}

/**
 * What generateResumeForApply answers when base-only is on — the same shape a generation returns where
 * the apply flow reads it (`html`), with `resumeId: null` (no tailored artifact was made) and
 * `baseOnly: true`. ⛔ No model call.
 */
export function baseOnlyGeneration(db, userId) {
  const base = activeBaseResume(db, userId);
  if (!base) return { error: "no_base_resume", errorCode: "no_base_resume", errorDetail: "Base-résumé-only is on, and there is no base résumé to send." };
  return { html: baseResumeHtml(base.content), resumeId: null, atsScore: null, baseOnly: true };
}

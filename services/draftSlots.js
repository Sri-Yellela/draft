// ── The day's Draft slots — one allowance shared by Drafts and résumé generations (A63) ────────
//
// Owner, 10-02 (O45c, confirmed): "Generating a résumé consumes ONE of the day's 10 Draft slots."
// The 10 is the deck's daily allowance (DECK_SIZE in services/dailyDraft.js), and a generation counts
// against the same 10 as a Draft. So this is ONE number with two kinds of use:
//
//   a Draft       an apply_run_jobs row the user started — any surface (deck, board, Auto Apply's
//                 Draft again). NOT a run the approve endpoint made (approval_mode 'approved'): that
//                 is the same Draft continuing, not a second one. NOT 'cancelled' (Undo / removed
//                 from the line gives the slot back) and NOT 'superseded' by an answers retry (it
//                 replaced that attempt with a newer row, which is the one counted). ⛔ D36: a preview
//                 superseded by an APPROVAL (approved_at set) IS counted — it is the Draft, and the
//                 approved run that continues it is excluded, so it is counted exactly once.
//   a generation  a draft_slot_uses row, written when POST /api/generate makes a NEW résumé (a cached
//                 one costs nothing). Debited on success, never on attempt.
//
// ⛔ A limit that is shown must be enforced (the A50 wrong-number class): both kinds are REFUSED at
// zero, with the same sentence, and every surface reads remaining from here.
//
// The window is the trailing 24 hours — the same window as every other apply cap (queuedLast24h,
// approvedLast24h, submittedLast24h) — and the copy says "in the last 24 hours", not "today".
import { DECK_SIZE } from "./dailyDraft.js";
import { resolveEntitlement } from "./entitlementResolver.js";
import { isTrial, TRIAL_DRAFTS, TRIAL_GENERATIONS } from "./trial.js";

export function draftSlotLimit(env = process.env) {
  const n = Number(env?.DAILY_DRAFT_SLOTS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DECK_SIZE;
}

const WINDOW_SECONDS = 86400;

/** Drafts the user started in the window. 0 on a database without the tables (a test fixture). */
function draftsUsed(db, userId, since) {
  try {
    return db.prepare(`
      SELECT COUNT(*) FROM apply_run_jobs rj
      JOIN apply_runs r ON r.id = rj.run_id
      WHERE rj.user_id = ?
        AND COALESCE(r.approval_mode, '') != 'approved'
        AND rj.status <> 'cancelled'
        -- D36: superseded by an ANSWERS retry is not counted (the newer row is); superseded by an
        -- APPROVAL is — the approved run is excluded above, so not counting this as well gave the slot
        -- back on every Approve and the 10-a-day bound held only for drafts never approved.
        AND NOT (rj.status = 'superseded' AND rj.approved_at IS NULL)
        AND COALESCE(rj.created_at, 0) >= ?
    `).pluck().get(userId, since);
  } catch { return 0; }
}

function generationsUsed(db, userId, since) {
  try {
    return db.prepare(`
      SELECT COUNT(*) FROM draft_slot_uses WHERE user_id = ? AND kind = 'generate' AND created_at >= ?
    `).pluck().get(userId, since);
  } catch { return 0; }
}

/** The oldest use still inside the window (seconds), or null. Same rows the two counts above count. */
function oldestUse(db, userId, since) {
  const one = (sql) => { try { return db.prepare(sql).pluck().get(userId, since) ?? null; } catch { return null; } };
  const d = one(`SELECT MIN(rj.created_at) FROM apply_run_jobs rj JOIN apply_runs r ON r.id = rj.run_id
    WHERE rj.user_id = ? AND COALESCE(r.approval_mode, '') != 'approved' AND rj.status <> 'cancelled'
      AND NOT (rj.status = 'superseded' AND rj.approved_at IS NULL) AND COALESCE(rj.created_at, 0) >= ?`);
  const g = one(`SELECT MIN(created_at) FROM draft_slot_uses WHERE user_id = ? AND kind = 'generate' AND created_at >= ?`);
  const v = [d, g].filter(x => x != null).map(Number);
  return v.length ? Math.min(...v) : null;
}

/**
 * { limit, used, remaining, drafts, generations, windowHours, nextFreeAt } for one user, now.
 * D51: `nextFreeAt` (ms) is when the oldest use leaves the window — the moment a slot frees — so an
 * exhausted Draft button can say "resets in 3h" instead of only "no". Null when nothing is used.
 */
export function draftSlots(db, userId, { now = Math.floor(Date.now() / 1000), env = process.env } = {}) {
  // ⭐ D124 · THE TRIAL (the main frame for every new account): 2 Drafts and 4 résumé generations IN ALL, not per day — the
  // trial then locks into the survey. Both refused at zero by every caller that already reads `remaining`.
  if (isTrial(db, userId)) {
    const drafts = draftsUsed(db, userId, 0);
    const generations = generationsUsed(db, userId, 0);
    const remaining = Math.max(0, Math.min(TRIAL_DRAFTS - drafts, TRIAL_GENERATIONS - generations));
    return { limit: TRIAL_DRAFTS, used: drafts, remaining, drafts, generations, windowHours: null, nextFreeAt: null, trial: true };
  }
  const since = now - WINDOW_SECONDS;
  const drafts = draftsUsed(db, userId, since);
  const generations = generationsUsed(db, userId, since);
  // ⭐ D88 P1: the limit is the resolver's (global → override → plan → system); its system default is
  // draftSlotLimit(env) below, unchanged.
  const limit = resolveEntitlement(db, userId, "draft_slots", { env }).value;
  const used = drafts + generations;
  const oldest = used > 0 ? oldestUse(db, userId, since) : null;
  return { limit, used, remaining: Math.max(0, limit - used), drafts, generations, windowHours: 24,
           nextFreeAt: oldest == null ? null : (oldest + WINDOW_SECONDS) * 1000 };
}

/** The refusal every surface shows, so the deck, the board and Generate say the same thing. */
export function slotsExhausted(slots, requested = 1) {
  if (slots?.trial) {
    return { error: "draft_slots_exhausted", slots,
      message: `The trial includes ${slots.limit} Drafts, and you have used ${slots.drafts}. Thank you for trying draft.` };
  }
  return {
    error: "draft_slots_exhausted",
    message: `You have used ${slots.used} of your ${slots.limit} drafts in the last 24 hours ` +
      `(a Draft and a generated résumé each use one)` +
      (requested > 1 ? `, and ${requested} were requested.` : ".") +
      " The next one frees up 24 hours after the oldest.",
    slots,
  };
}

/** Debit one generation. Called only after a NEW résumé was made. */
export function recordGenerationSlot(db, userId, jobId) {
  db.prepare("INSERT INTO draft_slot_uses (user_id, kind, job_id) VALUES (?, 'generate', ?)")
    .run(userId, jobId == null ? null : String(jobId));
}

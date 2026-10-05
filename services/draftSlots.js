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

/** { limit, used, remaining, drafts, generations, windowHours } for one user, now. */
export function draftSlots(db, userId, { now = Math.floor(Date.now() / 1000), env = process.env } = {}) {
  const since = now - WINDOW_SECONDS;
  const drafts = draftsUsed(db, userId, since);
  const generations = generationsUsed(db, userId, since);
  const limit = draftSlotLimit(env);
  const used = drafts + generations;
  return { limit, used, remaining: Math.max(0, limit - used), drafts, generations, windowHours: 24 };
}

/** The refusal every surface shows, so the deck, the board and Generate say the same thing. */
export function slotsExhausted(slots, requested = 1) {
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

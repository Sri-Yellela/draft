// routes/extensionDraft.js — ⭐ T24 · THE INTENT MODEL, the server's half: the extension's Draft button IS the board's Draft.
//
// Owner, 10-15 (T22 REVISED): the popup's Draft button (/d) pressed before any autofill on a tab DRAFTS the job — the same
// queue as the board's Draft, semi / full auto exactly as the account's apply mode says (⛔ full auto stays LOCKED:
// routes/apply.js FULL_AUTO_PROVEN = false) — and QUEUES the résumé's generation as part of that pipeline.
//
//   GET  /api/extension/draft/:jobId   the tells only the server holds, in ONE read (nothing is started or spent):
//        → { ok, jobId, draft: { drafted, status, runId }, resume: { state, id }, slots, applyMode, autoLocked, held, settings }
//   POST /api/extension/draft          { boundJobId, trigger: "click", resume?: false }
//        → 202 { ok, draft: { runId, waiting, line, message }, resume, resumeSkipped, slots, applyMode }
//        → 200 { ok, already: true, draft, resume }            (⛔ never queued twice — nothing is spent)
//        → 429 draft_slots_exhausted / draft_slots_short        (⛔ said BEFORE anything is queued)
//        → whatever the board's Draft refuses with (startRun: 409 prerequisites, 503 paused, 429 line_full …)
//   GET  /api/settings/extension-intent   the two settings and the remembered choice (below)
//   PUT  /api/settings/extension-intent   { onDraft?, manualResume?, remembered? } — merged, a bad value refused, never half-stored
//
// ⛔ ONE IMPLEMENTATION. The Draft is routes/apply.js startRun (draftForExtension — mode "auto", never an approvalMode, so
//    it previews and waits for the user's approval like every Draft); the slots are services/draftSlots.js; the résumé is
//    services/extensionResume.js start() — ONCE per (job, base résumé), a live one joined, a made one reused, no second
//    spend. This file only orders them and says the refusals first.
// ⛔ The Draft routes are the extension's own credential only (an auth_contexts row with the extension's user agent), like
//    every /api/extension route; user-triggered only (`trigger: "click"`). The settings are the ACCOUNT's (requireAuth):
//    the extension's Options page writes them, and the web app may later show them — no new browser storage key.
import express from "express";
import { jobOnUsersBoard } from "../services/manualHandoff.js";
import { draftSlots } from "../services/draftSlots.js";
import { createRateLimiter } from "../services/extensionResume.js";

/** ⚠ provisional: a Draft press is one start; 20 in ten minutes is far above a person. Reads: as the résumé routes. */
export const DRAFT_START_LIMIT = Object.freeze({ limit: 20, windowMs: 10 * 60_000 });
export const DRAFT_READ_LIMIT = Object.freeze({ limit: 120, windowMs: 60_000 });

// ── the account's two settings and the remembered choice (migration 168, users.extension_intent) ─────────────────────
//   onDraft       "queue" (default) — When I press Draft: queue the résumé automatically · "ask" — ask me
//   manualResume  "on_cue" (default) — In a manual fill: offer a résumé on cue · "never"
//   remembered    null (default) · "drafted" · "manual" — the answer to the ONE question, kept when "Remember my choice"
//                 was ticked. ⛔ Never inferred from behaviour: only the user's own tick writes it.
export const INTENT_SETTINGS = Object.freeze({
  onDraft: Object.freeze(["queue", "ask"]),
  manualResume: Object.freeze(["on_cue", "never"]),
  remembered: Object.freeze([null, "drafted", "manual"]),
});
export const INTENT_DEFAULTS = Object.freeze({ onDraft: "queue", manualResume: "on_cue", remembered: null });

/** The stored text → the settings, every field defaulted. Pure. */
export function parseIntentSettings(stored) {
  let v = null;
  try { v = stored ? JSON.parse(stored) : null; } catch { v = null; }
  const out = { ...INTENT_DEFAULTS };
  for (const k of Object.keys(INTENT_SETTINGS)) if (v && INTENT_SETTINGS[k].includes(v[k])) out[k] = v[k];
  return out;
}

/** A PUT body merged onto the current settings → { ok, settings } or { ok: false, error } (nothing half-stored). Pure. */
export function mergeIntentSettings(current, body = {}) {
  const next = { ...INTENT_DEFAULTS, ...current };
  for (const k of Object.keys(INTENT_SETTINGS)) {
    if (!(k in (body || {}))) continue;
    if (!INTENT_SETTINGS[k].includes(body[k])) {
      return { ok: false, error: `${k} must be one of ${INTENT_SETTINGS[k].map(x => (x === null ? "null" : x)).join(", ")}` };
    }
    next[k] = body[k];
  }
  return { ok: true, settings: next };
}

export function readIntentSettings(db, userId) {
  try { return parseIntentSettings(db.prepare("SELECT extension_intent FROM users WHERE id = ?").pluck().get(userId)); }
  catch { return { ...INTENT_DEFAULTS }; }   // a database before migration 168: the defaults
}

/** "You have 0 of your 10 drafts left …" — the refusal said BEFORE anything is queued. */
export function slotsRefusal(slots, need) {
  const reset = slots.nextFreeAt ? " The next one frees up 24 hours after the oldest." : "";
  if (slots.remaining <= 0) {
    return { error: "draft_slots_exhausted", slots, need,
      message: `You have 0 of your ${slots.limit} drafts left in the last 24 hours — nothing was queued.${reset}` };
  }
  return { error: "draft_slots_short", slots, need, canDraftOnly: true,
    message: `Drafting this job and queuing its résumé uses ${need} of your drafts; you have ${slots.remaining} of ${slots.limit} left — ` +
      "nothing was queued. You can draft it without the résumé." };
}

export function createExtensionDraftRouter({ db, requireAuth, isExtension, draftForExtension, draftStateOf, runBar, resume,
  startLimit = DRAFT_START_LIMIT, readLimit = DRAFT_READ_LIMIT, now }) {
  const router = express.Router();
  const startOk = createRateLimiter({ ...startLimit, ...(now ? { now } : {}) });
  const readOk = createRateLimiter({ ...readLimit, ...(now ? { now } : {}) });
  const guard = (ok) => (req, res, next) => {
    if (!isExtension(req)) return res.status(403).json({ error: "extension_only", message: "This is for the draft extension." });
    if (!ok(String(req.user.id))) return res.status(429).json({ error: "rate_limited", message: "Too many requests — try again in a minute." });
    next();
  };
  const jobIdOf = (v) => (v != null && v !== "" ? String(v).slice(0, 128) : null);
  const modeOf = (userId) => {
    try { const b = runBar(userId); return { applyMode: b?.mode?.current || "semi", autoLocked: b?.mode?.auto?.locked !== false, held: !!b?.hold?.held }; }
    catch { return { applyMode: "semi", autoLocked: true, held: false }; }
  };
  const peek = (userId, jobId) => { try { return resume.peek(userId, jobId); } catch { return { state: "none", id: null }; } };

  router.get("/api/extension/draft/:jobId", requireAuth, guard(readOk), (req, res) => {
    const jobId = jobIdOf(req.params.jobId);
    if (!jobId || !jobOnUsersBoard(db, req.user.id, jobId)) return res.status(404).json({ error: "not_your_job", message: "That job is not on your board." });
    const d = draftStateOf(req.user.id, jobId);
    res.json({ ok: true, jobId, draft: { drafted: d.drafted, status: d.status, runId: d.runId }, resume: peek(req.user.id, jobId),
      slots: draftSlots(db, req.user.id), ...modeOf(req.user.id), settings: readIntentSettings(db, req.user.id) });
  });

  router.post("/api/extension/draft", requireAuth, guard(startOk), (req, res) => {
    // ⛔ USER-TRIGGERED ONLY: the extension sends `trigger: "click"` from the Draft button's handler and nowhere else.
    if (req.body?.trigger !== "click") return res.status(400).json({ error: "trigger_required", message: "A Draft starts only from its button." });
    const userId = req.user.id;
    const jobId = jobIdOf(req.body?.boundJobId);
    if (!jobId || !jobOnUsersBoard(db, userId, jobId)) return res.status(404).json({ error: "not_your_job", message: "That job is not on your board." });
    const wantResume = req.body?.resume !== false;

    // (5) the job's server state — ⛔ never queued twice; its state is said instead, and nothing is spent.
    const d = draftStateOf(userId, jobId);
    if (d.drafted) {
      return res.status(200).json({ ok: true, already: true, draft: { drafted: true, status: d.status, runId: d.runId },
        resume: peek(userId, jobId), message: "Already drafted — it is in Home, waiting for your review, in progress, or sent. Nothing more was queued." });
    }
    // (6) a résumé already known for (job, base) is reused, one in flight is joined: neither spends a slot.
    const known = wantResume ? peek(userId, jobId) : null;
    const resumeSkipped = !wantResume ? "not_asked" : known.state === "no_base" ? "no_base_resume" : null;
    const need = 1 + (wantResume && known.state === "none" ? 1 : 0);
    // (8) the allowance — said BEFORE anything is queued.
    const slots = draftSlots(db, userId);
    if (slots.remaining < need) return res.status(429).json(slotsRefusal(slots, need));

    const run = draftForExtension(req.user, jobId);
    if (run.status !== 202) return res.status(run.status).json(run.body);
    let generation = null;
    if (wantResume && !resumeSkipped) {
      const g = resume.start(userId, { jobId });
      generation = g.body || null;
    }
    const mode = modeOf(userId);
    return res.status(202).json({
      ok: true,
      draft: { runId: run.body.runId, waiting: !!run.body.waiting, line: run.body.line || null, message: run.body.message || null, held: !!run.body.held },
      resume: generation, resumeSkipped, slots: draftSlots(db, userId), applyMode: mode.applyMode, autoLocked: mode.autoLocked,
    });
  });

  router.get("/api/settings/extension-intent", requireAuth, (req, res) => res.json(readIntentSettings(db, req.user.id)));
  router.put("/api/settings/extension-intent", requireAuth, (req, res) => {
    const merged = mergeIntentSettings(readIntentSettings(db, req.user.id), req.body || {});
    if (!merged.ok) return res.status(400).json({ error: merged.error });
    try { db.prepare("UPDATE users SET extension_intent = ? WHERE id = ?").run(JSON.stringify(merged.settings), req.user.id); }
    catch { return res.status(503).json({ error: "unavailable", message: "Settings could not be saved right now." }); }
    res.json(merged.settings);
  });

  return router;
}

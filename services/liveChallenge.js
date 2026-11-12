// services/liveChallenge.js — ⭐ A186-CAPTCHA (1) · SOLVE IT HERE: when an application meets a VISIBLE bot check (a
// CAPTCHA) after Submit, the worker's browser is NOT closed. The page is kept open for a few minutes and shown live in
// draft — the PERSON solves the check with their own clicks — and the worker continues: it waits for the check to clear,
// reads the confirmation, and records *Sent* only on that evidence.
//
// ⛔ NOTHING HERE SOLVES, BYPASSES OR OUTSOURCES A CHALLENGE (A103; the worklog's A186-CAPTCHA block: no solver library,
// no fingerprint evasion). This module only (a) streams the page's pixels to the run's owner and (b) forwards the
// owner's clicks and keys into that page. The person is the one who answers the check.
//
//   registerChallenge({ runJobId, userId, jobId, page, timeoutMs }) → { waitForOutcome(isDone) } — the worker's side
//   liveSessionFor(runJobId, userId) → a session the owner may watch (null for anyone else)
//   session.subscribe(onFrame) → unsubscribe — Chrome's own screencast (CDP Page.startScreencast), JPEG frames
//   session.input({ type: "click", x, y } | { type: "key", key } | { type: "scroll", dy }) — into the page, in page pixels
//
// One session per run job; at most MAX_LIVE at once (a held browser costs ~150 MB); a session ends on success, on
// timeout, or when the worker gives up — the browser is closed by the worker, never left behind.

const sessions = new Map();   // String(runJobId) -> session
export const MAX_LIVE = 3;
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const VIEWPORT = { width: 1280, height: 900 };

export function liveSessionCount() { return sessions.size; }

/** The owner's view of a live session, or null (unknown, ended, or not theirs). */
export function liveSessionFor(runJobId, userId) {
  const s = sessions.get(String(runJobId));
  return s && String(s.userId) === String(userId) && !s.ended ? s : null;
}

/** Every live session of this person (for the held view's "a quick check is waiting" line). */
export function liveSessionsOf(userId) {
  return [...sessions.values()].filter(s => !s.ended && String(s.userId) === String(userId))
    .map(s => ({ runJobId: s.runJobId, jobId: s.jobId, startedAt: s.startedAt, expiresAt: s.startedAt + s.timeoutMs }));
}

/**
 * The worker's side. Returns null when no live session can be opened (too many open, no CDP) — the caller then ends the
 * run as before (held, with the extension hand-off). `isDone()` is the worker's own check: resolves to
 * "submitted" | "challenge" | "other" each time it is asked.
 */
export async function registerChallenge({ runJobId, userId, jobId, page, timeoutMs = DEFAULT_TIMEOUT_MS, log = () => {} }) {
  if (!page || runJobId == null || userId == null) return null;
  if (sessions.size >= MAX_LIVE || sessions.has(String(runJobId))) return null;
  let cdp;
  try { cdp = await page.createCDPSession(); } catch { return null; }
  const s = {
    runJobId: String(runJobId), userId, jobId: String(jobId ?? ""), page, cdp, timeoutMs,
    startedAt: Date.now(), ended: false, subscribers: new Set(), lastFrame: null, inputs: 0,
  };
  const onFrame = async (ev) => {
    s.lastFrame = { data: ev.data, w: ev.metadata?.deviceWidth || VIEWPORT.width, h: ev.metadata?.deviceHeight || VIEWPORT.height, at: Date.now() };
    for (const fn of s.subscribers) { try { fn(s.lastFrame); } catch { /* a dropped viewer never stops the stream */ } }
    try { await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }); } catch { /* the page closed */ }
  };
  cdp.on("Page.screencastFrame", onFrame);
  try {
    await page.setViewport?.(VIEWPORT).catch(() => {});
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, maxWidth: VIEWPORT.width, maxHeight: VIEWPORT.height, everyNthFrame: 1 });
  } catch { try { await cdp.detach(); } catch {} return null; }

  s.subscribe = (fn) => { s.subscribers.add(fn); if (s.lastFrame) { try { fn(s.lastFrame); } catch {} } return () => s.subscribers.delete(fn); };
  s.input = async (ev) => {
    if (s.ended) return { ok: false, error: "ended" };
    s.inputs++;
    const x = Math.max(0, Math.min(VIEWPORT.width, Number(ev?.x) || 0));
    const y = Math.max(0, Math.min(VIEWPORT.height, Number(ev?.y) || 0));
    try {
      if (ev?.type === "click") {
        for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
          await cdp.send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: type === "mouseMoved" ? 0 : 1 });
        }
      } else if (ev?.type === "scroll") {
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: Math.max(-2000, Math.min(2000, Number(ev.dy) || 0)) });
      } else if (ev?.type === "key" && typeof ev.key === "string" && ev.key.length <= 16) {
        if (ev.key.length === 1) await cdp.send("Input.insertText", { text: ev.key });
        else await page.keyboard.press(ev.key).catch(() => {});
      } else return { ok: false, error: "bad_input" };
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e?.message || e).slice(0, 80) }; }
  };
  const end = async (why) => {
    if (s.ended) return;
    s.ended = true; s.endedWhy = why;
    sessions.delete(s.runJobId);
    for (const fn of s.subscribers) { try { fn(null, why); } catch {} }
    s.subscribers.clear();
    try { await cdp.send("Page.stopScreencast"); } catch {}
    try { await cdp.detach(); } catch {}
  };
  sessions.set(s.runJobId, s);
  log(`live check open for run job ${s.runJobId} (${Math.round(timeoutMs / 1000)} s)`);

  return {
    session: s,
    /** Poll the worker's check until it says submitted, or the time runs out. → "submitted" | "timeout" | "closed" */
    async waitForOutcome(isDone, { everyMs = 1500, onCleared = null } = {}) {
      let clearedOnce = false;
      try {
        while (Date.now() - s.startedAt < timeoutMs) {
          await new Promise(r => setTimeout(r, everyMs));
          if (page.isClosed?.()) return "closed";
          let state = "other";
          try { state = await isDone(); } catch { state = "other"; }
          if (state === "submitted") return "submitted";
          // The check is gone but no confirmation yet: the page may need its Submit pressed again (once).
          if (state === "other" && !clearedOnce && s.inputs > 0 && onCleared) { clearedOnce = true; try { await onCleared(); } catch {} }
        }
        return "timeout";
      } finally {
        await end("done");
      }
    },
  };
}

/** Test support: drop every session (no browser is touched). */
export function _resetLiveChallenges() { sessions.clear(); }

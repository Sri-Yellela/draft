// ── ⭐ T13 + T14 (field report 10-14) · WHAT THIS TAB IS, AND ONE PRESS THAT DOES THE WHOLE CHAIN ─────────────────────
//
// The owner, on Stripe's application page: "opened the application, still have to read the page, still have to capture
// it on every open, still have to click prepare answers, clicking fill and it still fails."
//
// T14 · tabStateFor(tab) is the ONE accessor for "what is this tab" (the OWNER REPORT's TabState): the tab's binding
//   (extension/tabBinding.js, chrome.storage.session) and its job's progress record (extension/progress.js). A tab with
//   no binding whose ADDRESS the job has already been seen at — the same posting or application URL opened in a new tab,
//   or a page under it — is bound on the spot (`via: 'known'`), so the popup shows the job and its progress at once and
//   Fill needs no prior press. ⛔ A local comparison: no page read, no request — D23 ("opening the popup reads nothing
//   and asks the server nothing about the page") holds.
//
// T13 · runFillChain is what ONE press of Fill (the popup's button or Ctrl+Shift+Y) does — and only that press:
//   IDENTIFY and BIND first when this tab is not bound, or is on an address its job is not known at (⭐ BINDING FIRST,
//   owner 10-15 — extension/identify.js) · fill · and when the server says nothing is prepared (or what was prepared has
//   gone off) prepare it and fill — then SAY what it did ("Read this page and prepared your answers. …"). A failed
//   identify binds nothing and prepares nothing; on a bound job the press never ends "Nothing is prepared" (T15).
//   ⛔ Consent is unchanged: the press IS the user's explicit trigger for this one page, as it always was for the fill;
//   no step runs without it, nothing new runs on any site the user has not switched on, and the automatic switches
//   (autoRead.js) call the handoff directly, never this chain — they only remove clicks, never add steps.
//
// The orchestration is pure — every step is injected — so node tests drive it without a browser.

import { bindTab, bindingForTab, knownJobForAddress, addressClaim, atsFactsOf } from './tabBinding.js';
import { progress } from './progress.js';
import { cachedIdentity } from './auth.js';
// ⭐ T24: the intent model (pure) — the tab's path from what the extension holds locally (no read, no request: D23).
import { decidePath, localTells } from './intentModel.js';

/**
 * The tab's state, or null when draft genuinely does not know which job it is. `adopt` (default) binds a tab whose
 * address a job has been seen at. Fields: jobId, title, company, via, boundAt, captured / read / prepared (booleans
 * from the job's progress record), ats (the board's report for a board tab, else { score, band, at, state: 'ready' }),
 * logo, reportPath.
 * ⭐ T24: `mode` ('drafted' · 'manual' · 'view' · null) and `intent` (the board's 'apply' · 'view' · null) — the intent
 * model (intentModel.js decidePath) on the LOCAL tells only: the binding (the board's intent, the path chosen here) and the
 * job's record (drafted here, a fill started). The press-time tells (the page, the server) are the worker's (intent.js).
 */
export async function tabStateFor(tab, { adopt = true } = {}) {
  if (tab?.id == null) return null;
  let b = await bindingForTab(tab).catch(() => null);
  let adopted = false;
  if (!b && adopt && /^https?:/i.test(String(tab.url || ''))) {
    // The records must be THIS account's (a different account connecting clears them; this guards the moment between).
    const owner = await progress.owner().catch(() => null);
    const id = await cachedIdentity().catch(() => null);
    if (!(owner && id?.username && owner !== id.username)) {
      const known = knownJobForAddress(await progress.list({ limit: 50 }).catch(() => []), tab.url);
      if (known) {
        b = await bindTab(tab, { jobId: known.jobId, title: known.title, company: known.company, via: 'known', ats: known.ats })
          .catch(() => null);
        adopted = !!b;
      }
    }
  }
  if (!b) return null;
  const record = await progress.get({ jobId: b.jobId }).catch(() => null);
  const facts = b.ats || atsFactsOf(record?.ats);
  const ats = b.via === 'board' && b.board?.ats ? b.board.ats : facts ? { ...facts, state: 'ready' } : null;
  // ⭐ BINDING FIRST: is THIS address one the bound job is known at (it was captured, read, filled or opened from the
  // board here, or this is a page under one)? Then a press need not identify the page again (T14's no-re-read).
  const atKnownAddress = adopted || (record?.addresses || []).some(a => addressClaim(a, tab.url) > 0);
  const path = decidePath({ ...localTells({ binding: b, record }), asked: true });
  return {
    jobId: b.jobId, title: b.title || record?.title || null, company: b.company || record?.company || null,
    via: b.via, boundAt: b.boundAt ?? null, atKnownAddress,
    captured: !!record?.captured?.at, read: !!record?.read?.at, prepared: !!record?.prepared?.at,
    ats, logo: b.board?.logo || null, reportPath: b.board?.reportPath || null,
    mode: path.mode, intent: path.intent,
  };
}

/** One of THIS extension's own pages (the popup, Options) — by its address, as boardOpen.js checks it. */
const fromExtensionPage = (sender) => typeof sender?.url === 'string'
  && sender.url.startsWith(chrome.runtime.getURL(''))
  && (sender.id == null || sender.id === chrome.runtime.id);

export const handlers = Object.freeze({
  /**
   * The popup, on open: what the ACTIVE tab is — bound, or bound now because its address is one its job was seen at.
   * ⛔ The extension's own records only: no page read, no request (D23). A web page never asks.
   */
  TAB_STATE: async (_msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    let tab = null;
    try { tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0] || null; } catch { tab = null; }
    return { ok: true, state: tab ? await tabStateFor(tab).catch(() => null) : null };
  },
});

// ── T13 · the chain ────────────────────────────────────────────────────────────────────────────────────────────────

/** The server said nothing is prepared for this job here, or what was prepared has gone off: Prepare clears it. */
export function needsPrepare(r) {
  if (!r || r.ok) return false;
  return r.canPrepare === true || ['prepare', 'stale', 'packet_stale'].includes(r.reason);
}
/**
 * ⭐ T15 · on a BOUND job, a fill that found no packet for this page is never the end: an older server's plain "nothing
 * fills this origin" (`origin_mismatch`, no state) is prepared for too. Prepare then says the truth if the page is not
 * one of the job's addresses — it never fills anywhere it may not.
 */
const PREPARE_WHEN_BOUND = new Set(['origin_mismatch']);
/** A released token that expired between the mint and the exchange: one fresh attempt clears it (T5). */
const RETRY_ONCE = new Set(['token_expired']);
/**
 * BINDING FIRST (a): the outcomes of an identify that name NO job — a bound tab keeps its binding through them (Workday's
 * sign-in, a step whose page reads as no posting). A page naming ANOTHER job rebinds (identify did); "draft could not
 * ask" (signed out, unreachable) stops the press whatever the binding.
 */
const KEEPS_BINDING = new Set(['not_a_job', 'unread', 'not_on_board']);

/** "Read this page and prepared your answers." — what the press did before the fill's own sentence. */
export function chainLead(did = []) {
  const read = did.includes('read'), prepared = did.includes('prepared');
  if (read && prepared) return 'Read this page and prepared your answers.';
  if (read) return 'Read this page.';
  if (prepared) return 'Prepared your answers.';
  return '';
}

/** The fill's sentence, led by what the press did — and, on a page with no form, where the prepared answers wait. */
export function chainMessage(did, r) {
  const parts = [chainLead(did), r?.message || ''];
  if (r && !r.ok && r.reason === 'no_form' && (did.includes('prepared') || r.prepared)) {
    parts.push('Your answers are prepared — open the application form and press Fill there.');
  }
  return parts.filter(Boolean).join(' ').trim();
}

/**
 * ONE press of Fill. Steps (each injected, each may throw — a throw becomes a plain failure):
 *   state()    → the tab's state (tabStateFor — binds a known address), or null
 *   identify() → BINDING FIRST (identify.js identifyAndBind): which job this page is, bound BEFORE anything else —
 *                { outcome, bind, job, message, action }
 *   fill()     → the handoff (gated-handoff.js runGatedHandoff)
 *   prepare()  → Prepare and fill (gated-handoff.js prepareAndFill)
 * Order: identify (only when the tab is not bound, or its address is not one the bound job is known at) → fill →
 * prepare-and-fill when nothing (fresh) is prepared. ⛔ A failed identify binds nothing and prepares nothing: the press
 * ends with the outcome's own sentence and action. ⛔ T15: on a bound job the press never ends "Nothing is prepared".
 * Returns the fill's result with `did` (['read', 'prepared'] — what ran before or around it), `identity` (when it ran)
 * and its sentence led by what it did.
 */
export async function runFillChain({ state, identify, fill, prepare }) {
  const did = [];
  const safe = async (fn, fallback) => { try { return (await fn()) ?? fallback; } catch { return fallback; } };
  const known = await safe(state, null);
  let identity = null;
  if (!(known?.jobId != null && known.atKnownAddress)) {
    identity = await safe(identify, { outcome: 'unavailable', bind: false, job: null, action: 'retry',
      message: "draft couldn't tell which job this is — nothing was filled." });
    did.push('read');
    const namesAnother = identity.job?.jobId != null && known?.jobId != null && String(identity.job.jobId) !== String(known.jobId);
    const keeps = known?.jobId != null && !identity.bind && KEEPS_BINDING.has(identity.outcome) && !namesAnother;
    if (!identity.bind && !keeps) {
      return { ok: false, reason: identity.outcome, action: identity.action || null, identity, did, filled: [],
               fillMessage: null, message: identity.message || "draft couldn't tell which job this is — nothing was filled." };
    }
  }
  const bound = known?.jobId != null || !!identity?.bind;
  let r = await safe(fill, { ok: false, message: 'Could not fill this page.' });
  if ((needsPrepare(r) || (bound && r && !r.ok && PREPARE_WHEN_BOUND.has(r.reason))) && !did.includes('prepared')) {
    r = await safe(prepare, { ok: false, message: 'Could not prepare this application.' });
    did.push('prepared');
  } else if (r && !r.ok && RETRY_ONCE.has(r.reason)) {
    r = await safe(fill, r);
  }
  r = r || { ok: false, message: 'Could not fill this page.' };
  return { ...r, did, ...(identity ? { identity } : {}), fillMessage: r.message || null, message: chainMessage(did, r) };
}

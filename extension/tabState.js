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
//   read the page if this tab does not know its job · fill · and when the server says nothing is prepared (or what was
//   prepared has gone off) prepare it and fill — then SAY what it did ("Read this page and prepared your answers. …").
//   ⛔ Consent is unchanged: the press IS the user's explicit trigger for this one page, as it always was for the fill;
//   no step runs without it, nothing new runs on any site the user has not switched on, and the automatic switches
//   (autoRead.js) call the handoff directly, never this chain — they only remove clicks, never add steps.
//
// The orchestration is pure — every step is injected — so node tests drive it without a browser.

import { bindTab, bindingForTab, knownJobForAddress, atsFactsOf } from './tabBinding.js';
import { progress } from './progress.js';
import { cachedIdentity } from './auth.js';

/**
 * The tab's state, or null when draft genuinely does not know which job it is. `adopt` (default) binds a tab whose
 * address a job has been seen at. Fields: jobId, title, company, via, boundAt, captured / read / prepared (booleans
 * from the job's progress record), ats (the board's report for a board tab, else { score, band, at, state: 'ready' }),
 * logo, reportPath.
 */
export async function tabStateFor(tab, { adopt = true } = {}) {
  if (tab?.id == null) return null;
  let b = await bindingForTab(tab).catch(() => null);
  if (!b && adopt && /^https?:/i.test(String(tab.url || ''))) {
    // The records must be THIS account's (a different account connecting clears them; this guards the moment between).
    const owner = await progress.owner().catch(() => null);
    const id = await cachedIdentity().catch(() => null);
    if (!(owner && id?.username && owner !== id.username)) {
      const known = knownJobForAddress(await progress.list({ limit: 50 }).catch(() => []), tab.url);
      if (known) {
        b = await bindTab(tab, { jobId: known.jobId, title: known.title, company: known.company, via: 'known', ats: known.ats })
          .catch(() => null);
      }
    }
  }
  if (!b) return null;
  const record = await progress.get({ jobId: b.jobId }).catch(() => null);
  const facts = b.ats || atsFactsOf(record?.ats);
  const ats = b.via === 'board' && b.board?.ats ? b.board.ats : facts ? { ...facts, state: 'ready' } : null;
  return {
    jobId: b.jobId, title: b.title || record?.title || null, company: b.company || record?.company || null,
    via: b.via, boundAt: b.boundAt ?? null,
    captured: !!record?.captured?.at, read: !!record?.read?.at, prepared: !!record?.prepared?.at,
    ats, logo: b.board?.logo || null, reportPath: b.board?.reportPath || null,
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
/** A released token that expired between the mint and the exchange: one fresh attempt clears it (T5). */
const RETRY_ONCE = new Set(['token_expired']);

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
 *   state()   → the tab's state (tabStateFor — binds a known address), or null
 *   read()    → "Read this page" (background.js popupContext — which also prepares): { prepared?: boolean } | null
 *   fill()    → the handoff (gated-handoff.js runGatedHandoff)
 *   prepare() → Prepare and fill (gated-handoff.js prepareAndFill)
 * Returns the fill's result with `did` (['read', 'prepared'] — what ran before or around it) and its sentence led by it.
 */
export async function runFillChain({ state, read, fill, prepare }) {
  const did = [];
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };
  const known = await safe(state, null);
  if (!known) {
    const ctx = await safe(read, null);
    did.push('read');
    if (ctx?.prepared) did.push('prepared');
  }
  let r = await safe(fill, { ok: false, message: 'Could not fill this page.' });
  if (needsPrepare(r) && !did.includes('prepared')) {
    r = await safe(prepare, { ok: false, message: 'Could not prepare this application.' });
    did.push('prepared');
  } else if (r && !r.ok && RETRY_ONCE.has(r.reason)) {
    r = await safe(fill, r);
  }
  r = r || { ok: false, message: 'Could not fill this page.' };
  return { ...r, did, fillMessage: r.message || null, message: chainMessage(did, r) };
}

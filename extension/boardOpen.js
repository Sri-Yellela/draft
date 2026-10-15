// ── D99 J11 · THE BOARD HANDS A JOB TO THE EXTENSION — the service worker's half ───────────────────────────────────
//
// Owner, 10-13 (a job opened FROM the draft board): "the job is already on draft, and yet the extension doesn't read
// it … We should not reverse-engineer what the extension should know — a job from the board is on the board."
//
//   draft's page ──postMessage──► boardBridge.js (content script, jobsviadraft.com ONLY) ──OPEN_JOB──► here
//                                                                                                  │
//        GET /api/extension/job/:id (the extension's own token, boardJob.js) ◄───────────────────────┘
//        → the server says whether the job is on THIS user's board, and gives the address, the card and the report
//        → chrome.tabs.create(that address) — no `tabs` permission is needed to open a tab
//        → bindTab(the new tab, via 'board') — D96's tab-sticky binding, which then follows the tab through every stage
//
// ⛔ THE ADDRESS THE PAGE SENT IS NEVER TRUSTED. The message carries a job id only; the tab opens the address the SERVER
//    returned for a job it confirmed — a forged or another user's id opens nothing (the page then opens its own link).
// ⛔ ONLY FROM DRAFT'S OWN PAGE: a top-frame content script of this extension, on draft's origin. Rate-limited.
// ⛔ Nothing about the employer's page is read or sent; the tab is opened and bound, and the popup shows it.

import { lookupBoardJob } from './boardJob.js';
import { bindTab, bindingForTab } from './tabBinding.js';
import { noteAddress } from './progress.js';   // T14: the address the board opened is one this job is known at

let SERVER_URL = null;
export function configureBoardOpen({ serverUrl } = {}) { SERVER_URL = serverUrl || null; }

export const OPEN_LIMIT = Object.freeze({ limit: 10, windowMs: 60_000 });
let hits = [];
function allowed(now = Date.now()) {
  hits = hits.filter(t => now - t < OPEN_LIMIT.windowMs);
  if (hits.length >= OPEN_LIMIT.limit) return false;
  hits.push(now);
  return true;
}
/** Tests only. */
export function resetBoardOpenLimit() { hits = []; }

const originOf = (u) => { try { return new URL(u).origin; } catch { return null; } };

/** One of THIS extension's own pages (the popup) — by its address, not by "has no tab" (J13: Options runs in a tab). */
const fromExtensionPage = (sender) => typeof sender?.url === 'string'
  && sender.url.startsWith(chrome.runtime.getURL(''))
  && (sender.id == null || sender.id === chrome.runtime.id);

/** A top-frame content script of THIS extension, on draft's own origin. */
export function fromDraftPage(sender, serverUrl = SERVER_URL) {
  const draft = originOf(serverUrl);
  return !!draft && sender?.tab?.id != null && (sender.frameId == null || sender.frameId === 0)
    && (sender.id == null || sender.id === chrome.runtime.id)
    && originOf(sender.url) === draft && originOf(sender.tab.url || sender.url) === draft;
}

export const handlers = Object.freeze({
  /** From boardBridge.js: open this board job in a new tab and bind it. */
  OPEN_JOB: async (msg, sender) => {
    if (!SERVER_URL || !fromDraftPage(sender)) return { ok: false, error: 'not_allowed' };
    if (msg?.via !== 'board') return { ok: false, error: 'not_allowed' };
    if (!allowed()) return { ok: false, error: 'rate_limited' };
    const found = await lookupBoardJob(SERVER_URL, msg.jobId);
    if (!found.ok) return { ok: false, error: found.error };
    if (!found.job.url) return { ok: false, error: 'no_address' };   // draft holds no https address: the page opens its own
    let tab;
    try {
      tab = await chrome.tabs.create({ url: found.job.url, active: true, openerTabId: sender.tab.id,
        ...(Number.isInteger(sender.tab.index) ? { index: sender.tab.index + 1 } : {}) });
    } catch { return { ok: false, error: 'tab_failed' }; }
    if (!tab?.id) return { ok: false, error: 'tab_failed' };
    // tab.url is not readable here (no `tabs` permission): the address is the one just opened.
    await bindTab({ id: tab.id, url: found.job.url }, {
      jobId: found.job.jobId, title: found.job.title, company: found.job.company, via: 'board',
      board: { logo: found.job.logo, reportPath: found.job.reportPath, ats: found.ats, at: Date.now() },
    }).catch(() => null);
    await noteAddress(found.job.jobId, found.job.url, { title: found.job.title, company: found.job.company });
    return { ok: true };
  },

  /**
   * The popup, on open: the ACTIVE tab's binding when the board opened it. The extension's own record — no page read
   * and no request, so D23 ("opening the popup reads nothing") holds.
   */
  BOARD_TAB: async (_msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };   // the popup asks; a web page never can
    let tab = null;
    try { tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0] || null; } catch { tab = null; }
    const b = tab ? await bindingForTab(tab).catch(() => null) : null;
    if (!b || b.via !== 'board') return { ok: true, board: null };
    return { ok: true, board: { jobId: b.jobId, title: b.title, company: b.company, via: 'board', boundAt: b.boundAt,
                                reportPath: b.board?.reportPath || null, ats: b.board?.ats || null } };
  },
});

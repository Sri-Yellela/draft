// extension/globalRead.js — ⭐⭐ D112 item 4 (T35 = A) + b2 · THE ONE GLOBAL-READ ASK: a small window that closes itself.
//
// Owner 10-30: "T35, we will go for global read … no clicks needed". Design call b2 (picked 10-30 night): the ask is a
// small EXTENSION window over the posting — "Let draft read job postings on any site?" · Allow / Not now, with the
// no-posting-sends-nothing line. Allow raises Chrome's own prompt from that window's press (an extension page's click:
// the only place Chrome lets a host permission be asked — a web page and the dock cannot); on EITHER answer the window
// closes and focus returns to the posting tab, where the dock appears. It replaces the Settings-tab trip (A105 (10):
// DOCK_ACT 'allow-site' opened options.html#permissions in a new tab).
//
//   · openGlobalAsk(tab) — the toolbar press (only while the ask is DUE: never answered, global read off) and the
//     dock's Allow (always — the person pressed it). ONE window at a time; a second press focuses it.
//   · GLOBAL_ASK_ANSWER — the window's answer: 'allow' (Chrome granted — consentGlobal records it), 'refused' (Chrome's
//     prompt said no) or 'later' (Not now — ⛔ no prompt at all). Recorded in the autoRead settings (one key, no new
//     storage key — D23), so it is asked ONCE. Then the window is closed and the posting tab focused.
//   · the window closed with its own ✕: focus returns too; nothing is recorded (the next press may ask again).
//
// No `chrome` at the top level: node tests import it with a fake chrome (test/d112GlobalRead.test.js).
import { GLOBAL_ORIGINS, GLOBAL_ASK_ANSWERS, loadSettings, globalActive, globalAskDue, consentGlobal, recordGlobalAsk } from './autoRead.js';

export const ASK_PAGE = 'global-ask.html';
export const ASK_SIZE = Object.freeze({ width: 440, height: 360 });

// ⭐ The window's words — written from what the code does (autoRead.js GLOBAL_SWITCHES, jobSignals.js, NEVER_HOSTS).
export const GLOBAL_ASK = Object.freeze({
  title: 'Let draft read job postings on any site?',
  lead: 'draft reads a job posting the moment you open it — on any careers site — and adds it to your board if it fits. ' +
    'No click needed after this.',
  points: Object.freeze([
    'A posting that does not fit your board is discarded and not stored.',
    "On an application form it reads the questions — never what you type, and never a password or payment field.",
    'Never on LinkedIn, Indeed or Glassdoor. It never fills a form or submits anything by itself.',
    'Settings → Permissions turns it off at any time and gives the access back.',
  ]),
  promise: 'A page that is not a job posting sends nothing — not its address, not a hash.',
  allow: 'Allow',
  later: 'Not now',
  asking: 'Chrome will ask you once, for every site.',
  refused: 'Chrome did not allow it — nothing changed.',
});

let ASK = null;   // { windowId, tabId } — the one window open, in the worker's memory only
/** The window open now, if any (tests). */
export function askWindow() { return ASK ? { ...ASK } : null; }

const granted = () => chrome.permissions.contains({ origins: [...GLOBAL_ORIGINS] }).catch(() => false);

/**
 * Open the ask over `tab`. `force`: the person pressed an Allow (asked whatever the earlier answer). Not forced, it opens
 * only while the ask is due. → { ok, opened, windowId? , already?, asked?, focused? }
 */
export async function openGlobalAsk(tab, { force = false } = {}) {
  if (!tab?.id) return { ok: false, opened: false };
  const s = await loadSettings();
  if (globalActive(s) && await granted()) return { ok: true, opened: false, already: true };
  if (!force && !globalAskDue(s)) return { ok: true, opened: false, asked: true };
  if (s.kill && !force) return { ok: true, opened: false, asked: true };
  if (ASK) {
    try { await chrome.windows.update(ASK.windowId, { focused: true }); ASK.tabId = tab.id; return { ok: true, opened: false, focused: true }; }
    catch { ASK = null; }
  }
  const place = {};
  try {
    const w = await chrome.windows.get(tab.windowId);
    if (Number.isFinite(w?.left) && Number.isFinite(w?.width)) {
      place.left = Math.max(0, Math.round(w.left + (w.width - ASK_SIZE.width) / 2));
      place.top = Math.max(0, Math.round((w.top || 0) + 96));
    }
  } catch { /* Chrome places it */ }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(`global-ask.html?tab=${encodeURIComponent(tab.id)}`), type: 'popup', focused: true,
    width: ASK_SIZE.width, height: ASK_SIZE.height, ...place,
  });
  ASK = { windowId: win?.id ?? null, tabId: tab.id };
  return { ok: true, opened: true, windowId: ASK.windowId };
}

/** Close the ask window and give focus back to the posting tab (its window first, then the tab). */
async function closeAndReturn(ask) {
  ASK = null;
  if (ask?.windowId != null) { try { await chrome.windows.remove(ask.windowId); } catch { /* already closed */ } }
  return returnFocus(ask?.tabId);
}
async function returnFocus(tabId) {
  if (!Number.isInteger(tabId)) return { focused: false };
  const t = await chrome.tabs.get(tabId).catch(() => null);
  if (!t) return { focused: false };
  try { if (t.windowId != null) await chrome.windows.update(t.windowId, { focused: true }); } catch { /* gone */ }
  try { await chrome.tabs.update(t.id, { active: true }); } catch { /* gone */ }
  return { focused: true, tabId: t.id };
}

const fromAskPage = (sender) => typeof sender?.url === 'string'
  && sender.url.startsWith(chrome.runtime.getURL(ASK_PAGE))
  && (sender.id == null || sender.id === chrome.runtime.id);

/** chrome.windows.onRemoved: the ask closed with its own ✕ — focus goes back, nothing is recorded. */
export async function onWindowRemoved(windowId) {
  if (!ASK || ASK.windowId !== windowId) return { ours: false };
  const ask = ASK;
  ASK = null;
  return { ours: true, ...(await returnFocus(ask.tabId)) };
}

export const handlers = Object.freeze({
  /** The window's answer. ⛔ From the ask page only. */
  GLOBAL_ASK_ANSWER: async (msg, sender) => {
    if (!fromAskPage(sender)) return { ok: false, error: 'not_allowed' };
    const answer = msg?.answer;
    if (!GLOBAL_ASK_ANSWERS.includes(answer)) return { ok: false, error: 'bad_answer' };
    const tabId = Number.isInteger(ASK?.tabId) ? ASK.tabId : Number.parseInt(msg?.tabId, 10);
    const ask = { windowId: ASK?.windowId ?? sender?.tab?.windowId ?? null, tabId: Number.isInteger(tabId) ? tabId : null };
    let result;
    if (answer === 'allow') {
      // Chrome's grant is the answer that counts: a claimed 'allow' with no grant is a refusal
      result = await consentGlobal();
      if (!result.ok) result = { ...(await recordGlobalAsk('refused')), refused: true };
    } else {
      result = await recordGlobalAsk(answer);
    }
    const back = await closeAndReturn(ask);
    return { ok: true, answer: result.refused ? 'refused' : answer, global: !!result.settings?.global, focused: !!back.focused, injected: result.injected || [] };
  },
});

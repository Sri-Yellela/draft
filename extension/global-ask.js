// extension/global-ask.js — ⭐ D112 b2 · the ask window's page (global-ask.html). Its two buttons:
//   Allow   → ⛔ chrome.permissions.request({ origins: GLOBAL_ORIGINS }) is the click's FIRST call, synchronous, inside
//             the gesture (the only way Chrome shows its prompt); then, in the same turn, the click is said to the worker
//             (AUTO_READ_PENDING 'global' — T20's lesson: a page can die at the prompt); then Chrome's answer goes to the
//             worker (GLOBAL_ASK_ANSWER), which records it, closes this window and focuses the posting tab.
//   Not now → ⛔ no prompt: GLOBAL_ASK_ANSWER 'later' only. The window closes the same way.
import { GLOBAL_ASK } from './globalRead.js';
import { GLOBAL_ORIGINS } from './autoRead.js';

const send = (api, msg) => { try { return Promise.resolve(api.runtime.sendMessage(msg)).catch(() => null); } catch { return Promise.resolve(null); } };

/** Allow — the request first, inside the gesture. → Promise<{ granted, reply }> */
export function onAllow(api, tabId) {
  const asked = api.permissions.request({ origins: [...GLOBAL_ORIGINS] });   // ⛔ first: inside the gesture
  void send(api, { type: 'AUTO_READ_PENDING', kind: 'global' });
  return (async () => {
    let granted = false;
    try { granted = !!(await asked); } catch { granted = false; }
    const reply = await send(api, { type: 'GLOBAL_ASK_ANSWER', answer: granted ? 'allow' : 'refused', tabId });
    return { granted, reply };
  })();
}
/** Not now — no prompt. */
export function onNotNow(api, tabId) {
  return send(api, { type: 'GLOBAL_ASK_ANSWER', answer: 'later', tabId }).then(reply => ({ granted: false, reply }));
}

/** Fill the page's words and wire its buttons. `search`: the page's query (?tab=<the posting tab's id>). */
export function mount(doc, api, search = '', win = null) {
  const $ = (id) => doc.getElementById(id);
  if (!$('ask-allow')) return null;
  const tabId = Number.parseInt(new URLSearchParams(search).get('tab') || '', 10);
  $('ask-title').textContent = GLOBAL_ASK.title;
  $('ask-lead').textContent = GLOBAL_ASK.lead;
  const list = $('ask-points');
  for (const p of GLOBAL_ASK.points) { const li = doc.createElement('li'); li.textContent = p; list.append(li); }
  $('ask-promise').textContent = GLOBAL_ASK.promise;
  $('ask-allow').textContent = GLOBAL_ASK.allow;
  $('ask-later').textContent = GLOBAL_ASK.later;
  $('ask-status').textContent = GLOBAL_ASK.asking;
  const buttons = [$('ask-allow'), $('ask-later')];
  // the worker closes this window; if it could not (it was restarting), the page closes itself
  const finish = (r) => { if (!r?.reply?.ok) { if (r && !r.granted && r.reply == null) $('ask-status').textContent = GLOBAL_ASK.refused; try { win?.close?.(); } catch { /* closed */ } } return r; };
  $('ask-allow').addEventListener('click', () => {
    const p = onAllow(api, Number.isInteger(tabId) ? tabId : null);   // ⛔ first: inside the gesture
    buttons.forEach(b => { b.disabled = true; });
    void p.then(finish).catch(() => null);
  });
  $('ask-later').addEventListener('click', () => {
    buttons.forEach(b => { b.disabled = true; });
    void onNotNow(api, Number.isInteger(tabId) ? tabId : null).then(finish).catch(() => null);
  });
  return { tabId };
}

if (typeof document !== 'undefined' && typeof chrome !== 'undefined') mount(document, chrome, location.search, window);

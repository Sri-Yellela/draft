// extension/apply-away.js — ⭐⭐ D112 item 7 · the "apply here while you're away" ask window's page (apply-away.html).
// Its two buttons:
//   Allow and connect → ⛔ chrome.permissions.request({ permissions: ['cookies'], origins: <the family's own> }) is the
//                       click's FIRST call, synchronous, inside the gesture (the only way Chrome shows its prompt — the
//                       dock, in a web page, cannot ask); then Chrome's answer goes to the worker (APPLY_AWAY_ANSWER),
//                       which checks the grant itself, connects (mint → verify against the PINNED identity → read the
//                       family's cookies → seal → upload ciphertext), closes this window and shows the result on the tab.
//   Not now           → ⛔ no prompt, nothing read: APPLY_AWAY_ANSWER 'later' only. The window closes the same way.
// The family comes from the page's query only to WORD the window and name the hosts asked for; the worker connects the
// family of the TAB'S own address (applyAway.js connectAway), never this page's say-so.
import { APPLY_AWAY_FAMILIES, awayPermission, awayWords } from './applyAway.js';

const send = (api, msg) => { try { return Promise.resolve(api.runtime.sendMessage(msg)).catch(() => null); } catch { return Promise.resolve(null); } };

/** Allow — the request first, inside the gesture. → Promise<{ granted, reply }> */
export function onAllow(api, tabId, family) {
  const asked = api.permissions.request(awayPermission(family));   // ⛔ first: inside the gesture
  return (async () => {
    let granted = false;
    try { granted = !!(await asked); } catch { granted = false; }
    // a refusal is answered as 'later': nothing is read either way
    const reply = await send(api, { type: 'APPLY_AWAY_ANSWER', answer: granted ? 'allow' : 'later', tabId });
    return { granted, reply };
  })();
}
/** Not now — no prompt. */
export function onNotNow(api, tabId) {
  return send(api, { type: 'APPLY_AWAY_ANSWER', answer: 'later', tabId }).then(reply => ({ granted: false, reply }));
}

/** Fill the page's words and wire its buttons. `search`: ?tab=<the portal tab's id>&family=<ats>. */
export function mount(doc, api, search = '', win = null) {
  const $ = (id) => doc.getElementById(id);
  if (!$('ask-allow')) return null;
  const q = new URLSearchParams(search);
  const tabId = Number.parseInt(q.get('tab') || '', 10);
  const family = APPLY_AWAY_FAMILIES.find(f => f.ats === q.get('family'));
  if (!family) { try { win?.close?.(); } catch { /* closed */ } return null; }
  const w = awayWords(family);
  $('ask-title').textContent = w.title;
  $('ask-lead').textContent = w.lead;
  const list = $('ask-points');
  for (const p of w.points) { const li = doc.createElement('li'); li.textContent = p; list.append(li); }
  $('ask-promise').textContent = w.promise;
  $('ask-allow').textContent = w.allow;
  $('ask-later').textContent = w.later;
  $('ask-status').textContent = w.asking;
  const buttons = [$('ask-allow'), $('ask-later')];
  const tid = Number.isInteger(tabId) ? tabId : null;
  // the worker closes this window; if it could not (it was restarting), the page says so and closes itself
  const finish = (r) => { if (!r?.reply?.ok) { if (r && !r.granted) $('ask-status').textContent = w.refused; try { win?.close?.(); } catch { /* closed */ } } return r; };
  $('ask-allow').addEventListener('click', () => {
    const p = onAllow(api, tid, family);   // ⛔ first: inside the gesture
    buttons.forEach(b => { b.disabled = true; });
    void p.then(finish).catch(() => null);
  });
  $('ask-later').addEventListener('click', () => {
    buttons.forEach(b => { b.disabled = true; });
    void onNotNow(api, tid).then(finish).catch(() => null);
  });
  return { tabId: tid, family: family.ats };
}

if (typeof document !== 'undefined' && typeof chrome !== 'undefined') mount(document, chrome, location.search, window);

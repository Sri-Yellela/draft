/**
 * ⭐ D112 b2 · THE ONE GLOBAL-READ ASK — the real extension, a real press, a real popup window (extension/globalRead.js).
 *   npm run walk:extension -- globalAsk
 *
 *   1. a posting, the ask never answered → the press opens the dock AND a small extension window over it
 *      (chrome.windows.create type 'popup', global-ask.html): "Let draft read job postings on any site?" · Allow / Not now,
 *      with the no-posting-sends-nothing line
 *   2. Not now, the person's click in that window → ⛔ no Chrome prompt; the window CLOSES by itself, and the posting tab
 *      is the active tab of the focused window again
 *   3. the press again → no window: the ask is made ONCE
 * (Allow raises Chrome's own prompt, which no headless browser can answer — the unit half, test/d112GlobalRead.test.js,
 * drives Allow with Chrome's answer faked.) Synthetic person (Ada Example) throughout.
 */
import { POSTING, waitUntil, sleep } from '../extensionBrowser.mjs';

export const description = 'D112 b2: the first press asks once, in a small window that closes itself; focus returns to the posting';
export const options = { globalAsk: 'due' };

const askTargets = (h) => h.browser.targets().filter(t => t.url().includes('/global-ask.html'));

export default async function run(h, { check, observe, section }) {
  section('1 · a posting, never asked — the press opens the dock and the ask window over it');
  await h.open(POSTING, { settle: 600 });
  const press1 = await h.send({ type: 'TOOLBAR_PRESS' });
  observe('the press', press1);
  check('the press opened the dock and asked', press1?.did === 'opened' && press1?.asked === true, JSON.stringify(press1));
  const target = await waitUntil(() => askTargets(h)[0] || null, 8000, 200);
  check('a window with global-ask.html opened', !!target, String(target?.url?.() || ''));
  if (!target) return;
  const win = await h.control.evaluate(async () => (await chrome.windows.getAll({ windowTypes: ['popup'] })).map(w => ({ type: w.type, width: w.width, height: w.height })));
  observe('the popup windows', win);
  check('…a small popup window', win.length === 1 && win[0].type === 'popup' && win[0].width <= 480, JSON.stringify(win));
  const ask = await target.page();
  await waitUntil(() => ask.evaluate(() => document.getElementById('ask-title')?.textContent || null), 4000, 100);
  const words = await ask.evaluate(() => ({ title: document.getElementById('ask-title')?.textContent, promise: document.getElementById('ask-promise')?.textContent,
    allow: document.getElementById('ask-allow')?.textContent, later: document.getElementById('ask-later')?.textContent }));
  observe('the ask', words);
  check('"Let draft read job postings on any site?" · Allow / Not now · the no-posting line', words.title === 'Let draft read job postings on any site?'
    && words.allow === 'Allow' && words.later === 'Not now' && /sends nothing — not its address, not a hash/.test(words.promise || ''), JSON.stringify(words));

  section('2 · Not now — no prompt; the window closes; the posting tab has the focus again');
  await ask.click('#ask-later');
  const gone = await waitUntil(() => (askTargets(h).length === 0 ? true : null), 8000, 200);
  check('the window closed by itself', gone === true);
  const granted = await h.control.evaluate(() => chrome.permissions.contains({ origins: ['https://*/*'] }));
  check('…and nothing was granted (no prompt was raised)', granted === false);
  const focus = await h.control.evaluate(async () => {
    const w = await chrome.windows.getLastFocused({ populate: true });
    return { type: w.type, active: (w.tabs || []).find(t => t.active)?.url || null };
  });
  observe('the focused window', focus);
  check('the posting tab is the active tab of the focused window', focus.type === 'normal' && String(focus.active || '').startsWith(POSTING.split('?')[0]), JSON.stringify(focus));
  const answer = await h.control.evaluate(async () => (await chrome.storage.local.get('autoRead'))?.autoRead?.globalAsk?.answer || null);
  check('"Not now" is recorded (so it is asked once)', answer === 'later', String(answer));

  section('3 · the press again — no window: asked ONCE');
  await sleep(300);
  await h.send({ type: 'TOOLBAR_PRESS' });   // closes the dock
  const press3 = await h.send({ type: 'TOOLBAR_PRESS' });   // opens it again
  await sleep(1200);
  check('no second window', askTargets(h).length === 0 && !press3?.asked, JSON.stringify(press3));
}

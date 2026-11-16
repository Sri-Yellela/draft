/**
 * D99 J13 · THE CONSENT SWITCH — "the boxes to agree to auto-read can't be ticked" (owner, 10-13).
 * ============================================================================================
 *   npm run walk:extension -- optionsConsent
 *
 * The REAL Options page, opened the way Chrome opens `options_page` — IN A TAB (h.control). Before J13 the service
 * worker refused every message from a sender with a tab, so "I agree" answered "Could not record that." and every
 * switch stayed disabled. This pass: the table loads, "I agree" is recorded, the switches become enabled and
 * keyboard-focusable. ⚠ It stops before Chrome's own permission prompt, which a headless browser cannot answer.
 */
import { waitUntil } from '../extensionBrowser.mjs';

export const description = 'Options in a tab: "I agree" is recorded and the per-site switches can be ticked';

export default async function run(h, { check, section }) {
  const p = h.control;
  // 46p: since D191's disclosure (46o), a fresh install opens notice.html as the ACTIVE tab — the Options tab behind it is
  // hidden, and puppeteer's waits there stalled to the 180 s protocol timeout. The person would be looking at Options.
  await p.bringToFront();
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#auto-sites-body input[type=checkbox]');

  section('1 · before consent');
  const before = await p.$$eval('#auto-sites-body input[type=checkbox]', bs => bs.map(b => b.disabled));
  check('the table drew every switch', before.length >= 20, `${before.length} switches`);
  check('every switch is disabled before "I agree"', before.every(Boolean));

  section('2 · "I agree"');
  await p.click('#auto-agree');
  const said = await waitUntil(() => p.$eval('#auto-status', e => e.textContent.trim() || null), 5000);
  check('the consent is recorded — not "Could not record that."', /Thank you/.test(said || ''), said);
  const agreed = await waitUntil(() => p.$eval('#auto-agreed', e => e.textContent.trim() || null), 5000);
  check('the page says when the user agreed', /You agreed on/.test(agreed || ''), agreed);
  check('"I agree" is hidden once agreed', await p.$eval('#auto-agree', b => b.hidden));

  section('3 · the switches');
  const after = await p.$$eval('#auto-sites-body input[type=checkbox]', bs => bs.map(b => b.disabled));
  check('every switch is enabled after "I agree"', after.every(d => !d), `${after.filter(d => d).length} still disabled`);
  await p.focus('#auto-sites-body input[type=checkbox]');
  const focused = await p.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  check('a switch takes keyboard focus, with its label', /automatically on/.test(focused || ''), focused);

  section('4 · the stored consent');
  const local = await h.storage.local();
  check('chrome.storage holds the consent, scope all', local?.autoRead?.consent?.scope === 'all');
}

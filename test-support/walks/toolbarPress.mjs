/**
 * T31 · THE TOOLBAR PRESS — the real extension on the fixture: the toolbar icon is the dock's toggle, and the page is
 * told only what it needs (extension/toolbarPress.js).
 *   npm run walk:extension -- toolbarPress [--theme dark]
 *
 *   1. a posting draft does not hold → the press opens the dock and asks "Add this job to draft?" [Capture] [Draft]
 *   2. Capture, the person's own click on the popup → the job is captured and the tab bound
 *   3. the press again, the dock open → it closes to the launcher; nothing is read
 *   4. the press again → it opens; a job already yours is the intent line's to say (once), the press adds nothing
 *   5. a page script's click on a popup's button sends nothing
 * Synthetic person (Ada Example) throughout. The press is sent as TOOLBAR_PRESS from the extension's own page — the one
 * way a test can press the toolbar; the worker runs the same pressToolbar the toolbar's onClicked does.
 */
import { POSTING, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';

export const description = 'T31: the toolbar icon toggles the dock; a posting draft does not hold is asked about, one it holds is said, and nothing else';

const popupOf = (h, id = 'draft-relay') => h.page.evaluate((id) => {
  const host = document.getElementById(id);
  if (!host) return null;
  const r = host.shadowRoot;
  return { kind: host.dataset.draftPopup, text: r.querySelector('.tx')?.textContent || '', actions: [...r.querySelectorAll('button[data-action]')].map(b => b.dataset.action) };
}, id);
const dockOf = (h) => h.page.evaluate(() => { const d = document.getElementById('rm-draft-dock'); return d ? { collapsed: d.dataset.collapsed === 'true' } : null; });

export default async function run(h, { check, observe, section }) {
  section('1 · a posting draft does not hold — the press opens the dock and asks');
  await h.open(POSTING, { settle: 600 });
  const press1 = await h.send({ type: 'TOOLBAR_PRESS' });
  observe('the press', press1);
  check('the press opened the dock', press1?.did === 'opened' && !!(await waitUntil(() => dockOf(h), 8000)), JSON.stringify(press1));
  const asked = await waitUntil(() => popupOf(h), BUSY_MS, 200);
  observe('the popup', asked);
  check('"Add this job to draft?" — Capture and Draft', asked?.text === 'Add this job to draft?' && asked.actions.join(',') === 'capture,draft', JSON.stringify(asked));

  section('5 · a page script\'s click on the popup sends nothing');
  const before = await h.send({ type: 'TAB_STATE' }).catch(() => null);
  await h.page.evaluate(() => document.getElementById('draft-relay')?.shadowRoot?.querySelector('[data-action="capture"]')?.click());
  await sleep(600);
  const still = await popupOf(h);
  const after = await h.send({ type: 'TAB_STATE' }).catch(() => null);
  check('…nothing was captured, and the question is still there', !!still && JSON.stringify(before?.state?.jobId ?? null) === JSON.stringify(after?.state?.jobId ?? null), JSON.stringify({ before, after }));

  section('2 · Capture — the person\'s own click');
  const btn = await h.page.evaluateHandle(() => document.getElementById('draft-relay')?.shadowRoot?.querySelector('[data-action="capture"]') || null);
  await btn.asElement()?.click();
  const bound = await waitUntil(async () => { const s = await h.send({ type: 'TAB_STATE' }).catch(() => null); return s?.state?.jobId ? s.state : null; }, BUSY_MS, 300);
  check('captured, and the tab is bound to the job', !!bound?.jobId, JSON.stringify(bound));

  section('3 · the press with the dock open — it closes to the launcher');
  await waitUntil(async () => (await dockOf(h))?.collapsed === false || null, 4000);
  const press2 = await h.send({ type: 'TOOLBAR_PRESS' });
  check('closed', press2?.did === 'closed' && (await waitUntil(async () => (await dockOf(h))?.collapsed === true || null, 4000)) === true, JSON.stringify(press2));

  section('4 · the press again — it opens, and says the posting is on the board');
  const press3 = await h.send({ type: 'TOOLBAR_PRESS' });
  check('opened', press3?.did === 'opened' && (await waitUntil(async () => (await dockOf(h))?.collapsed === false || null, 8000)) === true, JSON.stringify(press3));
  await sleep(1500);
  observe('what the press said', [await popupOf(h), await popupOf(h, 'draft-notice'), await popupOf(h, 'draft-intent-path')]);
  observe('the context', await h.popupContext().then(c => ({ identity: c?.identity, posting: c?.posting && { known: c.posting.known, title: c.posting.title }, prepared: c?.prepared, handoff: c?.handoff?.state, packets: c?.packets?.length })).catch(e => String(e)));
  // a job already yours is the intent line's to say (intent.js) — once; the press adds nothing of its own
  const said = await waitUntil(() => popupOf(h, 'draft-intent-path'), 4000, 200);
  check('the intent line says the path — "Viewing this posting — Draft it…", with its switch', said?.kind === 'toast' && /^Viewing this posting/.test(said.text) && said.actions.length === 1, JSON.stringify(said));
  check('…and the press itself says nothing more', (await popupOf(h)) === null);
}

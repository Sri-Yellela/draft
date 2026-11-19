/**
 * T31 · THE TOOLBAR PRESS — the real extension on the fixture: the toolbar icon is the dock's toggle, and the page is
 * told only what it needs (extension/toolbarPress.js).
 *   npm run walk:extension -- toolbarPress [--theme dark]
 *
 *   ⭐ D191 sketch 2 (owner 11-18): the press opens the ONE PANEL (the dock's home tab) — no "Add this job?" toast
 *   1. a posting draft does not hold → the press opens the panel: the job from the page, ONE button, Draft this job
 *   2. Draft this job, the person's own click → the job is added (the tab bound) and drafted; the panel redraws
 *   3. the press again, the dock open → it closes to the launcher; nothing is read
 *   4. the press again → it opens; a job already yours is the intent line's to say (once), the press adds nothing
 *   5. a page script's click on a popup's button sends nothing
 * Synthetic person (Ada Example) throughout. The press is sent as TOOLBAR_PRESS from the extension's own page — the one
 * way a test can press the toolbar; the worker runs the same pressToolbar the toolbar's onClicked does.
 */
import { POSTING, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';

export const description = 'T31 + D191 sketch 2: the toolbar icon toggles the dock, which opens on the ONE panel; Draft this job on the person’s click only';

const popupOf = (h, id = 'draft-relay') => h.page.evaluate((id) => {
  const host = document.getElementById(id);
  if (!host) return null;
  const r = host.shadowRoot;
  return { kind: host.dataset.draftPopup, text: r.querySelector('.tx')?.textContent || '', actions: [...r.querySelectorAll('button[data-action]')].map(b => b.dataset.action) };
}, id);
const panelOf = (h) => h.page.evaluate(() => {
  const host = document.getElementById('rm-draft-job-panel');
  const r = host?.shadowRoot;
  if (!r) return null;
  const go = r.querySelector('[data-role="go"]');
  return { kind: host.dataset.draftJobPanel, status: r.querySelector('[data-role="status"]')?.textContent || '', title: r.querySelector('[data-role="title"]')?.textContent || '',
    button: go?.textContent || '', act: go?.dataset.act || null, how: [...r.querySelectorAll('[data-set]')].map(b => b.dataset.set) };
});
const dockOf = (h) => h.page.evaluate(() => { const d = document.getElementById('rm-draft-dock'); return d ? { collapsed: d.dataset.collapsed === 'true' } : null; });

export default async function run(h, { check, observe, section }) {
  section('1 · a posting draft does not hold — the press opens the panel');
  await h.open(POSTING, { settle: 600 });
  const press1 = await h.send({ type: 'TOOLBAR_PRESS' });
  observe('the press', press1);
  check('the press opened the dock', press1?.did === 'opened' && !!(await waitUntil(() => dockOf(h), 8000)), JSON.stringify(press1));
  const shown = await waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'arriving' ? p : null; }, BUSY_MS, 200);
  observe('the panel', shown);
  check('the panel: the job from the page, ONE button "Draft this job", How I apply', !!shown?.title && shown.button === 'Draft this job' && shown.act === 'add-draft'
    && shown.how.join(',') === 'review,autoOpen', JSON.stringify(shown));
  check('…and no toast repeats it (no "Add this job to draft?")', (await popupOf(h)) === null);

  section("5 · a page script's click on the panel's button sends nothing");
  const before = await h.send({ type: 'TAB_STATE' }).catch(() => null);
  await h.page.evaluate(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-role="go"]')?.click());
  await sleep(800);
  const after = await h.send({ type: 'TAB_STATE' }).catch(() => null);
  check('…nothing was added', JSON.stringify(before?.state?.jobId ?? null) === JSON.stringify(after?.state?.jobId ?? null), JSON.stringify({ before, after }));

  section("2 · Draft this job — the person's own click");
  const btn = await h.page.evaluateHandle(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-role="go"]') || null);
  await btn.asElement()?.click();
  const bound = await waitUntil(async () => { const s = await h.send({ type: 'TAB_STATE' }).catch(() => null); return s?.state?.jobId ? s.state : null; }, BUSY_MS, 300);
  check('added, and the tab is bound to the job', !!bound?.jobId, JSON.stringify(bound));
  const redrawn = await waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'job' && p.kind !== 'arriving' ? p : null; }, BUSY_MS, 300);
  observe('the panel after Draft', redrawn);
  check("the panel redrew from draft's answer (no longer the add-and-draft button)", !!redrawn || (await panelOf(h))?.act === 'draft', JSON.stringify(await panelOf(h)));

  section('3 · the press with the dock open — it closes to the /d square');
  await waitUntil(async () => (await dockOf(h))?.collapsed === false || null, 4000);
  const press2 = await h.send({ type: 'TOOLBAR_PRESS' });
  check('closed', press2?.did === 'closed' && (await waitUntil(async () => (await dockOf(h))?.collapsed === true || null, 4000)) === true, JSON.stringify(press2));

  section("4 · the press again — it opens on the panel, the job now draft's");
  const press3 = await h.send({ type: 'TOOLBAR_PRESS' });
  check('opened', press3?.did === 'opened' && (await waitUntil(async () => (await dockOf(h))?.collapsed === false || null, 8000)) === true, JSON.stringify(press3));
  const again = await waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'arriving' ? p : null; }, BUSY_MS, 200);
  observe('the panel', again);
  check("the panel shows the job as draft's own — not add-draft", !!again && again.act !== 'add-draft', JSON.stringify(again));
  check('…and the press itself says nothing more', (await popupOf(h)) === null);
}

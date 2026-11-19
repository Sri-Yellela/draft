/**
 * ⭐ D191 sketch 2 (owner 11-18: "alright go") · THE ONE PANEL OPENS BY ITSELF ON A BOARD — the real extension.
 *   npm run walk:extension -- d191Panel
 * =====================================================================================================================
 *   1. a Workday posting (the fixture's tenant, mapped) opens — NO press: the panel appears by itself, drawn first from
 *      the page ("Checking draft…" / the job's own title), then from draft's answer. MEASURED: page-ready → panel.
 *   2. it is ONE thing: no Chrome side panel, no popup window; the dock's tab row is hidden while the panel is alone
 *   3. never over the employer's Apply control: the fixture's Apply link is moved under the panel, the panel is drawn
 *      again (the press twice) — it steps to the other side
 *   4. closed (the press) → the /d square; the posting loaded again → the square, not the panel (the person's choice on
 *      this site is kept); the press opens it
 *   5. an application step (…/apply) → nothing by itself
 *   6. "Open by itself" switched off with the person's click → a posting loaded again shows nothing until the press
 * Synthetic person (Ada Example) throughout.
 */
import { POSTING, OWNER_STAGE, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';

// the test build's arrival script also matches the fixture's http tenant (test-support/extensionBrowser.mjs)
export const options = {
  panelArrive: true,
  api: {
    // ⭐ B4: the site's two profile routes, as the walk's server answers them (synthetic: two job profiles, one active)
    mount: (app) => {
      const profiles = [{ id: 11, profile_name: 'Backend engineer', is_active: 1 }, { id: 12, profile_name: 'Data engineer', is_active: 0 }];
      app.get('/api/domain-profiles', (_q, res) => res.json(profiles));
      app.post('/api/domain-profiles/:id/activate', (q, res) => {
        const p = profiles.find(x => x.id === Number(q.params.id));
        if (!p) return res.status(404).json({ error: 'Profile not found' });
        for (const x of profiles) x.is_active = x === p ? 1 : 0;
        res.json(p);
      });
    },
  },
};
export const description = 'D191 sketch 2: the one panel opens by itself on a board posting, from the page first; avoids the Apply control; closes to the /d square; not on an apply step; the switch turns it off';

const panelOf = (h) => h.page.evaluate(() => {
  const host = document.getElementById('rm-draft-job-panel');
  const r = host?.shadowRoot;
  if (!r) return null;
  const go = r.querySelector('[data-role="go"]');
  return { kind: host.dataset.draftJobPanel, status: r.querySelector('[data-role="status"]')?.textContent || '', title: r.querySelector('[data-role="title"]')?.textContent || '',
    button: go?.textContent || '', act: go?.dataset.act || null };
});
const dockOf = (h) => h.page.evaluate(() => {
  const d = document.getElementById('rm-draft-dock');
  if (!d) return null;
  const b = d.getBoundingClientRect();
  return { collapsed: d.dataset.collapsed === 'true', tabs: d.shadowRoot?.querySelectorAll('[role="tab"]').length ?? -1, rect: { left: b.left, right: b.right, top: b.top, bottom: b.bottom } };
});

export default async function run(h, { check, observe, section }) {
  section('1 · a Workday posting opens — the panel appears by itself, the page first');
  // watch from the first moment: the time the panel's host first exists, against the page's DOMContentLoaded
  await h.page.evaluateOnNewDocument(() => {
    const seen = () => { if (!window.__d191At && document.getElementById('rm-draft-job-panel')) window.__d191At = performance.now(); };
    new MutationObserver(seen).observe(document, { childList: true, subtree: true });
    window.__d191Kinds = [];
    setInterval(() => { const k = document.getElementById('rm-draft-job-panel')?.dataset.draftJobPanel; if (k && window.__d191Kinds.at(-1) !== k) window.__d191Kinds.push(k); }, 15);
  });
  await h.open(POSTING, { settle: 0 });
  const shown = await waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'arriving' ? p : null; }, BUSY_MS, 100);
  const timing = await h.page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return { panelAt: window.__d191At ?? null, domReady: nav?.domContentLoadedEventEnd ?? null, loaded: nav?.loadEventEnd ?? null, kinds: window.__d191Kinds };
  });
  observe('the panel', shown);
  observe('shot', await h.screenshot('d191-panel-job'));   // for the owner's look (docs/fidelity-shots)
  observe('timing (ms since navigation start)', timing);
  check('the panel opened with no press — the job from the page, ONE button', !!shown?.title && !!shown.button, JSON.stringify(shown));
  const ms = timing.panelAt != null && timing.domReady != null ? Math.round(timing.panelAt - timing.domReady) : null;
  observe('page ready (DOMContentLoaded) → panel drawn (ms)', ms);
  check('d191PanelUnder300msOnPatternMatch — the panel is drawn within 300 ms of the page being ready', ms != null && ms <= 300, String(ms));
  check('d191CollapsedNoApiWait — the first frame came before draft\'s answer (arriving, then the job)', timing.kinds[0] === 'arriving' && timing.kinds.length >= 2, JSON.stringify(timing.kinds));

  section('2 · ONE thing — no side panel, no window; no tab row while the panel is alone');
  const dock = await dockOf(h);
  check('the dock is open with the panel and no tab row', dock && !dock.collapsed && dock.tabs === 0, JSON.stringify(dock));
  const pages = (await h.browser.pages()).map(p => p.url()).filter(u => /ask\.html|global-ask/.test(u));
  check('d191OneUiNotTwo — no extension window or side panel opened beside it', pages.length === 0, JSON.stringify(pages));

  section('3 · never over the employer\'s Apply control');
  await h.page.evaluate(() => {
    const a = document.querySelector('[data-automation-id="adventureButton"]') || [...document.querySelectorAll('a,button')].find(e => /^\s*apply\s*$/i.test(e.textContent));
    if (a) Object.assign(a.style, { position: 'fixed', right: '40px', top: '120px', padding: '10px 18px', zIndex: '1' });
  });
  await h.send({ type: 'TOOLBAR_PRESS' });                                   // closes
  await waitUntil(async () => (await dockOf(h))?.collapsed === true || null, 4000);
  await h.send({ type: 'TOOLBAR_PRESS' });                                   // opens and draws again
  await waitUntil(async () => (await dockOf(h))?.collapsed === false || null, 8000);
  await sleep(1200);
  const geo = await h.page.evaluate(() => {
    const a = document.querySelector('[data-automation-id="adventureButton"]') || [...document.querySelectorAll('a,button')].find(e => /^\s*apply\s*$/i.test(e.textContent));
    const d = document.getElementById('rm-draft-dock');
    if (!a || !d) return null;
    const r1 = a.getBoundingClientRect(), r2 = d.getBoundingClientRect();
    return { apply: { left: r1.left, right: r1.right, top: r1.top, bottom: r1.bottom }, dock: { left: r2.left, right: r2.right, top: r2.top, bottom: r2.bottom },
      overlap: !(r2.right <= r1.left || r2.left >= r1.right || r2.bottom <= r1.top || r2.top >= r1.bottom) };
  });
  observe('the Apply control and the dock', geo);
  check('d191NeverCoversAtsApplyButton — the panel stepped aside', geo && geo.overlap === false, JSON.stringify(geo));

  section('4 · closed → the /d square; the posting again → still the square; the press opens it');
  await h.send({ type: 'TOOLBAR_PRESS' });
  check('closed to the square', (await waitUntil(async () => (await dockOf(h))?.collapsed === true || null, 4000)) === true);
  await sleep(500);                                                         // the place is saved a beat later
  await h.open(POSTING, { settle: 1500 });
  const again = await dockOf(h);
  check('d191PillAlwaysVisible — the posting again shows the /d square (the person\'s choice on this site is kept)', again?.collapsed === true, JSON.stringify(again));
  await h.send({ type: 'TOOLBAR_PRESS' });
  const reopened = await waitUntil(async () => { const d = await dockOf(h); const p = await panelOf(h); return d && !d.collapsed && p ? p : null; }, BUSY_MS, 200);
  check('d191PillReopensLastState — one press opens the panel again', !!reopened?.button, JSON.stringify(reopened));

  section('5 · an application step — nothing by itself');
  await h.open(OWNER_STAGE, { settle: 1800 });
  check('no panel drew by itself on …/apply', (await panelOf(h)) === null);

  section('6 · "Open by itself" off — the person\'s click — and a posting shows nothing until the press');
  await h.open(POSTING, { settle: 0 });
  // the square is there (step 4); open it, then switch "Open by itself" off with a real click
  await h.send({ type: 'TOOLBAR_PRESS' });
  await waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'arriving' ? p : null; }, BUSY_MS, 200);
  const sw = await h.page.evaluateHandle(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-set="autoOpen"]') || null);
  await sw.asElement()?.click();
  await sleep(600);
  const off = await h.page.evaluate(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-set="autoOpen"]')?.getAttribute('aria-checked'));
  check('the switch reads off', off === 'false', String(off));
  // a fresh site place: forget the square so only the switch decides
  await h.page.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
  await h.open(POSTING, { settle: 1800 });
  const none = await h.page.evaluate(() => !!document.getElementById('rm-draft-dock'));
  check('with the switch off, nothing is drawn by itself', none === false, String(none));

  section('7 · How I apply — Résumé ▾ switches the job profile; Review before I submit is the account mode; the panel fits its content');
  await h.send({ type: 'TOOLBAR_PRESS' });
  const open7 = await waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'arriving' ? p : null; }, BUSY_MS, 200);
  const label = () => h.page.evaluate(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-role="resume"]')?.textContent || null);
  check('the résumé is the active job profile', (await label()) === 'Résumé: Backend engineer ▾', String(await label()));
  const rb = await h.page.evaluateHandle(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-role="resume"]') || null);
  await rb.asElement()?.click();
  const names = await waitUntil(() => h.page.evaluate(() => { const l = document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-role="resume-list"]');
    return l && !l.hidden ? [...l.querySelectorAll('button')].map(b => b.textContent) : null; }), 6000, 150);
  check('▾ lists the person\'s job profiles', JSON.stringify(names) === JSON.stringify(['Backend engineer', 'Data engineer']), JSON.stringify(names));
  const pick = await h.page.evaluateHandle(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-profile="12"]') || null);
  await pick.asElement()?.click();
  const switched = await waitUntil(async () => ((await label()) === 'Résumé: Data engineer ▾' ? true : null), 8000, 200);
  check('a pick switches it (the site\'s own activate), and the panel says the new one', switched === true, String(await label()));
  const rv = await h.page.evaluateHandle(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-set="review"]') || null);
  await rv.asElement()?.click();
  await sleep(700);
  const review = await h.page.evaluate(() => { const r = document.getElementById('rm-draft-job-panel')?.shadowRoot;
    return { checked: r?.querySelector('[data-set="review"]')?.getAttribute('aria-checked'), said: r?.querySelector('[data-role="said"]')?.textContent || '' }; });
  // ⭐ 46x (owner 11-19: "unlock apply for me"): the switch is the account's mode — off = Apply for me, on = Ask me first
  check('Review before I submit turns OFF — Apply for me, and the panel says what that means',
    review.checked === 'false' && /Apply for me is on/.test(review.said), JSON.stringify(review));
  await rv.asElement()?.click();
  await sleep(700);
  const back = await h.page.evaluate(() => { const r = document.getElementById('rm-draft-job-panel')?.shadowRoot;
    return { checked: r?.querySelector('[data-set="review"]')?.getAttribute('aria-checked'), said: r?.querySelector('[data-role="said"]')?.textContent || '' }; });
  check('…and back ON — every Draft waits for review', back.checked === 'true' && /waits for your review/.test(back.said), JSON.stringify(back));
  // ⭐ 46x (owner 11-19: "the panel is as long as the content"): no empty middle — the dock is the panel's height
  const fit = await h.page.evaluate(() => { const host = document.getElementById('rm-draft-dock'); const r = document.getElementById('rm-draft-job-panel')?.shadowRoot;
    return { dock: Math.round(host?.getBoundingClientRect().height || 0), mid: Math.round(r?.querySelector('.mid')?.getBoundingClientRect().height || 0), vh: innerHeight }; });
  check('the panel is as long as its content (no empty middle; under the old 680 px column)', fit.dock > 0 && fit.dock < Math.min(680, fit.vh - 32) && fit.mid <= 14, JSON.stringify(fit));
  observe('the panel', open7);
  observe('shot', await h.screenshot('d191-panel-resume'));
}

/**
 * ⭐ D191 · THE EXTENSION AS draft's FRONT DOOR — the real extension, a real press, draft's REAL page route
 * (createExtensionJobRouter: POST /api/extension/page, GET /api/extension/home) on a synthetic employer.
 *   npm run walk:extension -- d191FrontDoor
 *
 *   ⭐ D191 B1 / B3 (owner 11-18, the one-panel sketch): the press opens THE panel — the toasts this walk read (the capture
 *   question, the employer's card, the day line) and the side panel (ask.html) are retired; rewritten ON PURPOSE.
 *   1. a posting (Northwind Systems — synthetic) → the press opens the panel: the job, ONE button; the press's context
 *      carries the employer's card (draft's own link)
 *   2. Draft this job, the person's own click → the job is added and the tab bound
 *   3. the toolbar badge: today's undecided matches (GET /api/extension/home — 2 here), set by the press
 *   4. a page with no posting → the panel's other-page view: the day (new matches 2)
 *   5. its ONE box — Ask draft on the site's engine (in the worker): T2 from the public record and the day, a search handed
 *      to draft's board (?search=), T3 not offered
 *   ⛔ no model route is asked at any point.
 * Synthetic person (Ada Example) and employer throughout.
 */
import { POSTING, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';
import { createExtensionJobRouter } from '../../routes/extensionJob.js';

const TODAY = new Date().toLocaleDateString('en-CA');
export const description = 'D191 B1/B3: the panel on a posting and on any other page — the day, Ask draft in its one box (the site engine, no model), the badge';
export const options = {
  api: {
    mount: (app, db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, domain TEXT);
        CREATE TABLE IF NOT EXISTS company_aliases (alias_key TEXT PRIMARY KEY, company_id INTEGER, evidence TEXT);
        CREATE TABLE IF NOT EXISTS job_company (job_id TEXT PRIMARY KEY, company_id INTEGER);
        CREATE TABLE IF NOT EXISTS daily_drafts (user_id INTEGER, profile_id INTEGER, draft_date TEXT, position INTEGER, job_id TEXT, band TEXT, card_json TEXT);
        INSERT OR IGNORE INTO companies (id, slug, name) VALUES (901, 'northwind-systems', 'Northwind Systems');
        INSERT OR IGNORE INTO company_aliases (alias_key, company_id, evidence) VALUES ('name:northwind-systems', 901, 'name');`);
      // two of the fixture's live postings belong to Northwind on draft (job_company — the D179 link table)
      for (const id of db.prepare(`SELECT job_id FROM scraped_jobs WHERE is_active = 1 LIMIT 2`).pluck().all()) db.prepare(`INSERT OR IGNORE INTO job_company (job_id, company_id) VALUES (?, 901)`).run(id);
      // today's deal: three cards, one already decided (passed) → 2 new matches; one held application → 1 needs you
      for (const [i, id] of ['d191-x', 'd191-y', 'd191-z'].entries()) db.prepare(`INSERT INTO daily_drafts (user_id, profile_id, draft_date, position, job_id, band, card_json) VALUES (1, 1, ?, ?, ?, 'strong', '{}')`).run(TODAY, i, id);
      try { db.prepare(`INSERT INTO user_jobs (user_id, job_id, disliked) VALUES (1, 'd191-z', 1)`).run(); } catch { /* the fixture's own user_jobs */ }
      try { db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (1, 1, 'd191-held', 'held_review')`).run(); } catch { /* the fixture's own schema */ }
      const r = createExtensionJobRouter({ db, requireAuth: (q, s, n) => n(), isExtension: () => true, scoreFor: () => null, scoreText: () => null, hasBaseResume: () => false });
      app.use((req, res, next) => (req.method === 'GET' && (req.path === '/api/extension/home' || req.path === '/api/extension/company') ? r(req, res, next) : next()));
      // ⭐ D191 B3: a page that is no job at all (a news page) — the panel's other-page view
      app.get('/walk-news', (_q, res) => res.type('html').send('<!doctype html><title>Morning Brief</title><h1>Markets open higher</h1><p>Stocks rose in early trading as investors weighed the latest figures.</p>'));
    },
  },
};

const panelOf = (h) => h.page.evaluate(() => {
  const host = document.getElementById('rm-draft-job-panel');
  const r = host?.shadowRoot;
  if (!r) return null;
  const go = r.querySelector('[data-role="go"]');
  return { kind: host.dataset.draftJobPanel, status: r.querySelector('[data-role="status"]')?.textContent || '', title: r.querySelector('[data-role="title"]')?.textContent || '',
    button: go?.textContent || '', act: go?.dataset.act || null, day: [...r.querySelectorAll('.tile')].map(t => t.textContent.trim()), ask: !!r.getElementById('rm-draft-ask-input') };
});

export default async function run(h, { check, observe, section }) {
  const origin = new URL(POSTING).origin;
  const press = async () => { let p = await h.send({ type: 'TOOLBAR_PRESS' }); if (p?.did === 'closed') { await sleep(300); p = await h.send({ type: 'TOOLBAR_PRESS' }); } return p; };
  const settled = (kind) => waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'arriving' && (!kind || p.kind === kind) ? p : null; }, BUSY_MS, 200);

  section('1 · a posting — the press opens the panel: the job, ONE button');
  await h.open(`${origin}/posting`, { settle: 700 });
  observe('the press', await press());
  const shown = await settled();
  observe('the panel', shown);
  check('the panel: the job and ONE button, Draft this job', !!shown?.title && shown.button === 'Draft this job', JSON.stringify(shown));
  const ctx = await h.popupContext().catch(() => null);
  check("…the press's context carries the employer's card (named fields, draft's own link)", ctx?.company?.href === 'https://jobsviadraft.com/companies/northwind-systems', JSON.stringify(ctx?.company));

  section("2 · Draft this job — the person's own click");
  const go = await h.page.evaluateHandle(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-role="go"]') || null);
  await go.asElement()?.click();
  const bound = await waitUntil(async () => { const s = await h.send({ type: 'TAB_STATE' }).catch(() => null); return s?.state?.jobId || null; }, BUSY_MS, 300);
  check('added — the tab is bound to the job', !!bound, String(bound));

  section("3 · the toolbar badge — today's undecided matches");
  const badge = await waitUntil(async () => { const t = await h.control.evaluate(() => chrome.action.getBadgeText({})); return t || null; }, 8000, 300);
  check('the badge reads 2', badge === '2', String(badge));
  const title = await h.control.evaluate(() => chrome.action.getTitle({}));
  check('…its tooltip says what it counts', /2 new matches today/.test(title), title);

  section("4 · a page with no posting — the panel's other-page view: the day");
  await sleep(400);
  await h.open(`${h.api.origin}/walk-news`, { settle: 600 });   // a news page: no posting here
  await press();
  observe('the press context here', await h.popupContext().then(c => ({ identity: c?.identity, posting: c?.posting && { known: c.posting.known, title: c.posting.title } })).catch(e => String(e)));
  observe('the panel as drawn', await waitUntil(async () => { const p = await panelOf(h); return p && p.kind !== 'arriving' ? p : null; }, 8000, 200));
  const other = await settled('other');
  observe('the panel', other);
  observe('shot', await h.screenshot('d191-panel-other'));   // for the owner's look (docs/fidelity-shots)
  check('the day: new matches 2, need you, drafted — and the one box', other?.day?.length === 3 && /^2\s*new matches$/.test(other.day[0]) && other.ask, JSON.stringify(other));
  const popups = await h.page.evaluate(() => [...document.querySelectorAll('[data-draft-popup]')].map(e => e.id));
  check('…and no toast repeats the day', !popups.includes('draft-home'), JSON.stringify(popups));

  section("5 · the one box — Ask draft on the site's engine (no model), a search of draft");
  const askTell = async (s) => {
    const input = await h.page.evaluateHandle(() => document.getElementById('rm-draft-job-panel')?.shadowRoot?.getElementById('rm-draft-ask-input') || null);
    await input.asElement()?.click();
    await h.page.keyboard.type(s);
    await h.page.keyboard.press('Enter');
    await waitUntil(() => h.page.evaluate(() => { const r = document.getElementById('rm-draft-job-panel')?.shadowRoot?.querySelector('[data-role="reply"]'); return r && r.textContent && r.textContent !== '…' ? true : null; }), 10000, 150);
    return h.page.evaluate(() => { const r = document.getElementById('rm-draft-job-panel').shadowRoot.querySelector('[data-role="reply"]'); return { tier: r.dataset.tier, text: r.textContent }; });
  };
  let t = await askTell('does Northwind Systems sponsor?');
  check("“does Northwind Systems sponsor?” — T2 from draft's public record", t.tier === 'T2' && /Northwind Systems/.test(t.text), JSON.stringify(t));
  t = await askTell('how many need me?');
  check('“how many need me?” — T2 from the day', t.tier === 'T2' && /need|Nothing needs you/.test(t.text), JSON.stringify(t));
  t = await askTell('show me remote senior jobs');
  const searched = await waitUntil(() => h.browser.targets().find(x => /\/app\/jobs\?search=remote(%20|\+)senior/.test(x.url())) || null, 6000, 200);
  check("“show me remote senior jobs” opens draft's board with ?search=", t.tier === 'T1' && !!searched, JSON.stringify(t));
  await h.page.bringToFront().catch(() => {});
  t = await askTell('backend jobs in Boston');
  const searched2 = await waitUntil(() => h.browser.targets().find(x => /\/app\/jobs\?search=backend(%20|\+)jobs/.test(x.url())) || null, 6000, 200);
  check('a sentence draft does not know is a search of the board — one box for both', !!searched2, JSON.stringify(t));
  await h.page.bringToFront().catch(() => {});
  t = await askTell('rewrite this bullet to highlight Kafka');
  check('“rewrite this bullet…” — not offered in the extension, nothing sent', t.tier === 'ask' && /isn't offered in the extension/.test(t.text), JSON.stringify(t));

  const model = h.api.requests.filter(r => /assistant\/ask|anthropic|\/v1\/messages/.test(r.path));
  check('⛔ no model route was asked', model.length === 0, JSON.stringify(model));
  const homes = h.api.requests.filter(r => r.path === '/api/extension/home').length;
  check('the home facts were asked on presses / page loads / the box only — a handful of times', homes >= 1 && homes <= 10, String(homes));
}

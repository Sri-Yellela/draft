/**
 * ⭐ D191 · THE EXTENSION AS draft's FRONT DOOR — the real extension, a real press, draft's REAL page route
 * (createExtensionJobRouter: POST /api/extension/page, GET /api/extension/home) on a synthetic employer.
 *   npm run walk:extension -- d191FrontDoor
 *
 *   1. a posting (Northwind Systems — synthetic) → the press asks "Add this job to draft?" AND says the employer's card from
 *      draft's own records: its H-1B line (none on file here) · "N open jobs on draft" · [Company]
 *   2. Company, the person's own click → draft's company page opens in a new tab (the link from THIS tab's read)
 *   3. the toolbar badge: today's undecided matches (GET /api/extension/home — 2 here), set by the press
 *   4. a page with nothing else to say → the day in one line: "Today: 2 new matches…" [Matches] (+ [Needs you] when something does)
 *   ⛔ no model route is asked at any point.
 * Synthetic person (Ada Example) and employer throughout.
 */
import { POSTING, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';
import { createExtensionJobRouter } from '../../routes/extensionJob.js';

const TODAY = new Date().toLocaleDateString('en-CA');
export const description = 'D191: the employer card on a posting (draft\'s records, no model), its Company button, the new-matches badge, the home line';
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
    },
  },
};

const popupOf = (h, id) => h.page.evaluate((id) => {
  const host = document.getElementById(id);
  if (!host) return null;
  const r = host.shadowRoot;
  return { kind: host.dataset.draftPopup, text: r.querySelector('.tx')?.textContent || '', actions: [...r.querySelectorAll('button[data-action]')].map(b => b.dataset.action) };
}, id);

export default async function run(h, { check, observe, section }) {
  const origin = new URL(POSTING).origin;
  section('1 · a posting — the capture question AND the employer\'s card from draft\'s records');
  await h.open(`${origin}/posting`, { settle: 700 });
  const press = await h.send({ type: 'TOOLBAR_PRESS' });
  observe('the press', press);
  const asked = await waitUntil(() => popupOf(h, 'draft-relay'), BUSY_MS, 200);
  check('"Add this job to draft?" — Capture and Draft', asked?.text === 'Add this job to draft?', JSON.stringify(asked));
  // one popup at a time (T31): the card follows the person's answer — Capture, their own click
  const cap = await h.page.evaluateHandle(() => document.getElementById('draft-relay')?.shadowRoot?.querySelector('[data-action="capture"]') || null);
  await cap.asElement()?.click();
  const card = await waitUntil(() => popupOf(h, 'draft-company'), BUSY_MS, 200);
  observe('the card', card);
  check('…then the employer\'s card: "Northwind Systems: N open jobs on draft" with Company', /^Northwind Systems: .*\d+ open jobs? on draft$/.test(card?.text || '') && card.actions.join(',') === 'open-company', JSON.stringify(card));
  const ctx = await h.popupContext().catch(() => null);
  check('…the press\'s context carries the card (named fields, draft\'s own link)', ctx?.company?.href === 'https://jobsviadraft.com/companies/northwind-systems', JSON.stringify(ctx?.company));

  section('2 · Company — the person\'s own click opens draft\'s company page');
  const before = h.browser.targets().length;
  const btn = await h.page.evaluateHandle(() => document.getElementById('draft-company')?.shadowRoot?.querySelector('[data-action="open-company"]') || null);
  await btn.asElement()?.click();
  const opened = await waitUntil(() => h.browser.targets().find(t => t.url().startsWith('https://jobsviadraft.com/companies/northwind-systems')) || null, 8000, 200);
  check('a tab on https://jobsviadraft.com/companies/northwind-systems', !!opened, `${before} → ${h.browser.targets().length}`);

  section('3 · the toolbar badge — today\'s undecided matches');
  const badge = await waitUntil(async () => { const t = await h.control.evaluate(() => chrome.action.getBadgeText({})); return t || null; }, 8000, 300);
  check('the badge reads 2', badge === '2', String(badge));
  const title = await h.control.evaluate(() => chrome.action.getTitle({}));
  check('…its tooltip says what it counts', /2 new matches today/.test(title), title);

  section('4 · a page with nothing else to say — the day, in one line');
  await sleep(400);
  await h.open(`${origin}/ashby-spa`, { settle: 600 });   // an application form with no description: the press asks nothing
  await h.send({ type: 'TOOLBAR_PRESS' });
  const day = await waitUntil(() => popupOf(h, 'draft-home'), BUSY_MS, 200);
  observe('the popups on this page', await h.page.evaluate(() => [...document.querySelectorAll('[data-draft-popup]')].map(e => `${e.id}: ${e.shadowRoot?.querySelector('.tx')?.textContent || ''}`)));
  observe('the home line', day);
  // (the harness's schema refuses the seeded held run-job, so "needs you" is 0 here — the unit test drives that part)
  check('"Today: 2 new matches…" with Matches (Needs you only when something does)', /^Today: 2 new matches/.test(day?.text || '') && day.actions[0] === 'open-draft'
    && (/needs? you/.test(day.text) === day.actions.includes('open-needs')), JSON.stringify(day));

  const model = h.api.requests.filter(r => /assistant\/ask|anthropic|\/v1\/messages/.test(r.path));
  check('⛔ no model route was asked', model.length === 0, JSON.stringify(model));
  const homes = h.api.requests.filter(r => r.path === '/api/extension/home').length;
  check('the home facts were asked on presses / page loads only — at most a few times', homes >= 1 && homes <= 6, String(homes));
}

/**
 * ⭐ D191 · THE EXTENSION AS draft's FRONT DOOR — the real extension, a real press, draft's REAL page route
 * (createExtensionJobRouter: POST /api/extension/page, GET /api/extension/home) on a synthetic employer.
 *   npm run walk:extension -- d191FrontDoor
 *
 *   1. a posting (Northwind Systems — synthetic) → the press asks "Add this job to draft?" AND says the employer's card from
 *      draft's own records: its H-1B line (none on file here) · "N open jobs on draft" · [Company]
 *   2. Company, the person's own click → draft's company page opens in a new tab (the link from THIS tab's read)
 *   3. the toolbar badge: today's undecided matches (GET /api/extension/home — 2 here), set by the press
 *   4. a page with nothing else to say → the day in one line: "Today: 2 new matches…" [Open] (the panel) [Matches]
 *   5. the panel (ask.html): the day's tiles; Ask draft on the site's engine — T2 from this tab's read and the day, a search
 *      handed to draft's board (?search=), "save this" through the dock's own Capture, T3 not offered; a spoken command
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
  const opened = await waitUntil(async () => (await h.control.evaluate(async () => (await chrome.tabs.query({})).map(t => t.pendingUrl || t.url)))
    .find(u => String(u).startsWith('https://jobsviadraft.com/companies/northwind-systems')) || null, 8000, 200);
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
  check('"Today: 2 new matches…" with Open (the panel) and Matches', /^Today: 2 new matches/.test(day?.text || '') && day.actions.join(',') === 'open-ask,open-draft', JSON.stringify(day));

  section('5 · the extension\'s own panel (ask.html) — the day, Ask draft on the same engine, a search of draft, voice');
  check('the home line\'s first button opens the panel', day?.actions?.[0] === 'open-ask', JSON.stringify(day?.actions));
  await h.open(`${origin}/posting`, { settle: 700 });
  let pressed = await h.send({ type: 'TOOLBAR_PRESS' });
  if (pressed?.did === 'closed') { await sleep(300); pressed = await h.send({ type: 'TOOLBAR_PRESS' }); }   // a dock left open: close, then open (and read)
  observe('the press on the posting', pressed);
  await sleep(1500);
  const extOrigin = h.control.url().split('/').slice(0, 3).join('/');   // (a chrome-extension:// URL's origin reads "null")
  const postingTab = await h.control.evaluate(async () => (await chrome.tabs.query({})).find(t => /\/posting$/.test(t.url || ''))?.id ?? null);
  const ask = await h.browser.newPage();
  await ask.evaluateOnNewDocument(() => {
    window.SpeechRecognition = class { static async available() { return 'available'; }
      start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: window.__say || 'help' }]] }); this.onend?.(); }, 60); } stop() { this.onend?.(); } };
  });
  const askLog = [];
  ask.on('console', m => askLog.push(`${m.type()}: ${m.text()}`)); ask.on('pageerror', e => askLog.push(`error: ${e.message}`));
  await ask.goto(`${extOrigin}/ask.html?tab=${postingTab}`, { waitUntil: 'domcontentloaded' });
  const ready = await waitUntil(() => ask.evaluate(() => globalThis.__askReady === true || null), 10000, 200);
  observe('the panel loaded', { ready, log: askLog.slice(0, 6), homeAsks: h.api.requests.filter(r => r.path === '/api/extension/home').length });
  observe('a probe from the panel', await ask.evaluate(async (api) => { try { const m = await import('./auth.js'); const r = await m.authedFetch(api, `/api/extension/home?date=${new Date().toLocaleDateString('en-CA')}`); return { status: r?.status ?? null, body: r ? (await r.text()).slice(0, 200) : null }; } catch (e) { return { error: String(e) }; } }, h.api.origin));
  const dayTiles = await ask.$$eval('[data-day]', els => els.map(e => `${e.dataset.day}=${e.querySelector('b')?.textContent}`));
  check('the day: new matches 2 (and needs you, drafted, sent)', dayTiles.includes('newMatches=2') && dayTiles.length === 4, dayTiles.join(' '));
  const askTell = async (s) => {
    const n0 = await ask.$$eval('.turn[data-who="draft"]', els => els.length);
    await ask.type('#ask-input', s); await ask.keyboard.press('Enter');
    await waitUntil(() => ask.$$eval('.turn[data-who="draft"]', (els, n) => (els.length > n ? true : null), n0), 10000, 150);
    return ask.evaluate(() => { const t = [...document.querySelectorAll('.turn[data-who="draft"]')].pop(); return { tier: t.dataset.tier, label: t.querySelector('.label')?.textContent || null, text: t.lastChild.textContent }; });
  };
  let t = await askTell('does this company sponsor?');
  check('“does this company sponsor?” — T2 from this tab\'s read (Northwind)', t.tier === 'T2' && /Northwind Systems/.test(t.text), JSON.stringify(t));
  t = await askTell('how many need me?');
  check('“how many need me?” — T2 from the day', t.tier === 'T2' && /need|Nothing needs you/.test(t.text), JSON.stringify(t));
  const tabsBefore = h.browser.targets().length;
  t = await askTell('show me remote senior jobs');
  const searched = await waitUntil(() => h.browser.targets().find(x => /\/app\/jobs\?search=remote(%20|\+)senior/.test(x.url())) || null, 6000, 200);
  check('“show me remote senior jobs” opens draft\'s board with ?search=', t.tier === 'T1' && !!searched, `${t.text} · ${tabsBefore} → ${h.browser.targets().length}`);
  await ask.bringToFront().catch(() => {});
  t = await askTell('rewrite this bullet to highlight Kafka');
  check('“rewrite this bullet…” — not offered in the extension, nothing sent', t.tier === 'ask' && /isn't offered in the extension/.test(t.text), JSON.stringify(t));
  await ask.bringToFront().catch(() => {});   // the search opened a tab in the main window; the panel comes back to the front
  await ask.evaluate(() => { window.__say = 'how many need me'; });
  const n1 = await ask.$$eval('.turn[data-who="draft"]', els => els.length);
  await ask.click('#ask-mic');
  await waitUntil(() => ask.$$eval('.turn[data-who="draft"]', (els, n) => (els.length > n ? true : null), n1), 8000, 150);
  const spoken = await ask.evaluate(() => [...document.querySelectorAll('.turn[data-who="you"]')].pop()?.textContent || '');
  check('P5 · a spoken command goes through the same engine', /how many need me/.test(spoken), spoken);
  t = await askTell('save this');
  const saved = await waitUntil(async () => { const s = await h.send({ type: 'TAB_STATE', tabId: postingTab }).catch(() => null); return s?.state?.jobId || (h.api.requests.some(r => /\/api\/import/.test(r.path) && r.method === 'POST') ? 'posted' : null); }, 10000, 300);
  check('“save this” — the dock\'s own Capture on the posting\'s tab', t.tier === 'T1' && !!saved, `${t.text} · ${saved}`);
  await ask.bringToFront().catch(() => {});
  const ledger = await ask.evaluate(() => (globalThis.__askLedger || []).map(x => x.tier));
  check('the panel\'s ledger has no T3', !ledger.includes('T3'), ledger.join(','));
  await ask.close();

  const model = h.api.requests.filter(r => /assistant\/ask|anthropic|\/v1\/messages/.test(r.path));
  check('⛔ no model route was asked', model.length === 0, JSON.stringify(model));
  const homes = h.api.requests.filter(r => r.path === '/api/extension/home').length;
  check('the home facts were asked on presses / page loads only — at most a few times', homes >= 1 && homes <= 6, String(homes));
}

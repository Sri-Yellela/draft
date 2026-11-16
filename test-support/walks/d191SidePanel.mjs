/**
 * ⭐ D191 (46o rebuild) · THE SIDE PANEL WITH THE REAL EXTENSION (46p item 2). npm run walk:extension -- d191SidePanel
 * ==================================================================================================================
 *   0. a fresh install opens the disclosure page (notice.html — noticeDue) once
 *   1. a posting (Northwind Systems — synthetic) is captured, then draft's own facts for it are seeded (taxonomy,
 *      level, salary, job_tech, a held run-job) and one application waits to be sent from this browser (A211 (b))
 *   2. the press on a page with nothing else to say → the home line: "Today: N new matches · 1 waiting to send from this
 *      browser" with THREE actions, Runner first
 *   3. the home line's Open — the person's real click on the dock's popup (DOCK_ACT) → does chrome.sidePanel.open() keep
 *      the gesture, or does it fall back to the small window? (MEASURED: an observed line plus a check that one of the two
 *      opened — the panel is reachable either way)
 *   4. the panel at the side panel's default width (320 px), light and dark: the This-job card (sub line, fit, Works with,
 *      state, buttons) and the company card, from the press's read of the posting's tab
 *   ⛔ no model route is asked at any point. Synthetic person (Ada Example) and employer throughout.
 */
import { POSTING, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';
import { createExtensionJobRouter } from '../../routes/extensionJob.js';

const TODAY = new Date().toLocaleDateString('en-CA');
export const description = 'D191 (46o): the notice on install, the home line with the runner first, the side panel (or its window) from the dock\'s Open, the This-job + company cards at 320 px in light and dark';
export const options = {
  api: {
    mount: (app, db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, domain TEXT);
        CREATE TABLE IF NOT EXISTS company_aliases (alias_key TEXT PRIMARY KEY, company_id INTEGER, evidence TEXT);
        CREATE TABLE IF NOT EXISTS job_company (job_id TEXT PRIMARY KEY, company_id INTEGER);
        CREATE TABLE IF NOT EXISTS daily_drafts (user_id INTEGER, profile_id INTEGER, draft_date TEXT, position INTEGER, job_id TEXT, band TEXT, card_json TEXT);
        CREATE TABLE IF NOT EXISTS job_taxonomy (job_id TEXT PRIMARY KEY, category TEXT, subcategory TEXT, confidence REAL, reason TEXT, version TEXT NOT NULL DEFAULT 'walk');
        CREATE TABLE IF NOT EXISTS job_tech (job_id TEXT NOT NULL, tech TEXT NOT NULL, PRIMARY KEY (job_id, tech)) WITHOUT ROWID;
        INSERT OR IGNORE INTO companies (id, slug, name) VALUES (901, 'northwind-systems', 'Northwind Systems');
        INSERT OR IGNORE INTO company_aliases (alias_key, company_id, evidence) VALUES ('name:northwind-systems', 901, 'name');`);
      for (const col of ['experience_level TEXT', 'salary_min_usd INTEGER', 'salary_max_usd INTEGER', 'salary_period TEXT', 'salary_min INTEGER', 'salary_max INTEGER', 'company_icon_url TEXT']) {
        try { db.exec(`ALTER TABLE scraped_jobs ADD COLUMN ${col}`); } catch { /* the fixture has it */ }
      }
      for (const id of db.prepare(`SELECT job_id FROM scraped_jobs WHERE is_active = 1 LIMIT 2`).pluck().all()) db.prepare(`INSERT OR IGNORE INTO job_company (job_id, company_id) VALUES (?, 901)`).run(id);
      for (const [i, id] of ['d191-x', 'd191-y', 'd191-z'].entries()) db.prepare(`INSERT INTO daily_drafts (user_id, profile_id, draft_date, position, job_id, band, card_json) VALUES (1, 1, ?, ?, ?, 'strong', '{}')`).run(TODAY, i, id);
      try { db.prepare(`INSERT INTO user_jobs (user_id, job_id, disliked) VALUES (1, 'd191-z', 1)`).run(); } catch { /* the fixture's own user_jobs */ }
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
const clickPopup = async (h, id, action) => {
  const el = await h.page.evaluateHandle((id, a) => document.getElementById(id)?.shadowRoot?.querySelector(`[data-action="${a}"]`) || null, id, action);
  await el.asElement()?.click();   // puppeteer's click: a real input event — the person's gesture
  return !!el.asElement();
};
const askUrl = (u) => /\/ask\.html(\?|$)/.test(String(u || ''));

export default async function run(h, { check, observe, section }) {
  const origin = new URL(POSTING).origin;
  const { db, browser } = h;

  section('0 · a fresh install — the disclosure page opens once');
  const notice = await waitUntil(() => browser.targets().find(t => /\/notice\.html$/.test(t.url())) || null, 6000, 200);
  check('notice.html opened on install (noticeDue)', !!notice, browser.targets().map(t => t.url()).filter(u => u.startsWith('chrome-extension://')).join(' '));
  if (notice) {
    const np = await notice.page().catch(() => null);
    const text = np ? await np.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '') : '';
    observe('the notice\'s first lines', text.split('\n').filter(Boolean).slice(0, 6).join(' | '));
  }

  section('1 · the posting, captured — then draft\'s own facts for it');
  await h.open(`${origin}/posting`, { settle: 700 });
  await h.send({ type: 'TOOLBAR_PRESS' });
  await waitUntil(() => popupOf(h, 'draft-relay'), BUSY_MS, 200);
  await clickPopup(h, 'draft-relay', 'capture');
  const jobId = await waitUntil(() => db.prepare(`SELECT job_id FROM user_jobs WHERE user_id = 1 AND job_id NOT LIKE 'd191-%' ORDER BY rowid DESC LIMIT 1`).pluck().get() || null, BUSY_MS, 300);
  check('the posting is on Ada\'s board', !!jobId, String(jobId));
  if (!jobId) return;
  const company = db.prepare(`SELECT company FROM scraped_jobs WHERE job_id = ?`).pluck().get(jobId);
  observe('the captured posting', { jobId, company });
  db.prepare(`UPDATE scraped_jobs SET experience_level = 'Senior', salary_min_usd = 150000, salary_max_usd = 190000, salary_period = 'year' WHERE job_id = ?`).run(jobId);
  db.prepare(`INSERT OR REPLACE INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES (?, 'Engineering', 'Backend', 'walk', unixepoch())`).run(jobId);
  for (const t of ['Kafka', 'PostgreSQL', 'Go']) db.prepare(`INSERT OR IGNORE INTO job_tech (job_id, tech) VALUES (?, ?)`).run(jobId, t);
  let heldSeeded = false;
  try { const run = db.prepare(`INSERT INTO apply_runs (user_id, mode, status) VALUES (1, 'auto', 'held')`).run().lastInsertRowid;
    db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, ?, 'held_review')`).run(run, jobId); heldSeeded = true; }
  catch (e) { observe('the held run-job could not be seeded (the harness schema)', e.message); }
  let packetSeeded = false;
  try {
    db.prepare(`INSERT INTO apply_gate_packets (user_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
      VALUES (1, ?, ?, ?, 'server_submit_paused', '{}', 'walk-d191-sp', unixepoch() + 3600)`).run(jobId, `${origin}/posting`, origin);
    packetSeeded = true;
  } catch (e) { observe('the waiting packet could not be seeded', e.message); }
  check('one application waits to be sent from this browser (seeded)', packetSeeded);

  // the press again: the posting is known now → the read carries `facts`
  await sleep(500);
  let pressed = await h.send({ type: 'TOOLBAR_PRESS' });
  if (pressed?.did === 'closed') { await sleep(300); pressed = await h.send({ type: 'TOOLBAR_PRESS' }); }
  observe('the press on the known posting', pressed);
  await sleep(1200);
  const facts = h.api.requests.filter(r => r.path === '/api/extension/page').length;
  observe('POST /api/extension/page calls so far', facts);

  section('2 · the home line — the runner first');
  await h.open(`${origin}/ashby-spa`, { settle: 600 });
  await h.send({ type: 'TOOLBAR_PRESS' });
  const day = await waitUntil(() => popupOf(h, 'draft-home'), BUSY_MS, 200);
  observe('the home line', day);
  check('"… · 1 waiting to send from this browser"', /1 waiting to send from this browser/.test(day?.text || ''), JSON.stringify(day));
  check('Runner first, then Open (T27: two buttons — Matches gives way)', day?.actions?.join(',') === 'open-runner,open-ask', JSON.stringify(day?.actions));

  section('3 · the home line\'s Open — the person\'s click through the dock (DOCK_ACT) → side panel, or the window?');
  const winsBefore = await h.control.evaluate(async () => (await chrome.windows.getAll({ populate: true })).map(w => ({ id: w.id, type: w.type, tabs: (w.tabs || []).map(t => t.url || t.pendingUrl) })));
  const askTargetsBefore = browser.targets().filter(t => askUrl(t.url())).length;
  await clickPopup(h, 'draft-home', 'open-ask');
  await sleep(2500);
  const winsAfter = await h.control.evaluate(async () => (await chrome.windows.getAll({ populate: true })).map(w => ({ id: w.id, type: w.type, tabs: (w.tabs || []).map(t => t.url || t.pendingUrl) })));
  const newWins = winsAfter.filter(w => !winsBefore.some(b => b.id === w.id));
  const asWindow = newWins.find(w => w.type === 'popup' && w.tabs.some(askUrl)) || null;
  const askTargets = browser.targets().filter(t => askUrl(t.url()));
  const inTabs = new Set(winsAfter.flatMap(w => w.tabs));
  const asSidePanel = askTargets.find(t => !inTabs.has(t.url())) || null;
  observe('after Open', { newWindows: newWins, askTargets: askTargets.map(t => `${t.type()} ${t.url().replace(/^chrome-extension:\/\/[^/]+/, '')}`), before: askTargetsBefore });
  observe('THE MEASUREMENT — where Open landed', asSidePanel ? 'Chrome\'s side panel (the gesture survived DOCK_ACT)' : asWindow ? 'the small window (sidePanel.open refused — the gesture did not survive DOCK_ACT)' : 'nowhere');
  check('the panel opened — in the side panel or its fallback window', !!(asSidePanel || asWindow));

  section('4 · the panel at the side panel\'s width (320 px) — the This-job and company cards');
  const extOrigin = h.control.url().split('/').slice(0, 3).join('/');
  // the walk's tab moved to /ashby-spa — back to the posting, and the press reads it again (the facts ride that read)
  await h.page.bringToFront().catch(() => {});
  await h.open(`${origin}/posting`, { settle: 700 });
  let again = await h.send({ type: 'TOOLBAR_PRESS' });
  if (again?.did === 'closed') { await sleep(300); again = await h.send({ type: 'TOOLBAR_PRESS' }); }
  observe('the press on the posting, again', again);
  await sleep(1500);
  {
    const { jobFactsForExtension } = await import('../../services/extensionJobFacts.js');
    let direct; try { direct = jobFactsForExtension(db, 1, jobId, {}); } catch (e) { direct = `threw: ${e.message}`; }
    observe('jobFactsForExtension(db, 1, jobId) directly', direct);
    observe('POST /api/extension/page calls now', h.api.requests.filter(r => r.path === '/api/extension/page').length);
  }
  const postingTab = await h.control.evaluate(async () => (await chrome.tabs.query({})).find(t => /\/posting$/.test(t.url || ''))?.id ?? null);
  const ask = await browser.newPage();
  await ask.setViewport({ width: 320, height: 900 });
  const askLog = [];
  ask.on('pageerror', e => askLog.push(`error: ${e.message}`));
  for (const scheme of ['light', 'dark']) {
    await ask.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await ask.goto(`${extOrigin}/ask.html?tab=${postingTab}`, { waitUntil: 'domcontentloaded' });
    await waitUntil(() => ask.evaluate(() => globalThis.__askReady === true || null), 10000, 200);
    await sleep(400);
    if (scheme === 'light') observe('the panel\'s context (ASK_CONTEXT)', await ask.evaluate((t) => new Promise(r => chrome.runtime.sendMessage({ type: 'ASK_CONTEXT', tabId: t }, x => r(x?.context?.job || null))), postingTab));
    const card = await ask.evaluate(() => {
      const t = (id) => document.getElementById(id)?.textContent || '';
      const shown = (id) => !document.getElementById(id)?.hidden;
      return { job: shown('ask-job'), title: t('ask-job-title'), sub: t('ask-job-sub'), fit: t('ask-job-fit'), works: t('ask-job-works'), state: t('ask-job-state'),
        acts: [...document.querySelectorAll('#ask-job-acts button')].map(b => `${b.textContent}${b.classList.contains('btn-primary') ? '*' : ''}`),
        company: shown('ask-company'), cname: t('ask-company-name'), cfacts: t('ask-company-facts'),
        cacts: [...document.querySelectorAll('#ask-company-acts button')].map(b => b.textContent),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1, bg: getComputedStyle(document.body).backgroundColor };
    });
    observe(`the cards (${scheme})`, card);
    const shot = `d191-sidepanel-${scheme}`;
    await ask.screenshot({ path: `docs/fidelity-shots/${shot}.png`, fullPage: true }).catch(() => null);
    if (scheme === 'light') {
      check('This-job card shown with the posting\'s title', card.job && card.title.length > 0, card.title);
      check('sub line: Backend · Senior · $150k–$190k a year', card.sub === 'Backend · Senior · $150k–$190k a year', card.sub);
      check('Works with Go, Kafka, PostgreSQL (the posting\'s stack)', /^Works with /.test(card.works) && ['Go', 'Kafka', 'PostgreSQL'].every(x => card.works.includes(x)), card.works);
      if (heldSeeded) check('state: Needs you (the held run-job)', card.state === 'Needs you', card.state);
      check('buttons: Apply from here (waits to send from here), Open in draft, Send to a connection', ['Apply from here', 'Open in draft', 'Send to a connection'].every(l => card.acts.some(a => a.startsWith(l))), card.acts.join(' | '));
      check('the job is Ada\'s — no Draft / Save offered', !card.acts.some(a => /^Draft this job|^Save/.test(a)), card.acts.join(' | '));
      check('the company card: Northwind Systems, its open jobs, its page', card.company && card.cname === 'Northwind Systems' && /open jobs? on draft/.test(card.cfacts) && card.cacts.length === 1, `${card.cname} · ${card.cfacts} · ${card.cacts}`);
      observe('fit line (no base résumé in the harness → no score, so no fit word)', card.fit || '(empty)');
    }
    check(`no sideways scroll at 320 px (${scheme})`, !card.overflowX);
  }
  check('the panel threw no page error', askLog.length === 0, askLog.join(' | '));
  await ask.close();

  const model = h.api.requests.filter(r => /assistant\/ask|anthropic|\/v1\/messages/.test(r.path));
  check('⛔ no model route was asked', model.length === 0, JSON.stringify(model));
}

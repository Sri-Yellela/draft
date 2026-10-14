/**
 * D99 J11 · THE BRIDGE — "a job from the board is on the board" (owner, 10-13; "build the bridge", 10-14).
 * ===============================================================================================================
 *   npm run walk:extension -- boardBridge
 *
 * The real extension, its one content script (boardBridge.js — in this TEST build on the test API's origin, standing
 * in for jobsviadraft.com), the REAL lookup route (routes/extensionJob.js; the scorer stubbed to a fixed report) and
 * the web app's REAL helper (client/src/lib/openPosting.js, served as-is to a page on draft's origin):
 *   1. the page knows the extension is here (the nonce on <html>)
 *   2. a page script's message with no click opens nothing and asks nothing
 *   3. a trusted click on a posting link: the extension opens THE SERVER'S address — not the link's — in a new tab,
 *      bound to the job ("via board", with the report); the popup's BOARD_TAB says so; asked of draft's server once
 *   4. a job that is not on the user's board: the extension refuses, and the page opens its own link instead
 * Synthetic job and person (Ada Example).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitUntil, sleep, defaultSeed, TENANT } from '../extensionBrowser.mjs';
import { createExtensionJobRouter } from '../../routes/extensionJob.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT = { score: 72, band: 'strong', scorable: true, matched: ['distributed systems'], missing: ['kubernetes'] };
// https on the walk's tenant: the host resolver maps it to the local fake ATS, which speaks no TLS — the tab is OPENED
// and BOUND (what this walk proves); its page does not load, and nothing leaves the machine.
const SERVER_URL = `https://${TENANT}/Zoom/job/Remote--(US)/Data-Engineer_R30001`;
const PAGE_LINK = 'https://page-link.invalid/posting';   // the link the page itself would open

const BOARD_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>board</title></head><body>
<a id="posting" href="${PAGE_LINK}" target="_blank" rel="noopener noreferrer">Synthco</a>
<script type="module">
  import { postingClick } from '/walk/openPosting.js';
  let job = { jobId: 'wd-bridge-1', applyUrl: '${PAGE_LINK}' };
  window.__setJob = (id) => { job = { jobId: id, applyUrl: '${PAGE_LINK}' }; };
  document.getElementById('posting').addEventListener('click', (e) => postingClick(job, e));
  window.__results = [];
  window.addEventListener('message', (e) => { if (e.data && e.data.source === 'draft-extension') window.__results.push(e.data); });
  window.__forge = (jobId) => window.postMessage({ source: 'draft-board', type: 'OPEN_JOB', jobId,
    nonce: document.documentElement.dataset.draftExtension }, location.origin);
</script></body></html>`;

export const options = {
  hosts: [`http://${TENANT}/*`, `https://${TENANT}/*`],
  api: {
    seed: (db) => {
      defaultSeed(db);
      db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
        VALUES ('wd-bridge-1','Data Engineer','Synthco','Remote (US)',?,?,'t','hb1',unixepoch()-3600)`).run(SERVER_URL, SERVER_URL);
    },
    mount: async (app, db) => {
      app.get('/walk/board', (_q, res) => res.type('html').send(BOARD_PAGE));
      app.get('/walk/openPosting.js', (_q, res) => res.type('application/javascript')
        .send(fs.readFileSync(path.join(ROOT, 'client', 'src', 'lib', 'openPosting.js'), 'utf8')));
      app.use(createExtensionJobRouter({ db, requireAuth: (q, r, n) => n(), isExtension: () => true,
        scoreFor: () => REPORT, hasBaseResume: () => true }));
    },
  },
};
export const description = 'D99 J11: a trusted click on the board opens the SERVER\'s address, bound "via board" with the report; no click, nothing; not on the board → the page\'s own link';

const lookups = (h) => h.api.requests.filter(r => r.method === 'GET' && r.path.startsWith('/api/extension/job/')).length;
// Through the extension (it holds the tenant's host grant in this build): a tab whose page failed to load still names
// the address it was opened at, where puppeteer reports chrome-error://.
const tabUrls = async (h) => (await h.control.evaluate(() => chrome.tabs.query({}))).map(t => t.pendingUrl || t.url);

export default async function run(h, { check, section }) {
  section('1 · the board page knows the extension is here');
  await h.open(`${h.api.origin}/walk/board`, { settle: 400 });
  const nonce = await h.page.evaluate(() => document.documentElement.dataset.draftExtension || null);
  check('the bridge marked the page (a per-load nonce)', typeof nonce === 'string' && nonce.length >= 8, String(nonce));

  section('2 · a page script with no click opens nothing (before any click: a click\'s activation lasts ~5 s)');
  const tabs0 = (await tabUrls(h)).length, look0 = lookups(h);
  // ⚠ puppeteer's evaluate runs WITH a user gesture (CDP userGesture: true), so the forge is scheduled to fire after
  // Chrome's ~5 s transient activation has expired — what a page script that no one clicked looks like.
  await h.page.evaluate(() => { setTimeout(() => window.__forge('wd-bridge-1'), 6500); });
  await sleep(7500);
  check('no tab opened', (await tabUrls(h)).length === tabs0, JSON.stringify(await tabUrls(h)));
  check('…and draft\'s server was not asked', lookups(h) === look0);
  check('…the page was told why', (await h.page.evaluate(() => window.__results)).at(-1)?.error === 'no_click');

  section('3 · a trusted click — the extension opens the server\'s address, bound to the job');
  const before = lookups(h);
  await h.page.bringToFront();
  await h.page.click('#posting');
  const opened = await waitUntil(async () => ((await tabUrls(h)).includes(SERVER_URL) ? true : null), 8000);
  check('a new tab at THE SERVER\'S address', opened === true, JSON.stringify(await tabUrls(h)));
  check('…and never the link the page carried', !(await tabUrls(h)).includes(PAGE_LINK));
  check('asked of draft\'s server once', lookups(h) - before === 1, `${lookups(h) - before}`);
  const results = await h.page.evaluate(() => window.__results);
  check('the page was told it was handed over', results.at(-1)?.ok === true, JSON.stringify(results));
  const binds = await h.bindings();
  const b = binds.map(([, v]) => v).find(v => v.jobId === 'wd-bridge-1');
  check('the new tab is bound to the job, via board', b?.via === 'board', JSON.stringify(binds));
  check('…with draft\'s report', b?.board?.ats?.score === 72 && b.board.ats.state === 'ready', JSON.stringify(b?.board));
  const popup = await h.send({ type: 'BOARD_TAB' });
  check('the popup\'s BOARD_TAB names it — no page read, no request', popup?.board?.jobId === 'wd-bridge-1' && popup.board.ats?.score === 72, JSON.stringify(popup));

  section('4 · a job that is not on the board — the page opens its own link');
  await h.page.bringToFront();
  await sleep(5500);   // past the last click's activation
  await h.page.evaluate(() => window.__setJob('wd-not-mine'));
  const tabs1 = (await tabUrls(h)).length;
  await h.page.click('#posting');
  const fell = await waitUntil(async () => ((await tabUrls(h)).length > tabs1 ? true : null), 8000);
  check('a tab opened — the page\'s own fallback', fell === true, JSON.stringify(await tabUrls(h)));
  check('…the extension refused it (not on the board)', (await h.page.evaluate(() => window.__results)).at(-1)?.error === 'not_on_board',
    JSON.stringify(await h.page.evaluate(() => window.__results)));
  const unbound = (await h.bindings()).map(([, v]) => v).filter(v => v.jobId === 'wd-not-mine');
  check('…and nothing was bound to it', unbound.length === 0);
}

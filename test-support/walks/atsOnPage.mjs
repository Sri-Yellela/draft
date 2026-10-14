/**
 * D99 J12 · ATS ON THE PAGE — "the ATS button opens the free checker and asks me to upload a résumé" (owner, 10-13).
 * ===============================================================================================================
 *   npm run walk:extension -- atsOnPage [--theme dark]
 *
 * The real extension on the Workday-shaped fixture, with the REAL lookup route mounted (routes/extensionJob.js; the
 * scorer stubbed to a fixed report — the score's own correctness is the web app's, tested there):
 *   1. a bound job: the on-page panel shows draft's report AT ONCE — "ATS 72 · Strong match", matched and missing
 *      terms, "Full report in draft" — asked of draft's server, nothing stored
 *   2. no base résumé: "Add your résumé in draft", no score
 *   3. an UNLINKED tab: "This tab is not linked …" is a button — a trusted "Read this page now" finds the job on draft,
 *      binds the tab, and the panel shows the job and its report; a page script's synthetic click reads nothing
 * Synthetic person (Ada Example).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitUntil, sleep, defaultSeed } from '../extensionBrowser.mjs';
import { mountExtensionResume, seedBaseResume } from '../extensionResumeStub.mjs';
import { createExtensionJobRouter } from '../../routes/extensionJob.js';
import { baseResumeFor } from '../../services/extensionResume.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT = { score: 72, band: 'strong', scorable: true, matched: ['distributed systems', 'go'], missing: ['kubernetes'] };

export const options = {
  api: {
    seed: (db) => { defaultSeed(db); seedBaseResume(db); },
    mount: async (app, db) => {
      mountExtensionResume(app, db);
      app.use(createExtensionJobRouter({ db, requireAuth: (q, r, n) => n(), isExtension: () => true,
        scoreFor: () => REPORT, hasBaseResume: (userId) => !!baseResumeFor(db, userId) }));
    },
  },
};
export const description = 'D99 J12: draft\'s own report in the on-page panel at once; no base résumé → "Add your résumé"; an unlinked tab → "Read this page now"';

const HOST = 'rm-resume-panel';
const readPanel = (h) => h.readShadow(HOST, (root, host) => ({
  state: host.dataset.state,
  job: root.querySelector('[data-role="job"]')?.textContent || null,
  text: root.querySelector('.sc')?.textContent.replace(/\s+/g, ' ').trim() || '',
  report: root.querySelector('[data-role="ats-report"]')?.dataset.state || null,
  score: root.querySelector('[data-role="ats-score"]')?.textContent || null,
  matched: root.querySelector('[data-role="ats-matched"]')?.textContent || null,
  missing: root.querySelector('[data-role="ats-missing"]')?.textContent || null,
  buttons: [...root.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean),
}));
const lookups = (h) => h.api.requests.filter(r => r.method === 'GET' && r.path.startsWith('/api/extension/job/')).length;
const contexts = (h) => h.api.requests.filter(r => r.method === 'POST' && r.path === '/api/import/context').length;

export default async function run(h, { check, section }) {
  if (!/from '\.\/resumePanel\.js'/.test(fs.readFileSync(path.join(ROOT, 'extension', 'background.js'), 'utf8'))) {
    check('the shipped router wires resumePanel.js', false);
    return;
  }

  section('1 · a bound job — draft\'s report, at once');
  await h.openStage('applyManually');
  const cap = await h.capture();
  check('captured — the tab is bound', cap?.success === true, cap?.message);
  const before = lookups(h);
  const opened = await h.send({ type: 'RESUME_PANEL_OPEN' });
  check('the panel opens', opened?.ok === true, JSON.stringify(opened));
  const p1 = await waitUntil(async () => { const p = await readPanel(h); return p?.report ? p : null; }, 8000);
  check('the report is in the panel with no other click', p1?.report === 'ready', JSON.stringify(p1));
  check('…the score and the web app\'s band words', p1?.score === 'ATS 72 · Strong match', p1?.score);
  check('…the matched terms', /Matched: distributed systems, go/.test(p1?.matched || ''), p1?.matched);
  check('…the missing terms', /Missing: kubernetes/.test(p1?.missing || ''), p1?.missing);
  check('…and "Full report in draft"', (p1?.buttons || []).includes('Full report in draft'), JSON.stringify(p1?.buttons));
  check('asked of draft\'s server once', lookups(h) - before === 1, `${lookups(h) - before}`);
  const local = JSON.stringify(await h.storage.local()) + JSON.stringify(await h.storage.session());
  check('nothing of the report is stored', !/kubernetes|distributed systems/.test(local));

  section('2 · no base résumé');
  h.db.prepare('DELETE FROM profile_base_resumes').run();
  await h.send({ type: 'RESUME_PANEL_OPEN' });
  const p2 = await waitUntil(async () => { const p = await readPanel(h); return p?.report === 'no_base_resume' ? p : null; }, 8000);
  check('"Add your résumé in draft" — and no score', !!p2 && !p2.score && (p2.buttons || []).includes('Add your résumé in draft'), JSON.stringify(p2));
  seedBaseResume(h.db);

  section('3 · an unlinked tab — "Read this page now"');
  await h.send({ type: 'UNBIND_TAB' });
  await h.send({ type: 'RESUME_PANEL_OPEN' });
  const p3 = await waitUntil(async () => { const p = await readPanel(h); return p?.state === 'nojob' ? p : null; }, 8000);
  check('not linked: the message names the button', /Read this page now/.test(p3?.text || ''), p3?.text);
  check('…and the button is there', (p3?.buttons || []).includes('Read this page now'), JSON.stringify(p3?.buttons));
  check('…with no report and no free checker', !p3?.report && !(p3?.buttons || []).some(b => /checker|upload/i.test(b)));
  const ctx0 = contexts(h);
  await h.page.evaluate(() => document.getElementById('rm-resume-panel').shadowRoot.querySelector('[data-role="read"]').click());
  await sleep(500);
  check('⛔ a page script\'s synthetic click reads nothing', contexts(h) === ctx0);
  await h.page.click(`#${HOST} >>> [data-role="read"]`);
  const p4 = await waitUntil(async () => { const p = await readPanel(h); return p?.state !== 'nojob' && p?.report ? p : null; }, 8000);
  check('a trusted click: draft found the job, and the panel names it', p4?.job === 'Software Engineer at Zoom', JSON.stringify(p4));
  check('…with its report', p4?.score === 'ATS 72 · Strong match', p4?.score);
  check('…and the tab is bound again', (await h.bindings()).length === 1, JSON.stringify(await h.bindings()));
}

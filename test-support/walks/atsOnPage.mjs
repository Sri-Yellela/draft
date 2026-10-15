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
 *   4. ⭐ T9: a FULL report (the scorer's own JSON, as the live route passes it through): the panel draws the web app's
 *      ATS component (<draft-ats-report>'s renderer, in its own shadow root) instead of the summary lines — terms as text
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
// ⭐ T9 · section 4: the scorer's OWN report rides along (routes/extensionJob.js reportOf → `ats.report`), as the live
// scorer sends it — and the panel then draws THE web app's component from it. A job term that is markup is in it.
const FULL = Object.freeze({
  ...REPORT,
  report: {
    source: 'local_ats_v5', score: 72, scorable: true,
    tier1_matched: ['distributed systems', 'go'], tier1_missing: ['kubernetes', '<img src=x onerror=alert(1)>'],
    competencies_matched: ['ownership'], competencies_missing: ['mentoring'],
    action_verbs_matched: ['Shipped'], action_verbs_missing: ['Scaled'], action_verbs_generic: ['Managed'],
    decline_reasons: [], hard_constraint_misses: [],
    experience: { summary: 'Résumé experience (6 years) meets 4+ year requirement.', requiredYears: 4, candidateYears: 6, fit: true },
    seniority_cap: { applied: false }, internal_debug: { not: 'for the card' },
  },
});
let scoreNow = REPORT;

export const options = {
  api: {
    seed: (db) => { defaultSeed(db); seedBaseResume(db); },
    mount: async (app, db) => {
      mountExtensionResume(app, db);
      app.use(createExtensionJobRouter({ db, requireAuth: (q, r, n) => n(), isExtension: () => true,
        scoreFor: () => scoreNow, hasBaseResume: (userId) => !!baseResumeFor(db, userId) }));
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

  section('4 · T9 — a FULL report: the panel draws the web app\'s ATS component');
  scoreNow = FULL;
  const before4 = lookups(h);
  await h.send({ type: 'RESUME_PANEL_OPEN' });
  const p5 = await waitUntil(async () => {
    const c = await h.readShadow(HOST, (root) => {
      const host = root.querySelector('[data-role="ats-card"]');
      const card = host?.shadowRoot;
      if (!card?.querySelector('[data-ats-root]')) return null;
      return {
        score: card.querySelector('[data-ats-score]')?.textContent.replace(/\s+/g, ' ').trim() || null,
        text: card.querySelector('[data-ats-root]').textContent.replace(/\s+/g, ' '),   // the card's words, not its stylesheet
        imgs: card.querySelectorAll('img').length,
        style: !!card.querySelector('style[data-ats-style]'),
        summaryLines: !!root.querySelector('[data-role="ats-score"], [data-role="ats-matched"], [data-role="ats-missing"]'),
        buttons: [...root.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean),
        width: Math.round(host.getBoundingClientRect().width),
      };
    });
    return c || null;
  }, 8000);
  check('the panel mounts the component in its own shadow root, with its stylesheet', !!p5 && p5.style, JSON.stringify(p5));
  check('…the scorer\'s number', /72/.test(p5?.score || ''), p5?.score);
  check('…the matched and missing terms as the web app words them', /distributed systems/.test(p5?.text || '') && /kubernetes/.test(p5?.text || ''), p5?.text?.slice(0, 300));
  check('…the experience line', /meets 4\+ year requirement/.test(p5?.text || ''));
  check('⛔ the markup term prints as characters — no element made from it', p5?.imgs === 0 && /<img src=x onerror=alert\(1\)>/.test(p5?.text || ''), `${p5?.imgs}`);
  check('⛔ a field the card does not draw stays out', !/for the card/.test(p5?.text || ''));
  check('the summary lines give way to the component (no second report)', p5?.summaryLines === false);
  check('…and the panel keeps its own "Full report in draft"', (p5?.buttons || []).includes('Full report in draft'), JSON.stringify(p5?.buttons));
  check('…laid out (not a zero-width box)', (p5?.width || 0) > 200, `${p5?.width}`);
  check('asked of draft\'s server once more', lookups(h) - before4 === 1, `${lookups(h) - before4}`);
  const local4 = JSON.stringify(await h.storage.local()) + JSON.stringify(await h.storage.session());
  check('nothing of the full report is stored', !/kubernetes|mentoring|onerror/.test(local4));
  await h.screenshot(`atsOnPage-full-report-${h.theme()}`).catch(() => null);
  scoreNow = REPORT;
}

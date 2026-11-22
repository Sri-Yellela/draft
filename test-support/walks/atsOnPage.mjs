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
 *   5. ⭐ 47b: a REAL plausibility flag (the real services/atsPlausibility.js on the base résumé, wired as server.js wires
 *      it): "Does it add up?" shows it; a page script's click dismisses nothing; the person's trusted Dismiss records it on
 *      draft's server and the row leaves; reopened, it stays dismissed
 * Synthetic person (Ada Example).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitUntil, sleep, defaultSeed, BUSY_MS } from '../extensionBrowser.mjs';
import { mountExtensionResume, seedBaseResume } from '../extensionResumeStub.mjs';
import { createExtensionJobRouter } from '../../routes/extensionJob.js';
import { baseResumeFor } from '../../services/extensionResume.js';
import { plausibilityFor, dismissFlag } from '../../services/atsPlausibility.js';

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
        scoreFor: () => scoreNow, hasBaseResume: (userId) => !!baseResumeFor(db, userId),
        // ⭐ 47b: the flags as server.js wires them — the real service on the active profile's base résumé
        plausibility: (userId) => { const b = baseResumeFor(db, userId); return b ? plausibilityFor(db, { userId, text: b.text }) : null; },
        dismissFlag: (userId, key, undo) => dismissFlag(db, userId, key, { undo }) }));
    },
  },
};
export const description = 'D99 J12: draft\'s own report in the on-page panel at once; no base résumé → "Add your résumé"; an unlinked tab → "Read this page now"';

// ⭐ T17: ONE dock, two of its tabs drawn from one model — the Résumé tab (rm-resume-panel: the state, the job, Read this
// page now) and the ATS tab (rm-ats-panel: draft's report). The walk reads both, as it read the one panel before.
const HOST = 'rm-resume-panel';
const ATS = 'rm-ats-panel';
const readPanel = (h) => h.page.evaluate(() => {
  const r = document.getElementById('rm-resume-panel'); const a = document.getElementById('rm-ats-panel');
  if (!r?.shadowRoot || !a?.shadowRoot) return null;
  const R = r.shadowRoot, A = a.shadowRoot;
  return {
    state: r.dataset.state,
    job: R.querySelector('[data-role="job"]')?.textContent || null,
    text: R.querySelector('.sc')?.textContent.replace(/\s+/g, ' ').trim() || '',
    report: A.querySelector('[data-role="ats-report"]')?.dataset.state || null,
    score: A.querySelector('[data-role="ats-score"]')?.textContent || null,
    matched: A.querySelector('[data-role="ats-matched"]')?.textContent || null,
    missing: A.querySelector('[data-role="ats-missing"]')?.textContent || null,
    buttons: [...R.querySelectorAll('button'), ...A.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim()).filter(Boolean),
  };
});
const lookups = (h) => h.api.requests.filter(r => r.method === 'GET' && r.path.startsWith('/api/extension/job/')).length;
const contexts = (h) => h.api.requests.filter(r => r.method === 'POST' && r.path === '/api/import/context').length;
// BINDING FIRST: every read of the page starts with ONE identify (identify.js identifyAndBind)
const identifies = (h) => h.api.requests.filter(r => r.method === 'POST' && r.path === '/api/extension/page').length;

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
  const opened = await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'ats' });
  check('the panel opens', opened?.ok === true, JSON.stringify(opened));
  const p1 = await waitUntil(async () => { const p = await readPanel(h); return p?.report ? p : null; }, BUSY_MS);
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
  const p2 = await waitUntil(async () => { const p = await readPanel(h); return p?.report === 'no_base_resume' ? p : null; }, BUSY_MS);
  check('"Add your résumé in draft" — and no score', !!p2 && !p2.score && (p2.buttons || []).includes('Add your résumé in draft'), JSON.stringify(p2));
  seedBaseResume(h.db);

  section('3 · an unlinked tab — "Read this page now"');
  await h.send({ type: 'UNBIND_TAB' });
  await h.send({ type: 'RESUME_PANEL_OPEN' });
  const p3 = await waitUntil(async () => { const p = await readPanel(h); return p?.state === 'nojob' ? p : null; }, BUSY_MS);
  check('not linked: the message names the button', /Read this page now/.test(p3?.text || ''), p3?.text);
  check('…and the button is there', (p3?.buttons || []).includes('Read this page now'), JSON.stringify(p3?.buttons));
  check('…with no report and no free checker', !p3?.report && !(p3?.buttons || []).some(b => /checker|upload/i.test(b)));
  const ctx0 = contexts(h), id0 = identifies(h);
  await h.page.evaluate(() => document.getElementById('rm-resume-panel').shadowRoot.querySelector('[data-role="read"]').click());
  await sleep(500);   // expects NOTHING — and the ONE-identify count below would show a read that came late
  check('⛔ a page script\'s synthetic click reads nothing', contexts(h) === ctx0 && identifies(h) === id0);
  await h.page.click(`#${HOST} >>> [data-role="read"]`);
  // ⭐ (open item 2) the read's own steps, each waited for in turn — identify → bind (the worker), then the panel drawn
  // from the click's reply (the page) — so a slow machine fails on the step that did not come, never on an 8 s guess.
  // Under load the panel was drawn later than 8 s after the click, the binding already in place.
  const bound = await waitUntil(async () => ((await h.bindings()).length === 1 ? true : null), BUSY_MS);
  check('a trusted click identified the page and bound the tab again', bound === true, JSON.stringify(await h.bindings()));
  const p4 = await waitUntil(async () => { const p = await readPanel(h); return p?.state !== 'nojob' && p?.report ? p : null; }, BUSY_MS);
  check('…draft found the job, and the panel names it', p4?.job === 'Software Engineer at Zoom', JSON.stringify(p4 || await readPanel(h)));
  check('…with its report', p4?.score === 'ATS 72 · Strong match', p4?.score);
  check('⛔ only the trusted click read the page — ONE identify', identifies(h) - id0 === 1, `${identifies(h) - id0} identify request(s)`);

  // ⭐ 47a E1 (owner 11-21, moved on purpose): the ATS tab draws the web's ATS CARD (shared/contextualView.js atsCardView) — it
  // replaced the T9 report on the web in 46x (option C), and now in the extension: the number, its parts, the biggest gain.
  section('4 · 47a E1 — a FULL report: the panel draws the web\'s ATS card');
  scoreNow = FULL;
  const before4 = lookups(h);
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'ats' });
  const p5 = await waitUntil(async () => {
    const c = await h.readShadow(ATS, (root) => {
      const card = root.querySelector('[data-role="ats-card-view"]');
      if (!card) return null;
      return {
        score: card.querySelector('[data-role="ats-card-score"]')?.textContent.replace(/\s+/g, ' ').trim() || null,
        band: card.querySelector('[data-role="ats-card-score"]')?.getAttribute('data-band') || null,
        parts: [...card.querySelectorAll('[data-ats-part]')].map(e => e.getAttribute('data-ats-part')),
        text: card.textContent.replace(/\s+/g, ' '),
        imgs: card.querySelectorAll('img').length,
        oldComponent: !!root.querySelector('[data-role="ats-card"]'),
        summaryLines: !!root.querySelector('[data-role="ats-score"], [data-role="ats-matched"], [data-role="ats-missing"]'),
        buttons: [...root.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim()).filter(Boolean),
        width: Math.round(card.getBoundingClientRect().width),
        // ⭐ 47b: each part's figure inside the card (it took the preview's .pv — an 816 px paper strip past the edge)
        figures: [...card.querySelectorAll('[data-ats-part]')].map(pt => { const f = pt.lastElementChild, r = f.getBoundingClientRect(), c = card.getBoundingClientRect();
          return { text: f.textContent.trim(), inside: r.left >= c.left - 1 && r.right <= c.right + 1, w: Math.round(r.width), bg: getComputedStyle(f).backgroundColor }; }),
      };
    });
    return c || null;
  }, BUSY_MS);
  check('the panel draws the web\'s ATS card (no older component beside it)', !!p5 && p5.oldComponent === false, JSON.stringify(p5));
  check('…the scorer\'s number, painted by its band', /72%/.test(p5?.score || '') && !!p5?.band, `${p5?.score} ${p5?.band}`);
  check('…its Skills part', (p5?.parts || []).includes('skill_match'), JSON.stringify(p5?.parts));
  check('⛔ no element made from a term (markup prints as characters)', p5?.imgs === 0, `${p5?.imgs}`);
  check('⛔ a field the card does not draw stays out', !/for the card/.test(p5?.text || ''));
  check('the summary lines give way to the card (no second report)', p5?.summaryLines === false);
  check('…and the panel keeps its own "Full report in draft"', (p5?.buttons || []).includes('Full report in draft'), JSON.stringify(p5?.buttons));
  check('…laid out (not a zero-width box)', (p5?.width || 0) > 200, `${p5?.width}`);
  check('…each part\'s figure is its number, inside the card, on no paper of its own', (p5?.figures || []).length > 0 && p5.figures.every(f => /^\d+$/.test(f.text) && f.inside && f.w <= 40 && /rgba\(0, 0, 0, 0\)|transparent/.test(f.bg)), JSON.stringify(p5?.figures));
  check('asked of draft\'s server once more', lookups(h) - before4 === 1, `${lookups(h) - before4}`);
  const local4 = JSON.stringify(await h.storage.local()) + JSON.stringify(await h.storage.session());
  check('nothing of the full report is stored', !/kubernetes|mentoring|onerror/.test(local4));
  await h.screenshot(`atsOnPage-full-report-${h.theme()}`).catch(() => null);

  // ⭐ 47b (47a's unknown: "the flags' Dismiss was not walked end to end in a real Chrome") — a REAL flag from the real
  // service: GPT-4 named in a role that ended in 2021 (the timeline check needs no employer record), Dismiss pressed for real.
  section('5 · 47b — a real plausibility flag, and the person\'s Dismiss');
  const base0 = h.db.prepare('SELECT content FROM profile_base_resumes WHERE user_id = 1').get()?.content;
  h.db.prepare('UPDATE profile_base_resumes SET content = ? WHERE user_id = 1').run(`${base0}\nExperience\nSoftware Engineer — Kestrel Labs\nJan 2019 – Dec 2021\n- Built GPT-4 pipelines for support triage\n- Built services in Go`);
  const flagRows = (root) => [...root.querySelectorAll('[data-role="plausibility"] [data-flag]')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  const dismissals = () => h.db.prepare('SELECT flag_key FROM ats_flag_dismissals WHERE user_id = 1').pluck().all();
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'ats' });
  const f1 = await waitUntil(async () => { const r = await h.readShadow(ATS, flagRows); return r?.length ? r : null; }, BUSY_MS);
  check('"Does it add up?" shows the real flag', (f1 || []).some(t => /GPT-4 came out in 2023, after this role ended \(2021\)/.test(t)), JSON.stringify(f1));
  check('…naming the employer and the bullet', (f1 || []).some(t => /Kestrel Labs: Built GPT-4 pipelines/.test(t)), JSON.stringify(f1));
  check('…once (Go in 2019 is not flagged)', (f1 || []).length === 1, JSON.stringify(f1));
  check('…with its Dismiss button', !!(await h.readShadow(ATS, (root) => !!root.querySelector('[data-role="plausibility"] [data-dismiss="0"]'))));
  await h.screenshot(`atsOnPage-flag-${h.theme()}`).catch(() => null);
  await h.page.evaluate(() => document.getElementById('rm-ats-panel').shadowRoot.querySelector('[data-dismiss="0"]').click());
  await sleep(500);   // expects NOTHING
  check('⛔ a page script\'s synthetic click dismisses nothing', dismissals().length === 0 && (await h.readShadow(ATS, flagRows))?.length === 1, JSON.stringify(dismissals()));
  await h.page.click(`#${ATS} >>> [data-dismiss="0"]`);
  const keys = await waitUntil(async () => (dismissals().length ? dismissals() : null), BUSY_MS);
  check('the person\'s trusted Dismiss is recorded on draft\'s server', (keys || []).length === 1 && /^timeline\|kestrel labs\|built gpt 4 pipelines/.test(keys[0]), JSON.stringify(keys));
  const gone = await waitUntil(async () => ((await h.readShadow(ATS, flagRows))?.length === 0 ? true : null), BUSY_MS);
  check('…and the row leaves the panel', gone === true, JSON.stringify(await h.readShadow(ATS, flagRows)));
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'ats' });
  await waitUntil(async () => (await h.readShadow(ATS, (root) => !!root.querySelector('[data-role="ats-card-view"]'))) || null, BUSY_MS);
  await sleep(800);   // the flags are asked after the card is drawn — give them the time to come back (expects none)
  const again = await h.send({ type: 'RESUME_FLAGS' }).catch(() => null);
  check('reopened, it stays dismissed (the panel and the server\'s answer)', (await h.readShadow(ATS, flagRows))?.length === 0, JSON.stringify(await h.readShadow(ATS, flagRows)));
  const direct = plausibilityFor(h.db, { userId: 1, text: baseResumeFor(h.db, 1).text });
  check('…the service counts it dismissed, kept across a re-score', direct.flags === 0 && direct.dismissed === 1, JSON.stringify({ flags: direct.flags, dismissed: direct.dismissed, viaWorker: again }));
  const local5 = JSON.stringify(await h.storage.local()) + JSON.stringify(await h.storage.session());
  check('nothing of the flag is stored in the extension', !/GPT-4|Kestrel/.test(local5));
  h.db.prepare('UPDATE profile_base_resumes SET content = ? WHERE user_id = 1').run(base0);
  h.db.prepare('DELETE FROM ats_flag_dismissals').run();
  scoreNow = REPORT;
}

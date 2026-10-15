/**
 * ⭐ T24 · THE INTENT MODEL — the real extension on the Workday-shaped fixture (field report 4, 10-15).
 * ================================================================================================================
 *   npm run walk:extension -- intentPath [--theme dark]
 *
 * Proves, in a real Chrome, on the SHIPPED router, with the REAL Draft (routes/apply.js startRun, the user's line HELD so
 * no browser run ever starts), the REAL extension Draft route (routes/extensionDraft.js) and the résumé service with its
 * generation STUBBED (test-support/extensionResumeStub.mjs — nothing leaves the machine):
 *   1. a captured job, My Experience, nothing done on the tab yet: Open dock — the dock ASKS the one question ("Draft this
 *      job and queue its résumé, or just fill this form yourself?") with Remember my choice
 *   2. Remember ticked + "Draft it and queue its résumé" (trusted clicks): ONE drafted application, ONE generation, the
 *      dock says "Drafted — résumé queued, ready in about 40 s.", the answer kept with the ACCOUNT (not the browser)
 *   3. the popup's Draft (/d) pressed again: "already drafted" — nothing more queued
 *   4. the dock's one-press switch, "Fill it myself instead": the tab's path is manual, said in words
 * Synthetic person (Ada Example) throughout.
 */
import express from 'express';
import { waitUntil, sleep, defaultSeed } from '../extensionBrowser.mjs';
import { mountExtensionResume, seedBaseResume } from '../extensionResumeStub.mjs';
import applyRoutes from '../../routes/apply.js';
import { createExtensionDraftRouter } from '../../routes/extensionDraft.js';

let CTL = null;
export const options = {
  api: {
    seed: (db) => {
      defaultSeed(db);
      seedBaseResume(db);
      // the user's line is HELD (Draft House's Stop everything): the Draft is admitted and WAITS — no run, no browser
      db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_user_hold:1', '1')").run();
    },
    mount: async (app, db) => {
      CTL = mountExtensionResume(app, db);
      // the SAME startRun the harness's own applyRoutes serves — bound to the same database, its routes on a throwaway app
      const hooks = applyRoutes(express(), db, (q, r, n) => n(), () => ({}), async () => ({}), async () => Buffer.from('%PDF-1.4'), async () => ({}), () => null, {});
      app.use(createExtensionDraftRouter({ db, requireAuth: (q, r, n) => n(), isExtension: () => true,
        draftForExtension: hooks.draftForExtension, draftStateOf: hooks.draftStateOf, runBar: hooks.runBar, resume: CTL.service }));
    },
  },
};

export const description = 'T24: the dock asks once and remembers with the account; Draft queues ONE application and ONE résumé; a second Draft queues nothing; the switch says the manual path';

const HOST = 'draft-intent-path';
const pathLine = (h) => h.readShadow(HOST, (root) => {
  const box = root.querySelector('[data-intent-tone]');
  if (!box) return null;
  return { tone: box.dataset.intentTone, line: root.querySelector('[data-role="intent-line"]')?.textContent || '',
    buttons: [...root.querySelectorAll('button')].map(b => b.textContent), remember: !!root.querySelector('[data-role="remember"]') };
});
/** A TRUSTED click on a control inside the path line's shadow root (puppeteer moves the mouse and presses). */
async function press(h, selector) {
  const el = await h.page.evaluateHandle((id, sel) => document.getElementById(id)?.shadowRoot?.querySelector(sel) || null, HOST, selector);
  const node = el.asElement();
  if (!node) return false;
  await node.click();
  return true;
}
const runJobs = (h) => h.db.prepare('SELECT COUNT(*) FROM apply_run_jobs').pluck().get();
const generations = (h) => h.db.prepare('SELECT COUNT(*) FROM extension_resume_generations').pluck().get();
const draftPosts = (h) => h.api.requests.filter(r => r.method === 'POST' && r.path === '/api/extension/draft').length;

export default async function run(h, { check, observe, section }) {
  section('1 · a captured job, nothing done on the tab — Open dock asks the one question');
  await h.openStage('applyManually');
  const cap = await h.capture();
  check('captured — the tab is bound to the job', cap?.success === true, cap?.message);
  await h.goStep('myExperience');
  const opened = await h.send({ type: 'DOCK_OPEN', tab: 'fill' });
  check('the dock opened', opened?.ok === true, JSON.stringify(opened));
  const asked = await waitUntil(async () => { const p = await pathLine(h); return p?.tone === 'ask' ? p : null; }, 10000, 150);
  observe('the path line', asked);
  check('the dock asks: "Draft this job and queue its résumé, or just fill this form yourself?"',
    asked?.line === 'Draft this job and queue its résumé, or just fill this form yourself?', JSON.stringify(asked));
  check('…with both answers and Remember my choice', asked?.buttons.join(' · ') === 'Draft it and queue its résumé · Just fill it myself' && asked.remember, JSON.stringify(asked));
  check('nothing was drafted by opening the dock', runJobs(h) === 0 && generations(h) === 0 && draftPosts(h) === 0);

  section('2 · Remember + "Draft it and queue its résumé" — ONE application, ONE résumé, the path in words');
  check('Remember ticked (a trusted click)', await press(h, '[data-role="remember"]'));
  check('"Draft it" pressed (a trusted click)', await press(h, 'button[data-choice="drafted"]'));
  const drafted = await waitUntil(async () => { const p = await pathLine(h); return p?.line?.startsWith('Drafted') ? p : null; }, 15000, 150);
  check('the dock says: "Drafted — résumé queued, ready in about 40 s."', drafted?.line === 'Drafted — résumé queued, ready in about 40 s.', JSON.stringify(drafted));
  check('…with the one-press switch', drafted?.buttons.join() === 'Fill it myself instead', JSON.stringify(drafted?.buttons));
  check('exactly ONE drafted application', runJobs(h) === 1, String(runJobs(h)));
  check('exactly ONE résumé generation', generations(h) === 1, String(generations(h)));
  check('⛔ it waits for review — the board\'s Draft, never full auto', h.db.prepare('SELECT approval_mode FROM apply_runs').pluck().get() === 'required');
  const settings = await (await fetch(`${h.api.origin}/api/settings/extension-intent`)).json();
  check('the answer is kept with the ACCOUNT (Remember my choice)', settings?.remembered === 'drafted', JSON.stringify(settings));
  const binds = (await h.bindings()).map(([, v]) => v);
  check('the tab\'s path is drafted (its binding)', binds.some(b => b.path === 'drafted'), JSON.stringify(binds.map(b => b.path)));

  section('3 · the popup\'s Draft again — already drafted, nothing more queued');
  await h.page.bringToFront();
  const again = await h.send({ type: 'INTENT_DRAFT', trigger: 'click' });
  check('the press answers "already" — in Draft House', again?.already === true && /^Drafted — in Draft House/.test(again.message || ''), JSON.stringify(again));
  check('still ONE application and ONE generation', runJobs(h) === 1 && generations(h) === 1, `${runJobs(h)} / ${generations(h)}`);
  check('…and no second Draft was even sent: the server state said it first', draftPosts(h) === 1, String(draftPosts(h)));

  section('4 · the switch — "Fill it myself instead"');
  await sleep(300);
  check('the switch pressed (a trusted click)', await press(h, 'button[data-choice="manual"]'));
  const manual = await waitUntil(async () => { const p = await pathLine(h); return p?.line?.startsWith('Filling by hand') ? p : null; }, 10000, 150);
  check('the dock says the manual path in words', /^Filling by hand — /.test(manual?.line || '') && /Your Draft stays in Draft House/.test(manual?.line || ''), JSON.stringify(manual));
  const binds2 = (await h.bindings()).map(([, v]) => v);
  check('the tab\'s path is manual', binds2.some(b => b.path === 'manual'), JSON.stringify(binds2.map(b => b.path)));
  check('the switch queued nothing', runJobs(h) === 1 && generations(h) === 1 && draftPosts(h) === 1, `${runJobs(h)} / ${generations(h)} / ${draftPosts(h)}`);
}

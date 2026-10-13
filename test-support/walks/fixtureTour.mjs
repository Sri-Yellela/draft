/**
 * J2 · A TOUR OF THE WORKDAY-SHAPED FIXTURE — every step, the real extension on each, MEASURED.
 * =============================================================================================
 * CHECKS gate only what the fixture and the harness promise (the step changes without the URL; the widgets behave;
 * the harness never submits). What the EXTENSION does on each step today is OBSERVED, not gated — those are D96's
 * symptoms, and other lanes (J4, J5, J6) own the fixes. A lane turns an OBSERVED line into a check when it fixes it.
 */
import { STEPS, OFF_PATH_STEPS, waitUntil, sleep } from '../extensionBrowser.mjs';

export const description = 'every step of the Workday-shaped fixture, and what the extension does on each today';

async function prepareOn(h, step, observe) {
  await h.reload();
  if (step !== 'myInformation') await h.goStep(step);
  let r = await h.prepare({ timeoutMs: 8000 });
  if (r?.pending) {
    const badge = await waitUntil(() => h.readBadge().then(b => (b && b.state !== 'progress' ? b : null)), 6000);
    observe(`${step}: the wizard waits for the candidate`, { state: badge?.state, missing: badge?.missing, fields: badge?.title });
    await h.dismissBadge();
    r = await Promise.race([r.reply, sleep(15000).then(() => ({ timeout: true }))]);
  }
  observe(`${step}: Prepare replied`, r?.message || r);
  const panel = await h.waitForPanel(4000);
  observe(`${step}: the review panel`, panel ? { subtitle: panel.subtitle, state: panel.state, rows: panel.rows.map(x => `${x.label}=${x.value} [${x.tier}]`) } : 'not drawn');
  return { reply: r, panel };
}

export default async function run(h, { check, observe, section }) {
  const { page } = h;

  section('the steps change without the URL changing');
  const url = await h.openStage('applyManually');
  check('the stage opens on My Information', (await h.step()) === 'myInformation');
  for (const s of STEPS.slice(1, -1)) { await h.next(); check(`Save and Continue → ${s}, the URL unchanged`, (await h.step()) === s && page.url() === url); }
  await h.next();
  check('…and Review', (await h.step()) === 'review' && page.url() === url);
  let refused = false;
  try { await h.next(); } catch { refused = true; }
  check('the harness refuses Save and Continue on Review (it is Submit there)', refused);
  for (const s of OFF_PATH_STEPS) { await h.goStep(s); check(`goStep(${s}), the URL unchanged`, (await h.step()) === s && page.url() === url); }

  section("Workday's widgets behave in the browser");
  await h.goStep('myInformation');
  await page.click('#ws-state');
  const options = await waitUntil(() => page.evaluate(() => [...document.querySelectorAll('body > .ws-pop [role="option"]')].map(o => o.textContent)).then(a => (a.length ? a : null)), 2000);
  check('the State dropdown opens a listbox in a portal at the end of <body>, after a delay', (options || []).includes('California'), (options || []).join(', '));
  await page.evaluate(() => [...document.querySelectorAll('.ws-pop [role="option"]')].find(o => o.textContent === 'Texas').click());
  check('choosing an option sets the button', await page.$eval('#ws-state', b => b.getAttribute('value') === 'Texas' && b.textContent === 'Texas'));
  await page.type('#ws-phoneCode', 'United');
  const hits = await waitUntil(() => page.evaluate(() => [...document.querySelectorAll('.ws-pop [role="option"]')].map(o => o.textContent)).then(a => (a.length ? a : null)), 3000);
  check('the Country Phone Code typeahead searches after a delay', (hits || []).some(x => /\+1/.test(x)), (hits || []).join(', '));
  await h.goStep('myExperience');
  await page.evaluate(() => {
    const input = document.getElementById('ws-resume');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'Ada_Example_Zoom_Software_Engineer.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  check('a file set on the hidden input shows its name in the drop zone', /Ada_Example_Zoom_Software_Engineer\.pdf/.test(await page.$eval('[data-automation-id="file-upload-successful"]', e => e.textContent)));

  section('the extension on each step (OBSERVED — other lanes fix these)');
  await h.openStage('applyManually');
  const cap = await h.capture();
  check('captured', cap?.success === true, cap?.message);
  const results = {};
  for (const s of ['myInformation', 'voluntaryDisclosures', 'selfIdentify', 'unrecognised', 'signIn']) {
    results[s] = await prepareOn(h, s, observe);
    observe(`${s}: guarded controls after the run`, await h.guarded());
  }
  const leak = await h.leaked();
  observe('signIn: the password sentinel reached the API or storage', leak);

  section('nothing was submitted');
  check('the fake ATS recorded no submission from this flow', (await h.submissions()).length === 0);
}

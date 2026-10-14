/**
 * v1.5.2 · ONE JOB ACROSS WORKDAY'S STAGES — the walk of 8d1fa87, on the J2 harness (scripts/workdayStagesWalk.mjs
 * runs this file). The owner's case (10-12): the application opened straight from LinkedIn at
 *   https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin
 * — the extension never saw the posting, and the board's Zoom copy came from another ATS.
 *
 *   1. capture on /apply/applyManually?source=linkedin → stored as the POSTING, the key recorded, the tab bound
 *   2. capture again on /apply/useMyLastApplication → the same job, "Already captured", no new prompt
 *   3. "Captured today" = 1
 *   4. the popup's context on another stage → Captured ✓ (bound, captured)
 *   5. Fill on a stage → NOT "capture it first": the job is yours, Prepare is offered
 *   6. Prepare → the packet fills the stage's form (its address joined through the user's own capture)
 *   7. the step changes WITHOUT the URL changing → the Copy sheet panel opens in the page with the PREPARED answers
 *   8. the tab closes → its binding is gone
 */
import { OWNER_STAGE, OTHER_STAGE, POSTING, waitUntil } from '../extensionBrowser.mjs';

export const description = "v1.5.2 — one job across Workday's stages, the real extension in headless Chrome";

export default async function run(h, { check, section }) {
  const { db, page } = h;

  section('1 · capture on the stage the owner opened from LinkedIn');
  await h.open(OWNER_STAGE);
  const first = await h.capture();
  check('the capture succeeded', first?.success === true, first?.message);
  const jobId = first?.jobId;
  const stored = db.prepare('SELECT url FROM job_captures WHERE user_id = 1 ORDER BY id DESC LIMIT 1').pluck().get();
  check('stored as the POSTING — stage, query and locale stripped', stored === POSTING, stored);
  check('the job key is recorded', db.prepare("SELECT job_id FROM job_page_keys WHERE page_key = 'workday|zoom|zoom|R19749'").pluck().get() === jobId);
  const binds = await h.bindings();
  check('the tab is BOUND to the job', binds.length === 1 && binds[0][1].jobId === String(jobId) && binds[0][1].via === 'capture', JSON.stringify(binds[0]?.[1] || null));

  section('2 · capture again on another stage');
  await h.open(OTHER_STAGE);
  const again = await h.capture();
  check('the same job', again?.jobId === jobId, `${again?.jobId} vs ${jobId}`);
  check('"Already captured" — idempotent, says so', /^Already captured — .* is on your board and in your imports\.$/.test(again?.message || ''), again?.message);

  section('3 · Captured today');
  const today = await h.capturedToday();
  check('two captures of one job count once', today?.today === 1, JSON.stringify(today));

  section("4 · the popup's context on a stage");
  const ctx = await h.popupContext();
  check('the posting is known and captured on this stage', ctx?.posting?.jobId === jobId && ctx?.posting?.captured === true, JSON.stringify(ctx?.posting || null).slice(0, 160));
  check('the binding comes with it', ctx?.binding?.jobId === String(jobId), JSON.stringify(ctx?.binding || null));

  section('5 · Fill on a stage');
  const fill = await h.fill();
  check('NOT "draft doesn\'t know this job — capture it first"', !/capture it first/.test(fill?.message || ''), fill?.message);
  check('the job is yours: Prepare is offered', fill?.canPrepare === true, JSON.stringify(fill));

  section("6 · Prepare → the stage's form is filled");
  // Since J2 the stage is the full My Information step, whose required address / phone / country fields the packet
  // does not answer — so the extension's wizard fills what it can, then WAITS FOR THE CANDIDATE (the badge). The
  // candidate's × ends the wait; only then does Prepare reply.
  let prep = await h.prepare({ timeoutMs: 6000 });
  const filled = await waitUntil(() => page.evaluate(() => document.querySelector('input[name="firstName"]')?.value), 8000);
  check('the form carries the prepared answer', filled === 'Ada', String(filled));
  const prepFill = await page.evaluate(() => ({ last: document.querySelector('input[name="lastName"]')?.value, email: document.querySelector('input[name="email"]')?.value }));
  check('…every field the packet answers', prepFill.last === 'Example' && prepFill.email === 'ada@example.test', JSON.stringify(prepFill));
  if (prep?.pending) {
    const badge = await waitUntil(() => h.readBadge().then(b => (b?.state === 'required' ? b : null)), 8000);
    check('…and the wizard waits for the candidate on the required fields it could not answer', badge?.missing > 0, JSON.stringify(badge));
    check('the candidate dismisses the badge', await h.dismissBadge());
    prep = await prep.reply;
  }
  check('prepared and filled', prep?.ok === true, prep?.message);

  section('7 · the step changes without the URL changing → the Copy sheet in the page');
  const urlBefore = page.url();
  await h.next();
  check('the step changed and the URL did not', page.url() === urlBefore && /my experience/.test(await page.$eval('[data-stage]', el => el.textContent)));
  const panel = await h.openCopySheet();
  check('the Copy sheet panel opened in the page', panel?.ok === true, JSON.stringify(panel));
  const sheet = await h.readCopySheet();
  check('it names the job and shows the PREPARED answers', /Software Engineer at Zoom · prepared answers/.test(sheet?.sub || ''), sheet?.sub);
  check('…including the saved answer for this employer', (sheet?.rows || []).some(r => r.label === 'Why do you want to work at Zoom?'), (sheet?.rows || []).map(r => r.label).join(' | '));
  await page.keyboard.press('Escape');
  check('Esc closes it', (await h.readCopySheet()) === null);

  section('8 · the tab closes');
  const tabCount = (await h.bindings()).length;
  await page.close();
  const gone = await waitUntil(async () => (await h.bindings()).length === 0, 4000);
  check('its binding is gone', tabCount === 1 && !!gone, `before ${tabCount}`);
}

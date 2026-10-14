/**
 * J4 · THE REVIEW PANEL AND THE ANSWER LIFECYCLE — the real extension on the Workday-shaped fixture (D96 §4–§7).
 * ==========================================================================================================
 *   npm run walk:extension -- panelLifecycle [--theme dark]
 *
 * Proves, in a real Chrome, on the SHIPPED router (extension/background.js, answerMemory wired at the J4 merge)
 * and J8's saved-answer routes mounted:
 *   1. My Information: the panel is drawn WHILE the wizard waits; every field is listed (Needs you · Check · Filled);
 *      "First Name*" is Filled (exact — profile), shown without its "*"; "Ready" is not said; I submitted it is off
 *   2. Collapse → a slim bar that still says what needs you; Expand; Esc closes; Close closes
 *   3. Type a Needs-you answer in the panel with "Remember for next time" → it is set on the page AND remembered
 *      (POST /api/saved-answers/acknowledge, source you_typed) → the next Prepare fills it from the saved answer
 *   4. Edit that remembered answer → "You changed this — acknowledge to remember it"; nothing stored; the next fill
 *      no longer uses the old value
 *   5. Voluntary Disclosures: the Terms box is NEVER ticked, listed under Needs you with no place to type
 *   6. Self Identify: the signature name and date are never filled
 *   7. The unrecognised step: "Nothing was filled — the page has no fields draft recognises yet."
 *   8. Sign-in: nothing is filled, the wizard presses nothing, the password sentinel never leaves the page
 *   9. The Copy sheet: the remembered answer with its source; survives a page click and a field focus
 * Synthetic person (Ada Example) throughout.
 */
import { waitUntil, sleep, defaultSeed, BUSY_MS } from '../extensionBrowser.mjs';

// The router wiring (answerMemory's handlers) is in extension/background.js since the J4 merge, so the walk
// runs the SHIPPED router — nothing is appended to the test build any more (appending it again declared the
// import twice and the service worker never started).

export const PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', email: 'ada@example.test' }, handler_map: {},
  custom_answers: { 'Why do you want to work at Zoom?': 'Video for everyone.' },
};

export const options = {
  api: {
    seed: defaultSeed,
    payload: PAYLOAD,
    mount: async (app, db) => {
      const { createSavedAnswersRouter } = await import('../../routes/savedAnswers.js');
      app.use(createSavedAnswersRouter({ db, requireAuth: (q, r, n) => n() }));
    },
  },
};

export const description = 'D96 §4–§7: every field listed, Ready means ready, one tick remembers, a change is not stored, consent / signature / password never touched';

/** The wizard's own words in the panel while it waits on this step (review-overlay.js, meta.waiting). */
export const WAITING = /draft is waiting for you on this step\./;

/**
 * Prepare on the current step; the wizard waits — read the panel WHILE it waits, then end the wait with the ×.
 *
 * ⭐ J11: waits on the CONDITION, bounded by BUSY_MS — the run has answered, or the panel is on the page saying the
 * wizard is waiting — rather than a fixed 6 s to decide "is it waiting?" and then 8 s for the panel. That budget is
 * what failed "the panel is ALREADY on the page while it waits" once under a full `npm test`: the panel was coming,
 * just later than 14 s. `pending` is now stronger, not weaker: no reply, AND the panel says it is waiting.
 */
export async function prepareAndRead(h, { dismiss = true } = {}) {
  const sent = h.send({ type: 'PREPARE_ACTIVE_TAB' });
  let answered = null;
  sent.then((v) => { answered = { v }; }, (e) => { answered = { v: { ok: false, reason: 'send_failed', message: String(e) } }; });
  const seen = await waitUntil(async () => {
    if (answered) return 'answered';
    const p = await h.readPanel().catch(() => null);
    return p && WAITING.test(p.text || '') ? p : null;
  }, BUSY_MS);
  const pending = !answered;
  const panel = (seen && seen !== 'answered') ? seen : await h.readPanel().catch(() => null);
  let reply = answered ? answered.v : { pending: true };
  if (pending && dismiss) {
    await waitUntil(() => h.readBadge().then(b => (b && b.state !== 'progress' ? b : null)), BUSY_MS);
    await h.dismissBadge();
    reply = await Promise.race([sent, sleep(BUSY_MS).then(() => ({ timeout: true }))]);
  }
  return { reply: pending && !dismiss ? sent : reply, panel, pending };
}

/**
 * A fresh load of the stage. Not a reload, and not a goto to the SAME address — Chrome treats that as a reload and
 * restores the typed form values, which would read as "already on the page". Leave, then come back.
 */
export const fresh = async (h) => { await h.page.goto('about:blank'); return h.openStage('applyManually'); };

/** A shadow-piercing click (a TRUSTED click, as the person's own). */
export const clickIn = (h, sel) => h.page.click(`#rm-gate-review-overlay >>> ${sel}`);

export default async function run(h, { check, observe, section }) {
  const { page, db } = h;
  const rowsOf = (p) => (p?.rows || []);
  const row = (p, label) => rowsOf(p).find(r => r.label === label);

  section('1 · My Information — the panel while the wizard waits');
  await h.openStage('applyManually');
  const cap = await h.capture();
  check('captured', cap?.success === true, cap?.message);
  const first = await prepareAndRead(h, { dismiss: false });
  check('the wizard is waiting for the candidate', first.pending === true);
  check('…and the panel is ALREADY on the page while it waits', !!first.panel, JSON.stringify(first.panel?.subtitle));
  observe('the panel on My Information', { subtitle: first.panel?.subtitle, state: first.panel?.state, rows: rowsOf(first.panel).map(r => `${r.band}:${r.label}=${r.value ?? ''} [${r.tier ?? ''}]`) });
  const fn = row(first.panel, 'First Name');
  check('"First Name*" is listed as "First Name" (no asterisk), Filled, from the profile', fn?.band === 'ok' && fn?.value === 'Ada' && /profile/.test(fn?.tier || ''), JSON.stringify(fn));
  check('"First Name" is not a guessed field', !/guess|loosely/.test(fn?.tier || ''));
  const need = rowsOf(first.panel).filter(r => r.band === 'need').map(r => r.label);
  check('every unfilled required field is listed under Needs you', ['Address Line 1', 'City', 'State', 'Postal Code', 'Phone Number'].every(l => need.includes(l)), need.join(', '));
  check('"Ready" is not said while fields need you', !/^Ready/.test(first.panel?.state || ''), first.panel?.state);
  const submittedOff = await h.readShadow('rm-gate-review-overlay', (root) => root.querySelector('[data-role="submitted"]').disabled);
  check('"I submitted it" is disabled until Ready', submittedOff === true);

  section('2 · Collapse · Expand · Esc · Close');
  await clickIn(h, '[data-role="collapse"]');
  const slim = await h.readShadow('rm-gate-review-overlay', (root) => root.querySelector('[data-role="slim"]')?.textContent || null);
  check('Collapse → a slim bar that still says what needs you', /need/.test(slim || '') && /of \d+ filled/.test(slim || ''), slim);
  await clickIn(h, '[data-role="expand"]');
  check('Expand → the panel again', !!(await h.readShadow('rm-gate-review-overlay', (root) => root.querySelector('.rm-t'))));

  section('3 · type a Needs-you answer, Remember for next time');
  await page.type('#rm-gate-review-overlay >>> .rm-row[data-group="need"] [aria-label="Address Line 1"]', '1 Example Way');
  const addrRow = await h.readShadow('rm-gate-review-overlay', (root) => [...root.querySelectorAll('.rm-row')].findIndex(r => r.querySelector('[data-role="label"]')?.textContent === 'Address Line 1'));
  await page.click(`#rm-gate-review-overlay >>> .rm-row[data-idx] [aria-label="Address Line 1"] ~ [data-role="use"]`);
  await waitUntil(() => page.$eval('#ws-addressLine1', el => el.value === '1 Example Way'), BUSY_MS);
  check('"use it" puts it in the page\'s own field', await page.$eval('#ws-addressLine1', el => el.value) === '1 Example Way');
  const remembered = await waitUntil(() => db.prepare("SELECT answer, source, state FROM saved_answers WHERE question_key = 'address line 1'").get(), BUSY_MS);
  check('…and it is REMEMBERED: one saved answer, you typed, acknowledged', remembered?.answer === '1 Example Way' && remembered?.source === 'you_typed' && remembered?.state === 'acknowledged', JSON.stringify(remembered));
  const after = await waitUntil(async () => { const p = await h.readPanel(); return /you typed/.test(row(p, 'Address Line 1')?.tier || '') ? p : null; }, BUSY_MS) || await h.readPanel();
  const addr = row(after, 'Address Line 1');
  check('the row moves to Filled at once and says remembered', addr?.band === 'ok' && /you typed/.test(addr?.tier || ''), JSON.stringify(addr) + ` idx ${addrRow}`);
  await h.dismissBadge();
  await Promise.race([first.reply, sleep(BUSY_MS)]);
  const sheet3 = await h.send({ type: 'COPY_SHEET_PANEL' });
  await h.waitForCopySheet();
  const inSheet = await h.readShadow('rm-copy-sheet-panel', (root) => [...root.querySelectorAll('li')].map(li => ({
    label: li.querySelector('.k')?.textContent, value: li.querySelector('.v')?.textContent, source: li.querySelector('[data-source]')?.textContent || null })));
  const sheetRow = (inSheet || []).find(r => r.label === 'Address Line 1');
  check('the acknowledged answer is in the Copy sheet, with its source', sheet3?.ok === true && sheetRow?.value === '1 Example Way' && /^you typed/.test(sheetRow?.source || ''), JSON.stringify(sheetRow));

  section('3b · an ELIGIBILITY answer is remembered on one tick too');
  await fresh(h); await h.goStep('applicationQuestions');
  const aq = await prepareAndRead(h, { dismiss: false });
  const authLabel = 'Are you legally authorized to work in the United States?';
  check('the work-authorisation question is listed under Needs you', row(aq.panel, authLabel)?.band === 'need', JSON.stringify(row(aq.panel, authLabel)));
  await page.select(`#rm-gate-review-overlay >>> [aria-label="${authLabel}"]`, 'Yes');
  await page.click(`#rm-gate-review-overlay >>> [aria-label="${authLabel}"] ~ [data-role="use"]`);
  await waitUntil(() => page.$eval('#ws-q-authorized-0', el => el.checked), BUSY_MS);
  check('"use it" picks the radio on the page', await page.$eval('#ws-q-authorized-0', el => el.checked) === true);
  const elig = await waitUntil(() => db.prepare("SELECT answer, widget_kind, state, category FROM saved_answers WHERE question_key LIKE 'are you legally authorized%'").get(), BUSY_MS);
  check('…remembered after ONE acknowledgement — eligibility included (radio, acknowledged)', elig?.answer === 'Yes' && elig?.widget_kind === 'radio' && elig?.state === 'acknowledged', JSON.stringify(elig));
  await h.dismissBadge();
  await Promise.race([aq.reply, sleep(BUSY_MS)]);
  await fresh(h); await h.goStep('applicationQuestions');
  const aq2 = await prepareAndRead(h);
  const authRow = row(aq2.panel, authLabel);
  check('the next fill ticks it from the remembered answer and does not ask again', await page.$eval('#ws-q-authorized-0', el => el.checked) === true && authRow?.band === 'ok', JSON.stringify(authRow));
  const attest = await h.readShadow('rm-gate-review-overlay', (root) => root.textContent.includes('you are attesting to this'));
  check('…and the row says "you are attesting to this"', attest === true);

  section('4 · the next fill uses it — then an edit is a change, not stored');
  await fresh(h);
  const second = await prepareAndRead(h);
  const addr2 = row(second.panel, 'Address Line 1');
  check('the next Prepare fills Address Line 1 from the saved answer', await page.$eval('#ws-addressLine1', el => el.value) === '1 Example Way' && addr2?.band === 'ok', JSON.stringify(addr2));
  observe('the saved row', addr2);
  // Filled is collapsed by default (D96 §5) — open it the way the person would, then edit the Address row.
  await clickIn(h, '[data-role="group"][data-g="ok"]');
  // The Address row's own edit button, found and pressed as ONE handle (a trusted click, as the person's own).
  const addrRowHandle = () => page.evaluateHandle(() => [...document.getElementById('rm-gate-review-overlay').shadowRoot.querySelectorAll('.rm-row')]
    .find(x => x.querySelector('[data-role="label"]')?.textContent === 'Address Line 1'));
  await (await (await addrRowHandle()).asElement().$('[data-role="edit"]')).click();
  const edInput = await (await addrRowHandle()).asElement().$('[data-role="editor"] [data-role="input"]');
  await edInput.click({ clickCount: 3 });
  await edInput.type('2 Other Road');
  await (await (await addrRowHandle()).asElement().$('[data-role="save"]')).click();
  const changedText = await waitUntil(() => h.readShadow('rm-gate-review-overlay', (root) => root.querySelector('[data-role="changed"]')?.textContent || null), BUSY_MS);
  check('an edit says "You changed this — acknowledge to remember it"', /You changed this — acknowledge to remember it/.test(changedText || ''), changedText);
  const stored = db.prepare("SELECT answer, state FROM saved_answers WHERE question_key = 'address line 1'").get();
  check('…the new value is NOT stored, and the old one is no longer remembered', stored?.state === 'changed' && stored?.answer == null, JSON.stringify(stored));
  const hist = db.prepare("SELECT from_value, to_value FROM answer_history WHERE question_key = 'address line 1' AND event = 'changed' ORDER BY id DESC").get();
  check('…a history row records from → to', hist?.from_value === '1 Example Way' && hist?.to_value === '2 Other Road', JSON.stringify(hist));
  check('…the page holds the new value for THIS application', await page.$eval('#ws-addressLine1', el => el.value) === '2 Other Road');
  await fresh(h);
  const third = await prepareAndRead(h);
  check('the next fill no longer uses the old value — it asks again', await page.$eval('#ws-addressLine1', el => el.value) === '' && row(third.panel, 'Address Line 1')?.band === 'need');

  section('5 · Voluntary Disclosures — the Terms box is never ticked');
  await fresh(h); await h.goStep('voluntaryDisclosures');
  const vd = await prepareAndRead(h);
  observe('the panel on Voluntary Disclosures', { subtitle: vd.panel?.subtitle, state: vd.panel?.state, rows: rowsOf(vd.panel).map(r => `${r.band}:${r.label}`) });
  check('the consent box is untouched', (await h.guarded()).consentTicked === false);
  const terms = rowsOf(vd.panel).find(r => /Terms and Conditions/.test(r.label));
  check('…listed under Needs you, yours to tick', terms?.band === 'need', JSON.stringify(terms));
  check('"Ready" is never said with 0 filled', !/^Ready/.test(vd.panel?.state || ''), vd.panel?.state);

  section('6 · Self Identify — the signature is never filled');
  await fresh(h); await h.goStep('selfIdentify');
  const si = await prepareAndRead(h);
  const g = await h.guarded();
  check('the signature name and date stay empty', g.signatureName === '' && g.signatureDate === '', JSON.stringify(g));
  observe('the panel on Self Identify', { state: si.panel?.state, rows: rowsOf(si.panel).map(r => `${r.band}:${r.label}`) });
  const sigTypeable = await h.readShadow('rm-gate-review-overlay', (root) => [...root.querySelectorAll('.rm-row')]
    .filter(r => ['Name', 'Date'].includes(r.querySelector('[data-role="label"]')?.textContent)).map(r => !!r.querySelector('[data-role="input"]')));
  check('the signature rows are Needs you with NO place to type — yours to sign', sigTypeable?.length === 2 && sigTypeable.every(x => x === false), JSON.stringify(sigTypeable));

  section('7 · the unrecognised step');
  await fresh(h); await h.goStep('unrecognised');
  const un = await prepareAndRead(h);
  check('"Nothing was filled — the page has no fields draft recognises yet."', un.panel?.state === 'Nothing was filled — the page has no fields draft recognises yet.', un.panel?.state);
  check('…and its fields are listed', rowsOf(un.panel).length >= 3, String(rowsOf(un.panel).length));

  section('8 · sign-in — nothing filled, nothing pressed, the password never read');
  await fresh(h); await h.goStep('signIn');
  const before = await h.step();
  const si8 = await h.prepare({ timeoutMs: BUSY_MS });
  await sleep(500);
  check('the fill says it is a sign-in form and fills nothing', si8?.ok === false && /isn't recognised/.test(si8?.message || ''), si8?.message);
  check('the sign-in email is untouched', await page.$eval('#ws-signIn-email', el => el.value) === '');
  check('no review panel is drawn over the sign-in page', !(await page.$('#rm-gate-review-overlay')));
  check('the wizard pressed nothing — still on sign-in', (await h.step()) === before);
  check('the password sentinel never left the page', (await h.leaked()).leaked === false);

  section('9 · the Copy sheet');
  await fresh(h);
  const ack = await h.send({ type: 'COPY_SHEET_PANEL' });
  check('the Copy sheet opens in the page', ack?.ok === true, JSON.stringify(ack));
  const sheet = await h.waitForCopySheet();
  observe('the Copy sheet', sheet?.rows);
  await page.click('#ws-firstName');
  check('it survives a field focus and a page click', !!(await h.readCopySheet()));

  section('10 · dock · drag · never over the field being filled · Esc · Close');
  await fresh(h);
  const last = await prepareAndRead(h, { dismiss: false });
  check('the panel is up', !!last.panel);
  const side = () => page.evaluate(() => document.getElementById('rm-gate-review-overlay')?.dataset.side || null);
  check('it docks right by default', (await side()) === 'right');
  await clickIn(h, '[data-role="dock"]');
  check('Dock moves it to the left…', (await side()) === 'left');
  const dockSaved = await waitUntil(async () => (await h.bindings()).map(([, b]) => b.panelDock).find(Boolean), BUSY_MS);
  check('…and the tab REMEMBERS the side (the binding, no key of its own)', dockSaved === 'left', String(dockSaved));
  // Drag it by its header over the City field, then click into City: the panel moves off the field.
  const rectOf = (sel) => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const head = await page.evaluateHandle(() => document.getElementById('rm-gate-review-overlay').shadowRoot.querySelector('.rm-t'));
  const hr = await head.asElement().boundingBox();
  const city = await rectOf('#ws-city');
  await page.mouse.move(hr.x + 5, hr.y + 5);
  await page.mouse.down();
  await page.mouse.move(city.x + 10, city.y - 10, { steps: 6 });
  await page.mouse.up();
  const overlap = async () => page.evaluate(() => {
    const a = document.getElementById('rm-gate-review-overlay').getBoundingClientRect();
    const b = document.activeElement.getBoundingClientRect();
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  });
  const overCity = await page.evaluate(() => {
    const a = document.getElementById('rm-gate-review-overlay').getBoundingClientRect();
    const b = document.getElementById('ws-city').getBoundingClientRect();
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  });
  check('dragged by its header, the panel sits over the City field', overCity === true);
  await page.evaluate(() => document.getElementById('ws-city').focus({ preventScroll: true }));   // no scroll: the field stays under the panel
  await sleep(150);
  check('the panel never covers the field being filled', (await page.evaluate(() => document.activeElement?.id)) === 'ws-city' && !(await overlap()));
  // Esc with the panel focused closes it; the wizard is NOT stopped by it (only the badge's × does that).
  await page.focus('#rm-gate-review-overlay >>> [data-role="close"]');   // in the full panel and the slim bar alike
  await page.keyboard.press('Escape');
  check('Esc closes the panel', !(await page.$('#rm-gate-review-overlay')));
  await h.dismissBadge();
  await Promise.race([last.reply, sleep(BUSY_MS)]);
  await fresh(h);
  const again = await prepareAndRead(h);
  check('a new fill draws it again', !!again.panel);
  await clickIn(h, '[data-role="close"]');
  check('Close closes it', !(await page.$('#rm-gate-review-overlay')));

  section('nothing was submitted');
  check('the fake ATS recorded no submission', (await h.submissions()).length === 0);
}

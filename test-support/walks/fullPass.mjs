/**
 * J9 · THE FULL PASS — one application, end to end, the REAL extension on the SHIPPED router (D96 · D97 · D98).
 * ===========================================================================================================
 *   npm run walk:extension -- fullPass [--theme dark]
 *
 * On J2's Workday-shaped fixture at the owner's URL shape (…/apply/applyManually?source=linkedin), desktop width, with
 * the REAL routes (apply, import, J8's saved answers, J3's résumé routes — the generation STUBBED, no model call):
 *    1. capture on the apply page → the tab is bound, one job, Captured today 1; a second capture does not prompt
 *    2. read ("Read this page") → 3. prepare + fill → the review panel: every field listed, "N of M filled · K need
 *       you", Ready only when it is, no asterisk on a label
 *    4. acknowledge the guess (Postal Code, matched loosely) and type a needed answer with Remember (Address Line 1);
 *       answer the eligibility questions the same way
 *    5. reopen the popup → it remembers: the progress line and the In progress list
 *    6. reload the page → the progress and the binding survive
 *    7. generate a résumé (the panel's own click) → attach (the name shows on the fixture's drop zone)
 *    8. the Copy sheet, in the page: the acknowledged and typed answers with their sources, "Résumé — attached ✓",
 *       "you are attesting to this" on eligibility
 *    9. a NEW fill reuses every remembered answer — nothing asked again, and Application Questions says Ready
 *   10. the plain fake-ATS form (the non-Workday control): a filled form, a guess listed, a differently worded
 *       eligibility question asked as new
 *   11. auto-read (D97): SKIPPED with its reason — J5's site table is https-only and the fixture is plain http
 * Throughout: consent / signature / password untouched; nothing submitted; no request outside draft's server; no answer
 * value in chrome.storage; both themes paint from tokens; no capsule shapes. Synthetic person (Ada Example) only.
 */
import { defaultSeed, freePort, waitUntil, sleep, OWNER_STAGE, TENANT, BUSY_MS } from '../extensionBrowser.mjs';
import { mountExtensionResume, seedBaseResume } from '../extensionResumeStub.mjs';
import { fresh } from './panelLifecycle.mjs';

/**
 * Prepare on the current step and read the panel WHILE the wizard waits; then (unless told not to) end the wait with
 * the badge's ×. panelLifecycle's prepareAndRead with wider waits: this pass runs ~15 fills back to back, and a fill
 * that took longer than 6 s to draw its panel read as "no panel" (the timing flake lane J11 is fixing in the shared
 * walks — this file does not depend on that fix).
 */
async function prepareAndRead(h, { dismiss = true } = {}) {
  const r = await h.prepare({ timeoutMs: 12000 });
  const panel = await waitUntil(() => h.readPanel(), 20000, 200);
  let reply = r;
  if (r?.pending && dismiss) {
    await waitUntil(() => h.readBadge().then(b => (b && b.state !== 'progress' ? b : null)), BUSY_MS);
    await h.dismissBadge();
    reply = await Promise.race([r.reply, sleep(BUSY_MS).then(() => ({ timeout: true }))]);
  }
  return { reply, panel, pending: !!r?.pending };
}
import { C_LIGHT, C_DARK } from '../../extension/tokens.js';

// The plain control form lives on the fake ATS's own localhost origin; its port is fixed up front so the seed can
// put that form's job on Ada's board (a plain form names no employer, so it cannot be captured — it is starred).
const ATS_PORT = await freePort();
const LEVER = `http://localhost:${ATS_PORT}/lever`;

/**
 * The profile the resolver returns. `postal` is deliberately NOT the canonical key (`zip`): it reaches "Postal Code" by
 * a whole-token label match — a GUESS (label_fuzzy) the panel must ask about. `company` does the same for "Current
 * company" on the plain form. No address: Address Line 1 is the needed answer typed in the panel.
 */
export const PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', full_name: 'Ada Example', email: 'ada@example.test',
    city: 'Springfield', phone: '5550100', postal: '01101', company: 'Example Corp' },
  handler_map: {},
  custom_answers: { 'Why do you want to work at Zoom?': 'Video for everyone.' },
};

let CTL = null;
export const options = {
  viewport: { width: 1280, height: 900 },   // desktop width
  atsPort: ATS_PORT,
  // TEST BUILD ONLY (as the harness does for the tenant): the plain form's origin, standing in for activeTab.
  hosts: [`http://${TENANT}/*`, 'http://localhost/*'],
  api: {
    seed: (db) => {
      defaultSeed(db);
      seedBaseResume(db);
      db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
        VALUES ('lv-1','Backend Engineer','Example Co','Remote',?,?,'t','h-lv',unixepoch()-3600)`).run(LEVER, LEVER);
      db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'lv-1', 1)").run();
    },
    payload: PAYLOAD,
    mount: async (app, db) => {
      const { createSavedAnswersRouter } = await import('../../routes/savedAnswers.js');
      app.use(createSavedAnswersRouter({ db, requireAuth: (q, r, n) => n() }));
      CTL = mountExtensionResume(app, db);
    },
  },
};

export const description = 'J9: capture → bound → read → prepare → fill → panel → acknowledge / type / remember → the popup remembers → reload → résumé → attach → Copy sheet → the next fill reuses it; the plain form; both themes';

// ── page-side probes (serialised; they close over nothing) ──────────────────────────────────────────────────────────
/** Every non-circular element whose corners make a capsule (D60), inside the named shadow hosts. */
function capsulesIn(ids) {
  const out = [];
  for (const id of ids) {
    const host = document.getElementById(id);
    if (!host) continue;
    for (const el of (host.shadowRoot || host).querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      const rad = Math.max(...['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'].map(k => parseFloat(cs[k]) || 0));
      const circle = Math.abs(r.width - r.height) < 1;
      if (rad > 0 && !circle && rad >= Math.min(r.width, r.height) / 2 - 0.5) out.push(`${id} ${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)} r${rad}`);
    }
  }
  return out;
}
/** The painted background of a shadow host's panel. */
function bgOf(id, sel) {
  const host = document.getElementById(id);
  const el = host?.shadowRoot?.querySelector(sel);
  return el ? getComputedStyle(el).backgroundColor : null;
}
const norm = (c) => {
  const s = String(c || '').replace(/\s+/g, '').toLowerCase();
  const hex = s.match(/^#([0-9a-f]{6})/);
  if (hex) return `rgb(${parseInt(hex[1].slice(0, 2), 16)},${parseInt(hex[1].slice(2, 4), 16)},${parseInt(hex[1].slice(4, 6), 16)})`;
  return s.replace(/^rgba\((\d+),(\d+),(\d+),1\)$/, 'rgb($1,$2,$3)');
};

const MY_INFORMATION = ['How Did You Hear About Us?', 'Have you previously worked for Zoom?', 'Country', 'First Name', 'Last Name',
  'Address Line 1', 'City', 'State', 'Postal Code', 'Email Address', 'Phone Device Type', 'Country Phone Code', 'Phone Number'];
const AUTH = 'Are you legally authorized to work in the United States?';
const SPONSOR = 'Will you now or in the future require sponsorship for employment visa status (e.g., H-1B visa status)?';
const LOCATIONS = 'Which locations would you consider? (select all that apply)';
const FILE = 'Ada_Example_Zoom_Software_Engineer.pdf';
/** Values a person typed or acknowledged — none may ever sit in chrome.storage. */
const VALUES = ['1 Example Way', '01101', 'Remote (US)', 'Springfield', 'ada@example.test'];

export default async function run(h, { check, observe, section }) {
  const { page, db, browser } = h;
  const theme = h.theme();
  const C = theme === 'dark' ? C_DARK : C_LIGHT;
  const rows = (p) => p?.rows || [];
  const row = (p, label) => rows(p).find(r => r.label === label);
  const shadowHosts = ['rm-gate-review-overlay', 'rm-copy-sheet-panel', 'rm-resume-panel', 'rm-draft-autofill-badge'];
  const capsules = [];
  const sweepCapsules = async () => { capsules.push(...await page.evaluate(capsulesIn, shadowHosts)); };
  const rowHandle = (label) => page.evaluateHandle((l) => [...(document.getElementById('rm-gate-review-overlay')?.shadowRoot?.querySelectorAll('.rm-row') || [])]
    .find(x => x.querySelector('[data-role="label"]')?.textContent === l) || null, label);
  const clickInRow = async (label, role) => { const r = (await rowHandle(label)).asElement(); const b = r && await r.$(`[data-role="${role}"]`); if (!b) return false; await b.click(); return true; };
  /** The panel's own words must agree with its counts — "Ready" exactly when nothing needs you and ≥ 1 was filled. */
  const readyIsTrue = (p) => {
    const m = /^(\d+) of (\d+) filled · (\d+) needs? you · (\d+) to check/.exec(p?.subtitle || '');
    if (!m) return false;
    const [filled, , need, chk] = m.slice(1).map(Number);
    const saysReady = /^Ready/.test(p.state || '');
    return saysReady === (need === 0 && chk === 0 && filled >= 1);
  };
  const progressRecord = async () => Object.values((await h.storage.local()).jobProgress?.records || {}).find(r => r.jobKey === 'workday|zoom|zoom|R19749' || r.title === 'Software Engineer') || null;
  const guardedOk = async (where) => {
    const g = await h.guarded();
    check(`${where}: the consent box, the signature and the password are untouched`, g.consentTicked === false && g.signatureName === '' && g.signatureDate === '' && g.passwordIntact !== false, JSON.stringify(g));
  };

  // ── the network, recorded where it happens: the service worker (every request the extension makes) and the page ──
  const swRequests = [];
  const pageRequests = [];
  const watchWorker = async (t) => {
    if (t.type() !== 'service_worker' || !t.url().startsWith(`chrome-extension://${h.extensionId}/`)) return;
    try {
      const s = await t.createCDPSession();
      s.on('Network.requestWillBeSent', (e) => swRequests.push(e.request.url));
      await s.send('Network.enable');
    } catch { /* a worker that went away; the next one is watched on creation */ }
  };
  browser.on('targetcreated', watchWorker);
  for (const t of browser.targets()) await watchWorker(t);
  page.on('request', (r) => pageRequests.push(r.url()));

  section('1 · capture on the apply page the owner opened from LinkedIn');
  await h.open(OWNER_STAGE);
  check('the page is the owner\'s URL shape (/apply/applyManually?source=linkedin)', /\/en-US\/Zoom\/job\/Remote--\(US\)\/Software-Engineer_R19749-1\/apply\/applyManually\?source=linkedin$/.test(decodeURIComponent(page.url())), page.url());
  const cap = await h.capture();
  check('captured', cap?.success === true, cap?.message);
  const jobId = cap?.jobId;
  const binds = await h.bindings();
  check('the tab is BOUND to that one job, by the capture', binds.length === 1 && binds[0][1].jobId === String(jobId) && binds[0][1].via === 'capture', JSON.stringify(binds.map(b => b[1])));
  check('one job: the key workday|zoom|zoom|R19749 names it', db.prepare("SELECT job_id FROM job_page_keys WHERE page_key = 'workday|zoom|zoom|R19749'").pluck().get() === jobId);
  const today1 = await h.capturedToday();
  check('Captured today counts 1', today1?.today === 1, JSON.stringify(today1));
  const again = await h.capture();
  check('a second capture does not prompt: the same job, "Already captured"', again?.success === true && again?.jobId === jobId && /^Already captured — /.test(again?.message || ''), again?.message);
  check('…and Captured today still counts 1', (await h.capturedToday())?.today === 1);
  check('…and still one binding', (await h.bindings()).length === 1);

  section('2 · read ("Read this page")');
  const ctx = await h.popupContext();
  check('the page is read as this job, captured', ctx?.posting?.jobId === jobId && ctx?.posting?.captured === true, JSON.stringify(ctx?.posting || null).slice(0, 160));
  const recRead = await waitUntil(async () => { const r = await progressRecord(); return r?.read?.at ? r : null; }, BUSY_MS);
  check('the progress record says the page was read', !!recRead?.read?.at, JSON.stringify(recRead?.read || null));

  section('3 · prepare → fill → the review panel (My Information)');
  const p1 = await prepareAndRead(h, { dismiss: false });
  const panel = p1.panel;
  observe('the panel on My Information', { subtitle: panel?.subtitle, state: panel?.state, rows: rows(panel).map(r => `${r.band}:${r.label}=${r.value ?? ''} [${r.tier ?? ''}]`) });
  check('the wizard filled what it could and waits for the candidate', p1.pending === true && await page.$eval('#ws-firstName', el => el.value) === 'Ada');
  const labels = rows(panel).map(r => r.label);
  check('EVERY field on the step is listed (13)', labels.length === MY_INFORMATION.length && MY_INFORMATION.every(l => labels.includes(l)), labels.join(' | '));
  check('no label carries the page\'s asterisk', labels.every(l => !/\*\s*$/.test(l || '')), labels.filter(l => /\*/.test(l)).join(' | '));
  check('the progress line reads "N of 13 filled · K need you"', /^\d+ of 13 filled · \d+ needs? you · 1 to check/.test(panel?.subtitle || ''), panel?.subtitle);
  check('"Ready" is said only when it is true', readyIsTrue(panel) && !/^Ready/.test(panel?.state || ''), panel?.state);
  check('"I submitted it" is disabled until Ready', await h.readShadow('rm-gate-review-overlay', (root) => root.querySelector('[data-role="submitted"]').disabled) === true);
  const pc = row(panel, 'Postal Code');
  check('the guess is under Check: Postal Code, matched loosely', pc?.band === 'check' && /matched loosely/.test(pc?.tier || '') && pc?.value === '01101', JSON.stringify(pc));
  check('Address Line 1 needs you', row(panel, 'Address Line 1')?.band === 'need');
  const rv = norm(await page.evaluate(bgOf, 'rm-gate-review-overlay', '#rm-gate-review-overlay'));
  check(`the review panel paints from the ${theme} tokens (SURFACE_MENU)`, rv === norm(C.SURFACE_MENU), `${rv} vs ${C.SURFACE_MENU}`);
  await sweepCapsules();

  section('4 · acknowledge the guess; type a needed answer with Remember');
  check('acknowledge pressed on Postal Code', await clickInRow('Postal Code', 'ack'));
  const ackSaved = await waitUntil(() => db.prepare("SELECT answer, source, state FROM saved_answers WHERE question_key = 'postal code'").get(), BUSY_MS);
  check('…REMEMBERED: one saved answer, you acknowledged, acknowledged', ackSaved?.answer === '01101' && ackSaved?.source === 'you_acknowledged' && ackSaved?.state === 'acknowledged', JSON.stringify(ackSaved));
  const afterAck = await waitUntil(async () => { const p = await h.readPanel(); return row(p, 'Postal Code')?.band === 'ok' ? p : null; }, BUSY_MS) || await h.readPanel();
  check('…the row moves to Filled', row(afterAck, 'Postal Code')?.band === 'ok', JSON.stringify(row(afterAck, 'Postal Code')));
  await page.type('#rm-gate-review-overlay >>> .rm-row[data-group="need"] [aria-label="Address Line 1"]', '1 Example Way');
  const rememberOn = await h.readShadow('rm-gate-review-overlay', (root) => [...root.querySelectorAll('.rm-row')]
    .find(x => x.querySelector('[data-role="label"]')?.textContent === 'Address Line 1')?.querySelector('[data-role="remember"]')?.checked ?? null);
  check('"Remember for next time" is ticked on the row', rememberOn === true);
  await page.click('#rm-gate-review-overlay >>> [aria-label="Address Line 1"] ~ [data-role="use"]');
  await waitUntil(() => page.$eval('#ws-addressLine1', el => el.value === '1 Example Way'), BUSY_MS);
  check('"use it" puts it in the page\'s own field', await page.$eval('#ws-addressLine1', el => el.value) === '1 Example Way');
  const typed = await waitUntil(() => db.prepare("SELECT answer, source, state FROM saved_answers WHERE question_key = 'address line 1'").get(), BUSY_MS);
  check('…REMEMBERED: you typed, acknowledged', typed?.answer === '1 Example Way' && typed?.source === 'you_typed' && typed?.state === 'acknowledged', JSON.stringify(typed));
  const afterType = await waitUntil(async () => { const p = await h.readPanel(); return row(p, 'Address Line 1')?.band === 'ok' ? p : null; }, BUSY_MS) || await h.readPanel();
  check('the panel recounts: one fewer needs you, nothing to check', /^\d+ of 13 filled · \d+ needs? you · 0 to check/.test(afterType?.subtitle || '') && readyIsTrue(afterType), afterType?.subtitle);
  await h.dismissBadge();
  await Promise.race([p1.reply, sleep(BUSY_MS)]);
  await guardedOk('My Information');
  // Wait for THIS fill's counts — the first fill's record (6 of 13) is already there, so 'any counts' could read it.
  const WANT_FILL = JSON.stringify({ check: 0, n: 7, needYou: 6, of: 13 });
  const recFill = await waitUntil(async () => { const r = await progressRecord(); return JSON.stringify(r?.filled) === WANT_FILL ? r : null; }, BUSY_MS) || await progressRecord();
  observe('the progress record after the My Information fill', recFill);
  check('the progress record holds the counts — prepared, filled N of 13', !!recFill?.prepared?.at && recFill?.filled?.of === 13, JSON.stringify(recFill?.filled || null));
  check('…and they are the panel\'s AFTER the acknowledgement and the typed answer: 7 of 13 · 6 need you · 0 to check', JSON.stringify({ ...recFill?.filled, at: undefined }) === JSON.stringify({ check: 0, n: 7, needYou: 6, of: 13 }) && Number.isFinite(recFill?.filled?.at), JSON.stringify(recFill?.filled));

  section('4b · Application Questions — the eligibility answers, typed once and remembered');
  await fresh(h); await h.goStep('applicationQuestions');
  const aq = await prepareAndRead(h, { dismiss: false });
  check('the three questions need you; "Ready" is not said', [AUTH, SPONSOR, LOCATIONS].every(l => row(aq.panel, l)?.band === 'need') && readyIsTrue(aq.panel), JSON.stringify(rows(aq.panel).map(r => `${r.band}:${r.label}`)));
  for (const [label, value, input] of [[AUTH, 'Yes', '#ws-q-authorized-0'], [SPONSOR, 'No', '#ws-q-sponsorship-1'], [LOCATIONS, 'Remote (US)', '#ws-q-locations-0']]) {
    // Each "use it" redraws the panel; a handle taken before the redraw is detached — so retry on a fresh one.
    await waitUntil(async () => {
      try {
        await page.select(`#rm-gate-review-overlay >>> [aria-label="${label}"]`, value);
        await page.click(`#rm-gate-review-overlay >>> [aria-label="${label}"] ~ [data-role="use"]`);
        return true;
      } catch { return false; }
    }, 6000, 250);
    await waitUntil(() => page.$eval(input, el => el.checked), BUSY_MS);
    await waitUntil(async () => row(await h.readPanel(), label)?.band === 'ok', BUSY_MS);
    check(`"${label.slice(0, 40)}…" → ${value}, on the page`, await page.$eval(input, el => el.checked) === true);
  }
  const elig = db.prepare("SELECT question_key, answer, state FROM saved_answers WHERE question_key LIKE 'are you legally authorized%' OR question_key LIKE 'will you now or in the future%' OR question_key LIKE 'which locations%'").all();
  check('…all three REMEMBERED on one acknowledgement each (eligibility included)', elig.length === 3 && elig.every(e => e.state === 'acknowledged'), JSON.stringify(elig));
  await h.dismissBadge();
  await Promise.race([aq.reply, sleep(BUSY_MS)]);

  section('5 · reopen the popup — it remembers');
  const readPopup = async () => {
    // The popup names the job of the window's ACTIVE tab, read once when it loads. Under a loaded suite the harness's
    // own control tab could still be the active one, and the popup then honestly shows no job — so the fixture is
    // brought to the front and Chrome is asked until it agrees, before the popup opens.
    await page.bringToFront();
    await waitUntil(() => h.control.evaluate(async (u) => {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      return !!t && t.url.split('#')[0] === u;
    }, page.url().split('#')[0]), BUSY_MS);
    const before = new Set(browser.targets());
    await h.control.evaluate(() => chrome.tabs.create({ url: chrome.runtime.getURL('popup.html'), active: false }));
    const t = await browser.waitForTarget((x) => !before.has(x) && x.url().endsWith('/popup.html'), { timeout: BUSY_MS });
    const pp = await t.page();
    const got = await waitUntil(() => pp.evaluate(() => {
      const box = document.getElementById('progress');
      if (!box || box.hidden) return null;
      // renderProgress paints the job line, THEN awaits the list — under a loaded suite the read could land between
      // the two (43e: "In progress … — []"). This pass always has one job in progress, so wait for the list as well.
      if (document.getElementById('in-progress').hidden) return null;
      return { job: document.getElementById('progress-job').textContent, line: document.getElementById('progress-line').textContent,
        list: [...document.querySelectorAll('#in-progress-list li')].map(li => ({ job: li.querySelector('.ip-job')?.textContent, where: li.querySelector('.ip-where')?.textContent, here: li.className === 'here' })),
        listShown: !document.getElementById('in-progress').hidden };
    }), BUSY_MS);
    await pp.close();
    await page.bringToFront();
    return got;
  };
  const pop = await readPopup();
  observe('the popup, reopened', pop);
  check('it opens knowing the job', pop?.job === 'Software Engineer at Zoom', pop?.job);
  // ⭐ T15: "prepared" is the SERVER packet — when it was made, how many fields, when it goes off
  check('…and where it stands: Captured · Page read · Answers prepared (the packet: made · fields · expiry) · Filled N of M',
    /^Captured .* · Page read .* · Answers prepared \d\d:\d\d · \d+ fields? · expire [^·]+ · Filled \d+ of \d+/.test(pop?.line || ''), pop?.line);
  // The record holds the LAST panel's counts (one record per job, the step in view): Application Questions, answered.
  check('…with the counts the panel showed last — "Filled 3 of 3", nothing needs you, nothing to check', /· Filled 3 of 3( ·|$)/.test(pop?.line || '') && !/need|to check/.test(pop?.line || ''), pop?.line);
  check('the In progress list shows this job, marked as the one in this tab', pop?.listShown === true && (pop?.list || []).some(i => i.job === 'Software Engineer at Zoom' && i.here && !!i.where), JSON.stringify(pop?.list));

  section('6 · reload the page — progress and binding survive');
  const recBefore = await progressRecord();
  await h.reload();
  const bindsAfter = await h.bindings();
  check('the binding survives the reload — the same job', bindsAfter.length === 1 && bindsAfter[0][1].jobId === String(jobId), JSON.stringify(bindsAfter.map(b => b[1])));
  const recAfter = await progressRecord();
  check('the progress record survives the reload, unchanged', JSON.stringify(recAfter?.filled) === JSON.stringify(recBefore?.filled) && recAfter?.captured?.at === recBefore?.captured?.at && !!recAfter?.prepared?.at, JSON.stringify(recAfter?.filled));
  const pop2 = await readPopup();
  check('…and the popup still says where it stands', pop2?.line === pop?.line, `${pop2?.line} vs ${pop?.line}`);

  section('7 · a résumé started from the page\'s tab (T24 / T18\'s press) → the dock\'s Résumé tab → attach');
  const opened = await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'resume' });
  check('the Résumé tab opens on the page — not made yet', opened?.ok === true && opened.state === 'none', JSON.stringify(opened));
  await waitUntil(() => h.readShadow('rm-resume-panel', (root, host) => host.dataset.state === 'none'), BUSY_MS);
  check('opening it started nothing', CTL.generations().length === 0);
  check('⛔ T22: the tab offers no Generate', !(await h.readShadow('rm-resume-panel', (root) => !!root.querySelector('[data-role="generate"]'))));
  const started = await h.pageSend({ type: 'RESUME_GENERATE', trigger: 'click' });
  check('the one start answers', started?.ok === true, JSON.stringify(started)?.slice(0, 160));
  await h.send({ type: 'RESUME_PANEL_OPEN', tab: 'resume' });
  const ready = await waitUntil(() => h.readShadow('rm-resume-panel', (root, host) => (host.dataset.state === 'ready' ? true : null)), BUSY_MS);
  check('one press → Ready (one generation, one slot)', ready === true && CTL.generations().length === 1 && CTL.slots() === 1, `${CTL.generations().length} / ${CTL.slots()}`);
  const rp = norm(await page.evaluate(bgOf, 'rm-resume-panel', '.rp'));
  check(`the résumé panel paints from the ${theme} tokens (SURFACE_MENU)`, rp === norm(C.SURFACE_MENU), `${rp} vs ${C.SURFACE_MENU}`);
  await sweepCapsules();
  await h.goStep('myExperience');
  await page.click('#rm-resume-panel >>> [data-role="attach"]');
  const attached = await waitUntil(() => h.readShadow('rm-resume-panel', (root, host) => (['attached', 'fallback'].includes(host.dataset.state) ? { state: host.dataset.state, title: root.querySelector('[data-role="title"]')?.textContent } : null)), BUSY_MS);
  check(`Attach → "Attached: ${FILE}"`, attached?.state === 'attached' && attached?.title === `Attached: ${FILE}`, JSON.stringify(attached));
  const status = await page.$eval('#ws-resume-status', el => el.textContent).catch(() => '');
  check('…and the fixture\'s upload shows the name', new RegExp(`${FILE.replace(/\./g, '\\.')} · Successfully Uploaded!`).test(status), status);
  await page.click('#rm-draft-dock >>> [data-role="close"]');   // ⭐ T17: Close is the dock's

  section('8 · the Copy sheet, in the page');
  const sheetAck = await h.openCopySheet();
  const sheet = await h.waitForCopySheet();
  const sheetRows = await h.readShadow('rm-copy-sheet-panel', (root) => [...root.querySelectorAll('li')].map(li => ({
    label: li.querySelector('.k')?.textContent, value: li.querySelector('.v')?.textContent, source: li.querySelector('[data-source]')?.textContent || null })));
  observe('the Copy sheet', sheetRows);
  const sRow = (re) => (sheetRows || []).find(r => re.test(r.label || ''));
  check('it opens in the page', sheetAck?.ok === true && !!sheet);
  check('the TYPED answer, with its source', sRow(/^Address Line 1$/)?.value === '1 Example Way' && /^you typed/.test(sRow(/^Address Line 1$/)?.source || ''), JSON.stringify(sRow(/^Address Line 1$/)));
  check('the ACKNOWLEDGED guess, with its source', sRow(/^Postal Code$/)?.value === '01101' && /^you acknowledged/.test(sRow(/^Postal Code$/)?.source || ''), JSON.stringify(sRow(/^Postal Code$/)));
  check('"Résumé — attached ✓" with the file', sRow(/^Résumé — attached ✓/)?.value === FILE, JSON.stringify(sRow(/^Résumé/)));
  const authRow = sRow(/^Are you legally authorized/);
  check('the eligibility answer says "you are attesting to this"', authRow?.value === 'Yes' && /you are attesting to this/.test(authRow?.label || ''), JSON.stringify(authRow));
  const cs = norm(await page.evaluate(bgOf, 'rm-copy-sheet-panel', '.p'));
  check(`the Copy sheet paints from the ${theme} tokens (SURFACE_SOLID)`, cs === norm(C.SURFACE_SOLID), `${cs} vs ${C.SURFACE_SOLID}`);
  await sweepCapsules();
  await page.click('[data-automation-id="pageHeader"]').catch(() => {});
  check('it stays open through a page click', !!(await h.readCopySheet()));
  await page.evaluate(() => document.getElementById('rm-copy-sheet-panel')?.remove());

  section('9 · a NEW fill reuses what was remembered');
  await fresh(h);
  const n1 = await prepareAndRead(h);
  observe('the next fill, My Information', { subtitle: n1.panel?.subtitle, rows: rows(n1.panel).map(r => `${r.band}:${r.label}=${r.value ?? ''} [${r.tier ?? ''}]`) });
  check('Address Line 1 is filled from the remembered answer', await page.$eval('#ws-addressLine1', el => el.value) === '1 Example Way' && row(n1.panel, 'Address Line 1')?.band === 'ok', JSON.stringify(row(n1.panel, 'Address Line 1')));
  check('Postal Code is NOT asked again — Filled, not Check', await page.$eval('#ws-postalCode', el => el.value) === '01101' && row(n1.panel, 'Postal Code')?.band === 'ok', JSON.stringify(row(n1.panel, 'Postal Code')));
  check('…"0 to check", and Ready still only when true', /· 0 to check/.test(n1.panel?.subtitle || '') && readyIsTrue(n1.panel), n1.panel?.subtitle);
  await guardedOk('the next fill');
  await fresh(h); await h.goStep('applicationQuestions');
  const n2 = await prepareAndRead(h);
  check('Application Questions: all three filled from the remembered answers', await page.$eval('#ws-q-authorized-0', el => el.checked) && await page.$eval('#ws-q-sponsorship-1', el => el.checked) && await page.$eval('#ws-q-locations-0', el => el.checked));
  check('…"3 of 3 filled · 0 need you · 0 to check" and READY — because it is', /^3 of 3 filled · 0 need you · 0 to check/.test(n2.panel?.subtitle || '') && /^Ready/.test(n2.panel?.state || '') && readyIsTrue(n2.panel), `${n2.panel?.subtitle} / ${n2.panel?.state}`);
  check('…and "I submitted it" is enabled now — draft does not press it', await h.readShadow('rm-gate-review-overlay', (root) => root.querySelector('[data-role="submitted"]').disabled) === false);
  await fresh(h); await h.goStep('voluntaryDisclosures');
  await prepareAndRead(h);
  await guardedOk('Voluntary Disclosures (with answers remembered)');
  await fresh(h); await h.goStep('selfIdentify');
  await prepareAndRead(h);
  await guardedOk('Self Identify (with answers remembered)');
  await fresh(h); await h.goStep('signIn');
  await h.prepare({ timeoutMs: 8000 });
  await sleep(300);
  check('sign-in: the sign-in email is untouched and the password never left the page', await page.$eval('#ws-signIn-email', el => el.value) === '' && (await h.leaked()).leaked === false);

  section('10 · the plain fake-ATS form — the non-Workday control');
  await page.goto('about:blank');
  await h.open(LEVER);
  const lv = await prepareAndRead(h);
  observe('the plain form\'s panel', { reply: lv.reply?.message, subtitle: lv.panel?.subtitle, state: lv.panel?.state, rows: rows(lv.panel).map(r => `${r.band}:${r.label}=${r.value ?? ''} [${r.tier ?? ''}]`) });
  check('it fills the plain form', await page.$eval('input[name="name"]', el => el.value) === 'Ada Example' && await page.$eval('input[name="email"]', el => el.value) === 'ada@example.test');
  check('every field listed, no asterisk, the guess under Check', rows(lv.panel).length === 6 && rows(lv.panel).every(r => !/\*\s*$/.test(r.label || '')) && row(lv.panel, 'Current company')?.band === 'check', JSON.stringify(rows(lv.panel).map(r => `${r.band}:${r.label}`)));
  check('a DIFFERENTLY worded eligibility question is asked as new — not answered from Zoom\'s', row(lv.panel, 'Are you authorized to work without sponsorship?')?.band === 'need' && await page.$eval('select[name="cards[authorized_to_work]"]', el => el.value) === '');
  check('"Ready" only when true on the plain form', readyIsTrue(lv.panel) && !/^Ready/.test(lv.panel?.state || ''), lv.panel?.state);

  section('11 · auto-read (D97)');
  observe('auto-read — SKIPPED', 'J5\'s site table is https-only (https://*.myworkdayjobs.com/*) and the fixture is plain http: the harness maps the tenant onto scripts/fakeAts.js, which speaks no TLS, and launches Chrome with no certificate override. Reaching it would need a TLS front and a launch flag (test-support/extensionBrowser.mjs, lane J11\'s file now) or an http origin in autoRead.js — neither is done.');

  section('throughout');
  check('nothing was submitted — neither the Workday flow nor the plain form', (await h.ats.submissions()).length === 0);
  await page.goto('about:blank');
  const swForeign = [...new Set(swRequests.filter(u => !u.startsWith(h.api.origin) && !u.startsWith('chrome-extension://') && !u.startsWith('data:')))];
  check('every request the extension made went to draft\'s server', swRequests.length > 0 && swForeign.length === 0, swForeign.join(' | ') || `${swRequests.length} requests`);
  const pageForeign = [...new Set(pageRequests.filter(u => { try { const x = new URL(u); return !['chrome-extension:', 'data:', 'blob:', 'about:'].includes(x.protocol) && x.host !== TENANT && x.host !== `localhost:${ATS_PORT}`; } catch { return true; } }))];
  check('the page loaded nothing from anywhere else (the résumé preview\'s tracker image included)', pageForeign.length === 0, pageForeign.join(' | '));
  // chrome.storage.local — where progress lives — holds no answer value at all. chrome.storage.session holds one only
  // under gate:{tabId}: the prepared packet for the application in this tab, the DECLARED exception (the listing and
  // PRIVACY_RECONCILIATION.md: "the prepared answers for an application in progress, with a 10-minute expiry").
  const local = await h.storage.local();
  const session = await h.storage.session();
  const inLocal = VALUES.filter(v => JSON.stringify(local).includes(v));
  check('no answer value in chrome.storage.local (progress holds counts and times only)', inLocal.length === 0, inLocal.join(', '));
  const nonGate = Object.fromEntries(Object.entries(session).filter(([k]) => !k.startsWith('gate:')));
  const inSession = VALUES.filter(v => JSON.stringify(nonGate).includes(v));
  check('…none in chrome.storage.session outside the declared gate:{tabId} packet', inSession.length === 0, inSession.join(', '));
  const gates = Object.entries(session).filter(([k]) => k.startsWith('gate:')).map(([, g]) => g.expiresAt - g.storedAt);
  observe('chrome.storage.session gate:{tabId} packets (the declared prepared answers) — lifetime ms', gates);
  check('…and that packet keeps its ten-minute expiry', gates.every(ms => ms === 10 * 60 * 1000), JSON.stringify(gates));
  const rec = await progressRecord();
  check('the progress record holds counts and times only', !!rec && Object.keys(rec.filled || {}).sort().join() === 'at,check,n,needYou,of', JSON.stringify(rec));
  check('no capsule shape in any panel (D60)', capsules.length === 0, [...new Set(capsules)].slice(0, 6).join(' | '));
}

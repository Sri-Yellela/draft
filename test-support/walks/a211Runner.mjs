/**
 * ⭐ A211 (1a) · THE RUNNER TAB, WITH THE REAL EXTENSION LOADED. npm run walk:extension -- a211Runner
 * ==================================================================================================
 * Owner 11-15: "automate applications using the users own session … by keeping the application open … all by seeking
 * permission" → "build option 1a". Two applications wait to be sent from the person's own browser (A207 extension-submit
 * packets — an ATS that flags draft's servers):
 *   · /plain — everything on it is answerable from the saved profile → the runner fills it to Ready
 *   · /lever — a résumé and a question only the person can answer → the runner stops it at Needs you
 *   1. the runner lists exactly those two (from runner.html; ⛔ another extension page's RUNNER_* is refused)
 *   2. "Fill all" (the person's click) opens each in a background tab and fills it — and sends NOTHING
 *   3. ⛔ a script's click on "Send all" sends nothing; ⛔ a RUNNER_SEND without the press is refused
 *   4. the person's ONE press of "Send all" sends exactly the Ready one, from this browser → the fake ATS records ONE
 *      submission → Sent recorded on draft's server (POST /api/apply/handoff/submitted); the Needs-you one is untouched
 * Synthetic person (Ada Example) only; the "employers" are scripts/fakeAts.js on localhost.
 */
import { defaultSeed, freePort, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';
import { prepareAndRead } from './panelLifecycle.mjs';

const ATS_PORT = await freePort();
const PLAIN = `http://localhost:${ATS_PORT}/plain`;
const LEVER = `http://localhost:${ATS_PORT}/lever`;

export const PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', full_name: 'Ada Example', email: 'ada@example.test' },
  handler_map: {}, custom_answers: {},
};
export const options = {
  viewport: { width: 1280, height: 900 },
  atsPort: ATS_PORT,
  hosts: ['http://localhost/*'],
  api: {
    seed: (db) => {
      defaultSeed(db);
      const job = db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
        VALUES (?,?,?,'Remote',?,?,'t',?,unixepoch()-3600)`);
      job.run('pl-1', 'Support Engineer', 'Plain Co', PLAIN, PLAIN, 'h-pl');
      job.run('lv-1', 'Backend Engineer', 'Example Co', LEVER, LEVER, 'h-lv');
      db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'pl-1', 1), (1, 'lv-1', 1)").run();
    },
    payload: PAYLOAD,
  },
};
export const description = 'A211 (1a): the runner tab — lists the extension-submit applications, Fill all fills each in a background tab (sends nothing), a script cannot send, ONE trusted Send all sends exactly the Ready one from this browser and Sent is recorded';

const submittedCalls = (h) => h.api.requests.filter(x => /\/api\/apply\/handoff\/submitted/.test(x.url || x.path || ''));

export default async function run(h, { check, observe, section }) {
  const { page, db, browser, extensionId } = h;

  section('0 · two applications held for the person\'s own browser (the extension-submit shape a held Ashby run produces)');
  for (const [url, jobId] of [[PLAIN, 'pl-1'], [LEVER, 'lv-1']]) {
    await h.open(url);
    await prepareAndRead(h);
    const pk = db.prepare('SELECT id, answers_json FROM apply_gate_packets WHERE job_id = ? ORDER BY id DESC LIMIT 1').get(jobId);
    check(`a packet was prepared for ${jobId}`, !!pk, JSON.stringify(db.prepare('SELECT id, job_id, gate_reason FROM apply_gate_packets').all()));
    if (!pk) return;
    db.prepare("UPDATE apply_gate_packets SET gate_reason = 'server_submit_paused', answers_json = ?, consumed_at = NULL WHERE id = ?")
      .run(JSON.stringify({ ...JSON.parse(pk.answers_json || '{}'), gateReason: 'server_submit_paused' }), pk.id);
  }
  // the person's own tab leaves: what the runner fills, it fills in tabs of its own
  const session = await h.storage.session();
  const gates = Object.keys(session).filter(k => /^gate:\d+$/.test(k));
  if (gates.length) await h.control.evaluate((ks) => chrome.storage.session.remove(ks), gates);
  await page.goto('about:blank');
  const atsBefore = (await h.ats.submissions()).length;

  section('1 · the runner lists them — and only the runner may ask');
  const refused = await h.send({ type: 'RUNNER_LIST' });
  check('⛔ RUNNER_LIST from another extension page (options.html) is refused', refused?.ok === false && /runner/i.test(refused?.message || ''), JSON.stringify(refused));
  const runner = await browser.newPage();
  await runner.goto(`chrome-extension://${extensionId}/runner.html`);
  await waitUntil(() => runner.evaluate(() => globalThis.__runnerReady === true), 20000, 200);
  const rowsNow = () => runner.evaluate(() => [...document.querySelectorAll('#runner-rows .row')].map(li => ({
    company: li.querySelector('b')?.textContent, state: li.dataset.state, note: li.querySelector('.note')?.textContent || '' })));
  let rows = await rowsNow();
  observe('the runner', { rows, sum: await runner.$eval('#runner-sum', el => el.textContent), promise: await runner.$eval('#runner-promise', el => el.textContent) });
  check('two applications are listed, both Waiting', rows.length === 2 && rows.every(r => r.state === 'waiting'), JSON.stringify(rows));
  check('Send all is disabled before anything is filled', await runner.$eval('#runner-send', el => el.disabled) === true);
  check('the promise says nothing is sent until Send all', /Nothing is sent until you press Send all/.test(await runner.$eval('#runner-promise', el => el.textContent)));

  section('2 · Fill all — background tabs, filled, nothing sent');
  const tabsBefore = (await browser.pages()).length;
  await runner.click('#runner-fill');   // the person's click
  rows = await waitUntil(async () => { const r = await rowsNow(); return r.length && r.every(x => !['waiting', 'opening', 'filling'].includes(x.state)) ? r : null; }, BUSY_MS * 2, 400) || await rowsNow();
  observe('after Fill all', rows);
  const plain = rows.find(r => r.company === 'Plain Co'), lever = rows.find(r => r.company === 'Example Co');
  check('the plain application reads Ready', plain?.state === 'ready', JSON.stringify(plain));
  check('the Lever application stops at Needs you (a résumé / a question only the person can answer)', lever?.state === 'needs_you', JSON.stringify(lever));
  check('each was opened in a tab of its own', (await browser.pages()).length >= tabsBefore + 2, String((await browser.pages()).length));
  check('the runner stayed the active page (the tabs opened in the background)', await runner.evaluate(() => document.visibilityState) === 'visible');
  check('⛔ Fill all sent nothing', (await h.ats.submissions()).length === atsBefore);
  check('⛔ …and recorded nothing', submittedCalls(h).length === 0);
  check('Send all is enabled for the one Ready', await runner.$eval('#runner-send', el => !el.disabled && /1 ready/.test(el.textContent)), await runner.$eval('#runner-send', el => el.textContent));

  section('3 · ⛔ nothing sends without the press');
  await runner.evaluate(() => document.getElementById('runner-send').click());   // a script's click: untrusted
  await sleep(1500);
  check('a script\'s click on Send all sends nothing', (await h.ats.submissions()).length === atsBefore);
  const plainTab = (await browser.pages()).find(p => p.url().startsWith(PLAIN));
  const tabId = plainTab ? await h.control.evaluate(async (u) => (await chrome.tabs.query({})).find(t => t.url?.startsWith(u))?.id ?? null, PLAIN) : null;
  const direct = await runner.evaluate((id) => new Promise(r => chrome.runtime.sendMessage({ type: 'RUNNER_SEND', tabId: id, trusted: false }, r)), tabId);
  check('a RUNNER_SEND that is not the press is refused', direct?.outcome === 'refused', JSON.stringify(direct));
  const fromOptions = await h.send({ type: 'RUNNER_SEND', tabId, trusted: true });
  check('⛔ a RUNNER_SEND from another extension page is refused', fromOptions?.ok === false, JSON.stringify(fromOptions));
  check('…still nothing submitted', (await h.ats.submissions()).length === atsBefore);

  section('4 · the person\'s ONE press of Send all');
  await runner.bringToFront();
  await runner.click('#runner-send');   // a real input event — the person's press
  const subs = await waitUntil(async () => { const a = await h.ats.submissions(); return a.length > atsBefore ? a : null; }, BUSY_MS, 300);
  check('ONE application was submitted from this browser', (subs || []).length === atsBefore + 1, JSON.stringify((subs || []).map(x => x.provider)));
  check('…the Ready one (the plain form)', (subs || []).slice(-1)[0]?.provider === 'plain', JSON.stringify((subs || []).slice(-1)[0] || null));
  rows = await waitUntil(async () => { const r = await rowsNow(); return r.find(x => x.company === 'Plain Co')?.state === 'sent' ? r : null; }, BUSY_MS, 300) || await rowsNow();
  observe('after Send all', { rows, status: await runner.$eval('#runner-status', el => el.textContent) });
  check('the plain row reads Sent', rows.find(r => r.company === 'Plain Co')?.state === 'sent', JSON.stringify(rows));
  check('the Lever row is untouched at Needs you', rows.find(r => r.company === 'Example Co')?.state === 'needs_you', JSON.stringify(rows));
  const recorded = await waitUntil(() => { const r = submittedCalls(h); return r.length ? r : null; }, BUSY_MS, 300);
  check('Sent recorded on draft\'s server — once', (recorded || []).length === 1, JSON.stringify((recorded || []).map(r => r.url || r.path)));
  check('the application is on the person\'s record', !!db.prepare("SELECT 1 FROM job_applications WHERE user_id = 1 AND job_id = 'pl-1'").get());
  check('…and the Lever one is not', !db.prepare("SELECT 1 FROM job_applications WHERE user_id = 1 AND job_id = 'lv-1'").get());
  await sleep(1000);
  check('no second submission arrived', (await h.ats.submissions()).length === atsBefore + 1);
}

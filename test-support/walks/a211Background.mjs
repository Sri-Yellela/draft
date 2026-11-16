/**
 * ⭐ A211 (a) · A REAL-SHAPED ATS IN A BACKGROUND TAB, THROUGH THE RUNNER (46p item 3). npm run walk:extension -- a211Background
 * ============================================================================================================================
 * The runner (A211 (1a)) fills each waiting application in a tab it opens in the BACKGROUND. The fake ATS's plain forms
 * render at once; a live family renders late (Ashby / Greenhouse are React SPAs). /ashby-spa is the live posting's
 * measured shape — React-rendered in two chunks after a hydration delay (default 2500 ms). Question: does a hidden tab
 * stall that (timers throttled, no frames), so the runner's fill walks an empty DOM or never finishes?
 *   · /ashby-spa             — the default hydration (2.5 s), the live form's nameless date picker → expect Needs you
 *   (one application: the identify keys on the path, so ?answerable=1 would bind to the same job)
 *   1. it is listed; "Fill all" (the person's click) opens each in a BACKGROUND tab
 *   2. MEASURED: each tab stayed hidden, its form rendered there, the fill reached a final state (not stuck at filling),
 *      how many of its fields hold a value, and how long it took
 *   ⛔ nothing is sent (no Send all pressed). ⛔ Never a live employer form: scripts/fakeAts.js on localhost only.
 * Synthetic person (Ada Example) only.
 */
import { defaultSeed, freePort, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';
import { prepareAndRead } from './panelLifecycle.mjs';

const ATS_PORT = await freePort();
const SLOW = `http://localhost:${ATS_PORT}/ashby-spa`;

export const PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', full_name: 'Ada Example', email: 'ada@example.test', phone: '+1 555 0100',
    location: 'Boston, MA', linkedin: 'https://www.linkedin.com/in/ada-example' },
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
      job.run('as-1', 'Research Engineer', 'Ashby Shape Co', SLOW, SLOW, 'h-as1');
      db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'as-1', 1)").run();
    },
    payload: PAYLOAD,
  },
};
export const description = 'A211 (a): the runner fills an Ashby-shaped React form (2.5 s hydration) in a BACKGROUND tab — measured: hidden, rendered, filled to a final state, nothing sent';

export default async function run(h, { check, observe, section }) {
  const { page, db, browser, extensionId } = h;

  section('0 · an Ashby-shaped application held for the person\'s own browser');
  for (const [url, jobId] of [[SLOW, 'as-1']]) {
    await h.open(url, { settle: 3200 });
    await prepareAndRead(h);
    const pk = db.prepare('SELECT id, answers_json FROM apply_gate_packets WHERE job_id = ? ORDER BY id DESC LIMIT 1').get(jobId);
    check(`a packet was prepared for ${jobId}`, !!pk, JSON.stringify(db.prepare('SELECT id, job_id, gate_reason FROM apply_gate_packets').all()));
    if (!pk) return;
    db.prepare("UPDATE apply_gate_packets SET gate_reason = 'server_submit_paused', answers_json = ?, consumed_at = NULL WHERE id = ?")
      .run(JSON.stringify({ ...JSON.parse(pk.answers_json || '{}'), gateReason: 'server_submit_paused' }), pk.id);
  }
  const session = await h.storage.session();
  const gates = Object.keys(session).filter(k => /^gate:\d+$/.test(k));
  if (gates.length) await h.control.evaluate((ks) => chrome.storage.session.remove(ks), gates);
  await page.goto('about:blank');
  const atsBefore = (await h.ats.submissions()).length;

  section('1 · the runner — Fill all opens it in a background tab');
  const runner = await browser.newPage();
  await runner.goto(`chrome-extension://${extensionId}/runner.html`);
  await waitUntil(() => runner.evaluate(() => globalThis.__runnerReady === true), 20000, 200);
  const rowsNow = () => runner.evaluate(() => [...document.querySelectorAll('#runner-rows .row')].map(li => ({
    company: li.querySelector('b')?.textContent, state: li.dataset.state, note: li.querySelector('.note')?.textContent || '' })));
  let rows = await rowsNow();
  check('the application is listed, Waiting', rows.length === 1 && rows.every(r => r.state === 'waiting'), JSON.stringify(rows));

  const t0 = Date.now();
  await runner.click('#runner-fill');   // the person's click
  const done = (r) => r.length && r.every(x => !['waiting', 'opening', 'filling'].includes(x.state));
  rows = await waitUntil(async () => { const r = await rowsNow(); return done(r) ? r : null; }, BUSY_MS * 3, 400) || await rowsNow();
  const ms = Date.now() - t0;
  observe('after Fill all', { rows, ms });
  check('the fill reached a final state (the hidden tab did not stall at opening / filling)', done(rows), JSON.stringify(rows));
  check('the runner stayed the active page (the tabs opened in the background)', await runner.evaluate(() => document.visibilityState) === 'visible');

  section('2 · MEASURED — inside the background tab');
  for (const [url, label] of [[SLOW, 'ashby-spa (2.5 s hydration)']]) {
    const p = (await browser.pages()).find(x => x.url() === url || (url === SLOW && /\/ashby-spa$/.test(x.url())));
    if (!p) { check(`the ${label} tab is open`, false, (await browser.pages()).map(x => x.url()).join(' ')); continue; }
    const m = await p.evaluate(() => {
      const ctl = [...document.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, select')];
      const filled = ctl.filter(e => (e.type === 'checkbox' || e.type === 'radio') ? e.checked : !!e.value).length;
      return { now: document.visibilityState, controls: ctl.length, filled,
        email: document.querySelector('input[name="_systemfield_email"]')?.value || null, name: document.querySelector('input[name="_systemfield_name"]')?.value || null };
    });
    observe(`${label} tab`, m);
    check(`${label}: the tab is still hidden (never brought forward for the fill)`, m.now === 'hidden', m.now);
    check(`${label}: the React form rendered in the hidden tab (${m.controls} controls)`, m.controls > 5, String(m.controls));
    check(`${label}: the fill reached it — name and email typed`, m.email === 'ada@example.test' && !!m.name, `${m.name} / ${m.email}`);
  }
  check('⛔ nothing was sent', (await h.ats.submissions()).length === atsBefore);
  check('⛔ …and nothing recorded as sent', !h.api.requests.some(x => /\/api\/apply\/handoff\/submitted/.test(x.url || x.path || '')));
  await sleep(300);
}

/**
 * T10 rows 5, 6, 7 and 34 (open item 4) · THE OTHER ATS FAMILIES, FILLED — the real extension on each family's MEASURED
 * structure, in a real Chrome.
 * ======================================================================================================================
 *   npm run walk:extension -- atsFamilies [--theme dark]
 *
 *   1. Lever    — /lever-live (scripts/fakeAtsLiveShapes.js: the wrapping labels, the location's status text, the
 *                 résumé link's words, "Name Pronunciation", the EEO selects)
 *   2. Workable — /workable-live (the strong-in-span labels tied by aria-labelledby, the svg / "Choose file" upload, the
 *                 role=radio question, the combobox's backing input, the ≈ 330-character question)
 *   3. Ashby    — /ashby-spa?delay=0 (the replica transcribed from a live Ashby posting: _systemfield_* beside bare
 *                 GUIDs, the autofill drop zone, the EEOC radios)
 *   4. a form that RENDERS LATE (row 34) — /ashby-spa?delay=2500 (its default hydration): Fill pressed while the page says
 *                 "Loading application form…"
 * Each: ONE press of Fill (the chain: identify → bind → prepare → fill) on a job on Ada's board, then the review panel.
 * Asserted: the identity fields hold the profile's values; every field the panel lists has a name (no "Unlabelled"); ONE
 * résumé row; the résumé upload, every EEO question and every eligibility / screening question are left for the person;
 * nothing submitted. Synthetic person (Ada Example) only.
 */
import { defaultSeed, freePort, waitUntil, sleep, BUSY_MS } from '../extensionBrowser.mjs';
import { prepareAndRead } from './panelLifecycle.mjs';

const ATS_PORT = await freePort();
const A = `http://localhost:${ATS_PORT}`;
const PAGES = { lever: `${A}/lever-live`, workable: `${A}/workable-live`, ashby: `${A}/ashby-spa?delay=0`, late: `${A}/ashby-spa?delay=2500` };

export const PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', full_name: 'Ada Example', email: 'ada@example.test', phone: '5550100',
    city: 'Springfield', location: 'Springfield, IL', company: 'Example Corp',
    linkedin: 'https://www.linkedin.com/in/ada-example', github: 'https://github.com/ada-example' },
  handler_map: {},
  custom_answers: {},
};

export const options = {
  viewport: { width: 1280, height: 900 },
  atsPort: ATS_PORT,
  hosts: ['http://localhost/*'],   // TEST BUILD ONLY: the fixtures' origin, standing in for activeTab
  api: {
    seed: (db) => {
      defaultSeed(db);
      const job = db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
        VALUES (?, 'Backend Engineer', 'Example Labs', 'Remote', ?, ?, 't', ?, unixepoch()-3600)`);
      const mine = db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, ?, 1)");
      for (const [k, u] of Object.entries(PAGES)) {
        job.run(`fam-${k}`, u, u, `h-${k}`);
        mine.run(`fam-${k}`);
      }
    },
    payload: PAYLOAD,
  },
};

export const description = 'T10 rows 5–7 + 34: Lever, Workable and Ashby forms as measured, filled in one press; a late-rendering form';

const val = (h, sel) => h.page.$eval(sel, el => el.value).catch(() => null);
const rowsOf = (p) => p?.rows || [];

async function fillAndRead(h, url, { observe, wait = null } = {}) {
  await h.page.goto('about:blank');
  await h.open(url);
  if (wait) await wait();
  const r = await prepareAndRead(h, { dismiss: false });
  const panel = await waitUntil(() => h.readPanel().then(p => (p && rowsOf(p).length ? p : null)), BUSY_MS, 200) || r.panel;
  observe('reply', r.reply?.message || r.reply);
  observe('panel', { subtitle: panel?.subtitle, rows: rowsOf(panel).map(x => `${x.band}:${x.label}=${x.value ?? ''}`) });
  return { reply: r.reply, panel };
}

/** The checks every family shares. `resumeLabel` — the résumé row's words on that form. */
function common(check, panel, { family, resumeLabel }) {
  const rows = rowsOf(panel);
  check(`${family}: the panel lists the form`, rows.length > 0, `${rows.length} rows`);
  const unnamed = rows.filter(x => /Unlabelled|^Attach$/i.test(x.label || ''));
  check(`${family}: every listed field has a name — no "Unlabelled", no "Attach"`, unnamed.length === 0, unnamed.map(x => x.label).join(' | '));
  const resumeRows = rows.filter(x => x.label === resumeLabel);
  check(`${family}: ONE résumé row, "${resumeLabel}", left for the person`, resumeRows.length === 1 && resumeRows[0].band === 'need', JSON.stringify(resumeRows));
}

export default async function run(h, { check, observe, section }) {
  const { page } = h;

  section('1 · Lever — the wrapping labels, as measured');
  const lv = await fillAndRead(h, PAGES.lever, { observe });
  check('Lever: Full name ← the profile', await val(h, 'input[name="name"]') === 'Ada Example');
  check('Lever: Email ← the profile', await val(h, 'input[name="email"]') === 'ada@example.test');
  check('Lever: Phone ← the profile', await val(h, 'input[name="phone"]') === '5550100');
  check('Lever: Current location ← the profile — the dropdown\'s status text no longer hides the question', /Springfield/.test(await val(h, '#location-input') || ''), await val(h, '#location-input'));
  check('Lever: LinkedIn URL ← the profile', await val(h, 'input[name="urls[LinkedIn]"]') === PAYLOAD.field_map.linkedin, await val(h, 'input[name="urls[LinkedIn]"]'));
  check('Lever: GitHub URL ← the profile', await val(h, 'input[name="urls[GitHub]"]') === PAYLOAD.field_map.github, await val(h, 'input[name="urls[GitHub]"]'));
  common(check, lv.panel, { family: 'Lever', resumeLabel: 'Resume/CV' });
  check('Lever: the EEO selects untouched', await val(h, 'select[name="eeo[gender]"]') === '' && await val(h, 'select[name="eeo[veteran]"]') === '');
  const pron = rowsOf(lv.panel).find(x => /Name Pronunciation/.test(x.label || ''));
  check('Lever: "Name Pronunciation" is listed as an ordinary question — not filed with the EEO ones', !!pron && !pron.eeo, JSON.stringify(pron));
  check('Lever: the résumé input holds no file — attaching is the person\'s click', await page.$eval('#resume-upload-input', el => el.files.length) === 0);

  section('2 · Workable — labels in spans, the svg upload, role=radio, as measured');
  const wk = await fillAndRead(h, PAGES.workable, { observe });
  check('Workable: First name ← the profile', await val(h, '#firstname') === 'Ada');
  check('Workable: Last name ← the profile', await val(h, '#lastname') === 'Example');
  check('Workable: Email ← the profile', await val(h, '#email') === 'ada@example.test');
  check('Workable: Phone ← the profile', await val(h, '#phone') === '5550100');
  common(check, wk.panel, { family: 'Workable', resumeLabel: 'Resume' });
  check('Workable: the screening radios are left for the person', await page.$$eval('input[name="QA_start"]', els => els.every(e => !e.checked)));
  check('Workable: the combobox\'s backing input is not written', await val(h, 'input[name="QA_src"]') === '');
  const longRow = rowsOf(wk.panel).find(x => /^Tell us about a system you designed/.test(x.label || ''));
  check('Workable: the ≈ 330-character question is listed by its words', !!longRow, rowsOf(wk.panel).map(x => x.label).join(' | '));

  section('3 · Ashby — the replica of a live posting, hydrated');
  const ab = await fillAndRead(h, PAGES.ashby, { observe, wait: () => page.waitForSelector('#f_addl', { timeout: 10000 }) });
  check('Ashby: Legal Name ← the profile', await val(h, '#f_legal') === 'Ada Example', await val(h, '#f_legal'));
  check('Ashby: Email ← the profile', await val(h, '#f_email') === 'ada@example.test');
  check('Ashby: Phone Number ← the profile', await val(h, '#f_phone') === '5550100', await val(h, '#f_phone'));
  common(check, ab.panel, { family: 'Ashby', resumeLabel: 'Resume' });
  check('Ashby: the self-identification radios untouched', await page.$$eval('#chunk2 fieldset input[type=radio]', els => els.length > 0 && els.every(e => !e.checked)));

  section('4 · a form that renders LATE — Fill pressed while the page is still loading it (row 34)');
  await page.goto('about:blank');
  await h.open(PAGES.late);
  const loading = await page.$eval('#boot', el => el.textContent).catch(() => null);
  observe('when Fill is pressed', loading);
  check('the form is not there yet when Fill is pressed', /Loading application form/.test(loading || ''), loading);
  const t0 = Date.now();
  const late = await prepareAndRead(h, { dismiss: false });
  observe('reply', { message: late.reply?.message || late.reply, after_ms: Date.now() - t0 });
  const filledLate = await waitUntil(async () => ((await val(h, '#f_email')) === 'ada@example.test' ? true : null), 8000, 200);
  observe('the late form after the press', { legal: await val(h, '#f_legal'), email: await val(h, '#f_email') });
  check('ONE press fills the form that rendered after it — the identity block holds the profile\'s values', !!filledLate && await val(h, '#f_legal') === 'Ada Example');

  section('throughout');
  const subs = await fetch(`${A}/_submissions`).then(r => r.json()).catch(() => ({ count: -1 }));
  check('nothing was submitted on any form (draft never submits)', subs.count === 0, JSON.stringify(subs.count));
  await sleep(0);
}

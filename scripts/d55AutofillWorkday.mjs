#!/usr/bin/env node
/**
 * D55 — the autofill engine, REAL-RUN verification in HEADLESS Chrome against the LOCAL fake ATS.
 * ============================================================================================
 * Never a real employer: every page here is scripts/fakeAts.js on localhost, the API is
 * routes/apply.js over an in-memory database, and the candidate is SYNTHETIC (Ada Lovelace,
 * example.com, a 555 number).
 *
 * Three scenarios, each on its own tab and its own freshly minted packet:
 *
 *   1. /workday-replica — the six-step wizard. The fill must: fill My Information (dropdown buttons
 *      with late listboxes, a typeahead), My Experience (Add Another per work / education / website
 *      entry, school + field-of-study typeaheads, skill chips, the résumé into the RÉSUMÉ drop zone
 *      and not the cover letter's), STOP at Application Questions with work authorisation,
 *      sponsorship and the "7+ years?" screen left for the candidate and the marketing opt-in
 *      unticked, STOP at Voluntary Disclosures and Self Identify with EEO left blank, RESUME BY
 *      ITSELF each time the candidate (this harness) answers, advance with the portal's own Save and
 *      Continue, and STOP AT REVIEW. Submit must never be pressed — fakeAts records every press.
 *   2. /gated/form — a single page (Greenhouse validates only on submit). With the work-authorisation
 *      answer missing from the packet, the badge must read "Complete required fields (1)" and flip
 *      to "Filled — review and submit" by itself once the candidate answers.
 *   3. /gated/signin — a page the packet barely matches (one "email" box on a sign-in form). The
 *      badge must say "This form isn't recognised — nothing was filled", and nothing may be filled.
 *
 * ⚠ HOW THE FILL IS TRIGGERED. The shipped extension acts only under activeTab, granted by the
 * user's gesture (the shortcut or the toolbar). Headless Chrome has no window to press a key into,
 * so the TEST BUILD — and only it — also lists the fake ATS's origin in host_permissions, and the
 * fill is started with the same FILL_ACTIVE_TAB message the popup's "Fill it" button sends. The
 * shipped manifest is untouched (test/extensionGatedHandoff.test.js pins it). What this run does
 * NOT prove is the gesture itself; G0/G2 measured that in a headed browser.
 *
 * Usage:  node scripts/d55AutofillWorkday.mjs      (D55_ATS_PORT overrides the fake ATS's port)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import Database from 'better-sqlite3';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';
import applyRoutes from '../routes/apply.js';
import { MIGRATIONS } from './migrations.js';
import { buildGatePacket, buildPacketEntries } from '../services/applyGatePacket.js';
import { buildStructuredResume } from '../services/resumeFormatter.js';
import { CANONICAL_ORIGIN } from '../shared/brand.js';

const APP_URL_DECL = `const RESUME_MASTER_URL = '${CANONICAL_ORIGIN}';`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(os.tmpdir(), 'd55-autofill-workday');
const ATS_PORT = Number(process.env.D55_ATS_PORT) || 4637;
const PORTAL = `http://localhost:${ATS_PORT}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const results = [];
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  results.push({ label, pass: !!cond, extra });
  if (!cond) failures++;
};

// A synthetic one-page PDF — no real résumé is ever read.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

// ── The synthetic candidate ─────────────────────────────────────────────────
const PROFILE = {
  full_name: 'Ada Lovelace', university: 'Example State University', highest_degree: 'Bachelor of Science',
  field_of_study: 'Computer Science', graduation_year: 2019,
  current_company: 'Analytical Engines', current_job_title: 'Senior Engineer',
  linkedin_url: 'linkedin.com/in/ada-example', github_url: 'https://github.com/ada-example',
  confirmed_skills: JSON.stringify(['JavaScript', 'Python', 'SQL', 'Kubernetes']),
};
const RESUME_TEXT = [
  'Ada Lovelace', 'Senior Engineer', 'ada@example.com',
  'EXPERIENCE',
  'Analytical Engines | Jan 2022 – Present', 'Senior Engineer',
  "- Built the difference engine's scheduler", '- Led a team of four',
  'Northwind Systems | Jun 2019 - Dec 2021', 'Software Engineer', '- Wrote the billing service',
].join('\n');
const FIELD_MAP = {
  first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '+1 (555) 010-0100',
  address1: '1 Example Way', city: 'Springfield', state: 'Illinois', zip: '62701', country: 'United States',
  requires_sponsorship: 'No', work_authorization: 'Yes',
};

function startApi() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'PRO');
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT,
      full_name TEXT, email TEXT, phone TEXT, custom_answers TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT,
      apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE resumes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, job_id TEXT,
      apply_mode TEXT, ats_score INTEGER, html TEXT, updated_at INTEGER);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT,
      approval_mode TEXT, tool_type TEXT, status TEXT, total_jobs INTEGER, held_count INTEGER DEFAULT 0,
      submitted_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()), started_at INTEGER, finished_at INTEGER, line_position INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER,
      approved_at INTEGER, approved_from_run_job_id INTEGER, job_id TEXT, status TEXT,
      reason_code TEXT, reason_detail TEXT, started_at INTEGER, finished_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()), answers_json TEXT, resume_artifact_id INTEGER,
      resume_ats_score INTEGER, screenshot_path TEXT, submit_verified INTEGER, submit_evidence TEXT,
      posting_title TEXT, posting_company TEXT, posting_url TEXT, posting_location TEXT,
      base_ats_score INTEGER, base_ats_json TEXT, open_questions_json TEXT,
      ats_score INTEGER, attempt_count INTEGER NOT NULL DEFAULT 0, fields_discovered INTEGER, corrections_json TEXT, blanks_json TEXT, hidden_at INTEGER,
      locked_at INTEGER, resume_file TEXT, resume_id INTEGER, UNIQUE(run_id, job_id));
    CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER,
      user_id INTEGER, job_id TEXT, level TEXT DEFAULT 'info', event TEXT, message TEXT,
      details_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_idempotency (user_id INTEGER NOT NULL, idem_key TEXT NOT NULL, endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200, response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY (user_id, idem_key));
    CREATE TABLE job_applications (user_id INTEGER, job_id TEXT, company TEXT, role TEXT, job_url TEXT,
      source TEXT, location TEXT, apply_mode TEXT, resume_file TEXT, applied_at INTEGER, notes TEXT,
      auto_status TEXT, UNIQUE(user_id, job_id));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER DEFAULT (unixepoch()));
    INSERT INTO users (id, username) VALUES (1, 'ada');
    INSERT INTO apply_runs (id, user_id, mode, status, total_jobs) VALUES (1, 1, 'auto', 'completed', 3);
  `);
  for (const id of ['079_apply_gate_packets', '080_apply_gate_review']) db.exec(MIGRATIONS.find(m => m.id === id).sql);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RM-Auth-Context');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use((req, _res, next) => { req.user = { id: 1, planTier: 'PRO' }; next(); });
  app.get('/api/auth/me', (_req, res) => res.json({ authenticated: true, user: { username: 'ada', isAdmin: false } }));
  app.get('/api/auth/extension-token', (_req, res) => res.json({ token: 'd55-harness-token' }));
  applyRoutes(app, db, (q, r, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }),
    async () => ({ error: 'not_needed' }), async () => PDF, async () => ({}));
  return new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve({ db, server })); });
}

let runJobSeq = 0;
function seedPacket(db, { jobId, url, fieldMap, entries, handlerMap = {}, customAnswers = {}, workedHere = null }) {
  runJobSeq += 1;
  db.prepare(`INSERT INTO scraped_jobs (job_id, title, company, url, apply_url, source) VALUES (?, 'Senior Engineer', 'Northwind Systems', ?, ?, 'workday')`)
    .run(jobId, url, url);
  db.prepare(`INSERT INTO resumes (user_id, job_id, apply_mode, ats_score, html, updated_at) VALUES (1, ?, 'TAILORED', 80, '<html><body>resume</body></html>', unixepoch())`).run(jobId);
  db.prepare(`INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, reason_code, resume_artifact_id) VALUES (?, 1, 1, ?, 'held_gate', 'login_required', ?)`)
    .run(runJobSeq, jobId, runJobSeq);
  const packet = buildGatePacket({
    autofillPayload: { field_map: fieldMap, handler_map: handlerMap, custom_answers: customAnswers,
      ...(workedHere ? { worked_here: workedHere } : {}) },
    applyUrl: url, jobId, runId: 1, runJobId: runJobSeq, resumeArtifactId: runJobSeq, gateReason: 'login_required',
    entries,
  });
  db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason,
     answers_json, resume_artifact_id, token_hash, expires_at) VALUES (1,1,?,?,?,?,'login_required',?,?,?,0)`)
    .run(runJobSeq, jobId, url, new URL(url).origin, JSON.stringify(packet), runJobSeq, `unminted:seed${runJobSeq}`);
  return packet;
}

function buildTestExtension(apiOrigin) {
  const src = path.join(ROOT, 'extension');
  const dst = path.join(OUT_DIR, 'extension');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'submission' || e.name === 'dist') continue;
      fs.cpSync(path.join(src, e.name), path.join(dst, e.name), { recursive: true });
    } else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
  for (const f of ['background.js', 'config.js']) {
    const p = path.join(dst, f);
    const text = fs.readFileSync(p, 'utf8');
    if (!text.includes(APP_URL_DECL) && f === 'background.js') throw new Error(`${f} no longer declares ${APP_URL_DECL}`);
    fs.writeFileSync(p, text.replace(APP_URL_DECL, `const RESUME_MASTER_URL = '${apiOrigin}';`));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8'));
  // TEST BUILD ONLY — see the header: the headless stand-in for the user's gesture.
  manifest.host_permissions = [...manifest.host_permissions, `${apiOrigin}/*`, `${PORTAL}/*`];
  fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dst;
}

const badgeOf = (page) => page.evaluate(() => {
  const h = document.getElementById('rm-draft-autofill-badge');
  return h ? { state: h.dataset.state || null, missing: Number(h.dataset.missing || 0), dismissed: h.dataset.dismissed === '1',
               text: h.shadowRoot?.querySelector('[data-role="text"]')?.textContent || '' } : null;
});
const stepOf = (page) => page.evaluate(() => document.querySelector('[data-automation-id="pageHeader"]')?.textContent || '');
const waitUntil = async (fn, ms, every = 250) => {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); }
};
// The candidate answering a Workday dropdown themselves.
const humanPick = async (page, buttonId, optionText) => {
  await page.click(`#${buttonId}`);
  await page.waitForSelector('[role="option"]', { timeout: 3000 });
  await page.evaluate((t) => [...document.querySelectorAll('[role="option"]')].find(o => o.textContent === t)?.click(), optionText);
  await sleep(150);
};

async function startFill(control, page) {
  await page.bringToFront();
  await sleep(200);
  await control.evaluate(() => chrome.storage.session.remove('lastGatedHandoff'));
  // Fire and forget: on a wizard the answer comes back only when the run stops.
  await control.evaluate(() => { chrome.runtime.sendMessage({ type: 'FILL_ACTIVE_TAB' }).catch(() => {}); });
}
const lastResult = (control) => control.evaluate(() => chrome.storage.session.get('lastGatedHandoff')).then(r => r?.lastGatedHandoff || null);

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('=== D55 — the autofill engine against the local Workday replica (headless Chrome) ===\n');
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }

  const ats = spawn(process.execPath, [path.join(ROOT, 'scripts', 'fakeAts.js')],
    { env: { ...process.env, PORT: String(ATS_PORT) }, stdio: 'ignore' });
  const up = await waitUntil(() => fetch(`${PORTAL}/workday-replica`).then(r => r.ok).catch(() => false), 15000, 200);
  if (!up) throw new Error(`fakeAts did not come up on ${PORTAL}`);
  await fetch(`${PORTAL}/_reset`, { method: 'POST' });

  const { db, server } = await startApi();
  const apiOrigin = `http://127.0.0.1:${server.address().port}`;
  const ext = buildTestExtension(apiOrigin);
  const profileDir = path.join(OUT_DIR, 'profile');
  fs.rmSync(profileDir, { recursive: true, force: true });
  const browser = await puppeteer.launch({
    executablePath: resolution.path, headless: true, pipe: true, enableExtensions: true, userDataDir: profileDir,
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,1000'], defaultViewport: { width: 1280, height: 1000 },
  });

  try {
    const extensionId = await browser.installExtension(ext);
    const control = await browser.newPage();
    await control.goto(`chrome-extension://${extensionId}/options.html`);

    // ══ 1 · the Workday wizard ═══════════════════════════════════════════════════════════════
    console.log('── 1 · /workday-replica ──');
    const entries = buildPacketEntries({ profile: PROFILE, structuredResume: buildStructuredResume(RESUME_TEXT) });
    seedPacket(db, { jobId: 'd55wd', url: `${PORTAL}/workday-replica`, fieldMap: FIELD_MAP, entries });
    const wd = (await browser.pages())[0];
    await wd.goto(`${PORTAL}/workday-replica`, { waitUntil: 'domcontentloaded' });
    await startFill(control, wd);

    const progressSeen = await waitUntil(async () => (await badgeOf(wd))?.state === 'progress', 8000, 100);
    check('the badge reads "Autofill in progress…" while it fills', !!progressSeen, (await badgeOf(wd))?.text);

    // Stop 1: Application Questions.
    const atAQ = await waitUntil(async () => (await stepOf(wd)) === 'Application Questions' && (await badgeOf(wd))?.state === 'required', 60000);
    check('it filled and advanced to Application Questions, then STOPPED', !!atAQ, await stepOf(wd));
    if (!atAQ) {
      // Diagnose rather than cascade: what is the page waiting for?
      console.log(await wd.evaluate(() => JSON.stringify({
        badge: document.getElementById('rm-draft-autofill-badge')?.shadowRoot?.querySelector('[data-role="text"]')?.title,
        panels: [...document.querySelectorAll('[data-automation-id$="Section"] [role="group"][data-automation-id]')].map(p => p.getAttribute('data-automation-id')),
        chips: [...document.querySelectorAll('[data-automation-id="selectedItem"]')].map(c => c.title),
        uploads: [...document.querySelectorAll('[data-automation-id="file-upload-successful"]')].map(u => u.textContent),
      })));
      throw new Error('the wizard did not reach Application Questions');
    }
    const saves1 = (await (await fetch(`${PORTAL}/_workday-replica/state`)).json()).saves;
    const info = saves1.find(s => s.step === 'My Information')?.values || {};
    const exp = saves1.find(s => s.step === 'My Experience')?.values || {};
    check('My Information: names, email, phone, city, postal code', info.legalNameSection_firstName === 'Ada' && info.legalNameSection_lastName === 'Lovelace'
      && info.email === 'ada@example.com' && /555/.test(info['phone-number'] || '') && info.addressSection_city === 'Springfield'
      && info.addressSection_postalCode === '62701', JSON.stringify(info));
    check('a Workday dropdown with a LATE listbox: "United States" -> "United States of America"', info.country === 'United States of America', info.country);
    check('…and the State dropdown', info.addressSection_countryRegion === 'Illinois', info.addressSection_countryRegion);
    check('two work-experience panels opened with Add / Add Another and filled from the résumé',
      exp['workExperience-1-company'] === 'Analytical Engines' && exp['workExperience-2-company'] === 'Northwind Systems'
      && exp['workExperience-1-jobTitle'] === 'Senior Engineer' && exp['workExperience-1-currentlyWorkHere'] === 'checked'
      && exp['workExperience-1-startDate'] === '01/2022' && exp['workExperience-2-endDate'] === '12/2021'
      && /difference engine/.test(exp['workExperience-1-roleDescription'] || ''), JSON.stringify(Object.fromEntries(Object.entries(exp).filter(([k]) => k.startsWith('work')))));
    check('education: the school by TYPEAHEAD', exp['education-1-school'] === 'Example State University', exp['education-1-school']);
    check('education: "Bachelor of Science" -> the ATS\'s "Bachelor\'s Degree"', exp['education-1-degree'] === "Bachelor's Degree", exp['education-1-degree']);
    check('education: "Computer Science" -> the ATS\'s "Computer and Information Sciences" (typed, narrowed, picked)',
      exp['education-1-fieldOfStudy'] === 'Computer and Information Sciences', exp['education-1-fieldOfStudy']);
    check('education: graduation year', exp['education-1-lastYearAttended'] === '2019', exp['education-1-lastYearAttended']);
    check('websites: one panel per URL', exp['websites-1-url'] === 'https://linkedin.com/in/ada-example' && exp['websites-2-url'] === 'https://github.com/ada-example',
      `${exp['websites-1-url']} | ${exp['websites-2-url']}`);
    check('skills: one chip per confirmed skill, in the ATS\'s words; one with no close option left out',
      exp.skills === 'JavaScript, Python (Programming Language), SQL', exp.skills);
    check('languages: none stated, none added', !Object.keys(exp).some(k => k.startsWith('language-')));
    check('the résumé went into the RÉSUMÉ drop zone', /^resume-d55wd\.pdf$/.test(exp.resume || ''), exp.resume);
    check('…and NOT into the cover letter\'s, which comes first on the page', !exp.coverLetter, exp.coverLetter || '(empty)');

    const aq = await wd.evaluate(() => ({
      auth: document.querySelector('#dropdown-q-authorized')?.textContent,
      spon: document.querySelector('#dropdown-q-sponsorship')?.textContent,
      seven: document.querySelector('#dropdown-q-seven-years')?.textContent,
      optIn: document.querySelector('#input-q-marketing')?.checked,
    }));
    check('WORK AUTHORISATION left for the candidate', aq.auth === 'Select One', aq.auth);
    check('SPONSORSHIP left for the candidate', aq.spon === 'Select One', aq.spon);
    check('the screening question that would rule them out ("7+ years?") left — stop and ask', aq.seven === 'Select One', aq.seven);
    check('the marketing opt-in NOT ticked', aq.optIn === false, String(aq.optIn));
    const b1 = await badgeOf(wd);
    check('the badge reads "Complete required fields" — the screening stop is shown', /^Complete required fields \(3\)$/.test(b1?.text || ''), b1?.text);

    // The candidate answers. The run must carry on BY ITSELF.
    await humanPick(wd, 'dropdown-q-authorized', 'Yes');
    await humanPick(wd, 'dropdown-q-sponsorship', 'No');
    await humanPick(wd, 'dropdown-q-seven-years', 'Yes');
    const atVD = await waitUntil(async () => (await stepOf(wd)) === 'Voluntary Disclosures' && (await badgeOf(wd))?.state === 'required', 30000);
    check('after the candidate answered, it RESUMED on its own and advanced to Voluntary Disclosures', !!atVD, await stepOf(wd));
    const vd = await wd.evaluate(() => ['gender', 'ethnicity', 'veteranStatus'].map(k => document.querySelector(`#dropdown-${k}`)?.textContent));
    check('EEO left blank — stated-or-blank, never a default', vd.every(t => t === 'Select One'), vd.join(' | '));
    check('the Terms checkbox left for the candidate', await wd.evaluate(() => document.querySelector('#input-agreementCheckbox')?.checked === false));
    await humanPick(wd, 'dropdown-gender', 'I do not wish to answer');
    await humanPick(wd, 'dropdown-ethnicity', 'I do not wish to answer');
    await humanPick(wd, 'dropdown-veteranStatus', 'I do not wish to answer');
    await wd.click('#input-agreementCheckbox');

    const atSI = await waitUntil(async () => (await stepOf(wd)) === 'Self Identify' && (await badgeOf(wd))?.state === 'required', 30000);
    check('…and on to Self Identify, where the disability form is the candidate\'s', !!atSI, await stepOf(wd));
    await wd.type('#input-selfIdentifiedDisabilityData--name', 'Ada Lovelace');
    await wd.type('#input-selfIdentifiedDisabilityData--dateSignedOn', '10/06/2026');
    await wd.click('#radio-disabilityStatus-2');

    const atReview = await waitUntil(async () => (await stepOf(wd)) === 'Review', 30000);
    check('it advanced to REVIEW', !!atReview, await stepOf(wd));
    const r1 = await waitUntil(() => lastResult(control), 20000);
    check('the run reports it stopped at Review', r1?.ok === true && r1?.wizard?.stoppedAt === 'review',
      `${r1?.message} · stoppedAt=${r1?.wizard?.stoppedAt}`);
    check('the review overlay rendered over Review', r1?.overlay?.rendered === true, JSON.stringify(r1?.overlay));
    const fin = await badgeOf(wd);
    check('the badge reads "Filled — review and submit"', fin?.text === 'Filled — review and submit', fin?.text);
    const stops = r1?.wizard?.stops || [];
    check('the stops are recorded with WHY: eligibility and a screen at Application Questions',
      stops[0]?.step === 'Application Questions' && stops[0].fields.filter(f => f.kind === 'eligibility').length === 2
      && stops[0].fields.some(f => f.kind === 'screening'), JSON.stringify(stops[0]));
    check('…and EEO at Voluntary Disclosures', stops[1]?.fields?.some(f => f.kind === 'eeo'), JSON.stringify(stops[1]));
    await sleep(1500);
    const st = await (await fetch(`${PORTAL}/_workday-replica/state`)).json();
    check('every step before Review was saved, in order, by the portal\'s own Save and Continue',
      st.saves.map(s => s.step).join(' > ') === 'My Information > My Experience > Application Questions > Voluntary Disclosures > Self Identify',
      st.saves.map(s => s.step).join(' > '));
    check('the opt-in is still unticked in what the portal saved', st.saves.find(s => s.step === 'Application Questions')?.values['q-marketing'] === '');
    check('⛔ SUBMIT WAS NEVER PRESSED', st.submitPressed === 0 && st.submitted.length === 0, `submitPressed=${st.submitPressed}`);
    check('…and the Submit button is still there, waiting for the candidate',
      await wd.evaluate(() => document.querySelector('[data-automation-id="bottom-navigation-next-button"]')?.textContent === 'Submit'));

    // ══ 2 · a single page: the pre-check and the live flip ═════════════════════════════════════
    console.log('\n── 2 · /gated/form — Greenhouse-shaped, validates only on submit ──');
    const { work_authorization, ...withoutAuth } = FIELD_MAP; void work_authorization;
    seedPacket(db, { jobId: 'd55gh', url: `${PORTAL}/gated/form`, fieldMap: withoutAuth, entries: null });
    const gh = await browser.newPage();
    await gh.goto(`${PORTAL}/gated/form`, { waitUntil: 'domcontentloaded' });
    await startFill(control, gh);
    const r2 = await waitUntil(() => lastResult(control), 30000);
    check('the single-page fill ran', r2?.ok === true && !r2?.wizard, r2?.message);
    const b2 = await badgeOf(gh);
    check('the pre-check found the ONE empty required question — "Complete required fields (1)"',
      b2?.state === 'required' && b2?.missing === 1, b2?.text);
    await gh.select('select[name="work_authorization"]', 'Yes');
    const flipped = await waitUntil(async () => (await badgeOf(gh))?.state === 'done', 6000);
    check('…and flipped to "Filled — review and submit" by itself once the candidate answered', !!flipped, (await badgeOf(gh))?.text);

    // ══ 3 · not recognised ═══════════════════════════════════════════════════════════════════
    console.log('\n── 3 · /gated/signin — a page the packet barely matches ──');
    seedPacket(db, { jobId: 'd55si', url: `${PORTAL}/gated/signin`, fieldMap: FIELD_MAP, entries: null });
    const si = await browser.newPage();
    await si.goto(`${PORTAL}/gated/signin`, { waitUntil: 'domcontentloaded' });
    await startFill(control, si);
    const r3 = await waitUntil(() => lastResult(control), 30000);
    check('the run refused: form_not_recognised', r3?.ok === false && r3?.reason === 'form_not_recognised', `${r3?.reason}: ${r3?.message}`);
    const b3 = await badgeOf(si);
    check('the badge says "This form isn\'t recognised — nothing was filled"', b3?.text === "This form isn't recognised — nothing was filled", b3?.text);
    const typed = await si.evaluate(() => [...document.querySelectorAll('input')].filter(i => i.type !== 'hidden' && i.type !== 'submit' && i.value).length);
    check('…and nothing was typed into it — not even the email box', typed === 0, `${typed} filled`);

    // ══ 4 · D55 (f): saved answers, worked-here and the EEO decline, on the same wizard ════════════
    console.log('\n── 4 · /workday-replica — saved answers, "have you worked here?", EEO decline ──');
    await fetch(`${PORTAL}/_reset`, { method: 'POST' });
    const DECLINE = 'Choose not to disclose';
    const pkt4 = seedPacket(db, {
      jobId: 'd55wdf', url: `${PORTAL}/workday-replica`, fieldMap: FIELD_MAP, entries,
      // The candidate's own saved answers, worded EXACTLY as this form asks — and one opt-in "No".
      customAnswers: {
        'Are you legally authorized to work in the United States?': 'Yes',
        'Will you now or in the future require sponsorship for employment visa status (e.g., H-1B visa status)?': 'No',
        'Do you have 7+ years of professional software engineering experience?': 'Yes',
        'Yes, I would like to receive text messages and marketing communications about future opportunities.': 'No',
      },
      // The posting's employer is in the stated work history, so "previously worked here?" is Yes.
      workedHere: { company: 'Northwind Systems', history: ['Analytical Engines', 'Northwind Systems'] },
      // Declined EVERY EEO field — the fill must pick each form's own decline wording.
      handlerMap: { gender: DECLINE, ethnicity: DECLINE, veteran: DECLINE, disability: DECLINE },
    });
    check('the packet carries the saved answers, worked-here and the four declines',
      pkt4.savedAnswers?.length === 4 && pkt4.workedHere?.answer === 'Yes' && (pkt4.eeoDeclines || []).length === 4,
      JSON.stringify({ saved: pkt4.savedAnswers?.length, worked: pkt4.workedHere, declines: pkt4.eeoDeclines }));
    const wf = await browser.newPage();
    await wf.goto(`${PORTAL}/workday-replica`, { waitUntil: 'domcontentloaded' });
    await startFill(control, wf);
    // Application Questions is answered entirely from saved answers, so the first stop is Voluntary
    // Disclosures' Terms checkbox (a consent — always the candidate's).
    const atVD4 = await waitUntil(async () => (await stepOf(wf)) === 'Voluntary Disclosures' && (await badgeOf(wf))?.state === 'required', 90000);
    check('it went through Application Questions WITHOUT stopping — every question had a saved answer', !!atVD4, await stepOf(wf));
    const st4a = await (await fetch(`${PORTAL}/_workday-replica/state`)).json();
    const info4 = st4a.saves.find(s => s.step === 'My Information')?.values || {};
    const aq4 = st4a.saves.find(s => s.step === 'Application Questions')?.values || {};
    check('"Have you previously worked for this company?" — Yes, from the work history', info4.previousWorker === 'Yes', info4.previousWorker);
    check('work authorisation — the saved answer, exactly', aq4['q-authorized'] === 'Yes', aq4['q-authorized']);
    check('sponsorship — the saved answer, exactly', aq4['q-sponsorship'] === 'No', aq4['q-sponsorship']);
    check('the "7+ years?" screen — the candidate\'s own saved answer', aq4['q-seven-years'] === 'Yes', aq4['q-seven-years']);
    check('the marketing opt-in — the saved "No": unticked', aq4['q-marketing'] === '', String(aq4['q-marketing']));
    const vd4 = await wf.evaluate(() => ['gender', 'ethnicity', 'veteranStatus'].map(k => document.querySelector(`#dropdown-${k}`)?.textContent));
    check('EEO DECLINE: gender, ethnicity, veteran — each the FORM\'s own decline option',
      vd4.every(t => t === 'I do not wish to answer'), vd4.join(' | '));
    await wf.click('#input-agreementCheckbox');
    const atSI4 = await waitUntil(async () => (await stepOf(wf)) === 'Self Identify' && (await badgeOf(wf))?.state === 'required', 30000);
    check('…on to Self Identify', !!atSI4, await stepOf(wf));
    const dis4 = await wf.evaluate(() => [...document.querySelectorAll('input[name="disabilityStatus"]')].find(r => r.checked)?.value || null);
    check('the disability form (a question that names nothing) — its own decline, "I do not want to answer"',
      dis4 === 'I do not want to answer', String(dis4));
    await wf.type('#input-selfIdentifiedDisabilityData--name', 'Ada Lovelace');
    await wf.type('#input-selfIdentifiedDisabilityData--dateSignedOn', '10/06/2026');
    const atReview4 = await waitUntil(async () => (await stepOf(wf)) === 'Review', 30000);
    check('…and to REVIEW', !!atReview4, await stepOf(wf));
    await sleep(1500);
    const st4 = await (await fetch(`${PORTAL}/_workday-replica/state`)).json();
    const vdSaved = st4.saves.find(s => s.step === 'Voluntary Disclosures')?.values || {};
    check('what the portal SAVED for EEO is the decline, in its own words',
      vdSaved.gender === 'I do not wish to answer' && vdSaved.ethnicity === 'I do not wish to answer' && vdSaved.veteranStatus === 'I do not wish to answer',
      JSON.stringify(vdSaved));
    check('⛔ SUBMIT WAS NEVER PRESSED (scenario 4)', st4.submitPressed === 0 && st4.submitted.length === 0, `submitPressed=${st4.submitPressed}`);

    const subs = await (await fetch(`${PORTAL}/_submissions`)).json();
    check('⛔ NOTHING reached the fake ATS as a submission, across all three', subs.count === 0, `count=${subs.count}`);
  } finally {
    await browser.close().catch(() => {});
    server.close();
    db.close();
    ats.kill();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}  (${results.length} checks; ${path.join(OUT_DIR, 'results.json')})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('\nHARNESS FAILED:', e); process.exit(1); });

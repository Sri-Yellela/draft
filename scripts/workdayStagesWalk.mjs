#!/usr/bin/env node
/**
 * v1.5.2 · ONE JOB ACROSS WORKDAY'S STAGES — the REAL extension, in headless Chrome, end to end.
 * ============================================================================================
 * The owner's case (10-12): the application opened straight from LinkedIn at
 *   https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin
 * — the extension never saw the posting, and the board's Zoom copy came from another ATS.
 *
 * What runs: the extension (a test build: the API origin and the tenant in host_permissions, standing in for the
 * user's gesture exactly as scripts/d55AutofillWorkday.mjs explains), the REAL routes (routes/apply.js and
 * routes/importJob.js) on the FULL schema, a SYNTHETIC user, and scripts/fakeAts.js serving the owner's paths. The
 * tenant's real host name is MAPPED onto the fake ATS by Chrome's resolver rule, so every URL the extension and the
 * server see is the owner's own shape. Nothing reaches Zoom or Workday.
 *
 *   1. capture on /apply/applyManually?source=linkedin → stored as the POSTING, the key recorded, the tab bound
 *   2. capture again on /apply/useMyLastApplication → the same job, "Already captured", no new prompt
 *   3. "Captured today" = 1
 *   4. the popup's context on another stage → Captured ✓ (bound, captured)
 *   5. Fill on a stage → NOT "capture it first": the job is yours, Prepare is offered
 *   6. Prepare → the packet fills the stage's form (its address joined through the user's own capture)
 *   7. the step changes WITHOUT the URL changing → the Copy sheet panel opens in the page with the PREPARED answers
 *   8. the tab closes → its binding is gone
 *
 * Usage:  node scripts/workdayStagesWalk.mjs        (exit 1 on any FAIL)
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
import { createImportJobRouter } from '../routes/importJob.js';
import { MIGRATIONS } from './migrations.js';
import { CANONICAL_ORIGIN } from '../shared/brand.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(os.tmpdir(), 'workday-stages-walk');
const ATS_PORT = Number(process.env.WALK_ATS_PORT) || 4673;
const TENANT = 'zoom.wd5.myworkdayjobs.com';
const T = `http://${TENANT}`;
const POSTING_PATH = '/Zoom/job/Remote--(US)/Software-Engineer_R19749-1';
const OWNER_STAGE = `${T}/en-US${POSTING_PATH}/apply/applyManually?source=linkedin`;
const OTHER_STAGE = `${T}${POSTING_PATH}/apply/useMyLastApplication?source=linkedin`;
const APP_URL_DECL = `const RESUME_MASTER_URL = '${CANONICAL_ORIGIN}';`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (label, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`); if (!cond) failures++; };
const waitUntil = async (fn, ms, every = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); } };

function startApi() {
  const db = new Database(':memory:');
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  // the board's copy of the job came from ANOTHER ATS — the owner's case
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('gh-zoom-1','Software Engineer','Zoom','Remote (US)','https://boards.greenhouse.io/zoom/jobs/9001','https://boards.greenhouse.io/zoom/jobs/9001','t','h1',unixepoch()-86400)`).run();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RM-Auth-Context, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use((req, _res, next) => { req.user = { id: 1, planTier: 'PRO', username: 'ada' }; next(); });
  app.get('/api/auth/me', (_req, res) => res.json({ authenticated: true, user: { username: 'ada', isAdmin: false } }));
  app.get('/api/auth/extension-token', (_req, res) => res.json({ token: 'walk-harness-token' }));
  app.get('/api/draft/slots', (_req, res) => res.json({ limit: 10, used: 0, remaining: 10, windowHours: 24 }));
  const PAYLOAD = { field_map: { first_name: 'Ada', last_name: 'Example', email: 'ada@example.test' }, handler_map: {},
    custom_answers: { 'Why do you want to work at Zoom?': 'Video for everyone.' } };
  applyRoutes(app, db, (q, r, n) => n(), () => PAYLOAD, async () => ({ error: 'not_needed' }), async () => Buffer.from('%PDF-1.4'), async () => ({}), () => null, {});
  app.use('/api/import', createImportJobRouter(db));
  return new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve({ db, server })); });
}

function buildTestExtension(apiOrigin) {
  const src = path.join(ROOT, 'extension');
  const dst = path.join(OUT_DIR, 'extension');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name === 'submission' || e.name === 'dist') continue; fs.cpSync(path.join(src, e.name), path.join(dst, e.name), { recursive: true }); }
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
  for (const f of ['background.js', 'config.js']) {
    const p = path.join(dst, f);
    const text = fs.readFileSync(p, 'utf8');
    if (!text.includes(APP_URL_DECL) && f === 'background.js') throw new Error(`${f} no longer declares ${APP_URL_DECL}`);
    fs.writeFileSync(p, text.replace(APP_URL_DECL, `const RESUME_MASTER_URL = '${apiOrigin}';`));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8'));
  manifest.host_permissions = [...manifest.host_permissions, `${apiOrigin}/*`, `${T}/*`];   // TEST BUILD ONLY
  fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dst;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('=== v1.5.2 — one job across Workday\'s stages, the real extension in headless Chrome ===\n');
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
  const ats = spawn(process.execPath, [path.join(ROOT, 'scripts', 'fakeAts.js')], { env: { ...process.env, PORT: String(ATS_PORT) }, stdio: 'ignore' });
  const up = await waitUntil(() => fetch(`http://localhost:${ATS_PORT}${POSTING_PATH}`).then(r => r.ok).catch(() => false), 15000);
  if (!up) throw new Error('fakeAts did not come up');
  const { db, server } = await startApi();
  const apiOrigin = `http://127.0.0.1:${server.address().port}`;
  const ext = buildTestExtension(apiOrigin);
  const profileDir = path.join(OUT_DIR, 'profile');
  fs.rmSync(profileDir, { recursive: true, force: true });
  const browser = await puppeteer.launch({
    executablePath: resolution.path, headless: true, pipe: true, enableExtensions: true, userDataDir: profileDir,
    args: ['--no-first-run', '--no-default-browser-check', `--host-resolver-rules=MAP ${TENANT} 127.0.0.1:${ATS_PORT}`],
    defaultViewport: { width: 1280, height: 900 },
  });
  try {
    const extensionId = await browser.installExtension(ext);
    const control = await browser.newPage();
    await control.goto(`chrome-extension://${extensionId}/options.html`);
    const send = (msg) => control.evaluate((m) => chrome.runtime.sendMessage(m), msg);
    const session = () => control.evaluate(() => chrome.storage.session.get(null));

    const page = (await browser.pages())[0];
    const goStage = async (url) => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.bringToFront(); await sleep(250); };

    console.log('── 1 · capture on the stage the owner opened from LinkedIn ──');
    await goStage(OWNER_STAGE);
    const first = await send({ type: 'CAPTURE_ACTIVE_TAB' });
    check('the capture succeeded', first?.success === true, first?.message);
    const jobId = first?.jobId;
    const stored = db.prepare('SELECT url FROM job_captures WHERE user_id = 1 ORDER BY id DESC LIMIT 1').pluck().get();
    check('stored as the POSTING — stage, query and locale stripped', stored === `${T}${POSTING_PATH}`, stored);
    check('the job key is recorded', db.prepare("SELECT job_id FROM job_page_keys WHERE page_key = 'workday|zoom|zoom|R19749'").pluck().get() === jobId);
    const binds = Object.entries(await session()).filter(([k]) => k.startsWith('bind:'));
    check('the tab is BOUND to the job', binds.length === 1 && binds[0][1].jobId === String(jobId) && binds[0][1].via === 'capture', JSON.stringify(binds[0]?.[1] || null));

    console.log('── 2 · capture again on another stage ──');
    await goStage(OTHER_STAGE);
    const again = await send({ type: 'CAPTURE_ACTIVE_TAB' });
    check('the same job', again?.jobId === jobId, `${again?.jobId} vs ${jobId}`);
    check('"Already captured" — idempotent, says so', /^Already captured — .* is on your board and in your imports\.$/.test(again?.message || ''), again?.message);

    console.log('── 3 · Captured today ──');
    const today = await send({ type: 'CAPTURED_TODAY' });
    check('two captures of one job count once', today?.today === 1, JSON.stringify(today));

    console.log('── 4 · the popup\'s context on a stage ──');
    const ctx = await send({ type: 'POPUP_CONTEXT' });
    check('the posting is known and captured on this stage', ctx?.posting?.jobId === jobId && ctx?.posting?.captured === true, JSON.stringify(ctx?.posting || null).slice(0, 160));
    check('the binding comes with it', ctx?.binding?.jobId === String(jobId), JSON.stringify(ctx?.binding || null));

    console.log('── 5 · Fill on a stage ──');
    const fill = await send({ type: 'FILL_ACTIVE_TAB' });
    check('NOT "draft doesn\'t know this job — capture it first"', !/capture it first/.test(fill?.message || ''), fill?.message);
    check('the job is yours: Prepare is offered', fill?.canPrepare === true, JSON.stringify(fill));

    console.log('── 6 · Prepare → the stage\'s form is filled ──');
    const prep = await send({ type: 'PREPARE_ACTIVE_TAB' });
    check('prepared and filled', prep?.ok === true, prep?.message);
    const filled = await waitUntil(() => page.evaluate(() => document.querySelector('input[name="firstName"]')?.value), 8000);
    check('the form carries the prepared answer', filled === 'Ada', String(filled));
    const prepFill = await page.evaluate(() => ({ last: document.querySelector('input[name="lastName"]')?.value, email: document.querySelector('input[name="email"]')?.value }));
    check('…every field the packet answers', prepFill.last === 'Example' && prepFill.email === 'ada@example.test', JSON.stringify(prepFill));

    console.log('── 7 · the step changes without the URL changing → the Copy sheet in the page ──');
    const urlBefore = page.url();
    await page.click('#next-step');
    check('the step changed and the URL did not', page.url() === urlBefore && /my experience/.test(await page.$eval('[data-stage]', el => el.textContent)));
    const panel = await send({ type: 'COPY_SHEET_PANEL' });
    check('the Copy sheet panel opened in the page', panel?.ok === true, JSON.stringify(panel));
    const sheet = await page.evaluate(() => {
      const r = document.getElementById('rm-copy-sheet-panel')?.shadowRoot;
      return r ? { sub: r.querySelector('.t small')?.textContent, labels: [...r.querySelectorAll('li .k')].map(k => k.textContent) } : null;
    });
    check('it names the job and shows the PREPARED answers', /Software Engineer at Zoom · prepared answers/.test(sheet?.sub || ''), sheet?.sub);
    check('…including the saved answer for this employer', (sheet?.labels || []).includes('Why do you want to work at Zoom?'), (sheet?.labels || []).join(' | '));
    await page.keyboard.press('Escape');
    check('Esc closes it', await page.evaluate(() => !document.getElementById('rm-copy-sheet-panel')));

    console.log('── 8 · the tab closes ──');
    const tabCount = Object.keys(await session()).filter(k => k.startsWith('bind:')).length;
    await page.close();
    const gone = await waitUntil(async () => Object.keys(await session()).filter(k => k.startsWith('bind:')).length === 0, 4000);
    check('its binding is gone', tabCount === 1 && !!gone, `before ${tabCount}`);
  } finally {
    await browser.close().catch(() => {});
    server.close();
    ats.kill();
  }
  console.log(`\n${failures ? `FAILED — ${failures} check(s)` : 'ALL PASS'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

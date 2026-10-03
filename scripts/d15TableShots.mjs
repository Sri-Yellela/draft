#!/usr/bin/env node
/**
 * D15 — The Table's application history, on STUBBED /api/*.
 * ============================================================================================
 *   node scripts/d15TableShots.mjs [label]
 *
 * Drives the real client (vite on :5198) in a real browser. /api/applications/history is answered
 * with rows built by shared/applicationHistory.js's buildHistory — the SAME function the server
 * runs — over SYNTHETIC database rows covering every chip (in play, sent, a matured "Did they
 * reply?", replied incl. a rejection, no reply, closed). The reply PATCH mutates the fixture so a
 * click is seen to move the row; the résumé download answers 500 artifact_corrupt / 404
 * artifact_missing, to show the failure is said out loud. Writes PNGs to
 * ../draft-screenshots/d15-the-table/. Nobody's data.
 *
 * Excluded from verify:harness: screenshots, and it needs a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { LOGO_HOST } from '../shared/companyLogos.js';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';
import { buildHistory } from '../shared/applicationHistory.js';
import { mergeResponse } from '../shared/applicationResponse.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const LABEL = process.argv[2] || 'd15';
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', 'd15-the-table');
const PORT = 5198;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);
const D = 86400;

function seed() {
  const jobs = [
    ['j0', 'Northwind', 'Software Engineer, Payments'], ['j1', 'Fabrikam', 'Backend Engineer'],
    ['j2', 'Contoso', 'Full Stack Engineer'], ['j3', 'Tailspin', 'Platform Engineer'],
    ['j4', 'Litware', 'Data Engineer'], ['j5', 'Adatum', 'Software Engineer II'],
    ['j6', 'Proseware', 'Site Reliability Engineer'], ['j7', 'Wingtip', 'API Engineer'],
  ].map(([job_id, company, title], i) => ({ job_id, company, title, apply_url: `https://example.invalid/${i}` }));
  const rec = (id, job_id, state, created, extra = {}) =>
    ({ id, job_id, state, origin: 'generated', created_at: now - created * D, updated_at: now - created * D, ...extra });
  const app = (id, job_id, applied, extra = {}) => {
    const j = jobs.find(x => x.job_id === job_id);
    return { id, job_id, company: j.company, role: j.title, job_url: j.apply_url, applied_at: now - applied * D, apply_mode: 'MANUAL', ...extra };
  };
  return {
    jobs,
    records: [
      rec(1, 'j0', 'pending', 1), rec(2, 'j1', 'recorded', 3, { method: 'company_site' }),
      rec(3, 'j2', 'verified', 44, { method: 'company_site' }), rec(4, 'j3', 'verified', 12, { method: 'draft' }),
      rec(5, 'j4', 'verified', 30, { method: 'email' }), rec(6, 'j5', 'verified', 70, { method: 'company_site' }),
      rec(7, 'j6', 'withdrawn', 9), rec(8, 'j7', 'verified', 25, { method: 'referral' }),
    ],
    applications: [
      app(30, 'j2', 41),
      app(31, 'j3', 9, { apply_mode: 'AUTO' }),
      app(32, 'j4', 27, { response_outcome: 'rejected', first_response_at: now - 20 * D, outcome_at: now - 20 * D }),
      app(33, 'j5', 66, { response_outcome: 'no_response', outcome_at: now - 10 * D }),
      app(34, 'j7', 21, { response_outcome: 'interview', furthest_stage: 'interview', first_response_at: now - 14 * D }),
    ],
    resumes: [['j1', 3], ['j2', 43], ['j3', 11], ['j4', 29], ['j5', 69], ['j7', 24]].map(([job_id, d]) => ({ job_id, created_at: now - d * D })),
    approvals: [{ job_id: 'j3', approved_at: now - 10 * D }],
  };
}
let DB = seed();

function fixtureFor(url, method, body) {
  if (url.pathname === '/api/auth/me') return [200, { authenticated: true, user: { id: 1, username: 'ada', planTier: 'PRO', applyMode: 'TAILORED' } }];
  if (url.pathname === '/api/domain-profiles') return [200, [{ id: 1, profile_name: 'Software Engineering', is_active: 1, target_titles: ['Software Engineer'] }]];
  if (url.pathname === '/api/extension/status') return [200, { connected: true }];
  if (url.pathname === '/api/applications' || url.pathname === '/api/resumes' || url.pathname === '/api/jobs/pending') return [200, []];
  if (url.pathname === '/api/jobs') return [200, { jobs: [], total: 0, totalPages: 0, nextCursor: null, attribution: [] }];
  if (url.pathname === '/api/applications/pending') return [200, { pending: [], verified: [], methods: [], verifyRule: null }];
  if (url.pathname === '/api/draft/slots') return [200, { limit: 10, used: 0, remaining: 10, drafts: 0, generations: 0, windowHours: 24 }];
  if (url.pathname === '/api/apply/runs') return [200, { runs: [], review: [], gated: [], inFlight: [], submitted: [], stopped: [], statusCounts: {} }];
  if (url.pathname === '/api/apply/pending') return [200, { pending: [], approvalCap: { remaining: 10, limit: 10 } }];
  if (url.pathname === '/api/applications/history') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const rows = buildHistory(DB, { now }).filter(r => !q || `${r.company} ${r.title}`.toLowerCase().includes(q));
    return [200, { rows, q }];
  }
  const m = /^\/api\/apply\/applications\/([^/]+)\/response$/.exec(url.pathname);
  if (m && method === 'PATCH') {
    const a = DB.applications.find(x => x.job_id === m[1]);
    Object.assign(a, mergeResponse(a, { outcome: JSON.parse(body || '{}').outcome }, { now }));
    return [200, { ok: true }];
  }
  const r = /^\/api\/applications\/(\d+)\/resume$/.exec(url.pathname);
  if (r) return r[1] === '6' ? [404, { error: 'artifact_missing' }] : [500, { error: 'artifact_corrupt' }];
  return [200, {}];
}

const click = (page, sel, text) => page.evaluate((s, t) => {
  const el = [...document.querySelectorAll(s)].find(x => x.textContent.replace(/\s+/g, ' ').includes(t));
  el?.click(); return !!el;
}, sel, text);

const SHOTS = [
  { id: 'history', themes: ['light', 'dark'] },
  { id: 'ask-open', act: async (p) => click(p, '.ah__nudge button', '') },
  { id: 'chip-sent', act: async (p) => click(p, '.ah__chip', 'Sent') },
  { id: 'replied-open', act: async (p) => click(p, '.ah__main', 'Wingtip') },
  { id: 'answered', act: async (p) => { await click(p, '.ah__nudge button', ''); await sleep(500); await click(p, '.ah__answers button', 'Interview'); } },
  { id: 'download-error', act: async (p) => { await click(p, '.ah__main', 'Tailspin'); await sleep(400); await click(p, '.ah__btn', 'Download résumé'); } },
  { id: 'in-play-open', act: async (p) => click(p, '.ah__main', 'Northwind') },
];
const WIDTHS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath,
      [path.join(ROOT, 'client', 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'],
      { cwd: path.join(ROOT, 'client'), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const onData = (b) => { out += b.toString(); if (new RegExp(String(PORT)).test(out)) resolve({ proc, url: `http://localhost:${PORT}` }); };
    proc.stdout.on('data', onData); proc.stderr.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => reject(new Error(`vite did not start:\n${out.slice(-600)}`)), 60000);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
  const vite = await startVite();
  console.log(`vite pid ${vite.proc.pid}`);
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check'], protocolTimeout: 45000 });
  try {
    for (const s of SHOTS) for (const theme of (s.themes || ['light'])) for (const { w, h } of WIDTHS) {
      DB = seed();
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const raw = req.url();
        if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: '' });
        const url = new URL(raw, vite.url);
        if (!url.pathname.startsWith('/api/')) return req.continue();
        const [status, body] = fixtureFor(url, req.method(), req.postData());
        req.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('draft-theme', t); } catch {} }, theme);
      await page.goto(`${vite.url}/app/database`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      await sleep(1500);
      if (s.act) { await s.act(page); await sleep(1200); }
      const info = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        chips: [...document.querySelectorAll('.ah__chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
        rows: document.querySelectorAll('.ah__row').length,
        notes: [...document.querySelectorAll('.ah__note')].map(n => n.textContent).join(' | '),
      }));
      const file = path.join(OUT_DIR, `${LABEL}-${s.id}-${w}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${info.sw > info.cw ? 'OVERFLOW' : 'ok      '} ${path.basename(file)} rows=${info.rows} chips: ${info.chips}` +
        (info.notes ? `\n          notes: ${info.notes}` : '') + (errors.length ? `\n          [page error] ${errors.join(' | ').slice(0, 300)}` : ''));
      await page.close();
    }
  } finally {
    await browser.close();
    vite.proc.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

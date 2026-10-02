#!/usr/bin/env node
/**
 * A59 — the line of waiting Drafts in Auto Apply, at 1440 and 390, light and dark, on STUBBED /api/*.
 * ============================================================================================
 * A copy of a53SurfaceShots.mjs with a `line` in the runs fixture (two waiting Drafts, the second a
 * multi-job manual run) and a second scene where the kill switch holds the line.
 *
 *   node scripts/a59LineShots.mjs after
 *
 * Drives the real client (vite on :5193) in a real browser. Every /api/ request is answered from
 * the synthetic fixtures below — no server, no database, nobody's data. Writes PNGs to
 * ../draft-screenshots/a59-line/<label>-<surface>-<width>-<theme>.png and prints,
 * per shot, whether the page scrolls horizontally (it must not at 390) and any page error.
 *
 * Excluded from verify:harness: screenshots, and it needs a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { LOGO_HOST } from '../shared/companyLogos.js';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const LABEL = process.argv[2] || 'shot';
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', 'a59-line');
const PORT = 5194;
// A53_CLIENT_DIR: shoot another checkout of the client (the 'before' tree), served by THIS tree's vite.
const CLIENT_DIR = process.env.A53_CLIENT_DIR ? path.resolve(process.env.A53_CLIENT_DIR) : path.join(ROOT, 'client');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const now = Math.floor(Date.now() / 1000);
const COMPANIES = ['Northwind', 'Fabrikam', 'Contoso', 'Tailspin', 'Litware', 'Adatum'];
const TITLES = ['Software Engineer, Payments', 'Backend Engineer', 'Full Stack Engineer',
  'Platform Engineer', 'Data Engineer', 'Software Engineer II'];
const POOL = COMPANIES.map((company, i) => ({
  jobId: `j${i}`, id: `j${i}`, company, title: TITLES[i],
  location: i % 2 ? 'Boston, MA' : 'Remote (US)', workType: i % 2 ? 'Hybrid' : 'Remote',
  url: `https://example.invalid/${i}`, applyUrl: `https://example.invalid/${i}`,
  source: 'greenhouse', sourcePlatform: 'greenhouse', automationTier: i === 2 ? 'account' : 'direct',
  postedAt: null, scrapedAt: now - i * 3600, discoveredAt: now - i * 3600, isActive: true,
  salaryMin: 120000 + i * 5000, salaryMax: 160000 + i * 5000, minYearsExp: 2, maxYearsExp: 5,
  description: 'You will build and run the services behind a payments product. Go, PostgreSQL, ' +
    'Kubernetes. You will work with product and design, own features end to end, and review code.\n\n' +
    'Requirements: 2+ years building backend services; SQL; a cloud platform.',
  skills: ['Go', 'PostgreSQL', 'Kubernetes', 'gRPC'],
  matchScore: [58, 47, 40, 31, 22, null][i],
  visited: false, starred: i === 1, disliked: false, alreadyApplied: false, companyIconUrl: null,
}));

const RUNJOB = (id, i, status, reasonCode) => ({
  id, runId: 1, jobId: `j${i}`, title: TITLES[i], company: COMPANIES[i],
  applyUrl: `https://example.invalid/${i}`, mode: 'auto', status, reasonCode, reasonDetail: null,
  atsScore: null, resumeAvailable: false, screenshotAvailable: false, missingRequired: [],
  fillLogAvailable: false, submitVerified: false, submitEvidence: null,
  startedAt: (now - 600) * 1000, finishedAt: status === 'running' ? null : (now - 300) * 1000,
  createdAt: (now - 700) * 1000,
});

const FIXTURES = {
  '/api/auth/me': { authenticated: true, user: { id: 1, username: 'ada', planTier: 'PRO', applyMode: 'TAILORED' } },
  '/api/domain-profiles': [{ id: 1, profile_name: 'Software Engineering', is_active: 1,
    target_titles: ['Software Engineer'], seniority: 'mid', work_type: null, location: null,
    generate_at_queue: 0 }],
  '/api/domain-profiles/1/base-resume': { name: 'resume.pdf', content: 'A. Lovelace — Software Engineer. 4 years. Go, SQL.' },
  '/api/domain-profiles/1/enhance-status': { enhanceUsed: false, enhancePaid: false },
  '/api/jobs': { jobs: POOL, total: POOL.length, totalPages: 1, nextCursor: null, attribution: [] },
  '/api/apply/runs': {
    runs: [{ id: 1, mode: 'auto', toolType: 'generate', approvalMode: 'required', status: 'completed',
             totalJobs: 3, submittedCount: 1, heldCount: 1, failedCount: 1,
             createdAt: (now - 700) * 1000, startedAt: (now - 600) * 1000, finishedAt: (now - 300) * 1000 }],
    review: [RUNJOB(11, 0, 'held_review', 'awaiting_approval')],
    gated: [], inFlight: [RUNJOB(12, 3, 'running', null)],
    submitted: [RUNJOB(13, 4, 'submitted', null)],
    stopped: [RUNJOB(14, 5, 'failed', 'no_submit_button')], statusCounts: {},
    line: {
      held: null,
      waiting: [
        { id: 21, mode: 'auto', toolType: 'generate', approvalMode: 'required', status: 'waiting', totalJobs: 1,
          position: 1, editable: { tool: true, order: true, remove: true }, usesProfile: 'Software Engineering',
          willDo: "Fills the employer's form from your profile and stops before sending, to wait for your review. The résumé and cover letter are made by Generate when you approve it.",
          jobs: [RUNJOB(31, 1, 'queued', null)] },
        { id: 22, mode: 'semi', toolType: 'a_plus_resume', approvalMode: 'auto', status: 'waiting', totalJobs: 2,
          position: 2, editable: { tool: true, order: true, remove: true }, usesProfile: 'Software Engineering',
          willDo: "Opens the employer's form in a browser for you to finish by hand, with a résumé made by A+ Resume.",
          jobs: [RUNJOB(32, 2, 'queued', null), RUNJOB(33, 0, 'queued', null)] },
      ],
    },
  },
  '/api/apply/pending': { pending: [], approvalCap: { remaining: 10, limit: 10 } },
  '/api/apply/gate-packets': { portals: [], packets: [], truncated: false, total: 0 },
  '/api/apply/questions': { questions: [] },
  '/api/apply/readiness': { available: true, reason: null },
  '/api/apply/history/latest': { date: null },
  '/api/integrations/status': { apply: { missing: [] } },
  '/api/applications': [
    { id: 1, jobId: 'j4', company: 'Litware', role: 'Data Engineer', applyMode: 'TAILORED',
      appliedAt: (now - 86400) * 1000, status: 'applied', source: 'greenhouse', location: 'Remote (US)' },
  ],
  '/api/resumes': [],
  '/api/jobs/pending': [],
  '/api/draft/today': {
    date: new Date().toLocaleDateString('en-CA'), profileId: 1, size: 3, dealtNow: false, thin: true, reason: 'thin',
    cards: POOL.slice(0, 3).map((j, i) => ({
      position: i, band: ['strong', 'strong', 'moderate'][i], decision: null,
      job: { id: j.jobId, company: j.company, title: j.title, location: j.location, workType: j.workType,
             salaryMin: j.salaryMin, salaryMax: j.salaryMax, description: j.description, url: j.url },
      why: { matched: ['Go', 'PostgreSQL', 'Kubernetes'], missing: ['gRPC'], matchedTotal: 3, missingTotal: 1 },
      report: null,
    })),
  },
};

let HELD = false;
function fixtureFor(url) {
  if (url.pathname === '/api/apply/runs' && HELD) {
    const runs = FIXTURES['/api/apply/runs'];
    return { ...runs, line: { ...runs.line, held: { reason: 'kill_switch',
      message: 'Automatic applications are paused by the operator, so the line is not moving. Nothing in it will start until they are resumed.' } } };
  }
  if (url.pathname.startsWith('/api/jobs') && url.searchParams.get('starred') === '1') {
    return { jobs: POOL.filter(j => j.starred), total: 1, totalPages: 1 };
  }
  if (url.pathname.startsWith('/api/company/')) {
    const name = decodeURIComponent(url.pathname.split('/')[3] || 'Northwind');
    if (url.pathname.endsWith('/consistency-check')) return { company: name, checks: [], ok: true };
    return { company: name, name, roles: [], kb: null, available: false };
  }
  return FIXTURES[url.pathname] ?? {};
}

const SURFACES = [
  { id: 'auto-apply-line', path: '/app/auto-apply' },
  { id: 'auto-apply-line-held', path: '/app/auto-apply', held: true },
];
const WIDTHS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];
const THEMES = ['light', 'dark'];

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath,
      [path.join(ROOT, 'client', 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'],
      { cwd: CLIENT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const browser = await puppeteer.launch({
    executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  let overflowCount = 0;
  try {
    for (const theme of THEMES) for (const { w, h } of WIDTHS) for (const s of SURFACES) {
      if (ONLY && !ONLY.has(s.id)) continue;
      HELD = !!s.held;
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme },
                                       { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const raw = req.url();
        if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: '' });
        const url = new URL(raw, vite.url);
        if (!url.pathname.startsWith('/api/')) return req.continue();
        req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureFor(url)) });
      });
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('draft-theme', t); } catch {} }, theme);
      await page.goto(`${vite.url}${s.path}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      await sleep(1500);
      if (s.clickTitle) {
        await page.evaluate((t) => {
          // The card opens on a click on its body (a click on the title LINK is the browser's).
          const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === t);
          const span = a?.parentElement?.querySelector('span[style*="font-size: 10px"]');
          (span || a?.parentElement)?.click();
        }, s.clickTitle);
        await sleep(1500);
      }
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      }));
      const file = path.join(OUT_DIR, `${LABEL}-${s.id}-${w}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: w >= 500 });
      const over = ov.sw > ov.cw;
      if (over && w < 500) overflowCount++;
      console.log(`${over ? 'OVERFLOW' : 'ok      '} ${path.basename(file)}  scrollWidth=${ov.sw} clientWidth=${ov.cw}` +
        (errors.length ? `  [page error] ${errors.join(' | ').slice(0, 200)}` : ''));
      await page.close();
    }
  } finally {
    await browser.close();
    vite.proc.kill();
  }
  console.log(`\n${overflowCount} shot(s) at 390 scroll horizontally. Out: ${OUT_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });

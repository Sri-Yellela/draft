#!/usr/bin/env node
/**
 * D10–D14 — the app's tabs (top bar, Full House, the Draft panel, The Table) on STUBBED /api/*.
 * ============================================================================================
 * A copy of a62SavedOutsideUsShots.mjs with every tab as a surface and the bar measured.
 *
 *   node scripts/d10d14Shots.mjs <label> [surface,surface] [outDirName]
 *
 * Drives the real client (vite on :5197) in a real browser. Every /api/ request is answered from
 * the synthetic fixtures below — no server, no database, nobody's data. Writes PNGs to
 * ../draft-screenshots/<outDirName>/<label>-<surface>-<width>-<theme>.png and prints, per shot,
 * whether the page scrolls horizontally, the top bar's / mark's / tab labels' measured heights, and
 * any page error.
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
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', process.argv[4] || 'd10-nav-renames');
const PORT = 5197;
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
  postedAt: null, scrapedAt: now - i * 3600, discoveredAt: now - i * 3600, isActive: i > 2 || i === 0,
  salaryMin: 120000 + i * 5000, salaryMax: 160000 + i * 5000, minYearsExp: 2, maxYearsExp: 5,
  description: 'You will build and run the services behind a payments product. Go, PostgreSQL, ' +
    'Kubernetes. You will work with product and design, own features end to end, and review code.\n\n' +
    'Requirements: 2+ years building backend services; SQL; a cloud platform.',
  skills: ['Go', 'PostgreSQL', 'Kubernetes', 'gRPC'],
  matchScore: [58, 47, 40, 31, 22, null][i], heldOutsideUs: i === 1,
  visited: false, starred: i < 3, disliked: false, alreadyApplied: false, companyIconUrl: null,
}));

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
    review: [],
    gated: [], inFlight: [],
    submitted: [],
    stopped: [], statusCounts: {},
  },
  '/api/apply/pending': { pending: [], approvalCap: { remaining: 10, limit: 10 } },
  '/api/apply/gate-packets': { portals: [], packets: [], truncated: false, total: 0 },
  '/api/apply/questions': { questions: [] },
  '/api/apply/readiness': { available: true, reason: null },
  '/api/apply/history/latest': { date: null },
  '/api/draft/slots': { limit: 10, used: 3, remaining: 7, drafts: 2, generations: 1, windowHours: 24 },
  '/api/applications/pending': {
    pending: [
      { jobId: 'j0', state: 'pending', origin: 'opened_posting', title: TITLES[0], company: COMPANIES[0],
        applyUrl: 'https://example.invalid/0', createdAt: (now - 3600) * 1000, updatedAt: (now - 3600) * 1000, checks: null },
      { jobId: 'j2', state: 'recorded', origin: 'generated', title: TITLES[2], company: COMPANIES[2],
        applyUrl: 'https://example.invalid/2', createdAt: (now - 7200) * 1000, updatedAt: (now - 600) * 1000,
        submittedAt: (now - 900) * 1000, method: 'company_site', methodLabel: "On the company's careers site",
        checks: [
          { key: 'stated', ok: true, detail: 'You said when and how you applied.' },
          { key: 'date', ok: true, detail: 'The date is after the posting appeared.' },
          { key: 'evidence', ok: false, detail: 'Add one piece of evidence: the confirmation URL, the confirmation email subject, or your reference number.' },
        ] },
    ],
    verified: [],
    methods: [
      { value: 'company_site', label: "On the company's careers site" },
      { value: 'ats_portal', label: "Through the employer's application portal" },
      { value: 'email', label: 'By email' }, { value: 'referral', label: 'Through a referral' },
      { value: 'recruiter', label: 'Through a recruiter' }, { value: 'other', label: 'Another way' },
    ],
    verifyRule: {
      proves: 'You said when and how you applied, and gave evidence that matches this employer.',
      doesNotProve: 'It does not prove the employer received it — only their reply does. A reference number is taken on trust.',
      evidence: ["a confirmation page URL on the employer's (or their application portal's) site",
                 "the confirmation email's subject or a line from it, naming the company", 'your application or reference number'],
    },
  },
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

function fixtureFor(url) {
  if (url.pathname.startsWith('/api/jobs') && url.searchParams.get('starred') === '1') {
    const jobs = POOL.filter(j => j.starred).map(j => (j.jobId === 'j1' ? { ...j, location: 'London, United Kingdom' } : j));
    return { jobs, total: jobs.length, totalPages: 1 };
  }
  if (url.pathname.startsWith('/api/company/')) {
    const name = decodeURIComponent(url.pathname.split('/')[3] || 'Northwind');
    if (url.pathname.endsWith('/consistency-check')) return { company: name, checks: [], ok: true };
    return { company: name, name, roles: [], kb: null, available: false };
  }
  return FIXTURES[url.pathname] ?? {};
}

const SURFACES = [
  { id: 'today', path: '/app/today' },
  { id: 'jobs', path: '/app/jobs' },
  { id: 'draft', path: '/app/auto-apply' },
  { id: 'table', path: '/app/database' },
  { id: 'job-profiles', path: '/app/job-profiles' },
];
const WIDTHS = (process.env.SHOT_WIDTHS || '1920,1440,1100,820,390').split(',').map(Number)
  .map(w => ({ w, h: w < 500 ? 844 : w < 1000 ? 1000 : 900 }));
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
      if (s.clickTab) {
        await page.evaluate((t) => {
          [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(t))?.click();
        }, s.clickTab);
        await sleep(1500);
      }
      if (s.clickTitle) {
        await page.evaluate((t) => {
          // The card opens on a click on its body (a click on the title LINK is the browser's).
          const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === t);
          const span = a?.parentElement?.querySelector('span[style*="font-size: 10px"]');
          (span || a?.parentElement)?.click();
        }, s.clickTitle);
        await sleep(1500);
      }
      if (s.openForm) {
        await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(x => /Add evidence|Record submission/.test(x.textContent));
          b?.click();
        });
        await sleep(600);
      }
      const ov = await page.evaluate(() => {
        const bar = document.querySelector('[data-app-chrome]');
        const mark = bar?.querySelector('[role="img"]');
        const tabs = [...(bar?.querySelectorAll('nav[aria-label="Main"] a') || [])];
        return {
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          bar: bar ? Math.round(bar.getBoundingClientRect().height) : null,
          mark: mark ? Math.round(mark.getBoundingClientRect().height) : null,
          tabs: tabs.map(a => `${a.textContent.replace(/\s+/g, ' ').trim()}:${Math.round(a.getBoundingClientRect().height)}`).join(' | '),
          path: location.pathname,
        };
      });
      const file = path.join(OUT_DIR, `${LABEL}-${s.id}-${w}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: w >= 500 });
      const over = ov.sw > ov.cw;
      if (over && w < 500) overflowCount++;
      console.log(`${over ? 'OVERFLOW' : 'ok      '} ${path.basename(file)}  scrollWidth=${ov.sw} clientWidth=${ov.cw}` +
        `  bar=${ov.bar} mark=${ov.mark} path=${ov.path}
          tabs: ${ov.tabs}` +
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

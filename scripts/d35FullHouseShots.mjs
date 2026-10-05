#!/usr/bin/env node
/**
 * D34 + D35 — THE FULL HOUSE HEADER, seen at every breakpoint in both themes, a panel open and closed,
 * beside the sketch it was built to (header.html).
 * ============================================================================================
 *   node scripts/d35FullHouseShots.mjs [label] [sketchPath]
 *
 * Drives the real client (vite on :5221) in a real browser, every /api/* answered from a fixture (a
 * signed-in SYNTHETIC user; synthetic postings; facets carrying the sketch's own figures so the two
 * can be compared like for like). Nobody's data, no model call, no server.
 *
 * Writes to ../draft-screenshots/d35-full-house-header/:
 *   built-<state>-<width>-<theme>.png    the app: closed · level (the LEVEL panel open, senior chosen)
 *                                        · more ("+ add") · sort (1440 and 390 only)
 *   sketch-<state>-<width>-<theme>.png   header.html itself, rendered from the given path (read only),
 *                                        closed and with its LEVEL panel open
 * and prints, per built shot, the measured type of the prose and of a token (family / size /
 * line-height — D34's regression), the vertical order of sentence / panel / bar / jobs, and overflow.
 *
 * Excluded from verify:harness: screenshots, and it needs a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { LOGO_HOST } from '../shared/companyLogos.js';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';
import { SENTENCE_CLAUSES, FIT_BANDS } from '../shared/filterSentence.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const LABEL = process.argv[2] || 'built';
const SKETCH = process.argv[3] || 'C:/Users/duggi/Downloads/header.html';
const ONLY_W = process.argv[4] ? new Set(process.argv[4].split(',').map(Number)) : null;
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', 'd35-full-house-header');
const PORT = 5221;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);

const POOL = [
  ['Northwind', 'Software Engineer, Enterprise AI', 'New York, NY', 179000, 224000],
  ['Fabrikam', 'Backend Engineer, Payments', 'Remote, US', 190000, 240000],
  ['Contoso', 'Product Engineer, Core', 'Remote, US', 170000, 215000],
  ['Tailspin', 'Senior Platform Engineer', 'Seattle, WA', 185000, 230000],
  ['Woodgrove', 'Staff Data Engineer', 'Boston, MA', 200000, 250000],
  ['Litware', 'Senior Frontend Engineer', 'San Francisco, CA', 175000, 220000],
].map(([company, title, location, salaryMin, salaryMax], i) => ({
  jobId: `j${i}`, id: `j${i}`, company, title, location, workType: /Remote/.test(location) ? 'Remote' : 'Onsite',
  url: `https://example.invalid/${i}`, applyUrl: `https://example.invalid/${i}`,
  source: 'greenhouse', sourcePlatform: 'greenhouse', automationTier: 'direct',
  postedAt: new Date((now - (i + 2) * 86400) * 1000).toISOString(), scrapedAt: now - i * 3600, discoveredAt: now - i * 3600,
  isActive: true, salaryMin, salaryMax, description: 'A synthetic posting.', skills: ['Go', 'SQL'],
  matchScore: [58, 41, 22, 63, 37, 49][i], tagFunction: 'engineering', tagLevel: 'senior', tagWorkplace: null,
  visited: false, starred: false, disliked: false, alreadyApplied: false, companyIconUrl: null,
}));

// The sketch's figures, as a FacetsResponse (the app reads every number from here).
const COUNTS = {
  domain: { engineering: 1841, data: 288, design: 121, product: 96, marketing: 41, sales: 38, operations: 77, finance: 22, people: 12, legal: 4 },
  level: { intern: 0, entry: 51, mid: 1285, senior: 674, lead: 616, executive: 12 },
  where: { remote: 142, hybrid: 204, onsite: 981 },
  posted: { '': 2626, '1d': 12, '2d': 31, '3d': 47, '1w': 88, '1m': 341 },
  fit: { strong: 69, moderate: 318, weak: 402 },
};
const PLACE_COUNTS = { 'metro:sf_bay_area': 422, 'metro:nyc': 381, 'metro:boston': 94, 'metro:seattle': 133, 'metro:los_angeles': 71, 'metro:chicago': 58 };
function facets() {
  const clauses = {};
  for (const c of SENTENCE_CLAUSES) {
    const opts = c.key === 'posted' ? c.dim.options : c.dim.options.filter(o => o.value !== '');
    clauses[c.key] = opts.map(o => {
      const n = c.key === 'location' ? (PLACE_COUNTS[o.value] ?? 0) : (COUNTS[c.key]?.[o.value] ?? 0);
      return { value: o.value, label: o.label, count: n, known: c.key === 'level' ? Math.max(0, n - 1) : n };
    });
  }
  return { total: 2626, known: 2600, unscored: 537, coverage: { level: 2623, where: 1247, employment: 202 },
           views: { all: 2626, saved: 14, pending: 9 }, clauses };
}
void FIT_BANDS;

function fixtureFor(url) {
  const p = url.pathname;
  if (p === '/api/auth/me') return { authenticated: true, user: { id: 1, username: 'ada', planTier: 'PRO', applyMode: 'TAILORED' } };
  if (p === '/api/domain-profiles') return [{ id: 1, profile_name: 'Software Engineering', is_active: 1, role_family: 'engineering',
    target_titles: ['Software Engineer'], seniority: 'senior', selected_tools: [], selected_verbs: [] }];
  if (p === '/api/domain-profiles/1/base-resume') return { name: 'resume.pdf', content: 'A. Lovelace — Software Engineer.' };
  if (p === '/api/jobs/facets') return facets();
  if (p === '/api/jobs') return { jobs: POOL, total: 2626, totalPages: 53, nextCursor: null, attribution: [] };
  if (p === '/api/draft/slots') return { limit: 10, used: 0, remaining: 10, drafts: 0, generations: 0, windowHours: 24 };
  if (p === '/api/applications' || p === '/api/resumes' || p === '/api/jobs/pending' || p === '/api/notifications') return [];
  if (p === '/api/applications/pending') return { pending: [] };
  if (p === '/api/extension/status') return { connected: true, state: 'connected' };
  if (p === '/api/jobs/suggest') return { suggestions: [] };
  return {};
}

const clickSel = (page, sel) => page.evaluate((q) => document.querySelector(q)?.click(), sel);
const STATES = [
  { id: 'closed', act: async () => {} },
  { id: 'level', act: async (p) => {
      await clickSel(p, '#fh-sentence [data-slot="level"]'); await sleep(600);
      await clickSel(p, '#fh-panel [data-value="senior"]'); await sleep(1200);
      const on = await p.evaluate(() => document.querySelector('#fh-panel [data-value="senior"]')?.getAttribute('aria-checked'));
      if (on !== 'true') console.log('  ⚠ senior is not checked after one press');
    } },
  { id: 'more', widths: [1440, 390], act: async (p) => { await clickSel(p, '#fh-sentence [data-slot="more"]'); await sleep(900); } },
  { id: 'sort', widths: [1440, 390], act: async (p) => { await clickSel(p, '[data-board-icon="sort"]'); await sleep(900); } },
];
const WIDTHS = [{ w: 1440, h: 900 }, { w: 1100, h: 860 }, { w: 820, h: 1000 }, { w: 390, h: 844 }];
const THEMES = ['light', 'dark'];

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

async function measure(page) {
  return page.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const sent = document.querySelector('#fh-sentence');
    const tok = document.querySelector('#fh-sentence .tok');
    const top = (q) => { const el = document.querySelector(q); return el ? Math.round(el.getBoundingClientRect().top) : null; };
    const s = cs(sent), t = cs(tok);
    return {
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      prose: s ? `${s.fontFamily.split(',')[0]} ${s.fontSize}/${s.lineHeight}` : '-',
      token: t ? `${t.fontFamily.split(',')[0]} ${t.fontSize}/${t.lineHeight}` : '-',
      same: !!(s && t && s.fontFamily === t.fontFamily && s.fontSize === t.fontSize && s.lineHeight === t.lineHeight),
      order: { sentence: top('#fh-sentence'), panel: top('#fh-panel'), bar: top('[data-board-bar]'), sort: top('#fh-sort'), jobs: top('[data-job-bubble]') },
      bar: [...document.querySelectorAll('[data-board-bar] > *')].map(e => `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`).join(' '),
    };
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
  const vite = await startVite();
  console.log(`vite pid ${vite.proc.pid}`);
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check'], protocolTimeout: 60000 });
  try {
    for (const theme of THEMES) for (const { w, h } of WIDTHS) {
      if (ONLY_W && !ONLY_W.has(w)) continue;
      // ── the build
      for (const st of STATES) {
        if (st.widths && !st.widths.includes(w)) continue;
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const raw = req.url();
          if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: '' });
          const url = new URL(raw, vite.url);
          if (!url.pathname.startsWith('/api/')) return req.continue();
          req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureFor(url)) });
        });
        await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('draft-theme', t); localStorage.setItem('draft:extension-prompt-dismissed', '1');
          // Every shot starts from the DEFAULT board: the per-profile view cache would otherwise carry the
          // previous shot's choices into this one (the browser profile is shared across pages).
          localStorage.removeItem('rm_jobs_profile_ui_v1'); sessionStorage.clear(); } catch {} }, theme);
        await page.goto(`${vite.url}/app/jobs`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
        await sleep(1800);
        await st.act(page);
        const m = await measure(page);
        const file = path.join(OUT_DIR, `${LABEL}-${st.id}-${w}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(`${m.sw > m.cw ? 'OVERFLOW' : 'ok      '} ${path.basename(file)} prose="${m.prose}" token="${m.token}" same=${m.same} ` +
          `order=${JSON.stringify(m.order)} bar=[${m.bar}]` + (errors.length ? `\n          [page error] ${errors.join(' | ').slice(0, 300)}` : ''));
        await page.close();
      }
      // ── the sketch, at the same width and theme
      if (fs.existsSync(SKETCH)) {
        for (const st of ['closed', 'level']) {
          const page = await browser.newPage();
          await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
          await page.goto(pathToFileURL(SKETCH).href, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
          await page.evaluate((t) => { const b = [...document.querySelectorAll('.seg button')].find(x => x.textContent.trim() === t.toUpperCase()); b?.click(); }, theme);
          if (st === 'level') await page.evaluate(() => document.querySelector('.tok[data-f="level"]')?.click());
          await sleep(700);
          const file = path.join(OUT_DIR, `sketch-${st}-${w}-${theme}.png`);
          await page.screenshot({ path: file, fullPage: false });
          console.log(`sketch   ${path.basename(file)}`);
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
    vite.proc.kill();
  }
}

main().catch(e => { console.error(e); process.exit(1); });

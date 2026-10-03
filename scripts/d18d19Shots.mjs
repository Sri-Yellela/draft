#!/usr/bin/env node
/**
 * D18 + D19 — the top bar (Draft House, no tab symbol, Job Profiles in Settings) and the mark in light
 * and dark, on every surface that renders StampLogo, on STUBBED /api/*.
 * ============================================================================================
 *   node scripts/d18d19Shots.mjs [label]          shots + a close-up of each mark
 *   node scripts/d18d19Shots.mjs --diff A B       compare the mark close-ups of two labels, per theme
 *
 * Drives the real client (vite on :3051) in a real browser. Every /api/* is a fixture (a signed-in
 * synthetic user, empty lists). Writes PNGs to ../draft-screenshots/d18-d19/. Nobody's data.
 * `--diff` exists for D19's "dark mode unchanged": shoot the tree before and after, then diff the
 * dark close-ups pixel by pixel (in the browser's canvas, so no image library is needed).
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
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', 'd18-d19');
const PORT = 3051;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function fixtureFor(url) {
  const p = url.pathname;
  if (p === '/api/auth/me') {
    return url.searchParams.has('anon') ? [401, { authenticated: false }]
      : [200, { authenticated: true, user: { id: 1, username: 'ada', planTier: 'PRO', applyMode: 'TAILORED' } }];
  }
  if (p === '/api/domain-profiles') return [200, [{ id: 1, profile_name: 'Software Engineering', is_active: 1, target_titles: ['Software Engineer'] }]];
  if (p === '/api/extension/status') return [200, { connected: true }];
  if (p === '/api/applications' || p === '/api/resumes' || p === '/api/jobs/pending') return [200, []];
  if (p === '/api/jobs') return [200, { jobs: [], total: 0, totalPages: 0, nextCursor: null, attribution: [] }];
  if (p === '/api/applications/pending') return [200, { pending: [], verified: [], methods: [], verifyRule: null }];
  if (p === '/api/applications/history') return [200, { rows: [], q: '' }];
  if (p === '/api/draft/slots') return [200, { limit: 10, used: 0, remaining: 10, drafts: 0, generations: 0, windowHours: 24 }];
  if (p === '/api/apply/runs') return [200, { runs: [], review: [], gated: [], inFlight: [], submitted: [], stopped: [], statusCounts: {} }];
  if (p === '/api/apply/pending') return [200, { pending: [{ id: 1 }, { id: 2 }], approvalCap: { remaining: 10, limit: 10 } }];
  if (p === '/api/notifications') return [200, []];
  return [200, {}];
}

// Surfaces that render the mark. `anon` = signed out (the marketing and auth pages).
const SURFACES = [
  { id: 'app-draft-house', path: '/app/auto-apply' },
  { id: 'app-menu-settings', path: '/app/auto-apply', act: async (p) => {
      await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /avatar|account menu|profile menu/i.test(x.getAttribute('aria-label') || '')); b?.click(); });
    } },
  { id: 'landing', path: '/', anon: true },
  { id: 'extension', path: '/extension', anon: true },
  { id: 'login', path: '/login', anon: true },
  { id: 'admin-login', path: '/admin/login', anon: true },
];
const WIDTHS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];
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

async function shoot(label) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
  const vite = await startVite();
  console.log(`vite pid ${vite.proc.pid}`);
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check'], protocolTimeout: 45000 });
  try {
    for (const s of SURFACES) for (const theme of THEMES) for (const { w, h } of WIDTHS) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const raw = req.url();
        if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: '' });
        const url = new URL(raw, vite.url);
        if (!url.pathname.startsWith('/api/')) return req.continue();
        if (s.anon) url.searchParams.set('anon', '1');
        const [status, body] = fixtureFor(url);
        req.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('draft-theme', t); } catch {} }, theme);
      await page.goto(`${vite.url}${s.path}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      await sleep(1500);
      if (s.act) { await s.act(page); await sleep(900); }
      const info = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Main"]');
        const tabs = nav ? [...nav.querySelectorAll('a')].map(a => {
          const r = a.getBoundingClientRect();
          return { text: a.textContent.replace(/\s+/g, ' ').trim(), right: Math.round(r.right), symbols: a.querySelectorAll('[data-draft-mark],svg,img').length };
        }) : [];
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
                 marks: document.querySelectorAll('[role="img"][aria-label]').length, tabs, vw: innerWidth };
      });
      const base = `${label}-${s.id}-${w}-${theme}`;
      await page.screenshot({ path: path.join(OUT_DIR, `${base}.png`), fullPage: s.id === 'landing' });
      // The close-up: the first mark on the page (the bar's, the nav's), for the dark-mode pixel diff.
      const mark = await page.$('[role="img"][aria-label]');
      if (mark) await mark.screenshot({ path: path.join(OUT_DIR, `${base}-mark.png`) });
      const clipped = info.tabs.filter(t => t.right > info.vw).map(t => t.text);
      console.log(`${info.sw > info.cw ? 'OVERFLOW' : 'ok      '} ${base} marks=${info.marks}` +
        (info.tabs.length ? ` tabs: ${info.tabs.map(t => `${t.text}${t.symbols ? ' [SYMBOL]' : ''}`).join(' | ')}` : '') +
        (clipped.length ? `\n          past the viewport edge: ${clipped.join(', ')}` : '') +
        (errors.length ? `\n          [page error] ${errors.join(' | ').slice(0, 300)}` : ''));
      await page.close();
    }
  } finally {
    await browser.close();
    vite.proc.kill();
  }
}

async function diff(a, b) {
  const resolution = await resolveBrowserExecutable();
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: 'new', pipe: true });
  const page = await browser.newPage();
  await page.goto('about:blank');
  try {
    for (const theme of THEMES) for (const s of SURFACES) for (const { w } of WIDTHS) {
      const fa = path.join(OUT_DIR, `${a}-${s.id}-${w}-${theme}-mark.png`), fb = path.join(OUT_DIR, `${b}-${s.id}-${w}-${theme}-mark.png`);
      if (!fs.existsSync(fa) || !fs.existsSync(fb)) { console.log(`missing  ${s.id} ${w} ${theme}`); continue; }
      const r = await page.evaluate(async (da, db) => {
        const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const [ia, ib] = await Promise.all([load(da), load(db)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
        const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const pa = px(ia), pb = px(ib); let diff = 0, max = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
          if (d) { diff++; max = Math.max(max, d); }
        }
        return { total: pa.length / 4, diff, max };
      }, `data:image/png;base64,${fs.readFileSync(fa).toString('base64')}`, `data:image/png;base64,${fs.readFileSync(fb).toString('base64')}`);
      console.log(`${theme.padEnd(5)} ${s.id.padEnd(18)} ${String(w).padEnd(4)} ` +
        (r.size ? `SIZE ${r.size}` : `${r.diff} / ${r.total} px differ (${(100 * r.diff / r.total).toFixed(2)}%), max channel delta ${r.max}`));
    }
  } finally { await browser.close(); }
}

const args = process.argv.slice(2);
(args[0] === '--diff' ? diff(args[1], args[2]) : shoot(args[0] || 'd19'))
  .catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * D31 — THE SIMPLE ATS CARD, seen on every surface it renders on, in light and dark, at 1440 and 390.
 * ============================================================================================
 *   node scripts/d31AtsCardShots.mjs [label] [surface,surface]
 *
 * Drives the real client (vite on :5191) in a real browser, every /api/* answered from a fixture
 * (a signed-in SYNTHETIC user; synthetic postings and reports). Nobody's data, no model call.
 * Writes PNGs to ../draft-screenshots/d31-simple-ats-card/<label>-<surface>-<width>-<theme>.png.
 *
 * Surfaces — one component (components/AtsReport.jsx), four places:
 *   deck            the Daily Deck's report: the left panel at 1440, the phone's sheet at 390 (Strong, 9 of 12)
 *   deck-claimed    the same, one term claimed and both folds opened
 *   deck-declined   the scorer declining — "Not enough signal", never a short Weak bar
 *   board           the board's ATS side panel (Weak, a hard requirement missing)
 *   tool            the free public tool /tools/ats (Moderate, read-only chips, no claim copy)
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
const LABEL = process.argv[2] || 'd31';
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', 'd31-simple-ats-card');
const PORT = 5191;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);

const DESCRIPTION = 'You will build and run the services behind a payments product. Go, PostgreSQL, Kubernetes, gRPC. ' +
  'You will own features end to end, design APIs, review code and work with product and design.\n\n' +
  'Requirements: 2+ years building backend services; SQL; a cloud platform (AWS); Docker. Terraform and Kafka a plus.';

const POOL = [
  ['Northwind', 'Software Engineer, Payments', 'strong'],
  ['Fabrikam', 'Data Engineer', 'weak'],
  ['Contoso', 'Backend Engineer', 'moderate'],
].map(([company, title], i) => ({
  jobId: `j${i}`, id: `j${i}`, company, title, location: 'Remote (US)', workType: 'Remote',
  url: `https://example.invalid/${i}`, applyUrl: `https://example.invalid/${i}`,
  source: 'greenhouse', sourcePlatform: 'greenhouse', automationTier: 'direct',
  postedAt: null, scrapedAt: now - i * 3600, discoveredAt: now - i * 3600, isActive: true,
  salaryMin: 130000, salaryMax: 170000, minYearsExp: 2, maxYearsExp: 5, description: DESCRIPTION,
  skills: ['Go', 'PostgreSQL', 'Kubernetes'], matchScore: [58, 22, 38][i],
  visited: false, starred: false, disliked: false, alreadyApplied: false, companyIconUrl: null,
}));

// The deck's frozen report (services/dailyDraft.js deckReport): 9 of 12 — 6 skills + 2 competencies + 1 verb on
// the résumé; Terraform, Kafka and "Owned" to claim; three generic verbs that are not a gap.
const DECK_STRONG = {
  scorable: true, declineReasons: [],
  skillsMatched: ['Go', 'PostgreSQL', 'Kubernetes', 'gRPC', 'Docker', 'AWS'], skillsMissing: ['Terraform', 'Kafka'],
  competenciesMatched: ['API design', 'Code review'], competenciesMissing: [],
  verbsMatched: ['Built'], verbsMissing: ['Owned'], verbsGeneric: ['Managed', 'Collaborated', 'Worked'],
  claimedMatches: [], experience: '4 years of backend work against the 2+ this posting asks for.', experienceFit: true,
  hardConstraintMisses: [], seniorityNote: null, depthHeadline: null, depthDetail: null,
};
const DECK_DECLINED = {
  scorable: false, declineReasons: ['The posting is too short to judge — 41 words, and no requirements section.'],
  skillsMatched: ['Go'], skillsMissing: ['Rust'], competenciesMatched: [], competenciesMissing: [],
  verbsMatched: [], verbsMissing: [], verbsGeneric: [], claimedMatches: [], experience: null, experienceFit: null,
  hardConstraintMisses: [], seniorityNote: null, depthHeadline: null, depthDetail: null,
};
// The board's report — the scorer's own shape (packages/ats-scorer). Weak: 3 of 9, a clearance required.
const BOARD_WEAK = {
  source: 'local_ats_v6', score: 22,
  tier1_matched: ['SQL', 'Python'], tier1_missing: ['Spark', 'Airflow', 'dbt', 'Snowflake'],
  competencies_matched: ['Data modeling'], competencies_missing: ['Stakeholder management'],
  action_verbs_matched: [], action_verbs_missing: ['Designed'], action_verbs_generic: ['Supported', 'Managed'],
  decline_reasons: [], hard_constraint_misses: ['Security clearance'],
  experience: { summary: '2 years against the 5+ this posting asks for.', fit: false },
  seniority_cap: { applied: false }, resume_depth: null,
};
// The public route's result (services/standaloneAts.js): Moderate, 6 of 10.
const TOOL_MODERATE = {
  source: 'local_ats_public', band: 'moderate',
  matched_skills: ['Go', 'PostgreSQL', 'Docker', 'AWS'], missing_skills: ['Kubernetes', 'gRPC', 'Terraform'],
  competencies_matched: ['API design'], competencies_missing: [],
  matched_verbs: ['Built'], missing_verbs: ['Owned'], generic_verbs: ['Managed', 'Worked'],
  decline_reasons: [], experience: '3 years against the 2+ this posting asks for.', seniority: null, resume_depth: null,
};

function deckToday(report, band) {
  return {
    date: new Date().toLocaleDateString('en-CA'), profileId: 1, size: 3, dealtNow: false, thin: false, reason: null,
    cards: POOL.map((j, i) => ({
      position: i, band: i === 0 ? band : ['strong', 'weak', 'moderate'][i], decision: null,
      job: { id: j.jobId, company: j.company, title: j.title, location: j.location, workType: j.workType,
             salaryMin: j.salaryMin, salaryMax: j.salaryMax, description: j.description, url: j.url },
      why: { matched: ['Go', 'PostgreSQL', 'Kubernetes'], missing: ['Terraform'], matchedTotal: 9, missingTotal: 3 },
      report: i === 0 ? report : DECK_STRONG,
    })),
  };
}

function fixtureFor(url, s) {
  const p = url.pathname;
  if (p === '/api/auth/me') return { authenticated: true, user: { id: 1, username: 'ada', planTier: 'PRO', applyMode: 'TAILORED' } };
  if (p === '/api/domain-profiles') return [{ id: 1, profile_name: 'Software Engineering', is_active: 1,
    target_titles: ['Software Engineer'], seniority: 'mid', selected_tools: [], selected_verbs: [] }];
  if (p === '/api/domain-profiles/1/base-resume') return { name: 'resume.pdf', content: 'A. Lovelace — Software Engineer. 4 years. Go, SQL, Python.' };
  if (p === '/api/domain-profiles/1/suggestions') return {};
  if (p === '/api/domain-profiles/1/claims') return {};
  if (p === '/api/domain-profiles/1/enhance-status') return { enhanceUsed: false, enhancePaid: false };
  if (/^\/api\/jobs\/[^/]+\/keywords$/.test(p)) return BOARD_WEAK;
  if (p === '/api/jobs') return { jobs: POOL, total: POOL.length, totalPages: 1, nextCursor: null, attribution: [] };
  if (p === '/api/draft/today') return s.id === 'deck-declined' ? deckToday(DECK_DECLINED, 'not_enough_signal') : deckToday(DECK_STRONG, 'strong');
  if (p === '/api/standalone/ats') return TOOL_MODERATE;
  if (p === '/api/draft/slots') return { limit: 10, used: 0, remaining: 10, drafts: 0, generations: 0, windowHours: 24 };
  if (p === '/api/applications' || p === '/api/resumes' || p === '/api/jobs/pending' || p === '/api/notifications') return [];
  if (p === '/api/extension/status') return { connected: true };
  return {};
}

async function openDeckReport(page, w) {
  await page.click('[data-deck-signal]').catch(() => {});
  await sleep(1800);
  if (w < 500) await page.waitForSelector('[data-deck-sheet] [data-ats-report]', { timeout: 8000 }).catch(() => {});
}
async function openFoldsAndClaim(page) {
  await page.evaluate(() => {
    const root = document.querySelector('[data-deck-sheet] [data-ats-report]') || document.querySelector('#deck-ats [data-ats-report]')
      || document.querySelector('[data-ats-report]');
    root?.querySelector('[data-claim-chip="skill"]')?.click();
    for (const d of root?.querySelectorAll('details[data-ats-on-resume], details[data-ats-generic]') || []) d.open = true;
  });
  await sleep(700);
}

const SURFACES = [
  { id: 'deck', path: '/app/today', act: (p, w) => openDeckReport(p, w) },
  { id: 'deck-claimed', path: '/app/today', act: async (p, w) => { await openDeckReport(p, w); await openFoldsAndClaim(p); } },
  { id: 'deck-declined', path: '/app/today', act: (p, w) => openDeckReport(p, w) },
  { id: 'board', path: '/app/jobs', act: async (p) => {
      // The rail's squares show on hover; a DOM click reaches the ATS square either way.
      await p.hover('[data-job-bubble="j1"]').catch(() => {});
      await sleep(400);
      await p.evaluate(() => document.querySelector('[data-job-bubble="j1"] .jb__sq--ats')?.click());
      await sleep(2500);
    } },
  { id: 'tool', path: '/tools/ats', act: async (p, w, pdf) => {
      const input = await p.$('input[type="file"]');
      await input?.uploadFile(pdf);
      await p.type('textarea', DESCRIPTION.slice(0, 120));
      await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Check my match/.test(b.textContent))?.click());
      await sleep(1500);
      await p.evaluate(() => document.querySelector('[data-ats-result]')?.scrollIntoView({ block: 'start' }));
      await sleep(500);
    } },
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pdf = path.join(OUT_DIR, '.synthetic-resume.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n% synthetic\n%%EOF\n');
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
  const vite = await startVite();
  console.log(`vite pid ${vite.proc.pid}`);
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check'], protocolTimeout: 60000 });
  try {
    for (const theme of THEMES) for (const { w, h } of WIDTHS) for (const s of SURFACES) {
      if (ONLY && !ONLY.has(s.id)) continue;
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
        req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureFor(url, s)) });
      });
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('draft-theme', t); } catch {} }, theme);
      await page.goto(`${vite.url}${s.path}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      await sleep(1500);
      await s.act(page, w, pdf);
      const info = await page.evaluate(() => {
        const r = [...document.querySelectorAll('[data-ats-report]')].pop();
        const box = r?.getBoundingClientRect();
        return {
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          report: !!r, width: box ? Math.round(box.width) : 0,
          band: r?.querySelector('[data-ats-band]')?.textContent || '',
          count: r?.querySelector('[data-ats-count]')?.textContent || '',
          open: r ? r.querySelectorAll('section').length : 0,
          folds: r ? [...r.querySelectorAll('details > summary')].map(x => x.textContent).join(' | ') : '',
          claimChips: r ? r.querySelectorAll('[data-claim-chip]').length : 0,
          pressed: r ? r.querySelectorAll('[data-claim-chip][aria-pressed="true"]').length : 0,
          note: r ? r.querySelectorAll('[data-claim-note]').length : 0,
          score: r ? r.querySelectorAll('[data-ats-score]').length : 0,
          dashedBar: r?.querySelector('[data-ats-bar]')?.getAttribute('data-unknown') || '',
        };
      });
      const file = path.join(OUT_DIR, `${LABEL}-${s.id}-${w}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: false });
      // The card on its own, at full height — the whole report, whatever the surface crops.
      const el = await page.$$('[data-ats-report]');
      if (el.length) await el[el.length - 1].screenshot({ path: file.replace(/\.png$/, '-card.png') }).catch(() => {});
      console.log(`${info.sw > info.cw ? 'OVERFLOW' : 'ok      '} ${path.basename(file)} report=${info.report} w=${info.width} ` +
        `band="${info.band}" count="${info.count}" open=${info.open} folds="${info.folds}" claim=${info.claimChips} ` +
        `pressed=${info.pressed} note=${info.note} score=${info.score} unknownBar=${info.dashedBar}` +
        (errors.length ? `\n          [page error] ${errors.join(' | ').slice(0, 300)}` : ''));
      await page.close();
    }
  } finally {
    await browser.close();
    vite.proc.kill();
    fs.rmSync(pdf, { force: true });
  }
}

main().catch(e => { console.error(e); process.exit(1); });

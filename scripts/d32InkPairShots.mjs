#!/usr/bin/env node
/**
 * D32 — THE INK PAIR (the posting and the score), seen on every surface it renders on, light and dark, 1440 and 390.
 * ============================================================================================
 *   node scripts/d32InkPairShots.mjs [label] [surface,surface]
 *   SHOTS_DIR=<folder name under draft-screenshots> SHOTS_PORT=<vite port>   (A86: d32-ink-pair / 5201 by default)
 *
 * Drives the real client (vite on :5201) in a real browser, every /api/* answered from a fixture
 * (a signed-in SYNTHETIC user; synthetic postings and reports). Nobody's data, no model call.
 * Writes PNGs to ../draft-screenshots/d32-ink-pair/<label>-<surface>-<width>-<theme>.png.
 *
 * Surfaces:
 *   deck          the deck's card OPENED: the posting (masthead + the employer's text) and, at 1440, the sticky
 *                 report beside it; at 390, the score collapsed above the posting
 *   deck-scrolled the same, scrolled down the posting — the report stays (1440), the strip is two-by-two (390)
 *   deck-hover    1440: a "You could claim" box pointed at, its term lit in the posting (the hover link)
 *   deck-sheet    390: the full report as the phone's sheet, folds open
 *   deck-thin     a posting with thin tags and no salary — the "not stated" fallback
 *   deck-declined the scorer declining — "Not enough signal", a dashed hue-less bar
 *   board         the board's job detail (the posting panel) via ?job=
 *   board-ats     the board's ATS side panel (Weak, a hard requirement missing)
 *   tool          the free public tool /tools/ats (Moderate, read-only boxes, no claim copy)
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
const LABEL = process.argv[2] || 'd32';
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', process.env.SHOTS_DIR || 'd32-ink-pair');
const PORT = Number(process.env.SHOTS_PORT) || 5201;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);

const DESCRIPTION = [
  'About Northwind', '',
  'Northwind builds the payment rails behind thousands of small businesses. We are a team of forty engineers, and we ship every day.', '',
  "What you'll do", '',
  '• Build and run the Go services behind our payments product, with PostgreSQL and Kubernetes', '',
  '• Design gRPC APIs, review code, and own features end to end with product and design', '',
  '• Keep the platform reliable: on-call one week in six, with Terraform for everything we deploy', '',
  'Requirements:', '',
  '• 4+ years building backend services in production', '',
  '• SQL, and a cloud platform (we run on AWS); Docker', '',
  '• Terraform and Kafka are a plus', '',
  'Benefits', '',
  '• Health, dental and vision from day one', '', '• Equity, and a learning budget', '',
  'Northwind is an equal opportunity employer. If this sounds like you, apply — we read every application.',
].join('\n');
const THIN_DESCRIPTION = 'We are hiring a data engineer to build pipelines in Python and SQL. You will work with the analytics team ' +
  'on dbt models and Airflow jobs.\n\nYou have experience with Spark, and you like clean data.';

const POOL = [
  ['Northwind', 'Senior Software Engineer, Payments', { tagFunction: 'engineering', tagLevel: 'senior', tagWorkplace: 'remote' }, DESCRIPTION],
  ['Fabrikam', 'Data Engineer', { tagFunction: 'data', tagLevel: null, tagWorkplace: null }, THIN_DESCRIPTION],
  ['Contoso', 'Backend Engineer', { tagFunction: 'engineering', tagLevel: 'mid', tagWorkplace: 'hybrid' }, DESCRIPTION],
].map(([company, title, tags, description], i) => ({
  jobId: `j${i}`, id: `j${i}`, company, title, location: i === 1 ? '' : 'Remote (US)', workType: 'Remote',
  url: `https://example.invalid/${i}`, applyUrl: `https://example.invalid/${i}`,
  source: 'greenhouse', sourcePlatform: 'greenhouse', automationTier: 'direct',
  postedAt: new Date((now - (i + 2) * 86400) * 1000).toISOString(), scrapedAt: now - i * 3600, discoveredAt: now - i * 3600, isActive: true,
  salaryMin: i === 1 ? null : 130000, salaryMax: i === 1 ? null : 170000, description,
  skills: ['Go', 'PostgreSQL', 'Kubernetes'], matchScore: [58, 22, 38][i], ...tags,
  visited: false, starred: false, disliked: false, alreadyApplied: false, companyIconUrl: null,
}));

// The deck's frozen report: 9 of 12 — 6 skills + 2 qualities + 1 verb on the résumé; Terraform, Kafka (skills),
// "Owned" (a verb) and "ownership" (a quality) to claim; three generic verbs that are not a gap.
const DECK_STRONG = {
  scorable: true, declineReasons: [],
  skillsMatched: ['Go', 'PostgreSQL', 'Kubernetes', 'gRPC', 'Docker', 'AWS'], skillsMissing: ['Terraform', 'Kafka'],
  competenciesMatched: ['API design', 'Code review'], competenciesMissing: ['Ownership'],
  verbsMatched: ['Built'], verbsMissing: ['Owned'], verbsGeneric: ['Managed', 'Collaborated', 'Worked'],
  claimedMatches: [], experience: 'Résumé experience (6 years) meets 4+ year requirement.', experienceFit: true, experienceState: 'met',
  hardConstraintMisses: [], seniorityNote: null, depthHeadline: null, depthDetail: null,
};
const DECK_THIN = {
  scorable: true, declineReasons: [],
  skillsMatched: ['Python', 'SQL'], skillsMissing: ['Spark', 'Airflow', 'dbt'], competenciesMatched: [], competenciesMissing: [],
  verbsMatched: [], verbsMissing: [], verbsGeneric: [], claimedMatches: [],
  experience: 'No explicit years-of-experience requirement detected.', experienceFit: true, experienceState: 'none',
  hardConstraintMisses: [], seniorityNote: null, depthHeadline: null, depthDetail: null,
};
const DECK_DECLINED = {
  scorable: false, declineReasons: ['The posting is too short to judge — 41 words, and no requirements section.'],
  skillsMatched: ['Go'], skillsMissing: ['Rust'], competenciesMatched: [], competenciesMissing: [],
  verbsMatched: [], verbsMissing: [], verbsGeneric: [], claimedMatches: [], experience: null, experienceFit: null, experienceState: null,
  hardConstraintMisses: [], seniorityNote: null, depthHeadline: null, depthDetail: null,
};
// The board's report — the scorer's own shape (packages/ats-scorer). Weak: 3 of 9, a clearance required.
const BOARD_WEAK = {
  source: 'local_ats_v6', score: 22,
  tier1_matched: ['SQL', 'Python'], tier1_missing: ['Spark', 'Airflow', 'dbt', 'Snowflake'],
  competencies_matched: ['Data modeling'], competencies_missing: ['Stakeholder management'],
  action_verbs_matched: [], action_verbs_missing: ['Designed'], action_verbs_generic: ['Supported', 'Managed'],
  decline_reasons: [], hard_constraint_misses: ['Security clearance'],
  experience: { requiredYears: 5, candidateYears: 2, fit: false, summary: 'Job asks for 5+ years; profile has 2 years.' },
  seniority_cap: { applied: false }, resume_depth: null,
};
// The public route's result (services/standaloneAts.js): Moderate, 6 of 10.
const TOOL_MODERATE = {
  source: 'local_ats_public', band: 'moderate',
  matched_skills: ['Go', 'PostgreSQL', 'Docker', 'AWS'], missing_skills: ['Kubernetes', 'gRPC', 'Terraform'],
  competencies_matched: ['API design'], competencies_missing: [],
  matched_verbs: ['Built'], missing_verbs: ['Owned'], generic_verbs: ['Managed', 'Worked'],
  decline_reasons: [], experience: 'Résumé experience (3 years) meets 2+ year requirement.', experience_state: 'met',
  seniority: null, resume_depth: null,
};

function deckToday(front, band, frontIndex = 0) {
  const order = [frontIndex, ...[0, 1, 2].filter(i => i !== frontIndex)];
  return {
    date: new Date().toLocaleDateString('en-CA'), profileId: 1, size: 3, dealtNow: false, thin: false, reason: null,
    cards: order.map((pi, i) => {
      const j = POOL[pi];
      return {
        position: i, band: i === 0 ? band : 'moderate', decision: null,
        job: { id: j.jobId, company: j.company, title: j.title, location: j.location, workType: j.workType, postedAt: j.postedAt,
               salaryMin: j.salaryMin, salaryMax: j.salaryMax, description: j.description, url: j.url,
               tagFunction: j.tagFunction, tagLevel: j.tagLevel, tagWorkplace: j.tagWorkplace },
        why: { matched: ['Go', 'PostgreSQL', 'Kubernetes'], missing: ['Terraform'], matchedTotal: 9, missingTotal: 3 },
        report: i === 0 ? front : DECK_STRONG,
      };
    }),
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
  if (/^\/api\/jobs\/by-id\//.test(p)) return { success: true, job: POOL.find(j => p.endsWith(`/${j.id}`)) || POOL[0] };
  if (p === '/api/jobs') return { jobs: POOL, total: POOL.length, totalPages: 1, nextCursor: null, attribution: [] };
  if (p === '/api/draft/today') {
    if (s.id === 'deck-declined') return deckToday(DECK_DECLINED, 'not_enough_signal');
    if (s.id === 'deck-thin') return deckToday(DECK_THIN, 'moderate', 1);
    return deckToday(DECK_STRONG, 'strong');
  }
  if (p === '/api/standalone/ats') return TOOL_MODERATE;
  if (p === '/api/draft/slots') return { limit: 10, used: 0, remaining: 10, drafts: 0, generations: 0, windowHours: 24 };
  if (p === '/api/applications' || p === '/api/resumes' || p === '/api/jobs/pending' || p === '/api/notifications') return [];
  if (p === '/api/applications/pending') return { pending: [] };
  if (p === '/api/extension/status') return { connected: true };
  return {};
}

// Open the front card. Wide: the signal line opens the card AND the report beside it. Phone: the
// "Open the posting" button (the signal line is the way into the sheet).
async function openCard(page, w) {
  if (w >= 500) await page.click('[data-deck-signal]').catch(() => {});
  else await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /Open the posting/.test(b.textContent))?.click());
  await sleep(1900);
}
const scrollTo = (page, sel, offset = -90) => page.evaluate((q, o) => {
  const el = document.querySelector(q); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + o);
}, sel, offset);

const SURFACES = [
  { id: 'deck', path: '/app/today', act: async (p, w) => { await openCard(p, w); await scrollTo(p, w >= 500 ? '[data-deck-grid]' : '#deck-detail', w >= 500 ? -100 : -40); await sleep(500); } },
  { id: 'deck-scrolled', path: '/app/today', act: async (p, w) => { await openCard(p, w); await scrollTo(p, '[data-posting-body]', -20); await sleep(600); } },
  { id: 'deck-hover', path: '/app/today', widths: [1440], act: async (p, w) => {
      await openCard(p, w); await scrollTo(p, '[data-posting-body]', -260); await sleep(400);
      await p.hover('#deck-ats [data-pair-term="Terraform"]').catch(() => {});
      await sleep(500);
    } },
  { id: 'deck-sheet', path: '/app/today', widths: [390], act: async (p) => {
      await p.click('[data-deck-signal]').catch(() => {}); await sleep(1500);
      await p.evaluate(() => { for (const d of document.querySelectorAll('[data-deck-sheet] details')) d.open = true; });
      await sleep(400);
    } },
  { id: 'deck-thin', path: '/app/today', act: async (p, w) => { await openCard(p, w); await scrollTo(p, w >= 500 ? '[data-deck-grid]' : '#deck-detail', w >= 500 ? -100 : -40); await sleep(500); } },
  { id: 'deck-declined', path: '/app/today', act: async (p, w) => { await openCard(p, w); await scrollTo(p, w >= 500 ? '[data-deck-grid]' : '#deck-detail', w >= 500 ? -100 : -40); await sleep(500); } },
  { id: 'board', path: '/app/jobs?job=j0', act: async () => { await sleep(1800); } },
  { id: 'board-ats', path: '/app/jobs', act: async (p) => {
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
      if (s.widths && !s.widths.includes(w)) continue;
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
        const post = document.querySelector('[data-posting-panel]');
        const aside = document.querySelector('#deck-ats');
        return {
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          report: !!r, posting: !!post,
          band: r?.querySelector('[data-ats-band]')?.textContent || document.querySelector('[data-pair-collapsed] [data-ats-band]')?.textContent || '',
          count: r?.querySelector('[data-ats-count]')?.textContent || document.querySelector('[data-pair-collapsed] [data-ats-count]')?.textContent || '',
          kicker: post?.querySelector('[data-posting-kicker]')?.textContent || '',
          strip: post ? [...post.querySelectorAll('[data-posting-strip] dd')].map(d => d.textContent).join(' | ') : '',
          met: post?.querySelector('[data-cell="experience"]')?.getAttribute('data-met') || '',
          kinds: r ? [...r.querySelectorAll('[data-ats-could-claim] .ats-box__kind')].map(k => k.textContent).join(',') : '',
          segs: (r || document)?.querySelectorAll('[data-ats-bar] .ats-bar__seg').length,
          exp: r?.querySelector('[data-ats-experience]')?.getAttribute('data-state') || '',
          lit: document.querySelectorAll('mark.posting__lit').length,
          collapsed: !!document.querySelector('[data-pair-collapsed]'),
          sticky: aside ? getComputedStyle(aside).position + '@' + Math.round(aside.getBoundingClientRect().top) : '',
          surface: getComputedStyle(r || post || document.body).backgroundColor,
          score: r ? r.querySelectorAll('[data-ats-score]').length : 0,
          note: r ? r.querySelectorAll('[data-claim-note]').length : 0,
        };
      });
      const file = path.join(OUT_DIR, `${LABEL}-${s.id}-${w}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: false });
      // Each half on its own, at full height — whatever the surface crops.
      const rep = await page.$$('[data-ats-report]');
      if (rep.length) await rep[rep.length - 1].screenshot({ path: file.replace(/\.png$/, '-card.png') }).catch(() => {});
      const post = await page.$('[data-posting-panel]');
      if (post && (s.id === 'deck' || s.id === 'deck-thin' || s.id === 'board')) await post.screenshot({ path: file.replace(/\.png$/, '-posting.png') }).catch(() => {});
      console.log(`${info.sw > info.cw ? 'OVERFLOW' : 'ok      '} ${path.basename(file)} report=${info.report} posting=${info.posting} ` +
        `band="${info.band}" count="${info.count}" kicker="${info.kicker}" strip="${info.strip}" met=${info.met} kinds=${info.kinds} ` +
        `segs=${info.segs} exp=${info.exp} lit=${info.lit} collapsed=${info.collapsed} sticky=${info.sticky} surface=${info.surface} ` +
        `score=${info.score} note=${info.note}` +
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

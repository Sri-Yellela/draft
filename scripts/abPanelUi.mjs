#!/usr/bin/env node
/**
 * TASKS AB2 / AB3 / AC1 / AC2 / AE3 / AC4 — Draft House, REAL-RUN verification by screenshot.
 * ============================================================================================
 * BROUGHT UP TO DATE FOR THE D113 TREE (2026-10-31). This harness was written for AD1 / AC3's panel —
 * sub-tabs over a dated listing, company tiles, outcome sections — which D25 and then D113 UI removed
 * (docs/DRAFT_HOUSE_WORKSPACE.md). Its checks of THAT chrome are retired with it: AD1's resting state,
 * calendar, sub-tabs, abort / soft delete and empty states; AB4's outcome sections; AC3's company tiles;
 * the side-by-side layouts; AE4's per-tab reading. What it still proves is what the tree did NOT
 * change, driven through the tree's own controls:
 *   AB2  one application held three times is ONE bubble in the tree, not three
 *   AC1  a packet-less held application's "Open" opens the review SCOPED to it; Review all is unscoped
 *   AC2  inside the review: company → application → problems, co-resolvable ones grouped, the
 *        attempts one disclosure away, a dead posting its own state, no "What we filled" on a hold
 *   AE3  a portal batch's review is titled with the EMPLOYER, not the ATS host (opened from the side
 *        column's broken-connections block now)
 *   AC4  the Database panel's own date filter is unchanged
 *   and  the tree asks for no dated history listing (D25 removed the calendar it fed)
 *
 * WHY THIS EXISTS
 * These are defects of PRESENTATION — how many things one application produces, and what an Open is
 * scoped to. A node test that reads the JSX as text passes over a bubble that renders three times or
 * a popup listing the wrong applications. So this drives THE REAL APP — App.jsx, the router,
 * AutoApplyContext, AutoApplyPanel — in a real Chrome, and reads the rendered DOM back.
 *
 * WHY THE API IS STUBBED RATHER THAN A REAL SERVER
 * The server writes to data/resume_master.db, whose path is not configurable, and seeding fixtures
 * into a developer's working database to take a screenshot is not a reasonable trade. Every /api/*
 * request is intercepted and answered from FIXTURES below. The pipeline itself is verified against a
 * real browser and a real ATS by scripts/ab1HeldHandoff.mjs; what is under test HERE is what the page
 * does with a given response.
 *
 * THE FIXTURE IS THE BUG REPORT. `review` contains three run-job rows for ONE OpenAI application
 * with three different reason codes — what the server returns after a job has been held, re-run and
 * held again, and exactly the shape that once produced three cards each claiming "1 APPLICATION".
 *
 * Usage:  node scripts/abPanelUi.mjs            # starts its own vite dev server
 *         AB_KEEP_OPEN=1 node scripts/abPanelUi.mjs   # leave the browser open to poke at
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(os.tmpdir(), 'ab-panel-ui');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let failures = 0;
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  if (!cond) failures++;
};

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────
const now = Date.now();
const ago = (h) => now - h * 3600_000;

/** ONE application, THREE held run-job rows. The AB2 defect, in data. */
const OPENAI_HELD = [
  { id: 903, runId: 9, jobId: 'openai-staff', company: 'OpenAI', title: 'Staff Engineer',
    status: 'held_review', reasonCode: 'captcha_required', reasonDetail: null,
    startedAt: ago(2), finishedAt: ago(2), attemptCount: 1, atsScore: 84,
    resumeAvailable: true, screenshotAvailable: true,
    applyUrl: 'https://boards.greenhouse.io/openai/jobs/900' },
  { id: 902, runId: 8, jobId: 'openai-staff', company: 'OpenAI', title: 'Staff Engineer',
    status: 'held_review', reasonCode: 'manual_review', reasonDetail: null,
    startedAt: ago(20), finishedAt: ago(20), attemptCount: 1, atsScore: 84,
    resumeAvailable: true, screenshotAvailable: true,
    applyUrl: 'https://boards.greenhouse.io/openai/jobs/900' },
  { id: 901, runId: 7, jobId: 'openai-staff', company: 'OpenAI', title: 'Staff Engineer',
    status: 'held_review', reasonCode: null, reasonDetail: null,
    startedAt: ago(30), finishedAt: ago(30), attemptCount: 1, atsScore: null,
    resumeAvailable: false, screenshotAvailable: false, applyUrl: null },
];

/**
 * A second, unrelated application — so "one card" cannot pass by collapsing everything — and TWO
 * PROBLEMS ON ONE JOB (AC2). The modal used to render those as two entries; requirement 1 says it
 * must render one, as the card summary already does. One of the two is `manual_review`, which is
 * the hold the shared question below is the concrete form of.
 */
const ANTHROPIC_HELD = [
  { id: 910, runId: 9, jobId: 'anthropic-re', company: 'Anthropic', title: 'Research Engineer',
    status: 'held_review', reasonCode: 'incomplete_form', reasonDetail: 'Sponsorship question',
    startedAt: ago(1), finishedAt: ago(1), attemptCount: 2, atsScore: 91,
    resumeAvailable: true, screenshotAvailable: true,
    applyUrl: 'https://job-boards.greenhouse.io/anthropic/jobs/910' },
  { id: 911, runId: 8, jobId: 'anthropic-re', company: 'Anthropic', title: 'Research Engineer',
    status: 'held_review', reasonCode: 'manual_review', reasonDetail: null,
    startedAt: ago(26), finishedAt: ago(26), attemptCount: 1, atsScore: 91,
    resumeAvailable: true, screenshotAvailable: true,
    applyUrl: 'https://job-boards.greenhouse.io/anthropic/jobs/910' },
];

/** A held review whose posting the 7-day cleanup removed — AB1 requirement 6, on screen. */
const DEAD_POSTING = [
  { id: 920, runId: 9, jobId: '4369183334', company: null, title: null,
    status: 'held_review', reasonCode: 'no_submit_button', reasonDetail: null,
    startedAt: ago(50), finishedAt: ago(50), attemptCount: 1, atsScore: null,
    resumeAvailable: false, screenshotAvailable: true, applyUrl: null },
];

/**
 * TASK AC1, IN DATA: a held application with NO handoff packet.
 *
 * This shape is the whole reason a green harness sat on top of a live defect. The card's plain
 * "Open" button is rendered by exactly one combination — a packet that does not exist, a posting
 * that is still on the board, and nothing stale — because every other combination renders
 * "Open & fill", "Run it again", or the posting-gone text instead. No fixture had that combination,
 * so the arm that reached the unscoped handler was unreachable from this harness, and the AB3 check
 * clicked DETAILS (which was scoped) rather than OPEN (which was not).
 *
 * Deliberately a company that appears nowhere else in these fixtures, so "the popup shows only this
 * application" cannot pass by accident on a name that is also in another section.
 */
const VERCEL_NO_PACKET = [
  { id: 930, runId: 9, jobId: 'vercel-plat', company: 'Vercel', title: 'Platform Engineer',
    status: 'held_review', reasonCode: 'full_auto_disabled', reasonDetail: null,
    startedAt: ago(3), finishedAt: ago(3), attemptCount: 1, atsScore: 76,
    resumeAvailable: true, screenshotAvailable: true,
    applyUrl: 'https://vercel.com/careers/930' },
];

/** Queued and running. NOT one of the three outcome sections — the fixture proves it survives. */
const IN_FLIGHT = [
  { id: 500, runId: 9, jobId: 'openai-sec', company: 'OpenAI', title: 'Security Engineer',
    status: 'running', reasonCode: null, startedAt: ago(0.1), finishedAt: null, attemptCount: 1,
    resumeAvailable: false, screenshotAvailable: false, applyUrl: null },
  { id: 501, runId: 9, jobId: 'stripe-inf', company: 'Stripe', title: 'Infra Engineer',
    status: 'queued', reasonCode: null, startedAt: null, finishedAt: null, attemptCount: 1,
    resumeAvailable: false, screenshotAvailable: false, applyUrl: null },
];
const SUBMITTED = [
  { id: 800, runId: 6, jobId: 'openai-infra', company: 'OpenAI', title: 'Infrastructure Engineer',
    status: 'submitted', reasonCode: null, startedAt: ago(70), finishedAt: ago(70),
    attemptCount: 1, atsScore: 88, resumeAvailable: true, screenshotAvailable: true,
    submitVerified: true, submitEvidence: 'Thanks for applying', applyUrl: 'https://boards.greenhouse.io/openai/jobs/800' },
  { id: 801, runId: 6, jobId: 'openai-ml', company: 'OpenAI', title: 'ML Engineer',
    status: 'submitted', reasonCode: null, startedAt: ago(71), finishedAt: ago(71),
    attemptCount: 1, atsScore: 79, resumeAvailable: true, screenshotAvailable: true,
    submitVerified: false, submitEvidence: null, applyUrl: 'https://boards.greenhouse.io/openai/jobs/801' },
  { id: 802, runId: 6, jobId: 'stripe-be', company: 'Stripe', title: 'Backend Engineer',
    status: 'submitted', reasonCode: null, startedAt: ago(96), finishedAt: ago(96),
    attemptCount: 1, atsScore: 83, resumeAvailable: true, screenshotAvailable: true,
    submitVerified: true, submitEvidence: 'Application received', applyUrl: 'https://stripe.com/jobs/802' },
];

const STOPPED = [
  { id: 700, runId: 5, jobId: 'figma-fe', company: 'Figma', title: 'Frontend Engineer',
    status: 'failed', reasonCode: 'resume_unavailable', reasonDetail: null,
    startedAt: ago(120), finishedAt: ago(120), attemptCount: 1, atsScore: null,
    resumeAvailable: false, screenshotAvailable: false, applyUrl: 'https://figma.com/jobs/700' },
  { id: 701, runId: 5, jobId: 'figma-be', company: 'Figma', title: 'Backend Engineer',
    status: 'failed', reasonCode: 'browser_binary_not_found', reasonDetail: null,
    startedAt: ago(121), finishedAt: ago(121), attemptCount: 1, atsScore: null,
    resumeAvailable: false, screenshotAvailable: false, applyUrl: 'https://figma.com/jobs/701' },
  { id: 702, runId: 5, jobId: 'notion-fs', company: 'Notion', title: 'Fullstack Engineer',
    status: 'failed', reasonCode: 'internal_error', reasonDetail: 'timeout',
    startedAt: ago(130), finishedAt: ago(130), attemptCount: 3, atsScore: null,
    resumeAvailable: false, screenshotAvailable: false, applyUrl: 'https://notion.so/jobs/702' },
  // NOT a failure — the user rejected it. Terminal, so it belongs in PROBLEMS, but nothing went
  // wrong with it. Without a row like this the "held on purpose" half of the section cannot render,
  // and the distinction the requirement insists on would go unverified.
  { id: 703, runId: 5, jobId: 'notion-des', company: 'Notion', title: 'Design Engineer',
    status: 'rejected', reasonCode: null, reasonDetail: null,
    startedAt: ago(131), finishedAt: ago(131), attemptCount: 1, atsScore: 72,
    resumeAvailable: true, screenshotAvailable: true, applyUrl: 'https://notion.so/jobs/703' },
];

/** SEVEN gated jobs across TWO portals — the amortisation AB4's verify insists must survive. */
const GATED = [];
const GATE_PACKETS = [];
for (let i = 0; i < 4; i++) {
  GATED.push({ id: 600 + i, runId: 4, jobId: `wd${i}`, company: 'Salesforce', title: `Engineer ${i + 1}`,
    status: 'held_gate', reasonCode: 'login_required', startedAt: ago(6), finishedAt: ago(6),
    attemptCount: 1, resumeAvailable: true, screenshotAvailable: false,
    applyUrl: `https://salesforce.wd1.myworkdayjobs.com/apply/${i}` });
  GATE_PACKETS.push({ packetId: 600 + i, jobId: `wd${i}`, runId: 4, runJobId: 600 + i,
    title: `Engineer ${i + 1}`, company: 'Salesforce',
    applyUrl: `https://salesforce.wd1.myworkdayjobs.com/apply/${i}`,
    expectedOrigin: 'https://salesforce.wd1.myworkdayjobs.com', gateReason: 'login_required',
    createdAt: ago(6), kind: 'gate', ageMs: 6 * 3600_000, stale: false,
    staleAfterMs: 259200000, postingGone: false,
    answerCount: 11, unresolvedCount: 2, resumeAvailable: true });
}
for (let i = 0; i < 3; i++) {
  GATED.push({ id: 650 + i, runId: 4, jobId: `gh${i}`, company: 'Datadog', title: `SRE ${i + 1}`,
    status: 'held_gate', reasonCode: 'login_required', startedAt: ago(7), finishedAt: ago(7),
    attemptCount: 1, resumeAvailable: true, screenshotAvailable: false,
    applyUrl: `https://datadog.avature.net/apply/${i}` });
  GATE_PACKETS.push({ packetId: 650 + i, jobId: `gh${i}`, runId: 4, runJobId: 650 + i,
    title: `SRE ${i + 1}`, company: 'Datadog',
    applyUrl: `https://datadog.avature.net/apply/${i}`,
    expectedOrigin: 'https://datadog.avature.net', gateReason: 'login_required',
    createdAt: ago(7), kind: 'gate', ageMs: 7 * 3600_000, stale: false,
    staleAfterMs: 259200000, postingGone: false,
    answerCount: 11, unresolvedCount: 2, resumeAvailable: true });
}

// ── AE3: THE ROW THAT PRODUCED "JOBS.ASHBYHQ.COM — 1 APPLICATION" ──────────────────────────────
// The reported shape exactly: ONE application, at a DIRECT per-employer ATS host, held on a gate.
// scraped_jobs.company says OpenAI and the card says OpenAI; the modal header said the host,
// because openPortalReview labelled its scope by origin. A batch of one is also the case that makes
// the substitution most obvious — there is exactly one employer it could have named.
GATED.push({ id: 690, runId: 4, jobId: 'ashby-openai', company: 'OpenAI',
  title: 'Software Engineer, Agent Productivity',
  status: 'held_gate', reasonCode: 'captcha_required', startedAt: ago(3), finishedAt: ago(3),
  attemptCount: 1, resumeAvailable: true, screenshotAvailable: true,
  applyUrl: 'https://jobs.ashbyhq.com/openai/0432731c/application' });
GATE_PACKETS.push({ packetId: 690, jobId: 'ashby-openai', runId: 4, runJobId: 690,
  title: 'Software Engineer, Agent Productivity', company: 'OpenAI',
  applyUrl: 'https://jobs.ashbyhq.com/openai/0432731c/application',
  expectedOrigin: 'https://jobs.ashbyhq.com', gateReason: 'captcha_required',
  createdAt: ago(3), kind: 'gate', ageMs: 3 * 3600_000, stale: false,
  staleAfterMs: 259200000, postingGone: false,
  answerCount: 4, unresolvedCount: 2, resumeAvailable: true });

// Per-application review packets, so the held cards can offer AB1's handoff on screen. The OpenAI
// one is fresh; the dead-posting one reports postingGone.
const REVIEW_PACKETS = [
  { packetId: 700, jobId: 'openai-staff', runId: 9, runJobId: 903, title: 'Staff Engineer',
    company: 'OpenAI', applyUrl: 'https://boards.greenhouse.io/openai/jobs/900',
    expectedOrigin: 'https://boards.greenhouse.io', gateReason: 'captcha_required',
    createdAt: ago(2), kind: 'review', ageMs: 2 * 3600_000, stale: false,
    staleAfterMs: 259200000, postingGone: false,
    answerCount: 9, unresolvedCount: 1, resumeAvailable: true },
  { packetId: 701, jobId: 'anthropic-re', runId: 9, runJobId: 910, title: 'Research Engineer',
    company: 'Anthropic', applyUrl: 'https://job-boards.greenhouse.io/anthropic/jobs/910',
    expectedOrigin: 'https://job-boards.greenhouse.io', gateReason: 'incomplete_form',
    createdAt: ago(1), kind: 'review', ageMs: 3600_000, stale: false,
    staleAfterMs: 259200000, postingGone: false,
    answerCount: 10, unresolvedCount: 1, resumeAvailable: true },
  { packetId: 702, jobId: '4369183334', runId: 9, runJobId: 920, title: null, company: null,
    applyUrl: 'https://boards.greenhouse.io/gone/jobs/920',
    expectedOrigin: 'https://boards.greenhouse.io', gateReason: 'no_submit_button',
    createdAt: ago(50), kind: 'review', ageMs: 50 * 3600_000, stale: false,
    staleAfterMs: 259200000, postingGone: true,
    answerCount: 8, unresolvedCount: 0, resumeAvailable: false },
];

const REVIEW = [...ANTHROPIC_HELD, ...OPENAI_HELD, ...DEAD_POSTING, ...VERCEL_NO_PACKET];

const FIXTURES = {
  '/api/auth/me': { authenticated: true, user: { id: 1, username: 'ada', email: 'ada@example.com', planTier: 'PRO' } },
  '/api/apply/runs': {
    runs: [
      { id: 9, status: 'completed', mode: 'auto', startedAt: ago(1), submittedCount: 0, heldCount: 5, failedCount: 0 },
      { id: 6, status: 'completed', mode: 'auto', startedAt: ago(70), submittedCount: 3, heldCount: 0, failedCount: 0 },
      { id: 5, status: 'completed', mode: 'auto', startedAt: ago(120), submittedCount: 0, heldCount: 0, failedCount: 3 },
    ],
    review: REVIEW, gated: GATED, inFlight: IN_FLIGHT, submitted: SUBMITTED, stopped: STOPPED,
    statusCounts: { held_review: REVIEW.length, held_gate: GATED.length, submitted: SUBMITTED.length, failed: STOPPED.length },
  },
  '/api/apply/gate-packets': {
    portals: [
      { origin: 'https://salesforce.wd1.myworkdayjobs.com', host: 'salesforce.wd1.myworkdayjobs.com',
        count: 4, packetIds: [600, 601, 602, 603], oldestAt: ago(6), gateReasons: ['login_required'] },
      { origin: 'https://datadog.avature.net', host: 'datadog.avature.net',
        count: 3, packetIds: [650, 651, 652], oldestAt: ago(7), gateReasons: ['login_required'] },
      // AE3. One application, one employer, a per-employer ATS host.
      { origin: 'https://jobs.ashbyhq.com', host: 'jobs.ashbyhq.com',
        count: 1, packetIds: [690], oldestAt: ago(3), gateReasons: ['captcha_required'] },
    ],
    packets: [...GATE_PACKETS, ...REVIEW_PACKETS],
    // A TRUNCATED QUEUE. The server caps this list at 100 unconsumed packets, and past that the
    // portals above are a SUBSET — every count on them short, with nothing on screen saying so.
    // That is the same shape of failure the extension hit: a cap that reads as an answer. The
    // fixture is deliberately truncated so the notice has to be there; the guard that it appears
    // ONLY when truncated is test/gatePacketsCap.test.js, which asserts the JSX is conditional.
    origin: null,
    total: 137,
    returned: GATE_PACKETS.length + REVIEW_PACKETS.length,
    truncated: true,
    limit: 100,
  },
  // A SHARED QUESTION (AC2). Deduplicated across jobs by the server and blocking two different
  // applications, so one answer really does release both. The other genuine co-resolution.
  '/api/apply/questions': {
    questions: [
      { question: 'Are you legally authorised to work in the United States?',
        // buildOpenQuestions emits 'unanswered' or 'low_confidence'. This is the former:
        // the form asked and the resolver would not fill it. QUESTION_REASON_TO_HOLD binds it to
        // the manual_review hold, so that hold is not ALSO listed as a bare category beneath it.
        reason: 'unanswered', eligibility: true, type: 'select',
        options: [{ value: 'Yes' }, { value: 'No' }], proposed: '', answered: false,
        blocking: [
          { jobId: 'anthropic-re', runId: 9, title: 'Research Engineer', company: 'Anthropic' },
          { jobId: 'openai-staff', runId: 9, title: 'Staff Engineer', company: 'OpenAI' },
        ] },
    ],
    eligibilityCount: 1, blockedJobs: 2,
  },
  // ONE approval waiting, so the side column's "Ready for your review" block — where Review all lives
  // since D113 UI — renders (every side block but Needs you is left out when it is empty).
  '/api/apply/pending': { pending: [
    { runJobId: 960, runId: 9, jobId: 'linear-api', title: 'API Engineer', company: 'Linear',
      applyUrl: 'https://jobs.ashbyhq.com/linear/960', createdAt: Math.floor(ago(1) / 1000),
      answerCount: 9, guessCount: 0, resume: { artifactId: null, atsScore: null, available: false },
      baseAts: { score: 41, band: 'moderate', scorable: true, declineReasons: [], matched: ['python'], missing: ['go'],
                 matchedCount: 1, missingCount: 1, resumeDepth: null },
      generationDeferred: true, screenshotAvailable: false },
  ] },
  '/api/apply/readiness': { available: true, reason: null },
  '/api/integrations/status': { apply: { missing: [] } },
  // The app shell reads the job profiles, and the Database panel is driven for AC4's "the Database
  // calendar must be unchanged for its own use" regression. Both return ARRAYS from the real server; the generic FALLBACK
  // object hangs the panel's render, which is a fixture problem rather than a defect — but a
  // hung page is indistinguishable from a broken one, so it gets the real shape.
  '/api/applications': [
    { job_id: 'gh1', company: 'OpenAI', role: 'Staff Engineer', location: 'SF', source: 'greenhouse',
      apply_mode: 'AUTO', applied_at: Math.floor(now / 1000) - 86400, notes: '', job_url: 'https://x/1',
      auto_status: 'submitted' },
    { job_id: 'gh2', company: 'Stripe', role: 'Infra Engineer', location: 'NYC', source: 'greenhouse',
      apply_mode: 'MANUAL', applied_at: null, notes: '', job_url: 'https://x/2', auto_status: 'manual' },
  ],
  '/api/resumes': [],
  '/api/domain-profiles': [
    { id: 1, profile_name: 'Backend Engineer', seniority: 'senior', is_active: 1,
      has_base_resume: 1, base_resume_updated_at: Math.floor(now / 1000) - 86400,
      target_titles: ['Staff Engineer', 'Backend Engineer', 'Platform Engineer'], role_family: 'engineering' },
    { id: 2, profile_name: 'Data Platform', seniority: 'mid', is_active: 0,
      has_base_resume: 0, base_resume_updated_at: null,
      target_titles: ['Data Engineer'], role_family: 'data' },
    { id: 3, profile_name: 'ML Research', seniority: 'senior', is_active: 0,
      has_base_resume: 1, base_resume_updated_at: Math.floor(now / 1000) - 172800,
      // No titles AND no role family, so the card's empty body state renders — the branch that
      // would otherwise go unverified on both sides of the extraction.
      target_titles: [], role_family: null },
  ],
  // ── D113: the tree's own reads, answered with their real "nothing yet" shapes ───────────────
  // No D113 runs (the tree groups today's attempts by day), no Table rows, no portals, no Gmail, no
  // Auto settings. Given explicitly: FALLBACK's generic object would make these reads guess.
  '/api/picks/runs': { runs: [], state: { mode: 'off', nextRunAt: null } },
  '/api/pipeline': { surface: 'table', rows: [], counts: {} },
  '/api/portals': { portals: [] },
  '/api/gmail/status': { available: false },
  '/api/apply/auto-settings': { settings: null },
};

/**
 * Every request the page made for the dated history. D25 removed the calendar these fed, and the tree
 * has none: an empty list is the check. (The endpoints still exist — The Table reads its own.)
 */
const historyRequests = [];
/** Anything not named above answers with a benign empty shape rather than a 404 storm. */
const FALLBACK = { ok: true, jobs: [], items: [], results: [], data: [], count: 0, total: 0 };

// ── Vite dev server ──────────────────────────────────────────────────────────────────────────
function startVite() {
  return new Promise((resolve, reject) => {
    // vite's own bin, run under this node. Not `npx`: node on Windows refuses to spawn a .cmd
    // shim without shell:true, and shell:true would mean concatenating arguments into a command
    // line. This needs neither.
    const proc = spawn(process.execPath,
      [path.join(ROOT, 'client', 'node_modules', 'vite', 'bin', 'vite.js'),
       '--port', '5199', '--strictPort'],
      { cwd: path.join(ROOT, 'client'), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const onData = (b) => {
      // Vite colours its banner: strip the escape codes (the ESC byte too) before looking for the port.
      out += b.toString().replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b/g, '');
      if (/localhost:5199/.test(out)) resolve({ proc, url: 'http://localhost:5199' });
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => reject(new Error(`vite did not start:\n${out.slice(-800)}`)), 60000);
  });
}

// ── The page's own hooks (client/src/components/DraftHouseTree.jsx, CompanyBubble.jsx, DraftHouseSide.jsx) ──
// test/d113ui.test.js d113uiHarnessesCurrent pins that each of these still exists in the client source.
const SEL = {
  tree: '[data-draft-tree]',
  bubble: (jobId) => `[data-draft-tree] [data-company-bubble][data-vt-title="${jobId}"]`,
  lead: '[data-lead-card]',
  action: (id) => `[data-lead-card] [data-action="${id}"]`,
  leaf: (id) => `[data-leaf="${id}"] > button`,
  leafBody: (id) => `[data-leaf-body="${id}"]`,
  reviewAll: '[data-review-all]',
  connection: (key) => `[data-connection="${key}"] button`,
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('=== AB2 / AC1 / AC2 / AE3 / AC4 — Draft House, the tree ===\n');

  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }

  const vite = await startVite();
  console.log(`vite     ${vite.url}\n`);

  const browser = await puppeteer.launch({
    executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check'],
    defaultViewport: { width: 1400, height: 1200, deviceScaleFactor: 1 },
  });

  try {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log(`      [page error] ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') console.log(`      [console] ${m.text()}`); });

    // Every /api/* answered from the fixtures. Match on PATHNAME so query strings do not miss.
    await page.setRequestInterception(true);
    const served = new Set();
    page.on('request', (req) => {
      const url = new URL(req.url(), vite.url);
      if (!url.pathname.startsWith('/api/')) return req.continue();
      if (url.pathname === '/api/sync/events') return; // the SSE stream: left pending, never answered
      served.add(url.pathname);
      if (url.pathname.startsWith('/api/apply/history')) historyRequests.push(url.pathname + url.search);
      const body = FIXTURES[url.pathname] ?? FALLBACK;
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    const shot = (name) => page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
    const readModal = () => page.evaluate(() => {
      const scrim = [...document.querySelectorAll('div')]
        .find(d => d.style && d.style.position === 'fixed' && d.style.inset === '0px');
      return scrim ? scrim.innerText : null;
    });
    const modalEntries = () => page.evaluate(() => {
      const scrim = [...document.querySelectorAll('div')]
        .find(d => d.style && d.style.position === 'fixed' && d.style.inset === '0px');
      return scrim ? [...scrim.querySelectorAll('[data-rm-card="application"]')].map(e => e.dataset.rmJob) : [];
    });
    const closeModal = async () => {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => /^Close$/i.test(b.innerText.trim()));
        if (btn) btn.click();
      });
      await sleep(400);
    };
    const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
    /** Open a job's branch in the tree (one branch at a time: opening it closes any other). */
    const openBranch = async (jobId) => {
      const ok = await click(SEL.bubble(jobId));
      await sleep(500);
      return ok && !!(await page.$(SEL.lead));
    };

    await page.goto(`${vite.url}/app/auto-apply`, { waitUntil: 'networkidle2', timeout: 60000 });
    // Wait for the tree and its bubbles rather than a fixed sleep, so a slow machine does not
    // screenshot an empty page and call it a defect.
    await page.waitForFunction((s) => document.querySelectorAll(s).length > 3, { timeout: 30000 },
      `${SEL.tree} [data-company-bubble]`).catch(async () => {
        const t = await page.evaluate(() => document.body.innerText.slice(0, 500));
        console.log('      [panel body]', JSON.stringify(t));
      });
    await sleep(1200);

    check('the page rendered against the stubbed API',
      served.has('/api/apply/runs') && served.has('/api/apply/gate-packets'), [...served].join(' '));
    check('Draft House is the tree', !!(await page.$(SEL.tree)));
    check('and it asks for NO dated history — the calendar it fed is gone (D25)',
      historyRequests.length === 0, historyRequests.join(', ') || 'none');
    await shot('tree.png');
    console.log(`      screenshot: ${path.join(OUT_DIR, 'tree.png')}\n`);

    // ── AB2: one bubble per application ────────────────────────────────────────────────────
    console.log('── AB2: one bubble per application ──');
    const ids = ['openai-staff', 'anthropic-re', 'vercel-plat'];
    const sels = ids.map(SEL.bubble);
    const counts = await page.evaluate((ss) => ss.map(s => document.querySelectorAll(s).length), sels);
    const bubbles = Object.fromEntries(ids.map((id, i) => [id, counts[i]]));
    check('AB2  three held run-jobs of ONE OpenAI application are ONE bubble', bubbles['openai-staff'] === 1, `${bubbles['openai-staff']} bubbles`);
    check('AB2  two of one Anthropic application are ONE bubble', bubbles['anthropic-re'] === 1, `${bubbles['anthropic-re']} bubbles`);
    check('AB2  and an unrelated application is its own bubble, so "one" is not everything collapsed',
      bubbles['vercel-plat'] === 1, `${bubbles['vercel-plat']} bubbles`);

    // ── AC1: Open is scoped to its application; Review all is not ──────────────────────────
    console.log('\n── AC1: Open receives and honours a scope ──');
    const vercelOpen = await openBranch('vercel-plat');
    const vercelBtn = await page.evaluate((s) => document.querySelector(s)?.innerText.trim() ?? null, SEL.action('open'));
    check('AC1  a packet-less held application\'s lead card offers a plain "Open" (the arm that was unscoped)',
      vercelOpen && vercelBtn === 'Open', vercelBtn ?? 'no Open in the lead card');
    if (vercelBtn === 'Open') {
      await click(SEL.action('open'));
      await sleep(700);
      const modal = await readModal();
      const entries = await modalEntries();
      check('AC1  Open opened the review', !!modal, modal ? `${modal.length} chars` : 'no modal');
      // Counted off the entries' own data hook, not by searching for company names — a shared
      // question legitimately NAMES the other applications it unblocks.
      check("AC1  Open shows ONLY that application — no other job, no dead posting",
        entries.length === 1 && entries[0] === 'vercel-plat', entries.join(', ') || 'nothing');
      check('AC1  and the review is TITLED with that application, not "Every application"',
        !!modal && /vercel/i.test(modal.split('\n')[0] || '') && !/Every application/i.test(modal), (modal || '').split('\n')[0]);
      await shot('ac1-open-scoped.png');
      await closeModal();
    }
    const reviewAll = await click(SEL.reviewAll);
    if (reviewAll) {
      await sleep(700);
      const modal = await readModal();
      const seen = ['OpenAI', 'Anthropic', 'Vercel'].filter(c => modal && modal.includes(c));
      check('AC1  "Review all" (the side column\'s Ready for your review) is the deliberate UNSCOPED path',
        seen.length === 3, `the review mentions: ${seen.join(', ') || 'nothing'}`);
      await shot('ac1-review-all.png');
      await closeModal();
    } else {
      check('AC1  "Review all" is still the deliberate UNSCOPED path', false, 'no Review all in the side column');
    }

    // ── AC2: company → application → problems, opened from the branch's "What happened" leaf ──
    console.log('\n── AC2: company → application → problems ──');
    const anthropicOpen = await openBranch('anthropic-re');
    await click(SEL.leaf('happened'));
    await sleep(400);
    const reviewOpened = await page.evaluate((s) => {
      const body = document.querySelector(s);
      const btn = body && [...body.querySelectorAll('button')].find(b => /^Open its review$/.test(b.innerText.trim()));
      if (!btn) return false;
      btn.click();
      return true;
    }, SEL.leafBody('happened'));
    check('AC2  the branch\'s What happened leaf opens the application\'s own review', anthropicOpen && reviewOpened);
    if (reviewOpened) {
      await sleep(700);
      const m = await page.evaluate(() => {
        const scrim = [...document.querySelectorAll('div')]
          .find(d => d.style && d.style.position === 'fixed' && d.style.inset === '0px');
        if (!scrim) return null;
        return {
          text: scrim.innerText,
          entries: [...scrim.querySelectorAll('[data-rm-card="application"]')].map(el => ({
            job: el.dataset.rmJob,
            groups: el.querySelectorAll('[data-rm-plan="group"]').length,
            singles: el.querySelectorAll('[data-rm-plan="single"]').length,
            unblocks: [...el.querySelectorAll('[data-rm-plan="group"]')].map(g => Number(g.dataset.rmUnblocks)),
            text: el.innerText,
          })),
          companyHeadings: [...scrim.querySelectorAll('span')].map(s => s.innerText.trim())
            .filter(t => /^(ANTHROPIC|OPENAI|VERCEL|POSTING NO LONGER ON THE BOARD)$/i.test(t)),
          attempts: scrim.querySelectorAll('[data-rm-card="attempt"]').length,
        };
      });
      check('AC2  two problems on ONE job render as ONE application entry, not two',
        !!m && m.entries.length === 1 && m.entries[0].job === 'anthropic-re', m ? m.entries.map(e => e.job).join(', ') : 'no modal');
      check('AC2  its two problems are listed TOGETHER inside that one entry',
        !!m && (m.entries[0]?.groups + m.entries[0]?.singles) === 2,
        m ? `${m.entries[0]?.groups} grouped + ${m.entries[0]?.singles} single` : 'no modal');
      check('AC2  the co-resolvable one is presented as ONE action with the count it unblocks',
        !!m && m.entries[0]?.groups === 1 && m.entries[0]?.unblocks[0] === 2 && /one action, 2 applications/i.test(m.entries[0]?.text || ''),
        m ? `unblocks=${m.entries[0]?.unblocks.join(',')}` : 'no modal');
      check('AC2  and it names the shared question rather than the bare category beneath it',
        !!m && /legally authorised to work/i.test(m.entries[0]?.text || '')
          && !/The form asked something only you can answer/i.test(m.entries[0]?.text || ''));
      check('AC2  a COMPANY tier sits above the application',
        !!m && m.companyHeadings.some(h => /ANTHROPIC/i.test(h)), (m?.companyHeadings || []).join(' / '));
      check('AC2  HELD ON PURPOSE is still distinguished from BROKEN inside the review',
        !!m && /held on purpose/i.test(m.text), (m?.text || '').split('\n')[1]);
      check('AC2  the per-attempt detail is not lost — it is one disclosure away',
        !!m && m.attempts === 0 && /show 2 attempts/i.test(m.text), (m?.text.match(/Show \d+ attempts?/i) || ['absent'])[0]);
      const shown = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => /Show \d+ attempts?/i.test(b.innerText));
        if (!btn) return false;
        btn.click();
        return true;
      });
      await sleep(400);
      const after = await page.evaluate(() => {
        const scrim = [...document.querySelectorAll('div')]
          .find(d => d.style && d.style.position === 'fixed' && d.style.inset === '0px');
        return { attempts: scrim ? scrim.querySelectorAll('[data-rm-card="attempt"]').length : 0, text: scrim ? scrim.innerText : '' };
      });
      check('AC2  opening it shows every attempt, with its own status and evidence',
        shown && after.attempts === 2 && /Review/.test(after.text) && /Resume PDF/.test(after.text), `${after.attempts} attempt rows`);
      await shot('ac2-application-entry.png');
      await closeModal();
    }

    // A dead posting is its OWN STATE in the review, reached through Review all.
    if (await click(SEL.reviewAll)) {
      await sleep(700);
      const dead = await page.evaluate(() => {
        const scrim = [...document.querySelectorAll('div')]
          .find(d => d.style && d.style.position === 'fixed' && d.style.inset === '0px');
        const el = scrim?.querySelector('[data-rm-card="application"][data-rm-job="4369183334"]');
        return el ? { text: el.innerText, buttons: [...el.querySelectorAll('button')].map(b => b.innerText.trim()) } : null;
      });
      check('AC2  the dead posting is its OWN state inside the review, not a "Review" row',
        !!dead && /the posting is gone/i.test(dead.text) && /posting gone — cannot be resumed/i.test(dead.text)
          && !dead.buttons.some(b => /^(Open|Open & fill|Sign in)$/i.test(b)),
        dead ? `buttons: ${dead.buttons.join(' / ') || 'none'}` : 'no dead-posting entry');
      const controls = (await readModal()) || '';
      check('AC2  every control survives in the review: resume, ATS, posting, Open, attempts',
        /Resume PDF/.test(controls) && /ATS \d+/.test(controls) && /The posting/.test(controls) && /Open/.test(controls) && /attempts?/i.test(controls));
      check('AE4  "What we filled" is not offered on a held application', !/What we filled/.test(controls));
      await shot('ac2-dead-posting.png');
      await closeModal();
    }

    // ── AE3: a portal batch's review names the EMPLOYER, not the ATS host ────────────────────
    // Opened the way the user does now: the side column's broken-connections block.
    console.log('\n── AE3: the review header names the employer ──');
    const opened = await click(SEL.connection('portal-https://jobs.ashbyhq.com'));
    check('AE3  the Ashby portal batch offers its own action in the side column', opened);
    await sleep(900);
    const header = await page.evaluate(() => {
      const titles = [...document.querySelectorAll('div')]
        .filter(d => getComputedStyle(d).textTransform === 'uppercase' && /— \d+ APPLICATION/i.test(d.innerText || ''));
      return titles.length ? titles.sort((a, b) => a.innerText.length - b.innerText.length)[0].innerText.trim() : null;
    });
    console.log(`      review header: ${JSON.stringify(header)}`);
    check('AE3  the header names the EMPLOYER', /OPENAI/i.test(header || ''), header || '(no header)');
    check('AE3  and never the ATS host', !/ASHBYHQ|ASHBY\.COM|GREENHOUSE\.IO|MYWORKDAYJOBS/i.test(header || ''), header || '(no header)');
    check('AE3  the count it was always right about is preserved', /1 APPLICATION\b/i.test(header || ''), header || '(no header)');
    await shot('ae3-review-header.png');
    await closeModal();

    // ── AC4 regression: the Database panel's own calendar ─────────────────────────────────
    // The calendar component is shared; the Database panel's use of it must be unchanged.
    console.log('\n── AC4 regression: the Database panel\'s calendar ──');
    // domcontentloaded, not networkidle2: this panel keeps an SSE connection open.
    await page.goto(`${vite.url}/app/database`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => /RESUMES/i.test(document.body.innerText) && /SAVED JOBS/i.test(document.body.innerText),
      { timeout: 20000 }).catch(() => {});
    await sleep(1200);
    const dbFilter = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /Filter by date/i.test(b.innerText));
      if (!btn) return false;
      btn.click();
      return true;
    });
    check('AC4  the Database panel still offers its date filter', dbFilter);
    await sleep(700);
    const dbCal = await page.evaluate(() => {
      const el = document.querySelector('[data-rm-calendar="1"]');
      if (!el) return null;
      return {
        days: [...el.querySelectorAll('[data-rm-day]')].filter(d => d.dataset.rmDay).length,
        marked: [...el.querySelectorAll('[data-rm-marked]')].filter(d => d.dataset.rmMarked).length,
        text: el.innerText,
      };
    });
    check('AC4  and it renders the calendar', !!dbCal && dbCal.days >= 28, dbCal ? `${dbCal.days} day cells` : 'no calendar');
    check('AC4  with its own controls intact — month nav, Clear date, Today',
      !!dbCal && /Clear date/i.test(dbCal.text) && /Today/i.test(dbCal.text) && /\d{4}/.test(dbCal.text));
    check('AC4  and NOTHING dotted — the markers prop is opt-in and this panel did not opt in', !!dbCal && dbCal.marked === 0);
    await shot('ac4-database-calendar.png');

    if (process.env.AB_KEEP_OPEN) {
      console.log('\nAB_KEEP_OPEN set — leaving the browser open. Ctrl+C to finish.');
      await new Promise(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
    vite.proc.kill();
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('\nHARNESS FAILED:', e); process.exit(1); });

#!/usr/bin/env node
/**
 * ⭐ D149 RULE 3 · PROVE IT, SIDE BY SIDE. For each approved screen: open THE SKETCH FILE and THE APP SCREEN (fed
 * synthetic fixtures that match the sketch's own sample data — stubbed /api/*, no server, no database, nobody's data)
 * at 1280 × 800 and 390 × 844 in Dusk Dark, and write into docs/fidelity-shots/:
 *   <screen>-sketch-<size>.png · <screen>-app-<size>.png · <screen>-side-<size>.png (the two side by side, with the
 *   differing regions outlined on the app half)
 * plus fidelity.json: per pair a visual-similarity score (the share of pixels within a small colour distance) and the
 * biggest differing regions (an 8 × 8 grid, the worst cells first).
 *
 *   node scripts/fidelityShots.mjs [deck,fullhouse,settings]   (default: every screen in SCREENS)
 *
 * ⚠ The row names Playwright; this repository drives Chrome with puppeteer-core (no new dependency) — same browser,
 * same screenshots. The diff is computed in Chrome on a canvas (no image library needed).
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { LOGO_HOST } from "../shared/companyLogos.js";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

// ⛔ 47j R2: the classic market is DELETED (its probes — home, home-dock, home-open, home-match, home156, home163, home-wide,
// deck, fullhouse — retired with it); every market probe measures the plate market.
// ⭐ 47i: the plate probes pin ?plate=1. The switch is REMEMBERED (marketPlate.js, localStorage) and the fill runs every probe
// in ONE Chrome profile. ⛔ 47j R3 (w1-retire): the switch is retired (nothing reads ?plate= now); the param is left in
// these addresses, harmless.
const PLATE_MARKET = "/app/jobs?plate=1";
// ⛔ 47j R3 (w1-retire): the classic Home (the tracker table measured against tracker-options.html / home-sketch.html) is
// DELETED — Home is always the ledger. The Home probes below load the ledger; their rows are the register's
// (.pl-register__row, opened by the company button .pl-register__whobtn). The classic-vs-sketch probes (tracker,
// tracker-open, tracker-timeline) and their computed-styles reader are retired with test/fidelityTracker.test.js.
const HOME_LEDGER = "/app/auto-apply";
const LEDGER_ROW = "[data-tracker-table] .pl-register__row";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
// ⭐ A232 R2 (46t): FIDELITY_OUT sends the shots elsewhere — the tests' shared probe writes to tmp/, so a suite run no longer
// rewrites the tracked docs/fidelity-shots/*.png (they changed on every run). Run the script yourself to refresh them.
const OUT = process.env.FIDELITY_OUT ? path.resolve(ROOT, process.env.FIDELITY_OUT) : path.join(ROOT, "docs", "fidelity-shots");
const PORT = 5199;
const SIZES = { desktop: [1280, 800], phone: [390, 844] };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// ⭐ 47j (D199 C7): a posting opens on its own SHEET now (/app/jobs/<id>, plate/OpeningSheet.jsx) — the Index row's title is the
// sheet's link. Opens the Index tab, presses the row (repeated while no sheet shows: a press mid tab-switch is dropped) and
// waits for the sheet's glance strip. → true when the sheet is up.
async function openSheetFromIndex(page, title, ms = 20000) {
  for (const t0 = Date.now(); Date.now() - t0 < ms;) {
    const up = await page.evaluate((title) => {
      if (document.querySelector("[data-opening-sheet] .pl-op__glance")) return true;
      const rows = [...document.querySelectorAll("[data-market-index] [data-index-title]")];
      if (!rows.length) { [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /index/i.test(t.textContent))?.click(); return false; }
      (rows.find(e => e.textContent.trim() === title) || rows[0]).click();
      return false;
    }, title).catch(() => false);
    if (up) return true;
    await page.waitForSelector("[data-opening-sheet] .pl-op__glance", { timeout: 1500 }).catch(() => {});
  }
  return false;
}
// 47h: open a posting from the plate market's Index row and WAIT for the deck's slot to open (A240 turns the openings to
// Deck). 47g's fixed sleep after the press missed the open twice under a loaded refill; the press is repeated while the
// slot stays shut (a press landing mid tab-switch is dropped), up to `ms`.
async function openIndexRow(page, title, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const open = await page.evaluate((title) => {
      const slot = document.querySelector("[data-deck-post-slot]");
      if (slot?.getAttribute("data-open") === "true" && document.querySelector("[data-deck-post-slot] [data-jd-panel]")) return true;
      const rows = [...document.querySelectorAll("[data-market-index] [data-index-title]")];
      (rows.find(e => e.textContent.trim() === title) || rows[0])?.click();
      return false;
    }, title).catch(() => false);
    if (open) return true;
    await page.waitForFunction(() => document.querySelector("[data-deck-post-slot]")?.getAttribute("data-open") === "true"
      && !!document.querySelector("[data-deck-post-slot] [data-jd-panel]"), { timeout: 1500 }).catch(() => {});
  }
  return false;
}
const now = Math.floor(Date.now() / 1000);

// ── The sketch's sample data, as the app's API answers ────────────────────────────────────────────────────────────
const NORTHWIND = {
  jobId: "j0", id: "j0", company: "Northwind", title: "Senior Data Engineer", location: "Boston, MA", tagWorkplace: "hybrid", workType: "Hybrid",
  contractType: "Full-time", salaryMin: 165000, salaryMax: 190000, postedAt: new Date((now - 9 * 3600) * 1000).toISOString(),
  url: "https://example.invalid/0", applyUrl: "https://example.invalid/0", companyIconUrl: null,
  description: "We're looking for a senior data engineer to build and run the pipelines behind our platform.\n\nWhat you'll do:\n- Design and run batch and streaming pipelines in Spark and Airflow\n- Model data for analytics and machine learning\n\nWhat you'll bring:\n- 5+ years building data pipelines in production\n- Strong SQL and Python",
  matchScore: 86, baseAtsScore: 86,
};
const BOARD = [
  NORTHWIND,
  { ...NORTHWIND, jobId: "j1", id: "j1", company: "Halcyon", title: "Machine Learning Engineer", location: "Remote (US)", tagWorkplace: "remote", workType: "Remote", salaryMin: 150000, salaryMax: 180000, matchScore: 81, baseAtsScore: 81 },
  { ...NORTHWIND, jobId: "j2", id: "j2", company: "Quanta", title: "Data Platform Engineer", location: "New York, NY", tagWorkplace: "onsite", workType: "On-site", contractType: "Contract", salaryMin: 140000, salaryMax: 170000, matchScore: 77, baseAtsScore: 77 },
  { ...NORTHWIND, jobId: "j3", id: "j3", company: "Lumen", title: "Backend Engineer, Data", location: "Austin, TX", salaryMin: 130000, salaryMax: 160000, matchScore: 74, baseAtsScore: 74 },
  { ...NORTHWIND, jobId: "j4", id: "j4", company: "Vireo", title: "Analytics Engineer", location: "Seattle, WA", tagWorkplace: "remote", workType: "Remote", salaryMin: 135000, salaryMax: 165000, matchScore: 71, baseAtsScore: 71 },
];
const COMMON = {
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1, target_titles: ["Data Engineer"] }],
  "/api/domain-profiles/1/base-resume": { name: "resume.pdf", content: "A. Lovelace — Data Engineer. Python, SQL, Spark." },
  "/api/draft/slots": { limit: 10, used: 3, remaining: 7, drafts: 2, generations: 1, windowHours: 24 },
  "/api/extension/status": { connected: true, state: "connected" },
  "/api/applications/pending": { pending: [], verified: [], methods: [], verifyRule: {} },
  "/api/resumes": [], "/api/jobs/pending": [], "/api/applications": [],
};
const DECK = {
  "/api/draft/today": { date: new Date().toLocaleDateString("en-CA"), profileId: 1, size: 3, dealtNow: false, thin: false,
    cards: BOARD.slice(0, 3).map((job, i) => ({ position: i, band: "strong", decision: null, score: job.matchScore,
      job: { ...job, id: job.jobId }, why: { matched: ["Python", "SQL", "Spark", "AWS"], missing: ["Kafka", "Airflow"], matchedTotal: 13, missingTotal: 2 }, report: null,
      // D152 (3): each card's best-bets reading (the server's bestBetOf), its reasons the card's reason line.
      bestBet: { score: 80 - i, band: "best", reasons: ["you're eligible", `${7 - i} of 7 must-haves`, `${job.matchScore} ATS match`, "posted 9 hours ago"] } })) },
};
// The opened posting's text is fullhouse-declutter.html's own (its `.pn`), so the two panels hold the same words.
const FH_DESCRIPTION = "We're looking for a senior data engineer to build and run the pipelines behind our platform, working with analysts and ML engineers to make data reliable and fast.\n\nWhat you'll do:\n- Design and run batch and streaming pipelines in Spark and Airflow\n- Model data for analytics and machine learning\n- Improve reliability, cost and speed across the platform\n\nWhat you'll bring:\n- 5+ years building data pipelines in production\n- Strong SQL and Python\n- A streaming system such as Kafka";
const FH_BOARD = BOARD.map(j => ({ ...j, description: FH_DESCRIPTION }));
const FULLHOUSE = {
  "/api/jobs": { jobs: FH_BOARD, total: 746, totalPages: 15, nextCursor: null, attribution: [] },
  "/api/jobs/facets": { total: 746, unscored: 0, coverage: { level: 746, where: 746, employment: 746 },
    views: { all: 746, saved: 12, pending: 3, imported: 0 }, clauses: { posted: [{ value: "", count: 746, known: 746 }, { value: "1d", count: 38, known: 38 }] } },
};
// ⛔ D153 (5) · THE FACTS BOX WITH EVERY LONG FACT ON FILE — the owner's production screenshot broke "Rem / ote", "not
// state / d", "Says no spon / sors / hip". The first posting carries a sponsorship statement and a history line too, so
// the box holds six cells at both widths.
const FACTS_BOARD = FH_BOARD.map((j, i) => (i ? j : { ...j, workType: "Remote", tagWorkplace: "remote", experienceLevel: "Senior",   // 47j: the sheet's LEVEL cell
  sponsorship: { level: "says_no", label: "Says no sponsorship", sources: [], notice: "" },
  liveness: { label: "Reposted 3 times" } }));
const FACTS = { ...FULLHOUSE, "/api/jobs": { ...FULLHOUSE["/api/jobs"], jobs: FACTS_BOARD },
  // ⭐ 47j (D199 C7): a posting opens on its own sheet (/app/jobs/<id>), which reads the job by id
  ...Object.fromEntries(FACTS_BOARD.slice(0, 3).map(j => [`/api/jobs/by-id/${j.jobId}`, { job: j }])) };
// ⭐ D152 · HOME (home-sketch.html): the deck and the board on one screen, fed by both screens' fixtures.
// 14 postings, so the page scrolls (the in-place posting's Close must return the reader to where they were).
const HOME_BOARD = Array.from({ length: 14 }, (_, i) => ({ ...FH_BOARD[i % FH_BOARD.length], jobId: `h${i}`, id: `h${i}` }));
const HOME = { ...FULLHOUSE, ...DECK, "/api/jobs": { ...FULLHOUSE["/api/jobs"], jobs: HOME_BOARD } };
// ⭐ D156: the same Home, plus the import route's answer (a synthetic posting) for "Import a job".
const HOME156 = { ...HOME, "/api/import/job": { job: { id: "imp1", jobId: "imp1", title: "Data Engineer", company: "Acme" },
  capture: { message: "Data Engineer at Acme is on your board — under Imported." } },
  // ⭐ D156 (1c): the deck's cards are not on the board's first page, so opening one into its long post fetches it by id.
  ...Object.fromEntries(FH_BOARD.slice(0, 3).map(j => [`/api/jobs/by-id/${j.jobId}`, { job: j }])),
  // ⭐ 47j (D199 C7): the plate deck deals the board's page (h0…h13), and a press opens that posting's SHEET, which reads it by id
  ...Object.fromEntries(HOME_BOARD.map(j => [`/api/jobs/by-id/${j.jobId}`, { job: j }])) };
const SETTINGS = {
  "/api/apply/auto-settings": { settings: { dailyCap: 10, runTimes: ["09:00", "18:00"], timeZone: "America/New_York", pauseCompanyAfterReply: true,
    filters: {}, profileId: null, agreeToTerms: false, staleReposts: 3, staleOpenDays: 90, showFormBeforeSending: true, onlySponsorRecord: true, perCompanyLimit30d: 2 } },
  "/api/apply/run-bar": { mode: { current: "semi", auto: { locked: false } }, windowHours: 24, hold: { held: false, since: null },
    caps: [{ id: "queue", label: "Previews", used: 6, limit: 40 }, { id: "approval", label: "Approvals", used: 5, limit: 30 }, { id: "submission", label: "Submitted", used: 4, limit: 25 }] },
  "/api/notify/settings": { email: { offered: true }, push: { offered: true }, events: [{ key: "picks", label: "New picks", what: "", email: true, push: true }] },
  "/api/portals": { portals: [], accounts: [], worker: false }, "/api/gmail/status": { available: false },
  "/api/apply/runs": { runs: [], review: [], gated: [], inFlight: [], submitted: [], stopped: [], statusCounts: {} },
  "/api/apply/pending": { pending: [], approvalCap: { remaining: 10, limit: 10 } },
};

// ── ⭐ D149 · TRACKER (tracker-options.html, layout 1 on desktop / layout 3 on phones) — its own block ─────────────
// The sketch's six applications, fed through the app's own feeds so lib/trackerRows.js builds them as it would live:
//   Halcyon — held on one question (Needs you) · Quanta — filled, waiting for approval (Ready to send) · Lumen — filling
//   7 of 11 · Vireo — interview Tuesday 2 PM · Northwind — sent 3 days ago · Basalt — not selected 2 weeks ago;
// and the timeline's three runs (today 9 AM: 50 looked at · 4 picked; yesterday 6 PM: 32 · 3; yesterday 9 AM: 0 · 0).
// Times are New York's (the settings' zone), so "9 AM" reads 9 AM whatever the machine's zone.
const TRK = (() => {
  const ymdNY = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const nyAt = (daysAgo, hour) => Math.floor((Date.parse(`${ymdNY(Date.now() - daysAgo * 86400000)}T00:00:00-05:00`) + hour * 3600000) / 1000);
  const nextTue = (() => { const d = new Date(); d.setDate(d.getDate() + (((2 - d.getDay()) + 7) % 7 || 7)); return d.toLocaleDateString("en-CA"); })();
  const H = { jobId: "trk-h", company: "Halcyon", title: "Machine Learning Engineer" };
  const Q = { jobId: "trk-q", company: "Quanta", title: "Data Engineer" };
  const L = { jobId: "trk-l", company: "Lumen", title: "Backend Engineer" };
  const V = { jobId: "trk-v", company: "Vireo", title: "Data Platform Engineer" };
  const N = { jobId: "trk-n", company: "Northwind", title: "Senior Data Engineer" };
  const B = { jobId: "trk-b", company: "Basalt", title: "Software Engineer, Platform" };
  const pick = (j, id) => ({ id, jobId: j.jobId, company: j.company, title: j.title, state: "applied" });
  return {
    ...SETTINGS,
    "/api/apply/readiness": { available: true },
    "/api/apply/runs": { runs: [], gated: [], submitted: [], stopped: [], statusCounts: {}, line: { waiting: [], held: null },
      review: [{ id: 101, ...H, status: "held_review", reasonCode: "needs_answer", createdAt: now - 2 * 3600, resumeAvailable: true }],
      inFlight: [{ id: 103, ...L, status: "running", startedAt: now - 60, createdAt: now - 60, progress: { filled: 7, total: 11 } }] },
    "/api/apply/questions": { questions: [{ question: "Are you open to relocating to Austin?", blocking: [{ jobId: H.jobId }] }] },
    "/api/apply/pending": { pending: [{ runJobId: 102, ...Q, createdAt: now - 3 * 3600, answerCount: 12, resume: { available: true } }],
      approvalCap: { remaining: 10, limit: 10 } },
    "/api/pipeline": { rows: [
      { id: 201, ...V, status: "interview", updatedAt: now - 6 * 86400, resumeAvailable: true, interview: { ymd: nextTue, time: "14:00" }, progress: { filled: 11, total: 11 } },
      { id: 202, ...N, status: "submitted", updatedAt: now - 3 * 86400, resumeAvailable: true, progress: { filled: 14, total: 14 } },
      { id: 203, ...B, status: "rejected", updatedAt: now - 15 * 86400, progress: { filled: 9, total: 9 } },
    ] },
    "/api/picks/runs": { state: { nextRunAt: null }, runs: [
      { id: 3, slotAt: nyAt(0, 9), seen: 50, picked: 4, picks: [pick(H, 31), pick(Q, 32), pick(L, 33), pick(V, 34)] },
      { id: 2, slotAt: nyAt(1, 18), seen: 32, picked: 3, picks: [pick(N, 21), pick(B, 23)] },
      { id: 1, slotAt: nyAt(1, 9), seen: 0, picked: 0, picks: [] },
    ] },
  };
})();
// ── end TRACKER fixtures ──────────────────────────────────────────────────────────────────────────────────────────

// ⭐ D163: the Atlas home as a new reader sees it (no résumé yet: the prompt, Explore by role) — with no answer at all its
// main column is empty and only the side column draws, which measures a fixture, not the layout.
const ATLAS163 = { ...SETTINGS, "/api/atlas/me": { signedIn: true, prompt: "Add your résumé and the Atlas draws your map: the skills you have, the ones the roles you want ask for, and the next one to learn.",
  exploreByRole: { items: [
    { slug: "data-engineer", name: "Data Engineer", postings: 412, topSkills: [{ name: "Python" }, { name: "SQL" }, { name: "Spark" }] },
    { slug: "machine-learning-engineer", name: "Machine Learning Engineer", postings: 268, topSkills: [{ name: "Python" }, { name: "PyTorch" }] },
    { slug: "backend-engineer", name: "Backend Engineer", postings: 530, topSkills: [{ name: "Go" }, { name: "Postgres" }] },
  ] }, recent: [] },
  // 45s: Your run opens with Atlas (45o A154/A155); with no fixture it read {} and threw on run.level.n, so the page never drew.
  "/api/atlas/run": { total: 40, level: { n: 1, name: "Foundations", at: 0, next: { n: 2, name: "Building blocks", at: 150 }, toNext: 110, pct: 26 },
    streak: 2, weekdaysOnly: false, best: 3, month: [], marks: { earned: [], next: [] }, proven: [], week: 40, latest: [], quests: [],
    rule: "Points come only from proof: an idea explained in your own words, a build finished, a skill checked." } };

// ⭐ D163: the account page as a password account with one session (with {} the sessions list throws on .filter).
const ACCOUNT163 = { ...SETTINGS, "/api/account": { username: "ada", email: "ada@example.invalid", displayName: "Ada", signInMethods: { password: true } },
  "/api/account/sessions": { sessions: [{ id: 1, current: true, device: "Chrome on Windows", lastSeenAt: now }], apps: [] } };

// 45s: Your profile (A153, 45o) reads /api/profile/page + /api/profile/sections; under strict fixtures both 404'd and the panel
// drew "Not in the fixtures." (profile 1280: left 55 vs right 387). These are the REAL routes' answers for a synthetic person,
// made by scripts/genProfileFixture163.mjs (routes/profileSections.js on a fresh migrated database).
const PROFILE163 = { ...SETTINGS,
  "/api/profile/page": {"visibility":{"page":"only_me","sections":{"about":null,"experience":null,"skills":null,"fit":"only_me","projects":null,"achievements":null,"education":null,"links":null},"effective":{"about":"only_me","experience":"only_me","skills":"only_me","fit":"only_me","projects":"only_me","achievements":"only_me","education":"only_me","links":"only_me"},"searchable":false,"openToWork":false,"referrals":false,"headline":null},"levels":{"only_me":"Only you","connections":"Connections","public":"Public"},"header":{"name":"Ada Example","headline":"Software Engineer","location":null,"years":4,"avatar":false,"handle":null,"placement":{"category":"software-engineering","categoryName":"Software engineering","subcategory":"swe.general","subName":"Software engineering · general","level":"mid","levelLabel":"mid-level","also":null},"openToWork":false,"referrals":false},"source":{"name":"r.txt","at":1794250341},"activeProfileId":10,"highlight":[],"sections":{"about":{"summary":"Backend engineer building data systems."},"experience":{"items":[{"id":1,"company":"Northwind","title":"Software Engineer","location":"Boston, MA","start":"2022-01","end":null,"current":true,"bullets":["Built a queue","Cut latency 30%"],"logo":null,"initial":"N","source":"resume","evidence":[[],[]],"marks":[{"text":"Built a queue","backed":false,"mark":"unbacked","words":"No evidence linked","links":0},{"text":"Cut latency 30%","backed":false,"mark":"unbacked","words":"No evidence linked","links":0}],"duration":"4 yrs 11 mos"}]},"skills":{"proven":[],"fromResume":[{"name":"Java","key":"java","slug":null,"action":"proof"},{"name":"Python","key":"python","slug":null,"action":"proof"},{"name":"Docker","key":"docker","slug":null,"action":"proof"}],"counts":{"proven":0,"fromResume":3}},"fit":{"role":"Software engineering · general","thin":true,"line":"Not enough postings yet to say how ready you are.","placement":{"category":"software-engineering","categoryName":"Software engineering","subcategory":"swe.general","subName":"Software engineering · general","level":"mid","levelLabel":"mid-level","also":null}},"projects":{"items":[]},"achievements":{"items":[]},"education":{"items":[]},"links":{"items":[]}}},
  "/api/profile/sections": {"sections":{"summary":"Backend engineer building data systems.","importedBasis":"v1:046afce57277edc5","experience":[{"id":1,"company":"Northwind","title":"Software Engineer","location":"Boston, MA","start":"2022-01","end":null,"current":true,"bullets":["Built a queue","Cut latency 30%"],"logo":null,"initial":"N","source":"resume","evidence":[[],[]],"marks":[{"text":"Built a queue","backed":false,"mark":"unbacked","words":"No evidence linked","links":0},{"text":"Cut latency 30%","backed":false,"mark":"unbacked","words":"No evidence linked","links":0}],"companyRef":null}],"education":[],"skills":[{"id":1,"name":"Java","category":null,"source":"resume"},{"id":2,"name":"Python","category":null,"source":"resume"},{"id":3,"name":"Docker","category":null,"source":"resume"}],"links":[],"projects":[]},"defaults":[{"group":"work_authorisation","label":"Work authorisation","items":[{"key":"authorised_to_work","label":"Authorised to work in the US","values":["yes","no"],"set":false,"value":null,"source":null,"setAt":null},{"key":"sponsorship_now","label":"Needs sponsorship now","values":["yes","no"],"set":false,"value":null,"source":null,"setAt":null},{"key":"sponsorship_later","label":"Will need sponsorship later","values":["yes","no"],"set":false,"value":null,"source":null,"setAt":null},{"key":"citizenship","label":"Citizenship","text":true,"set":false,"value":null,"source":null,"setAt":null},{"key":"clearance","label":"Security clearance","values":["none","confidential","secret","top_secret","ts_sci","can_obtain"],"set":false,"value":null,"source":null,"setAt":null}]},{"group":"work_preferences","label":"Work preferences","items":[{"key":"in_person","label":"Can work in person","values":["yes","no","hybrid_only"],"set":false,"value":null,"source":null,"setAt":null},{"key":"relocate","label":"Willing to relocate","values":["yes","no"],"set":false,"value":null,"source":null,"setAt":null},{"key":"start_date","label":"Earliest start date","text":true,"set":false,"value":null,"source":null,"setAt":null},{"key":"transport","label":"Reliable transport","values":["yes","no"],"set":false,"value":null,"source":null,"setAt":null}]},{"group":"background","label":"Background","items":[{"key":"government_ties","label":"Government employment or ties","values":["yes","no"],"set":false,"value":null,"source":null,"setAt":null},{"key":"criminal_history","label":"Criminal history disclosure","text":true,"set":false,"value":null,"source":null,"setAt":null}]},{"group":"eeo","label":"Voluntary self-ID","items":[{"key":"gender","label":"Gender","text":true,"set":false,"value":null,"source":null,"setAt":null},{"key":"ethnicity","label":"Race / ethnicity","text":true,"set":false,"value":null,"source":null,"setAt":null},{"key":"veteran","label":"Veteran status","text":true,"set":false,"value":null,"source":null,"setAt":null},{"key":"disability","label":"Disability status","text":true,"set":false,"value":null,"source":null,"setAt":null}]}],"completeness":{"done":4,"of":10,"sections":{"contact":true,"summary":true,"experience":true,"education":false,"skills":true,"links":false,"work_authorisation":false,"work_preferences":false,"background":false,"eeo":false}},"suggestion":null,"education":{"degree":null,"field":null,"school":null,"year":null,"source":null,"derived":null,"override":null}},
  "/api/profile/replacements/latest": {"replacement":null},
};

// ── The screens ───────────────────────────────────────────────────────────────────────────────────────────────────
// sketch: the file; sketchPrep: hide the sketch's own controls (they are not the design); app: the route, its fixtures,
// and what to press so the app shows the sketch's state.
const SKETCH_CONTROLS = ".ctl, .lay-ctl, .switch, .note, #note";
// ⭐ D156 (1c): a swipe on the card (a real pointer drag, which framer's drag reads) DECIDES, as the deck always has —
// left passes (the PASS stamp shows on the way); the next card comes to the front. (47j R2: lifted out of the retired
// classic `home156` screen; plate156 runs it.)
const deckSwipeProbe = async (page) => {
    // ⭐ 47j: a point on the card that is the CARD — since D200 Rule 2 its chips, stamp and letter tile open popovers and take
    // the pointer (a drag from a control is that control's press), so the centre is no longer a safe place to grab
    const r = await page.evaluate(() => {
      const art = document.querySelector('[data-fan-offset="0"] article'); const a = art?.getBoundingClientRect();
      if (!a) return null;
      for (const fy of [0.5, 0.35, 0.65, 0.25, 0.8]) for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        const x = a.left + a.width * fx, y = a.top + a.height * fy, el = document.elementFromPoint(x, y);
        if (el && art.contains(el) && !el.closest("a, button, input, [role=button], [aria-haspopup]")) return { x, y, on: `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).split(" ")[0]}` };
      }
      return { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    });
    // the deck's own count line ("2 of 3 today"): an exiting card can still carry offset 0 while it leaves
    const front = () => page.evaluate(() => document.querySelector("[data-deck-count]")?.textContent || null);
    if (!r) return { swipe: null };
    const before = await front();
    // ⭐ 47j: the deck's own live line ("Passed …") — D199's market map is an earlier polite region on the page
    const passedLine = () => page.evaluate(() => [...document.querySelectorAll('[aria-live="polite"]')].map(e => e.textContent || "").find(t => /^Passed /.test(t)) || "");
    const saidBefore = await passedLine();
    await page.mouse.move(r.x, r.y); await page.mouse.down();
    let stamp = 0;
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(r.x - i * 16, r.y); await sleep(16);
      stamp = Math.max(stamp, await page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('[data-deck-stamp="pass"]')].map(e => Number(getComputedStyle(e).opacity) || 0))));
    }
    await page.mouse.up(); await sleep(900);
    const after = await front();
    const said = await passedLine();
    return { swipe: { before, after, passed: said !== saidBefore && /^Passed /.test(said), stampShown: stamp > 0.5, grabbed: r.on || null } };
  };
const SCREENS = {
  // ⭐ 47g R1 · THE PLATE MARKET'S DECK, LIVE (STYLE_PROBES.plate156, and deckSwipeProbe) on the page people use, /app/jobs —
  // test/d196MarketLiveBehaviour.test.js reads it: the turn, J / K / › / ‹, the wheel, the swipe, the opening sheet (47j), the
  // area nav's views, Import, the sort.
  plate156: { sketch: null, app: PLATE_MARKET, fixtures: HOME156, ready: "[data-plate-market-openings] [data-fan-offset]", probe: { plate: true },
    sizes: { wide: [1440, 900], desktop: [1280, 800], phone: [390, 844] },
    appPrep: async (page) => { await page.evaluate(() => document.querySelector("[data-deck-stage]")?.scrollIntoView({ block: "center" })); await sleep(1200); },
    // 47j: the page probe's Import turns the openings to Index (D199) — the deck is put back in front before the swipe
    nodeProbe: async (page, size, routeId) => { await page.evaluate(() => document.getElementById("mk-tab-deck")?.click()); await sleep(500);
      await page.evaluate(() => document.querySelector("[data-deck-stage]")?.scrollIntoView({ block: "center" })); await sleep(500); return deckSwipeProbe(page, size, routeId); } },
  // ⭐ A238 (47h) · A DECIDED CARD LEAVES THE DOM: after Pass · Save · Pass on the live plate market (motion on), the
  // [data-fan-offset] count falls by one per decision and no card lingers at offset 0, invisible (test/a238DecidedCardsUnmount).
  // A day deals ten (the walk's real deck); the fixture's three were all mounted at once, and showed no ghost.
  a238: { sketch: null, app: PLATE_MARKET, fixtures: { ...HOME156, "/api/draft/today": { ...DECK["/api/draft/today"], size: 10,
      cards: Array.from({ length: 10 }, (_, i) => { const c = DECK["/api/draft/today"].cards[i % 3]; const id = `${c.job.id}-a238-${i}`;
        return { ...c, position: i, job: { ...c.job, id, jobId: id, title: `${c.job.title} ${i + 1}` } }; }) } }, ready: "[data-plate-market-openings] [data-fan-offset]",
    sizes: { desktop: [1280, 800] },
    appPrep: async (page) => { await page.evaluate(() => document.querySelector("[data-deck-stage]")?.scrollIntoView({ block: "center" })); await sleep(1200); } },
  // ⭐ D163 · USE THE SPACE (owner 11-05) — the jobs page measured at 1280 / 1440 / 1920 / 2560 (and the phone): one centred
  // composition, the free space shared evenly, the gaps and gutters growing with the width, the deck centred in its
  // column, the dock on its own gutter, vertically centred (`--styles home163`). Also shot beside the sketch at the four
  // widths (`node scripts/fidelityShots.mjs home-wide`).
  // ⭐ D168 · ONE WAY TO OPEN, ONE JOB FOR THE WHEEL (owner 11-06, concept B) — measured with MOTION ON (`--styles home168`):
  // the page probe samples the swap frame by frame and opens / folds 50 times fast; the node probe drives a REAL wheel
  // and a real hover (puppeteer's mouse), which a dispatched event cannot (an untrusted wheel scrolls nothing).
  // ⭐ 47g R1 (retiring the classic market): D168 measured on the PLATE market — the page people use. The wheel "elsewhere"
  // is over the hero (the classic list is the Index tab now); the bubbles are the Index rows (the tab opened for them).
  home168: { sketch: null, app: PLATE_MARKET, fixtures: HOME156, ready: "[data-plate-market-openings] [data-fan-offset]", motion: true,
    sizes: { wide: [1440, 900], desktop: [1280, 800] },
    appPrep: async () => { await sleep(1200); },
    nodeProbe: async (page) => {
      const st = () => page.evaluate(() => ({
        y: Math.round(window.scrollY), count: document.querySelector("[data-deck-count]")?.textContent || null,
        // ⭐ 47j (D199 C7): "open" = the opening sheet is up (drawn over the market at /app/jobs/<id>)
        open: !!document.querySelector("[data-opening-over]"), url: location.pathname,
        jd: !!document.querySelector("[data-jd-panel]"), asks: (window.__d168asks || []).slice() }));
      // 47h browser tier: the fill read "undefined (reading 'x')" — a centre taken before its element mounted under load; wait first
      const centre = async (sel) => (await page.waitForSelector(sel, { timeout: 8000 }).catch(() => null), page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120) }; }, sel));
      await page.evaluate(() => { window.__d168asks = []; for (const n of ["draft:open-posting", "draft:close-posting"]) window.addEventListener(n, (e) => window.__d168asks.push(`${n.split(":")[1]}:${e.detail?.origin || ""}`)); window.scrollTo(0, 0); });
      await sleep(300);
      const out = {};
      // ── the wheel over the deck: one flick turns one card, the page does not move, nothing opens
      // (47g R1: on the plate the deck sits below the hero — brought into view first; "does not move" is against that y)
      await page.evaluate(() => document.querySelector("[data-deck-stage]")?.scrollIntoView({ block: "center" })); await sleep(400);
      const card = await centre('[data-fan-offset="0"] article');
      const a = await st();
      await page.mouse.move(card.x, card.y); await sleep(150);
      await page.mouse.wheel({ deltaY: 120 }); await sleep(450);
      const b = await st();
      await page.mouse.wheel({ deltaY: -120 }); await sleep(450);
      const c = await st();
      out.deckWheel = { before: a, down: b, up: c };
      // ── the wheel elsewhere (over the list): the page scrolls, the deck does not turn
      const list = await centre(".pl-markethero");
      await page.mouse.move(list.x, list.y); await sleep(150);
      await page.mouse.wheel({ deltaY: 200 }); await sleep(450);
      out.listWheel = await st();
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
      // ── ⭐ 47j (D199 C7 — re-pointed): a press opens the OPENING SHEET; the wheel over it scrolls the sheet (its own
      // scroller, overscroll contained), never the market underneath, and never closes it
      await page.evaluate(() => document.querySelector("[data-deck-stage]")?.scrollIntoView({ block: "center" })); await sleep(400);
      const o0 = await st();
      await page.evaluate(() => document.querySelector('[data-fan-offset="0"] [data-deck-title-line]')?.click());
      await page.waitForSelector("[data-opening-over] .pl-op__glance", { timeout: 15000 }).catch(() => {});
      await sleep(500);
      const opened = await st();
      const sTop = () => page.evaluate(() => Math.round(document.querySelector("[data-opening-over]")?.scrollTop ?? -1));
      const sc = await centre("[data-opening-over] .pl-op__top");
      if (sc) await page.mouse.move(sc.x, sc.y);
      await sleep(150);
      const top0 = await sTop();
      await page.mouse.wheel({ deltaY: 360 }); await sleep(500);
      const down = { ...(await st()), top: await sTop() };
      await page.mouse.wheel({ deltaY: -180 }); await sleep(500);
      const up = { ...(await st()), top: await sTop() };
      out.sheetWheel = { before: o0, opened, top0, down, up,
        overflowY: await page.evaluate(() => { const e = document.querySelector("[data-opening-over]"); return e ? getComputedStyle(e).overflowY : null; }) };
      await page.keyboard.press("Escape"); await sleep(700);
      out.sheetWheel.back = await st();
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
      // ── hover: over the front card, the backs and the bubbles — nothing opens
      await page.evaluate(() => { window.__d168asks = []; });
      const points = [await centre('[data-fan-offset="0"] article'), await centre('[data-fan-offset="1"] [data-fan-position]')].filter(Boolean);
      for (const p of points) { await page.mouse.move(p.x, p.y, { steps: 6 }); await sleep(500); }
      // the Index rows (the plate's bubbles): their tab opened, two rows rested on, then back to the Deck
      await page.evaluate(() => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /index/i.test(t.textContent))?.click()); await sleep(700);
      for (const sel of ["[data-market-index] .pl-ixrow:nth-of-type(1)", "[data-market-index] .pl-ixrow:nth-of-type(2)"]) { /* 47j: the plate's rows are .pl-ixrow */ const p = await centre(sel); if (p) { points.push(p); await page.mouse.move(p.x, p.y, { steps: 6 }); await sleep(500); } }
      out.hover = { points: points.length, ...(await st()), panels: await page.evaluate(() => document.querySelectorAll("[data-panel-id]").length) };
      await page.evaluate(() => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /deck/i.test(t.textContent))?.click()); await sleep(500);
      await page.mouse.move(2, 790);
      return { node: out };
    } },
  // ⭐ A201 (46k, owner 11-13: "the content of the home panel rows are garbled when shrunken probe the site and fix this across
  // all places so that the content readjusts gracefully and stay functional when windows shrink") — measured, not compared
  // (`--styles shrink201 [route,…]`): every screen at 1440 → 390, with Ask draft closed and open: no sideways page scroll,
  // nothing drawn past the viewport, no text drawn over other text, no text squeezed to a word a line, every control in reach.
  // A shot only where something fails: docs/fidelity-shots/shrink201-<route>-<size>[-ask].png.
  shrink201: { sketch: null,
    sizes: { "1440": [1440, 900], "1280": [1280, 800], "1024": [1024, 768], "900": [900, 800], "768": [768, 1024], "600": [600, 900], "390": [390, 844] },
    routes: {
      home: { app: PLATE_MARKET, fixtures: { ...HOME156, "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", displayName: "Ada Lovelace", email: "ada@example.invalid", planTier: "PRO", applyMode: "TAILORED" } } }, ready: "[data-nav-dock]", appPrep: async () => { await sleep(1200); } },
      draft: { app: HOME_LEDGER, fixtures: TRK, ready: LEDGER_ROW, appPrep: async () => { await sleep(600); } },
      "draft-held": { app: HOME_LEDGER, fixtures: TRK, ready: LEDGER_ROW,
        appPrep: async (page) => { await sleep(500); await page.evaluate(() => { const r = [...document.querySelectorAll("[data-tracker-table] .pl-register__row")].find(tr => /Halcyon/.test(tr.textContent)); (r || document.querySelector("[data-tracker-table] .pl-register__row"))?.querySelector(".pl-register__whobtn")?.click(); }); await sleep(900); } },
      "draft-posting": { app: HOME_LEDGER, fixtures: TRK, ready: LEDGER_ROW,
        appPrep: async (page) => { await sleep(500); await page.evaluate(() => document.querySelector("[data-tracker-table] .pl-register__row .pl-register__whobtn")?.click()); await sleep(300);
          await page.evaluate(() => document.querySelector('[data-row-detail] [data-pane="posting"]')?.click()); await sleep(700); } },
      // 47g R1: the home / board / posting routes on the PLATE market (the page people use) — the board is the Index tab,
      // the posting opened from its Index row (A240: the openings turn to Deck)
      board: { app: PLATE_MARKET, fixtures: FULLHOUSE, ready: "[data-plate-market-openings]",
        appPrep: async (page) => { await page.evaluate(() => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /index/i.test(t.textContent))?.click()); await sleep(900); } },
      posting: { app: PLATE_MARKET, fixtures: FACTS, ready: "[data-plate-market-openings]",
        appPrep: async (page) => { await page.evaluate(() => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /index/i.test(t.textContent))?.click());
          await page.waitForSelector("[data-market-index] [data-index-title]", { timeout: 20000 }).catch(() => {});
          await openIndexRow(page, "Senior Data Engineer"); await sleep(600); } },
      atlas: { app: "/app/atlas", fixtures: ATLAS163, ready: "main", appPrep: async () => { await sleep(900); } },
      profile: { app: "/app/profile/about", fixtures: PROFILE163, strict: true, ready: "main", appPrep: async () => { await sleep(900); } },
      account: { app: "/app/profile/account", fixtures: ACCOUNT163, strict: true, ready: "main", appPrep: async () => { await sleep(900); } },
      answers: { app: "/app/profile/answers", fixtures: SETTINGS, ready: "main", appPrep: async () => { await sleep(900); } },
      settings: { app: HOME_LEDGER, fixtures: TRK, ready: "[data-settings-open]",
        appPrep: async (page) => { await page.click("[data-settings-open]").catch(() => {}); await page.waitForSelector("[data-fold-top]", { timeout: 8000 }).catch(() => {}); await sleep(700); } },
      admin: { app: "/admin", fixtures: { "/api/admin/auth/me": { authenticated: true, enforced: true, admin: { email: "admin@example.invalid" } },
        "/api/auth/me": { authenticated: false } }, strict: true, ready: "h1", appPrep: async () => { await sleep(900); } },
    },
    nodeProbe: async (page, size, routeId) => {
      const read = () => page.evaluate(SHRINK_PROBE);
      const bad = (m) => m.sideScroll || m.past.length || m.overlaps.length || m.squeezed.length || m.unreachable.length;
      const out = { closed: await read() };
      fs.mkdirSync(OUT, { recursive: true });
      if (bad(out.closed)) fs.writeFileSync(path.join(OUT, `shrink201-${routeId}-${size}.png`), await page.screenshot({ type: "png" }));
      if (routeId !== "admin") {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent("draft:open-questions", { detail: { jobId: "trk-h", company: "Halcyon",
          questions: [{ question: "Are you open to relocating to Austin?", kind: "yesno", required: true, options: ["Yes", "No"] }] } })));
        await sleep(800);
        out.ask = await read();
        if (bad(out.ask)) fs.writeFileSync(path.join(OUT, `shrink201-${routeId}-${size}-ask.png`), await page.screenshot({ type: "png" }));
      }
      return { node: out };
    } },
  // ⭐ A200 (46k) · ASK DRAFT'S QUESTIONS THREAD — measured, not compared (`--styles ask200`): at each width, with a held
  // application's three questions open in Ask draft (synthetic: Yes / No, a choice, a written answer), nothing of the panel
  // sits under the dock, the question is in the stepper's large type, the timeline column is folded away, no sideways scroll.
  ask200: { sketch: null, app: HOME_LEDGER, fixtures: { ...TRK,
      "/api/apply/questions/greenhouse%3A%3A4000001/draft": { draft: "I built the alerting for a payments service and kept its on-call quiet for a year." } },
    ready: "[data-nav-dock]", shoot: true,
    sizes: { "1280": [1280, 800], "1440": [1440, 900], "1920": [1920, 1080], phone: [390, 844] },
    appPrep: async (page) => {
      await sleep(1200);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("draft:open-questions", { detail: { jobId: "greenhouse::4000001", company: "Example Robotics",
        questions: [
          { question: "Are you legally authorized to work in the United States without restriction now and in the future?", kind: "yesno", required: true, options: ["Yes", "No"] },
          { question: "Which office would you work from?", kind: "choice", required: true, options: ["San Francisco, CA", "New York, NY", "Remote — United States", "Toronto, ON"] },
          { question: "Tell us about a production system you were responsible for.", kind: "draft", required: true },
        ] } })));
      await sleep(900);
    },
    nodeProbe: async (page, size) => {
      const read = () => page.evaluate(() => {
        const r = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const dock = document.querySelector("[data-nav-dock]"), d = r(dock);
        const panel = document.querySelector("[data-ask-draft]");
        const thread = document.querySelector("[data-ask-thread]");
        const leaves = thread ? [...thread.querySelectorAll("p, button, textarea, h2")].filter(e => e.getBoundingClientRect().width > 0) : [];
        const q = document.querySelector("[data-ask-question]");
        const tl = document.querySelector(".dh-main > .dht");
        return { place: document.documentElement.getAttribute("data-dock-place"), vw: document.documentElement.clientWidth,
          askOpen: panel?.getAttribute("data-open"), threadShown: !!thread, dock: d, panel: panel && r(panel),
          // UNDER the dock = overlapping it AND the dock drawn on top there (A201: below 1280 px the panel is a sheet ABOVE the dock,
          // so an overlap with the sheet on top is not content hidden behind the dock — the owner's complaint)
          // ⭐ owner 11-15 (Tiny replaces Ask draft, floating): the card scrolls inside itself, so a line scrolled out of its
          // body is not drawn at all — only the part of a line inside the body's visible box can sit under anything
          underDock: leaves.filter(e => { const b0 = r(e), sc = e.closest(".appnav-ask__body"), c = sc ? r(sc) : null;
            const b = c ? { left: Math.max(b0.left, c.left), right: Math.min(b0.right, c.right), top: Math.max(b0.top, c.top), bottom: Math.min(b0.bottom, c.bottom) } : b0;
            if (b.right <= b.left || b.bottom <= b.top || !hit(b, d)) return false; const x = (Math.max(b.left, d.left) + Math.min(b.right, d.right)) / 2, y = (Math.max(b.top, d.top) + Math.min(b.bottom, d.bottom)) / 2;
            const top = document.elementFromPoint(x, y); return !!top && !!top.closest("[data-nav-dock]"); }).map(e => `${e.tagName.toLowerCase()} ${(e.textContent || "").trim().slice(0, 30)}`),
          qSize: q ? parseFloat(getComputedStyle(q).fontSize) : null, qWeight: q ? getComputedStyle(q).fontWeight : null,
          choices: [...document.querySelectorAll("[data-ask-choice]")].map(b => ({ cls: b.className, h: Math.round(b.getBoundingClientRect().height), radius: getComputedStyle(b).borderTopLeftRadius })),
          timelineShown: !!tl && getComputedStyle(tl).display !== "none",
          sideScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      const out = { first: await read() };
      // the written answer: answer the two choices, then the draft's suggestion shows in the panel's own box
      await page.evaluate(() => document.querySelector('[data-ask-choice="Yes"]')?.click()); await sleep(300);
      await page.evaluate(() => document.querySelector("[data-ask-choice]")?.click()); await sleep(900);
      out.draft = await read();
      out.draft.suggestion = await page.evaluate(() => (document.querySelector("[data-ask-suggestion]")?.textContent || "").trim());
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `ask200-draft-${size}.png`), await page.screenshot({ type: "png" }));
      // closing Ask draft brings the timeline back
      await page.evaluate(() => document.querySelector("[data-ask-close]")?.click()); await sleep(700);
      out.closed = await page.evaluate(() => { const tl = document.querySelector(".dh-main > .dht"); return { timelineShown: !!tl && getComputedStyle(tl).display !== "none", askOpen: document.querySelector("[data-ask-draft]")?.getAttribute("data-open") }; });
      return { node: out };
    } },
  // ⭐ D197 Wave 1 #1 · A237 · THE SHELL'S PLACE (the Shell board, owner-approved 11-25 — supersedes D167's side / top /
  // phone by the margin, changed on purpose) — `--styles dock167place` (the id kept: test-support/fidelityProbe.mjs PROBES):
  // at each width the rail (a vertical rail at the left, 84 px, 14 px from the edges) and the content column beside it —
  // the area nav across its top, its row centred in its 1,180 px column (at 2560 the extra width is margin); below 980 px
  // the bottom bar and the area nav's top bar. A resize across 980 re-places it; the peek beside the rail / above the bar.
  dock167place: { sketch: null, app: PLATE_MARKET,   // ⭐ 47j R2: on the plate market (the classic one is deleted)
    fixtures: { ...HOME156, "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", displayName: "Ada Lovelace", email: "ada@example.invalid", planTier: "PRO", applyMode: "TAILORED" } } },
    ready: "[data-nav-dock]", shoot: true, motion: true,
    sizes: { "1280": [1280, 800], "1440": [1440, 900], "1920": [1920, 1080], "2560": [2560, 1440], "980": [980, 800], "979": [979, 800], phone: [390, 844] },
    appPrep: async () => { await sleep(1400); },
    nodeProbe: async (page, size) => {
      const read = () => page.evaluate(() => {
        const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const dock = document.querySelector("[data-nav-dock]");
        const shell = document.querySelector("[data-app-shell]");
        const nav = document.querySelector("[data-area-nav]");
        const row = nav?.querySelector(".pl-areanav__row"), top = nav?.querySelector(".pl-topbar");
        return { place: document.documentElement.getAttribute("data-dock-place"), vw: document.documentElement.clientWidth, vh: innerHeight,
          dock: box(dock), dockPosition: getComputedStyle(dock).position, bar: dock.classList.contains("pl-dock--bar"),
          labels: [...dock.querySelectorAll(".pl-dock__label")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim()),
          shellPadLeft: getComputedStyle(shell).paddingLeft, shellPadBottom: getComputedStyle(shell).paddingBottom,
          areaNav: box(nav), row: box(row), topBar: box(top), searchBox: box(nav?.querySelector(".pl-search")), searchButton: !!nav?.querySelector("[data-area-search-open]"),
          views: [...(nav?.querySelectorAll("[data-area-view]") || [])].map((a) => a.textContent.trim()),
          main: box(shell.querySelector("main")),
          scrollW: document.documentElement.scrollWidth,
          tiny: box(document.querySelector("[data-tiny-launch]")),
          wide: document.documentElement.scrollWidth > document.documentElement.clientWidth
            ? [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1
                && getComputedStyle(el).position !== "fixed").slice(0, 6)
                .map((el) => `${el.tagName.toLowerCase()}.${String(el.className || "").split(" ")[0]} ${Math.round(el.getBoundingClientRect().right)}`)
            : [] };
      });
      const out = { rest: await read() };
      // the peek follows the dock
      const pic = await page.evaluate(() => { const r = document.querySelector("[data-nav-dock] [data-nav-item='profile']").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.mouse.click(pic.x, pic.y); await sleep(600);
      out.peek = await page.evaluate(() => { const p = document.querySelector("[data-profile-peek]"), r = p.getBoundingClientRect(), d = document.querySelector("[data-nav-dock]").getBoundingClientRect();
        return { open: p.getAttribute("data-open"), left: r.left, top: r.top, right: r.right, bottom: r.bottom, dockRight: d.right, dockTop: d.top, dockLeft: d.left, vw: document.documentElement.clientWidth }; });
      await page.keyboard.press("Escape"); await sleep(400);
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `dock167place-${size}.png`), await page.screenshot({ type: "png" }));
      // re-placed on resize: across the 980 threshold and back
      if (size === "1920" || size === "phone") {
        const [w, h] = size === "1920" ? [900, 800] : [1280, 800];
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await sleep(900);
        out.resized = await read();
      }
      return { node: out };
    } },
  // ⭐ D197 Wave 1 #1 · THE DOCK, measured in a real Chrome (`--styles dock167` — the id kept; "rm" with reduced motion): the
  // rail's items in D167's order + the board's Ask draft after its rule; names always shown (the board — the hover-expand and
  // the /d → /draft draw-out are retired with the 60 px rail, changed on purpose); the active item the white tile; M takes the
  // keyboard into the dock and out; the dock's search in the area nav (Ctrl K focuses it); the Profile quick peek (opens on a
  // press and on a rest, closes on Esc, a press outside, leaving it) with its notifications list (A236 (b)); Tiny floats, and
  // the rail's Ask draft opens it too. Shots: docs/fidelity-shots/dock167-*.png.
  dock167: { sketch: null, app: PLATE_MARKET,   // ⭐ 47j R2: on the plate market
    fixtures: { ...HOME156, "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", displayName: "Ada Lovelace", email: "ada@example.invalid", planTier: "PRO", applyMode: "TAILORED" } },
      // the auto-apply mode: Apply for me selectable; choosing it answers with the bar in FULL AUTO
      "/api/apply/run-bar": SETTINGS["/api/apply/run-bar"],
      "/api/apply/mode": { ...SETTINGS["/api/apply/run-bar"], mode: { current: "auto", auto: { locked: false } } },
      // A236 (b): two notifications, one unread — the peek's list
      "/api/notifications": { unreadCount: 1, notifications: [
        { id: 2, type: "needs_you", message: "Kestrel Payments needs one answer from you", read: 0, created_at: Math.floor(Date.now() / 1000) - 3600 },
        { id: 1, type: "apply_complete", message: "Sent to Northwind Analytics", read: 1, created_at: Math.floor(Date.now() / 1000) - 2 * 86400 }] },
      "/api/notifications/read-all": { ok: true } },
    ready: "[data-nav-dock]", shoot: true, motion: true, reducedSizes: ["rm"],
    sizes: { "2560": [2560, 1440], "1280": [1280, 800], rm: [1280, 800] },
    appPrep: async () => { await sleep(1200); },
    nodeProbe: async (page, size) => {
      const q = (fn, ...a) => page.evaluate(fn, ...a);
      const box = (sel) => q((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }, sel);
      const out = { size };
      out.rest = await q(() => {
        const dock = document.querySelector("[data-nav-dock]"), r = dock.getBoundingClientRect(), cs = getComputedStyle(dock);
        const cur = dock.querySelector('[aria-current="page"]'), ccs = cur && getComputedStyle(cur);
        const logo = dock.querySelector(".pl-logo"), lcs = logo && getComputedStyle(logo);
        return {
          rail: { left: r.left, top: r.top, width: r.width }, border: cs.borderTopWidth, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow, bg: cs.backgroundColor,
          places: [...dock.querySelectorAll("[data-nav-item]")].map((e) => e.getAttribute("data-nav-item")),
          labels: [...dock.querySelectorAll(".pl-dock__label")].map((e) => e.textContent.trim()),
          shown: [...dock.querySelectorAll(".pl-dock__label")].filter((e) => e.getBoundingClientRect().width > 0 && Number(getComputedStyle(e).opacity) > 0.5).length,
          rule: !!dock.querySelector(".pl-dock__rule"), sep: !!dock.querySelector(".pl-dock__sep"),
          current: cur && { id: cur.getAttribute("data-nav-item"), bg: ccs.backgroundColor, border: ccs.borderTopWidth, shadow: ccs.boxShadow },
          logo: logo && { w: logo.offsetWidth, h: logo.offsetHeight, bg: lcs.backgroundColor, border: lcs.borderTopWidth, text: logo.textContent },
          badges: [...dock.querySelectorAll(".pl-badge")].map((b) => b.textContent),
          items: [...dock.querySelectorAll(".pl-dock__item")].map((e) => Math.round(e.getBoundingClientRect().height)),
          transitions: getComputedStyle(dock).transitionProperty,
        };
      });
      const shot = async (name) => { const b = await box("[data-nav-dock]"); fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, `dock167-${name}-${size}.png`), await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: Math.min(1400, b.right + 1000), height: Math.max(b.bottom + 14, 200) } })); };
      await shot("rest");
      // hovering doesn't change the rail's width (no hover-expand): names are always shown
      const rail = await box("[data-nav-dock]");
      await page.mouse.move(rail.left + 40, rail.top + 100); await sleep(500);
      out.hoverWidth = (await box("[data-nav-dock]")).width;
      await page.mouse.move(900, 600); await sleep(300);
      // M takes the keyboard into the dock (its current place) and back out
      await q(() => document.activeElement?.blur?.());
      await page.keyboard.press("m"); await sleep(250);
      out.mIn = await q(() => ({ inDock: !!document.querySelector("[data-nav-dock]")?.contains(document.activeElement), item: document.activeElement?.getAttribute("data-nav-item"),
        open: document.documentElement.getAttribute("data-dock-open") }));
      await page.keyboard.press("m"); await sleep(250);
      out.mOut = await q(() => ({ inDock: !!document.querySelector("[data-nav-dock]")?.contains(document.activeElement), open: document.documentElement.getAttribute("data-dock-open") }));
      // Ctrl K: the area nav's search (the dock's people / companies / roles suggest)
      await page.keyboard.down("Control"); await page.keyboard.press("k"); await page.keyboard.up("Control"); await sleep(250);
      out.ctrlK = await q(() => ({ focused: document.activeElement?.hasAttribute("data-dock-search-input") || false, inAreaNav: !!document.activeElement?.closest("[data-area-nav]"),
        placeholder: document.activeElement?.getAttribute("placeholder") }));
      await page.keyboard.press("Escape"); await sleep(200);
      // the peek: resting on the picture ≈ 350 ms opens it
      const pic = await box("[data-nav-dock] [data-nav-item='profile']");
      await page.mouse.move(pic.left + 20, pic.top + pic.height / 2);
      await sleep(150);
      out.peekAt150 = await q(() => document.querySelector("[data-profile-peek]")?.getAttribute("data-open"));
      await sleep(500);
      const peekState = () => q(() => {
        const p = document.querySelector("[data-profile-peek]"), r = p.getBoundingClientRect(), d = document.querySelector("[data-nav-dock]").getBoundingClientRect(), cs = getComputedStyle(p);
        return { open: p.getAttribute("data-open"), left: r.left, top: r.top, bottom: r.bottom, dockRight: d.right,
          name: p.querySelector("[data-peek-name]")?.textContent, email: p.querySelector("[data-peek-email]")?.textContent,
          links: [...p.querySelectorAll("a")].map(a => [a.textContent.trim(), a.getAttribute("href")]),
          mode: [...p.querySelectorAll("[data-peek-mode] button")].map(b => [b.textContent, b.getAttribute("aria-pressed"), b.disabled]),
          signOut: !!p.querySelector("[data-peek-signout]"), notifRow: p.querySelector("[data-peek-notifs]")?.textContent.replace(/\s+/g, " ").trim(),
          list: [...p.querySelectorAll("[data-peek-notif]")].map((li) => [li.getAttribute("data-peek-notif"), li.textContent.replace(/\s+/g, " ").trim()]),
          markAll: !!p.querySelector("[data-peek-mark-all]"),
          radius: cs.borderTopLeftRadius, border: cs.borderTopWidth, shadow: cs.boxShadow, bg: cs.backgroundColor };
      });
      out.peekRest = await peekState();
      // A236 (b): the Notifications row opens the list in place; Mark all read clears the unread
      await q(() => document.querySelector("[data-peek-notifs]")?.click()); await sleep(400);
      out.peekNotifs = await peekState();
      await page.screenshot({ type: "png" }).then(b => fs.writeFileSync(path.join(OUT, `dock167-peek-${size}.png`), b));
      await q(() => document.querySelector("[data-peek-mark-all]")?.click()); await sleep(400);
      out.peekAfterMarkAll = await q(() => ({ list: [...document.querySelectorAll("[data-peek-notif]")].map((li) => li.getAttribute("data-peek-notif")),
        badge: document.querySelector("[data-nav-dock] [data-nav-item='profile'] .pl-badge")?.textContent || null }));
      // the mode switch: Apply for me posts the mode (the fixture answers with the bar)
      await q(() => document.querySelector('[data-peek-mode] [data-mode="auto"]')?.click()); await sleep(500);
      out.modeAfterApplyForMe = await q(() => [...document.querySelectorAll("[data-peek-mode] button")].map(b => b.getAttribute("aria-pressed")));
      // leaving it (the pointer far away) closes it
      await page.mouse.move(900, 700); await sleep(700);
      out.peekAfterLeave = (await peekState()).open;
      // a press opens it; Esc closes it
      let pic2 = await box("[data-nav-dock] [data-nav-item='profile']");
      await page.mouse.move(pic2.left + pic2.width / 2, pic2.top + pic2.height / 2); await sleep(80);
      await page.mouse.down(); await page.mouse.up(); await sleep(450);
      out.peekAfterPress = (await peekState()).open;
      await page.keyboard.press("Escape"); await sleep(400);
      out.peekAfterEsc = (await peekState()).open;
      // a press outside closes it
      pic2 = await box("[data-nav-dock] [data-nav-item='profile']");
      await page.mouse.click(pic2.left + pic2.width / 2, pic2.top + pic2.height / 2); await sleep(450);
      out.peekAfterPress2 = (await peekState()).open;
      await page.mouse.click(1100, 500); await sleep(450);
      out.peekAfterOutside = (await peekState()).open;
      // Tiny (D190) floats: the fox bubble at the bottom-right opens a card OVER the page; the page keeps its width
      await page.mouse.move(900, 400); await sleep(700);
      const pageRight = () => q(() => Math.max(...[document.querySelector("[data-app-shell] main"), document.querySelector("[data-app-shell] main")?.firstElementChild].filter(Boolean).map(e => e.getBoundingClientRect().right)));
      const contentRightShut = await pageRight();
      const ask = await box("[data-tiny-launch]");
      await page.mouse.click(ask.left + ask.width / 2, ask.top + ask.height / 2); await sleep(800);
      out.ask = await q(() => {
        const p = document.querySelector("[data-ask-draft]"), r = p.getBoundingClientRect(), shell = document.querySelector("[data-app-shell]");
        const b = document.querySelector("[data-tiny-launch]").getBoundingClientRect();
        const leaves = [document.querySelector("[data-app-shell] main"), document.querySelector("[data-app-shell] main")?.firstElementChild].filter(Boolean).map(e => e.getBoundingClientRect().right);
        return { open: p.getAttribute("data-open"), left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, vw: innerWidth, vh: innerHeight,
          position: getComputedStyle(p).position, shellPadRight: getComputedStyle(shell).paddingRight,
          bubble: (() => { const e = document.querySelector("[data-tiny-launch]"), cs = getComputedStyle(e); return { width: e.offsetWidth, height: e.offsetHeight, right: parseFloat(cs.right), bottom: parseFloat(cs.bottom), mid: (b.left + b.right) / 2 }; })(),
          dockAsk: document.querySelector("[data-nav-dock] [data-nav-item='ask']")?.getAttribute("aria-expanded") || null,
          contentRight: Math.max(...leaves), stub: !!p.querySelector("[data-ask-draft-closed], [data-ask-input]"), html: document.documentElement.getAttribute("data-ask-open") };
      });
      out.ask.contentRightShut = contentRightShut;
      await page.screenshot({ type: "png" }).then(b => fs.writeFileSync(path.join(OUT, `dock167-ask-${size}.png`), b));
      await page.keyboard.press("Escape"); await sleep(600);
      out.askAfterEsc = await q(() => ({ open: document.querySelector("[data-ask-draft]").getAttribute("data-open"), pad: getComputedStyle(document.querySelector("[data-app-shell]")).paddingRight }));
      // the rail's own Ask draft (the board's item after the rule) opens the same Tiny card
      await q(() => document.querySelector("[data-nav-dock] [data-nav-item='ask']")?.click()); await sleep(600);
      out.askFromDock = await q(() => ({ open: document.querySelector("[data-ask-draft]").getAttribute("data-open"), expanded: document.querySelector("[data-nav-dock] [data-nav-item='ask']")?.getAttribute("aria-expanded") }));
      await page.keyboard.press("Escape"); await sleep(400);
      return { dock: out };
    } },
  // ⭐ D163 · USE THE SPACE, the other screens — measured, not compared (`--styles screens163 [route,…]`): the tracker
  // (Draft House), the settings drawer over it, Atlas, Profile, Account, Customise, Integrations, Saved answers and Admin,
  // at 1280 / 1440 / 1920 / 2560 and the phone, each by the same probe (the content group's free space either side, the
  // root's box, anything flush to an edge). Shot as docs/fidelity-shots/screens163-<route>-<width>.png.
  screens163: { sketch: null, shoot: true,
    sizes: { "1280": [1280, 800], "1440": [1440, 900], "1920": [1920, 1080], "2560": [2560, 1440], phone: [390, 844] },
    routes: {
      tracker: { app: HOME_LEDGER, fixtures: TRK, ready: LEDGER_ROW, appPrep: async () => { await sleep(600); } },
      // ⭐ 47j R2 (D163's dock gutter, re-pointed): the PLATE market, measured by the same probe as every other screen (home163,
      // the classic grid's own probe, retires with it)
      // ✅ owner 11-26 (47j, "keep it centred"): the market keeps the approved Market board's measure on a wide screen —
      // centred, the free space even on both sides — rather than 46q's fill-the-width (a named exception in d163)
      market: { app: PLATE_MARKET, fixtures: HOME156, ready: "[data-plate-market-openings] [data-fan-offset]", appPrep: async () => { await sleep(1200); },
        centredMeasure: "owner 11-26 (47j): the market keeps the approved board's measure, centred, on wide screens" },
      settings: { app: HOME_LEDGER, fixtures: TRK, ready: "[data-settings-open]", probe: { root: "[data-settings-drawer]" },
        appPrep: async (page) => { await page.click("[data-settings-open]").catch(() => {}); await page.waitForSelector("[data-fold-top]", { timeout: 8000 }).catch(() => {}); await sleep(700); } },
      // ✅ OWNER 11-26 (end of 47i, decision 2 — "go with your recs"): Atlas Volume I's region band runs from the rail to the
      // viewport's edge on purpose — the approved board's layout wins over D163's "no slab to the screen's edge". A NAMED
      // exception (the owner's word, not a threshold change): the band and what it holds leave the flush list and the edge
      // margins; everything else on the page is still held to them.
      atlas: { app: "/app/atlas", fixtures: ATLAS163, ready: "main", appPrep: async () => { await sleep(900); },
        probe: { flushExempt: [{ sel: "section.pl-at-regions", why: "owner 11-26: Atlas Volume I's full-width region band is the approved board's design" },
          // ✅ owner 11-26 (47j, "same exception"): the footer band runs rail-to-edge too, by the same approved board
          { sel: "footer.pl-at-foot", why: "owner 11-26 (47j): Atlas's footer band is the approved board's design, as the region band" }] } },
      // ⭐ D167: the settings pages are Profile's panels now (each at /app/profile/<panel>); Interview is its own place.
      profile: { app: "/app/profile/about", fixtures: PROFILE163, strict: true, ready: "main", appPrep: async () => { await sleep(900); } },
      account: { app: "/app/profile/account", fixtures: ACCOUNT163, strict: true, ready: "main", appPrep: async () => { await sleep(900); } },
      customise: { app: "/app/profile/appearance", fixtures: SETTINGS, ready: "main", appPrep: async () => { await sleep(900); } },
      integrations: { app: "/app/profile/connections", fixtures: SETTINGS, ready: "main", appPrep: async () => { await sleep(900); } },
      "saved-answers": { app: "/app/profile/answers", fixtures: SETTINGS, ready: "main", appPrep: async () => { await sleep(900); } },
      interview: { app: "/app/interview/upcoming", fixtures: { ...SETTINGS, "/api/interview/upcoming": { interviews: [] } }, ready: "[data-upcoming-empty]", appPrep: async () => { await sleep(900); } },
      admin: { app: "/admin", fixtures: { "/api/admin/auth/me": { authenticated: true, enforced: true, admin: { email: "admin@example.invalid" } },
        "/api/auth/me": { authenticated: false } }, strict: true, ready: "h1", probe: { root: "[data-admin-page]" }, appPrep: async () => { await sleep(900); } },
    } },
  // D153 (5): the facts box measured, not compared (no sketch of its own) — `--styles posting-facts` only.
  // ⭐ 47g R1: on the PLATE market — the posting opened from its Index row (which turns the openings to Deck, A240).
  // (The classic probe waited on [data-fh-title], which no client file draws, and fell through to its prep.)
  // ⭐ 47j (D199 C7 — re-pointed): a posting opens on its own SHEET, never on the deck; the facts are the sheet's glance strip
  // (pay · type · level · stack you have), measured the same way — no word broken, cells wrap rather than squeeze.
  "posting-facts": { sketch: null, app: PLATE_MARKET, fixtures: FACTS, ready: "[data-plate-market-openings]",
    appPrep: async (page) => { await openSheetFromIndex(page, "Senior Data Engineer"); await sleep(900); } },
  settings: { sketch: "settings-declutter.html", app: HOME_LEDGER, fixtures: SETTINGS, ready: "[data-settings-open]",
    appPrep: async (page) => { await page.click("[data-settings-open]").catch(() => {}); await page.waitForSelector("[data-fold-top]", { timeout: 8000 }).catch(() => {}); await sleep(600); },
    // ⭐ D149 settings: --styles opens the drawer first too; and the comparison that matters is the DRAWER (the page behind
    // it is a stand-in in the sketch) — its 520 px at the right edge on a computer, the whole screen on a phone.
    stylesWithPrep: true, region: ([w, h]) => (w >= 520 ? [w - 520, 0, 520, h] : null) },
  // ⛔ 47j R3 (w1-retire): tracker · tracker-open · tracker-timeline (the classic table against tracker-options.html) retired
};

// ⚠ D149 · THE SELF-HOSTED FONTS IN A GIT WORKTREE. A worktree's node_modules is a junction to the main checkout, so
// vite serves @fontsource's files as /@fs/<main checkout>/… and refuses them (403: outside its fs.allow). The app then
// draws in the fallback faces (measured 11-03: Instrument Serif and Inter Tight not loaded, the title 25% wider) and
// every comparison is off. The browser is handed the same file from disk instead — in the main checkout vite serves it.
function selfHostedFont(u, req) {
  if (!u.pathname.startsWith("/@fs/") || !/\.(woff2?|ttf)$/.test(u.pathname)) return false;
  const file = decodeURIComponent(u.pathname.slice(4).replace(/^\/([A-Za-z]:)/, "$1"));
  if (!fs.existsSync(file)) return false;
  req.respond({ status: 200, contentType: file.endsWith(".woff") ? "font/woff" : file.endsWith(".ttf") ? "font/ttf" : "font/woff2",
    headers: { "Access-Control-Allow-Origin": "*" }, body: fs.readFileSync(file) });
  return true;
}

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(ROOT, "client", "node_modules", "vite", "bin", "vite.js"), "--port", String(PORT), "--strictPort"],
      { cwd: path.join(ROOT, "client"), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const onData = (b) => { out += b.toString(); if (out.includes(String(PORT))) resolve({ proc, url: `http://localhost:${PORT}` }); };
    proc.stdout.on("data", onData); proc.stderr.on("data", onData);
    proc.on("error", reject);
    setTimeout(() => reject(new Error(`vite did not start:\n${out.slice(-600)}`)), 60000);
  });
}

async function shoot(browser, url, [w, h], { fixtures = null, prep = null, ready = null, hide = null } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  if (process.argv[2] === "--look") page.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 600)}`); });   // 47h: the look reports what React logged
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "reduce" }]);
  if (fixtures) {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const raw = req.url();
      if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: "" });
      const u = new URL(raw);
      if (selfHostedFont(u, req)) return;
      if (!u.pathname.startsWith("/api/")) return req.continue();
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(fixtures[u.pathname] ?? COMMON[u.pathname] ?? {}) });
    });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem("draft-theme", "dusk-dark"); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} });
  }
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 }).catch((e) => { if (process.argv[2] === "--look") errors.push(`goto: ${e.message}`); });
  await page.evaluateHandle("document.fonts.ready").catch(() => {});
  if (ready) await page.waitForSelector(ready, { timeout: 30000 }).catch(() => {});
  if (hide) await page.addStyleTag({ content: `${hide}{display:none !important}` });
  await sleep(900);
  if (prep) await prep(page);
  const buf = await page.screenshot({ type: "png" });
  await page.close();
  return { buf, errors };
}

/** Similarity + the worst regions + the side-by-side, computed on a canvas in Chrome. */
async function compare(browser, a, b) {
  const page = await browser.newPage();
  const res = await page.evaluate(async (A, B) => {
    const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([img(A), img(B)]);
    const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
    const px = (i) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = px(ia), db = px(ib);
    const G = 8, cells = Array.from({ length: G * G }, () => [0, 0]);
    let same = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      const ok = d <= 48;
      if (ok) same++;
      const c = cells[Math.min(G - 1, Math.floor(y / h * G)) * G + Math.min(G - 1, Math.floor(x / w * G))];
      c[0]++; if (!ok) c[1]++;
    }
    const regions = cells.map(([n, bad], k) => ({ row: Math.floor(k / G), col: k % G, diff: +(bad / n).toFixed(3) }))
      .filter(r => r.diff > 0.05).sort((p, q) => q.diff - p.diff).slice(0, 6);
    // Side by side: the sketch left, the app right, the worst regions outlined on the app.
    const gap = 24, c = document.createElement("canvas"); c.width = w * 2 + gap; c.height = h + 40;
    const x = c.getContext("2d");
    x.fillStyle = "#111"; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#ddd"; x.font = "600 18px system-ui"; x.fillText("SKETCH", 12, 26); x.fillText("APP", w + gap + 12, 26);
    x.drawImage(ia, 0, 40); x.drawImage(ib, w + gap, 40);
    x.strokeStyle = "#ff3b6b"; x.lineWidth = 3;
    for (const r of regions) x.strokeRect(w + gap + r.col * w / G, 40 + r.row * h / G, w / G, h / G);
    return { score: +(same / (w * h)).toFixed(4), regions, side: c.toDataURL("image/png") };
  }, `data:image/png;base64,${a.toString("base64")}`, `data:image/png;base64,${b.toString("base64")}`);
  await page.close();
  return res;
}

// ── ⭐ D149 settings · A REGION of a screen (a screen's `region([w, h])` → [x, y, w, h], or null for the whole shot):
// both shots cropped to it, compared like the whole, and written as <screen>-region-side-<size>.png + the report key
// <screen>-region-<size>. The settings drawer uses it: the sketch's page behind the drawer is a stand-in.
async function cropPng(browser, buf, [x, y, w, h]) {
  const page = await browser.newPage();
  const out = await page.evaluate(async (src, X, Y, W, H) => {
    const i = await new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; });
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    c.getContext("2d").drawImage(i, X, Y, W, H, 0, 0, W, H);
    return c.toDataURL("image/png");
  }, `data:image/png;base64,${buf.toString("base64")}`, x, y, w, h);
  await page.close();
  return Buffer.from(out.split(",")[1], "base64");
}
async function compareRegion(browser, id, s, size, dims, skBuf, apBuf, report) {
  const clip = s.region(dims) || [0, 0, dims[0], dims[1]];
  const cmp = await compare(browser, await cropPng(browser, skBuf, clip), await cropPng(browser, apBuf, clip));
  fs.writeFileSync(path.join(OUT, `${id}-region-side-${size}.png`), Buffer.from(cmp.side.split(",")[1], "base64"));
  report[`${id}-region-${size}`] = { sketch: s.sketch, app: s.app, region: clip, similarity: cmp.score, worstRegions: cmp.regions, at: new Date().toISOString() };
  console.log(`${id} ${size} region [${clip.join(", ")}]: similarity ${(cmp.score * 100).toFixed(1)}% · worst cells ${cmp.regions.map(r => `r${r.row}c${r.col} ${(r.diff * 100).toFixed(0)}%`).join(", ") || "none"}`);
}

// ── --styles <screen>: the app screen's COMPUTED styles as JSON (test/fidelity.test.js asserts them against the sketch).
// ⭐ A201 (46k): what "garbled when shrunken" means, measured on the page — run in the page by the shrink201 screen.
//   sideScroll   the page scrolls sideways
//   past         a box drawn past the viewport (not fixed, not inside a scroller / clipper that itself fits)
//   overlaps     words drawn over other words (text-node boxes, not element boxes; fixed layers compared among themselves)
//   squeezed     a run of words broken to about a word a line (a column squeezed to nothing)
//   unreachable  a control clipped out of its box, or drawn under 6 px
function SHRINK_PROBE() {
  const de = document.documentElement, vw = de.clientWidth;
  const vis = (e) => { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = (e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}.${String(e.className?.baseVal ?? e.className ?? "").trim().split(/\s+/)[0] || ""}${[...e.attributes].filter(a => a.name.startsWith("data-")).slice(0, 1).map(a => `[${a.name}]`).join("")}`;
  const clipper = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) || s.position === "fixed") return p; } return null; };
  const inAsk = (e) => !!e.closest("[data-ask-draft]");
  // the layer a box is drawn in: its nearest fixed ancestor (a sheet, a drawer, a dialog) or the page
  const layerOf = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === "fixed") return p; return document.body; };
  // read by a screen reader only (clipped to a pixel) — never drawn
  const srOnly = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); const r = p.getBoundingClientRect();
    if ((s.clip && s.clip !== "auto") || /inset\(50%/.test(s.clipPath) || (s.position === "absolute" && r.width <= 2 && r.height <= 2)) return true; } return false; };
  const all = [...document.querySelectorAll("body *")].filter(e => !e.closest("svg") && !e.closest("[aria-hidden='true']") && vis(e));
  const shown = new Set(all);
  const past = all.filter(e => {
    const r = e.getBoundingClientRect(); if (r.right <= vw + 1 && r.left >= -1) return false;
    if (getComputedStyle(e).position === "fixed" || inAsk(e)) return false;
    const c = clipper(e); if (c) { const cr = c.getBoundingClientRect(); if (cr.right <= vw + 1 && cr.left >= -1) return false; }
    return true;
  });
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); const el = n.parentElement;
    if (!t || !el || !shown.has(el)) continue;
    if (el.closest("[data-nav-dock], [role='tooltip'], .dbx__tip, script, style, noscript")) continue;
    // a text clipped away by its own box (an ellipsis, a scroller) is not drawn where the range says
    if (srOnly(el)) continue;
    const own = /(hidden|clip)/.test(getComputedStyle(el).overflowX) ? el : null;   // an ellipsis: drawn only inside its own box
    const c = own || clipper(el); const cr = c && c.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(n);
    for (const b0 of range.getClientRects()) {
      let b = { left: b0.left, right: b0.right, top: b0.top, bottom: b0.bottom, width: b0.width, height: b0.height };
      if (cr) { b.left = Math.max(b.left, cr.left); b.right = Math.min(b.right, cr.right); b.top = Math.max(b.top, cr.top); b.bottom = Math.min(b.bottom, cr.bottom); b.width = b.right - b.left; b.height = b.bottom - b.top; }
      if (b.width > 1 && b.height > 1) texts.push({ el, b, t: t.slice(0, 24), layer: layerOf(el) });
    }
  }
  const overlaps = [];
  for (let i = 0; i < texts.length && overlaps.length < 8; i++) for (let j = i + 1; j < texts.length && overlaps.length < 8; j++) {
    const A = texts[i], B = texts[j]; if (A.el === B.el || A.layer !== B.layer || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const w = Math.min(A.b.right, B.b.right) - Math.max(A.b.left, B.b.left), h = Math.min(A.b.bottom, B.b.bottom) - Math.max(A.b.top, B.b.top);
    if (w > 3 && h > Math.min(A.b.height, B.b.height) * 0.4) overlaps.push(`"${A.t}" x "${B.t}" (${name(A.el)} / ${name(B.el)})`);
  }
  const squeezed = [...new Set(texts.map(x => x.el))].filter(el => {
    const t = el.textContent.trim(); if (t.length < 14 || t.split(/\s+/).length < 3 || el.children.length) return false;
    const r = el.getBoundingClientRect(), fs = parseFloat(getComputedStyle(el).fontSize) || 14;
    return r.width < fs * 4.5 && r.height > fs * 3.5;
  }).slice(0, 6).map(el => `${name(el)} "${el.textContent.trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}px`);
  const unreachable = all.filter(e => e.matches("button, a[href], input:not([type=hidden]):not([type=file]), select, textarea") && !inAsk(e)).filter(e => {
    const r = e.getBoundingClientRect(); if (getComputedStyle(e).position === "fixed") return r.right > vw + 1 || r.left < -1;
    const c = clipper(e); if (c && !/(auto|scroll)/.test(getComputedStyle(c).overflowX)) { const cr = c.getBoundingClientRect(); if (r.left >= cr.right - 1 || r.right <= cr.left + 1) return true; }
    return r.width < 6 || r.height < 6;
  }).slice(0, 6).map(e => `${name(e)} "${(e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20)}"`);
  // 46k: a page that never drew (a stylesheet that does not compile shows Vite's overlay) has nothing to flag — say so
  const rendered = !document.querySelector("vite-error-overlay") && (document.body.innerText || "").trim().length > 40;
  return { rendered, vw, sideScroll: de.scrollWidth > vw + 1, scrollW: de.scrollWidth,
    past: past.slice(0, 6).map(e => `${name(e)} ${Math.round(e.getBoundingClientRect().left)}->${Math.round(e.getBoundingClientRect().right)}`),
    overlaps, squeezed, unreachable };
}

const STYLE_PROBES = {
  // ⭐ D149 · the settings drawer (settings-declutter.html): the drawer, the title, the mode, a fold's line; then it opens
  // When, How many, Which jobs and Before sending in turn and reads the time chip, the stepper, the eyebrow, the
  // headline, a switch on and off, Done and Pause.
  settings: async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const cs = (el, pseudo) => (el ? getComputedStyle(el, pseudo) : null);
    const q = (sel) => document.querySelector(sel);
    const box = (el) => { const r = el?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; };
    const open = async (id) => { q(`[data-fold-top="${id}"]`)?.click(); await wait(250); return q(`[data-settings-group="${id}"] .dh-fold2__body`); };
    const d = q("[data-settings-drawer]");
    const title = q("#dh-settings-title");
    const close = q("[data-settings-close]");
    const [ask, auto] = [...document.querySelectorAll("[data-settings-mode] button")];
    const fold = q('[data-settings-group="when"]');
    const top = q('[data-fold-top="when"]');
    const out = {
      drawer: d && { bg: cs(d).backgroundColor, radius: cs(d).borderTopLeftRadius, width: box(d).w, borderLeft: `${cs(d).borderLeftWidth} ${cs(d).borderLeftColor}`,
                     padding: cs(d).padding, shadow: cs(d).boxShadow, family: cs(d).fontFamily, size: cs(d).fontSize, lineHeight: cs(d).lineHeight },
      footer: !!d?.querySelector("footer"), checkboxes: d ? d.querySelectorAll('input[type="checkbox"], input[type="radio"]').length : -1,
      title: title && { family: cs(title).fontFamily, size: cs(title).fontSize, weight: cs(title).fontWeight, letter: cs(title).letterSpacing, w: box(title).w,
                        faces: [...document.fonts].filter(f => /Instrument/.test(f.family)).map(f => `${f.style}:${f.weight}:${f.status}:${f.unicodeRange.slice(0, 20)}`) },
      close: close && { bg: cs(close).backgroundColor, radius: cs(close).borderTopLeftRadius, border: `${cs(close).borderTopWidth} ${cs(close).borderTopColor}`, size: cs(close).fontSize, weight: cs(close).fontWeight, padding: cs(close).padding },
      mode: ask && { bg: cs(auto).backgroundColor, radius: cs(ask).borderTopLeftRadius, padding: cs(ask).padding, border: cs(auto).borderTopWidth,
                     pressedOutline: `${cs(ask).outlineWidth} ${cs(ask).outlineStyle} ${cs(ask).outlineColor}`, restOutline: cs(auto).outlineStyle,
                     bSize: cs(ask.querySelector("b")).fontSize, bWeight: cs(ask.querySelector("b")).fontWeight, bPressed: cs(ask.querySelector("b")).color, bRest: cs(auto.querySelector("b")).color,
                     spanSize: cs(ask.querySelector("span")).fontSize, spanColor: cs(ask.querySelector("span")).color },
      fold: fold && { bg: cs(fold).backgroundColor, radius: cs(fold).borderTopLeftRadius, border: cs(fold).borderTopWidth, marginTop: cs(fold).marginTop,
                      padding: cs(top).padding, bSize: cs(top.querySelector("b")).fontSize, bWeight: cs(top.querySelector("b")).fontWeight,
                      valueColor: cs(top.querySelector("span")).color, valueSize: cs(top.querySelector("span")).fontSize },
      limits: q("[data-caps-used] summary")?.textContent.trim() || null,
    };
    const when = await open("when");
    const chip = when?.querySelector(".dh-time"), add = when?.querySelector(".dh-time-add");
    out.when = when && { bodyPadding: cs(when).padding, chipBg: cs(chip).backgroundColor, chipRadius: cs(chip).borderTopLeftRadius, chipPadding: cs(chip).padding, chipWeight: cs(chip).fontWeight,
                         addBorder: `${cs(add).borderTopWidth} ${cs(add).borderTopStyle}`, addRadius: cs(add).borderTopLeftRadius };
    const hm = await open("howmany");
    const step = hm?.querySelector(".dh-stepper button"), n = hm?.querySelector(".dh-stepper b");
    out.howmany = hm && { btn: box(step), btnRadius: cs(step).borderTopLeftRadius, btnBg: cs(step).backgroundColor, nSize: cs(n).fontSize, nWeight: cs(n).fontWeight, nColor: cs(n).color };
    const jobs = await open("jobs");
    const eb = jobs?.querySelector(".dh-fold2__eyebrow"), h = jobs?.querySelector(".dh-fold2__h"), tg = jobs?.querySelectorAll(".dh-tg")[1];
    const on = jobs?.querySelector('.dh-swb[aria-checked="true"]');
    const done = jobs?.querySelector("[data-fold-done]");
    out.jobs = jobs && { eyebrow: !!eb, /* 45s: D182 (45n) removed the fold eyebrow that repeated its title */ hFamily: cs(h).fontFamily, hSize: cs(h).fontSize, hWeight: cs(h).fontWeight, hLetter: cs(h).letterSpacing, hLine: cs(h).lineHeight,
                         rowPadding: cs(tg).padding, rowBorder: `${cs(tg).borderTopWidth} ${cs(tg).borderTopColor}`, smallColor: cs(tg.querySelector("small")).color, smallSize: cs(tg.querySelector("small")).fontSize,
                         switchOn: on && { role: on.getAttribute("role"), tag: on.tagName, box: box(on), radius: cs(on).borderTopLeftRadius, bg: cs(on).backgroundColor, knobBg: cs(on, "::after").backgroundColor, knobLeft: cs(on, "::after").left, knobSize: cs(on, "::after").width },
                         done: done && { bg: cs(done).backgroundImage, color: cs(done).color, radius: cs(done).borderTopLeftRadius, padding: cs(done).padding, weight: cs(done).fontWeight } };
    const before = await open("before");
    const off = before?.querySelector('.dh-swb[aria-checked="false"]');
    out.before = before && { switchOff: off && { bg: cs(off).backgroundColor, knobBg: cs(off, "::after").backgroundColor, knobLeft: cs(off, "::after").left } };
    const pausing = await open("pausing");
    const pb = pausing?.querySelector("[data-pause-now]");
    out.pausing = pb && { width: box(pb).w, parent: Math.round(pb.parentElement.getBoundingClientRect().width - parseFloat(cs(pb.parentElement).paddingLeft) - parseFloat(cs(pb.parentElement).paddingRight)),
                          border: `${cs(pb).borderTopWidth} ${cs(pb).borderTopColor}`, bg: cs(pb).backgroundColor, radius: cs(pb).borderTopLeftRadius, padding: cs(pb).padding };
    return out;
  },
  // ⛔ 47j R3 (w1-retire): the classic tracker's computed-styles reader (`tracker`) is retired with its page
  // ⭐ D163 · USE THE SPACE, the other screens — ONE probe for every screen (`--styles screens163 [tracker,atlas,…]`):
  // the screen's content group (the union of what is DRAWN inside its root — leaves, and boxes with their own background
  // or border, so an empty container does not count as content), the free space left of it (from the dock's right edge,
  // or the viewport's left edge where a screen has no dock — Admin) and right of it, the root's own box, anything within
  // 8 px of an edge, and whether the page scrolls sideways.
  screens163: async (arg) => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const q = (s, root = document) => root.querySelector(s);
    const qa = (s, root = document) => [...root.querySelectorAll(s)];
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }; };
    const union = (bs) => bs.filter(Boolean).reduce((u, b) => u ? { left: Math.min(u.left, b.left), top: Math.min(u.top, b.top), right: Math.max(u.right, b.right), bottom: Math.max(u.bottom, b.bottom) } : { ...b }, null);
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    await wait(300);
    const root = q(arg?.root || "main");
    if (!root) return { vw, vh, missing: arg?.root || "main" };
    const visible = (e) => { for (let p = e; p && p !== root.parentElement; p = p.parentElement) { const cs = getComputedStyle(p); if (Number(cs.opacity) === 0 || cs.visibility === "hidden" || cs.display === "none") return false; } const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
    const canvas = ["[data-app-shell]", "#root", "body", "html"].map(sel => q(sel)).filter(Boolean).map(e => getComputedStyle(e).backgroundColor)
      .find(c => c !== "rgba(0, 0, 0, 0)" && c !== "transparent") || null;
    // ⭐ 47j: a plate page's root (PlateRoot, `.plate`, the outermost inside the screen's root) is the PAGE's ground — its paper
    // fills the content column by design — so it is canvas, never a slab (Atlas's Volume I measured `div.plate 98–1280`)
    const ground = root.querySelector(".plate") || null;   // the outermost plate root inside the screen (first in document order)
    const groundBg = ground ? getComputedStyle(ground).backgroundColor : null;
    const drawn = (e) => {
      if (e.children.length === 0 || e.matches("svg, img, canvas, input, textarea, select, button, hr")) return !e.closest("svg *");
      if (e === ground) return false;
      const cs = getComputedStyle(e);
      const bg = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent" && cs.backgroundColor !== canvas && cs.backgroundColor !== groundBg;
      const border = ["Top", "Right", "Bottom", "Left"].some(s => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none");
      return (bg || border) && e !== root;
    };
    const ink = (e) => {
      if (e.children.length || !e.textContent.trim() || e.matches("input, textarea, select, button")) return box(e);
      const cs = getComputedStyle(e);
      const painted = (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== canvas) || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderTopWidth) > 0;
      if (painted) return box(e);
      const r = document.createRange(); r.selectNodeContents(e); const t = r.getBoundingClientRect();
      return t.width > 0 ? { left: Math.round(t.left), top: Math.round(t.top), right: Math.round(t.right), bottom: Math.round(t.bottom), width: Math.round(t.width), height: Math.round(t.height) } : null;
    };
    const dockEl = q("[data-nav-dock]");
    const dock = dockEl && visible(dockEl) ? box(dockEl) : null;
    // ⭐ D167 (the dock goes where the space is): free space from the VIEWPORT's edges; nothing within 8 px of a SIDE dock.
    const place = document.documentElement.getAttribute("data-dock-place");
    const dockRight = place === "side" && dock ? dock.right : 0;
    const els = qa("*", root).filter(e => !e.closest("[data-nav-dock]") && getComputedStyle(e).position !== "fixed" && drawn(e) && visible(e))
      .map(e => ({ e, b: ink(e) })).filter(({ b }) => b && b.top < vh && b.bottom > 0);
    const g = union(els.map(x => x.b));
    const leaves = union(els.filter(({ e }) => e.children.length === 0 || e.matches("svg, img, canvas, input, textarea, select, button")).map(x => x.b));
    // owner-named exceptions (arg.flushExempt — each with its reason): out of the flush list and the edge margins only
    const exemptSels = (arg?.flushExempt || []).map(x => x.sel);
    const exempt = (e) => exemptSels.some(s => e.closest(s));
    const held = els.filter(({ e }) => !exempt(e));
    const gHeld = union(held.map(x => x.b));
    const flush = held.filter(({ b }) => b.left < dockRight + 8 || b.right > vw - 8).slice(0, 6)
      .map(({ e, b }) => `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).split(" ")[0]} ${b.left}–${b.right}`);
    const rb = box(root);
    // ⭐ D197 #1 · A237: beside the rail the free space is measured from the content column's left edge (the shell's 98 px)
    const shellEl = q("[data-app-shell]");
    const colLeft = place === "side" && shellEl ? parseFloat(getComputedStyle(shellEl).paddingLeft) || 0 : 0;
    return { vw, vh, dock, place, colLeft, root: rb, group: g,
      leftFree: g ? g.left - colLeft : null, rightFree: g ? vw - g.right : null,
      rootLeftFree: rb ? rb.left - colLeft : null, rootRightFree: rb ? vw - rb.right : null,
      leaves, insetL: leaves && rb ? leaves.left - rb.left : null, insetR: leaves && rb ? rb.right - leaves.right : null,
      dockMid: dock ? (dock.top + dock.bottom) / 2 : null,
      flush, sideScroll: document.documentElement.scrollWidth > vw + 1,
      exempted: exemptSels.filter(s => q(s, root)), edgeLeftFree: gHeld ? gHeld.left - colLeft : null, edgeRightFree: gHeld ? vw - gHeld.right : null };
  },
  // ⭐ D167: the dock is measured by its nodeProbe (a real pointer); the page-side probe only says where it ran.
  dock167: () => ({ vw: window.innerWidth, vh: window.innerHeight }),
  dock167place: () => ({ vw: window.innerWidth, vh: window.innerHeight }),
  ask200: () => ({ vw: window.innerWidth, vh: window.innerHeight }),
  shrink201: () => ({}),
  // ⭐ D168 · ONE WAY TO OPEN, on the D199 market (47j, re-pointed — D199 C7): the deck's title and an Index row open the
  // OPENING SHEET (/app/jobs/<id>, over the market); Back (Esc) returns to the same card, tab and scroll. Measured: the open
  // and Back from the deck and from an Index row, fifty fast presses and Backs, then ten slower ones.
  home168: async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const q = (s) => document.querySelector(s);
    const sheetUp = () => !!q("[data-opening-over]");
    const press = () => { if (!sheetUp()) q('[data-fan-offset="0"] [data-deck-title-line]')?.click(); };   // under the sheet no pointer reaches the card
    const esc = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const until = async (fn, ms = 6000) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await wait(30); return fn(); };
    const tab = () => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => t.getAttribute("aria-selected") === "true")?.textContent.trim() || null;
    const state = () => ({ open: sheetUp(), sheets: document.querySelectorAll("[data-opening-over]").length, path: location.pathname, search: location.search,
      atSheet: /^\/app\/jobs\/[^/]+$/.test(location.pathname), glance: !!q("[data-opening-over] .pl-op__glance"),
      count: q("[data-deck-count]")?.textContent || null, y: Math.round(window.scrollY), deck: !!q('[data-fan-offset="0"] article'), tab: tab() });
    q("[data-deck-stage]")?.scrollIntoView({ block: "center" });
    await wait(600);
    const out = { vw: window.innerWidth };
    // ── the deck: open, then Back
    const before = state();
    press(); await until(() => !!q("[data-opening-over] .pl-op__glance"));
    const opened = state();
    esc(); await until(() => !sheetUp()); await wait(300);
    out.deck = { before, opened, back: state() };
    // ── an Index row: the same sheet, and Back to the Index, where it was
    [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /index/i.test(t.textContent))?.click();
    await until(() => !!q("[data-market-index] [data-index-title]"), 10000); await wait(150);
    q("[data-market-index]")?.scrollIntoView({ block: "start" }); await wait(300);
    const rowBefore = state();
    q("[data-market-index] [data-index-title]")?.click(); await until(() => !!q("[data-opening-over] .pl-op__glance"));
    const rowOpened = state();
    esc(); await until(() => !sheetUp()); await wait(300);
    out.row = { before: rowBefore, opened: rowOpened, back: state() };
    [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /deck/i.test(t.textContent))?.click(); await wait(500);
    q("[data-deck-stage]")?.scrollIntoView({ block: "center" }); await wait(300);
    // ── d168NeverStuck: fifty presses and Backs, fast (0–40 ms apart), then settle; then ten slower ones, each checked
    const start = state();
    for (let n = 0; n < 50; n++) { if (n % 2 === 0) press(); else esc(); await wait((n * 7) % 41); }
    await wait(1500);
    out.fast = state();
    if (sheetUp()) { esc(); await until(() => !sheetUp()); await wait(300); }
    out.fastBack = state();
    out.slow = [];
    for (let n = 0; n < 10; n++) {
      if (n % 2 === 0) press(); else esc();
      await until(() => sheetUp() === (n % 2 === 0) && (n % 2 === 1 || !!q("[data-opening-over] .pl-op__glance")), 4000); await wait(200);
      out.slow.push({ wantOpen: n % 2 === 0, ...state() });
    }
    out.start = start;
    return out;
  },
  // ⭐ 47j R2: home156's measuring, now plate156's own (the classic `home156` screen retired with the classic market). Its
  // `cfg.plate` false branches measured the classic grid and no longer run.
  plate156: async (cfg) => {   // cfg.plate = the plate market — its open is the title, its bubbles the Index rows
    const wait =(ms) => new Promise(r => setTimeout(r, ms));
    const q = (s, root = document) => root.querySelector(s);
    const qa = (s, root = document) => [...root.querySelectorAll(s)];
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }; };
    const overlap = (a, b) => !!a && !!b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const hOverlap = (a, b) => !!a && !!b && a.left < b.right - 1 && b.left < a.right - 1;
    const rgb = (v) => { const d = document.createElement("i"); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    const accent = rgb(getComputedStyle(document.documentElement).getPropertyValue("--c-accent").trim());
    const out = { vw: window.innerWidth };
    await wait(600);

    // ── the card
    const front = () => q('[data-fan-offset="0"] article');
    const article = front();
    const face = q("[data-deck-face]", article);
    const scrollers = article ? qa("*", article).filter(e => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1; }).length : -1;
    const title = q("[data-deck-face] h2", article);
    const tcs = title && getComputedStyle(title);
    const statEls = qa("[data-deck-face] [data-deck-stat]", article);
    out.card = {
      box: box(article), orientation: face?.getAttribute("data-deck-home-face") || null,
      faceOverflows: !!face && face.scrollHeight > face.clientHeight + 1, articleOverflowY: article && getComputedStyle(article).overflowY,
      scrollers, titleClamp: tcs && tcs.webkitLineClamp, titleLines: title ? Math.round(title.getBoundingClientRect().height / parseFloat(tcs.lineHeight)) : null,
      stats: statEls.map(e => ({ key: e.getAttribute("data-deck-stat"), value: q("dd", e)?.textContent, label: q("dt", e)?.textContent,
        valueSize: getComputedStyle(q("dd", e)).fontSize, labelSize: getComputedStyle(q("dt", e)).fontSize, inside: (() => { const b = box(e), a = box(article); return b.top >= a.top && b.bottom <= a.bottom && b.left >= a.left && b.right <= a.right; })() })),
      reason: !!q("[data-deck-reason]"), why: !!q("[data-deck-why-button]"), openPosting: q("[data-deck-open-posting]", article)?.textContent?.trim() || null,
      openInside: (() => { const b = box(q("[data-deck-open-posting]", article)), a = box(article); return !!b && b.bottom <= a.bottom; })(),
    };
    // grow attempt: a wheel over the card must never lengthen it (and the page must not scroll under it)
    const h0 = article?.getBoundingClientRect().height, y0 = window.scrollY;

    // ── the buttons and the fan, at rest and scrolled
    const acts = () => box(q("[data-deck-actions]"));
    out.buttons = { rest: { acts: acts(), card: box(article), over: overlap(acts(), box(article)) }, position: getComputedStyle(q("[data-deck-actions]")).position };
    const shown = () => qa("[data-fan-offset]").filter(e => Number(e.getAttribute("data-fan-offset")) > 0)
      .map(e => q("[data-fan-position]", e)).filter(e => Number(getComputedStyle(e).opacity) > 0).map(box);
    out.fan = { backs: shown(), coverButtons: shown().some(b => overlap(b, acts())), deckCol: box(q("[data-home-deck]")),
      outside: shown().some(b => b.right > box(q("[data-home-deck]")).right + 1) };

    // ── the deck and the list never overlap, at any scroll position
    const scrolls = [];
    for (const y of [0, 200, 500, 900, 1400]) {
      window.scrollTo(0, y); await wait(120);
      const deck = box(q("[data-home-deck]")), list = box(q(".jb-board__list")), bar = box(q("[data-board-sticky]"));
      const deckInner = box(q("[data-deck-home]"));
      scrolls.push({ y: Math.round(window.scrollY), deckVsList: overlap(deckInner, list), deckColVsList: hOverlap(deck, list) && overlap(deck, list),
        deckVsBar: overlap(deckInner, bar), buttonsOverCard: overlap(acts(), box(article)) });
    }
    window.scrollTo(0, 0); await wait(150);
    out.scrolls = scrolls;

    // ── ⭐ D156 (1c) the turn, AS THE DECK ALWAYS HAD IT: the wheel accumulates to 60 for one card and settles 140 ms (one
    // flick, one card); J / K and ‹ › do the same. (← → decide — not pressed here.)
    const idx = () => (q("[data-deck-count]")?.textContent.match(/^(\d+) of/i) || [])[1] * 1;   // 47g R1: the plate's line is "2 OF 10 TODAY"
    const stage = q("[data-deck-stage]");
    const wheel = (el, dy, dx = 0) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new WheelEvent("wheel", { deltaY: dy, deltaX: dx, deltaMode: 0, bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.top + 20 })); };
    const yWheel = window.scrollY;   // 47g R1: the page's y AT the wheel (the plate's deck is below the hero; y0 predates the scroll steps)
    const flip = { start: idx() };
    wheel(stage, 30); await wait(20); flip.afterHalfFlick = idx();
    wheel(stage, 30); await wait(20); flip.afterOneFlick = idx();
    wheel(stage, 60); await wait(20); flip.duringSettle = idx();
    await wait(200); wheel(stage, 60); await wait(60); flip.afterSecondFlick = idx();
    await wait(200); wheel(stage, 0, -60); await wait(60); flip.afterSidewaysBack = idx();
    flip.pageScrolledByWheel = Math.round(window.scrollY - yWheel);
    flip.cardHeightAfterWheel = Math.round(front()?.getBoundingClientRect().height);
    flip.cardHeightBefore = Math.round(h0);
    document.body.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true })); await wait(80); flip.afterK = idx();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true })); await wait(80); flip.afterJ = idx();
    q('[data-deck-flip="next"]')?.click(); await wait(80); flip.afterNextButton = idx();
    q('[data-deck-flip="prev"]')?.click(); await wait(80); flip.afterPrevButton = idx();
    flip.prevKeys = q('[data-deck-flip="prev"]')?.getAttribute("aria-keyshortcuts") || null;
    const tf = q('[data-fan-offset="0"] [data-flip]');
    flip.flipTransition = tf ? tf.style.transition : null;   // "none" under reduced motion — the source carries 520 ms
    out.flip = flip;
    while (idx() > 1) { q('[data-deck-flip="prev"]')?.click(); await wait(60); }

    // ── ⭐ D156 (1c) the card BECOMES THE LONG POST: a press on the front card opens the posting in the deck's slot
    // (the fan put away, the column no longer sticky); Esc or "Fold it back" folds it; Enter and "Open the posting" open
    // it too; a bubble's posting opens on the deck as well, and the list beside it stays.
    // ⭐ D168 (owner 11-06, concept B): the wheel never opens or folds — a scroll down on the front card TURNS the deck
    // (one card), a scroll up on the open post scrolls the page and leaves it open.
    const slot = () => q("[data-deck-post-slot]");
    const slotOpen = () => slot()?.getAttribute("data-open") === "true" && !!q("[data-deck-post-slot] [data-jd-panel]");
    const waitFor = async (fn, ms = 2500) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await wait(50); } return !!fn(); };
    const frontTitle = () => q('[data-fan-offset="0"] [data-deck-title-line]')?.textContent || null;
    const post = { title: frontTitle() };
    const press = () => q('[data-fan-offset="0"] [data-deck-title-line]')?.click();
    if (cfg?.plate) {
      // ⭐ 47j (D199 C7 — re-pointed): on the plate market a posting opens on its OWN SHEET (/app/jobs/<id>, drawn over the
      // market, which stays mounted) at every width — the deck's title, Enter and an Index row; Esc and "← Back to the
      // market" return to the same card; the wheel never opens or closes it; the sheet's Pass decides the deck's card.
      const sheetUp = () => !!q("[data-opening-over] .pl-op__glance");
      const gone = () => !q("[data-opening-over]");
      const esc = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      const tabSel = () => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => t.getAttribute("aria-selected") === "true")?.textContent.trim() || null;
      const toTab = (re) => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => re.test(t.textContent))?.click();
      wheel(q('[data-fan-offset="0"] [data-deck-face]'), 80); await wait(400);
      post.wheelOpened = !gone(); post.wheelTurned = frontTitle() !== post.title;
      while (idx() > 1) { q('[data-deck-flip="prev"]')?.click(); await wait(300); }
      press(); post.openedByPress = await waitFor(sheetUp, 8000);
      post.path = location.pathname;
      post.sheetTitle = (q("[data-opening-over] #op-title")?.textContent || "").replace(/\.$/, "") || null;
      post.over = !!q("[data-opening-over]") && getComputedStyle(q("[data-opening-over]")).position === "fixed";
      post.marketBelow = !!q('[data-fan-offset="0"] article');
      wheel(q("[data-opening-over]"), -80); await wait(500); post.wheelClosed = gone();
      esc(); post.closedByEsc = await waitFor(gone);
      post.backTo = frontTitle(); post.backPath = location.pathname;
      document.body.focus();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); post.openedByEnter = await waitFor(sheetUp, 8000);
      q("[data-opening-over] [data-opening-back]")?.click(); post.closedByBack = await waitFor(gone);
      // an Index row: the same sheet; Back returns to the Index
      toTab(/index/i); await waitFor(() => !!q("[data-market-index] [data-index-title]"), 10000); await wait(150);
      for (let i = 0; i < 4 && !sheetUp(); i++) { q("[data-market-index] [data-index-title]")?.click(); if (await waitFor(sheetUp, 2500)) break; }
      post.listOpensSheet = sheetUp(); post.listPath = location.pathname;
      esc(); await waitFor(gone); await wait(200);
      post.listBackTab = tabSel();
      toTab(/deck/i); await wait(400);
      window.scrollTo(0, 0); await wait(150);
      // the sheet's Pass: the board's own decide (boardDecide) on the deck's card, then Back; the next card comes to the front
      // (the count line reads "1 OF 746 · PAGE 1" on a board page before and after — the front card's title is what moves)
      const before = frontTitle();
      press(); await waitFor(sheetUp, 8000);
      q('[data-opening-actions] [data-deck-action="pass"]')?.click();
      post.passCloses = await waitFor(gone, 4000);
      await wait(700);
      post.passAdvanced = frontTitle() !== before;
      post.frontAfterPass = frontTitle();
      post.passSaid = qa('[aria-live="polite"]').map(e => e.textContent || "").find(t => /^Passed /.test(t)) || "";
    } else if (window.innerWidth <= 1000) {
      // a phone: the posting is the full-screen overlay (D149's rule), never the deck's slot
      press();
      post.overlay = await waitFor(() => !!q('[data-panel-id="jd"]'));
      post.slotOpen = slotOpen();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); post.overlayClosed = await waitFor(() => !q('[data-panel-id="jd"]'));
    } else {
    wheel(q('[data-fan-offset="0"] [data-deck-face]'), 80); await wait(400);
    post.wheelOpened = slotOpen(); post.wheelTurned = frontTitle() !== post.title;
    while (idx() > 1) { q('[data-deck-flip="prev"]')?.click(); await wait(300); }
    press(); post.openedByPress = await waitFor(slotOpen);
    post.postTitle = q("[data-deck-post-slot] h1, [data-deck-post-slot] h2")?.textContent || null;
    post.factsInSlot = !!q("[data-deck-post-slot] [data-posting-facts]");
    post.stageHidden = !q("[data-deck-stage]") || q("[data-deck-stage]").getBoundingClientRect().height === 0;
    post.deckPosition = getComputedStyle(q("[data-home-deck]")).position;
    post.boardPost = !!q("[data-board-post]");
    post.listShown = !!q(".jb-board__list") && q(".jb-board__list").getBoundingClientRect().height > 0;
    post.foldLabel = q("[data-deck-post-slot] [data-posting-close]")?.textContent?.trim() || null;
    post.inSlot = (() => { const a = box(q("[data-deck-post-slot]")), d = box(q("[data-home-deck]")); return !!a && a.left >= d.left - 1 && a.right <= d.right + 1; })();
    await wait(200);
    wheel(slot(), -80); await wait(500); post.wheelFolded = !slotOpen();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await waitFor(() => !slotOpen());
    post.backTo = frontTitle();
    document.body.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); post.openedByEnter = await waitFor(slotOpen);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); post.foldedByEsc = await waitFor(() => !slotOpen());
    const openPost = () => (cfg?.plate ? q('[data-fan-offset="0"] [data-deck-title-line]') : q('[data-fan-offset="0"] [data-deck-open-posting]'))?.click();
    if (cfg?.plate) post.openedByButton = null;   // the plate ticket has no "Open the posting" (FIX-4: the title opens it)
    else { openPost(); post.openedByButton = await waitFor(slotOpen); }
    if (cfg?.plate) { openPost(); await waitFor(slotOpen); }
    q("[data-deck-post-slot] [data-posting-close]")?.click(); post.foldedByButton = await waitFor(() => !slotOpen());
    // a bubble's posting: on the deck too; the list stays where it is
    if (cfg?.plate) { [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => /index/i.test(t.textContent))?.click();
      await waitFor(() => !!q("[data-market-index] [data-index-title]"), 10000); await wait(150);   // 47h: the rows, not a fixed 500 ms
      // a press landing mid tab-switch is dropped under load (47g's refill): press again while the slot stays shut
      for (let i = 0; i < 4 && !slotOpen(); i++) { q("[data-market-index] [data-index-title]")?.click(); if (await waitFor(slotOpen, 2500)) break; } }
    else q(".jb__title")?.click();
    post.listOpensOnDeck = await waitFor(slotOpen);
    post.listOrigin = slot()?.getAttribute("data-post-origin") || null;
    post.listStillShown = cfg?.plate ? null : !!q(".jb-board__list") && q(".jb-board__list").getBoundingClientRect().height > 0;   // plate: the Index is its own tab
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await waitFor(() => !slotOpen());
    window.scrollTo(0, 0); await wait(150);
    // the posting's Pass on the deck's own card: the deck decides it and the next card comes to the front
    const before = q("[data-deck-count]")?.textContent;
    openPost(); await waitFor(slotOpen);
    q('[data-deck-post-slot] [data-decision="pass"]')?.click();
    post.passFolds = await waitFor(() => !slotOpen());
    await wait(700);
    post.passAdvanced = q("[data-deck-count]")?.textContent !== before;
    post.countAfterPass = q("[data-deck-count]")?.textContent || null;
    post.passSaid = q('[aria-live="polite"]')?.textContent || "";
    }
    out.post = post;
    // the folded card: the title centred between the head and the info row; the stats' type
    const fart = front();
    const hd = box(q("[data-deck-head]", fart)), tt = box(q("[data-deck-title-line]", fart)), inf = box(q("[data-deck-info]", fart));
    out.folded = { above: tt && hd ? tt.top - hd.bottom : null, below: tt && inf ? inf.top - tt.bottom : null,
      statValue: q("[data-deck-stat] dd", fart) ? getComputedStyle(q("[data-deck-stat] dd", fart)).fontSize : null,
      statLabel: q("[data-deck-stat] dt", fart) ? getComputedStyle(q("[data-deck-stat] dt", fart)).fontSize : null,
      statCols: q("[data-deck-stats]", fart) ? getComputedStyle(q("[data-deck-stats]", fart)).gridTemplateColumns.split(" ").length : 0 };

    // ── ⭐ D156 (1d) the filtering sentence in its ORIGINAL type (7ebed68): the logo face, 800 italic, line 1.5, -.015em
    const sent = q(".fh[data-fh-d147] .bh"), tok = q(".fh[data-fh-d147] .bh .tok:not([aria-pressed='true'])"), on = q(".fh[data-fh-d147] .bh .tok[aria-pressed='true']");
    const scs = sent && getComputedStyle(sent);
    out.sentence = sent && { family: scs.fontFamily, weight: scs.fontWeight, style: scs.fontStyle, size: scs.fontSize, line: scs.lineHeight, spacing: scs.letterSpacing, color: scs.color,
      ink: rgb("var(--c-ink-muted)"),
      word: tok && { shadow: getComputedStyle(tok).boxShadow, padding: getComputedStyle(tok).paddingLeft, color: getComputedStyle(tok).color },
      quiet: rgb("var(--c-accent-quiet)"), set: on && { bg: getComputedStyle(on).backgroundColor, radius: getComputedStyle(on).borderTopLeftRadius }, accent };

    // ── the dock: a rail of four icons, the same size; ⭐ (1c) /d (draft, the jobs) first, the house (Home) and the globe in
    // the accent, the picture / initials
    const dock = q("[data-nav-dock]");
    // ⭐ D197 #1: the plate Dock's icon boxes (.pl-dock__icon), each in its item (data-nav-item)
    const icons = qa("[data-nav-dock] .pl-dock__icon");
    const shell = q("[data-app-shell]");
    out.dock = {
      items: qa("[data-nav-dock] [data-nav-item]").map(a => a.getAttribute("data-nav-item")),
      icons: icons.map(i => { const g = q("svg", i) || q(".pl-avatar", i) || i.firstElementChild || i; return { id: i.closest("[data-nav-item]")?.getAttribute("data-nav-item"),
        w: Math.round(g.getBoundingClientRect().width), h: Math.round(g.getBoundingClientRect().height),
        stroke: q("svg", i) ? getComputedStyle(q("svg", i)).stroke : null, ink: getComputedStyle(dock).color, text: (q(".pl-avatar", i) || i).textContent.replace(/[,0-9+]|\bnew\b|unread.*$/g, "").trim(), img: !!q("img", i),
        radius: getComputedStyle(g).borderTopLeftRadius }; }),
      accent, emboss: !!q("[data-nav-emboss]"), handle: !!q("[data-nav-handle]"),
      rest: { box: box(dock), shellPad: getComputedStyle(shell).paddingLeft, wordsOpacity: getComputedStyle(q(".pl-dock__label", dock)).opacity,
        coversPage: overlap(box(dock), box(q("[data-home-deck]"))) || overlap(box(dock), box(q("[data-home-board]"))), shownAtRest: box(dock).left >= 0 && box(dock).width > 0 },
    };
    // hover (React's enter / leave come from mouseover / mouseout)
    dock.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    await wait(500);
    out.dock.hover = { box: box(dock), open: dock.getAttribute("data-open"), root: document.documentElement.getAttribute("data-dock-open"), shellPad: getComputedStyle(shell).paddingLeft,
      wordsOpacity: getComputedStyle(q(".pl-dock__label", dock)).opacity, names: qa("[data-nav-dock] .pl-dock__label").map(n => n.textContent.trim()),
      coversDeck: overlap(box(dock), box(q("[data-home-deck]"))), coversBoard: overlap(box(dock), box(q("[data-home-board]"))) };
    dock.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
    await wait(500);
    out.dock.afterLeave = { box: box(dock), shellPad: getComputedStyle(shell).paddingLeft };
    q("[data-nav-dock] a")?.focus(); await wait(500);
    out.dock.focus = { box: box(dock), open: dock.getAttribute("data-open"), shellPad: getComputedStyle(shell).paddingLeft };
    document.activeElement?.blur?.(); await wait(400);

    // ── the views under the search, with their counts; Import a job; the sort icon in the search field
    // ⭐ 47j (D199 C2 / 47h — re-pointed): on the plate market the views are the shell's AREA NAV (Today's picks · All jobs ·
    // Starred · Imported, counts on the words), Import a job its More item (on a phone, a view in the scroller — A245), and
    // search + sort the cartouche's row ([data-market-search]; the sort its [data-board-icon="sort"]).
    if (cfg?.plate) {
      const nav = q('[data-area-nav="The market"]');
      const curView = () => qa('[data-area-nav="The market"] [data-area-view]').find(a => a.getAttribute("aria-current") === "page")?.getAttribute("data-area-view") || null;
      out.views = { inAreaNav: !!nav, buttons: qa('[data-area-nav="The market"] [data-area-view]').filter(a => a.getAttribute("data-area-view") !== "import")
        .map(a => ({ id: a.getAttribute("data-area-view"), text: a.textContent.trim(), current: a.getAttribute("aria-current") })) };
      let imp = qa('[data-area-nav="The market"] [data-area-view="import"]')[0] || null;
      if (!imp) { q('[data-area-nav="The market"] .pl-areanav__more')?.click(); await wait(250);
        imp = qa('[data-area-nav="The market"] [role=menuitem]').find(a => /import a job/i.test(a.textContent)) || null; }
      out.views.importButton = imp?.textContent.trim() || null;
      imp?.click(); await wait(400);
      const ta = q("[data-import-box] textarea");
      out.importBox = { shown: !!ta, inBoard: !!ta && !!ta.closest("[data-plate-market-openings]"), placeholder: ta?.placeholder || null, overlay: !!q('[role="dialog"] [data-import-box]') };
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, "https://jobs.example.invalid/acme/123"); ta.dispatchEvent(new Event("input", { bubbles: true }));
        await wait(100);
        q("[data-import-box] button[type=submit]")?.click(); await wait(900);
        out.importBox.note = q("[data-import-note]")?.textContent || null;
        out.importBox.noteKind = q("[data-import-note]")?.getAttribute("data-import-note") || null;
        out.importBox.viewAfter = curView();
        q(".fh-import__x")?.click(); await wait(150);
      }
      const row = q("[data-market-search]");
      if (row) { row.scrollIntoView({ block: "center" }); await wait(200); }
      const sort = q('[data-board-icon="sort"]');
      out.sort = { inSearch: !!sort?.closest("[data-market-search]"), label: sort?.getAttribute("aria-label") || null, hasSvg: !!q("svg", sort), search: !!q("[data-market-search] input") };
      sort?.click(); await wait(250);
      const menu = q("#fh-sort");
      out.sort.menu = { open: !!menu, rows: qa("#fh-sort [role=radio]").map(r => r.innerText.replace(/\s+/g, " ").trim()),
        checked: q('#fh-sort [aria-checked="true"]')?.getAttribute("data-sort") ?? null, underField: !!menu && !!sort && box(menu).top >= box(sort).bottom - 1,   // under the sort control (inside the row's padding)
        menuBox: box(menu), rowBox: box(row), sortBox: box(sort) };
      q('#fh-sort [data-sort="dateDesc"]')?.click(); await wait(300);
      out.sort.afterPick = { label: q('[data-board-icon="sort"]')?.getAttribute("aria-label"), menuOpen: !!q("#fh-sort") };
      q('[data-board-icon="sort"]')?.click(); await wait(200);
      q('#fh-sort [data-sort=""]')?.click(); await wait(300);
    } else {
    const viewRow = q("[data-board-views]");
    out.views = { below: !!viewRow && box(viewRow).top >= box(q("[data-board-bar]")).bottom - 1,
      buttons: qa("[data-board-views] [data-view]").map(b => ({ id: b.getAttribute("data-view"), text: b.textContent.trim(), pressed: b.getAttribute("aria-pressed") })),
      importButton: q("[data-import-open]")?.textContent.trim() || null };
    q("[data-import-open]")?.click(); await wait(250);
    const ta = q("[data-import-box] textarea");
    out.importBox = { shown: !!ta, inBoard: !!ta && !!ta.closest("[data-home-board]"), placeholder: ta?.placeholder || null, overlay: !!q('[role="dialog"] [data-import-box]') };
    if (ta) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, "https://jobs.example.invalid/acme/123"); ta.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(100);
      q("[data-import-box] button[type=submit]")?.click(); await wait(900);
      out.importBox.note = q("[data-import-note]")?.textContent || null;
      out.importBox.noteKind = q("[data-import-note]")?.getAttribute("data-import-note") || null;
      out.importBox.viewAfter = qa("[data-board-views] [data-view]").find(b => b.getAttribute("aria-pressed") === "true")?.getAttribute("data-view") || null;
      q('[data-board-views] [data-view="all"]')?.click(); await wait(300);
      q(".fh-import__x")?.click(); await wait(150);
    }
    const sort = q('[data-board-icon="sort"]');
    out.sort = { inSearch: !!sort?.closest(".fh-srch"), label: sort?.getAttribute("aria-label") || null, hasSvg: !!q("svg", sort), topWord: !!q(".fh-sortw") || !!q(".fh-title") };
    sort?.click(); await wait(250);
    const menu = q("#fh-sort");
    out.sort.menu = { open: !!menu, rows: qa("#fh-sort [role=radio]").map(r => r.innerText.replace(/\s+/g, " ").trim()),   // what is drawn (the tags are hidden)
      checked: q('#fh-sort [aria-checked="true"]')?.getAttribute("data-sort") ?? null, underField: !!menu && box(menu).top >= box(q("[data-board-bar]")).bottom - 1 };
    q('#fh-sort [data-sort="dateDesc"]')?.click(); await wait(300);
    out.sort.afterPick = { label: q('[data-board-icon="sort"]')?.getAttribute("aria-label"), menuOpen: !!q("#fh-sort") };
    q('[data-board-icon="sort"]')?.click(); await wait(200);
    q('#fh-sort [data-sort=""]')?.click(); await wait(300);
    }

    // ── the bubbles: D1's growth, driven by the rail
    const pair = q("[data-jb-pair]"), bubs = pair ? qa(".jb", pair) : [];
    const widths = () => bubs.map(b => Math.round(b.getBoundingClientRect().width));
    const heights = () => bubs.map(b => Math.round(b.getBoundingClientRect().height));
    const rule = (sel) => { for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } for (const r of rs) if (r.selectorText === sel) return r.style; } return null; };
    const grow = rule(".jb-pair .jb:hover, .jb-pair .jb:focus-within");
    const railOpen = rule(".jb-pair .jb:hover .jb__rail, .jb-pair .jb:focus-within .jb__rail");
    const railBase = rule(".jb__rail");
    const bubBase = rule(".jb-pair .jb");
    pair?.scrollIntoView({ block: "center" }); await wait(200);
    const bubbles = { perPair: bubs.length, restW: widths(), restH: heights(), rowH: pair ? Math.round(pair.getBoundingClientRect().height) : null,
      restGrow: bubs.map(b => getComputedStyle(b).flexGrow), restRail: bubs[0] ? getComputedStyle(q(".jb__rail", bubs[0])).maxWidth : null,
      cssGrow: grow?.flexGrow || null, cssRailOpen: railOpen?.maxWidth || null, cssTransition: bubBase?.transition || null, cssRailTransition: railBase?.transition || null,
      padding: bubs[0] ? getComputedStyle(bubs[0]).padding : null, gap: pair ? getComputedStyle(pair).columnGap : null, rowsGap: q('.jb-rows[data-columns="2"]') ? getComputedStyle(q('.jb-rows[data-columns="2"]')).rowGap : null };
    q("button", bubs[0])?.focus(); await wait(500);
    Object.assign(bubbles, { focusW: widths(), focusH: heights(), focusRowH: pair ? Math.round(pair.getBoundingClientRect().height) : null,
      focusGrow: bubs.map(b => getComputedStyle(b).flexGrow), focusRail: bubs[0] ? Math.round(q(".jb__rail", bubs[0]).getBoundingClientRect().width) : null,
      railVisible: bubs[0] ? getComputedStyle(q(".jb__rail", bubs[0])).visibility : null, samePair: !!bubs[1] && bubs[1].parentElement === pair });
    document.activeElement?.blur?.(); await wait(300);
    window.scrollTo(0, 0);
    out.bubbles = bubbles;
    out.hscroll = document.documentElement.scrollWidth > window.innerWidth + 1;
    return out;
  },
  // ⛔ D153 (5) · every facts cell's words, measured: a word whose characters lie on two lines has two client rects.
  // ⭐ 47j (D199 C7): the opening sheet's glance strip — each cell keyed by its label (PAY, POSTED → "pay").
  "posting-facts": () => {
    const facts = document.querySelector("[data-opening-sheet] .pl-op__glance");
    if (!facts) return { facts: null, url: location.pathname };
    const words = [];
    const walker = document.createTreeWalker(facts, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const m of n.data.matchAll(/\S+/g)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const lines = new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
        words.push({ word: m[0], lines: lines.size });
      }
    }
    const KEY = { "PAY, POSTED": "pay", TYPE: "type", LEVEL: "level", "STACK YOU HAVE": "stack" };
    const cells = [...facts.querySelectorAll(".pl-stats__cell")].map(c => {
      const b = c.getBoundingClientRect(), label = c.querySelector(".pl-label")?.textContent.trim() || "";
      return { key: KEY[label] || label, text: c.textContent.trim(), top: Math.round(b.top), width: Math.round(b.width),
               overflows: c.scrollWidth > c.clientWidth + 1 };
    });
    return { url: location.pathname, facts: { width: Math.round(facts.getBoundingClientRect().width), cells, words,
      right: Math.round(facts.getBoundingClientRect().right), sheetRight: Math.round(document.querySelector("[data-opening-over] [data-opening-sheet]").getBoundingClientRect().right),   // (the market's field card links carry data-opening-sheet too)
      broken: words.filter(w => w.lines > 1).map(w => w.word), rows: new Set(cells.map(c => c.top)).size } };
  },
};
STYLE_PROBES.a238 = async () => {   // ⭐ A238: decide three cards, each through the VISIBLE front's own button, and count
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const cards = () => [...document.querySelectorAll("[data-deck-stage] [data-fan-offset]")];
  const front = () => { const live = cards().filter(e => e.getAttribute("data-fan-offset") === "0" && getComputedStyle(e).opacity !== "0"); return live[live.length - 1] || null; };
  const title = () => front()?.querySelector("[data-deck-title-line]")?.textContent?.trim() || null;
  const ghosts = () => cards().filter(e => getComputedStyle(e).opacity === "0" && e.getAttribute("data-fan-offset") === "0").length;
  // 47h browser tier: under a loaded refill the first Pass landed before the front's buttons answered (the title never changed);
  // wait for the front's button, and press again only while the SAME card is still in front 3 s later (≤ 3 presses)
  for (const t0 = performance.now(); performance.now() - t0 < 8000 && !front()?.querySelector("[data-deck-action='pass']");) await wait(100);
  const out = { before: cards().length, steps: [] };
  for (const act of ["pass", "save", "pass"]) {
    const was = title();
    for (let k = 0; k < 3 && title() === was; k++) {
      front()?.querySelector(`[data-deck-action='${act}']`)?.click();
      const t0 = performance.now(); while (performance.now() - t0 < 3000 && title() === was) await wait(50);
    }
    await wait(1500);   // the longest exit is 0.42 s; a spring settle well inside this
    const btn = front()?.querySelector(`[data-deck-action='${act}']`);
    out.steps.push({ act, was, now: title(), mounted: cards().length, ghosts: ghosts(),
      // why a press did not land, when one does not (47h: only inside the full 16-probe fill)
      why: { btn: !!btn, disabled: !!btn?.disabled, fronts: cards().filter(e => e.getAttribute("data-fan-offset") === "0").length,
        tab: [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => t.getAttribute("aria-selected") === "true")?.textContent?.trim() || null,
        hidden: btn ? !btn.offsetParent : null, path: location.pathname + location.search },
      // the 47g walk counted document-wide: every offset-0 node anywhere, and the invisible ones
      docFront: document.querySelectorAll("[data-fan-offset='0']").length,
      docGhosts: [...document.querySelectorAll("[data-fan-offset='0']")].filter(e => getComputedStyle(e).opacity === "0").length });
  }
  out.after = cards().length;
  return out;
};
// ⭐ D149 rule 3 / A232 R2 (46t): one screen's computed styles, measured in an open browser against a running vite.
async function measureStyles(browser, vite, id, pickRoutes = null, onlySizes = null) {
  const s = SCREENS[id];
  if (!s) throw new Error(`no screen "${id}" in SCREENS`);
  const out = {};
  // ⭐ D163: a screen may name several ROUTES (`routes: { tracker: { app, fixtures, ready, appPrep, probe }, … }`), each
  // measured at the screen's sizes by the screen's probe (handed the route's `probe` argument): out[route][size], and its
  // shot docs/fidelity-shots/<screen>-<route>-<size>.png. `--styles <screen> a,b` measures only routes a and b.
  const targets = s.routes ? Object.entries(s.routes).filter(([k]) => !pickRoutes || pickRoutes.includes(k)) : [[null, s]];
   for (const [routeId, t] of targets) {
    const sink = routeId ? (out[routeId] = {}) : out;
    // A201: FIDELITY_SIZES=768,390 measures only those sizes (a guard test runs the narrow ones; the full sweep is ~45 min)
    for (const [size, [w, h]] of Object.entries(s.sizes || SIZES).filter(([k]) => !onlySizes || onlySizes.includes(k))) {
      const shotName = routeId ? `${id}-${routeId}-${size}` : `${id}-app-${size}`;
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", e => pageErrors.push(String(e.message).slice(0, 200)));
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
      // ⭐ D168 / D167: a screen measuring MOTION (`motion: true`) keeps the animations, except at its `reducedSizes`.
      const reduce = !s.motion || (s.reducedSizes || []).includes(size);
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }]);
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const raw = req.url();
        if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: "" });
        const u = new URL(raw);
        if (selfHostedFont(u, req)) return;
        if (!u.pathname.startsWith("/api/")) return req.continue();
        const answer = t.fixtures[u.pathname] ?? COMMON[u.pathname];
        // D163: a route marked `strict` answers what its fixtures do not hold with a 404 (the screen shows its own "could
        // not load" line) instead of {} (which Profile, Account and Admin read as data, and crash on).
        if (answer === undefined && t.strict) return req.respond({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not in the fixtures." }) });
        req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(answer ?? {}) });
      });
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem("draft-theme", "dusk-dark"); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} });
      await page.goto(`${vite.url}${t.app}`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
      await page.evaluateHandle("document.fonts.ready").catch(() => {});
      if (t.ready) await page.waitForSelector(t.ready, { timeout: 30000 }).catch(() => {});
      await sleep(900);
      if (t.appPrep) await t.appPrep(page);   // D149: the screen's own state (Full House: the first posting open)
      // ⭐ D156: a screen that asks for it is also shot as it is measured (docs/fidelity-shots/<screen>-app-<size>.png).
      if (s.shoot) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${shotName}.png`), await page.screenshot({ type: "png" })); }
      sink[size] = await page.evaluate(STYLE_PROBES[id], t.probe ?? null);
      // 46k: a probe that throws names the page's own errors (a blank app otherwise reads as a missing element)
      if (s.nodeProbe) {
        try { Object.assign(sink[size], await s.nodeProbe(page, size, routeId)); }   // A201: route-aware probes
        catch (e) { console.error(`[fidelityShots] ${id} ${size}: the probe failed — page errors: ${JSON.stringify(pageErrors.slice(0, 3))}`); throw e; }
      }
      if (routeId && pageErrors.length) sink[size].pageErrors = pageErrors.slice(0, 3);   // D163: a screen that did not draw says why
      await page.close();
    }
   }
  return out;
}

if (process.argv[2] === "--styles") {
  const id = process.argv[3] || "deck";
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.log(JSON.stringify({ skipped: "no Chrome" })); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  const vite = await startVite();
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  let out;
  // A201: FIDELITY_SIZES=768,390 measures only those sizes (a guard test runs the narrow ones; the full sweep is ~45 min)
  try { out = await measureStyles(browser, vite, id, process.argv[4] ? process.argv[4].split(",") : null, process.env.FIDELITY_SIZES ? process.env.FIDELITY_SIZES.split(",") : null); }
  finally { await browser.close(); vite.proc.kill(); }
  console.log(JSON.stringify(out));
  process.exit(0);
}

// ⭐ A232 R2 (46t, owner 11-17: "go with R1 and R2"): MANY screens with ONE vite and ONE Chrome —
// `--styles-batch '[{"id":"home163"},{"id":"shrink201","routes":"board","sizes":"768,390"}]'` prints
// { "<id>|<routes>|<sizes>": <the --styles answer> | { error } } on its last line. Each --styles run paid its own vite start
// (a cold transform of the whole client) and Chrome launch; test-support/fidelityProbe.mjs runs this once per suite.
if (process.argv[2] === "--styles-batch") {
  const specs = JSON.parse(process.argv[3] || "[]");
  const key = (p) => [p.id, p.routes || "", p.sizes || ""].join("|");
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.log(JSON.stringify(Object.fromEntries(specs.map(p => [key(p), { skipped: "no Chrome" }])))); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  const vite = await startVite();
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  const all = {};
  try {
    for (const p of specs) {
      const t0 = Date.now();
      try { all[key(p)] = await measureStyles(browser, vite, p.id, p.routes ? p.routes.split(",") : null, p.sizes ? p.sizes.split(",") : null); }
      catch (e) { all[key(p)] = { error: String(e?.message || e).slice(0, 500) }; }
      console.error(`[fidelityShots] batch ${key(p)} ${Date.now() - t0} ms`);
    }
  } finally { await browser.close(); vite.proc.kill(); }
  console.log(JSON.stringify(all));
  process.exit(0);
}

// ⭐ 47h (D197 #3): `--look <screen> <address> <out.png> [w] [h]` — one screen's fixtures on another address (the plate
// ledger on /app/auto-apply with the tracker's fixtures), one shot and the page's errors (a smoke look, not a comparison).
if (process.argv[2] === "--look") {
  const [, , , id, address, outPng, w = "1280", h = "2600"] = process.argv;
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.log(JSON.stringify({ skipped: "no Chrome" })); process.exit(0); }
  const vite = await startVite();
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  try {
    const s = SCREENS[id];
    const ap = await shoot(browser, `${vite.url}${address}`, [Number(w), Number(h)], { fixtures: { ...s.fixtures, ...(process.env.LOOK_FIXTURES ? JSON.parse(fs.readFileSync(process.env.LOOK_FIXTURES, "utf8")) : {}) }, ready: process.env.LOOK_READY || "[data-house-header]",
      prep: async (page) => { await sleep(3000); globalThis.__lookDom = await page.evaluate(() => ({ url: location.href, root: document.getElementById("root")?.innerHTML.length ?? -1,
        text: (document.body?.innerText || "").slice(0, 400), plate: !!document.querySelector("[data-plate-page]") })); } });
    fs.writeFileSync(outPng, ap.buf);
    console.log(JSON.stringify({ errors: ap.errors, dom: globalThis.__lookDom }));
  } finally { await browser.close(); vite.proc.kill(); }
  process.exit(0);
}

const only = process.argv[2] ? process.argv[2].split(",") : Object.keys(SCREENS).filter(k => SCREENS[k].sketch);
fs.mkdirSync(OUT, { recursive: true });
const resolution = await resolveBrowserExecutable();
if (!resolution) { console.error("No Chrome binary."); process.exit(1); }
const vite = await startVite();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files"] });
const reportPath = path.join(OUT, "fidelity.json");
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : {};
try {
  for (const id of only) {
    const s = SCREENS[id];
    if (!s) { console.error(`unknown screen ${id}`); continue; }
    for (const [size, dims] of Object.entries(s.sizes || SIZES)) {   // D163: a screen may name its own widths
      const sk = await shoot(browser, pathToFileURL(path.join(ROOT, "docs", "sketches", s.sketch)).href, dims, { hide: SKETCH_CONTROLS, prep: s.sketchPrep });
      const ap = await shoot(browser, `${vite.url}${s.app}`, dims, { fixtures: s.fixtures, ready: s.ready, prep: s.appPrep });
      fs.writeFileSync(path.join(OUT, `${id}-sketch-${size}.png`), sk.buf);
      fs.writeFileSync(path.join(OUT, `${id}-app-${size}.png`), ap.buf);
      const cmp = await compare(browser, sk.buf, ap.buf);
      fs.writeFileSync(path.join(OUT, `${id}-side-${size}.png`), Buffer.from(cmp.side.split(",")[1], "base64"));
      report[`${id}-${size}`] = { sketch: s.sketch, app: s.app, similarity: cmp.score, worstRegions: cmp.regions, appErrors: ap.errors.slice(0, 3), at: new Date().toISOString() };
      console.log(`${id} ${size}: similarity ${(cmp.score * 100).toFixed(1)}% · worst cells ${cmp.regions.map(r => `r${r.row}c${r.col} ${(r.diff * 100).toFixed(0)}%`).join(", ") || "none"}${ap.errors.length ? ` · app errors: ${ap.errors[0]}` : ""}`);
      if (s.region) await compareRegion(browser, id, s, size, dims, sk.buf, ap.buf, report);
    }
  }
} finally {
  await browser.close();
  vite.proc.kill();
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\n${OUT}`);

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

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const OUT = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 5199;
const SIZES = { desktop: [1280, 800], phone: [390, 844] };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
const FACTS_BOARD = FH_BOARD.map((j, i) => (i ? j : { ...j, workType: "Remote", tagWorkplace: "remote",
  sponsorship: { level: "says_no", label: "Says no sponsorship", sources: [], notice: "" },
  liveness: { label: "Reposted 3 times" } }));
const FACTS = { ...FULLHOUSE, "/api/jobs": { ...FULLHOUSE["/api/jobs"], jobs: FACTS_BOARD } };
// ⭐ D152 · HOME (home-sketch.html): the deck and the board on one screen, fed by both screens' fixtures.
const HOME = { ...FULLHOUSE, ...DECK };
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

// ── The screens ───────────────────────────────────────────────────────────────────────────────────────────────────
// sketch: the file; sketchPrep: hide the sketch's own controls (they are not the design); app: the route, its fixtures,
// and what to press so the app shows the sketch's state.
const SKETCH_CONTROLS = ".ctl, .lay-ctl, .switch, .note, #note";
const SCREENS = {
  // ⭐ D152 · HOME. The sketch opens its dock for 1.5 s on load — shot after it has slid away.
  home: { sketch: "home-sketch.html", app: "/app", fixtures: HOME, ready: "[data-home-board]",
    sketchPrep: async () => { await sleep(1700); } },
  // The same screen with the dock out (the sketch shows it for 1.5 s on load; the app's pointer at the left edge).
  "home-dock": { sketch: "home-sketch.html", app: "/app", fixtures: HOME, ready: "[data-home-board]",
    sketchPrep: async () => { await sleep(100); },
    appPrep: async (page) => { await sleep(1200); await page.mouse.move(4, 300); await sleep(700); } },
  deck: { sketch: "declutter-v7.html", app: "/app", fixtures: DECK, ready: "[data-deck-face]" },
  fullhouse: { sketch: "fullhouse-declutter.html", app: "/app/jobs", fixtures: FULLHOUSE, ready: "[data-fh-title]",
    appPrep: async (page) => {   // the sketch shows the first posting open beside the list
      await page.evaluate(() => { const t = [...document.querySelectorAll("*")].find(e => e.children.length === 0 && e.textContent.trim() === "Senior Data Engineer"); t?.click(); });
      await sleep(900);
    } },
  // D153 (5): the facts box measured, not compared (no sketch of its own) — `--styles posting-facts` only.
  "posting-facts": { sketch: null, app: "/app/jobs", fixtures: FACTS, ready: "[data-fh-title]",
    appPrep: async (page) => {
      await page.evaluate(() => { const t = [...document.querySelectorAll("*")].find(e => e.children.length === 0 && e.textContent.trim() === "Senior Data Engineer"); t?.click(); });
      await sleep(900);
    } },
  settings: { sketch: "settings-declutter.html", app: "/app/auto-apply", fixtures: SETTINGS, ready: "[data-settings-open]",
    appPrep: async (page) => { await page.click("[data-settings-open]").catch(() => {}); await page.waitForSelector("[data-fold-top]", { timeout: 8000 }).catch(() => {}); await sleep(600); },
    // ⭐ D149 settings: --styles opens the drawer first too; and the comparison that matters is the DRAWER (the page behind
    // it is a stand-in in the sketch) — its 520 px at the right edge on a computer, the whole screen on a phone.
    stylesWithPrep: true, region: ([w, h]) => (w >= 520 ? [w - 520, 0, 520, h] : null) },
  // ⭐ D149 · TRACKER — the owner's pick: layout 1 (table + timeline beside) on a computer, layout 3 (the switch) on phones.
  tracker: { sketch: "tracker-options.html", app: "/app/auto-apply", fixtures: TRK, ready: "[data-tracker-table] tbody tr",
    sketchPrep: async (page) => {
      await page.evaluate(() => document.querySelector(`[data-l="${window.innerWidth < 700 ? "tabs" : "side"}"]`)?.click());
      await sleep(400);
    } },
  // The two states the first screen does not show: the first row opened (its posting pane chosen, as the sketch opens
  // it), and on a phone the switch's other side, the timeline.
  "tracker-open": { sketch: "tracker-options.html", app: "/app/auto-apply", fixtures: TRK, ready: "[data-tracker-table] tbody tr",
    sketchPrep: async (page) => {
      await page.evaluate(() => { document.querySelector(`[data-l="${window.innerWidth < 700 ? "tabs" : "side"}"]`)?.click(); document.querySelector(".tr")?.click(); });
      await sleep(700);
    },
    appPrep: async (page) => {
      await page.evaluate(() => document.querySelector("[data-tracker-table] tbody tr.trk-row")?.click()); await sleep(300);
      await page.evaluate(() => document.querySelector('[data-row-detail] [data-pane="posting"]')?.click()); await sleep(700);
    } },
  "tracker-timeline": { sketch: "tracker-options.html", app: "/app/auto-apply", fixtures: TRK, ready: "[data-tracker-table] tbody tr",
    sketchPrep: async (page) => {
      await page.evaluate(() => { document.querySelector(`[data-l="${window.innerWidth < 700 ? "tabs" : "side"}"]`)?.click(); document.querySelector('[data-tv="tl"]')?.click(); });
      await sleep(400);
    },
    appPrep: async (page) => { await page.evaluate(() => document.querySelector('[data-phone-view="timeline"]')?.click()); await sleep(500); } },
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
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
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
const STYLE_PROBES = {
  deck: () => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const face = document.querySelector("[data-deck-face]")?.closest("article");
    const title = document.querySelector("[data-deck-face] h2");
    const company = document.querySelector("[data-deck-head] div div div");
    const draft = [...document.querySelectorAll("[data-deck-actions] button")].find(b => /Draft/.test(b.textContent));
    const r = face?.getBoundingClientRect();
    return {
      canvas: cs(document.documentElement).getPropertyValue("--c-canvas").trim(),
      card: face && { bg: cs(face).backgroundColor, radius: cs(face).borderTopLeftRadius, border: cs(face).borderTopWidth, shadow: cs(face).boxShadow,
                      width: Math.round(r.width), top: Math.round(r.top) },
      title: title && { family: cs(title).fontFamily, size: cs(title).fontSize, weight: cs(title).fontWeight },
      company: company && { family: cs(company).fontFamily, size: cs(company).fontSize, weight: cs(company).fontWeight },
      draft: draft && { bg: cs(draft).backgroundColor, color: cs(draft).color },
      topBar: !!document.querySelector("[data-app-chrome]") && cs(document.querySelector("[data-app-chrome]")).backgroundColor,
      controlsRow: !!document.querySelector("[data-deck-counter]"),
    };
  },
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
    out.jobs = jobs && { eyebrowColor: cs(eb).color, eyebrowSize: cs(eb).fontSize, hFamily: cs(h).fontFamily, hSize: cs(h).fontSize, hWeight: cs(h).fontWeight, hLetter: cs(h).letterSpacing, hLine: cs(h).lineHeight,
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
  // ⭐ D149 · TRACKER (tracker-options.html) — the page, the header's controls, the counts, the filters, the table, a
  // row, the status dot and the timeline card, as computed (test/fidelityTracker.test.js holds them to the sketch).
  tracker: () => {
    const q = (s) => document.querySelector(s);
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    const font = (el) => el && { family: cs(el).fontFamily, size: cs(el).fontSize, weight: cs(el).fontWeight, color: cs(el).color, lh: cs(el).lineHeight };
    const fill = (el) => el && { bg: cs(el).backgroundColor, bgImage: cs(el).backgroundImage, radius: cs(el).borderTopLeftRadius, border: cs(el).borderTopWidth, shadow: cs(el).boxShadow, padding: cs(el).padding };
    const title = q("[data-house-header] h1");
    const tbl = q("[data-tracker-table]");
    const row = q("[data-tracker-table] tbody tr.trk-row");
    const tl = q("[data-timeline]");
    const dot = q("[data-tracker-table] .trk-dot");
    return {
      canvas: cs(document.documentElement).getPropertyValue("--c-canvas").trim(),
      title: { ...font(title), ...box(title) },
      line: font(q("[data-house-line]")),
      mode: fill(q(".dh-head__ctl .dh-mode")), modeOn: { ...fill(q('[data-mode][aria-pressed="true"]')), ...font(q('[data-mode][aria-pressed="true"]')) },
      quiet: { ...fill(q("[data-settings-open]")), ...font(q("[data-settings-open]")) },
      send: { ...fill(q("[data-send-all-ready]")), ...font(q("[data-send-all-ready]")) },
      count: font(q("[data-tracker-counts] b")), countWord: font(q("[data-tracker-counts] span")), countHot: font(q('[data-tracker-counts] [data-accent="true"] b')),
      filter: { ...fill(q('[data-filter="needs"]')), ...font(q('[data-filter="needs"]')) }, filterOn: fill(q('[data-filter][aria-pressed="true"]')),
      table: { ...fill(tbl), ...box(tbl) },
      th: font(q("[data-tracker-table] thead .trk-sort")), thTransform: cs(q("[data-tracker-table] thead .trk-sort"))?.textTransform,
      row: box(row), rowBorder: row && cs(row).borderTopWidth,
      company: font(q("[data-tracker-table] .trk-pos__t b")), role: font(q("[data-tracker-table] .trk-pos__t span")),
      logo: box(q("[data-tracker-table] [data-company-bubble]")),
      dot: dot && { w: cs(dot).width, h: cs(dot).height, radius: cs(dot).borderTopLeftRadius },
      statusNeeds: font(q('[data-tracker-table] [data-status-ring="need"]')),
      timeline: { ...fill(tl), ...box(tl), shown: !!tl && tl.offsetParent !== null },
      tlTitle: font(q("[data-timeline-title]")),
      bubble: box(q("[data-timeline] [data-company-bubble]")),
      phoneSwitch: (() => { const b = q('[data-phone-view="timeline"]'); return !!b && b.offsetParent !== null; })(),
      hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  },
  // ⭐ D152 (1) / (4) · HOME: the grid's two columns, the corner mark gone, and the dock — off the left edge at rest, out
  // at the left edge (a pointer at x = 4), pushing Home so it covers neither the deck nor the sentence.
  home: async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const q = (s) => document.querySelector(s);
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width) }; };
    const visible = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
    const overlap = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const dock = q("[data-nav-dock]");
    await wait(1900);   // past the arrival show (1.6 s)
    // D152 (2) / D153 (1): the card, its backs (their rotated bounds), the buttons, the board column.
    const card = box(q("[data-deck-face]")?.closest("article"));
    const backs = [1, 2, 3].map(n => box(q(`[data-fan-offset="${n}"] [data-fan-position]`))).map((b, i) => b && { n: i + 1, ...b,
      rotate: (q(`[data-fan-offset="${i + 1}"] [data-fan-position]`).style.transform.match(/rotate\(([-\d.]+)deg\)/) || [])[1] ?? null,
      opacity: getComputedStyle(q(`[data-fan-offset="${i + 1}"] [data-fan-position]`)).opacity });
    const acts = box(q("[data-deck-actions]")), deckCol = box(q("[data-home-deck]")), boardCol = box(q("[data-home-board]"));
    const shownBacks = backs.filter(b => b && Number(b.opacity) > 0);
    // D152 (5): the first pair at rest, then with its first bubble focused (:focus-within grows it as :hover does).
    const pair = q("[data-jb-pair]"), bubs = pair ? [...pair.querySelectorAll(".jb")] : [];
    const widths = () => bubs.map(b => Math.round(b.getBoundingClientRect().width));
    const heights = () => bubs.map(b => Math.round(b.getBoundingClientRect().height));
    const pairs = { count: document.querySelectorAll("[data-jb-pair]").length, perPair: bubs.length, restW: widths(), restH: heights(),
      atsSquare: !!q(".jb__sq--ats") };
    bubs[0]?.querySelector("button")?.focus();
    await wait(450);
    Object.assign(pairs, { focusW: widths(), focusH: heights(), options: bubs[0] ? getComputedStyle(bubs[0].querySelector(".jb__rail")).visibility : null });
    document.activeElement?.blur?.();
    await wait(200);
    const deckGeom = { card, backs, acts, deckCol,
      backsCoverButtons: shownBacks.some(b => overlap(b, acts)), backsCoverBoard: shownBacks.some(b => overlap(b, boardCol)),
      backsOutsideColumn: shownBacks.some(b => b.right > deckCol.right + 1 || b.left < deckCol.left - 1) };
    const sortOver = () => overlap(box(q(".fh-title--home")), box(q("[data-home-board] .bh")));
    const rest = { dock: box(dock), padLeft: getComputedStyle(q(".home")).paddingLeft, sortCoversSentence: sortOver() };
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 4, clientY: 300, bubbles: true }));
    await wait(700);
    const deck = box(q("[data-home-deck]")), sentence = box(q("[data-home-board] .bh")), d = box(dock);
    const out = { dock: d, padLeft: getComputedStyle(q(".home")).paddingLeft, open: document.documentElement.getAttribute("data-dock-open"),
      coversDeck: overlap(d, deck), coversSentence: overlap(d, sentence), sortCoversSentence: sortOver() };
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await wait(600);
    return {
      grid: { deck: box(q("[data-home-deck]")), board: box(q("[data-home-board]")), columns: getComputedStyle(q(".home")).gridTemplateColumns },
      deck: deckGeom, pairs,
      title: !!q(".fh-title__h"), cornerMark: visible(q(".tbar-group")), emboss: q("[data-nav-emboss]")?.textContent || null,
      items: [...document.querySelectorAll("[data-nav-dock] [data-nav-item]")].map(a => a.getAttribute("data-nav-item")),
      current: q('[data-nav-dock] [aria-current="page"]')?.getAttribute("data-nav-item") || null,
      handle: visible(q("[data-nav-handle]")),
      rest, out, afterEsc: { dock: box(dock), open: document.documentElement.getAttribute("data-dock-open") },
    };
  },
  // ⛔ D153 (5) · every facts cell's words, measured: a word whose characters lie on two lines has two client rects.
  "posting-facts": () => {
    const facts = document.querySelector(".posting--panel .posting__facts") || document.querySelector(".posting__facts");
    if (!facts) return { facts: null };
    const words = [];
    const walker = document.createTreeWalker(facts.querySelector(".posting__strip") || facts, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const m of n.data.matchAll(/\S+/g)) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const lines = new Set([...r.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
        words.push({ word: m[0], lines: lines.size });
      }
    }
    const cells = [...facts.querySelectorAll(".posting__cell")].map(c => {
      const b = c.getBoundingClientRect();
      return { key: c.getAttribute("data-cell"), text: c.textContent.trim(), top: Math.round(b.top), width: Math.round(b.width),
               overflows: c.scrollWidth > c.clientWidth + 1 };
    });
    return { facts: { width: Math.round(facts.getBoundingClientRect().width), cells, words,
      broken: words.filter(w => w.lines > 1).map(w => w.word), rows: new Set(cells.map(c => c.top)).size } };
  },
  // ⭐ D149 · Full House + the opened posting (fullhouse-declutter.html), the first posting open (the screen's appPrep).
  fullhouse: () => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }; };
    const type = (el) => el && { family: cs(el).fontFamily, size: cs(el).fontSize, weight: cs(el).fontWeight, line: cs(el).lineHeight, color: cs(el).color, style: cs(el).fontStyle };
    const surface = (el) => el && { bg: cs(el).backgroundColor, image: cs(el).backgroundImage, radius: cs(el).borderTopLeftRadius, border: cs(el).borderTopWidth, shadow: cs(el).boxShadow };
    const q = (s) => document.querySelector(s);
    const h1 = q(".fh-title__h"), sent = q(".fh[data-fh-d147] .bh"), word = q(".fh[data-fh-d147] .bh .tok") || q(".fh[data-fh-d147] .bh button");
    const sort = q(".fh-sortw"), bar = q(".fh-bar"), input = q(".fh-bar input");
    const counts = [...document.querySelectorAll(".fh-count")];
    const rows = [...document.querySelectorAll(".jb[data-job-bubble]")];
    const row = rows[0], panel = q('[data-panel-id="jd"]'), pp = q(".pp");
    const facts = q(".posting__facts"), match = q(".posting__match .atsn b"), matchCell = q(".posting__match");
    const btn = (name) => q(`.pp__btn[data-decision="${name}"]`);
    return {
      canvas: cs(document.documentElement).getPropertyValue("--c-canvas").trim(), bodyBg: cs(document.body).backgroundColor,
      fonts: { serif: document.fonts.check("36px \"Instrument Serif\""), ui: document.fonts.check("16px \"Inter Tight\""),
               loaded: [...new Set([...document.fonts].filter(x => x.status === "loaded").map(x => x.family))] },
      title: h1 && { ...type(h1), ...box(h1) },
      sentence: sent && { ...type(sent), ...box(sent), maxWidth: cs(sent).maxWidth, word: word && { color: cs(word).color, underline: cs(word).boxShadow, border: cs(word).borderBottom } },
      sort: sort && { ...surface(sort), ...type(sort), text: sort.textContent.trim(), glyph: !!sort.querySelector("svg") },
      search: bar && { ...surface(bar), ...box(bar), placeholder: input?.placeholder, inputSize: cs(input).fontSize, glyph: !!bar.querySelector("svg") },
      countsBox: box(q(".fh.fh-counts")), listTop: box(q(".jb-board__list"))?.top, rowsTop: box(q(".jb-rows"))?.top,
      counts: counts.map(c => ({ n: c.querySelector("b").textContent, label: c.querySelector("span").textContent, size: cs(c.querySelector("b")).fontSize,
        weight: cs(c.querySelector("b")).fontWeight, color: cs(c.querySelector("b")).color })),
      row: row && { ...surface(row), ...box(row), padding: cs(row).padding, outline: `${cs(row).outlineWidth} ${cs(row).outlineStyle} ${cs(row).outlineColor}`,
        gap: rows[1] ? Math.round(rows[1].getBoundingClientRect().top - row.getBoundingClientRect().bottom) : null,
        title: type(row.querySelector(".jb__title")), sub: type(row.querySelector(".jb__sub")), meta: type(row.querySelector(".jb__meta i")),
        match: type(row.querySelector(".jb__mt b")), matchText: row.querySelector(".jb__mt b")?.textContent },
      panel: panel && { ...surface(panel), ...box(panel), padding: pp && cs(pp).padding,
        title: type(q(".posting--panel .posting__title")), company: type(q(".pp__co .company-link")), close: q(".pp__x") && { ...surface(q(".pp__x")), ...type(q(".pp__x")), text: q(".pp__x").textContent },
        facts: facts && { ...surface(facts), cells: [...facts.querySelectorAll(".posting__cell")].map(c => c.getAttribute("data-cell")),
          value: type(q(".posting__facts .posting__cell dd")), label: type(q(".posting__facts .posting__cell dt")) },
        match: match && { ...type(match), text: match.textContent, cellBg: cs(matchCell).backgroundColor, caption: q(".posting__match .atsn small")?.textContent },
        eyebrow: q(".posting__eyebrow") && { ...type(q(".posting__eyebrow")), text: q(".posting__eyebrow").textContent },
        body: type(q(".posting--panel .posting__body")), heading: type(q(".posting--panel .posting__h")),
        actions: ["pass", "save", "draft"].map(n => btn(n) && { name: n, text: btn(n).textContent.trim(), label: btn(n).getAttribute("aria-label"),
          mark: !!btn(n).querySelector('[role="img"]'), ...surface(btn(n)), ...type(btn(n)) }),
        more: q(".pp__moreb") && { ...surface(q(".pp__moreb")), ...type(q(".pp__moreb")), text: q(".pp__moreb").textContent.trim() },
        pinnedFoot: q(".pp__foot") && cs(q(".pp__foot")).position,
        boxes: Object.fromEntries([["co", ".pp__hd"], ["title", ".posting--panel .posting__title"], ["facts", ".posting__facts"], ["eyebrow", ".posting__eyebrow"], ["body", ".posting--panel .posting__body"], ["actions", ".pp__main-acts"], ["close", ".pp__x"], ["logo", ".pp__logo"]].map(([k, s]) => [k, box(q(s))])) },
    };
  },
};
if (process.argv[2] === "--styles") {
  const id = process.argv[3] || "deck";
  const s = SCREENS[id];
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.log(JSON.stringify({ skipped: "no Chrome" })); process.exit(0); }
  const vite = await startVite();
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  const out = {};
  try {
    for (const [size, [w, h]] of Object.entries(SIZES)) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }, { name: "prefers-reduced-motion", value: "reduce" }]);
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const raw = req.url();
        if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: "" });
        const u = new URL(raw);
        if (selfHostedFont(u, req)) return;
        if (!u.pathname.startsWith("/api/")) return req.continue();
        req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(s.fixtures[u.pathname] ?? COMMON[u.pathname] ?? {}) });
      });
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem("draft-theme", "dusk-dark"); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} });
      await page.goto(`${vite.url}${s.app}`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
      await page.evaluateHandle("document.fonts.ready").catch(() => {});
      if (s.ready) await page.waitForSelector(s.ready, { timeout: 30000 }).catch(() => {});
      await sleep(900);
      if (s.appPrep) await s.appPrep(page);   // D149: the screen's own state (Full House: the first posting open)
      out[size] = await page.evaluate(STYLE_PROBES[id]);
      await page.close();
    }
  } finally { await browser.close(); vite.proc.kill(); }
  console.log(JSON.stringify(out));
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
    for (const [size, dims] of Object.entries(SIZES)) {
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

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
      job: { ...job, id: job.jobId }, why: { matched: ["Python", "SQL", "Spark", "AWS"], missing: ["Kafka", "Airflow"], matchedTotal: 13, missingTotal: 2 }, report: null })) },
};
const FULLHOUSE = {
  "/api/jobs": { jobs: BOARD, total: 746, totalPages: 15, nextCursor: null, attribution: [] },
  "/api/jobs/facets": { total: 746, unscored: 0, coverage: { level: 746, where: 746, employment: 746 },
    views: { all: 746, saved: 12, pending: 3, imported: 0 }, clauses: { posted: [{ value: "", count: 746, known: 746 }, { value: "1d", count: 38, known: 38 }] } },
};
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

// ── The screens ───────────────────────────────────────────────────────────────────────────────────────────────────
// sketch: the file; sketchPrep: hide the sketch's own controls (they are not the design); app: the route, its fixtures,
// and what to press so the app shows the sketch's state.
const SKETCH_CONTROLS = ".ctl, .lay-ctl, .switch, .note, #note";
const SCREENS = {
  deck: { sketch: "declutter-v7.html", app: "/app", fixtures: DECK, ready: "[data-deck-face]" },
  fullhouse: { sketch: "fullhouse-declutter.html", app: "/app/jobs", fixtures: FULLHOUSE, ready: "[data-fh-title]",
    appPrep: async (page) => {   // the sketch shows the first posting open beside the list
      await page.evaluate(() => { const t = [...document.querySelectorAll("*")].find(e => e.children.length === 0 && e.textContent.trim() === "Senior Data Engineer"); t?.click(); });
      await sleep(900);
    } },
  settings: { sketch: "settings-declutter.html", app: "/app/auto-apply", fixtures: SETTINGS, ready: "[data-settings-open]",
    appPrep: async (page) => { await page.click("[data-settings-open]").catch(() => {}); await page.waitForSelector("[data-fold-top]", { timeout: 8000 }).catch(() => {}); await sleep(600); } },
};

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

const only = process.argv[2] ? process.argv[2].split(",") : Object.keys(SCREENS);
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
    }
  }
} finally {
  await browser.close();
  vite.proc.kill();
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\n${OUT}`);

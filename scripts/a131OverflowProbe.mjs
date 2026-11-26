#!/usr/bin/env node
/**
 * ⭐ A131 · NO SIDEWAYS OVERFLOW AT 1280 WITH A POSTING + ITS MATCH OPEN — measured in a real Chrome on STUBBED /api/*
 * (no server, no database, nobody's data: every answer is a synthetic fixture below). Drives the real client through vite.
 *
 *   node scripts/a131OverflowProbe.mjs            → one JSON line on stdout (test/a131NoSidewaysOverflow1280.test.js)
 *
 * At 1280 × 800 in Dusk Dark and Paper Light (and 920 × 800 in Dusk Dark, Home's one-column width above the phone rule): the board, then the first posting opened (it opens on the deck, D156 (1c)),
 * then its match opened under the facts (D152 (8)) — at each step `document.documentElement.scrollWidth` against the
 * viewport, and on an overflow the deepest element whose removal ends it (by elimination) plus every unclipped element
 * whose right edge passes the viewport.
 *
 * ⚠ The self-hosted fonts are handed to the browser from disk (fidelityShots.mjs's selfHostedFont): in a git worktree
 * vite refuses them, the fallback faces are narrower, and the 4 px overflow A131 is about does NOT show — the 45a run
 * that found it (d147FullHouseShots, main checkout) drew in the real faces.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { LOGO_HOST } from "../shared/companyLogos.js";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const PORT = 5203;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const now = Math.floor(Date.now() / 1000);
const COMPANIES = ["Northwind", "Fabrikam", "Contoso", "Tailspin", "Litware", "Adatum"];
const TITLES = ["Senior Data Engineer", "Machine Learning Engineer", "Data Platform Engineer", "Backend Engineer, Data", "Analytics Engineer", "Software Engineer II"];
const job = (i) => ({
  jobId: `j${i}`, id: `j${i}`, company: COMPANIES[i % 6], title: TITLES[i % 6],
  location: i % 2 ? "Boston, MA" : "Remote (US)", workType: i % 2 ? "Hybrid" : "Remote", tagWorkplace: i % 2 ? "hybrid" : "remote",
  url: `https://example.invalid/${i}`, applyUrl: `https://example.invalid/${i}`, source: "greenhouse", sourcePlatform: "greenhouse",
  postedAt: new Date((now - (i + 1) * 7200) * 1000).toISOString(), scrapedAt: now - i * 3600, discoveredAt: now - i * 3600, isActive: true,
  salaryMin: 140000 + i * 5000, salaryMax: 170000 + i * 5000,
  description: "We're looking for an engineer to build and run the pipelines behind our platform.\n\nWhat you'll do:\n- Design batch and streaming pipelines in Spark and Airflow\n- Model data for analytics\n\nWhat you'll bring:\n- 5+ years building data pipelines in production\n- Strong SQL and Python",
  skills: ["Python", "SQL", "Spark"], matchScore: 86 - i * 3, baseAtsScore: 86 - i * 3,
  liveness: i === 0 ? { kind: "open_long", label: "Open 94 days" } : null,
  sponsorship: i === 0 ? { level: "often", label: "Sponsors often", line: "140 certified LCAs", notice: "Not legal advice.", facts: [{ kind: "lca", text: "140 certified LCAs in FY2025" }], sources: [{ name: "DOL" }] } : null,
  visited: false, starred: i === 1, disliked: false, alreadyApplied: false, companyIconUrl: null,
});
const JOBS = Array.from({ length: 50 }, (_, i) => job(i));
const FIT_CARD = { score: 66, profileId: null, resumeTech: ["Spark"],
  report: { score: 66, claimed_matches: [], tier1_matched: ["Spark", "Airflow", "Python"], tier1_missing: ["Flink", "dbt"],
    action_verbs_matched: ["Design batch and streaming pipelines"], action_verbs_missing: ["Own the data platform roadmap"], competencies_matched: ["Senior level"], competencies_missing: [] },
  where: { Spark: "Northwind · bullet 1", Airflow: "Northwind · bullet 1", Python: "Northwind · bullet 2" },
  contextual: { score: 81, weights: { skill_match: 0.5, role_fit: 0.2, responsibility_overlap: 0.15, tech_stack: 0.15 },
    parts: { skill_match: { status: "ok", score: 80, weight: 0.5 }, role_fit: { status: "ok", score: 88, weight: 0.2 },
      tech_stack: { status: "ok", score: 75, weight: 0.15, of: 6, exact: [{ tech: "Spark", postings: 5, of: 6 }], ecosystem: [], gaps: [{ tech: "Flink", postings: 3, of: 6 }] },
      responsibility_overlap: { status: "ok", score: 70, weight: 0.15, matched: [], missing: [] } }, similarities: {}, dissimilarities: [] } };
const FIXTURES = {
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1, target_titles: ["Data Engineer"], seniority: "mid", generate_at_queue: 0 }],
  "/api/domain-profiles/1/base-resume": { name: "resume.pdf", content: "A. Lovelace — Data Engineer. 5 years. Python, SQL, Spark." },
  "/api/jobs/facets": { total: 50, unscored: 0, coverage: { level: 100, where: 100, employment: 100 }, views: { all: 50, saved: 1, pending: 0, imported: 0 },
    clauses: { posted: [{ value: "", label: "Any time", count: 50, known: 50 }, { value: "1d", label: "Past 24h", count: 9, known: 9 }] } },
  "/api/jobs": { jobs: JOBS, total: 50, totalPages: 1, nextCursor: null, attribution: [] },
  "/api/draft/slots": { limit: 10, used: 3, remaining: 7, drafts: 2, generations: 1, windowHours: 24 },
  "/api/applications/pending": { pending: [], verified: [], methods: [], verifyRule: {} },
  "/api/extension/status": { connected: false, state: "not_installed" },
  "/api/resumes": [], "/api/jobs/pending": [], "/api/applications": [],
  ...Object.fromEntries(JOBS.slice(0, 5).map(j => [`/api/jobs/by-id/${j.jobId}`, { job: j }])),
};

// fidelityShots.mjs's selfHostedFont: a worktree's vite refuses @fontsource's files (outside fs.allow) — read from disk.
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

// In the page: is the document wider than the viewport, and if so what widens it.
function measure() {
  const vw = document.documentElement.clientWidth;
  const sw = document.documentElement.scrollWidth;
  const over = sw > vw;
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className?.baseVal ?? el.className).trim().split(/\s+/).join(".")}[${[...el.attributes].filter(a => a.name.startsWith("data-")).map(a => a.name).join(" ")}]`;
  const clipped = (el) => { for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { if (getComputedStyle(a).overflowX !== "visible") return true; } return false; };
  const sticking = [];
  const path = [];
  if (over) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 0.5 && !clipped(el)) sticking.push(`${name(el)} right=${r.right.toFixed(1)} w=${r.width.toFixed(1)}`);
    }
    const fits = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth;
    let at = document.body;
    while (at) {
      let next = null;
      for (const c of at.children) {
        const was = c.style.display; c.style.display = "none"; const ok = fits(); c.style.display = was;
        if (ok) { next = c; break; }
      }
      if (!next) break;
      path.push(name(next)); at = next;
    }
  }
  // the stuck bar's frost (a pseudo-element: no box of its own to query) — its right edge from the bar's and its inset
  const bar = document.querySelector("[data-board-sticky]");
  let frostRight = null;
  if (bar && bar.getAttribute("data-stuck") === "true") {
    const pr = getComputedStyle(bar, "::before").right;
    if (pr && pr !== "auto") frostRight = Math.round((bar.getBoundingClientRect().right - parseFloat(pr)) * 10) / 10;
  }
  return { vw, sw, over, frostRight, sticking: sticking.slice(-8), elimination: path.slice(-5) };
}

const out = {};
const resolution = await resolveBrowserExecutable();
if (!resolution) { console.log(JSON.stringify({ skipped: "no Chrome binary" })); process.exit(0); }
const vite = await startVite();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
try {
  for (const [w, theme] of [[1280, "dusk-dark"], [1280, "paper-light"], [920, "dusk-dark"]]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const raw = req.url();
      if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: "" });
      const u = new URL(raw);
      if (selfHostedFont(u, req)) return;
      if (!u.pathname.startsWith("/api/")) return req.continue();
      // 47i: the opening sheet's FitCard reads its own payload — a small sample so the back face (Every word) is drawn
      const body = /^\/api\/jobs\/[^/]+\/fit-card$/.test(u.pathname) ? FIT_CARD : (FIXTURES[u.pathname] ?? {});
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} }, theme);
    // ⭐ 47g R1 (the classic market retires): A131 measured on the PLATE market. The posting opens from its Index row (the
    // openings turn to Deck, A240); the board's bar — and the stuck frost A131 is about — lives in the Index tab, so the
    // stuck state is measured there, scrolled past the bar. Every step: never wider than the window.
    const tab = (name) => page.evaluate((n) => [...document.querySelectorAll(".pl-marketopenings [role=tab]")].find(t => new RegExp(n, "i").test(t.textContent))?.click(), name);
    await page.goto(`${vite.url}/app/jobs`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    await page.evaluateHandle("document.fonts.ready").catch(() => {});
    await page.waitForSelector("[data-plate-market-openings]", { timeout: 30000 }).catch(() => {});
    await sleep(1500);
    const r = { fonts: await page.evaluate(() => [...document.fonts].filter(f => f.status === "loaded").map(f => f.family).filter((v, i, a) => a.indexOf(v) === i)) };
    r.board = await page.evaluate(measure);
    await tab("index");
    await page.waitForSelector("[data-market-index] [data-index-title]", { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => { const rows = [...document.querySelectorAll("[data-market-index] [data-index-title]")];
      (rows.find(e => e.textContent.trim() === "Senior Data Engineer") || rows[0])?.click(); });
    // ⭐ 47i: since D199 C7 (47h) the Index row opens the OPENING SHEET (`/app/jobs/<id>`), not the classic posting panel —
    // "a posting opened" = the sheet; "more" = its 04 full posting scrolled into view; "its match" = FitCard turned to the
    // ATS card's back face on its Every word tab (the widest table the sheet draws).
    await page.waitForSelector("[data-opening-sheet]", { timeout: 15000 }).catch(() => {});
    await sleep(1200);
    r.postingOpen = !!(await page.$("[data-opening-sheet]"));
    r.posting = await page.evaluate(measure);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(500);
    r.more = await page.evaluate(measure);
    await page.evaluate(() => document.querySelector('.pl-fitcard [data-fit-turn]')?.click()); await sleep(600);
    await page.evaluate(() => document.querySelector('[data-fit-tabbtn="words"], [data-fit-tabbtn="every"]')?.click()
      || [...document.querySelectorAll("[data-fit-tabbtn]")].find(b => /every word/i.test(b.textContent))?.click()); await sleep(600);
    r.matchOpen = !!(await page.$('[data-fit-face="back"]'));
    r.match = await page.evaluate(measure);
    // THE CAUSE (A131): the board's bar STICKS when the page scrolls past it, and its stuck frost (FullHouse.css
    // `.fh.fh--bar-row[data-stuck="true"]::before`) reached past the page's gutter. On the plate the bar is the Index tab's —
    // back to the market for it.
    await page.goBack({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
    await page.waitForSelector("[data-plate-market-openings]", { timeout: 20000 }).catch(() => {});
    await sleep(800);
    await tab("index"); await sleep(600);
    await page.evaluate(() => window.scrollTo(0, (document.querySelector("[data-board-sticky]")?.getBoundingClientRect().top || 0) + window.scrollY + 300));
    await sleep(700);
    r.scrolled = await page.evaluate(measure);
    r.stuck = await page.evaluate(() => document.querySelector("[data-board-sticky]")?.getAttribute("data-stuck") || null);
    if (process.argv.includes("--shot")) await page.screenshot({ path: path.join(process.argv[process.argv.indexOf("--shot") + 1], `a131-${w}-${theme}.png`) });
    r.errors = errors.slice(0, 3);
    out[`${w}-${theme}`] = r;
    await page.close();
  }
} finally {
  await browser.close();
  vite.proc.kill();
}
console.log(JSON.stringify(out));

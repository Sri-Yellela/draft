#!/usr/bin/env node
/**
 * ⭐ D147 · FULL HOUSE AND THE OPENED POSTING, RESTYLED — walked in a real Chrome on STUBBED /api/* (no server, no
 * database, nobody's data: every answer is a synthetic fixture below). Drives the real client through vite.
 *
 *   node scripts/d147FullHouseShots.mjs [--out <dir>]
 *
 * At 1280 × 800 and 390 × 844, in Dusk Dark and Paper Light, it checks and prints ok / FAIL per item:
 *   · the title "Full House" and ONE Sort / view word ("Sort: For you"); no symbol views (ALL ★ /d +) on the first screen
 *   · the sentence in the serif at ≈ 30px (desktop); the search under it; the counts (jobs · new today · saved)
 *   · the sort panel holds the views as words (All jobs · Saved · Pending · Imported)
 *   · no page numbers; scrolling to the end of the list appends page 2
 *   · a posting opened: logo · company link · location · Close; the facts box with the match box at its end; nothing
 *     between the facts and the description; Pass · Save · Draft · More; More → Résumé for this job · Cover letter ·
 *     I applied myself; the match box opens the ATS panel; on the phone the posting is full screen
 *   · no sideways scroll, no page errors
 * Screenshots go to --out (default: the job's scratch dir, never the repo).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { LOGO_HOST } from "../shared/companyLogos.js";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", path.join(os.tmpdir(), "d147-shots"));
const PORT = 5197;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (where, name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${where} · ${name}${detail ? ` — ${detail}` : ""}`); };

const now = Math.floor(Date.now() / 1000);
const COMPANIES = ["Northwind", "Fabrikam", "Contoso", "Tailspin", "Litware", "Adatum"];
const TITLES = ["Senior Data Engineer", "Machine Learning Engineer", "Data Platform Engineer", "Backend Engineer, Data", "Analytics Engineer", "Software Engineer II"];
const job = (i) => ({
  jobId: `j${i}`, id: `j${i}`, company: COMPANIES[i % 6], title: `${TITLES[i % 6]}${i >= PER ? " (page 2)" : ""}`,
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
const PER = 50;   // the board's page size (D11)
const PAGE1 = Array.from({ length: PER }, (_, i) => job(i));
const PAGE2 = Array.from({ length: PER }, (_, i) => job(i + PER));
const FACETS = {
  total: 100, unscored: 0, coverage: { level: 100, where: 100, employment: 100 },
  views: { all: 100, saved: 1, pending: 0, imported: 0 },
  clauses: { posted: [{ value: "", label: "Any time", count: 100, known: 100 }, { value: "1d", label: "Past 24h", count: 9, known: 9 }] },
};
const FIXTURES = {
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1, target_titles: ["Data Engineer"], seniority: "mid", generate_at_queue: 0 }],
  "/api/domain-profiles/1/base-resume": { name: "resume.pdf", content: "A. Lovelace — Data Engineer. 5 years. Python, SQL, Spark." },
  "/api/jobs/facets": FACETS,
  "/api/draft/slots": { limit: 10, used: 3, remaining: 7, drafts: 2, generations: 1, windowHours: 24 },
  "/api/applications/pending": { pending: [], verified: [], methods: [], verifyRule: {} },
  "/api/extension/status": { connected: false, state: "not_installed" },
  "/api/resumes": [], "/api/jobs/pending": [], "/api/applications": [],
};
function fixtureFor(url) {
  if (url.pathname === "/api/jobs") {
    const page = Number(url.searchParams.get("page") || (url.searchParams.get("cursor") ? 2 : 1));
    if (url.searchParams.get("starred") === "1") return { jobs: PAGE1.filter(j => j.starred), total: 1, totalPages: 1 };
    return page >= 2 ? { jobs: PAGE2, total: 100, totalPages: 2, nextCursor: null, attribution: [] }
      : { jobs: PAGE1, total: 100, totalPages: 2, nextCursor: null, attribution: [] };
  }
  if (url.pathname.startsWith("/api/company/")) return { company: "Northwind", hasData: false };
  return FIXTURES[url.pathname] ?? {};
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

fs.mkdirSync(OUT, { recursive: true });
const resolution = await resolveBrowserExecutable();
if (!resolution) { console.error("No Chrome binary."); process.exit(1); }
const vite = await startVite();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
try {
  for (const [w, h, theme] of [[1280, 800, "dusk-dark"], [1280, 800, "paper-light"], [390, 844, "dusk-dark"], [390, 844, "paper-light"]]) {
    const where = `${w}-${theme}`;
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const raw = req.url();
      if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: "" });
      const url = new URL(raw, vite.url);
      if (!url.pathname.startsWith("/api/")) return req.continue();
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(fixtureFor(url)) });
    });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch {} }, theme);
    await page.goto(`${vite.url}/app/jobs`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    await page.waitForSelector("[data-fh-title]", { timeout: 30000 }).catch(() => {});
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, `${where}-1-board.png`) });

    const top = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const vis = (el) => !!el && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden";
      const bh = q("[data-board-headline]");
      const cs = bh ? getComputedStyle(bh) : null;
      return {
        title: q(".fh-title__h")?.textContent || null,
        sort: q('[data-board-icon="sort"]')?.textContent?.trim() || null,
        views: [...document.querySelectorAll("[data-view]")].filter(vis).length,
        family: cs?.fontFamily || "", size: cs ? parseFloat(cs.fontSize) : 0,
        tokens: document.querySelectorAll("[data-board-headline] .tok").length,
        searchAfter: !!(bh && q(".fh-srch") && (bh.compareDocumentPosition(q(".fh-srch")) & Node.DOCUMENT_POSITION_FOLLOWING)),
        counts: [...document.querySelectorAll("[data-board-counts] [data-count]")].map(c => c.textContent.trim()),
        pager: /Go to page/.test(document.body.innerText),
        more: !!q("[data-board-more]"),
        rows: document.querySelectorAll("[data-job-bubble], .jb").length,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    check(where, "title + one Sort word", top.title === "Full House" && /^Sort: For you/.test(top.sort || ""), `${top.title} | ${top.sort}`);
    check(where, "no symbol views on the first screen", top.views === 0, `${top.views} visible`);
    check(where, "the sentence in the serif, its words the controls", /Instrument Serif/i.test(top.family) && top.tokens > 0 && (w < 500 || Math.abs(top.size - 30) <= 1), `${top.family.split(",")[0]} ${top.size}px · ${top.tokens} words`);
    check(where, "the search under the sentence", top.searchAfter);
    check(where, "counts: jobs · new today · saved", top.counts.length === 3 && /100jobs/.test(top.counts[0]) && /9new today/.test(top.counts[1]) && /1saved/.test(top.counts[2]), top.counts.join(" | "));
    check(where, "no page numbers, the end-of-list line", !top.pager && top.more);
    check(where, "no sideways scroll (board)", !top.sideways);

    // The sort panel holds the views, as words.
    await page.click('[data-board-icon="sort"]');
    await sleep(400);
    const views = await page.$$eval("[data-sort-views] [data-view]", els => els.map(e => e.textContent.trim()));
    check(where, "the views as words in the Sort panel", views.length === 4 && /^All jobs100/.test(views[0]) && /^Saved/.test(views[1]) && /^Pending/.test(views[2]) && /^Imported/.test(views[3]), views.join(" | "));
    await page.screenshot({ path: path.join(OUT, `${where}-2-sort.png`) });
    await page.click('[data-board-icon="sort"]');
    await sleep(300);

    // Scrolling appends page 2.
    const before = await page.evaluate(() => document.body.innerText.includes("(page 2)"));
    for (let i = 0; i < 10; i++) { await page.evaluate(() => { document.querySelector("[data-board-more]")?.scrollIntoView({ block: "end" }); window.scrollTo(0, document.body.scrollHeight); }); await sleep(500); }
    const after = await page.evaluate(() => ({ p2: document.body.innerText.includes("(page 2)"), p1: document.body.innerText.includes("Senior Data Engineer") }));
    check(where, "scrolling appends page 2 under page 1", !before && after.p2 && after.p1, JSON.stringify({ before, ...after }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);

    // Open the first posting.
    await page.evaluate(() => {
      const t = [...document.querySelectorAll("*")].find(e => e.children.length === 0 && e.textContent.trim() === "Senior Data Engineer");
      t?.click();
    });
    await page.waitForSelector("[data-jd-panel]", { timeout: 10000 }).catch(() => {});
    await sleep(900);
    const p = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const panel = q("[data-jd-panel]");
      if (!panel) return null;
      const hd = q("[data-posting-header]");
      const facts = q("[data-posting-facts]");
      const body = q("[data-posting-body]");
      // Elements strictly between the facts box and the description, in document order.
      const between = [];
      if (facts && body) {
        const walker = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT);
        let on = false;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (n === body) break;
          if (on && !facts.contains(n) && n.textContent.trim() && !n.contains(body)) between.push(n.className || n.tagName);
          if (n === facts) on = true;
        }
      }
      const shell = panel.closest("[data-panel-id]");
      return {
        logo: !!hd?.querySelector("[data-company-hiring]"), link: hd?.querySelector("[data-apply-link]")?.textContent || null,
        loc: hd?.querySelector("[data-posting-location]")?.textContent || null, close: hd?.querySelector("[data-posting-close]")?.textContent || null,
        atsInHeader: !!hd?.querySelector("[data-ats-box]"),
        cells: [...document.querySelectorAll("[data-posting-facts] [data-cell]")].map(c => c.getAttribute("data-cell")),
        match: q("[data-posting-match] [data-ats-box]")?.textContent || null,
        between: between.filter(c => !/posting__mast|posting__title/.test(String(c))),
        acts: [...document.querySelectorAll("[data-d147-actions] > *")].map(b => b.textContent.trim()),
        shellW: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
        inShort: /In short|Hiring\?/.test(panel.innerText),
      };
    });
    check(where, "a posting opens", !!p);
    if (p) {
      check(where, "header: logo · company → posting · location · Close", p.logo && p.link === "Northwind" && p.loc === "Remote (US)" && p.close === "Close" && !p.atsInHeader, JSON.stringify([p.logo, p.link, p.loc, p.close, p.atsInHeader]));
      check(where, "the facts box + history / sponsorship cells", p.cells.join() === "experience,workstyle,salary,posted,history,sponsorship", p.cells.join());
      check(where, "the match box at the facts box's end", /86/.test(p.match || "") && /match/.test(p.match || ""), p.match);
      check(where, "nothing between the facts and the description", p.between.length === 0 && !p.inShort, p.between.join(", "));
      check(where, "Pass · Save · Draft · More", p.acts.length === 4 && /Pass/.test(p.acts[0]) && /Save/.test(p.acts[1]) && /More/.test(p.acts[3]), p.acts.join(" | "));
      // The panel host's phone sheet (usePanelHost's full-screen fallback, unchanged by D147) keeps 8px gutters.
      if (w < 500) check(where, "the posting is full screen on a phone (the host's sheet)", p.shellW >= w - 20, `${p.shellW}px of ${w}`);
      await page.screenshot({ path: path.join(OUT, `${where}-3-posting.png`) });
      await page.click("[data-posting-more-toggle]");
      await sleep(300);
      const more = await page.$$eval("[data-posting-more] button", els => els.map(e => e.textContent.trim()));
      check(where, "More → Résumé for this job · Cover letter · I applied myself", more.some(t => /Résumé for this job/.test(t)) && more.some(t => /Cover letter/.test(t)) && more.some(t => /I applied myself/.test(t)), more.join(" | "));
      await page.screenshot({ path: path.join(OUT, `${where}-4-more.png`) });
      await page.click("[data-posting-match] [data-ats-box]");
      await sleep(900);
      check(where, "the match box opens the ATS panel", !!(await page.$('[data-panel-id="ats"]')));
      await page.screenshot({ path: path.join(OUT, `${where}-5-ats.png`) });
    }
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(where, "no sideways scroll (posting)", !sideways);
    check(where, "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
    await page.close();
  }
} finally {
  await browser.close();
  vite.proc.kill();
}
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
console.log(`screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * ⭐ D148 · THE AUTO-APPLY SETTINGS DRAWER, RESTYLED — walked in a real Chrome on STUBBED /api/* (no server, no
 * database, nobody's data). Drives the real client through vite.
 *
 *   node scripts/d148SettingsShots.mjs [--out <dir>]
 *
 * At 1280 × 800 and 390 × 844, in Dusk Dark and Paper Light: Draft House → Settings, then checks (ok / FAIL):
 *   · the title "Auto-apply" and Close; the mode first, two choices, the current one pressed
 *   · the folds in order, each ONE line with its value (When · How many · Which jobs · Before sending · Tell me ·
 *     Pausing · View; Accounts hidden — nothing in it); none open
 *   · pressing How many opens only it (eyebrow + headline + the stepper + Done); + raises the value and the line
 *     follows after Done; pressing When closes How many; Pausing shows Pause everything now and what it does
 *   · the limits are one line "Today: n sent of N · Details"; Details opens the full limits
 *   · a change is saved through PUT /api/apply/auto-settings with the whole object
 *   · no sideways scroll, no page errors
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
const OUT = arg("--out", path.join(os.tmpdir(), "d148-shots"));
const PORT = 5198;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (where, name, ok, detail = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${where} · ${name}${detail ? ` — ${detail}` : ""}`); };

const SETTINGS = { dailyCap: 10, runTimes: ["09:00", "18:00"], timeZone: "America/New_York", pauseCompanyAfterReply: true, filters: {},
  profileId: null, agreeToTerms: false, staleReposts: 3, staleOpenDays: 90, showFormBeforeSending: true, onlySponsorRecord: true,
  perCompanyLimit30d: null, picks: false, bestBets: 5 };
const FIXTURES = {
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1, target_titles: ["Data Engineer"] }],
  "/api/apply/run-bar": { mode: { current: "semi", auto: { locked: false } }, windowHours: 24,
    caps: [{ id: "queue", label: "Previews", used: 6, limit: 40 }, { id: "approval", label: "Approvals", used: 5, limit: 30 }, { id: "submission", label: "Submitted", used: 4, limit: 25 }],
    hold: { held: false, since: null } },
  "/api/notify/settings": { email: { offered: true }, push: { offered: true }, events: [{ key: "picks", label: "New picks", what: "", email: true, push: true }] },
  "/api/portals": { portals: [], accounts: [], worker: false },
  "/api/gmail/status": { available: false },
  "/api/apply/runs": { runs: [], review: [], gated: [], inFlight: [], submitted: [], stopped: [], statusCounts: {} },
  "/api/apply/pending": { pending: [], approvalCap: { remaining: 10, limit: 10 } },
  "/api/applications": [], "/api/applications/pending": { pending: [], verified: [], methods: [], verifyRule: {} },
  "/api/resumes": [], "/api/jobs/pending": [],
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
    const puts = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const raw = req.url();
      if (raw.startsWith(LOGO_HOST)) return req.respond({ status: 404, body: "" });
      const url = new URL(raw, vite.url);
      if (!url.pathname.startsWith("/api/")) return req.continue();
      if (url.pathname === "/api/apply/auto-settings") {
        if (req.method() === "PUT") { const b = JSON.parse(req.postData() || "{}"); puts.push(b); return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ settings: b.settings }) }); }
        return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ settings: SETTINGS }) });
      }
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(FIXTURES[url.pathname] ?? {}) });
    });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch {} }, theme);
    await page.goto(`${vite.url}/app/auto-apply`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    await page.waitForSelector("[data-settings-open]", { timeout: 30000 }).catch(() => {});
    await sleep(800);
    await page.click("[data-settings-open]").catch(() => {});
    await page.waitForSelector("[data-fold-top]", { timeout: 10000 }).catch(() => {});
    await sleep(700);
    await page.screenshot({ path: path.join(OUT, `${where}-1-drawer.png`) });

    const first = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const d = q("[data-settings-drawer]");
      return {
        title: q("#dh-settings-title")?.textContent, close: q("[data-settings-close]")?.textContent,
        modes: [...document.querySelectorAll("[data-settings-mode] button")].map(b => `${b.querySelector("b")?.textContent}:${b.getAttribute("aria-pressed")}`),
        modeFirst: !!(q("[data-settings-mode]") && q("[data-fold-top]") && (q("[data-settings-mode]").compareDocumentPosition(q("[data-fold-top]")) & Node.DOCUMENT_POSITION_FOLLOWING)),
        folds: [...document.querySelectorAll("[data-fold-top]")].map(b => `${b.querySelector("b").textContent}=${b.querySelector("[data-fold-value]").textContent}`),
        open: document.querySelectorAll(".dh-fold2__body").length,
        limits: q("[data-caps-used] summary")?.textContent?.trim() || null,
        drawerW: d ? Math.round(d.getBoundingClientRect().width) : 0,
      };
    });
    check(where, "title + Close", first.title === "Auto-apply" && first.close === "Close", `${first.title} | ${first.close}`);
    check(where, "the mode first, two choices, Ask me first pressed", first.modeFirst && first.modes.join() === "Ask me first:true,Apply for me:false", first.modes.join());
    const want = ["When=9 AM and 6 PM, New York time", "How many=up to 10 a day", "Which jobs=sponsors only · skips stale posts", "Before sending=show me the form",
      "Tell me=by email and notification", "Pausing=pause after an interview", "View=the table"];
    check(where, "the folds, each one line with its value (Accounts hidden)", first.folds.join("|") === want.join("|"), first.folds.join(" | "));
    check(where, "none open at first", first.open === 0);
    check(where, "the limits: one line", first.limits === "Today: 4 sent of 10 · Details", first.limits);

    // Open How many; + raises it; Done folds it and the line follows.
    await page.click('[data-fold-top="howmany"]');
    await sleep(300);
    const hm = await page.evaluate(() => ({
      open: [...document.querySelectorAll(".dh-fold2__body")].map(b => b.closest("[data-settings-group]").getAttribute("data-settings-group")),
      eyebrow: document.querySelector(".dh-fold2__eyebrow")?.textContent, head: document.querySelector(".dh-fold2__h")?.textContent,
      n: document.querySelector("[data-daily-cap] b")?.textContent,
    }));
    check(where, "How many opens alone, in the eyebrow + headline type", hm.open.join() === "howmany" && hm.eyebrow === "How many" && hm.head === "At most this many a day" && hm.n === "10", JSON.stringify(hm));
    await page.screenshot({ path: path.join(OUT, `${where}-2-howmany.png`) });
    await page.click('[data-daily-cap] button[aria-label="More"]');
    await sleep(900);   // the save waits 500 ms
    await page.click('[data-fold-done="howmany"]');
    await sleep(200);
    const line = await page.$eval('[data-fold-top="howmany"] [data-fold-value]', e => e.textContent).catch(() => null);
    check(where, "the change saves whole and the line follows", line === "up to 11 a day" && puts.length >= 1 && puts.at(-1).settings?.dailyCap === 11 && puts.at(-1).settings?.runTimes?.length === 2, `${line} · ${puts.length} PUT`);

    // One at a time: When, then Pausing.
    await page.click('[data-fold-top="when"]');
    await sleep(200);
    await page.click('[data-fold-top="pausing"]').catch(() => {});
    await sleep(300);
    const p = await page.evaluate(() => ({
      open: [...document.querySelectorAll(".dh-fold2__body")].map(b => b.closest("[data-settings-group]").getAttribute("data-settings-group")),
      pause: document.querySelector("[data-pause-now]")?.textContent, says: document.querySelector("[data-stop-says]")?.textContent || "",
    }));
    check(where, "one fold open at a time", p.open.join() === "pausing", p.open.join());
    check(where, "Pause everything now, and what it does", p.pause === "Pause everything now" && p.says.length > 40, p.says.slice(0, 60));
    await page.screenshot({ path: path.join(OUT, `${where}-3-pausing.png`) });
    await page.click('[data-fold-done="pausing"]');
    await page.evaluate(() => { const d = document.querySelector("[data-caps-used]"); d?.scrollIntoView(); d?.querySelector("summary")?.click(); });
    await sleep(300);
    const det = await page.$eval("[data-caps-detail]", e => e.textContent).catch(() => null);
    check(where, "Details opens the full limits", /Previews 6 of 40 · Approvals 5 of 30 · Submitted 4 of 25/.test(det || ""), det);
    if (w < 500) check(where, "the drawer fills a phone", first.drawerW >= w - 2, `${first.drawerW}px`);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(where, "no sideways scroll", !sideways);
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

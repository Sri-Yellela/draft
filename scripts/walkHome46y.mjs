#!/usr/bin/env node
// ⭐ 46y · HOME AGAINST docs/sketches/home-sketch.html (D167 on D146) — a real-Chrome walk of /app/auto-apply (Home) on a
// vite dev server with STUBBED /api answers (synthetic applications + Inbox messages; no server, no database, nobody's
// data), in plain-light and dusk-dark at 1440 × 900 and 400 × 860, beside the sketch at the same sizes and colour scheme.
//   node scripts/walkHome46y.mjs [--out tmp/walk46y-home]
// Writes <out>/<theme>-<w>-{home,inbox,open}.png, sketch-<scheme>-<w>-{apps,inbox}.png and home.json (the pieces measured).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(ROOT, arg("--out", "tmp/walk46y-home"));
const PORT = 5197;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);

const SETTINGS = {
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1, target_titles: ["Data Engineer"] }],
  "/api/draft/slots": { limit: 10, used: 3, remaining: 7, drafts: 2, generations: 1, windowHours: 24 },
  "/api/extension/status": { connected: true, state: "connected" },
  "/api/apply/auto-settings": { settings: { dailyCap: 10, runTimes: ["09:00", "18:00"], timeZone: "America/New_York", pauseCompanyAfterReply: true,
    filters: {}, profileId: null, agreeToTerms: false, staleReposts: 3, staleOpenDays: 90, showFormBeforeSending: true, onlySponsorRecord: true, perCompanyLimit30d: 2 } },
  "/api/apply/run-bar": { mode: { current: "semi", auto: { locked: false } }, windowHours: 24, hold: { held: false, since: null },
    caps: [{ id: "queue", label: "Previews", used: 6, limit: 40 }, { id: "approval", label: "Approvals", used: 5, limit: 30 }, { id: "submission", label: "Submitted", used: 4, limit: 25 }] },
  "/api/notify/settings": { email: { offered: true }, push: { offered: true }, events: [] },
  "/api/portals": { portals: [], accounts: [], worker: false }, "/api/gmail/status": { available: false },
};
const H = { jobId: "trk-h", company: "Halcyon", title: "Machine Learning Engineer" };
const Q = { jobId: "trk-q", company: "Quanta", title: "Data Engineer" };
const L = { jobId: "trk-l", company: "Lumen", title: "Backend Engineer" };
const V = { jobId: "trk-v", company: "Vireo", title: "Data Platform Engineer" };
const N = { jobId: "trk-n", company: "Northwind", title: "Senior Data Engineer" };
const B = { jobId: "trk-b", company: "Basalt", title: "Software Engineer, Platform" };
const nextTue = (() => { const d = new Date(); d.setDate(d.getDate() + (((2 - d.getDay()) + 7) % 7 || 7)); return d.toLocaleDateString("en-CA"); })();
const pick = (j, id) => ({ id, jobId: j.jobId, company: j.company, title: j.title, state: "applied" });
const FIX = {
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
    { id: 3, slotAt: now - 3 * 3600, seen: 50, picked: 4, picks: [pick(H, 31), pick(Q, 32), pick(L, 33), pick(V, 34)] },
    { id: 2, slotAt: now - 20 * 3600, seen: 32, picked: 3, picks: [pick(N, 21), pick(B, 23)] },
  ] },
  "/api/inbox": { intake: true, categories: ["applied", "verification", "interview", "assessment", "recruiter", "reminder", "offer", "rejection", "other"], messages: [
    { id: 1, from: "talent@vireo.example", subject: "Let's set up a quick call", receivedAt: now - 3600, category: "interview", applicationId: 201, preview: "Hi Ada, could you do a 30-minute call on Tuesday at 2:00 pm?", source: "gmail" },
    { id: 2, from: "no-reply@greenhouse.example", subject: "Thanks for applying to Northwind", receivedAt: now - 3 * 86400, category: "applied", applicationId: 202, preview: "Thanks for applying to Senior Data Engineer.", source: "forward" },
    { id: 3, from: "jobs@basalt.example", subject: "An update on your application", receivedAt: now - 14 * 86400, category: "rejection", applicationId: 203, preview: "We have decided to move forward with other candidates.", source: "forward" },
    { id: 4, from: "no-reply@myworkday.example", subject: "Your verification code", receivedAt: now - 8 * 86400, category: "verification", applicationId: null, code: "••••••", preview: "Your code is ••••••.", source: "forward" },
  ] },
};

function selfHostedFont(u, req) {
  if (!u.pathname.startsWith("/@fs/") || !/\.(woff2?|ttf)$/.test(u.pathname)) return false;
  const file = decodeURIComponent(u.pathname.slice(4).replace(/^\/([A-Za-z]:)/, "$1"));
  if (!fs.existsSync(file)) return false;
  req.respond({ status: 200, contentType: "font/woff2", headers: { "Access-Control-Allow-Origin": "*" }, body: fs.readFileSync(file) });
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

// What the page shows, piece by piece (the sketch's pieces, in its order).
const PROBE = () => {
  const q = (s) => document.querySelector(s);
  const cs = (e) => e && getComputedStyle(e);
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const t = (e) => e && e.textContent.replace(/\s+/g, " ").trim().slice(0, 160);
  const h1 = q(".dh-head h1");
  return {
    title: h1 && { text: t(h1), font: cs(h1).fontFamily.split(",")[0], size: cs(h1).fontSize, weight: cs(h1).fontWeight },
    headLine: [...document.querySelectorAll(".dh-head__text p")].map(t),
    headButtons: [...document.querySelectorAll(".dh-head__ctl button")].map(b => t(b)),
    autoBar: q("[data-home-auto]") ? t(q("[data-home-auto]")) : null,
    needsCards: [...document.querySelectorAll("[data-home-need]")].map(t),
    tabs: [...document.querySelectorAll("[data-home-tab]")].map(b => ({ text: t(b), pressed: b.getAttribute("aria-pressed") })),
    counts: t(q("[data-tracker-counts]")),
    filters: t(q(".trk-filters")),
    columns: [...document.querySelectorAll("[data-tracker-table] thead th")].map(t),
    rows: [...document.querySelectorAll("[data-tracker-table] tbody tr.trk-row")].map(t).slice(0, 8),
    timeline: q("[data-draft-tree], .dht") ? { head: t(q(".dht-head")), box: box(q("[data-draft-tree], .dht")) } : null,
    inbox: q("[data-home-inbox]") ? { box: box(q("[data-home-inbox]")), items: [...document.querySelectorAll("[data-inbox-message]")].map(t) } : null,
    scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    bodyBg: cs(document.body).backgroundColor,
  };
};

fs.mkdirSync(OUT, { recursive: true });
const res = await resolveBrowserExecutable();
if (!res) { console.error("no Chrome"); process.exit(1); }
const vite = await startVite();
const browser = await puppeteer.launch({ executablePath: res.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files"] });
const report = {};
try {
  for (const [w, h] of [[1440, 900], [400, 860]]) {
    // the sketch, both schemes
    for (const scheme of ["light", "dark"]) {
      const p = await browser.newPage();
      await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }, { name: "prefers-reduced-motion", value: "reduce" }]);
      await p.goto(pathToFileURL(path.join(ROOT, "docs", "sketches", "home-sketch.html")).href, { waitUntil: "load" });
      await sleep(600);
      fs.writeFileSync(path.join(OUT, `sketch-${scheme}-${w}-apps.png`), await p.screenshot({ type: "png", fullPage: true }));
      await p.evaluate(() => document.querySelector('[data-t="inbox"]')?.click()); await sleep(300);
      fs.writeFileSync(path.join(OUT, `sketch-${scheme}-${w}-inbox.png`), await p.screenshot({ type: "png", fullPage: true }));
      await p.close();
    }
    for (const theme of ["plain-light", "dusk-dark"]) {
      const key = `${theme}-${w}`;
      const p = await browser.newPage();
      const errors = [];
      p.on("pageerror", e => errors.push(String(e.message).slice(0, 200)));
      await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
      await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme.endsWith("dark") ? "dark" : "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
      await p.setRequestInterception(true);
      p.on("request", (req) => {
        const u = new URL(req.url());
        if (selfHostedFont(u, req)) return;
        if (!u.pathname.startsWith("/api/")) return u.hostname === "localhost" ? req.continue() : req.respond({ status: 404, body: "" });
        req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(FIX[u.pathname] ?? {}) });
      });
      await p.evaluateOnNewDocument((th) => { try { localStorage.setItem("draft-theme", th); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} }, theme);
      await p.goto(`${vite.url}/app/auto-apply`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
      await p.waitForSelector("[data-tracker-table] tbody tr", { timeout: 30000 }).catch(() => {});
      await sleep(1200);
      report[key] = { home: await p.evaluate(PROBE) };
      fs.writeFileSync(path.join(OUT, `${key}-home.png`), await p.screenshot({ type: "png", fullPage: true }));
      // a row opened in place
      await p.evaluate(() => document.querySelector("[data-tracker-table] tbody tr.trk-row")?.click()); await sleep(600);
      fs.writeFileSync(path.join(OUT, `${key}-open.png`), await p.screenshot({ type: "png", fullPage: true }));
      await p.keyboard.press("Escape"); await sleep(300);
      // the Inbox (Home's second part)
      const hasTab = await p.evaluate(() => { const b = document.querySelector('[data-home-tab="inbox"]'); if (b) b.click(); return !!b; });
      if (hasTab) {
        await p.waitForSelector("[data-inbox-message]", { timeout: 10000 }).catch(() => {});
        await sleep(600);
        report[key].inbox = await p.evaluate(PROBE);
        fs.writeFileSync(path.join(OUT, `${key}-inbox.png`), await p.screenshot({ type: "png", fullPage: true }));
      }
      report[key].errors = errors.slice(0, 3);
      await p.close();
      console.log(key, JSON.stringify(report[key].home).slice(0, 400));
    }
  }
} finally { await browser.close(); vite.proc.kill(); }
fs.writeFileSync(path.join(OUT, "home.json"), JSON.stringify(report, null, 2));
console.log(OUT);

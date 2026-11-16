#!/usr/bin/env node
/**
 * ⭐ 46q · THE DEMO VIDEO, ONE COMMAND (owner 11-16: "a new demo run video for yc to update the older one"; the brief:
 * ≤ 180 s, production, "good enough" resolution, short burned-in captions naming each step, no voice). It walks the
 * product as it is now — the board and today's picks, a posting, Draft, Home (the applications), Tiny, Atlas, Profile —
 * in a real Chrome on an ALREADY SIGNED-IN profile (the owner signs in once; this script never sees a password), records
 * the tab with puppeteer's screencast (ffmpeg) and writes an mp4.
 *
 *   node scripts/demoVideo.mjs --profile "C:\Users\<you>\.draft-yc-profile" [--base https://jobsviadraft.com]
 *        [--out C:\Users\<you>\Videos\draft-demo-<date>.mp4] [--size 1600x900] [--no-draft]
 *
 * ⛔ IT REFUSES TO SEND ANYTHING (D36: the person sends). Every request that is not a GET is ABORTED unless it is on the
 * allow-list below — one Draft (POST /api/apply/runs: it makes a run that waits for review), the posting's "visited"
 * mark, Tiny's lookups, telemetry. Approve, send, submit, run-now, handoff, answers, settings: all aborted and counted;
 * the script prints every aborted write and exits 1 if any was a send / approve / submit path. --no-draft aborts the
 * Draft too. ⛔ Only https://jobsviadraft.com or this computer's loopback.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(k);
const BASE = arg("--base", "https://jobsviadraft.com").replace(/\/$/, "");
const PROFILE = arg("--profile", null);
const [VW, VH] = String(arg("--size", "1600x900")).split("x").map(Number);
const today = new Date().toISOString().slice(0, 10);
const OUT = path.resolve(arg("--out", path.join(os.homedir(), "Videos", `draft-demo-${today}.mp4`)));
const NO_DRAFT = flag("--no-draft");
const CHROME = arg("--chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
const MAX_SECONDS = 180;

const host = new URL(BASE);
if (!(host.origin === "https://jobsviadraft.com" || /^(127\.0\.0\.1|localhost)$/.test(host.hostname))) { console.error(`REFUSING: ${BASE} is not draft's production or this computer`); process.exit(2); }
if (!PROFILE || !fs.existsSync(PROFILE)) { console.error("REFUSING: --profile must name a signed-in Chrome profile directory"); process.exit(2); }
if (fs.existsSync(OUT)) { console.error(`REFUSING: ${OUT} exists — the old video is kept; pass another --out`); process.exit(2); }

/** The only writes a demo may make. Everything else that is not a GET is aborted. */
export const ALLOWED_WRITES = [
  { method: "POST", re: /^\/api\/apply\/runs$/, why: "Draft — a run that waits for the person's review (Ask me first)" },
  { method: "PATCH", re: /^\/api\/jobs\/[^/]+\/visited$/, why: "the posting was opened" },
  { method: "POST", re: /^\/api\/assistant\/lookup$/, why: "Tiny's T2 answers (no model)" },
  { method: "POST", re: /^\/api\/(events|telemetry|track|analytics|client-errors?)(\/|$)/, why: "telemetry" },
];
export const NEVER = /approve|submit|send|run-now|release|handoff|confirm|\/answers|mark-applied|sent\b/i;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const aborted = [], allowed = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: PROFILE,
  args: ["--no-first-run", `--window-size=${VW},${VH}`, "--disable-features=HttpsFirstBalancedModeAutoEnable"], defaultViewport: { width: VW, height: VH, deviceScaleFactor: 1 } });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on("request", (req) => {
  const u = new URL(req.url()), m = req.method();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS" || u.origin !== host.origin) return req.continue();
  // ONE Draft per recording — a second POST /api/apply/runs (a re-render, a second press) is aborted
  const isDraft = u.pathname === "/api/apply/runs";
  const ok = ALLOWED_WRITES.find(w => w.method === m && w.re.test(u.pathname)) && !(isDraft && (NO_DRAFT || allowed.some(a => a === "POST /api/apply/runs"))) && !NEVER.test(u.pathname);
  if (ok) { allowed.push(`${m} ${u.pathname}`); return req.continue(); }
  aborted.push(`${m} ${u.pathname}`); return req.abort("blockedbyclient");
});

const CAPTION_CSS = `#demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:min(1100px,86vw);
  padding:12px 22px;border-radius:12px;background:rgba(14,14,16,.86);color:#fff;font:500 22px/1.35 "Inter Tight","DM Sans",system-ui,sans-serif;
  text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:none;transition:opacity .25s}`;
const caption = (text) => page.evaluate((t, css) => {
  if (!document.getElementById("demo-cap-css")) { const s = document.createElement("style"); s.id = "demo-cap-css"; s.textContent = css; document.head.appendChild(s); }
  let c = document.getElementById("demo-cap"); if (!c) { c = document.createElement("div"); c.id = "demo-cap"; document.body.appendChild(c); }
  c.textContent = t; c.style.opacity = t ? "1" : "0";
}, text, CAPTION_CSS).catch(() => {});
const go = async (p) => { await page.goto(BASE + p, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {}); await sleep(800); };
const smoothScroll = (px, ms = 1800) => page.evaluate((px, ms) => new Promise(r => { const y0 = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, y0 + px * (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), px, ms);
const clickText = (re, sel = "button, a, [role=button]") => page.evaluate((src, sel) => { const re = new RegExp(src, "i"); const el = [...document.querySelectorAll(sel)].find(e => re.test((e.textContent || "").trim()) && e.offsetParent); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, sel);
const typeSlow = async (sel, text) => { await page.click(sel); for (const ch of text) { await page.keyboard.type(ch); await sleep(45); } };

// signed in?
await go("/app");
const me = await page.evaluate(async () => (await fetch("/api/auth/me")).json()).catch(() => ({}));
if (!me.authenticated) { console.error("REFUSING: the profile is signed out — sign in once in that profile, then run again"); await browser.close(); process.exit(3); }

const WEBM = OUT.replace(/\.mp4$/i, "") + ".webm";
const rec = await page.screencast({ path: WEBM });
const t0 = Date.now();
const steps = [];
const step = async (name, fn) => { const s = Date.now(); try { await fn(); steps.push({ name, s: Math.round((s - t0) / 1000), ok: true }); } catch (e) { steps.push({ name, s: Math.round((s - t0) / 1000), ok: false, error: e.message.slice(0, 160) }); } };
try {
  await step("today", async () => {
    await go("/app/today"); await caption("draft ranks every open job against your résumé — ten picked for you each day"); await sleep(4500);
    for (let i = 0; i < 2; i++) { await clickText(/^›$/); await sleep(1600); }
    await caption("The whole board sits beside them, every job with your match"); await smoothScroll(600); await sleep(1500); await smoothScroll(-600, 1200); await sleep(800);
  });
  await step("posting", async () => {
    await caption("Open a job: pay, workstyle, sponsorship and how well you fit, at a glance");
    await page.evaluate(() => document.querySelector("[data-jb-row], .jb, [data-job-row]")?.click()); await sleep(3500);
    await smoothScroll(350, 1500); await sleep(1500); await smoothScroll(-350, 1000); await sleep(700);
  });
  await step("draft", async () => {
    await caption("Draft: draft tailors your résumé and fills the employer's form — nothing is sent until you approve");
    // the open posting takes the deck's place — fold it back, then the deck card's Draft
    await clickText(/^Fold it back$/); await sleep(1200);
    if (!NO_DRAFT && !(await clickText(/^Draft$/))) throw new Error("no Draft button on screen");
    await sleep(5000);
  });
  await step("home", async () => {
    await go("/app/auto-apply"); await caption("Home: every application, and what each one needs from you"); await sleep(5000);
    await page.evaluate(() => document.querySelector("[data-tracker-table] tbody tr")?.click()); await sleep(4000);
    await caption("Review what draft wrote, answer what only you can, and send when you're ready"); await sleep(4000);
  });
  await step("tiny", async () => {
    await go("/app/today"); await sleep(600);
    await caption("Tiny: ask for what you want — it sets the filters and answers from your own data");
    await page.click("[data-tiny-launch]"); await sleep(900);
    await typeSlow("[data-ask-input]", "show remote jobs in New York"); await page.keyboard.press("Enter"); await sleep(4000);
    await typeSlow("[data-ask-input]", "how many need me?"); await page.keyboard.press("Enter"); await sleep(4000);
    await page.click("[data-ask-close]").catch(() => {}); await sleep(600);
  });
  await step("atlas", async () => {
    await go("/app/atlas"); await caption("Atlas: your run — points come only from proof, a skill checked or something built"); await sleep(4500);
    await go("/app/atlas/your-map"); await caption("Your map: where your skills stand against the roles you want"); await sleep(3000); await smoothScroll(700, 2200); await sleep(1500);
    await go("/app/atlas/library"); await caption("Guides and courses for the next skill on your route"); await sleep(4000);
  });
  await step("profile", async () => {
    await go("/app/profile/about"); await caption("Your profile, built from your résumé — you choose who sees each part"); await sleep(4000); await smoothScroll(500, 1800); await sleep(1200);
  });
  await step("close", async () => {
    await go("/app/today"); await caption("draft — find the job, fit the résumé, apply when you say so.  jobsviadraft.com"); await sleep(4500);
  });
} finally {
  await rec.stop().catch(() => {});
  await browser.close();
}
const seconds = Math.round((Date.now() - t0) / 1000);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", WEBM, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "22", "-movflags", "+faststart", "-t", String(MAX_SECONDS), OUT], { stdio: "inherit" });
fs.rmSync(WEBM, { force: true });
const bad = aborted.filter(a => NEVER.test(a));
console.log(JSON.stringify({ out: OUT, seconds, size: `${VW}x${VH}`, steps, allowedWrites: allowed, abortedWrites: aborted }, null, 1));
if (seconds > MAX_SECONDS) console.error(`⚠ the walk took ${seconds} s — the mp4 is cut at ${MAX_SECONDS} s`);
if (bad.length) { console.error(`⛔ the page tried ${bad.length} send / approve / submit request(s) — aborted, but look at why: ${bad.join(", ")}`); process.exit(1); }

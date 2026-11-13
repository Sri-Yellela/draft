#!/usr/bin/env node
/**
 * ⭐ A199 (2) WALK (46l) — the held questions as an Ask draft thread, in a REAL Chrome on the real client (vite), fed
 * synthetic API answers (no server, no database, no model, nobody's data — fidelityShots.mjs's way). Walks:
 *   1. opening a held row with questions opens its thread beside Draft House ("<company> · N questions only you can settle")
 *   2. a Yes / No and a choice are buttons; a short answer is typed (Enter); a written answer shows draft's suggestion,
 *      "Write it from this" redrafts from what the person said, "Use this" takes it
 *   3. All answered → Finish the form → POST /api/apply/answers carries every answer, this job only, mode auto → saved
 *   4. a Run again that comes back with questions (a NEW held run) opens a new thread
 *   5. "answer here instead" keeps the stepper in the row
 * Prints one JSON line: { steps: [{ step, ok, detail }], failures }.   node scripts/a199Walk.mjs
 */
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const PORT = 5197;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);
const JOB = { jobId: "a199-h", company: "Halcyon", title: "Machine Learning Engineer" };
const QUESTIONS = [
  { question: "Are you legally authorized to work in the United States?", required: true, type: "select", options: ["Yes", "No"] },
  { question: "Which office would you work from?", required: true, type: "select", options: ["Austin", "Boston", "Remote"] },
  { question: "What is your notice period?", required: false, type: "text" },
  { question: "Describe your experience with SIEM integrations.", required: true, type: "textarea" },
];
const heldRow = (id) => ({ id, ...JOB, status: "held_review", reasonCode: "manual_review", createdAt: now - 3600, resumeAvailable: true, heldQuestions: QUESTIONS });
const state = { rowId: 101, posts: [], drafts: [], rerunUntil: 0 };
const fixtures = () => ({
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", displayName: "Ada Lovelace", email: "ada@example.invalid", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1, target_titles: ["Data Engineer"] }],
  "/api/extension/status": { connected: true, state: "connected" },
  "/api/applications/pending": { pending: [], verified: [], methods: [], verifyRule: {} },
  "/api/resumes": [], "/api/jobs/pending": [], "/api/applications": [],
  "/api/apply/readiness": { available: true },
  "/api/apply/run-bar": { mode: { current: "semi", auto: { locked: false } }, windowHours: 24, hold: { held: false, since: null }, caps: [] },
  "/api/apply/auto-settings": { settings: { dailyCap: 10, runTimes: ["09:00"], timeZone: "America/New_York", filters: {} } },
  // while the re-run fills the form the row is running; then it comes back held with questions (a NEW held run)
  "/api/apply/runs": Date.now() < state.rerunUntil
    ? { runs: [{ id: 9, status: "running", createdAt: now }], gated: [], submitted: [], stopped: [], statusCounts: {}, line: { waiting: [], held: null }, review: [], inFlight: [{ id: 105, ...JOB, status: "running", startedAt: now, createdAt: now, progress: { filled: 3, total: 9 } }] }
    : { runs: state.posts.length ? [{ id: 9, status: "completed", createdAt: now }] : [], gated: [], submitted: [], stopped: [], statusCounts: {}, line: { waiting: [], held: null }, review: [heldRow(state.rowId)], inFlight: [] },
  "/api/apply/pending": { pending: [], approvalCap: { remaining: 10, limit: 10 } },
  "/api/pipeline": { rows: [] }, "/api/picks/runs": { state: { nextRunAt: null }, runs: [] },
  "/api/draft/slots": { limit: 10, used: 3, remaining: 7, drafts: 2, generations: 1, windowHours: 24 },
});

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

const resolution = await resolveBrowserExecutable();
const exePath = resolution?.path || resolution?.executablePath || null;
if (!exePath) { console.log(JSON.stringify({ skipped: "no Chrome" })); process.exit(0); }
const steps = [];
const check = (step, ok, detail = "") => steps.push({ step, ok: !!ok, detail: String(detail).slice(0, 300) });
const vite = await startVite();
const browser = await puppeteer.launch({ executablePath: exePath, headless: true, pipe: true, args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (!u.pathname.startsWith("/api/")) return req.continue();
    const json = (body) => req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (req.method() === "POST" && u.pathname === "/api/apply/answers") {
      state.posts.push(JSON.parse(req.postData() || "{}"));
      // the re-run comes back held with questions again — a NEW held run (Run again with questions)
      state.rowId = 105;
      state.rerunUntil = Date.now() + 4000;
      return json({ ok: true, message: "Saved 4 answers. draft is finishing the form again (free) — it comes back ready for your approval." });
    }
    const m = u.pathname.match(/^\/api\/apply\/questions\/([^/]+)\/draft$/);
    if (req.method() === "POST" && m) {
      const body = JSON.parse(req.postData() || "{}");
      state.drafts.push(body);
      return json({ draft: body.note ? `I set up SIEM alerting: ${body.note}.` : "I integrated Splunk with our payment services' logs (synthetic)." });
    }
    json(fixtures()[u.pathname] ?? {});
  });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} });
  await page.goto(`${vite.url}/app/auto-apply`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
  await page.waitForSelector("[data-tracker-table] tbody tr", { timeout: 30000 }).catch(() => {});
  await sleep(600);
  // 1 · open the held row → its thread opens
  await page.evaluate(() => { const r = [...document.querySelectorAll("[data-tracker-table] tbody tr.trk-row")].find(tr => /Halcyon/.test(tr.textContent)); r?.click(); });
  await page.waitForSelector('[data-ask-thread="a199-h"]', { timeout: 10000 }).catch(() => {});
  const head = await page.$eval("[data-ask-thread-head]", el => el.textContent).catch(() => "");
  check("1 thread opens from the held row", /Halcyon/.test(head) && /4 questions only you can settle/.test(head), head);
  const inRow = await page.$('[data-held-in-ask-draft="a199-h"]');
  check("1 the row says its questions are answered in Ask draft", !!inRow);
  // 2 · Yes / No and a choice are buttons
  const q = () => page.$eval('[data-ask-turn="current"] [data-ask-question]', el => el.textContent).catch(() => "");
  check("2 Yes / No is buttons", /authorized/.test(await q()) && !!(await page.$('[data-ask-choice="Yes"]')), await q());
  await page.click('[data-ask-choice="Yes"]'); await sleep(200);
  check("2 a choice is buttons", /office/.test(await q()) && !!(await page.$('[data-ask-choice="Austin"]')), await q());
  await page.click('[data-ask-choice="Austin"]'); await sleep(200);
  check("2 a short answer is typed", /notice period/.test(await q()), await q());
  await page.type("[data-ask-thread-input]", "Two weeks"); await page.keyboard.press("Enter"); await sleep(200);
  // the written answer: draft's suggestion, then Write it from this, then Use this
  await page.waitForSelector("[data-ask-suggestion]", { timeout: 10000 }).catch(() => {});
  const s1 = await page.$eval("[data-ask-suggestion]", el => el.textContent).catch(() => "");
  check("2 a written answer shows draft's suggestion", /Splunk/.test(s1) && state.drafts.length === 1 && !state.drafts[0].note, s1);
  await page.type("[data-ask-thread-input]", "Splunk alerts for payments");
  await page.click("[data-ask-redraft]");
  await page.waitForFunction(() => /Splunk alerts for payments/.test(document.querySelector("[data-ask-suggestion]")?.textContent || ""), { timeout: 10000 }).catch(() => {});
  const s2 = await page.$eval("[data-ask-suggestion]", el => el.textContent).catch(() => "");
  check("2 Write it from this redrafts from what you said", /Splunk alerts for payments/.test(s2) && state.drafts[1]?.note === "Splunk alerts for payments", s2);
  await page.click("[data-ask-use]"); await sleep(200);
  const answered = await page.$$eval('[data-ask-turn="answered"]', els => els.length);
  check("2 the answered ones stay above as a transcript", answered === 4, answered);
  // 3 · Finish the form
  await page.waitForSelector("[data-ask-finish]", { timeout: 5000 }).catch(() => {});
  await page.click("[data-ask-finish]");
  await page.waitForSelector('[data-ask-saved="true"]', { timeout: 10000 }).catch(() => {});
  const p = state.posts[0] || {};
  check("3 Finish posts every answer for THIS job, then re-runs it", Object.keys(p.answers || {}).length === 4 && JSON.stringify(p.retryJobIds) === '["a199-h"]' && p.mode === "auto"
    && p.answers?.["Describe your experience with SIEM integrations."] === "I set up SIEM alerting: Splunk alerts for payments.", JSON.stringify(p).slice(0, 300));
  check("3 the thread says it was saved", !!(await page.$('[data-ask-saved="true"]')));
  // 4 · the re-run came back with questions (a new held run) — Draft House refreshes and the thread opens again
  await sleep(4500);   // the client polls every 4 s while a run is in flight
  await page.waitForFunction(() => !document.querySelector('[data-ask-saved="true"]') && !!document.querySelector('[data-ask-thread="a199-h"] [data-ask-turn="current"]'), { timeout: 25000 }).catch(() => {});
  const reopened = await page.$('[data-ask-thread="a199-h"] [data-ask-turn="current"]');
  check("4 a Run again with questions opens a new thread", !!reopened && /authorized/.test(await q()), await q());
  // 5 · answer here instead → the stepper in the row
  await page.click('[data-action="answer-here"]').catch(() => {});
  await sleep(400);
  const stepperHere = await page.evaluate(() => !document.querySelector('[data-held-in-ask-draft="a199-h"]') && !!document.querySelector(".dht-step"));
  check("5 answer here instead keeps the stepper in the row", stepperHere);
  check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  vite.proc.kill();
}
console.log(JSON.stringify({ steps, failures: steps.filter(s => !s.ok).length }));

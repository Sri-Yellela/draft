#!/usr/bin/env node
// crawler/worker.js — ⛔ D75 · THE CRAWLER WORKER (docs/CRAWLER_WORKER.md). A separate service that cannot
// reach draft's database: it LEASES a task from draft, does it under the rules of engagement, and RETURNS a
// signed result. No DB credentials, no user data, no model call. Its only secret is CRAWLER_TOKEN.
//
//   CRAWLER_DRAFT_URL   draft's PUBLIC origin (never a private-network name)
//   CRAWLER_TOKEN       lease auth + result signing — long, random, never committed
//   CRAWLER_DRY_RUN=1   log every request it WOULD make; make none (and return the task as a dry run)
//   CRAWLER_CHROME_PATH the browser binary; without it the browser stage is skipped and J1 says needsBrowser
//   PORT                /health
//
// The kill switch is DRAFT's: the worker asks GET /api/crawler/status before every page, and a paused
// answer stops the running task within one page.
import http from "node:http";
import { auditEnvironment } from "./lib/env.js";
import { sign } from "./lib/signature.js";
import { createFetcher } from "./lib/fetcher.js";
import { findBoard } from "./lib/j1.js";
import { followApply } from "./lib/j2.js";
import { createBrowserStage } from "./lib/browser.js";

/** Run ONE leased task. Exported for the tests, which drive it against local fixtures. */
export async function runTask(task, { fetchImpl, allowHosts, deny = [], isPaused, rateMs, browserStage = null,
                                       dryRun = false, log = () => {}, resolve } = {}) {
  const fetcher = createFetcher({ fetchImpl, allowHosts, deny, isPaused, rateMs, dryRun, log, resolve,
                                  budget: { pages: task.budget?.pages ?? 25, bytes: task.budget?.bytes ?? 5_000_000, ms: task.budget?.ms ?? 120_000 } });
  const stage = browserStage ? browserStage({ guard: fetcher.guard, audit: fetcher.audit, isPaused }) : null;
  const started = Date.now();
  let result;
  if (task.type === "j1_find_board") result = await findBoard(task.input, fetcher, { browser: stage });
  else if (task.type === "j2_apply_hop") result = await followApply(task.input, fetcher);
  else result = { status: "error", error: `unknown task type ${task.type}` };
  return { taskId: task.id, type: task.type, dryRun, ...result, audit: fetcher.audit, spent: fetcher.spent, ms: Date.now() - started };
}

async function main() {
  const env = auditEnvironment(process.env);
  if (!env.ok) {
    console.error(`[crawler] refusing to start: secret-like variables present (${env.unexpected.join(", ")}). The worker holds CRAWLER_TOKEN only.`);
    process.exit(2);
  }
  const base = String(process.env.CRAWLER_DRAFT_URL || "").replace(/\/+$/, "");
  const token = process.env.CRAWLER_TOKEN;
  if (!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) { console.error("[crawler] CRAWLER_DRAFT_URL must be draft's public https origin"); process.exit(2); }
  if (!token || token.length < 32) { console.error("[crawler] CRAWLER_TOKEN missing or shorter than 32 characters"); process.exit(2); }
  const dryRun = process.env.CRAWLER_DRY_RUN === "1";
  const poll = Math.max(10, Number(process.env.CRAWLER_POLL_SECONDS || 60)) * 1000;
  const auth = { authorization: `Bearer ${token}` };

  let lastPause = { at: 0, paused: false };
  const isPaused = async () => {
    if (Date.now() - lastPause.at < 2000) return lastPause.paused;
    try { const r = await fetch(`${base}/api/crawler/status`, { headers: auth }); const j = await r.json(); lastPause = { at: Date.now(), paused: !!j.paused }; }
    catch { lastPause = { at: Date.now(), paused: true }; }        // cannot reach draft → treat as paused
    return lastPause.paused;
  };
  let browserStage = null;
  if (process.env.CRAWLER_CHROME_PATH) {
    const puppeteer = (await import("puppeteer-core")).default;
    browserStage = (deps) => createBrowserStage({ puppeteer, executablePath: process.env.CRAWLER_CHROME_PATH, ...deps });
  }

  http.createServer((req, res) => {
    res.writeHead(req.url === "/health" ? 200 : 404, { "content-type": "application/json" });
    res.end(JSON.stringify(req.url === "/health" ? { ok: true, dryRun, browser: !!browserStage } : { error: "not_found" }));
  }).listen(Number(process.env.PORT || 8080));
  console.log(`[crawler] up — draft ${base}, dry-run ${dryRun}, browser ${!!browserStage}`);

  let paused = false;                 // logged once per pause, not every poll
  for (;;) {
    let task = null;
    try {
      const r = await fetch(`${base}/api/crawler/next`, { headers: auth });
      if (r.status === 200) task = (await r.json()).task;
      else if (r.status === 423) { if (!paused) console.log("[crawler] paused by draft — idling"); paused = true; }
      else if (r.status !== 204) console.warn(`[crawler] lease answered ${r.status}`);
      if (r.status === 200) paused = false;
    } catch (e) { console.warn(`[crawler] lease failed: ${e.message}`); }
    if (!task) { await new Promise(r => setTimeout(r, poll)); continue; }
    // D75 STEP 0b: the MODE comes from draft with each lease (Admin → Crawler); CRAWLER_DRY_RUN=1 forces dry regardless.
    const result = await runTask(task, { deny: task.deny || [], isPaused, browserStage: task.mode === "live" ? browserStage : null,
                                         dryRun: dryRun || task.mode !== "live", log: console.log });
    const body = JSON.stringify(result);
    try {
      const r = await fetch(`${base}/api/crawler/result`, { method: "POST", body, headers: { "content-type": "application/json", ...sign(body, token) } });
      console.log(`[crawler] task ${task.id} ${task.type} → ${result.status} (posted: ${r.status})`);
    } catch (e) { console.warn(`[crawler] result post failed for task ${task.id}: ${e.message}`); }
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("worker.js")) main();

#!/usr/bin/env node
/**
 * ⭐ D190 P1 WALK (46m) — ASK DRAFT acts on draft WITHOUT A MODEL, in a REAL Chrome on the real client (vite), fed synthetic
 * API answers (no server, no database, no model, nobody's data — fidelityShots.mjs's way). The server's T2 lookup is
 * tested against a real database in test/d190AskDraft.test.js; here its answers are stubbed and every request is logged.
 *   T1  save / pass / draft the deck's front card (the deck's own calls) → each with a working Undo · set the filter sentence
 *       (the board's next /api/jobs carries it; Undo restores it) · open my applications / go home · open my held questions
 *   ask "fix this" asks back · "cancel that draft" asks first (No → nothing)
 *   T2  "how many need me?" from the dock's own counts · "does Kestrel sponsor?" / "what is Spark?" through /api/assistant/lookup
 *   T3  "rewrite this bullet…" with the assistant switched off → nothing is sent
 *   ⛔ ZERO requests to /api/assistant/ask the whole walk; the conversation survives a reload and leaves at sign-out.
 * Prints the checks; exit 1 on any failure.   node scripts/d190Walk.mjs
 */
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const PORT = 5196;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const now = Math.floor(Date.now() / 1000);
const BASE = { company: "Northwind", title: "Senior Data Engineer", location: "Boston, MA", tagWorkplace: "hybrid", workType: "Hybrid", contractType: "Full-time",
  salaryMin: 165000, salaryMax: 190000, postedAt: new Date((now - 9 * 3600) * 1000).toISOString(), url: "https://example.invalid/0", applyUrl: "https://example.invalid/0",
  description: "Build and run data pipelines.\n\n- Spark and Airflow\n- SQL and Python", matchScore: 86, baseAtsScore: 86 };
const BOARD = ["Northwind", "Halcyon", "Quanta", "Lumen", "Vireo", "Kestrel"].map((company, i) => ({ ...BASE, company, jobId: `j${i}`, id: `j${i}`, matchScore: 86 - i * 3, baseAtsScore: 86 - i * 3 }));
const HELD = { id: 301, runId: 30, jobId: "j9", company: "Ostara", title: "Data Analyst", status: "held_review", reasonCode: "manual_review", createdAt: now - 3600,
  heldQuestions: [{ question: "Are you legally authorized to work in the United States?", required: true, type: "select", options: ["Yes", "No"] },
    { question: "What is your notice period?", required: false, type: "text" }] };
const log = { asks: [], interact: [], drafts: [], aborts: [], lookups: [], jobsQueries: [], all: [] };
const FIX = {
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", displayName: "Ada Example", email: "ada@example.invalid", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1, target_titles: ["Data Engineer"] }],
  "/api/domain-profiles/1/base-resume": { name: "resume.pdf", content: "A. Example — Data Engineer. Python, SQL, Spark." },
  "/api/draft/slots": { limit: 10, used: 3, remaining: 7, drafts: 2, generations: 1, windowHours: 24 },
  "/api/extension/status": { connected: true, state: "connected" },
  "/api/applications/pending": { pending: [], verified: [], methods: [], verifyRule: {} },
  "/api/resumes": [], "/api/jobs/pending": [], "/api/applications": [],
  "/api/draft/today": { date: new Date().toLocaleDateString("en-CA"), profileId: 1, size: 3, dealtNow: false, thin: false,
    cards: BOARD.slice(0, 3).map((job, i) => ({ position: i, band: "strong", decision: null, score: job.matchScore, job: { ...job, id: job.jobId },
      why: { matched: ["Python", "SQL"], missing: ["Kafka"], matchedTotal: 9, missingTotal: 1 }, report: null,
      bestBet: { score: 80 - i, band: "best", reasons: ["you're eligible", `${job.matchScore} ATS match`] } })) },
  "/api/jobs": { jobs: BOARD, total: 6, totalPages: 1, nextCursor: null, attribution: [] },
  "/api/jobs/facets": { total: 6, unscored: 0, coverage: { level: 6, where: 6, employment: 6 }, views: { all: 6, saved: 0, pending: 0, imported: 0 }, clauses: {} },
  "/api/apply/readiness": { available: true },
  "/api/apply/run-bar": { mode: { current: "semi", auto: { locked: false } }, windowHours: 24, hold: { held: false, since: null }, caps: [] },
  "/api/apply/auto-settings": { settings: { dailyCap: 10, runTimes: ["09:00"], timeZone: "America/New_York", filters: {} } },
  "/api/apply/runs": { runs: [{ id: 30, status: "completed", createdAt: now }], gated: [], submitted: [], stopped: [], statusCounts: {}, line: { waiting: [], held: null }, review: [HELD], inFlight: [] },
  "/api/apply/pending": { pending: [], approvalCap: { remaining: 10, limit: 10 } },
  "/api/assistant/status": { available: false, improveAtlas: true },
  "/api/pipeline": { rows: [] }, "/api/picks/runs": { state: { nextRunAt: null }, runs: [] },
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

const resolution = await resolveBrowserExecutable();
const exePath = resolution?.path || resolution?.executablePath || null;
if (!exePath) { console.log("skipped: no Chrome"); process.exit(0); }
const checks = [];
const ok = (name, pass, detail = "") => { checks.push({ name, pass: !!pass }); console.log(`${pass ? "✔" : "✘"} ${name}${detail ? ` — ${String(detail).slice(0, 240)}` : ""}`); };
const vite = await startVite();
const browser = await puppeteer.launch({ executablePath: exePath, headless: true, pipe: true, args: ["--no-first-run"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  globalThis.__walkErrors = errors;
  await page.setViewport({ width: 1600, height: 950 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (!u.pathname.startsWith("/api/")) return req.continue();
    log.all.push(`${req.method()} ${u.pathname}`);
    const json = (body, status = 200) => req.respond({ status, contentType: "application/json", body: JSON.stringify(body) });
    const body = () => { try { return JSON.parse(req.postData() || "{}"); } catch { return {}; } };
    if (u.pathname === "/api/assistant/ask") { log.asks.push(body()); return json({ ok: false, message: "the walk refuses model calls" }); }
    if (u.pathname === "/api/jobs/interact") { log.interact.push(body()); return json({ ok: true }); }
    if (req.method() === "POST" && u.pathname === "/api/apply/runs") { log.drafts.push(body()); return json({ runId: 77, ok: true }); }
    if (u.pathname === "/api/apply/runs/77") return json({ run: { id: 77 }, jobs: [{ id: 501, jobId: log.drafts.at(-1)?.jobIds?.[0] }] });
    if (/^\/api\/apply\/run-jobs\/\d+\/abort$/.test(u.pathname)) { log.aborts.push(u.pathname); return json({ ok: true }); }
    if (u.pathname === "/api/jobs") log.jobsQueries.push(u.search);
    if (u.pathname === "/api/assistant/lookup") {
      const b = body(); log.lookups.push(b);
      if (b.intent === "sponsorship") return json({ found: true, tier: "T2", intent: "sponsorship", text: `${b.args.company}: Filed 412 certified LCAs in FY2025 (synthetic).` });
      if (b.intent === "question" && /spark/i.test(b.question)) return json({ found: true, tier: "T2", intent: "question", text: "Atlas — Apache Spark: a distributed data-processing engine (synthetic).", lessons: [{ slug: "apache-spark", name: "Apache Spark", kind: "tool", href: "/atlas/apache-spark" }], links: [] });
      return json({ found: false });
    }
    json(FIX[u.pathname] ?? {});
  });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} });
  await page.goto(`${vite.url}/app`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
  await page.waitForSelector("[data-nav-item='ask']", { timeout: 30000 });
  await sleep(1200);
  await page.click("[data-nav-item='ask']");
  await page.waitForSelector("[data-ask-draft][data-open='true'] [data-ask-input]", { timeout: 10000 });
  await sleep(400);
  const lay = await page.evaluate(() => { const a = document.querySelector("[data-ask-draft]").getBoundingClientRect(); const main = document.querySelector("main") || document.querySelector("#root > div"); const m = main.getBoundingClientRect(); return { askLeft: Math.round(a.left), askW: Math.round(a.width), mainRight: Math.round(m.right) }; });
  ok("Ask draft opens on the right and moves the page over", lay.askW > 200 && lay.mainRight <= lay.askLeft + 2, JSON.stringify(lay));

  const lastTurn = () => page.evaluate(() => { const t = [...document.querySelectorAll("[data-ask-turn='draft']")].pop(); return t ? { tier: t.dataset.askTier || null, label: t.querySelector("[data-ask-label]")?.textContent || null, text: t.querySelector(".appnav-ask__text")?.textContent || "", undo: !!t.querySelector("[data-ask-undo]"), confirm: !!t.querySelector("[data-ask-yes]") } : null; });
  const tell = async (s) => {
    if (!(await page.$("[data-ask-draft][data-open='true'] [data-ask-input]"))) { await page.click("[data-nav-item='ask']"); await page.waitForSelector("[data-ask-draft][data-open='true'] [data-ask-input]", { timeout: 10000 }); await sleep(300); }
    const n0 = (await page.$$("[data-ask-turn='draft']")).length;
    await page.click("[data-ask-input]"); await page.type("[data-ask-input]", s); await page.keyboard.press("Enter");
    await page.waitForFunction((n) => document.querySelectorAll("[data-ask-turn='draft']").length > n, { timeout: 20000 }, n0);
    await sleep(350); return lastTurn();
  };
  const undoLast = async () => { const b = await page.$$("[data-ask-undo]"); await b[b.length - 1].click(); await sleep(600); };

  // T1 on the deck's front card — the deck's own calls
  let t = await tell("save this");
  ok("“save this” — T1, labelled, the front card saved through the board's one call", t.tier === "T1" && t.label === "T1 • action" && log.interact.at(-1)?.starred === true && log.interact.at(-1)?.jobId === "j0", `${t.text} ${JSON.stringify(log.interact.at(-1))}`);
  ok("…with an Undo link", t.undo);
  await undoLast();
  ok("Undo puts the Save back", log.interact.at(-1)?.starred === false && log.interact.at(-1)?.jobId === "j0", JSON.stringify(log.interact.at(-1)));
  await sleep(600);
  t = await tell("draft this job");
  ok("“draft this job” — POST /api/apply/runs for the front card, never approvalMode", log.drafts.length === 1 && log.drafts[0].jobIds?.length === 1 && !log.drafts[0].approvalMode && /waits for your review/.test(t.text), `${t.text} ${JSON.stringify(log.drafts[0])}`);
  await sleep(800);
  await undoLast(); await sleep(600);
  ok("Undo aborts that run-job", log.aborts.includes("/api/apply/run-jobs/501/abort"), log.aborts.join(","));
  t = await tell("pass on this one");
  ok("“pass on this one” — disliked through the one call", log.interact.at(-1)?.disliked === true, JSON.stringify(log.interact.at(-1)));

  // ask back / confirm first
  const before = log.interact.length + log.drafts.length;
  t = await tell("fix this");
  ok("“fix this” asks what to change and does nothing", t.tier === "ask" && /What should I change/.test(t.text) && log.interact.length + log.drafts.length === before);
  t = await tell("cancel that draft");
  ok("“cancel that draft” asks first", t.confirm && /Cancel the draft/.test(t.text), t.text);
  await page.click("[data-ask-no]"); await sleep(400);
  ok("…No → nothing cancelled", /Cancelled — nothing changed/.test((await lastTurn()).text) && log.aborts.length === 1);

  // the filter sentence through the board's own setters
  const q0 = log.jobsQueries.length;
  t = await tell("set my filter to senior remote in Boston");
  await sleep(1500);
  const qs = log.jobsQueries.slice(q0).join(" ");
  ok("“set my filter to senior remote in Boston” — the board's next query carries it", t.tier === "T1" && /senior/.test(qs) && /remote/.test(qs) && /boston/i.test(qs), `${t.text} | ${qs.slice(0, 200)}`);
  const q1 = log.jobsQueries.length;
  await undoLast(); await sleep(1500);
  const qsBack = log.jobsQueries.slice(q1).join(" ");
  ok("Undo restores the filters", qsBack.length > 0 && !/senior/.test(qsBack), qsBack.slice(0, 200));

  // T2 from the person's own data
  t = await tell("how many need me?");
  ok("“how many need me?” — T2 from the dock's own counts, no request", t.tier === "T2" && t.label === "T2 • from your data" && /need/.test(t.text), t.text);
  t = await tell("does Kestrel sponsor?");
  ok("“does Kestrel sponsor?” — T2 through /api/assistant/lookup", t.tier === "T2" && /Kestrel: Filed 412/.test(t.text) && log.lookups.at(-1)?.intent === "sponsorship", t.text);
  t = await tell("what is Spark?");
  ok("“what is Spark?” — T2 from Atlas (no row matched → the lookup, never the model)", t.tier === "T2" && /Apache Spark/.test(t.text) && log.lookups.at(-1)?.intent === "question", t.text);
  t = await tell("what is the meaning of zzqx?");
  ok("a question nothing on draft covers — said plainly, not sent to a model", t.tier === "ask" && /nothing on this site covers it/.test(t.text), t.text);

  // T3 with the assistant off → nothing sent
  t = await tell("rewrite this bullet to highlight Kafka");
  ok("“rewrite this bullet…” with the assistant off → not sent anywhere", t.tier === "ask" && /isn't open on your account/.test(t.text), t.text);

  // navigate + the held questions
  await tell("open my applications"); await sleep(600);
  ok("“open my applications” navigates", (await page.evaluate(() => location.pathname)) === "/app/auto-apply", await page.evaluate(() => location.pathname));
  await tell("go to the board"); await sleep(600);
  ok("“go to the board” navigates (the dock's “draft”)", /^\/app(\/today)?$/.test(await page.evaluate(() => location.pathname)), await page.evaluate(() => location.pathname));
  await tell("go home"); await sleep(600);
  ok("“go home” navigates (the dock's Home — your applications)", (await page.evaluate(() => location.pathname)) === "/app/auto-apply");
  t = await tell("open my held questions");
  await sleep(500);
  ok("“open my held questions” opens the held application's thread", /Ostara/.test(t.text) && !!(await page.$("[data-ask-thread='j9']")), t.text);

  // the session keeps the conversation; sign-out clears it
  const turnsBefore = (await page.$$("[data-ask-turn]")).length;
  await page.reload({ waitUntil: "networkidle2" }); await page.waitForSelector("[data-nav-item='ask']"); await sleep(800);
  await page.click("[data-nav-item='ask']"); await sleep(500);
  const turnsAfter = (await page.$$("[data-ask-turn]")).length;
  ok("the conversation survives a reload (this tab's session)", turnsAfter >= turnsBefore - 2 && turnsAfter > 10, `${turnsBefore} → ${turnsAfter}`);
  await page.evaluate(async () => { const m = await import("/src/lib/assistantBridge.js"); m.clearAskDraftSession(); });
  await sleep(400);
  ok("sign-out clears it (sessionStorage + the panel)", (await page.evaluate(() => sessionStorage.getItem("draft-ask:turns"))) === "[]" || (await page.evaluate(() => sessionStorage.getItem("draft-ask:turns"))) === null ? (await page.$$("[data-ask-turn]")).length === 0 : false,
    await page.evaluate(() => String(sessionStorage.getItem("draft-ask:turns")).slice(0, 40)));

  const ledger = await page.evaluate(() => (window.__askDraftLedger || []).map(x => x.tier));
  ok("the ledger has no T3", !ledger.includes("T3"), ledger.join(","));
  ok("⛔ ZERO requests to /api/assistant/ask", log.asks.length === 0, JSON.stringify(log.asks));
  ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, "tmp", "d190-askdraft.png") });
} catch (e) {
  ok("walk ran to the end", false, e.stack || e.message);
  try { const pg = (await browser.pages()).at(-1); await pg.screenshot({ path: path.join(ROOT, "tmp", "d190-askdraft-fail.png") }); console.log("pageerrors:", JSON.stringify(globalThis.__walkErrors || []).slice(0, 900)); console.log("at", await pg.evaluate(() => location.pathname), "text:", JSON.stringify(await pg.evaluate(() => document.body.innerText.slice(0, 300)))); } catch {}
} finally {
  await browser.close();
  vite.proc.kill();
}
const failed = checks.filter(c => !c.pass);
console.log(`\n${checks.length - failed.length} / ${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);

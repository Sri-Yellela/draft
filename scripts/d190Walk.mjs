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
 * ⭐ TINY (owner 11-15: "make tiny a floating bot on the site rather than a panel button … put filters into the search and
 * show results on the page … answer faqs"; Tiny REPLACES Ask draft): opened from the fox bubble fixed at the bottom-right
 * (not the dock — the dock has no Ask item any more); the card floats over the page (the page keeps its width); a filter
 * said on a page with no board (Home) opens the board and its next /api/jobs carries the filters; a plain search
 * ("find data analyst jobs") is the board's text search; an FAQ goes to the lookup; the open card survives a reload.
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
    if (u.pathname === "/api/assistant/ask") { log.asks.push(body()); return FIX["/api/assistant/status"].available ? json({ ok: true, answer: "Built Kafka streams that cut ingest lag 40% (synthetic).", lessons: [], next: "" }) : json({ ok: false, message: "the walk refuses model calls" }); }
    if (u.pathname === "/api/jobs/interact") { log.interact.push(body()); return json({ ok: true }); }
    if (req.method() === "POST" && u.pathname === "/api/apply/runs") { log.drafts.push(body()); return json({ runId: 77, ok: true }); }
    if (u.pathname === "/api/apply/runs/77") return json({ run: { id: 77 }, jobs: [{ id: 501, jobId: log.drafts.at(-1)?.jobIds?.[0] }] });
    if (/^\/api\/apply\/run-jobs\/\d+\/abort$/.test(u.pathname)) { log.aborts.push(u.pathname); return json({ ok: true }); }
    if (u.pathname === "/api/jobs") log.jobsQueries.push(u.search);
    if (u.pathname === "/api/assistant/lookup") {
      const b = body(); log.lookups.push(b);
      if (b.intent === "sponsorship") return json({ found: true, tier: "T2", intent: "sponsorship", text: `${b.args.company}: Filed 412 certified LCAs in FY2025 (synthetic).` });
      if (b.intent === "question" && /spark/i.test(b.question)) return json({ found: true, tier: "T2", intent: "question", text: "Atlas — Apache Spark: a distributed data-processing engine (synthetic).", lessons: [{ slug: "apache-spark", name: "Apache Spark", kind: "tool", href: "/atlas/apache-spark" }], links: [] });
      if (b.intent === "question" && /ask me first/i.test(b.question)) return json({ found: true, tier: "T2", intent: "question", text: "Ask me first: draft fills the application and holds it as Ready to approve (synthetic help).", lessons: [], links: [{ title: "Ask me first", href: "/app/auto-apply" }] });
      return json({ found: false });
    }
    json(FIX[u.pathname] ?? {});
  });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} });
  // P4: headless Chrome has no microphone — a stand-in recogniser says what window.__say holds (the browser API's shape)
  await page.evaluateOnNewDocument(() => { window.SpeechRecognition = class { static async available() { return window.__speechLocal === false ? "unavailable" : "available"; }
    start() { setTimeout(() => { if (window.__speechErr) { this.onerror?.({ error: window.__speechErr }); this.onend?.(); return; } this.onresult?.({ results: [[{ transcript: window.__say || "help" }]] }); this.onend?.(); }, 60); }
    stop() { this.onend?.(); } }; });
  await page.goto(`${vite.url}/app`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
  await page.waitForSelector("[data-tiny-launch]", { timeout: 30000 });
  await sleep(1200);
  // ⭐ Tiny: no Ask item in the dock; the fox bubble is fixed at the bottom-right, a perfect circle with the fox in it
  const bubble = await page.evaluate(() => {
    const b = document.querySelector("[data-tiny-launch]"), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    return { position: cs.position, right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom), w: Math.round(r.width), h: Math.round(r.height),
      radius: cs.borderTopLeftRadius, fox: !!b.querySelector("svg path") && b.querySelectorAll("svg circle").length >= 4, label: b.getAttribute("aria-label"),
      dockAsk: !!document.querySelector("[data-nav-dock] [data-nav-item='ask']"), dockSep: !!document.querySelector("[data-nav-dock] .appnav-sep") };
  });
  ok("Tiny is a fox bubble fixed at the bottom-right (60 px circle), not a dock item", bubble.position === "fixed" && bubble.right === 20 && bubble.bottom === 20 && bubble.w === 60 && bubble.h === 60
    && bubble.radius === "50%" && bubble.fox && bubble.label === "Ask Tiny" && !bubble.dockAsk && !bubble.dockSep, JSON.stringify(bubble));
  const pageBox = () => page.evaluate(() => { const sh = document.querySelector("[data-app-shell]"); const m = (sh?.querySelector("main") || sh).getBoundingClientRect(); return { mainW: Math.round(m.width), mainRight: Math.round(m.right), pad: getComputedStyle(sh).paddingRight, scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }; });
  const shut = await pageBox();
  await page.click("[data-tiny-launch]");
  await page.waitForSelector("[data-ask-draft][data-open='true'] [data-ask-input]", { timeout: 10000 });
  await sleep(500);
  const lay = await page.evaluate(() => {
    const a = document.querySelector("[data-ask-draft]"), r = a.getBoundingClientRect(), b = document.querySelector("[data-tiny-launch]").getBoundingClientRect();
    return { position: getComputedStyle(a).position, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(innerWidth - r.right), gapToBubble: Math.round(b.top - r.bottom),
      title: a.querySelector("h2")?.textContent, face: !!a.querySelector(".appnav-ask__face svg"), label: a.getAttribute("aria-label"), focused: document.activeElement?.hasAttribute("data-ask-input"),
      placeholder: a.querySelector("[data-ask-input]").placeholder, intro: a.querySelector("[data-ask-intro]")?.textContent || "", html: document.documentElement.getAttribute("data-ask-open") };
  });
  const open1 = await pageBox();
  ok("the card floats above the bubble (380 × 560, fixed), named Tiny with the fox", lay.position === "fixed" && lay.w === 380 && lay.h === 560 && lay.right === 20 && lay.gapToBubble >= 8 && lay.gapToBubble <= 16
    && lay.title === "Tiny" && lay.label === "Tiny" && lay.face && /Tiny/.test(lay.placeholder) && /I'm Tiny/.test(lay.intro) && !/Ask draft/.test(lay.intro + lay.placeholder) && lay.focused && lay.html === "true", JSON.stringify(lay));
  ok("…over the page: the page does not shrink or move", open1.mainW === shut.mainW && open1.mainRight === shut.mainRight && open1.pad === shut.pad && open1.scrollW <= open1.vw, `${JSON.stringify(shut)} → ${JSON.stringify(open1)}`);

  const lastTurn = () => page.evaluate(() => { const t = [...document.querySelectorAll("[data-ask-turn='draft']")].pop(); return t ? { tier: t.dataset.askTier || null, label: t.querySelector("[data-ask-label]")?.textContent || null, text: t.querySelector(".appnav-ask__text")?.textContent || "", undo: !!t.querySelector("[data-ask-undo]"), confirm: !!t.querySelector("[data-ask-yes]") } : null; });
  const tell = async (s) => {
    if (!(await page.$("[data-ask-draft][data-open='true'] [data-ask-input]"))) { await page.click("[data-tiny-launch]"); await page.waitForSelector("[data-ask-draft][data-open='true'] [data-ask-input]", { timeout: 10000 }); await sleep(300); }
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

  // P2: the deck's card carries the scorer's keywords
  t = await tell("which keywords am I missing?");
  ok("P2 “which keywords am I missing?” — T2 from the deck card's own keywords", t.tier === "T2" && /missing 1 keyword: Kafka/.test(t.text), t.text);
  // P4: voice — the spoken words go through the same engine
  const turns0 = (await page.$$("[data-ask-turn='draft']")).length;
  await page.evaluate(() => { window.__say = "how many need me"; window.__speechErr = null; });
  await page.click("[data-ask-mic]");
  await page.waitForFunction((n) => document.querySelectorAll("[data-ask-turn='draft']").length > n, { timeout: 10000 }, turns0); await sleep(300);
  t = await lastTurn();
  const spoken = await page.evaluate(() => [...document.querySelectorAll("[data-ask-turn='you']")].pop()?.textContent || "");
  ok("P4 a spoken “how many need me” is answered like the typed one", t.tier === "T2" && /need/.test(t.text) && /how many need me/.test(spoken), `${spoken} → ${t.text}`);
  await page.evaluate(() => { window.__speechErr = "not-allowed"; });
  await page.click("[data-ask-mic]"); await sleep(400);
  ok("P4 a blocked microphone says so plainly", /microphone is blocked/.test(await page.$eval("[data-ask-voice-note]", e => e.textContent).catch(() => "")));
  await page.evaluate(() => { window.__speechErr = null; });

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
  await page.evaluate(() => document.querySelector("[data-ask-thread] [data-ask-thread-close], [data-ask-thread] button[aria-label^='Close']")?.click()); await sleep(300);

  // ⭐ Tiny · "put filters into the search and show results on the page": said on Home (no board here), the board opens and
  // its next /api/jobs carries the filters
  ok("(on Home — no board mounted)", (await page.evaluate(() => location.pathname)) === "/app/auto-apply");
  let q2 = log.jobsQueries.length;
  t = await tell("show me senior remote jobs in Boston");
  await sleep(1500);
  let qsNav = log.jobsQueries.slice(q2).join(" ");
  ok("“show me senior remote jobs in Boston” from Home → the board opens and its next /api/jobs carries the filters",
    /^\/app(\/today)?$/.test(await page.evaluate(() => location.pathname)) && t.tier === "T1" && /senior/.test(qsNav) && /remote/.test(qsNav) && /boston/i.test(qsNav) && /opened the board/.test(t.text),
    `${await page.evaluate(() => location.pathname)} | ${t.text} | ${qsNav.slice(0, 240)}`);
  ok("…Tiny stays open over the board, with an Undo", !!(await page.$("[data-ask-draft][data-open='true']")) && t.undo);
  await tell("open interview"); await sleep(800);
  // (Interview, not Profile or Atlas: those pages need fixtures this walk doesn't stub — {} makes them throw)
  ok("(on Interview — no board mounted)", /^\/app\/interview/.test(await page.evaluate(() => location.pathname)), await page.evaluate(() => location.pathname));
  q2 = log.jobsQueries.length;
  t = await tell("find data analyst jobs");
  await sleep(1500);
  qsNav = log.jobsQueries.slice(q2).join(" ");
  ok("“find data analyst jobs” from Interview → the board's text search", /^\/app(\/today)?$/.test(await page.evaluate(() => location.pathname)) && t.tier === "T1" && /data(\+|%20| )analyst/i.test(qsNav) && !/senior/.test(qsNav),
    `${await page.evaluate(() => location.pathname)} | ${t.text} | ${qsNav.slice(0, 240)}`);
  q2 = log.jobsQueries.length;
  t = await tell("search for product manager");
  await sleep(1500);
  qsNav = log.jobsQueries.slice(q2).join(" ");
  ok("“search for product manager” on the board → its search, T1, no lookup", t.tier === "T1" && /product(\+|%20| )manager/i.test(qsNav) && !log.lookups.some(l => /product manager/.test(l.question || "")), `${t.text} | ${qsNav.slice(0, 200)}`);
  // FAQs: a site question no command matches → draft's own help (the lookup), T2, never the model
  const l0 = log.lookups.length;
  t = await tell("how does ask me first work?");
  ok("an FAQ (“how does ask me first work?”) — T2 from draft's help through /api/assistant/lookup", t.tier === "T2" && /Ready to approve/.test(t.text) && log.lookups.length === l0 + 1 && log.lookups.at(-1).intent === "question", t.text);
  ok("…with the help page's link", await page.evaluate(() => !![...document.querySelectorAll("[data-ask-link]")].pop()?.getAttribute("href")?.startsWith("/app/auto-apply")));

  // the session keeps the conversation — and Tiny's open card; sign-out clears the conversation
  const turnsBefore = (await page.$$("[data-ask-turn]")).length;
  await page.reload({ waitUntil: "networkidle2" }); await page.waitForSelector("[data-tiny-launch]"); await sleep(800);
  ok("Tiny's open card is remembered across a reload (this tab's session)", !!(await page.$("[data-ask-draft][data-open='true']")));
  if (!(await page.$("[data-ask-draft][data-open='true']"))) { await page.click("[data-tiny-launch]"); await sleep(500); }
  const turnsAfter = (await page.$$("[data-ask-turn]")).length;
  ok("the conversation survives a reload (this tab's session)", turnsAfter >= turnsBefore - 2 && turnsAfter > 10, `${turnsBefore} → ${turnsAfter}`);
  await page.evaluate(async () => { const m = await import("/src/lib/assistantBridge.js"); m.clearAskDraftSession(); });
  await sleep(400);
  ok("sign-out clears it (sessionStorage + the panel)", (await page.evaluate(() => sessionStorage.getItem("draft-ask:turns"))) === "[]" || (await page.evaluate(() => sessionStorage.getItem("draft-ask:turns"))) === null ? (await page.$$("[data-ask-turn]")).length === 0 : false,
    await page.evaluate(() => String(sessionStorage.getItem("draft-ask:turns")).slice(0, 40)));

  const ledger = await page.evaluate(() => (window.__askDraftLedger || []).map(x => x.tier));
  ok("the ledger has no T3", !ledger.includes("T3"), ledger.join(","));
  ok("⛔ ZERO requests to /api/assistant/ask through every T1 / T2 / ask turn", log.asks.length === 0, JSON.stringify(log.asks));

  // P3: the assistant switched on — ONLY an explicit request for new writing reaches the model route, and it is labelled
  FIX["/api/assistant/status"] = { available: true, improveAtlas: true };
  await page.click("[data-ask-close]"); await sleep(300);
  ok("Close folds the card back to the bubble", (await page.$eval("[data-ask-draft]", e => e.getAttribute("data-open"))) === "false" && (await page.evaluate(() => document.documentElement.getAttribute("data-ask-open"))) === null);
  await page.click("[data-tiny-launch]"); await sleep(600);
  await page.keyboard.press("Escape"); await sleep(300);
  ok("Esc closes Tiny", (await page.$eval("[data-ask-draft]", e => e.getAttribute("data-open"))) === "false");
  await page.click("[data-tiny-launch]"); await sleep(600);
  t = await tell("how many need me?");
  ok("P3 with the assistant on, site data is still T2 — no model request", t.tier === "T2" && log.asks.length === 0, t.text);
  t = await tell("what is Spark?");
  ok("P3 …and an Atlas question is still the lookup", t.tier === "T2" && log.asks.length === 0, t.text);
  t = await tell("rewrite this bullet to highlight Kafka");
  ok("P3 “rewrite this bullet…” → ONE request to the gateway route, labelled “written by the assistant”", t.tier === "T3" && t.label === "T3 • written by the assistant" && log.asks.length === 1 && /Kafka streams/.test(t.text), `${t.label} | ${t.text} | asks ${log.asks.length}`);
  ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, "tmp", "d190-askdraft.png") });
  // phone: a bottom sheet, the bubble steps aside while it is open
  await page.setViewport({ width: 390, height: 844 }); await sleep(700);
  const phone = await page.evaluate(() => { const a = document.querySelector("[data-ask-draft]").getBoundingClientRect(), b = document.querySelector("[data-tiny-launch]");
    return { left: Math.round(a.left), right: Math.round(innerWidth - a.right), bottom: Math.round(innerHeight - a.bottom), w: Math.round(a.width), bubble: getComputedStyle(b).display, scrollW: document.documentElement.scrollWidth, vw: document.documentElement.clientWidth }; });
  ok("phone (390): Tiny is a bottom sheet the full width; the bubble steps aside", phone.left === 0 && phone.right === 0 && phone.bottom === 0 && phone.bubble === "none" && phone.scrollW <= phone.vw, JSON.stringify(phone));
  await page.screenshot({ path: path.join(ROOT, "tmp", "d190-tiny-phone.png") });
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

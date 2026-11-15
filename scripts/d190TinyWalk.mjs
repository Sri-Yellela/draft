// scripts/d190TinyWalk.mjs — ⭐ D190 P1 · TINY, END TO END in real Chrome (draft's WORKLOG, 46m item 1). Synthetic document.
// Each day-one command typed into Tiny → the document changes as the tool bar would change it → Undo puts it back →
// an ambiguous command asks back and changes nothing → a destructive one asks "Are you sure?" first → a question about
// the document is answered from its own text → ⛔ ZERO requests to any /api or model route the whole time.
// Run from draft (it has puppeteer-core): node scripts/d190TinyWalk.mjs [path-to-resume-master]   (default: ../resume-master;
// exit 1 on any failed check; screenshots in draft's tmp/)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RM = path.resolve(process.argv[2] || process.env.RM_DIR || path.join(ROOT, "..", "resume-master"));
const { createApp } = await import(pathToFileURL(path.join(RM, "src", "http", "app.js")).href);
const lib = await import(pathToFileURL(path.join(RM, "node_modules", "@cantoo", "pdf-lib", "cjs", "index.js")).href);
fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
const app = createApp({ log: () => {} });
const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
const base = process.env.WALK_BASE || `http://127.0.0.1:${server.address().port}`;   // WALK_BASE: walk a deployed site instead
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium"].find(p => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, args: ["--no-first-run"] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// a synthetic two-page résumé
const doc = await lib.PDFDocument.create();
const reg = await doc.embedFont(lib.StandardFonts.Helvetica);
const p1 = doc.addPage([612, 792]);
p1.drawText("Jordan Example", { x: 72, y: 720, size: 22, font: reg });
p1.drawText("Data Analyst, Boston", { x: 72, y: 690, size: 12, font: reg });
p1.drawText("Revenue grew to 10,700,942 in 2023", { x: 72, y: 660, size: 11, font: reg });
p1.drawText("Skills: Python, SQL, Tableau", { x: 72, y: 640, size: 11, font: reg });
doc.addPage([612, 792]).drawText("Projects 2023: churn model", { x: 72, y: 720, size: 11, font: reg });
const B64 = Buffer.from(await doc.save()).toString("base64");

const checks = [];
const ok = (name, pass, detail = "") => { checks.push({ name, pass: !!pass, detail }); console.log(`${pass ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`); };
const errors = [], apiCalls = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("request", r => { const u = new URL(r.url()); if (/^\/(api|v1|mcp)\b|anthropic|assistant\/ask/i.test(u.pathname + u.host)) apiCalls.push(u.pathname); });
  page.on("dialog", d => d.accept().catch(() => {}));
  const dl = path.join(ROOT, "tmp", "d190-downloads"); fs.mkdirSync(dl, { recursive: true });
  const cdp = await page.createCDPSession(); await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dl });
  await page.setViewport({ width: 1600, height: 950 });
  await page.evaluateOnNewDocument(() => { window.SpeechRecognition = class { static async available() { return window.__speechLocal === false ? "unavailable" : "available"; }
    start() { setTimeout(() => { if (window.__speechErr) { this.onerror?.({ error: window.__speechErr }); this.onend?.(); return; } this.onresult?.({ results: [[{ transcript: window.__say || "help" }]] }); this.onend?.(); }, 60); }
    stop() { this.onend?.(); } }; });
  await page.goto(`${base}/workspace/`, { waitUntil: "networkidle0" });
  await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([bin], "jordan-resume.pdf", { type: "application/pdf" }));
    const input = document.querySelector("#ws-open"); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  }, B64);
  await page.waitForFunction(() => document.querySelector("[data-ws]")?.dataset.state === "open", { timeout: 60000 });
  await page.waitForFunction(() => !!window.__rmTiny, { timeout: 20000 });

  // ⭐ 46n (owner 11-15): Tiny is a FLOATING bot — the fox bubble at the bottom-right opens a floating card over the page
  const bubble = await page.evaluate(() => { const b = document.querySelector("[data-tiny-launch]"); const r = b?.getBoundingClientRect(); return b ? { fixed: getComputedStyle(b.closest("[data-tiny-root]")).position, right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom), w: Math.round(r.width), h: Math.round(r.height), fox: !!b.querySelector("svg path") } : null; });
  ok("a floating fox bubble at the bottom-right (no top-bar button)", bubble?.fixed === "fixed" && bubble.right < 40 && bubble.bottom < 40 && bubble.w === bubble.h && bubble.fox && !(await page.$("#ws-tiny-toggle")), JSON.stringify(bubble));
  const canvasBefore = await page.$eval("#ws-canvas", e => e.getBoundingClientRect().width);
  await page.click("[data-tiny-launch]"); await sleep(300);
  const layout = await page.evaluate(() => { const c = document.querySelector("#ws-canvas").getBoundingClientRect(), t = document.querySelector("[data-tiny]").getBoundingClientRect(); return { canvasW: Math.round(c.width), cardW: Math.round(t.width), cardH: Math.round(t.height), cardRight: Math.round(innerWidth - t.right) }; });
  ok("…it opens a floating card (the page keeps its width)", layout.cardW > 300 && layout.cardH > 300 && layout.cardRight < 40 && layout.canvasW === Math.round(canvasBefore), JSON.stringify(layout));

  const texts = () => page.$$eval(".pt-tx", els => els.map(e => e.textContent));
  const lastTurn = () => page.evaluate(() => { const t = [...document.querySelectorAll("[data-tiny-turn='tiny']")].pop(); return t ? { tier: t.dataset.tier, label: t.querySelector("[data-tiny-label]")?.textContent || null, text: t.querySelector(".tiny-text").textContent, undo: !!t.querySelector("[data-tiny-undo]"), confirm: !!t.querySelector("[data-tiny-yes]") } : null; });
  const tell = async (s) => { const n0 = (await page.$$("[data-tiny-turn='tiny']")).length; await page.click("[data-tiny-input]"); await page.type("[data-tiny-input]", s); await page.keyboard.press("Enter"); await page.waitForFunction((n) => document.querySelectorAll("[data-tiny-turn='tiny']").length >= n, { timeout: 30000 }, n0 + 1); await sleep(150); return lastTurn(); };
  const undoLast = async () => { const b = await page.$$("[data-tiny-undo]"); await b[b.length - 1].click(); await sleep(400); };
  const changes = () => page.evaluate(() => window.__rmWorkspace.changeCount());
  const pages = () => page.evaluate(() => window.__rmWorkspace.pages.length);

  // replace by content + line
  let t = await tell("replace 10,700,942 with 10,800,000 on line 3");
  ok("replace on a line: T1, labelled, the line changes", t.tier === "T1" && t.label === "T1 • action" && (await texts()).includes("Revenue grew to 10,800,000 in 2023"), t.text);
  ok("…with an Undo link", t.undo);
  await undoLast();
  ok("Undo restores the line", (await texts()).includes("Revenue grew to 10,700,942 in 2023") && (await changes()) === 0);

  // the owner's own 11-15 example: a typo, "as", and two edits joined by "and"
  t = await tell("rewrute Revenue as Income and churn as attrition");
  ok("“rewrute Revenue as Income and churn as attrition” — the typo fixed, BOTH replacements made", t.tier === "T1" && (await texts()).includes("Income grew to 10,700,942 in 2023") && (await texts()).includes("Projects 2023: attrition model"), t.text);
  await undoLast();
  ok("…ONE Undo takes both back", (await texts()).includes("Revenue grew to 10,700,942 in 2023") && (await texts()).includes("Projects 2023: churn model"));

  // ambiguous: in two places → asks which, changes nothing
  t = await tell("replace 2023 with 2024");
  ok("a word in two places asks which line, changes nothing", t.tier === "ask" && /2 places/.test(t.text) && (await changes()) === 0, t.text);
  t = await tell("replace 2023 with 2024 on page 2");
  ok("…narrowed to a page, it changes", t.tier === "T1" && (await texts()).includes("Projects 2024: churn model"), t.text);
  await undoLast();

  // fix this → asks back
  t = await tell("fix this");
  ok("“fix this” asks what to change and changes nothing", t.tier === "ask" && /What should I change/.test(t.text) && (await changes()) === 0);

  // style the header
  t = await tell("make the header bold");
  const bold = await page.evaluate(() => window.__rmWorkspace.fields.find(f => f.text === "Jordan Example")?.font.bold);
  ok("“make the header bold” bolds the biggest line", t.tier === "T1" && bold === true, t.text);
  await undoLast();
  ok("Undo takes the bold off", (await page.evaluate(() => window.__rmWorkspace.fields.find(f => f.text === "Jordan Example")?.font.bold)) === false);
  t = await tell("make line 4 size 14");
  ok("size on a line", (await page.evaluate(() => window.__rmWorkspace.fields.find(f => f.text.startsWith("Skills"))?.size)) === 14, t.text);
  await undoLast();

  // destructive → Are you sure? first
  t = await tell("delete page 2");
  ok("“delete page 2” asks first and deletes nothing yet", t.confirm && (await pages()) === 2, t.text);
  await page.click("[data-tiny-yes]");
  await page.waitForFunction(() => window.__rmWorkspace.pages.length === 1, { timeout: 30000 }); await sleep(300);
  t = await lastTurn();
  ok("Yes → page 2 deleted, with Undo", (await pages()) === 1 && t.undo, t.text);
  await undoLast(); await page.waitForFunction(() => window.__rmWorkspace.pages.length === 2, { timeout: 30000 });
  ok("Undo brings the page back", (await pages()) === 2 && (await texts()).includes("Projects 2023: churn model"));
  t = await tell("delete all pages");
  await page.click("[data-tiny-no]"); await sleep(300);
  ok("“delete all pages” → No → nothing changed", (await pages()) === 2 && /Cancelled/.test((await lastTurn()).text));

  // pages
  t = await tell("duplicate page 1");
  ok("duplicate page 1", (await pages()) === 3, t.text);
  t = await tell("move page 3 to 1");
  ok("move page 3 to 1", t.tier === "T1" && /moved to position 1/.test(t.text), t.text);
  t = await tell("rotate page 1 left");
  ok("rotate page 1 left", (await page.evaluate(() => window.__rmWorkspace.pages[0].rotate)) === 270 || /turned left/.test(t.text), t.text);
  await undoLast(); await undoLast(); await undoLast();
  await page.waitForFunction(() => window.__rmWorkspace.pages.length === 2, { timeout: 30000 });
  ok("three Undos put the pages back", (await pages()) === 2);

  // navigation + zoom
  t = await tell("go to page 2");
  ok("go to page 2", /2 \/ 2/.test(await page.$eval("#ws-pageno", e => e.textContent)) || /Page 2/.test(t.text), t.text);
  t = await tell("zoom to 150%");
  ok("zoom to 150%", /150 %/.test(await page.$eval("#ws-pct", e => e.textContent)), t.text);
  await undoLast();

  // T2 from the document's own text
  t = await tell("what's on page 1?");
  ok("“what's on page 1?” — T2 from the document's text", t.tier === "T2" && t.label === "T2 • from your data" && /Jordan Example/.test(t.text));
  t = await tell("how many pages?");
  ok("how many pages — T2", t.tier === "T2" && /2 pages/.test(t.text), t.text);

  // P2: what an ATS may trip on, from the document itself
  t = await tell("check my resume for ATS problems");
  ok("P2 “check my resume for ATS problems” — T2 from the document", t.tier === "T2" && /(Nothing obvious|may trip on)/.test(t.text), t.text);
  // P4: voice
  const n0 = (await page.$$("[data-tiny-turn='tiny']")).length;
  await page.evaluate(() => { window.__say = "go to page 1"; });
  await page.click("[data-tiny-mic]");
  await page.waitForFunction((n) => document.querySelectorAll("[data-tiny-turn='tiny']").length > n, { timeout: 10000 }, n0); await sleep(300);
  t = await lastTurn();
  ok("P4 a spoken “go to page 1” acts like the typed one", t.tier === "T1" && /Page 1 of 2/.test(t.text), t.text);
  await page.evaluate(() => { window.__speechErr = "not-allowed"; });
  await page.click("[data-tiny-mic]"); await sleep(400);
  ok("P4 a blocked microphone says so plainly", /microphone is blocked/.test(await page.$eval("[data-tiny-voice-note]", e => e.textContent)));
  await page.evaluate(() => { window.__speechErr = null; });

  // T3 rows never reach a model in P1 (the routing stub)
  t = await tell("rewrite this bullet to highlight Kafka");
  ok("a new-writing request is NOT sent anywhere in P1", t.tier === "ask" && /isn't switched on/.test(t.text));

  // download as Word, compress, print (T1 through the Convert tools)
  t = await tell("download as Word");
  ok("download as Word", /Word/.test(t.text), t.text);
  t = await tell("compress it under 2 MB");
  ok("compress under 2 MB", /under your 2 MB limit|limit/.test(t.text), t.text);
  await sleep(1500);
  ok("the downloads landed", fs.readdirSync(dl).some(f => f.endsWith(".docx")) && fs.readdirSync(dl).some(f => /compressed\.pdf$/.test(f)), fs.readdirSync(dl).join(", "));

  const ledger = await page.evaluate(() => window.__tinyLedger.map(x => x.tier));
  ok("the ledger has no T3", !ledger.includes("T3"), ledger.join(","));
  ok("⛔ ZERO requests to /api, a model or /assistant/ask", apiCalls.length === 0, apiCalls.join(", "));
  ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.screenshot({ path: path.join(ROOT, "tmp", "d190-tiny.png") });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });   // (a mobile viewport reloads the page)
  await page.waitForFunction(() => !!window.__rmTiny, { timeout: 30000 });
  if (!(await page.$("[data-tiny]:not([hidden])"))) await page.click("[data-tiny-launch]");
  await sleep(400);
  const sheet = await page.evaluate(() => { const r = document.querySelector("[data-tiny]").getBoundingClientRect(); return { bottom: Math.round(r.bottom), h: Math.round(r.height), vh: innerHeight }; });
  ok("phone: a bottom sheet", sheet.bottom === sheet.vh && sheet.h < sheet.vh, JSON.stringify(sheet));
  await page.screenshot({ path: path.join(ROOT, "tmp", "d190-tiny-phone.png") });

  // every other page: the same bubble — FAQs and the site's tools, no request
  const home = await browser.newPage();
  home.on("request", r => { const u = new URL(r.url()); if (/^\/(api|mcp)\b|anthropic|assistant\/ask/i.test(u.pathname + u.host)) apiCalls.push(u.pathname); });
  await home.setViewport({ width: 1440, height: 900 });
  await home.goto(`${base}/`, { waitUntil: "networkidle0" });
  await home.waitForSelector("[data-tiny-launch]", { timeout: 15000 });
  await home.click("[data-tiny-launch]"); await sleep(300);
  const homeTell = async (s) => { const n0 = (await home.$$("[data-tiny-turn='tiny']")).length; await home.type("[data-tiny-input]", s); await home.keyboard.press("Enter"); await home.waitForFunction((n) => document.querySelectorAll("[data-tiny-turn='tiny']").length > n, { timeout: 15000 }, n0); await sleep(150); return home.evaluate(() => { const t = [...document.querySelectorAll("[data-tiny-turn='tiny']")].pop(); return { tier: t.dataset.tier, text: t.querySelector(".tiny-text").textContent, link: t.querySelector("[data-tiny-link]")?.getAttribute("href") || null }; }); };
  t = await homeTell("is my file uploaded?");
  ok("home page: “is my file uploaded?” — T2 from the site's FAQ", t.tier === "T2" && /never sent to a server/.test(t.text) && t.link === "/privacy", JSON.stringify(t));
  t = await homeTell("delete page 2");
  ok("home page: a document command says where it works", t.tier === "ask" && /open a PDF in the workspace/.test(t.text), t.text);
  await Promise.all([home.waitForNavigation({ timeout: 15000 }).catch(() => null), homeTell("open the compress tool")]);
  await sleep(500);
  ok("home page: “open the compress tool” opens it, and Tiny is there too", home.url().endsWith("/pdf/compress-pdf/") && !!(await home.$("[data-tiny-launch]")), home.url());
  await home.close();
} catch (e) {
  ok("walk ran to the end", false, e.stack || e.message);
} finally {
  await browser.close(); server.close();
}
const failed = checks.filter(c => !c.pass);
console.log(`\n${checks.length - failed.length} / ${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);

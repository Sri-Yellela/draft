#!/usr/bin/env node
// ⭐ 46y · D157 — draft's EMBEDDED résumé editor (rm-editor/1) against a LOCAL checkout of the tools service, in a real Chrome.
//   node scripts/walkEditor46y.mjs [--rm C:/…/resume-master] [--out tmp/walk46y-editor]
// Serves the checkout's editor as its site does (public/ at /, src/ at /lib/) on :5196 — no RM server, no database, no
// model; boots draft's client on vite (:5195) with STUBBED /api answers (a synthetic account; /api/resume-editor points
// at :5196) and opens the editor through lib/resumeEditor.js's event, as a posting's Résumé does. Then, in plain-light and
// dusk-dark at 1440 and 400: it loads (`ready` → `loaded`), the frame's colours are draft's live tokens, it draws NO
// standalone shell (the workspace's top bar / modes, the start screen, Tiny), an edit is saved through
// POST /api/resumes/:jobId/html, Download HTML reaches the host, Esc closes. Shots + editor.json into --out.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RM = path.resolve(arg("--rm", "C:/Users/duggi/WebstormProjects/resume-master"));
const OUT = path.resolve(ROOT, arg("--out", "tmp/walk46y-editor"));
const RM_PORT = 5196, VITE_PORT = 5195;
const RM_ORIGIN = `http://localhost:${RM_PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── the tools service's editor, served as its site serves it ──
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon" };
const rmServer = http.createServer((req, res) => {
  const u = new URL(req.url, RM_ORIGIN);
  let p = decodeURIComponent(u.pathname);
  let file = p.startsWith("/lib/") ? path.join(RM, "src", p.slice(5)) : path.join(RM, "public", p);
  if (!file.startsWith(RM)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => rmServer.listen(RM_PORT, r));

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(ROOT, "client", "node_modules", "vite", "bin", "vite.js"), "--port", String(VITE_PORT), "--strictPort"],
      { cwd: path.join(ROOT, "client"), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const onData = (b) => { out += b.toString(); if (out.includes(String(VITE_PORT))) resolve({ proc, url: `http://localhost:${VITE_PORT}` }); };
    proc.stdout.on("data", onData); proc.stderr.on("data", onData);
    proc.on("error", reject);
    setTimeout(() => reject(new Error(`vite did not start:\n${out.slice(-600)}`)), 60000);
  });
}
function selfHostedFont(u, req) {
  if (!u.pathname.startsWith("/@fs/") || !/\.(woff2?|ttf)$/.test(u.pathname)) return false;
  const file = decodeURIComponent(u.pathname.slice(4).replace(/^\/([A-Za-z]:)/, "$1"));
  if (!fs.existsSync(file)) return false;
  req.respond({ status: 200, contentType: "font/woff2", headers: { "Access-Control-Allow-Origin": "*" }, body: fs.readFileSync(file) });
  return true;
}

const RESUME = `<!doctype html><html><head><style>body{font-family:Georgia,serif}</style></head><body>
<div class="name">Ada Example</div><div class="contact">ada@example.invalid · Boston, MA</div>
<div class="section-title">SUMMARY</div><p>Backend engineer building data systems.</p>
<div class="section-title">TECHNICAL SKILLS</div><ul class="bullets"><li><strong>Languages:</strong> Python, SQL, Go</li></ul>
<div class="section-title">EXPERIENCE</div><div class="entry"><div class="entry-header"><div><span class="entry-org">Northwind</span></div><div class="entry-date">2022 – Present</div></div><div class="entry-role">Software Engineer</div><ul class="bullets"><li>Built a queue that cut latency 30%.</li></ul></div>
</body></html>`;
const API = {
  "/api/auth/me": { authenticated: true, user: { id: 1, username: "ada", planTier: "PRO", applyMode: "TAILORED" } },
  "/api/domain-profiles": [{ id: 1, profile_name: "Data Engineering", is_active: 1 }],
  "/api/resume-editor": { available: true, origin: RM_ORIGIN, url: `${RM_ORIGIN}/editor/`, contract: "rm-editor/1" },
  "/api/jobs/j1/resume-changes": { changes: [] },
  "/api/apply/runs": { runs: [], review: [], gated: [], inFlight: [], submitted: [], stopped: [], statusCounts: {} },
};

fs.mkdirSync(OUT, { recursive: true });
const res = await resolveBrowserExecutable();
if (!res) { console.error("no Chrome"); process.exit(1); }
const vite = await startVite();
const browser = await puppeteer.launch({ executablePath: res.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
const report = {};
try {
  for (const [w, h] of [[1440, 900], [400, 860]]) {
    for (const theme of ["plain-light", "dusk-dark"]) {
      const key = `${theme}-${w}`;
      const r = report[key] = { errors: [], frameErrors: [], saves: [], posts: [] };
      const p = await browser.newPage();
      p.on("pageerror", e => r.errors.push(String(e.message).slice(0, 200)));
      p.on("console", m => { if (m.type() === "error" && /localhost:5196/.test(m.location()?.url || "")) r.frameErrors.push(m.text().slice(0, 200)); });
      await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
      await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme.endsWith("dark") ? "dark" : "light" }, { name: "prefers-reduced-motion", value: "reduce" }]);
      await p.setRequestInterception(true);
      p.on("request", (req) => {
        const u = new URL(req.url());
        if (selfHostedFont(u, req)) return;
        if (u.origin === RM_ORIGIN) return req.continue();
        if (!u.pathname.startsWith("/api/")) return u.hostname === "localhost" ? req.continue() : req.respond({ status: 404, body: "" });
        if (req.method() === "POST") {
          r.posts.push(u.pathname);
          if (/^\/api\/resumes\/[^/]+\/html$/.test(u.pathname)) { let b = {}; try { b = JSON.parse(req.postData() || "{}"); } catch { /* */ } r.saves.push({ path: u.pathname, len: String(b.html || "").length, hasEdit: String(b.html || "").includes("walk-edit-46y"), tool: b.tool ?? null }); }
          return req.respond({ status: 200, contentType: "application/json", body: "{\"ok\":true}" });
        }
        req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(API[u.pathname] ?? {}) });
      });
      await p.evaluateOnNewDocument((th) => { try { localStorage.setItem("draft-theme", th); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch {} }, theme);
      await p.goto(`${vite.url}/app/auto-apply`, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
      await sleep(1200);
      // open it as a posting's Résumé does (lib/resumeEditor.js)
      await p.evaluate((html) => window.dispatchEvent(new CustomEvent("draft:resume-editor",
        { detail: { html, jobId: "j1", company: "Northwind", title: "Senior Data Engineer", tool: "lean", version: 1 } })), RESUME);
      await p.waitForSelector('iframe.rmeh__frame[data-ready="true"]', { timeout: 20000 }).catch(() => {});
      await sleep(1500);
      r.hostReady = await p.evaluate(() => document.querySelector("iframe.rmeh__frame")?.getAttribute("data-ready") || null);
      r.hostTokens = await p.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { canvas: cs.getPropertyValue("--c-canvas").trim(), accent: cs.getPropertyValue("--color-primary").trim(), text: cs.getPropertyValue("--color-text").trim() }; });
      const frame = p.frames().find(f => f.url().startsWith(RM_ORIGIN));
      r.frameUrl = frame ? frame.url().replace(/v=[^&]+/, "v=…") : null;
      if (frame) {
        r.frame = await frame.evaluate(() => {
          const cs = getComputedStyle(document.documentElement);
          const vis = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden"; };
          return {
            embedded: document.documentElement.dataset.embedded || null, shellAttr: document.documentElement.dataset.shell || null,
            tokens: { bg: cs.getPropertyValue("--bg").trim(), card: cs.getPropertyValue("--card").trim(), ink: cs.getPropertyValue("--ink").trim(), accent: cs.getPropertyValue("--accent").trim(), font: cs.getPropertyValue("--font").trim().slice(0, 60) },
            bodyBg: getComputedStyle(document.body).backgroundColor, colorScheme: document.documentElement.style.colorScheme || null,
            shell: { top: vis("[data-shell], .ed-top"), modes: vis(".ws-modes, .ed-modes"), start: vis("#start"), refused: vis("#refused"),
              tiny: !!document.querySelector("[data-tiny-root], .tiny, #tiny, [class*='tiny-']") && [...document.querySelectorAll("[data-tiny-root], .tiny, #tiny, [class*='tiny-']")].some(e => e.getClientRects().length > 0),
              tinyCss: !!document.querySelector('link[href="/assistant/tiny.css"]'), side: vis("[data-side], .ed-side, #ed-side") },
            bar: vis(".bar"), sections: document.querySelector("#paper")?.shadowRoot?.querySelectorAll(".sec").length ?? 0,
            hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          };
        });
        fs.writeFileSync(path.join(OUT, `${key}-open.png`), await p.screenshot({ type: "png" }));
        // an edit → `changed` → the host saves it
        r.edited = await frame.evaluate(() => {
          const root = document.querySelector("#paper")?.shadowRoot;
          const ed = root && [...root.querySelectorAll("[contenteditable='true'], [contenteditable='']")].find(e => /latency|engineer/i.test(e.textContent));
          if (!ed) return false;
          ed.focus();
          const sel = getSelection(); const rg = document.createRange(); rg.selectNodeContents(ed); rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg);
          document.execCommand("insertText", false, " walk-edit-46y");
          ed.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
          return true;
        });
        await sleep(2200);
        r.savedState = await frame.evaluate(() => { const s = document.querySelector("#saved"); return s ? { state: s.dataset.state || null, text: s.textContent } : null; });
        // Download HTML → the host downloads (export message)
        r.exportPress = await frame.evaluate(() => { const b = document.querySelector("#download-html"); if (!b) return false; b.click(); return true; });
        await sleep(800);
      }
      // Esc closes
      await p.keyboard.press("Escape"); await sleep(800);
      r.closedByEsc = await p.evaluate(() => !document.querySelector("iframe.rmeh__frame"));
      await p.close();
      console.log(key, JSON.stringify({ ready: r.hostReady, frame: r.frame, saves: r.saves, saved: r.savedState, esc: r.closedByEsc, errors: r.errors, frameErrors: r.frameErrors }).slice(0, 1200));
    }
  }
} finally { await browser.close(); vite.proc.kill(); rmServer.close(); }
fs.writeFileSync(path.join(OUT, "editor.json"), JSON.stringify(report, null, 2));
console.log(OUT);

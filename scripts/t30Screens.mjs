// T30 (owner, 10-19) · the acceptance screenshots: the closed launcher, the open dock (its Fill view), a popup and the
// settings page — in light and dark — written to docs/screens/t30-*.png for the WORKLOG's session report.
//
//   node scripts/t30Screens.mjs
//
// The REAL extension/dock.js, popup-layer.js, review-overlay.js and options page, in headless Chrome, a SYNTHETIC
// person (Ada Example) only; the options page is served from extension/ over http with a stub `chrome` (it reads no
// real account). No Chrome → it says so and exits 0.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { renderOverlay } from "../extension/review-overlay.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screens");
const chrome = await findChrome();
if (chrome.skip) { console.log(`[t30Screens] skipped: ${chrome.skip}`); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const DOCK = fs.readFileSync(path.join(ROOT, "extension/dock.js"), "utf8");
const LAYER = fs.readFileSync(path.join(ROOT, "extension/popup-layer.js"), "utf8");
const theme = { light: C_LIGHT, dark: C_DARK };
const ROWS = [
  { key: "a", label: "Address Line 1", group: "need", canType: true, required: true, note: "Needs you — draft holds no answer for this." },
  { key: "r", label: "Resume/CV", group: "need", fileType: "resume", required: true, note: "Your résumé goes here — choose which one." },
  { key: "p", label: "Postal Code", group: "check", source: "matched loosely", value: "01101", byDraft: true },
  { key: "f", label: "First Name", group: "ok", source: "profile", value: "Ada", byDraft: true },
  { key: "e", label: "Email", group: "ok", source: "profile", value: "ada@example.test", byDraft: true },
];

// the extension's own files over http (ES modules do not load from file://), and a page to draw the dock on
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((q, res) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname === "/page") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Acme — Apply</title><body style='margin:0;font-family:sans-serif;background:#e8e4dc'><h1 style='margin:40px'>Apply — Software Engineer</h1>"); return; }
  const f = path.join(ROOT, "extension", path.normalize(u.pathname).replace(/^[/\\]+/, ""));
  if (!f.startsWith(path.join(ROOT, "extension")) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
const written = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 820, deviceScaleFactor: 1 });
  const shot = async (name, clip) => { const f = path.join(OUT, `t30-${name}.png`); await page.screenshot({ path: f, clip }); written.push(path.relative(ROOT, f)); };
  const dockClip = () => page.evaluate(() => { const r = document.getElementById("rm-draft-dock").getBoundingClientRect();
    return { x: Math.max(0, r.left - 12), y: Math.max(0, r.top - 12), width: r.width + 24, height: Math.min(r.height + 24, 800) }; });
  for (const os of ["light", "dark"]) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: os }]);
    const fresh = async () => {
      await page.goto(`${base}/page`, { waitUntil: "load" });
      await page.evaluate(`window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { cb && cb({ ok: true }); } } };`);
      await page.addScriptTag({ content: DOCK });
      await page.addScriptTag({ content: LAYER });
    };
    // the closed launcher
    await fresh();
    await page.evaluate((th) => { const d = globalThis.__draftDock.ensure({ theme: th, place: { collapsed: true } });
      d.summary("fill", "2 need you · 3 of 5 filled", { need: 2, filled: 3, total: 5 }); }, theme);
    const sq = await page.evaluate(() => { const r = document.getElementById("rm-draft-dock").getBoundingClientRect(); return { x: r.left - 40, y: r.top - 20, width: r.width + 52, height: r.height + 40 }; });
    await shot(`launcher-${os}`, sq);
    // the open dock, its Fill view
    await fresh();
    await page.evaluate(`(${renderOverlay.toString()})(${JSON.stringify({ rows: ROWS })}, ${JSON.stringify({ runId: `t30-${os}`, waiting: true, theme, dock: { theme }, files: { tailored: null, base: true, generate: true } })})`);
    await new Promise(r => setTimeout(r, 200));
    await shot(`dock-${os}`, await dockClip());
    // a popup over the dock: the ask-once question
    await page.evaluate((th) => { void globalThis.__draftPopups.show({ id: "q", kind: "question", theme: th, icon: "info",
      text: "Draft this job and queue its résumé, or just fill this form yourself?",
      actions: [{ id: "d", label: "Draft it and queue its résumé", word: "Draft", primary: true }, { id: "m", label: "Just fill it myself", word: "Myself" }],
      toggle: { role: "remember", label: "Remember my choice", icon: "pin" } }); }, theme);
    await new Promise(r => setTimeout(r, 250));
    await shot(`popup-${os}`, await dockClip());
    // the settings page, at #permissions — served from extension/, with a stub chrome
    await page.evaluateOnNewDocument(() => {
      const state = { ok: true, granted: { workday: true, greenhouse: true }, customGranted: {}, settings: { custom: {}, consent: null, sites: {} } };
      window.chrome = { runtime: { lastError: null, getManifest: () => ({ host_permissions: ["https://jobsviadraft.com/*"], version: "1.5.2" }), getURL: (p) => p, id: "x",
          sendMessage: (m, cb) => { const r = m?.type === "AUTO_READ_STATE" ? state : { ok: true }; if (cb) cb(r); return Promise.resolve(r); }, onMessage: { addListener() {} } },
        commands: { getAll: async () => [{ name: "capture", description: "Capture this job posting", shortcut: "Ctrl+Shift+K" }, { name: "fill", description: "Fill this application form", shortcut: "Ctrl+Shift+Y" }] },
        permissions: { getAll: async () => ({ origins: ["https://jobsviadraft.com/*", "https://*.myworkdayjobs.com/*", "https://*.myworkdaysite.com/*", "https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"] }),
          contains: async () => false, request: async () => true, remove: async () => true, onAdded: { addListener() {} }, onRemoved: { addListener() {} } },
        storage: { local: { get: async () => ({}), set: async () => {} }, sync: { remove: async () => {}, get: async () => ({}) }, onChanged: { addListener() {} } },
        tabs: { create: async () => ({}) } };
    });
    await page.goto(`${base}/options.html#permissions`, { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 300));
    await shot(`settings-${os}`, { x: 0, y: 0, width: 480, height: 800 });
  }
} finally { await browser.close(); server.close(); }
console.log(`[t30Screens] wrote ${written.length}:\n  ${written.join("\n  ")}`);

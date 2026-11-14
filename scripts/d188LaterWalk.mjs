// scripts/d188LaterWalk.mjs — ⭐ D188 LATER · ANNOTATE + WORD → PDF in the PDF-tools workspace, END TO END in real Chrome
// (46m item 4). Synthetic documents only.
//   1. Annotate mode: Highlight · Draw · Box · Note in the tool bar; a highlight and a box placed by a click, a freehand
//      stroke drawn with the pointer; Undo takes the stroke back, Redo returns it
//   2. Download → the PDF carries them: the see-through highlight (opacity + multiply), the box and the stroke as paths
//   3. Word → PDF: a .docx opened in the workspace becomes a PDF here — its title, heading, bullet and body text are the
//      page's text; the status says what was and wasn't carried; the same file from Documents home opens the same way
//   ⛔ no request to /api or a model at any point (everything runs in the browser)
// Run from draft (it has puppeteer-core): node scripts/d188LaterWalk.mjs [path-to-the-pdf-tools-repo]
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RM = path.resolve(process.argv[2] || process.env.RM_DIR || path.join(ROOT, "..", "resume-master"));
const { createApp } = await import(pathToFileURL(path.join(RM, "src", "http", "app.js")).href);
const lib = await import(pathToFileURL(path.join(RM, "node_modules", "@cantoo", "pdf-lib", "cjs", "index.js")).href);
const { zipSync, strToU8 } = await import(pathToFileURL(path.join(RM, "node_modules", "fflate", "esm", "index.mjs")).href).catch(() => import("fflate"));
fs.mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
const app = createApp({ log: () => {} });
const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
const base = process.env.WALK_BASE || `http://127.0.0.1:${server.address().port}`;   // WALK_BASE: walk a deployed site instead
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(p => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, args: ["--no-first-run"] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const doc = await lib.PDFDocument.create();
const f = await doc.embedFont(lib.StandardFonts.Helvetica);
const pg = doc.addPage([612, 792]);
pg.drawText("Offer letter — Example Robotics", { x: 72, y: 720, size: 16, font: f });
pg.drawText("Base salary: $120,000 per year", { x: 72, y: 690, size: 11, font: f });
pg.drawText("Non-compete: twelve months after leaving", { x: 72, y: 670, size: 11, font: f });
const PDF64 = Buffer.from(await doc.save()).toString("base64");
const docxml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Jordan Example</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Experience</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Grew revenue </w:t></w:r><w:r><w:t>to 10,700,942 in 2023</w:t></w:r></w:p>
<w:p><w:r><w:t>Data analyst with five years of SQL, Python and Tableau.</w:t></w:r></w:p></w:body></w:document>`;
const DOCX64 = Buffer.from(zipSync({ "[Content_Types].xml": strToU8("<Types/>"), "word/document.xml": strToU8(docxml) })).toString("base64");

const checks = [];
const ok = (name, pass, detail = "") => { checks.push({ pass: !!pass }); console.log(`${pass ? "✔" : "✘"} ${name}${detail ? ` — ${String(detail).slice(0, 220)}` : ""}`); };
const setFile = (page, sel, b64, name, type) => page.evaluate(async (sel, b64, name, type) => {
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const dt = new DataTransfer(); dt.items.add(new File([bin], name, { type }));
  const input = document.querySelector(sel); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
}, sel, b64, name, type);
const errors = [], apiCalls = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", e => errors.push(e.message));
  // the home page reads its own settings (/v1/site/config) — not a model; anything that could reach one is counted
  page.on("request", r => { const u = new URL(r.url()); if (/^\/(api|mcp)\b|\/v1\/(generate|tailor|parse|score|messages|assistant)|anthropic/.test(u.pathname + u.host)) apiCalls.push(u.pathname); });
  page.on("dialog", d => d.accept().catch(() => {}));
  await page.setViewport({ width: 1440, height: 950 });
  await page.goto(`${base}/workspace/`, { waitUntil: "networkidle0" });
  await setFile(page, "#ws-open", PDF64, "offer.pdf", "application/pdf");
  await page.waitForFunction(() => document.querySelector("[data-ws]")?.dataset.state === "open", { timeout: 60000 });

  // 1 · Annotate
  await page.click('.ws-mode[data-mode="annotate"]'); await sleep(200);
  const tools = await page.$$eval("#ws-tools [data-tool]", els => els.map(e => e.dataset.tool));
  ok("Annotate's tools: Select · Highlight · Draw · Box · Note", tools.join(",") === "select,highlight,ink,box,text", tools.join(","));
  const pageBox = await page.$eval(".pt-ed-layer", e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const at = (fx, fy) => [pageBox.x + pageBox.w * fx, pageBox.y + pageBox.h * fy];
  await page.click('[data-tool="highlight"]'); await page.mouse.click(...at(0.3, 0.13)); await sleep(150);
  await page.click('[data-tool="box"]'); await page.mouse.click(...at(0.4, 0.16)); await sleep(150);
  await page.click('[data-tool="ink"]');
  await page.mouse.move(...at(0.12, 0.30)); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(...at(0.12 + i * 0.03, 0.30 + Math.sin(i / 2) * 0.02));
  await page.mouse.up(); await sleep(200);
  const items = () => page.evaluate(() => window.__rmWorkspace.items.map(i => i.type));
  ok("a highlight, a box and a freehand stroke on the page", JSON.stringify(await items()) === JSON.stringify(["highlight", "box", "ink"]), JSON.stringify(await items()));
  const inkPath = await page.evaluate(() => window.__rmWorkspace.items.find(i => i.type === "ink")?.payload.d || "");
  ok("…the stroke is a path through the pointer's points", (inkPath.match(/L/g) || []).length >= 10, inkPath.slice(0, 80));
  await page.click("#ws-undo"); await sleep(150);
  ok("Undo takes the stroke back", JSON.stringify(await items()) === JSON.stringify(["highlight", "box"]));
  await page.click("#ws-redo"); await sleep(150);
  ok("Redo returns it", (await items()).includes("ink"));
  await page.screenshot({ path: path.join(ROOT, "tmp", "d188-annotate.png") });

  // 2 · the PDF carries them
  const saved = await page.evaluate(async () => { const r = await window.__rmWorkspace.save(); return btoa(String.fromCharCode(...r.bytes)); });
  const out = await lib.PDFDocument.load(Buffer.from(saved, "base64"));
  const p0 = out.getPage(0);
  const res = p0.node.Resources();
  const gs = res?.lookup(lib.PDFName.of("ExtGState"));
  const states = gs ? gs.entries().map(([, v]) => out.context.lookup(v)) : [];
  const see = states.some(s => Number(s.get(lib.PDFName.of("ca"))?.asNumber?.() ?? s.get(lib.PDFName.of("ca"))?.value?.()) < 0.5);
  const multiply = states.some(s => String(s.get(lib.PDFName.of("BM")) || "").includes("Multiply"));
  ok("the highlight is see-through (opacity < 0.5) and multiplies over the words", see && multiply, `${states.length} graphics states`);
  const contents = p0.node.Contents();
  const raw = (() => { const arr = contents instanceof lib.PDFArray ? contents.asArray().map(r => out.context.lookup(r)) : [contents]; return arr.map(s => { try { return Buffer.from(lib.decodePDFRawStream ? lib.decodePDFRawStream(s).decode() : s.getContents()).toString("latin1"); } catch { return Buffer.from(s.getContents?.() || []).toString("latin1"); } }).join("\n"); })();
  // pdf-lib draws a rectangle as a closed path (m … l … h), so: two stroked paths — the box's outline and the ink
  ok("the box and the stroke are drawn (two stroked paths)", (raw.match(/(?:^|\s)S(?=\s|$)/g) || []).length >= 2 && (raw.match(/(?:^|\s)l(?=\s)/g) || []).length >= 10, `${raw.length} bytes: ${raw.replace(/\s+/g, " ").slice(-260)}`);

  // 3 · Word → PDF
  await page.goto(`${base}/workspace/`, { waitUntil: "networkidle0" });
  await setFile(page, "#ws-open", DOCX64, "jordan-cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await page.waitForFunction(() => document.querySelector("[data-ws]")?.dataset.state === "open" && /Made from Word/.test(document.querySelector("#ws-status").textContent), { timeout: 60000 });
  const word = await page.evaluate(() => ({ name: document.querySelector("#ws-name").textContent, pages: window.__rmWorkspace.pages.length,
    texts: window.__rmWorkspace.fields.map(f => f.text), status: document.querySelector("#ws-status").textContent }));
  ok("a .docx opens as a PDF here: its title, heading, bullet and body are the page's text", word.pages === 1 && ["Jordan Example", "Experience"].every(t => word.texts.includes(t))
    && word.texts.some(t => /^•\s*Grew revenue to 10,700,942 in 2023$/.test(t)) && word.texts.some(t => /Tableau/.test(t)), JSON.stringify(word.texts));
  ok("…named after the Word file", word.name === "jordan-cv", word.name);
  ok("…and the status says what was and wasn't carried", /Helvetica/.test(word.status) && /not carried/.test(word.status), word.status);
  await page.screenshot({ path: path.join(ROOT, "tmp", "d188-word.png") });
  // Documents home → the same
  await page.goto(`${base}/`, { waitUntil: "networkidle0" });
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }), setFile(page, "#docs-open", DOCX64, "cover.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")]);
  await page.waitForFunction(() => document.querySelector("[data-ws]")?.dataset.state === "open", { timeout: 60000 });
  ok("Documents home takes a .docx and the workspace opens it as a PDF", (await page.evaluate(() => window.__rmWorkspace.fields.map(f => f.text))).includes("Jordan Example"));

  ok("⛔ no request to /api or a model", apiCalls.length === 0, apiCalls.join(","));
  ok("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  ok("walk ran to the end", false, e.stack || e.message);
} finally { await browser.close(); server.close(); }
const failed = checks.filter(c => !c.pass);
console.log(`\n${checks.length - failed.length} / ${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);

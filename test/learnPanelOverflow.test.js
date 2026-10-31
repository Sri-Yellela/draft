// ⚠ BUG (owner 10-31, production screenshot, dark theme) · THE LEARN PIECE PANEL OVERLAPS — "content is obstructed and
// overlapping in production, the buttons i think are fixed and not fluid". In Before this / After this the "draft" tag sat
// on the title, "Go back to understand: …" ran out of its box over the After column, titles were cut, and each row's state
// marker looked like a checkbox (D117 C8: nothing a user can press says complete).
//
// CAUSES, read from the code: (1) DepthButton is `white-space: nowrap` with a fixed height and `flex-shrink: 0`, so a long
// label cannot wrap and leaves its column; (2) the twin boxes split by the WINDOW's width (`@media (max-width: 560px)`), so
// a ~500px panel on a wide screen kept two ~240px columns; (3) the state marker was a 14px square with a 4px radius and a
// 2px border — a checkbox's look.
// FIX: DepthButton's `wrap` variant (height a minimum, the label wraps); the twin boxes stack by the panel's width (a
// container query); the state is a dot (filled / half / ring), aria-hidden, the state said in the row's accessible name;
// the draft tag inline after the title.
//
// Part 1 reads the code. Part 2 draws the real PieceBody (esbuild + react-dom/server) with the real LearnCircle.css and
// DepthButton.css over each theme's tokens in headless Chrome, at panel widths 320 / 420 / 600, and measures every box. It
// SKIPS, saying why, on a machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { learnContent } from "../services/learn/learnContent.js";
import { seedCircleData, circleOf } from "../services/learn/learnCircle.js";
import { piecesOf, stepState } from "../client/src/pages/atlas/learnModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import { PieceBody } from ${abs("pages/atlas/LearnCircle.jsx")};
        import DepthButton from ${abs("components/DepthButton.jsx")};
        export const body = (props) => renderToStaticMarkup(h(PieceBody, props));
        export const button = (props, label) => renderToStaticMarkup(h(DepthButton, props, label));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "learn-panel-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

function pieceProps() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  seedCircleData(db);
  const learn = learnContent(db), pieces = piecesOf(learn, circleOf(db, learn));
  const states = new Map(pieces.map(p => [p.id, stepState(p, {})]));
  // The piece with the most drafted "Before this" links and the longest titles among them — the screenshot's case.
  const score = (p) => (p.needs || []).filter(n => n.status === "drafted").length * 100
    + Math.max(0, ...(p.needs || []).map(n => (pieces.find(x => x.id === n.id)?.t || "").length));
  const piece = [...pieces].filter(p => (p.opens || []).length).sort((a, b) => score(b) - score(a))[0];
  return { piece, pieces, states, signedIn: true };
}

test("learnPanel · the code: the twin boxes stack by the panel's width (container query), the go-back button wraps, the state marker is a dot", () => {
  const css = read("client/src/pages/atlas/LearnCircle.css");
  assert.match(css, /\.lrc__piece-body \{ container-type: inline-size; \}/);
  assert.match(css, /@container \(max-width: 560px\) \{ \.lrc__twin \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  assert.doesNotMatch(css, /@media \(max-width: 560px\) \{ \.lrc__twin/, "the window's width decides nothing about the panel's columns");
  const st = css.match(/\.lrc__st \{[^}]*\}/)[0];
  assert.match(st, /width: 10px; height: 10px; border-radius: 5px;/, "the state marker is a perfect circle (a dot), not a rounded square");
  const jsx = read("client/src/pages/atlas/LearnCircle.jsx");
  assert.match(jsx, /<DepthButton size="compact" wrap className="lrc__goback"/);
  assert.doesNotMatch(jsx, /\bSq\b/, "the old square marker is gone");
});

test("depthButtonWraps · the wrap variant: white-space normal, height a minimum, never wider than its column; squares never wrap", async () => {
  const css = read("client/src/components/DepthButton.css");
  const w = css.match(/\.dbx--wrap \{[^}]*\}/)[0];
  for (const d of ["white-space: normal", "height: auto", "max-width: 100%", "flex-shrink: 1", "min-width: 0"]) assert.ok(w.includes(d), d);
  assert.match(css, /\.dbx--wrap\.dbx--compact \{ min-height: 30px;/);
  const { button } = await loadUi();
  assert.match(button({ size: "compact", wrap: true }, "Go back"), /class="dbx dbx--compact dbx--wrap"/);
  assert.doesNotMatch(button({ size: "square", wrap: true, title: "Save" }, "Save"), /dbx--wrap/, "an icon-only square keeps its fixed size");
  assert.doesNotMatch(button({ size: "box" }, "Draft"), /dbx--wrap/, "the default is unchanged");
});

test("learnPanelNoCheckboxLook · no checkbox in the piece panel: no input[type=checkbox], no role=checkbox, the dots aria-hidden, the state said in the row's name", async () => {
  const { body } = await loadUi();
  const html = body(pieceProps());
  assert.doesNotMatch(html, /type="checkbox"|role="checkbox"|aria-checked/);
  const dots = html.match(/<span class="lrc__st lrc__st--\w+"[^>]*>/g) || [];
  assert.ok(dots.length >= 2, "the neighbour rows carry a state dot");
  for (const d of dots) assert.match(d, /aria-hidden="true"/);
  const rows = html.match(/<button type="button" class="lrc__nb"[^>]*>/g) || [];
  assert.equal(rows.length, dots.length);
  for (const r of rows) assert.match(r, /aria-label="[^"]+, (finished|started|not started)(, a drafted link)?"/);
});

test("draftTagInline · the draft tag sits inside the title's own text run, after the words", async () => {
  const { body } = await loadUi();
  const html = body(pieceProps());
  const tagged = html.match(/<span class="lrc__nb-t">[^<]+<span class="mark mark--dim lrc__draft"[^>]*>draft<\/span><\/span>/g) || [];
  assert.ok(tagged.length >= 1, "a drafted link's tag follows its title inside the same span");
  const css = read("client/src/pages/atlas/LearnCircle.css");
  assert.match(css, /\.lrc__nb-t \.lrc__draft \{ display: inline;/);
  assert.doesNotMatch(css.match(/\.lrc__nb-t \.lrc__draft \{[^}]*\}/)[0], /position/);
});

// ═══ Part 2 · measured in Chrome ═════════════════════════════════════════════════════════════════════════════════

const { resolveBrowserExecutable } = await import("../services/browserLauncher.js");
let browserPath = null;
try { browserPath = (await resolveBrowserExecutable())?.path || null; } catch { browserPath = null; }
const NO_CHROME = browserPath && fs.existsSync(browserPath) ? false : "no Chrome on this machine (services/browserLauncher.js found none)";

test("learnPanelNoOverflow · 4 themes × panel 320 / 420 / 600px: no child's box leaves its column, the draft tag never covers a title, the go-back button stays in its box, the dots are round", { skip: NO_CHROME, timeout: 180000 }, async () => {
  const { default: puppeteer } = await import("puppeteer-core");
  const { THEME_LIST, cssVarName } = await import("../client/src/themes/index.js");
  const { body } = await loadUi();
  const html = body(pieceProps());
  const css = read("client/src/pages/atlas/LearnCircle.css") + read("client/src/components/DepthButton.css");
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", pipe: true, args: ["--no-first-run"] });
  const failures = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    for (const t of THEME_LIST) for (const width of [320, 420, 600]) {
      await page.setContent(`<!doctype html><html data-theme="${t.id}" style="${Object.entries(t.tokens).map(([k, v]) => `${cssVarName(k)}:${v}`).join(";")};--font-body:sans-serif;--fh-logo-family:sans-serif">
        <head><style>${css} body{margin:0;background:var(--c-canvas);font-family:sans-serif} *{transition:none!important;animation:none!important}</style></head>
        <body><div class="lrc"><section class="lrc__piece" style="width:${width}px;max-height:none;border-left:0">${html}</section></div></body></html>`, { waitUntil: "load" });
      const r = await page.evaluate(() => {
        const out = [];
        const box = (e) => e.getBoundingClientRect();
        const name = (e) => e.className && typeof e.className === "string" ? "." + e.className.split(" ").join(".") : e.tagName;
        // every element stays inside its box / column (1px rounding)
        for (const col of document.querySelectorAll(".lrc__box, .lrc__piece-body")) {
          const c = box(col);
          for (const e of col.querySelectorAll("*")) {
            const b = box(e);
            if (!b.width && !b.height) continue;
            if (b.right > c.right + 1 || b.left < c.left - 1) out.push(`${name(e)} (${Math.round(b.left)}–${Math.round(b.right)}) leaves ${name(col)} (${Math.round(c.left)}–${Math.round(c.right)})`);
          }
        }
        // the two boxes never overlap each other
        const [bef, aft] = [document.querySelector(".lrc__box--before"), document.querySelector(".lrc__box--after")].map(box);
        if (!(bef.right <= aft.left + 1 || bef.bottom <= aft.top + 1)) out.push("Before this and After this overlap");
        const cols = bef.top === aft.top ? 2 : 1;
        // the draft tag shares no pixels with another row's title, and sits after its own words
        for (const tag of document.querySelectorAll(".lrc__draft")) {
          const tb = box(tag), row = tag.closest(".lrc__nb"), rb = box(row);
          if (getComputedStyle(tag).position !== "static") out.push("a draft tag is positioned");
          if (tb.top < rb.top - 1 || tb.bottom > rb.bottom + 1) out.push(`a draft tag leaves its row (${Math.round(tb.top)}–${Math.round(tb.bottom)} vs ${Math.round(rb.top)}–${Math.round(rb.bottom)})`);
        }
        const back = document.querySelector(".lrc__goback");
        if (back && back.scrollWidth > back.clientWidth + 1) out.push(`the go-back button's text is cut (${back.scrollWidth} > ${back.clientWidth})`);
        for (const d of document.querySelectorAll(".lrc__st")) {
          const b = box(d);
          if (Math.abs(b.width - b.height) > 0.5 || parseFloat(getComputedStyle(d).borderTopLeftRadius) < b.width / 2 - 0.5) { out.push("a state marker is not a dot"); break; }
        }
        return { out, cols };
      });
      const tag = `${t.id} @${width}px`;
      for (const f of r.out) failures.push(`${tag}: ${f}`);
      if (width < 560 && r.cols !== 1) failures.push(`${tag}: the twin boxes did not stack (${r.cols} columns)`);
      if (width >= 600 && r.cols !== 2) failures.push(`${tag}: the twin boxes stacked at a wide panel`);
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
});

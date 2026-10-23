// T26 (owner, 10-19) · A MINIMAL DOCK — "too much text, too many lines, too many colours, and it looks choppy. As
// minimal as possible, only the necessary stuff, in minimal ICONS, not text."
//
// THE RULES, each a test: TEXT BUDGET (the dock carries field labels and values only — every other word is a tooltip and
// an accessible name) · COLOUR BUDGET (one neutral surface, ONE accent, at most a status mark) · LINE BUDGET (ONE divider:
// the header's) · ICONS, NOT WORDS (every control is an icon with an aria-label AND a tooltip) · the gear opens the
// settings page (T29), on the person's own click only.
//
// Part 1 reads the source. Part 2 draws the real extension/dock.js in headless Chrome, in all four themes, and counts.
// It SKIPS, saying why, on a machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { at } from "../test-support/sourceAnchors.js";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { C_LIGHT, C_DARK, C_CONTRAST_LIGHT, C_CONTRAST_DARK } from "../extension/tokens.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const DOCK = read("extension/dock.js");
const BG = read("extension/background.js");
const FRAME_CSS = DOCK.slice(at(DOCK, "const FRAME_CSS = (theme, logo) => `"), at(DOCK, "const LOGO_FACE = 'rm-draft-logo';"));

test("T26 ① ONE icon set — stroke icons in currentColor, hidden from assistive tech, offered to every view", () => {
  const set = DOCK.slice(at(DOCK, "const ICONS = Object.freeze({"), at(DOCK, "/** One icon's markup"));
  for (const name of ["move", "dockLeft", "dockRight", "pop", "dockBack", "minimise", "expand", "settings", "close", "fill", "ats", "resume", "copy",
    "check", "need", "recheck", "skip", "pin", "edit", "attach", "generate", "submitted"]) assert.match(set, new RegExp(`\\n    ${name}: '`), `no ${name} icon`);
  assert.match(DOCK, /aria-hidden="true" focusable="false" fill="none" stroke="currentColor"/);
  assert.match(DOCK, /ICONS, icon,\n/, "the views reach the set through __draftDock");
});

test("T26 ② LINE BUDGET — the header's rule is the frame's one divider; the tabs have none under them", () => {
  const rules = [...FRAME_CSS.matchAll(/border(?:-top|-bottom|-left|-right)?: 1px solid var\(--c-border\)/g)];
  assert.equal(rules.length, 1, `${rules.length} divider rules in the frame`);
  assert.match(FRAME_CSS, /\.hd \{[^}]*border-bottom: 1px solid var\(--c-border\)/);
  assert.doesNotMatch(FRAME_CSS.slice(at(FRAME_CSS, ".tabs {"), at(FRAME_CSS, ".tab {")), /border/);
});

test("T26 ③ ICONS, NOT WORDS — header controls are ghost icons; the tabs are icons named by aria-label and tooltip", () => {
  assert.match(FRAME_CSS, /\.ib \{[^}]*border: 0; background: transparent;/);
  for (const glyph of ["✥", "⇤", "⇥", "⧉", "⇲", "▢", "◢"]) assert.ok(!DOCK.includes(`>${glyph}</button>`), `the ${glyph} glyph is back as a control's text`);
  assert.match(DOCK, /aria-label="\$\{esc\(t\.label\)\}" title="\$\{esc\(t\.label\)\}">\$\{icon\(t\.icon, 18\)\}<\/button>/);
});

test("T26 ④ the gear: the dock's only, the person's own click only, the service worker opens one of the page's sections", () => {
  assert.match(DOCK, /\$\{kind === 'dock' \? gearBtn : ''\}/);
  assert.match(DOCK, /if \(role === 'settings'\) \{ if \(ev\.isTrusted\) void send\(\{ type: 'OPEN_SETTINGS', trigger: 'click' \}\); return; \}/);
  const h = BG.slice(at(BG, "if (message.type === 'OPEN_SETTINGS') {"), at(BG, "// \"Unlink this page\""));
  assert.match(h, /message\.trigger !== 'click' \|\| sender\?\.frameId !== 0 \|\| !sender\?\.tab\?\.id/);
  assert.match(h, /SETTINGS_SECTIONS\.includes\(message\.section\) \? `#\$\{message\.section\}` : ''/, "a section is one of the page's own, never a URL");
  assert.match(h, /chrome\.runtime\.getURL\(`options\.html\$\{section\}`\)/);
});

// ═══ Part 2 · in a real Chrome ═══════════════════════════════════════════════════════════════════════════════

const chrome = await findChrome();
const SKIP = chrome.skip || false;
const STUB = `window.__sent = []; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { window.__sent.push(m); cb && cb({ ok: true }); } } };`;

test("T26 · the frame in a REAL Chrome — no words outside names, one divider, every control named, four themes; the gear on a real click only", { skip: SKIP, timeout: 90000 }, async (t) => {
  const server = http.createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Acme</title><body style='margin:0'><h1>Software Engineer</h1>"); });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const cases = [["paper, light OS", { light: C_LIGHT, dark: C_DARK }, "light"], ["paper, dark OS", { light: C_LIGHT, dark: C_DARK }, "dark"],
    ["contrast, light OS", { light: C_CONTRAST_LIGHT, dark: C_CONTRAST_DARK }, "light"], ["contrast, dark OS", { light: C_CONTRAST_LIGHT, dark: C_CONTRAST_DARK }, "dark"]];
  for (const [name, theme, os] of cases) for (const cues of [false, true]) {
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: os }]);
    await page.evaluate(STUB);
    await page.addScriptTag({ content: DOCK });
    await page.evaluate((m) => globalThis.__draftDock.ensure(m), { theme, cues });
    const g = await page.evaluate(() => {
      const root = document.getElementById("rm-draft-dock").shadowRoot, fr = root.querySelector(".fr");
      // visible words: every text node not inside an .sr (screen-reader only) element
      const words = []; const w = document.createTreeWalker(fr, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent.trim() && !n.parentElement.closest(".sr")) words.push(n.textContent.trim());
      const unnamed = [...root.querySelectorAll("button")].filter(b => !b.getAttribute("aria-label") || !b.title).map(b => b.dataset.role);
      // a divider: a painted 1px+ border that is not the accent's tab bar
      const accent = getComputedStyle(fr).getPropertyValue("--c-accent").trim();
      const lines = [...root.querySelectorAll("*")].flatMap(e => { const s = getComputedStyle(e); return ["Top", "Right", "Bottom", "Left"].filter(k =>
        parseFloat(s[`border${k}Width`]) >= 1 && s[`border${k}Style`] !== "none" && !/rgba\(0, 0, 0, 0\)|transparent/.test(s[`border${k}Color`]) && e !== fr
        && !(e.getAttribute("role") === "tab" && k === "Bottom")).map(k => `${e.className || e.tagName}:${k}`); });
      return { words, unnamed, lines, accent, gear: !!root.querySelector('[data-role="settings"]'), tabs: root.querySelectorAll('[role="tab"] svg').length };
    });
    const tag = `${name}${cues ? " · shape cues" : ""}`;
    assert.deepEqual(g.words.filter(x => !/^\/?draft$|^\/$/.test(x)), [], `${tag}: words in the frame beside the mark`);
    assert.deepEqual(g.unnamed, [], `${tag}: a control without an aria-label and a tooltip`);
    assert.deepEqual(g.lines, ["hd:Bottom"], `${tag}: the dividers`);
    assert.ok(g.gear, `${tag}: no gear`);
    assert.equal(g.tabs, 4, `${tag}: four icon tabs`);
  }
  // the gear: a page script's click sends nothing; the person's click asks the service worker for the settings page
  await page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="settings"]').click());
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "OPEN_SETTINGS")), []);
  await page.click("#rm-draft-dock >>> [data-role='settings']");
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "OPEN_SETTINGS")), [{ type: "OPEN_SETTINGS", trigger: "click" }]);
});

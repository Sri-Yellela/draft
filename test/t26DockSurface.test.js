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

// ═══ Part 3 · the Fill view (review-overlay.js) — the owner's screenshot, counted ═════════════════════════════

test("T26 ⑤ the Fill view's source — no sentence on screen: the title, the progress line, the state, the notes and the flags are hidden words and tooltips", async () => {
  const ro = read("extension/review-overlay.js");
  const view = ro.slice(at(ro, "export function renderOverlay("), at(ro, "export function removeReviewPanel"));
  for (const gone of ['<div class="rm-t">Review before you submit</div>', '<div class="rm-s">Draft never submits for you.', '<div class="rm-s" style="margin-top:6px">Submit the form yourself',
    '> Remember for next time</label>', '>use it</button>', 'class="rm-remind"', 'class="rm-bug"', 'class="rm-next"'])
    assert.ok(!view.includes(gone), `back on screen: ${gone}`);
  assert.match(view, /<span class="rm-t sr">Review before you submit<\/span>/);
  assert.match(view, /#\$\{ID\} \.rm-row \{ display: flex; align-items: flex-start; gap: 10px; padding: 7px 6px; \}/, "a row has no border and no fill");
  assert.match(view, /background: transparent; text-align: left; \}/, "the view paints no surface of its own");
});

const OVERLAY_ROWS = [
  { key: "a", label: "Address Line 1", group: "need", canType: true, required: true, note: "Needs you — draft holds no answer for this." },
  { key: "r", label: "Resume/CV", group: "need", fileType: "resume", required: true, note: "Your résumé goes here — choose which one." },
  { key: "l", label: "Cover Letter", group: "need", fileType: "cover_letter", note: "A cover letter — draft holds none for this job; attach one on the page, or skip it." },
  { key: "h", label: "How did you hear about us?", group: "need", canType: true, optional: true, copyValue: "LinkedIn", choices: ["LinkedIn", "Referral"], note: "None of the page's choices is close — pick it yourself." },
  { key: "p", label: "Postal Code", group: "check", source: "matched loosely", value: "01101", byDraft: true },
  { key: "f", label: "First Name", group: "ok", source: "profile", value: "Ada", byDraft: true, remembered: true },
  { key: "e", label: "Email", group: "ok", source: "profile", value: "ada@example.test", byDraft: true },
];

test("T26 · the Fill view in a REAL Chrome — ≤ 40 visible characters beyond labels and values, one surface and one accent, no divider, every control named; four themes", { skip: SKIP, timeout: 120000 }, async (t) => {
  const { renderOverlay } = await import("../extension/review-overlay.js");
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  const cases = [["paper, light OS", { light: C_LIGHT, dark: C_DARK }, "light"], ["paper, dark OS", { light: C_LIGHT, dark: C_DARK }, "dark"],
    ["contrast, light OS", { light: C_CONTRAST_LIGHT, dark: C_CONTRAST_DARK }, "light"], ["contrast, dark OS", { light: C_CONTRAST_LIGHT, dark: C_CONTRAST_DARK }, "dark"]];
  for (const [name, theme, os] of cases) {
    await page.setContent("<!doctype html><title>Acme</title><body style='margin:0'><h1>Apply</h1>");
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: os }]);
    await page.evaluate(STUB);
    await page.addScriptTag({ content: DOCK });
    const meta = { runId: `t26-${name}`, waiting: true, theme, dock: { theme }, review: { showInPanel: true }, resolverBug: [{ field: "Sponsorship" }],
      portal: { remaining: 2, host: "acme.test", next: { title: "Data Engineer" } }, files: { tailored: null, base: true, generate: true, letter: false } };
    await page.evaluate(`(${renderOverlay.toString()})(${JSON.stringify({ rows: OVERLAY_ROWS })}, ${JSON.stringify(meta)})`);
    // every group open, so every row's controls are on screen
    await page.evaluate(() => { const r = document.getElementById("rm-gate-review-overlay").shadowRoot;
      for (const b of r.querySelectorAll('[data-role="group"][aria-expanded="false"]')) b.click(); });
    const g = await page.evaluate(() => {
      const host = document.getElementById("rm-gate-review-overlay"), root = host.shadowRoot, view = root.getElementById("rm-gate-review-overlay");
      const shown = (e) => { for (let a = e; a && a !== root; a = a.parentElement || a.getRootNode()?.host) { if (a.nodeType !== 1) continue;
        const s = getComputedStyle(a); if (s.display === "none" || s.visibility === "hidden" || a.classList.contains("sr")) return false; } return true; };
      const words = []; const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement, s = n.textContent.trim();
        if (!s || !shown(p) || p.closest('[data-role="label"], [data-role="value"], select, option')) continue; words.push(s); }
      const els = [...view.querySelectorAll("*")].filter(shown);
      // a NAME: its aria-label, or its own (hidden) words — a group heading is named "Needs you 3" by its .sr span
      const unnamed = els.filter(e => e.matches("button, input[type=checkbox]") && !e.getAttribute("aria-label") && !e.textContent.replace(/[▾▸\d\s]/g, "")).map(e => e.dataset.role || e.outerHTML.slice(0, 60))
        .concat(els.filter(e => e.matches("button") && !e.title).map(e => `${e.dataset.role}: no tooltip`));
      const tok = (n) => getComputedStyle(view).getPropertyValue(n).trim();
      const probe = document.createElement("i"); view.append(probe);
      const rgb = (c) => { probe.style.color = c; return getComputedStyle(probe).color; };
      const allowedBg = new Set(["--c-surface-solid", "--c-surface-input", "--c-accent"].map(n => rgb(tok(n))));
      const fills = [...new Set(els.filter(e => !e.matches("svg, path") && !["rgba(0, 0, 0, 0)", "transparent"].includes(getComputedStyle(e).backgroundColor))
        .map(e => getComputedStyle(e).backgroundColor))].filter(c => !allowedBg.has(c));
      const lines = els.filter(e => !e.matches("input, select, textarea, svg, path") && ["Top", "Right", "Bottom", "Left"].some(k => parseFloat(getComputedStyle(e)[`border${k}Width`]) >= 1
        && !/rgba\(0, 0, 0, 0\)/.test(getComputedStyle(e)[`border${k}Color`]))).map(e => e.className || e.tagName);
      probe.remove();
      return { words, unnamed, fills, lines, text: view.textContent };
    });
    const visible = g.words.join("");
    assert.ok(visible.length <= 40, `${name}: ${visible.length} visible characters beyond labels and values — ${JSON.stringify(g.words)}`);
    assert.ok(g.words.every(x => /^[\d+▾▸]+$/.test(x)), `${name}: a word on screen — ${JSON.stringify(g.words)}`);
    assert.deepEqual(g.unnamed, [], `${name}: a control without its name and tooltip`);
    assert.deepEqual(g.fills, [], `${name}: a fill outside the surface, the field and the one accent`);
    assert.deepEqual(g.lines, [], `${name}: a divider or a bordered box in the view`);
    // the words are still all there for a screen reader
    for (const said of ["Review before you submit", "Draft never submits for you.", "draft is waiting for you on this step.", "Resolver bug.", "2 more ready at acme.test",
      "Needs you — draft holds no answer for this.", "✓ remembered for next time"]) assert.ok(g.text.includes(said), `${name}: "${said}" is gone from the panel's text`);
  }
});

test("T26 ⑥ the Copy sheet — labels and values on screen; the title, the job, sources and the unanswered note are hidden words and tooltips; no rules, no tint, no surface", () => {
  const cs = read("extension/copy-sheet-panel.js");
  assert.match(cs, /background: transparent; height: 100%;/, "the sheet paints no surface of its own");
  assert.doesNotMatch(cs, /border-bottom: 1px solid/, "a rule under the header or between rows");
  assert.doesNotMatch(cs, /WARNING_QUIET/, "a tinted note");
  assert.match(cs, /title\.className = 't sr';/);
  assert.match(cs, /mark\.className = `src sr/);
  assert.match(cs, /const copy = btn\('copy', `Copy \$\{row\.label\}`\);/, "Copy is an icon named for its row");
  assert.match(cs, /note\.innerHTML = `\$\{I\('need', 14\)\}<span aria-hidden="true">\$\{n\}<\/span><span class="sr"><\/span>`;/);
});

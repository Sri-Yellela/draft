// D34 + D35 · THE FULL HOUSE HEADER — header.html is the specification (jd2.html for the type).
//
// The seven behaviours D35 §7 says to pin, each a test that goes RED when the behaviour is removed:
//   1 a word opens its panel; the SAME word closes it      2 opening a second word closes the first
//   3 the open outline and the active fill are separate attributes, and a word can carry both
//   4 prose and token share font-family, font-size and line-height — read from the CODE and the CSS,
//     not a screenshot (the D30 regression)
//   5 the location panel cannot clear the United States floor
//   6 a zero-count option is dimmed and not selectable, never hidden
//   7 every word is reachable by keyboard, and the panel is reachable from the word that opened it
// and what the build around them must hold: the icon and its drawer panel gone, the vertical order,
// the condensed bar, the panel copy from LIVE facets, and the tokens.
//
// The components are RENDERED (esbuild from client/node_modules + react-dom/server) and the pure ones
// are also CALLED, so a press is a real call of the real onClick — no DOM needed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { at } from "../test-support/sourceAnchors.js";

import { SENTENCE_CLAUSES, sentenceText } from "../shared/filterSentence.js";
import { EXPERIENCE_LEVELS, WORK_MODELS, POSTING_AGE } from "../shared/jobFilterOptions.js";
import { JOB_FUNCTIONS, PLACES } from "../shared/jobTagVocabulary.js";
import { FIT_BANDS } from "../shared/filterSentence.js";
import {
  BOARD_PANEL, nextBoardPanel, isWordPanel, panelRows, panelPress, panelNote, addRows, viewCounts,
  clearClause, unscoredText,
} from "../client/src/lib/filterSentenceModel.js";
import { C_LIGHT, C_DARK, CONTRAST_PAIRS, cssVarName } from "../client/src/styles/colorTokens.js";
import { FULL_HOUSE_TYPE, typeVarName } from "../client/src/styles/type.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const strip = (t) => t
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*(?:\/\/|\*).*$/gm, "")
  .replace(/([^:"'`\\])\/\/.*$/gm, "$1");
const CSS_FILE = "client/src/components/FullHouse.css";
const clause = (key) => SENTENCE_CLAUSES.find(c => c.key === key);

// ── A synthetic FacetsResponse. Nobody's data. intern is the designed zero. ──────────────────────
const fo = (value, count, known = count) => ({ value, label: value, count, known });
const FACETS = {
  total: 400, known: 380, unscored: 37,
  coverage: { level: 397, where: 190, employment: 31 },
  views: { all: 400, saved: 14, pending: 9 },
  clauses: {
    level:  EXPERIENCE_LEVELS.options.map(o => fo(o.value, o.value === "intern" ? 0 : 40, o.value === "intern" ? 0 : 38)),
    where:  WORK_MODELS.options.map((o, i) => fo(o.value, 20 + i)),
    posted: POSTING_AGE.options.map((o, i) => fo(o.value, 5 + i)),
    fit:    FIT_BANDS.options.map((o, i) => fo(o.value, 7 + i)),
    domain: JOB_FUNCTIONS.options.map((o, i) => fo(o.value, 30 + i, 28 + i)),
    location: PLACES.options.map((o, i) => fo(o.value, i < 4 ? 40 - i : 0, i < 4 ? 30 : 0)),
  },
};

// ── Render / call the real components ────────────────────────────────────────────────────────────
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
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import { MemoryRouter } from "react-router-dom";
        import BoardHeadline, { SENTENCE_ID, PANEL_ID } from ${abs("components/BoardHeadline.jsx")};
        import WordPanel, { PanelOptions, AddOptions, panelFocusTarget, panelKeyDown, openerSlot } from ${abs("components/WordPanel.jsx")};
        import SortPanel from ${abs("components/SortPanel.jsx")};
        import { ViewSegment, SortIcon } from ${abs("components/BoardBar.jsx")};
        export const html = (C, props) => renderToStaticMarkup(createElement(C, props));
        export const htmlRouted = (C, props) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(C, props)));
        export { BoardHeadline, SENTENCE_ID, PANEL_ID, WordPanel, PanelOptions, AddOptions, panelFocusTarget,
                 panelKeyDown, openerSlot, SortPanel, ViewSegment, SortIcon };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d35-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

/** Every element in a returned tree (pure components only), depth first. */
function elements(node, out = []) {
  if (Array.isArray(node)) { for (const n of node) elements(n, out); return out; }
  if (node && typeof node === "object" && node.props) {
    out.push(node);
    elements(node.props.children, out);
  }
  return out;
}
const buttons = (tree) => elements(tree).filter(e => e.type === "button");
const slot = (tree, key) => buttons(tree).find(b => b.props["data-slot"] === key);

/** The App wiring, exactly: one panel value, every press resolved by nextBoardPanel. */
function board(params = {}) {
  const state = { open: null };
  const press = (key) => { state.open = nextBoardPanel(state.open, key); };
  const render = async () => (await loadUi()).BoardHeadline({ params, open: state.open, onToggle: press });
  return { state, render };
}

// ── CSS, parsed into rules ───────────────────────────────────────────────────────────────────────
function cssRules(src) {
  const body = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(body))) {
    const decls = Object.fromEntries(m[2].split(";").map(d => d.trim()).filter(Boolean).map(d => {
      const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
    }));
    rules.push({ selector: m[1].trim().replace(/\s+/g, " "), decls });
  }
  return rules;
}

// ═══ 1 · a word opens its panel; the SAME word closes it ═══════════════════════════════════════════

test("D35 ① clicking a word OPENS its panel beneath the sentence; clicking the SAME word CLOSES it", async () => {
  const { html, WordPanel } = await loadUi();
  const b = board();
  slot(await b.render(), "level").props.onClick();
  assert.equal(b.state.open, "level", "the level word did not open its panel");
  const opened = await b.render();
  assert.equal(slot(opened, "level").props["aria-expanded"], true);
  const panel = html(WordPanel, { open: b.state.open, params: {}, facets: FACETS, facetsStatus: "ready" });
  assert.match(panel, /id="fh-panel"[^>]*data-panel="level"/, "no level panel rendered for the open word");
  slot(opened, "level").props.onClick();
  assert.equal(b.state.open, null, "pressing the open word again must CLOSE its panel");
  assert.equal(slot(await b.render(), "level").props["aria-expanded"], false);
  assert.equal(html(WordPanel, { open: b.state.open, params: {}, facets: FACETS }), "", "a closed panel still renders");
  // ⛔ D42 (owner, 10-06): "+ add" LEFT THE SENTENCE — it is the open panel's "Add a filter" row.
  assert.equal(slot(await b.render(), BOARD_PANEL.MORE), undefined, "+ add is back in the sentence");
  assert.match(panel, /data-add-section[\s\S]*data-add="posted"[\s\S]*data-add="drawer"/, "the panel does not list what can be added");
  // App.jsx presses through exactly this rule, on the one context value.
  const app = strip(read("client/src/App.jsx"));
  assert.match(app, /onToggle=\{\(key\) => setBoardPanel\(current => nextBoardPanel\(current, key\)\)\}/);
});

// ═══ 2 · opening a second word closes the first ═══════════════════════════════════════════════════

test("D35 ② opening a SECOND word CLOSES the first — one panel, never stacked", async () => {
  const { html, WordPanel } = await loadUi();
  const b = board();
  slot(await b.render(), "level").props.onClick();
  slot(await b.render(), "where").props.onClick();
  assert.equal(b.state.open, "where", "opening workplace must replace level");
  const tree = await b.render();
  const expanded = buttons(tree).filter(x => x.props["aria-expanded"] === true).map(x => x.props["data-slot"]);
  assert.deepEqual(expanded, ["where"], "more than one word reads open");
  const panel = html(WordPanel, { open: b.state.open, params: {}, facets: FACETS, facetsStatus: "ready" });
  assert.equal((panel.match(/id="fh-panel"/g) || []).length, 1);
  assert.match(panel, /data-panel="where"/);
  // The sort square shares the SAME value: opening it closes a word, and the reverse.
  assert.equal(nextBoardPanel("level", BOARD_PANEL.SORT), BOARD_PANEL.SORT);
  assert.equal(nextBoardPanel(BOARD_PANEL.SORT, "level"), "level");
  const app = strip(read("client/src/App.jsx"));
  assert.match(app, /onPress=\{\(\) => setBoardPanel\(current => nextBoardPanel\(current, BOARD_PANEL\.SORT\)\)\}/);
  assert.match(app, /if \(boardPanel !== BOARD_PANEL\.SORT\) return null;/, "the sort panel must render only for the one value");
  // ONE value: the context holds boardPanel, and the only other "open" state is the drawer's.
  const ctx = strip(read("client/src/contexts/JobBoardContext.jsx"));
  assert.match(ctx, /const \[boardPanel, setBoardPanel\] = useState\(null\);/);
  const openFlags = [...ctx.matchAll(/const \[(\w*[Oo]pen\w*), set\w+\]\s*=\s*useState\(/g)].map(m => m[1]);
  assert.deepEqual(openFlags, ["filterPanelOpen"], `a second open flag is back beside boardPanel: ${openFlags}`);
});

// ═══ 3 · open and active are separate signals ═════════════════════════════════════════════════════

test("D35 ③ OPEN (outline) and ACTIVE (fill) are SEPARATE attributes, and a word can carry BOTH", async () => {
  const { BoardHeadline } = await loadUi();
  const lvl = clause("level");
  const params = { [lvl.dim.param]: ["senior"] };
  const both = BoardHeadline({ params, open: "level", onToggle() {} });
  assert.equal(slot(both, "level").props["aria-pressed"], true, "a chosen level must read ACTIVE");
  assert.equal(slot(both, "level").props["aria-expanded"], true, "…and, open, ALSO read OPEN");
  const openOnly = BoardHeadline({ params: {}, open: "where", onToggle() {} });
  assert.equal(slot(openOnly, "where").props["aria-pressed"], false);
  assert.equal(slot(openOnly, "where").props["aria-expanded"], true);
  assert.equal(slot(both, "where").props["aria-expanded"], false);
  // The CSS: the fill is on aria-pressed and never draws an outline; the outline is on aria-expanded
  // and never changes the fill. Two attributes, two looks, and they compose.
  const rules = cssRules(read(CSS_FILE));
  const pressed = rules.filter(r => /\.tok\[aria-pressed="true"\]$/.test(r.selector));
  const expanded = rules.filter(r => /\.tok\[aria-expanded="true"\]/.test(r.selector));
  assert.ok(pressed.length, "no rule draws the ACTIVE fill");
  assert.ok(expanded.length, "no rule draws the OPEN outline");
  for (const r of pressed) {
    assert.ok(r.decls.background, "the active state has no fill");
    assert.ok(!("outline" in r.decls), "the active fill also draws an outline — the two signals merged");
  }
  for (const r of expanded) {
    assert.match(r.decls.outline || "", /^2px solid var\(--c-accent-ink\)$/, "open must be outline: 2px solid --atx");
    assert.equal(r.decls["outline-offset"], "2px");
    assert.ok(!("background" in r.decls) && !("background-color" in r.decls), "the open outline changes the fill");
  }
});

// ═══ 4 · ONE family, ONE size, ONE line-height — in code and CSS ═══════════════════════════════════

test("D34/D35 ④ prose and token SHARE font-family, font-size and line-height — no token rule letters itself", () => {
  // The three values exist once, in the type tokens, and are published as custom properties.
  // ⭐ D47 (owner, 10-07) replaced header.html's Georgia with the LOGO FACE at the MARK'S SIZE; the values
  // still live once, here, and D34's one-family-one-size rule is what the rest of this test holds.
  assert.equal(FULL_HOUSE_TYPE.SENTENCE_FAMILY, FULL_HOUSE_TYPE.LOGO_FAMILY, "the sentence is set in the logo face (D47)");
  assert.match(FULL_HOUSE_TYPE.SENTENCE_SIZE, /^min\(30px, /, "at the app bar mark's size (D47)");
  assert.equal(FULL_HOUSE_TYPE.SENTENCE_LINE, "1.5");
  const rules = cssRules(read(CSS_FILE));
  const bh = rules.find(r => r.selector === ".bh");
  assert.ok(bh, "the sentence rule is gone");
  assert.equal(bh.decls["font-family"], `var(${typeVarName("SENTENCE_FAMILY")})`);
  assert.equal(bh.decls["font-size"], `var(${typeVarName("SENTENCE_SIZE")})`);
  // D93: × --bh-room — 1 for marked words (the default), more for the calm boxes; the tokens inherit either way.
  assert.equal(bh.decls["line-height"], `calc(var(${typeVarName("SENTENCE_LINE")}) * var(--bh-room, 1))`);
  // Every token rule INHERITS. The base rule says so with `font: inherit`; no rule that matches a token
  // names a family, a size or a line-height of its own (the D30 defect: Poppins 800 italic at .78em).
  const tok = rules.filter(r => /\.tok\b/.test(r.selector));
  assert.ok(tok.length >= 5, "the token rules are missing");
  const base = tok.find(r => r.selector === ".bh .tok");
  assert.equal(base?.decls.font, "inherit", "the token must inherit the sentence's font");
  for (const r of tok) {
    for (const prop of ["font-family", "font-size", "line-height", "font-style"]) {
      assert.ok(!(prop in r.decls) || r.decls[prop] === "inherit",
        `${r.selector} sets ${prop}: ${r.decls[prop]} — the token is re-lettered, diverging from the prose`);
    }
    if ("font" in r.decls) assert.equal(r.decls.font, "inherit", `${r.selector} sets font: ${r.decls.font}`);
  }
  // …and nothing ELSE in the client letters the sentence or a token behind this file's back.
  const css = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.css$/.test(e.name) && !p.endsWith(path.normalize(CSS_FILE).split(path.sep).pop())) css.push(p);
  } };
  walk("client/src");
  for (const f of css) {
    for (const r of cssRules(read(f))) {
      assert.ok(!/(^|[\s,])\.(?:bh|tok)\b/.test(r.selector), `${f} styles ${r.selector} — the sentence's type lives in ${CSS_FILE} only`);
    }
  }
  // The JSX gives a token no style and no class that could carry type.
  const jsx = strip(read("client/src/components/BoardHeadline.jsx"));
  assert.doesNotMatch(jsx, /style=\{/, "an inline style on the sentence can re-letter a token");
  for (const m of jsx.matchAll(/className="([^"]+)"/g)) {
    assert.ok(/^(?:bh|bh__verb|tok|tok tok--add)$/.test(m[1]), `unexpected class "${m[1]}" in the sentence`);
  }
});

// ═══ 5 · the United States floor ══════════════════════════════════════════════════════════════════

test("D35 ⑤ the LOCATION panel cannot clear the United States floor — it narrows, never clears", async () => {
  const loc = clause("location");
  const rows = panelRows(loc, {}, FACETS);
  assert.equal(rows[0].kind, "any");
  assert.equal(rows[0].label, "the United States", "the panel's first pill must BE the floor");
  assert.equal(rows[0].selected, true);
  for (const r of rows) assert.doesNotMatch(r.label, /anywhere|everywhere|any location|worldwide|global/i, `"${r.label}" offers to clear the floor`);
  // Every press of every pill, from any state, leaves a sentence that is still in the United States.
  const narrowed = { [loc.dim.param]: [PLACES.options[0].value] };
  for (const params of [{}, narrowed]) {
    for (const r of panelRows(loc, params, FACETS)) {
      const patch = panelPress(loc, params, r);
      if (!patch) continue;
      const next = { ...params, ...patch };
      assert.ok(Array.isArray(next[loc.dim.param]), "a location press must leave a place SET (empty = the floor)");
      assert.match(sentenceText(next), / in (the United States|the |[A-Z])/, `pressing "${r.label}" took the sentence out of the United States`);
    }
  }
  assert.deepEqual(clearClause(loc), { [loc.dim.param]: [] }, "clearing location is the floor, nothing else");
  assert.match(sentenceText({ [loc.dim.param]: [] }), /in the United States/);
  // The token reads the floor as a filter that is always on, and the panel says it.
  const { BoardHeadline, html, WordPanel } = await loadUi();
  assert.equal(slot(BoardHeadline({ params: {}, onToggle() {} }), "location").props["aria-pressed"], true);
  const out = html(WordPanel, { open: "location", params: {}, facets: FACETS, facetsStatus: "ready" });
  assert.match(out, /The United States is the floor — it can be narrowed, never cleared\./);
});

// ═══ 6 · zero is dimmed, not selectable, never hidden ═════════════════════════════════════════════

test("D35 ⑥ a ZERO-COUNT option is DIMMED and NOT SELECTABLE — and never hidden", async () => {
  const lvl = clause("level");
  const rows = panelRows(lvl, {}, FACETS);
  const intern = rows.find(r => r.value === "intern");
  assert.ok(intern, "the zero-count intern option was HIDDEN");
  assert.equal(intern.count, 0, "its 0 is information — keep it");
  assert.equal(intern.dimmed, true);
  assert.equal(intern.disabled, true);
  assert.equal(panelPress(lvl, {}, intern), null, "a zero-count option can still be selected");
  for (const o of lvl.dim.options.filter(o => o.value)) assert.ok(rows.some(r => r.value === o.value), `${o.value} is missing`);
  // Rendered and PRESSED: aria-disabled (so the keyboard still reaches it), its 0 shown, and the press
  // changes nothing.
  const { PanelOptions, html } = await loadUi();
  const calls = [];
  const tree = PanelOptions({ clause: lvl, rows, params: {}, onPatch: (p) => calls.push(p) });
  const btn = buttons(tree).find(b => b.props["data-value"] === "intern");
  assert.equal(btn.props["aria-disabled"], "true");
  assert.equal(btn.props.disabled, undefined, "dimmed must not be `disabled` — that drops it from the tab order");
  btn.props.onClick();
  assert.deepEqual(calls, [], "pressing the dimmed option changed the board");
  buttons(tree).find(b => b.props["data-value"] === "senior").props.onClick();
  assert.equal(calls.length, 1, "a counted option must still press");
  const out = html(PanelOptions, { clause: lvl, rows, params: {}, onPatch() {} });
  assert.match(out, /aria-disabled="true"[^>]*>intern<span class="n">0<\/span>/);
  // Already chosen, a zero stays pressable — pressing it is how it is removed.
  const chosen = panelRows(lvl, { [lvl.dim.param]: ["intern"] }, FACETS).find(r => r.value === "intern");
  assert.equal(chosen.disabled, false);
  assert.deepEqual(panelPress(lvl, { [lvl.dim.param]: ["intern"] }, chosen), { [lvl.dim.param]: [] });
  // The CSS dims it in place; nothing hides it.
  const dim = cssRules(read(CSS_FILE)).filter(r => /\.fh-op\[aria-disabled="true"\]$/.test(r.selector));
  assert.ok(dim.some(r => r.decls.opacity), "the dimmed option is not dimmed");
  for (const r of cssRules(read(CSS_FILE)).filter(r => /aria-disabled/.test(r.selector))) {
    assert.ok(r.decls.display !== "none" && r.decls.visibility !== "hidden", `${r.selector} hides the zero`);
  }
});

// ═══ 7 · keyboard ═════════════════════════════════════════════════════════════════════════════════

test("D35 ⑦ every word is reachable by KEYBOARD, and the panel is reachable from the word that opened it", async () => {
  const { html, BoardHeadline, WordPanel, panelFocusTarget, panelKeyDown, openerSlot, PANEL_ID, SENTENCE_ID } = await loadUi();
  const lvl = clause("level");
  const out = html(BoardHeadline, { params: {}, open: "level" });
  const words = out.match(/<button[^>]*>/g) || [];
  assert.equal(words.length, 4, "four permanent words, each a button (D42: + add left the sentence)");
  for (const w of words) {
    assert.match(w, /type="button"/);
    assert.doesNotMatch(w, /tabindex="-1"|disabled/, `a word is out of the tab order: ${w}`);
  }
  // The open word names the panel it controls; the panel is that id.
  assert.match(out, new RegExp(`data-slot="level"[^>]*aria-expanded="true" aria-controls="${PANEL_ID}"`));
  const panel = html(WordPanel, { open: "level", params: {}, facets: FACETS, facetsStatus: "ready" });
  assert.match(panel, new RegExp(`^<section id="${PANEL_ID}"`));
  assert.doesNotMatch(panel, / disabled=""/, "an option is disabled out of the tab order");
  // Reading order = DOM order: App renders the panel DIRECTLY after the sentence, then the bar.
  const app = strip(read("client/src/App.jsx"));
  const slotFn = app.slice(at(app, "function BoardHeadlineSlot()"), at(app, "function RouteCommitSignal"));
  assert.ok(at(slotFn, "<BoardHeadline ") < at(slotFn, "<WordPanel "), "the panel must follow the sentence");
  // D49: the bar moved to the top of <main> (inside StickyBar) so it can stick; reading order holds.
  const chrome = app.slice(at(app, '<header className="fh"'), at(app, "</main>"));
  assert.ok(at(chrome, "<BoardHeadlineSlot />") < at(chrome, "<BoardBar />"));
  // On opening, focus moves INTO the panel: the find box, else the chosen option, else the first one a
  // press can change — never a dimmed one.
  const q = (map) => ({ querySelector: (sel) => map[sel] ?? null });
  assert.equal(panelFocusTarget(q({ input: "FIND" })), "FIND");
  assert.equal(panelFocusTarget(q({ '.fh-op[aria-checked="true"]:not([aria-disabled="true"])': "CHOSEN", '.fh-op:not([aria-disabled="true"])': "FIRST" })), "CHOSEN");
  assert.equal(panelFocusTarget(q({ '.fh-op:not([aria-disabled="true"])': "FIRST", button: "CLOSE" })), "FIRST");
  const wp = strip(read("client/src/components/WordPanel.jsx"));
  assert.match(wp, /useEffect\(\(\) => \{ panelFocusTarget\(ref\.current\)\?\.focus\?\.\(\); \}, \[\]\);/, "opening no longer moves focus into the panel");
  // Escape closes it, and focus goes back to the word that opened it (or + add for an optional clause).
  let closed = 0;
  panelKeyDown({ key: "Escape" }, () => { closed++; });
  panelKeyDown({ key: "Tab" }, () => { closed++; });
  assert.equal(closed, 1, "Escape must close the panel, and only Escape");
  assert.match(wp, /const close = \(\) => \{ onClose\?\.\(\); openerSlot\(open\)\?\.focus\?\.\(\); \};/);
  const fakeDoc = { getElementById: (id) => id === SENTENCE_ID
    ? { querySelector: (sel) => ({ '[data-slot="level"]': "LEVEL", '[data-slot="more"]': "ADD" }[sel] ?? null) } : null };
  assert.equal(openerSlot("level", fakeDoc), "LEVEL");
  assert.equal(openerSlot("posted", fakeDoc), "ADD", "an optional clause's panel returns focus to + add");
  // Hover-only is not enough: every hover affordance also answers :focus-visible (D1's rule).
  const rules = cssRules(read(CSS_FILE));
  for (const sel of [".bh .tok", ".fh-op", ".fh-ico"]) {   // D40: the + square is gone
    assert.ok(rules.some(r => r.selector.includes(`${sel}:hover`) && r.selector.includes(`${sel}:focus-visible`)),
      `${sel} lifts on hover but not on keyboard focus`);
  }
  void lvl;
});

// ═══ The build around the seven ═══════════════════════════════════════════════════════════════════

test("D35 §1: the filter ICON and its panel are DELETED — no file, no handler, no badge left dangling", () => {
  for (const f of ["client/src/components/BoardPanelIcons.jsx", "client/src/components/FilterDials.jsx", "client/src/components/BoardPanels.css"]) {
    assert.ok(!fs.existsSync(f), `${f} is back`);
  }
  const src = ["client/src/App.jsx", "client/src/panels/JobsPanel.jsx", "client/src/contexts/JobBoardContext.jsx",
               "client/src/lib/filterSentenceModel.js"].map(f => strip(read(f))).join("\n");
  for (const gone of [/data-board-icon="filter"/, /BOARD_PANEL\.FILTER/, /BoardPanelIcons/, /FilterDials/,
                      /setActiveClauseCount|activeClauseCount,\s*setActiveClauseCount/, /focusDial|setFocusDial/, /SlidersHorizontal/]) {
    assert.doesNotMatch(src, gone, `${gone} survives the icon's removal`);
  }
  assert.equal(BOARD_PANEL.FILTER, undefined);
  // The drawer of the filters that are NOT words stays reachable — from "+ add".
  const rows = addRows({});
  assert.ok(rows.some(r => r.kind === "drawer"), "+ add lost its way to salary and the other filters");
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  assert.match(panel, /const onMoreFilters = useCallback\(\(\) => \{ setBoardPanel\(null\); setFilterPanelOpen\(true\); \}/);
  assert.match(panel, /onPatch: onClausePatch, onMoreFilters/);
});

test("D35 §4: the VERTICAL ORDER is the sentence, the open panel, the bar, the jobs", () => {
  const app = strip(read("client/src/App.jsx"));
  // D49: the sentence in the header; the bar and the sort panel at the top of <main>, in StickyBar,
  // BEFORE the board — the same reading order, now able to stick.
  // ⭐ D147 (owner 11-03): the title row (Full House + the Sort / view word, its panel beneath it) leads; then the
  // sentence and its panel, the search bar, the counts, the jobs.
  const chrome = app.slice(at(app, '<header className="fh"'), at(app, "</main>"));
  const pos = (q) => at(chrome, q);
  // ⭐ D156 (5) / (4), changed on purpose: no title row; the sentence, the bar (the search with the sort icon, its menu
  // under it), the views row with Import a job, the counts, the jobs.
  assert.ok(pos("<BoardHeadlineSlot />") < pos("<BoardBar />"));
  assert.ok(pos("<BoardBar />") < pos("<BoardViews ") && pos("<BoardViews ") < pos("<BoardCounts />") && pos("<BoardCounts />") < pos("<JobsConsole "), "the jobs come after the bar");
  assert.match(app.slice(at(app, "function BoardBar()"), at(app, "function BoardViews(")), /<BoardControlIcons \/>[\s\S]*<BoardSortSlot \/>/);
  // ⭐ A125: the full-width header wrapper above <main> is gone — Home draws its header inside <main>, before the jobs.
  assert.ok(at(app, "</header>") < at(app, "<JobsConsole "), "the jobs come after the header");
  const panel = strip(read("client/src/panels/JobsPanel.jsx"));
  assert.doesNotMatch(panel, /<SortPanel\b|<WordPanel\b|<FilterDials\b/, "a panel renders between the bar and the board");
});

test("D35 §3 → D40: the CONDENSED BAR — FOUR views with counts, the search, ⇅ in a 40px square", async () => {
  const { html, ViewSegment, SortIcon } = await loadUi();
  const views = [["all", "ALL", "All jobs"], ["saved", "★", "Saved jobs"], ["pending", "/d", "Pending apply"], ["imported", "+", "Imported jobs"]];
  const counted = html(ViewSegment, { views, value: "all", counts: viewCounts(FACETS) });
  assert.match(counted, /data-view="all" aria-pressed="true"[^>]*><span aria-hidden="true">ALL<\/span><span class="fh-ct" aria-hidden="true">400</);
  assert.match(counted, /data-view="saved"[^>]*>.*?<span class="fh-ct" aria-hidden="true">14</);
  assert.match(counted, /data-view="pending"[^>]*>.*?<span class="fh-ct" aria-hidden="true">9</);
  // No answer, no number — never a 0 in its place.
  const blank = html(ViewSegment, { views, value: "all", counts: viewCounts(null) });
  assert.doesNotMatch(blank, /fh-ct/);
  // The sketch's glyph, exactly; open = filled (aria-expanded), a chosen order holds its edge.
  // ⭐ D147 (owner 11-03): the ⇅ square became the Sort / view WORD in the title row — the same glyph beside the words.
  // D149 (11-03) changed this on purpose: fullhouse-declutter.html draws the control as the words "Sort: for you" alone,
  // so the ⇅ glyph (and its SORT_GLYPH_PATH) left the control.
  // ⭐ D156 (5) changed it again on purpose (owner 11-05: "bring back the sort as an icon in the search bar"): the ⇅ glyph
  // is back, as an icon inside the search field, its words in its label.
  assert.match(html(SortIcon, {}), /<svg/);
  assert.match(html(SortIcon, { open: true }), /data-board-icon="sort" data-active="false" aria-haspopup="true" aria-expanded="true"/);
  assert.match(html(SortIcon, { chosen: true }), /data-active="true"/);
  // ⛔ D40 (owner, 10-06): + is the FOURTH VIEW; the standalone + square is gone, everywhere.
  assert.match(counted, /data-view="imported"[^>]*><span aria-hidden="true">\+<\/span>/);
  assert.doesNotMatch(read("client/src/components/BoardBar.jsx"), /export function AddSquare/);
  assert.doesNotMatch(strip(read("client/src/App.jsx")), /<AddSquare\b/);
  const rules = cssRules(read(CSS_FILE));
  assert.ok(!rules.some(r => r.selector === ".fh-add"), "the + square's rule is back");
  void typeVarName;
  assert.ok(rules.some(r => r.selector === '.fh-sorti[data-active="true"], .fh-sorti[aria-expanded="true"]' && r.decls.color === "var(--c-accent-ink)"), "sort open / chosen is not the accent");
  // D147: the bar is the search alone (the views and the sort word moved), and the search has no separate button.
  const app = strip(read("client/src/App.jsx"));
  const bar = app.slice(at(app, "function BoardBar()"), at(app, "function BoardViews("));
  assert.match(bar, /<div className="fh-bar" data-board-bar="">\s*<BoardSearchBar><BoardControlIcons \/><\/BoardSearchBar>\s*<BoardSortSlot \/>\s*<\/div>/);
  assert.doesNotMatch(read("client/src/components/BoardBar.jsx"), /aria-label="Search"/, "a separate Search button is back");
  // ⚠ Phone: the bar becomes two rows, by decision — the search on its own line.
  const phone = read(CSS_FILE).slice(at(read(CSS_FILE), "@media (max-width: 600px)"));
  assert.match(phone, /\.fh-bar \{ flex-wrap: wrap;/);
  assert.match(phone, /\.fh-srch \{ order: 4; flex: 1 1 100%; \}/);
});

test("D35 §5: the PANEL COPY — its figures LIVE from facets, never the row's literal numbers", async () => {
  assert.equal(panelNote("where", {}, FACETS), "47.5% coverage — postings with no workplace on file are kept, not hidden.");
  assert.equal(panelNote("level", {}, FACETS), "3 postings have no level on file — kept, not hidden.");
  assert.equal(panelNote(BOARD_PANEL.MORE, {}, FACETS), "Employment type is at 7.8% coverage and cannot carry a filter yet.");
  assert.equal(unscoredText(FACETS), "37 jobs have no ATS score yet, so they sort last whatever you pick. Newest shows everything.");
  // A different board says different numbers: the copy is measured, not written down.
  const other = { ...FACETS, total: 200, unscored: 1, coverage: { level: 199, where: 50, employment: 2 } };
  assert.equal(panelNote("where", {}, other), "25% coverage — postings with no workplace on file are kept, not hidden.");
  assert.equal(panelNote("level", {}, other), "1 posting has no level on file — kept, not hidden.");
  assert.equal(panelNote(BOARD_PANEL.MORE, {}, other), "Employment type is at 1% coverage and cannot carry a filter yet.");
  assert.equal(unscoredText(other), "1 job has no ATS score yet, so it sorts last whatever you pick. Newest shows everything.");
  // No answer: the coverage lines say nothing rather than a guessed number.
  assert.equal(panelNote("where", {}, null), null);
  assert.equal(panelNote("level", {}, null), null);
  assert.doesNotMatch(panelNote(BOARD_PANEL.MORE, {}, null), /\d/);
  // No literal figure from the row anywhere in the code that draws the header.
  for (const f of ["client/src/lib/filterSentenceModel.js", "client/src/components/WordPanel.jsx", "client/src/components/SortPanel.jsx",
                   "client/src/components/BoardHeadline.jsx", "client/src/components/BoardBar.jsx", "client/src/App.jsx"]) {
    const src = strip(read(f));
    for (const lit of ["47.5", "7.7%", "537", "2626", "674"]) assert.ok(!src.includes(lit), `${f} writes the row's literal ${lit}`);
  }
  // + add lists what can be added, and employment type is listed, dimmed, unselectable.
  const rows = addRows({});
  assert.deepEqual(rows.filter(r => r.kind === "clause").map(r => r.key), SENTENCE_CLAUSES.filter(c => !c.permanent).map(c => c.key));
  const emp = rows.find(r => r.kind === "employment");
  assert.equal(emp.disabled, true);
  const { html, AddOptions, SortPanel } = await loadUi();
  assert.match(html(AddOptions, { params: {} }), /data-add="employment" aria-disabled="true"/);
  // The sort panel keeps its line, with Newest in bold, and only when Best fit is offered.
  const sp = html(SortPanel, { value: "", atsAvailable: true, facets: FACETS, facetsStatus: "ready" });
  assert.match(sp, /37 jobs have no ATS score yet, so they sort last whatever you pick\. <b>Newest<\/b> shows everything\./);
  assert.doesNotMatch(html(SortPanel, { value: "", atsAvailable: false, facets: FACETS, facetsStatus: "ready" }), /no ATS score/);
  assert.equal(isWordPanel("sort"), false, "the sort panel is the bar's, not the sentence's");
});

test("D35: every colour in the header is a TOKEN, both themes, the dark values re-derived and proved", () => {
  const css = read(CSS_FILE).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, "a colour literal in FullHouse.css");
  const names = new Set(Object.keys(C_LIGHT).map(cssVarName));
  for (const m of css.matchAll(/var\((--c-[a-z0-9-]+)\)/g)) assert.ok(names.has(m[1]), `${m[1]} is not a token`);
  for (const m of css.matchAll(/var\((--fh-[a-z0-9-]+)\)/g)) {
    assert.ok(Object.keys(FULL_HOUSE_TYPE).map(typeVarName).includes(m[1]) || ["--fh-t", "--fh-e"].includes(m[1]), `${m[1]} is not a type token`);
  }
  // header.html's own values, where no token held them.
  assert.equal(C_LIGHT.FH_SURFACE, "#FBF7F0");
  assert.equal(C_LIGHT.FH_WELL, "#F2ECE1");
  assert.equal(C_LIGHT.FH_LINE, "#DED5C4");
  assert.equal(C_LIGHT.FH_ACCENT_EDGE, "#E03D00");
  assert.equal(C_LIGHT.FH_ON_ACCENT, "#2A0D00");
  // Dark is re-derived: the surfaces are NOT the light ones, and sit ABOVE the charcoal canvas.
  const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  for (const k of ["FH_SURFACE", "FH_WELL", "FH_LINE"]) {
    assert.notEqual(C_DARK[k], C_LIGHT[k], `${k} was copied into dark, not re-derived`);
    assert.ok(lum(C_DARK[k]) > lum(C_DARK.CANVAS), `${k} sits below the dark canvas — it would read as a hole`);
  }
  // Every text pair the header draws is declared, so test/colorTokens proves it in BOTH themes.
  const declared = new Set(CONTRAST_PAIRS.map(([a, b, s]) => `${a}/${b}/${s}`));
  for (const p of ["INK/FH_SURFACE/normal", "INK/FH_WELL/normal", "INK_FAINT/FH_SURFACE/normal", "INK_FAINT/FH_WELL/normal",
                   "ACCENT_INK/FH_SURFACE/normal", "ACCENT_INK/CANVAS_SHADE/ui", "FH_ON_ACCENT/ACCENT/normal", "INK_MUTED/CANVAS_SHADE/normal"]) {
    assert.ok(declared.has(p), `${p} is drawn by the header but not proved`);
  }
  // The extension draws no board header, so its generated tokens carry none of the header's.
  for (const f of ["extension/tokens.css", "extension/tokens.js"]) assert.doesNotMatch(read(f), /FH_|--c-fh-/, `${f} carries the header's tokens`);
});

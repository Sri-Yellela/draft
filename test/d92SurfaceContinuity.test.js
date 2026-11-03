// D92 · SURFACE CONTINUITY — the deck cutout, the stacked boxes, the two-part background (owner, 10-10).
//
// THE FIVE RULES (a house rule from now on): (1) at most TWO visible surface levels per component · (2) never
// clip a shadow · (3) full-bleed decoration lives at PAGE level · (4) sticky chrome blends in — column width,
// feathered · (5) wells are for INPUTS only — navigation is ghost until active.
//
// Part 1 reads the source for what P0 measured on the running app (scripts/d92SurfaceProbe.mjs). Part 2 is THE
// SEAM TEST: the real stylesheets (TopBar.css, FullHouse.css, StickyBar.css) rendered in headless Chrome over
// each theme's tokens, at desktop and phone, every layout variant, at rest and stuck — the page's luminance is
// sampled down and across every region boundary, and a step larger than the threshold where no boundary is
// intended fails. It SKIPS, saying why, on a machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

// ═══ Part 1 · the findings, fixed at their cause ════════════════════════════════════════════════════════════

test("D92 ① the deck: the column never clips; the full-width wrapper still stops a sideways page scroll", () => {
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /position: "relative", isolation: "isolate", overflowX: "visible",/);
  assert.doesNotMatch(deck, /overflowX: vertical \? "clip"/, "the vertical fan is sliced by its 560px column again");
  assert.match(deck, /<div data-deck-clip style=\{\{ overflowX: "clip" \}\}>/);
});

test("D92 ② the top bar: nothing clips a shadow — the group clips its sides only; the row scrolls only when it overflows", () => {
  const top = read("client/src/components/TopBar.jsx"), css = read("client/src/components/TopBar.css");
  assert.match(top, /<div className="tbar-group">/);
  assert.match(css, /\.tbar-group \{[^}]*clip-path: inset\(-18px 0\);/);
  assert.doesNotMatch(css.slice(at(css, ".tbar-group {"), at(css, "}", at(css, ".tbar-group {"))), /overflow/);
  assert.doesNotMatch(top, /overflowX: "auto"|overflow: "hidden" \}\}>\s*\{\/\* Logo/);
  // ⭐ D145 (changed on purpose): the tab row is gone; the Dock replaced it. The dock DOES scroll along itself (390 px),
  // so nothing inside it carries a shadow to clip — the current button is raised by its fill.
  const dock = read("client/src/components/AppNav.css");
  const item = dock.slice(at(dock, ".appnav-item {"), at(dock, "}", at(dock, ".appnav-item {")));
  const cur = dock.slice(at(dock, '.appnav-item[aria-current="page"] {'), at(dock, "}", at(dock, '.appnav-item[aria-current="page"] {')));
  assert.doesNotMatch(item + cur, /box-shadow/, "a dock button carries a shadow its scrolling dock would clip");
});

test("D92 ③ the bar is ONE surface with hairline dividers — no well inside it; ⑤ no navigation control is a well", () => {
  const css = read("client/src/components/FullHouse.css");
  const rule = (sel) => { const i = at(css, `\n${sel} {`); return css.slice(i, at(css, "}", i)); };
  assert.match(rule(".fh-bar"), /background: var\(--c-fh-surface\)/);
  for (const sel of [".fh-views", ".fh-srch", ".fh-ico"]) {
    assert.doesNotMatch(rule(sel), /background: var\(--c-fh-(well|surface)\)|box-shadow: var\(--c-(fh-inset|depth-rest)\)|border: 1px solid/,
      `${sel} is a surface inside the bar again — a box in a box (rule 1)`);
  }
  assert.match(rule(".fh-views"), /border-right: 1px solid var\(--c-fh-line\)/);
  assert.match(rule(".fh-ico"), /border-left: 1px solid var\(--c-fh-line\)/);
  // Rule 5: the tab and the view buttons never wear the well.
  const tab = read("client/src/components/AppNav.css");   // ⭐ D145: the Dock's buttons are the navigation controls now
  assert.doesNotMatch(tab.slice(at(tab, ".appnav-item {")), /--c-fh-well/);
  assert.doesNotMatch(rule(".fh-views button"), /--c-fh-well/);
});

test("D92 ④ the seam: nothing paints behind the jobs or The Table; no full-width rule across the window", () => {
  for (const f of ["client/src/panels/JobsPanel.jsx", "client/src/panels/DatabasePanel.jsx"]) {
    assert.doesNotMatch(read(f), /linear-gradient\(160deg/, `${f} paints a tint behind the page's content again (the two-part background)`);
  }
  const jp = read("client/src/panels/JobsPanel.jsx");
  const notice = jp.slice(at(jp, "function FitRankingNotice"), at(jp, "</div>", at(jp, "function FitRankingNotice")));
  assert.doesNotMatch(notice, /borderBottom/, "the fit notice rules a hairline across the whole window again");
});

test("D92 ⑤ stuck, the board's bar is its own column, frosted and FEATHERED — not a band with a hairline and a shadow", () => {
  const css = read("client/src/components/FullHouse.css");
  const i0 = at(css, '.fh.fh--bar-row[data-stuck="true"] {');
  const stuck = css.slice(i0, at(css, "}", i0));
  assert.match(stuck, /background: transparent;/); assert.match(stuck, /box-shadow: none;/); assert.match(stuck, /border-bottom: 0;/);
  const before = css.slice(at(css, '.fh.fh--bar-row[data-stuck="true"]::before {'));
  assert.match(before, /backdrop-filter: blur\(10px\)/);
  assert.match(before, /mask-image: linear-gradient\(to right, transparent, var\(--c-ink\) 6%, var\(--c-ink\) 94%, transparent\), linear-gradient\(to bottom, var\(--c-ink\) 72%, transparent\)/);
  // The posting panel's action bar (the other StickyBar) keeps the module's own stuck surface.
  assert.match(read("client/src/components/StickyBar.css"), /\.sticky-bar\[data-stuck="true"\] \{[^}]*backdrop-filter: blur\(10px\);/);
});

// ═══ Part 2 · THE SEAM TEST — the real stylesheets in a real browser ════════════════════════════════════════

const { resolveBrowserExecutable } = await import("../services/browserLauncher.js");
let browserPath = null;
try { browserPath = (await resolveBrowserExecutable())?.path || null; } catch { browserPath = null; }
const NO_CHROME = browserPath && fs.existsSync(browserPath) ? false : "no Chrome on this machine (services/browserLauncher.js found none)";

test("D92 · THE SEAM TEST — no hard step where no boundary is intended: 4 themes × desktop / phone × every variant × rest / stuck", { skip: NO_CHROME, timeout: 180000 }, async () => {
  const { default: puppeteer } = await import("puppeteer-core");
  const { THEME_LIST, cssVarName } = await import("../client/src/themes/index.js");
  const { FULL_HOUSE_TYPE, typeVarName } = await import("../client/src/styles/type.js");
  const { LAYOUT_OPTION_IDS } = await import("../shared/appearance.js");
  const css = ["client/src/components/TopBar.css", "client/src/components/AppNav.css", "client/src/components/StickyBar.css", "client/src/components/FullHouse.css"].map(read).join("\n");
  const typeVars = Object.entries(FULL_HOUSE_TYPE).map(([k, v]) => `${typeVarName(k)}:${v}`).join(";");
  const page0 = (t, nav, sentence, stuck) => `<!doctype html><html data-theme="${t.id}" data-navigation="${nav}" data-sentence="${sentence}"
    style="${Object.entries(t.tokens).map(([k, v]) => `${cssVarName(k)}:${v}`).join(";")};${typeVars};--z-sticky:5;--font-body:sans-serif;--app-chrome-height:74px">
    <head><style>${css}
      body{margin:0;background:var(--c-canvas);font-family:sans-serif} *{transition:none!important;animation:none!important}
      .chrome{position:relative;z-index:10;height:74px;display:flex;align-items:center;padding:0 20px;background:var(--c-surface-2);border-bottom:1px solid var(--c-glass-edge)}
      .list{max-width:1100px;margin:16px auto 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;padding:0 22px}
      .card{height:84px;border-radius:14px;background:var(--c-surface);border:1px solid var(--c-fh-line);box-shadow:var(--c-depth-rest)}
    </style></head><body>
    <div class="chrome"><div class="tbar-group"><b>draft</b></div><span class="appnav-menu-btn">Menu</span></div>
    <!-- ⭐ D145: the Dock (risen), in place of the retired tab row -->
    <nav class="appnav-dock" data-up="true"><a class="appnav-item" aria-current="page"><span class="appnav-name">Full House</span><small class="appnav-plain">every job</small></a><a class="appnav-item"><span class="appnav-name">Draft House</span><small class="appnav-plain">in progress</small></a></nav>
    ${stuck === "true" ? "" : `<header class="fh" id="hd"><h1 class="bh"><span class="bh__verb">discovering</span> <button class="tok">all</button> roles at <button class="tok">all</button> career levels and <button class="tok">all</button> workstyles in <button class="tok" aria-pressed="true">the United States</button>.</h1></header>`}
    <!-- stuck: the bar's box at the chrome's edge, as top: var(--app-chrome-height) puts it (the bar's 16px margin collapses outside the box) -->
    <main style="${stuck === "true" ? "margin-top:-16px" : "padding-top:24px"}"><div class="sticky-bar fh fh--bar-row" id="bar" data-stuck="${stuck}"><div class="fh-bar">
      <div class="fh-views"><button aria-pressed="true">ALL <em class="fh-ct">454</em></button><button>★ <em class="fh-ct">3</em></button></div>
      <div class="fh-srch"><input placeholder="Job title, company, or anything in the posting…"></div><button class="fh-ico">⇅</button></div></div>
      <div class="list" id="list">${"<div class=card></div>".repeat(6)}</div></main></body></html>`;
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", pipe: true, args: ["--no-first-run"] });
  const failures = [];
  try {
    const page = await browser.newPage();
    // Luminance down (or across) a 4px-wide strip, one value per pixel, from a screenshot decoded in the page.
    const profile = async (clip, vertical) => {
      const b64 = await page.screenshot({ clip, encoding: "base64" });
      return page.evaluate(async (src, vertical) => {
        const i = new Image(); await new Promise((ok) => { i.onload = ok; i.src = "data:image/png;base64," + src; });
        const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0);
        const d = g.getImageData(0, 0, i.width, i.height).data, n = vertical ? i.height : i.width, m = vertical ? i.width : i.height, out = [];
        for (let a = 0; a < n; a++) { let s = 0; for (let b = 0; b < m; b++) { const o = ((vertical ? a * i.width + b : b * i.width + a)) * 4; s += 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2]; } out.push(s / m); }
        return out;
      }, b64, vertical);
    };
    const worstAt = (vals) => { let w = 0, at = 0; for (let k = 4; k < vals.length; k++) { const d = Math.abs(vals[k] - vals[k - 4]); if (d > w) { w = d; at = k; } } return [w, at]; };
    const worst = (vals) => worstAt(vals)[0];
    const THRESHOLD = 3;   // in 0–255 luminance, per 4px — a hairline or a hard band edge is 10–40
    for (const t of THEME_LIST) for (const [vp, size] of [["desktop", { width: 1440, height: 760 }], ["phone", { width: 390, height: 760 }]])
      for (const nav of LAYOUT_OPTION_IDS.navigation.values) for (const sentence of LAYOUT_OPTION_IDS.sentence.values) for (const stuck of ["false", "true"]) {
        await page.setViewport(size);
        await page.setContent(page0(t, nav, sentence, stuck), { waitUntil: "load" });
        const g = await page.evaluate(() => {
          const r = (id) => document.getElementById(id).getBoundingClientRect();
          // Stuck: the header has scrolled away and the bar sits under the chrome, as it does in the app.
          const bar = r("bar"), list = r("list"), col = bar, fhBar = document.querySelector(".fh-bar").getBoundingClientRect();
          // Every shadowed box in the chrome: no ancestor that clips it (overflow ≠ visible, or a clip-path with no room).
          const clipped = [...document.querySelectorAll(".chrome *")].filter((e) => getComputedStyle(e).boxShadow !== "none").filter((e) => {
            for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a);
              if (s.overflowX !== "visible" || s.overflowY !== "visible") return true; } return false; }).length;
          // Nested painted surfaces (own border AND a fill or a shadow) in the bar.
          const surf = (e) => { const s = getComputedStyle(e); return parseFloat(s.borderTopWidth) > 0 && s.borderTopColor !== "rgba(0, 0, 0, 0)" && (s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.boxShadow !== "none"); };
          const depth = (e) => Math.max(0, ...[...e.children].map(depth)) + (surf(e) ? 1 : 0);
          return { fhBarLeft: fhBar.left, barTop: bar.top, barBottom: bar.bottom, listTop: list.top, colLeft: col.left, barMid: (bar.top + bar.bottom) / 2,
            clipped, nesting: depth(document.querySelector(".fh-bar")), pageWidth: document.documentElement.scrollWidth, win: innerWidth };
        });
        const tag = `${t.id} ${vp} nav=${nav} sentence=${sentence} stuck=${stuck}`;
        if (g.clipped) failures.push(`${tag}: ${g.clipped} shadow(s) in the top bar clipped by an overflow container`);
        if (g.nesting > 2) failures.push(`${tag}: ${g.nesting} nested surfaces in the bar (rule 1: at most two)`);
        if (g.pageWidth > g.win) failures.push(`${tag}: the page scrolls sideways (${g.pageWidth}px in a ${g.win}px window)`);
        // Down the page, beside the content: from below the chrome to below the list's top. Desktop: outside the
        // column, where only the page paints. Phone: the 6px margin left of the bar.
        const x = vp === "desktop" ? 6 : 4;
        const down = await profile({ x, y: 80, width: 4, height: Math.min(size.height - 80, Math.ceil(g.listTop + 30) - 80) }, true);
        const [w, wy] = worstAt(down);
        if (w > THRESHOLD) failures.push(`${tag}: a hard step of ${w.toFixed(1)} down the page at x=${x}, y≈${80 + wy} (bar ${Math.round(g.barTop)}–${Math.round(g.barBottom)}, list ${Math.round(g.listTop)})`);
        if (stuck === "true") {
          // Across the stuck bar's left edge, at its middle: the frost must feather in, not start at a line.
          const from = Math.max(0, Math.floor(g.colLeft) - 60);
          const across = await profile({ x: from, y: Math.floor(g.barMid), width: Math.min(110, size.width - from), height: 4 }, false);
          // …up to the bar's own edge, short of its shadow (12px): the bar itself is intended.
          const wa = worst(across.slice(0, Math.max(5, Math.floor(g.fhBarLeft) - 12 - from)));
          if (wa > THRESHOLD) failures.push(`${tag}: the stuck frost starts at a hard edge (${wa.toFixed(1)}) — rule 4`);
        }
      }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
});

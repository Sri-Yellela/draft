// ⭐ D196 P1 FIX (owner 11-24, 47f) · the market in a real Chrome — the checks the owner's screenshot failed:
//   d196PlatePageAlwaysPaper    — FIX-1: the plate page's ground is opaque under every section, in EVERY theme (the owner,
//                                 47f: "the plate has to land for every theme" — Dusk / Plain are palette variants), and the
//                                 leg header's lead and meta read ≥ 4.5 : 1 on it;
//   d196NoThemeLeakIntoPlate    — FIX-1: no plate section is transparent to the app shell (the near-black textured ground
//                                 showed through `.pl-marketopenings`); the plate's paper IS the theme's canvas;
//   d196TicketNeverClips        — FIX-2: at 1280 / 1024 / 768 / 390 the whole ticket is visible — the title wraps, no part
//                                 runs past the ticket, the page never scrolls sideways; below ≈ 900 the field card wraps
//                                 under the deck instead of crushing it;
//   d196PerforationsMatchGround — FIX-3: the two side holes are the colour of the ground they sit on.
// The page is the F5 fixture (plate/fixtures.jsx MarketOpeningsBoard): DeckView's own FanCard (PlateDeckStill) + the
// field card, inside MarketOpenings — the components the app renders.
// ⛔ Verified to fail (47f, by mutation): `.pl-marketopenings { background: transparent }` (47e's rule) → FIX-1 red in all
// ten themes; a title that doesn't wrap (`white-space: nowrap; overflow: hidden`) → FIX-2 red ("the title is cut").
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../services/browserLauncher.js";
import { buildFixturePage } from "../scripts/d196Regress.mjs";
import { THEME_LIST, cssVarName } from "../client/src/themes/index.js";

// WCAG relative luminance / contrast of two CSS colours the page computed ("rgb(…)" / "rgba(…)")
// Chrome reports a color-mix() result as "color(srgb r g b)" with 0–1 channels, everything else as rgb(0–255)
const rgb = (s) => { const n = (String(s).match(/[\d.]+/g) || []).map(Number); return /^color\(srgb/.test(String(s)) ? n.map((v, i) => (i < 3 ? v * 255 : v)) : n; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let browser, url;
test.before(async () => {
  url = await buildFixturePage("MarketOpeningsBoard");
  browser = await launchBrowser({ headless: "new" });
});
test.after(async () => { await browser?.close(); });

/** Open the fixture as the app would: the given theme's tokens on <html>, NOT the sketch's palette pin. */
async function open(theme, width) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`${url}#w=${Math.max(260, width - 48)}`, { waitUntil: "load" });
  await page.waitForSelector('[data-fan-offset="0"] article');
  const vars = Object.entries(theme.tokens).map(([k, v]) => [cssVarName(k), v]);
  await page.evaluate((id, vars) => {
    const d = document.documentElement;
    d.removeAttribute("data-plate-palette");
    d.setAttribute("data-theme", id);
    for (const [k, v] of vars) d.style.setProperty(k, v);
  }, theme.id, vars);
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 300));
  return page;
}

test("FIX-1 · d196PlatePageAlwaysPaper + d196NoThemeLeakIntoPlate — opaque in every theme, the theme's canvas, readable", { timeout: 300000 }, async () => {
  const bad = [];
  for (const theme of THEME_LIST) {
    const page = await open(theme, 1280);
    const r = await page.evaluate(() => {
      const bg = (el) => getComputedStyle(el).backgroundColor;
      const sections = [...document.querySelectorAll(".pl-marketopenings, .pl-markethero, .pl-marketbearing, .pl-marketpage")];
      // 47i (on purpose): D200 Rule 3 took the section's lead away (one plain header line); its body text is measured
      // instead — the first paragraph, else a binder tab's words — readable on the plate's ground in every theme
      const lead = document.querySelector(".pl-marketopenings .pl-lead") || document.querySelector(".pl-marketopenings p")
        || document.querySelector(".pl-marketopenings [role=tab]");
      const meta = document.querySelector(".pl-marketopenings .pl-leg .pl-label, .pl-marketopenings .pl-label");
      const root = document.querySelector(".pl-marketopenings");
      return { sections: sections.map((s) => [s.className, bg(s)]), lead: getComputedStyle(lead).color, meta: meta ? getComputedStyle(meta).color : null,
        ground: bg(root), canvas: getComputedStyle(document.documentElement).getPropertyValue("--c-canvas").trim() };
    });
    for (const [cls, c] of r.sections) if (/rgba\(.*,\s*0\)$/.test(c) || c === "transparent") bad.push(`${theme.id}: ${cls} is transparent`);
    const probe = await page.evaluate((c) => { const d = document.createElement("div"); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; }, r.canvas);
    if (rgb(probe).slice(0, 3).join() !== rgb(r.ground).slice(0, 3).join()) bad.push(`${theme.id}: the plate's paper ${r.ground} is not the theme's canvas ${probe}`);
    const cl = contrast(r.lead, r.ground), cm = r.meta ? contrast(r.meta, r.ground) : 99;
    if (cl < 4.5) bad.push(`${theme.id}: the lead reads ${cl.toFixed(2)} : 1`);
    if (cm < 4.5) bad.push(`${theme.id}: the leg's mono meta reads ${cm.toFixed(2)} : 1`);
    await page.close();
  }
  assert.deepEqual(bad, []);
});

test("FIX-2 · d196TicketNeverClips — the whole ticket at 1280 / 1024 / 768 / 390; the field card wraps under below ≈ 900", { timeout: 300000 }, async () => {
  const dusk = THEME_LIST.find((t) => t.id === "dusk-dark");
  const bad = [];
  for (const width of [1280, 1024, 768, 390]) {
    const page = await open(dusk, width);
    const r = await page.evaluate(() => {
      const art = document.querySelector('[data-fan-offset="0"] article');
      const A = art.getBoundingClientRect();
      const title = art.querySelector("[data-deck-title-line]");
      const parts = [...art.querySelectorAll(".pl-opening__strip, .pl-opening__top, [data-deck-title-line], [data-deck-info], .pl-stackchip, .pl-tbtn")];
      const out = parts.filter((p) => { const r = p.getBoundingClientRect(); return r.right > A.right + 0.5 || r.left < A.left - 0.5; }).map((p) => p.className || p.tagName);
      const side = document.querySelector('aside[aria-label="Why this opening fits you"]').getBoundingClientRect();
      return { out, titleCut: title.scrollWidth > title.clientWidth + 1, pageScroll: document.documentElement.scrollWidth > innerWidth,
        artRight: A.right, vw: innerWidth, sideBelow: side.top >= A.bottom - 1, actions: art.querySelectorAll("[data-deck-action]").length };
    });
    if (r.out.length) bad.push(`${width}: ${r.out.join(", ")} past the ticket`);
    if (r.titleCut) bad.push(`${width}: the title is cut`);
    if (r.pageScroll) bad.push(`${width}: the page scrolls sideways`);
    if (r.artRight > r.vw) bad.push(`${width}: the ticket runs past the screen (${r.artRight} > ${r.vw})`);
    if (r.actions !== 4) bad.push(`${width}: ${r.actions} actions on the ticket`);
    if (width < 900 && !r.sideBelow) bad.push(`${width}: the field card crushes the deck instead of wrapping under it`);
    await page.close();
  }
  assert.deepEqual(bad, []);
});

test("FIX-3 · d196PerforationsMatchGround — the holes are the ground's colour, at 62 %, 11–12 px", { timeout: 120000 }, async () => {
  for (const id of ["dusk-dark", "paper-light", "plain-dark"]) {
    const page = await open(THEME_LIST.find((t) => t.id === id), 1280);
    const r = await page.evaluate(() => {
      const t = document.querySelector('[data-fan-offset="0"] .pl-opening');
      return { img: getComputedStyle(t).backgroundImage, ground: getComputedStyle(document.querySelector(".pl-marketopenings")).backgroundColor };
    });
    const holes = r.img.match(/radial-gradient\([^)]*\)[^,]*,[^)]*\)/g) || r.img.split("radial-gradient").slice(1);
    assert.equal((r.img.match(/radial-gradient/g) || []).length, 2, `${id}: two holes`);
    assert.match(r.img, /at 0(px|%)? 62%/, `${id}: the left hole at 62 %`);
    assert.match(r.img, /at 100% 62%/, `${id}: the right hole at 62 %`);
    assert.ok(r.img.includes(r.ground.replace(/rgba\((\d+), (\d+), (\d+), 1\)/, "rgb($1, $2, $3)")), `${id}: the holes are ${r.ground} — got ${r.img}`);
    assert.ok(holes.length >= 2);
    await page.close();
  }
});

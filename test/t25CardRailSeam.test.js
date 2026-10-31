// T25 (owner, 10-19) · THE BOARD CARD'S BUTTON BOX — "the three buttons (ATS, star, Draft) have a shade that
// looks like a choppy box holding all three."
//
// MEASURED (P0, this file's first run, before the fix): the rail (`.jb__rail`) was `overflow: hidden` — it needs
// a clip for its 0 → 196px reveal — with 2px of room at the sides and 8px below. The squares' shadows reach 8px
// (rest), 17px + 7px down (hover) and 9px of orange (Draft), so every shadow was cut off at the rail's padded
// box, and the cut edges drew a rectangle around all three. That is D92 rule 2 (never clip a shadow) again.
// FIX: the rail clips with `clip-path: inset(...)` set wider than any shadow, never `overflow`, and paints nothing.
//
// Part 1 reads the stylesheet. Part 2 is THE SEAM TEST for the cluster: the real JobBubble.css over each theme's
// tokens in headless Chrome, at desktop (2 and 3 per row) and phone, the card hovered and each square hovered —
// the luminance just outside the squares (beside the last one, below each one, in the gaps) is sampled and
// compared, pixel for pixel, with the same card drawn with NOTHING clipping the rail. A clip that cuts a shadow
// differs there (P0: 4 luminance below each square, 14 beside the last); a clip with room does not. It SKIPS,
// saying why, on a machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const css = read("client/src/components/JobBubble.css");
const rule = (sel) => { const i = at(css, `${sel} {`, 0, sel); return css.slice(i, at(css, "}", i, `${sel} end`)); };

test("T25 ① the rail clips with clip-path, never overflow, and paints no fill, border or shadow of its own", () => {
  const rail = rule(".jb__rail");
  assert.doesNotMatch(rail, /overflow\s*:\s*(hidden|clip|auto|scroll)/, "an overflow on the rail clips the squares' shadows into a box");
  assert.match(rail, /clip-path: inset\(-\d+px -\d+px -\d+px -\d+px\)/);
  assert.doesNotMatch(rail, /background|border|box-shadow/, "the rail paints a surface of its own (D92 rule 1)");
  // Collapsed, the squares are hidden from the pointer and the keyboard, not only see-through.
  assert.match(rail, /visibility: hidden;/);
  assert.match(css, /\.jb:hover \.jb__rail, \.jb:focus-within \.jb__rail \{ max-width: 196px; opacity: 1; margin-left: 4px; visibility: visible;/);
});

// The sweep (T25: "every other group of buttons on a card or a row"): Draft House's items and The Table's rows
// carry the same rail — the same 2px-room overflow clip, measured 10-22 — and take the same fix.
// D113 UI removed Draft House's hover rail (.dh-rail on .dh-item): a job's actions are its branch's buttons now.
for (const [file, sel, parent] of [["client/src/components/ApplicationHistory.css", ".ah__rail", ".ah__row"]]) {
  test(`T25 ①b the sweep: ${sel} (${file.split("/").pop()}) clips with clip-path, never overflow`, () => {
    const c = read(file), i = at(c, `${sel} {`, 0, sel), r = c.slice(i, at(c, "}", i, `${sel} end`));
    assert.doesNotMatch(r, /overflow\s*:\s*(hidden|clip|auto|scroll)/);
    assert.match(r, /clip-path: inset\(-10px -20px -28px -20px\); visibility: hidden;/);
    assert.doesNotMatch(r, /background|border|box-shadow/);
    assert.ok(new RegExp(`\\${parent}:hover \\${sel}, \\${parent}:focus-within \\${sel} \\{ max-width: \\d+px; opacity: 1; visibility: visible; transition-delay: 0s; \\}`).test(c),
      "the reveal brings visibility back with it");
  });
}

test("T25 ② the clip leaves more room than the largest square shadow (hover: 7px down + 17px blur, lifted 2px)", () => {
  const [top, right, bottom, left] = rule(".jb__rail").match(/clip-path: inset\((-\d+)px (-\d+)px (-\d+)px (-\d+)px\)/).slice(1).map((n) => -Number(n));
  assert.ok(bottom >= 7 + 17 + 2, `bottom room ${bottom}px < the hover shadow's reach`);
  assert.ok(right >= 17 && left >= 17, `side room ${left}/${right}px < the hover shadow's blur`);
  assert.ok(top >= 2 + 4, `top room ${top}px < the lift plus the focus ring`);
});

// ═══ Part 2 · THE SEAM TEST for the cluster ═════════════════════════════════════════════════════════════════

const { resolveBrowserExecutable } = await import("../services/browserLauncher.js");
let browserPath = null;
try { browserPath = (await resolveBrowserExecutable())?.path || null; } catch { browserPath = null; }
const NO_CHROME = browserPath && fs.existsSync(browserPath) ? false : "no Chrome on this machine (services/browserLauncher.js found none)";

test("T25 · THE SEAM TEST — no hard edge around the ATS · star · Draft squares: 4 themes × 2 / 3 per row / phone × card / square hover", { skip: NO_CHROME, timeout: 180000 }, async () => {
  const { default: puppeteer } = await import("puppeteer-core");
  const { THEME_LIST, cssVarName } = await import("../client/src/themes/index.js");
  const card = `<div class="jb"><button class="jb__logo" style="background:var(--c-fh-well)"></button>
    <div class="jb__text"><div class="jb__company">Northwind</div><div class="jb__title">Software Engineer</div><div class="jb__meta">Remote · 2d</div></div>
    <div class="jb__rail"><button class="jb__sq jb__sq--ats" data-score="82"><span class="jb__ats-n">82</span><span class="jb__ats-cap">ats</span></button>
      <button class="jb__sq jb__sq--save">★</button><button class="jb__sq jb__sq--draft">/d</button></div></div>`;
  const UNCLIPPED = ".jb__rail{clip-path:none!important;overflow:visible!important}";
  const page0 = (t, n, extra = "") => `<!doctype html><html data-theme="${t.id}" style="${Object.entries(t.tokens).map(([k, v]) => `${cssVarName(k)}:${v}`).join(";")};--font-body:sans-serif">
    <head><style>${css}
      body{margin:0;padding-top:40px;background:var(--c-canvas);font-family:sans-serif} *{transition:none!important;animation:none!important}${extra}
    </style></head><body><div class="jb-rows" data-columns="${n}"><div class="jb-row">${card.repeat(n)}</div></div></body></html>`;
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", pipe: true, args: ["--no-first-run"] });
  const failures = [];
  try {
    const page = await browser.newPage();
    // Luminance along a 2px-wide strip, one value per pixel, from a screenshot decoded in the page.
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
    // The largest difference from the unclipped drawing, and where.
    const worstAt = (a, b) => { let w = 0, at = 0; for (let k = 0; k < a.length; k++) { const d = Math.abs(a[k] - b[k]); if (d > w) { w = d; at = k; } } return [w, at]; };
    const THRESHOLD = 1.5;   // in 0–255 luminance: rendering noise is < 1; a cut shadow is 4–20
    const load = async (t, n, hover, extra) => {
      await page.setContent(page0(t, n, extra), { waitUntil: "load" });
      // The card first — collapsed, the squares have no width to aim at — then the square.
      await page.hover(".jb .jb__text");
      if (hover !== "card") await page.hover(`.jb .jb__sq--${hover}`);
    };
    for (const t of THEME_LIST) for (const [vp, size, n] of [["desktop", { width: 1440, height: 400 }, 3], ["desktop", { width: 1440, height: 400 }, 2], ["phone", { width: 390, height: 400 }, 1]])
      for (const hover of ["card", "ats", "draft"]) {
        await page.setViewport(size);
        await load(t, n, hover, "");
        const g = await page.evaluate(() => {
          const jb = document.querySelector(".jb"), rail = jb.querySelector(".jb__rail"), sqs = [...rail.querySelectorAll(".jb__sq")];
          const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
          // Every shadowed square: no ancestor inside the card clips with overflow.
          const clipped = sqs.filter((e) => { for (let a = e.parentElement; a && a !== jb.parentElement; a = a.parentElement) {
            const s = getComputedStyle(a); if (a !== jb && (s.overflowX !== "visible" || s.overflowY !== "visible")) return true; } return false; }).length;
          const s = getComputedStyle(rail);
          const paints = s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.boxShadow !== "none" || parseFloat(s.borderTopWidth) > 0;
          return { sqs: sqs.map(r), card: r(jb), clipped, paints };
        });
        const tag = `${t.id} ${vp} ${n}/row hover=${hover}`;
        if (g.clipped) failures.push(`${tag}: ${g.clipped} square(s) inside an overflow container`);
        if (g.paints) failures.push(`${tag}: the rail paints a surface of its own`);
        const last = g.sqs[g.sqs.length - 1];
        const strips = [
          // beside the last square, outward to the card's padding (20px) — inside the card only
          ["right of the last square", { x: Math.ceil(last.r) + 1, y: Math.round((last.t + last.b) / 2) - 1, width: Math.max(4, Math.floor(g.card.r - last.r) - 3), height: 2 }, false],
          // below each square, down to just short of the card's own edge (the card's edge is intended)
          ...g.sqs.map((q, k) => [`below square ${k + 1}`, { x: Math.round((q.l + q.r) / 2) - 1, y: Math.ceil(q.b) + 1, width: 2, height: Math.floor(g.card.b - q.b) - 4 }, true]),
          // down the gaps between squares, from 10px above them (clear of the text above, on a phone) to the card's edge
          ...g.sqs.slice(1).map((q, k) => [`the gap after square ${k + 1}`, { x: Math.round((g.sqs[k].r + q.l) / 2) - 1, y: Math.floor(q.t) - 10, width: 2, height: Math.floor(g.card.b - q.t) + 6 }, true]),
        ];
        const seen = []; for (const [, clip, vertical] of strips) seen.push(await profile(clip, vertical));
        await load(t, n, hover, UNCLIPPED);
        for (const [i, [where, clip, vertical]] of strips.entries()) {
          const [w, k] = worstAt(seen[i], await profile(clip, vertical));
          if (w > THRESHOLD) failures.push(`${tag}: ${where} differs from the unclipped drawing by ${w.toFixed(1)} (${vertical ? "y" : "x"}≈${Math.round((vertical ? clip.y : clip.x) + k)}) — a shadow is cut`);
        }
      }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
});

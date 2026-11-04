// ⛔⛔ D60 · NO PILLS — PERMANENTLY BARRED (owner 10-07: "I want the pill design to be permanently barred
// from all future designs"). No capsule — no fully-rounded shape — on any element: tag, badge, status,
// chip, tab, button, banner, toast, count, meter, field. It SUPERSEDES D48's allowance for status pills.
// The only round shapes left are PERFECT CIRCLES — avatars, state dots, spinners, the today ring — and a
// circle is recognised by having an equal width and height in the same rule, not by a name.
//
// What replaces a pill: interactive → a depth box (DepthButton / .dbx-depth) · status and tags → a MARK
// (styles/mark.js, `.mark` — a rectangle, radius 6, a 3px leading bar) · counts → `.mark-count`.
//
// ⛔ The scan covers client/src, extension/ AND the CSS the extension injects from JS template strings
// (autofill-badge.js, review-overlay.js): a stylesheet-only scan would miss the in-page badge.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (!/node_modules|submission|fonts|brand/.test(f)) walk(p, out); }
    else out.push(p.split(path.sep).join("/"));
  }
  return out;
}

const FILES = [
  ...walk("client/src").filter(f => /\.(jsx?|css)$/.test(f)),
  ...walk("extension").filter(f => /\.(js|css|html)$/.test(f)),
];

/** Comments out — the history notes quote the old `borderRadius: 999` on purpose. */
function strip(src, f) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
  if (/\.(jsx?|html)$/.test(f)) s = s.replace(/(^|[\s;,{(])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
  if (/\.(jsx|html)$/.test(f)) s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, m => m.replace(/[^\n]/g, " "));
  return s;
}

/** The smallest {…} block around `i` — a CSS rule or a style object. */
function block(s, i) {
  let a = i, depth = 0;
  for (; a > 0; a--) { if (s[a] === "}") depth++; if (s[a] === "{") { if (depth === 0) break; depth--; } }
  let b = i; depth = 0;
  for (; b < s.length; b++) { if (s[b] === "{") depth++; if (s[b] === "}") { if (depth === 0) break; depth--; } }
  return s.slice(a, b + 1);
}

/** A circle: the same rule gives an equal width and height (or says aspect-ratio 1). */
function isCircle(blk) {
  if (/aspect-?[rR]atio:\s*["']?1\b/.test(blk)) return true;
  const w = blk.match(/(?:^|[\s{;,])width:\s*["']?([^;,}\s"']+)/);
  const h = blk.match(/(?:^|[\s{;,])height:\s*["']?([^;,}\s"']+)/);
  return !!(w && h && w[1] === h[1]);
}

const pillValue = (v) => {
  const n = v.match(/^["']?\s*(\d+(?:\.\d+)?)\s*(px|%)?/);
  if (!n) return false;
  const x = Number(n[1]);
  return n[2] === "%" ? x >= 50 : x >= 100;
};

function offenders() {
  const out = [];
  for (const f of FILES) {
    const s = strip(read(f), f);
    const line = (i) => s.slice(0, i).split("\n").length;
    for (const m of s.matchAll(/(?:border-radius|borderRadius|\bradius):\s*([^;,}\n]+)/g)) {
      if (!pillValue(m[1].trim())) continue;
      if (isCircle(block(s, m.index))) continue;
      out.push(`${f}:${line(m.index)}  ${m[0].trim()}`);
    }
    // Tailwind's capsule, in any class string (a className, a cva() base) — a circle only when h-N equals w-N.
    for (const m of s.matchAll(/["'`][^"'`\n]*\brounded-full\b[^"'`\n]*["'`]/g)) {
      const t = m[0];
      const h = t.match(/\bh-(\w+)/), w = t.match(/\bw-(\w+)/);
      if (/aspect-square/.test(t) || (h && w && h[1] === w[1])) continue;
      out.push(`${f}:${line(m.index)}  rounded-full`);
    }
  }
  return out;
}

// ⏸ Was HELD FOR D63 — the extension's in-page badge and review overlay; D63 rebuilt both (10-07) and
// emptied the list. SELF-PRUNING: an entry that no longer matches a capsule fails, so it can only shrink.
const HELD_FOR_D63 = [];

test("⛔ D60 guard · no capsule anywhere — every fully-rounded shape in client/src and extension/ is a circle", () => {
  const found = offenders();
  assert.deepEqual(found.filter(o => !HELD_FOR_D63.includes(o)), [],
    "a capsule — use a depth box (interactive), a mark (status), .mark-count (a count) or a radius ≤ 12");
  assert.deepEqual(HELD_FOR_D63.filter(h => !found.includes(h)), [], "a held entry is gone — delete it from HELD_FOR_D63");
});

test("⛔ D60 guard · it sees the extension's INJECTED CSS, and it catches a pill when one is planted", () => {
  // The in-page badge's CSS is a template string inside autofill-badge.js. The guard must read it.
  const badge = read("extension/autofill-badge.js");
  assert.match(badge, /border-radius:/, "the badge's injected CSS is in the file the guard scans");
  assert.ok(FILES.includes("extension/autofill-badge.js") && FILES.includes("extension/review-overlay.js"));
  // Planted: each shape the old site used is caught; a circle is not.
  const plant = (src) => { const s = strip(src, "x.js"); const m = s.match(/(?:border-radius|borderRadius|\bradius):\s*([^;,}\n]+)/); return pillValue(m[1].trim()) && !isCircle(block(s, m.index)); };
  assert.equal(plant("const css = `.pill { padding: 4px 8px; border-radius: 999px; }`;"), true);
  assert.equal(plant(`<span style={{ padding: "2px 8px", borderRadius: 999 }}>Strong</span>`), true);
  assert.equal(plant(`<b style={{ ...glass({ radius: 999 }) }}/>`), true);
  assert.equal(plant(`<i style={{ height: 6, borderRadius: "50%" }}/>`), true, "50% on a non-square is an ellipse — barred");
  assert.equal(plant(`<i style={{ width: 7, height: 7, borderRadius: "50%" }}/>`), false, "a dot is a circle");
});

// ⭐ D152 (7b), changed on purpose (owner 11-04: "that label design wherever in the site get rid of it"): the mark is no
// longer the .mkr chip (a tinted rectangle with a 3px bar, heavy italic) — it is D145's plain type: a word, no box / border /
// fill / bar; a STATE carries a 6px dot before the word. Still never a capsule (D60): no radius at all now.
test("D60 → D152 (7b) · the mark is a plain word; a state is a 6px dot before it — never a chip, never a capsule", async () => {
  const css = read("client/src/components/DepthButton.css");
  const mark = css.slice(at(css, ".mark {"), at(css, "}", at(css, ".mark {")) + 1);
  assert.match(mark, /border-radius: 0; padding: 0;/);
  assert.match(mark, /font-style: normal;/);
  assert.match(mark, /border: 0; background: none;/);
  assert.doesNotMatch(mark, /border-left|color-mix|italic|Poppins/, "no bar, no tint, no heavy italic face");
  assert.match(css, /background: radial-gradient\(circle at 3px 50%, var\(--mk-c\) 3px, transparent 3\.5px\) no-repeat;/, "a state's 6px dot");
  assert.match(css, /\.mark-count \{[^}]*border-radius: 6px;/, "a COUNT is still the small rectangle (not a label chip)");
  const src = read("client/src/styles/mark.js");
  const fn = src.slice(at(src, "export function markStyle("), at(src, "export function bandMarkStyle("));
  assert.match(fn, /borderRadius: 0, padding: state \? "0 0 0 12px" : 0,/);
  assert.doesNotMatch(fn, /borderLeft|color-mix|fontStyle: "italic"|LOGO_FACE/);
  assert.match(fn, /background: state \? `radial-gradient\(circle at 3px 50%, \$\{color\} 3px, transparent 3\.5px\) no-repeat` : "none",/);
  // Not enough signal stays the ABSENCE of a grade: no dot (bandStyle.js's rule, kept).
  assert.match(fn, /const state = !!k && !dashed;/);
});

test("D60 · the rule is written down where the next agent looks — BRAND.md and CLAUDE.md", () => {
  assert.match(read("docs/BRAND.md"), /NO PILLS/);
  assert.match(read("CLAUDE.md"), /NO PILLS/);
});

test("D60 · the named offenders are gone: the nav tabs, résumé ready, the band, the Requirements row, The Table's status", () => {
  // ⭐ D145 (changed on purpose): the tab row is gone; the sections are the Dock / the Menu (AppNav). Each button is a
  // BOX (radius 14, the shape token's 16 under Dusk — on a ~44px two-line button, never a capsule), the current one raised.
  const top = read("client/src/components/AppNav.jsx");
  const navAt = at(top, '<nav aria-label="Main"', 0, "the main nav");
  const nav = top.slice(navAt, at(top, "</nav>", navAt, "the nav's end"));
  assert.match(read("client/src/components/AppNav.jsx"), /className="appnav-item"/);
  const css = read("client/src/components/AppNav.css");
  assert.match(css, /\.appnav-item \{[^}]*border-radius: var\(--shape-radius-control, 14px\);/, "the nav button is a box");
  assert.match(css, /\.appnav-item\[aria-current="page"\] \{ background: var\(--c-surface-2\); color: var\(--c-ink\); \}/, "the current one raised by its fill");
  assert.doesNotMatch(nav + css, /text-transform: uppercase|textTransform: "uppercase"/);
  // ⭐ D152 (7b), changed on purpose: never a capsule, and no chip either — a word with a 6px success dot.
  assert.match(read("client/src/components/JobBubble.css"), /\.jb__ready \{[^}]*border-radius: 0;[^}]*background: radial-gradient\(circle at 3px 50%, var\(--c-success\) 3px/);
  // ⭐ D152 (7b), changed on purpose: the posting's tag is a plain word — no chip, no bar, never a capsule.
  assert.match(read("client/src/components/PostingPanel.css"), /\.posting__pill \{[^}]*padding: 0; border-radius: 0;[^}]*background: none;/);
  // ⭐ D152 (7b), changed on purpose: The Table's status is a word with a 6px dot in its tone — no chip.
  assert.match(read("client/src/components/ApplicationHistory.css"), /\.ah__status \{[^}]*padding-left: 12px;[^}]*background: radial-gradient\(circle at 3px 50%, var\(--st\) 3px/);
  assert.doesNotMatch(read("client/src/components/ApplicationHistory.css"), /\.ah__status \{[^}]*border-left/);
  for (const f of ["client/src/components/JobCard.jsx", "client/src/panels/JobsPanel.jsx", "client/src/panels/DeckView.jsx",
                   "client/src/panels/AtsReportPanel.jsx", "client/src/panels/DatabasePanel.jsx", "client/src/panels/AutoApplyPanelSections.jsx"]) {
    assert.doesNotMatch(read(f), /bandChipStyle/, `${f}: a band is a mark (bandMarkStyle), not the old filled chip`);
  }
});

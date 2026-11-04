// D49 (owner, 10-07) — THE StickyBar MODULE: one sticky-at-the-top section, reused.
//
// FOUND: the Full House bar did NOT stick (measured in the app: 202 → −698 px on scroll). Sticky only
// works inside its parent's box, and the bar's parent was the short header above <main>. The bar (and
// its sort panel) moved to the top of <main>, inside StickyBar; measured after, at 1280 and 390, both
// themes: it holds at the top bar's edge (74 px), the stuck state is OFF at rest and after a 60 px
// scroll and ON once it holds, it keeps the sentence's column, and the sort panel still opens beneath it.
// The posting panel's action bar (D48) is the second consumer — D48 waits on its sketch file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const bar = read("client/src/components/StickyBar.jsx");
const css = read("client/src/components/StickyBar.css");

test("D49 · the module: sticky against the nearest scroll container, stuck found by a sentinel — no scroll listener", () => {
  assert.match(css, /\.sticky-bar \{\s*position: sticky;\s*top: var\(--sticky-top, 0px\);\s*z-index: var\(--z-sticky\);/);
  assert.match(bar, /new IntersectionObserver\(check, \{ root, rootMargin:/);
  assert.match(bar, /className="sticky-bar__sentinel"/);
  assert.doesNotMatch(bar, /addEventListener\(["']scroll/, "a scroll listener is back");
  assert.match(bar, /export function scrollParentOf\(el\)/, "the root is the nearest scroll container, not window");
  assert.match(css, /\.sticky-bar\[data-stuck="true"\] \{[^}]*backdrop-filter: blur\(10px\);[^}]*box-shadow: var\(--c-depth-rest\);/,
    "translucent and blurred, with depth, only when stuck");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.sticky-bar \{ transition: none; \} \}/);
  assert.doesNotMatch(css, /z-index:\s*\d/, "a literal z-index instead of the tier");
  assert.match(read("client/src/styles/zLayers.js"), /STICKY: 150,/);
});

test("D49 · the board's bar renders through StickyBar, at the top of <main> — where sticky can work", () => {
  const app = read("client/src/App.jsx");
  assert.match(app, /import StickyBar from "\.\/components\/StickyBar\.jsx";/);
  // D147 (11-03): the sort panel moved up with the Sort / view word (the title row); the bar sticks alone.
  assert.match(app, /<StickyBar top="var\(--app-chrome-height, 74px\)" className="fh fh--bar-row" data-board-sticky="">\s*<BoardBar \/>\s*<\/StickyBar>/);
  const header = app.slice(at(app, '<header className="fh"'), at(app, "</header>"));
  assert.doesNotMatch(header, /<BoardBar \/>/, "the bar is back in the short header, where it cannot stick");
  assert.ok(app.indexOf("<BoardHeadlineSlot />") < app.indexOf("<BoardBar />"), "the order: the sentence, then the bar");
});

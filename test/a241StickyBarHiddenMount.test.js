// ⭐ A241 (47g, found moving A131 to the plate market) · A STICKY BAR MOUNTED IN A HIDDEN PANEL STILL KNOWS IT IS STUCK.
// The plate market draws the board (and its StickyBar) in the Index tab's panel, hidden while Deck shows. Mounted hidden,
// the bar measured its sticky line as 0 px, so its IntersectionObserver's margin was wrong and never fired once the tab
// showed — measured in a real Chrome: the bar stuck on screen at y 74 with the page at 1693, data-stuck "false", no stuck
// frost, and the search field floating over row 5's title. A ResizeObserver on the bar's parent now re-arms the observer
// when the panel shows (D49: still never a scroll listener). And with the frost drawn, A131's 1284-in-1280 came back on the plate (its rule read --home-gutter, set
// only by the classic .home): the plate page sets it to its own gutter. The real-Chrome half is a131NoSidewaysOverflow1280.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A241: StickyBar re-arms its observer when its hidden panel shows (a ResizeObserver) — still no scroll listener (D49)", () => {
  const src = read("client/src/components/StickyBar.jsx");
  assert.match(src, /const arm = \(at\) => \{ io\?\.disconnect\(\); armedPx = at; io = new IntersectionObserver\(check, \{ root, rootMargin: `-\$\{at\}px 0px 0px 0px`, threshold: \[0, 1\] \}\); io\.observe\(el\); \};/);
  assert.match(src, /const now = resolveTopPx\(el, top\);\n\s+if \(now !== armedPx\) arm\(now\);\n\s+check\(\);/);
  assert.match(src, /if \(el\.parentElement\) ro\?\.observe\(el\.parentElement\);/);
  assert.match(src, /io\?\.disconnect\(\); ro\?\.disconnect\(\);/);
  assert.doesNotMatch(src, /addEventListener\(["']scroll/, "D49: never a scroll listener");
  // the check still reads the LIVE line (not the px measured at mount)
  assert.match(src, /const line = \(root \? root\.getBoundingClientRect\(\)\.top : 0\) \+ resolveTopPx\(el, top\);/);
});

test("A241 / A131: the plate market page sets the gutter the board's stuck frost stops at", () => {
  const css = read("client/src/plate/plate.css");
  assert.match(css, /\.pl-marketpage \{ --home-gutter: var\(--pl-gutter\); \}/);
  const fh = read("client/src/components/FullHouse.css");
  assert.match(fh, /\.home__board \.fh\.fh--bar-row\[data-stuck="true"\]::before \{ right: calc\(-1 \* min\(28px, var\(--home-gutter, 28px\)\)\); \}/);
});

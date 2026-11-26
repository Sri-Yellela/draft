// ⭐ A131 · NO SIDEWAYS OVERFLOW AT 1280 WITH A POSTING + ITS MATCH OPEN. The Full House bar's stuck fringe (::before,
// 28 px past the board on each side) ran 4 px past the window's right edge on Home, where the board ends one page gutter
// (24 px at 1280) from it — measured 1284 in a 1280 window with the bar stuck. The fringe is never wider than the gutter.
// Measured in a real Chrome on stubbed /api/* by scripts/a131OverflowProbe.mjs (Dusk Dark and Paper Light at 1280, and 920).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("a131 (pure): on Home the stuck fringe stops at the page's gutter", () => {
  const css = read("client/src/components/FullHouse.css");
  assert.match(css, /\.home__board \.fh\.fh--bar-row\[data-stuck="true"\]::before \{ right: calc\(-1 \* min\(28px, var\(--home-gutter, 28px\)\)\); \}/);
  assert.match(css, /@media \(min-width: 861px\) and \(max-width: 980px\) \{\n  \.home__board \.fh\.fh--bar-row\[data-stuck="true"\]::before \{ right: -16px; \}/);
});

test("a131NoSidewaysOverflow1280 (real Chrome): the board, a posting, its match, the bar stuck — never wider than the window", { timeout: 300000 }, (t) => {
  const out = JSON.parse(execFileSync(process.execPath, ["scripts/a131OverflowProbe.mjs"],
    { encoding: "utf8", timeout: 280000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, r] of Object.entries(out)) {
    assert.deepEqual(r.errors, [], `${size}: no page errors`);
    assert.equal(r.postingOpen, true, `${size}: a posting opened`);
    assert.equal(r.matchOpen, true, `${size}: its match opened`);
    // at 1280 the walk reaches the stuck bar (the case A131 is about); at 920 (one column) the bar does not stick.
    // ⭐ 47i: the plate market mounts no StickyBar (App.jsx `!marketPlate`), so r.stuck is null there and the frost case
    // can't arise; if a sticky bar comes back, it must stick at 1280 and its fringe stay inside the window (below).
    if (size.startsWith("1280") && r.stuck != null) assert.equal(r.stuck, "true", `${size}: the bar was stuck`);
    for (const step of ["board", "posting", "more", "scrolled", "match"]) {
      assert.equal(r[step].over, false, `${size} ${step}: ${r[step].sw} wide in a ${r[step].vw} window (${JSON.stringify(r[step].sticking)})`);
      if (r[step].frostRight != null) assert.ok(r[step].frostRight <= r[step].vw, `${size} ${step}: the fringe ends at ${r[step].frostRight}`);
    }
  }
});

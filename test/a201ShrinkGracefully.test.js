// ⭐ A201 (46k, owner 11-13: "the content of the home panel rows are garbled when shrunken probe the site and fix this across all
// places so that the content readjusts gracefully and stay functional when windows shrink"). Measured in a real Chrome by
// `scripts/fidelityShots.mjs --styles shrink201` — the full sweep (12 screens × 1440 → 390, Ask draft closed and open) ran
// clean on 11-13 after the fixes; this guard re-runs the screens that broke (Draft House's held row, the board, Profile) at
// the widths that broke them (768, 390): no sideways page scroll, nothing past the viewport, no words over words, no text
// squeezed to a word a line, every control in reach.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
let probe = null;
function measured(t) {
  if (!probe) probe = fidelityProbe("shrink201", { routes: "draft-held,board,profile", sizes: "768,390" });
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}

test("⭐ A201 (Chrome): the screens that garbled read cleanly at 768 and 390, with Ask draft closed and open", { timeout: 620000 }, (t) => {
  const p = measured(t); if (!p) return;
  for (const [route, sizes] of Object.entries(p)) for (const [size, v] of Object.entries(sizes)) for (const state of ["closed", "ask"]) {
    const m = v.node?.[state]; if (!m) continue;
    const where = `${route} ${size} (Ask draft ${state === "ask" ? "open" : "closed"})`;
    assert.equal(m.rendered, true, `${where}: the app drew (a blank page or Vite's error overlay has nothing to flag — never a pass)`);
    assert.equal(m.sideScroll, false, `${where}: no sideways scroll`);
    assert.deepEqual(m.past, [], `${where}: nothing past the viewport`);
    assert.deepEqual(m.overlaps, [], `${where}: no words drawn over words`);
    assert.deepEqual(m.squeezed, [], `${where}: no text squeezed to a word a line`);
    assert.deepEqual(m.unreachable, [], `${where}: every control in reach`);
  }
});

test("A201: the fixes — the table and the card pairs follow their OWN width; Tiny floats over the page (owner 11-15)", () => {
  assert.match(read("client/src/components/ApplicationTracker.css"), /\.trk \{[^}]*container-type: inline-size; container-name: trk; \}[\s\S]*@container trk \(max-width: 700px\) \{/);
  const jb = read("client/src/components/JobBubble.css");
  // ⛔ 47j A248 (changed on purpose): the bubble rows (.jb-rows, their `jbrows` container) are deleted with the card
  assert.doesNotMatch(jb, /container-name: jbrows/);
  // ⛔ 47j R2 (changed on purpose): the bubble PAIR (.jb-pair) is deleted with the classic market — the market's list is the
  // Index (shrink201's board route measures its rows); the pair's stacking rule left with it
  assert.doesNotMatch(jb, /(^|\n)\s*\.jb-pair\b/, "the classic pair's rules are deleted");
  const nav = read("client/src/components/AppNav.css");
  // ⭐ owner 11-15: Tiny replaces Ask draft, floating (changed on purpose) — A201's split (push from 1280 px, a sheet below)
  // is retired: the card floats over the page at every width, so the page is never narrowed; a bottom sheet on phones.
  assert.doesNotMatch(nav, /\[data-ask-open="true"\] \[data-app-shell\] \{ padding-right/);
  assert.match(nav, /@media \(max-width: 600px\) \{   \/\* D190: a bottom sheet on phones; the bubble steps aside while it is open \*\/\n  \.appnav-tiny \{ right: 12px; bottom: 12px; \}/);
});

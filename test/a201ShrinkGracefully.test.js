// ⭐ A201 (46k, owner 11-13: "the content of the home panel rows are garbled when shrunken probe the site and fix this across all
// places so that the content readjusts gracefully and stay functional when windows shrink"). Measured in a real Chrome by
// `scripts/fidelityShots.mjs --styles shrink201` — the full sweep (12 screens × 1440 → 390, Ask draft closed and open) ran
// clean on 11-13 after the fixes; this guard re-runs the screens that broke (Draft House's held row, the board, Profile) at
// the widths that broke them (768, 390): no sideways page scroll, nothing past the viewport, no words over words, no text
// squeezed to a word a line, every control in reach.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
let probe = null;
function measured(t) {
  if (!probe) probe = JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", "shrink201", "draft-held,board,profile"],
    { encoding: "utf8", timeout: 600000, stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, FIDELITY_SIZES: "768,390" } }).trim().split("\n").pop());
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

test("A201: the fixes — the table and the card pairs follow their OWN width; Ask draft is a sheet below 1280 px", () => {
  assert.match(read("client/src/components/ApplicationTracker.css"), /\.trk \{[^}]*container-type: inline-size; container-name: trk; \}[\s\S]*@container trk \(max-width: 700px\) \{/);
  const jb = read("client/src/components/JobBubble.css");
  assert.match(jb, /container-type: inline-size; container-name: jbrows;/);
  assert.match(jb, /@container jbrows \(max-width: 620px\) \{\n  \.jb-pair \{ flex-direction: column;/);
  assert.match(jb, /\.jb-pair \.jb__meta \{ flex-wrap: wrap; overflow: hidden; white-space: nowrap; max-height:/, "a fact drops whole, never cut mid-word");
  const nav = read("client/src/components/AppNav.css");
  // pushing the page only from 1280 px (the page keeps ~900 px); below, a sheet over it (A201: 1024 px left Home 644 px)
  assert.match(nav, /@media \(min-width: 1280px\) \{   \/\* A201: Ask draft pushes the page only where the page keeps ~900 px; below, it is a sheet \*\/\n  :root\[data-ask-open="true"\] \[data-app-shell\] \{ padding-right: var\(--appnav-ask-w\); \}/);
  assert.match(nav, /@media not all and \(min-width: 1280px\) \{\n  \.appnav-ask \{ --appnav-ask-w: min\(420px, 100vw\); z-index: 256;/);
});

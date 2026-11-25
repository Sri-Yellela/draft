// ⭐ D163 · USE THE SPACE (owner 11-05: "the menu dock, the deck and all are crammed into a corner when there is so much
// space around, whenever there is space they should centered and distributed to use the space to look nicer").
// The jobs page (/app) is ONE CENTRED COMPOSITION, at most 1680 wide: the free space shared evenly on both sides (measured
// from the dock's right edge — the dock keeps its own gutter — to the viewport's right edge), the gaps between the columns
// and the side gutters growing with the width (clamp()), the deck centred in its column with the fan's room, the dock
// vertically centred and still pushing the page when it opens (D156 (3)), and nothing flush to an edge.
// Measured in a real Chrome at 1280 / 1440 / 1920 / 2560 and 390 by `scripts/fidelityShots.mjs --styles home163`
// (which also writes docs/fidelity-shots/home163-app-<width>.png).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const FH = read("client/src/components/FullHouse.css");
const NAVCSS = read("client/src/components/AppNav.css");
const WIDTHS = ["1280", "1440", "1920", "2560"];

let probe = null;
function measured(t) {
  if (probe === null) {
    probe = fidelityProbe("home163");
  }
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}

// ── pure ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test("d163 (pure): one centred group at most 1680 wide; gutters and gaps are clamp()s; the dock centred on its gutter", () => {
  // ⭐ 46q FULL WIDTH (owner 11-16, moved on purpose): the page gutter, no 1680 cap — the composition fills the screen.
  assert.match(FH, /\.home \{ --home-gutter: var\(--page-gutter\); --home-gap: clamp\(32px, 2\.5vw, 64px\);/);
  assert.match(FH, /max-width: none; margin: 0;\n  padding: 28px var\(--home-gutter\) 80px;/);
  assert.match(FH, /@media \(min-width: 1440px\) \{ \.home \{ --home-deck-track: minmax\(640px, \.75fr\); \}/);
  // ⭐ D197 #1 · A237 (the Shell board, changed on purpose — supersedes D163 / D167's centred rail): the rail sits at the
  // LEFT, 14 px from the edges, and the content column starts beside it (test/d167Dock d197ShellPlace).
  assert.match(NAVCSS, /\.appnav-plate > nav\[data-nav-dock\]\[data-place="side"\] \{\n  position: fixed; left: 14px; top: 14px;/);
  assert.match(NAVCSS, /:root\[data-dock-place="side"\] \[data-app-shell\] \{ padding-left: 98px; \}/);
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
test("d163ContentGroupCentred (real Chrome, 1280 · 1440 · 1920 · 2560): left and right free space equal within 5 % of the width", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const w of WIDTHS) {
    const r = out[w].rest;
    assert.ok(r.group, `${w}: the content group was measured`);
    assert.ok(Math.abs(r.leftFree - r.rightFree) <= 0.05 * out[w].vw,
      `${w}: left ${r.leftFree} vs right ${r.rightFree} (the drawn content)`);
    assert.ok(Math.abs(r.homeLeftFree - r.homeRightFree) <= 0.05 * out[w].vw, `${w}: the composition's box ${r.homeLeftFree} / ${r.homeRightFree}`);
    // ⭐ 46q FULL WIDTH (owner 11-16, moved on purpose — was "at most 1680 wide, > 300 free each side at 2560"): the
    // composition fills the screen inside the page gutter (clamp(16px, 3vw, 48px)) at every width.
    assert.ok(r.leftFree <= 80 && r.rightFree <= 80, `${w}: the composition fills the width (${r.leftFree} / ${r.rightFree})`);
  }
});

test("d163GapsScaleWithWidth (real Chrome): the gap between the columns and the side gutters grow with the screen", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  const gaps = WIDTHS.map(w => out[w].rest.colGap), gutters = WIDTHS.map(w => out[w].rest.gutterL);
  for (let i = 1; i < WIDTHS.length; i++) {
    assert.ok(gaps[i] >= gaps[i - 1], `gaps never shrink as the screen grows (${gaps})`);
    assert.ok(gutters[i] >= gutters[i - 1], `gutters never shrink as the screen grows (${gutters})`);
  }
  assert.ok(gaps[0] >= 24 && gaps[0] <= 40 && gaps[3] === 64, `the gap ≈ 24–40 at 1280, 64 at 2560 (${gaps})`);
  // ⭐ 46q FULL WIDTH (changed on purpose): the page gutter clamp(16px, 3vw, 48px) — 38.4 at 1280, 48 from 1600 (was 24 → 96).
  assert.ok(Math.round(gutters[0]) === 38 && Math.round(gutters[3]) === 48, `the gutters 38 at 1280, 48 at 2560 (${gutters})`);
  for (const w of WIDTHS) assert.equal(out[w].rest.gutterL, out[w].rest.gutterR, `${w}: even gutters`);
  // the postings keep two columns, and the bubbles are larger on a wide screen
  for (const w of WIDTHS) assert.equal(out[w].rest.bubbles.length, 2, `${w}: two columns of postings`);
  // ⭐ D197 #1 · A237 (moved on purpose, logged): beside the 84 px rail the classic (?plate=0) board's column at 1440 is 98 px
  // narrower, so its container (≤ 620 px) stacks each pair — one posting per row there (the landscape deck card keeps the
  // 640 px track from 1440: lib/fanGeometry.js HOME_WIDE). The wide screens still widen the bubbles, compared with 1280.
  assert.ok(out["1920"].rest.bubbles[0] > out["1280"].rest.bubbles[0] && out["2560"].rest.bubbles[0] > out["1920"].rest.bubbles[0],
    `wider bubbles on wide screens (${WIDTHS.map(w => out[w].rest.bubbles[0])})`);
});

test("d163DeckCentredInColumn (real Chrome): the card and its fan sit in the middle of the deck's column", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const w of WIDTHS) {
    const r = out[w].rest;
    assert.ok(r.stackLeft >= 0 && r.stackRight >= 0, `${w}: the fan stays inside its column (${r.stackLeft} / ${r.stackRight})`);
    // below 1440 the column IS the card and the fan's reserved room (390 = 300 + 90); from 1440 it takes a share of a
    // wide screen and the deck is centred in it
    assert.ok(Math.abs(r.stackLeft - r.stackRight) <= Math.max(24, 0.05 * r.deckCol.width), `${w}: centred (${r.stackLeft} / ${r.stackRight})`);
  }
  assert.ok(out["1920"].rest.stackLeft > 10 && out["2560"].rest.stackLeft > 10, "a wide column: the deck is not pinned to its left");
});

// ⭐ D167 (owner 11-06, "the dock goes where the space is" — changed on purpose: the rail on its own gutter, pushing the
// page, is gone): a SIDE dock (only where the margin fits it open — 2560 here) is vertically centred in that margin and
// never covers or pushes the content; a TOP dock (1280–1920, phones) sits above the content. test/d167Dock has the rest.
test("d163DockOwnGutterVerticallyCentred → D167 (real Chrome): a side dock centred in its margin, a top dock above the content; never pushes or covers", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const w of [...WIDTHS, "phone"]) {
    const d = out[w], r = d.rest;
    if (r.place === "side") {
      // ⭐ D197 #1 · A237 (changed on purpose): the rail at the LEFT, 14 px from the top (no longer centred in a margin)
      assert.equal(r.dock.top, 14, `${w}: 14 px from the top (${r.dock.top})`);
      assert.ok(r.dock.left > 0 && r.dock.right <= (r.group?.left ?? Infinity), `${w}: left of the content`);
    } else {
      assert.ok(r.dock.top >= d.vh - 90, `${w}: the bottom bar at the foot (${r.dock.top} of ${d.vh})`);
    }
  }
  // ⭐ D197 #1 · A237 (changed on purpose — 46q put it at the top everywhere): the rail at every width from 980 px, the
  // bottom bar below it (the phone's dock bottom ≤ the content's top no longer applies: the bar sits at the foot)
  assert.equal(out["2560"].rest.place, "side"); assert.equal(out["1280"].rest.place, "side"); assert.equal(out.phone.rest.place, "phone");
  for (const w of WIDTHS) {
    const o = out[w].open;
    if (!o) continue;
    // ⭐ D197 #1 (changed on purpose): the shell is always padded by the rail's column (98 px) — the same open or not
    assert.equal(o.shellPad, "98px", `${w}: hovering it never pushes the page`);
    assert.equal(o.covers, false, `${w}: the dock never covers the content`);
  }
});

test("d163NoCornerCramming (real Chrome): nothing flush to an edge; narrow screens keep tight, even margins", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const w of [...WIDTHS, "phone"]) {
    const r = out[w].rest;
    assert.deepEqual(r.flush, [], `${w}: nothing within 8 px of the dock or the viewport's edge`);
    assert.ok(r.leftFree >= 8 && r.rightFree >= 8, `${w}: room on both sides (${r.leftFree} / ${r.rightFree})`);
  }
  const p = out.phone.rest;
  assert.equal(p.gutterL, 16); assert.equal(p.gutterR, 16);
  assert.ok(Math.abs(p.leftFree - p.rightFree) <= 0.05 * out.phone.vw, `the phone: even margins (${p.leftFree} / ${p.rightFree})`);
  const n = out["1280"].rest;
  assert.ok(n.leftFree <= 40 && n.rightFree <= 40, `1280: tight (${n.leftFree} / ${n.rightFree})`);
});

// Queue 40 — the expanded card uses the full width: ATS │ card │ posting.
// The layout is pure (client/src/lib/fanGeometry.js · expandedLayout), so its constraints are pinned as
// arithmetic; the view is pinned by source where a browser would be needed — that the panels live
// inside the deck's stage (part of the expansion, not a second view), that nothing routes, that the
// narrow fallback is the stacked card, and that the deck never mounts the board's overlay surface.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const { CARD, EXPANDED, FAN_SWITCH_PX, THREE_COL_PX, expandedLayout, fanTransform } = await import("../client/src/lib/fanGeometry.js");

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const deckSrc = codeOnly(read("client/src/panels/DeckView.jsx"));

// Absolute columns for a layout, in viewport px.
const columns = (vw, cx = vw / 2) => {
  const l = expandedLayout(vw, cx);
  const cardLeft = cx - l.card.width / 2 + l.card.shift;
  return { l, left: [cx + l.left.x, cx + l.left.x + l.left.width], card: [cardLeft, cardLeft + l.card.width],
           right: [cx + l.right.x, cx + l.right.x + l.right.width] };
};

test("⭐ three columns from THREE_COL_PX up; below it null — the panels stack inside the card", () => {
  assert.equal(expandedLayout(THREE_COL_PX - 1), null);
  assert.ok(expandedLayout(THREE_COL_PX));
  assert.ok(THREE_COL_PX >= FAN_SWITCH_PX, "three columns only ever happen on the horizontal deck");
  // The threshold is where the minimums first fit, not a taste: 2 panels + the narrowest card + gutters + shift.
  const { pad, gap, minPanel, minCard, shift } = EXPANDED;
  const fits = 2 * pad + 2 * gap + 2 * minPanel + minCard + 2 * shift;
  assert.ok(fits <= THREE_COL_PX && THREE_COL_PX - fits < 20, `the minimums fit at ${fits}px; the breakpoint is ${THREE_COL_PX}`);
});

test("⛔ at every width from the breakpoint up: nothing below its minimum, nothing overlaps, nothing past the gutter", () => {
  const { pad, gap, minPanel, minCard } = EXPANDED;
  for (const vw of [1280, 1366, 1440, 1600, 1920, 2560]) {
    const { l, left, card, right } = columns(vw);
    assert.ok(l.card.width >= minCard && l.card.width <= CARD.horizontal.width, `${vw}: card ${l.card.width}`);
    assert.ok(l.left.width >= minPanel && l.right.width >= minPanel, `${vw}: panels ${l.left.width} / ${l.right.width}`);
    assert.ok(Math.abs(left[0] - pad) < 0.01 && Math.abs(vw - right[1] - pad) < 0.01, `${vw}: a panel crosses the gutter`);
    assert.ok(Math.abs(card[0] - left[1] - gap) < 0.01 && Math.abs(right[0] - card[1] - gap) < 0.01, `${vw}: columns overlap or drift`);
  }
});

test("⭐ the card shifts SLIGHTLY right, and the arc slides right behind the posting", () => {
  for (const vw of [1280, 1440, 1920]) {
    const { l, right } = columns(vw);
    assert.ok(l.card.shift > 0 && l.card.shift < EXPANDED.gap * 2, "slightly: right, and less than the gutters");
    const spine = vw / 2 + l.arc;
    assert.ok(spine > right[0] && spine < right[1], `${vw}: the arc's spine (${spine}) is not behind the posting`);
    // Through the SAME transform the rotation uses: the front card by `shift`, every back by `arc`.
    for (const o of [0, 1, -2]) {
      const rest = fanTransform(o, "horizontal");
      const open = fanTransform(o, "horizontal", undefined, l);
      assert.equal(open.x, Math.round((rest.x + (o === 0 ? l.card.shift : l.arc)) * 100) / 100);
      assert.equal(open.y, rest.y, "only sideways");
      assert.equal(open.rotate, rest.rotate);
    }
  }
});

test("⛔ the layout reads the LAYOUT width and the stage's real centre — a scrollbar is not page", () => {
  assert.match(deckSrc, /document\.documentElement\.clientWidth/);
  assert.match(deckSrc, /expandedLayout\(stageBox\.vw, stageBox\.cx\)/);
  // An off-centre stage moves the columns with it and still keeps them inside the gutters.
  const { left, right } = columns(1440, 700);
  assert.ok(left[0] >= EXPANDED.pad - 20 - 0.01 && right[1] <= 1440 - EXPANDED.pad + 20 + 0.01);
});

test("⛔ the card is still the element that expanded: the panels are INSIDE its stage, and nothing routes", () => {
  const stage = deckSrc.slice(at(deckSrc, "data-deck-stage", 0, "stage"), at(deckSrc, "data-deck-actions", 0, "action row"));
  assert.match(stage, /<FlankPanel key="ats" id="deck-ats" label="The ATS report" side="left" box=\{flank\.left\}>/, "ATS on the LEFT");
  assert.match(stage, /<FlankPanel key="posting" id="deck-posting" label="The posting" side="right" box=\{flank\.right\}>/, "the posting on the RIGHT");
  assert.match(deckSrc, /flank \? "deck-ats deck-posting" : "deck-detail"/, "the expand control names what it opened");
  // Three columns only on the horizontal deck; below, the stacked card that shipped.
  assert.match(deckSrc, /const flank = expanded && orientation === "horizontal" && stageBox \? expandedLayout/);
  const panel = deckSrc.slice(at(deckSrc, "function FlankPanel", 0, "FlankPanel"), at(deckSrc, "function CardFace", 0, "CardFace"));
  assert.doesNotMatch(panel, /navigate\(|<Link|history\.|useNavigate/, "a panel that routes is a second view");
  assert.match(panel, /zIndex: Z\.CONTENT/, "a panel is content, above the fan by tier");
  assert.match(panel, /initial=\{\{ opacity: 0, x: from \}\} animate=\{\{ opacity: 1, x: 0 \}\}/, "transform and opacity only");
  assert.match(panel, /overflowY: "auto"/, "a long posting scrolls in its panel, not the page");
});

test("⭐ rearranged, not invented: the panels render the SAME pieces the stacked card does", () => {
  const stage = deckSrc.slice(at(deckSrc, "data-deck-stage", 0, "stage"), at(deckSrc, "data-deck-actions", 0, "action row"));
  for (const piece of ["<BandLine band={current.band} />", "<WhyChips why={current.why || {}} />", "<PostingText job={current.job} />"]) {
    assert.ok(stage.includes(piece), `the flank lost ${piece}`);
  }
  const face = deckSrc.slice(at(deckSrc, "function CardFace", 0, "CardFace"), at(deckSrc, "const POSITION_EASE", 0, "end of face"));
  assert.match(face, /\{!flank && <WhyChips why=\{why\} \/>\}/, "flanked, the evidence MOVES to the ATS panel rather than showing twice");
  for (const piece of ["<BandLine band={band} />", "<PostingText job={job} />", "<PostingLinks job={job} onReport={onReport} />"]) {
    assert.ok(face.includes(piece), `the stacked fallback lost ${piece}`);
  }
});

test("⛔ the old stacked JD / ATS / PDF overlays: the deck mounts none of them", () => {
  for (const name of ["PanelShell", "AtsReportPanel", "ATSPanel", "JobDetailPanel", "PanelDock", "PanelScrim"]) {
    assert.doesNotMatch(deckSrc, new RegExp(`\\b${name}\\b`), `the deck reaches the old overlay surface through ${name}`);
  }
});

test("⛔ the fan never scrolls the page sideways — clipped by `clip` on a full-width wrapper, never `hidden`", () => {
  // Measured 10-01: expanded at 1440 the arc sliding right made the page 1820px wide (1667 at 1280),
  // and the resting fan at 1100 was 1px over. `hidden` would make a scroll container and break the
  // sticky action row and the sticky Collapse; `clip` does not.
  const root = deckSrc.slice(at(deckSrc, '<MotionConfig reducedMotion="user">', 0, "root"), at(deckSrc, "<CardBackDefs />", 0, "content"));
  assert.match(root, /<div data-deck-clip style=\{\{ overflowX: "clip" \}\}>/);
  assert.ok(at(root, "data-deck-clip", 0, "clip") < at(root, "data-deck-orientation", 0, "column"), "the clip wraps the centred column, so the flanks are inside it");
  assert.doesNotMatch(root, /overflowX?: "hidden"/, "a scroll container round the deck un-sticks the action row and Collapse");
});

// A40 (rebuilt 10-02) — the expanded card is TWO EQUAL PANELS: the full ATS report │ the card.
// docs/BRAND_OUTLAY_AND_MOTION.md §"THE EXPANDED CARD — DECIDED 2026-10-01" is authoritative. This
// REPLACES deckExpandedFlank.test.js, which pinned the first build (8c38dd2, da73ff9): three columns,
// ATS │ card │ posting — the posting moved OUT of the card into a third column. That was the wrong design,
// so those assertions were deleted rather than adjusted.
//
// The numbers are pure (client/src/lib/fanGeometry.js) and pinned as arithmetic; the view is pinned by
// source where a browser would be needed. The motion itself was checked in a browser:
// draft-screenshots/expand-two-panel/.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const { CARD, EXPAND_CLOCK, FAN_SWITCH_PX, TWO_PANEL, TWO_PANEL_PX, twoPanelColumn, twoPanelFor } = await import("../client/src/lib/fanGeometry.js");

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const deckSrc = codeOnly(read("client/src/panels/DeckView.jsx"));
const face = deckSrc.slice(at(deckSrc, "function CardFace", 0, "CardFace"), at(deckSrc, "const POSITION_EASE", 0, "end of face"));
const grid = deckSrc.slice(at(deckSrc, "<div data-deck-grid", 0, "grid"), at(deckSrc, "<AtsSheet key=", 0, "sheet"));
const geoSrc = codeOnly(read("client/src/lib/fanGeometry.js"));

test("⛔ TWO panels, not three: no third column, and the posting stays INSIDE the card", () => {
  for (const gone of ["FlankPanel", "expandedLayout", "THREE_COL_PX", 'id="deck-posting"', 'side="right"']) {
    assert.ok(!deckSrc.includes(gone) && !geoSrc.includes(gone), `the three-column build is back: ${gone}`);
  }
  // The grid has exactly two columns when wide: the report, and the card's column.
  assert.match(grid, /gridTemplateColumns: twoPanel \? `minmax\(0, \$\{expanded \? 1 : 0\}fr\) minmax\(0, 1fr\)` : "minmax\(0, 1fr\)"/);
  // The posting is part of the card's face. D32: it is drawn by the posting half of the ink pair
  // (components/PostingPanel.jsx) — still inside the card, still the card's own section.
  assert.match(face, /<section id="deck-detail" aria-label="The posting"[\s\S]*?<CardPosting card=\{card\} \/>/);
  assert.match(deckSrc, /<PostingPanel job=\{card\.job\} experience=\{experience\} showTitle=\{false\}>/);
});

test("⭐ the grid is the trick: the report's column grows 0fr → 1fr and PUSHES the card; the fan rides in the card's column", () => {
  assert.ok(at(grid, "data-deck-ats-col", 0, "report column") < at(grid, "data-deck-col", 0, "card column"), "the report is on the LEFT");
  const col = grid.slice(at(grid, "<div data-deck-col", 0, "card column"));
  assert.match(col, /data-deck-stage/, "the fan lives in the card's column, so it moves WITH it");
  assert.match(col, /data-deck-actions/, "and so does the action row");
  // No per-card shift: nothing positions the card for the expansion — the column does.
  // ⭐ D152 (2), changed on purpose: Home's card turns about its lower-left corner (homeFanTransform); the arc is the rest.
  assert.match(deckSrc, /const t = home \? homeFanTransform\(offset, geometry\) : fanTransform\(offset, orientation, geometry\);/);
  assert.match(grid, /minmax\(0,/, "minmax(0, …): an fr column's auto minimum would keep a closed column open");
});

test("⛔ ONE CLOCK, NO STAGGER: every movement reads --deck-t / --deck-ease, set once; reduced motion zeroes it", () => {
  assert.match(deckSrc, /const ON_THE_CLOCK = "var\(--deck-t\) var\(--deck-ease\)";/);
  assert.match(deckSrc, /"--deck-t": reduced \? "0s" : EXPAND_CLOCK\.duration, "--deck-ease": EXPAND_CLOCK\.ease/);
  assert.match(grid, /transition: `grid-template-columns \$\{ON_THE_CLOCK\}, column-gap \$\{ON_THE_CLOCK\}`/);
  // ⭐ D145: the hover facts and "Why this job" ride the same clock (the signal row went to the header's match).
  assert.match(face, /data-deck-soft="" style=\{\{ display: "grid", gridTemplateRows: soft \? "1fr" : "0fr", opacity: soft \? 1 : 0,\s*transition: `grid-template-rows \$\{ON_THE_CLOCK\}, opacity \$\{ON_THE_CLOCK\}` \}\}/);
  assert.match(face, /data-deck-why-row="" style=\{\{ display: "grid", gridTemplateRows: deep \? "1fr" : "0fr", transition: `grid-template-rows \$\{ON_THE_CLOCK\}` \}\}/);
  assert.match(face, /data-deck-posting-row style=\{\{ display: "grid", gridTemplateRows: open \? "1fr" : "0fr", transition: `grid-template-rows \$\{ON_THE_CLOCK\}` \}\}/);
  // No delay anywhere in the expansion — a delayed panel read as two events in the sketch.
  const expansion = deckSrc.slice(at(deckSrc, "const ON_THE_CLOCK", 0, "clock"), at(deckSrc, "function FanCard", 0, "FanCard")) + grid;
  assert.doesNotMatch(expansion, /delay/i, "a stagger (transition-delay, transitionDelay, a framer delay)");
  // The duration is the design's "in unison, a bit slowly": ~0.9–1.3 s, in ONE place.
  const s = parseFloat(EXPAND_CLOCK.duration);
  assert.ok(s >= 0.9 && s <= 1.3, `the clock is ${EXPAND_CLOCK.duration}`);
  assert.equal((deckSrc.match(/EXPAND_CLOCK\.duration/g) || []).length, 1, "the duration restated somewhere");
});

test("⭐ the collapsed card is COMPACT: ONE signal line, no chip rows — and on a wide screen it leaves as the report arrives", () => {
  assert.doesNotMatch(deckSrc, /WhyChips|Why it's here|Not on your résumé yet/, "a chip row on the collapsed card");
  // D129 / D124 (1884857, owner 11-01): the counts read "N of M skills" — term counts, never a score. ⭐ D145 (changed on
  // purpose): they are the "Why this job" headline now (lib/deckCardFacts.js); the folded card says the match, the title
  // and ONE info row — no signal line, no chip row.
  assert.match(read("client/src/lib/deckCardFacts.js"), /`\$\{mTotal\} of \$\{total\} skills`/);
  assert.doesNotMatch(face, /<AtsSignal|<TrialMatch|signalShown/, "the old signal line on the card");
  // On a phone the full posting is still headed by the collapsed score (the sticky column's phone answer).
  assert.match(face, /\{!twoPanel && <CollapsedScore card=\{card\} onOpen=\{isFront \? onSignal : undefined\} \/>\}/);
});

test("⛔ the LEFT panel is the FULL report — the board's own ATSPanel — fed the BAND, never a number", () => {
  const panel = deckSrc.slice(at(deckSrc, "function DeckAtsReport", 0, "report"), at(deckSrc, "function CollapseButton", 0, "end"));
  assert.match(panel, /<ATSPanel report=\{fromDeckReport\(r\)\} band=\{r\.scorable \? card\.band : ATS_BAND\.NOT_ENOUGH_SIGNAL\}/,
    "a declined report is 'not enough signal', never a low band");
  assert.doesNotMatch(panel, /score=/, "a number handed to the report");
  // A52: the adapter lives with the one report implementation — since T9 its model, shared/atsReportModel.js
  // (components/AtsReport.jsx re-exports it to the deck).
  const reportSrc = read("shared/atsReportModel.js");
  const adapt = reportSrc.slice(at(reportSrc, "export function fromDeckReport", 0, "adapter"), at(reportSrc, "export function fromStandaloneResult", 0, "end"));
  for (const k of ["tier1_matched", "tier1_missing", "competencies_matched", "action_verbs_matched", "action_verbs_missing",
                   "action_verbs_generic", "experience", "hard_constraint_misses", "decline_reasons"]) {
    assert.match(adapt, new RegExp(`\\b${k}:`), `the report lost ${k}`);
  }
  // A card dealt before the full report was frozen says where it is — it does not rebuild one from chips.
  assert.match(panel, /if \(!r\) \{[\s\S]*?Full report on the board →/);
  assert.match(read("client/src/components/ATSPanel.jsx"), /const band = knownBand \?\? atsBandFor\(/);
});

test("⛔ the card is still the element that expanded: the report is INSIDE the deck, nothing routes, no old overlay", () => {
  const aside = grid.slice(at(grid, "<aside id=\"deck-ats\"", 0, "aside"), at(grid, "</aside>", 0, "aside end"));
  assert.doesNotMatch(aside, /navigate\(|history\./, "a panel that routes is a second view");
  assert.match(aside, /zIndex: Z\.CONTENT/, "content, above the fan by tier");
  for (const name of ["PanelShell", "AtsReportPanel", "JobDetailPanel", "PanelDock", "PanelScrim"]) {
    assert.doesNotMatch(deckSrc, new RegExp(`\\b${name}\\b`), `the deck reaches the old overlay surface through ${name}`);
  }
});

test("⭐ two panels from TWO_PANEL_PX — where two EQUAL columns each hold a card — and the card never resizes on click", () => {
  const { minCard, gap, pad } = TWO_PANEL;
  assert.equal(TWO_PANEL_PX, 2 * minCard + gap + 2 * pad);
  // ⛔ A71 (10-03): two panels start EXACTLY where the horizontal deck starts. At 1176 > 1100 a band of
  // horizontal screens expanded the card alone and the report "did not open" — the owner saw it on production.
  assert.equal(TWO_PANEL_PX, FAN_SWITCH_PX, "two panels on EVERY horizontal deck, and only there");
  for (const vw of [FAN_SWITCH_PX, 1120, 1150, 1175]) assert.equal(twoPanelFor(vw), true, `${vw}: a horizontal deck without two panels`);
  assert.equal(twoPanelFor(TWO_PANEL_PX - 1), false);
  assert.equal(twoPanelFor(TWO_PANEL_PX), true);
  assert.equal(twoPanelFor(390), false);
  for (const vw of [TWO_PANEL_PX, 1150, 1280, 1366, 1440, 1920, 2560]) {
    const w = twoPanelColumn(vw);
    assert.ok(w >= minCard && w <= CARD.horizontal.width, `${vw}: column ${w}`);
    assert.ok(2 * w + gap <= Math.min(TWO_PANEL.maxWidth, vw - 2 * pad), `${vw}: two columns overflow`);
  }
  // One width at rest and open: the card IS a column wide, so opening only moves it.
  // ⭐ D152 (2), changed on purpose: Home's card is its own 5 : 7 size (homeCardSize) and never two-panel.
  assert.match(deckSrc, /const size = home \? homeCardSize\(viewportW\) : twoPanel \? \{ width: twoPanelColumn\(vw\), height: CARD\.horizontal\.height \} : cardSize\(orientation, vw\);/);
  assert.match(grid, /width: size\.width, flexShrink: 0/, "the report is as wide as its OPEN column from the first frame");
  // D32: + alignSelf stretch, so the column is the card's height and the report inside it can be STICKY.
  assert.match(grid, /data-deck-ats-col style=\{\{ minWidth: 0, overflowX: "clip", display: "flex", justifyContent: "flex-end", alignSelf: "stretch" \}\}/,
    "pinned to the card's side, so it is uncovered from behind the card — not wiped in from the screen's edge");
});

test("⛔ NARROW: the vertical fan stays, the signal line opens the report as a SHEET, and Esc closes the sheet first", () => {
  assert.match(deckSrc, /onSignal=\{\(\) => \(twoPanel \? setExpanded\(true\) : setSheet\(true\)\)\}/);
  assert.match(deckSrc, /\{sheet && !twoPanel && current && !current\.decision && \(\s*<AtsSheet/);
  const sheet = deckSrc.slice(at(deckSrc, "function AtsSheet", 0, "sheet"), at(deckSrc, "function CardFace", 0, "end"));
  assert.match(sheet, /role="dialog" aria-modal="true" aria-label="The ATS report"/);
  assert.match(sheet, /zIndex: Z\.MODAL_SCRIM/);
  assert.match(sheet, /zIndex: Z\.MODAL,/);
  assert.match(sheet, />\s*Close\s*<\/button>/);
  assert.match(deckSrc, /if \(k === "Escape"\) \{ if \(sheetRef\.current\) setSheet\(false\); else \{ setExpanded\(false\); setWhy\(false\); \}/);
});

test("⛔⭐ SWIPE IS DISABLED WHEN THE CARD IS EXPANDED — buttons only while reading", () => {
  assert.match(deckSrc, /drag=\{isFront && !expanded \? "x" : false\}/);
  assert.equal((deckSrc.match(/\bdrag=\{/g) || []).length, 1, "a second drag surface");
});

test("⛔ hidden content is INERT: the closed posting and the departed signal take no focus and no clicks", () => {
  assert.match(deckSrc, /const inertIf = \(hidden\) => \(hidden \? \{ inert: "", "aria-hidden": true \} : null\);/);
  assert.match(face, /<section id="deck-detail" aria-label="The posting" style=\{\{ minHeight: 0, overflow: "hidden" \}\} \{\.\.\.inertIf\(!open\)\}>/);
  // ⭐ D145: and the folded "Why this job" layer.
  assert.match(face, /<section id="deck-why" aria-label="Why this job" data-deck-why="" style=\{\{ minHeight: 0, overflow: "hidden" \}\} \{\.\.\.inertIf\(!deep\)\}>/);
});

test("⛔ the fan never scrolls the page sideways — clipped by `clip` on a full-width wrapper, never `hidden`", () => {
  const root = deckSrc.slice(at(deckSrc, '<MotionConfig reducedMotion="user">', 0, "root"), at(deckSrc, "<CardBackDefs />", 0, "content"));
  assert.match(root, /<div data-deck-clip style=\{\{ overflowX: "clip" \}\}>/);
  assert.doesNotMatch(root + grid, /overflowX?: "hidden"/, "a scroll container round the deck un-sticks the action row and Collapse");
});

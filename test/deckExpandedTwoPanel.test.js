// A40 (rebuilt 10-02) — the expanded card is TWO EQUAL PANELS: the full ATS report │ the card.
// docs/BRAND_OUTLAY_AND_MOTION.md §"THE EXPANDED CARD — DECIDED 2026-10-01" is authoritative. This
// REPLACES deckExpandedFlank.test.js, which pinned the first build (5935ba5, 043acf1): three columns,
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

const fanGeometry = await import("../client/src/lib/fanGeometry.js");
const { EXPAND_CLOCK } = fanGeometry;

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const deckSrc = codeOnly(read("client/src/panels/DeckView.jsx"));
const face = deckSrc.slice(at(deckSrc, "function CardFace", 0, "CardFace"), at(deckSrc, "const POSITION_EASE", 0, "end of face"));
// ⭐ D152 (8) (b), changed on purpose: the grid and its report column are deleted — the card's column is the deck.
const col = deckSrc.slice(at(deckSrc, "<div data-deck-col style", 0, "card column"), at(deckSrc, "<DecisionToast", 0, "toast"));
const geoSrc = codeOnly(read("client/src/lib/fanGeometry.js"));

test("⛔ TWO panels, not three: no third column, and the posting stays INSIDE the card", () => {
  for (const gone of ["FlankPanel", "expandedLayout", "THREE_COL_PX", 'id="deck-posting"', 'side="right"']) {
    assert.ok(!deckSrc.includes(gone) && !geoSrc.includes(gone), `the three-column build is back: ${gone}`);
  }
  // The posting is part of the card's face. D32: it is drawn by the posting half of the ink pair
  // (components/PostingPanel.jsx) — still inside the card, still the card's own section.
  assert.match(face, /<section id="deck-detail" aria-label="The posting"[\s\S]*?<CardPosting card=\{card\} \/>/);
  assert.match(deckSrc, /<PostingPanel job=\{card\.job\} experience=\{experience\} showTitle=\{false\}>/);
});

test("⭐ the fan and the action row live in the card's column", () => {
  assert.match(col, /data-deck-stage/, "the fan lives in the card's column");
  assert.match(col, /data-deck-actions/, "and so does the action row");
  // No per-card shift: nothing positions the card for the expansion.
  // ⭐ D152 (2), changed on purpose: Home's card turns about its lower-left corner (homeFanTransform); the arc is the rest.
  assert.match(deckSrc, /const t = plate \? plateFanTransform\(offset\) : home \? homeFanTransform\(offset, geometry\) : fanTransform\(offset, orientation, geometry\);/);
});

test("⛔ ONE CLOCK, NO STAGGER: every movement reads --deck-t / --deck-ease, set once; reduced motion zeroes it", () => {
  assert.match(deckSrc, /const ON_THE_CLOCK = "var\(--deck-t\) var\(--deck-ease\)";/);
  assert.match(deckSrc, /"--deck-t": reduced \? "0s" : EXPAND_CLOCK\.duration, "--deck-ease": EXPAND_CLOCK\.ease/);
  // ⭐ D145: the hover facts and "Why this job" ride the same clock (the signal row went to the header's match).
  assert.match(face, /data-deck-soft="" style=\{\{ display: "grid", gridTemplateRows: soft \? "1fr" : "0fr", opacity: soft \? 1 : 0,\s*transition: `grid-template-rows \$\{ON_THE_CLOCK\}, opacity \$\{ON_THE_CLOCK\}` \}\}/);
  assert.match(face, /data-deck-why-row="" style=\{\{ display: "grid", gridTemplateRows: deep \? "1fr" : "0fr", transition: `grid-template-rows \$\{ON_THE_CLOCK\}` \}\}/);
  assert.match(face, /data-deck-posting-row style=\{\{ display: "grid", gridTemplateRows: open \? "1fr" : "0fr", transition: `grid-template-rows \$\{ON_THE_CLOCK\}` \}\}/);
  // No delay anywhere in the expansion — a delayed panel read as two events in the sketch.
  const expansion = deckSrc.slice(at(deckSrc, "const ON_THE_CLOCK", 0, "clock"), at(deckSrc, "function FanCard", 0, "FanCard")) + col;
  assert.doesNotMatch(expansion, /delay/i, "a stagger (transition-delay, transitionDelay, a framer delay)");
  // The duration is the design's "in unison, a bit slowly": ~0.9–1.3 s, in ONE place.
  const s = parseFloat(EXPAND_CLOCK.duration);
  assert.ok(s >= 0.9 && s <= 1.3, `the clock is ${EXPAND_CLOCK.duration}`);
  assert.equal((deckSrc.match(/EXPAND_CLOCK\.duration/g) || []).length, 1, "the duration restated somewhere");
});

test("⭐ the collapsed card is COMPACT: ONE signal line, no chip rows", () => {
  assert.doesNotMatch(deckSrc, /WhyChips|Why it's here|Not on your résumé yet/, "a chip row on the collapsed card");
  // D129 / D124 (edc601a, owner 11-01): the counts read "N of M skills" — term counts, never a score. ⭐ D145 (changed on
  // purpose): they are the "Why this job" headline now (lib/deckCardFacts.js); the folded card says the match, the title
  // and ONE info row — no signal line, no chip row.
  assert.match(read("client/src/lib/deckCardFacts.js"), /`\$\{mTotal\} of \$\{total\} skills`/);
  assert.doesNotMatch(face, /<AtsSignal|<TrialMatch|signalShown/, "the old signal line on the card");
  // The full posting is headed by the collapsed score (the sticky column's phone answer) — ⭐ D152 (8): at every width.
  assert.match(face, /<CollapsedScore card=\{card\} onOpen=\{isFront \? onSignal : undefined\} \/>/);
});

test("⛔ D152 (8) (b): the report beside the card and the phone's sheet are DELETED — the match opens in the posting", () => {
  // A40's two equal panels and A40's sheet were the deck's report; option A (docs/sketches/ats-options.html) puts the
  // match inside the board's posting, and the deck lives only on Home, beside that board.
  for (const gone of ["function DeckAtsReport", "function AtsSheet", "data-deck-sheet", "data-deck-ats-col", 'id="deck-ats"',
                      "data-deck-grid", "twoPanel", "setSheet", "atsMounted", "TWO_PANEL", "<ATSPanel"]) {
    assert.ok(!deckSrc.includes(gone), `the deck's own report is back: ${gone}`);
  }
  for (const gone of ["TWO_PANEL", "TWO_PANEL_PX", "twoPanelFor", "twoPanelColumn"]) {
    assert.ok(!(gone in fanGeometry), `lib/fanGeometry.js still exports ${gone}`);
  }
  assert.doesNotMatch(deckSrc, /aria-controls="deck-ats"/, "a control pointing at a report that is not on the page");
  assert.match(deckSrc, /onSignal=\{\(\) => openMatchInPosting\(e\.card\.job\.id\)\}/);
  assert.match(deckSrc, /if \(k === "Escape"\) \{ setExpanded\(false\); setWhy\(false\); setLegend\(false\); \}/);
  for (const name of ["PanelShell", "AtsReportPanel", "JobDetailPanel", "PanelDock", "PanelScrim"]) {
    assert.doesNotMatch(deckSrc, new RegExp(`\\b${name}\\b`), `the deck reaches the old overlay surface through ${name}`);
  }
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
  assert.doesNotMatch(root + col, /overflowX?: "hidden"/, "a scroll container round the deck un-sticks the action row and Collapse");
});

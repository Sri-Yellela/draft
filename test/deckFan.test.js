// Queue 27 — the deck as a fan (docs/BRAND_OUTLAY_AND_MOTION.md §"THE DECK — DECIDED 2026-09-30").
// The geometry is pure (client/src/lib/fanGeometry.js), so its decisions are pinned as numbers here,
// including the in-frame arithmetic that chose `reach`. The view is pinned by source where a browser
// would be needed: the wheel/keyboard parity, the layer tiers, the reduced-motion paths, the back.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const { FAN, FAN_SWITCH_PX, CARD, cardSize, fanTransform, orientationFor } = await import("../client/src/lib/fanGeometry.js");
const { deckReducer, initialDeck, fanOrder, stepTarget, DECISIONS } = await import("../client/src/lib/deckState.js");
const { Z } = await import("../client/src/styles/zLayers.js");

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const deckSrc = codeOnly(read("client/src/panels/DeckView.jsx"));
const backSrc = codeOnly(read("client/src/components/CardBack.jsx"));

const card = (id, decision = null) => ({ position: 0, band: "strong", decision, job: { id, title: id, company: id }, why: {} });
const deck = (...cs) => initialDeck({ date: "2026-10-01", cards: cs });

// ── geometry ──────────────────────────────────────────────────────────────────────────────────
test("the front card is the card that shipped: square-on, full size, nothing shrinks", () => {
  for (const o of ["horizontal", "vertical"]) {
    assert.deepEqual(fanTransform(0, o), { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, shown: true, depth: 0 });
  }
  assert.deepEqual(cardSize("horizontal", 1440), { width: 700, height: 380 }, "the ~700×380 card");
});

test("⭐ the pivot and the card orientation move together — and the switch is a WIDTH", () => {
  assert.equal(FAN_SWITCH_PX, 1100, "a 700px card on an arc wants ~1100px");
  assert.equal(orientationFor(1100), "horizontal");
  assert.equal(orientationFor(1099), "vertical");
  // Pivot RIGHT, horizontal cards: later cards fall away BELOW, curving toward the pivot, turned to face it.
  const h = fanTransform(2, "horizontal");
  assert.ok(h.y > 0 && h.x > 0 && h.rotate < 0, JSON.stringify(h));
  // Pivot BELOW, vertical cards: later cards fall away to the RIGHT, curving down, like a hand.
  const v = fanTransform(2, "vertical");
  assert.ok(v.x > 0 && v.y > 0 && v.rotate > 0, JSON.stringify(v));
  // A narrow card is upright: the vertical card is never wider than it is tall.
  const m = cardSize("vertical", 390);
  assert.ok(m.width < m.height && m.width <= CARD.vertical.maxWidth);
});

test("the fan is symmetric, behind cards are pulled back, and `visible` cards show either side", () => {
  for (const o of ["horizontal", "vertical"]) {
    const g = FAN[o];
    const a = fanTransform(3, o), b = fanTransform(-3, o);
    assert.equal(a.rotate, -b.rotate);
    assert.equal(a.scale, g.zoom);
    assert.ok(fanTransform(g.visible, o).shown && fanTransform(g.visible, o).opacity > 0);
    assert.equal(fanTransform(g.visible + 1, o).shown, false);
    assert.equal(fanTransform(g.visible + 1, o).opacity, 0, "the fade reaches zero exactly past `visible`");
    assert.ok(fanTransform(1, o).opacity > fanTransform(2, o).opacity, "farther is fainter");
  }
});

test("⛔ reach (horizontal) is the largest that keeps the opening stack inside a 1440×900 frame", () => {
  // The constraint that chose 800, stated as arithmetic so a nudge has to argue with it. From the
  // first card every back falls BELOW: the 4th's bottom edge = front centre (~390px down) + its
  // offset + its rotated half-extent.
  const g = FAN.horizontal;
  const bottomOf = (reach) => {
    const t = fanTransform(g.visible, "horizontal", { ...g, reach });
    const a = Math.abs(t.rotate) * Math.PI / 180;
    const half = g.zoom * (CARD.horizontal.height / 2 * Math.cos(a) + CARD.horizontal.width / 2 * Math.sin(a));
    return 390 + t.y + half;
  };
  assert.ok(bottomOf(g.reach) <= 900, `the 4th card leaves the frame at ${bottomOf(g.reach).toFixed(0)}px`);
  assert.ok(bottomOf(g.reach + 100) > 900, "a larger reach would still fit — then it is not the edge of the constraint");
  assert.equal(g.spread, 7);
  assert.equal(g.zoom, 0.72);
});

test("⛔ reach (vertical) lets the first back clear the front card far enough to show its logo", () => {
  const g = FAN.vertical;
  const { width } = cardSize("vertical", 390);
  const t = fanTransform(1, "vertical");
  const peek = t.x + (g.zoom * width) / 2 - width / 2;   // how far the back shows past the front's edge
  assert.ok(peek >= 80, `the first back shows ${peek.toFixed(0)}px — its logo stays behind the front card`);
  const blind = fanTransform(1, "vertical", { ...g, zoom: 0.72, reach: 900 });
  assert.ok(blind.x + (0.72 * width) / 2 - width / 2 < 40, "the briefed 0.72/900 shows only an edge on a phone — the reason it moved");
});

// ── the rotation ──────────────────────────────────────────────────────────────────────────────
test("stepping rotates to the next UNDECIDED card and stops at the ends (so the page scrolls again)", () => {
  let s = deck(card("a"), card("b", "drafted"), card("c"), card("d"));
  assert.equal(stepTarget(s, -1), null, "nothing before the first");
  assert.equal(stepTarget(s, 1), 2, "the decided card is skipped — it has left the fan");
  s = deckReducer(s, { type: "step", dir: 1 });
  s = deckReducer(s, { type: "step", dir: 1 });
  assert.equal(s.index, 3);
  assert.equal(stepTarget(s, 1), null);
  assert.equal(deckReducer(s, { type: "step", dir: 1 }), s, "a step past the end changes nothing");
});

test("the fan holds the undecided cards only, each with its offset from the front", () => {
  let s = deck(card("a"), card("b"), card("c"), card("d"));
  s = deckReducer(s, { type: "step", dir: 1 });
  assert.deepEqual(fanOrder(s).map(e => [e.card.job.id, e.offset]), [["a", -1], ["b", 0], ["c", 1], ["d", 2]]);
  s = deckReducer(s, { type: "decide", decision: DECISIONS.PASSED });
  assert.deepEqual(fanOrder(s).map(e => [e.card.job.id, e.offset]), [["a", -1], ["c", 0], ["d", 1]], "the fan closes up");
});

// ── the view ──────────────────────────────────────────────────────────────────────────────────
test("⛔ layering by NAMED tier: --z-bg < --z-fan < --z-content < --z-nav, and no zIndex literal in the deck", () => {
  assert.ok(Z.BG < Z.FAN && Z.FAN < Z.CONTENT && Z.CONTENT < Z.NAV);
  const literals = deckSrc.match(/zIndex:\s*-?\d/g) || [];
  assert.deepEqual(literals, [], "a z-index number someone can nudge");
  assert.match(deckSrc, /zIndex: isFront \? Z\.CONTENT : Z\.FAN - t\.depth/, "only the face-up card rises into content");
  // ⭐ D145: and it lifts above the risen Dock (--appnav-lift, AppNav.jsx).
  assert.match(deckSrc, /data-deck-actions style=\{\{ position: "sticky", bottom: "calc\(16px \+ var\(--appnav-lift, 0px\)\)", transition: "bottom \.3s ease", zIndex: Z\.NAV/, "the action row sticks, above the fan");
  const paper = codeOnly(read("client/src/components/PaperBackground.jsx"));
  assert.match(paper, /zIndex: Z\.BG/);
  assert.doesNotMatch(paper, /-z-10/, "the substrate's old Tailwind literal");
});

test("⛔ scroll capture is paid back: the keyboard does everything the wheel does, and the ends release the page", () => {
  const wheel = deckSrc.slice(at(deckSrc, "const onWheel = (e) =>", 0, "wheel handler"), at(deckSrc, 'el.addEventListener("wheel"', 0, "wheel listener"));
  // ⭐ D145 (changed on purpose): over the FRONT card a vertical flick opens / folds "Why this job" first (its own capture,
  // test/d145DeckCardNav.test.js); every OTHER capture — turning the fan — still waits until a rotation is possible.
  const fan = wheel.slice(wheel.indexOf("if (whyRef.current) return;"));
  assert.ok(fan.indexOf("stepTarget(stateRef.current, dir) == null") < fan.indexOf("e.preventDefault()"),
    "the wheel is only captured AFTER a rotation is known to be possible");
  assert.match(wheel, /if \(expandedRef\.current \|\| e\.ctrlKey\) return;/, "reading an expanded card, or pinch-zooming, scrolls the page");
  assert.match(deckSrc, /addEventListener\("wheel", onWheel, \{ passive: false \}\)/);
  assert.match(wheel, /step\(dir\)/, "one flick rotates one card");
  for (const k of ['k === "j"', 'k === "k"', 'k === "ArrowDown"', "Enter", "Escape"]) assert.ok(deckSrc.includes(k), `no key for ${k}`);
  assert.match(deckSrc, /aria-label=\{dir < 0 \? "Previous card" : "Next card"\}/, "a visible control rotates it without wheel or keyboard");
});

test("⛔ every motion honours prefers-reduced-motion — framer through ONE config, the CSS ones by the same switch", () => {
  assert.equal((deckSrc.match(/<MotionConfig/g) || []).length, 1);
  assert.match(deckSrc, /const reduced = useReducedMotion\(\)/);
  const css = deckSrc.match(/transition: reduced \? "none" :/g) || [];
  assert.equal(css.length, 2, "the fan's position and the flip are CSS transitions, and both stop for reduced motion");
});

test("⭐ the flip and the rotation are compositor-only: transform and opacity, nothing that lays out", () => {
  const pos = deckSrc.slice(at(deckSrc, "data-fan-position", 0, "position layer"), at(deckSrc, "<motion.div\n          drag=", 0, "drag layer"));
  assert.match(pos, /transition: reduced \? "none" : `transform \d+ms \$\{POSITION_EASE\}, opacity \d+ms ease`/);
  const flip = deckSrc.slice(at(deckSrc, "<div data-flip", 0, "flip layer"), at(deckSrc, "<article ref=", 0, "the face"));
  assert.match(flip, /transform: `perspective\(1800px\) rotateY\(\$\{faceUp \? 0 : 180\}deg\)`/);
  assert.match(flip, /transition: reduced \? "none" : `transform \d+ms/);
});

test("⛔ expansion is the detail: the posting opens INSIDE the card, and Draft never sends a review-less run", () => {
  assert.doesNotMatch(deckSrc, /<Detail\b/, "a separate detail block under the card");
  assert.match(deckSrc, /<section id="deck-detail" aria-label="The posting"/, "the posting grows inside the card (A40)");
  assert.match(deckSrc, /aria-expanded=\{!!expanded\} aria-controls="deck-detail"/);
  assert.doesNotMatch(deckSrc, /approvalMode/);
});

test("⛔ the back carries the company's LOGO, tinted by the ACCENT token — never a letter, never a name", () => {
  assert.match(backSrc, /<feFlood floodColor=\{C\.ACCENT\}/);
  assert.match(backSrc, /filter: `url\(#\$\{LOGO_FILTER_ID\}\)`/);
  assert.doesNotMatch(backSrc, /\{company\}|\[0\]\.toUpperCase|letter/i, "a lettered placeholder on the back");
  assert.match(backSrc, /onError=\{\(e\) => \{ e\.currentTarget\.style\.display = "none"; \}\}/, "a dead logo leaves the weave, not a broken image");
});

test("⛔ the deal plays once per DAY: only when the server says this request dealt", () => {
  assert.match(deckSrc, /setDealing\(!!deck\.dealtNow\)/);
  assert.doesNotMatch(deckSrc, /setDealing\(true\)/, "a deal on every navigation means nothing");
});

test("⭐ the end of the deck is a moment: what you drafted, what awaits review, and that is it until tomorrow", () => {
  const end = deckSrc.slice(at(deckSrc, "function EndOfDeck", 0, "end"), at(deckSrc, "export default function DeckView", 0, "view"));
  assert.match(end, /aria-label="Drafted today"/);
  assert.match(end, /needsReview/);
  assert.match(end, /until tomorrow/);
  assert.match(end, /untilTomorrow\(\)/);
});

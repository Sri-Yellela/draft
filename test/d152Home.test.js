// ⭐ D152 (1) · HOME (owner 11-04, home-sketch.html approved): the Daily Deck and Full House become ONE screen — the deck
// on the left, the filtering sentence, search, counts and every job on the right; no page titles. Laid out by CSS
// (D153 (1)): one grid, the deck's column sticky in its own track; one column on a phone with the deck first.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const APP = read("client/src/App.jsx");
const CSS = read("client/src/components/FullHouse.css");
const DECK = read("client/src/panels/DeckView.jsx");

test("d152OneHomeScreen: /app and /app/jobs both draw the one Home grid — the deck, then the board", () => {
  assert.match(APP, /const home = activeTab === "today" \|\| activeTab === "console";/);
  // 47f: since 47e (D196 P1) the deck and the board are built ONCE as elements (homeDeck, homeBoard) that both the classic
  // grid and the plate market render; the grid draws them in that order, and the pieces live in the two elements.
  assert.ok(APP.includes('<div className="home" data-home="">{homeDeck}{homeBoard}</div>'), "the deck's column comes before the board's");
  const body = APP.slice(at(APP, "const homeDeck = ("), at(APP, "    <JobBoardProvider>"));
  assert.ok(body.indexOf("<DeckView") < body.indexOf("<JobsConsole"), "the deck's element is built before the board's");
  assert.match(body, /<DeckView canUseAPlusResume=\{canUseAPlusResumeHere\} home\/>/);
  for (const part of ["<BoardHeadlineSlot />", "<BoardBar />", "<BoardCounts />", "<JobsConsole"]) assert.ok(body.includes(part), part);
  // no second copy of either screen outside Home
  assert.equal(APP.split("<DeckView").length - 1, 1, "DeckView is drawn once");
  assert.equal(APP.split("<JobsConsole").length - 1, 1, "the board is drawn once");
});

test("d152OneHomeScreen: no page title on Home — the Full House title is not drawn there", () => {
  // ⭐ D156 (5) changed this on purpose: the title row that held only the "Sort: For you" word is gone with it — the sort
  // is an icon inside the search field (test/d156Home.test.js d156SortIconInSearch).
  assert.doesNotMatch(APP, /BoardTitleRow|fh-title__h|Full House<\/p>/);
});

test("d152 (1) · the grid is CSS — the deck's 390 column sticky in its track, one column at 980 and under", () => {
  const i = CSS.lastIndexOf("D152 (1) · HOME");
  assert.ok(i > 0);
  const block = CSS.slice(i);
  // ⭐ D156 (2) changed the numbers on purpose ("use less margins"): 40 apart (was 56), 1600 wide (was 1440).
  // ⭐ D163 changed them again on purpose ("use the space"): the gap and the gutters grow with the screen (clamp()), the
  // content 1680 wide at most, centred (test/d163UseTheSpace.test.js); below 1440 the deck's track is still `auto`.
  assert.match(block, /\.home \{ --home-gutter: [^;]+; --home-gap: [^;]+;\n  display: grid; grid-template-columns: var\(--home-deck-track, auto\) minmax\(0, 1fr\); gap: var\(--home-gap\);\n  max-width: none;/); // ⭐ 46q FULL WIDTH (owner 11-16): no 1680 cap — moved on purpose
  assert.match(block, /\.home__deck \{ position: sticky;[^}]*width: 390px; \}/);
  assert.match(block, /@media \(max-width: 980px\) \{\n  \.home \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(DECK, /export const HOME_DECK_COLUMN = 390;/);
  assert.match(DECK, /const orientation = home \? "vertical" : orientationFor\(vw\);/, "the card-shaped layout at every width");
  // ⭐ D152 (8) (b), changed on purpose: the report beside the card is deleted outright, not switched off on Home.
  assert.doesNotMatch(DECK, /twoPanel/, "no report beside the card inside the column");
});

test("d152DockHomeEntry: one Home entry in place of the Daily Deck and Full House", () => {
  assert.match(APP, /\{ id: "today",\s+label: "Home" \},/);
  assert.doesNotMatch(APP, /label: "Daily Deck"|label: "Full House"/);
  assert.match(APP, /activeTab=\{home \? "today" : activeTab\}/, "Home is the current entry on /app/jobs too");
});

test("d152DockLeftWithLogo / d153DockPushes / d152DockSlidesFromLeftEdge (real Chrome, 1280 and 390)", { timeout: 200000 }, (t) => {
  const out = fidelityProbe("home");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.title, false, `${size}: no page title`);
    assert.equal(d.cornerMark, false, `${size}: no logo in the page corner`);
    // ⭐ D156 (3) changed these on purpose: the dock is an always-visible rail of icons — no embossed logo, no edge handle,
    // nothing off the left edge at rest; it expands on hover / focus and the page moves over (test/d156Home.test.js).
    assert.equal(d.emboss, null, `${size}: no embossed logo`);
    // ⭐ D167 (owner 11-06, changed on purpose): six places — + Interview, and Ask draft after the divider.
    // 45n (pin brought to the code in 45o): the dock's search icon comes first.
    // ⭐ owner 11-15: Tiny replaces Ask draft, floating (changed on purpose) — "ask" left the dock (a fox bubble instead).
    assert.deepEqual(d.items, ["search", "today", "auto-apply", "atlas", "interview", "profile"], `${size}: search · draft · Home · Atlas · Interview · Profile`);
    assert.equal(d.current, "today");
    assert.ok(d.rest.dock.left >= 0 && d.rest.dock.width > 0, `${size}: the rail is on screen at rest`);
    assert.equal(d.out.coversDeck, false, `${size}: the dock never covers the deck`);
    assert.equal(d.out.coversSentence, false, `${size}: the dock never covers the sentence`);
  }
  assert.equal(out.desktop.grid.columns.split(" ").length, 2, "two columns on a computer");
  assert.equal(out.desktop.grid.deck.width, 390);
  assert.ok(out.desktop.grid.deck.right <= out.desktop.grid.board.left, "the deck's column and the board's never overlap");
  assert.equal(out.phone.grid.columns.split(" ").length, 1, "one column on a phone");
  assert.ok(out.phone.grid.deck.bottom <= out.phone.grid.board.top, "d152PhoneOrderDeckThenPostings");
  assert.equal(out.phone.handle, false, "D156 (3): no edge handle — the rail is always there");
  // ⭐ D152 (2) / D153 (1): the card is card-shaped, its fan sweeps to the lower right inside the deck's column, and the
  // sweep never covers Pass · Save · Draft or the board.
  for (const [size, d] of Object.entries(out)) {
    const { card, backs, acts } = d.deck;
    assert.ok(Math.abs(card.width / (card.bottom - card.top) - 5 / 7) < 0.01, `${size}: d152CardFiveBySeven (${card.width} × ${card.bottom - card.top})`);
    const shown = backs.filter(b => b && Number(b.opacity) > 0);
    assert.deepEqual(shown.map(b => b.rotate), ["5", "10"], `${size}: two backs, turned 5° and 10°`);
    for (const b of shown) {
      assert.equal(b.left, card.left, `${size}: d152FanLowerRight — back ${b.n} turns about the card's lower-left corner`);
      assert.ok(b.right > card.right && b.bottom > card.bottom, `${size}: back ${b.n} sweeps right and down`);
    }
    assert.equal(d.deck.backsCoverButtons, false, `${size}: d153FanNeverCoversButtons`);
    assert.equal(d.deck.backsCoverBoard, false, `${size}: the fan never reaches the board's column`);
    assert.equal(d.deck.backsOutsideColumn, false, `${size}: the fan stays inside the deck's column (no clipped edge)`);
    assert.equal(acts.width, card.width, `${size}: the buttons as wide as the card`);
  }
  assert.deepEqual([out.desktop.deck.card.width, out.desktop.deck.card.bottom - out.desktop.deck.card.top], [300, 420]);
  // ⭐ D152 (5): two columns of bubbles that make room for each other; no old ATS square on any bubble.
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.pairs.atsSquare, false, `${size}: d152NoOldAtsBox`);
    assert.equal(d.pairs.perPair, 2, `${size}: the postings in pairs`);
    assert.equal(d.pairs.options, "visible", `${size}: d152HoverShowsOptions — a hovered / focused bubble shows its options`);
    assert.deepEqual(d.pairs.focusH, d.pairs.restH, `${size}: giving way never changes the line's height`);
  }
  const P = out.desktop.pairs;
  assert.equal(P.restW[0], P.restW[1], "d152TwoColumnResizingBubbles: equal at rest");
  assert.ok(P.focusW[0] > P.restW[0] && P.focusW[1] < P.restW[1], `the focused bubble grows and its neighbour gives way (${P.focusW})`);
  assert.ok(Math.abs(P.focusW[0] + P.focusW[1] - P.restW[0] - P.restW[1]) <= 1, "within the same line");
  assert.equal(out.phone.pairs.restW[0], out.phone.pairs.focusW[0], "a phone stacks the pair — nothing to give way to");
  // ⭐ D156 (1c) (changed on purpose — D152 (6) / D153 (1)'s posting in place of the list is removed): a bubble's posting
  // opens ON THE DECK, in the front card's place, on a computer (a phone keeps the full-screen posting); the list stays.
  const O = out.desktop.opened;
  assert.ok(O.post && O.onDeck && O.inDeck, "d156ListPostingOpensOnDeck — the posting is drawn in the deck's column");
  assert.equal(O.listShown, true, "the list beside it stays"); assert.equal(O.boardPost, false, "d156NoSeparatePostingPanel");
  assert.equal(O.coversBoard, false, "the posting never covers the board");
  // ⭐ D152 (8) · option A: the match opens IN the posting, under the facts, and folds again — no overlay, no blur.
  for (const [size, d] of Object.entries(out)) {
    const m = d.opened.match;
    assert.equal(m.opened, "true", `${size}: d152AtsTogglesFromMatchBox — the match box opens it`);
    assert.ok(m.height > 0 && m.underFacts, `${size}: d152AtsInlineUnderFacts (${m.height} px under the facts)`);
    assert.equal(m.eyebrow, "Your résumé against this job");
    assert.equal(m.overlay, false, `${size}: d152AtsNoOverlayNoBlur — no separate panel`);
    assert.equal(m.blur, false, `${size}: … and nothing blurred`);
    assert.deepEqual([m.folded, m.foldedHeight, m.foldedInert], ["false", 0, true], `${size}: pressing it again folds it`);
  }
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.closed.sameListNode, true, `${size}: d153OpenPostingNoRemount — the list's node survives an open / close`);
    assert.equal(d.closed.post, false, `${size}: closed`);
    // ⭐ D156 (1c): on the deck, folding returns the reader to where they were (DeckView keeps it); a phone's overlay never moved it.
    assert.equal(d.closed.yAfter, d.closed.yBefore, `${size}: the reader returned on fold (${d.closed.yBefore} → ${d.closed.yAfter})`);
  }
});

test("d153 (1) · no panel placed by JS offsets: BesideDock is gone; the in-place layers and the column swap are CSS", () => {
  const PANEL = read("client/src/panels/JobsPanel.jsx");
  const BUB = read("client/src/components/JobBubble.jsx");
  assert.doesNotMatch(PANEL, /BesideDock|BESIDE_TOP|addEventListener\("scroll"/, "d153NoScrollPositionListeners");
  // ⭐ D156 (1c) (changed on purpose): the board's column has no posting layer any more — the posting is drawn on the deck.
  assert.match(BUB, /export function JobBoardColumns\(\{ children \}\) \{\n  return \(\n    <div className="jb-board">\n      <div className="jb-board__list">\{children\}<\/div>/);
  assert.doesNotMatch(CSS, /\[data-board-post\]/);
});

test("d152 (5) · the bubbles' source: pairs from JobBubbleRows, one column beside an open posting, no ATS square", () => {
  const BUB = read("client/src/components/JobBubble.jsx");
  const PANEL = read("client/src/panels/JobsPanel.jsx");
  const CSSB = read("client/src/components/JobBubble.css");
  assert.match(BUB, /export function JobBubbleRows\(\{ jobs, children, columns = 2 \}\)/);
  assert.doesNotMatch(BUB, /jb__sq--ats|onAts/, "the old ATS square and its handler are gone");
  assert.match(PANEL, /<JobBubbleRows jobs=\{jobs\} columns=\{2\}>/);
  // ⭐ D156 (1b) changed this on purpose: D1's growth — only the hovered one grows (1.55), the neighbour is not squeezed.
  assert.match(CSSB, /\.jb-pair \.jb:hover, \.jb-pair \.jb:focus-within \{ flex-grow: 1\.55;/);
  assert.doesNotMatch(CSSB, /\.jb-pair:hover \.jb \{ flex-grow: \.75; \}/);
});

test("d152 (2) · Home's card size and fan transform (pure)", async () => {
  const { HOME_CARD, HOME_FAN, homeCardSize, homeFanTransform } = await import("../client/src/lib/fanGeometry.js");
  assert.deepEqual(homeCardSize(1280), { width: 300, height: 420 });
  assert.deepEqual(homeCardSize(390), { width: 250, height: 350 }, "D156: the phone column (390 less the rail and gutters, 310) less the fan's 60, at 5 : 7");
  assert.equal(HOME_FAN.visible, 2);
  assert.deepEqual(homeFanTransform(0), { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, shown: true, depth: 0, origin: "0% 100%" });
  assert.deepEqual([1, 2, 3].map(n => [homeFanTransform(n).rotate, homeFanTransform(n).shown]), [[5, true], [10, true], [0, false]]);
  assert.equal(homeFanTransform(-1).shown, false, "a passed card is gone, not fanned behind");
  assert.equal(homeFanTransform(2).origin, "0% 100%");
  // the 10° back's corners: top-right moves ≤ 90 px right (the column's spare), bottom-right drops < the 84 px gap
  const r = (10 * Math.PI) / 180;
  assert.ok(HOME_CARD.height * Math.sin(r) + HOME_CARD.width * (Math.cos(r) - 1) <= 390 - HOME_CARD.width);
  assert.ok(HOME_CARD.width * Math.sin(r) < HOME_CARD.below);
});

// ⭐ D152 (3) · ONE RANKING FEEDS THE DECK — the best-bets reading orders the deck and is its reason line.
test("d152DeckFromBestBets: the 'best' read orders the frozen deal by each card's best-bets score, the dealt position breaking ties", async () => {
  const { orderByBest, DECK_ORDERS } = await import("../services/dailyDraft.js");
  assert.ok(DECK_ORDERS.includes("best"));
  const cards = [
    { position: 0, job: { id: "a" }, bestBet: { score: 40 } },
    { position: 1, job: { id: "b" }, bestBet: { score: 90 } },
    { position: 2, job: { id: "c" }, bestBet: null },
    { position: 3, job: { id: "d" }, bestBet: { score: 90 } },
  ];
  assert.deepEqual(orderByBest(cards).map(c => c.job.id), ["b", "d", "a", "c"], "scored first, a card with no fit yet last");
  const srv = read("server.js");
  const route = srv.slice(at(srv, 'app.get("/api/draft/today"'), at(srv, "// GET /api/company-logo/:key"));
  assert.match(route, /const betFor = \(job\) => bestBetOf\(bestBetSignalsFor\(db, \{ userId: req\.user\.id, profileId: profile\.id, job: \{ id: job\.id \}, \.\.\.betInputs \}\)\);/,
    "the route reads each card through the ONE best-bets function");
  assert.match(route, /todaysDeck\(db, \{[^}]*betFor, warmBets, resumeText, refresh: false \}\)/);   // D151: warmBets (the read pool)
  const order = read("client/src/lib/deckOrder.js");
  assert.match(order, /catch \{ return "best"; \}/, "best bets is the deck's default order");
});

test("d152NoSeparateBestBetsList: no separate best-bets list; the count line (the reason line left the card in D156)", async () => {
  // ⭐ D156 (1b) changed this on purpose (owner 11-05: "theres a stat saying skills matched, dont need the sentence above
  // it"): the reason line is gone from the card — test/d156Home.test.js d156NoReasonSentence.
  const { cardFacts } = await import("../client/src/lib/deckCardFacts.js");
  assert.equal(cardFacts({ job: { id: "x" }, bestBet: { reasons: ["you're eligible"] } }).reason, undefined);
  assert.ok(!fs.existsSync("client/src/components/BestBets.jsx"));
  assert.doesNotMatch(read("client/src/panels/JobsPanel.jsx"), /<BestBets\b|bestBets=/);
  assert.doesNotMatch(DECK, /facts\.reason/);
  assert.match(DECK, /of \{s\.size\} today · \{deckOrder === "best" \? "best match first"/, "the sketch's count line");
});

// ⭐ D152 (7b) (owner 11-04: "that label design wherever in the site get rid of it"): the label chip — a tinted rectangle
// with a coloured 3px left bar and heavy italic text — is retired everywhere it was drawn: the two mark twins (.mark,
// markStyle) and the four own copies (résumé ready, a posting's tag, The Table's status, Customise's tag).
test("d152NoLabelChipComponent / d152StateAsWordOrDotWord: no label chip anywhere; a state is a word with a 6px dot", () => {
  const RULES = [
    ["client/src/components/DepthButton.css", ".mark {"], ["client/src/components/JobBubble.css", ".jb__ready {"],
    ["client/src/components/PostingPanel.css", ".posting__pill {"], ["client/src/components/ApplicationHistory.css", ".ah__status {"],
    ["client/src/components/Customise.css", ".cz-opt__tag {"],
  ];
  for (const [file, sel] of RULES) {
    const css = read(file);
    const rule = css.slice(at(css, sel), at(css, "}", at(css, sel)) + 1);
    assert.doesNotMatch(rule, /border-left:\s*3px|800 italic|color-mix\(/, `${file} ${sel}: the chip's bar, face or tint`);
  }
  const mark = read("client/src/styles/mark.js");
  const fn = mark.slice(at(mark, "export function markStyle("), at(mark, "export function bandMarkStyle("));
  assert.doesNotMatch(fn, /borderLeft|color-mix|fontStyle: "italic"/, "the inline twin draws no chip either");
  assert.match(fn, /radial-gradient\(circle at 3px 50%/, "a state's dot");
});

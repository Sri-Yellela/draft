// ⭐ D152 (1) · HOME (owner 11-04, home-sketch.html approved): the Daily Deck and Full House become ONE screen — the deck
// on the left, the filtering sentence, search, counts and every job on the right; no page titles. Laid out by CSS
// (D153 (1)): one grid, the deck's column sticky in its own track; one column on a phone with the deck first.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const APP = read("client/src/App.jsx");
const CSS = read("client/src/components/FullHouse.css");
const DECK = read("client/src/panels/DeckView.jsx");

test("d152OneHomeScreen: /app and /app/jobs both draw the one Home grid — the deck, then the board", () => {
  assert.match(APP, /const home = activeTab === "today" \|\| activeTab === "console";/);
  // 47f: since 47e (D196 P1) the deck and the board are built ONCE as elements (homeDeck, homeBoard) that both the classic
  // grid and the plate market render; the grid draws them in that order, and the pieces live in the two elements.
  // 47j R2 (changed on purpose): the classic grid is deleted — the plate market's one section draws the deck, then the board
  assert.ok(APP.includes("<MarketSectionSlot deck={homeDeck} index={homeBoard} />"), "the deck comes before the board");
  assert.ok(!APP.includes('<div className="home" data-home="">'), "the classic grid is back");
  const body = APP.slice(at(APP, "const homeDeck = ("), at(APP, "    <JobBoardProvider>"));
  assert.ok(body.indexOf("<DeckView") < body.indexOf("<JobsConsole"), "the deck's element is built before the board's");
  assert.match(body, /<DeckView canUseAPlusResume=\{canUseAPlusResumeHere\} home\/>/);
  for (const part of ["<BoardViews ", "<JobsConsole"]) assert.ok(body.includes(part), part);
  assert.ok(APP.slice(at(APP, "function MarketSectionSlot(")).includes("<BoardHeadlineSlot />"), "the sentence heads the one section");
  for (const gone of ["<BoardBar />", "<BoardCounts />"]) assert.ok(!APP.includes(gone), `${gone} is back (47j R2)`);
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
  // 47j R2 (changed on purpose): the classic grid (`.home`) is deleted; the deck's section rules stay (the plate market wears them)
  assert.doesNotMatch(block, /(^|\n)\s*\.home \{/, "the classic grid is back");
  assert.match(block, /\.home__deck \{ position: sticky;[^}]*width: 390px; \}/);
  assert.match(block, /@media \(max-width: 980px\) \{\n  \.home__deck \{ position: static;/);
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

// ⛔ 47j R2: the real-Chrome half (probe `home`, the classic grid at ?plate=0) is retired with the classic market; the dock is
// measured on the plate market by d167Dock and d163OtherScreens (route `market`).
test("d153 (1) · no panel placed by JS offsets: BesideDock is gone; the in-place layers and the column swap are CSS", () => {
  const PANEL = read("client/src/panels/JobsPanel.jsx");
  const BUB = read("client/src/components/JobBubble.jsx");
  assert.doesNotMatch(PANEL, /BesideDock|BESIDE_TOP|addEventListener\("scroll"/, "d153NoScrollPositionListeners");
  // ⭐ D156 (1c) (changed on purpose): the board's column has no posting layer any more — the posting is drawn on the deck.
  assert.match(BUB, /export function JobBoardColumns\(\{ children \}\) \{\n  return \(\n    <div className="jb-board">\n      <div className="jb-board__list">\{children\}<\/div>/);
  assert.doesNotMatch(CSS, /\[data-board-post\]/);
});

// 47j R2 (changed on purpose): the classic bubble rows (JobBubbleRows, D152 (5)) are deleted from the board — the Index
// (MarketIndexTable) draws its rows; JobBubble.jsx keeps JobBoardColumns.
test("d152 (5) → 47j R2 · the bubble rows are deleted from the board; the Index draws the rows", () => {
  const PANEL = read("client/src/panels/JobsPanel.jsx");
  assert.doesNotMatch(PANEL, /<JobBubbleRows\b|<JobBubble\b/);
  assert.match(PANEL, /<MarketIndexTable\b/);
  assert.doesNotMatch(read("client/src/components/JobBubble.css").replace(/\/\*[\s\S]*?\*\//g, ""), /\.jb-pair\b/);
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
  // 47j R2 (changed on purpose): the classic count line is deleted — the plate position row says the same, in its type
  assert.match(DECK, /\{at\} OF \{of\} TODAY · \{order === "best" \? "BEST MATCH FIRST"/, "the count line");
});

// ⭐ D152 (7b) (owner 11-04: "that label design wherever in the site get rid of it"): the label chip — a tinted rectangle
// with a coloured 3px left bar and heavy italic text — is retired everywhere it was drawn: the two mark twins (.mark,
// markStyle) and the four own copies (résumé ready, a posting's tag, The Table's status, Customise's tag).
test("d152NoLabelChipComponent / d152StateAsWordOrDotWord: no label chip anywhere; a state is a word with a 6px dot", () => {
  const RULES = [
    ["client/src/components/DepthButton.css", ".mark {"],   // 47j A248: JobBubble.css's .jb__ready left with the card
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

// ⭐ D152 (1) · HOME (owner 11-04, home-sketch.html approved): the Daily Deck and Full House become ONE screen — the deck
// on the left, the filtering sentence, search, counts and every job on the right; no page titles. Laid out by CSS
// (D153 (1)): one grid, the deck's column sticky in its own track; one column on a phone with the deck first.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const APP = read("client/src/App.jsx");
const CSS = read("client/src/components/FullHouse.css");
const DECK = read("client/src/panels/DeckView.jsx");

test("d152OneHomeScreen: /app and /app/jobs both draw the one Home grid — the deck, then the board", () => {
  assert.match(APP, /const home = activeTab === "today" \|\| activeTab === "console";/);
  const grid = APP.slice(at(APP, '<div className="home" data-home="">'));
  const end = grid.indexOf("</div>\n            )}");
  const body = grid.slice(0, end);
  assert.ok(body.indexOf("<DeckView") < body.indexOf("<JobsConsole"), "the deck's column comes before the board's");
  assert.match(body, /<DeckView canUseAPlusResume=\{canUseAPlusResumeHere\} home\/>/);
  for (const part of ["<BoardHeadlineSlot />", "<BoardBar />", "<BoardCounts />", "<JobsConsole"]) assert.ok(body.includes(part), part);
  // no second copy of either screen outside Home
  assert.equal(APP.split("<DeckView").length - 1, 1, "DeckView is drawn once");
  assert.equal(APP.split("<JobsConsole").length - 1, 1, "the board is drawn once");
});

test("d152OneHomeScreen: no page title on Home — the Full House title is not drawn there", () => {
  const row = APP.slice(at(APP, "function BoardTitleRow("));
  assert.match(row.slice(0, 600), /\{!home && <p className="fh-title__h">Full House<\/p>\}/);
  assert.match(APP, /<BoardTitleRow home \/>/);
});

test("d152 (1) · the grid is CSS — the deck's 390 column sticky in its track, one column at 980 and under", () => {
  const i = CSS.lastIndexOf("D152 (1) · HOME");
  assert.ok(i > 0);
  const block = CSS.slice(i);
  assert.match(block, /\.home \{ display: grid; grid-template-columns: auto minmax\(0, 1fr\); gap: 56px; max-width: 1440px;/);
  assert.match(block, /\.home__deck \{ position: sticky;[^}]*width: 390px; \}/);
  assert.match(block, /@media \(max-width: 980px\) \{\n  \.home \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(DECK, /export const HOME_DECK_COLUMN = 390;/);
  assert.match(DECK, /const orientation = home \? "vertical" : orientationFor\(vw\);/, "the card-shaped layout at every width");
  assert.match(DECK, /const twoPanel = home \? false : twoPanelFor\(vw\);/, "no report beside the card inside the column");
});

test("d152DockHomeEntry: one Home entry in place of the Daily Deck and Full House", () => {
  assert.match(APP, /\{ id: "today",\s+label: "Home" \},/);
  assert.doesNotMatch(APP, /label: "Daily Deck"|label: "Full House"/);
  assert.match(APP, /activeTab=\{home \? "today" : activeTab\}/, "Home is the current entry on /app/jobs too");
});

test("d152DockLeftWithLogo / d153DockPushes / d152DockSlidesFromLeftEdge (real Chrome, 1280 and 390)", { timeout: 200000 }, (t) => {
  const out = JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", "home"],
    { encoding: "utf8", timeout: 180000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.title, false, `${size}: no page title`);
    assert.equal(d.cornerMark, false, `${size}: no logo in the page corner`);
    assert.equal(d.emboss, "draft", `${size}: the logo is embossed on the dock`);
    assert.deepEqual(d.items, ["today", "auto-apply", "atlas", "profile"], `${size}: Home · Draft House · Atlas · Profile`);
    assert.equal(d.current, "today");
    assert.ok(d.rest.dock.right <= 0, `${size}: the dock is off the left edge at rest (${d.rest.dock.right})`);
    assert.ok(d.out.dock.left >= 0 && d.out.open === "true", `${size}: the pointer at the left edge brings it out`);
    assert.equal(d.out.padLeft, "268px", `${size}: the page moves over to make room`);
    assert.equal(d.out.coversDeck, false, `${size}: the dock never covers the deck`);
    assert.equal(d.out.coversSentence, false, `${size}: the dock never covers the sentence`);
    assert.equal(d.rest.sortCoversSentence, false, `${size}: d153 (1) the Sort box never sits on the sentence`);
    assert.equal(d.out.sortCoversSentence, false, `${size}: … nor with the dock out (the column narrower)`);
    assert.ok(d.afterEsc.dock.right <= 0 && d.afterEsc.open === null, `${size}: Esc puts it away`);
  }
  assert.equal(out.desktop.grid.columns.split(" ").length, 2, "two columns on a computer");
  assert.equal(out.desktop.grid.deck.width, 390);
  assert.ok(out.desktop.grid.deck.right <= out.desktop.grid.board.left, "the deck's column and the board's never overlap");
  assert.equal(out.phone.grid.columns.split(" ").length, 1, "one column on a phone");
  assert.ok(out.phone.grid.deck.bottom <= out.phone.grid.board.top, "d152PhoneOrderDeckThenPostings");
  assert.equal(out.phone.handle, true, "a touch screen opens it from the edge handle");
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
  // ⭐ D152 (6) / D153 (1): the posting opens IN PLACE of the list on a computer (a phone keeps the full-screen posting).
  const O = out.desktop.opened;
  assert.ok(O.post && O.inBoard, "d152OnePostingPanelEverywhere — the posting takes the board column");
  assert.equal(O.listOut, "true"); assert.equal(O.listInert, true, "the folded list is out of the keyboard's reach");
  assert.equal(O.coversDeck, false, "d153NoOverlapOpenFilter — the posting never covers the deck");
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.closed.sameListNode, true, `${size}: d153OpenPostingNoRemount — the list's node survives an open / close`);
    assert.equal(d.closed.post, false, `${size}: closed`);
    assert.equal(d.closed.yAfter, d.closed.yBefore, `${size}: d153ScrollRestoredOnClose (${d.closed.yBefore} → ${d.closed.yAfter})`);
  }
});

test("d153 (1) · no panel placed by JS offsets: BesideDock is gone; the in-place layers and the column swap are CSS", () => {
  const PANEL = read("client/src/panels/JobsPanel.jsx");
  const BUB = read("client/src/components/JobBubble.jsx");
  assert.doesNotMatch(PANEL, /BesideDock|BESIDE_TOP|addEventListener\("scroll"/, "d153NoScrollPositionListeners");
  assert.match(BUB, /export function JobBoardColumns\(\{ post = null, children \}\)/);
  assert.match(BUB, /<div className="jb-board__list" data-out=\{open \? "true" : "false"\}/, "one tree, open or not");
  assert.match(CSS, /\.home__board:has\(\[data-board-post\]\) > :not\(:has\(\[data-board-post\]\)\) \{ display: none; \}/);
});

test("d152 (5) · the bubbles' source: pairs from JobBubbleRows, one column beside an open posting, no ATS square", () => {
  const BUB = read("client/src/components/JobBubble.jsx");
  const PANEL = read("client/src/panels/JobsPanel.jsx");
  const CSSB = read("client/src/components/JobBubble.css");
  assert.match(BUB, /export function JobBubbleRows\(\{ jobs, children, columns = 2 \}\)/);
  assert.doesNotMatch(BUB, /jb__sq--ats|onAts/, "the old ATS square and its handler are gone");
  assert.match(PANEL, /<JobBubbleRows jobs=\{jobs\} columns=\{2\}>/);
  assert.match(CSSB, /\.jb-pair:hover \.jb \{ flex-grow: \.75; \}\n\.jb-pair \.jb:hover, \.jb-pair \.jb:focus-within \{ flex-grow: 1\.5;/);
});

test("d152 (2) · Home's card size and fan transform (pure)", async () => {
  const { HOME_CARD, HOME_FAN, homeCardSize, homeFanTransform } = await import("../client/src/lib/fanGeometry.js");
  assert.deepEqual(homeCardSize(1280), { width: 300, height: 420 });
  assert.deepEqual(homeCardSize(390), { width: 250, height: 350 }, "the phone column (330) less the fan's 80, at 5 : 7");
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
  assert.match(route, /todaysDeck\(db, \{[^}]*betFor \}\)/);
  const order = read("client/src/lib/deckOrder.js");
  assert.match(order, /catch \{ return "best"; \}/, "best bets is the deck's default order");
});

test("d152ReasonLineOnCard / d152NoSeparateBestBetsList: the card says the best-bets reasons once; no separate list", async () => {
  const { cardFacts } = await import("../client/src/lib/deckCardFacts.js");
  const f = cardFacts({ job: { id: "x" }, score: 66, bestBet: { reasons: ["you're eligible", "7 of 7 must-haves", "66 ATS match", "posted 10 hours ago", "7 of 7 must-haves"] } });
  assert.deepEqual(f.reason, { eligible: true, rest: ["7 of 7 must-haves", "posted 10 hours ago"] },
    "the ATS-match reason is dropped (the match is the card's number) and each reason said once");
  assert.equal(cardFacts({ job: { id: "y" } }).reason, null, "no reading → no reason line");
  assert.ok(!fs.existsSync("client/src/components/BestBets.jsx"));
  assert.doesNotMatch(read("client/src/panels/JobsPanel.jsx"), /<BestBets\b|bestBets=/);
  assert.match(DECK, /\{home && facts\.reason && \(/);
  assert.match(DECK, /\{!home && facts\.chips\.length > 0 && \(/, "on Home the reason line replaces the hover chips (each fact once)");
  assert.match(DECK, /of \{s\.size\} today · \{deckOrder === "best" \? "best match first"/, "the sketch's count line");
});

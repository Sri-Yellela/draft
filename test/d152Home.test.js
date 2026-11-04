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
});

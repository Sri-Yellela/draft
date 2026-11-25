// ⭐ A240 (47g, found by the signed-in walk) · ON THE PLATE MARKET, AN INDEX ROW OPENS ITS POSTING WHERE IT CAN BE SEEN.
// A row's title opens the posting through the board's one open path (D168: openPostingOnDeck), which draws it in the
// deck's post slot — inside the Deck tab's panel. With the Index tab selected that panel is hidden, so the click showed
// nothing: measured in a real Chrome, the slot open and ?job= set, the posting 0 × 0. The openings now turn to Deck
// whenever the board draws a posting on the deck (POSTING_ON_DECK_EVENT), and bring it into view. The walk
// (scripts/walk47gPlate.mjs: "an Index row's title opens its posting, visible") reads it in the browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A240: the market's openings listen for a posting drawn on the deck and turn to the Deck tab", () => {
  const src = read("client/src/plate/MarketOpenings.jsx");
  assert.match(src, /import \{ POSTING_ON_DECK_EVENT, DECK_POST_SLOT_ID \} from "\.\.\/lib\/jobUrl\.js";/);
  assert.match(src, /window\.addEventListener\(POSTING_ON_DECK_EVENT, onDrawn\);/);
  assert.match(src, /window\.removeEventListener\(POSTING_ON_DECK_EVENT, onDrawn\);/);
  assert.match(src, /if \(!e\?\.detail\?\.jobId\) return;/, "a fold (jobId null) leaves the tab alone");
  assert.match(src, /if \(t === "deck"\) return t;[\s\S]{0,260}return "deck";/);
  // the board still draws every opened posting there, and says so with the event
  const board = read("client/src/panels/JobsPanel.jsx");
  assert.match(board, /window\.dispatchEvent\(new CustomEvent\(POSTING_ON_DECK_EVENT, \{ detail: \{ jobId: postOnDeckId, origin: postOrigin \} \}\)\);/);
});

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

// ⛔ 47m (changed on purpose): "A240: the market's openings listen for a posting drawn on the deck and turn to t" retired — the surface it pinned was rebuilt in the plate system (47m M5).

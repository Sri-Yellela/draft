// ⭐ 47h (47f's gap 4 (d)) · THE HERO'S BEST MATCH. MarketHero has drawn a BEST MATCH pin and route since P1 only when the
// page knows the best match (`best`), and App never passed one, so the live hero never showed it. DeckView now publishes
// the best undecided card of today's deck (best bets' score; the ATS score breaks a tie or stands in), App's hero reads it.
// The figure is the ticket's own (deckCardFacts: the ATS score, rounded, 0–100) — the pin and the card never disagree.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { bestOfDeck } from "../client/src/plate/marketPlate.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const card = (id, score, bet, extra = {}) => ({ job: { id, company: `Co ${id}`, title: `Role ${id}` }, score, bestBet: bet == null ? null : { score: bet }, ...extra });

test("47h · bestOfDeck: best bets' top undecided card, the ticket's figure; nothing left → null", () => {
  assert.deepEqual(bestOfDeck([card("a", 70, 60), card("b", 91, 80), card("c", 88, 75)]), { jobId: "b", match: "91%", company: "Co b", title: "Role b" });
  assert.equal(bestOfDeck([card("a", 70, 60), card("b", 91, 80, { decision: "passed" })]).jobId, "a", "a decided card is never the best match");
  assert.equal(bestOfDeck([card("a", 70, 80), card("b", 91, 80)]).jobId, "b", "a tie on best bets → the ATS score");
  assert.equal(bestOfDeck([card("a", 70, null), card("b", 91, null)]).jobId, "b", "no best bets at all → the ATS score");
  assert.equal(bestOfDeck([card("a", null, 50)]).match, null, "no score → no figure, never a guess");
  assert.equal(bestOfDeck([card("a", 104.4, 50)]).match, "100%", "clamped as the ticket clamps");
  assert.equal(bestOfDeck([]), null);
  assert.equal(bestOfDeck([card("a", 70, 60, { decision: "drafted" })]), null);
});

test("47h · DeckView publishes it on the plate market; App's hero reads it", () => {
  const dv = read("client/src/panels/DeckView.jsx");
  assert.match(dv, /useEffect\(\(\) => \{ if \(home && plateMarket\) publishBestCard\(bestOfDeck\(s\.cards\)\); \}, \[home, plateMarket, s\.cards\]\);/);
  const app = read("client/src/App.jsx");
  assert.match(app, /const best = useBestCard\(\);[\s\S]{0,400}<MarketHero [\s\S]{0,200}best=\{best\}/);
});

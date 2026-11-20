import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initialDeck } from "../client/src/lib/deckState.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ 46y (found by the real-Chrome board walk, scripts/walkBoardEmpty46x.mjs): with the board EMPTY for this profile — an empty
// pool (cache_empty) or no job in its role — the deck beside it said "Reading today's postings against this résumé. Your best
// matches will be here in a few seconds…" for its whole 3 minutes of retries (43y's "scoring" answer fires on any empty deal
// with < 30 scores), next to the board's own "No jobs collected yet" / "No jobs in your profile's role". No scoring pass could
// keep that promise. The deck now answers "no_jobs" when the board's own first page listed nothing AND held nothing back
// being matched (A126 (7)); "scoring" stays for the case it was built for — postings exist, their scores have not landed.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("deckNoJobs46y — the deal's handler keeps the board's first answer and says no_jobs BEFORE it can say scoring", () => {
  const s = read("server.js");
  const from = at(s, 'app.get("/api/draft/today"');
  const body = s.slice(from, at(s, "const deck = await todaysDeck(db, { userId: req.user.id", from) + 1600);
  assert.match(body, /if \(!cursor && firstBoardPage === null\) firstBoardPage = \{ ok, listed: body\?\.jobs\?\.length \|\| 0, beingMatched: Number\(body\?\.beingMatched\) \|\| 0, reason: body\?\.reason \|\| null \};/,
    "the first page (no cursor) only — the background re-deal after the answer never overwrites it");
  const noJobs = at(body, 'reason: "no_jobs"');
  const scoring = at(body, 'reason: "scoring"');
  assert.ok(noJobs < scoring, "no_jobs is decided before the scoring answer");
  assert.match(body, /if \(!deck\.size && firstBoardPage\?\.ok && firstBoardPage\.listed === 0 && firstBoardPage\.beingMatched === 0\) \{\n\s+return res\.json\(\{ \.\.\.deck, reason: "no_jobs", boardReason: firstBoardPage\.reason \}\);/,
    "only when nothing is listed AND nothing is being matched — a new résumé's unscored postings still read as scoring");
});

test("deckNoJobs46y — the deck state carries the board's reason; the card says there is nothing to pick from, never 'a few seconds'", () => {
  const st = initialDeck({ date: "2026-11-19", reason: "no_jobs", boardReason: "cache_empty", cards: [] });
  assert.equal(st.reason, "no_jobs");
  assert.equal(st.boardReason, "cache_empty");
  assert.equal(st.size, 0);
  assert.equal(initialDeck({ cards: [] }).boardReason, null);
  const deck = read("client/src/panels/DeckView.jsx");
  const copy = deck.slice(at(deck, "no_jobs: ["), at(deck, "empty: [", at(deck, "no_jobs: [")));
  assert.match(copy, /"No jobs to pick from yet\."/);
  assert.match(copy, /s\.boardReason === "cache_empty"/, "an empty pool and an empty role are told apart, as the board tells them");
  assert.doesNotMatch(copy, /few seconds/);
});

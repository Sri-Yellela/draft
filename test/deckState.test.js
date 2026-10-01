import test from "node:test";
import assert from "node:assert/strict";
const { deckReducer, initialDeck, isFinished, counts, DECISIONS } = await import("../client/src/lib/deckState.js");

const card = (id, decision = null) => ({ position: 0, band: "strong", decision, job: { id, title: id }, why: { matched: [], missing: [] } });
const deck = (...cs) => initialDeck({ date: "2026-09-30", cards: cs });

test("the deck opens on the first UNDECIDED card — a returning user resumes, not restarts", () => {
  const s = deck(card("a", "drafted"), card("b", "passed"), card("c"), card("d"));
  assert.equal(s.index, 2);
});

test("⛔ no animation gates input: two decisions in one tick decide two cards", () => {
  let s = deck(card("a"), card("b"), card("c"));
  s = deckReducer(s, { type: "decide", decision: DECISIONS.DRAFTED });
  // No "landed" in between — the first card is still mid-flight.
  s = deckReducer(s, { type: "decide", decision: DECISIONS.DRAFTED });
  assert.deepEqual(s.cards.map(c => c.decision), ["drafted", "drafted", null]);
  assert.equal(s.index, 2);
  assert.equal(s.flight.card.job.id, "b", "the fly-out is a detached copy of the LAST decided card");
});

test("⛔ a refused decision is never a success: the card is undecided again, with the server's words, and we go back to it", () => {
  let s = deck(card("a"), card("b"));
  s = deckReducer(s, { type: "decide", decision: DECISIONS.DRAFTED });
  assert.equal(s.index, 1);
  s = deckReducer(s, { type: "refused", jobId: "a", message: "Add your email address first." });
  assert.equal(s.cards[0].decision, null);
  assert.equal(s.cards[0].error, "Add your email address first.");
  assert.equal(s.index, 0);
  assert.equal(counts(s).drafted, 0);
});

test("the deck finishes when every card is decided, and undo brings a card back", () => {
  let s = deck(card("a"), card("b"));
  s = deckReducer(s, { type: "decide", decision: DECISIONS.PASSED });
  s = deckReducer(s, { type: "decide", decision: DECISIONS.SAVED });
  assert.equal(isFinished(s), true);
  assert.deepEqual(counts(s), { drafted: 0, passed: 1, saved: 1, left: 0 });
  s = deckReducer(s, { type: "undone", jobId: "a" });
  assert.equal(isFinished(s), false);
  assert.equal(s.index, 0);
});

test("a decided card cannot be decided twice, and an empty deck is finished at once", () => {
  let s = deck(card("a", "drafted"));
  const before = s;
  s = deckReducer(s, { type: "decide", decision: DECISIONS.PASSED });
  assert.equal(s, before);
  assert.equal(isFinished(deck()), true);
});

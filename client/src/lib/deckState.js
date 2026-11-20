// ── The deck's state, as a pure reducer ──────────────────────────────────────────────────────
//
// docs/UI_REDESIGN.md §3–§4. Pure so the two rules that matter can be tested without a browser:
//
//   ⛔ NO ANIMATION GATES INPUT. An action COMMITS immediately — the card is decided and the index
//      moves on in the same dispatch; the fly-out plays on a detached copy. Pressing D twice fast
//      drafts two cards (test/deckState.test.js).
//   ⛔ A REFUSED CALL IS NEVER A SUCCESS. The decision is optimistic, and a failure puts the card
//      back to undecided with the server's own sentence on it (the Android "Application sent"
//      precedent) — the user is taken back to it rather than left believing it was drafted.

export const DECISIONS = Object.freeze({ DRAFTED: "drafted", PASSED: "passed", SAVED: "saved" });

export function initialDeck(deck) {
  const cards = (deck?.cards || []).map(c => ({ ...c, error: null, pending: false }));
  return { date: deck?.date, reason: deck?.reason || null, boardReason: deck?.boardReason || null, size: cards.length, cards,
           index: firstUndecided(cards, 0), lastAction: null, seq: 0, flight: null };
}

export function firstUndecided(cards, from = 0) {
  for (let i = from; i < cards.length; i++) if (!cards[i].decision) return i;
  for (let i = 0; i < from && i < cards.length; i++) if (!cards[i].decision) return i;
  return cards.length;   // == finished
}

export const isFinished = (s) => s.index >= s.cards.length;

/**
 * The fan: the undecided cards in deal order, each with its offset from the front. A decided card
 * has left the fan, so the fan closes up behind it.
 */
export function fanOrder(s) {
  const live = s.cards.map((c, i) => ({ card: c, i })).filter(e => !e.card.decision);
  const front = live.findIndex(e => e.i === s.index);
  return live.map((e, rank) => ({ ...e, offset: front < 0 ? rank + 1 : rank - front }));
}

/**
 * Where a one-card rotation lands, or null at either end. Null is load-bearing: the deck only
 * captures the wheel when a rotation is possible, so at the ends the page scrolls again and the
 * pointer is never trapped over the stack.
 */
export function stepTarget(s, dir) {
  const d = dir < 0 ? -1 : 1;
  for (let i = s.index + d; i >= 0 && i < s.cards.length; i += d) if (!s.cards[i].decision) return i;
  return null;
}
export const counts = (s) => ({
  drafted: s.cards.filter(c => c.decision === DECISIONS.DRAFTED).length,
  passed:  s.cards.filter(c => c.decision === DECISIONS.PASSED).length,
  saved:   s.cards.filter(c => c.decision === DECISIONS.SAVED).length,
  left:    s.cards.filter(c => !c.decision).length,
});

export function deckReducer(s, a) {
  switch (a.type) {
    case "decide": {
      // Acts on the CURRENT card, whatever animation is playing: the fly-out is `flight`, a copy.
      const i = s.index;
      const card = s.cards[i];
      if (!card || card.decision) return s;
      const cards = s.cards.slice();
      cards[i] = { ...card, decision: a.decision, pending: true, error: null };
      const seq = s.seq + 1;
      return { ...s, cards, index: firstUndecided(cards, i + 1), seq,
               lastAction: { seq, jobId: card.job.id, decision: a.decision, from: i },
               flight: { seq, card: cards[i], decision: a.decision } };
    }
    case "settled": {   // the server accepted a decision
      const cards = s.cards.map(c => c.job.id === a.jobId ? { ...c, pending: false, runId: a.runId ?? c.runId } : c);
      return { ...s, cards };
    }
    case "refused": {   // the server refused it: undecided again, with its sentence, and back to it
      const i = s.cards.findIndex(c => c.job.id === a.jobId);
      if (i < 0) return s;
      const cards = s.cards.slice();
      cards[i] = { ...cards[i], decision: null, pending: false, error: a.message || "That did not go through." };
      return { ...s, cards, index: i, lastAction: null };
    }
    case "undone": {    // an undo the server accepted
      const i = s.cards.findIndex(c => c.job.id === a.jobId);
      if (i < 0) return s;
      const cards = s.cards.slice();
      cards[i] = { ...cards[i], decision: null, pending: false, error: null, runId: undefined };
      return { ...s, cards, index: i, lastAction: null };
    }
    case "goto": {
      const index = Math.max(0, Math.min(s.cards.length - 1, a.index));
      return { ...s, index };
    }
    case "step": {      // rotate the fan one card: to the next/previous UNDECIDED card, never wrapping
      const to = stepTarget(s, a.dir);
      return to == null ? s : { ...s, index: to };
    }
    case "landed":      // the fly-out finished; drop the detached copy
      return s.flight && s.flight.seq === a.seq ? { ...s, flight: null } : s;
    default:
      return s;
  }
}

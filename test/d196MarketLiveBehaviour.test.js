// ⭐ 47g R1 (retiring the classic market) · THE PLATE MARKET'S DECK BEHAVES AS THE DECK ALWAYS HAS — on the live page.
// The D196 browser tests read F5 fixtures (scripts/d196Regress.mjs) and the gallery; nothing loaded the real /app/jobs, so
// the deck's behaviour was held only by the classic market's probes (d156Home, on ?plate=0). This holds the carry-overs on
// the page people use, measured by home156's own code (`plate156` in scripts/fidelityShots.mjs, its plate mode: the title
// opens the post — the ticket has no "Open the posting" (FIX-4) — and the "bubbles" are the Index rows):
//   · D156 (1c): the wheel accumulates to one card (1 → 1 → 2 → 2 → 3 → 2) and never scrolls the page; K J › ‹; ‹ is "K ArrowUp"
//   · D156 (1c): a left swipe passes, the PASS stamp showing on the way
//   · D156 (1c) / D168: a press opens the long post in the deck's slot (the fan put away), Enter opens, Esc and Fold it back
//     fold, the wheel never opens or folds it; an Index row's posting opens on the deck (A240); the post's Pass decides the
//     deck's own card and the next one returns; the phone keeps D149's full-screen posting (O99 (b))
//   · the board's views, Import a job, the sort in the search; no sideways scroll at 1440 / 1280 / 390
// The classic geometry (card sizes, the 2 × 2 stats, the bubbles' growth) stays d156Home's until R2 deletes it.
// ⚠ Not held here on purpose: a ticket's height across a turn — the plate ticket is its own face's height (FIX-2).
import test from "node:test";
import assert from "node:assert/strict";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

let probe = null;
function measured(t) {
  if (probe === null) probe = fidelityProbe("plate156");
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}
const SIZES = ["wide", "desktop", "phone"];

test("d196MarketLiveDeckTurns (real Chrome, the plate market): one flick one card, the page held; K J › ‹; a left swipe passes", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const f = out[size].flip;
    assert.deepEqual([f.start, f.afterHalfFlick, f.afterOneFlick, f.duringSettle, f.afterSecondFlick, f.afterSidewaysBack], [1, 1, 2, 2, 3, 2],
      `${size}: half a flick turns nothing, one flick one card, the settle holds, sideways back`);
    assert.equal(f.pageScrolledByWheel, 0, `${size}: the wheel over the deck never scrolls the page`);
    assert.deepEqual([f.afterK, f.afterJ, f.afterNextButton, f.afterPrevButton], [1, 2, 3, 2], `${size}: K J › ‹`);
    assert.equal(f.prevKeys, "K ArrowUp");
    const s = out[size].swipe;
    assert.equal(s.passed, true, `${size}: a left swipe passes (${s.before} → ${s.after})`);
    assert.notEqual(s.after, s.before, `${size}: the next card is in front`);
    assert.equal(s.stampShown, true, `${size}: the PASS stamp shows during the drag`);
  }
});

test("d196MarketLivePostOnDeck (real Chrome, the plate market): the long post on the deck, opened and folded every way; the post's Pass decides the card", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const p = out[size].post;
    if (size === "phone") {
      assert.deepEqual([p.overlay, p.slotOpen, p.overlayClosed], [true, false, true], "phone: the full-screen posting, closed by Esc");
      continue;
    }
    assert.deepEqual([p.wheelOpened, p.wheelTurned, p.wheelFolded], [false, true, false], `${size}: the wheel turns, never opens or folds`);
    assert.equal(p.openedByPress, true, `${size}: a press on the front card's title opens the long post`);
    assert.equal(p.postTitle, p.title, `${size}: the post is the front card's job`);
    assert.deepEqual([p.factsInSlot, p.inSlot, p.stageHidden], [true, true, true], `${size}: drawn in the deck's slot, the fan put away`);
    assert.equal(p.boardPost, false, `${size}: no posting panel beside the list`);
    assert.equal(p.foldLabel, "Fold it back"); assert.equal(p.backTo, p.title);
    assert.deepEqual([p.openedByEnter, p.foldedByEsc, p.foldedByButton], [true, true, true], `${size}: Enter / Esc / Fold it back`);
    assert.equal(p.listOpensOnDeck, true, `${size}: an Index row's posting opens on the deck (A240)`); assert.equal(p.listOrigin, "board");
    assert.deepEqual([p.passFolds, p.passAdvanced], [true, true], `${size}: the post's Pass decides the deck's card and the next one returns`);
    assert.match(p.passSaid, /^Passed /);
  }
});

test("d196MarketLiveBoard (real Chrome, the plate market): the views, Import a job, the sort in the search; never a sideways scroll", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const d = out[size];
    assert.deepEqual(d.views.buttons.map(b => b.id), ["all", "saved", "imported"], `${size}: All jobs · Starred · Imported`);
    assert.equal(d.views.importButton, "Import a job");
    assert.equal(d.importBox.shown, true); assert.equal(d.importBox.inBoard, true, `${size}: the import box opens in the board, not over it`);
    assert.equal(d.importBox.noteKind, "ok", `${size}: an import answers on the board`);
    assert.equal(d.sort.inSearch, true, `${size}: the sort sits in the search`);
    assert.equal(d.sort.menu.open, true); assert.ok(d.sort.menu.rows.length >= 4, `${size}: the sort's orders`);
    assert.equal(d.hscroll, false, `${size}: no sideways scroll`);
  }
});

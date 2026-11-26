// ⭐ 47g R1 (retiring the classic market) · THE PLATE MARKET'S DECK BEHAVES AS THE DECK ALWAYS HAS — on the live page.
// The D196 browser tests read F5 fixtures (scripts/d196Regress.mjs) and the gallery; nothing loaded the real /app/jobs, so
// the deck's behaviour was held only by the classic market's probes (d156Home, on ?plate=0). This holds the carry-overs on
// the page people use, measured by home156's own code (`plate156` in scripts/fidelityShots.mjs, its plate mode: the title
// opens the post — the ticket has no "Open the posting" (FIX-4) — and the "bubbles" are the Index rows):
//   · D156 (1c): the wheel accumulates to one card (1 → 1 → 2 → 2 → 3 → 2) and never scrolls the page; K J › ‹; ‹ is "K ArrowUp"
//   · D156 (1c): a left swipe passes, the PASS stamp showing on the way
//   · ⭐ 47j (D199 C7): a press, Enter or an Index row opens the OPENING SHEET (/app/jobs/<id>) over the market; Esc and
//     "← Back to the market" return to the same card; the wheel never opens or closes it; the sheet's Pass decides the card
//   · ⭐ 47j (D199 C2): the area nav's views, Import a job, the sort beside the cartouche's search; no sideways scroll at
//     1440 / 1280 / 390
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

// ⭐ 47j (D199 C7 — re-pointed on purpose; was d196MarketLivePostOnDeck): a posting no longer opens in the deck's slot.
// The title, Enter and an Index row open the OPENING SHEET (/app/jobs/<id>) over the market at every width (the phone too);
// Esc and "← Back to the market" return to the same card; the sheet's Pass is the board's own decide on the deck's card.
test("d196MarketLiveOpensSheet (real Chrome, the plate market): the opening sheet, opened and closed every way; the sheet's Pass decides the card", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const p = out[size].post;
    assert.deepEqual([p.wheelOpened, p.wheelTurned], [false, true], `${size}: the wheel turns the deck and opens nothing`);
    assert.equal(p.openedByPress, true, `${size}: a press on the front card's title opens the sheet`);
    assert.match(p.path || "", /^\/app\/jobs\/[^/]+$/, `${size}: at the sheet's own address (${p.path})`);
    assert.equal(p.sheetTitle, p.title, `${size}: the sheet is the front card's job`);
    assert.deepEqual([p.over, p.marketBelow], [true, true], `${size}: drawn over the market, which stays mounted`);
    assert.equal(p.wheelClosed, false, `${size}: the wheel never closes the sheet`);
    assert.equal(p.closedByEsc, true, `${size}: Esc returns to the market`);
    assert.deepEqual([p.backTo, p.backPath], [p.title, "/app/jobs"], `${size}: on the same card`);
    assert.deepEqual([p.openedByEnter, p.closedByBack], [true, true], `${size}: Enter opens; ← Back to the market closes`);
    assert.equal(p.listOpensSheet, true, `${size}: an Index row opens the same sheet`);
    assert.match(p.listBackTab || "", /^Index/, `${size}: Back returns to the Index (${p.listBackTab})`);
    assert.deepEqual([p.passCloses, p.passAdvanced], [true, true], `${size}: the sheet's Pass decides the deck's card and the next one comes to the front`);
    assert.match(p.passSaid, /^Passed /);
  }
});

// ⭐ 47j (D199 C2 / 47h — re-pointed on purpose): the views are the shell's area nav, Import a job its More item (a view in
// the phone's scroller, A245), search + sort the cartouche's row.
test("d196MarketLiveBoard (real Chrome, the plate market): the area nav's views, Import a job, the sort beside the search; never a sideways scroll", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const d = out[size];
    assert.equal(d.views.inAreaNav, true, `${size}: the market's area nav`);
    assert.deepEqual(d.views.buttons.map(b => b.id), ["picks", "all", "saved", "imported"], `${size}: Today's picks · All jobs · Starred · Imported`);
    assert.equal(d.views.importButton, "Import a job", `${size}: Import a job is reachable`);
    assert.equal(d.importBox.shown, true, `${size}: the import box opens`); assert.equal(d.importBox.inBoard, true, `${size}: in the openings, not over them`);
    assert.equal(d.importBox.overlay, false);
    assert.equal(d.importBox.noteKind, "ok", `${size}: an import answers on the board`);
    assert.equal(d.importBox.viewAfter, "imported", `${size}: and the view turns to Imported`);
    assert.deepEqual([d.sort.inSearch, d.sort.search], [true, true], `${size}: the sort sits beside the search, in the cartouche's row`);
    assert.equal(d.sort.menu.open, true); assert.ok(d.sort.menu.rows.length >= 4, `${size}: the sort's orders`);
    assert.equal(d.sort.menu.underField, true, `${size}: the menu opens under the sort control`);
    assert.match(d.sort.afterPick.label || "", /Newest/, `${size}: a pick takes`);
    assert.equal(d.hscroll, false, `${size}: no sideways scroll`);
  }
});

// ⭐ A238 (47g found, 47h fixed) · A DECIDED CARD LEAVES THE DOM.
// After a decision the deck's FanCard played its exit and then stayed mounted at data-fan-offset="0", opacity 0,
// pointer-events auto — one per decision, on the plate and the classic deck alike (the same FanCard). Measured in 47h on
// the BUILT client, signed in (scripts/walk47gPlate.mjs): the "leave" variant completed on every card, AnimatePresence's
// onExitComplete never fired. Cause: the front card's swipe element has `drag`, and framer-motion's drag feature mounts
// MeasureLayout, which calls usePresence() — it registered with the card's AnimatePresence child and never said "safe to
// remove". The card's inner content now sits under <PresenceContext.Provider value={null}>, so the card leaves on its own
// exit. Re-walked: leave 3 = exit-complete 3, no invisible card in the stage, at 1280 and 390.
// ⚠ The vite fixture (the a238 probe) did NOT show the ghost before the fix — only the built, signed-in page did; the walk's
// "leaves no decided card mounted (A238)" check is the faithful one. The probe holds the count on the live plate market.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A238: FanCard's inner content (the drag element and its MeasureLayout) is cut off from the card's presence", () => {
  const src = read("client/src/panels/DeckView.jsx");
  assert.match(src, /import \{ AnimatePresence, MotionConfig, PresenceContext, motion,/);
  const card = src.slice(src.indexOf("function FanCard("), src.indexOf("function leaveFor("));
  assert.ok(card.length > 0, "FanCard is still in DeckView.jsx");
  const open = card.indexOf("<PresenceContext.Provider value={null}>"), close = card.indexOf("</PresenceContext.Provider>");
  const drag = card.indexOf('drag={isFront && !expanded ? "x" : false}');
  assert.ok(open > 0 && close > open, "the inner content is wrapped");
  assert.ok(drag > open && drag < close, "the drag element is inside the wrapper");
  assert.ok(card.indexOf('exit="leave"') < open, "the card's own exit stays OUTSIDE the wrapper (it alone governs removal)");
  assert.doesNotMatch(card.slice(open, close), /\bexit=/, "nothing inside the card plays an exit of its own");
});

test("A238 (real Chrome, the plate market): each decision takes one card out of the stage, and none lingers invisible", { timeout: 300000 }, (t) => {
  const out = fidelityProbe("a238");
  if (out.skipped) { t.skip(out.skipped); return; }
  const d = out.desktop;
  assert.equal(d.before, 10, "a day deals ten");
  d.steps.forEach((s, i) => {
    assert.notEqual(s.now, s.was, `${s.act} decided the card`);
    assert.equal(s.mounted, d.before - (i + 1), `after ${i + 1} decision(s) the stage holds ${d.before - (i + 1)} cards`);
    assert.equal(s.ghosts, 0, `${s.act}: no invisible card at offset 0 in the stage`);
    assert.equal(s.docGhosts, 0, `${s.act}: none anywhere on the page`);
  });
});

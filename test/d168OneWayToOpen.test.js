// ⭐ D168 · ONE WAY TO OPEN, ONE JOB FOR THE SCROLL WHEEL (owner 11-06, concept B approved): "the scroll is assigned to
// too many things and the panel opening are choppy and sometimes stuck, there is no consistency cause each card and
// bubble opens differently". On the jobs page:
//   · the wheel over the deck only turns it — one flick, one card — and never opens or folds anything; elsewhere, and
//     over an open posting, it scrolls the page;
//   · a press (or Enter) opens, a deck card and a posting bubble alike, through ONE open path (openPostingOnDeck);
//   · the open / fold is a swap: the content fades out, swaps, fades in while the stack's height runs from its measured
//     start to its measured end — never a one-frame jump, never stuck (a watchdog drops the lock);
//   · nothing opens on hover.
// Measured in a real Chrome with motion ON by `scripts/fidelityShots.mjs --styles home168` (puppeteer's real mouse wheel
// and hover); the pure parts read the sources.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DECK = read("client/src/panels/DeckView.jsx");
const BOARD = read("client/src/panels/JobsPanel.jsx");
const URL_ = read("client/src/lib/jobUrl.js");
const SHELL = read("client/src/components/PanelShell.jsx");
const JD = read("client/src/components/JobDetailPanel.jsx");
const SIZES = ["wide", "desktop"];

let probe = null;
function measured(t) {
  if (probe === null) {
    probe = JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", "home168"],
      { encoding: "utf8", timeout: 280000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  }
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}

// ── pure ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test("d168OneOpenPathForCardAndBubble (pure): a bubble's press on the jobs page goes through the deck card's own open", () => {
  assert.match(URL_, /export function openPostingOnDeck\(jobId, \{ origin = "deck" \} = \{\}\)/);
  assert.match(BOARD, /if \(typeof document !== "undefined" && document\.getElementById\(DECK_POST_SLOT_ID\)\) openPostingOnDeck\(job\.jobId, \{ origin: "board" \}\);/);
  assert.match(URL_, /export const POST_FADE_MS = 90;/);
});

test("d168WheelHasOneJob (pure): the deck's wheel handler turns the deck and nothing else; the post has no wheel listener", () => {
  const from = at(DECK, "const onWheel = (e) => {");
  const wheel = DECK.slice(from, at(DECK, 'el.addEventListener("wheel", onWheel', from));
  assert.doesNotMatch(wheel, /openPost|foldPost|setWhy|closePostingOnDeck/);
  assert.match(wheel, /if \(boardPostRef\.current\) return;\s+\/\/ reading: the page scrolls/);
  assert.equal((DECK.match(/addEventListener\("wheel"/g) || []).length, 1, "one wheel listener in the deck");
  // the posting on the deck is read by scrolling the PAGE: its body is no scroll container (it swallowed the wheel)
  assert.match(SHELL, /bodyScrolls = true,/);
  assert.match(JD, /bodyScrolls=\{!onDeck\}/);
});

test("d168NoHoverOpens (pure): nothing on the deck or the bubbles opens on pointer enter / hover", () => {
  for (const src of [DECK, BOARD]) assert.doesNotMatch(src, /onMouseEnter=\{[^}]*(openPost|openPostingOnDeck|setSelectedJob)/);
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
test("d168WheelHasOneJob (real Chrome): over the deck one flick turns one card, nothing opens; over the list and an open post the page scrolls", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const { deckWheel: w, listWheel: l, postWheel: p } = out[size].node;
    assert.equal(w.before.count.startsWith("1 of"), true, `${size}: starts on the first card`);
    assert.match(w.down.count, /^2 of/, `${size}: one flick down turns one card`);
    assert.match(w.up.count, /^1 of/, `${size}: one flick up turns it back`);
    assert.equal(w.down.y, 0, `${size}: the page does not move while the deck turns`);
    assert.deepEqual([w.down.open, w.up.open, w.down.asks.length], [false, false, 0], `${size}: the wheel opened nothing`);
    assert.ok(l.y > 0, `${size}: the wheel over the list scrolls the page (${l.y})`);
    assert.match(l.count, /^1 of/, `${size}: and does not turn the deck`);
    assert.equal(p.opened.open, true, `${size}: a press opened the post`);
    assert.ok(p.down.y > 0, `${size}: the wheel over the open post scrolls the page (${p.down.y})`);
    assert.equal(p.down.bodyScrolls, "visible", `${size}: the post's body is not a scroll container`);
    assert.ok(p.up.y < p.down.y, `${size}: and back up (${p.down.y} → ${p.up.y})`);
    assert.deepEqual([p.down.open, p.up.open], [true, true], `${size}: the wheel never folds it`);
    assert.ok(!p.up.asks.some(a => a.startsWith("close-posting")), `${size}: no fold was asked`);
  }
});

test("d168OpenFadesAndAnimatesHeight (real Chrome): the content fades out and in while the height runs between measured ends", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    for (const kind of ["open", "fold"]) {
      const { before, frames, after } = out[size][kind];
      assert.ok(frames.some(f => f.phase === "out" && f.op < 0.5), `${size} ${kind}: the content faded out`);
      assert.ok(frames.some(f => f.phase === "in"), `${size} ${kind}: and back in`);
      assert.equal(after.phase, "idle", `${size} ${kind}: the swap ended`); assert.equal(after.lockedHeight, "", `${size} ${kind}: no height left locked`);
      assert.equal(after.stackH, after.contentH, `${size} ${kind}: the stack fits its content`);
      // no one-frame jump: the height passes through at least one value strictly between the two ends
      const lo = Math.min(before.stackH, after.stackH) + 2, hi = Math.max(before.stackH, after.stackH) - 2;
      assert.ok(frames.some(f => f.h > lo && f.h < hi), `${size} ${kind}: the height animated (${before.stackH} → ${after.stackH})`);
    }
    assert.equal(out[size].bubble.after.open, true, `${size}: a bubble's posting opens on the deck, with the same swap`);
    assert.ok(out[size].bubble.frames.some(f => f.phase === "out"), `${size}: the bubble's open faded`);
  }
});

test("d168NeverStuck (real Chrome): fifty fast opens and folds, then ten slower ones — the stack always settles to its content", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const f = out[size].fast;
    assert.deepEqual([f.phase, f.lockedHeight, f.opacity], ["idle", "", "1"], `${size}: settled after the burst`);
    assert.equal(f.stackH, f.contentH, `${size}: height matches content after the burst`);
    assert.equal(f.open, f.lastWasOpen, `${size}: the last ask won`);
    for (const [i, s] of out[size].slow.entries()) {
      assert.equal(s.open, s.wantOpen, `${size} slow ${i}: open = ${s.wantOpen}`);
      assert.equal(s.stackH, s.contentH, `${size} slow ${i}: height matches content`);
      assert.equal(s.phase, "idle", `${size} slow ${i}: settled`);
    }
  }
});

test("d168NoHoverOpens (real Chrome): resting the pointer on the front card, a back card and two bubbles opens nothing", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const h = out[size].node.hover;
    assert.ok(h.points >= 3, `${size}: hovered ${h.points} places`);
    assert.deepEqual([h.open, h.jd, h.asks.length, h.panels], [false, false, 0, 0], `${size}: nothing opened on hover`);
  }
});

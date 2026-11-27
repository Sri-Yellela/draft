// ⭐ D168 · ONE WAY TO OPEN, ONE JOB FOR THE SCROLL WHEEL (owner 11-06, concept B approved): "the scroll is assigned to
// too many things and the panel opening are choppy and sometimes stuck, there is no consistency cause each card and
// bubble opens differently". On the jobs page:
//   · the wheel over the deck only turns it — one flick, one card — and never opens or folds anything; elsewhere, and
//     over an open posting, it scrolls the page;
//   · a press (or Enter) opens, a deck card and a posting bubble alike, through ONE open path (openPostingOnDeck);
//   · the open / fold is a swap: the content fades out, swaps, fades in while the stack's height runs from its measured
//     start to its measured end — never a one-frame jump, never stuck (a watchdog drops the lock);
//   · nothing opens on hover.
// ⭐ 47g R1: measured on the PLATE market (the page people use; the classic market retires) — the bubbles are its Index rows.
// Measured in a real Chrome with motion ON by `scripts/fidelityShots.mjs --styles home168` (puppeteer's real mouse wheel
// and hover); the pure parts read the sources. ⭐ 47j: since D199 C7 the open is the OPENING SHEET (/app/jobs/<id>) — the
// real-Chrome checks measure it (the fade-and-height swap on the deck went with the post on the deck).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DECK = read("client/src/panels/DeckView.jsx");
const BOARD = read("client/src/panels/JobsPanel.jsx");
const URL_ = read("client/src/lib/jobUrl.js");
// 47n: PanelShell.jsx deleted (it rendered nowhere after 47m) — nothing here read it
const JD = "" /* 47m: JobDetailPanel.jsx deleted */;
const SIZES = ["wide", "desktop"];

let probe = null;
function measured(t) {
  if (probe === null) {
    probe = fidelityProbe("home168");
  }
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}

// ── pure ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// ⛔ 47m (changed on purpose): "d168OneOpenPathForCardAndBubble (pure): a bubble's press on the jobs page goes t" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "d168WheelHasOneJob (pure): the deck's wheel handler turns the deck and nothing e" retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("d168NoHoverOpens (pure): nothing on the deck or the bubbles opens on pointer enter / hover", () => {
  for (const src of [DECK, BOARD]) assert.doesNotMatch(src, /onMouseEnter=\{[^}]*(openPost|openPostingOnDeck|setSelectedJob)/);
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
// ⭐ 47j (D199 C7 — re-pointed on purpose): a posting no longer opens on the deck. The deck's title, its Open and an Index
// row go to the OPENING SHEET (/app/jobs/<id>), drawn over the market, which stays mounted underneath; Back (Esc, the
// browser's, "← Back to the market") returns to the same card, tab and scroll. The rules hold on the sheet: the wheel over
// the deck turns it and opens nothing; over the sheet it scrolls the sheet and never closes it; presses and Backs never
// leave a sheet stuck; hover opens nothing.
const SHEET = /^\/app\/jobs\/[^/]+$/;
test("d168WheelHasOneJob (real Chrome): over the deck one flick turns one card, nothing opens; over the hero the page scrolls; over the sheet the sheet scrolls", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const { deckWheel: w, listWheel: l, sheetWheel: s } = out[size].node;
    assert.equal(/^1 of/i.test(w.before.count), true, `${size}: starts on the first card`);
    assert.match(w.down.count, /^2 of/i, `${size}: one flick down turns one card`);
    assert.match(w.up.count, /^1 of/i, `${size}: one flick up turns it back`);
    assert.equal(w.down.y, w.before.y, `${size}: the page does not move while the deck turns (${w.before.y} → ${w.down.y})`);
    assert.deepEqual([w.down.open, w.up.open, w.down.asks.length], [false, false, 0], `${size}: the wheel opened nothing`);
    assert.ok(l.y > 0, `${size}: the wheel elsewhere (over the hero) scrolls the page (${l.y})`);
    assert.match(l.count, /^1 of/i, `${size}: and does not turn the deck`);
    assert.equal(s.opened.open, true, `${size}: a press opened the sheet`);
    assert.match(s.opened.url, SHEET, `${size}: at the sheet's own address (${s.opened.url})`);
    assert.equal(s.overflowY, "auto", `${size}: the sheet is its own scroller`);
    assert.ok(s.down.top > s.top0, `${size}: the wheel over the sheet scrolls it (${s.top0} → ${s.down.top})`);
    assert.equal(s.down.y, s.opened.y, `${size}: the market underneath does not move (${s.opened.y} → ${s.down.y})`);
    assert.ok(s.up.top < s.down.top, `${size}: and back up (${s.down.top} → ${s.up.top})`);
    assert.deepEqual([s.down.open, s.up.open], [true, true], `${size}: the wheel never closes it`);
    assert.equal(s.back.open, false, `${size}: Esc closed the sheet`);
    assert.equal(s.back.url, "/app/jobs", `${size}: back on the market`);
  }
});

test("d168OpenAndBack (real Chrome): the deck's title and an Index row open the same sheet; Back returns to the same card, tab and scroll", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    for (const kind of ["deck", "row"]) {
      const { before, opened, back } = out[size][kind];
      assert.equal(before.open, false, `${size} ${kind}: no sheet before the press`);
      assert.deepEqual([opened.open, opened.sheets, opened.glance], [true, 1, true], `${size} ${kind}: one sheet, drawn`);
      assert.match(opened.path, SHEET, `${size} ${kind}: at /app/jobs/<id> (${opened.path})`);
      assert.equal(opened.deck, true, `${size} ${kind}: the market stays mounted underneath`);
      assert.deepEqual([back.open, back.path, back.search], [false, before.path, before.search], `${size} ${kind}: Back returns to the market's own address`);
      assert.equal(back.count, before.count, `${size} ${kind}: the same card (${before.count} → ${back.count})`);
      assert.equal(back.tab, before.tab, `${size} ${kind}: the same tab (${before.tab} → ${back.tab})`);
      assert.ok(Math.abs(back.y - before.y) <= 2, `${size} ${kind}: the same scroll (${before.y} → ${back.y})`);
    }
  }
});

test("d168NeverStuck (real Chrome): fifty fast presses and Backs, then ten slower ones — never a stuck or doubled sheet", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const f = out[size].fast, fb = out[size].fastBack;
    assert.ok(f.sheets <= 1, `${size}: never two sheets (${f.sheets})`);
    assert.equal(f.open, f.atSheet, `${size}: after the burst the sheet and the address agree (open ${f.open}, ${f.path})`);
    if (f.open) assert.equal(f.glance, true, `${size}: a sheet left up is drawn, not stuck loading`);
    assert.deepEqual([fb.open, fb.path, fb.deck], [false, "/app/jobs", true], `${size}: one Back after the burst returns to the market`);
    assert.equal(fb.count, out[size].start.count, `${size}: on the same card (${out[size].start.count} → ${fb.count})`);
    for (const [i, s] of out[size].slow.entries()) {
      assert.equal(s.open, s.wantOpen, `${size} slow ${i}: open = ${s.wantOpen}`);
      assert.equal(s.atSheet, s.wantOpen, `${size} slow ${i}: the address agrees (${s.path})`);
      assert.ok(s.sheets <= 1, `${size} slow ${i}: one sheet at most`);
    }
  }
});

test("d168NoHoverOpens (real Chrome): resting the pointer on the front card, a back card and two Index rows opens nothing", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const size of SIZES) {
    const h = out[size].node.hover;
    assert.ok(h.points >= 3, `${size}: hovered ${h.points} places`);
    assert.deepEqual([h.open, h.jd, h.asks.length, h.panels], [false, false, 0, 0], `${size}: nothing opened on hover`);
    assert.equal(h.url, "/app/jobs", `${size}: still on the market`);
  }
});

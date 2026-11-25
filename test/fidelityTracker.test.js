// ⭐ D149 RULE 3 · THE COMPUTED STYLES — THE TRACKER (docs/sketches/tracker-options.html: layout 1 on a computer, layout 3
// on a phone). Draft House opened in a real Chrome (stubbed /api with the sketch's six applications, synthetic, Dusk
// Dark, 1280 × 800 and 390 × 844) and its computed values held to the sketch's CSS. The side-by-sides are
// scripts/fidelityShots.mjs tracker; this is the part a reviewer cannot eyeball wrong. Skips (with its reason) on a
// machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const probe = (screen) => fidelityProbe(screen);

const CARD = "rgb(38, 38, 38)", RAISE = "rgb(46, 46, 46)", INK = "rgb(255, 255, 255)", BODY = "rgb(163, 163, 163)";
const ACCENT = "rgb(251, 211, 196)", ON_ACCENT = "rgb(27, 27, 27)", FAINT = "rgb(149, 149, 149)";

test("fidelity · the tracker (tracker-options.html): the page, the header, the counts, the filters, the table, the timeline", { timeout: 200000 }, (t) => {
  const out = probe("tracker");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.canvas.toUpperCase(), "#1B1B1B", `${size}: the page is the sketch's --bg`);
    // .ph3 h1 — 400 44px/1 Instrument Serif, its top at the page's 84 px; the line in body grey, 16.
    assert.match(d.title.family, /^"Instrument Serif"/, `${size}: the title in Instrument Serif`);
    assert.deepEqual([d.title.size, d.title.weight, d.title.lh], ["44px", "400", "44px"], `${size}: the title 400 44/1`);
    // ⭐ D167 (changed on purpose, 45b 21ff9b5): the page starts below a top dock's reserve (--appnav-top-reserve, measured).
    // ⭐ D197 #1 (changed on purpose): below the area nav across the content column's top (the probe's `reserve`).
    // (the sketch's 84 was the old 74 px chrome strip + the page's own 10; the strip reserves nothing now, so: the nav + 10)
    assert.equal(d.title.y, d.dock?.reserve ? d.dock.reserve + 10 : 84, `${size}: the title 10 px under the area nav (the sketch's 84 under its 74 px bar)`);
    assert.deepEqual([d.line.size, d.line.color], ["16px", BODY]);
    // ⭐ 46y (changed on purpose, home-sketch.html — D167 on D146's tracker): the mode moved into the auto-apply bar
    // (.auto .mode: the raised colour, radius 13, 3 in; the chosen side the card colour in the accent, 7 × 12, 13.5);
    // the header's Import / Export are the sketch's .btn (raised, ink, radius 14, 11 × 16, 15) and Send all ready its .btn.p.
    assert.deepEqual([d.mode.bg, d.mode.radius, d.mode.padding, d.mode.border], [RAISE, "13px", "3px", "0px"]);
    assert.deepEqual([d.modeOn.bg, d.modeOn.radius, d.modeOn.padding, d.modeOn.size, d.modeOn.weight, d.modeOn.color], [CARD, "10px", "7px 12px", "13.5px", "600", ACCENT]);
    assert.deepEqual([d.quiet.bg, d.quiet.radius, d.quiet.padding, d.quiet.size, d.quiet.weight, d.quiet.color, d.quiet.border], [RAISE, "14px", "11px 16px", "15px", "600", INK, "0px"]);
    assert.match(d.send.bgImage, /^linear-gradient\(rgb\(251, 211, 196\), rgb\(242, 194, 178\)\)$/, `${size}: Send all ready in the accent's gradient`);
    assert.deepEqual([d.send.color, d.send.radius, d.send.padding, d.send.size, d.send.weight], [ON_ACCENT, "14px", "11px 16px", "15px", "600"]);
    // ⭐ 46y: .auto — the card colour, radius 24, 14 × 18; .nd — the card colour, radius 24, 18; the fixture's three
    // cards in the sketch's order (Needs you · the interview · Ready to send); .tabs — the card colour, radius 16, 4 in,
    // the chosen tab raised in ink.
    assert.deepEqual([d.bar.bg, d.bar.radius, d.bar.padding, d.bar.border], [CARD, "24px", "14px 18px", "0px"]);
    assert.deepEqual([d.need.bg, d.need.radius, d.need.padding], [CARD, "24px", "18px"]);
    assert.deepEqual(d.needKinds, ["need", "interview", "ready"]);
    assert.deepEqual([d.tabs.bg, d.tabs.radius, d.tabs.padding], [CARD, "16px", "4px"]);
    assert.deepEqual([d.tabOn.bg, d.tabOn.size, d.tabOn.weight, d.tabOn.color], [RAISE, "14px", "600", INK]);
    // ⭐ 46y (changed on purpose): the .cnt row is gone — each filter carries its count, 13.5 / 500 in the muted grey.
    assert.equal(d.counts, false, `${size}: no counts row`);
    assert.deepEqual([d.count.size, d.count.weight, d.count.color], ["13.5px", "500", FAINT]);
    assert.equal(d.countText, "6", `${size}: All counts the fixture's six applications`);
    // .flt — 600 13.5 on the card colour, radius 11, 7 × 13; the pressed one raised.
    assert.deepEqual([d.filter.bg, d.filter.radius, d.filter.padding, d.filter.size, d.filter.weight, d.filter.color, d.filter.border], [CARD, "11px", "7px 13px", "13.5px", "600", BODY, "0px"]);
    assert.equal(d.filterOn.bg, RAISE);
    // .tbl — one card, radius 22, no border, no shadow; .th 12 uppercase grey; .tr 14 × 18 (an 84 px row with the folded
    // .det's 12 px gap); the 36 px logo; the company 15 / 600 in Inter Tight; the 7 px dot; "Needs you" in the accent.
    assert.deepEqual([d.table.bg, d.table.radius, d.table.border, d.table.shadow], [CARD, "22px", "0px", "none"], `${size}: the table card, borderless`);
    assert.deepEqual([d.th.size, d.thTransform], ["12px", "uppercase"]);
    assert.deepEqual([d.logo.w, d.logo.h], [36, 36]);
    assert.match(d.company.family, /^"Inter Tight"/, `${size}: the interface face is Inter Tight`);
    assert.deepEqual([d.company.size, d.company.weight, d.company.color], ["15px", "600", INK]);
    assert.deepEqual([d.role.size], ["13px"]);
    assert.deepEqual(d.dot, { w: "7px", h: "7px", radius: "50%" }, `${size}: the status dot is a 7 px circle`);
    assert.equal(d.statusNeeds.color, ACCENT);
    assert.equal(d.hscroll, false, `${size}: no horizontal scroll`);
  }
  const dk = out.desktop, ph = out.phone;
  // Layout 1: the table (the sketch's 882) and the timeline card beside it at 300, 18 apart, tops level.
  // ⭐ D156 (3) (changed on purpose): the dock is a rail always visible at the left, and the app shell gives it its room
  // (72 px at 1280) — the page is the sketch's layout in what is left: the table from 72 + 20, taking the width the
  // timeline leaves (850 here, the sketch's 882 before the rail), the timeline 300 wide beside it, 18 apart, tops level.
  // ⭐ D167 (changed on purpose, 45b 21ff9b5): "the dock never pushes the page" — the rail and its room are gone, so the
  // table is the sketch's own 882 again, and the table + 18 + the 300 timeline are one group centred in the 1280 (D163).
  // ⭐ 46q FULL WIDTH (owner 11-16, changed on purpose): the page fills the 1280 inside the page gutter (3vw = 38.4), so
  // the table takes what the 18 + 300 timeline leave — no longer the sketch's 882 centred.
  // ⭐ D197 #1 · A237 (changed on purpose): the content column starts beside the rail (14 + 84 = 98 px), the page gutter
  // (3vw of the viewport = 38.4) inside it
  assert.equal(dk.table.x, 98 + 38, "the table starts at the page gutter, beside the rail");
  // ⭐ 46y (changed on purpose, home-sketch.html's .grid2): the timeline is 320 wide.
  assert.equal(dk.table.w, Math.round(1280 - 98 - 2 * 38.4 - 18 - 320), "the table takes the width the timeline leaves");
  assert.equal(dk.row.h, 84, "a row is the sketch's 84: 14 + the 44 px position + the folded .det's 12 px gap + 14");
  // ⭐ 46q: the 38.4 px gutter puts the edges on sub-pixels — the measured x / w are rounded, so the sum may be one off.
  // ⭐ 46y (changed on purpose): the tabs and filters sit in the table's column, so the timeline is level with the TABS.
  assert.deepEqual([dk.timeline.w, dk.timeline.y], [320, dk.tabs.y], "the timeline 320 wide, level with the tabs");
  assert.ok(Math.abs(dk.timeline.x - (dk.table.x + dk.table.w + 18)) <= 1, `the timeline beside, 18 apart (${dk.timeline.x} vs ${dk.table.x + dk.table.w + 18})`);
  assert.deepEqual([dk.timeline.bg, dk.timeline.radius, dk.timeline.padding, dk.timeline.border, dk.timeline.shadow], [CARD, "24px", "18px", "0px", "none"]);
  assert.deepEqual([dk.tlTitle.size, dk.tlTitle.weight], ["15px", "600"]);
  assert.deepEqual([dk.bubble.w, dk.bubble.h], [30, 30], "the timeline's 30 px bubbles");
  assert.equal(dk.phoneSwitch, false, "no switch on a computer");
  // Layout 3: the switch, the table alone, full width inside the 20 px gutters.
  assert.equal(ph.phoneSwitch, true, "the Applications · Auto-apply timeline switch on a phone");
  assert.equal(ph.timeline.shown, false, "the timeline waits behind the switch");
  // ⭐ D167 (changed on purpose, 45b 21ff9b5): a phone's dock is at the top, so no rail: the page's 20 each side.
  // ⭐ 46q FULL WIDTH (changed on purpose): the page gutter's phone minimum, 16 each side.
  assert.deepEqual([ph.table.x, ph.table.w], [16, 358]);
  assert.equal(ph.title.x, ph.table.x, "the title starts where the table does");
});

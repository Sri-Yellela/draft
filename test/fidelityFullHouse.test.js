// ⭐ D149 RULE 3 · FULL HOUSE + THE OPENED POSTING (docs/sketches/fullhouse-declutter.html), COMPUTED STYLES. The app screen
// opened in a real Chrome (stubbed /api, synthetic data, Dusk Dark, 1280 × 800 and 390 × 844, the first posting open — the
// screen's appPrep), its computed values asserted against the sketch's. The visual side-by-sides are
// scripts/fidelityShots.mjs fullhouse; this is the part a reviewer cannot eyeball wrong. Skips (with its reason) on a
// machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const probe = (screen) => JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", screen],
  { encoding: "utf8", timeout: 180000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());

const CARD = "rgb(38, 38, 38)", RAISE = "rgb(46, 46, 46)", ACCENT = "rgb(251, 211, 196)", INK = "rgb(255, 255, 255)", BODY = "rgb(163, 163, 163)";
const SERIF = /^"Instrument Serif"/, UI = /^"Inter Tight"/;

test("fidelity · Full House + the posting (fullhouse-declutter.html): page, header, rows, the posting, its facts, its actions", { timeout: 200000 }, (t) => {
  const out = probe("fullhouse");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.canvas.toUpperCase(), "#1B1B1B", `${size}: the page is the sketch's --bg`);
    assert.equal(d.fonts.serif && d.fonts.ui, true, `${size}: Instrument Serif and Inter Tight are loaded, not their fallbacks`);
    // The header: the ONE Sort word, the sentence, the search, the counts. ⭐ D152 (1), changed on purpose: Full House is
    // Home's board column now (home-sketch.html) — no "Full House" title (test/d152Home.test.js).
    assert.equal(d.title, null, `${size}: no page title on Home`);
    // ⭐ D156 (5) (changed on purpose): no "Sort: …" word — the sort is an icon inside the search (test/d156Home.test.js).
    assert.equal(d.sort, null, `${size}: no Sort word at the top`);
    // ⭐ D156 (1d) (changed on purpose): the sentence's ORIGINAL type and marked look (67be9da) — the logo face, its words
    // in ink over the quiet accent's .16em highlighter underline, each an inline box with a transparent 1px edge.
    assert.match(d.sentence.family, /^Poppins/, `${size}: the sentence in the logo face`);
    assert.equal(d.sentence.color, BODY);
    assert.equal(d.sentence.word.color, INK, `${size}: its words in ink`);
    assert.match(d.sentence.word.underline, /^rgb\(58, 46, 41\) 0px -[\d.]+px 0px 0px inset$/, `${size}: the quiet-accent highlighter underline`);
    assert.match(d.sentence.word.border, /^1px solid rgba\(0, 0, 0, 0\)/, `${size}: the original transparent edge`);
    assert.deepEqual([d.search.bg, d.search.radius, d.search.border, d.search.shadow, d.search.glyph, d.search.inputSize],
      [CARD, "14px", "0px", "none", true, "16px"], `${size}: the search is the field — ⭐ D156 (5): with the sort icon inside it`);
    assert.equal(d.search.placeholder, "Search a company, title or skill");
    assert.deepEqual(d.counts.map(c => [c.n, c.label]), [["746", "jobs"], ["38", "new today"], ["12", "saved"]]);
    assert.deepEqual(d.counts.map(c => [c.size, c.weight]), Array(3).fill(["30px", "500"]));
    assert.equal(d.counts[1].color, ACCENT, `${size}: "new today" in the accent`);
    // The rows.
    // ⭐ D152 (5), changed on purpose: where the list is two columns (a phone here — its posting is the screen, not beside
    // the list) a row is Home's bubble, corner 22, padding 16; beside an open posting (the computer) the one column keeps
    // the row's 20 / 14 16.
    // ⭐ D152 (6): the list keeps its pairs at both widths now (the posting opens in place of it, not beside it).
    const bubble = true;
    // ⭐ D156 (1b) (changed on purpose): D1's bubble padding, 16 / 20 (c6bd1124's JobBubble.css).
    assert.deepEqual([d.row.bg, d.row.radius, d.row.border, d.row.shadow, d.row.padding],
      [CARD, bubble ? "22px" : "20px", "0px", "none", bubble ? "16px 20px" : "14px 16px"],
      `${size}: a row is the card, no border, no shadow`);
    // Rows apart on a phone, one bubble per row (D1's phone rule); on a computer the pair sits side by side.
    if (size === "phone") assert.equal(d.row.gap, 14, `${size}: rows 14px apart`);
    assert.match(d.row.outline, /solid rgb\(251, 211, 196\)$/, `${size}: the open row is outlined in the accent`);
    assert.match(d.row.title.family, UI); assert.deepEqual([d.row.title.size, d.row.title.weight, d.row.title.color], ["15px", "600", INK]);
    assert.deepEqual([d.row.sub.size], ["13px"]); assert.deepEqual([d.row.meta.size, d.row.meta.color], ["12.5px", BODY]);
    assert.deepEqual([d.row.match.size, d.row.match.weight, d.row.match.color, d.row.matchText], ["22px", "500", ACCENT, "86%"]);
    // The opened posting.
    assert.deepEqual([d.panel.bg, d.panel.border, d.panel.shadow], [CARD, "0px", "none"], `${size}: the posting is the card — no edge, no glass shadow`);
    assert.match(d.panel.title.family, SERIF); assert.deepEqual([d.panel.title.size, d.panel.title.weight], ["36px", "400"]);
    assert.match(d.panel.company.family, UI); assert.deepEqual([d.panel.company.size, d.panel.company.weight, d.panel.company.style], ["16px", "600", "normal"]);
    // ⭐ D156 (1c): on a computer the posting is the deck card's long post — its Close says "Fold it back".
    assert.deepEqual([d.panel.close.text, d.panel.close.bg, d.panel.close.radius, d.panel.close.size],
      [size === "phone" ? "Close" : "Fold it back", RAISE, "10px", "13.5px"]);
    assert.deepEqual([d.panel.facts.bg, d.panel.facts.radius, d.panel.facts.border], [RAISE, "18px", "0px"], `${size}: one raised facts box, corner 18`);
    assert.deepEqual(d.panel.facts.cells, ["experience", "workstyle", "salary", "posted"]);
    assert.deepEqual([d.panel.facts.value.size, d.panel.facts.value.weight, d.panel.facts.value.color], ["16.5px", "500", INK]);
    assert.deepEqual([d.panel.facts.label.size], ["12.5px"]);
    assert.deepEqual([d.panel.match.size, d.panel.match.weight, d.panel.match.color, d.panel.match.caption], ["24px", "500", ACCENT, "match"],
      `${size}: the match box — 24px accent over "match"`);
    assert.deepEqual([d.panel.eyebrow.text, d.panel.eyebrow.color, d.panel.eyebrow.size], ["The posting", ACCENT, "14px"]);
    assert.match(d.panel.body.family, UI, `${size}: the description in the interface face, not Georgia`);
    assert.deepEqual([d.panel.body.size, d.panel.body.color], ["15px", BODY]);
    assert.deepEqual([d.panel.heading.color, d.panel.heading.size], [INK, "15px"], `${size}: their headings are plain ink lines`);
    const [pass, save, draft] = d.panel.actions;
    for (const b of [pass, save, draft]) assert.deepEqual([b.bg, b.image, b.radius], [RAISE, "none", "16px"], `${size}: ${b.name}`);
    for (const b of [pass, save]) assert.deepEqual([b.size, b.weight, b.color], ["15.5px", "600", INK], `${size}: ${b.text}`);
    assert.deepEqual([pass.text, save.text, d.panel.more.text], ["Pass", "Save", "More"]);
    // D164 (owner 11-05): the one quiet Résumé control is back beside Draft, on More's own surface (changed on purpose).
    assert.match(d.panel.resume?.text || "", /^Résumé/, `${size}: the Résumé control is on the posting`);
    assert.deepEqual([d.panel.resume.bg, d.panel.resume.radius], [d.panel.more.bg, d.panel.more.radius], `${size}: Résumé wears More's surface`);
    // D149 (owner 11-04, "/draft logo"): Draft is the /draft mark on the raised grey, named "Draft" — not the sketch's
    // plain word on the accent gradient (changed on purpose).
    assert.deepEqual([draft.mark, draft.label], [true, "Draft"], `${size}: Draft is the /draft logo button`);
    assert.deepEqual([d.panel.more.bg, d.panel.more.color, d.panel.more.radius], [RAISE, BODY, "16px"]);
    // ⭐ A217 (owner 11-17, "pin it"): the actions PIN to the panel's foot — the sketch did not (changed on purpose).
    assert.equal(d.panel.pinnedFoot, "sticky", `${size}: the actions stay in view at the panel's foot`);
    // The sketch's vertical rhythm inside the posting.
    const b = d.panel.boxes;
    const near = (got, want, msg) => assert.ok(Math.abs(got - want) <= 1, `${msg} (${got})`);   // boxes are rounded to whole px
    near(b.title.top - (b.co.top + b.co.height), 16, `${size}: 16px from the header to the role`);
    near(b.eyebrow.top - (b.facts.top + b.facts.height), 20, `${size}: 20px under the facts box`);
    // ⭐ A217 (owner 11-17, "pin it"): where the posting is taller than its panel (the phone), the pinned actions sit OVER
    // the posting's end (it scrolls under them); the sketch's 18px rhythm holds only where nothing is stuck.
    const stuck = b.actions.top < b.body.top + b.body.height;
    if (!stuck) near(b.actions.top - (b.body.top + b.body.height), 18, `${size}: the actions 18px under the posting`);
    else assert.ok(b.actions.height > 0, `${size}: the pinned actions are drawn over the posting's end`);
  }
  // Desktop. ⭐ D152 (6) / D153 (1), changed on purpose (11-04): the posting opens IN PLACE of the list — it takes Home's
  // whole board column (486–1240 at 1280: the deck's 390 + the 56 gap after the 40 padding), never over the deck, and is
  // as tall as its content (it scrolls with the page, as the list did); the list stays mounted, folded away
  // (test/d152Home.test.js walks the open and the close).
  // ⭐ D156 (1c) (changed on purpose, owner 11-05: "the card can turn into the long post"): the posting is drawn ON THE
  // DECK, in the front card's place — the deck's column (from the rail's 72 + the page's 24, 390 wide), the card's corner.
  const D = out.desktop;
  // ⭐ D167 (changed on purpose, 45b f7a67c3): "the dock never pushes the page" — the 72 px rail is gone; at 1280 the dock
  // is a row at the top, so the deck's column starts at the page's own 24.
  assert.equal(D.dock?.place, "top", "the dock sits at the top at 1280");
  // ⭐ 46q FULL WIDTH (changed on purpose): the page gutter at 1280 is 3vw = 38.4 (was Home's 24).
  assert.deepEqual([D.panel.left, D.panel.width], [38, 390], "the posting is drawn in the deck's column");
  assert.deepEqual([D.panel.radius, D.panel.padding], ["26px", "24px 24px 20px"], "the posting's card, the deck card's corner");
  // Phone: the posting is the screen.
  const P = out.phone.panel;
  assert.deepEqual([P.left, P.top, P.width, P.height, P.radius, P.padding], [0, 0, 390, 844, "0px", "70px 20px 30px"]);
});

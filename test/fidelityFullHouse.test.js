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
    // The header: the title, the ONE Sort word, the sentence, the search, the counts.
    assert.match(d.title.family, SERIF); assert.equal(d.title.size, "44px"); assert.equal(d.title.weight, "400");
    assert.equal(d.title.top, 84, `${size}: the title at the sketch's 84 px`);
    assert.deepEqual([d.sort.bg, d.sort.radius, d.sort.border, d.sort.size, d.sort.weight, d.sort.color, d.sort.glyph],
      [CARD, "12px", "0px", "14px", "600", BODY, false], `${size}: "Sort: …" is the sketch's quiet box — no edge, no glyph`);
    assert.match(d.sort.text, /^Sort: /);
    assert.match(d.sentence.family, SERIF, `${size}: the sentence in the serif`);
    assert.equal(d.sentence.color, BODY);
    assert.equal(d.sentence.word.color, INK, `${size}: its words in ink`);
    assert.equal(d.sentence.word.underline, "rgb(251, 211, 196) 0px -1.5px 0px 0px inset", `${size}: underlined 1.5px in the accent`);
    assert.match(d.sentence.word.border, /^0px /, `${size}: no box edge around a word`);
    assert.deepEqual([d.search.bg, d.search.radius, d.search.border, d.search.shadow, d.search.glyph, d.search.inputSize],
      [CARD, "14px", "0px", "none", false, "16px"], `${size}: the search is the field alone`);
    assert.equal(d.search.placeholder, "Search a company, title or skill");
    assert.deepEqual(d.counts.map(c => [c.n, c.label]), [["746", "jobs"], ["38", "new today"], ["12", "saved"]]);
    assert.deepEqual(d.counts.map(c => [c.size, c.weight]), Array(3).fill(["30px", "500"]));
    assert.equal(d.counts[1].color, ACCENT, `${size}: "new today" in the accent`);
    // The rows.
    assert.deepEqual([d.row.bg, d.row.radius, d.row.border, d.row.shadow, d.row.padding], [CARD, "20px", "0px", "none", "14px 16px"],
      `${size}: a row is the card, corner 20, no border, no shadow`);
    assert.equal(d.row.gap, 8, `${size}: rows 8px apart`);
    assert.match(d.row.outline, /solid rgb\(251, 211, 196\)$/, `${size}: the open row is outlined in the accent`);
    assert.match(d.row.title.family, UI); assert.deepEqual([d.row.title.size, d.row.title.weight, d.row.title.color], ["15px", "600", INK]);
    assert.deepEqual([d.row.sub.size], ["13px"]); assert.deepEqual([d.row.meta.size, d.row.meta.color], ["12.5px", BODY]);
    assert.deepEqual([d.row.match.size, d.row.match.weight, d.row.match.color, d.row.matchText], ["22px", "500", ACCENT, "86%"]);
    // The opened posting.
    assert.deepEqual([d.panel.bg, d.panel.border, d.panel.shadow], [CARD, "0px", "none"], `${size}: the posting is the card — no edge, no glass shadow`);
    assert.match(d.panel.title.family, SERIF); assert.deepEqual([d.panel.title.size, d.panel.title.weight], ["36px", "400"]);
    assert.match(d.panel.company.family, UI); assert.deepEqual([d.panel.company.size, d.panel.company.weight, d.panel.company.style], ["16px", "600", "normal"]);
    assert.deepEqual([d.panel.close.text, d.panel.close.bg, d.panel.close.radius, d.panel.close.size], ["Close", RAISE, "10px", "13.5px"]);
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
    for (const b of [pass, save]) assert.deepEqual([b.bg, b.image, b.radius, b.size, b.weight, b.color], [RAISE, "none", "16px", "15.5px", "600", INK], `${size}: ${b.text}`);
    assert.deepEqual([pass.text, save.text, draft.text, d.panel.more.text], ["Pass", "Save", "Draft", "More"]);
    assert.equal(draft.image, "linear-gradient(rgb(251, 211, 196), rgb(242, 194, 178))", `${size}: Draft on the accent gradient`);
    assert.equal(draft.color, "rgb(27, 27, 27)");
    assert.deepEqual([d.panel.more.bg, d.panel.more.color, d.panel.more.radius], [RAISE, BODY, "16px"]);
    assert.equal(d.panel.pinnedFoot, "static", `${size}: the actions follow the posting (the sketch does not pin them)`);
    // The sketch's vertical rhythm inside the posting.
    const b = d.panel.boxes;
    const near = (got, want, msg) => assert.ok(Math.abs(got - want) <= 1, `${msg} (${got})`);   // boxes are rounded to whole px
    near(b.title.top - (b.co.top + b.co.height), 16, `${size}: 16px from the header to the role`);
    near(b.eyebrow.top - (b.facts.top + b.facts.height), 20, `${size}: 20px under the facts box`);
    near(b.actions.top - (b.body.top + b.body.height), 18, `${size}: the actions 18px under the posting`);
  }
  // Desktop: the posting BESIDE the list, in the sketch's columns (1240 page, 20px gutters, 1fr : 1.05fr, 18px apart).
  const D = out.desktop;
  assert.deepEqual([D.row.left, D.row.width], [40, 577], "the list column");
  assert.deepEqual([D.panel.left, D.panel.width, D.panel.radius, D.panel.padding], [635, 605, "28px", "24px 24px 20px"], "the posting column");
  assert.equal(D.panel.top, D.row.top, "the posting's top is the first row's");
  assert.equal(D.panel.height, 690, "the sketch's calc(100vh - 110px)");
  // Phone: the posting is the screen.
  const P = out.phone.panel;
  assert.deepEqual([P.left, P.top, P.width, P.height, P.radius, P.padding], [0, 0, 390, 844, "0px", "70px 20px 30px"]);
});

// ⭐ D149 RULE 3 · THE COMPUTED STYLES, PER SCREEN — the app screen opened in a real Chrome (stubbed /api, synthetic data,
// Dusk Dark, 1280 × 800 and 390 × 844) and its computed values asserted against the sketch's. The visual side-by-sides
// are scripts/fidelityShots.mjs; this is the part a reviewer cannot eyeball wrong. Skips (with its reason) on a machine
// with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const probe = (screen) => JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", screen],
  { encoding: "utf8", timeout: 180000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());

test("fidelity · the deck (declutter-v7.html): the page, the card, its type, the Draft button — no bar, no controls row", { timeout: 200000 }, (t) => {
  const out = probe("deck");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.canvas.toUpperCase(), "#1B1B1B", `${size}: the page is the sketch's --bg`);
    assert.equal(d.topBar, "rgba(0, 0, 0, 0)", `${size}: no top bar band — the mark floats`);
    assert.equal(d.controlsRow, false, `${size}: no controls row above the card`);
    assert.equal(d.card.bg, "rgb(38, 38, 38)", `${size}: the card is the sketch's --card`);
    assert.equal(d.card.radius, "28px", `${size}: card radius 28`);
    assert.equal(d.card.border, "0px", `${size}: no border on the card`);
    assert.equal(d.card.shadow, "rgba(0, 0, 0, 0.35) 0px 30px 70px 0px", `${size}: the sketch's one shadow`);
    assert.equal(d.card.top, 90, `${size}: the card's top at the sketch's 90 px`);
    assert.match(d.title.family, /^"Instrument Serif"/, `${size}: the title in Instrument Serif`);
    assert.equal(d.title.size, "42px", `${size}: the title at 42 px`);
    assert.equal(d.title.weight, "400");
    assert.match(d.company.family, /^"Inter Tight"/, `${size}: the interface face is Inter Tight`);
    assert.deepEqual([d.company.size, d.company.weight], ["17px", "600"]);
    assert.deepEqual([d.draft.bg, d.draft.color], ["rgb(251, 211, 196)", "rgb(27, 27, 27)"], `${size}: Draft in the accent, its dark label`);
  }
  assert.equal(out.phone.card.width, 366, "the phone card is the sketch's 366");
  // 1280 is the two-panel layout (the report opens beside the card): its column is 612, not the sketch's 640 — the one
  // measured difference, recorded for the owner's sign-off.
  assert.ok(out.desktop.card.width >= 600 && out.desktop.card.width <= 640, `desktop card ${out.desktop.card.width}`);
});

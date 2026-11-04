// ⭐ D149 RULE 3 · THE COMPUTED STYLES, PER SCREEN — the app screen opened in a real Chrome (stubbed /api, synthetic data,
// Dusk Dark, 1280 × 800 and 390 × 844) and its computed values asserted against the sketch's. The visual side-by-sides
// are scripts/fidelityShots.mjs; this is the part a reviewer cannot eyeball wrong. Skips (with its reason) on a machine
// with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const probe = (screen) => JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", screen],
  { encoding: "utf8", timeout: 180000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());

// ⭐ D152 (1) / (2), changed on purpose (11-04): /app is HOME, and the deck is its left column — home-sketch.html's .card
// (300 × 420, corner 26, 22 22 18 padding, a 15 px company, the 30 px serif title, 44 px from the top of the screen) now,
// not declutter-v7.html's 640 × 232 (D152: Home replaces D149's first two screens).
test("fidelity · the deck on Home (home-sketch.html): the page, the card, its type, the Draft button — no bar, no controls row", { timeout: 200000 }, (t) => {
  const out = probe("deck");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.equal(d.canvas.toUpperCase(), "#1B1B1B", `${size}: the page is the sketch's --bg`);
    assert.equal(d.topBar, "rgba(0, 0, 0, 0)", `${size}: no top bar band — the mark floats`);
    assert.equal(d.controlsRow, false, `${size}: no controls row above the card`);
    assert.equal(d.card.bg, "rgb(38, 38, 38)", `${size}: the card is the sketch's --card`);
    assert.equal(d.card.radius, "26px", `${size}: card radius 26`);
    assert.equal(d.card.border, "0px", `${size}: no border on the card`);
    assert.equal(d.card.shadow, "rgba(0, 0, 0, 0.35) 0px 30px 70px 0px", `${size}: the sketch's one shadow`);
    // The sketch's padding (44; a phone's 28) + its count line ("1 of 10 today · best match first", 20 px) + 12 px under it.
    assert.equal(d.card.top, size === "phone" ? 60 : 76, `${size}: the card's top under the sketch's count line`);
    assert.match(d.title.family, /^"Instrument Serif"/, `${size}: the title in Instrument Serif`);
    assert.equal(d.title.size, "30px", `${size}: the title at 30 px`);
    assert.equal(d.title.weight, "400");
    assert.match(d.company.family, /^"Inter Tight"/, `${size}: the interface face is Inter Tight`);
    assert.deepEqual([d.company.size, d.company.weight], ["15px", "600"]);
    assert.deepEqual([d.draft.bg, d.draft.color], ["rgb(251, 211, 196)", "rgb(27, 27, 27)"], `${size}: Draft in the accent, its dark label`);
  }
  assert.equal(out.phone.card.width, 250, "the phone card: the column (330) less the fan's 80");
  assert.equal(out.desktop.card.width, 300, "the computer's card is the sketch's 300");
});

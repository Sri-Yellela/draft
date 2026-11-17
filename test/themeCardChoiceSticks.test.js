// ⭐ 46t (owner 11-17: "i logged in but the light themes just wont switch on, plain light is theme, fix that"). With
// "follow my system" on (the default — Dusk is a pair), pressing a LIGHT card saved its pair, and on a dark device the
// pair resolved to the DARK theme: the card the person pressed never showed. The card is now saved itself whenever its
// pair would not land on it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THEMES, resolve, pairPreference } from "../client/src/themes/index.js";

const dark = () => ({ matches: true }), light = () => ({ matches: false });

test("the mechanism: on a dark device a light card's pair resolves to the dark theme", () => {
  for (const id of ["plain-light", "dusk-light"]) {
    const t = THEMES[id];
    assert.notEqual(resolve(pairPreference(t), dark).id, id, `${id}'s pair on a dark device`);
    assert.equal(resolve(pairPreference(t), light).id, id, `${id}'s pair on a light device`);
  }
});

test("a card is saved as itself when its pair would not land on it, and following turns off", () => {
  const src = fs.readFileSync(new URL("../client/src/components/AppearanceSettings.jsx", import.meta.url), "utf8");
  assert.match(src, /const keepFollow = follow && resolve\(pairPreference\(t\)\)\.id === t\.id;/);
  assert.match(src, /if \(follow && !keepFollow\) setFollow\(false\);/);
  assert.match(src, /saveAppearance\(\{ pref: keepFollow \? pairPreference\(t\) : t\.id, cues: cur\.cues \}\);/);
});

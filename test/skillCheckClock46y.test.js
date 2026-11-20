import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ⭐ 46y (the real-Chrome walk scripts/walkQuickCheck46y.mjs, Atlas → Your skills → "Check it · 1 min" at 400 px): the quick
// check's clock read "75" over "s" — the card sets overflow-wrap: anywhere (so a long word never pushes the phone sideways),
// and the header's flex row let the long title squeeze the clock until it broke inside "75s". The clock now keeps its width
// and never breaks; the title (min-width: 0) wraps instead. The walk asserts the clock's text sits on one line.

const css = fs.readFileSync("client/src/components/SkillCheck.css", "utf8").replace(/\r\n/g, "\n");
const rule = (sel) => (css.match(new RegExp(`^${sel.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`, "m")) || [])[1] || "";

test("skillCheckClock46y — the clock never breaks or shrinks; the title is the one that wraps", () => {
  const clock = rule(".skc__clock");
  assert.match(clock, /flex: none;/);
  assert.match(clock, /white-space: nowrap;/);
  assert.match(clock, /overflow-wrap: normal;/, "the card's overflow-wrap: anywhere is undone for the clock alone");
  assert.match(rule(".skc__title"), /min-width: 0;/);
  assert.match(rule(".skc"), /overflow-wrap: anywhere;/, "the card itself still wraps anything long (phone width)");
});

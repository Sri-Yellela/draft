// 46a (owner 11-10, docs/sketches/Screenshot 2026-11-10 001237.png: "the box is going out of bounds") · the posting's
// "Résumé for this job" menu was absolute, right-aligned to the button, 320 px wide — in the deck's narrow card it ran past
// the card's left edge and the card's overflow cut it off. It now opens through the shared DockPortal: document.body,
// fixed, clamped to the viewport.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("the résumé menu opens through DockPortal, anchored on the split button, never absolute inside the card", () => {
  const jsx = fs.readFileSync("client/src/components/ByomResumeChoice.jsx", "utf8");
  assert.match(jsx, /import \{ DockPortal \} from "\.\/DockPortal\.jsx";/);
  assert.match(jsx, /<DockPortal anchorRect=\{anchor\} onClose=\{\(\) => setOpen\(false\)\}/);
  assert.match(jsx, /wrap\.current\.getBoundingClientRect\(\)/, "anchored on the split button's own box");
  assert.doesNotMatch(jsx, /document\.addEventListener\("pointerdown", close\)/, "no second outside-click listener that would close the portalled menu on its own options");
  const css = fs.readFileSync("client/src/components/ByomResumeChoice.css", "utf8");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /\.byom__pop\s*\{[^}]*position:\s*absolute/, "the menu is no longer positioned inside the card");
  const portal = fs.readFileSync("client/src/components/DockPortal.jsx", "utf8");
  assert.match(portal, /left = Math\.max\(12, Math\.min\(left, vw - panelWidth - 12\)\)/, "the portal clamps to the viewport");
  assert.match(portal, /createPortal\(/);
});

// ⭐ 47h (47f's known gap 4 (a)) · PLAIN'S PEOPLE GET NO TINTS ON PLATE PAGES.
// styles/plate.css has mapped `.plate[data-plain]` to D181's no-tints since D196 P0 (the region tint and ring fall back to
// warm paper and the rule), but no live plate page ever set it: telling Plain apart needs a theme decision, and only
// themes/index.js may decide a theme (inkPairD32). It now exports NO_TINTS (the live theme is one of Plain's two), and
// PlateRoot — every plate page's root — takes it as its `plain` default. The gallery's ?plain=1 still overrides.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("47h · themes/index.js decides NO_TINTS from the live theme; PlateRoot wears it by default", () => {
  assert.match(read("client/src/themes/index.js"), /export const NO_TINTS = PLAIN_IDS\.includes\(ACTIVE_THEME\.id\);/);
  const root = read("client/src/plate/PlateRoot.jsx");
  assert.match(root, /import \{ NO_TINTS \} from "\.\.\/themes\/index\.js";/);
  assert.match(root, /export default function PlateRoot\(\{ region = "IV", plain = NO_TINTS,/);
  assert.match(root, /data-plain=\{plain \? "" : undefined\}/);
  assert.doesNotMatch(root, /PLAIN_IDS|matchMedia|localStorage/, "PlateRoot reads the flag; it never decides a theme");
  assert.match(read("client/src/styles/plate.css"), /\.plate\[data-plain\] \{ --pl-region-tint: var\(--pl-paper-warm\); --pl-region-ring: var\(--pl-rule\);/);
});

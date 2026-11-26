// ⛔ Owner 11-06: "the search on draft screen has an extra X mark, one already comes on when I start search, and after
// search it doesnt go back to all jobs. its stuck on searched term results." Walked in real Chrome on the bundled
// BoardSearch (45c): one ✕; Enter searches; deleting the text, Esc and the ✕ each bring back all jobs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("boardSearchOneClearButton: the browser's own clear button on the search field is hidden — ours is the one", () => {
  // ⛔ 47j w1-market (changed on purpose): BoardSearch is drawn as the plate field (.pl-mk-field, plate/plate.css)
  const css = read("client/src/plate/plate.css");
  assert.match(css, /\.pl-mk-field input\[type="search"\]::-webkit-search-cancel-button,\n\.pl-mk-field input\[type="search"\]::-webkit-search-decoration \{ -webkit-appearance: none; appearance: none; display: none; \}/);
  assert.match(read("client/src/components/BoardBar.jsx"), /className="pl-mk-field__clear"/);
});

test("boardSearchEmptiedBringsBackAllJobs: emptying the field while a search is in force commits the empty search", () => {
  const s = read("client/src/components/BoardBar.jsx");
  assert.match(s, /const change = \(v\) => \{ setQ\(v\); if \(!String\(v\)\.trim\(\) && committed\.current\) commit\(""\); \};/);
  // D179 (45l; pin brought to the code in 45o): the role / technology picks ride on the same suggest.
  assert.match(s, /<UsbSuggest field="title" value=\{q\} onChange=\{change\} onPickRole=\{onPickRole\} onPickTech=\{onPickTech\}>/, "every edit goes through it");
  assert.match(s, /else if \(e\.key === "Escape" && q\) \{ e\.preventDefault\(\); change\(""\); \}/, "Esc clears");
  assert.match(s, /onClick=\{\(\) => \{ setQ\(""\); commit\(""\); \}\}/, "the ✕ clears");
});

// A53 — the surfaces built before the rebrand are on the deck's look now, and stay there.
//
// Measured before: Auto Apply, Job Profiles, Database, the Recruiter view and the board's dialogs set
// Barlow Condensed ExtraBold capitals inline (36 style objects); every .rm-btn was the "Lucy tin"
// button (Barlow capitals in a 2.5px ink box with square corners); Job Profiles, Database and the
// Recruiter view sat under a glass sheet (theme.bg / --color-bg) the board shed on 09-30.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const SWEPT = [
  "client/src/panels/JobsPanel.jsx", "client/src/components/JobCard.jsx", "client/src/components/JobDetailPanel.jsx",
  "client/src/panels/AutoApplyPanel.jsx", "client/src/panels/AutoApplyPanelSections.jsx",
  "client/src/panels/JobProfilesPanel.jsx", "client/src/panels/DatabasePanel.jsx", "client/src/panels/RecruiterPanel.jsx",
  "client/src/components/CoverLetterModal.jsx", "client/src/components/DomainProfileWizard.jsx",
  "client/src/components/ui/TileCard.jsx", "client/src/components/DecisionButtons.jsx",
];

export function preRebrandType(src) {
  return /Barlow Condensed|'DM Sans'/.test(code(src));
}

test("no swept surface sets the pre-rebrand type inline", () => {
  for (const p of SWEPT) assert.ok(!preRebrandType(read(p)), `${p} still sets Barlow Condensed / DM Sans`);
  // Seen red:
  assert.ok(preRebrandType(`<h2 style={{ fontFamily: "'Barlow Condensed',sans-serif" }}>Auto Apply</h2>`));
  assert.ok(!preRebrandType(`// was Barlow Condensed capitals`));
});

test("the page titles use the deck's type scale", () => {
  const type = read("client/src/styles/type.js");
  assert.match(type, /PAGE_TITLE: \{ fontFamily: FONT\.DISPLAY, fontWeight: 400/);
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /<h2 style=\{TYPE\.PAGE_TITLE\}>/);
  assert.match(read("client/src/panels/RecruiterPanel.jsx"), /<h1 style=\{TYPE\.PAGE_TITLE\}>/);
  assert.match(read("client/src/panels/JobProfilesPanel.jsx"), /<h1 style=\{\{ \.\.\.TYPE\.PAGE_TITLE/);
});

test(".rm-btn is the deck's button: a pill in the body font, primary is the orange FILL with ink text", () => {
  const css = read("client/src/themes/cinematic.js");
  const block = css.slice(css.indexOf("        .rm-btn {"), css.indexOf("        .rm-input {"));
  assert.doesNotMatch(block, /Barlow|text-transform: uppercase|2\.5px/, "the Lucy-tin button is back");
  assert.match(block, /border-radius: 999px/);
  assert.match(block, /\.rm-btn-primary \{\s*background-image: none; background-color: \$\{C\.ACCENT\};\s*color: \$\{C\.ON_ACCENT\}; border-color: \$\{C\.ACCENT_INK\};/);
});

test("no glass sheet under the swept pages — the leather is the substrate", () => {
  assert.doesNotMatch(read("client/src/panels/JobProfilesPanel.jsx"), /padding:"24px 28px", background:"var\(--color-bg\)"/);
  assert.doesNotMatch(read("client/src/panels/RecruiterPanel.jsx"), /background: "var\(--color-bg\)"/);
  assert.doesNotMatch(read("client/src/panels/DatabasePanel.jsx"), /overflow:"hidden", background:theme\.bg \}\}/);
});

test("⛔ the active tile ring is ACCENT_INK — the logo orange fails 3:1 as a UI boundary", () => {
  const tile = code(read("client/src/components/ui/TileCard.jsx"));
  assert.match(tile, /active \? C\.ACCENT_INK : C\.GLASS_RIM/);
  assert.doesNotMatch(tile, /active \? "var\(--color-primary\)"/);
});

test("a board card never runs off a phone: the grid floor is clamped to the row", () => {
  assert.match(read("client/src/components/ui/TileCard.jsx"), /minmax\(min\(100%, max\(\$\{min\}px,/);
});

// ── TASK AC3: company cards in the ManageJobProfiles idiom ───────────────────────────────────
//
// The company tier was a HEADING followed by full-width application cards, one per row down the
// whole page — four employers took four screens and no two could be compared. JobProfilesPanel had
// already solved that shape.
//
// The requirement is specific about HOW: "Read ManageJobProfiles and REUSE its card primitive. Do
// not clone the styling into a second implementation; if it is not extractable, say so and report
// why before diverging." So what is asserted here is mostly the REUSE, not the appearance — a
// second implementation that happens to look identical today is the failure mode, and it is
// invisible to a screenshot. The appearance is checked in a real browser by scripts/abPanelUi.mjs,
// which drives BOTH panels so the profile cards can be shown unchanged after the extraction.
//
// IT WAS EXTRACTABLE. The card was inline JSX rather than a component, but it was already a clean
// four-part shape with no profile-specific logic in its LAYOUT: header (title + pill), metadata
// line, inset sub-block, footer action row. Everything profile-specific — the resume upload input,
// the Edit/Switch/Delete handlers — is content, passed in. So it came out whole.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const tile     = "" /* 47m: TileCard.jsx deleted */;
const profiles = read("client/src/panels/JobProfilesPanel.jsx");
const panel    = read("client/src/panels/AutoApplyPanel.jsx");
const sections = read("client/src/panels/AutoApplyPanelSections.jsx");

test("AC3: the primitive was EXTRACTED — JobProfilesPanel renders it rather than keeping a copy", () => {
  // The whole requirement. If JobProfilesPanel still holds the inline card, then whatever the Auto
  // Apply panel renders is a second implementation, however similar it looks on the day it lands.
  assert.match(profiles, /import \{ TileGrid, TileCard, TilePill \} from "\.\.\/components\/ui\/TileCard\.jsx"/);
  assert.match(profiles, /<TileGrid min=\{260\} gap=\{14\}>/);
  assert.match(profiles, /<TileCard/);
  assert.match(profiles, /<TilePill>Active<\/TilePill>/);

  // And the inline card it used to hold is gone — not merely unused beside its replacement.
  assert.ok(!/gridTemplateColumns:"repeat\(auto-fill, minmax\(260px, 1fr\)\)"/.test(profiles),
    "JobProfilesPanel still declares its own card grid");
  assert.ok(!/borderRadius:16,\s*\n\s*padding:"16px 18px",\s*\n\s*boxShadow:"var\(--shadow-sm\)"/.test(profiles),
    "JobProfilesPanel still declares its own card frame — the primitive is a clone, not an extraction");
});

test("AC3: the values in the primitive are the profile card's own, not re-invented lookalikes", () => {
  // An "extraction" that rounds 16 to 12 and 18 to 16 on the way out is a rewrite. These are the
  // numbers that were in JobProfilesPanel before the move.
  for (const value of [
    /borderRadius: 16/,                                   // the tile frame
    /padding: "16px 18px"/,
    // A53 restyled the primitive ONCE — which is what extracting it bought: the profile tiles and the
    // Auto Apply company tiles moved together. Its shadow is now the glass material's
    // (styles/glass.js) and its active tint the ACCENT_QUIET token, with the ring in ACCENT_INK
    // (the logo orange fails 3:1 as a UI boundary). Those replace the two lines pinned here before.
    /\.\.\.glass\(\{ radius: 16 \}\)/,
    /active && !tone \? \{ backgroundColor: C\.ACCENT_QUIET \}/,  // the active tint
    /active \? C\.ACCENT_INK : C\.GLASS_RIM/,                     // the active ring
    /borderRadius: 12/,                                   // the inset
    /padding: "10px 12px"/,
    /background: "var\(--color-surface-offset\)"/,
    /minHeight: 36/,                                      // the body line
    // The grid. AE5 added an OPT-IN column cap for the job board, so the track is now a variable
    // — but the default path has to compute the identical value, or the extraction did change
    // something on the way out. Asserted as: the untapped branch is the original literal, and
    // the cap is off unless a caller asks for it.
    /repeat\(auto-fill, \$\{track\}\)/,
    /: `minmax\(\$\{min\}px, 1fr\)`/,
    /maxColumns = null/,
  ]) {
    assert.match(tile, value, `a value was changed on the way out of JobProfilesPanel: ${value}`);
  }
  // CSS vars, not the `theme` object: theme.jsx publishes a live bridge between them, so keeping
  // the vars means this is the profile card's own styling language unaltered. Converting it would
  // have been a rewrite that happened to look the same today.
  // Comments stripped: the file's own note EXPLAINS the theme bridge by naming theme.accent, and a
  // check that fails on its own rationale is a check nobody will keep.
  const tileCode = tile.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!/theme\./.test(tileCode), "the primitive was translated to theme lookups instead of moved");
});

test("D25: Draft House retired the company tiles — and forked nothing on the way out", () => {
  // AC3 put the Auto Apply panel's company groupings into TileCard tiles. D25 (10-04) removed them:
  // the workspace model lists one Stopped item per application (components/StoppedItem.jsx), and
  // what was sent or ended is The Table's (D15). Five AC3 tests that described the tiles went with
  // them. What still holds is AC3's own rule — ONE implementation of the primitive, which Job
  // Profiles renders — so nothing in Draft House may import it, copy it, or keep a tile component
  // alive with nothing rendering it.
  assert.ok(!/TileCard|TileGrid|TilePill/.test(panel), "Draft House renders a tile again");
  assert.ok(!/import \{[^}]*Tile[^}]*\} from "\.\.\/components\/ui\/TileCard\.jsx"/.test(sections),
    "the sections module still imports the tile primitive");
  assert.ok(!/export function CompanyTile\b|export function CompanyApplicationRow\b/.test(sections),
    "a retired tile component is still exported");
  assert.match(profiles, /<TileCard/, "Job Profiles stopped rendering the shared primitive");
  assert.match(tile, /export function TileCard/);
});






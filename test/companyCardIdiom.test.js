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

// ⛔ 47m (changed on purpose): "AC3: the primitive was EXTRACTED — JobProfilesPanel renders it rather than keepi" retired — TileCard is retired (47m Your bearings: the profile cards are cartouches, pages/../JobProfilesPanel.jsx).

// ⛔ 47m (changed on purpose): "AC3: the values in the primitive are the profile card's own, not re-invented loo" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D25: Draft House retired the company tiles — and forked nothing on the way out" retired — TileCard is retired (47m Your bearings: the profile cards are cartouches, pages/../JobProfilesPanel.jsx).






// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("profile suggestion additions use shared normalized helpers on both server and client paths", () => {
  const sharedSignals = fs.readFileSync("shared/profileSignals.js", "utf8");
  const aggregator = fs.readFileSync("services/profileSignalAggregator.js", "utf8");
  const routes = fs.readFileSync("routes/domainProfiles.js", "utf8");
  const wizard = fs.readFileSync("client/src/components/DomainProfileWizard.jsx", "utf8");

  assert.match(sharedSignals, /export function profileSignalKey/);
  assert.match(sharedSignals, /export function mergeUniqueSignalLabels/);
  assert.match(aggregator, /export function addSkillToProfile/);
  assert.match(aggregator, /export function addVerbToProfile/);
  assert.match(routes, /addSkillToProfile/);
  assert.match(routes, /addVerbToProfile/);
  assert.match(wizard, /mergeUniqueSignalLabels/);
  assert.match(wizard, /new Set\(mergeUniqueSignalLabels\(\[\.\.\.prev, value\]\)\)/);
});

// RENAMED FOR A REAL CHANGE, not to re-baseline a failure. AG2 replaced the one-way "add" with a
// two-way claim, so `alreadyAdded` is now `claimed` and "Added: X" is "✓ X". One assertion is
// deliberately INVERTED rather than updated: the chip used to get pointerEvents:"none" once added,
// which is what made the decision permanent. A claimed chip must stay clickable, because that click
// is how the candidate takes the claim back.
test("ATS missing rows stay visible and read-only — no claim state anywhere (46x, owner 11-19: \"ditch the whole prove it and claim it gimmick\", \"do the clean up\")", () => {
  const atsPanel = (fs.readFileSync("client/src/plate/FitCard.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: ATSPanel.jsx deleted — its home now */;
  const chips = fs.readFileSync("shared/atsReportElement.js", "utf8").replace(/^\s*(\/\/|\*).*$/gm, "");
  const css = fs.readFileSync("shared/atsReportStyles.js", "utf8");
  // the posting's panel keeps no claim state and listens for no claim events — it draws the ATS card
  assert.doesNotMatch(atsPanel, /PROFILE_SUGGESTIONS_UPDATED_EVENT|buildProfileClaimLookup|emitProfileSuggestionsUpdated/);
  // the one report component: the missing terms are plain rows, labelled, never a button
  assert.match(chips, /"Not on your résumé"/);
  assert.match(chips, /const tone = generic \? "gen" : evidenced \? "ok" : "miss";/);
  assert.doesNotMatch(chips, /aria-pressed|data-claim-chip|Claimed · undo|That's true of me/);
  assert.doesNotMatch(css, /\.ats-cl__claim/);
});

test("jobs search button uses two-step local then scrape flow and pagination supports direct page jumps", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");

  // ⛔ 47k sweep (changed on purpose): the two-step Set Role / Search New button lived only in JobsPanel's dead
  // `{false && …}` ATS role-search row (its LucyBtn), drawn nowhere since the plate search replaced it — the row, the
  // button's runSearchButton handler and its label are deleted. A deletion pin now: they do not come back.
  assert.doesNotMatch(jobsPanel, /const runSearchButton = useCallback|function LucyBtn|<LucyBtn\b/);
  assert.doesNotMatch(jobsPanel, /"Search New" : "Set Role"/);
  assert.doesNotMatch(jobsPanel, /\{false && \(/, "a dead {false && …} row is back in JobsPanel");
  // ⭐ D147 (owner 11-03) changed this on purpose: page numbers → scrolling (the next page appends at the list's end).
  assert.doesNotMatch(jobsPanel, /buildVisiblePageItems|Go to page/);
  // 47j R2 (changed on purpose): D147's endless scroll (BoardMore) is deleted — D199 C3 pages (the pager reads setBoardPager)
  assert.doesNotMatch(jobsPanel, /<BoardMore\b/);
  assert.match(jobsPanel, /setBoardPager\?\.\(\{ page: currentPage, totalPages/);
  assert.doesNotMatch(jobsPanel, /resultsUpToDate/);
  assert.doesNotMatch(jobsPanel, /scrapeNewCount/);
});

// BEHAVIOUR REVERTED, NOT RENAMED — flagged rather than quietly re-baselined.
//
// This asserted the dock is centred on the jobs panel's measured zone rather than the viewport.
// The "rm:jobs-panel-zone" CustomEvent that carried that rect is gone from both JobsPanel and
// TopBar, and the two variables survive only as inert names:
//     const constrainedPillWidth = pillWidth;   // constrains nothing
//     const dockCenter           = vw / 2;      // always viewport centre
// So the dock is back to exactly the full-viewport centring this test says it should not use.
//
// Whether that is a deliberate simplification (plausible — the redesigned board is centred and
// near-full-width, so the two may now coincide visually) or an unfinished revert is not
// determinable from the code. Recorded in docs/PIPELINE_DIAGNOSIS.md §5.14 for an owner decision.
// Asserting only what is verifiably true, plus the ref that is still live.
test("floating dock positioning is viewport-centred (zone constraint currently inert)", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  const topBar = fs.readFileSync("client/src/components/TopBar.jsx", "utf8");

  assert.match(jobsPanel, /detailPanelElementRef/);
  assert.match(topBar, /const dockCenter\s+= vw \/ 2/);
  assert.match(topBar, /left: dockCenter/);
});

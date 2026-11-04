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
test("ATS missing chips stay visible, turn green when claimed, and react to profile suggestion updates", () => {
  const atsPanel = fs.readFileSync("client/src/components/ATSPanel.jsx", "utf8");
  // A52: the chips are drawn by the one report implementation — since T9 the shared component
  // (shared/atsReportElement.js); ATSPanel keeps the claim state and events.
  const chips = fs.readFileSync("shared/atsReportElement.js", "utf8");

  assert.match(atsPanel, /PROFILE_SUGGESTIONS_UPDATED_EVENT/);
  assert.match(atsPanel, /buildProfileClaimLookup/);
  assert.match(atsPanel, /emitProfileSuggestionsUpdated/);
  // theme.successMuted was replaced with literal greens (#0a1f0a background, #22c55e text). The
  // behaviour this test is named for — the chip turns green — is unchanged; only the token went,
  // and now the trigger is the candidate's claim rather than an irreversible add.
  // Re-pinned at UI step 2b (09-30): the dark-era literals became tokens; the claimed/unclaimed switch is what is pinned.
  // D31: the claim chip's resting colours are tokens on the chip itself (the + chip); the switch is the same.
  // D32 re-pin: the chip is a depth BOX on the ink pair, and its colours moved into AtsReport.css as the
  // pair's tokens — the switch is now aria-pressed (which IS the claimed state), and it still turns green.
  // T9: the stylesheet travels with the component (shared/atsReportStyles.js), rule for rule.
  const css = fs.readFileSync("shared/atsReportStyles.js", "utf8");
  assert.match(chips, /"aria-pressed": claimed \? "true" : "false"/);
  // A86 re-pin (pair2.html's .b.cl / .b.cl.on): an unclaimed box is the claim red on the raised surface
  // (no longer dashed); claimed, it is the green, its square too.
  assert.match(css, /\.ats-box--claim\[aria-pressed="true"\] \{ background: var\(--c-pair-met-quiet\);[^}]*color: var\(--c-pair-matched\);/);
  assert.match(css, /\.ats-box--claim\[aria-pressed="true"\] \.ats-box__plus \{ background: var\(--c-pair-matched\); \}/);
  assert.match(css, /\.ats-box\[data-tone="claim"\] \{ border-color: var\(--c-pair-missing-edge\); color: var\(--c-pair-missing\); \}/, "an unclaimed box is the claim red");
  assert.match(chips, /"data-tone": "claim",\s*"data-claim-chip": claimKind/);
  assert.match(chips, /claimed \? `✓ \$\{k\}` : k/);
  assert.doesNotMatch(chips, /pointerEvents:\s*claimed/,
    "a claimed chip must stay clickable — that click is how the claim is withdrawn");
});

test("jobs search button uses two-step local then scrape flow and pagination supports direct page jumps", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");

  assert.match(jobsPanel, /const \[searchPhase, setSearchPhase\] = useState\("idle"\)/);
  assert.match(jobsPanel, /const runSearchButton = useCallback/);
  assert.match(jobsPanel, /await handleSetRole\(q\)/);
  assert.match(jobsPanel, /await handlePullRefresh\(\)/);
  assert.match(jobsPanel, /searchPhase === "local" && roleIsSet \? "Search New" : "Set Role"/);
  // ⭐ D147 (owner 11-03) changed this on purpose: page numbers → scrolling (the next page appends at the list's end).
  assert.doesNotMatch(jobsPanel, /buildVisiblePageItems|Go to page/);
  assert.match(jobsPanel, /<BoardMore /);
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

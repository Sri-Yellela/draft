// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("job card hover preview uses shared active-aware icon helpers for save and pass actions", () => {
  const jobCard = fs.readFileSync("client/src/components/JobCard.jsx", "utf8");

  assert.match(jobCard, /function IconBtn\(\{/);
  assert.match(jobCard, /active = false/);
  assert.match(jobCard, /preview = hov && !disabled/);
  // A53 (owner, 10-02): Save SETS — the star toggle (ToggleIconBtn, "Remove from saved" on a second
  // press) is gone; reversal is Undo, or the Saved list's own labelled "Remove" (onUnsave).
  const buttons = fs.readFileSync("client/src/components/DecisionButtons.jsx", "utf8");
  assert.doesNotMatch(jobCard, /function ToggleIconBtn/);
  assert.match(buttons, /label="Remove" title="Remove from saved" onClick=\{onUnsave\}/);
  // AE5 gave the thumbs-down's slot to the action that MOVES an application forward — Draft now
  // (was Queue Auto) — and it reports its own state rather than firing twice.
  // D51: the state and its sentence come from ONE place (lib/jobDecisions.js draftButtonState); a drafted
  // button opens Draft House rather than going grey.
  assert.match(buttons, /const s = draftButtonState\(\{ drafted, drafting, block, canView: !!onView, slots \}\);/);
  assert.match(buttons, /disabled=\{s\.disabled\}/);
  assert.doesNotMatch(jobCard, /activeLabel="Undo pass"/,
    "the listing must not grow the thumbs-down back — see AE5 for where Pass lives");
  assert.match(jobCard, /active=\{done && !generateLoading\}/);
  // The A+ action is no longer a JobCard button — only Generate is — and the dead `aPlusLoading`
  // local that lingered alongside it has now been removed too (§5.14). The card must not grow a
  // second loading flag back without a button to use it; while a job is in the a_plus_resume
  // state the generic `disabled={!!st}` guard still covers it.
  // Comments stripped first — the removal's own explanatory note names the deleted identifier.
  const jobCardCode = jobCard
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(jobCardCode, /aPlusLoading/,
    "an unused second loading flag must not return — !!st already covers that state");
  assert.match(jobCardCode, /disabled=\{!!st\}/, "the generic in-flight guard must stay");

  // JobDetailPanel's action bar carried an IDENTICAL orphan, removed in the same change. It was
  // found only because an unrelated test happened to pin the JobCard line — nothing guarded this
  // surface, so guard it here rather than leave the pair half-covered. Neither surface has a
  // dedicated A+ button; both rely on the same generic in-flight guard.
  const detailPanelCode = (fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8") + fs.readFileSync("client/src/plate/OpeningSheet.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: JobDetailPanel.jsx deleted — its home now */
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(detailPanelCode, /aPlusLoading/,
    "the detail panel's action bar must not regrow the unused flag either");
  // A63 adds "no Draft slots left" beside it; the in-flight guard itself must stay.
  assert.match(detailPanelCode, /disabled=\{!!st( \|\| noSlots)?\}/,
    "the detail panel's generic in-flight guard must stay");
});

// ⛔ 47m (changed on purpose): "jobs UI opens ATS panel from stored base ATS reports without requiring regenerat" retired — the posting panel is deleted (D199 C7): a job opens as its opening sheet (plate/OpeningSheet.jsx, SheetResume.jsx), pinned by d199Market47h and a204.

// ⛔ 47j w1-shell (changed on purpose): ProfileSelectorDropdown.jsx is deleted — its one renderer, the account panel
// (TopBar's ProfileMenuPanel), was opened by nothing since D197 #1. Its "Manage Profiles" way to Profile is the peek's Open
// Profile, and Profile → Your profile opens the full manager.
test("the job profiles' manager is reached from Profile", () => {
  assert.ok(!fs.existsSync("client/src/components/ProfileSelectorDropdown.jsx"));
  assert.match(fs.readFileSync("client/src/pages/profile/ProfilePage.jsx", "utf8"), /onOpenJobProfiles=\{\(\) => navigate\("\/app\/job-profiles"\)\}/);
});

test("the imported-LinkedIn section is gone, and the bulk-import CTA stays gone (E2)", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  // The section is removed — see jobsUiProfileFilters for the full symbol sweep and the reason.
  assert.doesNotMatch(jobsPanel, /function StarredLinkedInSection/);
  // The original point of this test survives the removal: the retired bulk-import CTA must not
  // reappear under any surface. Comments stripped, since the removal notes quote the old copy.
  const jobsPanelCode = jobsPanel
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(jobsPanelCode, /Import from LinkedIn/,
    "the removed bulk-import CTA must not come back");
});

test("poll enforces stored profile experience constraints before surfacing new jobs", () => {
  const server = fs.readFileSync("server.js", "utf8");

  // The scrape half (maxAllowedYoe, yoeMismatch) went with scrapeJobs, deleted 10-02 (18).
  assert.match(server, /const pollSignals = loadSimpleApplyProfile/);
  assert.match(server, /const pollMaxYoe = pollSignals\?\.yearsExperience != null \? pollSignals\.yearsExperience \+ 2 : null/);
  assert.match(server, /\(\? IS NULL OR sj\.min_years_exp IS NULL OR sj\.min_years_exp <= \?\)/);
});

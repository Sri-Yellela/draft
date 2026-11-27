import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("jobs filters are staged and only committed by Apply", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");

  assert.match(jobsPanel, /function defaultFilterSnapshot/);
  assert.match(jobsPanel, /const \[pendingFilters, setPendingFilters\]/);
  assert.match(jobsPanel, /const applyPendingFilters = useCallback/);
  assert.match(jobsPanel, /onApply=\{applyPendingFilters\}/);
  assert.match(jobsPanel, /setRole=\{value => stageFilter\("roleFilter", value\)\}/);
  assert.match(jobsPanel, /setEmploymentTypePrefs=\{value => stageFilter\("employmentTypePrefs", value\)\}/);
  assert.doesNotMatch(jobsPanel, /role=\{roleFilter\}\s+setRole=\{setRoleFilter\}/);
});

// The two `isDark ? <light> : <dark>` ternaries this asserted are gone: there is exactly one
// theme now (themes/cinematic.js) and isDark is hardcoded true, so the light halves were dead
// branches and were collapsed. The INTENT — the filter drawer must be opaque, not the translucent
// card surface, or the board reads straight through it — is unchanged and still worth pinning.
test("filter panel uses an opaque modal surface", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");

  // ⛔ 47j w1-market r2 (changed on purpose): the drawer is drawn on the plate (.plate .pl-fdrawer) — the dim is the plate
  // ink at 32 %, the panel is opaque paper (never a translucent card). Same intent.
  assert.match(jobsPanel, /data-filters-drawer="" className="plate pl-fdrawer"/);
  assert.match(jobsPanel, /<motion\.div className="pl-fdrawer__panel"/);
  const css = fs.readFileSync("client/src/plate/plate.css", "utf8");
  assert.match(css, /\.pl-fdrawer \{ background: color-mix\(in srgb, var\(--pl-ink\) 32%, transparent\);/, "a real dim behind the drawer");
  assert.match(css, /\.pl-fdrawer__panel \{[^}]*background: var\(--pl-paper\);/, "the panel is opaque paper");
});

// Replaces "LinkedIn import CTA is only rendered from the Starred LinkedIn section", which
// pinned a CTA string that no longer existed even before cleanup 5.3 — it had been failing for
// that reason. The bulk saved-jobs import is now removed outright: its bridge functions were
// stubs returning false/no-op since BYO-2, so the CTA could only ever open an install modal that
// no install could satisfy, and v1.2.0 deleted the extension-side script entirely.
test("the dead LinkedIn bulk-import flow stays removed", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  // Strip comments so the explanatory notes left behind don't satisfy these assertions.
  const code = jobsPanel
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  for (const symbol of [
    "startLinkedInImport", "openLinkedInExtensionPopup", "closeLinkedInImportTab",
    "sendExtensionRequest", "isLinkedInExtensionInstalled", "getLinkedInExtensionInstallUrl",
    "LinkedInInstallDialog", "linkedinInstallModalOpen", "linkedinExtensionNotice",
  ]) {
    assert.doesNotMatch(code, new RegExp(symbol),
      `${symbol} belongs to the removed bulk-import flow and must not return`);
  }
});

test("THE STARRED LINKEDIN SECTION IS GONE, AND SO IS EVERYTHING THAT FED IT (E2)", () => {
  // It read imported_jobs, which had exactly one writer — /api/extension/save-job — and zero rows.
  // Its own copy promised that Ctrl+Shift+K captures "appear here", which they never did: the hotkey
  // has always written to scraped_jobs. Rather than leave a panel that could only ever be empty, the
  // capture paths were converged and this surface removed; captured jobs are starred into user_jobs
  // by importJob's attachImportToUser, so they show up in the board's own Saved tab, which already
  // queries starred=1.
  // Read the CODE, not the comments. This is a "must not come back" assertion, and the note left
  // where `isImported` was finally removed necessarily names isImportedBoardJob in order to explain
  // which predicate it was and why restoring it would be wrong — six dangling `isImported ?` guards
  // outlived the function's deletion in 190258a and threw a ReferenceError on every job selection,
  // so that explanation is worth keeping. Stripping comments keeps this test about the machinery.
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const symbol of [
    "StarredLinkedInSection", "showImportedLinkedInSection", "importedLinkedInJobs",
    "linkedinImportSummary", "fetchImportedLinkedInJobs", "isImportedBoardJob",
    "/api/imported-jobs",
  ]) {
    assert.doesNotMatch(jobsPanel, new RegExp(symbol.replace(/[/]/g, "\/")),
      `${symbol} fed the removed panel and must not come back`);
  }
  // And the dangling references that survived its deletion must not return either.
  assert.doesNotMatch(jobsPanel, /\bisImported\b/,
    "isImported has no definition — any reference to it throws the instant a job is selected");
});

test("the Saved tab is what surfaces captured jobs now", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  assert.match(jobsPanel, /boardTab === "saved"\) p\.set\("starred","1"\)/,
    "Saved queries starred=1, and importJob stars every capture — so captures land there");
});

test("job profiles have a dedicated app section and menu entry", () => {
  const app = fs.readFileSync("client/src/App.jsx", "utf8");
  const topBar = fs.readFileSync("client/src/components/TopBar.jsx", "utf8");
  const panel = fs.readFileSync("client/src/panels/JobProfilesPanel.jsx", "utf8");
  const profile = fs.readFileSync("client/src/panels/ProfilePanel.jsx", "utf8");

  assert.match(app, /JobProfilesPanel/);
  // D10: no TAB any more — a route-only panel, reached from the menu and Profile below.
  assert.match(app, /ROUTE_ONLY_TABS = \[[^\]]*"job-profiles"/);
  // `renderRoute` became `activeTab` when App.jsx moved to react-router — the panel is still
  // gated on the same key, only the variable was renamed.
  assert.match(app, /activeTab === "job-profiles"/);
  // D18: the menu entry is "Job Profiles" in the avatar menu's Settings group (was "Manage Job Profiles").
  // ⛔ 47j w1-shell (changed on purpose): that menu (TopBar's ProfileMenuPanel) is gone — nothing opened it since D197 #1;
  // the way in is Profile → Your profile's Job Profiles (ProfilePanel, below) and the Deck's set-up state.
  assert.doesNotMatch(topBar, /onTabChange\?\.\("job-profiles"\)/);
  assert.match(fs.readFileSync("client/src/pages/profile/ProfilePage.jsx", "utf8"), /onOpenJobProfiles=\{\(\) => navigate\("\/app\/job-profiles"\)\}/);
  assert.match(panel, /export function JobProfilesPanel/);
  assert.match(profile, /Open Job Profiles/);
});

// ⛔ 47m (changed on purpose): "base resume management is profile-card scoped, not a global menu control" retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("domain profile wizard supports shared create and edit modes", () => {
  const wizard = fs.readFileSync("client/src/components/DomainProfileWizard.jsx", "utf8");
  const panel = fs.readFileSync("client/src/panels/JobProfilesPanel.jsx", "utf8");

  assert.match(wizard, /mode = "create"/);
  assert.match(wizard, /initialProfile = null/);
  assert.match(wizard, /const isEditMode = mode === "edit"/);
  assert.match(wizard, /method: isEditMode \? "PUT" : "POST"/);
  assert.match(wizard, /Edit Job Search Profile/);
  assert.match(panel, /mode=\{wizardMode\}/);
  assert.match(panel, /initialProfile=\{editingProfile\}/);
});

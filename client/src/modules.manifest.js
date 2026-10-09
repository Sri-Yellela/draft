// ⭐ A93 · THE MODULE MANIFEST — the controller and the log of every modular object in the client.
//
// Owner, 10-07: "others aspects that are literally the same are not being used modularly while the ones
// that are specific to a page or module are being used in another module" — and: "a modularity controller
// which acts as a controller and log of all modular objects across the platform."
//
// It is NOT a runtime layer: nothing imports this file, nothing routes through it. It is the declaration a
// guard holds the code to — test/a93ModuleManifest.test.js, which DERIVES the truth from the code
// (scripts/a93ModuleAudit.mjs) and fails when the two disagree, in either direction:
//   · a component name defined in two files                    — the same thing built twice
//   · a shared file not listed here, or listed and gone         — the log is complete and self-pruning
//   · a shared file nothing imports                             — dead code is not a module
//   · a MODULE-PRIVATE file imported from outside its module    — a page's part leaking into another
//   · a panel or page importing another's file, undeclared      — the same leak, one level up
//   · a stylesheet's classes used outside its owner or module   — a page's look worn by another
//   · a MIRROR that no longer exists where it says              — a copy the extension must keep in step
//
// HOW TO CHANGE IT. A new shared component gets a line in SHARED saying what it is. If only one module may
// use it, it names that module. Making a private part shared is a decision: move it to `module: undefined`
// and say why in the commit. Paths are relative to client/src. Reasons are part of the log — keep them.

// ── MODULES: a page and the files that are its parts. A part (`module:` below) may be used ONLY by members.
export const MODULES = Object.freeze({
  shell: { why: "the app's chrome — App mounts it", members: ["App.jsx", "components/AppShell.jsx", "components/TopBar.jsx",
    "components/NavBar.jsx", "components/InlineLoginPopover.jsx", "components/AdminLayout.jsx", "consoles/PlanConsoles.jsx"] },
  auth: { why: "sign-in and sign-up", members: ["App.jsx", "components/AuthScreen.jsx", "components/SignupAtsHook.jsx", "components/DealBackdrop.jsx"] },
  deck: { why: "the Daily Deck",
    // ⚠ DealBackdrop (behind the login form) deals the deck's OWN card backs — a decided reuse (queue 30; the
    // owner kept the card back as decided, 10-07). It is the one place outside the deck that may use them.
    members: ["panels/DeckView.jsx", "components/DeckGeometryControl.jsx", "components/CardBack.jsx", "components/DealBackdrop.jsx"] },
  board: { why: "Full House — the board, its cards and its posting panel",
    members: ["panels/JobsPanel.jsx", "components/JobBubble.jsx", "components/JobDetailPanel.jsx", "components/CoverLetterModal.jsx", "components/ByomResumeChoice.jsx"] },
  fullHouseHeader: { why: "the Full House header — the sentence, its words, the sort, the bar",
    css: ["components/FullHouse.css"],
    members: ["App.jsx", "components/BoardBar.jsx", "components/BoardHeadline.jsx", "components/SortPanel.jsx", "components/WordPanel.jsx"] },
  searchBar: { why: "the search bar and its suggest — the landing page's, and the board's well (BoardBar)",
    css: ["components/UnifiedSearchBar.css"],
    members: ["components/UnifiedSearchBar.jsx", "components/UsbSelect.jsx", "components/UsbSuggest.jsx", "components/BoardBar.jsx", "pages/LandingPage.jsx"] },
  draftHouse: { why: "Draft House (the panel behind the Draft tab)", css: ["components/DraftHouse.css"],
    members: ["panels/AutoApplyPanel.jsx", "panels/AutoApplyPanelSections.jsx", "components/DraftRunBar.jsx", "components/StoppedItem.jsx", "components/WaitingLine.jsx"] },
  theTable: { why: "The Table (the database panel)",
    members: ["panels/DatabasePanel.jsx", "components/ApplicationHistory.jsx", "components/PendingApplications.jsx"] },
  landing: { why: "the landing page", members: ["pages/LandingPage.jsx", "components/FindFitApply.jsx"] },
  admin: { why: "the admin console", members: ["panels/AdminPanel.jsx", "panels/adminOps.jsx", "panels/adminEnrichment.jsx", "panels/adminMap.js", "components/AdminLayout.jsx"] },
});

// ── SHARED: every file under components/, styles/, lib/, hooks/, contexts/, themes/, consoles/.
//    No `module` → shared app-wide. `module` → private to that module. A stylesheet names its `owner`.
export const SHARED = Object.freeze({
  // ── the ATS ──
  "components/ATSPanel.jsx":            { what: "the ATS report LOADER (fetch, cache, claims) — the deck and the ATS panel mount it" },
  "components/AtsReport.jsx":           { what: "THE ATS report — the one implementation every surface draws (A52)" },
  "components/AtsReport.css":           { what: "its look", owner: "components/AtsReport.jsx" },
  "components/AtsNumberBox.jsx":        { what: "THE ATS number box (D50) — posting header, ATS panel, résumé rows (A93)" },
  "components/AtsNumberBox.css":        { what: "its look", owner: "components/AtsNumberBox.jsx" },
  // ── companies and jobs ──
  "components/CompanyLink.jsx":         { what: "THE company link (D38) — the text only" },
  "components/CompanyLink.css":         { what: "its look", owner: "components/CompanyLink.jsx" },
  "components/CompanyLogo.jsx":         { what: "THE company mark on a paper tile (D61)" },
  "components/CompanyViewModal.jsx":    { what: "a company's page, from any card or the posting" },
  "components/CompanyKbSections.jsx":   { what: "a company's knowledge sections — the company modal and the recruiter view" },
  "components/JobCard.jsx":             { what: "the legacy expandable job card — the landing feed and The Table (scheduled for removal)" },
  "components/PostingPanel.jsx":        { what: "a posting's body (D32 ink pair) — the posting panel and the deck's expanded card" },
  "components/PostingPanel.css":        { what: "its look", owner: "components/PostingPanel.jsx" },
  "components/DecisionButtons.jsx":     { what: "Pass · Save · Draft — every card and the posting panel" },
  "components/DecisionToast.jsx":       { what: "the undo toast after a decision — deck and board" },
  "components/ResumeList.jsx":          { what: "THE résumé list (D62) — the ATS panel's History and Settings" },
  "components/ResumeList.css":          { what: "its look — the list's classes only (A93)", owner: "components/ResumeList.jsx" },
  // ── controls and surfaces ──
  "components/DepthButton.jsx":         { what: "THE depth box (D1/D48)" },
  "components/DepthButton.css":         { what: "the depth box, the .dbx-depth skin and the .mark (D60) — loaded app-wide by main.jsx", owner: "components/DepthButton.jsx", alsoBy: ["main.jsx"] },
  "components/DockPortal.jsx":          { what: "the portalled dropdown surface" },
  "components/PanelShell.jsx":          { what: "the overlay panel frame — every peer panel in the board's dock" },
  "components/StickyBar.jsx":           { what: "THE sticky-at-the-top section (D49)" },
  "components/StickyBar.css":           { what: "its look", owner: "components/StickyBar.jsx" },
  "components/SectionHeading.jsx":      { what: "THE section heading (A93: was inside AutoApplyPanel's file)" },
  "components/SettingsSection.jsx":     { what: "THE settings card — Account and Integrations (A93)" },
  "components/StatCard.jsx":            { what: "THE stat card — admin and the DB inspector (A93)" },
  "components/EmptyState.jsx":          { what: "THE empty state — the board and The Table (A93)" },
  "components/DomainProfileWizard.jsx": { what: "the job-profile wizard — profiles, board, profile panel" },
  "components/ProfileSelectorDropdown.jsx": { what: "the active-profile picker — top bar and board" },
  "components/ExtensionPrompt.jsx":     { what: "the get-the-extension prompt — app, extension page, board" },
  "components/ScrollDock.jsx":          { what: "the marketing and tools pages' dock" },
  "components/Footer.jsx":              { what: "the site footer" },
  "components/StampLogo.jsx":           { what: "THE /draft mark" },
  "components/DraftMark.jsx":           { what: "the /d mark (D1)" },
  "components/PaperBackground.jsx":     { what: "the paper grain behind every page" },
  "components/ui/DateCalendar.jsx":     { what: "the date picker" },
  "components/ui/PanelControls.jsx":    { what: "a panel's tab and search controls" },
  "components/ui/TileCard.jsx":         { what: "the profile tile" },
  "components/ui/toast.jsx":            { what: "toast primitives (shadcn)" },
  "components/ui/toaster.jsx":          { what: "the app's toaster" },
  // ── module-private parts ──
  "components/AppShell.jsx":            { what: "the signed-in frame", module: "shell" },
  "components/TopBar.jsx":              { what: "the top bar", module: "shell" },
  "components/NavBar.jsx":              { what: "the marketing nav", module: "shell" },
  "components/NavBar.css":              { what: "its look", owner: "components/NavBar.jsx" },
  "components/InlineLoginPopover.jsx":  { what: "the nav's sign-in popover", module: "shell" },
  "components/AdminLayout.jsx":         { what: "the admin frame", module: "shell" },
  "consoles/PlanConsoles.jsx":          { what: "the plan consoles — mount the board", module: "shell" },
  "components/AuthScreen.jsx":          { what: "sign-in / sign-up", module: "auth" },
  "components/SignupAtsHook.jsx":       { what: "the sign-up page's ATS hook", module: "auth" },
  "components/DealBackdrop.jsx":        { what: "the dealt cards behind the login form", module: "auth" },
  "components/CardBack.jsx":            { what: "a deck card's back (the tinted logo — owner-decided O34)", module: "deck" },
  "components/DeckGeometryControl.jsx": { what: "the deck's layout control", module: "deck" },
  "components/JobBubble.jsx":           { what: "the board's card (D1)", module: "board" },
  "components/JobBubble.css":           { what: "its look", owner: "components/JobBubble.jsx" },
  "components/JobDetailPanel.jsx":      { what: "the board's posting panel (D48)", module: "board" },
  "components/JobDetailPanel.css":      { what: "its look", owner: "components/JobDetailPanel.jsx" },
  "components/CoverLetterModal.jsx":    { what: "the posting panel's cover letter", module: "board" },
  "components/ByomResumeChoice.jsx":    { what: "the posting panel's Résumé choice — draft, or the user's own ChatGPT / Claude (D86)", module: "board" },
  "components/ByomResumeChoice.css":    { what: "its look", owner: "components/ByomResumeChoice.jsx" },
  "components/BoardBar.jsx":            { what: "the Full House bar", module: "fullHouseHeader" },
  "components/BoardHeadline.jsx":       { what: "the filter sentence", module: "fullHouseHeader" },
  "components/SortPanel.jsx":           { what: "the sort panel", module: "fullHouseHeader" },
  "components/WordPanel.jsx":           { what: "a sentence word's panel", module: "fullHouseHeader" },
  "components/FullHouse.css":           { what: "the Full House header's look", owner: "components/BoardHeadline.jsx" },
  "components/UnifiedSearchBar.jsx":    { what: "the landing search bar", module: "searchBar" },
  "components/UnifiedSearchBar.css":    { what: "its look", owner: "components/UnifiedSearchBar.jsx" },
  "components/UsbSelect.jsx":           { what: "the search bar's select", module: "searchBar" },
  "components/UsbSuggest.jsx":          { what: "the search bar's suggest", module: "searchBar" },
  "components/DraftRunBar.jsx":         { what: "Draft House's run bar", module: "draftHouse" },
  "components/StoppedItem.jsx":         { what: "Draft House's stopped item", module: "draftHouse" },
  "components/WaitingLine.jsx":         { what: "Draft House's waiting line", module: "draftHouse" },
  "components/DraftHouse.css":          { what: "Draft House's look", owner: "panels/AutoApplyPanel.jsx" },
  "components/ApplicationHistory.jsx":  { what: "The Table's history view (D15)", module: "theTable" },
  "components/ApplicationHistory.css":  { what: "its look", owner: "components/ApplicationHistory.jsx" },
  "components/PendingApplications.jsx": { what: "The Table's pending list", module: "theTable" },
  "components/FindFitApply.jsx":        { what: "the landing page's find → fit → apply", module: "landing" },
  // ── state ──
  "contexts/AppScrollContext.jsx":      { what: "the app's scroll container" },
  "contexts/AutoApplyContext.jsx":      { what: "the apply line's state, shared by board and Draft House" },
  "contexts/JobBoardContext.jsx":       { what: "the board's state, shared by the shell and the board" },
  // ── hooks ──
  "hooks/use-toast.js":                 { what: "toasts" },
  "hooks/useBoardLock.js":              { what: "the board's lock" },
  "hooks/useChromeHeight.js":           { what: "the chrome's height" },
  "hooks/useCollapsibleHeight.js":      { what: "a collapsible's height" },
  "hooks/useDeckGeometry.js":           { what: "the deck's geometry" },
  "hooks/useInactivityLogout.js":       { what: "sign-out on inactivity" },
  "hooks/useJobFacets.js":              { what: "the board's facets" },
  "hooks/useLogoSize.js":               { what: "the mark's size" },
  "hooks/usePanelHost.js":              { what: "the panel dock's host" },
  "hooks/useScrollCollapsed.js":        { what: "collapse on scroll" },
  "hooks/useSyncEvents.js":             { what: "THE one server-event connection" },
  "hooks/useViewport.js":               { what: "the viewport mode" },
  // ── lib ──
  "lib/accountAvatar.js":               { what: "the account avatar" },
  "lib/api.js":                         { what: "THE API client" },
  "lib/applyObstacles.js":              { what: "the apply line's vocabulary" },
  "lib/applyTools.js":                  { what: "the apply-run request constants" },
  "lib/oauthNext.js":                  { what: "the one return path after sign-in to a host's consent screen (D86)" },
  "lib/boardPaging.js":                 { what: "the board's paging" },
  "lib/boardViewCache.js":              { what: "the board's view cache (D45)" },
  "lib/bubbleColumns.js":               { what: "the card rows' columns" },
  "lib/deckState.js":                   { what: "the deck's reducer" },
  "lib/draftHouseExceptions.js":        { what: "Draft House's exceptions" },
  "lib/fanGeometry.js":                 { what: "the deck fan's geometry" },
  "lib/filterSentenceModel.js":         { what: "the filter sentence's model" },
  "lib/jobDecisions.js":                { what: "THE Pass / Save / Draft commit" },
  "lib/jobFacets.js":                   { what: "facet maths" },
  "lib/jobUrl.js":                      { what: "a job's address" },
  "lib/monetisation.jsx":               { what: "the monetisation switch" },
  "lib/pairLink.js":                    { what: "the posting ↔ report term link (D32)" },
  "lib/panelGeometry.js":               { what: "panel geometry" },
  "lib/profileSuggestions.js":          { what: "profile claims" },
  "lib/signupCarry.js":                 { what: "what sign-up carries into the app" },
  "lib/utils.js":                       { what: "cn() for the toast primitives" },
  "lib/viewTransitions.js":             { what: "shared-element transitions" },
  // ── styles ──
  "styles/bandStyle.js":                { what: "a fit band's colours (read by mark.js)" },
  "styles/brandMark.js":                { what: "the mark's geometry" },
  "styles/colorTokens.js":              { what: "THE colour tokens" },
  "styles/glass.js":                    { what: "THE glass surface" },
  "styles/inkPair.css":                 { what: "the D32 ink pair surface", owner: "components/AtsReport.jsx", alsoBy: ["components/PostingPanel.jsx"] },
  "styles/mark.js":                     { what: "THE mark (D60)" },
  "styles/paper.js":                    { what: "the paper grain" },
  "styles/theme.jsx":                   { what: "THE theme provider" },
  "styles/type.js":                     { what: "THE type scale" },
  "styles/zLayers.js":                  { what: "THE z-scale" },
  "themes/cinematic.js":                { what: "the theme's injected CSS" },
  "themes/index.js":                    { what: "the theme list" },
});

// ── COMPOSITIONS: a panel or page mounting ANOTHER panel whole. Allowed only when declared, with why.
export const COMPOSITIONS = Object.freeze([
  { from: "components/AdminLayout.jsx", to: "panels/AdminPanel.jsx", why: "the admin frame renders the admin panel" },
  { from: "consoles/PlanConsoles.jsx", to: "panels/JobsPanel.jsx", why: "each plan console renders the board" },
  { from: "panels/JobsPanel.jsx", to: "panels/SandboxPanel.jsx", why: "the board's panel dock mounts the PDF panel beside the posting" },
  { from: "panels/JobsPanel.jsx", to: "panels/AtsReportPanel.jsx", why: "the board's panel dock mounts the ATS card beside the posting" },
]);

// ── MIRRORS: a client module the EXTENSION re-draws in its own CSS (it cannot import client code). The guard
//    checks the mirror is still there, so a change to one is a reminder to change the other.
export const MIRRORS = Object.freeze([
  { of: "components/AtsNumberBox.jsx", file: "extension/ui.css", selector: ".nb", why: "the popup's job card (D63)" },
  { of: "components/CompanyLogo.jsx", file: "extension/ui.css", selector: ".tile", why: "the popup's logo tile (D61/D63)" },
  { of: "styles/mark.js", file: "extension/ui.css", selector: ".mkr", why: "the popup's marks (D60/D63)" },
  { of: "styles/mark.js", file: "extension/review-overlay.js", selector: ".rm-pill", why: "the review overlay's provenance marks" },
  { of: "components/DepthButton.jsx", file: "extension/ui.css", selector: ".btn", why: "the popup's depth boxes (D23)" },
]);

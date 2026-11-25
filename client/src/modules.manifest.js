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
  shell: { why: "the app's chrome — App mounts it", members: ["App.jsx", "components/AppShell.jsx", "components/TopBar.jsx", "components/AppNav.jsx", "components/dockPlace.js", "components/AskDraftThread.jsx",
    "components/NavBar.jsx", "components/InlineLoginPopover.jsx", "components/AdminLayout.jsx", "consoles/PlanConsoles.jsx"] },
  auth: { why: "sign-in and sign-up", members: ["App.jsx", "components/AuthScreen.jsx", "components/SignupAtsHook.jsx", "components/DealBackdrop.jsx"] },
  deck: { why: "the Daily Deck",
    // ⚠ DealBackdrop (behind the login form) deals the deck's OWN card backs — a decided reuse (queue 30; the
    // owner kept the card back as decided, 10-07). It is the one place outside the deck that may use them.
    members: ["panels/DeckView.jsx", "components/CardBack.jsx", "components/DealBackdrop.jsx"] },
  board: { why: "Full House — the board, its cards and its posting panel",
    members: ["panels/JobsPanel.jsx", "components/JobBubble.jsx", "components/JobDetailPanel.jsx", "components/CoverLetterModal.jsx", "components/ByomResumeChoice.jsx",
      "components/WarmPathsBlock.jsx"] },
  fullHouseHeader: { why: "the Full House header — the sentence, its words, the sort, the bar",
    css: ["components/FullHouse.css"],
    // ⚠ D93: the Customise preview draws the sentence and the bar with this module's classes — a decided reuse
    // (the preview must be the real look, not a copy of it), so it is a member.
    members: ["App.jsx", "components/BoardBar.jsx", "components/BoardHeadline.jsx", "plate/PlateBearing.jsx" /* D196 P1: the sentence as a cartouche */, "plate/fixtures.jsx" /* D199 (47h): the F5 fixture draws the board's own search field (BoardSearch) in the cartouche */, "components/SortPanel.jsx", "components/WordPanel.jsx",
      "components/CustomisePreview.jsx"] },
  searchBar: { why: "the search suggest and its look — the board's well (BoardBar), the open board, the dock (46v: the landing's bar is gone)",
    css: ["components/UnifiedSearchBar.css"],
    members: ["components/UsbSuggest.jsx", "components/BoardBar.jsx",
      "pages/jobs/PublicBoardPage.jsx",   // D179 P3: the open board's one search box
      "components/AppNav.jsx"] },   // 45n: the dock's search (DockSearch) is the SAME suggest, built once
  // ⭐ D93 · the Customise page — Appearance (moved off Account) and the layout options, with its live preview.
  // App.jsx is a member for ContrastOffer, the prefers-contrast banner the shell mounts.
  customise: { why: "the Customise page (D93) — theme, shape cues and the layout options", css: ["components/Customise.css"],
    members: ["App.jsx", "panels/CustomisePanel.jsx", "components/AppearanceSettings.jsx", "components/NarrationSettings.jsx", "components/RadioCards.jsx", "components/CustomisePreview.jsx",
    "components/DeckGeometryControl.jsx"] },
  // ⭐ D146 (owner 11-03): Draft House and The Table are ONE application tracker, so one module — the old theTable
  // module's members joined this one (The Table's views are its full sheet, behind Settings → View).
  draftHouse: { why: "Draft House, the one application tracker (D146) — the table, the auto-apply timeline, and The Table's full sheet", css: ["components/DraftHouse.css", "components/ApplicationTracker.css"],
    members: ["panels/AutoApplyPanel.jsx", "panels/AutoApplyPanelSections.jsx", "components/DraftHouseTree.jsx", "components/ApplicationTracker.jsx", "components/WaitingLine.jsx", "components/AutoSettingsDrawer.jsx",
      "panels/DatabasePanel.jsx", "components/ApplicationHistory.jsx", "components/PendingApplications.jsx", "components/ApplicationInbox.jsx",
      // ⚠ D167: Profile → Auto-apply draws the tracker's ONE settings drawer in the page (AutoSettingsDrawer `inline`), and
      // Profile → Connections its portals (PortalAccounts) and the Inbox's Gmail control — a decided reuse: the same
      // settings in two places must be one implementation, not a copy.
      "pages/profile/ProfilePage.jsx"] },
  landing: { why: "the landing page (46v: A's hero, the shelf, C)", members: ["pages/LandingPage.jsx"] },
  // ⭐ D196 (owner 11-24) · THE PLATE SYSTEM — one component library (plate/) built from the design report and ported from the
  // canvas export; its pages are composed only from these. The gallery (/dev/plate) shows every component in every state.
  // plate/plate.css is the library's look, worn by the library's files and the gallery only; P1–P5's pages join as members.
  plate: { why: "D196's plate component library and its gallery (F3 / F4)", css: ["plate/plate.css"],
    members: ["App.jsx", "plate/PlateRoot.jsx", "plate/PlateState.jsx", "plate/Shell.jsx", "plate/Marks.jsx", "plate/Plates.jsx", "plate/Tickets.jsx",
      "plate/Cards.jsx", "plate/Lists.jsx", "plate/Drawings.jsx", "plate/icons.jsx", "plate/motion.js", "plate/registry.js", "plate/fonts.js",
      "plate/drawings/index.js", "plate/fixtures.jsx", "pages/dev/PlateGallery.jsx",
      // P1 (the market): the switch, the card face, and the deck that wears it
      "plate/marketPlate.js", "plate/MarketCardFace.jsx", "plate/PlateBearing.jsx", "plate/MarketHero.jsx", "plate/MarketOpenings.jsx", "panels/DeckView.jsx",
      // 47f (the owner's P1 FIX): the deck at the board's size; the Index as the Gazetteer, drawn by the board's own column
      "plate/deckGeometry.js", "plate/MarketIndex.jsx", "panels/JobsPanel.jsx",
      "plate/MarketControls.jsx", "plate/MarketPager.jsx", "plate/MarketMap.jsx", "plate/MarkPopover.jsx" /* D199 / D200 (47h): the market rebuilt */,
      "plate/explainer/Explainer.jsx", "plate/explainer/explainerModel.js" /* D198 E1: the explainer engine */,
      "plate/FitCard.jsx" /* D202: the field card ⇄ the ATS card, one card on the market and the sheet */, "plate/OpeningSheet.jsx" /* D199 C7: the opening sheet, /app/jobs/<id> */,
      "plate/TeamDiorama.jsx" /* D199 C7: the sheet's hero plate — the survey diorama with its words as props */, "plate/fitCardFixtures.jsx" /* the card lane's F5 fixtures */] },
  admin: { why: "the admin console", members: ["panels/AdminPanel.jsx", "panels/adminOps.jsx", "panels/adminEnrichment.jsx", "panels/adminMap.js", "panels/adminKit.jsx", "panels/adminPeople.jsx", "panels/adminEmail.jsx", "panels/adminUsage.jsx", "panels/adminGateway.jsx", "panels/adminFlags.jsx","panels/adminAdmins.jsx", "panels/adminAtlas.jsx", "panels/adminLearnImport.jsx", "panels/adminLearnCircle.jsx", "panels/adminLearnSandbox.js", "panels/adminTesterDetails.jsx", "panels/adminTesters.jsx", "panels/adminAppearance.jsx", "panels/adminCalibrate.jsx", "panels/adminReadiness.jsx", "panels/adminQuestions.jsx", "panels/adminReports.jsx", "panels/adminCompanyRecords.jsx", "panels/adminNetwork.jsx", "panels/adminRuns.jsx", "panels/adminPhase1.jsx", "panels/adminDiagnostics.jsx", "pages/admin/DBInspector.jsx", "components/AdminLayout.jsx", "components/IngestFunnel.jsx"] },
  // ⭐ D105 P4 · the Atlas — public at /atlas(/:slug), and at /app/atlas under the top bar's Atlas tab (App mounts both).
  // The graph and the model are the page's own parts; AtlasPage.css is worn by the page and its graph only.
  // ⭐ D117 · Learn as a circle: LearnCircle.jsx draws the ring, the routes and the piece (LearnView mounts it, and its
  // PieceBody in the path view); LearnCircle.css is worn by those two only.
  // ⭐ D116 · the tree (Your map, a role's and a family's map): AtlasTree.jsx draws it, atlasTreeLayout.js lays it out
  // (M2), atlasTreeModel.js its words and choices; YourMap.jsx is the home and the role / family page wrappers.
  // ⭐ D167 · Atlas's own navigation: components/PlaceNav.jsx (the card of panels — the one implementation, A136), AtlasPanels.jsx
  // (the panels), atlasPanels.js (which panel an address belongs to; docs/D167_ATLAS_MAP.md maps every older surface to its
  // panel); AtlasPanels.css is the panels' look.
  atlas: { why: "the Atlas pages (D105) — search, one node's page, its neighbourhood graph; Learn, the owner's path (D115); Your map, the tree (D116); its own navigation of panels (D167)", css: ["pages/atlas/AtlasPage.css", "pages/atlas/LearnView.css", "pages/atlas/LearnCircle.css", "pages/atlas/AtlasTree.css", "pages/atlas/AtlasPanels.css", "pages/atlas/LibraryPanel.css", "pages/atlas/YourRun.css", "pages/atlas/TrackBoard.css", "pages/atlas/CompetePanels.css", "pages/atlas/SkillMap.css"],
    members: ["App.jsx", "pages/atlas/AtlasPage.jsx", "pages/atlas/AtlasGraph.jsx", "pages/atlas/atlasModel.js", "pages/atlas/LearnView.jsx", "pages/atlas/learnModel.js", "pages/atlas/LearnCircle.jsx", "pages/atlas/LearnWheel.jsx", "pages/atlas/learnWheel.js", "pages/atlas/LibraryPanel.jsx", "pages/atlas/PathwayArt.jsx", "pages/atlas/libraryModel.js", "pages/atlas/YourRun.jsx", "pages/atlas/yourRunModel.js", "pages/atlas/TrackBoard.jsx", "pages/atlas/trackModel.js", "pages/atlas/LibraryGuides.jsx", "pages/atlas/LessonDeck.jsx", "pages/atlas/DeckPlay.jsx", "pages/atlas/deckPlay.js",
      // ⚠ D194 P4 (47c): the feed plays a shared deck with the Library's own player — a decided reuse, so FeedDeck is a member here too.
      "pages/network/FeedDeck.jsx",
      "pages/atlas/AtlasTree.jsx", "pages/atlas/atlasTreeLayout.js", "pages/atlas/atlasTreeModel.js", "pages/atlas/YourMap.jsx",
      "pages/atlas/Navigator.jsx", "pages/atlas/ReadinessCheck.jsx",
      "pages/atlas/AtlasPanels.jsx", "pages/atlas/atlasPanels.js",
      // ⭐ D150 T14 (46y): a bank item's match / order answer + the local day, ONE implementation (moved out of AtlasPanels.jsx)
      // for the daily question and Learn's piece questions; PieceQuestions is a piece's questions and its checked state.
      "pages/atlas/BankAnswers.jsx", "pages/atlas/PieceQuestions.jsx",
      "pages/atlas/CompetePanels.jsx", "pages/atlas/competeModel.js",
      // ⭐ A228 (46r): Your map is the skill map — the page, its four graphics (one piece each) and its pure model.
      "pages/atlas/SkillMap.jsx", "pages/atlas/SkillMapBits.jsx", "pages/atlas/JobsHistogram.jsx", "pages/atlas/SkillTreemap.jsx",
      "pages/atlas/LearnNextChart.jsx", "pages/atlas/MoveRolesScatter.jsx", "pages/atlas/skillMapModel.js"] },
  // ⭐ D167 (owner 11-06) · Profile and Interview, each a place with its own navigation (components/PlaceNav.jsx), like Atlas.
  profile: { why: "Profile (D167) — About you, résumés, saved answers, auto-apply, connections, appearance, notifications, privacy, account",
    // ⭐ D183 P1: Your profile — the page from the résumé, its visibility, Behind your profile.
    css: ["pages/profile/ProfilePage.css", "pages/profile/YourProfile.css", "pages/profile/ResumeSetup.css"], members: ["App.jsx", "pages/profile/ProfilePage.jsx", "pages/profile/profilePanels.js",
      "pages/profile/YourProfile.jsx", "pages/profile/ResumeSetup.jsx"] },
  interview: { why: "Interview (D167) — Coming up, Prepare, Practise, After; D110's prep, bank and debriefs",
    css: ["pages/interview/InterviewPage.css"], members: ["App.jsx", "pages/interview/InterviewPage.jsx", "pages/interview/interviewModel.js"] },
  audit: { why: "D150 T05–T08 — the 3-minute audit, /audit", css: ["pages/audit/AuditPage.css"], members: ["App.jsx", "pages/audit/AuditPage.jsx"] },
  publicBoard: { why: "D179 P3 — the open board, /jobs signed out", css: ["pages/jobs/PublicBoardPage.css"],
    members: ["App.jsx", "pages/jobs/PublicBoardPage.jsx"] },
  companies: { why: "D179 P4b / A157 — a page for every company, public at /<company> (its postings at /<company>/<id>) and inside the shell at /app/companies/<slug>",
    // ⛔ A157 (45q, owner 11-09): the Companies tab (CompaniesView) is removed — search and the company's name reach a page.
    css: ["pages/companies/CompanyPage.css"], members: ["App.jsx", "pages/companies/CompanyPage.jsx"] },
  network: { why: "D180 P1 — the Network place (People: connections, requests, suggestions, blocked), behind the network switch; 46f — Feed (/app/feed) and Messages (/app/messages) as their own places, under the same switch",
    css: ["pages/network/NetworkPage.css"], members: ["App.jsx", "pages/network/NetworkPage.jsx", "pages/network/MessagesPane.jsx", "pages/network/FeedPane.jsx", "pages/network/FeedPage.jsx", "pages/network/MessagesPage.jsx", "pages/network/networkSwitch.js", "pages/network/FeedDeck.jsx"] },
});

// ── SHARED: every file under components/, styles/, lib/, hooks/, contexts/, themes/, consoles/.
//    No `module` → shared app-wide. `module` → private to that module. A stylesheet names its `owner`.
export const SHARED = Object.freeze({
  // ── the ATS ──
  "components/ATSPanel.jsx":            { what: "the ATS report LOADER (fetch, cache, claims) — the deck and the ATS panel mount it" },
  "components/AtsInk.jsx":             { what: "an ATS number painted by its band, inline (46x, owner 11-19: colour, not words) — the ATS card and Home's held rows" },
  "components/PlausibilityFlags.jsx":  { what: "D192 (4d): does the résumé add up — a quiet ⚠ per bullet that doesn't line up with its employer, a reason, Dismiss (the ATS card; Home's held review)" },
  "components/AtsCard.jsx":            { what: "THE ATS card in the posting's match panel (owner's option C, 11-19): the number, the four parts as one bar each, the biggest gain; each part's line and figures on demand (47b) — no claims, no quick check" },
  "components/AtsReport.jsx":           { what: "THE ATS report in the web app — a thin React wrapper of the ONE component, shared/atsReportElement.js (A52 → T9; see CROSS_PRODUCT)" },
  "components/AtsNumberBox.jsx":        { what: "THE ATS number box (D50) — posting header, ATS panel, résumé rows (A93)" },
  "components/AtsNumberBox.css":        { what: "its look", owner: "components/AtsNumberBox.jsx" },
  // ⭐ D169 · one skill's proof in place — shared because the ATS panel's "That's true of me" and Your skills in Atlas open the SAME check.
  "components/SkillCheck.jsx":          { what: "D169 · a skill's quick check (D150's bank, D142's timer rules) or its proof choice (a D109 link, a build), opened in place" },
  "components/SkillCheck.css":          { what: "its look", owner: "components/SkillCheck.jsx" },
  // ── companies and jobs ──
  "components/CompanyLink.jsx":         { what: "THE company link (D38) — the text only" },
  "components/CompanyLink.css":         { what: "its look", owner: "components/CompanyLink.jsx" },
  "components/CompanyLogo.jsx":         { what: "THE company mark on a paper tile (D61)" },
  "components/CompanyBubble.jsx":       { what: "THE bubble standard (D113 UI, owner 10-31) — a rounded square in the logo's shape, the company mark inside, ONE status ring; product-wide (Draft House now; the board, The Table and the Atlas next)" },
  "components/CompanyBubble.css":       { what: "its look", owner: "components/CompanyBubble.jsx" },
  "components/CompanyViewModal.jsx":    { what: "a company's page, from any card or the posting" },
  "components/CompanyKbSections.jsx":   { what: "a company's knowledge sections — the company modal and the recruiter view" },
  "components/JobCard.jsx":             { what: "the legacy expandable job card — the landing feed and The Table (scheduled for removal)" },
  "components/PostingPanel.jsx":        { what: "a posting's body (D32 ink pair) — the posting panel and the deck's expanded card" },
  "components/PostingPanel.css":        { what: "its look", owner: "components/PostingPanel.jsx" },
  "components/AtlasTerm.jsx":           { what: "D114 · a published Atlas term inside a posting's text — the quiet link and its popup; every posting surface" },
  "components/AtlasTerm.css":           { what: "its look, and the learning-links layout option's styles", owner: "components/AtlasTerm.jsx" },
  "components/DecisionButtons.jsx":     { what: "Pass · Save · Draft — every card and the posting panel" },
  "components/DecisionToast.jsx":       { what: "the undo toast after a decision — deck and board" },
  "components/MarketingFrame.jsx":      { what: "46v · the marketing pages' one frame — the dock, a serif head, full-width sections, the footer; its button (MkLink) is the landing's too" },
  "components/MarketingFrame.css":      { what: "46v · its look", owner: "components/MarketingFrame.jsx" },
  "components/BookShelf.jsx":           { what: "46u / 46v · books on a shelf — a spine in its pastel, the title up it, leaning as books do; the Library's guides, courses and pathways, and the landing's feature shelf" },
  "components/BookShelf.css":           { what: "46v · the book and the shelf's look (moved from LibraryPanel.css)", owner: "components/BookShelf.jsx" },
  "components/CardPile.jsx":            { what: "46u · draft's card for reading — the jobs deck's look in an item's pastel, the next cards fanned behind; guide decks, a course's lessons, the questions" },
  "components/CardPile.css":            { what: "46u · the reading card's look", owner: "components/CardPile.jsx" },
  "components/TextBlocks.jsx":          { what: "A233 · lines of text, designed — NoteCard (explanations, empty states), Facts (figures), Promises (✓ / ✕)" },
  "components/TextBlocks.css":          { what: "A233 · their look", owner: "components/TextBlocks.jsx" },
  "components/ResumeList.jsx":          { what: "THE résumé list (D62) — the posting match's History (D152 (8)) and Settings" },
  "components/ResumeList.css":          { what: "its look — the list's classes only (A93)", owner: "components/ResumeList.jsx" },
  // ── controls and surfaces ──
  "components/ResourceTile.jsx":       { what: "D119 · THE resource tile — a stored thumbnail (or what it is, in type), the kind mark, the whole tile the link" },
  "components/ResourceTile.css":       { what: "its look and the wrapping grid", owner: "components/ResourceTile.jsx" },
  "components/SponsorshipSignal.jsx":   { what: "D121 · the ONE sponsorship block (the expanded posting panel) and chip (the Atlas role page's sponsors; A109 took it off each post), drawn from the server's signal" },
  "components/SponsorshipSignal.css":   { what: "their look", owner: "components/SponsorshipSignal.jsx" },
  "components/DepthButton.jsx":         { what: "THE depth box (D1/D48)" },
  "components/LiveCheck.jsx":           { what: "A186-CAPTCHA (1)/(1b): a visible check after Submit, shown live — the person solves it; a held check is re-run from what was made (Solve it here, no deadline; the batch queue)" },
  "components/SendJobPicker.jsx":       { what: "D180 P2 — Send a job: connections + a note, or Copy public link (only while the network is on)" },
  "components/SendJobPicker.css":       { what: "the Send-a-job picker's look", owner: "components/SendJobPicker.jsx" },
  "components/WorksHere.jsx":           { what: "D180 P4 — \"1 connection works here\" → Ask for a referral: the company page, the posting panel and the deck (45s: one component)" },
  "components/WorksHere.css":           { what: "the works-here box's look", owner: "components/WorksHere.jsx" },
  "components/ApplicationQuestions.jsx": { what: "D185-1 — the posting's own application questions draft can't answer yet, and (switch on) Draft an answer the person saves" },
  "components/ApplicationQuestions.css": { what: "the application questions box's look", owner: "components/ApplicationQuestions.jsx" },
  "components/DepthButton.css":         { what: "the depth box, the .dbx-depth skin and the .mark (D60) — loaded app-wide by main.jsx", owner: "components/DepthButton.jsx", alsoBy: ["main.jsx"] },
  "components/DockPortal.jsx":          { what: "the portalled dropdown surface" },
  "components/PanelShell.jsx":          { what: "the overlay panel frame — every peer panel in the board's dock" },
  "components/StickyBar.jsx":           { what: "THE sticky-at-the-top section (D49)" },
  "components/StickyBar.css":           { what: "its look", owner: "components/StickyBar.jsx" },
  "components/TopBar.css":              { what: "the top bar's mark group (the tab row it styled went with D145)", owner: "components/TopBar.jsx" },
  // ⭐ D145 Step 3 · the Dock / the Menu. The Customise preview draws them with these classes — a decided reuse (the
  // preview must be the real look, as with the sentence, D93).
  "components/AppNav.css":              { what: "the Dock and the Menu's side panel (D145)", owner: "components/AppNav.jsx", alsoBy: ["components/CustomisePreview.jsx", "components/AskDraftThread.jsx"] },   // 46j: the Ask draft thread wears the panel's look
  "components/SectionHeading.jsx":      { what: "THE section heading (A93: was inside AutoApplyPanel's file)" },
  // ⭐ D167 · a place with its own navigation — Profile and Interview (and the pattern Atlas's navigation follows).
  "components/PlaceNav.jsx":            { what: "a place's own navigation (D167) — the nav card beside the dock, groups of panels at their own addresses, and PlaceHead" },
  "components/PlaceNav.css":            { what: "its look", owner: "components/PlaceNav.jsx" },
  "components/SettingsSection.jsx":     { what: "THE settings card — Account and Integrations (A93)" },
  "components/WarmPathsSettings.jsx":   { what: "Account's Warm paths card — import / delete the user's own LinkedIn export or alumni list (D138)" },
  "components/NotificationSettings.jsx": { what: "Account's Notifications card — push to this browser and email, a switch per event per channel (D112 item 8)" },
  "components/PlanSettings.jsx":         { what: "Account's phase-1 cards — the plan + the trial of 10 drafts, the phone (one-time code), the lead-sharing consent, the extension (A167)" },
  "components/ExtensionPanel.jsx":       { what: "the extension's pop-up panel — store / direct-download links from /api/config and how it helps; the posting and Settings (A167 (h))" },
  "components/OtpVerify.jsx":            { what: "THE one-time code control — send, enter, confirm → a proof; sign-up's email + phone and Settings' phone (A167 (d))" },
  "components/StatCard.jsx":            { what: "THE stat card — admin and the DB inspector (A93)" },
  "components/IngestFunnel.jsx":        { what: "a source's last crawl as a funnel (10-14) — the glance's Ingestion card and the inspector's Pipeline Health", module: "admin" },
  "components/EmptyState.jsx":          { what: "THE empty state — the board and The Table (A93)" },
  "components/DomainProfileWizard.jsx": { what: "the job-profile wizard — profiles, board, profile panel" },
  "components/ProfileSelectorDropdown.jsx": { what: "the active-profile picker — top bar and board" },
  "components/ExtensionPrompt.jsx":     { what: "the get-the-extension prompt — app, extension page, board" },
  "components/SurveyForm.jsx":          { what: "D129 v2 + D130 · THE ONE survey form: dropdowns, labelled stars, follow-ups, required, progress; /survey (the trial's in-app survey was removed 11-07)" },
  "components/ScrollDock.jsx":          { what: "the marketing and tools pages' dock" },
  "components/PolicyProse.jsx":         { what: "the public documents' prose parts — the privacy policy and the connector docs (/docs/claude)" },
  "components/Footer.jsx":              { what: "the site footer" },
  "components/StampLogo.jsx":           { what: "THE /draft mark" },
  "components/DraftMark.jsx":           { what: "the /d mark (D1)" },
  "components/StarMark.jsx":            { what: "the star (Save / Star) — the board's bubble and the plate market's row bubble (47f)" },
  "components/PaperBackground.jsx":     { what: "the paper grain behind every page" },
  "components/ui/DateCalendar.jsx":     { what: "the date picker" },
  "components/ui/PanelControls.jsx":    { what: "a panel's tab and search controls" },
  "components/ui/TileCard.jsx":         { what: "the profile tile" },
  "components/ui/toast.jsx":            { what: "toast primitives (shadcn)" },
  "components/ui/toaster.jsx":          { what: "the app's toaster" },
  // ── module-private parts ──
  "components/AppearanceSettings.jsx":  { what: "Customise's Theme and Accessibility cards, and the prefers-contrast offer (D91 P5; moved off Account by D93)", module: "customise" },
  "components/NarrationSettings.jsx":   { what: "D194 (2) · Customise's Narration voice — one of this device's voices for a played deck", module: "customise" },
  "components/RadioCards.jsx":          { what: "the Customise page's option cards — a keyboard radio group (D93)", module: "customise" },
  "components/CustomisePreview.jsx":    { what: "the Customise page's live preview, drawn with the real stylesheets (D93)", module: "customise" },
  "components/Customise.css":           { what: "the Customise page's look", owner: "panels/CustomisePanel.jsx", alsoBy: ["components/RadioCards.jsx", "components/CustomisePreview.jsx"] },
  "components/AppShell.jsx":           { what: "the signed-in frame", module: "shell" },
  "components/TopBar.jsx":              { what: "the top bar", module: "shell" },
  "components/AppNav.jsx":              { what: "the app's navigation — the dock (the plate Dock as the left rail / the phone's bottom bar), the area nav with the dock's search, the peek, Tiny (D145 → D197 #1)", module: "shell" },
  "components/dockPlace.js":           { what: "where the dock goes — the left rail from 980 px, the bottom bar below (D167 → D197 #1, A237)", module: "shell" },
  "components/NavBar.jsx":              { what: "the marketing nav", module: "shell" },
  "components/NavBar.css":              { what: "its look", owner: "components/NavBar.jsx" },
  "components/InlineLoginPopover.jsx":  { what: "the nav's sign-in popover", module: "shell" },
  "components/SignInProviders.jsx":    { what: "A138 — THE sign-in provider block (Continue with Google first) on every sign-in surface: the nav popover and /login" },
  "components/AdminLayout.jsx":         { what: "the admin frame", module: "shell" },
  "consoles/PlanConsoles.jsx":          { what: "the plan consoles — mount the board", module: "shell" },
  "components/AuthScreen.jsx":          { what: "sign-in / sign-up", module: "auth" },
  "components/SignupAtsHook.jsx":       { what: "the sign-up page's ATS hook", module: "auth" },
  "components/DealBackdrop.jsx":        { what: "the dealt cards behind the login form", module: "auth" },
  "components/CardBack.jsx":            { what: "a deck card's back (the tinted logo — owner-decided O34)", module: "deck" },
  "components/DeckGeometryControl.jsx": { what: "the deck's layout control (D149: on the Customise page)", module: "customise" },
  "components/JobBubble.jsx":           { what: "the board's card (D1)", module: "board" },
  "components/WarmPathsBlock.jsx":      { what: "D138 — people the user knows at a posting's company, beside the posting panel", module: "board" },
  "components/JobBubble.css":           { what: "its look", owner: "components/JobBubble.jsx" },
  "components/JobDetailPanel.jsx":      { what: "the board's posting panel (D48)", module: "board" },
  "components/JobDetailPanel.css":      { what: "its look", owner: "components/JobDetailPanel.jsx" },
  "components/CoverLetterModal.jsx":    { what: "the posting panel's cover letter", module: "board" },
  "components/ByomResumeChoice.jsx":    { what: "the posting panel's Résumé choice — draft, or the user's own ChatGPT / Claude (D86)", module: "board" },
  "components/ByomResumeChoice.css":    { what: "its look", owner: "components/ByomResumeChoice.jsx" },
  "components/ExtensionPanel.css":      { what: "its look", owner: "components/ExtensionPanel.jsx" },
  // D90 P3: shared — the posting panel (board), Draft House's review line and The Table's What we sent all open it.
  "components/ResumeChangesPanel.jsx":  { what: "What we changed — any two résumés side by side, its summary line, and What we sent (D90)" },
  "components/AskDraftThread.jsx":      { what: "One held application's questions as a thread in Ask draft — answered one at a time, Finish the form (A199 (2), 46j)", module: "shell" },
  "components/ResumeChangesPanel.css":  { what: "its look", owner: "components/ResumeChangesPanel.jsx" },
  "components/ResumeEditorHost.jsx":    { what: "THE résumé editor's full-screen view — resume-master's editor embedded through rm-editor/1, Back / Esc returns (D157 option A)" },
  "components/ResumeEditorHost.css":    { what: "its look", owner: "components/ResumeEditorHost.jsx" },
  "components/AttemptResume.jsx":       { what: "an application attempt's résumé: open it in draft (read-only once sent) or download the PDF (D171 FIX 4)" },
  "components/AttemptPosting.jsx":      { what: "an application's posting opened in place on Home: the JD as stored when it was made + Open the original (D171 FIX 3)" },
  "components/BoardBar.jsx":            { what: "the Full House bar", module: "fullHouseHeader" },
  "components/BoardHeadline.jsx":       { what: "the filter sentence", module: "fullHouseHeader" },
  "components/SortPanel.jsx":           { what: "the sort panel", module: "fullHouseHeader" },
  "components/WordPanel.jsx":           { what: "a sentence word's panel", module: "fullHouseHeader" },
  "components/FullHouse.css":           { what: "the Full House header's look", owner: "components/BoardHeadline.jsx" },
  "components/UnifiedSearchBar.css":    { what: "the search well's look (the board's bar, the open board)", owner: "components/BoardBar.jsx" },
  "components/UsbSuggest.jsx":          { what: "the search bar's suggest", module: "searchBar" },
  "components/DraftHouseTree.jsx":      { what: "Draft House's auto-apply timeline — D113's runs by day, bubbles ringed by stage, pulsing for the live ones; a bubble opens its row (D146)", module: "draftHouse" },
  "components/ApplicationTracker.jsx":  { what: "D146 · the one tracker's table — counts, filters, sortable plain rows, a row that opens in place (RowOpen)", module: "draftHouse" },
  "components/ApplicationTracker.css":  { what: "its look", owner: "components/ApplicationTracker.jsx" },
  "components/WaitingLine.jsx":         { what: "Draft House's waiting line", module: "draftHouse" },
  "components/AutoSettingsDrawer.jsx":  { what: "Draft House's ONE Settings drawer — when and how much, which jobs, accounts on job sites (D102 P4 + D100 Portals, merged by D113 UI U8)", module: "draftHouse" },
  "components/DraftHouse.css":          { what: "Draft House's look", owner: "panels/AutoApplyPanel.jsx" },
  "components/ApplicationHistory.jsx":  { what: "The Table's history view (D15) — the full sheet's History; its CSV import is the tracker's header Import (D146)", module: "draftHouse" },
  "components/RefineJobProfile.jsx":   { what: "'Refine your job profile' — a profile made from a résumé opens the same wizard, everything filled (D112 e2); profiles and the profile panel" },
  "components/StartFromResume.jsx":    { what: "the first screen of a new account — one résumé upload sets up the first job profile (A104); the deck (A214: the board beside it no longer repeats it)" },
  "components/ProfileSections.jsx":    { what: "Profile in sections + Application defaults — what the fill reads for eligibility and self-ID (D101)" },
  "components/ApplicationInbox.jsx":    { what: "The Table's Inbox — replies from job sites, forwarded or read through a Gmail connection, filed by rule (D103, D112)", module: "draftHouse" },
  "components/ApplicationHistory.css":  { what: "its look", owner: "components/ApplicationHistory.jsx" },
  "components/PendingApplications.jsx": { what: "The Table's pending list", module: "draftHouse" },
  // ── state ──
  "contexts/AppScrollContext.jsx":      { what: "the app's scroll container" },
  "contexts/AutoApplyContext.jsx":      { what: "the apply line's state, shared by board and Draft House" },
  "contexts/JobBoardContext.jsx":       { what: "the board's state, shared by the shell and the board" },
  // ── hooks ──
  "hooks/use-toast.js":                 { what: "toasts" },
  "hooks/useBoardLock.js":              { what: "the board's lock" },
  "hooks/useChromeHeight.js":           { what: "the chrome's height" },
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
  "lib/narrationVoice.js":              { what: "D194 (2) · the narration voice — one of this device's installed voices, chosen in Customise, used by the played deck" },
  "lib/personalState.js":               { what: "A148 · forget the signed-in person when they change (sign-out, a switch) — one place, every tab" },
  "lib/atlasLinks.js":                  { what: "D105 P5 · a skill tag's link to its PUBLISHED Atlas page — resolved in bulk, cached per page" },
  "lib/applyObstacles.js":              { what: "the apply line's vocabulary" },
  "lib/applyTools.js":                  { what: "the apply-run request constants" },
  "lib/oauthNext.js":                  { what: "the one return path after sign-in to a host's consent screen (D86)" },
  "lib/companySlug.js":                { what: "D179 — a company page's address from its name (the server records' own rule)" },
  "lib/signInReturn.js":               { what: "A138 — the one rule for where a sign-in returns to (the page it was started from)" },
  "lib/openPosting.js":                 { what: "THE way a posting is opened — handed to the extension when it is here (D99 J11)" },
  "lib/boardSearch.js":                { what: "45n — a search started outside the jobs page (the dock's search) handed to the board; one way in" },
  "lib/assistantBridge.js":            { what: "D190 · how Ask draft reaches the SAME functions the buttons call (the board and the deck register them); the session's conversation key" },
  "lib/assistantDraft.js":             { what: "D190 · Ask draft's handlers for content/assistant/commands-v1.json — T1 actions and T2 lookups with no model; T3 only on an explicit ask" },
  "lib/resumeEditor.js":                { what: "THE way the résumé editor is opened, from anywhere; its change list and draft's live theme tokens (D157)" },
  "lib/boardPaging.js":                 { what: "the board's paging" },
  "lib/companyBrief.js":                { what: "D199 C6 / D200 Rule 2 · a company in brief (filings, hiring trend, open roles, its stack with your marks) from the survey sheet's own answer — the market's popovers and field card" },
  "lib/boardViewCache.js":              { what: "the board's view cache (D45)" },
  "lib/deckState.js":                   { what: "the deck's reducer" },
  "lib/deckWheel.js":                   { what: "the deck gesture — one flick turns one card (D168); Home's deck and Atlas's lesson deck (D178-3)" },
  "lib/deckCardFacts.js":               { what: "what the deck card says and where — collapsed, hover, Why this job (D145); one function, nothing said twice" },
  "lib/deckOrder.js":                   { what: "the deck's order (dealt | ATS match) — the deck's control and Customise read one store (D93)" },
  "lib/draftHouseExceptions.js":        { what: "Draft House's exceptions" },
  "lib/heldApplication.js":             { what: "the held application opened in place: its state's words, the steps the run took, each answer's source, earlier attempts (D165 (5))" },
  "lib/planWords.js":                   { what: "the plan card's words — the trial's drafts left, the plan and its renewal (A167)" },
  "lib/draftHouseTree.js":              { what: "Draft House's tree as data — the ladder to the ring, runs, the nodes, answers (D113 UI)" },
  "lib/trackerRows.js":                 { what: "what each tracker row says, and where — stage, filter, columns, the opened row, actions by stage (D146); one function" },
  "lib/tableExport.js":                 { what: "The Table's exports, built once — Excel and the CSV of the rows shown (D146: the header's Export and the full sheet's)" },
  "lib/draftHouseRuns.js":              { what: "Draft House's ONE adapter to D113's routes (runs, picks, left out) — degrades when they 404" },
  "lib/parseResumeFile.js":            { what: "THE résumé file → text reader (PDF via /api/parse-pdf, Word via mammoth) — Job profiles and A104" },
  "lib/boardFilterMemory.js":           { what: "the board's last filters, kept for Auto settings' \"Start from my board filters\" (D102 P4)" },
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
  "styles/pageWidth.css":               { what: "THE page width rule (46q FULL WIDTH) — --page-gutter, --page-measure, .page-fill — global, loaded by main.jsx", owner: "main.jsx" },
  "styles/cues.css":                    { what: "THE shape cues + system preferences (D91) — global, loaded by main.jsx", owner: "main.jsx" },
  "styles/plate.css":                   { what: "D196 F1 · THE plate system's tokens (colour, type, line, shadow, radius, space, motion) under .plate — the only place a plate page's raw values live", owner: "plate/PlateRoot.jsx" },
  "styles/colorTokens.js":              { what: "THE colour tokens" },
  "styles/glass.js":                    { what: "THE glass surface" },
  // T9: the ATS half of the pair draws its surface inside its own shadow root (shared/atsReportStyles.js), so the posting owns this one.
  "styles/inkPair.css":                 { what: "the D32 ink pair surface — the posting's half", owner: "components/PostingPanel.jsx" },
  "styles/mark.js":                     { what: "THE mark (D60)" },
  "styles/rings.js":                   { what: "THE bubble standard's ring — seven states, colour tokens (D113 UI U2)" },
  "styles/paper.js":                    { what: "the paper grain" },
  "styles/theme.jsx":                   { what: "THE theme provider" },
  "styles/type.js":                     { what: "THE type scale" },
  "styles/zLayers.js":                  { what: "THE z-scale" },
  "themes/charcoal-dark.js":            { what: "a theme: Charcoal Dark's tokens and substrate (D91)" },
  "themes/contrast-dark.js":            { what: "a theme: Contrast Dark, AAA — generated by scripts/deriveThemeTokens.mjs (D91)" },
  "themes/contrast-light.js":           { what: "a theme: Contrast Light, AAA — generated by scripts/deriveThemeTokens.mjs (D91)" },
  "themes/cinematic.js":               { what: "the theme.* name map and the injected CSS" },
  "themes/index.js":                    { what: "THE theme registry — the one place a theme is chosen (D91)" },
  "themes/layoutOptions.js":            { what: "THE layout-options registry — the Customise page draws itself from it (D93; the ids are in shared/appearance.js)" },
  "themes/paper-light.js":              { what: "a theme: Paper Light's tokens and substrate (D91)" },
  "themes/studio-light.js":             { what: "a theme: Studio Light, the admin sketch's look (D133, generated by scripts/d133StudioTokens.mjs)" },
  "themes/studio-dark.js":              { what: "a theme: Studio Dark, the admin sketch's look (D133, generated by scripts/d133StudioTokens.mjs)" },
  "themes/dusk-light.js":               { what: "a theme: Dusk Light, warm off-white and deep coral (D144, generated by scripts/d144DuskTokens.mjs)" },
  "themes/dusk-dark.js":                { what: "a theme: Dusk Dark, warm charcoal and pale peach (D144, generated by scripts/d144DuskTokens.mjs)" },
  "themes/plain-light.js":              { what: "a theme: Plain Light, neutral backgrounds and one blue accent, no tints (D181, generated by scripts/d181PlainTokens.mjs)" },
  "themes/plain-dark.js":               { what: "a theme: Plain Dark, neutral charcoal and one light-blue accent, no tints (D181, generated by scripts/d181PlainTokens.mjs)" },
  "themes/shapes.js":                   { what: "the second token set — corners + type, only Dusk has one (D144); the text-size scale ts() (D145)" },
});

// ── COMPOSITIONS: a panel or page mounting ANOTHER panel whole. Allowed only when declared, with why.
export const COMPOSITIONS = Object.freeze([
  { from: "components/AdminLayout.jsx", to: "panels/AdminPanel.jsx", why: "the admin frame renders the admin panel" },
  { from: "consoles/PlanConsoles.jsx", to: "panels/JobsPanel.jsx", why: "each plan console renders the board" },
  { from: "panels/JobsPanel.jsx", to: "panels/SandboxPanel.jsx", why: "the board's panel dock mounts the PDF panel beside the posting" },
  { from: "panels/AutoApplyPanel.jsx", to: "panels/JobWorkspacePanel.jsx", why: "D102 P5: on a wide screen Draft House shows an opened application beside its list" },
  { from: "panels/DatabasePanel.jsx", to: "panels/JobWorkspacePanel.jsx", why: "D102 P5: on a wide screen The Table shows an opened application beside History" },
  { from: "pages/LandingPage.jsx", to: "panels/DeckView.jsx", why: "46v (owner 11-18: \"use the same card as we use inside the site\"): the landing's hero deals the deck's own home card (HomeCardStill) and its buttons, no decisions" },
  { from: "pages/jobs/PublicBoardPage.jsx", to: "panels/DeckView.jsx", why: "D179 (f): the signed-out /jobs draws the deck's own card (CardFace), no decisions" },
  { from: "pages/profile/ProfilePage.jsx", to: "panels/ProfilePanel.jsx", why: "D167: About you / Your résumés / Saved answers are the Profile page's own parts (`section`)" },
  { from: "pages/profile/YourProfile.jsx", to: "panels/ProfilePanel.jsx", why: "D183 P2: Your profile listens for the base-résumé save / upload that ProfilePanel fires (RESUME_REPLACED_EVENT) to show What changed" },
  { from: "pages/profile/ProfilePage.jsx", to: "panels/SavedAnswersPanel.jsx", why: "D167: Profile → Saved answers is the saved-answer bank, whole (its own API)" },
  { from: "pages/profile/ProfilePage.jsx", to: "panels/IntegrationsPanel.jsx", why: "D167: Profile → Connections holds Integrations, whole (`embedded`)" },
  { from: "pages/profile/ProfilePage.jsx", to: "panels/AccountPanel.jsx", why: "D167: Account's cards spread over Notifications, Privacy, Account, Résumés and Connections (`only`)" },
  { from: "pages/profile/ProfilePage.jsx", to: "panels/CustomisePanel.jsx", why: "D167: Profile → Appearance IS the Customise screen, retained exactly (owner 11-06)" },
  { from: "panels/AutoApplyPanel.jsx", to: "panels/DatabasePanel.jsx", why: "D146: The Table merged into Draft House — its full sheet (spreadsheet, by company, board, funnel, pending, inbox) behind Settings → View" },
]);

// ── CROSS_PRODUCT: ONE component, outside client/src, drawn by the web app AND the extension (T9, owner 10-14: "the
//    same ATS panel we use on the website — same design and everything"). Not a mirror — the SAME code: the web app
//    imports the module through its wrapper; the extension loads the generated bundle (scripts/buildAtsReport.mjs),
//    because it cannot reach ../shared and runs no remote code. The guard checks every path, that the wrapper imports
//    the module, that each extension consumer loads the bundle, and that the bundle is current.
export const CROSS_PRODUCT = Object.freeze([
  { module: "shared/atsReportElement.js", what: "<draft-ats-report> — THE ATS report (structure, copy, events, the renderer)",
    parts: ["shared/atsReportModel.js", "shared/atsReportStyles.js", "shared/atsReportTokens.js"],
    web: "components/AtsReport.jsx", bundle: "extension/atsReport.js",
    // ⭐ T31 (10-25): the toolbar popup is retired — the dock's ATS tab is the extension's one place for the report
    extension: ["extension/resumePanel.js", "extension/boardJob.js"],
    why: "the extension's on-page panel (the dock's ATS tab) draws the web app's ATS report from the same JSON (T9)" },
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

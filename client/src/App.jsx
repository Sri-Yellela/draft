// REVAMP v1 — App.jsx
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, setAuthContext }   from "./lib/api.js";
import { notePerson, onPersonChangedElsewhere } from "./lib/personalState.js";   // A148
import { adoptAccountTheme }     from "./styles/colorTokens.js";
import { ContrastOffer }         from "./components/AppearanceSettings.jsx";
import { useTheme }              from "./styles/theme.jsx";
import { useInactivityLogout }   from "./hooks/useInactivityLogout.js";
import { useSyncEvents }         from "./hooks/useSyncEvents.js";
import AuthScreen                from "./components/AuthScreen.jsx";
import AdminLayout               from "./components/AdminLayout.jsx";
import AdminLoginPage, { AdminSetPasswordPage } from "./pages/AdminLoginPage.jsx";
import DBInspector               from "./pages/admin/DBInspector.jsx";
// ⭐ D196 F4: the plate system's gallery (/dev/plate, Admin only) — its own chunk, so the plate library adds nothing to the
// app's first load (R3) until a plate page ships.
const PlateGallery = lazy(() => import("./pages/dev/PlateGallery.jsx"));
import TopBar                     from "./components/TopBar.jsx";
import { ShellAreaNav }           from "./components/AppNav.jsx";   // ⭐ D197 #1: the area nav across the content column
import AppShell                  from "./components/AppShell.jsx";
import { useChromeHeight }       from "./hooks/useChromeHeight.js";
import { AppScrollProvider } from "./contexts/AppScrollContext.jsx";
import { JobBoardProvider, useJobBoard } from "./contexts/JobBoardContext.jsx";
import { AutoApplyProvider, useAutoApply } from "./contexts/AutoApplyContext.jsx";
import { AutoApplyPanel }        from "./panels/AutoApplyPanel.jsx";
import { JobWorkspacePanel }     from "./panels/JobWorkspacePanel.jsx";
import { ExtensionFirstRunPrompt } from "./components/ExtensionPrompt.jsx";
import { JobProfilesPanel }      from "./panels/JobProfilesPanel.jsx";
// ⭐ D167 · Profile and Interview, each with its own navigation (pages/profile, pages/interview). Profile mounts the old
// settings pages (Profile, Saved answers, Integrations, Account, Customise) as its panels, so App no longer does.
import ProfilePage               from "./pages/profile/ProfilePage.jsx";
import { profilePanelFor, profilePath, LEGACY_PROFILE_ROUTES, PASSPORT_VIEWS, passportMore, PASSPORT_STAMPS_EVENT } from "./pages/profile/profilePanels.js";
import ProvingGround, { useInterviewAreaNav } from "./pages/interview/ProvingGround.jsx";   // ⭐ D197 Wave 2 #13 (47m): Interview as the Proving ground
import CompanyPage               from "./pages/companies/CompanyPage.jsx";   // D179 P4b
import NetworkPage               from "./pages/network/NetworkPage.jsx";      // D180 P1 (45o): behind the network switch
import FeedPage                  from "./pages/network/FeedPage.jsx";         // 46f: the feed's own page
import MessagesPage              from "./pages/network/MessagesPage.jsx";     // 46f: messages' own page
import PublicBoardPage           from "./pages/jobs/PublicBoardPage.jsx";    // D179 P3
import AuditPage                 from "./pages/audit/AuditPage.jsx";         // D150 T05–T08
import { interviewPanelFor, interviewPath } from "./pages/interview/interviewModel.js";
import DeckView                  from "./panels/DeckView.jsx";
import { routeCommitted, transitionTo } from "./lib/viewTransitions.js";
import { RecruiterPanel }        from "./panels/RecruiterPanel.jsx";
import { JobsConsole }            from "./consoles/PlanConsoles.jsx";
import { ALL_FILTERS_ID } from "./components/BoardHeadline.jsx";   // A146: the All filters word (47j R2: the classic sentence header is deleted)
import PlateBearing from "./plate/PlateBearing.jsx";   // ⭐ D196 P1: the bearing as a cartouche (off until the owner's ok)
import { useBestCard } from "./plate/marketPlate.js";
import MarketHero from "./plate/MarketHero.jsx";   // ⭐ D196 P1: the market's hero on real data
import MarketOpenings from "./plate/MarketOpenings.jsx";   // ⭐ D196 P1: Deck · Terrain · Index + the field card
import { MarketSearchRow, MarketSortButton, MarketFilterRow, MarketStatsBox } from "./plate/MarketControls.jsx";   // ⭐ D199 C2 / C4
import MarketPager from "./plate/MarketPager.jsx";   // ⭐ D199 C3: pages, not endless scroll
import { sectorsFromRoleOptions } from "./plate/MarketMap.jsx";   // ⭐ D199 C5 / D200: the political map's sectors
import PlateRoot from "./plate/PlateRoot.jsx";
import AreaErrorBoundary from "./plate/AreaErrorBoundary.jsx";   // ⭐ 47k: one area failing (a render throw, a missing chunk) never blanks the shell
import OpeningSheet, { OPENING_ROUTE } from "./plate/OpeningSheet.jsx";   // ⭐ D199 C7: /app/jobs/<id>, the opening sheet over the market
import { LegHeader } from "./plate/Plates.jsx";
import WordPanel                 from "./components/WordPanel.jsx";
import SortPanel                 from "./components/SortPanel.jsx";
import { BoardSearch, ImportJobBox } from "./components/BoardBar.jsx";
import { nextBoardPanel, sortRows, isSortChosen, DEFAULT_SORT, BOARD_PANEL, viewCounts, marketFigures, sentenceParts } from "./lib/filterSentenceModel.js";
import { ATSToolPage }           from "./pages/tools/ATSToolPage.jsx";
import { GenerateToolPage }      from "./pages/tools/GenerateToolPage.jsx";
import { ApplyToolPage }         from "./pages/tools/ApplyToolPage.jsx";
import { HonestyToolPage }       from "./pages/tools/HonestyToolPage.jsx";

import LandingPage    from "./pages/LandingPage.jsx";
import NavBar         from "./components/NavBar.jsx";
import ProductsPage   from "./pages/ProductsPage.jsx";
import BlogPage       from "./pages/BlogPage.jsx";
import NotFoundPage   from "./pages/NotFoundPage.jsx";
import { isReserved as isReservedPath } from "../../shared/companyPaths.js";   // A157 (45q)
import { clearAskDraftSession } from "./lib/assistantBridge.js";   // D190: sign-out clears Ask draft's conversation
import { MonetisationProvider, useMonetisationEnabled } from "./lib/monetisation.jsx";

// Marketing pages (lazy-loaded is fine but direct imports work too)
import { FeaturesPage }    from "./pages/marketing/FeaturesPage.jsx";
import { HowItWorksPage }  from "./pages/marketing/HowItWorksPage.jsx";
import { ExtensionPage }   from "./pages/marketing/ExtensionPage.jsx";
import { PricingPage }     from "./pages/marketing/PricingPage.jsx";
import { AboutPage }       from "./pages/marketing/AboutPage.jsx";
import { ContactPage }     from "./pages/marketing/ContactPage.jsx";
import { FAQPage }         from "./pages/marketing/FAQPage.jsx";
import { PrivacyPage }     from "./pages/marketing/PrivacyPage.jsx";
import { TermsPage }       from "./pages/marketing/TermsPage.jsx";
import { ConnectorDocsPage } from "./pages/marketing/ConnectorDocsPage.jsx";
// ⭐ D105 P4: the Atlas — public at /atlas, and inside the app at /app/atlas under the top bar's Atlas tab.
import AtlasPage       from "./pages/atlas/AtlasPage.jsx";
import { useAtlasAreaNav } from "./pages/atlas/AtlasVolume.jsx";   // ⭐ D197 #5 (47h): Atlas's area nav
import { Toaster }         from "./components/ui/toaster.jsx";
import ResumeEditorHost     from "./components/ResumeEditorHost.jsx";
import { REOPEN_KEY } from "./lib/resumeEditor.js";
import { BOARD_SEARCH_EVENT, takePendingBoardSearch } from "./lib/boardSearch.js";
import SurveyPublicPage from "./pages/SurveyPublicPage.jsx";
import { oauthNext }       from "./lib/oauthNext.js";
import { loginHref, currentReturnPath, returnToFromSearch } from "./lib/signInReturn.js";
import { ts } from "./themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const CONSOLE_ROUTE = "jobs";
const LEGACY_CONSOLE_ROUTES = new Set(["simple-apply", "tailored", "custom-sampler"]);
// ⭐ D146: The Table's old route — it redirects to Draft House, the one application tracker.
const TABLE_ROUTE = "database";

// ⛔ 47j w1-shell: AuthBootstrapScreen (a "Loading…" spinner nothing rendered — the gates return null while auth is
// unknown) is deleted.

function UserRouteGate({ authStatus, authUser, children }) {
  if (authStatus === "unknown") return null;
  // ⭐ A138: signed out on a signed-in page → /login, carrying where to come back to.
  if (authStatus !== "authenticated" || !authUser) return <Navigate to={loginHref(currentReturnPath())} replace/>;
  if (authUser.isAdmin) return <Navigate to="/admin" replace/>;
  return children;
}

// ⛔ D95: the console opens for an ADMIN ACCOUNT's session (GET /api/admin/auth/me) — and, only while the switch is
// off, for the legacy admin users row.
function AdminRouteGate({ authStatus, authUser, adminSession, children }) {
  if (authStatus === "unknown" || !adminSession) return null;
  if (adminSession.authenticated) return children;
  if (!adminSession.enforced && authStatus === "authenticated" && authUser?.isAdmin) return children;
  return <Navigate to="/admin/login" replace/>;
}

// ⭐ D86: after sign-in, back to a host's consent screen — lib/oauthNext.js says which `next` is honoured.
function PublicLoginRoute({ authStatus, authUser, children, admin = false, adminSession = null }) {
  if (authStatus === "unknown") return null;
  if (admin && adminSession?.authenticated) return <Navigate to="/admin" replace/>;   // D95: already an admin here
  const next = typeof window !== "undefined" ? oauthNext(window.location.search) : null;
  if (authStatus === "authenticated" && authUser && next) {
    window.location.replace(next);
    return null;
  }
  if (authStatus === "authenticated" && authUser) {
    // ⭐ Sessions A′ (owner, 10-09): the admin and the owner's own account can be open at once, one per tab.
    // A tab arriving at the OTHER kind's sign-in page signs that account in here and leaves the first tab
    // alone — so it is shown the form, and told plainly whose session this browser already has.
    if (admin) return authUser.isAdmin ? <Navigate to="/admin" replace/> : <><SignedInElsewhere user={authUser} admin/>{children}</>;
    // ⭐ A138: a sign-in started elsewhere comes back to that page, not /app.
    return authUser.isAdmin ? <><SignedInElsewhere user={authUser}/>{children}</>
      : <Navigate to={(typeof window !== "undefined" && returnToFromSearch(window.location.search)) || "/app"} replace/>;
  }
  return children;
}

/** Sessions A′: "this browser is signed in as … in another tab" — above the other kind of sign-in form. */
export function SignedInElsewhere({ user, admin = false }) {
  return (
    <div role="status" data-signed-in-elsewhere="" style={{ position: "relative", zIndex: 5, boxSizing: "border-box",
      width: "min(560px, calc(100% - 32px))", margin: "12px auto 0", padding: "10px 14px", borderRadius: 6, fontSize: ts(13), lineHeight: 1.5,
      background: "var(--color-surface-offset)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderLeft: "3px solid var(--color-primary)" }}>
      This browser is signed in as <strong>{user.username}</strong>{user.isAdmin ? " (admin)" : ""} in another tab.{" "}
      {admin ? "Sign in as an admin here" : "Sign in with your own account here"} — that tab stays signed in.
    </div>
  );
}
// The board's search field. A separate component purely because AppDashboard RENDERS
// <JobBoardProvider> and therefore sits outside it — useJobBoard() called up there would read a
// null context. This is the smallest thing that can live inside the provider and still hand the
// field its handler.
//
// A74 (owner, 10-03): one press, one search — Enter commits the keyword and the board runs the ranked
// local search (A72).
//
// ⛔ D26/D28: on the board the field is the SEARCH INPUT ONLY — it publishes `query` and nothing else,
// so a search never overwrites the sentence's filters. D35: it is the condensed bar's middle (no
// Search button; the landing page keeps UnifiedSearchBar).
function BoardSearchBar(props) {
  const { applyBarFilters, boardHeadline } = useJobBoard();
  // ⭐ 45n: a search handed over by the dock (lib/boardSearch.js) — waiting when the board mounts, or announced while it is up.
  const applyHanded = useRef(null);
  applyHanded.current = (d) => {
    if (!d) return;
    if (d.query != null) applyBarFilters({ query: String(d.query) }, { fields: ["query"] });
    else if (d.role && boardHeadline?.onPatch) boardHeadline.onPatch({ subcategory: d.role.id, category: d.role.categoryId });
    else if (d.tech && boardHeadline?.onPatch) boardHeadline.onPatch({ tech: d.tech.name });
  };
  useEffect(() => {
    applyHanded.current(takePendingBoardSearch());
    const on = (e) => { takePendingBoardSearch(); applyHanded.current(e.detail); };
    window.addEventListener(BOARD_SEARCH_EVENT, on);
    return () => window.removeEventListener(BOARD_SEARCH_EVENT, on);
  }, []);
  return (
    <BoardSearch
      {...props}
      onSubmit={params => applyBarFilters(params, { fields: ["query"] })}
      // ⭐ D179 (a): a role picked from the search box's Roles sets the sentence's role (the domain word).
      onPickRole={boardHeadline?.onPatch ? (r) => boardHeadline.onPatch({ subcategory: r.id, category: r.categoryId }) : undefined}
      onPickTech={boardHeadline?.onPatch ? (t) => boardHeadline.onPatch({ tech: t.name }) : undefined}
    />
  );
}

// D26/D30/D35: THE SENTENCE IS THE HEADLINE, AND ITS WORDS ARE THE CONTROLS. JobsPanel publishes what
// it projects (the committed clause params, the facets answer, the patch it applies); a word's press
// goes through nextBoardPanel on the board's ONE panel value, so the same word closes what it opened
// and opening another closes the first. The panel renders HERE, directly beneath the sentence and
// above the bar — D35 §4's order: the sentence, the open panel, the bar, the jobs.
// 47h: the bearing's "FROM file · date" — the active profile's résumé (its name and when it was set), read once per page
// and only on the plate market; no résumé (or a failed read) → nothing, and the strip keeps its words. (⛔ 47j w1-shell: its
// `on` argument is gone — 47j R2 made the market the plate market only, so every caller passed true.)
function useResumeSource() {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    api("/api/base-resume").then((r) => { if (live && r?.name) setSrc({ name: r.name, at: r.updatedAt ?? null }); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return src;
}

function BoardHeadlineSlot() {
  const { boardHeadline, boardPanel, setBoardPanel, localSearch, applyBarFilters } = useJobBoard();
  const resumeFrom = useResumeSource();
  if (!boardHeadline) return null;
  const { params, defaultDomain, nothingMatches, facets, facetsStatus, otherFilterCount, onPatch, onMoreFilters, onClearAll } = boardHeadline;
  // ⭐ D196 P1: the sentence, controls and panel, drawn as the board's cartouche. ⛔ 47j R2: the classic market's sentence
  // header (BoardHeadline + "All filters" beside it) is deleted — the market is the plate market only.
  // ⭐ D199 C2 / C4 (47h, the `Market` board): INSIDE the cartouche, under the sentence — the search + sort, the filter chips
  // (each opens its word's panel in place, beneath them), the active chips + Clear all, then the stats box. The chips and the
  // sentence read the same params and write through the same onPatch (one state); the box reads the same facets answer.
  const clearQuery = () => applyBarFilters?.({ query: "" }, { fields: ["query"] });
  const toggle = (key) => setBoardPanel(current => nextBoardPanel(current, key));
  return (
    <PlateBearing params={params} defaultDomain={defaultDomain} nothingMatches={nothingMatches}
      open={boardPanel} onToggle={toggle}
      allSlot={BOARD_PANEL.ALL} allOpen={boardPanel === BOARD_PANEL.ALL} from={resumeFrom}
      onAll={() => toggle(BOARD_PANEL.ALL)}>
      <MarketSearchRow search={<BoardSearchBar value={localSearch} placeholder="Search a company, role, technology or title" />}
        sort={<MarketSortSlot />} />
      <BoardSortSlot />
      <MarketFilterRow params={params} otherFilterCount={otherFilterCount} query={localSearch} open={boardPanel}
        onOpen={toggle} onMore={onMoreFilters} onPatch={onPatch} onClearQuery={clearQuery}
        onClearAll={() => { onClearAll?.(); clearQuery(); setBoardPanel(null); }}
        all={{ id: ALL_FILTERS_ID, slot: BOARD_PANEL.ALL, open: boardPanel === BOARD_PANEL.ALL, onPress: () => toggle(BOARD_PANEL.ALL) }} />
      <WordPanel open={boardPanel} params={params} defaultDomain={defaultDomain}
        facets={facets} facetsStatus={facetsStatus} otherFilterCount={otherFilterCount}
        onPatch={onPatch} onOpen={(key) => setBoardPanel(key)} onClose={() => setBoardPanel(null)}
        onMoreFilters={onMoreFilters} />
      <MarketStatsBox figures={marketFigures(facets)} params={params} onPatch={onPatch} loading={facetsStatus === "loading"}
        onShowAll={() => document.getElementById("openings")?.scrollIntoView?.({ behavior: "smooth", block: "start" })} />
    </PlateBearing>
  );
}

// Tells lib/viewTransitions.js that a navigation has reached the DOM. A layout effect, so it runs
// after React writes the new route and before the browser paints — the moment a view transition's
// update callback must wait for, because BrowserRouter commits navigations as React transitions.
function RouteCommitSignal() {
  const location = useLocation();
  useLayoutEffect(() => { routeCommitted(); }, [location.key]);
  return null;
}

// The top bar, with the DRAFT tab's /d mark and its needs-review count decorated onto it.
//
// This wrapper exists for the same reason BoardSearchBar does: AppDashboard RENDERS
// AutoApplyProvider, so it cannot read the count itself. The decoration used to live on
// BoardSearchBar, because the tab row lived on the search bar; the row moved into the top bar in Y4
// and the badge moved with it, because a review queue nobody sees is worse than a cluttered bar.
function AppTopBar({ tabs, ...props }) {
  const { needsAttentionCount = 0 } = useAutoApply();

  // The board keeps a MINIMAL indicator and only when something is actually waiting on a human: a
  // count on the tab, not a strip above the postings. This is the requirement that "3 need review"
  // stays discoverable from the board, and it is the ONLY thing the pipeline still renders outside
  // its own panel.
  //
  // D6: the tab said AUTO APPLY — two names for the card's one action. D18: it is DRAFT HOUSE, set on
  // two lines like the other three, and carries NO symbol (the /d mark beside the /draft logo read as
  // the same thing twice). Under that name a bare number reads as "how many drafts", which it is not:
  // it counts drafts that need YOU — waiting for approval, held for review, or with a question open.
  // So the title and the screen-reader text say "N drafts need your attention", and the bare digit is
  // hidden from the accessible name.
  const attention = `${needsAttentionCount} ${needsAttentionCount === 1 ? "draft needs" : "drafts need"} your attention`;
  // ⭐ D145: the count rides on the Draft House button of the Dock / the Menu (AppNav.jsx draws it) as data — a number
  // and its sentence — rather than as a decorated label.
  const decorated = (tabs || []).map(t =>
    t.id === "auto-apply" ? { ...t, badge: needsAttentionCount, badgeLabel: attention } : t);

  return <TopBar {...props} tabs={decorated} />;
}


// ⛔ A157 (45q): the Companies view that once swapped the board's parts out is gone (no Companies tab) — and 47j w1-shell
// deleted BoardOrCompanies, the wrapper left behind, which only concatenated its children.
// ⛔ D156 (4) (owner 11-05: "we dont need the drafted panel now"): the Pending / Drafted view is not offered on Home — the
// tracker (Draft House) holds every application. ?view=pending still reads (JobBoardContext's BOARD_VIEWS).


// ⛔ THE RESUME GATES BEST FIT AND NOTHING ELSE (decided 2026-09-26): /api/jobs ranks fine without a résumé, so the only
// thing a missing one prevents is ranking by FIT — sortRows(false) leaves Best fit out, and this falls back to the default
// when the board was sorted by fit as the résumé went. (47j R2: the classic bar's sort icon, which first held this rule, is
// deleted with the classic market.)
function MarketSortSlot() {
  const { boardPanel, setBoardPanel, sortBy, setSortBy, atsSortAvailable } = useJobBoard();
  const fitRow = sortRows(true).find(r => r.unscoredLast);
  useEffect(() => {
    if (!atsSortAvailable && fitRow && sortBy === fitRow.value) setSortBy(DEFAULT_SORT);
  }, [atsSortAvailable, sortBy, setSortBy, fitRow]);
  const chosen = isSortChosen(sortBy);
  const label = chosen ? (sortRows(atsSortAvailable).find(r => r.value === sortBy)?.label || "") : "Best match";
  return <MarketSortButton label={label} chosen={chosen} open={boardPanel === BOARD_PANEL.SORT}
    onPress={() => setBoardPanel(current => nextBoardPanel(current, BOARD_PANEL.SORT))} />;
}


// D35: the sort panel — ⭐ D156 (5): a small menu under the search field's sort icon. ⛔ 47j w1-market: drawn as a plate
// MarketPanel (kind "menu", plate/MarketControls.jsx) under the cartouche's search row — no FullHouse.css.
function BoardSortSlot() {
  const { boardPanel, setBoardPanel, sortBy, setSortBy, atsSortAvailable, boardHeadline } = useJobBoard();
  if (boardPanel !== BOARD_PANEL.SORT) return null;
  return (
    <SortPanel value={sortBy} onChange={(v) => { setSortBy(v); setBoardPanel(null); }} atsAvailable={atsSortAvailable}
      facets={boardHeadline?.facets ?? null} facetsStatus={boardHeadline?.facetsStatus ?? "idle"}
      onClose={() => setBoardPanel(null)} />
  );
}


// ⭐ D156 (4) · UNDER THE SEARCH: All jobs · Starred · Imported, each with its count (facets' views — a count the answer
// does not hold is not drawn), and "Import a job" — the inline box (BoardBar.jsx ImportJobBox; the existing import route).
// A job imported lands under Imported: the view switches there and the board is asked again.
// ⭐ D199 (47h, step 6): the views live in the shell's area nav (as the Market board draws them) and "Import a job" is its
// More menu's item (on a phone, a view in the scroller — A245) — it opens this box (IMPORT_JOB_EVENT). ⛔ 47j R2: the
// classic segment (All jobs · Starred · Imported + Import a job) is deleted with the classic market.
const IMPORT_JOB_EVENT = "draft:import-job";
function BoardViews({ onImported }) {
  const { setBoardTab } = useJobBoard();
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const open = () => setImporting(true);
    window.addEventListener(IMPORT_JOB_EVENT, open);
    return () => window.removeEventListener(IMPORT_JOB_EVENT, open);
  }, []);
  if (!importing) return null;
  return (
    // ⛔ 47j w1-market (D197 Wave 1 #2): the box is a plate panel (BoardBar.jsx ImportJobBox → MarketPanel), on the
    // Index's paper — no `.fh` row around it
    <div className="pl-mk-importrow" data-board-views="">
      {importing && (
        <ImportJobBox onClose={() => setImporting(false)}
          onImported={() => { setBoardTab?.("imported"); onImported?.(); }} />
      )}
    </div>
  );
}

// ⭐ D147 (D145's minimal counts) · "746 jobs · 38 new today · 12 saved" — each from the facets answer (views.all, the
// Posted clause's Past 24h count, views.saved); a count the answer does not hold is not drawn, never a 0 in its place.
// ⭐ D197 Wave 1 #1 · A237 · THE AREA NAV (the Shell board): across the top of the content column, beside the rail. The
// market's views are the board's — Today's picks (the openings' Deck) · All jobs · Starred · Imported (the board's own
// views: the openings turn to Index and the view is set, D35's one store) — with the drafts chip (the last 24 hours'
// drafts, /api/draft/slots — the server's rolling window, worded as such) and the dock's search. The market has no pill
// (its location lives in the bearing). Other areas get the search only until their pages' plates draw their views
// (Wave 1 #4 the ledger, #6 Atlas) — the dock's search is never lost.
const MARKET_AREA_VIEWS = [
  { id: "picks", label: "Today’s picks", href: "/app/jobs", icon: "picks" },
  { id: "all", label: "All jobs", href: "/app/jobs?view=all", icon: "list" },
  { id: "saved", label: "Starred", href: "/app/jobs?view=saved", icon: "starred" },
  { id: "imported", label: "Imported", href: "/app/jobs?view=imported", icon: "imported" },
];
// the openings' binder tabs (plate/MarketOpenings.jsx, idBase "mk-tab") are pressed, never re-implemented here
const pressOpeningsTab = (id) => { const b = document.getElementById(`mk-tab-${id}`); if (b && b.getAttribute("aria-selected") !== "true") b.click(); return !!b; };
// ⭐ D197 #3 (47i) · HOME's area nav = the final Ledger board's views (Needs you · In progress · Sent · Replies). Each presses
// the ledger header's own count cell (plate/ledgerModel.js countCells, data-ledger-count), which filters the register —
// one filter, never a second one here; the current view follows the cell that is pressed.
const LEDGER_AREA_VIEWS = [
  { id: "needs", cell: "needs", label: "Needs you", href: "/app/auto-apply", icon: "needs" },
  { id: "progress", cell: "progress", label: "In progress", href: "/app/auto-apply", icon: "progress" },
  { id: "sent", cell: "sent", label: "Sent", href: "/app/auto-apply", icon: "sent" },
  { id: "replies", cell: "replied", label: "Replies", href: "/app/auto-apply", icon: "replies" },
];
const ledgerCell = (cell) => document.querySelector(`[data-ledger-count="${cell}"] button`);
function LedgerAreaNav({ onHome }) {
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;
    const read = () => setCurrent(LEDGER_AREA_VIEWS.find((v) => ledgerCell(v.cell)?.getAttribute("aria-pressed") === "true")?.id || null);
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    return () => mo.disconnect();
  }, []);
  const onGo = (id) => {
    const v = LEDGER_AREA_VIEWS.find((x) => x.id === id);
    const b = v && ledgerCell(v.cell);
    if (b && b.getAttribute("aria-pressed") !== "true") b.click();
    requestAnimationFrame(() => document.querySelector("[data-ledger-register]")?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
  };
  return <ShellAreaNav area="Home" views={LEDGER_AREA_VIEWS} current={current} onGo={onGo} onHome={onHome} />;
}
function AppAreaNavSlot({ activeTab, onHome }) {
  const navigate = useNavigate();
  const { boardTab, setBoardTab, boardHeadline } = useJobBoard();
  const market = activeTab === "today" || activeTab === "console";
  const [deckShown, setDeckShown] = useState(true);
  // follow the openings' own tabs (a press on Deck / Index there moves the nav's current)
  useEffect(() => {
    if (!market || typeof MutationObserver === "undefined") return undefined;
    const read = () => { const d = document.getElementById("mk-tab-deck"); if (d) setDeckShown(d.getAttribute("aria-selected") === "true"); };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    return () => mo.disconnect();
  }, [market]);
  const [slots, setSlots] = useState(null);
  useEffect(() => { if (market) api("/api/draft/slots").then(setSlots).catch(() => {}); }, [market]);
  if (!market && activeTab === "auto-apply") return <LedgerAreaNav onHome={onHome} />;   // the ledger (⛔ 47j R3: always — the ?plate= switch is retired)
  if (activeTab === "atlas") return <AtlasAreaNav onHome={onHome} />;
  if (activeTab === "interview") return <InterviewAreaNav onHome={onHome} />;
  if (activeTab === "profile" || activeTab === "plans") return <PassportAreaNav onHome={onHome} />;   // ⭐ 47m: D197 #9 Your passport
  if (!market) return <ShellAreaNav area={AREA_NAMES[activeTab] || "draft"} onHome={onHome} />;
  const current = deckShown ? "picks" : boardTab;
  // the views' counts (the facets answer's, as the classic segment showed them) ride on the nav's words — never a 0 guessed
  const counts = viewCounts(boardHeadline?.facets);
  const views = MARKET_AREA_VIEWS.map((v) => (Number.isFinite(counts[v.id]) && v.id !== "picks"
    ? { ...v, label: `${v.label} · ${counts[v.id].toLocaleString("en-US")}` } : v));
  const onGo = (id) => {
    if (id === "import") { pressOpeningsTab("index"); window.dispatchEvent(new Event(IMPORT_JOB_EVENT));
      requestAnimationFrame(() => document.querySelector("[data-import-box] textarea")?.focus?.()); return; }
    if (id === "picks") { pressOpeningsTab("deck"); }
    else { setBoardTab?.(id); pressOpeningsTab("index"); }
    requestAnimationFrame(() => document.getElementById("openings")?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
    navigate("/app/jobs", { replace: true });
  };
  const limit = Number(slots?.limit), remaining = Number(slots?.remaining);
  const chip = Number.isFinite(limit) && limit > 0 && Number.isFinite(remaining) ? {
    kind: "drafts", used: Math.max(0, limit - remaining), of: Math.min(limit, 10), href: "/app/auto-apply",
    label: `New drafts in the last 24 hours: ${Math.max(0, limit - remaining)} of ${limit} used, ${Math.max(0, remaining)} left. Re-runs are free`,
    onGo: (href) => navigate(href) } : null;
  return <ShellAreaNav area="The market" views={views} current={current} onGo={onGo} chip={chip}
    more={[{ id: "import", label: "Import a job", href: "/app/jobs#import", icon: "imported", phone: true }]}
    placeholder="Company, role, tech…" onHome={onHome} />;
}
// ⭐ D197 Wave 2 #13 (47m) · INTERVIEW'S AREA NAV — the Proving ground's four views (Coming up · Prepare · Practise · After);
// an old panel address lights the view that holds it (pages/interview/interviewModel.js INTERVIEW_HOMES).
function InterviewAreaNav({ onHome }) {
  const location = useLocation();
  const panel = interviewPanelFor(location.pathname.replace(/^\/app\/?/, ""), location.hash) || "upcoming";
  const nav = useInterviewAreaNav(panel);
  return <ShellAreaNav area={nav.area} views={nav.views} current={nav.current} placeholder={nav.placeholder} onGo={nav.onGo} onHome={onHome} />;
}
// ⭐ D197 Wave 2 #9 (47m, lane person) · YOUR PASSPORT'S AREA NAV (the Passport board): Your passport · Saved answers ·
// Auto-apply · Connections, More = Appearance · Notifications · Privacy and your data · Account (+ Your plan, lever on),
// "Search your passport…", the stamps chip (the page tells it the count — PASSPORT_STAMPS_EVENT; the last one is kept).
let passportStampsSeen = null;
function PassportAreaNav({ onHome }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const monetisationEnabled = useMonetisationEnabled();
  const [stamps, setStamps] = useState(passportStampsSeen);
  useEffect(() => {
    const on = (e) => { passportStampsSeen = Number(e.detail); setStamps(passportStampsSeen); };
    window.addEventListener(PASSPORT_STAMPS_EVENT, on);
    return () => window.removeEventListener(PASSPORT_STAMPS_EVENT, on);
  }, []);
  const more = passportMore({ plans: monetisationEnabled });
  const here = pathname.startsWith("/app/plans") ? "plans" : (profilePanelFor(pathname.replace(/^\/app\//, "")) || "about");
  const chip = Number.isFinite(stamps) ? { kind: "stamps", used: stamps, href: "/app/profile/about#pp-stamps", onGo: () => {
    navigate("/app/profile/about");
    requestAnimationFrame(() => document.getElementById("pp-stamps")?.scrollIntoView?.({ block: "start", behavior: "smooth" }));
  } } : null;
  return <ShellAreaNav area="Your passport" views={PASSPORT_VIEWS} current={here} more={more} chip={chip}
    placeholder="Search your passport…" onGo={(id, href) => navigate(href)} onHome={onHome} />;
}
// ⭐ D197 Wave 1 #5 (47h, lane atlas) · ATLAS'S AREA NAV (the Shell board's figure C): the VOL. I pill (its panel = the
// volumes and the eight regions), Your survey · Library · Today's question · League (with its switch), More (every other
// Atlas place), the search ("Make sense of…") and the run chip — pages/atlas/AtlasVolume.jsx useAtlasAreaNav.
function AtlasAreaNav({ onHome }) {
  const [compete, setCompete] = useState(null);
  useEffect(() => { let live = true; api("/api/atlas/compete").then((r) => live && setCompete(r)).catch(() => {}); return () => { live = false; }; }, []);
  const nav = useAtlasAreaNav({ base: "/app/atlas", signedIn: true, compete });
  return <ShellAreaNav area={nav.area} pill={nav.pill} views={nav.views} current={nav.current} more={nav.more} chip={nav.chip}
    placeholder={nav.placeholder} onGo={nav.onGo} onHome={onHome} />;
}
// the area's name for its nav's label (assistive tech) — the places the dock names, and the route-only pages (no dock
// entry, by design: D5 / D10): /app/job, /app/companies/<slug>, /app/job-profiles, /app/plans (lever on; reached from
// Profile → Account's View plans, 47j) and /app/recruiter (a job card's and the company view's deep links) — each draws
// this nav with its search, so each needs its name here (47j w1-shell checked: none is dead)
const AREA_NAMES = { "auto-apply" : "Home",   // (the id, spaced for the D6 guard)
  atlas: "Atlas", interview: "Interview", profile: "Profile", network: "Network", feed: "Feed",
  messages: "Messages", job: "Application", company: "Company", "job-profiles": "Job profiles", plans: "Plans", recruiter: "Recruiter" };

// ⭐ D196 P1 · THE MARKET'S HERO (plate switch on): the board's own facet counts, the résumé's placement as the sentence
// carries it (role_label, the level word when chosen), the ISO week. No best match yet — the deck holds it, and the hero
// draws no pin it can't back (MarketHero).
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400e3 + 1) / 7);
}
// ⭐ D199 C5 / D200 (47h): the political map's sectors are the facets answer's role options grouped by category (area = the
// openings each holds); tapping one sets the Role word to that category (the sentence and the chips follow), again lifts it.
function MarketHeroSlot() {
  const { boardHeadline } = useJobBoard();
  const params = boardHeadline?.params || {};
  const best = useBestCard();   // 47h: the deck's best undecided card (DeckView publishes it) — no deck, no pin
  const sectors = useMemo(() => sectorsFromRoleOptions(boardHeadline?.facets?.clauses?.role || []), [boardHeadline?.facets]);
  const picked = params.category && sectors.some((s) => s.id === params.category) ? params.category : null;
  const onPatch = boardHeadline?.onPatch;
  return (
    <MarketHero figures={marketFigures(boardHeadline?.facets)} week={isoWeek()} best={best} sectors={sectors} picked={picked}
      // you are marked in the sector the bearing names (the picked one); the page isn't told the résumé's own sector, so
      // with none picked there is no beacon and no route rather than a guessed one (R2)
      you={null}
      onPick={onPatch ? (id) => onPatch({ category: id || "", subcategory: "" }) : undefined}
      onBest={() => document.querySelector("[data-home-deck]")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      onBearing={() => { document.getElementById("bearing")?.scrollIntoView?.({ behavior: "smooth", block: "start" }); document.querySelector("#fh-sentence button")?.focus({ preventScroll: true }); }} />
  );
}

// ⭐ D196 P1 · section 01, the bearing: the board's leg header and lead over the cartouche (BoardHeadlineSlot picks it) and
// WordPanel beneath (⛔ 47j w1-market: a plate MarketPanel now — the `.fh` header around them is gone). The board's "How the board is ordered" aside is NOT drawn: it
// explains a skills-band order, and draft's deck is ranked by A133 (ATS · best bets · role similarity, with rotation).
// ⭐ D199 C1 (owner 11-25: "the 3rd can live in home and the 1st and 2nd can be merged") · THE MARKET'S ONE SECTION, *Your
// bearing and openings*: the bearing cartouche with its controls → Deck · Terrain · Index → the pager. Tickets out left the
// market (the ledger's Home carries them).
function MarketSectionSlot({ deck, index }) {
  return (
    <PlateRoot className="pl-marketbearing" data-plate-market-bearing="">
      <section className="pl-section" id="bearing" aria-labelledby="mk-bearing" data-market-section="">
        <LegHeader n={1} meta="YOUR BEARING AND OPENINGS · ONE SECTION" title={<span id="mk-bearing">Where you’re headed, and what’s there</span>}/>
        <p className="pl-lead">Set the bearing, search or filter; the counts and the openings follow. Pass, save or send any of them; Draft starts the application and it moves to your ledger.</p>
        <header className="pl-mk-head" data-market-head=""><BoardHeadlineSlot /></header>
        <MarketOpenings deck={deck} index={index} pager={<MarketPagerSlot />} />
      </section>
    </PlateRoot>
  );
}
// ⭐ D199 C3: the pager under the openings — the board's own page (JobsPanel publishes it); a move goes through its goPage.
function MarketPagerSlot() {
  const { boardPager } = useJobBoard();
  if (!boardPager) return null;
  return <MarketPager page={boardPager.page} totalPages={boardPager.totalPages} total={boardPager.total} pageSize={boardPager.pageSize}
    loading={boardPager.loading} onGo={boardPager.goTo} />;
}


function AppDashboard({ authUser, setAuthUser }) {
  const monetisationEnabled = useMonetisationEnabled();
  // With the lever off the tool is simply AVAILABLE — the tier is never consulted. This mirrors the
  // server, where requireToolEntitlement returns true before it looks at a plan, so the button the
  // client offers and the answer the server gives cannot disagree.
  const canUseAPlusResumeHere =
    !monetisationEnabled || String(authUser?.planTier || "BASIC").toUpperCase() === "PRO";
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobBoardRefreshKey, setJobBoardRefreshKey] = useState(0);
  // THE PILL IS RETIRED (Y4), so there is no longer a SURFACE to choose between — there is one
  // search bar and it renders on Jobs. hooks/useSearchSurface.js is deleted; what replaces it is
  // not another threshold but the absence of one.
  // The FIXED chrome's real height, measured off the bar itself (hooks/useChromeHeight.js). The
  // in-flow column reserves exactly this below, which is what stops content starting underneath it.
  const chromeHeight = useChromeHeight();
  const consolePath = `/app/${CONSOLE_ROUTE}`;
  const routeKey = location.pathname.replace(/^\/app\/?/, "") || "";
  // /app lands on TODAY (UI step 3d): the daily deck. The board keeps /app/jobs as "All jobs".
  // D102 P5 · /app/job/:applicationId — one application's page (JobWorkspacePanel), opened from Draft House and The Table.
  const jobRoute = /^job\/(\d+)$/.exec(routeKey) || /^job\/for\/(.+)$/.exec(routeKey);
  const jobByJobId = !!jobRoute && routeKey.startsWith("job/for/");
  // ⭐ D105 P4 · /app/atlas and /app/atlas/:slug — the Atlas inside the app (the public mount is /atlas).
  // ⭐ D116 M7: and /app/atlas/family/:key, a family's page.
  // ⭐ D172 (2): and /app/atlas/library/:course, a course page.
  const atlasRoute = /^atlas(?:\/(?:family|library|region|gazetteer|routes))?(?:\/[^/]+)?$/.test(routeKey);   // ⭐ D197 #6 (47h): + /atlas/region/<n> · ⭐ #8 (47m): + /atlas/gazetteer/<entry>, /atlas/routes/<id>
  // ⭐ D179 P4b · /app/companies/<slug> — a company's page inside the shell (the dock stays; Back returns).
  const companyRoute = /^companies\/([a-z0-9][a-z0-9-]*)$/.exec(routeKey);
  // ⭐ D199 C7 · /app/jobs/<id> — one opening as its sheet, drawn OVER the market: the market stays mounted (activeTab "console")
  // underneath, so Back returns to the same card, page and scroll.
  const openingRoute = OPENING_ROUTE.exec(routeKey);
  // ⭐ D167 · /app/profile/<panel> and /app/interview/<panel> (pages/profile/profilePanels.js, pages/interview/interviewModel.js);
  // the bare /app/profile and /app/interview read a #<panel> hash. undefined = not that place; null = an unknown panel.
  const profilePanel = profilePanelFor(routeKey, location.hash);
  const interviewPanel = interviewPanelFor(routeKey, location.hash);
  const activeTab = jobRoute ? "job" : companyRoute ? "company" : atlasRoute ? "atlas"
    : profilePanel !== undefined ? "profile" : interviewPanel !== undefined ? "interview"
    : openingRoute || routeKey === CONSOLE_ROUTE || LEGACY_CONSOLE_ROUTES.has(routeKey)
    ? "console" : routeKey === "" ? "today" : routeKey;
  // D10 (10-03): the card-game family — DAILY DECK, FULL HOUSE, DRAFT, THE TABLE. Display strings
  // only: the ids and the /app/<id> routes are internal and stay (docs/BRAND.md). TopBar sets a two-word
  // label on two lines, so the bar's height fits the mark's.
  const appTabs = [
    // Today's draft — the deck, dealt from the top of the fit-ranked board (UI_REDESIGN §3).
    // ⭐ D152 (1) / (4): ONE entry, Home — the deck and every job on one screen (/app; /app/jobs is the same screen).
    { id: "today",        label: "Home" },
    // The auto-apply pipeline is a peer of the board now, not a strip above it (W5). It sits in
    // this row for the same reason the others do — it is a place you go, not a thing that happens
    // on the board. AppTopBar decorates it with the needs-attention count.
    // D18 (amends D6/D10): displayed as DRAFT HOUSE — it rhymes with Full House beside it — and with
    // NO mark: the /d is the card's Draft button, not a tab. The id and the /app/auto-apply route
    // are internal and stay — renaming them is cost without benefit (docs/BRAND.md).
    // ⭐ D146 (owner 11-03): Draft House and The Table are ONE application tracker, so ONE entry — "Draft House · your
    // applications" (the name is the owner's to confirm; alternatives The Table, Applications). /app/database redirects
    // here (below), its ?sheet= deep links included.
    { id: "auto-apply",   label: "Home" },
    // D10: no "Job Profiles" tab. The PAGE stays (ROUTE_ONLY_TABS below), reached from the avatar
    // menu ("Manage Job Profiles", and the profile switcher's add / manage), Profile's "Open Job
    // Profiles", and the Daily Deck's set-up state ("Add your résumé →").
    // ⭐ D105 P4: D102's navigation gains one place — the Atlas, a dictionary of roles, skills, tools and stacks.
    // One word, so TabLabel sets it on one line. /app/atlas renders the same page the public /atlas does.
    { id: "atlas",        label: "Atlas" },
    // D5: no "Recruiter" tab. FE-6 built the surface, but there is no recruiter role, signup or
    // front door, so a candidate-side tab advertised a product that does not exist. The panel and
    // its route stay (ROUTE_ONLY_TABS below) for the two in-app deep links and R2–R6.
  ];

  // ⭐ D152 (1) · HOME: the Daily Deck and Full House are ONE screen — /app and /app/jobs both draw it (home-sketch.html):
  // the deck on the left, the sentence, search, counts and every job on the right. Home draws the board's header inside
  // its own right column. ⭐ A125: the old full-width Y4 header wrapper above <main> (hooks/useCollapsibleHeight.js),
  // which could never open once both routes were Home, is deleted with its hook.
  const home = activeTab === "today" || activeTab === "console";

  // The console is handled by its own branch above (it has a legacy-route alias and a refresh key),
  // so it is excluded here. The three extras are reachable from the profile menu rather than the
  // tab row, and have always been navigable.
  // "plans" is in this set only when the lever is on. It is the set BOTH handlePanelChange and the
  // route guard read, so dropping it here makes /app/plans bounce to the board the same way any
  // other non-tab path does — the panel is absent, not an empty panel that renders nothing.
  // Panels with a route and no tab: reachable by link, never advertised in the bar (D5).
  const ROUTE_ONLY_TABS = ["recruiter", "job-profiles"];
  const NAVIGABLE_TABS = useMemo(
    () => new Set([...appTabs.map(t => t.id).filter(id => id !== "console"),
                   ...(monetisationEnabled ? ["plans"] : []), "profile", "integrations", "account",
                   // D55 (f): Settings → Saved answers, reached from the Settings group of the menu.
                   "saved-answers",
                   // ⭐ D93: Customise — theme, shape cues and the layout options, from the avatar menu.
                   "customise",
                   // ⭐ D180 P1 (45o): Network — the page says "not available yet" while the switch is off.
                   "network",
                   // ⭐ 46f (owner 11-11): Feed and Messages, each its own page (the same switch; "not available yet" while off).
                   "feed", "messages",
                   ...ROUTE_ONLY_TABS]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monetisationEnabled],
  );

  // ⛔ A138 (45h): ONE sign-out, however many callers. A session that expires under a page with N requests in flight gets
  // N 401s; api.js fires "rm:session-expired" for each, and each used to POST /api/auth/logout — 20 in 25 ms on
  // production (11-06 21:26:28Z). Callers within the same moment share the one in flight; it re-arms 2 s after it ends.
  const logoutInFlight = useRef(null);
  const handleLogout = useCallback(() => {
    if (logoutInFlight.current) return logoutInFlight.current;
    logoutInFlight.current = (async () => {
      try { await api("/api/auth/logout", { method:"POST" }); } catch {}
      clearAskDraftSession();   // D190: Ask draft's conversation leaves with the session
      setAuthContext("");
      setAuthUser(null);
    })().finally(() => { setTimeout(() => { logoutInFlight.current = null; }, 2000); });
    return logoutInFlight.current;
  }, [setAuthUser]);

  // AH2: the ONE tab -> path mapping, read by both the click handler below and by the href the tab
  // row now renders. It has to be one function: a nav that navigates somewhere its own href does
  // not point is a nav where left-click and middle-click disagree, which is worse than no href.
  const pathForTab = useCallback((tab) => {
    if (tab === "jobs" || tab === "console") return consolePath;
    // ⭐ D167: the old settings pages are Profile's panels now — their tabs point straight at the panel.
    if (LEGACY_PROFILE_ROUTES[tab]) return profilePath(LEGACY_PROFILE_ROUTES[tab]);
    if (tab === "interview") return interviewPath();
    return NAVIGABLE_TABS.has(tab) ? `/app/${tab}` : null;
  }, [consolePath, NAVIGABLE_TABS]);

  const handlePanelChange = useCallback((tab) => {
    if (tab === "jobs" || tab === "console") {
      if (activeTab !== "console") setJobBoardRefreshKey(k => k + 1);
      transitionTo(navigate, consolePath);
      return;
    }
    // Derived from the tab row plus the routes reachable only from elsewhere (the profile menu,
    // billing), rather than a hand-written list. It WAS a hand-written list, and adding "Auto Apply"
    // to appTabs was not enough: the tab rendered, was clickable, and navigated nowhere, because
    // this array had never heard of it. A tab that silently does nothing is the same defect class as
    // a filter wired to a no-op — so the row itself is now the source of truth and a tab added
    // tomorrow routes without anyone remembering this line.
    if (LEGACY_PROFILE_ROUTES[tab] || tab === "interview") {
      transitionTo(navigate, pathForTab(tab));
      return;
    }
    if (NAVIGABLE_TABS.has(tab)) {
      // A view transition (queue 29): a job title on the page you leave and the page you reach is
      // one element moving, not two that cut. lib/viewTransitions.js says why it is not RR's prop.
      transitionTo(navigate, `/app/${tab}`);
    }
  }, [activeTab, consolePath, navigate, NAVIGABLE_TABS, pathForTab]);

  // ⭐ 47k: what every area's AreaErrorBoundary is given — the /app route resets a failed area; Go to Home is the area nav's Home.
  const areaGuard = { resetKey: routeKey, onHome: () => handlePanelChange("today") };

  // ⛔ 47j w1-shell: handleProfileActivate (the board's refresh after the account panel's job-profile switcher) left with
  // the panel — the switcher lives on Profile → Your profile and /app/job-profiles.
  useInactivityLogout(handleLogout, true);

  // The account's appearance — theme and shape cues (D91 P5) — follows the user between devices
  // (follow-up 18): read once per signed-in session; adoptAccountTheme reloads only if it changes what
  // is on screen.
  useEffect(() => {
    api("/api/settings/appearance").then(r => { if (r?.theme) adoptAccountTheme(r); }).catch(() => {});
  }, []);

  useSyncEvents({
    plan_updated: ({ planTier, applyMode }) => {
      setAuthUser(u => u ? ({ ...u, planTier, applyMode, allowedModes:[applyMode] }) : u);
      navigate(consolePath, { replace:true });
    },
  });

  useEffect(() => {
    // ⭐ 46q (A215, owner 11-16: one address per place): the board is /app/jobs — /app and /app/today land there, their
    // query and anchor kept (a ?job= deep link still opens its posting).
    if (!routeKey || routeKey === "today") {
      navigate({ pathname: consolePath, search: location.search || "", hash: location.hash || "" }, { replace:true });
      return;
    }
    if (LEGACY_CONSOLE_ROUTES.has(routeKey)) {
      navigate(consolePath, { replace:true });
      return;
    }
    // ⭐ D146: The Table merged into Draft House — /app/database lands on the one tracker, with its query (a ?sheet=
    // deep link — the board's Pending tag, the Gmail return, a notification — opens the full sheet there).
    if (routeKey === TABLE_ROUTE) {
      navigate({ pathname: "/app/auto-apply", search: location.search || "" }, { replace:true });
      return;
    }
    // ⭐ D167: every old settings page keeps a home — /app/customise, /app/saved-answers, /app/integrations and /app/account
    // land on the Profile panel that holds them, the query kept (an OAuth or Gmail return's ?oauthStatus= / ?gmail=).
    if (LEGACY_PROFILE_ROUTES[routeKey] && routeKey !== "profile") {
      navigate({ pathname: profilePath(LEGACY_PROFILE_ROUTES[routeKey]), search: location.search || "" }, { replace:true });
      return;
    }
    // An unknown panel lands on the place's first one.
    if (profilePanel === null) { navigate(profilePath(), { replace:true }); return; }
    if (interviewPanel === null) { navigate(interviewPath(), { replace:true }); return; }
    // The SAME set handlePanelChange navigates with, so a tab cannot be routable in one direction
    // and bounced in the other. This was the second hardcoded copy of the tab list, and adding
    // "Auto Apply" to appTabs was not enough for either of them: the tab rendered and did nothing
    // because handlePanelChange had never heard of it, and typing /app/auto-apply bounced straight
    // back to the board because THIS guard had not either. Two lists, both silent when wrong.
    // ⛔ 45s: + companyRoute — without it every /app/companies/<slug> (A157: a company's name, its logo, a search pick)
    // bounced straight to the board for a signed-in person, so the company page never opened inside the app.
    if (!jobRoute && !atlasRoute && !companyRoute && profilePanel === undefined && interviewPanel === undefined
        && !openingRoute && routeKey !== CONSOLE_ROUTE && !NAVIGABLE_TABS.has(routeKey)) {
      navigate(consolePath, { replace:true });
    }
  }, [routeKey, consolePath, navigate, NAVIGABLE_TABS, atlasRoute, companyRoute, location.search, profilePanel, interviewPanel]);

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const d = await api("/api/auth/me");
        if (!d.authenticated) handleLogout();
      } catch {}
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [handleLogout]);

  // Force-logout immediately when any API call gets a 401 (dispatched by api.js).
  useEffect(() => {
    const handle = () => handleLogout();
    window.addEventListener("rm:session-expired", handle);
    return () => window.removeEventListener("rm:session-expired", handle);
  }, [handleLogout]);

  // The scroll listener that used to drive hero <-> dock is gone: it read window.scrollY, which is
  // permanently 0 here, and it re-rendered this component on every scroll event — which is how a
  // trivial scroll reset the job board (see JobsPanel's boot-effect note and PlanConsoles' memo).

  // ⭐ D152 (1) · HOME — the deck and the board, as elements, placed by the plate market's section (D196 P1 · D199 C1).
  const homeDeck = (
    <section className="home__deck" aria-label="Today's picks" data-home-deck="">
      <DeckView canUseAPlusResume={canUseAPlusResumeHere} home/>
    </section>
  );
  const homeBoard = (
    <section className="home__board" aria-label="Every job" data-home-board="">
      <BoardViews onImported={() => setJobBoardRefreshKey(k => k + 1)} />
      {/* ⭐ D199 C4: the stats box (in the cartouche) replaces the counts strip */}
      <ExtensionFirstRunPrompt />
      <JobsConsole user={authUser} onUserChange={setAuthUser}
        refreshKey={jobBoardRefreshKey} isActive={home}/>
    </section>
  );

  return (
    <JobBoardProvider>
    {/* The apply pipeline's state sits ABOVE the board and above the tab switch, deliberately.
        Its loading and polling effects have to keep running while the user is on another tab —
        otherwise a run started from the board would stop reporting the moment you navigated to
        Auto Apply to watch it, which is the one place you would go to watch it. It is also what
        lets the tab carry a needs-attention count while the board is showing. */}
    <AutoApplyProvider
      user={authUser}
      canUseAPlusResume={canUseAPlusResumeHere}>
      <AppScrollProvider>
        {/* data-app-shell marks the element whose children are the app's own surfaces, so the panel
            host can make the BOARD inert while a panel is open without hunting for it by class or
            position. It does not need to know WHICH child is the board: useBoardLock inerts every
            child that renders BELOW the scrim and leaves alone every child at or above
            Z.MODAL_SCRIM.

            Y2 CHANGED WHICH SIDE OF THAT LINE THE TOP BAR IS ON. It used to paint at Z.NAV (1500),
            above the scrim, so it stayed undimmed and live over an open panel — and the note here
            defended that, on the grounds that a control which looks live but is inert is worse than
            one that works. The bar is now at Z.NAV (250), BELOW every overlay, so the scrim covers
            it and useBoardLock inerts it with everything else. That pairing is still coherent, in
            the other direction: dimmed AND inert. What the old arrangement actually produced was a
            bar that occluded the surfaces it was floating over. */}
        {/* paddingTop RESERVES THE FIXED CHROME'S HEIGHT for everything in flow below it. TopBar is
            position:fixed and so reserves nothing; before this, two unrelated things absorbed it by
            accident — the hero's 80px top padding on Jobs, and the search bar's own reserved box on
            the other tabs — and the second one got it wrong by 56px. Measured, not 46: see
            hooks/useChromeHeight.js.

            box-sizing is border-box globally (index.css), so the padding comes out of the 100vh
            rather than adding to it and the shell does not grow a scrollbar of its own. */}
        <div data-app-shell
             style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:ts(13),
                      minHeight:"100vh", display:"flex", flexDirection:"column",
                      paddingTop: chromeHeight,
                      color:theme.text }}>

          {/* The tab row moved INTO the bar (Y4). AppTopBar is the decorator that puts the
              needs-review count on the AUTO APPLY tab — it has to live inside AutoApplyProvider,
              which AppDashboard renders, so AppDashboard cannot read the count itself. Same reason
              BoardSearchBar is a wrapper. */}
          <AppTopBar
            user={authUser}
            tabs={appTabs}
            activeTab={home ? "today" : activeTab}
            onTabChange={handlePanelChange}
            hrefForTab={pathForTab}
            onLogout={handleLogout}
            onUserChange={setAuthUser}
          />

          {/* ⭐ D197 #1 · A237: the area nav across the top of the content column (the rail is AppNav's, at the left) */}
          <AppAreaNavSlot activeTab={home ? "today" : activeTab} onHome={() => handlePanelChange("today")} />
          {/* D149: the deck (like Full House) starts right under the mark — its card sits at the sketch's 90 px. */}
          {/* D149 (11-03): Draft House too — its own top padding puts its title at tracker-options.html's 84 px. */}
          <main style={{ flex:1, paddingTop: activeTab === "console" || activeTab === "today" || activeTab === "auto-apply" ? 0 : 24 }}>
            {/* ⭐ D152 (1) · HOME — one grid, laid out by CSS (FullHouse.css .home): the deck's column is sticky in its
                own track and the board's column takes the rest; on a phone one column, the deck first. No page titles. */}
            {/* ⭐ D196 P1: the deck and the board under the market's binder tabs. FIX-1 (owner 11-24): ONE plate root under
                the whole page — paper (in the person's theme's palette), full height. ⛔ 47j R2: the classic grid
                (`.home`) is deleted — the market is the plate market only (`?plate=0` no longer reaches it). */}
            {/* ⭐ 47k · EVERY AREA SITS IN ITS OWN AreaErrorBoundary (plate/AreaErrorBoundary.jsx): a throw or a missing chunk
                swaps only that area for the plate's drawer (Reload · Go to Home) — the dock and the area nav above stay live.
                areaGuard's resetKey is the /app route, so moving anywhere clears a failed area. Pinned by test/areaErrorBoundary47k.test.js. */}
            {home && <AreaErrorBoundary area="home" {...areaGuard}><PlateRoot className="pl-marketpage" data-plate-page="market"><MarketHeroSlot /><MarketSectionSlot deck={homeDeck} index={homeBoard} /></PlateRoot></AreaErrorBoundary>}
            {openingRoute && <AreaErrorBoundary area="opening" {...areaGuard}><OpeningSheet jobId={decodeURIComponent(openingRoute[1])}/></AreaErrorBoundary>}
            {/* ⭐ D49 · THE BOARD'S BAR STICKS (StickyBar, above in Home's board column): sticky only works inside its
                parent's box, so it sits in the column with the jobs, not in the header. D12's ExtensionFirstRunPrompt
                says where jobs from elsewhere come from until the extension is connected. */}
            {activeTab === "auto-apply"   && <AreaErrorBoundary area="auto-apply" {...areaGuard}><AutoApplyPanel user={authUser}/></AreaErrorBoundary>}
            {activeTab === "job" && jobRoute && <AreaErrorBoundary area="job" {...areaGuard}><JobWorkspacePanel {...(jobByJobId ? { jobId: decodeURIComponent(jobRoute[1]) } : { applicationId: jobRoute[1] })}/></AreaErrorBoundary>}
            {activeTab === "plans" && monetisationEnabled && <AreaErrorBoundary area="plans" {...areaGuard}><ProfilePage panel="plans" user={authUser} onUserChange={setAuthUser} onSignedOut={() => { setAuthContext(""); setAuthUser(null); }}/></AreaErrorBoundary>}
            {/* ⭐ D167 · Profile (its own navigation, nine panels) and Interview (Coming up · Prepare · Practise · After). */}
            {activeTab === "profile" && profilePanel && <AreaErrorBoundary area="profile" {...areaGuard}><ProfilePage panel={profilePanel} user={authUser} onSignedOut={() => { setAuthContext(""); setAuthUser(null); }}/></AreaErrorBoundary>}
            {activeTab === "interview" && interviewPanel && <AreaErrorBoundary area="interview" {...areaGuard}><ProvingGround panel={interviewPanel}/></AreaErrorBoundary>}
            {activeTab === "job-profiles" && <AreaErrorBoundary area="job-profiles" {...areaGuard}><JobProfilesPanel/></AreaErrorBoundary>}
            {activeTab === "recruiter"    && <AreaErrorBoundary area="recruiter" {...areaGuard}><RecruiterPanel/></AreaErrorBoundary>}
            {activeTab === "atlas"        && <AreaErrorBoundary area="atlas" {...areaGuard}><AtlasPage base="/app/atlas"/></AreaErrorBoundary>}
            {activeTab === "company" && companyRoute && <AreaErrorBoundary area="company" {...areaGuard}><CompanyPage slug={companyRoute[1]} base="/app/companies" inApp/></AreaErrorBoundary>}
            {activeTab === "network" && <AreaErrorBoundary area="network" {...areaGuard}><NetworkPage/></AreaErrorBoundary>}
            {activeTab === "feed" && <AreaErrorBoundary area="feed" {...areaGuard}><FeedPage/></AreaErrorBoundary>}
            {activeTab === "messages" && <AreaErrorBoundary area="messages" {...areaGuard}><MessagesPage/></AreaErrorBoundary>}
          </main>

          {/* JobDetailPanel moved into JobsPanel, which is where the PDF and ATS panels live and
              where the shared panel host runs — three peers cannot tile side by side from two
              different parents. One visible consequence, stated rather than hidden: switching tabs
              from the TopBar (which used to sit above the scrim at Z.NAV; since Y2 it sits below,
              and is inert while a panel is open) hides the drawer with the
              board it belongs to instead of leaving it floating over the Database panel. The
              selection itself lives in JobBoardContext, above the tab switch, so returning to Jobs
              restores the same open drawer. */}

        </div>

        {/* TOASTS. Mounted here, OUTSIDE [data-app-shell], and that placement is the point.
            useBoardLock inerts the shell's children while a panel or the filters drawer is open; a
            toast reporting the result of an action taken INSIDE that panel must not be inerted along
            with the board behind it — a toast with an inert action button is worse than no toast.
            Being a sibling of the shell rather than a child keeps it out of that loop entirely, the
            same reason PanelScrim, PanelDock and now the filters drawer are portalled to body.

            This is the first mount. `toast()` and `useToast()` have existed all along and nothing
            called them, and nothing rendered <Toaster/>, so its z-[100] — below the top bar — was
            never observable. It reads Z.TOAST now (client/src/styles/zLayers.js). */}
        <Toaster />
        {/* ⭐ D157 option A: the embedded résumé editor's full-screen view, opened from anywhere (lib/resumeEditor.js). */}
        <ResumeEditorHost />
      </AppScrollProvider>
    </AutoApplyProvider>
    </JobBoardProvider>
  );
}

/** ⭐ D167: /profile… and /interview… are in-app places — forwarded under /app, the query and the #panel kept (the app's
 *  own gate signs a signed-out reader in first). */
/** ⭐ D157 (i) (45n) · /draft/resume/<job> — the editor's own address: the jobs page with that résumé open (signed in). */
function EditorAddress({ signedIn }) {
  const { jobId } = useParams();
  if (!signedIn) return <Navigate to="/" replace/>;
  try { sessionStorage.setItem(REOPEN_KEY, jobId); } catch { /* the jobs page opens without it */ }
  return <Navigate to="/app/jobs" replace/>;
}

function ToApp() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/app${pathname}${search}${hash}`} replace/>;
}

/** D105 P4: a signed-in person opening a public /atlas link lands on the same page inside the app. */
/** D179 P3 · a server-rendered page (/jobs/<slug>) reached by the client router: load it from the server, once. */
function FromServer() {
  const { pathname, search } = useLocation();
  useEffect(() => { window.location.replace(`${pathname}${search}`); }, [pathname, search]);
  return null;
}

/** D179 P4b · /companies/:slug signed out — the company page under the marketing nav. */
function PublicCompanyRoute() {
  const { slug } = useParams();
  const { search } = useLocation();
  const s = String(slug || "").toLowerCase();
  // ⭐ A157: the company's own address is /<company>; /companies/<slug> stays only for a reserved word.
  if (s && !isReservedPath(s)) return <Navigate to={`/${s}${search}`} replace/>;
  return <CompanyPage slug={s} base="/companies"/>;
}

/** A157 · /<company> — the company page under the marketing nav; a reserved word or a bad slug is the 404 page. */
function PublicCompanyAtRoot({ navBar }) {
  const { companySlug: s } = useParams();
  const slug = String(s || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug) || isReservedPath(slug)) return <>{navBar}<NotFoundPage/></>;
  return <>{navBar}<CompanyPage slug={slug} base=""/></>;
}
/** A157 · /<company> signed in — the same page inside the shell (the dock stays). */
function CompanyInApp() {
  const { companySlug: s } = useParams();
  const { search } = useLocation();
  const slug = String(s || "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug) || isReservedPath(slug)) return <Navigate to="/app" replace/>;
  return <Navigate to={`/app/companies/${slug}${search}`} replace/>;
}
/** A157 · /<company>/<id> — a posting under its company: the server renders it (a full load); anything else is a 404. */
function CompanyJobRoute({ navBar }) {
  const { jobId } = useParams();
  if (!/^\d{1,12}$/.test(String(jobId || ""))) return <>{navBar}<NotFoundPage/></>;
  return <FromServer/>;
}

// A public address a signed-in reader reads inside the app: the same path under /app, its query kept — /atlas/… and
// /companies/<slug>. (⛔ 47j w1-shell: was AtlasInApp, a name that was wrong for the company route that also uses it.)
function SamePageInApp() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/app${pathname}${search}`} replace/>;
}

/**
 * A dead path from the published extension, forwarded to the page that actually exists.
 *
 * Its own component rather than an inline `<Navigate>` for one reason: the query string has to
 * survive. `?jd=` carries the job text the extension extracted from the page, and reading it needs
 * a hook — putting `useLocation()` in AppRouter instead would re-render the whole router on every
 * navigation to carry a value only these two routes use.
 */
function LegacyToolRedirect({ to }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace/>;
}

function AppRouter() {
  const { theme } = useTheme();
  const [authUser,    setAuthUser]    = useState(null);
  const [authStatus,  setAuthStatus]  = useState("unknown");
  // ⛔ A148 (45p): when the signed-in person changes (every sign-out path ends in setAuthUser(null); a sign-in as someone
  // else), this browser forgets the last person — picture, stored keys, session store — and the other tabs follow.
  const personRef = useRef(undefined);
  useEffect(() => {
    if (authStatus === "unknown") return;
    const id = authUser?.id ?? null;
    notePerson(personRef.current, id);
    personRef.current = id;
  }, [authUser?.id, authStatus]);
  useEffect(() => onPersonChangedElsewhere((id) => {
    if (String(personRef.current ?? "") !== String(id ?? "")) window.location.reload();
  }), []);
  // ⛔ D95: the admin's own session, separate from the person's — never the same state, never the same cookie.
  const [adminSession, setAdminSession] = useState(null);
  const loadAdminSession = useCallback(() => {
    api("/api/admin/auth/me").then(setAdminSession).catch(() => setAdminSession({ authenticated: false, enforced: false, legacyAvailable: true }));
  }, []);
  useEffect(() => { loadAdminSession(); }, [loadAdminSession]);

  const handleAdminLogout = useCallback(async () => {
    if (adminSession?.authenticated) {
      try { await api("/api/admin/auth/logout", { method:"POST" }); } catch {}
      setAdminSession(s => ({ ...(s || {}), authenticated: false, admin: null }));
      return;
    }
    try { await api("/api/auth/logout", { method:"POST" }); } catch {}
    setAuthContext("");
    setAuthUser(null);
    setAuthStatus("unauthenticated");
  }, [adminSession]);
  const adminDisplay = adminSession?.authenticated ? { username: adminSession.admin?.email, kind: "admin" } : authUser;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthAuthContext = params.get("authContext");
    if (oauthAuthContext) {
      setAuthContext(oauthAuthContext);
      params.delete("authContext");
      const nextSearch = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`);
    }
    api("/api/auth/me")
      .then(d => {
        if (d.authenticated && d.user) {
          setAuthUser(d.user);
          setAuthStatus("authenticated");
          return;
        }
        setAuthUser(null);
        setAuthStatus("unauthenticated");
      })
      .catch(() => {})
      .finally(() => setAuthStatus(prev => prev === "unknown" ? "unauthenticated" : prev));
  }, []);

  const handlePublicLogout = useCallback(async () => {
    try { await api("/api/auth/logout", { method:"POST" }); } catch {}
    setAuthContext("");
    setAuthUser(null);
    setAuthStatus("unauthenticated");
  }, []);

  // The lever. Read once here and passed down, rather than re-read in each route element, so the
  // route table and the nav cannot disagree about whether /pricing exists. ABOVE the loading return:
  // a hook after an early return changes the hook order between renders (React warned on every load).
  const monetisationEnabled = useMonetisationEnabled();

  if (authStatus === "unknown") return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  background:theme.bg, gap:14 }}>
      <div style={{ width:32, height:32,
                    border:`3px solid ${theme.border}`,
                    borderTop:`3px solid ${theme.accent}`,
                    borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <span style={{ color:theme.textMuted, fontSize:ts(13) }}>Loading…</span>
    </div>
  );

  // NavBar helper — renders the shared public nav with current auth state
  const navBar = (
    <NavBar user={authUser} onLogout={handlePublicLogout}
      onLogin={(user) => { setAuthUser(user); setAuthStatus("authenticated"); }}/>
  );

  return (
    <AppShell>
      {/* D91 P5: when the system asks for more contrast, a one-line OFFER of the Contrast pair — never a switch. */}
      <ContrastOffer />
      <Routes>
        {/* Standalone tool pages — always public */}
        <Route path="/tools/ats"      element={<ATSToolPage/>}/>
        <Route path="/tools/generate" element={<GenerateToolPage/>}/>
        <Route path="/tools/apply"    element={<ApplyToolPage/>}/>
        {/* ⭐ D141: the free résumé honesty check — no account, nothing kept. */}
        <Route path="/tools/honesty"  element={<HonestyToolPage/>}/>

        {/* ── LEGACY ALIASES FOR THE PUBLISHED EXTENSION ──────────────────────────────────────
            The extension shipped as v1.0.0 opens `/resume` and `/ats-score?jd=…`. NEITHER HAS
            EVER BEEN A ROUTE, so both fell through to the catch-all below — and for a signed-in
            admin that catch-all redirects to /admin. That is the entire "the resume builder
            opened an admin session" report: not a session bug, a dead link landing on a 404
            handler that promotes admins. See docs/EXTENSION_DIAGNOSIS.md §4.

            ⛔ THESE FIX THE INSTALLED BUILD, AND THAT IS WHY THEY EXIST. The extension is frozen
            for P4 (Web Store review), so correcting its URLs only helps after a store update that
            has not happened. An alias here works for every copy already installed, today. Keep
            them until telemetry says no build is opening the old paths — which, for an extension
            users are never forced to update, is effectively forever.

            `replace` so the dead path does not sit in history behind the user's back button, and
            the SEARCH STRING IS CARRIED: `?jd=` is the job text the popup extracted, and dropping
            it is the second half of the same defect (ATSToolPage reads it now). */}
        <Route path="/resume"    element={<LegacyToolRedirect to="/tools/generate"/>}/>
        <Route path="/ats-score" element={<LegacyToolRedirect to="/tools/ats"/>}/>

        {/* Marketing pages — always public */}
        <Route path="/features"     element={<FeaturesPage/>}/>
        <Route path="/how-it-works" element={<HowItWorksPage/>}/>
        {/* D12: the extension is the import path since D11 — this page explains and installs it. */}
        <Route path="/extension"    element={<ExtensionPage/>}/>
        {/* OFF MEANS ABSENT. Not a disabled page, not a "pricing coming soon" placeholder — with
            the lever off the URL is simply not part of this product, and answers exactly as any
            other unknown path does. */}
        <Route path="/pricing"      element={monetisationEnabled ? <PricingPage/> : <>{navBar}<NotFoundPage/></>}/>
        <Route path="/about"        element={<AboutPage/>}/>
        <Route path="/contact"      element={<ContactPage/>}/>
        <Route path="/faq"          element={<FAQPage/>}/>
        <Route path="/privacy"      element={<PrivacyPage/>}/>
        {/* D130: the standalone survey — public, no sign-in, no account, straight to the form. */}
        <Route path="/survey"       element={<SurveyPublicPage/>}/>
        <Route path="/terms"        element={<TermsPage/>}/>
        <Route path="/docs/claude"  element={<ConnectorDocsPage/>}/>
        {/* ⭐ D105 P4 · THE ATLAS — PUBLIC, no sign-in (d105PublicNoAuth): anyone, and search engines, read published
            pages. A signed-in person is taken to the same page inside the app (/app/atlas…), under the top bar. */}
        <Route path="/atlas/*" element={
          authStatus === "authenticated" && authUser && !authUser.isAdmin
            ? <SamePageInApp/>
            : <AtlasPage base="/atlas" publicChrome/>
        }/>

        {/* ⭐ D179 P3 · THE OPEN BOARD — /jobs for everyone; a signed-in reader is sent to their own board. A posting's own
            page (/jobs/<slug>, D128) is SERVER-rendered: reached inside the app (a return after sign-up), it is reloaded
            from the server rather than drawn as "not found". */}
        <Route path="/jobs" element={
          authStatus === "authenticated" && authUser && !authUser.isAdmin
            ? <Navigate to="/app/jobs" replace/>
            : <>{navBar}<PublicBoardPage/></>
        }/>
        <Route path="/jobs/:slug" element={<FromServer/>}/>
        {/* ⭐ D150 T05–T08 · the 3-minute audit — public; a signed-in reader keeps the result at once. */}
        <Route path="/audit" element={<>{navBar}<AuditPage signedIn={authStatus === "authenticated" && !!authUser && !authUser.isAdmin}/></>}/>

        {/* ⭐ D179 P4b · a page for every company — PUBLIC (no sign-in); a signed-in reader gets it inside the app. */}
        <Route path="/companies/:slug" element={
          authStatus === "authenticated" && authUser && !authUser.isAdmin
            ? <SamePageInApp/>
            : <>{navBar}<PublicCompanyRoute/></>
        }/>
        {/* ⭐ A157 (45q, owner 11-09) · a company's OWN address, /<company>, and its postings under it, /<company>/<id> (the
            server renders the posting). Every route of draft's own above wins; a reserved word is never a company. */}
        <Route path="/:companySlug" element={
          authStatus === "authenticated" && authUser && !authUser.isAdmin
            ? <CompanyInApp/>
            : <PublicCompanyAtRoot navBar={navBar}/>
        }/>
        <Route path="/:companySlug/:jobId" element={<CompanyJobRoute navBar={navBar}/>}/>

        {/* ⭐ D167 · /profile/<panel> and /interview/<panel> without /app — the in-app place, for a signed-in reader. */}
        <Route path="/profile/*" element={<ToApp/>}/>
        <Route path="/draft/resume/:jobId" element={<EditorAddress signedIn={authStatus === "authenticated" && !!authUser && !authUser.isAdmin}/>}/>
        <Route path="/interview/*" element={<ToApp/>}/>

        {/* New public pages with NavBar */}
        <Route path="/products" element={<>{navBar}<ProductsPage/></>}/>
        {/* 11-07: the D124 trial is removed — /try (its old link) goes to the front door (server.js redirects it too). */}
        <Route path="/try" element={<Navigate to="/" replace/>}/>
        <Route path="/blog"     element={<>{navBar}<BlogPage/></>}/>

        {/* Admin login — redirect if already authenticated */}
        <Route path="/admin/login" element={
          <PublicLoginRoute authStatus={authStatus} authUser={authUser} admin adminSession={adminSession}>
            <AdminLoginPage session={adminSession}
              onAdminLogin={(admin) => setAdminSession(s => ({ ...(s || {}), authenticated: true, admin }))}
              onLegacyLogin={(user) => {
                setAuthUser(user);
                setAuthStatus("authenticated");
              }}/>
          </PublicLoginRoute>
        }/>
        {/* ⛔ D95: the one-time link sets the admin's password and signs the ADMIN in (not a person). */}
        <Route path="/admin/set-password" element={
          <AdminSetPasswordPage onAdminLogin={(admin) => { setAdminSession(s => ({ ...(s || {}), authenticated: true, admin })); window.location.replace("/admin"); }}/>
        }/>

        {/* Admin dashboard — requires auth + isAdmin */}
        <Route path="/admin" element={
          <AdminRouteGate authStatus={authStatus} authUser={authUser} adminSession={adminSession}>
            <AdminLayout user={adminDisplay} onLogout={handleAdminLogout}/>
          </AdminRouteGate>
        }/>

        {/* Admin DB Inspector */}
        <Route path="/admin/db" element={
          <AdminRouteGate authStatus={authStatus} authUser={authUser} adminSession={adminSession}>
            <AdminLayout user={adminDisplay} onLogout={handleAdminLogout}><DBInspector/></AdminLayout>
          </AdminRouteGate>
        }/>

        {/* ⭐ D196 F4 · the plate gallery — every plate component in every state, beside its sketch (Admin only) */}
        <Route path="/dev/plate" element={
          <AdminRouteGate authStatus={authStatus} authUser={authUser} adminSession={adminSession}>
            <AreaErrorBoundary area="plate-gallery" resetKey="dev/plate"><Suspense fallback={null}><PlateGallery/></Suspense></AreaErrorBoundary>
          </AdminRouteGate>
        }/>

        {/* User login — redirect to /app if logged in as user, /admin if admin */}
        <Route path="/login" element={
          <PublicLoginRoute authStatus={authStatus} authUser={authUser}>
            <AuthScreen onLogin={(user) => {
              setAuthUser(user);
              setAuthStatus("authenticated");
            }}/>
          </PublicLoginRoute>
        }/>

        {/* Register — same screen as login, opens register tab */}
        <Route path="/register" element={
          <PublicLoginRoute authStatus={authStatus} authUser={authUser}>
            <AuthScreen initialTab="register" onLogin={(user) => {
              setAuthUser(user);
              setAuthStatus("authenticated");
            }}/>
          </PublicLoginRoute>
        }/>

        {/* User app — redirect admin to /admin */}
        <Route path="/app/*" element={
          <UserRouteGate authStatus={authStatus} authUser={authUser}>
            <AppDashboard authUser={authUser} setAuthUser={setAuthUser}/>
          </UserRouteGate>
        }/>

        {/* Root: landing page for logged-out, redirect for logged-in */}
        <Route path="/" element={
          authStatus === "unknown" ? null
          : authStatus === "authenticated" && authUser
            ? (authUser.isAdmin ? <Navigate to="/admin" replace/> : <Navigate to="/app" replace/>)
            : <>{navBar}<LandingPage authUser={null}/></>
        }/>

        {/* 404 — authenticated users redirect, logged-out users see NotFoundPage */}
        <Route path="*" element={
          authStatus === "authenticated" && authUser
            ? (authUser.isAdmin ? <Navigate to="/admin" replace/> : <Navigate to="/app" replace/>)
            : <>{navBar}<NotFoundPage/></>
        }/>
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteCommitSignal/>
      {/* Outside AppRouter so the marketing routes, which render logged out, are inside it too. */}
      <MonetisationProvider>
        <AppRouter/>
      </MonetisationProvider>
    </BrowserRouter>
  );
}

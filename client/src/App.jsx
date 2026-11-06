// REVAMP v1 — App.jsx
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, setAuthContext }   from "./lib/api.js";
import { adoptAccountTheme }     from "./styles/colorTokens.js";
import { ContrastOffer }         from "./components/AppearanceSettings.jsx";
import { useTheme }              from "./styles/theme.jsx";
import { useInactivityLogout }   from "./hooks/useInactivityLogout.js";
import { useSyncEvents }         from "./hooks/useSyncEvents.js";
import AuthScreen                from "./components/AuthScreen.jsx";
import AdminLayout               from "./components/AdminLayout.jsx";
import AdminLoginPage, { AdminSetPasswordPage } from "./pages/AdminLoginPage.jsx";
import DBInspector               from "./pages/admin/DBInspector.jsx";
import TopBar                     from "./components/TopBar.jsx";
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
import { profilePanelFor, profilePath, LEGACY_PROFILE_ROUTES } from "./pages/profile/profilePanels.js";
import InterviewPage             from "./pages/interview/InterviewPage.jsx";
import { interviewPanelFor, interviewPath } from "./pages/interview/interviewModel.js";
import { PlansPanel }            from "./panels/PlansPanel.jsx";
import DeckView                  from "./panels/DeckView.jsx";
import { routeCommitted, transitionTo } from "./lib/viewTransitions.js";
import { RecruiterPanel }        from "./panels/RecruiterPanel.jsx";
import { JobsConsole }            from "./consoles/PlanConsoles.jsx";
import BoardHeadline             from "./components/BoardHeadline.jsx";
import WordPanel                 from "./components/WordPanel.jsx";
import SortPanel                 from "./components/SortPanel.jsx";
import { ViewSegment, BoardSearch, SortIcon, ImportJobBox } from "./components/BoardBar.jsx";
import StickyBar from "./components/StickyBar.jsx";
import { nextBoardPanel, sortRows, isSortChosen, DEFAULT_SORT, BOARD_PANEL, viewCounts, boardCounts } from "./lib/filterSentenceModel.js";
import { ATSToolPage }           from "./pages/tools/ATSToolPage.jsx";
import { GenerateToolPage }      from "./pages/tools/GenerateToolPage.jsx";
import { ApplyToolPage }         from "./pages/tools/ApplyToolPage.jsx";
import { HonestyToolPage }       from "./pages/tools/HonestyToolPage.jsx";

import LandingPage    from "./pages/LandingPage.jsx";
import NavBar         from "./components/NavBar.jsx";
import ProductsPage   from "./pages/ProductsPage.jsx";
import BlogPage       from "./pages/BlogPage.jsx";
import NotFoundPage   from "./pages/NotFoundPage.jsx";
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
import { Toaster }         from "./components/ui/toaster.jsx";
import TryPage, { hasTrialIntent } from "./pages/TryPage.jsx";
import SurveyPublicPage from "./pages/SurveyPublicPage.jsx";
import TrialGate       from "./components/TrialDock.jsx";
import { oauthNext }       from "./lib/oauthNext.js";

const CONSOLE_ROUTE = "jobs";
const LEGACY_CONSOLE_ROUTES = new Set(["simple-apply", "tailored", "custom-sampler"]);
// ⭐ D146: The Table's old route — it redirects to Draft House, the one application tracker.
const TABLE_ROUTE = "database";

function AuthBootstrapScreen({ theme }) {
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  background:theme.bg, gap:14 }}>
      <div style={{ width:32, height:32,
                    border:`3px solid ${theme.border}`,
                    borderTop:`3px solid ${theme.accent}`,
                    borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <span style={{ color:theme.textMuted, fontSize:13 }}>Loading…</span>
    </div>
  );
}

function UserRouteGate({ authStatus, authUser, children }) {
  if (authStatus === "unknown") return null;
  if (authStatus !== "authenticated" || !authUser) return <Navigate to="/login" replace/>;
  if (authUser.isAdmin) return <Navigate to="/admin" replace/>;
  // ⭐ D124: signed up (or in, with Google) from /try — back to /try to start the trial and pick a résumé.
  if (hasTrialIntent()) return <Navigate to="/try" replace/>;
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
    // ⭐ D124: signed in from /try — back there to start the trial and pick a résumé.
    if (!authUser.isAdmin && hasTrialIntent()) return <Navigate to="/try" replace/>;
    return authUser.isAdmin ? <><SignedInElsewhere user={authUser}/>{children}</> : <Navigate to="/app" replace/>;
  }
  return children;
}

/** Sessions A′: "this browser is signed in as … in another tab" — above the other kind of sign-in form. */
export function SignedInElsewhere({ user, admin = false }) {
  return (
    <div role="status" data-signed-in-elsewhere="" style={{ position: "relative", zIndex: 5, boxSizing: "border-box",
      width: "min(560px, calc(100% - 32px))", margin: "12px auto 0", padding: "10px 14px", borderRadius: 6, fontSize: 13, lineHeight: 1.5,
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
  const { applyBarFilters } = useJobBoard();
  return (
    <BoardSearch
      {...props}
      onSubmit={params => applyBarFilters(params, { fields: ["query"] })}
    />
  );
}

// D26/D30/D35: THE SENTENCE IS THE HEADLINE, AND ITS WORDS ARE THE CONTROLS. JobsPanel publishes what
// it projects (the committed clause params, the facets answer, the patch it applies); a word's press
// goes through nextBoardPanel on the board's ONE panel value, so the same word closes what it opened
// and opening another closes the first. The panel renders HERE, directly beneath the sentence and
// above the bar — D35 §4's order: the sentence, the open panel, the bar, the jobs.
function BoardHeadlineSlot() {
  const { boardHeadline, boardPanel, setBoardPanel } = useJobBoard();
  if (!boardHeadline) return null;
  const { params, defaultDomain, nothingMatches, facets, facetsStatus, otherFilterCount, onPatch, onMoreFilters } = boardHeadline;
  return (
    <>
      <BoardHeadline params={params} defaultDomain={defaultDomain} nothingMatches={nothingMatches}
        open={boardPanel} onToggle={(key) => setBoardPanel(current => nextBoardPanel(current, key))} />
      <WordPanel open={boardPanel} params={params} defaultDomain={defaultDomain}
        facets={facets} facetsStatus={facetsStatus} otherFilterCount={otherFilterCount}
        onPatch={onPatch} onOpen={(key) => setBoardPanel(key)} onClose={() => setBoardPanel(null)}
        onMoreFilters={onMoreFilters} />
    </>
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

// The board's All / ★ Saved / ⏳ Pending tabs.
//
// THE ONE CONTROL THE RETIRED PILL UNIQUELY CARRIED. JobsPanel has its own boardTabs strip, but it
// is behind `{false && ...}` and has been for some time, so the pill was the only place these three
// existed — measured on the running app before the move: 0 occurrences of "All", "★" or "⏳" as a
// button anywhere outside the pill. Retiring the container without moving them would have removed
// the Saved and Pending tabs from the product.
//
// Labels and values are the pill's verbatim, including the glyphs, so a user who knew where ★ was
// still recognises it. Titles are added because a glyph alone has no accessible name — the pill's
// did not either, which was a defect it is not worth preserving.
//
// D11: the Pending chip is the DRAFT MARK, not an hourglass — a pending row is one you drafted, and
// the card's Draft button carries the same /d (components/DraftMark.jsx). (D18: the tab no longer does.)
// ⭐ D147 (owner 11-03): the symbols (ALL · ★ · /d · +) became WORDS and left the first screen — they live inside the
// Sort / view control's panel now (BoardSortSlot), under "Show". The four views, their values and counts are unchanged.
const BOARD_TABS = [
  ["all",      "All jobs", "All jobs on your board"],
  // ⭐ D156 (4): the ☆ on a bubble STARS it — the view's word is Starred (its id stays `saved`, the API's `starred`).
  ["saved",    "Starred",  "Starred jobs"],
  // ⭐ D40 (owner, 10-06): the jobs you imported, on the board's own card.
  ["imported", "Imported", "Imported jobs"],
];
// ⛔ D156 (4) (owner 11-05: "we dont need the drafted panel now"): the Pending / Drafted view is not offered on Home — the
// tracker (Draft House) holds every application. ?view=pending still reads (JobBoardContext's BOARD_VIEWS).

// D35: the views as ONE segmented control, each with its count (facets' `views`).
function BoardTabs() {
  const { boardTab, setBoardTab, boardHeadline } = useJobBoard();
  return (
    <ViewSegment views={BOARD_TABS} value={boardTab} onChange={id => setBoardTab?.(id)}
      counts={viewCounts(boardHeadline?.facets)} />
  );
}

// D35 §3: THE BAR'S TWO 40px SQUARES — ⇅ sort and + add jobs. ⛔ The FILTER icon is GONE (D35 §1): the
// sentence's words are the filters, so the icon had nothing left behind it.
//
// The sort square opens the sort panel beneath the bar; it presses through nextBoardPanel on the
// SAME one panel value the words use, so opening sort closes an open word and the reverse.
//
// Inside JobBoardProvider for the same reason BoardSearchBar is — AppDashboard renders the provider
// and so cannot read it.
//
// The sort list is shared/filterSentence.js's SORT_PANEL, read through sortRows — no copy of it lives
// here. SORTS stays the server's VALIDATION set for the param.
function BoardControlIcons() {
  const { boardPanel, setBoardPanel, sortBy, setSortBy,
          atsSortAvailable } = useJobBoard();

  // ⛔ THE RESUME GATES BEST FIT AND NOTHING ELSE. Decided 2026-09-26, replacing a gate that hid the
  // entire board: /api/jobs ranks fine without a resume (by target title and role key), so the only
  // thing a missing one actually prevents is ranking by FIT. sortRows(false) leaves Best fit out of
  // the panel; this falls back if the board was already sorted by fit when the resume went away,
  // rather than leaving the board on an order the panel no longer offers.
  const fitRow = sortRows(true).find(r => r.unscoredLast);
  useEffect(() => {
    if (!atsSortAvailable && fitRow && sortBy === fitRow.value) setSortBy(DEFAULT_SORT);
  }, [atsSortAvailable, sortBy, setSortBy, fitRow]);

  const sortLabel = sortRows(atsSortAvailable).find(r => r.value === sortBy)?.label || "";
  // ⭐ D156 (5): the sort is an ICON inside the search field; its label says the current order.
  return (
    <SortIcon
      open={boardPanel === BOARD_PANEL.SORT}
      onPress={() => setBoardPanel(current => nextBoardPanel(current, BOARD_PANEL.SORT))}
      label={sortLabel}
      chosen={isSortChosen(sortBy)}
    />
  );
}

// D35: the sort panel — ⭐ D156 (5): a small menu under the search field's sort icon (FullHouse.css .fh-bar > .fh-sortp).
function BoardSortSlot() {
  const { boardPanel, setBoardPanel, sortBy, setSortBy, atsSortAvailable, boardHeadline } = useJobBoard();
  if (boardPanel !== BOARD_PANEL.SORT) return null;
  return (
    <SortPanel value={sortBy} onChange={(v) => { setSortBy(v); setBoardPanel(null); }} atsAvailable={atsSortAvailable}
      facets={boardHeadline?.facets ?? null} facetsStatus={boardHeadline?.facetsStatus ?? "idle"}
      onClose={() => setBoardPanel(null)} />
  );
}

// ⭐ D147 (owner 11-03, fullhouse-declutter.html): THE BAR IS THE SEARCH. ⭐ D156 (5): with the sort icon inside it, and
// the sort's small menu under it. (D152's title row — the "Sort: For you" word at the top of the column — is gone.)
function BoardBar() {
  return (
    <div className="fh-bar" data-board-bar="">
      <BoardSearchBar><BoardControlIcons /></BoardSearchBar>
      <BoardSortSlot />
    </div>
  );
}

// ⭐ D156 (4) · UNDER THE SEARCH: All jobs · Starred · Imported, each with its count (facets' views — a count the answer
// does not hold is not drawn), and "Import a job" — the inline box (BoardBar.jsx ImportJobBox; the existing import route).
// A job imported lands under Imported: the view switches there and the board is asked again.
function BoardViews({ onImported }) {
  const { setBoardTab } = useJobBoard();
  const [importing, setImporting] = useState(false);
  return (
    <div className="fh fh-viewrow" data-board-views="">
      <div className="fh-viewrow__line">
        <BoardTabs />
        <button type="button" className="fh-importb" data-import-open="" aria-expanded={importing}
          onClick={() => setImporting(v => !v)}>Import a job</button>
      </div>
      {importing && (
        <ImportJobBox onClose={() => setImporting(false)}
          onImported={() => { setBoardTab?.("imported"); onImported?.(); }} />
      )}
    </div>
  );
}

// ⭐ D147 (D145's minimal counts) · "746 jobs · 38 new today · 12 saved" — each from the facets answer (views.all, the
// Posted clause's Past 24h count, views.saved); a count the answer does not hold is not drawn, never a 0 in its place.
function BoardCounts() {
  const { boardHeadline } = useJobBoard();
  const c = boardCounts(boardHeadline?.facets);
  const cells = [["jobs", c.jobs, false], ["new today", c.newToday, true], ["saved", c.saved, false]].filter(([, n]) => n != null);
  if (!cells.length) return null;
  return (
    <div className="fh fh-counts" data-board-counts="">
      {cells.map(([label, n, hot]) => (
        <div key={label} className={hot ? "fh-count fh-count--hot" : "fh-count"} data-count={label}>
          <b>{n.toLocaleString()}</b><span>{label}</span>
        </div>
      ))}
    </div>
  );
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
  const atlasRoute = /^atlas(?:\/family)?(?:\/[^/]+)?$/.test(routeKey);
  // ⭐ D167 · /app/profile/<panel> and /app/interview/<panel> (pages/profile/profilePanels.js, pages/interview/interviewModel.js);
  // the bare /app/profile and /app/interview read a #<panel> hash. undefined = not that place; null = an unknown panel.
  const profilePanel = profilePanelFor(routeKey, location.hash);
  const interviewPanel = interviewPanelFor(routeKey, location.hash);
  const activeTab = jobRoute ? "job" : atlasRoute ? "atlas"
    : profilePanel !== undefined ? "profile" : interviewPanel !== undefined ? "interview"
    : routeKey === CONSOLE_ROUTE || LEGACY_CONSOLE_ROUTES.has(routeKey)
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
                   ...ROUTE_ONLY_TABS]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monetisationEnabled],
  );

  const handleLogout = useCallback(async () => {
    try { await api("/api/auth/logout", { method:"POST" }); } catch {}
    setAuthContext("");
    setAuthUser(null);
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

  const handleProfileActivate = useCallback(() => {
    setJobBoardRefreshKey(k => k + 1);
  }, []);

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
    if (!routeKey) {
      navigate("/app/today", { replace:true });
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
    if (!jobRoute && !atlasRoute && profilePanel === undefined && interviewPanel === undefined
        && routeKey !== CONSOLE_ROUTE && !NAVIGABLE_TABS.has(routeKey)) {
      navigate(consolePath, { replace:true });
    }
  }, [routeKey, consolePath, navigate, NAVIGABLE_TABS, atlasRoute, location.search, profilePanel, interviewPanel]);

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
             style={{ fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:13,
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
            onProfileActivate={handleProfileActivate}
          />

          {/* D149: the deck (like Full House) starts right under the mark — its card sits at the sketch's 90 px. */}
          {/* D149 (11-03): Draft House too — its own top padding puts its title at tracker-options.html's 84 px. */}
          <main style={{ flex:1, paddingTop: activeTab === "console" || activeTab === "today" || activeTab === "auto-apply" ? 0 : 24 }}>
            {/* ⭐ D152 (1) · HOME — one grid, laid out by CSS (FullHouse.css .home): the deck's column is sticky in its
                own track and the board's column takes the rest; on a phone one column, the deck first. No page titles. */}
            {home && (
              <div className="home" data-home="">
                <section className="home__deck" aria-label="Today's picks" data-home-deck="">
                  <DeckView canUseAPlusResume={canUseAPlusResumeHere} home/>
                </section>
                <section className="home__board" aria-label="Every job" data-home-board="">
                  <header className="fh" data-fh-d147="">
                    <BoardHeadlineSlot />
                  </header>
                  <StickyBar top="var(--app-chrome-height, 74px)" className="fh fh--bar-row" data-board-sticky="">
                    <BoardBar />
                  </StickyBar>
                  <BoardViews onImported={() => setJobBoardRefreshKey(k => k + 1)} />
                  <BoardCounts />
                  <ExtensionFirstRunPrompt />
                  <JobsConsole user={authUser} onUserChange={setAuthUser}
                    refreshKey={jobBoardRefreshKey} isActive={home}/>
                </section>
              </div>
            )}
            {/* ⭐ D49 · THE BOARD'S BAR STICKS (StickyBar, above in Home's board column): sticky only works inside its
                parent's box, so it sits in the column with the jobs, not in the header. D12's ExtensionFirstRunPrompt
                says where jobs from elsewhere come from until the extension is connected. */}
            {activeTab === "auto-apply"   && <AutoApplyPanel user={authUser}/>}
            {activeTab === "job" && jobRoute && <JobWorkspacePanel {...(jobByJobId ? { jobId: decodeURIComponent(jobRoute[1]) } : { applicationId: jobRoute[1] })}/>}
            {activeTab === "plans" && monetisationEnabled && <PlansPanel user={authUser} onUserChange={setAuthUser}/>}
            {/* ⭐ D167 · Profile (its own navigation, nine panels) and Interview (Coming up · Prepare · Practise · After). */}
            {activeTab === "profile" && profilePanel && <ProfilePage panel={profilePanel} onSignedOut={() => { setAuthContext(""); setAuthUser(null); }}/>}
            {activeTab === "interview" && interviewPanel && <InterviewPage panel={interviewPanel}/>}
            {activeTab === "job-profiles" && <JobProfilesPanel/>}
            {activeTab === "recruiter"    && <RecruiterPanel/>}
            {activeTab === "atlas"        && <AtlasPage base="/app/atlas"/>}
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
      </AppScrollProvider>
    </AutoApplyProvider>
    </JobBoardProvider>
  );
}

/** ⭐ D167: /profile… and /interview… are in-app places — forwarded under /app, the query and the #panel kept (the app's
 *  own gate signs a signed-out reader in first). */
function ToApp() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`/app${pathname}${search}${hash}`} replace/>;
}

/** D105 P4: a signed-in person opening a public /atlas link lands on the same page inside the app. */
function AtlasInApp() {
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
      <span style={{ color:theme.textMuted, fontSize:13 }}>Loading…</span>
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
            ? <AtlasInApp/>
            : <AtlasPage base="/atlas" publicChrome/>
        }/>

        {/* ⭐ D167 · /profile/<panel> and /interview/<panel> without /app — the in-app place, for a signed-in reader. */}
        <Route path="/profile/*" element={<ToApp/>}/>
        <Route path="/interview/*" element={<ToApp/>}/>

        {/* New public pages with NavBar */}
        <Route path="/products" element={<>{navBar}<ProductsPage/></>}/>
        {/* ⭐ D124 · the trial's one link: signed out, Start → sign-up; signed in, pick a résumé. */}
        <Route path="/try" element={authStatus === "unknown" ? null
          : <>{navBar}<TryPage authUser={authStatus === "authenticated" && authUser && !authUser.isAdmin ? authUser : null}/></>}/>
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
            {/* ⭐ D124: THE TRIAL IS THE MAIN FRAME — a trial account gets the app with its dock, then the survey and coming soon. */}
            <TrialGate><AppDashboard authUser={authUser} setAuthUser={setAuthUser}/></TrialGate>
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

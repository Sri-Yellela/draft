// REVAMP v1 — App.jsx
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, setAuthContext }   from "./lib/api.js";
import { adoptAccountTheme }     from "./styles/colorTokens.js";
import { useTheme }              from "./styles/theme.jsx";
import { useInactivityLogout }   from "./hooks/useInactivityLogout.js";
import { useSyncEvents }         from "./hooks/useSyncEvents.js";
import AuthScreen                from "./components/AuthScreen.jsx";
import AdminLayout               from "./components/AdminLayout.jsx";
import AdminLoginPage            from "./pages/AdminLoginPage.jsx";
import DBInspector               from "./pages/admin/DBInspector.jsx";
import TopBar, { TabLabel }      from "./components/TopBar.jsx";
import AppShell                  from "./components/AppShell.jsx";
import { useChromeHeight }       from "./hooks/useChromeHeight.js";
import { useCollapsibleHeight }  from "./hooks/useCollapsibleHeight.js";
import { AppScrollProvider } from "./contexts/AppScrollContext.jsx";
import { JobBoardProvider, useJobBoard } from "./contexts/JobBoardContext.jsx";
import { AutoApplyProvider, useAutoApply } from "./contexts/AutoApplyContext.jsx";
import { AutoApplyPanel }        from "./panels/AutoApplyPanel.jsx";
import { DraftMark }             from "./components/DraftMark.jsx";
import { ExtensionFirstRunPrompt } from "./components/ExtensionPrompt.jsx";
import { ProfilePanel }          from "./panels/ProfilePanel.jsx";
import { JobProfilesPanel }      from "./panels/JobProfilesPanel.jsx";
import { DatabasePanel }         from "./panels/DatabasePanel.jsx";
import { PlansPanel }            from "./panels/PlansPanel.jsx";
import DeckView                  from "./panels/DeckView.jsx";
import { routeCommitted, transitionTo } from "./lib/viewTransitions.js";
import { IntegrationsPanel }     from "./panels/IntegrationsPanel.jsx";
import { AccountPanel }          from "./panels/AccountPanel.jsx";
import { RecruiterPanel }        from "./panels/RecruiterPanel.jsx";
import { JobsConsole }            from "./consoles/PlanConsoles.jsx";
import BoardHeadline             from "./components/BoardHeadline.jsx";
import WordPanel                 from "./components/WordPanel.jsx";
import SortPanel                 from "./components/SortPanel.jsx";
import { ViewSegment, BoardSearch, SortSquare } from "./components/BoardBar.jsx";
import StickyBar from "./components/StickyBar.jsx";
import { nextBoardPanel, sortRows, isSortChosen, DEFAULT_SORT, BOARD_PANEL, viewCounts } from "./lib/filterSentenceModel.js";
import { ATSToolPage }           from "./pages/tools/ATSToolPage.jsx";
import { GenerateToolPage }      from "./pages/tools/GenerateToolPage.jsx";
import { ApplyToolPage }         from "./pages/tools/ApplyToolPage.jsx";

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
import { Toaster }         from "./components/ui/toaster.jsx";

const CONSOLE_ROUTE = "jobs";
const LEGACY_CONSOLE_ROUTES = new Set(["simple-apply", "tailored", "custom-sampler"]);

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
  return children;
}

function AdminRouteGate({ authStatus, authUser, children }) {
  if (authStatus === "unknown") return null;
  if (authStatus !== "authenticated" || !authUser || !authUser.isAdmin) {
    return <Navigate to="/admin/login" replace/>;
  }
  return children;
}

function PublicLoginRoute({ authStatus, authUser, children, admin = false }) {
  if (authStatus === "unknown") return null;
  if (authStatus === "authenticated" && authUser) {
    if (admin) return authUser.isAdmin ? <Navigate to="/admin" replace/> : children;
    return authUser.isAdmin ? <Navigate to="/admin" replace/> : <Navigate to="/app" replace/>;
  }
  return children;
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
  const decorated = (tabs || []).map(t =>
    t.id === "auto-apply"
      ? {
          ...t,
          label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span><TabLabel label={t.label}/></span>
              {needsAttentionCount > 0 && (
                <span
                  title={attention}
                  style={{
                    minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999,
                    background: "var(--color-primary)", color: "var(--color-on-primary)",
                    fontSize: 10, fontWeight: 800, lineHeight: "16px", textAlign: "center",
                  }}>
                  <span aria-hidden="true">{needsAttentionCount}</span>
                  <span className="sr-only">{`, ${attention}`}</span>
                </span>
              )}
            </span>
          ),
        }
      : t,
  );

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
const BOARD_TABS = [
  ["all",     "ALL",  "All jobs on your board"],
  ["saved",   "★",    "Saved jobs"],
  ["pending", <DraftMark key="d" style={{ fontSize: "inherit" }}/>, "Pending apply"],
  // ⭐ D40 (owner, 10-06): + is the FOURTH VIEW — the jobs you imported, on the board's own card.
  ["imported", "+", "Imported jobs"],
];

// D35: the three views as ONE segmented control, each with its count (facets' `views`).
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
  return (
    <>
      <SortSquare
        open={boardPanel === BOARD_PANEL.SORT}
        onPress={() => setBoardPanel(current => nextBoardPanel(current, BOARD_PANEL.SORT))}
        label={sortLabel}
        chosen={isSortChosen(sortBy)}
      />
    </>
  );
}

// D35: the sort panel opens BENEATH the bar (header.html), above the jobs.
function BoardSortSlot() {
  const { boardPanel, setBoardPanel, sortBy, setSortBy, atsSortAvailable, boardHeadline } = useJobBoard();
  if (boardPanel !== BOARD_PANEL.SORT) return null;
  return (
    <SortPanel value={sortBy} onChange={setSortBy} atsAvailable={atsSortAvailable}
      facets={boardHeadline?.facets ?? null} facetsStatus={boardHeadline?.facetsStatus ?? "idle"}
      onClose={() => setBoardPanel(null)} />
  );
}

// D35 §3: THE CONDENSED BAR, one row — [ ALL · ★ · /d ] [ search ] [ ⇅ ] [ + ].
function BoardBar() {
  return (
    <div className="fh-bar" data-board-bar="">
      <BoardTabs />
      <BoardSearchBar />
      <BoardControlIcons />
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
  const activeTab = routeKey === CONSOLE_ROUTE || LEGACY_CONSOLE_ROUTES.has(routeKey)
    ? "console" : routeKey === "" ? "today" : routeKey;
  // D10 (10-03): the card-game family — DAILY DECK, FULL HOUSE, DRAFT, THE TABLE. Display strings
  // only: the ids and the /app/<id> routes are internal and stay (docs/BRAND.md). TopBar sets a two-word
  // label on two lines, so the bar's height fits the mark's.
  const appTabs = [
    // Today's draft — the deck, dealt from the top of the fit-ranked board (UI_REDESIGN §3).
    { id: "today",        label: "Daily Deck" },
    { id: "console",      label: "Full House" },
    // The auto-apply pipeline is a peer of the board now, not a strip above it (W5). It sits in
    // this row for the same reason the others do — it is a place you go, not a thing that happens
    // on the board. AppTopBar decorates it with the needs-attention count.
    // D18 (amends D6/D10): displayed as DRAFT HOUSE — it rhymes with Full House beside it — and with
    // NO mark: the /d is the card's Draft button, not a tab. The id and the /app/auto-apply route
    // are internal and stay — renaming them is cost without benefit (docs/BRAND.md).
    { id: "auto-apply",   label: "Draft House" },
    // D10: no "Job Profiles" tab. The PAGE stays (ROUTE_ONLY_TABS below), reached from the avatar
    // menu ("Manage Job Profiles", and the profile switcher's add / manage), Profile's "Open Job
    // Profiles", and the Daily Deck's set-up state ("Add your résumé →").
    { id: "database",     label: "The Table" },
    // D5: no "Recruiter" tab. FE-6 built the surface, but there is no recruiter role, signup or
    // front door, so a candidate-side tab advertised a product that does not exist. The panel and
    // its route stay (ROUTE_ONLY_TABS below) for the two in-app deep links and R2–R6.
  ];

  // The Jobs-only chrome's height, animated in and out. Its `open` input is simply "is Jobs the
  // tab", so switching between two NON-Jobs tabs never animates anything — the wrapper is already 0
  // on both sides, which is Y4's "switching between non-Jobs tabs behaves as it does now".
  // Declared after activeTab, which it reads.
  const jobsChrome = useCollapsibleHeight(activeTab === "console");

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
    if (NAVIGABLE_TABS.has(tab)) {
      // A view transition (queue 29): a job title on the page you leave and the page you reach is
      // one element moving, not two that cut. lib/viewTransitions.js says why it is not RR's prop.
      transitionTo(navigate, `/app/${tab}`);
    }
  }, [activeTab, consolePath, navigate, NAVIGABLE_TABS]);

  const handleProfileActivate = useCallback(() => {
    setJobBoardRefreshKey(k => k + 1);
  }, []);

  useInactivityLogout(handleLogout, true);

  // The account's light/dark preference follows the user between devices (follow-up 18): read once
  // per signed-in session; adoptAccountTheme reloads only if it changes what is on screen.
  useEffect(() => {
    api("/api/settings/theme").then(r => { if (r?.preference) adoptAccountTheme(r.preference); }).catch(() => {});
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
    // The SAME set handlePanelChange navigates with, so a tab cannot be routable in one direction
    // and bounced in the other. This was the second hardcoded copy of the tab list, and adding
    // "Auto Apply" to appTabs was not enough for either of them: the tab rendered and did nothing
    // because handlePanelChange had never heard of it, and typing /app/auto-apply bounced straight
    // back to the board because THIS guard had not either. Two lists, both silent when wrong.
    if (routeKey !== CONSOLE_ROUTE && !NAVIGABLE_TABS.has(routeKey)) {
      navigate(consolePath, { replace:true });
    }
  }, [routeKey, consolePath, navigate, NAVIGABLE_TABS]);

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
            activeTab={activeTab}
            onTabChange={handlePanelChange}
            hrefForTab={pathForTab}
            onLogout={handleLogout}
            onUserChange={setAuthUser}
            onProfileActivate={handleProfileActivate}
          />

          {/* ── The JOBS-ONLY chrome ──────────────────────────────────────────────────────────
              The hero and the search bar, and nothing else, in a wrapper whose height animates
              between 0 and its measured content (hooks/useCollapsibleHeight.js). Switching to or
              from Jobs changes the in-flow chrome's height by 539px at 1440x900, and Y4 asks for
              that to move smoothly rather than jump. Switching between two NON-Jobs tabs is
              unaffected: the wrapper is already 0 on both sides, so nothing animates.

              THE PILL IS GONE, and with it the reason this block used to stay mounted and hide
              itself with `visibility`. That trick existed because unmounting took 386px out of the
              document above the fold, Chrome's scroll anchoring subtracted it from the scroll
              offset, and the sentinel the pill's threshold was measured from moved back across that
              threshold — the observer's condition was a function of the state the observer set.
              With one search surface there is no threshold and no sentinel, so a conditional render
              is simply a conditional render again. */}
          <div ref={jobsChrome.outerRef} style={jobsChrome.outerStyle}>
            <div ref={jobsChrome.innerRef} style={jobsChrome.innerStyle}>
              {jobsChrome.mounted && (
                <>
                {/* The hero's top padding is 34px, not the 80px it was: the shell RESERVES the
                    chrome's height above this (Y3), so 34 + a 46px bar is the same 80px from the top
                    of the viewport the hero has always had. Expressed that way it is a distance
                    BELOW THE CHROME rather than an absolute offset that cleared it by coincidence. */}
                {/* ⛔ D35 · THE FULL HOUSE HEADER, in header.html's order: 1 the sentence (its words are
                    the filters), 2 the one panel a word opens, 3 the condensed bar, then the sort
                    panel when it is open — and 4 the jobs, below this chrome. */}
                <header className="fh" style={{ animation:"fadeUp 0.6s ease both" }}>
                  <BoardHeadlineSlot />
                </header>
                </>
              )}
            </div>
          </div>

          <main style={{ flex:1, paddingTop: activeTab === "console" ? 0 : 24 }}>
            {/* ⭐ D49 · THE BOARD'S BAR STICKS — through the one StickyBar module (the posting panel's
                action bar is its second consumer, D48). It lives HERE, at the top of <main>, and not
                in the header above: sticky only works inside its parent's box, and the header ended
                right under the bar, so the bar scrolled away with the page (measured 202 → −698 px).
                The order is unchanged: the sentence, its panel, then the bar, the sort panel, the jobs. */}
            {activeTab === "console" && (
              <>
                <StickyBar top="var(--app-chrome-height, 74px)" className="fh fh--bar-row" data-board-sticky="">
                  <BoardBar />
                  <BoardSortSlot />
                </StickyBar>
                {/* D12: until the extension is connected, say where jobs from elsewhere come from. */}
                <ExtensionFirstRunPrompt />
              </>
            )}
            {activeTab === "console" && (
              <JobsConsole user={authUser} onUserChange={setAuthUser}
                refreshKey={jobBoardRefreshKey} isActive={activeTab === "console"}/>
            )}
            {activeTab === "today"        && <DeckView canUseAPlusResume={canUseAPlusResumeHere}/>}
            {activeTab === "auto-apply"   && <AutoApplyPanel/>}
            {activeTab === "database"     && <DatabasePanel user={authUser}/>}
            {activeTab === "integrations" && <IntegrationsPanel/>}
            {activeTab === "account"      && <AccountPanel onSignedOut={() => { setAuthContext(""); setAuthUser(null); }}/>}
            {activeTab === "plans" && monetisationEnabled && <PlansPanel user={authUser} onUserChange={setAuthUser}/>}
            {activeTab === "profile"      && <ProfilePanel user={authUser} onOpenJobProfiles={() => handlePanelChange("job-profiles")}/>}
            {activeTab === "job-profiles" && <JobProfilesPanel/>}
            {activeTab === "recruiter"    && <RecruiterPanel/>}
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

  const handleAdminLogout = useCallback(async () => {
    try { await api("/api/auth/logout", { method:"POST" }); } catch {}
    setAuthContext("");
    setAuthUser(null);
    setAuthStatus("unauthenticated");
  }, []);

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
      <Routes>
        {/* Standalone tool pages — always public */}
        <Route path="/tools/ats"      element={<ATSToolPage/>}/>
        <Route path="/tools/generate" element={<GenerateToolPage/>}/>
        <Route path="/tools/apply"    element={<ApplyToolPage/>}/>

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
        <Route path="/terms"        element={<TermsPage/>}/>

        {/* New public pages with NavBar */}
        <Route path="/products" element={<>{navBar}<ProductsPage/></>}/>
        <Route path="/blog"     element={<>{navBar}<BlogPage/></>}/>

        {/* Admin login — redirect if already authenticated */}
        <Route path="/admin/login" element={
          <PublicLoginRoute authStatus={authStatus} authUser={authUser} admin>
            <AdminLoginPage onLogin={(user) => {
              setAuthUser(user);
              setAuthStatus("authenticated");
            }}/>
          </PublicLoginRoute>
        }/>

        {/* Admin dashboard — requires auth + isAdmin */}
        <Route path="/admin" element={
          <AdminRouteGate authStatus={authStatus} authUser={authUser}>
            <AdminLayout user={authUser} onLogout={handleAdminLogout}/>
          </AdminRouteGate>
        }/>

        {/* Admin DB Inspector */}
        <Route path="/admin/db" element={
          <AdminRouteGate authStatus={authStatus} authUser={authUser}>
            <AdminLayout user={authUser} onLogout={handleAdminLogout}><DBInspector/></AdminLayout>
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

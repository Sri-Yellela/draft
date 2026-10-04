import { createContext, useContext, useCallback, useRef, useState } from "react";

const JobBoardContext = createContext(null);
const PROFILE_UI_CACHE_KEY = "rm_jobs_profile_ui_v1";

// Every field UnifiedSearchBar publishes. Spread over the incoming object on every apply, so a
// cleared control arrives as "" and actually clears the board's filter rather than leaving the
// previous value behind — the failure mode a partial update would produce.
const EMPTY_BAR_FILTERS = { query: "", location: "", experience: "", domain: "", status: "" };

export function JobBoardProvider({ children }) {
  const [boardTab,    setBoardTab]    = useState("all");
  const [localSearch, setLocalSearch] = useState("");
  // D24: "" = the CURATED default — GET /api/jobs is sent NO sort param and answers with the
  // profile's relevance and fit first. An explicit "dateDesc" now means truly newest-first, so it is
  // sent only when the user picks Newest in the sort panel.
  const [sortBy,      setSortBy]      = useState("");
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedJobMeta, setSelectedJobMeta] = useState(null);
  const profileCacheRef = useRef(new Map());

  // -- The search bar's published filter set ------------------------------------------------
  //
  // UnifiedSearchBar is rendered by App.jsx, ABOVE the board, and the board's filter state lives
  // inside JobsPanel — so the bar had no way to reach it and was handed `onSearch={() => {}}` /
  // `onLocalFilter={() => {}}`. Measured before this: typing a keyword, both Search clicks, and all
  // three selects produced ZERO /api/jobs requests between them, while the sort select, NEW IN 24H,
  // the FILTERS drawer and the collapsed pill (which are JobsPanel-owned, or reach it through this
  // same context) each fired correctly. Every control on the app's most prominent surface was inert.
  //
  // This is the channel, and it is deliberately the SHAPE THE BAR ALREADY PUBLISHES — the same
  // { query, location, experience, domain, status } object LandingPage's handlers already destructure
  // — so there is one vocabulary between the two consumers rather than a second one invented here.
  // JobsPanel maps it onto its own committed filter state, which feeds buildParams; nothing bypasses
  // buildParams, so there is still exactly one param builder.
  // ⛔ WHETHER FIT RANKING IS POSSIBLE, published here because the SORT CONTROL and the RESUME
  // live in different trees. App.jsx renders the sort icon; JobsPanel owns the active profile's
  // base resume. Without a channel between them the sort offered "ATS Sort" to accounts that have
  // no signals to rank by, which sorts by a column that is null for every row.
  //
  // Decided 2026-09-26: a missing resume gates the ATS SORT ONLY. It used to replace the whole
  // board with a setup prompt, which is how a reviewer signed in to 688 ranked jobs and saw a
  // blank screen. The board does not need a resume — the server ranks it by target title and role
  // key — so hiding it was always too strong.
  const [atsSortAvailable, setAtsSortAvailable] = useState(true);
  const [barFilters, setBarFilters] = useState(EMPTY_BAR_FILTERS);
  // Bumped only by the SECOND click (the live half of the double-click local->live pattern). It is a
  // counter rather than a boolean because two consecutive live searches for the same terms must both
  // run — a boolean would latch and the second would be a no-op.
  const [liveSearchTick, setLiveSearchTick] = useState(0);

  // -- The consolidated control row (W4) --------------------------------------------------
  //
  // The filter and sort triggers moved up beside IMPORT, which is rendered by App.jsx in
  // UnifiedSearchBar's `actions` slot — above the board, exactly like the search bar was. So the
  // same problem and the same answer: the trigger lives up there, the PANEL and all its staging
  // logic stay in JobsPanel where they already are, and these two values are the wire between them.
  // Nothing about the filter drawer moves; only what opens it.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // Published UPWARD by JobsPanel, which is the only thing that can count them. With the filters
  // behind an icon a user has to be able to see at a glance that some are on — otherwise
  // "0 jobs matched" becomes unexplainable, which is the whole reason the badge is a requirement
  // and not a decoration.
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // -- D24: the two panels behind the two icons -----------------------------------------------
  //
  // ⛔ BOTH CLOSED BY DEFAULT — the board starts right under the search bar. ONE value, not two
  // booleans: null | "filter" (the sentence) | "sort" (the sort panel), so the two are mutually
  // exclusive by construction (lib/filterSentenceModel.js's nextBoardPanel). The icons are in
  // App.jsx; the panels render in JobsPanel, which owns the filters and the facets answer — the
  // same split W4 made for the drawer, for the same reason.
  //
  // `filterPanelOpen` above is still the DRAWER — the filters that are not clauses — reached from the
  // sentence's "More filters".
  const [boardPanel, setBoardPanel] = useState(null);
  // The filter icon's badge: how many of the sentence's clauses carry a choice (activeClauseCount,
  // shared/filterSentence.js). Published upward by JobsPanel, which holds the committed filters.
  const [activeClauseCount, setActiveClauseCount] = useState(0);

  const applyBarFilters = useCallback((params, { live = false } = {}) => {
    setBarFilters({ ...EMPTY_BAR_FILTERS, ...(params || {}) });
    if (live) setLiveSearchTick(t => t + 1);
  }, []);

  const getProfileCache = useCallback((profileId) => {
    if (profileId == null) return null;
    return profileCacheRef.current.get(String(profileId)) || null;
  }, []);

  const setProfileCache = useCallback((profileId, snapshot) => {
    if (profileId == null || !snapshot) return;
    profileCacheRef.current.set(String(profileId), { ...snapshot, cachedAt: Date.now() });
  }, []);

  const deleteProfileCache = useCallback((profileId) => {
    if (profileId == null) return;
    profileCacheRef.current.delete(String(profileId));
    // BOTH stores. JobsPanel's view snapshot is per tab in sessionStorage with localStorage as the
    // seed (AH2), so clearing only the seed left a deleted profile's board state alive in whichever
    // tab had been looking at it.
    for (const store of [sessionStorage, localStorage]) {
      try {
        const all = JSON.parse(store.getItem(PROFILE_UI_CACHE_KEY) || "{}");
        delete all[String(profileId)];
        store.setItem(PROFILE_UI_CACHE_KEY, JSON.stringify(all));
      } catch {}
    }
  }, []);

  return (
    <JobBoardContext.Provider value={{
      boardTab, setBoardTab, localSearch, setLocalSearch, sortBy, setSortBy,
      activeProfileId, setActiveProfileId, getProfileCache, setProfileCache, deleteProfileCache,
      selectedJob, setSelectedJob, selectedJobMeta, setSelectedJobMeta,
      barFilters, applyBarFilters, liveSearchTick,
      atsSortAvailable, setAtsSortAvailable,
      filterPanelOpen, setFilterPanelOpen, activeFilterCount, setActiveFilterCount,
      boardPanel, setBoardPanel, activeClauseCount, setActiveClauseCount,
    }}>
      {children}
    </JobBoardContext.Provider>
  );
}

export function useJobBoard() { return useContext(JobBoardContext); }

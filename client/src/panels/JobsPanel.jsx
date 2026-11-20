// client/src/panels/JobsPanel.jsx — Lucy Brand, shared job pool
import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { NoteCard } from "../components/TextBlocks.jsx";   // A233: the empty states as note cards
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import EmptyState from "../components/EmptyState.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { api, printResume, downloadBlob, authHeaders, authContextQuery } from "../lib/api.js";
import { useMonetisationEnabled } from "../lib/monetisation.jsx";
import { GENERATE_TOOL, A_PLUS_TOOL, TOOL_LABELS, normalizeTool } from "../lib/applyTools.js";
import { planPageFetch, recordPageCursor } from "../lib/boardPaging.js";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { DECISIONS, DECISION_SURFACES, DECISION_TOAST_MS, commitDecision, undoDecision, undoFlagsFor, flagsFor, isDrafted, draftBlock } from "../lib/jobDecisions.js";
import { registerAssistantActions } from "../lib/assistantBridge.js";   // D190: Ask draft calls the board's own decisions
import { PREREQUISITE_LABELS } from "../lib/applyObstacles.js";
import { companyRows, companyNotice, matchCompany } from "../../../shared/companyIdentity.js";
import { roleWord } from "../../../shared/filterSentence.js";   // A145: "Backend · Software engineering"
import { eligibilityNotice, statedEligibility } from "../../../shared/postingRequirements.js";
import DecisionToast from "../components/DecisionToast.jsx";
import { useTheme } from "../styles/theme.jsx";
import { useViewport } from "../hooks/useViewport.js";
import JobBubble, { JobBubbleRows, JobBubbleSkeleton, JobBoardColumns } from "../components/JobBubble.jsx";
import { viewKey, viewCacheGet, viewCacheSet } from "../lib/boardViewCache.js";
import { SavedEmptyState, useExtensionStatus } from "../components/ExtensionPrompt.jsx";
import { EXTENSION_PAGE, EXTENSION_STORE_URL } from "../../../shared/extension.js";
import JobDetailPanel from "../components/JobDetailPanel.jsx";
import SendJobPicker from "../components/SendJobPicker.jsx";   // (11) 45q: D180's Send on the list rows
import SandboxPanel, { cleanDocHtml } from "./SandboxPanel.jsx";
import { PanelScrim, PanelDock, PANEL_TOP_INSET, PANEL_BOTTOM_INSET } from "../components/PanelShell.jsx";
import { usePanelHost } from "../hooks/usePanelHost.js";
import { useBoardLock } from "../hooks/useBoardLock.js";
import DomainProfileWizard from "../components/DomainProfileWizard.jsx";
import ProfileSelectorDropdown from "../components/ProfileSelectorDropdown.jsx";
import { useSyncEvents } from "../hooks/useSyncEvents.js";
import { useAppScroll } from "../contexts/AppScrollContext.jsx";
import { useJobBoard, viewFromUrl } from "../contexts/JobBoardContext.jsx";
import { Z } from "../styles/zLayers.js";
import { toast } from "../hooks/use-toast.js";
import ROLE_ALIAS_MAP from "../../../registry/ROLE_ALIAS_MAP.json";
// The filter option contract. Every option list below renders FROM these tables — see
// shared/jobFilterOptions.js for why they are not literals here any more.
import {
  EXPERIENCE_LEVELS, WORK_MODELS, EMPLOYMENT_TYPES, SOURCES, AUTOMATION_TIERS,
  POSTING_AGE, VISITED, ageDaysMap,
} from "../../../shared/jobFilterOptions.js";
// AH2: the job-detail address, shared with JobCard so the href and the param cannot disagree.
import { JOB_URL_PARAM, jobIdFromSearch, OPEN_MATCH_EVENT, OPEN_POSTING_EVENT, CLOSE_POSTING_EVENT, POSTING_ON_DECK_EVENT, DECK_DECIDE_EVENT, DECK_POST_SLOT_ID, POST_FADE_MS, openPostingOnDeck, panelOverPosting } from "../lib/jobUrl.js";
// D35: the Full House header (App.jsx) renders the sentence, its one panel and the sort panel; this
// panel publishes what they read — the committed clause params and the facets answer.
import { JOB_FUNCTIONS, PLACES } from "../../../shared/jobTagVocabulary.js";
// D42 · the company's sector — a drawer filter, separate from the job's domain (the sentence's word).
import { SECTORS } from "../../../shared/companySectors.js";
import { useJobFacets } from "../hooks/useJobFacets.js";
import {
  SENTENCE_CLAUSES, activeClauseCount as countActiveClauses, STRICT_PARAM,
  sortFromCachedSnapshot,
} from "../lib/filterSentenceModel.js";
import { FIT_BANDS } from "../../../shared/filterSentence.js";
import { atsBandFor, atsBandLabel } from "../../../shared/atsBands.js";
import { markStyle, bandMarkStyle } from "../styles/mark.js";
import { C } from "../styles/colorTokens.js";
import { glass } from "../styles/glass.js";
import { atsScorePair } from "../../../shared/resumeScores.js";
import { openPosting } from "../lib/openPosting.js";
import { rememberBoardFilters } from "../lib/boardFilterMemory.js";
import { openResumeEditor } from "../lib/resumeEditor.js";
import { sentenceFromResume } from "../../../shared/resumeSentence.js";   // D184 B-7
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// The three extension-bridge stubs that stood here (getLinkedInExtensionInstallUrl,
// isLinkedInExtensionInstalled, sendExtensionRequest) are gone with cleanup 5.3. They returned
// null / false / an empty promise, which meant every caller was unreachable or a no-op while
// still presenting working-looking UI. The extension integration that remains is the SINGLE-job
// capture, which talks to the server over HTTP and needs no in-page bridge at all.

// Normalizes the new /api/jobs aggregator field names to the shape
// the rest of JobsPanel and JobCard expect (legacy camelCase fields).
function normalizeApiJob(job) {
  return {
    ...job,
    jobId:          job.jobId          ?? job.id,
    applyUrl:       job.applyUrl       ?? job.url,
    postedAt:       job.postedAt       ?? job.posted_at,
    salaryMin:      job.salaryMin      != null ? job.salaryMin      : (job.salary_min  ?? null),
    salaryMax:      job.salaryMax      != null ? job.salaryMax      : (job.salary_max  ?? null),
    salaryCurrency: job.salaryCurrency ?? job.salary_currency ?? null,
    // ⛔ "not remote" is not "on-site" (it may be hybrid), and mapJobRow sends remote:false for a posting
    // that says nothing (Boolean(null)) — so false says nothing here. Only a stated workstyle is shown;
    // otherwise the deck's Workstyle cell falls back to the location (D59's browser pass, 10-07).
    workType:       job.workType       ?? (job.remote === true ? "Remote" : null),
    employmentType: job.employmentType ?? job.contract_type ?? null,
    // mapJobRow already emits camelCase automationTier and the `...job` spread above would carry
    // it through untouched — this line is here for the endpoints that hand this function a raw
    // row rather than a mapped one (the poll feed), so the card gets the same field either way.
    // null stays null: JobCard's TierChip renders null exactly as it renders 'unknown'.
    automationTier: job.automationTier ?? job.automation_tier ?? null,
    // THE SCORE ARRIVES UNDER A NAME NOTHING ON THIS SIDE READ.
    //
    // /api/jobs maps rows through services/jobs/mapJobRow.js, which emits the stored ats_score as
    // `matchScore` — the name the mobile contract documents. Every desktop surface reads
    // `baseAtsScore`, which comes from a DIFFERENT mapper (server.js's /api/jobs/poll shape) over
    // the same column. So on the board, baseAtsScore was undefined on every row, the badge fell to
    // its null branch, and all 1,266 cards read "No signal" — while clicking one opened a panel
    // that scored the job for real and showed a band. The badge and the panel disagreed because
    // they were reading two different fields.
    //
    // test/matchScoreReachesTheClient.test.js already documents this exact drift and fixed the
    // SERVER half of it. This is the client half: the desktop half was never joined up, and the
    // test's own comment ("the desktop client never reads it") records the gap rather than closing
    // it.
    //
    // ?? NOT ||, for the reason that test spells out: a score of 0 is a real score that bands as
    // Weak, and `||` would collapse it into null, which means the scorer DECLINED.
    baseAtsScore:   job.baseAtsScore   ?? job.matchScore ?? null,
  };
}

const USER_TEXT   = C.ON_ACCENT;   // black text on accent
const PROFILE_UI_CACHE_KEY = "rm_jobs_profile_ui_v1";

// AH2: this snapshot is PER TAB, not per origin.
//
// What it holds is transient VIEW state — boardTab, localSearch, sortBy, currentPage and every
// filter. In localStorage alone, two tabs on the board shared one slot per profile and the last
// write won: open a second tab and the first tab's page number, search text and filters were
// replaced by the second tab's defaults, so going back to tab one and letting it re-read the cache
// lost the user's place. currentPage in particular cannot be shared by construction — two tabs
// looking at the same board are looking at different pages, that is the point of two tabs.
//
// sessionStorage is per tab, so it is the authoritative copy for THIS tab. localStorage is kept as
// the SEED: sessionStorage dies with the tab, and "come back tomorrow and your filters are still
// applied" is a real behaviour that only the origin-wide copy can provide. So a brand-new tab
// starts from whatever was last used anywhere, and from then on it is on its own.
function readProfileUiCache(profileId) {
  if (profileId == null) return null;
  const key = String(profileId);
  try {
    const mine = JSON.parse(sessionStorage.getItem(PROFILE_UI_CACHE_KEY) || "{}");
    if (mine[key]) return mine[key];
  } catch {}
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_UI_CACHE_KEY) || "{}");
    return all[key] || null;
  } catch { return null; }
}

function writeProfileUiCache(profileId, snapshot) {
  if (profileId == null || !snapshot) return;
  // The persisted key set is DERIVED from defaultFilterSnapshot() plus the four non-filter board
  // keys, instead of being spelled out. It used to be a hand-written list of 15 names that stopped
  // at ageFilter, so every filter added after it — salary, work models, experience levels, skills,
  // sponsor-friendly, providers, tiers — was silently dropped on reload: the board came back
  // unfiltered while the drawer had claimed the filter was applied.
  // sortSemantics: D24's SORT_SEMANTICS, written as a literal because this function runs with storage as
  // its only dependency (test/boardSecondLoadParity runs the shipping source); a test pins 2 === SORT_SEMANTICS.
  const persisted = { cachedAt: Date.now(), sortSemantics: 2 };
  for (const key of ["boardTab", "localSearch", "sortBy", "currentPage",
                     ...Object.keys(defaultFilterSnapshot())]) {
    persisted[key] = snapshot[key];
  }
  // Two independent writes, each in its own try. The tab's own copy is the one read back, so a
  // failure on the shared seed (a full localStorage quota, a browser with it disabled) must not be
  // able to take it down with it — which one shared try block would have done.
  const put = (store) => {
    try {
      const all = JSON.parse(store.getItem(PROFILE_UI_CACHE_KEY) || "{}");
      all[String(profileId)] = persisted;
      store.setItem(PROFILE_UI_CACHE_KEY, JSON.stringify(all));
    } catch {}
  };
  put(sessionStorage);   // authoritative for THIS tab
  put(localStorage);     // seed for the next brand-new tab, and across a browser restart
}

// Upstream scrape requests are profile-driven on the server.
// Board UI filters stay local to /api/jobs and must not shape /api/scrape.
// The request builder that used to carry that rule is gone (§5.12): /api/scrape has returned
// HTTP 410 since external scraping was removed, and this client never posts to it, so the builder
// had no call site left. The rule is kept here as a constraint on anyone re-adding an outbound
// path — the server derives it from the profile; board filters stay out of it.

// ── Helpers ───────────────────────────────────────────────────
// The ageFilter -> days mapping, DERIVED rather than restated. It used to be a literal here and a
// second literal in server.js's AGE_MAP, which is two copies of one definition; both now read the
// shared POSTING_AGE table, so "past week" cannot come to mean two different things.
const AGE_DAYS_MAP = ageDaysMap();

function ago(ts) {
  if (!ts) return "-";
  const d = Date.now() - new Date(ts).getTime();
  if (d < 3600000)  return `${Math.floor(d/60000)}m`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h`;
  return `${Math.floor(d/86400000)}d`;
}

// Moved to client/src/lib/applyTools.js so AutoApplyContext can build the same apply-run request
// from the same constants — two copies of a wire value is how a client and a server drift apart.

function getActiveArtifact(entry, tool) {
  if (!entry) return null;
  const selected = normalizeTool(tool || entry.activeTool || entry.tool);
  return entry.variants?.[selected] || entry;
}

function mergeArtifact(entry, artifact) {
  const tool = normalizeTool(artifact.tool);
  const variants = { ...(entry?.variants || {}) };
  if (entry?.html && entry.html !== "__exists__" && entry.tool) {
    variants[normalizeTool(entry.tool)] = { ...entry, variants: undefined };
  }
  variants[tool] = { ...artifact, variants: undefined, activeTool: tool };
  return { ...artifact, variants, activeTool: tool };
}

function buildArtifact(job, data, tool) {
  const t = normalizeTool(data?.tool || tool);
  return {
    html: data.html,
    atsScore: data.atsScore ?? data.ats_score,
    // ⭐ D58: the base résumé's score for this posting, stored WITH the tailored one at generation.
    baseAtsScore: data.baseAtsScore ?? data.base_ats_score ?? null,
    atsReport: data.atsReport,
    company: data.company || job.company,
    title: data.title || data.role || job.title,
    jobId: job.jobId,
    jobUrl: job.url,
    source: job.source,
    location: job.location,
    tool: t,
    toolLabel: data.toolLabel || TOOL_LABELS[t],
    version: data.version || null,
    // D57: when it was generated — the posting panel's "Résumé ready · 2h ago".
    generatedAt: data.generatedAt ?? null,
    status: "success",
    // Company KB failsafe gate (Task 9.6) — additive; [] when the backend has nothing to say
    // (the common case), so SandboxPanel renders nothing extra for most generations.
    kbFindings: data.kbFindings || [],
  };
}

// A93: LinkedInLogo, IndeedLogo, PlatformLogo, WorkBadge and ResumeBadge were dead private copies of
// JobCard's — removed. The board's card is JobBubble; JobCard keeps the only copies.

// ── The board's text button (was the "Lucy" button: rectangle → pill on hover over 1s, Barlow
//    capitals, a 2.5px ink box). A53: the deck's treatment — a glass pill at rest, the orange FILL
//    with ink text on hover (text on orange is ink; colorTokens.js). Same props, same callers.
function LucyBtn({ children, onClick, disabled, accent: accentProp,
                    style = {}, title }) {
  const [hov, setHov] = useState(false);
  const live = hov && !disabled;
  return (
    <button className="dbx-depth dbx-depth"
      onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...(live
          ? { background: accentProp || C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`,
              boxShadow: C.SHADOW_GLASS_HOVER }
          : { ...glass({ radius: 10 }), color: C.INK }),
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "7px 18px", fontWeight: 800, fontSize: ts(12.5), letterSpacing: "0.02em",
        fontFamily: "inherit",
        transition: "background-color 160ms ease, box-shadow 160ms ease",
        whiteSpace: "nowrap", flexShrink: 0,
        opacity: disabled ? 0.45 : 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
        ...style,
      }}>
      {children}
    </button>
  );
}


// Every one of the five option lists this file used to declare is now a reference to the shared
// contract. They were all correct — that is exactly why they are dangerous as copies: nothing
// fails when one of them is edited and the others are not, and the board simply stops matching.
const EMP_TYPE_OPTIONS = EMPLOYMENT_TYPES.options;

// jobQuery.js's work_models dimension (sj.workplace_type — the Task-5 ENRICHMENT column). This is
// now the only work-location control: the legacy single-select over sj.work_type was removed because
// no write path populates that column, and this one filters the column enrichment actually fills.
const WORK_MODEL_OPTIONS = WORK_MODELS.options;

// FE-2: jobQuery.js's experience_levels dimension (sj.experience_level — the profile-bridge's
// derived default; an explicit selection here overrides it, per server.js's per-key merge). Shared
// with the search bar's Experience select, which is the pairing W1 had to correct by hand.
const EXPERIENCE_LEVEL_OPTIONS = EXPERIENCE_LEVELS.options;

// Provider (scraped_jobs.source) options for the include/exclude control. The comment here used to
// say this list "mirrors the vocabulary the writers actually emit ... deliberately NOT an import of
// the server module" — and it did not mirror it. It offered `LinkedIn`, which no writer emits (the
// extension writes `linkedin_extension`), and omitted workday, smartrecruiters, workable and
// recruitee, which are all registered aggregator plugins. Deliberately not importing the vocabulary
// is precisely how it came to be wrong. It is imported now. The counts beside each still come from
// jobQuery.js's `sources` facet at runtime, so a provider with 0 rows shows "(0)" rather than being
// silently absent.
const SOURCE_OPTIONS = SOURCES.options;

// Automation tier. Order is decreasing confidence; the hints travel with the values in the shared
// table, because a tier without its explanation is the control that reads as either a promise or a
// warning. services/jobs/automationTier.js's AUTOMATION_TIERS is derived from the same table.
const TIER_OPTIONS = AUTOMATION_TIERS.options;

function defaultFilterSnapshot() {
  return {
    roleFilter: "",
    locationFilter: "",
    workType: "",
    employmentTypePrefs: ["full-time"],
    catFilter: "",
    srcFilter: "",
    minYoe: "",
    maxYoe: "",
    maxApplicants: "",
    visitedFilter: "",
    ageFilter: "",
    // FE-2: Task-4 filter vocabulary + the profile-bridge visa preference override.
    salaryMin: "",
    salaryMax: "",
    workModels: [],
    experienceLevels: [],
    skillsInclude: [],
    sponsorFriendly: false,
    companySponsors: "",
    // D59: "hide roles that require clearance or citizenship" — default off, so the querystring is unchanged.
    hideEligibility: false,
    // D106: "Truly entry level" — the text asks entry / early, not just the title. Default off.
    trulyEntry: false,
    // D137: "Hide likely not hiring" — only the ghost score's Likely not hiring postings. Default off.
    hideGhost: false,
    // Provider + automation-tier include/exclude. Empty arrays are the default-off state: buildParams
    // emits nothing at all for them, which is what keeps the default querystring byte-identical.
    sourcesInclude: [],
    sourcesExclude: [],
    tiersInclude: [],
    tiersExclude: [],
    // D24: the sentence's fourth clause, "where my fit is Strong" — FIT_BANDS, a HARD filter (an
    // unscored job matches no band). Empty is the default-off state, so the default querystring is
    // unchanged.
    fitBands: [],
    // D30: the two open-set dials, over the D29 tag layer — the job function ("domain") and the place
    // set ("location"; empty IS the US floor). Empty is default-off, so the querystring is unchanged.
    jobFunctions: [],
    places: [],
    // D42: the COMPANY's sector (drawer) and the strict toggle ("only jobs known to match" — the
    // panels' pill). Default-off, so the querystring is unchanged.
    sectors: [],
    strictTags: false,
  };
}

// ── Filters panel (collapsible) ───────────────────────────────
// The filters drawer's nav clearance.
//
// It used to be `position: fixed; inset: 0; zIndex: 500` — a raw number belonging to no tier, and
// full-height. TopBar is Z.NAV (1500), so the top 46px of the drawer sat UNDER it. Measured at
// 1440x900 with the drawer open: the panel ran 0 -> 900, its header 24 -> 54, and its close button
// was a 9px-wide box at x 1411-1420, y 26-53 — overlapping the avatar at 1389-1419, y 8-38. A
// hit-test at the close button's own centre (1416, 40) returned a nav <div>, not the button. So the
// control was not merely cramped: it was unclickable across its upper half.
//
// The fix is the one client/src/styles/zLayers.js prescribes, not a bigger number. Its rule 2 says
// "a raw bump is not a fix — the question is which TIER it belongs to", and 500 belonged to no tier.
//
// Y2 REVISED WHICH TIER. The first fix put this drawer on MODAL_SCRIM / MODAL — the panels' own
// tiers — which cleared the nav but left the relative order of TWO different drawers an accident of
// render order: open a JD panel while the filters drawer is up and which one won was undefined.
// It now has its own tier, DRAWER_SCRIM / DRAWER, between the search surface and the panels: it
// covers the search bar and the top bar, and a JD/PDF/ATS panel covers it.
//
// The nav clearance itself is no longer LOAD-BEARING for reachability — the bar is at Z.NAV (250),
// below this drawer, so it cannot occlude the close control whatever the geometry. The inset stays
// for the independent reason it was chosen: PanelShell parity.
//
// The insets are PanelShell's OWN CONSTANTS now, imported rather than copied. They were the
// literals 80 and 16 here and 80 and 16 there — two numbers that had to agree, with a test reading
// one out of the other's source to check. Importing them makes "the filters drawer and the
// JD/PDF/ATS dock share a top edge" true by construction. And the top one is no longer a number at
// all: it is `calc(var(--app-chrome-height) + 34px)`, so it tracks the bar's measured height (Y4).
// A73 · the board's own failure message starts with this, so a later success clears only its own.
const BOARD_ERROR_PREFIX = "The board could not be updated";
const FILTER_DRAWER_TOP = PANEL_TOP_INSET;
const FILTER_DRAWER_BOTTOM = PANEL_BOTTOM_INSET;

function FiltersPanel({
  open, onClose, onApply,
  categories,
  role, setRole,
  location, setLocation,
  workType, setWorkType,
  employmentTypePrefs, setEmploymentTypePrefs,
  catFilter, setCatFilter,
  srcFilter, setSrcFilter,
  minYoe, setMinYoe,
  maxYoe, setMaxYoe,
  maxApplicants, setMaxApplicants,
  visitedFilter, setVisitedFilter,
  ageFilter, setAgeFilter,
  salaryMin, setSalaryMin,
  salaryMax, setSalaryMax,
  workModels, setWorkModels,
  experienceLevels, setExperienceLevels,
  skillsInclude, setSkillsInclude,
  sponsorFriendly, setSponsorFriendly,
  companySponsors, setCompanySponsors,
  hideEligibility = false, setHideEligibility = () => {},
  trulyEntry = false, setTrulyEntry = () => {},
  hideGhost = false, setHideGhost = () => {},
  sectors = [], setSectors = () => {},
  sourcesInclude, setSourcesInclude,
  sourcesExclude, setSourcesExclude,
  tiersInclude, setTiersInclude,
  tiersExclude, setTiersExclude,
  facetCounts,
  onReset,
  // Moved in from the control row (W4). Neither is new and neither changed: "New in 24h" is still
  // the same ageFilter toggle, and the tracked-search trio is still saveTrackedSearch /
  // applyTrackedSearch / clearTrackedSearch.
  onSaveSearch, onApplySearch, onClearSearch, trackedSearch, canSaveSearch,
}) {
  const { theme } = useTheme();
  const [skillDraft, setSkillDraft] = useState("");
  if (!open) return null;

  // FE-2: opt-in facet counts (services/jobs/jobQuery.js's FACET_DIMENSIONS) — only present
  // when the panel has fetched them; a control renders with no count suffix until then.
  const countFor = (dimension, value) => {
    const rows = facetCounts?.[dimension];
    if (!rows) return null;
    const hit = rows.find(r => String(r.value).toLowerCase() === String(value).toLowerCase());
    return hit ? hit.count : null;
  };
  const withCount = (label, count) => (count != null ? `${label} (${count})` : label);

  // Tri-state pill: neutral -> include -> exclude -> neutral. One control per option instead of
  // two parallel lists, because "greenhouse is in both include and exclude" is a state the user
  // can otherwise reach and the server cannot answer sensibly. Include and exclude are therefore
  // mutually exclusive by construction here, not by validation after the fact.
  const IncludeExcludeRow = ({ options, dimension, included, setIncluded, excluded, setExcluded }) => (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
      {options.map(opt => {
        const isIn  = included.includes(opt.value);
        const isOut = excluded.includes(opt.value);
        const cycle = () => {
          if (isIn) {                                   // include -> exclude
            setIncluded(included.filter(v => v !== opt.value));
            setExcluded([...excluded, opt.value]);
          } else if (isOut) {                           // exclude -> neutral
            setExcluded(excluded.filter(v => v !== opt.value));
          } else {                                      // neutral -> include
            setIncluded([...included, opt.value]);
          }
        };
        const border = isIn ? theme.accent : isOut ? C.DANGER : theme.border;
        const bg     = isIn ? theme.accentMuted : isOut ? C.DANGER_QUIET : "transparent";
        const fg     = isIn ? theme.accentText : isOut ? C.DANGER : theme.textMuted;
        return (
          <button className="dbx-depth" key={opt.value} type="button" onClick={cycle}
            title={[opt.hint, isIn ? "Included — click to exclude" : isOut ? "Excluded — click to clear" : "Click to include"]
              .filter(Boolean).join(" · ")}
            style={{
              padding:"5px 12px", fontSize:ts(11), fontWeight:600,
              cursor:"pointer", border:`1px solid ${border}`, background:bg, color:fg,
              transition:"all 0.15s", textDecoration: isOut ? "line-through" : "none",
            }}>
            {isOut ? "− " : isIn ? "+ " : ""}
            {withCount(opt.label, dimension ? countFor(dimension, opt.value) : null)}
          </button>
        );
      })}
    </div>
  );

  const selStyle = {
    width:"100%", height:36, padding:"0 10px",
    border:`1px solid ${theme.border}`, borderRadius:4,
    background:theme.surface, color:theme.text, fontSize:ts(12), outline:"none",
  };
  const labelStyle = { fontSize:ts(11), fontWeight:700, color:theme.textMuted,
                        textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 };
  // PORTALLED TO document.body, which is what makes the drawer inertable — see the note on
  // FILTER_DRAWER_TOP above and useBoardLock. This drawer rendered inside JobsPanel, i.e. inside
  // <main>, i.e. inside [data-app-shell]. useBoardLock inerts the shell's CHILDREN, so inerting the
  // app to protect the drawer would have inerted the drawer along with it — the subtree it was
  // supposed to be the exception to. PanelScrim and PanelDock are portalled for the neighbouring
  // reason (a fixed element is still clipped by an ancestor transform and still confined to an
  // ancestor's stacking context); this one adds a third: a modal surface must not be a descendant of
  // the thing it makes inert.
  return createPortal(
    <div data-filters-drawer="" style={{
      position:"fixed", inset:0, zIndex:Z.DRAWER_SCRIM,
      // `stretch`, not `flex-start`: the panel's height now comes from this container's padding
      // (see FILTER_DRAWER_TOP below), so it must fill the padded box rather than hug its content.
      display:"flex", alignItems:"stretch", justifyContent:"flex-end",
      // The nav clearance lives on the SCRIM as padding, so the dim still covers the full viewport
      // — including behind the top bar — while the panel inside it starts below the nav. A scrim
      // that stopped at the nav would leave an undimmed strip across the top of a modal surface.
      padding:`${FILTER_DRAWER_TOP} 0 ${FILTER_DRAWER_BOTTOM}px`,
      background:C.SCRIM,
      isolation:"isolate",
    }}
    onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ x:360 }} animate={{ x:0 }} exit={{ x:360 }}
        transition={{ type:"tween", duration:0.22 }}
        style={{
          width:320, height:"100%", zIndex:Z.DRAWER,
          background:theme.modalSurface || C.SURFACE_MODAL,
          borderLeft:`3px solid ${theme.accent}`,
          padding:"24px 20px", overflowY:"auto",
          display:"flex", flexDirection:"column", gap:16,
          boxShadow:theme.shadowXl || C.SHADOW_SM,
        }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:"var(--font-display)", fontWeight:400,
                          fontSize:ts(26)}}>
            Filters
          </span>
          {/* A real hit target. With no padding this was the width of the glyph alone — measured at
              9x27px, under the 24x24 minimum, and easy to miss even once it stopped being covered
              by the nav. Square, centred, and the same 6px radius the drawer's other controls use.
              `aria-label` because "x" is not a name. */}
          <button onClick={onClose} aria-label="Close filters" title="Close filters"
            style={{ width:28, height:28, flexShrink:0, borderRadius:6,
                     display:"flex", alignItems:"center", justifyContent:"center",
                     background:"none", border:"none",
                     cursor:"pointer", fontSize:ts(18), lineHeight:1, color:theme.textMuted,
                     transition:"background 0.15s, color 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = theme.surfaceHigh || C.HOVER;
                                 e.currentTarget.style.color = theme.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none";
                                 e.currentTarget.style.color = theme.textMuted; }}>x</button>
        </div>

        {/* ── Quick filters and saved searches ──────────────────────────────────────────
            Both moved here from the control row that W4 removes. "New in 24h" toggles the STAGED
            ageFilter, like every other control in this panel, so it now takes effect on Apply
            rather than instantly — that is the panel's staging model, not a change to the filter.
            The saved-search trio keeps its own semantics exactly: Save captures the currently
            COMMITTED filter set (buildParams' querystring), which is what is on screen, not the
            edits being staged above it. */}
        <div>
          <div style={labelStyle}>Quick</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            <button className="dbx-depth" type="button"
              onClick={() => setAgeFilter(ageFilter === "1d" ? "" : "1d")}
              title="Show only jobs posted in the last 24 hours"
              style={{
                padding:"6px 12px", fontSize:ts(11), fontWeight:700, cursor:"pointer",
                border:`1px solid ${ageFilter === "1d" ? theme.accent : theme.border}`,
                background: ageFilter === "1d" ? theme.accentMuted : "transparent",
                color: ageFilter === "1d" ? (theme.accentText || theme.text) : theme.textMuted,
                textTransform:"uppercase", letterSpacing:"0.06em",
              }}>
              New in 24h
            </button>
            <button className="dbx-depth" type="button"
              onClick={onSaveSearch}
              disabled={!canSaveSearch}
              title="Save the filter set currently applied to the board"
              style={{
                padding:"6px 12px", fontSize:ts(11), fontWeight:700,
                border:`1px solid ${theme.border}`, background:"transparent",
                color: canSaveSearch ? theme.text : theme.textDim,
                cursor: canSaveSearch ? "pointer" : "not-allowed",
                opacity: canSaveSearch ? 1 : 0.5,
              }}>
              Save Search
            </button>
          </div>
          {trackedSearch && (
            <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:6 }}>
              <button className="dbx-depth" type="button" onClick={onApplySearch}
                title={trackedSearch.name || "Apply saved search"}
                style={{
                  flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  padding:"5px 12px", fontSize:ts(11), fontWeight:700, cursor:"pointer",
                  border:`1px solid ${theme.accent}`, background:theme.accentMuted || theme.surface,
                  color:theme.accentText || theme.text,
                }}>
                {trackedSearch.name || "Saved Search"}
              </button>
              <button type="button" onClick={onClearSearch} title="Remove saved search"
                aria-label="Remove saved search"
                style={{
                  width:22, height:22, borderRadius:"50%", border:`1px solid ${theme.border}`,
                  background:"transparent", color:theme.textMuted, cursor:"pointer",
                  fontSize:ts(12), lineHeight:1, flexShrink:0,
                }}>
                x
              </button>
            </div>
          )}
        </div>

        <div>
          <div style={labelStyle}>Role</div>
          <input value={role} onChange={e=>setRole(e.target.value)}
            placeholder="e.g. Software Engineer"
            style={{...selStyle, padding:"0 10px", height:36, borderRadius:4}}/>
        </div>

        {/* D29/D30: no free-text Location here. It was `sj.location LIKE %x%` — "IN" matched
            Washington, "CA" matched Canada (D27) — and location is now the sentence's LOCATION dial,
            over the board's own place tags. The `location` param is still honoured server-side
            (resolved into the place vocabulary), so saved searches that carry it still work. */}

        {/* Work Type (sj.work_type) removed: no write path populates that column — it is absent
            from aggregator's upsertStmt, the single writer shared by cacheJobs, cacheJoboFeed and
            importJob — so the control could never change the result set. "Work Model" below filters
            sj.workplace_type, which enrichment DOES populate (remote/hybrid/onsite all non-zero on
            a real board), and covers the same intent. The workType PARAM is still honoured by
            /api/jobs, soft-null, so saved searches and API callers are unaffected. */}

        <div>
          <div style={labelStyle}>Employment Type</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {EMP_TYPE_OPTIONS.map(opt => {
              const active = employmentTypePrefs.includes(opt.value);
              return (
                <button className="dbx-depth" key={opt.value}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? employmentTypePrefs.filter(v => v !== opt.value)
                      : [...employmentTypePrefs, opt.value];
                    // Always keep at least one selected
                    if (next.length > 0) setEmploymentTypePrefs(next);
                  }}
                  style={{
                    padding:"5px 12px", fontSize:ts(11), fontWeight:600,
                    cursor:"pointer", border:`1px solid ${active ? theme.accent : theme.border}`,
                    background: active ? theme.accentMuted : "transparent",
                    color: active ? theme.accentText : theme.textMuted,
                    transition:"all 0.15s",
                  }}>
                  {withCount(opt.label, countFor("employment_type", opt.value))}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={labelStyle}>Work Model</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {WORK_MODEL_OPTIONS.map(opt => {
              const active = workModels.includes(opt.value);
              return (
                <button className="dbx-depth" key={opt.value}
                  type="button"
                  onClick={() => setWorkModels(active
                    ? workModels.filter(v => v !== opt.value)
                    : [...workModels, opt.value])}
                  style={{
                    padding:"5px 12px", fontSize:ts(11), fontWeight:600,
                    cursor:"pointer", border:`1px solid ${active ? theme.accent : theme.border}`,
                    background: active ? theme.accentMuted : "transparent",
                    color: active ? theme.accentText : theme.textMuted,
                    transition:"all 0.15s",
                  }}>
                  {withCount(opt.label, countFor("work_model", opt.value))}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize:ts(10), color:theme.textDim, marginTop:4 }}>
            Remote / hybrid / onsite as tagged by enrichment. Postings not yet tagged are kept
            rather than hidden, so coverage may lag for very recently-crawled jobs.
          </div>
        </div>

        <div>
          <div style={labelStyle}>Experience Level</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {EXPERIENCE_LEVEL_OPTIONS.map(opt => {
              const active = experienceLevels.includes(opt.value);
              return (
                <button className="dbx-depth" key={opt.value}
                  type="button"
                  onClick={() => setExperienceLevels(active
                    ? experienceLevels.filter(v => v !== opt.value)
                    : [...experienceLevels, opt.value])}
                  style={{
                    padding:"5px 12px", fontSize:ts(11), fontWeight:600,
                    cursor:"pointer", border:`1px solid ${active ? theme.accent : theme.border}`,
                    background: active ? theme.accentMuted : "transparent",
                    color: active ? theme.accentText : theme.textMuted,
                    transition:"all 0.15s",
                  }}>
                  {withCount(opt.label, countFor("experience_level", opt.value))}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize:ts(10), color:theme.textDim, marginTop:4 }}>
            Selecting any level here overrides your profile's derived default for this search.
          </div>
        </div>

        {/* Category removed for two independent reasons, either of which is fatal: sj.category is
            not in aggregator's upsertStmt so nothing can write it, AND the options came from
            /api/categories — a hardcoded marketing taxonomy ("Fintech / Banking", "Design / UX")
            whose strings never matched that column's vocabulary even in principle. A domain filter
            worth having would read sj.bucket_domain, which IS written (from classifyJob's
            detectDomain); that is a separate piece of work, not a rename of this one. The category
            param stays honoured server-side. */}

        {/* Legacy Source select removed. Unlike the others here its COLUMN is fine — sj.source is
            written by every path — but its two options were "linkedin" and "indeed", and neither is
            a value any current writer produces (the live sources are greenhouse/lever/ashby/
            workday/smartrecruiters/workable/recruitee/jobo). So both choices returned 0 rows while
            "All sources" was a no-op: dead by vocabulary rather than by NULL. "Provider" directly
            below is the same filter done properly — real source values, live facet counts, and an
            exclude direction. The source param stays honoured server-side as a hard match. */}

        {/* D26: the PROVIDER filter left the user surface. Which ATS a posting was crawled from is an
            admin concept — a candidate does not care, and showing it invited the same misreading as
            "Not linked". The sources_include/_exclude params are still honoured server-side, so an
            admin view or an API caller can still narrow by provider. */}

        <div>
          <div style={labelStyle}>Automation Tier</div>
          <IncludeExcludeRow
            options={TIER_OPTIONS}
            dimension="automation_tier"
            included={tiersInclude} setIncluded={setTiersInclude}
            excluded={tiersExclude} setExcluded={setTiersExclude}
          />
          <div style={{ fontSize:ts(10), color:theme.textDim, marginTop:4 }}>
            What the apply page will ask of you. <strong>Unknown</strong> means we have not
            established it — those postings may apply cleanly or may need an account, and are
            neither promised nor ruled out.
          </div>
        </div>

        <div>
          <div style={labelStyle}>Date Posted</div>
          {/* Rendered from POSTING_AGE, which also owns the days each key means — so the option
              the user picks and the `posted_after` timestamp derived from it cannot disagree. */}
          <select value={ageFilter} onChange={e=>setAgeFilter(e.target.value)} style={selStyle}>
            {POSTING_AGE.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Years of Experience removed: sj.min_years_exp has no writer at all — not in the upsert,
            not in enrichment — so both inputs were no-ops. server.js's own sort comment already
            records this ("nothing on the ATS crawl path ever writes it"). "Experience Level" above
            expresses the same intent over sj.experience_level, which enrichment does populate
            (intern/mid/senior/lead all non-zero). The YoE SORT is unaffected: it already ranks by
            experience_level when min_years_exp is null. minYoe/maxYoe stay honoured server-side,
            soft-null, including the profile-derived default. */}

        {/* Max Applicants removed: sj.applicant_count has no writer either. It was fed by the
            LinkedIn bulk saved-jobs import, which cleanup 5.3 deleted outright — so the column is
            orphaned from a feature that no longer exists, and no ATS board exposes an applicant
            count. The param stays honoured server-side, soft-null. */}

        <div>
          <div style={labelStyle}>Status</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <select value={visitedFilter} onChange={e=>setVisitedFilter(e.target.value)} style={selStyle}>
              {VISITED.options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div style={labelStyle}>Salary Range (USD)</div>
          <div style={{ display:"flex", gap:6 }}>
            <input type="number" min={0} placeholder="$60000"
              value={salaryMin} onChange={e=>setSalaryMin(e.target.value)}
              style={{...selStyle, flex:1}}/>
            <input type="number" min={0} placeholder="$200000"
              value={salaryMax} onChange={e=>setSalaryMax(e.target.value)}
              style={{...selStyle, flex:1}}/>
          </div>
          <div style={{ fontSize:ts(10), color:theme.textDim, marginTop:4 }}>
            Matches jobs whose posted range overlaps this window — postings with no
            salary data are excluded once either bound is set.
          </div>
        </div>

        <div>
          <div style={labelStyle}>Skills (must include)</div>
          <div style={{ display:"flex", gap:6 }}>
            <input value={skillDraft} onChange={e=>setSkillDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = skillDraft.trim();
                if (v && !skillsInclude.some(s => s.toLowerCase() === v.toLowerCase())) {
                  setSkillsInclude([...skillsInclude, v]);
                }
                setSkillDraft("");
              }}
              placeholder="e.g. React, SQL"
              style={{...selStyle, flex:1}}/>
            <LucyBtn onClick={() => {
              const v = skillDraft.trim();
              if (v && !skillsInclude.some(s => s.toLowerCase() === v.toLowerCase())) {
                setSkillsInclude([...skillsInclude, v]);
              }
              setSkillDraft("");
            }}>Add</LucyBtn>
          </div>
          {skillsInclude.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
              {skillsInclude.map(skill => (
                <button className="dbx-depth" key={skill} type="button" onClick={() => setSkillsInclude(skillsInclude.filter(s => s !== skill))}
                  style={{
                    padding:"4px 10px", fontSize:ts(11), fontWeight:600,
                    cursor:"pointer", border:`1px solid ${theme.accent}`,
                    background:theme.accentMuted, color:theme.accentText,
                  }}>
                  {skill} ×
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <button type="button" onClick={() => setSponsorFriendly(!sponsorFriendly)}
            style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              padding:"8px 10px", borderRadius:4, cursor:"pointer",
              border:`1px solid ${sponsorFriendly ? theme.accent : theme.border}`,
              background: sponsorFriendly ? theme.accentMuted : "transparent",
              color: sponsorFriendly ? theme.accentText : theme.text,
            }}>
            <span style={{
              width:16, height:16, borderRadius:3, flexShrink:0,
              border:`1px solid ${sponsorFriendly ? theme.accent : theme.border}`,
              background: sponsorFriendly ? theme.accent : "transparent",
            }}/>
            <span style={{ fontSize:ts(12), fontWeight:600 }}>Sponsor-friendly only</span>
          </button>
        </div>

        {/* X3: the COMPANY-level filter, deliberately a second control rather than a mode of the one
            above. That one reads what the POSTING said about work authorisation; this reads what the
            EMPLOYER filed with the Department of Labor. Two claims from two sources, and collapsing
            them into one tickbox would make it impossible to say which one hid a job.

            The label says what it DOES — hides companies with no filings — not "sponsors only". The
            filter cannot confirm that a company sponsors, and a label promising that would be the
            exact overclaim the company view's copy is written to avoid. */}
        <div>
          <button type="button" onClick={() => setCompanySponsors(companySponsors === "1" ? "" : "1")}
            style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              padding:"8px 10px", borderRadius:4, cursor:"pointer",
              border:`1px solid ${companySponsors === "1" ? theme.accent : theme.border}`,
              background: companySponsors === "1" ? theme.accentMuted : "transparent",
              color: companySponsors === "1" ? theme.accentText : theme.text,
            }}>
            <span style={{
              width:16, height:16, borderRadius:3, flexShrink:0,
              border:`1px solid ${companySponsors === "1" ? theme.accent : theme.border}`,
              background: companySponsors === "1" ? theme.accent : "transparent",
            }}/>
            <span style={{ fontSize:ts(12), fontWeight:600 }}>Hide employers with no H-1B filings</span>
          </button>
          <div style={{ fontSize:ts(10), color:theme.textMuted, marginTop:5, lineHeight:1.45 }}>
            From the US government's visa sponsorship records. Hides only employers we're sure filed none
            lately; a company we couldn't identify stays.
          </div>
        </div>

        {/* ⛔ D59 (owner, 10-07): the posting's OWN stated requirements — U.S. citizenship, U.S.-person
            (export control), a security clearance or a polygraph. It reads what the POSTING says; it never
            reads or decides the user's eligibility. A posting not yet read is kept. */}
        <div data-filter="eligibility">
          <button type="button" aria-pressed={!!hideEligibility} onClick={() => setHideEligibility(!hideEligibility)}
            style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              padding:"8px 10px", borderRadius:4, cursor:"pointer",
              border:`1px solid ${hideEligibility ? theme.accent : theme.border}`,
              background: hideEligibility ? theme.accentMuted : "transparent",
              color: hideEligibility ? theme.accentText : theme.text,
            }}>
            <span style={{
              width:16, height:16, borderRadius:3, flexShrink:0,
              border:`1px solid ${hideEligibility ? theme.accent : theme.border}`,
              background: hideEligibility ? theme.accent : "transparent",
            }}/>
            <span style={{ fontSize:ts(12), fontWeight:600 }}>Hide roles that require clearance or citizenship</span>
          </button>
          <div style={{ fontSize:ts(10), color:theme.textMuted, marginTop:5, lineHeight:1.45 }}>
            Hides jobs that ask for U.S. citizenship, U.S.-person status, a security clearance or a polygraph,
            read from the job's own words. Jobs we haven't read yet stay.
          </div>
        </div>

        {/* ⭐ D106 (owner, 10-30): "seniorised" entry-level roles — a junior title over a mid-level ask. This keeps
            only postings whose TEXT asks for entry or early level (years, system design, leading others…), or
            that ask nothing that says a level and are titled entry. */}
        <div data-filter="truly-entry">
          <button type="button" aria-pressed={!!trulyEntry} onClick={() => setTrulyEntry(!trulyEntry)}
            style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              padding:"8px 10px", borderRadius:4, cursor:"pointer",
              border:`1px solid ${trulyEntry ? theme.accent : theme.border}`,
              background: trulyEntry ? theme.accentMuted : "transparent",
              color: trulyEntry ? theme.accentText : theme.text,
            }}>
            <span style={{
              width:16, height:16, borderRadius:3, flexShrink:0,
              border:`1px solid ${trulyEntry ? theme.accent : theme.border}`,
              background: trulyEntry ? theme.accent : "transparent",
            }}/>
            <span style={{ fontSize:ts(12), fontWeight:600 }}>Truly entry level</span>
          </button>
          <div style={{ fontSize:ts(10), color:theme.textMuted, marginTop:5, lineHeight:1.45 }}>
            Leaves out postings titled junior or entry that ask for 3+ years, system design or leading others.
            Read from the posting's own words.
          </div>
        </div>

        {/* ⭐ D137 (owner, 11-02): THE GHOST SCORE. Off by default — a posting is only ever RANKED DOWN by its score;
            this leaves out the ones scored Likely not hiring, for a user who asks. A posting gone from the company's
            own site is already off the board. */}
        <div data-filter="hide-ghost">
          <button type="button" aria-pressed={!!hideGhost} onClick={() => setHideGhost(!hideGhost)}
            style={{
              display:"flex", alignItems:"center", gap:8, width:"100%",
              padding:"8px 10px", borderRadius:4, cursor:"pointer",
              border:`1px solid ${hideGhost ? theme.accent : theme.border}`,
              background: hideGhost ? theme.accentMuted : "transparent",
              color: hideGhost ? theme.accentText : theme.text,
            }}>
            <span style={{
              width:16, height:16, borderRadius:3, flexShrink:0,
              border:`1px solid ${hideGhost ? theme.accent : theme.border}`,
              background: hideGhost ? theme.accent : "transparent",
            }}/>
            <span style={{ fontSize:ts(12), fontWeight:600 }}>Hide likely not hiring</span>
          </button>
          <div style={{ fontSize:ts(10), color:theme.textMuted, marginTop:5, lineHeight:1.45 }}>
            Leaves out jobs that look like no one is hiring: a talent-pool title, many reposts, months open.
            Each one shows its reasons; turned off, they stay at the end of the board.
          </div>
        </div>

        {/* D42 (owner, 10-06): THE COMPANY'S SECTOR — a different thing from the job's domain, which is
            the sentence's first word. "A finance job at OpenAI is more of a finance job the user cares
            about than an SDE role at Fidelity": domain is the work, sector is the employer. Read from
            the company name (shared/companySectors.js), never guessed from a posting's words; a company
            with no sector on file is kept, after the known matches. */}
        <div data-filter="sectors">
          <div style={labelStyle}>Company sector</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {SECTORS.options.map(opt => {
              const active = sectors.includes(opt.value);
              return (
                <button className="dbx-depth" key={opt.value} type="button" aria-pressed={active}
                  onClick={() => setSectors(active ? sectors.filter(v => v !== opt.value) : [...sectors, opt.value])}
                  style={{
                    padding:"5px 12px", fontSize:ts(11), fontWeight:600,
                    cursor:"pointer", border:`1px solid ${active ? theme.accent : theme.border}`,
                    background: active ? theme.accentMuted : "transparent",
                    color: active ? theme.accentText : theme.textMuted,
                    transition:"all 0.15s",
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize:ts(10), color:theme.textDim, marginTop:4 }}>
            The employer's industry, not the kind of work (pick that in the sentence above). Companies
            whose industry we don't know are kept, after the rest.
          </div>
        </div>

        <div style={{ display:"flex", gap:8, paddingTop:8 }}>
          <LucyBtn onClick={onReset} accent={theme.surfaceHigh} style={{ flex:1 }}>
            Reset All
          </LucyBtn>
          <LucyBtn onClick={onApply} style={{ flex:1 }}>
            Apply
          </LucyBtn>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// -- Aliases (mirrors server normaliser) -----------------------
const ALIASES = Object.fromEntries(
  Object.entries(ROLE_ALIAS_MAP).map(([alias, entry]) => [alias, entry.canonical])
);

const ROLE_FAMILY_DOMAIN_FALLBACK = {
  data: "data",
  pm: "pm_general",
  finance: "finance",
  marketing: "marketing",
  hr: "hr",
  design: "design",
  legal: "legal",
  operations: "operations",
};

function intentDomainForAlias(entry) {
  if (!entry) return "general";
  if (entry.domain && entry.domain !== "it_digital") return entry.domain;
  if (entry.roleFamily === "general" && entry.domain) return entry.domain;
  return ROLE_FAMILY_DOMAIN_FALLBACK[entry.roleFamily] || entry.roleFamily || "general";
}

function mergeIntentTerms(baseIntents) {
  const byDomain = new Map(baseIntents.map(intent => [intent.domainKey, { ...intent, terms: [...intent.terms] }]));
  for (const [alias, entry] of Object.entries(ROLE_ALIAS_MAP)) {
    const domainKey = intentDomainForAlias(entry);
    const current = byDomain.get(domainKey) || {
      domainKey,
      label: entry.roleFamily ? `${entry.roleFamily[0].toUpperCase()}${entry.roleFamily.slice(1)} Roles` : "Supported Roles",
      terms: [],
    };
    current.terms.push(alias, entry.canonical, ...(entry.searchVariants || []));
    byDomain.set(domainKey, current);
  }
  return [...byDomain.values()].map(intent => ({
    ...intent,
    terms: [...new Set(intent.terms.map(normaliseIntentText).filter(Boolean))],
  }));
}

// Search/profile intent guard:
// /api/scrape normalises the typed query, but the outbound provider call uses
// the active domain profile's target_titles. Strong cross-profile signals are
// intercepted here so searches run under the intended profile only after user
// confirmation.
const BASE_SEARCH_PROFILE_INTENTS = [
  {
    domainKey: "engineering_embedded_firmware",
    label: "Firmware, Embedded & Device Software",
    terms: [
      "firmware", "embedded", "embedded software", "embedded systems",
      "bsp", "board support", "rtos", "device driver", "driver engineer",
      "soc bring-up", "chip bring-up", "post-silicon", "hardware debug",
    ],
  },
  {
    domainKey: "engineering_systems_low_level",
    label: "Systems, Platform & Performance Engineering",
    terms: [
      "kernel", "compiler", "operating systems", "systems software",
      "performance engineer", "platform software", "linux kernel",
    ],
  },
  {
    domainKey: "data",
    label: "Data Science & Analytics",
    terms: [
      "data scientist", "data analyst", "machine learning", "ml engineer",
      "analytics engineer", "research scientist", "business intelligence",
    ],
  },
  {
    domainKey: "pm_general",
    label: "Product Management",
    terms: [
      "product manager", "technical product manager", "associate product manager",
      "group product manager", "director of product",
    ],
  },
  {
    domainKey: "pm_it",
    label: "IT / Technical Program Management",
    terms: [
      "technical program manager", "program manager", "scrum master",
      "delivery manager", "release manager", "pmo",
    ],
  },
  {
    domainKey: "finance",
    label: "Finance & Accounting",
    terms: ["financial analyst", "fp&a", "investment banking", "credit analyst", "controller"],
  },
  {
    domainKey: "marketing",
    label: "Marketing & Growth",
    terms: ["marketing manager", "growth manager", "seo manager", "demand generation"],
  },
  {
    domainKey: "design",
    label: "Design & UX",
    terms: ["ux designer", "product designer", "ui/ux", "ux researcher"],
  },
];

const SEARCH_PROFILE_INTENTS = mergeIntentTerms(BASE_SEARCH_PROFILE_INTENTS);

function normaliseIntentText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+]+/g, " ").replace(/\s+/g, " ").trim();
}

function profileMatchesIntent(profile, intent) {
  if (!profile || !intent) return false;
  if (profile.domain === intent.domainKey) return true;
  const titles = Array.isArray(profile.target_titles) ? profile.target_titles : [];
  const haystack = normaliseIntentText([
    profile.profile_name,
    profile.domain,
    profile.role_family,
    ...titles,
  ].join(" "));
  return intent.terms.some(term => haystack.includes(normaliseIntentText(term)));
}

function detectSearchProfileIntent(query, profiles, activeProfile) {
  const text = normaliseIntentText(ALIASES[query.trim().toLowerCase()] || query);
  if (!text || text.split(" ").length > 8) return null;
  const intent = SEARCH_PROFILE_INTENTS.find(candidate =>
    candidate.terms.some(term => {
      const t = normaliseIntentText(term);
      return text === t || text.includes(t);
    })
  );
  if (!intent || profileMatchesIntent(activeProfile, intent)) return null;
  const existingProfile = (profiles || []).find(profile => profileMatchesIntent(profile, intent));
  return { ...intent, existingProfile };
}

// -- Pull-to-refresh -------------------------------------------
function PullToRefresh({ onRefresh, refreshing, theme, children }) {
  const scrollRef = useRef(null);
  const { scrollToTopRef } = useAppScroll();
  const [pullY,   setPullY]   = useState(0);
  const [ready,   setReady]   = useState(false);
  const startY = useRef(null);
  const THRESHOLD = 56;

  // Register scroll-to-top fn so goPage can scroll this container, not window
  useEffect(() => {
    scrollToTopRef.current = () => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    };
    return () => { scrollToTopRef.current = null; };
  }, [scrollToTopRef]);

  // Touch: pull-down gesture when already at the top
  const onTouchStart = (e) => {
    if ((scrollRef.current?.scrollTop ?? 1) === 0)
      startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullY(Math.min(dy * 0.55, THRESHOLD + 20));
      setReady(dy * 0.55 >= THRESHOLD);
    }
  };
  const onTouchEnd = () => {
    if (ready) onRefresh();
    setPullY(0); setReady(false); startY.current = null;
  };

  // Desktop: expose the scrollRef so parent can detect wheel-at-top if needed
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Pull indicator — animates down then snaps back */}
      <div style={{
        height: pullY, flexShrink:0, overflow:"hidden",
        display:"flex", alignItems:"center", justifyContent:"center",
        background: theme.accentMuted,
        transition: pullY === 0 ? "height 0.22s ease" : "none",
      }}>
        {pullY > 12 && (
          <span style={{ fontSize:ts(11), fontWeight:700, color:theme.accentText }}>
            {ready ? "? Release to refresh" : "? Keep pulling…"}
          </span>
        )}
      </div>

      {/* A74 (owner, 10-03): the "CHECK FOR NEW JOBS" strip is removed — there is no live scraping to check. */}

      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ flex:1, overflowY:"auto", paddingTop:4, paddingBottom:8 }}>
        {children}
      </div>
    </div>
  );
}



// DEFAULT SIZES (canonical, do not edit inline):
// The percentage-split rules that used to be documented here (A=100 alone, A=30 with one panel,
// A=6 with two or more, plus a bonus for the resume column) described getPanelDefaults, which is
// gone: the PDF and ATS surfaces are popup panels rendered through PanelShell, so the board is the
// only column left and simply keeps the full width. Panel widths are per-type, dragged on the panel
// and persisted across sessions by PanelShell.
// -- Card tier — driven by open-panel count, not pixel width ------
// Still driven by how many panels are open, which is still what decides how much room the board's
// cards have — the panels overlay it now rather than taking columns from it, so a wide panel over a
// narrow board is the same legibility problem it always was.
// Tier 1 (full layout):  board alone, or board + one panel
// Tier 3 (condensed):    board + two panels (the side-by-side maximum)
// Tier 2 (medium):       only reached by manual drag — ResizeObserver overrides Tier 1 -> 2 when
//                        the board is dragged to 180-279px. Tier 3 always wins over pixels.
function getCardTier(panelBVisible, panelCVisible, panelDVisible) {
  const extraPanels = [panelBVisible, panelCVisible, panelDVisible].filter(Boolean).length;
  if (extraPanels === 0) return 1; // A only — full width
  if (extraPanels === 1) return 1; // A+B — still 30%, full layout
  return 3;                        // A+B+C or A+B+C+D — 6%, condensed
}

// getPanelDefaults removed — see the note where the rebalancing effect used to be.

/**
 * ⭐ D58 · ONE READ OF THE SCORE, for every surface on this board: the card badge, the posting header's box
 * and the ATS card all ask this, with the same stored pair — the tailored score written on the résumé at
 * generation, and the base (the pair's own base when one was stored with it, else the board's stored base).
 */
export function scoresFor(job, artifact = null) {
  const a = artifact ? getActiveArtifact(artifact, artifact.activeTool || artifact.tool) : null;
  return atsScorePair({
    base: a?.baseAtsScore ?? artifact?.baseAtsScore ?? job?.baseAtsScore ?? job?.matchScore ?? null,
    tailored: a?.html ? (a.atsScore ?? null) : null,
  });
}

function buildAtsPayload(job, artifact = null) {
  const activeArtifact = artifact ? getActiveArtifact(artifact, artifact.activeTool || artifact.tool) : null;
  const pair = scoresFor(job, artifact);
  const score = activeArtifact?.atsScore
    ?? job?.atsScore
    ?? job?.resumeAtsScore
    ?? job?.baseAtsScore
    ?? null;
  const report = activeArtifact?.atsReport
    ?? job?.atsReport
    ?? job?.resumeAtsReport
    ?? job?.baseAtsReport
    ?? job?.ats_report
    ?? null;
  return {
    score,
    report,
    // ⛔ CC5 · THE PAYLOAD CARRIES ITS OWN JOB ID, and without it the empty-payload route above
    // cannot work. AtsReportPanel used to take the job to fetch from `selectedJob`, which is the
    // JD panel's state and has nothing to do with which report is on screen: opening a report from
    // a card, or from the history list, left the panel asking the server about whatever job
    // happened to be selected — or about nothing at all, on a board with no selection, which is
    // when a card's chip is clicked. Now the report says which job it is about.
    jobId: job?.jobId || job?.id || null,
    // D58: "Base 58 → tailored 71" — the base score stays in the ATS card, beside the tailored one.
    pair,
    company: activeArtifact?.company || job?.company,
    title: activeArtifact?.title || job?.title || job?.role,
    // D62: the header draws the company's CompanyLogo and its ONE link (D38).
    companyIconUrl: job?.companyIconUrl || null,
    applyUrl: job?.applyUrl || job?.url || null,
  };
}

// -- Main panel ------------------------------------------------
// A126 · the posting-by-id reads in flight / just answered, shared across the deck's repeated asks (see onOpen).
const byIdReads = new Map();

// ⛔ A126 (8) (hotfix 11-05) · THE BOARD'S VIEW CACHE OUTLIVES THE PANEL. It was a useRef inside JobsPanel, so leaving Home
// (Atlas, Profile, the tracker) unmounted the panel and threw the cache away: every return showed skeletons and re-asked
// for the board (owner: "jobs are still rerendering on every nav"). At module scope it lives for the tab; a return
// renders the last answer at once (D45's stale-while-revalidate) and refreshes behind it. Keys carry the profile key.
const BOARD_VIEW_CACHE = new Map();
// A126 (8) · the view last ANSWERED on screen, for the first frame after a return: a remount used to wait for the
// profile list (/api/domain-profiles) before it could read the cache — measured 1.4 s of skeletons on the copy. The new
// mount starts from this (cards, totals, being-matched line) and the refetch replaces it behind; a different profile's
// board never starts from it (applyProfileSnapshot checks the profile key).
let BOARD_LAST = null;   // { key, profileKey, jobs, total, totalPages, beingMatched }
export default function JobsPanel({ user, onUserChange, refreshKey = 0, isActive = true }) {
  const monetisationEnabled = useMonetisationEnabled();
  const { theme } = useTheme();
  const { mode: vpMode, w: vpWidth } = useViewport();
  const navigate = useNavigate();
  const { scrollToTopRef } = useAppScroll();
  const isWide     = vpMode === "wide";
  const isMobile   = vpMode === "mobile" || vpMode === "tablet";
  const isPortrait = vpMode === "portrait" || vpMode === "laptop";

  // The mobile pane switch is GONE. It had three values, "jobs" | "editor" | "ats", and only the
  // first still renders anything: the editor and ats panes were deleted when the PDF sandbox and the
  // ATS report became popup panels. Nothing sets it any more (see openSandbox / the bottom nav), so
  // holding it as state would be holding a constant, and reading it would be gating the board on a
  // value that can no longer change. The board is what the mobile branch renders; the panels overlay
  // it full-screen on a narrow viewport, which is usePanelHost's fallback.

  // Tracks jobs disliked in this browser session — survives filter/sort refetches
  // but is cleared on page reload (so server exclusions take effect on next login)
  const sessionDislikedRef = useRef(new Map()); // jobId ? job object

  // Job data
  const [jobs,        setJobs]        = useState(() => BOARD_LAST?.jobs || []);
  const decideJobRef = useRef(null);
  // ⭐ D156 (1c): who opened the posting — "deck" (the front card expanding, or its match) or "board" (a bubble, a deep
  // link). On Home the posting is drawn on the deck either way; a deck card's Pass · Save · Draft are the deck's to make.
  const [postOrigin, setPostOrigin] = useState("board");
  const postOriginRef = useRef("board");
  postOriginRef.current = postOrigin;
  const decidePostingRef = useRef(null);
  const [totalJobs,   setTotalJobs]   = useState(() => BOARD_LAST?.total || 0);
  const [totalPages,  setTotalPages]  = useState(() => BOARD_LAST?.totalPages || 0);
  const [currentPage, setCurrentPage] = useState(1);
  // Profile→Board Bridge disclosure. `curation` is the server's { total, demoted, rankedKeys }
  // block, present ONLY when the bridge actually demoted something; `curateOff` is the user's
  // escape, which sends ?curate=off and turns the ranking off for that request. The bridge used to
  // EXCLUDE on these dimensions, which is how an imported job that WAS present read as missing; it
  // ranks now, so the disclosure is about position rather than about a withheld remainder.
  const [curation,    setCuration]    = useState(null);
  const [curateOff,   setCurateOff]   = useState(false);
  // The server's own word for WHY a board came back empty ('cache_empty' today). Without it the
  // client has to guess, and it guessed wrong: an empty pool rendered as "nothing matches your
  // profile's role", sending the user to change a profile that was never the problem.
  const [boardReason, setBoardReason] = useState(null);
  // The server's structured account of WHY a page came back empty (services/jobs/emptyBoardReason.js).
  // Richer than `boardReason`, which is the older single-string field and is kept for the branches
  // already reading it. Null whenever the board has rows.
  const [emptyReason, setEmptyReason] = useState(null);
  // A126 (7): postings this view would show once matched to the résumé (server: the match queue is scoring them).
  const [beingMatched, setBeingMatched] = useState(() => BOARD_LAST?.beingMatched || 0);
  // ⭐ D151 Rule 4 (11-08): the server stops at 2,000 and says there are more — the line reads "2,000+".
  const [beingMatchedMore, setBeingMatchedMore] = useState(() => !!BOARD_LAST?.beingMatchedMore);

  // UI state
  const [scraping,    setScraping]    = useState(false);  // a live refresh is running
  const [bgLoading,   setBgLoading]   = useState(false);  // background DB fetch
  // ⛔ D45 · LOADING IS NOT EMPTY. `requestedKey` is the view the board last ASKED for, `answeredKey`
  // the one it has an answer for (from the network or the per-view cache). Until they match the
  // board shows skeletons — never the empty state, and never the previous view's cards.
  const [requestedKey, setRequestedKey] = useState(() => BOARD_LAST?.key ?? null);
  const [answeredKey,  setAnsweredKey]  = useState(() => BOARD_LAST?.key ?? null);
  const viewCacheRef = useRef(BOARD_VIEW_CACHE);   // D45 · stale-while-revalidate, per view (lib/boardViewCache.js)
  const requestedKeyRef = useRef(BOARD_LAST?.key ?? null);
  const inFlightRef = useRef(null);
  const [categories,  setCategories]  = useState([]);
  const [resumeText,  setResumeText]  = useState("");
  // ⛔ D156 (6) · "loading" | "ready" | "error" for the active profile's base-résumé read. "Sorting by fit needs this
  // profile's base resume — Add one" only when the read SUCCEEDED and found none: production 11-05 showed it to a user who
  // has one, because a read the blocked server never answered landed in a catch that cleared the text.
  const [resumeState, setResumeState] = useState("loading");
  const [resumeTry, setResumeTry] = useState(0);
  const [fileName,    setFileName]    = useState("");
  const [uploading,   setUploading]   = useState(false);
  const [generated,   setGenerated]   = useState({});
  const [loading,     setLoading]     = useState({});
  // ⭐ D164 (owner 11-05): a FAILED generation, per job — its sentence, kept until the next attempt or a success. Without it
  // the failure lived only in the sandbox and the posting fell back to "Résumé for this job", i.e. read as "no résumé"
  // (D156 6). The posting's Résumé control draws it as "Failed — Try again".
  const [genFailed,   setGenFailed]   = useState({});
  const [sandbox,     setSandbox]     = useState(null);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  // ⭐ D152 (8) (b): the ATS panel drawn OVER the page (AtsReportPanel — its own overlay, scrim and History tab) is
  // RETIRED. Every opener now asks for the match INSIDE the posting, under the facts (ats-options.html option A): a
  // counter per ask, read by JobDetailPanel through selectedJobMeta.matchAsk.
  const [matchAsk, setMatchAsk] = useState(null);

  // Split view — selectedJob lifted to JobBoardContext (must be declared here,
  // before the useMemo at ~line 962 that uses !!selectedJob in its dep array)
  const {
    boardTab, setBoardTab, localSearch, setLocalSearch, sortBy, setSortBy,
    activeProfileId, setActiveProfileId, getProfileCache, setProfileCache, deleteProfileCache,
    selectedJob, setSelectedJob, setSelectedJobMeta,
    barFilters, liveSearchTick,
    filterPanelOpen, setFilterPanelOpen, setActiveFilterCount,
    setAtsSortAvailable, atsSortAvailable,
    setBoardPanel, setBoardHeadline,
  } = useJobBoard();
  // The open posting's id, for callbacks that must not re-bind on every selection (openAtsPanel, D152 (8)).
  const selectedJobIdRef = useRef(null);
  selectedJobIdRef.current = selectedJob?.jobId ?? null;

  // Open / close sandbox — panel size rebalancing handled by useEffect below.
  //
  // NO `setMobilePane` HERE ANY MORE, and that is a fix rather than a tidy-up. These three used to
  // switch the mobile board to the "editor" / "ats" pane, from when those panes rendered the sandbox
  // and the ATS report inline. Both panes were deleted when the surfaces became popup panels, which
  // left the mobile branch rendering JobsColumn for `mobilePane === "jobs"` and NOTHING for the other
  // two values — so the switch pointed at a pane that no longer existed. Observed at 880x700 and
  // 600x900 before this change:
  // pressing Generate opened the panel over a COMPLETELY EMPTY board, and because closeAtsPanel
  // never reset the pane, closing the panels left the board still empty until the user found the
  // bottom-nav "Jobs" button. On a narrow viewport the panel is a full-screen overlay (see
  // usePanelHost's fallback) and the board simply stays where it is underneath it.

  // AH2: the job this tab was OPENED to show, captured at first render.
  //
  // It is read here and never from the URL again, because the sync effect further down rewrites the
  // query string — anything consulting window.location afterwards would be reading this component's
  // own overwrite rather than the address the user arrived on. The reasoning for the whole
  // arrangement is with those effects, near handleJobSelect.
  const deepLinkedJobIdRef = useRef(jobIdFromSearch());
  const [deepLinkedJob, setDeepLinkedJob] = useState(null);
  // Called from every path that legitimately ends the deep-linked selection: the panel's close
  // button, Escape, picking a different card, and a real profile switch. Once it has run, the
  // reconcile effect below stops re-opening the panel and the URL sync is free to drop the param.
  //
  // This is deliberately an EXPLICIT signal rather than a timing guess. The first attempt cleared
  // the ref as soon as it saw the selection match, which raced the profile-cache restore: within
  // the render where activeProfileKey arrives, the restore's setSelectedJob(null) has been queued
  // but this effect's closure still holds the OLD selection, so it saw a match, cleared, and the
  // null landed the next render with nothing left to re-apply it. Intermittently — which is how it
  // passed once and failed the next run on the same build.
  const clearDeepLink = useCallback(() => { deepLinkedJobIdRef.current = null; }, []);

  // ⭐ D157 (option A) + D171 FIX 4: a résumé that is READY opens in the embedded editor (resume-master's tool, a focused
  // full-screen view — components/ResumeEditorHost.jsx); Back / Esc returns here with the posting still open. The
  // panel below keeps what the editor doesn't do: the generating skeleton, a failure, a missing artifact, the company
  // KB's findings to review, and the A+ / Generate switch — and it is the fallback when the editor can't be reached.
  const sandboxSaveRef = useRef(null);
  const sandboxExportRef = useRef(null);
  const openSandbox = useCallback((entry) => {
    setSandbox(entry);
    const active = getActiveArtifact(entry);
    const panelOnly = !active?.html || entry?.generating || entry?.error || entry?.missing
      || active?.kbFindings?.length > 0 || Object.keys(entry?.variants || {}).length > 1;
    if (panelOnly) { setSandboxOpen(true); return; }
    setSandboxOpen(false);
    openResumeEditor({
      html: cleanDocHtml(active.html), jobId: active.jobId || entry.jobId, company: active.company || entry.company,
      title: active.title || entry.title, tool: active.tool, version: active.version,
      onSave: (html) => sandboxSaveRef.current?.(html, active),
      onExport: (html) => sandboxExportRef.current?.(null, html, active.company, active),
      fallback: () => setSandboxOpen(true),
    });
  }, []);

  const closeSandbox = useCallback(() => {
    setSandboxOpen(false);
  }, []);

  // ⭐ D152 (8) (b): open THE MATCH IN THE POSTING. `job` — when the caller holds it and it is not the one open — is
  // selected first, so the posting the report is about is the one on screen; with neither, the open posting's.
  const openAtsPanel = useCallback((atsData, job = null) => {
    if (atsData) setActiveAts(atsData);
    if (job && selectedJobIdRef.current !== job.jobId) setSelectedJob(job);
    const id = job?.jobId ?? atsData?.jobId ?? selectedJobIdRef.current ?? null;
    setMatchAsk(prev => ({ jobId: id, n: (prev?.n || 0) + 1 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ⛔ A52 · ONE SCORING READ PER SCREEN. When the ATS panel has scored a posting itself, its verdict
  // becomes the board's for that posting — on the card, the JD header and the panel's own header —
  // until the next board load reads the (by then re-scored) stored value. Before this the card and
  // the JD header kept the stored score they were loaded with while the panel, open beside them,
  // showed a fresh one: "No signal" next to "Strong match". A generated résumé's report is about a
  // different résumé and is never adopted as the base verdict.
  const adoptPanelVerdict = useCallback((jobId, report) => {
    if (!jobId || !report || report.report_basis === "generated_resume") return;
    if (!String(report.source || "").startsWith("local_ats")) return;
    const score = report.score ?? null;
    const patch = (j) => (j && j.jobId === jobId ? { ...j, baseAtsScore: score } : j);
    setJobs(prev => prev.map(patch));
    setSelectedJob(prev => patch(prev));
    setActiveAts(prev => (prev && prev.jobId === jobId && !prev.report ? { ...prev, score } : prev));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── The panel host ──────────────────────────────────────────────────────────────────────────
  // ⭐ D152 (8): ATS is no longer one of them — the match opens inside the posting. What follows is the history of the
  // three-peer order, kept for why PDF outranks JD.
  // JD, PDF and ATS are peers in one ordered set. The host does not own their open/closed state —
  // that still lives where it always did (selectedJob in JobBoardContext, sandboxOpen here; the
  // match's own state moved into the posting with D152 (8)), set by the same call sites, including the generate flow's
  // own openSandbox(). It observes them, orders them by focus, tiles them, and evicts the least
  // recently focused when one more opens than will fit. See hooks/usePanelHost.js for why eviction
  // rather than refusal.
  //
  // THE ORDER OF THIS ARRAY IS A PRIORITY, later = higher, and the host reads it when only ONE
  // panel fits (see the eviction note in hooks/usePanelHost.js). Seven call sites open the PDF
  // sandbox and the ATS report together — the generate flow, the reuse flow, the cached-artifact
  // flow, the card's eye button, the JD panel's Regen and Preview, the history list — and at
  // capacity 1 exactly one of them can be on screen. Which one was previously decided by whichever
  // setState ran first, which for the generate flow meant the sandbox (opened immediately as a
  // skeleton) lost its slot to the report that arrived with the response seconds later.
  //
  // [jd, ats, pdf]: the resume outranks its report, which outranks the job description it was
  // generated from. Above capacity 1 nothing here applies — eviction is still by focus recency —
  // and JD open on its own is unaffected either way.
  // ⭐ D149 (owner 11-03, fullhouse-declutter.html) · THE POSTING OPENS BESIDE THE LIST on a desktop — the sketch's
  // `.fhl` grid (list | posting, 1fr : 1.05fr) with the posting held at the top of the window while the list scrolls,
  // no scrim, the list still live (another row opens in its place). So the JD panel leaves the overlay host there and
  // is drawn ON THE DECK in the front card's place (⭐ D156 (1c), DeckView's slot — it was D152 (6)'s posting in place of the list); the PDF stays an overlay peer (⭐ D152 (8): the ATS report is no longer one — it opens inside the posting). At
  // ≤ 1000px (the sketch's breakpoint) it is the full-screen overlay as before.
  // ⭐ D156 (1c): ON THE DECK — the deck's slot (DeckView renders it on Home, an earlier sibling, so it is in the document
  // by the time a posting opens). Without a deck on screen the posting is the overlay, as on a phone.
  const deckSlot = typeof document !== "undefined" ? document.getElementById(DECK_POST_SLOT_ID) : null;
  const besideMode = !!selectedJob && vpWidth > BESIDE_MIN_VIEWPORT && !!deckSlot;
  // …and the deck is told which posting it is showing, so it folds its card into it (and out again).
  const postOnDeckId = besideMode ? String(selectedJob?.jobId ?? "") || null : null;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(POSTING_ON_DECK_EVENT, { detail: { jobId: postOnDeckId, origin: postOrigin } }));
  }, [postOnDeckId, postOrigin]);
  useEffect(() => () => window.dispatchEvent(new CustomEvent(POSTING_ON_DECK_EVENT, { detail: { jobId: null } })), []);
  // ⭐ D168 · THE SWAP's outgoing half: the posting DRAWN on the deck lags a change AWAY from the one shown by POST_FADE_MS,
  // so a folding (or replaced) posting fades out with its own content while DeckView runs the swap; opening one onto the
  // deck, or the same posting updating, is drawn at once.
  const deckPostTarget = besideMode ? selectedJob : null;
  const [deckPostJob, setDeckPostJob] = useState(null);
  const deckPostJobRef = useRef(null);
  deckPostJobRef.current = deckPostJob;
  useLayoutEffect(() => {
    const cur = deckPostJobRef.current;
    if (!cur || (deckPostTarget && String(deckPostTarget.jobId) === String(cur.jobId))) { setDeckPostJob(deckPostTarget); return undefined; }
    const t = setTimeout(() => setDeckPostJob(deckPostTarget), POST_FADE_MS);
    return () => clearTimeout(t);
  }, [deckPostTarget]);
  const panelDescriptors = useMemo(() => ([
    { id: "jd",  open: !!selectedJob && !besideMode, close: () => { clearDeepLink(); setSelectedJob(null); } },
    { id: "pdf", open: sandboxOpen,     close: () => { setSandboxOpen(false); setSandbox(null); } },
  ]), [selectedJob, besideMode, sandboxOpen, setSelectedJob, clearDeepLink]);
  const {
    visible: visiblePanels, dockWidth, focusPanel,
    beginResize, resizeBy, endResize,
    openCount: openPanelCount, fullScreenMode: panelsFullScreen, lastOpenedId,
  } = usePanelHost(panelDescriptors, vpWidth);
  const panelProps = useCallback((id) => {
    const p = visiblePanels.find(v => v.id === id);
    if (!p) return null;
    return {
      slot: p.slot, width: p.width, focused: p.focused, fullScreen: p.fullScreen,
      // D39: Escape and the backdrop close the most recently OPENED panel — one at a time, deterministic.
      closesOnEscape: id === lastOpenedId,
      // D39: a closed neighbour's space, held so this panel does not slide (usePanelHost reserveAfterClose).
      reserveRight: p.reserveRight || 0,
      resizeMode: p.resizeMode,
      onFocus: () => focusPanel(id),
      onResizeStart: beginResize,
      onResize: (delta) => resizeBy(id, delta),
      onResizeEnd: endResize,
    };
  }, [visiblePanels, focusPanel, beginResize, resizeBy, endResize, lastOpenedId]);

  // While any panel OR THE FILTERS DRAWER is open the board is inert and the page is frozen at its
  // current scroll offset, which is restored exactly on close. See hooks/useBoardLock.js — a scrim
  // alone stopped neither the Tab key nor the wheel.
  //
  // The drawer was missing from this condition, and a scrim was all it ever had. Measured with only
  // the drawer open: the top bar behind it was dimmed and pointer-unreachable (the scrim covers it,
  // Z.DRAWER_SCRIM 600 over Z.NAV 250) and still fully TAB-REACHABLE, so focus walked out of the
  // open drawer into controls the user could not see. pointer-events is not a focus trap; `inert`
  // is, and it is the same mechanism the panels have always used.
  // filterPanelOpen, not the `filtersOpen` alias — the alias is declared ~130 lines below this call
  // and reading it here would be a temporal-dead-zone ReferenceError on every render.
  useBoardLock(openPanelCount > 0 || filterPanelOpen);

  const [activeAts,   setActiveAts]   = useState(null);
  const [attribution, setAttribution] = useState([]); // job source attribution from aggregator

  // Domain profiles
  const [domainProfiles,   setDomainProfiles]   = useState([]);
  const [profileWizardOpen, setProfileWizardOpen] = useState(false);
  const [profileWizardIntent, setProfileWizardIntent] = useState(null);
  const [searchIntentPrompt, setSearchIntentPrompt] = useState(null);
  // Increments when active profile changes — triggers job board refetch
  const [profileSwitchKey, setProfileSwitchKey] = useState(0);

  // Live scrape status
  const [scrapeError,    setScrapeError]    = useState("");
  // The auto-apply pipeline's state moved to contexts/AutoApplyContext.jsx, and its surface to
  // panels/AutoApplyPanel.jsx on its own tab (W5). The board keeps what it needs to DECIDE: Draft,
  // Save and Pass are the deck's own calls (lib/jobDecisions.js, A53 — owner 10-02), and whether a
  // job is already drafted is the pipeline's own feed. Everything else is on that tab.
  const { draftTool, applyStateByJobId, loadApplyRuns, applyPrereqMissing = [], runBar = null } = useAutoApply();
  // The decision just made, for the shared toast and its Undo (components/DecisionToast.jsx).
  const [decisionToast, setDecisionToast] = useState(null);
  // Drafted this session, and drafts in flight: the feed catches up on its next load, and a second
  // click must not post twice while the first is on the wire.
  const [draftedIds, setDraftedIds] = useState(() => new Set());
  const [draftingIds, setDraftingIds] = useState(() => new Set());
  const isJobDrafted = (jobId) => draftedIds.has(jobId) || isDrafted(applyStateByJobId?.[jobId]);
  // ⛔ D51 · THE DRAFT BUTTON IS NEVER A DEAD END. The day's slots (GET /api/draft/slots, moved by each
  // Draft's own response), the setup it needs and the operator's pause give every refusal its sentence
  // BEFORE the click; a drafted job's button opens Draft House, where the job is. `facetsNonce` re-reads
  // the /d count after a Draft or an Undo, so the chip moves without a reload.
  const [draftSlots, setDraftSlots] = useState(null);
  const [facetsNonce, setFacetsNonce] = useState(0);
  useEffect(() => { api("/api/draft/slots").then(setDraftSlots).catch(() => {}); }, []);
  // ⭐ D54 · AT THE POINT OF ACTION — the user's applications by company (The Table's own rows, grouped by
  // shared/companyIdentity.js), so a Draft into a company they already have a sent or active application
  // at says so first. Non-blocking: a confirm, never a refusal (any cap still enforces itself).
  const [companyIndex, setCompanyIndex] = useState(null);
  const loadCompanyIndex = useCallback(() => {
    api("/api/applications/history").then(d => {
      const groups = companyRows(d?.rows || []);
      setCompanyIndex({ groups, members: new Map(groups.map(g => [g.key, g.roles.map(r => ({ company: r.company, url: r.applyUrl }))])) });
    }).catch(() => {});
  }, []);
  useEffect(() => { loadCompanyIndex(); }, [loadCompanyIndex]);
  // ⛔ D59 · whether the profile STATES a citizenship / clearance answer (a saved answer, a stated
  // clearance level) — read once, for the notice at Draft. Never what the answer is, never a verdict.
  const [eligibilityStated, setEligibilityStated] = useState(null);
  useEffect(() => { api("/api/profile").then(p => setEligibilityStated(statedEligibility(p))).catch(() => {}); }, []);
  const eligibilityNoticeFor = useCallback((job) => (job ? eligibilityNotice(job.requirements, eligibilityStated || undefined) : null), [eligibilityStated]);
  const companyNoticeFor = useCallback((job) => {
    if (!companyIndex || !job) return null;
    const key = matchCompany({ company: job.company, url: job.applyUrl || job.url }, companyIndex.members);
    const g = key ? companyIndex.groups.find(x => x.key === key) : null;
    // Its own row never warns about itself.
    const others = g ? { ...g, roles: g.roles.filter(r => String(r.jobId) !== String(job.jobId || job.id)) } : null;
    return others?.roles.length ? companyNotice(others, job.company) : null;
  }, [companyIndex]);
  const draftBlocked = useMemo(() => draftBlock({
    slots: draftSlots, prereqMissing: applyPrereqMissing, prereqLabels: PREREQUISITE_LABELS,
    paused: !!runBar?.mode?.auto?.killSwitch,
  }), [draftSlots, applyPrereqMissing, runBar]);
  const draftControls = useMemo(() => ({
    block: draftBlocked, slots: draftSlots,
    onView: () => navigate("/app/auto-apply"),
    onExplain: (job, reason) => setDecisionToast({ jobId: job?.jobId || job?.id, company: job?.company,
      decision: DECISIONS.DRAFTED, error: reason, at: Date.now() }),
  }), [draftBlocked, draftSlots]); // eslint-disable-line react-hooks/exhaustive-deps

  // LIVE POLLING: polls /api/jobs/poll every 4s during active scrape.
  // Stops when scraping:false returned or after 3 consecutive failures.
  // To change poll interval edit POLL_INTERVAL_MS below.
  const POLL_INTERVAL_MS = 4000;
  const [pollStatus,   setPollStatus]   = useState("idle"); // "idle"|"polling"|"complete"|"error"
  const pollIntervalRef = useRef(null);

  const [searchPhase, setSearchPhase] = useState("idle");

  // Generation progress
  const [genStage, setGenStage] = useState("");
  const genTimerRef = useRef(null);

  // Panel resize refs (react-resizable-panels imperative API). Only the board column is a
  // resizable Panel now, so detailPanelRef / atsPanelRef / the "have defaults been applied" and
  // "what was visible last render" bookkeeping went with the rebalancing effect that used them.
  const jobsPanelRef    = useRef(null);
  const detailPanelElementRef = useRef(null);

  // ResizeObserver: tracks manual drag width for Tier 1 ? 2 override only
  const jobsPanelElementRef = useRef(null);
  const [manualWidth, setManualWidth] = useState(null);


  // effectiveTier: panel count is primary driver; ResizeObserver only overrides Tier 1 ? 2
  const effectiveTier = useMemo(() => {
    const baseTier = getCardTier(!!selectedJob, sandboxOpen, false);
    if (baseTier === 3) return 3; // panel count wins — never override Tier 3
    if (manualWidth !== null && manualWidth < 280 && manualWidth >= 180) return 2;
    return baseTier;
  }, [!!selectedJob, sandboxOpen, manualWidth]); // eslint-disable-line react-hooks/exhaustive-deps


  // Task 5 — Inline error states
  const [uploadError,      setUploadError]      = useState("");

  // Task 6 — Company reuse modal
  const [companyReuseTarget, setCompanyReuseTarget] = useState(null);

  // Board tabs — shared via JobBoardContext (destructured earlier, near line 887)
  const [pendingJobs, setPendingJobs] = useState([]);
  // linkedinInstallModalOpen / linkedinImporting / linkedinExtensionNotice removed in cleanup
  // 5.3 along with the bulk-import flow that was their only writer.
  // extensionState / refreshExtensionState stubs removed in cleanup 5.3 — the last readers of
  // both went with the bulk-import flow.

  const activeDomainProfile = useMemo(() => (
    domainProfiles.find(p => p.id === activeProfileId)
      || domainProfiles.find(p => p.is_active)
      || domainProfiles[0]
      || null
  ), [domainProfiles, activeProfileId]);
  const activeProfileKey = activeDomainProfile?.id || null;
  const activeProfileResumePath = activeDomainProfile?.id
    ? `/api/domain-profiles/${activeDomainProfile.id}/base-resume`
    : null;
  const activeProfileEnhanceStatusPath = activeDomainProfile?.id
    ? `/api/domain-profiles/${activeDomainProfile.id}/enhance-status`
    : null;
  const activeProfileEnhancePath = activeDomainProfile?.id
    ? `/api/domain-profiles/${activeDomainProfile.id}/enhance`
    : null;
  const activeProfileAdoptEnhancedPath = activeDomainProfile?.id
    ? `/api/domain-profiles/${activeDomainProfile.id}/adopt-enhanced`
    : null;

  // Distinguishes "the profile list came back empty" from "the profile list has not come back".
  // fetchJobs keys its board-clearing branch off this — see the note there.
  const profilesLoadedRef = useRef(false);

  // ⛔ 44p · "loading" | "ready" | "error". The set-up block ("Start with your résumé") shows ONLY when the read
  // SUCCEEDED and found no profile. This read used to `.catch(() => {})`, so a server that did not answer (production
  // 11-02 / 11-03, the event loop blocked) was drawn as "no profile": "Upload your résumé", no jobs.
  const [profilesState, setProfilesState] = useState("loading");
  const [profilesTry, setProfilesTry] = useState(0);

  // Load domain profiles on mount and seed the shared active profile id.
  useEffect(() => {
    let live = true;
    api("/api/domain-profiles", { timeoutMs: 10000 })
      .then(rows => {
        if (!live) return;
        const profiles = Array.isArray(rows) ? rows : [];
        profilesLoadedRef.current = true;
        setDomainProfiles(profiles);
        setProfilesState("ready");
        const active = profiles.find(p => p.is_active) || profiles[0];
        if (active && !activeProfileId) setActiveProfileId?.(active.id);
        // Clear any stale "create profile" error that may have appeared before profiles loaded
        if (profiles.length > 0) setScrapeError(e => e.startsWith("Create a job search profile") ? "" : e);
      })
      .catch(() => { if (live) setProfilesState(s => (s === "ready" ? s : "error")); });
    return () => { live = false; };
  }, [activeProfileId, setActiveProfileId, profilesTry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enhance resume state
  // ENHANCE GATING: one free per account lifetime.
  // enhance_used is set server-side on API call, not on adoption. Cannot be reset.
  // Future paid unlock: enhance_paid flag in users table.
  // To change gating logic: edit the profile-scoped enhance routes in server.js and update enhance-status response.
  const [enhanceUsed,    setEnhanceUsed]    = useState(false);
  const [enhancePaid,    setEnhancePaid]    = useState(false);
  const [enhancing,      setEnhancing]      = useState(false);
  const [enhanceResult,  setEnhanceResult]  = useState(null); // { original, enhanced, delta }
  const [enhanceModalOpen, setEnhanceModalOpen] = useState(false);

  // Filter panel
  // The filters panel's open state lives in JobBoardContext, because the control that opens it is
  // now the icon beside IMPORT (App.jsx's BoardControlIcons), which is rendered above this panel.
  // Only the TRIGGER moved: the panel, its staged pendingFilters, its facet counts and its
  // apply/reset flow are all still here and unchanged.
  const filtersOpen = filterPanelOpen;
  const setFiltersOpen = setFilterPanelOpen;

  // Employment type preferences — persisted in localStorage
  const [employmentTypePrefs, setEmploymentTypePrefsRaw] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("empTypePrefs") || "null");
      return Array.isArray(saved) && saved.length ? saved : ["full-time"];
    } catch { return ["full-time"]; }
  });
  const setEmploymentTypePrefs = (val) => {
    setEmploymentTypePrefsRaw(val);
    try { localStorage.setItem("empTypePrefs", JSON.stringify(val)); } catch {}
  };

  // Scrape trigger input
  const [searchInput, setSearchInput] = useState("");
  // Tracks whether the user has committed the current search input via Enter/button.
  // Used to dismiss the normalised-preview tooltip after submission.
  const [searchCommitted, setSearchCommitted] = useState(false);

  // Filters
  const [roleFilter,    setRoleFilter]    = useState("");
  const [locationFilter,setLocationFilter]= useState("");
  const [workType,      setWorkType]      = useState("");
  const [catFilter,     setCatFilter]     = useState("");
  const [srcFilter,     setSrcFilter]     = useState("");
  const [minYoe,        setMinYoe]        = useState("");
  const [maxYoe,        setMaxYoe]        = useState("");
  const [maxApplicants, setMaxApplicants] = useState("");
  const [visitedFilter, setVisitedFilter] = useState("");
  const [ageFilter,     setAgeFilter]     = useState("");
  // Both are reached only from the search bar's Domain and Status selects. They are ordinary
  // committed filter state like every neighbour here — they feed buildParams and appear in the
  // refetch effect's dep array, so test/jobsBoardParamContract.test.js covers them the same way it
  // covers the rest, by derivation rather than by being listed anywhere.
  const [domainFilter,  setDomainFilter]  = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");
  // FE-2: Task-4 filter vocabulary + the profile-bridge visa preference override.
  const [salaryMin,      setSalaryMin]      = useState("");
  const [salaryMax,      setSalaryMax]      = useState("");
  const [workModels,     setWorkModels]     = useState([]);
  const [experienceLevels,setExperienceLevels]= useState([]);
  const [skillsInclude,  setSkillsInclude]  = useState([]);
  const [sponsorFriendly,setSponsorFriendly]= useState(false);
  // X3: the COMPANY-level H-1B filter, separate from the posting-level toggle above because it is
  // a different claim from a different source. Default off — see the drawer copy for what it does.
  // ⭐ A109: a VALUE, not a tickbox — "" · "filed" (the sentence's sponsorship clause) · "1" (the drawer's older opt-in).
  const [companySponsors,setCompanySponsors]= useState("");
  const [hideEligibility, setHideEligibility] = useState(false);
  const [trulyEntry, setTrulyEntry] = useState(false);
  const [hideGhost, setHideGhost] = useState(false);
  // Provider + automation-tier include/exclude. Default [] on all four — buildParams emits nothing
  // for an empty array, so the default querystring is unchanged.
  const [sourcesInclude, setSourcesInclude] = useState([]);
  const [sourcesExclude, setSourcesExclude] = useState([]);
  const [tiersInclude,   setTiersInclude]   = useState([]);
  const [tiersExclude,   setTiersExclude]   = useState([]);
  const [fitBands,       setFitBands]       = useState([]);
  const [jobFunctions,   setJobFunctions]   = useState([]);
  // ⭐ D179 (a) (45l) · THE ROLE — the taxonomy's Category → Subcategory, chosen in the domain word's panel (or the search
  // box's Roles); sent as `category` / `subcategory` (jobQuery's hard taxonomy filter), counted by the facets' `role`.
  const [taxRole,        setTaxRole]        = useState({ category: "", subcategory: "" });
  // ⭐ (B)-2 (45o, owner 11-08: "a new résumé moves your role and family, and the board follows"): when the active job
  // profile's placement is NEW (placed_at moved — an upload, a replace, a pick, an Undo), the sentence's role word follows
  // it: "discovering [Backend] roles …". A ".general" placement narrows to its CATEGORY (never to the thin general bucket).
  // Remembered per profile in this browser, so a choice the person makes on the board isn't overridden by an old placement.
  // ⛔ 45s (the M-7 walk): the profile-key effect further down restores the profile's cached / default board snapshot on a
  // profile's first arrival — AFTER this effect in the same commit — and that restore reset the levels and places this
  // effect had just set (the role survived only because the snapshot doesn't carry it): "at all career levels … in the
  // United States" for every résumé. What this effect applies is remembered here, and the restore re-applies it once.
  const placementSentenceRef = useRef(null);
  useEffect(() => {
    const p = activeDomainProfile;
    if (!p?.placed_at || !p.placement_category) return;
    const key = `draft.placementSeen.${p.id}`;
    let seen = null; try { seen = localStorage.getItem(key); } catch { seen = null; }
    if (String(seen) === String(p.placed_at)) return;
    try { localStorage.setItem(key, String(p.placed_at)); } catch { /* private mode: it may apply again */ }
    // ⭐ D184 B-7 (45p): the WHOLE sentence inherits the résumé — role, level, workstyles (all unless set), the résumé's city —
    // through the same setters the sentence's words use. Once per placement, so the person's own edits win until the next.
    const next = sentenceFromResume({ category: p.placement_category, subcategory: p.placement_subcategory, level: p.placement_level,
      location: p.resume_location || null });
    // ⭐ D186-5: the placement's "also fits" rides with the role (searched beside it); any role the person picks drops it.
    let also = ""; try { also = (typeof p.placement_also === "string" ? JSON.parse(p.placement_also) : p.placement_also)?.subcategory || ""; } catch { also = ""; }
    if (!next.subcategory) also = "";
    const mine = { key: String(p.id), next: { ...next, also } };
    placementSentenceRef.current = mine;
    requestAnimationFrame(() => { if (placementSentenceRef.current === mine) placementSentenceRef.current = null; });   // only a restore from this same moment
    setTaxRole({ category: next.category, subcategory: next.subcategory, also });
    setExperienceLevels(next.experience_levels);
    setWorkModels(next.work_models);
    setPlaces(next.places);
  }, [activeDomainProfile?.id, activeDomainProfile?.placed_at]); // eslint-disable-line react-hooks/exhaustive-deps
  // ⭐ D179 (a) · "using [technology]" — set from the search box's Technologies, cleared from its sentence word.
  const [techFilter,     setTechFilter]     = useState("");
  const [places,         setPlaces]         = useState([]);
  const [sectors,        setSectors]        = useState([]);
  const [strictTags,     setStrictTags]     = useState(false);
  const [facetCounts,    setFacetCounts]    = useState(null);
  const [pendingFilters, setPendingFilters] = useState(defaultFilterSnapshot);

  const activeProfileKeyRef = useRef(activeProfileKey);
  const switchingProfileRef = useRef(false);
  const latestSnapshotRef = useRef(null);
  const jobsFetchSeqRef = useRef(0);
  const nextFetchPageRef = useRef(1);
  // ── The cursor chain ────────────────────────────────────────────────────────────────────────
  //
  // WHY THE BOARD KEEPS BOTH PAGING MODES. This is a NUMBERED pager — Prev, 1 2 3 …, Next, and a
  // "go to page" box. A keyset cursor cannot answer "page 17": it has no notion of position, which
  // is exactly the property that makes it correct for stepping. So the two are used for what each
  // is actually good at, rather than one replacing the other:
  //
  //   Next / Prev (a STEP)     -> cursor. Correct while the board mutates underneath.
  //   page 17 / go-to-page     -> offset. The user asked for a POSITION; there is nothing else
  //                               that can answer it, and a jump is not where the defect lives.
  //
  // THE DEFECT THIS FIXES ON THIS BOARD. Disliking a job removes it from the server's result set
  // (the default board excludes disliked rows). Press Next after disliking four, and the offset has
  // moved four rows further into a list that is four rows shorter — so four jobs are stepped over
  // and never shown. The client hides this from itself: it re-injects session-disliked rows so the
  // LIST does not visibly shrink, which makes the skip invisible on screen as well as in the data.
  //
  // `nextCursorRef` is the cursor the LAST response handed back — i.e. the one that fetches the
  // page after the one on screen.
  const nextCursorRef = useRef(null);
  // Index (page - 1) holds the cursor that FETCHED that page; page 1 is null by definition. This is
  // what makes Prev work without a backwards cursor: going back is re-running the request that
  // produced the earlier page. It stays valid even when the row it was issued from has since been
  // disliked, because a cursor carries sort VALUES, not a reference to a row.
  const cursorStackRef = useRef([]);
  // The querystring minus page/cursor. A cursor is bound to the ordering it was issued under, so
  // any change to filters, sort or tab invalidates the whole chain. Derived from buildParams rather
  // than from a hand-listed dependency array, so a filter added later cannot forget to invalidate
  // it — that omission would not throw, it would silently resume against the wrong ordering.
  const paramsKeyRef = useRef(null);
  const pendingIntentSearchRef = useRef(null);
  const searchIntentResolveRef = useRef(null);
  // Stable ref so startPollLoop (empty deps) can always call the latest fetchJobs
  const fetchJobsRef = useRef(null);
  // Same device, same reason, for the live half of the search bar's double-click: that effect is
  // declared above handleSearch and is keyed on a click counter, so it cannot close over the
  // function directly without capturing whichever render happened to be current when the tick last
  // changed — the stale-closure bug documented on the debounced-search effect.
  const handleSearchRef = useRef(null);

  const activeFilterSnapshot = useCallback(() => ({
    roleFilter,
    locationFilter,
    workType,
    employmentTypePrefs: Array.isArray(employmentTypePrefs) && employmentTypePrefs.length
      ? employmentTypePrefs
      : ["full-time"],
    catFilter,
    srcFilter,
    minYoe,
    maxYoe,
    maxApplicants,
    visitedFilter,
    ageFilter,
    salaryMin,
    salaryMax,
    workModels,
    experienceLevels,
    skillsInclude,
    sponsorFriendly,
    companySponsors,
    hideEligibility,
    trulyEntry,
    hideGhost,
    sourcesInclude,
    sourcesExclude,
    tiersInclude,
    tiersExclude,
    fitBands,
    jobFunctions,
    places,
    sectors,
    strictTags,
  }), [
    roleFilter, locationFilter, workType, employmentTypePrefs,
    catFilter, srcFilter, minYoe, maxYoe, maxApplicants, visitedFilter, ageFilter,
    salaryMin, salaryMax, workModels, experienceLevels, skillsInclude, sponsorFriendly,
    companySponsors, hideEligibility, trulyEntry, hideGhost, sourcesInclude, sourcesExclude, tiersInclude, tiersExclude, fitBands,
    jobFunctions, places, sectors, strictTags,
  ]);

  const stageFilter = useCallback((key, value) => {
    setPendingFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // openFilterPanel is defined after buildParams below (it needs to call fetchFacets, which
  // needs buildParams — both declared further down in this component).

  // THE ONE WRITER for the committed filter states. Three separate places used to set them by hand
  // — the drawer's Apply, the profile-switch/reload restore, and Clear All — and the newer filters
  // (salary, work models, experience levels, skills, sponsor, providers, tiers) were only ever added
  // to the first of the three. The consequence was measured in a browser: apply Onsite, board goes
  // 27 → 4, reload, board comes back 27 with the filter silently gone, because the restore path had
  // never heard of workModels. That is the same "a new filter was left out of a hand-maintained
  // list" failure as the refetch dep array, in its third location. One writer, keyed off
  // defaultFilterSnapshot, so a filter added there is picked up by every path at once.
  const applyFilterSnapshot = useCallback((snap) => {
    const next = { ...defaultFilterSnapshot(), ...(snap || {}) };
    setRoleFilter(next.roleFilter || "");
    setLocationFilter(next.locationFilter || "");
    setWorkType(next.workType || "");
    setEmploymentTypePrefs(
      Array.isArray(next.employmentTypePrefs) && next.employmentTypePrefs.length
        ? next.employmentTypePrefs
        : ["full-time"]
    );
    setCatFilter(next.catFilter || "");
    setSrcFilter(next.srcFilter || "");
    setMinYoe(next.minYoe || "");
    setMaxYoe(next.maxYoe || "");
    setMaxApplicants(next.maxApplicants || "");
    setVisitedFilter(next.visitedFilter || "");
    setAgeFilter(next.ageFilter || "");
    setSalaryMin(next.salaryMin || "");
    setSalaryMax(next.salaryMax || "");
    setWorkModels(Array.isArray(next.workModels) ? next.workModels : []);
    setExperienceLevels(Array.isArray(next.experienceLevels) ? next.experienceLevels : []);
    setSkillsInclude(Array.isArray(next.skillsInclude) ? next.skillsInclude : []);
    setSponsorFriendly(!!next.sponsorFriendly);
    setCompanySponsors(next.companySponsors === true ? "1" : typeof next.companySponsors === "string" ? next.companySponsors : "");
    setHideEligibility(!!next.hideEligibility);
    setTrulyEntry(!!next.trulyEntry);
    setHideGhost(!!next.hideGhost);
    setSourcesInclude(Array.isArray(next.sourcesInclude) ? next.sourcesInclude : []);
    setSourcesExclude(Array.isArray(next.sourcesExclude) ? next.sourcesExclude : []);
    setTiersInclude(Array.isArray(next.tiersInclude) ? next.tiersInclude : []);
    setTiersExclude(Array.isArray(next.tiersExclude) ? next.tiersExclude : []);
    setFitBands(Array.isArray(next.fitBands) ? next.fitBands : []);
    setJobFunctions(Array.isArray(next.jobFunctions) ? next.jobFunctions : []);
    setPlaces(Array.isArray(next.places) ? next.places : []);
    setSectors(Array.isArray(next.sectors) ? next.sectors : []);
    setStrictTags(!!next.strictTags);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPendingFilters = useCallback(() => {
    applyFilterSnapshot(pendingFilters);
    setFiltersOpen(false);
  }, [pendingFilters, applyFilterSnapshot]);

  const resetPendingFilters = useCallback(() => {
    setPendingFilters(defaultFilterSnapshot());
  }, []);

  // How many COMMITTED filters are narrowing the board right now. Compared against
  // defaultFilterSnapshot() rather than against a hand-written list, so a filter added later is
  // counted without anyone remembering to come back here.
  const activeFilterCount = useMemo(() => {
    const current = activeFilterSnapshot();
    const base = defaultFilterSnapshot();
    return Object.keys(base).filter(k => {
      const a = current[k], b = base[k];
      if (Array.isArray(b)) return JSON.stringify(a ?? []) !== JSON.stringify(b);
      return (a ?? "") !== (b ?? "");
    }).length
    // Plus the two committed filters the DRAWER does not own, and which are therefore not in its
    // snapshot: the search bar's Domain and Status > Applied controls. They narrow the board just
    // as much as anything above, and since this number is now also the icon's badge — the only
    // at-a-glance explanation for a narrow board — leaving them out would let the board be
    // filtered while the badge said it was not.
    + (domainFilter ? 1 : 0)
    + (appliedFilter ? 1 : 0);
  }, [activeFilterSnapshot, domainFilter, appliedFilter]);

  // Clears every committed filter AND the staged copy, so the drawer does not reopen still
  // showing the filters the user just cleared from the empty-board notice.
  const clearAllFilters = useCallback(() => {
    const base = defaultFilterSnapshot();
    setPendingFilters(base);
    applyFilterSnapshot(base);
    // localSearch is counted as a narrowing filter by JobsColumn's empty-state branch, so it has to
    // be cleared here too — otherwise "Clear all filters" leaves the board empty and the notice
    // still up, which reads as the button being broken.
    setLocalSearch("");
    setCurrentPage(1);
  }, [applyFilterSnapshot, setLocalSearch]);

  // "Show all N" / "Use my profile" — the way out of, and back into, profile curation. Only
  // curateOff is set here: it is in the refetch effect's dep array, so flipping it re-runs the board
  // by itself. Page 1 because the uncurated board is a different, longer result set and holding the
  // old offset would land the user in the middle of it.
  const toggleCuration = useCallback(() => {
    setCurateOff(prev => !prev);
    setCurrentPage(1);
  }, []);

  // Spreads activeFilterSnapshot() rather than re-listing the filters: this snapshot is what gets
  // persisted (writeProfileUiCache) and restored, so a filter missing here is a filter that does not
  // survive a reload or a profile switch. It listed only the 11 legacy ones, which is why applying a
  // work-model filter and reloading silently returned the unfiltered board.
  const makeProfileSnapshot = useCallback((overrides = {}) => ({
    jobs,
    pendingJobs,
    totalJobs,
    totalPages,
    currentPage,
    boardTab,
    localSearch,
    sortBy,
    ...activeFilterSnapshot(),
    selectedJob,
    ...overrides,
  }), [jobs, pendingJobs, totalJobs, totalPages, currentPage, boardTab, localSearch, sortBy,
      activeFilterSnapshot, selectedJob]);

  latestSnapshotRef.current = makeProfileSnapshot();

  const applyProfileSnapshot = useCallback((snapshot, profileKey = null) => {
    // Do NOT restore stale job rows from cache — they cause the "jobs appear then vanish"
    // flicker when the fresh fetch arrives with a filtered subset. Filter settings and
    // pagination state are still restored so the board refetches with the right params.
    // ⛔ A126 (8): EXCEPT the cards this tab last showed for THIS profile (BOARD_LAST) — a return to Home keeps them on
    // screen while the refetch runs; another profile's board still starts empty.
    const keepShown = BOARD_LAST && profileKey != null && String(BOARD_LAST.profileKey) === String(profileKey);
    if (!keepShown) {
      setJobs([]);
      setTotalJobs(snapshot.totalJobs || 0);
      setTotalPages(snapshot.totalPages || 0);
    }
    setPendingJobs([]);
    setCurrentPage(snapshot.currentPage || 1);
    // D40: a view named in the URL (the extension page's "+ view" link) is honoured.
    // ⛔ A126 (5) (hotfix 11-05) · the CACHED view is NOT restored: Home opens on ALL. Since D152 / D156 put the board on
    // Home under the deck, a remembered ★ / /d / + silently decided what Home showed — the owner's Home read "1 imported
    // job, no other jobs" for days (production 11-05: every visit logged total 12177 for ALL, then total 1 for the restored
    // + view, which landed last). Filters, search and sort are still restored; the view is the person's click each time.
    setBoardTab(viewFromUrl() || "all");
    // ⛔ A126 (6) (hotfix 11-05) · the saved SEARCH TEXT is NOT restored either. The search box shows only what is typed
    // into it this visit (barFilters → localSearch; nothing writes localSearch back into the box), so a restored search
    // was an INVISIBLE filter: the owner's profile had `localSearch: "micro1"` saved, and every Home load asked for
    // `localSearch=micro1&job_functions=engineering` → the one micro1 posting, under an empty-looking search box.
    setLocalSearch("");
    setSortBy(sortFromCachedSnapshot(snapshot));
    // Restore every committed filter through the single writer, and re-stage the drawer to match, so
    // reopening it shows the filters the board is actually applying. Hand-listing them here is what
    // dropped the newer ones on every reload and profile switch.
    applyFilterSnapshot(snapshot);
    setPendingFilters({ ...defaultFilterSnapshot(), ...snapshot });
    setSelectedJob(snapshot.selectedJob || null);
    // 45s: a résumé's sentence applied for THIS profile in the same moment wins over the restored snapshot (once).
    const placed = placementSentenceRef.current;
    if (placed && profileKey != null && placed.key === String(profileKey)) {
      placementSentenceRef.current = null;
      setTaxRole({ category: placed.next.category, subcategory: placed.next.subcategory, also: placed.next.also || "" });
      setExperienceLevels(placed.next.experience_levels);
      setWorkModels(placed.next.work_models);
      setPlaces(placed.next.places);
    }
  }, [setBoardTab, setLocalSearch, setSortBy, applyFilterSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileRef        = useRef();
  const jobCountRef    = useRef(0);
  const displayJobsRef = useRef([]);
  jobCountRef.current = jobs.length;
  const applyMode = user?.applyMode || "SIMPLE";
  const planTier = String(user?.planTier || "BASIC").toUpperCase();
  // The tier is consulted only when the lever is on. Off, both tools are simply available, which is
  // what the server now answers too — an offer the server would refuse is worse than no offer.
  const canUseGenerate = !monetisationEnabled || planTier === "PLUS" || planTier === "PRO";
  const canUseAPlusResume = !monetisationEnabled || planTier === "PRO";

  // The panel-size rebalancing effect that lived here is gone, along with getPanelDefaults and the
  // sandbox/ats/detail Panel refs it drove. It redistributed react-resizable-panels PERCENTAGES
  // across the board/detail/sandbox/ats columns whenever one opened or closed — three triple-RAF
  // .resize() calls to work around the library not having committed its layout yet. None of that has
  // anything left to act on: the JD, PDF and ATS surfaces are popup panels now, and the board is the
  // only remaining column, so it simply keeps 100%. Panel widths are per-type, dragged on the panel
  // itself and persisted by PanelShell.
  // ResizeObserver — only used for Tier 1 → 2 manual-drag fallback
  useEffect(() => {
    const nodes = [jobsPanelElementRef.current, detailPanelElementRef.current].filter(Boolean);
    if (!nodes.length) return;
    let debounceTimer;
    const ro = new ResizeObserver(entries => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const jobsEntry = entries.find(entry => entry.target === jobsPanelElementRef.current) || entries[0];
        const w = jobsEntry?.contentRect.width;
        if (w !== undefined) setManualWidth(w);
      }, 50);
    });
    nodes.forEach(node => ro.observe(node));
    return () => {
      clearTimeout(debounceTimer);
      ro.disconnect();
    };
  }, [!!selectedJob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync drawer meta to context whenever selectedJob or related state changes
  useEffect(() => {
    if (!selectedJob) { setSelectedJobMeta(null); return; }
    const g2 = generated[selectedJob.jobId];
    const done2 = !!g2?.html;
    const st2 = loading[selectedJob.jobId];
    setSelectedJobMeta({
      g: g2, done: done2, st: st2,
      applyMode, canUseGenerate, canUseAPlusResume: false,
      resumeText,
      // Every callback here is unconditional now. Six of them used to read
      // `isImported ? undefined : ...`, and `isImported` HAD NO DEFINITION — so this effect threw
      // `ReferenceError: isImported is not defined` the instant a job was selected, and the JD
      // drawer never opened at all. Not a regression from the panel work: `isImportedBoardJob()`
      // and the `const isImported = ...` line that called it were both deleted in 190258a ("one
      // capture, two triggers"), which converged the extension's two capture paths, and these six
      // references were left behind.
      //
      // Restoring the guard would be wrong, not just unnecessary. It tested
      // `boardSource in [linkedin, linkedin_saved, linkedin_extension] && importedJobId != null`,
      // i.e. a row in the `imported_jobs` table — the surface that same convergence removed. Every
      // capture now lands in scraped_jobs and is indistinguishable from a crawled row, so the
      // predicate is unconditionally false and the actions it disabled (sandbox, export, star, ATS,
      // resume, queue) are all valid for any board job.
      // ⭐ D164: `opts.profileId` — the posting's "Which résumé" (generateFrom); omitted, the board's active profile.
      onGenerate: (force, opts) => generateFrom(selectedJob, force, opts),
      // ⛔ D57: a résumé stored on an earlier visit (`__exists__`) is VIEWED and DOWNLOADED from the
      // store — never a dead Preview, and never "Regenerate" as the only way back to it.
      onViewSandbox: () => {
        if (g2?.html === "__exists__") { viewStoredResume(selectedJob, g2.tool); return; }
        const e2 = { ...g2, company: g2?.company || selectedJob.company, title: g2?.title || selectedJob.title };
        openSandbox(e2); openAtsPanel(buildAtsPayload(selectedJob, g2), selectedJob);
      },
      onExport: async () => {
        if (g2?.html === "__exists__") {
          try {
            const d = await api(`/api/resumes/${encodeURIComponent(selectedJob.jobId)}`);
            const art = { ...g2, html: d.html, jobId: selectedJob.jobId, company: d.company || selectedJob.company, title: d.role || selectedJob.title };
            await exportAndTrack(selectedJob, d.html, selectedJob.company, art);
          } catch (e) { setSandbox({ generating: false, status:"missing", missing:true, error: e.message, company: selectedJob.company, title: selectedJob.title }); }
          return;
        }
        exportAndTrack(selectedJob, getActiveArtifact(g2)?.html, selectedJob.company, getActiveArtifact(g2));
      },
      // ⭐ D164: Download as HTML from the posting — the same document the sandbox's HTML button saves (its editing
      // attributes stripped, cleanDocHtml), through the one blob download (lib/api.js downloadBlob). A stored résumé is
      // read from the store first, as Download (PDF) does.
      onExportHtml: async () => {
        try {
          let html = getActiveArtifact(g2)?.html;
          if (!html || html === "__exists__") html = (await api(`/api/resumes/${encodeURIComponent(selectedJob.jobId)}`))?.html;
          if (!html) throw new Error("No résumé is stored for this job yet.");
          await downloadBlob(new Blob([cleanDocHtml(html)], { type: "text/html" }), `Resume_${(selectedJob.company || "resume").replace(/\s+/g, "_")}.html`);
        } catch (e) { setSandbox({ generating: false, status:"missing", missing:true, error: e.message, company: selectedJob.company, title: selectedJob.title }); }
      },
      onRegenerate: (opts) => generateFrom(selectedJob, true, opts),
      // ⭐ D164: the generation's failure on THIS posting (Failed — Try again), and the résumés it can be tailored from —
      // each job profile's base résumé, the board's active one first and the default.
      genError: genFailed[selectedJob.jobId] || null,
      resumeSources: domainProfiles.map(p => ({ id: p.id, name: p.profile_name || p.name || `Job profile ${p.id}`, active: p.id === activeDomainProfile?.id })),
      resumeSourceId: activeDomainProfile?.id ?? null,
      onVisit: () => visitUrl(selectedJob),
      // A53: the deck's three decisions, the deck's calls. Save and Pass SET; Undo is the toast.
      onSave: () => decidePostingRef.current?.(selectedJob, DECISIONS.SAVED),
      onPass: () => decidePostingRef.current?.(selectedJob, DECISIONS.PASSED),
      onDraft: () => decidePostingRef.current?.(selectedJob, DECISIONS.DRAFTED),
      drafted: isJobDrafted(selectedJob.jobId),
      drafting: draftingIds.has(selectedJob.jobId),
      // D51: never a dead end — the reason, and the way to Draft House.
      draftBlock: draftBlocked, onViewDraft: draftControls.onView,
      // D54: the company notice, shown on the panel BEFORE the click.
      companyNotice: isJobDrafted(selectedJob.jobId) ? null : companyNoticeFor(selectedJob),
      // ⛔ D59: the posting's stated citizenship / clearance, at the point of Draft.
      eligibilityNotice: isJobDrafted(selectedJob.jobId) ? null : eligibilityNoticeFor(selectedJob),
      onExplainDraft: (reason) => draftControls.onExplain(selectedJob, reason),
      onAts: () => openAtsPanel(buildAtsPayload(selectedJob, g2), selectedJob),
      // ⭐ D152 (8): the match opens IN the posting — its report payload, the profile it is scored for, and the verdict sink.
      atsPayload: buildAtsPayload(selectedJob, g2), activeProfileId, onAtsReport: adoptPanelVerdict,
      // D58: the header box reads the same pair the card badge and the ATS card read.
      scores: scoresFor(selectedJob, g2),
      // ⭐ D152 (8) (b): an opener's ask for the match in this posting, and the History switch's résumé versions (D62's,
      // moved from the retired ATS panel): how many résumés exist (a refetch after one is generated), and what a row does.
      matchAsk,
      genCount: Object.values(generated).filter(v => v?.html && v.html !== "__exists__").length,
      onOpenVersion: (v) => openSandbox({ ...v, jobId: v.job_id, title: v.role, atsScore: v.ats_score, atsReport: v.atsReport }),
      onExportVersion: (v) => exportAndTrack(null, v.html, v.company),
      onResume: () => generate(selectedJob, false),
    });
  }, [selectedJob, generated, loading, applyMode, canUseGenerate, resumeText, draftedIds, draftingIds, applyStateByJobId, matchAsk, companyNoticeFor, eligibilityNoticeFor, draftBlocked, genFailed, domainProfiles, activeDomainProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open resume + ATS panel when a pending job card is selected
  useEffect(() => {
    if (!selectedJob || boardTab !== "pending") return;
    const key = selectedJob.jobId;

    // If pending job response included resume_html, use it directly (no extra fetch)
    if (selectedJob.resume_html) {
      const entry = {
        html:      selectedJob.resume_html,
        atsScore:  selectedJob.ats_score,
        atsReport: selectedJob.ats_report,
        company:   selectedJob.company,
        title:     selectedJob.title,
        jobId:     selectedJob.jobId,
        tool:      selectedJob.apply_mode === "CUSTOM_SAMPLER" ? A_PLUS_TOOL : GENERATE_TOOL,
        toolLabel: selectedJob.apply_mode === "CUSTOM_SAMPLER" ? TOOL_LABELS[A_PLUS_TOOL] : TOOL_LABELS[GENERATE_TOOL],
        status:    "success",
      };
      setGenerated(p => ({ ...p, [key]: entry }));
      openSandbox({ ...entry });
      openAtsPanel({ score: entry.atsScore, report: entry.atsReport, jobId: selectedJob.jobId,
                     company: selectedJob.company, title: selectedJob.title }, selectedJob);
      return;
    }

    // Fallback: resume exists in DB (generated[key] = __exists__) - fetch on demand
    if (generated[key]?.html === "__exists__") {
      generateActual(selectedJob, false, true);
      return;
    }

    // No generated artifact yet. Keep the pre-generation state neutral.
  }, [selectedJob?.jobId, boardTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // D11: ~50 per page (was 25). The board route caps pageSize at 50 (boardPageResponse).
  const PAGE_SIZE = 50;

  // Profile-scoped cache restore: show the correct profile's last board state
  // immediately, then let the normal fetch effect refresh it in the background.
  useEffect(() => {
    const nextKey = activeProfileKey == null ? null : String(activeProfileKey);
    const prevKey = activeProfileKeyRef.current == null ? null : String(activeProfileKeyRef.current);
    if (!nextKey || nextKey === prevKey) {
      activeProfileKeyRef.current = activeProfileKey;
      return;
    }
    if (!prevKey && latestSnapshotRef.current?.jobs?.length) {
      setProfileCache?.(nextKey, latestSnapshotRef.current);
      writeProfileUiCache(nextKey, latestSnapshotRef.current);
      activeProfileKeyRef.current = activeProfileKey;
      return;
    }

    if (prevKey && latestSnapshotRef.current) {
      setProfileCache?.(prevKey, latestSnapshotRef.current);
    }

    // A real profile SWITCH ends the deep link — the user has changed what board they are looking
    // at, and re-opening a job from the previous profile would be the app arguing with them. The
    // FIRST arrival of a profile key (prevKey null) is not a switch and must not clear it: that is
    // the restore this whole arrangement exists to survive.
    if (prevKey) deepLinkedJobIdRef.current = null;
    switchingProfileRef.current = true;
    const cached = getProfileCache?.(nextKey);
    if (cached) {
      nextFetchPageRef.current = cached.currentPage || 1;
      applyProfileSnapshot(cached, nextKey);
      setScrapeError("");
    } else {
      const cachedUi = readProfileUiCache(nextKey);
      nextFetchPageRef.current = cachedUi?.currentPage || 1;
      applyProfileSnapshot({ ...(cachedUi || {}), jobs: [], pendingJobs: [], totalJobs: 0, totalPages: 0, selectedJob: null }, nextKey);
      setSandbox(null);
      setSandboxOpen(false);
      setScrapeError("");
    }

    activeProfileKeyRef.current = activeProfileKey;
    requestAnimationFrame(() => { switchingProfileRef.current = false; });
  }, [activeProfileKey, applyProfileSnapshot, getProfileCache, setProfileCache]);

  // Keyed on makeProfileSnapshot rather than on a hand-listed copy of everything the snapshot
  // contains. That list was the FOURTH copy of the filter set in this file and it stopped at
  // ageFilter too, so changing a work model updated the board but never rewrote the cache — the
  // stale cache was then what a reload restored. makeProfileSnapshot's own deps now run through
  // activeFilterSnapshot, so this effect fires for any filter, including ones added later.
  useEffect(() => {
    if (!activeProfileKey || switchingProfileRef.current) return;
    setProfileCache?.(activeProfileKey, latestSnapshotRef.current);
    writeProfileUiCache(activeProfileKey, latestSnapshotRef.current);
  }, [activeProfileKey, makeProfileSnapshot, setProfileCache]);

  // -- Split-view: job selection ---------------------------------
  const handleJobSelect = useCallback((job) => {
    clearDeepLink();   // the user is driving the panel now
    setPostOrigin("board");
    // ⭐ D168 · ONE WAY TO OPEN: on the jobs page (the deck's slot is in the document) a bubble's press opens its posting
    // through the deck card's own open — openPostingOnDeck, heard once below (onOpen) — so a card and a bubble open the
    // same way, with the same swap. A press opens (a second press on the open one is no fold: Esc / "Fold it back" fold).
    // Elsewhere (Full House) the row toggles the panel as before.
    if (typeof document !== "undefined" && document.getElementById(DECK_POST_SLOT_ID)) openPostingOnDeck(job.jobId, { origin: "board" });
    else setSelectedJob(prev => {
      if (prev?.jobId === job.jobId) return null; // toggle off
      return job;
    });
    markVisited(job);
    if (!job.visited) {
      api(`/api/jobs/${job.jobId}/visited`, { method:"PATCH" }).catch(()=>{});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AH2: the open job detail lives IN THE URL ────────────────────────────────────────────────
  //
  // selectedJob was React state and nothing else, so a job detail had no address. It could not be
  // linked, could not be reopened where you left it, and — one selectedJob per mounted panel — two
  // of them could not be on screen at once by any means the app offered. /app/jobs/<id> was worse
  // than nothing: routeKey is not in NAVIGABLE_TABS, so it silently redirected to the bare board.
  //
  // A QUERY PARAM, not a path segment. The console already owns /app/jobs, so ?job= names a detail
  // without inventing a route the panel switcher would have to learn — and it composes with the
  // board's other URL state instead of replacing it. replaceState rather than navigate() for the
  // same reason App.jsx strips ?authContext that way: the address has to be copyable, but toggling
  // a side panel is not a step the Back button should have to unwind.
  //
  // A tab opened straight onto a link has no board row for that job — it may be on another page,
  // filtered out, classified under a different profile, or closed — so it is fetched BY ID. A deep
  // link that resolves only when the job is coincidentally on the current page is the no-op
  // failure mode this codebase keeps finding.
  useEffect(() => {
    const wanted = deepLinkedJobIdRef.current;
    if (!wanted) return;
    let cancelled = false;
    api(`/api/jobs/by-id/${encodeURIComponent(wanted)}`)
      .then(d => { if (!cancelled && d?.job) setDeepLinkedJob(normalizeApiJob(d.job)); })
      // An unknown or stale id leaves the board exactly as it is, and stops the insistence below.
      .catch(() => { deepLinkedJobIdRef.current = null; });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Applying it takes more than one setSelectedJob, and that is not a hack — it is the profile-cache
  // restore above, which fires when activeProfileKey first arrives and resets the selection to
  // whatever THAT PROFILE last had open. For a tab opened on a link that is nothing, so a single
  // set was silently undone a few hundred milliseconds later: the panel flashed open and closed and
  // the URL went back to a bare /app/jobs. Measured exactly that way before this.
  //
  // Effects run in declaration order, so on the render where the profile key lands the restore runs
  // first and this re-applies after it. Once the selection has stuck AND the profile key is known,
  // the ref clears and this stops caring — from then on the panel belongs to the user, and
  // reopening it after they close it would be the app arguing with them.
  useEffect(() => {
    if (!deepLinkedJob || !deepLinkedJobIdRef.current) return;
    if (selectedJob?.jobId === deepLinkedJob.jobId) return;
    setSelectedJob(deepLinkedJob);
  }, [deepLinkedJob, selectedJob?.jobId, activeProfileKey, setSelectedJob]);

  // ⭐ D152 (8) (b): the deck's report opens HERE — the posting in place, its match open under the facts (lib/jobUrl.js
  // OPEN_MATCH_EVENT). A job on this page is opened as it is; one that is not is fetched by id, as a deep link is.
  useEffect(() => {
    // ⛔ A126 (hotfix 11-05) · ONE read per posting, and only the LAST ask opens. Production 11-05: every scroll on the
    // deck card re-asked for the same posting (greenhouse::8198280 thirteen times in 90 s) while the board was slow, each
    // a request the server still ran after the page gave up on it. Now a posting's read is shared while in flight and
    // kept for a minute, and a reply for a card the person has since scrolled past is dropped.
    const latest = { id: null };
    const byId = (id) => {
      const hit = byIdReads.get(id);
      if (hit && Date.now() - hit.at < 60_000) return hit.p;
      const p = api(`/api/jobs/by-id/${encodeURIComponent(id)}`)
        .then(d => (d?.job ? normalizeApiJob(d.job) : null))
        .catch((err) => { byIdReads.delete(id); throw err; });
      byIdReads.set(id, { p, at: Date.now() });
      return p;
    };
    const onAsk = (e) => {
      const id = e.detail?.jobId;
      if (!id) return;
      latest.id = id;
      const go = (job) => { clearDeepLink(); setPostOrigin(e.detail?.origin === "board" ? "board" : "deck"); openAtsPanel(null, job); };
      const known = displayJobsRef.current.find(j => String(j.jobId) === id || String(j.id) === id);
      if (known) { go(known); return; }
      byId(id).then(job => { if (job && latest.id === id) go(job); }).catch(() => {});
    };
    // ⭐ D156 (1c): the deck's front card expanding into the long post — the same posting, opened by the deck.
    // ⭐ D168: and a bubble's press on the jobs page (handleJobSelect) — THE one open path for both (origin deck / board).
    const onOpen = (e) => {
      const id = e.detail?.jobId;
      if (!id) return;
      latest.id = id;
      const go = (job) => { clearDeepLink(); setPostOrigin(e.detail?.origin === "board" ? "board" : "deck"); setSelectedJob(job); };
      const known = displayJobsRef.current.find(j => String(j.jobId) === id || String(j.id) === id);
      if (known) { go(known); return; }
      byId(id).then(job => { if (job && latest.id === id) go(job); }).catch(() => {});
    };
    const onClose = () => { clearDeepLink(); setSelectedJob(null); };
    window.addEventListener(OPEN_MATCH_EVENT, onAsk);
    window.addEventListener(OPEN_POSTING_EVENT, onOpen);
    window.addEventListener(CLOSE_POSTING_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_MATCH_EVENT, onAsk);
      window.removeEventListener(OPEN_POSTING_EVENT, onOpen);
      window.removeEventListener(CLOSE_POSTING_EVENT, onClose);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // state -> URL, so the address is copyable and survives a reload.
  useEffect(() => {
    const next = selectedJob?.jobId || null;
    // Never strip the param out from under a deep link that has not landed yet. This effect runs on
    // the first commit, when the selection is still null, and stripping there would erase the
    // address the tab was opened with before anything had a chance to read it.
    if (!next && deepLinkedJobIdRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if ((params.get(JOB_URL_PARAM) || null) === next) return;
    if (next) params.set(JOB_URL_PARAM, next); else params.delete(JOB_URL_PARAM);
    const qs = params.toString();
    window.history.replaceState({}, "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [selectedJob?.jobId]);

  // Keyboard nav: Escape closes, ArrowUp/Down navigates
  useEffect(() => {
    if (!selectedJob) return;
    const handler = (e) => {
      // ⭐ D164: an Escape that closes the sandbox over the posting does not also close the posting (D39: one per press).
      if (e.key === "Escape") { if (panelOverPosting()) return; clearDeepLink(); setSelectedJob(null); return; }
      // A105 finding 11: the open posting's three decisions from the keyboard — S save, D draft, P pass (the deck's
      // letters). Never while typing, never with a modifier; Draft only DRAFTS (D36·5: nothing here sends).
      const typing = e.target?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']");
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const decision = { s: DECISIONS.SAVED, d: DECISIONS.DRAFTED, p: DECISIONS.PASSED }[e.key.toLowerCase()];
        if (decision) { e.preventDefault(); decidePostingRef.current?.(selectedJob, decision); return; }
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedJob(prev => {
          if (!prev) return prev;
          const jobs = displayJobsRef.current;
          const idx = jobs.findIndex(j => j.jobId === prev.jobId);
          const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
          if (nextIdx >= 0 && nextIdx < jobs.length) {
            const next = jobs[nextIdx];
            markVisited(next);
            return next;
          }
          return prev;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedJob]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Build query params from current filter state ----------
  const buildParams = useCallback((page = 1, overrideStarred = null, overrides = {}, cursor = null) => {
    const p = new URLSearchParams();
    // KEYSET vs OFFSET, decided here so there is still exactly one param builder.
    //
    // The two are mutually exclusive: the server ignores `page` when `cursor` is present, and
    // sending both would put a page number in the querystring that has no bearing on the answer —
    // which is the sort of thing that reads as meaningful in a network log for months.
    //
    // `pageSize` applies to both.
    if (cursor) p.set("cursor", cursor);
    else        p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    // D24: the curated default sends NO sort (sortBy === ""); see JobBoardContext.
    if (sortBy)               p.set("sort", sortBy);
    const effectiveRole = overrides.role ?? roleFilter;
    const effectiveVisited = overrides.visited ?? visitedFilter;
    if (effectiveRole.trim()) p.set("role",     effectiveRole.trim().toLowerCase());
    if (locationFilter.trim())p.set("location", locationFilter.trim());
    if (workType)             p.set("workType", workType);
    if (employmentTypePrefs.length && !(employmentTypePrefs.length === 1 && employmentTypePrefs[0] === "full-time"))
      p.set("employmentType", employmentTypePrefs.join(","));
    if (catFilter)            p.set("category", catFilter);
    if (srcFilter)            p.set("source",   srcFilter);
    if (minYoe !== "")        p.set("minYoe",        minYoe);
    if (maxYoe !== "")        p.set("maxYoe",        maxYoe);
    if (maxApplicants !== "") p.set("maxApplicants", maxApplicants);
    if (effectiveVisited)     p.set("visited",       effectiveVisited);
    if (ageFilter)            p.set("ageFilter",     ageFilter);
    // sj.bucket_domain (the search bar's Domain select). Not sj.category, which nothing writes —
    // see the note where the drawer's Category control was removed.
    if (domainFilter)         p.set("domain",        domainFilter);
    // uj.applied (the search bar's Status > Applied). Only ever "1"; cleared back to "" otherwise,
    // so the default querystring is unchanged.
    if (appliedFilter)        p.set("applied",       appliedFilter);
    if (overrideStarred === "1" || boardTab === "saved") p.set("starred","1");
    // D40: the + view is ALL restricted to the jobs this user imported — the same query, one predicate.
    if (boardTab === "imported") p.set("imported", "1");
    // A91: and /d, ALL restricted to the jobs this user drafted.
    if (boardTab === "pending") p.set("pending", "1");
    if (localSearch.trim())   p.set("localSearch",   localSearch.trim().toLowerCase());
    // FE-2: Task-4 filter vocabulary (services/jobs/jobQuery.js) — additive, legacy params
    // above are untouched and remain the override channel.
    if (salaryMin !== "")        p.set("salary_min_usd", salaryMin);
    if (salaryMax !== "")        p.set("salary_max_usd", salaryMax);
    if (workModels.length)       p.set("work_models",    workModels.join(","));
    if (experienceLevels.length) p.set("experience_levels", experienceLevels.join(","));
    if (skillsInclude.length)    p.set("skills_include", skillsInclude.join(","));
    // Sponsor-friendly: ON emits the param the profile-bridge/jobQuery already honor as a
    // soft, null-preserving filter; OFF emits nothing at all (falls back to whatever the
    // active profile already derives by default — see services/jobs/profileFilterBridge.js).
    if (sponsorFriendly)         p.set("sponsorship_friendly", "1");
    // X3: company-level H-1B evidence, and the narrowest filter on the board — it removes only
    // companies whose employer name we matched with high confidence and that filed nothing in the
    // quarters of DOL data we hold. Unmatched and ambiguous companies survive it by construction.
    if (companySponsors)         p.set("company_sponsorship", companySponsors);
    if (hideEligibility)         p.set("hide_eligibility_required", "1");
    if (trulyEntry)              p.set("truly_entry", "1");
    if (hideGhost)               p.set("hide_ghost", "1");
    // "Show everything in my role" — turns off the profile-derived defaults for this request only
    // (server.js's ?curate=off). Emitted solely when the user has asked for it, so the default
    // querystring is unchanged.
    if (curateOff)               p.set("curate", "off");
    // Provider + automation tier (services/jobs/jobQuery.js). Each is emitted ONLY when the user
    // has actually picked something, so with the drawer untouched none of these four keys appear
    // and the default querystring is byte-for-byte what it was before this change — the same
    // property FE-2 established and verified for its own additions.
    if (sourcesInclude.length) p.set("sources_include", sourcesInclude.join(","));
    if (sourcesExclude.length) p.set("sources_exclude", sourcesExclude.join(","));
    if (tiersInclude.length)   p.set("tiers_include",   tiersInclude.join(","));
    if (tiersExclude.length)   p.set("tiers_exclude",   tiersExclude.join(","));
    // D24: the fit clause. Its param name is the contract's (FIT_BANDS.param), read by the server
    // half's GET /api/jobs and /api/jobs/facets — test/d35FullHouseHeader.test.js (d24's block, A232 R6) holds the
    // server to reading it once that half is merged.
    if (fitBands.length)       p.set(FIT_BANDS.param,   fitBands.join(","));
    // D30: the domain and location dials, by the contract's param names (D29's tag dimensions).
    if (jobFunctions.length)   p.set(JOB_FUNCTIONS.param, jobFunctions.join(","));
    if (taxRole.subcategory)   p.set("subcategory", taxRole.subcategory);   // D179 (a)
    if (taxRole.subcategory && taxRole.also) p.set("also_subcategory", taxRole.also);   // D186-5: the résumé's "also fits"
    else if (taxRole.category) p.set("category", taxRole.category);
    if (techFilter)            p.set("tech", techFilter);   // D179 (a)
    if (places.length)         p.set(PLACES.param,      places.join(","));
    // D42: the company sector (drawer) and the strict toggle (the panels' "only known" pill).
    if (sectors.length)        p.set(SECTORS.param,     sectors.join(","));
    if (strictTags)            p.set("strict_tags",     "1");
    // posted_after: derived from the SAME named-interval the legacy ageFilter already uses —
    // no new UI control, matching the server's own AGE_MAP (server.js's /api/jobs handler).
    // Redundant with ageFilter's own inline clause (same date, same source of truth) — both
    // apply harmlessly; this just also feeds the Task-4 richFilters path.
    if (ageFilter && AGE_DAYS_MAP[ageFilter]) {
      const postedAfter = Math.floor(Date.now() / 1000) - AGE_DAYS_MAP[ageFilter] * 86400;
      p.set("posted_after", String(postedAfter));
    }
    return p.toString();
  }, [sortBy, roleFilter, locationFilter, workType, employmentTypePrefs, catFilter, srcFilter,
      minYoe, maxYoe, maxApplicants, visitedFilter, ageFilter, domainFilter, appliedFilter,
      boardTab, localSearch,
      salaryMin, salaryMax, workModels, experienceLevels, skillsInclude, sponsorFriendly,
      // D106: companySponsors and hideEligibility were missing here — the refetch below fired, but with the
      // callback's OLD closure, so toggling either sent the previous querystring.
      companySponsors, hideEligibility, trulyEntry, hideGhost,
      sourcesInclude, sourcesExclude, tiersInclude, tiersExclude, curateOff, fitBands,
      jobFunctions, places, sectors, strictTags, taxRole, techFilter]);

  // FE-2: opt-in facet counts for the panel currently being edited — requested against the
  // CURRENTLY-COMMITTED filters (buildParams(1)), not the still-being-staged pendingFilters, so
  // counts describe "how many jobs match today's board" rather than moving under the user's
  // cursor. The default board fetchJobs() call never requests this — response shape for the
  // common case is unchanged, per the task's explicit regression requirement.
  const fetchFacets = useCallback(async () => {
    try {
      const qs = buildParams(1);
      const data = await api(`/api/jobs?${qs}&include_facets=work_model,experience_level,employment_type,sources,automation_tier`);
      setFacetCounts(data?.facets || null);
    } catch {
      setFacetCounts(null);
    }
  }, [buildParams]);

  // Staging on open. This used to be openFilterPanel(), called by the FILTERS button that W4
  // removes — the icon that replaced it only flips the shared flag, because App.jsx has no access
  // to pendingFilters or the facet fetch and should not. So the work moved to an effect on the
  // flag, which means it runs however the panel was opened and cannot be bypassed by a second
  // trigger added later.
  //
  // Keyed on the transition into `true`, not on every render while open, or restaging would wipe
  // the edits being made in the panel on any unrelated re-render.
  useEffect(() => {
    if (!filtersOpen) return;
    setPendingFilters(activeFilterSnapshot());
    fetchFacets();
  }, [filtersOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish the count upward so the filter icon (App.jsx's BoardControlIcons, above this panel)
  // can show its badge. JobsPanel is the only place that can count it — the committed filter set
  // lives here — and it is the SAME activeFilterCount the empty-board notice already uses, so the
  // badge and the notice can never disagree about how narrow the board is.
  useEffect(() => { setActiveFilterCount(activeFilterCount); }, [activeFilterCount, setActiveFilterCount]);

  // ── D24 → D35: THE SENTENCE'S CLAUSES ─────────────────────────────────────────────────────────
  //
  // The header is App.jsx's — the sentence, the ONE panel its words open, the bar and the sort panel —
  // but the committed filters and the facets answer are here (W4's split, unchanged), so this panel
  // PUBLISHES them (setBoardHeadline) and the header reads them.
  //
  // The clauses read and write the board's COMMITTED filters directly — a press applies at once,
  // because the counts on the panel already said what it would do. No staging, no Apply. The
  // clause -> state binding is keyed by the contract's clause key; no param name is written here.
  const clauseState = {
    domain:   [jobFunctions,     setJobFunctions],
    level:    [experienceLevels, setExperienceLevels],
    location: [places,           setPlaces],
    where:    [workModels,       setWorkModels],
    posted:   [ageFilter,        setAgeFilter],
    fit:      [fitBands,         setFitBands],
    // ⭐ A109: the sponsorship clause writes the same value the drawer did (company_sponsorship).
    sponsorship: [companySponsors, (v) => setCompanySponsors(Array.isArray(v) ? (v[0] || "") : (v || ""))],
  };
  const clauseCount = countActiveClauses(Object.fromEntries(
    SENTENCE_CLAUSES.map(c => [c.dim.param, clauseState[c.key]?.[0]])));
  // D42 · the strict toggle travels with the clauses (the panels' "only known" pill sets it).
  const clauseParams = {
    ...Object.fromEntries(SENTENCE_CLAUSES.map(c => [c.dim.param, clauseState[c.key]?.[0]])),
    [STRICT_PARAM]: strictTags ? "1" : "",
    // D179 (a): the role travels with the clauses (the domain word reads it; its panel sets it).
    category: taxRole.category, subcategory: taxRole.subcategory, tech: techFilter,
  };

  const applyClausePatch = (patch) => {
    for (const c of SENTENCE_CLAUSES) {
      if (Object.prototype.hasOwnProperty.call(patch, c.dim.param)) clauseState[c.key]?.[1](patch[c.dim.param]);
    }
    if (Object.prototype.hasOwnProperty.call(patch, STRICT_PARAM)) setStrictTags(!!patch[STRICT_PARAM]);
    // D179 (a): a role picked (or cleared) in the domain word's panel.
    if ("subcategory" in patch || "category" in patch) {
      setTaxRole({ category: String(patch.category || ""), subcategory: String(patch.subcategory || "") });
    }
    if ("tech" in patch) setTechFilter(String(patch.tech || ""));   // D179 (a)
    setCurrentPage(1);
  };
  // The header holds these across renders; the ref keeps them pointed at THIS render's closures.
  const clausePatchRef = useRef(applyClausePatch);
  clausePatchRef.current = applyClausePatch;
  const onClausePatch = useCallback((patch) => clausePatchRef.current(patch), []);
  // "+ add → salary & more" opens the drawer of the filters that are NOT words (salary, sponsorship,
  // sources, experience years…). The filter ICON that used to open the panel is gone (D35 §1).
  const onMoreFilters = useCallback(() => { setBoardPanel(null); setFilterPanelOpen(true); }, [setBoardPanel, setFilterPanelOpen]);
  // Filters that are NOT clauses (the drawer's) and still narrow the board — "+ add" says how many
  // are on. The bar's Domain and Status are left out: they are not drawer filters.
  const otherFilterCount = Math.max(0,
    activeFilterCount - clauseCount - (strictTags ? 1 : 0) - (domainFilter ? 1 : 0) - (appliedFilter ? 1 : 0));

  // GET /api/jobs/facets, for the board's own querystring. D35: ALWAYS — the bar's view counts and
  // the panels' coverage lines are on the page, not behind a panel.
  const facetsQs = useMemo(() => buildParams(1), [buildParams]);
  // ⛔ D45 · AFTER the board, never beside it: the facets call is several board queries run
  // synchronously on the server, and fired first it held the board's own request behind it (measured:
  // /api/jobs landed at +860 ms on a cold load). The counts keep their last answer meanwhile.
  const boardLoading = answeredKey === null || requestedKey !== answeredKey;
  const facets = useJobFacets(facetsQs, !boardLoading, api, facetsNonce);

  // ── D26/D30/D35 · THE HEADLINE. The sentence is published upward for App.jsx to render where the
  // "Let's get to work." caption was — a projection of exactly these clause params, so the headline
  // and its panels cannot disagree. The unset domain reads the profile's own function (the board IS
  // scoped to it); "Nothing matches" when the board answered with no rows.
  // ⛔ D42 (owner, 10-06): the unset domain reads "all" — for an engineering profile it IS engineering +
  // data (ROLE_SCOPE_EXTRA) — never the profile's word. So there is no default word to pass.
  const defaultDomain = null;
  const clauseParamsKey = JSON.stringify(clauseParams);
  const nothingMatches = !bgLoading && !!activeDomainProfile && boardTab === "all" && totalJobs === 0 && jobs.length === 0;
  useEffect(() => {
    // D179 (a): the chosen role's own words for the sentence, from the facets' role options.
    const roleOpt = (facets.data?.clauses?.role || []).find(o => o.value === taxRole.subcategory)
      || (taxRole.category ? (facets.data?.clauses?.role || []).find(o => o.groupId === taxRole.category) : null);
    const roleLabel = taxRole.subcategory ? roleWord(roleOpt) : taxRole.category ? (roleOpt?.group || null) : null;
    setBoardHeadline?.({ params: { ...clauseParams, role_label: roleLabel }, defaultDomain, nothingMatches,
      facets: facets.data, facetsStatus: facets.status, otherFilterCount,
      onPatch: onClausePatch, onMoreFilters });
  }, [clauseParamsKey, defaultDomain, nothingMatches, facets, otherFilterCount, onClausePatch, onMoreFilters]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setBoardHeadline?.(null), [setBoardHeadline]);

  // openLinkedInExtensionPopup / closeLinkedInImportTab / startLinkedInImport removed in cleanup
  // 5.3. They drove the LinkedIn bulk saved-jobs import, and every one of them called
  // sendExtensionRequest — a stub returning an empty promise since BYO-2. startLinkedInImport
  // additionally gated on isLinkedInExtensionInstalled(), a stub hardcoded to false, so the
  // function could never get past its own guard: it always opened the install modal, for an
  // extension capability that v1.2.0 deleted outright. Nothing here could succeed.

  // A91: fetchPending (GET /api/jobs/pending) is gone — /d is fetchJobs with `pending=1`.

  // -- Fetch jobs — never clears board before data arrives ------
  const fetchJobs = useCallback(async (page = 1, mergeMode = false, options = {}) => {
    // ⛔ A91: /d is no longer its own list — it is GET /api/jobs?pending=1, ALL restricted by the /d
    // predicate, fetched and paged exactly like every other view (buildParams sets the param).
    if (!activeDomainProfile) {
      // "No active profile" has two causes that must not be treated alike: the profile list has
      // genuinely come back empty (a new account — clear the board, setupBlock takes over the
      // UI), or /api/domain-profiles simply has not answered yet. Clearing on the second is how
      // a transient loading state became data loss: any caller reaching here early wiped a board
      // that had already loaded, and nothing refetched afterwards because no dependency had
      // changed. Absence of an answer is not an answer — leave what is on screen alone.
      if (profilesLoadedRef.current) {
        setJobs([]);
        setTotalJobs(0);
        setTotalPages(0);
      }
      // setupBlock already gates the UI — no need to set scrapeError here
      return;
    }
    const requestProfileKey = activeProfileKeyRef.current;
    // D45 · ONE REQUEST PER VIEW AT A TIME. The refetch effect fired twice on mount (its deps settle
    // across two commits), so the board asked for the same page twice and threw the first answer
    // away — a wasted server turn on the request path, measured on every cold load.
    const flightKey = `${requestProfileKey}|${viewKey(buildParams(page, null, options.overrides || {}))}`;
    if (!mergeMode && !options.cursor && inFlightRef.current === flightKey) return;
    if (!mergeMode) inFlightRef.current = flightKey;
    const requestSeq = ++jobsFetchSeqRef.current;
    setBgLoading(true);
    try {
      // Invalidate the cursor chain whenever the ORDERING could have changed. Computed from
      // buildParams itself, so it cannot fall out of step with the querystring it is guarding.
      const paramsKey = buildParams(1, null, options.overrides || {});
      // A REFRESH RE-RUNS THE REQUEST THAT PRODUCED THE PAGE. Callers that reload the page the user
      // is already on — after a resume is generated, after an application is recorded — go straight
      // to fetchJobs without passing a cursor. Re-asking by OFFSET there would move the content
      // under someone who has not navigated: if they disliked anything since, the same offset now
      // points further down a shorter list and they get a different set of jobs than they were
      // looking at. Reusing this page's own cursor keeps them where they are.
      //
      // `undefined` means "not a page in this chain" and falls through to offset. `null` is a real
      // stack value meaning page 1, which IS offset — so the test is against undefined, not falsy.
      const remembered = cursorStackRef.current[page - 1];
      let cursor = options.cursor ?? (remembered !== undefined ? remembered : null);
      if (paramsKey !== paramsKeyRef.current) {
        paramsKeyRef.current = paramsKey;
        cursorStackRef.current = [];
        nextCursorRef.current = null;
        cursor = null;            // a cursor from the previous ordering means nothing here
      }

      const qs = buildParams(page, null, options.overrides || {}, cursor);
      // ⭐ D45 · STALE-WHILE-REVALIDATE. A view seen before renders from the per-view cache at once and is
      // refreshed behind it; a view not seen yet shows skeletons until it answers.
      const key = `${requestProfileKey}|${viewKey(qs)}`;
      if (!mergeMode) {
        setRequestedKey(key);
        requestedKeyRef.current = key;
        const hit = viewCacheGet(viewCacheRef.current, key);
        if (hit) { setJobs(hit.jobs); setTotalJobs(hit.total); setTotalPages(hit.totalPages); setAnsweredKey(key); }
      }
      if (!mergeMode) rememberBoardFilters(qs); // D102 P4: Auto settings' "Start from my board filters"
      let d;
      try {
        d = await api(`/api/jobs?${qs}`);
      } catch (e) {
        // The server rejects a cursor issued under a different ordering rather than silently
        // resuming against one (400 cursor_sort_mismatch / cursor_malformed). It is telling us the
        // chain is stale, and the only correct recovery is to ask again by position — so do that
        // once, rather than surfacing an error the user cannot act on. Anything else rethrows.
        const code = e?.payload?.code;
        if (!cursor || e?.status !== 400 || !(code === "cursor_sort_mismatch" || code === "cursor_malformed")) throw e;
        console.warn(`[board] cursor rejected (${code}) — falling back to offset for page ${page}`);
        cursorStackRef.current = [];
        nextCursorRef.current = null;
        cursor = null;
        d = await api(`/api/jobs?${buildParams(page, null, options.overrides || {})}`);
      }
      if (requestProfileKey !== activeProfileKeyRef.current || requestSeq !== jobsFetchSeqRef.current) return;
      // Record what fetched THIS page, and what will fetch the next one. Truncated at `page` so a
      // Prev-then-a-different-Next cannot leave a stale entry further up the stack.
      cursorStackRef.current = recordPageCursor(cursorStackRef.current, page, cursor);
      nextCursorRef.current = d.nextCursor || null;
      // Normalize aggregator field names to legacy camelCase expected by JobCard/JobsPanel
      const incoming = (d.jobs || []).map(normalizeApiJob);
      // Capture attribution from aggregator response for footer rendering
      if (Array.isArray(d.attribution)) setAttribution(d.attribution);
      if (mergeMode) {
        setJobs(prev => {
          const map = new Map(prev.map(j => [j.jobId, j]));
          incoming.forEach(j => map.set(j.jobId, j));
          return [...map.values()];
        });
      } else {
        // Replace list but re-inject any jobs disliked this session so they
        // remain visible (faded) until the user reloads the page.
        setJobs(() => {
          const result = new Map(incoming.map(j => [j.jobId, j]));
          for (const [id, job] of sessionDislikedRef.current) {
            if (job.__profileKey && String(job.__profileKey) !== String(requestProfileKey)) continue;
            if (!result.has(id)) result.set(id, job);
          }
          return [...result.values()];
        });
      }
      setTotalJobs(d.total || 0);
      setTotalPages(d.totalPages || 0);
      setCurrentPage(page);
      if (!mergeMode) {
        viewCacheSet(viewCacheRef.current, key, { jobs: incoming, total: d.total || 0, totalPages: d.totalPages || 0 });
        setAnsweredKey(key);
        BOARD_LAST = { key, profileKey: requestProfileKey, jobs: incoming, total: d.total || 0, totalPages: d.totalPages || 0,
                       beingMatched: Number(d.beingMatched) || 0, beingMatchedMore: !!d.beingMatchedMore };
        // ⛔ A126 (4) (hotfix 11-05) · D45's idle prefetch of the other three views (★ · /d · +) is OFF. It was cheap while
        // the board was its own tab; since D152 / D156 put the board on Home under the deck, it made every Home visit four
        // whole-board reads (All 14 s, ★ 2.4 s, /d 7.6 s, + 18 s on the 18k copy; 12–35 s each on production 11-05 17:39Z)
        // where the 11-03 Home made none. A view not seen yet still shows skeletons until it answers (D45), never empty.
      }
      // A73 · this request answered, so a board error from an earlier one no longer describes the screen.
      setScrapeError(prev => (typeof prev === "string" && prev.startsWith(BOARD_ERROR_PREFIX) ? null : prev));
      // Absent whenever the bridge hid nothing (and on ?curate=off), so this clears itself as soon
      // as the board stops being narrowed — the notice can never outlive the condition it describes.
      setCuration(d.curation || null);
      setBoardReason(d.reason || null);
      setEmptyReason(d.emptyReason || null);
      if (!mergeMode) { setBeingMatched(Number(d.beingMatched) || 0); setBeingMatchedMore(!!d.beingMatchedMore); }
      console.log(`[board] profile:${requestProfileKey} sort:${buildParams(page).match(/sort=([^&]+)/)?.[1]||"?"} page:${page} total:${d.total||0} returned:${incoming.length} source:${mergeMode?"merge":"replace"}`);
      setProfileCache?.(requestProfileKey, makeProfileSnapshot({
        jobs: mergeMode
          ? [...new Map([...jobs, ...incoming].map(j => [j.jobId, j])).values()]
          : [...new Map([
              ...incoming.map(j => [j.jobId, j]),
              ...[...sessionDislikedRef.current].filter(([id, job]) =>
                (!job.__profileKey || String(job.__profileKey) === String(requestProfileKey))
                && !incoming.some(j => j.jobId === id)
              ),
            ]).values()],
        totalJobs: d.total || 0,
        totalPages: d.totalPages || 0,
        currentPage: page,
      }));
    } catch (e) {
      // ⛔ A73 · A FAILED BOARD REQUEST MUST SAY SO. It used to throw into an effect nobody awaited:
      // the previous board stayed on screen, unchanged and unexplained, so a filter whose request
      // failed looked exactly like a filter that does nothing. Said on the board, then rethrown for
      // the callers that await it.
      if (requestSeq === jobsFetchSeqRef.current) {
        setScrapeError(`${BOARD_ERROR_PREFIX} — ${e?.message || "the request failed"}. The jobs shown are from before that change.`);
        // D45: the request ENDED — show what there is, with the error, rather than skeletons forever.
        setAnsweredKey(requestedKeyRef.current);
      }
      throw e;
    } finally {
      if (requestSeq === jobsFetchSeqRef.current) setBgLoading(false);
      if (inFlightRef.current === flightKey) inFlightRef.current = null;
    }
  }, [activeDomainProfile, buildParams, boardTab, jobs, makeProfileSnapshot, setProfileCache]);
  // Keep stable ref in sync so callbacks with empty deps (e.g. startPollLoop) always
  // call the current fetchJobs closure without needing it in their dep arrays.
  fetchJobsRef.current = fetchJobs;

  // -- Boot --------------------------------------------------
  //
  // This effect deliberately does NOT fetch /api/jobs, and must not start again.
  //
  // It used to open with api("/api/jobs?page=1&pageSize=25&sort=dateDesc") — a hardcoded
  // querystring, i.e. a SECOND param builder alongside buildParams, which is the one thing
  // buildParams exists to prevent. Three separate defects came out of that one line:
  //
  //   1. It ignored every committed filter, so whatever it returned was the unfiltered first page.
  //   2. It had neither of fetchJobs' two guards — no jobsFetchSeqRef sequence check and no
  //      activeProfileKeyRef check — so its response could not be recognised as stale and simply
  //      won whenever it landed last.
  //   3. Its dep array is [user], and JobsConsole was rebuilding `user` as a fresh object literal
  //      on every parent render (see client/src/consoles/PlanConsoles.jsx), so it re-ran on any
  //      ancestor re-render and called setJobs() with (1). That is the "board reverts to its
  //      first-load state on trivial interaction" report, and it was measured: one click on IMPORT
  //      produced one unfiltered /api/jobs and reset the list.
  //
  // Nothing was lost by deleting it. The "Re-fetch when server-side filters/sort/tab change" effect
  // below already runs on mount and loads the board through buildParams()/fetchJobs(), and fetchJobs
  // sets every piece of state this used to set — jobs, totalJobs, totalPages and attribution. The
  // categories and resumes loads below are genuine boot-only reads and stay here.
  useEffect(() => {
    if (!user) return;
    Promise.all([
      api("/api/categories"),
      api("/api/resumes"),
    ]).then(([cats, gr]) => {
      setCategories(cats || []);
      if (gr?.length) {
        const map = {};
        // ⛔ D57: `atsReport` is the PARSED report (/api/resumes sends both) — the raw `ats_report` string
        // reached the ATS card as a "report" with no score field and no terms after every reload.
        gr.forEach(r => { map[r.job_id] = { html:"__exists__", status:"exists", atsScore:r.ats_score,
          atsReport:r.atsReport ?? null, company:r.company, title:r.role, baseAtsScore: r.base_ats_score ?? null,
          generatedAt: r.generated_at ? Number(r.generated_at) * 1000 : null,
          jobId:r.job_id, tool:r.apply_mode === "CUSTOM_SAMPLER" ? A_PLUS_TOOL : GENERATE_TOOL,
          toolLabel:r.apply_mode === "CUSTOM_SAMPLER" ? TOOL_LABELS[A_PLUS_TOOL] : r.apply_mode === "BYO_MODEL" ? "Your own model" : TOOL_LABELS[GENERATE_TOOL] }; });
        setGenerated(map);
      }
    }).catch(console.error);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    if (!activeProfileResumePath || !activeProfileEnhanceStatusPath) {
      setResumeText("");
      setFileName("");
      setEnhanceUsed(false);
      setEnhancePaid(false);
      setResumeState("loading");   // no profile yet: nothing has been read, so nothing is "missing"
      return;
    }
    let live = true;
    setResumeState("loading");
    Promise.all([
      api(activeProfileResumePath, { timeoutMs: 10000 }),
      api(activeProfileEnhanceStatusPath, { timeoutMs: 10000 }),
    ]).then(([resume, status]) => {
      if (!live) return;
      setResumeState("ready");
      setResumeText(resume?.content || "");
      setFileName(resume?.name || (resume?.content ? "Saved resume" : ""));
      setEnhanceUsed(!!status?.enhanceUsed);
      setEnhancePaid(!!status?.enhancePaid);
    }).catch(() => {
      if (!live) return;
      // D156 (6): a failed read is an error, never "no résumé" — the notice says it could not be read and offers Try again.
      setResumeState("error");
      setResumeText("");
      setFileName("");
      setEnhanceUsed(false);
      setEnhancePaid(false);
    });
    return () => { live = false; };
  }, [user, activeProfileResumePath, activeProfileEnhanceStatusPath, resumeTry]);

  // Bulk-import completion effect removed in cleanup 5.3. `extensionState` is a hardcoded
  // { status: "IDLE" } literal, so neither branch could ever run — it watched for DONE/ERROR
  // states that nothing has published since the bridge became a stub.

  // "rm-extension:event" listener removed in cleanup 5.3. It handled LINKEDIN_LOGIN_REQUIRED,
  // which only the bulk-import flow ever published, and its handler wrote the two pieces of
  // state removed above. Nothing dispatches this event any more — the bridge that did is a stub.

  useEffect(() => {
    if (["linkedin", "linkedin_saved"].includes(boardTab)) setBoardTab("saved");
  }, [boardTab, setBoardTab]);

  // Re-fetch when server-side filters/sort/tab change (background — board stays visible)
  // Note: localSearch is NOT in this dep array — it has its own debounced effect below
  useEffect(() => {
    if (!user) return;
    const page = nextFetchPageRef.current || 1;
    nextFetchPageRef.current = 1;
    fetchJobs(page).catch(() => {});   // A73: fetchJobs puts the failure on the board itself
  }, [sortBy, roleFilter, locationFilter, workType, employmentTypePrefs, catFilter, srcFilter,
      minYoe, maxYoe, maxApplicants, visitedFilter, ageFilter, boardTab, refreshKey,
      profileSwitchKey, activeProfileKey,
      // Fifth time, and added in the same commit that introduces them — see the note below.
      domainFilter, appliedFilter,
      // FE-2's Task-4 params (salaryMin/Max, workModels, experienceLevels, skillsInclude,
      // sponsorFriendly) feed the SAME buildParams()/fetchJobs() call as the legacy filters
      // above — they were missing from this list, so changing ONLY one of them (leaving every
      // legacy filter untouched) would build the right querystring but never actually refetch.
      salaryMin, salaryMax, workModels, experienceLevels, skillsInclude, sponsorFriendly,
      companySponsors, hideEligibility, trulyEntry, hideGhost,
      // Same failure, third time this file has been at risk of it: a new filter that feeds
      // buildParams but is missing HERE builds a correct querystring that is never sent, so the
      // control looks dead. FE-3 fixed it for FE-2's params; these four are added in the same
      // commit that introduces them precisely so there is no fourth time. Verified by changing
      // only a provider pill and watching a request fire.
      sourcesInclude, sourcesExclude, tiersInclude, tiersExclude,
      // Fourth time. curateOff feeds buildParams (?curate=off), so it belongs here for exactly the
      // reason the four above do — without it, "Show all N" would build the right querystring and
      // never send it, and the control would look dead.
      curateOff,
      // D24's fit clause, added with it — the same reason as every entry above.
      fitBands,
      // D30's domain and location dials — the same reason again.
      jobFunctions, places,
      // D42's sector and strict toggle — and again.
      sectors, strictTags,
      // ⛔ 45r: D179 (a)'s role (?category / ?subcategory) and "using [technology]" (?tech) fed buildParams from 45l
      // (bb13d510) and were missing here — picking a role or a technology on page 1 sent nothing. The same reason again.
      taxRole, techFilter,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- The search bar's params land here ------------------------------------------------------
  //
  // UnifiedSearchBar publishes { query, location, experience, domain, status }; this maps that onto
  // the board's ALREADY-EXISTING committed filter state, so the bar reaches /api/jobs through
  // buildParams like every other control and adds no second param builder. Each of the five is set
  // unconditionally, including back to its empty value — clearing a control in the bar has to clear
  // the board, and a truthy-only assignment would strand the previous value.
  //
  // Mapping, and why each target:
  //   query      -> localSearch     the server ORs it across title/company/description. It is the
  //                                 same state the collapsed pill's "Filter jobs…" input and the
  //                                 board's own "Filter loaded jobs" box already write, so all
  //                                 three search inputs are one filter rather than three.
  //   location   -> locationFilter  LIKE sj.location.
  //   experience -> experienceLevels  the array the FILTERS drawer's own pills write. Shared state,
  //                                 so the bar and the drawer cannot disagree about what "Senior"
  //                                 means, and whichever was touched last is what is on screen.
  //   domain     -> domainFilter    sj.bucket_domain.
  //   status     -> boardTab / ageFilter / appliedFilter, below.
  //
  // `status` is the one that fans out, because it is three unrelated dimensions in one select:
  //   "starred" is the Saved tab (boardTab), "new" is the same 24h window the NEW IN 24H pill sets
  //   (ageFilter), and "applied" is uj.applied. Each is reset when status moves off it, so
  //   switching from Starred to New leaves the board on New alone and not on both.
  //
  // NOT in the dep array: every setter, and boardTab. The setters are stable; boardTab is written
  // here, and including it would make this effect re-run on a tab change made from the pill or the
  // board and stamp the bar's stale status back over it.
  //
  // ⛔ D26/D27 · ONLY THE KEYS THE BAR PUBLISHED. The board's bar now carries the search input alone, so
  // it publishes `query` and nothing else; applying the other four as "" on every search is how a
  // search silently cleared the sentence's level (experience) and posted (status -> ageFilter) clauses
  // and dropped the Saved tab. A key that is not in the published object is not touched.
  useEffect(() => {
    const bf = barFilters || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(bf, k);
    const { query = "", location = "", experience = "", domain = "", status = "" } = bf;
    if (has("query")) setLocalSearch(query);
    if (!has("location") && !has("experience") && !has("domain") && !has("status")) return;
    if (has("location")) setLocationFilter(location);
    // Identity-preserving, and it has to be. A bare `experience ? [experience] : []` allocates a
    // FRESH array on every apply, so even when the Experience select has not been touched React
    // sees a new value, and `experienceLevels` is in the refetch effect's dep array — which fired a
    // second, redundant /api/jobs alongside the debounced one the keyword search already sends.
    // Measured: one click on Search produced two identical requests for
    // `localSearch=software+engineer`. Returning `prev` unchanged collapses that back to one.
    if (has("experience")) setExperienceLevels(prev => {
      const next = experience ? [experience] : [];
      const same = prev.length === next.length && prev.every((v, i) => v === next[i]);
      return same ? prev : next;
    });
    if (has("domain")) setDomainFilter(domain);
    if (has("status")) {
      setBoardTab(status === "starred" ? "saved" : "all");
      setAgeFilter(status === "new" ? "1d" : "");
      setAppliedFilter(status === "applied" ? "1" : "");
    }
  }, [barFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // The LIVE half of the bar's double-click. The first click only commits the filters above (a
  // re-query of what we already hold); the second additionally goes out through handleSearch, which
  // is the same path CHECK FOR NEW JOBS uses — including its "create a profile" / "upload a base
  // resume" guards, so an unconfigured account gets the existing message rather than a silent no-op.
  //
  // Keyed on a counter, not on barFilters, so searching the same terms twice runs twice. The mount
  // skip is the same hazard the debounced-search effect documents below: at tick 0 nobody has
  // clicked anything, and firing a live aggregator search on every board mount is exactly the
  // unrequested request that effect exists to avoid.
  const liveSearchReady = useRef(false);
  useEffect(() => {
    if (!liveSearchReady.current) { liveSearchReady.current = true; return; }
    const q = (barFilters?.query || "").trim();
    if (!q) return;
    handleSearchRef.current?.(q);
  }, [liveSearchTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSearchPhase("idle");
  }, [activeProfileKey, searchInput]);

  // Curation is a property of the ACTIVE profile, so opting out of one profile's curation must not
  // silently carry into the next — that would be a hidden filter state surviving the thing it was
  // scoped to, which is the failure mode this whole notice exists to remove.
  useEffect(() => {
    setCurateOff(false);
  }, [activeProfileKey]);

  // Debounced backend search — fires 300ms after user stops typing.
  //
  // Two things here are load-bearing, and the board came up empty on every cold load without
  // them.
  //
  // 1. It must NOT fire on mount. `localSearch` starts "" and this effect ran once anyway, 300ms
  //    after mount — a "search" for the empty string that nobody typed. The board is already
  //    being loaded by the boot effect and the refetch effect, so that call was never needed;
  //    it only raced them.
  //
  // 2. It must call through fetchJobsRef, not the captured `fetchJobs`. The dep array is
  //    [localSearch] alone, so when localSearch never changes the effect never re-runs and the
  //    timer keeps the closure from the FIRST render — the render where /api/domain-profiles had
  //    not answered yet, so activeDomainProfile was still null. That stale closure hit
  //    fetchJobs' "no active profile" branch and called setJobs([]) 300ms in, wiping the 11 jobs
  //    the real fetch had just delivered ~170ms earlier. Traced in a browser: `fetchJobs SET
  //    {total:11}` at +3661ms, then `fetchJobs ENTER {hasProfile=false, nProfiles=0}` at +3838ms
  //    while the component's own next render logged nProfiles:1 — the call was reading a dead
  //    render's state. fetchJobsRef is already maintained a few lines above for exactly this
  //    hazard (startPollLoop's empty deps); this is the second caller that needed it.
  const searchDebounceReady = useRef(false);
  useEffect(() => {
    // The mount-skip is checked BEFORE the `user` guard on purpose. Putting it after would leave
    // the flag unset whenever the component mounts logged-out, and the user's FIRST real search
    // would then be swallowed as if it were the mount run.
    if (!searchDebounceReady.current) { searchDebounceReady.current = true; return; }
    if (!user) return;
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchJobsRef.current?.(1)?.catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Multi-session sync — reflect changes from other tabs/devices without full reload
  const boardScoredTimerRef = useRef(null);
  // ⭐ 45s: an EMPTY page whose postings are still being matched re-asks every 5 s (≤ 4 minutes) — the live event is the fast
  // path; this is the one that never misses.
  const matchingPollRef = useRef({ started: 0 });
  useEffect(() => {
    if (!(jobs.length === 0 && beingMatched > 0 && currentPage <= 1)) { matchingPollRef.current.started = 0; return undefined; }
    if (!matchingPollRef.current.started) matchingPollRef.current.started = Date.now();
    if (Date.now() - matchingPollRef.current.started > 4 * 60 * 1000) return undefined;
    const t = setTimeout(() => { fetchJobsRef.current?.(1).catch(() => {}); }, 5000);
    return () => clearTimeout(t);
  }, [jobs.length, beingMatched, currentPage]);
  useEffect(() => () => clearTimeout(boardScoredTimerRef.current), []);
  useSyncEvents({
    // ⭐ A126 (7): the match queue scored a chunk of this board's held-back postings — refetch the view on screen so they
    // land in the current sort. Debounced (one refresh per 4 s at most); page 1 only, so a person paging is not moved.
    // ⛔ 45s (owner 11-09: "its not matching me any jobs for construction pm"): a THROTTLE now, not a debounce — the queue
    // sends one of these every ~4 s while it scores, and resetting the timer on each one put the refresh off until the
    // whole queue had drained, so a board held back after a new résumé stayed empty for minutes.
    board_scored: () => {
      if (boardScoredTimerRef.current) return;   // one refresh already on its way
      boardScoredTimerRef.current = setTimeout(() => { boardScoredTimerRef.current = null; if (currentPage <= 1) fetchJobsRef.current?.(1).catch(() => {}); }, 4000);
    },
    job_flag: ({ jobId, starred, disliked }) => {
      setJobs(prev => prev.map(j =>
        j.jobId === jobId
          ? { ...j, ...(starred  != null ? { starred:  !!starred,  disliked: false } : {}),
                     ...(disliked != null ? { disliked: !!disliked, starred:  false } : {}) }
          : j
      ));
    },
    // ⭐ D86: a résumé can now arrive from OUTSIDE the panel — the user's own ChatGPT or Claude saved it. Mark it
    // stored ("__exists__", D57) so the panel offers View and Download, which READ the store and never generate.
    // A résumé this tab is generating already has its html here and is left alone.
    resume_generated: ({ jobId, atsScore } = {}) => {
      // D147: past page 1 the board is SCROLLED pages, so the refresh merges into them instead of replacing them.
      fetchJobs(currentPage, currentPage > 1).catch(() => {});
      if (!jobId) return;
      setGenerated(p => (p[jobId]?.html && p[jobId].html !== "__exists__") ? p : { ...p, [jobId]: { ...(p[jobId] || {}),
        html: "__exists__", status: "exists", atsScore: atsScore ?? null, jobId, tool: GENERATE_TOOL,
        toolLabel: TOOL_LABELS[GENERATE_TOOL], generatedAt: Date.now() } });
    },
    // ⭐ D57: a résumé deleted (Settings → Your data, or another tab) frees the job's Résumé button here.
    resume_deleted: ({ jobId }) => {
      if (!jobId) return;
      setGenerated(p => { if (!p[jobId]) return p; const n = { ...p }; delete n[jobId]; return n; });
    },
    profile_switched: ({ profileId }) => {
      if (profileId) setActiveProfileId?.(Number(profileId));
      setProfileSwitchKey(k => k + 1);
    },
    scrape_complete: () => {
      fetchJobs(1).catch(() => {});
    },
  });

  // Shared poll loop — used by handleSearch, handlePullRefresh, handleSetRole
  const startPollLoop = useCallback((roleQ, pollSince) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setPollStatus("polling");
    let failCount = 0;
    const seenIds = new Set();
    let totalNew = 0;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const qs = new URLSearchParams({ since: String(pollSince), query: roleQ });
        const pollData = await api(`/api/jobs/poll?${qs.toString()}`);
        failCount = 0;
        if (pollData.needsProfileSetup) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setScraping(false);
          setPollStatus("idle");
          setScrapeError("Create a job search profile to load matching jobs.");
          return;
        }
        if (pollData.needsBaseResume) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setScraping(false);
          setPollStatus("idle");
          setScrapeError("Upload the active profile's base resume before searching jobs.");
          return;
        }
        if (pollData.scrapeUnavailable && pollData.message) {
          setScrapeError(pollData.message);
        }

        const newJobs = (pollData.jobs || []).filter(j => !seenIds.has(j.jobId));
        if (newJobs.length > 0) {
          newJobs.forEach(j => seenIds.add(j.jobId));
          totalNew += newJobs.length;
          // Re-read through /api/jobs so progressive merges honor local filters,
          // profile hard constraints, sort mode, and pagination consistently.
          fetchJobsRef.current?.(1)?.catch(() => {});
        }

        if (!pollData.scraping) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setScraping(false);
          setPollStatus("idle");
          // Re-fetch from DB with current sort so poll-prepended jobs end up in correct order
          fetchJobsRef.current?.(1)?.catch(() => {});
        }
      } catch {
        failCount++;
        if (failCount >= 3) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setScraping(false);
          setPollStatus("error");
          setScrapeError("Could not fetch new jobs. Try again in a minute.");
        }
      }
    }, POLL_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activateProfileForSearch = useCallback(async (profileId) => {
    await api(`/api/domain-profiles/${profileId}/activate`, { method: "POST" });
    setDomainProfiles(prev => prev.map(p => ({ ...p, is_active: p.id === profileId ? 1 : 0 })));
    setActiveProfileId?.(profileId);
    setProfileSwitchKey(k => k + 1);
  }, [setActiveProfileId]);

  // FE-3: persist the CURRENTLY-COMMITTED filter set (buildParams(1), same querystring
  // fetchJobs already sent) as this profile's tracked search — not pendingFilters, so "save"
  // always captures exactly what's on screen right now.
  const saveTrackedSearch = useCallback(async () => {
    if (!activeDomainProfile?.id) return;
    try {
      const data = await api(`/api/domain-profiles/${activeDomainProfile.id}/tracked-search`, {
        method: "PUT",
        body: JSON.stringify({ params: buildParams(1) }),
      });
      setDomainProfiles(prev => prev.map(p =>
        p.id === activeDomainProfile.id ? { ...p, tracked_search: data.trackedSearch } : p
      ));
    } catch(e) {
      setScrapeError(e.message || "Could not save search.");
    }
  }, [activeDomainProfile, buildParams]);

  const clearTrackedSearch = useCallback(async () => {
    if (!activeDomainProfile?.id) return;
    try {
      await api(`/api/domain-profiles/${activeDomainProfile.id}/tracked-search`, {
        method: "PUT",
        body: JSON.stringify({ params: null }),
      });
      setDomainProfiles(prev => prev.map(p =>
        p.id === activeDomainProfile.id ? { ...p, tracked_search: null } : p
      ));
    } catch(e) {
      setScrapeError(e.message || "Could not clear saved search.");
    }
  }, [activeDomainProfile]);

  // Loads a tracked search's saved querystring back into filter state. The refetch effect
  // (dependent on all of these) then fires fetchJobs on its own — no direct fetchJobs call here.
  const applyTrackedSearch = useCallback(() => {
    const saved = activeDomainProfile?.tracked_search;
    if (!saved?.params) return;
    const p = new URLSearchParams(saved.params);
    setRoleFilter(p.get("role") || "");
    setLocationFilter(p.get("location") || "");
    setWorkType(p.get("workType") || "");
    setEmploymentTypePrefs(p.get("employmentType") ? p.get("employmentType").split(",") : ["full-time"]);
    setCatFilter(p.get("category") || "");
    setSrcFilter(p.get("source") || "");
    setMinYoe(p.get("minYoe") || "");
    setMaxYoe(p.get("maxYoe") || "");
    setMaxApplicants(p.get("maxApplicants") || "");
    setVisitedFilter(p.get("visited") || "");
    setAgeFilter(p.get("ageFilter") || "");
    setDomainFilter(p.get("domain") || "");
    setAppliedFilter(p.get("applied") || "");
    setLocalSearch(p.get("localSearch") || "");
    if (p.get("sort")) setSortBy(p.get("sort"));
    setSalaryMin(p.get("salary_min_usd") || "");
    setSalaryMax(p.get("salary_max_usd") || "");
    setWorkModels(p.get("work_models") ? p.get("work_models").split(",") : []);
    setExperienceLevels(p.get("experience_levels") ? p.get("experience_levels").split(",") : []);
    setSkillsInclude(p.get("skills_include") ? p.get("skills_include").split(",") : []);
    setSponsorFriendly(p.get("sponsorship_friendly") === "1");
    setCompanySponsors(p.get("company_sponsorship") || "");
    setHideEligibility(p.get("hide_eligibility_required") === "1");
    setTrulyEntry(p.get("truly_entry") === "1");
    setHideGhost(p.get("hide_ghost") === "1");
    // A saved search stores buildParams' raw querystring, so a param buildParams emits but this
    // function never reads is silently dropped on apply — the saved search would come back
    // subtly wider than the one that was saved. These four round-trip through the same
    // comma-joined encoding buildParams writes.
    const csv = key => (p.get(key) ? p.get(key).split(",") : []);
    setSourcesInclude(csv("sources_include"));
    setSourcesExclude(csv("sources_exclude"));
    setTiersInclude(csv("tiers_include"));
    setTiersExclude(csv("tiers_exclude"));
    // D42: the company sector and the strict toggle round-trip the same way.
    setSectors(csv(SECTORS.param));
    setStrictTags(p.get("strict_tags") === "1");
    // ⛔ 45r: D179 (a)'s role and technology (45l, bb13d510) were saved and never restored — a saved search came back
    // wider. The subcategory is enough for the board (buildParams sends it alone); a category-only role shares the
    // ?category name with the older category filter and is restored through setCatFilter above, as before.
    setTaxRole({ category: "", subcategory: p.get("subcategory") || "", also: p.get("also_subcategory") || "" });   // D186-5: + also fits
    setTechFilter(p.get("tech") || "");
    setCurrentPage(1);
    // ⭐ D159 T2 (46y): opening the saved search IS looking at it — its tracker's "new since last seen" restarts from now.
    api(`/api/trackers/searches/${activeDomainProfile.id}/seen`, { method: "POST" }).catch(() => {});
  }, [activeDomainProfile]);

  // ⭐ D159 T2 (46y): Job Profiles → Trackers → Open lands here as /app/jobs?tracker=<profile id> (that profile made active
  // first) — the saved search is applied once and the parameter taken off the address.
  const trackerApplied = useRef(false);
  useEffect(() => {
    if (trackerApplied.current || !activeDomainProfile?.tracked_search?.params) return;
    let id = null;
    try { id = new URL(window.location.href).searchParams.get("tracker"); } catch { /* no window */ }
    if (!id || String(activeDomainProfile.id) !== id) return;
    trackerApplied.current = true;
    try { const u = new URL(window.location.href); u.searchParams.delete("tracker"); window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`); } catch { /* fine */ }
    applyTrackedSearch();
  }, [activeDomainProfile, applyTrackedSearch]);

  const askSearchIntent = useCallback((prompt) => new Promise(resolve => {
    searchIntentResolveRef.current = resolve;
    setSearchIntentPrompt(prompt);
  }), []);

  const closeSearchIntentPrompt = useCallback((accepted) => {
    const resolve = searchIntentResolveRef.current;
    searchIntentResolveRef.current = null;
    setSearchIntentPrompt(null);
    resolve?.(accepted);
  }, []);

  const deleteDomainProfile = useCallback(async (profileId) => {
    const profile = domainProfiles.find(p => p.id === profileId);
    if (!profile || domainProfiles.length <= 1) return;
    if (!confirm(`Delete job profile "${profile.profile_name}"?`)) return;
    try {
      await api(`/api/domain-profiles/${profileId}`, { method: "DELETE" });
      deleteProfileCache?.(profileId);
      const next = await api("/api/domain-profiles");
      const rows = Array.isArray(next) ? next : [];
      setDomainProfiles(rows);
      const active = rows.find(p => p.is_active) || rows[0];
      if (active) setActiveProfileId?.(active.id);
      setProfileSwitchKey(k => k + 1);
    } catch(e) {
      setScrapeError(e.message || "Could not delete profile.");
    }
  }, [deleteProfileCache, domainProfiles, setActiveProfileId]);

  const ensureSearchProfileAlignment = useCallback(async (query) => {
    const intent = detectSearchProfileIntent(query, domainProfiles, activeDomainProfile);
    if (!intent) return true;

    if (intent.existingProfile) {
      const ok = await askSearchIntent({
        title: "Switch Profile?",
        body: `This search looks like ${intent.label}. Switch to "${intent.existingProfile.profile_name}" for this search?`,
        confirmLabel: "Switch and Search",
        cancelLabel: "Cancel Search",
      });
      if (!ok) {
        setScrapeError(`Search canceled. Switch profiles or refine the query to avoid wrong-profile results.`);
        return false;
      }
      try {
        await activateProfileForSearch(intent.existingProfile.id);
      } catch(e) {
        setScrapeError(e.message || "Could not switch profile for this search.");
        return false;
      }
      return true;
    }

    const canAddProfile = domainProfiles.length < 4;
    if (!canAddProfile) {
      setScrapeError(`This search looks like ${intent.label}, but you already have 4 profiles. Search canceled to avoid wrong-profile results.`);
      return false;
    }

    const ok = await askSearchIntent({
      title: "Add Matching Profile?",
      body: `This search fits ${intent.label}. Add that profile before searching?`,
      confirmLabel: "Add Profile",
      cancelLabel: "Cancel Search",
    });
    if (!ok) {
      setScrapeError(`Search canceled. Add the matching profile or refine the query to continue.`);
      return false;
    }
    pendingIntentSearchRef.current = query;
    setProfileWizardIntent(intent);
    setProfileWizardOpen(true);
    return false;
  }, [activeDomainProfile, activateProfileForSearch, askSearchIntent, domainProfiles]);

  // Set active role — immediately shows local DB results only.
  const handleSetRole = useCallback(async (overrideQuery, options = {}) => {
    const q = (overrideQuery || searchInput).trim();
    if (!q) return false;
    if (!activeDomainProfile) {
      setScrapeError("Create a job search profile before setting a search role.");
      setProfileWizardOpen(true);
      return false;
    }
    if (!resumeText.trim()) {
      setScrapeError("Upload the active profile's base resume before setting a search role.");
      return false;
    }
    if (!options.skipProfileIntent) {
      const aligned = await ensureSearchProfileAlignment(q);
      if (!aligned) return false;
    }
    setScrapeError("");
    const roleQ = q.toLowerCase();
    setRoleFilter(roleQ);
    setSearchInput(q);
    setSearchCommitted(true);
    await fetchJobs(1, false, { overrides: { role: roleQ } });
    return true;
  }, [activeDomainProfile, resumeText, searchInput, ensureSearchProfileAlignment, fetchJobs]);

  // -- Scrape / search ---------------------------------------
  const handleSearch = useCallback(async (overrideQuery, options = {}) => {
    const q = (overrideQuery || searchInput).trim();
    if (!q) return;
    if (!activeDomainProfile) {
      setScrapeError("Create a job search profile before searching jobs.");
      setProfileWizardOpen(true);
      return;
    }
    if (!resumeText.trim()) {
      setScrapeError("Upload the active profile's base resume before searching jobs.");
      return;
    }
    if (!options.skipProfileIntent) {
      const aligned = await ensureSearchProfileAlignment(q);
      if (!aligned) return;
    }
    setScrapeError("");
    setSearchCommitted(true);
    const immediateRoleQ = q.toLowerCase();
    setRoleFilter(immediateRoleQ);
    // Fetch from aggregator — results come back directly, no scraping needed
    await fetchJobs(1, false, { overrides: { role: immediateRoleQ } });
  }, [activeDomainProfile, resumeText, searchInput, fetchJobs, ensureSearchProfileAlignment]); // eslint-disable-line react-hooks/exhaustive-deps
  handleSearchRef.current = handleSearch;

  // -- Pull / Check-for-new: DB-first, then scrape if quota unmet -
  // Merges new jobs into the board; removes visited entries.
  const handlePullRefresh = useCallback(async () => {
    const q = (searchInput || roleFilter).trim();
    if (!q) return false;
    if (!activeDomainProfile) {
      setScrapeError("Create a job search profile before checking for jobs.");
      setProfileWizardOpen(true);
      return false;
    }
    if (!resumeText.trim()) {
      setScrapeError("Upload the active profile's base resume before checking for jobs.");
      return false;
    }
    if (bgLoading) return false;
    setScrapeError("");
    const immediateRoleQ = q.toLowerCase();
    setRoleFilter(immediateRoleQ);
    // Fetch from aggregator — results come back directly
    await fetchJobs(1, false, { overrides: { role: immediateRoleQ } });
    setSearchPhase("idle");
    return true;
  }, [searchInput, roleFilter, bgLoading, fetchJobs, activeDomainProfile, resumeText]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Resume Enhancer ------------------------------------------
  const handleEnhance = useCallback(async () => {
    if (enhancing) return;
    if (!activeProfileEnhancePath) {
      setUploadError("Select a job profile before enhancing its resume.");
      return;
    }
    setEnhancing(true);
    try {
      const result = await api(activeProfileEnhancePath, { method: "POST" });
      setEnhanceResult(result);
      setEnhanceModalOpen(true);
    } catch(e) {
      if (e.status === 403) {
        setEnhanceUsed(true);
      } else {
        setUploadError("Enhancement failed: " + e.message);
      }
    } finally {
      // Consume the free use regardless of outcome — server already set enhance_used
      setEnhanceUsed(true);
      setEnhancing(false);
    }
  }, [enhancing, activeProfileEnhancePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdoptEnhanced = useCallback(async () => {
    try {
      if (!activeProfileAdoptEnhancedPath) throw new Error("No active profile");
      await api(activeProfileAdoptEnhancedPath, { method: "PATCH" });
      if (enhanceResult?.enhanced?.text) setResumeText(enhanceResult.enhanced.text);
    } catch(e) { console.warn("[adopt]", e.message); }
    setEnhanceModalOpen(false);
  }, [enhanceResult, activeProfileAdoptEnhancedPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- File upload -------------------------------------------
  const handleFile = useCallback(async e => {
    const file = e.target.files[0]; if (!file) return;
    if (!activeProfileResumePath) {
      setUploadError("Create or select a job profile before uploading a resume.");
      return;
    }
    setFileName(file.name); setUploading(true); setUploadError("");
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let text = "";
      if (ext === "pdf") {
        const fd = new FormData(); fd.append("file", file);
        const r = await fetch("/api/parse-pdf", { method:"POST", credentials:"include", headers:authHeaders(), body:fd });
        const d = await r.json(); if (d.error) throw new Error(d.error);
        text = d.text;
      } else if (ext === "docx") {
        const mammoth = (await import("mammoth")).default;
        text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else { text = await file.text(); }
      setResumeText(text);
      setResumeState("ready");
      await api(activeProfileResumePath, { method:"POST", body:JSON.stringify({ content:text, name:file.name }) });
    } catch(err) {
      setUploadError("Error: " + err.message);
      setFileName(""); if (fileRef.current) fileRef.current.value = "";
    } finally { setUploading(false); }
  }, [activeProfileResumePath]);

  // -- A stored résumé, opened from the store ----------------
  // ⛔ e2e 11-05 (step 3): VIEWING A STORED RÉSUMÉ IS NOT GENERATING ONE. "View résumé" on a résumé stored on an
  // earlier visit (`__exists__`) used to go through generateActual, which returns silently unless the plan may
  // generate AND the profile's base résumé text has loaded — so right after a page load (the text still in flight),
  // or on a plan without Generate, the button did nothing at all. Reading your own stored résumé needs neither.
  const viewStoredResume = useCallback(async (job, tool = "generate") => {
    tool = normalizeTool(tool);
    const key = job.jobId, existing = generated[key];
    if (loading[key]) { return; }
    setLoading(p => ({ ...p, [key]: tool }));
    try {
      const d = await api(`/api/resumes/${encodeURIComponent(key)}`);
      const entry = buildArtifact(job, { html: d.html, ats_score: d.ats_score, base_ats_score: d.base_ats_score, atsReport: d.atsReport, company: d.company, role: d.role, tool,
        generatedAt: existing?.generatedAt ?? null }, tool);
      setGenerated(p => ({ ...p, [key]: entry }));
      openSandbox({ ...entry, company: entry.company, title: entry.title });
      openAtsPanel(buildAtsPayload(job, entry), job);
    } catch(e) {
      setSandbox({ generating: false, status:"missing", missing:true, error: e.message, company: job.company, title: job.title });
    }
    finally { setLoading(p => { const n = {...p}; delete n[key]; return n; }); }
  }, [generated, loading, openSandbox]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Generate (actual logic) -------------------------------
  // ⭐ D164: why there is no résumé text to tailor — a read that failed or has not come back is never "no résumé" (D156 6).
  const noResumeTextReason = useCallback(() => (
    resumeState === "error" ? "Your résumé could not be read just now, so nothing was generated."
      : resumeState === "loading" ? "Your résumé is still loading — try again in a moment."
      : "This job profile has no résumé on file — choose another under Which résumé, or add one in Job profiles."
  ), [resumeState]);
  const failGen = useCallback((key, message) => {
    setGenFailed(p => ({ ...p, [key]: { message: String(message || "The résumé could not be generated."), at: Date.now() } }));
  }, []);
  const clearGenFailed = useCallback((key) => {
    setGenFailed(p => { if (!p[key]) return p; const n = { ...p }; delete n[key]; return n; });
  }, []);

  // `source` (D164): { resumeText } — the base résumé of the job profile chosen under the posting's "Which résumé", when it
  // is not the board's active one. Absent, the active profile's text is used, as always.
  const generateActual = useCallback(async (job, force = false, skipCompanyCheck = false, tool = "generate", source = null) => {
    tool = normalizeTool(tool);
    const key = job.jobId, existing = generated[key];
    const baseText = source?.resumeText || resumeText;
    // A stored résumé is opened, never gated on the generate checks below (viewStoredResume).
    if (existing?.html === "__exists__" && existing.tool === tool && !force) { await viewStoredResume(job, tool); return; }
    if (tool === A_PLUS_TOOL ? !canUseAPlusResume : !canUseGenerate) { return; }
    if (!baseText)              { failGen(key, noResumeTextReason()); return; }
    if (loading[key]) { return; }
    clearGenFailed(key);
    const existingArtifact = getActiveArtifact(existing, tool);
    if (existingArtifact?.html && existingArtifact.html !== "__exists__" && !force) {
      const entry = {...existing, ...existingArtifact, company:existingArtifact.company||job.company, title:existingArtifact.title||job.title};
      openSandbox(entry);
      openAtsPanel(buildAtsPayload(job, existing), job);
      return;
    }

    // Open sandbox with skeleton state immediately
    openSandbox({ generating: true, status:"loading", company: job.company, title: job.title, jobId:key, tool, toolLabel:TOOL_LABELS[tool] });

    // Cycle through generation stages
    const stages = [
      [0,    "Analysing job description…"],
      [5000, "Selecting companies…"],
      [12000,"Writing experience bullets…"],
      [22000,"Formatting resume…"],
    ];
    if (genTimerRef.current) clearInterval(genTimerRef.current);
    const startTime = Date.now();
    const advanceStage = () => {
      const elapsed = Date.now() - startTime;
      const current = [...stages].reverse().find(([ms]) => elapsed >= ms);
      const stage = current?.[1] || stages[0][1];
      setGenStage(stage);
      setSandbox(s => s?.generating ? { ...s, stage } : s);
    };
    advanceStage();
    genTimerRef.current = setInterval(advanceStage, 1000);

    setLoading(p => ({ ...p, [key]:tool }));
    try {
      const d = await api("/api/generate", { method:"POST",
        body:JSON.stringify({ jobId:key, job, resumeText: baseText, forceRegen:force, tool }) });
      if (d.limitReached) {
        setSandbox({ generating: false, status:"error", error: d.error, company: job.company, title: job.title });
        failGen(key, d.error);   // D164: said on the posting too, not only in the sandbox
        return; // don't throw, just show error in sandbox panel
      }
      if (d.error) throw new Error(d.error);
      const artifact = buildArtifact(job, d, tool);
      setGenerated(p => ({ ...p, [key]: mergeArtifact(p[key], artifact) }));
      clearGenFailed(key);
      openSandbox(mergeArtifact(generated[key], artifact));
      openAtsPanel(buildAtsPayload(job, artifact), job);
    } catch(e) {
      setSandbox({ generating: false, status:"error", error: e.message, company: job.company, title: job.title });
      failGen(key, e.message);   // D164: the posting's Résumé control says "Failed — Try again", never "no résumé"
    }
    finally {
      if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; }
      setGenStage("");
      setLoading(p => { const n = {...p}; delete n[key]; return n; });
    }
  }, [resumeText, generated, loading, canUseGenerate, canUseAPlusResume, openSandbox, viewStoredResume, failGen, clearGenFailed, noResumeTextReason]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- Generate (with company-reuse check) ------------------
  const generate = useCallback(async (job, force = false, tool = "generate", source = null) => {
    tool = normalizeTool(tool);
    if (tool === A_PLUS_TOOL ? !canUseAPlusResume : !canUseGenerate) { return; }
    if (!(source?.resumeText || resumeText)) { failGen(job.jobId, noResumeTextReason()); return; }
    if (loading[job.jobId])     { return; }
    // Company check: if we have a prior resume for this company and this is a fresh generate (not force),
    // show the reuse modal instead of generating.
    if (!force) {
      const priorEntry = Object.values(generated).find(v =>
        getActiveArtifact(v)?.html && getActiveArtifact(v)?.html !== "__exists__" &&
        getActiveArtifact(v)?.company?.toLowerCase() === (job.company || "").toLowerCase()
      );
      if (priorEntry && !generated[job.jobId]?.html) {
        setCompanyReuseTarget({ job, priorEntry, tool, source });
        return;
      }
    }
    await generateActual(job, force, false, tool, source);
  }, [generated, generateActual, resumeText, canUseGenerate, canUseAPlusResume, loading, failGen, noResumeTextReason]);

  // ⭐ D164 · WHICH RÉSUMÉ: generate from the base résumé of the job profile chosen on the posting. The board's active
  // profile is the plain path; another profile's base résumé is read (GET /api/domain-profiles/:id/base-resume — the
  // read the board already makes for its active one) and handed to the same generate, for THIS posting only — choosing
  // it never switches the board's profile (that stays the Profile menu's switcher).
  const generateFrom = useCallback(async (job, force = false, { profileId = null } = {}) => {
    const key = job.jobId;
    const activeId = activeDomainProfile?.id ?? null;
    if (profileId == null || String(profileId) === String(activeId)) return generate(job, force);
    clearGenFailed(key);
    let text = "";
    try {
      const r = await api(`/api/domain-profiles/${encodeURIComponent(profileId)}/base-resume`, { timeoutMs: 10000 });
      text = r?.content || "";
    } catch (e) {
      failGen(key, `That job profile's résumé could not be read just now${e?.message ? ` (${e.message})` : ""}.`);
      return;
    }
    if (!text.trim()) { failGen(key, "That job profile has no résumé on file — choose another, or add one in Job profiles."); return; }
    return generate(job, force, GENERATE_TOOL, { resumeText: text });
  }, [activeDomainProfile, generate, failGen, clearGenFailed]);

  const saveSandboxHtml = useCallback(async (html, artifact = null) => {
    const current = artifact || getActiveArtifact(sandbox);
    if (!current) return;
    const key = current.jobId || Object.entries(generated).find(([,v]) => getActiveArtifact(v)?.company === current.company)?.[0];
    if (key) {
      await api(`/api/resumes/${key}/html`, { method:"POST", body:JSON.stringify({ html, tool:current.tool, version:current.version }) });
      setGenerated(p => {
        const prev = p[key];
        const updated = { ...current, html };
        return { ...p, [key]: mergeArtifact(prev, updated) };
      });
    }
    setSandbox(s => ({...s, html}));
  }, [sandbox, generated]);

  const exportAndTrack = useCallback(async (job, html, company, artifact = null) => {
    const current = artifact || getActiveArtifact(sandbox);
    const targetJob = job || (current?.jobId ? {
      jobId: current.jobId, company: current.company, title: current.title,
      url: current.jobUrl, source: current.source, location: current.location,
    } : null);
    const filename = `Resume_${(company||current?.company||"").replace(/\s+/g,"_")}`;
    if (current?.jobId) {
      await api(`/api/resumes/${current.jobId}/keep`, { method:"POST",
        body:JSON.stringify({ tool:current.tool, version:current.version }) }).catch(()=>{});
    }
    printResume(html, filename);
    if (targetJob) {
      // A63: exporting a résumé is not submitting one — the job is tagged Pending, not "applied",
      // until the user records the submission and it verifies (Database → Pending).
      await api("/api/applications/pending", { method:"POST", body:JSON.stringify({
        jobId:targetJob.jobId, origin:"exported_resume",
      }) }).catch(()=>{});
      await fetchJobs(currentPage, currentPage > 1);   // D147: merge into the scrolled pages
    }
  }, [applyMode, fetchJobs, currentPage, sandbox]);
  // D157: the embedded editor saves and exports through the same two calls the panel uses.
  sandboxSaveRef.current = saveSandboxHtml;
  sandboxExportRef.current = exportAndTrack;

  // -- Save / Pass / Draft — the deck's decisions, the deck's calls (A53, owner 10-02) ----------
  //
  // These were TOGGLES (PATCH /api/jobs/:id/starred and /disliked read the current value and write
  // its opposite), so a second click — or a retried request — silently undid the decision with a
  // 200, and "Queue Auto" put the job in a client-side basket a reload emptied. Now: Save and Pass
  // SET (a repeat is a no-op that shows the set state), Draft posts the run at once, and reversal
  // is Undo on the shared toast — exactly as on Today.
  //
  // A passed card stays visible (faded) for the rest of the session: sessionDislikedRef keeps it
  // through any fetchJobs call; only a reload lets the server exclusion apply.
  const applyFlags = useCallback((jobId, flags) => {
    setJobs(prev => prev.map(j => {
      if (j.jobId !== jobId) return j;
      const updated = { ...j, ...flags };
      if (flags.disliked === true) sessionDislikedRef.current.set(jobId, { ...updated, __profileKey: activeProfileKeyRef.current });
      else if (flags.disliked === false) sessionDislikedRef.current.delete(jobId);
      return updated;
    }));
    setPendingJobs(prev => prev.map(j => j.jobId !== jobId ? j : { ...j, ...flags }));
    setSelectedJob(prev => (prev && prev.jobId === jobId ? { ...prev, ...flags } : prev));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A105 finding 11: the keyboard handler (set up above, by the open posting) reaches the CURRENT decideJob.
  decideJobRef.current = (...args) => decideJob(...args);
  const lastDecisionRef = useRef(null);       // D190: the last decision, for Ask draft's Undo link (the toast's lasts 5 s)
  const undoLastDecisionRef = useRef(null);
  const decideJob = useCallback(async (job, decision, { companyOk = false } = {}) => {
    const jobId = job?.jobId || job?.id;
    if (!jobId) return;
    const prior = { starred: !!job.starred, disliked: !!job.disliked };
    // ⛔ A SET, NEVER A TOGGLE: deciding what is already decided does nothing.
    if (decision === DECISIONS.SAVED && prior.starred) return "already";
    if (decision === DECISIONS.PASSED && prior.disliked) return "already";
    if (decision === DECISIONS.DRAFTED && (isJobDrafted(jobId) || draftingIds.has(jobId))) return "already";
    // D54: warn at the second role — the user decides; nothing is refused here. A105 finding 12: the notice is the
    // toast's line with "Draft anyway" (D54 asked for a NON-blocking notice; the browser's confirm dialog was a modal block).
    if (decision === DECISIONS.DRAFTED) {
      const notice = companyOk ? null : companyNoticeFor(job);
      if (notice) { setDecisionToast({ jobId, company: job.company, decision, notice, job, at: Date.now() }); return { notice }; }
      // ⛔ D59 (owner, 10-07 (38): "only in panel"): the posting's stated citizenship / clearance is said
      // in the posting panel's line beside Draft — never a confirm at the click.
    }
    const at = Date.now();
    if (decision === DECISIONS.DRAFTED) {
      setDraftingIds(prev => new Set(prev).add(jobId));
      try {
        const r = await commitDecision({ jobId, decision, tool: draftTool, surface: DECISION_SURFACES.BOARD });
        setDraftedIds(prev => new Set(prev).add(jobId));
        setDecisionToast({ jobId, company: job.company, decision, runId: r.runId, line: r.line, prior, at });
        lastDecisionRef.current = { jobId, company: job.company, decision, runId: r.runId, prior };
        if (r.slots) setDraftSlots(r.slots);
        setFacetsNonce(n => n + 1);
        loadApplyRuns?.();
        loadCompanyIndex();
        if (boardTab === "pending") fetchJobs(1);   // D147: the list is scrolled from page 1, and a decision can drop a row
      } catch (e) {
        // ⛔ Never a success toast for a refused call. "Already drafted" IS the drafted state.
        if (e.payload?.code === "already_drafted") setDraftedIds(prev => new Set(prev).add(jobId));
        if (e.payload?.slots) setDraftSlots(e.payload.slots);
        setDecisionToast({ jobId, company: job.company, decision, error: e.message, at });
        return { error: e.message };
      } finally {
        setDraftingIds(prev => { const n = new Set(prev); n.delete(jobId); return n; });
      }
      return "done";
    }
    applyFlags(jobId, flagsFor(decision));
    setDecisionToast({ jobId, company: job.company, decision, prior, at });
    lastDecisionRef.current = { jobId, company: job.company, decision, prior };
    try {
      await commitDecision({ jobId, decision });
    } catch (e) {
      applyFlags(jobId, undoFlagsFor(decision, prior));
      setDecisionToast({ jobId, company: job.company, decision, error: e.message, at: Date.now() });
      return { error: e.message };
    }
    return "done";
  }, [applyFlags, draftTool, draftedIds, draftingIds, applyStateByJobId, loadApplyRuns, boardTab, currentPage, companyNoticeFor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ D156 (1c) · THE OPENED POSTING'S Pass · Save · Draft. On Home's deck (besideMode — the posting is drawn in the front
  // card's place): a posting the DECK opened is the deck's card, so the deck decides it (DECK_DECIDE_EVENT — one commit,
  // the deck's exit and toast); one opened from the list is decided here. Either way the posting then folds and the day's
  // card is in front again (owner 11-05: "its buttons act on that posting, then the day's card returns"). Off the deck
  // (a phone's full-screen posting) nothing changes: the board decides and the posting stays open.
  const decidePosting = (job, decision) => {
    if (!besideMode) { decideJob(job, decision); return; }
    if (postOriginRef.current === "deck") {
      window.dispatchEvent(new CustomEvent(DECK_DECIDE_EVENT, { detail: { jobId: String(job?.jobId ?? job?.id), decision } }));
    } else {
      decideJob(job, decision);
    }
    clearDeepLink();
    setSelectedJob(null);
  };
  decidePostingRef.current = decidePosting;

  const undoLastDecision = useCallback(async (given = null) => {
    const t = given || decisionToast;
    if (!t || t.error) return;
    setDecisionToast(null);
    try {
      await undoDecision({ jobId: t.jobId, decision: t.decision, runId: t.runId, prior: t.prior });
      if (t.decision === DECISIONS.DRAFTED) {
        setDraftedIds(prev => { const n = new Set(prev); n.delete(t.jobId); return n; });
        loadApplyRuns?.();
        // D51: the slot comes back and the job leaves /d — both re-read, never assumed.
        api("/api/draft/slots").then(setDraftSlots).catch(() => {});
        setFacetsNonce(n => n + 1);
        if (boardTab === "pending") fetchJobs(1);   // D147: the list is scrolled from page 1, and a decision can drop a row
      } else {
        applyFlags(t.jobId, undoFlagsFor(t.decision, t.prior));
      }
    } catch (e) {
      setDecisionToast({ jobId: t.jobId, company: t.company, decision: t.decision, error: `Could not undo: ${e.message}`, at: Date.now() });
      if (given) throw e;
    }
  }, [decisionToast, applyFlags, loadApplyRuns, boardTab, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps
  undoLastDecisionRef.current = undoLastDecision;

  // ⭐ D190 · ASK DRAFT reaches the board's OWN calls (lib/assistantBridge.js): the open posting, Draft / Save / Pass through
  // decideJob (the same one the buttons use), Undo through the toast's undo, and the sentence's own setters.
  const assistantStateRef = useRef({});
  assistantStateRef.current = { selectedJob, experienceLevels, workModels, places, localSearch };
  useEffect(() => registerAssistantActions("board", {
    currentJob: () => assistantStateRef.current.selectedJob || null,
    boardDecide: async (job, decision) => {
      const r = await decideJobRef.current?.(job, decision);
      if (r?.error) throw new Error(r.error);
      if (r?.notice) throw new Error(`${r.notice} — press Draft anyway on the board if you still want it.`);
      return r;
    },
    boardUndo: async (job) => {
      const t = lastDecisionRef.current;
      if (!t || String(t.jobId) !== String(job?.jobId ?? job?.id)) throw new Error("That decision can't be undone from here any more.");
      await undoLastDecisionRef.current?.(t);
      lastDecisionRef.current = null;
    },
    getFilters: () => { const st = assistantStateRef.current; return { experience_levels: st.experienceLevels, work_models: st.workModels, places: st.places, search: st.localSearch }; },
    setFilters: (f) => { setExperienceLevels(f.experience_levels || []); setWorkModels(f.work_models || []); setPlaces(f.places || []); setLocalSearch(f.search || ""); },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!decisionToast) return;
    const id = setTimeout(() => setDecisionToast(null), DECISION_TOAST_MS);
    return () => clearTimeout(id);
  }, [decisionToast]);

  // -- Mark visited in local state ---------------------------
  const markVisited = useCallback((job) => {
    setJobs(prev => prev.map(j => j.jobId === job.jobId ? {...j, visited:true} : j));
  }, []);

  // -- Direct URL open (no dialog) ------------------------------
  const visitUrl = useCallback(async (job) => {
    if (!job.url) return;
    try {
      await api(`/api/jobs/${job.jobId}/visited`, { method:"PATCH" });
    } catch {}
    markVisited(job);
    void openPosting(job, { url: job.url });   // D99 J11: through the extension when it is here
  }, [markVisited]);

  // -- Pagination --------------------------------------------
  const goPage = async (p) => {
    // pinDock() was here. It set AppScrollContext's `pinned`, whose only reader was the top bar's
    // collapse — which never ran, because the progress it interpolated was permanently 0. With that
    // reader gone the flag was write-only, so the whole pin/unpin trio went with it.
    scrollToTopRef.current?.();      // scroll job list to top (not window)

    // ONE ENTRY POINT, TWO PAGING MODES — decided by planPageFetch rather than at the call sites,
    // so Next, the numbered buttons and the go-to-page box all keep calling goPage(n) and none of
    // them has to know which mode applies. The numbered button for the adjacent page IS the Next
    // action and gets the same treatment, which it would not if the choice were made per-button.
    // The policy and its reasoning live in client/src/lib/boardPaging.js, where it can be tested.
    const plan = planPageFetch({
      target: p,
      currentPage,
      nextCursor: nextCursorRef.current,
      stack: cursorStackRef.current,
    });
    if (plan.resetChain) {
      cursorStackRef.current = [];
      nextCursorRef.current = null;
    }
    await fetchJobs(p, false, plan.cursor ? { cursor: plan.cursor } : {});
  };

  // -- Filter reset ------------------------------------------
  const resetFilters = () => {
    setRoleFilter(""); setLocationFilter(""); setWorkType(""); setEmploymentTypePrefs(["full-time"]); setCatFilter("");
    setSrcFilter(""); setMinYoe(""); setMaxYoe(""); setMaxApplicants(""); setVisitedFilter("");
    setAgeFilter(""); setLocalSearch("");
  };

  // displayJobs: backend handles localSearch filtering across all pages
  // A91: every view — ALL, ★, /d, + — is the one list the board query returned.
  const displayJobs = useMemo(() => jobs, [jobs]);
  displayJobsRef.current = displayJobs;

  const genCount = Object.values(generated).filter(v=>v?.html && v.html !== "__exists__").length;
  const normalisedPreview = ALIASES[searchInput.trim().toLowerCase()]
    || (searchInput.trim() ? searchInput.trim().replace(/\b\w/g, c=>c.toUpperCase()) : "");
  const showPreview = !searchCommitted && !!(normalisedPreview && normalisedPreview.toLowerCase() !== searchInput.trim().toLowerCase());
  const boardTabs = [
    ["all", "All Jobs"],
    ["saved", "Saved ★"],
    ["pending", "Pending"],
  ];

  const isLastPage = currentPage >= totalPages;

  // ⭐ D147 (owner 11-03) · PAGE NUMBERS → SCROLLING. The next page is APPENDED (fetchJobs' merge mode) when the end of
  // the list comes into view — the same request Next made (its cursor when the chain has one, planPageFetch's rule), so
  // the board's two paging modes are unchanged underneath. One load at a time.
  const loadingMoreRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !totalPages || currentPage >= totalPages) return;
    loadingMoreRef.current = true;
    try {
      const plan = planPageFetch({ target: currentPage + 1, currentPage, nextCursor: nextCursorRef.current, stack: cursorStackRef.current });
      await fetchJobs(currentPage + 1, true, plan.cursor ? { cursor: plan.cursor } : {});
    } catch { /* fetchJobs says so on the board (A73) */ }
    finally { loadingMoreRef.current = false; }
  }, [currentPage, totalPages, fetchJobs]);

  // BUTTON STATES: first click applies local role filter, second click triggers fresh scrape.
  // To change labels edit the buttonLabel derived value below.
  const roleIsSet = !!roleFilter &&
    searchInput.trim().toLowerCase() === roleFilter.trim();
  const runSearchButton = useCallback(async (overrideQuery) => {
    const q = (overrideQuery || searchInput).trim();
    if (!q) return;
    if (!roleIsSet || searchPhase === "idle") {
      const applied = await handleSetRole(q);
      if (applied) setSearchPhase("local");
      return;
    }
    const refreshed = await handlePullRefresh();
    if (!refreshed) setSearchPhase("idle");
  }, [handlePullRefresh, handleSetRole, roleIsSet, searchInput, searchPhase]);
  const buttonLabel = scraping ? "Searching…" : searchPhase === "local" && roleIsSet ? "Search New" : "Set Role";
  const buttonIcon = scraping ? "…" : searchPhase === "local" && roleIsSet ? "↻" : "⌕";
  // ⛔ ONLY A MISSING PROFILE REPLACES THE BOARD. A MISSING RESUME NO LONGER DOES.
  //
  // This used to have a second branch: no base resume -> replace the entire board with "Upload a
  // profile resume". That is how an account with 688 ranked jobs waiting showed a reviewer a blank
  // screen. The server never needed the resume to build a board — /api/jobs ranks by target title
  // and role key, and returned a full page throughout — so hiding the rows was hiding working
  // product behind a setup step for a feature the user had not asked for yet.
  //
  // A profile is different and the gate stays: the board is SCOPED to one, and without it the
  // server has nothing to scope to (it answers `no_active_profile` and zero rows).
  //
  // What the missing resume gates now is the ATS sort, and only that — see `atsSortAvailable`
  // below. Decided 2026-09-26.
  // ⛔ 44p: the set-up block only when the profile read SUCCEEDED and found none; a failed read says so and offers
  // Try again (resumePromptOnlyOnEmptySuccess); while it is in flight, nothing replaces the board.
  const setupBlock = activeDomainProfile ? null
    : profilesState === "error" ? {
        title: "We couldn't load your job profiles",
        body: "draft didn't answer in time — nothing is lost, your résumé and profiles are where you left them. Try again in a moment.",
        actionLabel: "Try again",
        onAction: () => { setProfilesState("loading"); setProfilesTry(n => n + 1); },
      }
    : profilesState !== "ready" ? null
    // ⭐ A214 (46r, the 46q audit): the board sits beside the deck (App.jsx's home grid is the board's only mount), and
    // the deck's empty state already carries "Start with your résumé" with the upload — two identical cards side by side
    // was the newcomer's first screen. The board now only says where its jobs will be; the deck's upload hands the new
    // profile to the shared active id, which re-runs the profile read above and lifts this block.
    : {
        title: "Your jobs show here once your résumé is in",
        body: "Upload it in the card beside this one — draft sets up your first job profile from it and ranks every job against it.",
        actionLabel: null,
      };

  // The board ranks by fit only when there are signals to rank with. Published to the context
  // because the sort control lives in App.jsx, a different tree — see JobBoardContext.
  const canRankByFit = !!activeDomainProfile && !!resumeText.trim();
  useEffect(() => {
    setAtsSortAvailable?.(canRankByFit);
  }, [canRankByFit, setAtsSortAvailable]);

  // Panel sizing: the board is the only react-resizable-panels column. The JD, PDF and ATS panels
  // are popups mounted at the end of this component and sized by PanelShell (drag + persisted
  // per-type width), not by percentage redistribution.

  return (
    <div style={{ flex:1, minHeight:0, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden", background:"transparent" }}>
      {/* A53: the deck's toast and its Undo — one component, both surfaces. */}
      <DecisionToast toast={decisionToast} onUndo={() => undoLastDecision()} bottom={24}
        onConfirmNotice={(t) => decideJob(t.job, t.decision, { companyOk: true })} />
      {/* TRANSPARENT, not theme.bg (09-30). theme.bg is --bg-page, which is mapped to SURFACE — the
          GLASS — so the whole board sat under a 58% cream sheet, the cards were glass on glass, and
          the leather never reached them. The page is the substrate; only the cards are glass. */}

      {/* Domain profile wizard modal (non-blocking "+ New Profile") */}
      {profileWizardOpen && (
        <DomainProfileWizard
          initialDomainKey={profileWizardIntent?.domainKey || null}
          bannerText={profileWizardIntent ? `Create ${profileWizardIntent.label} to search "${pendingIntentSearchRef.current || searchInput}" in the right profile.` : undefined}
          onComplete={async profile => {
            setDomainProfiles(prev => [...prev, profile]);
            setProfileWizardOpen(false);
            setProfileWizardIntent(null);
            const pendingQuery = pendingIntentSearchRef.current;
            pendingIntentSearchRef.current = null;
            if (profile?.id) {
              try {
                await activateProfileForSearch(profile.id);
              } catch(e) {
                setScrapeError(e.message || "Profile created, but switching before search failed.");
                return;
              }
            }
            if (pendingQuery) {
              const applied = await handleSetRole(pendingQuery, { skipProfileIntent: true });
              if (applied) setSearchPhase("local");
            }
          }}
          onDismiss={() => {
            pendingIntentSearchRef.current = null;
            setProfileWizardIntent(null);
            setProfileWizardOpen(false);
          }}
        />
      )}

      {searchIntentPrompt && (
        <SearchIntentDialog
          theme={theme}
          prompt={searchIntentPrompt}
          onConfirm={() => closeSearchIntentPrompt(true)}
          onCancel={() => closeSearchIntentPrompt(false)}
        />
      )}

      {/* LinkedInInstallDialog removed in cleanup 5.3 — it was only ever opened by
          startLinkedInImport's always-true "extension not installed" guard, and its Import Now
          action called straight back into that same function. A user could reach it, install
          nothing that would help, and loop. */}

      <AnimatePresence>
        {filtersOpen && (
          <FiltersPanel
            open={filtersOpen} onClose={() => setFilterPanelOpen(false)} onApply={applyPendingFilters}
            categories={categories}
            role={pendingFilters.roleFilter}         setRole={value => stageFilter("roleFilter", value)}
            location={pendingFilters.locationFilter} setLocation={value => stageFilter("locationFilter", value)}
            workType={pendingFilters.workType}       setWorkType={value => stageFilter("workType", value)}
            employmentTypePrefs={pendingFilters.employmentTypePrefs} setEmploymentTypePrefs={value => stageFilter("employmentTypePrefs", value)}
            catFilter={pendingFilters.catFilter}     setCatFilter={value => stageFilter("catFilter", value)}
            srcFilter={pendingFilters.srcFilter}     setSrcFilter={value => stageFilter("srcFilter", value)}
            minYoe={pendingFilters.minYoe}           setMinYoe={value => stageFilter("minYoe", value)}
            maxYoe={pendingFilters.maxYoe}           setMaxYoe={value => stageFilter("maxYoe", value)}
            maxApplicants={pendingFilters.maxApplicants} setMaxApplicants={value => stageFilter("maxApplicants", value)}
            visitedFilter={pendingFilters.visitedFilter} setVisitedFilter={value => stageFilter("visitedFilter", value)}
            ageFilter={pendingFilters.ageFilter}     setAgeFilter={value => stageFilter("ageFilter", value)}
            salaryMin={pendingFilters.salaryMin}     setSalaryMin={value => stageFilter("salaryMin", value)}
            salaryMax={pendingFilters.salaryMax}     setSalaryMax={value => stageFilter("salaryMax", value)}
            workModels={pendingFilters.workModels}   setWorkModels={value => stageFilter("workModels", value)}
            experienceLevels={pendingFilters.experienceLevels} setExperienceLevels={value => stageFilter("experienceLevels", value)}
            skillsInclude={pendingFilters.skillsInclude} setSkillsInclude={value => stageFilter("skillsInclude", value)}
            sponsorFriendly={pendingFilters.sponsorFriendly} setSponsorFriendly={value => stageFilter("sponsorFriendly", value)}
            companySponsors={pendingFilters.companySponsors} setCompanySponsors={value => stageFilter("companySponsors", value)}
            hideEligibility={!!pendingFilters.hideEligibility} setHideEligibility={value => stageFilter("hideEligibility", value)}
            trulyEntry={!!pendingFilters.trulyEntry} setTrulyEntry={value => stageFilter("trulyEntry", value)}
            hideGhost={!!pendingFilters.hideGhost} setHideGhost={value => stageFilter("hideGhost", value)}
            sectors={pendingFilters.sectors || []} setSectors={value => stageFilter("sectors", value)}
            sourcesInclude={pendingFilters.sourcesInclude || []} setSourcesInclude={value => stageFilter("sourcesInclude", value)}
            sourcesExclude={pendingFilters.sourcesExclude || []} setSourcesExclude={value => stageFilter("sourcesExclude", value)}
            tiersInclude={pendingFilters.tiersInclude || []}   setTiersInclude={value => stageFilter("tiersInclude", value)}
            tiersExclude={pendingFilters.tiersExclude || []}   setTiersExclude={value => stageFilter("tiersExclude", value)}
            facetCounts={facetCounts}
            onReset={resetPendingFilters}
            onSaveSearch={saveTrackedSearch}
            onApplySearch={applyTrackedSearch}
            onClearSearch={clearTrackedSearch}
            trackedSearch={activeDomainProfile?.tracked_search || null}
            canSaveSearch={!!activeDomainProfile}
          />
        )}
      </AnimatePresence>

      {/* Unified toolbar. The `scrollProgress < 0.5` guard that used to wrap this is gone: it
          hid the toolbar once the top bar collapsed into a pill, and the progress it read was
          permanently 0 — so the condition was always true and the toolbar was always shown.
          Rendering it unconditionally is what has always happened. */}
      {/* Row A: tabs | filters | sort | local-search | job count */}
      {/* Row B (wraps): search input | Search | resume upload */}
      {uploadError && (
      <div style={{
        background:theme.surface, borderBottom:`1px solid ${theme.border}`,
        padding:"10px 20px", display:"flex", alignItems:"center", gap:8,
        flexShrink:0, flexWrap:"wrap",
      }}>

        {/* ── Row A ──────────────────────────────────── */}
        {/* Board tabs — superseded by TopBar Pill 2 */}
        {false && (
        <div style={{ display:"flex", flexShrink:0, overflow:"hidden",
                      border:`2px solid ${theme.borderStrong}`, borderRadius:2 }}>
          {boardTabs.map(([id,lbl], idx) => (
            <button key={id} onClick={() => setBoardTab(id)}
              style={{
                padding:"6px 16px", border:"none", cursor:"pointer",
                fontFamily:"inherit", fontWeight:800,
                fontSize:ts(13),
                background: boardTab===id ? theme.accent : theme.surface,
                color: boardTab===id ? C.ON_ACCENT : theme.text,
                transition:"background 0.15s",
                borderRight: idx === boardTabs.length - 1 ? "none" : `2px solid ${theme.borderStrong}`,
              }}>
              {lbl}
            </button>
          ))}
        </div>
        )}
        {/* ── The control ROW is gone (W4). Nothing in it was deleted; every control MOVED. ──
            FILTERS, NEW IN 24H, Save Search and the saved-search chip -> the filters panel, opened
              by the filter icon (App.jsx's BoardControlIcons).
            Sort ("Newest") -> the sort icon beside it, same seven options, same values.
            "Filter loaded jobs" -> REMOVED as redundant: it wrote `localSearch`, which is the
              same state the main search bar's keyword field now writes, so it was a second input
              for one filter. It is still reachable from the collapsed pill when scrolled.
            Profile selector -> REMOVED as redundant here: TopBar's own profile menu and the
              collapsed pill both already carry one, and this was the third.
            What stays visible is the result count and the active-filter indicator, because with
            the filters behind an icon those are the only things that can explain a narrow board. */}

        {/* A74 (owner, 10-03): the "N filters active" chip and the "567 jobs" count are removed — the
            filter icon's badge already signals active filters. This row now shows only errors. */}

        {/* ATS role search + trigger — superseded by UnifiedSearchBar */}
        {false && (<>
        <div style={{ flexBasis:"100%", height:0 }}/>

        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <input value={searchInput} onChange={e=>{ setSearchInput(e.target.value); setSearchCommitted(false); }}
            onKeyDown={e => e.key==="Enter" && runSearchButton()}
            placeholder="ATS search role, e.g. ML Engineer, SWE..."
            style={{ width:"100%", height:38, paddingLeft:14, paddingRight:14,
                     borderRadius:2, border:`1px solid ${theme.border}`,
                     background:theme.surface, color:theme.text,
                     fontFamily:"inherit", fontSize:ts(13), outline:"none",
                     boxSizing:"border-box" }}/>
          {showPreview && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0,
              fontSize:ts(10), color:theme.textMuted, background:theme.surface,
              border:`1px solid ${theme.border}`,
              borderRadius:4, padding:"4px 10px", whiteSpace:"nowrap", zIndex:10 }}>
              Will search as: <span style={{ color:theme.accentText, fontWeight:700 }}>{normalisedPreview}</span>
            </div>
          )}
        </div>

        <LucyBtn
          onClick={() => runSearchButton()}
          disabled={scraping || bgLoading}
          title={searchPhase === "local" && roleIsSet
            ? "Look for new jobs for this role now, for this job profile"
            : "Apply this role to the local board first"}>
          <span aria-hidden="true">{buttonIcon}</span>
          <span>{buttonLabel}</span>
        </LucyBtn>
        </>)}
        {uploadError && (
          <div style={{ flexBasis:"100%", padding:"4px 0", fontSize:ts(11), color:C.DANGER }}>
            Error: {uploadError}
            <button onClick={() => setUploadError("")} style={{ marginLeft:6, background:"none", border:"none", cursor:"pointer", fontSize:ts(11), color:C.DANGER }}>Dismiss</button>
          </div>
        )}

        {/* linkedinExtensionNotice banner removed in cleanup 5.3 — it was only ever set by
            startLinkedInImport's NOT_AUTHED branch, which was unreachable past the always-false
            install guard, and its action button called the no-op extension bridge. */}

      </div>
      )}
      {/* Hidden file input — always mounted so TopBar resume upload button works even when toolbar is hidden */}
      <input ref={fileRef} type="file" accept=".txt,.html,.md,.docx,.pdf"
        onChange={handleFile} style={{ display:"none" }}/>

      {/* ── Resume Enhance modal ────────────────────────────── */}
      {/* Z.MODAL_SCRIM below, not the literal 600 this modal carried. 600 is Y2's DRAWER_SCRIM, so
          this modal and the filters drawer's scrim were at the SAME z and their order was decided by
          render order — the exact accident the named scale exists to remove. A resume-enhance modal
          is a focused takeover and belongs above the drawer, which is what MODAL_SCRIM gives it. */}
      {enhanceModalOpen && enhanceResult && (
        <div style={{
          position:"fixed", inset:0, zIndex:Z.MODAL_SCRIM,
          background:C.SCRIM, display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{
            background:theme.modalSurface || theme.surface, borderRadius:8, width:"min(92vw, 760px)",
            maxHeight:"85vh", overflowY:"auto", padding:0,
            border:`1px solid ${theme.border}`, boxShadow:C.SHADOW_SM,
          }}>
            {/* Header */}
            <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${theme.border}` }}>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:400,
                             fontSize:ts(26)}}>
                Resume Enhancement
              </div>
              {enhanceResult.delta != null && (
                <div style={{ fontSize:ts(12), color:theme.textMuted, marginTop:4 }}>
                  ATS score improved by
                  <span style={{ color: enhanceResult.delta > 0 ? C.SUCCESS : C.DANGER,
                                  fontWeight:700, marginLeft:4 }}>
                    {enhanceResult.delta > 0 ? "+" : ""}{enhanceResult.delta} points
                  </span>
                  {" "}({enhanceResult.original?.atsScore ?? "-"}{" -> "}{enhanceResult.enhanced?.atsScore ?? "-"})
                </div>
              )}
            </div>
            {/* Side-by-side comparison */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>
              <div style={{ padding:"16px 20px", borderRight:`1px solid ${theme.border}` }}>
                <div style={{ fontSize:ts(11), fontWeight:700, textTransform:"uppercase",
                               letterSpacing:"0.06em", color:theme.textMuted, marginBottom:8 }}>
                  Original
                </div>
                <pre style={{ fontSize:ts(11), color:theme.text, whiteSpace:"pre-wrap",
                               wordBreak:"break-word", maxHeight:340, overflowY:"auto",
                               fontFamily:"monospace", margin:0 }}>
                  {enhanceResult.original?.text}
                </pre>
              </div>
              <div style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:ts(11), fontWeight:700, textTransform:"uppercase",
                               letterSpacing:"0.06em", color:C.SUCCESS, marginBottom:8 }}>
                  Enhanced
                </div>
                <pre style={{ fontSize:ts(11), color:theme.text, whiteSpace:"pre-wrap",
                               wordBreak:"break-word", maxHeight:340, overflowY:"auto",
                               fontFamily:"monospace", margin:0 }}>
                  {enhanceResult.enhanced?.text}
                </pre>
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding:"16px 24px", borderTop:`1px solid ${theme.border}`,
                           display:"flex", flexDirection:"column", gap:10, alignItems:"center" }}>
              <div style={{ display:"flex", gap:10, width:"100%", justifyContent:"center" }}>
                <button className="dbx-depth" onClick={handleAdoptEnhanced}
                  style={{
                    padding:"10px 24px", fontWeight:800, fontSize:ts(13),
                    background:theme.accent, color:"var(--c-on-accent)", border:"none", cursor:"pointer",
                    fontFamily:"inherit",
                  }}>
                  Adopt Enhanced Version
                </button>
                <button className="dbx-depth" onClick={() => setEnhanceModalOpen(false)}
                  style={{
                    padding:"10px 24px", fontWeight:800, fontSize:ts(13),
                    background:"transparent", color:theme.textMuted,
                    border:`1px solid ${theme.border}`, cursor:"pointer",
                    fontFamily:"inherit",
                  }}>
                  Keep Original
                </button>
              </div>
              <div style={{ fontSize:ts(10), color:theme.textDim, textAlign:"center", maxWidth:480 }}>
                This is your one-time enhancement. Your choice here does not affect whether it has been used.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Body: responsive layout ─────────────────────────── */}

      {/* Company reuse modal (Task 6) */}
      {companyReuseTarget && (
        <CompanyReuseModal
          company={companyReuseTarget.job.company}
          theme={theme}
          onUseExisting={() => {
            const { job, priorEntry } = companyReuseTarget;
            setCompanyReuseTarget(null);
            const key = job.jobId;
            setGenerated(p => ({ ...p, [key]: priorEntry }));
            openSandbox({ ...priorEntry, company: job.company, title: job.title });
            if (priorEntry.atsReport || priorEntry.atsScore != null) {
              openAtsPanel({ score: priorEntry.atsScore, report: priorEntry.atsReport, jobId: job.jobId, company: job.company, title: job.title }, job);
            }
          }}
          onGenerateNew={() => {
            const { job, tool, source } = companyReuseTarget;
            setCompanyReuseTarget(null);
            generateActual(job, false, true, tool, source || null);
          }}
          onCancel={() => setCompanyReuseTarget(null)}
        />
      )}

      {/* D35: the sentence's panel and the sort panel render in App.jsx's header, above the bar —
          the sentence, the open panel, the bar, the jobs. Nothing sits between the bar and the board. */}

      {/* ── MOBILE / TABLET: single-pane + bottom nav ── */}
      {setupBlock ? (
        <SetupGateNotice theme={theme} {...setupBlock} />
      ) : isMobile && (
        <div style={{ flex:1, minHeight:0, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
          {/* The board. Unconditional now — there is no pane to switch away to. */}
          <div style={{ flex:1, minHeight:0, minWidth:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <JobsColumn
              jobs={displayJobs} scraping={scraping} scrapeError={scrapeError}
              onClearScrapeError={() => setScrapeError("")}
              pollStatus={pollStatus}
              onRetryPoll={handlePullRefresh}
              generated={generated} loading={loading}
              applyMode={applyMode} canUseGenerate={canUseGenerate} canUseAPlusResume={canUseAPlusResume}
              theme={theme}
              totalPages={totalPages} currentPage={currentPage} isLastPage={isLastPage}
              generate={generate} openSandbox={openSandbox} exportAndTrack={exportAndTrack}
              visitUrl={visitUrl} decideJob={decideJob} isJobDrafted={isJobDrafted} draftingIds={draftingIds} draftControls={draftControls} openAtsPanel={openAtsPanel}
              goPage={goPage} onLoadMore={loadMore} totalJobs={totalJobs} onPullRefresh={handlePullRefresh}
              isMobile={isMobile}
              onJobSelect={handleJobSelect} selectedJobId={selectedJob?.jobId}
              activeFilterCount={activeFilterCount}
              onClearFilters={clearAllFilters}
              searchActive={!!localSearch.trim()}
              profileName={activeDomainProfile?.profile_name || null}
              curation={curation}
              canRankByFit={canRankByFit}
              resumeReadState={resumeState} onRetryResume={() => setResumeTry(n => n + 1)}
              onAddResume={() => navigate("/app/job-profiles")}
              curateOff={curateOff}
              onToggleCurate={toggleCuration}
              boardReason={boardReason}
              emptyReason={emptyReason}
              savedTab={boardTab === "saved"}
              importedTab={boardTab === "imported"}
              boardLoading={boardLoading}
              beingMatched={beingMatched} beingMatchedMore={beingMatchedMore}
              cardTier={1}
            />
            {/* The mobile "editor" pane is gone: the PDF sandbox is a popup panel now and renders
                full-screen on a narrow viewport (usePanelHost's fallback), so a second inline copy
                of it would be a divergent implementation of the same surface. */}
            {/* Likewise the mobile "ats" pane — ⭐ D152 (8): the match opens inside the posting (full screen on a
                narrow viewport), never a panel of its own. */}
          </div>
          {/* Bottom nav.
              Resume and ATS now OPEN THE PANEL that owns each surface instead of switching to a
              pane. They used to call setMobilePane("editor"/"ats"), and those panes were deleted
              when the surfaces became popup panels — so both buttons emptied the board and showed
              nothing in its place. The tab still shows the resume and still shows the report; the
              surface it reaches is the full-screen panel rather than a second inline copy of it.
              Disabled when there is nothing to show yet, which is honest about a resume that has
              not been generated instead of opening an empty sandbox. */}
          <div style={{ display:"flex", borderTop:`1px solid ${theme.border}`,
                        background:theme.surface, flexShrink:0 }}>
            {[
              { id:"jobs",   label:"Jobs",   icon:"Jobs", active: !sandboxOpen && !selectedJob,
                enabled: true,          onPress: () => { closeSandbox(); clearDeepLink(); setSelectedJob(null); } },
              { id:"editor", label:"Resume", icon:"Edit", active: sandboxOpen,
                enabled: !!sandbox,     onPress: () => openSandbox(sandbox) },
              { id:"ats",    label:"ATS",    icon:"ATS",  active: !!selectedJob && !sandboxOpen,
                enabled: !!activeAts && !!selectedJob, onPress: () => { closeSandbox(); openAtsPanel(null); } },
            ].map(({ id, label, icon, active, enabled, onPress }) => (
              <button key={id} onClick={onPress} disabled={!enabled}
                title={enabled ? undefined : `No ${label.toLowerCase()} yet — generate a resume first`}
                style={{
                  flex:1, padding:"10px 0", border:"none",
                  cursor: enabled ? "pointer" : "not-allowed",
                  background:"transparent", display:"flex", flexDirection:"column",
                  alignItems:"center", gap:2,
                  opacity: enabled ? 1 : 0.4,
                  color: active ? theme.accentText : theme.textMuted,
                  fontSize:ts(10), fontWeight:700,
                }}>
                <span style={{ fontSize:ts(18) }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PORTRAIT / LAPTOP + WIDE: resizable panels (react-resizable-panels) ── */}
      {!setupBlock && (isWide || (isPortrait && !isMobile)) && (
        <div style={{ flex:1, minHeight:0, minWidth:0, overflow:"hidden", display:"flex" }}>
        <PanelGroup orientation="horizontal" style={{ flex: 1, minHeight:0, minWidth:0, overflow: "hidden" }}>

          {/* PANEL A - Jobs list (always visible, full width - detail in portal drawer) */}
          <Panel
            ref={jobsPanelRef}
            defaultSize={100}
            minSize={6}
            style={{ display: "flex", flexDirection: "column", minHeight:0, minWidth:0, overflow: "hidden" }}>
            <JobsColumn
              jobs={displayJobs} scraping={scraping} scrapeError={scrapeError}
              onClearScrapeError={() => setScrapeError("")}
              pollStatus={pollStatus}
              onRetryPoll={handlePullRefresh}
              generated={generated} loading={loading}
              applyMode={applyMode} canUseGenerate={canUseGenerate} canUseAPlusResume={canUseAPlusResume}
              theme={theme}
              totalPages={totalPages} currentPage={currentPage} isLastPage={isLastPage}
              generate={generate} openSandbox={openSandbox} exportAndTrack={exportAndTrack}
              visitUrl={visitUrl} decideJob={decideJob} isJobDrafted={isJobDrafted} draftingIds={draftingIds} draftControls={draftControls}
              openAtsPanel={openAtsPanel}
              goPage={goPage} onLoadMore={loadMore} totalJobs={totalJobs} onPullRefresh={handlePullRefresh}
              isMobile={isMobile}
              compact={false} selectedJobId={selectedJob?.jobId} onJobSelect={handleJobSelect}
              activeFilterCount={activeFilterCount}
              onClearFilters={clearAllFilters}
              searchActive={!!localSearch.trim()}
              profileName={activeDomainProfile?.profile_name || null}
              curation={curation}
              canRankByFit={canRankByFit}
              resumeReadState={resumeState} onRetryResume={() => setResumeTry(n => n + 1)}
              onAddResume={() => navigate("/app/job-profiles")}
              curateOff={curateOff}
              onToggleCurate={toggleCuration}
              boardReason={boardReason}
              emptyReason={emptyReason}
              savedTab={boardTab === "saved"}
              importedTab={boardTab === "imported"}
              boardLoading={boardLoading}
              beingMatched={beingMatched} beingMatchedMore={beingMatchedMore}
              cardTier={effectiveTier}
              containerRef={jobsPanelElementRef}
            />
          </Panel>

          {/* PANEL C (sandbox) and PANEL D (ATS) are gone from this layout on purpose. They were
              react-resizable-panels columns wedged into the region below the search bar, which is
              why they were cramped and why they sat BEHIND the JD drawer instead of beside it. Both
              are now popup panels rendered through PanelShell — peers of the JD drawer — mounted at
              the bottom of this component. The board keeps the full width of the layout, which is
              also what stops it being squeezed down to a few hundred pixels when they are open. */}
        </PanelGroup>
        </div>
      )}

      {attribution.length > 0 && (
        <div style={{ padding:"8px 16px", display:"flex", gap:12, flexWrap:"wrap" }}>
          {attribution.map(a => (
            <a key={a.name} href={a.url} target="_blank" rel="noopener noreferrer"
               style={{ fontSize:ts(11), color:theme.textMuted, textDecoration:"none", opacity:0.7 }}>
              Jobs powered by {a.name}
            </a>
          ))}
        </div>
      )}

      {/* ── The popup panel group: JD, PDF and ATS as peers, inside ONE overlay surface ────────
          All three render through PanelShell and are laid out by one host, so "replace" and
          "side by side" are properties of the set rather than of any one panel.

          The dock is what makes the tiling INTERNAL. Panels are its flex children, so they lay out
          against each other and against nothing else — the board cannot be a party to it. It is
          also what gives the group outer bounds to keep still: before it, each panel was
          independently right-anchored to the viewport, and dragging one wider pushed its neighbour
          off the left edge of the screen rather than resizing against it.

          ONE scrim for the whole group: two stacked 45% scrims compound to ~70% and the board stops
          being visible behind them, which would break the "dims but does not hide" property exactly
          when a second panel opens. Clicking it closes the focused panel — the same gesture the JD
          drawer's own backdrop has always had. The dock is always mounted, and is an empty
          pointer-events:none box when nothing is open, so AnimatePresence still gets to play the
          last panel's exit instead of having its container yanked mid-animation. */}
      <PanelScrim show={openPanelCount > 0} onClick={() => {
        // ⛔ D39: the most recently OPENED panel closes first — not "the focused one", which a click on
        // a peer could change. The other panel does not move (usePanelHost SPATIAL_ORDER).
        panelDescriptors.find(d => d.id === lastOpenedId)?.close?.();
      }}/>
      <PanelDock width={dockWidth} fullScreen={panelsFullScreen && openPanelCount > 0}>
        <AnimatePresence>
          {panelProps("jd")  && <JobDetailPanel key="panel-jd" {...panelProps("jd")}/>}
          {panelProps("pdf") && (
            <SandboxPanel key="panel-pdf" {...panelProps("pdf")}
              entry={sandbox} onClose={closeSandbox}
              onSave={saveSandboxHtml} onExport={exportAndTrack}/>
          )}
        </AnimatePresence>
      </PanelDock>
      {/* ⭐ D156 (1c): on a desktop the posting is drawn ON THE DECK, in the front card's place (the deck's slot) — the card
          becomes the long post; the list beside it never folds away. Outside the overlay host, Escape closing it only while
          no overlay panel is open (D39). */}
      {/* ⭐ D168: the posting drawn is deckPostJob — the selection, held a fade longer when it goes (the swap's fade-out). */}
      {deckPostJob && deckSlot && createPortal(
        <JobDetailPanel key="panel-jd" slot={0} fullScreen={false} beside onDeck job={deckPostJob} focused={openPanelCount === 0}
          closesOnEscape={openPanelCount === 0} resizeMode="none" />,
        deckSlot,
      )}
    </div>
  );
}

// ── Drag resize handle ────────────────────────────────────────
function ResizeHandle({ theme: themeProp }) {
  const { theme: t } = useTheme();
  const theme = themeProp || t;
  const [active, setActive] = useState(false);
  return (
    <PanelResizeHandle
      style={{
        width: 7, flexShrink: 0, cursor: "col-resize",
        display: "flex", alignItems: "stretch", background: "transparent",
        zIndex: 10,
      }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      <div style={{
        width: active ? 3 : 2,
        margin: "0 auto",
        background: active ? theme.accent : theme.border,
        transition: "all 0.15s ease",
        borderRadius: 2,
      }} />
    </PanelResizeHandle>
  );
}

// ── Jobs column (shared across layout modes) ──────────────────
// ── D40 (owner, 10-06) · THE + VIEW ──────────────────────────────────────────────────────────────
//
//   HEADER   [ Import jobs ]   Get the extension →
//   BELOW    the user's imported jobs — the board's own card (ALL filtered to imports), with the board's
//            search, sort and the filter sentence working on it
//
// "Import jobs" goes to the /extension page, which holds the three install states and never offers a
// download to someone who already has the extension (D33 §4). "Get the extension" is the Web Store
// listing — ⛔ EXTENSION_STORE_URL is null until the owner supplies the item id (O55b), and then it says
// the listing is not published rather than showing a dead link.
export function ImportedHeader({ theme, status = undefined }) {
  const live = useExtensionStatus({ enabled: status === undefined });
  return <ImportedHeaderView theme={theme} status={status === undefined ? live : status} />;
}

/** Pure, so a test renders each install state. ⛔ A connected extension is never offered a download. */
export function ImportedHeaderView({ theme, status = null }) {
  const connected = status?.state === "connected";
  return (
    <div data-imported-header="" style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap",
                                           padding:"12px 16px 4px" }}>
      <Link to={EXTENSION_PAGE} className="rm-btn rm-btn-primary rm-btn-sm" data-import-jobs="">Import jobs</Link>
      {connected
        ? <span data-extension-connected="" style={{ fontSize:ts(13), color:theme.textMuted }}>Capture any posting with ⌃⇧K — it lands here.</span>
        : EXTENSION_STORE_URL
          ? <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" data-get-extension="" style={{ fontSize:ts(13), color:theme.accentText }}>Get the extension →</a>
          : <span style={{ fontSize:ts(13), color:theme.textMuted }}>The extension's Web Store listing is not published yet.</span>}
    </div>
  );
}

export function ImportedEmptyState({ theme }) {
  return (
    <div data-imported-empty="" style={{ padding:"28px 16px", color:theme.textMuted, fontSize:ts(14), lineHeight:1.6, maxWidth:560 }}>
      <p style={{ margin:"0 0 8px", color:theme.text, fontWeight:700 }}>No imported jobs yet.</p>
      <p style={{ margin:0 }}>
        Open any job in Chrome and save it with the draft extension (⌃⇧K). It lands on your board, in
        All jobs and here. Use <strong>Import jobs</strong> above to set the extension up.
      </p>
    </div>
  );
}

const SKELETON_CARDS = Array.from({ length: 9 }, (_, i) => i);

function JobsColumn({ jobs, scraping, scrapeError, onClearScrapeError,
                      pollStatus, onRetryPoll,
                      generated, loading, applyMode, canUseGenerate, canUseAPlusResume,
                      theme, totalPages, currentPage, isLastPage,
                      generate, openSandbox, exportAndTrack,
                      visitUrl, decideJob, isJobDrafted = () => false, draftingIds = new Set(), draftControls = null, openAtsPanel,
                      goPage, onLoadMore, totalJobs = 0, onPullRefresh,
                      isMobile,
                      compact, selectedJobId, onJobSelect,
                      activeFilterCount = 0, onClearFilters,
                      searchActive = false, profileName = null,
                      curation = null, curateOff = false, onToggleCurate, boardReason = null,
                      emptyReason = null, canRankByFit = true, onAddResume, resumeReadState = "ready", onRetryResume,
                      savedTab = false, importedTab = false, boardLoading = false, beingMatched = 0, beingMatchedMore = false,
                      cardTier = 1, containerRef }) {
  // ⭐ (11) 45q · D180's Send on the list rows — only while the network is on (the deck's own rule), through the ONE picker.
  const [networkOn, setNetworkOn] = useState(false);
  const [sending, setSending] = useState(null);
  useEffect(() => { let live = true; api("/api/network/status").then(r => live && setNetworkOn(!!r?.enabled)).catch(() => {}); return () => { live = false; }; }, []);
  // ⛔ D45: never while the current view is still loading — "nothing here" when the truth is "not here yet"
  // is silence reported as success.
  const shouldShowEmptyState = jobs.length === 0 && !scraping && !boardLoading;
  // An empty board has two completely different causes and only ever admitted to one of them.
  // "Search for a role above" is right when nothing is filtered; when filters ARE narrowing the
  // board it is a lie that costs the user their next move — they go and search again instead of
  // widening the filter that hid everything. It is also the exact reading that let the NULL-IN
  // outage look like an ordinary empty board for as long as it did, which is why an empty board
  // now has to say which of the two it is.
  // localSearch counts toward "filtered" here even though it is not one of the drawer's filters:
  // it narrows the board server-side exactly like they do, and an empty board caused only by a
  // stale search term used to fall through to "Search for a role above" — advice to do the very
  // thing that was hiding the jobs. onClearFilters clears the search too, so the count and the
  // button agree.
  const narrowingCount      = activeFilterCount + (searchActive ? 1 : 0);
  const emptyBecauseFiltered = shouldShowEmptyState && narrowingCount > 0;
  // Fourth case, and it has to be checked FIRST: the shared pool itself is empty, so no profile,
  // role or filter is responsible. The server says so explicitly (reason:'cache_empty'). Before it
  // did, this fell through to RoleScopedEmptyState and told the user nothing matched their
  // profile's role — advice to go and edit a profile that was never the cause. Worse, this is the
  // case that used to silently serve a global Adzuna feed instead (see server.js), so an empty pool
  // has a history of showing the user anything except the truth.
  // ⛔ TWO CODES THE USER CANNOT CAUSE AND MUST NOT BE BLAMED FOR, checked FIRST so neither can
  // fall through to "your filters exclude all jobs" — which would be advice to go and change
  // something that was never the cause. `page_out_of_range` is recoverable in one click;
  // `count_list_mismatch` is a server defect and says so rather than dressing itself as a filter.
  const pagingProblem = shouldShowEmptyState
    && (emptyReason?.code === "page_out_of_range" || emptyReason?.code === "count_list_mismatch")
    ? emptyReason : null;
  const emptyBecauseNoPool   = shouldShowEmptyState && !pagingProblem && boardReason === "cache_empty";
  // Third case: nothing is narrowing the board and it is still empty. See RoleScopedEmptyState.
  const emptyBecauseRole     = shouldShowEmptyState && !pagingProblem && !emptyBecauseNoPool && narrowingCount === 0 && !!profileName;
  return (
    // ⛔ D92: NOTHING paints behind the jobs. This box drew a 160° accent tint from its own hard top edge — the
    // "tint behind the cards" and the page read in two parts, split by a line (measured on the running app).
    <div ref={containerRef} style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* ⭐ D152 (6) · Home's board column; with a posting open on a desktop the posting takes the list's place (the list
          stays mounted, folded away). */}
      <JobBoardColumns>
      {/* Rendered OUTSIDE the empty/non-empty branch on purpose: the bridge can narrow a board to a
          short list or to nothing at all, and both need to say so. Left inside the non-empty branch
          it would go silent in the very case where the user has least to go on. */}
      <FitRankingNotice theme={theme} show={!canRankByFit && resumeReadState !== "loading"}
        failed={resumeReadState === "error"} onRetry={onRetryResume} onAddResume={onAddResume}/>
      {/* ⭐ D40: the + view's head — Import jobs and the extension page; the list below is ALL's own cards. */}
      {importedTab && <ImportedHeader theme={theme}/>}
      {/* A126 (7): the postings held back until they are matched — said, never silently missing. */}
      {!boardLoading && beingMatched > 0 && (
        <p data-being-matched="" style={{ margin:"4px 2px 10px", fontSize:ts(12.5), color:theme.textMuted }}>
          {beingMatched.toLocaleString()}{beingMatchedMore ? "+" : ""} more {beingMatched === 1 && !beingMatchedMore ? "posting is" : "postings are"} being matched to your résumé — they appear here as they're scored.
        </p>
      )}
      {boardLoading ? (
        // D45: the card's own geometry from the first frame, until this view answers.
        <JobBubbleRows jobs={SKELETON_CARDS}>{(_, i) => <JobBubbleSkeleton key={i} />}</JobBubbleRows>
      ) : shouldShowEmptyState ? (
        // ⭐ 45s: held back because they are being matched — never "nothing matches your filters" (they DO match).
        beingMatched > 0 ? (
          <div data-matching-empty="" style={{ padding:"28px 6px", color:theme.textMuted, fontSize:ts(14), lineHeight:1.5 }}>
            <b style={{ color:theme.text }}>Matching {beingMatched.toLocaleString()}{beingMatchedMore ? "+" : ""} {beingMatched === 1 && !beingMatchedMore ? "job" : "jobs"} to your résumé…</b>
            <div>They appear here as each one is scored — usually within a minute of a new résumé.</div>
          </div>
        ) : pagingProblem
          ? <PagingEmptyState theme={theme} reason={pagingProblem} onFirstPage={() => goPage(1)}/>
          : emptyBecauseNoPool
          ? <NoPoolEmptyState theme={theme}/>
          : emptyBecauseFiltered
            ? <FilteredEmptyState theme={theme} count={narrowingCount} onClearFilters={onClearFilters}/>
            // D40: imports land in + now, not ★ — the empty + view says how to capture one.
            : importedTab
              ? <ImportedEmptyState theme={theme}/>
            : savedTab
              ? <SavedEmptyState theme={theme}/>
            : emptyBecauseRole
              ? <RoleScopedEmptyState theme={theme} profileName={profileName}/>
              : <BoardEmptyState theme={theme}/>
      ) : (
        <PullToRefresh onRefresh={onPullRefresh} refreshing={scraping} theme={theme}>

          {/* Scrape error banner */}
          {scrapeError && (
            <div style={{ margin:"8px 16px 0", padding:"10px 14px", borderRadius:4,
                          background:C.DANGER_QUIET, border:`1px solid ${C.DANGER}`,
                          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:ts(12), color:C.DANGER }}>
                Error: {scrapeError}
              </span>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {pollStatus === "error" && onRetryPoll && (
                  <button onClick={onRetryPoll}
                    style={{ background:"none", border:`1px solid ${C.DANGER}`, borderRadius:4,
                             cursor:"pointer", color:C.DANGER, fontSize:ts(11), padding:"2px 8px",
                             fontWeight:700 }}>
                    Retry
                  </button>
                )}
                <button onClick={onClearScrapeError} style={{ background:"none", border:"none",
                  cursor:"pointer", color:C.DANGER, fontSize:ts(14) }}>x</button>
              </div>
            </div>
          )}

          {/* ⛔ D152 (3) (owner 11-04): no separate "This week's best bets" list — the best-bets ranking feeds the deck, and its
              reason line is on each card (DeckView, the server's orderByBest). */}

          {/* ⭐ D1 (chosen 10-02): THE CARD IS A BUBBLE — rows of 2/3/4 (3 by default), a hovered or focused
              card grows to 1.55 and its neighbours give up the width; the rail (ATS · Save · Draft) opens on
              hover / focus-within, and is always shown on touch. components/JobBubble.jsx carries the spec.
              Generate and the posting link are off the card (D1): Apply is the company name (A63), and
              generating lives on the job's detail panel. */}
          {/* ⭐ D152 (5): two columns of resizing bubbles; one while a posting is open beside the list. */}
          <JobBubbleRows jobs={jobs} columns={2}>
          {(job) => {
            const key = job.jobId, g = generated[key];
            // Without a detail panel to select into: a generated résumé opens in its sandbox, else the posting.
            const open = onJobSelect ? () => onJobSelect(job) : () => {
              if (g?.html && g.html !== "__exists__") {
                openSandbox({ ...g, company: g.company || job.company, title: g.title || job.title });
                openAtsPanel(buildAtsPayload(job, g), job);
              } else if (job.url) visitUrl(job);
            };
            return (
              <JobBubble
                key={key} job={job}
                score={scoresFor(job, g).shown}
                selected={selectedJobId === key}
                // ⭐ D57: the card says a résumé is ready for this job — the same card in every view (D46).
                resumeReady={!!g?.html}
                saved={!!(job._user?.starred ?? job.starred)}
                drafted={isJobDrafted(key)}
                drafting={draftingIds.has(key)}
                onOpen={open}
                // ⛔ CC5 · opening with an EMPTY payload is the working case: ATSPanel scores the posting
                // against this caller's résumé on demand when it is handed no report.
                // A53: the card's decisions are the deck's — Save and Draft SET; Pass is on the detail panel.
                onSave={() => decideJob?.(job, DECISIONS.SAVED)}
                onDraft={() => decideJob?.(job, DECISIONS.DRAFTED)}
                onViewDraft={draftControls?.onView} draftBlocked={draftControls?.block} draftSlots={draftControls?.slots}
                onExplainDraft={(reason) => draftControls?.onExplain(job, reason)}
                onSend={networkOn && job.publicPath ? () => setSending(job) : null}
              />
            );
          }}
          </JobBubbleRows>
          {sending && <SendJobPicker job={sending} onClose={() => setSending(null)} />}

          {/* ⭐ D147 · scrolling, not page numbers: the next page loads as the list's end comes into view. */}
          {jobs.length > 0 && totalPages > 0 && (
            <BoardMore shown={jobs.length} total={totalJobs} more={currentPage < totalPages} onMore={onLoadMore} theme={theme} />
          )}

        </PullToRefresh>
      )}
      </JobBoardColumns>
    </div>
  );
}

/** ⭐ D149 · below this width the opened posting is the full-screen overlay (fullhouse-declutter.html's 1000px rule). */
const BESIDE_MIN_VIEWPORT = 1000;

// ⭐ D147 · THE END OF THE LIST — "Showing 50 of 746 · scroll for more", and the next page appended when this line comes
// within 600px of the viewport (an IntersectionObserver, never a scroll listener). The line is also a button, so the
// next page is reachable without scrolling (keyboard, a browser with no observer).
function BoardMore({ shown, total, more, onMore, theme }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !more || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) onMore?.(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, onMore, shown]);
  const of = Number.isFinite(total) && total > 0 ? ` of ${total.toLocaleString()}` : "";
  return (
    <div ref={ref} data-board-more="" data-more={more ? "true" : "false"}
      style={{ display:"flex", justifyContent:"center", padding:"18px 20px 26px", fontSize:ts(13.5), color:theme.textMuted }}>
      {more
        ? <button type="button" onClick={() => onMore?.()} className="fh-more"
            style={{ background:"none", border:0, font:"inherit", color:"inherit", cursor:"pointer", padding:"6px 10px" }}>
            Showing {shown.toLocaleString()}{of} · scroll for more
          </button>
        : <span>Showing all {shown.toLocaleString()}</span>}
    </div>
  );
}

// Displays LinkedIn jobs already captured via the extension. The `onImport`/`linkedinImporting`
// props and their two "Import from LinkedIn" buttons were removed in cleanup 5.3: they drove the
// bulk saved-jobs scrape, whose bridge functions have been stubs returning false since BYO-2 and
// whose extension-side content script was deleted in v1.2.0. Clicking either only ever opened an
// "install the extension" modal that no install could satisfy. The LIST below stays — it is fed
// by the single-job capture path (/api/extension/save-job), which is live.
// A74 (owner, 10-03): the "Sorted for your profile (role keywords, role_key, …)" disclaimer and its
// "Don't sort for me" toggle are removed — owner-confirmed dead weight. The ORDER is unchanged; the
// sort control is how a user picks a different one.

// A93: the board's genuinely-unfiltered empty state, drawn by the shared EmptyState. It said "Search for a
// role above · LinkedIn + Indeed" — false since the board became direct-ATS only (greenhouse, ashby,
// lever, workable, recruitee) and a search box no longer leads it.
function BoardEmptyState({ theme }) {
  const { theme: t } = useTheme();
  return (
    <EmptyState theme={theme || t} title="No jobs on the board yet"
      body="Nothing on the board matches right now. Add any job with the extension; it lands under +." />
  );
}

// ── Empty state, filtered variant ────────────────────────────
// ── Empty state, PAGING variant ─────────────────────────────────────────────────────────────
//
// ⛔ THE ONE THIS WHOLE PAIR OF CHANGES EXISTS FOR: a count that says 600 beside a list that shows
// nothing. It was reported from production as "the board is empty", and the board was not empty —
// the response carried a full total and zero rows, and nothing on this screen said so.
//
// Two codes land here and they are NOT the same severity, so they do not get the same words:
//
//   page_out_of_range   — ordinary, recoverable, the user's position is simply past the end.
//   count_list_mismatch — a SERVER DEFECT. The page is inside the range and still came back
//                         empty, which the count and list cannot both be right about. Saying
//                         "adjust your filters" here would send someone to fix something that is
//                         not broken, which is exactly what the old fall-through did.
function PagingEmptyState({ theme, reason, onFirstPage }) {
  const { theme: t } = useTheme();
  const th = theme || t;
  const isBug = reason?.code === "count_list_mismatch";
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", gap:14, padding:40, color:th.textDim }}>
      <div style={{ fontFamily:"var(--font-display)", fontWeight:400,
                    fontSize:ts(29), color:th.text,
                    textAlign:"center" }}>
        {isBug ? "Something went wrong loading this page" : "You are past the end of the list"}
      </div>
      <div style={{ fontSize:ts(12), textAlign:"center", color:th.textDim, maxWidth:380, lineHeight:1.8 }}>
        {reason?.message}
        {!isBug && reason?.total ? ` There ${reason.total === 1 ? "is" : "are"} ${reason.total} job${reason.total === 1 ? "" : "s"} on this board.` : ""}
      </div>
      {onFirstPage && (
        <button type="button" onClick={onFirstPage}
          style={{ border:"none", borderRadius:6, padding:"8px 16px", background:th.accent,
                   color:C.ON_ACCENT, fontWeight:800, fontSize:ts(12), cursor:"pointer" }}>
          Go to the first page
        </button>
      )}
    </div>
  );
}

// ── Fit ranking is unavailable, said once and quietly ───────────────────────────────────────
//
// ⛔ THIS REPLACES A GATE THAT HID THE ENTIRE BOARD. Until 2026-09-26 a missing base resume
// swapped the whole list for a setup prompt, which is how an account with 688 ranked jobs showed a
// reviewer a blank screen. The board never needed the resume; only ranking by FIT does.
//
// So the resume now gates one control — the ATS sort — and this is the line that says so. It
// exists because the alternative is silence: the sort option simply disappears from a dropdown,
// and a feature that vanishes without explanation is the same class of quiet wrongness this whole
// pass has been about, just smaller.
//
// ⚠ DELIBERATELY NOT A BLOCKER AND NOT A MODAL. One line, above a board that works. The old gate's
// mistake was treating an optional refinement as a prerequisite.
function FitRankingNotice({ theme, show, failed = false, onRetry, onAddResume }) {
  const { theme: t } = useTheme();
  const th = theme || t;
  if (!show) return null;
  // ⛔ D156 (6) · d156FailedReadNeverShownAsMissing: a read that failed says so — never "Add one" to a user who may have one.
  if (failed) return (
    <div role="status" data-resume-read-failed="" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  padding: "6px 14px", fontSize: ts(11), color: th.textDim }}>
      <span>We couldn't load this profile's résumé — draft didn't answer in time. Sorting by fit waits for it.</span>
      {onRetry && (
        <button type="button" onClick={onRetry}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                   color: "var(--c-accent-ink)", fontSize: ts(11), fontWeight: 700, textDecoration: "underline" }}>
          Try again
        </button>
      )}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  padding: "6px 14px", fontSize: ts(11), color: th.textDim }}>
      {/* ⛔ D92: no full-width hairline under it — one line ruled across the whole window is a seam. */}
      <span>Sorting by fit needs this profile's base resume — the rest of the board works without it.</span>
      {onAddResume && (
        <button type="button" onClick={onAddResume}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                   // the ACCENT_INK text token, not the orange fill (2.41:1 as text — D93's matrix scan)
                   color: "var(--c-accent-ink)", fontSize: ts(11), fontWeight: 700, textDecoration: "underline" }}>
          Add one
        </button>
      )}
    </div>
  );
}

// Says WHICH empty this is and gives the one action that resolves it. Never "no jobs available" —
// the jobs are there, the filter set is hiding them, and those are different problems with
// different fixes. Excluding every provider or every tier lands here.
function FilteredEmptyState({ theme, count, onClearFilters }) {
  const { theme: t } = useTheme();
  const th = theme || t;
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", gap:14, padding:40, color:th.textDim }}>
      <div style={{ fontFamily:"var(--font-display)", fontWeight:400,
                    fontSize:ts(29), color:th.text,
                    textAlign:"center" }}>
        Your filters exclude all jobs
      </div>
      <div style={{ fontSize:ts(12), textAlign:"center", color:th.textDim, maxWidth:360, lineHeight:1.8 }}>
        Nothing matches all {count} filter{count === 1 ? "" : "s"}. The jobs are still there; widen or
        clear the filters to see them.
      </div>
      {onClearFilters && (
        <button type="button" onClick={onClearFilters}
          style={{ border:"none", borderRadius:6, padding:"8px 16px", background:th.accent,
                   color:C.ON_ACCENT, fontWeight:800, fontSize:ts(12), cursor:"pointer" }}>
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ── Empty state, empty-pool variant ─────────────────────────────────────────────────────────
// The FOURTH reason a board can be empty, and the one that used to be answered with a lie.
//
// When scraped_jobs holds no active rows, /api/jobs used to fall through to a live global
// aggregator query — not profile-scoped, not filtered, not even the user's own Saved tab. On a real
// run with an empty cache and an ENGINEERING profile, the default board, the Saved tab, and every
// filter all returned the same 6,213,918-row feed led by "Occupational Therapist". That is the
// reported "the same set of listings renders regardless of search or filters".
//
// The server now says `cache_empty` instead. This states it plainly and points at the one thing
// that actually resolves it — nothing the user can fix by editing a profile or clearing a filter.
function NoPoolEmptyState() {
  // ⭐ A233: a note card — the cause in plain words (the board is empty for everyone, not this person's filters), the way on.
  return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <NoteCard id="board-no-jobs" title="No jobs collected yet"
        actions={<Link to="/extension" target="_blank" rel="noopener">Add a job with the draft extension</Link>}>
        The board is empty for everyone right now, not just for you. draft looks for new jobs every night.
      </NoteCard>
    </div>
  );
}

// ── Empty state, role-scoped variant ────────────────────────────────────────────────────────
// The THIRD reason a board can be empty, and until now the only one with no voice of its own.
//
// /api/jobs is profile-scoped through an INNER JOIN on job_role_map.role_key, so a board with no
// filters at all and zero rows is not "search for something" — it means nothing in the shared pool
// is bucketed under THIS profile's role. Saying "Search for a role above" there sent the user off to
// run a search that could not change the answer. Naming the profile makes the actual next move
// (switch or widen the profile) findable, and it is honest whether the cause is an empty pool or a
// role with no matches: either way, nothing matches this profile's role.
function RoleScopedEmptyState({ profileName }) {
  // ⭐ A233: a note card. Nothing on the board is sorted into this job profile's role, and no filter is hiding any.
  return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
      <NoteCard id="board-no-role-jobs" title={profileName ? `No jobs in your profile\u2019s role (${profileName}) yet` : "No jobs in your profile\u2019s role yet"}>
        Nothing on the board is sorted into this role yet, and no filter is hiding any. Switch job profile, or search to bring in new jobs.
      </NoteCard>
    </div>
  );
}

function SetupGateNotice({ theme, title, body, actionLabel, onAction, children = null }) {
  // ⭐ A233: a set-up gate is a note card — its title, one line, its one action.
  return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
                  padding:32, background:theme.bg }}>
      <NoteCard id={`board-gate-${String(title || "").slice(0, 24)}`} title={title} style={{ width:"min(92vw, 520px)" }}
        actions={children || (actionLabel && (
          <button className="dbx-depth" onClick={onAction}
            style={{ border:"none", padding:"10px 16px",
                     background:theme.accent, color:C.ON_ACCENT, fontWeight:800,
                     cursor:"pointer", fontFamily:"inherit"}}>
            {actionLabel}
          </button>
        ))}>
        {body}
      </NoteCard>
    </div>
  );
}

function SearchIntentDialog({ theme, prompt, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:750, background:C.SCRIM,
                  display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div role="dialog" aria-modal="true" style={{ width:"min(92vw, 460px)",
        background:theme.modalSurface || theme.surface, border:`1px solid ${theme.border}`,
        borderRadius:8, boxShadow:C.SHADOW_SM, padding:22 }}>
        <div style={{ fontFamily:"var(--font-display)", fontWeight:400,
                      fontSize:ts(26),
                      color:theme.text, marginBottom:8 }}>
          {prompt.title}
        </div>
        <div style={{ fontSize:ts(13), lineHeight:1.6, color:theme.textMuted, marginBottom:20 }}>
          {prompt.body}
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, flexWrap:"wrap" }}>
          <button onClick={onCancel}
            style={{ border:`1px solid ${theme.border}`, borderRadius:6, padding:"8px 12px",
                     background:theme.surface, color:theme.text, cursor:"pointer", fontWeight:700 }}>
            {prompt.cancelLabel || "Cancel"}
          </button>
          <button onClick={onConfirm}
            style={{ border:"none", borderRadius:6, padding:"8px 12px",
                     background:theme.accent, color:C.ON_ACCENT, cursor:"pointer", fontWeight:800 }}>
            {prompt.confirmLabel || "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// LinkedInInstallDialog removed in cleanup 5.3. Its only render site was gated behind
// startLinkedInImport's always-true "extension not installed" branch, and its Import Now
// button called back into that same function — an install prompt for a capability v1.2.0
// deleted from the extension, which no install could ever satisfy.

// ── Company Reuse Modal ────────────────────────────────────────
function CompanyReuseModal({ company, onUseExisting, onGenerateNew, onCancel, theme }) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:1000, display:"flex",
      alignItems:"center", justifyContent:"center",
      background:C.SCRIM, backdropFilter:"blur(3px)",
    }}
    onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{
        background:theme.surface, borderRadius:12, padding:28,
        maxWidth:380, width:"90%", boxShadow:theme.shadowLg,
        border:`1px solid ${theme.border}`,
        display:"flex", flexDirection:"column", gap:16,
      }}>
        <div style={{ fontSize:ts(18), fontWeight:800, color:theme.text }}>
          Previously applied to {company}
        </div>
        <div style={{ fontSize:ts(13), color:theme.textMuted, lineHeight:1.6 }}>
          You've already generated a resume for a role at <strong style={{ color:theme.text }}>{company}</strong>.
          Use your existing resume for this role, or generate a new one?
        </div>
        <div style={{ display:"flex", gap:10, flexDirection:"column" }}>
          <button className="dbx-depth" onClick={onUseExisting} style={{
            padding:"10px 0", border:`1px solid ${theme.accent}`,
            background:theme.accent, color:C.ON_ACCENT, fontWeight:800, fontSize:ts(13),
            cursor:"pointer", fontFamily:"inherit",
          }}>
            Use Existing Resume
          </button>
          <button className="dbx-depth" onClick={onGenerateNew} style={{
            padding:"10px 0", border:`1px solid ${theme.border}`,
            background:"transparent", color:theme.text, fontWeight:800, fontSize:ts(13),
            cursor:"pointer", fontFamily:"inherit",
          }}>
            Generate New
          </button>
          <button onClick={onCancel} style={{
            padding:"6px 0", border:"none", background:"none",
            color:theme.textMuted, fontSize:ts(12), cursor:"pointer",
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

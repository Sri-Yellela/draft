import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { companyRows, matchCompany } from "../../../shared/companyIdentity.js";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../styles/theme.jsx";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { Z } from "../styles/zLayers.js";
import {
  groupByApplication, groupByCompany, splitByFault, resolutionPlan, PREREQUISITE_LABELS,
} from "../lib/applyObstacles.js";
import {
  ApplicationRow, ApplicationObstacleCard, CompanyHeading, AttemptRow,
} from "./AutoApplyPanelSections.jsx";
import { companyLabel, UNKNOWN_COMPANY } from "../../../shared/atsHosts.js";
import { atsBandFor, atsBandLabel } from "../../../shared/atsBands.js";
import { REJECTION_REASONS, REJECTION_NOTE_MAX, RESPONSE_OUTCOME, RESPONSE_LABELS } from "../../../shared/applicationResponse.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import { TYPE } from "../styles/type.js";
// U6 · the tree's search is the shared one (PanelControls), never redrawn.
import { PanelSearch } from "../components/ui/PanelControls.jsx";
import WaitingLine from "../components/WaitingLine.jsx";
import AutoSettingsDrawer from "../components/AutoSettingsDrawer.jsx";
import DraftHouseTree, { Branch, RunCard } from "../components/DraftHouseTree.jsx";
// ⭐ D146 · the one tracker: the table (and its opened row), what each row says, and The Table's full sheet behind View.
import ApplicationTracker, { RowOpen, TrackerCounts, TrackerFilters, DEFAULT_SORT } from "../components/ApplicationTracker.jsx";
import { heldHeadline, runSteps, answerSource, earlierAttempts, saveForNextTimeLabel } from "../lib/heldApplication.js";
import {
  trackerRows, trackerView, trackerCounts, sortRows, stageActions, readyToSend, sendAllConfirmText, TRACKER_PERIODS,
} from "../lib/trackerRows.js";
import { DatabasePanel } from "./DatabasePanel.jsx";
import { ImportPanel } from "../components/ApplicationHistory.jsx";
import { saveText, csvName, downloadExcel } from "../lib/tableExport.js";
import { historyToCsv } from "../../../shared/applicationCsv.js";
import { REPLY_ASK } from "../../../shared/applicationHistory.js";
import { JobWorkspacePanel } from "./JobWorkspacePanel.jsx";
import { buildStoppedItems, packetLife, autoToggle, STOP_DOES, STOP_DOES_NOT } from "../lib/draftHouseExceptions.js";
import {
  buildNodes, buildTree, treeView, branchStep, createLeafCache, answerRows, inlineAnswerStart, isOwnStatement,
  leftOutLines, nextRunFromSettings, timeLabel, connectionsFromStopped, viewerTimeZone, timeZoneOptions,
} from "../lib/draftHouseTree.js";
import {
  loadRuns, loadLeftOut, actOnPick, makePickResume, loadAutoSettings, setPicksSwitch, loadTableRows, loadConnections, loadAnswers,
  confirmWithdrawn, saveNoteWhy, setInterviewDate,
} from "../lib/draftHouseRuns.js";
import { jobDetailHref } from "../lib/jobUrl.js";
import { useViewport } from "../hooks/useViewport.js";
import { A_PLUS_TOOL } from "../lib/applyTools.js";
import { ChangesSummaryLine, WhatWeSentLink } from "../components/ResumeChangesPanel.jsx";
import { postingClick } from "../lib/openPosting.js";
import AttemptResume from "../components/AttemptResume.jsx";
import AttemptPosting from "../components/AttemptPosting.jsx";

// ============================================================
// AutoApplyPanel — DRAFT HOUSE, THE ONE APPLICATION TRACKER (D146, owner 11-03; D113 UI before it)
// ============================================================
// The nav entry reads "Draft House · your applications" (D18, D145). The file and the /app/auto-apply route keep their
// old names — renaming them is cost without benefit (docs/BRAND.md). ⭐ D146: Draft House and The Table are ONE panel;
// /app/database redirects here (App.jsx) and The Table's own views live behind Settings → View → The full sheet.
//
// THE PAGE (the D146 row; tracker-options.html layout 1 on a computer, layout 3 on a phone):
//
//   HEADER    "Draft House" + "Every application, from draft to reply"; the mode switch Ask me first | Apply for me;
//             Settings (ONE drawer: when, which jobs, accounts, view — components/AutoSettingsDrawer.jsx); Import and
//             Export (The Table's CSV import, Excel and CSV export, unchanged in function); Send all ready (n) — one
//             confirm that lists them.
//   TABLE     one row of counts; the filters All · Needs you · In progress · Sent · Replies · Stopped, the search and the
//             period; plain rows and columns (components/ApplicationTracker.jsx), what each says from lib/trackerRows.js.
//             A row opens IN PLACE, one at a time: the stage's eyebrow and headline, the panes on demand (The posting ·
//             Résumé · Answers · Emails — the tree's old leaves) and the stage's actions (actionsFor below + the stage's).
//   TIMELINE  beside the table, ≈ 300 px (components/DraftHouseTree.jsx): D113's runs by day, each "N looked at · N picked
//             · why these", the jobs as small bubbles ringed by stage — Needs you, Ready, Working pulse. A bubble opens
//             its row in the table. Under it: Pause, Review all (Approve all inside it), the line, Tidy up and the bin.
//   PHONES    one column and a switch: Applications · Auto-apply timeline.
//   BANNER    a broken connection (a sign-in, Gmail, a missing profile field) is one line with its fix.
//
// ⛔ REPLACED: D113's side column (D146: its blocks are the counts, the filters and the banner), the job branch and its
// leaves (D146: the opened row's panes), D25's run bar, the separate Stopped list with its search, the tabbed list and select
// mode (Review all covers its one bulk use). ⛔ NO second status model: every ring
// is D102's ladder (shared/applicationStatus.js → lib/draftHouseTree.js ringFor). ⛔ NO second
// exceptions model: buildStoppedItems / groupByApplication / splitByFault / packetLife still decide
// what is held, broke or blocking. D113's runs and picks come through ONE adapter
// (lib/draftHouseRuns.js), which falls back to today's attempts grouped by day when its routes 404.
// The deep review behind every item (the modal below) is unchanged.
//
// The state is AutoApplyContext's, so the board and this panel read one pipeline.
// ============================================================

// ⭐ D149 (11-03) · tracker-options.html's `.ph3 h1`: the deck's page-title type at the sketch's fixed 44 px, no tracking.
const DH_TITLE = Object.freeze({ fontSize: "calc(44px * var(--type-scale, 1))", letterSpacing: "normal" });

export function AutoApplyPanel({ user = null } = {}) {
  const { theme } = useTheme();
  const { w: viewportWidth } = useViewport();
  const navigate = useNavigate();
  const {
    // The message line under the heading (it was setApplyQueueMsg, USED by retryJob and never
    // destructured, so every Retry click threw a ReferenceError — W1's "handler wired to nothing").
    applyMsg, setApplyMsg,
    applyRuns = [], applyReviewJobs = [], applyGatePortals = [],
    applyGateTruncated = false, applyGateTotal = null,
    applyHandoffPackets = [], handoffPacketFor, openHandoff, handoffMsg, setHandoffMsg,
    applyInFlight = [], applySubmitted = [], applyStopped = [], applyGatedJobs = [],
    applyPrereqMissing = [],
    // A59: Drafts waiting in line behind the running one, editable until they start.
    applyLine = { waiting: [], held: null }, lineMsg, lineBusyId, setLineTool, moveInLine, removeFromLine,
    draftTool,
    // D25's run bar data, read by the header now (mode, caps, hold).
    runBar = null, setStopEverything, setApplyMode, holdBusy = false, holdMsg = "",
    applyRunDetailOpen, setApplyRunDetailOpen,
    applyRunDetail, setApplyRunDetail,
    applyReviewScope, setApplyReviewScope,
    applyReadiness,
    applyQuestions = [], applyQuestionMeta,
    questionDrafts, setQuestionDrafts,
    questionRemember = {}, setQuestionRemember,
    answersSaving, answersMsg,
    applyPending = [], approvalCap, pendingDetail, pendingBusy, pendingMsg,
    confirmApproveAll, setConfirmApproveAll,
    draftJob, loadApplyRunDetail,
    submitApplyAnswers, openPendingDetail, decidePending,
    artifactUrl,
    // Abort and remove. Their confirmations arrive on historyMsg, the name AD1 gave the line.
    historyMsg, historyBusyId, abortRunJob, hideRunJob,
    // D53: the bin.
    bin = { items: [], binDays: 7 }, binMsg = "", binBusy = false, clearRunJobs, restoreBinItem, purgeBinItem, countOlderThan,
  } = useAutoApply();

  // Empty is a real state and is said plainly. Every cross-run feed counts: a user whose only
  // applications are SUBMITTED was once told "Nothing queued" over the top of their own applications.
  const nothingYet =
    !applyMsg && !applyRuns.length &&
    !applyReviewJobs.length && !applyPending.length && !applyQuestions.length &&
    !applyInFlight.length && !applySubmitted.length && !applyStopped.length &&
    !applyPrereqMissing.length && !(applyLine.waiting || []).length;

  // ── AB2: ONE ITEM PER APPLICATION ───────────────────────────────────────────────────────────
  // The server returns one row per RUN-JOB, so a job held, re-run and held again for a different
  // reason is three rows. groupByApplication is the rule that makes it one bubble.
  const heldApplications = groupByApplication(applyReviewJobs);

  // ── D25: WHAT BROKE, AND ONLY WHAT BROKE ────────────────────────────────────────────────────
  // splitByFault keeps held-on-purpose apart from broke. Only the BROKE half needs the user; the
  // held half is history. A failure whose job has since been drafted again is not listed: the newer
  // attempt is what that application is doing now.
  const liveJobIds = new Set([
    ...applyInFlight, ...applyReviewJobs, ...applyGatedJobs, ...applySubmitted, ...applyPending,
    ...(applyLine.waiting || []).flatMap(r => r.jobs || []),
  ].map(j => String(j?.jobId)));
  const brokeApplications = groupByApplication(
    splitByFault(applyStopped).broke.filter(j => !liveJobIds.has(String(j.jobId))));

  // The one exceptions model, read for what blocks EVERYTHING (a missing profile field) and what one
  // sign-in releases for many (a portal batch) — the side column's first block.
  const stoppedItems = buildStoppedItems({
    prereqMissing: applyPrereqMissing, prereqLabels: PREREQUISITE_LABELS,
    gatePortals: applyGatePortals, questions: applyQuestions, pending: applyPending,
    heldApplications, brokeApplications, companyLabel,
  });

  // ── D113 · the runs, the picks and what the tree needs on the same rhythm (lib/draftHouseRuns.js) ──
  const [d113, setD113] = useState({ available: false, runs: [], nextRunAt: null });
  const [settings, setSettings] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [connections, setConnections] = useState([]);
  useEffect(() => {
    let live = true;
    loadRuns().then(r => live && setD113(r));
    loadTableRows().then(r => live && setTableRows(r));
    return () => { live = false; };
  }, [applyRuns.length, applyPending.length, applySubmitted.length, applyInFlight.length]);
  useEffect(() => {
    let live = true;
    loadConnections().then(c => live && setConnections(c));
    return () => { live = false; };
  }, [applyGatePortals.length]);

  // U8 · the ONE Settings drawer; focus returns to the button that opened it. `group` scrolls to one.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsGroup, setSettingsGroup] = useState(null);
  const settingsOpener = useRef(null);
  useEffect(() => { if (!settingsOpen) loadAutoSettings().then(setSettings); }, [settingsOpen]);
  const openSettings = (group = null, el = null) => {
    settingsOpener.current = el || document.activeElement;
    setSettingsGroup(group); setSettingsOpen(true);
  };

  // D102 P5: the application open beside the tree (wide screens), by job id — "Full page".
  const [sideJob, setSideJob] = useState(null);
  const fullAuto = runBar?.mode?.current === "auto";
  // ⭐ D54 · a job's branch names the company's OTHER applications — The Table's rows, grouped by
  // the one identity (shared/companyIdentity.js). Re-read when the pipeline's feeds change.
  const [companyIndex, setCompanyIndex] = useState(null);
  // ⭐ D146 · The Table's rows ride the same read: they are the tracker's history half (lib/trackerRows.js).
  const [history, setHistory] = useState([]);
  const [historyTick, setHistoryTick] = useState(0);
  const refreshTableRecords = () => setHistoryTick(n => n + 1);
  useEffect(() => {
    api("/api/applications/history").then(d => {
      setHistory(Array.isArray(d?.rows) ? d.rows : []);
      const groups = companyRows(d?.rows || []);
      setCompanyIndex({ groups, members: new Map(groups.map(g => [g.key, g.roles.map(x => ({ company: x.company, url: x.applyUrl }))])) });
    }).catch(() => {});
  }, [applyRuns.length, applyPending.length, applyReviewJobs.length, applySubmitted.length, historyTick]);
  const companyOthers = (row) => {
    if (!companyIndex || !row) return null;
    const key = matchCompany({ company: row.company, url: row.applyUrl }, companyIndex.members);
    const g = key ? companyIndex.groups.find(x => x.key === key) : null;
    const others = g ? g.roles.filter(x => String(x.jobId) !== String(row.jobId)) : [];
    if (!others.length) return null;
    return `Also at ${g.name || companyLabel(row.company)}: ` +
      others.map(x => `${x.title || "a role"} — ${x.label.toLowerCase()}`).join("; ") + ".";
  };
  const othersLine = (row) => { const t = companyOthers(row); return t ? <p className="dh-fold__quiet" data-company-others="">{t}</p> : null; };
  // ⭐ D53 · CLEAR OLDER THAN 7 / 30 DAYS — each confirmed with its count; the bin keeps them 7 days.
  // ⛔ D113 UI U9: no select mode — Review all covers its one bulk use, and each job clears in its branch.
  const confirmOlder = async (days) => {
    const n = await countOlderThan?.(days);
    if (n === 0) { window.alert(`Nothing unsent is older than ${days} days.`); return; }
    if (n != null) confirmClear(n, { olderThanDays: days });
  };
  const confirmClear = (count, body) => {
    if (!count) return;
    if (window.confirm(`Clear ${count}? They stay in the bin for ${bin.binDays} days, then they are purged.`)) clearRunJobs(body);
  };

  // D102 P5: an opened application takes the right column from ~1280px; narrower it opens its own page.
  const sideDetail = viewportWidth >= 1280;

  const needsYouCount =
    applyGatePortals.reduce((n, p) => n + (p.count || 0), 0) +
    // APPLICATIONS, not rows: one application held three times is one.
    applyQuestions.length + applyPending.length + heldApplications.length +
    applyPrereqMissing.length;

  /**
   * TASK Q — THE BUDGET IS ON THE SCREEN WHERE IT IS SPENT: how the approval budget compares with what
   * is WAITING, beside Review all. Stated only when the server sent a cap and there is something to approve.
   */
  const approvalBudgetLine = !approvalCap || applyPending.length === 0 ? null
    : approvalCap.remaining === 0
      ? `You have used all ${approvalCap.limit} of today's approvals — these stay here until the limit resets.`
    : approvalCap.remaining < applyPending.length
      ? `${approvalCap.remaining} of ${approvalCap.limit} approvals left today, fewer than the ${applyPending.length} waiting.`
      : `${approvalCap.remaining} of ${approvalCap.limit} approvals left today.`;

  // ── AC1: OPEN IS SCOPED TO THE ITEM ─────────────────────────────────────────────────────────
  //
  // A scope is { label, jobIds, rowIds, only }. `only` narrows to one FACET of the popup, for the
  // items that are inherently about a queue rather than about one job — a portal batch, the question
  // queue, the approvals queue. Every item opens the popup on the thing it is standing for.
  const openScoped = (s) => { setApplyRunDetail(null); setApplyReviewScope(s); setApplyRunDetailOpen(true); };

  /**
   * THE UNSCOPED ENTRY POINT, AND THE ONLY ONE (AB3: "Review all" is the ONLY unscoped path).
   *
   * Named `openEverything` rather than `openReview` on purpose, and that rename IS the fix for a
   * class of defect, not decoration. AB3 rewrote every call site whose SHAPE was
   * `onAction={openReview}` into a scoped call and left one alone — the one whose `openReview` sat in
   * the fallback arm of a ternary — so Details was scoped and Open was not, on the same card. A
   * pattern-matched fix covers the shapes the author looked at; the identifier covers every shape.
   * So the unscoped handler is named away from the word every item's control uses, and no
   * item-level prop may name it (test/applyHeldResumable.test.js and scripts/abPanelUi.mjs).
   */
  const openEverything = () => openScoped(null);

  /** ONE application, with its full set of blocking reasons. */
  const openApplicationReview = (app) => openScoped({
    jobIds: app.jobId != null ? [String(app.jobId)] : [],
    // A row with no jobId can only be identified by its run-job ids, so both are carried and the
    // modal matches on either. Without this an unidentifiable application would scope to nothing and
    // the popup would come up empty.
    rowIds: (app.rows || []).map(r => r.id),
    label: [companyLabel(app.company), app.title].filter(Boolean).join(" — "),
  });

  /** ONE application waiting for approval: the approvals facet, narrowed to it. */
  const openApprovalReview = (p) => openScoped({
    jobIds: p.jobId != null ? [String(p.jobId)] : [],
    rowIds: p.runJobId != null ? [p.runJobId] : [],
    only: "pending",
    label: [companyLabel(p.company), p.title].filter(Boolean).join(" — "),
  });

  /**
   * One PORTAL's applications — the batch is the point here, so the scope is the batch.
   *
   * ── AE3: THE ATS HOST IS NOT THE EMPLOYER ───────────────────────────────────────────────────
   * This label was `${p.host} — N applications`, which is how the modal came to be headed
   * "JOBS.ASHBYHQ.COM — 1 APPLICATION" over a card that correctly said OpenAI. `jobs.ashbyhq.com` is
   * a multi-tenant apply host serving hundreds of unrelated employers, so it does not identify
   * anyone. The batch is named by the COMPANIES in it, with the host demoted to a detail about where
   * the sign-in happens.
   */
  const openPortalReview = (p) => {
    const jobIds = (applyHandoffPackets || [])
      .filter(k => k.expectedOrigin === p.origin).map(k => String(k.jobId));
    // Company comes from the ROW (scraped_jobs.company, carried through the feeds), never from the
    // URL. A packet knows an origin and a jobId; only the job knows who the employer is.
    const ids = new Set(jobIds);
    const companies = [...new Set(
      [...applyGatedJobs, ...applyReviewJobs]
        .filter(j => ids.has(String(j.jobId)))
        .map(j => companyLabel(j.company))
    )];
    // Two employers behind one portal is the amortisation case and reads better as a count than as
    // a list; one is named outright. UNKNOWN_COMPANY is what an unnameable employer gets — a
    // hostname is never a display name.
    const label = companies.length === 1 ? companies[0]
      : companies.length > 1 ? `${companies.length} employers`
      : UNKNOWN_COMPANY;
    return openScoped({
      jobIds, rowIds: [],
      label: `${label} — ${p.count} application${p.count === 1 ? "" : "s"}`,
    });
  };

  /** One facet of the queue: the questions, or the approvals. */
  const openFacet = (only, label) => openScoped({ jobIds: [], rowIds: [], only, label });

  const closeReview = () => { setApplyRunDetailOpen(false); setApplyRunDetail(null); setApplyReviewScope(null); };

  // The scope, applied. A run detail is its own scope and outranks this — opening "Run 9" is a
  // question about that run, not about one application.
  const scope = applyRunDetail ? null : applyReviewScope;
  // A facet scope says nothing about WHICH jobs, so it does not filter by job at all.
  const byJob = scope && (scope.jobIds?.length || scope.rowIds?.length);
  const inScope = (jobId, rowId) => !byJob
    || (jobId != null && scope.jobIds.includes(String(jobId)))
    || (rowId != null && scope.rowIds.includes(rowId));
  const facet = (name) => !scope?.only || scope.only === name;

  // A scope names specific applications, so it has to be able to show them whichever feed they came
  // from. Gated jobs live in their own feed and have only ever been visible as a portal BATCH — so
  // scoping to a portal and then filtering `review` alone would open an empty popup.
  const reviewPool = byJob
    ? [...applyReviewJobs, ...applyGatedJobs].filter((j, i, a) => a.findIndex(x => x.id === j.id) === i)
    : applyReviewJobs;
  const scopedReviewJobs = facet("applications") ? reviewPool.filter(j => inScope(j.jobId, j.id)) : [];
  const scopedPending    = facet("pending")      ? applyPending.filter(p => inScope(p.jobId, p.runJobId)) : [];
  // A question is in scope when it blocks this application. Questions are deduplicated across jobs
  // by the server, so one question can block several — it belongs to every one of them.
  const scopedQuestions  = facet("questions")
    ? applyQuestions.filter(q => !byJob || (q.blocking || []).some(b => inScope(b.jobId, null)))
    : [];

  // ── AC2: THE MODAL, AS COMPANY → APPLICATION → PROBLEMS ─────────────────────────────────────
  // The popup is the deep review behind every item, and it keeps AC2's grouping: one renderer, so
  // the item and the popup cannot disagree about how many applications there are.
  const modalApplications = groupByApplication(applyRunDetail ? applyRunDetail.jobs : scopedReviewJobs);
  const modalCompanies    = groupByCompany(modalApplications);

  // Which applications have their attempt list expanded. Keyed by the application key, so opening
  // one does not open another's, and the state outlives the popup rather than dying with it.
  const [openAttempts, setOpenAttempts] = useState({});

  /**
   * AC2 requirement 2: this application's problems, with the CO-RESOLVABLE ones lifted out.
   * resolutionPlan CONSUMES the server's own portal and question groupings rather than re-deriving
   * either; see the table there for which holds can share one crossing and which cannot.
   */
  const planFor = (app) => resolutionPlan(app, {
    portals: applyGatePortals, packets: applyHandoffPackets, questions: applyQuestions,
  });

  /** What an amortised action does when pressed. One per group KIND, and there are only two. */
  const resolveGroup = (item, app) => {
    if (item.kind !== "group") return;
    if (item.origin) {
      // The portal batch. Cross it via this application's own packet when there is one — that puts
      // the user on the real form with the answers already prepared — and fall back to the batch
      // view, which is what the panel's own portal item opens.
      const packet = handoffPacketFor?.(app.primary?.row) || handoffPacketFor?.(app);
      const portal = applyGatePortals.find(p => p.origin === item.origin);
      if (packet && !packet.stale && !packet.postingGone) openHandoff(packet, app);
      else if (portal) openPortalReview(portal);
      return;
    }
    // The shared question. Its answer is stored by exact question text and reused on every form
    // that asks it, so the questions facet is where it is answered — for all of them at once.
    if (item.question) openFacet("questions", item.question);
  };

  // ── ABORT AND REMOVE ────────────────────────────────────────────────────────────────────────
  // A GROUPED APPLICATION is every attempt at one posting, so remove takes ALL of its run-job ids:
  // hiding only the newest makes the item reappear on the next fetch wearing an earlier attempt's
  // face. An IN-FLIGHT row is one run-job, and Stop takes its own id. The abort endpoint is the
  // guard either way — a row that has already finished is refused there, not here.
  const hideApplication = (app) => hideRunJob((app.rows || []).map(r => r.id));
  const appBusy = (app) => (app.rows || []).some(r => r.id === historyBusyId);
  const rowAbort = (job) => abortRunJob(job.id);

  // No per-job retry endpoint exists — the only way to try again is a new run. "Retry" DRAFTS the job
  // again, at once, with the deck's and the board's own call, and says what it did rather than
  // implying the old attempt resumed.
  const retryJob = (job) => { draftJob?.(job, companyLabel(job.company)); };

  // The remedy for a STALE or unpreparable handoff (AB1 requirement 5): a fresh run, which produces
  // a fresh packet. There is no per-job re-dispatch endpoint, so it says what it actually did rather
  // than implying the application resumed by itself.
  const rerunJob = (job) => {
    setHandoffMsg(null);
    draftJob?.(job, companyLabel(job.company));
  };

  /**
   * AB4 requirement 5: a missing resume is a PROBLEM WITH A ONE-CLICK FIX. The click puts the job
   * back on the queue, because the run is what generates a resume (the pipeline's CASE C), and the
   * message says what actually happened rather than implying a resume now exists.
   */
  const generateResume = (job) => { draftJob?.(job, companyLabel(job.company)); };

  // ── D113 UI · THE TREE ──────────────────────────────────────────────────────────────────────
  // ⭐ D146 · the table's filter, search, period and sort; ONE thing open at a time (a row, or a run in the timeline).
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("any");
  // D149: the search and the period sit behind the filter row's last button, Search (not on the sketch's first screen).
  const [findOpen, setFindOpen] = useState(false);
  // D149 (11-03): the table opens in the sketch's order — what needs you first (status), every header still sorts.
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [open, setOpen] = useState(null);
  const [pane, setPane] = useState(null);
  const [phoneView, setPhoneView] = useState("table");
  // Settings → View: the table, or The Table's full sheet (a deep link with ?sheet= opens the sheet, as /app/database did).
  const [listView, setListView] = useState(() => { try { return new URLSearchParams(window.location.search).get("sheet") ? "sheet" : "table"; } catch { return "table"; } });
  const [sheetAt, setSheetAt] = useState(null);   // { sheet, jobId } — "I applied" opens the sheet's Pending at that job
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rowMsg, setRowMsg] = useState("");
  const [pickMsg, setPickMsg] = useState("");
  // U4 · "Make it now", per pick: { busy } while it is made, then { ok, message, atsScore }.
  const [madeNow, setMadeNow] = useState({});
  // U5 · a sent row's own action in its lead card: { key, kind: "date" | "note", date, time, note, busy, message }.
  const [rowEdit, setRowEdit] = useState(null);
  const [leftOut, setLeftOut] = useState({});
  const [, rerender] = useState(0);
  // U4: a leaf's data is asked for only when the leaf is opened, once (lib/draftHouseTree.js).
  const answersCache = useRef(null);
  if (!answersCache.current) answersCache.current = createLeafCache((runJobId) => loadAnswers(runJobId));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  const picks = useMemo(() => (d113.runs || []).flatMap(r => r.picks || []), [d113.runs]);
  const nodes = buildNodes({
    pending: applyPending, heldApplications, gatedJobs: applyGatedJobs, inFlight: applyInFlight, line: applyLine,
    brokeApplications, tableRows, picks, questions: applyQuestions, packetFor: handoffPacketFor, companyLabel, now,
  });
  const timeZone = settings?.timeZone;
  const held = !!runBar?.hold?.held;
  const picksOn = settings?.picks === true;
  const nextRunAt = held ? null : (d113.nextRunAt || ((fullAuto || picksOn) ? nextRunFromSettings(settings, now) : null));
  const tree = buildTree({ runs: d113.available ? d113.runs : null, nodes, nextRunAt, timeZone, now });
  // ⭐ D146: the timeline shows every run; filtering and search are the table's.
  const treeShown = treeView(tree, {});
  const view = treeShown;
  const brokenConnections = [...connectionsFromStopped(stoppedItems), ...connections];
  // ⭐ D146 · THE TABLE: one row per job — the nodes and The Table's history, merged (lib/trackerRows.js).
  const rows = trackerRows({ nodes, history, now });
  const periodDays = TRACKER_PERIODS.find(p => p[0] === period)?.[2] ?? null;
  const shownRows = sortRows(trackerView(rows, { filter, q, periodDays, now }), sort);
  const counts = trackerCounts(rows);
  const ready = readyToSend(rows);
  // CSV out: exactly the rows shown that The Table knows (D55 (i)).
  const csvRows = shownRows.map(r => r.hist).filter(Boolean);
  const exportExcel = async () => { try { await downloadExcel(user?.username); } catch (e) { setRowMsg(`Export failed: ${e.message}`); } };
  const sendAllReady = () => {
    if (!ready.length) return;
    if (window.confirm(sendAllConfirmText(ready, approvalCap))) decidePending(ready.map(r => r.runJobId), true);
  };

  // U4 · one branch open at a time; Escape closes. Opening from the side scrolls the tree to it.
  const step = (action) => setOpen(o => branchStep(o, action));
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !settingsOpen && !applyRunDetailOpen) setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, applyRunDetailOpen]);
  // ⭐ D146 · a timeline bubble opens THAT ROW in the table, in place, and scrolls to it (a filter hiding it is cleared).
  const openRow = (key) => {
    if (!shownRows.some(r => r.key === key)) { setFilter("all"); setQ(""); setPeriod("any"); }
    setListView("table"); setPhoneView("table");
    setOpen({ type: "job", key });
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-tracker-table] [data-row="${CSS.escape(key)}"]`);
      el?.scrollIntoView?.({ block: "center", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  };
  // A pane belongs to the row it was opened in: opening another row starts with none shown.
  useEffect(() => { setPane(null); }, [open?.key]);
  // ⛔ An own statement (an attestation, an eligibility answer) is never sent from a value the system seeded.
  useEffect(() => {
    const ask = open?.type === "job" ? nodes.find(n => n.key === open.key)?.question : null;
    if (ask && ask.proposed != null && isOwnStatement(ask, [ask]) && questionDrafts?.[ask.question] === ask.proposed) {
      setQuestionDrafts(prev => ({ ...prev, [ask.question]: "" }));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Full page" — the application's own page (JobWorkspacePanel): beside the tree on a wide screen.
  const openFull = (jobId) => {
    if (jobId == null) return;
    if (sideDetail) setSideJob(String(jobId)); else navigate(`/app/job/for/${encodeURIComponent(jobId)}`);
  };
  const pickAct = async (node, act) => {
    const r = await actOnPick(node.pickId, act);
    setPickMsg(r.message);
    if (r.ok) loadRuns().then(setD113);
  };
  // U4 · "Make it now": the pick's tailored résumé before Apply. The pick stays a pick; nothing is sent.
  const makeNow = async (node) => {
    setMadeNow(m => ({ ...m, [node.pickId]: { busy: true } }));
    const r = await makePickResume(node.pickId);
    setMadeNow(m => ({ ...m, [node.pickId]: { ok: r.ok, message: r.message, atsScore: r.atsScore } }));
    if (r.ok) loadRuns().then(setD113);
  };
  // U5 · Withdraw / Add the date / Note why — each recorded in draft only; ⛔ nothing goes to the employer.
  const afterRowAct = (node, r) => {
    setRowEdit(r.ok ? { key: node.key, kind: "done", message: r.message } : { ...(rowEdit || { key: node.key }), busy: false, message: r.message });
    if (r.ok) loadTableRows().then(setTableRows);
  };
  // ⛔ Withdraw never claims to withdraw: it opens the company's page (the action's link) and asks for "I withdrew it".
  const withdrawRow = (node) => setRowEdit({ key: node.key, kind: "withdraw" });
  const confirmWithdrawnRow = async (node) => {
    setRowEdit({ key: node.key, kind: "withdraw", busy: true });
    afterRowAct(node, await confirmWithdrawn(node.applicationId));
  };
  const saveRowEdit = async (node) => {
    const e = rowEdit;
    setRowEdit({ ...e, busy: true });
    afterRowAct(node, e.kind === "date"
      ? await setInterviewDate(node.applicationId, e.date, e.time, e.timeZone)
      : await saveNoteWhy(node.applicationId, e.note, e.reasons));
  };
  const portalFor = (node) => applyGatePortals.find(p => (applyHandoffPackets || []).some(k => k.expectedOrigin === p.origin && String(k.jobId) === String(node.jobId)));
  const yourself = (row) => row?.applyUrl
    ? [{ id: "yourself", label: "Apply yourself", href: row.applyUrl, onClick: (e) => postingClick(row, e, { intent: "apply" }) }] : [];
  const clearIt = (r) => ({ id: "clear", label: "Clear", disabled: appBusy(r),
    title: "Clear — into the bin for 7 days, restorable, then purged. Not a Pass.", onClick: () => hideApplication(r) });

  /** U5 · the next action per state. Today's obstacle cards became these. */
  const actionsFor = (node) => {
    const r = node.ref;
    switch (node.kind) {
      case "approval": return [
        { id: "approve", label: "Approve & send", kind: "primary", disabled: pendingBusy,
          title: "Approving submits it to the employer and cannot be undone.", onClick: () => decidePending([r.runJobId], true) },
        { id: "reject", label: "Reject", kind: "danger", disabled: pendingBusy, onClick: () => decidePending([r.runJobId], false) },
        // D53: Clear behaves the same in every unsent state — here too.
        { id: "clear", label: "Clear", disabled: binBusy, title: "Clear — into the bin for 7 days, restorable. Not a Pass.",
          onClick: () => clearRunJobs({ runJobIds: [r.runJobId] }) },
      ];
      case "held": {
        const row = r.primary?.row || r;
        if (node.why === "question") return [
          { id: "answer", label: answersSaving ? "Saving…" : "Answer", kind: "primary", disabled: answersSaving, onClick: () => submitApplyAnswers(true) },
          { ...clearIt(r), label: "Stop this one" },
        ];
        // D53: one word for one act — a posting that is gone is CLEARED like anything else (Restore is in the bin).
        if (node.why === "gone") return [clearIt(r)];
        if (node.why === "empty") return [
          { id: "answer", label: "Answer them", kind: "primary", onClick: () => openApplicationReview(r) }, ...yourself(row)];
        const packet = handoffPacketFor?.(r.primary?.row) || handoffPacketFor?.(r);
        const resumable = !!packet && !packet.postingGone && !packet.stale && !r.postingGone;
        // ⭐ D52: a stale (or never-built) packet is ONE click from fresh — a new Draft of the same job.
        const life = packetLife(packet);
        // Only a packet that EXISTED and went stale: a hold with no packet (a cap, the pause) is not
        // cleared by drafting again.
        const prepare = !resumable && !r.postingGone && !!packet && life.state === "stale";
        if (prepare) return [
          { id: "prepare", label: "Prepare again", kind: "primary",
            title: `${life.line} A new Draft prepares them now and waits for you — it uses one of your drafts.`,
            onClick: () => retryJob(r.primary?.row || r) },
          clearIt(r),
        ];
        return [
          // THE AC1 DEFECT, STILL FIXED: the non-resumable arm is the SCOPED handler.
          { id: "open", label: resumable ? "Open & fill" : "Open", kind: "primary",
            title: resumable
              ? `${life.line} Opens the application in your own browser and fills it with the ${packet.answerCount} answer${packet.answerCount === 1 ? "" : "s"} we already resolved. You review and submit.`
              : "Open this application's review — only this one",
            onClick: resumable ? () => openHandoff(packet, r) : () => openApplicationReview(r) },
          // AB4 requirement 5, with its guard: only where the résumé is what is actually wrong.
          ...(r.primary?.resumeBlocked && !r.primary?.row?.resumeAvailable ? [{ id: "resume", label: "Generate résumé", onClick: () => generateResume(row) }] : []),
          ...yourself(row), clearIt(r),
        ];
      }
      case "gated": {
        const portal = portalFor(node);
        return [{ id: "signin", label: "Sign in again", kind: "primary",
          onClick: portal ? () => openPortalReview(portal) : () => openApplicationReview({ jobId: r.jobId, rows: [r], company: r.company, title: r.title }) },
          ...yourself(r)];
      }
      case "inflight":
        return r.abortable === false ? [] : [{ id: "stop", label: "Stop this one", disabled: historyBusyId === r.id, onClick: () => rowAbort(r) }];
      case "line":
        return [{ id: "remove", label: "Stop this one", disabled: lineBusyId === r.run.id, onClick: () => removeFromLine(r.run.id) }];
      case "broke": {
        const lead = r.primary || {};
        const row = lead.row || r;
        if (node.why === "noconfirm") return [
          row.screenshotAvailable
            ? { id: "check", label: "Check it", kind: "primary", href: artifactUrl(row.id, "screenshot") }
            : { id: "check", label: "Check it", kind: "primary", onClick: () => loadApplyRunDetail(row.runId) },
          { id: "again", label: "Run it again", onClick: () => retryJob(row) }, ...yourself(row)];
        return [
          lead.retryable
            ? { id: "again", label: "Run it again", kind: "primary", title: "Draft it again — a new run, and nothing is sent until you approve it", onClick: () => retryJob(row) }
            : { id: "log", label: "The run's log", kind: "primary", onClick: () => loadApplyRunDetail(row.runId ?? r.runId) },
          ...yourself(row), clearIt(r),
        ];
      }
      case "pick": return node.ring === "pick" ? [
        { id: "apply", label: "Apply", kind: "primary", onClick: () => pickAct(node, "apply") },
        { id: "pass", label: "Pass", onClick: () => pickAct(node, "pass") },
      ] : [];
      // Sent and replied: the application's own page holds the prep, the emails and the outcome.
      // U5: Withdraw, Add the date and Note why act here (on the ladder; nothing is sent to the employer).
      case "sent": return [
        { id: "heard", label: "I heard back", kind: "primary", onClick: () => openFull(node.jobId) },
        // Opens the company's own page for the application in a new tab (LeadCard renders an href as target=_blank).
        { id: "withdraw", label: "Withdraw", ...(r.url ? { href: r.url } : {}),
          title: `Opens ${node.company}'s page. draft cannot withdraw it for you.`, onClick: () => withdrawRow(node) },
      ];
      case "withdrawn": return [];
      case "reply": {
        if (node.status === "rejected") return [{ id: "note", label: "Note why", kind: "primary",
          onClick: () => setRowEdit({ key: node.key, kind: "note", note: r.rejection?.note || "", reasons: r.rejection?.reasons || [] }) }];
        const label = { interview: "Open interview prep", assessment: "Prep for it", offer: "Open it" }[node.status] || "Open it";
        // Add the date — an interview or an assessment; editable (opened with the date already saved).
        return [{ id: "reply", label, kind: "primary", onClick: () => openFull(node.jobId) },
          ...((node.status === "interview" || node.status === "assessment") ? [{ id: "date", label: r.interview ? "Change the date" : "Add the date",
            onClick: () => setRowEdit({ key: node.key, kind: "date", date: r.interview?.ymd || "", time: r.interview?.time || "",
              timeZone: r.interview?.timeZone || viewerTimeZone() }) }] : [])];
      }
      default: return [];
    }
  };

  /** The run-job a node's leaves read (answers, the picture of the form, the résumé). */
  const runJobOf = (node) => node.kind === "approval" ? node.ref.runJobId
    : (node.kind === "held" || node.kind === "broke") ? (node.ref.primary?.row?.id ?? node.ref.rows?.[0]?.id ?? null)
    : (node.kind === "gated" || node.kind === "inflight") ? node.ref.id : null;
  const rowsOf = (node) => (node.kind === "held" || node.kind === "broke") ? (node.ref.rows || [])
    : (node.kind === "gated" || node.kind === "inflight") ? [node.ref] : [];
  const sentAlready = (node) => node.ring === "sent" || node.ring === "reply" || node.kind === "withdrawn";

  const AnswersBody = ({ node }) => {
    const id = runJobOf(node);
    const entry = answersCache.current.get(id);
    useEffect(() => { if (id != null) answersCache.current.open(id, () => rerender(n => n + 1)); }, [id]);
    if (id == null) return <p className="dh-fold__quiet">No form was filled for this one yet.</p>;
    if (entry.state !== "ready") return <p className="dh-fold__quiet">{entry.state === "error" ? entry.error : "Reading the answers…"}</p>;
    const rows = answerRows(entry.data.answers, entry.data.openQuestions);
    if (!rows.length) return <p className="dh-fold__quiet">No answers recorded.</p>;
    return (
      <>
        {rows.map((a, i) => (
          <div key={i} className="dht-r" data-answer-row={a.own ? "own" : a.guess ? "guess" : "plain"}>
            <span>{a.label}{a.guess && <span className="dht-flag"> read this: matched loosely</span>}
              {a.own && <span className="dht-own"> your own statement</span>}</span>
            <span className="dht-r__s">{a.shown}</span>
            {/* ⭐ D165 (5): each answer's source, in plain words. */}
            <small className="dht-r__s" data-answer-source={a.provenance || (a.asked ? "asked" : a.own ? "own" : "draft")}>{answerSource(a)}</small>
          </div>
        ))}
        {node.kind === "approval" && (
          <button type="button" className="dh-btn" onClick={() => openApprovalReview(node.ref)}>Review every answer</button>
        )}
      </>
    );
  };

  const leavesFor = (node) => {
    const id = runJobOf(node);
    const row = node.kind === "approval" ? node.ref : (node.ref?.primary?.row || node.ref?.job || node.ref);
    const rows = rowsOf(node);
    const out = [];
    out.push({ id: "happened", label: "What happened",
      sub: node.kind === "pick" ? "picked" : rows.length ? `${rows.length} attempt${rows.length === 1 ? "" : "s"}${node.ring === "stop" ? ", stopped" : ""}` : "",
      body: () => (
        <>
          {node.kind === "pick" && <p className="dh-fold__quiet">Picked {node.line ? `— ${node.line}` : "for you"}. Nothing is sent until you tap Apply.</p>}
          {node.kind === "approval" && <p className="dh-fold__quiet">Filled and checked. Nothing has been sent.</p>}
          {sentAlready(node) && <p className="dh-fold__quiet">{node.say}</p>}
          {/* An in-flight row is progress: its own line, with Stop and the run's detail. */}
          {node.kind === "inflight" ? (
            <ApplicationRow job={node.ref} theme={theme} variant="inFlight"
              artifactUrl={artifactUrl} onOpenRun={loadApplyRunDetail}
              onAbort={rowAbort} busy={historyBusyId === node.ref.id} />
          ) : rows.map(rw => (
            <AttemptRow key={rw.id} job={rw} theme={theme} artifactUrl={artifactUrl} packetFor={handoffPacketFor}
              onHandoff={openHandoff} onRerun={rerunJob} />
          ))}
          {/* A held application's problems, in the review scoped to it (AC1: never the unscoped one). */}
          {node.kind === "held" && (() => { const r = node.ref; return (
            <button type="button" className="dh-btn" onClick={() => openApplicationReview(r)}>Open its review</button>
          ); })()}
          {(row?.runId != null) && (
            <button type="button" className="dh-btn" onClick={() => loadApplyRunDetail(row.runId)}>The run's log</button>
          )}
        </>
      ) });
    if (node.kind !== "pick" && !sentAlready(node)) {
      out.push({ id: "answers", label: "Answers",
        sub: node.kind === "approval" ? `${node.ref.answerCount} filled${node.ref.guessCount ? ` · ${node.ref.guessCount} to read` : ""}` : "every field and value",
        body: () => <AnswersBody node={node} /> });
      const shot = node.kind === "approval" ? node.ref.screenshotAvailable : row?.screenshotAvailable;
      out.push({ id: "form", label: "The form as filled", sub: "a picture of the page",
        body: () => (
          <>
            {shot && id != null
              ? <a className="dh-btn" href={artifactUrl(id, "screenshot")} target="_blank" rel="noreferrer">What we filled ↗</a>
              : <p className="dh-fold__quiet">No picture of this one.</p>}
            <p className="dh-fold__quiet">Read it before you approve. After sending it is the record of what went out.</p>
          </>
        ) });
    }
    const made = node.kind === "pick" ? (madeNow[node.pickId] || {}) : {};
    const pickReady = node.kind === "pick" && (node.ref?.resumeReady === true || made.ok === true);
    out.push({ id: "resume", label: "Your résumé for it",
      sub: node.kind === "pick" ? (pickReady ? "made" : "made after you tap Apply") : "",
      body: () => node.kind === "pick" ? (
        <>
          {pickReady
            ? <p className="dh-fold__quiet">Made{made.atsScore != null ? `. Résumé: ${atsBandLabel(atsBandFor(made.atsScore)).short}` : ""}. Nothing was sent.</p>
            : <p className="dh-fold__quiet">Not made yet: it is tailored only after you tap Apply.</p>}
          {pickReady && node.jobId != null && <ChangesSummaryLine jobId={node.jobId} jobLabel={node.company} />}
          {/* ⭐ D171 FIX 4: the résumé opens in draft's editor, never only a link to Profile. */}
          {pickReady && node.jobId != null && (
            <AttemptResume jobId={node.jobId} company={node.company} artifactUrl={artifactUrl} className="dh-btn" />
          )}
          {/* U4: Make it now — only for a pick still waiting for Apply (after Apply the run makes it). */}
          {!pickReady && node.ring === "pick" && (
            <button type="button" className="dh-btn" data-action="make-now" disabled={!!made.busy}
              title="Tailors it now. Uses one of your drafts. Nothing is sent." onClick={() => makeNow(node)}>
              {made.busy ? "Making it…" : "Make it now"}
            </button>
          )}
          {made.message && !made.ok && <p className="dh-fold__quiet" role="status">{made.message}</p>}
        </>
      ) : (
        <>
          {node.kind === "approval" && (
            <p className="dh-fold__quiet">
              {node.ref.generationDeferred
                ? `No résumé yet — approving writes the tailored one. Base résumé: ${atsBandLabel(node.ref.baseAts?.band ?? null).short}.`
                : `Résumé: ${atsBandLabel(atsBandFor(node.ref.resume?.atsScore ?? null)).short}.`}
              {approvalCap ? ` ${approvalCap.remaining} of ${approvalCap.limit} approvals left today.` : ""}
            </p>
          )}
          {/* D90 P3: the CHANGES, read before Approve & send — nothing to show until the résumé is written. */}
          {node.jobId != null && node.kind !== "approval" && (
            <ChangesSummaryLine jobId={node.jobId} jobLabel={node.company} />
          )}
          {/* ⭐ D171 FIX 4 (owner 11-06: "resume on home should open the resume sandbox editor, but its taking me to your
              resumes"): every row's résumé opens in the editor — the attempt's own, else the job's tailored one; read-only
              once it was sent. It was offered on rows waiting for approval only, so the rest showed just the Profile link. */}
          {(runJobOf(node) != null || node.jobId != null) && !(node.kind === "approval" && !node.ref.resume?.available) && (
            <AttemptResume runJobId={runJobOf(node)} jobId={node.jobId ?? null} sent={sentAlready(node)}
              company={node.company} artifactUrl={artifactUrl} className="dh-btn" />
          )}
        </>
      ) });
    out.push({ id: "job", label: "The job", sub: "the posting, why it was picked",
      body: () => (
        <>
          {node.line && <p className="dh-fold__quiet">{node.line}</p>}
          {othersLine(row)}
          {/* ⭐ D171 FIX 3: an application's posting opens IN PLACE — the JD as stored when it was made, Open the original,
              and the Résumé beside it to compare. A pick is not an application yet: its posting is the live one. */}
          {node.kind !== "pick" && (runJobOf(node) != null || node.jobId != null) ? (
            <AttemptPosting runJobId={runJobOf(node)} jobId={node.jobId ?? null} fallbackUrl={row?.applyUrl || null}
              className="dh-btn" noteClassName="dh-fold__quiet" actsClassName="dht-acts">
              {!(node.kind === "approval" && !node.ref.resume?.available) && (
                <AttemptResume runJobId={runJobOf(node)} jobId={node.jobId ?? null} sent={sentAlready(node)}
                  company={node.company} artifactUrl={artifactUrl} className="dh-btn" />
              )}
              {node.jobId != null && <a className="dh-btn" href={jobDetailHref(node.jobId)}>On the board</a>}
            </AttemptPosting>
          ) : (<>
            {row?.applyUrl && (
              <a className="dh-btn" href={row.applyUrl} target="_blank" rel="noreferrer" onClick={(e) => postingClick(row, e)}>The posting ↗</a>
            )}
            {node.jobId != null && <a className="dh-btn" href={jobDetailHref(node.jobId)}>On the board</a>}
          </>)}
        </>
      ) });
    return out;
  };

  // ⭐ D146 · THE OPENED ROW — in place, one at a time: the eyebrow and headline for its stage, the panes on demand,
  // the stage's actions. Its panes are Draft House's leaves, grouped (PANE_LEAVES) — the posting (the job), the résumé,
  // the answers (every field, the form as filled, what happened) — and the application's emails (D103 / D112).
  const PANE_LEAVES = { posting: ["job"], resume: ["resume"], answers: ["answers", "form", "happened"] };
  const profileLink = <button type="button" className="dh-btn" data-profile-link="" onClick={() => navigate("/app/profile")}>Your résumés, in Profile</button>;
  const paneFor = (row) => (id) => {
    if (id === "emails") return <EmailsBody row={row} />;
    if (!row.node) return <HistoryBody row={row} pane={id} />;
    const ls = leavesFor(row.node).filter(l => (PANE_LEAVES[id] || []).includes(l.id));
    return (
      <>
        {ls.map(l => (
          <section key={l.id} className="dht-deep" data-leaf-body={l.id}>
            <b>{l.label}</b>{l.sub && <span className="dht-r__s">{l.sub}</span>}
            {l.body()}
          </section>
        ))}
        {id === "resume" && profileLink}
      </>
    );
  };
  // A Table-only row (an application recorded, imported or sent before Draft House saw it): what the history knows.
  const HistoryBody = ({ row, pane: id }) => {
    const h = row.hist || {};
    // ⭐ D171 FIX 3: the posting opens in place here too — the person's own application's copy, else today's, said so.
    if (id === "posting") return row.jobId != null ? (
      <AttemptPosting jobId={row.jobId} fallbackUrl={h.applyUrl || null}
        className="dh-btn" noteClassName="dh-fold__quiet" actsClassName="dht-acts">
        {!h.imported && <AttemptResume recordId={h.recordId ?? null} jobId={row.jobId} sent company={row.company} className="dh-btn" />}
        {h.postingListed && <a className="dh-btn" href={jobDetailHref(row.jobId)}>On the board</a>}
      </AttemptPosting>
    ) : (
      <div className="dht-acts">
        {h.applyUrl
          ? <a className="dh-btn" href={h.applyUrl} target="_blank" rel="noreferrer" onClick={(e) => postingClick(h, e)}>The posting ↗</a>
          : <p className="dh-fold__quiet">The posting is not stored for this one.</p>}
      </div>
    );
    if (id === "resume") return (
      <>
        {h.imported ? <p className="dh-fold__quiet">Sent elsewhere — imported, so draft has no résumé for it.</p>
          : <ChangesSummaryLine jobId={row.jobId} jobLabel={row.company} />}
        <div className="dht-acts">
          {!h.imported && (h.recordId != null || row.jobId != null) && (
            <AttemptResume recordId={h.recordId ?? null} jobId={row.jobId ?? null} sent company={row.company} className="dh-btn" />
          )}
          <WhatWeSentLink jobId={row.jobId} recordId={h.recordId} jobLabel={row.company} className="dh-btn" />{profileLink}
        </div>
      </>
    );
    return null;
  };
  // The Emails pane: the application's own mail, read when the pane opens (GET /api/pipeline/job-for/:jobId), once.
  const emailsCache = useRef(null);
  if (!emailsCache.current) emailsCache.current = createLeafCache((jobId) => api(`/api/pipeline/job-for/${encodeURIComponent(jobId)}`));
  const EmailsBody = ({ row }) => {
    const id = row.jobId != null ? String(row.jobId) : null;
    const entry = id != null ? emailsCache.current.get(id) : { state: "none" };
    useEffect(() => { if (id != null) emailsCache.current.open(id, () => rerender(n => n + 1)); }, [id]);
    const mail = entry.state === "ready" ? (entry.data?.emails || []) : [];
    return (
      <>
        {entry.state === "loading" || entry.state === "idle" ? <p className="dh-fold__quiet">Reading the emails…</p>
          : mail.length === 0 ? <p className="dh-fold__quiet">No email linked to this application yet. Replies you forward to your draft inbox, or read through Gmail, appear here.</p>
          : mail.map(m => (
            <div key={m.id} className="dht-r" data-email={m.id}>
              <span><b>{m.subject || "(no subject)"}</b>{m.preview ? <span className="dht-r__s"> {m.preview}</span> : null}</span>
              <span className="dht-r__s">{m.category}{m.receivedAt ? ` · ${new Date(m.receivedAt * 1000).toLocaleDateString()}` : ""}</span>
            </div>
          ))}
        <div className="dht-acts"><button type="button" className="dh-btn" data-open-inbox="" onClick={() => openSheet("inbox", null)}>The inbox</button></div>
      </>
    );
  };

  // ⭐ D146 · A ROW'S ACTIONS: Draft House's for its node (actionsFor — unchanged), then the stage's own
  // (lib/trackerRows.js stageActions) that the node's set does not already carry, then a Table-only row's.
  const openSheet = (sheet, jobId) => { setSheetAt({ sheet, jobId }); setListView("sheet"); };
  const tableAct = async (row, path, init, done) => {
    setRowMsg("");
    try { await api(path, init); setRowMsg(done); }
    catch (e) { setRowMsg(`Not saved — ${e.message || "try again"}.`); }
    refreshTableRecords(); loadTableRows().then(setTableRows);
  };
  const recordReply = (row, outcome) => tableAct(row, `/api/apply/applications/${encodeURIComponent(row.jobId)}/response`,
    { method: "PATCH", body: JSON.stringify({ outcome, source: "manual" }) },
    outcome === RESPONSE_OUTCOME.NO_RESPONSE ? "Recorded: no reply." : `Recorded: ${RESPONSE_LABELS[outcome]?.label ?? outcome}.`);
  const extraAction = (row, id) => {
    const n = row.node, h = row.hist;
    switch (id) {
      case "edit": return n?.kind === "approval" ? { id, label: "Edit an answer", onClick: () => openApprovalReview(n.ref) } : null;
      case "form": return row.panes.includes("answers") ? { id, label: "See the form", onClick: () => setPane("answers") } : null;
      case "reply_ask": return (h?.ask || row.stage === "no_reply") && row.jobId != null
        ? REPLY_ASK.map(a => ({ id: `reply-${a.outcome}`, label: a.label, onClick: () => recordReply(row, a.outcome) })) : null;
      case "record": return !n && h ? { id, label: "I applied", kind: "primary", title: "Record when and how you applied — in the full sheet's Pending",
        onClick: () => openSheet("pending", row.jobId) } : null;
      case "did_not_apply": return !n && h?.recordState === "pending" ? { id, label: "I did not apply",
        onClick: () => tableAct(row, `/api/applications/pending/${encodeURIComponent(row.jobId)}/withdraw`, { method: "POST" }, "Moved to Not applied.") } : null;
      case "restore": return !n && h ? { id, label: "Restore", kind: "primary", title: "Back to Pending for another 14 days",
        onClick: () => tableAct(row, `/api/applications/not-applied/${encodeURIComponent(row.jobId)}/restore`, { method: "POST" }, "Restored to Pending.") } : null;
      default: return null;
    }
  };
  const rowActions = (row) => {
    const base = row.node ? actionsFor(row.node) : [];
    const have = new Set(base.map(a => a.id));
    const extra = stageActions(row.stage).filter(id => !have.has(id)).flatMap(id => [extraAction(row, id)].flat()).filter(Boolean);
    const n = row.node;
    // The application's own page (JobWorkspacePanel) — what the lead card's "Full page" was.
    const page = n ? (n.jobId != null && !sentAlready(n) ? [{ id: "page", label: "Full page", onClick: () => openFull(n.jobId) }] : [])
      : row.hist?.recordId != null ? [{ id: "page", label: "Its own page", onClick: () => navigate(`/app/job/${row.hist.recordId}`) }] : [];
    return [...base, ...extra, ...page];
  };

  // ⭐ D165 (5) · the held application (held-application-sketch.html): its state's words, the steps the run took, one
  // quiet line for an earlier attempt. The answers' count comes from the approval packet when there is one.
  const heldFor = (node) => {
    const h = node ? heldHeadline(node) : null;
    if (!h) return null;
    const counts = node.kind === "approval" && Number.isFinite(node.ref?.answerCount)
      ? { filled: node.ref.answerCount, total: node.ref.answerCount + (node.ref.openCount || 0) } : null;
    return { ...h, steps: runSteps(node, { counts }), earlier: earlierAttempts(rowsOf(node)) };
  };
  const renderRow = (row) => {
    const node = row.node;
    const ask = node?.question;
    return (
      <RowOpen row={row} pane={pane} onPane={setPane} paneBody={paneFor(row)} actions={rowActions(row)} onClose={() => step({ type: "close" })}
        held={heldFor(node)}>
        {node && (<>
            {/* D90 P3: the CHANGES, read before Approve & send — nothing to show until the résumé is written. */}
            {node.kind === "approval" && !node.ref.generationDeferred && <ChangesSummaryLine jobId={node.ref.jobId} jobLabel={companyLabel(node.ref.company)} />}
            {/* U5 · a question is answered INLINE. ⛔ The user's own statement never starts filled. */}
            {ask && (
              <div className="dht-ask" data-inline-question="">
                <input aria-label={ask.question} value={inlineAnswerStart(ask, questionDrafts?.[ask.question])}
                  onChange={(e) => setQuestionDrafts(prev => ({ ...prev, [ask.question]: e.target.value }))} />
                {/* D55 (f) + D165 (5): ticked keeps it — a salary for the scope the server names ("Use this for similar
                    jobs (engineering, US) next time"), any other answer for every employer. */}
                <label data-save-for-next-time="" data-save-scope={ask.salary ? (ask.scope || "open") : "all"}>
                  <input type="checkbox" checked={questionRemember[ask.question] !== false}
                    onChange={(e) => setQuestionRemember?.(prev => ({ ...prev, [ask.question]: e.target.checked }))} />
                  {saveForNextTimeLabel(ask)}
                </label>
                {answersMsg && <span className="dh-fold__quiet" role="status">{answersMsg}</span>}
              </div>
            )}
            {/* U5 · Add the date / Note why, inline in the lead card; a result line after any of the three. */}
            {/* U5 · Withdraw: the company's page opened in a new tab; the user confirms here once they have withdrawn. */}
            {rowEdit?.key === node.key && rowEdit.kind === "withdraw" && (
              <div className="dht-ask" data-row-edit="withdraw">
                <span>Withdraw it on {node.company}'s site; then confirm here.</span>
                <div className="dht-acts">
                  <button type="button" className="dh-btn" data-kind="primary" data-action="confirm-withdrawn"
                    disabled={!!rowEdit.busy} onClick={() => confirmWithdrawnRow(node)}>I withdrew it</button>
                  <button type="button" className="dh-btn" onClick={() => setRowEdit(null)}>Cancel</button>
                </div>
              </div>
            )}
            {rowEdit?.key === node.key && (rowEdit.kind === "date" || rowEdit.kind === "note") && (
              <div className="dht-ask" data-row-edit={rowEdit.kind}>
                {rowEdit.kind === "date" ? (
                  <>
                    <input type="date" aria-label="Interview date" value={rowEdit.date}
                      onChange={(e) => setRowEdit({ ...rowEdit, date: e.target.value })} />
                    <input type="time" aria-label="Interview time (optional)" value={rowEdit.time}
                      onChange={(e) => setRowEdit({ ...rowEdit, time: e.target.value })} />
                    <select aria-label="Time zone" value={rowEdit.timeZone}
                      onChange={(e) => setRowEdit({ ...rowEdit, timeZone: e.target.value })}>
                      {timeZoneOptions(rowEdit.timeZone).map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    {/* Quick picks (what D111 may later count) + a short private note — never read by a model. */}
                    {Object.entries(REJECTION_REASONS).map(([k, l]) => (
                      <label key={k} data-reason={k}>
                        <input type="checkbox" checked={rowEdit.reasons.includes(k)}
                          onChange={(e) => setRowEdit({ ...rowEdit, reasons: e.target.checked ? [...rowEdit.reasons, k] : rowEdit.reasons.filter(x => x !== k) })} />
                        {l}
                      </label>
                    ))}
                    <textarea aria-label="Why they said no" rows={3} maxLength={REJECTION_NOTE_MAX} value={rowEdit.note}
                      onChange={(e) => setRowEdit({ ...rowEdit, note: e.target.value })} />
                    <span>{rowEdit.note.length} / {REJECTION_NOTE_MAX}. Private: only you see it.</span>
                  </>
                )}
                <div className="dht-acts">
                  <button type="button" className="dh-btn" data-kind="primary" data-action="save-row-edit"
                    disabled={!!rowEdit.busy || (rowEdit.kind === "date" && !rowEdit.date)} onClick={() => saveRowEdit(node)}>Save</button>
                  <button type="button" className="dh-btn" onClick={() => setRowEdit(null)}>Cancel</button>
                </div>
              </div>
            )}
            {rowEdit?.key === node.key && rowEdit.message && <span className="dh-fold__quiet" role="status">{rowEdit.message}</span>}
        </>)}
        {rowMsg && <span className="dh-fold__quiet" role="status" data-row-msg="">{rowMsg}</span>}
      </RowOpen>
    );
  };

  const seeLeftOut = async (run) => {
    setLeftOut(m => ({ ...m, [run.key]: { state: "loading" } }));
    try {
      const d = await loadLeftOut(run.id);
      setLeftOut(m => ({ ...m, [run.key]: d ? { state: "ready", data: d } : { state: "gone" } }));
    } catch (e) { setLeftOut(m => ({ ...m, [run.key]: { state: "error", error: e.message } })); }
  };
  const renderRunBranch = (run) => {
    const lo = leftOut[run.key];
    return (
      <Branch label={`Run, ${run.day} ${run.time}`}>
        <RunCard run={run} lines={leftOutLines(run.leftOut)} onClose={() => step({ type: "close" })}
          onChangeFilters={(e) => openSettings("jobs", e?.currentTarget)} onSeeLeftOut={() => seeLeftOut(run)}>
          {lo?.state === "loading" && <p className="dh-fold__quiet">Reading what was left out…</p>}
          {lo?.state === "gone" && <p className="dh-fold__quiet">The list is kept for 14 days; this one is gone.</p>}
          {lo?.state === "error" && <p className="dh-fold__quiet">{lo.error}</p>}
          {lo?.state === "ready" && (
            <div className="dht-deep" data-left-out-list="">
              {lo.data.jobs.map(j => (
                <div key={j.jobId} className="dht-r">
                  <a href={jobDetailHref(j.jobId)}>{[j.company, j.title].filter(Boolean).join(" · ") || "A posting"}</a>
                  <span className="dht-r__s">{j.reasonLabel || j.reason}</span>
                </div>
              ))}
            </div>
          )}
        </RunCard>
      </Branch>
    );
  };

  const fixConnection = (c) => {
    if (c.fix === "prerequisite") navigate(`/app/${PREREQUISITE_LABELS[c.ref]?.to || "profile"}`);
    else if (c.fix === "portal") openPortalReview(c.ref);
    else openSettings("accounts");
  };

  // U1 · the header: one sentence, the two modes, Pause, Settings.
  const mode = autoToggle(runBar);
  const sub = (runBar?.caps || []).find(c => c.id === "submission");
  const sentence = held ? "Paused. Nothing new is picked or sent until you resume."
    : ["On.", nextRunAt && `Next look at ${timeLabel(nextRunAt, timeZone)}.`,
       sub && `${sub.used} of ${settings?.dailyCap ?? sub.limit} sent today.`,
       fullAuto ? "Good matches are sent for you." : picksOn ? "You tap Apply on each pick." : "Nothing is submitted until you approve it."]
      .filter(Boolean).join(" ");
  // ⭐ D146 · the timeline's head: "Auto-apply · Ask me first · runs at 9 AM and 6 PM", the sentence, Pause.
  const runAt = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`; };
  const runTimes = (Array.isArray(settings?.runTimes) ? settings.runTimes : []).filter(t => /^\d\d:\d\d$/.test(t)).map(runAt);
  const runsWord = !runTimes.length ? "" : ` · runs at ${runTimes.length > 1 ? `${runTimes.slice(0, -1).join(", ")} and ${runTimes[runTimes.length - 1]}` : runTimes[0]}`;
  const timelineHead = (
    // ⭐ D149 (11-03) · the sketch's .tl head: "Auto-apply" (15 / 600) over "Ask me first · runs at 9 AM and 6 PM". The
    // running sentence is not on the sketch (shown only while paused). Pause — the safety stop — stays here as one
    // quiet word on the title's line (it is also Settings → Pausing, D148), not a boxed button.
    <div className="dht-head" data-held={held ? "true" : "false"}>
      <div className="dht-head__top">
        <h3 className="dht-head__t" data-timeline-title="">Auto-apply</h3>
        <button type="button" className="dht-link" data-stop-everything="" data-held={held ? "true" : "false"}
          disabled={holdBusy || !runBar} title={`${STOP_DOES} ${STOP_DOES_NOT}`} onClick={() => setStopEverything?.(!held)}>
          {held ? "Resume" : "Pause"}
        </button>
      </div>
      <p className="dht-head__sub">{fullAuto ? "Apply for me" : "Ask me first"}{runsWord}</p>
      {held && <p className="dht-head__say" data-house-sentence="">{sentence}</p>}
    </div>
  );
  const chooseAsk = async () => {
    if (fullAuto) await setApplyMode?.("semi");
    const s = await setPicksSwitch(true);
    if (s) setSettings(s);
  };

  // ⭐ D146: the side column's own controls, now under the timeline — Review all (Approve all inside it), the line, Tidy up.
  const timelineExtra = {
    review: (
      <div className="dht-acts" data-review-all-block="">
        {/* THE DELIBERATE "REVIEW ALL" (AB3 requirement 3) — its own control, not what every item's
            Open does. ⛔ Approve all lives INSIDE it, with its second confirm (the modal below). */}
        <button onClick={openEverything} type="button" className="dh-btn" data-kind="primary" data-review-all=""
          title="Every application needing review, in one list.">Review all {needsYouCount} →</button>
        {approvalBudgetLine && (
          <p data-approval-budget="" className="dh-fold__quiet" style={{ color: approvalCap.remaining === 0 ? C.DANGER : undefined }}>{approvalBudgetLine}</p>
        )}
      </div>
    ),
    running: (applyLine.waiting || []).length > 0 && (
      /* A59 · the line stays editable until a Draft starts: its tool, its place, whether it stays. */
      <WaitingLine line={applyLine} theme={theme} busyId={lineBusyId} message={lineMsg}
        canUseAPlus={draftTool === A_PLUS_TOOL}
        onTool={setLineTool} onMove={moveInLine} onRemove={removeFromLine} />
    ),
    tidy: (
      <>
        <div className="dht-acts" data-bulk-clear="">
          <button type="button" className="dh-bulk" disabled={binBusy}
            title="Every unsent item drafted more than 7 days ago — into the bin, restorable for 7 days"
            onClick={() => confirmOlder(7)}>Clear older than 7 days</button>
          <button type="button" className="dh-bulk" disabled={binBusy}
            title="Every unsent item drafted more than 30 days ago — into the bin, restorable for 7 days"
            onClick={() => confirmOlder(30)}>Older than 30</button>
        </div>
        {/* ⭐ D53 · CLEARED · 7 DAYS — the bin. Restore puts it back exactly as it was (one the clear had
            stopped comes back as a new Draft); Delete now purges it at once. */}
        {bin.items.length > 0 && (
          <details data-draft-bin="" className="dh-bin">
            <summary>Cleared · {bin.items.length} · {bin.binDays} days</summary>
            <p className="dh-bin__note">
              Cleared items stay here for {bin.binDays} days, then their prepared answers, handoff and
              screenshot are deleted. Clearing is not a Pass — it trains nothing.
            </p>
            <ul className="dh-bin__list">
              {bin.items.map(it => (
                <li key={it.id} data-bin-item={it.id}>
                  <span className="dh-bin__what">
                    <strong>{companyLabel(it.company)}</strong>{it.title ? ` — ${it.title}` : ""}
                    <span className="dh-bin__when">
                      {it.purgesInDays <= 0 ? "purges today" : `purges in ${it.purgesInDays} day${it.purgesInDays === 1 ? "" : "s"}`}
                      {it.stoppedByClear ? " · was stopped — Restore drafts it again" : ""}
                    </span>
                  </span>
                  <button type="button" className="dh-bulk" disabled={binBusy} onClick={() => restoreBinItem(it)}
                    title={it.stoppedByClear ? "Restore — it was stopped when cleared, so it is drafted again (uses one of your drafts)"
                                             : "Restore — back exactly where it was"}>Restore</button>
                  <button type="button" className="dh-bulk" disabled={binBusy}
                    onClick={() => { if (window.confirm(`Delete ${companyLabel(it.company)} for good? It cannot be restored.`)) purgeBinItem(it); }}
                    title="Delete now — its prepared answers and screenshot are deleted and it cannot be restored">Delete now</button>
                </li>
              ))}
            </ul>
          </details>
        )}
        {binMsg && <span role="status" data-bin-msg="" className="dh-fold__quiet">{binMsg}</span>}
      </>
    ),
  };

  return (
    <div className="dh-page">
      {/* ── ⭐ D146 · THE HEADER — the name and its line, the two modes, Settings, Import, Export, Send all ready ── */}
      <header className="dh-head" data-house-header="" data-held={held ? "true" : "false"}>
        <div className="dh-head__text">
          {/* ⭐ D149 (11-03): the sketch's .ph3 — the serif at 44 / 1 over its line in body grey (DraftHouse.css). */}
          <h1 style={{ ...TYPE.PAGE_TITLE, ...DH_TITLE }}>Home</h1>
          <p className="dh-head__say" data-house-line="">Every application, from draft to reply.</p>
        </div>
        {/* The sketch's .tools3: the mode (.seg2), three quiet buttons, and Send all ready in the accent. */}
        <div className="dh-head__ctl">
          <div className="dh-mode" role="group" aria-label="Mode">
            <button type="button" className="dh-mode__seg" data-mode="ask" aria-pressed={!fullAuto}
              disabled={holdBusy || !runBar} onClick={chooseAsk}>Ask me first</button>
            {/* ⛔ FULL AUTO is the operator's to unlock (autoToggle): locked, it has no handler. */}
            <button type="button" className="dh-mode__seg" data-mode="auto" aria-pressed={fullAuto}
              data-locked={mode.selectable ? "false" : "true"} disabled={!mode.selectable || holdBusy}
              aria-describedby={mode.selectable ? undefined : "dh-auto-why"}
              onClick={mode.selectable ? () => !fullAuto && setApplyMode?.("auto") : undefined}>Apply for me</button>
          </div>
          <button type="button" className="dh-quiet" data-settings-open="" onClick={(e) => openSettings(null, e.currentTarget)}>Settings</button>
          {/* The Table's Excel / CSV import and export, unchanged in function (lib/tableExport.js, ApplicationHistory's ImportPanel). */}
          <button type="button" className="dh-quiet" data-import-open="" aria-pressed={importing} onClick={() => setImporting(v => !v)}>Import</button>
          <button type="button" className="dh-quiet" data-export-open="" aria-pressed={exporting} onClick={() => setExporting(v => !v)}>Export</button>
          {/* Send all ready: every Ready-to-send row, ONE confirm that lists them by name (lib/trackerRows.js). */}
          <button type="button" className="dh-send" data-kind="primary" data-send-all-ready="" disabled={!ready.length || pendingBusy}
            title="Approves every application that is Ready to send. Approving submits it to the employer and cannot be undone."
            onClick={sendAllReady}>Send all ready ({ready.length})</button>
        </div>
        {!mode.selectable && <p className="dh-head__why" id="dh-auto-why" data-auto-locked-reason="">Apply for me is locked: {mode.reason}</p>}
        {holdMsg && <p className="dh-head__why" role="status">{holdMsg}</p>}
      </header>
      {/* ⭐ D148: the drawer opens with the mode (the header switch's own handlers and lock) and Pause everything now. */}
      <AutoSettingsDrawer open={settingsOpen} runBar={runBar} group={settingsGroup} listView={listView} onListView={setListView}
        mode={{ fullAuto, selectable: mode.selectable, reason: mode.reason }} onAsk={runBar ? chooseAsk : null}
        onAuto={mode.selectable ? () => setApplyMode?.("auto") : null} modeBusy={holdBusy} held={held} onPauseNow={setStopEverything}
        onClose={() => { setSettingsOpen(false); settingsOpener.current?.focus?.(); }} />
      {exporting && (
        <div className="dht-acts" data-export="" role="group" aria-label="Export">
          <button type="button" className="dh-btn" data-export-kind="excel" onClick={exportExcel}>Excel (.xlsx) — every application</button>
          <button type="button" className="dh-btn" data-export-kind="csv" disabled={!csvRows.length}
            title="Download the rows shown as a CSV" onClick={() => saveText(csvName(), historyToCsv(csvRows))}>CSV — the rows shown</button>
        </div>
      )}
      {importing && <ImportPanel onClose={() => setImporting(false)} onImported={() => { refreshTableRecords(); loadTableRows().then(setTableRows); }} />}

      {/* What it said BEFORE a run still matters: autofill unavailable is stated here. */}
      {applyReadiness && !applyReadiness.available && (
        <span className="dh-note">Autofill is unavailable right now ({applyReadiness.reason}) — drafts wait until it is back.</span>
      )}
      {applyMsg && <span className="dh-note" data-tone="accent">{applyMsg}</span>}
      {historyMsg && <span role="status" className="dh-note" data-tone="accent">{historyMsg}</span>}
      {pickMsg && <span role="status" className="dh-note" data-tone="accent">{pickMsg}</span>}
      {pendingMsg && !applyRunDetailOpen && <span role="status" className="dh-note" data-tone="accent">{pendingMsg}</span>}
      {/* THE QUEUE IS CAPPED, AND A CAPPED QUEUE MUST SAY SO: GET /api/apply/gate-packets returns the
          newest 100 unconsumed packets; past that every portal count is short. */}
      {applyGateTruncated && (
        <span className="dh-note">Showing the {applyHandoffPackets.length} most recent of <strong>{applyGateTotal ?? "many"}</strong> queued handoffs. Clear some of these to see the rest.</span>
      )}
      {/* The handoff happens in ANOTHER TAB, so the panel says what to expect there. */}
      {handoffMsg && (
        <div className="dh-handoff" data-kind={handoffMsg.kind}>
          <span>{handoffMsg.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setHandoffMsg(null)}>×</button>
        </div>
      )}

      {/* ── ⭐ D146 · a broken connection is one banner line with its fix (it was the side column's first block). ── */}
      {brokenConnections.map(c => (
        <div key={c.key} className="dh-banner" data-connection-banner={c.key} data-connection={c.key} role="status">
          <b>{c.title}</b>{c.sub && <span>{c.sub}</span>}
          <button type="button" className="dh-btn" onClick={() => fixConnection(c)}>{c.fixLabel || "Fix it"}</button>
        </div>
      ))}

      {/* ⭐ D149 (11-03): the counts and the filters span the page above the table and the timeline (the sketch's .cnt
          and .flt sit before its .layout), so the timeline's top meets the table's, and on a phone both stay above the
          switch whichever side is shown. The full sheet (Settings → View) replaces them. */}
      {listView !== "sheet" && (
        <>
          <TrackerCounts counts={counts} />
          <TrackerFilters filter={filter} onFilter={setFilter} period={period} onPeriod={setPeriod}
            findOpen={findOpen || !!q || period !== "any"} onFind={(on) => { setFindOpen(on); if (!on) { setQ(""); setPeriod("any"); } }}
            search={<PanelSearch theme={theme} value={q} onChange={setQ} width={200} placeholder="Search" />} />
        </>
      )}

      {/* ── ⭐ D146 · phones: a switch, Applications · Auto-apply timeline (layout 3). Hidden from 900 px (CSS). ── */}
      <div className="dh-mode dh-switch" role="group" aria-label="Show" data-phone-switch="">
        <button type="button" className="dh-mode__seg" data-phone-view="table" aria-pressed={phoneView === "table"} onClick={() => setPhoneView("table")}>Applications</button>
        <button type="button" className="dh-mode__seg" data-phone-view="timeline" aria-pressed={phoneView === "timeline"} onClick={() => setPhoneView("timeline")}>Auto-apply timeline</button>
      </div>

      {/* ── ⭐ D146 · THE TABLE, AND THE AUTO-APPLY TIMELINE BESIDE IT (layout 1). ── */}
      <div className="dh-main" data-draft-split="" data-phone-view={phoneView} data-detail={sideJob && sideDetail ? "true" : undefined}>
        <div className="dh-table-col">
          {listView === "sheet" ? (
            /* Settings → View → The full sheet: The Table's own views (D15 / D54 / D55), kept, not on the first screen. */
            <section data-full-sheet="" aria-label="The full sheet" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 480 }}>
              <div className="dht-acts"><button type="button" className="dh-btn" data-back-to-table="" onClick={() => { setListView("table"); setSheetAt(null); }}>Back to the table</button></div>
              <DatabasePanel key={sheetAt ? `${sheetAt.sheet}:${sheetAt.jobId}` : "sheet"} user={user} embedded
                sheet={sheetAt?.sheet || null} focusJobId={sheetAt?.jobId || null} />
            </section>
          ) : (
            <>
              <ApplicationTracker rows={shownRows} sort={sort} onSort={setSort}
                openKey={open?.type === "job" ? open.key : null}
                onOpen={(key) => step(key == null ? { type: "close" } : { type: "job", key })}
                renderOpen={renderRow}
                empty={
                  <p className="dht-empty">{rows.length ? "Nothing here with this filter."
                    : nothingYet ? "Nothing drafted yet. Draft jobs from the Daily Deck or Full House." : "Nothing to show yet."}</p>
                } />
            </>
          )}
        </div>
        {/* D102 P5 · an opened application's own page takes the timeline's column on a wide screen (the timeline returns
            on Close); narrower, "Full page" goes to its own page. */}
        {sideJob && sideDetail ? (
          <aside data-draft-detail="" aria-label="This application" className="dh-detail">
            <div className="dht-acts" style={{ justifyContent: "flex-end" }}>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => navigate(`/app/job/for/${encodeURIComponent(sideJob)}`)}>Its own page</button>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setSideJob(null)} aria-label="Close">✕ Close</button>
            </div>
            <JobWorkspacePanel jobId={sideJob} embedded />
          </aside>
        ) : (
          <DraftHouseTree view={view} open={open} onOpen={step} onBubble={(node) => openRow(node.key)} head={timelineHead}
            renderRunBranch={renderRunBranch}
            nextLine={fullAuto ? "Next look. Good matches are sent for you." : "Next look. You'll get one email with the picks."}
            empty={!view.some(v => !v.run.future) ? <p className="dht-empty">No runs yet. Each run's picks show here as they are made.</p> : null}
            footer={(needsYouCount > 0 || timelineExtra.running || bin.items.length > 0 || binMsg) ? (
              <div className="dht-foot" data-timeline-foot="">
                {needsYouCount > 0 && timelineExtra.review}
                {timelineExtra.running}
                {timelineExtra.tidy}
              </div>
            ) : <div className="dht-foot" data-timeline-foot="">{timelineExtra.tidy}</div>} />
        )}
      </div>

      {/* ── Apply Runs Review Modal ──────────────────────────────────── */}
      {applyRunDetailOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeReview() }}
          style={{
            // Named tier rather than the literal 700 it carried. Same class as JobsPanel's
            // resume-enhance modal: a focused takeover over the app, above the filters drawer.
            position:"fixed", inset:0, zIndex:Z.MODAL_SCRIM,
            background:C.SCRIM, display:"flex",
            alignItems:"flex-start", justifyContent:"center",
            paddingTop:48, overflowY:"auto",
          }}
        >
          <div style={{
            background:theme.modalSurface || theme.surface,
            borderRadius:8, width:"min(96vw, 820px)",
            maxHeight:"82vh", display:"flex", flexDirection:"column",
            border:`1px solid ${theme.border}`,
            boxShadow:C.SHADOW_SM,
          }}>
            {/* Header */}
            <div style={{
              padding:"16px 20px", borderBottom:`1px solid ${theme.border}`,
              display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, gap:12,
            }}>
              <div style={{ fontFamily:"var(--font-display)", fontWeight:400,
                             fontSize:23}}>
                {/* The popup SAYS what it is about. It used to be titled "Jobs Needing Review"
                    whichever row you opened it from, which is the honest name for a popup that was
                    always showing all of them. */}
                {applyRunDetail
                  ? `Apply Run #${applyRunDetail.run?.id} — ${applyRunDetail.run?.mode || "auto"}`
                  : scope ? scope.label
                  : "Every application needing review"}
              </div>
              {applyRunDetail?.run && (
                <div style={{ display:"flex", gap:10, fontSize:11, flexWrap:"wrap", alignItems:"center" }}>
                  {/* THE RUN'S OWN STATUS. It used to live on the dot of the run-history chip that
                      AC4's dated view replaced — and the chip was the only place a run said whether
                      it had finished, so removing the list would have quietly dropped that. It
                      belongs here anyway: this is the run's detail, and "is this run still going"
                      is the first thing to know when reading one. */}
                  <span style={markStyle(applyRunDetail.run.status === "completed" ? C.SUCCESS
                                   : applyRunDetail.run.status === "running" ? theme.accent
                                   : applyRunDetail.run.status === "queued" ? C.WARNING : theme.textMuted)}>
                    {applyRunDetail.run.status || "—"}
                  </span>
                  {applyRunDetail.run.submittedCount > 0 && (
                    <span style={{ color:C.SUCCESS, fontWeight:700 }}>✓ {applyRunDetail.run.submittedCount} submitted</span>
                  )}
                  {applyRunDetail.run.heldCount > 0 && (
                    <span style={{ color:C.WARNING, fontWeight:700 }}>⏸ {applyRunDetail.run.heldCount} held</span>
                  )}
                  {applyRunDetail.run.failedCount > 0 && (
                    <span style={{ color:C.DANGER, fontWeight:700 }}>✗ {applyRunDetail.run.failedCount} failed</span>
                  )}
                  {applyRunDetail.run.startedAt && (
                    <span style={{ color:theme.textDim }}>
                      {new Date(applyRunDetail.run.startedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={() => closeReview()}
                style={{ background:"transparent", border:"none", cursor:"pointer",
                          color:theme.textMuted, fontSize:20, lineHeight:1, padding:"0 4px",
                          marginLeft:"auto", flexShrink:0 }}>
                ×
              </button>
            </div>

            {/* Job list */}
            <div style={{ overflowY:"auto", flex:1, padding:"12px 20px", display:"flex", flexDirection:"column", gap:8 }}>

              {/* ── Queue-then-approve ──────────────────────────────────────────
                  These applications are already filled and have passed every gate. Approving one
                  submits it to a real employer and it cannot be recalled, so this surface is built
                  around reading before deciding: the row says how many answers were GUESSED, and
                  the detail view shows every answer with the rule that produced it, plus the exact
                  resume that will be attached. */}
              {!applyRunDetail && scopedPending.length > 0 && (
                <div style={{ border:`1px solid ${C.INFO}`, borderRadius:6, padding:"12px 14px",
                              background:theme.surfaceHigh, display:"flex", flexDirection:"column", gap:10 }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:13, color:theme.text }}>
                      {scopedPending.length} application{scopedPending.length === 1 ? "" : "s"} waiting on you
                    </div>
                    <div style={{ fontSize:11, color:theme.textMuted, marginTop:2 }}>
                      Filled and checked, but nothing has been sent. Read one before you approve it —
                      approving submits it to the employer and cannot be undone.
                    </div>
                  </div>

                  {scopedPending.map(p => {
                    const open = pendingDetail?.runJobId === p.runJobId;
                    const btn  = (bg, fg, bd) => ({
                      border:`1px solid ${bd}`, borderRadius:6, padding:"5px 10px", background:bg,
                      color:fg, fontWeight:800, fontSize:11.5,
                      cursor: pendingBusy ? "wait" : "pointer", opacity: pendingBusy ? 0.6 : 1,
                    });
                    return (
                      <div key={p.runJobId} style={{ borderTop:`1px solid ${theme.border}`, paddingTop:10,
                                                     display:"flex", flexDirection:"column", gap:6 }}>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:12, fontWeight:700, color:theme.text, flex:1, minWidth:200 }}>
                            {companyLabel(p.company)}
                            {p.title ? <span style={{ color:theme.textMuted, fontWeight:600 }}> — {p.title}</span> : null}
                          </span>
                          {/* A guess is the thing worth a human's attention; an exact mapping is not. */}
                          {p.guessCount > 0 && (
                            <span title="Answers matched by a fuzzy label match rather than an exact mapping. Read these."
                              style={{ ...markStyle(C.WARNING), flexShrink:0 }}>
                              {p.guessCount} guessed
                            </span>
                          )}
                          {/* ── AL2: WHICH BAND THIS IS, AND WHAT IT IS OF ────────────────────
                              With generation deferred to approval there is no tailored resume yet,
                              so `resume.atsScore` is null on every waiting row. Reading the band
                              off it alone would print "No signal" on 100% of them — the exact
                              shape AJ2 found when Job.matchScore was always null and a correct
                              client rendered "Not enough signal" for every job on the board.
                              So: the BASE resume's band, labelled as the base, which is what the
                              user is actually deciding on. It is an honest floor — tailoring at
                              approval can only raise it. */}
                          <span style={{ fontSize:10, color:theme.textDim, whiteSpace:"nowrap" }}>
                            {p.answerCount} answer{p.answerCount === 1 ? "" : "s"}
                            {p.generationDeferred
                              ? ` · ${atsBandLabel(p.baseAts?.band ?? null).short} (base resume)`
                              : ` · ${atsBandLabel(atsBandFor(p.resume.atsScore ?? null)).short}`}
                          </span>
                        </div>

                        {/* AL2 — WHY THERE IS NO RESUME BUTTON ON THIS ROW, and what it will cost.
                            "Not generated yet" and "generation failed" are indistinguishable from a
                            missing button alone, and they need opposite responses from the user.
                            The terms are shown because a band nobody can check is a number to be
                            trusted rather than read. */}
                        {p.generationDeferred && (
                          <div style={{ fontSize:10.5, color:theme.textMuted, lineHeight:1.5 }}>
                            No resume has been written for this application yet — approving is what
                            generates the tailored one. The band above is your base resume against
                            this posting, so tailoring can only improve it.
                            {p.baseAts?.missingCount > 0 && (
                              <span> Not yet covered: {p.baseAts.missing.slice(0, 6).join(", ")}
                                {p.baseAts.missingCount > 6 ? ` +${p.baseAts.missingCount - 6} more` : ""}.</span>
                            )}
                          </div>
                        )}

                        {/* D90 P3: what we changed in the résumé, read before Approve & send. */}
                        {!p.generationDeferred && <ChangesSummaryLine jobId={p.jobId} jobLabel={companyLabel(p.company)} />}

                        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                          <button onClick={() => openPendingDetail(p.runJobId)}
                            style={btn(theme.surface, theme.text, theme.border)}>
                            {open ? "Hide" : "Review"} answers
                          </button>
                          {p.resume.available && (
                            <AttemptResume runJobId={p.runJobId} artifactUrl={artifactUrl}
                              style={btn(theme.surface, theme.text, theme.border)} />
                          )}
                          {/* ── KEPT HERE ON PURPOSE (AE4) ──────────────────────────────────
                              AE4 removed this from held and review rows, where it duplicated facts
                              the row already stated. This is neither: it is the APPROVAL queue, and
                              the button beside it sends a real application to a real employer. The
                              screenshot is the only view of the actual form before that happens, so
                              here it is a decision input rather than a second telling of the row —
                              removing it would leave "Approve & send" as the only unreviewable
                              control in the product. Evidence, not a route: the server submits, and
                              nothing is ever submitted from the picture. */}
                          {p.screenshotAvailable && (
                            <a href={artifactUrl(p.runJobId, "screenshot")} target="_blank" rel="noreferrer"
                              title="A picture of the form as we filled it. Read it before you approve."
                              style={{ ...btn(theme.surface, theme.textMuted, theme.border), textDecoration:"none" }}>
                              What we filled ↗
                            </a>
                          )}
                          <span style={{ flex:1 }}/>
                          <button onClick={() => decidePending([p.runJobId], false)} disabled={pendingBusy}
                            style={btn(theme.surface, C.DANGER, `${C.DANGER}55`)}>
                            Reject
                          </button>
                          <button onClick={() => decidePending([p.runJobId], true)} disabled={pendingBusy}
                            style={btn(C.INFO, C.SURFACE_SOLID, C.INFO)}>
                            Approve &amp; send
                          </button>
                        </div>

                        {open && (
                          <div style={{ border:`1px solid ${theme.border}`, borderRadius:6, padding:"8px 10px",
                                        background:theme.surface, display:"flex", flexDirection:"column", gap:4 }}>
                            {pendingDetail.loading ? (
                              <span style={{ fontSize:11, color:theme.textMuted }}>Loading…</span>
                            ) : (
                              <>
                                <div style={{ fontSize:10, color:theme.textMuted }}>
                                  This is exactly what will be sent. Anything marked GUESS was matched by label,
                                  not by an exact mapping.
                                </div>
                                {(pendingDetail.answers || [])
                                  .filter(a => !a.skipped && !a.policy_rejected)
                                  .map((a, i) => {
                                    const guess = a.provenance === "label_fuzzy";
                                    return (
                                      <div key={i} style={{ display:"flex", gap:8, alignItems:"baseline",
                                                            flexWrap:"wrap", fontSize:11,
                                                            borderTop: i ? `1px solid ${theme.border}` : "none",
                                                            paddingTop: i ? 4 : 0 }}>
                                        <span style={{ color:theme.textMuted, minWidth:150, flex:"0 1 auto" }}>
                                          {a.label || a.name || a.field_id}
                                        </span>
                                        <span style={{ color:theme.text, fontWeight:700, flex:1, minWidth:120,
                                                       wordBreak:"break-word" }}>
                                          {String(a.value ?? "")}
                                        </span>
                                        <span style={markStyle(guess ? C.WARNING : theme.textDim)}>
                                          {guess ? "GUESS" : (a.provenance || "").replace(/_/g, " ") || "—"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                {(pendingDetail.answers || []).filter(a => !a.skipped && !a.policy_rejected).length === 0 && (
                                  <span style={{ fontSize:11, color:theme.textMuted }}>No answers recorded.</span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", paddingTop:4 }}>
                    {/* Bulk approval is the one place a stray click could send several real
                        applications at once, so it takes two deliberate steps. */}
                    {scopedPending.length > 1 && (
                      confirmApproveAll ? (
                        <>
                          <span style={{ fontSize:11, color:C.DANGER, fontWeight:700 }}>
                            Send all {scopedPending.length} to their employers?
                          </span>
                          <button onClick={() => decidePending(scopedPending.map(p => p.runJobId), true)}
                            disabled={pendingBusy}
                            style={{ border:"none", borderRadius:6, padding:"6px 12px", background:C.DANGER,
                                     color:C.SURFACE_SOLID, fontWeight:800, fontSize:12,
                                     cursor: pendingBusy ? "wait" : "pointer" }}>
                            Yes, send all
                          </button>
                          <button onClick={() => setConfirmApproveAll(false)} disabled={pendingBusy}
                            style={{ border:`1px solid ${theme.border}`, borderRadius:6, padding:"6px 12px",
                                     background:theme.surface, color:theme.text, fontWeight:700, fontSize:12,
                                     cursor:"pointer" }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmApproveAll(true)} disabled={pendingBusy}
                          style={{ border:`1px solid ${theme.border}`, borderRadius:6, padding:"6px 12px",
                                   background:theme.surface, color:theme.text, fontWeight:700, fontSize:12,
                                   cursor: pendingBusy ? "wait" : "pointer" }}>
                          Approve all {scopedPending.length}
                        </button>
                      )
                    )}
                    {pendingMsg && (
                      <span style={{ fontSize:11, color:theme.accentText }}>{pendingMsg}</span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Validation-correction loop ──────────────────────────────────
                  A hold used to end the run. These are the fields the resolver refused to fill on
                  its own; answering them is what turns the hold into a completed application. The
                  answers are stored as custom_answers, which is the only exact-by-construction
                  resolution path — so on retry they are used verbatim, never inferred. */}
              {!applyRunDetail && scopedQuestions.length > 0 && (
                <div style={{ border:`1px solid ${theme.accent}`, borderRadius:6, padding:"12px 14px",
                              background:theme.surfaceHigh, display:"flex", flexDirection:"column", gap:10 }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:13, color:theme.text }}>
                      Answer {scopedQuestions.length} question{scopedQuestions.length === 1 ? "" : "s"}
                      {applyQuestionMeta.blockedJobs > 0 &&
                        ` to unblock ${applyQuestionMeta.blockedJobs} application${applyQuestionMeta.blockedJobs === 1 ? "" : "s"}`}
                    </div>
                    <div style={{ fontSize:11, color:theme.textMuted, marginTop:2 }}>
                      Nothing here was guessed on your behalf — these are the fields we would not fill without you.
                      {applyQuestionMeta.eligibilityCount > 0 &&
                        ` ${applyQuestionMeta.eligibilityCount} of them are attestations to the employer.`}
                    </div>
                  </div>

                  {scopedQuestions.map(q => {
                    const isEligibility = !!q.eligibility;
                    const isConfirm     = q.reason === "low_confidence";
                    const value         = questionDrafts[q.question] ?? "";
                    const setValue      = v => setQuestionDrafts(prev => ({ ...prev, [q.question]: v }));
                    const inputStyle    = { width:"100%", padding:"6px 8px", fontSize:12, borderRadius:4,
                                            border:`1px solid ${theme.border}`, background:theme.surface,
                                            color:theme.text, boxSizing:"border-box" };
                    return (
                      <div key={q.question} style={{ borderTop:`1px solid ${theme.border}`, paddingTop:10,
                                                     display:"flex", flexDirection:"column", gap:5 }}>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:12, fontWeight:700, color:theme.text, flex:1, minWidth:220 }}>
                            {q.question}
                          </span>
                          {isEligibility && (
                            <span title="Submitted to the employer as your own statement. Never inferred from your profile."
                              style={{ ...markStyle(C.DANGER), flexShrink:0 }}>
                              Attestation
                            </span>
                          )}
                          {q.answered && (
                            <span style={{ ...markStyle(C.SUCCESS), flexShrink:0 }}>
                              Saved
                            </span>
                          )}
                        </div>

                        {isEligibility && (
                          <div style={{ fontSize:10, color:C.DANGER }}>
                            You are stating this to the employer yourself. We never answer it from your profile.
                          </div>
                        )}
                        {isConfirm && (
                          <div style={{ fontSize:10, color:theme.textMuted }}>
                            We had a guess{q.proposed ? ` — "${q.proposed}"` : ""} but were not confident enough to send it.
                            Confirm or correct it.
                          </div>
                        )}

                        {Array.isArray(q.options) && q.options.length > 0 ? (
                          <select value={value} onChange={e => setValue(e.target.value)} style={inputStyle}>
                            <option value="">Select…</option>
                            {q.options.map(o => (
                              <option key={o.value} value={o.value}>{o.label || o.value}</option>
                            ))}
                          </select>
                        ) : q.type === "checkbox" || q.type === "toggle" ? (
                          <select value={value} onChange={e => setValue(e.target.value)} style={inputStyle}>
                            <option value="">Select…</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : q.type === "text_area" ? (
                          <textarea rows={2} value={value} onChange={e => setValue(e.target.value)} style={inputStyle}/>
                        ) : (
                          <input value={value} onChange={e => setValue(e.target.value)} style={inputStyle}/>
                        )}

                        {/* D55 (f): "Save this answer for next time?" — ticked keeps it for every
                            employer (the company's name becomes {company}); unticked keeps it for
                            the blocked employer only, so this retry still fills. */}
                        <label data-save-for-next-time="" style={{ display:"flex", alignItems:"center", gap:6,
                                        fontSize:11, color:theme.textMuted, cursor:"pointer" }}>
                          <input type="checkbox"
                            checked={questionRemember[q.question] !== false}
                            onChange={e => setQuestionRemember?.(prev => ({ ...prev, [q.question]: e.target.checked }))}/>
                          {saveForNextTimeLabel(q)}
                          {questionRemember[q.question] === false && (q.blocking || []).length > 0 && (
                            <span style={{ color:theme.textDim }}>
                              — only for {[...new Set(q.blocking.map(b => b.company).filter(Boolean))].join(", ") || "this employer"}
                            </span>
                          )}
                        </label>

                        {(q.blocking || []).length > 0 && (
                          <div style={{ fontSize:10, color:theme.textDim }}>
                            Blocks:{q.blocking.slice(0, 3).map(b => b.company || b.title || b.jobId).join(", ")}
                            {q.blocking.length > 3 ? ` +${q.blocking.length - 3} more` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", paddingTop:4 }}>
                    <button onClick={() => submitApplyAnswers(true)} disabled={answersSaving}
                      style={{ border:"none", borderRadius:6, padding:"6px 12px", background:theme.accent,
                               color:C.ON_ACCENT, fontWeight:800, fontSize:12,
                               cursor: answersSaving ? "wait" : "pointer", opacity: answersSaving ? 0.6 : 1 }}>
                      {answersSaving ? "Saving…" : "Save & retry"}
                    </button>
                    <button onClick={() => submitApplyAnswers(false)} disabled={answersSaving}
                      style={{ border:`1px solid ${theme.border}`, borderRadius:6, padding:"6px 12px",
                               background:theme.surface, color:theme.text, fontWeight:700, fontSize:12,
                               cursor: answersSaving ? "wait" : "pointer", opacity: answersSaving ? 0.6 : 1 }}>
                      Save only
                    </button>
                    {answersMsg && (
                      <span style={{ fontSize:11, color:theme.accentText }}>{answersMsg}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Sign in once, and everything queued behind that gate is ready. The count is the
                  offer: a ten-second sign-in that releases seven applications is a different
                  product from seven separate reviews. Only shown on the cross-run view, because a
                  single run's detail is about that run. */}
              {/* A portal batch is BY DEFINITION about several applications, so it has no place in a
                  popup scoped to one. Shown only on the review-everything view. */}
              {!applyRunDetail && !scope && applyGatePortals.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                  {applyGatePortals.map(p => (
                    <div key={p.origin} style={{
                      border:`1px solid ${theme.border}`, borderRadius:8, padding:"10px 14px",
                      background:theme.surfaceHigh, display:"flex", alignItems:"center", gap:10 }}>
                      <span style={markStyle(C.INFO)}>
                        {p.gateReasons?.includes("captcha_required") ? "verify" : "sign in"}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:700, color:theme.text,
                                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          Sign in to {p.host} once
                        </div>
                        <div style={{ fontSize:11, color:theme.textMuted }}>
                          {p.count} application{p.count === 1 ? "" : "s"} ready · reviewed one at a time
                        </div>
                      </div>
                      <span style={{ fontSize:18, fontWeight:800, color:theme.text }}>{p.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* The guard reads the SCOPED feeds, not the whole ones: a popup scoped to one
                  application whose questions and approvals belong to other jobs would otherwise
                  render nothing at all and say nothing about it. */}
              {modalApplications.length === 0 &&
               (applyRunDetail || (scopedQuestions.length === 0 && scopedPending.length === 0)) && (
                <div style={{ padding:"24px 0", textAlign:"center", color:theme.textMuted, fontSize:12 }}>
                  {applyRunDetail ? "No jobs in this run yet."
                    : scope ? `Nothing left to resolve on ${scope.label}.`
                    : "Nothing is waiting on you."}
                </div>
              )}

              {/* ── AC2: COMPANY → APPLICATION → PROBLEMS ────────────────────────────────────
                  The modal was a FLAT LIST OF PROBLEM-CARDS built from run-job rows. Two problems
                  on one job rendered as two entries; a dead posting for an unrelated job sat
                  between them wearing a "Review" pill and leading nowhere; and nothing on screen
                  said which application was which.

                  Requirement 1 says the modal must match the card summary, which already gets this
                  right — so the modal does not re-describe it. It renders the SAME
                  ApplicationObstacleCard the panel does, under the SAME CompanyHeading, grouped by
                  the SAME groupByApplication / groupByCompany. There is one renderer, so the two
                  surfaces cannot disagree about how many applications there are.

                  The per-ATTEMPT rows the modal used to show at the top level are not lost: they
                  are passed as children and sit behind each application's own disclosure. */}
              {modalCompanies.map(({ company, items }) => (
                <div key={`modal-${company}`} style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <CompanyHeading company={company} count={items.length} theme={theme} />
                  {items.map(app => {
                    const packet = handoffPacketFor?.(app.primary?.row) || handoffPacketFor?.(app);
                    const resumable = !!packet && !packet.postingGone && !packet.stale && !app.postingGone;
                    const attemptsOpen = !!openAttempts[app.key];
                    return (
                      <ApplicationObstacleCard
                        key={app.key}
                        app={app}
                        theme={theme}
                        artifactUrl={artifactUrl}
                        packet={packet}
                        onRerun={rerunJob}
                        // Same wiring as the panel's cards, and for the same reason (AC1): the
                        // scoped handler, never the unscoped one. Inside a popup already scoped to
                        // this application it re-scopes to itself, which is a no-op — but a no-op
                        // is the correct behaviour, and reaching for `openEverything` here would
                        // reintroduce exactly the defect AC1 removed, one surface along.
                        onResolve={resumable ? () => openHandoff(packet, app) : openApplicationReview}
                        resolveLabel={resumable ? "Open & fill" : "Open"}
                        resolveTitle={resumable
                          ? `Opens the application in your own browser and fills it with the ${packet.answerCount} answer${packet.answerCount === 1 ? "" : "s"} we already resolved. You review and submit.`
                          : "Open this application's review — only this one"}
                        // AC2 requirement 2. The co-resolvable problems, lifted out and counted.
                        plan={planFor(app)}
                        onGroupAction={(item) => resolveGroup(item, app)}
                        // In the panel this opens the popup. Inside the popup there is nothing
                        // further to open, so it toggles the attempts — and says which it is.
                        detailsLabel={`${attemptsOpen ? "Hide" : "Show"} ${app.rows.length} attempt${app.rows.length === 1 ? "" : "s"}`}
                        onDetails={() => setOpenAttempts(o => ({ ...o, [app.key]: !o[app.key] }))}
                        onGenerateResume={app.primary?.row?.resumeAvailable ? null : generateResume}
                      >
                        {attemptsOpen && (
                          <div style={{ display:"flex", flexDirection:"column", gap:6,
                                        borderTop:`1px solid ${theme.border}`, paddingTop:8 }}>
                            <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.08em",
                                          textTransform:"uppercase", color:theme.textDim }}>
                              Every attempt at this application
                            </div>
                            {app.rows.map(row => (
                              <AttemptRow key={row.id} job={row} theme={theme}
                                artifactUrl={artifactUrl} packetFor={handoffPacketFor}
                                onHandoff={openHandoff} onRerun={rerunJob} />
                            ))}
                          </div>
                        )}
                      </ApplicationObstacleCard>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Logs section — run detail only */}
            {applyRunDetail?.logs?.length > 0 && (
              <details style={{ flexShrink:0, borderTop:`1px solid ${theme.border}` }}>
                <summary style={{
                  padding:"10px 20px", fontSize:11, fontWeight:700, cursor:"pointer",
                  color:theme.textMuted, textTransform:"uppercase", letterSpacing:"0.06em",
                  userSelect:"none", listStyle:"none",
                }}>
                  ▸ Logs ({applyRunDetail.logs.length})
                </summary>
                <div style={{
                  maxHeight:200, overflowY:"auto", padding:"8px 20px 12px",
                  fontFamily:"monospace", fontSize:10, display:"flex", flexDirection:"column", gap:3,
                }}>
                  {applyRunDetail.logs.map(log => (
                    <div key={log.id} style={{
                      color: log.level === "error" ? C.DANGER : log.level === "warn" ? C.WARNING : theme.textMuted,
                    }}>
                      <span style={{ color:theme.textDim, marginRight:6 }}>
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ""}
                      </span>
                      <span style={{
                        color: log.level === "error" ? C.DANGER : log.level === "warn" ? C.WARNING : theme.accent,
                        marginRight:6, fontWeight:700,
                      }}>
                        [{log.event || log.level}]
                      </span>
                      {/* Which application this line is about. Without it a run's log is a list of
                          statements like "7 fields filled" with no way to tell which job or site
                          produced them. */}
                      {(log.company || log.title || log.jobId) && (
                        <span style={{ color:theme.text, marginRight:6 }}>
                          {log.company || log.title || log.jobId}
                          {log.company && log.title ? ` — ${log.title}` : ""}
                          {":"}
                        </span>
                      )}
                      {log.message}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Footer */}
            <div style={{
              padding:"12px 20px", borderTop:`1px solid ${theme.border}`, flexShrink:0,
              display:"flex", justifyContent:"flex-end",
            }}>
              <button className="dbx-depth"
                onClick={() => closeReview()}
                style={{
                  padding:"8px 20px", fontWeight:700, fontSize:12,
                  background:"transparent", color:theme.textMuted,
                  border:`1px solid ${theme.border}`, cursor:"pointer",
                  fontFamily:"inherit",
                }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AutoApplyPanel;

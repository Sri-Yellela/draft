// TASK AD1 — THE AUTO APPLY PANEL ADOPTS THE DATABASE PANEL'S LAYOUT.
//
// The panel was a STACK: a queue, an in-flight section, a needs-review section, a submitted section,
// a problems section, and then — underneath all of it — a separate dated run-history surface showing
// the same records a second time in a smaller rendering. Six things down one page, two of which were
// the same rows.
//
// It is now the shape the Database panel has always been: a sub-tab row with per-tab counts, a
// control row with a search box and a "Filter by date" calendar, and a body. The three sub-tabs are
// AC4's outcome partition — COMPLETED / PENDING / ABORTED — so the run history is not "removed", it
// IS the panel now.
//
// What these tests hold:
//   1. the chrome is REUSED, not cloned, and the Database panel renders the same components
//   2. the removed run-history surface lost nothing — every consumer still has what it needs
//   3. nothing is fetched until a date is picked, and a tab switch fetches ONE tab
//   4. the counts are date-scoped and SAY so
//   5. PENDING is where you land
//   6. everything AC1–AC4 delivered is still on the page
//   8. the AUTO APPLY tab badge still counts what needs attention, without a preload
//
// (Requirement 7 — the three empty states — is pinned in applyRunHistory.test.js beside the two
// states it grew out of, and the totality of the status mapping is pinned there too.)
//
// ⛔ D25 (10-04) RETIRED MOST OF AD1 ON PURPOSE. Draft House is now the workspace model: a run bar,
// what STOPPED, and what is QUEUED — no outcome sub-tabs (COMPLETED was a Sent column, and Sent is
// The Table's, D15), no calendar, no company tiles. The tests below that described AD1's tabs,
// date-scoped counts, landing tab and browser harness were deleted with the thing they described;
// the ones that still hold a rule were RE-PINNED to the D25 shape and say so. What did NOT change,
// and is still asserted: PanelControls is one implementation the Database panel renders (and Draft
// House reuses rather than forks), the chrome owns no panel state, nothing loads a listing nobody
// asked for, and the tab badge needs no preload. The workspace's own rules are in
// test/d25DraftHouseWorkspace.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { OUTCOME, OUTCOME_STATUSES, OUTCOME_LABELS } from "../shared/applyOutcomeGroups.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8");
const panel    = read("client/src/panels/AutoApplyPanel.jsx");
const sections = read("client/src/panels/AutoApplyPanelSections.jsx");
const ctx      = read("client/src/contexts/AutoApplyContext.jsx");
const dbPanel  = read("client/src/panels/DatabasePanel.jsx");
const controls = read("client/src/components/ui/PanelControls.jsx");
const applyRoute = read("routes/apply.js");

// ── Requirement: REUSE, DO NOT CLONE ─────────────────────────────────────────────────────────

test("PanelControls is ONE implementation: the Database panel renders it, Draft House reuses it (AD1 -> D25)", () => {
  // AD1's rule — "a second copy of this layout is how two surfaces drift apart" — survives D25,
  // which removed AD1's tabs and calendar from Draft House. What remains of the chrome there is the
  // search box, and it is the SHARED one, imported, never redrawn.
  for (const name of ["PanelSubTabs", "PanelSearch", "DateFilterButton"]) {
    assert.ok(new RegExp(`export function ${name}\\(`).test(controls),
      `${name} was not extracted`);
    assert.ok(new RegExp(`<${name}`).test(dbPanel), `DatabasePanel does not render ${name}`);
    assert.ok(!new RegExp(`function ${name}\\b`).test(panel), `Draft House forked its own ${name}`);
  }
  assert.match(panel, /import \{ PanelSearch \} from "\.\.\/components\/ui\/PanelControls\.jsx";/);
  assert.match(panel, /<PanelSearch /);
  // And neither panel writes the markup any more. These are the exact strings the two copies would
  // reintroduce: the underline, the magnifier, the pill's label.
  for (const [name, src] of [["DatabasePanel", dbPanel], ["AutoApplyPanel", panel]]) {
    assert.ok(!/layoutId="db-tab-underline"[\s\S]{0,200}?<motion\.div/.test(src),
      `${name} is drawing its own tab underline again`);
    assert.ok(!/pointerEvents:"none", color:theme\.textDim \}\}>🔍/.test(src),
      `${name} is drawing its own search box again`);
  }
  assert.match(controls, /pointerEvents: "none", color: theme\.textDim \}\}>🔍/);
  assert.match(controls, /📅 \{value \? `Date: \$\{format\(value\)\}` : label\}/);
});

test("AD1: the shared chrome owns no panel state — the two panels fetch entirely differently", () => {
  // The Database panel loads everything on mount; the Auto Apply panel loads nothing until a date is
  // picked. A shared component that owned "which tab" or "which date" would have to pick one of
  // those rules for both, and the wrong one violates requirement 3 outright. So the only state in
  // here is whether the popover happens to be open, which is nobody else's business.
  const stateful = [...controls.matchAll(/useState\(/g)];
  assert.equal(stateful.length, 2, "PanelControls grew state that belongs to a panel");
  assert.match(controls, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(controls, /const \[rect, setRect\] = useState\(null\)/);
  // Active tab, search text and selected date all arrive as props.
  for (const prop of ["active", "onSelect", "value", "onChange"]) {
    assert.ok(new RegExp(`\\b${prop}[,}]`).test(controls), `${prop} is not a prop of the chrome`);
  }
});

test("AD1: the Database panel's own behaviour is unchanged by the extraction", () => {
  // Its four sheets, their counts, the rule that changing sheet clears the search and the date
  // filter, and the two toolbar buttons that ride along on the tab row. The behaviour is the
  // panel's; only the markup moved.
  // D15 put The Table's history first and renamed the editable sheet "Spreadsheet" (ids unchanged).
  assert.match(dbPanel, /const SHEETS = \[\["history","History"\],\["applications","Spreadsheet"\],\["resumes","Resumes"\],\["saved","Saved Jobs"\],\["pending","Pending Apply"\]\]/);
  assert.match(dbPanel, /onSelect=\{\(id\) => \{ setActiveSheet\(id\); setSearch\(""\); setFilterDate\(""\); \}\}/);
  assert.match(dbPanel, /count: id === "applications" \? apps\.length/);
  assert.match(dbPanel, /Export Excel/);
  assert.match(dbPanel, /\{loading \? "⏳" : "↻"\} Refresh/);
  // The date filter is still only offered on the Applications sheet, and it still clears.
  assert.match(dbPanel, /\{isApps && \(\s*\n\s*<DateFilterButton/);
  assert.match(dbPanel, /onClear=\{\(\) => setFilterDate\(""\)\}/);
  // No markers: the one thing AC4 added to the calendar is opt-in and this panel did not opt in.
  assert.ok(!/markers=/.test(dbPanel));
});

// ── Requirement 2: the run-history surface is gone, and nothing went with it ─────────────────

test("AD1 requirement 2: the separate run-history surface is removed — and D25 says where the tiles went", () => {
  assert.ok(!/export function HistoryGroup/.test(sections), "HistoryGroup survived");
  assert.ok(!/export function HistoryRow/.test(sections), "HistoryRow survived");
  assert.ok(!/<HistoryGroup|<HistoryRow/.test(panel), "the panel still renders the history components");
  assert.ok(!/SectionHeading[^>]*>\s*Run history\s*</.test(panel),
    "the Run history section heading is back");
  // The enumeration of where each piece went is the deliverable, not decoration: a removal that
  // does not say what it moved is indistinguishable from a removal that dropped something. D25
  // removed the company tiles AD1's listing rendered, and accounts for them the same way.
  assert.match(sections, /THE COMPANY TILES ARE GONE/);
  for (const moved of ["Abort", "Remove", "obstacle sentences", "Details", "BROKE"]) {
    assert.ok(sections.includes(moved), `the enumeration does not account for "${moved}"`);
  }
  assert.ok(!/export function (CompanyTile|CompanyApplicationRow|ObstacleCard|PrerequisiteCards)\b/.test(sections),
    "a component D25 retired is still exported with nothing rendering it");
});

test("AD1 requirement 2: every consumer of the removed surface still has what it needs", () => {
  // runInFlight (the polling) and nothingYet read the CROSS-RUN feeds, never the dated history.
  const inFlight = ctx.match(/const runInFlight = [^\n]+/)[0];
  assert.match(inFlight, /applyRuns\.some\(r => r\.status === "queued" \|\| r\.status === "running"\)/);
  assert.ok(!/history/i.test(inFlight), "runInFlight now depends on the dated history");
  const nothingYet = panel.slice(at(panel, "const nothingYet ="),
                                 at(panel, "// ── AB2: ONE ITEM PER APPLICATION"));
  assert.ok(!/history/i.test(nothingYet), "nothingYet now depends on the dated history");
  for (const feed of ["applyMsg", "applyRuns", "applyReviewJobs", "applyPending", "applyQuestions",
                      "applyInFlight", "applySubmitted", "applyStopped", "applyPrereqMissing"]) {
    assert.ok(nothingYet.includes(feed), `nothingYet lost its ${feed} term`);
  }
  // PER-RUN DETAIL: on every in-flight row, and on every BROKE item's rail and fold; the run's own
  // status still renders in the modal header that opens.
  assert.match(panel, /onOpenRun=\{loadApplyRunDetail\}/);
  assert.match(panel, /loadApplyRunDetail\(row\.runId\)/);
  assert.match(panel, /applyRunDetail\.run\.status === "completed"/);
});

// ── Requirement 3: on demand, and one tab per fetch ──────────────────────────────────────────

test("AD1 requirement 3 -> D25: no effect anywhere loads the listing, and nothing asks for a day", () => {
  // AD1: nothing is fetched for a day nobody named. AH6 then added ONE mount effect that asked
  // /api/apply/history/latest and opened that day; D25 removed it with the calendar it fed — a day
  // nobody renders is two requests per sign-in for nothing.
  for (const effectBody of ctx.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)) {
    assert.ok(!/loadHistory\b|selectHistoryGroup\b/.test(effectBody[1]),
      "an effect loads the dated history again");
  }
  assert.doesNotMatch(ctx, /api\(`\/api\/apply\/history\/latest/, "the latest-day bootstrap request is back");
  assert.doesNotMatch(panel, /loadHistory\(|historyDate/, "Draft House reads the dated listing again");
  assert.match(ctx, /const \[historyDate, setHistoryDate\] = useState\(null\)/);
  assert.match(ctx, /const \[history, setHistory\] = useState\(null\)/);
});

test("the dated history endpoint still narrows to ONE group on the server", () => {
  // The client's sub-tabs went with D25; the endpoint did not, and its contract is unchanged: a
  // `group` it does not recognise is refused rather than answered with everything.
  assert.match(applyRoute, /if \(asked && !Object\.prototype\.hasOwnProperty\.call\(OUTCOME_STATUSES, asked\)\)/);
  assert.match(applyRoute, /error: "bad_group"/);
  assert.match(applyRoute, /\? \{ group: asked, jobs: groups\[asked\] \}/);
  assert.equal((ctx.match(/api\(\s*\n?\s*`\/api\/apply\/history\?/g) || []).length, 1,
    "the history is fetched from more than one place — they will disagree");
});

// ── Requirement 4: the counts, and the decision behind them ──────────────────────────────────


// ── Requirement 5: where you land ────────────────────────────────────────────────────────────

test("AD1 requirement 5 -> D25: the actionable work is not behind any tab — it IS the page", () => {
  // AD1 made PENDING the landing tab so the work was not buried behind COMPLETED. D25 removes the
  // tabs: the actionable work — portals, questions, approvals, prerequisites, holds — is the
  // Stopped column, always rendered, and nothing gates it on a selection.
  assert.doesNotMatch(panel, /historyGroup/);
  const stopped = panel.slice(at(panel, '<section data-draft-stopped=""'), at(panel, '<aside data-draft-queued=""'));
  assert.match(stopped, /Review all \{needsYouCount\} →/);
  assert.match(stopped, /<StoppedItem /);
  for (const feed of ["prereqMissing: applyPrereqMissing", "gatePortals: applyGatePortals",
                      "questions: applyQuestions", "pending: applyPending", "heldApplications, brokeApplications"]) {
    assert.ok(panel.includes(feed), `${feed} no longer reaches the Stopped column`);
  }
  assert.match(panel.slice(at(panel, '<aside data-draft-queued=""')), /applyInFlight\.map\(job =>/);
});

test("D25: the standing work reads the cross-run feeds — there is no date picker to hide it behind", () => {
  assert.doesNotMatch(panel, /<DateFilterButton|<PanelSubTabs/);
  const stopped = panel.slice(at(panel, '<section data-draft-stopped=""'), at(panel, '<aside data-draft-queued=""'));
  assert.ok(!/\bhistory\.jobs\b|\blistedJobs\b|\blistedByCompany\b/.test(panel),
    "the panel reads the dated listing — it would empty out until a date is picked");
  assert.ok(stopped.length > 0);
});

// ── Requirement 6: everything AC1–AC4 delivered is still here ────────────────────────────────

test("AD1 requirement 6 -> D25: nothing AC1–AC4 built that still applies was dropped", () => {
  for (const [what, needle] of [
    ["problems, in the modal",     /const modalCompanies    = groupByCompany\(modalApplications\)/],
    // AC1 — Open is scoped, and "Review all" is the only unscoped path.
    ["scoped Open",                /onClick: resumable \? \(\) => openHandoff\(packet, r\) : \(\) => openApplicationReview\(r\)/],
    ["scoped Details",             /onClick=\{\(\) => openApplicationReview\(r\)\}/],
    ["the one unscoped path",      /const openEverything = \(\) => openScoped\(null\);/],
    // AB1 — the resumable handoff and its refusals.
    ["the handoff",                /openHandoff\(packet, r\)/],
    ["a stale packet re-runs",     /const rerunJob = \(job\) => \{/],
    ["the handoff message",        /\{handoffMsg && \(/],
    // AB4 — broke is listed and held on purpose is not; the résumé button only where it is the fix.
    ["broke, not held",            /splitByFault\(applyStopped\)\.broke/],
    ["the generate button",        /r\.primary\?\.resumeBlocked && !r\.primary\?\.row\?\.resumeAvailable/],
    // AC4 — abort and soft delete.
    ["abort, in flight",           /onAbort=\{rowAbort\}/],
    ["soft delete",                /onClick: \(\) => hideApplication\(r\)/],
  ]) {
    assert.match(panel, needle, `${what} did not survive D25`);
  }
  // The row-level evidence on the rows that remain (in flight, and the modal's attempts).
  for (const [what, needle] of [
    ["Resume PDF",     /Resume PDF ↗/],
    ["the submitted screenshot", /Screenshot of the form ↗/],
    ["the ATS chip",   /atsBandFor\(app\.atsScore/],
  ]) {
    assert.match(sections, needle, `${what} is gone from the rows`);
  }
});

test("AD1 requirement 6: co-resolution grouping and its exclusions are untouched", () => {
  // resolutionPlan lifts the co-resolvable holds out of an application's problem list in the modal.
  assert.match(panel, /const planFor = \(app\) => resolutionPlan\(app, \{/);
  assert.match(panel, /portals: applyGatePortals, packets: applyHandoffPackets, questions: applyQuestions/);
  const obstacles = read("client/src/lib/applyObstacles.js");
  assert.match(obstacles, /export const CO_RESOLVABLE_GATE_REASONS = Object\.freeze\(new Set\(\["login_required"\]\)\)/);
  for (const excluded of ["captcha_required", "daily_cap_reached"]) {
    assert.ok(obstacles.includes(excluded), `the "${excluded}" exclusion is gone`);
  }
  // captcha_required is still named in Draft House, as its own item rather than a sign-in.
  const lib = read("client/src/lib/draftHouseExceptions.js");
  assert.match(lib, /includes\("captcha_required"\)/);
  assert.match(lib, /is behind an identity check/);
});

// ── Requirement 1: the mapping is AC4's, unchanged ───────────────────────────────────────────

test("AC4's partition is still the server's, and Draft House branches on no status itself", () => {
  assert.deepEqual(OUTCOME_STATUSES[OUTCOME.COMPLETED], ["submitted"]);
  assert.deepEqual(OUTCOME_STATUSES[OUTCOME.PENDING], ["queued", "running", "held_review", "held_gate"]);
  assert.deepEqual(OUTCOME_STATUSES[OUTCOME.ABORTED], ["failed", "dismissed", "superseded", "cancelled"]);
  for (const status of Object.values(OUTCOME_STATUSES).flat()) {
    assert.ok(!new RegExp(`"${status}"`).test(panel.slice(0, at(panel, "return ("))),
      `the panel branches on the '${status}' status itself instead of asking the shared vocabulary`);
  }
  assert.match(applyRoute, /const group = outcomeGroupFor\(\{ \.\.\.pub, postingGone: r\.title == null && r\.company == null \}\)/);
  assert.equal(OUTCOME_LABELS[OUTCOME.ABORTED].label, "Aborted");
});

// ── Requirement 8: the badge ─────────────────────────────────────────────────────────────────

test("AD1 requirement 8: the AUTO APPLY badge still counts what needs attention, with no preload", () => {
  // WHAT IT COUNTS, unchanged by AD1: applications waiting for approval, applications held for
  // review, and open questions. Summed in the context so the badge and the panel cannot disagree
  // about what "needs attention" means.
  assert.match(ctx, /needsAttentionCount: applyPending\.length \+ applyReviewJobs\.length \+ applyQuestions\.length/);
  // AND IT NEEDS NO PRELOAD OF THE LISTING. Its three terms come from the cross-run feeds the
  // provider already loads for the whole session — none of them is the dated endpoint, so the badge
  // is computable with `history === null`, which is its state on every first render.
  for (const term of ["applyPending", "applyReviewJobs", "applyQuestions"]) {
    const setter = `set${term[0].toUpperCase()}${term.slice(1)}`;
    assert.ok(ctx.includes(setter), `${term} has no setter — the badge term is not a real feed`);
  }
  assert.ok(!/needsAttentionCount:[^\n]*history/.test(ctx),
    "the badge now reads the dated history — it cannot be computed before a date is picked");
  // The effect that fills those three feeds is the mount effect, and it fetches none of the history.
  const mount = ctx.match(/useEffect\(\(\) => \{\s*\n\s*if \(user\) \{ loadApplyRuns\(\); loadApplyQuestions\(\); loadApplyPending\(\); \}/);
  assert.ok(mount, "the feeds behind the badge are no longer loaded on mount");
});

// ── The browser harness must actually exercise the new shape ─────────────────────────────────


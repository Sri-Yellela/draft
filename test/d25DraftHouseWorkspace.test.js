// D25 (10-04): DRAFT HOUSE AS A WORKSPACE — the run bar, exceptions as the main surface, the fold.
//
// The premise was corrected first (docs/DRAFT_HOUSE_WORKSPACE.md): D14's Stopped │ Queued split and
// D18's "Draft House" tab had shipped, inside AutoApplyPanel.jsx. What had not was the workspace
// model — no run bar, no SEMI/AUTO, no caps, no user Stop — and AD1's chrome still filled the
// columns. These tests pin the model. The server half (the per-user hold the run loop checks before
// starting a run) is test/d25UserHold.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  autoToggle, capUsage, quietLine, splitAnswers, buildStoppedItems, filterItems,
  STOP_DOES, STOP_DOES_NOT, AUTO_LOCKED_FALLBACK,
} from "../client/src/lib/draftHouseExceptions.js";
import { PREREQUISITE_LABELS, groupByApplication } from "../client/src/lib/applyObstacles.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const panel    = read("client/src/panels/AutoApplyPanel.jsx");
const bar      = read("client/src/components/DraftRunBar.jsx");
const item     = read("client/src/components/StoppedItem.jsx");
const css      = read("client/src/components/DraftHouse.css");
const ctx      = read("client/src/contexts/AutoApplyContext.jsx");
const dbPanel  = read("client/src/panels/DatabasePanel.jsx");
const controls = read("client/src/components/ui/PanelControls.jsx");
const app      = read("client/src/App.jsx");
const route    = read("routes/apply.js");

// ── 1. THE RUN BAR: AUTO IS LOCKED, AND ONLY THE SERVER CAN SAY OTHERWISE ────────────────────

test("⛔ AUTO is locked unless the server answers locked:false — nothing else unlocks it", () => {
  for (const runBar of [null, undefined, {}, { mode: {} }, { mode: { auto: {} } },
                        { mode: { auto: { locked: true } } }, { mode: { auto: { locked: "false" } } },
                        { mode: { auto: { locked: 0 } } }, { mode: { auto: { locked: null } } }]) {
    const t = autoToggle(runBar);
    assert.equal(t.selectable, false, `unlocked from ${JSON.stringify(runBar)}`);
    assert.equal(typeof t.reason, "string");
  }
  assert.equal(autoToggle(null).reason, "Auto has never run unattended against a real employer.");
  assert.equal(AUTO_LOCKED_FALLBACK, "Auto has never run unattended against a real employer.");
  // The server's own sentence wins when it sends one.
  assert.equal(autoToggle({ mode: { auto: { locked: true, message: "Paused by the operator." } } }).reason,
    "Paused by the operator.");
  assert.deepEqual(autoToggle({ mode: { auto: { locked: false } } }), { selectable: true, reason: null });
});

// D100 (owner 10-30) changed this on purpose: FULL AUTO is the user's to choose, so the segment has a handler — but
// ONLY while the server says selectable; locked, the handler is not attached at all.
test("⛔ the FULL AUTO segment's handler exists only when selectable, it is disabled while locked, and SAYS why in text", () => {
  const auto = bar.slice(at(bar, 'data-mode="auto"'), at(bar, "</button>", at(bar, 'data-mode="auto"')));
  assert.match(auto, /onClick=\{mode\.selectable \? \(\) => current !== "auto" && onMode\?\.\("auto"\) : undefined\}/);
  assert.match(auto, /disabled=\{!mode\.selectable \|\| busy\}/);
  assert.match(auto, /aria-disabled=\{!mode\.selectable\}/);
  assert.match(bar, /const mode = autoToggle\(runBar\);/);
  // The reason is a visible paragraph, not a tooltip a phone cannot show.
  assert.match(bar, /<p className="dh-mode__why" id="dh-auto-why" data-auto-locked-reason="">\{mode\.reason\}<\/p>/);
  // Nothing in the client writes a lock state of its own (an object literal, not prose about one).
  for (const src of [bar, panel, ctx]) assert.doesNotMatch(src, /locked:\s*false\s*[,}]/);
  // The pressed segment is the SERVER's mode — and never FULL AUTO while it is locked.
  assert.match(bar, /const current = runBar\?\.mode\?\.current === "auto" && mode\.selectable \? "auto" : "semi";/);
  assert.match(bar, /aria-pressed=\{current === "semi"\} data-mode="semi"/);
  // The mode reaches the SERVER; the bar shows its answer.
  const setMode = ctx.slice(at(ctx, "const setApplyMode = useCallback"), at(ctx, "}, []);", at(ctx, "const setApplyMode")));
  assert.match(setMode, /api\("\/api\/apply\/mode", \{ method: "POST", body: JSON\.stringify\(\{ mode \}\) \}\)/);
  assert.match(setMode, /setRunBar\(r\)/);
});

// D102 P4: ⚙ Auto settings opens the drawer; its terms switch is off unless the user turns it on.
test("⚙ Auto settings: the drawer reads and writes the server's settings, terms opt-in included", () => {
  const drawer = read("client/src/components/AutoSettingsDrawer.jsx");
  assert.match(panel, /<AutoSettingsDrawer open=\{settingsOpen\}/);
  assert.match(bar, /data-auto-settings-open=""/);
  assert.match(drawer, /api\("\/api\/apply\/auto-settings"\)/);
  assert.match(drawer, /api\("\/api\/apply\/auto-settings", \{ method: "PUT", body: JSON\.stringify\(\{ settings: s \}\) \}\)/);
  assert.match(drawer, /checked=\{!!s\.agreeToTerms\}[^>]*data-agree-to-terms=""/);
  assert.match(drawer, /a human check \(a CAPTCHA\)/, "the drawer says a human check is never sent automatically");
});

// D100 (owner 10-30): the proof constant is removed; the mode is the user's (default SEMI) and the kill switch is
// the one lock left, reported beside it.
test("the bar's mode is the user's own, and AUTO is locked only by the operator's kill switch", () => {
  assert.doesNotMatch(route, /const FULL_AUTO_PROVEN/);
  assert.match(route, /message: "Automatic sending is paused by the operator\.", killSwitch/);
  assert.match(route, /mode: \{ current: userApplyMode\(userId\), auto: autoModeState\(\) \}/);
});

// ── 2. THE THREE CAPS ────────────────────────────────────────────────────────────────────────

test("the bar shows the three caps the server sends, with how much of each is used", () => {
  assert.equal(capUsage({ used: 3, limit: 40 }), "3 of 40");
  assert.equal(capUsage({ used: 0, limit: 25 }), "0 of 25");
  assert.equal(capUsage(null), null, "an unloaded cap renders no number nobody measured");
  assert.equal(capUsage({ used: undefined, limit: 40 }), null);
  assert.match(bar, /const caps = Array\.isArray\(runBar\?\.caps\) \? runBar\.caps : \[\];/);
  assert.match(bar, /data-cap=\{c\.id\}/);
  assert.match(bar, /\{capUsage\(c\)\}/);
  // The bar is read, never assembled: one endpoint, loaded with the feeds and re-read when they move.
  assert.match(ctx, /setRunBar\(await api\("\/api\/apply\/run-bar"\)\)/);
  assert.match(ctx, /useEffect\(\(\) => \{ if \(user\) loadRunBar\(\); \}, \[user, applyRuns, loadRunBar\]\);/);
  assert.match(panel, /<DraftRunBar runBar=\{runBar\} onStop=\{setStopEverything\} busy=\{holdBusy\} message=\{holdMsg\}\s+onMode=\{setApplyMode\}/);
});

// ── 3. ⏸ STOP EVERYTHING REACHES THE SERVER, AND SAYS WHAT IT DOES NOT DO ────────────────────

test("⏸ Stop everything posts the hold to the server — it stops nothing locally", () => {
  const stop = ctx.slice(at(ctx, "const setStopEverything = useCallback"), at(ctx, "}, [loadApplyRuns]);", at(ctx, "const setStopEverything")));
  assert.match(stop, /api\("\/api\/apply\/hold", \{ method: "POST", body: JSON\.stringify\(\{ held: !!held \}\) \}\)/);
  assert.match(stop, /setRunBar\(r\)/, "the bar shows the SERVER's answer, not an optimistic guess");
  assert.match(bar, /onClick=\{\(\) => onStop\?\.\(!held\)\}/);
  assert.match(bar, /\{held \? "▶ Resume" : "⏸ Stop everything"\}/);
  assert.match(bar, /const held = !!runBar\?\.hold\?\.held;/);
});

test("the bar says plainly what Stop does and does NOT do — sent applications are not recalled", () => {
  assert.match(STOP_DOES, /holds every draft that has not started/);
  assert.match(STOP_DOES, /a run in progress starts nothing further/);
  assert.match(STOP_DOES_NOT, /does not recall applications already sent/);
  assert.match(STOP_DOES_NOT, /already being filled finishes — stop it in Queued/);
  // Always rendered, held or not — the user reads it BEFORE pressing.
  assert.match(bar, /<p className="dh-stop__say" data-stop-says="">\{STOP_DOES\} \{STOP_DOES_NOT\}<\/p>/);
  // And the copy matches what the server does: the hold is checked before a run, and between jobs.
  assert.match(route, /if \(userHeld\(db, run\.user_id\)\) \{\s*\n\s*parkRunAtHead\(run,/);
  assert.match(route, /if \(userHeld\(db, run\.user_id\)\) \{ heldMidRun = true; break; \}/);
});

// ── 4. EXCEPTIONS ARE THE MAIN SURFACE; EXACT MATCHES ARE ONE LINE IN THE FOLD ───────────────

test("the fold: exact matches are NOT listed — they are one line, '12 of 14 needed no attention'", () => {
  assert.equal(quietLine(14, 2), "12 of 14 needed no attention");
  assert.equal(quietLine(3, 3), null, "nothing quiet, no line");
  assert.equal(quietLine(0, 0), null);
  const answers = [
    ...Array.from({ length: 12 }, (_, i) => ({ label: `Exact ${i}`, value: "v", provenance: "field_map" })),
    { label: "Years with Go", value: "4", provenance: "label_fuzzy" },
    { label: "Notice period", value: "2 weeks", provenance: "label_fuzzy" },
    { label: "Skipped", value: "", skipped: true },
    { label: "Refused", value: "x", policy_rejected: true },
  ];
  const s = splitAnswers(answers);
  assert.deepEqual(s.attention.map(a => a.label), ["Years with Go", "Notice period"]);
  assert.equal(s.total, 14, "skipped and refused fields were never filled, so they are not counted");
  assert.equal(s.line, "12 of 14 needed no attention");
  // The pending item says the same thing BEFORE its answers are fetched, from the server's counts.
  const [approval] = buildStoppedItems({ pending: [{ runJobId: 7, company: "Acme", answerCount: 14, guessCount: 2 }] });
  assert.equal(approval.fold.quiet, "12 of 14 needed no attention");
  assert.equal(approval.fold.needs.length, 1, "one line about the guesses, not fourteen fields");
  // The panel lists ONLY the attention fields once the answers are read.
  assert.match(panel, /needs: split\.attention\.map\(a =>/);
  assert.match(panel, /quiet: split\.line/);
  assert.match(item, /\{item\.fold\?\.quiet && <p className="dh-fold__quiet" data-quiet-line="">\{item\.fold\.quiet\}<\/p>\}/);
});

test("Stopped lists what needs the user, in the order they should meet it", () => {
  const held = groupByApplication([{ id: 1, jobId: "h1", company: "Initech", title: "SRE", status: "held_review", reasonCode: "ats_below_threshold", finishedAt: 2 }]);
  const broke = groupByApplication([{ id: 2, jobId: "b1", company: "Globex", title: "SWE", status: "failed", reasonCode: "internal_error", finishedAt: 1 }]);
  const items = buildStoppedItems({
    prereqMissing: ["profile_email"], prereqLabels: PREREQUISITE_LABELS,
    gatePortals: [{ origin: "o", host: "acme.example", count: 2, gateReasons: ["login_required"] }],
    questions: [{ question: "Are you authorised to work here?", eligibility: true }],
    pending: [{ runJobId: 5, company: "Acme", title: "PM", answerCount: 10, guessCount: 0 }],
    heldApplications: held, brokeApplications: broke,
  });
  assert.deepEqual(items.map(i => i.kind), ["prerequisite", "portal", "questions", "approval", "held", "broke"]);
  assert.ok(items.every(i => i.key && i.title && ["danger", "warning", "info"].includes(i.tone)));
  // Search narrows by what a person would type.
  assert.deepEqual(filterItems(items, "globex").map(i => i.kind), ["broke"]);
  assert.equal(filterItems(items, "  ").length, items.length);
});

test("⛔ no Sent column, no numbered flow boxes, and Queued is 'Queued' — never 'Running fine'", () => {
  // Sent is The Table's (D15). The submitted feed may only be READ here (is anything drafted at
  // all; is this job live), never RENDERED as a list.
  assert.doesNotMatch(panel, /variant="submitted"/);
  assert.doesNotMatch(panel, /applySubmitted\.map/);
  assert.doesNotMatch(panel, /OUTCOME\.COMPLETED|data-draft-sent|aria-label="Sent"/);
  assert.doesNotMatch(panel, /Running fine/i);
  assert.match(panel, />Queued\{queuedCount > 0/);
  assert.match(panel, /<aside data-draft-queued="" aria-label="Queued"/);
  // No numbered flow boxes: no "Step 1", no circled digits, no 1-2-3 pipeline strip.
  for (const src of [panel, bar, item]) {
    assert.doesNotMatch(src, /Step \d|[①②③④⑤]|data-flow-step/);
  }
});

test("D1's hover rail and depth on every Stopped item and control", () => {
  assert.match(item, /className="dh-rail"/);
  assert.match(item, /className="dh-sq"/);
  assert.match(item, /rail\.slice\(0, 3\)/, "at most three squares, like D1's");
  assert.match(item, /aria-expanded=\{open\}/);
  // The rail is zero-width until hover OR keyboard focus, and always shown where nothing hovers.
  assert.match(css, /\.dh-rail \{[\s\S]*?max-width: 0; opacity: 0;/);
  // T25: visibility rides the reveal (the rail clips with clip-path, not overflow — t25CardRailSeam).
  assert.match(css, /\.dh-item:hover \.dh-rail, \.dh-item:focus-within \.dh-rail \{ max-width: 196px; opacity: 1; visibility: visible; transition-delay: 0s; \}/);
  assert.match(css, /@media \(hover: none\) \{ \.dh-rail \{ max-width: 196px; opacity: 1; visibility: visible; \} \}/);
  // Depth tokens at rest, on hover and on press — tokens only, no colour literal (colorLiteralGuard).
  for (const t of ["--c-depth-rest", "--c-depth-hover", "--c-depth-press", "--c-depth-accent"]) {
    assert.ok(css.includes(`var(${t})`), `${t} is not used`);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

// ── 5. REUSE, NOT FORK: AutoApplyContext and PanelControls ───────────────────────────────────

test("PanelControls is reused, not forked — and the Database panel keeps all three controls", () => {
  for (const name of ["PanelSubTabs", "PanelSearch", "DateFilterButton"]) {
    assert.match(controls, new RegExp(`export function ${name}\\(`));
    assert.match(dbPanel, new RegExp(`<${name}`), `the Database panel lost ${name}`);
  }
  assert.match(dbPanel, /import \{ PanelSubTabs, PanelSearch, DateFilterButton \} from "\.\.\/components\/ui\/PanelControls\.jsx";/);
  assert.match(panel, /import \{ PanelSearch \} from "\.\.\/components\/ui\/PanelControls\.jsx";/);
  for (const src of [panel, bar, item]) {
    assert.doesNotMatch(src, /function (PanelSubTabs|PanelSearch|DateFilterButton)\b/, "a control was forked");
  }
  // And the state is the context's: the bar and the hold live in AutoApplyContext, not a new store.
  assert.match(ctx, /runBar, loadRunBar, setStopEverything, setApplyMode, holdBusy, holdMsg,/);
  assert.match(panel, /runBar = null, setStopEverything, setApplyMode, holdBusy = false, holdMsg = "",/);
  assert.doesNotMatch(panel, /createContext|useReducer/);
});

test("the panel's header describes Draft House as it is — the AD1-era prose is gone", () => {
  const head = panel.slice(0, at(panel, "export function AutoApplyPanel"));
  assert.doesNotMatch(head, /the strip that used to sit between the search bar and the postings/);
  assert.match(head, /AutoApplyPanel — DRAFT HOUSE, the workspace \(D14, D18, D25\)/);
  assert.match(head, /⛔ NO SENT COLUMN/);
  assert.match(head, /D22, ANTICIPATED AND NOT BUILT/);
});

// ── 6. RECRUITER PANEL: REACHABLE, SO KEPT ───────────────────────────────────────────────────

test("RecruiterPanel is still reachable — by route and by two in-app links — so its render path stays", () => {
  // D25 was asked to remove the render path only if it is provably dead. It is not: /app/recruiter is
  // a route-only tab (D5), and two components navigate to it. Whether those links go is O53.
  assert.match(app, /const ROUTE_ONLY_TABS = \["recruiter", "job-profiles"\];/);
  assert.match(app, /\{activeTab === "recruiter"\s+&& <RecruiterPanel\/>\}/);
  assert.match(read("client/src/components/JobCard.jsx"), /navigate\(`\/app\/recruiter\?company=/);
  assert.match(read("client/src/components/CompanyViewModal.jsx"), /navigate\(`\/app\/recruiter\?company=/);
  // …and it is still not a tab in the bar.
  const tabs = app.slice(at(app, "const appTabs"), at(app, "const ROUTE_ONLY_TABS"));
  assert.doesNotMatch(tabs, /id: "recruiter"/);
});

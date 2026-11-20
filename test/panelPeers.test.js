// U3: the PDF and ATS surfaces are PEERS of the JD drawer, through one extracted primitive.
//
// Before: JobDetailPanel was a portal drawer that hand-rolled its own scrim, animation, sticky
// header, action bar and z-index, while the PDF sandbox and the ATS report were
// react-resizable-panels COLUMNS wedged into the region below the search bar. That is why they were
// cramped (the board could squeeze them, and getPanelDefaults could squeeze the board to 6%) and why
// they sat BEHIND the JD drawer rather than beside it — a column cannot overlay a portal.
//
// The reference panel's seven properties are asserted against PanelShell, once, because there is now
// exactly one implementation of them and all three panel types render through it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Z as Z_SCALE } from "../client/src/styles/zLayers.js";
import { at } from "../test-support/sourceAnchors.js";
import { SORTS } from "../shared/jobFilterOptions.js";
import { SORT_PANEL } from "../shared/filterSentence.js";   // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): boardControlRowConsolidation's, merged below

const read = (p) => fs.readFileSync(p, "utf8");
const shell   = read("client/src/components/PanelShell.jsx");
const host    = read("client/src/hooks/usePanelHost.js");
const jd      = read("client/src/components/JobDetailPanel.jsx");
const sandbox = read("client/src/panels/SandboxPanel.jsx");
// ⭐ D152 (8) (b), changed on purpose: the ATS panel drawn over the page (AtsReportPanel) is RETIRED — the match opens
// inside the posting (ats-options.html option A). The PDF and the posting are the peers now; the ATS checks below say so.
const atsBody = read("client/src/components/ATSPanel.jsx");
const jobs    = read("client/src/panels/JobsPanel.jsx");
const app     = read("client/src/App.jsx");

// ── The seven properties of the reference panel ───────────────────────────────────────────────

test("1. right-anchored overlay, inset from the viewport edges, with rounded corners", () => {
  // The INSET is the dock's — it is the overlay surface now, and the panels tile inside it. That is
  // the fix: three independently viewport-anchored panels were not a group, so one could be pushed
  // off the screen by its neighbour growing.
  assert.match(shell, /position: "fixed"/);
  // The insets are named constants now, not literals, and the top one tracks the measured chrome
  // height (Y4) so the dock cannot stop clearing a bar whose size changed. 46 + 34 is the 80 it was.
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): the two named insets and the dock using them are asserted below in "the filters drawer is on the named tiers and inset clear of the nav" (with why each would fail)
  // D149 (11-03) changed this on purpose: 16 is the DEFAULT corner (a panel may wear its own — the posting is the
  // sketch's 28), and a full-screen panel (a phone) has none: the sketch's posting is the whole screen.
  assert.match(shell, /surfaceClass = "liquid-panel", radius = 16, fill = false,/);
  assert.match(shell, /borderRadius: fullScreen \? 0 : radius,/);
  // Not full-height, not flush, and not in the layout flow: the dock is portalled to body.
  assert.match(shell, /document\.body\s*\)/);
  assert.equal((shell.match(/createPortal\(/g) || []).length, 2,
    "expected exactly two portals — the scrim and the dock. A panel portalling itself is how they " +
    "stopped being a group in the first place");
});

test("2. the scrim dims but does not hide, and there is exactly one for the group", async () => {
  // Was the literal rgba(0,0,0,0.45) — a black scrim for a dark UI. On the paper substrate it is
  // the SCRIM token (ink at low alpha), and "dims but does not hide" is asserted on its alpha.
  assert.match(shell, /background: "var\(--c-scrim\)"/);
  const { C } = await import("../client/src/styles/colorTokens.js");
  const scrimAlpha = Number(/,\s*([0-9.]+)\)$/.exec(C.SCRIM)[1]);
  assert.ok(scrimAlpha > 0.1 && scrimAlpha < 0.5, `scrim alpha ${scrimAlpha} either hides the board or does not dim it`);
  assert.match(shell, /backdropFilter: "blur\(4px\)"/);
  // One scrim, rendered by the host — two stacked 45% scrims compound to ~70% and the board stops
  // being visible behind them, which would break this property exactly when a second panel opens.
  assert.match(shell, /export function PanelScrim/);
  assert.equal((jobs.match(/<PanelScrim\b/g) || []).length, 1);
});

test("3. backdrop blur on the panel surface itself (dark glass), not a flat fill", () => {
  // D149 (11-03) changed this on purpose: the glass is the DEFAULT surface; the posting wears the sketch's card instead.
  assert.match(shell, /className=\{surfaceClass\}/);
  const css = read("client/src/index.css");
  assert.match(css, /\.liquid-panel \{[\s\S]*?backdrop-filter: blur\(14px\)/);
  // Was `rgba(255, 255, 255, 0.03)`: a white wash that reads as glass only over a dark video. Over
  // the paper it is the SURFACE_2 glass token. The blur above — the glass itself — is unchanged.
  assert.match(css, /\.liquid-panel \{[\s\S]*?background: var\(--c-surface-2\)/);
});

test("4. TWO sticky regions — identity header AND action bar — and only the body scrolls", () => {
  // Both are flexShrink:0 children of a fixed-height flex column, which pins them harder than
  // position:sticky: they cannot move at all rather than sticking once scrolled to.
  assert.equal((shell.match(/flexShrink: 0, background: "var\(--color-surface\)"/g) || []).length, 2,
    "expected exactly two pinned regions (header + action bar)");
  assert.match(shell, /header=\{header\}|\{header\}/);
  assert.match(shell, /\{actions\}/);
  // The PDF and ATS panels supply both slots. ⭐ D48 (owner, 10-07 — posting-header2.html): the posting panel
  // is `bare` — its header SCROLLS AWAY and its actions stick through the one StickyBar (D49) inside the body,
  // which is still the only scroller.
  // ⭐ D147 (11-03) changed this on purpose: the actions moved to the body's FOOT (`.pp__foot`, sticky bottom).
  assert.match(jd, /^\s+bare$/m, "the posting panel renders its own header and sticky actions");
  assert.match(jd, /<div className="pp__foot" data-posting-actions-bar="">/);
  assert.match(shell, /\{!bare && \(/, "a bare shell draws neither pinned region");
  for (const [name, src] of [["PDF", sandbox]]) {
    assert.match(src, /header=\{/, `${name} must fill the identity header slot`);
    assert.match(src, /actions=\{/, `${name} must fill the action bar slot`);
  }
});

test("5. the body is its own scroll container and does not chain to the page", () => {
  assert.match(shell, /flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",/);
  assert.match(shell, /overscrollBehavior: "contain"/);
  // No panel may nest a second scroller inside that body.
  assert.ok(!/overflowY: "auto"/.test(sandbox), "the PDF panel is scrolling itself again");
  assert.ok(!/overflowY:"auto"/.test(atsBody),  "the ATS report is scrolling itself again");
  assert.ok(!/overflowY:"auto"/.test(jd),       "the JD body is scrolling itself again");
});

test("6. one close affordance, top-right of the header, owned by the primitive", () => {
  assert.match(shell, /aria-label="Close panel"/);
  // Each panel type must NOT ship its own — that is how two divergent drawers started.
  assert.ok(!/aria-label="Close detail"/.test(jd), "JD has its own close button again");
  assert.equal((shell.match(/aria-label="Close panel"/g) || []).length, 1);
  // D48: the bare posting panel's × is its header's (the sketch's row) — and only because the shell's is not
  // drawn when bare, so a panel never shows two. Esc and the scrim still close through the shell.
  // ⭐ D147 (11-03): that × is now a small "Close" text box, named "Close the posting" — still exactly one.
  // ⭐ D156 (1c): on the deck the same one button says "Fold it back" — still exactly one.
  assert.equal((jd.match(/"Close the posting"/g) || []).length, 1);
  assert.equal((jd.match(/data-posting-close=""/g) || []).length, 1);
  assert.match(jd, /^\s+bare$/m);
});

test("7. modal tier: above the board, the Applications table AND the search overlay", async () => {
  const { Z } = await import("../client/src/styles/zLayers.js");
  assert.ok(Z.MODAL > Z.SEARCH);
  assert.ok(Z.MODAL > Z.PANEL_POPOVER);
  assert.ok(Z.MODAL_SCRIM > Z.SEARCH);
  // Declared once, on the dock, for the whole group. Ordering BETWEEN peers is then local to the
  // dock's stacking context rather than a second scale value competing with the app's.
  assert.match(shell, /zIndex: Z\.MODAL,/);
  assert.match(shell, /zIndex: focused \? 1 : 0,/);
});

// ── Peers, not lookalikes ─────────────────────────────────────────────────────────────────────

test("both panels render through the one primitive (⭐ D152 (8): the ATS panel is retired — the match is in the posting)", () => {
  for (const [name, src] of [["JD", jd], ["PDF", sandbox]]) {
    assert.match(src, /<PanelShell/, `${name} must render through PanelShell`);
    assert.match(src, /panelId="(jd|pdf)"/, `${name} must declare a panel type id`);
  }
  assert.ok(!fs.existsSync("client/src/panels/AtsReportPanel.jsx"), "the ATS panel drawn over the page is back");
  assert.match(jd, /<ATSPanel report=\{selectedJobMeta\?\.atsPayload\?\.report\}/, "the match is drawn inside the posting");
  // And none of them may reimplement the chrome the primitive provides.
  assert.ok(!/createPortal/.test(jd), "JD is portalling itself again instead of via PanelShell");
  assert.ok(!/AnimatePresence/.test(jd), "JD is animating itself again");
});

test("the PDF and ATS surfaces are no longer inline columns", () => {
  // The two <Panel> columns and their handles are gone; only the board's column remains.
  assert.equal((jobs.match(/<Panel\b/g) || []).length, 1);
  assert.ok(!/<SandboxPanel entry=\{sandbox\} onClose=\{closeSandbox\}\s*\n\s*onSave/.test(
    jobs.slice(0, at(jobs, "The popup panel group"))),
    "an inline copy of the sandbox survives above the popup group");
  // Exactly one mount of each panel type.
  assert.equal((jobs.match(/<SandboxPanel\b/g) || []).length, 1);
  assert.equal((jobs.match(/<AtsReportPanel\b/g) || []).length, 0, "D152 (8): no ATS overlay");
  // D149 (11-03) changed this on purpose: the posting has a second mount on a desktop, where it leaves the overlay host;
  // never both at once (the host's jd is closed then). ⭐ D152 (6): that mount is IN PLACE of the list (JobBoardColumns'
  // post), no longer BesideDock.
  assert.equal((jobs.match(/<JobDetailPanel\b/g) || []).length, 2);
  assert.match(jobs, /\{ id: "jd",  open: !!selectedJob && !besideMode,/);
});

test("one host owns the ordered set, and JD moved under it", () => {
  assert.match(jobs, /usePanelHost\(panelDescriptors, vpWidth\)/);
  assert.match(jobs, /\{ id: "jd",\s+open: !!selectedJob/);
  assert.match(jobs, /\{ id: "pdf", open: sandboxOpen/);
  assert.doesNotMatch(jobs, /\{ id: "ats", open:/, "D152 (8): the ATS report is not an overlay peer any more");
  // Three peers cannot tile from two different parents, so App no longer mounts JD itself.
  assert.ok(!/<JobDetailPanel/.test(app), "App is mounting the JD drawer outside the host again");
});

// ── The PDF's two render paths ────────────────────────────────────────────────────────────────

test("the PDF view that leads is the one that is legible at the panel's width", () => {
  // Page view scales A4 (794px) to whatever the panel has, so its legibility is a pure function of
  // width: at the 360px minimum the scale is 0.45 and body text lands under 6px. Below the
  // threshold the panel therefore opens REFLOWED, re-rendered at its measured width rather than
  // scaled down to it. At or above it, Page leads, because it is the only view whose page breaks
  // match the exported PDF.
  assert.match(sandbox, /const PAGE_VIEW_MIN_WIDTH = 700;/);
  assert.match(sandbox, /const \[viewChoice, setViewChoice\] = useState\(null\);/);
  assert.match(sandbox, /\(\(width \?\? PAGE_VIEW_MIN_WIDTH\) >= PAGE_VIEW_MIN_WIDTH \? "page" : "reading"\)/);
  // An explicit choice wins at every width thereafter — the width decides the DEFAULT, it does not
  // override the person.
  assert.match(sandbox, /const viewMode = viewChoice/);
  assert.match(sandbox, /viewMode === "reading" \? \(/);
  // Reading view reflows by rendering at the panel's measured width — no transform, no A4 width.
  assert.match(sandbox, /width: "100%",/);
  assert.match(sandbox, /new ResizeObserver/);
  assert.match(sandbox, /setReadingWidth/);
  // Page view keeps the scale-to-fit A4 stack, because pageCount and the page boundaries are
  // computed at RESUME_PAGE_WIDTH and reflowing would move them.
  assert.match(sandbox, /transform:       `scale\(\$\{scaleRef\.current\}\)`/);
});

test("Reading view states that it does not show pagination", () => {
  // Reflowed text does not break where A4 breaks. A preview that implied otherwise would be worse
  // than one that scaled down, so the limitation is on screen rather than in a comment.
  assert.match(sandbox, /Reading view reflows to the panel width — page breaks are not shown\./);
  assert.match(sandbox, /does not show real pagination/);
});

// ── Contracts that must survive the refactor ──────────────────────────────────────────────────

test("the failsafe review strip still renders nothing when kbFindings is empty", () => {
  // Its contract: empty findings must mean ZERO visual change. The strip is still gated on a
  // non-empty array, and it is still inside the panel body rather than the sticky chrome.
  assert.match(sandbox, /activeEntry\?\.kbFindings\?\.length > 0 && \(/);
  assert.ok(!/kbFindings\?\.length >= 0/.test(sandbox));
  assert.ok(!/kbFindings \|\| \[\]/.test(sandbox.slice(0, at(sandbox, "kbFindings?.length > 0"))));
});

test("the generate -> sandbox flow is untouched", () => {
  // openSandbox is still what the generate path calls, and it still sets the same state; the host
  // observes that state rather than replacing it, which is why none of these call sites changed.
  assert.match(jobs, /const openSandbox = useCallback\(\(entry\) => \{/);
  assert.match(jobs, /setSandboxOpen\(true\)/);
  assert.match(jobs, /entry=\{sandbox\} onClose=\{closeSandbox\}/);
  assert.match(jobs, /onSave=\{saveSandboxHtml\} onExport=\{exportAndTrack\}/);
});

test("Escape closes ONE panel — the most recently opened, as the backdrop does (D39)", () => {
  // One keypress closing every open panel is never what "go back" means.
  assert.match(shell, /const escapeMine = closesOnEscape \?\? focused;\s+useEffect\(\(\) => \{\s+if \(!escapeMine\) return undefined;[\s\S]*?e\.key === "Escape"/);
  assert.match(jobs, /closesOnEscape: id === lastOpenedId,/);
});

// ── The board behind the scrim ────────────────────────────────────────────────────────────────

test("the board is inert and frozen while any panel is open", () => {
  const lock = read("client/src/hooks/useBoardLock.js");
  // THE FILTERS DRAWER IS IN THIS CONDITION NOW. It was not, and a scrim was all it ever had:
  // measured with only the drawer open, the top bar behind it was dimmed and pointer-unreachable and
  // still fully tab-reachable, so focus walked out of the open drawer into controls the user could
  // not see. Same defect this test was written for, on a surface it did not cover.
  assert.match(jobs, /useBoardLock\(openPanelCount > 0 \|\| filterPanelOpen\)/);
  // And the drawer must be PORTALLED, or inerting the app to protect it would inert it too — it
  // rendered inside <main>, i.e. inside the subtree this hook makes inert.
  assert.match(jobs, /return createPortal\(/);
  assert.match(jobs, /<div data-filters-drawer=""/);
  assert.match(jobs, /document\.body/);

  // FOCUS. `pointer-events: none` stops the mouse and nothing else — Tab walked into the board's
  // controls behind the scrim and put the focus ring on an element the user could not see. `inert`
  // is the only thing that removes a subtree from the tab order, the a11y tree and hit-testing at
  // once.
  assert.match(lock, /child\.setAttribute\("inert", ""\)/);
  assert.match(lock, /for \(const el of inerted\) el\.removeAttribute\("inert"\)/);
  // What stays alive is read from the z-scale, not from a list of component names: anything the
  // scrim does not cover stays live, and anything it covers goes inert, so nothing ever looks live
  // while being inert.
  //
  // THE THRESHOLD IS THE SCRIM, NOT THE NAV. It used to read `z >= Z.NAV`, which was the same line
  // only because NAV was 1500 and the scrim 800. Y2 lowered NAV to 250 so the top bar can never
  // occlude an overlay; left as `>= Z.NAV`, this loop would then have spared every child at 250 or
  // more — INCLUDING the search surface at Z.SEARCH (400), which is exactly the defect the test
  // below this one was written for: a live, tab-reachable search surface underneath an open modal.
  assert.match(lock, /if \(Number\.isFinite\(z\) && z >= Z\.MODAL_SCRIM\) continue;/);
  // Stripped source for the negative: the hook's own note explains the old threshold by quoting it,
  // and matching a comment is how a source-string test passes while the code says something else.
  const lockCode = lock.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/z >= Z\.NAV/.test(lockCode),
    "the lock spares everything above the top bar again, which now includes the search surface");
  assert.match(app, /data-app-shell/);

  // Proven against the real scale rather than by reading the source: every tier at or above the
  // scrim must be spared, and every tier below it must be inerted. The top bar is BELOW now, and
  // that is the intended consequence — dimmed and inert together.
  const spared = (z) => z >= Z_SCALE.MODAL_SCRIM;
  for (const t of ["MODAL_SCRIM", "MODAL", "POPOVER"]) {
    assert.ok(spared(Z_SCALE[t]), `${t} must stay live — the scrim does not cover it`);
  }
  for (const t of ["CONTENT", "NAV", "PANEL_POPOVER", "SEARCH", "SEARCH_DROPDOWN", "DRAWER"]) {
    assert.ok(!spared(Z_SCALE[t]), `${t} is under the scrim and must be inerted`);
  }

  // SCROLL, and the scroll POSITION. `overflow: hidden` on body is the lock that loses it — the
  // document stops being scrollable, the browser clamps scrollTop, and closing the panel drops the
  // user at the top of a board they had scrolled halfway down.
  assert.match(lock, /const scrollY = window\.scrollY/);
  assert.match(lock, /body\.style\.position = "fixed";/);
  assert.match(lock, /body\.style\.top = `-\$\{scrollY\}px`;/);
  assert.match(lock, /window\.scrollTo\(0, scrollY\)/);
  assert.ok(!/body\.style\.overflow = "hidden"/.test(lock),
    "the lock that discards the scroll position is back");

  // And the gutter it opens up, measured BEFORE locking — after it there is no scrollbar left to
  // measure and the compensation would always be zero.
  assert.match(lock, /const gutter = Math\.max\(0, window\.innerWidth - document\.documentElement\.clientWidth\);/);
  assert.match(lock, /body\.style\.paddingRight = `\$\{priorPad \+ gutter\}px`;/);
});

test("keyboard scrolling targets the focused panel, not the page", () => {
  // The browser already does this for free when the focused element is inside the scroll container,
  // so the fix is to put focus there rather than to re-derive the browser's scrolling rules in a
  // key handler. tabIndex -1 keeps it programmatically focusable without joining the tab order, so
  // Tab still reaches the close button and the action bar in their natural positions.
  assert.match(shell, /scrollRef\.current\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(shell, /tabIndex=\{-1\} data-panel-body=""/);
});

// ── The corrective pass: two things the panels' CONTAINER was right about and the app was not ──

test("there is ONE search surface, so it cannot be in two tiers", () => {
  // THE DEFECT THIS GUARDED, AND WHY THE GUARD CHANGED SHAPE. "The search bar renders above the
  // panel bodies" had one cause: the search surface had TWO renderings — UnifiedSearchBar (expanded)
  // and TopBar's collapsed filter pill — and the pill carried Z.NAV while the bar carried Z.SEARCH.
  // One surface in two tiers, chosen by nothing but the scroll offset, landing on opposite sides of
  // MODAL_SCRIM.
  //
  // Measured at 1280x800 with the page scrolled 500 and the PDF + ATS tiles open: the pill painted
  // at z 1500 over a scrim at 800 and tiles at 850, overlapping BOTH tiles' headers by 10px, at full
  // brightness while the board beneath it was dimmed — and still clickable and tab-reachable through
  // the modal, because useBoardLock spared everything at or above Z.NAV. That is also why the
  // unscrolled state looked right and the scrolled state looked wrong.
  //
  // The fix at the time was to put the pill in the SEARCH tier so both renderings agreed. Y4 removes
  // the second rendering instead, which is the stronger form of the same fix: two tiers for one
  // surface is unreachable when there is one surface. So this no longer asserts the pill's tier — it
  // asserts that there is nothing to give a tier to.
  const topbar = read("client/src/components/TopBar.jsx");
  const barCode = topbar
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(?:\/\/|\*).*$/gm, "");
  assert.ok(!/pillIsTheSearchSurface/.test(barCode),
    "the collapsed search surface is back — one surface in two tiers is reachable again");
  assert.ok(!/zIndex: Z\.SEARCH/.test(barCode),
    "the top bar renders something in the SEARCH tier again; the search surface is not its to own");
  // The bar itself is the only thing left here, and it is NAV. Y2 lowered that tier so it can no
  // longer occlude an overlay, which is asserted in searchSurfaceLayering.
  assert.equal((barCode.match(/zIndex: Z\.NAV,/g) || []).length, 1,
    "the top bar should declare exactly one z tier, its own");

  // And the CSS half declares the tier once, on the base rule, so the layouts cannot disagree:
  // .usb--dock was inheriting a bare 200, i.e. below PANEL_POPOVER.
  const usbCss = read("client/src/components/UnifiedSearchBar.css");
  assert.ok(!/z-index: 200;/.test(usbCss), "the search surface is back below panel popovers");
  assert.equal((usbCss.match(/z-index:/g) || []).length, 1,
    "one tier, declared once — two copies is how the dock layout drifted from the hero layout");
});

test("the panel openers do not switch to mobile panes that no longer exist", () => {
  // openSandbox / closeSandbox / openAtsPanel used to set mobilePane to "editor" / "ats". Those
  // panes rendered the sandbox and the report INLINE and were deleted when both became popup
  // panels — the mobile branch renders the board and nothing else. So the switch emptied the board
  // behind the overlay, and closeAtsPanel never reset it, so closing the panels left it empty.
  // Measured at 880x700 and 600x900: zero job cards behind an open panel, and zero after closing.
  // Stripped source: this test's own notes name the mechanism being asserted absent, and a comment
  // describing a removed switch reads as the switch still being there.
  const jobsCode = jobs.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/setMobilePane/.test(jobsCode),
    "the pane switch is back, pointing at a pane that renders nothing");
  assert.ok(!/mobilePane/.test(jobsCode),
    "the board is gated on a pane value again; nothing can set it, so it can only hide the board");
  // The bottom-nav Resume / ATS items reach the PANELS that own those surfaces now, rather than a
  // pane — the tab still shows the resume and still shows the report.
  assert.match(jobs, /onPress: \(\) => openSandbox\(sandbox\)/);
  // ⭐ D152 (8): the ATS item opens the match inside the open posting.
  assert.match(jobs, /onPress: \(\) => \{ closeSandbox\(\); openAtsPanel\(null\); \}/);
  assert.match(jobs, /enabled: !!sandbox,/);
  assert.match(jobs, /enabled: !!activeAts && !!selectedJob,/);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// BOARD CONTROL ROW CONSOLIDATION (was test/boardControlRowConsolidation.test.js)
// ⭐ A232 R6 (46y, owner 11-19 "all four approved"): test/boardControlRowConsolidation.test.js merged into this file (docs/A232_TEST_AUDIT.md §4 — 3 assertions shared word for word).
// Its tests follow in ONE block, so its own top-level names (it declares some of the same ones as above) stay its
// own. An assertion it repeated word for word is kept once — where it says the most — and named where it went.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
{
// The control row is gone as a ROW. Nothing that was in it was deleted.
//
// That distinction is the whole risk of this change, so it is asserted from both directions: each
// control must be ABSENT from the row, and PRESENT at its new home. A test that only checked the
// first half would pass just as happily on a commit that deleted them.
const read = (p) => fs.readFileSync(p, "utf8");
const panel   = read("client/src/panels/JobsPanel.jsx");
const app     = read("client/src/App.jsx");
const topBar  = read("client/src/components/TopBar.jsx");
const context = read("client/src/contexts/JobBoardContext.jsx");

test("the sort trigger sits in the board's ONE bar beside the views (D35: the filter trigger IS the sentence)", () => {
  assert.match(app, /function BoardControlIcons\(\)/);
  // D35 §3: the condensed bar — the views, the search, the sort square and + — one row, not a new one.
  // The Import button was removed by D11 (importing is the extension's job; test/d11FullHouseHeader
  // .test.js pins its absence), and D35 deleted the FILTER icon: the sentence's words are the filters
  // (test/d35FullHouseHeader.test.js pins that).
  // ⭐ D156 (5) changed this on purpose (D147 had put the sort in a title row and the views in its panel): the sort is an
  // ICON inside the search field, its small menu under the bar; the views are their own row under the search (BoardViews).
  const bar = app.slice(at(app, "function BoardBar()"), at(app, "function BoardViews("));
  assert.match(bar, /<BoardSearchBar><BoardControlIcons \/><\/BoardSearchBar>/);
  assert.match(bar, /<BoardSortSlot \/>/);
  assert.doesNotMatch(bar, /<BoardTabs \/>/);
  assert.match(app.slice(at(app, "function BoardViews("), at(app, "function BoardCounts()")), /<BoardTabs \/>/);
  // D49: in the StickyBar at the top of <main>, right after the header.
  assert.match(app.slice(at(app, '<header className="fh"'), at(app, "</main>")), /<StickyBar[^>]*>\s*<BoardBar \/>/);
  // And inside the provider, for the same reason BoardSearchBar is: AppDashboard renders
  // JobBoardProvider and cannot read it.
  assert.match(app, /function BoardControlIcons\(\) \{\s*\n\s*const \{[^}]*\} = useJobBoard\(\);/);
});

test("every sort option moved across intact — same values, same labels", () => {
  // A MOVE, not a redesign — still asserted, but no longer by scraping a literal array out of
  // App.jsx. X1 made SORTS in shared/jobFilterOptions.js the one definition of this dimension, and
  // App.jsx maps over it, so the seven pairs are checked against THAT. The old version read a
  // literal `const SORT_OPTIONS = [...]`; that is exactly the second copy X1 removed, and a test
  // that requires the copy to exist is a test that forbids the fix.
  //
  // D24 (10-04) IS a redesign, by decision: the sort icon opens THE SORT PANEL — Best fit · Newest ·
  // Salary · Company A–Z, shared/filterSentence.js's SORT_PANEL, each with its subtitle and visible
  // tie-break. SORTS stays what GET /api/jobs VALIDATES against, so the seven pairs must still be in
  // it (a subset now, not an exact list: the server half of D24 adds companyAsc to it).
  for (const pair of [["dateDesc", "Newest"], ["dateAsc", "Oldest"],
     ["compHigh", "Pay high to low"], ["compLow", "Pay low to high"],
     ["yoeLow", "Exp low to high"], ["yoeHigh", "Exp high to low"],
     ["atsScore", "ATS match"], ["companyAsc", "Company A–Z"]]) {
    assert.ok(SORTS.options.some(o => o.value === pair[0] && o.label === pair[1]),
      `the server's sort set lost ${pair.join(" / ")}`);
  }
  // ...and App.jsx renders the PANEL's list through the model, holding no copy of its own.
  assert.match(app, /sortRows\(atsSortAvailable\)/, "App.jsx no longer reads the sort panel's list");
  assert.ok(!/const SORT_OPTIONS\s*=/.test(app), "App.jsx holds its own sort list again");
  assert.ok(SORT_PANEL.length >= 4, "precondition: the sort panel offers its four orders");
  // One sort surface: the panel behind the icon, not a dropdown beside it.
  assert.ok(!/<UsbSelect\s*\n?\s*iconOnly/.test(app), "the old sort dropdown is back beside the panel");
});

test("NEW IN 24H and Save Search moved INTO the filters panel, and still exist", () => {
  // Absent from the row...
  // The region is taken from AFTER the explanatory comment closes, not from inside it. That note
  // NAMES every control that moved, so a region that began mid-comment would read the explanation
  // as the controls themselves — and no amount of comment-stripping fixes a slice that starts
  // after the opening delimiter.
  const marker = panel.indexOf("The control ROW is gone");
  assert.notEqual(marker, -1, "the note explaining the removed row is gone");
  const rowStart = panel.indexOf("*/}", marker) + 3;
  const rowRegion = panel.slice(rowStart, at(panel, "the \"N filters active\" chip and the \"567 jobs\" count are removed"));
  const rowCode = rowRegion.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const gone of [/New in 24h/i, /Save Search/i, /Filter loaded jobs/i, /ProfileSelectorDropdown/, /Pay high to low/]) {
    assert.ok(!gone.test(rowCode), `${gone} is back in the control row`);
  }
  // ...present in the panel, wired to the same things they always were.
  assert.match(panel, /<div style=\{labelStyle\}>Quick<\/div>/);
  assert.match(panel, /onClick=\{\(\) => setAgeFilter\(ageFilter === "1d" \? "" : "1d"\)\}/);
  assert.match(panel, /onSaveSearch=\{saveTrackedSearch\}/);
  assert.match(panel, /onApplySearch=\{applyTrackedSearch\}/);
  assert.match(panel, /onClearSearch=\{clearTrackedSearch\}/);
  assert.match(panel, /trackedSearch=\{activeDomainProfile\?\.tracked_search \|\| null\}/);
});

test("the two redundant controls are removed, and both are still reachable elsewhere", () => {
  // "Filter loaded jobs" wrote localSearch — the same state the main search bar's keyword field
  // writes. Removing the board's copy was safe because there were two others; the pill was one of
  // them and is now retired, so this points at the surviving one. That the reachability claim had to
  // be RE-POINTED rather than simply passing is the reason it is asserted at all.
  assert.ok(!/placeholder="Filter loaded jobs/.test(panel));
  // D35: the board's keyword field is the condensed bar's search (BoardBar.jsx), through BoardSearchBar.
  assert.match(read("client/src/components/BoardBar.jsx"),
    /* D149 (11-03) changed this on purpose: the sketch's words */ /placeholder="Search a company, title or skill"/,
    "nothing writes localSearch any more — the board's own input was removed as redundant to it");
  // The profile selector here was the third on screen. Of the two that remained, the pill's went
  // with the pill, leaving TopBar's avatar menu as the one place it lives.
  assert.ok(!/<ProfileSelectorDropdown/.test(panel));
  assert.match(topBar, /<ProfileSelectorDropdown/);
});

test("A74 (owner, 10-03): the count bar and the filters-active chip are GONE — the SENTENCE signals filters", () => {
  // Reverses the earlier "stay visible" call on the owner's word: "the filter icon already signals
  // active filters". D35 deleted the icon and its badge with it: the sentence now SHOWS every active
  // filter — a chosen clause is a filled word (aria-pressed) — so the board still cannot be narrowed
  // invisibly, which is the whole reason the badge was a requirement.
  assert.doesNotMatch(panel, /job\{totalJobs !== 1 \? "s" : ""\}/, "the job count is back");
  assert.doesNotMatch(panel, /\{activeFilterCount\} filter\{activeFilterCount === 1 \? "" : "s"\} active/, "the filters-active chip is back");
  const headline = fs.readFileSync("client/src/components/BoardHeadline.jsx", "utf8");
  assert.match(headline, /aria-pressed=\{s\.active \|\| !!s\.clause\.floor\}/, "an active filter no longer shows in the sentence");
  // The drawer's filters, which are not words, are counted on "+ add" ("salary & more · 2 on").
  assert.match(fs.readFileSync("client/src/lib/filterSentenceModel.js", "utf8"), /salary & more · \$\{otherFilterCount\} on/);
});

test("the badge counts the same filters the empty-board notice counts", () => {
  // One number, one derivation. If the badge and the notice could disagree, a board could be
  // filtered while the icon said it was not — which is exactly the state the badge exists to
  // prevent. Derived from defaultFilterSnapshot rather than a list, so a filter added later counts.
  assert.match(panel, /const activeFilterCount = useMemo\(\(\) => \{/);
  assert.match(panel, /const base = defaultFilterSnapshot\(\);/);
  assert.match(panel, /useEffect\(\(\) => \{ setActiveFilterCount\(activeFilterCount\); \}/);
  // Including the two committed filters the drawer does not own (the bar's Domain and Status).
  assert.match(panel, /\+ \(domainFilter \? 1 : 0\)/);
  assert.match(panel, /\+ \(appliedFilter \? 1 : 0\)/);
  assert.match(context, /const \[activeFilterCount, setActiveFilterCount\] = useState\(0\)/);
});

test("opening the panel still stages the committed filters and fetches facets", () => {
  // This used to be openFilterPanel(), called by the FILTERS button. The icon that replaced it can
  // only flip a shared flag — App.jsx has no access to pendingFilters or the facet fetch — so the
  // staging moved to an effect ON the flag, which means it cannot be bypassed by a trigger added
  // later. Keyed on the transition into `true`, or restaging would wipe in-progress edits.
  assert.match(panel, /useEffect\(\(\) => \{\s*\n\s*if \(!filtersOpen\) return;\s*\n\s*setPendingFilters\(activeFilterSnapshot\(\)\);\s*\n\s*fetchFacets\(\);/);
  assert.match(panel, /\}, \[filtersOpen\]\);/);
  assert.ok(!/openFilterPanel\(\)/.test(panel.replace(/^\s*\/\/.*$/gm, "")),
    "a second open path is back — staging must have exactly one");
  assert.match(panel, /const filtersOpen = filterPanelOpen;/);
});

test("the filters drawer is on the named tiers and inset clear of the nav", () => {
  // It was `position: fixed; inset: 0; zIndex: 500` — a raw number belonging to no tier in
  // client/src/styles/zLayers.js, and full-height under a TopBar at Z.NAV (1500). Measured at
  // 1440x900 with the drawer open: panel 0 -> 900, header 24 -> 54, close button a 9x27 box at
  // x 1411-1420 / y 26-53 overlapping the avatar at 1389-1419 / y 8-38 — and a hit-test at the
  // close button's own centre returned a nav <div>, not the button. Unclickable, not just cramped.
  //
  // zLayers' rule 2 is explicit that a raw bump is not the fix ("the question is which TIER it
  // belongs to").
  //
  // Y2 REVISED WHICH TIER, and the revision matters for a reason the first fix did not address.
  // Putting this drawer on MODAL_SCRIM / MODAL — the JD/PDF/ATS panels' own tiers — cleared the nav
  // but left TWO drawers on one tier, so opening a JD panel while the filters drawer was up left
  // which one won to render order. It has its own tier now, between the search surface and the
  // panels.
  assert.ok(!/position:"fixed", inset:0, zIndex:500/.test(panel),
    "the drawer is back on a raw z-index outside the scale");
  assert.match(panel, /position:"fixed", inset:0, zIndex:Z\.DRAWER_SCRIM/);
  assert.match(panel, /width:320, height:"100%", zIndex:Z\.DRAWER/);
  assert.match(panel, /import \{ Z \} from "\.\.\/styles\/zLayers\.js"/);

  // The clearance is padding on the SCRIM, so the dim still covers the whole viewport while the
  // panel inside it starts below the nav — a scrim that stopped at the nav would leave an
  // undimmed strip across the top of a modal surface.
  // No `px` after FILTER_DRAWER_TOP: it is a calc() string now, tracking the measured chrome, not a
  // number. FILTER_DRAWER_BOTTOM stays a number — there is nothing to measure it against.
  assert.match(panel, /padding:`\$\{FILTER_DRAWER_TOP\} 0 \$\{FILTER_DRAWER_BOTTOM\}px`/);
  assert.match(panel, /alignItems:"stretch"/);

  // The insets are PanelShell's own EXPORTED CONSTANTS now, not two literals that had to agree.
  // This test used to parse `top: (\d+)` out of PanelDock's geometry and check the drawer restated
  // the same number — which caught a drift but could not prevent one. Importing the constant makes
  // "the two drawers share a top edge" true by construction, so what is asserted is that both read
  // it rather than that two numbers happen to match.
  const shell = read("client/src/components/PanelShell.jsx");
  assert.match(shell, /export const PANEL_TOP_INSET = "calc\(var\(--app-chrome-height, 74px\) \+ 34px\)";/,
    "PanelDock's top inset is back to a literal, or no longer tracks the measured chrome");
  assert.match(shell, /export const PANEL_BOTTOM_INSET = 16;/);
  assert.match(shell, /\{ right: EDGE_GAP, top: PANEL_TOP_INSET, bottom: PANEL_BOTTOM_INSET,/,
    "PanelDock stopped using its own exported inset");
  assert.match(panel, /const FILTER_DRAWER_TOP = PANEL_TOP_INSET;/,
    "the filters drawer restates PanelDock's inset instead of importing it");
  assert.match(panel, /const FILTER_DRAWER_BOTTOM = PANEL_BOTTOM_INSET;/);
  assert.match(panel, /import \{ PanelScrim, PanelDock, PANEL_TOP_INSET, PANEL_BOTTOM_INSET \}/);
  // 46 + 34 is the 80 both surfaces used before, so today's geometry is preserved exactly. The
  // difference is that the 46 is now the bar's MEASURED height rather than a number that was right.
});

test("the drawer's close control is a real hit target with a real name", () => {
  // 9x27 was the width of the glyph alone, under the 24x24 minimum, and "x" is not an accessible
  // name.
  assert.match(panel, /aria-label="Close filters"/);
  assert.match(panel, /width:28, height:28, flexShrink:0, borderRadius:6/);
});
}

// Queue 29 — shared-element transitions (client/src/lib/viewTransitions.js).
// A job's title on the deck BECOMES the heading on the board's detail, BECOMES the line in the review
// queue: one view-transition-name, so the browser moves it instead of cutting.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at, lastAt } from "../test-support/sourceAnchors.js";

const VT = await import("../client/src/lib/viewTransitions.js");
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function el(id, { visible = true } = {}) {
  return { style: {}, getAttribute: (a) => (a === VT.TITLE_ATTR ? id : null), getClientRects: () => (visible ? [{}] : []) };
}
function withGlobals({ startViewTransition, reduced = false }, fn) {
  const had = { document: globalThis.document, window: globalThis.window };
  const calls = [];
  globalThis.document = { querySelectorAll: () => [], ...(startViewTransition ? { startViewTransition: (cb) => { calls.push("vt"); cb(); } } : {}) };
  globalThis.window = { matchMedia: (q) => ({ matches: reduced && /reduce/.test(q) }) };
  try { return fn(calls); } finally { globalThis.document = had.document; globalThis.window = had.window; }
}

test("a title's transition name is a valid CSS ident whatever the job id looks like", () => {
  assert.equal(VT.jobTitleTransitionName(123), "job-title-123");
  assert.equal(VT.jobTitleTransitionName("gh:abc/9 x"), "job-title-gh_abc_9_x");
});

test("⛔ ONE name per job at snapshot time — a duplicate makes the browser abandon the whole transition", () => {
  const a1 = el("7"), a2 = el("7"), hidden = el("8", { visible: false }), b = el("8");
  a2.style.viewTransitionName = "job-title-7";   // a stale name from an earlier transition
  const given = VT.nameSharedTitles({ querySelectorAll: () => [a1, a2, hidden, b] });
  assert.deepEqual(given, ["job-title-7", "job-title-8"]);
  assert.equal(a1.style.viewTransitionName, "job-title-7");
  assert.equal(a2.style.viewTransitionName, "", "the second line for the same job is cleared");
  assert.equal(hidden.style.viewTransitionName, "", "an element that is not rendered is never the one named");
  assert.equal(b.style.viewTransitionName, "job-title-8");
});

test("navigation runs inside a view transition where the browser supports it", () => {
  withGlobals({ startViewTransition: true }, (calls) => {
    const nav = [];
    VT.transitionTo((to) => { nav.push(to); calls.push("navigate"); }, "/app/jobs");
    assert.deepEqual(nav, ["/app/jobs"]);
    assert.deepEqual(calls, ["vt", "navigate"], "the route commits INSIDE the transition's update callback");
  });
});

test("⛔ the update callback WAITS for the route's commit — BrowserRouter commits navigations as React transitions", async () => {
  // Measured 10-01: with flushSync the callback returned before the transition-lane update
  // committed, so the browser snapshotted the old page twice and morphed nothing. Source tests passed.
  const src = read("client/src/lib/viewTransitions.js").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /flushSync/, "flushSync cannot force a startTransition update");
  assert.ok(VT.COMMIT_WAIT_MS <= 200, "the freeze before a transition may never be perceived delay");
  let pending;
  const had = { document: globalThis.document, window: globalThis.window };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = { querySelectorAll: () => [], startViewTransition: (cb) => { pending = cb(); } };
  try {
    let settled = false;
    VT.transitionTo(() => {}, "/x");
    pending.then(() => { settled = true; });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(settled, false, "the snapshot of the new page was taken before the route committed");
    VT.routeCommitted();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(settled, true);
    // …and never waits past the cap when nothing commits.
    let capped = false;
    VT.transitionTo(() => {}, "/y");
    pending.then(() => { capped = true; });
    await new Promise(r => setTimeout(r, VT.COMMIT_WAIT_MS + 60));
    assert.equal(capped, true);
  } finally { globalThis.document = had.document; globalThis.window = had.window; }
  const app = read("client/src/App.jsx");
  assert.match(app, /<BrowserRouter>\s*<RouteCommitSignal\/>/, "the signal must live INSIDE the router");
  assert.match(app, /function RouteCommitSignal\(\) \{\s*const location = useLocation\(\);\s*useLayoutEffect\(\(\) => \{ routeCommitted\(\); \}, \[location\.key\]\);/);
});

test("⛔ prefers-reduced-motion: no transition is started at all — and no support means a plain navigation", () => {
  withGlobals({ startViewTransition: true, reduced: true }, (calls) => {
    VT.transitionTo(() => calls.push("navigate"), "/app/auto-apply");
    assert.deepEqual(calls, ["navigate"]);
  });
  withGlobals({ startViewTransition: false }, (calls) => {
    VT.transitionTo(() => calls.push("navigate"), "/app/auto-apply");
    assert.deepEqual(calls, ["navigate"]);
  });
});

test("a modified click (new tab, new window) is left to the browser", () => {
  withGlobals({ startViewTransition: true }, (calls) => {
    const h = VT.transitionClick(() => calls.push("navigate"), "/x");
    let prevented = false;
    h({ button: 0, metaKey: true, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, false);
    assert.deepEqual(calls, []);
    h({ button: 0, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(calls, ["vt", "navigate"]);
  });
});

test("⛔ a transition never gates input, is short, and stops for reduced motion (index.css)", () => {
  const css = read("client/src/index.css");
  assert.match(css, /:root::view-transition \{ pointer-events: none; \}/);
  const dur = css.match(/::view-transition-new\(\*\) \{ animation-duration: (\d+)ms/);
  assert.ok(dur && +dur[1] <= 200, "a transition past ~200ms of perceived delay is a cost");
  const rm = css.slice(lastAt(css, "@media (prefers-reduced-motion: reduce)"));
  assert.match(rm, /::view-transition-group\(\*\)[\s\S]*animation: none !important/);
});

test("the three surfaces carry the shared title, and the tab row navigates through the transition", () => {
  assert.match(read("client/src/panels/DeckView.jsx"), /\{\.\.\.\(isFront \? \{ \[TITLE_ATTR\]: job\.id \} : null\)\}/, "the deck's FRONT card only");
  // D48: the panel's title is the masthead's now (the header is logo · company · ATS · ×), so the panel passes the
  // id down and the masthead's <h2> carries it; the deck's expanded copy passes none.
  assert.match((fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8") + fs.readFileSync("client/src/plate/OpeningSheet.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: JobDetailPanel.jsx deleted — its home now */, /vtTitle=\{selectedJob\.id\}/);
  assert.match(read("client/src/components/PostingPanel.jsx"), /<h2 className="posting__title" data-vt-title=\{vtTitle \?\? undefined\}>/);
  assert.doesNotMatch(read("client/src/panels/DeckView.jsx"), /vtTitle=/, "a second element of the same transition name");
  const queue = read("client/src/panels/AutoApplyPanelSections.jsx");
  // D113 UI: a Draft lands on its BUBBLE in Draft House's tree — the one element per job that is always on the page
  // (the table's row carries none — D146). The in-flight row keeps its own.
  assert.equal((queue.match(/data-vt-title=\{job\.jobId \|\| undefined\}/g) || []).length, 1, "the in-flight line");
  assert.match(read("client/src/components/CompanyBubble.jsx"), /data-vt-title=\{vtTitle \|\| undefined\}/);
  // ⭐ D146 (changed on purpose): a bubble no longer expands a branch here — it opens its row in the table.
  assert.match(read("client/src/components/DraftHouseTree.jsx"), /dataKey=\{node\.key\} vtTitle=\{node\.jobId\}/, "the tree's bubble");
  assert.doesNotMatch(read("client/src/components/ApplicationTracker.jsx"), /vtTitle/, "a second element of the same transition name");
  const app = read("client/src/App.jsx");
  const handler = app.slice(at(app, "const handlePanelChange = useCallback", 0, "tab handler"), at(app, "useInactivityLogout(handleLogout", 0, "next"));   // ⛔ 47j w1-shell (changed on purpose): handleProfileActivate left with the account panel
  // ⭐ D167 (changed on purpose, 45b `5104dbf`): Profile and Interview are places of their own — a third tab route, also
  // through the transition. The rule is the next line: no tab navigation bypasses it.
  assert.equal((handler.match(/transitionTo\(navigate,/g) || []).length, 3);
  assert.doesNotMatch(handler, /\bnavigate\(/, "a tab navigation that bypasses the transition");
  // ⛔ RR's `viewTransition` prop does nothing under the declarative <BrowserRouter> this app mounts.
  assert.match(app, /<BrowserRouter>/);
  assert.doesNotMatch(read("client/src/panels/DeckView.jsx"), /\bviewTransition\b(?!s)/, "a prop that looks wired and never runs");
});

test("where did that go: Draft flies to the Drafted counter, Pass drops BEHIND the fan", () => {
  const src = read("client/src/panels/DeckView.jsx");
  const leave = src.slice(at(src, "function leaveFor(", 0, "leaveFor"), at(src, "// ── the end of the deck", 0, "end"));
  assert.match(leave, /x: target\?\.dx \?\? \d+, y: target\?\.dy/, "the draft flight is aimed at the measured counter");
  assert.match(leave, /zIndex: Z\.FAN - \d+/, "a pass goes under the fan, by tier");
  assert.match(src, /counterRef\.current\?\.getBoundingClientRect/);
});

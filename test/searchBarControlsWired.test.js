// Every control the search bar RENDERS must reach the board.
//
// test/jobsBoardParamContract.test.js already guards the chain from buildParams outward: a param
// buildParams emits must be in the refetch effect's dep array, and must be read by the server. That
// test derives its names from buildParams itself, which is what makes it durable — and also what
// makes it structurally blind to this bug:
//
//   UnifiedSearchBar's five controls (keyword, location, Experience, Domain, Status) were wired to
//   `onSearch={() => {}}` / `onLocalFilter={() => {}}` in App.jsx. Nothing they produced ever
//   reached buildParams, so buildParams emitted no param for them, so there was no name for the
//   contract test to follow and it passed on all 1,143 assertions while the app's most prominent
//   surface was completely inert. Measured on the real board before the fix: typing a keyword, the
//   local click, the live click, and each of the three selects produced ZERO /api/jobs requests.
//
// So this file starts from the OTHER end — the rendered controls — and follows each one forward.
// A control added to the bar tomorrow and wired to nothing fails here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { EXPERIENCE_LEVELS, DOMAINS, values } from "../shared/jobFilterOptions.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8");
const app     = read("client/src/App.jsx");
const context = read("client/src/contexts/JobBoardContext.jsx");
const panel   = read("client/src/panels/JobsPanel.jsx");
const server  = read("server.js");

const stripComments = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
// 46v: the landing's UnifiedSearchBar (and UsbSelect) were deleted with the old landing (owner 11-18: A + the shelf + C);
// the tests that read them went with them. What they guarded on the server, the board and UsbSuggest stays below.

test("the bar's handlers are real functions that reach the board's one channel", () => {
  // Not "are they present" — they were always present. They were `() => {}`.
  assert.ok(!/onSearch=\{\(\) => \{\}\}/.test(app), "onSearch is a no-op");
  assert.ok(!/onLocalFilter=\{\(\) => \{\}\}/.test(app), "onLocalFilter is a no-op");
  // D26: the board's bar speaks for `query` only, so a search never resets the dials.
  assert.match(app, /applyBarFilters\(params, \{ fields: \["query"\] \}\)/);
  // A74: one click, one search — the board no longer has a "live" second click.
  assert.doesNotMatch(app, /applyBarFilters\(params, \{ live: true \}\)/);
  // ...and that channel actually exists on the context both sides share.
  assert.match(context, /const applyBarFilters = useCallback/);
  assert.match(context, /barFilters, applyBarFilters, liveSearchTick,/);
});

test("the bar's wrapper sits inside JobBoardProvider, not above it", () => {
  // AppDashboard RENDERS <JobBoardProvider>, so a useJobBoard() call in AppDashboard itself reads a
  // null context and throws on destructure. The handlers therefore have to come from a component
  // rendered inside the provider — that is the only reason BoardSearchBar exists, and inlining it
  // back into AppDashboard would crash the dashboard.
  // `{ tabs, ...props }` was the signature while this wrapper also DECORATED the tab row with the
  // Auto Apply needs-review count. Y4 moved the tab row into the top bar, so the decoration moved
  // with it to AppTopBar — which exists for exactly the same reason, one provider down. This wrapper
  // is now only about applyBarFilters.
  // 45l D179 (a) (f3711eae): the wrapper also reads the board's headline from the same context (pin moved on purpose).
  assert.match(app, /function BoardSearchBar\(props\) \{\s+const \{ applyBarFilters, boardHeadline \} = useJobBoard\(\);/);
  // The SAME constraint applies to the count, and it is the reason there are two wrappers rather
  // than one: AppDashboard renders AutoApplyProvider too, so it cannot read that context either.
  assert.match(app, /function AppTopBar\(\{ tabs, \.\.\.props \}\) \{\s+const \{ needsAttentionCount = 0 \} = useAutoApply\(\);/);
  const dashboard = app.slice(at(app, "function AppDashboard"));
  assert.ok(
    !/const \{[^}]*\} = useJobBoard\(\)/.test(dashboard.slice(0, at(dashboard, "<JobBoardProvider>"))),
    "AppDashboard calls useJobBoard above the provider it renders — that context is null",
  );
});

test("the live half of the double-click is keyed on a counter, not a boolean or the params", () => {
  // Two live searches for the same terms must both run. A boolean latches; keying on barFilters
  // would make an unchanged query a no-op the second time.
  assert.match(context, /const \[liveSearchTick, setLiveSearchTick\] = useState\(0\)/);
  assert.match(context, /if \(live\) setLiveSearchTick\(t => t \+ 1\)/);
  assert.match(panel, /\}, \[liveSearchTick\]\);/);
  // And it must not fire on mount — an aggregator search nobody asked for, on every board load.
  assert.match(panel, /if \(!liveSearchReady\.current\) \{ liveSearchReady\.current = true; return; \}/);
});

test("Status fans out to three separate dimensions, each reset when it is not selected", () => {
  // One select, three unrelated filters. Switching Starred -> New has to leave the board on New
  // alone; a truthy-only assignment would leave it on both.
  const a = panel.indexOf('setBoardTab(status === "starred" ? "saved" : "all");');
  assert.notEqual(a, -1, "the Status mapping moved");
  const block = panel.slice(a, a + 260);
  assert.match(block, /setAgeFilter\(status === "new" \? "1d" : ""\)/);
  assert.match(block, /setAppliedFilter\(status === "applied" \? "1" : ""\)/);
});

test("the two params the bar newly needs are honoured by the server", () => {
  // jobsBoardParamContract.test.js proves the server READS every param buildParams emits. These two
  // additionally have to produce a real WHERE clause bound to the right column — `starred` was read
  // and unclaused for the whole life of that bug.
  assert.match(server, /const domSql\s+= domain \? `AND \(sj\.bucket_domain IS NULL OR sj\.bucket_domain = \?\)` : '';/);
  assert.match(server, /\$\{domSql\}/, "domSql is built but never spliced into the WHERE clause");
  assert.match(server, /\.\.\.catArgs, \.\.\.domArgs,/, "domArgs must sit with its clause or every later binding shifts");

  // applied reads the per-(user, profile) join, never sj.* — one user's record of what they did.
  assert.match(server, /const appliedSql = applied === '1' \? `AND uj\.applied = 1` : '';/);
  assert.match(server, /\$\{appliedSql\}/, "appliedSql is built but never spliced into the WHERE clause");
  assert.ok(!/appliedArgs/.test(server), "appliedSql must stay parameterless or baseArgs ordering shifts");
});

test("applying the bar's filters does not fire a redundant second request", () => {
  // `setExperienceLevels(experience ? [experience] : [])` allocated a FRESH array on every apply,
  // so even with the Experience select untouched React saw a new value — and `experienceLevels` is
  // in the refetch effect's dep array, which fired a second /api/jobs alongside the debounced one
  // the keyword search already sends. Measured on the real board: one click on Search produced two
  // identical requests for `localSearch=software+engineer`.
  //
  // The array is the only value in this effect that can change identity without changing meaning;
  // every other setter takes a string. So the guard belongs on it specifically.
  const a = panel.indexOf('const { query = "", location = "", experience = "", domain = "", status = "" } = bf');
  assert.notEqual(a, -1, "the bar-filter mapping effect moved");
  const effect = panel.slice(a, a + 1600);
  assert.ok(!/setExperienceLevels\(experience \? \[experience\] : \[\]\)/.test(effect),
    "the fresh-array assignment is back — every bar search sends two requests");
  assert.match(effect, /setExperienceLevels\(prev => \{/);
  assert.match(effect, /return same \? prev : next;/);
});

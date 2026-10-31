// ⭐ D113 UI (owner 10-31) · DRAFT HOUSE IS A VERTICAL TREE THAT GROWS INLINE, with a side column for what matters
// now (docs/sketches/draft-house-tree.html; the WORKLOG row wins). U1–U10 and THE BUBBLE STANDARD.
//
// The rules are pure (client/src/lib/draftHouseTree.js) and tested as data; the components are RENDERED
// (esbuild + react-dom/server, as test/d61CompanyLogo does) and their handlers CALLED from the element tree —
// the tree, the side column and the bubble take every piece of state as a prop, so no browser is needed.
// Synthetic companies and jobs only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { LADDER } from "../shared/applicationStatus.js";
import { THEME_LIST } from "../client/src/themes/index.js";
import {
  RINGS, RING_ORDER, LADDER_RING, ringFor, FILTERS, buildNodes, buildTree, treeView, sideBlocks, SIDE_ORDER,
  branchStep, createLeafCache, answerRows, inlineAnswerStart, leftOutLines, nextRunFromSettings, matchesSearch,
} from "../client/src/lib/draftHouseTree.js";
import { loadRuns, loadLeftOut, actOnPick, makePickResume, D113_ROUTES } from "../client/src/lib/draftHouseRuns.js";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import picksConfirmRoutes from "../routes/picksConfirm.js";
import { draftSlots } from "../services/draftSlots.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
const panel = read("client/src/panels/AutoApplyPanel.jsx");
const treeSrc = read("client/src/components/DraftHouseTree.jsx");
const sideSrc = read("client/src/components/DraftHouseSide.jsx");
const drawer = read("client/src/components/AutoSettingsDrawer.jsx");
const css = read("client/src/components/DraftHouse.css");
const bubbleCss = read("client/src/components/CompanyBubble.css");
const bubbleSrc = read("client/src/components/CompanyBubble.jsx");

// ── rendering ────────────────────────────────────────────────────────────────────────────────
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import DraftHouseTree, { Branch, LeadCard, Leaf, RunCard } from ${abs("components/DraftHouseTree.jsx")};
        import DraftHouseSide from ${abs("components/DraftHouseSide.jsx")};
        import CompanyBubble from ${abs("components/CompanyBubble.jsx")};
        export const html = (C, props) => renderToStaticMarkup(createElement(C, props));
        export { createElement, DraftHouseTree, DraftHouseSide, CompanyBubble, Branch, LeadCard, Leaf, RunCard };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d113ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}
/** Every element in a React element tree (host and component elements, not expanded). */
function* walk(el) {
  if (el == null || typeof el !== "object") return;
  if (Array.isArray(el)) { for (const c of el) yield* walk(c); return; }
  yield el;
  yield* walk(el.props?.children);
}
const count = (s, needle) => s.split(needle).length - 1;

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────
const NOW = Date.UTC(2026, 9, 31, 15, 0);
const HOUR = 3600000;
const label = (c) => c || "Unknown company";
function fixtureNodes() {
  return buildNodes({
    now: NOW, companyLabel: label,
    pending: [{ runJobId: 11, runId: 1, jobId: "j-review", company: "Northwind", title: "Backend Engineer", createdAt: (NOW - 2 * HOUR) / 1000, answerCount: 22, guessCount: 2 }],
    heldApplications: [{ key: "a-q", jobId: "j-ask", company: "Halcyon", title: "ML Engineer", reasons: [], rows: [{ id: 21, runId: 2 }],
      primary: { row: { id: 21, runId: 2, createdAt: NOW - 3 * HOUR, reasonCode: "needs_input" } } }],
    questions: [{ question: "Earliest start date", blocking: [{ jobId: "j-ask" }] }],
    inFlight: [{ id: 31, runId: 3, jobId: "j-work", company: "Quanta", title: "Platform Engineer", status: "running", startedAt: NOW - HOUR }],
    brokeApplications: [{ key: "a-b", jobId: "j-old", company: "Basalt", title: "SWE", rows: [{ id: 41 }],
      primary: { obstacle: "The browser crashed.", row: { id: 41, runId: 4, finishedAt: NOW - 9 * 24 * HOUR, reasonCode: "internal_error" } } }],
    tableRows: [
      { id: 51, jobId: "j-sent", company: "Lumen", title: "Data Engineer", status: "submitted", updatedAt: (NOW - 26 * HOUR) / 1000 },
      { id: 52, jobId: "j-int", company: "Vireo", title: "SWE II", status: "interview", updatedAt: (NOW - 30 * HOUR) / 1000 },
      { id: 53, jobId: "j-no", company: "Kestrel", title: "SWE", status: "rejected", updatedAt: (NOW - 50 * HOUR) / 1000 },
    ],
    picks: [{ id: 61, runId: 7, jobId: "j-pick", company: "Orchard", title: "Full Stack Engineer", state: "offered", line: "Good match · you're eligible" }],
  });
}
const RUN = { id: 7, slotAt: (NOW - 7 * HOUR) / 1000, mode: "ask", seen: 214, picked: 4,
  leftOut: { outside_filters: 21, ineligible: 9, stale: 6, daily_cap: 2, company: 0, level: 0 }, leftOutTotal: 38,
  picks: [{ id: 61, jobId: "j-pick", state: "offered" }, { id: 62, jobId: "j-review", state: "applied" }] };

// ── the tests ────────────────────────────────────────────────────────────────────────────────

test("d113uiRingFromLadder — every ladder status maps to exactly one ring; no second status model", () => {
  assert.deepEqual(Object.keys(LADDER_RING).sort(), [...LADDER].sort(), "the map covers the ladder, and nothing else");
  for (const s of LADDER) {
    const r = ringFor(s);
    assert.ok(RING_ORDER.includes(r), `${s} → ${r}`);
    assert.equal(RING_ORDER.filter(x => x === r).length, 1);
  }
  assert.equal(ringFor("not_a_status"), null);
  assert.equal(ringFor("picked"), null, "Picked is a D113 pick, not a ladder status");
  // The seven rings, each a token; the ladder reaches all but Picked.
  assert.deepEqual(RING_ORDER, ["need", "review", "pick", "work", "sent", "reply", "stop"]);
  assert.deepEqual([...new Set(LADDER.map(ringFor))].sort(), ["need", "reply", "review", "sent", "stop", "work"]);
  // The nodes read the ladder through ladderStatus — the panel writes no status words of its own.
  const lib = read("client/src/lib/draftHouseTree.js");
  assert.match(lib, /import \{ LADDER, ladderStatus \} from "\.\.\/\.\.\/\.\.\/shared\/applicationStatus\.js";/);
  const byJob = Object.fromEntries(fixtureNodes().map(n => [n.jobId, n.ring]));
  assert.deepEqual(byJob, { "j-review": "review", "j-ask": "need", "j-work": "work", "j-old": "stop",
    "j-sent": "sent", "j-int": "reply", "j-no": "reply", "j-pick": "pick" });
});

test("d113uiReviewRingDistinct — Ready for your review is its own ring, its own colour in all four themes", () => {
  assert.equal(ringFor("ready_to_approve"), "review");
  assert.notEqual(ringFor("ready_to_approve"), ringFor("needs_you"));
  assert.equal(RINGS.review.label, "Ready for your review");
  assert.notEqual(RINGS.review.token, RINGS.need.token);
  for (const t of THEME_LIST) {
    assert.notEqual(t.tokens[RINGS.review.token].toLowerCase(), t.tokens[RINGS.need.token].toLowerCase(), `${t.id}: amber = orange`);
  }
});

test("d113uiOneBranchOpen — opening another closes the first; the same one toggles; Escape closes; one branch renders", async () => {
  let open = null;
  open = branchStep(open, { type: "job", key: "a" });
  assert.deepEqual(open, { type: "job", key: "a" });
  open = branchStep(open, { type: "job", key: "b" });
  assert.deepEqual(open, { type: "job", key: "b" }, "a second bubble closes the first");
  open = branchStep(open, { type: "run", key: "run-7" });
  assert.deepEqual(open, { type: "run", key: "run-7" }, "a run's branch closes a job's");
  assert.equal(branchStep(open, { type: "run", key: "run-7" }), null, "pressing the open one closes it");
  assert.equal(branchStep({ type: "job", key: "a" }, { type: "escape" }), null);
  assert.match(panel, /if \(e\.key === "Escape" && !settingsOpen && !applyRunDetailOpen\) setOpen\(null\);/);

  const { html, DraftHouseTree, Branch } = await loadUi();
  const nodes = fixtureNodes();
  const view = treeView(buildTree({ runs: [RUN], nodes, now: NOW, timeZone: "UTC" }), {});
  const props = (o) => ({ view, open: o, renderJobBranch: (n) => Branch({ ring: n.ring, children: n.key }), renderRunBranch: (r) => Branch({ children: r.key }) });
  const one = html(DraftHouseTree, props({ type: "job", key: nodes.find(n => n.jobId === "j-sent").key }));
  assert.equal(count(one, "data-branch=\"\""), 1, "exactly one branch");
  const run = html(DraftHouseTree, props({ type: "run", key: "run-7" }));
  assert.equal(count(run, "data-branch=\"\""), 1);
  assert.equal(count(html(DraftHouseTree, props(null)), "data-branch=\"\""), 0);
  // The bubble's own press asks for exactly that branch.
  const seen = [];
  const el = DraftHouseTree({ view, open: null, onOpen: (a) => seen.push(a) });
  const bubble = [...walk(el)].find(e => e.props?.dataKey === nodes.find(n => n.jobId === "j-int").key);
  bubble.props.onClick();
  assert.deepEqual(seen, [{ type: "job", key: nodes.find(n => n.jobId === "j-int").key }]);
});

test("d113uiRunBranchCountsByReason — a run's card: picked, left out, and the counts BY REASON from P1", async () => {
  const tree = buildTree({ runs: [RUN], nodes: fixtureNodes(), now: NOW, timeZone: "UTC" });
  const run = tree.find(r => r.real);
  assert.equal(run.seen, 214);
  assert.equal(run.leftOutTotal, 38);
  assert.deepEqual(run.nodes.map(n => n.jobId).sort(), ["j-pick", "j-review"], "a run carries ITS picks' jobs");
  const lines = leftOutLines(run.leftOut);
  assert.deepEqual(lines.map(l => [l.reason, l.n]), [["outside_filters", 21], ["ineligible", 9], ["stale", 6], ["daily_cap", 2]],
    "largest first, zeros left out");
  assert.deepEqual(lines.map(l => l.label), ["outside your filters", "not eligible", "stale or reposted", "over today's limit"]);
  const { html, RunCard } = await loadUi();
  const out = html(RunCard, { run, lines });
  assert.match(out, /Picked 4, left out 38\./);
  assert.match(out, /Looked at 214 new postings/);
  for (const l of lines) assert.match(out, new RegExp(`data-reason="${l.reason}"><b>${l.n}</b><span>left out: ${l.label.replace("'", "&#x27;")}`));
  assert.match(out, /Change filters/);
  assert.match(out, /See what was left out/);
  // "See what was left out" asks the run's own list (14 days), through the ONE adapter.
  assert.equal(D113_ROUTES.leftOut(7), "/api/picks/runs/7/left-out");
  assert.match(panel, /const d = await loadLeftOut\(run\.id\);/);
});

test("d113uiLeavesLazy — a leaf's data loads only when the leaf is opened, once", async () => {
  const calls = [];
  const cache = createLeafCache(async (k) => { calls.push(k); return { k }; });
  assert.equal(cache.get(21).state, "idle");
  assert.equal(calls.length, 0, "nothing is asked for before the leaf opens");
  let changed = 0;
  cache.open(21, () => changed++);
  cache.open(21, () => changed++);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls, [21], "asked once");
  assert.equal(cache.get(21).state, "ready");
  assert.equal(changed, 1);
  const { html, Leaf, createElement } = await loadUi();
  const closed = html(Leaf, { id: "answers", label: "Answers", open: false, children: createElement("i", null, "BODY") });
  assert.doesNotMatch(closed, /BODY|data-leaf-body/, "a closed leaf renders no body — so its loader never mounts");
  assert.match(html(Leaf, { id: "answers", label: "Answers", open: true, children: createElement("i", null, "BODY") }), /data-leaf-body="answers"><i>BODY/);
  // The panel's Answers body asks the cache from an effect INSIDE the leaf's body.
  const body = panel.slice(at(panel, "const AnswersBody = ({ node }) => {"), at(panel, "const leavesFor = (node) => {"));
  assert.match(body, /useEffect\(\(\) => \{ if \(id != null\) answersCache\.current\.open\(id, /);
  assert.match(panel, /<Leaf key=\{l\.id\} id=\{l\.id\} label=\{l\.label\} sub=\{l\.sub\} open=\{leaves\.has\(lid\)\}/);
});

test("d113uiAttestationNeverFilled — the user's own statement is marked and its value never shown as filled", () => {
  const rows = answerRows([
    { label: "Years of Python", value: "5", provenance: "field_map_exact" },
    { label: "Are you open to relocation?", value: "Yes", provenance: "label_fuzzy" },
    { label: "I certify the information above is true and complete", value: "Yes", provenance: "custom_answer" },
    { label: "Skipped", value: "x", skipped: true },
  ], [{ question: "Are you legally authorised to work here?", eligibility: true }]);
  const by = Object.fromEntries(rows.map(r => [r.label, r]));
  assert.equal(by["Years of Python"].shown, "5");
  assert.equal(by["Are you open to relocation?"].guess, true, "a loose match is flagged 'read this'");
  const own = by["I certify the information above is true and complete"];
  assert.equal(own.own, true);
  assert.equal(own.value, null, "the stored value is NOT shown as filled");
  assert.equal(own.shown, "left for you");
  assert.equal(own.guess, false);
  assert.equal(by["Are you legally authorised to work here?"].own, true, "an eligibility question is the user's");
  assert.equal(by["Are you legally authorised to work here?"].value, null);
  assert.ok(!rows.some(r => r.label === "Skipped"));
  // The inline box never starts with a value the system seeded for an own statement; a guess IS shown to confirm.
  assert.equal(inlineAnswerStart({ question: "I attest that I am over 18", proposed: "Yes" }, "Yes"), "");
  assert.equal(inlineAnswerStart({ question: "Work authorisation", eligibility: true, proposed: "Yes" }, "Yes"), "");
  assert.equal(inlineAnswerStart({ question: "Work authorisation", eligibility: true, proposed: "Yes" }, "No"), "No", "what the person typed stays");
  assert.equal(inlineAnswerStart({ question: "Notice period", proposed: "2 weeks" }, "2 weeks"), "2 weeks");
  // …and the panel clears a seeded own-statement draft before Answer can send it.
  assert.match(panel, /if \(ask && ask\.proposed != null && isOwnStatement\(ask, \[ask\]\) && questionDrafts\?\.\[ask\.question\] === ask\.proposed\)/);
  assert.match(panel, /value=\{inlineAnswerStart\(ask, questionDrafts\?\.\[ask\.question\]\)\}/);
});

test("d113uiFilterHidesEmptyRuns — outside All, a run with no match is hidden; the next run stays", () => {
  const tree = buildTree({ runs: [RUN], nodes: fixtureNodes(), now: NOW, nextRunAt: NOW + 2 * HOUR, timeZone: "UTC" });
  const all = treeView(tree, { filter: "all" });
  assert.equal(all.length, tree.length, "All shows every run");
  const stopped = treeView(tree, { filter: "stop" });
  assert.ok(stopped[0].run.future, "the next-run square is always shown");
  const shown = stopped.filter(v => !v.run.future);
  assert.ok(shown.length >= 1 && shown.length < all.length - 1, "runs without a stopped job are gone");
  assert.ok(shown.every(v => v.items.length > 0 && v.items.every(i => i.node.ring === "stop")));
  assert.ok(!treeView(tree, { filter: "mine" }).some(v => !v.run.future && v.items.some(i => !["need", "review", "pick"].includes(i.node.ring))));
  assert.deepEqual(FILTERS.map(f => f[1]), ["All", "Needs you", "Running", "Sent and replies", "Stopped"]);
});

test("d113uiSearchDimsInAll — in All a miss is dimmed, not hidden; elsewhere it is hidden", async () => {
  const tree = buildTree({ runs: [RUN], nodes: fixtureNodes(), now: NOW, timeZone: "UTC" });
  const view = treeView(tree, { filter: "all", q: "lumen" });
  const items = view.flatMap(v => v.items);
  assert.equal(items.length, fixtureNodes().length, "nothing is hidden in All");
  assert.deepEqual(items.filter(i => !i.dim).map(i => i.node.company), ["Lumen"]);
  assert.equal(view.length, tree.length, "no run is hidden in All");
  assert.equal(treeView(tree, { filter: "done", q: "lumen" }).flatMap(v => v.items).length, 1);
  // The search reads the reason too (the node's sentence), through the one narrowing Stopped always had.
  assert.ok(matchesSearch(fixtureNodes().find(n => n.jobId === "j-ask"), "start date"));
  const { html, DraftHouseTree } = await loadUi();
  const out = html(DraftHouseTree, { view });
  assert.equal(count(out, 'data-dim="true"'), items.length - 1);
});

test("d113uiSideOrderAndEmpty — connections, Needs you, review, running, replies, tidy; empty blocks left out but Needs you", async () => {
  const nodes = fixtureNodes();
  const blocks = sideBlocks({ nodes, connections: [{ key: "gmail", title: "Gmail disconnected", sub: "x", fixLabel: "Reconnect Gmail" }], now: NOW });
  assert.deepEqual(blocks.map(b => b.id), SIDE_ORDER);
  assert.deepEqual(blocks.find(b => b.id === "needs").items.map(n => n.jobId), ["j-ask", "j-pick"], "questions first, then picks");
  assert.deepEqual(blocks.find(b => b.id === "replies").items.map(n => n.jobId), ["j-int"], "rejections excluded");
  assert.equal(blocks.find(b => b.id === "tidy").count, 1, "one stopped job older than 7 days");
  const empty = sideBlocks({ nodes: [], now: NOW });
  assert.deepEqual(empty.map(b => b.id), ["needs"], "only Needs you stays when empty");
  assert.deepEqual(sideBlocks({ nodes: [], binCount: 2, now: NOW }).map(b => b.id), ["needs", "tidy"], "a full bin keeps Tidy up");
  const { html, DraftHouseSide } = await loadUi();
  assert.match(html(DraftHouseSide, { blocks: empty }), /Nothing\. It&#x27;s all running\./);
  const out = html(DraftHouseSide, { blocks });
  const order = ["data-side-block=\"connections\"", "data-side-block=\"needs\"", "data-side-block=\"review\"", "data-side-block=\"running\"", "data-side-block=\"replies\"", "data-side-block=\"tidy\""];
  const idx = order.map(o => out.indexOf(o));
  assert.ok(idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1])), "rendered in order");
  assert.match(out, /1 stopped job older than 7 days\./);
});

test("d113uiSideOpensBranch — a side row opens the same branch in the tree and scrolls to it", async () => {
  const nodes = fixtureNodes();
  const blocks = sideBlocks({ nodes, now: NOW });
  const { DraftHouseSide } = await loadUi();
  const opened = [];
  const el = DraftHouseSide({ blocks, onOpen: (n) => opened.push(n.key) });
  const row = [...walk(el)].find(e => e.props?.["data-side-item"] === nodes.find(n => n.jobId === "j-review").key);
  row.props.onClick();
  assert.deepEqual(opened, [nodes.find(n => n.jobId === "j-review").key]);
  // The panel opens THAT node's branch (the same key the tree's bubble uses), clears a filter hiding it, and scrolls.
  const fn = panel.slice(at(panel, "const openFromSide = (node) => {"), at(panel, "const toggleLeaf"));
  assert.match(fn, /setOpen\(\{ type: "job", key: node\.key \}\)/);
  assert.match(fn, /setFilter\("all"\); setQ\(""\);/);
  assert.match(fn, /\[data-key="\$\{CSS\.escape\(node\.key\)\}"\]/);
  assert.match(fn, /scrollIntoView/);
  assert.match(panel, /<DraftHouseSide blocks=\{blocks\} onOpen=\{openFromSide\}/);
  assert.match(treeSrc, /dataKey=\{node\.key\}/);
});

test("d113uiApproveAllInsideReviewAll — the side carries Review all only; Approve all is inside it, with two confirms", () => {
  assert.doesNotMatch(panel, /confirmSendAll|data-send-all/, "no Approve all in the page's chrome");
  const side = panel.slice(at(panel, "const sideExtra = {"), at(panel, "running: (applyLine.waiting"));
  assert.match(side, /<button onClick=\{openEverything\}[^>]*data-review-all=""/);
  assert.doesNotMatch(code(side), /Approve all/);
  const modal = panel.slice(at(panel, "Apply Runs Review Modal"));
  assert.match(modal, /scopedPending\.length > 1 && \(\s*confirmApproveAll \? \(/, "press one asks");
  assert.match(modal, /onClick=\{\(\) => setConfirmApproveAll\(true\)\}/);
  assert.match(modal, /Send all \{scopedPending\.length\} to their employers\?/);
  assert.match(modal, /onClick=\{\(\) => decidePending\(scopedPending\.map\(p => p\.runJobId\), true\)\}[\s\S]{0,400}Yes, send all/, "press two sends");
  assert.match(modal, /onClick=\{\(\) => setConfirmApproveAll\(false\)\}[\s\S]{0,400}Cancel/);
});

test("d113uiNoSelectMode — select mode is gone; Review all covers the one bulk use; each job clears in its branch", () => {
  for (const src of [panel, treeSrc, sideSrc].map(code)) {
    assert.doesNotMatch(src, /Done selecting|setSelecting|selectable=|selectedIds|type="checkbox"[^>]*Select/);
  }
  assert.ok(!fs.existsSync("client/src/components/StoppedItem.jsx"), "the stopped item and its checkbox are gone");
  assert.ok(!fs.existsSync("client/src/components/DraftRunBar.jsx"), "the separate run bar is gone");
  assert.match(panel, /case "approval":[\s\S]{0,700}clearRunJobs\(\{ runJobIds: \[r\.runJobId\] \}\)/, "a job clears from its branch");
  assert.match(panel, /onClick=\{\(\) => confirmOlder\(30\)\}/, "Clear older than… stays (Tidy up)");
});

test("d113uiOneSettingsDrawer — ONE drawer, three groups in order, D113's switches and the accounts in it", () => {
  assert.ok(!fs.existsSync("client/src/components/PortalsDrawer.jsx"), "the Portals drawer merged in");
  assert.equal(count(panel, "<AutoSettingsDrawer "), 1);
  assert.doesNotMatch(panel, /PortalsDrawer|portalsOpen/);
  const groups = [...drawer.matchAll(/data-settings-group="(\w+)"/g)].map(m => m[1]);
  assert.deepEqual(groups, ["when", "jobs", "accounts"]);
  for (const h of ["When and how much", "Which jobs", "Accounts on job sites"]) assert.match(drawer, new RegExp(`>${h}</h3>`));
  const when = drawer.slice(at(drawer, 'data-settings-group="when"'), at(drawer, 'data-settings-group="jobs"'));
  for (const w of ["Applications a day, at most", "When to look for new jobs", "Picks arrive by", "Show me the form before sending"]) assert.ok(when.includes(w), w);
  assert.match(when, /onChange=\{\(\) => set\(\{ showFormBeforeSending: !s\.showFormBeforeSending \}\)\}/);
  const jobs = drawer.slice(at(drawer, 'data-settings-group="jobs"'), at(drawer, 'data-settings-group="accounts"'));
  for (const w of ["Start from my board filters", "Limit applications per company", "Skip a company after it interviews me", "Skip stale or reposted jobs"]) assert.ok(jobs.includes(w), w);
  const acc = drawer.slice(at(drawer, 'data-settings-group="accounts"'));
  assert.match(acc, /<Accounts \/>/);
  assert.match(acc, /Agree to a job site's terms for me/);
  assert.match(drawer, /Gmail, for codes and replies/);
  // The header's one Settings button and the run card's Change filters open it (at Which jobs).
  assert.match(panel, /onChangeFilters=\{\(e\) => openSettings\("jobs", e\?\.currentTarget\)\}/);
});

test("d113uiReducedMotionNoPulse — needs you, review and working pulse; reduced motion stops it", async () => {
  assert.deepEqual(RING_ORDER.filter(r => RINGS[r].pulse), ["need", "review", "work"]);
  assert.match(bubbleCss, /\.cb\[data-pulse="true"\] \.cb__ring \{ animation: cb-pulse /);
  const rm = bubbleCss.slice(at(bubbleCss, "@media (prefers-reduced-motion: reduce)"));
  assert.match(rm, /\.cb\[data-pulse="true"\] \.cb__ring \{ animation: none; \}/);
  assert.match(rm, /\.cb \{ transition: none; \}/);
  const { html, CompanyBubble } = await loadUi();
  assert.match(html(CompanyBubble, { company: "Northwind", ring: "need" }), /data-pulse="true"/);
  assert.doesNotMatch(html(CompanyBubble, { company: "Northwind", ring: "sent" }), /data-pulse/);
});

test("d113uiFourThemes — every ring is a token in all four themes, seven distinct colours; contrast themes outline", async () => {
  assert.equal(THEME_LIST.length, 4);
  for (const t of THEME_LIST) {
    const vals = RING_ORDER.map(r => t.tokens[RINGS[r].token]);
    for (const [i, v] of vals.entries()) assert.match(String(v), /^#[0-9a-fA-F]{6}$/, `${t.id} ${RING_ORDER[i]}`);
    assert.equal(new Set(vals.map(v => v.toLowerCase())).size, 7, `${t.id}: two rings share a colour`);
  }
  // Tokens only: the bubble and the tree paint with var(--c-*) and no literal (colorLiteralGuard holds the rest).
  for (const src of [bubbleCss, css]) assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  const { html, CompanyBubble } = await loadUi();
  assert.match(html(CompanyBubble, { company: "Northwind", ring: "review" }), /--cb-ring:var\(--c-warning\)/);
  // The bubble standard: a rounded square (never a pill — D60), the ONE logo component inside, one ring of its shape.
  assert.match(bubbleCss, /--cb-r: calc\(var\(--cb-size\) \* 0\.27\)/);
  assert.doesNotMatch(bubbleCss, /999px|radius:\s*50%/);
  assert.match(bubbleSrc, /import CompanyLogo from "\.\/CompanyLogo\.jsx";/);
  assert.equal(count(html(CompanyBubble, { company: "Northwind", ring: "stop" }), "cb__ring"), 1);
  assert.match(bubbleCss, /:root\[data-contrast="aaa"\] \.cb \{ box-shadow: 0 0 0 2px var\(--c-ink\); \}/, "contrast themes swap the shadow for an outline");
});

test("d113uiNarrow — below 900 px: one column, the side column on top, branches indent 16 px, actions wrap", () => {
  const narrow = css.slice(at(css, "@media (max-width: 899px) {"), at(css, "/* ── U3 · THE TREE"));
  assert.match(narrow, /\.dh-main, \.dh-main\[data-detail="true"\] \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(narrow, /\.dh-main > \.dhs, \.dh-main > \.dh-detail \{ order: -1;/);
  assert.match(narrow, /\.dht-branch \{ margin-left: 16px; \}/);
  assert.match(narrow, /\.dht-acts \{ flex-wrap: wrap; \}/);
  assert.match(css, /\.dh-main \{\n  display: grid; grid-template-columns: minmax\(0, 1fr\) 340px;/, "wide: the side column is 340 px");
  // DOM order is tree then side: the tree keeps the same order on a phone, the side is lifted by CSS only.
  assert.ok(at(panel, "<DraftHouseTree view={view}") < at(panel, "<DraftHouseSide blocks={blocks}"));
});

// ── the adapter: D113's routes in ONE place, degrading when they are not there ─────────────────

test("D113 UI · the adapter falls back when the runs route 404s, and the next run comes from Auto settings", async () => {
  const notFound = async () => { throw Object.assign(new Error("Request failed (404)"), { status: 404 }); };
  assert.deepEqual(await loadRuns({}, notFound), { available: false, runs: [], nextRunAt: null, error: null });
  assert.deepEqual(await loadRuns({}, async () => ({})), { available: false, runs: [], nextRunAt: null }, "a page, not a runs list");
  assert.equal((await loadRuns({}, async () => ({ runs: [RUN], nextRunAt: 1793000000 }))).nextRunAt, 1793000000000);
  // The shipped route (routes/picksConfirm.js) sends the next run inside `state`.
  assert.equal((await loadRuns({}, async () => ({ runs: [RUN], state: { nextRunAt: 1793000000 } }))).nextRunAt, 1793000000000);
  assert.equal(await loadLeftOut(7, notFound), null);
  assert.match((await actOnPick(61, "apply", notFound)).message, /picks email/);
  // No runs → the tree groups today's attempts by DAY, and the next-run square is from the run times.
  const tree = buildTree({ runs: null, nodes: fixtureNodes(), now: NOW, nextRunAt: nextRunFromSettings({ runTimes: ["08:00", "17:00"], timeZone: "UTC" }, NOW), timeZone: "UTC" });
  assert.equal(tree[0].future, true);
  assert.equal(tree[0].time, "5 PM");
  assert.ok(tree.slice(1).every(r => !r.real), "no stored runs: day groups only");
  assert.equal(nextRunFromSettings({ runTimes: [] }, NOW), null);
  // Every D113 route call is in the adapter, none in the panel.
  assert.doesNotMatch(panel, /\/api\/picks/);
  for (const f of ["client/src/components/DraftHouseTree.jsx", "client/src/components/DraftHouseSide.jsx", "client/src/lib/draftHouseTree.js"]) {
    assert.doesNotMatch(read(f), /\/api\/picks/);
  }
});

// Moved from test/d14DraftPanelSplit.test.js (its Stopped │ Queued split is gone; these two still hold).
test("D10 follow-up (from d14): the empty tree names the new tabs", () => {
  assert.match(panel, /Draft jobs from the Daily Deck or Full House\./);
  assert.doesNotMatch(panel, /Draft jobs from Today or the board/);
});
test("D14 (kept): a section heading wraps rather than breaking its title in a narrow column", () => {
  const h = read("client/src/components/SectionHeading.jsx");
  assert.match(h, /flexWrap: "wrap"/);
  assert.match(h, /whiteSpace: "nowrap"/);
});

// ── the leftovers (43t ⚠): Make it now · Withdraw · Add the date · Note why ──────────────────────
// Server routes on an in-memory database built by the real migrations; synthetic users and postings only.
function leftoverDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO'), (2,'eli','x','PRO')").run();
  return db;
}
async function mountOn(mountFn) {
  const app = express();
  app.use(express.json());
  mountFn(app, (req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (p, method = "POST", body) => fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  return { server, call };
}
let slotSeq = 0;
function offerPick(db, { userId = 1, jobId = "p-1", state = "offered" } = {}) {
  const slot = 1793000000 + (slotSeq += 3600);
  const run = db.prepare("INSERT INTO picks_runs (user_id, slot_at, mode, expires_at) VALUES (?, ?, 'ask', ?)").run(userId, slot, slot + 86400).lastInsertRowid;
  return Number(db.prepare("INSERT INTO picks (user_id, run_id, job_id, rank, title, company, state, expires_at) VALUES (?, ?, ?, 1, 'Backend Engineer', 'Northwind', ?, ?)")
    .run(userId, run, jobId, state, slot + 86400).lastInsertRowid);
}

test("d113uiMakeItNow — a pick's résumé is made on the press, before Apply: the pick stays a pick, nothing starts or sends, one draft spent", async () => {
  const db = leftoverDb();
  const id = offerPick(db);
  const generated = [];
  // The apply path's own generation (server.js generateResumeForApply); here it writes the résumé row the way that one does.
  const generateResume = async (userId, jobId, tool) => {
    generated.push([userId, jobId, tool]);
    // Like the real one: a current résumé is reused (fromCache), not written again.
    if (db.prepare("SELECT 1 FROM resumes WHERE user_id = ? AND job_id = ?").get(userId, jobId)) return { html: "<p>r</p>", atsScore: 81, resumeId: 1, fromCache: true };
    db.prepare("INSERT INTO resumes (user_id, job_id, company, role, apply_mode, html, ats_score) VALUES (?, ?, 'Northwind', 'Backend Engineer', 'TAILORED', '<p>r</p>', 81)")
      .run(userId, jobId);
    return { html: "<p>r</p>", atsScore: 81, resumeId: 1, fromCache: false };
  };
  const slotsBefore = draftSlots(db, 1).used;
  const t = await mountOn((app, auth) => picksConfirmRoutes(app, db, auth, { secret: "s", env: {}, generateResume,
    startPickRun: () => { throw new Error("Make it now must never start a run"); } }));
  try {
    const r = await t.call(`/api/picks/${id}/resume`);
    assert.equal(r.status, 200);
    assert.equal(r.body.resumeReady, true);
    assert.equal(r.body.pick.state, "offered", "the pick stays a pick, waiting for Apply");
    assert.deepEqual(generated, [[1, "p-1", "generate"]]);
    assert.equal(draftSlots(db, 1).used, slotsBefore + 1, "a NEW résumé costs one draft (A63)");
    assert.equal(db.prepare("SELECT COUNT(*) FROM apply_runs").pluck().get(), 0, "no run, nothing sent");
    assert.equal(db.prepare("SELECT COUNT(*) FROM application_records").pluck().get(), 0, "not tagged Pending");
    // The run list says it is made, so the leaf reads "made" after a reload.
    const runs = await t.call("/api/picks/runs", "GET");
    assert.equal(runs.body.runs.find(x => x.picks[0]?.id === id).picks[0].resumeReady, true);
    // Pressed again with the résumé current: free.
    assert.equal((await t.call(`/api/picks/${id}/resume`)).status, 200);
    assert.equal(draftSlots(db, 1).used, slotsBefore + 1, "a current résumé costs nothing");
    // A pick already passed (or applied) is not made here (its run makes it); another user's pick is a 404.
    const passed = offerPick(db, { jobId: "p-2", state: "passed" });
    assert.equal((await t.call(`/api/picks/${passed}/resume`)).status, 409);
    const theirs = offerPick(db, { userId: 2, jobId: "p-3" });
    assert.equal((await t.call(`/api/picks/${theirs}/resume`)).status, 404);
    // No drafts left: refused before any model call, with the sentence every surface shows.
    const fresh = offerPick(db, { jobId: "p-4" });
    const { limit, used } = draftSlots(db, 1);
    const ins = db.prepare("INSERT INTO draft_slot_uses (user_id, kind, job_id) VALUES (1, 'generate', 'x')");
    for (let i = used; i < limit; i++) ins.run();
    const n = generated.length;
    const out = await t.call(`/api/picks/${fresh}/resume`);
    assert.equal(out.status, 429);
    assert.equal(out.body.error, "draft_slots_exhausted");
    assert.equal(generated.length, n, "refused before generating");
  } finally { t.server.close(); }
  // The UI: the leaf's Make it now is the adapter's call, only for a pick still waiting; the server is wired to the apply path's generation.
  const leaf = panel.slice(at(panel, 'const made = node.kind === "pick"'), at(panel, 'out.push({ id: "job", label: "The job"'));
  assert.match(leaf, /!pickReady && node\.ring === "pick" && \(\s*<button[^>]*data-action="make-now"[\s\S]{0,200}onClick=\{\(\) => makeNow\(node\)\}/);
  assert.match(leaf, /node\.ref\?\.resumeReady === true \|\| made\.ok === true/);
  assert.match(panel, /const r = await makePickResume\(node\.pickId\);/);
  assert.equal(D113_ROUTES.resume(61), "/api/picks/61/resume");
  const calls = [];
  assert.equal((await makePickResume(61, async (p, o) => { calls.push([p, o.method]); return { message: "Made. Nothing was sent.", atsScore: 81 }; })).ok, true);
  assert.deepEqual(calls, [["/api/picks/61/resume", "POST"]]);
  assert.match(read("server.js"), /picksConfirmRoutes\(app, db, requireAuth, \{[^}]*generateResume: generateResumeForApply \}\);/);
});

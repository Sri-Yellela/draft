// ⭐ D146 (owner 11-03) · ONE APPLICATION TRACKER — Draft House and The Table merged: a plain table with details on
// demand, the auto-apply timeline beside it. The row's rules are pure (client/src/lib/trackerRows.js) and tested as
// data; the table, the opened row and the timeline are RENDERED (esbuild + react-dom/server, as test/d113ui does) and
// their handlers CALLED from the element tree. Synthetic companies and people only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { buildNodes, buildTree, treeView } from "../client/src/lib/draftHouseTree.js";
import {
  trackerRows, trackerView, trackerCounts, sortRows, stageActions, readyToSend, sendAllConfirmText, panesFor, pulses,
  stageOfHistory, STAGES, TRACKER_FILTERS, TRACKER_COUNTS, TRACKER_COLUMNS, TRACKER_PANES, TRACKER_PERIODS,
} from "../client/src/lib/trackerRows.js";
import { RINGS, RING_ORDER } from "../client/src/styles/rings.js";
import { historyToCsv } from "../shared/applicationCsv.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
const panel = read("client/src/panels/AutoApplyPanel.jsx");
const app = read("client/src/App.jsx");
const nav = read("client/src/components/AppNav.jsx");
const trk = read("client/src/components/ApplicationTracker.jsx");
const trkCss = read("client/src/components/ApplicationTracker.css");
const dhCss = read("client/src/components/DraftHouse.css");
const tree = read("client/src/components/DraftHouseTree.jsx");
const drawer = read("client/src/components/AutoSettingsDrawer.jsx");
const history = read("client/src/components/ApplicationHistory.jsx");
const dbPanel = read("client/src/panels/DatabasePanel.jsx");
const exportLib = read("client/src/lib/tableExport.js");
const manifest = read("client/src/modules.manifest.js");
const bubbleCss = read("client/src/components/CompanyBubble.css");

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
        import ApplicationTracker, { RowOpen, StatusDot, TrackerCounts, TrackerFilters } from ${abs("components/ApplicationTracker.jsx")};
        import DraftHouseTree from ${abs("components/DraftHouseTree.jsx")};
        export const html = (C, props) => renderToStaticMarkup(createElement(C, props));
        export { createElement, ApplicationTracker, RowOpen, StatusDot, TrackerCounts, TrackerFilters, DraftHouseTree };`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d146-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}
function* walk(el) {
  if (el == null || typeof el !== "object") return;
  if (Array.isArray(el)) { for (const c of el) yield* walk(c); return; }
  yield el;
  yield* walk(el.props?.children);
}
const count = (s, needle) => s.split(needle).length - 1;

// ── fixtures (synthetic) ───────────────────────────────────────────────────────────────────────
const NOW = Date.UTC(2026, 10, 3, 15, 0);
const HOUR = 3600000;
const label = (c) => c || "Unknown company";
function fixtureNodes() {
  return buildNodes({
    now: NOW, companyLabel: label,
    pending: [{ runJobId: 11, runId: 1, jobId: "j-ready", company: "Northwind", title: "Backend Engineer", createdAt: (NOW - 2 * HOUR) / 1000,
      answerCount: 12, guessCount: 0, resume: { available: true, atsScore: 71 } }],
    heldApplications: [{ key: "a-q", jobId: "j-ask", company: "Halcyon", title: "ML Engineer", reasons: [], rows: [{ id: 21, runId: 2 }],
      primary: { row: { id: 21, runId: 2, createdAt: NOW - 3 * HOUR, reasonCode: "needs_input" } } }],
    questions: [{ question: "Are you open to relocating to Austin?", blocking: [{ jobId: "j-ask" }] }],
    inFlight: [{ id: 31, runId: 3, jobId: "j-work", company: "Quanta", title: "Platform Engineer", status: "running", startedAt: NOW - HOUR,
      progress: { filled: 7, total: 11 } }],
    brokeApplications: [{ key: "a-b", jobId: "j-old", company: "Basalt", title: "SWE", rows: [{ id: 41 }],
      primary: { obstacle: "The browser crashed.", row: { id: 41, runId: 4, finishedAt: NOW - 9 * 24 * HOUR, reasonCode: "internal_error" } } }],
    tableRows: [
      { id: 51, jobId: "j-sent", company: "Lumen", title: "Data Engineer", status: "submitted", updatedAt: (NOW - 26 * HOUR) / 1000 },
      { id: 52, jobId: "j-int", company: "Vireo", title: "SWE II", status: "interview", updatedAt: (NOW - 30 * HOUR) / 1000,
        interview: { ymd: "2026-11-10", time: "14:00", timeZone: "UTC" } },
      { id: 53, jobId: "j-no", company: "Kestrel", title: "SWE", status: "rejected", updatedAt: (NOW - 50 * HOUR) / 1000 },
    ],
    picks: [{ id: 61, runId: 7, jobId: "j-pick", company: "Orchard", title: "Full Stack Engineer", state: "offered", line: "Good match" }],
  });
}
// The Table's history: one row Draft House also has (enriches it), and three only The Table knows.
const HISTORY = [
  { jobId: "j-sent", recordId: 501, company: "Lumen", title: "Data Engineer", status: "sent", ask: true, label: "Did they reply?", resumeAt: 1, date: (NOW - 26 * HOUR) / 1000 },
  { jobId: "j-self", recordId: 502, recordState: "pending", origin: "opened_posting", company: "Saltmarsh", title: "Analyst", status: "in_play", label: "Pending", date: (NOW - 5 * HOUR) / 1000 },
  { jobId: "j-gone", recordId: 503, recordState: "not_applied", company: "Tidewater", title: "Engineer", status: "closed", label: "Not applied · moved after 14 days", date: (NOW - 20 * 24 * HOUR) / 1000 },
  { jobId: "j-imp", applicationId: 9, company: "Fernhill", title: "Developer", status: "sent", imported: true, label: "Sent · waiting", sentAt: (NOW - 40 * 24 * HOUR) / 1000, date: (NOW - 40 * 24 * HOUR) / 1000 },
];
const rowsOf = () => trackerRows({ nodes: fixtureNodes(), history: HISTORY, now: NOW });
const byJob = (rows, j) => rows.find(r => r.jobId === j);

// ── the tests ────────────────────────────────────────────────────────────────────────────────

test("d146OnePanelOneNavEntry — one Dock / Menu entry, Draft House · your applications; /app/database redirects to it", () => {
  const tabs = app.slice(at(app, "const appTabs = ["), at(app, "  ];\n\n  // The Jobs-only chrome"));
  assert.match(tabs, /\{ id: "auto-apply",\s+label: "Draft House" \}/);
  assert.doesNotMatch(code(tabs), /id: "database"/, "The Table is no longer its own entry");
  assert.doesNotMatch(code(app), /DatabasePanel/, "App mounts no second panel for applications");
  assert.match(app, /const TABLE_ROUTE = "database";/);
  assert.match(app, /if \(routeKey === TABLE_ROUTE\) \{\s+navigate\(\{ pathname: "\/app\/auto-apply", search: location\.search \|\| "" \}, \{ replace:true \}\);\s+return;/,
    "the old route lands on the one tracker, its ?sheet= deep link kept");
  assert.match(nav, /"auto-apply"\s?: "your applications"/);
  assert.doesNotMatch(code(nav), /database:/);
  assert.match(app, /<AutoApplyPanel user=\{authUser\}\/>/);
  // The Table is mounted ONCE, inside the tracker, and that composition is declared.
  assert.match(manifest, /from: "panels\/AutoApplyPanel\.jsx", to: "panels\/DatabasePanel\.jsx"/);
  assert.equal(count(panel, "<DatabasePanel "), 1);
  assert.ok(!fs.existsSync("client/src/components/DraftHouseSide.jsx"), "the side column's file is gone (nothing dead)");
  assert.doesNotMatch(manifest, /theTable:|DraftHouseSide/, "one module for the one tracker");
});

test("d146ImportExportKept — every Table import and export works from the header (Excel, CSV out, CSV in)", () => {
  const head = panel.slice(at(panel, "THE HEADER — the name and its line"), at(panel, "a broken connection is one banner line"));
  assert.match(head, /data-import-open=""[^>]*onClick=\{\(\) => setImporting\(v => !v\)\}>Import</);
  assert.match(head, /data-export-open=""[^\n]{0,120}onClick=\{\(\) => setExporting\(v => !v\)\}>Export</);
  assert.match(head, /\{importing && <ImportPanel onClose=\{\(\) => setImporting\(false\)\} onImported=/);
  assert.match(head, /data-export-kind="excel" onClick=\{exportExcel\}/);
  assert.match(head, /data-export-kind="csv"[\s\S]{0,200}onClick=\{\(\) => saveText\(csvName\(\), historyToCsv\(csvRows\)\)\}/);
  assert.match(panel, /const exportExcel = async \(\) => \{ try \{ await downloadExcel\(user\?\.username\); \}/);
  // ONE implementation of each: the header and the full sheet call the same.
  assert.match(exportLib, /await api\("\/api\/export\/excel"\)/);
  assert.match(exportLib, /download: `ResuMaster_\$\{username\}_/);
  assert.match(dbPanel, /try \{ await downloadExcel\(user\?\.username\); \}/);
  assert.match(history, /import \{ saveText, csvName \} from "\.\.\/lib\/tableExport\.js";/);
  assert.match(history, /onClick=\{\(\) => saveText\(csvName\(\), historyToCsv\(view\.rows\)\)\}/);
  assert.doesNotMatch(history, /function saveText/, "no second CSV writer");
  // The import is The Table's own panel, exported — the same dry run, mapping and refusals.
  assert.match(history, /export function ImportPanel\(\{ onClose, onImported \}\)/);
  assert.match(history, /api\("\/api\/applications\/import", \{ method: "POST", body: JSON\.stringify\(\{ csv: file\.text, mapping, apply \}\) \}\)/);
  // The CSV of the rows shown is The Table's CSV: the history rows behind the rows on screen.
  const rows = rowsOf();
  const csvRows = rows.map(r => r.hist).filter(Boolean);
  assert.equal(csvRows.length, HISTORY.length);
  const csv = historyToCsv(csvRows);
  for (const c of ["Lumen", "Saltmarsh", "Tidewater", "Fernhill"]) assert.match(csv, new RegExp(c));
});

test("d146ColumnsAndSort — Position · Résumé · Answers · Status · When; every header sorts, a second press flips it", async () => {
  assert.deepEqual(TRACKER_COLUMNS.map(c => c.label), ["Position", "Résumé", "Answers", "Status", "When"]);
  const rows = rowsOf();
  const r = byJob(rows, "j-ready");
  assert.equal(r.resume, "Tailored");
  assert.equal(r.answers, "12 filled");
  assert.equal(byJob(rows, "j-ask").answers, "1 needs you");
  assert.equal(byJob(rows, "j-imp").resume, "—", "an imported application has no résumé of ours");
  assert.equal(byJob(rows, "j-sent").resume, "Tailored", "the history fills in what the node does not know");
  assert.equal(byJob(rows, "j-ready").when, "2 h ago");
  const pos = sortRows(rows, { key: "position", dir: "asc" }).map(x => x.company);
  assert.deepEqual(pos, [...pos].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  assert.deepEqual(sortRows(rows, { key: "position", dir: "desc" }).map(x => x.company), [...pos].reverse());
  const when = sortRows(rows, { key: "when", dir: "desc" }).map(x => x.at || 0);
  assert.deepEqual(when, [...when].sort((a, b) => b - a), "newest first");
  assert.equal(sortRows(rows, { key: "status", dir: "asc" })[0].stage, "question", "what needs you first");
  const { html, ApplicationTracker } = await loadUi();
  const out = html(ApplicationTracker, { rows, sort: { key: "when", dir: "desc" } });
  for (const c of TRACKER_COLUMNS) assert.match(out, new RegExp(`data-sort="${c.key}"`));
  assert.match(out, /aria-sort="descending"/);
  const seen = [];
  const el = ApplicationTracker({ rows, sort: { key: "when", dir: "desc" }, onSort: (s) => seen.push(s) });
  [...walk(el)].find(e => e.props?.["data-sort"] === "when").props.onClick();
  [...walk(el)].find(e => e.props?.["data-sort"] === "company" || e.props?.["data-sort"] === "position").props.onClick();
  assert.deepEqual(seen, [{ key: "when", dir: "asc" }, { key: "position", dir: "desc" }]);
  // Phones: two columns, position and status (with its when beneath).
  const phone = trkCss.slice(at(trkCss, "@media (max-width: 640px)"));
  assert.match(phone, /\[data-col="resume"\], \.trk-table \[data-col="answers"\], \.trk-table \[data-col="when"\] \{ display: none; \}/);
  assert.match(phone, /\.trk-when-m \{ display: block;/);
});

test("d146StatusDotWordNoPill — the status is a quiet dot + a word, never a capsule", async () => {
  const rows = rowsOf();
  const word = (j) => byJob(rows, j).status;
  assert.equal(word("j-ask"), "Needs you");
  assert.equal(word("j-ready"), "Ready to send");
  assert.equal(word("j-work"), "Filling 7 of 11");
  assert.equal(word("j-sent"), "Did they reply?", "a matured sent row asks, as The Table did");
  assert.equal(word("j-int"), "Interview Tue 10 Nov, 2 PM");
  assert.equal(word("j-no"), "Not selected");
  assert.equal(word("j-self"), "Did you apply?");
  assert.equal(word("j-gone"), "Not applied");
  const { html, StatusDot } = await loadUi();
  const dot = html(StatusDot, { ring: "need", word: "Needs you" });
  assert.match(dot, /class="trk-dot"[^>]*style="--trk-dot:var\(--c-accent\)"/);
  assert.match(dot, />Needs you</);
  const rule = trkCss.slice(at(trkCss, ".trk-dot {"), at(trkCss, ".trk-when-m"));
  assert.match(rule, /width: 8px; height: 8px; border-radius: 50%;/, "a circle: equal sides");
  for (const src of [trkCss, trk]) assert.doesNotMatch(code(src), /999px|rounded-full|borderRadius:\s*999/);
  // Tokens only.
  assert.doesNotMatch(trkCss.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test("d146RowOpensInPlaceOneAtATime — a row opens under itself, never a new page; another closes it; Escape closes", async () => {
  const rows = rowsOf();
  const { html, ApplicationTracker } = await loadUi();
  const k = byJob(rows, "j-ask").key;
  const out = html(ApplicationTracker, { rows, openKey: k, renderOpen: (r) => `OPEN:${r.key}` });
  assert.equal(count(out, "data-row-open="), 1, "exactly one row open");
  const rowAt = out.indexOf(`data-row="${k}"`), openAt = out.indexOf(`data-row-open="${k}"`);
  assert.ok(rowAt > 0 && openAt > rowAt && out.indexOf("data-row=", rowAt + 10) > openAt, "opened directly under its own row");
  assert.equal(count(html(ApplicationTracker, { rows, openKey: null, renderOpen: () => "x" }), "data-row-open="), 0);
  const seen = [];
  const el = ApplicationTracker({ rows, openKey: k, onOpen: (x) => seen.push(x) });
  [...walk(el)].find(e => e.props?.["data-row"] === byJob(rows, "j-sent").key).props.onClick();
  [...walk(el)].find(e => e.props?.["data-row"] === k).props.onClick();
  assert.deepEqual(seen, [byJob(rows, "j-sent").key, null], "another row opens instead; the open one closes");
  // The panel holds ONE open thing (branchStep) — a row, or a run in the timeline — and Escape closes it.
  assert.match(panel, /onOpen=\{\(key\) => step\(key == null \? \{ type: "close" \} : \{ type: "job", key \}\)\}/);
  assert.match(panel, /openKey=\{open\?\.type === "job" \? open\.key : null\}/);
  assert.match(panel, /if \(e\.key === "Escape" && !settingsOpen && !applyRunDetailOpen\) setOpen\(null\);/);
  assert.doesNotMatch(code(panel.slice(at(panel, "const renderRow = (row) => {"), at(panel, "const seeLeftOut"))), /navigate\(/, "opening a row is not a page change");
});

test("d146OnDemandPanes — The posting · Résumé · Answers · Emails, one shown at a time, inside the row", async () => {
  assert.deepEqual(TRACKER_PANES.map(p => p[1]), ["The posting", "Résumé", "Answers", "Emails"]);
  const rows = rowsOf();
  assert.deepEqual(byJob(rows, "j-ready").panes, ["posting", "resume", "answers"], "before sending: the answers, no emails yet");
  assert.deepEqual(byJob(rows, "j-sent").panes, ["posting", "resume", "emails"], "after sending: the emails");
  assert.deepEqual(byJob(rows, "j-pick").panes, ["posting", "resume"], "a pick has no form yet");
  const { html, RowOpen } = await loadUi();
  const r = byJob(rows, "j-ready");
  const closed = html(RowOpen, { row: r, pane: null, paneBody: (id) => `BODY:${id}` });
  assert.equal(count(closed, "data-pane-body="), 0, "nothing is shown until asked for");
  assert.equal(count(closed, "data-pane="), 3);
  const one = html(RowOpen, { row: r, pane: "answers", paneBody: (id) => `BODY:${id}` });
  assert.equal(count(one, "data-pane-body="), 1);
  assert.match(one, /BODY:answers/);
  assert.doesNotMatch(one, /BODY:posting|BODY:resume/);
  const seen = [];
  const el = RowOpen({ row: r, pane: "answers", onPane: (p) => seen.push(p) });
  [...walk(el)].find(e => e.props?.["data-pane"] === "posting").props.onClick();
  [...walk(el)].find(e => e.props?.["data-pane"] === "answers").props.onClick();
  assert.deepEqual(seen, ["posting", null], "another pane replaces it; the open one closes");
  // The panes are Draft House's leaves, regrouped — never a second implementation of what they show.
  assert.match(panel, /const PANE_LEAVES = \{ posting: \["job"\], resume: \["resume"\], answers: \["answers", "form", "happened"\] \};/);
  assert.match(panel, /const ls = leavesFor\(row\.node\)\.filter\(l => \(PANE_LEAVES\[id\] \|\| \[\]\)\.includes\(l\.id\)\);/);
  assert.match(panel, /createLeafCache\(\(jobId\) => api\(`\/api\/pipeline\/job-for\/\$\{encodeURIComponent\(jobId\)\}`\)\)/, "the emails are read when the pane opens");
  assert.match(panel, /answerRows\(entry\.data\.answers, entry\.data\.openQuestions\)/, "answers: every field and its source; the agreement left for you");
});

test("d146ActionsByStage — each stage its own actions; the node's own handlers, then the stage's", () => {
  assert.deepEqual(stageActions("question"), ["answer", "skip"]);
  assert.deepEqual(stageActions("ready").slice(0, 3), ["approve", "edit", "form"]);
  assert.deepEqual(stageActions("sent"), ["heard", "reply_ask", "withdraw"]);
  assert.deepEqual(stageActions("interview"), ["prepare_interview", "date", "withdraw"]);
  assert.deepEqual(stageActions("rejected"), ["note"]);
  assert.deepEqual(stageActions("pending_self"), ["record", "did_not_apply"]);
  assert.deepEqual(stageActions("not_applied"), ["restore"]);
  // Every stage sits in exactly ONE filter, and every filter but All holds at least one stage.
  const filters = new Set(TRACKER_FILTERS.map(f => f[0]));
  for (const [id, st] of Object.entries(STAGES)) assert.ok(filters.has(st.filter) && st.filter !== "all", id);
  for (const [f] of TRACKER_FILTERS.slice(1)) assert.ok(Object.values(STAGES).some(s => s.filter === f), f);
  const fn = panel.slice(at(panel, "const rowActions = (row) => {"), at(panel, "const renderRow = (row) => {"));
  assert.match(fn, /const base = row\.node \? actionsFor\(row\.node\) : \[\];/, "Draft House's actions, unchanged");
  assert.match(fn, /stageActions\(row\.stage\)\.filter\(id => !have\.has\(id\)\)/);
  const extra = panel.slice(at(panel, "const extraAction = (row, id) => {"), at(panel, "const rowActions = (row) => {"));
  for (const w of ["Edit an answer", "See the form", "I applied", "I did not apply", "Restore"]) assert.ok(extra.includes(`"${w}"`), w);
  assert.match(extra, /REPLY_ASK\.map\(a => /, "a sent row's \"Did they reply?\" — The Table's outcome capture, through the merge endpoint");
  assert.match(panel, /\/api\/apply\/applications\/\$\{encodeURIComponent\(row\.jobId\)\}\/response`/);
});

test("d146SendAllReadyConfirms — Send all ready (n): every Ready to send, ONE confirm that lists them", () => {
  const rows = rowsOf();
  const ready = readyToSend(rows);
  assert.deepEqual(ready, [{ runJobId: 11, label: "Northwind — Backend Engineer" }], "only Ready to send — never a question, a pick or a sent one");
  const text = sendAllConfirmText(ready, { remaining: 0, limit: 5 });
  assert.match(text, /^Send 1 application to their employers\?/);
  assert.match(text, /· Northwind — Backend Engineer/);
  assert.match(text, /Only 0 of today's 5 approvals are left/);
  assert.match(text, /cannot be undone/);
  assert.match(panel, /data-send-all-ready="" disabled=\{!ready\.length \|\| pendingBusy\}/);
  assert.match(panel, />Send all ready \(\{ready\.length\}\)</);
  const fn = panel.slice(at(panel, "const sendAllReady = () => {"), at(panel, "const sendAllReady = () => {") + 300);
  assert.match(fn, /if \(window\.confirm\(sendAllConfirmText\(ready, approvalCap\)\)\) decidePending\(ready\.map\(r => r\.runJobId\), true\);/,
    "nothing is sent without the one confirm");
});

test("d146TimelineBesideDesktop — the table, and the timeline card beside it at 300 px", () => {
  assert.match(dhCss, /\.dh-main \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 300px;/);
  const mainJsx = panel.slice(at(panel, "THE TABLE, AND THE AUTO-APPLY TIMELINE BESIDE IT"));
  assert.ok(at(mainJsx, "<ApplicationTracker rows={shownRows}") < at(mainJsx, "<DraftHouseTree view={view}"), "the table, then the timeline");
  assert.match(panel, /Auto-apply · \{fullAuto \? "Apply for me" : "Ask me first"\}\{runsWord\}/);
  assert.match(panel, /` · runs at \$\{runTimes\.length > 1 \?/);
  assert.match(tree, /data-timeline=""/);
  assert.match(tree, /\{run\.seen\} looked at · \{run\.picked\} picked ·/);
  assert.match(tree, /"why these"/);
});

test("d146TimelineSwitchPhone — on a phone, a switch: Applications · Auto-apply timeline", () => {
  const sw = panel.slice(at(panel, 'data-phone-switch=""'), at(panel, 'data-phone-switch=""') + 600);
  assert.match(sw, /data-phone-view="table"[^>]*onClick=\{\(\) => setPhoneView\("table"\)\}>Applications</);
  assert.match(sw, /data-phone-view="timeline"[^>]*onClick=\{\(\) => setPhoneView\("timeline"\)\}>Auto-apply timeline</);
  assert.match(panel, /<div className="dh-main" data-draft-split="" data-phone-view=\{phoneView\}/);
  const narrow = dhCss.slice(at(dhCss, "@media (max-width: 899px) {"));
  assert.match(narrow, /\.dh-switch \{ display: inline-flex;/);
  assert.match(narrow, /\.dh-main\[data-phone-view="table"\] > \.dht, \.dh-main\[data-phone-view="timeline"\] > \.dh-table-col \{ display: none; \}/);
  assert.match(dhCss, /\.dh-switch \{ display: none; \}/, "no switch on a computer");
});

test("d146PulseOnlyLiveStages — needs you, ready and working pulse; sent, replied and stopped are still", async () => {
  assert.deepEqual(RING_ORDER.filter(pulses), ["need", "review", "work"]);
  const nodes = fixtureNodes();
  const view = treeView(buildTree({ runs: [], nodes, now: NOW, timeZone: "UTC" }), {});
  const { html, DraftHouseTree } = await loadUi();
  const out = html(DraftHouseTree, { view });
  for (const n of nodes) {
    const m = out.match(new RegExp(`<button[^>]*data-ring="${n.ring}"[^>]*data-key="${n.key}"[^>]*>`));
    assert.ok(m, n.key);
    assert.equal(/data-pulse="true"/.test(m[0]), !!RINGS[n.ring].pulse, `${n.key} (${n.ring})`);
  }
  assert.match(out, /Pulsing: needs you · ready · working\. Still: sent · replied · stopped\./, "one quiet line of key");
});

test("d146ReducedMotionNoPulse — reduced motion stops the pulse", () => {
  const rm = bubbleCss.slice(at(bubbleCss, "@media (prefers-reduced-motion: reduce)"));
  assert.match(rm, /\.cb\[data-pulse="true"\] \.cb__ring \{ animation: none; \}/);
  assert.match(bubbleCss, /\.cb\[data-pulse="true"\] \.cb__ring \{ animation: cb-pulse /);
  assert.doesNotMatch(code(tree), /animation|@keyframes/, "the timeline adds no motion of its own");
});

test("d146BubbleOpensRow — a bubble press opens that row in the table, in place, and scrolls to it", async () => {
  const nodes = fixtureNodes();
  const rows = trackerRows({ nodes, history: HISTORY, now: NOW });
  for (const n of nodes) assert.ok(rows.some(r => r.key === n.key), `a row for ${n.key}: the bubble's key is the row's`);
  const view = treeView(buildTree({ runs: [], nodes, now: NOW, timeZone: "UTC" }), {});
  const { DraftHouseTree } = await loadUi();
  const seen = [];
  const el = DraftHouseTree({ view, onBubble: (n) => seen.push(n.key) });
  const k = nodes.find(n => n.jobId === "j-int").key;
  [...walk(el)].find(e => e.props?.dataKey === k).props.onClick();
  assert.deepEqual(seen, [k]);
  assert.match(panel, /onBubble=\{\(node\) => openRow\(node\.key\)\}/);
  const fn = panel.slice(at(panel, "const openRow = (key) => {"), at(panel, "const openRow = (key) => {") + 700);
  assert.match(fn, /setOpen\(\{ type: "job", key \}\)/);
  assert.match(fn, /setListView\("table"\); setPhoneView\("table"\);/, "on a phone it switches to the table");
  assert.match(fn, /if \(!shownRows\.some\(r => r\.key === key\)\) \{ setFilter\("all"\); setQ\(""\); setPeriod\("any"\); \}/);
  assert.match(fn, /\[data-tracker-table\] \[data-row="\$\{CSS\.escape\(key\)\}"\]/);
  assert.match(fn, /scrollIntoView/);
});

test("d146NothingDropped — every capability in the row's map survives, where the map says", () => {
  const rows = rowsOf();
  const done = [];
  const check = (what, ok) => { assert.ok(ok, what); done.push(what); };
  // The Table's History → the table: every history row is a row, the live node wins, nothing twice.
  check("History → the table", HISTORY.every(h => rows.some(r => r.jobId === h.jobId)) && rows.filter(r => r.jobId === "j-sent").length === 1);
  // Spreadsheet / By company / Board / Funnel → Export and a View option in Settings.
  check("Spreadsheet, By company, Board, Funnel → Settings → View → the full sheet",
    /data-settings-group="view"/.test(drawer) && /The full sheet/.test(drawer) && /onListView=\{setListView\}/.test(panel)
    && /listView === "sheet" \? \(/.test(panel) && /\["applications","Spreadsheet"\]/.test(dbPanel)
    && /\["list", "List"\], \["company", "By company"\], \["board", "Board"\], \["funnel", "Funnel"\]/.test(history));
  // Resumes → each row's Résumé pane (+ Profile).
  check("Resumes → the Résumé pane + Profile", /navigate\("\/app\/profile"\)/.test(panel) && /\{id === "resume" && profileLink\}/.test(panel) && /\["resumes","Resumes"\]/.test(dbPanel));
  // Saved Jobs → Full House's Saved.
  // D147 (11-03): the view is the word "Saved" now (the Sort / view panel), not ★.
  check("Saved Jobs → Full House's Saved", /\["saved",\s+"Saved",\s+"Saved jobs"\]/.test(app) && /\.filter\(\(\[id\]\) => !\(embedded && id === "saved"\)\)/.test(dbPanel));
  // Pending Apply / Not applied → In progress / Stopped (one meaning each).
  check("Pending Apply → In progress", byJob(rows, "j-self").filter === "progress" && stageOfHistory({ status: "in_play", origin: "opened_posting" }) === "pending_self");
  check("Not applied → Stopped", byJob(rows, "j-gone").filter === "stopped" && byJob(rows, "j-gone").stage === "not_applied");
  check("the pending record form survives (I applied → the full sheet's Pending)", /onClick: \(\) => openSheet\("pending", row\.jobId\)/.test(panel)
    && /export function DatabasePanel\(\{ user, embedded = false, sheet = null, focusJobId = null \}\)/.test(dbPanel));
  // Inbox → each row's Emails pane (+ the inbox itself in the full sheet).
  check("Inbox → the Emails pane", byJob(rows, "j-sent").panes.includes("emails") && /openSheet\("inbox", null\)/.test(panel) && /\["inbox","Inbox"\]/.test(dbPanel));
  // The date range / search → a search field and the period in the filter row.
  check("search + period in the filter row", TRACKER_PERIODS.length === 4 && /<TrackerFilters filter=\{filter\} onFilter=\{setFilter\} period=\{period\} onPeriod=\{setPeriod\}/.test(panel)
    && trackerView(rows, { periodDays: 7, now: NOW }).every(r => r.at >= NOW - 7 * 86400000)
    && trackerView(rows, { q: "saltmarsh", now: NOW }).length === 1);
  // Draft House's branches and leaves → the row's on-demand panes.
  check("branches and leaves → the panes", /leavesFor\(row\.node\)/.test(panel) && /<RowOpen row=\{row\}/.test(panel));
  // The side column → the counts + the filters + a banner for a broken connection.
  const c = trackerCounts(rows);
  check("the side column → the counts", TRACKER_COUNTS.map(x => x.id).join() === "needs,progress,sent,replied,interview"
    && c.needs === 3 && c.progress === 2 && c.sent === 2 && c.replied === 2 && c.interview === 1);
  check("… and a banner for a broken connection", /data-connection-banner=\{c\.key\}/.test(panel) && /onClick=\{\(\) => fixConnection\(c\)\}/.test(panel));
  check("… Review all, the line and Tidy up stay (under the timeline)", /\{needsYouCount > 0 && timelineExtra\.review\}/.test(panel)
    && /\{timelineExtra\.running\}/.test(panel) && /\{timelineExtra\.tidy\}/.test(panel) && /onClick=\{\(\) => confirmOlder\(30\)\}/.test(panel));
  check("Pause / Resume stays (the timeline's head)", /data-stop-everything=""/.test(panel.slice(at(panel, "const timelineHead = ("))));
  // The Settings drawer → Settings.
  check("Settings drawer → Settings", count(panel, "<AutoSettingsDrawer ") === 1 && /data-settings-open=""/.test(panel));
  // The deep review (Review all's modal) and the application's own page stay.
  check("the review modal and the application's page", /Apply Runs Review Modal/.test(panel) && /<JobWorkspacePanel jobId=\{sideJob\} embedded \/>/.test(panel));
  // The old route still resolves.
  check("/app/database resolves", /routeKey === TABLE_ROUTE/.test(app));
  assert.equal(done.length, 17);
});

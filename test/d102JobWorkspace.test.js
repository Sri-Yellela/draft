import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ⭐ D102 P5 · UI slice 1 — one application, one page: /app/job/:applicationId (the approved sketch's job panel).
// The server's jobDetail is tested in its own suite (d102PipelineWorkspace); this pins the page and its doors.

const app = fs.readFileSync("client/src/App.jsx", "utf8");
const page = fs.readFileSync("client/src/panels/JobWorkspacePanel.jsx", "utf8");
const history = fs.readFileSync("client/src/components/ApplicationHistory.jsx", "utf8");

test("D102 P5 · /app/job/:id is a route of its own — not bounced to the board by the tab guard", () => {
  assert.ok(app.includes(String.raw`const jobRoute = /^job\/(\d+)$/.exec(routeKey) || /^job\/for\/(.+)$/.exec(routeKey);`),
    "the page is reached by the record id (The Table) or the job id (Draft House)");
  assert.match(app, /if \(!jobRoute && routeKey !== CONSOLE_ROUTE && !NAVIGABLE_TABS\.has\(routeKey\)\)/);
  assert.match(app, /\{activeTab === "job" && jobRoute && <JobWorkspacePanel \{\.\.\.\(jobByJobId \? \{ jobId: decodeURIComponent\(jobRoute\[1\]\) \} : \{ applicationId: jobRoute\[1\] \}\)\}\/>\}/);
});

test("D102 P5 · the page reads the one detail route and shows the five tabs; Needs-you first; Approve is a click", () => {
  assert.match(page, /: `\/api\/pipeline\/job\/\$\{encodeURIComponent\(applicationId\)\}`;/);
  assert.match(page, /try \{ setD\(await api\(path\)\); \}/);
  for (const t of ["Checklist", "Résumé", "Form", "Job", "Emails"]) assert.match(page, new RegExp(`"${t}"\]`), t);
  assert.match(page, /const needs = fields\.filter\(f => f\.skipped \|\| f\.value == null \|\| f\.value === ""\);/);
  assert.match(page, /onClick=\{\(\) => decidePending\(\[d\.runJobId\], true\)\}/, "D36·5: only a click sends");
  assert.match(page, /\{d\.form\?\.approvable && d\.runJobId && \(/, "Approve only when the server says it is approvable");
  assert.match(page, /title=\{SOURCE_WORDS\[f\.source\] \|\| f\.provenance \|\| ""\}/, "every value says where it came from");
});

test("D102 P5 · The Table's History opens a row's page by its record id", () => {
  assert.match(history, /href=\{`\/app\/job\/\$\{row\.recordId\}`\}/);
  assert.match(history, /navigate\(`\/app\/job\/\$\{row\.recordId\}`\)/);
});

test("D102 P5 · Draft House's stopped item opens the same page by its job id", () => {
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  assert.match(panel, /href=\{`\/app\/job\/for\/\$\{encodeURIComponent\(item\.jobId\)\}`\}/);
  assert.match(page, /`\/api\/pipeline\/job-for\/\$\{encodeURIComponent\(jobId\)\}`/);
});

test("D102 P5 · list and detail: on a wide screen Draft House opens an application beside its list", () => {
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  const manifest = fs.readFileSync("client/src/modules.manifest.js", "utf8");
  assert.match(panel, /const sideDetail = viewportWidth >= 1280;/);
  assert.match(panel, /if \(sideDetail\) setSideJob\(item\.jobId\); else navigate\(/, "narrower, it still goes to the page");
  assert.match(panel, /\{sideJob && sideDetail \? \(\s*<aside data-draft-detail=""/);
  assert.match(panel, /<JobWorkspacePanel jobId=\{sideJob\} embedded \/>/);
  assert.match(manifest, /from: "panels\/AutoApplyPanel\.jsx", to: "panels\/JobWorkspacePanel\.jsx"/, "a declared composition (A93)");
});

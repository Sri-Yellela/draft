import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ⭐ D102 P5 · UI slice 1 — one application, one page: /app/job/:applicationId (the approved sketch's job panel).
// The server's jobDetail is tested in its own suite (d102PipelineWorkspace); this pins the page and its doors.

const app = fs.readFileSync("client/src/App.jsx", "utf8");
const page = fs.readFileSync("client/src/panels/JobWorkspacePanel.jsx", "utf8");
const history = fs.readFileSync("client/src/components/ApplicationHistory.jsx", "utf8");

test("D102 P5 · /app/job/:id is a route of its own — not bounced to the board by the tab guard", () => {
  assert.ok(app.includes(String.raw`const jobRoute = /^job\/(\d+)$/.exec(routeKey);`), "the job route is matched by its numeric id");
  assert.match(app, /if \(!jobRoute && routeKey !== CONSOLE_ROUTE && !NAVIGABLE_TABS\.has\(routeKey\)\)/);
  assert.match(app, /\{activeTab === "job" && jobRoute && <JobWorkspacePanel applicationId=\{jobRoute\[1\]\}\/>\}/);
});

test("D102 P5 · the page reads the one detail route and shows the five tabs; Needs-you first; Approve is a click", () => {
  assert.match(page, /api\(`\/api\/pipeline\/job\/\$\{encodeURIComponent\(applicationId\)\}`\)/);
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

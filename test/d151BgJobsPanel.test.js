// D151 Rule 2 (46c) · the job queue is shown on Admin → System → Diagnostics: the panel reads GET /api/admin/jobs (an admin
// route) and draws one row per kind with queueStats' own fields — and the archive's purpose line states the real slice size.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SLICE_ROWS } from "../services/jobs/postingArchive.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("d151BgJobsPanel: Diagnostics mounts the Background jobs section, which reads /api/admin/jobs and shows queueStats' fields", () => {
  const panel = read("client/src/panels/adminDiagnostics.jsx");
  const admin = read("client/src/panels/AdminPanel.jsx");
  assert.match(panel, /export function BackgroundJobsSection\(\)/);
  assert.match(panel, /api\("\/api\/admin\/jobs"\)/);
  for (const f of ["waiting", "running", "failedDay", "oldestWaiting", "slowestMs"]) assert.ok(panel.includes(`k.${f}`), `the row shows ${f}`);
  assert.match(admin, /at\("system", "diagnostics"\) && <><DiagnosticsTab\/><BackgroundJobsSection\/><PostingArchiveSection\/><\/>/);
  const server = read("server.js");
  assert.match(server, /app\.get\("\/api\/admin\/jobs", requireAdmin,/);
});

test("d151BgJobsPanel: the archive's purpose line says the slice size the code uses", () => {
  const panel = read("client/src/panels/adminDiagnostics.jsx");
  assert.ok(panel.includes(`in slices of ${SLICE_ROWS}.`), `the panel says slices of ${SLICE_ROWS}`);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ A194 (46j, production 11-12 02:16Z): the preview ran with a_plus_resume (CUSTOM_SAMPLER) and Approve started its run with
// startRun's default tool 'generate' (TAILORED) — so resumeCurrency found "stored CUSTOM_SAMPLER; this run wants TAILORED"
// and generated the résumé a SECOND time, 19 s after the first. Approve now makes the résumé with the previews' tool.
const src = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");

test("a194ApproveKeepsPreviewTool: pendingRows carries the preview run's tool; Approve's startRun passes it", () => {
  const rowsFn = src.slice(at(src, "const pendingRows = (userId, runJobIds) => {"), at(src, "const approvedTool = (rows, planTier) => {"));
  assert.match(rowsFn, /SELECT rj\.id, rj\.job_id, r\.tool_type FROM apply_run_jobs rj JOIN apply_runs r ON r\.id = rj\.run_id/);
  const approve = src.slice(at(src, 'app.post("/api/apply/approve", requireAuth'), at(src, "if (started.status !== 202) {", at(src, 'app.post("/api/apply/approve", requireAuth')));
  assert.match(approve, /tool: approvedTool\(rows, planTierA\), approvalMode: "approved"/);
});

test("a194ApproveKeepsPreviewTool: one tool → that tool; mixed → generate; A+ without the plan → generate (never a refused approval)", () => {
  const fn = src.slice(at(src, "const approvedTool = (rows, planTier) => {"), at(src, "};", at(src, "const approvedTool = (rows, planTier) => {")) + 2);
  const make = (enabled, allowed) => new Function("monetisationEnabled", "canUseAPlusResume", `${fn}; return approvedTool;`)(() => enabled, () => allowed);
  const t = make(true, true);
  assert.equal(t([{ tool_type: "a_plus_resume" }, { tool_type: "a_plus_resume" }], "PRO"), "a_plus_resume");
  assert.equal(t([{ tool_type: "generate" }], "FREE"), "generate");
  assert.equal(t([{ tool_type: "a_plus_resume" }, { tool_type: "generate" }], "PRO"), "generate");
  assert.equal(t([{ tool_type: null }], "PRO"), "generate");
  assert.equal(make(true, false)([{ tool_type: "a_plus_resume" }], "FREE"), "generate", "a downgrade since the preview");
  assert.equal(make(false, false)([{ tool_type: "a_plus_resume" }], "FREE"), "a_plus_resume", "monetisation off: no plan gate");
});

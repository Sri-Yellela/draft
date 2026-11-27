// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Generate and A+ artifacts are tracked independently in the sandbox", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  // ⭐ 47m (D199 C7): SandboxPanel and the posting panel are deleted — the opening sheet's 06 holds both (plate/SheetResume.jsx)
  const sandbox = fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8");
  const jobCard = fs.readFileSync("client/src/components/JobCard.jsx", "utf8");
  const detail = sandbox;

  // The tool constants moved to client/src/lib/applyTools.js so AutoApplyContext could build the
  // same apply-run request from the same values instead of keeping a second copy of them (W5).
  // The invariant is unchanged: two tools, these two labels, declared exactly once.
  const applyTools = fs.readFileSync("client/src/lib/applyTools.js", "utf8");
  assert.match(applyTools, /export const TOOL_LABELS\s+= \{ \[GENERATE_TOOL\]: "Generate", \[A_PLUS_TOOL\]: "A\+ Resume" \}/);
  assert.match(jobsPanel, /import \{ GENERATE_TOOL, A_PLUS_TOOL, TOOL_LABELS, normalizeTool \} from "\.\.\/lib\/applyTools\.js"/);
  assert.match(jobsPanel, /function mergeArtifact/);
  assert.match(jobsPanel, /variants\[tool\]/);
  assert.match(sandbox, /keys\.length > 1 \?/);
  assert.match(sandbox, /onClick=\{\(\) => setTool\(k\)\}/);
  assert.match(jobCard, /const generateLoading = st === "generate"/);
  // The companion `aPlusLoading` assertion is gone with the dead local it pinned (§5.14). A+ is
  // not a JobCard button — it lives in JobDetailPanel — so the card never read that flag. The
  // independent TRACKING this test is actually about is asserted on jobsPanel and sandbox above;
  // the card only needs its own flag for the button it does own.
  // ⚠ D48: this matched only a COMMENT once the action bar's button gained `|| noSlots` (A63). It pins the code now:
  // the résumé button is disabled while any tool is in flight, whichever it is.
  assert.match(detail, /disabled=\{!!st \|\| noSlots\}/);   // the sheet's résumé buttons
});

test("download/export marks the selected artifact as kept for downstream use", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");

  assert.match(server, /039_resume_version_tool_artifacts/);
  assert.match(server, /tool_type TEXT NOT NULL DEFAULT 'generate'/);
  assert.match(server, /is_kept INTEGER NOT NULL DEFAULT 0/);
  assert.match(server, /app\.post\("\/api\/resumes\/:jobId\/keep"/);
  // ⛔ D57: keeping (exporting) a version no longer LOCKS `resumes` — a later generation is the résumé
  // that would be sent, so it is always stored there; is_kept stays the record of what was exported.
  assert.doesNotMatch(server, /keptExists/);
  assert.match(fs.readFileSync("services/generatedResumes.js", "utf8"), /\/\/ ⛔ ALWAYS — the newest generation is the résumé that would be sent/);
  assert.match(server, /UPDATE resume_versions SET is_kept=1/);
  assert.match(jobsPanel, /\/api\/resumes\/\$\{current\.jobId\}\/keep/);
  // A63: the export then tags the job Pending — it no longer records an application.
  assert.match(jobsPanel, /"\/api\/applications\/pending", \{ method:"POST", body:JSON\.stringify\(\{\s*jobId:targetJob\.jobId, origin:"exported_resume"/);
});

test("cached artifacts reuse stored ATS reports; the formatting is the tools service's deterministic render", () => {
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /041_resume_ats_cache_metadata/);
  assert.match(server, /ATS_SCORE_PROMPT_VERSION/);
  assert.match(server, /buildAtsCacheKey/);
  assert.match(server, /atsCached:true/);
  // A4: the document draft persists is the tools service's deterministic render, returned only after
  // its claim guard passed; the optional LLM formatting pass and its lever (RESUME_MASTER_LLM_FORMAT)
  // live there too, and are tested there (resume-master test/generate.test.js, test/formattingSystem.test.js).
  assert.match(server, /const formattedHtml = generated\.html;/);
  assert.doesNotMatch(server, /RESUME_MASTER_LLM_FORMAT|FORMATTING_SYSTEM/,
    "a second formatting pass in draft would be a second design the renderer does not know about");
});

test("admin job review remains narrow to classification reassignment", () => {
  const adminDb = fs.readFileSync("routes/adminDb.js", "utf8");
  const dbInspector = fs.readFileSync("client/src/pages/admin/DBInspector.jsx", "utf8");

  assert.match(adminDb, /\/job-review\/reassign/);
  assert.match(dbInspector, /JobReviewTab/);
  assert.doesNotMatch(adminDb, /UPDATE scraped_jobs SET title|UPDATE scraped_jobs SET company|UPDATE scraped_jobs SET description/);
  assert.doesNotMatch(dbInspector, /textarea[^>]+description|name="title"|name="company"/);
});

test("resume sandbox distinguishes idle, error, and missing artifact states", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  const sandbox = fs.readFileSync("client/src/plate/SheetResume.jsx", "utf8");   // 47m: the sheet's live view
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(jobsPanel, /No generated artifact yet\. Keep the pre-generation state neutral\./);
  assert.doesNotMatch(jobsPanel, /No resume data found/);
  assert.match(jobsPanel, /status:"loading"/);
  assert.match(jobsPanel, /status:"error"/);
  assert.match(jobsPanel, /status:"missing", missing:true/);
  assert.match(sandbox, /THE RÉSUMÉ COULDN’T BE LOADED/);
  assert.match(sandbox, /data-sheet-failed=\{entry\.missing \? "missing" : "error"\}/);
  // A91: /d's membership is one shared predicate (PENDING_MEMBERSHIP_SQL), reading the résumé itself.
  assert.match(server, /uj\.resume_generated = 1\s+AND EXISTS \(SELECT 1 FROM resumes pr WHERE pr\.user_id = uj\.user_id AND pr\.job_id = sj\.job_id AND pr\.html IS NOT NULL\)/);
});

// ⛔ 47m (changed on purpose): "resume sandbox layout keeps scroll ownership inside the preview pane…" retired — the sandbox was a PanelShell panel; its live view is a section of the opening sheet (plate/SheetResume.jsx), which scrolls with the sheet

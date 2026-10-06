// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("job card hover preview uses shared active-aware icon helpers for save and pass actions", () => {
  const jobCard = fs.readFileSync("client/src/components/JobCard.jsx", "utf8");

  assert.match(jobCard, /function IconBtn\(\{/);
  assert.match(jobCard, /active = false/);
  assert.match(jobCard, /preview = hov && !disabled/);
  // A53 (owner, 10-02): Save SETS — the star toggle (ToggleIconBtn, "Remove from saved" on a second
  // press) is gone; reversal is Undo, or the Saved list's own labelled "Remove" (onUnsave).
  const buttons = fs.readFileSync("client/src/components/DecisionButtons.jsx", "utf8");
  assert.doesNotMatch(jobCard, /function ToggleIconBtn/);
  assert.match(buttons, /label="Remove" title="Remove from saved" onClick=\{onUnsave\}/);
  // AE5 gave the thumbs-down's slot to the action that MOVES an application forward — Draft now
  // (was Queue Auto) — and it reports its own state rather than firing twice.
  // D51: the state and its sentence come from ONE place (lib/jobDecisions.js draftButtonState); a drafted
  // button opens Draft House rather than going grey.
  assert.match(buttons, /const s = draftButtonState\(\{ drafted, drafting, block, canView: !!onView \}\);/);
  assert.match(buttons, /disabled=\{s\.disabled\}/);
  assert.doesNotMatch(jobCard, /activeLabel="Undo pass"/,
    "the listing must not grow the thumbs-down back — see AE5 for where Pass lives");
  assert.match(jobCard, /active=\{done && !generateLoading\}/);
  // The A+ action is no longer a JobCard button — only Generate is — and the dead `aPlusLoading`
  // local that lingered alongside it has now been removed too (§5.14). The card must not grow a
  // second loading flag back without a button to use it; while a job is in the a_plus_resume
  // state the generic `disabled={!!st}` guard still covers it.
  // Comments stripped first — the removal's own explanatory note names the deleted identifier.
  const jobCardCode = jobCard
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(jobCardCode, /aPlusLoading/,
    "an unused second loading flag must not return — !!st already covers that state");
  assert.match(jobCardCode, /disabled=\{!!st\}/, "the generic in-flight guard must stay");

  // JobDetailPanel's action bar carried an IDENTICAL orphan, removed in the same change. It was
  // found only because an unrelated test happened to pin the JobCard line — nothing guarded this
  // surface, so guard it here rather than leave the pair half-covered. Neither surface has a
  // dedicated A+ button; both rely on the same generic in-flight guard.
  const detailPanelCode = fs.readFileSync("client/src/components/JobDetailPanel.jsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(detailPanelCode, /aPlusLoading/,
    "the detail panel's action bar must not regrow the unused flag either");
  // A63 adds "no Draft slots left" beside it; the in-flight guard itself must stay.
  assert.match(detailPanelCode, /disabled=\{!!st( \|\| noSlots)?\}/,
    "the detail panel's generic in-flight guard must stay");
});

test("jobs UI opens ATS panel from stored base ATS reports without requiring regeneration", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  const detailPanel = fs.readFileSync("client/src/components/JobDetailPanel.jsx", "utf8");
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(jobsPanel, /function buildAtsPayload\(job, artifact = null\)/);
  assert.match(jobsPanel, /job\?\.baseAtsScore/);
  assert.match(jobsPanel, /job\?\.baseAtsReport/);
  assert.match(jobsPanel, /openAtsPanel\(buildAtsPayload\(job, g\)\)/);
  assert.match(detailPanel, /const atsScore = g\?\.atsScore \?\? job\?\.baseAtsScore \?\? null/);
  // ⛔ CC5 REVERSED BOTH OF THESE, AND THEY WERE THE LEAK.
  //
  // This used to assert that the poll shape reads `sj.ats_report` directly and that the keywords
  // route selects `ats_report FROM scraped_jobs WHERE job_id=?`. Both served ONE CELL PER JOB —
  // written at ingest from whichever user's résumé basis triggered the crawl — as the caller's own
  // ATS report. An ATS report is a statement about a particular résumé against a particular
  // posting, so a per-job cell cannot hold one for anybody, and the fix is removal rather than a
  // narrower read.
  //
  // The client half of this test is unchanged and still passes: the panel still opens from
  // `baseAtsScore`/`baseAtsReport`, those field names still exist, and they are now always null
  // from the poll — which is what they already were on 100% of rows. A real per-(user, profile)
  // score reaches the client through the board's ats_only_reports join and the ATS panel.
  assert.match(server, /baseAtsScore:\s*null/,
    "the poll must not serve the shared per-job cell as this caller's score");
  assert.match(server, /baseAtsReport:\s*null/);
  assert.doesNotMatch(server, /SELECT ats_report FROM scraped_jobs WHERE job_id=\?\s*\n\s*\)\.get\(jobId\)/,
    "the cross-user priority-2 cache read must stay deleted");
});

test("profile selector exposes direct manage-profiles access from the jobs flow", () => {
  const selector = fs.readFileSync("client/src/components/ProfileSelectorDropdown.jsx", "utf8");
  assert.match(selector, /Manage Profiles/);
  assert.match(selector, /href="\/app\/profile"/);
});

test("the imported-LinkedIn section is gone, and the bulk-import CTA stays gone (E2)", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  // The section is removed — see jobsUiProfileFilters for the full symbol sweep and the reason.
  assert.doesNotMatch(jobsPanel, /function StarredLinkedInSection/);
  // The original point of this test survives the removal: the retired bulk-import CTA must not
  // reappear under any surface. Comments stripped, since the removal notes quote the old copy.
  const jobsPanelCode = jobsPanel
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(jobsPanelCode, /Import from LinkedIn/,
    "the removed bulk-import CTA must not come back");
});

test("poll enforces stored profile experience constraints before surfacing new jobs", () => {
  const server = fs.readFileSync("server.js", "utf8");

  // The scrape half (maxAllowedYoe, yoeMismatch) went with scrapeJobs, deleted 10-02 (18).
  assert.match(server, /const pollSignals = loadSimpleApplyProfile/);
  assert.match(server, /const pollMaxYoe = pollSignals\?\.yearsExperience != null \? pollSignals\.yearsExperience \+ 2 : null/);
  assert.match(server, /\(\? IS NULL OR sj\.min_years_exp IS NULL OR sj\.min_years_exp <= \?\)/);
});

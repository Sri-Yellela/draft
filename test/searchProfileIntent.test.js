import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Was "search pipeline remains active-profile driven on the server". Every one of its six
// assertions described the removed Apify scrape route — buildProfileTitleVariants(activeProfile),
// scrapeJobs(query, token, scrapeParams, ...), roleTitleSql("sj.title", roleKey). The route is
// gone: /api/scrape now answers HTTP 410 "External scraping has been removed. Job search now
// uses /api/jobs." So this could never pass again, and it was one of the failures keeping the
// baseline pinned to a pre-pivot architecture (see docs/PIPELINE_DIAGNOSIS.md §5.11).
// Replaced by the inverse guard: scraping must STAY retired.
test("external scraping stays retired", () => {
  const server = fs.readFileSync("server.js", "utf8");

  assert.match(server, /app\.post\("\/api\/scrape",[\s\S]{0,200}?410/,
    "/api/scrape must remain a 410 tombstone rather than being reimplemented");
  assert.doesNotMatch(server, /app\.post\("\/api\/jobs\/scrape"/,
    "the per-user scrape route must not return");
  // The board is served from the stored pool via buildJobFilters, not an outbound crawl.
  assert.match(server, /buildJobFilters\(filterParams, \{ derivedKeys: appliedDerivedKeys \}\)/,
    "/api/jobs must still compose its filters through buildJobFilters — and must hand it the " +
    "provenance of each key, which is what makes derived values rank instead of exclude");
});

// 47m (changed on purpose): the cross-profile search-intent guard (SEARCH_PROFILE_INTENTS, detectSearchProfileIntent,
// SearchIntentDialog, the board's DomainProfileWizard mount) is DELETED — it sat behind the live search, which nothing could
// start since A74 / D26. The two tests that pinned it are replaced by this one: it stays gone. The wizard itself lives on
// (Job profiles, Refine, the profile panel).
test("the board's dead search-intent guard and its wizard mount stay deleted", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  const code = jobsPanel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const gone of ["SEARCH_PROFILE_INTENTS", "detectSearchProfileIntent", "SearchIntentDialog", "askSearchIntent", "ensureSearchProfileAlignment",
    "activateProfileForSearch", "handleSetRole", "profileWizardOpen", "DomainProfileWizard"]) {
    assert.ok(!code.includes(gone), `JobsPanel still carries ${gone}`);
  }
  for (const f of ["client/src/panels/JobProfilesPanel.jsx", "client/src/components/RefineJobProfile.jsx", "client/src/panels/ProfilePanel.jsx"]) {
    assert.match(fs.readFileSync(f, "utf8"), /import DomainProfileWizard from/, `${f} still opens the wizard`);
  }
});

test("jobs search blocks missing setup states before running search", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");

  // 47m (changed on purpose): the guards live on Check for new jobs (handleSearch, with its copy, is deleted)
  assert.match(jobsPanel, /Create a job search profile before checking for jobs/);
  assert.match(jobsPanel, /Upload the active profile's base resume before checking for jobs/);
  assert.match(jobsPanel, /SetupGateNotice/);
});

// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { isTitleRelevantToProfile } from "../services/searchQueryBuilder.js";

const server = fs.readFileSync("server.js", "utf8");
const jobClassifier = fs.readFileSync("services/jobClassifier.js", "utf8");
const profileTitleFilter = fs.readFileSync("services/profileTitleFilter.js", "utf8");
const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
const simpleProfileSvc = fs.readFileSync("services/simpleApplyProfile.js", "utf8");

// Three tests here described the retired external-scraping flow: the /api/scrape route's
// profile guard and DB-first local count, its quota-exhaustion classification, and the client
// states that surfaced both. /api/scrape is now a tombstone returning HTTP 410 "External
// scraping has been removed. Job search now uses /api/jobs.", so none of them could pass again.
// Replaced with the guard that matters — the retirement must hold — plus the client-side setup
// gate, which IS still live and is what now blocks a user with no profile.
test("external scraping stays retired and the setup gate still blocks a profileless user", () => {
  assert.match(server, /app\.post\("\/api\/scrape",[\s\S]{0,200}?410/,
    "/api/scrape must remain a 410 tombstone");
  // The daily re-scrape cron is gone (§5.12). It selected its target from user_job_searches,
  // which has no writer anywhere in the repo, so it could never fire. Asserted absent because the
  // reason it was dead is invisible at the call site — it looked like a live scheduled job.
  assert.doesNotMatch(server, /cron\.schedule\("0 7 \* \* \*"/,
    "the dead daily re-scrape cron must not come back");
  // Not asserting that nothing reads user_job_searches at all: a legacy migration backfill
  // (server.js:911-916) joins it to domain_profiles legitimately, and an admin view reads it.
  // Reads are fine — the table having no WRITER is what made the cron unreachable.

  // scrapeJobs's one remaining entry point was POST /api/admin/db/force-scrape. A58 (10-02) removed
  // it — the owner's call (it spent a user's own Apify token, and nothing called it) — so the admin
  // router is no longer handed scrapeJobs. Asserted absent so the wiring cannot quietly come back.
  assert.match(server, /createAdminDbRouter\(db, \{ dbPath: DB_PATH, reports: adminReports \}\)/,   // A163 added only the report worker
    "the admin router no longer receives scrapeJobs: force-scrape is gone");

  // The user-facing gate that replaced it is live.
  assert.match(jobsPanel, /setupBlock/);
  assert.match(jobsPanel, /SetupGateNotice/);
  assert.match(jobsPanel, /Create a job search profile/);
});

// ⭐ A232 R6 (46y, owner 11-19 "all four approved"): also stands for profileIsolation's "engineering title filter excludes firmware and embedded role
// contamination" (the same nine NOT LIKEs, read from the whole file there; read from the engineering case here).
test("roleTitleSql engineering excludes all firmware/embedded keyword families", () => {
  // The server.js import assertion that stood here is gone: /api/jobs no longer applies
  // roleTitleSql (the job_role_map join is sufficient — see the phase6 tests merged
  // below from profileIsolation), so server.js stopped importing it. The KEYWORD FAMILIES below are the
  // valuable part and are still intact in jobClassifier.js, which is what this test guards.
  const engStart = jobClassifier.indexOf('if (roleKey === "engineering") return');
  assert.ok(engStart > 0, "engineering roleTitleSql case must exist");
  // Find the closing of the engineering block by locating the next roleKey check
  const nextCase = jobClassifier.indexOf('if (roleKey === "engineering_embedded_firmware")', engStart);
  assert.ok(nextCase > engStart, "engineering_embedded_firmware case must follow engineering case");

  const engBlock = jobClassifier.slice(engStart, nextCase);
  assert.match(engBlock, /NOT LIKE '%firmware%'/, "must exclude firmware");
  assert.match(engBlock, /NOT LIKE '%embedded%'/, "must exclude embedded");
  assert.match(engBlock, /NOT LIKE '%device driver%'/, "must exclude device driver");
  assert.match(engBlock, /NOT LIKE '%bsp%'/, "must exclude bsp");
  assert.match(engBlock, /NOT LIKE '%silicon validation%'/, "must exclude silicon validation");
  assert.match(engBlock, /NOT LIKE '%post-silicon%'/, "must exclude post-silicon");
  assert.match(engBlock, /NOT LIKE '%bootloader%'/, "must exclude bootloader");
  assert.match(engBlock, /NOT LIKE '%rtos%'/, "must exclude rtos");
  assert.match(engBlock, /NOT LIKE '%uefi%'/, "must exclude uefi");
});

// ⭐ A232 R6 (46y, owner 11-19 "all four approved"): also stands for profileIsolation's "roleTitleSql engineering_embedded_firmware case exists and covers
// firmware titles" (its six LIKEs are among the eight here, read from the firmware case itself).
test("roleTitleSql engineering_embedded_firmware case covers the canonical firmware title set", () => {
  const fwStart = jobClassifier.indexOf('if (roleKey === "engineering_embedded_firmware") return');
  assert.ok(fwStart > 0, "engineering_embedded_firmware roleTitleSql case must exist");
  const pmCase = jobClassifier.indexOf('if (roleKey === "pm") return', fwStart);
  const fwBlock = jobClassifier.slice(fwStart, pmCase);

  assert.match(fwBlock, /LIKE '%firmware%'/);
  assert.match(fwBlock, /LIKE '%embedded%'/);
  assert.match(fwBlock, /LIKE '%bsp%'/);
  assert.match(fwBlock, /LIKE '%silicon validation%'/);
  assert.match(fwBlock, /LIKE '%bootloader%'/);
  assert.match(fwBlock, /LIKE '%rtos%'/);
  assert.match(fwBlock, /LIKE '%uefi%'/);
  assert.match(fwBlock, /LIKE '%hardware debug%'/);
});

// ⭐ A232 R6 (46y, owner 11-19 "all four approved"): profileIsolation had this test word for word ("roleKeyForProfile returns engineering_embedded_firmware for
// firmware domain profiles"); one copy is kept.
test("roleKeyForProfile returns domain for engineering_embedded_firmware profiles", () => {
  assert.match(server, /domain === "engineering_embedded_firmware"/);
  assert.match(server, /return "engineering_embedded_firmware"/);
});

test("migration 045 firmware repair exists and includes title-heuristic cleanup", () => {
  assert.match(server, /045_firmware_role_map_repair/);
  assert.match(server, /firmware_profile_repair/);
  assert.match(server, /firmware_title_repair/);
  assert.match(server, /matched_by = 'title_heuristic'/);
});

test("migration 048 is idempotent — DELETE step removes conflicting engineering rows before UPDATE", () => {
  const m48start = server.indexOf("048_firmware_reclassify");
  assert.ok(m48start > 0, "048_firmware_reclassify migration must exist");
  const m48end   = server.indexOf("id:", m48start + 10);
  const block    = server.slice(m48start, m48end > m48start ? m48end : m48start + 4000);

  // Step 1: DELETE conflicts first
  assert.match(block, /DELETE FROM job_role_map/, "must DELETE stale rows before UPDATE");
  assert.match(block, /jrm2\.role_key = 'engineering_embedded_firmware'/, "DELETE must filter for existing firmware row");

  // Step 2: UPDATE remaining
  assert.match(block, /UPDATE job_role_map/, "must UPDATE remaining rows");
  assert.match(block, /matched_by\s*=\s*'firmware_reclassify'/, "must set matched_by to firmware_reclassify");

  // Must NOT be a bare UPDATE without the prior DELETE (the original bug)
  const bareUpdate = block.match(/UPDATE job_role_map[\s\S]*?WHERE role_key = 'engineering'/);
  const deleteFirst = block.match(/DELETE FROM job_role_map[\s\S]*?UPDATE job_role_map/);
  assert.ok(deleteFirst, "DELETE must appear before UPDATE in the same migration");
});

test("migration 048 DELETE step scopes to firmware-title jobs only", () => {
  const m48start = server.indexOf("048_firmware_reclassify");
  const block    = server.slice(m48start, m48start + 4000);
  const deleteBlock = block.slice(at(block, "DELETE FROM job_role_map"),
                                  at(block, "UPDATE job_role_map"));
  assert.match(deleteBlock, /LIKE '%firmware%'/);
  assert.match(deleteBlock, /LIKE '%embedded system%'/);
  assert.match(deleteBlock, /LIKE '%bootloader%'/);
});

test("migration 048 UPDATE step is safe after DELETE — no UNIQUE violation possible", () => {
  const m48start = server.indexOf("048_firmware_reclassify");
  const block    = server.slice(m48start, m48start + 4000);
  const updateBlock = block.slice(at(block, "UPDATE job_role_map"));
  // UPDATE must target only role_key='engineering' rows — after DELETE these have no
  // engineering_embedded_firmware counterpart, so no constraint conflict is possible
  assert.match(updateBlock, /WHERE role_key = 'engineering'/);
  assert.match(updateBlock, /matched_by IN \('profile_scrape'/);
  // Must NOT contain INSERT OR IGNORE (UPDATE is correct here, not insert)
  assert.ok(!updateBlock.includes("INSERT OR IGNORE"), "UPDATE is the right operation here");
});

// Was "triple filter — role_key + roleTitleSql + profileTitleSql". It is a DOUBLE filter now:
// roleTitleSql was deliberately dropped from the query paths because the job_role_map join
// already constrains the board to the right role family, making the title re-derivation
// redundant. profileIsolation (merged below) asserts that removal as correct, so this file was
// contradicting a passing test elsewhere in the suite.
test("jobs board uses the role_key join plus profileTitleSql on every query", () => {
  const routeStart = server.indexOf('app.get("/api/jobs"');
  assert.ok(routeStart > 0, "/api/jobs route must exist");
  const routeEnd   = server.indexOf("\napp.", routeStart + 10);
  const block      = server.slice(routeStart, routeEnd);

  assert.match(block, /jrm\.role_key = \?/, "must filter by role_key");
  assert.match(block, /profileTitleSql\(/, "must apply profileTitleSql");
  assert.match(profileTitleFilter, /export function profileTitleSql\(column, profile\)/, "profile title filter must be extracted");
  // Profile filter must be first guard — no-profile returns empty immediately
  assert.match(block, /if \(!sessionActiveProfile\)/, "must guard on missing active profile");
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): profileIsolation's "phase6: server.js /api/jobs no longer uses bucket_role or
  // resolveUserRoles" asserted the three lines above word for word, plus these three absences — merged here.
  assert.doesNotMatch(block, /resolveUserRoles\(/, "resolveUserRoles must not appear (Taxonomy A retired)");
  assert.doesNotMatch(block, /bucket_role IN/, "bucket_role IN filter must not appear (job_role_map replaces it)");
  assert.doesNotMatch(block, /isResumeRelevant\(/, "isResumeRelevant must not gate the board (collar gate replaced it)");
});

test("poll board uses the same filters as the board to prevent wrong-profile jobs leaking", () => {
  const pollStart = server.indexOf('app.get("/api/jobs/poll"');
  assert.ok(pollStart > 0, "/api/jobs/poll route must exist");
  const pollEnd   = server.indexOf("\napp.", pollStart + 10);
  const block     = server.slice(pollStart, pollEnd);

  assert.match(block, /jrm\.role_key = \?/, "poll must filter by role_key");
  // roleTitleSql dropped here for the same reason as the board query above; profileIsolation
  // has a passing test asserting exactly that ("poll no longer applies roleTitleSql").
  assert.match(block, /pollProfileTitleFilter/, "poll must apply profileTitleSql");
  assert.match(block, /if \(!activeProfile\)/, "poll must guard on missing active profile");
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): profileIsolation's "phase6: /api/jobs/poll no longer applies roleTitleSql" — merged here.
  assert.doesNotMatch(block, /roleTitleSql\("sj\.title"/, "roleTitleSql must be removed from poll (redundant re-derivation)");
});

test("poll completion triggers re-fetch via fetchJobsRef for correct sort order", () => {
  // After scrape completes, prepending new jobs without re-sorting leaves the board
  // in wrong order for atsScore/applicantCount sorts.  fetchJobsRef.current?.(1)
  // re-fetches from DB with the user's current sort.
  assert.match(jobsPanel, /fetchJobsRef = useRef\(null\)/, "fetchJobsRef must be declared");
  assert.match(jobsPanel, /fetchJobsRef\.current = fetchJobs/, "ref must be kept in sync with latest fetchJobs");
  // In startPollLoop, ref must be called when !pollData.scraping
  const pollStart = jobsPanel.indexOf("const startPollLoop");
  const pollEnd   = jobsPanel.indexOf("}, []); // eslint-disable-line react-hooks/exhaustive-deps", pollStart);
  const pollBlock = jobsPanel.slice(pollStart, pollEnd);
  assert.match(pollBlock, /fetchJobsRef\.current\?\.\(1\)/, "poll completion must call fetchJobsRef.current?.(1)");
});

// Was "manual search renders local board before profile-driven scrape starts" — it asserted the
// ORDERING of a local fetch against a subsequent api("/api/scrape") call. There is no scrape call
// any more, so the ordering it protected is moot: search now only ever reads the stored board.
// The surviving invariant is that searching does not attempt an outbound crawl at all.
test("manual search reads the stored board and never triggers an outbound scrape", () => {
  assert.doesNotMatch(jobsPanel, /api\("\/api\/scrape"/,
    "the client must not call the retired scrape endpoint");
  assert.match(jobsPanel, /const handleSetRole/, "search entry point must still exist");
  // The scrape-request builder that lingered here with zero callers is now removed (§5.12), so
  // this is asserted rather than merely noted. Comments are stripped first: the removal's own
  // explanatory note in JobsPanel names the outbound path it forbids.
  const jobsPanelCode = jobsPanel
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(jobsPanelCode, /buildProfileScrapeRequest/,
    "the scrape-request builder must not return — there is no outbound path to build for");
});

test("board filters stay local and are not sent as scrape parameters", () => {
  assert.match(jobsPanel, /Board UI filters stay local to \/api\/jobs and must not shape \/api\/scrape/);
  assert.doesNotMatch(jobsPanel, /buildScrapeParams/, "old UI-filter scrape parameter builder must be removed");
  assert.doesNotMatch(jobsPanel, /body:JSON\.stringify\(\{ query:q,[\s\S]*workType/, "scrape body must not include board workType filter");
  assert.doesNotMatch(jobsPanel, /body:JSON\.stringify\(\{ query:q,[\s\S]*ageFilter/, "scrape body must not include board age filter");
  assert.doesNotMatch(jobsPanel, /body:JSON\.stringify\(\{ query:q,[\s\S]*locationFilter/, "scrape body must not include board location filter");
  assert.doesNotMatch(jobsPanel, /body:JSON\.stringify\(\{ query:q,[\s\S]*employmentTypePrefs/, "scrape body must not include board employment filters");
});

test("polling includes same-second inserts and refreshes through local board filters", () => {
  const pollStart = server.indexOf('app.get("/api/jobs/poll"');
  const pollEnd = server.indexOf("\napp.", pollStart + 10);
  const pollBlock = server.slice(pollStart, pollEnd);
  assert.match(pollBlock, /Math\.floor\(\(since - 1000\) \/ 1000\)/, "poll must not miss same-second scrape inserts");
  assert.match(pollBlock, /sj\.scraped_at >= \?/, "poll query must include same-second rows");

  const loopStart = jobsPanel.indexOf("const startPollLoop");
  const loopEnd = jobsPanel.indexOf("const activateProfileForSearch", loopStart);
  const loopBlock = jobsPanel.slice(loopStart, loopEnd);
  assert.match(loopBlock, /fetchJobsRef\.current\?\.\(1\)/, "progressive poll updates must re-read filtered board state");
  assert.doesNotMatch(loopBlock, /\[\.\.\.toAdd, \.\.\.prev\]/, "poll must not blindly prepend unfiltered rows");
});

test("profile facts are hard constraints for local jobs and poll", () => {
  assert.match(server, /function evaluateProfileFactEligibility/, "profile fact eligibility helper must exist");
  assert.match(server, /normaliseStructuredFacts/, "structured profile facts must be normalized before use");
  assert.match(server, /profileFactsUsed/, "board/search logs must expose profile facts used for shaping");
  assert.match(server, /requiresSponsorship/, "sponsorship fact must be considered");
  assert.match(server, /hasClearance/, "clearance fact must be considered");
  assert.match(server, /citizenshipStatus/, "citizenship fact must be considered");
});

test("jobs board structured logs include profile, sort, and result count", () => {
  // Ensures the board-population log line exists for observability
  assert.match(server, /\[jobs\].*profile.*sort.*total.*returned/);
  // The "[poll] … scrape done" line could only fire on scrape state nothing wrote; it went with that
  // state (F2, 10-03), and the poll answers scraping: false outright.
  assert.doesNotMatch(server, /activeScrapes|scrapeStateKey/);
  const pollAt = at(server, 'app.get("/api/jobs/poll"');
  const poll = server.slice(pollAt, at(server, "res.json({", pollAt) + 200);
  assert.match(poll, /scraping: false,/);
});

test("/api/jobs does not hard-filter by scrape age — no hidden 7-day cutoff in base conditions", () => {
  // Root cause of '0 SWE jobs despite 100+ local': a sevenDaysAgo filter in the
  // base conditions array silently removed every job scraped more than a week ago.
  // The fix: remove the hard freshness filter from the static conditions.
  // Recency filtering is opt-in via the ageFilter query param.
  const routeStart = server.indexOf('app.get("/api/jobs"');
  const routeEnd   = server.indexOf("\napp.", routeStart + 10);
  const block      = server.slice(routeStart, routeEnd);

  // The conditions array must no longer include a sevenDaysAgo cutoff
  assert.doesNotMatch(block, /sevenDaysAgo/, "/api/jobs must not use sevenDaysAgo in base conditions");
  // The existing optional ageFilter must still exist
  assert.match(block, /ageFilter/, "opt-in age filter must remain available");
  // Profile scoping must still be intact. roleTitleSql was deliberately dropped (the
  // job_role_map join covers it); the role_key join is asserted here in its place so this test
  // still proves the board stays profile-scoped without a freshness cutoff.
  assert.match(block, /jrm\.role_key = \?/, "role_key join must still scope the board");
  assert.match(block, /profileTitleSql\(/, "profileTitleSql must still be applied");
});

test("/api/jobs response maps scrapedAt so client can render staleness indicator", () => {
  const routeStart = server.indexOf('app.get("/api/jobs"');
  const routeEnd   = server.indexOf("\napp.", routeStart + 10);
  const block      = server.slice(routeStart, routeEnd);
  assert.match(block, /scrapedAt:\s*j\.scraped_at/, "response must expose scrapedAt for staleness UI");
});

// "scrape DB-first count uses 30-day window instead of 7-day" is gone with the route it measured.
// The DB-first count existed to decide whether a background crawl was worth starting; with
// /api/scrape a 410 tombstone there is no crawl to skip, so the window is meaningless. The
// underlying concern it protected — that a stale-date cutoff must not silently empty the board —
// is covered by "/api/jobs does not hard-filter by scrape age" above, which asserts against the
// LIVE board query rather than the retired scrape path.

// "normalizePostedAt converts relative age strings to ISO dates at ingest" went with the LinkedIn
// ingest it served ("2 days ago" was a LinkedIn shape): scrapeJobs was deleted 10-02 (18).

test("job card age always renders using scrapedAt fallback when postedAt is absent", () => {
  const jobCard = fs.readFileSync("client/src/components/JobCard.jsx", "utf8");
  // ago() must accept a second argument (scrapedAt fallback)
  assert.match(jobCard, /function ago\(postedAt, scrapedAt\)/, "ago must accept scrapedAt fallback");
  // Fallback logic: use scrapedAt * 1000 when postedAt is not parseable
  assert.match(jobCard, /Number\(scrapedAt\) \* 1000/, "must convert Unix seconds to ms");
  // Both card views must pass scrapedAt
  assert.match(jobCard, /ago\(job\.postedAt, job\.scrapedAt\)/, "must pass scrapedAt to ago()");
});

test("7-day expiry cron is extracted into runExpiredJobsCleanup and called at startup", () => {
  // Startup call ensures missed cron windows don't leave stale jobs on the board.
  assert.match(server, /function runExpiredJobsCleanup\(\)/, "cleanup must be a named function");
  assert.match(server, /cron\.schedule.*runExpiredJobsCleanup/, "cron must call the named function");
  // Startup call via setImmediate in app.listen
  const listenBlock = server.slice(at(server, "app.listen(PORT"));
  assert.match(listenBlock, /runExpiredJobsCleanup\(\)/, "startup must call runExpiredJobsCleanup");
});

test("search suggestion panel clears after Enter/submit via searchCommitted state", () => {
  assert.match(jobsPanel, /searchCommitted.*useState\(false\)|useState\(false\).*searchCommitted/, "searchCommitted state must exist");
  assert.match(jobsPanel, /setSearchCommitted\(true\)/, "must set searchCommitted on submit");
  assert.match(jobsPanel, /setSearchCommitted\(false\)/, "must reset searchCommitted on input change");
  assert.match(jobsPanel, /!searchCommitted.*showPreview|showPreview.*searchCommitted/, "showPreview must respect searchCommitted");
});

test("simple_apply_profiles stores and exposes yearsExperience from base resume", () => {
  assert.match(server, /extractUserYearsExperience/, "server must import extractUserYearsExperience");
  // Migration adds the column
  assert.match(server, /049_simple_apply_profile_yoe/, "migration 049 must exist");
  assert.match(server, /ADD COLUMN years_experience INTEGER/, "migration must add years_experience column");
  // Service extracts, stores, and returns the field
  assert.match(simpleProfileSvc, /export function extractUserYearsExperience/, "service must export extractUserYearsExperience");
  assert.match(simpleProfileSvc, /years_experience.*excluded\.years_experience/, "upsert must persist years_experience");
  assert.match(simpleProfileSvc, /yearsExperience: row\.years_experience/, "load must return yearsExperience");
});

test("/api/jobs auto-applies YoE hard constraint from stored signals when no explicit maxYoe is set", () => {
  const routeStart = server.indexOf('app.get("/api/jobs"');
  const routeEnd   = server.indexOf("\napp.", routeStart + 10);
  const block      = server.slice(routeStart, routeEnd);

  // Must load signals and use yearsExperience
  assert.match(block, /loadSimpleApplyProfile/, "must call loadSimpleApplyProfile");
  assert.match(block, /signals\?\.yearsExperience/, "must check yearsExperience from signals");
  assert.match(block, /yearsExperience \+ 2/, "must use +2 year buffer for stretch goals");
  // Must only apply when the user hasn't set an explicit maxYoe. The check was extracted into an
  // `explicitMaxYoe` variable — same semantics, so the assertion follows the rename.
  assert.match(block, /explicitMaxYoe !== null/, "hard constraint must only apply when maxYoe is not set");
  // The constraint must exclude jobs requiring more than user's band
  assert.match(block, /sj\.min_years_exp IS NULL OR sj\.min_years_exp <= \?/, "must filter by min_years_exp");
});

// ── Phase 4: collar gate wired into every ingest point ───────────────────────
import { classifyJob } from "../services/jobs/classifyJob.js";
import { at } from "../test-support/sourceAnchors.js";

test("phase4: aggregator imports classifyJob (unified collar gate) not classifyForIngest", () => {
  const agg = fs.readFileSync("services/jobs/aggregator.js", "utf8");
  // The named-import list is matched loosely on purpose: the property under test is WHICH gate the
  // aggregator classifies through, not how many other symbols it happens to pull from the same
  // module. It now also imports ROLE_KEY_FALLBACK from there, for the unclassified-import bucket
  // (see upsertCanonicalJob) — pinning the exact one-symbol form made that a test failure with no
  // behavioural change behind it.
  assert.match(agg, /import \{[^}]*\bclassifyJob\b[^}]*\} from '\.\/classifyJob\.js'/, "aggregator must import classifyJob");
  assert.doesNotMatch(agg, /import \{ classifyForIngest \}/, "aggregator must not import classifyForIngest (replaced by classifyJob)");
});

test("phase4: aggregator cacheJobs ejects blue-collar into rejected_jobs", () => {
  const agg = fs.readFileSync("services/jobs/aggregator.js", "utf8");
  assert.match(agg, /INSERT OR REPLACE INTO rejected_jobs/, "cacheJobs must upsert rejected_jobs for blue-collar jobs");
  assert.match(agg, /blue_collar/, "rejection reason must be blue_collar");
  assert.match(agg, /collar === 'blue'/, "must check collar === 'blue'");
  assert.match(agg, /DELETE FROM scraped_jobs/, "must DELETE existing scraped_jobs row on eject");
  assert.match(agg, /DELETE FROM job_role_map/, "must DELETE existing job_role_map row on eject");
});

test("phase4: aggregator cacheJobs stores collar and confidence on every insert", () => {
  const agg = fs.readFileSync("services/jobs/aggregator.js", "utf8");
  assert.match(agg, /collar.*classification_confidence/, "INSERT must include collar and classification_confidence columns");
  assert.match(agg, /collar:\s*'white'/, "inserted jobs must carry collar='white'");
});

test("phase4: server.js has no LinkedIn ingest left to gate", () => {
  // The LinkedIn ingest (scrapeJobs -> insertMany) gated on collar here until it was deleted 10-02
  // (18): A58 had removed its last entry point. Every remaining writer goes through the aggregator
  // or the job gateway, whose collar gate the test above pins.
  assert.doesNotMatch(server, /unifiedClassifyJob/);
  assert.doesNotMatch(server, /async function scrapeJobs\(|async function scrapeHarvestAPI\(/);
});

test("phase4: classifyJob correctly ejects canonical blue-collar titles", () => {
  const blue = [
    ["Delivery Driver",        ""],
    ["Warehouse Associate",    ""],
    ["Warehouse Manager",      ""],   // Policy #1 — supervisory blue
    ["Line Cook",              ""],
    ["Restaurant Manager",     ""],   // Policy #1 — supervisory blue
    ["Store Manager",          ""],   // Policy #1 — supervisory blue
    ["Construction Superintendent", ""], // Policy #1
    ["Cashier",                ""],
    ["Forklift Operator",      ""],
    ["Home Health Aide",       ""],
  ];
  for (const [title, desc] of blue) {
    const r = classifyJob(title, desc, "");
    assert.equal(r.collar, "blue", `"${title}" should be blue-collar`);
    assert.equal(r.roleKey, null, `"${title}" should have null roleKey`);
  }
});

test("phase4: classifyJob keeps white-collar titles with a strong role anchor even when blue token present", () => {
  const white = [
    ["Warehouse Operations Analyst",  ""],  // blue token + strong white anchor
    ["Fleet Software Engineer",       ""],  // blue token + strong white anchor
    ["Security Engineer",             ""],  // "security" is blue-adjacent, but engineer rescues
    ["Field Service Engineer",        ""],  // service/field could be ambiguous; engineer rescues
  ];
  for (const [title, desc] of white) {
    const r = classifyJob(title, desc, "");
    assert.equal(r.collar, "white", `"${title}" should be white-collar`);
    assert.notEqual(r.roleKey, null, `"${title}" should have a non-null roleKey (got ${r.roleKey})`);
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// PROFILE ISOLATION — ⭐ A232 R6 (46y, owner 11-19 "all four approved"): test/profileIsolation.test.js merged into this file (§4 of
// docs/A232_TEST_AUDIT.md: the pair shared 10+ assertions word for word). Its five tests that repeated tests above
// were folded into them (named at each); the rest follow unchanged. It shared this file's first line,
// "SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION".
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function setupDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT
    );
    CREATE TABLE domain_profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      profile_name TEXT NOT NULL,
      role_family TEXT NOT NULL,
      domain TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE scraped_jobs (
      job_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      search_query TEXT NOT NULL,
      domain_profile_id INTEGER,
      scraped_at INTEGER NOT NULL,
      posted_at TEXT
    );
    CREATE TABLE job_role_map (
      job_id TEXT NOT NULL,
      role_key TEXT NOT NULL,
      role_family TEXT,
      domain TEXT,
      PRIMARY KEY (job_id, role_key)
    );
    CREATE TABLE user_jobs (
      user_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      domain_profile_id INTEGER,
      visited INTEGER DEFAULT 0,
      applied INTEGER DEFAULT 0,
      starred INTEGER DEFAULT 0,
      disliked INTEGER DEFAULT 0,
      resume_generated INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, job_id)
    );
  `);
  return db;
}

function activeProfileRows(db, userId, activeProfileId) {
  const profile = db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(activeProfileId);
  const roleKey = (profile.role_family || profile.domain).toLowerCase();
  return db.prepare(`
    SELECT sj.job_id, sj.title, uj.starred, uj.disliked
    FROM scraped_jobs sj
    JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ?
    LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ?
    WHERE 1 = 1
      AND (
        LOWER(sj.title) LIKE '%engineer%'
        OR LOWER(sj.title) LIKE '%developer%'
        OR LOWER(sj.title) LIKE '%software%'
        OR LOWER(sj.title) LIKE '%backend%'
        OR LOWER(sj.title) LIKE '%frontend%'
        OR LOWER(sj.title) LIKE '%platform%'
      )
      AND (uj.applied IS NULL OR uj.applied = 0)
      AND (uj.disliked IS NULL OR uj.disliked = 0)
    ORDER BY sj.job_id
  `).all(roleKey, userId);
}

function engineeringTitleRows(db, userId) {
  return db.prepare(`
    SELECT sj.job_id
    FROM scraped_jobs sj
    JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = 'engineering'
    LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ?
    WHERE (
      LOWER(sj.title) LIKE '%engineer%'
      OR LOWER(sj.title) LIKE '%developer%'
      OR LOWER(sj.title) LIKE '%software%'
      OR LOWER(sj.title) LIKE '%backend%'
      OR LOWER(sj.title) LIKE '%frontend%'
      OR LOWER(sj.title) LIKE '%platform%'
    )
      AND (uj.applied IS NULL OR uj.applied = 0)
      AND (uj.disliked IS NULL OR uj.disliked = 0)
    ORDER BY sj.job_id
  `).all(userId);
}

test("active profile query uses shared role map instead of user-owned scraped tags", () => {
  const db = setupDb();
  db.exec(`
    INSERT INTO users VALUES (1, 'a');
    INSERT INTO domain_profiles VALUES (10, 1, 'Software Engineering', 'engineering', 'engineering', 1);
    INSERT INTO domain_profiles VALUES (11, 1, 'Project Manager', 'pm', 'pm_general', 0);
    INSERT INTO scraped_jobs VALUES
      ('swe-ok', 'Software Engineer', 'Acme', 'software engineer', 10, 1000, NULL),
      ('pm-contaminated', 'Project Manager', 'Acme', 'project manager', 11, 1000, NULL),
      ('null-contaminated', 'Data Analyst', 'Acme', 'data analyst', NULL, 1000, NULL);
    INSERT INTO job_role_map VALUES
      ('swe-ok', 'engineering', 'engineering', 'engineering'),
      ('pm-contaminated', 'pm', 'pm', 'pm_general'),
      ('null-contaminated', 'data', 'data', 'data');
    INSERT INTO user_jobs (user_id, job_id, domain_profile_id) VALUES
      (1, 'swe-ok', 10),
      (1, 'pm-contaminated', 10),
      (1, 'null-contaminated', 10);
  `);

  const rows = activeProfileRows(db, 1, 10);
  assert.deepEqual(rows.map(r => r.job_id), ["swe-ok"]);
});

test("job state remains isolated by user", () => {
  const db = setupDb();
  db.exec(`
    INSERT INTO users VALUES (1, 'a'), (2, 'b');
    INSERT INTO domain_profiles VALUES
      (10, 1, 'Software Engineering', 'engineering', 'engineering', 1),
      (20, 2, 'Software Engineering', 'engineering', 'engineering', 1);
    INSERT INTO scraped_jobs VALUES
      ('shared-title-a', 'Software Engineer', 'Acme', 'software engineer', 10, 1000, NULL),
      ('shared-title-b', 'Software Engineer', 'Acme', 'software engineer', 20, 1000, NULL);
    INSERT INTO job_role_map VALUES
      ('shared-title-a', 'engineering', 'engineering', 'engineering'),
      ('shared-title-b', 'engineering', 'engineering', 'engineering');
    INSERT INTO user_jobs (user_id, job_id, domain_profile_id, starred, disliked) VALUES
      (1, 'shared-title-a', 10, 1, 0),
      (2, 'shared-title-b', 20, 0, 1);
  `);

  const userOne = activeProfileRows(db, 1, 10);
  const userTwo = activeProfileRows(db, 2, 20);

  assert.deepEqual(userOne.map(r => r.job_id), ["shared-title-a", "shared-title-b"]);
  assert.equal(userOne.find(r => r.job_id === "shared-title-a").starred, 1);
  assert.equal(userOne.find(r => r.job_id === "shared-title-b").starred, null);
  assert.deepEqual(userTwo.map(r => r.job_id), ["shared-title-a"]);
});

test("shared jobs are visible without precreating user_jobs state rows", () => {
  const db = setupDb();
  db.exec(`
    INSERT INTO users VALUES (1, 'a'), (2, 'b');
    INSERT INTO domain_profiles VALUES
      (10, 1, 'Software Engineering', 'engineering', 'engineering', 1),
      (20, 2, 'Software Engineering', 'engineering', 'engineering', 1);
    INSERT INTO scraped_jobs VALUES
      ('shared-job', 'Software Engineer', 'Acme', 'software engineer', NULL, 1000, NULL);
    INSERT INTO job_role_map VALUES
      ('shared-job', 'engineering', 'engineering', 'engineering');
    INSERT INTO user_jobs (user_id, job_id, domain_profile_id, visited) VALUES
      (1, 'shared-job', 10, 1);
  `);

  const userOne = activeProfileRows(db, 1, 10);
  const userTwo = activeProfileRows(db, 2, 20);

  assert.deepEqual(userOne.map(r => [r.job_id, r.starred ?? 0]), [["shared-job", 0]]);
  assert.deepEqual(userTwo.map(r => r.job_id), ["shared-job"]);
  assert.equal(userTwo[0].starred, null);
});

test("profile title relevance rejects obvious cross-domain titles", () => {
  assert.equal(
    isTitleRelevantToProfile("Senior Software Engineer", ["Software Engineer", "Backend Engineer"]),
    true
  );
  assert.equal(
    isTitleRelevantToProfile("Clinical Nurse Educator", ["Software Engineer", "Backend Engineer"]),
    false
  );
  assert.equal(
    isTitleRelevantToProfile("Data Scientist", ["Data Scientist", "Data Analyst"]),
    true
  );
});

test("engineering pool excludes stale PM jobs even if legacy role map is wrong", () => {
  const db = setupDb();
  db.exec(`
    INSERT INTO users VALUES (1, 'a');
    INSERT INTO scraped_jobs VALUES
      ('swe-ok', 'Backend Software Engineer', 'Acme', 'software engineer', 10, 1000, NULL),
      ('pm-stale', 'Project Manager', 'Acme', 'project manager', 11, 1000, NULL);
    INSERT INTO job_role_map VALUES
      ('swe-ok', 'engineering', 'engineering', 'engineering'),
      ('pm-stale', 'engineering', 'engineering', 'engineering');
  `);

  assert.deepEqual(engineeringTitleRows(db, 1).map(r => r.job_id), ["swe-ok"]);
});

test("engineering title filter excludes ML/AI, PM, and data-specialty contamination", () => {
  assert.match(jobClassifier, /NOT LIKE '%machine learning%'/);
  assert.match(jobClassifier, /NOT LIKE '%ai engineer%'/);
  assert.match(jobClassifier, /NOT LIKE '%project manager%'/);
  assert.match(jobClassifier, /NOT LIKE '%product manager%'/);
  // data specialty titles must also be excluded from SWE pool
  assert.match(jobClassifier, /NOT LIKE '%data scientist%'/);
  assert.match(jobClassifier, /NOT LIKE '%data engineer%'/);
  assert.match(jobClassifier, /NOT LIKE '%analytics engineer%'/);
});

test("engineering pool with role_key=engineering excludes firmware-titled jobs via title filter", () => {
  const db = setupDb();
  db.exec(`
    INSERT INTO users VALUES (1, 'a');
    INSERT INTO scraped_jobs VALUES
      ('swe-ok',      'Software Engineer',          'Acme', 'software engineer', 10, 1000, NULL),
      ('fe-ok',       'Frontend Developer',          'Acme', 'frontend developer', 10, 1000, NULL),
      ('fw-bad',      'Firmware Engineer',           'Acme', 'software engineer', 10, 1000, NULL),
      ('emb-bad',     'Embedded Systems Engineer',   'Acme', 'software engineer', 10, 1000, NULL),
      ('bsp-bad',     'BSP Engineer',                'Acme', 'software engineer', 10, 1000, NULL),
      ('bios-bad',    'BIOS Software Engineer',      'Acme', 'software engineer', 10, 1000, NULL),
      ('driver-bad',  'Device Driver Engineer',      'Acme', 'software engineer', 10, 1000, NULL);
    INSERT INTO job_role_map VALUES
      ('swe-ok',      'engineering', 'engineering', 'engineering'),
      ('fe-ok',       'engineering', 'engineering', 'engineering'),
      ('fw-bad',      'engineering', 'engineering', 'engineering'),
      ('emb-bad',     'engineering', 'engineering', 'engineering'),
      ('bsp-bad',     'engineering', 'engineering', 'engineering'),
      ('bios-bad',    'engineering', 'engineering', 'engineering'),
      ('driver-bad',  'engineering', 'engineering', 'engineering');
  `);

  // Simulate the server-side query for a SWE user:
  // role_key = 'engineering' AND roleTitleSql exclusions applied
  const rows = db.prepare(`
    SELECT sj.job_id
    FROM scraped_jobs sj
    JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = 'engineering'
    WHERE (
      LOWER(sj.title) LIKE '%engineer%'
      OR LOWER(sj.title) LIKE '%developer%'
      OR LOWER(sj.title) LIKE '%software%'
      OR LOWER(sj.title) LIKE '%backend%'
      OR LOWER(sj.title) LIKE '%frontend%'
      OR LOWER(sj.title) LIKE '%platform%'
    )
      AND LOWER(sj.title) NOT LIKE '%firmware%'
      AND LOWER(sj.title) NOT LIKE '%embedded%'
      AND LOWER(sj.title) NOT LIKE '%device driver%'
      AND LOWER(sj.title) NOT LIKE '%bsp%'
      AND LOWER(sj.title) NOT LIKE '% bios %'
      AND LOWER(sj.title) NOT LIKE 'bios %'
      AND LOWER(sj.title) NOT LIKE '%uefi%'
    ORDER BY sj.job_id
  `).all();

  const ids = rows.map(r => r.job_id);
  assert.ok(ids.includes("swe-ok"),  "SWE job should be visible");
  assert.ok(ids.includes("fe-ok"),   "Frontend job should be visible");
  assert.ok(!ids.includes("fw-bad"),     "Firmware Engineer must be excluded");
  assert.ok(!ids.includes("emb-bad"),    "Embedded Systems Engineer must be excluded");
  assert.ok(!ids.includes("bsp-bad"),    "BSP Engineer must be excluded");
  assert.ok(!ids.includes("bios-bad"),   "BIOS Software Engineer must be excluded");
  assert.ok(!ids.includes("driver-bad"), "Device Driver Engineer must be excluded");
});

test("firmware pool with role_key=engineering_embedded_firmware surfaces firmware jobs only", () => {
  const db = setupDb();
  db.exec(`
    INSERT INTO users VALUES (1, 'a');
    INSERT INTO scraped_jobs VALUES
      ('swe-job',  'Software Engineer',        'Acme', 'software engineer', 10, 1000, NULL),
      ('fw-job',   'Firmware Engineer',         'Acme', 'firmware engineer', 20, 1000, NULL),
      ('emb-job',  'Embedded Systems Engineer', 'Acme', 'firmware engineer', 20, 1000, NULL),
      ('bsp-job',  'BSP Engineer',              'Acme', 'firmware engineer', 20, 1000, NULL);
    INSERT INTO job_role_map VALUES
      ('swe-job', 'engineering',                'engineering', 'it_digital'),
      ('fw-job',  'engineering_embedded_firmware', 'engineering', 'engineering_embedded_firmware'),
      ('emb-job', 'engineering_embedded_firmware', 'engineering', 'engineering_embedded_firmware'),
      ('bsp-job', 'engineering_embedded_firmware', 'engineering', 'engineering_embedded_firmware');
  `);

  const rows = db.prepare(`
    SELECT sj.job_id
    FROM scraped_jobs sj
    JOIN job_role_map jrm ON jrm.job_id = sj.job_id
      AND jrm.role_key = 'engineering_embedded_firmware'
    WHERE (
      LOWER(sj.title) LIKE '%firmware%'
      OR LOWER(sj.title) LIKE '%embedded%'
      OR LOWER(sj.title) LIKE '%bsp%'
    )
    ORDER BY sj.job_id
  `).all();

  const ids = rows.map(r => r.job_id);
  assert.ok(!ids.includes("swe-job"), "SWE job must not appear in firmware pool");
  assert.ok(ids.includes("fw-job"),   "Firmware job must appear in firmware pool");
  assert.ok(ids.includes("emb-job"),  "Embedded job must appear in firmware pool");
  assert.ok(ids.includes("bsp-job"),  "BSP job must appear in firmware pool");
});

// ── Phase 6: data profile returns zero PM/ops/sales rows from mixed seed ─────
test("phase6: data profile board returns zero PM, ops, and sales rows from seeded mixed set", () => {
  const db = setupDb();
  db.exec(`
    INSERT INTO users VALUES (1, 'a');
    INSERT INTO domain_profiles VALUES (10, 1, 'Data Science', 'data', 'data', 1);
    INSERT INTO scraped_jobs VALUES
      ('data-ok',   'Data Scientist',          'Acme', 'data scientist',    10, 1000, NULL),
      ('data-ok2',  'Data Analyst',            'Acme', 'data analyst',      10, 1000, NULL),
      ('pm-bad',    'Product Manager',         'Acme', 'product manager',   NULL, 1000, NULL),
      ('ops-bad',   'Operations Manager',      'Acme', 'operations',        NULL, 1000, NULL),
      ('sales-bad', 'Account Executive',       'Acme', 'sales',             NULL, 1000, NULL),
      ('eng-bad',   'Software Engineer',       'Acme', 'software engineer', NULL, 1000, NULL),
      ('hr-bad',    'Recruiter',               'Acme', 'hr',                NULL, 1000, NULL);
    INSERT INTO job_role_map VALUES
      ('data-ok',   'data',       'data',       'data'),
      ('data-ok2',  'data',       'data',       'data'),
      ('pm-bad',    'pm',         'pm',         'pm_general'),
      ('ops-bad',   'operations', 'operations', 'general'),
      ('sales-bad', 'sales',      'sales',      'general'),
      ('eng-bad',   'engineering','engineering','it_digital'),
      ('hr-bad',    'hr',         'hr',         'general');
  `);

  // Simulate the Phase 6 board query: job_role_map join with role_key = 'data'
  const rows = db.prepare(`
    SELECT sj.job_id
    FROM scraped_jobs sj
    JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ?
    LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ?
    WHERE (uj.disliked IS NULL OR uj.disliked = 0)
    ORDER BY sj.scraped_at DESC
  `).all('data', 1);

  const ids = rows.map(r => r.job_id);
  assert.ok(ids.includes('data-ok'),   'data-ok must appear in data board');
  assert.ok(ids.includes('data-ok2'),  'data-ok2 must appear in data board');
  assert.ok(!ids.includes('pm-bad'),   'PM job must NOT appear in data board');
  assert.ok(!ids.includes('ops-bad'),  'ops job must NOT appear in data board');
  assert.ok(!ids.includes('sales-bad'),'sales job must NOT appear in data board');
  assert.ok(!ids.includes('eng-bad'),  'eng job must NOT appear in data board');
  assert.ok(!ids.includes('hr-bad'),   'hr job must NOT appear in data board');
  assert.equal(ids.length, 2, 'exactly 2 data jobs must be visible');
});

// Was "phase6: profileMatcher no longer exports resolveUserRoles or contains SKILL_TO_ROLE",
// which asserted scoreJob and filterAndRankForProfile "must still exist" — pinning the module
// alive after its last caller had gone. server.js imported filterAndRankForProfile and never
// called it (flagged in bb24241); the board has been ranked in SQL since the pivot. Flipped to a
// non-existence guard, matching the classifier.js precedent immediately below.
test("cleanup 5.7: profileMatcher.js is fully deleted, not just unused", () => {
  assert.equal(fs.existsSync("services/jobs/profileMatcher.js"), false,
    "services/jobs/profileMatcher.js must not exist — its only import was never called");
  const server = fs.readFileSync("server.js", "utf8");
  assert.doesNotMatch(server, /from\s+["']\.\/services\/jobs\/profileMatcher\.js["']/,
    "server.js must not import the deleted module");
  assert.doesNotMatch(server, /filterAndRankForProfile\s*\(/,
    "nothing may call filterAndRankForProfile");
});

test("phase6: classifier.js (Taxonomy A) is fully deleted, not just emptied", () => {
  assert.equal(fs.existsSync("services/jobs/classifier.js"), false,
    "services/jobs/classifier.js must not exist — classify() was already removed from it; " +
    "this asserts the now-inert file itself was deleted too, per its own " +
    "'safe to delete after confirming no remaining importers' comment");
});

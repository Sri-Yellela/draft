// THE AUTO APPLY PANEL IS ORGANISED AROUND OBSTACLES, NOT RUNS.
//
// It used to be a strip of run badges — "0✓ 1 review ↗" three times — plus a modal. "Run 47" is not
// a thing a user thinks about; they think about a job they want and what is stopping them. Worse,
// the strip flattened a rich terminal vocabulary into two words, "review" or "failed", losing the
// distinction that matters most:
//
//     WE DELIBERATELY HELD THIS TO PROTECT YOU        vs        THIS BROKE
//
// A resume below your ATS floor, a question we refused to guess, and an application filled and
// waiting for approval are the system working. A missing browser binary is not. Both said "failed".
//
// These tests pin the SERVER's four-way partition — which guarantees no application can fall out of
// every bucket — and the rule that every row names an obstacle and an action rather than a status
// code. The PANEL is now organised around three outcomes (needs review, submitted, problems) over a
// company tier, which is a different cut of the same data: the server's job is that nothing is lost,
// the panel's is that a human can act on it. AB4 separated held-on-purpose from broken INSIDE
// problems rather than leaving both under one word, which is the same flattening in a new place.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  describeApplication, sectionFor, boardApplicationChip, groupByApplication, groupByCompany,
  splitByFault, SECTION, PREREQUISITE_LABELS, prerequisitesByCause,
} from "../client/src/lib/applyObstacles.js";
// AD1: the outcome partition itself, so the sub-tab assertions read the shared source of truth
// rather than three literal words that could drift from what routes/apply.js files rows under.
import { OUTCOME, OUTCOME_LABELS } from "../shared/applyOutcomeGroups.js";
import { at } from "../test-support/sourceAnchors.js";
// D25: the Stopped column's items, as data — so the rules below are driven, not just read.
import { buildStoppedItems } from "../client/src/lib/draftHouseExceptions.js";
import { OUTCOME_STATUSES } from "../shared/applyOutcomeGroups.js";   // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): applyPanelLayoutAdoption's, merged below

const read = (p) => fs.readFileSync(p, "utf8");
const panel = read("client/src/panels/AutoApplyPanel.jsx");
const sections = read("client/src/panels/AutoApplyPanelSections.jsx");
const obstacles = read("client/src/lib/applyObstacles.js");
const card = read("client/src/components/JobCard.jsx");
const ctx = read("client/src/contexts/AutoApplyContext.jsx");
const applyRoute = read("routes/apply.js");

// ── The four surfaces ────────────────────────────────────────────────────────────────────────

test("the panel is organised as D113 UI's tree + side column — no sub-tabs, held-on-purpose never 'failed' (AB4 -> AD1 -> D25 -> D113 UI)", () => {
  // Was ["Needs you", "In flight", "Submitted", "Stopped"], then AB4's three SECTIONS, then AD1's
  // COMPLETED / PENDING / ABORTED sub-tabs over a dated listing. D25 (the workspace model) RE-PINS
  // it: the panel shows what STOPPED and needs the user, and what is QUEUED, side by side (D14).
  // ⛔ COMPLETED was a Sent column — that is The Table's (D15) — and terminal outcomes are history.
  assert.doesNotMatch(panel, /<PanelSubTabs/, "AD1's outcome sub-tabs are back");
  assert.doesNotMatch(panel, /OUTCOME\.COMPLETED/, "a Sent listing is back in Draft House");
  // D113 UI (owner 10-31) RE-PINS it: a vertical tree of runs whose jobs are bubbles, and a side column
  // for what matters now. Stopped is a ring and a filter, never a column of its own.
  // ⭐ D146 (changed on purpose, 11-03): the side column is gone — ONE tracker, the table and the timeline beside it.
  assert.match(panel, /<DraftHouseTree view=\{view\}/);
  // ⛔ 47j w1-retire (changed on purpose): R3 — Home's list is the ledger's register (the classic table is deleted)
  assert.match(panel, /<Register label="Your applications" rows=\{lgRows\}/);
  assert.doesNotMatch(panel, /DraftHouseSide/);
  // "Stopped" here is the D14 COLUMN of exceptions, never a SectionHeading that flattens
  // held-on-purpose into failed — only the BROKE half of splitByFault reaches it.
  assert.ok(!/SectionHeading[^>]*>\s*Stopped\s*</.test(panel),
    "the Stopped heading is back — it collapses held-on-purpose into failed");
  assert.match(panel, /splitByFault\(applyStopped\)\.broke/);
  // IN FLIGHT is NOT an outcome; it is progress, and it still has to exist: a Working on it bubble
  // (inFlight reaches the tree) with its own row and Stop in the branch.
  assert.match(panel, /inFlight: applyInFlight/);
  assert.match(panel, /variant="inFlight"/);
});

test("PROBLEMS keeps 'we protected you' distinguishable from 'this failed'", () => {
  // RE-PINNED FOR D25. The distinction survives as a FILTER on what needs the user: a failure is a
  // Stopped item ("did not complete — nothing was sent", with Retry where retrying can work); a
  // hold on purpose needs nobody and is not listed — it is history, and history is The Table's.
  assert.match(panel, /splitByFault\(applyStopped\)\.broke/);
  assert.doesNotMatch(panel, /splitByFault\(applyStopped\)\.held/);
  const { broke, held } = splitByFault([
    { id: 1, jobId: "a", status: "failed",   reasonCode: "internal_error" },
    { id: 2, jobId: "b", status: "failed",   reasonCode: "browser_binary_not_found" },
    { id: 3, jobId: "c", status: "rejected", reasonCode: null },
    { id: 4, jobId: "d", status: "held_review", reasonCode: "ats_below_threshold" },
  ]);
  assert.equal(broke.length, 2);
  assert.equal(held.length, 2, "a rejection and a protective hold are not failures");
  const items = buildStoppedItems({ brokeApplications: groupByApplication(broke) });
  assert.equal(items.length, 2);
  assert.ok(items.every(i => i.kind === "broke" && i.tone === "danger"));
  assert.ok(items.every(i => /did not complete — nothing was sent/.test(i.sub)));
});

test("the review modal groups by COMPANY — seven roles at one employer belong together", () => {
  // RE-PINNED FOR D25. The company TILES left the columns with AD1's listings; the Stopped column is
  // one item per application. The review modal — the deep review every item opens — keeps AB4's
  // company tier over AC2's application grouping, which is where reading seven roles together pays.
  assert.match(panel, /const modalCompanies\s+= groupByCompany\(modalApplications\)/);
  assert.doesNotMatch(panel, /<TileGrid/);
  assert.match(sections, /export function CompanyHeading/);

  const g = groupByCompany([
    { company: "OpenAI", title: "A", finishedAt: 3 },
    { company: "OpenAI", title: "B", finishedAt: 5 },
    { company: "Stripe", title: "C", finishedAt: 9 },
  ]);
  assert.equal(g.length, 2);
  // Biggest employer first — that is the group the user came here to find.
  assert.equal(g[0].company, "OpenAI");
  assert.equal(g[0].items.length, 2);
  // Most recent first within a company.
  assert.equal(g[0].items[0].title, "B");
  // A posting removed by the cleanup has no company; they collect under one honest heading.
  const anon = groupByCompany([{ company: null, finishedAt: 1 }, { company: "", finishedAt: 2 }]);
  assert.equal(anon.length, 1);
  // AE3: shared/atsHosts.js is the ONE place a company becomes display text.
  assert.match(sections, /\{companyLabel\(company\)\}/);
});

test("a missing resume is a BUTTON, and only where a resume is the problem (requirement 5)", () => {
  // "resume required" was left as text — a dead chip with a tooltip. It gets a one-click fix.
  assert.match(panel, /const generateResume = \(job\) => \{/);
  assert.match(sections, /Generate a resume/);
  // But keyed on the REASON, not on resumeAvailable: three rows can lack a resume while only one
  // stopped because of it, and a Generate button beside "the apply browser is not installed on the
  // server" contradicts the sentence directly above it.
  assert.match(sections, /onGenerateResume && d\.resumeBlocked/);
  assert.match(sections, /app\.reasons\.some\(r => r\.resumeBlocked\)/);
  assert.equal(describeApplication({ status: "failed", reasonCode: "resume_unavailable" }).resumeBlocked, true);
  assert.equal(describeApplication({ status: "failed", reasonCode: "generation_failed" }).resumeBlocked, true);
  for (const c of ["browser_binary_not_found", "internal_error", "manual_review", "login_required"]) {
    assert.equal(describeApplication({ status: "failed", reasonCode: c }).resumeBlocked, false,
      `"${c}" is not fixed by generating a resume, so it must not offer to`);
  }
  // An unknown reason must not opt in by accident.
  assert.equal(describeApplication({ status: "failed", reasonCode: "brand_new" }).resumeBlocked, false);
});

test("the server serves the four surfaces as a TOTAL partition", () => {
  // stopped is defined by EXCLUSION, so a status added later cannot fall through every bucket and
  // vanish — which is exactly what happened to held_gate when it was split out of held_review.
  assert.match(applyRoute, /const IN_FLIGHT\s+= \['queued', 'running'\]/);
  assert.match(applyRoute, /const NEEDS_YOU\s+= \['held_review', 'held_gate'\]/);
  assert.match(applyRoute, /rj\.status NOT IN \(\$\{\[\.\.\.IN_FLIGHT, \.\.\.NEEDS_YOU\]/);
  // D25: the in-flight rows also carry the server's own `abortable`, so Stop needs no client rule.
  assert.match(applyRoute, /inFlight: inFlight\.map\(r => \(\{ \.\.\.publicRunJob\(r\), abortable:/);
  assert.match(applyRoute, /submitted: submitted\.map\(publicRunJob\)/);
  assert.match(applyRoute, /stopped: stopped\.map\(publicRunJob\)/);
  // The counts that let a caller prove the partition is total.
  assert.match(applyRoute, /statusCounts/);
});

test("sectionFor is total — every status lands in exactly one section", () => {
  const statuses = ["queued", "running", "held_review", "held_gate", "submitted",
                    "failed", "rejected", "manual_review", "expired", "", "something_new"];
  const valid = new Set(Object.values(SECTION));
  for (const s of statuses) {
    const sec = sectionFor(s);
    assert.ok(valid.has(sec), `status "${s}" produced a section outside the four: ${sec}`);
  }
  assert.equal(sectionFor("queued"), SECTION.IN_FLIGHT);
  assert.equal(sectionFor("held_gate"), SECTION.NEEDS_YOU);
  assert.equal(sectionFor("submitted"), SECTION.SUBMITTED);
  // The catch-all, which is the property that matters: an unknown status is still SOMEWHERE.
  assert.equal(sectionFor("a_status_invented_next_year"), SECTION.STOPPED);
});

// ── Every row names an obstacle and an action, never a status code ───────────────────────────

test("every reason code the server can write has a plain-language presentation", () => {
  // Read the vocabulary off the SERVER rather than a hand-kept list, so teaching the pipeline a new
  // reason code fails here until someone writes the sentence for it.
  const emitted = new Set(
    [...applyRoute.matchAll(/reasonCode:\s*"([a-z_]+)"/g)].map(m => m[1])
      .concat([...applyRoute.matchAll(/\?\s*"([a-z_]+)"\s*$/gm)].map(m => m[1]))
  );
  // The ones this restructure is specifically about, named explicitly so the regex above drifting
  // cannot make this test vacuous.
  for (const c of ["ats_below_threshold", "awaiting_approval", "manual_review", "no_submit_button",
                   "resume_unavailable", "internal_error", "login_required", "captcha_required",
                   "incomplete_form", "low_confidence_answers", "no_fields_discovered"]) {
    emitted.add(c);
  }
  for (const code of emitted) {
    const d = describeApplication({ status: "held_review", reasonCode: code });
    assert.ok(d.obstacle && d.obstacle.length > 8,
      `reason code "${code}" has no obstacle sentence`);
    assert.ok(!/_/.test(d.obstacle),
      `reason code "${code}" renders as a code, not a sentence: "${d.obstacle}"`);
  }
});

test("the distinct terminal outcomes get DISTINCT sentences — none collapses into another", () => {
  const codes = ["ats_below_threshold", "awaiting_approval", "manual_review", "no_submit_button",
                 "submit_unverified", "no_fields_discovered", "resume_unavailable",
                 "internal_error", "browser_binary_not_found", "login_required", "captcha_required"];
  const seen = new Map();
  for (const c of codes) {
    const { obstacle } = describeApplication({ status: "held_review", reasonCode: c });
    assert.ok(!seen.has(obstacle),
      `"${c}" and "${seen.get(obstacle)}" render the SAME sentence — that is the flattening this ` +
      `restructure exists to undo`);
    seen.set(obstacle, c);
  }
  assert.equal(seen.size, codes.length);
});

test("held-on-purpose is distinguished from broken, which is the distinction the old UI lost", () => {
  const protective = ["ats_below_threshold", "awaiting_approval", "manual_review",
                      "login_required", "no_submit_button"];
  const broken = ["internal_error", "resume_unavailable", "browser_binary_not_found"];
  for (const c of protective) {
    assert.equal(describeApplication({ status: "held_review", reasonCode: c }).protective, true,
      `"${c}" is the system working as designed and must not read as a failure`);
  }
  for (const c of broken) {
    assert.equal(describeApplication({ status: "failed", reasonCode: c }).protective, false,
      `"${c}" is a real failure and must not read as a deliberate hold`);
  }
  // And the panel colours on it rather than on the status.
  // Re-pinned at UI step 2b (09-30): muted for held-on-purpose, danger for broken — as tokens.
  assert.match(sections, /d\.protective \? C\.INK_FAINT : C\.DANGER/);
});

test("retry is offered ONLY where retrying can work", () => {
  // "A 404 model ID and a login wall need different affordances" — offering Retry on something
  // permanent is a lie, so the row says so instead.
  assert.equal(describeApplication({ status: "failed", reasonCode: "internal_error" }).retryable, true);
  assert.equal(describeApplication({ status: "failed", reasonCode: "resume_unavailable" }).retryable, true);
  assert.equal(describeApplication({ status: "failed", reasonCode: "browser_binary_not_found" }).retryable, false);
  assert.equal(describeApplication({ status: "held_review", reasonCode: "no_submit_button" }).retryable, false);
  assert.equal(describeApplication({ status: "rejected" }).retryable, false);

  assert.match(sections, /variant === "stopped" && d\.retryable && onRetry/);
  assert.match(sections, /retrying will not change this/);
});

test("an unknown REASON on a known status inherits that status, and still reads as a sentence", () => {
  // held_review means the pipeline CHOSE to hold, whatever the reason turns out to be, so falling
  // back to the status is right and `protective` stays true. What must never happen is the raw code
  // reaching the screen.
  const d = describeApplication({ status: "held_review", reasonCode: "some_new_thing" });
  assert.ok(!/_/.test(d.obstacle), `an unmapped code leaked through as a code: "${d.obstacle}"`);
  assert.equal(d.protective, true, "a hold is deliberate even when its reason is new");
  assert.ok(d.action, "even an unknown outcome must offer the user something to do");
  assert.equal(d.code, "some_new_thing", "the raw code is kept for logs, just never rendered");
});

test("an unknown STATUS is filed as broken, never claimed as deliberate", () => {
  // This is the half that matters for honesty: an outcome nobody has described cannot be presented
  // as something the system did on purpose, and it lands in STOPPED rather than disappearing.
  const d = describeApplication({ status: "invented_next_year", reasonCode: "" });
  assert.equal(d.section, SECTION.STOPPED);
  assert.equal(d.protective, false);
  assert.ok(!/_/.test(d.obstacle), `an unmapped status leaked through as a code: "${d.obstacle}"`);
  assert.ok(d.action);
});

// ── The obstacle is grouped, and priced by what clearing it unblocks ─────────────────────────

test("the portal gate is ONE action with a count, not N rows", () => {
  // G5's amortisation, which the requirement calls the most differentiated thing in the product.
  // D25: one Stopped item per PORTAL, whatever the number of applications behind it.
  assert.match(panel, /gatePortals: applyGatePortals/);
  const items = buildStoppedItems({ gatePortals: [
    { origin: "https://acme.wd1.myworkdayjobs.com", host: "acme.wd1.myworkdayjobs.com", count: 4, gateReasons: ["login_required"] },
    { origin: "https://hard.example", host: "hard.example", count: 1, gateReasons: ["captcha_required"] },
  ] });
  assert.equal(items.length, 2, "two portals are two items, not five rows");
  assert.equal(items[0].title, "Sign in to acme.wd1.myworkdayjobs.com once");
  assert.match(items[0].sub, /^4 applications continue when you are signed in/);
  // A CAPTCHA portal is NOT offered a sign-in — it is named as the user's own job.
  assert.match(items[1].title, /behind an identity check/);
  assert.equal(items[1].tone, "danger");
  // D113 UI: the portal item is the side column's first block, its fix named for what it is.
  assert.match(fs.readFileSync("client/src/lib/draftHouseTree.js", "utf8"), /\(i\.ref\?\.gateReasons \|\| \[\]\)\.includes\("captcha_required"\) \? "Open them" : "Sign in"/);
});

test("the grouping has TWO halves, and each is used where it is true (AB2)", () => {
  //   group by OBSTACLE      when ONE action unblocks MANY applications  (the portal items)
  //   group by APPLICATION   when MANY obstacles block ONE application   (held reviews)
  // Both halves are asserted here so neither can be quietly dropped in favour of the other again.
  assert.match(panel, /const heldApplications = groupByApplication\(applyReviewJobs\)/);
  assert.ok(!/const heldByObstacle = new Map\(\)/.test(panel),
    "held applications are grouped by obstacle again — one application with three problems is three cards");
  const held = groupByApplication([
    { id: 1, jobId: "j1", company: "OpenAI", title: "Staff", status: "held_review", reasonCode: "login_required", finishedAt: 1 },
    { id: 2, jobId: "j1", company: "OpenAI", title: "Staff", status: "held_review", reasonCode: "ats_below_threshold", finishedAt: 2 },
  ]);
  const items = buildStoppedItems({ heldApplications: held,
    gatePortals: [{ origin: "o", host: "h.example", count: 3, gateReasons: ["login_required"] }] });
  assert.equal(items.filter(i => i.kind === "held").length, 1, "one application, one item");
  assert.equal(items.find(i => i.kind === "held").fold.needs.length, 2, "carrying both obstacles");
  assert.equal(items.filter(i => i.kind === "portal").length, 1);
});

test("one application with several obstacles is ONE entry, carrying all of them", () => {
  // The exact observed defect: the same OpenAI application three times, once per problem. The server
  // returns one row per RUN-JOB, so a job held / re-run / held again is three rows.
  const rows = [
    { id: 3, jobId: "j1", company: "OpenAI", title: "Staff Engineer", status: "held_review",
      reasonCode: "captcha_required", finishedAt: 3000 },
    { id: 2, jobId: "j1", company: "OpenAI", title: "Staff Engineer", status: "held_review",
      reasonCode: "manual_review", finishedAt: 2000 },
    { id: 1, jobId: "j1", company: null, title: null, status: "held_review",
      reasonCode: null, finishedAt: 1000 },
  ];
  const grouped = groupByApplication(rows);
  assert.equal(grouped.length, 1, "three problems on one application produced three cards again");
  assert.equal(grouped[0].reasons.length, 3, "the obstacles were collapsed away with the rows");
  // Company and role must be present: "One application — Held for you to look at" names neither.
  assert.equal(grouped[0].company, "OpenAI");
  assert.equal(grouped[0].title, "Staff Engineer");
  // Newest first, so the current state of the application leads.
  assert.equal(grouped[0].primary.code, "captcha_required");
  assert.equal(grouped[0].attempts, 3);
});

test("two DIFFERENT applications stay two cards, and identical walls collapse", () => {
  const two = groupByApplication([
    { id: 1, jobId: "a", company: "OpenAI", title: "A", status: "held_review", reasonCode: "manual_review", finishedAt: 1 },
    { id: 2, jobId: "b", company: "Anthropic", title: "B", status: "held_review", reasonCode: "manual_review", finishedAt: 2 },
  ]);
  assert.equal(two.length, 2, "grouping by application must not merge different applications");
  assert.equal(two[0].company, "Anthropic", "most recent application first");

  // Two attempts against the SAME wall are one thing to resolve, not two.
  const dup = groupByApplication([
    { id: 1, jobId: "a", company: "OpenAI", status: "held_review", reasonCode: "manual_review", finishedAt: 1 },
    { id: 2, jobId: "a", company: "OpenAI", status: "held_review", reasonCode: "manual_review", finishedAt: 2 },
  ]);
  assert.equal(dup.length, 1);
  assert.equal(dup[0].reasons.length, 1, "the same obstacle twice is one thing to resolve");
  assert.equal(dup[0].attempts, 2, "but both attempts are still counted");
});

test("a row with no job id is its own card, never merged into an `undefined` bucket", () => {
  // Merging them would produce one card claiming to be one application while standing for several.
  const g = groupByApplication([
    { id: 1, status: "held_review", reasonCode: "manual_review", finishedAt: 1 },
    { id: 2, status: "held_review", reasonCode: "incomplete_form", finishedAt: 2 },
  ]);
  assert.equal(g.length, 2);
});

test("the card names the application, and counts OBSTACLES rather than applications", () => {
  // A big "1" beside three separate cards is what made one job look like three.
  assert.match(sections, /export function ApplicationObstacleCard/);
  // 45n D182 (bb297b05, owner 11-08 decision (8)) removed the "One application · N things to resolve" line as a label
  // restating the screen — the count beside the card is still of OBSTACLES (pin moved on purpose).
  assert.doesNotMatch(sections, /One application · \{app\.reasons\.length\}/);
  assert.match(sections, /color: tone \}\}>\{app\.reasons\.length\}<\/span>/);
  assert.match(sections, /\{companyLabel\(app\.company\)\}/);
  assert.match(sections, /to resolve\s*\n\s*<\/span>/);
  // Every obstacle is listed INSIDE the card. AC2 put a `plan` in front of this list — the same
  // problems with the co-resolvable ones lifted out — so the flat map is now the fallback arm and
  // the panel's own cards still take it. Both arms are asserted, because dropping either would
  // silently stop listing an application's problems on one of the two surfaces.
  assert.match(sections, /: app\.reasons\.map\(\(r, i\) => \(/,
    "the flat obstacle list is gone — the panel's own cards would list nothing");
  assert.match(sections, /\{plan\s*$/m, "the grouped arm is gone — the modal would list nothing");
});

test("the needs-you count is in APPLICATIONS, not run-job rows", () => {
  // One application held three times used to add 3 to the heading and to the tab badge.
  assert.match(panel, /applyQuestions\.length \+ applyPending\.length \+ heldApplications\.length/);
});

test("prerequisites are surfaced BEFORE queueing, as one blocking item with a fix", () => {
  // The gate already computed this and only spoke as a 409 after the user tried to start a run.
  assert.match(ctx, /api\("\/api\/integrations\/status"\)/);
  assert.match(ctx, /setApplyPrereqMissing/);
  // D25: a Stopped item each, FIRST — they block every application — with the label's own fix.
  assert.match(panel, /prereqMissing: applyPrereqMissing, prereqLabels: PREREQUISITE_LABELS/);
  const items = buildStoppedItems({
    prereqMissing: ["profile_email"], prereqLabels: PREREQUISITE_LABELS,
    pending: [{ runJobId: 9, company: "Acme", answerCount: 3, guessCount: 0 }],
  });
  assert.equal(items[0].kind, "prerequisite", "prerequisites come before everything they block");
  assert.equal(items[0].title, PREREQUISITE_LABELS.profile_email.obstacle);
  assert.deepEqual(items[0].fold.needs, [PREREQUISITE_LABELS.profile_email.action]);
  for (const key of ["base_resume", "active_profile", "profile_email", "profile_name"]) {
    assert.ok(PREREQUISITE_LABELS[key], `no plain-language label for prerequisite "${key}"`);
    assert.ok(!/_/.test(PREREQUISITE_LABELS[key].obstacle));
  }
});

test("A216 (46r) · no résumé yet is ONE blocker row — not 'No base resume' + 'No active job profile'", () => {
  // The server lists the two apart; with no profile there is no base résumé either, and one upload clears both.
  assert.deepEqual(prerequisitesByCause(["base_resume", "active_profile", "profile_email"]), ["resume", "profile_email"]);
  assert.deepEqual(prerequisitesByCause(["active_profile"]), ["resume"]);
  // A profile that exists but has no base résumé keeps its own row.
  assert.deepEqual(prerequisitesByCause(["base_resume", "profile_name"]), ["base_resume", "profile_name"]);
  assert.deepEqual(prerequisitesByCause(undefined), []);
  const items = buildStoppedItems({ prereqMissing: prerequisitesByCause(["base_resume", "active_profile"]), prereqLabels: PREREQUISITE_LABELS });
  assert.equal(items.filter(i => i.kind === "prerequisite").length, 1);
  assert.equal(items[0].title, "Add your résumé — draft sets up your profile from it");
  assert.equal(PREREQUISITE_LABELS.resume.to, "job-profiles");
  // The context collapses at the read, so the rows, the counts and the Draft button's reason all see one cause.
  assert.match(ctx, /setApplyPrereqMissing\(prerequisitesByCause\(st\?\.apply\?\.missing\)\)/);
});

// ── AB3: Open is scoped to the card ──────────────────────────────────────────────────────────

test("the popup was never GIVEN a scope — that is the defect, not a scope it ignored", () => {
  // AB3 requirement 2 asks which of the two it is. It is the first: `openReview` took no arguments,
  // all seven cards passed the same bare function, and the modal had no scoping parameter at all.
  assert.match(ctx, /const \[applyReviewScope, setApplyReviewScope\] = useState\(null\)/);
  assert.match(ctx, /applyReviewScope, setApplyReviewScope,/);
  assert.match(panel, /const openScoped = \(s\) => \{ setApplyRunDetail\(null\); setApplyReviewScope\(s\); setApplyRunDetailOpen\(true\); \}/);
  assert.match(panel, /const openApplicationReview = \(app\) => openScoped\(\{/);
  // D25: every Stopped item opens the popup on the thing it stands for — a held application's
  // attempts, an approval's own answers.
  assert.match(panel, /onClick=\{\(\) => openApplicationReview\(r\)\}/);
  assert.match(panel, /const openApprovalReview = \(p\) => openScoped\(\{/);
});

// ── AC1: Open is STILL unscoped — the half-fix, and the assertion that closes the class ──────

test("AC1: no CARD-LEVEL handler can name the unscoped entry point, whatever its shape", () => {
  // THE DIAGNOSIS. Not (a) a regression and not (c) a scope ignored downstream: (b) a HALF-FIX.
  // AB3 rewrote every call site whose SHAPE was `onAction={openReview}` / `onDetails={() =>
  // openReview()}` and left the one whose shape differed — `openReview` as the fallback arm of a
  // ternary on `onResolve`. Details was scoped; Open, on the same card, was not.
  //
  // THE MECHANISM. A fix applied by rewriting the call sites that MATCH A PATTERN, while the wrong
  // handler stays in scope as a bare zero-argument callable any site can still name. The pattern
  // covers the shapes the author looked at; the IDENTIFIER covers every shape. So this assertion is
  // written on the identifier, not on a call-site shape — the same reason the earlier assertion in
  // this file (`!/onAction={openReview}/`) failed to catch it.
  const code = panel.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!/\bopenReview\b/.test(code),
    "the unscoped handler is still named `openReview` in live code — rename it away from the word " +
    "every card's control uses, or the next card-level prop will reach for it again");
  // The unscoped path exists, under a name no card control would reach for by habit.
  assert.match(panel, /const openEverything = \(\) => openScoped\(null\)/);

  // EVERY card-level handler prop must pass something scoped. Read the props off the source rather
  // than trusting one hand-written list: a prop added later is covered without editing this test.
  const CARD_HANDLER_PROPS = /\b(onResolve|onDetails|onAction|onSecondary)=\{([^}]*)\}/g;
  const UNSCOPED = /\bopenEverything\b/;
  for (const [whole, prop, expr] of code.matchAll(CARD_HANDLER_PROPS)) {
    assert.ok(!UNSCOPED.test(expr),
      `${prop} reaches the unscoped "everything" handler — its Open shows every application: ${whole}`);
  }
  // ...and openEverything is reached from exactly ONE place: the deliberate Review-all control.
  const reaches = [...code.matchAll(/openEverything/g)].length;
  assert.equal(reaches, 2, "openEverything must be declared once and called from ONE control");
  assert.match(panel, /<button onClick=\{openEverything\}/);
});

test("AC1: Open and Details on the same card scope to the SAME one application", () => {
  // The bug was that they did not: Details went through openApplicationReview, Open went bare. Both
  // arms are now the scoped handler, so they cannot disagree. D25: the rail's Open and the fold's
  // "Show attempts" on a held item.
  assert.match(panel, /onClick: resumable \? \(\) => openHandoff\(packet, r\) : \(\) => openApplicationReview\(r\)/);
  assert.match(panel, /onClick=\{\(\) => openApplicationReview\(r\)\}/);
  // ApplicationObstacleCard (the modal's card) must actually PASS the app.
  assert.match(sections, /onClick=\{\(\) => onResolve\(app\)\}/,
    "the card calls onResolve with no argument, so a scoped handler gets no application");
});

test("EVERY feed the popup renders is filtered by the scope, including the bulk actions", () => {
  // Scoping the visible list but not the bulk action would be worse than not scoping at all: a
  // popup titled with one application, whose "Approve all" submitted every pending one.
  for (const needle of [
    /const scopedReviewJobs = facet\("applications"\)/,
    /const scopedPending    = facet\("pending"\)/,
    /const scopedQuestions  = facet\("questions"\)/,
    /\(applyRunDetail \? applyRunDetail\.jobs : scopedReviewJobs\)/,
    /\{!applyRunDetail && scopedPending\.length > 0 && \(/,
    /\{!applyRunDetail && scopedQuestions\.length > 0 && \(/,
    /decidePending\(scopedPending\.map\(p => p\.runJobId\), true\)/,
    /Approve all \{scopedPending\.length\}/,
  ]) {
    assert.match(panel, needle, `an unscoped feed survives in the popup: ${needle}`);
  }
  // And nothing inside the modal reads the unscoped lists any more.
  const modal = panel.slice(at(panel, "Apply Runs Review Modal"));
  assert.ok(!/applyPending\.(length|map)/.test(modal),
    "the modal still reads the full pending list");
  assert.ok(!/applyQuestions\.(length|map)/.test(modal),
    "the modal still reads the full question list");
});

test("a portal batch is never shown inside a popup scoped to one application", () => {
  // A batch is BY DEFINITION about several applications.
  assert.match(panel, /\{!applyRunDetail && !scope && applyGatePortals\.length > 0 && \(/);
});

test("the popup SAYS which application it is about, and the empty state does too", () => {
  // It used to be titled "Jobs Needing Review" whichever row opened it — the honest name for a
  // popup that was always showing all of them.
  assert.match(panel, /: scope \? scope\.label/);
  assert.match(panel, /"Every application needing review"/);
  // The old title must not be RENDERED. It is still named in the comment that explains why it went,
  // so the check looks at the JSX expression rather than anywhere in the file.
  assert.ok(!/\?\s*"Jobs Needing Review"|:\s*"Jobs Needing Review"/.test(panel),
    "the popup is titled 'Jobs Needing Review' again — the honest name for one showing all of them");
  assert.match(panel, /Nothing left to resolve on \$\{scope\.label\}/);
});

test("REVIEW ALL survives as a deliberate, separate control", () => {
  // Requirement 3: it may exist — it is genuinely useful for working a queue in one sitting — but it
  // must not be what every row's Open does.
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): "Review all {reviewAppsCount} →" is asserted below in "AD1 requirement 5 -> D25", inside the timeline's side column (stricter)
  assert.match(panel, /const openEverything = \(\) => openScoped\(null\)/);
});

test("closing the popup clears the scope, so the next open cannot inherit the last card's", () => {
  assert.match(panel, /const closeReview = \(\) => \{ setApplyRunDetailOpen\(false\); setApplyRunDetail\(null\); setApplyReviewScope\(null\); \}/);
  assert.ok(!/setApplyRunDetailOpen\(false\); setApplyRunDetail\(null\); \}/.test(panel),
    "a close path still leaves the scope behind");
});

test("a run detail outranks an application scope — a run is its own question", () => {
  assert.match(panel, /const scope = applyRunDetail \? null : applyReviewScope/);
});

// ── The board and the pipeline stop being separate worlds ────────────────────────────────────

test("the board card shows its application state, from the SAME vocabulary", () => {
  assert.match(card, /import \{ boardApplicationChip \} from "\.\.\/lib\/applyObstacles\.js"/);
  assert.match(card, /<ApplyStateChip jobId=\{job\.jobId \|\| job\.id\}\/>/);
  assert.match(ctx, /applyStateByJobId/);

  // A job with no application adds nothing to the card — the board must not grow a column of blanks.
  assert.equal(boardApplicationChip(null), null);
  assert.equal(boardApplicationChip({}), null);
  assert.equal(boardApplicationChip({ status: "submitted" }).label, "Applied");
  assert.equal(boardApplicationChip({ status: "held_gate" }).label, "Needs you");
  assert.equal(boardApplicationChip({ status: "running" }).label, "Applying now");
  // Broken vs held-on-purpose survives onto the board too.
  assert.equal(boardApplicationChip({ status: "failed", reasonCode: "internal_error" }).label, "Didn't send");
  assert.equal(boardApplicationChip({ status: "rejected" }).label, "Stopped");
});

test("the needs-review count is still reachable from the board", () => {
  // Y4 put a badge on the AUTO APPLY tab; the restructure must not have cost it.
  assert.match(ctx, /needsAttentionCount: applyPending\.length \+ applyReviewJobs\.length \+ applyQuestions\.length/);
});

// ── Nothing was dropped ──────────────────────────────────────────────────────────────────────

test("every capability of the old strip survived the reorganisation", () => {
  for (const [what, needle] of [
    ["the readiness gate",      /applyReadiness && !applyReadiness\.available/],
    ["retry drafts again",      /const retryJob = async \(job\) => \{[\s\S]{0,200}?await draftJob/],
    // D25 REMOVED AD1's dated navigation and outcome tabs: Draft House shows what needs the user
    // now, and the dated record of what happened is The Table's (D15). What remains here is the
    // control over what is still live.
    // D113 UI: the run bar became the header — the mode, Pause (= Stop everything), Settings.
    ["the run bar",             /onClick=\{\(\) => setStopEverything\?\.\(!held\)\}/],
    ["stop, on in flight",      /onAbort=\{rowAbort\}/],
    ["soft delete",             /const hideApplication = \(app\) =>/],
    ["per-run detail",          /onOpenRun=\{loadApplyRunDetail\}/],
    ["the run's own status",    /applyRunDetail\.run\.status === "completed"/],
    ["the approvals surface",   /pending: applyPending/],
    ["approve from the fold",   /decidePending\(\[r\.runJobId\], true\)/],
    ["the questions surface",   /Answer \{scopedQuestions\.length\}/],
    ["bulk approve guard",      /confirmApproveAll/],
    ["artifact links",          /artifactUrl/],
  ]) {
    assert.match(panel, needle, `${what} did not survive the restructure`);
  }
});

test("the obstacle vocabulary is the only place these sentences live", () => {
  // If the panel started writing its own copy for a reason code, the board's chip and the panel
  // would drift — which is the class of bug the shared registry work has been closing all along.
  // The member list is not the point — that the panel READS the shared vocabulary is. Pinning the
  // exact list made this fail the moment the panel legitimately needed a second symbol from it.
  //
  // Nor is WHICH symbol the point. AC2 moved the modal's per-attempt row into the sections module,
  // and describeApplication went with it — the panel no longer calls it directly, and importing a
  // symbol it does not use would be dead code added to satisfy a test. So the assertion is that
  // the panel imports its vocabulary FROM applyObstacles.js and writes none of its own.
  assert.match(panel, /import \{[\s\S]{0,200}?\} from "\.\.\/lib\/applyObstacles\.js"/);
  assert.match(sections, /import \{[^}]*describeApplication[^}]*\} from "\.\.\/lib\/applyObstacles\.js"/);
  assert.ok(!/reasonCode === "/.test(panel),
    "the panel is branching on a reason code again — that belongs in applyObstacles.js");
  assert.ok(!/status === "held_review"/.test(sections),
    "the row component is branching on a status again — it must ask the shared vocabulary");
  assert.match(obstacles, /export function describeApplication/);
  // The STATUS PILL is vocabulary too, and it is a different question from describeApplication's:
  // "how did this attempt end" in one word, beside a timestamp, versus "what is in the way and what
  // clears it" in a sentence. It was written inline in the modal as a chain of ternaries — a second
  // copy of a mapping the rest of the app already had — so that surface said "Failed" where the
  // panel behind it said "This one did not complete". It has a home now.
  assert.match(obstacles, /export function attemptStatusChip/);
  assert.match(sections, /attemptStatusChip\(job\.status, theme\.accent\)/);
  assert.ok(!/status === "submitted" \? "Submitted"/.test(sections),
    "the attempt row is writing its own status labels again");
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// APPLY PANEL LAYOUT ADOPTION — AD1 (was test/applyPanelLayoutAdoption.test.js)
// ⭐ A232 R6 (46y, owner 11-19 "all four approved"): test/applyPanelLayoutAdoption.test.js merged into this file (docs/A232_TEST_AUDIT.md §4 — 5 assertions shared word for word).
// Its tests follow in ONE block, so its own top-level names (it declares some of the same ones as above) stay its
// own. An assertion it repeated word for word is kept once — where it says the most — and named where it went.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
{
// TASK AD1 — THE AUTO APPLY PANEL ADOPTS THE DATABASE PANEL'S LAYOUT.
//
// The panel was a STACK: a queue, an in-flight section, a needs-review section, a submitted section,
// a problems section, and then — underneath all of it — a separate dated run-history surface showing
// the same records a second time in a smaller rendering. Six things down one page, two of which were
// the same rows.
//
// It is now the shape the Database panel has always been: a sub-tab row with per-tab counts, a
// control row with a search box and a "Filter by date" calendar, and a body. The three sub-tabs are
// AC4's outcome partition — COMPLETED / PENDING / ABORTED — so the run history is not "removed", it
// IS the panel now.
//
// What these tests hold:
//   1. the chrome is REUSED, not cloned, and the Database panel renders the same components
//   2. the removed run-history surface lost nothing — every consumer still has what it needs
//   3. nothing is fetched until a date is picked, and a tab switch fetches ONE tab
//   4. the counts are date-scoped and SAY so
//   5. PENDING is where you land
//   6. everything AC1–AC4 delivered is still on the page
//   8. the AUTO APPLY tab badge still counts what needs attention, without a preload
//
// (Requirement 7 — the three empty states — is pinned in applyRunHistory.test.js beside the two
// states it grew out of, and the totality of the status mapping is pinned there too.)
//
// ⛔ D25 (10-04) RETIRED MOST OF AD1 ON PURPOSE. Draft House is now the workspace model: a run bar,
// what STOPPED, and what is QUEUED — no outcome sub-tabs (COMPLETED was a Sent column, and Sent is
// The Table's, D15), no calendar, no company tiles. The tests below that described AD1's tabs,
// date-scoped counts, landing tab and browser harness were deleted with the thing they described;
// the ones that still hold a rule were RE-PINNED to the D25 shape and say so. What did NOT change,
// and is still asserted: PanelControls is one implementation the Database panel renders (and Draft
// House reuses rather than forks), the chrome owns no panel state, nothing loads a listing nobody
// asked for, and the tab badge needs no preload. The workspace's own rules are in
// test/d25DraftHouseWorkspace.test.js.
const read = (f) => fs.readFileSync(f, "utf8");
const panel    = read("client/src/panels/AutoApplyPanel.jsx");
const sections = read("client/src/panels/AutoApplyPanelSections.jsx");
const ctx      = read("client/src/contexts/AutoApplyContext.jsx");
const dbPanel  = read("client/src/panels/DatabasePanel.jsx");
const controls = read("client/src/components/ui/PanelControls.jsx");
const applyRoute = read("routes/apply.js");

// ── Requirement: REUSE, DO NOT CLONE ─────────────────────────────────────────────────────────

test("PanelControls is ONE implementation: the Database panel renders it, Draft House reuses it (AD1 -> D25)", () => {
  // AD1's rule — "a second copy of this layout is how two surfaces drift apart" — survives D25,
  // which removed AD1's tabs and calendar from Draft House. What remains of the chrome there is the
  // search box, and it is the SHARED one, imported, never redrawn.
  for (const name of ["PanelSubTabs", "PanelSearch", "DateFilterButton"]) {
    assert.ok(new RegExp(`export function ${name}\\(`).test(controls),
      `${name} was not extracted`);
    assert.ok(new RegExp(`<${name}`).test(dbPanel), `DatabasePanel does not render ${name}`);
    assert.ok(!new RegExp(`function ${name}\\b`).test(panel), `Draft House forked its own ${name}`);
  }
  assert.match(panel, /import \{ PanelSearch \} from "\.\.\/components\/ui\/PanelControls\.jsx";/);
  assert.match(panel, /<PanelSearch /);
  // And neither panel writes the markup any more. These are the exact strings the two copies would
  // reintroduce: the underline, the magnifier, the pill's label.
  for (const [name, src] of [["DatabasePanel", dbPanel], ["AutoApplyPanel", panel]]) {
    assert.ok(!/layoutId="db-tab-underline"[\s\S]{0,200}?<motion\.div/.test(src),
      `${name} is drawing its own tab underline again`);
    assert.ok(!/pointerEvents:"none", color:theme\.textDim \}\}>🔍/.test(src),
      `${name} is drawing its own search box again`);
  }
  assert.match(controls, /pointerEvents: "none", color: theme\.textDim \}\}>🔍/);
  assert.match(controls, /📅 \{value \? `Date: \$\{format\(value\)\}` : label\}/);
});

test("AD1: the shared chrome owns no panel state — the two panels fetch entirely differently", () => {
  // The Database panel loads everything on mount; the Auto Apply panel loads nothing until a date is
  // picked. A shared component that owned "which tab" or "which date" would have to pick one of
  // those rules for both, and the wrong one violates requirement 3 outright. So the only state in
  // here is whether the popover happens to be open, which is nobody else's business.
  const stateful = [...controls.matchAll(/useState\(/g)];
  assert.equal(stateful.length, 2, "PanelControls grew state that belongs to a panel");
  assert.match(controls, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(controls, /const \[rect, setRect\] = useState\(null\)/);
  // Active tab, search text and selected date all arrive as props.
  for (const prop of ["active", "onSelect", "value", "onChange"]) {
    assert.ok(new RegExp(`\\b${prop}[,}]`).test(controls), `${prop} is not a prop of the chrome`);
  }
});

test("AD1: the Database panel's own behaviour is unchanged by the extraction", () => {
  // Its four sheets, their counts, the rule that changing sheet clears the search and the date
  // filter, and the two toolbar buttons that ride along on the tab row. The behaviour is the
  // panel's; only the markup moved.
  // D15 put The Table's history first and renamed the editable sheet "Spreadsheet" (ids unchanged); D103 added Inbox last.
  assert.match(dbPanel, /const SHEETS = \[\["history","History"\],\["applications","Spreadsheet"\],\["resumes","Resumes"\],\["saved","Saved Jobs"\],\["pending","Pending Apply"\],\["not_applied","Not applied"\],\["inbox","Inbox"\]\]/, "D112 c2 added Not applied beside Pending");
  assert.match(dbPanel, /onSelect=\{\(id\) => \{ setActiveSheet\(id\); setSearch\(""\); setFilterDate\(""\); \}\}/);
  assert.match(dbPanel, /count: id === "applications" \? apps\.length/);
  assert.match(dbPanel, /Export Excel/);
  assert.match(dbPanel, /\{loading \? "⏳" : "↻"\} Refresh/);
  // The date filter is still only offered on the Applications sheet, and it still clears.
  assert.match(dbPanel, /\{isApps && \(\s*\n\s*<DateFilterButton/);
  assert.match(dbPanel, /onClear=\{\(\) => setFilterDate\(""\)\}/);
  // No markers: the one thing AC4 added to the calendar is opt-in and this panel did not opt in.
  assert.ok(!/markers=/.test(dbPanel));
});

// ── Requirement 2: the run-history surface is gone, and nothing went with it ─────────────────

test("AD1 requirement 2: the separate run-history surface is removed — and D25 says where the tiles went", () => {
  assert.ok(!/export function HistoryGroup/.test(sections), "HistoryGroup survived");
  assert.ok(!/export function HistoryRow/.test(sections), "HistoryRow survived");
  assert.ok(!/<HistoryGroup|<HistoryRow/.test(panel), "the panel still renders the history components");
  assert.ok(!/SectionHeading[^>]*>\s*Run history\s*</.test(panel),
    "the Run history section heading is back");
  // The enumeration of where each piece went is the deliverable, not decoration: a removal that
  // does not say what it moved is indistinguishable from a removal that dropped something. D25
  // removed the company tiles AD1's listing rendered, and accounts for them the same way.
  assert.match(sections, /THE COMPANY TILES ARE GONE/);
  for (const moved of ["Abort", "Remove", "obstacle sentences", "Details", "BROKE"]) {
    assert.ok(sections.includes(moved), `the enumeration does not account for "${moved}"`);
  }
  assert.ok(!/export function (CompanyTile|CompanyApplicationRow|ObstacleCard|PrerequisiteCards)\b/.test(sections),
    "a component D25 retired is still exported with nothing rendering it");
});

test("AD1 requirement 2: every consumer of the removed surface still has what it needs", () => {
  // runInFlight (the polling) and nothingYet read the CROSS-RUN feeds, never the dated history.
  const inFlight = ctx.match(/const runInFlight = [^\n]+/)[0];
  assert.match(inFlight, /applyRuns\.some\(r => r\.status === "queued" \|\| r\.status === "running"\)/);
  assert.ok(!/history/i.test(inFlight), "runInFlight now depends on the dated history");
  const nothingYet = panel.slice(at(panel, "const nothingYet ="),
                                 at(panel, "// ── AB2: ONE ITEM PER APPLICATION"));
  assert.ok(!/history/i.test(nothingYet), "nothingYet now depends on the dated history");
  for (const feed of ["applyMsg", "applyRuns", "applyReviewJobs", "applyPending", "applyQuestions",
                      "applyInFlight", "applySubmitted", "applyStopped", "applyPrereqMissing"]) {
    assert.ok(nothingYet.includes(feed), `nothingYet lost its ${feed} term`);
  }
  // PER-RUN DETAIL: on every in-flight row, and on every BROKE item's rail and fold; the run's own
  // status still renders in the modal header that opens.
  assert.match(panel, /onOpenRun=\{loadApplyRunDetail\}/);
  assert.match(panel, /loadApplyRunDetail\(row\.runId\)/);
  assert.match(panel, /applyRunDetail\.run\.status === "completed"/);
});

// ── Requirement 3: on demand, and one tab per fetch ──────────────────────────────────────────

test("AD1 requirement 3 -> D25: no effect anywhere loads the listing, and nothing asks for a day", () => {
  // AD1: nothing is fetched for a day nobody named. AH6 then added ONE mount effect that asked
  // /api/apply/history/latest and opened that day; D25 removed it with the calendar it fed — a day
  // nobody renders is two requests per sign-in for nothing.
  for (const effectBody of ctx.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)) {
    assert.ok(!/loadHistory\b|selectHistoryGroup\b/.test(effectBody[1]),
      "an effect loads the dated history again");
  }
  assert.doesNotMatch(ctx, /api\(`\/api\/apply\/history\/latest/, "the latest-day bootstrap request is back");
  assert.doesNotMatch(panel, /loadHistory\(|historyDate/, "Draft House reads the dated listing again");
  assert.match(ctx, /const \[historyDate, setHistoryDate\] = useState\(null\)/);
  assert.match(ctx, /const \[history, setHistory\] = useState\(null\)/);
});

test("the dated history endpoint still narrows to ONE group on the server", () => {
  // The client's sub-tabs went with D25; the endpoint did not, and its contract is unchanged: a
  // `group` it does not recognise is refused rather than answered with everything.
  assert.match(applyRoute, /if \(asked && !Object\.prototype\.hasOwnProperty\.call\(OUTCOME_STATUSES, asked\)\)/);
  assert.match(applyRoute, /error: "bad_group"/);
  assert.match(applyRoute, /\? \{ group: asked, jobs: groups\[asked\] \}/);
  assert.equal((ctx.match(/api\(\s*\n?\s*`\/api\/apply\/history\?/g) || []).length, 1,
    "the history is fetched from more than one place — they will disagree");
});

// ── Requirement 4: the counts, and the decision behind them ──────────────────────────────────


// ── Requirement 5: where you land ────────────────────────────────────────────────────────────

test("AD1 requirement 5 -> D25: the actionable work is not behind any tab — it IS the page", () => {
  // AD1 made PENDING the landing tab so the work was not buried behind COMPLETED. D25 removes the
  // tabs: the actionable work — portals, questions, approvals, prerequisites, holds — is the
  // Stopped column, always rendered, and nothing gates it on a selection.
  assert.doesNotMatch(panel, /historyGroup/);
  // D113 UI: the work is the tree's bubbles, always rendered. ⭐ D146 (changed on purpose): the side column is gone —
  // the work is the table's rows (counts + Needs you filter), and Review all sits under the timeline.
  const side = panel.slice(at(panel, "const timelineExtra = {"), at(panel, "running: (applyLine.waiting"));
  assert.match(side, /Review all \{reviewAppsCount\} →/ /* 46q: applications only, as "needs you" counts */);
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): <DraftHouseTree view={view} and <ApplicationTracker rows={shownRows} are asserted above in "the panel is organised as D113 UI's tree + side column"
  for (const feed of ["prereqMissing: applyPrereqMissing", "gatePortals: applyGatePortals",
                      "questions: applyQuestions", "pending: applyPending", "heldApplications, brokeApplications"]) {
    assert.ok(panel.includes(feed), `${feed} no longer reaches the Stopped column`);
  }
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): inFlight: applyInFlight is asserted above in "the panel is organised as D113 UI's tree + side column"
});

test("D25: the standing work reads the cross-run feeds — there is no date picker to hide it behind", () => {
  assert.doesNotMatch(panel, /<DateFilterButton|<PanelSubTabs/);
  const tree = panel.slice(at(panel, "const nodes = buildNodes({"), at(panel, "const tree = buildTree("));
  assert.ok(!/\bhistory\.jobs\b|\blistedJobs\b|\blistedByCompany\b/.test(panel),
    "the panel reads the dated listing — it would empty out until a date is picked");
  assert.match(tree, /pending: applyPending, heldApplications, gatedJobs: applyGatedJobs, inFlight: applyInFlight, line: applyLine/);
});

// ── Requirement 6: everything AC1–AC4 delivered is still here ────────────────────────────────

test("AD1 requirement 6 -> D25: nothing AC1–AC4 built that still applies was dropped", () => {
  for (const [what, needle] of [
    ["problems, in the modal",     /const modalCompanies    = groupByCompany\(modalApplications\)/],
    // AC1 — Open is scoped, and "Review all" is the only unscoped path.
    ["scoped Open",                /onClick: resumable \? \(\) => openHandoff\(packet, r\) : \(\) => openApplicationReview\(r\)/],
    ["scoped Details",             /onClick=\{\(\) => openApplicationReview\(r\)\}/],
    ["the one unscoped path",      /const openEverything = \(\) => openScoped\(null\);/],
    // AB1 — the resumable handoff and its refusals.
    ["the handoff",                /openHandoff\(packet, r\)/],
    ["a stale packet re-runs",     /const rerunJob = \(job\) => \{/],
    ["the handoff message",        /\{handoffMsg && \(/],
    // AB4 — broke is listed and held on purpose is not; the résumé button only where it is the fix.
    ["broke, not held",            /splitByFault\(applyStopped\)\.broke/],
    ["the generate button",        /r\.primary\?\.resumeBlocked && !r\.primary\?\.row\?\.resumeAvailable/],
    // AC4 — abort and soft delete.
    ["abort, in flight",           /onAbort=\{rowAbort\}/],
    ["soft delete",                /onClick: \(\) => hideApplication\(r\)/],
  ]) {
    assert.match(panel, needle, `${what} did not survive D25`);
  }
  // The row-level evidence on the rows that remain (in flight, and the modal's attempts).
  for (const [what, needle] of [
    ["Resume PDF",     /Resume PDF ↗/],
    ["the submitted screenshot", /Screenshot of the form ↗/],
    ["the ATS chip",   /atsBandFor\(app\.atsScore/],
  ]) {
    assert.match(sections, needle, `${what} is gone from the rows`);
  }
});

test("AD1 requirement 6: co-resolution grouping and its exclusions are untouched", () => {
  // resolutionPlan lifts the co-resolvable holds out of an application's problem list in the modal.
  assert.match(panel, /const planFor = \(app\) => resolutionPlan\(app, \{/);
  assert.match(panel, /portals: applyGatePortals, packets: applyHandoffPackets, questions: applyQuestions/);
  const obstacles = read("client/src/lib/applyObstacles.js");
  assert.match(obstacles, /export const CO_RESOLVABLE_GATE_REASONS = Object\.freeze\(new Set\(\["login_required"\]\)\)/);
  for (const excluded of ["captcha_required", "daily_cap_reached"]) {
    assert.ok(obstacles.includes(excluded), `the "${excluded}" exclusion is gone`);
  }
  // captcha_required is still named in Draft House, as its own item rather than a sign-in.
  const lib = read("client/src/lib/draftHouseExceptions.js");
  assert.match(lib, /includes\("captcha_required"\)/);
  assert.match(lib, /is behind an identity check/);
});

// ── Requirement 1: the mapping is AC4's, unchanged ───────────────────────────────────────────

test("AC4's partition is still the server's, and Draft House branches on no status itself", () => {
  assert.deepEqual(OUTCOME_STATUSES[OUTCOME.COMPLETED], ["submitted"]);
  assert.deepEqual(OUTCOME_STATUSES[OUTCOME.PENDING], ["queued", "running", "held_review", "held_gate"]);
  assert.deepEqual(OUTCOME_STATUSES[OUTCOME.ABORTED], ["failed", "dismissed", "superseded", "cancelled"]);
  for (const status of Object.values(OUTCOME_STATUSES).flat()) {
    assert.ok(!new RegExp(`"${status}"`).test(panel.slice(0, at(panel, "return ("))),
      `the panel branches on the '${status}' status itself instead of asking the shared vocabulary`);
  }
  assert.match(applyRoute, /const group = outcomeGroupFor\(\{ \.\.\.pub, postingGone: r\.title == null && r\.company == null \}\)/);
  assert.equal(OUTCOME_LABELS[OUTCOME.ABORTED].label, "Aborted");
});

// ── Requirement 8: the badge ─────────────────────────────────────────────────────────────────

test("AD1 requirement 8: the AUTO APPLY badge still counts what needs attention, with no preload", () => {
  // WHAT IT COUNTS, unchanged by AD1: applications waiting for approval, applications held for
  // review, and open questions. Summed in the context so the badge and the panel cannot disagree
  // about what "needs attention" means.
  // ⭐ A232 R6 (46y, owner 11-19 "all four approved"): the needsAttentionCount sum is asserted above in "the needs-review count is still reachable from the board"
  // AND IT NEEDS NO PRELOAD OF THE LISTING. Its three terms come from the cross-run feeds the
  // provider already loads for the whole session — none of them is the dated endpoint, so the badge
  // is computable with `history === null`, which is its state on every first render.
  for (const term of ["applyPending", "applyReviewJobs", "applyQuestions"]) {
    const setter = `set${term[0].toUpperCase()}${term.slice(1)}`;
    assert.ok(ctx.includes(setter), `${term} has no setter — the badge term is not a real feed`);
  }
  assert.ok(!/needsAttentionCount:[^\n]*history/.test(ctx),
    "the badge now reads the dated history — it cannot be computed before a date is picked");
  // The effect that fills those three feeds is the mount effect, and it fetches none of the history.
  const mount = ctx.match(/useEffect\(\(\) => \{\s*\n\s*if \(user\) \{ loadApplyRuns\(\); loadApplyQuestions\(\); loadApplyPending\(\); \}/);
  assert.ok(mount, "the feeds behind the badge are no longer loaded on mount");
});

// ── The browser harness must actually exercise the new shape ─────────────────────────────────
}

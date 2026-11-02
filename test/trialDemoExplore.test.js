import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { startTrial, trialState, eventDetail, recordEvent, trialAnalytics, samples } from "../services/trial.js";
import { demoState, completeDemo, demoTailoring, simulateTailoring, names, DEMO_REASON } from "../services/trialDemo.js";
import { LOCKED_FEATURES } from "../shared/trialTour.js";
import { listHistory, markPending } from "../services/applicationRecords.js";

// ⭐ Owner 11-01 (overriding D124 / D129's live run for the trial): the trial is a complete DEMONSTRATION — samples only;
// after the 2nd Draft, Draft House replays each pick end to end with the real tailoring, labelled; then The Table; then
// the survey; after it, the site to explore view-only, every acting press a "Coming soon" naming their email, counted.

process.env.DRAFT_TRIAL = "on";
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'tester', 'x')").run();
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (1, 'tester@example.com')").run();
  startTrial(db, 1);
  const p = db.prepare("INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (1, 'p', 'engineering', 'it_digital', 1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, content, name) VALUES (?, 1, ?, 'sample-a.txt')").run(p.lastInsertRowid, samples().A.resumeText);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (2, 'x', 'x')").run();
  db.prepare("INSERT INTO apply_runs (id, user_id) VALUES (7, 1)").run();
  for (const [i, j] of [["gh::1", "Backend Engineer"], ["gh::2", "Platform Engineer"]].entries()) {
    db.prepare("INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url) VALUES (?, 'q', ?, ?, 'Acme', ?)").run(j[0], `h${i}`, j[1], `https://example.com/${i}`);
    db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (7, 1, ?, 'held_review')").run(j[0]);
  }
  return db;
}

// Changed on purpose (A111, owner 11-02: "when it works we can add the pathway to the trial"): the owner's 11-01 rule
// stands BY DEFAULT — the own-résumé card exists now, but /try renders it only while Admin → Trial's switch
// (trial_own_resume) is on, and the choice list stays samples only (test/a111OwnResume.test.js a111OwnResumeOffByDefault
// proves the off behaviour over HTTP).
test("trialNoOwnResume: samples only by default — 'own' only behind the switch", () => {
  const page = read("client/src/pages/TryPage.jsx");
  assert.doesNotMatch(page, /data-trial-choice="own"/);
  assert.match(page, /\{ownOn && <OwnResumeCard /);
  assert.match(page, /const \[ownOn, setOwnOn\] = useState\(false\);/, "off until the server says on");
  assert.match(read("services/trial.js"), /export const RESUME_CHOICES = Object\.freeze\(\[\.\.\.SAMPLE_IDS\]\);/);
});

test("trialSimulatedTailoring: the sample résumé and a tailored one, side by side — simulated (no model), only the sample's own facts", () => {
  // Owner 11-01: "live tailoring is simulated … we don't even need to tailor anything … show a sample resume and a tailored one".
  const a = samples().A;
  const job = { job_id: "gh::1", title: "Backend Engineer", company: "Acme", description: "Java, Spring Boot, Docker, PostgreSQL, Redis, Kubernetes. Google Cloud." };
  const t = simulateTailoring(a.resumeText, job, a);
  assert.deepEqual(t.before, a.resumeText.split("\n"), "the sample résumé, whole");
  assert.deepEqual(t.terms, ["Java", "Spring Boot", "Docker", "PostgreSQL", "Redis"], "only terms the sample already shows — never Kubernetes, never Go inside 'Google'");
  const added = t.after.filter(l => l.change === "added").map(l => l.text);
  assert.deepEqual(added, ["SUMMARY", "For the Backend Engineer role at Acme: hands-on with Java, Spring Boot, Docker and PostgreSQL, shown in the work below."]);
  // every other line is the sample's own (re-ordered at most): no word is invented
  const own = new Set(a.resumeText.split("\n").map(l => l.split(/[:,]\s*/).sort().join("|")));
  for (const l of t.after.filter(l => l.change !== "added" && l.text)) assert.ok(own.has(l.text.split(/[:,]\s*/).sort().join("|")), l.text);
  assert.ok(t.after.some(l => l.change === "moved" && /^Frameworks and tools: Spring Boot, Docker, React,/.test(l.text)), "matched skills lead their line");
  assert.equal(simulateTailoring(a.resumeText, { title: "Chef", description: "knife skills" }, a).changed, 0, "nothing to match: kept as is");
  assert.equal(names("Google Cloud", "Go"), false);
  assert.equal(names("C++ and Node.js", "C++"), true);
  // made once per sample × posting, the same for every later tester
  const db = db0();
  const first = demoTailoring(db, { sampleId: "A", job });
  assert.equal(first.status, "ready");
  assert.deepEqual(demoTailoring(db, { sampleId: "A", job: { ...job, description: "changed" } }).after, first.after);
  assert.doesNotMatch(read("services/trialDemo.js"), /generate|anthropic|model\(/i, "no model is called");
  const ui = read("client/src/components/TrialDemo.jsx");
  assert.match(ui, /<Page title="Sample résumé" lines=\{t\.before\}\/>/);
  assert.match(ui, /<Page title="Tailored résumé" lines=\{t\.after\} terms=\{t\.terms\} tailored\/>/);
});

test("trialReplayLabelledDemonstration + the replay's steps: reading → tailoring → filling → the consent box (theirs) → sent → confirmed", () => {
  const demo = read("client/src/components/TrialDemo.jsx");
  assert.match(demo, /const PHASES = \["reading", "tailoring", "filling", "consent", "sent", "confirmed"\];/);
  assert.match(demo, /data-demo-tag=""[^>]*>Demonstration<\/span>/);
  assert.match(demo, /Nothing is sent to the employer\./);
  assert.match(demo, /await new Promise\(r => \{ consentRef\.current\[run\.jobId\] = r; \}\);/, "the consent box waits for the tester");
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /<div id="trial-demo-slot"\/>/, "on the real Draft House");
});

test("trialAutoToSurveyAfterTwoDrafts: 2 Drafts move the tour on; the demonstration ends on The Table; the survey follows", () => {
  const tour = read("client/src/components/GuidedTour.jsx");
  assert.match(tour, /id: "pick_two", route: "\/app\/today", target: "\[data-deck-clip\]", auto: true,/);
  assert.match(tour, /if \(step\.auto\) setTimeout\(\(\) => \{ tour\(step\.id, "completed", Date\.now\(\) - startedAt\.current\); setI\(x => x \+ 1\); \}, 1200\);/);
  assert.match(tour, /id: "live_run", route: "\/app\/auto-apply", target: "\[data-trial-demo\]", demo: true, noNext: true,/);
  assert.match(tour, /id: "table", route: "\/app\/database", target: "\[data-table-split\]", noNext: true, autoAfter: 5000, finish: true,/);
  assert.match(tour, /Every application lands here, with replies as they come in\./);
});

test("trialNothingReachesEmployer: completing the replay records the picks as sent BY DEMONSTRATION, with draft's practice confirmation", () => {
  const db = db0();
  for (const id of ["gh::1", "gh::2"]) markPending(db, 1, id, "drafted");   // the Draft press writes this record
  const inbox = [];
  assert.equal(demoState(db, 1).runs.length, 2);
  completeDemo(db, 1, { deliver: (m) => inbox.push(m) });
  // The Table reads the application record: both Sent, not "Drafted — in Draft House" (owner 11-01's screenshot)
  assert.deepEqual(listHistory(db, 1).map(r => r.status), ["sent", "sent"]);
  const rows = db.prepare("SELECT status, reason_code FROM apply_run_jobs WHERE user_id = 1").all();
  assert.ok(rows.every(r => r.status === "submitted" && r.reason_code === DEMO_REASON));
  assert.equal(inbox.length, 2);
  assert.ok(inbox.every(m => /practice form/.test(m.text) && /Nothing was sent to/.test(m.text) && m.from.endsWith("@practice.jobsviadraft.com")));
  assert.equal(trialState(db, 1).locked, true, "2 sent: the trial locks into the survey");
  assert.doesNotMatch(read("services/trialDemo.js"), /fetch\(|https?:\/\//, "the replay sends nothing anywhere");
});

test("trialExploreAllActionsLocked + trialComingSoonShowsEmail: every acting press is stopped before the page; the pop-up names their email", () => {
  const lock = read("client/src/components/ExploreLock.jsx");
  assert.match(lock, /e\.preventDefault\(\); e\.stopPropagation\(\); e\.stopImmediatePropagation\?\.\(\);/);
  assert.match(lock, /document\.addEventListener\("click", onClick, true\);/, "captured before the app sees it");
  for (const f of ["draft", "save", "pass", "auto_mode", "settings", "upload"]) assert.match(lock, new RegExp(`\\["${f}", \\(el\\) =>`), f);
  for (const f of ["apply", "approve", "send", "profile", "claim", "learn_progress", "resume"]) assert.match(lock, new RegExp(`\\["${f}", /`), f);
  assert.match(lock, /draft is opening soon\. We'll email you\{email \? <> at <b>\{email\}<\/b><\/> : null\} when your account is ready\./);
  assert.match(lock, /f && location\.pathname\.startsWith\("\/app\/today"\)/, "the deck's keys are locked too");
  const db = db0();
  assert.equal(trialState(db, 1).email, "tester@example.com");
  const dock = read("client/src/components/TrialDock.jsx");
  assert.match(dock, /return <>\{children\}<ExploreLock email=\{state\.email\}\/><\/>;/);
  assert.match(dock, /data-trial-explore="">Explore draft<\/DepthButton>/);
  assert.match(dock, /We'll let you know when it's ready/);
});

test("trialLockedPressCounted: each locked press is an event by feature; Admin ranks them, most-wanted first", () => {
  assert.equal(eventDetail("locked", { feature: "made_up" }), undefined);
  const db = db0();
  for (const f of ["draft", "draft", "settings"]) recordEvent(db, 1, { event: "locked", detail: { feature: f, page: "/app/today" } });
  const a = trialAnalytics(db);
  assert.deepEqual(a.lockedPresses, [["draft", 1], ["settings", 1]]);
  assert.ok(LOCKED_FEATURES.includes("learn_progress"));
});

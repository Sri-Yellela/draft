import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { recordEvent, eventDetail, trialAnalytics, crossCut, analyticsCsv, saveSurvey, cleanSurvey, SURVEY, startTrial,
         trialState, RATED, STAR_LABELS, missingRequired } from "../services/trial.js";
import { TOUR_STEPS, TOUR_STEP_IDS, TOUR_SECTIONS, DECK_SCROLL_MS, TOUR_TARGET_MS } from "../shared/trialTour.js";

// ⭐ D129 (owner 11-01): the guided tour's analytics — the funnel with step times, drop-offs, interactions, errors, the
// survey with per-section ratings, cross-cuts, a CSV without emails by default. Synthetic testers; no real person.

process.env.DRAFT_TRIAL = "on";   // the suite's preload turns the trial off; this file is about it
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function db0(n = 3) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (let i = 1; i <= n; i++) {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')").run(i, `tester${i}`);
    startTrial(db, i);
  }
  return db;
}
const tour = (db, user, step, phase, ms, device = "laptop", speed = "normal") =>
  recordEvent(db, user, { event: "tour", detail: { step, phase, ms, device, speed } });

test("d129: the tour's steps run pick a résumé → deck → filters → Draft House → the Atlas → pick 2 → live → The Table → survey", () => {
  // 11-01 (the owner's bug report, changed on purpose): the card is three steps and the modes and Settings two.
  assert.deepEqual(TOUR_STEP_IDS, ["pick_resume", "deck", "deck_match", "deck_facts", "deck_actions", "draft_house",
    "modes", "auto_settings", "atlas_map", "atlas_learn", "pick_two", "live_run", "table", "survey"]);
  assert.equal(DECK_SCROLL_MS, 500, "one card every 0.5 s");
  assert.equal(TOUR_TARGET_MS, 8 * 60 * 1000);
});

test("d129: events are validated against the tour — a made-up step, phase or interaction is refused; nothing typed is stored", () => {
  assert.equal(eventDetail("tour", { step: "deck", phase: "teleported" }), undefined);
  assert.equal(eventDetail("tour", { step: "secret_admin", phase: "reached" }), undefined);
  assert.equal(eventDetail("interaction", { name: "typed_my_password" }), undefined);
  assert.deepEqual(JSON.parse(eventDetail("tour", { step: "deck", phase: "completed", ms: 4200.7, device: "phone", speed: "faster", extra: "x" })),
    { step: "deck", phase: "completed", ms: 4201, device: "phone", speed: "faster" });
  assert.deepEqual(JSON.parse(eventDetail("error", { code: "draft failed: <script>", step: "live_run" })), { code: "draftfailed:script", step: "live_run" });
  const db = db0(1);
  assert.equal(tour(db, 1, "deck", "reached", 0), true);
  assert.equal(recordEvent(db, 1, { event: "tour", detail: { step: "nope", phase: "reached" } }), false);
});

test("d129FunnelStepTimes: each step's reached / completed / abandoned and its median time; drop-off where people leave", () => {
  const db = db0(3);
  // tester 1: the whole path; tester 2: leaves at the facts; tester 3: leaves at Draft House
  for (const id of TOUR_STEP_IDS) { tour(db, 1, id, "reached", 0); tour(db, 1, id, "completed", 10_000); }
  for (const id of ["pick_resume", "deck", "deck_match"]) { tour(db, 2, id, "reached", 0); tour(db, 2, id, "completed", 30_000); }
  tour(db, 2, "deck_facts", "reached", 0); tour(db, 2, "deck_facts", "abandoned", 5_000);
  for (const id of ["pick_resume", "deck", "deck_match", "deck_facts"]) { tour(db, 3, id, "reached", 0, "phone"); tour(db, 3, id, "completed", 20_000, "phone"); }
  tour(db, 3, "draft_house", "reached", 0, "phone");
  const a = trialAnalytics(db);
  const deck = a.funnel.find(f => f.step === "deck");
  assert.deepEqual([deck.reached, deck.completed, deck.medianMs], [3, 3, 20_000]);
  const facts = a.funnel.find(f => f.step === "deck_facts");
  assert.deepEqual([facts.reached, facts.completed, facts.abandoned], [3, 2, 1]);
  assert.deepEqual(a.dropOff, { deck_facts: 1, draft_house: 1 });
  assert.equal(a.finished, 1);
  assert.equal(a.medianTotalMs, 140_000, "14 steps × 10 s");
  // narrowed to one device
  assert.equal(trialAnalytics(db, { filter: { by: "device", value: "phone" } }).testers, 1);
});

test("the survey is the owner's sketch: 18 questions in three sections, dropdowns, four star ratings, plain words", () => {
  const sketch = fs.readFileSync("docs/sketches/draft — quick feedback.html", "utf8");
  for (const q of SURVEY) assert.ok(sketch.includes(q.q.replace(/'/g, "'")), `"${q.q}" is the sketch's own question`);
  for (const q of SURVEY.filter(q => q.type === "select")) for (const o of q.options) assert.ok(sketch.includes(o.replace(/&/g, "&amp;")) || sketch.includes(o), `${q.key}: "${o}"`);
  assert.equal(SURVEY.length, 18);
  assert.deepEqual(SURVEY.filter(q => q.section).map(q => q.section), ["Your job search today", "What you just tried", "Your verdict"]);
  assert.deepEqual(RATED.map(r => r.key), ["rate_matches", "rate_applying", "rate_map", "rate_tracker"]);
  assert.deepEqual(SURVEY.filter(q => q.required).map(q => q.key), ["search_stage", "field", "time_per_app", "frustration", "compared", "interested"]);
  for (const q of SURVEY) assert.doesNotMatch(`${q.q} ${q.hint || ""}`, /The Table|Draft House|Atlas|Full House/, "plain words, never an internal page name");
  assert.deepEqual(STAR_LABELS, ["Not useful", "Slightly useful", "Useful", "Very useful", "Exactly what I need"]);
});

test("d129SurveyPerSectionRatings: stars 1–5; 'what would make this 5 stars?' kept only below 5; follow-ups only when they apply", () => {
  assert.deepEqual(cleanSurvey({ rate_matches: 4, rate_matches_why: "more jobs", rate_map: 5, rate_map_why: "dropped", rate_tracker: 9,
    interested: "Maybe", interested_why: "price", find_tool: "LinkedIn or Indeed", find_tool_other: "dropped", search_stage: "astronaut" }),
    { rate_matches: 4, rate_matches_why: "more jobs", rate_map: 5, interested: "Maybe", interested_why: "price", find_tool: "LinkedIn or Indeed" });
  assert.deepEqual(missingRequired({ search_stage: "Actively applying" }), ["field", "time_per_app", "frustration", "compared", "interested"]);
  const db = db0(2);
  saveSurvey(db, 1, { rate_matches: 5, rate_map: 3, most_helpful: "The job matches", interested: "Yes, as soon as I can" });
  saveSurvey(db, 2, { rate_matches: 3, most_helpful: "Applying for me", interested: "Maybe" });
  const a = trialAnalytics(db);
  assert.equal(a.stars.rate_matches, 4);
  assert.equal(a.stars.rate_map, 3);
  assert.equal(a.stars.rate_tracker, null, "nobody rated it");
  assert.deepEqual(a.distribution.most_helpful, { "The job matches": 1, "Applying for me": 1 });
  assert.equal(a.questions.rate_matches, "Your job matches", "the admin reads each question in its own words");
});

test("d129AnalyticsCrossCuts: any answer by sample, field, device, speed or whether the drafts succeeded", () => {
  const db = db0(3);
  db.prepare("UPDATE users SET trial_resume = 'A' WHERE id IN (1, 2)").run();
  db.prepare("UPDATE users SET trial_resume = 'C' WHERE id = 3").run();
  tour(db, 1, "deck", "reached", 0, "phone", "faster");
  tour(db, 2, "deck", "reached", 0, "laptop");
  tour(db, 3, "deck", "reached", 0, "laptop");
  saveSurvey(db, 1, { interested: "Yes, as soon as I can", rate_matches: 5, field: "Software and computing" });
  saveSurvey(db, 2, { interested: "No", rate_matches: 2, field: "Software and computing" });
  saveSurvey(db, 3, { interested: "Yes, as soon as I can", rate_matches: 4, field: "Mechanical or manufacturing engineering" });
  assert.deepEqual(crossCut(db, { key: "interested", by: "sample" }), { A: { "Yes, as soon as I can": 1, No: 1 }, C: { "Yes, as soon as I can": 1 } });
  assert.deepEqual(crossCut(db, { key: "rate_matches", by: "device" }), { phone: { average: 5, n: 1 }, laptop: { average: 3, n: 2 } });
  assert.deepEqual(crossCut(db, { key: "interested", by: "speed" }), { faster: { "Yes, as soon as I can": 1 }, normal: { No: 1, "Yes, as soon as I can": 1 } });
  assert.deepEqual(crossCut(db, { key: "interested", by: "draftsOk" }), { none: { "Yes, as soon as I can": 2, No: 1 } });
  assert.equal(crossCut(db, { key: "interested", by: "email" }), null, "only the five dimensions");
});

test("d129ExportNoEmailsByDefault: the CSV carries every tester's tour and answers; the referral email only when asked", () => {
  const db = db0(2);
  tour(db, 1, "deck", "reached", 0); tour(db, 1, "deck", "completed", 7_000);
  saveSurvey(db, 1, { interested: "Yes, as soon as I can", referral_email: "friend@example.com", must_have: 'Faster, "a lot", truly' });
  const csv = analyticsCsv(db);
  assert.doesNotMatch(csv, /friend@example\.com/);
  assert.doesNotMatch(csv.split("\n")[0], /referral_email/);
  assert.match(csv, /"Faster, ""a lot"", truly"/, "quoted per RFC 4180");
  assert.equal(csv.trim().split("\n").length, 3, "a header and one row per tester");
  assert.match(analyticsCsv(db, { includeEmails: true }), /friend@example\.com/);
  const routes = read("routes/trial.js");
  assert.match(routes, /analyticsCsv\(db, \{ includeEmails: req\.query\.emails === "1" \}\)/);
});

test("d129: the survey page is the sketch — field prefilled in its words, native dropdowns, stars, the required ones asked for", () => {
  const db = db0(1);
  db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, target_titles, is_active)
    VALUES (1, 'p', 'engineering', 'manufacturing', '["Mechanical Engineer"]', 1)`).run();
  assert.equal(trialState(db, 1).fieldGuess, "Other engineering");
  assert.ok(SURVEY.find(q => q.key === "field").options.includes(trialState(db, 1).fieldGuess));
  const dock = read("client/src/components/TrialDock.jsx");
  assert.match(dock, /fieldGuess=\{state\.fieldGuess \|\| null\}/);
  assert.match(dock, /Thanks for trying draft/);
  // D130: the form itself is the ONE SurveyForm, shared with /survey.
  const form = read("client/src/components/SurveyForm.jsx");
  assert.match(form, /<select id=\{id\} value=\{v \|\| ""\}/, "a native dropdown");
  assert.match(form, /role="radiogroup" aria-label=\{`Rate: \$\{q\.q\}`\}/, "the stars");
  assert.match(form, /const followOpen = f && v != null && v !== "" && \(f\.when \? f\.when\.includes\(v\) : v < f\.below\);/);
  assert.match(form, /const gaps = questions\.filter\(q => q\.required && /);
});

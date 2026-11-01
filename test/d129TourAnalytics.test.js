import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { recordEvent, eventDetail, trialAnalytics, crossCut, analyticsCsv, saveSurvey, cleanSurvey, SURVEY, startTrial,
         trialState } from "../services/trial.js";
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
  assert.deepEqual(TOUR_STEP_IDS, ["pick_resume", "deck", "deck_card", "filters", "draft_house", "auto_settings", "atlas_map",
    "atlas_learn", "pick_two", "live_run", "table", "survey"]);
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
  // tester 1: the whole path; tester 2: leaves at the filters; tester 3: leaves at Draft House
  for (const id of TOUR_STEP_IDS) { tour(db, 1, id, "reached", 0); tour(db, 1, id, "completed", 10_000); }
  for (const id of ["pick_resume", "deck", "deck_card"]) { tour(db, 2, id, "reached", 0); tour(db, 2, id, "completed", 30_000); }
  tour(db, 2, "filters", "reached", 0); tour(db, 2, "filters", "abandoned", 5_000);
  for (const id of ["pick_resume", "deck", "deck_card", "filters"]) { tour(db, 3, id, "reached", 0, "phone"); tour(db, 3, id, "completed", 20_000, "phone"); }
  tour(db, 3, "draft_house", "reached", 0, "phone");
  const a = trialAnalytics(db);
  const deck = a.funnel.find(f => f.step === "deck");
  assert.deepEqual([deck.reached, deck.completed, deck.medianMs], [3, 3, 20_000]);
  const filters = a.funnel.find(f => f.step === "filters");
  assert.deepEqual([filters.reached, filters.completed, filters.abandoned], [3, 2, 1]);
  assert.deepEqual(a.dropOff, { filters: 1, draft_house: 1 });
  assert.equal(a.finished, 1);
  assert.equal(a.medianTotalMs, 120_000, "12 steps × 10 s");
  // narrowed to one device
  assert.equal(trialAnalytics(db, { filter: { by: "device", value: "phone" } }).testers, 1);
});

test("d129SurveyPerSectionRatings: each section rated 1–5, the ONE used first, the confusing step; out-of-range answers dropped", () => {
  for (const sec of TOUR_SECTIONS) assert.ok(SURVEY.some(q => q.key === `rate_${sec}` && q.type === "scale" && q.min === 1 && q.max === 5), sec);
  assert.deepEqual(SURVEY.find(q => q.key === "use_first").options, [...TOUR_SECTIONS]);
  assert.deepEqual(SURVEY.find(q => q.key === "confusing_steps").options, TOUR_STEP_IDS);
  assert.equal(SURVEY.find(q => q.key === "field").prefill, "category");
  assert.deepEqual(cleanSurvey({ rate_picks: 5, rate_learn: 9, use_first: "picks", confusing_steps: ["filters", "made_up"], field: "engineering" }),
    { field: "engineering", rate_picks: 5, use_first: "picks", confusing_steps: ["filters"] });
  const db = db0(2);
  saveSurvey(db, 1, { rate_picks: 5, rate_map: 3, use_first: "picks", would_use: "yes" });
  saveSurvey(db, 2, { rate_picks: 3, use_first: "draft_house", would_use: "maybe" });
  const a = trialAnalytics(db);
  assert.equal(a.sectionUseful.picks, 4);
  assert.equal(a.sectionUseful.map, 3);
  assert.equal(a.sectionUseful.learn, null, "nobody rated it");
  assert.deepEqual(a.distribution.use_first, { picks: 1, draft_house: 1 });
});

test("d129AnalyticsCrossCuts: any answer by sample, field, device, speed or whether the drafts succeeded", () => {
  const db = db0(3);
  db.prepare("UPDATE users SET trial_resume = 'A' WHERE id IN (1, 2)").run();
  db.prepare("UPDATE users SET trial_resume = 'C' WHERE id = 3").run();
  tour(db, 1, "deck", "reached", 0, "phone", "faster");
  tour(db, 2, "deck", "reached", 0, "laptop");
  tour(db, 3, "deck", "reached", 0, "laptop");
  saveSurvey(db, 1, { would_use: "yes", rate_picks: 5, field: "computing" });
  saveSurvey(db, 2, { would_use: "no", rate_picks: 2, field: "computing" });
  saveSurvey(db, 3, { would_use: "yes", rate_picks: 4, field: "engineering" });
  assert.deepEqual(crossCut(db, { key: "would_use", by: "sample" }), { A: { yes: 1, no: 1 }, C: { yes: 1 } });
  assert.deepEqual(crossCut(db, { key: "rate_picks", by: "device" }), { phone: { average: 5, n: 1 }, laptop: { average: 3, n: 2 } });
  assert.deepEqual(crossCut(db, { key: "would_use", by: "speed" }), { faster: { yes: 1 }, normal: { no: 1, yes: 1 } });
  assert.deepEqual(crossCut(db, { key: "would_use", by: "draftsOk" }), { none: { yes: 2, no: 1 } });
  assert.equal(crossCut(db, { key: "would_use", by: "email" }), null, "only the five dimensions");
});

test("d129ExportNoEmailsByDefault: the CSV carries every tester's tour and answers; emails only when asked and given", () => {
  const db = db0(2);
  tour(db, 1, "deck", "reached", 0); tour(db, 1, "deck", "completed", 7_000);
  saveSurvey(db, 1, { would_use: "yes", followup_email: "tester1@example.com", thoughts: 'Liked it, "a lot", truly' });
  const csv = analyticsCsv(db);
  assert.doesNotMatch(csv, /tester1@example\.com/);
  assert.doesNotMatch(csv.split("\n")[0], /followup_email/);
  assert.match(csv, /"Liked it, ""a lot"", truly"/, "quoted per RFC 4180");
  assert.equal(csv.trim().split("\n").length, 3, "a header and one row per tester");
  assert.match(analyticsCsv(db, { includeEmails: true }), /tester1@example\.com/);
  const routes = read("routes/trial.js");
  assert.match(routes, /analyticsCsv\(db, \{ includeEmails: req\.query\.emails === "1" \}\)/);
});

test("d129: the survey's field is prefilled from the résumé's category, and the client labels every new option", () => {
  const db = db0(1);
  db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, target_titles, is_active)
    VALUES (1, 'p', 'engineering', 'manufacturing', '["Mechanical Engineer"]', 1)`).run();
  assert.equal(trialState(db, 1).fieldGuess, "engineering");
  const dock = read("client/src/components/TrialDock.jsx");
  assert.match(dock, /fieldGuess=\{state\.fieldGuess \|\| null\}/);
  assert.match(dock, /\.\.\.Object\.fromEntries\(TOUR_STEPS\.map\(s => \[s\.id, s\.title\]\)\)/);
  for (const s of TOUR_SECTIONS) assert.match(dock, new RegExp(`\\b${s}: "`), s);
});

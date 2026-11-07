import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cleanSurvey, SURVEY, RATED, STAR_LABELS, missingRequired } from "../services/survey.js";
import { TOUR_STEPS, TOUR_STEP_IDS } from "../shared/trialTour.js";

// ⭐ D129 (owner 11-01): the survey's questions — the owner's sketch, question for question — and the tour's step names.
// 11-07 (owner, changed on purpose): the D124 trial, its guided tour, its in-app survey and its analytics (recordEvent,
// trialAnalytics, crossCut, the trial CSV) were removed. What stays, and is pinned here: the questions (services/survey.js
// — the key Admin → Testers reads the trial testers' stored answers by, and the standalone survey's source), the one
// SurveyForm, and the step names the stored tour events carry (shared/trialTour.js).

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d129: the stored tour events' steps keep their names and order (Admin → Testers reads them)", () => {
  assert.equal(TOUR_STEPS.length, 14);
  assert.deepEqual(TOUR_STEP_IDS, TOUR_STEPS.map(s => s.id));
  assert.equal(TOUR_STEP_IDS[0], "pick_resume");
  assert.equal(TOUR_STEP_IDS.at(-1), "survey");
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
});

test("d129: the one SurveyForm (D130: shared with /survey) — native dropdowns, stars, follow-ups, the required ones asked for", () => {
  const form = read("client/src/components/SurveyForm.jsx");
  assert.match(form, /<select id=\{id\} value=\{v \|\| ""\}/, "a native dropdown");
  assert.match(form, /role="radiogroup" aria-label=\{`Rate: \$\{q\.q\}`\}/, "the stars");
  assert.match(form, /const followOpen = f && v != null && v !== "" && \(f\.when \? f\.when\.includes\(v\) : v < f\.below\);/);
  assert.match(form, /const gaps = questions\.filter\(q => q\.required && /);
});

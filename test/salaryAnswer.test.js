// 46a (owner 11-10): "for autoapply user should be able to choose amongst 3 options for salary, a preset salary that they
// choose and doesnt change, a slider when the comapny has a propsed range, or a preset amount … higher end or lower end or
// the mean or median, upper limit, lower limit." shared/salaryAnswer.js decides; routes/apply.js applies it to every build
// of the autofill answers. SYNTHETIC numbers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { salaryAnswerFor, normaliseSalarySettings, SALARY_PRESETS } from "../shared/salaryAnswer.js";
import { normaliseAutoSettings, readAutoSettings, AUTO_DEFAULTS } from "../shared/autoSettings.js";

const RANGE = { salary_min_usd: 120000, salary_max_usd: 160000, salary_period: "annual" };

test("the default is the Profile's number, exactly as before", () => {
  assert.equal(AUTO_DEFAULTS.salary.mode, "profile");
  assert.equal(salaryAnswerFor(undefined, { profileSalary: 135000, job: RANGE }).value, 135000);
  assert.equal(readAutoSettings(null).salary.mode, "profile", "a user who never set it keeps today's behaviour");
});

test("fixed: one number on every application, whatever the posting says", () => {
  const s = { mode: "fixed", amount: 142000 };
  for (const job of [RANGE, {}, { salary_min_usd: 50000, salary_max_usd: 60000 }]) assert.equal(salaryAnswerFor(s, { profileSalary: 100000, job }).value, 142000);
});

test("slider: a point on the posting's own range — 0 its minimum, 100 its maximum, rounded to $1,000", () => {
  assert.equal(salaryAnswerFor({ mode: "position", position: 0 }, { job: RANGE }).value, 120000);
  assert.equal(salaryAnswerFor({ mode: "position", position: 70 }, { job: RANGE }).value, 148000);
  assert.equal(salaryAnswerFor({ mode: "position", position: 100 }, { job: RANGE }).value, 160000);
  const hourly = salaryAnswerFor({ mode: "position", position: 50 }, { job: { salary_min_usd: 41, salary_max_usd: 52, salary_period: "hourly" } });
  assert.deepEqual([hourly.value, hourly.period], [46.5, "hourly"], "an hourly range answers in hours, to the half dollar");
});

test("presets: lower limit · lower end · midpoint (mean = median of a posted range) · higher end · upper limit", () => {
  const at = (preset) => salaryAnswerFor({ mode: "preset", preset }, { job: RANGE }).value;
  assert.deepEqual(Object.keys(SALARY_PRESETS), ["lower_limit", "lower_end", "midpoint", "higher_end", "upper_limit"]);
  assert.deepEqual(["lower_limit", "lower_end", "midpoint", "higher_end", "upper_limit"].map(at), [120000, 130000, 140000, 150000, 160000]);
  assert.match(salaryAnswerFor({ mode: "preset", preset: "higher_end" }, { job: RANGE }).basis, /higher end of the posted 120,000–160,000/);
});

test("no posted range: the user's amount (or the Profile's), or left for them — and the floor always holds", () => {
  assert.equal(salaryAnswerFor({ mode: "preset", preset: "midpoint", whenNoRange: "fixed", amount: 130000 }, { job: {} }).value, 130000);
  assert.equal(salaryAnswerFor({ mode: "preset", preset: "midpoint", whenNoRange: "fixed" }, { profileSalary: 125000, job: {} }).value, 125000);
  const ask = salaryAnswerFor({ mode: "position", position: 60, whenNoRange: "ask" }, { profileSalary: 125000, job: {} });
  assert.equal(ask.value, null, "left for the user — the form stops at Needs you on it");
  const low = salaryAnswerFor({ mode: "preset", preset: "lower_limit", floor: 135000 }, { job: RANGE });
  assert.deepEqual([low.value, /floor/.test(low.basis)], [135000, true]);
});

test("settings are validated — a wrong value is refused, never coerced", () => {
  assert.equal(normaliseSalarySettings({ mode: "fixed" }).ok, false, "a fixed answer needs its amount");
  assert.equal(normaliseSalarySettings({ mode: "position", position: 140 }).ok, false);
  assert.equal(normaliseSalarySettings({ mode: "preset", preset: "average" }).ok, false);
  assert.equal(normaliseAutoSettings({ salary: { mode: "nope" } }).ok, false);
  const ok = normaliseAutoSettings({ salary: { mode: "preset", preset: "higher_end", whenNoRange: "ask", floor: 120000 } });
  assert.equal(ok.ok, true); assert.equal(ok.value.salary.preset, "higher_end");
});

test("every build of the autofill answers applies it; a salary saved for this kind of job still wins", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(src, /function withHowHeard\(userId, jobId, payload\) \{\s*payload = withSalaryAnswer\(userId, jobId, payload\);/);
  assert.match(src, /if \(\(payload\.handler_map\?\.salary \?\? ""\) !== own\) return payload;\s+\/\/ a scoped salary for this kind of job wins/);
  assert.match(src, /field_map: \{ \.\.\.\(payload\.field_map \|\| \{\}\), desired_salary: value \}, handler_map: \{ \.\.\.\(payload\.handler_map \|\| \{\}\), salary: value \}/);
  assert.equal((src.match(/withHowHeard\(userId, jobId, /g) || []).length >= 5, true, "the five builds all pass through it");
  const ui = fs.readFileSync("client/src/components/AutoSettingsDrawer.jsx", "utf8");
  for (const hook of ['data-salary-mode={m}', 'data-salary-slider=""', 'data-salary-no-range=""', 'data-salary-example=""']) assert.ok(ui.includes(hook), hook);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { testersReport, testersCsv, shareText, INVITES_AT } from "../services/testersReport.js";

// ⭐ D131 (owner 11-01, sketch `docs/sketches/draft admin — testers.html`): Admin → Testers, the trial and both surveys
// as one readable page for the application. Synthetic people only.

const NOW = INVITES_AT + 2 * 86400;
const T = INVITES_AT + 3600;
const BASE = { search_stage: "Actively applying", field: "Software and computing", time_per_app: "30 minutes to 1 hour",
  apps_per_week: "6 to 15 a week", paid_before: "Yes, under $20 in total", frustration: "Applying and hearing nothing back",
  trust_auto: "Yes, after I've checked the first few", interested: "Yes, as soon as I can", fair_price: "$10 to $20 a month" };

function db0({ trialers = 3, standalone = 2 } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const user = db.prepare("INSERT INTO users (id, username, password_hash, created_at, trial_at, trial_resume, is_admin) VALUES (?, ?, 'x', ?, ?, ?, ?)");
  const prof = db.prepare("INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (?, 'Pat', 'Tester', ?)");
  const survey = db.prepare("INSERT INTO trial_surveys (user_id, answers, created_at) VALUES (?, ?, ?)");
  const run = db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, ?, ?, 'submitted')");
  for (let i = 1; i <= trialers; i++) {
    user.run(i, `t${i}`, T, T, i === trialers ? null : "A", 0);   // the last one never picked a résumé
    prof.run(i, `t${i}@example.com`);
  }
  // user 1: drafted 2 + answered; user 2: drafted 1, no survey
  db.prepare("INSERT INTO apply_runs (id, user_id) VALUES (1, 1), (2, 2)").run();
  for (const j of ["j1", "j2"]) run.run(1, 1, j);
  run.run(2, 2, "j1");
  survey.run(1, JSON.stringify({ ...BASE, compared: "Much better", rate_matches: 4, rate_matches_why: "Show me the salary first.",
    must_have: "Workday support.", most_helpful: "Applying for me", referral_email: "friend@example.com" }), T + 600);
  // the owner's own walk: tagged test → left out by default
  user.run(50, "owner-walk", T, T, "B", 0); prof.run(50, "owner@example.com");
  db.prepare("INSERT INTO user_tags (user_id, tag) VALUES (50, 'test')").run();
  survey.run(50, JSON.stringify({ ...BASE, compared: "Worse", must_have: "OWNER TEST" }), T + 700);
  const sa = db.prepare("INSERT INTO standalone_surveys (name, email, email_key, answers, created_at) VALUES (?, ?, ?, ?, ?)");
  for (let i = 0; i < standalone; i++) sa.run(`Sam ${i}`, `sam${i}@example.com`, `sam${i}@example.com`, JSON.stringify({ ...BASE, idea_useful: 5, must_have: `Idea note ${i}` }), T + 900);
  sa.run("Owner", "owner@example.com", "owner@example.com", JSON.stringify({ ...BASE, must_have: "OWNER SURVEY" }), T + 950);
  db.prepare("INSERT INTO trial_events (user_id, event, detail, created_at) VALUES (1, 'locked', ?, ?), (1, 'locked', ?, ?), (2, 'locked', ?, ?), (1, 'page', '/app/atlas', ?)")
    .run(JSON.stringify({ feature: "Upload my résumé" }), T, JSON.stringify({ feature: "Upload my résumé" }), T, JSON.stringify({ feature: "Draft a job" }), T, T);
  return db;
}

test("d131ExcludesOwnerAndTest: tagged / admin accounts and their survey email are left out by default and counted apart", () => {
  const db = db0();
  const r = testersReport(db, { now: NOW });
  assert.equal(r.tried, 3);
  assert.deepEqual(r.excluded, { accounts: 1, surveys: 1 });
  assert.ok(!r.quotes.some(q => /OWNER/.test(q.text)), "neither the owner's trial survey nor his standalone answer");
  const all = testersReport(db, { now: NOW, exclude: false });
  assert.equal(all.tried, 4);
  assert.ok(all.quotes.some(q => q.text === "OWNER SURVEY"));
});

test("d131CountsUntilTwenty: counts ('2 of 3') below 20 answers, a percentage from 20; the banner while the total is small", () => {
  assert.equal(shareText(2, 3), "2 of 3");
  assert.equal(shareText(15, 20), "75%");
  assert.equal(shareText(0, 0), "—");
  const small = testersReport(db0(), { now: NOW });
  assert.equal(small.small, true);
  assert.equal(small.headline.find(h => h.key === "interested").big, "3 of 3");
  const big = testersReport(db0({ standalone: 25 }), { now: NOW });
  assert.equal(big.small, false);
  assert.equal(big.headline.find(h => h.key === "interested").big, "100%");
});

test("d131HeadlineSentencesCopy: eight cards; the copy text is every ready sentence, one per line", () => {
  const r = testersReport(db0(), { now: NOW });
  assert.deepEqual(r.headline.map(h => h.key), ["people", "hours", "paid", "better", "interested", "trust", "pay", "frustration"]);
  const lines = r.copyText.split("\n");
  assert.equal(lines.length, r.headline.filter(h => h.sentence).length);
  assert.ok(lines.includes("1 of 1 of those who tried it said it beats how they apply today."));
  assert.match(r.copyText, /spend about 7\.9 hours a week on applications \(median of 3\)/, "45 min × 10.5 a week, by band midpoints");
  assert.match(r.copyText, /The top frustration: “applying and hearing nothing back” \(3 of 3\)\./);
});

test("d131FunnelDropOffs: signed up → picked → drafted 1 → drafted 2 → survey, with who left at each step", () => {
  const r = testersReport(db0(), { now: NOW });
  assert.deepEqual(r.funnel.steps.map(s => [s.label, s.n, s.left]), [
    ["Signed up", 3, 0], ["Picked a résumé", 2, 1], ["Drafted the 1st job", 2, 0], ["Drafted the 2nd job", 1, 1], ["Answered the survey", 1, 0]]);
  assert.equal(r.funnel.medianMinutes, 10);
});

test("d131LockedPressesRanked: locked buttons by presses, most first; pages by distinct testers", () => {
  const r = testersReport(db0(), { now: NOW });
  assert.deepEqual(r.funnel.locked, [{ label: "Upload my résumé", n: 2 }, { label: "Draft a job", n: 1 }]);
  assert.deepEqual(r.funnel.pages, [{ label: "/app/atlas", n: 1 }]);
});

test("d131SourceFilter: trial only / survey only / both; trial-only questions are labelled and dropped for survey-only", () => {
  const db = db0();
  const both = testersReport(db, { now: NOW });
  assert.equal(both.answers, 3);
  const trial = testersReport(db, { now: NOW, source: "trial" });
  assert.equal(trial.answers, 1);
  assert.equal(trial.surveyOnly, 0);
  assert.ok(trial.thought.some(t => t.key === "compared" && t.only === "trial"));
  const sa = testersReport(db, { now: NOW, source: "standalone" });
  assert.equal(sa.answers, 2);
  assert.equal(sa.tried, 0);
  assert.ok(!sa.thought.some(t => t.key === "compared"));
  assert.deepEqual(sa.stars.map(s => s.label), ["The idea (survey only)"]);
  // a period before anything happened shows nothing
  assert.equal(testersReport(db, { now: NOW, period: "day" }).answers, 0);
});

test("d131QuotesSearchableNoNames: every written answer as a quote tagged source · field · star, never a name or email", () => {
  const r = testersReport(db0(), { now: NOW });
  const texts = r.quotes.map(q => q.text);
  assert.ok(texts.includes("Workday support."));
  assert.ok(texts.includes("Show me the salary first."));
  const why = r.quotes.find(q => q.text === "Show me the salary first.");
  assert.equal(why.stars, 4);
  assert.equal(why.source, "Tried the app");
  assert.equal(why.field, "Software and computing");
  const flat = JSON.stringify(r);
  for (const leak of ["Sam 0", "sam0@example.com", "friend@example.com", "Pat", "t1@example.com"]) assert.ok(!flat.includes(leak), leak);
  const page = fs.readFileSync("client/src/panels/adminTesters.jsx", "utf8");
  assert.match(page, /placeholder="Search what people wrote…"/);
  assert.match(page, /\.toLowerCase\(\)\.includes\(needle\)/);
});

test("d131ExportNoEmailsByDefault: the CSV carries every answer but no name, email or referral email", () => {
  const csv = testersCsv(db0(), { now: NOW });
  const head = csv.split("\n")[0];
  assert.match(head, /^source,answered_at,search_stage,/);
  assert.doesNotMatch(head, /\bname\b|email/);
  assert.doesNotMatch(csv, /@example\.com|Sam 0/);
  assert.equal(csv.trim().split("\n").length, 1 + 3, "three answers, the owner's left out");
});

test("d131PhoneLayout: cards stack on a phone — every grid is minmax(min(N px, 100%), 1fr); no fixed page width", () => {
  const page = fs.readFileSync("client/src/panels/adminTesters.jsx", "utf8");
  assert.match(page, /gridTemplateColumns: `repeat\(auto-fill, minmax\(min\(\$\{min\}px, 100%\), 1fr\)\)`/);
  assert.doesNotMatch(page, /width: \d{3,}(px)?[,}]/);
  assert.match(page, /maxWidth: 1180/);
  const panel = fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8");
  assert.match(panel, /<TestersTab\/>/);
  assert.match(fs.readFileSync("client/src/panels/adminMap.js", "utf8"), /\["trial", "Testers"\]/);
});

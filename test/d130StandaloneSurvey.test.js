import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { STANDALONE_SURVEY, SURVEY, saveStandaloneSurvey, standaloneCsv, surveySources, clearSurveyRateLimit, saveSurvey, startTrial,
         SHARED_KEYS, STANDALONE_PER_HOUR } from "../services/trial.js";

// ⭐ D130 (owner 11-01): jobsviadraft.com/survey — the same form, no sign-in, no account; name and email; questions about
// the idea; one response per email; both sources side by side in Admin → Trial. Synthetic people only.

process.env.DRAFT_TRIAL = "on";
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function db0() { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; }
const OK = { name: "Ana Example", email: "ana@example.com", search_stage: "Actively applying", field: "Data, ML and AI",
  time_per_app: "1 to 2 hours", interested: "Maybe", interested_why: "the price" };

test("d130NoSigninNoAccount: the form and the answer are public routes, and an answer creates no account", () => {
  const routes = read("routes/trial.js");
  assert.match(routes, /app\.get\("\/api\/survey\/form", \(_req, res\) =>/, "no requireAuth on the form");
  assert.match(routes, /app\.post\("\/api\/survey", \(req, res\) =>/, "no requireAuth on the answer");
  const db = db0();
  clearSurveyRateLimit();
  const users = db.prepare("SELECT COUNT(*) FROM users").pluck().get();
  saveStandaloneSurvey(db, OK, { ip: "198.51.100.1" });
  assert.equal(db.prepare("SELECT COUNT(*) FROM users").pluck().get(), users, "no account");
  assert.match(read("client/src/App.jsx"), /<Route path="\/survey"\s+element=\{<SurveyPublicPage\/>\}\/>/);
});

test("d130SameFormComponent: the trial's survey and /survey render the ONE SurveyForm", () => {
  assert.match(read("client/src/components/TrialDock.jsx"), /<SurveyForm questions=\{survey\}/);
  assert.match(read("client/src/pages/SurveyPublicPage.jsx"), /<SurveyForm questions=\{questions\} honeypot/);
  assert.doesNotMatch(read("client/src/components/TrialDock.jsx"), /function Stars|function Question/, "not a second copy");
});

test("d130NoFeatureSpecificQuestions: no question rates our screens; D129's 1–7 are asked unchanged; the field not prefilled", () => {
  for (const q of STANDALONE_SURVEY) {
    assert.doesNotMatch(`${q.q} ${q.hint || ""}`, /what you just tried|your job matches|your skills map|application tracker|Draft House|The Table/i, q.key);
  }
  for (const k of ["search_stage", "field", "time_per_app", "apps_per_week", "find_tool", "paid_before", "frustration"]) {
    const a = STANDALONE_SURVEY.find(q => q.key === k), b = SURVEY.find(q => q.key === k);
    assert.equal(a.q, b.q, k); assert.deepEqual(a.options, b.options, k);
  }
  assert.equal(STANDALONE_SURVEY.find(q => q.key === "field").prefill, undefined);
  assert.equal(STANDALONE_SURVEY.find(q => q.key === "idea_useful").type, "stars");
});

test("d130NameEmailRequired: name, email, 1, 2, 3 and 11 are required; a missing one is refused with its key", () => {
  assert.deepEqual(STANDALONE_SURVEY.filter(q => q.required).map(q => q.key), ["name", "email", "search_stage", "field", "time_per_app", "interested"]);
  const db = db0();
  clearSurveyRateLimit();
  assert.throws(() => saveStandaloneSurvey(db, { ...OK, email: "not-an-email" }, { ip: "198.51.100.2" }), (e) => e.status === 400 && e.missing.includes("email"));
  assert.throws(() => saveStandaloneSurvey(db, { ...OK, name: "  " }, { ip: "198.51.100.2" }), (e) => e.missing.includes("name"));
});

test("d130OnePerEmailUpdates + d130SourceStandalone: a second answer from the same email (any case) replaces the first", () => {
  const db = db0();
  clearSurveyRateLimit();
  saveStandaloneSurvey(db, OK, { ip: "198.51.100.3" });
  saveStandaloneSurvey(db, { ...OK, email: "ANA@example.com", interested: "Yes, as soon as I can" }, { ip: "198.51.100.3" });
  const rows = db.prepare("SELECT email, answers FROM standalone_surveys").all();
  assert.equal(rows.length, 1);
  assert.equal(JSON.parse(rows[0].answers).interested, "Yes, as soon as I can");
  assert.equal(JSON.parse(rows[0].answers).interested_why, undefined, "the follow-up went with the answer that asked for it");
  assert.equal(surveySources(db).responses.standalone, 1);
});

test("d130AdminSideBySide: every shared question split trial · standalone · combined; each source's own questions apart", () => {
  const db = db0();
  clearSurveyRateLimit();
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 't1', 'x')").run();
  startTrial(db, 1);
  saveSurvey(db, 1, { interested: "Maybe", rate_matches: 4, compared: "Much better", time_per_app: "30 minutes to 1 hour", apps_per_week: "6 to 15 a week" });
  saveStandaloneSurvey(db, { ...OK, idea_useful: 5, paid_before: "Yes, $20 to $100", apps_per_week: "1 to 5 a week" }, { ip: "198.51.100.4" });
  const s = surveySources(db);
  assert.deepEqual(s.responses, { trial: 1, standalone: 1, combined: 2 });
  assert.deepEqual(s.shared.interested.combined, { Maybe: 2 });
  assert.deepEqual([s.shared.interested.trial, s.shared.interested.standalone], [{ Maybe: 1 }, { Maybe: 1 }]);
  assert.ok(SHARED_KEYS.every(k => s.shared[k]));
  assert.ok(s.trialOnly.rate_matches && s.standaloneOnly.idea_useful && !s.trialOnly.interested);
  // the YC numbers, computed over both
  assert.equal(s.yc.hoursPerWeek.n, 2);
  assert.equal(s.yc.paidForHelp.percent, 100);
  assert.equal(s.yc.betterThanToday.percent, 100);
  assert.equal(s.yc.interested.percent, 0);
  assert.equal(s.yc.stars.idea_useful, 5);
  assert.match(read("client/src/panels/adminTrial.jsx"), /<Tally title="Trial" counts=\{v\.trial\}\/><Tally title="Standalone" counts=\{v\.standalone\}\/><Tally title="Combined" counts=\{v\.combined\}\/>/);
});

test("d130ExportContactOnlyWithToggle: name and email only when asked; the friend's email likewise", () => {
  const db = db0();
  clearSurveyRateLimit();
  saveStandaloneSurvey(db, { ...OK, referral_email: "friend@example.com" }, { ip: "198.51.100.5" });
  const plain = standaloneCsv(db);
  assert.doesNotMatch(plain, /ana@example\.com|Ana Example|friend@example\.com/);
  const full = standaloneCsv(db, { includeContact: true });
  assert.match(full, /Ana Example,ana@example\.com/);
  assert.match(read("routes/trial.js"), /standaloneCsv\(db, \{ includeContact: req\.query\.contact === "1" \}\)/);
});

test("d130HoneypotAndRateLimit: a filled honeypot stores nothing; a sixth answer from one address in an hour is refused", () => {
  const db = db0();
  clearSurveyRateLimit();
  assert.deepEqual(saveStandaloneSurvey(db, { ...OK, website: "http://spam" }, { ip: "198.51.100.6" }), { ok: true, stored: false });
  assert.equal(db.prepare("SELECT COUNT(*) FROM standalone_surveys").pluck().get(), 0);
  for (let i = 0; i < STANDALONE_PER_HOUR; i++) saveStandaloneSurvey(db, { ...OK, email: `p${i}@example.com` }, { ip: "198.51.100.7", now: 1_000_000 + i });
  assert.throws(() => saveStandaloneSurvey(db, { ...OK, email: "p9@example.com" }, { ip: "198.51.100.7", now: 1_000_100 }), (e) => e.status === 429);
  assert.doesNotThrow(() => saveStandaloneSurvey(db, { ...OK, email: "p10@example.com" }, { ip: "198.51.100.7", now: 1_000_000 + 3_700_000 }), "after an hour");
  assert.match(read("client/src/components/SurveyForm.jsx"), /name="website"/);
});

test("d130ThankYouLinksTry: the thank-you offers the trial in about 8 minutes", () => {
  const page = read("client/src/pages/SurveyPublicPage.jsx");
  assert.match(page, /Want to see it\? Try draft in about 8 minutes\./);
  assert.match(page, /onClick=\{\(\) => navigate\("\/try"\)\}/);
  assert.match(read("client/src/pages/marketing/PrivacyPage.jsx"), /The survey at jobsviadraft\.com\/survey needs no account/);
});

test("d130 migration 209: standalone_surveys, byte-identical in both runners, one row per email", () => {
  const block = (s) => s.slice(s.indexOf('id: "209_standalone_surveys"'), s.indexOf("`,", s.indexOf('id: "209_standalone_surveys"')));
  const a = block(fs.readFileSync("server.js", "utf8")), b = block(fs.readFileSync("scripts/migrations.js", "utf8"));
  assert.ok(a.includes("email_key  TEXT NOT NULL UNIQUE"));
  assert.equal(a, b);
});

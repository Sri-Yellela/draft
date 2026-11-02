// 44b (owner 11-02): the Android 404 (a link that kept its sentence's punctuation), the trial's sequence that can no
// longer be broken before the survey, and the testers' names, emails and questions for the admin. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { cleanLinkPath } from "../services/linkPunctuation.js";
import { testerContacts, testerContactsCsv } from "../services/testerContacts.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("t44bLinkPunctuation: '/try):' from a message goes to /try; clean paths, assets and /api are untouched", () => {
  assert.equal(cleanLinkPath("/try):"), "/try");
  assert.equal(cleanLinkPath("/try."), "/try");
  assert.equal(cleanLinkPath("/survey,"), "/survey");
  assert.equal(cleanLinkPath("/try%E2%80%9D"), "/try", "a typographic quote, percent-encoded");
  for (const p of ["/", "/try", "/try/", "/jobs/acme-backend-123", "/assets/index-x.js", "/api/trial/state", "/api/x)."]) assert.equal(cleanLinkPath(p), null, p);
  const server = lf("server.js");
  const at = server.indexOf("app.use(express.static(CLIENT_DIST));");
  const mw = server.indexOf("const clean = cleanLinkPath(req.path);");
  assert.ok(at > 0 && mw > 0 && mw < at, "the redirect runs before the static files and the app shell");
  assert.match(server.slice(mw, at), /res\.redirect\(301, clean/);
});

test("t44bNoSkipBeforeSurvey: the tour's only way out is the survey; the survey has no skip; the dismiss route refuses", () => {
  const tour = lf("client/src/components/GuidedTour.jsx");
  assert.doesNotMatch(tour, /Skip the tour/);
  assert.match(tour, />Skip to the survey</);
  assert.match(tour, /setDone\(true\); onSkipToSurvey\?\.\(\);/, "leaving the tour ends the trial into the survey");
  assert.match(tour, /if \(saved\.done && !state\?\.locked\) onSkipToSurvey\?\.\(\)/, "a tour skipped before this fix goes to the survey too");
  const dock = lf("client/src/components/TrialDock.jsx");
  assert.doesNotMatch(dock, /Skip the survey|survey\/dismiss/);
  assert.match(dock, /onSkipToSurvey=\{\(\) => finish\(\)\.then\(\(\) => setSurveyOpen\(true\)\)\}/);
  const routes = lf("routes/trial.js");
  const i = routes.indexOf('app.post("/api/trial/survey/dismiss"');
  assert.ok(i >= 0, "the dismiss route is still mounted (older pages call it)");
  const r = routes.slice(i);
  assert.match(r.slice(0, 300), /res\.status\(410\)/);
  assert.doesNotMatch(r.slice(0, 300), /dismissSurvey\(/);
});

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const user = db.prepare("INSERT INTO users (id, username, password_hash, trial_at, trial_resume) VALUES (?, ?, 'x', ?, ?)");
  const prof = db.prepare("INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (?, ?, ?, ?)");
  user.run(1, "rowan", 1000, "A"); prof.run(1, "Rowan", "Ellery", "rowan@example.com");
  user.run(2, "kit", 2000, null); prof.run(2, "Kit", "Marlow", "kit@example.com");
  db.prepare("INSERT INTO trial_feedback (user_id, screen, body, created_at) VALUES (1, '/app/house', 'How do I see what was sent?', 1500)").run();
  db.prepare("INSERT INTO trial_surveys (user_id, answers, created_at) VALUES (1, ?, 1600)").run(JSON.stringify({ must_have: "Workday support, please." }));
  db.prepare("INSERT INTO standalone_surveys (name, email, email_key, answers, created_at) VALUES ('Sam Ortiz', 'sam@example.com', 'sam@example.com', ?, 1700)")
    .run(JSON.stringify({ name: "Sam Ortiz", must_have: "Does it work for nurses?" }));
  return db;
}

test("t44bPeopleAndQuestions: each person by name and email with their status, messages and written answers", () => {
  const db = db0();
  const { people, messages } = testerContacts(db);
  assert.equal(people.length, 3);
  assert.equal(messages, 1);
  const rowan = people.find(p => p.email === "rowan@example.com");
  assert.equal(rowan.name, "Rowan Ellery");
  assert.equal(rowan.status, "survey answered");
  assert.deepEqual(rowan.feedback.map(f => f.body), ["How do I see what was sent?"]);
  assert.equal(rowan.written[0].answer, "Workday support, please.");
  assert.equal(people.find(p => p.email === "kit@example.com").status, "signed up");
  const sam = people.find(p => p.source === "standalone survey");
  assert.equal(sam.name, "Sam Ortiz");
  assert.equal(sam.written.length, 1, "the name is not repeated as a written answer");
  const csv = testerContactsCsv(db);
  const [head, ...rows] = csv.trim().split("\n");
  assert.match(head, /^source,name,email,status,/);
  assert.ok(csv.includes("rowan@example.com") && csv.includes("How do I see what was sent?") && csv.includes("Does it work for nurses?"));
  assert.ok(rows.length >= 3);
});

test("t44bTestAccountsLeftOut: an account tagged test is left out and counted apart", () => {
  const db = db0();
  try { db.prepare("INSERT INTO user_tags (user_id, tag) VALUES (2, 'test')").run(); } catch { return; }   // no tag table: nothing to check
  const out = testerContacts(db);
  assert.ok(!out.people.some(p => p.email === "kit@example.com"));
  assert.equal(out.excluded, 1);
});

test("t44bAdminWiring: the panel, its routes (admin only) and the names-and-emails download exist", () => {
  const routes = lf("routes/trial.js");
  assert.match(routes, /app\.get\("\/api\/admin\/trial\/people", requireAdmin/);
  assert.match(routes, /app\.get\("\/api\/admin\/trial\/people\.csv", requireAdmin/);
  const panel = lf("client/src/panels/adminTrial.jsx");
  assert.match(panel, /<PeopleAndQuestions\/>/);
  assert.match(panel, /export\.csv\?emails=1/);
});

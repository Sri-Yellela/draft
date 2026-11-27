// ⭐ D142 DEFEND (46y) · "Every line you wrote, asked about" — each base-résumé bullet's follow-ups, from TEMPLATES over the
// bullet's own technologies, numbers, scope words and the plausibility / honesty checks' flags (services/defendResume.js), then
// a harder one; the Interview page's Defend panel. Synthetic people and companies only (Avery Sample, Northwind).
// Tests: d142DefendFollowUps (the WORKLOG's name) · the flags first · the route · no model · the panel's steps.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import interviewRoutes from "../routes/interview.js";
import { defendQuestions, defendFor, TEMPLATES, MAX_QUESTIONS } from "../services/defendResume.js";
import { DEFEND_START, defendNext, defendAnotherLine, clockWords } from "../client/src/pages/interview/interviewModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const RESUME = `Avery Sample
EXPERIENCE
Senior Engineer, Northwind Traders
2016 - 2019
- Built React and Node.js features used by 3 product teams
- Led the billing migration to Kubernetes, cutting hosting costs by 40%
- Wrote the on-call runbook
EDUCATION
BS Computer Science`;

test("d142DefendFollowUps · every bullet gets the interviewer's follow-up and a harder one, from templates over its own facts", () => {
  const r = defendQuestions({ text: RESUME });
  assert.equal(r.total, 3);
  for (const b of r.bullets) {
    assert.ok(b.questions.length >= 1 && b.questions.length <= MAX_QUESTIONS, b.text);
    for (const q of b.questions) {
      assert.ok(TEMPLATES[q.kind], `${q.kind} is a template`);
      for (const k of ["ask", "harder", "because"]) assert.ok(typeof q[k] === "string" && q[k].length > 10, `${q.kind}.${k}`);
    }
    // the sketch's own question closes every bullet
    assert.equal(b.questions.at(-1).kind, "proud");
    assert.match(b.questions.at(-1).ask, /proudest of, and what would you do differently/);
    assert.equal(b.employer, "Northwind Traders");
  }
  const mig = r.bullets.find(b => /billing migration/.test(b.text));
  assert.deepEqual(mig.questions.map(q => q.kind), ["number", "scope", "skill", "proud"]);
  assert.match(mig.questions[0].ask, /How did you measure 40%\?/);
  assert.match(mig.questions[1].ask, /You say "led"/);
  assert.match(mig.questions[2].ask, /Why Kubernetes here/);
  assert.match(mig.questions[2].harder, /bottleneck with Kubernetes/);
  const react = r.bullets.find(b => /React/.test(b.text));
  assert.deepEqual(react.skills, ["React", "Node.js"]);
  assert.ok(!react.questions.some(q => q.kind === "number"), "a bare count (3 product teams) is not a measurement to back");
  // the line with the most to defend first; the plain line last
  assert.match(r.bullets[0].text, /billing migration/);
  assert.match(r.bullets.at(-1).text, /runbook/);
  assert.deepEqual(r.bullets.at(-1).questions.map(q => q.kind), ["proud"]);
});

test("d142DefendFlagsFirst · the plausibility check's flags are asked first and put their line at the top", () => {
  const plausibility = { entries: [{ employer: "Northwind Traders", end: 2019, flags: [
    { kind: "timeline", tech: "LangChain", bullet: "Wrote the on-call runbook", reason: "LangChain came out in 2022, after this role ended (2019)" },
    { kind: "role", bullet: "Wrote the on-call runbook", reason: "Leading 40 people at Northwind Traders, which has about 30 — check this" }] }] };
  const r = defendQuestions({ text: RESUME, plausibility });
  const top = r.bullets[0];
  assert.match(top.text, /runbook/);
  assert.deepEqual(top.questions.map(q => q.kind), ["timeline", "role", "proud"]);
  assert.match(top.questions[0].ask, /^LangChain came out in 2022, after this role ended in 2019\./);
  assert.match(top.questions[1].ask, /team of 40/);
  assert.equal(top.signals[0].reason, "LangChain came out in 2022, after this role ended (2019)");
});

test("d142Defend · a résumé with no experience heading still has its bullets read (the honesty check's reader)", () => {
  const r = defendQuestions({ text: "• Cut page load time by 30% with a Redis cache in front of PostgreSQL\n• Mentored two interns" });
  assert.equal(r.total, 2);
  assert.match(r.bullets[0].questions[0].ask, /30%/);
  assert.deepEqual(defendQuestions({ text: "" }).bullets, []);
});

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'avery','x'), (2,'blake','x')").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (10, 1, 'Eng', 'engineering', 'software', 1)`).run();
  db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, name, content) VALUES (10, 1, 'r.txt', ?)`).run(RESUME);
  return db;
}

test("d142DefendRoute · GET /api/interview/defend reads the caller's own base résumé; none → hasResume false; signed out → 401", async () => {
  const db = freshDb();
  assert.equal(defendFor(db, 1).bullets.length, 3);
  assert.deepEqual(defendFor(db, 2), { version: "1.0.0", hasResume: false, bullets: [], total: 0 });
  const app = express();
  app.use(express.json());
  const requireAuth = (req, res, next) => { const u = Number(req.get("x-user")); if (!u) return res.status(401).json({ error: "auth" }); req.user = { id: u }; next(); };
  interviewRoutes(app, db, requireAuth);
  const srv = app.listen(0);
  try {
    const base = `http://127.0.0.1:${srv.address().port}`;
    const mine = await fetch(`${base}/api/interview/defend`, { headers: { "x-user": "1" } });
    assert.equal(mine.status, 200);
    assert.match(mine.headers.get("cache-control") || "", /no-store/);
    const body = await mine.json();
    assert.equal(body.hasResume, true);
    assert.equal(body.bullets.length, 3);
    const other = await (await fetch(`${base}/api/interview/defend`, { headers: { "x-user": "2" } })).json();
    assert.equal(other.hasResume, false, "never another person's résumé");
    assert.equal((await fetch(`${base}/api/interview/defend`)).status, 401);
    // read only: nothing was written
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM profile_base_resumes").get().n, 1);
  } finally { srv.close(); }
});

test("d142DefendNoModel · D190: the service and the panel call no model and send nothing", () => {
  const svc = read("services/defendResume.js");
  assert.doesNotMatch(svc, /anthropic|callTask|modelClient|fetch\(|INSERT|UPDATE /i);
  const page = (fs.readFileSync("client/src/pages/interview/ProvingGround.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: InterviewPage.jsx deleted — its home now */;
  // ⭐ 47m (D197 #13): Defend is the Proving ground's DefendWalk (the approved ProvingGround board's chair)
  const panel = page.slice(at(page, "function DefendWalk()"), at(page, "function Practise("));
  assert.match(panel, /useRead\("\/api\/interview\/defend"\)/);
  assert.doesNotMatch(panel, /method: "POST"|getUserMedia|SpeechRecognition/, "typed answers stay in the tab; nothing listens");
  for (const w of ["THE INTERVIEWER ASKS", "Answer out loud", "Type it"]) assert.ok(panel.includes(w), w);
});

test("d142DefendSteps · ask → answering → the harder follow-up → the line's next question → the next line", () => {
  const bullets = [{ questions: [{}, {}] }, { questions: [{}] }];
  let p = DEFEND_START;
  assert.deepEqual(defendNext(p, bullets), p, "nothing moves until an answer starts");
  p = { ...p, stage: "answering", mode: "typed" };
  p = defendNext(p, bullets); assert.equal(p.stage, "harder");
  p = defendNext(p, bullets); assert.deepEqual(p, { line: 0, q: 1, stage: "ask", mode: null });
  p = defendNext(defendNext({ ...p, stage: "answering" }, bullets), bullets); assert.deepEqual(p, { line: 1, q: 0, stage: "ask", mode: null });
  p = defendNext(defendNext({ ...p, stage: "answering" }, bullets), bullets); assert.equal(p.line, 0, "wraps to the first line");
  assert.equal(defendAnotherLine({ line: 1, q: 0 }, bullets).line, 0);
  assert.deepEqual([clockWords(0), clockWords(42), clockWords(125)], ["0:00", "0:42", "2:05"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createDomainProfilesRouter } from "../routes/domainProfiles.js";
import { inferProfileFromResume, yearsOfWork, seniorityOf } from "../services/resumeOnboarding.js";

// ⭐ A104 (owner 10-30) · "have the resume do the initiation work" — one upload makes the first job profile, attaches
// the résumé, fills the profile's sections and empty contact fields. Synthetic person and companies throughout.

const REGISTRY = JSON.parse(fs.readFileSync("registry/DOMAIN_METADATA_REGISTRY.json", "utf8"));

const RESUME = `Riley Sample
riley@example.test | (555) 010-0199 | github.com/riley-sample
Boston, MA
SUMMARY
Backend engineer building distributed systems and REST APIs.
EXPERIENCE
Northwind — Senior Software Engineer
Mar 2018 – Present | Boston, MA
- Designed microservices on cloud infrastructure with Python and Go
- Built CI/CD for 40 services
Contoso — Software Engineer
Jun 2015 – Feb 2018
- Wrote Java services and system design docs
EDUCATION
Northeastern University — MS Computer Science
2013 – 2015
SKILLS
Python, Go, Java, TypeScript, Docker
`;

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'riley','x')").run();
  db.prepare("INSERT INTO user_profile (user_id, full_name, email) VALUES (1, 'Riley Sample', 'riley@example.test')").run();
  return db;
}

function mount(db, writes = []) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  app.use("/api/domain-profiles", createDomainProfilesRouter(db, null, () => {}, { onProfileWrite: (u, id, what) => writes.push([u, id, what]) }));
  const server = app.listen(0);
  return { base: `http://127.0.0.1:${server.address().port}/api/domain-profiles`, stop: () => server.close() };
}

test("A104 · the résumé names the domain, the level, the titles and the keywords — no model, the wizard's registry", () => {
  const p = inferProfileFromResume(RESUME, REGISTRY, 2026);
  assert.equal(p.domain, "engineering");
  assert.equal(p.roleFamily, REGISTRY.engineering.roleFamily);
  assert.equal(p.seniority, "senior");
  assert.equal(p.years, 2026 - 2015, "work years start at the first JOB, not the degree's 2013");
  assert.ok(p.titles.includes("Software Engineer"));
  for (const k of ["distributed systems", "microservices", "REST APIs"]) assert.ok(p.keywords.includes(k), k);
  for (const t of ["Python", "Go", "Java"]) assert.ok(p.tools.includes(t), t);
  // A term counts as itself, not inside another word.
  const g = inferProfileFromResume("Good at going to meetings. ".repeat(20), REGISTRY, 2026);
  assert.ok(!g.tools.includes("Go") || g.domain === "general");
});

test("A104 · the level: years of work, a title that says so, and a student reads as entry", () => {
  assert.equal(yearsOfWork("Acme — Engineer\nJan 2024 – Present\nState University\n2019 – 2023", 2026), 2);
  assert.equal(seniorityOf("Software Engineering Intern\nState University", null), "junior");
  assert.equal(seniorityOf("Engineer", 1), "junior");
  assert.equal(seniorityOf("Engineer", 4), "mid");
  assert.equal(seniorityOf("Director of Engineering", 12), "executive");
  assert.equal(seniorityOf("Engineer", 9), "senior");
});

test("A104 · POST /from-resume: one upload → an active job profile with the résumé as its base, sections, empty fields filled", async () => {
  const db = freshDb();
  const writes = [];
  const t = mount(db, writes);
  try {
    const r = await fetch(`${t.base}/from-resume`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: RESUME, name: "riley.pdf" }) });
    assert.equal(r.status, 200, await r.clone().text());
    const out = await r.json();
    assert.equal(out.profile.domain, "engineering");
    assert.equal(out.profile.is_active, 1);
    assert.equal(db.prepare("SELECT domain_profile_complete FROM users WHERE id=1").pluck().get(), 1, "the board no longer waits on the wizard");
    assert.equal(db.prepare("SELECT name FROM profile_base_resumes WHERE profile_id=?").pluck().get(out.profileId), "riley.pdf");
    // The person profile's sections were filled from the same résumé.
    assert.ok(db.prepare("SELECT COUNT(*) FROM profile_experience WHERE user_id=1").pluck().get() >= 2);
    // Empty contact fields filled; what the user typed at sign-up is untouched.
    assert.ok(out.filled.includes("phone"));
    assert.equal(db.prepare("SELECT email FROM user_profile WHERE user_id=1").pluck().get(), "riley@example.test");
    assert.ok(!out.filled.includes("email") && !out.filled.includes("full_name"));
    // ⛔ No eligibility answer is inferred.
    assert.equal(db.prepare("SELECT COUNT(*) FROM application_defaults WHERE user_id=1 AND key IN ('authorised_to_work','sponsorship_now','sponsorship_later')").pluck().get(), 0);
    // The board re-scores for the new active profile.
    assert.deepEqual(writes.find(w => w[2] === "POST /from-resume"), [1, out.profileId, "POST /from-resume"]);
    // A second upload is refused — a second job profile is the wizard's.
    const again = await fetch(`${t.base}/from-resume`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: RESUME, name: "r2.pdf" }) });
    assert.equal(again.status, 409);
    // Too little text to read is refused, not guessed from.
    db.prepare("DELETE FROM domain_profiles").run();
    const thin = await fetch(`${t.base}/from-resume`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Riley", name: "r.pdf" }) });
    assert.equal(thin.status, 400);
  } finally { t.stop(); }
});

test("A104 UI · a new account's board and deck ask for the résumé; the wizard is 'Set it up by hand instead'", () => {
  const start = fs.readFileSync("client/src/components/StartFromResume.jsx", "utf8");
  const jobs = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  const deck = fs.readFileSync("client/src/panels/DeckView.jsx", "utf8");
  const profiles = fs.readFileSync("client/src/panels/JobProfilesPanel.jsx", "utf8");
  assert.match(start, /api\("\/api\/domain-profiles\/from-resume", \{ method: "POST", body: JSON\.stringify\(\{ content: text, name: file\.name \}\) \}\)/);
  assert.match(start, /Set it up by hand instead/);
  assert.match(jobs, /<StartFromResume onManual=/);
  assert.match(deck, /s\.reason === "no_profile" && \(\s*<StartFromResume onDone=\{\(\) => fetchDeck\(\)\}/);
  // One file reader, not two (A93).
  assert.match(profiles, /import \{ parseResumeFile \} from "\.\.\/lib\/parseResumeFile\.js";/);
  assert.doesNotMatch(profiles, /const parseResumeFile = async/);
});

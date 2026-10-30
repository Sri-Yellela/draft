import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import profileSectionRoutes from "../routes/profileSections.js";
import {
  readProfile, saveSection, setDefault, defaultFor, readDefaults, saveBackFromNeedsYou, splitCompanyTitle, useResumeSuggestion,
} from "../services/structuredProfile.js";

// ⭐ D101 (owner 10-30) · the profile in sections, filled from the résumé's parse; Application defaults set / not set.
// Synthetic person and companies.

const RESUME = `Dana Example
dana@example.test | Boston, MA
SUMMARY
Backend engineer building data systems.
EXPERIENCE
Northwind — Software Engineer
Jan 2022 – Present | Boston, MA
- Built a queue
- Cut latency 30%
Contoso — Intern
May 2021 – Aug 2021
- Wrote tests
EDUCATION
Northeastern University — MS Computer Science
2020 – 2022
SKILLS
Languages: Java, Python
Tools: Docker
`;

function freshDb({ resume = RESUME } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email,requires_sponsorship,linkedin_url) VALUES (1,'Dana','Example','dana@example.test',0,'linkedin.com/in/dana-example')").run();
  if (resume) db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt',?,unixepoch())").run(resume);
  return db;
}

test("D101 · d101ParseFillsSections — first open fills every section from the résumé's parse", () => {
  const db = freshDb();
  const p = readProfile(db, 1);
  assert.equal(p.sections.summary, "Backend engineer building data systems.");
  assert.deepEqual(p.sections.experience.map(e => [e.company, e.title, e.current]),
    [["Northwind", "Software Engineer", true], ["Contoso", "Intern", false]]);
  assert.equal(p.sections.experience[1].start, "2021-05");
  assert.equal(p.sections.experience[1].end, "2021-08");
  assert.deepEqual(p.sections.experience[0].bullets, ["Built a queue", "Cut latency 30%"]);
  assert.deepEqual(p.sections.skills.map(s => s.name), ["Java", "Python", "Docker"]);
  assert.deepEqual(p.sections.links.map(l => l.url), ["https://linkedin.com/in/dana-example"]);
  assert.equal(p.sections.experience[0].source, "resume");
  assert.equal(p.suggestion, null);
  assert.deepEqual(p.completeness.of, 10);
  assert.ok(p.completeness.done >= 5 && p.completeness.done < 10, `${p.completeness.done} of 10`);
  assert.deepEqual(splitCompanyTitle("Northwind - Staff Engineer", ""), { company: "Northwind", title: "Staff Engineer", dateInTitle: null });
});

test("D101 · d101EditNeverRewritesBaseFile — saving sections leaves the uploaded résumé byte-identical", () => {
  const db = freshDb();
  readProfile(db, 1);
  const before = db.prepare("SELECT content, updated_at FROM profile_base_resumes").get();
  saveSection(db, 1, "summary", { summary: "Changed by the user." });
  saveSection(db, 1, "experience", { items: [{ company: "Fabrikam", title: "SRE", start: "2023-01", current: true, bullets: ["Paged less"] }] });
  saveSection(db, 1, "skills", { items: ["Go", { name: "Kubernetes", category: "Tools" }] });
  assert.deepEqual(db.prepare("SELECT content, updated_at FROM profile_base_resumes").get(), before);
  const p = readProfile(db, 1);
  assert.equal(p.sections.summary, "Changed by the user.");
  assert.deepEqual(p.sections.experience.map(e => e.company), ["Fabrikam"]);
  assert.equal(p.sections.experience[0].source, "user");
});

test("D101 · a NEW base résumé is OFFERED, never applied silently; one press uses it", () => {
  const db = freshDb();
  readProfile(db, 1);
  saveSection(db, 1, "summary", { summary: "Mine." });
  db.prepare("UPDATE profile_base_resumes SET content = ? WHERE profile_id = 10").run(RESUME.replace("Contoso — Intern", "Litware — Intern"));
  const p = readProfile(db, 1);
  assert.equal(p.sections.summary, "Mine.", "the stored sections are not changed");
  assert.ok(p.suggestion, "the difference is offered");
  assert.ok(p.suggestion.experience.some(e => e.company === "Litware"));
  assert.equal(useResumeSuggestion(db, 1), true);
  const after = readProfile(db, 1);
  assert.ok(after.sections.experience.some(e => e.company === "Litware"));
  assert.equal(after.suggestion, null);
});

test("D101 · d101UnsetDefaultIsNotAnAnswer — requires_sponsorship = 0 reads NOT SET; the fill gets null", () => {
  const db = freshDb();
  readProfile(db, 1);
  const wa = readDefaults(db, 1).find(g => g.group === "work_authorisation");
  const sponsor = wa.items.find(i => i.key === "sponsorship_now");
  assert.deepEqual([sponsor.set, sponsor.value], [false, null], "a 0 column default is not an answer");
  assert.equal(defaultFor(db, 1, "sponsorship_now"), null, "→ the fill sends Needs you");
  // an explicit answer the profile states IS imported, marked as such
  const db2 = freshDb();
  db2.prepare("UPDATE user_profile SET sponsorship_need='future', gender='Decline to self-identify' WHERE user_id=1").run();
  readProfile(db2, 1);
  assert.equal(defaultFor(db2, 1, "sponsorship_now"), "no");
  assert.equal(defaultFor(db2, 1, "sponsorship_later"), "yes");
  assert.equal(readDefaults(db2, 1).find(g => g.group === "eeo").items.find(i => i.key === "gender").source, "imported");
});

test("D101 · defaults are validated; set, cleared, and d101AnswerSavedBack from Needs you", () => {
  const db = freshDb();
  assert.throws(() => setDefault(db, 1, "sponsorship_now", "maybe"), /yes, no/);
  assert.throws(() => setDefault(db, 1, "favourite_colour", "blue"), /No application default/);
  assert.throws(() => setDefault(db, 1, "citizenship", "  "), /leave it not set/);
  setDefault(db, 1, "authorised_to_work", "yes");
  assert.equal(defaultFor(db, 1, "authorised_to_work"), "yes");
  setDefault(db, 1, "authorised_to_work", null);
  assert.equal(defaultFor(db, 1, "authorised_to_work"), null);
  assert.equal(saveBackFromNeedsYou(db, 1, "clearance", "secret"), true);
  assert.equal(readDefaults(db, 1).flatMap(g => g.items).find(i => i.key === "clearance").source, "needs_you");
  assert.equal(saveBackFromNeedsYou(db, 1, "not_a_default", "x"), false);
});

test("D101 · the drawer's Save is checked: dates in order, no end date in the future, required names", () => {
  const db = freshDb();
  const now = Math.floor(Date.UTC(2026, 9, 30) / 1000);
  assert.throws(() => saveSection(db, 1, "experience", { items: [{ company: "X", start: "2024-05", end: "2023-01" }] }, now), /before the start/);
  assert.throws(() => saveSection(db, 1, "experience", { items: [{ company: "X", start: "2024-05", end: "2027-01" }] }, now), /future/);
  assert.throws(() => saveSection(db, 1, "experience", { items: [{ company: "", start: "2024-05" }] }, now), /company is required/);
  assert.throws(() => saveSection(db, 1, "education", { items: [{ school: "U", start: "May 2020" }] }, now), /YYYY-MM/);
  assert.throws(() => saveSection(db, 1, "links", { items: [{ url: "javascript:alert(1)" }] }, now), /https/);
  assert.throws(() => saveSection(db, 1, "hobbies", {}, now), /No section/);
  saveSection(db, 1, "experience", { items: [{ company: "X", start: "2024-05", end: "2026-10" }] }, now);
});

test("D101 · d101LogoFallbackSquare (server) — a stored logo is linked; none → no URL and the initial for the square tile", () => {
  const db = freshDb();
  db.prepare("INSERT INTO company_logos (company_key, company, status, mime, bytes, checked_at) VALUES ('northwind','Northwind','ok','image/png',x'89504E47',unixepoch())").run();
  const exp = readProfile(db, 1).sections.experience;
  assert.match(exp.find(e => e.company === "Northwind").logo, /^\/api\/company-logo\/northwind$/);
  const contoso = exp.find(e => e.company === "Contoso");
  assert.deepEqual([contoso.logo, contoso.initial], [null, "C"]);
});

test("D101 · the routes: read, save, a bad save refused whole, a default set and cleared", async () => {
  const db = freshDb();
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  profileSectionRoutes(app, db, (_q, _r, n) => n());
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body) => { const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
  try {
    assert.equal((await call("GET", "/api/profile/sections")).body.sections.experience.length, 2);
    assert.equal((await call("PUT", "/api/profile/sections/experience", { items: [{ company: "", start: "2020-01" }] })).status, 400);
    assert.equal(db.prepare("SELECT COUNT(*) FROM profile_experience").pluck().get(), 2, "nothing half-stored");
    assert.equal((await call("PUT", "/api/profile/defaults/relocate", { value: "yes" })).status, 200);
    assert.equal((await call("PUT", "/api/profile/defaults/relocate", {})).status, 400);
    assert.equal((await call("PUT", "/api/profile/defaults/relocate", { value: null })).body.defaults
      .find(g => g.group === "work_preferences").items.find(i => i.key === "relocate").set, false);
  } finally { server.close(); }
});

test("D101 · no base résumé: the profile opens empty — nothing is invented", () => {
  const db = freshDb({ resume: null });
  const p = readProfile(db, 1);
  assert.deepEqual([p.sections.experience, p.sections.education, p.sections.skills], [[], [], []]);
  assert.equal(p.sections.summary, null);
});

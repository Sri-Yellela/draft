// ⚠ BUG D120 P1 (owner 10-31) · "it currently shows Upload a résumé and this page becomes your map but my resume already
// exists." CAUSE (read from the code): the map's "have" read ONLY profile_skills, and D101 fills profile_skills from the
// résumé's parse when the Profile is first OPENED (services/structuredProfile.js) — a user with a résumé who never opened
// the Profile had no terms, so GET /api/atlas/me answered the no-résumé home. FIX (services/atlas/atlasStore.js haveTerms):
// the Profile's skills; if it has none, the base résumé's parsed skills (D65), with "Confirm these on your Profile"; the
// upload line only with no résumé at all, and a résumé with no readable skill says so instead. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus, haveTerms, profileTerms } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { computeYourMap, UPLOAD_PROMPT, NO_SKILLS_READ, CONFIRM_ON_PROFILE } from "../services/atlas/atlasMe.js";

const RESUME = `Ada Synthetic
Software Engineer | ada@example.invalid

EXPERIENCE
Northwind — Software Engineer
Jan 2022 – Present
- Built the billing service in Go

SKILLS
Languages: Go, Python, SQL`;
const NO_SKILLS = `Ada Synthetic
Software Engineer | ada@example.invalid

EXPERIENCE
Northwind — Software Engineer
Jan 2022 – Present
- Built the billing service`;

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const n of ["Python", "SQL", "Go"]) { upsertNode(db, { kind: "skill", name: n, source: "registry" }); setStatus(db, n.toLowerCase(), "published"); }
  let j = 0;
  for (const t of ["Python and SQL daily.", "Go services with SQL.", "Python pipelines."]) {
    const id = `j${++j}`;
    db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active) VALUES (?,?,?,?,?,?,?,1)`)
      .run(id, "Engineer", "Co", `https://x.test/${id}`, "t", `h${id}`, t);
  }
  computeAtlasStats(db, { boardEdges: false });
  return db;
}
const user = (db, id) => {
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (?,?,'x')").run(id, `synthetic${id}`);
  db.prepare("INSERT INTO user_profile (user_id) VALUES (?)").run(id);
};
const baseResume = (db, id, text) => db.prepare("INSERT INTO base_resume (user_id, name, content) VALUES (?, 'base.txt', ?)").run(id, text);
const jobProfileBase = (db, id, text, active = 1) => {
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (?,?,?,?,?)`)
    .run(id, "Engineer", "engineering", "software", active).lastInsertRowid;
  db.prepare(`INSERT INTO profile_base_resumes (user_id, profile_id, content) VALUES (?, ?, ?)`).run(id, pid, text);
};

test("D120 P1 · d120ResumeButEmptyProfileStillMaps — a résumé on file and an unopened Profile: the map is drawn from the résumé's parsed skills, with the Profile nudge", () => {
  const db = world();
  user(db, 7); baseResume(db, 7, RESUME);
  assert.equal(db.prepare("SELECT COUNT(*) FROM profile_skills WHERE user_id = 7").pluck().get(), 0, "the Profile was never opened");
  const t = haveTerms(db, 7);
  assert.equal(t.source, "resume");
  assert.ok(["go", "python", "sql"].every(s => t.terms.has(s)), [...t.terms].join(","));
  const me = computeYourMap(db, 7);
  assert.equal(me.map, true, "the map is drawn");
  assert.notEqual(me.prompt, UPLOAD_PROMPT);
  assert.equal(me.skillsFrom, "resume");
  assert.equal(me.nudge, CONFIRM_ON_PROFILE);
  assert.deepEqual(me.haveSkills.groups.flatMap(g => g.items).map(i => i.name).sort(), ["Go", "Python", "SQL"]);
  // one read path: every Atlas reader of "what you have" agrees (role pages, popups, interview prep read profileTerms)
  assert.deepEqual([...profileTerms(db, 7)].sort(), [...t.terms].sort());
});

test("D120 P1 · the Profile's own skills win over the résumé's — no nudge once the Profile has skills", () => {
  const db = world();
  user(db, 8); baseResume(db, 8, RESUME);
  db.prepare("INSERT INTO profile_skills (user_id, name, position) VALUES (8, 'SQL', 0)").run();
  const me = computeYourMap(db, 8);
  assert.equal(me.skillsFrom, "profile");
  assert.equal(me.nudge, undefined);
  assert.deepEqual(me.haveSkills.groups.flatMap(g => g.items).map(i => i.name), ["SQL"]);
});

test("D120 P1 · a job profile's base résumé counts too (the active one)", () => {
  const db = world();
  user(db, 9); jobProfileBase(db, 9, RESUME);
  const me = computeYourMap(db, 9);
  assert.equal(me.map, true);
  assert.equal(me.skillsFrom, "resume");
});

test("D120 P1 · d120UploadPromptOnlyWithoutResume — no résumé: the upload line; a résumé with no readable skill (or on an inactive profile): never the upload line", () => {
  const db = world();
  user(db, 10);
  const none = computeYourMap(db, 10);
  assert.deepEqual([none.map, none.reason, none.prompt], [false, "no_profile_skills", UPLOAD_PROMPT]);
  user(db, 11); baseResume(db, 11, NO_SKILLS);
  const unread = computeYourMap(db, 11);
  assert.deepEqual([unread.map, unread.reason, unread.prompt], [false, "no_skills_read", NO_SKILLS_READ]);
  assert.ok(unread.exploreByRole, "still never an empty page");
  user(db, 12); jobProfileBase(db, 12, RESUME, 0);
  const inactive = computeYourMap(db, 12);
  assert.notEqual(inactive.prompt, UPLOAD_PROMPT, "a résumé on an inactive job profile is still a résumé");
  const anon = computeYourMap(db, null);
  assert.equal(anon.prompt, UPLOAD_PROMPT, "signed out keeps the upload line");
});

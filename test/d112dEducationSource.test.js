import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import profileSectionRoutes from "../routes/profileSections.js";
import { createDomainProfilesRouter } from "../routes/domainProfiles.js";
import {
  educationOf, educationEntries, setEducationOverride, withApplicationDefaults, saveSection, readProfile,
} from "../services/structuredProfile.js";
import { userEligibilityInputs } from "../services/jobEligibility.js";
import { eligibilityOf } from "../shared/eligibility.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D112 d2 (owner 10-30 night) · the Education SECTION is the source of the degree — derived (the highest level wins),
// a per-profile Change override, migration 179 moves the old block in (no duplicates), and the old block is gone.
// ⭐ D112 e2 · a job profile made from a résumé shows "Refine your job profile" until the wizard is saved for it.
// Synthetic person, schools and companies throughout.

const M179 = "179_education_source";

function freshDb({ upTo179 = true } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) if (upTo179 || m.id !== M179) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'casey','x')").run();
  db.prepare("INSERT INTO user_profile (user_id, full_name, email) VALUES (1, 'Casey Example', 'casey@example.test')").run();
  return db;
}
const run179 = (db) => db.exec(MIGRATIONS.find(m => m.id === M179).sql);
const basePayload = () => ({
  field_map: { highest_degree: "OLD BLOCK", field_of_study: "OLD", university: "OLD U", graduation_year: "1999", email: "casey@example.test" },
  handler_map: { degree: "OLD BLOCK", "field-of-study": "OLD", school: "OLD U", "grad-year": "1999" },
});

test("D112 · d112dDerivedHighest — the highest level among the section's entries is the degree; forms and eligibility read it", () => {
  const db = freshDb();
  // The old block still holds a value — it must NOT be read.
  db.prepare("UPDATE user_profile SET highest_degree = 'PhD', university = 'Old Block College' WHERE user_id = 1").run();
  saveSection(db, 1, "education", { items: [
    { school: "Lakeside Community College", degree: "Associate of Science", field: "Biology", start: "2014-09", end: "2016-05" },
    { school: "Example State University", degree: "M.S.", field: "Computer Science", start: "2019-09", end: "2021-05" },
    { school: "Example State University", degree: "Bachelor of Science", field: "Mathematics", start: "2016-09", end: "2019-05" },
  ] });
  const e = educationOf(db, 1);
  assert.equal(e.source, "section");
  assert.deepEqual([e.degree, e.field, e.school, e.year], ["M.S.", "Computer Science", "Example State University", "2021"],
    "the master's wins over the bachelor's and the associate's, whatever the order");

  const p = withApplicationDefaults(db, 1, basePayload());
  assert.equal(p.field_map.highest_degree, "M.S.");
  assert.equal(p.field_map.field_of_study, "Computer Science");
  assert.equal(p.field_map.university, "Example State University");
  assert.equal(p.field_map.graduation_year, "2021");
  assert.equal(p.handler_map.degree, "M.S.");
  assert.equal(p.handler_map.school, "Example State University");
  assert.equal(p.field_map.email, "casey@example.test", "nothing else in the payload is touched");

  const inputs = userEligibilityInputs(db, 1);
  assert.deepEqual(inputs.degrees, ["M.S."], "ONE degree — the derived one; the old block's PhD is not read");
  assert.equal(eligibilityOf({ degree: "phd" }, {}, inputs.degrees).status, "ineligible");
  assert.equal(eligibilityOf({ degree: "masters" }, {}, inputs.degrees).status, "eligible");

  // The packet's Education entries are the section's, every one of them (the Workday "Add Another" list).
  assert.deepEqual(educationEntries(db, 1).map(x => [x.school, x.degree, x.to?.year]),
    [["Lakeside Community College", "Associate of Science", 2016], ["Example State University", "M.S.", 2021], ["Example State University", "Bachelor of Science", 2019]]);

  // The profile read carries the derived value for the page.
  assert.equal(readProfile(db, 1).education.degree, "M.S.");

  // An empty section and no override → blanks, never the old block.
  saveSection(db, 1, "education", { items: [] });
  const blank = withApplicationDefaults(db, 1, basePayload());
  assert.equal(blank.field_map.highest_degree, "");
  assert.equal(blank.handler_map.school, "");
  assert.deepEqual(userEligibilityInputs(db, 1).degrees, []);
});

test("D112 · d112dOverrideWins — the per-profile Change override wins, field by field; clearing it restores the section", async () => {
  const db = freshDb();
  saveSection(db, 1, "education", { items: [
    { school: "Example State University", degree: "Bachelor of Science", field: "Computer Science", start: "2016-09", end: "2020-05" },
  ] });
  setEducationOverride(db, 1, { degree: "Master of Science", year: "2027" });
  const e = educationOf(db, 1);
  assert.equal(e.source, "override");
  assert.deepEqual([e.degree, e.field, e.school, e.year], ["Master of Science", "Computer Science", "Example State University", "2027"],
    "the override's fields win; the ones it leaves empty follow the section");
  const p = withApplicationDefaults(db, 1, basePayload());
  assert.equal(p.field_map.highest_degree, "Master of Science");
  assert.equal(p.field_map.graduation_year, "2027");
  assert.equal(p.field_map.university, "Example State University");
  assert.deepEqual(userEligibilityInputs(db, 1).degrees, ["Master of Science"], "eligibility reads the override too");
  assert.throws(() => setEducationOverride(db, 1, { year: "twenty" }), /YYYY/);

  // Through the route: Change, then "Use the section" (an empty override) clears it.
  const app = express();
  app.use(express.json());
  const requireAuth = (req, _r, n) => { req.user = { id: 1 }; n(); };
  profileSectionRoutes(app, db, requireAuth, { resolveLogo: async () => null });
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api/profile/education-override`;
  try {
    const put = (body) => fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    let r = await put({ degree: "PhD", field: "", school: "" });
    assert.equal(r.status, 200);
    let out = await r.json();
    assert.equal(out.education.degree, "PhD");
    assert.equal(out.education.source, "override");
    r = await put({});
    out = await r.json();
    assert.equal(out.education.source, "section");
    assert.equal(out.education.degree, "Bachelor of Science");
    assert.equal(db.prepare("SELECT education_override FROM user_profile WHERE user_id=1").pluck().get(), null);
    assert.equal((await put({ year: "20x7" })).status, 400);
  } finally { server.close(); }
});

test("D112 · d112dMigrationNoDuplicate — 179 moves the old block into the section; an entry that already matches is not listed twice", () => {
  // (a) the same school is already in the section: no second entry, its empty degree is filled from the block.
  const a = freshDb({ upTo179: false });
  a.prepare("UPDATE user_profile SET highest_degree = 'Master''s', field_of_study = 'Computer Science', university = 'Example State University', graduation_year = 2021 WHERE user_id = 1").run();
  a.prepare("INSERT INTO profile_education (user_id, school, degree, field, end_ym, position, source) VALUES (1, '  example state university ', NULL, 'Computer Science', '2021-05', 0, 'resume')").run();
  run179(a);
  const rowsA = a.prepare("SELECT school, degree, field, end_ym FROM profile_education WHERE user_id = 1").all();
  assert.equal(rowsA.length, 1, "no duplicate entry");
  assert.equal(rowsA[0].degree, "Master's", "the matching entry's empty degree is filled from the old block");
  assert.equal(rowsA[0].end_ym, "2021-05", "what the entry already said is kept");
  assert.equal(a.prepare("SELECT education_override FROM user_profile WHERE user_id=1").pluck().get(), null);

  // (b) a different school: the block becomes an entry beside the existing one.
  const b = freshDb({ upTo179: false });
  b.prepare("UPDATE user_profile SET highest_degree = 'Bachelor''s', field_of_study = 'Physics', university = 'Hillcrest College', graduation_year = 2018 WHERE user_id = 1").run();
  b.prepare("INSERT INTO profile_education (user_id, school, degree, end_ym, position, source) VALUES (1, 'Example State University', 'M.S.', '2021-05', 0, 'resume')").run();
  run179(b);
  const rowsB = b.prepare("SELECT school, degree, field, end_ym, position, source FROM profile_education WHERE user_id = 1 ORDER BY position").all();
  assert.deepEqual(rowsB.map(r => [r.school, r.degree, r.field, r.end_ym, r.position]),
    [["Example State University", "M.S.", null, "2021-05", 0], ["Hillcrest College", "Bachelor's", "Physics", "2018-01", 1]]);
  assert.equal(educationOf(b, 1).degree, "M.S.", "the highest still wins after the move");

  // (c) a degree with no school cannot be an entry → kept as the override, so the forms still have it.
  const c = freshDb({ upTo179: false });
  c.prepare("UPDATE user_profile SET highest_degree = 'Bachelor''s', field_of_study = 'History', graduation_year = 2015 WHERE user_id = 1").run();
  run179(c);
  assert.equal(c.prepare("SELECT COUNT(*) FROM profile_education WHERE user_id=1").pluck().get(), 0);
  const ec = educationOf(c, 1);
  assert.deepEqual([ec.degree, ec.field, ec.year, ec.source], ["Bachelor's", "History", "2015", "override"]);

  // (d) a graduation still to come: the entry has no end date (D101 refuses a future one), the year is the override.
  const d = freshDb({ upTo179: false });
  const future = new Date().getUTCFullYear() + 1;
  d.prepare("UPDATE user_profile SET highest_degree = 'Master''s', university = 'Example State University', graduation_year = ? WHERE user_id = 1").run(future);
  run179(d);
  assert.equal(d.prepare("SELECT end_ym FROM profile_education WHERE user_id=1").pluck().get(), null);
  assert.equal(educationOf(d, 1).year, String(future));

  // (e) running it on an empty block changes nothing.
  const e = freshDb({ upTo179: false });
  run179(e);
  assert.equal(e.prepare("SELECT COUNT(*) FROM profile_education").pluck().get(), 0);
  assert.equal(e.prepare("SELECT education_override FROM user_profile WHERE user_id=1").pluck().get(), null);
});

test("D112 · d112dOldBlockGone — Profile has no old Education block; the section shows the derived degree with Change", () => {
  const panel = fs.readFileSync("client/src/panels/ProfilePanel.jsx", "utf8");
  for (const gone of [/set\("highest_degree"/, /set\("field_of_study"/, /set\("university"/, /set\("graduation_year"/,
    /University \/ College/, /PhD\/Doctorate/, /<PSec title="Education"/]) {
    assert.doesNotMatch(panel, gone, `the old block is gone: ${gone}`);
  }
  assert.doesNotMatch(panel.slice(at(panel, "const BLANK = {"), at(panel, "custom_answers:{},")), /highest_degree/,
    "the form no longer carries the block's fields");
  // A33's review no longer proposes education into a form that has none.
  assert.match(panel, /prefillDiff\(prefillFromResumeText\(resumeDraft\), form\)\.filter\(r => !EDUCATION_PREFILL\.has\(r\.field\)\)/);

  const sections = fs.readFileSync("client/src/components/ProfileSections.jsx", "utf8");
  const hd = sections.slice(at(sections, "function HighestDegree("), at(sections, "export default function ProfileSections("));
  assert.match(hd, /api\("\/api\/profile\/education-override", \{ method: "PUT"/);
  assert.match(hd, />Change</);
  assert.match(hd, /Use the section/);
  assert.match(sections.slice(at(sections, '<Box title="Education"')), /^<Box title="Education" theme=\{theme\}>\s*<HighestDegree /);

  // The server no longer reads the old column for eligibility, and the POST keeps an absent column as stored.
  const elig = fs.readFileSync("services/jobEligibility.js", "utf8");
  assert.doesNotMatch(elig, /SELECT highest_degree/);
  const account = fs.readFileSync("routes/account.js", "utf8");
  assert.match(account, /"highest_degree" in f \? \(f\.highest_degree \|\| null\) : \(existing\.highest_degree \?\? null\)/);
});

test("D112 · d112eRefineOnResumeMade — a profile made from a résumé shows 'Refine your job profile' until the wizard saves it", async () => {
  const REGISTRY_RESUME = `Casey Example
casey@example.test | (555) 010-0142
Boston, MA
SUMMARY
Backend engineer building distributed systems and REST APIs.
EXPERIENCE
Northwind — Software Engineer
Mar 2019 – Present | Boston, MA
- Designed microservices on cloud infrastructure with Python and Go
- Built CI/CD for 40 services
EDUCATION
Example State University — BS Computer Science
2015 – 2019
SKILLS
Python, Go, Java, Docker
`;
  const db = freshDb();
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  app.use("/api/domain-profiles", createDomainProfilesRouter(db, null, () => {}, {}));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/domain-profiles`;
  const json = { "content-type": "application/json" };
  try {
    const made = await (await fetch(`${base}/from-resume`, { method: "POST", headers: json,
      body: JSON.stringify({ content: REGISTRY_RESUME, name: "casey.pdf" }) })).json();
    assert.equal(made.profile.needs_refine, true, "made from a résumé → the prompt shows");
    assert.equal(db.prepare("SELECT made_from_resume FROM domain_profiles WHERE id=?").pluck().get(made.profileId), 1);
    let list = await (await fetch(base)).json();
    assert.equal(list.find(p => p.id === made.profileId).needs_refine, true);

    // An ordinary edit (not the refine wizard) does not dismiss it.
    await fetch(`${base}/${made.profileId}`, { method: "PUT", headers: json, body: JSON.stringify({ include_summary: true }) });
    list = await (await fetch(base)).json();
    assert.equal(list.find(p => p.id === made.profileId).needs_refine, true);

    // The wizard's save — everything it was given, plus refined: true — and the prompt is gone.
    const p = list.find(x => x.id === made.profileId);
    const saved = await (await fetch(`${base}/${made.profileId}`, { method: "PUT", headers: json, body: JSON.stringify({
      profile_name: p.profile_name, domain: p.domain, seniority: p.seniority, target_titles: p.target_titles,
      selected_keywords: p.selected_keywords, refined: true }) })).json();
    assert.equal(saved.needs_refine, false);
    list = await (await fetch(base)).json();
    assert.ok(!list.some(x => x.needs_refine), "no profile asks to be refined");
    assert.ok(db.prepare("SELECT refined_at FROM domain_profiles WHERE id=?").pluck().get(made.profileId) > 0);

    // A profile made by the wizard never shows it.
    const byHand = await (await fetch(base, { method: "POST", headers: json, body: JSON.stringify({
      profile_name: "Data", role_family: "data", domain: "data", seniority: "mid", target_titles: ["Data Engineer"] }) })).json();
    assert.equal(byHand.needs_refine, false);
  } finally { server.close(); }

  // The UI: the same wizard, in edit mode, everything filled from the profile, and its save says refined.
  const refine = fs.readFileSync("client/src/components/RefineJobProfile.jsx", "utf8");
  assert.match(refine, /Refine your job profile/);
  assert.match(refine, /list.find(p => p?.needs_refine && p.id === activeId) || list.find(p => p?.needs_refine)/);
  assert.match(refine, /<DomainProfileWizard[\s\S]*mode="edit"[\s\S]*refine[\s\S]*initialProfile=\{profile\}/);
  const wizard = fs.readFileSync("client/src/components/DomainProfileWizard.jsx", "utf8");
  assert.match(wizard, /\.\.\.\(isEditMode && refine \? \{ refined: true \} : \{\}\)/);
  assert.match(wizard, /isEditMode && refine \? "Refine your job profile"/);
  for (const f of ["client/src/panels/JobProfilesPanel.jsx", "client/src/panels/ProfilePanel.jsx"]) {
    assert.match(fs.readFileSync(f, "utf8"), /<RefineJobProfile profiles=\{profiles\}/, `${f} shows the prompt`);
  }
});

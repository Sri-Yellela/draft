// ⭐ D186 (owner 11-09, "one résumé sets up everything") · the spec's named tests, on the real router and services, with
// SAMPLES.md's three résumés (D184's test set G–I — fictional people) and one trial sample (A–F) for D186-6.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createDomainProfilesRouter } from "../routes/domainProfiles.js";
import { samples } from "../services/sampleResumes.js";
import { fourThings, setFourThing, resumeFilledFields, profileNameFromPlacement } from "../services/resumeSetup.js";
import { keywordTerms, rankTerms, setTermRemoved } from "../services/keywordTerms.js";
import { buildJobFilters, DERIVED_RANK_ORDER } from "../services/jobs/jobQuery.js";
import { deriveProfileFilters } from "../services/jobs/profileFilterBridge.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const S = (k) => JSON.parse(fs.readFileSync(`content/trial/sample-${k}.json`, "utf8"));
const MAYA = S("g"), DANIEL = S("h");

function world({ test = false } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, test_account) VALUES (1, 'tester', 'x', ?)").run(test ? 1 : 0);
  db.prepare("INSERT INTO user_profile (user_id) VALUES (1)").run();
  const app = express(); app.use(express.json({ limit: "2mb" }));
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  app.use("/api/domain-profiles", createDomainProfilesRouter(db, null, () => {}, {}));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/domain-profiles`;
  const call = async (m, p, body) => { const r = await fetch(base + p, { method: m, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
  return { db, call, stop: () => server.close() };
}
const profileRow = (db) => db.prepare("SELECT * FROM user_profile WHERE user_id = 1").get();

test("d186FirstResumeCreatesActiveProfile: the first résumé makes the job profile — active, named from its placement, titles + the subcategory's aliases", async () => {
  const w = world();
  try {
    const r = await w.call("POST", "/from-resume", { content: MAYA.resumeText, name: "maya.txt" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const p = w.db.prepare("SELECT * FROM domain_profiles WHERE user_id = 1").all();
    assert.equal(p.length, 1); assert.equal(p[0].is_active, 1);
    assert.equal(p[0].profile_name, "Frontend software engineering · mid");
    const titles = JSON.parse(p[0].target_titles).map(t => t.toLowerCase());
    assert.ok(titles.some(t => /frontend engineer/.test(t)), `the subcategory's aliases join the titles: ${titles}`);
    assert.equal(profileNameFromPlacement({ categoryName: "Business and finance", subName: "FP&A and corporate finance", level: "senior" }), "FP&A and corporate finance · senior");
  } finally { w.stop(); }
});

test("d186ResumeFillsContactAndExtras + d186VisaNeverInferred + d186SalaryNeverAutoFilled", async () => {
  const w = world();
  try {
    await w.call("POST", "/from-resume", { content: MAYA.resumeText, name: "maya.txt" });
    const up = profileRow(w.db);
    assert.equal(up.full_name, "Maya Chen"); assert.equal(up.email, "maya.chen@example.com");
    assert.match(up.linkedin_url, /maya-chen-sample/); assert.match(up.github_url, /maya-chen-sample/);
    assert.deepEqual([up.city, up.state, up.country], ["Boston", "MA", "United States"]);
    assert.ok(up.current_job_title && up.current_company, `current role: ${up.current_job_title} at ${up.current_company}`);
    assert.ok(Number(up.years_of_experience) > 0);
    const filled = resumeFilledFields(w.db, 1);
    for (const f of ["full_name", "email", "phone", "city", "current_job_title", "current_company", "years_of_experience"]) assert.ok(filled.includes(f), `${f} marked from your résumé`);
    for (const f of ["visa_type", "work_auth", "desired_salary", "available_start_date"]) assert.equal(up[f] ?? null, null, `${f} is never inferred`);
    assert.equal(up.willing_to_relocate ?? 0, 0);
  } finally { w.stop(); }
});

test("d186TypedValueNeverOverwritten: a value the person typed survives the first résumé and a replace", async () => {
  const w = world();
  try {
    w.db.prepare("UPDATE user_profile SET email = 'mine@example.invalid', current_company = 'My Own Co' WHERE user_id = 1").run();
    await w.call("POST", "/from-resume", { content: MAYA.resumeText, name: "maya.txt" });
    const id = w.db.prepare("SELECT id FROM domain_profiles WHERE user_id = 1").pluck().get();
    await w.call("POST", `/${id}/base-resume`, { content: DANIEL.resumeText, name: "daniel.txt" });
    const up = profileRow(w.db);
    assert.equal(up.email, "mine@example.invalid"); assert.equal(up.current_company, "My Own Co");
    assert.ok(!resumeFilledFields(w.db, 1).includes("email"));
  } finally { w.stop(); }
});

test("d186FourThingsSkippable: only the four are asked, each answerable or skippable; the card closes when none is left", () => {
  const w = world();
  try {
    // ⭐ A182 (owner 11-11): the two eligibility answers are asked here too, once, as choices.
    assert.deepEqual(fourThings(w.db, 1).items.map(i => i.key), ["work_auth", "sponsorship_need", "visa_type", "desired_salary", "available_start_date", "willing_to_relocate"]);
    setFourThing(w.db, 1, { key: "visa_type", skip: true });
    setFourThing(w.db, 1, { key: "desired_salary", value: "150000" });
    setFourThing(w.db, 1, { key: "available_start_date", skip: true });
    assert.equal(fourThings(w.db, 1).open, true);
    setFourThing(w.db, 1, { key: "willing_to_relocate", value: "yes" });
    assert.equal(fourThings(w.db, 1).open, true, "the eligibility pair is still unanswered");
    assert.throws(() => setFourThing(w.db, 1, { key: "sponsorship_need", value: "maybe" }), /Pick one of the choices/);
    setFourThing(w.db, 1, { key: "work_auth", value: "Authorized to work in the United States" });
    setFourThing(w.db, 1, { key: "sponsorship_need", value: "future" });
    assert.equal(profileRow(w.db).sponsorship_need, "future");
    const f = fourThings(w.db, 1);
    assert.equal(f.open, false); assert.equal(String(profileRow(w.db).desired_salary), "150000"); assert.equal(profileRow(w.db).visa_type, null, "skipped stays unset");
    assert.throws(() => setFourThing(w.db, 1, { key: "email", value: "x" }), /Not one of the four/);
  } finally { w.stop(); }
});

test("d186SecondFamilyOffersNewProfile: another family's résumé is previewed as such and can become its own active job profile", async () => {
  const w = world();
  try {
    await w.call("POST", "/from-resume", { content: MAYA.resumeText, name: "maya.txt" });
    const same = await w.call("POST", "/resume-preview", { content: MAYA.resumeText });
    assert.equal(same.body.sameFamily, true);
    const other = await w.call("POST", "/resume-preview", { content: DANIEL.resumeText });
    assert.equal(other.body.sameFamily, false); assert.equal(other.body.categoryName, DANIEL.expected.category);
    assert.equal((await w.call("POST", "/from-resume", { content: DANIEL.resumeText, name: "daniel.txt" })).status, 409, "a plain second upload is still refused");
    const made = await w.call("POST", "/from-resume", { content: DANIEL.resumeText, name: "daniel.txt", asNew: true });
    assert.equal(made.status, 200);
    const rows = w.db.prepare("SELECT profile_name, is_active FROM domain_profiles WHERE user_id = 1 ORDER BY id").all();
    assert.equal(rows.length, 2); assert.deepEqual(rows.map(r => r.is_active), [0, 1]);
    assert.match(rows[1].profile_name, /project and program management|Construction/i);
  } finally { w.stop(); }
});

test("d186JobProfilesSectionSameRecords: no dead-end 'None selected'; the section reads the same records the pipeline writes", () => {
  const pp = read("client/src/panels/ProfilePanel.jsx");
  assert.doesNotMatch(pp, /"None selected"/);
  assert.match(pp, /data-active-job-profile=\{activeProfile \? activeProfile\.id : "none"\}/);
  assert.match(pp, /data-switch-job-profile=""/); assert.match(pp, /data-manage-job-profiles=""/);
  const yp = read("client/src/pages/profile/YourProfile.jsx");
  assert.match(yp, /if \(!page\?\.activeProfileId\) \{\n        \/\/ ⭐ D186-3: the first résumé creates the job profile/);
  assert.match(yp, /api\("\/api\/domain-profiles\/from-resume", \{ method: "POST", body: JSON\.stringify\(\{ content: choice\.text, name: choice\.name, asNew: true \}\) \}\)/);
});

function seedSemantic(db) {
  db.prepare("INSERT INTO skill_synonyms (term, equivalent, relation, status) VALUES ('react', 'react.js', 'alias', 'confirmed')").run();
  db.prepare("INSERT INTO skill_synonyms (term, equivalent, relation, status) VALUES ('react', 'reactjs', 'alias', 'proposed')").run();
  const node = db.prepare("INSERT INTO atlas_nodes (slug, kind, name, term, status, source) VALUES (?, 'skill', ?, ?, 'published', 'owner')");
  const a = node.run("react", "React", "react").lastInsertRowid, b = node.run("redux", "Redux", "redux").lastInsertRowid, c = node.run("jsx", "JSX", "jsx").lastInsertRowid;
  db.prepare("INSERT INTO atlas_nodes (slug, kind, name, term, status, source) VALUES ('hidden', 'skill', 'Hidden', 'hidden', 'draft', 'owner')").run();
  db.prepare("INSERT INTO atlas_edges (from_id, to_id, type, source) VALUES (?, ?, 'used_with', 'owner')").run(a, b);
  db.prepare("INSERT INTO atlas_edges (from_id, to_id, type, source) VALUES (?, ?, 'part_of', 'owner')").run(c, a);
}

test("d186KeywordsExpandedWeighted + d186RelatedTermsRankOnlyNeverClaims + d186RemovedTermStaysRemoved", async () => {
  const w = world();
  try {
    seedSemantic(w.db);
    await w.call("POST", "/from-resume", { content: MAYA.resumeText, name: "maya.txt" });
    const id = w.db.prepare("SELECT id FROM domain_profiles WHERE user_id = 1").pluck().get();
    const t = keywordTerms(w.db, id, { useCache: false });
    const by = Object.fromEntries(t.map(x => [x.term.toLowerCase(), x]));
    assert.equal(by.react?.source, "exact"); assert.equal(by.react?.weight, 3);
    assert.equal(by["react.js"]?.source, "alias"); assert.equal(by["react.js"]?.weight, 2); assert.equal(by["react.js"]?.via.toLowerCase(), "react");
    assert.ok(!by.reactjs, "a proposed (unconfirmed) alias is not used");
    assert.equal(by.redux?.source, "related"); assert.equal(by.redux?.weight, 1); assert.equal(by.jsx?.source, "related");
    assert.ok(!by.hidden, "an unpublished node is not used");
    assert.ok(t.findIndex(x => x.source === "related") > t.findIndex(x => x.source === "alias"), "strongest first");
    // rank only: related terms never become the person's skills; the board ranks them in their own, lower tier
    const skills = w.db.prepare("SELECT LOWER(name) FROM profile_skills WHERE user_id = 1").pluck().all();
    assert.ok(!skills.includes("redux") && !skills.includes("jsx"));
    const r = rankTerms(w.db, id);
    const derived = deriveProfileFilters({ id }, { skills: ["React", "TypeScript"] }, { rankTerms: r });
    assert.ok(derived.skills_related.map(s => s.toLowerCase()).includes("redux"));
    assert.ok(derived.skills_include.map(s => s.toLowerCase()).includes("react.js"));
    assert.ok(DERIVED_RANK_ORDER.indexOf("skills_related") === DERIVED_RANK_ORDER.indexOf("skills_include") + 1);
    const asExplicit = buildJobFilters({ skills_related: "redux" }, {});
    assert.ok(!JSON.stringify(asExplicit).includes("redux"), "an explicit skills_related is ignored — it never filters");
    // removed stays removed across a replace
    setTermRemoved(w.db, id, "Redux", true);
    await w.call("POST", `/${id}/base-resume`, { content: MAYA.resumeText.replace("Maya", "Maya ") , name: "maya2.txt" });
    assert.ok(!keywordTerms(w.db, id, { useCache: false }).some(x => x.term.toLowerCase() === "redux"));
    assert.ok(!deriveProfileFilters({ id }, { skills: ["Redux"] }, { rankTerms: { ...rankTerms(w.db, id), removed: ["redux"] } }).skills_include?.map(s => s.toLowerCase()).includes("redux"));
  } finally { w.stop(); }
});

test("d186AlsoFitsSearchedApplyPrimaryOnly: the board and alerts search the primary + its 'also fits'; Apply for me reads neither", () => {
  const both = buildJobFilters({ subcategory: "swe.frontend", also_subcategory: "swe.fullstack" }, {});
  assert.match(JSON.stringify(both), /jtx\.subcategory IN \(\?, \?\)/);
  assert.ok(JSON.stringify(both).includes("swe.fullstack"));
  const one = buildJobFilters({ also_subcategory: "swe.fullstack" }, {});
  assert.ok(!JSON.stringify(one).includes("swe.fullstack"), "never on its own");
  assert.match(read("services/jobs/newMatchAlerts.js"), /WHERE jx\.subcategory IN \(\?, \?\)[\s\S]*alsoOf\(person\) \|\| person\.placement_subcategory/);
  assert.match(read("client/src/panels/JobsPanel.jsx"), /if \(taxRole\.subcategory && taxRole\.also\) p\.set\("also_subcategory", taxRole\.also\);/);
  assert.doesNotMatch(read("routes/apply.js"), /also_subcategory|placement_also/, "Apply for me targets the primary only");
});

test("d186SampleFillsOnlyOnTestAccounts: a trial sample fills the form only on a test account; real accounts keep A140's protection", async () => {
  const trial = Object.values(samples()).find(s => !s.testSet);
  for (const isTest of [false, true]) {
    const w = world({ test: isTest });
    try {
      const r = await w.call("POST", "/from-resume", { content: trial.resumeText, name: "sample.txt" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const up = profileRow(w.db);
      if (isTest) assert.equal(up.full_name, trial.candidate.fullName, "a test account is filled from the sample");
      else assert.equal(up.full_name ?? null, null, "a real account is never filled from a fictional sample");
    } finally { w.stop(); }
  }
  assert.match(read("services/sampleProfileStrip.js"), /SELECT test_account FROM users WHERE id = \?", userId\)\?\.test_account === 1\) continue;/);
});

test("d186-6 the canary: on a TEST account a sample re-upload shows the sample's own details, even over sign-up values; a real account keeps its own", async () => {
  for (const isTest of [true, false]) {
    const w = world({ test: isTest });
    try {
      w.db.prepare("UPDATE user_profile SET full_name = 'Signup Name', email = 'signup@example.invalid' WHERE user_id = 1").run();
      await w.call("POST", "/from-resume", { content: MAYA.resumeText, name: "maya.pdf" });
      const up = profileRow(w.db);
      if (isTest) { assert.equal(up.full_name, "Maya Chen"); assert.equal(up.email, "maya.chen@example.com"); assert.equal(up.current_company, "Toast"); }
      else { assert.equal(up.full_name, "Signup Name"); assert.equal(up.email, "signup@example.invalid"); }
    } finally { w.stop(); }
  }
});

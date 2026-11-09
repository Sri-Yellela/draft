// ⭐ D184 (45p, owner 11-08) — WHAT A RÉSUMÉ CHANGE MUST DO, ON EVERY CHANGE. The B-5 named tests:
//   B-6 one object, reused everywhere · B-7 the sentence inherits the résumé · B-8 the board orders by skills matched,
//   one skill less at a time · S-1 the three samples (content/samples/resumes/SAMPLES.md) are the test set.
import test from "node:test";
import assert from "node:assert/strict";
import { at } from "../test-support/sourceAnchors.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { companyRef, experienceEntities, techRef, resolveCompany } from "../services/entities.js";
import { samples, sampleIdForText, trialSampleIdForText, TEST_SET_IDS } from "../services/sampleResumes.js";
import { placeText } from "../services/placement.js";
import { inferProfileFromResume } from "../services/resumeOnboarding.js";
import { getRegistry } from "../routes/domainProfiles.js";
import { taxonomy } from "../services/jobs/taxonomyClassify.js";
import { prefillFromResumeText } from "../shared/resumePrefill.js";
import { sentenceFromResume } from "../shared/resumeSentence.js";
import { sentenceText } from "../shared/filterSentence.js";
import { buildOrderKeys, orderByClause } from "../services/jobs/jobCursor.js";
import { tierSkills, skillTierKey, resetSkillTiers, resumeTechnologies } from "../services/jobs/skillTiers.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const NOW = Math.floor(Date.now() / 1000);

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  return d;
}
function withToast(d) {
  const id = resolveCompany(d, { company: "Toast", url: "https://careers.toasttab.com/jobs/1" });
  const put = d.prepare(`INSERT INTO company_tech (company_id, tech, grp, postings, first_seen, last_seen, teams_json, computed_at) VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`);
  put.run(id, "React", "frameworks", 40, NOW - 9e6, NOW - 86400, NOW);
  put.run(id, "TypeScript", "languages", 35, NOW - 9e6, NOW - 86400, NOW);
  put.run(id, "Apache Kafka", "data", 12, NOW - 9e6, NOW - 86400, NOW);
  put.run(id, "COBOL", "languages", 1, NOW - 9e6, NOW - 86400, NOW);              // one posting: below the evidence line
  put.run(id, "Perl", "languages", 9, NOW - 400 * 86400, NOW - 400 * 86400, NOW);   // not seen in 180 days: stale
  return id;
}
const MAYA_ROWS = [
  { company: "Toast", title: "Software Engineer II, Frontend", bullets: ["Rebuilt the checkout in React and TypeScript with Next.js."] },
  { company: "HubSpot", title: "Associate Software Engineer", bullets: ["Built React dashboards on GraphQL."] },
];

// ── S-1 ────────────────────────────────────────────────────────────────────────────────────────
test("s1SamplesRegistered: G · H · I are recognised samples (practice form only) that run the full person flow", () => {
  for (const id of TEST_SET_IDS) {
    const s = samples()[id];
    assert.ok(s?.resumeText, `sample ${id} loads`);
    assert.equal(sampleIdForText(s.resumeText), id, "recognised — the canary scheduler accepts it, its sends go to the practice form");
    assert.equal(trialSampleIdForText(s.resumeText), null, "not a TRIAL sample — the profile fills from it (M-7)");
    assert.ok(s.expected?.sentence);
  }
  assert.equal(trialSampleIdForText(samples().A.resumeText), "A", "the trial samples keep A140's rule");
  assert.equal(samples().G.candidate.email, "maya.chen@example.com");
});

test("s1Placements: each sample places as SAMPLES.md says (category › subcategory, level)", () => {
  const tax = taxonomy(), reg = getRegistry();
  for (const id of TEST_SET_IDS) {
    const s = samples()[id];
    const p = placeText(s.resumeText, { titles: inferProfileFromResume(s.resumeText, reg).titles });
    const cat = tax.categories.find(c => c.id === p.category);
    const sub = cat?.subs.find(x => x.id === p.subcategory);
    assert.equal(cat?.name, s.expected.category, `${id} category`);
    assert.equal(sub?.name, s.expected.subcategory, `${id} subcategory`);
    assert.equal(p.level, s.expected.level, `${id} level`);
  }
});

// ── B-6 ────────────────────────────────────────────────────────────────────────────────────────
test("b6ExperienceLinksCompanyObject: an experience row's company is the one company record, with its page", () => {
  const d = db();
  const id = withToast(d);
  const [toast] = experienceEntities(d, MAYA_ROWS);
  assert.equal(toast.companyRef.id, id);
  assert.match(toast.companyRef.href, /^\/app\/companies\/toast/);
  assert.equal(companyRef(d, "  TOAST ").id, id, "the same record by name, however it is written");
});

test("b6CompanyStackFromDbOnly: the stack is the company's evidenced technologies; 'you used' is what the bullets say", () => {
  const d = db();
  withToast(d);
  const [toast] = experienceEntities(d, MAYA_ROWS, { nowSec: NOW });
  assert.deepEqual(toast.companyRef.stack, ["React", "TypeScript", "Apache Kafka"], "≥ 2 postings, seen within 180 days, most evidenced first");
  assert.deepEqual(toast.companyRef.used, ["React", "TypeScript"], "only what the row itself says, and only what the company's stack has");
  const hubspot = resolveCompany(d, { company: "HubSpot" });
  const [, hs] = experienceEntities(d, MAYA_ROWS, { nowSec: NOW });
  assert.equal(hs.companyRef.id, hubspot);
  assert.deepEqual(hs.companyRef.stack, [], "a record with no evidence has no stack — never a guess");
});

test("b6SkillIsTechnologyObject: a skill resolves to the one technology vocabulary; the bold term links to its jobs", () => {
  assert.deepEqual(techRef("k8s"), { name: "Kubernetes", group: "devops" });
  assert.equal(techRef("teamwork"), null);
  const ui = read("client/src/components/ProfileSections.jsx");
  assert.match(ui, /import \{ technologiesIn \} from "..\/..\/..\/shared\/techVocabulary.js"/);
  assert.match(ui, /<BoldTerms text=\{b\} re=\{termRe\} linkTech \/>/);
  assert.match(ui, /requestBoardSearch\(\{ tech: \{ name: tech \} \}\)/, "the board's own technology search (one way in)");
  assert.match(ui, /data-company-link=/);
});

test("b6UnknownEmployerNoGuess: an employer with no record stays unknown — no record made, no stack, the letter logo", () => {
  const d = db();
  const before = d.prepare("SELECT COUNT(*) FROM companies").pluck().get();
  const [row] = experienceEntities(d, [{ company: "Suffolk Construction", title: "Project Manager", bullets: ["Ran RFIs in Procore."] }]);
  assert.equal(row.companyRef, null);
  assert.equal(companyRef(d, "Suffolk Construction"), null);
  assert.equal(d.prepare("SELECT COUNT(*) FROM companies").pluck().get(), before, "a reader never creates a company");
});

test("b6OneResolverEverywhere: the profile reads companies and technologies through services/entities.js", () => {
  const ent = read("services/entities.js");
  assert.match(ent, /export \{ resolveCompany, technologiesIn, nameKey \}/, "postings write and readers read through the same module");
  assert.match(read("routes/profileSections.js"), /experienceEntities\(db, p\.sections\.experience\)/);
  // Nobody else looks companies up by name in the alias table.
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${f.name}`;
      if (f.isDirectory()) walk(rel);
      else if (f.name.endsWith(".js") && /company_aliases[\s\S]{0,200}`?name:/.test(read(rel))) offenders.push(rel);
    }
  };
  walk("services"); walk("routes");
  // companyRecords WRITES the aliases; publicCompany resolves a page SLUG (the board links by it), re-exported here.
  assert.deepEqual(offenders.filter(f => !/services\/(entities|companies\/companyRecords|companies\/publicCompany)\.js$/.test(f)), []);
  assert.match(ent, /export \{ companyIdForSlug \} from "\.\/companies\/publicCompany\.js"/);
});

// ── B-7 ────────────────────────────────────────────────────────────────────────────────────────
test("b7SentenceFromResume: each sample's sentence — its role, its level, all workstyles, in Boston", () => {
  const reg = getRegistry();
  for (const id of TEST_SET_IDS) {
    const s = samples()[id];
    const p = placeText(s.resumeText, { titles: inferProfileFromResume(s.resumeText, reg).titles });
    const pre = prefillFromResumeText(s.resumeText);
    const params = sentenceFromResume({ category: p.category, subcategory: p.subcategory, level: p.level,
      location: { city: pre.city?.value, state: pre.state?.value } });
    assert.equal(params.subcategory, p.subcategory);
    assert.deepEqual(params.experience_levels, [s.expected.level]);
    assert.deepEqual(params.work_models, [], "the profile says nothing → all workstyles");
    assert.deepEqual(params.places, ["metro:boston"]);
    const roleName = taxonomy().categories.flatMap(c => c.subs).find(x => x.id === p.subcategory).name;
    const text = sentenceText({ ...params, role_label: roleName });
    // SAMPLES.md's sentence, in the board's approved words (D37 "career level", A145's role word):
    assert.match(text, new RegExp(`^discovering .*${roleName.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}.* roles at ${s.expected.level} career level and all workstyles in Boston\\.$`), text);
  }
  assert.deepEqual(sentenceFromResume({ category: "software-engineering", subcategory: "swe.general", level: "junior" }).experience_levels, ["entry"]);
  assert.equal(sentenceFromResume({ category: "software-engineering", subcategory: "swe.general" }).subcategory, "", "a general placement narrows to its category");
});

test("b7PersonEditsWinUntilNextResume: the board applies the résumé's sentence once per placement, through the sentence's own setters", () => {
  const jp = read("client/src/panels/JobsPanel.jsx");
  const eff = jp.slice(at(jp, "const key = `draft.placementSeen.${p.id}`"), at(jp, "}, [activeDomainProfile?.id, activeDomainProfile?.placed_at]"));
  assert.ok(eff.length > 0);
  assert.match(eff, /if \(String\(seen\) === String\(p\.placed_at\)\) return;/, "already applied for this placement → the person's own edits stand");
  assert.match(eff, /sentenceFromResume\(/);
  assert.match(eff, /setTaxRole\(\{ category: next\.category, subcategory: next\.subcategory, also \}\)/);   // D186-5 (45s): + also fits
  for (const set of ["setExperienceLevels", "setWorkModels", "setPlaces"]) assert.match(eff, new RegExp(`${set}\\(next\\.`));
  assert.match(read("routes/domainProfiles.js"), /resume_location: cityOf\(r\.id\)/, "each profile carries its résumé's city");
  assert.match(read("services/profileReplace.js"), /the sentence follows the résumé/, "What changed says the sentence moved");
});

// ── B-8 ────────────────────────────────────────────────────────────────────────────────────────
function board() {
  const d = new Database(":memory:");
  d.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, discovered_at INTEGER, scraped_at INTEGER, posted_at INTEGER, ghost_level INTEGER,
            is_active INTEGER DEFAULT 1, experience_level TEXT, company TEXT);
          CREATE TABLE job_tech (job_id TEXT NOT NULL, tech TEXT NOT NULL, PRIMARY KEY (job_id, tech)) WITHOUT ROWID;
          CREATE TABLE job_taxonomy (job_id TEXT PRIMARY KEY, subcategory TEXT);
          CREATE TABLE aor (job_id TEXT PRIMARY KEY, ats_score REAL);`);
  const jobs = [
    ["all3-low", ["React", "TypeScript", "GraphQL"], 30, 1], ["all3-high", ["React", "TypeScript", "GraphQL"], 80, 2],
    ["two", ["React", "TypeScript"], 95, 3], ["one-new", ["React"], 90, 9], ["one-old", ["React"], 90, 1], ["none", [], 99, 9],
  ];
  for (const [id, tech, score, at] of jobs) {
    d.prepare("INSERT INTO scraped_jobs (job_id, discovered_at, scraped_at, experience_level) VALUES (?, ?, ?, 'mid')").run(id, at, at);
    d.prepare("INSERT INTO aor (job_id, ats_score) VALUES (?, ?)").run(id, score);
    d.prepare("INSERT INTO job_taxonomy (job_id, subcategory) VALUES (?, 'swe.frontend')").run(id);
    for (const t of tech) d.prepare("INSERT INTO job_tech VALUES (?, ?)").run(id, t);
  }
  return d;
}

test("b8TiersBySkillsMatched: all N skills first, then N−1 …; inside a tier ATS match, then recency", () => {
  const d = board();
  const keys = buildOrderKeys(undefined, [], { fit: true, skillTier: skillTierKey(["React", "TypeScript", "GraphQL"]) });
  const o = orderByClause(keys);
  const ids = d.prepare(`SELECT sj.job_id FROM scraped_jobs sj LEFT JOIN aor ON aor.job_id = sj.job_id ORDER BY ${o.sql}`).all(...o.params).map(r => r.job_id);
  assert.deepEqual(ids, ["all3-high", "all3-low", "two", "one-new", "one-old", "none"]);
  // Not on an explicit sort, not under a search, not with curation off.
  const tierSql = skillTierKey(["React"]).sql;
  assert.ok(!buildOrderKeys("dateDesc", [], { fit: true, skillTier: skillTierKey(["React"]) }).some(k => k.sql === tierSql));
  assert.ok(!buildOrderKeys(undefined, [], { fit: false, skillTier: skillTierKey(["React"]) }).some(k => k.sql === tierSql));
  assert.ok(!buildOrderKeys(undefined, [], { fit: true, search: { sql: "0", params: [] }, skillTier: skillTierKey(["React"]) }).some(k => k.sql === tierSql));
  assert.equal(skillTierKey([]), null);
  assert.match(read("server.js"), /skillTier: boardSkillTier/);
});

test("b8RerankedOnReplace: the top skills come from THIS résumé, weighted by the placement's postings, new on every change", async () => {
  resetSkillTiers();
  const d = board();
  const pool = { all: async (sql, params) => d.prepare(sql).all(...params) };
  const profile = { id: 1, placement_subcategory: "swe.frontend", placement_level: "mid", placed_at: 100 };
  const maya = "Skills: GraphQL, TypeScript, React. GraphQL GraphQL GraphQL.";
  // GraphQL is named most on the résumé, but React is asked for by most frontend postings → React leads.
  assert.deepEqual(resumeTechnologies(maya)[0], "GraphQL");
  assert.deepEqual(await tierSkills(pool, profile, maya, "t1"), ["React", "TypeScript", "GraphQL"]);
  // A replace: a new résumé (and a new placement) → new skills, not the cached ones.
  const daniel = "Procore, Primavera P6, Excel, Bluebeam Revu";
  const after = await tierSkills(pool, { ...profile, placement_subcategory: "proj.construction", placement_level: "senior", placed_at: 200 }, daniel, "t2");
  assert.ok(!after.includes("React"));
  assert.ok(after.includes("Procore"));
});

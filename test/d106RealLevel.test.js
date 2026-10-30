import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { readLevel, levelDisagreement, applyLine, minYearsAsked } from "../shared/postingLevel.js";
import { readStaleLevels, levelOfRow } from "../services/jobs/levelRead.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { tagStaleJobs } from "../services/jobs/jobTags.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D106 (owner 10-30) · THE REAL LEVEL, AND ONE "SHOULD I APPLY" LINE. Synthetic postings.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SENIORISED = "About you: 3+ years of professional software experience. Experience with system design for distributed " +
  "services. You will mentor junior engineers. A master's degree is preferred.";
const ENTRY = "New grads welcome! 0-1 years of experience. A prior internship is a plus. Learn from senior engineers.";

test("D106 · readLevel — the asks, not the preferences: years, system design, leading others, internship, degree", () => {
  assert.deepEqual(readLevel(SENIORISED), { level: "mid", reasons: ["3+ years", "system design", "leading or mentoring others"], years: 3 });
  assert.deepEqual(readLevel(ENTRY), { level: "entry", reasons: [], years: 0 }, "a preferred internship is not an ask");
  assert.equal(readLevel("You have completed at least one software internship.").level, "early");
  assert.equal(readLevel("A PhD in machine learning is required.").level, "early");
  assert.equal(readLevel("7+ years building backend systems experience.").level, "senior");
  assert.equal(readLevel("Build great products with a friendly team.").level, null, "nothing that says a level");
  assert.equal(minYearsAsked("3-5 years of experience; 7 years of experience preferred"), 3);
});

test("D106 · d106LevelDisagreesShown — 'Titled Junior · asks for 3+ years and system design.'; two steps or it is not news", () => {
  const r = readLevel("3+ years of experience. Strong system design skills required.");
  assert.deepEqual(levelDisagreement("Junior Software Engineer", r),
    { direction: "asks_more", text: "Titled Junior · asks for 3+ years and system design." });
  assert.equal(levelDisagreement("Junior Software Engineer", readLevel("2 years of experience.")), null, "entry vs early: one step");
  assert.equal(levelDisagreement("Software Engineer", r), null, "a title that says no level cannot disagree");
  assert.equal(levelDisagreement("Senior Engineer", readLevel("0-1 years of experience")).text, "Titled Senior · asks for no prior experience.");
  const card = read("client/src/components/JobCard.jsx");
  assert.match(card, /<LevelMark levelRead=\{job\.levelRead\}\/>/);
  assert.match(read("client/src/components/PostingPanel.jsx"), /<PostingLevel levelRead=\{job\.levelRead\} \/>/);
});

function seededDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const job = (id, title, text) => db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active)
    VALUES (?,?,?,?,?,?,?,1)`).run(id, title, "Co", `https://x.test/${id}`, "t", `h${id}`, text);
  job("seniorised", "Junior Software Engineer", SENIORISED);
  job("entry", "Software Engineer, New Grad", ENTRY);
  job("early", "Associate Engineer", "2 years of experience with Python.");
  job("titled", "Junior Data Analyst", "Work with our analytics team on dashboards.");
  job("senior", "Senior Engineer", "7+ years of backend experience.");
  job("plain", "Software Engineer", "Build web apps in TypeScript.");
  return db;
}

test("D106 · readStaleLevels stores the read once; a second pass over an unchanged board touches nothing", () => {
  const db = seededDb();
  assert.equal(readStaleLevels(db).read, 6);
  assert.equal(readStaleLevels(db).read, 0, "idempotent");
  const row = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'seniorised'").get();
  assert.equal(row.level_read, "mid");
  assert.equal(levelOfRow(row).disagreement.direction, "asks_more");
  db.prepare("UPDATE scraped_jobs SET description = ? WHERE job_id = 'plain'").run("Build web apps in TypeScript. 5+ years of experience.");
  assert.equal(readStaleLevels(db).read, 1, "the text changed");
  assert.equal(levelOfRow(db.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'plain'").get()).read, "senior");
});

test("D106 · d106EntryFilter — 'Truly entry level' keeps entry / early asks and entry titles that ask nothing; drops the seniorised", () => {
  const db = seededDb();
  tagStaleJobs(db);
  readStaleLevels(db);
  const f = buildJobFilters({ truly_entry: "1" });
  const ids = db.prepare(`SELECT job_id FROM scraped_jobs sj WHERE 1 = 1 ${f.sql} ORDER BY job_id`).all(...f.params).map(r => r.job_id);
  assert.deepEqual(ids, ["early", "entry", "titled"]);
  assert.equal(buildJobFilters({}).sql.includes("level_read"), false, "off by default");
  const panel = read("client/src/panels/JobsPanel.jsx");
  assert.match(panel, /if \(trulyEntry\)\s+p\.set\("truly_entry", "1"\);/);
  // The callback that builds the querystring must re-create when the toggle changes (it was stale for two filters).
  const from = at(panel, 'p.set("truly_entry", "1");', 0, "JobsPanel buildParams");
  const deps = panel.slice(from, at(panel, "]);", from, "buildParams' dependency list") + 3);
  assert.match(deps, /companySponsors, hideEligibility, trulyEntry,/);
});

test("D106 · d106OneLineSaysSkip — one sentence; it may say skip; a weak or much-reposted posting reads doubtful", () => {
  assert.deepEqual(applyLine({ score: 50, eligibility: { status: "eligible" }, liveness: { kind: "open", reposts: 0, openDays: 3 } }),
    { verdict: "apply", text: "Good match · you're eligible · posted 3 days ago, first time." });
  assert.deepEqual(applyLine({ score: 50, eligibility: { status: "ineligible", reasons: ["U.S. citizens only"] } }),
    { verdict: "skip", text: "Skip: U.S. citizens only." });
  const seniorised = { disagreement: levelDisagreement("Junior Software Engineer", readLevel(SENIORISED)) };
  const l = applyLine({ score: 30, level: seniorised, liveness: { kind: "reposted", reposts: 4, openDays: 10, label: "Reposted 4 times since June" } });
  assert.equal(l.verdict, "doubtful");
  assert.equal(l.text, "Partial match · asks more than its title (3+ years, system design and leading or mentoring others) · reposted 4 times since June.");
  assert.equal(applyLine({}), null, "nothing known, nothing said");
  assert.match(read("client/src/components/JobCard.jsx"), /<ApplyLineNote job=\{job\} score=\{g\?\.atsScore \?\? job\?\.baseAtsScore \?\? null\}\/>/,
    "the line reads the SAME score the card's ATS box shows");
});

test("D106 · d106AtsUnchanged — the level and the line never read or write a stored score", () => {
  for (const f of ["shared/postingLevel.js", "services/jobs/levelRead.js"]) {
    const src = read(f).replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(src, /ats_score|fit_score|scoreJob|computeAts|UPDATE\s+\w+\s+SET\s+[^;]*score/i, f);
  }
});

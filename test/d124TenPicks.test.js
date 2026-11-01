import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { samples, SAMPLE_IDS, RESUME_CHOICES } from "../services/trial.js";
import { samplePicks, offeredSamples, ownPicks, clearPicksCache, PICKS_PER_SAMPLE } from "../services/trialPicks.js";
import { categoryOf } from "../services/jobs/professionalScope.js";

// D124 AMENDED (owner 11-01): each sample shows 10 good picks from its OWN category; a sample is offered only when its
// category has ≥ 10 that day, never padded with another category's jobs. Samples are fictional; postings synthetic.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function board(rows) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at,
    description, board_category, bucket_seniority) VALUES (?, 't', ?, ?, ?, ?, 'greenhouse', 1, unixepoch() - ?, ?, ?, ?)`);
  rows.forEach((r, i) => {
    const id = `${r.cat}-${i}`;
    ins.run(id, `h-${id}`, r.title, `Co${i}`, `https://example.com/${id}`, i, r.description, r.cat, r.level || "mid");
  });
  return db;
}
const MECH = (n) => Array.from({ length: n }, (_, i) => ({ cat: "engineering", title: i % 2 ? "Mechanical Engineer" : "Mechanical Design Engineer",
  description: `Design heat exchangers and enclosures in SolidWorks; run FEA in ANSYS; GD&T, DFMEA, tolerance stack-up. Role ${i}.` }));
const SWE = (n) => Array.from({ length: n }, (_, i) => ({ cat: "computing", title: "Software Engineer",
  description: `Build services in Java, Go and TypeScript; PostgreSQL, Redis, Docker, AWS. Team ${i}.` }));
const FIN = (n) => Array.from({ length: n }, (_, i) => ({ cat: "business", title: "Financial Analyst",
  description: `Forecasting, variance analysis, Excel, Power BI, SQL. Desk ${i}.` }));

test("d124: six samples by category, each fictional, each naming its category and seniority", async () => {
  assert.deepEqual([...SAMPLE_IDS], ["A", "B", "C", "D", "E", "F"]);
  // Owner 11-01 (changed on purpose): "omit own resumes entirely for the tour" — samples only.
  assert.deepEqual([...RESUME_CHOICES], ["A", "B", "C", "D", "E", "F"]);
  const want = { A: "computing", B: "computing", C: "engineering", D: "engineering", E: "business", F: "management" };
  for (const id of SAMPLE_IDS) {
    const s = samples()[id];
    assert.equal(s.category, want[id], id);
    assert.ok(s.seniority && s.targetTitle, id);
    assert.equal(categoryOf({ title: s.targetTitle, roleKey: s.roleFamily }).category, s.category, `${id}'s own title lands in its category`);
    const j = JSON.parse(fs.readFileSync(`content/trial/sample-${id.toLowerCase()}.json`, "utf8"));
    assert.match(j.fictional, /a fictional person/);
    assert.match(j.candidate.email, /@example\.com$/);
    assert.match(j.candidate.phone, /\(555\) 010-/);
  }
});

test("d124TenPicksPerSample: a category with enough postings gives exactly 10, best ATS match first", async () => {
  clearPicksCache();
  const db = board([...MECH(14), ...SWE(3)]);
  const picks = await samplePicks(db, "C");
  assert.equal(picks.length, PICKS_PER_SAMPLE);
  for (let i = 1; i < picks.length; i++) assert.ok(picks[i - 1].score >= picks[i].score, "ordered by score");
});

test("d124NoCrossCategoryPicks: a sample never gets another category's posting, nor a held one, nor one whose title disagrees", async () => {
  clearPicksCache();
  const db = board([...MECH(12), ...SWE(20), { cat: "held", title: "Engineering Technician", description: "SolidWorks, FEA." },
    { cat: "engineering", title: "Registered Nurse", description: "SolidWorks." /* a mis-stored row: the title guard skips it */ }]);
  for (const p of await samplePicks(db, "C")) {
    assert.equal(db.prepare("SELECT board_category FROM scraped_jobs WHERE job_id = ?").pluck().get(p.job_id), "engineering");
    assert.match(p.title, /^Mechanical/);
  }
  for (const p of await samplePicks(db, "A")) assert.equal(p.title, "Software Engineer");
});

test("d124SampleHiddenUnderTen: a sample whose category has fewer than 10 good picks is not offered — and is refused", async () => {
  clearPicksCache();
  const db = board([...MECH(12), ...SWE(12), ...FIN(4)]);
  const offered = Object.fromEntries((await offeredSamples(db)).map(s => [s.id, s.offered]));
  assert.equal(offered.C, true);
  assert.equal(offered.A, true);
  assert.equal(offered.E, false, "4 analyst postings: hidden that day, not padded");
  assert.equal(offered.F, false, "no management postings");
  const routes = read("routes/trial.js");
  assert.match(routes, /\(await offeredSamples\(db\)\)\.some\(x => x\.id === choice && !x\.offered\)/);
  assert.match(routes, /error: "sample_not_offered"/);
  const page = read("client/src/pages/TryPage.jsx");
  assert.match(page, /api\("\/api\/trial\/samples"\)/);
  assert.match(page, /CHOICES\.filter\(c => offered\?\.has\(c\.id\)\)/);
});

test("d124: a level the sample cannot apply for is not a pick (a junior is never dealt a senior or manager posting)", async () => {
  clearPicksCache();
  const rows = [...MECH(12).map(r => ({ ...r, level: "senior" })), ...Array.from({ length: 3 }, (_, i) => ({ cat: "engineering",
    title: "Electrical Engineer", level: "entry", description: `Power electronics, Altium, LTspice. Lab ${i}.` }))];
  const db = board(rows);
  assert.ok((await samplePicks(db, "D")).every(p => p.title === "Electrical Engineer"), "D is junior: no senior mechanical roles");
});

test("d124: 'Use my own résumé' gets picks from the résumé's own category, or says honestly its field is not live", async () => {
  clearPicksCache();
  const db = board([...SWE(12)]);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u', 'x')").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, target_titles, is_active) VALUES (1, 1, 'SWE', 'engineering', 'it_digital', '["Software Engineer"]', 1)`).run();
  db.prepare("INSERT INTO profile_base_resumes (user_id, profile_id, content, name) VALUES (1, 1, ?, 'r.txt')").run(samples().A.resumeText);
  const own = await ownPicks(db, 1);
  assert.equal(own.category, "computing");
  assert.equal(own.picks.length, 10);
  db.prepare(`UPDATE domain_profiles SET target_titles = '["Mechanical Engineer"]' WHERE id = 1`).run();
  clearPicksCache();
  assert.deepEqual([(await ownPicks(db, 1)).reason, (await ownPicks(db, 1)).picks.length], ["field_not_live", 0]);
});

test("d124: an engineering sample is dealt its own discipline and near neighbours only, at a good score", async () => {
  clearPicksCache();
  const elec = Array.from({ length: 12 }, (_, i) => ({ cat: "engineering", title: "Electrical Engineer, Substations",
    description: `Protective relays, SolidWorks, GD&T, DFMEA, tolerance stack-up. Site ${i}.` }));
  const db = board([...elec, ...MECH(4)]);
  const picks = await samplePicks(db, "C");
  assert.ok(picks.every(p => /^Mechanical/.test(p.title)), "the electrical roles are not a mechanical engineer's picks, whatever their overlap");
  assert.equal((await offeredSamples(db)).find(s => s.id === "C").offered, false, "4 mechanical postings: C is hidden");
  assert.match(read("services/trialPicks.js"), /export const GOOD_ATS_SCORE = 30;/);
});

test("d124: the picks never hold the server — scoring is async and yields every few postings (43y fix)", async () => {
  const src = read("services/trialPicks.js");
  assert.match(src, /export async function picksFor/);
  assert.match(src, /if \(\+\+n % YIELD_EVERY === 0\) await breathe\(\);/);
  assert.match(src, /const breathe = \(\) => new Promise\(r => setImmediate\(r\)\);/);
  clearPicksCache();
  const db = board([...SWE(40)]);
  let ticks = 0;
  const t = setInterval(() => ticks++, 1);
  await samplePicks(db, "A");
  clearInterval(t);
  assert.ok(ticks > 0, "the event loop ran while the picks were scored");
});

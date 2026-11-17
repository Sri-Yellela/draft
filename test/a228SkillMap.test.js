// ⭐ A228 (46r, owner 11-16 "Build it") · THE SKILL MAP's server reader (services/atlas/skillMap.js) on a tiny in-memory
// database through the real migrations — a228ApplyThreshold · a228CreditWeights · a228Histogram · a228GreedyRoute ·
// a228LevelsNullBelowFill · a228CacheFollowsVersion · a228NoModelCall · a228RouteSignedIn. Synthetic people, roles,
// companies and postings only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode } from "../services/atlas/atlasStore.js";
import { createAtlasRouter } from "../routes/atlas.js";
import { SKILL_MAP, buildRoleIndex, readRole, greedyRoute, coverageOf, skillMapFor, skillMapIndex, resetSkillMapCache } from "../services/atlas/skillMap.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// Data Engineer: nine judged jobs + one that asks for nothing we read; Backend Engineer: five.
const DE = [
  ["sql", "python"], ["sql", "spark"], ["sql", "python", "spark"], ["spark", "airflow"], ["sql", "airflow"],
  ["python", "kafka"], ["sql"], ["sql", "python", "kafka"], ["airflow"], [],
];
const BE = [["sql", "python"], ["sql", "python"], ["sql", "python"], ["kafka"], ["kafka"]];
const COMPANIES = ["Kestrel Analytics", "Northwind Data", "Bluefin Labs"];

function fixture() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (7, 'rin@example.test', 'x')`).run();
  const id = {};
  for (const [k, name, kind, family] of [["de", "Data Engineer", "role", "data"], ["be", "Backend Engineer", "role", "backend"],
    ["sql", "SQL", "skill", "data"], ["python", "Python", "skill", "backend"], ["spark", "Apache Spark", "tool", "data"],
    ["airflow", "Apache Airflow", "tool", "data"], ["kafka", "Kafka", "tool", "data"]]) {
    id[k] = upsertNode(db, { kind, name, status: "published" }).id;
    db.prepare(`UPDATE atlas_nodes SET family = ? WHERE id = ?`).run(family, id[k]);
  }
  const job = db.prepare(`INSERT INTO scraped_jobs (job_id, title, company, url, search_query, _hash, description, is_active) VALUES (?,?,?,?,?,?,?,1)`);
  const match = db.prepare(`INSERT INTO atlas_posting_match (posting_id, company_key, role_id, level, asked, vocab, matched_at) VALUES (?,?,?,?,?,'v',0)`);
  let n = 0;
  for (const [role, list] of [["de", DE], ["be", BE]]) {
    for (const asks of list) {
      n++;
      const pid = Number(job.run(`j${n}`, role === "de" ? "Data Engineer" : "Backend Engineer", COMPANIES[n % 3], `https://example.test/${n}`, "q", `h${n}`, "synthetic").lastInsertRowid);
      match.run(pid, COMPANIES[n % 3].toLowerCase(), id[role], null, asks.map(a => id[a]).join(","));
    }
  }
  db.prepare(`DELETE FROM atlas_posting_dirty`).run();   // the triggers queued the inserts; the rows above ARE the reading
  db.prepare(`INSERT INTO atlas_live_state (k, v) VALUES ('version', 'v1') ON CONFLICT(k) DO UPDATE SET v = excluded.v`).run();
  // Rin: SQL proven (a check passed), Python and Kafka on the résumé only. Hours: Airflow 2, Spark 10, the rest none.
  for (const [i, s] of ["SQL", "Python", "Kafka"].entries()) db.prepare(`INSERT INTO profile_skills (user_id, name, position) VALUES (7, ?, ?)`).run(s, i);
  db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via) VALUES (7, 'sql', 'SQL', 'checked', 'check')`).run();
  db.prepare(`INSERT INTO atlas_resources (node_id, url, title, hours) VALUES (?, 'https://example.test/af', 'Airflow course', 2), (?, 'https://example.test/sp', 'Spark course', 10)`).run(id.airflow, id.spark);
  db.prepare(`INSERT INTO navigator_routes (user_id, aim_slug, aim_set_by, aim_at) VALUES (7, 'data-engineer', 'user', 0)`).run();
  resetSkillMapCache(db);
  return { db, id };
}

test("a228ApplyThreshold: one definition — a job is one you can apply for at ≥ 60 % of its asks (credit-weighted), exactly 60 % included", () => {
  assert.equal(SKILL_MAP.APPLY_SHARE, 0.6);
  const { roles } = buildRoleIndex([
    { roleId: 1, asked: [1, 2, 3, 4, 5], company: "A" },   // 1 + 1 + 1 of 5 = 0.6 → yes
    { roleId: 1, asked: [1, 2, 6, 7, 4], company: "A" },   // 1 + 1 + .5 + .5 of 5 = 0.6 → yes
    { roleId: 1, asked: [1, 6, 7, 4, 5], company: "B" },   // 1 + .5 + .5 of 5 = 0.4 → no
    { roleId: 1, asked: [3, 8, 9, 10, 11], company: "B" }, // 1 of 5 → no
  ]);
  const credit = new Map([[1, 1], [2, 1], [3, 1], [6, 0.5], [7, 0.5]]);
  assert.equal(readRole(roles.get(1), credit).applicable, 2);
  const svc = read("services/atlas/skillMap.js");
  assert.equal((svc.match(/APPLY_SHARE:\s*0\.6/g) || []).length, 1, "the threshold is written once");
  assert.equal((svc.replace(/\/\/[^\n]*/g, "").match(/\b0\.6\b/g) || []).length, 1, "no second 0.6 in the code outside the constant");
});

test("a228CreditWeights: proven 1 · on the résumé 1 (owner 11-17, \"counts in full\") · not yet 0; the 'last used before 2024' rule is dropped (no dates)", () => {
  assert.deepEqual({ ...SKILL_MAP.CREDIT }, { proven: 1, claimed: 1, missing: 0 });
  const { roles } = buildRoleIndex([{ roleId: 1, asked: [1, 2], company: "A" }, { roleId: 1, asked: [2, 3], company: "A" }]);
  assert.equal(coverageOf(roles.get(1), new Map([[1, 1], [2, 1]])), (1 + 1 * 2) / 4, "Σ asks × credit / Σ asks");
  assert.match(read("services/atlas/skillMap.js"), /"last used before 2024 = 0\.25" rule is DROPPED/);
  const { db } = fixture();
  const r = skillMapFor(db, 7);
  assert.equal(r.role.name, "Data Engineer", "the aim is the default role");
  assert.deepEqual(r.skills, { proven: 1, claimed: 2 });
  const state = Object.fromEntries(r.asks.map(a => [a.name, a.state]));
  assert.deepEqual(state, { SQL: "proven", Python: "claimed", Kafka: "claimed", "Apache Spark": "missing", "Apache Airflow": "missing" });
  assert.equal(r.applicable, 5, "a résumé skill counts in full: 3 at half credit before owner 11-17");
  assert.deepEqual([r.role.open, r.role.judged], [10, 9], "a job that asks for nothing read is open, not judged");
});

test("a228Histogram: ten bins by how much of each job you have; the bins add up to the judged jobs", () => {
  const { db } = fixture();
  const r = skillMapFor(db, 7);
  assert.equal(r.histogram.length, 10);
  assert.deepEqual(r.histogram.map(b => b.jobs), [2, 0, 0, 0, 0, 2, 1, 0, 0, 4]);
  assert.equal(r.histogram.reduce((a, b) => a + b.jobs, 0), r.role.judged);
  assert.equal(r.histogram.filter(b => b.from >= SKILL_MAP.APPLY_SHARE - 1e-9).reduce((a, b) => a + b.jobs, 0), r.applicable, "the bins right of 60 % are the applicable jobs");
});

test("a228GreedyRoute: each step the not-yet-proven skill with the most jobs gained per hour; only skills you lack (owner 11-17: a résumé skill counts in full)", () => {
  const { db } = fixture();
  const r = skillMapFor(db, 7);
  assert.deepEqual(r.route.steps.map(s => [s.name, s.kind, s.gain, s.total, s.hours, s.estimated]), [
    ["Apache Airflow", "learn", 2, 7, 2, false],     // +2 for 2 h beats Spark's +2 for 10 h
    ["Apache Spark", "learn", 2, 9, 10, false],
  ]);   // owner 11-17: a skill on the résumé counts in full, so Python (claimed) is never a step — only skills you lack are
  assert.ok(r.route.steps.every(s => s.companies.length >= 1 && s.companies.length <= SKILL_MAP.STEP_COMPANIES && s.companies[0].name), "each step names the companies it opens");
  assert.ok(r.route.steps.length <= SKILL_MAP.ROUTE_STEPS);
  // pure: the route never re-adds a proven skill, and stops when nothing adds a job
  const { roles } = buildRoleIndex([{ roleId: 1, asked: [1], company: "A" }]);
  assert.deepEqual(greedyRoute(roles.get(1), new Map([[1, 1]]), () => ({ hours: 1, estimated: false })), []);
  // the moves: the aim, the current role (Backend Engineer from the profile's title) — each with its coverage and hours
  db.prepare(`INSERT INTO user_profile (user_id, current_job_title) VALUES (7, 'Backend Engineer')`).run();
  const m = skillMapFor(db, 7);
  const be = m.move.find(x => x.name === "Backend Engineer");
  assert.ok(be && be.isCurrent && m.move.find(x => x.name === "Data Engineer").isAim);
  assert.equal(be.applicable, 5, "a résumé skill counts in full");
  assert.equal(be.hoursTo30, 0, "already past 30 % applicable");
  assert.deepEqual(be.carries.map(c => c.name).sort(), ["Kafka", "Python", "SQL"]);
});

test("a228LevelsNullBelowFill: the by-level split only when ≥ 20 % of the role's jobs carry a level read", () => {
  const { db } = fixture();
  assert.equal(skillMapFor(db, 7).levels, null, "no level read on any job (as in both local fixtures)");
  const de = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = 'data-engineer'`).pluck().get();
  const ids = db.prepare(`SELECT posting_id FROM atlas_posting_match WHERE role_id = ? AND asked != '' ORDER BY posting_id LIMIT 2`).pluck().all(de);
  for (const [i, pid] of ids.entries()) db.prepare(`UPDATE atlas_posting_match SET level = ? WHERE posting_id = ?`).run(i ? "senior" : "mid", pid);
  db.prepare(`DELETE FROM atlas_posting_dirty`).run();
  db.prepare(`UPDATE atlas_live_state SET v = 'v2' WHERE k = 'version'`).run();
  const r = skillMapFor(db, 7);
  assert.deepEqual(r.levels.map(l => [l.level, l.open, l.applicable]), [["mid", 1, 1], ["senior", 1, 0]], "2 of 9 = 22 % — shown");
});

test("a228CacheFollowsVersion: the index is built once per live version; an answer per (user, role, skill states)", () => {
  const { db } = fixture();
  const a = skillMapIndex(db);
  assert.equal(skillMapIndex(db), a, "the same version reuses the index");
  const r1 = skillMapFor(db, 7);
  assert.equal(skillMapFor(db, 7), r1, "the same person, role and states reuse the answer");
  // the person proves Python → a new answer without a new version
  db.prepare(`INSERT INTO skill_proofs (user_id, skill_key, skill, state, via) VALUES (7, 'python', 'Python', 'checked', 'check')`).run();
  const r2 = skillMapFor(db, 7);
  assert.notEqual(r2, r1);
  assert.equal(r2.applicable, r1.applicable, "owner 11-17: proving a skill on the résumé changes how it's drawn, not the count");
  assert.equal(r2.asks.find(a => a.name === "Python").state, "proven");
  // a posting closes: its row goes and the version moves → the index is rebuilt
  const pid = db.prepare(`SELECT posting_id FROM atlas_posting_match ORDER BY posting_id LIMIT 1`).pluck().get();
  db.prepare(`UPDATE scraped_jobs SET is_active = 0 WHERE id = ?`).run(pid);
  // what the live drain does with a posting that fails the board's active rule (atlasLive.js syncNow): its row goes
  db.prepare(`DELETE FROM atlas_posting_match WHERE posting_id = ?`).run(pid);
  db.prepare(`DELETE FROM atlas_posting_dirty`).run();
  assert.equal(skillMapIndex(db), a, "no version change → the old index, even if a row changed under it");
  db.prepare(`UPDATE atlas_live_state SET v = 'v3' WHERE k = 'version'`).run();
  const b = skillMapIndex(db);
  assert.notEqual(b, a);
  assert.equal(skillMapFor(db, 7).role.open, 9, "the closed job is gone");
});

test("a228NoModelCall: the skill map is counted — it imports no model caller and names no model", () => {
  const svc = read("services/atlas/skillMap.js").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(svc, /modelCall|modelGateway|callModel|anthropic|openai|fetch\(/i);
  for (const f of ["client/src/pages/atlas/SkillMap.jsx", "client/src/pages/atlas/skillMapModel.js"]) {
    if (fs.existsSync(f)) assert.doesNotMatch(read(f), /\/api\/assistant|callModel/, f);
  }
});

test("a228RouteSignedIn: GET /api/atlas/skill-map is private and signed in; ?role= picks the role; an unknown role is a 404", async () => {
  const { db } = fixture();
  let user = null;
  const app = express();
  app.use((req, _r, n) => { if (user) req.user = user; n(); });
  app.use("/api/atlas", createAtlasRouter(db));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}/api/atlas/skill-map`;
  try {
    assert.equal((await fetch(base)).status, 401);
    user = { id: 7 };
    const r = await fetch(`${base}?role=backend-engineer`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal((await r.json()).role.name, "Backend Engineer");
    assert.equal((await fetch(`${base}?role=no-such-role`)).status, 404);
  } finally { await new Promise(r => srv.close(r)); }
});

test("a228HeadingGlued (46s, the owner's production account): 'Languages Java' — a résumé heading glued to the first skill — still counts", async () => {
  const { headingStrippedNames } = await import("../services/atlas/atlasStore.js");
  assert.deepEqual(headingStrippedNames("Languages Java"), ["Java"]);
  assert.deepEqual(headingStrippedNames("Data Processing Apache Spark"), ["Processing Apache Spark", "Apache Spark", "Spark"]);
  assert.deepEqual(headingStrippedNames("Vertex AI (familiar)"), [], "never a fragment");
  assert.deepEqual(headingStrippedNames("Distributed Systems Event-driven architecture").includes("architecture"), false, "never a bare common word");
  assert.deepEqual(headingStrippedNames("Python"), []);
  const { db } = fixture();
  const before = skillMapFor(db, 7);
  assert.equal(before.asks.find(a => a.name === "Apache Spark").state, "missing");
  db.prepare(`INSERT INTO profile_skills (user_id, name, position) VALUES (7, 'Data Processing Apache Spark', 9)`).run();
  const after = skillMapFor(db, 7);
  assert.equal(after.asks.find(a => a.name === "Apache Spark").state, "claimed", "the glued name resolves to its skill");
  assert.ok(after.applicable >= before.applicable);
});

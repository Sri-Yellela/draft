// D185-4 (45q, owner 11-09) · the reward loop: a proven skill shows the open jobs it moves the person up a tier on —
// before → after in skills, those lifted INTO the top tier first; only live, non-ghost postings in their placement.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { unlocksFor, activeProfileFor, vocabularyName, UNLOCKS_SHOWN } from "../services/jobs/skillUnlocks.js";
import { resetSkillTiers } from "../services/jobs/skillTiers.js";

const RESUME = "Python Python Python Django Django PostgreSQL PostgreSQL";   // top skills: Python, Django, PostgreSQL
function world() {
  resetSkillTiers();
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (4, 'p', 'h', 1)").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active, placement_subcategory, placement_level, placed_at)
    VALUES (40, 4, 'Backend', 'engineering', 'software', 1, 'swe.backend', 'mid', 1)`).run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, content, updated_at) VALUES (40, 4, ?, 1)").run(RESUME);
  return db;
}
let n = 0;
function job(db, tech, { sub = "swe.backend", ghost = null, active = 1 } = {}) {
  const id = `u${++n}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, ghost_level, discovered_at) VALUES (?, 'q', 'Co', ?, ?, ?, ?, ?)`)
    .run(id, `Role ${id}`, id, active, ghost, n);
  db.prepare("INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES (?, 'swe', ?, 'v1', 1)").run(id, sub);
  for (const t of tech) db.prepare("INSERT INTO job_tech (job_id, tech) VALUES (?, ?)").run(id, t);
  return id;
}
const read = (db) => ({ all: async (sql, p = []) => db.prepare(sql).all(...p) });

test("d185UnlockJobsMoveATier: the skill lifts each posting that asks for it by one; those it lifts into the top tier come first", async () => {
  const db = world();
  const intoTop = job(db, ["Apache Kafka", "Python", "Django"]);          // 2 of 3 → 3 of 4: reaches ⌈¾·4⌉ = 3 → top
  const close = job(db, ["Apache Kafka", "Python"]);                      // 1 → 2 of 4: lifted, not yet top
  const already = job(db, ["Apache Kafka", "Python", "Django", "PostgreSQL"]); // 3 → 4: was already top
  job(db, ["Python", "Django"]);                                   // does not ask for Kafka — not unlocked
  job(db, ["Apache Kafka", "Python", "Django"], { ghost: 2 });            // Likely not hiring
  job(db, ["Apache Kafka", "Python", "Django"], { active: 0 });           // closed
  job(db, ["Apache Kafka", "Python", "Django"], { sub: "swe.frontend" }); // another placement
  const r = await unlocksFor(read(db), activeProfileFor(db, 4), "Apache Kafka");
  assert.equal(r.skill, "Apache Kafka");
  assert.equal(r.total, 3);
  assert.equal(r.intoTop, 1);
  assert.equal(r.jobs[0].job_id, intoTop);
  assert.deepEqual([r.jobs[0].before, r.jobs[0].after, r.jobs[0].of], [2, 3, 4]);
  assert.deepEqual(new Set(r.jobs.map(j => j.job_id)), new Set([intoTop, close, already]));
  assert.ok(r.jobs.every(j => j.after === j.before + 1));
  assert.ok(r.jobs.length <= UNLOCKS_SHOWN);
});

test("d185UnlockJobsMoveATier: nothing to say for a skill outside the vocabulary or a person with no placement", async () => {
  const db = world();
  assert.equal(vocabularyName("Kafka"), "Apache Kafka");
  assert.equal(vocabularyName("Kindness"), null);
  assert.equal((await unlocksFor(read(db), activeProfileFor(db, 4), "Kindness")).reason, "not_a_technology");
  assert.equal((await unlocksFor(read(db), null, "Kafka")).reason, "not_placed");
  const yr = fs.readFileSync(new URL("../client/src/pages/atlas/YourRun.jsx", import.meta.url), "utf8");
  assert.ok(yr.includes("/api/atlas/unlocks?skill="), "Your run asks for the first proven skill's unlocks");
  assert.ok(yr.includes("data-run-unlocks"));
});

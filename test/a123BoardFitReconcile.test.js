// A123 (7) (44s, 11-04) · the board-fit boot reconcile held the event loop ≈ 18 s inside production's warm-up
// (21:24Z deploy): four profiles, all "nothing_to_do", user 3's plan alone 13.9 s — one synchronous read of every
// in-scope active posting with a JS hash of each. Two fixes, both pinned here:
//   · the plan reads keyset pages and yields between them (planSliced) — same counts, same ids, same order;
//   · the boot pass's delay counts from READY (BOOT.run() resolving), not from listen.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { createBoardFitPrecompute, atsJobInputHash } from "../services/jobs/boardFitPrecompute.js";

const USER = 7, PROFILE = 70;
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function boardDb(n) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, 'u7', 'x')").run(USER);
  db.prepare(`INSERT INTO domain_profiles
      (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
       selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`).run(PROFILE, USER);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description)
                          VALUES (?, 'q', 'Synthetic Co', 'Engineer', ?, 1, 1, 1, 'Build services in Go.')`);
  for (let i = 0; i < n; i++) ins.run(`j${String(i).padStart(3, "0")}`, `h${i}`);
  return db;
}
const store = (db) => ({ userId, profileId, jobId, report, basisHash, jobHash }) => db.prepare(`
  INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash)
  VALUES (?, ?, ?, ?, ?, 'v', 1, ?, ?)`).run(userId, profileId, jobId, JSON.stringify(report), report.score, basisHash, jobHash);
const quiet = { log() {}, warn() {}, error() {} };
const make = (db, planPage) => createBoardFitPrecompute({
  db, log: quiet, planPage, store: store(db),
  basisFor: () => ({ runtimeBasis: { resumeText: "r" }, basisHash: "B1" }),
  scoreJob: () => ({ score: 50 }),
});
const profile = (db) => db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(PROFILE);

test("A123 (7) · the paged plan finds the same work as one read — missing, stale basis and a changed posting", async () => {
  const db = boardDb(23);
  await make(db, 1000).runFor({ userId: USER, profile: profile(db) });   // every row scored and fresh
  db.prepare("DELETE FROM ats_only_reports WHERE job_id IN ('j001', 'j010')").run();          // missing
  db.prepare("UPDATE ats_only_reports SET basis_hash = 'OLD' WHERE job_id = 'j005'").run();   // stale basis
  db.prepare("UPDATE scraped_jobs SET title = 'Senior Engineer' WHERE job_id = 'j021'").run(); // posting changed
  const whole = make(db, 1000).plan({ userId: USER, profileId: PROFILE, basisHash: "B1" });
  const paged = await make(db, 4).planSliced({ userId: USER, profileId: PROFILE, basisHash: "B1" });
  assert.deepEqual(paged.jobIds, ["j001", "j005", "j010", "j021"]);
  assert.deepEqual(paged.jobIds, whole.jobIds);
  for (const k of ["active", "missing", "stale", "postingChanged", "fresh"]) assert.equal(paged[k], whole[k], k);
  assert.equal(paged.planPages, 6, "23 rows in pages of 4");
  assert.deepEqual(make(db, 4).plan({ userId: USER, profileId: PROFILE, basisHash: "B1" }).jobIds, whole.jobIds,
    "the synchronous plan pages too, and agrees");
  db.close();
});

test("A123 (7) · the plan hands the event loop back between pages", async () => {
  const db = boardDb(40);
  let turns = 0, stop = false;
  const tick = () => { if (stop) return; turns++; setImmediate(tick); };
  setImmediate(tick);
  const p = await make(db, 5).planSliced({ userId: USER, profileId: PROFILE, basisHash: "B1" });
  stop = true;
  assert.equal(p.planPages, 9, "8 full pages, then the empty read that ends the walk");
  assert.ok(turns >= 7, `other work ran between the pages (${turns} turns)`);
  db.close();
});

test("A123 (7) · a settled board is nothing_to_do, and the result says how the plan was paged", async () => {
  const db = boardDb(9);
  const pc = make(db, 4);
  assert.equal((await pc.runFor({ userId: USER, profile: profile(db) })).status, "scored");
  const r = await pc.runFor({ userId: USER, profile: profile(db) });
  assert.equal(r.status, "nothing_to_do");
  assert.equal(r.todo, 0);
  assert.equal(r.planPages, 3);
  assert.equal(typeof r.longestPlanPageMs, "number");
  assert.equal(db.prepare("SELECT job_hash FROM ats_only_reports WHERE job_id = 'j000'").get().job_hash,
    atsJobInputHash(db.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'j000'").get()));
  db.close();
});

test("A123 (7) · server.js: the boot reconcile is timed from ready (BOOT.run() resolving), not from listen", () => {
  const src = read("server.js");
  const run = at(src, "BOOT.run().then(() => setTimeout(() => {");
  const boot = at(src, 'scheduleBoardFitForAll("boot")');
  assert.ok(run < boot && boot - run < 600, "the boot pass is scheduled inside the ready callback");
  assert.equal(src.split("BOOT.run()").length - 1, 1, "the warm-up is started once");
  assert.match(read("services/jobs/boardFitPrecompute.js"), /const p = await planSliced\(/, "every pass plans in pages");
});

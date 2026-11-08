// D151 Rule 3/4 (11-08) · the board-fit plan runs off the event loop. On the settled 100k fixture with 20 users the
// main-thread profile of the 61 s load window spent 15.2 s in planSliced -> planPageRows: synchronous keyset pages of
// every in-scope posting with a JS hash of each. With `read` (the A126 read pool) the pages are read AND judged in a
// worker thread; the answer must be the plan's own — same counts, same ids, same order — and without `read` nothing
// changes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createReadPool } from "../services/db/readWorker.js";
import { createBoardFitPrecompute } from "../services/jobs/boardFitPrecompute.js";
import { descriptionBasis } from "../services/jobs/descriptionText.js";

const USER = 7, PROFILE = 70;
const quiet = { log() {}, warn() {}, error() {} };
const src = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function boardFile(n) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d151-plan-"));
  const file = path.join(dir, "t.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, 'u7', 'x')").run(USER);
  db.prepare(`INSERT INTO domain_profiles
      (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
       selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`).run(PROFILE, USER);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description, board_category)
                          VALUES (?, 'q', 'Synthetic Co', 'Engineer', ?, 1, 1, ?, 'Build services in Go.', ?)`);
  db.transaction(() => {
    for (let i = 0; i < n; i++) {
      // a mix of categories (the A112 scope), one held row and one retired row the plan must never count
      const cat = i % 7 === 0 ? "data" : i === 3 ? "held" : i % 5 === 0 ? null : "engineering";
      ins.run(`j${String(i).padStart(3, "0")}`, `h${i}`, i === 4 ? 0 : 1, cat);
    }
  })();
  return { dir, file, db };
}
// Replaces like the real store (storeAtsReportForProfile upserts) — a re-score of a stale row is an overwrite.
const store = (db) => ({ userId, profileId, jobId, report, basisHash, jobHash }) => db.prepare(`
  INSERT OR REPLACE INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash)
  VALUES (?, ?, ?, ?, ?, 'v', 1, ?, ?)`).run(userId, profileId, jobId, JSON.stringify(report), report.score, basisHash, jobHash);
const make = (db, extra = {}) => createBoardFitPrecompute({
  db, log: quiet, planPage: 4, store: store(db),
  basisFor: () => ({ runtimeBasis: { resumeText: "r" }, basisHash: "B1" }),
  scoreJob: () => ({ score: 50 }), ...extra,
});
const waitReady = async (pool) => { for (let i = 0; i < 200 && pool.status().ready < 1; i++) await new Promise(r => setTimeout(r, 25)); };
const profile = (db) => db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(PROFILE);
const KEYS = ["active", "missing", "stale", "postingChanged", "fresh", "jobIds", "planPages"];
const pick = (p) => Object.fromEntries(KEYS.map(k => [k, p[k]]));

test("D151 · the plan read in the worker is the main-thread plan — missing, stale basis, changed posting, changed text, force, scope", async () => {
  const { dir, file, db } = boardFile(31);
  const pool = createReadPool({ dbPath: file, fallbackDb: db, size: 1 });
  try {
    await waitReady(pool);
    assert.equal(pool.status().ready, 1, "the worker starts");
    await make(db).runFor({ userId: USER, profile: profile(db) });   // everything in the default scope scored and fresh
    db.prepare("DELETE FROM ats_only_reports WHERE job_id IN ('j001', 'j010')").run();                // missing
    db.prepare("UPDATE ats_only_reports SET basis_hash = 'OLD' WHERE job_id = 'j006'").run();         // stale basis
    db.prepare("UPDATE ats_only_reports SET basis_hash = NULL WHERE job_id = 'j008'").run();          // legacy row
    db.prepare("UPDATE ats_only_reports SET job_hash = NULL WHERE job_id = 'j009'").run();            // no stored hash
    db.prepare("UPDATE scraped_jobs SET title = 'Senior Engineer' WHERE job_id = 'j021'").run();      // posting changed
    // D59: a fresh normalised text is what the scorer reads, so it is what the hash reads — in SQL as in JS
    db.prepare("UPDATE scraped_jobs SET description_text = 'Build services in Go and Rust.', description_basis = ? WHERE job_id = 'j022'")
      .run(descriptionBasis("Build services in Go."));
    // a stale normalised text is ignored by both (the stored description is the input)
    db.prepare("UPDATE scraped_jobs SET description_text = 'other', description_basis = 'not-the-basis' WHERE job_id = 'j023'").run();

    const onLoop = make(db), offLoop = make(db, { read: pool });
    for (const args of [
      { userId: USER, profileId: PROFILE, basisHash: "B1" },
      { userId: USER, profileId: PROFILE, basisHash: "B1", category: "engineering" },
      { userId: USER, profileId: PROFILE, basisHash: "B1", category: "data" },
      { userId: USER, profileId: PROFILE, basisHash: "B1", force: true },
      { userId: USER, profileId: PROFILE, basisHash: "B2" },
      { userId: USER, profileId: 999, basisHash: "B1" },
    ]) {
      const a = await onLoop.planSliced(args);
      const served = pool.status().served;
      const b = await offLoop.planSliced(args);
      assert.deepEqual(pick(b), pick(a), JSON.stringify(args));
      assert.equal(a.offLoop, false);
      assert.equal(b.offLoop, true);
      assert.ok(pool.status().served - served >= b.planPages + 1, "every page and the count answered by the worker");
      assert.deepEqual(pick(b).jobIds, onLoop.plan(args).jobIds, "the synchronous plan agrees");
    }
    const base = await offLoop.planSliced({ userId: USER, profileId: PROFILE, basisHash: "B1" });
    assert.ok(base.jobIds.includes("j021") && base.jobIds.includes("j022") && !base.jobIds.includes("j023"), base.jobIds.join());
    assert.ok(base.postingChanged >= 3, "j009, j021, j022 are posting-side changes");
    assert.equal(pool.status().fallback, 0, "nothing ran on the main connection");

    // a pass through the pool scores what the plan found, and the next pass is nothing_to_do
    assert.equal((await offLoop.runFor({ userId: USER, profile: profile(db) })).status, "scored");
    const again = await offLoop.runFor({ userId: USER, profile: profile(db) });
    assert.equal(again.status, "nothing_to_do");
    assert.equal(again.todo, 0);
  } finally {
    await pool.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("D151 · a pool that cannot answer plans on the main connection — never fails closed", async () => {
  const { dir, file, db } = boardFile(13);
  const off = createReadPool({ dbPath: file, fallbackDb: db, enabled: false });
  try {
    await make(db).runFor({ userId: USER, profile: profile(db) });
    db.prepare("DELETE FROM ats_only_reports WHERE job_id = 'j002'").run();
    db.prepare("UPDATE scraped_jobs SET company = 'Other Co' WHERE job_id = 'j007'").run();
    const a = await make(db).planSliced({ userId: USER, profileId: PROFILE, basisHash: "B1" });
    const b = await make(db, { read: off }).planSliced({ userId: USER, profileId: PROFILE, basisHash: "B1" });
    assert.deepEqual(pick(b), pick(a));
    assert.ok(off.status().fallback > 0, "answered by the main connection (the SQL function is registered there)");
  } finally {
    await off.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("D151 · server.js hands the precompute the read pool", () => {
  const s = src("server.js");
  const at = s.indexOf("_boardFit = createBoardFitPrecompute({");
  assert.ok(at > 0);
  assert.match(s.slice(at, at + 600), /read: readPool/, "the plan's pages go to the read workers");
  assert.ok(s.indexOf("const readPool = createReadPool(") < at, "the pool exists before the precompute is made");
});

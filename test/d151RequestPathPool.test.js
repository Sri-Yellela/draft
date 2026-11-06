// ⛔ D151 (A126's pattern, continued) · THE REMAINING BOARD READS ON THE REQUEST PATH GO THROUGH THE READ-WORKER POOL.
//
// After A126 the board page's list and counts ran in services/db/readWorker.js, but three request paths still did
// whole-board or whole-company work on the one Node thread: /api/best-bets (the cards' company velocity — a walk of every
// job_history row of every company on a cold cache — and the "any board?" COUNT on every page), /api/draft/today (the
// same COUNT on the day's first deal and the background re-deal, the cards' velocity for betFor), and the search
// suggestions' first index build. Each now reads through a `read` (the pool in server.js) and NEVER FAILS CLOSED: a read
// that rejects leaves the old in-thread read to answer, with the same values.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { warmVelocity, bestBetSignalsFor, bestBetsFor } from "../services/bestBets.js";
import { todaysDeck } from "../services/dailyDraft.js";
import { warmSuggestionIndex, suggest, clearSuggestionCache } from "../services/jobs/searchSuggestions.js";
import { companyNameKey } from "../shared/companyIdentity.js";
import { createReadPool } from "../services/db/readWorker.js";
import { ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 10, 5, 12) / 1000);
const VELOCITY_SQL = /FROM job_history WHERE company_key/;

function historyDb(file = ":memory:") {
  const db = new Database(file);
  db.exec(`CREATE TABLE job_history (job_id TEXT PRIMARY KEY, company_key TEXT NOT NULL, title_key TEXT NOT NULL DEFAULT '',
             first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL DEFAULT 0, closed_at INTEGER)`);
  const ins = db.prepare("INSERT INTO job_history (job_id, company_key, first_seen, closed_at) VALUES (?, ?, ?, ?)");
  const acme = companyNameKey("Acme"), globex = companyNameKey("Globex");
  ins.run("a1", acme, NOW - 200 * DAY, NOW - 10 * DAY);   // closed inside 60 days
  ins.run("a2", acme, NOW - 90 * DAY, NOW - 100 * DAY);   // closed before the window
  ins.run("a3", acme, NOW - 30 * DAY, null);
  ins.run("g1", globex, NOW - 5 * DAY, null);
  return db;
}
// Every statement the main connection prepares, so a test can say which reads did NOT happen on it.
function spy(db) {
  const seen = [];
  const real = db.prepare.bind(db);
  db.prepare = (sql) => { seen.push(sql); return real(sql); };
  return seen;
}
const recordingReader = (db, log = []) => ({
  log,
  get: async (sql, params = []) => { log.push(sql); return db.prepare(sql).get(...params); },
  all: async (sql, params = []) => { log.push(sql); return db.prepare(sql).all(...params); },
});
const failingReader = () => ({
  get: async () => { throw new Error("worker gone"); },
  all: async () => { throw new Error("worker gone"); },
});
const velocity = (db, company) =>
  bestBetSignalsFor(db, { userId: 1, job: { job_id: `x-${company}`, description: "", company }, userLevel: null,
                          inputs: { defaults: {}, degrees: [] }, aim: null, warm: new Map(), now: NOW }).velocity;

test("D151 · warmVelocity reads the companies' velocity through `read` in one grouped read — betFor then reads none on the loop", async () => {
  const cold = historyDb(), warm = historyDb();
  const expected = { Acme: velocity(cold, "Acme"), Globex: velocity(cold, "Globex"), Initech: velocity(cold, "Initech") };
  assert.deepEqual(expected.Acme, { watchedDays: 200, closed60: 1 }, "the in-thread read's values (the reference)");
  assert.equal(expected.Initech, null, "a company with no history has no velocity");

  const reader = recordingReader(warm);
  const warmed = await warmVelocity(warm, ["Acme", "Globex", "Initech", "acme", null], { read: reader, now: NOW });
  assert.equal(warmed, 3, "each distinct company once (the name key folds case)");
  assert.equal(reader.log.length, 1, "ONE read for the page's companies");
  assert.match(reader.log[0], VELOCITY_SQL);

  const seen = spy(warm);
  for (const c of ["Acme", "Globex", "Initech"]) assert.deepEqual(velocity(warm, c), expected[c], `${c}: the same values as the in-thread read`);
  assert.equal(seen.filter(s => VELOCITY_SQL.test(s)).length, 0, "betFor read velocity from the warm cache, not job_history on the main connection");

  assert.equal(await warmVelocity(warm, ["Acme"], { read: reader, now: NOW }), 0, "a warm company is not read again");
  assert.equal(reader.log.length, 1);
  cold.close(); warm.close();
});

test("D151 · never fails closed: a read that rejects warms nothing and betFor reads velocity itself, with the same values", async () => {
  const db = historyDb();
  assert.equal(await warmVelocity(db, ["Acme"], { read: failingReader(), now: NOW }), 0);
  const seen = spy(db);
  assert.deepEqual(velocity(db, "Acme"), { watchedDays: 200, closed60: 1 });
  assert.equal(seen.filter(s => VELOCITY_SQL.test(s)).length, 1, "the old in-thread read answered");
  db.close();
});

test("D151 · bestBetsFor warms through the `read` it is handed, and still ranks when that read fails", async () => {
  const STRONG = ATS_BAND_CUTPOINTS.strong + 10;
  const mk = () => {
    const db = new Database(":memory:");
    for (const m of MIGRATIONS) db.exec(m.sql);
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x')").run();
    db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,search_query,_hash,description,scraped_at,discovered_at,updated_at,is_active)
      VALUES ('j1','Backend Engineer','Umbrella','Boston, MA','https://u.test/j1','t','h1','Build services.',?,?,?,1)`).run(NOW - DAY, NOW - DAY, NOW - DAY);
    db.prepare("INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score) VALUES (1, NULL, 'j1', '{}', ?)").run(STRONG);
    return db;
  };
  const fetchBoardPage = async () => ({ ok: true, jobs: [{ id: "j1", company: "Umbrella", title: "Backend Engineer" }], nextCursor: null, total: 1 });

  const db = mk();
  const reader = recordingReader(db);
  const r = await bestBetsFor(db, { userId: 1, fetchBoardPage, read: reader, now: NOW });
  assert.ok(reader.log.some(s => VELOCITY_SQL.test(s)), "the cards' velocity was read through the pool reader");
  assert.equal(r.bets.length, 1);

  const db2 = mk();
  const r2 = await bestBetsFor(db2, { userId: 1, fetchBoardPage, read: failingReader(), now: NOW });
  assert.deepEqual(r2.bets.map(b => b.job.id), r.bets.map(b => b.job.id), "a failed pool read changes nothing the person sees");
  assert.equal(r2.bets[0].bestBet.score, r.bets[0].bestBet.score);
  db.close(); db2.close();
});

test("D151 · todaysDeck runs warmBets before betFor; a warm that throws never breaks the deck", async () => {
  const mk = () => {
    const d = new Database(":memory:");
    d.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
            CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, status TEXT);
            CREATE TABLE user_jobs (user_id INTEGER, job_id TEXT, starred INTEGER DEFAULT 0, disliked INTEGER DEFAULT 0);
            INSERT INTO users (id) VALUES (1);`);
    d.exec(MIGRATIONS.find(m => m.id === "111_daily_drafts").sql);
    return d;
  };
  const STRONG = ATS_BAND_CUTPOINTS.strong + 5;
  const fetchBoardPage = async () => ({ ok: true, jobs: [{ id: "a", title: "A", company: "Acme", matchScore: STRONG },
                                                         { id: "b", title: "B", company: "Globex", matchScore: STRONG }], nextCursor: null });
  const date = new Date().toISOString().slice(0, 10);
  const order = [];
  const d = mk();
  const deck = await todaysDeck(d, { userId: 1, profileId: 1, date, fetchBoardPage,
    warmBets: async (jobs) => { order.push(`warm:${jobs.map(j => j.company).join(",")}`); },
    betFor: (job) => { order.push(`bet:${job.id}`); return { score: 50 }; } });
  // A133: the deal ranks its pool by the blend (warm, then bet per candidate), then the serve reads each card's reading.
  assert.deepEqual(order, ["warm:Acme,Globex", "bet:a", "bet:b", "warm:Acme,Globex", "bet:a", "bet:b"], "the cards' companies are warmed (in the pool) before the synchronous betFor, each time");
  assert.equal(deck.size, 2);

  const d2 = mk();
  const deck2 = await todaysDeck(d2, { userId: 1, profileId: 1, date, fetchBoardPage,
    warmBets: async () => { throw new Error("pool down"); }, betFor: () => ({ score: 50 }) });
  assert.deepEqual(deck2.cards.map(c => c.job.id), ["a", "b"]);
  assert.ok(deck2.cards.every(c => c.bestBet?.score === 50), "betFor still read every card");
  d.close(); d2.close();
});

test("D151 · the search-suggestion index's first build reads through `read`; concurrent first keystrokes share it; a failed read falls back", async () => {
  clearSuggestionCache();
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT, title TEXT, normalized_title TEXT, location TEXT, is_active INTEGER);
           CREATE TABLE job_role_map (job_id TEXT, role_key TEXT);`);
  const j = db.prepare("INSERT INTO scraped_jobs VALUES (?,?,?,?,1)"), m = db.prepare("INSERT INTO job_role_map VALUES (?,?)");
  [["1", "Software Engineer", "Boston, MA"], ["2", "Software Engineer", "Austin, TX"], ["3", "Data Engineer", "Boston, MA"]]
    .forEach(([id, t, l]) => { j.run(id, t, null, l); m.run(id, "engineering"); });

  const reader = recordingReader(db);
  const [a, b] = await Promise.all([warmSuggestionIndex(db, "engineering", { read: reader }),
                                    warmSuggestionIndex(db, "engineering", { read: reader })]);
  assert.equal(reader.log.length, 1, "two first keystrokes, one pooled read");
  assert.equal(a, b);
  const seen = spy(db);
  assert.deepEqual(suggest(db, { roleKey: "engineering", q: "soft" }), ["Software Engineer"]);
  assert.equal(seen.filter(s => /FROM scraped_jobs/.test(s)).length, 0, "suggest filtered the warm index — no read on the main connection");

  clearSuggestionCache();
  assert.equal(await warmSuggestionIndex(db, "engineering", { read: failingReader() }), null, "a failed pooled read builds nothing");
  assert.deepEqual(suggest(db, { roleKey: "engineering", q: "data" }), ["Data Engineer"], "suggest builds it on the main connection, as before");
  assert.equal(seen.filter(s => /FROM scraped_jobs/.test(s)).length, 1);
  clearSuggestionCache();
  db.close();
});

test("D151 · through the real worker pool: velocity is served by a worker, and a disabled pool still answers", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d151-"));
  const file = path.join(dir, "h.db");
  const db = historyDb(file);
  db.pragma("journal_mode = WAL");
  const pool = createReadPool({ dbPath: file, fallbackDb: db, size: 1 });
  try {
    for (let i = 0; i < 200 && pool.status().ready < 1; i++) await new Promise(r => setTimeout(r, 25));
    assert.equal(await warmVelocity(db, ["Acme", "Globex"], { read: pool, now: NOW }), 2);
    assert.ok(pool.status().served >= 1 && pool.status().fallback === 0, "answered by the worker, off the event loop");
    assert.deepEqual(velocity(db, "Acme"), { watchedDays: 200, closed60: 1 });

    const db2 = historyDb();   // a fresh cache key (the cache is per connection)
    const off2 = createReadPool({ dbPath: file, fallbackDb: db2, enabled: false });
    assert.equal(await warmVelocity(db2, ["Acme"], { read: off2, now: NOW }), 1, "DRAFT_READ_WORKERS=off: the main connection answers");
    assert.equal(off2.status().fallback, 1);
    await off2.close(); db2.close();
  } finally { await pool.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("D151 · server.js wires best-bets, the daily deal, the board's existence probe, include_facets and suggestions to the pool", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /bestBetsFor\(db, \{ userId: req\.user\.id, profileId: profile\.id, size, fetchBoardPage, read: readPool \}\)/);
  assert.match(src, /const warmBets = \(jobs\) => warmVelocity\(db, jobs\.map\(j => j\?\.company\), \{ read: readPool \}\)/);
  assert.equal((src.match(/todaysDeck\(db, \{[^}]*betFor, warmBets, resumeText, refresh: (true|false) \}\)/g) || []).length, 2,
    "both the request's read and the background re-deal (A126 (9)) warm through the pool");
  assert.match(src, /const cacheCount = \(await readPool\.get\("SELECT EXISTS\(SELECT 1 FROM scraped_jobs WHERE is_active = 1\) AS n", \[\]\)\)\?\.n \|\| 0;/);
  assert.ok(!/const cacheCount = db\.prepare\(/.test(src), "the board page's main-thread whole-board count is gone");
  assert.match(src, /const facetRows = await readPool\.all\(/);
  assert.match(src, /const skillsRows = await readPool\.all\(/);
  assert.match(src, /await warmSuggestionIndex\(db, roleKey, \{ read: readPool \}\)/);
});

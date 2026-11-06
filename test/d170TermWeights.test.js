// ⭐ D170 (3) · THE ATS TERM WEIGHTS ARE COUNTED OVER THE WHOLE BOARD, OFF THE ONE THREAD — AND OVERDUE WEIGHTS ALERT.
//
// Production 11-06: `ats_term_weights: fresh — 1666 terms … 34.2d old`, and the nightly rebuild REFUSED ("would replace
// 1666 rows with 362") with 82,720 postings cached. The derivation counted document frequencies over `skills_json`
// ALONE — a column only the retired feeds and the offline enrichment imports ever filled — so the corpus shrank as
// those postings aged out, while the scorer reads every posting's description. The weights would have been dropped at
// 45 days and every score served unweighted, and nothing raised it before then ("fresh" at 34 days).
//
// Now: the corpus is every ACTIVE posting plus any posting carrying enrichment skills; a posting's terms are exactly
// what the scorer extracts from it (postingTermKeys); the count runs in a worker thread (computeTermWeightsOffThread)
// with a yielding main-thread fallback; past the 14-day refresh age the status says `overdue` and pipeline health
// raises it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { postingTermKeys } from "../services/localAtsScorer.js";
import {
  computeTermWeights, computeTermWeightsAsync, computeTermWeightsOffThread, corpusTermsOf, atsWeightStatus,
  maybeRecomputeTermWeightsAsync, REFRESH_WEIGHT_AGE_DAYS, MAX_WEIGHT_AGE_DAYS, GLOBAL_FAMILY,
} from "../services/atsTermWeights.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DAY = 86400;
const NOW = 1789000000;
const quiet = { warn() {}, error() {}, log() {} };

function freshDb(file = ":memory:") {
  const db = new Database(file);
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}

const DESCRIPTIONS = [
  "We build data pipelines in Python and SQL on Kubernetes. Experience with AWS and Terraform is a plus.",
  "Backend engineer: Python, PostgreSQL, Docker, Kubernetes; you will own our REST APIs.",
  "Frontend role with React and TypeScript; GraphQL and CSS experience welcome.",
  "Machine learning engineer: PyTorch, Python, SQL, Spark.",
];

/** Active postings with a DESCRIPTION and no skills_json — the board as it is now. */
function seedDescribedBoard(db, n = 120, { active = 1, offset = 0 } = {}) {
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id,title,normalized_title,company,search_query,_hash,is_active,description)
                          VALUES (?,?,?,?,'q',?,?,?)`);
  for (let i = offset; i < offset + n; i++) {
    ins.run(`d${i}`, "Software Engineer", "software engineer", `Co ${i % 7}`, `hd${i}`, active, DESCRIPTIONS[i % DESCRIPTIONS.length]);
  }
}

const rowsOf = (db) => db.prepare("SELECT role_family, term, df, corpus_size, weight FROM ats_term_weights ORDER BY role_family, term").all();

test("d170 (pure): a posting's corpus terms are exactly the scorer's extraction — description AND skills_json", () => {
  const row = { title: "Software Engineer", company: "Acme", description: DESCRIPTIONS[0], skills_json: JSON.stringify(["Rust"]) };
  const keys = corpusTermsOf(row);
  assert.deepEqual([...keys].sort(), [...postingTermKeys({ ...row })].sort());
  for (const t of ["python", "sql", "kubernetes", "rust"]) assert.ok(keys.has(t), `${t} in ${[...keys]}`);
  // description_text (the read of the description held now) wins over the raw description when present
  assert.ok(corpusTermsOf({ title: "x", description: "Java only", description_text: "Go and Python" }).has("python"));
});

test("d170WeightsRebuildFromFullBoard: active postings with descriptions and no skills_json produce weights", () => {
  const db = freshDb();
  seedDescribedBoard(db, 120);
  const r = computeTermWeights(db, { now: NOW });
  assert.equal(r.skipped, undefined, r.reason);
  assert.equal(r.corpusSize, 120, "every active posting contributed terms");
  const global = new Map(rowsOf(db).filter(x => x.role_family === GLOBAL_FAMILY).map(x => [x.term, x]));
  for (const t of ["python", "sql", "kubernetes", "react"]) assert.ok(global.has(t), `${t} weighted`);
  // python is in 3 of 4 descriptions, react in 1 of 4: the rarer term weighs more
  assert.ok(global.get("react").weight > global.get("python").weight);
  // an INACTIVE posting with no enrichment skills is not part of the corpus
  const db2 = freshDb();
  seedDescribedBoard(db2, 120);
  seedDescribedBoard(db2, 50, { active: 0, offset: 1000 });
  assert.equal(computeTermWeights(db2, { now: NOW }).corpusSize, 120);
});

test("d170WeightsRebuildFromFullBoard: the old skills_json corpus is kept — a rebuild never has less evidence than before", () => {
  const db = freshDb();
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id,title,normalized_title,company,search_query,_hash,is_active,skills_json)
                          VALUES (?,?,?,?,'q',?,0,?)`);
  for (let i = 0; i < 80; i++) ins.run(`s${i}`, "Data Engineer", "data engineer", "Acme", `hs${i}`, JSON.stringify(["Python", "Airflow"]));
  seedDescribedBoard(db, 40);
  const r = computeTermWeights(db, { now: NOW });
  assert.equal(r.corpusSize, 120, "80 enriched (inactive) + 40 active");
  assert.ok(rowsOf(db).some(x => x.term === "airflow"), "an enrichment-only term is still weighted");
});

test("d170: the paged rebuild and the worker rebuild write exactly what the one-pass rebuild writes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d170-"));
  try {
    const file = path.join(dir, "w.db");
    const db = freshDb(file);
    db.pragma("journal_mode = WAL");
    seedDescribedBoard(db, 150);
    computeTermWeights(db, { now: NOW });
    const once = rowsOf(db);
    let yields = 0;
    const paged = await computeTermWeightsAsync(db, { now: NOW, pageRows: 7, yieldFn: async () => { yields++; } });
    assert.equal(paged.corpusSize, 150);
    assert.ok(yields >= 20, `it yielded between pages (${yields})`);
    assert.deepEqual(rowsOf(db), once, "paged = one pass");
    const viaWorker = await computeTermWeightsOffThread(db, { dbPath: file, now: NOW, log: quiet });
    assert.equal(viaWorker.counted, "worker", "the real worker thread counted");
    assert.deepEqual(rowsOf(db), once, "worker = one pass");
    // the worker failing never loses the rebuild: the main thread counts in pages instead
    const fallback = await computeTermWeightsOffThread(db, { dbPath: file, now: NOW, log: quiet,
      countOffThread: async () => { throw new Error("no worker"); }, yieldFn: async () => {} });
    assert.equal(fallback.counted, "main-thread pages");
    assert.deepEqual(rowsOf(db), once, "fallback = one pass");
    db.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("d170: the thin-board guard still refuses a rebuild that would shrink the table (now through the async path)", async () => {
  const db = freshDb();
  const ins = db.prepare(`INSERT INTO ats_term_weights (role_family, term, df, corpus_size, weight, computed_at) VALUES (?,?,?,?,?,?)`);
  for (let i = 0; i < 400; i++) ins.run(GLOBAL_FAMILY, `t${i}`, 9, 500, 1.4, NOW - 20 * DAY);
  seedDescribedBoard(db, 60);
  const r = await maybeRecomputeTermWeightsAsync(db, { now: NOW, log: quiet });
  assert.equal(r.ran, false);
  assert.match(r.reason, /^refused: /);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM ats_term_weights").get().c, 400, "the existing table is kept");
});

test("d170StaleWeightsAlertAt14d: past the refresh age the weights are OVERDUE (still used), and pipeline health raises it", () => {
  const db = freshDb();
  const seed = (ageDays) => {
    db.exec("DELETE FROM ats_term_weights");
    db.prepare(`INSERT INTO ats_term_weights (role_family, term, df, corpus_size, weight, computed_at) VALUES (?,?,?,?,?,?)`)
      .run(GLOBAL_FAMILY, "python", 9, 500, 1.4, NOW - ageDays * DAY);
    return atsWeightStatus(db, { now: NOW });
  };
  assert.deepEqual([seed(REFRESH_WEIGHT_AGE_DAYS - 1).overdue, seed(REFRESH_WEIGHT_AGE_DAYS - 1).state], [false, "fresh"]);
  const s34 = seed(34.2);
  assert.deepEqual([s34.overdue, s34.state], [true, "fresh"], "34 days: still used, but overdue");
  assert.equal(seed(MAX_WEIGHT_AGE_DAYS + 1).state, "stale");
  const health = read("routes/adminDb.js");
  assert.match(health, /else if \(w\.overdue\) push\(MAX_WEIGHT_AGE_DAYS - w\.ageDays <= 7 \? "critical" : "warn", "ats_weights", "overdue",/);
  assert.match(health, /if \(w\.state === "absent"\) push\("critical", "ats_weights", "never computed"/);
  const server = read("server.js");
  assert.match(server, /before\.overdue \? ` — ⚠ OVERDUE: /, "the boot line says overdue");
});

test("d170: server.js runs the refresh async, the count off the request thread (worker + DB_PATH)", () => {
  const server = read("server.js");
  assert.match(server, /async function runTermWeightRefresh\(trigger\) \{/);
  assert.match(server, /const r = await maybeRecomputeTermWeightsAsync\(db, \{ onInvalidate: invalidateAtsWeightCache, dbPath: DB_PATH \}\);/);
  assert.doesNotMatch(server, /maybeRecomputeTermWeights\(db/, "no synchronous rebuild left in the server");
  const worker = read("services/atsTermWeightsWorker.js");
  assert.match(worker, /new Database\(workerData\.dbPath, \{ readonly: true, fileMustExist: true \}\)/);
});

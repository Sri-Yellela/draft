// A76 under D17 — the validation corpus is graded OUTSIDE the product: export → grade → import.
// Every guard here is the enrichment manual path's, reused (services/jobs/atsGradeTransfer.js).
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { MIGRATIONS } from "../scripts/migrations.js";
import { computeContentHash } from "../services/jobs/enrichmentSelection.js";
import { openBatch, revertBatch, revertPreview, getBatch } from "../services/jobs/enrichmentBatches.js";
import { buildExport, toJsonl } from "../services/jobs/enrichmentTransfer.js";
import {
  buildGradeExport, toGradeJsonl, planGradeImport, applyGradeImport, stratifiedSample, analyzeGrades, loadGrades,
  validateGrade, boardResolver,
} from "../services/jobs/atsGradeTransfer.js";
import { traceJobLifecycle } from "../services/jobTrace.js";

const NOW = Math.floor(Date.now() / 1000);

// The schema of migration 101 as the enrichment tests write it, then the REAL migration 126 on top —
// so a change to 126 that breaks this shape fails here.
function makeDb(file = ":memory:", opts = {}) {
  const db = new Database(file, opts);
  db.exec(`
    CREATE TABLE IF NOT EXISTS scraped_jobs (
      job_id TEXT PRIMARY KEY, title TEXT, company TEXT, location TEXT, url TEXT, description TEXT,
      source TEXT, summary TEXT, normalized_title TEXT, experience_level TEXT, workplace_type TEXT,
      salary_min_usd INTEGER, salary_max_usd INTEGER, salary_period TEXT, skills_json TEXT,
      is_h1b_sponsor INTEGER, requires_work_auth INTEGER, is_clearance_required INTEGER,
      org_unit_raw TEXT, content_hash TEXT, enriched_at INTEGER, enrichment_batch_id INTEGER,
      is_active INTEGER DEFAULT 1, discovered_at INTEGER, posted_at INTEGER, scraped_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS enrichment_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, provider TEXT, model TEXT,
      started_at INTEGER NOT NULL, finished_at INTEGER,
      rows_attempted INTEGER NOT NULL DEFAULT 0, rows_written INTEGER NOT NULL DEFAULT 0,
      rows_failed INTEGER NOT NULL DEFAULT 0, rows_empty INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      est_cost_usd REAL NOT NULL DEFAULT 0, coverage_json TEXT, reverted_at INTEGER, notes TEXT
    );
    CREATE TABLE IF NOT EXISTS enrichment_batch_rows (
      batch_id INTEGER NOT NULL, job_id TEXT NOT NULL, before_json TEXT NOT NULL,
      filled_json TEXT, written_at INTEGER NOT NULL, PRIMARY KEY (batch_id, job_id)
    );
  `);
  return db;
}
const migrate126 = (db) => db.exec(MIGRATIONS.find(m => m.id === "126_ats_grade_corpus").sql);

function seed(db, n = 4) {
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, title, company, location, description, source, summary,
    experience_level, is_active, scraped_at) VALUES (?, ?, 'Acme', 'Remote, US', ?, 'greenhouse', 'kept summary', 'senior', 1, ?)`);
  for (let i = 1; i <= n; i++) ins.run(`j${i}`, `Engineer ${i}`, `Synthetic posting ${i}. Python, Go, services.`, NOW);
}
function exportFile(db, ids = ["j1", "j2", "j3", "j4"]) {
  const posts = ids.map(id => db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(id));
  return buildGradeExport(posts, { corpus: "a76", profileId: 6, seed: 76 });
}
function graded(file, fits) {
  const rows = file.rows.map(r => ({ ...r, grade: { ...r.grade, fit: fits[r.job_id] ?? null } }));
  return toGradeJsonl({ rows, meta: file.meta });
}
const opts = { corpus: "a76", grader: "owner" };
const count = (db) => db.prepare("SELECT COUNT(*) n FROM ats_corpus_grades").get().n;
const batches = (db) => db.prepare("SELECT COUNT(*) n FROM enrichment_batches").get().n;

function fresh() { const db = makeDb(); migrate126(db); seed(db); return db; }

// ── the migration ─────────────────────────────────────────────────────────────────────────────────
test("migration 126 is byte-identical in both runners, additive, and leaves existing batches 'enrichment'", () => {
  const at = (src, needle, from = 0) => { const i = src.indexOf(needle, from); assert.ok(i >= 0, `anchor missing: ${needle}`); return i; };
  const block = (src) => { const i = at(src, 'id: "126_ats_grade_corpus"'); return src.slice(i, at(src, "\n    },", i)); };
  const a = block(fs.readFileSync("server.js", "utf8")), b = block(fs.readFileSync("scripts/migrations.js", "utf8"));
  assert.equal(a, b, "byte-identical in server.js and scripts/migrations.js");
  assert.doesNotMatch(a, /DROP\s+TABLE|DROP\s+COLUMN|RENAME/i, "additive only");
  assert.doesNotMatch(a, /\bBEGIN\b|\bCOMMIT\b/, "no transaction statements inside a migration");

  const db = makeDb();
  const old = openBatch(db, { source: "cron" });       // a batch from before 126
  migrate126(db);
  assert.equal(db.prepare("SELECT kind FROM enrichment_batches WHERE id = ?").get(old).kind, "enrichment");
  assert.throws(() => db.prepare(`INSERT INTO ats_corpus_grades (corpus, job_id, grader, fit, content_hash, graded_at)
    VALUES ('a76', 'j1', 'owner', 6, 'h', 1)`).run(), /CHECK/, "the table itself refuses a fit outside 1..5");
});

// ── export ────────────────────────────────────────────────────────────────────────────────────────
test("the export is BLIND: no engine score, band, rank or set label — and its order is not the sample's", () => {
  const posts = Array.from({ length: 30 }, (_, i) => ({ job_id: `p${i}`, title: `T${i}`, company: "C", location: "US",
    description: "d".repeat(10), engine: 90 - i, set: i < 5 ? "owner30" : "sample", human_fit: 3, engine_score: 90 - i, band: "strong" }));
  const f = buildGradeExport(posts, { corpus: "a76", profileId: 6, seed: 76 });
  for (const r of f.rows) {
    assert.deepEqual(Object.keys(r).sort(), ["content_hash", "grade", "job_id", "posting"]);
    assert.deepEqual(Object.keys(r.posting).sort(), ["company", "description", "location", "title"]);
    assert.deepEqual(r.grade, { fit: null, note: null });
    assert.equal(r.content_hash, computeContentHash(`T${r.job_id.slice(1)}`, "d".repeat(10)));
  }
  assert.notDeepEqual(f.rows.map(r => r.job_id), posts.map(p => p.job_id), "shuffled — the order would leak the score");
  assert.equal(f.meta.kind, "ats_grade");
  assert.match(f.meta.rubric, /1 \(poor\) to 5 \(excellent\)/);
  assert.doesNotMatch(JSON.stringify(f.rows), /engine|human_fit|owner30|strong/);
});

test("the stratified draw is reproducible from its seed", () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ job_id: `r${i}`, title: "t", description: "d" }));
  const score = (r) => Number(r.job_id.slice(1)) % 97;
  const a = stratifiedSample(rows, score, { n: 50, seed: 76 }), b = stratifiedSample(rows, score, { n: 50, seed: 76 });
  assert.deepEqual(a.map(r => r.job_id), b.map(r => r.job_id));
  assert.equal(a.length, 50);
  assert.notDeepEqual(stratifiedSample(rows, score, { n: 50, seed: 77 }).map(r => r.job_id), a.map(r => r.job_id));
});

// ── import: the round trip ────────────────────────────────────────────────────────────────────────
test("dry run writes nothing; apply writes with provenance; the same file twice changes nothing", () => {
  const db = fresh();
  const text = graded(exportFile(db), { j1: 5, j2: 1, j3: 3 });    // j4 left ungraded
  const plan = planGradeImport(db, text, opts);
  assert.equal(plan.valid, true);
  assert.equal(plan.wouldWrite, 3); assert.equal(plan.ungraded, 1);
  assert.equal(count(db), 0, "the plan never writes");

  const r = applyGradeImport(db, text, opts);
  assert.equal(r.ok, true); assert.equal(r.written, 3);
  const b = db.prepare("SELECT * FROM enrichment_batches WHERE id = ?").get(r.batchId);
  assert.equal(b.kind, "ats_grade"); assert.equal(b.source, "import"); assert.equal(b.provider, "owner");
  assert.equal(b.rows_written, 3); assert.ok(b.finished_at);
  assert.deepEqual(db.prepare("SELECT job_id, fit, grader, batch_id FROM ats_corpus_grades ORDER BY job_id").all(),
    [{ job_id: "j1", fit: 5, grader: "owner", batch_id: r.batchId }, { job_id: "j2", fit: 1, grader: "owner", batch_id: r.batchId },
     { job_id: "j3", fit: 3, grader: "owner", batch_id: r.batchId }]);

  const before = batches(db);
  const again = applyGradeImport(db, text, opts);
  assert.equal(again.ok, true); assert.equal(again.written, 0); assert.equal(again.batchId, null);
  assert.equal(batches(db), before, "idempotent: no second batch");
  assert.equal(again.plan.unchanged, 3);
});

// ── the five guards ───────────────────────────────────────────────────────────────────────────────
test("invalid_value: a fit that is not a whole number 1-5 refuses the WHOLE file", () => {
  for (const bad of ["4", 4.5, 0, 6, true]) {
    const db = fresh();
    const text = graded(exportFile(db), { j1: 5, j2: bad });
    const r = applyGradeImport(db, text, opts);
    assert.equal(r.ok, false, `fit ${JSON.stringify(bad)} must be refused`);
    assert.ok(r.plan.rejected.some(x => x.kind === "invalid_value" && x.jobId === "j2"));
    assert.equal(count(db), 0, "nothing written — not even the valid j1");
    assert.equal(batches(db), 0);
  }
  assert.equal(validateGrade({ fit: 3, verdict: "x" }).ok, false, "an unknown grade key is refused");
});

test("stale: a posting whose text changed since export is refused (and --allow-stale lets it through)", () => {
  const db = fresh();
  const text = graded(exportFile(db), { j1: 4 });
  db.prepare("UPDATE scraped_jobs SET description = 'rewritten by the employer' WHERE job_id = 'j1'").run();
  const r = applyGradeImport(db, text, opts);
  assert.equal(r.ok, false);
  assert.equal(r.plan.rejected[0].kind, "stale");
  assert.equal(count(db), 0);
  assert.equal(applyGradeImport(db, text, { ...opts, allowStale: true }).written, 1);
});

test("unknown id: a job_id the export could not have produced is refused, never inserted", () => {
  const db = fresh();
  const f = exportFile(db);
  f.rows.push({ job_id: "nope", content_hash: "x", posting: {}, grade: { fit: 3, note: null } });
  const r = applyGradeImport(db, graded(f, { j1: 2, nope: 3 }), opts);
  assert.equal(r.ok, false);
  assert.ok(r.plan.rejected.some(x => x.kind === "unknown_job_id" && x.jobId === "nope"));
  assert.equal(count(db), 0);
});

test("wrong file: an enrichment export, or another corpus's file, is refused whole", () => {
  const db = fresh();
  const enrich = toJsonl(buildExport(db, { candidatesOnly: false }));
  assert.equal(planGradeImport(db, enrich, opts).valid, false);
  const other = graded(exportFile(db), { j1: 3 }).replace('"corpus":"a76"', '"corpus":"b12"');
  const p = planGradeImport(db, other, opts);
  assert.equal(p.valid, false);
  assert.ok(p.rejected.some(x => x.kind === "wrong_file"));
});

test("concurrency: a second writer holding the database gets a refusal, and nothing is written", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a76-"));
  const file = path.join(dir, "g.db");
  const db = makeDb(file, { timeout: 0 }); migrate126(db); seed(db);
  const other = new Database(file, { timeout: 0 });
  try {
    other.exec("BEGIN IMMEDIATE");
    const r = applyGradeImport(db, graded(exportFile(db), { j1: 5 }), opts);
    assert.equal(r.ok, false);
    assert.equal(r.kind, "concurrent_import");
    other.exec("ROLLBACK");
    assert.equal(count(db), 0);
    assert.equal(batches(db), 0, "no half-open batch left behind");
  } finally { other.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the refusal reconciles: every row is in exactly one bucket", () => {
  const db = fresh();
  const f = exportFile(db);
  f.rows.push({ job_id: "nope", content_hash: "x", grade: { fit: 3 } });
  f.rows.push({ ...f.rows[0] });                                   // a duplicate
  const p = planGradeImport(db, graded(f, { j1: 5, j2: "x", nope: 2 }) + "{not json\n", opts);
  assert.equal(p.rowsInFile, p.wouldWrite + p.unchanged + p.ungraded + p.rejected.length);
  assert.deepEqual(p.rejected.map(x => x.kind).sort(), ["duplicate", "invalid_value", "parse", "unknown_job_id"]);
  assert.equal(p.valid, false);
});

// ── corrections and revert ───────────────────────────────────────────────────────────────────────
test("a different grade from the same grader is skipped by default; --overwrite replaces it; revert restores it", () => {
  const db = fresh();
  const f = exportFile(db);
  const first = applyGradeImport(db, graded(f, { j1: 2, j2: 4 }), opts);
  const corr = graded(f, { j1: 5 });
  const skip = applyGradeImport(db, corr, opts);
  assert.equal(skip.written, 0); assert.equal(skip.plan.skippedExisting, 1);
  assert.equal(db.prepare("SELECT fit FROM ats_corpus_grades WHERE job_id='j1'").get().fit, 2);

  const ow = applyGradeImport(db, corr, { ...opts, overwrite: true });
  assert.equal(ow.written, 1);
  assert.deepEqual(getBatch(db, ow.batchId).rows[0].corrected, ["fit"]);

  const prev = revertPreview(db, ow.batchId);
  assert.equal(prev.kind, "ats_grade");
  assert.deepEqual(prev.pairs.map(p => [p.jobId, p.now, p.restoresTo]), [["j1", 5, 2]], "before/after pairs");
  assert.equal(db.prepare("SELECT fit FROM ats_corpus_grades WHERE job_id='j1'").get().fit, 5, "the preview writes nothing");
  assert.equal(revertBatch(db, ow.batchId).ok, true);
  assert.equal(db.prepare("SELECT fit FROM ats_corpus_grades WHERE job_id='j1'").get().fit, 2);
  assert.equal(revertBatch(db, ow.batchId).ok, false, "a second revert is refused");

  assert.equal(revertBatch(db, first.batchId).ok, true);
  assert.equal(count(db), 0, "reverting the first import deletes the grades it created");
});

test("⛔ a grade batch's revert never touches scraped_jobs (it would NULL every enrichment column)", () => {
  const db = fresh();
  const r = applyGradeImport(db, graded(exportFile(db), { j1: 3, j2: 4 }), opts);
  const snap = () => db.prepare("SELECT * FROM scraped_jobs ORDER BY job_id").all();
  const before = snap();
  revertBatch(db, r.batchId);
  assert.deepEqual(snap(), before);
  assert.equal(db.prepare("SELECT summary FROM scraped_jobs WHERE job_id='j1'").get().summary, "kept summary");
});

test("the job trace does not report a grade import as enrichment", () => {
  const db = fresh();
  applyGradeImport(db, graded(exportFile(db), { j1: 3 }), opts);
  const t = traceJobLifecycle(db, "j1");
  assert.equal(t.events.filter(e => /Enriched in batch/.test(e.what)).length, 0);
});

// ── analysis ──────────────────────────────────────────────────────────────────────────────────────
test("analysis: a declined engine score is excluded and counted, never ranked as 0; stale grades are set aside", () => {
  const postings = [
    { job_id: "a", set: "owner30", engine: 70, human_fit: 5 }, { job_id: "b", set: "owner30", engine: 20, human_fit: 1 },
    { job_id: "c", set: "sample", engine: 50 }, { job_id: "d", set: "sample", engine: null }, { job_id: "e", set: "sample", engine: 10 },
  ];
  const grades = [["a", 5], ["b", 2], ["c", 4], ["d", 1], ["e", 1]].map(([job_id, fit]) => ({ job_id, fit, grader: "g" }));
  const r = analyzeGrades(postings, grades, { strong: 44, moderate: 26 }).graders.g;
  assert.equal(r.engine_declined, 1);
  assert.equal(r.engine_vs_grader_all.n, 4);
  assert.equal(r.grader_vs_owner_30.n, 2);
  assert.deepEqual(r.fit_distribution, [2, 1, 0, 1, 1]);

  const db = fresh();
  applyGradeImport(db, graded(exportFile(db), { j1: 3, j2: 4 }), opts);
  db.prepare("UPDATE scraped_jobs SET description = 'changed' WHERE job_id = 'j2'").run();
  const { fresh: ok, stale } = loadGrades(db, "a76", boardResolver(db));
  assert.deepEqual([ok.length, stale.length], [1, 1]);
});

// ── D17 ───────────────────────────────────────────────────────────────────────────────────────────
test("⛔ D17: the A76 script and the grade module make no model call", () => {
  for (const f of ["scripts/a76LlmGradedCorpus.mjs", "services/jobs/atsGradeTransfer.js"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(src, /@anthropic-ai\/sdk|callModel|modelCall\.js|openai|groq/i, `${f} must not reach a model`);
  }
  assert.match(fs.readFileSync("scripts/a76LlmGradedCorpus.mjs", "utf8"), /--grade is removed \(D17/);
});

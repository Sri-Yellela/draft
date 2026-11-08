// ⭐ D151 Rule 3 · d151ScoringOffTheLoop — board-fit scoring runs in a worker thread with the SAME scorer (report for
// report), and never fails closed: a disabled, broken or short-answering worker means the batch is scored on the main
// thread exactly as before. Synthetic postings and résumé.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createScorePool } from "../services/jobs/scoreWorker.js";
import { scoreAtsLocally, buildRuntimeAtsBasis } from "../services/localAtsScorer.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const basis = buildRuntimeAtsBasis({ resumeText: "Synthetic Person\nSoftware Engineer\n- Built Python, Go and PostgreSQL services on AWS with Kubernetes.\nSKILLS\nPython, Go, TypeScript, React, Kubernetes, PostgreSQL, AWS" });
const jobs = [
  { job_id: "j1", title: "Backend Engineer", description: "We need Python and PostgreSQL experience. Kubernetes a plus. 3+ years." },
  { job_id: "j2", title: "Frontend Engineer", description: "React and TypeScript, accessibility, testing with Playwright." },
  { job_id: "j3", title: "Data Engineer", description: "Spark, Airflow, Kafka and SQL. Python required." },
];

test("d151ScoringOffTheLoop: the worker's reports equal the main thread's, in order", async () => {
  const pool = createScorePool({ size: 1 });
  try {
    for (let i = 0; i < 50 && !pool.status().ready; i++) await new Promise(r => setTimeout(r, 100));
    assert.equal(pool.status().ready, 1, "the worker started");
    const weights = { __none__: null };
    const out = await pool.score({ items: jobs.map(job => ({ job, wk: "__none__" })), weights, synonyms: null, runtimeBasis: basis });
    assert.equal(out.length, jobs.length);
    const inline = jobs.map(job => scoreAtsLocally({ job, runtimeBasis: basis, termWeights: null, synonyms: null }));
    assert.deepEqual(out.map(o => o.report), JSON.parse(JSON.stringify(inline)), "report for report");
    assert.equal(pool.status().jobs, jobs.length);
  } finally { await pool.close(); }
});

test("d151ScoringOffTheLoop: a disabled pool rejects at once (the caller scores on the main thread)", async () => {
  const pool = createScorePool({ enabled: false });
  await assert.rejects(pool.score({ items: [{ job: jobs[0], wk: "__none__" }], weights: {}, runtimeBasis: basis }), /no score worker ready/);
  await pool.close();
});

test("d151ScoringOffTheLoop: the precompute falls back to the main thread when scoreBatch throws or answers short", async () => {
  const { createBoardFitPrecompute } = await import("../services/jobs/boardFitPrecompute.js");
  const src = read("services/jobs/boardFitPrecompute.js");
  // the one helper every scoring loop goes through
  assert.equal((src.match(/await scoreMany\(jobs, basis\.runtimeBasis, st\)/g) || []).length, 3, "prime, the pass and the queue");
  assert.match(src, /if \(Array\.isArray\(out\) && out\.length === jobs\.length\) \{/);
  assert.match(src, /catch \{ \/\* the worker could not answer: score here, as before \*\/ \}/);
  assert.throws(() => createBoardFitPrecompute({}), /needs db, basisFor, scoreJob and store/);
  // server.js wires the worker in, with scoreJob kept as the fallback
  const server = read("server.js");
  assert.match(server, /scoreBatch: scoreBatchForBasis,/);
  assert.match(server, /return scorePool\.score\(\{ items, weights, synonyms: atsSynonyms\(\), runtimeBasis \}\);/);
  assert.match(server, /enabled: String\(process\.env\.DRAFT_SCORE_WORKER \|\| "on"\)\.toLowerCase\(\) !== "off",/);
  assert.match(server, /scorePool: scorePool\.status\(\),/);
});

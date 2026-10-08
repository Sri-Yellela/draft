// The manual enrichment round trip's split / merge (services/jobs/enrichmentChunks.js). Each red when removed:
// split keeps every posting line and drops the _meta header · merge restores content_hash from the EXPORT (a model
// that drops or mangles it neither loses a good row nor launders a stale one) · source is dropped · a bad enum, an
// unknown column, an unknown job_id and a duplicate are caught BEFORE upload · an all-null row is dropped · code
// fences and prose are skipped · import files are capped · rejected / missing / empty rows come back in EXPORT
// format · ⭐ the merged file passes the REAL importer's dry run (planImport) on a real board.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { buildExport, toJsonl, planImport } from "../services/jobs/enrichmentTransfer.js";
import { splitExport, mergeFilled, enrichmentPrompt } from "../services/jobs/enrichmentChunks.js";

function board(n = 6) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const now = Math.floor(Date.now() / 1000);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, description, is_active, discovered_at, scraped_at)
    VALUES (?, 't', ?, ?, 'Acme', ?, 'greenhouse', ?, 1, ?, ?)`);
  for (let i = 1; i <= n; i++) ins.run(`j${i}`, `h${i}`, `Backend Engineer ${i}`, `https://x/${i}`, `Build APIs in Go and Python. Posting ${i}.`, now, now);
  return db;
}
const exportOf = (db) => toJsonl(buildExport(db, { candidatesOnly: true }));
const line = (jobId, enrichment, extra = {}) => JSON.stringify({ job_id: jobId, content_hash: "MANGLED", enrichment, ...extra });
const good = (id) => line(id, { skills_json: [{ skill: "Go", type: "hard" }, { skill: "Python", type: "hard" }], experience_level: "mid", workplace_type: "remote" });

test("split keeps every posting line, in chunks, and drops the _meta header", () => {
  const db = board(7);
  const { rows, chunks } = splitExport(exportOf(db), { size: 3 });
  assert.equal(rows, 7);
  assert.deepEqual(chunks.map((c) => c.length), [3, 3, 1]);
  assert.ok(chunks.flat().every((l) => JSON.parse(l).source && !JSON.parse(l)._meta), "the model needs the source block; the header is gone");
  assert.match(enrichmentPrompt(), /explicitly says so/, "the prompt carries D36's exact-or-blank rule");
});

test("⭐ merge: hash restored, source dropped, mistakes caught before upload — and the REAL importer accepts the result", () => {
  const db = board(6);
  const exp = exportOf(db);
  const filled = [
    { name: "chunk-001.filled.jsonl", text: ["```json", good("j1"), "Here are the rows:", good("j2"), "```"].join("\n") },
    { name: "chunk-002.filled.jsonl", text: [
      line("j3", { experience_level: "Senior Engineer II" }),                  // bad enum
      line("j4", { summary: null, skills_json: [] }),                         // nothing to write
      line("nope", { experience_level: "mid" }),                              // not in the export
      good("j1"),                                                             // duplicate
      line("j6", { experience_level: "mid", vibes: "great" }, { source: { title: "x" } }),  // unknown column
    ].join("\n") },
  ];                                                                          // j5 never returned
  const { files, redo, report } = mergeFilled(exp, filled, { max: 500 });
  assert.equal(report.accepted, 2);
  assert.deepEqual(report.rejected.map((r) => r.jobId).sort(), ["j3", "j6", "nope"]);
  assert.match(report.rejected.find((r) => r.jobId === "j3").error, /experience_level must be one of/);
  assert.match(report.rejected.find((r) => r.jobId === "j6").error, /unknown column/);
  assert.deepEqual(report.duplicates.map((d) => d.jobId), ["j1"]);
  assert.deepEqual(report.emptyDropped.map((d) => d.jobId), ["j4"]);
  assert.deepEqual(report.missing, ["j5"]);
  assert.equal(report.junk.length, 1, "the prose line is skipped and reported");

  const out = files[0].trim().split("\n").map((l) => JSON.parse(l));
  const exported = new Map(exp.trim().split("\n").map((l) => JSON.parse(l)).filter((o) => o.job_id).map((o) => [o.job_id, o]));
  for (const r of out) {
    assert.deepEqual(Object.keys(r).sort(), ["content_hash", "enrichment", "job_id"], "source is dropped");
    assert.equal(r.content_hash, exported.get(r.job_id).content_hash, "the hash is the EXPORT's, not the model's");
  }
  const plan = planImport(db, files[0]);
  assert.equal(plan.valid, true, JSON.stringify(plan.rejected));
  assert.deepEqual([plan.matched, plan.wouldWrite], [2, 2]);

  const redoIds = redo.trim().split("\n").map((l) => JSON.parse(l)).map((o) => o.job_id).sort();
  assert.deepEqual(redoIds, ["j3", "j4", "j5", "j6"], "every unfinished posting comes back, in export format");
  assert.equal(splitExport(redo, { size: 30 }).rows, 4, "…and redo splits like an export");
});

test("merge caps each import file", () => {
  const db = board(5);
  const { files } = mergeFilled(exportOf(db), [{ name: "a.filled.jsonl", text: ["j1", "j2", "j3", "j4", "j5"].map(good).join("\n") }], { max: 2 });
  assert.deepEqual(files.map((f) => f.trim().split("\n").length), [2, 2, 1]);
});

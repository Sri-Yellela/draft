// A123 (5) (46c) · the Atlas full pass (the first live baseline + the nightly recount) reads every active posting through
// the matcher on the offload worker — 49.7 s of held thread on the 100k fixture's first baseline. The read runs on a
// read-only connection; only the queue drain before it and the writes after it run on the main thread; the result is the
// same rows the synchronous pass writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { computeAtlasStats, computeAtlasStatsOffloaded, readAtlasPass } from "../services/atlas/atlasStats.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { createOffload } from "../services/db/offloadWorker.js";
import { at } from "../test-support/sourceAnchors.js";

function boardFile(dir, name) {
  const file = path.join(dir, name);
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [kind, n] of [["tool", "Python"], ["tool", "Kubernetes"], ["concept", "Distributed systems"]]) {
    const { id } = upsertNode(db, { kind, name: n, source: "registry" });
    setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(id), "published");
  }
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active, salary_min_usd, salary_max_usd)
    VALUES (?, 'q', ?, ?, ?, ?, ?, 1, ?, ?)`);
  const texts = ["Requirements:\n- Python and Kubernetes\n- Distributed systems", "Requirements:\n- Python\n- SQL", "Requirements:\n- Kubernetes operators"];
  for (let i = 0; i < 30; i++) ins.run(`j${i}`, `h${i}`, i % 2 ? "Backend Engineer" : "Platform Engineer", `Co${i % 4}`, `https://x.test/${i}`, texts[i % 3], 100000 + i * 1000, 150000 + i * 1000);
  return { db, file };
}
const dump = (db) => ({
  stats: db.prepare(`SELECT node_id, postings, top_skills_json, top_roles_json, pay_min_usd, pay_median_usd, pay_max_usd, pay_n FROM atlas_node_stats ORDER BY node_id`).all(),
  match: db.prepare(`SELECT posting_id, company_key, role_id, level, asked, linked, sentences FROM atlas_posting_match ORDER BY posting_id`).all(),
  rl: db.prepare(`SELECT role_id, level, node_id, postings FROM atlas_role_level_stats ORDER BY role_id, level, node_id`).all(),
  edges: db.prepare(`SELECT from_id, to_id, type FROM atlas_edges WHERE source = 'board' ORDER BY from_id, to_id, type`).all(),
});

test("a123AtlasPassOffloaded: the read is read-only, and the offloaded pass writes exactly what the synchronous one writes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a123-atlas-"));
  try {
    const a = boardFile(dir, "a.db"), b = boardFile(dir, "b.db");
    const syncResult = computeAtlasStats(a.db, { now: 100 });
    const ro = new Database(b.file, { readonly: true });   // a write on this connection would throw
    const offResult = await computeAtlasStatsOffloaded(b.db, async (task) => { assert.equal(task, "atlasPass"); return structuredClone(readAtlasPass(ro)); }, { now: 100 });
    ro.close();
    assert.deepEqual({ ...offResult }, { ...syncResult });
    assert.ok(syncResult.postings === 30 && syncResult.nodes >= 3);
    assert.deepEqual(dump(b.db), dump(a.db), "the same counts, match rows, role levels and board edges");
    a.db.close(); b.db.close();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a123AtlasPassOffloaded: through the REAL offload worker (its read-only connection), the pass lands the same baseline", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a123-atlas-w-"));
  const off = { close: async () => {} };
  try {
    const a = boardFile(dir, "a.db"), b = boardFile(dir, "b.db");
    computeAtlasStats(a.db, { now: 200 });
    const worker = createOffload({ dbPath: b.file, log: { error() {} } });
    off.close = worker.close;
    const r = await computeAtlasStatsOffloaded(b.db, (task, args) => worker.run(task, args, { timeoutMs: 60_000 }), { now: 200 });
    assert.equal(r.postings, 30);
    assert.deepEqual(dump(b.db), dump(a.db));
    a.db.close(); b.db.close();
  } finally { await off.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a123AtlasPassOffloaded (source): both server call sites run the pass through runAtlasPass; the sync pass only under DRAFT_OFFLOAD=off", () => {
  const s = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const helper = s.slice(at(s, "function runAtlasPass() {"), at(s, "\n}\n", at(s, "function runAtlasPass() {")) + 2);
  assert.match(helper, /DRAFT_OFFLOAD \|\| "on"\)\.toLowerCase\(\) === "off"\) return Promise\.resolve\(\)\.then\(\(\) => computeAtlasStats\(db\)\);/);
  assert.match(helper, /computeAtlasStatsOffloaded\(db, \(task, args\) => offload\.run\(task, args, \{ timeoutMs: 600_000 \}\)\)/);
  assert.equal(s.split("computeAtlasStats(db)").length - 1, 1, "no other call of the synchronous pass in server.js");
  assert.match(s, /const a = await runAtlasPass\(\);/, "the nightly recount");
  assert.match(s, /runAtlasPass\(\)\.then\(a => console\.log\(`\[atlas\] live baseline:/, "the first baseline");
  const worker = fs.readFileSync("services/db/offloadWorker.js", "utf8");
  assert.match(worker, /atlasPass: \(\) => readAtlasPass\(conn\),/);
});

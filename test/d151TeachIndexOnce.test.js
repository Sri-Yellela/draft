// D151 (45k) · Your map / Your skills: the piece ↔ node index is read ONCE per nodeLearnStates, not once per node.
// Measured on the 100k suite's main-thread profile (11-08): teachIndex ≈ 10 s of a 61 s window — its cache-key check
// (three statements, one a SUM over learn_teaches) ran for every published node.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { learnContent } from "../services/learn/learnContent.js";
import { seedCircleData, stepsTeachingByNode } from "../services/learn/learnCircle.js";
import { importLearnConcepts } from "../services/atlas/atlasLearnImport.js";
import { stepsTeaching, nodeLearnStates } from "../services/atlas/atlasTree.js";
import { atlasIndex } from "../services/atlas/atlasMe.js";

function fixture() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (7, 'learner@example.test', 'x')`).run();
  seedCircleData(db);
  importLearnConcepts(db, learnContent(db));
  db.prepare(`UPDATE atlas_nodes SET status = 'published'`).run();
  return db;
}

test("d151TeachIndexOnce: stepsTeaching with the index read once answers exactly what the per-node read answers", () => {
  const db = fixture();
  const learn = learnContent(db), byNode = stepsTeachingByNode(db);
  const nodes = atlasIndex(db).nodes;
  let taught = 0;
  for (const n of nodes) {
    const a = stepsTeaching(db, n, learn), b = stepsTeaching(db, n, learn, byNode);
    assert.deepEqual(b, a, n.slug);
    if (a.length) taught++;
  }
  assert.ok(taught > 50, `${taught} nodes taught — the fixture exercises the index`);
});

test("d151TeachIndexOnce: nodeLearnStates reads learn_teaches a constant number of times, whatever the node count", () => {
  const db = fixture();
  nodeLearnStates(db, 7);   // warm the kept index
  let teachReads = 0;
  const counted = new Proxy(db, { get: (t, k) => k === "prepare"
    ? (sql) => { if (/FROM learn_teaches/.test(sql)) teachReads++; return t.prepare(sql); }
    : (typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  const published = atlasIndex(db).nodes.filter(n => n.status === "published" && n.kind !== "role").length;
  const states = nodeLearnStates(counted, 7, atlasIndex(db));
  assert.ok(states.size > 0);
  assert.ok(published > 100, `${published} published nodes`);
  assert.ok(teachReads <= 2, `${teachReads} reads of learn_teaches for ${published} nodes (was one key check per node)`);
});

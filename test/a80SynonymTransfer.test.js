// A80 V10 — skill-synonym proposals by export → owner → import (D17). The model pass in
// scripts/al3SkillSynonyms.mjs is gone; services/kb/synonymTransfer.js holds the guards.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  corpusVocabulary, vocabularyTerms, buildSynonymExport, parseJsonl, planSynonymImport,
  applySynonymImport, SYNONYM_BATCH_KIND,
} from "../services/kb/synonymTransfer.js";
import { confirmSynonym } from "../services/kb/skillSynonyms.js";

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.exec("DELETE FROM skill_synonyms"); // the migrations seed confirmed pairs; start from none
  return db;
}
// Five postings; df >= 3 keeps kubernetes, k8s, python, docker — and drops "rare thing".
const ROWS = [
  { job_id: "j1", skills_json: JSON.stringify(["Kubernetes", "k8s", "Python", "Docker"]) },
  { job_id: "j2", skills_json: JSON.stringify(["Kubernetes", "k8s", "Python"]) },
  { job_id: "j3", skills_json: JSON.stringify(["kubernetes", "K8s", "docker", "rare thing"]) },
  { job_id: "j4", skills_json: JSON.stringify(["python", "docker"]) },
  { job_id: "j5", skills_json: "not json" },
];
const vocab = () => corpusVocabulary(ROWS).postingsByTerm;
const exported = () => buildSynonymExport(vocabularyTerms(vocab(), 3), { batchSize: 60, exportedAt: "t" });
const jsonl = (lines) => lines.map(l => JSON.stringify(l)).join("\n");
const filled = (pairs, mutate = (l) => l) => {
  const lines = exported();
  lines[1].pairs = pairs;
  return parseJsonl(jsonl(mutate(lines)));
};
const rows = (db) => db.prepare("SELECT term, equivalent, relation, status, corroboration_count, source_postings_json FROM skill_synonyms ORDER BY term").all().map(r => ({ ...r }));
const K8S = [{ a: "kubernetes", b: "k8s", relation: "alias" }];

test("the export is the vocabulary the scorer matches on, batched, with the rules and empty pairs", () => {
  const lines = exported();
  assert.equal(lines[0].kind, "al3_synonym_instructions");
  assert.match(lines[0].rules, /LEAVE IT OUT/);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].kind, SYNONYM_BATCH_KIND);
  assert.ok(!lines[1].terms.some(t => /rare/.test(t)));
  assert.equal(lines[1].terms.length, 4, "df >= 3 keeps four terms; 'rare thing' is one posting's phrasing");
  assert.deepEqual(lines[1].pairs, []);
});

test("a filled file is a dry run first, lands as 'proposed' with provenance, and re-importing changes nothing", () => {
  const db = board();
  const t = exported()[1].terms;
  const pairs = [{ a: t.find(x => /^kubernete/.test(x)), b: t.find(x => /^k8/.test(x)), relation: "alias" }];
  const plan = planSynonymImport(db, filled(pairs), vocab());
  assert.equal(plan.ok, true);
  assert.equal(plan.pairs, 1);
  assert.deepEqual(rows(db), [], "a plan writes nothing");

  const first = applySynonymImport(db, filled(pairs), vocab());
  assert.equal(first.written.inserted, 1);
  const after = rows(db);
  assert.equal(after.length, 1);
  assert.equal(after[0].status, "proposed", "an import never promotes — only --confirm does");
  assert.deepEqual(JSON.parse(after[0].source_postings_json).sort(), ["j1", "j2", "j3"]);

  const again = applySynonymImport(db, filled(pairs), vocab());
  assert.equal(again.unchanged, 1);
  assert.equal(again.written, null, "the same file twice writes nothing the second time");
  assert.deepEqual(rows(db), after);
});

test("a pair a person already decided is left alone", () => {
  const db = board();
  const t = exported()[1].terms;
  const pairs = [{ a: t.find(x => /^kubernete/.test(x)), b: t.find(x => /^k8/.test(x)), relation: "alias" }];
  applySynonymImport(db, filled(pairs), vocab());
  const r = rows(db)[0];
  assert.ok(confirmSynonym(db, r.term, r.equivalent));
  const res = applySynonymImport(db, filled([{ ...pairs[0], relation: "related" }]), vocab());
  assert.equal(res.alreadyReviewed, 1);
  assert.equal(rows(db)[0].status, "confirmed");
  assert.equal(rows(db)[0].relation, "alias");
});

test("every guard refuses the WHOLE file and writes nothing", () => {
  const t = exported()[1].terms;
  const good = { a: t[0], b: t[1], relation: "related" };
  const cases = {
    invalid_value: filled([good, { a: t[2], b: t[3], relation: "same" }]),
    tampered: filled([good], (l) => { l[1].terms = l[1].terms.slice(1); return l; }),
    unknown_term: filled([good, { a: "kubernetes operator", b: t[0], relation: "alias" }]),
    duplicate_batch: filled([good], (l) => [...l, { ...l[1] }]),
    self_pair: filled([good, { a: t[0], b: t[0], relation: "alias" }]),
  };
  for (const [name, parsed] of Object.entries(cases)) {
    const db = board();
    const res = applySynonymImport(db, parsed, vocab());
    assert.equal(res.ok, false, `${name} was accepted`);
    assert.equal(res.written, null, `${name} wrote something`);
    assert.deepEqual(rows(db), [], `${name} left rows behind — the good pair must not land either`);
    const code = name === "self_pair" ? "invalid_value" : name;
    assert.ok(res.problems.some(p => p.code === code), `${name}: ${JSON.stringify(res.problems)}`);
  }
  const notJson = parseJsonl("{nope\n");
  assert.equal(planSynonymImport(board(), notJson, vocab()).problems[0].code, "invalid_value");
});

test("a term that left the corpus since the export is stale — refused unless allowed", () => {
  const db = board();
  const t = exported()[1].terms;
  const pairs = [{ a: t[0], b: t[1], relation: "related" }];
  const shrunk = new Map([...vocab()].filter(([term]) => term !== t[1]));
  const res = planSynonymImport(db, filled(pairs), shrunk);
  assert.equal(res.problems[0].code, "stale");
  assert.equal(planSynonymImport(db, filled(pairs), shrunk, { allowStale: true }).ok, true);
});

test("the script exports and imports, and its model pass is retired", () => {
  const src = fs.readFileSync("scripts/al3SkillSynonyms.mjs", "utf8");
  assert.match(src, /has\("--export"\)/);
  assert.match(src, /has\("--import"\)/);
  assert.match(src, /--propose is retired \(D17, A80 V10\)/);
  assert.match(src, /const DB_PATH = val\("--db"\)/, "the script can be pointed at a copy");
  assert.doesNotMatch(src, /callModel|@anthropic-ai\/sdk|modelCall\.js|modelProviders\.js/);
});

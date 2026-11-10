// 45s (owner 11-09: "boost crawlers to boost coverage and volume") · the probed non-tech employer list joins D82's candidate
// POOL once, through poolCandidates' own guards — it never ADDS a company (the owner approves a ranked batch).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importSeedCandidates, seedItems, SEED_SOURCE } from "../services/seedCandidates.js";

function seedFile(found) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "seed45s-")), "c.json");
  fs.writeFileSync(f, JSON.stringify({ tried: {}, found }));
  return f;
}
const FOUND = [
  { company: "Example Builders", atsType: "greenhouse", slug: "examplebuilders", industry: "construction", evidence: { us: 40, inScope: 22, probedAt: "2026-11-09" } },
  { company: "Example Health", atsType: "lever", slug: "examplehealth", industry: "healthcare", evidence: { us: 12, inScope: 9 } },
  { company: "Already Here", atsType: "ashby", slug: "alreadyhere", industry: "finance", evidence: { us: 5 } },
];

test("seedNonTechCandidates: into the pool as NEW candidates, once; a configured company is skipped; nothing is added", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active) VALUES ('Already Here', 'ashby', 'alreadyhere', 1)").run();
  const before = db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get();
  const f = seedFile(FOUND);
  assert.equal(seedItems(f)[0].ats.url, "https://boards.greenhouse.io/examplebuilders");
  const a = importSeedCandidates(db, { file: f });
  assert.equal(a.inserted, 2); assert.equal(a.skipped.configured, 1);
  const rows = db.prepare("SELECT company, status, source FROM company_candidates ORDER BY company").all();
  assert.deepEqual(rows.map(r => [r.company, r.status, r.source]), [["Example Builders", "new", SEED_SOURCE], ["Example Health", "new", SEED_SOURCE]]);
  const b = importSeedCandidates(db, { file: f });
  assert.equal(b.inserted, 0); assert.equal(b.refreshed, 2, "idempotent");
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get(), before, "the seed never adds a company");
  assert.match(fs.readFileSync("server.js", "utf8"), /if \(process\.env\.DISCOVERY_PAUSED !== "1"\) setTimeout\(\(\) => \{\r?\n  try \{ const r = importSeedCandidates\(db\);/);
});

test("seedNonTechCandidates: the Candidates panel lists every undecided row, even past 200 decided / probed ones (owner 11-09)", async () => {
  const { listCandidates } = await import("../services/companyCandidates.js");
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  importSeedCandidates(db, { file: seedFile(FOUND.slice(0, 2)) });
  const cols = db.prepare("PRAGMA table_info(company_candidates)").all().map(c => c.name);
  const ins = db.prepare(`INSERT INTO company_candidates (company, ats_type, ats_slug, status, rank_score, source, first_seen, last_seen)
                          VALUES (?, 'greenhouse', ?, ?, ?, 'hn', 1, 1)`);
  assert.ok(cols.includes("rank_score"));
  for (let i = 0; i < 230; i++) ins.run(`Probed ${i}`, `probed${i}`, "probed", 100 - i / 10);
  for (let i = 0; i < 230; i++) ins.run(`Gone ${i}`, `gone${i}`, "rejected", 0);
  const { candidates, counts } = listCandidates(db);
  assert.equal(counts.new, 2);
  assert.deepEqual(candidates.filter(c => c.status === "new").map(c => c.company).sort(), ["Example Builders", "Example Health"]);
  assert.equal(candidates.filter(c => c.status === "probed").length, 230, "no undecided row is cut");
  assert.equal(candidates.filter(c => c.status === "rejected").length, 200, "decided rows keep the 200 cap");
  assert.match(fs.readFileSync("client/src/panels/adminOps.jsx", "utf8"), /r\.source === "seed-nontech-45s" \? "non-tech seed \(probed list\)"/);
});

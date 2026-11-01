import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createBoardFitPrecompute } from "../services/jobs/boardFitPrecompute.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";

// 43y FIX (the owner's trial walk, 11-01: a new account's deck said "no jobs or picks"). Three causes, measured on a copy
// of the board: (1) the deal read lca_employer_periods by employer_name with no index — 2.5 s a row, the server frozen
// for minutes (migration 208); (2) a new profile's scores were written only after the WHOLE board was scored — 320 s for
// 2,411 postings — so the deal had nothing to deal (priming); (3) the deck called that "empty" (now "scoring", re-asked).

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function board(n) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at, description)
    VALUES (?, 't', ?, ?, 'Co', ?, 'greenhouse', 1, unixepoch(), 'text')`);
  for (let i = 0; i < n; i++) { const id = `j${String(i).padStart(3, "0")}`; ins.run(id, `h${id}`, `Role ${i}`, `https://example.com/${id}`); }
  return db;
}

test("a profile with nothing scored gets its prime set written FIRST, before the rest of the board is scored", async () => {
  const db = board(200);
  const writes = [];
  const fit = createBoardFitPrecompute({
    db, log: { log() {}, warn() {}, error() {} },
    basisFor: () => ({ runtimeBasis: {}, basisHash: "b1" }),
    scoreJob: (job) => ({ score: 50, job: job.job_id }),
    store: ({ jobId }) => { writes.push(jobId); },
    primeFor: () => ["j199", "j198", "j150", "j010"],
    primeSize: 3,
  });
  const r = await fit.runFor({ userId: 1, profile: { id: 7 }, reason: "test" });
  assert.deepEqual([...writes.slice(0, 3)].sort(), ["j150", "j198", "j199"], "the prime set (its first 3) is written first, in one go");
  assert.equal(new Set(writes).size, 200, "and every posting is still scored, once");
  assert.equal(r.scored, 200);
});

test("priming happens only for a profile with NOTHING scored (a ranked board someone may be paging is never rewritten piecemeal)", () => {
  const src = read("services/jobs/boardFitPrecompute.js");
  assert.match(src, /if \(primeFor && p\.fresh === 0 && p\.jobIds\.length > primeSize\)/);
  const server = read("server.js");
  assert.match(server, /primeFor: \(_userId, profile\) => \{\n\s+const cat = profileCategory\(profile \|\| \{\}\);/);
});

test("the deck says SCORING, not empty, while a new profile's scores land — and asks again", () => {
  const server = read("server.js");
  assert.match(server, /if \(scoredSoFar < 30\) \{ scheduleBoardFit\(req\.user\.id, "deck", profile\); return res\.json\(\{ \.\.\.deck, reason: "scoring" \}\); \}/);
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /if \(deck\.reason === "scoring" && scoringTries\.current < 45\) \{/);
  assert.match(deck, /setTimeout\(\(\) => fetchDeck\(\), 4000\);/);
  assert.match(deck, /Your best matches will be here in a few seconds/);
});

test("migration 208 indexes lca_employer_periods.employer_name, byte-identical in both runners", () => {
  const block = (s) => s.slice(at(s, 'id: "208_lca_employer_name_index"'), at(s, "`,", at(s, 'id: "208_lca_employer_name_index"')));
  const a = block(fs.readFileSync("server.js", "utf8")), b = block(fs.readFileSync("scripts/migrations.js", "utf8"));
  assert.ok(a.includes("ON lca_employer_periods(employer_name)"));
  assert.equal(a, b);
});

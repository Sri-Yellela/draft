// ⭐ A195 (46l) · the board's MAIN-THREAD cost. Staging at 100k × 20 people: 4 read workers left the board p95 at 482 ms
// (438 on 2) — the workers were not the limit. A main-thread profile (scripts/scaleSuite.mjs --cpu-prof, 10 people × 45 s
// on the 100k fixture) found the main thread idle 2.6 s of 46 s, boardPageResponse 13.3 s of it: ~3.7 s re-reading the
// SAME 50 postings' text (postingRequirements, via the sponsorship signal) on every load, and ~1 s re-reading
// lca_source_files once per board row. Kept now: the posting reading per text, the company read per page, the corpus
// coverage per database for 30 s (a reconcile reads it fresh). Measured after: board p95 181 → 155 ms, main-thread
// boardPageResponse 13.2 → 9.4 ms a load, 12% more requests served by the same 10 people.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { postingSponsorshipWords, sponsorshipSignalsForRows, __wordsMemo } from "../services/kb/sponsorshipSignal.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A195: the posting's own words are read once per text — the same answer, a bounded memo", () => {
  __wordsMemo.clear();
  const no = { description: "We are unable to sponsor visas for this role. Applicants must be authorized to work in the US. We use E-Verify." };
  const yes = { description: "We sponsor H-1B visas. Python, SQL." };
  const a = postingSponsorshipWords(no), b = postingSponsorshipWords({ ...no });
  assert.deepEqual(a, b);
  assert.equal(__wordsMemo.size(), 1, "the second read of the same text is the kept answer");
  assert.equal(a.everify, true);
  assert.equal(postingSponsorshipWords(yes).saysNo, false);
  assert.equal(__wordsMemo.size(), 2);
  a.saysNo = "mutated";
  assert.notEqual(postingSponsorshipWords(no).saysNo, "mutated", "a caller's change never reaches the kept answer");
  assert.deepEqual(postingSponsorshipWords({ description: "  " }), { saysNo: false, everify: false });
  assert.match(read("services/kb/sponsorshipSignal.js"), /const WORDS_MEMO_MAX = 5000;[\s\S]*if \(wordsMemo\.size >= WORDS_MEMO_MAX\) wordsMemo\.delete\(wordsMemo\.keys\(\)\.next\(\)\.value\);/, "bounded");
});

test("A195: a page reads each company's record once; the corpus coverage is kept 30 s and a reconcile reads it fresh", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE company_lca_sponsorship (company TEXT PRIMARY KEY, presentable INTEGER);
    CREATE TABLE lca_source_files (fiscal_period TEXT, file_name TEXT, period_start INTEGER, period_end INTEGER, has_employer_fein INTEGER, quarters_covered INTEGER);`);
  let companyReads = 0, coverageReads = 0;
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    if (/FROM company_lca_sponsorship WHERE company = \?/.test(sql)) { const s = prepare(sql); return { get: (...a) => { companyReads++; return s.get(...a); } }; }
    if (/FROM lca_source_files$/m.test(sql.trim()) || /FROM lca_source_files\s*$/.test(sql)) coverageReads++;
    return prepare(sql);
  };
  const rows = [1, 2, 3, 4].map(i => ({ job_id: `j${i}`, company: i < 4 ? "Acme" : "Beta", title: "Engineer", description: "Python." }));
  const out = sponsorshipSignalsForRows(db, rows);
  assert.equal(out.size, 4);
  assert.equal(companyReads, 2, "Acme once, Beta once — not once per row");
  const lca = read("services/kb/lcaLayer.js");
  assert.match(lca, /const COVERAGE_KEEP_MS = 30_000;/);
  assert.match(lca, /const coverage = getCorpusCoverage\(db, \{ fresh: true \}\);/, "reconcileCompanyLca reads it fresh after an ingest");
  assert.match(lca, /if \(kept && Date\.now\(\) - kept\.at < COVERAGE_KEEP_MS\) return kept\.value;/);
});

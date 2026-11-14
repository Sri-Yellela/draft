import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fullReport, isSlimReport, setSlimReportExpander, slimOf } from "../services/atsReportRead.js";

// ⭐ A187 Stage 0 (46i) · SCORE-ONLY STORAGE. With ATS_STORE_SLIM=on the board's bulk scoring stores { slim, score, source,
// scorable }; every reader of a stored report goes through fullReport, which re-scores a slim row once (server.js
// expandSlimReport) and writes it back full only when its inputs still match. Off by default.

const FULL = { source: "local-v9", score: 41, scorable: true, tier1_matched: ["sql"], tier1_missing: ["go"], experience: null };

test("a187: slimOf keeps the score and what it rested on, nothing else", () => {
  assert.deepEqual(slimOf(FULL), { slim: 1, score: 41, source: "local-v9", scorable: true });
  assert.equal(isSlimReport(slimOf(FULL)), true);
  assert.equal(isSlimReport(FULL), false);
  assert.ok(JSON.stringify(slimOf(FULL)).length < 70);
});

test("a187: fullReport — a full row is JSON.parse; a slim row is expanded with its row's names", () => {
  const seen = [];
  setSlimReportExpander((ctx) => { seen.push(ctx); return FULL; });
  try {
    assert.deepEqual(fullReport(JSON.stringify(FULL), { userId: 1, jobId: "j" }), FULL);
    assert.equal(seen.length, 0, "a full row never calls the expander");
    assert.deepEqual(fullReport(JSON.stringify(slimOf(FULL)), { userId: 1, profileId: 10, jobId: 7 }), FULL);
    assert.deepEqual(seen, [{ userId: 1, profileId: 10, jobId: "7" }]);
    assert.equal(fullReport("not json", { userId: 1, jobId: "j" }), null);
    assert.equal(fullReport("null", { userId: 1, jobId: "j" }), null);
  } finally { setSlimReportExpander(null); }
});

test("a187: a slim row that cannot be expanded comes back slim (detail absent), never a throw", () => {
  const slim = slimOf(FULL);
  assert.deepEqual(fullReport(JSON.stringify(slim), { userId: 1, jobId: "j" }), slim, "no expander");
  setSlimReportExpander(() => { throw new Error("boom"); });
  try { assert.deepEqual(fullReport(slim, { userId: 1, jobId: "j" }), slim); }
  finally { setSlimReportExpander(null); }
  setSlimReportExpander(() => null);
  try { assert.deepEqual(fullReport(slim, { userId: 1, jobId: "j" }), slim, "no résumé / posting gone"); }
  finally { setSlimReportExpander(null); }
});

test("a187: wiring — only the bulk writer goes slim; every reader of a stored report goes through fullReport", () => {
  const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const server = src("server.js");
  assert.match(server, /JSON\.stringify\(args\.slim \? slimOf\(args\.report\) : args\.report\)/);
  assert.match(server, /slim: !!slim && flagOn\(db, "ats_store_slim"\)/, "the flag decides (services/flags.js)");
  assert.match(server, /store: \(a\) => storeAtsReportForProfile\(\{ \.\.\.a, slim: true \}\)/, "the board-fit precompute");
  assert.equal((server.match(/slim: true/g) || []).length, 1, "nothing else writes slim");
  assert.match(server, /if \(parsed\?\.source === LOCAL_ATS_SOURCE && !isSlimReport\(parsed\)\) return res\.json\(parsed\);/, "the keywords panel");
  assert.match(server, /return fullReport\(reportStmt\.get\(req\.user\.id, profile\.id, jobId\)\?\.ats_report/, "the deck");
  assert.match(server, /row\.basis_hash === hit\.basis\.basisHash && row\.job_hash === jobHash/, "written back only on matching inputs");
  assert.match(server, /setSlimReportExpander\(expandSlimReport\);/);
  // The deck and Best Bets expand each board page's slim rows in the SCORE WORKER before reading them (first deck 361-434 ms
  // of main thread when done one by one on it; a 3k local fixture, 46i).
  assert.equal((server.match(/await expandSlimPage\(req\.user\.id, profile\.id, body\.jobs\.map\(j => j\.id\)\)/g) || []).length, 2);
  assert.match(server, /const out = await scoreBatchForBasis\(jobs, basis\.runtimeBasis\);/);
  // A195 leftover (b) (46m): one read of the report and its score (a statement prepared once) — the report still through fullReport
  assert.match(src("services/bestBets.js"), /const stored = safe\(\(\) => prepared\(db, `SELECT ats_report, ats_score FROM ats_only_reports/);
  assert.match(src("services/bestBets.js"), /fullReport\(stored\?\.ats_report \|\| "null"/);
  assert.match(src("services/interviewPrep.js"), /fullReport\(r\.ats_report, \{ userId, profileId: r\.domain_profile_id, jobId \}\)/);
  assert.match(src("services/learn/dailyQuestion.js"), /fullReport\(r\.ats_report, \{ userId, profileId: r\.domain_profile_id, jobId: r\.job_id \}\)/);
  assert.match(src("routes/apply.js"), /const full = fullReport\(row\.ats_report, \{ userId, profileId, jobId \}\);/);
});

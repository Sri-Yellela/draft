#!/usr/bin/env node
// D75 J1 ACCEPTANCE · score a J1 run against the known-answer set (docs/CRAWLER_WORKER.md §7).
//
//   node scripts/d75J1Score.mjs --urls                         the known-answer URLs, one per line — paste them into
//                                                              Admin → Crawler as j1_find_board tasks
//   node scripts/d75J1Score.mjs --results <file>               precision / recall per ATS, the wrong answers, the misses
//   node scripts/d75J1Score.mjs --results <file> --json        the same, as JSON
//   … --known <file>                                           another known-answer file (default: the D75 fixture)
//
// <file> is either export of the run, as draft holds it:
//   · the crawler_tasks rows:  sqlite3 -json <db> "SELECT * FROM crawler_tasks WHERE type = 'j1_find_board'" > j1.json
//   · or Admin → Crawler's summary: GET /api/admin/crawler saved as JSON ({ tasks: [...] }; its evidence is the first 5).
// The evidence is turned into (vendor, slug) by draft's own harvestPairOf — the parser acceptResult uses.
// Reads files only: no database, no network. The logic is services/crawlerJ1Score.js (tested by test/d75J1Score.test.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The parser's import chain logs at load (services/jobs/aggregator.js); send that to stderr so stdout stays the
// report — `--json > score.json` must be JSON.
const log = console.log;
console.log = (...a) => console.error(...a);
const { scoreJ1, rowsOf, formatReport } = await import("../services/crawlerJ1Score.js");
console.log = log;

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const knownFile = flag("known") || path.join(here, "..", "test", "fixtures", "d75J1KnownAnswers.json");
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
const kf = readJson(knownFile);
const known = Array.isArray(kf) ? kf : kf.companies;

if (argv.includes("--urls")) {
  for (const k of known) console.log(k.url);
  process.exit(0);
}
const resultsFile = flag("results");
if (!resultsFile) {
  console.error("usage: node scripts/d75J1Score.mjs --results <crawler_tasks export or /api/admin/crawler JSON> [--json] [--known <file>]\n       node scripts/d75J1Score.mjs --urls");
  process.exit(2);
}
const report = scoreJ1(known, rowsOf(readJson(resultsFile)));
console.log(argv.includes("--json") ? JSON.stringify(report, null, 1) : formatReport(report));

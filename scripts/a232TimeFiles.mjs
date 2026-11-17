#!/usr/bin/env node
/**
 * ⭐ A232 (46t) — STEP (a)'s runtimes: every test file run ALONE (the suite's own command, concurrency 1), its wall time,
 * exit and test count appended to a TSV. Resumable: a file already in the TSV is skipped, and --budget <s> stops between
 * files so each call fits one foreground tool call (memory: a background shell is reaped under memory pressure).
 *
 *   node scripts/a232TimeFiles.mjs [--out tmp/a232/timings.tsv] [--budget 540]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", "tmp/a232/timings.tsv");
const BUDGET = Number(arg("--budget", 540)) * 1000;
const list = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".test.js") || f.endsWith(".test.mjs")).map(f => `${d}/${f}`) : [];
const files = [...list("test"), ...fs.readdirSync("packages").flatMap(p => list(`packages/${p}/test`))].sort();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").split(/\r?\n/).map(l => l.split("\t")[0]).filter(Boolean) : []);
const t0 = Date.now(); let ran = 0;
for (const f of files) {
  if (done.has(f)) continue;
  if (Date.now() - t0 > BUDGET) break;
  const s = Date.now();
  const r = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--import", "./test-support/isolateTrackingSink.mjs", f],
    { encoding: "utf8", timeout: 600000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ANTHROPIC_KEY: "", ANTHROPIC_API_KEY: "", DOTENV_CONFIG_PATH: "tmp/a232/none.env" } });
  const ms = Date.now() - s;
  const out = (r.stdout || "") + (r.stderr || "");
  const n = (out.match(/^ℹ tests (\d+)/m) || [])[1] || "";
  const fail = (out.match(/^ℹ fail (\d+)/m) || [])[1] || "";
  fs.appendFileSync(OUT, `${f}\t${ms}\t${r.status ?? "T"}\t${n}\t${fail}\n`);
  ran++;
}
const all = fs.readFileSync(OUT, "utf8").split(/\r?\n/).filter(Boolean);
console.log(`ran ${ran} this call · ${all.length} / ${files.length} timed · ${Math.round(all.reduce((a, l) => a + Number(l.split("\t")[1]), 0) / 60000)} min so far`);

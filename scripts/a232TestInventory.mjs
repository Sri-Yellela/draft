#!/usr/bin/env node
/**
 * ⭐ A232 (46t, owner 11-17: "full suites are taking so much time everyday, we should schedule a full pruning of tests
 * after auditing for redundancy and necessity"). STEP (a) of the audit: a static inventory of every test file — what it
 * guards (the D / A / O rows it names), how many tests, what it boots (real Chrome, the server, a scale fixture), how much
 * of it is source-string pinning — and STEP (b)'s raw material: assertions that appear word for word in more than one
 * file. Reads files only; changes nothing.
 *
 *   node scripts/a232TestInventory.mjs [--timings tmp/a232/timings.tsv] > tmp/a232/inventory.json
 *
 * --timings: a TSV of `<file>\t<wall ms>\t<exit>` (from scripts/a232TimeFiles.mjs) joined in per file.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const list = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".test.js") || f.endsWith(".test.mjs")).map(f => path.join(d, f)) : [];
const files = [
  ...list(path.join(ROOT, "test")),
  ...fs.readdirSync(path.join(ROOT, "packages")).flatMap(p => list(path.join(ROOT, "packages", p, "test"))),
].sort();

const timings = new Map();
const tPath = arg("--timings", null);
if (tPath && fs.existsSync(tPath)) for (const line of fs.readFileSync(tPath, "utf8").split(/\r?\n/)) {
  const [f, ms, exit, tests] = line.split("\t"); if (f && ms) timings.set(f.replace(/\\/g, "/"), { ms: Number(ms), exit: Number(exit), tests: Number(tests) || null });
}

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");
const rows = [];
const assertionHomes = new Map(); // normalised assertion text -> Set(files)
for (const f of files) {
  const src = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const r = rel(f);
  const head = src.slice(0, 1200);
  const tests = (src.match(/^\s*(?:test|it)(?:\.(?:skip|only|todo))?\(\s*[`"']/gm) || []).length;
  const ids = [...new Set((src.match(/\b[ADO]\d{1,3}\b/g) || []))];
  const headIds = [...new Set((head.match(/\b[ADO]\d{1,3}\b/g) || []))];
  const chrome = /puppeteer|launchChrome|extensionBrowser|walkExtension|test-support\/walks\//.test(src);
  const server = /spawn\([^)]*server\.js|fork\([^)]*server\.js|bootServer|startServer\(|node", \["server\.js|\bserver\.js["'`][^\n]*spawn/.test(src) || /spawn\(\s*process\.execPath/.test(src);
  const scale = /scale(Fixture|Db|_fixture)|100k|100_000|500k|test:scale/i.test(src);
  const readsSource = (src.match(/readFileSync\(/g) || []).length;
  const matches = (src.match(/assert\.(match|doesNotMatch|ok\([^)]*\.includes)/g) || []).length;
  const asserts = (src.match(/assert\.\w+\(/g) || []).length;
  const imports = (src.match(/^import .* from ["'](\.\.\/)+(services|routes|shared|client|packages|scripts|lib|db|extension)\//gm) || []).length;
  // source-pin share: assertions that test text, not behaviour
  const pinShare = asserts ? +(matches / asserts).toFixed(2) : 0;
  const kind = chrome ? "chrome" : server ? "server" : scale ? "scale" : (readsSource && pinShare >= 0.6 && imports === 0) ? "source-pin" : imports ? "unit" : readsSource ? "source-pin" : "other";
  const t = timings.get(r);
  rows.push({ file: r, lines: src.split("\n").length, tests, kind, chrome, server, scale, asserts, pinShare, imports, readsSource, headIds, ids: ids.slice(0, 30), ms: t?.ms ?? null, exit: t?.exit ?? null });
  for (const m of src.matchAll(/assert\.(?:match|doesNotMatch)\(\s*\w+\s*,\s*(\/(?:\\.|[^/\n])+\/[a-z]*)/g)) {
    const k = m[1]; if (k.length < 24) continue;
    if (!assertionHomes.has(k)) assertionHomes.set(k, new Set()); assertionHomes.get(k).add(r);
  }
}
const dupes = [...assertionHomes].filter(([, s]) => s.size > 1).map(([k, s]) => ({ assertion: k.slice(0, 160), files: [...s] })).sort((a, b) => b.files.length - a.files.length);
const byKind = {}; for (const r of rows) { const k = byKind[r.kind] ||= { files: 0, tests: 0, ms: 0 }; k.files++; k.tests += r.tests; k.ms += r.ms || 0; }
// files that share a row id in their header — candidates to merge
const byRow = new Map(); for (const r of rows) for (const id of r.headIds.slice(0, 3)) { if (!byRow.has(id)) byRow.set(id, []); byRow.get(id).push(r.file); }
const rowGroups = [...byRow].filter(([, fs]) => fs.length >= 4).map(([id, fs]) => ({ id, files: fs.length, list: fs })).sort((a, b) => b.files - a.files);
console.log(JSON.stringify({ files: rows.length, byKind, dupes: dupes.length, dupeList: dupes.slice(0, 400), rowGroups, rows }, null, 1));

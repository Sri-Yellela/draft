#!/usr/bin/env node
// The manual enrichment round trip's two tedious steps (services/jobs/enrichmentChunks.js):
//
//   SPLIT — the export from Admin → Database → Enrichment Round Trip → ⬇ Export JSONL, into model-sized chunks:
//     node scripts/enrichmentChunks.mjs split enrichment-export.jsonl [--size 30] [--out <dir>]
//   writes <dir>/chunk-001.jsonl … and <dir>/PROMPT.txt. Give the model PROMPT.txt + one chunk at a time, and save
//   each answer beside its chunk as chunk-001.filled.jsonl, chunk-002.filled.jsonl, …
//
//   MERGE — the filled chunks, checked against the importer's own rules, into upload-ready files:
//     node scripts/enrichmentChunks.mjs merge enrichment-export.jsonl <dir> [--max 500]
//   reads every *.filled.jsonl in <dir>; writes <dir>/import-001.jsonl … (≤ 500 rows each, job_id + content_hash +
//   enrichment only) and, when any row failed or never came back, <dir>/redo.jsonl — in EXPORT format, so it can be
//   split again. Then upload each import-NNN.jsonl in the same panel: Dry Run, then Apply Import.
//
// Default <dir>: data/enrichment-chunks/<timestamp>/ (data/ is gitignored — posting text, nothing personal).
// It never touches a database, and never calls a model.
import fs from "node:fs";
import path from "node:path";
import { splitExport, mergeFilled, enrichmentPrompt, DEFAULT_CHUNK_ROWS, DEFAULT_IMPORT_ROWS } from "../services/jobs/enrichmentChunks.js";

const [cmd, exportFile, dirArg] = process.argv.slice(2);
const flag = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const pad = (n) => String(n).padStart(3, "0");
const usage = () => { console.error("usage:\n  split <export.jsonl> [--size 30] [--out dir]\n  merge <export.jsonl> <dir> [--max 500]"); process.exit(2); };
if (!cmd || !exportFile || !fs.existsSync(exportFile)) usage();
const exportText = fs.readFileSync(exportFile, "utf8");

if (cmd === "split") {
  const size = Number(flag("size", DEFAULT_CHUNK_ROWS));
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const out = flag("out", path.join("data", "enrichment-chunks", stamp));
  const { rows, chunks } = splitExport(exportText, { size });
  fs.mkdirSync(out, { recursive: true });
  chunks.forEach((c, i) => fs.writeFileSync(path.join(out, `chunk-${pad(i + 1)}.jsonl`), c.join("\n") + "\n"));
  fs.writeFileSync(path.join(out, "PROMPT.txt"), enrichmentPrompt() + "\n");
  console.log(`${rows} posting(s) → ${chunks.length} chunk(s) of ≤ ${size} in ${out}`);
  console.log(`Next: give the model PROMPT.txt + one chunk at a time; save each answer as chunk-NNN.filled.jsonl beside it.`);
  console.log(`Then: node scripts/enrichmentChunks.mjs merge ${exportFile} ${out}`);
} else if (cmd === "merge") {
  if (!dirArg || !fs.existsSync(dirArg)) usage();
  const max = Number(flag("max", DEFAULT_IMPORT_ROWS));
  const names = fs.readdirSync(dirArg).filter((f) => f.endsWith(".filled.jsonl")).sort();
  const unfilled = fs.readdirSync(dirArg).filter((f) => /^chunk-\d+\.jsonl$/.test(f) && !names.includes(f.replace(/\.jsonl$/, ".filled.jsonl")));
  if (unfilled.length) console.log(`⚠ not filled yet (their postings read as MISSING below): ${unfilled.join(", ")}`);
  if (!names.length) { console.error(`no *.filled.jsonl in ${dirArg}`); process.exit(2); }
  const { files, redo, report } = mergeFilled(exportText,
    names.map((n) => ({ name: n, text: fs.readFileSync(path.join(dirArg, n), "utf8") })), { max });
  for (const f of fs.readdirSync(dirArg).filter((f) => /^import-\d+\.jsonl$/.test(f) || f === "redo.jsonl")) fs.rmSync(path.join(dirArg, f));
  files.forEach((t, i) => fs.writeFileSync(path.join(dirArg, `import-${pad(i + 1)}.jsonl`), t));
  if (redo) fs.writeFileSync(path.join(dirArg, "redo.jsonl"), redo);
  console.log(`exported ${report.exported} · ACCEPTED ${report.accepted} → ${files.length} import file(s) of ≤ ${max}`);
  console.log(`per column: ${Object.entries(report.perColumn).filter(([, n]) => n).map(([c, n]) => `${c} ${n}`).join(" · ") || "—"}`);
  const list = (label, xs, f) => { if (xs.length) { console.log(`${label} ${xs.length}:`); for (const x of xs.slice(0, 15)) console.log(`  ${f(x)}`); if (xs.length > 15) console.log(`  … ${xs.length - 15} more`); } };
  list("REJECTED", report.rejected, (r) => `${r.file}:${r.line} ${r.jobId ?? ""} — ${r.error}`);
  list("DUPLICATE (first kept)", report.duplicates, (r) => `${r.file}:${r.line} ${r.jobId}`);
  list("EMPTY (every value null — dropped)", report.emptyDropped, (r) => `${r.file}:${r.line} ${r.jobId}`);
  list("MISSING (never returned)", report.missing, (id) => id);
  list("UNREADABLE LINES (skipped)", report.junk, (j) => `${j.file}:${j.line} ${j.text}`);
  if (redo) console.log(`→ redo.jsonl holds the ${redo.trim().split("\n").length} posting(s) to fill again (split it like an export).`);
  console.log(`Upload each import-NNN.jsonl in Admin → Database → Enrichment Round Trip: Dry Run, then Apply Import.`);
} else usage();

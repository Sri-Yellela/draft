#!/usr/bin/env node
// ⭐ D195 (47a) · the source register gains a `teachingUse` per source — which of the content rule's layers it serves:
//   concept    a creator's explainer (a video, a talk) — "also watch" for layer 1
//   proof      the math / the system underneath (a textbook, a course, a reference, a standard) — layer 2
//   realWorld  where it runs (an engineering article, a report, the docs of the system itself) — layer 3
//   try        a hands-on step (a tutorial, a lab, a notebook, an interactive, open-source docs with runnable examples) — layer 3
// Derived from each row's recorded `types` (nothing invented); a row may serve several. Re-run after adding sources.
// node scripts/d195TeachingUse.mjs [--write]   (the file keeps its one-line format — dumps() from the D176-3 script)
import fs from "node:fs";
import { validateRegistry, teachingUseOf } from "../services/atlas/sourceRegistry.js";

// The register's own serialisation (Python's json.dumps(ensure_ascii=False)) — the same as scripts/d176RegisterLearnSources.mjs,
// copied rather than imported: importing that script runs it.
const esc = (x) => JSON.stringify(x);
function dumps(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.map(dumps).join(", ")}]`;
  if (typeof v === "object") return `{${Object.entries(v).map(([k, x]) => `${esc(k)}: ${dumps(x)}`).join(", ")}}`;
  return JSON.stringify(v);
}
const REG = "content/sources/registry.json";
const reg = JSON.parse(fs.readFileSync(REG, "utf8"));
reg.sources = reg.sources.map(s => {
  const { teachingUse: _old, ...rest } = s;
  const keys = Object.keys(rest);
  const at = keys.indexOf("types") + 1;           // keep the row readable: teachingUse right after types
  return Object.fromEntries([...keys.slice(0, at).map(k => [k, rest[k]]), ["teachingUse", teachingUseOf(s)], ...keys.slice(at).map(k => [k, rest[k]])]);
});
const v = validateRegistry(reg);
if (!v.ok) { console.error(v.problems.join("\n")); process.exit(1); }
const counts = {};
for (const s of reg.sources) for (const u of s.teachingUse) counts[u] = (counts[u] || 0) + 1;
console.log(`${reg.sources.length} sources ·`, counts);
if (process.argv.includes("--write")) { fs.writeFileSync(REG, dumps(reg)); console.log(`wrote ${REG}`); }

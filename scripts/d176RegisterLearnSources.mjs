#!/usr/bin/env node
// ⭐ D176-3 · register the Learn items' creators and sites in content/sources/registry.json (owner 11-07: "one row each").
//
//   node scripts/d176RegisterLearnSources.mjs            → prints what it would add (nothing written)
//   node scripts/d176RegisterLearnSources.mjs --write    → adds the rows
//
// Reads the Learn seed (content/learn/silicon-to-software.json) and resolves every item through
// services/atlas/learnSources.js. Each item that resolves to no row gets one: a CREATOR named on a search link, or a SITE
// by its host; plus `draft-original` for our own Build tasks. Every new row is `to-verify` (link-only until D176-1 reads
// its licence — the register's own rule), `pathways` from the path's parts, and `vendorNeutral` as a FIRST GUESS that
// D176-1 confirms (noted on the row). The file keeps its format (one line, as Python's json.dumps(ensure_ascii=False) writes it).
import fs from "node:fs";
import { registerIndex, itemSource, learnItems, OWN_SOURCE, slugOf } from "../services/atlas/learnSources.js";
import { validateRegistry } from "../services/atlas/sourceRegistry.js";

const REG = "content/sources/registry.json";
const SEED = "content/learn/silicon-to-software.json";
const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);

// The same serialisation as Python's json.dumps(obj, ensure_ascii=False) (", " and ": ", characters kept as written) — the
// file's own format; checked byte for byte below before anything is written.
const esc = (s) => JSON.stringify(s);
export function dumps(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return `[${v.map(dumps).join(", ")}]`;
  if (typeof v === "object") return `{${Object.entries(v).map(([k, x]) => `${esc(k)}: ${dumps(x)}`).join(", ")}}`;
  if (typeof v === "string") return esc(v);
  return JSON.stringify(v);
}

const raw = fs.readFileSync(REG, "utf8");
const reg = JSON.parse(raw);
if (dumps(reg) !== raw) { console.error("REFUSING: the register's format is not reproduced byte for byte — nothing written"); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(SEED, "utf8"));
const index = registerIndex(reg);

// A part's pathway: the path runs from hardware to software; its hardware parts are embedded's.
const partPathway = new Map();
for (const p of doc.PARTS) {
  const hw = /silicon|circuit|hardware|chip|electron|signal|fpga|asic/i.test(`${p.t} ${JSON.stringify(p.phases.map(ph => ph.t))}`);
  for (const ph of p.phases) for (const st of ph.steps) partPathway.set(st.id, hw ? ["embedded", "software"] : ["software"]);
}
const VENDORS = /^(ibm|anthropic|google|microsoft|amazon|aws|apple|nvidia|cloudflare|meta|oracle|intel|arm)\b/i;
const add = new Map();
const flagged = [];
for (const { stepId, item } of learnItems(doc)) {
  const s = itemSource(item, index);
  if (s.id) continue;
  if (s.flag === "needs_named_source") { flagged.push(`${stepId} · ${item.id} · ${item.t}`); continue; }
  const row = add.get(s.want) || {
    id: s.want,
    publisher: s.by === "creator" ? s.name.split(",")[0].trim() : s.host,
    name: s.by === "creator" ? s.name : s.host,
    url: s.by === "creator"
      ? (/youtube\.com/.test(item.u) ? `https://www.youtube.com/results?search_query=${encodeURIComponent(s.name)}`
        : /openlibrary\.org/.test(item.u) ? `https://openlibrary.org/search?q=${encodeURIComponent(s.name)}`
        : `https://www.google.com/search?q=${encodeURIComponent(s.name)}`)
      : `https://${s.host}/`,
    types: [], licence: "not read yet", licenceClass: "to-verify", accountNeeded: false,
    vendorNeutral: !VENDORS.test(s.by === "creator" ? s.name : s.host),
    pathways: [], topics: [], verified: "to-verify",
    notes: `Added ${TODAY} by D176-3 from the Learn path (${s.by === "creator" ? "a creator named on a search link" : "a site linked from it"}). Licence and vendorNeutral are a first guess — D176-1 reads and records them.`,
    creators: s.by === "creator" ? [s.name] : [],
  };
  const type = /video|talk|lecture/i.test(item.k) ? "video" : /book/i.test(item.k) ? "book" : /course/i.test(item.k) ? "course" : /tool|sim|practice|build|game/i.test(item.k) ? "interactive" : "article";
  if (!row.types.includes(type)) row.types.push(type);
  for (const pw of partPathway.get(stepId) || ["software"]) if (!row.pathways.includes(pw)) row.pathways.push(pw);
  if (row.creators && !row.creators.length) delete row.creators;
  add.set(s.want, row);
}
if (!index.ids.has(OWN_SOURCE)) {
  add.set(OWN_SOURCE, { id: OWN_SOURCE, publisher: "draft", name: "draft's own exercises", url: "https://jobsviadraft.com/atlas/learn",
    types: ["interactive"], licence: "draft's own work", licenceClass: "open-reuse", accountNeeded: false, vendorNeutral: true,
    pathways: ["software", "embedded"], topics: ["build tasks", "practice"], verified: TODAY,
    notes: "The Learn path's own Build and Practice tasks (no outside link). Written by draft; not adapted from any source." });
}

const next = { ...reg, updated: TODAY, sources: [...reg.sources, ...[...add.values()].sort((a, b) => a.id.localeCompare(b.id))] };
const v = validateRegistry(next);
console.log(JSON.stringify({ existing: reg.sources.length, adding: add.size, total: next.sources.length, flaggedNeedsNamedSource: flagged.length, valid: v.ok, problems: v.problems.slice(0, 5) }));
if (!v.ok) { console.error("REFUSING: the register would not validate — nothing written"); process.exit(1); }
if (WRITE) { fs.writeFileSync(REG, dumps(next)); console.log(`wrote ${REG}`); }
else console.log([...add.keys()].slice(0, 40).join(" · "));

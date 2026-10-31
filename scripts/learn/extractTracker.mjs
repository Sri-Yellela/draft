// scripts/learn/extractTracker.mjs — ⭐ D115 P1 · the owner's "From silicon to software" tracker → ONE data file.
//
// The tracker (docs/From silicon to software_ progress tracker.html, the owner's) keeps ALL its content in one data
// block of its script: the URL helpers, PARTS (parts → phases → steps → items + checkpoints), ATLAS (the 28 LeetCode
// patterns) and INDEX (the concept terms with the owner's own one-line definitions). This evaluates exactly that block
// — from the first URL helper to "Derived structures" — in an EMPTY Node vm context (no require, no process, no fs:
// it can only build arrays) and writes content/learn/silicon-to-software.json.
//   · IDs are kept exactly (p1, s1, s1-code …) — progress and links never break
//   · VERBATIM: titles, goals, notes, checkpoints, definitions are the owner's words, unchanged
//   · re-run after the owner edits the HTML: the added / removed IDs are printed
// ⭐ D118 P2: the text work (the block's markers, the page's copy, the counts, the ids) is shared/learnTracker.js — the
// SAME extractor Admin → Atlas → Import content runs in the owner's browser. In production the database is the source
// (learn_content, migration 198); this file seeds it on a first install only (services/learn/learnImport.js).
// ⚠ content/, not data/ (the spec's path): data/ is git-ignored (it holds the live database), so a file there would
// never reach production.
//
//   node scripts/learn/extractTracker.mjs [--html <path>] [--out <path>] [--check]
//     --check   extract and compare with the file on disk; exit 1 if they differ (nothing written)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { dataBlockOf, DATA_RESULT, plainData, countsOf, idsOf, extractCopy, assembleLearnFile } from "../../shared/learnTracker.js";

export { countsOf, idsOf, extractCopy };
export const TRACKER_HTML = "docs/From silicon to software_ progress tracker.html";
export const LEARN_JSON = "content/learn/silicon-to-software.json";

/** The tracker's data, from its HTML. Pure apart from the vm. */
export function extractTracker(html) {
  const code = `${dataBlockOf(html)}\n;${DATA_RESULT};`;
  const out = vm.runInNewContext(code, Object.create(null), { timeout: 2000 });
  // Through JSON: plain data only, nothing from the vm's realm survives.
  return plainData(out);
}

export function buildLearnFile(html, { sourceName = path.basename(TRACKER_HTML), at = new Date().toISOString().slice(0, 10) } = {}) {
  return assembleLearnFile(html, extractTracker(html), { sourceName, at });
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1:")}` || process.argv[1]?.endsWith("extractTracker.mjs")) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
  const htmlPath = arg("--html", TRACKER_HTML), outPath = arg("--out", LEARN_JSON);
  const next = buildLearnFile(fs.readFileSync(htmlPath, "utf8"));
  const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : null;
  if (prev) {
    const was = new Set(idsOf(prev)), now = new Set(idsOf(next));
    const added = [...now].filter(i => !was.has(i)), removed = [...was].filter(i => !now.has(i));
    console.log(`ids: +${added.length} ${added.slice(0, 40).join(" ")}`);
    console.log(`ids: -${removed.length} ${removed.slice(0, 40).join(" ")}${removed.length ? "  ⚠ progress on these ids no longer has a place" : ""}`);
  }
  console.log("counts:", JSON.stringify(next.source.counts));
  const same = prev && JSON.stringify({ ...prev, source: { ...prev.source, extracted: null } }) === JSON.stringify({ ...next, source: { ...next.source, extracted: null } });
  if (process.argv.includes("--check")) { console.log(same ? "up to date" : "DIFFERS from the HTML"); process.exit(same ? 0 : 1); }
  if (same) { console.log("unchanged — not rewritten"); }
  else { fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, JSON.stringify(next, null, 1) + "\n"); console.log(`wrote ${outPath}`); }
}

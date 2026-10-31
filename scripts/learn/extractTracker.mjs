// scripts/learn/extractTracker.mjs — ⭐ D115 P1 · the owner's "From silicon to software" tracker → ONE data file.
//
// The tracker (docs/From silicon to software_ progress tracker.html, the owner's) keeps ALL its content in one data
// block of its script: the URL helpers, PARTS (parts → phases → steps → items + checkpoints), ATLAS (the 28 LeetCode
// patterns) and INDEX (the concept terms with the owner's own one-line definitions). This evaluates exactly that block
// — from the first URL helper to "Derived structures" — in an EMPTY Node vm context (no require, no process, no fs:
// it can only build arrays) and writes content/learn/silicon-to-software.json, which the app reads.
//   · IDs are kept exactly (p1, s1, s1-code …) — progress and links never break
//   · VERBATIM: titles, goals, notes, checkpoints, definitions are the owner's words, unchanged
//   · re-run after the owner edits the HTML: the added / removed IDs are printed
// ⚠ content/, not data/ (the spec's path): data/ is git-ignored (it holds the live database), so a file there would
// never reach production.
//
//   node scripts/learn/extractTracker.mjs [--html <path>] [--out <path>] [--check]
//     --check   extract and compare with the file on disk; exit 1 if they differ (nothing written)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const TRACKER_HTML = "docs/From silicon to software_ progress tracker.html";
export const LEARN_JSON = "content/learn/silicon-to-software.json";
const START = "var yt = function";
const END = "/* ======================= Derived structures";

/** The tracker's data, from its HTML. Pure apart from the vm. */
export function extractTracker(html) {
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error("the tracker's data block was not found (its markers moved)");
  const code = `${html.slice(a, b)}\n;({ PARTS: PARTS, ATLAS: ATLAS, INDEX: INDEX });`;
  const out = vm.runInNewContext(code, Object.create(null), { timeout: 2000 });
  // Through JSON: plain data only, nothing from the vm's realm survives.
  return JSON.parse(JSON.stringify({ PARTS: out.PARTS, ATLAS: out.ATLAS, INDEX: out.INDEX }));
}

/** The counts the source line and the tests check. */
export function countsOf({ PARTS, ATLAS, INDEX }) {
  const phases = PARTS.flatMap(p => p.phases || []);
  const steps = phases.flatMap(ph => ph.steps || []);
  const items = steps.flatMap(s => s.items || []);
  const byKind = {};
  for (const it of items) byKind[it.k] = (byKind[it.k] || 0) + 1;
  return {
    parts: PARTS.length, phases: phases.length, steps: steps.length, items: items.length,
    optional: items.filter(it => it.o).length, checkpoints: steps.reduce((n, s) => n + (s.c || []).length, 0),
    advancedSteps: steps.filter(s => s.lv === "a").length, basicsSteps: steps.filter(s => s.lv === "b").length,
    patterns: ATLAS.length, concepts: INDEX.length, byKind,
  };
}

/** Every id in the data: parts have none (their position is their id), so phases, steps, items, patterns. */
export function idsOf({ PARTS, ATLAS }) {
  const ids = [];
  for (const p of PARTS) for (const ph of p.phases || []) {
    ids.push(ph.id);
    for (const s of ph.steps || []) { ids.push(s.id); for (const it of s.items || []) ids.push(it.id); }
  }
  for (const a of ATLAS) ids.push(`pattern:${a.id}`);
  return ids;
}

/**
 * The page's own words around the data (D115 P2: "the tracker's intro text is kept") — the title, the lede, the
 * legend, each view's intro and the footer's note about links. Text only, the owner's words verbatim (tags dropped,
 * entities decoded).
 */
export function extractCopy(html) {
  const text = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  const grab = (re) => { const m = html.match(re); if (!m) throw new Error(`the tracker's copy moved: ${re}`); return text(m[1]); };
  const intro = (panel) => grab(new RegExp(`id="panel-${panel}"[\\s\\S]*?<p class="intro">([\\s\\S]*?)</p>`));
  return {
    title: grab(/<h1>([\s\S]*?)<\/h1>/).replace(/(silicon)(to)/, "$1 $2"),
    lede: grab(/<p class="lede">([\s\S]*?)<\/p>/),
    legend: grab(/<p class="legend">([\s\S]*?)<\/p>/),
    intros: { path: intro("path"), patterns: intro("atlas"), concepts: intro("index") },
    linksNote: grab(/<p id="status">[\s\S]*?<\/p>\s*<p>([\s\S]*?)<\/p>/),
  };
}

export function buildLearnFile(html, { sourceName = path.basename(TRACKER_HTML), at = new Date().toISOString().slice(0, 10) } = {}) {
  const data = extractTracker(html);
  return { source: { file: sourceName, extracted: at, counts: countsOf(data) }, copy: extractCopy(html), ...data };
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

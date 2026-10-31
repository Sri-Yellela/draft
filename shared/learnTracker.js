// shared/learnTracker.js — ⭐ D115 P1 / D118 P2 · THE tracker extractor, ONE implementation for both places it runs:
//   · scripts/learn/extractTracker.mjs (Node) — evaluates the data block in an EMPTY vm context
//   · Admin → Atlas → Import content (client/src/panels/adminLearnImport.jsx) — evaluates it in the OWNER'S BROWSER, in a
//     sandboxed iframe with no origin, no network and no access to the page
// Everything here is pure text work (no eval, no DOM, no Node): finding the data block, reading the page's own words,
// the counts and the ids. HOW the data block is evaluated is the caller's — ⛔ the SERVER never evaluates it: an upload
// reaches the server as JSON only (services/learn/learnImport.js validates it; d118ServerNeverEvaluatesUpload).

export const DATA_START = "var yt = function";
export const DATA_END = "/* ======================= Derived structures";
/** What the evaluated block must hand back — appended to the block by both callers. */
export const DATA_RESULT = "({ PARTS: PARTS, ATLAS: ATLAS, INDEX: INDEX })";

/** The tracker's data block — the URL helpers through PARTS / ATLAS / INDEX — as source text (NOT evaluated here). */
export function dataBlockOf(html) {
  const s = String(html ?? "");
  const a = s.indexOf(DATA_START), b = s.indexOf(DATA_END);
  if (a < 0 || b < 0 || b < a) throw new Error("the tracker's data block was not found (its markers moved)");
  return s.slice(a, b);
}

/** Plain data only: through JSON, so nothing from the evaluating realm (functions, prototypes, getters) survives. */
export function plainData(out) {
  if (!out || typeof out !== "object") throw new Error("the tracker's data block gave nothing back");
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

/** The data file's shape: a source line, the page's copy, and the three arrays. */
export function assembleLearnFile(html, data, { sourceName, at }) {
  return { source: { file: sourceName, extracted: at, counts: countsOf(data) }, copy: extractCopy(html), ...data };
}

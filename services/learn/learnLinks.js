// services/learn/learnLinks.js — ⭐ D115 P4 (b)–(d) · the owner's tracker LINKED INTO THE ATLAS.
//   (b) learnStepForNode — the step that teaches a node: "Learn it: Part 3 · Data structures · Step 2", shown at the
//       top of the node's Resources (computed when the page is read — never a stored resource, so it follows the
//       tracker when the owner edits it)
//   (c) importLearnPatterns — the 28 LeetCode patterns as `pattern` nodes: the owner's one line as the definition, the
//       practice problems as Practice resources (links to LeetCode), used_with edges to the data structures their
//       name and idea mention (edge source 'owner' — the owner wrote the tracker; atlas_edges admits no other)
//   (d) the same step is where D114's popup "Learn it in the Atlas" goes (atlasLinks.peekNode)
// Terms are matched through the ONE normaliser (shared/atlasSearchNormalize.js). ⛔ No model (D17).
import { learnContent, stepsOf } from "./learnContent.js";
import { searchKey, searchWords } from "../../shared/atlasSearchNormalize.js";
import { upsertNode, addEdge, slugOf, aliasesOf } from "../atlas/atlasStore.js";

export const LEARN_SOURCE = "learn";
const bare = (t) => String(t).replace(/\s*\([^)]*\)\s*$/, "").trim();

let cache = null;
function indexes(learn) {
  if (cache && cache.learn === learn) return cache;
  const steps = new Map();
  learn.PARTS.forEach((part, pi) => (part.phases || []).forEach(ph => (ph.steps || []).forEach((s, si) => {
    steps.set(s.id, { stepId: s.id, part: pi + 1, phase: ph.t, step: si + 1, title: s.t,
      label: `Part ${pi + 1} · ${ph.t} · Step ${si + 1}` });
  })));
  const byKey = new Map();   // a term's key → its step (the INDEX first, then the patterns)
  for (const t of learn.INDEX || []) for (const k of [searchKey(t.term), searchKey(bare(t.term))]) if (k && !byKey.has(k) && steps.has(t.st)) byKey.set(k, t.st);
  for (const p of learn.ATLAS || []) { const k = searchKey(p.n); if (k && !byKey.has(k) && steps.has(p.st)) byKey.set(k, p.st); }
  cache = { learn, steps, byKey };
  return cache;
}

/** The step that teaches this node, or null. @param node { slug, name, term } */
export function learnStepForNode(db, node, learn = learnContent(db)) {
  if (!node) return null;
  const { steps, byKey } = indexes(learn);
  const keys = [node.name, node.term, ...(node.term ? aliasesOf(db, node.term) : [])].map(searchKey).filter(Boolean);
  for (const k of keys) { const st = byKey.get(k); if (st) return steps.get(st); }
  return null;
}

/**
 * ⭐ D178 · THE CONCEPT INDEX JOINS THE GLOSSARY (the translation table: "Concept index tab → merges into Explore →
 * Glossary: each concept keeps its links to the lessons that teach it"). Pure over the Glossary's terms and the Learn
 * document: a concept with the same name as an Atlas term (the ONE normaliser) gives that term its lesson (`learn`);
 * every other concept becomes its own row — its words, its lesson. Nothing dropped: a concept whose step is gone keeps
 * its meaning with `learn: null`.
 * @returns {{ terms: [{ ...term, learn? }], concepts: [{ name, meaning, learn }] }}
 */
export function glossaryConcepts(terms, learn) {
  const { steps } = indexes(learn);
  const step = (id) => { const s = steps.get(id); return s ? { stepId: s.stepId, label: s.label } : null; };
  const byKey = new Map();
  for (const c of learn.INDEX || []) for (const k of [searchKey(c.term), searchKey(bare(c.term))]) if (k && !byKey.has(k)) byKey.set(k, c);
  const used = new Set();
  const out = (terms || []).map(t => {
    const c = byKey.get(searchKey(t.name));
    if (!c) return t;
    used.add(c);
    const s = step(c.st);
    return s ? { ...t, learn: s } : t;
  });
  const concepts = (learn.INDEX || []).filter(c => !used.has(c)).map(c => ({ name: c.term, meaning: c.def || "", learn: step(c.st) }));
  return { terms: out, concepts };
}

/** A step by its id, in the same shape — { stepId, part, phase, step, title, label } — or null. */
export function learnStepInfo(learn, stepId) {
  return indexes(learn).steps.get(stepId) || null;
}

/** The learn page's address for a step — the Atlas base is the caller's (/atlas or /app/atlas). */
export const learnStepPath = (stepId) => `/learn#step-${encodeURIComponent(stepId)}`;

/** @returns {{ created: string[], promoted: string[], resources: number, edges: number }} — idempotent */
export function importLearnPatterns(db, learn = learnContent(db)) {
  const out = { created: [], promoted: [], resources: 0, edges: 0 };
  const targets = db.prepare(`SELECT id, name FROM atlas_nodes WHERE kind IN ('concept', 'skill') AND LENGTH(name) >= 4`).all()
    .map(n => ({ id: n.id, words: searchWords(n.name).join(" ") })).filter(n => n.words);
  const putRes = db.prepare(`INSERT OR IGNORE INTO atlas_resources (node_id, url, title, format, cost, added_by, source) VALUES (?,?,?,?,?,?,?)`);
  const ownDef = db.prepare(`UPDATE atlas_nodes SET definition_by = 'owner' WHERE id = ? AND definition IS NOT NULL AND definition_by IS NULL`);
  const promote = db.prepare(`UPDATE atlas_nodes SET kind = 'pattern', updated_at = unixepoch() WHERE id = ? AND kind = 'concept' AND source = '${LEARN_SOURCE}'`);
  db.transaction(() => {
    for (const p of learn.ATLAS || []) {
      if (!p?.n) continue;
      const r = upsertNode(db, { kind: "pattern", name: p.n, source: LEARN_SOURCE, definition: String(p.line || "").trim() || null });
      if (r.created) { out.created.push(slugOf(p.n)); ownDef.run(r.id); }
      // The same idea in both of the owner's lists (measured: Binary search, Backtracking, Divide and conquer, Dynamic
      // programming are INDEX terms too) is ONE page — the concept becomes the pattern; its definition stays.
      else if (promote.run(r.id).changes) out.promoted.push(slugOf(p.n));
      for (const [title, slug] of p.pr || []) {
        if (!/^[a-z0-9-]+$/.test(String(slug))) continue;
        out.resources += putRes.run(r.id, `https://leetcode.com/problems/${slug}/`, String(title), "practice", "free", "learn:tracker", LEARN_SOURCE).changes;
      }
      const text = ` ${searchWords(`${p.n} . ${p.idea || ""}`).join(" ")} `;
      for (const t of targets.filter(t => text.includes(` ${t.words} `)).slice(0, 6)) if (addEdge(db, r.id, t.id, "used_with", "owner")) out.edges++;
    }
  })();
  return out;
}

export { stepsOf };

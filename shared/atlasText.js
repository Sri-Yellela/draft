// shared/atlasText.js — ⭐ 47o (owner 11-27, docs/ATLAS_WIKI_PLAN_47o.md W1 + W4) · THE ONE LINKER FOR ATLAS TEXT.
//
// The Atlas as a wiki: a word in any Atlas text (an entry's meaning, a lesson, a route, a deck, an answer) links to the ONE
// entry for its meaning, and every surface links it the same way. Pure: text + the terms in, segments out.
//
// The terms come from GET /api/atlas/text-terms (services/atlas/atlasSenses.js atlasTextData):
//   { terms:  [{ slug, name, kind, forms: [{ text, exactCase }] }],          — one meaning per word: linked straight
//     senses: [{ word, slug, forms, senses: [{ slug, name, cues, domains }] }] — a word with several meanings (kernel), or
//                                                                               one meaning that is also everyday English
//                                                                               (Go, Spark, Lean): resolved below }
// Placing a word in the text is shared/atlasLinks.js linkSegments (longest first — "CUDA kernel" is a form of Compute kernel
// and claims its words before "kernel" can; whole words; exactCase; no concept inside a common phrase; first occurrence).
// A SENSE WORD then picks its entry by the owner-approved rules (47o, the example's five):
//   1. a longer phrase with its own entry wins                       — done by linkSegments' longest-first
//   2. the words next to it decide: a sense whose cue is within SENSE_WINDOW words ("operating-system kernel")
//   3. else the page's domain decides: a sense whose domains hold the page's family or category
//   4. a word with one meaning links straight to it — unless it is also everyday English (one sense in a group): then only
//      rule 2 (its cues beside it) links it, and otherwise it stays plain text ("Go to the store" never links Go)
//   5. otherwise the link opens the word's disambiguation page (/atlas/<word>) — never a guess
// ⛔ No model (D190): plain text matching. ⛔ The text is never changed: the segments, joined, are the input exactly.
import { linkSegments } from "./atlasLinks.js";
import { foldChars } from "./atlasSearchNormalize.js";

export const SENSE_WINDOW = 4;
const SENSE_PREFIX = "sense:";

const wordsOf = (s) => foldChars(String(s || "")).split(/[^a-z0-9+#]+/).filter(Boolean);

/** Rule 2's window: the folded words within `n` words before and after [a, b) in `text`. */
export function windowWords(text, a, b, n = SENSE_WINDOW) {
  const before = wordsOf(text.slice(0, a)).slice(-n);
  const after = wordsOf(text.slice(b)).slice(0, n);
  return [...before, ...after];
}

const cueHits = (sense, near) => {
  const set = new Set(near);
  const joined = ` ${near.join(" ")} `;
  let hits = 0;
  for (const c of sense.cues || []) {
    const w = wordsOf(c);
    if (!w.length) continue;
    if (w.length === 1 ? set.has(w[0]) : joined.includes(` ${w.join(" ")} `)) hits++;
  }
  return hits;
};

/**
 * Which entry a sense word at [a, b) of `text` means.
 * @returns {{ slug: string, disambiguation?: true } | null} — null: leave it as plain text
 */
export function resolveSense(group, text, a, b, { domain = [] } = {}) {
  const senses = group?.senses || [];
  if (!senses.length) return null;
  const near = windowWords(text, a, b);
  const scored = senses.map(s => ({ s, hits: cueHits(s, near) })).filter(x => x.hits > 0).sort((x, y) => y.hits - x.hits);
  if (scored.length && (scored.length === 1 || scored[0].hits > scored[1].hits)) return { slug: scored[0].s.slug };   // rule 2
  if (senses.length === 1) return null;   // rule 4: one meaning that is everyday English links only beside its cues
  const doms = new Set((Array.isArray(domain) ? domain : [domain]).filter(Boolean));
  const byDomain = senses.filter(s => (s.domains || []).some(d => doms.has(d)));
  if (byDomain.length === 1) return { slug: byDomain[0].slug };                                                       // rule 3
  return { slug: group.slug, disambiguation: true };                                                                  // rule 5
}

/**
 * Atlas text with its terms linked.
 * @param text  the text as drawn
 * @param data  { terms, senses } from GET /api/atlas/text-terms
 * @param opts  { used: Set (carried across one page's blocks), self: slug never linked (the page's own entry),
 *                domain: [family key, category …] of the page, max: most links in this text }
 * @returns [{ text, slug?, disambiguation? }] — joined, exactly `text`
 */
// ⭐ The prefilter (measured 47o at production size: 1,777 terms → 5.5 ms per block without it): the terms are indexed once
// per data object by the first word of each form, and a text tries only the terms whose first word it holds. A word keeps
// an inner dot ("node.js") but never a sentence's full stop ("GPU." is "gpu").
const tokens = (s) => foldChars(String(s || "")).split(/[^a-z0-9+#.]+/).map(w => w.replace(/\.+$/, "")).filter(Boolean);
const prepared = new WeakMap();
function prepare(data) {
  let p = prepared.get(data);
  if (p) return p;
  const index = new Map();
  const add = (w, t) => { if (!w) return; if (!index.has(w)) index.set(w, []); index.get(w).push(t); };
  const groups = new Map((data?.senses || []).map(g => [SENSE_PREFIX + g.word, g]));
  for (const t of data?.terms || []) for (const f of t.forms || []) add(tokens(f.text)[0], t);
  for (const [slug, g] of groups) { const t = { slug, kind: "concept", forms: g.forms || [] }; for (const f of t.forms) add(tokens(f.text)[0], t); }
  p = { index, groups };
  prepared.set(data, p);
  return p;
}
function candidates(s, p, self) {
  const seen = new Set();
  for (const w of tokens(s)) for (const v of [w, w.replace(/^\.+/, "")]) for (const t of p.index.get(v) || []) if (t.slug !== self) seen.add(t);
  return [...seen];
}

export function linkAtlasText(text, data, { used = new Set(), self = null, domain = [], max = Infinity } = {}) {
  const s = String(text ?? "");
  if (!s || !data) return [{ text: s }];
  const p = (data && typeof data === "object") ? prepare(data) : { index: new Map(), groups: new Map() };
  const groups = p.groups;
  const terms = candidates(s, p, self);
  if (!terms.length) return [{ text: s }];
  const segs = linkSegments(s, terms, used);
  let at = 0, links = 0;
  const out = [];
  const plain = (t) => { const last = out[out.length - 1]; if (last && !last.slug) last.text += t; else out.push({ text: t }); };
  for (const seg of segs) {
    const a = at, b = at + seg.text.length;
    at = b;
    if (!seg.slug) { plain(seg.text); continue; }
    let link = { slug: seg.slug };
    if (seg.slug.startsWith(SENSE_PREFIX)) link = resolveSense(groups.get(seg.slug), s, a, b, { domain });
    if (!link || link.slug === self || links >= max) { plain(seg.text); continue; }
    links++;
    used.add(link.slug);
    out.push({ text: seg.text, ...link });
  }
  return out.length ? out : [{ text: s }];
}

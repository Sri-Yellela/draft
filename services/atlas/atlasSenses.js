// services/atlas/atlasSenses.js — ⭐ 47o (owner 11-27, docs/ATLAS_WIKI_PLAN_47o.md W1 / W4 / W6) · ONE ENTRY PER MEANING.
//
// atlasTextData(db)  — what GET /api/atlas/text-terms serves to the one Atlas-text linker (shared/atlasText.js):
//   terms  — every published node and its forms (atlasLinks.js's one cache), one meaning per word, linked straight;
//   senses — the SENSE WORDS: published nodes sharing `sense_of` (migration 284) are the meanings of one word ("kernel":
//            Kernel (operating system) · Compute kernel · Kernel method), each with the cues and domains that pick it;
//            a group of ONE is a meaning that is also everyday English (Go, Rust, Spark, Lean, R) — linked only when its
//            cues are next to it. The bare word is taken out of a sense node's own forms, so only the resolver links it.
//   ⛔ A word on the scorer's ambiguous list (postingMatcher.js AMBIGUOUS_TERMS) with no sense data is never linked in
//   Atlas text (the posting linker still links it from a posting's own skill list).
// wordPage(db, word) — the disambiguation page: a word's meanings (2+), each with its one line and family (W4 rule 5).
// senseWordOf(db, term) — a word with 2+ meanings → its page slug (resolve / search send a bare "kernel" there, W6).
// redirectOf(db, slug) — a merged or renamed entry's old address → its entry (atlas_redirects, migration 284).
// ⛔ No model (D190). Cached on the linkable cache's key (any publish, rename or alias changes it).
import { AMBIGUOUS_TERMS } from "./postingMatcher.js";
import { linkableNodeList, meaningOf } from "./atlasLinks.js";
import { slugOf } from "./atlasStore.js";
import { foldChars } from "../../shared/atlasSearchNormalize.js";

export const fold = (s) => foldChars(String(s ?? "")).trim();
const parse = (j) => { try { const v = JSON.parse(j || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };
const hasSenseColumns = (db) => db.prepare(`PRAGMA table_info(atlas_nodes)`).all().some(c => c.name === "sense_of");

function senseRows(db) {
  if (!hasSenseColumns(db)) return [];
  return db.prepare(`SELECT id, slug, name, family, sense_of, sense_cues, sense_domains FROM atlas_nodes
    WHERE status = 'published' AND sense_of IS NOT NULL AND TRIM(sense_of) != ''`).all();
}

/** The page slug of a sense word — its own slug, never an entry's ("kernel"). */
export const wordSlug = (word) => slugOf(word);

let memo = { key: null, db: null, data: null };
export function atlasTextData(db) {
  const { key, nodes } = linkableNodeList(db);
  if (memo.key === key && memo.db === db) return memo.data;
  const sense = new Map(senseRows(db).map(r => [r.id, r]));
  const groups = new Map();   // fold(word) → { word, slug, forms, senses }
  const terms = [];
  for (const n of nodes) {
    const sr = sense.get(n.id);
    if (sr) {
      const w = String(sr.sense_of).trim();
      const k = fold(w);
      if (!groups.has(k)) groups.set(k, { word: w, slug: wordSlug(w), forms: [{ text: w, exactCase: /[A-Z]/.test(w) }], senses: [] });
      groups.get(k).senses.push({ slug: n.slug, name: n.name, cues: parse(sr.sense_cues), domains: parse(sr.sense_domains) });
      const forms = n.forms.filter(f => fold(f.text) !== k);
      if (forms.length) terms.push({ slug: n.slug, name: n.name, kind: n.kind, forms });
      continue;
    }
    if (AMBIGUOUS_TERMS.has(n.term)) continue;
    terms.push({ slug: n.slug, name: n.name, kind: n.kind, forms: n.forms });
  }
  const data = { version: key, terms, senses: [...groups.values()] };
  memo = { key, db, data };
  return data;
}

/** A word with two or more meanings → { word, slug, senses: [{ slug, name, kind, meaning, family }] }; else null. */
export function wordPage(db, word) {
  const k = fold(String(word ?? "").replace(/-/g, " "));
  if (!k) return null;
  const g = atlasTextData(db).senses.find(x => fold(x.word) === k || x.slug === String(word));
  if (!g || g.senses.length < 2) return null;
  const read = db.prepare(`SELECT n.slug, n.name, n.kind, n.family, n.definition, w.extract AS wikiExtract, w.page_url AS wikiPageUrl
    FROM atlas_nodes n LEFT JOIN atlas_wiki_cache w ON w.node_id = n.id WHERE n.slug = ? AND n.status = 'published'`);
  const senses = g.senses.map(s => read.get(s.slug)).filter(Boolean)
    .map(r => ({ slug: r.slug, name: r.name, kind: r.kind, family: r.family || null, meaning: meaningOf(r).meaning }));
  return senses.length >= 2 ? { word: g.word, slug: g.slug, senses } : null;
}

/** A bare word with 2+ meanings → its disambiguation slug ("kernel"); else null. */
export function senseWordOf(db, term) {
  const k = fold(term);
  if (!k) return null;
  const g = atlasTextData(db).senses.find(x => fold(x.word) === k);
  return g && g.senses.length >= 2 ? g.slug : null;
}

/** A merged or renamed entry's old address → the entry's slug (one hop); else null. */
export function redirectOf(db, slug) {
  try { return db.prepare(`SELECT to_slug FROM atlas_redirects WHERE from_slug = ?`).pluck().get(String(slug)) || null; }
  catch { return null; }   // a database from before migration 284
}

/**
 * The wiki's hatnote on an entry that is one meaning of a word with several: { word, slug, count } — "kernel has 3
 * meanings — see them all". null for an entry with no other meaning.
 */
export function otherMeaningsOf(db, slug) {
  const g = atlasTextData(db).senses.find(x => x.senses.length >= 2 && x.senses.some(s => s.slug === slug));
  return g ? { word: g.word, slug: g.slug, count: g.senses.length } : null;
}

// services/atlas/atlasLearnImport.js — ⭐ D115 P4(a) · THE OWNER'S 385 DEFINITIONS FILL THE ATLAS.
//
// Each INDEX term of the tracker (content/learn/silicon-to-software.json) is resolved to an Atlas node through the ONE
// normaliser (shared/atlasSearchNormalize.js searchKey) against each node's name, term and confirmed aliases
// (skill_synonyms) — the term as written, then without a trailing "(…)":
//   · resolved, and the node has NO definition → the tracker's goes in, definition_by = 'owner' (the owner wrote it), so
//     it counts for auto-publish at once; a node that already has one — typed, accepted or drafted — is never touched
//   · not resolved → a new CONCEPT node (a draft; published by the usual bar or by hand), with the definition
//   · ⛔ never resolved through the scorer's ambiguous words (atlasStats AMBIGUOUS_TERMS): measured 10-31, "SWIFT" (the
//     banking network) resolved onto the Swift language; and a term whose slug is already a DIFFERENT node is left out
//     and reported, never written onto it
// Idempotent: a second run changes nothing. Runs at boot after the registry seed. ⛔ No model (D17): the owner's words.

import { AMBIGUOUS_TERMS } from "./atlasStats.js";
import { aliasesOf, upsertNode, termOf, slugOf } from "./atlasStore.js";
import { searchKey } from "../../shared/atlasSearchNormalize.js";

export const LEARN_SOURCE = "learn";
const bare = (t) => String(t).replace(/\s*\([^)]*\)\s*$/, "").trim();

export const LEARN_PUBLISHER = "learn:owner-10-31";

/**
 * ⭐ Owner 10-31: "publish as learning pages for the 373". Every concept from the tracker is published — not by the
 * board's count (atlasPublish.js keeps concepts out of the bar: their word counts were measured false), but as a
 * learning page by the owner's word. A concept a person unpublished stays unpublished. Idempotent.
 * @returns {{ published: number }}
 */
export function publishLearnConcepts(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const r = db.prepare(`UPDATE atlas_nodes SET status = 'published', published_at = ?, published_by = ?, updated_at = ?
    WHERE kind = 'concept' AND source = '${LEARN_SOURCE}' AND status = 'draft' AND unpublished_by IS NULL
      AND TRIM(COALESCE(definition, '')) != ''`).run(now, LEARN_PUBLISHER, now);
  return { published: r.changes };
}

/** @returns {{ filled: string[], created: string[], kept: string[], skipped: { term, why }[] }} */
export function importLearnConcepts(db, learn) {
  const nodes = db.prepare(`SELECT id, slug, name, term, definition, definition_draft FROM atlas_nodes`).all();
  const byKey = new Map();
  for (const n of nodes) {
    if (AMBIGUOUS_TERMS.has(n.term)) continue;
    for (const k of [n.name, n.term, ...aliasesOf(db, n.term)]) { const key = searchKey(k); if (key && !byKey.has(key)) byKey.set(key, n); }
  }
  const fill = db.prepare(`UPDATE atlas_nodes SET definition = ?, definition_by = 'owner', updated_at = unixepoch() WHERE id = ?
    AND TRIM(COALESCE(definition, '')) = '' AND definition_draft IS NULL`);
  const out = { filled: [], created: [], kept: [], skipped: [] };
  db.transaction(() => {
    for (const { term, def } of learn.INDEX || []) {
      const d = String(def ?? "").trim();
      if (!term || !d) continue;
      if (AMBIGUOUS_TERMS.has(termOf(term)) || AMBIGUOUS_TERMS.has(termOf(bare(term)))) { out.skipped.push({ term, why: "an ambiguous word (the scorer's list)" }); continue; }
      const node = byKey.get(searchKey(term)) || byKey.get(searchKey(bare(term)));
      if (node) {
        if (fill.run(d, node.id).changes) out.filled.push(node.slug); else out.kept.push(node.slug);
        continue;
      }
      const clash = db.prepare(`SELECT slug, kind, source FROM atlas_nodes WHERE slug = ?`).get(slugOf(term));
      if (clash && clash.source !== LEARN_SOURCE) { out.skipped.push({ term, why: `its slug is already the ${clash.kind} "${clash.slug}"` }); continue; }
      const r = upsertNode(db, { kind: "concept", name: term, source: LEARN_SOURCE, definition: d });
      if (r.created) {
        db.prepare(`UPDATE atlas_nodes SET definition_by = 'owner' WHERE id = ?`).run(r.id);
        out.created.push(slugOf(term));
      } else if (fill.run(d, r.id).changes) out.filled.push(slugOf(term));
      else out.kept.push(slugOf(term));
    }
  })();
  return out;
}

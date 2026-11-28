// services/atlas/atlasCurated.js — ⭐ 47o (owner 11-27, docs/ATLAS_WIKI_PLAN_47o.md W4 + W5) · THE CURATED WIKI FILE.
//
// content/atlas/curated-wiki-v1.json goes in at boot, after the other Atlas seeds:
//   entries — the hub entries (CPU, Monte Carlo method, Statistics …) and the meanings of a word with several (Kernel
//             (operating system) · Compute kernel · Kernel method): created or found by slug, PUBLISHED (the owner's word,
//             11-27), their definition / family / aliases / sense filled only where empty — a curator's edit wins
//   senses  — sense data on existing entries that are also everyday English (Go, Rust, Spark, R, Lean): linked in Atlas
//             text only beside their cues (shared/atlasText.js rule 4)
//   aliases — more names for an existing entry
//   renames — a name that could never match text (its brackets) → a plain one; the old address redirects
//   merges  — two entries for one meaning: the loser is UNPUBLISHED (unpublished_by, so neither the registry seed nor the
//             auto-publisher brings it back), its term becomes the winner's alias, its address redirects (atlas_redirects)
//   edges   — the hub's typed links (part_of / requires / used_with), source 'owner'
//   families — 47n's twelve empty families filled: a node goes to its family when unset or machine-set (registry,
//             families.json, the taxonomy) — a curator's family is never moved
// ⛔ IDEMPOTENT AND QUIET: a boot that finds everything in place writes NOTHING (no updated_at touched), so it moves no
// version key and starts no re-read (memory: board reads freeze the site). ⛔ No model (D190).
import fs from "node:fs";
import path from "node:path";
import { upsertNode, addEdge, addAlias, aliasesOf, termOf, slugOf } from "./atlasStore.js";
import { isFamily } from "../../shared/atlasFamilies.js";

export const CURATED_FILE = path.join(process.cwd(), "content", "atlas", "curated-wiki-v1.json");
export const CURATED_SOURCE = "curated";
export const CURATED_PUBLISHER = "curated:owner-11-27";
export const MERGE_UNPUBLISHER = "curated:merge-47o";

export function readCurated(file = CURATED_FILE) { return JSON.parse(fs.readFileSync(file, "utf8")); }

const hasSenses = (db) => db.prepare(`PRAGMA table_info(atlas_nodes)`).all().some(c => c.name === "sense_of");
const hasTable = (db, t) => !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(t);
const json = (a) => JSON.stringify((a || []).map(String));

/** @returns {{ created: string[], published: string[], filled: number, senses: number, aliases: number, renamed: string[], merged: string[], edges: number, refused: string[] }} */
export function importCurated(db, data = readCurated(), { now = Math.floor(Date.now() / 1000) } = {}) {
  const out = { created: [], published: [], filled: 0, senses: 0, aliases: 0, renamed: [], merged: [], edges: 0, placed: 0, refused: [] };
  const senseCols = hasSenses(db), redirects = hasTable(db, "atlas_redirects");
  const bySlug = db.prepare(`SELECT id, slug, kind, name, term, status, definition, family, family_by, unpublished_by${senseCols ? ", sense_of, sense_cues, sense_domains" : ""} FROM atlas_nodes WHERE slug = ?`);
  const touch = (id) => db.prepare(`UPDATE atlas_nodes SET updated_at = ? WHERE id = ?`).run(now, id);
  const alias = (n, a) => {
    const t = termOf(a);
    if (!t || t === n.term || aliasesOf(db, n.term).includes(t)) return;
    if (addAlias(db, n.id, a, CURATED_PUBLISHER)) out.aliases++;
  };
  const setSense = (n, s) => {
    if (!senseCols || !s?.word || n.sense_of) return;   // a curator's sense (or an earlier import) stays
    db.prepare(`UPDATE atlas_nodes SET sense_of = ?, sense_cues = ?, sense_domains = ? WHERE id = ?`).run(String(s.word), json(s.cues), json(s.domains), n.id);
    touch(n.id);
    out.senses++;
  };
  const redirect = (from, to) => {
    if (!redirects || !from || from === to) return;
    if (db.prepare(`SELECT 1 FROM atlas_nodes WHERE slug = ? AND status = 'published'`).get(from)) { out.refused.push(`${from} (a published entry has that address)`); return; }
    db.prepare(`INSERT OR IGNORE INTO atlas_redirects (from_slug, to_slug, created_at) VALUES (?, ?, ?)`).run(from, to, now);
  };
  db.transaction(() => {
    for (const e of data.entries || []) {
      const slug = slugOf(e.name);
      // a sense word's page is its own address — an entry may never hold it ("kernel")
      if (e.sense?.word && bySlug.get(slugOf(e.sense.word))) { out.refused.push(`${e.name} (the word ${e.sense.word} is an entry's address)`); continue; }
      const { created } = upsertNode(db, { kind: e.kind || "concept", name: e.name, source: CURATED_SOURCE, definition: e.definition || null, status: "draft" });
      const n = bySlug.get(slug);
      if (created) out.created.push(slug);
      if (!String(n.definition || "").trim() && e.definition) {
        db.prepare(`UPDATE atlas_nodes SET definition = ?, definition_by = 'owner', updated_at = ? WHERE id = ?`).run(e.definition, now, n.id);
        out.filled++;
      }
      if (e.family && isFamily(e.family) && !n.family && !n.family_by) {
        db.prepare(`UPDATE atlas_nodes SET family = ?, updated_at = ? WHERE id = ?`).run(e.family, now, n.id);
      }
      if (n.status === "draft" && !n.unpublished_by) {
        db.prepare(`UPDATE atlas_nodes SET status = 'published', published_at = ?, published_by = ?, updated_at = ? WHERE id = ?`).run(now, CURATED_PUBLISHER, now, n.id);
        out.published.push(slug);
      }
      for (const a of e.aliases || []) alias(n, a);
      setSense(bySlug.get(slug), e.sense);
    }
    for (const s of data.senses || []) {
      const n = bySlug.get(s.slug);
      if (!n) { out.refused.push(`${s.slug} (no such entry)`); continue; }
      setSense(n, s);
    }
    for (const a of data.aliases || []) {
      const n = bySlug.get(a.slug);
      if (!n) { out.refused.push(`${a.slug} (no such entry)`); continue; }
      for (const x of a.add || []) alias(n, x);
    }
    for (const r of data.renames || []) {
      const n = bySlug.get(r.slug);
      if (!n) { out.refused.push(`${r.slug} (no such entry)`); continue; }
      if (r.name && n.name !== r.name) {
        alias(n, n.name);   // the old name still finds it (the learn import resolves by name, term or alias)
        db.prepare(`UPDATE atlas_nodes SET name = ?, updated_at = ? WHERE id = ?`).run(r.name, now, n.id);
        out.renamed.push(r.slug);
      }
      if (r.family && isFamily(r.family) && !n.family && !n.family_by) db.prepare(`UPDATE atlas_nodes SET family = ?, updated_at = ? WHERE id = ?`).run(r.family, now, n.id);
      for (const from of r.redirectFrom || []) redirect(from, n.slug);
    }
    for (const m of data.merges || []) {
      const w = bySlug.get(m.winner), l = bySlug.get(m.loser);
      if (!w || !l) { if (!w) out.refused.push(`${m.winner} (no such entry)`); continue; }
      alias(w, l.term);
      for (const a of aliasesOf(db, l.term)) alias(w, a);
      if (l.status === "published") {
        db.prepare(`UPDATE atlas_nodes SET status = 'draft', unpublished_by = ?, unpublished_at = ?, updated_at = ? WHERE id = ?`).run(MERGE_UNPUBLISHER, now, now, l.id);
        out.merged.push(`${l.slug} → ${w.slug}`);
      }
      redirect(l.slug, w.slug);
    }
    // ⭐ 47n's empty families: placed when unset or machine-set (registry / families.json / taxonomy) — a curator's family never moves
    const place = db.prepare(`UPDATE atlas_nodes SET family = ?, family_by = 'curated', updated_at = ? WHERE slug = ?
      AND COALESCE(family, '') != ? AND (family_by IS NULL OR family_by IN ('registry', 'seed', 'taxonomy'))`);
    for (const [family, slugs] of Object.entries(data.families || {})) {
      if (!isFamily(family)) { out.refused.push(`${family} (no such family)`); continue; }
      for (const s of slugs) if (place.run(family, now, s, family).changes) out.placed++;
    }
    for (const e of data.edges || []) {
      const f = bySlug.get(e.from), t = bySlug.get(e.to);
      if (!f || !t) { out.refused.push(`${e.from} → ${e.to} (no such entry)`); continue; }
      if (addEdge(db, f.id, t.id, e.type, "owner")) out.edges++;
    }
  })();
  return out;
}

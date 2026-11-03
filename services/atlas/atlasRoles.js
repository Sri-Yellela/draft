// services/atlas/atlasRoles.js — ⭐ A112/Atlas (11-03) · THE BOARD'S OWN ROLES, and every role's alternate titles.
//
// The Atlas's roles came only from the scorer's registry (atlasSeed.js: each domain's suggested titles), and a posting
// found its role only by that role's own name (postingMatcher roleOf). Measured on the 44i crawl copy: 6,994 of 12,514
// active postings matched no role — "Machine Learning Engineer" (107) never reached ML Engineer, and Engineering Manager,
// Solutions Architect, Customer Success Manager and others had no node at all. content/atlas/roles.json (reviewed by the
// owner) lists those roles by family, with the alternate titles a posting may use:
//   seedBoardRoles   at boot: a missing role becomes a DRAFT role node, source 'board' (it publishes on its postings,
//                    D105 P12); a non-computing role takes its listed family when it has none, or only the registry's
//                    default (family_by 'seed' — a curator's choice wins); a computing role none (roles are not drawn)
//   roleTitles       slug → its alternate titles' terms, read by the ONE matcher's roleOf beside each role's own term
// The scorer's registry is never written. ⛔ No model (D17).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upsertNode, slugOf, termOf } from "./atlasStore.js";
import { isFamily, familyCategory } from "../../shared/atlasFamilies.js";

export const ROLES_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/atlas/roles.json");
export const BOARD_SOURCE = "board";

/** [{ family, name, slug, titles: string[] }] from the file. A role listed twice, or under no family, is refused. */
export function readBoardRoles(file = ROLES_FILE) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = [], seen = new Set();
  for (const [family, roles] of Object.entries(raw.roles || {})) {
    if (!isFamily(family)) throw new Error(`roles.json names an unknown family "${family}"`);
    for (const [name, spec] of Object.entries(roles)) {
      const slug = slugOf(name);
      if (!slug || seen.has(slug)) throw new Error(`roles.json lists "${name}" twice or without a name`);
      seen.add(slug);
      out.push({ family, name, slug, titles: (spec?.titles || []).map(String).filter(t => t.trim()) });
    }
  }
  return out;
}

let cached = null;
/** slug → [term] of each listed role's alternate titles (the file is read once per process). */
export function roleTitles(roles = null) {
  if (!roles && cached) return cached;
  const map = new Map();
  for (const r of roles || readBoardRoles()) {
    const terms = [...new Set(r.titles.map(termOf).filter(Boolean))];
    if (terms.length) map.set(r.slug, terms);
  }
  if (!roles) cached = map;
  return map;
}

/** @returns {{ created: string[], tagged: number }} */
export function seedBoardRoles(db, roles = readBoardRoles()) {
  const node = db.prepare(`SELECT id, kind FROM atlas_nodes WHERE slug = ?`);
  const tag = db.prepare(`UPDATE atlas_nodes SET family = ?, family_by = 'seed'
    WHERE id = ? AND kind = 'role' AND (family_by IS NULL OR family_by = 'registry')`);
  const created = [];
  let tagged = 0;
  db.transaction(() => {
    for (const r of roles) {
      const had = node.get(r.slug);
      if (had && had.kind !== "role") continue;          // the slug is another kind's: never re-typed
      const n = had ? { id: had.id, created: false } : upsertNode(db, { kind: "role", name: r.name, source: BOARD_SOURCE });
      if (n.created) created.push(r.slug);
      if (familyCategory(r.family) !== "computing") tagged += tag.run(r.family, n.id).changes;
    }
  })();
  return { created, tagged };
}

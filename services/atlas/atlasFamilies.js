// services/atlas/atlasFamilies.js — ⭐ D116 M1 · a node's FAMILY (ML · Systems · Infra · Data · Backend), stored on
// atlas_nodes (migration 201) and assigned ONCE per node:
//   seedAtlasFamilies   at boot, from content/atlas/families.json (drafted by the agent, reviewed by the owner) — fills
//                       only a node whose family_by is NULL, so a second run changes nothing and a curator's choice stays
//   Admin → Atlas       the curator sets or clears it (atlasEditor.js updateNode); family_by records who, and the seed never returns
// A node with no family is not drawn on the tree (atlasTree.js); it stays in search and on its own page. ⛔ No model.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILIES, isFamily } from "../../shared/atlasFamilies.js";

export { FAMILIES };
export const FAMILIES_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../content/atlas/families.json");
export const FAMILY_SEED = "seed";

export class AtlasFamilyError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

/** The mapping file's { slug → family }; a slug listed under two families is refused (the file is wrong, say so). */
export function readFamilyMapping(file = FAMILIES_FILE) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = new Map();
  for (const [family, slugs] of Object.entries(raw.families || {})) {
    if (!isFamily(family)) throw new AtlasFamilyError("bad_family", `families.json names an unknown family "${family}"`);
    for (const slug of slugs) {
      if (out.has(slug) && out.get(slug) !== family) throw new AtlasFamilyError("twice", `families.json puts "${slug}" in ${out.get(slug)} and ${family}`);
      out.set(slug, family);
    }
  }
  return out;
}

/** @returns {{ assigned: number, missing: string[] }} missing = slugs in the file with no node (skipped) */
export function seedAtlasFamilies(db, mapping = readFamilyMapping()) {
  const put = db.prepare(`UPDATE atlas_nodes SET family = ?, family_by = '${FAMILY_SEED}' WHERE slug = ? AND family_by IS NULL`);
  const known = new Set(db.prepare(`SELECT slug FROM atlas_nodes`).pluck().all());
  let assigned = 0;
  const missing = [];
  db.transaction(() => {
    for (const [slug, family] of mapping) {
      if (!known.has(slug)) { missing.push(slug); continue; }
      assigned += put.run(family, slug).changes;
    }
  })();
  return { assigned, missing };
}


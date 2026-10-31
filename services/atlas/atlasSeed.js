// services/atlas/atlasSeed.js — ⭐ D105 P2 · the first Atlas nodes, from what draft already knows. ⛔ No model (D17).
//
// The source is the registry the ATS scorer itself reads (packages/ats-scorer/data/DOMAIN_METADATA_REGISTRY.json —
// the owner's domain lists: suggested titles, keywords, tools). For the computer-science domains only (the board's
// scope, D78 B): each suggested title → a ROLE, each keyword → a SKILL, each tool → a TOOL, and role → `requires` →
// each of its domain's keywords and tools (source 'registry'). Everything lands as DRAFT; a person publishes.
// ⭐ Amended 10-31: drafts that meet the bar publish themselves nightly (atlasPublish.js) — the seed itself publishes nothing.
// Idempotent: a second run adds nothing, and never touches a node or edge a curator already has.
//
// ⚠ Not here yet: Wikidata (CC0) edges and O*NET (US DoL, attribution) role → skill lists. Both are network sources
// whose current terms and rate limits are checked before first use (D105) — a separate, reviewed import.

import fs from "node:fs";
import path from "node:path";
import { REGISTRY_DIR } from "../../packages/ats-scorer/src/vocabulary.js";
import { upsertNode, addEdge } from "./atlasStore.js";

export const CS_DOMAINS = Object.freeze(["engineering", "engineering_embedded_firmware", "engineering_systems_low_level", "engineering_specialist", "data"]);

export function readRegistry(dir = REGISTRY_DIR) {
  return JSON.parse(fs.readFileSync(path.join(dir, "DOMAIN_METADATA_REGISTRY.json"), "utf8"));
}

/** @returns {{ nodes: number, edges: number, byKind: object }} what was ADDED */
export function seedAtlasFromRegistry(db, { registry = readRegistry(), domains = CS_DOMAINS } = {}) {
  let nodes = 0, edges = 0;
  const byKind = { role: 0, skill: 0, tool: 0 };
  db.transaction(() => {
    for (const key of domains) {
      const d = registry[key];
      if (!d || typeof d !== "object") continue;
      const asks = [];
      for (const [list, kind] of [[d.keywords, "skill"], [d.tools, "tool"]]) {
        for (const name of Array.isArray(list) ? list : []) {
          if (typeof name !== "string" || !name.trim()) continue;
          const n = upsertNode(db, { kind, name, source: "registry" });
          if (n.created) { nodes++; byKind[kind]++; }
          asks.push(n.id);
        }
      }
      for (const title of Array.isArray(d.suggestedTitles) ? d.suggestedTitles : []) {
        if (typeof title !== "string" || !title.trim()) continue;
        const r = upsertNode(db, { kind: "role", name: title, source: "registry" });
        if (r.created) { nodes++; byKind.role++; }
        for (const id of asks) if (addEdge(db, r.id, id, "requires", "registry")) edges++;
      }
    }
  })();
  return { nodes, edges, byKind };
}

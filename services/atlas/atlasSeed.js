// services/atlas/atlasSeed.js — ⭐ D105 P2 · the first Atlas nodes, from what draft already knows. ⛔ No model (D17).
//
// The source is the registry the ATS scorer itself reads (packages/ats-scorer/data/DOMAIN_METADATA_REGISTRY.json —
// the owner's domain lists: suggested titles, keywords, tools). For the computer-science domains only (the board's
// scope, D78 B): each suggested title → a ROLE, each keyword → a SKILL, each tool → a TOOL, and role → `requires` →
// each of its domain's keywords and tools (source 'registry'). Everything lands as DRAFT; a person publishes.
// ⭐ Amended 10-31: drafts that meet the bar publish themselves nightly (atlasPublish.js) — the seed itself publishes nothing.
// Idempotent: a second run adds nothing, and never touches a node or edge a curator already has.
//
// ⭐ A111 P3 (11-02) · EVERY CATEGORY, NOT ONLY COMPUTING: the default is now every registry domain with a D127 category
// (atlasCategories.js seededDomains — computing, engineering, management, business, marketing, legal, arts & media, and
// any domain the vocabulary lane adds, placed by the board's own title rule). Held fields (healthcare) and the generic
// list stay out. A node seeded from a NON-computing domain takes its domain's default family (family_by = 'registry') when
// it has none — the reviewed file (content/atlas/families.json, atlasFamilies.js) and a curator still win over it — so
// every such node is tagged with its family and, through it, its category. Computing keeps D116's reviewed families only.
//
// ⚠ Not here yet: Wikidata (CC0) edges and O*NET (US DoL, attribution) role → skill lists. Both are network sources
// whose current terms and rate limits are checked before first use (D105) — a separate, reviewed import.

import fs from "node:fs";
import path from "node:path";
import { REGISTRY_DIR } from "../../packages/ats-scorer/src/vocabulary.js";
import { upsertNode, addEdge, slugOf } from "./atlasStore.js";
import { seededDomains } from "./atlasCategories.js";

export const CS_DOMAINS = Object.freeze(["engineering", "engineering_embedded_firmware", "engineering_systems_low_level", "engineering_specialist", "data"]);

export function readRegistry(dir = REGISTRY_DIR) {
  return JSON.parse(fs.readFileSync(path.join(dir, "DOMAIN_METADATA_REGISTRY.json"), "utf8"));
}

/** ⭐ A111 P3 · the domains seeded by default: every registry domain with a D127 category (computing first, as before). */
export function defaultDomains(registry = readRegistry()) {
  return seededDomains(registry).map(d => d.key);
}

/** The family a registry-seeded node takes when it has none yet; the reviewed file and a curator overwrite it. */
export const REGISTRY_FAMILY_BY = "registry";

/**
 * @param opts.domains  the registry keys to seed (default: every categorised domain — A111 P3)
 * @returns {{ nodes: number, edges: number, byKind: object }} what was ADDED
 */
export function seedAtlasFromRegistry(db, { registry = readRegistry(), domains = defaultDomains(registry) } = {}) {
  let nodes = 0, edges = 0;
  const byKind = { role: 0, skill: 0, tool: 0 };
  const familyOf = new Map(seededDomains(registry).map(d => [d.key, d.family]));
  const tag = db.prepare(`UPDATE atlas_nodes SET family = ?, family_by = '${REGISTRY_FAMILY_BY}' WHERE id = ? AND family IS NULL AND family_by IS NULL`);
  db.transaction(() => {
    for (const key of domains) {
      const d = registry[key];
      if (!d || typeof d !== "object") continue;
      const family = familyOf.get(key) ?? null;
      const asks = [];
      for (const [list, kind] of [[d.keywords, "skill"], [d.tools, "tool"]]) {
        for (const name of Array.isArray(list) ? list : []) {
          if (typeof name !== "string" || !name.trim()) continue;
          const n = upsertNode(db, { kind, name, source: "registry" });
          if (n.created) { nodes++; byKind[kind]++; }
          if (family) tag.run(family, n.id);
          asks.push(n.id);
        }
      }
      for (const title of Array.isArray(d.suggestedTitles) ? d.suggestedTitles : []) {
        if (typeof title !== "string" || !title.trim()) continue;
        const r = upsertNode(db, { kind: "role", name: title, source: "registry" });
        if (r.created) { nodes++; byKind.role++; }
        if (family) tag.run(family, r.id);
        for (const id of asks) if (addEdge(db, r.id, id, "requires", "registry")) edges++;
      }
    }
  })();
  return { nodes, edges, byKind };
}

/**
 * ⭐ A111 P3 · what the Atlas holds per category, measured from the database and the registry: the nodes of each
 * category's domains (a node listed by two categories counts in both) and the nodes tagged with a family of it.
 * @returns {{ byCategory: Record<string, { nodes, roles, skills, tools, withFamily }> }}
 */
export function atlasCategoryReport(db, { registry = readRegistry() } = {}) {
  const bySlug = new Map(db.prepare(`SELECT slug, kind, family FROM atlas_nodes`).all().map(n => [n.slug, n]));
  const byCategory = {};
  const seen = new Map();
  for (const { key, category } of seededDomains(registry)) {
    const d = registry[key];
    const c = byCategory[category] ??= { nodes: 0, roles: 0, skills: 0, tools: 0, withFamily: 0 };
    const s = seen.get(category) ?? seen.set(category, new Set()).get(category);
    for (const list of [d.suggestedTitles, d.keywords, d.tools]) {
      for (const name of Array.isArray(list) ? list : []) {
        const n = typeof name === "string" ? bySlug.get(slugOf(name)) : null;
        if (!n || s.has(n.slug)) continue;
        s.add(n.slug);
        c.nodes++;
        if (n.kind === "role") c.roles++; else if (n.kind === "tool") c.tools++; else c.skills++;
        if (n.family) c.withFamily++;
      }
    }
  }
  return { byCategory };
}

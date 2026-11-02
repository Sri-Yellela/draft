// services/atlas/atlasCategories.js — ⭐ A111 P3 (11-02) · THE ATLAS IS CATEGORY-AWARE (D127).
//
// Owner 11-02: a tester with a business, marketing, legal or management résumé needs "proper atlas material to map
// their role against their resume". Until now the Atlas seeded only the computing domains (atlasSeed.js CS_DOMAINS, the
// D78 B board). This module says, for the registry the ATS scorer reads, which D127 category each domain belongs to and
// which family its nodes default to — and, read back, which categories a node belongs to:
//   domainCategory   a domain's category: the explicit table below, else the board's own title rule (professionalScope
//                    categoryOf) voted over the domain's suggested titles — so a domain the vocabulary lane adds later
//                    is placed without an edit here. Held fields (healthcare) and the generic list ("general") → null:
//                    never seeded, never shown (D127's red-flag rule).
//   domainFamily     the family a seeded node of that domain takes when no reviewed family exists (content/atlas/
//                    families.json and a curator's choice both win — atlasFamilies.js)
//   categoryIndex    slug → the categories whose registry domains list it (Python: computing, business, engineering)
//   nodeCategories   a node's categories: the registry's, plus its family's
//   roleCategory     a role's ONE category: the board's title rule on its name, else its registry domains when they agree
//   inRoleCategory   ⛔ the rule that keeps another category's skills off a role's reading: a skill counts for a role when
//                    the role's registry / owner list names it, or it is in the role's category, or it has no category
// No storage, no migration: a node's category is derived (its family is the stored part, migration 201). ⛔ No model.
import fs from "node:fs";
import path from "node:path";
import { REGISTRY_DIR } from "../../packages/ats-scorer/src/vocabulary.js";
import { categoryOf } from "../jobs/professionalScope.js";
import { familyCategory } from "../../shared/atlasFamilies.js";
import { slugOf } from "./atlasStore.js";

/** The registry's domains with a known category. Computing is D78 B's five (atlasSeed.js CS_DOMAINS). */
export const DOMAIN_CATEGORY = Object.freeze({
  engineering: "computing", engineering_embedded_firmware: "computing", engineering_systems_low_level: "computing",
  engineering_specialist: "computing", data: "computing",
  pm_general: "management", pm_it: "management", pm_construction: "management", operations: "management",
  finance: "business", hr: "business",
  marketing: "marketing", design: "arts_media", legal: "legal",
  mechanical_engineering: "engineering", electrical_engineering: "engineering", civil_engineering: "engineering",
  chemical_engineering: "engineering", industrial_engineering: "engineering", aerospace_engineering: "engineering",
  biomedical_engineering: "engineering", hardware_engineering: "engineering",
  // held (D127 P1) or not a field: never seeded
  healthcare: null, general: null, other_profile_request: null,
});

/** The family a seeded node takes by default, per domain (computing has none: its families are the reviewed file's). */
export const DOMAIN_FAMILY = Object.freeze({
  finance: "fpa", hr: "people", operations: "operations", pm_general: "product", pm_it: "project_management",
  pm_construction: "project_management", marketing: "marketing_digital", design: "design", legal: "legal_practice",
  mechanical_engineering: "eng_mechanical", electrical_engineering: "eng_electrical", hardware_engineering: "eng_electrical",
  civil_engineering: "eng_civil", chemical_engineering: "eng_process", industrial_engineering: "eng_process",
  aerospace_engineering: "eng_aerospace", biomedical_engineering: "eng_biomedical",
});

/** A domain the table does not name defaults by its category (a domain added by the vocabulary lane, A111 P2). */
const CATEGORY_DEFAULT_FAMILY = Object.freeze({
  business: "business_analysis", management: "project_management", marketing: "marketing_digital", sales: "sales",
  legal: "legal_practice", arts_media: "writing_comms", science: "research_science", engineering: null, computing: null,
});
// Domain-key words that name a family better than the category default ("accounting_audit", "consulting", "content_marketing").
const KEY_FAMILY = [
  [/accounting|audit|tax|bookkeep/, "accounting_audit"], [/fp_?a|financ|treasury|invest/, "fpa"], [/consult|strateg/, "consulting"],
  [/business_analy|\bba\b/, "business_analysis"], [/hr|people|talent|recruit/, "people"], [/product/, "product"],
  [/project|program|pmo/, "project_management"], [/operations|supply|logistic|procure/, "operations"],
  [/brand|product_marketing/, "marketing_brand"], [/content|lifecycle|email|social/, "marketing_content"],
  [/digital|growth|performance|seo/, "marketing_digital"], [/sales|account_exec|business_dev/, "sales"],
  [/legal|paralegal|law|compliance/, "legal_practice"], [/design|ux/, "design"], [/writ|comms|communication|pr_|media|journal|editor/, "writing_comms"],
  [/scien|research|lab|chem|bio/, "research_science"],
];

/** @returns {string|null} the D127 category of one registry domain (null = not seeded) */
export function domainCategory(key, domain) {
  if (Object.hasOwn(DOMAIN_CATEGORY, key)) return DOMAIN_CATEGORY[key];
  if (!domain || typeof domain !== "object" || domain.requestOnly) return null;
  const votes = new Map();
  for (const title of Array.isArray(domain.suggestedTitles) ? domain.suggestedTitles : []) {
    const v = categoryOf({ title, roleKey: domain.roleFamily ?? null });
    if (v.inScope) votes.set(v.category, (votes.get(v.category) || 0) + 1);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length ? ranked[0][0] : null;
}

/** @returns {string|null} the default family of a seeded node of this domain */
export function domainFamily(key, domain) {
  if (Object.hasOwn(DOMAIN_FAMILY, key)) return DOMAIN_FAMILY[key];
  const category = domainCategory(key, domain);
  if (!category || category === "computing") return null;
  for (const [re, family] of KEY_FAMILY) if (re.test(key) && familyCategory(family) === category) return family;
  return CATEGORY_DEFAULT_FAMILY[category] ?? null;
}

/** Every domain of the registry the Atlas seeds — each with its category — in the registry's own order. */
export function seededDomains(registry) {
  return Object.entries(registry || {}).filter(([k, d]) => d && typeof d === "object" && domainCategory(k, d))
    .map(([key, d]) => ({ key, category: domainCategory(key, d), family: domainFamily(key, d) }));
}

const indexCache = new WeakMap();
/** slug → Set(category) of the registry domains that list it (title, keyword or tool). Kept per registry object. */
export function categoryIndex(registry) {
  if (registry && indexCache.has(registry)) return indexCache.get(registry);
  const out = new Map();
  for (const { key, category } of seededDomains(registry)) {
    const d = registry[key];
    for (const list of [d.suggestedTitles, d.keywords, d.tools]) {
      for (const name of Array.isArray(list) ? list : []) {
        const slug = typeof name === "string" ? slugOf(name) : "";
        if (!slug) continue;
        if (!out.has(slug)) out.set(slug, new Set());
        out.get(slug).add(category);
      }
    }
  }
  if (registry) indexCache.set(registry, out);
  return out;
}

/** A node's categories: its registry domains' and its family's (a workplace tool's family adds none). */
export function nodeCategories(node, index) {
  const out = new Set(index?.get(node?.slug) ?? []);
  const fc = node?.family ? familyCategory(node.family) : null;
  if (fc) out.add(fc);
  return out;
}

/** A role's ONE category: the board's title rule (D127) on its name; else its registry domains' when they agree; else null. */
export function roleCategory(role, index) {
  const v = categoryOf({ title: role?.name ?? "" });
  if (v.inScope) return v.category;
  const cats = [...(index?.get(role?.slug) ?? [])];
  if (cats.length === 1) return cats[0];
  const fc = role?.family ? familyCategory(role.family) : null;
  return fc || null;
}

/**
 * ⛔ PURE · whether a skill with these categories may stand in a reading of a role of `category`: the role's own curated
 * list names it (a `requires` edge from the registry or a person), or it shares the role's category. A node with NO
 * category (a curator's or Learn's node from before A111 — the Atlas was computing's alone) counts for a computing role
 * only. A board co-occurrence to another category's skill ("culture" on a backend role) does not count. A role with no
 * category judges nothing.
 */
export function allowedInCategory(category, categories, { curated = false } = {}) {
  if (curated || !category) return true;
  const cats = categories instanceof Set ? categories : new Set(categories || []);
  return cats.has(category) || (cats.size === 0 && category === "computing");
}

/** The same rule over a node (its registry and family categories). */
export function inRoleCategory(category, node, index, { curated = false } = {}) {
  return allowedInCategory(category, nodeCategories(node, index), { curated });
}

let cached = { file: null, mtimeMs: null, registry: null };
/** The registry the scorer reads (the seed's file), parsed once per change of the file — the readers' (page, reading) copy. */
export function registryCached(file = path.join(REGISTRY_DIR, "DOMAIN_METADATA_REGISTRY.json")) {
  const mtimeMs = fs.statSync(file).mtimeMs;
  if (cached.file === file && cached.mtimeMs === mtimeMs) return cached.registry;
  cached = { file, mtimeMs, registry: JSON.parse(fs.readFileSync(file, "utf8")) };
  return cached.registry;
}

/**
 * (node) → whether it may stand on this role's page / tree / reading: in the role's D127 category, or named by the
 * role's curated `requires` list (registry / a person). Read by the role page (atlasRolePage.js) and the role tree
 * (atlasTree.js roleTree) — one rule. A role with no category keeps everything.
 */
export function roleCategoryFilter(db, role, { registry = null } = {}) {
  let index = new Map();
  try { index = categoryIndex(registry || registryCached()); } catch { index = new Map(); }
  const category = roleCategory(role, index);
  if (!category) return () => true;
  const curated = new Set(db.prepare(`SELECT to_id FROM atlas_edges WHERE from_id = ? AND type = 'requires' AND source IN ('registry', 'owner')`)
    .pluck().all(role.id));
  return (n) => inRoleCategory(category, n, index, { curated: curated.has(n.id) });
}

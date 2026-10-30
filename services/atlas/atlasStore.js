// services/atlas/atlasStore.js — ⭐ D105 · THE ATLAS: nodes, typed edges, aliases, search (migration 177).
//
// Four kinds of node — role · skill · tool · stack — and typed edges (requires · part_of · used_with · alternative_to
// · leads_to). ⛔ ONE THESAURUS: `alias_of` is NOT an Atlas table. It is skill_synonyms (CC3 — wired into all 8 scorer
// call sites), relation 'alias', status 'confirmed'. aliasesOf reads it; addAlias writes it through the synonym
// module's own propose → confirm, so an alias added here is an alias the scorer scores (and A76 re-measures ρ after
// each batch — a confirmed alias moves scores). A node is matched to that table by `term`, the scorer's own
// normalisation (normaliseAtsTerm).
//
// ⛔ Public reads see PUBLISHED nodes only; a draft is the curator's. Nothing here calls a model (D17).

import { normaliseAtsTerm } from "../localAtsScorer.js";
import { recordSynonymProposals, confirmSynonym } from "../kb/skillSynonyms.js";

export const KINDS = Object.freeze(["role", "skill", "tool", "stack"]);
export const EDGE_TYPES = Object.freeze(["requires", "part_of", "used_with", "alternative_to", "leads_to"]);
export const EDGE_SOURCES = Object.freeze(["owner", "registry", "wikidata", "onet", "board"]);

/** "C++" → "c-plus-plus", "CI/CD" → "ci-cd", "Node.js" → "node-js". Stable and readable. */
export function slugOf(name) {
  return String(name ?? "").toLowerCase()
    .replace(/\+\+/g, "-plus-plus").replace(/\+/g, "-plus").replace(/#/g, "-sharp")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export const termOf = (name) => normaliseAtsTerm(String(name ?? "")) || String(name ?? "").toLowerCase().trim();

/**
 * Create a node, or return the one with the same slug. Never overwrites a curator's edits: an existing node keeps its
 * name, definition and status. @returns {{ id, created }}
 */
export function upsertNode(db, { kind, name, source = "owner", definition = null, status = "draft" }) {
  if (!KINDS.includes(kind)) throw new Error(`atlas: unknown kind ${kind}`);
  const slug = slugOf(name);
  if (!slug) throw new Error("atlas: a node needs a name");
  const existing = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).get(slug);
  if (existing) return { id: existing.id, created: false };
  const id = Number(db.prepare(`INSERT INTO atlas_nodes (slug, kind, name, term, definition, status, source) VALUES (?,?,?,?,?,?,?)`)
    .run(slug, kind, String(name).trim(), termOf(name), definition, status, source).lastInsertRowid);
  return { id, created: true };
}

export function addEdge(db, fromId, toId, type, source = "owner") {
  if (!EDGE_TYPES.includes(type)) throw new Error(`atlas: unknown edge type ${type} (aliases live in skill_synonyms)`);
  if (!EDGE_SOURCES.includes(source)) throw new Error(`atlas: unknown edge source ${source}`);
  if (fromId === toId) return false;
  return db.prepare(`INSERT OR IGNORE INTO atlas_edges (from_id, to_id, type, source) VALUES (?,?,?,?)`).run(fromId, toId, type, source).changes > 0;
}

/** The confirmed ALIASES of a term, from the scorer's own table. 'related' pairs are not aliases. */
export function aliasesOf(db, term) {
  try {
    return db.prepare(`SELECT CASE WHEN term = ? THEN equivalent ELSE term END AS alias FROM skill_synonyms
      WHERE status = 'confirmed' AND relation = 'alias' AND (term = ? OR equivalent = ?) ORDER BY alias`).pluck().all(term, term, term);
  } catch { return []; }
}

/**
 * The curator adds "k8s" as an alias of Kubernetes — proposed AND confirmed in skill_synonyms, the one thesaurus.
 * @returns {boolean} true when the pair is now a confirmed alias
 */
export function addAlias(db, nodeId, alias, reviewedBy = "owner") {
  const node = db.prepare(`SELECT term FROM atlas_nodes WHERE id = ?`).get(nodeId);
  if (!node) return false;
  const a = termOf(alias);
  if (!a || a === node.term) return false;
  recordSynonymProposals(db, [{ term: node.term, equivalent: a, relation: "alias" }]);
  confirmSynonym(db, node.term, a, reviewedBy);
  const row = db.prepare(`SELECT status, relation FROM skill_synonyms WHERE (term = ? AND equivalent = ?) OR (term = ? AND equivalent = ?)`)
    .get(node.term, a, a, node.term);
  return row?.status === "confirmed" && row?.relation === "alias";
}

/**
 * A person's terms: their profile's skills (D101 profile_skills) and each one's confirmed aliases. Read by the Atlas's
 * `you` (routes/atlas.js) and by D110's interview prep (services/interviewPrep.js) — one reader, never stored.
 */
export function profileTerms(db, userId) {
  let names = [];
  try { names = db.prepare(`SELECT name FROM profile_skills WHERE user_id = ?`).pluck().all(userId); } catch { names = []; }
  const terms = new Set();
  for (const n of names) { const t = termOf(n); if (t) { terms.add(t); for (const a of aliasesOf(db, t)) terms.add(a); } }
  return terms;
}

const visible = (published) => (published ? "AND n.status = 'published'" : "");

/**
 * Search by name or alias: "k8s" lands on Kubernetes. Exact term first, then alias, then prefix / contains.
 * @returns [{ slug, kind, name, via }]
 */
export function searchNodes(db, q, { publishedOnly = true, limit = 20 } = {}) {
  const t = termOf(q);
  if (!t) return [];
  const out = new Map();
  const add = (rows, via) => { for (const r of rows) if (!out.has(r.slug)) out.set(r.slug, { slug: r.slug, kind: r.kind, name: r.name, via }); };
  add(db.prepare(`SELECT slug, kind, name FROM atlas_nodes n WHERE n.term = ? ${visible(publishedOnly)}`).all(t), "name");
  const aliasTerms = aliasesOf(db, t);
  if (aliasTerms.length) {
    add(db.prepare(`SELECT slug, kind, name FROM atlas_nodes n WHERE n.term IN (${aliasTerms.map(() => "?").join(",")}) ${visible(publishedOnly)}`)
      .all(...aliasTerms), "alias");
  }
  const like = `%${t.replace(/[%_]/g, "")}%`;
  add(db.prepare(`SELECT slug, kind, name FROM atlas_nodes n WHERE n.term LIKE ? ${visible(publishedOnly)}
    ORDER BY CASE WHEN n.term LIKE ? THEN 0 ELSE 1 END, LENGTH(n.name) LIMIT ?`).all(like, `${t}%`, limit), "match");
  return [...out.values()].slice(0, limit);
}

/** One node's page data, or null (unknown, or a draft on a public read). */
export function readNode(db, slug, { publishedOnly = true } = {}) {
  const n = db.prepare(`SELECT * FROM atlas_nodes n WHERE n.slug = ? ${visible(publishedOnly)}`).get(String(slug));
  if (!n) return null;
  const edgeRows = db.prepare(`
    SELECT e.type, 'out' AS dir, m.slug, m.kind, m.name, m.status FROM atlas_edges e JOIN atlas_nodes m ON m.id = e.to_id WHERE e.from_id = ?
    UNION ALL
    SELECT e.type, 'in' AS dir, m.slug, m.kind, m.name, m.status FROM atlas_edges e JOIN atlas_nodes m ON m.id = e.from_id WHERE e.to_id = ?`).all(n.id, n.id);
  const related = edgeRows.filter(r => !publishedOnly || r.status === "published").map(({ status, ...r }) => r);
  let stats = null;
  try {
    const s = db.prepare(`SELECT * FROM atlas_node_stats WHERE node_id = ?`).get(n.id);
    if (s) stats = { postings: s.postings, topSkills: JSON.parse(s.top_skills_json), topRoles: JSON.parse(s.top_roles_json),
      pay: s.pay_n ? { minUsd: s.pay_min_usd, medianUsd: s.pay_median_usd, maxUsd: s.pay_max_usd, n: s.pay_n } : null, computedAt: s.computed_at };
  } catch { stats = null; }
  const resources = db.prepare(`SELECT url, title, level, format, hours, cost, checked_at AS checkedAt, check_status AS checkStatus
    FROM atlas_resources WHERE node_id = ? AND COALESCE(check_status, 'ok') != 'dead' ORDER BY (cost = 'free') DESC, id`).all(n.id);
  const wiki = db.prepare(`SELECT title, extract, thumbnail_url AS thumbnailUrl, page_url AS pageUrl, fetched_at AS fetchedAt
    FROM atlas_wiki_cache WHERE node_id = ?`).get(n.id) || null;
  return {
    slug: n.slug, kind: n.kind, name: n.name, status: n.status,
    aliases: aliasesOf(db, n.term),
    definition: n.definition,
    onTheBoard: stats,
    related,
    resources,
    // ⛔ Wikipedia's text is shown as Wikipedia's: its own block, its licence and its link (d105WikiAttributed).
    wikipedia: wiki ? { ...wiki, licence: WIKI_LICENCE } : null,
  };
}

export const WIKI_LICENCE = Object.freeze({
  line: "From Wikipedia, CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
});

/** The curator publishes (or unpublishes) a node. */
export function setStatus(db, slug, status, by = "owner") {
  if (!["draft", "published"].includes(status)) throw new Error("atlas: status is draft or published");
  return db.prepare(`UPDATE atlas_nodes SET status = ?, published_at = CASE WHEN ? = 'published' THEN unixepoch() ELSE NULL END,
    published_by = CASE WHEN ? = 'published' THEN ? ELSE NULL END, updated_at = unixepoch() WHERE slug = ?`)
    .run(status, status, status, by, String(slug)).changes > 0;
}

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
// ⭐ Amended 10-31: a node is published by a person OR by the nightly auto-publish bar (atlasPublish.js); a person's
// un-publish is recorded and sticks.

import { prepared } from "../stmtCache.js";   // A195 leftover (b): fixed SQL prepared once per database
import { normaliseAtsTerm } from "../localAtsScorer.js";
import { recordSynonymProposals, confirmSynonym } from "../kb/skillSynonyms.js";
import { searchKey, matchCandidate } from "../../shared/atlasSearchNormalize.js";
import { profileFromResume } from "../structuredProfile.js";

// ⭐ D115 (migration 194): 'concept' — a term from the owner's tracker that is no role, skill or tool on the board
// ("Logic gate", "Byte"); 'pattern' — one of its 28 LeetCode patterns.
export const KINDS = Object.freeze(["role", "skill", "tool", "stack", "concept", "pattern"]);
export const EDGE_TYPES = Object.freeze(["requires", "part_of", "used_with", "alternative_to", "leads_to"]);
export const EDGE_SOURCES = Object.freeze(["owner", "registry", "wikidata", "onet", "board"]);

/** "C++" → "c-plus-plus", "CI/CD" → "ci-cd", "Node.js" → "node-js". Stable and readable. */
export function slugOf(name) {
  return String(name ?? "").toLowerCase()
    .replace(/\+\+/g, "-plus-plus").replace(/\+/g, "-plus").replace(/#/g, "-sharp")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export const termOf = (name) => normaliseAtsTerm(String(name ?? "")) || String(name ?? "").toLowerCase().trim();
/** ⭐ 46s (production, the owner's account): a résumé's skills line written as a bold heading with no colon
 *  ("Languages Java, Kotlin") reaches profile_skills as "Languages Java", which no node's term matches. For a PERSON's
 *  skill name that matched nothing, the names left after dropping 1–5 leading words, longest first ("Java" from
 *  "Languages Java"; "AWS Lambda" from "Cloud & DevOps (AWS) AWS Lambda"). Only for a person's own names — postings
 *  never take this path. The caller tries the full name first. Pure. */
export function headingStrippedNames(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || !/^[A-Z(&]/.test(words[0])) return [];
  const out = [];
  for (let i = 1; i <= Math.min(5, words.length - 1); i++) {
    const head = words[i], rest = words.slice(i).join(" ");
    // not a fragment ("AI (familiar)" from "Vertex AI (familiar)") nor a bare common word ("architecture")
    if (head.length <= 2 || !/^[A-Za-z0-9.#+]/.test(head)) continue;
    if (i === words.length - 1 && head === head.toLowerCase()) continue;
    out.push(rest);
  }
  return out;
}

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
    return prepared(db, `SELECT CASE WHEN term = ? THEN equivalent ELSE term END AS alias FROM skill_synonyms
      WHERE status = 'confirmed' AND relation = 'alias' AND (term = ? OR equivalent = ?) ORDER BY alias`, { pluck: true }).all(term, term, term);   // A195 (b): prepared once
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
 * ⚠ BUG D120 P1 (owner 10-31: "it currently shows Upload a résumé … but my resume already exists"): profile_skills is
 * filled from the résumé's parse only when the Profile is first OPENED (structuredProfile.js), so a user who uploaded a
 * résumé and never opened the Profile had no terms and was asked to upload one. When the Profile has no skills, the
 * base résumé's parsed skills (D65, the same reading the packets use) stand in — `haveTerms` says which it was.
 */
export function haveTerms(db, userId) {
  let names = [];
  try { names = db.prepare(`SELECT name FROM profile_skills WHERE user_id = ?`).pluck().all(userId); } catch { names = []; }
  let source = names.length ? "profile" : null;
  if (!names.length) {
    try { names = (profileFromResume(db, userId)?.skills || []).map(s => s.name).filter(Boolean); } catch { names = []; }
    if (names.length) source = "resume";
  }
  const terms = new Set();
  for (const n of names) { const t = termOf(n); if (t) { terms.add(t); for (const a of aliasesOf(db, t)) terms.add(a); } }
  return { terms, source: terms.size ? source : null, hasResume: source === "resume" || hasAnyResume(db, userId) };
}
export function profileTerms(db, userId) { return haveTerms(db, userId).terms; }

/** Whether the user has any résumé on file — a base on any job profile, the account's base, or a generated one. */
export function hasAnyResume(db, userId) {
  const q = (sql) => { try { return !!db.prepare(sql).get(userId); } catch { return false; } };
  return q(`SELECT 1 FROM profile_base_resumes WHERE user_id = ? AND TRIM(COALESCE(content, '')) != '' LIMIT 1`)
    || q(`SELECT 1 FROM base_resume WHERE user_id = ? AND TRIM(COALESCE(content, '')) != '' LIMIT 1`)
    || q(`SELECT 1 FROM resumes WHERE user_id = ? LIMIT 1`);
}

const visible = (published) => (published ? "AND n.status = 'published'" : "");

// ⭐ BUG 10-31 (owner: "the search is not normalised") · the index the search reads: every node with its confirmed
// aliases, rebuilt when a node or an alias changes (the version key). Matching is shared/atlasSearchNormalize.js —
// the ONE normaliser the Atlas search, the Learn concept search (D115) and D114's matcher use.
/**
 * ⭐ D118 P2 (b) · the Atlas's change counter (migration 198: triggers on atlas_nodes and skill_synonyms) — part of every
 * in-memory index's key, so a curator's publish / unpublish / edit is read on the NEXT request, even two in one second
 * (the old key — count · newest updated_at · published count — measured stale for "publish B, unpublish A" in a second).
 * -1 on a database without the counter (the old key parts still apply there).
 */
export function atlasChangeCount(db) {
  try { return db.prepare(`SELECT n FROM atlas_changes WHERE id = 1`).pluck().get() ?? -1; } catch { return -1; }
}

let searchIndex = { db: null, key: null, rows: [] };
function indexFor(db) {
  const key = db.prepare(`SELECT COUNT(*) || ':' || COALESCE(MAX(updated_at), 0) || ':' || SUM(status = 'published') FROM atlas_nodes`).pluck().get()
    + ":" + db.prepare(`SELECT COUNT(*) FROM skill_synonyms WHERE status = 'confirmed'`).pluck().get() + ":" + atlasChangeCount(db);
  if (searchIndex.db === db && searchIndex.key === key) return searchIndex.rows;
  const rows = db.prepare(`SELECT slug, kind, name, term, definition, status FROM atlas_nodes`).all()
    .map(n => ({ ...n, aliases: aliasesOf(db, n.term) }));
  searchIndex = { db, key, rows };
  return rows;
}

/**
 * Search by name, alias, prefix, typo or definition: "k8s" → Kubernetes, "nodejs" → Node.js, "kuberntes" → Kubernetes.
 * Ranked exact name → alias → prefix → typo → a match in a definition; each result says why it matched.
 * @returns [{ slug, kind, name, via, why }]   via: name | alias | prefix | typo | definition
 */
export function searchNodes(db, q, { publishedOnly = true, limit = 20 } = {}) {
  if (!searchKey(q)) return [];
  const hits = [];
  for (const n of indexFor(db)) {
    if (publishedOnly && n.status !== "published") continue;
    const m = matchCandidate(q, n);
    if (m) hits.push({ slug: n.slug, kind: n.kind, name: n.name, via: m.via, why: m.why, rank: m.rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name));
  return hits.slice(0, limit).map(({ rank, ...h }) => h);
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
  // ⭐ P8 (amended 10-31): the official site and docs from Wikidata first, the Wikipedia article second, then the
  // curated ones, free first (RESOURCE_ORDER_SQL — the editor's list and the page agree).
  const resources = db.prepare(`SELECT url, title, level, format, hours, cost, checked_at AS checkedAt, check_status AS checkStatus, source
    FROM atlas_resources WHERE node_id = ? AND COALESCE(check_status, 'ok') != 'dead' ORDER BY ${RESOURCE_ORDER_SQL}`).all(n.id);
  const wiki = db.prepare(`SELECT title, extract, thumbnail_url AS thumbnailUrl, page_url AS pageUrl, fetched_at AS fetchedAt
    FROM atlas_wiki_cache WHERE node_id = ?`).get(n.id) || null;
  return {
    slug: n.slug, kind: n.kind, name: n.name, status: n.status,
    aliases: aliasesOf(db, n.term),
    definition: n.definition,
    onTheBoard: stats,
    // ⭐ P7: a published page whose board count fell under the bar STAYS published and says so (never unpublished).
    fewOpenPostings: n.status === "published" && (stats?.postings ?? 0) < AUTO_PUBLISH_MIN_POSTINGS,
    related,
    resources,
    // ⛔ Wikipedia's text is shown as Wikipedia's: its own block, its licence and its link (d105WikiAttributed).
    wikipedia: wiki ? { ...wiki, licence: WIKI_LICENCE } : null,
  };
}

/** ⭐ D105 P7 (amended 10-31) · the board half of the auto-publish bar (services/atlas/atlasPublish.js). */
export const AUTO_PUBLISH_MIN_POSTINGS = 5;
/** Who auto-publish records in published_by — never a curator's name. */
export const AUTO_PUBLISHER = "atlas-auto";

/** Wikidata's resources (official site, docs) first, then the Wikipedia article, then the curated ones, free first. */
export const RESOURCE_ORDER_SQL = `CASE source WHEN 'wikidata' THEN 0 WHEN 'wikipedia' THEN 1 ELSE 2 END, (cost = 'free') DESC, id`;

export const WIKI_LICENCE = Object.freeze({
  line: "From Wikipedia, CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
});

/**
 * ⭐ D105 P5 · LINKS IN — the PUBLISHED node each term lands on, by its term or a confirmed alias (skill_synonyms, the
 * one thesaurus). A term with no published node is simply ABSENT from the answer, so a caller never draws a link to a
 * draft or to nothing (d105ResolveOnlyPublished). Keys are the caller's own strings, as sent.
 * @returns {Record<string, string>} term → slug
 */
export const RESOLVE_MAX_TERMS = 200;
export function resolveTerms(db, terms) {
  const out = {};
  const byTerm = db.prepare(`SELECT slug FROM atlas_nodes WHERE term = ? AND status = 'published' LIMIT 1`).pluck();
  const seen = new Set();
  for (const raw of (Array.isArray(terms) ? terms : []).slice(0, RESOLVE_MAX_TERMS)) {
    const key = String(raw ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const t = termOf(key);
    if (!t) continue;
    let slug = byTerm.get(t);
    if (!slug) for (const a of aliasesOf(db, t)) { slug = byTerm.get(a); if (slug) break; }
    if (slug) out[key] = slug;
  }
  return out;
}

/**
 * The curator publishes (or unpublishes) a node. ⭐ P7 (amended 10-31): an UNPUBLISH is recorded (unpublished_by,
 * unpublished_at) and auto-publish never re-publishes such a node — the owner's un-publish wins
 * (d105OwnerUnpublishSticks). The curator publishing it again clears the mark.
 */
export function setStatus(db, slug, status, by = "owner") {
  if (!["draft", "published"].includes(status)) throw new Error("atlas: status is draft or published");
  const who = String(by || "owner").slice(0, 120);
  return db.prepare(`UPDATE atlas_nodes SET status = ?, published_at = CASE WHEN ? = 'published' THEN unixepoch() ELSE NULL END,
    published_by = CASE WHEN ? = 'published' THEN ? ELSE NULL END,
    unpublished_by = CASE WHEN ? = 'draft' THEN ? ELSE NULL END,
    unpublished_at = CASE WHEN ? = 'draft' THEN unixepoch() ELSE NULL END,
    updated_at = unixepoch() WHERE slug = ?`)
    .run(status, status, status, who, status, who, status, String(slug)).changes > 0;
}

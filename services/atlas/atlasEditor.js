// services/atlas/atlasEditor.js — ⭐ D105 P6 · THE CURATOR'S EDITOR: add a node, merge two, typed edges, resources.
//
// Every write here is the curator's (the admin routes under /api/admin/atlas — routes/atlas.js). ⛔ Nothing here calls a
// model (D17): a definition is typed by a person, in draft's words. ⛔ ONE THESAURUS: a merge does NOT keep a second
// alias table — the loser's term becomes a CONFIRMED alias of the winner in skill_synonyms, through atlasStore's own
// addAlias (propose → confirm, the scorer's cache invalidated), and so do the loser's own confirmed aliases.
// ⛔ Edges are typed (requires · part_of · used_with · alternative_to · leads_to) — never alias_of (addEdge refuses it).
// ⛔ A resource's address is https only: the page links out to it, and a plain-http or javascript: link is not one a
// reader should be handed.

import { upsertNode, addEdge, addAlias, aliasesOf, KINDS, EDGE_TYPES, termOf, RESOURCE_ORDER_SQL } from "./atlasStore.js";

export const RESOURCE_LEVELS = Object.freeze(["beginner", "intermediate", "advanced"]);
export const RESOURCE_FORMATS = Object.freeze(["course", "docs", "book", "video", "tutorial", "article", "practice"]);
export const RESOURCE_COSTS = Object.freeze(["free", "paid", "freemium"]);

export class AtlasEditError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}
const bad = (code, message) => { throw new AtlasEditError(code, message); };

export function nodeBySlug(db, slug) {
  return db.prepare(`SELECT * FROM atlas_nodes WHERE slug = ?`).get(String(slug ?? "")) || null;
}

/** Add a node by hand (source 'owner', a DRAFT until it is published). */
export function createNode(db, { kind, name, definition = null, wikiTitle = null }) {
  if (!KINDS.includes(kind)) bad("bad_kind", `kind is one of ${KINDS.join(", ")}`);
  const nm = String(name ?? "").trim().slice(0, 120);
  if (!nm) bad("bad_name", "a node needs a name");
  const { id, created } = upsertNode(db, { kind, name: nm, source: "owner", definition: cleanText(definition), status: "draft" });
  if (!created) bad("exists", "a node by that name already exists");
  if (wikiTitle) db.prepare(`UPDATE atlas_nodes SET wiki_title = ?, wiki_title_by = 'owner' WHERE id = ?`).run(cleanWikiTitle(wikiTitle), id);
  return db.prepare(`SELECT slug, kind, name, status FROM atlas_nodes WHERE id = ?`).get(id);
}

const cleanText = (v) => { const s = String(v ?? "").trim().slice(0, 4000); return s || null; };
const cleanWikiTitle = (v) => { const s = String(v ?? "").trim().replace(/\s+/g, "_").slice(0, 200); return s || null; };

/** Edit a node's definition (draft's own words) and the Wikipedia title its summary is read from. */
export function updateNode(db, slug, { definition, wikiTitle } = {}) {
  const n = nodeBySlug(db, slug);
  if (!n) bad("not_found");
  const sets = [], args = [];
  if (definition !== undefined) { sets.push("definition = ?"); args.push(cleanText(definition)); }
  if (wikiTitle !== undefined) {
    const t = cleanWikiTitle(wikiTitle);
    // ⭐ P8 (amended 10-31): the curator's title — set OR cleared — is theirs from now on: the nightly matcher never
    // overwrites a title whose wiki_title_by is 'owner' (atlasWikidata.js), so clearing a wrong match keeps it clear.
    sets.push("wiki_title = ?", "wiki_title_by = 'owner'"); args.push(t);
    // A new title means the cached summary is someone else's page — drop it; the weekly refresh reads the new one.
    // The Wikidata item (and the resources read from it) belonged to the old title too: dropped, read again.
    if (t !== n.wiki_title) {
      db.prepare(`DELETE FROM atlas_wiki_cache WHERE node_id = ?`).run(n.id);
      db.prepare(`DELETE FROM atlas_resources WHERE node_id = ? AND source IN ('wikidata', 'wikipedia')`).run(n.id);
      sets.push("wikidata_id = NULL", "wiki_checked_at = NULL", "wikidata_checked_at = NULL");
    }
  }
  if (!sets.length) return false;
  db.prepare(`UPDATE atlas_nodes SET ${sets.join(", ")}, updated_at = unixepoch() WHERE id = ?`).run(...args, n.id);
  return true;
}

/** The curator's view of one node: every edge (drafts too) and every resource (dead ones too, marked). */
export function readNodeForEditor(db, slug) {
  const n = nodeBySlug(db, slug);
  if (!n) return null;
  const edges = db.prepare(`
    SELECT e.type, 'out' AS dir, m.slug, m.name, m.kind, m.status, e.source FROM atlas_edges e JOIN atlas_nodes m ON m.id = e.to_id WHERE e.from_id = ?
    UNION ALL
    SELECT e.type, 'in' AS dir, m.slug, m.name, m.kind, m.status, e.source FROM atlas_edges e JOIN atlas_nodes m ON m.id = e.from_id WHERE e.to_id = ?
    ORDER BY type, name`).all(n.id, n.id);
  const resources = db.prepare(`SELECT id, url, title, level, format, hours, cost, checked_at AS checkedAt, check_status AS checkStatus, source
    FROM atlas_resources WHERE node_id = ? ORDER BY ${RESOURCE_ORDER_SQL}`).all(n.id);
  return { slug: n.slug, kind: n.kind, name: n.name, status: n.status, source: n.source, definition: n.definition,
    wikiTitle: n.wiki_title, wikiTitleBy: n.wiki_title_by, wikidataId: n.wikidata_id,
    publishedBy: n.published_by, unpublishedBy: n.unpublished_by, aliases: aliasesOf(db, n.term), edges, resources };
}

// ── edges ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function addTypedEdge(db, fromSlug, toSlug, type) {
  if (!EDGE_TYPES.includes(type)) bad("bad_type", `an edge is one of ${EDGE_TYPES.join(", ")} — aliases live in skill_synonyms`);
  const a = nodeBySlug(db, fromSlug), b = nodeBySlug(db, toSlug);
  if (!a || !b) bad("not_found");
  if (a.id === b.id) bad("self", "a node cannot point at itself");
  return addEdge(db, a.id, b.id, type, "owner");
}

export function removeEdge(db, fromSlug, toSlug, type) {
  const a = nodeBySlug(db, fromSlug), b = nodeBySlug(db, toSlug);
  if (!a || !b) bad("not_found");
  return db.prepare(`DELETE FROM atlas_edges WHERE from_id = ? AND to_id = ? AND type = ?`).run(a.id, b.id, String(type)).changes > 0;
}

// ── resources ───────────────────────────────────────────────────────────────────────────────────────────────────
/** https only — a URL the parser accepts, with a host, no credentials. @returns the normalised href */
export function cleanResourceUrl(raw) {
  let u;
  try { u = new URL(String(raw ?? "").trim()); } catch { bad("bad_url", "the address must be a full https:// URL"); }
  if (u.protocol !== "https:") bad("bad_url", "the address must be https");
  if (!u.hostname || u.username || u.password) bad("bad_url", "the address must be a plain https URL");
  return u.href.slice(0, 2000);
}

function cleanResource(input, { partial = false } = {}) {
  const out = {};
  if (!partial || input.url !== undefined) out.url = cleanResourceUrl(input.url);
  if (!partial || input.title !== undefined) {
    const t = String(input.title ?? "").trim().slice(0, 200);
    if (!t) bad("bad_title", "a resource needs a title");
    out.title = t;
  }
  const pick = (k, list) => {
    if (partial && input[k] === undefined) return;
    const v = input[k] == null || input[k] === "" ? null : String(input[k]).toLowerCase();
    if (v !== null && !list.includes(v)) bad(`bad_${k}`, `${k} is one of ${list.join(", ")}`);
    out[k] = v;
  };
  pick("level", RESOURCE_LEVELS);
  pick("format", RESOURCE_FORMATS);
  pick("cost", RESOURCE_COSTS);
  if (!partial || input.hours !== undefined) {
    if (input.hours == null || input.hours === "") out.hours = null;
    else {
      const h = Number(input.hours);
      if (!Number.isFinite(h) || h < 0 || h > 2000) bad("bad_hours", "hours is a number from 0 to 2000");
      out.hours = Math.round(h * 10) / 10;
    }
  }
  return out;
}

export function addResource(db, slug, input, by = "owner") {
  const n = nodeBySlug(db, slug);
  if (!n) bad("not_found");
  const r = cleanResource(input || {});
  const info = db.prepare(`INSERT OR IGNORE INTO atlas_resources (node_id, url, title, level, format, hours, cost, added_by, source)
    VALUES (?,?,?,?,?,?,?,?,'owner')`).run(n.id, r.url, r.title, r.level, r.format, r.hours, r.cost, String(by).slice(0, 120));
  if (!info.changes) bad("exists", "this page already lists that address");
  return Number(info.lastInsertRowid);
}

export function updateResource(db, id, input) {
  const row = db.prepare(`SELECT id, url FROM atlas_resources WHERE id = ?`).get(Number(id));
  if (!row) bad("not_found");
  const r = cleanResource(input || {}, { partial: true });
  const keys = Object.keys(r);
  if (!keys.length) return false;
  // A new address has not been checked: its status starts over.
  if (r.url && r.url !== row.url) { r.checked_at = null; r.check_status = null; }
  const ks = Object.keys(r);
  try {
    return db.prepare(`UPDATE atlas_resources SET ${ks.map(k => `${k} = ?`).join(", ")} WHERE id = ?`).run(...ks.map(k => r[k]), row.id).changes > 0;
  } catch (e) {
    if (/UNIQUE/.test(e.message)) bad("exists", "this page already lists that address");
    throw e;
  }
}

export function removeResource(db, id) {
  return db.prepare(`DELETE FROM atlas_resources WHERE id = ?`).run(Number(id)).changes > 0;
}

// ── merge ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Merge `loserSlug` INTO `winnerSlug`: the loser's edges and resources move to the winner (a duplicate is dropped, a
 * self-edge is dropped), its term — and each of its confirmed aliases — becomes a CONFIRMED alias of the winner in
 * skill_synonyms (addAlias, the one thesaurus), and the loser is deleted. The winner keeps its name, definition and
 * status. One transaction: a failure leaves both nodes as they were.
 * @returns {{ winner, loser, edgesMoved, resourcesMoved, aliases: string[] }}
 */
export function mergeNodes(db, winnerSlug, loserSlug, by = "owner") {
  const w = nodeBySlug(db, winnerSlug), l = nodeBySlug(db, loserSlug);
  if (!w || !l) bad("not_found");
  if (w.id === l.id) bad("self", "pick two different nodes");
  return db.transaction(() => {
    let edgesMoved = 0;
    const outs = db.prepare(`SELECT to_id, type, source FROM atlas_edges WHERE from_id = ?`).all(l.id);
    const ins = db.prepare(`SELECT from_id, type, source FROM atlas_edges WHERE to_id = ?`).all(l.id);
    const put = db.prepare(`INSERT OR IGNORE INTO atlas_edges (from_id, to_id, type, source) VALUES (?,?,?,?)`);
    for (const e of outs) if (e.to_id !== w.id) edgesMoved += put.run(w.id, e.to_id, e.type, e.source).changes;
    for (const e of ins) if (e.from_id !== w.id) edgesMoved += put.run(e.from_id, w.id, e.type, e.source).changes;
    db.prepare(`DELETE FROM atlas_edges WHERE from_id = ? OR to_id = ?`).run(l.id, l.id);
    const resourcesMoved = db.prepare(`UPDATE OR IGNORE atlas_resources SET node_id = ? WHERE node_id = ?`).run(w.id, l.id).changes;
    db.prepare(`DELETE FROM atlas_resources WHERE node_id = ?`).run(l.id);   // the duplicates the winner already lists
    const aliasTerms = [l.term, ...aliasesOf(db, l.term)].filter(t => t && t !== w.term);
    const aliases = [];
    for (const t of aliasTerms) if (addAlias(db, w.id, t, by)) aliases.push(termOf(t));
    db.prepare(`DELETE FROM atlas_wiki_cache WHERE node_id = ?`).run(l.id);
    db.prepare(`DELETE FROM atlas_node_stats WHERE node_id = ?`).run(l.id);
    db.prepare(`DELETE FROM atlas_nodes WHERE id = ?`).run(l.id);
    db.prepare(`UPDATE atlas_nodes SET updated_at = unixepoch() WHERE id = ?`).run(w.id);
    return { winner: w.slug, loser: l.slug, edgesMoved, resourcesMoved, aliases };
  })();
}

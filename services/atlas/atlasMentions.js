// services/atlas/atlasMentions.js — ⭐ 47o (owner 11-27, docs/ATLAS_WIKI_PLAN_47o.md W3) · "LINKED FROM" — the wiki's "what
// links here": which Atlas text links to an entry, grouped by domain, so GPU can say "linked from 4 pages in 3 domains".
//
// THE SOURCES (the same text the pages draw, linked by THE ONE linker, shared/atlasText.js):
//   entry  — every published entry's meaning (its definition, else the first sentence of its Wikipedia summary — the one
//            meaningOf); domain = the entry's family
//   lesson — every step of the owner's learning path (its title, goal and notes); domain = computing
// Postings are not re-read here: an entry's postings by domain come from its stored board stats (the roles that ask for it
// and their families, atlas_node_stats), so no posting pass is added.
//
// ⛔ OFF THE REQUEST THREAD (memory: board reads freeze the site — A126 / A158): rebuildMentions yields to the event loop
// between small slices and writes once at the end (one transaction). It runs only when its fingerprint moved — the
// linker's terms version + the learn content version + the entries' meanings — checked shortly after boot and every 30
// minutes; a steady boot reads one row and does nothing. ⛔ No model (D190).
import crypto from "node:crypto";
import { atlasTextData } from "./atlasSenses.js";
import { meaningOf } from "./atlasLinks.js";
import { learnContent, learnContentVersion } from "../learn/learnContent.js";
import { linkAtlasText } from "../../shared/atlasText.js";
import { familyName, familyCategory } from "../../shared/atlasFamilies.js";

export const MENTIONS_KEY = "mentions_fp";
export const MENTIONS_SLICE = 40;
export const LINKED_FROM_SHOWN = 12;

const getState = (db, k) => { try { return db.prepare(`SELECT v FROM atlas_live_state WHERE k = ?`).pluck().get(k) ?? null; } catch { return null; } };
const putState = (db, k, v) => db.prepare(`INSERT INTO atlas_live_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).run(k, String(v));
const hasTable = (db) => !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'atlas_mentions'`).get();
const pause = () => new Promise(r => setImmediate(r));

/** The Atlas text that may link to an entry. Pure over the database's current content. */
export function mentionSources(db) {
  const out = [];
  const entries = db.prepare(`SELECT n.slug, n.name, n.family, n.definition, w.extract AS wikiExtract, w.page_url AS wikiPageUrl
    FROM atlas_nodes n LEFT JOIN atlas_wiki_cache w ON w.node_id = n.id WHERE n.status = 'published' ORDER BY n.id`).all();
  for (const e of entries) {
    const text = meaningOf(e).meaning;
    if (text) out.push({ kind: "entry", ref: e.slug, label: e.name, self: e.slug, domain: e.family || null, text });
  }
  let course = null;
  try { course = learnContent(db); } catch { course = null; }
  for (const part of course?.PARTS || []) for (const ph of part.phases || []) for (const st of ph.steps || []) {
    const text = [st.t, st.g, ...(st.items || []).map(i => i.n)].filter(Boolean).join(". ");
    if (text) out.push({ kind: "lesson", ref: st.id, label: st.t || st.id, self: null, domain: "computing", text });
  }
  return out;
}

/** What the rows depend on: a change to any of it means a rebuild. */
export function mentionsFingerprint(db) {
  const h = crypto.createHash("sha1");
  h.update(String(atlasTextData(db).version));
  h.update(JSON.stringify(learnContentVersion(db) || null));
  h.update(db.prepare(`SELECT COUNT(*) || ':' || COALESCE(SUM(LENGTH(COALESCE(definition, ''))), 0) FROM atlas_nodes WHERE status = 'published'`).pluck().get());
  return h.digest("hex").slice(0, 16);
}

/** The links of one source — the shared linker's own prefilter keeps it short (shared/atlasText.js). */
export function linksOf(src, data) {
  const domain = src.domain ? [src.domain, familyCategory(src.domain)].filter(Boolean) : [];
  return linkAtlasText(src.text, data, { self: src.self, domain }).filter(x => x.slug && !x.disambiguation).map(x => x.slug);
}

/**
 * Rebuild atlas_mentions when its fingerprint moved. Yields between slices; writes once.
 * @returns {Promise<{ skipped?: true, sources?: number, rows?: number, ms?: number }>}
 */
export async function rebuildMentions(db, { force = false, slice = MENTIONS_SLICE, clock = () => performance.now() } = {}) {
  if (!hasTable(db)) return { skipped: true };
  const fp = mentionsFingerprint(db);
  if (!force && getState(db, MENTIONS_KEY) === fp) return { skipped: true };
  const t0 = clock();
  const data = atlasTextData(db);
  const ids = new Map(db.prepare(`SELECT slug, id FROM atlas_nodes WHERE status = 'published'`).all().map(r => [r.slug, r.id]));
  const sources = mentionSources(db);
  const rows = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    for (const slug of new Set(linksOf(src, data))) {
      const id = ids.get(slug);
      if (id != null) rows.push([id, src.kind, src.ref, src.label, src.domain]);
    }
    if ((i + 1) % slice === 0) await pause();
  }
  const ins = db.prepare(`INSERT OR IGNORE INTO atlas_mentions (node_id, source_kind, source_ref, source_label, domain) VALUES (?, ?, ?, ?, ?)`);
  db.transaction(() => {
    db.prepare(`DELETE FROM atlas_mentions`).run();
    for (const r of rows) ins.run(...r);
    putState(db, MENTIONS_KEY, fp);
  })();
  return { sources: sources.length, rows: rows.length, ms: Math.round(clock() - t0) };
}

const domainName = (d) => (d === "computing" ? "Computing" : familyName(d) || "Other");

/**
 * An entry's "Linked from": the Atlas text that links to it, grouped by domain (the most first), and its postings by the
 * domain of the roles that ask for it (the stored board stats). @returns {{ total, domains, pages: [...] , postings: [...] }}
 */
export function linkedFrom(db, slug, { shown = LINKED_FROM_SHOWN } = {}) {
  const empty = { total: 0, domains: 0, groups: [], postings: [] };
  if (!hasTable(db)) return empty;
  const node = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ? AND status = 'published'`).get(String(slug));
  if (!node) return empty;
  const rows = db.prepare(`SELECT m.source_kind AS kind, m.source_ref AS ref, m.source_label AS label, m.domain
    FROM atlas_mentions m WHERE m.node_id = ? ORDER BY m.source_label COLLATE NOCASE`).all(node.id);
  const byDomain = new Map();
  for (const r of rows) {
    const k = r.domain || "other";
    if (!byDomain.has(k)) byDomain.set(k, []);
    byDomain.get(k).push({ kind: r.kind, ref: r.ref, label: r.label });
  }
  const groups = [...byDomain.entries()].map(([key, items]) => ({ key, name: domainName(key), count: items.length, items: items.slice(0, shown) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  // postings by the families of the roles that ask for it (stored stats; no posting is read here)
  const postings = [];
  try {
    const s = db.prepare(`SELECT top_roles_json FROM atlas_node_stats WHERE node_id = ?`).pluck().get(node.id);
    const roles = JSON.parse(s || "[]");
    const fam = db.prepare(`SELECT family FROM atlas_nodes WHERE slug = ?`).pluck();
    const by = new Map();
    for (const r of roles) {
      const f = fam.get(r.slug) || null;
      if (!f) continue;
      by.set(f, (by.get(f) || 0) + (r.postings || 0));
    }
    for (const [key, n] of by) postings.push({ key, name: familyName(key) || key, postings: n });
    postings.sort((a, b) => b.postings - a.postings);
  } catch { /* no stats yet */ }
  return { total: rows.length, domains: groups.length, groups, postings };
}

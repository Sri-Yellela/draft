// services/atlas/atlasWikiFind.js — ⭐ D105 P10 (owner 10-31, "yes to all three") · FIND ON WIKIPEDIA.
//
// The nightly matcher (atlasWikidata.js) only takes an EXACT, non-disambiguation article, so the big nodes stay
// unmatched: "distributed systems" redirects to "Distributed computing", "Python" is a disambiguation page, "Java" the
// island fails the software check, a niche name has no article. For each unmatched node the curator is shown
// CANDIDATES with their first sentence, by the node's class (atlas_nodes.wiki_match):
//   inexact        → the redirect target first ("distributed systems → Distributed computing")
//   disambiguation → the COMPUTING entries the disambiguation page links to ("Python (programming language)")
//   not_software   → the matched article itself, with "Use it anyway" (languages, standards and services are tools
//                    that carry no software statement on Wikidata)
//   missing (and anything else) → Wikipedia's search results for the name; or "No article — write a definition" (P11)
// One press stores the WIKIDATA ID (stable across renames) and the title (pickWikiTitle). Redirects alone may be
// accepted as a group, after a preview (redirectPreview → acceptPicks).
//
// The sources, verified live 2026-10-31: MediaWiki Action API — prop=extracts (TextExtracts: exintro, explaintext,
// exsentences=1, exlimit ≤ 20 per request), prop=pageprops (disambiguation, wikibase_item), generator=links on a
// disambiguation page (gplnamespace=0), list=search (srnamespace=0). Same etiquette as the matcher: draft's
// User-Agent, one request at a time, maxlag. ⛔ No model (D17): the first sentence is Wikipedia's, shown as such.
// ⛔ The fetcher is injectable — the tests never touch the network.

import { WIKI_UA } from "./atlasWiki.js";
import { WIKI_ACTION_API, WIKIDATA_DEFAULTS } from "./atlasWikidata.js";
import { updateNode, AtlasEditError } from "./atlasEditor.js";

/** A disambiguation entry is offered only when its qualifier names computing — "Python (programming language)",
 *  "React (software)", "Spark (cluster computing)"; never "(mythology)", "(film)", "(genus)". */
export const COMPUTING_QUALIFIER = /\((?:[^()]*\b)?(programming language|software|computing|computer science|framework|library|database|operating system|file format|protocol|markup language|query language|toolkit|kernel|API|platform|compiler|interpreter|version control|web browser|search engine|game engine|machine learning|data structure|algorithm|networking|cloud|container)s?\)$/i;
const EXTRACT_BATCH = 20;   // TextExtracts' exlimit with exintro
const MAX_CANDIDATES = 8;

const toTitle = (t) => String(t ?? "").trim().replace(/_/g, " ");
const firstSentence = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

async function query(fetchImpl, params, timeoutMs = WIKIDATA_DEFAULTS.timeoutMs) {
  const q = new URLSearchParams({ action: "query", format: "json", formatversion: "2", maxlag: String(WIKIDATA_DEFAULTS.maxlag), ...params });
  const res = await fetchImpl(`${WIKI_ACTION_API}?${q}`, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": WIKI_UA, accept: "application/json" } });
  if (!res.ok) throw Object.assign(new Error(`Wikipedia answered ${res.status}`), { status: res.status });
  const json = await res.json();
  if (json?.error) throw new Error(`Wikipedia: ${json.error.code || "error"}`);
  return json?.query || {};
}

/** Titles → [{ title, item, extract, disambiguation }] in the order given, redirects followed (20 per request). */
export async function describeTitles(fetchImpl, titles) {
  const out = [];
  const list = [...new Set(titles.map(toTitle).filter(Boolean))];
  for (let i = 0; i < list.length; i += EXTRACT_BATCH) {
    const group = list.slice(i, i + EXTRACT_BATCH);
    const q = await query(fetchImpl, { prop: "extracts|pageprops", exintro: "1", explaintext: "1", exsentences: "1", exlimit: String(EXTRACT_BATCH),
      ppprop: "disambiguation|wikibase_item", redirects: "1", titles: group.join("|") });
    const follow = (t) => {
      const n = (q.normalized || []).find(x => x.from === t); if (n) t = n.to;
      const r = (q.redirects || []).find(x => x.from === t); return r ? r.to : t;
    };
    for (const asked of group) {
      const t = follow(asked);
      const p = (q.pages || []).find(x => x.title === t);
      if (!p || p.missing !== undefined || p.invalid !== undefined) continue;
      const props = p.pageprops || {};
      out.push({ title: p.title, item: /^Q\d+$/.test(String(props.wikibase_item || "")) ? props.wikibase_item : null,
        extract: firstSentence(p.extract), disambiguation: Object.prototype.hasOwnProperty.call(props, "disambiguation") });
    }
  }
  return out;
}

/**
 * The candidates for ONE unmatched node, by its class.
 * @returns {{ cls, candidates: { title, item, extract, useAnyway?: boolean }[], writeDefinition: boolean }}
 */
export async function wikiCandidates(fetchImpl, node) {
  const name = toTitle(node.name);
  const cls = node.wiki_match || "missing";
  let titles = [];
  if (cls === "inexact") titles = [name];   // describeTitles follows the redirect: the target comes back first
  else if (cls === "not_software") titles = [name];
  else if (cls === "disambiguation") {
    const q = await query(fetchImpl, { generator: "links", titles: name, gpllimit: "max", gplnamespace: "0" });
    titles = (q.pages || []).map(p => p.title).filter(t => COMPUTING_QUALIFIER.test(t)).slice(0, MAX_CANDIDATES);
  } else {
    const q = await query(fetchImpl, { list: "search", srsearch: name, srlimit: String(MAX_CANDIDATES), srnamespace: "0", srprop: "" });
    titles = (q.search || []).map(s => s.title);
  }
  const described = titles.length ? (await describeTitles(fetchImpl, titles)).filter(c => !c.disambiguation) : [];
  const candidates = described.slice(0, MAX_CANDIDATES).map(c => ({ title: c.title, item: c.item, extract: c.extract,
    ...(cls === "not_software" ? { useAnyway: true } : {}) }));
  return { cls, candidates, writeDefinition: cls === "missing" || cls === "not_in_answer" || !candidates.length };
}

/**
 * Store the curator's pick: the title (through the editor, which drops the old summary and Wikidata resources so the
 * next pass reads the new ones) and the Wikidata ID; the node counts as matched, by this person.
 */
export function pickWikiTitle(db, slug, { title, wikidataId } = {}, by = "admin") {
  const t = toTitle(title);
  if (!t) throw new AtlasEditError("bad_title");
  const item = wikidataId == null || wikidataId === "" ? null : String(wikidataId);
  if (item !== null && !/^Q\d+$/.test(item)) throw new AtlasEditError("bad_wikidata_id");
  updateNode(db, slug, { wikiTitle: t });
  db.prepare(`UPDATE atlas_nodes SET wikidata_id = ?, wiki_title_by = ?, wiki_match = 'matched', wiki_checked_at = unixepoch(),
    updated_at = unixepoch() WHERE slug = ?`).run(item, String(by).slice(0, 120), slug);
  return db.prepare(`SELECT slug, wiki_title, wikidata_id, wiki_title_by, wiki_match FROM atlas_nodes WHERE slug = ?`).get(slug);
}

/** Every REDIRECT node with its target, for the group preview. */
export async function redirectPreview(db, fetchImpl) {
  const rows = db.prepare(`SELECT slug, name FROM atlas_nodes WHERE wiki_match = 'inexact' AND wiki_title IS NULL ORDER BY name COLLATE NOCASE`).all();
  if (!rows.length) return [];
  const target = new Map();   // slug → the title its name redirects to
  for (let i = 0; i < rows.length; i += 50) {
    const group = rows.slice(i, i + 50);
    const q = await query(fetchImpl, { redirects: "1", titles: group.map(g => toTitle(g.name)).join("|") });
    for (const g of group) {
      let t = toTitle(g.name);
      const n = (q.normalized || []).find(x => x.from === t); if (n) t = n.to;
      const red = (q.redirects || []).find(x => x.from === t);
      if (red) target.set(g.slug, red.to);
    }
  }
  const info = new Map((await describeTitles(fetchImpl, [...target.values()])).map(c => [c.title, c]));
  return rows.map(r => {
    const c = info.get(target.get(r.slug));
    return c && !c.disambiguation ? { slug: r.slug, name: r.name, title: c.title, item: c.item, extract: c.extract }
      : { slug: r.slug, name: r.name, title: null };
  });
}

/** Accept several picks at once (the redirect group, after its preview). All or nothing. */
export function acceptPicks(db, picks, by) {
  if (!Array.isArray(picks) || !picks.length || picks.length > 200) throw new AtlasEditError("bad_picks");
  return db.transaction(() => picks.map(p => pickWikiTitle(db, String(p.slug), { title: p.title, wikidataId: p.wikidataId ?? p.item }, by)))();
}

// services/atlas/learnSources.js — ⭐ D176-3 · EVERY LEARN ITEM HAS ITS SOURCE, resolved from the source register
// (content/sources/registry.json) when the content is read — not stored in the content, because production's Learn content
// is the learn_content row (Admin → Atlas → Import content), and a resolver serves whatever is imported, now and later.
//
// How an item finds its source (pure):
//   · no link            → "draft-original" (our own Build / Practice tasks)
//   · a SEARCH link (YouTube results, a Google search, an Open Library search) → the CREATOR the item names (`s`), by the
//     register's id for that creator; a search that names nobody ("YouTube search") has NO source and is flagged
//     `needs_named_source` — it is to be replaced by a link to a named creator
//   · any other link     → the register's source for that host (the one whose own URL is on it; where a host has several,
//     the one whose URL path the link starts with), else the id made from the host
// Owner 11-07 (D176-3): one register row per creator or site, each `to-verify` (link-only until D176-1 reads its licence).
// The register rows were generated from the seed by scripts/d176RegisterLearnSources.mjs.

export const OWN_SOURCE = "draft-original";
const SEARCH = [
  { host: "youtube.com", path: /^\/results/ },
  { host: "google.com", path: /^\/search/ },
  { host: "openlibrary.org", path: /^\/search/ },
];
// ⭐ D178-2: a PLATFORM page (a YouTube video or playlist, an Open Library work) is the creator's, not the platform's —
// its source is the creator named on the item, like a search link's (a replaced search link keeps its attribution).
const PLATFORM = ["youtube.com", "youtu.be", "openlibrary.org"];
const onPlatform = (u) => { const h = hostOf(u); return !!h && PLATFORM.some(p => h === p || h.endsWith(`.${p}`)); };
const UNNAMED = /^(youtube search|google search|search)$/i;
// A search link's `s` is usually its creator ("Computerphile", "Charles Petzold") but sometimes a description of the link
// ("A SQLite clone, step by step", "Google's 2017 TPU paper"). A description is never registered as a source: the item
// is flagged for a named source instead. The creator is the part before the first comma ("Allen Downey, free").
const NOT_A_CREATOR = /^(a|an|the|run|receive|with|through|tune|how|free|documentary|interactive|smart|networks)\b|\b(paper|chart|standards|example|ships|analyzer|adapter|step by step|software|hardware|sample)\b/i;
const NAMED_PROJECT = /^the [\w .-]+ project$/i;   // "The Tor Project" is a publisher
/** The creator a search link names, or null when its `s` describes the link instead. */
export function creatorOf(s) {
  const first = String(s || "").split(",")[0].trim();
  if (!first || UNNAMED.test(first)) return null;
  if (NAMED_PROJECT.test(first)) return first;
  if (NOT_A_CREATOR.test(first) || first.split(/\s+/).length > 6) return null;
  return first;
}

export const slugOf = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const urlOf = (u) => { try { return new URL(u); } catch { return null; } };
export const hostOf = (u) => urlOf(u)?.hostname.replace(/^www\./, "") || null;
/** The id a SITE gets when it has no row: its host without the common top-level ending ("3blue1brown.com" → "3blue1brown"). */
export const hostSlug = (host) => slugOf(String(host || "").replace(/\.(com|org|net|io|ai|dev|ski|edu|co|app)$/, ""));

/** Is this link a search page (the source is then the creator the item names)? */
export function isSearchLink(u) {
  const x = urlOf(u);
  if (!x) return false;
  const h = x.hostname.replace(/^www\./, "");
  return SEARCH.some(s => (h === s.host || h.endsWith(`.${s.host}`)) && s.path.test(x.pathname));
}

/** An index over the register: ids, hosts → [{ id, path }], creators by slug. */
export function registerIndex(reg) {
  const ids = new Set(), hosts = new Map(), creators = new Map();
  for (const s of reg?.sources || []) {
    ids.add(s.id);
    const x = urlOf(s.url);
    if (x && !isSearchLink(s.url)) {
      const h = x.hostname.replace(/^www\./, "");
      if (!hosts.has(h)) hosts.set(h, []);
      hosts.get(h).push({ id: s.id, path: x.pathname.replace(/\/+$/, "") });
    }
    for (const n of [s.id, s.name, s.publisher, ...(s.creators || [])]) if (n) creators.set(slugOf(n), s.id);
  }
  return { ids, hosts, creators };
}

/**
 * One item's source → { id, via: "own" | "creator" | "host", flag? } or { id: null, flag: "needs_named_source" | "unregistered", want }.
 * `want` is the id the item would have — what scripts/d176RegisterLearnSources.mjs registers.
 */
export function itemSource(item, index) {
  if (!item?.u) return { id: OWN_SOURCE, via: "own" };
  if (isSearchLink(item.u) || onPlatform(item.u)) {
    const creator = creatorOf(item.by) || creatorOf(item.s);
    if (!creator) return { id: null, flag: "needs_named_source" };
    const want = slugOf(creator);
    const id = index.creators.get(slugOf(item.s)) || index.creators.get(want) || null;
    return id ? { id, via: "creator" } : { id: null, flag: "unregistered", want, by: "creator", name: creator };
  }
  const h = hostOf(item.u);
  const rows = index.hosts.get(h) || [];
  if (rows.length === 1) return { id: rows[0].id, via: "host" };
  if (rows.length > 1) {
    const p = urlOf(item.u).pathname;
    const best = rows.filter(r => r.path && p.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
    if (best) return { id: best.id, via: "host" };
  }
  const want = hostSlug(h);
  if (index.ids.has(want)) return { id: want, via: "host" };
  return { id: null, flag: "unregistered", want, by: "host", host: h };
}

/** Every item of a Learn document (`{ PARTS }`) with its step id. */
export function learnItems(doc) {
  const out = [];
  for (const p of doc?.PARTS || []) for (const ph of p.phases || []) for (const st of ph.steps || [])
    for (const it of st.items || []) out.push({ stepId: st.id, item: it });
  return out;
}

/** The summary Admin shows: how many items resolve, which are flagged. */
export function learnSourceSummary(doc, reg) {
  const index = registerIndex(reg);
  const r = { items: 0, resolved: 0, own: 0, needsNamedSource: [], unregistered: [] };
  for (const { stepId, item } of learnItems(doc)) {
    r.items++;
    const s = itemSource(item, index);
    if (s.id) { r.resolved++; if (s.via === "own") r.own++; }
    else if (s.flag === "needs_named_source") r.needsNamedSource.push({ stepId, id: item.id, title: item.t });
    else r.unregistered.push({ stepId, id: item.id, want: s.want });
  }
  return r;
}

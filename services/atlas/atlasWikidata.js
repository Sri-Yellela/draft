// services/atlas/atlasWikidata.js — ⭐ D105 P8 (amended 10-31) · a node's Wikipedia title and its Wikidata item, and
// the resources Wikidata states for a tool (its official website, its documentation), with no hand curation.
//
// TWO STEPS, both nightly after the stats (server.js 05:30 cron) and on the curator's button:
//   1. matchWikiTitles — ONE batched MediaWiki Action API query per 50 nodes:
//        GET https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=disambiguation|wikibase_item
//            &redirects=1&titles=A|B|…   → per page: missing? · pageprops.disambiguation? · pageprops.wikibase_item (Q…)
//      · a node with NO wiki_title that the curator never touched (wiki_title_by IS NULL) gets one ONLY when its own
//        name is an existing article that is NOT a disambiguation page — exact up to Wikipedia's own normalisation
//        (first letter, underscores) or a case-only redirect ("Software Engineer" → "Software engineer"); a redirect to a
//        different title is not an exact match and is left alone. The scorer's ambiguous words (Go, Rust, Swift, Spark…
//        atlasStats.AMBIGUOUS_TERMS) and one-letter names are never matched: "Rust" is the oxide's article.
//      · a TOOL's match must also be SOFTWARE on Wikidata: its item states a developer (P178), a software version
//        (P348), a language it is programmed in (P277), a source repository (P1324), an operating system (P306), a
//        platform (P400) or a user manual (P2078) — measured 10-31 on the local board: without this, "Selenium"
//        matched the chemical element (Q876), "Prometheus" the Titan (Q83160), "Java" the island (Q3757), "Snowflake"
//        the ice crystal, "Airflow", "Playwright" and "Looker" non-software articles. Such a tool is left for the
//        curator (e.g. "Selenium_(software)"). One extra batched wbgetentities request per 50 tool matches.
//      · a node whose title the CURATOR set only gains its Wikidata item from that page; the title is never changed.
//   2. wikidataResources — ONE batched Wikibase query per 50 tool nodes with an item:
//        GET https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|sitelinks&sitefilter=enwiki&ids=Q1|Q2…
//      → P856 "official website" and P2078 "user manual URL" (the documentation link), preferred rank first, never a
//        deprecated statement or one with an end time (P582); https only. Written as resources tagged source
//        'wikidata' (official site, then docs), and the item's English Wikipedia article as source 'wikipedia' — read
//        ONCE per item (wikidata_checked_at), so a resource the curator deletes stays deleted; the curator changing the
//        title drops them and they are read again for the new item (atlasEditor.updateNode).
//
// The sources, verified 2026-10-30:
//   · wbgetentities: ids / titles take at most 50 values per request (500 for higher-limit clients)
//     https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities
//   · P856 "official website" — "URL of the official page of an item (current or former)", datatype URL
//     https://www.wikidata.org/wiki/Property:P856
//   · P2078 "user manual URL" — "link to the user manual of the subject (product, program)", datatype URL
//     https://www.wikidata.org/wiki/Property:P2078
//   · pageprops exposes wikibase_item (e.g. "Q937") https://www.mediawiki.org/wiki/API:Pageprops ; disambiguation pages
//     carry the `disambiguation` page property (seen live: "Python", "Go", "React", "Docker" → disambiguation)
//   · etiquette: one request at a time, batch titles with "|", `maxlag` for non-interactive work, a descriptive
//     User-Agent with contact information https://www.mediawiki.org/wiki/API:Etiquette
//   · rate: 200 requests/minute for unauthenticated bots with a compliant User-Agent, across all sites incl. the Action
//     API; honour Retry-After on 429 https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
//   · licence: Wikidata's data is CC0 — a URL from it needs no attribution; Wikipedia's text is not copied here
// We send ONE request at a time with a pause, maxlag=5, at most `maxRequests` per run — a handful a night.
// ⛔ No model (D17): titles are fixed templates around the node's own name. ⛔ The fetcher is injectable — the tests
// never touch the network.

import { WIKI_UA } from "./atlasWiki.js";
import { AMBIGUOUS_TERMS } from "./atlasStats.js";

export const WIKI_ACTION_API = "https://en.wikipedia.org/w/api.php";
export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
export const WIKIDATA_PROPS = Object.freeze({ officialWebsite: "P856", userManual: "P2078", endTime: "P582" });
/** Statements only software carries (labels verified on Wikidata 10-31): developer · software version identifier ·
 *  programmed in · source code repository URL · operating system · platform · user manual URL. */
export const SOFTWARE_MARKERS = Object.freeze(["P178", "P348", "P277", "P1324", "P306", "P400", "P2078"]);
export const isSoftware = (claims) => SOFTWARE_MARKERS.some(p => Array.isArray(claims?.[p]) && claims[p].length > 0);
export const WIKIDATA_DEFAULTS = Object.freeze({ batch: 50, maxRequests: 6, pauseMs: 1500, timeoutMs: 15_000, maxlag: 5 });
const RECHECK_SEC = 30 * 24 * 3600;   // a title that did not match is asked again a month later (articles get written)

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const toTitle = (t) => String(t ?? "").trim().replace(/_/g, " ");
const toStored = (t) => String(t ?? "").trim().replace(/\s+/g, "_").slice(0, 200);
const httpsOnly = (u) => { try { const x = new URL(String(u)); return x.protocol === "https:" && x.hostname && !x.username ? x.href.slice(0, 2000) : null; } catch { return null; } };

// ⭐ BUG 10-31 (production matched 0, local 54): every answer that is not a usable page list is a FAILURE with a
// reason — an HTTP status, "network", or the API's own error code — and is never stamped checked. Before, an Action-API
// `error` other than maxlag came back as `{ json }`, resolved to "no page" and hid its whole batch for 30 days.
async function getJson(fetchImpl, url, timeoutMs, expect) {
  let res;
  try {
    res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": WIKI_UA, accept: "application/json" } });
  } catch (e) { return { failed: true, reason: `network: ${e?.name === "TimeoutError" ? "timeout" : (e?.cause?.code || e?.message || "error")}` }; }
  if (res.status === 429) return { limited: true, reason: "429" };
  if (!res.ok) return { failed: true, reason: String(res.status) };
  let json;
  try { json = await res.json(); } catch { return { failed: true, reason: `${res.status} not JSON` }; }
  if (json?.error?.code === "maxlag") return { limited: true, reason: "maxlag" };   // their servers are busy: stop; tomorrow picks up
  if (json?.error) return { failed: true, reason: `api error: ${String(json.error.code || "unknown").slice(0, 60)}` };
  if (!json || typeof json !== "object" || !json[expect]) return { failed: true, reason: `${res.status} without ${expect}` };
  return { json, reason: String(res.status) };
}

/** One line per Wikimedia request — the status and the User-Agent sent, never a body. */
function note(log, out, step, n, r, count) {
  const why = r.reason || "?";
  out.reasons[why] = (out.reasons[why] || 0) + 1;
  try { log(`[atlas] ${step} request ${n}: ${why} (${count} asked) ua="${WIKI_UA}"`); } catch { /* a log never stops the run */ }
}

/** May the nightly matcher try this node's own name as a title? */
export function matchableName(node) {
  if (node.kind === "stack") return false;
  const term = String(node.term ?? "").trim();
  if (term.length < 2 || AMBIGUOUS_TERMS.has(term)) return false;
  return true;
}

export function actionQueryUrl(titles, { maxlag = WIKIDATA_DEFAULTS.maxlag } = {}) {
  const q = new URLSearchParams({ action: "query", format: "json", formatversion: "2", redirects: "1", prop: "pageprops",
    ppprop: "disambiguation|wikibase_item", maxlag: String(maxlag), titles: titles.join("|") });
  return `${WIKI_ACTION_API}?${q}`;
}

/**
 * ⭐ BUG 10-31 (production: 150 asked, all 200, 0 matched) · WHAT each asked node's answer was — one class per node,
 * stored in atlas_nodes.wiki_match and counted in Admin → Atlas, so a zero always says which kind of zero it is:
 *   matched        — an exact article (a tool's also software on Wikidata) → the title is set
 *   missing        — the answer lists the page as missing / invalid: Wikipedia has no such article
 *   not_in_answer  — the answer does not mention the asked title at all (a mismatch between what was sent and what
 *                    came back — the one class that points at the request or the parser, never at Wikipedia's content)
 *   disambiguation — a disambiguation page ("Python", "Go")
 *   inexact        — a redirect to a different name ("Software Engineer" → "Software engineering"); the owner's pick
 *   not_software   — an exact article, but a tool whose Wikidata item states nothing only software carries
 *   no_item        — an exact article with no Wikidata item (a tool cannot be checked, so it is left)
 */
export const WIKI_MATCH_CLASSES = Object.freeze(["matched", "missing", "not_in_answer", "disambiguation", "inexact", "not_software", "no_item"]);

const present = (v) => v !== undefined && v !== false;

/** @returns {{ cls: string, title: string|null, item: string|null }} — the class, before the software check */
export function classifyAnswer(json, asked) {
  const q = json?.query || {};
  let t = toTitle(asked);
  const norm = (q.normalized || []).find(n => n.from === t);
  if (norm) t = norm.to;
  const beforeRedirect = t;
  const red = (q.redirects || []).find(r => r.from === t);
  if (red) t = red.to;
  const pages = Array.isArray(q.pages) ? q.pages : Object.values(q.pages || {});   // formatversion 1 answers an object
  const page = pages.find(p => p.title === t);
  if (!page) return { cls: "not_in_answer", title: null, item: null };
  if (present(page.missing) || present(page.invalid)) return { cls: "missing", title: null, item: null };
  const props = page.pageprops || {};
  if (Object.prototype.hasOwnProperty.call(props, "disambiguation")) return { cls: "disambiguation", title: t, item: null };
  const item = /^Q\d+$/.test(String(props.wikibase_item || "")) ? props.wikibase_item : null;
  if (red && red.to.toLowerCase() !== beforeRedirect.toLowerCase()) return { cls: "inexact", title: t, item };
  return { cls: item ? "matched" : "no_item", title: t, item };
}

/**
 * One title's answer from an Action API query response.
 * @returns {{ title, item, exact: boolean } | null} — null for a missing page or a disambiguation page
 */
export function resolveQueryTitle(json, asked) {
  const c = classifyAnswer(json, asked);
  if (!c.title || c.cls === "disambiguation") return null;
  return { title: c.title, item: c.item, exact: c.cls !== "inexact" };
}

/**
 * Step 1 — Wikipedia titles (auto, exact only; a tool's only when Wikidata says it is software) and Wikidata items, batched.
 * @returns {{ due, asked, notAsked, matched, items, notSoftware, requests, failed, stopped: boolean, reasons: Record<string, number>,
 *   classes: Record<string, number> }}
 *   reasons — each request's answer ("200", "403", "network: …", "api error: …", "maxlag") and how many times
 *   classes — each ASKED node's answer, by WIKI_MATCH_CLASSES (also stored in atlas_nodes.wiki_match)
 */
export async function matchWikiTitles(db, { fetchImpl = globalThis.fetch, batch = WIKIDATA_DEFAULTS.batch, maxRequests = WIKIDATA_DEFAULTS.maxRequests,
  pauseMs = WIKIDATA_DEFAULTS.pauseMs, timeoutMs = WIKIDATA_DEFAULTS.timeoutMs, now = () => Math.floor(Date.now() / 1000), pause = sleep,
  log = console.log } = {}) {
  const t0 = now();
  const rows = db.prepare(`SELECT id, kind, name, term, wiki_title, wiki_title_by FROM atlas_nodes
    WHERE (wiki_checked_at IS NULL OR wiki_checked_at < ?)
      AND ((wiki_title IS NULL AND wiki_title_by IS NULL) OR (wiki_title IS NOT NULL AND TRIM(wiki_title) != '' AND wikidata_id IS NULL))
    ORDER BY COALESCE(wiki_checked_at, 0), id`).all(t0 - RECHECK_SEC);
  const out = { due: rows.length, asked: 0, notAsked: 0, matched: 0, items: 0, requests: 0, failed: 0, stopped: false, reasons: {},
    classes: Object.fromEntries(WIKI_MATCH_CLASSES.map(c => [c, 0])) };
  const stampAs = db.prepare(`UPDATE atlas_nodes SET wiki_checked_at = ?, wiki_match = ? WHERE id = ?`);
  const checked = { run: (t, cls, id) => { out.classes[cls]++; return stampAs.run(t, cls, id); } };
  const asks = [];
  for (const r of rows) {
    if (r.wiki_title) asks.push({ ...r, ask: toTitle(r.wiki_title), auto: false });
    else if (matchableName(r)) asks.push({ ...r, ask: toTitle(r.name), auto: true });
    else out.notAsked++;   // never tried by name (an ambiguous word, a stack, a too-short term) — and never stamped: only an answer stamps
  }
  const setAuto = db.prepare(`UPDATE atlas_nodes SET wiki_title = ?, wiki_title_by = 'auto', wikidata_id = ?, wiki_checked_at = ?, wiki_match = 'matched', updated_at = unixepoch()
    WHERE id = ? AND wiki_title IS NULL AND wiki_title_by IS NULL`);
  const setItem = db.prepare(`UPDATE atlas_nodes SET wikidata_id = ?, wiki_checked_at = ?, wiki_match = 'matched' WHERE id = ?`);
  const size = Math.max(1, Math.min(Number(batch) || 50, 50));
  const toolHits = [];   // auto matches for TOOL nodes, held until Wikidata says the item is software
  for (let i = 0; i < asks.length && out.requests < maxRequests; i += size) {
    const group = asks.slice(i, i + size);
    if (out.requests > 0 && pauseMs > 0) await pause(pauseMs);
    out.requests++;
    let r;
    try { r = await getJson(fetchImpl, actionQueryUrl([...new Set(group.map(g => g.ask))]), timeoutMs, "query"); } catch (e) { r = { failed: true, reason: `error: ${e.message}` }; }
    note(log, out, "titles", out.requests, r, group.length);
    if (r.limited) { out.stopped = true; break; }
    if (r.failed) { out.failed++; continue; }   // unmarked: asked again next run
    const t = now();
    db.transaction(() => {
      for (const g of group) {
        out.asked++;
        const c = classifyAnswer(r.json, g.ask);
        const exact = c.cls === "matched" || c.cls === "no_item";
        if (g.auto) {
          if (exact && g.kind === "tool") { if (c.item) toolHits.push({ id: g.id, hit: c }); else checked.run(t, "no_item", g.id); }
          else if (exact && setAuto.run(toStored(c.title), c.item, t, g.id).changes) { out.matched++; out.classes.matched++; if (c.item) out.items++; }
          else checked.run(t, c.cls, g.id);
        } else if (c.item && c.cls !== "disambiguation") { setItem.run(c.item, t, g.id); out.items++; out.classes.matched++; }
        else checked.run(t, c.cls === "matched" ? "no_item" : c.cls, g.id);
      }
    })();
  }
  out.notSoftware = 0;
  for (let i = 0; i < toolHits.length && !out.stopped && out.requests < maxRequests; i += size) {
    const group = toolHits.slice(i, i + size);
    if (out.requests > 0 && pauseMs > 0) await pause(pauseMs);
    out.requests++;
    let r;
    try { r = await getJson(fetchImpl, entitiesUrl([...new Set(group.map(g => g.hit.item))]), timeoutMs, "entities"); } catch (e) { r = { failed: true, reason: `error: ${e.message}` }; }
    note(log, out, "software check", out.requests, r, group.length);
    if (r.limited) { out.stopped = true; break; }
    if (r.failed) { out.failed++; continue; }   // unmarked: asked again tomorrow
    const t = now();
    db.transaction(() => {
      for (const g of group) {
        const e = r.json.entities[g.hit.item];
        if (e && isSoftware(e.claims) && setAuto.run(toStored(g.hit.title), g.hit.item, t, g.id).changes) { out.matched++; out.items++; out.classes.matched++; }
        else { checked.run(t, "not_software", g.id); out.notSoftware++; }
      }
    })();
  }
  return out;
}

/** ⭐ BUG 10-31 · the fixed titles the probe asks — two that must match (Machine learning, Kubernetes), one tool that
 *  must pass the software check (PostgreSQL), a plain article (Scalability) and a disambiguation page (Python). */
export const PROBE_TITLES = Object.freeze(["Machine learning", "Kubernetes", "PostgreSQL", "Scalability", "Python"]);
const PROBE_CLAIMS = new Set(["P31", "P582", "P856", "P2078", ...SOFTWARE_MARKERS]);

/**
 * ⭐ BUG 10-31 · ONE real answer of each kind, as THIS server receives it — the Action query for PROBE_TITLES and the
 * wbgetentities answer for their items — with how the matcher reads each title. Production matched 0 of 150 while
 * the same code matched 54 from the agent's machine; this shows what production is actually handed. Two requests,
 * read-only (nothing is written), the bodies returned to the admin only (claims cut to the ones the code reads).
 */
export async function probeWikipedia({ fetchImpl = globalThis.fetch, timeoutMs = WIKIDATA_DEFAULTS.timeoutMs } = {}) {
  const raw = async (url) => {
    try {
      const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": WIKI_UA, accept: "application/json" } });
      const text = await res.text();
      let body = null; try { body = JSON.parse(text); } catch { body = { notJson: text.slice(0, 2000) }; }
      return { url, status: res.status, contentType: res.headers?.get?.("content-type") ?? null, body };
    } catch (e) { return { url, status: null, error: e?.cause?.code || e?.message || "error" }; }
  };
  const query = await raw(actionQueryUrl([...PROBE_TITLES]));
  const read = Object.fromEntries(PROBE_TITLES.map(t => [t, classifyAnswer(query.body, t)]));
  const ids = [...new Set(Object.values(read).map(c => c.item).filter(Boolean))];
  const entities = ids.length ? await raw(entitiesUrl(ids)) : null;
  for (const e of Object.values(entities?.body?.entities || {})) {
    for (const k of Object.keys(e.claims || {})) if (!PROBE_CLAIMS.has(k)) delete e.claims[k]; else e.claims[k] = e.claims[k].slice(0, 3);
    e.software = isSoftware(e.claims);
  }
  return { ua: WIKI_UA, at: new Date().toISOString(), read, query, entities };
}

/** ⭐ BUG 10-31 · Admin → Atlas: each class of the matcher's last answer, with its nodes (the owner's pick list). */
export function wikiMatchSummary(db) {
  const rows = db.prepare(`SELECT slug, name, kind, wiki_match FROM atlas_nodes WHERE wiki_match IS NOT NULL ORDER BY name`).all();
  const nodes = Object.fromEntries(WIKI_MATCH_CLASSES.map(c => [c, []]));
  for (const r of rows) (nodes[r.wiki_match] ||= []).push({ slug: r.slug, name: r.name, kind: r.kind });
  const counts = Object.fromEntries(Object.entries(nodes).map(([c, l]) => [c, l.length]));
  const neverAnswered = db.prepare(`SELECT COUNT(*) FROM atlas_nodes WHERE wiki_match IS NULL`).pluck().get();
  return { counts, neverAnswered, nodes };
}

/** The statement a property's URL is read from: preferred rank first, never deprecated or ended; https only. */
export function pickUrl(claims, prop) {
  const list = Array.isArray(claims?.[prop]) ? claims[prop] : [];
  const live = list.filter(s => s?.rank !== "deprecated" && s?.mainsnak?.snaktype === "value"
    && !(s.qualifiers && s.qualifiers[WIKIDATA_PROPS.endTime]?.length));
  live.sort((a, b) => (b.rank === "preferred") - (a.rank === "preferred"));
  for (const s of live) { const u = httpsOnly(s.mainsnak?.datavalue?.value); if (u) return u; }
  return null;
}

export function entitiesUrl(ids, { maxlag = WIKIDATA_DEFAULTS.maxlag } = {}) {
  const q = new URLSearchParams({ action: "wbgetentities", format: "json", props: "claims|sitelinks", sitefilter: "enwiki",
    maxlag: String(maxlag), ids: ids.join("|") });
  return `${WIKIDATA_API}?${q}`;
}

/**
 * Step 2 — the official site, the documentation and the Wikipedia article for TOOL nodes with a Wikidata item.
 * @returns {{ due, read, official, docs, articles, requests, failed, stopped: boolean, reasons: Record<string, number> }}
 */
export async function wikidataResources(db, { fetchImpl = globalThis.fetch, batch = WIKIDATA_DEFAULTS.batch, maxRequests = WIKIDATA_DEFAULTS.maxRequests,
  pauseMs = WIKIDATA_DEFAULTS.pauseMs, timeoutMs = WIKIDATA_DEFAULTS.timeoutMs, now = () => Math.floor(Date.now() / 1000), pause = sleep,
  log = console.log } = {}) {
  const rows = db.prepare(`SELECT id, name, wikidata_id, wiki_title FROM atlas_nodes
    WHERE kind = 'tool' AND wikidata_id IS NOT NULL AND wikidata_checked_at IS NULL ORDER BY id`).all();
  const out = { due: rows.length, read: 0, official: 0, docs: 0, articles: 0, requests: 0, failed: 0, stopped: false, reasons: {} };
  const put = db.prepare(`INSERT OR IGNORE INTO atlas_resources (node_id, url, title, format, cost, added_by, source) VALUES (?,?,?,?,?,?,?)`);
  const done = db.prepare(`UPDATE atlas_nodes SET wikidata_checked_at = ? WHERE id = ?`);
  const size = Math.max(1, Math.min(Number(batch) || 50, 50));
  for (let i = 0; i < rows.length && out.requests < maxRequests; i += size) {
    const group = rows.slice(i, i + size);
    if (out.requests > 0 && pauseMs > 0) await pause(pauseMs);
    out.requests++;
    let r;
    try { r = await getJson(fetchImpl, entitiesUrl([...new Set(group.map(g => g.wikidata_id))]), timeoutMs, "entities"); } catch (e) { r = { failed: true, reason: `error: ${e.message}` }; }
    note(log, out, "wikidata", out.requests, r, group.length);
    if (r.limited) { out.stopped = true; break; }
    if (r.failed) { out.failed++; continue; }
    const t = now();
    db.transaction(() => {
      for (const g of group) {
        const e = r.json.entities[g.wikidata_id];
        if (!e) continue;   // not in this answer: asked again tomorrow
        out.read++;
        const by = `wikidata:${g.wikidata_id}`;
        const official = pickUrl(e.claims, WIKIDATA_PROPS.officialWebsite);
        const docs = pickUrl(e.claims, WIKIDATA_PROPS.userManual);
        if (official && put.run(g.id, official, `${g.name} — official website`, null, null, by, "wikidata").changes) out.official++;
        if (docs && put.run(g.id, docs, `${g.name} documentation`, "docs", null, by, "wikidata").changes) out.docs++;
        const article = e.sitelinks?.enwiki?.title || toTitle(g.wiki_title);
        if (article) {
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(toStored(article))}`;
          if (put.run(g.id, url, `“${toTitle(article)}” on Wikipedia`, "article", "free", by, "wikipedia").changes) out.articles++;
        }
        done.run(t, g.id);
      }
    })();
  }
  return out;
}

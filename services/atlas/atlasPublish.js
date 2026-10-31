// services/atlas/atlasPublish.js — ⭐ D105 P7 (amended 10-31) · THE ATLAS PUBLISHES ITSELF.
//
// Owner 10-31: "we need to populate the atlas module its empty" — a person publishing hundreds of seeded drafts one
// by one was the wrong design. The bar, re-checked nightly after the board stats (server.js):
//   (a) ≥ AUTO_PUBLISH_MIN_POSTINGS (5) active postings ask for it   — atlas_node_stats.postings, computed (P3)
//   (b) AND either a matched Wikipedia summary (atlas_wiki_cache, a non-empty extract) or a definition (draft's words)
// A node that meets it is published with published_by = AUTO_PUBLISHER. ⛔ Auto-publish only ever PUBLISHES: a page
// whose count later falls under the bar stays published and shows "few open postings" (readNode.fewOpenPostings).
// ⛔ THE OWNER'S UN-PUBLISH WINS: a node a person unpublished carries unpublished_by (atlasStore.setStatus) and is
// never re-published here; the person publishing it again clears the mark. ⛔ Nothing here writes a definition or
// any text — no model (D17); the bar reads what people and Wikipedia wrote.

import { AUTO_PUBLISH_MIN_POSTINGS, AUTO_PUBLISHER } from "./atlasStore.js";
import { matchWikiTitles, wikidataResources } from "./atlasWikidata.js";
import { refreshWikiSummaries } from "./atlasWiki.js";

export { AUTO_PUBLISH_MIN_POSTINGS, AUTO_PUBLISHER };

const HAS_DEFINITION = `TRIM(COALESCE(n.definition, '')) != ''`;
const HAS_WIKI = `EXISTS (SELECT 1 FROM atlas_wiki_cache w WHERE w.node_id = n.id AND TRIM(COALESCE(w.extract, '')) != '')`;

/**
 * Publish every draft that meets the bar and that no person unpublished.
 * @returns {{ published: string[] }} the slugs published by this run
 */
export function autoPublish(db, { now = () => Math.floor(Date.now() / 1000), min = AUTO_PUBLISH_MIN_POSTINGS } = {}) {
  const t = now();
  return db.transaction(() => {
    const due = db.prepare(`SELECT n.id, n.slug FROM atlas_nodes n JOIN atlas_node_stats s ON s.node_id = n.id
      WHERE n.status = 'draft' AND n.unpublished_by IS NULL AND s.postings >= ?
        AND (${HAS_DEFINITION} OR ${HAS_WIKI})
      ORDER BY s.postings DESC, n.name`).all(min);
    const put = db.prepare(`UPDATE atlas_nodes SET status = 'published', published_at = ?, published_by = ?, updated_at = ?
      WHERE id = ? AND status = 'draft' AND unpublished_by IS NULL`);
    const published = [];
    for (const r of due) if (put.run(t, AUTO_PUBLISHER, t, r.id).changes) published.push(r.slug);
    return { published };
  })();
}

/**
 * Why a node is (not) published yet — the admin list's line. Pure over one row of `readinessRows`.
 * @returns {{ ready: boolean, postings, need, hasWiki, hasDefinition, heldBy: string|null, missing: string[] }}
 */
export function readiness(row, min = AUTO_PUBLISH_MIN_POSTINGS) {
  const postings = Number(row.postings) || 0;
  const hasWiki = !!row.has_wiki, hasDefinition = !!row.has_definition;
  const missing = [];
  if (postings < min) missing.push(`postings ${postings} of ${min}`);
  if (!hasWiki && !hasDefinition) missing.push("no Wikipedia summary or definition");
  return { ready: missing.length === 0, postings, need: min, hasWiki, hasDefinition, heldBy: row.unpublished_by || null, missing };
}

/** The columns `readiness` reads, for a SELECT over atlas_nodes n LEFT JOIN atlas_node_stats s. */
export const READINESS_COLUMNS = `COALESCE(s.postings, 0) AS postings, ${HAS_DEFINITION} AS has_definition, ${HAS_WIKI} AS has_wiki,
  n.unpublished_by, n.published_by, n.wiki_title, n.wikidata_id`;

/**
 * ⭐ BUG 10-31 · "Ask again": an unmatched node is skipped for 30 days after an answer said "no such article" — the
 * curator's button clears that, so a run made while Wikipedia was refusing (or before a fix) is not a month lost.
 * Only nodes with no title that no person touched; a curator's title or a cleared title is never re-asked by name.
 * @returns {{ cleared: number }}
 */
export function askWikipediaAgain(db) {
  const r = db.prepare(`UPDATE atlas_nodes SET wiki_checked_at = NULL
    WHERE wiki_checked_at IS NOT NULL AND wiki_title IS NULL AND wiki_title_by IS NULL`).run();
  return { cleared: r.changes };
}

const why = (reasons) => Object.entries(reasons || {}).filter(([k]) => k !== "200").map(([k, n]) => `${k} ×${n}`).join(", ");
const CLASS_WORDS = { missing: "missing", not_in_answer: "not in the answer", disambiguation: "disambiguation", inexact: "redirect to another name",
  not_software: "not software", no_item: "no Wikidata item" };

/**
 * ⭐ BUG 10-31 · the ONE result line for a run of the pipeline — the admin button's and the nightly log's. It shows
 * each step's own counters, and a step that failed or threw is an ERROR in the line, never a quiet "0 matched":
 * the owner's screenshot read "0 Wikipedia title(s) matched …" and named no cause.
 * @returns {{ ok: boolean, line: string }}
 */
export function describeAutoRun(r) {
  const errors = [];
  const t = r.titles || {}, d = r.wikidata || {}, w = r.wikipedia || {};
  const n = r.autoPublish?.published?.length ?? 0;
  if (t.error) errors.push(`Titles step crashed: ${t.error}`);
  else {
    if (t.failed) errors.push(`Wikipedia unreachable: ${t.failed} of ${t.requests} title request(s) failed (${why(t.reasons)})`);
    if (t.stopped) errors.push(`Wikipedia asked us to slow down (${why(t.reasons)}) — stopped; the rest next run`);
  }
  if (d.error) errors.push(`Wikidata step crashed: ${d.error}`);
  else if (d.failed) errors.push(`Wikidata unreachable: ${d.failed} of ${d.requests} request(s) failed (${why(d.reasons)})`);
  if (w.error) errors.push(`Summaries step crashed: ${w.error}`);
  else {
    if (w.failed) errors.push(`Wikipedia summaries: ${w.failed} of ${w.due} failed (${why(w.reasons)})`);
    if (w.stoppedAt429) errors.push(`Wikipedia summaries stopped at the rate limit`);
  }
  const parts = [
    `Titles: ${t.due ?? 0} due · ${t.asked ?? 0} asked · ${t.notAsked ?? 0} not askable · ${t.requests ?? 0} request(s) · ${t.failed ?? 0} failed · ${t.matched ?? 0} matched`
      + ` · ${t.items ?? 0} item(s) · ${t.notSoftware ?? 0} not software`
      + (Object.entries(t.classes || {}).some(([c, n]) => c !== "matched" && n) ? ` (unmatched: ${Object.entries(t.classes).filter(([c, n]) => c !== "matched" && n).map(([c, n]) => `${n} ${CLASS_WORDS[c] || c}`).join(", ")})` : "")
      + (why(t.reasons) ? ` · answers ${why(t.reasons)}` : ""),
    `Wikidata: ${d.official ?? 0} official link(s) of ${d.due ?? 0} due`,
    `Summaries: ${w.fetched ?? 0} of ${w.due ?? 0} read`,
    `${n} page(s) published`,
  ];
  if (!errors.length && (t.due ?? 0) === 0 && (w.due ?? 0) === 0 && n === 0)
    parts.push(`nothing was due — every unmatched node was asked in the last 30 days; "Ask Wikipedia again" clears that`);
  return { ok: errors.length === 0, line: [...errors, parts.join(" · ")].join(" — ") };
}

/**
 * The network half of the nightly run, then the bar: Wikipedia titles + Wikidata items → Wikidata resources →
 * Wikipedia summaries → autoPublish. Each step is polite and capped (its own module); a step that fails does not
 * stop the bar, which then reads what is already cached.
 */
export async function runAtlasAutoPipeline(db, opts = {}) {
  const out = {};
  const step = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = { error: e.message }; } };
  await step("titles", () => matchWikiTitles(db, opts));
  await step("wikidata", () => wikidataResources(db, opts));
  await step("wikipedia", () => refreshWikiSummaries(db, { ...opts, ...(opts.wikiPauseMs != null ? { pauseMs: opts.wikiPauseMs } : {}) }));
  out.autoPublish = autoPublish(db, opts);
  Object.assign(out, describeAutoRun(out));
  return out;
}

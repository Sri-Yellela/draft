// services/atlas/atlasWiki.js — ⭐ D105 · Wikipedia's summary for a node, cached WEEKLY in atlas_wiki_cache.
//
// For nodes with a `wiki_title` — set by the curator (Admin → Data → Atlas) or, ⭐ amended 10-31, by the nightly
// matcher only where the node's own name is an exact, non-disambiguation article (atlasWikidata.js matchWikiTitles;
// the scorer's ambiguous words — Go, Rust, Swift… — are never matched, so a page about Go the language never shows Go
// the game). ⭐ Amended 10-31: DRAFTS are read too (published first) — a matched summary is half of the auto-publish
// bar (atlasPublish.js), so a draft must be able to have one; a public read still shows published pages only. The text is shown as WIKIPEDIA'S, in its own block with its
// licence line and link (atlasStore.readNode → WIKI_LICENCE; d105WikiAttributed) — never blended into `definition`.
//
// The source, verified 2026-10-30:
//   · endpoint  GET https://en.wikipedia.org/api/rest_v1/page/summary/{title}   (https://www.mediawiki.org/wiki/Wikimedia_REST_API)
//               fields read: title, extract, content_urls.desktop.page, thumbnail.source; type 'disambiguation' is skipped
//   · User-Agent — REQUIRED, naming the client and a contact (website or e-mail); a missing or generic one may be
//               refused with 403 (https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy)
//   · rate      — 200 requests/minute for a client with a compliant User-Agent, ≤ 3 concurrent recommended, honour
//               Retry-After on 429 (https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits). We send ONE at a time
//               with a pause, at most `cap` per run — far under it.
//   · licence   — text CC BY-SA 4.0, attribution by a link to the page (https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/en §7)
// ⛔ The fetcher is injectable — the tests never touch the network.

export const WIKI_UA = "draft-atlas/1.0 (https://jobsviadraft.com/atlas; https://jobsviadraft.com/contact)";
export const WIKI_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary/";
export const WIKI_MAX_AGE_SEC = 7 * 24 * 3600;
// cap 100 (was 40): drafts are read too since 10-31; 100 one-at-a-time requests a second apart is ~60/min, well
// under the 200/min a compliant User-Agent is allowed.
export const WIKI_DEFAULTS = Object.freeze({ cap: 100, pauseMs: 1000, timeoutMs: 10_000 });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const httpsOrNull = (u) => { try { const x = new URL(String(u)); return x.protocol === "https:" ? x.href : null; } catch { return null; } };

export function summaryUrl(title) {
  return WIKI_SUMMARY_BASE + encodeURIComponent(String(title).trim().replace(/\s+/g, "_"));
}

/** Parse one summary response into the cache's shape, or null (disambiguation, no extract). */
export function parseSummary(json, title) {
  if (!json || typeof json !== "object" || json.type === "disambiguation") return null;
  const extract = typeof json.extract === "string" ? json.extract.trim().slice(0, 2000) : "";
  if (!extract) return null;
  const fallback = `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).trim().replace(/\s+/g, "_"))}`;
  return {
    title: String(json.title || title).slice(0, 200),
    extract,
    thumbnailUrl: httpsOrNull(json.thumbnail?.source),
    pageUrl: httpsOrNull(json.content_urls?.desktop?.page) || fallback,
  };
}

/**
 * Refresh the summaries that are missing or older than a week, for nodes with a wiki_title (published first).
 * @returns {{ due, fetched, skipped, failed, stoppedAt429: boolean, reasons: Record<string, number> }}
 *   reasons — each failed request's answer ("403", "network: …") and how many times; a failure is never "nothing to read"
 */
export async function refreshWikiSummaries(db, { fetchImpl = globalThis.fetch, cap = WIKI_DEFAULTS.cap, pauseMs = WIKI_DEFAULTS.pauseMs,
  timeoutMs = WIKI_DEFAULTS.timeoutMs, now = () => Math.floor(Date.now() / 1000), pause = sleep, log = console.log } = {}) {
  const t = now();
  const due = db.prepare(`SELECT n.id, n.wiki_title FROM atlas_nodes n LEFT JOIN atlas_wiki_cache w ON w.node_id = n.id
    WHERE n.wiki_title IS NOT NULL AND TRIM(n.wiki_title) != ''
      AND (w.node_id IS NULL OR w.fetched_at < ? OR TRIM(COALESCE(w.extract, '')) = '')   -- an empty extract is never a cache hit (BUG 10-31)
    ORDER BY (n.status = 'published') DESC, COALESCE(w.fetched_at, 0), n.id LIMIT ?`).all(t - WIKI_MAX_AGE_SEC, Math.max(0, Math.min(Number(cap) || 0, 500)));
  const save = db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, thumbnail_url, page_url, fetched_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(node_id) DO UPDATE SET title = excluded.title, extract = excluded.extract, thumbnail_url = excluded.thumbnail_url,
      page_url = excluded.page_url, fetched_at = excluded.fetched_at`);
  const out = { due: due.length, fetched: 0, skipped: 0, failed: 0, stoppedAt429: false, reasons: {} };
  const fail = (why) => { out.failed++; out.reasons[why] = (out.reasons[why] || 0) + 1; };
  for (let i = 0; i < due.length; i++) {
    const n = due[i];
    if (i > 0 && pauseMs > 0) await pause(pauseMs);
    let res;
    try {
      res = await fetchImpl(summaryUrl(n.wiki_title), { redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": WIKI_UA, accept: "application/json" } });
    } catch (e) { fail(`network: ${e?.name === "TimeoutError" ? "timeout" : (e?.cause?.code || e?.message || "error")}`); continue; }
    if (res.status === 429) { out.stoppedAt429 = true; break; }   // their limit: stop the run; tomorrow's picks up
    if (!res.ok) { fail(String(res.status)); continue; }
    let parsed = null;
    try { parsed = parseSummary(await res.json(), n.wiki_title); } catch { parsed = null; }
    if (!parsed) { out.skipped++; continue; }
    save.run(n.id, parsed.title, parsed.extract, parsed.thumbnailUrl, parsed.pageUrl, now());
    out.fetched++;
  }
  if (out.failed) { try { log(`[atlas] wikipedia summaries: ${out.fetched} read, ${out.failed} failed ${JSON.stringify(out.reasons)} ua="${WIKI_UA}"`); } catch { /* never stops the run */ } }
  return out;
}

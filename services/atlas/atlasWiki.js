// services/atlas/atlasWiki.js — ⭐ D105 · Wikipedia's summary for a node, cached WEEKLY in atlas_wiki_cache.
//
// Only for PUBLISHED nodes whose curator set `wiki_title` (Admin → Data → Atlas) — never guessed from the name, so a
// page about Go the language never shows Go the game. The text is shown as WIKIPEDIA'S, in its own block with its
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
export const WIKI_DEFAULTS = Object.freeze({ cap: 40, pauseMs: 1000, timeoutMs: 10_000 });

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
 * Refresh the summaries that are missing or older than a week, for published nodes with a wiki_title.
 * @returns {{ due, fetched, skipped, failed, stoppedAt429: boolean }}
 */
export async function refreshWikiSummaries(db, { fetchImpl = globalThis.fetch, cap = WIKI_DEFAULTS.cap, pauseMs = WIKI_DEFAULTS.pauseMs,
  timeoutMs = WIKI_DEFAULTS.timeoutMs, now = () => Math.floor(Date.now() / 1000), pause = sleep } = {}) {
  const t = now();
  const due = db.prepare(`SELECT n.id, n.wiki_title FROM atlas_nodes n LEFT JOIN atlas_wiki_cache w ON w.node_id = n.id
    WHERE n.status = 'published' AND n.wiki_title IS NOT NULL AND TRIM(n.wiki_title) != ''
      AND (w.node_id IS NULL OR w.fetched_at < ?)
    ORDER BY COALESCE(w.fetched_at, 0), n.id LIMIT ?`).all(t - WIKI_MAX_AGE_SEC, Math.max(0, Math.min(Number(cap) || 0, 500)));
  const save = db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, thumbnail_url, page_url, fetched_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(node_id) DO UPDATE SET title = excluded.title, extract = excluded.extract, thumbnail_url = excluded.thumbnail_url,
      page_url = excluded.page_url, fetched_at = excluded.fetched_at`);
  const out = { due: due.length, fetched: 0, skipped: 0, failed: 0, stoppedAt429: false };
  for (let i = 0; i < due.length; i++) {
    const n = due[i];
    if (i > 0 && pauseMs > 0) await pause(pauseMs);
    let res;
    try {
      res = await fetchImpl(summaryUrl(n.wiki_title), { redirect: "follow", signal: AbortSignal.timeout(timeoutMs),
        headers: { "user-agent": WIKI_UA, accept: "application/json" } });
    } catch { out.failed++; continue; }
    if (res.status === 429) { out.stoppedAt429 = true; break; }   // their limit: stop the run; tomorrow's picks up
    if (!res.ok) { out.failed++; continue; }
    let parsed = null;
    try { parsed = parseSummary(await res.json(), n.wiki_title); } catch { parsed = null; }
    if (!parsed) { out.skipped++; continue; }
    save.run(n.id, parsed.title, parsed.extract, parsed.thumbnailUrl, parsed.pageUrl, now());
    out.fetched++;
  }
  return out;
}

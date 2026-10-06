// ── D45 (owner, 10-07) · THE PER-VIEW CACHE — stale-while-revalidate for ALL · ★ · /d · + ─────────────
//
// "Any panel I open takes a second before it loads and shows empty for the first few seconds." A view
// already seen renders from here at once and is refreshed behind it; a view not seen shows skeletons
// (never the empty state, never another view's cards). Plain functions, no React, so they are tested
// in node.

/** The views, and the one param each sets (none for ALL) — the board's own spelling (JobsPanel buildParams). */
export const VIEW_PARAMS = Object.freeze({ all: null, saved: "starred", pending: "pending", imported: "imported" });

// Params that do not change WHICH rows answer: the cursor (paging mechanics) and posted_after, which
// buildParams derives from Date.now() on every call — keyed on it, no two requests would ever match.
const NOT_KEY = new Set(["cursor", "posted_after"]);

/** A querystring as a stable cache key: sorted, minus the params that do not change the answer. */
export function viewKey(qs) {
  return [...new URLSearchParams(qs)]
    .filter(([k]) => !NOT_KEY.has(k))
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join("&");
}

/** At most this many views are held — enough for the four views across a few filter sets. */
export const VIEW_CACHE_LIMIT = 24;

export function viewCacheGet(cache, key) {
  return cache.get(key) || null;
}

export function viewCacheSet(cache, key, value) {
  cache.delete(key);                       // re-insert so the Map's order is least → most recent
  cache.set(key, value);
  while (cache.size > VIEW_CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

/**
 * The OTHER three views' first pages for the same filters — what the idle prefetch asks for — and the
 * view-less `base` that names the filter set (so a set is prefetched once).
 */
export function otherViewQueries(qs) {
  const p = new URLSearchParams(qs);
  const current = Object.entries(VIEW_PARAMS).find(([, param]) => param && p.get(param) === "1")?.[0] || "all";
  for (const param of Object.values(VIEW_PARAMS)) if (param) p.delete(param);
  p.delete("cursor");
  p.set("page", "1");
  const base = p.toString();
  const views = Object.entries(VIEW_PARAMS)
    .filter(([view]) => view !== current)
    .map(([, param]) => { const q = new URLSearchParams(base); if (param) q.set(param, "1"); return q.toString(); });
  return { base, views };
}

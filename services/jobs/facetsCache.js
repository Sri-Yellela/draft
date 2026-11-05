// services/jobs/facetsCache.js — ⭐ D156 (6) / D151 · THE FILTER SENTENCE'S COUNTS, OFF THE REQUEST PATH'S HOT LOOP.
//
// MEASURED 11-05 (44v, a CPU profile of the 82k copy under Home's reads): every long busy stretch of the event loop was
// boardPageResponse on a request path, and the largest were GET /api/jobs/facets — one call runs a head aggregate, four
// view counts and one aggregate per filter clause, each over the whole board, back to back; Home asks for it on every
// render, and production's p95 for it was 9–14 s, serialised with every other request (D156 (6)'s 02:52Z report).
//
// So the answer is kept per (user, active profile, query) for TTL_MS; a second identical ask while the first is still
// counting waits for that one (single flight) instead of starting another; and ANY write by that user (a decision, a
// star, an import, a profile change — every non-GET request) drops their entries, so a count never outlives the user's
// own change. The board's own churn (crawls, expiry) is covered by the TTL. Only 200 answers are kept.
export const FACETS_TTL_MS = 120_000;
export const FACETS_MAX_ENTRIES = 500;

/** A stable key: the query's keys sorted, empty values dropped, so `?a=1&b=` and `?b=&a=1` are one entry. */
export function facetsKey(userId, profileId, query = {}) {
  const parts = Object.keys(query || {}).sort()
    .filter((k) => query[k] != null && String(query[k]) !== "")
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(query[k]) ? query[k].join(",") : String(query[k]))}`);
  return `${userId}|${profileId ?? ""}|${parts.join("&")}`;
}

export function createFacetsCache({ ttlMs = FACETS_TTL_MS, max = FACETS_MAX_ENTRIES, now = () => Date.now() } = {}) {
  const done = new Map();       // key → { at, value }
  const flying = new Map();     // key → Promise<value>
  const userOf = (key) => key.slice(0, key.indexOf("|"));
  return {
    /**
     * The answer for `key`: a fresh kept one, the one being counted now, or `compute()`'s (kept when its status is 200).
     * Resolves to { value, cache: "hit" | "shared" | "miss", asOf } — asOf the time the kept answer was counted.
     */
    async get(key, compute) {
      const kept = done.get(key);
      if (kept && now() - kept.at < ttlMs) return { value: kept.value, cache: "hit", asOf: kept.at };
      if (kept) done.delete(key);
      if (flying.has(key)) { const value = await flying.get(key); return { value, cache: "shared", asOf: done.get(key)?.at ?? now() }; }
      const started = now();
      const p = (async () => compute())();
      flying.set(key, p);
      try {
        const value = await p;
        if (value?.status === 200 && flying.get(key) === p) {
          if (done.size >= max) done.delete(done.keys().next().value);   // the oldest entry first
          done.set(key, { at: started, value });
        }
        return { value, cache: "miss", asOf: started };
      } finally {
        if (flying.get(key) === p) flying.delete(key);
      }
    },
    /** Drop every entry (kept or in flight) of one user — called on each of their writes. */
    clearUser(userId) {
      const u = String(userId);
      for (const k of [...done.keys()]) if (userOf(k) === u) done.delete(k);
      for (const k of [...flying.keys()]) if (userOf(k) === u) flying.delete(k);   // a count started before the write is not kept
    },
    size: () => done.size,
  };
}

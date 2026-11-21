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

// ⭐ A175 (46d) · `staleMs` (default 0 = off): a kept answer past ttlMs but younger than staleMs is answered AT ONCE
// (cache "stale", with its asOf) while ONE refresh runs behind it — the person never waits for a recount they had a
// minute ago. Their own writes still drop it (clearUser), so a stale answer never outlives their own change.
// ⭐ 47a (D151 Rule 5) · `store` (services/jobs/keptStore.js, optional): a second level that survives a restart. On a miss in
// memory a stored answer younger than `storeStaleMs` is taken in and answered as "stale" (one recount behind it), so a
// first load after a deploy never waits on a whole-board recount; a counted answer is written through; every way an entry
// leaves for the person's own write (clearUser / markStale / updateUser) deletes their stored rows too.
/**
 * ⭐ 47a (D151 Rule 5, measured at 250k × 20 after a restart): a gate for the recounts that run BEHIND a stale answer. Each
 * stale answer started its whole-board recount at once (12–22 s each at 123k candidates), so 20 people's recounts held both
 * request workers and their own next reads queued 40 s behind them. Through one gate (shared by the board's caches) at most
 * `limit` recounts run at a time and the rest wait their turn — a person waiting on a MISS never goes through it.
 */
export function createRefreshGate(limit = 1) {
  let running = 0;
  const queue = [];
  const next = () => {
    while (running < limit && queue.length) {
      const { fn, resolve, reject } = queue.shift();
      running++;
      Promise.resolve().then(fn).then(resolve, reject).finally(() => { running--; next(); });
    }
  };
  return { run: (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); }), status: () => ({ running, waiting: queue.length }) };
}

export function createFacetsCache({ ttlMs = FACETS_TTL_MS, max = FACETS_MAX_ENTRIES, now = () => Date.now(), staleMs = 0, store = null, storeStaleMs = staleMs, refreshGate = null } = {}) {
  const done = new Map();       // key → { at, value }
  const flying = new Map();     // key → Promise<value>
  const userOf = (key) => key.slice(0, key.indexOf("|"));
  return {
    /**
     * The answer for `key`: a fresh kept one, the one being counted now, or `compute()`'s (kept when its status is 200).
     * Resolves to { value, cache: "hit" | "shared" | "miss", asOf } — asOf the time the kept answer was counted.
     */
    async get(key, compute) {
      let kept = done.get(key);
      let fromStore = false;
      if (!kept && store && !flying.has(key)) {
        let s = null;
        try { s = store.read(key); } catch { s = null; }
        if (s && s.value?.status === 200 && Number.isFinite(s.at) && now() - s.at < Math.max(storeStaleMs, ttlMs)) { kept = s; fromStore = true; done.set(key, s); }
      }
      const staleFor = fromStore ? Math.max(storeStaleMs, staleMs) : staleMs;
      if (kept && now() - kept.at < ttlMs) return { value: kept.value, cache: "hit", asOf: kept.at };
      if (kept && staleFor > ttlMs && now() - kept.at < staleFor) {
        if (!flying.has(key)) {
          const p = refreshGate ? refreshGate.run(compute) : (async () => compute())();
          flying.set(key, p);
          p.then(value => { if (value?.status === 200 && flying.get(key) === p) { const at = now(); done.set(key, { at, value }); try { store?.write(key, value, at); } catch { /* memory stands */ } } })
            .catch(() => { /* the stale answer stands until the next ask */ })
            .finally(() => { if (flying.get(key) === p) flying.delete(key); });
        }
        return { value: kept.value, cache: "stale", asOf: kept.at };
      }
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
          try { store?.write(key, value, started); } catch { /* memory stands */ }
        }
        return { value, cache: "miss", asOf: started };
      } finally {
        if (flying.get(key) === p) flying.delete(key);
      }
    },
    /**
     * ⭐ A195 (46j) · SOFT invalidation for a write that moves a count by its own small, known contribution (a stored
     * score: one posting leaves "unscored"). The user's kept entries are aged past ttlMs, so the next ask is answered AT
     * ONCE from the kept answer (cache "stale") while ONE recount runs behind it — instead of a full recount on the
     * request (staging 100k × 20: facets p95 ≈ 600 ms, all of it these recounts). A count started before the write is
     * not kept (as clearUser). Without staleMs this is clearUser. A decision / a star / any other write still clears.
     */
    markStale(userId) {
      if (!(staleMs > ttlMs)) return this.clearUser(userId);
      try { store?.clearUser(userId); } catch { /* memory is aged regardless */ }
      const u = String(userId), aged = now() - ttlMs;
      for (const [k, v] of done) if (userOf(k) === u && v.at > aged) done.set(k, { ...v, at: aged });
      for (const k of [...flying.keys()]) if (userOf(k) === u) flying.delete(k);
    },
    /**
     * ⭐ A195 leftover (46m) · apply ONE of the user's writes to their kept entries in place: fn(key, value) → a new value
     * (kept, its age unchanged), null (dropped) or undefined (unchanged). An answer being computed when the write landed is
     * not kept (it may predate the write), as clearUser.
     */
    updateUser(userId, fn) {
      const u = String(userId);
      try { store?.clearUser(userId); } catch { /* memory is updated regardless */ }
      for (const [k, v] of [...done]) {
        if (userOf(k) !== u) continue;
        let next;
        try { next = fn(k, v.value); } catch { next = null; }
        if (next === null) done.delete(k);
        else if (next !== undefined) done.set(k, { ...v, value: next });
      }
      for (const k of [...flying.keys()]) if (userOf(k) === u) flying.delete(k);
    },
    /** Drop every entry (kept or in flight) of one user — called on each of their writes. */
    clearUser(userId) {
      const u = String(userId);
      try { store?.clearUser(userId); } catch { /* memory is cleared regardless */ }
      for (const k of [...done.keys()]) if (userOf(k) === u) done.delete(k);
      for (const k of [...flying.keys()]) if (userOf(k) === u) flying.delete(k);   // a count started before the write is not kept
    },
    size: () => done.size,
  };
}

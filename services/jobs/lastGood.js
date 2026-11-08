// services/jobs/lastGood.js — ⭐ D151 Rule 2 / D153 (6) (45n) · REQUESTS READ THE LAST GOOD RESULT, NEVER WAIT ON A REFRESH.
//
// A small keyed cache for per-person results that are expensive to work out (best bets walk board pages):
//   · fresh (younger than ttlMs)      → served as is
//   · stale                           → the last good one served AT ONCE with its asOf, ONE refresh started in the
//                                       background (one per key at a time — a second request does not start another)
//   · none yet                        → computed and awaited (the only time a request waits), then kept
//   · a refresh that fails            → the last good one stays; the failure is logged, never shown as "none"
// Bounded (LRU, maxKeys). `invalidate(prefix)` drops a person's entries when their own data changes.
export function createLastGood({ ttlMs = 15 * 60 * 1000, maxKeys = 2000, log = console } = {}) {
  const store = new Map();       // key → { value, asOf (ms) }
  const inflight = new Map();    // key → Promise
  const touch = (k, e) => { store.delete(k); store.set(k, e); if (store.size > maxKeys) store.delete(store.keys().next().value); };
  const refresh = (key, compute) => {
    if (inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve().then(compute).then((value) => { touch(key, { value, asOf: Date.now() }); return value; })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
  return {
    /** → { value, asOf (ISO), stale, refreshing } */
    async get(key, compute, { now = Date.now() } = {}) {
      const e = store.get(key);
      if (e && now - e.asOf < ttlMs) return { value: e.value, asOf: new Date(e.asOf).toISOString(), stale: false, refreshing: inflight.has(key) };
      if (e) {
        refresh(key, compute).catch((err) => log.warn?.(`[last-good] ${key}: refresh failed, the last good one stays (${err.message})`));
        return { value: e.value, asOf: new Date(e.asOf).toISOString(), stale: true, refreshing: true };
      }
      const value = await refresh(key, compute);
      return { value, asOf: new Date().toISOString(), stale: false, refreshing: false };
    },
    invalidate(prefix) { for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k); },
    size: () => store.size,
  };
}

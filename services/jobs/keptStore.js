// services/jobs/keptStore.js — ⭐ 47a (D151 Rule 5, measured at 250k × 20 users) · THE BOARD'S KEPT ANSWERS SURVIVE A RESTART.
//
// The kept order (A175), the Full House counts (A184) and the filter sentence's counts (D156 (6)) lived only in memory
// (services/jobs/facetsCache.js), so every fresh process — every deploy — rebuilt each arriving person's whole-board order
// (2–5 s at 123k candidates) and facet head (up to 30 s) on the two request workers: deck p95 44 s, board p95 22 s, while
// the event loop itself stayed at p99 22 ms. This is the cache's second level in the database (migration 280), under the
// SAME key as in memory, prefixed by the cache's kind — the key already carries the person, the profile, the query, the
// score epoch, the gate's basis and the visit mark, so a new score or résumé is a new key, never a stale hit.
// The cache answers a stored entry as "stale" (one recount behind it, off the person's wait) — see facetsCache's `store`.
// Writes: one small upsert after a count finishes (main thread, a single row); reads: one primary-key row on a miss.
// ⛔ Never a source of truth: any failure here (no table yet, a locked database) is swallowed and the cache counts as before.
export const KEPT_STORE_MAX_AGE_S = 24 * 3600;   // rows older than a day are pruned (a stale answer past this is not served)
export const PRUNE_EVERY_WRITES = 500;

/** A store for createFacetsCache: { read(key) → { at, value } | null, write(key, value, at), clearUser(userId) }. */
export function createKeptStore(db, kind, { now = () => Date.now() } = {}) {
  const k = (key) => `${kind}:${key}`;
  const userOf = (key) => { const n = Number(String(key).slice(0, String(key).indexOf("|"))); return Number.isInteger(n) && n > 0 ? n : null; };
  let writes = 0;
  const stmt = (() => {
    const cache = {};
    return (name, sql) => { try { return (cache[name] ||= db.prepare(sql)); } catch { return null; } };
  })();
  return {
    read(key) {
      try {
        const r = stmt("read", "SELECT value_json, written_at FROM board_kept_cache WHERE cache_key = ?")?.get(k(key));
        if (!r) return null;
        const at = r.written_at * 1000;
        if (now() - at > KEPT_STORE_MAX_AGE_S * 1000) return null;
        return { at, value: JSON.parse(r.value_json) };
      } catch { return null; }
    },
    write(key, value, at = now()) {
      const user = userOf(key);
      if (!user) return;
      try {
        stmt("write", `INSERT INTO board_kept_cache (cache_key, user_id, kind, value_json, written_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET value_json = excluded.value_json, written_at = excluded.written_at`)
          ?.run(k(key), user, kind, JSON.stringify(value), Math.floor(at / 1000));
        if (++writes % PRUNE_EVERY_WRITES === 0) stmt("prune", "DELETE FROM board_kept_cache WHERE written_at < ?")?.run(Math.floor(now() / 1000) - KEPT_STORE_MAX_AGE_S);
      } catch { /* the in-memory answer stands */ }
    },
    clearUser(userId) {
      const n = Number(userId);
      if (!Number.isInteger(n)) return;
      try { stmt("clear", "DELETE FROM board_kept_cache WHERE user_id = ? AND kind = ?")?.run(n, kind); } catch { /* memory is cleared regardless */ }
    },
  };
}

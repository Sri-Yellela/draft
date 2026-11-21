// services/jobs/heldCountCache.js — ⭐ D151 (45k) · THE BOARD'S "N MORE BEING MATCHED", KEPT AND REFRESHED BEHIND THE ANSWER.
//
// MEASURED 11-08 (45k, the 20-user scale suite on the settled 100k fixture, READ_SLOW_MS=150): of the 204 read-pool
// statements over 150 ms in the load window, 203 were ONE statement — the score gate's held read (A126 (7)): "the
// postings this board would show once matched, newest first, up to BOARD_MATCH_BATCH + 1". It walks the recency index
// over every active posting, testing the role / category scope per row until it has 2,001 unscored ones — 170–400 ms a
// time — and EVERY first page asked it: each Full House load, each deck deal (the deck deals from the board), every user.
// Two read workers, ≈ 300 board first pages a minute: that one statement alone was most of the pool's capacity, and
// every other read (the list, the counts, the facets) queued behind it — the Full House p95 of 13.7 s.
//
// The answer is a progress note ("2,000+ more being matched") plus a side effect (queue those postings for scoring), and
// it changes when scoring lands, not between two page loads. So it is KEPT per (user, the board's exact held statement
// and arguments) — the key is the statement, so another filter, another profile or a new résumé basis (the hash is in
// the SQL) is another entry:
//   · fresh (≤ FRESH_MS): answered from the entry, nothing read, nothing re-queued (the queue already holds them);
//   · stale (≤ STALE_MS): answered from the entry AT ONCE, and one refresh runs behind it (single flight per key) —
//     "Tail at Scale"'s good-enough answer: a count a few seconds old, never a wait;
//   · older or absent: read now, as before.
// The person's own scoring landing (the match queue's `board_scored`) drops their entries, so the refetch that event
// triggers reads the new number. Bounded: at most MAX entries, the oldest dropped first.
export const HELD_FRESH_MS = 20_000;
export const HELD_STALE_MS = 300_000;
export const HELD_MAX_ENTRIES = 1000;
// ⭐ 47a (D151 Rule 5, measured at 250k × 20 after a restart): on a fully scored board the held read finds NOTHING and so
// walks every active posting (123k: 9 s on a request worker) — and it re-ran every freshMs per person, 16 such reads in one
// minute holding the pool (the Full House p95 18 s). "Nothing being matched" is kept fresh this long (a new posting is
// scored by the background passes meanwhile); the refresh behind a stale answer goes through the board's shared refresh
// gate (one at a time); and the answer survives a restart (services/jobs/keptStore.js, kind "held").
export const HELD_EMPTY_FRESH_MS = 300_000;

export function heldKey(userId, sql, args) {
  return `${userId}|${sql}|${JSON.stringify(args)}`;
}

export function createHeldCountCache({ freshMs = HELD_FRESH_MS, staleMs = HELD_STALE_MS, max = HELD_MAX_ENTRIES,
  now = () => Date.now(), onRefreshError = (e) => console.warn("[board-match] held refresh:", e?.message),
  emptyFreshMs = HELD_EMPTY_FRESH_MS, store = null, storeStaleMs = staleMs, refreshGate = null } = {}) {
  const isEmpty = (v) => v && Number(v.count) === 0 && !v.more;
  const done = new Map();      // key → { at, value }
  const flying = new Map();    // key → Promise<value>
  const userOf = (key) => key.slice(0, key.indexOf("|"));
  const keep = (key, value, at, fromStore = false) => {
    done.delete(key);
    if (done.size >= max) done.delete(done.keys().next().value);
    done.set(key, { at, value, ...(fromStore ? { fromStore: true } : {}) });
  };
  const run = (key, compute, { behind = false } = {}) => {
    if (flying.has(key)) return flying.get(key);
    const started = now();
    const p = behind && refreshGate ? refreshGate.run(compute) : (async () => compute())();
    flying.set(key, p);
    p.then((value) => { if (flying.get(key) === p) { keep(key, value, started); try { store?.write(key, { status: 200, value }, started); } catch { /* memory stands */ } } },
           () => {})
     .finally(() => { if (flying.get(key) === p) flying.delete(key); });
    return p;
  };
  return {
    /** Resolves to { value, cache: "hit" | "stale" | "miss" | "shared" }. `compute` reads (and queues) — its value is kept. */
    async get(key, compute) {
      let kept = done.get(key);
      let fromStore = !!kept?.fromStore;   // ⭐ 47a: a stored answer keeps the store's window on every later read
      if (!kept && store && !flying.has(key)) {
        let s = null;
        try { s = store.read(key); } catch { s = null; }
        if (s?.value?.status === 200 && Number.isFinite(s.at) && now() - s.at <= storeStaleMs) { kept = { at: s.at, value: s.value.value, fromStore: true }; fromStore = true; keep(key, kept.value, kept.at, true); }
      }
      const age = kept ? now() - kept.at : Infinity;
      if (kept && age <= (isEmpty(kept.value) ? Math.max(freshMs, emptyFreshMs) : freshMs)) return { value: kept.value, cache: "hit" };
      if (kept && age <= (fromStore ? Math.max(staleMs, storeStaleMs) : staleMs)) {
        if (!flying.has(key)) run(key, compute, { behind: true }).catch(onRefreshError);
        return { value: kept.value, cache: "stale" };
      }
      if (kept) done.delete(key);
      const shared = flying.has(key);
      return { value: await run(key, compute), cache: shared ? "shared" : "miss" };
    },
    /** Drop one user's entries (kept and in flight) — their scoring landed, so the held set moved. */
    clearUser(userId) {
      const u = String(userId);
      try { store?.clearUser(userId); } catch { /* memory is cleared regardless */ }
      for (const k of [...done.keys()]) if (userOf(k) === u) done.delete(k);
      for (const k of [...flying.keys()]) if (userOf(k) === u) flying.delete(k);
    },
    size: () => done.size,
  };
}

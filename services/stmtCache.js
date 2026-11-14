// services/stmtCache.js — ⭐ A195 leftover (b) (46m) · ONE PREPARED STATEMENT PER (database, SQL), REUSED.
//
// The 46l profile of the 100k fixture under 10 people (tmp/a195prof — 46 s of main thread) put better-sqlite3's
// `Statement` constructor — SQL compiled on EVERY call — among the top self-time entries: under Your skills map
// (`aliasesOf` ~1 s), the deck (`bestBetSignalsFor` / `eligibilityForJob` ~1.2 s) and others. A better-sqlite3 statement
// is reusable for the life of its database (SQLite recompiles it itself after a schema change), so a statement whose SQL
// TEXT never varies is prepared once per database here.
// ⛔ Only for FIXED SQL text (no values or variable-length IN lists spliced in) — the cache is keyed by the text and is
// never emptied. `pluck` is part of the key (it is a mode set on the statement).
const caches = new WeakMap();   // db → Map(key → Statement)

export function prepared(db, sql, { pluck = false } = {}) {
  let m = caches.get(db);
  if (!m) caches.set(db, (m = new Map()));
  const key = pluck ? `pluck:${sql}` : sql;
  let st = m.get(key);
  if (!st) {
    st = db.prepare(sql);
    if (pluck) st.pluck();
    m.set(key, st);
  }
  return st;
}

/** For tests: how many statements are kept for this database. */
export const preparedCount = (db) => caches.get(db)?.size ?? 0;

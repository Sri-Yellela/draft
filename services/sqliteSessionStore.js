// ── The session store on better-sqlite3 (A127 / O101 (a), owner 11-06) ───────────────────────────────────────────
//
// Replaces connect-sqlite3, whose `sqlite3` 5 driver pulled `tar` (critical), `node-gyp`, `cacache`,
// `make-fetch-happen` and `@tootallnate/once` into the install — the last audit findings with a real fix, and a
// second SQLite driver beside the better-sqlite3 the app already runs on.
//
// ⛔ THE SAME FILE AND THE SAME ROWS. It opens `<dir>/sessions.db`, table `sessions (sid PRIMARY KEY, expired, sess)`,
// with connect-sqlite3's exact semantics — `expired` is epoch MILLISECONDS; a row is live while now <= expired; `set`
// stores now + cookie.maxAge (one day without one); `touch` moves `expired` to the cookie's expiry, only for a live
// row; expired rows are deleted at start and once a day. So switching signs nobody out: every session written by the
// old store reads here, unchanged (test/a127SessionStore.test.js reads a file the old store wrote).
//
// Synchronous by nature (better-sqlite3): each call is one primary-key statement, well under a millisecond; the
// callbacks still run on the next tick so express-session sees the asynchronous shape it was written for.
import path from "path";
import Database from "better-sqlite3";
import session from "express-session";

const ONE_DAY = 86_400_000;

export class SqliteSessionStore extends session.Store {
  /** @param {{ dir: string, db?: string, table?: string, cleanupEveryMs?: number }} options */
  constructor({ dir = ".", db = "sessions.db", table = "sessions", cleanupEveryMs = ONE_DAY } = {}) {
    super();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error(`invalid session table name: ${table}`);
    this.table = table;
    this.file = db === ":memory:" ? db : path.join(dir, db);
    this.db = new Database(this.file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${table} (sid PRIMARY KEY, expired, sess)`);
    const t = table;
    this.q = {
      get: this.db.prepare(`SELECT sess FROM ${t} WHERE sid = ? AND ? <= expired`),
      set: this.db.prepare(`INSERT OR REPLACE INTO ${t} VALUES (?, ?, ?)`),
      destroy: this.db.prepare(`DELETE FROM ${t} WHERE sid = ?`),
      touch: this.db.prepare(`UPDATE ${t} SET expired = ? WHERE sid = ? AND ? <= expired`),
      all: this.db.prepare(`SELECT sid, sess FROM ${t}`),
      length: this.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`),
      clear: this.db.prepare(`DELETE FROM ${t}`),
      cleanup: this.db.prepare(`DELETE FROM ${t} WHERE ? > expired`),
    };
    this.cleanup();
    this.timer = setInterval(() => this.cleanup(), cleanupEveryMs);
    this.timer.unref?.();
    queueMicrotask(() => this.emit("connect"));
  }

  #done(cb, fn) {
    let result, error = null;
    try { result = fn(); } catch (e) { error = e; }
    if (cb) process.nextTick(() => (error ? cb(error) : cb(null, result)));
  }

  cleanup() {
    try { return this.q.cleanup.run(Date.now()).changes; } catch (e) { console.warn("[sessions] cleanup failed:", e.message); return 0; }
  }

  get(sid, cb) {
    this.#done(cb, () => { const row = this.q.get.get(sid, Date.now()); return row ? JSON.parse(row.sess) : undefined; });
  }

  set(sid, sess, cb) {
    this.#done(cb, () => {
      const maxAge = sess?.cookie?.maxAge;
      this.q.set.run(sid, Date.now() + (maxAge ? maxAge : ONE_DAY), JSON.stringify(sess));
    });
  }

  touch(sid, sess, cb) {
    this.#done(cb, () => {
      const expires = sess?.cookie?.expires;
      if (expires) this.q.touch.run(new Date(expires).getTime(), sid, Date.now());
      return true;
    });
  }

  destroy(sid, cb) { this.#done(cb, () => { this.q.destroy.run(sid); }); }

  /** Every row WITH its sid — connect-sqlite3's all() dropped the sid, which revocation needs (server.js). */
  rows(cb) { this.#done(cb, () => this.q.all.all()); }

  all(cb) { this.#done(cb, () => this.q.all.all().map(r => JSON.parse(r.sess))); }
  length(cb) { this.#done(cb, () => this.q.length.get().n); }
  clear(cb) { this.#done(cb, () => { this.q.clear.run(); return true; }); }

  close() { clearInterval(this.timer); this.db.close(); }
}

// ── Sessions sealed at rest ───────────────────────────────────────────────────────────────────
//
// The session store (connect-sqlite3, /app/data/sessions.db) kept every session as plain JSON: who
// is signed in, OAuth state, the auth-context bookkeeping. Anyone holding a copy of the volume — a
// backup, a misplaced download — could read them. This wraps the store so each session is sealed
// with AES-256-GCM before it is written and opened when it is read.
//
// The key is DERIVED (HKDF) from COOKIE_ENCRYPTION_KEY with its own label, so the session key and
// the integration-secret key are different keys from one secret. `cookie` stays in clear beside the
// sealed body because the inner store reads it to compute expiry — it carries no identity.
//
// A row written before this existed (plain JSON) is still READ — and resealed on its next write — so
// turning this on signs nobody out. A sealed row that will not open (a rotated key, a tampered row)
// is treated as NO session: the user signs in again, nothing crashes.
import crypto from "crypto";
import session from "express-session";
import { createSecretBox } from "./secretBox.js";

export function sessionKeyFrom(masterKey) {
  return Buffer.from(crypto.hkdfSync("sha256", masterKey, Buffer.alloc(0), Buffer.from("draft/session-store/v1"), 32));
}

export class EncryptedSessionStore extends session.Store {
  constructor(inner, masterKey) {
    super();
    this.inner = inner;
    this.box = createSecretBox(sessionKeyFrom(masterKey));
    // Forward the inner store's lifecycle events, which express-session listens for.
    for (const ev of ["connect", "disconnect"]) inner.on?.(ev, (...a) => this.emit(ev, ...a));
  }

  seal(sess) {
    const { cookie, ...rest } = sess || {};
    return { cookie, __sealed: this.box.encrypt(JSON.stringify(rest)) };
  }

  open(stored) {
    if (!stored) return null;
    if (!stored.__sealed) return stored;   // legacy plain row: read it, reseal on the next write
    try {
      const { enc, iv, tag } = stored.__sealed;
      return { ...JSON.parse(this.box.decrypt(enc, iv, tag)), cookie: stored.cookie };
    } catch {
      return null;                          // a row that will not open is no session
    }
  }

  get(sid, cb) { this.inner.get(sid, (err, s) => (err ? cb(err) : cb(null, this.open(s)))); }
  set(sid, sess, cb) { this.inner.set(sid, this.seal(sess), cb); }
  touch(sid, sess, cb) {
    if (typeof this.inner.touch === "function") return this.inner.touch(sid, this.seal(sess), cb);
    return this.set(sid, sess, cb);
  }
  destroy(sid, cb) { this.inner.destroy(sid, cb); }

  /**
   * Every sid whose session belongs to `userId` — sealed rows OPENED to see the owner. The sweep in
   * revokeAllUserSessions read `inner.db` rows as plain JSON; behind this wrapper that read threw and
   * was swallowed, so a password reset destroyed no cookie session. It asks here instead.
   */
  sessionsForUser(userId, cb) {
    const { db, table } = this.inner;
    if (!db?.all) return cb(new Error("inner store cannot be scanned"));
    db.all(`SELECT sid, sess FROM ${table}`, (err, rows) => {
      if (err) return cb(err);
      const mine = [];
      for (const row of rows || []) {
        let s = null;
        try { s = this.open(JSON.parse(row.sess)); } catch {}
        if (s && Number(s.passport?.user) === Number(userId)) mine.push(row.sid);
      }
      cb(null, mine);
    });
  }
  length(cb) { this.inner.length ? this.inner.length(cb) : cb(null, 0); }
  clear(cb) { this.inner.clear ? this.inner.clear(cb) : cb?.(); }
}

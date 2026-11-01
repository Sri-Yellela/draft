// ── The admin DB inspector's two guards (A51, 2026-10-02) ─────────────────────────────────────
//
// The inspector is the most useful surface behind the admin check AND the one that reads production
// rows raw, so it is where a mistake costs most. Two things it did not do until A51:
//
// 1. ⛔ SECRETS NEVER LEAVE IT. The Table Browser served any table — `users.password_hash`, the
//    sealed integration secret, session ids, one-time-code hashes — while the CSV export used an
//    allowlist. Every raw row now passes `redactRows`, and the raw query refuses a statement that
//    names a secret column at all (an expression such as substr(password_hash, 1, 8) has no origin
//    column to redact by, so mentioning one is refused instead).
//
// 2. ⛔ THE RAW QUERY IS READ-ONLY BY CONNECTION, NOT BY KEYWORD. It used a keyword blocklist on the
//    shared read-write handle and then `.all()` the whole result into production memory before
//    keeping 200 rows. It now runs on a separate `readonly: true` connection — SQLite itself refuses
//    any write, whatever the spelling — and stops reading at the cap.
//
// ⛔ Diagnosis must keep working: only CREDENTIALS are redacted. Content and basis hashes
// (`basis_hash`, `content_hash`, `shape_hash`…) are how ranking and dedup are debugged and stay
// visible; a redacted value says it was present ("[redacted]") and NULL stays NULL, so "is it set?"
// is still answerable.

export const REDACTED = "[redacted]";

// Explicit names first — each one is a credential, a credential's hash, or a session handle:
//   password_hash (users)            · otp_hash, token_hash (reset / extension tokens)
//   code_hash (email_codes, 113)     · cookies_enc (sealed apply sessions) · secret_enc (OAuth, sealed)
//   apify_token (users, legacy)      · session_sid (auth_contexts, the connect.sid, 090)
//   sid (user_sessions, 113)         · session_id (standalone_usage)
const SECRET_COLUMNS = new Set([
  "password_hash", "otp_hash", "token_hash", "code_hash", "cookies_enc", "secret_enc",
  "apify_token", "session_sid", "sid", "session_id",
  // ⛔ A107 (43v → 43w): Note why's free text is promised "Private: only you see it" (migration 200) — the user's own
  // words about a rejection. Not a secret of the system, but it leaves no admin read: the Table Browser, the raw query,
  // the job inspector's ja.* rows and GET /api/admin/users/:id/applications all redact it here. The quick picks
  // (rejection_reasons) stay — D111 counts them, and they say nothing in the user's own words.
  "rejection_note",
]);
// …and a pattern for the ones a future migration adds. Anchored so token COUNTS (`input_tokens`,
// `monthly_token_budget`) and diagnostic hashes (`basis_hash`) are not caught.
const SECRET_PATTERN = /(^|_)(password|passwd|secret|cookie|cookies|otp|api_?key|private_key|token)$|^(password|otp|code|token|secret)_hash$|_enc$|(^|_)(access|refresh|id)_token$/i;

export function isSecretColumn(name) {
  const n = String(name || "").toLowerCase();
  return SECRET_COLUMNS.has(n) || SECRET_PATTERN.test(n);
}

/** Copy of `row` with every secret column's non-null value replaced. Not mutating: rows may be cached. */
export function redactRow(row) {
  if (!row || typeof row !== "object") return row;
  let out = null;
  for (const k of Object.keys(row)) {
    if (row[k] != null && isSecretColumn(k)) { out ??= { ...row }; out[k] = REDACTED; }
  }
  return out || row;
}

export const redactRows = (rows) => (Array.isArray(rows) ? rows.map(redactRow) : rows);

/** Names of secret columns a SQL text mentions — used to refuse, since an expression has no origin. */
export function secretColumnsMentioned(sql) {
  const words = String(sql || "").toLowerCase().match(/[a-z_][a-z0-9_]*/g) || [];
  return [...new Set(words.filter(isSecretColumn))];
}

export const RAW_QUERY_ROW_CAP = 200;

/**
 * Run one admin SQL statement on a READ-ONLY connection, reading at most `cap` rows.
 * `conn` must be a better-sqlite3 Database opened with { readonly: true }: the connection is the
 * guard. A non-reader statement is refused before it runs; a write that slips through still fails in
 * SQLite (SQLITE_READONLY). Columns are redacted by their ORIGIN column too, so an alias
 * (`password_hash AS x`) does not unmask one.
 */
export function runReadOnlyQuery(conn, sql, cap = RAW_QUERY_ROW_CAP) {
  if (!conn?.readonly) throw new Error("refusing to run an admin query on a writable connection");
  const stmt = conn.prepare(sql);
  if (!stmt.reader) throw Object.assign(new Error("Only statements that return rows are allowed"), { status: 400 });
  const cols = stmt.columns();
  const secretOut = new Set(cols.filter(c => isSecretColumn(c.name) || isSecretColumn(c.column)).map(c => c.name));
  const rows = [];
  let truncated = false;
  for (const row of stmt.iterate()) {
    if (rows.length >= cap) { truncated = true; break; }   // break closes the iterator: nothing more is read
    for (const k of secretOut) if (row[k] != null) row[k] = REDACTED;
    rows.push(row);
  }
  return { columns: cols.map(c => c.name), rows, count: rows.length, truncated };
}

// services/adminAccounts.js — ⛔ D95 · AN ADMIN IS NOT A USER. Its own table, its own sign-in, its own session.
//
// Owner, 10-12: "The admin account is NEVER a user account … admin and general user accounts must never mix" and
// "the admin account is not remotely close to a user account … this segregation has to clearly exist and [be]
// tokenised, which can be used to identify it."
//
// So every admin credential and identity CARRIES ITS KIND IN ITS SHAPE — readable without a database lookup:
//
//     admin identity     adm_<16 base32>        admin_accounts.public_id — what an audit row or actor column names
//     admin session      dft_adm_<43 base64url> the draft_admin cookie, Path=/api/admin, SameSite=Strict
//     admin sign-in link dft_adml_<43 base64url> one use, 30 minutes, sets the password
//
// A user credential never starts with these, and nothing outside /api/admin accepts one (refuseAdminCredential in
// services/adminGuard.js). Nothing here touches `users`: an admin has no profile, résumé, draft, ticket, token or
// connected app, because there is no users row for any of those to hang from.
import crypto from "node:crypto";
import { hashPassword, verifyPassword } from "./authSecurity.js";

export const ADMIN_ID_PREFIX = "adm_";
export const ADMIN_SESSION_PREFIX = "dft_adm_";
export const ADMIN_LINK_PREFIX = "dft_adml_";
export const ADMIN_COOKIE = "draft_admin";
export const ADMIN_COOKIE_PATH = "/api/admin";
// Shorter than a user's: an admin session can change every account.
export const ADMIN_IDLE_SECONDS = 8 * 3600;
export const ADMIN_ABSOLUTE_SECONDS = 24 * 3600;
export const ADMIN_LINK_SECONDS = 30 * 60;
export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_REFUSAL = "This is an administrator account. Use a personal account.";

const now = () => Math.floor(Date.now() / 1000);
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const B32 = "abcdefghijkmnpqrstuvwxyz23456789";
// A real bcrypt hash of a secret nobody holds, so a sign-in for an unknown email costs what a real one costs.
let dummyHash = null;
const dummy = () => (dummyHash ??= hashPassword(crypto.randomBytes(24).toString("base64url")));

export class AdminAccountError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/** Is this string an admin credential or identity? By its shape alone. */
export const isAdminSessionToken = (t) => typeof t === "string" && t.startsWith(ADMIN_SESSION_PREFIX);
export const isAdminLinkToken = (t) => typeof t === "string" && t.startsWith(ADMIN_LINK_PREFIX);
export const isAdminCredential = (t) => isAdminSessionToken(t) || isAdminLinkToken(t);
export const isAdminPublicId = (s) => typeof s === "string" && /^adm_[a-z2-9]{16}$/.test(s);

function newPublicId() {
  const bytes = crypto.randomBytes(16);
  return ADMIN_ID_PREFIX + Array.from(bytes, (b) => B32[b % B32.length]).join("");
}
const newSecret = (prefix) => prefix + crypto.randomBytes(32).toString("base64url");
const normEmail = (e) => String(e ?? "").trim().toLowerCase();
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** The shape every caller sees — never the hash. */
export function publicAdmin(row) {
  if (!row) return null;
  return { publicId: row.public_id, email: row.email, isOwner: !!row.is_owner, createdAt: row.created_at,
    disabledAt: row.disabled_at ?? null, disabledReason: row.disabled_reason ?? null, lastSignInAt: row.last_sign_in_at ?? null,
    passwordSet: !!row.password_hash, kind: "admin" };
}

/** Does any USER account use this email (profile email or a username equal to it)? Principle 5: two accounts, two emails. */
export function emailBelongsToUser(db, email) {
  const e = normEmail(email);
  if (!e) return false;
  try {
    if (db.prepare("SELECT 1 FROM user_profile WHERE LOWER(TRIM(email)) = ? LIMIT 1").get(e)) return true;
  } catch { /* no profile table */ }
  return !!db.prepare("SELECT 1 FROM users WHERE LOWER(username) = ? LIMIT 1").get(e);
}

/** Does an admin account use this email? Read by user sign-up so the two never share one. */
export function emailBelongsToAdmin(db, email) {
  const e = normEmail(email);
  if (!e) return false;
  try { return !!db.prepare("SELECT 1 FROM admin_accounts WHERE email = ? LIMIT 1").get(e); }
  catch { return false; }
}

export const getAdminById = (db, id) => db.prepare("SELECT * FROM admin_accounts WHERE id = ?").get(id) || null;
export const getAdminByPublicId = (db, pid) => db.prepare("SELECT * FROM admin_accounts WHERE public_id = ?").get(String(pid)) || null;
export const countAdmins = (db) => db.prepare("SELECT COUNT(*) FROM admin_accounts").pluck().get();

/** Create an admin account. No password: the person sets one from a sign-in link sent to the email. */
export function createAdminAccount(db, { email, isOwner = false, createdBy = "system" }) {
  const e = normEmail(email);
  if (!looksLikeEmail(e)) throw new AdminAccountError("Give the admin account's email address.");
  if (emailBelongsToUser(db, e)) {
    throw new AdminAccountError("That email belongs to a user account. An admin account needs its own email — a person who is both has two accounts.", 409);
  }
  if (db.prepare("SELECT 1 FROM admin_accounts WHERE email = ?").get(e)) throw new AdminAccountError("An admin account with that email already exists.", 409);
  const publicId = newPublicId();
  const id = db.prepare("INSERT INTO admin_accounts (public_id, email, is_owner, created_by) VALUES (?, ?, ?, ?)")
    .run(publicId, e, isOwner ? 1 : 0, String(createdBy)).lastInsertRowid;
  return getAdminById(db, id);
}

/**
 * Break glass (i): ADMIN_OWNER_EMAIL names the owner. Boot makes sure an ENABLED owner account exists for it, so a
 * sign-in link can always be asked for. It never sets or resets a password and never re-enables a disabled one —
 * a disabled owner is the owner's decision, undone from the console by another owner.
 */
export function ensureOwnerAdmin(db, email, { log = console } = {}) {
  const e = normEmail(email);
  if (!e) return null;
  const existing = db.prepare("SELECT * FROM admin_accounts WHERE email = ?").get(e);
  if (existing) return existing;
  try { return createAdminAccount(db, { email: e, isOwner: true, createdBy: "system:ADMIN_OWNER_EMAIL" }); }
  catch (err) { log.warn?.(`[admin] ADMIN_OWNER_EMAIL not applied: ${err.message}`); return null; }
}

/** A one-time link that sets the password. Returns the secret ONCE; only its hash is stored. */
export function issueSignInLink(db, adminId) {
  const a = getAdminById(db, adminId);
  if (!a || a.disabled_at) return null;
  const token = newSecret(ADMIN_LINK_PREFIX);
  db.prepare("INSERT INTO admin_sign_in_links (token_hash, admin_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), a.id, now() + ADMIN_LINK_SECONDS);
  return { token, admin: a };
}

/** Use a link: set the password, mark the link used, return the admin (or null — one generic failure). */
export function consumeSignInLink(db, token, password) {
  if (!isAdminLinkToken(token)) return null;
  if (typeof password !== "string" || password.length < ADMIN_PASSWORD_MIN) {
    throw new AdminAccountError(`An admin password is at least ${ADMIN_PASSWORD_MIN} characters.`);
  }
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM admin_sign_in_links WHERE token_hash = ?").get(sha256(token));
    if (!row || row.used_at || row.expires_at <= now()) return null;
    const a = getAdminById(db, row.admin_id);
    if (!a || a.disabled_at) return null;
    db.prepare("UPDATE admin_sign_in_links SET used_at = ? WHERE token_hash = ?").run(now(), row.token_hash);
    // every other open link for this admin dies with it
    db.prepare("UPDATE admin_sign_in_links SET used_at = ? WHERE admin_id = ? AND used_at IS NULL").run(now(), a.id);
    db.prepare("UPDATE admin_accounts SET password_hash = ?, password_set_at = ? WHERE id = ?").run(hashPassword(password), now(), a.id);
    // a new password ends every session the old one opened
    db.prepare("UPDATE admin_sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL").run(now(), a.id);
    return getAdminById(db, a.id);
  })();
}

/** Email + password → the admin, or null. Unknown, disabled, no password and wrong password are ONE answer. */
export function verifyAdminSignIn(db, email, password) {
  const a = db.prepare("SELECT * FROM admin_accounts WHERE email = ?").get(normEmail(email));
  const ok = verifyPassword(String(password ?? ""), a?.password_hash || dummy());
  if (!a || !a.password_hash || a.disabled_at || !ok) return null;
  return a;
}

/** Break glass (ii): the offline passphrase whose bcrypt hash is ADMIN_BREAK_GLASS_HASH. Only an enabled OWNER. */
export function verifyBreakGlass(db, { email, passphrase, hash }) {
  if (!hash) return null;
  const a = db.prepare("SELECT * FROM admin_accounts WHERE email = ?").get(normEmail(email));
  let ok = false;
  try { ok = verifyPassword(String(passphrase ?? ""), hash); } catch { ok = false; }   // a malformed hash is a no
  if (!a || !a.is_owner || a.disabled_at || !ok) return null;
  return a;
}

export function createAdminSession(db, adminId, { userAgent = null, ipHint = null, breakGlass = false } = {}) {
  const token = newSecret(ADMIN_SESSION_PREFIX);
  const t = now();
  db.prepare(`INSERT INTO admin_sessions (token_hash, admin_id, created_at, expires_at, last_seen_at, user_agent, ip_hint, break_glass)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(sha256(token), adminId, t, t + ADMIN_IDLE_SECONDS, t, userAgent ? String(userAgent).slice(0, 200) : null, ipHint, breakGlass ? 1 : 0);
  db.prepare("UPDATE admin_accounts SET last_sign_in_at = ? WHERE id = ?").run(t, adminId);
  return token;
}

/** A live session → { admin, session }, sliding its idle window forward, never past the absolute one. */
export function resolveAdminSession(db, token) {
  if (!isAdminSessionToken(token)) return null;
  const t = now();
  const s = db.prepare("SELECT * FROM admin_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?").get(sha256(token), t);
  if (!s) return null;
  const a = getAdminById(db, s.admin_id);
  if (!a || a.disabled_at) return null;
  const slid = Math.min(t + ADMIN_IDLE_SECONDS, s.created_at + ADMIN_ABSOLUTE_SECONDS);
  if (slid > s.expires_at) db.prepare("UPDATE admin_sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?").run(t, slid, s.token_hash);
  else db.prepare("UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?").run(t, s.token_hash);
  return { admin: a, session: s };
}

export function revokeAdminSession(db, token) {
  if (!isAdminSessionToken(token)) return false;
  return db.prepare("UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(now(), sha256(token)).changes > 0;
}

export function listAdminAccounts(db) {
  return db.prepare("SELECT * FROM admin_accounts ORDER BY is_owner DESC, created_at ASC, id ASC").all().map(publicAdmin);
}

/** Disable an admin: every session ends. The last enabled owner can never be disabled — nobody is ever locked out. */
export function disableAdminAccount(db, { publicId, reason, by }) {
  const why = String(reason ?? "").trim();
  if (why.length < 3) throw new AdminAccountError("Say why — a reason of a few words.");
  const a = getAdminByPublicId(db, publicId);
  if (!a) throw new AdminAccountError("No such admin account.", 404);
  if (a.disabled_at) throw new AdminAccountError("That admin account is already disabled.");
  if (by?.adminId === a.id) throw new AdminAccountError("You cannot disable the account you are signed in with.");
  if (a.is_owner) {
    const others = db.prepare("SELECT COUNT(*) FROM admin_accounts WHERE is_owner = 1 AND disabled_at IS NULL AND id != ?").pluck().get(a.id);
    if (!others) throw new AdminAccountError("This is the last enabled owner account — it cannot be disabled.", 409);
  }
  db.transaction(() => {
    db.prepare("UPDATE admin_accounts SET disabled_at = ?, disabled_reason = ? WHERE id = ?").run(now(), why.slice(0, 500), a.id);
    db.prepare("UPDATE admin_sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL").run(now(), a.id);
    db.prepare("UPDATE admin_sign_in_links SET used_at = ? WHERE admin_id = ? AND used_at IS NULL").run(now(), a.id);
  })();
  return publicAdmin(getAdminById(db, a.id));
}

export function enableAdminAccount(db, { publicId }) {
  const a = getAdminByPublicId(db, publicId);
  if (!a) throw new AdminAccountError("No such admin account.", 404);
  if (!a.disabled_at) throw new AdminAccountError("That admin account is not disabled.");
  db.prepare("UPDATE admin_accounts SET disabled_at = NULL, disabled_reason = NULL WHERE id = ?").run(a.id);
  return publicAdmin(getAdminById(db, a.id));
}

/**
 * ⭐ BOOTSTRAP (owner, 10-13: no email reached them — production has no RESEND_API_KEY). Until ANY enabled admin
 * account has a password, the switch-off legacy admin (already signed in to the console) may finish setting the
 * first ones up: send links, and set an account's FIRST password directly. Nothing secret is displayed — the person
 * types their own new password — and once one admin account has a password this door is shut for good.
 */
export function adminBootstrapping(db) {
  try { return !db.prepare("SELECT 1 FROM admin_accounts WHERE password_hash IS NOT NULL AND disabled_at IS NULL").get(); }
  catch { return false; }
}

/** The FIRST password of an admin account that has none (bootstrap only — the route checks adminBootstrapping). */
export function setFirstAdminPassword(db, { publicId, password }) {
  if (typeof password !== "string" || password.length < ADMIN_PASSWORD_MIN) {
    throw new AdminAccountError(`An admin password is at least ${ADMIN_PASSWORD_MIN} characters.`);
  }
  const a = getAdminByPublicId(db, publicId);
  if (!a) throw new AdminAccountError("No such admin account.", 404);
  if (a.disabled_at) throw new AdminAccountError("That admin account is disabled.");
  if (a.password_hash) throw new AdminAccountError("That admin account already has a password — it changes from a sign-in link.", 409);
  db.transaction(() => {
    db.prepare("UPDATE admin_accounts SET password_hash = ?, password_set_at = ? WHERE id = ?").run(hashPassword(password), now(), a.id);
    db.prepare("UPDATE admin_sign_in_links SET used_at = ? WHERE admin_id = ? AND used_at IS NULL").run(now(), a.id);
  })();
  return getAdminById(db, a.id);
}

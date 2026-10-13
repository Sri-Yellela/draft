// services/adminGuard.js — ⛔ D95 · THE DOOR BETWEEN THE TWO KINDS OF ACCOUNT, in one place.
//
// bindAdminSession — runs on every request, after the user credential is bound:
//   · an admin credential (dft_adm_… / dft_adml_…) presented as a HEADER or in the QUERY is refused everywhere —
//     an admin session travels only in its own cookie, and a link only to its own route's body;
//   · on /api/admin/* the draft_admin cookie is read; a live session sets req.admin + req.actor and REMOVES any user
//     identity from the request, so no admin code can read a person's id by accident.
// requireAdmin — the admin session, always; the legacy is_admin USER only while ADMIN_ACCOUNTS_ENFORCE is off.
// The cookie is Path=/api/admin, so a user route, the consent screen and /mcp never receive it at all.
import { ADMIN_COOKIE, ADMIN_COOKIE_PATH, ADMIN_REFUSAL, ADMIN_IDLE_SECONDS, isAdminCredential, resolveAdminSession } from "./adminAccounts.js";
import { adminActor, userActor } from "./actor.js";

export const ADMIN_SESSION_REFUSAL = "Administrator sign-in happens at /admin/login, in its own session.";

/**
 * ADMIN_ACCOUNTS_ENFORCE — only admin accounts reach the console. ⛔ Phase 2 (owner 10-13, "now enforce"): ON by
 * default. The variable exists only to roll back: "0" / "false" / "off" restores the Phase 1 legacy path (which, after
 * migration 162, no users row can satisfy anyway — the rollback also needs 162's triggers dropped; WORKLOG 42).
 */
export function adminEnforced(env = process.env) {
  const v = String(env.ADMIN_ACCOUNTS_ENFORCE ?? "").trim();
  if (!v) return true;
  return !/^(0|false|off|no)$/i.test(v);
}

export function readCookie(req, name) {
  const raw = String(req?.headers?.cookie || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return part.slice(i + 1).trim(); }
    }
  }
  return null;
}

export const isAdminPath = (req) => {
  const p = String(req?.originalUrl ?? req?.url ?? "").split("?")[0];
  return p === ADMIN_COOKIE_PATH || p.startsWith(`${ADMIN_COOKIE_PATH}/`);
};

/** Every credential a request carries outside the cookie jar. */
function presentedTokens(req) {
  const out = [];
  const h = req?.headers || {};
  if (h["x-rm-auth-context"]) out.push(String(h["x-rm-auth-context"]));
  const bearer = String(h.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) out.push(bearer);
  if (req?.query?.authContext) out.push(String(req.query.authContext));
  return out;
}

export function adminCookieOptions({ production }) {
  return { httpOnly: true, secure: !!production, sameSite: "strict", path: ADMIN_COOKIE_PATH, maxAge: ADMIN_IDLE_SECONDS * 1000 };
}

export function createAdminSessionBinder({ db, enforced = () => adminEnforced(), log = console }) {
  return function bindAdminSession(req, res, next) {
    req.adminEnforced = !!enforced();
    if (presentedTokens(req).some(isAdminCredential)) {
      log.warn?.(`[admin] an admin credential was sent outside its cookie — refused | ${req.method} ${req.path}`);
      return res.status(403).json({ error: ADMIN_SESSION_REFUSAL, code: "admin_credential" });
    }
    if (!isAdminPath(req)) return next();
    const token = readCookie(req, ADMIN_COOKIE);
    if (!token) return next();
    let found = null;
    try { found = resolveAdminSession(db, token); } catch (e) { log.warn?.("[admin] session read failed:", e.message); }
    if (!found) return next();
    req.admin = found.admin;
    req.adminSession = found.session;
    req.adminSessionToken = token;
    req.actor = adminActor(found.admin);
    // ⛔ An admin request carries NO user. Whatever cookie or tab token also came along is not this request's identity.
    req.user = undefined;
    req.authContextToken = undefined;
    req.authContextUserAgent = undefined;
    next();
  };
}

/**
 * requireAdmin. `legacy(req)` answers the pre-D95 question — is this a signed-in users row with is_admin, not the
 * extension? — and is asked only while enforcement is off. `isExtensionRequest(req)` refuses the extension first,
 * whatever it carries (shared/authPolicy.js).
 */
export function createRequireAdmin({ legacy, isExtensionRequest, log = console }) {
  return function requireAdmin(req, res, next) {
    if (isExtensionRequest(req)) {
      log.warn?.(`[auth] admin route refused to the extension | ${req.method} ${req.path}`);
      return res.status(403).json({ error: "Forbidden." });
    }
    if (req.admin) return next();
    if (!req.adminEnforced && legacy(req)) {
      if (!req.actor && req.user) req.actor = userActor(req.user);
      return next();
    }
    res.status(403).json({ error: "Forbidden." });
  };
}

/** The plain refusal every token-minting door gives an admin identity (extension, phone, connector consent). */
export function refuseAdmin(res, status = 403) {
  return res.status(status).json({ error: ADMIN_REFUSAL, code: "admin_account" });
}

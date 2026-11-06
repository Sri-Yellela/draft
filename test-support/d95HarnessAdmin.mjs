// D95 · an admin for a REAL-SERVER harness (scripts/ah1SessionIdentity.mjs, aj1MobileBearer.mjs, dx2ExtensionIdentity.mjs).
// An admin is NOT a users row: it is an admin_accounts row. Boot creates one from ADMIN_OWNER_EMAIL with no password
// (server.js ensureOwnerAdmin); its password is set by a one-time sign-in link, and it signs in at
// /api/admin/auth/login into its own draft_admin cookie (path /api/admin). The legacy ADMIN_USER / ADMIN_PASSWORD
// bootstrap into `users` was removed in D95 Phase 2 (10-13). A harness skips only the email: it issues the link
// straight from the throwaway database and spends it through the real route. Synthetic addresses only.
import Database from "better-sqlite3";
import { issueSignInLink, ADMIN_COOKIE } from "../services/adminAccounts.js";

/** The env a harness boots the server with so it creates the admin account. */
export const d95AdminEnv = (email) => ({ ADMIN_OWNER_EMAIL: email });

const cookieFrom = (res) => {
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(";");
    if (pair.startsWith(`${ADMIN_COOKIE}=`)) return pair;
  }
  return null;
};

/** The admin_accounts row boot made for `email` (read-only), or null. */
export function d95AdminRow(dbPath, email) {
  const d = new Database(dbPath, { readonly: true });
  try { return d.prepare("SELECT id, public_id, email, is_owner FROM admin_accounts WHERE email = ?").get(email) || null; }
  finally { d.close(); }
}

/**
 * Sets the admin's password through a sign-in link spent at POST /api/admin/auth/set-password.
 * → { ok, status, body, row } — row is the admin_accounts row (null if boot did not make one).
 */
export async function setD95AdminPassword({ base, dbPath, email, password }) {
  const row = d95AdminRow(dbPath, email);
  if (!row) return { ok: false, status: 0, body: "no admin_accounts row for " + email, row: null };
  const w = new Database(dbPath);
  let link;
  try { link = issueSignInLink(w, row.id); } finally { w.close(); }
  const res = await fetch(`${base}/api/admin/auth/set-password`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: link?.token, password }),
  });
  const body = await res.text();
  return { ok: res.status === 200, status: res.status, body, row };
}

/** Signs in at POST /api/admin/auth/login. → { ok, status, cookie } — cookie is "draft_admin=…" or null. */
export async function signInD95Admin({ base, email, password }) {
  const res = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  await res.text();
  const cookie = cookieFrom(res);
  return { ok: res.status === 200 && !!cookie, status: res.status, cookie };
}

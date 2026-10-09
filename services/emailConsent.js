// services/emailConsent.js — ⭐ D73 §B 2, 3, 6 · marketing consent, stored honestly; a one-click unsubscribe that
// works signed out; and the marketing sender — which NOTHING calls.
//
// ⛔ Consent is a checkbox at sign-up, OFF by default, never inferred and never bundled with the terms;
// recorded with when and where (users.marketing_opt_in / _at / _source). Unsubscribing clears it and stamps
// users.unsubscribed_at; it never touches service mail (a reset link still goes to an unsubscribed user).
// ⛔ NO PROMOTIONAL SEND IS BUILT OR ENABLED (D73 §B 6, "until the owner says so"): sendMarketingEmail refuses
// unless MARKETING_SENDS_ENABLED is set AND MAIL_POSTAL_ADDRESS (a PO box or a registered agent — never a
// home address, never committed) exists, and no route imports it — test/d73Email.test.js holds both.
import crypto from "node:crypto";
import { sendEmail } from "./emailService.js";
import { isSuppressed } from "./emailSuppression.js";

const now = () => Math.floor(Date.now() / 1000);

/** The key unsubscribe links are signed with — derived, so a leak of one secret's use cannot forge the other. */
export function unsubscribeKey(env = process.env) {
  const base = env.UNSUBSCRIBE_SECRET || env.PASSWORD_RESET_SECRET || env.SESSION_SECRET || "";
  return base ? crypto.createHmac("sha256", base).update("draft:unsubscribe:v1").digest() : null;
}

/** A link token: the user id and a MAC. No expiry — an unsubscribe link must keep working. */
export function signUnsubscribeToken(userId, { env = process.env } = {}) {
  const key = unsubscribeKey(env);
  if (!key) throw new Error("no secret to sign unsubscribe links with");
  const body = Buffer.from(String(userId)).toString("base64url");
  const mac = crypto.createHmac("sha256", key).update(body).digest("base64url").slice(0, 32);
  return `${body}.${mac}`;
}

export function verifyUnsubscribeToken(token, { env = process.env } = {}) {
  const key = unsubscribeKey(env);
  const [body, mac] = String(token ?? "").split(".");
  if (!key || !body || !mac) return null;
  const want = crypto.createHmac("sha256", key).update(body).digest("base64url").slice(0, 32);
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  const id = Number(Buffer.from(body, "base64url").toString());
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function setMarketingConsent(db, userId, on, source) {
  if (on) {
    db.prepare("UPDATE users SET marketing_opt_in = 1, marketing_opt_in_at = ?, marketing_opt_in_source = ?, unsubscribed_at = NULL WHERE id = ?")
      .run(now(), String(source || "settings").slice(0, 40), userId);
  } else {
    db.prepare("UPDATE users SET marketing_opt_in = 0, unsubscribed_at = COALESCE(unsubscribed_at, ?) WHERE id = ?").run(now(), userId);
  }
}

/** Idempotent: unsubscribing twice is one unsubscribe. Returns whether the user exists. */
export function unsubscribe(db, userId) {
  const r = db.prepare("UPDATE users SET marketing_opt_in = 0, unsubscribed_at = COALESCE(unsubscribed_at, ?) WHERE id = ?").run(now(), userId);
  return r.changes > 0;
}

export function marketingState(db, userId) {
  const r = db.prepare("SELECT marketing_opt_in, marketing_opt_in_at, marketing_opt_in_source, unsubscribed_at FROM users WHERE id = ?").get(userId) || {};
  return { optedIn: r.marketing_opt_in === 1, since: r.marketing_opt_in_at ?? null, source: r.marketing_opt_in_source ?? null, unsubscribedAt: r.unsubscribed_at ?? null };
}

/** The headers Gmail and Yahoo require of bulk senders, for a marketing message to this user. */
export function listUnsubscribeHeaders(userId, { appUrl, env = process.env } = {}) {
  const url = `${appUrl}/u/${signUnsubscribeToken(userId, { env })}`;
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/**
 * ⛔ NOT CALLED BY ANY ROUTE. The marketing path, built so its guards are tested before it is ever needed:
 * refuses unless enabled and an address is configured; skips anyone not opted in, unsubscribed or suppressed;
 * carries the unsubscribe link and the postal address in every message, and the List-Unsubscribe headers.
 */
export async function sendMarketingEmail(db, { userId, subject, text, appUrl, env = process.env, fetchImpl }) {
  if (!["1", "true", "yes", "on"].includes(String(env.MARKETING_SENDS_ENABLED ?? "").toLowerCase())) return { ok: false, reason: "marketing_disabled" };
  if (!env.MAIL_POSTAL_ADDRESS) return { ok: false, reason: "no_postal_address" };
  const u = db.prepare(`SELECT u.marketing_opt_in, u.unsubscribed_at, p.email FROM users u LEFT JOIN user_profile p ON p.user_id = u.id WHERE u.id = ?`).get(userId);
  if (!u?.email) return { ok: false, reason: "no_address" };
  if (u.marketing_opt_in !== 1 || u.unsubscribed_at) return { ok: false, reason: "not_opted_in" };
  if (isSuppressed(db, u.email)) return { ok: false, reason: "suppressed" };
  const headers = listUnsubscribeHeaders(userId, { appUrl, env });
  const footer = `\n\n—\nYou are receiving this because you asked for product news from draft. Unsubscribe: ${headers["List-Unsubscribe"].slice(1, -1)}\n${env.MAIL_POSTAL_ADDRESS}`;
  return sendEmail({ to: u.email, subject, text: text + footer, headers, db, env, ...(fetchImpl ? { fetchImpl } : {}) });
}

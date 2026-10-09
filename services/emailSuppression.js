// services/emailSuppression.js — ⭐ D73 §B 4 · BOUNCES AND COMPLAINTS → a suppression list nothing sends past.
//
// Resend posts webhook events through Svix (verified 10-09 from Resend's and Svix's docs): headers `svix-id`,
// `svix-timestamp`, `svix-signature`; the signed content is `${id}.${timestamp}.${rawBody}`; HMAC-SHA256 with
// the secret's base64 part after `whsec_`; the header is a space-separated list of `v1,<base64 signature>`.
// The RAW body is what is signed — the route reads it before any JSON parser. Events used: `email.bounced`
// (data.bounce.type "Permanent" suppresses) and `email.complained`; recipients are `data.to` (an array).
import crypto from "node:crypto";

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

const norm = (email) => String(email ?? "").trim().toLowerCase();

export function isSuppressed(db, email) {
  try { return !!db.prepare("SELECT 1 FROM email_suppressions WHERE email = ?").get(norm(email)); }
  catch { return false; }
}

/** @returns { ok: true } or { ok: false, reason } — never throws on bad input. */
export function verifySvixSignature({ rawBody, headers = {}, secret, now = Math.floor(Date.now() / 1000) }) {
  const id = headers["svix-id"], ts = headers["svix-timestamp"], sig = headers["svix-signature"];
  if (!secret) return { ok: false, reason: "unconfigured" };
  if (!id || !ts || !sig) return { ok: false, reason: "missing_headers" };
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now - t) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: "stale_timestamp" };
  let key;
  try { key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64"); } catch { return { ok: false, reason: "bad_secret" }; }
  if (!key.length) return { ok: false, reason: "bad_secret" };
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  const offered = String(sig).split(" ").map(s => s.trim()).filter(s => s.startsWith("v1,")).map(s => s.slice(3));
  for (const o of offered) {
    let b;
    try { b = Buffer.from(o, "base64"); } catch { continue; }
    if (b.length === expected.length && crypto.timingSafeEqual(b, expected)) return { ok: true };
  }
  return { ok: false, reason: "bad_signature" };
}

/** Record one verified event. Returns the addresses it suppressed. */
export function recordEmailEvent(db, event) {
  const type = event?.type;
  const to = Array.isArray(event?.data?.to) ? event.data.to : event?.data?.to ? [event.data.to] : [];
  let reason = null;
  if (type === "email.complained") reason = "complaint";
  else if (type === "email.bounced" && (event?.data?.bounce?.type ?? "Permanent") === "Permanent") reason = "hard_bounce";
  if (!reason) return [];
  const ins = db.prepare("INSERT OR IGNORE INTO email_suppressions (email, reason, event_id) VALUES (?, ?, ?)");
  const out = [];
  for (const addr of to) { const e = norm(addr); if (e && ins.run(e, reason, event?.data?.email_id ?? null).changes) out.push(e); }
  return out;
}

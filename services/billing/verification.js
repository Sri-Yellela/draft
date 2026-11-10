// ⭐ A167 (d)(e) · SIGN-UP NEEDS BOTH THE EMAIL AND THE PHONE PROVEN BY A ONE-TIME CODE; ONE ACCOUNT PER PHONE.
//
// THE FLOW (behind SIGNUP_VERIFICATION_REQUIRED, OFF):
//   1. POST /api/verify/start { channel: "email" | "sms", target }   → a 6-digit code is sent (email: draft's own sender;
//      SMS: Twilio Verify, which keeps the code itself — draft stores only that a verification is pending).
//   2. POST /api/verify/check { channel, target, code }               → a PROOF: a short-lived signed token naming the
//      channel and the normalised target. Nothing is stored against an account yet — there is no account yet.
//   3. POST /api/auth/register carries both proofs. The server checks them, refuses a phone already on another account
//      (and records the refusal, masked, for the admin), creates the account, and stamps email_verified_at /
//      phone_e164 / phone_verified_at. A changed phone later goes through the same proof (POST /api/account/phone).
//
// ⛔ NEVER STORED IN THE CLEAR: the code (HMAC with the server's pepper) and the target (HMAC — the rate limits and the
// attempt counter work on the hash). The phone number itself is stored once, on the account, when it is proven.
// ⛔ RATE-LIMITED: 3 codes per target per 10 minutes, 10 per IP per hour, 5 wrong tries per code, 10-minute expiry.
import crypto from "node:crypto";
import { verificationConfig } from "./config.js";

const now = () => Math.floor(Date.now() / 1000);
export class VerifyError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; Object.assign(this, extra); }
}
const fail = (status, code, message, extra) => { throw new VerifyError(status, code, message, extra); };

// ── normalising ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** E.164 from what a person typed. US / CA numbers may omit +1; anything else must start with +. Null when not a number. */
export function normalisePhone(raw, defaultCountry = "US") {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, "");
  if (s.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (defaultCountry === "US" || defaultCountry === "CA") {
    if (digits.length === 10 && /^[2-9]\d{2}[2-9]/.test(digits)) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1") && /^1[2-9]\d{2}[2-9]/.test(digits)) return `+${digits}`;
  }
  return null;
}
export const normaliseEmail = (e) => {
  const s = String(e ?? "").trim().toLowerCase();
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
};
const normaliseTarget = (channel, target, cfg) => channel === "sms" ? normalisePhone(target, cfg.defaultCountry) : normaliseEmail(target);

/** Masked, for an admin list: "+1 ••• ••• ••12", "j•••@example.com". */
export const maskPhone = (e164) => e164 ? `${e164.slice(0, e164.length - 10 > 0 ? e164.length - 10 : 2)} ••• ••• ••${e164.slice(-2)}` : null;
export const maskEmail = (e) => { const [u, d] = String(e || "").split("@"); return d ? `${u.slice(0, 1)}•••@${d}` : null; };

// ── hashing and proofs ──────────────────────────────────────────────────────────────────────────────────────────────
const hmac = (pepper, s) => crypto.createHmac("sha256", pepper).update(String(s)).digest("hex");
const codeHash = (pepper, code) => hmac(pepper, `code:${code}`);
export const targetHash = (pepper, channel, target) => hmac(pepper, `${channel}:${target}`);

const b64u = (b) => Buffer.from(b).toString("base64url");
/** A proof that `target` on `channel` answered a code just now. 30 minutes. */
export function signProof(pepper, { channel, target }, nowSec = now(), ttlSec = 1800) {
  const body = b64u(JSON.stringify({ c: channel, t: target, exp: nowSec + ttlSec }));
  return `${body}.${hmac(pepper, `proof:${body}`)}`;
}
export function readProof(pepper, token, channel, nowSec = now()) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const want = hmac(pepper, `proof:${body}`);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  let p; try { p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (p?.c !== channel || !(p.exp > nowSec) || !p.t) return null;
  return p.t;
}

// ── the SMS providers ───────────────────────────────────────────────────────────────────────────────────────────────
/** Twilio Verify: it sends and checks the code itself (draft never sees it). */
export function twilioVerify({ accountSid, authToken, serviceSid }, fetchImpl = globalThis.fetch) {
  const auth = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  const post = async (path, form) => {
    const res = await fetchImpl(`https://verify.twilio.com/v2/Services/${encodeURIComponent(serviceSid)}/${path}`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new VerifyError(502, "sms_provider_error", json?.message || `SMS provider ${res.status}`);
    return json;
  };
  return {
    start: async (to) => { await post("Verifications", { To: to, Channel: "sms" }); },
    check: async (to, code) => (await post("VerificationCheck", { To: to, Code: code }))?.status === "approved",
  };
}

const rateLimited = (db, cfg, th, ipHash, t) => {
  const perTarget = db.prepare("SELECT COUNT(*) FROM verify_codes WHERE target_hash = ? AND created_at > ?").pluck().get(th, t - 600);
  if (perTarget >= cfg.perTargetPer10Min) return { code: "too_many_codes", retryAfterSec: 600 };
  if (ipHash) {
    const perIp = db.prepare("SELECT COUNT(*) FROM verify_codes WHERE ip_hash = ? AND created_at > ?").pluck().get(ipHash, t - 3600);
    if (perIp >= cfg.perIpPerHour) return { code: "too_many_codes", retryAfterSec: 3600 };
  }
  return null;
};

/**
 * Send a code. `deps`: { pepper, sendEmailCode(to, code), sms?: { start, check }, ip?, env? }.
 * @returns {{ sent: true, channel, provider, expiresInSec }}
 */
export async function startVerification(db, { channel, target }, { pepper, sendEmailCode, sms = null, ip = null, env = process.env, nowSec = now(), log = console } = {}) {
  const cfg = verificationConfig(env);
  if (!["email", "sms"].includes(channel)) fail(400, "bad_channel", "Choose email or SMS.");
  const norm = normaliseTarget(channel, target, cfg);
  if (!norm) fail(400, channel === "sms" ? "bad_phone" : "bad_email", channel === "sms" ? "That doesn't look like a phone number — include the country code if it isn't a US number." : "That doesn't look like an email address.");
  const th = targetHash(pepper, channel, norm);
  const ipHash = ip ? hmac(pepper, `ip:${ip}`) : null;
  const limited = rateLimited(db, cfg, th, ipHash, nowSec);
  if (limited) fail(429, limited.code, "Too many codes asked for — wait a few minutes and try again.", { retryAfterSec: limited.retryAfterSec });
  let provider; let code = null;
  if (channel === "email") {
    provider = "email";
    code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await sendEmailCode(norm, code);
  } else {
    provider = sms ? "twilio_verify" : cfg.smsProvider;
    if (!provider) fail(503, "sms_not_configured", "Phone codes aren't set up yet. Try again later.");
    if (sms) await sms.start(norm);
    else {
      // dev_log: a development stand-in only (verificationConfig never offers it in production).
      code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      log.info?.(`[verify:dev] SMS code for ${maskPhone(norm)}: ${code}`);
    }
  }
  db.prepare(`INSERT INTO verify_codes (channel, target_hash, code_hash, provider, expires_at, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(channel, th, code ? codeHash(pepper, code) : null, provider, nowSec + cfg.codeTtlSec, ipHash, nowSec);
  return { sent: true, channel, provider, expiresInSec: cfg.codeTtlSec };
}

/** Check a code. Returns { verified: true, target, proof } — the proof goes into the sign-up (or a phone change). */
export async function checkVerification(db, { channel, target, code }, { pepper, sms = null, env = process.env, nowSec = now() } = {}) {
  const cfg = verificationConfig(env);
  const norm = normaliseTarget(channel, target, cfg);
  if (!norm) fail(400, "bad_target", "Ask for a new code.");
  const th = targetHash(pepper, channel, norm);
  const row = db.prepare(`SELECT * FROM verify_codes WHERE channel = ? AND target_hash = ? AND verified_at IS NULL ORDER BY id DESC LIMIT 1`).get(channel, th);
  if (!row || row.expires_at < nowSec) fail(400, "code_expired", "That code has expired. Ask for a new one.");
  if (row.attempts >= cfg.maxAttempts) fail(429, "code_locked", "Too many wrong codes. Ask for a new one.");
  const given = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{4,10}$/.test(given)) fail(400, "wrong_code", "That code is not right.");
  let ok;
  if (row.provider === "twilio_verify") ok = sms ? await sms.check(norm, given) : false;
  else ok = !!row.code_hash && crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(codeHash(pepper, given)));
  if (!ok) {
    db.prepare("UPDATE verify_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    fail(400, "wrong_code", "That code is not right.");
  }
  db.prepare("UPDATE verify_codes SET verified_at = ? WHERE id = ?").run(nowSec, row.id);
  return { verified: true, channel, target: norm, proof: signProof(pepper, { channel, target: norm }, nowSec) };
}

// ── (e) ONE ACCOUNT PER PHONE (and its linked email) ─────────────────────────────────────────────────────────────────
export function recordRefusal(db, { reason, stage, phone = null, email = null, userId = null }) {
  try {
    db.prepare("INSERT INTO signup_refusals (reason, stage, phone_hint, email_hint, user_id) VALUES (?, ?, ?, ?, ?)")
      .run(reason, stage, maskPhone(phone), maskEmail(email), userId);
  } catch { /* the refusal stands even if the record fails */ }
}

/**
 * May this phone (E.164) and email go on an account? `userId` = the account changing its own (null at sign-up).
 * Refuses a phone that is on ANOTHER account, and an email that is on another account.
 */
export function identityRefusal(db, { phone, email = null, userId = null }) {
  if (phone) {
    const owner = db.prepare("SELECT id FROM users WHERE phone_e164 = ?").pluck().get(phone);
    if (owner != null && owner !== userId) return { code: "phone_taken", message: "That phone number is already on a draft account. Sign in to that account instead." };
  }
  if (email) {
    const owner = db.prepare("SELECT user_id FROM user_profile WHERE LOWER(email) = LOWER(?)").pluck().get(email);
    if (owner != null && owner !== userId) return { code: "email_taken", message: "That email is already on a draft account. Sign in to that account instead." };
  }
  return null;
}

/** Stamp a proven phone on an account (sign-up or a change). Throws VerifyError when it belongs to another account. */
export function setVerifiedPhone(db, userId, phone, { stage = "change" } = {}) {
  const refused = identityRefusal(db, { phone, userId });
  if (refused) { recordRefusal(db, { reason: refused.code, stage, phone, userId }); fail(409, refused.code, refused.message); }
  db.prepare("UPDATE users SET phone_e164 = ?, phone_verified_at = ? WHERE id = ?").run(phone, now(), userId);
  try { db.prepare("UPDATE user_profile SET phone = COALESCE(phone, ?) WHERE user_id = ?").run(phone, userId); } catch { /* no profile row yet */ }
}

/** Is this account fully verified (both proven)? Used by the apply gate when verification is required. */
export function accountVerified(db, userId) {
  const u = db.prepare("SELECT email_verified_at, phone_verified_at FROM users WHERE id = ?").get(userId) || {};
  return { email: !!u.email_verified_at, phone: !!u.phone_verified_at };
}

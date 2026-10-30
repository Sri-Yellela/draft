// services/webPush.js — ⭐ D112 item 8 (owner 10-30: "Web Push (VAPID, no vendor) + email through Resend now; FCM with
// Android"). The whole protocol on node:crypto — no web-push package, no vendor between draft and the browser's own push
// service:
//
//   RFC 8292  VAPID — the application server identifies itself with an ES256 JWT (aud = the push service's origin,
//             exp ≤ 24 h, sub = VAPID_SUBJECT), sent as `Authorization: vapid t=<jwt>, k=<public key>`.
//   RFC 8291  Message encryption — an ephemeral P-256 key per message, ECDH with the browser's p256dh key, HKDF with the
//             subscription's auth secret, AES-128-GCM.
//   RFC 8188  The aes128gcm content coding — salt(16) · rs(4) · idlen(1) · keyid(65) · one record, delimiter 0x02.
//
// ⛔ With VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT unset, push is NOT OFFERED: vapidConfig() is null, the
// subscribe door answers 404 and Settings shows no push switch. A half-set or malformed key is treated as unset.
// ⛔ The network is behind `fetchImpl` (injectable) — tests never reach a push service.
// ⛔ A subscription's endpoint is a URL the BROWSER gave us and the server will POST to — only the known push services'
// hosts are accepted (PUSH_HOSTS), so a forged subscription cannot aim the server at an internal address.
import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64u = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Hosts (and their subdomains) of the browsers' push services: Chrome / Edge-on-FCM, Firefox, Edge (WNS), Safari. */
export const PUSH_HOSTS = Object.freeze([
  "fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com",
]);

/** Is this a push-service endpoint we will POST to? https, a known host, no credentials, no odd port. */
export function endpointAllowed(endpoint) {
  let u;
  try { u = new URL(String(endpoint)); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const h = u.hostname.toLowerCase();
  return PUSH_HOSTS.some(p => h === p || h.endsWith(`.${p}`));
}

/**
 * The owner's three variables, checked. Returns { publicKey, subject, privateKey: KeyObject } or null (push not offered).
 * VAPID_PUBLIC_KEY: the uncompressed P-256 point (65 bytes), base64url. VAPID_PRIVATE_KEY: the 32-byte scalar, base64url.
 * VAPID_SUBJECT: a mailto: or https: contact (RFC 8292 §2.1).
 */
export function vapidConfig(env = process.env) {
  const pub = String(env.VAPID_PUBLIC_KEY || "").trim(), priv = String(env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(env.VAPID_SUBJECT || "").trim();
  if (!pub || !priv || !subject || !/^(mailto:|https:\/\/)/.test(subject)) return null;
  const p = fromB64u(pub), d = fromB64u(priv);
  if (p.length !== 65 || p[0] !== 0x04 || d.length !== 32) return null;
  try {
    // The public key must be THIS private key's: a mismatched pair signs JWTs no push service accepts. Derived from the
    // scalar itself — a JWK import takes x / y on trust and would not notice.
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(d);
    if (!ecdh.getPublicKey().equals(p)) return null;
    const privateKey = crypto.createPrivateKey({ format: "jwk", key: {
      kty: "EC", crv: "P-256", x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)), d: b64u(d) } });
    return { publicKey: b64u(p), subject, privateKey };
  } catch { return null; }
}

/** A fresh VAPID key pair, in the env variables' encoding — what `node scripts/vapidKeys.mjs` prints for the owner. */
export function generateVapidKeys() {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]);
  return { publicKey: b64u(pub), privateKey: b64u(fromB64u(jwk.d)) };
}

/** RFC 8292 §2: the JWT for one push service origin. ES256, the signature as raw r‖s (JWS), exp 12 h ahead. */
export function vapidJwt({ audience, subject, privateKey, nowSec = Math.floor(Date.now() / 1000), ttlSec = 12 * 3600 }) {
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud: audience, exp: nowSec + Math.min(ttlSec, 24 * 3600), sub: subject }));
  const input = `${header}.${claims}`;
  const sig = crypto.sign("sha256", Buffer.from(input), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64u(sig)}`;
}

/** The Authorization header for a push to `endpoint` (RFC 8292 §3). */
export function vapidAuthorization(endpoint, vapid, nowSec) {
  const audience = new URL(endpoint).origin;
  return `vapid t=${vapidJwt({ audience, subject: vapid.subject, privateKey: vapid.privateKey, nowSec })}, k=${vapid.publicKey}`;
}

const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
const RS = 4096;

/**
 * RFC 8291 §3.4 + RFC 8188: encrypt `payload` for one subscription. `salt` and `localKeys` are injectable so a test can
 * pin them; in use both are fresh per message. Returns the request body (header ‖ ciphertext ‖ tag).
 * @param subscription { keys: { p256dh, auth } } — the browser's PushSubscription.toJSON()
 */
export function encryptPayload(payload, subscription, { salt = crypto.randomBytes(16), localKeys = null } = {}) {
  const uaPublic = fromB64u(subscription?.keys?.p256dh), authSecret = fromB64u(subscription?.keys?.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error("bad_p256dh");
  if (authSecret.length < 16) throw new Error("bad_auth");
  const ecdh = crypto.createECDH("prime256v1");
  if (localKeys) ecdh.setPrivateKey(fromB64u(localKeys.privateKey)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);
  // §3.3: IKM = HKDF(salt = auth_secret, IKM = ecdh_secret, info = "WebPush: info" ‖ 0 ‖ ua_public ‖ as_public, L = 32)
  const prkKey = hmac(authSecret, ecdhSecret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  // RFC 8188 §2.2–2.3: the content-encryption key and the nonce, from the record's salt.
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const plain = Buffer.concat([Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)), Buffer.from([2])]);
  if (plain.length + 16 > RS) throw new Error("payload_too_large");
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RS, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, body]);
}

/**
 * Send one push. Returns { ok, status, gone } — `gone` is 404 / 410 (RFC 8030 §7.3: the subscription has expired or
 * been unsubscribed; the caller deletes it). Never throws on an HTTP answer; a network error is { ok:false, status:0 }.
 */
export async function sendPush(subscription, payload, { vapid, fetchImpl = fetch, ttl = 24 * 3600, urgency = "normal", topic = null, nowSec } = {}) {
  if (!vapid) return { ok: false, status: 0, error: "not_configured" };
  if (!endpointAllowed(subscription?.endpoint)) return { ok: false, status: 0, error: "endpoint_refused" };
  const body = encryptPayload(payload, subscription);
  const headers = {
    Authorization: vapidAuthorization(subscription.endpoint, vapid, nowSec),
    "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
    TTL: String(ttl), Urgency: urgency,
    // RFC 8030 §5.4: a topic REPLACES an undelivered message with the same topic — a phone that was off gets one
    // "ready for your approval", not ten. ≤ 32 base64url characters.
    ...(topic ? { Topic: String(topic).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
  };
  try {
    const r = await fetchImpl(subscription.endpoint, { method: "POST", headers, body });
    const status = r.status;
    return { ok: status >= 200 && status < 300, status, gone: status === 404 || status === 410 };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e).slice(0, 200) };
  }
}

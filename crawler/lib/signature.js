// crawler/lib/signature.js — ⛔ D75 · one secret, two uses: the worker's lease requests carry it as a
// Bearer token, and its results are HMAC-SHA256 signed with it over `${timestamp}.${body}`. Draft refuses
// a result that is unsigned, mis-signed or older than MAX_SKEW_SECONDS (a replay). Imported by draft
// (routes/crawler.js) and by the worker — the scheme is written once.
import crypto from "node:crypto";

export const MAX_SKEW_SECONDS = 300;
export const SIGNATURE_HEADER = "x-crawler-signature";
export const TIMESTAMP_HEADER = "x-crawler-timestamp";

export function sign(body, token, now = Math.floor(Date.now() / 1000)) {
  const ts = String(now);
  const sig = crypto.createHmac("sha256", String(token)).update(`${ts}.${body}`).digest("hex");
  return { [TIMESTAMP_HEADER]: ts, [SIGNATURE_HEADER]: sig };
}

/** @returns {{ ok: boolean, reason?: string }} */
export function verify(body, headers, token, now = Math.floor(Date.now() / 1000)) {
  if (!token) return { ok: false, reason: "not_configured" };
  const ts = Number(headers?.[TIMESTAMP_HEADER]);
  const got = String(headers?.[SIGNATURE_HEADER] || "");
  if (!Number.isFinite(ts) || !/^[0-9a-f]{64}$/.test(got)) return { ok: false, reason: "unsigned" };
  if (Math.abs(now - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: "stale" };
  const want = crypto.createHmac("sha256", String(token)).update(`${ts}.${body}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(want, "hex"), Buffer.from(got, "hex")) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** A constant-time Bearer check for the lease endpoints. */
export function bearerMatches(header, token) {
  const m = /^Bearer\s+(.+)$/.exec(String(header || ""));
  if (!m || !token) return false;
  const a = crypto.createHash("sha256").update(m[1]).digest(), b = crypto.createHash("sha256").update(String(token)).digest();
  return crypto.timingSafeEqual(a, b);
}

// ── The app's one symmetric secret key, and the box that seals integration secrets with it ─────
//
// What it seals: user_integrations.secret_enc — an OAuth provider's token set on sign-in
// (server.js upsertAuthIntegration) and the session state POST /api/integrations/:provider
// receives (routes/account.js). ⚠ NOTHING DECRYPTS any of it today: the decrypt path has no
// caller. The ciphertext is kept for a future reader, which is exactly why the key must outlive a
// deploy — a per-boot key makes every row unreadable the moment the process restarts.
//
// ⛔ WHY THIS FILE EXISTS (09-30). Two defects, found while answering whether the key is set:
//
//   1. With COOKIE_ENCRYPTION_KEY unset, server.js generated a RANDOM key per boot and said
//      nothing. Production ran that way. Now: production refuses to boot without a valid key, the
//      same rule SESSION_SECRET already has; development still gets a per-boot key, loudly.
//   2. saveIntegrationSecret lived only inside routes/account.js, but server.js's
//      upsertAuthIntegration called it too — an identifier with no binding in server.js. Every
//      OAuth sign-in reaches that call (findOrCreateOAuthUser → upsertAuthIntegration), so every
//      Google / LinkedIn / GitHub sign-in threw a ReferenceError at the last step. The tests were
//      source regexes (`/upsertAuthIntegration\(user\.id, provider/`) and stayed green. It now has
//      one definition, here, imported by both.
import crypto from "crypto";

export const SECRET_KEY_ENV = "COOKIE_ENCRYPTION_KEY";

/**
 * The 32-byte AES-256 key from the environment.
 *
 * A key must be EXACTLY 64 hex characters (whitespace ignored). The old reader sliced to 64 and let
 * Buffer.from(…, "hex") drop anything that was not hex, so a malformed key became a short buffer
 * and failed only at the first encrypt, mid-request.
 *
 * @returns {{ key: Buffer, source: "env" | "ephemeral" }}
 * @throws in production when the key is missing or malformed.
 */
export function loadSecretKey(env = process.env, { isProduction = env.NODE_ENV === "production", warn = console.warn } = {}) {
  const raw = env[SECRET_KEY_ENV];
  if (raw != null && raw !== "") {
    const hex = String(raw).replace(/\s/g, "");
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(`${SECRET_KEY_ENV} must be exactly 64 hex characters (32 bytes); got ${hex.length} characters${/[^0-9a-fA-F]/.test(hex) ? ", some not hex" : ""}`);
    }
    return { key: Buffer.from(hex, "hex"), source: "env" };
  }
  if (isProduction) {
    throw new Error(`${SECRET_KEY_ENV} is not set. Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
  }
  warn(`[secrets] ${SECRET_KEY_ENV} not set — using a per-boot key; stored integration secrets will not survive a restart (development only)`);
  return { key: crypto.randomBytes(32), source: "ephemeral" };
}

/** AES-256-GCM seal/open over one key. The record shape is the user_integrations columns'. */
export function createSecretBox(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("secret box needs a 32-byte key");
  return {
    encrypt(plaintext) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return { enc: enc.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
    },
    decrypt(enc, iv, tag) {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(enc, "base64")), decipher.final()]).toString("utf8");
    },
  };
}

/**
 * Seal an integration secret for storage. An empty secret stores NOTHING (three nulls), so the
 * upserts' COALESCE keeps whatever secret the row already had.
 */
export function saveIntegrationSecret(encrypt, value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  if (!text || text === "{}") return { enc: null, iv: null, tag: null };
  return encrypt(text);
}

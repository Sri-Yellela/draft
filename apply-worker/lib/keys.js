// apply-worker/lib/keys.js — ⭐ D100 P1 · THE KEY SERVICE (docs/APPLY_WORKER.md §2), behind one interface.
//
// The assistant's default (D100 P1, the owner may change it): no new vendor yet. The worker holds
//   • a long-term Ed25519 SIGNING identity — its public half is what the app PINS, so a compromised draft cannot
//     hand the app a key of its own;
//   • one X25519 key pair PER SESSION, minted on request; the public half goes to the app (signed), the private
//     half is kept only here, wrapped (AES-256-GCM) by APPLY_WORKER_MASTER_KEY, on the worker's own volume.
// Revoke = destroy that session's private key, so every copy of the ciphertext — draft's database, every backup —
// is unreadable from then on. A KMS (AWS / Google) is a later swap behind createKeyStore's same methods.
//
// The sealed format (the app seals; only unseal() here can open it):
//   "v1." + epk + "." + iv + "." + tag + "." + ct      (each part base64url)
//   epk  the sender's ephemeral X25519 public key (SPKI DER)
//   key  HKDF-SHA256(X25519(eph, session), salt = keyId, info = "draft-apply-worker/session/v1") → 32 bytes
//   aad  "user|portal|v1" — D79 §2.3's binding, so a session cannot be replayed for another user or portal
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const INFO = Buffer.from("draft-apply-worker/session/v1");
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(String(s), "base64url");
const KEY_ID = /^[A-Za-z0-9_-]{8,128}$/;

export const aadFor = ({ userId, portalFamily }) => `${Number(userId)}|${String(portalFamily)}|v1`;
export const signedMessage = ({ keyId, publicKey, portalFamily }) => `draft-apply-worker/v1|${keyId}|${publicKey}|${portalFamily}`;

function wrap(master, plaintext) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", master, iv);
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return { iv: b64u(iv), tag: b64u(c.getAuthTag()), ct: b64u(ct) };
}
function unwrap(master, w) {
  const d = crypto.createDecipheriv("aes-256-gcm", master, fromB64u(w.iv));
  d.setAuthTag(fromB64u(w.tag));
  return Buffer.concat([d.update(fromB64u(w.ct)), d.final()]);
}
function sessionKey(privateKey, peerPublicKey, keyId) {
  const shared = crypto.diffieHellman({ privateKey, publicKey: peerPublicKey });
  return Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.from(keyId), INFO, 32));
}

/** The app's side (Android implements the same steps): seal a session to a minted public key. */
export function seal({ publicKey, keyId, plaintext, aad }) {
  const peer = crypto.createPublicKey({ key: fromB64u(publicKey), format: "der", type: "spki" });
  const eph = crypto.generateKeyPairSync("x25519");
  const key = sessionKey(eph.privateKey, peer, keyId);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(Buffer.from(plaintext)), c.final()]);
  const epk = eph.publicKey.export({ format: "der", type: "spki" });
  return ["v1", b64u(epk), b64u(iv), b64u(c.getAuthTag()), b64u(ct)].join(".");
}

/** The app's check before sealing: the minted key is signed by the PINNED identity. */
export function verifyMinted({ identity, keyId, publicKey, portalFamily, signature }) {
  const pub = crypto.createPublicKey({ key: fromB64u(identity), format: "der", type: "spki" });
  return crypto.verify(null, Buffer.from(signedMessage({ keyId, publicKey, portalFamily })), pub, fromB64u(signature));
}

/**
 * @param dir     the worker's own volume (never draft's)
 * @param master  32 bytes (APPLY_WORKER_MASTER_KEY, base64)
 */
export function createKeyStore({ dir, master }) {
  const mk = Buffer.isBuffer(master) ? master : Buffer.from(String(master || ""), "base64");
  if (mk.length !== 32) throw new Error("APPLY_WORKER_MASTER_KEY must be 32 bytes, base64");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const idFile = path.join(dir, "identity.json");
  const fileFor = (keyId) => {
    if (!KEY_ID.test(String(keyId))) throw Object.assign(new Error("bad key id"), { code: "bad_key_id" });
    return path.join(dir, `session_${keyId}.json`);
  };

  // The signing identity: created once, kept wrapped.
  let identity;
  if (fs.existsSync(idFile)) {
    const w = JSON.parse(fs.readFileSync(idFile, "utf8"));
    identity = { privateKey: crypto.createPrivateKey({ key: unwrap(mk, w), format: "der", type: "pkcs8" }), publicKey: w.publicKey };
  } else {
    const kp = crypto.generateKeyPairSync("ed25519");
    const publicKey = b64u(kp.publicKey.export({ format: "der", type: "spki" }));
    fs.writeFileSync(idFile, JSON.stringify({ ...wrap(mk, kp.privateKey.export({ format: "der", type: "pkcs8" })), publicKey }), { mode: 0o600 });
    identity = { privateKey: kp.privateKey, publicKey };
  }

  return {
    identity: () => identity.publicKey,

    /** A fresh per-session key; the private half never leaves this store. */
    mint(portalFamily) {
      const keyId = `sk_${crypto.randomBytes(16).toString("hex")}`;
      const kp = crypto.generateKeyPairSync("x25519");
      const publicKey = b64u(kp.publicKey.export({ format: "der", type: "spki" }));
      fs.writeFileSync(fileFor(keyId), JSON.stringify({ ...wrap(mk, kp.privateKey.export({ format: "der", type: "pkcs8" })),
        portalFamily: String(portalFamily), createdAt: Math.floor(Date.now() / 1000) }), { mode: 0o600 });
      const signature = b64u(crypto.sign(null, Buffer.from(signedMessage({ keyId, publicKey, portalFamily })), identity.privateKey));
      return { keyId, publicKey, portalFamily: String(portalFamily), signature, identity: identity.publicKey };
    },

    /** Open a sealed session IN MEMORY. Throws when the key is gone (revoked) or the binding differs. */
    unseal({ keyId, sealed, aad }) {
      const f = fileFor(keyId);
      if (!fs.existsSync(f)) throw Object.assign(new Error("session key destroyed"), { code: "key_destroyed" });
      const w = JSON.parse(fs.readFileSync(f, "utf8"));
      const privateKey = crypto.createPrivateKey({ key: unwrap(mk, w), format: "der", type: "pkcs8" });
      const [v, epk, iv, tag, ct] = String(sealed).split(".");
      if (v !== "v1" || !ct) throw Object.assign(new Error("unknown sealed format"), { code: "bad_sealed" });
      const peer = crypto.createPublicKey({ key: fromB64u(epk), format: "der", type: "spki" });
      const d = crypto.createDecipheriv("aes-256-gcm", sessionKey(privateKey, peer, keyId), fromB64u(iv));
      d.setAAD(Buffer.from(aad));
      d.setAuthTag(fromB64u(tag));
      return Buffer.concat([d.update(fromB64u(ct)), d.final()]).toString("utf8");
    },

    /** Revoke: overwrite, then remove. Returns false when it was already gone. */
    destroy(keyId) {
      const f = fileFor(keyId);
      if (!fs.existsSync(f)) return false;
      const size = fs.statSync(f).size;
      fs.writeFileSync(f, crypto.randomBytes(Math.max(size, 64)));
      fs.unlinkSync(f);
      return true;
    },
  };
}

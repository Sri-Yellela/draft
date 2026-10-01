import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { EncryptedSessionStore, sessionKeyFrom } from "../services/encryptedSessionStore.js";
import { sendEmail, sendPasswordResetEmail, emailConfigured } from "../services/emailService.js";

const KEY = Buffer.from("ab".repeat(32), "hex");
class MemStore extends EventEmitter {
  constructor() { super(); this.rows = new Map(); }
  get(sid, cb) { cb(null, this.rows.has(sid) ? JSON.parse(this.rows.get(sid)) : null); }
  set(sid, s, cb) { this.rows.set(sid, JSON.stringify(s)); cb?.(null); }
  destroy(sid, cb) { this.rows.delete(sid); cb?.(null); }
}
const getP = (st, sid) => new Promise((r, j) => st.get(sid, (e, s) => (e ? j(e) : r(s))));
const setP = (st, sid, s) => new Promise((r) => st.set(sid, s, r));

test("a session is SEALED at rest — the stored row reveals nothing — and opens intact", async () => {
  const inner = new MemStore(); const st = new EncryptedSessionStore(inner, KEY);
  const sess = { cookie: { maxAge: 1000 }, passport: { user: 42 }, oauthState: "s3cret" };
  await setP(st, "sid1", sess);
  const raw = inner.rows.get("sid1");
  assert.doesNotMatch(raw, /passport|s3cret|42/, "the stored session is readable");
  assert.match(raw, /"maxAge":1000/, "the cookie stays in clear — the store computes expiry from it");
  assert.deepEqual(await getP(st, "sid1"), sess);
});

test("a legacy plain row still reads (nobody is signed out) and is resealed on its next write", async () => {
  const inner = new MemStore(); const st = new EncryptedSessionStore(inner, KEY);
  inner.rows.set("old", JSON.stringify({ cookie: { maxAge: 5 }, passport: { user: 7 } }));
  const s = await getP(st, "old");
  assert.equal(s.passport.user, 7);
  await setP(st, "old", s);
  assert.doesNotMatch(inner.rows.get("old"), /passport/);
});

test("a row sealed under another key (or tampered) is NO session — never a crash", async () => {
  const inner = new MemStore();
  await setP(new EncryptedSessionStore(inner, Buffer.from("cd".repeat(32), "hex")), "x", { cookie: {}, passport: { user: 1 } });
  assert.equal(await getP(new EncryptedSessionStore(inner, KEY), "x"), null);
});

test("the session key is derived — not the integration-secret key itself", () => {
  assert.notDeepEqual(sessionKeyFrom(KEY), KEY);
  assert.equal(sessionKeyFrom(KEY).length, 32);
});

test("⛔ no email provider in production: nothing 'succeeds', and no link or code is logged", async () => {
  const logs = []; const orig = { warn: console.warn, info: console.info, log: console.log };
  console.warn = console.info = console.log = (...a) => logs.push(a.join(" "));
  try {
    const r = await sendPasswordResetEmail({ to: "a@b.c", resetUrl: "https://x/login?resetToken=TOKEN123", otp: "987654", expiresAt: 1 },
      { env: { NODE_ENV: "production" } });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "email_unconfigured");
    assert.ok(!logs.join("\n").includes("TOKEN123") && !logs.join("\n").includes("987654"), "a reset credential reached the log");
  } finally { Object.assign(console, orig); }
  assert.equal(emailConfigured({}), false);
  assert.equal(emailConfigured({ RESEND_API_KEY: "k" }), true);
});

test("with a provider, mail goes out — and a provider error is an error", async () => {
  const calls = [];
  const ok = await sendEmail({ to: "a@b.c", subject: "s", text: "t", env: { RESEND_API_KEY: "k", NODE_ENV: "production" },
    fetchImpl: async (u, o) => { calls.push(JSON.parse(o.body)); return { ok: true }; } });
  assert.equal(ok.ok, true);
  assert.equal(calls[0].to, "a@b.c");
  await assert.rejects(sendEmail({ to: "a@b.c", subject: "s", text: "t", env: { RESEND_API_KEY: "k" },
    fetchImpl: async () => ({ ok: false, status: 422 }) }), /422/);
});

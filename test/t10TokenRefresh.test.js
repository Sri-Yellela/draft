// T10 row 16 · THE EXTENSION'S TOKEN EXPIRED — a silent refresh, or one clear reconnect (open item 4).
//
// extension/auth.js authedFetch is the one network path. On a 401 it clears the stored token, trades the browser's session
// for a fresh one ONCE (GET /api/auth/extension-token, the only credentialed call) and resends the request. These pin it:
//   · a 401 with a live website session → ONE bootstrap, the SAME request resent with the NEW token, the caller sees only
//     the second answer; the new token is stored
//   · the cookie travels on the bootstrap ONLY — the resent request still omits it
//   · no session to trade → null (signed out), the dead token gone, ONE resend never attempted, the code noted for T6
//   · the website unreachable during the refresh → null, noted as `reconnect_unreachable` (not a sign-out)
//   · a SECOND 401 (the fresh token refused too) is returned as is — never a loop
// Synthetic tokens only; nothing leaves the process.
import test from "node:test";
import assert from "node:assert/strict";

const S = "https://jobsviadraft.test";

function chromeStub() {
  const local = new Map();
  globalThis.chrome = {
    storage: {
      local: {
        async get(k) { const keys = [].concat(k); return Object.fromEntries(keys.filter(x => local.has(x)).map(x => [x, local.get(x)])); },
        async set(o) { for (const [k, v] of Object.entries(o)) local.set(k, v); },
        async remove(k) { for (const x of [].concat(k)) local.delete(x); },
      },
      session: { async get() { return {}; }, async set() {}, async remove() {} },
    },
    runtime: { sendMessage: async () => null },
  };
  return local;
}
const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body, clone() { return this; } });
/** Each request in order; `answers` is a list of (url, init) → response | throw, consumed one per request. */
function fetchScript(answers) {
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    seen.push({ url: String(url), credentials: init.credentials, token: init.headers?.["X-RM-Auth-Context"] ?? null, method: init.method || "GET" });
    const next = answers.shift();
    if (!next) throw new Error(`unexpected fetch ${url}`);
    return next(String(url), init);
  };
  return seen;
}
const realFetch = globalThis.fetch;
let n = 0;
const load = () => Promise.all([import(`../extension/auth.js?i=${++n}`), import(`../extension/diagnostics.js`)]);
const done = () => { globalThis.fetch = realFetch; delete globalThis.chrome; };

test("⭐ row 16: an expired token is refreshed SILENTLY — one bootstrap, the same request resent with the new token", async () => {
  const local = chromeStub();
  local.set("authToken", "tok-expired");
  const [{ authedFetch }] = await load();
  const seen = fetchScript([
    () => json(401, { error: "auth" }),
    (u) => { assert.match(u, /\/api\/auth\/extension-token$/); return json(200, { token: "tok-fresh" }); },
    () => json(200, { ok: true, saved: 3 }),
  ]);
  const res = await authedFetch(S, "/api/apply/handoff/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(res.status, 200, "the caller sees the resent request's answer");
  assert.deepEqual(await res.json(), { ok: true, saved: 3 });
  assert.equal(seen.length, 3);
  assert.deepEqual(seen.map(s => s.url), [`${S}/api/apply/handoff/match`, `${S}/api/auth/extension-token`, `${S}/api/apply/handoff/match`]);
  assert.equal(seen[0].token, "tok-expired");
  assert.equal(seen[2].token, "tok-fresh", "the resend carries the NEW token");
  assert.equal(seen[2].method, "POST", "the same request is resent — method and body kept");
  // ⛔ the cookie travels on the bootstrap only
  assert.deepEqual(seen.map(s => s.credentials), ["omit", "include", "omit"]);
  assert.equal(seen[1].token, null, "the bootstrap carries no token — it is the exchange");
  assert.equal(local.get("authToken"), "tok-fresh", "the new token is kept for the next call");
  done();
});

test("⛔ row 16: no session to trade → signed out (null), the dead token forgotten, nothing resent", async () => {
  const local = chromeStub();
  local.set("authToken", "tok-revoked");
  local.set("authIdentity", { username: "ada" });
  const [{ authedFetch }, diag] = await load();
  const seen = fetchScript([() => json(401, {}), () => json(401, { error: "auth" })]);
  const res = await authedFetch(S, "/api/extension/page", { method: "POST" });
  assert.equal(res, null, "null is 'no usable credential' — the caller says signed out");
  assert.equal(seen.length, 2, "ONE bootstrap, no resend");
  assert.equal(local.has("authToken"), false);
  assert.equal(local.has("authIdentity"), false);
  const a = diag.answers().find(x => x.path === diag.pathShape("/api/extension/page"));
  assert.deepEqual([a?.status, a?.code], [401, "token_refused"], "T6's details name it");
  done();
});

test("⛔ row 16: the website unreachable during the refresh → null, noted 'reconnect_unreachable' — not a sign-out", async () => {
  const local = chromeStub();
  local.set("authToken", "tok-expired");
  const [{ authedFetch }, diag] = await load();
  fetchScript([() => json(401, {}), () => { throw new Error("offline"); }]);
  assert.equal(await authedFetch(S, "/api/import/context"), null);
  const a = diag.answers().find(x => x.path === diag.pathShape("/api/import/context"));
  assert.deepEqual([a?.status, a?.code], [401, "reconnect_unreachable"]);
  done();
});

test("⛔ row 16: ONE retry only — the fresh token refused too comes back as the 401, never a loop", async () => {
  const local = chromeStub();
  local.set("authToken", "tok-a");
  const [{ authedFetch }] = await load();
  const seen = fetchScript([() => json(401, {}), () => json(200, { token: "tok-b" }), () => json(401, { error: "auth" })]);
  const res = await authedFetch(S, "/api/auth/me");
  assert.equal(res.status, 401);
  assert.equal(seen.length, 3, "a second 401 is not refreshed again");
  done();
});

test("row 16: no stored token at all → the bootstrap first, then the request with it (a first run after install)", async () => {
  const local = chromeStub();
  const [{ authedFetch }] = await load();
  const seen = fetchScript([() => json(200, { token: "tok-1" }), () => json(200, { authenticated: true })]);
  const res = await authedFetch(S, "/api/auth/me");
  assert.equal(res.status, 200);
  assert.deepEqual(seen.map(s => [s.credentials, s.token]), [["include", null], ["omit", "tok-1"]]);
  assert.equal(local.get("authToken"), "tok-1");
  done();
});

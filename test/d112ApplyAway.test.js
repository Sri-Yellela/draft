// ⭐⭐ D112 item 7 (D100 P3, desktop) · "LET DRAFT APPLY HERE WHILE YOU'RE AWAY" — the extension half.
//
// Owner 10-30: "build both android thing and apply here when im away. build it and we can release it when we are ready."
// The attended Amazon run (D100 P5) found Amazon's sign-in refuses the worker's automated browser (403) — so for Amazon the
// worker applies with the user's OWN sign-in, handed over here: on a signed-in portal page the dock offers the line; the
// press (and Chrome's prompt from b2's small window) lets the extension mint → VERIFY against the PINNED identity → read
// ONLY that portal family's cookies → seal them to the worker's key → upload ciphertext; Disconnect deletes the session.
//
// The REAL modules (extension/applyAway.js, apply-away.js, toolbarPress.js), the REAL routes (routes/applyWorker.js
// portalRoutes) on a real DB with every migration, and the REAL worker key store (apply-worker/lib/keys.js) — the sealed
// session is opened by the worker's own unseal(). A fake `chrome` records every call. Synthetic people and cookies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import nodeCrypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import portalRoutes from "../routes/applyWorker.js";
import { APPLY_ORIGIN_FAMILIES } from "../services/applyOrigins.js";
import { createKeyStore, aadFor as workerAad, seal as workerSeal } from "../apply-worker/lib/keys.js";
import {
  APPLY_AWAY_FAMILIES, PINNED_WORKER_IDENTITY, awayFamilyFor, awayPermission, readFamilyCookies, sealForWorker, verifyMintedKey,
  configureApplyAway, connectAway, disconnectAway, startAway, awayFactsFor, awayRelay, awayAskWindow, handlers, portalSignedInInPage,
} from "../extension/applyAway.js";
import { onAllow, onNotNow } from "../extension/apply-away.js";
import { relayFor, toolbarPress } from "../extension/toolbarPress.js";
import { collectRequiredFiles } from "../scripts/buildExtension.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("extension/manifest.json"));
const subtle = globalThis.crypto.subtle;
const master = nodeCrypto.randomBytes(32);
const tmpKeys = () => fs.mkdtempSync(path.join(os.tmpdir(), "d112-away-keys-"));
const AMAZON = APPLY_AWAY_FAMILIES.find(f => f.ats === "amazon");
const DASHBOARD = "https://account.amazon.jobs/en-US/applicant/dashboard";
const SECRET = "SYNTHETIC-SESSION-VALUE-7f3a9c";

/** The browser's cookie jar as chrome.cookies.getAll would answer for a URL — including other sites' cookies, which a
 *  correct reader must never take (the fake deliberately over-answers). */
const JAR = [
  { name: "session-token", value: SECRET, domain: ".amazon.jobs", path: "/", hostOnly: false, secure: true, httpOnly: true, sameSite: "lax", session: false, expirationDate: 1893456000.5 },
  { name: "acct-sid", value: "SYNTHETIC-ACCT-2b1d", domain: "account.amazon.jobs", path: "/", hostOnly: true, secure: true, httpOnly: true, sameSite: "no_restriction", session: true },
  { name: "shop-sid", value: "SYNTHETIC-OTHER-SITE", domain: ".amazon.com", path: "/", hostOnly: false, secure: true, httpOnly: true, sameSite: "lax", session: true },
  { name: "tld", value: "SYNTHETIC-TLD", domain: ".jobs", path: "/", hostOnly: false, secure: true, httpOnly: false, sameSite: "lax", session: true },
  { name: "passport", value: "SYNTHETIC-PASSPORT", domain: "passport.amazon.jobs", path: "/", hostOnly: true, secure: true, httpOnly: true, sameSite: "lax", session: true },
  { name: "mail", value: "SYNTHETIC-MAIL", domain: ".mail.example.test", path: "/", hostOnly: false, secure: true, httpOnly: true, sameSite: "lax", session: true },
];

/** A fake chrome: every permission, cookie, window and tab call recorded in `h`. */
function fakeApi({ granted = false, tabs = [] } = {}) {
  const h = { granted, requested: [], removed: [], cookieUrls: [], windows: [], tabCalls: [] };
  let win = 900;
  h.api = {
    runtime: { id: "ext", getURL: (p) => `chrome-extension://ext/${p}` },
    permissions: {
      contains: async (o) => { h.containsAsked = o; return h.granted; },
      request: (o) => { h.requested.push(o); return Promise.resolve(h.grantOnRequest ?? true); },
      remove: async (o) => { h.removed.push(o); return true; },
    },
    cookies: { getAll: async ({ url }) => { h.cookieUrls.push(url); return JAR.map(c => ({ ...c })); } },
    windows: {
      create: async (o) => { const w = { id: ++win, ...o }; h.windows.push(["create", o]); return w; },
      update: async (id, o) => { h.windows.push(["update", id, o]); return { id }; },
      remove: async (id) => { h.windows.push(["remove", id]); },
    },
    tabs: { get: async (id) => tabs.find(t => t.id === id) || null, update: async (id, o) => { h.tabCalls.push([id, o]); return { id }; } },
  };
  return h;
}

/** draft's real portal routes + a real worker key store, behind a fetcher that records every request body. */
async function server({ client = null, worker = true } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (7,'casey','x','PRO')").run();
  const keys = createKeyStore({ dir: tmpKeys(), master });
  const app = express();
  app.use(express.json({ limit: "3mb" }));
  app.use((req, _r, n) => { req.user = { id: 7 }; n(); });
  app.get("/api/auth/me", (_q, res) => res.json({ authenticated: true, user: { id: 7, username: "casey" } }));
  portalRoutes(app, db, (_q, _r, n) => n(), { client: worker ? (client || { mintKey: async (f) => keys.mint(f), destroyKey: async (k) => keys.destroy(k) }) : null });
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const sent = [];
  const fetcher = (p, init = {}) => { sent.push({ path: p, method: init.method || "GET", body: init.body ?? null }); return fetch(base + p, init); };
  return { db, keys, sent, fetcher, close: () => new Promise(r => srv.close(r)) };
}

// ── 1 · the permission: optional, and asked only in that press ────────────────────────────────────────────────────────
test("⭐ d112ApplyAway · `cookies` is OPTIONAL and asked ONLY in the window's Allow press — its first call, for exactly the portal family's hosts; the dock's press and Not now ask Chrome nothing", async () => {
  assert.deepEqual(manifest.optional_permissions, ["cookies"]);
  assert.ok(!manifest.permissions.includes("cookies"), "never at install");
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"], "no portal host at install");
  // the one request site in the extension that names cookies is apply-away.js onAllow
  const files = collectRequiredFiles(manifest).filter(f => f.endsWith(".js"));
  const requesters = files.filter(f => /permissions\.request\(/.test(read(`extension/${f}`))).sort();
  assert.ok(requesters.includes("apply-away.js"));
  const src = read("extension/apply-away.js");
  const fn = src.slice(at(src, "export function onAllow(api, tabId, family) {"), at(src, "/** Not now"));
  const first = fn.indexOf("api.");
  assert.equal(fn.slice(first, first + 47), "api.permissions.request(awayPermission(family))", "the request is the click's first call");
  assert.ok(fn.indexOf("api.permissions.request(") < fn.indexOf("await"), "nothing awaited before it");
  const mount = src.slice(at(src, "export function mount("), at(src, "if (typeof document"));
  assert.equal((mount.match(/permissions\.request\(/g) || []).length, 0, "opening the window asks nothing");
  assert.match(mount, /addEventListener\('click', \(\) => \{\n\s+const p = onAllow\(api, tid, family\);/);
  // what is asked: cookies + the family's own origins, nothing broader
  assert.deepEqual(awayPermission(AMAZON), { permissions: ["cookies"],
    origins: ["https://www.amazon.jobs/*", "https://amazon.jobs/*", "https://account.amazon.jobs/*"] });

  const h = fakeApi({ granted: false, tabs: [{ id: 41, url: DASHBOARD, windowId: 3 }] });
  const s = await server();
  try {
    configureApplyAway({ api: h.api, subtle, fetcher: s.fetcher, identity: s.keys.identity() });
    // the dock's press, not yet granted: the window opens — Chrome is NOT asked, nothing read, nothing sent
    const r = await startAway({ id: 41, url: DASHBOARD, windowId: 3 });
    assert.equal(r.opened, true);
    assert.match(h.windows[0][1].url, /^chrome-extension:\/\/ext\/apply-away\.html\?tab=41&family=amazon$/);
    assert.equal(h.windows[0][1].type, "popup");
    assert.deepEqual(h.requested, []);
    assert.deepEqual(h.cookieUrls, []);
    assert.deepEqual(s.sent, []);
    // the window's Allow: request first, then the answer to the worker
    const calls = [];
    const api = { permissions: { request: (o) => { calls.push(["request", o]); return Promise.resolve(true); } },
      runtime: { sendMessage: async (m) => { calls.push(["message", m.type, m.answer]); return { ok: true }; } } };
    await onAllow(api, 41, AMAZON);
    assert.deepEqual(calls, [["request", awayPermission(AMAZON)], ["message", "APPLY_AWAY_ANSWER", "allow"]]);
    // Not now: no prompt at all
    const later = [];
    await onNotNow({ permissions: { request: () => { later.push("request"); } }, runtime: { sendMessage: async (m) => { later.push(m.answer); return { ok: true }; } } }, 41);
    assert.deepEqual(later, ["later"]);
    // the worker's 'later' closes the window, focuses the tab, reads nothing
    const back = await handlers.APPLY_AWAY_ANSWER({ answer: "later", tabId: 41 }, { id: "ext", url: "chrome-extension://ext/apply-away.html?tab=41&family=amazon" });
    assert.equal(back.connected, false);
    assert.ok(h.windows.some(w => w[0] === "remove"));
    assert.deepEqual(h.tabCalls, [[41, { active: true }]]);
    assert.equal(awayAskWindow(), null);
    assert.deepEqual(h.cookieUrls, []);
    // ⛔ a web page (or any other sender) cannot answer for the window
    assert.equal((await handlers.APPLY_AWAY_ANSWER({ answer: "allow", tabId: 41 }, { id: "ext", url: "https://account.amazon.jobs/" })).error, "not_allowed");
  } finally { await s.close(); }
});

// ── 2 · only the family's hosts are read ──────────────────────────────────────────────────────────────────────────────
test("⭐ d112ApplyAway · only the portal family's hosts are read — getAll for its three origins only, and of those only cookies of its own hosts or their parent (never .amazon.com, a bare .jobs, a sibling's host-only cookie, another site's)", async () => {
  // the table mirrors services/applyOrigins.js, row for row
  for (const f of APPLY_AWAY_FAMILIES) {
    const server = APPLY_ORIGIN_FAMILIES.find(x => x.ats === f.ats);
    assert.ok(server, `${f.ats} is a family in services/applyOrigins.js`);
    assert.deepEqual([...f.origins], [...server.origins], `${f.ats}: the same origins`);
    assert.ok(f.origins.some(o => new URL(o).hostname === f.originHost), "the stored host is one of the family's");
  }
  assert.equal(awayFamilyFor(DASHBOARD)?.ats, "amazon");
  assert.equal(awayFamilyFor("https://www.amazon.com/gp/cart"), null);
  assert.equal(awayFamilyFor("https://passport.amazon.jobs/signin"), null, "an origin the table does not name");
  assert.equal(awayFamilyFor("http://account.amazon.jobs/"), null, "https only");
  assert.equal(awayFamilyFor("https://boards.greenhouse.io/x/jobs/1"), null, "open-form portals need no session");

  const h = fakeApi();
  const cookies = await readFamilyCookies(h.api, AMAZON);
  assert.deepEqual(h.cookieUrls, ["https://www.amazon.jobs/", "https://amazon.jobs/", "https://account.amazon.jobs/"]);
  assert.deepEqual(cookies.map(c => c.name).sort(), ["acct-sid", "session-token"]);
  const sid = cookies.find(c => c.name === "acct-sid");
  assert.equal(sid.url, "https://account.amazon.jobs/", "a host-only cookie stays host-only");
  assert.equal(sid.domain, undefined);
  assert.equal(sid.sameSite, "None");
  assert.equal(sid.expires, -1);
  const tok = cookies.find(c => c.name === "session-token");
  assert.deepEqual({ domain: tok.domain, expires: tok.expires, httpOnly: tok.httpOnly, secure: tok.secure }, { domain: ".amazon.jobs", expires: 1893456000, httpOnly: true, secure: true });
  // ⛔ the only code that touches chrome.cookies is applyAway.js, and nothing anywhere writes or removes a cookie
  const files = collectRequiredFiles(manifest).filter(f => f.endsWith(".js"));
  assert.deepEqual(files.filter(f => /\.cookies\./.test(read(`extension/${f}`))), ["applyAway.js"]);
  for (const f of files) assert.doesNotMatch(read(`extension/${f}`), /cookies\.(set|remove)\(/, f);
  // the hosts are the extension's own table — never taken from a server reply
  const src = read("extension/applyAway.js");
  const connect = src.slice(at(src, "export async function connectAway(tab) {"), at(src, "/** Disconnect the tab's portal"));
  assert.match(connect, /const family = awayFamilyFor\(tab\?\.url\);/);
  assert.match(connect, /readFamilyCookies\(d\.api, family\)/);
});

// ── 3 · ciphertext only, opened by the worker alone ───────────────────────────────────────────────────────────────────
test("⭐ d112ApplyAway · the upload body is ciphertext only — no cookie value or name appears in anything sent; the worker's own unseal() opens it, bound to this user and portal", async () => {
  const h = fakeApi({ granted: true });
  const s = await server();
  try {
    configureApplyAway({ api: h.api, subtle, fetcher: s.fetcher, identity: s.keys.identity() });
    const r = await connectAway({ id: 41, url: DASHBOARD });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(s.sent.map(x => `${x.method} ${x.path}`), ["GET /api/auth/me", "POST /api/portals/connect/start", "POST /api/portals/upload"]);
    const all = JSON.stringify(s.sent);
    for (const c of JAR) {
      assert.ok(!all.includes(c.value), `the value of ${c.name} left unsealed`);
      assert.ok(!all.includes(c.name), `the name of ${c.name} left unsealed`);
    }
    const body = JSON.parse(s.sent[2].body);
    assert.deepEqual(Object.keys(body).sort(), ["ciphertext", "consent", "keyId", "originHost", "portalFamily"]);
    assert.deepEqual({ portalFamily: body.portalFamily, originHost: body.originHost, consent: body.consent }, { portalFamily: "amazon", originHost: "amazon.jobs", consent: true });
    assert.match(body.ciphertext, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    // draft stores exactly that ciphertext and nothing readable
    const row = s.db.prepare("SELECT * FROM portal_sessions WHERE user_id = 7").get();
    assert.equal(row.ciphertext, body.ciphertext);
    assert.ok(!JSON.stringify(row).includes(SECRET));
    // the worker opens it — and only for this user and portal
    const opened = JSON.parse(s.keys.unseal({ keyId: body.keyId, sealed: body.ciphertext, aad: workerAad({ userId: 7, portalFamily: "amazon" }) }));
    assert.deepEqual(opened.cookies.map(c => c.name).sort(), ["acct-sid", "session-token"]);
    assert.equal(opened.cookies.find(c => c.name === "session-token").value, SECRET);
    assert.throws(() => s.keys.unseal({ keyId: body.keyId, sealed: body.ciphertext, aad: workerAad({ userId: 8, portalFamily: "amazon" }) }));
    // the extension's WebCrypto seal and the worker's node seal are the same scheme, byte-format for byte-format
    const m = s.keys.mint("amazon");
    const a = await sealForWorker(subtle, { publicKey: m.publicKey, keyId: m.keyId, plaintext: "x", aad: "7|amazon|v1" });
    const b = workerSeal({ publicKey: m.publicKey, keyId: m.keyId, plaintext: "x", aad: "7|amazon|v1" });
    assert.deepEqual(a.split(".").map(p => p.length), b.split(".").map(p => p.length));
    assert.equal(s.keys.unseal({ keyId: m.keyId, sealed: a, aad: "7|amazon|v1" }), "x");
    // a page that shows no sign-in cookie for the family sends nothing
    const empty = fakeApi({ granted: true });
    empty.api.cookies.getAll = async () => [{ ...JAR[2] }];
    configureApplyAway({ api: empty.api, subtle, fetcher: s.fetcher, identity: s.keys.identity() });
    const before = s.sent.length;
    assert.equal((await connectAway({ id: 41, url: DASHBOARD })).reason, "not_signed_in");
    assert.ok(!s.sent.slice(before).some(x => x.path === "/api/portals/upload"));
  } finally { await s.close(); }
});

// ── 4 · a key with a bad signature is refused ─────────────────────────────────────────────────────────────────────────
test("⭐ d112ApplyAway · a key with a bad signature is refused — a tampered signature, a key signed by another identity, or one minted for another portal: nothing read, nothing sealed, nothing uploaded; the PINNED identity decides, never the reply's", async () => {
  const pinned = createKeyStore({ dir: tmpKeys(), master });
  const impostor = createKeyStore({ dir: tmpKeys(), master });
  const cases = {
    tampered: async (f) => { const m = pinned.mint(f); const sig = Buffer.from(m.signature, "base64url"); sig[0] ^= 1; return { ...m, signature: sig.toString("base64url") }; },
    // a compromised draft substitutes a key of its own and names its own identity in the reply — the pin ignores it
    other_identity: async (f) => impostor.mint(f),
    swapped_key: async (f) => ({ ...pinned.mint(f), publicKey: impostor.mint(f).publicKey }),
    other_portal: async () => pinned.mint("workday"),
  };
  for (const [name, mintKey] of Object.entries(cases)) {
    const h = fakeApi({ granted: true });
    const s = await server({ client: { mintKey, destroyKey: async () => true } });
    try {
      configureApplyAway({ api: h.api, subtle, fetcher: s.fetcher, identity: pinned.identity() });
      const r = await connectAway({ id: 41, url: DASHBOARD });
      assert.equal(r.ok, false, `${name}: ${JSON.stringify(r)}`);
      assert.equal(r.reason, "bad_signature", name);
      assert.deepEqual(h.cookieUrls, [], `${name}: no cookie was read`);
      assert.ok(!s.sent.some(x => x.path === "/api/portals/upload"), `${name}: nothing uploaded`);
      assert.equal(s.db.prepare("SELECT COUNT(*) FROM portal_sessions").pluck().get(), 0);
    } finally { await s.close(); }
  }
  // the verifier itself: the genuine key passes, garbage is false (never a throw)
  const m = pinned.mint("amazon");
  assert.equal(await verifyMintedKey(subtle, { ...m, identity: pinned.identity() }), true);
  assert.equal(await verifyMintedKey(subtle, { ...m, identity: impostor.identity() }), false);
  assert.equal(await verifyMintedKey(subtle, { ...m, identity: "!!" }), false);
  // ⛔ until the owner pins the deployed worker's identity, nothing is offered and nothing connects
  assert.equal(PINNED_WORKER_IDENTITY, "", "the shipped pin is empty until the owner pins the deployed worker");
  const h = fakeApi({ granted: true });
  configureApplyAway({ api: h.api, subtle, fetcher: async () => { throw new Error("no request may be made"); } });
  assert.equal((await connectAway({ id: 41, url: DASHBOARD })).reason, "not_pinned");
  assert.equal(await awayFactsFor({ id: 41, url: DASHBOARD }), null);
  assert.deepEqual(h.cookieUrls, []);
});

// ── 5 · Disconnect deletes ────────────────────────────────────────────────────────────────────────────────────────────
test("⭐ d112ApplyAway · Disconnect deletes — DELETE /api/portals/:id, the session revoked, the worker's key destroyed (the ciphertext can never be opened again), and `cookies` given back", async () => {
  const h = fakeApi({ granted: true });
  const s = await server();
  try {
    configureApplyAway({ api: h.api, subtle, fetcher: s.fetcher, identity: s.keys.identity() });
    const c = await connectAway({ id: 41, url: DASHBOARD });
    assert.equal(c.ok, true);
    const row = s.db.prepare("SELECT * FROM portal_sessions WHERE id = ?").get(c.portalId);
    const d = await disconnectAway({ id: 41, url: DASHBOARD });
    assert.equal(d.ok, true);
    assert.equal(d.keyDestroyed, true);
    assert.match(d.say, /key is destroyed/);
    assert.ok(s.sent.some(x => x.method === "DELETE" && x.path === `/api/portals/${c.portalId}`));
    assert.ok(s.db.prepare("SELECT revoked_at FROM portal_sessions WHERE id = ?").pluck().get(c.portalId), "revoked");
    assert.throws(() => s.keys.unseal({ keyId: row.key_id, sealed: row.ciphertext, aad: workerAad({ userId: 7, portalFamily: "amazon" }) }), /destroyed/);
    assert.deepEqual(h.removed, [{ permissions: ["cookies"] }]);
    // nothing left to disconnect
    assert.equal((await disconnectAway({ id: 41, url: DASHBOARD })).ok, false);
  } finally { await s.close(); }
});

// ── 6 · the dock's line ───────────────────────────────────────────────────────────────────────────────────────────────
test("d112ApplyAway · the dock offers the line only on a connectable portal page the user is signed in to (worker running, identity pinned); connected → the connected line with Disconnect; the press adds it to its popups", async () => {
  const s = await server();
  try {
    const h = fakeApi({ granted: false });
    let signedIn = false;
    configureApplyAway({ api: h.api, subtle, fetcher: s.fetcher, identity: s.keys.identity(), signedIn: async () => signedIn });
    assert.equal(await awayFactsFor({ id: 1, url: "https://careers.northwind.test/jobs/1" }), null, "another site: nothing, not even a request");
    assert.deepEqual(s.sent, []);
    assert.equal(await awayFactsFor({ id: 1, url: DASHBOARD }), null, "signed out of the portal: nothing");
    signedIn = true;
    const offer = await awayFactsFor({ id: 1, url: DASHBOARD });
    assert.deepEqual(offer, { state: "offer", family: "amazon" });
    const [spec] = awayRelay(offer);
    assert.equal(spec.text, "Let draft apply here while you're away?");
    assert.equal(spec.actions[0].id, "apply-away");
    // the press puts it among the dock's popups
    const shown = [];
    await toolbarPress({ id: 1, url: DASHBOARD }, { state: async () => ({ exists: false }), openDock: async () => ({ ok: true }),
      identity: async () => ({ authenticated: true }), context: async () => null, relay: async (_t, specs) => shown.push(...specs),
      openBoard: async () => {}, away: async () => awayRelay(offer) });
    assert.deepEqual(shown.map(x => x.id), ["draft-away"]);
    assert.deepEqual(relayFor({ identity: { authenticated: false }, away: awayRelay(offer) }).map(x => x.id), ["draft-relay"], "signed out of draft: only the sign-in line");
    // connected (through the window's Allow) → the connected line, shown on the tab after the window closes
    h.granted = true;
    const shownOnTab = [];
    configureApplyAway({ api: { ...h.api, tabs: { get: async () => ({ id: 1, url: DASHBOARD, windowId: 2 }), update: async () => ({}) } },
      subtle, fetcher: s.fetcher, identity: s.keys.identity(), signedIn: async () => true, show: async (tabId, specs) => shownOnTab.push([tabId, specs]) });
    const ans = await handlers.APPLY_AWAY_ANSWER({ answer: "allow", tabId: 1 }, { id: "ext", url: "chrome-extension://ext/apply-away.html?tab=1&family=amazon" });
    assert.equal(ans.connected, true);
    assert.equal(shownOnTab[0][0], 1);
    assert.equal(shownOnTab[0][1][0].actions[0].id, "apply-away-disconnect");
    const facts = await awayFactsFor({ id: 1, url: DASHBOARD });
    assert.equal(facts.state, "connected");
    assert.equal(awayRelay(facts)[0].text, "draft can apply on amazon.jobs while you're away.");
    // the dock's press when already granted connects at once and answers with the connected line
    const again = await startAway({ id: 1, url: DASHBOARD });
    assert.equal(again.next?.actions?.[0]?.id, "apply-away-disconnect");
  } finally { await s.close(); }
  // no worker configured → never offered (no dead button)
  const n = await server({ worker: false });
  try {
    configureApplyAway({ api: fakeApi().api, subtle, fetcher: n.fetcher, identity: "pinned", signedIn: async () => true });
    assert.equal(await awayFactsFor({ id: 1, url: DASHBOARD }), null);
  } finally { await n.close(); }
  // the signed-in check is self-contained (injected) and returns a boolean only
  const fn = portalSignedInInPage.toString();
  assert.doesNotMatch(fn, /APPLY_AWAY|awayFamily|chrome\.|fetch\(/);
  const doc = (nodes) => ({ querySelectorAll: () => nodes.map(n => ({ textContent: n.t || "", getAttribute: (k) => (k === "href" ? n.href || null : null) })) });
  globalThis.document = doc([{ t: "Jobs" }, { t: "Sign out" }]);
  assert.equal(portalSignedInInPage(), true);
  globalThis.document = doc([{ t: "Account", href: "/logout?x=1" }]);
  assert.equal(portalSignedInInPage(), true);
  globalThis.document = doc([{ t: "Sign in" }, { t: "Create account" }]);
  assert.equal(portalSignedInInPage(), false);
  delete globalThis.document;
});

// ── 7 · the wiring and the package ────────────────────────────────────────────────────────────────────────────────────
test("d112ApplyAway · background wires the two dock presses to the TAB, the window's answer, and the page ships in the v1.6.0 package", () => {
  const bg = read("extension/background.js");
  assert.match(bg, /'apply-away': async \(tab\) => startAway\(tab\),/);
  assert.match(bg, /'apply-away-disconnect': async \(tab\) => disconnectAway\(tab\),/);
  assert.match(bg, /const handle = APPLY_AWAY_HANDLERS\[msg\?\.type\];/);
  assert.match(bg, /fetcher: \(path, init\) => authedFetch\(RESUME_MASTER_URL, path, init\),/, "the extension's own token to draft's server");
  // shipped first in 1.6.0; later versions (1.6.1, 46j) still carry it
  assert.ok(manifest.version.split(".").map(Number).reduce((a, n, i) => a || (n !== [1, 6, 0][i] ? (n > [1, 6, 0][i] ? 1 : -1) : 0), 0) >= 0, `manifest v${manifest.version} is below 1.6.0`);
  const files = collectRequiredFiles(manifest);
  for (const f of ["applyAway.js", "apply-away.html", "apply-away.js"]) assert.ok(files.includes(f), f);
  const why = read("extension/MANIFEST_RATIONALE.md");
  assert.match(why, /## Optional permissions/);
  assert.match(why, /\| `cookies` \|/);
});

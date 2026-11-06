// extension/applyAway.js — ⭐⭐ D112 item 7 (D100 P3, desktop) · "LET DRAFT APPLY HERE WHILE YOU'RE AWAY".
//
// Owner 10-30: "build both android thing and apply here when im away. build it and we can release it when we are ready."
// The attended Amazon run (D100 P5, 10-30) showed Amazon's sign-in refuses the apply worker's automated browser (403,
// `portal_blocked`) — so for Amazon the worker can only apply with the user's OWN sign-in. This is the desktop way to
// hand it over: on a portal page where the user is signed in, the dock offers the line; one press (and Chrome's own
// prompt, raised from a small extension window — the b2 shape, as the global-read ask) lets draft:
//
//   1. ask draft's server for a per-session key the apply worker mints (POST /api/portals/connect/start), and
//   2. ⛔ VERIFY its signature against the worker identity PINNED in this file — never the identity the response carries,
//      so a compromised draft cannot hand the extension a key of its own; a bad signature stops everything, nothing read;
//   3. only then read THAT portal's cookies — the family's own hosts (APPLY_AWAY_FAMILIES, a mirror of
//      services/applyOrigins.js, held HERE and never taken from the server: a server that could name the hosts could
//      name any site's) — and nothing on any other site;
//   4. seal them in the extension to the minted key (the scheme apply-worker/lib/keys.js opens: X25519 + HKDF-SHA256 +
//      AES-256-GCM, associated data "user|portal|v1") — ⛔ the cookies never leave this computer unsealed;
//   5. upload the ciphertext only (POST /api/portals/upload); and show the connected state with Disconnect
//      (DELETE /api/portals/:id — the worker destroys the key; every stored copy is unreadable from then on).
//
// The optional `cookies` permission (manifest `optional_permissions`) plus the family's origins are requested ONLY in the
// ask window's Allow press (apply-away.js onAllow), as its first call. No `chrome` at the top level — node tests import
// this with fakes (test/d112ApplyAway.test.js); every browser call goes through the `api` handed in.

// ── the families draft may connect, and the identity it trusts ─────────────────────────────────────────────────────────
/**
 * Mirrors services/applyOrigins.js APPLY_ORIGIN_FAMILIES (test/d112ApplyAway.test.js holds each row to it). Only ACCOUNT
 * portals are here — Greenhouse, Lever, Ashby and Workable apply on open forms and need no session.
 *   ats         the family's name — the server's portal_family
 *   name        the portal, in a sentence
 *   origins     every origin whose cookies may be read (exactly the family's)
 *   originHost  the host the session is stored under: the worker's runs match it and its subdomains (sessionForHost)
 */
export const APPLY_AWAY_FAMILIES = Object.freeze([
  Object.freeze({
    ats: 'amazon',
    name: 'amazon.jobs',
    origins: Object.freeze(['https://www.amazon.jobs', 'https://amazon.jobs', 'https://account.amazon.jobs']),
    originHost: 'amazon.jobs',
  }),
]);

/**
 * ⛔ THE PINNED APPLY-WORKER IDENTITY — the Ed25519 public key (SPKI DER, base64url) of the worker's long-term signing
 * identity (apply-worker/lib/keys.js; the deployed worker answers GET /identity with it). EMPTY UNTIL THE OWNER PINS THE
 * DEPLOYED WORKER'S KEY: while it is empty the line is never offered and nothing can be connected (no dead button).
 */
export const PINNED_WORKER_IDENTITY = '';

export const AWAY_PERMISSION_NAME = 'cookies';
export const AWAY_PAGE = 'apply-away.html';
export const AWAY_SIZE = Object.freeze({ width: 460, height: 420 });
const INFO = 'draft-apply-worker/session/v1';
const FAMILY_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;

/** The family a page belongs to — by its ORIGIN, exactly — or null. */
export function awayFamilyFor(url, families = APPLY_AWAY_FAMILIES) {
  let origin;
  try { const u = new URL(String(url)); if (u.protocol !== 'https:') return null; origin = u.origin; } catch { return null; }
  return families.find(f => f.origins.includes(origin)) || null;
}
/** What Chrome is asked for: `cookies`, and the family's own origins (Chrome reads a cookie only for a granted host). */
export function awayPermission(family) {
  return { permissions: [AWAY_PERMISSION_NAME], origins: family.origins.map(o => `${o}/*`) };
}
const hostsOf = (family) => family.origins.map(o => new URL(o).hostname);

// ── the words ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function awayWords(family) {
  const hosts = hostsOf(family);
  const list = `${hosts.slice(0, -1).join(', ')} and ${hosts.at(-1)}`;
  return Object.freeze({
    offer: "Let draft apply here while you're away?",
    offerLabel: `Let draft apply on ${family.name} while you're away — keeps your sign-in sealed`,
    connected: `draft can apply on ${family.name} while you're away.`,
    disconnectLabel: `Disconnect ${family.name} — the key is destroyed and the stored sign-in becomes unreadable`,
    title: `Let draft apply on ${family.name} while you're away?`,
    lead: `draft keeps your ${family.name} sign-in, sealed, so its apply worker can fill your applications there when you are not at the computer.`,
    points: Object.freeze([
      `Chrome asks once to let draft read cookies — only ${family.name}'s (${list}), only now. Never another site's.`,
      "They are sealed on this computer to a key only draft's apply worker holds. draft's servers store them but cannot open them. Your password is never read.",
      'Your Draft House mode decides the rest: in SEMI each application waits for your approval; FULL AUTO sends by your standing instruction.',
      'Disconnect here or in Draft House → Portals at any time: the key is destroyed and the stored sign-in can never be opened again.',
    ]),
    promise: 'Nothing is read on any other site, and your sign-in never leaves this computer unsealed.',
    allow: 'Allow and connect',
    later: 'Not now',
    asking: `Chrome will ask you about ${family.name} only.`,
    refused: 'Chrome did not allow it — nothing was read.',
    done: `Connected — draft can apply on ${family.name} while you're away.`,
  });
}

// ── base64url, bytes ──────────────────────────────────────────────────────────────────────────────────────────────────
const enc = (s) => new TextEncoder().encode(String(s));
export function b64u(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64u(s) {
  const t = String(s ?? '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*$/.test(t)) throw new Error('bad base64url');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── the cryptography (WebCrypto — the service worker's and node's own) ───────────────────────────────────────────────
/** keys.js signedMessage — the exact bytes the worker signs. */
export const signedMessage = ({ keyId, publicKey, portalFamily }) => `draft-apply-worker/v1|${keyId}|${publicKey}|${portalFamily}`;
/** keys.js aadFor — the binding sealed in: user · portal · version. */
export const aadFor = ({ userId, portalFamily }) => `${Number(userId)}|${String(portalFamily)}|v1`;

/** ⛔ Is the minted key signed by `identity` (the PINNED one)? Never throws: anything malformed is false. */
export async function verifyMintedKey(subtle, { identity, keyId, publicKey, portalFamily, signature }) {
  try {
    if (!identity || !keyId || !publicKey || !signature) return false;
    const pub = await subtle.importKey('spki', fromB64u(identity), { name: 'Ed25519' }, false, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, pub, fromB64u(signature), enc(signedMessage({ keyId, publicKey, portalFamily })));
  } catch { return false; }
}

/**
 * Seal `plaintext` to the worker's per-session X25519 key — keys.js seal(), step for step, so only its unseal() opens it:
 *   "v1." + epk + "." + iv + "." + tag + "." + ct   (each base64url; epk the ephemeral public key, SPKI DER)
 *   key = HKDF-SHA256(X25519(eph, session), salt = keyId, info = "draft-apply-worker/session/v1") → AES-256-GCM, aad bound.
 */
export async function sealForWorker(subtle, { publicKey, keyId, plaintext, aad }, random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const peer = await subtle.importKey('spki', fromB64u(publicKey), { name: 'X25519' }, false, []);
  const eph = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const shared = await subtle.deriveBits({ name: 'X25519', public: peer }, eph.privateKey, 256);
  const ikm = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
  const raw = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc(keyId), info: enc(INFO) }, ikm, 256);
  const key = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = random(12);
  const out = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc(aad), tagLength: 128 }, key, enc(plaintext)));
  const epk = new Uint8Array(await subtle.exportKey('spki', eph.publicKey));
  return ['v1', b64u(epk), b64u(iv), b64u(out.subarray(out.length - 16)), b64u(out.subarray(0, out.length - 16))].join('.');
}

// ── the cookies — the family's hosts only ─────────────────────────────────────────────────────────────────────────────
const SAME_SITE = Object.freeze({ no_restriction: 'None', lax: 'Lax', strict: 'Strict' });
/** One chrome.cookies cookie → the fill engine's (puppeteer setCookie) shape. A host-only cookie stays host-only (url). */
function toEngineCookie(c) {
  const host = String(c.domain || '').replace(/^\./, '').toLowerCase();
  const path = c.path || '/';
  return {
    name: c.name, value: c.value, path,
    ...(c.hostOnly ? { url: `https://${host}${path}` } : { domain: c.domain }),
    secure: !!c.secure, httpOnly: !!c.httpOnly,
    ...(SAME_SITE[c.sameSite] ? { sameSite: SAME_SITE[c.sameSite] } : {}),
    expires: c.session || !Number.isFinite(c.expirationDate) ? -1 : Math.floor(c.expirationDate),
  };
}
/**
 * ⛔ Read ONLY the family's cookies: chrome.cookies.getAll({ url }) for each of the family's origins (what the browser
 * would send there), and of those only a cookie whose domain IS one of the family's hosts or a parent domain of one
 * (".amazon.jobs" for account.amazon.jobs) — never a bare suffix. Deduplicated by name · domain · path.
 */
export async function readFamilyCookies(api, family) {
  const hosts = hostsOf(family);
  const seen = new Map();
  for (const origin of family.origins) {
    const list = await api.cookies.getAll({ url: `${origin}/` });
    for (const c of list || []) {
      const d = String(c?.domain || '').replace(/^\./, '').toLowerCase();
      if (!d.includes('.') || !hosts.some(h => h === d || h.endsWith(`.${d}`))) continue;
      if (c.hostOnly && !hosts.includes(d)) continue;
      seen.set(`${c.name}|${c.domain}|${c.path}`, toEngineCookie(c));
    }
  }
  return [...seen.values()];
}

/** Injected into the TOP frame (self-contained): does the page show a sign-out control? A boolean leaves it — nothing else. */
export function portalSignedInInPage() {
  const words = /\b(sign|log)[\s-]?out\b/i;
  const href = /(sign|log)[-_]?out/i;
  for (const n of document.querySelectorAll('a, button, [role="menuitem"], [role="button"]')) {
    if (words.test(String(n.textContent || '').trim().slice(0, 40))) return true;
    if (href.test(String((n.getAttribute && n.getAttribute('href')) || ''))) return true;
  }
  return false;
}

// ── the service worker's side ─────────────────────────────────────────────────────────────────────────────────────────
let DEPS = null;
/**
 * background.js wires it once. deps:
 *   api        chrome (permissions, cookies, windows, tabs, runtime)
 *   subtle     crypto.subtle
 *   fetcher(path, init) → Response | null   (authedFetch to draft's own server — the extension's token, never a cookie)
 *   show(tabId, specs)  draws the dock's popups in that tab (renderRelay)
 *   signedIn(tab)       → boolean: portalSignedInInPage in the tab's top frame
 *   identity            the pinned worker identity (defaults to PINNED_WORKER_IDENTITY; tests pass their own)
 */
export function configureApplyAway(deps = {}) { DEPS = { identity: PINNED_WORKER_IDENTITY, ...deps }; return DEPS; }
const deps = () => { if (!DEPS) throw new Error('applyAway not configured'); return DEPS; };

const json = async (r) => (r ? r.json().catch(() => ({})) : null);
const granted = (family) => Promise.resolve(deps().api.permissions.contains(awayPermission(family))).catch(() => false);

/** The user's live session for a family (from GET /api/portals), and whether the worker is there at all. */
async function portalsFor(family) {
  const r = await deps().fetcher('/api/portals', { method: 'GET' }).catch(() => null);
  if (!r?.ok) return null;
  const body = await json(r);
  const live = (body?.portals || []).find(p => p.portalFamily === family.ats && (p.status === 'active' || p.status === 'expiring'));
  return { worker: !!body?.worker, live: live || null };
}

/**
 * What the toolbar press may say about this tab: null (nothing), or
 *   { state: 'connected', family, portalId }  → the connected line with Disconnect
 *   { state: 'offer', family }                → "Let draft apply here while you're away?"
 * Offered only on a family's page, with an identity pinned, the worker running, and the page showing it is signed in.
 */
export async function awayFactsFor(tab) {
  const family = awayFamilyFor(tab?.url);
  if (!family || !deps().identity) return null;
  const p = await portalsFor(family);
  if (!p?.worker) return null;
  if (p.live) return { state: 'connected', family: family.ats, portalId: p.live.id };
  const inPage = await Promise.resolve(deps().signedIn?.(tab)).catch(() => false);
  return inPage ? { state: 'offer', family: family.ats } : null;
}

/** The dock's popups for those facts (toolbarPress.js relayFor adds them). */
export function awayRelay(away) {
  const family = APPLY_AWAY_FAMILIES.find(f => f.ats === away?.family);
  if (!family) return [];
  const w = awayWords(family);
  if (away.state === 'connected') {
    return [{ id: 'draft-away', kind: 'toast', icon: 'check', tone: 'ok', ms: 8000, text: w.connected,
      actions: [{ id: 'apply-away-disconnect', label: w.disconnectLabel, word: 'Disconnect' }] }];
  }
  if (away.state === 'offer') {
    return [{ id: 'draft-away', kind: 'question', icon: 'info', text: w.offer,
      actions: [{ id: 'apply-away', label: w.offerLabel, word: 'Let draft', primary: true }] }];
  }
  return [];
}

/**
 * Connect the tab's portal. ⛔ The family is the TAB's (never a message's). Order: the grant → the user → mint → VERIFY →
 * read → seal → upload. → { ok, portalId } or { ok: false, reason, say }
 */
export async function connectAway(tab) {
  const d = deps();
  const family = awayFamilyFor(tab?.url);
  if (!family) return { ok: false, reason: 'not_a_portal', say: 'draft cannot connect this site.' };
  if (!d.identity) return { ok: false, reason: 'not_pinned', say: 'This version of draft cannot connect a portal yet.' };
  if (!(await granted(family))) return { ok: false, reason: 'not_granted', say: awayWords(family).refused };
  const me = await json(await d.fetcher('/api/auth/me', { method: 'GET' }).catch(() => null));
  const userId = Number(me?.user?.id);
  if (!me?.authenticated || !Number.isInteger(userId)) return { ok: false, reason: 'signed_out', say: 'Sign in to draft first.' };
  const mintRes = await d.fetcher('/api/portals/connect/start', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalFamily: family.ats }) }).catch(() => null);
  const minted = await json(mintRes);
  if (!mintRes?.ok || !minted) return { ok: false, reason: 'worker_unavailable', say: minted?.message || "draft's apply worker could not be reached — nothing was read." };
  // ⛔ the PINNED identity, never minted.identity; and the key must be minted for THIS family
  const ok = minted.portalFamily === family.ats && FAMILY_RE.test(family.ats)
    && await verifyMintedKey(d.subtle, { identity: d.identity, keyId: minted.keyId, publicKey: minted.publicKey, portalFamily: family.ats, signature: minted.signature });
  if (!ok) return { ok: false, reason: 'bad_signature', say: "The apply worker's key could not be verified — nothing was read or sent." };
  const cookies = await readFamilyCookies(d.api, family);
  if (!cookies.length) return { ok: false, reason: 'not_signed_in', say: `Sign in to ${family.name} on this page first — nothing was sent.` };
  let ciphertext;
  try {
    ciphertext = await sealForWorker(d.subtle, { publicKey: minted.publicKey, keyId: minted.keyId,
      plaintext: JSON.stringify({ cookies }), aad: aadFor({ userId, portalFamily: family.ats }) });
  } catch { return { ok: false, reason: 'seal_failed', say: 'This Chrome cannot seal the sign-in — update Chrome and try again. Nothing was sent.' }; }
  const up = await d.fetcher('/api/portals/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalFamily: family.ats, originHost: family.originHost, keyId: minted.keyId, ciphertext, consent: true }) }).catch(() => null);
  const body = await json(up);
  if (!up?.ok) return { ok: false, reason: 'upload_failed', say: body?.message || 'Could not save the sealed sign-in — try again.' };
  return { ok: true, portalId: body?.id ?? null, family: family.ats };
}

/** Disconnect the tab's portal: DELETE its live session (the worker destroys the key), then give `cookies` back. */
export async function disconnectAway(tab) {
  const d = deps();
  const family = awayFamilyFor(tab?.url);
  if (!family) return { ok: false, say: 'draft has nothing connected for this site.' };
  const p = await portalsFor(family);
  if (!p?.live) return { ok: false, say: `${family.name} is not connected.` };
  const r = await d.fetcher(`/api/portals/${encodeURIComponent(p.live.id)}`, { method: 'DELETE' }).catch(() => null);
  const body = await json(r);
  if (!r?.ok) return { ok: false, say: 'Could not disconnect — try again, or remove it in Home → Portals.' };
  // nothing else of ours reads a cookie: the API permission goes back (the family's hosts may still serve global read)
  try { await d.api.permissions.remove({ permissions: [AWAY_PERMISSION_NAME] }); } catch { /* already gone */ }
  return { ok: true, removed: true, keyDestroyed: !!body?.keyDestroyed,
    say: body?.keyDestroyed ? `Disconnected — the key is destroyed; your ${family.name} sign-in can no longer be opened.`
      : `Disconnected here — draft will not use it again. The apply worker could not be reached to destroy the key yet.` };
}

// ── the ask window (b2's shape: a small extension window over the tab that closes itself) ───────────────────────────────
let ASK = null;   // { windowId, tabId } — in the worker's memory only
export function awayAskWindow() { return ASK ? { ...ASK } : null; }

/** The dock's press: granted already → connect now; otherwise open the window whose Allow asks Chrome. */
export async function startAway(tab) {
  const d = deps();
  const family = awayFamilyFor(tab?.url);
  if (!family || !d.identity) return { ok: false, say: 'draft cannot connect this site.' };
  if (await granted(family)) {
    const r = await connectAway(tab);
    return r.ok ? { ok: true, next: awayRelay({ state: 'connected', family: family.ats, portalId: r.portalId })[0] } : { ok: false, say: r.say };
  }
  if (ASK) {
    try { await d.api.windows.update(ASK.windowId, { focused: true }); ASK.tabId = tab.id; return { ok: true, say: null, focused: true }; }
    catch { ASK = null; }
  }
  const win = await d.api.windows.create({ url: d.api.runtime.getURL(`apply-away.html?tab=${encodeURIComponent(tab.id)}&family=${encodeURIComponent(family.ats)}`),
    type: 'popup', focused: true, width: AWAY_SIZE.width, height: AWAY_SIZE.height });
  ASK = { windowId: win?.id ?? null, tabId: tab.id };
  return { ok: true, say: null, opened: true };
}

async function closeAndReturn(ask) {
  const { api } = deps();
  ASK = null;
  if (ask?.windowId != null) { try { await api.windows.remove(ask.windowId); } catch { /* closed */ } }
  if (!Number.isInteger(ask?.tabId)) return null;
  const t = await Promise.resolve(api.tabs.get(ask.tabId)).catch(() => null);
  if (!t) return null;
  try { if (t.windowId != null) await api.windows.update(t.windowId, { focused: true }); } catch { /* gone */ }
  try { await api.tabs.update(t.id, { active: true }); } catch { /* gone */ }
  return t;
}
export function onAwayWindowRemoved(windowId) { if (ASK && ASK.windowId === windowId) ASK = null; }

const fromAwayPage = (sender) => {
  const { api } = deps();
  return typeof sender?.url === 'string' && sender.url.startsWith(api.runtime.getURL(AWAY_PAGE)) && (sender.id == null || sender.id === api.runtime.id);
};

export const handlers = Object.freeze({
  /** The window's answer: 'allow' (Chrome's grant is checked here, not believed) or 'later'. ⛔ From the window only. */
  APPLY_AWAY_ANSWER: async (msg, sender) => {
    if (!fromAwayPage(sender)) return { ok: false, error: 'not_allowed' };
    if (!['allow', 'later'].includes(msg?.answer)) return { ok: false, error: 'bad_answer' };
    const tabId = Number.isInteger(ASK?.tabId) ? ASK.tabId : Number.parseInt(msg?.tabId, 10);
    const ask = { windowId: ASK?.windowId ?? sender?.tab?.windowId ?? null, tabId: Number.isInteger(tabId) ? tabId : null };
    const tab = ask.tabId != null ? await Promise.resolve(deps().api.tabs.get(ask.tabId)).catch(() => null) : null;
    let result = { ok: false, reason: 'later' };
    if (msg.answer === 'allow' && tab) result = await connectAway(tab);
    await closeAndReturn(ask);
    if (tab && msg.answer === 'allow') {
      const family = awayFamilyFor(tab.url);
      const specs = result.ok ? awayRelay({ state: 'connected', family: family?.ats, portalId: result.portalId })
        : [{ id: 'draft-away', kind: 'toast', icon: 'need', tone: 'need', ms: 8000, text: result.say || 'Nothing was connected.' }];
      try { await deps().show?.(tab.id, specs); } catch { /* the page went away */ }
    }
    return { ok: true, connected: !!result.ok, reason: result.ok ? null : result.reason };
  },
});

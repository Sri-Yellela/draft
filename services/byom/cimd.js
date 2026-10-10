// services/byom/cimd.js — ⭐ D86 · CLIENT ID METADATA DOCUMENTS (A96), with the SSRF review it waited for.
//
// With CIMD the client's `client_id` IS an https URL; the authorization server fetches that document to learn the
// client's name and redirect URIs (MCP authorization spec, 2025-11-25). Claude prefers it to DCR (DCR makes Claude
// register a new client on every fresh connection) and OpenAI prefers it too. Fetching a URL the caller names is
// the classic server-side request forgery, so the fetch is fenced:
//   · ONLY Claude's and ChatGPT's own hosts — the allow-list is the HOSTS table's origins, so an attacker cannot
//     make draft fetch anything else (no private address, no internal service, no other site);
//   · https on the default port, no credentials, no query or fragment in the URL;
//   · NO REDIRECTS (a redirect could leave the allow-list), a 5-second timeout, a 64 KB cap, JSON only;
//   · the document must name itself (`client_id` equal to the URL), be a public client (`none`), ask only for
//     the authorization-code and refresh grants, and list redirect URIs that belong to the same host family
//     (hostForRedirect) — Claude Code's portless loopback `http://localhost/callback` included.
// A verified document is kept in oauth_clients (registration 'cimd') so codes and tokens reference a row like any
// DCR client; it is re-fetched at most hourly while the server runs.
import { HOSTS, OAuthError, hostForRedirect } from "./oauthServer.js";

export const CIMD_TIMEOUT_MS = 5000;
export const CIMD_MAX_BYTES = 64 * 1024;
export const CIMD_REFRESH_MS = 60 * 60 * 1000;

const ALLOWED_ORIGINS = new Set(Object.values(HOSTS).flatMap(h => h.origins));
const fetchedAt = new Map();

/** Is this client_id a CIMD URL draft is willing to fetch? Returns the URL or null. */
export function cimdUrl(clientId) {
  let u;
  try { u = new URL(String(clientId ?? "")); } catch { return null; }
  if (u.protocol !== "https:" || u.port || u.username || u.password || u.search || u.hash) return null;
  if (!ALLOWED_ORIGINS.has(u.origin) || u.pathname.length < 2) return null;
  return u.href === String(clientId) ? u.href : null;
}

async function readCapped(res) {
  const reader = res.body?.getReader?.();
  if (!reader) { const t = await res.text(); if (t.length > CIMD_MAX_BYTES) throw new Error("too large"); return t; }
  const chunks = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > CIMD_MAX_BYTES) { try { await reader.cancel(); } catch { /* closed */ } throw new Error("too large"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c))).toString("utf8");
}

/** Validates a fetched document against its URL; returns { name, host, redirectUris }. */
export function checkClientMetadata(url, doc, { production = true } = {}) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new OAuthError("invalid_client", "The client metadata document is not a JSON object.");
  if (doc.client_id !== url) throw new OAuthError("invalid_client", "The client metadata document does not name itself as this client_id.");
  if ((doc.token_endpoint_auth_method ?? "none") !== "none") throw new OAuthError("invalid_client", "draft accepts public clients only (token_endpoint_auth_method none).");
  const grants = doc.grant_types ?? ["authorization_code"];
  if (!Array.isArray(grants) || grants.some(g => !["authorization_code", "refresh_token"].includes(g))) throw new OAuthError("invalid_client", "grant_types may be authorization_code and refresh_token only.");
  const uris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 5) throw new OAuthError("invalid_client", "redirect_uris must list 1 to 5 URIs.");
  const docHost = Object.entries(HOSTS).find(([, h]) => h.origins.includes(new URL(url).origin))?.[0];
  const hosts = new Set(uris.map(u => hostForRedirect(u, { production })));
  if (hosts.size !== 1 || !hosts.has(docHost)) throw new OAuthError("invalid_client", "Every redirect URI must belong to the same app as the client metadata document.");
  return { name: String(doc.client_name ?? "").slice(0, 100) || null, host: docHost, redirectUris: uris };
}

/**
 * Makes sure a CIMD client is known: fetches and verifies its document when it is new or stale. A no-op for any
 * client_id that is not an allow-listed CIMD URL (a DCR client is looked up as before).
 * @param {{ fetchImpl?: typeof fetch, production?: boolean, now?: number }} opts
 */
export async function ensureCimdClient(db, clientId, { fetchImpl = globalThis.fetch, production = true, now = Date.now() } = {}) {
  const url = cimdUrl(clientId);
  if (!url) return null;
  const known = db.prepare("SELECT client_id FROM oauth_clients WHERE client_id = ? AND registration = 'cimd'").pluck().get(url);
  if (known && now - (fetchedAt.get(url) ?? 0) < CIMD_REFRESH_MS) return url;
  let doc;
  try {
    const res = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(CIMD_TIMEOUT_MS), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`status ${res.status}`);
    if (!/json/i.test(res.headers.get("content-type") || "")) throw new Error("not JSON");
    doc = JSON.parse(await readCapped(res));
  } catch (e) {
    if (known) return url; // a transient fetch failure keeps a previously verified client working
    throw new OAuthError("invalid_client", `draft could not read this app's client metadata document (${String(e?.message || e).slice(0, 60)}).`);
  }
  const c = checkClientMetadata(url, doc, { production });
  db.prepare(`INSERT INTO oauth_clients (client_id, client_name, host, redirect_uris, registration) VALUES (?, ?, ?, ?, 'cimd')
    ON CONFLICT(client_id) DO UPDATE SET client_name = excluded.client_name, host = excluded.host, redirect_uris = excluded.redirect_uris`)
    .run(url, c.name, c.host, JSON.stringify(c.redirectUris));
  fetchedAt.set(url, now);
  return url;
}

/** For tests: forget fetch times. */
export function _resetCimdCache() { fetchedAt.clear(); }

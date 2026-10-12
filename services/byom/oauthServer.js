// services/byom/oauthServer.js — ⭐ D86 · draft AS AN OAUTH 2.1 AUTHORIZATION SERVER FOR AN MCP CLIENT.
//
// The user adds draft's connector INSIDE Claude or ChatGPT; that host sends them to draft's own consent
// screen; draft issues the host a token scoped to résumé work. There is no "sign in with OpenAI" in draft —
// draft cannot sign in to anyone's model account, and does not try.
//
// What the MCP authorization spec and OpenAI's Apps SDK auth page require, and where each is here:
//   · authorization code + PKCE S256 only ................ validateAuthorize, exchangeCode
//   · dynamic client registration (RFC 7591) .............. registerClient — PUBLIC clients only (no secret)
//   · resource indicators: the token is bound to /mcp ..... `resource` stored with the code and the token,
//     and verifyAccessToken refuses a token minted for anything else
//   · refresh tokens, ROTATED; a replayed one revokes the connection (OAuth 2.1 §4.3.1)
//   · a replayed authorization code revokes what it issued (RFC 6749 §4.1.2)
// ⚠ Not here yet: CIMD (client ID metadata documents), which OpenAI prefers over DCR — it means draft
// fetching a URL the client names, so it waits for its own SSRF review. DCR works for both hosts today.
//
// ⛔ CODES AND TOKENS ARE STORED AS SHA-256 HASHES — a database read never yields a usable credential.
// ⛔ ONLY KNOWN HOSTS REGISTER. A redirect URI must be on Claude's or ChatGPT's host (localhost too, outside
// production), so an arbitrary site cannot register itself and phish a consent.
import crypto from "node:crypto";

export const SCOPES = Object.freeze(["resume:read", "resume:write"]);
export const DEFAULT_SCOPE = "resume:read resume:write";
export const ACCESS_TTL = 60 * 60;
export const REFRESH_TTL = 30 * 24 * 60 * 60;
export const CODE_TTL = 10 * 60;

// ⛔ D86 §5 (docs/CLAUDE_CONNECTOR_COMPLIANCE.md): Claude registers its ONE callback, matched exactly — it covers
// Claude web, Desktop, mobile and Cowork — and Claude Code's loopback `http://localhost:<port>/callback` (RFC 8252
// §7.3: a native app's port is ephemeral, so the port is the one part not matched). The loopback is Anthropic's
// own client, so it is the "claude" host and the same Allow-Claude switch governs it; the consent screen names it
// "Claude Code on this computer". ChatGPT's callback has a per-callback form, so it is matched by origin.
export const HOSTS = Object.freeze({
  claude: { label: "Claude", origins: ["https://claude.ai", "https://claude.com"],
    callbacks: ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"], loopbackPath: "/callback" },
  chatgpt: { label: "ChatGPT", origins: ["https://chatgpt.com", "https://chat.openai.com"] },
});

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
/** A Claude Code loopback callback (any port, exact path, no query). */
export const isLoopbackCallback = (uri) => {
  try { const u = new URL(String(uri)); return u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname) && u.pathname === HOSTS.claude.loopbackPath && !u.search && !u.hash; }
  catch { return false; }
};

export class OAuthError extends Error {
  constructor(error, description, status = 400) {
    super(description);
    this.error = error;
    this.status = status;
  }
  toJSON() { return { error: this.error, error_description: this.message }; }
}

const now = () => Math.floor(Date.now() / 1000);
export const hashSecret = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");
const randomToken = (prefix) => `${prefix}${crypto.randomBytes(32).toString("base64url")}`;

/** Which host a redirect URI belongs to — "claude" | "chatgpt" | "local" — or null for any other. */
export function hostForRedirect(uri, { production = true } = {}) {
  let u;
  try { u = new URL(String(uri)); } catch { return null; }
  if (u.hash) return null;
  for (const [host, { origins, callbacks }] of Object.entries(HOSTS)) {
    if (!origins.includes(u.origin)) continue;
    if (callbacks && (u.search || !callbacks.includes(`${u.origin}${u.pathname}`))) return null;
    return host;
  }
  if (isLoopbackCallback(uri)) return "claude";
  if (!production && u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)) return "local";
  return null;
}

// `offline_access` asks for a refresh token. draft always issues one, so it is accepted and dropped — Claude
// appends it when it is advertised, and OpenAI's help advises it; refusing it would fail the connection.
const NO_OP_SCOPES = new Set(["offline_access"]);

export function parseScope(scope) {
  const asked = String(scope ?? "").split(/\s+/).filter(s => s && !NO_OP_SCOPES.has(s));
  const unknown = asked.filter(s => !SCOPES.includes(s));
  if (unknown.length) throw new OAuthError("invalid_scope", `Unknown scope: ${unknown.join(" ")}`);
  return [...new Set(asked.length ? asked : DEFAULT_SCOPE.split(" "))].sort().join(" ");
}

const sameResource = (a, b) => String(a || "").replace(/\/+$/, "") === String(b || "").replace(/\/+$/, "");

/** RFC 7591 dynamic registration. Public clients only: draft issues no client secret. */
export function registerClient(db, body = {}, { production = true } = {}) {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 5) throw new OAuthError("invalid_redirect_uri", "redirect_uris must list 1 to 5 URIs.");
  const hosts = new Set(uris.map(u => hostForRedirect(u, { production })));
  if (hosts.has(null)) throw new OAuthError("invalid_redirect_uri", "draft accepts connections only from Claude and ChatGPT.");
  if (hosts.size !== 1) throw new OAuthError("invalid_redirect_uri", "All redirect URIs must belong to one host.");
  const method = body.token_endpoint_auth_method ?? "none";
  if (method !== "none") throw new OAuthError("invalid_client_metadata", "draft registers public clients only (token_endpoint_auth_method none, with PKCE).");
  // RFC 7591 §2: grants draft does not support are IGNORED, not refused — but authorization_code must be among them.
  // The registered client is returned with authorization_code + refresh_token only (below), whatever was asked.
  const grants = body.grant_types ?? ["authorization_code"];
  if (!Array.isArray(grants) || !grants.includes("authorization_code")) {
    throw new OAuthError("invalid_client_metadata", "grant_types must include authorization_code.");
  }
  const clientId = `dft_client_${crypto.randomBytes(16).toString("hex")}`;
  const name = String(body.client_name ?? "").slice(0, 100) || null;
  const [host] = hosts;
  db.prepare("INSERT INTO oauth_clients (client_id, client_name, host, redirect_uris, registration) VALUES (?,?,?,?, 'dcr')")
    .run(clientId, name, host, JSON.stringify(uris));
  return {
    client_id: clientId, client_id_issued_at: now(), client_name: name ?? undefined, redirect_uris: uris,
    token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
    scope: DEFAULT_SCOPE,
  };
}

/**
 * Exact match — except a LOOPBACK redirect, whose port is ephemeral (RFC 8252 §7.3): Claude Code's metadata
 * document registers `http://localhost/callback` and calls back on `http://localhost:<port>/callback`. Scheme,
 * host and path must still match exactly.
 */
export function redirectRegistered(registered, uri) {
  if (registered.includes(uri)) return true;
  let u;
  try { u = new URL(uri); } catch { return false; }
  if (u.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || u.search || u.hash) return false;
  return registered.some(r => { try { const v = new URL(r); return v.protocol === u.protocol && v.hostname === u.hostname && v.pathname === u.pathname && !v.search; } catch { return false; } });
}

export function getClient(db, clientId) {
  const row = db.prepare("SELECT * FROM oauth_clients WHERE client_id = ?").get(String(clientId ?? ""));
  return row ? { ...row, redirect_uris: JSON.parse(row.redirect_uris) } : null;
}

/**
 * Validates an authorization request BEFORE anything is shown. An unknown client or a redirect URI that is
 * not registered is answered here, never redirected to (RFC 6749 §4.1.2.1) — redirecting would make draft
 * an open redirector.
 * @returns {{ client, redirectUri, scope, codeChallenge, resource, state }}
 */
export function validateAuthorize(db, q = {}, { resource }) {
  const client = getClient(db, q.client_id);
  if (!client) throw new OAuthError("invalid_client", "This app is not registered with draft.");
  const redirectUri = String(q.redirect_uri ?? "");
  if (!redirectRegistered(client.redirect_uris, redirectUri)) throw new OAuthError("invalid_request", "redirect_uri is not one this app registered.");
  // From here on, errors may go back to the client's redirect URI.
  const redirectable = (e) => Object.assign(e, { redirectUri, state: q.state });
  if (q.response_type !== "code") throw redirectable(new OAuthError("unsupported_response_type", "Only response_type=code is supported."));
  if (!q.code_challenge || q.code_challenge_method !== "S256") throw redirectable(new OAuthError("invalid_request", "PKCE with code_challenge_method S256 is required."));
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(String(q.code_challenge))) throw redirectable(new OAuthError("invalid_request", "code_challenge is malformed."));
  if (q.resource != null && !sameResource(q.resource, resource)) throw redirectable(new OAuthError("invalid_target", "This server issues tokens for its /mcp endpoint only."));
  let scope;
  try { scope = parseScope(q.scope); } catch (e) { throw redirectable(e); }
  return { client, redirectUri, scope, codeChallenge: String(q.code_challenge), resource, state: q.state ?? null };
}

/** The user said Allow: one connection per (user, client), its scope widened to what was granted, and a code. */
export function issueCode(db, { userId, client, redirectUri, scope, codeChallenge, resource }) {
  const existing = db.prepare("SELECT id FROM oauth_connections WHERE user_id = ? AND client_id = ? AND revoked_at IS NULL").get(userId, client.client_id);
  const connectionId = existing?.id ?? db.prepare("INSERT INTO oauth_connections (user_id, client_id, scope) VALUES (?,?,?)")
    .run(userId, client.client_id, scope).lastInsertRowid;
  if (existing) db.prepare("UPDATE oauth_connections SET scope = ? WHERE id = ?").run(scope, connectionId);
  const code = randomToken("dft_code_");
  db.prepare("INSERT INTO oauth_codes (code_hash, connection_id, redirect_uri, code_challenge, resource, scope, expires_at) VALUES (?,?,?,?,?,?,?)")
    .run(hashSecret(code), connectionId, redirectUri, codeChallenge, resource, scope, now() + CODE_TTL);
  return { code, connectionId: Number(connectionId) };
}

function revokeConnectionTokens(db, connectionId) {
  db.prepare("UPDATE oauth_tokens SET revoked_at = unixepoch() WHERE connection_id = ? AND revoked_at IS NULL").run(connectionId);
}

function issueTokens(db, { connectionId, scope, resource }) {
  const access = randomToken("dft_at_");
  const refresh = randomToken("dft_rt_");
  const ins = db.prepare("INSERT INTO oauth_tokens (token_hash, connection_id, kind, scope, resource, expires_at) VALUES (?,?,?,?,?,?)");
  ins.run(hashSecret(access), connectionId, "access", scope, resource, now() + ACCESS_TTL);
  ins.run(hashSecret(refresh), connectionId, "refresh", scope, resource, now() + REFRESH_TTL);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL, refresh_token: refresh, scope };
}

const pkceOk = (verifier, challenge) =>
  /^[A-Za-z0-9._~-]{43,128}$/.test(String(verifier ?? "")) &&
  crypto.createHash("sha256").update(String(verifier)).digest("base64url") === challenge;

/** The token endpoint: authorization_code and refresh_token grants. */
// A refusal leaves the transaction COMMITTED: a replayed code or refresh token revokes the connection's tokens,
// and a throw inside better-sqlite3's transaction would roll that revocation back with it.
const fail = (error) => ({ error });
const settle = (result) => { if (result?.error instanceof OAuthError) throw result.error; return result; };

export function tokenGrant(db, body = {}, { resource }) {
  const client = getClient(db, body.client_id);
  if (!client) throw new OAuthError("invalid_client", "Unknown client.", 401);
  if (body.resource != null && !sameResource(body.resource, resource)) throw new OAuthError("invalid_target", "Tokens are issued for the /mcp endpoint only.");

  if (body.grant_type === "authorization_code") {
    return settle(db.transaction(() => {
      const row = db.prepare(`SELECT c.*, oc.client_id, oc.revoked_at AS conn_revoked FROM oauth_codes c
        JOIN oauth_connections oc ON oc.id = c.connection_id WHERE c.code_hash = ?`).get(hashSecret(body.code ?? ""));
      if (!row || row.client_id !== client.client_id) return fail(new OAuthError("invalid_grant", "The authorization code is not valid."));
      if (row.used_at) {
        revokeConnectionTokens(db, row.connection_id);
        return fail(new OAuthError("invalid_grant", "The authorization code was already used; its tokens are revoked."));
      }
      db.prepare("UPDATE oauth_codes SET used_at = unixepoch() WHERE code_hash = ?").run(row.code_hash);
      if (row.expires_at <= now() || row.conn_revoked) return fail(new OAuthError("invalid_grant", "The authorization code has expired."));
      if (String(body.redirect_uri ?? "") !== row.redirect_uri) return fail(new OAuthError("invalid_grant", "redirect_uri does not match the authorization request."));
      if (!pkceOk(body.code_verifier, row.code_challenge)) return fail(new OAuthError("invalid_grant", "PKCE verification failed."));
      return issueTokens(db, { connectionId: row.connection_id, scope: row.scope, resource: row.resource });
    })());
  }

  if (body.grant_type === "refresh_token") {
    return settle(db.transaction(() => {
      const row = db.prepare(`SELECT t.*, oc.client_id, oc.revoked_at AS conn_revoked FROM oauth_tokens t
        JOIN oauth_connections oc ON oc.id = t.connection_id WHERE t.token_hash = ? AND t.kind = 'refresh'`).get(hashSecret(body.refresh_token ?? ""));
      if (!row || row.client_id !== client.client_id) return fail(new OAuthError("invalid_grant", "The refresh token is not valid."));
      if (row.revoked_at) {
        // A rotated-out refresh token used again: someone holds a copy. Stop the whole connection.
        revokeConnectionTokens(db, row.connection_id);
        return fail(new OAuthError("invalid_grant", "The refresh token was already used; the connection's tokens are revoked."));
      }
      if (row.expires_at <= now() || row.conn_revoked) return fail(new OAuthError("invalid_grant", "The refresh token has expired or the connection was removed."));
      let scope = row.scope;
      if (body.scope != null) {
        scope = parseScope(body.scope);
        const granted = new Set(row.scope.split(" "));
        if (scope.split(" ").some(s => !granted.has(s))) return fail(new OAuthError("invalid_scope", "A refresh cannot widen the scope."));
      }
      db.prepare("UPDATE oauth_tokens SET revoked_at = unixepoch() WHERE token_hash = ?").run(row.token_hash);
      return issueTokens(db, { connectionId: row.connection_id, scope, resource: row.resource });
    })());
  }
  throw new OAuthError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token.");
}

/** RFC 7009: revoke one token. Always answers OK — revocation never tells a caller whether a token existed. */
export function revokeToken(db, token) {
  db.prepare("UPDATE oauth_tokens SET revoked_at = unixepoch() WHERE token_hash = ? AND revoked_at IS NULL").run(hashSecret(token ?? ""));
}

/**
 * The MCP endpoint's door. Returns { userId, connectionId, clientId, host, scopes } or null.
 * ⛔ Every condition is checked on every call: the token's expiry and revocation, the CONNECTION's
 * revocation (Disconnect stops the next call, not the next refresh), and the token's resource.
 */
export function verifyAccessToken(db, token, { resource }) {
  if (!token || !String(token).startsWith("dft_at_")) return null;
  const row = db.prepare(`SELECT t.connection_id, t.scope, t.resource, t.expires_at, t.revoked_at,
      oc.user_id, oc.client_id, oc.revoked_at AS conn_revoked, cl.host
    FROM oauth_tokens t JOIN oauth_connections oc ON oc.id = t.connection_id JOIN oauth_clients cl ON cl.client_id = oc.client_id
    WHERE t.token_hash = ? AND t.kind = 'access'`).get(hashSecret(token));
  if (!row || row.revoked_at || row.conn_revoked || row.expires_at <= now()) return null;
  if (!sameResource(row.resource, resource)) return null;
  // ⭐ D88 (39d): a suspended account's connected apps stop working with it.
  try { if (db.prepare("SELECT status FROM users WHERE id = ?").get(row.user_id)?.status === "suspended") return null; } catch { /* no status column */ }
  db.prepare("UPDATE oauth_connections SET last_used_at = unixepoch() WHERE id = ?").run(row.connection_id);
  return { userId: row.user_id, connectionId: row.connection_id, clientId: row.client_id, host: row.host, scopes: row.scope.split(" ") };
}

/** Settings → Connected apps. */
export function listConnections(db, userId) {
  return db.prepare(`SELECT oc.id, oc.scope, oc.created_at, oc.last_used_at, cl.host, cl.client_name,
      (SELECT COUNT(*) FROM byom_briefs b WHERE b.connection_id = oc.id AND b.status = 'used') AS resumes
    FROM oauth_connections oc JOIN oauth_clients cl ON cl.client_id = oc.client_id
    WHERE oc.user_id = ? AND oc.revoked_at IS NULL ORDER BY oc.created_at DESC`).all(userId)
    .map(r => ({ ...r, hostLabel: HOSTS[r.host]?.label ?? "Local test client", scopes: r.scope.split(" ") }));
}

/** Disconnect: the connection and every token it holds, at once. Returns whether anything was revoked. */
export function revokeConnection(db, userId, connectionId) {
  return db.transaction(() => {
    const r = db.prepare("UPDATE oauth_connections SET revoked_at = unixepoch() WHERE id = ? AND user_id = ? AND revoked_at IS NULL").run(connectionId, userId);
    if (r.changes) revokeConnectionTokens(db, connectionId);
    return r.changes > 0;
  })();
}

/** Every connection of a user — when they turn the master switch off. */
export function revokeAllConnections(db, userId) {
  const ids = db.prepare("SELECT id FROM oauth_connections WHERE user_id = ? AND revoked_at IS NULL").pluck().all(userId);
  for (const id of ids) revokeConnection(db, userId, id);
  return ids.length;
}

/** The two metadata documents (RFC 9728, RFC 8414). */
export function protectedResourceMetadata({ issuer, resource }) {
  return { resource, authorization_servers: [issuer], scopes_supported: [...SCOPES], bearer_methods_supported: ["header"],
    resource_name: "draft — résumés" };
}
export function authorizationServerMetadata({ issuer }) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    scopes_supported: [...SCOPES],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    // A96 · CIMD (services/byom/cimd.js) — Claude and OpenAI prefer it; DCR stays as the fallback.
    client_id_metadata_document_supported: true,
    revocation_endpoint_auth_methods_supported: ["none"],
    authorization_response_iss_parameter_supported: true,
  };
}

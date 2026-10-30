// ── D112 item 2 (owner 10-30) · THE GMAIL CONNECTION — beside D103's forwarding; the user picks either ──────────
//
// WHAT IS READ, AND NOTHING ELSE. Google OAuth with `gmail.readonly` ONLY. Each poll asks Gmail's own search
// (users.messages.list `q`) for messages FROM the applicant-tracking senders (services/inbox.js ATS_SENDER_DOMAINS — the
// same list the forwarding filter uses) or ABOUT the user's applications' companies (from the company's domain, or the
// company's name in the subject) — gmailQueryFor below. Nothing outside that query is ever listed or fetched, and every
// fetched message is checked against the same terms again (messageInScope) before it is kept, so a broad Gmail match
// never widens what draft stores.
//
// THE SAME PATH AS A FORWARDED MESSAGE. A kept message goes through services/inbox.js ingestForUser — the one path D103's
// forwarded copies take: text only (HTML stripped), 20k cap, the category rules, application matching, the code read the
// opted-portal worker uses. ⛔ Attachments are never fetched: a part with a filename or an attachmentId is skipped
// (extractMessage), and users.messages.attachments is never called.
//
// THE TOKEN. The refresh token is sealed with the app's secret box (services/secretBox.js) — never stored plain. Each
// poll trades it for a short-lived access token that is never stored. Disconnect revokes it at Google's revoke endpoint
// and deletes the row: intake stops at once. A token Google refuses (an app in Testing mode: test users' grants expire
// seven days after consent) marks the row `expired`, and The Table asks the user to reconnect.
//
// ⛔ D17: no model reads this mail — the same rules as the forwarded copies. Network calls go through an injectable
// client (createGoogleGmailClient) so tests never reach Google.
//
// Google facts (verified 10-30 against Google's docs — the URLs are in the lane's report and the WORKLOG):
//   authorize  https://accounts.google.com/o/oauth2/v2/auth   (access_type=offline, prompt=consent → a refresh token)
//   token      https://oauth2.googleapis.com/token
//   revoke     https://oauth2.googleapis.com/revoke            (POST token=…; 200 on success, 400 on error)
//   list       GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=…   (Gmail search-box syntax; max 500)
//   get        GET …/users/me/messages/{id}?format=full        (payload parsed; attachments are separate ids)
import { ATS_SENDER_DOMAINS, applicationCompanies, ingestForUser, isAtsSenderDomain } from "./inbox.js";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_ENDPOINTS = Object.freeze({
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
  api: "https://gmail.googleapis.com/gmail/v1/users/me",
});
export const POLL_EVERY_MS = 15 * 60 * 1000;
export const INITIAL_LOOKBACK_DAYS = 30;     // the first poll reads back this far (applications within 180 days stay matched)
export const MAX_PER_POLL = 100;             // messages listed per user per poll; the next poll continues from the watermark
const MAX_COMPANIES = 60;                    // query terms from companies — the most recent applications first
const RAW_DECODE_CAP = 200_000;              // characters decoded from one part before bodyText's 20k cap
const now = () => Math.floor(Date.now() / 1000);

/** The connect option exists only when the owner has set both variables (the inbox's `intake` pattern). */
export function gmailConfigured(env = process.env) {
  return !!(env.GOOGLE_GMAIL_CLIENT_ID && env.GOOGLE_GMAIL_CLIENT_SECRET);
}

/** The redirect URI registered on the client: `<origin>/api/gmail/callback` (D112 item 11's fixed name). */
export function gmailRedirectUri(origin, env = process.env) {
  return env.GOOGLE_GMAIL_REDIRECT_URI || `${String(origin || "").replace(/\/+$/, "")}/api/gmail/callback`;
}

/**
 * Everything draft says to Google, in one injectable object. Tests pass a fake with the same methods.
 * Each method throws an Error with `.status` and `.code` (Google's `error`, e.g. "invalid_grant") on a refusal.
 */
export function createGoogleGmailClient({ env = process.env, fetchImpl = (...a) => fetch(...a), timeoutMs = 15_000 } = {}) {
  const call = async (url, init = {}) => {
    const r = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    const text = await r.text();
    let j = null; try { j = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!r.ok) {
      const code = typeof j?.error === "string" ? j.error : j?.error?.status || `http_${r.status}`;
      throw Object.assign(new Error(`Google answered ${r.status} (${code})`), { status: r.status, code });
    }
    return j;
  };
  const form = (o) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() });
  const bearer = (t) => ({ headers: { authorization: `Bearer ${t}` } });
  return {
    authUrl({ state, redirectUri }) {
      const u = new URL(GOOGLE_ENDPOINTS.auth);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("client_id", env.GOOGLE_GMAIL_CLIENT_ID || "");
      u.searchParams.set("redirect_uri", redirectUri);
      u.searchParams.set("scope", GMAIL_SCOPE);          // ⛔ this scope only
      u.searchParams.set("state", state);
      u.searchParams.set("access_type", "offline");      // a refresh token, for the poll
      u.searchParams.set("prompt", "consent");           // a refresh token on every connect, not only the first
      return u.toString();
    },
    exchangeCode: ({ code, redirectUri }) => call(GOOGLE_ENDPOINTS.token, form({
      code, client_id: env.GOOGLE_GMAIL_CLIENT_ID || "", client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET || "",
      redirect_uri: redirectUri, grant_type: "authorization_code" })),
    refreshAccess: (refreshToken) => call(GOOGLE_ENDPOINTS.token, form({
      refresh_token: refreshToken, client_id: env.GOOGLE_GMAIL_CLIENT_ID || "", client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET || "",
      grant_type: "refresh_token" })),
    profile: (accessToken) => call(`${GOOGLE_ENDPOINTS.api}/profile`, bearer(accessToken)),
    listMessages: ({ accessToken, q, pageToken = null, maxResults = 100 }) => {
      const u = new URL(`${GOOGLE_ENDPOINTS.api}/messages`);
      u.searchParams.set("q", q);
      u.searchParams.set("maxResults", String(maxResults));
      if (pageToken) u.searchParams.set("pageToken", pageToken);
      return call(u.toString(), bearer(accessToken));
    },
    getMessage: ({ accessToken, id }) => call(`${GOOGLE_ENDPOINTS.api}/messages/${encodeURIComponent(id)}?format=full`, bearer(accessToken)),
    revoke: (token) => call(GOOGLE_ENDPOINTS.revoke, form({ token })),
  };
}

// ── what may be read ──────────────────────────────────────────────────────────────────────────

const cleanName = (s) => String(s || "").replace(/["{}()]/g, " ").replace(/\s+/g, " ").trim();
const baseDomain = (d) => String(d || "").toLowerCase().split(".").slice(-2).join(".");

/** The terms a user's mail is read by: the ATS senders, their applications' company domains and names. */
export function scopeTerms(db, userId, nowSec = now()) {
  const rows = applicationCompanies(db, userId, nowSec).sort((a, b) => (b.at || 0) - (a.at || 0));
  const domains = new Set(), names = new Set();
  for (const r of rows) {
    if (names.size >= MAX_COMPANIES) break;
    const n = cleanName(r.company);
    if (n.length >= 3) names.add(n);
    const d = String(r.domain || "").toLowerCase().replace(/^www\./, "");
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) && !isAtsSenderDomain(d)) domains.add(baseDomain(d));
  }
  return { senders: [...ATS_SENDER_DOMAINS], companyDomains: [...domains], companyNames: [...names] };
}

/**
 * The Gmail search query: `{from:<ats> … from:<company domain> … subject:"<company>" …} after:<seconds>`. Braces are
 * Gmail's OR group; `after:` in epoch seconds is exact (dates would be read as midnight Pacific).
 */
export function gmailQueryFor(db, userId, { afterSec = null, nowSec = now() } = {}) {
  const t = scopeTerms(db, userId, nowSec);
  const terms = [
    ...t.senders.map(d => `from:${d}`),
    ...t.companyDomains.map(d => `from:${d}`),
    ...t.companyNames.map(n => `subject:"${n}"`),
  ];
  return `{${terms.join(" ")}}${Number.isInteger(afterSec) && afterSec > 0 ? ` after:${afterSec}` : ""}`;
}

/** The second check, on what Gmail returned: kept only when its sender or subject is one of the terms. */
export function messageInScope({ from = "", subject = "" }, terms) {
  const m = /@([^>\s]+)>?\s*$/.exec(String(from));
  const domain = m ? m[1].toLowerCase() : "";
  if (domain && (isAtsSenderDomain(domain) || terms.senders.some(d => domain === d || domain.endsWith(`.${d}`)))) return true;
  if (domain && terms.companyDomains.includes(baseDomain(domain))) return true;
  const subj = String(subject).toLowerCase();
  return terms.companyNames.some(n => subj.includes(n.toLowerCase()));
}

// ── one message, text only ───────────────────────────────────────────────────────────────────

const decode = (data) => Buffer.from(String(data || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8").slice(0, RAW_DECODE_CAP);

/**
 * A users.messages.get (format=full) resource → { from, subject, text, html, receivedAt, attachmentsSkipped }.
 * ⛔ A part that is an attachment (a filename, or a body that is only an attachmentId) is never decoded.
 */
export function extractMessage(msg) {
  const headers = msg?.payload?.headers || [];
  const h = (name) => headers.find(x => String(x.name).toLowerCase() === name)?.value || "";
  const plain = [], html = [];
  let attachmentsSkipped = 0;
  const walk = (part, depth = 0) => {
    if (!part || depth > 12) return;
    if (part.filename || part.body?.attachmentId) { attachmentsSkipped++; return; }
    const type = String(part.mimeType || "").toLowerCase();
    if (type === "text/plain" && part.body?.data) plain.push(decode(part.body.data));
    else if (type === "text/html" && part.body?.data) html.push(decode(part.body.data));
    for (const p of part.parts || []) walk(p, depth + 1);
  };
  walk(msg?.payload);
  const ms = Number(msg?.internalDate);
  return {
    from: h("from"), subject: h("subject"),
    text: plain.length ? plain.join("\n\n") : null, html: html.length ? html.join("\n") : null,
    receivedAt: Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : null,
    attachmentsSkipped,
  };
}

// ── the connection ───────────────────────────────────────────────────────────────────────────

export function connectionRow(db, userId) {
  return db.prepare(`SELECT * FROM gmail_connections WHERE user_id = ?`).get(userId) || null;
}

/** What The Table shows: never the token. */
export function connectionStatus(db, userId, env = process.env) {
  const r = connectionRow(db, userId);
  const t = scopeTerms(db, userId);
  return {
    available: gmailConfigured(env),
    // ⚠ Until the owner publishes the app (Google's verification of a restricted scope), it is in Testing mode and
    // a test user's grant lasts seven days. GOOGLE_GMAIL_APP_PUBLISHED=1 removes the weekly-reconnect note.
    testingMode: env.GOOGLE_GMAIL_APP_PUBLISHED !== "1",
    connected: !!r && r.status === "connected",
    status: r ? r.status : "none",
    email: r?.google_email || null,
    connectedAt: r?.connected_at || null,
    lastPolledAt: r?.last_polled_at || null,
    messagesRead: r?.messages_read || 0,
    reads: { senders: t.senders, companies: t.companyNames },
  };
}

/** Store (or replace) the user's connection; the refresh token is sealed. */
export function saveConnection(db, box, userId, { refreshToken, scope = GMAIL_SCOPE, email = null }) {
  if (!refreshToken) throw Object.assign(new Error("Google sent no refresh token."), { code: "no_refresh_token" });
  const sealed = box.encrypt(String(refreshToken));
  db.prepare(`INSERT INTO gmail_connections (user_id, google_email, scope, secret_enc, iv, auth_tag, status, watermark, last_error, connected_at)
      VALUES (?, ?, ?, ?, ?, ?, 'connected', NULL, NULL, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET google_email = excluded.google_email, scope = excluded.scope, secret_enc = excluded.secret_enc,
      iv = excluded.iv, auth_tag = excluded.auth_tag, status = 'connected', last_error = NULL, connected_at = excluded.connected_at`)
    .run(userId, email, String(scope || GMAIL_SCOPE), sealed.enc, sealed.iv, sealed.tag);
}

const openToken = (box, r) => box.decrypt(r.secret_enc, r.iv, r.auth_tag);

/**
 * Disconnect: revoke at Google, then delete the row (intake stops whatever Google answered). Returns { revoked }.
 * Revoking the refresh token revokes the grant (Google: "Revocation removes all OAuth 2.0 scopes previously granted").
 */
export async function disconnect(db, { box, client, userId, log = console }) {
  const r = connectionRow(db, userId);
  if (!r) return { revoked: false, connected: false };
  let revoked = false;
  try { await client.revoke(openToken(box, r)); revoked = true; }
  catch (e) { log.warn?.(`[gmail] revoke failed (${e.code || e.message}) — the row is deleted anyway`); }
  db.prepare(`DELETE FROM gmail_connections WHERE user_id = ?`).run(userId);
  return { revoked, connected: false };
}

/**
 * One poll for one user. Reads ONLY what gmailQueryFor matches, newer than the watermark; each message the second check
 * keeps goes through ingestForUser. @returns { listed, stored, skipped, outOfScope } or { refused }
 */
export async function pollUser(db, { box, client, userId, nowSec = now(), log = console }) {
  const r = connectionRow(db, userId);
  if (!r || r.status !== "connected") return { refused: "not_connected" };
  let accessToken;
  try { accessToken = (await client.refreshAccess(openToken(box, r)))?.access_token; }
  catch (e) {
    // invalid_grant: revoked at Google, or a Testing-mode grant past its seven days. The user reconnects.
    const expired = e.code === "invalid_grant";
    db.prepare(`UPDATE gmail_connections SET status = ?, last_error = ?, last_polled_at = ? WHERE user_id = ?`)
      .run(expired ? "expired" : "connected", String(e.code || e.message).slice(0, 120), nowSec, userId);
    return { refused: expired ? "expired" : "refresh_failed" };
  }
  if (!accessToken) return { refused: "refresh_failed" };
  const afterSec = r.watermark ? r.watermark - 60 : nowSec - INITIAL_LOOKBACK_DAYS * 86400;
  const q = gmailQueryFor(db, userId, { afterSec, nowSec });
  const terms = scopeTerms(db, userId, nowSec);
  const out = { listed: 0, stored: 0, skipped: 0, outOfScope: 0 };
  let watermark = r.watermark || 0, pageToken = null;
  const seen = db.prepare(`SELECT 1 FROM inbox_messages WHERE user_id = ? AND provider_id = ?`);
  try {
    do {
      const page = await client.listMessages({ accessToken, q, pageToken, maxResults: Math.min(100, MAX_PER_POLL - out.listed) });
      for (const { id } of page?.messages || []) {
        out.listed++;
        const providerId = `gmail:${String(id).slice(0, 100)}`;
        if (seen.get(userId, providerId)) { out.skipped++; continue; }
        const m = extractMessage(await client.getMessage({ accessToken, id }));
        if (m.receivedAt) watermark = Math.max(watermark, m.receivedAt);
        if (!messageInScope(m, terms)) { out.outOfScope++; continue; }
        const res = ingestForUser(db, { userId, source: "gmail", providerId, from: m.from, subject: m.subject, text: m.text, html: m.html, receivedAt: m.receivedAt });
        if (res.stored) out.stored++; else out.skipped++;
      }
      pageToken = page?.nextPageToken || null;
    } while (pageToken && out.listed < MAX_PER_POLL);
  } catch (e) {
    db.prepare(`UPDATE gmail_connections SET last_error = ?, last_polled_at = ? WHERE user_id = ?`).run(String(e.code || e.message).slice(0, 120), nowSec, userId);
    log.warn?.(`[gmail] poll for a user failed: ${e.code || e.message}`);
    return { ...out, refused: "poll_failed" };
  }
  db.prepare(`UPDATE gmail_connections SET watermark = ?, last_polled_at = ?, last_error = NULL, messages_read = messages_read + ? WHERE user_id = ?`)
    .run(watermark || null, nowSec, out.stored, userId);
  return out;
}

/** Every connected user, one after another. Never logs a sender or a subject — counts only. */
export async function pollAll(db, { box, client, log = console }) {
  const ids = db.prepare(`SELECT user_id FROM gmail_connections WHERE status = 'connected'`).pluck().all();
  let stored = 0;
  for (const userId of ids) {
    try { stored += (await pollUser(db, { box, client, userId, log })).stored || 0; } catch (e) { log.warn?.(`[gmail] ${e.message}`); }
  }
  if (stored) log.log?.(`[gmail] stored ${stored} across ${ids.length} connection(s)`);
  return { users: ids.length, stored };
}

/** The periodic poll — only when the owner has set the client variables. */
export function startGmailPoll(db, { box, client, env = process.env, everyMs = POLL_EVERY_MS, log = console }) {
  if (!gmailConfigured(env)) return null;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await pollAll(db, { box, client, log }); } catch (e) { log.error?.(`[gmail] poll: ${e.message}`); } finally { running = false; }
  };
  const t = setInterval(tick, everyMs);
  t.unref?.();
  return t;
}

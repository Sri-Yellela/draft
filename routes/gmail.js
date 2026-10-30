// routes/gmail.js — ⭐ D112 item 2 · THE GMAIL CONNECTION'S DOORS (services/gmail.js holds the rules).
//
//   GET  /api/gmail/status       what The Table shows: offered at all (the owner's two variables), connected, what is read
//   GET  /api/gmail/connect      → Google's consent screen, gmail.readonly only (state kept in the session, 10 minutes)
//   GET  /api/gmail/callback     the registered redirect URI — exchanges the code, seals the refresh token, polls once
//   POST /api/gmail/disconnect   revokes the token at Google and deletes the connection: intake stops at once
//
// With GOOGLE_GMAIL_CLIENT_ID / GOOGLE_GMAIL_CLIENT_SECRET unset the connect door answers 404 and The Table offers
// forwarding only — the inbox's `intake` pattern.
import crypto from "node:crypto";
import {
  GMAIL_SCOPE, connectionStatus, createGoogleGmailClient, disconnect, gmailConfigured, gmailRedirectUri, pollUser, saveConnection,
} from "../services/gmail.js";

const RETURN_TO = "/app/database?sheet=inbox";
const STATE_TTL_MS = 10 * 60 * 1000;

export default function gmailRoutes(app, db, requireAuth, {
  box, env = process.env, client = createGoogleGmailClient({ env }), originFor = (req) => `${req.protocol}://${req.get("host")}`, log = console,
} = {}) {
  const back = (res, status) => res.redirect(`${RETURN_TO}&gmail=${encodeURIComponent(status)}`);

  app.get("/api/gmail/status", requireAuth, (req, res) => res.json(connectionStatus(db, req.user.id, env)));

  app.get("/api/gmail/connect", requireAuth, (req, res) => {
    if (!gmailConfigured(env)) return res.status(404).json({ error: "not_configured" });
    const state = crypto.randomBytes(32).toString("base64url");
    req.session.gmailOAuth = { state, userId: req.user.id, createdAt: Date.now() };
    res.redirect(client.authUrl({ state, redirectUri: gmailRedirectUri(originFor(req), env) }));
  });

  app.get("/api/gmail/callback", async (req, res) => {
    const stored = req.session?.gmailOAuth;
    if (req.session) delete req.session.gmailOAuth;
    if (!gmailConfigured(env)) return back(res, "not_configured");
    if (req.query?.error) return back(res, "declined");
    if (!stored || !req.query?.state || String(req.query.state) !== stored.state || Date.now() - stored.createdAt > STATE_TTL_MS) return back(res, "expired");
    // The state was made in THIS session for THIS user (a tab signed in as another account — sessions A′ — still
    // connects the account that pressed Connect). It is random and server-side, so it cannot be forged.
    const userId = stored.userId;
    if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(userId)) return back(res, "signed_out");
    if (!req.query?.code) return back(res, "error");
    try {
      const redirectUri = gmailRedirectUri(originFor(req), env);
      const tokens = await client.exchangeCode({ code: String(req.query.code), redirectUri });
      // Google's consent lets a person untick a scope: without gmail.readonly there is nothing to read.
      const granted = String(tokens?.scope || "").split(/\s+/);
      if (!granted.includes(GMAIL_SCOPE)) {
        try { if (tokens?.access_token) await client.revoke(tokens.access_token); } catch { /* nothing granted to keep */ }
        return back(res, "scope_not_granted");
      }
      if (!tokens.refresh_token) return back(res, "no_refresh_token");
      let email = null;
      try { email = (await client.profile(tokens.access_token))?.emailAddress || null; } catch { /* the address is a label only */ }
      saveConnection(db, box, userId, { refreshToken: tokens.refresh_token, scope: GMAIL_SCOPE, email });
      // The first read now, not in up to 15 minutes; its failure is recorded on the row and the next poll retries.
      pollUser(db, { box, client, userId, log }).catch(e => log.warn?.(`[gmail] first poll: ${e.message}`));
      return back(res, "connected");
    } catch (e) {
      log.warn?.(`[gmail] connect failed: ${e.code || e.message}`);
      return back(res, "error");
    }
  });

  app.post("/api/gmail/disconnect", requireAuth, async (req, res) => {
    try { res.json(await disconnect(db, { box, client, userId: req.user.id, log })); }
    catch (e) { res.status(500).json({ error: "error", message: e.message }); }
  });
}

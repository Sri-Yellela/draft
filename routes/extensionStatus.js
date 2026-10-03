import { EXTENSION_USER_AGENT } from "../shared/brand.js";

// D12 — is THIS user's browser extension connected?
//
// The extension authenticates with a token of its own (GET /api/auth/extension-token, user_agent
// EXTENSION_USER_AGENT, session-less; extension/auth.js). A live one — not revoked, not expired —
// means the user installed it and signed it in. That is what decides whether Full House shows the
// first-run "get the extension" prompt where IMPORT used to be: once it is connected the prompt
// goes away by itself, rather than nagging someone who already has it.
//
// ⚠ It says "connected", never "installed": an extension installed and never signed in has no token,
// and the page cannot see a browser's extensions.
//
// A HANDLER, registered in server.js as `app.get("/api/extension/status", requireAuth, …)` — not a
// router mounted at /api/extension. Two reasons: requireAuth must not also sit in front of server.js's
// retired /api/extension/save-job stub (it answers 410 to anyone, on purpose), and a router's "/"
// route mounted at a full path is invisible to test/authRouteGuardManifest.test.js's scanner, which
// is how this route first shipped unclassified (found in D13).
export function extensionStatusHandler(db) {
  return (req, res) => {
    const row = db.prepare(`
      SELECT MAX(last_seen_at) AS lastSeenAt, COUNT(*) AS n
      FROM auth_contexts
      WHERE user_id = ? AND user_agent = ? AND revoked_at IS NULL AND expires_at > unixepoch()
    `).get(req.user.id, EXTENSION_USER_AGENT);
    const connected = Number(row?.n || 0) > 0;
    res.json({ connected, lastSeenAt: connected ? row.lastSeenAt : null });
  };
}

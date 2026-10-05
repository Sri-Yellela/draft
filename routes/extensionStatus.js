import { EXTENSION_USER_AGENT } from "../shared/brand.js";
import { recentCaptures } from "../services/jobs/captureOutcome.js";

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
// ── D33 · THREE STATES, NOT ONE ─────────────────────────────────────────────────────────────────
// The owner had the extension installed and enabled, and the site still offered to install it: a
// surface asserting something it could have checked. The page cannot see a browser's extensions
// (no content script, no externally_connectable — pinned absent, D23), but the server can see what
// the extension has DONE on this account:
//
//   connected       a live extension token                       -> what to do with it
//   not_connected   no live token, but evidence the extension was
//                   used on this account: an extension token on
//                   record (expired or revoked), or a capture    -> connect it (open it while signed in)
//   not_installed   neither                                      -> install
//
// ⚠ "not_installed" means "no sign of it on this account" — an extension installed and never opened
// is indistinguishable from none, so that state's copy also says how to connect one that is there.
// ⚠ issueAuthContext sweeps revoked/expired rows a day after they lapse, which is why a capture
// (job_captures, origin 'capture' — only the extension sends that origin) also counts as evidence.
export function extensionStatusHandler(db) {
  return (req, res) => {
    const row = db.prepare(`
      SELECT MAX(last_seen_at) AS lastSeenAt, COUNT(*) AS n
      FROM auth_contexts
      WHERE user_id = ? AND user_agent = ? AND revoked_at IS NULL AND expires_at > unixepoch()
    `).get(req.user.id, EXTENSION_USER_AGENT);
    const connected = Number(row?.n || 0) > 0;
    let state = "connected";
    let lastCaptureAt = null;
    try {
      const c = db.prepare("SELECT MAX(created_at) AS at FROM job_captures WHERE user_id = ? AND origin = 'capture'").get(req.user.id);
      lastCaptureAt = c?.at ? c.at * 1000 : null;
    } catch { /* a database without migration 122 has no captures */ }
    if (!connected) {
      const everToken = !!db.prepare("SELECT 1 FROM auth_contexts WHERE user_id = ? AND user_agent = ? LIMIT 1")
        .get(req.user.id, EXTENSION_USER_AGENT);
      state = everToken || lastCaptureAt ? "not_connected" : "not_installed";
    }
    res.json({
      connected, state,
      lastSeenAt: connected ? row.lastSeenAt : null,
      lastCaptureAt,
      // What happened to each recent capture, in the server's own words (D33 part 3).
      recentCaptures: recentCaptures(db, req.user.id, 5),
    });
  };
}

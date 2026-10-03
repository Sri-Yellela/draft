import { Router } from "express";
import { EXTENSION_USER_AGENT } from "../shared/brand.js";

// D12 — is THIS user's browser extension connected?
//
// The extension authenticates with a token of its own (GET /api/auth/extension-token, user_agent
// 'resume-master-extension', session-less; extension/auth.js). A live one — not revoked, not expired
// — means the user installed it and signed it in. That is what decides whether Full House shows the
// first-run "get the extension" prompt where IMPORT used to be: once it is connected the prompt
// goes away by itself, rather than nagging someone who already has it.
//
// ⚠ It says "connected", never "installed": an extension installed and never signed in has no token,
// and the page cannot see a browser's extensions. Mounted behind requireAuth in server.js.
export function createExtensionStatusRouter(db) {
  const router = Router();

  // GET /api/extension/status — mounted at that exact path, so requireAuth does not also sit in front
  // of server.js's retired /api/extension/save-job stub (it answers 410 to anyone, on purpose).
  router.get("/", (req, res) => {
    const row = db.prepare(`
      SELECT MAX(last_seen_at) AS lastSeenAt, COUNT(*) AS n
      FROM auth_contexts
      WHERE user_id = ? AND user_agent = ? AND revoked_at IS NULL AND expires_at > unixepoch()
    `).get(req.user.id, EXTENSION_USER_AGENT);
    const connected = Number(row?.n || 0) > 0;
    res.json({ connected, lastSeenAt: connected ? row.lastSeenAt : null });
  });

  return router;
}

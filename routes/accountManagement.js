// ── /api/account/* — account management over HTTP ───────────────────────────────────────────────
//
// The data layer is services/accountService.js (tested on the real schema). This file is the thin
// part: who may call what, recent-sign-in gates, the session store, files on the volume, email.
//
// Sensitive actions (set a password on an OAuth account, unlink a sign-in, delete, merge) need a
// RECENT sign-in — `req.session.authAt`, stamped at every login and by POST /api/account/reauth —
// so a session left open on a shared machine cannot be used to take the account.
import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  AccountError, AVATAR_MAX_BYTES, PROVIDERS, RECENT_AUTH_MS, accountSummary, changePassword, consumeEmailCode,
  deleteAccount, exportAccount, forgetSessions, issueEmailCode, listAppTokens, listSessions, mergeAccounts,
  mergePreview, requireRecentAuth, revokeAppToken, setDisplayName, setVerifiedEmail, sidsToRevoke, sniffImage,
  unlinkProvider, validEmail,
} from "../services/accountService.js";

export const MERGE_PROOF_MS = 10 * 60 * 1000;

export function createAccountManagementRouter({
  db, requireAuth, store, dataDir, multer,
  hashPassword, verifyPassword, emailConfigured, sendVerificationCodeEmail, codePepper,
  revokeBrowserAuthContexts, clearSessionCookie, findLoginUser,
  authContextAuthAt = () => null, stampAuthContextAuthAt = () => {},
}) {
  const router = Router();
  const avatarDir = path.join(dataDir, "avatars");
  const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } });

  // Every handler answers an AccountError as { error: code, message } with its status.
  const h = (fn) => async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      if (e instanceof AccountError) return res.status(e.status).json({ error: e.code, message: e.message });
      console.error("[account]", req.method, req.path, e.message);
      res.status(500).json({ error: "server_error", message: "Something went wrong. Try again." });
    }
  };
  const destroySessions = (sids) => Promise.all(sids.map(sid => new Promise((resolve) => {
    try { revokeBrowserAuthContexts(sid); } catch {}
    store.destroy(sid, () => resolve());
  }))).then(() => forgetSessions(db, sids));
  const removeFiles = (files) => {
    for (const rel of files) {
      // Only ever inside the data dir: a stored path is ours, but check rather than trust.
      const abs = path.resolve(dataDir, rel);
      if (!abs.startsWith(path.resolve(dataDir) + path.sep)) continue;
      fs.promises.unlink(abs).catch(() => {});
    }
  };
  // ⛔ Sessions A′ (10-09): the RECENT sign-in is the ACTING identity's. A request carrying a tab token acts as
  // that token's user, and the browser's cookie may belong to another account (two tabs, two sign-ins) — so a
  // token's own sign-in time is read (auth_contexts.auth_at), never the cookie session's. A cookie-only
  // request (no tab token) is its session's user, and reads the session's stamp as before.
  // The acting identity's sign-in record — what requireRecentAuth reads, and which session is "this browser".
  const acting = (req) => {
    const info = req.authContextToken ? authContextAuthAt(req.authContextToken) : null;
    return req.authContextToken
      ? { authAt: info?.authAt ?? null, sid: info?.sid ?? null }
      : { authAt: req.session?.authAt ?? null, sid: req.sessionID ?? null };
  };
  const recentAuth = (req) => { const at = acting(req).authAt; return !!at && Date.now() - at <= RECENT_AUTH_MS; };
  const sessionUserId = (req) => req.session?.passport?.user ?? null;
  const mergeCandidate = (req) => {
    const c = req.session?.mergeCandidate;
    if (!c || c.intoId !== req.user.id || Date.now() - c.at > MERGE_PROOF_MS) return null;
    return c;
  };

  // ── the account at a glance ────────────────────────────────────────────────────────────────
  router.get("/api/account", requireAuth, h((req, res) => {
    const candidate = mergeCandidate(req);
    res.json({
      ...accountSummary(db, req.user.id),
      recentAuth: recentAuth(req),
      emailConfigured: emailConfigured(),
      mergeReady: candidate ? { via: candidate.via } : null,
    });
  }));

  /** Confirm the password to unlock sensitive actions for the next 15 minutes. */
  router.post("/api/account/reauth", requireAuth, h((req, res) => {
    const u = db.prepare("SELECT password_hash, password_set FROM users WHERE id = ?").get(req.user.id);
    if (!u?.password_set) throw new AccountError(400, "no_password", "This account has no password. Sign in again with Google instead.");
    if (!verifyPassword(String(req.body?.password || ""), u.password_hash)) throw new AccountError(403, "wrong_password", "That password is not right.");
    const now = Date.now();
    // Sessions A′: stamp the identity that re-authenticated — its tab token — and the cookie session ONLY
    // when the session is the same account. Otherwise confirming the admin's password would hand the OTHER
    // tab's account a recent sign-in it never made.
    if (req.authContextToken) stampAuthContextAuthAt(req.authContextToken, now);
    if (!req.authContextToken || sessionUserId(req) === req.user.id) req.session.authAt = now;
    res.json({ ok: true });
  }));

  router.patch("/api/account/profile", requireAuth, h((req, res) => {
    setDisplayName(db, req.user.id, req.body?.displayName);
    res.json({ ok: true, account: accountSummary(db, req.user.id) });
  }));

  // ── profile picture ────────────────────────────────────────────────────────────────────────
  router.post("/api/account/avatar", requireAuth, (req, res, next) => {
    avatarUpload.single("avatar")(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "too_large", message: "Use an image under 2 MB." });
      if (err) return next(err);
      h(async () => {
        const kind = sniffImage(req.file?.buffer);
        fs.mkdirSync(avatarDir, { recursive: true });
        // A new name each time, so a cached old picture is never served for the new one.
        const rel = path.join("avatars", `${req.user.id}-${crypto.randomBytes(6).toString("hex")}.${kind.ext}`);
        await fs.promises.writeFile(path.join(dataDir, rel), req.file.buffer);
        const old = db.prepare("SELECT avatar_path FROM users WHERE id = ?").get(req.user.id)?.avatar_path;
        db.prepare("UPDATE users SET avatar_path = ? WHERE id = ?").run(rel, req.user.id);
        if (old) removeFiles([old]);
        res.json({ ok: true, account: accountSummary(db, req.user.id) });
      })(req, res);
    });
  });

  router.get("/api/account/avatar", requireAuth, h((req, res) => {
    const rel = db.prepare("SELECT avatar_path FROM users WHERE id = ?").get(req.user.id)?.avatar_path;
    if (!rel) return res.status(404).json({ error: "no_avatar", message: "No picture." });
    const abs = path.resolve(dataDir, rel);
    if (!abs.startsWith(path.resolve(dataDir) + path.sep) || !fs.existsSync(abs)) return res.status(404).json({ error: "no_avatar", message: "No picture." });
    const buf = fs.readFileSync(abs);
    const kind = sniffImage(buf);   // served as what the bytes are, never what a name says
    res.set({ "Content-Type": kind.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400",
              "Content-Security-Policy": "default-src 'none'" });
    res.send(buf);
  }));

  router.delete("/api/account/avatar", requireAuth, h((req, res) => {
    const rel = db.prepare("SELECT avatar_path FROM users WHERE id = ?").get(req.user.id)?.avatar_path;
    db.prepare("UPDATE users SET avatar_path = NULL WHERE id = ?").run(req.user.id);
    if (rel) removeFiles([rel]);
    res.json({ ok: true, account: accountSummary(db, req.user.id) });
  }));

  // ── where you're signed in ─────────────────────────────────────────────────────────────────
  router.get("/api/account/sessions", requireAuth, h((req, res) => {
    // Rows older than the cookie's 7-day rolling life are sessions that already expired.
    db.prepare("DELETE FROM user_sessions WHERE user_id = ? AND last_seen_at < unixepoch() - 7 * 86400").run(req.user.id);
    res.json({ sessions: listSessions(db, req.user.id, acting(req).sid), apps: listAppTokens(db, req.user.id) });
  }));

  router.delete("/api/account/sessions/:id", requireAuth, h(async (req, res) => {
    const sids = sidsToRevoke(db, req.user.id, { publicId: String(req.params.id) });
    if (!sids.length) throw new AccountError(404, "not_found", "That session was not found.");
    if (sids.includes(acting(req).sid)) throw new AccountError(400, "current_session", "That is this browser — use Sign out instead.");
    await destroySessions(sids);
    res.json({ ok: true });
  }));

  router.post("/api/account/sessions/revoke-others", requireAuth, h(async (req, res) => {
    const sids = sidsToRevoke(db, req.user.id, { exceptSid: acting(req).sid });
    await destroySessions(sids);
    res.json({ ok: true, signedOut: sids.length });
  }));

  router.delete("/api/account/apps/:id", requireAuth, h((req, res) => {
    revokeAppToken(db, req.user.id, Number(req.params.id));
    res.json({ ok: true });
  }));

  // ── password ───────────────────────────────────────────────────────────────────────────────
  router.post("/api/account/password", requireAuth, h(async (req, res) => {
    changePassword(db, req.user.id, { current: req.body?.current, next: req.body?.next },
      { verify: verifyPassword, hash: hashPassword, session: acting(req) });
    // A new password signs out everywhere else — the reason to change one is usually that someone
    // else might have the old one. This browser stays signed in, freshly authenticated.
    // Sessions A′: "this browser" is the ACTING tab's session (its token's), which may not be the cookie's.
    const keep = acting(req).sid;
    await destroySessions(sidsToRevoke(db, req.user.id, { exceptSid: keep }));
    db.prepare("UPDATE auth_contexts SET revoked_at = unixepoch() WHERE user_id = ? AND revoked_at IS NULL AND (session_sid IS NULL OR session_sid != ?)")
      .run(req.user.id, keep || "");
    if (req.authContextToken) stampAuthContextAuthAt(req.authContextToken);
    if (!req.authContextToken || sessionUserId(req) === req.user.id) req.session.authAt = Date.now();
    res.json({ ok: true, account: accountSummary(db, req.user.id) });
  }));

  // ── email (a code to the NEW address proves it is yours) ───────────────────────────────────
  router.post("/api/account/email", requireAuth, h(async (req, res) => {
    if (!emailConfigured()) throw new AccountError(503, "email_unconfigured", "Email isn't set up on Draft yet, so a code can't be sent.");
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!validEmail(email)) throw new AccountError(400, "bad_email", "Enter a valid email address.");
    const recent = db.prepare("SELECT COUNT(*) n FROM email_codes WHERE user_id = ? AND created_at > unixepoch() - 3600").get(req.user.id).n;
    if (recent >= 5) throw new AccountError(429, "too_many_codes", "Too many codes in the last hour. Try again later.");
    const code = issueEmailCode(db, req.user.id, { purpose: "email", email, pepper: codePepper });
    const sent = await sendVerificationCodeEmail({ to: email, code, purpose: "confirm your new Draft email address" });
    if (!sent?.ok) throw new AccountError(503, "email_unconfigured", "The code couldn't be sent. Try again later.");
    res.json({ ok: true, sentTo: email });
  }));

  router.post("/api/account/email/confirm", requireAuth, h((req, res) => {
    const email = consumeEmailCode(db, req.user.id, { purpose: "email", code: req.body?.code, pepper: codePepper });
    setVerifiedEmail(db, req.user.id, email);
    res.json({ ok: true, account: accountSummary(db, req.user.id) });
  }));

  // ── sign-in methods (linking goes through /auth/:provider?mode=link) ───────────────────────
  router.delete("/api/account/sign-in/:provider", requireAuth, h((req, res) => {
    requireRecentAuth(acting(req));
    unlinkProvider(db, req.user.id, String(req.params.provider));
    res.json({ ok: true, account: accountSummary(db, req.user.id) });
  }));

  // ── your data ──────────────────────────────────────────────────────────────────────────────
  router.get("/api/account/export", requireAuth, h((req, res) => {
    const out = exportAccount(db, req.user.id);
    res.set("Content-Disposition", `attachment; filename="draft-account-${new Date().toISOString().slice(0, 10)}.json"`);
    res.type("application/json").send(JSON.stringify(out, null, 2));
  }));

  // ── merge another account into this one ────────────────────────────────────────────────────
  // Proving the OTHER account is yours: its password here, or its Google/LinkedIn/GitHub sign-in
  // via /auth/:provider?mode=merge (server.js), which records the same candidate without signing in.
  router.post("/api/account/merge/verify-password", requireAuth, h((req, res) => {
    const other = findLoginUser(String(req.body?.identifier || "").trim());
    const ok = other && other.password_set && verifyPassword(String(req.body?.password || ""), other.password_hash);
    if (!ok) throw new AccountError(403, "wrong_credentials", "That username or email and password don't match an account.");
    if (other.id === req.user.id) throw new AccountError(400, "same_account", "That is the account you're signed in to.");
    req.session.mergeCandidate = { fromId: other.id, intoId: req.user.id, via: "password", at: Date.now() };
    res.json({ ok: true, preview: mergePreview(db, req.user.id, other.id) });
  }));

  router.get("/api/account/merge/preview", requireAuth, h((req, res) => {
    const c = mergeCandidate(req);
    if (!c) throw new AccountError(404, "no_candidate", "Prove the other account is yours first.");
    res.json({ preview: mergePreview(db, req.user.id, c.fromId), via: c.via });
  }));

  router.delete("/api/account/merge", requireAuth, h((req, res) => {
    delete req.session.mergeCandidate;
    res.json({ ok: true });
  }));

  router.post("/api/account/merge", requireAuth, h(async (req, res) => {
    const c = mergeCandidate(req);
    if (!c) throw new AccountError(404, "no_candidate", "That confirmation expired. Prove the other account is yours again.");
    if (req.body?.confirm !== true) throw new AccountError(400, "confirm_required", "Confirm the merge.");
    const result = mergeAccounts(db, req.user.id, c.fromId);
    delete req.session.mergeCandidate;
    await destroySessions(result.sids);
    removeFiles(result.files);
    console.log(`[account] merged user ${c.fromId} into ${req.user.id} (via ${c.via})`);
    res.json({ ok: true, moved: result.moved, account: accountSummary(db, req.user.id) });
  }));

  // ── delete the account ─────────────────────────────────────────────────────────────────────
  router.post("/api/account/delete", requireAuth, h(async (req, res) => {
    requireRecentAuth(acting(req));
    const me = db.prepare("SELECT username FROM users WHERE id = ?").get(req.user.id);
    if (String(req.body?.confirm || "").trim() !== me?.username) {
      throw new AccountError(400, "confirm_required", `Type your username (${me?.username}) to confirm.`);
    }
    const currentSid = req.sessionID;
    const { files, sids } = deleteAccount(db, req.user.id);
    removeFiles(files);
    await destroySessions(sids.filter(s => s !== currentSid));
    console.log(`[account] user ${req.user.id} deleted their account`);
    // Sessions A′: deleted from a tab whose cookie belongs to ANOTHER account — that account stays signed in.
    if (req.authContextToken && sessionUserId(req) !== req.user.id) return res.json({ ok: true });
    req.logout(() => req.session?.destroy?.(() => { clearSessionCookie(res); res.json({ ok: true }); }));
  }));

  return router;
}

export { PROVIDERS };

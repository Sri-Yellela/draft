// routes/adminAuth.js — ⛔ D95 · THE ADMIN'S OWN DOOR: sign-in, sign-in links, break glass, sign-out — and
// Admin → System → Admins (owner only). Nothing here reads or writes `users`; an admin is an admin account.
//
//   /api/admin/auth/*    public (an admin is not signed in yet): me · login · link · set-password · break-glass · logout
//   /api/admin/admins/*  behind requireAdmin, owner only: list · add · disable · enable · send a sign-in link
//
// The session is the draft_admin cookie (HttpOnly, SameSite=Strict, Path=/api/admin), so no user route, consent
// screen or connector endpoint ever receives it. No password is ever shown or returned; a new admin sets their
// own from a one-time link sent to their email.
import express from "express";
import {
  ADMIN_COOKIE, ADMIN_COOKIE_PATH, ADMIN_PASSWORD_MIN, AdminAccountError, publicAdmin, listAdminAccounts, createAdminAccount,
  disableAdminAccount, enableAdminAccount, getAdminByPublicId, countAdmins, issueSignInLink, consumeSignInLink, verifyAdminSignIn,
  verifyBreakGlass, createAdminSession, revokeAdminSession,
} from "../services/adminAccounts.js";
import { adminCookieOptions, readCookie } from "../services/adminGuard.js";
import { adminActor, actorOf } from "../services/actor.js";
import { writeAudit } from "../services/userAdmin.js";

const GENERIC_FAIL = "Invalid credentials.";
const LINK_SAID = "If that is an admin account, a sign-in link is on its way. It works once, for 30 minutes.";

/** A small in-memory limiter: N tries per window per key. Enough to stop a guessing loop; it resets on deploy. */
function limiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const hits = new Map();
  return (key) => {
    const t = Date.now();
    const h = (hits.get(key) || []).filter((x) => t - x < windowMs);
    h.push(t); hits.set(key, h);
    if (hits.size > 5000) hits.clear();
    return h.length <= max;
  };
}

/**
 * @param {{ db, requireAdmin, production: boolean, sendEmail: Function, baseUrl: (req) => string, env?: object, log? }} o
 */
export function createAdminAuthRouters({ db, requireAdmin, production, sendEmail, baseUrl, env = process.env, log = console }) {
  const authRouter = express.Router();
  const adminsRouter = express.Router();
  const allow = limiter();
  const ipOf = (req) => String(req.ip || "").replace(/^::ffff:/, "");
  const ua = (req) => req.get?.("user-agent") || null;
  const cookie = adminCookieOptions({ production });

  const startSession = (req, res, admin, { breakGlass = false } = {}) => {
    const token = createAdminSession(db, admin.id, { userAgent: ua(req), breakGlass });
    res.cookie(ADMIN_COOKIE, token, cookie);
    return token;
  };
  const audit = (admin, action, extra = {}) => {
    try { writeAudit(db, { actor: adminActor(admin), action, target: `admin:${admin.public_id}`, ...extra }); }
    catch (e) { log.warn?.("[admin-auth] audit failed:", e.message); }
  };
  const sendLink = async (req, admin) => {
    const issued = issueSignInLink(db, admin.id);
    if (!issued) return { sent: false };
    const url = `${baseUrl(req).replace(/\/$/, "")}/admin/set-password?token=${encodeURIComponent(issued.token)}`;
    try {
      const r = await sendEmail({ to: admin.email, subject: "Your draft admin sign-in link",
        text: `Use this link to set your draft admin password and sign in. It works once, for 30 minutes.\n\n${url}\n\nIf you did not ask for it, ignore this email — nothing changes.`, db });
      return { sent: !!r?.ok };
    } catch (e) { log.warn?.("[admin-auth] link mail failed:", e.message); return { sent: false }; }
  };

  // ── who is signed in as an admin, and which path is open
  authRouter.get("/me", (req, res) => {
    const enforced = !!req.adminEnforced;
    res.set("Cache-Control", "no-store");
    if (req.admin) return res.json({ authenticated: true, admin: publicAdmin(req.admin), enforced, legacyAvailable: !enforced });
    res.json({ authenticated: false, enforced, legacyAvailable: !enforced, breakGlassAvailable: !!env.ADMIN_BREAK_GLASS_HASH });
  });

  authRouter.post("/login", (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!allow(`login|${ipOf(req)}|${email}`)) return res.status(429).json({ error: "Too many tries. Wait a few minutes." });
    const admin = verifyAdminSignIn(db, email, req.body?.password);
    if (!admin) return res.status(401).json({ error: GENERIC_FAIL });
    startSession(req, res, admin);
    audit(admin, "admin.sign_in");
    res.json({ ok: true, admin: publicAdmin(admin) });
  });

  // Always the same answer — whether the address is an admin account is not said here.
  authRouter.post("/link", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!allow(`link|${ipOf(req)}|${email}`)) return res.status(429).json({ error: "Too many tries. Wait a few minutes." });
    const admin = db.prepare("SELECT * FROM admin_accounts WHERE email = ? AND disabled_at IS NULL").get(email);
    if (admin) await sendLink(req, admin);
    res.json({ ok: true, said: LINK_SAID });
  });

  authRouter.post("/set-password", (req, res) => {
    try {
      const admin = consumeSignInLink(db, String(req.body?.token || ""), req.body?.password);
      if (!admin) return res.status(400).json({ error: "This link is not valid any more. Ask for a new one on the admin sign-in page." });
      startSession(req, res, admin);
      audit(admin, "admin.password_set");
      res.json({ ok: true, admin: publicAdmin(admin) });
    } catch (e) {
      if (e instanceof AdminAccountError) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  });

  // Break glass (ii): the offline passphrase. Owner accounts only; audited; the owners are told by email.
  authRouter.post("/break-glass", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!allow(`bg|${ipOf(req)}`)) return res.status(429).json({ error: "Too many tries. Wait a few minutes." });
    const admin = verifyBreakGlass(db, { email, passphrase: req.body?.passphrase, hash: env.ADMIN_BREAK_GLASS_HASH });
    if (!admin) return res.status(401).json({ error: GENERIC_FAIL });
    startSession(req, res, admin, { breakGlass: true });
    audit(admin, "admin.break_glass", { reason: "break-glass passphrase used" });
    for (const o of db.prepare("SELECT email FROM admin_accounts WHERE is_owner = 1 AND disabled_at IS NULL").all()) {
      sendEmail({ to: o.email, subject: "draft: the admin break-glass passphrase was used",
        text: `The break-glass passphrase signed ${admin.email} in to draft's admin console at ${new Date().toISOString()}.\nIf that was not you, rotate ADMIN_BREAK_GLASS_HASH and disable the session from Admin → System → Admins.`, db })
        .catch(() => {});
    }
    res.json({ ok: true, admin: publicAdmin(admin), breakGlass: true });
  });

  authRouter.post("/logout", (req, res) => {
    const token = readCookie(req, ADMIN_COOKIE);
    if (token) revokeAdminSession(db, token);
    res.clearCookie(ADMIN_COOKIE, { ...cookie, maxAge: undefined, path: ADMIN_COOKIE_PATH });
    res.json({ ok: true });
  });

  // ── Admin → System → Admins. Owner only. Bootstrap: while NO admin account exists, a legacy admin may create the
  // first one, and it is an owner — so the switch can be proved without touching the server's variables.
  const ownerOnly = (req, res, next) => {
    if (req.admin?.is_owner) return next();
    if (!req.admin && !req.adminEnforced && countAdmins(db) === 0 && req.method === "POST" && req.path === "/") { req.bootstrapOwner = true; return next(); }
    if (!req.admin && !req.adminEnforced && countAdmins(db) === 0 && req.method === "GET" && req.path === "/") return next();
    res.status(403).json({ error: "Only an owner admin account can manage admin accounts." });
  };
  const fail = (res, e) => (e instanceof AdminAccountError ? res.status(e.status).json({ error: e.message })
    : (log.error?.("[admins]", e.message), res.status(500).json({ error: "The change failed." })));

  adminsRouter.get("/", requireAdmin, ownerOnly, (req, res) => {
    res.json({ admins: listAdminAccounts(db), you: req.admin ? req.admin.public_id : null, bootstrap: !req.admin && countAdmins(db) === 0 });
  });

  adminsRouter.post("/", requireAdmin, ownerOnly, async (req, res) => {
    try {
      const by = actorOf(req);
      const isOwner = req.bootstrapOwner ? true : req.body?.owner === true;
      const created = createAdminAccount(db, { email: req.body?.email, isOwner, createdBy: by.ref });
      writeAudit(db, { actor: by, action: "admin.create", target: `admin:${created.public_id}`, after: { email: created.email, owner: !!created.is_owner } });
      const mail = await sendLink(req, created);
      res.json({ ok: true, admin: publicAdmin(created), linkSent: mail.sent });
    } catch (e) { fail(res, e); }
  });

  adminsRouter.post("/:publicId/disable", requireAdmin, ownerOnly, (req, res) => {
    try {
      const out = disableAdminAccount(db, { publicId: req.params.publicId, reason: req.body?.reason, by: actorOf(req) });
      writeAudit(db, { actor: actorOf(req), action: "admin.disable", target: `admin:${out.publicId}`, reason: req.body?.reason });
      res.json({ ok: true, admin: out });
    } catch (e) { fail(res, e); }
  });

  adminsRouter.post("/:publicId/enable", requireAdmin, ownerOnly, (req, res) => {
    try {
      const why = String(req.body?.reason ?? "").trim();
      if (why.length < 3) throw new AdminAccountError("Say why — a reason of a few words.");
      const out = enableAdminAccount(db, { publicId: req.params.publicId });
      writeAudit(db, { actor: actorOf(req), action: "admin.enable", target: `admin:${out.publicId}`, reason: why });
      res.json({ ok: true, admin: out });
    } catch (e) { fail(res, e); }
  });

  adminsRouter.post("/:publicId/link", requireAdmin, ownerOnly, async (req, res) => {
    try {
      const a = getAdminByPublicId(db, req.params.publicId);
      if (!a) throw new AdminAccountError("No such admin account.", 404);
      if (a.disabled_at) throw new AdminAccountError("That admin account is disabled.");
      const mail = await sendLink(req, a);
      writeAudit(db, { actor: actorOf(req), action: "admin.link_sent", target: `admin:${a.public_id}`, after: { sent: mail.sent } });
      res.json({ ok: true, linkSent: mail.sent });
    } catch (e) { fail(res, e); }
  });

  return { authRouter, adminsRouter, passwordMin: ADMIN_PASSWORD_MIN };
}

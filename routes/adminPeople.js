// routes/adminPeople.js — ⭐ D88 P2 + P4 · Admin → People → Users: the list, one person's page, and the utilities.
// Mounted behind requireAdmin (server.js), and every route checks it again — an admin router never trusts its mount.
// Every write takes a reason and leaves an admin_audit_log row the person's timeline shows (services/userAdmin.js).
// ⛔ No route here sets a password (D88: send a reset link, never set one) and none impersonates a user.
import express from "express";
import { listPeople, personDetail, setOverride, clearOverride, setStatus, setAccessLevel, addNote, setTag, writeAudit, UserAdminError } from "../services/userAdmin.js";
import { normalisePlanTier } from "../services/entitlements.js";
import { actorOf } from "../services/actor.js";

const PLANS = ["BASIC", "PLUS", "PRO"];

export function createAdminPeopleRouter({ db, requireAdmin, signOutEverywhere, sendResetLink }) {
  const r = express.Router();
  const id = (req) => Number.parseInt(req.params.id, 10);
  // ⛔ D95: who acted — an admin account (admin:adm_…) or, before the switch, the legacy users row — never a bare id.
  const actor = (req) => actorOf(req);
  // ⛔ D95: every write here is to a USER account. An admin row is "no such user", as it is in the list.
  const isUser = (uid) => !!db.prepare("SELECT 1 FROM users WHERE id = ? AND id != 0 AND COALESCE(is_admin, 0) = 0").get(uid);
  r.use("/:id", (req, res, next) => (isUser(id(req)) ? next() : res.status(404).json({ error: "No such user." })));
  const fail = (res, e) => (e instanceof UserAdminError
    ? res.status(e.status).json({ error: e.message })
    : (console.error("[admin-people]", e.message), res.status(500).json({ error: "The change failed." })));
  const reasonOf = (req) => String(req.body?.reason ?? "").trim();

  r.get("/", requireAdmin, (req, res) => {
    try { res.json(listPeople(db, { q: req.query.q, filter: req.query.filter, sort: req.query.sort, page: req.query.page, pageSize: req.query.pageSize,
      hideTagged: req.query.hideTagged === "1" })); }
    catch (e) { fail(res, e); }
  });

  r.get("/:id", requireAdmin, (req, res) => {
    try { res.json(personDetail(db, id(req))); } catch (e) { fail(res, e); }
  });

  r.post("/:id/overrides", requireAdmin, (req, res) => {
    const { feature, value, reason, expiresAt = null } = req.body || {};
    try { res.json(setOverride(db, { userId: id(req), featureKey: feature, value, reason, expiresAt, actorId: actor(req) })); }
    catch (e) { fail(res, e); }
  });

  r.post("/:id/overrides/:feature/clear", requireAdmin, (req, res) => {
    try { res.json(clearOverride(db, { userId: id(req), featureKey: req.params.feature, reason: reasonOf(req), actorId: actor(req) })); }
    catch (e) { fail(res, e); }
  });

  r.post("/:id/status", requireAdmin, async (req, res) => {
    try {
      const out = setStatus(db, { userId: id(req), status: req.body?.status, reason: reasonOf(req), actorId: actor(req) });
      // a suspension ends every session and token at once — the account is refused from the next request anyway
      if (out.status === "suspended") await signOutEverywhere(id(req), "admin_suspend");
      res.json(out);
    } catch (e) { fail(res, e); }
  });

  // ⛔ Owner 11-07: Full · Standard · No access (services/userAdmin.js setAccessLevel). No access signs them out at once.
  r.post("/:id/access", requireAdmin, async (req, res) => {
    try {
      const out = setAccessLevel(db, { userId: id(req), level: req.body?.level, reason: reasonOf(req), actorId: actor(req) });
      if (out.signOut) await signOutEverywhere(id(req), "admin_access_none");
      res.json(out);
    } catch (e) { fail(res, e); }
  });

  r.post("/:id/plan", requireAdmin, (req, res) => {
    const plan = String(req.body?.plan || "").toUpperCase();
    const reason = reasonOf(req);
    try {
      if (!PLANS.includes(plan)) throw new UserAdminError(`The plan is one of ${PLANS.join(", ")}.`);
      if (reason.length < 3) throw new UserAdminError("Say why — a reason of a few words is required for every change to an account.");
      const u = db.prepare("SELECT id, plan_tier, is_admin FROM users WHERE id = ?").get(id(req));
      if (!u) throw new UserAdminError("No such user.", 404);
      const before = normalisePlanTier(u.plan_tier);
      if (before === plan) throw new UserAdminError(`The plan is already ${plan}.`);
      db.transaction(() => {
        db.prepare("UPDATE users SET plan_tier = ? WHERE id = ?").run(plan, u.id);
        writeAudit(db, { actorId: actor(req), action: "user.plan", target: `user:${u.id}`, reason, before: { plan: before }, after: { plan } });
      })();
      res.json({ plan });
    } catch (e) { fail(res, e); }
  });

  r.post("/:id/tags", requireAdmin, (req, res) => {
    try { res.json(setTag(db, { userId: id(req), tag: String(req.body?.tag || ""), on: req.body?.on === true, reason: reasonOf(req), actorId: actor(req) })); }
    catch (e) { fail(res, e); }
  });

  r.post("/:id/notes", requireAdmin, (req, res) => {
    try { res.json(addNote(db, { userId: id(req), body: req.body?.body, actorId: actor(req) })); } catch (e) { fail(res, e); }
  });

  r.post("/:id/sign-out-everywhere", requireAdmin, async (req, res) => {
    try {
      const reason = reasonOf(req);
      if (reason.length < 3) throw new UserAdminError("Say why — a reason of a few words is required for every change to an account.");
      if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(id(req))) throw new UserAdminError("No such user.", 404);
      const out = await signOutEverywhere(id(req), "admin_sign_out_everywhere");
      writeAudit(db, { actorId: actor(req), action: "user.sign_out_everywhere", target: `user:${id(req)}`, reason, after: out });
      res.json(out);
    } catch (e) { fail(res, e); }
  });

  r.post("/:id/reset-link", requireAdmin, async (req, res) => {
    try {
      const reason = reasonOf(req);
      if (reason.length < 3) throw new UserAdminError("Say why — a reason of a few words is required for every change to an account.");
      const out = await sendResetLink(id(req), req);
      writeAudit(db, { actorId: actor(req), action: "user.reset_link", target: `user:${id(req)}`, reason, after: { sent: !!out.sent } });
      res.json(out);
    } catch (e) { fail(res, e); }
  });

  return r;
}

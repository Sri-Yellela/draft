// routes/network.js — ⭐ D180 P1 (45o) · CONNECTIONS, behind the network switch (OFF by default).
//
// While the switch is off every person-facing route answers 404 { error: "not_available" } — the network does not exist
// for anyone until the owner turns it on (after counsel, the owner's list D (19)). Admin can read the switch and the
// counts, and turn it on or off (audited).
//
// GET  /api/network                       my connections, requests to me, requests I sent, blocked
// GET  /api/network/suggestions           people you may know (public pages, shared workplace / school)
// GET  /api/network/relation/:handle      none · requested · incoming · connected · blocked · self
// POST /api/network/request               { handle, note? } — daily cap; a private page can't be asked
// POST /api/network/:handle/:action       accept · decline · withdraw · remove · block · unblock
// GET  /api/admin/network                 { enabled, counts }        PUT { enabled }
import { networkEnabled, NETWORK_SETTING, requestConnection, respond, removeConnection, block, unblock, myNetwork, suggestions, relation }
  from "../services/network/connections.js";
import { setSetting } from "../services/appSettings.js";
import { auditActorColumns } from "../services/actor.js";

const ACTIONS = new Set(["accept", "decline", "withdraw", "remove", "block", "unblock"]);

export default function networkRoutes(app, db, { requireAuth, requireAdmin }) {
  // The switch is an admin action, recorded like every other (admin_audit_log).
  const audit = (req, action, after) => {
    const a = auditActorColumns(req.user?.id ?? null);
    db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(a.admin_user_id, a.actor_kind, a.actor, action, NETWORK_SETTING, null, JSON.stringify(after));
  };
  const gate = (req, res, next) => (networkEnabled(db) ? next() : res.status(404).json({ error: "not_available", message: "This isn't available yet." }));
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "network_failed", message: e.message });
  const idOf = (db2, handle) => db2.prepare(`SELECT user_id FROM proof_pages WHERE handle = ?`).pluck().get(String(handle || "").toLowerCase()) ?? null;

  app.get("/api/network", requireAuth, gate, (req, res) => {
    try { res.set("Cache-Control", "private, no-store").json(myNetwork(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.get("/api/network/suggestions", requireAuth, gate, (req, res) => {
    try { res.set("Cache-Control", "private, no-store").json(suggestions(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.get("/api/network/relation/:handle", requireAuth, gate, (req, res) => {
    try {
      const other = idOf(db, req.params.handle);
      res.set("Cache-Control", "private, no-store").json({ relation: other == null ? "none" : relation(db, req.user.id, other) });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/network/request", requireAuth, gate, (req, res) => {
    try { res.json(requestConnection(db, req.user.id, req.body?.handle, { note: req.body?.note ?? null })); } catch (e) { fail(res, e); }
  });
  app.post("/api/network/:handle/:action", requireAuth, gate, (req, res) => {
    const a = req.params.action;
    if (!ACTIONS.has(a)) return res.status(404).json({ error: "no_such_action" });
    try {
      const h = req.params.handle, me = req.user.id;
      const out = a === "accept" ? respond(db, me, h, true) : a === "decline" ? respond(db, me, h, false)
        : a === "block" ? block(db, me, h) : a === "unblock" ? unblock(db, me, h) : removeConnection(db, me, h);
      res.json(out);
    } catch (e) { fail(res, e); }
  });

  app.get("/api/admin/network", requireAdmin, (_req, res) => {
    const one = (sql) => { try { return db.prepare(sql).pluck().get(); } catch { return null; } };
    res.json({ enabled: networkEnabled(db), counts: {
      connections: one(`SELECT COUNT(*) FROM network_connections WHERE status = 'accepted'`),
      pending: one(`SELECT COUNT(*) FROM network_connections WHERE status = 'pending'`),
      blocks: one(`SELECT COUNT(*) FROM network_blocks`),
    } });
  });
  app.put("/api/admin/network", requireAdmin, (req, res) => {
    const on = req.body?.enabled === true;
    setSetting(db, NETWORK_SETTING, on);
    try { audit(req, "network_switch", { enabled: on }); } catch { /* the switch is set either way */ }
    res.json({ enabled: networkEnabled(db) });
  });
}

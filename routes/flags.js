// routes/flags.js — ⭐ A187 Stage 0 (46i) · Admin → runtime flags (requireAdmin is mounted in front, server.js).
//   GET  /api/admin/flags                  every flag: what it does, its effective state, the layer that set it
//   GET  /api/admin/flags/:key             one flag + its switch history (who / when / why)
//   POST /api/admin/flags/:key             { state: off | on | cohort | inherit, percent?, reason } — applied now, no deploy
//   POST /api/admin/flags/:key/rollback    { reason } — undo the newest change still in force
import { Router } from "express";
import { FLAGS, FLAG_KEYS } from "../shared/flags.js";
import { flagState, setFlag, rollbackFlag, flagHistory, FlagError } from "../services/flags.js";
import { actorOf } from "../services/actor.js";

const view = (db, key) => ({ key, what: FLAGS[key].what, cohort: FLAGS[key].cohort, envVar: FLAGS[key].env, ...flagState(db, key) });
const fail = (res, e) => {
  if (e instanceof FlagError) return res.status(e.status || 400).json({ error: e.code, message: e.message });
  console.error("[flags]", e);
  return res.status(500).json({ error: "flags_error", message: e?.message || String(e) });
};

export function createFlagsAdminRouter(db) {
  const r = Router();
  r.get("/", (_req, res) => { try { res.json({ flags: FLAG_KEYS.map(k => view(db, k)) }); } catch (e) { fail(res, e); } });
  r.get("/:key", (req, res) => {
    try { if (!FLAGS[req.params.key]) throw new FlagError(`unknown flag "${req.params.key}"`, { code: "unknown_flag", status: 404 });
      res.json({ flag: view(db, req.params.key), history: flagHistory(db, req.params.key) }); }
    catch (e) { fail(res, e); }
  });
  r.post("/:key", (req, res) => {
    try {
      const { state, percent, reason } = req.body || {};
      setFlag(db, req.params.key, { state, percent: percent == null ? null : Number(percent), reason, actor: actorOf(req) });
      res.json({ flag: view(db, req.params.key) });
    } catch (e) { fail(res, e); }
  });
  r.post("/:key/rollback", (req, res) => {
    try { rollbackFlag(db, req.params.key, { reason: req.body?.reason, actor: actorOf(req) }); res.json({ flag: view(db, req.params.key) }); }
    catch (e) { fail(res, e); }
  });
  return r;
}

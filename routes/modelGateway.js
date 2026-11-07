// routes/modelGateway.js — ⭐ D162 G2–G4 · Admin → the model gateway (requireAdmin is mounted in front, server.js).
//   GET  /api/admin/model-gateway                    every task: where it runs, its effective route and layer, its
//                                                    candidate, whether the route is servable, its eval set
//   GET  /api/admin/model-gateway/telemetry?days=7   per task × model: calls, tokens, cost, p50 / p95, errors, fallbacks
//   GET  /api/admin/model-gateway/tasks/:task        one task: the route, the switch history (who / when / why), evals
//   POST /api/admin/model-gateway/tasks/:task/change   { op, reason, …args } — a switch, applied now, no deploy
//   POST /api/admin/model-gateway/tasks/:task/rollback { reason } — undo the newest change still in force
//   POST /api/admin/model-gateway/tasks/:task/evals    { provider, model, metrics, baseline?, reason } — record a measured
//                                                    run; the SERVER applies the pass rule
// No UI yet (D162 G4's card in Admin → System is a later screen).
import { Router } from "express";
import { TASKS, TASK_IDS, PROVIDERS } from "../shared/modelTasks.js";
import { effectiveRoute, validateRoute, applyRouteChange, rollbackRoute, routeHistory, taskTelemetry, ModelRouteError, ROUTE_OPS, STAGES } from "../services/modelGateway.js";
import { recordEval, evalHistory, EVAL_SETS } from "../services/modelEvals.js";
import { actorOf, actorRef } from "../services/actor.js";
import { usageTable, costAlarmStatus, setCostAlarmThreshold, draftKeyLabel } from "../services/modelUsage.js";

function taskView(db, id) {
  const t = TASKS[id];
  const base = { id, runsIn: t.runsIn, status: t.status, what: t.what, purposes: t.purposes, evalSet: t.evalSet, defaultRoute: t.defaultRoute ?? null };
  if (t.runsIn !== "draft") return { ...base, route: null, routedIn: t.runsIn };
  try {
    const eff = effectiveRoute(db, id);
    let valid = true, invalid = null;
    try { validateRoute(db, id, eff); } catch (e) { valid = false; invalid = e.message; }
    return { ...base, route: eff, valid, invalid };
  } catch (e) {
    return { ...base, route: null, valid: false, invalid: e.message };
  }
}

const fail = (res, e) => {
  if (e instanceof ModelRouteError) return res.status(e.status || 400).json({ error: e.code, message: e.message });
  if (/unknown model task/.test(String(e?.message))) return res.status(404).json({ error: "unknown_task", message: e.message });
  if (/^recordEval:/.test(String(e?.message))) return res.status(400).json({ error: "eval_invalid", message: e.message });
  console.error("[model-gateway]", e);
  return res.status(500).json({ error: "model_gateway_error", message: e?.message || String(e) });
};

export function createModelGatewayAdminRouter(db) {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json({ tasks: TASK_IDS.map(id => taskView(db, id)), providers: PROVIDERS, ops: ROUTE_OPS, stages: STAGES,
               evalSets: Object.fromEntries(Object.entries(EVAL_SETS).map(([k, s]) => [k, { version: s.version, minSample: s.minSample, what: s.what }])) });
  });
  router.get("/telemetry", (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    try { res.json({ days, rows: taskTelemetry(db, { sinceSec: days * 86_400 }) }); } catch (e) { fail(res, e); }
  });
  router.get("/tasks/:task", (req, res) => {
    if (!TASKS[req.params.task]) return res.status(404).json({ error: "unknown_task" });
    res.json({ ...taskView(db, req.params.task), history: routeHistory(db, req.params.task), evals: evalHistory(db, req.params.task) });
  });
  router.post("/tasks/:task/change", (req, res) => {
    const { op, reason, ...args } = req.body || {};
    try { res.json({ route: applyRouteChange(db, req.params.task, { op, reason, actor: actorOf(req), ...args }) }); } catch (e) { fail(res, e); }
  });
  router.post("/tasks/:task/rollback", (req, res) => {
    try { res.json({ route: rollbackRoute(db, req.params.task, { reason: req.body?.reason, actor: actorOf(req) }) }); } catch (e) { fail(res, e); }
  });
  router.post("/tasks/:task/evals", (req, res) => {
    const { provider, model, metrics, baseline = null, reason } = req.body || {};
    try { res.json({ record: recordEval(db, { task: req.params.task, provider, model, metrics, baseline, reason, actor: actorRef(actorOf(req)) }) }); }
    catch (e) { fail(res, e); }
  });
  // ⛔ D171 FIX 2 · where the tokens went: per hour × event × model × service × key × who started it (both services, as
  // draft recorded them), today's spend against the alarm, and this process's own key label.
  router.get("/usage", (req, res) => {
    const hours = Math.min(24 * 90, Math.max(1, Number(req.query.hours) || 48));
    try { res.json({ ...usageTable(db, { hours }), alarm: costAlarmStatus(db), draftKeyLabel: draftKeyLabel() }); } catch (e) { fail(res, e); }
  });
  router.get("/cost-alarm", (_req, res) => {
    try { res.json(costAlarmStatus(db)); } catch (e) { fail(res, e); }
  });
  router.post("/cost-alarm", (req, res) => {
    const { usd = null, reason = null } = req.body || {};
    try { setCostAlarmThreshold(db, usd, { actor: actorOf(req), reason }); res.json(costAlarmStatus(db)); }
    catch (e) { res.status(400).json({ error: "cost_alarm_invalid", message: e.message }); }
  });
  return router;
}

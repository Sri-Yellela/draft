// routes/railwayHook.js — ⛔ D76 · POST /api/hooks/railway — PUBLIC, so hostile-input code.
//
//   · Authenticated by a CUSTOM HEADER the owner sets on the Railway webhook — `Authorization: Bearer
//     <RAILWAY_WEBHOOK_TOKEN>`, compared in constant time. Anything else: 401 and NO body. No token on the
//     server: the same 401 — the hook is off, not open.
//   · The body is capped (16 KB) and parsed here, not by the global parser; a per-address rate limit.
//   · ⛔ READ-ONLY: it records one row in deploy_events and does nothing else — no field of the payload
//     drives behaviour, nothing of it is echoed back (the answer is an empty 204 whether kept or dropped,
//     so a caller learns nothing about what was accepted).
// Mounted BEFORE the global express.json in server.js, so the size cap is this route's own.
import express, { Router } from "express";
import { bearerMatches } from "../crawler/lib/signature.js";
import { parseRailwayEvent, MAX_BODY_BYTES } from "../shared/deployEvents.js";

export const RATE_PER_MINUTE = 60;

export function createRailwayHookRouter(db, { env = process.env, log = console } = {}) {
  const router = Router();
  const hits = new Map();                                    // address → [timestamps in the last minute]
  const limited = (key, now = Date.now()) => {
    const recent = (hits.get(key) || []).filter(t => now - t < 60_000);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();                      // a flood of addresses cannot grow this without bound
    return recent.length > RATE_PER_MINUTE;
  };
  const insert = db.prepare(`INSERT INTO deploy_events (event_type, family, state, severity, project_name, environment_name,
                               service_name, service_id, deployment_id, commit_hash, occurred_at)
                             VALUES (@event_type, @family, @state, @severity, @project_name, @environment_name,
                               @service_name, @service_id, @deployment_id, @commit_hash, @occurred_at)`);

  router.post("/railway",
    (req, res, next) => (bearerMatches(req.headers.authorization, env.RAILWAY_WEBHOOK_TOKEN) ? next() : res.status(401).end()),
    (req, res, next) => (limited(req.ip || "?") ? res.status(429).end() : next()),
    express.json({ limit: MAX_BODY_BYTES, type: () => true }),
    (req, res) => {
      const p = parseRailwayEvent(req.body);
      if (!p.ok) {
        // The type's NAME only (it matched a strict shape or is reported as unreadable) — never the body.
        log.warn?.(`[railway-hook] dropped: ${p.reason}${p.type ? ` (${p.type})` : ""}`);
        return res.status(204).end();
      }
      try { insert.run(p.row); } catch (e) { log.error?.("[railway-hook] could not record:", e.message); }
      res.status(204).end();
    });
  // A malformed or oversize body: the parser's own error, answered without a body either.
  router.use((err, _req, res, _next) => res.status(err?.type === "entity.too.large" ? 413 : 400).end());
  return router;
}

/** Admin: the last event per service (an alarm first), and the recent stream. */
export function deployEventsSummary(db, { limit = 50 } = {}) {
  const latest = db.prepare(`SELECT e.* FROM deploy_events e
                              JOIN (SELECT COALESCE(service_name, '?') AS s, MAX(id) AS id FROM deploy_events GROUP BY 1) m ON m.id = e.id
                              ORDER BY e.id DESC`).all();
  const recent = db.prepare("SELECT * FROM deploy_events ORDER BY id DESC LIMIT ?").all(limit);
  return { latest, recent };
}

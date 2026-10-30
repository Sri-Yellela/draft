// routes/applyWorker.js — ⭐ D100 P2 · THE APPLY WORKER'S DOORS, AND THE USER'S PORTALS (docs/APPLY_WORKER.md).
//
// Worker (mounted BEFORE the global JSON parser — a report's signature is over its exact bytes):
//   GET  /api/worker/lease    Bearer APPLY_WORKER_TOKEN → 200 { run } · 204 nothing · 423 the kill switch
//   POST /api/worker/report   HMAC-signed (crawler/lib/signature.js, the same scheme) → { ok, state }
//   POST /api/worker/release  HMAC-signed { remoteId } — a worker shutting down gives its lease back
// No APPLY_WORKER_TOKEN on the server = every worker door answers 503: the feature is off, not open.
//
// User (requireAuth):
//   GET    /api/portals                  the user's portals: status and the use log — never the ciphertext
//   POST   /api/portals/connect/start    { portalFamily } → the worker's per-session public key, signed (relayed)
//   POST   /api/portals/upload           { portalFamily, originHost, keyId, ciphertext, consent: true, expiresAt? }
//   DELETE /api/portals/:id              revoke: the worker destroys the key; the ciphertext is unreadable from then on
//   POST   /api/portals/approve/:runJobId  Ready to approve → the worker refills, verifies, submits (D100 P4)
// ⛔ D100 reverses the 410 on /api/apply/session/* (routes/apply.js) to point here — the password never passes
// through draft, and draft cannot read the session.
import express, { Router } from "express";
import { verify, bearerMatches } from "../crawler/lib/signature.js";
import {
  leaseRemoteRun, acceptReport, releaseRemoteRun, storeSession, listPortals, revokeSession, approveRemoteRun,
} from "../services/applyWorker.js";

const token = (env) => env.APPLY_WORKER_TOKEN || "";

/**
 * draft → worker, for the two things only the worker can do: mint a per-session key and destroy one.
 * `fetchImpl` is injectable for tests. Returns null when the worker is not configured.
 */
export function workerClient({ env = process.env, fetchImpl = fetch } = {}) {
  const base = String(env.APPLY_WORKER_URL || "").replace(/\/+$/, "");
  if (!base || !token(env)) return null;
  const call = async (method, p, body) => {
    const r = await fetchImpl(base + p, { method, headers: { authorization: `Bearer ${token(env)}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw Object.assign(new Error(`worker ${r.status}`), { status: 502, code: "worker_unavailable" });
    return r.status === 204 ? null : r.json();
  };
  return {
    mintKey: (portalFamily) => call("POST", "/keys", { portalFamily }),
    destroyKey: (keyId) => call("DELETE", `/keys/${encodeURIComponent(keyId)}`),
  };
}

export function createApplyWorkerRouter(db, { env = process.env, hooks = {} } = {}) {
  const router = Router();
  const signedBody = (req, res) => {
    if (!token(env)) { res.status(503).json({ error: "apply_worker_not_configured" }); return null; }
    const body = typeof req.body === "string" ? req.body : "";
    const v = verify(body, req.headers, token(env));
    if (!v.ok) { res.status(401).json({ error: v.reason }); return null; }
    try { return JSON.parse(body); } catch { res.status(400).json({ error: "invalid_json" }); return null; }
  };
  const workerId = (req) => String(req.headers["x-worker-id"] || "worker").slice(0, 64);

  router.get("/lease", (req, res) => {
    if (!token(env)) return res.status(503).json({ error: "apply_worker_not_configured" });
    if (!bearerMatches(req.headers.authorization, token(env))) return res.status(401).json({ error: "unauthorized" });
    const r = leaseRemoteRun(db, { workerId: workerId(req), env });
    if (r.paused) return res.status(423).json({ paused: true });
    if (!r.run) return res.status(204).end();
    res.json({ run: r.run });
  });
  router.post("/report", express.text({ type: "application/json", limit: "512kb" }), (req, res) => {
    const report = signedBody(req, res);
    if (!report) return;
    const out = acceptReport(db, report, { workerId: workerId(req), hooks });
    res.status(out.ok ? 200 : 409).json(out);
  });
  router.post("/release", express.text({ type: "application/json", limit: "4kb" }), (req, res) => {
    const body = signedBody(req, res);
    if (!body) return;
    res.json({ released: releaseRemoteRun(db, body.remoteId, workerId(req)) });
  });
  return router;
}

export default function portalRoutes(app, db, requireAuth, { client = null } = {}) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });

  app.get("/api/portals", requireAuth, (req, res) => res.json({ portals: listPortals(db, req.user.id) }));

  app.post("/api/portals/connect/start", requireAuth, async (req, res) => {
    const c = client ?? workerClient();
    if (!c) return res.status(503).json({ error: "apply_worker_not_configured",
      message: "The apply worker is not running yet, so a portal cannot be connected." });
    const family = String(req.body?.portalFamily || "");
    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(family)) return res.status(400).json({ error: "bad_portal" });
    // The worker signs the per-session public key with its long-term identity; the app checks that signature
    // against the PINNED identity key before sealing, so a compromised draft cannot substitute a key it holds.
    try { res.json(await c.mintKey(family)); } catch (e) { fail(res, e); }
  });

  app.post("/api/portals/upload", requireAuth, async (req, res) => {
    try {
      const out = storeSession(db, req.user.id, req.body || {});
      // A reconnect replaces the old session; its key is destroyed so the old ciphertext is unreadable too.
      const c = client ?? workerClient();
      for (const keyId of out.replacedKeyIds) { try { await c?.destroyKey(keyId); } catch {} }
      res.status(201).json({ id: out.id, portals: listPortals(db, req.user.id) });
    } catch (e) { fail(res, e); }
  });

  app.delete("/api/portals/:id", requireAuth, async (req, res) => {
    const r = revokeSession(db, req.user.id, req.params.id);
    if (!r) return res.status(404).json({ error: "not_found" });
    const c = client ?? workerClient();
    let keyDestroyed = false;
    try { if (c) { await c.destroyKey(r.keyId); keyDestroyed = true; } } catch { keyDestroyed = false; }
    // Said as it is: removed here at once, and never handed to the worker again (revoked_at). Destroying the key is
    // the worker's; when it could not be reached `keyDestroyed` is false and the user is told so.
    res.json({ removed: true, keyDestroyed, portals: listPortals(db, req.user.id) });
  });

  app.post("/api/portals/approve/:runJobId", requireAuth, (req, res) => {
    const r = approveRemoteRun(db, req.user.id, req.params.runJobId);
    if (!r) return res.status(404).json({ error: "not_ready_to_approve" });
    res.json({ approved: true, ...r });
  });
}

// routes/applyWorker.js — ⭐ D100 P2 · THE APPLY WORKER'S DOORS, AND THE USER'S PORTALS (docs/APPLY_WORKER.md).
//
// Worker (mounted BEFORE the global JSON parser — a report's signature is over its exact bytes):
//   GET  /api/worker/lease    Bearer APPLY_WORKER_TOKEN → 200 { run } · 204 nothing · 423 the kill switch
//   POST /api/worker/report   HMAC-signed (crawler/lib/signature.js, the same scheme) → { ok, state }
//   POST /api/worker/release  HMAC-signed { remoteId } — a worker shutting down gives its lease back
//   GET  /api/worker/resume/:remoteId  Bearer → the résumé PDF for a run THIS worker holds the lease on
//   POST /api/worker/account  HMAC-signed — D100 (a): the account the worker created (its sealed credential) or why not
// No APPLY_WORKER_TOKEN on the server = every worker door answers 503: the feature is off, not open.
//
// User (requireAuth):
//   GET    /api/portals                  the user's portals: status and the use log — never the ciphertext
//   POST   /api/portals/connect/start    { portalFamily } → the worker's per-session public key, signed (relayed)
//   POST   /api/portals/upload           { portalFamily, originHost, keyId, ciphertext, consent: true, expiresAt? }
//   DELETE /api/portals/:id              revoke: the worker destroys the key; the ciphertext is unreadable from then on
//   POST   /api/portals/approve/:runJobId  Ready to approve → the worker refills, verifies, submits (D100 P4)
//   POST   /api/portals/accounts     { portalFamily, originHost, consent: true } — D100 (a): draft may make an account there
//   DELETE /api/portals/accounts/:id draft stops using it and the worker destroys its key (the account stays the user's)
// ⛔ D100 reverses the 410 on /api/apply/session/* (routes/apply.js) to point here — the password never passes
// through draft, and draft cannot read the session.
import express, { Router } from "express";
import { verify, bearerMatches } from "../crawler/lib/signature.js";
import {
  leaseRemoteRun, acceptReport, releaseRemoteRun, storeSession, listPortals, revokeSession, approveRemoteRun,
  requestAccount, listAccounts, removeAccount, acceptAccount,
} from "../services/applyWorker.js";
import { codeForWorker } from "../services/inbox.js";

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

/**
 * @param deps.payloadFor(run)  → the profile payload a local run fills from (routes/apply.js workerPayload) — the
 *                               worker has no database, so the lease carries it; the SAME payload, one fill engine.
 * @param deps.resumePdf(run)   → Buffer | null, the résumé the run attaches (routes/apply.js workerResumePdf).
 */
export function createApplyWorkerRouter(db, { env = process.env, hooks = {}, payloadFor = null, resumePdf = null } = {}) {
  const router = Router();
  const signedBody = (req, res) => {
    if (!token(env)) { res.status(503).json({ error: "apply_worker_not_configured" }); return null; }
    const body = typeof req.body === "string" ? req.body : "";
    const v = verify(body, req.headers, token(env));
    if (!v.ok) { res.status(401).json({ error: v.reason }); return null; }
    try { return JSON.parse(body); } catch { res.status(400).json({ error: "invalid_json" }); return null; }
  };
  const workerId = (req) => String(req.headers["x-worker-id"] || "worker").slice(0, 64);

  const bearer = (req, res) => {
    if (!token(env)) { res.status(503).json({ error: "apply_worker_not_configured" }); return false; }
    if (!bearerMatches(req.headers.authorization, token(env))) { res.status(401).json({ error: "unauthorized" }); return false; }
    return true;
  };
  router.get("/lease", async (req, res) => {
    if (!bearer(req, res)) return;
    const r = leaseRemoteRun(db, { workerId: workerId(req), env });
    if (r.paused) return res.status(423).json({ paused: true });
    if (!r.run) return res.status(204).end();
    let autofillData = null;
    try { autofillData = payloadFor ? await payloadFor(r.run) : null; } catch { autofillData = null; }
    res.json({ run: { ...r.run, autofillData } });
  });
  router.get("/resume/:remoteId", async (req, res) => {
    if (!bearer(req, res)) return;
    const run = db.prepare(`SELECT ar.id, ar.user_id, ar.worker_id, ar.state, p.resume_artifact_id FROM apply_remote_runs ar
      LEFT JOIN apply_gate_packets p ON p.id = ar.packet_id WHERE ar.id = ?`).get(Number(req.params.remoteId));
    if (!run || run.state !== "leased" || run.worker_id !== workerId(req)) return res.status(404).json({ error: "not_leased_by_you" });
    const pdf = resumePdf && run.resume_artifact_id != null
      ? await resumePdf({ userId: run.user_id, resumeArtifactId: run.resume_artifact_id }).catch(() => null) : null;
    if (!pdf) return res.status(204).end();
    res.type("application/pdf").send(pdf);
  });
  router.post("/report", express.text({ type: "application/json", limit: "512kb" }), (req, res) => {
    const report = signedBody(req, res);
    if (!report) return;
    const out = acceptReport(db, report, { workerId: workerId(req), hooks });
    res.status(out.ok ? 200 : 409).json(out);
  });
  // ⭐ D103 P5: a verification code the portal sent for the run this worker holds — only where the user opted in for that
  // portal, only a code received since `since` and within 10 minutes, every read logged (services/inbox.js codeForWorker).
  router.get("/code/:remoteId", (req, res) => {
    if (!bearer(req, res)) return;
    const run = db.prepare(`SELECT ar.id, ar.user_id, ar.worker_id, ar.state, COALESCE(ps.portal_family, pa.portal_family) AS family,
        COALESCE(ps.origin_host, pa.origin_host) AS host
      FROM apply_remote_runs ar LEFT JOIN portal_sessions ps ON ps.id = ar.session_id LEFT JOIN portal_accounts pa ON pa.id = ar.account_id
      WHERE ar.id = ?`).get(Number(req.params.remoteId));
    if (!run || run.state !== "leased" || run.worker_id !== workerId(req) || !run.family) return res.status(404).json({ error: "not_leased_by_you" });
    const since = Number(req.query.since) || Math.floor(Date.now() / 1000) - 600;
    const r = codeForWorker(db, { userId: run.user_id, portalFamily: run.family, originHost: run.host, sinceSec: since, remoteRunId: run.id });
    if (r.refused) return res.status(403).json({ error: r.refused });
    res.json({ code: r.code });
  });
  router.post("/account", express.text({ type: "application/json", limit: "64kb" }), (req, res) => {
    const body = signedBody(req, res);
    if (!body) return;
    const out = acceptAccount(db, body, { workerId: workerId(req) });
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

  app.get("/api/portals", requireAuth, (req, res) => res.json({ portals: listPortals(db, req.user.id), accounts: listAccounts(db, req.user.id) }));

  // D100 (a), owner 10-30: draft creates portal accounts for the user. Consent per portal, said in full here and in the
  // client: your own email, a password draft's apply worker generates and keeps sealed (draft cannot read it), and the
  // portal's own "forgot password" always gives you the account.
  app.post("/api/portals/accounts", requireAuth, (req, res) => {
    try { const r = requestAccount(db, req.user.id, req.body || {}); res.status(r.existing ? 200 : 201).json({ ...r, accounts: listAccounts(db, req.user.id) }); }
    catch (e) { fail(res, e); }
  });
  app.delete("/api/portals/accounts/:id", requireAuth, async (req, res) => {
    const r = removeAccount(db, req.user.id, req.params.id);
    if (!r) return res.status(404).json({ error: "not_found" });
    const c = client ?? workerClient();
    let keyDestroyed = r.keyId == null;
    try { if (c && r.keyId) { await c.destroyKey(r.keyId); keyDestroyed = true; } } catch { keyDestroyed = false; }
    res.json({ removed: true, keyDestroyed, accounts: listAccounts(db, req.user.id) });
  });

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

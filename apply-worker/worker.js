#!/usr/bin/env node
// apply-worker/worker.js — ⭐ D100 P2 · THE APPLY WORKER (docs/APPLY_WORKER.md). A separate service in its OWN Railway
// project: it holds the session keys and NO database credentials. It LEASES one remote run from draft over the signed
// API, opens the portal with the user's sealed session (decrypted in memory, for that run only), fills with the SAME
// engine draft's runs use, and REPORTS the field list — never a screenshot. Draft decides what the report means.
//
//   APPLY_WORKER_DRAFT_URL   draft's PUBLIC origin
//   APPLY_WORKER_TOKEN       lease auth + report signing (draft has the same value) — long, random, never committed
//   APPLY_WORKER_MASTER_KEY  32 bytes, base64: wraps the key store (D100 P1 — a KMS is a later swap, lib/keys.js)
//   APPLY_WORKER_KEY_DIR     the worker's own volume for the key store
//   PORT                     /health, /identity, and the two key doors draft calls (mint, destroy)
//
// The kill switch and Stop everything are DRAFT's: a lease is refused (423) or not offered, and every run re-checks
// in draft's report handling. SIGTERM finishes nothing new and gives the lease back.
import http from "node:http";
import { pathToFileURL } from "node:url";
import { auditEnvironment } from "./lib/env.js";
import { createKeyStore } from "./lib/keys.js";
import { runLease } from "./lib/run.js";
import { sign, bearerMatches } from "../crawler/lib/signature.js";

export function createWorker({ base, token, keys, autoApply, openPage = null, fetchImpl = fetch, workerId = "worker", log = console.log }) {
  const headers = { authorization: `Bearer ${token}`, "x-worker-id": workerId };
  const post = async (p, obj) => {
    const body = JSON.stringify(obj);
    const r = await fetchImpl(base + p, { method: "POST", body, headers: { ...headers, "content-type": "application/json", ...sign(body, token) } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const fetchResume = async (remoteId) => {
    const r = await fetchImpl(`${base}/api/worker/resume/${remoteId}`, { headers });
    return r.status === 200 ? Buffer.from(await r.arrayBuffer()) : null;
  };
  return {
    /** One lease → one run → one report. Returns what happened, for the loop's log and the tests. */
    async tick() {
      const r = await fetchImpl(`${base}/api/worker/lease`, { headers });
      if (r.status === 204) return { idle: true };
      if (r.status === 423) return { paused: true };
      if (r.status !== 200) return { error: `lease ${r.status}` };
      const { run } = await r.json();
      // D100 (a): the account the worker created is reported (sealed) before the run's own report.
      const postAccount = (a) => post("/api/worker/account", a);
      const report = await runLease(run, { autoApply, keys, fetchResume, openPage, postAccount });
      const answer = await post("/api/worker/report", report);
      log(`[apply-worker] run ${run.id} → ${report.outcome}${report.reason ? ` (${report.reason})` : ""} → ${answer.body?.state ?? answer.status}`);
      return { run: run.id, report, answer };
    },
    release: (remoteId) => post("/api/worker/release", { remoteId }),
  };
}

/** draft's two calls to the worker: mint a per-session key, destroy one. Plus /identity (the key the app pins). */
export function createKeyServer({ keys, token }) {
  return http.createServer((req, res) => {
    const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(obj == null ? "" : JSON.stringify(obj)); };
    if (req.url === "/health") return send(200, { ok: true });
    if (req.url === "/identity" && req.method === "GET") return send(200, { identity: keys.identity() });
    if (!bearerMatches(req.headers.authorization, token)) return send(401, { error: "unauthorized" });
    if (req.url === "/keys" && req.method === "POST") {
      let raw = "";
      req.on("data", (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
      req.on("end", () => {
        let family; try { family = JSON.parse(raw || "{}").portalFamily; } catch { return send(400, { error: "invalid_json" }); }
        if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(String(family || ""))) return send(400, { error: "bad_portal" });
        send(200, keys.mint(family));
      });
      return;
    }
    const m = /^\/keys\/([A-Za-z0-9_-]{8,128})$/.exec(req.url || "");
    if (m && req.method === "DELETE") return send(200, { destroyed: keys.destroy(m[1]) });
    send(404, { error: "not_found" });
  });
}

async function main() {
  const env = auditEnvironment(process.env);
  if (!env.ok) {
    console.error(`[apply-worker] refusing to start: secret-like variables present (${env.unexpected.join(", ")}). The worker holds its own token and key store only — no database, no draft secrets.`);
    process.exit(2);
  }
  process.env.APPLY_NO_SCREENSHOTS = "1";
  const base = String(process.env.APPLY_WORKER_DRAFT_URL || "").replace(/\/+$/, "");
  const token = process.env.APPLY_WORKER_TOKEN || "";
  if (!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) { console.error("[apply-worker] APPLY_WORKER_DRAFT_URL must be draft's public https origin"); process.exit(2); }
  if (token.length < 32) { console.error("[apply-worker] APPLY_WORKER_TOKEN missing or shorter than 32 characters"); process.exit(2); }
  const keys = createKeyStore({ dir: process.env.APPLY_WORKER_KEY_DIR || "/data/keys", master: process.env.APPLY_WORKER_MASTER_KEY });
  const { autoApply } = await import("../services/applyAutomation.js");
  const { launchBrowser } = await import("../services/browserLauncher.js");
  // A fresh browser for a sign-in / sign-up (D100 (a)), closed after; the fill opens its own, as draft's runs do.
  const openPage = async () => {
    const browser = await launchBrowser({ headless: "new", mode: "auto" });
    const page = await browser.newPage();
    return { page, close: () => browser.close() };
  };
  const worker = createWorker({ base, token, keys, autoApply, openPage, workerId: process.env.APPLY_WORKER_ID || "apply-worker-1" });
  const port = Number(process.env.PORT || 8080);
  createKeyServer({ keys, token }).listen(port, () => console.log(`[apply-worker] up — identity ${keys.identity().slice(0, 16)}… port ${port}`));
  const poll = Math.max(10, Number(process.env.APPLY_WORKER_POLL_SECONDS || 30)) * 1000;
  let stopping = false;
  process.on("SIGTERM", () => { stopping = true; console.log("[apply-worker] stopping: no new lease"); setTimeout(() => process.exit(0), 5000).unref(); });
  while (!stopping) {
    let out;
    try { out = await worker.tick(); } catch (e) { out = { error: e.message }; console.error(`[apply-worker] tick: ${e.message}`); }
    if (!out?.run) await new Promise(r => setTimeout(r, poll));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

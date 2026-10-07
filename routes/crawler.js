// routes/crawler.js — ⛔ D75 · THE TWO DOORS THE WORKER USES, AND THE OWNER'S CONTROLS.
//
// Worker (mounted BEFORE the global JSON parser, because a result's signature is over its exact bytes):
//   GET  /api/crawler/next     Bearer CRAWLER_TOKEN → 200 { task } · 204 nothing to do · 423 paused · 429 daily cap
//   GET  /api/crawler/status   Bearer CRAWLER_TOKEN → { paused } — asked before every page
//   POST /api/crawler/result   HMAC-signed (crawler/lib/signature.js) → what the result wrote
// No CRAWLER_TOKEN on the server = every worker door answers 503: the feature is off, not open.
//
// Admin (requireAdmin):
//   GET    /api/admin/crawler                 the controls, the queue + results, the tally, the deny-list, the gauges
//   PUT    /api/admin/crawler/state           D75 STEP 0b: { paused, mode, per_run_cap, schedule_* } — no redeploy
//   POST   /api/admin/crawler/tasks           { type, urls: [...] } — queue tasks, up to the per-run cap (a denied or SSRF target is recorded refused)
//   POST   /api/admin/crawler/tasks/captures  queue J1 for the captured companies we cannot crawl, up to the cap
//   POST   /api/admin/crawler/tasks/:id/flag  { wrong, note } — a wrong answer is worse than none
//   POST   /api/admin/crawler/deny            { domain, reason } — the same-day takedown
//   DELETE /api/admin/crawler/deny/:domain
import express, { Router } from "express";
import { verify, bearerMatches } from "../crawler/lib/signature.js";
import { leaseNext, acceptResult, pausedNow, enqueueBatch, crawlerSummary, setState, captureCandidates, flagTask, TASK_TYPES } from "../services/crawlerQueue.js";

const token = (env) => env.CRAWLER_TOKEN || "";

export function createCrawlerWorkerRouter(db, { env = process.env } = {}) {
  const router = Router();
  const authed = (req, res, next) => {
    if (!token(env)) return res.status(503).json({ error: "crawler_not_configured" });
    if (!bearerMatches(req.headers.authorization, token(env))) return res.status(401).json({ error: "unauthorized" });
    next();
  };
  // Either switch — Admin → Crawler's Pause (the DB) or CRAWLER_PAUSED (the env) — and the worker idles.
  router.get("/status", authed, (_req, res) => res.json({ paused: pausedNow(db, env).paused }));
  router.get("/next", authed, (_req, res) => {
    const r = leaseNext(db, { env });
    if (r.paused) return res.status(423).json({ paused: true });
    if (r.capped) return res.status(429).json({ error: "daily_cap" });
    if (!r.task) return res.status(204).end();
    res.json({ task: r.task });
  });
  router.post("/result", express.text({ type: "application/json", limit: "128kb" }), (req, res) => {
    if (!token(env)) return res.status(503).json({ error: "crawler_not_configured" });
    const body = typeof req.body === "string" ? req.body : "";
    const v = verify(body, req.headers, token(env));
    if (!v.ok) return res.status(401).json({ error: v.reason });
    let result; try { result = JSON.parse(body); } catch { return res.status(400).json({ error: "invalid_json" }); }
    const out = acceptResult(db, result);
    if (!out.ok) return res.status(409).json(out);
    res.json(out);
  });
  return router;
}

export function createCrawlerAdminRouter(db, requireAdmin, { allowHosts, resolve } = {}) {
  const router = Router();
  router.use(requireAdmin);
  router.get("/", (_req, res) => res.json(crawlerSummary(db)));
  router.put("/state", express.json({ limit: "4kb" }), (req, res) => {
    try { res.json({ state: setState(db, req.body || {}, { by: req.user?.id ?? null }), pause: pausedNow(db) }); }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  router.post("/tasks", express.json({ limit: "64kb" }), async (req, res) => {
    const { type, urls } = req.body || {};
    if (!TASK_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of ${TASK_TYPES.join(", ")}` });
    if (!Array.isArray(urls) || !urls.length || urls.length > 100) return res.status(400).json({ error: "urls: 1–100 URLs" });
    res.json(await enqueueBatch(db, { type, urls, source: "paste", createdBy: req.user?.id ?? null, allowHosts, resolve }));
  });
  router.post("/tasks/captures", async (req, res) => {
    const picks = captureCandidates(db);
    res.json(await enqueueBatch(db, { type: "j1_find_board", urls: picks.map(p => p.baseUrl), source: "captures",
                                      createdBy: req.user?.id ?? null, allowHosts, resolve }));
  });
  router.post("/tasks/:id/flag", express.json({ limit: "4kb" }), (req, res) => {
    const ok = flagTask(db, req.params.id, { wrong: req.body?.wrong !== false, note: req.body?.note ?? null });
    res.status(ok ? 200 : 404).json({ ok });
  });
  router.post("/deny", express.json({ limit: "8kb" }), (req, res) => {
    const domain = String(req.body?.domain || "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return res.status(400).json({ error: "a bare domain, e.g. example.com" });
    db.prepare("INSERT INTO crawler_denylist (domain, reason, added_by) VALUES (?, ?, ?) ON CONFLICT(domain) DO UPDATE SET reason = excluded.reason")
      .run(domain, String(req.body?.reason || "").slice(0, 200) || null, req.user?.id ?? null);
    // Refuse anything already queued for it — the deny-list wins over every task, not only new ones.
    const refused = db.prepare(`UPDATE crawler_tasks SET status = 'refused', refused_reason = ?, finished_at = unixepoch()
                                 WHERE status IN ('queued','leased') AND (target_host = ? OR target_host LIKE ?)`)
      .run(`denied:${domain}`, domain, `%.${domain}`).changes;
    res.json({ domain, refusedQueued: refused });
  });
  router.delete("/deny/:domain", (req, res) => {
    res.json({ removed: db.prepare("DELETE FROM crawler_denylist WHERE domain = ?").run(String(req.params.domain).toLowerCase()).changes });
  });
  return router;
}

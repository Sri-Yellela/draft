// services/crawlerQueue.js — ⛔ D75 · THE CRAWLER'S QUEUE LIVES IN DRAFT (docs/CRAWLER_WORKER.md §3).
//
// The worker holds no database credentials and no user data: it leases a task here and returns a result
// here, and DRAFT decides what a result means. So draft enforces everything that must not depend on the
// worker behaving:
//   · the kill switch (CRAWLER_PAUSED=1) — no task is leased while it is on, and the worker asks before
//     every page (GET /api/crawler/status);
//   · the deny-list (crawler_denylist, owner-editable) — checked when a task is QUEUED and again when it is
//     LEASED, so a domain added after queueing is still never visited; a refused task records why;
//   · a daily ceiling on leases (CRAWLER_DAILY_TASKS, default 25 — the pilot's own scale);
//   · what a result may write: J1 evidence becomes (vendor, slug) through harvestPairOf — ONE parser — into
//     the slug-harvest POOL, for the owner's review; nothing is enabled. J2 becomes an OBSERVED pair on
//     apply_origin_pairs, never promoted (the owner promotes), and never a shared multi-tenant host (A95).
import { checkUrl, deniedBy } from "../crawler/lib/guards.js";
import { harvestPairOf, keyOf } from "./slugHarvest.js";
import { isSharedTenantHost, learnableHost } from "./learnedOrigins.js";

export const TASK_TYPES = Object.freeze(["j1_find_board", "j2_apply_hop"]);
export const LEASE_SECONDS = 600;
export const MAX_ATTEMPTS = 3;
export const DEFAULT_BUDGET = Object.freeze({ pages: 25, bytes: 5_000_000, ms: 120_000 });
const RESULT_LIMIT = 64 * 1024;

export const isPaused = (env = process.env) => String(env.CRAWLER_PAUSED || "") === "1";
export const dailyCap = (env = process.env) => Math.max(0, Number(env.CRAWLER_DAILY_TASKS ?? 25) || 0);

export function denyList(db) {
  return db.prepare("SELECT domain FROM crawler_denylist ORDER BY domain").all().map(r => r.domain);
}

function targetOf(type, input) {
  const url = type === "j1_find_board" ? input?.baseUrl : input?.postingUrl;
  let u; try { u = new URL(String(url)); } catch { return null; }
  return u;
}

/**
 * Queue a task. ⛔ A deny-listed or SSRF target is recorded as REFUSED, never queued.
 * @returns {Promise<{ id: number, status: "queued"|"refused", reason?: string }>}
 */
export async function enqueueTask(db, { type, input, createdBy = null, allowHosts = new Set(), resolve } = {}) {
  if (!TASK_TYPES.includes(type)) throw Object.assign(new Error(`type must be one of ${TASK_TYPES.join(", ")}`), { status: 400 });
  const u = targetOf(type, input);
  if (!u) throw Object.assign(new Error("the task needs an absolute http(s) URL"), { status: 400 });
  const clean = type === "j1_find_board" ? { baseUrl: `${u.origin}${u.pathname.replace(/\/+$/, "")}` } : { postingUrl: `${u.origin}${u.pathname}` };
  const denied = deniedBy(u.hostname, denyList(db));
  const ssrf = denied ? null : await checkUrl(u.href, { allowHosts, resolve });
  const reason = denied ? `denied:${denied}` : ssrf && !ssrf.ok ? `refused:${ssrf.reason}` : null;
  const id = Number(db.prepare(`INSERT INTO crawler_tasks (type, input_json, target_host, status, refused_reason, created_by, finished_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(type, JSON.stringify(clean), u.host.toLowerCase(), reason ? "refused" : "queued", reason, createdBy,
         reason ? Math.floor(Date.now() / 1000) : null).lastInsertRowid);
  return reason ? { id, status: "refused", reason } : { id, status: "queued" };
}

/**
 * Lease the next task. @returns {{ paused: true } | { capped: true } | { task: null } | { task: object }}
 */
export function leaseNext(db, { env = process.env, now = Math.floor(Date.now() / 1000) } = {}) {
  if (isPaused(env)) return { paused: true };
  // Leases in the last 24h (a lease sets lease_until = leased_at + LEASE_SECONDS).
  const today = db.prepare("SELECT COUNT(*) AS n FROM crawler_tasks WHERE lease_until IS NOT NULL AND lease_until - ? >= ? - 86400").get(LEASE_SECONDS, now).n;
  if (today >= dailyCap(env)) return { capped: true };
  const deny = denyList(db);
  return db.transaction(() => {
    for (;;) {
      const t = db.prepare(`SELECT * FROM crawler_tasks
                             WHERE (status = 'queued' OR (status = 'leased' AND lease_until < ?)) AND attempts < ?
                             ORDER BY id LIMIT 1`).get(now, MAX_ATTEMPTS);
      if (!t) return { task: null };
      const denied = deniedBy(t.target_host, deny);
      if (denied) {                                              // ⛔ the deny-list wins at lease time too
        db.prepare("UPDATE crawler_tasks SET status = 'refused', refused_reason = ?, finished_at = ? WHERE id = ?").run(`denied:${denied}`, now, t.id);
        continue;
      }
      db.prepare("UPDATE crawler_tasks SET status = 'leased', lease_until = ?, attempts = attempts + 1 WHERE id = ?").run(now + LEASE_SECONDS, t.id);
      return { task: { id: t.id, type: t.type, input: JSON.parse(t.input_json), budget: DEFAULT_BUDGET, deny } };
    }
  })();
}

/**
 * Accept a worker's (already signature-verified) result.
 * @returns {{ ok: boolean, error?: string, pairs?: object[], unsupported?: string[], observed?: object|null }}
 */
export function acceptResult(db, result, { now = Math.floor(Date.now() / 1000) } = {}) {
  const t = db.prepare("SELECT * FROM crawler_tasks WHERE id = ?").get(Number(result?.taskId));
  if (!t) return { ok: false, error: "unknown_task" };
  if (t.status !== "leased") return { ok: false, error: `task_not_leased:${t.status}` };
  if (result.type !== t.type) return { ok: false, error: "type_mismatch" };
  const stored = JSON.stringify(result);
  if (stored.length > RESULT_LIMIT) return { ok: false, error: "result_too_large" };

  const out = { ok: true, pairs: [], unsupported: [], observed: null };
  db.transaction(() => {
    if (t.type === "j1_find_board" && result.status === "found") {
      const upsert = db.prepare(`INSERT INTO slug_harvest_pool (ats_type, slug_key, ats_slug, sample_url, first_query, first_seen_at, last_seen_at, times_seen)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                                 ON CONFLICT(ats_type, slug_key) DO UPDATE SET last_seen_at = excluded.last_seen_at, times_seen = times_seen + 1`);
      const seen = new Set();
      for (const e of Array.isArray(result.evidence) ? result.evidence.slice(0, 50) : []) {
        const p = harvestPairOf(e?.url);
        if (!p) continue;
        if (p.unsupported) { if (!out.unsupported.includes(p.unsupported)) out.unsupported.push(p.unsupported); continue; }
        const k = keyOf(p.atsType, p.slug);
        if (seen.has(k)) continue;
        seen.add(k);
        upsert.run(p.atsType, String(p.slug).toLowerCase(), p.slug, String(e.url).slice(0, 500), `crawler:${t.target_host}`, now, now);
        out.pairs.push({ atsType: p.atsType, slug: p.slug, how: e.how });
      }
    }
    if (t.type === "j2_apply_hop" && result.status === "found" && result.postingOrigin && result.formOrigin) {
      const postingHost = learnableHost(result.postingOrigin), applyHost = learnableHost(result.formOrigin);
      if (postingHost && applyHost && postingHost !== applyHost) {
        if (isSharedTenantHost(postingHost) || isSharedTenantHost(applyHost)) {
          out.observed = { postingHost, applyHost, recorded: false, reason: "shared_host" };
        } else {
          db.prepare(`INSERT INTO apply_origin_pairs (posting_host, apply_host, first_seen_at, crawler_seen_at, crawler_hops_json)
                      VALUES (?, ?, ?, ?, ?)
                      ON CONFLICT(posting_host, apply_host) DO UPDATE SET crawler_seen_at = excluded.crawler_seen_at, crawler_hops_json = excluded.crawler_hops_json`)
            .run(postingHost, applyHost, now, now, JSON.stringify((result.hops || []).slice(0, 10)));
          out.observed = { postingHost, applyHost, recorded: true };
        }
      }
    }
    db.prepare("UPDATE crawler_tasks SET status = ?, result_status = ?, result_json = ?, finished_at = ? WHERE id = ?")
      .run(result.status === "error" ? "failed" : "done", String(result.status || "error"), stored, now, t.id);
  })();
  return out;
}

/** Admin: the queue, newest first, and the tally the pilot reports (found / none / blocked; none by vendor). */
export function crawlerSummary(db, { limit = 50 } = {}) {
  const tasks = db.prepare(`SELECT id, type, target_host, status, result_status, refused_reason, attempts, created_at, finished_at
                              FROM crawler_tasks ORDER BY id DESC LIMIT ?`).all(limit);
  const tally = db.prepare("SELECT type, COALESCE(result_status, status) AS outcome, COUNT(*) AS n FROM crawler_tasks GROUP BY 1, 2").all();
  return { paused: isPaused(), dailyCap: dailyCap(), tasks, tally, denyList: denyList(db) };
}

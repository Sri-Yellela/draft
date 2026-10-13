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
import { isAtsUrl } from "../crawler/lib/atsHosts.js";
import { toActor } from "./actor.js";

export const TASK_TYPES = Object.freeze(["j1_find_board", "j2_apply_hop"]);
export const LEASE_SECONDS = 600;
export const MAX_ATTEMPTS = 3;
export const DEFAULT_BUDGET = Object.freeze({ pages: 25, bytes: 5_000_000, ms: 120_000 });
const RESULT_LIMIT = 64 * 1024;

// The env var is the SECOND, independent kill switch (D75 STEP 0b); the first is Admin → Crawler's Pause, in the DB.
export const isPaused = (env = process.env) => String(env.CRAWLER_PAUSED || "") === "1";

// ── D75 STEP 0b · the controls, in draft's database (crawler_state, one row) ─────────────────────────────
export const MODES = Object.freeze(["dry", "live"]);
export function readState(db) {
  try { return db.prepare("SELECT * FROM crawler_state WHERE id = 1").get() || null; } catch { return null; }
}
/** Paused when EITHER switch is on — or when the controls cannot be read (fail closed). */
export function pausedNow(db, env = process.env) {
  if (isPaused(env)) return { paused: true, by: "env" };
  const st = readState(db);
  if (!st) return { paused: true, by: "unreadable" };
  return st.paused ? { paused: true, by: "admin" } : { paused: false, by: null };
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
/** Admin: change the controls. Only known fields, each validated. */
export function setState(db, patch = {}, { by = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const cur = readState(db);
  if (!cur) throw Object.assign(new Error("crawler_state missing — migration 144"), { status: 500 });
  const next = { ...cur };
  if ("paused" in patch) next.paused = patch.paused ? 1 : 0;
  if ("mode" in patch) { if (!MODES.includes(patch.mode)) throw bad("mode: dry | live"); next.mode = patch.mode; }
  const int = (k, lo, hi) => {
    if (!(k in patch)) return;
    const n = Number(patch[k]);
    if (!Number.isInteger(n) || n < lo || n > hi) throw bad(`${k}: ${lo}–${hi}`);
    next[k] = n;
  };
  int("per_run_cap", 1, 100); int("schedule_tasks", 1, 100);
  if ("schedule_enabled" in patch) next.schedule_enabled = patch.schedule_enabled ? 1 : 0;
  if ("schedule_hhmm" in patch) { if (!HHMM.test(String(patch.schedule_hhmm))) throw bad("schedule_hhmm: HH:MM (UTC)"); next.schedule_hhmm = patch.schedule_hhmm; }
  db.prepare(`UPDATE crawler_state SET paused = @paused, mode = @mode, per_run_cap = @per_run_cap, schedule_enabled = @schedule_enabled,
              schedule_hhmm = @schedule_hhmm, schedule_tasks = @schedule_tasks, updated_at = @now, updated_by = @by, updated_by_actor = @byActor WHERE id = 1`)
    .run({ ...next, now, by: toActor(by).userId, byActor: toActor(by).ref });
  return readState(db);
}
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
export async function enqueueTask(db, { type, input, createdBy = null, allowHosts = new Set(), resolve, source = "paste" } = {}) {
  if (!TASK_TYPES.includes(type)) throw Object.assign(new Error(`type must be one of ${TASK_TYPES.join(", ")}`), { status: 400 });
  const u = targetOf(type, input);
  if (!u) throw Object.assign(new Error("the task needs an absolute http(s) URL"), { status: 400 });
  const clean = type === "j1_find_board" ? { baseUrl: `${u.origin}${u.pathname.replace(/\/+$/, "")}` } : { postingUrl: `${u.origin}${u.pathname}` };
  const denied = deniedBy(u.hostname, denyList(db));
  const ssrf = denied ? null : await checkUrl(u.href, { allowHosts, resolve });
  const reason = denied ? `denied:${denied}` : ssrf && !ssrf.ok ? `refused:${ssrf.reason}` : null;
  const id = Number(db.prepare(`INSERT INTO crawler_tasks (type, input_json, target_host, status, refused_reason, created_by, created_by_actor, finished_at, source)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(type, JSON.stringify(clean), u.host.toLowerCase(), reason ? "refused" : "queued", reason, toActor(createdBy).userId, createdBy == null ? null : toActor(createdBy).ref,
         reason ? Math.floor(Date.now() / 1000) : null, source).lastInsertRowid);
  return reason ? { id, status: "refused", reason } : { id, status: "queued" };
}

/**
 * Lease the next task. @returns {{ paused: true } | { capped: true } | { task: null } | { task: object }}
 */
export function leaseNext(db, { env = process.env, now = Math.floor(Date.now() / 1000) } = {}) {
  if (pausedNow(db, env).paused) return { paused: true };
  const mode = readState(db)?.mode === "live" ? "live" : "dry";       // anything but an explicit "live" is dry
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
      db.prepare("UPDATE crawler_tasks SET status = 'leased', lease_until = ?, attempts = attempts + 1, mode = ? WHERE id = ?").run(now + LEASE_SECONDS, mode, t.id);
      return { task: { id: t.id, type: t.type, input: JSON.parse(t.input_json), budget: DEFAULT_BUDGET, deny, mode } };
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
  // ⛔ A task leased DRY writes nothing but its own record, whatever its result claims.
  if (t.mode !== "live" || result.dryRun === true) {
    db.prepare("UPDATE crawler_tasks SET status = 'done', result_status = 'dry_run', result_json = ?, finished_at = ? WHERE id = ?").run(stored, now, t.id);
    return { ...out, dryRun: true };
  }
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

// ── D75 STEP 0b · where tasks come from, the schedule, the flag, the gauges ──────────────────────────────

/**
 * Companies a real person cared about that we cannot crawl: captured postings whose host is NOT a known ATS
 * (a careers site of the company's own) and that no task has looked at yet. J1 starts from the site's origin.
 * (D20's sweep leftovers are not offered: the sweep stores pairs, never a company's own domain.)
 */
export function captureCandidates(db, { limit = 100 } = {}) {
  let rows = [];
  try { rows = db.prepare("SELECT url FROM job_captures ORDER BY id DESC LIMIT 2000").all(); } catch { return []; }
  const tasked = new Set(db.prepare("SELECT target_host FROM crawler_tasks").pluck().all());
  const out = [];
  for (const { url } of rows) {
    let u; try { u = new URL(url); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || isAtsUrl(u.href)) continue;
    const host = u.host.toLowerCase();
    if (tasked.has(host) || out.some(o => o.host === host)) continue;
    out.push({ host, baseUrl: u.origin });
    if (out.length >= limit) break;
  }
  return out;
}

/** Queue up to the per-run cap from a list of URLs. */
export async function enqueueBatch(db, { type, urls, source = "paste", createdBy = null, allowHosts, resolve } = {}) {
  const cap = readState(db)?.per_run_cap ?? 25;
  const take = urls.slice(0, cap), out = [];
  for (const url of take) {
    try {
      out.push({ url, ...(await enqueueTask(db, { type, input: type === "j1_find_board" ? { baseUrl: url } : { postingUrl: url },
                                                  createdBy, allowHosts, resolve, source })) });
    } catch (e) { out.push({ url, status: "invalid", reason: e.message }); }
  }
  return { tasks: out, capped: urls.length > cap ? urls.length - cap : 0, cap };
}

/** The schedule: once a day at HH:MM UTC, draft ENQUEUES up to N tasks from the candidates. It never leases. */
export async function runSchedule(db, { now = new Date(), resolve, allowHosts } = {}) {
  const st = readState(db);
  if (!st || !st.schedule_enabled) return { ran: false, reason: "off" };
  const today = now.toISOString().slice(0, 10), hhmm = now.toISOString().slice(11, 16);
  if (st.schedule_last_date === today) return { ran: false, reason: "already_today" };
  if (hhmm < st.schedule_hhmm) return { ran: false, reason: "not_yet" };
  db.prepare("UPDATE crawler_state SET schedule_last_date = ? WHERE id = 1").run(today);
  const picks = captureCandidates(db, { limit: Math.min(st.schedule_tasks, st.per_run_cap) });
  const r = await enqueueBatch(db, { type: "j1_find_board", urls: picks.map(p => p.baseUrl), source: "schedule", resolve, allowHosts });
  return { ran: true, queued: r.tasks.filter(t => t.status === "queued").length, offered: picks.length };
}

/** Admin: mark a result WRONG (a wrong answer is worse than none — the pilot's acceptance counts them). */
export function flagTask(db, id, { wrong = true, note = null } = {}) {
  return db.prepare("UPDATE crawler_tasks SET flagged_wrong = ?, flag_note = ? WHERE id = ?")
    .run(wrong ? 1 : 0, note ? String(note).slice(0, 200) : null, Number(id)).changes > 0;
}

/** Today's spend (UTC day): tasks leased, pages, minutes — the gauges. */
export function budgetToday(db, { env = process.env, now = Math.floor(Date.now() / 1000) } = {}) {
  const dayStart = now - (now % 86400);
  const leased = db.prepare("SELECT COUNT(*) FROM crawler_tasks WHERE lease_until IS NOT NULL AND lease_until - ? >= ?").pluck().get(LEASE_SECONDS, dayStart);
  let pages = 0, ms = 0;
  for (const r of db.prepare("SELECT result_json FROM crawler_tasks WHERE finished_at >= ? AND result_json IS NOT NULL").iterate(dayStart)) {
    try { const j = JSON.parse(r.result_json); pages += Number(j.spent?.pages) || 0; ms += Number(j.ms) || 0; } catch { /* a malformed row counts nothing */ }
  }
  return { tasksToday: leased, dailyCap: dailyCap(env), pagesToday: pages, minutesToday: +(ms / 60000).toFixed(1) };
}

// ── D75 STEP 1c · the worker has no domain and no healthcheck, so draft records when it last heard from it ──
export const SILENT_AFTER_SECONDS = 180;              // three missed 60 s polls
export function noteWorker(db, call, now = Math.floor(Date.now() / 1000)) {
  try { db.prepare("UPDATE crawler_state SET worker_last_seen = ?, worker_last_call = ? WHERE id = 1").run(now, String(call).slice(0, 60)); }
  catch { /* before migration 145 — never the reason a lease fails */ }
}
export function workerSeen(db, now = Math.floor(Date.now() / 1000)) {
  const st = readState(db);
  const at = st?.worker_last_seen ?? null;
  return { lastSeen: at, lastCall: st?.worker_last_call ?? null, ageSeconds: at ? now - at : null,
           silent: at == null || now - at > SILENT_AFTER_SECONDS };
}

/**
 * ⛔ D75 STEP 1c · a worker that is shutting down (SIGTERM — a redeploy) gives its lease BACK, so the task is
 * re-leased at once rather than after LEASE_SECONDS, and two workers never hold one task. Only a task that is
 * still leased can be released; the attempt is not refunded (a task that keeps dying still stops at MAX_ATTEMPTS).
 */
export function releaseTask(db, taskId) {
  return db.prepare("UPDATE crawler_tasks SET status = 'queued', lease_until = NULL, mode = NULL WHERE id = ? AND status = 'leased'")
    .run(Number(taskId)).changes > 0;
}

/** Admin: the controls, the queue (newest first, with results), the tally, the deny-list, the gauges. */
export function crawlerSummary(db, { limit = 50, env = process.env } = {}) {
  const tasks = db.prepare(`SELECT id, type, target_host, status, result_status, refused_reason, attempts, mode, source, flagged_wrong, flag_note,
                                   result_json, created_at, finished_at FROM crawler_tasks ORDER BY id DESC LIMIT ?`).all(limit)
    .map(({ result_json, ...t }) => {
      let r = null; try { r = result_json ? JSON.parse(result_json) : null; } catch { r = null; }
      return { ...t, evidence: r?.evidence?.slice(0, 5) ?? null, careersUrl: r?.careersUrl ?? null, formOrigin: r?.formOrigin ?? null,
               stoppedAt: r?.stoppedAt ?? null, error: r?.error ?? null };
    });
  const tally = db.prepare("SELECT type, COALESCE(result_status, status) AS outcome, COUNT(*) AS n FROM crawler_tasks GROUP BY 1, 2").all();
  const wrong = db.prepare("SELECT COUNT(*) FROM crawler_tasks WHERE flagged_wrong = 1").pluck().get();
  return { state: readState(db), pause: pausedNow(db, env), envPaused: isPaused(env), budget: budgetToday(db, { env }), worker: workerSeen(db),
           tasks, tally, wrongAnswers: wrong, candidates: captureCandidates(db, { limit: 25 }), denyList: denyList(db) };
}

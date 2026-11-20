// services/seo/indexNow.js — ⭐ D128 P2 (46y) · TELL SEARCH ENGINES WHEN A PUBLIC JOB PAGE IS PUBLISHED OR CHANGES (IndexNow).
//
// D128 P1 gave every open, classified posting a public page and a sitemap; nothing told a search engine when one
// appeared. IndexNow (api.indexnow.org — shared by Bing, Yandex, Seznam, Naver, Yep) takes a list of changed URLs in one
// POST, proven by a key file served at the site root (routes/indexNow.js serves /<key>.txt).
//
// ⛔ OFF UNTIL THE OWNER SETS `INDEXNOW_KEY` (8–128 of A–Z a–z 0–9 -). Unset or malformed → no key file, no timer, no
//    ping: production is unchanged. Never on staging (A188), never under `node --test`.
// ⛔ NEVER ON A REQUEST PATH: a timer (unref'd) calls tick(); its reads are two indexed lookups on public_open_jobs
//    (migration 262's small table — never scraped_jobs), and the POST is async.
// ⛔ WHAT IS SENT:
//    · PUBLISHED — a public_open_jobs row whose scraped_jobs.id is past the watermark (`lastId`, kept in app_settings).
//      The watermark starts at today's newest id the first time the switch is on: the pages already up are the
//      sitemap's job, not a flood of 80k pings.
//    · CHANGED — the crawl's content-changed path (services/jobs/aggregator.js calls noteJobPageChanged(job_id) when a
//      stored posting's content hash differs) — held in memory (≤ QUEUE_MAX), resolved at the tick to its page only if
//      that posting is still open and public. The crawl's "seen, unchanged" touch is NOT a change and is never sent
//      (it re-writes every posting's public_open_jobs row each crawl, which is why the rowid is no signal here).
// ⛔ CAPS: ≤ MAX_URLS_PER_POST (10,000 — the protocol's limit) per POST; ≤ the daily cap (INDEXNOW_DAILY_CAP, default
//    10,000) per UTC day; a posting id sent today is not sent again today (dedupe kept in the same app_settings row).
//    A failed POST advances nothing — the same pages go next tick; a 429 waits an hour.
// No model call (D190) — string handling over stored columns.
import { CANONICAL_ORIGIN } from "../../shared/brand.js";
import { isStaging } from "../stagingGuard.js";
import { jobPagePath } from "../../shared/companyPaths.js";   // = publicJobPage.jobPath, without its render imports (aggregator imports this file)
import { isBackfilled } from "../jobs/publicOpenJobs.js";

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const MAX_URLS_PER_POST = 10000;
export const DEFAULT_DAILY_CAP = 10000;
export const QUEUE_MAX = 20000;
export const STATE_KEY = "indexnow_state";
export const BACKOFF_MS_429 = 60 * 60 * 1000;
const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

/** The key, or null when unset / not a valid IndexNow key. */
export function indexNowKey(env = process.env) {
  const k = String(env.INDEXNOW_KEY || "").trim();
  return KEY_RE.test(k) ? k : null;
}

/** Everything the pinger needs, decided once from the environment. `enabled` false → do nothing at all. */
export function indexNowConfig(env = process.env) {
  const key = indexNowKey(env);
  const base = String(env.APP_BASE_URL || CANONICAL_ORIGIN).trim().replace(/\/$/, "");
  const capRaw = Number(env.INDEXNOW_DAILY_CAP);
  const dailyCap = Number.isInteger(capRaw) && capRaw > 0 ? capRaw : DEFAULT_DAILY_CAP;
  let host = null;
  try { const u = new URL(base); if (u.protocol === "https:") host = u.host; } catch { host = null; }
  const enabled = !!key && !!host && !isStaging(env) && !env.NODE_TEST_CONTEXT;
  return { key, base, host, dailyCap, enabled, keyLocation: key ? `${base}/${key}.txt` : null };
}

// ── the changed-posting queue (filled by the crawl; in memory — a restart loses at most one interval's changes) ──
let queueOn = false;
const queue = new Set();
/** The crawl's hook: a stored posting's content changed. A no-op unless the pinger is running. */
export function noteJobPageChanged(jobId) {
  if (!queueOn || jobId == null || queue.size >= QUEUE_MAX) return;
  queue.add(String(jobId));
}
export function _queueForTests({ on = null, clear = false } = {}) {
  if (on != null) queueOn = !!on;
  if (clear) queue.clear();
  return queue;
}

// ── state (one app_settings row) ──────────────────────────────────────────────────────────────────────────────────
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export function readState(db) {
  try {
    const v = db.prepare("SELECT value FROM app_settings WHERE key = ?").pluck().get(STATE_KEY);
    const s = v ? JSON.parse(v) : null;
    if (s && typeof s === "object") return { lastId: s.lastId ?? null, day: s.day || null, sent: s.sent || 0, ids: Array.isArray(s.ids) ? s.ids : [], retryAfter: s.retryAfter || 0, lastResult: s.lastResult || null };
  } catch { /* fall through */ }
  return { lastId: null, day: null, sent: 0, ids: [], retryAfter: 0, lastResult: null };
}
function writeState(db, s) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`).run(STATE_KEY, JSON.stringify(s));
}

/**
 * One pass: pick the pages to send, POST them, record what went. Safe to call often; does nothing when disabled.
 * @param {import("better-sqlite3").Database} db
 * @param {{ config?: ReturnType<typeof indexNowConfig>, fetchImpl?: typeof fetch, now?: number, log?: Console }} [o]
 */
export async function indexNowTick(db, { config = indexNowConfig(), fetchImpl = globalThis.fetch, now = Date.now(), log = console } = {}) {
  if (!config.enabled) return { state: "off" };
  if (!isBackfilled(db)) return { state: "waiting", why: "public_open_jobs backfill not done" };
  const s = readState(db);
  if (s.lastId == null) {
    let max = 0;
    try { max = db.prepare("SELECT MAX(id) FROM public_open_jobs").pluck().get() || 0; } catch { max = 0; }
    writeState(db, { ...s, lastId: max, day: utcDay(now) });
    queue.clear();
    return { state: "initialised", lastId: max };
  }
  if (s.retryAfter && now < s.retryAfter) return { state: "backoff", until: new Date(s.retryAfter).toISOString() };
  const day = utcDay(now);
  if (s.day !== day) Object.assign(s, { day, sent: 0, ids: [] });
  const room = config.dailyCap - s.sent;
  if (room <= 0) return { state: "capped", sent: s.sent };

  const seen = new Set(s.ids);
  const picked = [];   // { id, company, published }
  const take = (r, published) => { if (r && !seen.has(r.id) && picked.length < room) { seen.add(r.id); picked.push({ ...r, published }); } };
  // PUBLISHED — past the watermark, oldest first (the watermark moves only over what was sent).
  const fresh = db.prepare("SELECT id, company FROM public_open_jobs WHERE id > ? ORDER BY id LIMIT ?").all(s.lastId, room);
  for (const r of fresh) take(r, true);
  // CHANGED — still open and public now.
  const changed = [...queue];
  const one = db.prepare("SELECT id, company FROM public_open_jobs WHERE job_id = ?");
  const drained = [];
  for (const jobId of changed) {
    if (picked.length >= room) break;
    drained.push(jobId);
    take(one.get(jobId), false);
  }
  if (!picked.length) {
    for (const j of drained) queue.delete(j);
    return { state: "idle" };
  }

  let posted = 0;
  for (let i = 0; i < picked.length; i += MAX_URLS_PER_POST) {
    const chunk = picked.slice(i, i + MAX_URLS_PER_POST);
    const body = { host: config.host, key: config.key, keyLocation: config.keyLocation, urlList: chunk.map(r => `${config.base}${jobPagePath(r.company, r.id)}`) };
    let status = 0, err = null;
    try {
      const res = await fetchImpl(INDEXNOW_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
      status = res.status;
    } catch (e) { err = e; }
    if (err || status < 200 || status >= 300) {
      if (status === 429) s.retryAfter = now + BACKOFF_MS_429;
      s.lastResult = { at: new Date(now).toISOString(), status, error: err ? err.message : null, sent: posted };
      writeState(db, s);
      log.warn?.(`[indexnow] POST failed (${err ? err.message : `HTTP ${status}`}) — ${chunk.length} urls wait for the next tick`);
      return { state: "failed", status, posted };
    }
    // Recorded per chunk, so a later chunk's failure never re-sends this one.
    for (const r of chunk) { s.ids.push(r.id); if (r.published && r.id > s.lastId) s.lastId = r.id; }
    s.sent += chunk.length;
    posted += chunk.length;
    s.retryAfter = 0;
    s.lastResult = { at: new Date(now).toISOString(), status, error: null, sent: posted };
    writeState(db, s);
  }
  for (const j of drained) queue.delete(j);
  log.log?.(`[indexnow] sent ${posted} urls (${picked.filter(p => p.published).length} new, ${picked.filter(p => !p.published).length} changed); today ${s.sent} / ${config.dailyCap}`);
  return { state: "sent", posted, sentToday: s.sent };
}

/**
 * Start the timer (first pass after `firstMs`, then every `everyMs`). Returns a stop() — or null when disabled.
 * The timers are unref'd: they never hold the process open.
 */
export function startIndexNow(db, { config = indexNowConfig(), fetchImpl = globalThis.fetch, firstMs = 2 * 60 * 1000, everyMs = 15 * 60 * 1000, log = console } = {}) {
  if (!config.enabled) return null;
  queueOn = true;
  let busy = false, interval = null;
  const run = () => {
    if (busy) return;
    busy = true;
    indexNowTick(db, { config, fetchImpl, log }).catch(e => log.warn?.("[indexnow] tick failed:", e.message)).finally(() => { busy = false; });
  };
  const first = setTimeout(() => { run(); interval = setInterval(run, everyMs); interval.unref?.(); }, firstMs);
  first.unref?.();
  log.log?.(`[indexnow] on for ${config.host} (daily cap ${config.dailyCap})`);
  return () => { clearTimeout(first); if (interval) clearInterval(interval); queueOn = false; queue.clear(); };
}

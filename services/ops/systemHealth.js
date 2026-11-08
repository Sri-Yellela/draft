// services/ops/systemHealth.js — ⭐ D151 Rules 3 / 4 / 6 (45n) · SEE IT WITHOUT SHELL ACCESS TO PRODUCTION.
//
//   Rule 3 · the event loop's delay is MEASURED (perf_hooks.monitorEventLoopDelay), one sample a minute kept for an hour;
//            p99 above LOOP_P99_MS for LOOP_ALERT_MINUTES minutes in a row is an Admin alert (pipeline health).
//   Rule 6 · per-endpoint timings (the route pattern, never the URL with its ids): a bounded reservoir per route per hour,
//            read as p50 / p95 / p99 for the last hour and day; the growth alarm (active postings up > 50 % in a day, or
//            the database file up > 1 GB in a day), from one daily snapshot in app_settings; a diagnostics read the owner
//            can also hand out as a SHORT-LIVED TOKEN (24 h, scoped to this one read, only its hash stored).
//   Rule 4 · WAL checkpoints on a schedule (PASSIVE — never blocks a writer) and the WAL's size watched.
// ⛔ Everything here is in memory or one small settings row; nothing scans the board on a request (the active / closed
// counts are read at most every COUNTS_TTL_MS, for this admin page only).
import fs from "node:fs";
import crypto from "node:crypto";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { getSetting, setSetting } from "../appSettings.js";

export const HEALTH = Object.freeze({ LOOP_P99_MS: 100, LOOP_ALERT_MINUTES: 5, SAMPLES_PER_ROUTE: 400, MAX_ROUTES: 300,
  COUNTS_TTL_MS: 10 * 60 * 1000, GROWTH_ACTIVE: 0.5, GROWTH_BYTES: 1024 ** 3, TOKEN_HOURS: 24 });
const GROWTH_KEY = "d151_growth_snapshot";
const TOKEN_KEY = "d151_diag_token";

// ── Rule 3 · the loop ────────────────────────────────────────────────────────────────────────────────────────────────
const loop = { h: null, samples: [], timer: null };
export function startLoopMonitor({ intervalMs = 60_000 } = {}) {
  if (loop.h) return;
  loop.h = monitorEventLoopDelay({ resolution: 20 });
  loop.h.enable();
  loop.timer = setInterval(() => {
    const ms = (ns) => Math.round(ns / 1e6);
    loop.samples.push({ at: Math.floor(Date.now() / 1000), p50: ms(loop.h.percentile(50)), p99: ms(loop.h.percentile(99)), max: ms(loop.h.max) });
    if (loop.samples.length > 60) loop.samples.shift();
    loop.h.reset();
  }, intervalMs);
  loop.timer.unref?.();
}
/** Pure: the alert for a run of minute samples, or null. */
export function loopAlertFrom(samples, { p99 = HEALTH.LOOP_P99_MS, minutes = HEALTH.LOOP_ALERT_MINUTES } = {}) {
  const tail = samples.slice(-minutes);
  if (tail.length < minutes || !tail.every(s => s.p99 > p99)) return null;
  return { subject: `event-loop p99 over ${p99} ms for ${minutes} minutes`, detail: `p99 ${tail.map(s => s.p99).join(" · ")} ms (newest last); max ${Math.max(...tail.map(s => s.max))} ms` };
}
export const loopAlert = () => loopAlertFrom(loop.samples);
export const loopSamples = () => loop.samples.slice();

// ── Rule 6 · endpoint timings ────────────────────────────────────────────────────────────────────────────────────────
const timings = new Map();   // "GET /api/jobs" → { hour, seen, buf: [] } per hour bucket, last 24 kept
export function recordTiming(key, ms, now = Date.now()) {
  const hour = Math.floor(now / 3_600_000);
  let byHour = timings.get(key);
  if (!byHour) { if (timings.size >= HEALTH.MAX_ROUTES) return; byHour = new Map(); timings.set(key, byHour); }
  let b = byHour.get(hour);
  if (!b) { b = { seen: 0, buf: [] }; byHour.set(hour, b); for (const h of byHour.keys()) if (h < hour - 23) byHour.delete(h); }
  b.seen++;
  if (b.buf.length < HEALTH.SAMPLES_PER_ROUTE) b.buf.push(ms);
  else { const j = Math.floor(Math.random() * b.seen); if (j < HEALTH.SAMPLES_PER_ROUTE) b.buf[j] = ms; }   // reservoir
}
/** Express middleware: times every /api request by its ROUTE PATTERN (req.route.path), never the concrete URL. */
export function timingMiddleware() {
  return (req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const t0 = process.hrtime.bigint();
    res.on("finish", () => {
      const pattern = req.route?.path ? `${req.baseUrl || ""}${req.route.path}` : "(unmatched)";
      recordTiming(`${req.method} ${pattern}`, Number(process.hrtime.bigint() - t0) / 1e6);
    });
    next();
  };
}
const pct = (sorted, q) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]) : null);
export function slowestEndpoints({ hours = 1, top = 15, now = Date.now() } = {}) {
  const from = Math.floor(now / 3_600_000) - hours + 1;
  const out = [];
  for (const [key, byHour] of timings) {
    const xs = []; let calls = 0;
    for (const [h, b] of byHour) if (h >= from) { xs.push(...b.buf); calls += b.seen; }
    if (!xs.length) continue;
    xs.sort((a, b) => a - b);
    out.push({ endpoint: key, calls, p50: pct(xs, 0.5), p95: pct(xs, 0.95), p99: pct(xs, 0.99) });
  }
  return out.sort((a, b) => b.p95 - a.p95).slice(0, top);
}

// ── Rule 4 · WAL ─────────────────────────────────────────────────────────────────────────────────────────────────────
const fileSize = (p) => { try { return fs.statSync(p).size; } catch { return null; } };
export function checkpointWal(db, log = console) {
  try {
    const r = db.pragma("wal_checkpoint(PASSIVE)")?.[0] || {};
    return { busy: r.busy, log: r.log, checkpointed: r.checkpointed };
  } catch (e) { log.warn?.(`[wal] checkpoint: ${e.message}`); return null; }
}

// ── counts (cached) + growth ─────────────────────────────────────────────────────────────────────────────────────────
let counts = null;
function boardCounts(db) {
  if (counts && Date.now() - counts.at < HEALTH.COUNTS_TTL_MS) return counts.value;
  let value = null;
  try { value = db.prepare(`SELECT SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN is_active = 1 THEN 0 ELSE 1 END) AS closed FROM scraped_jobs`).get(); }
  catch { value = { active: null, closed: null }; }
  counts = { at: Date.now(), value };
  return value;
}
/** Pure: the growth alarm between two snapshots { active, bytes }, or null. */
export function growthAlarmFrom(prev, cur) {
  if (!prev || !cur) return null;
  const reasons = [];
  if (prev.active > 0 && cur.active != null && (cur.active - prev.active) / prev.active > HEALTH.GROWTH_ACTIVE) reasons.push(`active postings ${prev.active.toLocaleString("en-US")} → ${cur.active.toLocaleString("en-US")} in a day`);
  if (prev.bytes != null && cur.bytes != null && cur.bytes - prev.bytes > HEALTH.GROWTH_BYTES) reasons.push(`the database grew ${((cur.bytes - prev.bytes) / 1024 ** 3).toFixed(1)} GB in a day`);
  return reasons.length ? { subject: "the board grew fast", detail: reasons.join(" · ") } : null;
}
/** Once a day: take a snapshot; keep the previous one so the alarm compares a day apart. */
export function growthSnapshot(db, dbPath) {
  const prev = (() => { try { return JSON.parse(getSetting(db, GROWTH_KEY) || "null"); } catch { return null; } })();
  const cur = { at: Math.floor(Date.now() / 1000), active: boardCounts(db)?.active ?? null, bytes: fileSize(dbPath) };
  setSetting(db, GROWTH_KEY, JSON.stringify({ ...cur, previous: prev ? { at: prev.at, active: prev.active, bytes: prev.bytes } : null }));
  return growthAlarmFrom(prev, cur);
}
export function growthAlarm(db) {
  try { const s = JSON.parse(getSetting(db, GROWTH_KEY) || "null"); return s?.previous ? growthAlarmFrom(s.previous, s) : null; } catch { return null; }
}

// ── the diagnostics read + its short-lived token ─────────────────────────────────────────────────────────────────────
export function diagnostics(db, { dbPath, boot = null } = {}) {
  const c = boardCounts(db);
  return {
    at: new Date().toISOString(), boot,
    loop: { samples: loopSamples(), alert: loopAlert() },
    slowest: { lastHour: slowestEndpoints({ hours: 1 }), lastDay: slowestEndpoints({ hours: 24 }) },
    board: { active: c?.active ?? null, closed: c?.closed ?? null, archived: null, archiveNote: "the nightly archive (Rule 4) is not built — see the WORKLOG" },
    database: { bytes: fileSize(dbPath), walBytes: fileSize(`${dbPath}-wal`) },
    crawler: (() => { try { return db.prepare(`SELECT run_kind, source, status, started_at, finished_at FROM pipeline_runs ORDER BY id DESC LIMIT 5`).all(); } catch { return null; } })(),
    growth: growthAlarm(db),
  };
}
const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
export function issueDiagToken(db, { by = null } = {}) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expires = Math.floor(Date.now() / 1000) + HEALTH.TOKEN_HOURS * 3600;
  setSetting(db, TOKEN_KEY, JSON.stringify({ hash: hash(token), expires, by }));
  return { token, expires };
}
export function diagTokenValid(db, token) {
  if (!token || typeof token !== "string") return false;
  try {
    const s = JSON.parse(getSetting(db, TOKEN_KEY) || "null");
    if (!s || s.expires < Math.floor(Date.now() / 1000)) return false;
    const a = Buffer.from(hash(token)), b = Buffer.from(s.hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

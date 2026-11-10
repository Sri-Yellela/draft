// services/hirebase/client.js — ⭐ HB-1 (D187 HB-INFRA). THE ONE PLACE draft talks to Hirebase.
//
// Facts: docs/research/hirebase-api.md (read 11-10). The rules this file holds:
//   · OFF by default — HIREBASE_ENABLED must be "1" / "on" / "true" for anything to be sent; and DRY-RUN by default —
//     HIREBASE_DRY_RUN must be "0" / "off" / "false" to send. A dry run logs the exact request and its worst-case cost and
//     returns { dryRun: true } — nothing leaves the machine.
//   · Every request goes through the spend guard (spendGuard.js checkSpend) with its worst case: a search costs up to its
//     `limit` (1 unit per job returned, max 100); the estimate and the expired feed cost 0.
//   · 100 requests / 60 s per key: a sliding window waits before it would cross it.
//   · 429 is TWO things (their errors page): `Retry-After` = the rate limit → wait and retry (≤ 3 times);
//     `X-Billing-Code: limit_exceeded` = the quota → STOP: recorded, thrown as HirebaseQuotaError, never retried.
//   · Every response's Hirebase-Usage-* headers are recorded (hirebase_usage) — the guard's totals come from them.
//   · `fetchImpl` is injected; tests pass a fake. No test ever reaches the network (d171's rule; hbNoLiveCallInTests).
import { checkSpend, JOBS_METER } from "./spendGuard.js";

export const HIREBASE_BASE = "https://api.hirebase.org";
export const RATE_LIMIT = Object.freeze({ requests: 100, windowMs: 60_000 });
const on = (v) => /^(1|on|true|yes)$/i.test(String(v ?? "").trim());
const off = (v) => /^(0|off|false|no)$/i.test(String(v ?? "").trim());

export class HirebaseError extends Error {
  constructor(message, { code = "hirebase_error", status = null, detail = null } = {}) { super(message); this.name = "HirebaseError"; this.code = code; this.status = status; this.detail = detail; }
}
export class HirebaseQuotaError extends HirebaseError {
  constructor(message, opts = {}) { super(message, { ...opts, code: "quota_exceeded" }); this.name = "HirebaseQuotaError"; }
}
export class HirebaseRefusedError extends HirebaseError {
  constructor(message, opts = {}) { super(message, { ...opts, code: opts.code || "refused" }); this.name = "HirebaseRefusedError"; }
}

export function hirebaseConfig(env = process.env) {
  return {
    key: String(env.HIREBASE_KEY || env.HIREBASE_API_KEY || "").trim() || null,
    enabled: on(env.HIREBASE_ENABLED),
    dryRun: !off(env.HIREBASE_DRY_RUN),
  };
}

const USAGE_HEADERS = Object.freeze({
  meter: "hirebase-usage-meter", includedLimit: "hirebase-usage-included-limit", includedUsed: "hirebase-usage-included-used",
  includedRemaining: "hirebase-usage-included-remaining", overageUsed: "hirebase-usage-overage-used",
  periodStart: "hirebase-usage-period-start", periodEnd: "hirebase-usage-period-end", overageMode: "hirebase-usage-overage-mode",
});
/** The usage headers of one response, or null when the endpoint is un-metered. `headers` = a fetch Headers or a plain object. */
export function readUsageHeaders(headers) {
  const get = (k) => (typeof headers?.get === "function" ? headers.get(k) : headers?.[k] ?? headers?.[k.toLowerCase()]) ?? null;
  const meter = get(USAGE_HEADERS.meter);
  if (!meter) return null;
  const num = (k) => { const v = get(k); const n = Number(v); return v == null || v === "" || !Number.isFinite(n) ? null : n; };
  return { meter, includedLimit: num(USAGE_HEADERS.includedLimit), includedUsed: num(USAGE_HEADERS.includedUsed),
    includedRemaining: num(USAGE_HEADERS.includedRemaining), overageUsed: num(USAGE_HEADERS.overageUsed),
    overageMode: get(USAGE_HEADERS.overageMode), periodStart: get(USAGE_HEADERS.periodStart), periodEnd: get(USAGE_HEADERS.periodEnd) };
}

/** Write one response's usage: the units it returned today, and Hirebase's own period totals. */
export function recordUsage(db, usage, units, { nowMs = Date.now() } = {}) {
  if (!db) return;
  const meter = usage?.meter || JOBS_METER;
  const day = new Date(nowMs).toISOString().slice(0, 10);
  try {
    db.prepare(`INSERT INTO hirebase_usage (day, meter, units, included_limit, included_used, included_remaining, overage_used, period_start, period_end, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(day, meter) DO UPDATE SET units = units + excluded.units,
        included_limit = COALESCE(excluded.included_limit, included_limit), included_used = COALESCE(excluded.included_used, included_used),
        included_remaining = COALESCE(excluded.included_remaining, included_remaining), overage_used = COALESCE(excluded.overage_used, overage_used),
        period_start = COALESCE(excluded.period_start, period_start), period_end = COALESCE(excluded.period_end, period_end), updated_at = excluded.updated_at`)
      .run(day, meter, Math.max(0, Number(units) || 0), usage?.includedLimit ?? null, usage?.includedUsed ?? null, usage?.includedRemaining ?? null,
        usage?.overageUsed ?? null, usage?.periodStart ?? null, usage?.periodEnd ?? null, Math.floor(nowMs / 1000));
  } catch (e) { console.warn(`[hirebase] usage not recorded: ${e.message}`); }
}

/** A sliding-window limiter: resolves when one more request fits in RATE_LIMIT. */
export function createRateLimiter({ requests = RATE_LIMIT.requests, windowMs = RATE_LIMIT.windowMs, now = () => Date.now(), sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  const sent = [];
  return {
    async take() {
      for (;;) {
        const t = now();
        while (sent.length && t - sent[0] >= windowMs) sent.shift();
        if (sent.length < requests) { sent.push(t); return; }
        await sleep(windowMs - (t - sent[0]) + 1);
      }
    },
    inWindow: () => { const t = now(); return sent.filter(s => t - s < windowMs).length; },
  };
}

/**
 * @param deps { db, fetchImpl, env?, limiter?, sleep?, log? }
 * @returns { config, search(body), estimate(body), expired({ since, page, limit }) }
 */
export function createHirebaseClient({ db, fetchImpl = null, env = process.env, limiter = null, sleep = (ms) => new Promise(r => setTimeout(r, ms)), log = console } = {}) {
  const config = hirebaseConfig(env);
  const rate = limiter || createRateLimiter({ sleep });

  async function send({ method, path, body = null, query = null, maxUnits }) {
    const url = `${HIREBASE_BASE}${path}${query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))}` : ""}`;
    const guard = checkSpend(db, maxUnits);
    if (!guard.ok) throw new HirebaseRefusedError(`refused before sending: ${guard.reason} (up to ${maxUnits} units; used ${guard.used?.month ?? "?"} / ${guard.caps?.month ?? "?"} this month, ${guard.used?.day ?? "?"} / ${guard.caps?.day ?? "?"} today)`, { code: guard.reason });
    if (!config.enabled || config.dryRun) {
      log?.log?.(`[hirebase] ${config.enabled ? "DRY RUN" : "OFF"} — would send ${method} ${url}${body ? ` ${JSON.stringify(body)}` : ""} (worst case ${maxUnits} units)`);
      return { dryRun: true, enabled: config.enabled, request: { method, url, body }, maxUnits };
    }
    if (!config.key) throw new HirebaseRefusedError("no HIREBASE_KEY", { code: "no_key" });
    if (typeof fetchImpl !== "function") throw new HirebaseRefusedError("no fetch implementation", { code: "no_fetch" });
    for (let attempt = 0; ; attempt++) {
      await rate.take();
      const res = await fetchImpl(url, { method, headers: { "x-api-key": config.key, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const usage = readUsageHeaders(res.headers);
      const header = (k) => (typeof res.headers?.get === "function" ? res.headers.get(k) : res.headers?.[k]) ?? null;
      const text = await res.text();
      let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      if (res.status === 429) {
        if (/^limit_exceeded$/i.test(String(header("x-billing-code") || ""))) {
          recordUsage(db, usage, 0);
          log?.error?.(`[hirebase] QUOTA reached — ${json?.detail || "limit_exceeded"}; nothing retried`);
          throw new HirebaseQuotaError(json?.detail || "Hirebase quota reached", { status: 429, detail: json?.detail ?? null });
        }
        const wait = Number(header("retry-after"));
        if (attempt < 3 && Number.isFinite(wait)) { log?.warn?.(`[hirebase] rate limited — waiting ${wait}s`); await sleep(wait * 1000 + 50); continue; }
        throw new HirebaseError("Hirebase rate limit — gave up after retries", { code: "rate_limited", status: 429, detail: json?.detail ?? null });
      }
      if (!res.ok) throw new HirebaseError(`Hirebase ${res.status}`, { code: `http_${res.status}`, status: res.status, detail: json?.detail ?? text.slice(0, 300) });
      const units = Array.isArray(json?.jobs) && path === "/v2/jobs/search" ? json.jobs.length : 0;
      recordUsage(db, usage, units);
      return { dryRun: false, status: res.status, json, usage, units };
    }
  }

  return {
    config,
    /** POST /v2/jobs/search — costs up to `limit` (default 10, max 100). */
    search: (body = {}) => {
      const limit = Math.min(100, Math.max(1, Number(body.limit ?? 10) || 10));
      return send({ method: "POST", path: "/v2/jobs/search", body: { ...body, limit }, maxUnits: limit });
    },
    /** POST /v2/jobs/estimate — free; `limit: 0` → the total match count. */
    estimate: (body = {}) => send({ method: "POST", path: "/v2/jobs/estimate", body: { ...body, limit: body.limit ?? 0 }, maxUnits: 0 }),
    /** GET /v2/jobs/expired-jobs — free; `since` within 14 days. */
    expired: ({ since, page = 1, limit = 1000 } = {}) => send({ method: "GET", path: "/v2/jobs/expired-jobs", query: { since, page, limit: Math.min(1000, limit) }, maxUnits: 0 }),
  };
}

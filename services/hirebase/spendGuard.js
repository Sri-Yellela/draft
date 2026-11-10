// services/hirebase/spendGuard.js — ⭐ HB-2 (D187 HB-INFRA, owner 11-09: "so that we don't waste the calls").
//
// EVERY Hirebase request states its worst-case units BEFORE it is sent (search: `limit`; estimate / expired: 0) and is
// refused when it would cross the month's cap or the day's ceiling. The running totals come from Hirebase's own usage
// headers (hirebase_usage, written by the client after each response) — `Included-Used` for the period when Hirebase sent
// it — and only fall back to draft's own sum of returned units when it didn't. One place decides; the client calls it.
import { getSetting } from "../appSettings.js";

export const MONTH_CAP_KEY = "hirebase_month_cap";
export const DAY_CAP_KEY = "hirebase_day_cap";
export const DEFAULT_MONTH_CAP = 500;   // the Free plan's allowance (jobs / month)
export const DEFAULT_DAY_CAP = 200;     // the owner's sample is 100; a day never spends the whole free month
export const JOBS_METER = "m_jobs_api_calls";

const int = (v, d) => { if (v == null || String(v).trim() === "") return d; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d; };
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

export function caps(db) {
  let month = DEFAULT_MONTH_CAP, day = DEFAULT_DAY_CAP;
  try { month = int(getSetting(db, MONTH_CAP_KEY), DEFAULT_MONTH_CAP); } catch { /* default */ }
  try { day = int(getSetting(db, DAY_CAP_KEY), DEFAULT_DAY_CAP); } catch { /* default */ }
  return { month, day };
}

/** Units used: today, and this month — Hirebase's own Included-Used for the current period when it reported one. */
export function usedSoFar(db, { meter = JOBS_METER, nowMs = Date.now() } = {}) {
  const today = dayOf(nowMs), monthPrefix = today.slice(0, 7);
  let day = 0, month = 0, reported = null;
  try {
    day = db.prepare("SELECT COALESCE(SUM(units), 0) FROM hirebase_usage WHERE day = ? AND meter = ?").pluck().get(today, meter) || 0;
    month = db.prepare("SELECT COALESCE(SUM(units), 0) FROM hirebase_usage WHERE substr(day, 1, 7) = ? AND meter = ?").pluck().get(monthPrefix, meter) || 0;
    const r = db.prepare(`SELECT included_used, period_end FROM hirebase_usage WHERE meter = ? AND included_used IS NOT NULL
      ORDER BY updated_at DESC, day DESC LIMIT 1`).get(meter);
    if (r && (r.period_end == null || Date.parse(r.period_end) > nowMs)) reported = Number(r.included_used);
  } catch { /* no table yet — nothing spent */ }
  return { day, month: reported != null && Number.isFinite(reported) ? Math.max(reported, month) : month, fromHeaders: reported != null };
}

/**
 * May a request costing up to `maxUnits` be sent now? { ok, reason?, caps, used }.
 * A free call (maxUnits 0) is always allowed — the estimate and the expired feed cost nothing, even at the cap.
 */
export function checkSpend(db, maxUnits, { meter = JOBS_METER, nowMs = Date.now() } = {}) {
  const units = int(maxUnits, NaN);
  if (!Number.isFinite(units)) return { ok: false, reason: "max_units_unknown" };
  const c = caps(db), used = usedSoFar(db, { meter, nowMs });
  if (units === 0) return { ok: true, caps: c, used };
  if (used.month + units > c.month) return { ok: false, reason: "month_cap", caps: c, used };
  if (used.day + units > c.day) return { ok: false, reason: "day_cap", caps: c, used };
  return { ok: true, caps: c, used };
}

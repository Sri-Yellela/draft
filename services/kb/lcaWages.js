// services/kb/lcaWages.js — ⭐ D108 P1 · the median wage an employer OFFERED on its certified LCAs (owner 10-30).
//
// SOURCE: the DOL OFLC LCA disclosure file's own columns (record layout FY2026 Q1, Form ETA-9035 Section F.a.):
//   WAGE_RATE_OF_PAY_FROM   "Wage paid to nonimmigrant workers at the First Worksite Location"
//   WAGE_UNIT_OF_PAY        "Hour", "Week", "Bi-Weekly", "Month", "Year"
// (WAGE_RATE_OF_PAY_TO is the top of a range when one was given; PREVAILING_WAGE / PW_UNIT_OF_PAY are the prevailing
// wage, a different claim — neither is read.) The FROM figure is the wage the employer attested it will pay, so the
// median of those across certified cases is "what this employer files at", not a salary promise for any one role.
//
// ANNUALISED by the unit: Hour × 2080 (40 h × 52 weeks), Week × 52, Bi-Weekly × 26, Month × 12, Year × 1. A figure
// outside [$10,000, $2,000,000] a year after annualising is a data-entry slip (an annual figure filed as "Hour" reads
// as $250M) and is NOT counted — dropped, never clamped.
//
// STORED AS A HISTOGRAM of $1,000 buckets per employer per period (lca_employer_periods.wage_hist_json), so a company's
// median over several entities and quarters is EXACT to the bucket — a median of medians would not be a median. The
// bucket is the annual wage rounded to the nearest $1,000; the screen says "$162k", so nothing finer is lost.

export const HOURS_PER_YEAR = 2080;
const MULTIPLIER = { hour: HOURS_PER_YEAR, week: 52, "bi-weekly": 26, biweekly: 26, month: 12, year: 1 };
export const WAGE_MIN_ANNUAL = 10_000;
export const WAGE_MAX_ANNUAL = 2_000_000;

/** "$120,000.00" / 120000 / "57.69" → a number, or null. */
export function parseWageAmount(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** One case's offered wage → an annual USD figure, or null when the unit is unknown or the result is implausible. */
export function annualiseWage(amount, unit) {
  const a = parseWageAmount(amount);
  if (a == null || a <= 0) return null;
  const m = MULTIPLIER[String(unit ?? "").trim().toLowerCase()];
  if (!m) return null;
  const annual = a * m;
  if (annual < WAGE_MIN_ANNUAL || annual > WAGE_MAX_ANNUAL) return null;
  return annual;
}

/** Adds one annual figure to a histogram Map(bucketThousands → count). */
export function addToHistogram(hist, annual) {
  if (annual == null) return hist;
  const k = Math.round(annual / 1000);
  hist.set(k, (hist.get(k) || 0) + 1);
  return hist;
}

/** Merges a stored histogram (JSON string or object) into a Map. */
export function mergeHistogram(into, stored) {
  let obj = stored;
  if (typeof stored === "string") { try { obj = JSON.parse(stored); } catch { obj = null; } }
  if (!obj || typeof obj !== "object") return into;
  for (const [k, n] of Object.entries(obj)) {
    const kk = Number(k), nn = Number(n);
    if (Number.isFinite(kk) && Number.isFinite(nn) && nn > 0) into.set(kk, (into.get(kk) || 0) + nn);
  }
  return into;
}

export const histogramToJson = (hist) => (hist.size ? JSON.stringify(Object.fromEntries([...hist.entries()].sort((a, b) => a[0] - b[0]))) : null);

/** The median annual wage (USD, a multiple of $500) of a histogram, and how many cases it is over. */
export function histogramMedian(hist) {
  const entries = [...hist.entries()].filter(([, n]) => n > 0).sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return null;
  const at = (rank) => { let seen = 0; for (const [k, n] of entries) { seen += n; if (seen > rank) return k; } return entries[entries.length - 1][0]; };
  const mid = total >> 1;
  const thousands = total % 2 ? at(mid) : (at(mid - 1) + at(mid)) / 2;
  return { median: Math.round(thousands * 1000), cases: total };
}

/** "$162k" — the screen's form. */
export function formatWageK(usd) {
  if (!Number.isFinite(usd)) return null;
  return `$${Math.round(usd / 1000).toLocaleString("en-US")}k`;
}

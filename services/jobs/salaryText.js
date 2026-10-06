// services/jobs/salaryText.js — D41(b): a STATED pay range, read from the words a posting uses.
//
// ⛔ DETERMINISTIC (D17), and it reads only what is written: "$150,000 – $180,000 USD", "$150K–$180K",
// "150K-180K USD", "$45 - $60 per hour", "$123K – $185K • Offers Equity". Nothing is inferred — a
// figure with no currency sign or code is not read as money, and a single bare number is not a range
// unless it is stated as pay ("$150,000/year"). null when nothing qualifies.
//
// The owner's capture had a salary on the page and none in draft. The capture path read the
// extension's `Salary:` line and threw it away, and the JSON-LD read never looked at `baseSalary`.

const CURRENCY_SIGN = { "$": "USD", "€": "EUR", "£": "GBP" };
const CODES = ["USD", "CAD", "AUD", "NZD", "EUR", "GBP", "SGD", "INR", "MXN", "CHF", "JPY"];
// A sign that is "$" but says another dollar: C$, CA$, A$, AU$, NZ$, S$, MX$.
const DOLLAR_PREFIX = { C: "CAD", CA: "CAD", A: "AUD", AU: "AUD", NZ: "NZD", S: "SGD", MX: "MXN", US: "USD" };

const AMOUNT = String.raw`(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*([kKmM])?`;
const SIGN = String.raw`(?:(US|CA|C|AU|A|NZ|S|MX)?\$|€|£)`;
const RANGE_RE = new RegExp(
  String.raw`(${SIGN})?\s*${AMOUNT}\s*(?:-|–|—|to)\s*(${SIGN})?\s*${AMOUNT}(?:\s*(USD|CAD|AUD|NZD|EUR|GBP|SGD|INR|MXN|CHF|JPY))?`, "i");
const SINGLE_RE = new RegExp(String.raw`(${SIGN})\s*${AMOUNT}\s*(?:\/|per\s+)\s*(year|yr|annum|hour|hr|month)`, "i");
const PERIOD_RE = /\b(?:per|an?|\/)\s*(hour|hr|year|yr|annum|month|mo)\b|\b(hourly|annually|annual|yearly|monthly)\b/i;

function amount(num, mult) {
  const n = Number(String(num).replace(/[,](?=\d{3}\b)/g, "").replace(/\.(?=\d{3}\b)/g, ""));
  if (!Number.isFinite(n)) return null;
  const m = /k/i.test(mult || "") ? 1e3 : /m/i.test(mult || "") ? 1e6 : 1;
  return Math.round(n * m);
}

function currencyOf(sign, prefix, code) {
  if (code) return code.toUpperCase();
  if (!sign) return null;
  if (sign.endsWith("$")) return prefix ? DOLLAR_PREFIX[prefix.toUpperCase()] || null : "USD";
  return CURRENCY_SIGN[sign] || null;
}

function periodOf(text, max) {
  const m = PERIOD_RE.exec(text);
  const w = (m?.[1] || m?.[2] || "").toLowerCase();
  if (/^(hour|hr|hourly)$/.test(w)) return "hourly";
  if (/^(month|mo|monthly)$/.test(w)) return "monthly";
  if (/^(year|yr|annum|annually|annual|yearly)$/.test(w)) return "annual";
  // No stated period: a figure of 1,000+ is a yearly salary on every board we read; a small one is
  // not guessed into a period.
  return max >= 1000 ? "annual" : null;
}

/**
 * @param {string} text  a salary line, or a passage containing one
 * @returns {{ salary_min: number, salary_max: number, salary_currency: string, salary_period: string|null } | null}
 */
export function parseSalaryText(text) {
  const s = String(text || "").slice(0, 20000);
  if (!s.trim()) return null;
  const r = RANGE_RE.exec(s);
  if (r) {
    const [, sign1, prefix1, n1, k1, sign2, prefix2, n2, k2, code] = r;
    // A unit on one end applies to both ("150-180K").
    const lo = amount(n1, k1 || k2), hi = amount(n2, k2 || k1);
    const currency = currencyOf(sign1 || sign2, prefix1 || prefix2, code);
    if (currency && lo && hi && lo <= hi && lo >= 7) {
      return { salary_min: lo, salary_max: hi, salary_currency: currency, salary_period: periodOf(s.slice(r.index, r.index + r[0].length + 24), hi) };
    }
  }
  const one = SINGLE_RE.exec(s);
  if (one) {
    const [, sign, prefix, n, k, per] = one;
    const v = amount(n, k);
    const currency = currencyOf(sign, prefix, null);
    if (currency && v) return { salary_min: v, salary_max: v, salary_currency: currency, salary_period: periodOf(per, v) };
  }
  return null;
}

/**
 * schema.org `baseSalary` (a MonetaryAmount): { currency, value: { minValue, maxValue, value, unitText } }.
 * @returns the same shape as parseSalaryText, or null
 */
export function salaryFromJsonLd(baseSalary) {
  const b = Array.isArray(baseSalary) ? baseSalary[0] : baseSalary;
  if (!b || typeof b !== "object") return typeof b === "string" ? parseSalaryText(b) : null;
  const v = b.value && typeof b.value === "object" ? b.value : { value: b.value };
  const lo = Number(v.minValue ?? v.value), hi = Number(v.maxValue ?? v.value);
  const currency = typeof b.currency === "string" && CODES.includes(b.currency.toUpperCase()) ? b.currency.toUpperCase() : null;
  if (!currency || !Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi < lo) return null;
  const unit = String(v.unitText || b.unitText || "").toUpperCase();
  const salary_period = unit === "HOUR" ? "hourly" : unit === "MONTH" ? "monthly" : unit === "YEAR" ? "annual" : (hi >= 1000 ? "annual" : null);
  return { salary_min: Math.round(lo), salary_max: Math.round(hi), salary_currency: currency, salary_period };
}

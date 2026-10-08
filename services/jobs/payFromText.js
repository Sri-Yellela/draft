// services/jobs/payFromText.js — ⛔ D71 · PAY (AND ITS PLACE) STATED IN THE POSTING'S PROSE.
//
// The owner's captured Amazon posting read "not stated" for salary and location while its own text
// ended with:
//     USA, MA, Boston - 143,700.00 - 194,400.00 USD annually
// D59's label block reads only a LEADING run of "Label: value" lines, and parseSalaryText reads one
// passage it is handed — nothing scanned the whole text. Measured 10-07 on production: 260 of 675
// salary-empty active postings state a pay range in their text (258 Greenhouse).
//
// ⛔ DETERMINISTIC (D17). ⛔ A WRONGLY PARSED SALARY IS WORSE THAN A MISSING ONE, so a range counts
// as pay only when ALL of these hold:
//   · it names a currency — a sign ($ € £, C$ …) or an ISO code, before OR after the numbers;
//   · the line (or the line before it) has PAY CONTEXT — salary, compensation, pay range, base pay,
//     wage, annually, per hour, /yr … — or the line states a pay unit;
//   · the figures are plausible for the unit (annual 10k–2M, monthly 1k–200k, hourly 7–500) and
//     the top is at most 5× the bottom;
//   · no "million / billion" follows (a budget, not a salary).
// The negative fixtures in test/d71PayFromText.test.js are the traps the owner listed.
//
// ⭐ PAY IS OFTEN PER LOCATION ("USA, CA, Palo Alto - 150,000 - 210,000 USD" then a Seattle line), so
// every line is kept as { location, min, max }, and the overall range is their min–max.
// ⛔ HOURLY STAYS HOURLY — the unit is returned as stated, never converted; annualisedUsd() is the
// sort's explicit ESTIMATE and is named as one.
import { US_STATES } from "./usLocation.js";   // ONE state list (A93) — the tagger's own

const SIGN_CURRENCY = { "$": "USD", "€": "EUR", "£": "GBP" };
const DOLLAR_PREFIX = { US: "USD", C: "CAD", CA: "CAD", A: "AUD", AU: "AUD", NZ: "NZD", S: "SGD", MX: "MXN" };
const CODES = "USD|CAD|AUD|NZD|EUR|GBP|SGD|INR|MXN|CHF|JPY";

const SIGN = String.raw`(?:(US|CA|C|AU|A|NZ|S|MX)?\$|€|£)`;
const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s?([kK])?`;
const SEP = String.raw`\s*(?:-|–|—|to|and)\s*`;
// [code] [sign] N [k] SEP [code] [sign] N [k] [code] — "between" is optional and only changes SEP's "and".
const RANGE_G = new RegExp(
  String.raw`(?:\b(${CODES})\s*)?(${SIGN})?\s*${NUM}${SEP}(?:\b(${CODES})\s*)?(${SIGN})?\s*${NUM}(?:\s*\b(${CODES})\b)?(\s*(?:million|billion|mm|bn)\b|\s*[mMbB]\b)?`, "g");

// ⛔ D84 F3 (owner, 10-09: 10 of 13 postings that state pay were never captured). Two real formats the range above
// misses, verbatim from the rehearsal: "Salary range: $190,000 $250,000 + performance-based bonus" (NO separator)
// and "$187,500 - 220,000 USD" (the second figure has no sign, and the line has no pay word). So:
//   · two figures with NO separator are a range when BOTH carry a currency sign (a pay label usually precedes them);
//   · a range anchored by a currency at BOTH ends counts without a pay word on the line.
// A trailing "+ bonus / equity / USD" is ignored by both; the negatives (401k match, revenue, headcount) still fail.
const RANGE_NOSEP_G = new RegExp(String.raw`(${SIGN})\s*${NUM}\s+(${SIGN})\s*${NUM}(?:\s*\b(${CODES})\b)?(\s*(?:million|billion|mm|bn)\b|\s*[mMbB]\b)?`, "g");

const PAY_WORD = /\b(?:salary|salaries|compensation|pay\s*(?:range|scale|rate|band)|base\s*(?:pay|salary|compensation)|wages?|hourly\s*rate|ote|on-target earnings|annual(?:ly)?|per\s+(?:year|annum|hour|month)|hourly)\b|\/\s?(?:yr|hr|year|hour|mo)\b/i;
const UNIT_RE = /\b(?:per|an?|\/)\s*(hour|hr|year|yr|annum|month|mo)\b|\b(hourly|annually|annual|yearly|monthly)\b|\/\s?(hr|yr|mo)\b/i;

const US_COUNTRY = /^(?:usa|us|u\.s\.a?\.?|united states(?: of america)?)$/i;

function amount(n, k) {
  const v = Number(String(n).replace(/,/g, ""));
  if (!Number.isFinite(v)) return null;
  return Math.round(k ? v * 1000 : v);
}

function currencyOf(code1, sign1, pre1, code2, sign2, pre2, codeAfter) {
  const code = code1 || code2 || codeAfter;
  if (code) return code.toUpperCase();
  const sign = sign1 || sign2, pre = pre1 || pre2;
  if (!sign) return null;
  if (sign.endsWith("$")) return pre ? DOLLAR_PREFIX[pre.toUpperCase()] || null : "USD";
  return SIGN_CURRENCY[sign] || null;
}

function unitOf(text) {
  const m = UNIT_RE.exec(text);
  const w = (m?.[1] || m?.[2] || m?.[3] || "").toLowerCase();
  if (/^(hour|hr|hourly)$/.test(w)) return "hourly";
  if (/^(month|mo|monthly)$/.test(w)) return "monthly";
  if (/^(year|yr|annum|annually|annual|yearly)$/.test(w)) return "annual";
  return null;
}

const PLAUSIBLE = { annual: [10_000, 2_000_000], monthly: [1_000, 200_000], hourly: [7, 500] };

/**
 * A place written before the figures on a pay line, as large employers write it:
 * "USA, MA, Boston" (country, state, city) · "Boston, MA, USA" · "Boston, MA". US only — any other
 * shape is not guessed. ⛔ D59's trap: a street is not a city, so a token with a digit is refused.
 * @returns {{ country: "US", state: string, city: string|null } | null}
 */
export function placeOfPayLine(prefix) {
  const t = String(prefix || "").replace(/[\s:–—-]+$/, "").split(",").map(s => s.trim()).filter(Boolean);
  if (t.length < 2 || t.length > 3 || t.some(s => /\d/.test(s) || s.length > 40)) return null;
  const isState = (s) => /^[A-Za-z]{2}$/.test(s) && Object.hasOwn(US_STATES, s.toUpperCase());
  const city = (s) => (/^[A-Za-z .'-]+$/.test(s) ? s.replace(/\b\w/g, c => c.toUpperCase()) : null);
  if (t.length === 3 && US_COUNTRY.test(t[0]) && isState(t[1])) return { country: "US", state: t[1].toUpperCase(), city: city(t[2]) };
  if (t.length === 3 && US_COUNTRY.test(t[2]) && isState(t[1])) return { country: "US", state: t[1].toUpperCase(), city: city(t[0]) };
  if (t.length === 2 && isState(t[1])) return { country: "US", state: t[1].toUpperCase(), city: city(t[0]) };
  if (t.length === 2 && US_COUNTRY.test(t[0]) && isState(t[1])) return { country: "US", state: t[1].toUpperCase(), city: null };
  return null;
}

function rangesOnLine(line, prevLine) {
  const out = [];
  const context = PAY_WORD.test(line) || PAY_WORD.test(prevLine || "");
  RANGE_G.lastIndex = 0;
  let m;
  while ((m = RANGE_G.exec(line))) {
    const [all, code1, sign1, pre1, n1, k1, code2, sign2, pre2, n2, k2, codeAfter, magnitude] = m;
    if (magnitude) continue;                                     // "$1–2 million" is a budget
    const currency = currencyOf(code1, sign1, pre1, code2, sign2, pre2, codeAfter);
    if (!currency) continue;                                     // "10–20 years" has no currency
    const tail = line.slice(m.index, m.index + all.length + 30);
    const unitStated = unitOf(tail) || unitOf(line);
    // D84 F3: currency at BOTH ends ("$187,500 - 220,000 USD") anchors a range without a pay word.
    const bothEnds = Boolean((sign1 || code1) && (sign2 || code2 || codeAfter));
    if (!context && !unitStated && !bothEnds) continue;
    // A unit on one end applies to both ("150-180K").
    const lo = amount(n1, k1 || k2), hi = amount(n2, k2 || k1);
    if (!lo || !hi || lo > hi || hi > lo * 5) continue;
    const unit = unitStated || (hi >= 10_000 ? "annual" : null);
    if (!unit) continue;                                          // a small figure is never guessed into a unit
    const [floor, ceil] = PLAUSIBLE[unit];
    if (lo < floor || hi > ceil) continue;
    out.push({ min: lo, max: hi, currency, unit, location: placeOfPayLine(line.slice(0, m.index)) });
  }
  // D84 F3: no separator, both figures signed — read only when the separated form found nothing on this line.
  if (!out.length) {
    RANGE_NOSEP_G.lastIndex = 0;
    while ((m = RANGE_NOSEP_G.exec(line))) {
      const [all, sign1, pre1, n1, k1, sign2, pre2, n2, k2, codeAfter, magnitude] = m;
      if (magnitude) continue;
      const currency = currencyOf(null, sign1, pre1, null, sign2, pre2, codeAfter);
      if (!currency) continue;
      const tail = line.slice(m.index, m.index + all.length + 30);
      const unitStated = unitOf(tail) || unitOf(line);
      const lo = amount(n1, k1 || k2), hi = amount(n2, k2 || k1);
      if (!lo || !hi || lo > hi || hi > lo * 5) continue;
      const unit = unitStated || (hi >= 10_000 ? "annual" : null);
      if (!unit) continue;
      const [floor, ceil] = PLAUSIBLE[unit];
      if (lo < floor || hi > ceil) continue;
      out.push({ min: lo, max: hi, currency, unit, location: placeOfPayLine(line.slice(0, m.index)) });
    }
  }
  return out;
}

/**
 * Scan the WHOLE text for stated pay.
 * @returns {{ salary_min, salary_max, salary_currency, salary_period, source: "description",
 *             locations: { country, state, city, min, max }[] } | null}
 */
export function payFromText(text) {
  const lines = String(text || "").split(/\r?\n/);
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length > 600) continue;
    found.push(...rangesOnLine(line, lines[i - 1]?.trim()));
  }
  if (!found.length) return null;
  // One currency and one unit — the first stated wins, and a line in another is not blended in.
  const { currency, unit } = found[0];
  const same = found.filter(r => r.currency === currency && r.unit === unit);
  const key = (r) => `${r.min}|${r.max}|${r.location?.state || ""}|${r.location?.city || ""}`;
  const uniq = [...new Map(same.map(r => [key(r), r])).values()];
  return {
    salary_min: Math.min(...uniq.map(r => r.min)),
    salary_max: Math.max(...uniq.map(r => r.max)),
    salary_currency: currency,
    salary_period: unit,
    source: "description",
    locations: uniq.filter(r => r.location).map(r => ({ ...r.location, min: r.min, max: r.max })),
  };
}

/** The sort and filter's ESTIMATE of a USD range per year: 2,080 hours, 12 months. Never displayed. */
export function annualisedUsd(pay) {
  if (!pay || pay.salary_currency !== "USD") return { min: null, max: null };
  const f = pay.salary_period === "hourly" ? 2080 : pay.salary_period === "monthly" ? 12 : 1;
  return { min: Math.round(pay.salary_min * f), max: Math.round(pay.salary_max * f) };
}

/** "Boston, MA" · "Boston, MA · Seattle, WA" · "Boston, MA + 3 more" — the pay lines' places. */
export function payLocationLabel(locations = []) {
  const names = [...new Set(locations.map(l => (l.city ? `${l.city}, ${l.state}` : l.state)).filter(Boolean))];
  if (!names.length) return null;
  return names.length <= 2 ? names.join(" · ") : `${names[0]} + ${names.length - 1} more`;
}

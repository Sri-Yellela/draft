/**
 * D32 — THE POSTING'S MASTHEAD FACTS, read deterministically from what is already on file.
 *
 * ⛔ D17: NO MODEL CALL. Every fact the masthead prints is a column or a regex:
 *   kicker      domain · level · workplace   ← D29's tags (scraped_jobs.tag_function / tag_level / tag_workplace)
 *   Experience  "4+ yrs"                      ← a regex over the posting's own text, plus a word-number map
 *   Where       the posting's location        ← scraped_jobs.location (free text, as posted)
 *   Salary      "$130k–$170k"                 ← salary_min / salary_max
 *   Posted      "3d ago"                      ← posted_at, else when the board first saw it
 *
 * ⭐ A FACT THAT IS NOT ON FILE IS SAID, NOT HIDDEN. Every cell returns `value: null` when the fact is
 * missing, and the masthead renders that as an italic-serif "not stated" — a VALUE, never a blank and
 * never a guess. D29's coverage is thin on some of these (workplace ~half, level ~two thirds), and a
 * masthead that silently drops what it does not know would read as "this posting has no level".
 *
 * Shared (not client-only) so the coverage measurement and the tests run the SAME code the page does.
 */
import { JOB_FUNCTIONS } from "./jobTagVocabulary.js";
import { EXPERIENCE_LEVELS, WORK_MODELS } from "./jobFilterOptions.js";

// ── Years of experience ─────────────────────────────────────────────────────────────────────────
//
// The row's regex is `\d+\+?\s*years?`. ⚠ The one bounded gap it names: "a minimum of four years"
// is written in words. WORD_NUMBERS is that gap's answer — deterministic, and just a list to maintain.
export const WORD_NUMBERS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20,
});
const NUMBER = `(\\d{1,2}|${Object.keys(WORD_NUMBERS).join("|")})`;
// "4+ years", "4 years", "four (4) years", "3-5 years", "3 to 5 years", "five+ years", "4+ yrs".
const YEARS_RE = new RegExp(
  `\\b${NUMBER}(?:\\s*\\(\\d{1,2}\\))?\\s*(\\+|plus)?\\s*(?:(?:[-–]|to)\\s*(\\d{1,2})\\s*\\+?\\s*)?(?:years?|yrs?)\\b`, "gi");
// A number of years is a REQUIREMENT only in a requirement's words — else "20 years in business" and
// "a 2 year fixed term" would be read as experience asks. One of: a "+", "experience" after it in the
// same sentence, or "minimum of" / "at least" before it.
const AFTER_EXPERIENCE = /^[^.\n;]{0,90}?\b(?:experience|exp)\b/i;
const BEFORE_FLOOR = /\b(?:minimum(?:\s+of)?|min\.?|at\s+least)\s*$/i;

const toNumber = (s) => {
  const t = String(s).toLowerCase();
  return /^\d+$/.test(t) ? Number(t) : (WORD_NUMBERS[t] ?? null);
};

/**
 * The posting's stated years of experience: the SMALLEST it asks for (a range's floor, the lowest of
 * several — "3+ years, 5+ preferred" is open at 3), or null when it states none.
 * @returns {{ years:number, upper:number|null, label:string }|null}
 */
export function yearsAsked(description) {
  const text = String(description || "").slice(0, 20000);
  let best = null;
  for (const m of text.matchAll(YEARS_RE)) {
    const n = toNumber(m[1]);
    const upper = m[3] != null ? Number(m[3]) : null;
    // 0 is a real floor only as a range's ("0-2 years of experience"); a bare "0 years" asks nothing.
    if (n == null || n > 25 || (n < 1 && !(upper > 0))) continue;
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    const after = text.slice(m.index + m[0].length);
    const isAsk = !!m[2] || AFTER_EXPERIENCE.test(after) || BEFORE_FLOOR.test(before);
    if (!isAsk) continue;
    if (best == null || n < best.years) best = { years: n, upper: upper != null && upper > n ? upper : null };
  }
  if (!best) return null;
  return { ...best, label: best.upper ? `${best.years}–${best.upper} yrs` : `${best.years}+ yrs` };
}

// ── The experience requirement as the SCORER judged it (pass/fail) ──────────────────────────────
//
// The scorer's report carries { requiredYears, candidateYears, fit }. ⚠ `fit` is TRUE when the posting
// asks for no years at all — so `fit` alone cannot say "met". Four states, never inferred from prose:
//   met      it asks, and the résumé/profile meets it
//   short    it asks, and the résumé/profile has fewer
//   unknown  it asks, and there is nothing to compare against
//   none     it asks for no years
export const EXPERIENCE_STATES = Object.freeze(["met", "short", "unknown", "none"]);
// A report that carries neither (a deck card frozen before D32) is null — the row prints the scorer's
// sentence with no mark rather than guess one.
export function experienceState(exp) {
  if (!exp || typeof exp !== "object") return null;
  if (EXPERIENCE_STATES.includes(exp.state)) return exp.state;
  if (!("requiredYears" in exp)) return exp.fit === false ? "short" : null;
  if (!Number.isFinite(exp.requiredYears)) return "none";
  if (!Number.isFinite(exp.candidateYears)) return "unknown";
  return exp.candidateYears >= exp.requiredYears ? "met" : "short";
}

// ── The kicker: D29's tags ──────────────────────────────────────────────────────────────────────
const labelOf = (vocab, v) => vocab.options.find(o => o.value === v)?.label || null;

/** domain · level · workplace — only the tags that are on file, in that order. [] when none are. */
export function kickerFor(job) {
  return [
    labelOf(JOB_FUNCTIONS, job?.tagFunction),
    labelOf(EXPERIENCE_LEVELS, job?.tagLevel),
    labelOf(WORK_MODELS, job?.tagWorkplace),
  ].filter(Boolean);
}

// ── The deck strip ──────────────────────────────────────────────────────────────────────────────
function salaryLabel(job) {
  const lo = Number(job?.salaryMin), hi = Number(job?.salaryMax);
  const has = (v) => Number.isFinite(v) && v > 0;
  if (!has(lo) && !has(hi)) return null;
  const cur = job.salaryCurrency && job.salaryCurrency !== "USD" ? `${job.salaryCurrency} ` : "$";
  const k = (v) => `${cur}${Math.round(v / 1000)}k`;
  if (has(lo) && has(hi) && hi !== lo) return `${k(lo)}–${k(hi)}`;
  return k(has(lo) ? lo : hi);
}

function postedLabel(job, now = Date.now()) {
  const t = job?.postedAt ? Date.parse(job.postedAt)
    : Number.isFinite(Number(job?.discoveredAt)) && Number(job.discoveredAt) > 0 ? Number(job.discoveredAt) * 1000 : NaN;
  if (!Number.isFinite(t) || t <= 0) return null;
  const d = Math.max(0, Math.floor((now - t) / 86400000));
  return d === 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
}

/**
 * The four cells, in the approved order. `value: null` IS THE FALLBACK — the masthead prints it as
 * "not stated". `met` is the Experience cell's tint: true only when the scorer judged it met.
 */
// ⭐ D48 (owner, 10-07, posting-header2.html): "Workstyle" replaces "Where" — the value is the workstyle
// (On-site · Hybrid · Remote), and LOCATION keeps a muted second line beneath it (`sub`), because the
// header chip that carried it is gone and it would otherwise appear nowhere on the panel.
const WORKSTYLE_WORDS = Object.freeze({ onsite: "On-site", hybrid: "Hybrid", remote: "Remote" });
export function workstyleOf(job) {
  const v = String(job?.tagWorkplace || job?.workplaceType || job?.workType || "").toLowerCase().replace(/[^a-z]/g, "");
  return WORKSTYLE_WORDS[v] || null;
}

export function deckStrip(job, { experience = null, now = Date.now() } = {}) {
  const years = yearsAsked(job?.description);
  const location = String(job?.location || "").trim() || null;
  return [
    { key: "experience", label: "Experience", value: years?.label ?? null, met: !!years && experienceState(experience) === "met" },
    { key: "workstyle", label: "Workstyle", value: workstyleOf(job), sub: location },
    { key: "salary", label: "Salary", value: salaryLabel(job) },
    { key: "posted", label: "Posted", value: postedLabel(job, now) },
  ];
}

export const NOT_STATED = "not stated";

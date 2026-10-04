/**
 * D24 — FULL HOUSE: FILTERS AS A SENTENCE, SORTING AS A PANEL. THE CONTRACT BOTH HALVES BUILD TO.
 *
 * Written first, on its own, so the server half (GET /api/jobs/facets, the fit filter, the new sort)
 * and the client half (the sentence, the popovers, the sort panel) can be built in parallel without
 * either guessing the other's shape. ⛔ Nothing here is registered in FILTER_DIMENSIONS yet: a
 * registered dimension must be implemented by GET /api/jobs (test/filterOptionContract.test.js), so
 * the server half registers FIT_BANDS and the `companyAsc` sort when it implements them.
 *
 * Every value is a DB / param value per jobFilterOptions.js's rules; labels are derived, never
 * hardcoded at a call site.
 */
import { EXPERIENCE_LEVELS, WORK_MODELS, POSTING_AGE } from "./jobFilterOptions.js";
import { ATS_BAND, ATS_BAND_LABELS } from "./atsBands.js";

// ── The fit filter — a new dimension ────────────────────────────────────────────────────────────
//
// "where my fit is Strong". The band is the per-user ATS band (shared/atsBands.js), never the
// number (ATS_NUMBER_SHOWN is false until A76 earns it). ⛔ A job with no score is NOT a match for any
// band: "unscored" is not "weak". Unlike the soft-null classified filters, this one is HARD — an
// unscored row cannot be shown under "Strong" — and the facets response says how many it left out.
export const FIT_BANDS = {
  param: "fit_bands",
  multi: true,
  options: [ATS_BAND.STRONG, ATS_BAND.MODERATE, ATS_BAND.WEAK]
    .map(value => ({ value, label: ATS_BAND_LABELS[value].short })),
  dbOnly: [],
};

// ── The sentence — four clauses, deliberately ───────────────────────────────────────────────────
//
// "Show me <Senior> jobs that are <Remote>, posted <this month>, where my fit is <Strong>".
// ⛔ THE CAP IS FOUR, AND IT IS A DECISION (D24): past four the sentence is a run-on, and a daily-draft
// product that needs six simultaneous filters is curating wrong. Every other filter the drawer had
// (domain, provider, status, employment type, visited) is NOT a clause — the sentence does not grow.
// `lead`/`tail` are the prose around the token; `any` is what the token reads with nothing chosen.
export const SENTENCE_CAP = 4;
export const SENTENCE_CLAUSES = Object.freeze([
  { key: "level",   dim: EXPERIENCE_LEVELS, lead: "Show me",          tail: "jobs", any: "any level" },
  { key: "where",   dim: WORK_MODELS,       lead: "that are",         tail: "",     any: "anywhere" },
  { key: "posted",  dim: POSTING_AGE,       lead: "posted",           tail: "",     any: "any time" },
  { key: "fit",     dim: FIT_BANDS,         lead: "where my fit is",  tail: "",     any: "anything" },
]);

// ── The sort panel ──────────────────────────────────────────────────────────────────────────────
//
// D24: Best fit · Newest · Salary · Company A–Z, each with a plain-words subtitle, and ⭐ the
// tie-break VISIBLE — a coarse score produces many ties, and they used to fall to insertion order
// silently. `tieBreak` is the contract the ORDER BY must implement, in this order, ending in a
// unique key so the order is total. `companyAsc` is new (the server half adds it to SORTS).
export const SORT_PANEL = Object.freeze([
  { value: "atsScore",   label: "Best fit",    subtitle: "Your strongest matches first.",
    tieBreak: ["newest first", "then company A–Z"], unscoredLast: true },
  { value: "dateDesc",   label: "Newest",      subtitle: "Most recently posted first. Shows everything.",
    tieBreak: ["best fit first", "then company A–Z"], unscoredLast: false },
  { value: "compHigh",   label: "Salary",      subtitle: "Highest stated pay first; no stated pay sorts last.",
    tieBreak: ["newest first", "then company A–Z"], unscoredLast: false },
  { value: "companyAsc", label: "Company A–Z", subtitle: "Alphabetical by company.",
    tieBreak: ["newest first"], unscoredLast: false },
]);

// ── GET /api/jobs/facets — the response the sentence reads its counts from ──────────────────────
//
// Takes EXACTLY the query params GET /api/jobs takes, and answers with what the board would hold.
//
// @typedef {{ value: string, label: string, count: number, known: number }} FacetOption
//   count — rows the board would show with THIS option chosen in its clause and every OTHER active
//           filter as it is (the clause's own current choice is replaced, not added to).
//   known — of those, rows KNOWN to match this option; count − known are kept only because their
//           column is unclassified (the soft-null rule, A73). For `fit`, known === count (hard filter).
// @typedef {{
//   total: number,                       rows the board shows now
//   known: number,                       of those, rows known to match every active filter
//   unscored: number,                    rows on the board with no fit score (they sort last under Best fit)
//   clauses: { level: FacetOption[], where: FacetOption[], posted: FacetOption[], fit: FacetOption[] },
// }} FacetsResponse

/** ⛔ D24: a zero-count option is DIMMED, not hidden — and choosing it is announced before it is pressed. */
export const wouldEmpty = (option) => !option || option.count === 0;

/** How many clauses have a choice — the filter icon's badge. */
export function activeClauseCount(params = {}) {
  return SENTENCE_CLAUSES.filter(c => {
    const v = params[c.dim.param];
    return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
  }).length;
}

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
import { EXPERIENCE_LEVELS, WORK_MODELS, POSTING_AGE, COMPANY_SPONSORSHIP } from "./jobFilterOptions.js";
// D30 · the two open-set dimensions, over the D29 tag layer.
import { JOB_FUNCTIONS, PLACES } from "./jobTagVocabulary.js";
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

// ── D30 · THE SENTENCE IS A PROJECTION OF DIAL STATE — six slots, four permanent ────────────────
//
//   Now showing ⟦domain⟧ jobs, at ⟦level⟧, ⟦location⟧, ⟦workplace⟧[, ⟦posted⟧][, ⟦fit⟧].
//
// Supersedes D24's four-clause "Show me…" and D28's phrasing. ⛔ The sentence is never a second source
// of truth: it is DERIVED from the same params the dials set (sentenceParts below), so the two cannot
// disagree. The four permanent slots always show, reading their default when nothing is chosen —
// that is what lets a user see every dimension they can filter by without opening anything (D28).
// `posted` and `fit` append ONLY WHEN SET: the dials make them discoverable, and six clauses at rest
// is the run-on D24 warned about.
//
// ⛔ LOCATION'S FLOOR IS "in the United States" AND CANNOT BE CLEARED, only narrowed. The board is
// US-only (queue 37), so the sentence states it as a fact instead of letting anyone think the search
// is global. An empty `places` IS the floor.
//
// ⚠ DOMAIN is the KIND OF WORK (the D29 job-function tag), not the company's industry (that is the
// drawer's SECTOR, shared/companySectors.js — D42). ⭐ D42 (owner, 10-06): with nothing chosen it reads
// "all", and for an engineering profile "all" IS engineering + data (ROLE_SCOPE_EXTRA) — the board's
// engineering sub-domains. It never reads the profile's word ("engineering"), and choosing a domain
// shows that kind of work.
//
// SENTENCE_CAP stays exported for the sentence's permanent-slot count; it is no longer a ceiling
// that drops clauses — the two optional ones append, and that is the extreme case by D30's decision.
export const SENTENCE_CAP = 4;
// ⭐ D37 (owner, 10-06) · THE SENTENCE, REWORDED — "the sentence with so many commas is vague":
//
//   default   discovering [all] roles at [all] career levels and [all] workstyles in [the United States].
//   narrowed  discovering [finance] roles at [senior] career level and [remote] workstyle in [Boston].
//
// The connectives do the work the commas did. Each slot is a TOKEN PLUS ITS NOUN — plural when unset
// (or several are chosen), singular when one is — so the prose changes with the token. ⛔ The `d` is
// lower-case, matching the wordmark, in the SAME face and size as every other word (D34). Posted and
// fit still append only when set, after the location: "…in Boston, posted this week, strong fits only."
// `any` is what an unset slot reads IN THE SENTENCE; `panelAny` is its "nothing chosen" pill.
// The order below is the panels' and dials' order; the SENTENCE's order is SENTENCE_ORDER.
export const SENTENCE_CLAUSES = Object.freeze([
  { key: "domain",   dim: JOB_FUNCTIONS,     label: "Domain",    permanent: true,  any: "all", panelAny: "all", noun: ["roles", "roles"] },
  { key: "level",    dim: EXPERIENCE_LEVELS, label: "Level",     permanent: true,  any: "all", panelAny: "any level", noun: ["career level", "career levels"] },
  { key: "location", dim: PLACES,            label: "Location",  permanent: true,  any: "the United States", panelAny: "the United States", floor: true },
  { key: "where",    dim: WORK_MODELS,       label: "Workplace", permanent: true,  any: "all", panelAny: "any workplace", noun: ["workstyle", "workstyles"] },
  { key: "posted",   dim: POSTING_AGE,       label: "Posted",    permanent: false, any: "any time", panelAny: "any time" },
  { key: "fit",      dim: FIT_BANDS,         label: "Fit",       permanent: false, any: "any fit", panelAny: "any fit" },
  // ⭐ A109 (owner 11-01): sponsorship as a filter — optional, appended only when set, like posted and fit.
  { key: "sponsorship", dim: COMPANY_SPONSORSHIP, label: "Sponsorship", permanent: false, any: "any employer", panelAny: "any employer" },
]);
/** D37 · the verb, lower-case like the wordmark. */
export const SENTENCE_VERB = Object.freeze({ showing: "discovering", nothing: "nothing matches" });
// The four closed sets cycle or open an inline list; the two OPEN sets need a picker (D30).
export const OPEN_SET_CLAUSES = Object.freeze(["domain", "location"]);

// The words each value reads as IN THE SENTENCE (labels are for the dials). Keyed by the dimension's
// own values, so a value added to a dimension without a word here is caught by the D30 test.
export const SENTENCE_WORDS = Object.freeze({
  level: { intern: "intern", entry: "entry", mid: "mid", senior: "senior", lead: "lead", executive: "executive" },
  where: { remote: "remote", hybrid: "hybrid", onsite: "on-site" },
  posted: { "1d": "posted today", "2d": "posted in the last 2 days", "3d": "posted in the last 3 days",
            "1w": "posted this week", "1m": "posted this month", visit: "new since your last visit" },
  fit: { [ATS_BAND.STRONG]: "strong", [ATS_BAND.MODERATE]: "moderate", [ATS_BAND.WEAK]: "weak" },
  sponsorship: { filed: "at employers with H-1B filings", 1: "hiding employers with no H-1B record" },
});

// D35 · THE WORDS AN OPTION READS AS IN ITS PANEL (header.html: "entry", "remote", "on-site", "the Bay
// Area"). Lower-case, sentence-like, so the panel reads as the same voice as the sentence it opens
// from; where the sentence's own word fits (level, fit) the sentence's word is used, so there is one
// vocabulary. Keyed by the dimension's values, so a value with no word here is caught by the D35 test.
export const PANEL_WORDS = Object.freeze({
  where: { remote: "remote", hybrid: "hybrid", onsite: "on-site" },
  posted: { "1d": "today", "2d": "the last 2 days", "3d": "the last 3 days", "1w": "this week", "1m": "this month", visit: "since your last visit" },
  sponsorship: { filed: "employers with H-1B filings" },
});

/** What one option reads as in its panel (D35). */
export function panelWord(clause, value) {
  const o = clause.dim.options.find(x => x.value === value);
  switch (clause.key) {
    case "domain":   return o?.sentence ?? value;
    case "level":    return SENTENCE_WORDS.level[value] ?? value;
    case "location": return o?.label ?? value;
    case "where":    return PANEL_WORDS.where[value] ?? value;
    case "posted":   return PANEL_WORDS.posted[value] ?? value;
    case "fit":      return SENTENCE_WORDS.fit[value] ?? value;
    case "sponsorship": return PANEL_WORDS.sponsorship[value] ?? o?.label ?? value;
    default:         return o?.label ?? value;
  }
}

/** What a clause's "nothing chosen" option reads as in its panel — location's is the floor itself. */
export function panelAnyWord(clause) {
  return clause.panelAny ?? clause.any;
}

/** D37 · a slot's noun: singular when exactly one value is chosen, plural otherwise. "" when it has none. */
export function slotNoun(clause, params = {}) {
  if (!clause.noun) return "";
  return chosenValues(clause, params).length === 1 ? clause.noun[0] : clause.noun[1];
}

const or = (words) => words.length <= 2 ? words.join(" or ") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;

/** The values chosen for a clause, always as an array. */
export function chosenValues(clause, params = {}) {
  const v = params[clause.dim.param];
  if (Array.isArray(v)) return v.filter(x => x != null && x !== "").map(String);
  if (v == null || v === "") return [];
  return clause.dim.multi ? String(v).split(",").map(s => s.trim()).filter(Boolean) : [String(v)];
}

/**
 * What one slot reads. `defaultDomain` is the profile's own function word (or null).
 * @returns {{ key: string, text: string, active: boolean }}
 */
export function slotText(clause, params = {}, { defaultDomain = null } = {}) {
  const chosen = chosenValues(clause, params);
  const active = chosen.length > 0;
  const optionOf = (v) => clause.dim.options.find(o => o.value === v);
  let text;
  switch (clause.key) {
    case "domain": {
      const all = clause.dim.options.every(o => chosen.includes(o.value));
      text = !active ? clause.any
        : all ? "all" : or(chosen.map(v => optionOf(v)?.sentence ?? v));
      break;
    }
    case "level":
      // D37: the token is the level alone; "career level(s)" is its noun (slotNoun).
      text = !active ? clause.any : or(chosen.map(v => SENTENCE_WORDS.level[v] ?? v));
      break;
    case "location":
      // D37: the token is the place alone; "in" is the connective before it.
      text = !active ? clause.any : or(chosen.map(v => (optionOf(v)?.label ?? v)));
      break;
    case "where":
      text = !active ? clause.any : or(chosen.map(v => SENTENCE_WORDS.where[v] ?? v));
      break;
    case "posted":
      text = !active ? clause.any : (SENTENCE_WORDS.posted[chosen[0]] ?? chosen[0]);
      break;
    case "fit": {
      if (!active) { text = clause.any; break; }
      text = `${or(chosen.map(v => SENTENCE_WORDS.fit[v] ?? v))} fit${chosen.length === 1 ? "s only" : "s"}`;
      break;
    }
    case "sponsorship":
      text = !active ? clause.any : (SENTENCE_WORDS.sponsorship[chosen[0]] ?? chosen[0]);
      break;
    default:
      text = active ? or(chosen) : clause.any;
  }
  return { key: clause.key, text, active };
}

/**
 * THE SENTENCE, as parts: the verb, then the slots in order — the four permanent ones always, the
 * optional ones only when set. ⛔ NOTHING MATCHES keeps the same clauses with a different verb, so the
 * reader can see which one to loosen (D30) — "this board has emptied four times".
 */
// D37 · the sentence's own order — domain, level, workplace, location — then the optional two.
export const SENTENCE_ORDER = Object.freeze(["domain", "level", "where", "location", "posted", "fit", "sponsorship"]);
// The words BEFORE each slot (after the verb), and after it — its noun, from slotNoun.
const LEAD = Object.freeze({ domain: " ", level: " at ", where: " and ", location: " in ", posted: ", ", fit: ", ", sponsorship: ", " });

export function sentenceParts(params = {}, { defaultDomain = null, nothingMatches = false } = {}) {
  const byKey = Object.fromEntries(SENTENCE_CLAUSES.map(c => [c.key, c]));
  const slots = SENTENCE_ORDER.map(k => byKey[k])
    .map(c => ({ clause: c, ...slotText(c, params, { defaultDomain }), lead: LEAD[c.key], noun: slotNoun(c, params) }))
    .filter(s => s.clause.permanent || s.active);
  return { verb: nothingMatches ? SENTENCE_VERB.nothing : SENTENCE_VERB.showing, slots };
}

/** The sentence as one string: "discovering all roles at all career levels and all workstyles in the United States." */
export function sentenceText(params = {}, opts = {}) {
  const { verb, slots } = sentenceParts(params, opts);
  return `${verb}${slots.map(s => `${s.lead}${s.text}${s.noun ? ` ${s.noun}` : ""}`).join("")}.`;
}

// ── The sort panel ──────────────────────────────────────────────────────────────────────────────
//
// D24: Best fit · Newest · Salary · Company A–Z, each with a plain-words subtitle, and ⭐ the
// tie-break VISIBLE — a coarse score produces many ties, and they used to fall to insertion order
// silently. `tieBreak` is the contract the ORDER BY must implement, in this order, ending in a
// unique key so the order is total. `companyAsc` is new (the server half adds it to SORTS).
//
// D35 · each row also carries the two words its option reads as in the header's sort panel
// (header.html: "Best fit · ats", "Newest · posted", "Salary · high", "Company · A–Z") — `short` the
// option, `tag` its small mono note. The labels above are unchanged; the panel reads these.
export const SORT_PANEL = Object.freeze([
  { value: "atsScore",   label: "Best fit",    subtitle: "Your strongest matches first.",
    tieBreak: ["newest first", "then company A–Z"], unscoredLast: true,  short: "Best fit", tag: "ats" },
  { value: "dateDesc",   label: "Newest",      subtitle: "Most recently posted first. Shows everything.",
    tieBreak: ["best fit first", "then company A–Z"], unscoredLast: false, short: "Newest", tag: "posted" },
  { value: "compHigh",   label: "Salary",      subtitle: "Highest stated pay first; no stated pay sorts last.",
    tieBreak: ["newest first", "then company A–Z"], unscoredLast: false, short: "Salary", tag: "high" },
  { value: "companyAsc", label: "Company A–Z", subtitle: "Alphabetical by company.",
    tieBreak: ["newest first"], unscoredLast: false, short: "Company", tag: "A–Z" },
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

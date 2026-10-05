// ── D24 · THE SENTENCE AND THE SORT PANEL, AS DATA ─────────────────────────────────────────────────
//
// Everything the filter sentence and the sort panel SAY, derived from shared/filterSentence.js (the
// contract the server half builds to) and nothing else. No option value, label or param name is
// written here: the clauses come from SENTENCE_CLAUSES, their options from each clause's `dim`, the
// sort rows from SORT_PANEL. That is jobFilterOptions.js's rule 2 ("no literal option value anywhere
// else"), and test/d24FilterSentenceClient.test.js holds this file to it.
//
// Plain functions with no React in them, so the decisions — what a token reads, which option is
// dimmed, which one warns that it would empty the board, what the footer promises — are tested
// directly in node rather than through a screenshot.
//
// ⛔ NO FAKE NUMBERS. Every count comes from GET /api/jobs/facets. When that answer is missing (the
// endpoint 404s until the server half lands, or the request failed) the rows carry `count: null`, the
// footer drops its number, and nothing is dimmed or warned about — "unknown" is never drawn as zero.
import {
  SENTENCE_CLAUSES, SENTENCE_CAP, SORT_PANEL, wouldEmpty, activeClauseCount,
  OPEN_SET_CLAUSES, chosenValues, slotText, sentenceParts, sentenceText,
} from "../../../shared/filterSentence.js";
import { SORTS } from "../../../shared/jobFilterOptions.js";

export { SENTENCE_CLAUSES, SENTENCE_CAP, SORT_PANEL, activeClauseCount, OPEN_SET_CLAUSES, slotText, sentenceParts, sentenceText };

// ── The two panels behind the two icons ─────────────────────────────────────────────────────────
//
// ⛔ BOTH CLOSED BY DEFAULT, and MUTUALLY EXCLUSIVE: one state, not two booleans, so "both open" is
// not a value the board can hold. Pressing the open one closes it; pressing the other swaps.
export const BOARD_PANEL = Object.freeze({ FILTER: "filter", SORT: "sort" });
export const BOARD_PANEL_DEFAULT = null;
export const nextBoardPanel = (current, pressed) => (current === pressed ? null : pressed);

// ── D30 · The dials ─────────────────────────────────────────────────────────────────────────────
//
// SIX DIALS, ALL ALWAYS VISIBLE, each with its dimension, its current value and its count. The
// sentence above them is derived from the same params (shared/filterSentence.js sentenceParts), so
// the readable headline and the complete inventory cannot disagree.
export const sentenceClauses = () => SENTENCE_CLAUSES;

/** The values chosen in a clause, always as an array ("" and null are "nothing chosen"). */
export const clauseSelection = (clause, params = {}) => chosenValues(clause, params);

/** The options a clause offers — the dimension's own, minus its empty "any" entry. */
export const clauseOptions = (clause) => clause.dim.options.filter(o => o.value !== "");

/** Is this an OPEN set (domain, location) — a picker, not an inline row of every option? */
export const isOpenSet = (clause) => OPEN_SET_CLAUSES.includes(clause.key);

/** What a dial's value reads: the chosen labels, or "no filter". The floor reads as the floor. */
export function dialValue(clause, params) {
  const chosen = clauseSelection(clause, params);
  if (!chosen.length) return clause.floor ? "United States" : "no filter";
  const labels = chosen.map(v => clause.dim.options.find(o => o.value === v)?.label ?? v);
  if (clause.key === "domain" && clauseOptions(clause).every(o => chosen.includes(o.value))) return "All";
  return labels.length <= 2 ? labels.join(" or ") : `${labels[0]} +${labels.length - 1}`;
}

/** Kept for the D24 tests' vocabulary: a clause's token text is its slot text now. */
export const tokenText = (clause, params, opts) => slotText(clause, params, opts).text;

/**
 * The params patch for pressing `value` in `clause`. A multi clause toggles the value in its list;
 * a single clause (posted) sets it, or clears it when it is already the choice.
 */
export function pressOption(clause, params, value) {
  const chosen = clauseSelection(clause, params);
  if (clause.dim.multi) {
    const next = chosen.includes(value) ? chosen.filter(v => v !== value) : [...chosen, value];
    return { [clause.dim.param]: next };
  }
  return { [clause.dim.param]: chosen[0] === value ? "" : value };
}

/** The params patch that returns a clause to its default — for location, the US floor. */
export const clearClause = (clause) => ({ [clause.dim.param]: clause.dim.multi ? [] : "" });

/** Domain's "every kind of work": choose every function, which lifts the profile's role scope. */
export const allDomainsPatch = (clause) => ({ [clause.dim.param]: clauseOptions(clause).map(o => o.value) });

/** The patch that clears every clause. */
export const clearAllClauses = () =>
  Object.assign({}, ...sentenceClauses().map(clearClause));

// What an unclassified row is missing, per clause — prose for the "kept, not hidden" note.
const UNKNOWN_NOUN = {
  domain: "kind of work", level: "level", location: "city or state", where: "work arrangement",
  posted: "posting date", fit: "score",
};

/**
 * One dial's options, each with its count from the facets answer.
 *
 *   count / known  — straight from the FacetOption; null when there is no facets answer.
 *   unclassified   — count − known: rows kept only because their tag is not on file.
 *   dimmed         — ⛔ a zero-count option is DIMMED, NOT HIDDEN. It is still a row, still pressable.
 *   empties        — ⛔ pressing it would empty the board, so the row says so BEFORE it is pressed.
 */
export function optionRows(clause, params, facets) {
  const chosen = clauseSelection(clause, params);
  const answered = facetsUsable(facets);
  const list = answered ? (facets.clauses?.[clause.key] || []) : [];
  return clauseOptions(clause).map(o => {
    const selected = chosen.includes(o.value);
    if (!answered) {
      return { value: o.value, label: o.label, selected, count: null, known: null,
               unclassified: 0, dimmed: false, empties: false, note: null };
    }
    const fo = list.find(f => f.value === o.value);
    const count = Number.isFinite(fo?.count) ? fo.count : 0;
    const known = Number.isFinite(fo?.known) ? Math.min(fo.known, count) : count;
    const unclassified = Math.max(0, count - known);
    const widensOr = clause.dim.multi && chosen.length > 0;
    const empties = !selected && !widensOr && wouldEmpty(fo);
    return {
      value: o.value, label: o.label, selected, count, known, unclassified,
      dimmed: count === 0,
      empties,
      note: empties ? "Would show no jobs" : null,
    };
  });
}

/**
 * ⛔ THIN COVERAGE IS SAID ON THE DIAL, NEVER IN THE SENTENCE (D30): "3 have no level on file — kept,
 * not hidden". The rows kept as unknown are the same rows for every option of a dimension (their tag
 * is NULL), so the chosen option's gap — or, with nothing chosen, the first option's — is the number.
 * null when there is no answer or nothing is unknown.
 */
export function coverageNote(clause, params, facets) {
  if (!facetsUsable(facets) || clause.key === "posted" || clause.key === "fit") return null;
  const rows = optionRows(clause, params, facets);
  const chosen = rows.filter(r => r.selected);
  const pick = (chosen.length ? chosen : rows).reduce((m, r) => (r.unclassified > (m?.unclassified ?? -1) ? r : m), null);
  const n = pick?.unclassified ?? 0;
  if (!n) return null;
  return `${n} ${n === 1 ? "has" : "have"} no ${UNKNOWN_NOUN[clause.key] ?? "value"} on file — kept, not hidden`;
}

/**
 * A dial's face: LEVEL · Senior · 674 jobs. The count is the board as it stands (the dial's own choice
 * included) when the dial is set; an unset dial reads "no filter" and carries no number of its own.
 */
export function dialSummary(clause, params, facets) {
  const active = clauseSelection(clause, params).length > 0;
  return {
    key: clause.key, label: clause.label, value: dialValue(clause, params), active,
    count: active && facetsUsable(facets) ? facets.total : null,
    note: coverageNote(clause, params, facets),
  };
}

/** Is this a facets answer the UI may draw numbers from? Anything else draws none. */
export function facetsUsable(facets) {
  return !!facets && Number.isFinite(facets.total) && !!facets.clauses && typeof facets.clauses === "object";
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The line under the sentence. With no facets answer it promises no number. */
export function footerText(facets) {
  return facetsUsable(facets)
    ? `${plural(facets.total, "job matches", "jobs match")} — tap any dial to change it`
    : "Tap any dial to change it";
}

// ── The sort panel ──────────────────────────────────────────────────────────────────────────────

// THE DEFAULT ORDER IS NOT A SORT VALUE (D24 server half, 45f0f27). GET /api/jobs with NO `sort`
// returns the CURATED board — the profile's relevance and fit first. An explicit `sort=dateDesc` now
// means truly newest-first. So the board's default state sends no sort at all (sortBy === ""), and
// this row — first in the panel — is the visible way back to it: choosing it clears the param.
// Its value is the empty string, i.e. "no sort param", not a value GET /api/jobs validates.
export const DEFAULT_SORT = "";
export const DEFAULT_SORT_ROW = Object.freeze({
  value: DEFAULT_SORT, label: "For you",
  subtitle: "Your profile's relevance and fit first — the board's default.",
  tieBreak: [], unscoredLast: false, isDefault: true,
});

/** Is a non-default order chosen? The sort icon shows it without opening anything. */
export const isSortChosen = (sortBy) => !!sortBy && sortBy !== DEFAULT_SORT;

/**
 * The sort panel's rows: the default first, then SORT_PANEL — minus Best fit when there is nothing to
 * rank by (no résumé), the rule since 09-26.
 */
export const sortRows = (atsAvailable = true) =>
  [DEFAULT_SORT_ROW, ...SORT_PANEL.filter(o => atsAvailable || !o.unscoredLast)];

/** ⭐ The tie-break, VISIBLE: "Ties broken by: newest first, then company A–Z". */
export const tieBreakText = (row) => (row.tieBreak?.length ? `Ties broken by: ${row.tieBreak.join(", ")}` : "");

/** Under Best fit: how many jobs have no score, and where they go. No number without an answer. */
export function unscoredText(facets) {
  const newest = SORT_PANEL.find(o => !o.unscoredLast && /everything/i.test(o.subtitle))?.label;
  const tail = newest ? ` — ${newest} shows everything` : "";
  if (facetsUsable(facets) && Number.isFinite(facets.unscored)) {
    return `${plural(facets.unscored, "job has", "jobs have")} no score and sort${facets.unscored === 1 ? "s" : ""} last${tail}`;
  }
  return `Jobs with no score sort last${tail}`;
}

// ── A cached board from before D24 reopens CURATED, not Newest ──────────────────────────────────
//
// Before D24 the client always sent sort=dateDesc and the server answered with the CURATED order
// (profile relevance and fit first), so every cached view snapshot holds sortBy "dateDesc" whether
// or not anyone chose Newest. D24 made an explicit dateDesc truly newest-first and moved the curated
// order to "no sort param". Read literally, every returning user's board would silently flip to
// Newest. So a snapshot carries SORT_SEMANTICS; one without it predates D24, and its "dateDesc"
// meant the curated default. A snapshot written after D24 is taken at its word — a user who picks
// Newest keeps Newest.
export const SORT_SEMANTICS = 2;
export function sortFromCachedSnapshot(snapshot) {
  const sortBy = snapshot?.sortBy || "";
  // SORTS.default is what every pre-D24 client sent on every request (it is "dateDesc").
  if (snapshot?.sortSemantics !== SORT_SEMANTICS && sortBy === SORTS.default) return "";
  return sortBy;
}

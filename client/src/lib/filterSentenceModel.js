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
} from "../../../shared/filterSentence.js";
import { SORTS } from "../../../shared/jobFilterOptions.js";

export { SENTENCE_CLAUSES, SENTENCE_CAP, SORT_PANEL, activeClauseCount };

// ── The two panels behind the two icons ─────────────────────────────────────────────────────────
//
// ⛔ BOTH CLOSED BY DEFAULT, and MUTUALLY EXCLUSIVE: one state, not two booleans, so "both open" is
// not a value the board can hold. Pressing the open one closes it; pressing the other swaps.
export const BOARD_PANEL = Object.freeze({ FILTER: "filter", SORT: "sort" });
export const BOARD_PANEL_DEFAULT = null;
export const nextBoardPanel = (current, pressed) => (current === pressed ? null : pressed);

// ── The clauses ─────────────────────────────────────────────────────────────────────────────────
//
// ⛔ THE CAP IS ENFORCED HERE, not merely documented: the sentence renders at most SENTENCE_CAP
// clauses, so a fifth added to the contract without revisiting the decision does not quietly turn
// the sentence into a run-on.
export const sentenceClauses = () => SENTENCE_CLAUSES.slice(0, SENTENCE_CAP);

/** The values chosen in a clause, always as an array ("" and null are "nothing chosen"). */
export function clauseSelection(clause, params = {}) {
  const v = params[clause.dim.param];
  if (Array.isArray(v)) return v.filter(x => x != null && x !== "");
  return v == null || v === "" ? [] : [String(v)];
}

/** The options a clause offers — the dimension's own, minus its empty "any" entry. */
export const clauseOptions = (clause) => clause.dim.options.filter(o => o.value !== "");

const labelOf = (clause, value) =>
  clause.dim.options.find(o => o.value === value)?.label ?? String(value);

// "posted Past week" is not a sentence. The posting-age labels are written as menu items, so the
// prose lower-cases them; every other clause's labels are nouns that read as written ("Senior",
// "Remote", "Strong").
const proseCase = (clause, text) => (clause.dim.derivedParam ? text.toLowerCase() : text);

/** What a clause's token reads: the chosen labels joined with "or", or the clause's `any`. */
export function tokenText(clause, params) {
  const chosen = clauseSelection(clause, params);
  if (!chosen.length) return clause.any;
  const words = chosen.map(v => proseCase(clause, labelOf(clause, v)));
  return words.length <= 2 ? words.join(" or ") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;
}

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

/** The params patch that returns a clause to "any". */
export const clearClause = (clause) => ({ [clause.dim.param]: clause.dim.multi ? [] : "" });

/** The patch that clears every clause. */
export const clearAllClauses = () =>
  Object.assign({}, ...sentenceClauses().map(clearClause));

// What an unclassified row is missing, per clause — prose for the "kept, not hidden" note. Keyed by
// the clause's own key; it names a column in plain words and carries no option value.
const UNKNOWN_NOUN = { level: "level", where: "work arrangement", posted: "posting date", fit: "score" };

/**
 * The popover's rows for one clause, each with its count from the facets answer.
 *
 *   count / known  — straight from the FacetOption; null when there is no facets answer.
 *   unclassified   — count − known: rows kept only because their column is not classified yet.
 *   dimmed         — ⛔ a zero-count option is DIMMED, NOT HIDDEN. It is still a row, still pressable.
 *   empties        — ⛔ pressing it would empty the board, so the row says so BEFORE it is pressed.
 *                    Only for an option that is not already chosen, and not when it would be ADDED
 *                    to a multi clause that already has a choice: that widens an OR, it cannot empty.
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
      note: empties
        ? "Would show no jobs"
        : unclassified > 0
          ? `${unclassified} ${unclassified === 1 ? "has" : "have"} no ${UNKNOWN_NOUN[clause.key] ?? "value"} on file yet — kept, not hidden`
          : null,
    };
  });
}

/** Is this a facets answer the UI may draw numbers from? Anything else draws none. */
export function facetsUsable(facets) {
  return !!facets && Number.isFinite(facets.total) && !!facets.clauses && typeof facets.clauses === "object";
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The line under the sentence. With no facets answer it promises no number. */
export function footerText(facets) {
  return facetsUsable(facets)
    ? `${plural(facets.total, "job matches", "jobs match")} — tap any word to change it`
    : "Tap any word to change it";
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

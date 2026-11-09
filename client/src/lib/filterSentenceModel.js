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
  OPEN_SET_CLAUSES, chosenValues, slotText, sentenceParts, sentenceText, panelWord, panelAnyWord, LOCATION_REMOTE, TECHNOLOGY,
} from "../../../shared/filterSentence.js";
import { SORTS, POSTING_AGE } from "../../../shared/jobFilterOptions.js";

export { SENTENCE_CLAUSES, SENTENCE_CAP, SORT_PANEL, activeClauseCount, OPEN_SET_CLAUSES, slotText, sentenceParts, sentenceText, TECHNOLOGY };

// ── D35 · ONE PANEL, OPENED BY A WORD ────────────────────────────────────────────────────────────
//
// The filter icon and its drawer are GONE (D35 §1): the words of the sentence are the controls, and
// each opens ONE shared panel beneath the sentence. The sort square opens the sort panel beneath the
// bar. ⛔ ONE value holds which is open — null | a clause key | "more" (the sentence's "+ add") |
// "sort" — so two open panels is not a state the board can hold, and the sentence never jumps as
// panels stack. Pressing the open one closes it; pressing another swaps.
// ⭐ A146 (45o, the D179 sketch's (b)): ALL = "All filters" — every clause's options at once, in place under the sentence.
export const BOARD_PANEL = Object.freeze({ SORT: "sort", MORE: "more", ALL: "all" });
export const BOARD_PANEL_DEFAULT = null;
/** ⭐ D42 · THE STRICT TOGGLE's param: "only jobs known to be in Boston" — known matches, no unknowns. */
export const STRICT_PARAM = "strict_tags";
export const isStrict = (params = {}) => ["1", "true", true, 1].includes(params[STRICT_PARAM]);
export const nextBoardPanel = (current, pressed) => (current === pressed ? null : pressed);
/** Is this panel one the SENTENCE opens (a clause's, or "+ add"'s) — rendered beneath the sentence? */
export const isWordPanel = (panel) =>
  panel === BOARD_PANEL.MORE || panel === BOARD_PANEL.ALL || SENTENCE_CLAUSES.some(c => c.key === panel);

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
 * ⛔ THIN COVERAGE IS SAID IN THE PANEL, NEVER IN THE SENTENCE (D30, D35 §5). The rows kept as unknown
 * are the same rows for every option of a dimension (their tag is NULL), so the chosen option's gap —
 * or, with nothing chosen, the largest — is the number. 0 when there is no answer or none is unknown.
 */
export function unclassifiedCount(clause, params, facets) {
  if (!facetsUsable(facets) || clause.key === "posted" || clause.key === "fit") return 0;
  const rows = optionRows(clause, params, facets);
  const chosen = rows.filter(r => r.selected);
  return (chosen.length ? chosen : rows).reduce((m, r) => Math.max(m, r.unclassified), 0);
}

/** Is this a facets answer the UI may draw numbers from? Anything else draws none. */
export function facetsUsable(facets) {
  return !!facets && Number.isFinite(facets.total) && !!facets.clauses && typeof facets.clauses === "object";
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** 47.5 · 7.7 · 100 — one decimal, none when it is whole. */
export const percent = (part, whole) => {
  const p = Math.round((part / whole) * 1000) / 10;
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
};
/** Of the board as it stands, the share of rows whose `tag` is on file — LIVE, from facets.coverage. */
export function coverageShare(facets, tag) {
  const n = facets?.coverage?.[tag];
  return facetsUsable(facets) && Number.isFinite(n) && facets.total > 0 ? percent(n, facets.total) : null;
}

// ── D35 · what one word's panel holds ──────────────────────────────────────────────────────────
//
// header.html's panel: a key (LEVEL), "Close ×", the options as boxed pills with their counts, and one
// line of coverage under them. Every word, count and coverage figure is derived here.
export const panelKey = (panel) =>
  panel === BOARD_PANEL.MORE ? "Add a filter" : panel === BOARD_PANEL.ALL ? "All filters"
    : (SENTENCE_CLAUSES.find(c => c.key === panel)?.label ?? "");

/**
 * The pills of a clause's panel. FIRST the clause's "nothing chosen" pill — location's is the United
 * States itself, the floor — with the board's count when it is the current choice; for domain, then
 * "all" (every function, which lifts the profile's scope); then every option of the dimension.
 *
 *   dimmed    ⛔ a zero-count option is DIMMED AND NOT SELECTABLE, NEVER HIDDEN (D35 §7 test 6): it keeps
 *             its place and its 0. One already chosen stays pressable — pressing it removes it.
 *   disabled  dimmed and not already chosen: the press does nothing (aria-disabled, still focusable).
 */
export function panelRows(clause, params, facets, _opts = {}) {
  const usable = facetsUsable(facets);
  const chosen = clauseSelection(clause, params);
  const none = chosen.length === 0;
  const strict = isStrict(params);
  // ⛔ D42: domain's "nothing chosen" pill is "all" — engineering + data for an engineering profile —
  // and there is no second "every function" pill: lifting the scope to sales and legal is not a view
  // anyone asked for.
  const rows = [{ kind: "any", value: "", label: panelAnyWord(clause), selected: none,
                  count: none && usable ? facets.total : null, dimmed: false, disabled: false, note: null }];
  // ⛔ D153 (2) · REMOTE (US), ONCE, IN THE LOCATION PANEL. A remote posting names no city, so it is in no place's
  // count (each number is the postings that LIST that place); it is counted here, once, from the workplace facet.
  // Pressing it is "anywhere in the US, remote": the place choice clears and the workplace becomes remote.
  if (clause.key === "location") {
    const whereClause = SENTENCE_CLAUSES.find(c => c.key === LOCATION_REMOTE.clause);
    const wp = whereClause ? clauseSelection(whereClause, params) : [];
    const remoteOnly = wp.length === 1 && wp[0] === LOCATION_REMOTE.value;
    const fo = usable ? (facets.clauses?.[LOCATION_REMOTE.clause] || []).find(f => f.value === LOCATION_REMOTE.value) : null;
    const known = fo && Number.isFinite(fo.known) ? fo.known : fo && Number.isFinite(fo.count) ? fo.count : null;
    rows.push({ kind: "remote-us", value: LOCATION_REMOTE.value, label: LOCATION_REMOTE.label, selected: none && remoteOnly,
      count: none ? known : null, dimmed: false, disabled: false, note: null });
  }
  // A zero sinks to the end of the row (header.html: intern, at 0, after lead) — dimmed, never dropped.
  const opts = optionRows(clause, params, facets);
  for (const r of [...opts.filter(o => !o.dimmed), ...opts.filter(o => o.dimmed)]) {
    // ⛔⛔ D153 (2) (owner 11-04: "the filters are way off … the workplace says 52,000, and then remote 38,000, and then
    // hybrid 36,000"): an option's number is its KNOWN matches only, strict or not. `count` adds every posting whose
    // value is unknown (9,672 engineering + 43,009 unknown = the 52,681 shown), so the options summed to twice the
    // board. The unknowns are said once, in the panel's note ("N postings have no kind of work on file — kept").
    const count = r.known != null ? r.known : r.count;
    rows.push({ kind: "option", value: r.value, label: panelWord(clause, r.value), selected: r.selected,
      count, dimmed: r.dimmed, disabled: r.dimmed && !r.selected,
      note: r.dimmed && !r.selected ? "Would show no jobs" : null });
  }
  // ⭐ D42 · THE STRICT TOGGLE, once something is chosen in a clause that keeps unknowns.
  if (!none && STRICT_CLAUSES.includes(clause.key)) {
    rows.push({ kind: "strict", value: STRICT_PARAM, label: strictLabel(clause, params), selected: strict,
      count: null, dimmed: false, disabled: false, note: null });
  }
  return rows;
}

/** The clauses whose filter keeps rows with no tag on file — the ones a strict toggle changes. */
export const STRICT_CLAUSES = Object.freeze(["domain", "level", "location", "where"]);

const chosenWords = (clause, params) => or(clauseSelection(clause, params).map(v => panelWord(clause, v)));
/** "only jobs known to be in Boston" · "only jobs known to be finance" · "…to be remote". */
export function strictLabel(clause, params) {
  const w = chosenWords(clause, params);
  return clause.key === "location" ? `only jobs known to be in ${w}` : `only jobs known to be ${w}`;
}
const or = (words) => words.length <= 2 ? words.join(" or ") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`;

/** The params patch a pill's press makes — or null when it is not selectable. */
export function panelPress(clause, params, row) {
  if (row.disabled) return null;
  if (row.kind === "any") return clearClause(clause);
  if (row.kind === "all") return allDomainsPatch(clause);
  if (row.kind === "strict") return { [STRICT_PARAM]: row.selected ? "" : "1" };
  if (row.kind === "remote-us") {
    const whereClause = SENTENCE_CLAUSES.find(c => c.key === LOCATION_REMOTE.clause);
    const off = whereClause.dim.multi ? [] : "";
    const on = whereClause.dim.multi ? [LOCATION_REMOTE.value] : LOCATION_REMOTE.value;
    return { ...clearClause(clause), [whereClause.dim.param]: row.selected ? off : on };
  }
  return pressOption(clause, params, row.value);
}

/**
 * The line under a panel's options — D35 §5's copy, its figures LIVE from GET /api/jobs/facets (never
 * the row's literal 47.5% / 3 / 7.7%, which were one day's measurement). null when there is nothing
 * honest to say.
 */
export function panelNote(panel, params, facets) {
  const usable = facetsUsable(facets);
  // ⭐ D42 · SAY EXACTLY WHAT HAPPENED: "1 in Boston · 32 with no city on file, shown after." A count that
  // blends the two is the lie. From the chosen option's own facet (known vs count), so one choice only.
  const split = knownSplit(panel, params, facets);
  if (split) return split;
  // D153 (2): a place's number is the postings that LIST it — one that lists two cities counts in both — and a remote
  // role with no city is counted once, under Remote (US).
  if (panel === "location") return `The United States is the floor — it can be narrowed, never cleared. Each number is the postings that list that place; remote roles with no city are under ${LOCATION_REMOTE.label}.`;
  if (panel === "where") {
    const p = coverageShare(facets, "where");
    return p == null ? null : `${p}% coverage — postings with no workplace on file are kept, not hidden.`;
  }
  if (panel === "level") {
    const known = facets?.coverage?.level;
    if (!usable || !Number.isFinite(known)) return null;
    const n = Math.max(0, facets.total - known);
    return n ? `${plural(n, "posting has", "postings have")} no level on file — kept, not hidden.` : null;
  }
  if (panel === "domain") {
    const clause = SENTENCE_CLAUSES.find(c => c.key === "domain");
    const n = unclassifiedCount(clause, params, facets);
    return n ? `${plural(n, "posting has", "postings have")} no kind of work on file — kept, not hidden.` : null;
  }
  if (panel === "fit") {
    return usable && Number.isFinite(facets.unscored) && facets.unscored > 0
      ? `${plural(facets.unscored, "job has", "jobs have")} no ATS score yet — no fit band can show ${facets.unscored === 1 ? "it" : "them"}.`
      : null;
  }
  if (panel === BOARD_PANEL.MORE) {
    const p = coverageShare(facets, "employment");
    return p == null
      ? "Employment type is not on file for enough postings to carry a filter yet."
      : `Employment type is at ${p}% coverage and cannot carry a filter yet.`;
  }
  return null;
}

const UNKNOWN_PHRASE = {
  domain: "no kind of work on file", level: "no level on file", location: "no city on file",
  where: "no workplace on file",
};
/**
 * D42 · "N in Boston · M with no city on file, shown after." — or, under the strict toggle, "N known to
 * be in Boston; postings with no city on file are left out." null when nothing (or more than one value)
 * is chosen, or there is no answer: a blended figure is not said.
 */
export function knownSplit(panel, params, facets) {
  const clause = SENTENCE_CLAUSES.find(c => c.key === panel);
  if (!clause || !STRICT_CLAUSES.includes(panel) || !facetsUsable(facets)) return null;
  const chosen = clauseSelection(clause, params);
  if (chosen.length !== 1) return null;
  const row = optionRows(clause, params, facets).find(r => r.value === chosen[0]);
  if (!row || row.count == null) return null;
  const word = panel === "location" ? `in ${panelWord(clause, chosen[0])}` : panelWord(clause, chosen[0]);
  if (isStrict(params)) return `${row.known} known to be ${word} — postings with ${UNKNOWN_PHRASE[panel]} are left out.`;
  return row.unclassified
    ? `${row.known} ${word} · ${row.unclassified} with ${UNKNOWN_PHRASE[panel]}, shown after.`
    : `${row.known} ${word}.`;
}

/**
 * "+ add" — what is available to add. The two clauses that are not in the sentence until set (posted,
 * fit) open their own panel; "salary & more" opens the drawer of the filters that are not words;
 * employment type is listed, DIMMED AND NOT SELECTABLE, because at its coverage it cannot carry one.
 */
export function addRows(params, { otherFilterCount = 0 } = {}) {
  const optional = SENTENCE_CLAUSES.filter(c => !c.permanent).map(c => ({
    kind: "clause", key: c.key, label: c.label.toLowerCase(),
    selected: clauseSelection(c, params).length > 0, disabled: false, dimmed: false,
  }));
  return [
    ...optional,
    { kind: "drawer", key: "drawer", label: otherFilterCount > 0 ? `salary & more · ${otherFilterCount} on` : "salary & more", selected: otherFilterCount > 0, disabled: false, dimmed: false },
    { kind: "employment", key: "employment", label: "employment type", selected: false, disabled: true, dimmed: true },
  ];
}

/** The four views' counts for the bar's segment — ALL · ★ · /d · + (D40). null where unmeasured, never 0. */
export function viewCounts(facets) {
  const v = facetsUsable(facets) ? facets.views : null;
  const n = (x) => (Number.isFinite(x) ? x : null);
  return { all: n(v?.all), saved: n(v?.saved), pending: n(v?.pending), imported: n(v?.imported) };
}

/**
 * ⭐ D147 · the board's minimal counts — jobs · new today · saved. `jobs` and `saved` are the views' counts; `newToday` is
 * the Posted clause's "Past 24h" count (the same filters, the age replaced). null when the answer does not hold it.
 */
export function boardCounts(facets) {
  const v = viewCounts(facets);
  // The one-day option, read off the contract (never a literal value here).
  const day = POSTING_AGE.options.find(o => o.days === 1)?.value;
  const posted = facetsUsable(facets) && day ? (facets.clauses?.posted || []).find(o => o.value === day) : null;
  return { jobs: v.all, newToday: Number.isFinite(posted?.count) ? posted.count : null, saved: v.saved };
}

// ── The sort panel ──────────────────────────────────────────────────────────────────────────────

// THE DEFAULT ORDER IS NOT A SORT VALUE (D24 server half, 45f0f27). GET /api/jobs with NO `sort`
// returns the CURATED board — the profile's relevance and fit first. An explicit `sort=dateDesc` now
// means truly newest-first. So the board's default state sends no sort at all (sortBy === ""), and
// this row — first in the panel — is the visible way back to it: choosing it clears the param.
// Its value is the empty string, i.e. "no sort param", not a value GET /api/jobs validates.
export const DEFAULT_SORT = "";
export const DEFAULT_SORT_ROW = Object.freeze({
  value: DEFAULT_SORT, label: "For you", short: "For you", tag: "yours",
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

/**
 * Under the sort options (D35 §5, header.html): "537 jobs have no ATS score yet, so they sort last
 * whatever you pick. Newest shows everything." — the number from facets' `unscored`, never a guess.
 * Returns the sentence and the order that shows everything, so the caller can set that word in bold.
 */
export function unscoredParts(facets) {
  const newest = SORT_PANEL.find(o => !o.unscoredLast && /everything/i.test(o.subtitle))?.short ?? null;
  const lead = facetsUsable(facets) && Number.isFinite(facets.unscored)
    ? `${plural(facets.unscored, "job has", "jobs have")} no ATS score yet, so ${facets.unscored === 1 ? "it sorts" : "they sort"} last whatever you pick.`
    : "Jobs with no ATS score yet sort last whatever you pick.";
  return { lead, newest };
}
export function unscoredText(facets) {
  const { lead, newest } = unscoredParts(facets);
  return newest ? `${lead} ${newest} shows everything.` : lead;
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

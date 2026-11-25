// ⭐ D199 C2 / C4 (owner 11-25, 47h) · THE MARKET'S CONTROLS, BACK ON SCREEN — under the bearing sentence, inside its
// cartouche (the `Market` board): the search field + the sort, the filter chips row (each opens its word's panel in place),
// the active filters as removable chips + Clear all, and the stats box (FIT YOUR BEARING · NEW TODAY · FILED H-1B · STRONG
// FIT) that recounts for the bearing + filters + search and filters when a cell is tapped.
// ⛔ ONE STATE (d199SentenceAndChipsOneState): the chips are a projection of the SAME params the sentence projects
// (boardHeadline.params, JobsPanel's committed clauses), and every press writes back through the same onPatch — so changing
// a chip changes the sentence and the reverse. ⛔ ONE COUNTS SOURCE (d199StatsBoxFollowsFilters, A239): the box's numbers
// are marketFigures(boardHeadline.facets) — the /api/jobs/facets answer for the list's own querystring.
// Nothing invented (R2): a figure the answer doesn't carry is "—" with the reason for a screen reader, never a 0.
import { SENTENCE_CLAUSES, sentenceParts } from "../lib/filterSentenceModel.js";
import { POSTING_AGE, COMPANY_SPONSORSHIP } from "../../../shared/jobFilterOptions.js";
import { ATS_BAND } from "../../../shared/atsBands.js";

/** The filter chips row, in the board's order: the eight sentence words, then the drawer's two. */
export const MARKET_FILTERS = Object.freeze([
  { key: "domain", label: "Role" },
  { key: "level", label: "Level" },
  { key: "where", label: "Workstyle" },
  { key: "location", label: "Location" },
  { key: "posted", label: "Posted" },
  { key: "fit", label: "Fit" },
  { key: "sponsorship", label: "Sponsorship" },
  { key: "tech", label: "Technology" },
  { key: "more", label: "Salary & more", drawer: true },
  // the drawer holds Employment Type (Full-time · Contract · Internship · Part-time); the sentence has no word for it
  { key: "employment", label: "Employment type", drawer: true },
]);

const CLAUSE = Object.fromEntries(SENTENCE_CLAUSES.map((c) => [c.key, c]));
const empty = (c) => (c.dim.multi ? [] : "");

/** Pure: the patch that removes one sentence word's choice (the role clears its category / subcategory too). */
export function removePatch(key) {
  const c = CLAUSE[key];
  if (!c) return null;
  const p = { [c.dim.param]: empty(c) };
  if (key === "domain") Object.assign(p, { category: "", subcategory: "" });
  return p;
}

/**
 * Pure: the chips row — one per MARKET_FILTERS entry: { key, label, text, active, drawer }. A word's chip is active when the
 * sentence holds a choice for it (the location's floor, "the United States", is not a choice); its label then reads the
 * sentence's own words ("Level: senior"). The drawer's chip is active when the drawer has filters on (`otherFilterCount`).
 */
export function filterChips(params = {}, { otherFilterCount = 0 } = {}) {
  const { slots } = sentenceParts(params, {});
  const byKey = Object.fromEntries(slots.map((s) => [s.key, s]));
  return MARKET_FILTERS.map((f) => {
    if (f.drawer) {
      const on = f.key === "more" && otherFilterCount > 0;
      return { ...f, active: on, text: on ? `${otherFilterCount} on` : null };
    }
    const s = byKey[f.key];
    const active = !!s?.active;
    return { ...f, active, text: active ? s.text : null };
  });
}

/** Pure: the active chips (removable), the search first. Each { id, label, patch | null, query? }. */
export function activeChips(params = {}, { query = "", otherFilterCount = 0 } = {}) {
  const out = [];
  const q = String(query || "").trim();
  if (q) out.push({ id: "query", label: `Search: “${q}”`, query: true });
  for (const c of filterChips(params, { otherFilterCount })) {
    if (!c.active) continue;
    out.push({ id: c.key, label: `${c.label}: ${c.text}`, patch: c.drawer ? null : removePatch(c.key), drawer: !!c.drawer });
  }
  return out;
}

/** The search + sort row: the board's own search (its grouped suggestions) and the sort, side by side. */
export function MarketSearchRow({ search, sort }) {
  return (
    <div className="pl-mk-searchrow" data-market-search="">
      <div className="pl-mk-search">{search}</div>
      {sort}
    </div>
  );
}

/** The sort control: "SORT  Best match ▾" — it opens the board's one sort panel (the code's five orders, D199 C2). */
export function MarketSortButton({ label = "Best match", open = false, chosen = false, onPress }) {
  return (
    <button type="button" className="pl-mk-sort" data-board-icon="sort" data-active={chosen ? "true" : "false"}
      aria-haspopup="true" aria-expanded={open} aria-controls={open ? "fh-sort" : undefined}
      aria-label={`Sort: ${label} — change the order`} onClick={() => onPress?.()}>
      <span className="pl-label pl-muted" aria-hidden="true">SORT</span>
      <span className="pl-mk-sort__v">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

/**
 * The filter chips row + the active chips + Clear all. `open` = the board's one open panel key; `onOpen(key)` opens a word's
 * panel (WordPanel, in place beneath); `onMore()` opens the drawer; `onPatch` / `onClearQuery` / `onClearAll` write back.
 */
// `all` = { id, slot, open, onPress }: the board's "All filters" (every facet at once, A146) — kept as the row's last chip so
// nothing the classic board had is lost (D200 Rule 1); the `Market` board doesn't draw it.
export function MarketFilterRow({ params = {}, otherFilterCount = 0, query = "", open = null, onOpen, onMore, onPatch, onClearQuery, onClearAll, all = null }) {
  const chips = filterChips(params, { otherFilterCount });
  const active = activeChips(params, { query, otherFilterCount });
  return (
    <div className="pl-mk-filters" data-market-filters="">
      <div role="group" aria-label="Filters" className="pl-mk-chips">
        {chips.map((c) => {
          const expanded = !c.drawer && open === c.key;
          return (
            <button key={c.key} type="button" className="pl-mk-chip" data-filter={c.key}
              aria-pressed={c.active} aria-expanded={c.drawer ? undefined : expanded} aria-controls={expanded ? "fh-panel" : undefined}
              onClick={() => (c.drawer ? onMore?.() : onOpen?.(c.key))}>
              {c.active ? `${c.label}: ${c.text}` : c.label}
            </button>
          );
        })}
        {all ? <button type="button" className="pl-mk-chip" id={all.id} data-slot={all.slot} aria-expanded={!!all.open}
          aria-controls={all.open ? "fh-panel" : undefined} onClick={() => all.onPress?.()}>All filters</button> : null}
        {active.length ? <button type="button" className="pl-mk-clear" data-clear-all="" onClick={() => onClearAll?.()}>Clear all</button> : null}
      </div>
      {active.length ? (
        <ul className="pl-mk-active" aria-label="Filters in force" data-active-chips="">
          {active.map((a) => (
            <li key={a.id}>
              <span className="pl-mk-active__chip" data-active-chip={a.id}>
                <span>{a.label}</span>
                {a.drawer ? (
                  <button type="button" className="pl-mk-active__x" aria-label={`Change ${a.label}`} onClick={() => onMore?.()}>
                    <span aria-hidden="true">›</span></button>
                ) : (
                  <button type="button" className="pl-mk-active__x" aria-label={`Remove ${a.label}`}
                    onClick={() => (a.query ? onClearQuery?.() : onPatch?.(a.patch))}><span aria-hidden="true">×</span></button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── The stats box (C4) ─────────────────────────────────────────────────────────────────────────────

const DAY = POSTING_AGE.options.find((o) => o.days === 1)?.value || "1d";
const FILED = COMPANY_SPONSORSHIP.options[0].value;

/** Pure: is a cell's filter in force, from the params? */
export function statActive(key, params = {}) {
  const has = (param, v) => {
    const x = params[param];
    return Array.isArray(x) ? x.map(String).includes(String(v)) : String(x ?? "") === String(v);
  };
  if (key === "newToday") return has(POSTING_AGE.param, DAY);
  if (key === "filed") return has(COMPANY_SPONSORSHIP.param, FILED);
  if (key === "strong") return has("fit_bands", ATS_BAND.STRONG);
  return false;
}

/** Pure: the patch a cell's tap applies — on when off, off when on. FIT YOUR BEARING has no filter of its own. */
export function statPatch(key, params = {}) {
  const on = statActive(key, params);
  if (key === "newToday") return { [POSTING_AGE.param]: on ? "" : DAY };
  if (key === "filed") return { [COMPANY_SPONSORSHIP.param]: on ? "" : FILED };
  if (key === "strong") {
    const cur = Array.isArray(params.fit_bands) ? params.fit_bands.map(String) : [];
    return { fit_bands: on ? cur.filter((v) => v !== ATS_BAND.STRONG) : [ATS_BAND.STRONG] };
  }
  return null;
}

/** Pure: the four cells, in the board's order. value null = the answer doesn't carry it (drawn "—", never 0). */
export function statsCells(figures = {}, params = {}) {
  const n = (v) => (Number.isFinite(v) ? v : null);
  return [
    { key: "fit", label: "FIT YOUR BEARING", value: n(figures.fit), active: false },
    { key: "newToday", label: "NEW TODAY", value: n(figures.newToday), active: statActive("newToday", params) },
    { key: "filed", label: "FILED H-1B", value: n(figures.filed), active: statActive("filed", params) },
    { key: "strong", label: "STRONG FIT", value: n(figures.strong), active: statActive("strong", params) },
  ];
}

/**
 * The stats box: the hero's four cells, the same look, now under the filters. A tap on NEW TODAY / FILED H-1B / STRONG FIT
 * applies (or lifts) its filter through `onPatch`; FIT YOUR BEARING scrolls to the openings it counts (every cell answers,
 * D200 Rule 2). An active cell is ink-filled.
 */
export function MarketStatsBox({ figures = {}, params = {}, onPatch, onShowAll, loading = false }) {
  const cells = statsCells(figures, params);
  return (
    <div className="pl-mk-statsbox" data-market-stats="">
      <div role="list" aria-label="Openings for your bearing and filters" className="pl-mk-stats" aria-busy={loading || undefined}>
        {cells.map((c) => (
          <button key={c.key} type="button" role="listitem" className="pl-mk-stat" data-stat={c.key} aria-pressed={c.key === "fit" ? undefined : c.active}
            aria-label={`${c.value == null ? "not counted yet" : c.value.toLocaleString("en-US")} ${c.label.toLowerCase()}${c.key === "fit" ? " — show them" : c.active ? " — tap to lift this filter" : " — tap to filter by it"}`}
            onClick={() => (c.key === "fit" ? onShowAll?.() : onPatch?.(statPatch(c.key, params)))}>
            <span className="pl-mk-stat__n">{c.value == null ? "—" : c.value.toLocaleString("en-US")}</span>
            <span className="pl-mk-stat__l">{c.label}</span>
          </button>
        ))}
      </div>
      <p className="pl-mk-statsnote">The same box as before, now counting only what your bearing, filters and search leave. Tap a number to filter by it.</p>
    </div>
  );
}

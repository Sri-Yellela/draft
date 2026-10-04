import { sortRows, tieBreakText, unscoredText } from "../lib/filterSentenceModel.js";
import "./BoardPanels.css";

// ── D24 · FULL HOUSE — THE SORT PANEL ───────────────────────────────────────────────────────────────
//
// Best fit · Newest · Salary · Company A–Z — shared/filterSentence.js's SORT_PANEL, each with its
// plain-words subtitle and ⭐ its tie-break VISIBLE ("Ties broken by: newest first, then company A–Z").
// A coarse score produces many ties, and they used to fall to insertion order silently.
//
// Under Best fit it says plainly how many jobs have no score and sort last whatever is picked — with
// Newest named as the order that shows everything. The number is GET /api/jobs/facets' `unscored`;
// without that answer the line says the same thing with no number, never a guessed one.
//
// FIRST, "For you": the board's default, curated order, which is NO sort param at all (D24 server
// half: an explicit sort=dateDesc means truly newest-first now). Choosing it clears the param.
//
// Best fit is not offered without a résumé (decided 2026-09-26): with nothing to rank by it would sort
// on a score that is null for every row.
export default function SortPanel({ value, onChange, atsAvailable = true, facets = null, facetsStatus = "idle" }) {
  const rows = sortRows(atsAvailable);
  const counted = facetsStatus === "ready" || facetsStatus === "loading" ? facets : null;
  return (
    <section className="bp sp" aria-label="Sort" data-board-panel="sort">
      <div className="sp__list" role="radiogroup" aria-label="Sort jobs by">
        {rows.map(r => {
          const on = r.value === value;
          return (
            <button key={r.value} type="button" role="radio" aria-checked={on} className="sp__row"
              onClick={() => onChange?.(r.value)}>
              <span className="sp__label">{r.label}</span>
              <span className="sp__sub">{r.subtitle}</span>
              {tieBreakText(r) && <span className="sp__tie">{tieBreakText(r)}</span>}
              {r.unscoredLast && <span className="sp__unscored">{unscoredText(counted)}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

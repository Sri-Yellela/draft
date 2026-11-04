import "./ApplicationTracker.css";
import CompanyBubble from "./CompanyBubble.jsx";
import { TRACKER_FILTERS, TRACKER_COUNTS, TRACKER_COLUMNS, TRACKER_PANES, TRACKER_PERIODS } from "../lib/trackerRows.js";
import { ringVar } from "../styles/rings.js";

// ============================================================
// ApplicationTracker — D146's table: plain rows and columns, a row opens IN PLACE (owner 11-03)
// ============================================================
// Draft House and The Table, merged. What each row SAYS is lib/trackerRows.js (one pure function); this file only
// draws it, and every piece of state is a prop, so it renders the same in a test as on the page.
//   · ONE row of counts (D145's minimal style) · the filters, the search and the period in one row.
//   · Position (company bubble + company + role) · Résumé · Answers · Status (a quiet dot + a word, ⛔ never a
//     capsule — D60) · When. Sortable headers. On a phone: two columns, the row opens for the rest (CSS).
//   · A row opens in place, one at a time (`openKey`): <RowOpen> — the accent eyebrow, the headline for its stage,
//     the on-demand panes (one shown at a time) and the stage's actions.
// ============================================================

// ⭐ D149 (11-03) · built to tracker-options.html's markup: the counts are the sketch's `.cnt` (a large number over a
// small grey word, as blocks), the filters its `.flt` buttons, the status its `.dot` (a 7 px dot + the word; "Needs
// you" in the accent), the opened row its `.det` (eyebrow · 32 px headline · on-demand buttons · the pane · `.btn`s).
export function TrackerCounts({ counts = {} }) {
  return (
    <div className="trk-counts" data-tracker-counts="">
      {TRACKER_COUNTS.map(c => (
        <div key={c.id} data-count={c.id} data-accent={c.accent ? "true" : undefined}>
          <b>{counts[c.id] ?? 0}</b><span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TrackerFilters({ filter = "all", onFilter, search = null, period = "any", onPeriod, findOpen = false, onFind }) {
  return (
    <>
      <div className="trk-filters" role="toolbar" aria-label="Show">
        {TRACKER_FILTERS.map(([id, label]) => (
          <button key={id} type="button" className="trk-chip" data-filter={id} aria-pressed={filter === id}
            onClick={() => onFilter?.(id)}>{label}</button>
        ))}
        {/* D149 (11-03): the search and the period are not on the sketch (D146: "the date range / search → a search
            field and the period in the filter row") — kept one press away: a last quiet button, Search, opens them
            in a row under the filters (open while either is in use). */}
        <button type="button" className="trk-chip" data-find-open="" aria-pressed={findOpen} aria-expanded={findOpen}
          onClick={() => onFind?.(!findOpen)}>Search</button>
      </div>
      {findOpen && (
        <div className="trk-find" data-find="">
          {search && <span className="trk-search">{search}</span>}
          <select className="trk-period" aria-label="Period" value={period} onChange={(e) => onPeriod?.(e.target.value)}>
            {TRACKER_PERIODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      )}
    </>
  );
}

/** The status: a quiet dot in the stage's ring colour + the word. A rectangle-free, capsule-free mark. */
export function StatusDot({ ring, word }) {
  return (
    <span className="trk-status" data-status-ring={ring}>
      <span className="trk-dot" aria-hidden="true" style={{ "--trk-dot": ringVar(ring) }} />
      <span className="trk-status__w">{word}</span>
    </span>
  );
}

/** The order the table opens in: the sketch's — what needs you first, then what is moving, then what is done. */
export const DEFAULT_SORT = Object.freeze({ key: "status", dir: "asc" });

export default function ApplicationTracker({ rows = [], sort = DEFAULT_SORT, onSort, openKey = null, onOpen,
  renderOpen, empty = null }) {
  const sortBtn = (c) => {
    const on = sort.key === c.key;
    // The sketch's headers carry no arrow: the default order is unmarked; one the user chose shows its direction.
    const chosen = on && !(sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir);
    return (
      <button type="button" className="trk-sort" data-sort={c.key} aria-pressed={on}
        onClick={() => onSort?.({ key: c.key, dir: on && sort.dir === "desc" ? "asc" : "desc" })}>
        {c.label}<span aria-hidden="true">{chosen ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}</span>
      </button>
    );
  };
  return (
    <div className="trk" data-tracker-table="">
      <table className="trk-table">
        <thead>
          <tr>
            {TRACKER_COLUMNS.map(c => (
              <th key={c.key} data-col={c.key} scope="col"
                aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>{sortBtn(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const open = openKey === r.key;
            return [
              <tr key={r.key} className="trk-row" data-row={r.key} data-stage={r.stage} data-open={open ? "true" : undefined}
                aria-expanded={open} tabIndex={0}
                onClick={() => onOpen?.(open ? null : r.key)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(open ? null : r.key); } }}>
                <td data-col="position">
                  <span className="trk-pos">
                    <CompanyBubble company={r.company} size="row" />
                    <span className="trk-pos__t"><b>{r.company}</b><span>{r.title || "A role"}</span></span>
                  </span>
                </td>
                <td data-col="resume">{r.resume}</td>
                <td data-col="answers">{r.answers}</td>
                <td data-col="status"><StatusDot ring={r.ring} word={r.status} /></td>
                <td data-col="when">{r.when}</td>
              </tr>,
              open && (
                <tr key={`${r.key}:open`} className="trk-open" data-row-open={r.key}>
                  <td colSpan={TRACKER_COLUMNS.length}>{renderOpen?.(r)}</td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
      {!rows.length && empty}
    </div>
  );
}

/**
 * An opened row, in D145's "one screen at a time" type: the eyebrow, the headline, the on-demand panes (ONE shown at a
 * time, inside the row — never a new page) and the stage's actions. `paneBody(id)` renders a pane; `children` are the
 * row's inline editors (a question's answer box, a date, a note), shown above the actions.
 */
export function RowOpen({ row, pane = null, onPane, paneBody, actions = [], onClose, children }) {
  const labels = Object.fromEntries(TRACKER_PANES);
  return (
    // D149 (11-03): the sketch's opened row has no × — it folds by pressing the row again, or Escape (the panel's
    // window listener, and here for a key pressed inside the row).
    <div className="trk-o" data-row-detail={row.key} onKeyDown={(e) => { if (e.key === "Escape") onClose?.(); }}>
      <p className="trk-o__eyebrow">{row.eyebrow}</p>
      <h3 className="trk-o__headline" data-row-headline="">{row.headline}</h3>
      <div className="trk-o__panes" role="group" aria-label="Show">
        {row.panes.map(id => (
          <button key={id} type="button" className="trk-od" data-pane={id} aria-pressed={pane === id}
            onClick={() => onPane?.(pane === id ? null : id)}>{labels[id]}</button>
        ))}
      </div>
      {pane && <div className="trk-o__pane" data-pane-body={pane}>{paneBody?.(pane)}</div>}
      {children}
      {actions.length > 0 && (
        <div className="trk-acts" data-row-actions="">
          {actions.map(a => a.href ? (
            <a key={a.id} className="trk-btn" data-kind={a.kind} data-action={a.id} href={a.href} target="_blank" rel="noreferrer" title={a.title}
              onClick={a.onClick}>{a.label}</a>
          ) : (
            <button key={a.id} type="button" className="trk-btn" data-kind={a.kind} title={a.title} disabled={a.disabled}
              data-action={a.id} onClick={a.onClick}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import "./ApplicationTracker.css";
import { TRACKER_PANES } from "../lib/trackerRows.js";
import { ringVar } from "../styles/rings.js";

// ============================================================
// ApplicationTracker — what is left of D146's table: the opened row (RowOpen) and the status dot
// ============================================================
// ⛔ 47k (the R3 sweep): the classic table (the default export: Position · Résumé · Answers · Status · When, sortable
// headers, a row opening in place) and TrackerFilters (its filter / Search / period row) are DELETED — R3 retired the
// classic Home, and the ledger's register (plate/Lists.jsx's Register + plate/Marks.jsx's FilterChips) draws the rows and filters now.
// What stays is live: <RowOpen> (the ledger opens a row in place with it, AutoApplyPanel's renderRow), <StatusDot> (the
// Inbox's rows) and DEFAULT_SORT (the register's first order). Every piece of state is a prop.
//   · <RowOpen> — the accent eyebrow, the headline for its stage, the on-demand panes (one shown at a time) and the
//     stage's actions.
// ============================================================

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

/**
 * An opened row, in D145's "one screen at a time" type: the eyebrow, the headline, the on-demand panes (ONE shown at a
 * time, inside the row — never a new page) and the stage's actions. `paneBody(id)` renders a pane; `children` are the
 * row's inline editors (a question's answer box, a date, a note), shown above the actions.
 */
/** D165 (5): the attempts before the latest — one quiet line; its detail stays closed until "show". */
function EarlierAttempts({ earlier }) {
  const [showEarlier, setShowEarlier] = useState(false);
  return (
    <>
      <p className="trk-earlier" data-earlier-attempts={earlier.count}>{earlier.line} ·{" "}
        <button type="button" aria-expanded={showEarlier} onClick={() => setShowEarlier(v => !v)}>{showEarlier ? "hide" : "show"}</button></p>
      {showEarlier && <div className="trk-earlier__d" data-earlier-detail="">{earlier.detail}</div>}
    </>
  );
}

export function RowOpen({ row, pane = null, onPane, paneBody, actions = [], onClose, children, held = null }) {
  const labels = Object.fromEntries(TRACKER_PANES);
  // ⭐ D165 (5): a held application (lib/heldApplication.js) — the sketch's eyebrow / headline / lead for its state, the steps
  // the run took, and ONE quiet line for an earlier attempt. Rows that are not an application run pass none.
  // The sketch's order for a held row: lead → the question → the buttons → the steps → the panes → the earlier attempt.
  // Every other row keeps D149's: panes first, then its editors and actions.
  const stepsFirst = held?.steps?.length > 0;
  const panes = (
    <>
      <div className="trk-o__panes" role="group" aria-label="Show">
        {row.panes.map(id => (
          <button key={id} type="button" className="trk-od" data-pane={id} aria-pressed={pane === id}
            onClick={() => onPane?.(pane === id ? null : id)}>{labels[id]}</button>
        ))}
      </div>
      {pane && <div className="trk-o__pane" data-pane-body={pane}>{paneBody?.(pane)}</div>}
    </>
  );
  return (
    // D149 (11-03): the sketch's opened row has no × — it folds by pressing the row again, or Escape (the panel's
    // window listener, and here for a key pressed inside the row).
    <div className="trk-o" data-row-detail={row.key} data-order={stepsFirst ? "held" : undefined}
      onKeyDown={(e) => { if (e.key === "Escape") onClose?.(); }}>
      {(held ? held.eyebrow : row.eyebrow) && <p className="trk-o__eyebrow">{held ? held.eyebrow : row.eyebrow}</p>}
      <h3 className="trk-o__headline" data-row-headline="">{held?.title || row.headline}</h3>
      {held?.lead && <p className="trk-o__lead" data-held-lead={held.state}>{held.lead}</p>}
      {/* ⭐ A165: the questions waiting on the person, by name — required first. */}
      {held?.questions?.length > 0 && (
        <ul className="trk-o__questions" data-held-questions="" aria-label="Waiting on you">
          {held.questions.map(q => (
            <li key={q.question} data-required={q.required ? "true" : "false"}>{q.question}{q.required ? <span className="trk-o__req"> · required</span> : null}</li>
          ))}
        </ul>
      )}
      {!stepsFirst && panes}
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
      {held?.steps?.length > 0 && (
        <ul className="trk-steps" data-run-steps="" aria-label="What the run did">
          {held.steps.map(st => (
            <li key={st.id} data-step={st.id} data-step-state={st.state || "todo"}>
              <i aria-hidden="true" /><span>{st.label}</span><span className="trk-steps__m">{st.meta}</span>
            </li>
          ))}
        </ul>
      )}
      {stepsFirst && panes}
      {held?.earlier && <EarlierAttempts earlier={held.earlier} />}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  sentenceClauses, isOpenSet, isWordPanel, panelKey, panelRows, panelPress, panelNote, addRows,
  BOARD_PANEL, facetsUsable,
} from "../lib/filterSentenceModel.js";
import { SENTENCE_ID, PANEL_ID } from "./BoardHeadline.jsx";
import "./FullHouse.css";

// ── D35 · THE ONE PANEL A FILTER WORD OPENS — directly beneath the sentence ──────────────────────────
//
// Replaces D30's six always-visible dials (FilterDials.jsx, deleted) and the filter icon's drawer
// panel. The sentence's words ARE the dials now: pressing one opens its options HERE, pressing it
// again closes it, and only one is ever open — `open` is the board's single panel value.
//
// header.html's panel: the clause's key and "Close ×", its options as boxed pills with their counts,
// and one line of coverage beneath — every figure LIVE from GET /api/jobs/facets (panelNote).
//   ⛔ A zero-count option is DIMMED AND NOT SELECTABLE, NEVER HIDDEN (aria-disabled: still reached by
//      the keyboard, still read out, its 0 still shown).
//   ⛔ Location's first pill IS the floor, the United States: there is no "anywhere" to choose.
//   ⚠ Domain and location are OPEN sets (D30): a find box, and a list that scrolls inside the panel.
//
// ⛔ D35 §6 · KEYBOARD. The panel follows the sentence in the DOM, so tab order is reading order. On
// opening, focus moves INTO the panel (the find box, else the chosen option, else the first one a
// press can change), so it is reachable from the word that opened it; Escape and "Close ×" close it
// and give focus back to that word.
//
// Props: open, params, facets, facetsStatus, defaultDomain, otherFilterCount, onPatch(patch), onOpen(key),
//        onClose(), onMoreFilters()
export default function WordPanel(props) {
  if (!isWordPanel(props.open)) return null;
  return <PanelBody key={props.open} {...props} />;
}

/** The element focus moves to when a panel opens. Exported so a test can hold the rule. */
export function panelFocusTarget(root) {
  if (!root?.querySelector) return null;
  return root.querySelector("input")
    || root.querySelector('.fh-op[aria-checked="true"]:not([aria-disabled="true"])')
    || root.querySelector('.fh-op:not([aria-disabled="true"])')
    || root.querySelector("button");
}

/** The word that opened `open` — its own token, or "+ add" for a clause not yet in the sentence. */
export function openerSlot(open, doc = typeof document !== "undefined" ? document : null) {
  const sentence = doc?.getElementById?.(SENTENCE_ID);
  return sentence?.querySelector?.(`[data-slot="${open}"]`)
    || sentence?.querySelector?.(`[data-slot="${BOARD_PANEL.MORE}"]`) || null;
}

/** Escape closes the panel (and the caller returns focus). Exported so a test can press it. */
export function panelKeyDown(e, close) {
  if (e.key === "Escape") { e.preventDefault?.(); e.stopPropagation?.(); close(); }
}

function PanelBody({ open, params = {}, facets = null, facetsStatus = "idle", defaultDomain = null,
                     otherFilterCount = 0, onPatch, onOpen, onClose, onMoreFilters }) {
  const ref = useRef(null);
  const [find, setFind] = useState("");
  useEffect(() => { panelFocusTarget(ref.current)?.focus?.(); }, []);
  const close = () => { onClose?.(); openerSlot(open)?.focus?.(); };

  const usable = facetsUsable(facets) && (facetsStatus === "ready" || facetsStatus === "loading") ? facets : null;
  const noCounts = facetsStatus === "unavailable" || facetsStatus === "error";
  const clause = sentenceClauses().find(c => c.key === open) || null;
  const note = panelNote(open, params, usable);
  const noteId = `${PANEL_ID}-note`;

  return (
    <section ref={ref} id={PANEL_ID} className="fh-pan" data-panel={open}
      role="region" aria-labelledby={`${PANEL_ID}-key`} onKeyDown={(e) => panelKeyDown(e, close)}>
      <div className="fh-pin">
        <div className="fh-ph">
          <span className="fh-k" id={`${PANEL_ID}-key`}>{panelKey(open)}</span>
          <button type="button" className="fh-cl" onClick={close}>Close ×</button>
        </div>
        {clause
          ? <ClauseOptions clause={clause} params={params} facets={usable} defaultDomain={defaultDomain}
              find={find} setFind={setFind} onPatch={onPatch} noteId={note ? noteId : undefined} />
          : <AddOptions params={params} otherFilterCount={otherFilterCount} noteId={note ? noteId : undefined} onOpen={onOpen}
              onMoreFilters={() => { onClose?.(); onMoreFilters?.(); }} />}
        {note && <p className="fh-cov" id={noteId}>{note}</p>}
        {noCounts && clause && (
          <p className="fh-cov">Counts aren't available right now — these still filter the board.</p>
        )}
        {/* ⭐ D42 (owner, 10-06): "+ add" LEFT THE SENTENCE. What can still be added — posted, fit,
            salary & more — sits here, in the box any filter word opens. */}
        {clause && (
          <div className="fh-addrow" data-add-section>
            <span className="fh-k" id={`${PANEL_ID}-add`}>Add a filter</span>
            <AddOptions params={params} otherFilterCount={otherFilterCount} labelledBy={`${PANEL_ID}-add`}
              exclude={open} onOpen={onOpen} onMoreFilters={() => { onClose?.(); onMoreFilters?.(); }} />
          </div>
        )}
      </div>
    </section>
  );
}

function ClauseOptions({ clause, params, facets, defaultDomain, find, setFind, onPatch, noteId }) {
  const openSet = isOpenSet(clause);
  const rows = useMemo(() => {
    const all = panelRows(clause, params, facets, { defaultDomain });
    if (!openSet) return all;
    // An open set: the floor / defaults first, then what is chosen, then the most postings; a zero
    // only sinks and dims, it is never dropped. The find box narrows by the pill's own words.
    const head = all.filter(r => r.kind !== "option" && r.kind !== "strict");
    const tail = all.filter(r => r.kind === "strict");
    const opts = all.filter(r => r.kind === "option")
      .sort((a, b) => (b.selected - a.selected) || ((b.count ?? 0) - (a.count ?? 0)));
    const q = find.trim().toLowerCase();
    return [...head, ...(q ? opts.filter(r => r.label.toLowerCase().includes(q)) : opts), ...tail];
  }, [clause, params, facets, defaultDomain, openSet, find]);
  const findLabel = clause.key === "location" ? "Find a city or state" : "Find a kind of work";
  return (
    <>
      {openSet && (
        <input className="fh-find" type="search" value={find} onChange={e => setFind(e.target.value)}
          placeholder={findLabel} aria-label={findLabel} />
      )}
      <PanelOptions clause={clause} rows={rows} params={params} onPatch={onPatch} openSet={openSet} noteId={noteId} />
    </>
  );
}

/** A clause's pills. Pure — a test renders it and presses its pills directly. */
export function PanelOptions({ clause, rows, params = {}, onPatch, openSet = false, noteId }) {
  const role = clause.dim.multi ? "checkbox" : "radio";
  return (
    <div className={`fh-opts${openSet ? " fh-opts--open" : ""}`} role="group"
      aria-labelledby={`${PANEL_ID}-key`} aria-describedby={noteId}>
      {rows.map(r => (
        <button key={`${r.kind}:${r.value}`} type="button" className={r.kind === "strict" ? "fh-op fh-op--strict" : "fh-op"}
          role={r.kind === "strict" ? "checkbox" : role}
          data-kind={r.kind} data-value={r.value} aria-checked={r.selected}
          aria-disabled={r.disabled ? "true" : undefined}
          title={r.note || undefined}
          onClick={() => { const patch = panelPress(clause, params, r); if (patch) onPatch?.(patch); }}>
          {r.label}
          {r.count != null && <span className="n">{r.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** "+ add" — what can be added. Pure, like PanelOptions. */
export function AddOptions({ params = {}, otherFilterCount = 0, onOpen, onMoreFilters, noteId, labelledBy, exclude = null }) {
  return (
    <div className="fh-opts" role="group" aria-labelledby={labelledBy || `${PANEL_ID}-key`}>
      {addRows(params, { otherFilterCount }).filter(r => r.key !== exclude).map(r => (
        <button key={r.key} type="button" className="fh-op" data-add={r.key}
          aria-disabled={r.disabled ? "true" : undefined}
          aria-describedby={r.kind === "employment" ? noteId : undefined}
          onClick={() => {
            if (r.disabled) return;
            if (r.kind === "clause") onOpen?.(r.key);
            else if (r.kind === "drawer") onMoreFilters?.();
          }}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

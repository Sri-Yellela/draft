import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DockPortal } from "./DockPortal.jsx";
import { Z } from "../styles/zLayers.js";
import {
  sentenceClauses, clauseSelection, tokenText, optionRows, pressOption, clearClause, footerText,
} from "../lib/filterSentenceModel.js";
import "./BoardPanels.css";

// ── D24 · FULL HOUSE — THE FILTERS, AS ONE SENTENCE ─────────────────────────────────────────────────
//
//   Show me [Senior] jobs that are [Remote], posted [past month], where my fit is [Strong].
//
// Serif prose; each bracket is a TOKEN in the logo face — filled orange when it carries a choice, paper
// with depth when it reads "any". Tap a token and a popover lists that clause's options WITH THEIR
// COUNTS from GET /api/jobs/facets: that is where the sentence keeps the counts the drawer had — on the
// token being edited, not in the prose.
//
//   ⛔ A zero-count option is DIMMED, NOT HIDDEN. "Intern 0" is information; a missing Intern looks
//      like a bug.
//   ⛔ An option that would empty the board SAYS SO before it is pressed ("Would show no jobs").
//   ⛔ Four clauses, by decision (shared/filterSentence.js's SENTENCE_CAP). The sentence does not grow.
//
// Everything this renders comes from lib/filterSentenceModel.js, which derives it from the contract.
// No option value or label is written in this file.
//
// Props:
//   params       { [dim.param]: value } for the four clauses — the board's COMMITTED filters
//   facets       the FacetsResponse, or null
//   facetsStatus "idle" | "loading" | "ready" | "unavailable" | "error"
//   onChange     (patch) => void — a { [dim.param]: next } patch, applied to the board at once
//   onClearAll   () => void
//   onMoreFilters, otherFilterCount — the way to the filters that are not clauses (see JobsPanel)
//   initialOpen  a clause key whose popover starts open (screenshots and tests; the board passes none)
export default function FilterSentence({
  params = {}, facets = null, facetsStatus = "idle", onChange, onClearAll,
  onMoreFilters, otherFilterCount = 0, initialOpen = null,
}) {
  const [open, setOpen] = useState(initialOpen);
  // The open token's rect. The popover is PORTALLED (DockPortal): the board's column clips its
  // overflow, and a popover hanging below the sentence was cut off at the column's edge on a short
  // board. DockPortal also gives it the board's two exits — Escape, and a press outside it.
  const [anchorRect, setAnchorRect] = useState(null);
  const tokenRefs = useRef({});
  const clauses = sentenceClauses();

  // An `initialOpen` popover has no click to measure from, so measure once mounted.
  useLayoutEffect(() => {
    if (open && !anchorRect) setAnchorRect(tokenRefs.current[open]?.getBoundingClientRect() || null);
  }, [open, anchorRect]);

  const toggle = (key, el) => {
    if (open === key) { setOpen(null); setAnchorRect(null); return; }
    setOpen(key);
    setAnchorRect(el.getBoundingClientRect());
  };
  // Escape or a press outside: close, and put focus back on the token it came from — the popover is
  // portalled, so without this a keyboard user is left on <body>.
  const close = () => {
    const back = open && tokenRefs.current[open];
    setOpen(null); setAnchorRect(null);
    back?.focus?.();
  };

  const anyChosen = clauses.some(c => clauseSelection(c, params).length > 0);
  const noCounts = facetsStatus === "unavailable" || facetsStatus === "error";

  return (
    <section className="bp fs" aria-label="Filters" data-board-panel="filter">
      <p className="fs__sentence">
        {clauses.map((c, i) => {
          const active = clauseSelection(c, params).length > 0;
          const isOpen = open === c.key;
          const popId = `fs-pop-${c.key}`;
          return (
            <Fragment key={c.key}>
              {i > 1 ? ", " : i === 1 ? " " : ""}
              {c.lead}{" "}
              <span className="fs__slot">
                <button type="button" className="fs__token"
                  ref={el => { tokenRefs.current[c.key] = el; }}
                  data-active={active ? "true" : "false"}
                  aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={isOpen ? popId : undefined}
                  onClick={(e) => toggle(c.key, e.currentTarget)}>
                  {tokenText(c, params)}
                </button>
                {isOpen && anchorRect && (
                  <DockPortal anchorRect={anchorRect} onClose={close} tier={Z.SEARCH_DROPDOWN}
                    theme={POPOVER_THEME} style={{ minWidth: 300, padding: 8, borderRadius: 14 }}>
                    <ClausePopover id={popId} clause={c} params={params} facets={facets}
                      noCounts={noCounts}
                      onPress={(value) => onChange?.(pressOption(c, params, value))}
                      onAny={() => onChange?.(clearClause(c))} />
                  </DockPortal>
                )}
              </span>
              {c.tail ? ` ${c.tail}` : ""}
            </Fragment>
          );
        })}
        .
      </p>

      <div className="fs__foot">
        <span className="fs__count" aria-live="polite">{footerText(facetsStatus === "ready" || facetsStatus === "loading" ? facets : null)}</span>
        {noCounts && (
          <span className="fs__nocounts">
            {facetsStatus === "unavailable" ? "Counts aren't available on this build yet." : "Counts couldn't be loaded."}
          </span>
        )}
        <span className="fs__foot-actions">
          {onMoreFilters && (
            <button type="button" className="fs__link" onClick={onMoreFilters}>
              More filters{otherFilterCount > 0 ? ` (${otherFilterCount} on)` : ""}
            </button>
          )}
          <button type="button" className="fs__link fs__clear" onClick={onClearAll}
            disabled={!anyChosen && otherFilterCount === 0}>
            Clear all <span aria-hidden="true">×</span>
          </button>
        </span>
      </div>
    </section>
  );
}

// DockPortal takes a theme object; token names keep it on the stylesheet's palette (UsbSelect's
// precedent). Opaque: the board's cards sit right under it.
const POPOVER_THEME = {
  menuSurface: "var(--c-surface-solid)",
  border: "var(--c-glass-edge)",
  shadowLg: "var(--c-shadow-lg)",
};

/** One clause's options with their counts. Exported so tests can render it without a portal. */
export function ClausePopover({ id, clause, params, facets, noCounts, onPress, onAny }) {
  const rows = optionRows(clause, params, facets);
  const none = clauseSelection(clause, params).length === 0;
  // Opened from a token, focus moves INTO the popover (onto the current choice), because it is
  // portalled to the end of the document and Tab from the token would never reach it.
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    (el?.querySelector('[aria-pressed="true"]') || el?.querySelector("button"))?.focus?.();
  }, []);
  return (
    <div ref={ref} id={id} className="fs__pop" role="dialog" aria-label={`${clause.lead} …`}>
      <button type="button" className="fs__opt fs__opt--any" aria-pressed={none} onClick={onAny}>
        <span className="fs__opt-label">{clause.any}</span>
      </button>
      {rows.map(r => (
        <button key={r.value} type="button" className="fs__opt"
          aria-pressed={r.selected}
          data-dimmed={r.dimmed ? "true" : "false"}
          data-empties={r.empties ? "true" : "false"}
          aria-describedby={r.note ? `${id}-${r.value}-note` : undefined}
          onClick={() => onPress(r.value)}>
          <span className="fs__opt-label">{r.label}</span>
          {r.count != null && <span className="fs__opt-n">{r.count}</span>}
          {r.note && <span id={`${id}-${r.value}-note`} className="fs__opt-note">{r.note}</span>}
        </button>
      ))}
      {noCounts && <p className="fs__pop-note">No counts yet — these still filter the board.</p>}
    </div>
  );
}

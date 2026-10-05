import { useEffect, useMemo, useRef, useState } from "react";
import {
  sentenceClauses, clauseSelection, optionRows, pressOption, clearClause, footerText, dialSummary,
  isOpenSet, allDomainsPatch, clauseOptions,
} from "../lib/filterSentenceModel.js";
import "./BoardPanels.css";

// ── D30 · FULL HOUSE — THE FILTER DIALS ─────────────────────────────────────────────────────────────
//
// Six dials, ALL ALWAYS VISIBLE — DOMAIN · LEVEL · LOCATION · WORKPLACE · POSTED · FIT — each with its
// dimension, its current value and its count ("LEVEL · Senior · 674 jobs"); an unset dial reads "no
// filter". The sentence that heads the page (BoardHeadline) is DERIVED from the same params, so the
// readable headline and this complete inventory can never disagree.
//
//   ⛔ No popovers for the four small closed sets: tapping a dial opens its options INLINE, under the
//      dials. Location and domain are OPEN sets and get a picker with a find box.
//   ⛔ A zero-count option is DIMMED, NOT HIDDEN, and one that would empty the board says so first.
//   ⛔ Thin tag coverage is said ON THE DIAL ("3 have no level on file — kept, not hidden"); the
//      sentence never implies precision the tags do not have.
//   ⛔ Location's floor is the United States: its "clear" returns to the floor, never to "anywhere".
//
// Everything rendered comes from lib/filterSentenceModel.js, which derives it from the contract.
//
// Props:
//   params        { [dim.param]: value } for the six dials — the board's COMMITTED filters
//   facets        the FacetsResponse, or null;  facetsStatus "idle" | "loading" | "ready" | "unavailable" | "error"
//   onChange      (patch) => void, applied to the board at once
//   onClearAll, onMoreFilters, otherFilterCount — as D24's sentence had them
//   defaultDomain the profile's own function word, which the unset domain dial reads as its default
//   initialOpen   a dial key that starts open (the headline's slots open their dial; also screenshots)
export default function FilterDials({
  params = {}, facets = null, facetsStatus = "idle", onChange, onClearAll,
  onMoreFilters, otherFilterCount = 0, defaultDomain = null, initialOpen = null,
}) {
  const [open, setOpen] = useState(initialOpen);
  useEffect(() => { if (initialOpen) setOpen(initialOpen); }, [initialOpen]);
  const clauses = sentenceClauses();
  const usableFacets = facetsStatus === "ready" || facetsStatus === "loading" ? facets : null;
  const noCounts = facetsStatus === "unavailable" || facetsStatus === "error";
  const anyChosen = clauses.some(c => clauseSelection(c, params).length > 0);
  const openClause = clauses.find(c => c.key === open) || null;

  return (
    <section className="bp fd" aria-label="Filters" data-board-panel="filter">
      <div className="fd__dials">
        {clauses.map(c => {
          const d = dialSummary(c, params, usableFacets);
          const isOpen = open === c.key;
          return (
            <button key={c.key} type="button" className="fd__dial"
              data-dial={c.key} data-active={d.active ? "true" : "false"}
              aria-expanded={isOpen} aria-controls={isOpen ? `fd-opts-${c.key}` : undefined}
              onClick={() => setOpen(isOpen ? null : c.key)}>
              <span className="fd__dim">{d.label}</span>
              <span className="fd__val">{c.key === "domain" && !d.active && defaultDomain ? `Your profile · ${defaultDomain}` : d.value}</span>
              <span className="fd__n">{d.count != null ? `${d.count} ${d.count === 1 ? "job" : "jobs"}` : " "}</span>
              {d.note && <span className="fd__note">{d.note}</span>}
            </button>
          );
        })}
      </div>

      {openClause && (
        <DialOptions key={openClause.key} clause={openClause} params={params} facets={usableFacets}
          noCounts={noCounts} defaultDomain={defaultDomain}
          onPatch={(patch) => onChange?.(patch)} />
      )}

      <div className="fs__foot">
        <span className="fs__count" aria-live="polite">{footerText(usableFacets)}</span>
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

/** One dial's options, inline. Exported so tests can render it alone. */
export function DialOptions({ clause, params, facets, noCounts, defaultDomain = null, onPatch }) {
  const rows = optionRows(clause, params, facets);
  const none = clauseSelection(clause, params).length === 0;
  const openSet = isOpenSet(clause);
  const [find, setFind] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    (el?.querySelector("input") || el?.querySelector('[aria-pressed="true"]') || el?.querySelector("button"))?.focus?.();
  }, []);
  // An open set lists what the board holds first; nothing is hidden, a zero only sinks and dims.
  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    const list = openSet ? [...rows].sort((a, b) => (b.selected - a.selected) || ((b.count ?? 0) - (a.count ?? 0))) : rows;
    return q ? list.filter(r => r.label.toLowerCase().includes(q)) : list;
  }, [rows, find, openSet]);
  const allChosen = clause.key === "domain" && clauseOptions(clause).every(o => clauseSelection(clause, params).includes(o.value));
  const defaultLabel = clause.key === "domain"
    ? (defaultDomain ? `Your profile (${defaultDomain})` : "Your profile")
    : clause.floor ? "The whole United States" : clause.any.replace(/^./, c => c.toUpperCase());

  return (
    <div ref={ref} id={`fd-opts-${clause.key}`} className={`fd__opts${openSet ? " fd__opts--open" : ""}`}
      role="group" aria-label={`${clause.label} options`}>
      {openSet && (
        <input className="fd__find" type="search" value={find} onChange={e => setFind(e.target.value)}
          placeholder={clause.key === "location" ? "Find a city or state" : "Find a kind of work"}
          aria-label={clause.key === "location" ? "Find a city or state" : "Find a kind of work"} />
      )}
      <div className="fd__optlist">
        <button type="button" className="fs__opt fs__opt--any" aria-pressed={none} onClick={() => onPatch(clearClause(clause))}>
          <span className="fs__opt-label">{defaultLabel}</span>
        </button>
        {clause.key === "domain" && (
          <button type="button" className="fs__opt fs__opt--any" aria-pressed={allChosen} onClick={() => onPatch(allDomainsPatch(clause))}>
            <span className="fs__opt-label">Every kind of work</span>
          </button>
        )}
        {shown.map(r => (
          <button key={r.value} type="button" className="fs__opt"
            aria-pressed={r.selected}
            data-dimmed={r.dimmed ? "true" : "false"}
            data-empties={r.empties ? "true" : "false"}
            aria-describedby={r.note ? `fd-${clause.key}-${r.value}-note` : undefined}
            onClick={() => onPatch(pressOption(clause, params, r.value))}>
            <span className="fs__opt-label">{r.label}</span>
            {r.count != null && <span className="fs__opt-n">{r.count}</span>}
            {r.note && <span id={`fd-${clause.key}-${r.value}-note`} className="fs__opt-note">{r.note}</span>}
          </button>
        ))}
      </div>
      {noCounts && <p className="fs__pop-note">No counts yet — these still filter the board.</p>}
    </div>
  );
}

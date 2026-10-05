import { useEffect, useRef } from "react";
import { sortRows, tieBreakText, unscoredParts } from "../lib/filterSentenceModel.js";
import "./FullHouse.css";

// ── D24 → D35 · THE SORT PANEL — opened by the bar's ⇅ square, beneath the bar ───────────────────────
//
// header.html's shape: "SORT BY" and "Close ×", the orders as boxed pills each with its small note
// (Best fit · ats, Newest · posted, Salary · high, Company · A–Z), and the line D35 §5 keeps —
// "537 jobs have no ATS score yet, so they sort last whatever you pick. Newest shows everything." —
// its number from facets' `unscored`, never a guess.
//
// Kept from D24, where the sketch is silent:
//   · FIRST, "For you" — the board's curated default, which is NO sort param at all. Without it the
//     default order could not be chosen again once another was.
//   · ⭐ the TIE-BREAK of the chosen order, visible ("Ties broken by: newest first, then company A–Z").
//   · Best fit is not offered without a résumé (2026-09-26), and its line goes with it.
//
// Props: value, onChange(value), atsAvailable, facets, facetsStatus, onClose()
export const SORT_PANEL_ID = "fh-sort";

export default function SortPanel({ value, onChange, atsAvailable = true, facets = null, facetsStatus = "idle", onClose }) {
  const rows = sortRows(atsAvailable);
  const counted = facetsStatus === "ready" || facetsStatus === "loading" ? facets : null;
  const chosen = rows.find(r => r.value === value) || rows[0];
  const { lead, newest } = unscoredParts(counted);
  const ref = useRef(null);
  useEffect(() => { ref.current?.querySelector?.('[aria-checked="true"]')?.focus?.(); }, []);
  const close = () => { onClose?.(); document.querySelector?.('[data-board-icon="sort"]')?.focus?.(); };
  return (
    <section ref={ref} id={SORT_PANEL_ID} className="fh-sortp" aria-labelledby={`${SORT_PANEL_ID}-key`}
      data-board-panel="sort" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}>
      <div className="fh-pin">
        <div className="fh-ph">
          <span className="fh-k" id={`${SORT_PANEL_ID}-key`}>Sort by</span>
          <button type="button" className="fh-cl" onClick={close}>Close ×</button>
        </div>
        <div className="fh-opts" role="radiogroup" aria-labelledby={`${SORT_PANEL_ID}-key`}>
          {rows.map(r => (
            <button key={r.value} type="button" role="radio" aria-checked={r.value === value} className="fh-op"
              data-sort={r.value} title={r.subtitle} onClick={() => onChange?.(r.value)}>
              {r.short}
              {r.tag && <span className="n">{r.tag}</span>}
            </button>
          ))}
        </div>
        {atsAvailable && (
          <p className="fh-cov" data-unscored="">
            {lead}{newest && <>{" "}<b>{newest}</b> shows everything.</>}
          </p>
        )}
        {tieBreakText(chosen) && <p className="fh-cov" data-tie-break="">{tieBreakText(chosen)}</p>}
      </div>
    </section>
  );
}

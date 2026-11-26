import { useEffect, useRef } from "react";
import { sortRows, tieBreakText, unscoredParts } from "../lib/filterSentenceModel.js";
// ⛔ 47j w1-market (D197 Wave 1 #2): drawn as a plate piece — plate/MarketControls.jsx MarketPanel (kind "menu"), its
// orders `.pl-mk-op`; FullHouse.css's .fh-sortp look is retired. The rows, the tie-break, the unscored line, focus and
// the outside press that closes it are unchanged.
import { MarketPanel } from "../plate/MarketControls.jsx";

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

// ⭐ D156 (5): a small menu under the search field's sort icon (the views left it for their own row under the search —
// D147 had put them here, under "Show").
export default function SortPanel({ value, onChange, atsAvailable = true, facets = null, facetsStatus = "idle", onClose }) {
  const rows = sortRows(atsAvailable);
  const counted = facetsStatus === "ready" || facetsStatus === "loading" ? facets : null;
  const chosen = rows.find(r => r.value === value) || rows[0];
  const { lead, newest } = unscoredParts(counted);
  const ref = useRef(null);
  useEffect(() => { ref.current?.querySelector?.('[aria-checked="true"]')?.focus?.(); }, []);
  const close = () => { onClose?.(); document.querySelector?.('[data-board-icon="sort"]')?.focus?.(); };
  // ⭐ D156 (5) (44u's open item): a press anywhere outside the menu (and outside the icon that toggles it) closes it, as
  // home-sketch.html's .sortpop does. Focus is left where the press put it.
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || e.target?.closest?.('[data-board-icon="sort"]')) return;
      onClose?.();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);
  return (
    <MarketPanel kind="menu" panelRef={ref} id={SORT_PANEL_ID} label="Sort by" labelId={`${SORT_PANEL_ID}-key`} onClose={close}
      aria-labelledby={`${SORT_PANEL_ID}-key`}
      data-board-panel="sort" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}>
        <div className="pl-mk-opts pl-mk-opts--col" role="radiogroup" aria-labelledby={`${SORT_PANEL_ID}-key`}>
          {rows.map(r => (
            <button key={r.value} type="button" role="radio" aria-checked={r.value === value} className="pl-mk-op"
              data-sort={r.value} title={r.subtitle} onClick={() => onChange?.(r.value)}>
              {r.short}
              {r.tag && <span className="pl-mk-op__n">{r.tag}</span>}
            </button>
          ))}
        </div>
        {atsAvailable && (
          <p className="pl-mk-panel__note" data-unscored="">
            {lead}{newest && <>{" "}<b>{newest}</b> shows everything.</>}
          </p>
        )}
        {tieBreakText(chosen) && <p className="pl-mk-panel__note" data-tie-break="">{tieBreakText(chosen)}</p>}
    </MarketPanel>
  );
}

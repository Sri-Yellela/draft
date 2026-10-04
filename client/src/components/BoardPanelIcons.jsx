import { SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { BOARD_PANEL } from "../lib/filterSentenceModel.js";
import "./BoardPanels.css";

// ── D24 · THE FILTER AND SORT ICONS ─────────────────────────────────────────────────────────────────
//
// ⛔ Same place they have been since W4 — the right of the search bar's actions row. Only the look
// and what they open changed. 46px, radius 12, an icon and never a label, D1's depth: rest, a 2px lift
// with the deeper shadow and an ACCENT_INK edge and glyph on hover, and FILLED ORANGE while its panel
// is open, so an open panel cannot be mistaken for a closed one.
//
// Presentational: `open` is the board's one panel state (null | "filter" | "sort"), and `onPress`
// is handed which icon was pressed — the caller resolves that with nextBoardPanel, so the two panels
// are mutually exclusive by construction rather than by two booleans kept in step.
//
// ⭐ THE FILTER ICON CARRIES A COUNT BADGE: activeClauseCount, how many of the sentence's clauses have
// a choice. Active filters are visible without opening anything — which is why D11's removal of the
// "567 jobs" bar was correct and not a loss.
//
// The SORT icon shows a chosen order the same way: a non-default sort (anything but the curated
// "For you", which sends no sort param) marks the icon active — ACCENT_INK edge and glyph and a dot —
// so a board ordered by something else is visible without opening the panel.
export default function BoardPanelIcons({ open = null, onPress, badge = 0, sortLabel = "", sortChosen = false }) {
  const filterOpen = open === BOARD_PANEL.FILTER;
  const sortOpen = open === BOARD_PANEL.SORT;
  const on = badge > 0;
  return (
    <div className="bpi-row">
      <button type="button" className="bpi" data-board-icon="filter"
        aria-expanded={filterOpen}
        aria-label={on ? `Filters (${badge} active)` : "Filters"}
        title={on ? `${badge} filter${badge === 1 ? "" : "s"} on` : "Filters"}
        onClick={() => onPress?.(BOARD_PANEL.FILTER)}>
        <SlidersHorizontal size={19} aria-hidden="true" />
        {on && <span className="bpi__badge" aria-hidden="true">{badge}</span>}
      </button>
      <button type="button" className="bpi" data-board-icon="sort"
        data-active={sortChosen ? "true" : "false"}
        aria-expanded={sortOpen}
        aria-label={sortLabel ? `Sort: ${sortLabel}` : "Sort"}
        title={sortLabel ? `Sort: ${sortLabel}` : "Sort"}
        onClick={() => onPress?.(BOARD_PANEL.SORT)}>
        <ArrowUpDown size={19} aria-hidden="true" />
        {sortChosen && <span className="bpi__dot" aria-hidden="true" />}
      </button>
    </div>
  );
}

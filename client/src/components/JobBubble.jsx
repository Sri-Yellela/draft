// client/src/components/JobBubble.jsx — the board's column.
//
// ⛔ 47j A248: D1's JOB BUBBLE (the card — logo, company, title, facts and its ATS · Save · Draft · Send rail), its loading
// skeleton, the rows and the bubble pair are DELETED. R2 retired the classic market; the market's list is the plate Index
// (plate/MarketIndex.jsx, its RowBubble the Save / Draft squares). What stays is the board's column, which JobsPanel still
// wraps the Index in. (The file keeps its name so the history reads straight.)
import "./JobBubble.css";

// ⭐ D152 (6) · the board's column. ⛔ D156 (1c) (owner 11-05: "doesnt make sense to have a card and then a panel posting of
// the same thing … the card can turn into the long post"): the posting no longer opens in place of the list (D152 (6) /
// D153 (1)'s cross-fade, and its scroll keeping, are removed) — it is drawn on the deck, in the front card's place
// (DeckView's slot), and the list beside it never folds. Where the reader was is kept by DeckView (it scrolls up to the
// post and back on fold).
export function JobBoardColumns({ children }) {
  return (
    <div className="jb-board">
      <div className="jb-board__list">{children}</div>
    </div>
  );
}

// The star (Save / Star): an outline, filled when saved. Shared since 47f (D196 FIX-8) by the board's bubble
// (components/JobBubble.jsx) and the plate market's row bubble (plate/MarketIndex.jsx) — one drawing, as DraftMark is.
export function StarMark({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

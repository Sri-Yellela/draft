import "./DepthButton.css";

// ── D48 (owner, 10-07) · THE ONE DEPTH-BOX BUTTON ──────────────────────────────────────────────────────
//
// "Probe the entire site for these Apple-styled buttons and replace them with the latest box-styled depth
// ones." Pills are for NON-INTERACTIVE tags and status; an interactive control is a depth box — D1's rest /
// hover / press, the orange fill for the primary (posting-header2.html's .bx / .bx.p). One component, so
// the treatment cannot drift between surfaces again; test/d48DepthButtons.test.js guards the rule.
//
// Props: children (the label), icon (an inline SVG node), primary, pressed (a decided state — aria-pressed),
//   disabled, title, onClick, size ("box" — labelled, 42px; "square" — icon only, 48px; "compact" — a
//   listing row), badge (a small count on a square), caption (shown under a square on touch), tip (a
//   square's hover tooltip; defaults to the title), className. The click never bubbles to a card.
export default function DepthButton({ children, icon = null, primary = false, pressed = false, disabled = false, title,
                                      onClick, size = "box", badge = null, caption = null, tip = null, className = "", ...rest }) {
  const cls = ["dbx", `dbx--${size}`, primary ? "dbx--p" : "", pressed ? "dbx--done" : "", className].filter(Boolean).join(" ");
  const square = size === "square";
  return (
    <button type="button" className={cls} title={title} aria-pressed={pressed || undefined} disabled={disabled}
      aria-label={square ? (typeof children === "string" ? children : title) : undefined}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }} {...rest}>
      {icon}
      {square ? (
        <>
          {badge != null && <span className="dbx__badge" aria-hidden="true">{badge}</span>}
          {caption && <span className="dbx__cap" aria-hidden="true">{caption}</span>}
          <span className="dbx__tip" aria-hidden="true">{tip || title}</span>
        </>
      ) : children}
    </button>
  );
}

// The icons the posting's actions use, drawn once (posting-header2.html's own paths).
const svg = (d) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
export const ICONS = Object.freeze({
  pass: svg("M6 6l12 12M18 6L6 18"),
  save: svg("M12 17.3 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9L12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5z"),
  resume: svg("M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 13h6M9 17h4"),
  letter: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  preview: svg("M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"),
  pdf: svg("M12 3v12M7 10l5 5 5-5M5 21h14"),
  regen: svg("M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"),
});

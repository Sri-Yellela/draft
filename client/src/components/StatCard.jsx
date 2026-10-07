// A93 · THE STAT CARD — one figure with its label. AdminPanel and the DB inspector each defined their own
// (the same card, 2px apart); this is the one. `color` paints the figure; `accent` is the inspector's
// older name for the same thing and is kept so neither caller has to change shape.
export default function StatCard({ label, value, sub, color, accent, theme }) {
  return (
    <div data-stat-card="" style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: "16px 18px", flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.07em", color: theme.textMuted, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || accent || theme.text, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

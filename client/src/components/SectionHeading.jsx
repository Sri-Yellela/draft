// A93 · THE SECTION HEADING — one, shared. It lived inside Auto Apply's private file
// (panels/AutoApplyPanelSections.jsx) while WaitingLine reached in for it, and a second, older
// SectionHeader sat unused in components/. A thing two modules use belongs in components/.
//
// D14: it WRAPS. In the Draft panel's narrow Queued column (a quarter of the width) a title, its
// count and its note do not fit on one line; the title stays whole ("Waiting in line", never
// "Waiting / in line") and the note drops below it.
export function SectionHeading({ children, count, note, theme }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "4px 10px", marginTop: 4, flexWrap: "wrap" }}>
      <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400,
                   fontSize: 20, whiteSpace: "nowrap",
                   color: theme.text }}>
        {children}
      </h3>
      {count != null && (
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{count}</span>
      )}
      {note && <span style={{ fontSize: 11, color: theme.textDim }}>{note}</span>}
      <div style={{ flex: "1 1 24px", height: 1, background: theme.border }} />
    </div>
  );
}

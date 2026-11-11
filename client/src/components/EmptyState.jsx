import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size
// A93 · THE EMPTY STATE — one, shared: a title in the display serif and a sentence under it. The Table and
// the board each drew their own; the board's said "Search for a role above · LinkedIn + Indeed", which
// had been false since the board became direct-ATS only. A caller says what is empty and why, here.
export default function EmptyState({ title, body = null, theme }) {
  return (
    <div data-empty-state="" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 12, padding: 40, color: theme.textDim, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: ts(26), color: theme.text }}>{title}</div>
      {body && <div style={{ fontSize: ts(12.5), color: theme.textDim, maxWidth: 340, lineHeight: 1.7 }}>{body}</div>}
    </div>
  );
}

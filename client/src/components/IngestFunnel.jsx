// 10-14 · ONE SOURCE'S LAST CRAWL AS A FUNNEL — where every fetched posting went.
//
// The owner read "accepted 80 / refused 1,800" off the glance for a greenhouse run that fetched 15,998 and
// left 2,408 on the board: the card showed two of the run's ten counters. This draws the whole partition
// services/ingestFunnel.js computes (pipelineHealth()'s own object — never re-derived here): each gate's
// refusals, the on-board postings retired, what is on the board, and the remainder the crawl does not count,
// named. The glance (panels/adminOps.jsx) and the DB inspector (pages/admin/DBInspector.jsx) both draw it.
//
// D60: the headline is a MARK (styles/mark.js), never a capsule; the bars are flat rectangles. Tokens only.
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";

const num = (n) => (n == null ? "—" : Number(n).toLocaleString());

function Row({ theme, label, n, of, color, indent = 0, title }) {
  const share = of > 0 ? Math.max(0, Math.min(1, n / of)) : 0;
  return (
    <div title={title} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 72px 80px", gap: 8,
                                alignItems: "center", fontSize: 11, padding: "2px 0", paddingLeft: indent }}>
      <span style={{ color: n ? theme.text : theme.textMuted, minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700,
                     color: n ? color || theme.text : theme.textMuted }}>{num(n)}</span>
      <span aria-hidden="true" style={{ height: 6, background: C.SURFACE_2, display: "block" }}>
        <span style={{ display: "block", height: 6, width: `${(share * 100).toFixed(1)}%`, background: color || C.INK_FAINT }}/>
      </span>
    </div>
  );
}

/** `funnel` is a source's `funnel` from pipelineHealth() (or the glance). `name` labels it. */
export default function IngestFunnel({ name, funnel, theme }) {
  if (!funnel) return null;
  const f = funnel;
  const head = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                 color: theme.textMuted, marginTop: 6, marginBottom: 2 };
  return (
    <div data-ingest-funnel={name || ""} style={{ border: `1px solid ${theme.border}`, borderRadius: 8,
                                                 padding: "8px 10px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        {name && <span style={{ fontWeight: 800, fontSize: 12, color: theme.text }}>{name}</span>}
        <span style={markStyle(f.onBoard > 0 ? C.SUCCESS : C.WARNING)}>{num(f.onBoard)} on the board</span>
        <span style={{ fontSize: 11, color: theme.textMuted }}>
          of {num(f.fetched)} fetched · {num(f.refusedTotal)} refused
          {f.retiredTotal > 0 && <> · {num(f.retiredTotal)} retired</>}
        </span>
      </div>

      <div style={head}>Refused</div>
      {f.refused.map(p => <Row key={p.key} theme={theme} label={p.label} n={p.n} of={f.fetched} color={C.WARNING}/>)}

      <div style={head}>Retired from the board by this run</div>
      {f.retired.map(p => <Row key={p.key} theme={theme} label={p.label} n={p.n} of={f.fetched} color={C.DANGER}/>)}

      <div style={head}>On the board</div>
      {f.onBoardParts.map(p => <Row key={p.key} theme={theme} label={p.label} n={p.n} of={f.fetched} color={C.SUCCESS}/>)}
      {/* Inside the parts above, not added to them — the CS rescue's postings (ing-crawl-fixes). */}
      {(f.onBoardIncludes || []).filter(p => p.n > 0).map(p => (
        <Row key={p.key} theme={theme} label={p.label} n={p.n} of={f.fetched} color={C.SUCCESS} indent={12}/>
      ))}

      {f.uncounted !== 0 && (
        <>
          <div style={head}>Not counted</div>
          <Row theme={theme} label={funnel.uncountedNote} n={f.uncounted} of={f.fetched}
            color={f.uncounted < 0 ? C.DANGER : C.INK_FAINT}/>
        </>
      )}
    </div>
  );
}

import PanelShell from "../components/PanelShell.jsx";
import { ATSPanel } from "./ATSPanel.jsx";
import { bandChipStyle } from "../styles/bandStyle.js";
import { atsBandLabel } from "../../../shared/atsBands.js";
import { reportBand } from "../components/AtsReport.jsx";
import { C } from "../styles/colorTokens.js";

// ── AtsReportPanel — the ATS report + generation history, as a PEER of the JD drawer ──────────
//
// ATSPanel itself is pure content (a score dial and some tag sections) and is not touched: it had
// no overlay, no header and no close affordance of its own, because it was only ever rendered as a
// react-resizable-panels column squeezed in beside the board. Wrapping it in PanelShell is
// therefore the whole change — it gains the inset overlay, the dimming scrim, the dark-glass
// surface, both sticky regions, its own scrolling body, the close button and the modal z-tier by
// being a peer rather than by reimplementing any of it.
//
// The tab row (ATS Report / History) is the action bar — sticky region 2 — which is where the
// inline version's tabs already sat relative to its content, so the arrangement the user knows is
// preserved while the chrome around it becomes the shared one.
export default function AtsReportPanel({
  slot = 0, width, focused = true, fullScreen = false, resizeMode = "dock", closesOnEscape,
  onFocus, onResizeStart, onResize, onResizeEnd, onClose,
  theme, activeAts, rightTab, setRightTab, genCount,
  jobId, resumeText, activeProfileId,
  historyContent, onReport = null,
}) {
  // ⛔ CC5 · THE JOB THE REPORT IS ABOUT, WHICH IS NOT NECESSARILY THE SELECTED ONE.
  //
  // `jobId` arrives from JobsPanel's `selectedJob` — the JD drawer's state. That is the right answer
  // only when the report was opened from the drawer. Opened from a card's chip, or from the history
  // list, the two disagree, and ATSPanel's on-demand fetch would then score the wrong posting or
  // (with nothing selected, the usual case for a card click) not fire at all — which is why an
  // unscored row had no route to its term list. The payload names its own job now; the prop stays
  // as the fallback for callers that pass a report without one.
  const reportJobId = activeAts?.jobId ?? jobId;
  const header = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {activeAts?.company || "ATS Report"}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {activeAts?.title || "Match analysis"}
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
        {/* A BAND, NOT THE NUMBER. This printed "Score {n}" on the v3 >=80/>=60 ramp — the one
            surface the band pass (AK2) missed, found by screenshot at UI step 2b. A report with a
            null score is the scorer DECLINING, and says so (the dashed Not-enough-signal chip —
            never a blank, which read as "not scored yet"). No report yet renders nothing at all,
            not even the "ATS" label, which otherwise dangled with nothing after it. */}
        {/* ⛔ A52 · THE HEADER READS THE REPORT THE BODY DRAWS. It read `activeAts.score` — the
            stored score the board was loaded with — while the body below drew a report, so the two
            could disagree inside one panel. With a report, the report's own score governs (null is
            the scorer declining); without one, the score the panel itself just computed, which
            JobsPanel adopts into activeAts (adoptPanelVerdict). */}
        {(activeAts?.score != null || activeAts?.report) && (() => {
          const r = activeAts.report;
          const band = reportBand(r && Object.prototype.hasOwnProperty.call(r, "score") ? r : { score: activeAts.score ?? null });
          return (
            <>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-primary-text)" }}>ATS</span>
              <span title={atsBandLabel(band).blurb}
                style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                         ...bandChipStyle(band) }}>
                {atsBandLabel(band).short}
              </span>
            </>
          );
        })()}
      </div>
    </div>
  );

  const actions = (
    <>
      {[["ats", "ATS Report"], ["history", `History${genCount > 0 ? ` (${genCount})` : ""}`]].map(([id, lbl]) => (
        <button key={id} onClick={() => setRightTab(id)}
          style={{
            padding: "5px 12px", borderRadius: 999, cursor: "pointer",
            fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800,
            fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
            background: rightTab === id ? theme.accent : "transparent",
            color: rightTab === id ? C.ON_ACCENT : theme.textMuted,
            border: `1px solid ${rightTab === id ? theme.accent : theme.border}`,
          }}>
          {lbl}
        </button>
      ))}
    </>
  );

  return (
    <PanelShell
      panelId="ats"
      slot={slot} width={width} focused={focused} fullScreen={fullScreen} closesOnEscape={closesOnEscape}
      resizeMode={resizeMode}
      onClose={onClose} onFocus={onFocus}
      onResizeStart={onResizeStart} onResize={onResize} onResizeEnd={onResizeEnd}
      header={header} actions={actions}
    >
      {/* ATSPanel used to be handed height:100% inside a fixed-height column and scrolled itself.
          PanelShell's body is the scroll container now, so this wrapper only supplies a minimum
          height — a nested scroller here would double the scrollbars. */}
      <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {rightTab === "ats" && (
          <ATSPanel
            report={activeAts?.report}
            score={activeAts?.score}
            jobId={reportJobId}
            resumeText={resumeText}
            activeProfileId={activeProfileId}
            onReport={onReport}
          />
        )}
        {rightTab === "history" && historyContent}
      </div>
    </PanelShell>
  );
}

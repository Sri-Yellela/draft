import { useState, useEffect } from "react";
import PanelShell from "../components/PanelShell.jsx";
import CompanyLogo from "../components/CompanyLogo.jsx";
import CompanyLink from "../components/CompanyLink.jsx";
import ResumeList, { ScoreBox, RESUME_ICONS } from "../components/ResumeList.jsx";
import { api } from "../lib/api.js";
import { ATSPanel } from "../components/ATSPanel.jsx";
import { atsBandLabel } from "../../../shared/atsBands.js";
import { reportBand } from "../components/AtsReport.jsx";

// ── AtsReportPanel — the ATS report + generation history, as a PEER of the JD drawer ──────────
//
// ATSPanel itself is pure content (a score dial and some tag sections) and is not touched: it had
// no overlay, no header and no close affordance of its own, because it was only ever rendered as a
// react-resizable-panels column squeezed in beside the board. Wrapping it in PanelShell is
// therefore the whole change — it gains the inset overlay, the dimming scrim, the dark-glass
// surface, both sticky regions, its own scrolling body, the close button and the modal z-tier by
// being a peer rather than by reimplementing any of it.
//
// The tab row (ATS report / History) is the action bar — sticky region 2. ⭐ D62 (owner 10-07): the frame
// and its History were still the old site — a Strong capsule, a bold "Base 62 → tailored 70" sentence,
// condensed uppercase capsule tabs, and a History of letter tiles and flat dark squares. They are now the
// current language: CompanyLogo, the logo face, the number box, depth boxes, and ResumeList.
export default function AtsReportPanel({
  slot = 0, width, focused = true, fullScreen = false, resizeMode = "dock", closesOnEscape, reserveRight = 0,
  onFocus, onResizeStart, onResize, onResizeEnd, onClose,
  theme, activeAts, rightTab, setRightTab, genCount,
  jobId, resumeText, activeProfileId,
  onOpenVersion = null, onExportVersion = null, onReport = null,
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
  // ⭐ D62 · HISTORY = THE RÉSUMÉ VERSIONS FOR THIS JOB (resume_versions), newest first — not the
  // account-wide list of generated résumés it used to show. Fetched when the job changes.
  const [versions, setVersions] = useState(null);
  useEffect(() => {
    if (!reportJobId) { setVersions([]); return undefined; }
    let live = true;
    setVersions(null);
    api(`/api/resumes/${encodeURIComponent(reportJobId)}/versions`)
      .then(rows => { if (live) setVersions(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (live) setVersions([]); });
    return () => { live = false; };
  }, [reportJobId, genCount]);

  // ⭐ D62 · THE HEADER, in the current language: CompanyLogo · the company in the logo face (the ONE
  // company link, D38) · the number box (D50) — never a band capsule · base → tailored as a two-number
  // mark in the serif ("62 → 70"), not a bold sentence. ⛔ D58: a tailored score BELOW the base is said.
  // ⛔ A52 · THE BOX READS THE REPORT THE BODY DRAWS: with a report, its own score governs (null is the
  // scorer declining → no digits); without one, the score the panel itself computed (adoptPanelVerdict).
  const r = activeAts?.report;
  const reportScore = r && Object.prototype.hasOwnProperty.call(r, "score") ? r.score : (activeAts?.score ?? null);
  const pair = activeAts?.pair || null;
  const shown = pair?.shown ?? reportScore;
  const band = (activeAts?.score != null || r) ? reportBand(r && Object.prototype.hasOwnProperty.call(r, "score") ? r : { score: activeAts?.score ?? null }) : null;
  const header = (
    <div className="atsp__hdr" data-ats-panel-header="">
      {activeAts?.company
        ? <CompanyLogo company={activeAts.company} iconUrl={activeAts.companyIconUrl} size={40} radius={11} />
        : <span />}
      <div className="atsp__who">
        {activeAts?.company
          ? <CompanyLink company={activeAts.company} href={activeAts.applyUrl || null} jobId={reportJobId} size="row" />
          : <span className="company-link company-link--row">ATS report</span>}
        <div className="atsp__title">{activeAts?.title || "Match analysis"}</div>
        {pair?.base != null && pair?.tailored != null && (
          <div className="atsp__pair">
            <span data-ats-pair="" data-lower={pair.lower ? "true" : undefined}
              className={`mark ${pair.lower ? "mark--warn" : "mark--dim"}`}
              title={pair.line || undefined}>
              {pair.base} → {pair.tailored}{pair.lower ? " · lower than your base" : ""}
            </span>
          </div>
        )}
      </div>
      <span data-ats-band={band || undefined} title={band ? `${atsBandLabel(band).short} — ${atsBandLabel(band).blurb}` : undefined}>
        <ScoreBox score={Number.isFinite(shown) ? shown : null} caption={pair?.tailoredShown ? "tailored" : "ATS"} />
      </span>
    </div>
  );

  // ⭐ D62 · TABS ARE DEPTH BOXES in the logo face, the active one filled accent (D60) — not the old
  // condensed uppercase capsules.
  const count = versions?.length || 0;
  const actions = (
    <div className="atsp__tabs" role="tablist" aria-label="ATS panel">
      {[["ats", "ATS report"], ["history", count ? `History · ${count}` : "History"]].map(([id, lbl]) => (
        <button key={id} type="button" role="tab" className="atsp__tab" aria-selected={rightTab === id}
          data-ats-tab={id} onClick={() => setRightTab(id)}>
          {lbl}
        </button>
      ))}
    </div>
  );

  const versionRows = (versions || []).map(v => ({
    key: `${v.job_id}-${v.version}`,
    title: `Version ${v.version}`,
    meta: [v.created_at ? new Date(v.created_at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null,
           Number.isFinite(v.base_ats_score) ? `base ${Math.round(v.base_ats_score)}` : null].filter(Boolean).join(" · "),
    score: Number.isFinite(v.ats_score) ? v.ats_score : null,
    actions: [
      { id: "view", label: `View version ${v.version}`, icon: RESUME_ICONS.view, onClick: () => onOpenVersion?.(v) },
      { id: "download", label: `Download version ${v.version} as PDF`, icon: RESUME_ICONS.download, onClick: () => onExportVersion?.(v) },
    ],
  }));

  return (
    <PanelShell
      panelId="ats"
      slot={slot} width={width} focused={focused} fullScreen={fullScreen} closesOnEscape={closesOnEscape} reserveRight={reserveRight}
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
        {rightTab === "history" && (versions === null
          ? <div className="rl__empty">Loading versions…</div>
          : <ResumeList rows={versionRows} empty="No résumé generated for this job yet — generate one from the posting panel." />)}
      </div>
    </PanelShell>
  );
}

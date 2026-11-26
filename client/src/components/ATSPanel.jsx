// client/src/components/ATSPanel.jsx — the ATS report LOADER for the posting's match panel (A93: shared, not one page's).
// The source: 1. the generated résumé's ats_report (given to the card); 2. otherwise FitCard's own /fit-card read (the base
// résumé). ⭐ D202 (47h, owner yes): what it draws is THE FitCard — the classic option-C card (46x) is retired.
import { useEffect } from "react";
import FitCard, { fitCardFor } from "../plate/FitCard.jsx";   // ⭐ D202 (owner 11-25: yes): ONE card — the classic ATS card is gone
import PlateRoot from "../plate/PlateRoot.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// `onReport(jobId, report)` (A52): called when this panel has scored a posting itself, so the board can show THIS verdict on
// the card and the JD header instead of the stored one it loaded earlier — one scoring read per screen.
// ⭐ D152 (8): `history` (the job's résumé versions) passes through to the card. `band` / `bare` / `activeProfileId` are
// accepted for the callers' sake and no longer change what is drawn.
// ⭐ D202 (47h, the owner's yes): the posting's match panel draws THE FitCard — the field card ⇄ the ATS card, the same component
// as the market's and the opening sheet's (no third version). With a generated résumé's report (priority 1) the card is that
// report, given; otherwise FitCard reads GET /api/jobs/:id/fit-card itself (the base résumé, shared cache) and the board
// is told the verdict (A52, `onReport`) — the old POST /keywords read is gone with the classic card.
export function ATSPanel({ report, score, jobId, resumeText, activeProfileId, onReport = null, history = null }) {
  useEffect(() => {
    if (report || !jobId || !onReport) return undefined;
    let live = true;
    fitCardFor(jobId).then((d) => { if (live && d?.report) onReport(jobId, d.report); }).catch(() => {});
    return () => { live = false; };
  }, [jobId, report, activeProfileId]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = { padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
    color: "var(--color-text-muted)", fontSize: ts(13), textAlign: "center" };
  // No base résumé uploaded yet
  if (!report && !resumeText) return <div style={box}>Add a base résumé to see how it matches this job.</div>;
  // ⛔ A52 · ONE READ: a generated report on screen governs — its score, including a null (the scorer declining).
  const given = report ? { report: Object.prototype.hasOwnProperty.call(report, "score") ? report : { ...report, score: score ?? null }, contextual: report.contextual || null } : null;
  return (
    <PlateRoot className="pl-atspanel" data-ats-card="">
      <FitCard key={`${jobId}|${activeProfileId ?? ""}`} jobId={given ? null : jobId} data={given} history={history}/>
    </PlateRoot>
  );
}

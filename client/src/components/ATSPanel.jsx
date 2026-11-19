// client/src/components/ATSPanel.jsx — the ATS report LOADER for the posting's match panel (A93: shared, not one page's).
// KEYWORD DATA SOURCE PRIORITY:
// 1. ats_report from generated resume (most accurate)
// 2. ats_only_reports cache
// 3. Fresh POST /api/jobs/:id/keywords call (base resume)
//
// ⭐ 46x (owner 11-19: "ditch the whole prove it and claim it gimmick and definitely ditch it from the jd panel, its just too
// much text jargon", then "I say C"): what it draws is ONE card — components/AtsCard.jsx (option C of
// https://claude.ai/artifact/Fx8EDAEByAkLuBcADt7v2W). The claims ("That's true of me", AG2) and the quick check a claim opened
// (D169 P2) are gone from here; the old report component (AtsReport) no longer draws in this panel. The profile's own skill
// lists and Atlas's Your skills are untouched.
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { AtsCard } from "./AtsCard.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// `onReport(jobId, report)` (A52): called when this panel has scored a posting itself, so the board can show THIS verdict on
// the card and the JD header instead of the stored one it loaded earlier — one scoring read per screen.
// ⭐ D152 (8): `history` (the job's résumé versions) passes through to the card. `band` / `bare` / `activeProfileId` are
// accepted for the callers' sake and no longer change what is drawn.
export function ATSPanel({ report, score, jobId, resumeText, activeProfileId, onReport = null, history = null }) {
  const [localReport, setLocalReport] = useState(null);
  const [kwLoading,   setKwLoading]   = useState(false);
  const [kwError,     setKwError]     = useState(false);

  // Reset when the selected job — or the profile — changes.
  useEffect(() => {
    setLocalReport(null);
    setKwError(false);
  }, [jobId, activeProfileId]);

  // Fetch the keyword analysis when no generated-resume report exists
  useEffect(() => {
    if (report) return;              // Priority 1 — generated resume covers this
    if (!jobId || !resumeText) return;
    if (localReport || kwLoading) return;

    let cancelled = false;
    setKwLoading(true);
    setKwError(false);
    api(`/api/jobs/${jobId}/keywords`, {
      method: "POST",
      body: JSON.stringify({ resumeText }),
    })
      .then(data => {
        if (cancelled) return;
        setLocalReport(data);
        if (data && onReport) onReport(jobId, data);
      })
      .catch(() => { if (!cancelled) setKwError(true); })
      .finally(() => { if (!cancelled) setKwLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, resumeText, report]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeReport = report ?? localReport;
  const box = { padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
    color: "var(--color-text-muted)", fontSize: ts(13), textAlign: "center" };

  // No base resume uploaded yet
  if (!activeReport && !resumeText && !kwLoading) {
    return <div style={box}>Add a base résumé to see how it matches this job.</div>;
  }
  if (kwLoading) {
    return <div style={box} role="status">Reading your résumé against this job…</div>;
  }
  if (kwError) {
    return (
      <div style={box}>
        <div>Could not read your résumé against this job.</div>
        <button onClick={() => { setKwError(false); setLocalReport(null); }}
          style={{ marginTop: 4, padding: "6px 16px", borderRadius: 6, border: "none", background: "var(--color-primary)",
                   color: "var(--color-on-primary)", cursor: "pointer", fontWeight: 600, fontSize: ts(12) }}>
          Retry
        </button>
      </div>
    );
  }
  if (!activeReport) return null;

  // ⛔ A52 · ONE READ: when a report is on screen, ITS score governs — including a null (the scorer declining). The bare
  // `score` prop is used only for a report that carries no score field at all.
  const shown = Object.prototype.hasOwnProperty.call(activeReport, "score") ? activeReport : { ...activeReport, score: score ?? null };
  return <AtsCard report={shown} jobId={jobId} history={history} />;
}

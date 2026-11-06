// components/AttemptResume.jsx — ⭐ D171 FIX 4 (owner 11-06: "resume opens as a downloaded pdf in a new tab"): an
// application attempt's résumé opens IN draft — the embedded editor's full-screen view (D157, lib/resumeEditor.js) —
// and only "PDF" downloads. One component for every place an attempt shows its résumé (Home's application rows, the
// attempt history, the approval step, Ready to review), so they can't drift apart again.
//
// A résumé that was already SENT opens read-only (the server says: GET /api/apply/run-jobs/:id/resume-doc), because
// what was sent is a record. Before it's sent, an edit saves to the job's tailored résumé — the one the attempt
// attaches — so what the person fixes is what goes out.
import { useState } from "react";
import { api } from "../lib/api.js";
import { openResumeEditor } from "../lib/resumeEditor.js";

export default function AttemptResume({ runJobId, artifactUrl, className, style, label = "Résumé" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pdfUrl = artifactUrl(runJobId, "resume");
  const download = `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1`;

  async function open(e) {
    e.stopPropagation();
    setBusy(true); setError("");
    try {
      const d = await api(`/api/apply/run-jobs/${encodeURIComponent(runJobId)}/resume-doc`);
      openResumeEditor({
        html: d.html, jobId: d.jobId, company: d.company, title: d.title,
        readOnly: !!d.readOnly,
        readOnlyNote: d.readOnly ? "Sent — this is the résumé that went out" : "",
        downloadPdfUrl: download,
        // The editor can't be reached: the PDF in a tab, as before, is better than nothing.
        fallback: () => window.open(pdfUrl, "_blank", "noopener"),
      });
    } catch (err) {
      setError(err?.message || "The résumé couldn't be opened.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className={className} style={style} onClick={open} disabled={busy}
        data-attempt-resume="open" title="Open the résumé in draft">{busy ? "Opening…" : label}</button>
      <a className={className} style={{ ...style, textDecoration: "none" }} href={download} download
        onClick={e => e.stopPropagation()} data-attempt-resume="pdf" title="Download the résumé as a PDF">PDF ↓</a>
      {error && <span role="alert" style={{ fontSize: 10.5, color: "var(--color-text-muted)" }}>{error}</span>}
    </>
  );
}

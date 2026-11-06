// components/AttemptResume.jsx — ⭐ D171 FIX 4 (owner 11-06: "resume opens as a downloaded pdf in a new tab"; 11-06 again:
// "resume on home should open the resume sandbox editor, but its taking me to your resumes"): an application's résumé
// opens IN draft — the embedded editor's full-screen view (D157, lib/resumeEditor.js) — from every place Home shows
// one, and only "PDF" downloads. One component for all of them, so they can't drift apart again.
//
// Where the résumé comes from, first found wins:
//   runJobId  an attempt's own résumé (GET /api/apply/run-jobs/:id/resume-doc — read-only once sent)
//   recordId  an application's kept copy, as sent (GET /api/applications/:id/resume — always read-only)
//   jobId     the job's tailored résumé (GET /api/resumes/:jobId) — read-only when the caller says it was sent
// A source that has no résumé falls through to the next. Before it's sent, an edit saves to the job's tailored
// résumé — the one an attempt attaches — so what the person fixes is what goes out.
import { useState } from "react";
import { api, authHeaders } from "../lib/api.js";
import { openResumeEditor } from "../lib/resumeEditor.js";

const SENT_NOTE = "Sent — this is the résumé that went out";

async function loadDoc({ runJobId, recordId, jobId, company, title, sent }) {
  if (runJobId != null) {
    try {
      const d = await api(`/api/apply/run-jobs/${encodeURIComponent(runJobId)}/resume-doc`);
      if (d?.html) return { ...d, readOnly: !!d.readOnly || !!sent };
    } catch { /* no résumé on this attempt — try the next source */ }
  }
  if (recordId != null) {
    const r = await fetch(`/api/applications/${encodeURIComponent(recordId)}/resume?inline=1`, { credentials: "include", headers: authHeaders() });
    if (r.ok) return { html: await r.text(), jobId: null, company, title, readOnly: true };
  }
  if (jobId != null) {
    const d = await api(`/api/resumes/${encodeURIComponent(jobId)}`).catch(() => null);
    if (d?.html) return { html: d.html, jobId, company: company || d.company, title: title || d.role, readOnly: !!sent };
  }
  throw new Error("No résumé is stored for this application.");
}

export default function AttemptResume({ runJobId = null, recordId = null, jobId = null, sent = false, company = "", title = "",
  artifactUrl = null, className, style, label = "Résumé" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pdfUrl = runJobId != null && artifactUrl ? artifactUrl(runJobId, "resume") : null;
  const download = pdfUrl ? `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1` : null;

  async function open(e) {
    e.stopPropagation();
    setBusy(true); setError("");
    try {
      const d = await loadDoc({ runJobId, recordId, jobId, company, title, sent });
      openResumeEditor({
        html: d.html, jobId: d.jobId, company: d.company || company, title: d.title || title,
        readOnly: !!d.readOnly, readOnlyNote: d.readOnly ? SENT_NOTE : "",
        downloadPdfUrl: download,
        // The editor can't be reached: the PDF in a tab, as before, is better than nothing.
        fallback: () => { if (pdfUrl) window.open(pdfUrl, "_blank", "noopener"); },
      });
    } catch (err) {
      setError(err?.message || "The résumé couldn't be opened.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className={className} style={style} onClick={open} disabled={busy}
        data-attempt-resume="open" title="Open the résumé in draft">{busy ? "Opening…" : label}</button>
      {download && (
        <a className={className} style={{ ...style, textDecoration: "none" }} href={download} download
          onClick={e => e.stopPropagation()} data-attempt-resume="pdf" title="Download the résumé as a PDF">PDF ↓</a>
      )}
      {error && <span role="alert" style={{ fontSize: 10.5, color: "var(--color-text-muted)" }}>{error}</span>}
    </>
  );
}

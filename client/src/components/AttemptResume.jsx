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
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const SENT_NOTE = "Sent — this is the résumé that went out";

async function loadDoc({ runJobId, recordId, jobId, company, title, sent }) {
  let missing = null;   // ⭐ (A)-1: the attempt's own answer when it has no résumé — { reason, canGenerate }
  if (runJobId != null) {
    try {
      const d = await api(`/api/apply/run-jobs/${encodeURIComponent(runJobId)}/resume-doc`);
      if (d?.html) return { ...d, readOnly: !!d.readOnly || !!sent };
    } catch (e) { missing = { reason: e?.payload?.reason || null, canGenerate: e?.payload?.canGenerate ?? !sent }; }
  }
  if (recordId != null) {
    const r = await fetch(`/api/applications/${encodeURIComponent(recordId)}/resume?inline=1`, { credentials: "include", headers: authHeaders() });
    if (r.ok) return { html: await r.text(), jobId: null, company, title, readOnly: true };
  }
  if (jobId != null) {
    const d = await api(`/api/resumes/${encodeURIComponent(jobId)}`).catch(() => null);
    if (d?.html) return { html: d.html, jobId, company: company || d.company, title: title || d.role, readOnly: !!sent };
  }
  throw Object.assign(new Error("No résumé was made for this one."), { missing: runJobId != null ? (missing || { reason: null, canGenerate: !sent }) : null });
}

export default function AttemptResume({ runJobId = null, recordId = null, jobId = null, sent = false, company = "", title = "",
  artifactUrl = null, className, style, label = "Résumé" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(null);   // ⭐ (A)-1: { reason, canGenerate } when the attempt has no résumé
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
      if (err?.missing) setMissing(err.missing);
      else setError(err?.message || "The résumé couldn't be opened.");
    } finally { setBusy(false); }
  }
  // ⭐ (A)-1 (45o, owner 11-08): "No résumé was made for this one — Generate it" — ONE press, no retries: the run job's own
  // generator makes it and attaches it, then it opens. A failure says why (and is recorded on the run job).
  async function generate(e) {
    e.stopPropagation();
    setBusy(true); setError("");
    try {
      await api(`/api/apply/run-jobs/${encodeURIComponent(runJobId)}/generate-resume`, { method: "POST", body: "{}" });
      setMissing(null);
      await open(e);
    } catch (err) {
      setError(err?.payload?.reason ? `It couldn't be made: ${String(err.payload.reason).replace(/^[a-z_]+: /, "")}` : (err?.message || "It couldn't be made just now."));
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
      {missing && (
        <span role="status" data-attempt-resume="missing" style={{ fontSize: ts(11), color: "var(--color-text-muted)" }}>
          No résumé was made for this one{missing.canGenerate ? " — " : "."}
          {missing.canGenerate && <button type="button" className={className} style={style} onClick={generate} disabled={busy} data-attempt-resume="generate">{busy ? "Making it…" : "Generate it"}</button>}
          {missing.reason && <span title={missing.reason}> ({String(missing.reason).replace(/^[a-z_]+: /, "").slice(0, 80)})</span>}
        </span>
      )}
      {error && <span role="alert" style={{ fontSize: ts(10.5), color: "var(--color-text-muted)" }}>{error}</span>}
    </>
  );
}

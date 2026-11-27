// ⭐ 47m (D199 C7, the coordinator's "Left" list; agent's pick — owner may reverse) · THE OPENING SHEET'S 06 — YOUR APPLICATION.
// The sheet is the posting's one home now (the deck-slot posting, JobDetailPanel and SandboxPanel are deleted), so what they
// held lives here, each piece the same call it always was (JobsPanel's selectedJobMeta — the board stays mounted under the
// sheet and publishes it for the sheet's job):
//   the résumé for this job — which résumé (D164), Résumé for this job / Regenerate (draft's or the person's own model, D86's
//   ByomResumeChoice), Preview / edit (resume-master's editor), What we changed (D90), Download PDF · Download HTML, its state
//   in words (Ready · Generating… · Failed — Try again, D57 / D164) and the day's drafts (A63);
//   THE LIVE VIEW SandboxPanel drew — the generating stage, a failure, a missing artifact (Dismiss), the company KB's findings
//   (Accept applies the fix and saves, Reject, Acknowledge — A105 finding 9), the A+ / Generate switch, and the READ-ONLY
//   preview when the editor can't be reached (A204's fallback), with Edit in the editor · Download;
//   History — this job's résumé versions, each viewed or downloaded (D62 / D152 (8));
//   More — the cover letter, I applied myself (D56), the extension (A167 (h));
//   the company notice (D54) and the posting's stated eligibility (D59), and Pending · record it (A63).
// ⛔ D190: nothing here calls a model of its own — Generate is the board's one generate call.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { resumeControlState, draftButtonState } from "../lib/jobDecisions.js";
import ByomResumeChoice, { ByomStatus, useByomFlow } from "../components/ByomResumeChoice.jsx";
import { WhatWeChangedLink } from "../components/ResumeChangesPanel.jsx";
import ResumeList, { RESUME_ICONS } from "../components/ResumeList.jsx";
import CoverLetterModal from "../components/CoverLetterModal.jsx";
import ExtensionPanel from "../components/ExtensionPanel.jsx";
import { Skeleton } from "./PlateState.jsx";

/** "2h ago" — when the stored résumé was made (D57). */
export function resumeAgo(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return null;
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** When the next draft frees up, on the viewer's own clock: "4:12 pm" today, "Tue 4:12 pm" later. */
export function clockLabel(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return null;
  const at = new Date(ms);
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return at.toDateString() === new Date(now).toDateString() ? time
    : `${at.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

/** A KB suggestion's exact fix (diff.from → diff.to, services/kb/failsafe.js) applied to the résumé's html: [html, count]. */
export function applyFindingToHtml(html, f) {
  const from = f?.diff?.from, to = f?.diff?.to;
  if (!html || !from || to == null) return [html, 0];
  const n = String(html).split(from).length - 1;
  return [n ? String(html).split(from).join(to) : html, n];
}

/** D56 · the manual route records its own submission — one piece of evidence verifies it (A63), else "recorded, not verified". */
function ManualSubmitted({ jobId }) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setOpen(false); setEvidence(""); setMsg(null); }, [jobId]);
  const record = async () => {
    const e = evidence.trim();
    const body = { submittedAt: Date.now(), method: "company_site" };
    if (/^https?:\/\//i.test(e)) body.evidenceUrl = e;
    else if (/^[A-Za-z0-9][A-Za-z0-9#._/-]{3,63}$/.test(e) && /\d/.test(e)) body.reference = e;
    else if (e) body.evidenceText = e;
    setBusy(true);
    try {
      const d = await api(`/api/applications/pending/${encodeURIComponent(jobId)}/record`, { method: "POST", body: JSON.stringify(body) });
      setMsg(d.message || (d.verified ? "Recorded." : "Recorded, not verified yet."));
      if (d.verified) setOpen(false);
    } catch (err) { setMsg(err.message || "Could not record it."); }
    finally { setBusy(false); }
  };
  return (
    <div className="pl-opr__submitted" data-manual-submitted="">
      {!open && <button type="button" className="pl-btn pl-btn--secondary" onClick={() => setOpen(true)}>I applied myself</button>}
      {open && (
        <form className="pl-opr__form" onSubmit={(ev) => { ev.preventDefault(); record(); }}>
          <input type="text" className="pl-q-input" value={evidence} onChange={(ev) => setEvidence(ev.target.value)}
            aria-label="Confirmation link, email subject, or reference number" placeholder="Confirmation link, email subject, or reference number" />
          <button type="submit" className="pl-btn pl-btn--secondary" disabled={busy}>{busy ? "Recording…" : "Record it"}</button>
        </form>
      )}
      {msg && <p className="pl-op__quiet" role="status">{msg}</p>}
    </div>
  );
}

/**
 * SandboxPanel's live view, on the sheet: generating · failed · missing · the KB findings · the A+ / Generate switch · the
 * read-only preview (the editor's fallback). `entry` = the board's sandbox entry for this job; `onSave(html, artifact)` /
 * `onExport(job, html, company, artifact)` / `onDismiss()` / `onEdit(artifact)` are the board's own.
 */
function LiveView({ entry, onSave, onExport, onDismiss, onEdit }) {
  const variants = entry?.variants || null;
  const keys = variants ? Object.keys(variants) : [];
  const [tool, setTool] = useState(entry?.activeTool || entry?.tool || "generate");
  const [decisions, setDecisions] = useState({});
  const [said, setSaid] = useState("");
  useEffect(() => { setTool(entry?.activeTool || entry?.tool || "generate"); setDecisions({}); setSaid(""); }, [entry?.jobId, entry?.html, entry?.tool, entry?.activeTool]);
  if (!entry) return null;
  const active = variants?.[tool] || entry;
  if (active.generating || entry.generating) {
    return (
      <div className="pl-opr__live" data-sheet-generating="" role="status">
        <span className="pl-label">{(entry.stage || active.stage || "Generating…").toUpperCase()}</span>
        <Skeleton label={entry.stage || "Generating the résumé"} height={180} radius="plate" lines={5}/>
      </div>
    );
  }
  if (entry.missing || entry.error) {
    return (
      <div className="pl-opr__live" data-sheet-failed={entry.missing ? "missing" : "error"} role="alert">
        <span className="pl-label pl-tone-clay">{entry.missing ? "THE RÉSUMÉ COULDN’T BE LOADED" : "GENERATION FAILED"}</span>
        <p className="pl-op__quiet">{entry.missing ? "This résumé was expected from a previous run, but the stored artifact could not be loaded." : null}
          {entry.error ? <> {String(entry.error)}</> : null}</p>
        <div className="pl-opr__acts"><button type="button" className="pl-btn pl-btn--secondary" onClick={onDismiss}>Dismiss</button></div>
      </div>
    );
  }
  const findings = active.kbFindings || [];
  const accept = async (f, i) => {
    const [html, n] = applyFindingToHtml(active.html, f);
    if (!n) { setDecisions((p) => ({ ...p, [i]: "not found in the résumé" })); return; }
    try { await onSave?.(html, active); setDecisions((p) => ({ ...p, [i]: "accepted" })); }
    catch { setDecisions((p) => ({ ...p, [i]: "couldn’t save" })); }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([active.html || ""], { type: "text/html" }));
    a.download = `Resume_${(active.company || "resume").replace(/\s+/g, "_")}.html`;
    a.click();
  };
  const pdf = async () => {
    try { setSaid("Exporting…"); await onExport?.(null, active.html, active.company, active); setSaid(""); }
    catch (e) { setSaid(`PDF export failed: ${e?.message || "try again"}`); }
  };
  return (
    <div className="pl-opr__live" data-sheet-preview="">
      {keys.length > 1 ? (
        <div className="pl-opr__acts" role="group" aria-label="Which résumé to show" data-sheet-variants="">
          {keys.map((k) => (
            <button key={k} type="button" className="pl-btn pl-btn--secondary" aria-pressed={tool === k} onClick={() => setTool(k)}>
              {variants[k]?.toolLabel || (k === "a_plus_resume" ? "A+ Resume" : "Generate")}
            </button>
          ))}
        </div>
      ) : null}
      {findings.length ? (
        <div className="pl-opr__kb" data-sheet-kb="">
          <span className="pl-label">{findings.length} COMPANY-KB FINDING{findings.length > 1 ? "S" : ""} TO REVIEW</span>
          {findings.map((f, i) => {
            const d = decisions[i], flag = f.type === "flag";
            return (
              <div key={i} className="pl-opr__kbrow">
                <span className="pl-label" data-kind={flag ? "flag" : "suggestion"}>{flag ? "FLAG" : "SUGGESTION"}</span>
                <span className="pl-opr__kbtext">{f.message}{f.evidence?.length ? <span className="pl-muted"> — {f.evidence.join("; ")}</span> : null}</span>
                {d ? <span className="pl-muted">{d}</span> : flag
                  ? <button type="button" className="pl-btn pl-btn--secondary" onClick={() => setDecisions((p) => ({ ...p, [i]: "acknowledged" }))}>Acknowledge</button>
                  : <>
                      <button type="button" className="pl-btn pl-btn--secondary" title={f.diff ? `Replace “${f.diff.from}” with “${f.diff.to}”` : undefined} onClick={() => accept(f, i)}>Accept</button>
                      <button type="button" className="pl-btn pl-btn--secondary" onClick={() => setDecisions((p) => ({ ...p, [i]: "rejected" }))}>Reject</button>
                    </>}
              </div>
            );
          })}
        </div>
      ) : null}
      {active.html ? (
        <>
          <p className="pl-op__quiet">A read-only preview{entry.fallback ? " — the editor couldn’t be reached just now" : ""}. Edit it in the editor; the PDF breaks where A4 does.</p>
          <iframe className="pl-opr__frame" title="Résumé preview" srcDoc={active.html} sandbox="allow-same-origin"/>
          <div className="pl-opr__acts">
            <button type="button" className="pl-btn pl-btn--primary" onClick={() => onEdit?.(active)} data-edit-in-editor="">Edit in the editor</button>
            <button type="button" className="pl-btn pl-btn--secondary" onClick={pdf}>Download PDF</button>
            <button type="button" className="pl-btn pl-btn--secondary" onClick={download}>Download HTML</button>
            <button type="button" className="pl-btn pl-btn--secondary" onClick={onDismiss}>Close the preview</button>
            {said ? <span className="pl-op__quiet" role="status">{said}</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * 06 · the sheet's application block. `job` = the board's job (its jobId, title, company, flags), `meta` = JobsPanel's
 * selectedJobMeta for it, or null while the board is not on screen under the sheet (then it says where to go).
 */
export default function SheetResume({ job, meta }) {
  const navigate = useNavigate();
  const jobId = job?.jobId || job?.id || null;
  const [slots, setSlots] = useState(null);
  const [pending, setPending] = useState(null);
  const [letter, setLetter] = useState(false);
  const [versions, setVersions] = useState(null);
  const generating = meta?.st;
  useEffect(() => {
    if (!jobId) return undefined;
    let live = true;
    api("/api/draft/slots").then((d) => { if (live) setSlots(d); }).catch(() => {});
    api("/api/applications/pending").then((d) => {
      if (live) setPending((d?.pending || []).find((x) => String(x.jobId) === String(jobId))?.state ?? null);
    }).catch(() => {});
    return () => { live = false; };
  }, [jobId, generating, meta?.drafted]);
  const genCount = meta?.genCount ?? 0;
  useEffect(() => {
    if (!jobId) return undefined;
    let live = true;
    setVersions(null);
    api(`/api/resumes/${encodeURIComponent(jobId)}/versions`).then((r) => { if (live) setVersions(Array.isArray(r) ? r : []); })
      .catch(() => { if (live) setVersions([]); });
    return () => { live = false; };
  }, [jobId, genCount]);
  const byom = useByomFlow(job);
  const [sourceId, setSourceId] = useState(meta?.resumeSourceId ?? null);
  useEffect(() => { setSourceId(meta?.resumeSourceId ?? null); }, [jobId, meta?.resumeSourceId]);
  if (!job) return null;
  if (!meta) {
    return <p className="pl-op__quiet" data-sheet-resume="waiting">Your résumé for this job, its history and the cover letter open here once the market has loaded under this sheet.</p>;
  }
  const { g, done, st, canUseGenerate: canGen, onGenerate, onViewSandbox, onExport, onExportHtml = null, onRegenerate = null,
    companyNotice = null, eligibilityNotice = null, genError = null, resumeSources = [] } = meta;
  const noSlots = slots != null && slots.remaining <= 0;
  const hasArtifact = done && !!g?.html;
  const ago = hasArtifact ? resumeAgo(g?.generatedAt) : null;
  const busyGen = st === "generate";
  const genOpts = sourceId != null ? { profileId: sourceId } : undefined;
  const runGenerate = () => onGenerate?.(false, genOpts);
  const regen = onRegenerate ? () => onRegenerate(genOpts) : () => onGenerate?.(true, genOpts);
  const state = resumeControlState({ hasArtifact, generating: busyGen, error: genError, ago });
  const freeAt = noSlots && slots?.nextFreeAt ? clockLabel(slots.nextFreeAt) : null;
  const quota = slots ? (noSlots
    ? `You’ve used your drafts for now — the next one frees up ${freeAt ? `at ${freeAt}` : "within 24 hours"}.`
    : `${slots.remaining} of ${slots.limit} drafts left in the last 24 hours — a Draft or a new résumé uses one.`) : null;
  const genTitle = noSlots ? quota : `${done ? "Regenerate" : "Generate"} résumé — uses 1 of your ${slots?.limit ?? 10} drafts (a Draft uses one too). Takes about 10–20 seconds.`;
  const activeSource = resumeSources.find((s) => String(s.id) === String(sourceId)) || null;
  const label = [job.title, job.company].filter(Boolean).join(" · ");
  const split = (text, onRun) => <ByomResumeChoice byom={byom} label={text} onGenerate={onRun} disabled={!!st || noSlots} busy={busyGen}/>;
  const versionRows = (versions || []).map((v) => ({
    key: `${v.job_id}-${v.version}`, title: `Version ${v.version}`,
    meta: [v.created_at ? new Date(v.created_at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null,
      Number.isFinite(v.base_ats_score) ? `base ${Math.round(v.base_ats_score)}` : null].filter(Boolean).join(" · "),
    score: Number.isFinite(v.ats_score) ? v.ats_score : null,
    actions: [
      { id: "view", label: `View version ${v.version}`, icon: RESUME_ICONS.view, onClick: () => meta.onOpenVersion?.(v) },
      { id: "download", label: `Download version ${v.version} as PDF`, icon: RESUME_ICONS.download, onClick: () => meta.onExportVersion?.(v) },
    ],
  }));
  // D51: a drafted job's Draft opens Draft House — said here too, beside the record.
  const draft = draftButtonState({ drafted: !!meta.drafted, drafting: !!meta.drafting, block: meta.draftBlock || null, canView: !!meta.onViewDraft, slots });
  return (
    <div className="pl-opr" data-sheet-resume="">
      <div className="pl-op__card pl-opr__card" role="group" aria-label="Your résumé for this job" data-posting-resume="">
        <div className="pl-opr__head">
          <span className="pl-label">THE RÉSUMÉ FOR THIS JOB</span>
          <span className="pl-opr__state" data-resume-state={state.kind} role={state.kind === "failed" ? "alert" : state.kind === "generating" ? "status" : undefined}>
            {state.kind === "ready" ? (ago ? `Ready · ${ago}` : "Ready") : state.kind === "generating" ? "Generating…" : state.kind === "failed" ? "Failed" : "Not made for this job yet"}
          </span>
        </div>
        {state.kind === "failed" ? (
          <p className="pl-op__quiet" data-resume-failed="">{state.detail}{" "}
            <button type="button" className="pl-q-link" onClick={hasArtifact ? regen : runGenerate} disabled={!!st || noSlots} data-resume-retry="">Try again</button></p>
        ) : null}
        {resumeSources.length > 1 ? (
          <label className="pl-opr__src" data-resume-source="">
            <span className="pl-label">WHICH RÉSUMÉ</span>
            <select className="pl-q-select" value={sourceId ?? ""} disabled={!!st} onChange={(e) => setSourceId(e.target.value)}>
              {resumeSources.map((s) => <option key={s.id} value={s.id}>{`${s.name} — base résumé${s.active ? " (this board’s)" : ""}`}</option>)}
            </select>
          </label>
        ) : activeSource ? <p className="pl-op__quiet" data-resume-source="">Tailored from the base résumé of {activeSource.name}.</p> : null}
        <div className="pl-opr__acts">
          {canGen && onGenerate && !hasArtifact ? (byom.available ? split("Résumé for this job", runGenerate)
            : <button type="button" className="pl-btn pl-btn--primary" onClick={runGenerate} title={genTitle} disabled={!!st || noSlots} data-more="resume">
                {busyGen ? "Generating…" : genError ? "Try again" : "Résumé for this job"}</button>) : null}
          {hasArtifact ? <button type="button" className="pl-btn pl-btn--primary" onClick={() => onViewSandbox?.()} data-more="view">Preview / edit</button> : null}
          {hasArtifact && canGen && onGenerate ? (byom.available ? split("Regenerate", regen)
            : <button type="button" className="pl-btn pl-btn--secondary" onClick={regen} title={genTitle} disabled={!!st || noSlots} data-more="regenerate">{busyGen ? "Generating…" : "Regenerate"}</button>) : null}
          {hasArtifact ? <button type="button" className="pl-btn pl-btn--secondary" onClick={() => onExport?.()} data-more="download">Download PDF</button> : null}
          {hasArtifact && onExportHtml ? <button type="button" className="pl-btn pl-btn--secondary" onClick={() => onExportHtml()} data-more="download-html">Download HTML</button> : null}
        </div>
        {hasArtifact ? <p className="pl-op__quiet" data-more="changes"><WhatWeChangedLink jobId={jobId} jobLabel={label}/></p> : null}
        <ByomStatus byom={byom} onView={() => onViewSandbox?.()} onDownload={() => onExport?.()}/>
        {canGen && onGenerate && !noSlots ? <p className="pl-op__quiet" data-generate-expect="">Takes about 10–20 seconds.</p> : null}
        {!canGen ? <p className="pl-op__quiet" data-generate-plan="">Generating a résumé is not on your plan — Preview and Download work on one you already have.</p> : null}
        {quota ? <p className="pl-op__quiet" data-draft-slots="" data-empty={noSlots ? "true" : "false"}>{quota}</p> : null}
        {companyNotice ? <p className="pl-op__quiet" data-company-notice="">{companyNotice.replace(" Draft this one too?", "")}</p> : null}
        {eligibilityNotice ? <p className="pl-op__quiet" data-eligibility-notice="">{eligibilityNotice}</p> : null}
        {draft.kind === "drafted" && meta.onViewDraft ? <p className="pl-op__quiet">Drafted — <button type="button" className="pl-q-link" onClick={meta.onViewDraft}>see it in Draft House</button>.</p> : null}
        <LiveView entry={meta.sandbox || null} onSave={meta.onSandboxSave} onExport={meta.onSandboxExport} onDismiss={meta.onSandboxDismiss} onEdit={meta.onOpenEditor}/>
      </div>

      <div className="pl-op__card pl-opr__card" data-sheet-history="">
        <span className="pl-label">HISTORY · THIS JOB’S RÉSUMÉ VERSIONS</span>
        <ResumeList loading={versions === null} rows={versionRows} empty="No résumé generated for this job yet — make one above."/>
      </div>

      <div className="pl-op__card pl-opr__card" data-posting-more="">
        <span className="pl-label">MORE</span>
        {pending === "pending" || pending === "recorded" ? (
          <button type="button" className="pl-q-link" data-pending-tag="" onClick={() => navigate({ pathname: "/app/auto-apply", search: "?sheet=pending" })}
            title="You may have applied — record when and how, and it moves to Submitted once it verifies.">
            {pending === "recorded" ? "Pending · not verified" : "Pending · record it"}</button>
        ) : null}
        <div className="pl-opr__acts">
          <button type="button" className="pl-btn pl-btn--secondary" onClick={() => setLetter(true)} data-more="cover-letter">Cover letter</button>
        </div>
        {jobId ? <ManualSubmitted jobId={jobId}/> : null}
        <ExtensionPanel/>
      </div>
      {letter ? <CoverLetterModal resumeText={meta.resumeText || ""} jobDescription={job.description} jobTitle={job.title} company={job.company} onClose={() => setLetter(false)}/> : null}
    </div>
  );
}

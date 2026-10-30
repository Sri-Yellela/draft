// ── D102 P5 · UI slice 1 · ONE JOB, ONE PAGE — /app/job/:applicationId ─────────────────────────────────────
//
// The approved sketch's job panel (docs/sketches/pipeline-workspace.html): Checklist · Résumé · Form · Job · Emails, from
// GET /api/pipeline/job/:applicationId (services/pipelineWorkspace.js jobDetail). The id is the application RECORD — one
// per user and job, kept through retries, approval and sending — so Draft House, The Table and a shared link all open
// the same page. The back arrow returns to wherever the user came from.
//   · Form: Needs-you fields first (skipped / no value / open questions), then every value with its source on hover.
//   · Approve sends through the same decidePending as Draft House (D36·5: only a click sends).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";

const TABS = [["checklist", "Checklist"], ["resume", "Résumé"], ["form", "Form"], ["job", "Job"], ["emails", "Emails"]];
const STEP_COLOUR = { done: C.SUCCESS, current: C.WARNING, waiting: C.INK_FAINT, skipped: C.INK_FAINT };
const SOURCE_WORDS = { profile: "from your profile", saved_answer: "a saved answer", posting: "from the posting",
  user_now: "you answered it", user_setting: "your setting" };
const STATUS_COLOUR = { needs_you: C.WARNING, ready_to_approve: C.INFO, submitted: C.SUCCESS, interview: C.SUCCESS,
  offer: C.SUCCESS, rejected: C.DANGER, failed: C.DANGER };
const when = (sec) => (sec ? new Date(sec * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export function JobWorkspacePanel({ applicationId = null, jobId = null, embedded = false }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { decidePending, pendingBusy = false, pendingMsg = "", artifactUrl } = useAutoApply() || {};
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("checklist");

  const load = async () => {
    setErr("");
    // Draft House knows the job, The Table the record — both reach the same detail (GET /api/pipeline/job-for/:jobId).
    const path = jobId != null ? `/api/pipeline/job-for/${encodeURIComponent(jobId)}` : `/api/pipeline/job/${encodeURIComponent(applicationId)}`;
    try { setD(await api(path)); }
    catch (e) { setErr(e.status === 404 ? "This application is not yours, or it no longer exists." : (e.message || "Could not load it.")); }
  };
  useEffect(() => { setD(null); setTab("checklist"); load(); }, [applicationId, jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Land on what needs the user: an application stopped for answers opens on its Form.
  useEffect(() => { if (d?.status === "needs_you" || d?.form?.approvable) setTab("form"); }, [d?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const muted = { fontSize: 12.5, color: theme.textMuted };
  const card = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "14px 16px" };
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/app/auto-apply"));

  if (err) return <div style={{ padding: 24 }}><button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={back}>← Back</button><p style={muted}>{err}</p></div>;
  if (!d) return <div style={{ padding: 24, ...muted }}>Loading…</div>;

  const fields = d.form?.fields || [];
  const needs = fields.filter(f => f.skipped || f.value == null || f.value === "");
  const filled = fields.filter(f => !(f.skipped || f.value == null || f.value === ""));
  const open = (d.form?.openQuestions || []).map(q => q?.question ?? q?.label ?? String(q));

  return (
    <div data-job-workspace={d.id} style={{ flex: 1, overflowY: "auto", padding: embedded ? 0 : "16px 20px 32px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 980, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {!embedded && <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={back} aria-label="Back">←</button>}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: theme.text }}>{d.title || "Untitled role"}</div>
          <div style={muted}>{d.company || "Unknown company"}{d.job?.location ? ` · ${d.job.location}` : ""}{d.updatedAt ? ` · updated ${when(d.updatedAt)}` : ""}</div>
        </div>
        <span data-job-status={d.status} style={markStyle(STATUS_COLOUR[d.status] || C.INK_MUTED)}>{d.statusLabel || d.status}</span>
        {d.url && <a className="rm-btn rm-btn-ghost rm-btn-sm" href={d.url} target="_blank" rel="noreferrer">Open the posting ↗</a>}
      </header>

      <nav role="tablist" aria-label="This application" style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${theme.border}`, paddingBottom: 8 }}>
        {TABS.map(([id, label]) => {
          const n = id === "form" ? needs.length + open.length : id === "emails" ? (d.emails || []).length : 0;
          return (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`rm-btn rm-btn-sm ${tab === id ? "rm-btn-primary" : "rm-btn-ghost"}`}>
              {label}{n ? ` · ${n}` : ""}
            </button>
          );
        })}
      </nav>

      {tab === "checklist" && (
        <ol data-job-checklist="" style={{ ...card, margin: 0, paddingLeft: 34, display: "flex", flexDirection: "column", gap: 8 }}>
          {(d.checklist || []).map(s => (
            <li key={s.step} style={{ fontSize: 13.5, color: theme.text }}>
              <span style={{ ...markStyle(STEP_COLOUR[s.state] || C.INK_FAINT), marginRight: 8 }}>{s.state}</span>
              {s.label}
              {s.step === "form_filled" && s.total ? <span style={muted}> · {s.filled} of {s.total}</span> : null}
              {s.step === "submitted" && s.by ? <span style={muted}> · {s.by === "auto" ? "sent by FULL AUTO" : "you approved it"}</span> : null}
              {s.step === "needs_you" && s.fields?.length ? <span style={muted}> · {s.fields.slice(0, 3).join(", ")}{s.fields.length > 3 ? "…" : ""}</span> : null}
            </li>
          ))}
        </ol>
      )}

      {tab === "resume" && (
        <div style={card} data-job-resume="">
          {d.resume?.artifactId ? (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 13.5, color: theme.text }}>A tailored résumé was made for this application.
                {d.resume.atsScore != null ? ` ATS ${d.resume.atsScore}${d.resume.baseAtsScore != null ? ` (your base: ${d.resume.baseAtsScore})` : ""}.` : ""}</p>
              {d.runJobId && artifactUrl && <a className="rm-btn rm-btn-ghost rm-btn-sm" href={artifactUrl(d.runJobId, "resume")} target="_blank" rel="noreferrer">Open the résumé</a>}
            </>
          ) : <p style={{ ...muted, margin: 0 }}>No tailored résumé for this one — your base résumé is used.</p>}
        </div>
      )}

      {tab === "form" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-job-form="">
          {(needs.length > 0 || open.length > 0) && (
            <div style={{ ...card, borderColor: C.WARNING }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, marginBottom: 6 }}>Needs you · {needs.length + open.length}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: theme.text }}>
                {open.map((q, i) => <li key={`q${i}`}>{q}</li>)}
                {needs.map((f, i) => <li key={`f${i}`}>{f.name || "A field"}</li>)}
              </ul>
              <p style={{ ...muted, margin: "8px 0 0" }}>Answer these in Draft House — what you answer is saved for next time.</p>
            </div>
          )}
          <div style={card}>
            {filled.length === 0 ? <p style={{ ...muted, margin: 0 }}>No values filled yet.</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {filled.map((f, i) => (
                    <tr key={i} style={{ borderTop: i ? `1px solid ${theme.border}` : "none" }}>
                      <td style={{ padding: "6px 8px 6px 0", color: theme.textMuted, width: "40%" }}>{f.name}</td>
                      <td style={{ padding: "6px 0", color: theme.text }} title={SOURCE_WORDS[f.source] || f.provenance || ""}>{String(f.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {d.form?.approvable && d.runJobId && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="rm-btn rm-btn-primary" disabled={pendingBusy}
                onClick={() => decidePending([d.runJobId], true)}>Approve &amp; send</button>
              <span style={muted}>{pendingMsg || "These values go to the employer exactly as listed."}</span>
            </div>
          )}
        </div>
      )}

      {tab === "job" && (
        <div style={card} data-job-posting="">
          {d.job?.description
            ? <div style={{ fontSize: 13, color: theme.text, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{d.job.description}</div>
            : <p style={{ ...muted, margin: 0 }}>The posting's text is not stored for this one{d.url ? " — open the posting to read it." : "."}</p>}
        </div>
      )}

      {tab === "emails" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-job-emails="">
          {(d.emails || []).length === 0 ? <p style={{ ...muted, margin: 0 }}>No email linked to this application yet. Replies you forward to your draft inbox appear here.</p>
            : d.emails.map(m => (
              <div key={m.id} style={card}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={markStyle(C.INK_MUTED)}>{m.category}</span>
                  <b style={{ fontSize: 13, color: theme.text, flex: 1 }}>{m.subject || "(no subject)"}</b>
                  <span style={muted}>{when(m.receivedAt)}</span>
                </div>
                {m.preview && <div style={{ ...muted, marginTop: 4 }}>{m.preview}</div>}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default JobWorkspacePanel;

// ── D102 P5 · UI slice 1 · ONE JOB, ONE PAGE — /app/job/:applicationId ─────────────────────────────────────
//
// The approved sketch's job panel (docs/sketches/pipeline-workspace.html): Checklist · Résumé · Form · Job · Emails, from
// GET /api/pipeline/job/:applicationId (services/pipelineWorkspace.js jobDetail). The id is the application RECORD — one
// per user and job, kept through retries, approval and sending — so Draft House, The Table and a shared link all open
// the same page. The back arrow returns to wherever the user came from.
//   · Form: Needs-you fields first (skipped / no value / open questions), then every value with its source on hover.
//   · Approve sends through the same decidePending as Draft House (D36·5: only a click sends).
//   · D110 Prep: when D103 files an Interview or Assessment (or the ladder reads one) the page gains a Prep tab and a
//     countdown — the skills against the profile with their Atlas pages, the likely rounds, the story bank, debriefs
//     (GET /api/interview/prep/:applicationId, services/interviewPrep.js). The date is the user's, or one an email states.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import { useAtlasTerms } from "../lib/atlasLinks.js";
import { AtlasText } from "../components/AtlasTerm.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const TABS = [["checklist", "Checklist"], ["resume", "Résumé"], ["form", "Form"], ["job", "Job"], ["emails", "Emails"]];
const STEP_COLOUR = { done: C.SUCCESS, current: C.WARNING, waiting: C.INK_FAINT, skipped: C.INK_FAINT };
const SOURCE_WORDS = { profile: "from your profile", saved_answer: "a saved answer", posting: "from the posting",
  user_now: "you answered it", user_setting: "your setting" };
const STATUS_COLOUR = { needs_you: C.WARNING, ready_to_approve: C.INFO, submitted: C.SUCCESS, interview: C.SUCCESS,
  offer: C.SUCCESS, rejected: C.DANGER, failed: C.DANGER };
const SKILL_COLOUR = { have: C.SUCCESS, partial: C.WARNING, missing: C.DANGER };
const SKILL_WORDS = { have: "you have it", partial: "on your résumé, not your skills", missing: "missing" };
const ROUND_OPTIONS = [["coding", "Coding"], ["system_design", "System design"], ["ml", "Machine learning"], ["behavioural", "Behavioural"], ["other", "Other"]];
const THEMES = ["leadership", "ownership", "conflict", "failure", "impact", "collaboration", "ambiguity", "customer"];
const WENT_OPTIONS = [["", "How did it go?"], ["well", "Well"], ["mixed", "Mixed"], ["poorly", "Poorly"]];
const post = (path, method, body) => api(path, { method, body: JSON.stringify(body ?? {}) });
/** "in 3 days" · "today" · "2 days ago" — the countdown's words. */
export function countdownWords(days) {
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days > 0 ? `in ${days} days` : `${-days} day${days === -1 ? "" : "s"} ago`;
}
const when = (sec) => (sec ? new Date(sec * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export function JobWorkspacePanel({ applicationId = null, jobId = null, embedded = false }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { decidePending, pendingBusy = false, pendingMsg = "", artifactUrl } = useAutoApply() || {};
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("checklist");
  const atlasTerms = useAtlasTerms(tab === "job" && d?.job?.description ? d.job.postingId : null);   // read when the Job tab opens

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
  // ⭐ D167: Interview → Coming up's Prepare opens the application here on its Prep tab (?tab=prep), when Prep is on.
  useEffect(() => {
    let want = null;
    try { want = new URLSearchParams(window.location.search).get("tab"); } catch { want = null; }
    if (want === "prep" && d?.prep?.active) setTab("prep");
  }, [d?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const muted = { fontSize: ts(12.5), color: theme.textMuted };
  const card = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "14px 16px" };
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/app/auto-apply"));

  if (err) return <div style={{ padding: 24 }}><button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={back}>← Back</button><p style={muted}>{err}</p></div>;
  if (!d) return <div style={{ padding: 24, ...muted }}>Loading…</div>;

  const fields = d.form?.fields || [];
  const needs = fields.filter(f => f.skipped || f.value == null || f.value === "");
  const filled = fields.filter(f => !(f.skipped || f.value == null || f.value === ""));
  const open = (d.form?.openQuestions || []).map(q => q?.question ?? q?.label ?? String(q));
  const prep = d.prep?.active ? d.prep : null;
  const tabs = prep ? [...TABS.slice(0, 1), ["prep", "Prep"], ...TABS.slice(1)] : TABS;

  return (
    <div data-job-workspace={d.id} style={{ flex: 1, overflowY: "auto", padding: embedded ? 0 : "16px 20px 32px", display: "flex", flexDirection: "column", gap: 14, width: "100%", boxSizing: "border-box" }}>
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {!embedded && <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={back} aria-label="Back">←</button>}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: ts(20), fontWeight: 800, color: theme.text }}>{d.title || "Untitled role"}</div>
          <div style={muted}>{d.company || "Unknown company"}{d.job?.location ? ` · ${d.job.location}` : ""}{d.updatedAt ? ` · updated ${when(d.updatedAt)}` : ""}</div>
        </div>
        <span data-job-status={d.status} style={markStyle(STATUS_COLOUR[d.status] || C.INK_MUTED)}>{d.statusLabel || d.status}</span>
        {prep?.date && <span data-prep-countdown={prep.daysLeft} style={markStyle(prep.daysLeft != null && prep.daysLeft <= 2 ? C.WARNING : C.INFO)}>
          {prep.kind === "assessment" ? "Assessment" : "Interview"} {countdownWords(prep.daysLeft)}</span>}
        {d.url && <a className="rm-btn rm-btn-ghost rm-btn-sm" href={d.url} target="_blank" rel="noreferrer">Open the posting ↗</a>}
      </header>

      <nav role="tablist" aria-label="This application" style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${theme.border}`, paddingBottom: 8 }}>
        {tabs.map(([id, label]) => {
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
            <li key={s.step} style={{ fontSize: ts(13.5), color: theme.text }}>
              <span style={{ ...markStyle(STEP_COLOUR[s.state] || C.INK_FAINT), marginRight: 8 }}>{s.state}</span>
              {s.label}
              {s.step === "form_filled" && s.total ? <span style={muted}> · {s.filled} of {s.total}</span> : null}
              {s.step === "submitted" && s.by ? <span style={muted}> · {s.by === "auto" ? "sent by Apply for me" : "you approved it"}</span> : null}
              {s.step === "needs_you" && s.fields?.length ? <span style={muted}> · {s.fields.slice(0, 3).join(", ")}{s.fields.length > 3 ? "…" : ""}</span> : null}
            </li>
          ))}
        </ol>
      )}

      {tab === "prep" && prep && <PrepTab applicationId={d.id} theme={theme} card={card} muted={muted} onDate={load}/>}

      {tab === "resume" && (
        <div style={card} data-job-resume="">
          {d.resume?.artifactId ? (
            <>
              <p style={{ margin: "0 0 8px", fontSize: ts(13.5), color: theme.text }}>A tailored résumé was made for this application.
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
              <div style={{ fontSize: ts(13), fontWeight: 800, color: theme.text, marginBottom: 6 }}>Needs you · {needs.length + open.length}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: ts(13), color: theme.text }}>
                {open.map((q, i) => <li key={`q${i}`}>{q}</li>)}
                {needs.map((f, i) => <li key={`f${i}`}>{f.name || "A field"}</li>)}
              </ul>
              <p style={{ ...muted, margin: "8px 0 0" }}>Answer these in Home — what you answer is saved for next time.</p>
            </div>
          )}
          <div style={card}>
            {filled.length === 0 ? <p style={{ ...muted, margin: 0 }}>No values filled yet.</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ts(13) }}>
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
            ? <div style={{ fontSize: ts(13), color: theme.text, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {/* ⭐ D114: the posting's published Atlas terms are quiet links; the text is unchanged. */}
                <AtlasText text={d.job.description} terms={atlasTerms} used={new Set()} />
              </div>
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
                  <b style={{ fontSize: ts(13), color: theme.text, flex: 1 }}>{m.subject || "(no subject)"}</b>
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

// ── D110 · the Prep tab ─────────────────────────────────────────────────────────────────────
function PrepTab({ applicationId, theme, card, muted, onDate }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dateIn, setDateIn] = useState({ date: "", time: "" });
  const [editing, setEditing] = useState(null);          // a story being edited (or a blank one for a new story)
  const [debrief, setDebrief] = useState(null);          // the debrief form, when open
  const reload = async () => {
    setErr("");
    try {
      const r = await api(`/api/interview/prep/${applicationId}`);
      setP(r);
      setDateIn({ date: r.date?.source === "you" ? r.date.ymd : "", time: r.date?.source === "you" ? (r.date.time || "") : "" });
    } catch (e) { setErr(e.message || "Could not load the prep."); }
  };
  useEffect(() => { setP(null); reload(); }, [applicationId]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn) => { setBusy(true); setErr(""); try { await fn(); await reload(); } catch (e) { setErr(e.message || "That did not work."); } finally { setBusy(false); } };

  if (err && !p) return <p style={muted}>{err}</p>;
  if (!p) return <p style={muted}>Loading…</p>;
  const h = { fontSize: ts(13), fontWeight: 800, color: theme.text, margin: "0 0 8px" };
  const input = { font: "inherit", fontSize: ts(13), padding: "6px 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, boxSizing: "border-box" };

  return (
    <div data-job-prep="" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {err && <p style={{ ...muted, color: C.DANGER, margin: 0 }}>{err}</p>}
      <section style={card} data-prep-date="">
        <div style={h}>{p.kind === "assessment" ? "The assessment" : "The interview"}</div>
        {p.date ? (
          <p style={{ margin: "0 0 8px", fontSize: ts(13.5), color: theme.text }}>
            {p.date.ymd}{p.date.time ? ` at ${p.date.time}` : ""} — <b>{countdownWords(p.daysLeft)}</b>
            <span style={muted}> · {p.date.source === "you" ? "the date you entered" : `read from the email (“${p.date.text}”)`}</span>
          </p>
        ) : <p style={{ ...muted, margin: "0 0 8px" }}>No date yet. The email did not state one plainly — enter it and the countdown starts.</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" aria-label="Date" style={input} value={dateIn.date} onChange={e => setDateIn(v => ({ ...v, date: e.target.value }))}/>
          <input type="time" aria-label="Time" style={input} value={dateIn.time} onChange={e => setDateIn(v => ({ ...v, time: e.target.value }))}/>
          <button className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy || !dateIn.date}
            onClick={() => act(async () => { await post(`/api/interview/prep/${applicationId}/date`, "PUT", { date: dateIn.date, time: dateIn.time || null }); onDate?.(); })}>Save the date</button>
          {p.date?.source === "you" && <button className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy}
            onClick={() => act(async () => { await post(`/api/interview/prep/${applicationId}/date`, "PUT", { date: null }); onDate?.(); })}>Clear</button>}
        </div>
      </section>

      <section style={card} data-prep-skills="">
        <div style={h}>The posting's skills against your profile</div>
        {!p.skills?.length ? <p style={{ ...muted, margin: 0 }}>No skills could be read from this posting.</p> : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {p.skills.map(s => (
              <li key={s.name} data-skill-status={s.status} style={{ fontSize: ts(13), color: theme.text }}>
                <span style={{ ...markStyle(SKILL_COLOUR[s.status] || C.INK_MUTED), marginRight: 8 }}>{s.status}</span>
                {s.atlas ? <a href={s.atlas.path} data-atlas-link={s.atlas.slug}>{s.name}</a> : <b>{s.name}</b>}
                <span style={muted}> · {SKILL_WORDS[s.status]}</span>
                {s.status !== "have" && s.atlas?.resources?.length > 0 && (
                  <div style={{ ...muted, marginTop: 2, paddingLeft: 4 }}>
                    {s.atlas.resources.map(r => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>{r.title}{r.cost === "free" ? " (free)" : ""} ↗</a>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={card} data-prep-rounds="">
        <div style={h}>Likely rounds</div>
        {p.rounds?.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: ts(13), color: theme.text }}>
            {p.rounds.map(r => <li key={r.round}>{r.label} <span style={muted}>· read from {r.evidence.map(e => `the ${e.from} (“${e.phrase}”)`).join(" and ")}</span></li>)}
          </ul>
        ) : <p style={{ ...muted, margin: 0 }}>Neither the posting nor the emails name a round.</p>}
        {p.platform && <p style={{ margin: "8px 0 0", fontSize: ts(13), color: theme.text }}><b>{p.platform.name}:</b> {p.platform.format}</p>}
      </section>

      <section style={card} data-prep-stories="">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ ...h, margin: 0, flex: 1 }}>Your stories · {p.stories.length}</div>
          <button className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy} onClick={() => act(() => post("/api/interview/stories/from-profile", "POST"))}>Start from my experience</button>
          <button className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy} onClick={() => setEditing({ title: "", situation: "", task: "", action: "", result: "", themes: [] })}>Add a story</button>
        </div>
        <p style={{ ...muted, margin: "0 0 8px" }}>STAR stories, kept with your account and shown in every interview's prep.</p>
        {editing && <StoryForm story={editing} theme={theme} input={input} busy={busy} onCancel={() => setEditing(null)}
          onSave={(s) => act(async () => { if (s.id) await post(`/api/interview/stories/${s.id}`, "PUT", s); else await post("/api/interview/stories", "POST", s); setEditing(null); })}/>}
        {p.stories.map(s => (
          <details key={s.id} style={{ borderTop: `1px solid ${theme.border}`, padding: "8px 0" }}>
            <summary style={{ fontSize: ts(13), color: theme.text, cursor: "pointer" }}>{s.title} {s.themes.map(t => <span key={t} style={{ ...markStyle(C.INK_MUTED), marginLeft: 6 }}>{t}</span>)}</summary>
            {[["Situation", s.situation], ["Task", s.task], ["Action", s.action], ["Result", s.result]].map(([k, v]) => (
              <p key={k} style={{ margin: "4px 0", fontSize: ts(13), color: theme.text }}><b>{k}:</b> {v || <span style={muted}>—</span>}</p>))}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setEditing(s)}>Edit</button>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy} onClick={() => act(() => post(`/api/interview/stories/${s.id}`, "DELETE"))}>Delete</button>
            </div>
          </details>
        ))}
      </section>

      <section style={card} data-prep-debriefs="">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div style={{ ...h, margin: 0, flex: 1 }}>Debriefs · {p.debriefs.length}</div>
          {!debrief && <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDebrief({ round: "coding", heldOn: "", went: "", notes: "", questions: "" })}>After a round</button>}
        </div>
        <p style={{ ...muted, margin: "0 0 8px" }}>What was asked and how it went — your own question bank. Only you see it.</p>
        {debrief && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select aria-label="Round" style={input} value={debrief.round} onChange={e => setDebrief(v => ({ ...v, round: e.target.value }))}>{ROUND_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <input type="date" aria-label="Held on" style={input} value={debrief.heldOn} onChange={e => setDebrief(v => ({ ...v, heldOn: e.target.value }))}/>
              <select aria-label="How it went" style={input} value={debrief.went} onChange={e => setDebrief(v => ({ ...v, went: e.target.value }))}>{WENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            <textarea aria-label="Questions asked, one per line" placeholder="The questions asked, one per line" rows={4} style={input} value={debrief.questions} onChange={e => setDebrief(v => ({ ...v, questions: e.target.value }))}/>
            <textarea aria-label="Notes" placeholder="Notes" rows={2} style={input} value={debrief.notes} onChange={e => setDebrief(v => ({ ...v, notes: e.target.value }))}/>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="rm-btn rm-btn-primary rm-btn-sm" disabled={busy} onClick={() => act(async () => {
                await post("/api/interview/debriefs", "POST", { applicationId, round: debrief.round, heldOn: debrief.heldOn || null, went: debrief.went || null, notes: debrief.notes,
                  questions: debrief.questions.split("\n").map(q => q.trim()).filter(Boolean) });
                setDebrief(null);
              })}>Save the debrief</button>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDebrief(null)}>Cancel</button>
            </div>
          </div>
        )}
        {p.debriefs.map(x => (
          <div key={x.id} style={{ borderTop: `1px solid ${theme.border}`, padding: "8px 0", fontSize: ts(13), color: theme.text }}>
            <b>{(ROUND_OPTIONS.find(([v]) => v === x.round) || [null, x.round])[1]}</b>{x.heldOn ? <span style={muted}> · {x.heldOn}</span> : null}{x.went ? <span style={muted}> · went {x.went}</span> : null}
            {x.questions.length > 0 && <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{x.questions.map(q => <li key={q.id}>{q.question}</li>)}</ul>}
            {x.notes && <div style={muted}>{x.notes}</div>}
          </div>
        ))}
      </section>
    </div>
  );
}

function StoryForm({ story, theme, input, busy, onSave, onCancel }) {
  const [s, setS] = useState({ ...story });
  const set = (k) => (e) => setS(v => ({ ...v, [k]: e.target.value }));
  const toggle = (t) => setS(v => ({ ...v, themes: v.themes.includes(t) ? v.themes.filter(x => x !== t) : [...v.themes, t] }));
  return (
    <div data-story-form="" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
      <input aria-label="Title" placeholder="Title" style={input} value={s.title} onChange={set("title")}/>
      {["situation", "task", "action", "result"].map(k => <textarea key={k} aria-label={k} placeholder={k[0].toUpperCase() + k.slice(1)} rows={2} style={input} value={s[k]} onChange={set(k)}/>)}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {THEMES.map(t => <button key={t} type="button" aria-pressed={s.themes.includes(t)} onClick={() => toggle(t)}
          className={`rm-btn rm-btn-sm ${s.themes.includes(t) ? "rm-btn-primary" : "rm-btn-ghost"}`}>{t}</button>)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="rm-btn rm-btn-primary rm-btn-sm" disabled={busy || !s.title.trim()} onClick={() => onSave(s)}>Save the story</button>
        <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={onCancel}>Cancel</button>
      </div>
      <span style={{ fontSize: ts(12), color: theme.textMuted }}>Only what you did — never a result you did not get.</span>
    </div>
  );
}

export default JobWorkspacePanel;

// ⭐ D197 Wave 2 · M5 (47m, lane person) · THE JOB WORKSPACE → *THE VOYAGE* — /app/job/:applicationId and /app/job/for/:jobId,
// rebuilt in the plate system per docs/revamp/jobworkspace.md's PROPOSED M2 (agent's pick — the owner may reverse): one
// application followed end to end, the ledger's row opened to its own page. Every M1 row keeps its home (W1–W20):
//   the breadcrumb (THE LEDGER / company / role — the first crumb is the way back) · the opening's head (title, company,
//   place, updated) · the status word · the prep countdown stamp (clay when ≤ 2 days) · Open the posting · the binder tabs
//   Checklist · Prep (when D103 filed one) · Résumé · Form · Job · Emails with their counts · land on Form when it needs you
//   (or Prep with ?tab=prep) · the checklist as a route of stops · the tailored résumé (ATS against base) · the Form's held
//   lines (still answered in Home — agent's pick: the hand-off is kept, with a link) and every filled value WITH its source
//   in words (not hover-only) · Approve & send (D36·5: only a click sends — the page's one clay point while approvable) · the
//   posting with its Atlas terms · the letters · Prep (the date, the skills, the rounds, the story bank, the debriefs).
// The id is the application RECORD — Home's register, The Table and a shared link all open the same page.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { useAtlasTerms } from "../lib/atlasLinks.js";
import { AtlasText } from "../components/AtlasTerm.jsx";
import PlateRoot from "../plate/PlateRoot.jsx";
import { Breadcrumb, Kickers, Stamp, StatusTag } from "../plate/Marks.jsx";
import { BinderTabs, PlateHero } from "../plate/Plates.jsx";
import { FactSheet } from "../plate/Cards.jsx";
import { RouteLine } from "../plate/Lists.jsx";
import { Ticket } from "../plate/Tickets.jsx";
import { Drawer, ErrorLine, Skeleton } from "../plate/PlateState.jsx";
import { LabelledField, SettingsSheet } from "../plate/Person.jsx";
import VoyageClipboard from "../plate/drawings/VoyageClipboard.jsx";
import VoyagePostRack from "../plate/drawings/VoyagePostRack.jsx";
import "../plate/personPages.css";

const TABS = [["checklist", "Checklist"], ["resume", "Résumé"], ["form", "Form"], ["job", "Job"], ["emails", "Emails"]];
const STEP_STATE = { done: "lit", current: "next", waiting: "ahead", skipped: "ahead" };
const SOURCE_WORDS = { profile: "from your profile", saved_answer: "a saved answer", posting: "from the posting",
  user_now: "you answered it", user_setting: "your setting" };
const STATUS_KIND = { needs_you: "needs", ready_to_approve: "held", submitted: "sent", interview: "sent", offer: "sent" };
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
const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

export function JobWorkspacePanel({ applicationId = null, jobId = null, embedded = false }) {
  const navigate = useNavigate();
  const { decidePending, pendingBusy = false, pendingMsg = "", artifactUrl } = useAutoApply() || {};
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("checklist");
  const atlasTerms = useAtlasTerms(tab === "job" && d?.job?.description ? d.job.postingId : null);   // read when the Job tab opens

  const load = async () => {
    setErr("");
    // Home knows the job, The Table the record — both reach the same detail (GET /api/pipeline/job-for/:jobId).
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

  const back = (e) => { if (e && !plain(e)) return; e?.preventDefault?.(); if (window.history.length > 1) navigate(-1); else navigate("/app/auto-apply"); };
  const onClick = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || !plain(e) || a.target) return;
    const href = a.getAttribute("href");
    if (!/^\/(app|atlas|companies)\b/.test(href || "")) return;
    e.preventDefault(); navigate(href);
  };

  if (err) return (
    <PlateRoot region="IV" className="pl-pp-page" data-job-workspace="missing">
      <div className="pl-page pl-pp-head">
        <Kickers parts={["THE LEDGER", "OFF THE MAP"]} />
        <h1 className="pl-pp-working">This voyage isn't on the map</h1>
        <ErrorLine text={err} onRetry={load} />
        <div className="pl-actions"><a className="pl-btn pl-btn--ink" href="/app/auto-apply" onClick={back}>← Back to the ledger</a></div>
      </div>
    </PlateRoot>
  );
  if (!d) return <PlateRoot region="IV" className="pl-pp-page"><div className="pl-page pl-pp-loading"><Skeleton label="Loading the application" height={360} lines={5} /></div></PlateRoot>;

  const fields = d.form?.fields || [];
  const needs = fields.filter((f) => f.skipped || f.value == null || f.value === "");
  const filled = fields.filter((f) => !(f.skipped || f.value == null || f.value === ""));
  const open = (d.form?.openQuestions || []).map((q) => q?.question ?? q?.label ?? String(q));
  const prep = d.prep?.active ? d.prep : null;
  const tabs = prep ? [...TABS.slice(0, 1), ["prep", "Prep"], ...TABS.slice(1)] : TABS;
  const held = needs.length + open.length;
  const approvable = !!(d.form?.approvable && d.runJobId);
  const soon = prep?.date && prep.daysLeft != null && prep.daysLeft <= 2;
  const valueOf = (re) => String(filled.find((f) => re.test(String(f.name || "")))?.value || "");
  const company = d.company || "Unknown company";

  return (
    <PlateRoot region="IV" className="pl-pp-page" data-job-workspace={d.id} onClick={onClick}>
      <header className="pl-page pl-pp-head">
        {!embedded ? <Breadcrumb crumbs={[{ label: "THE LEDGER", href: "/app/auto-apply" }, { label: company.toUpperCase() }, { label: String(d.title || "Untitled role").toUpperCase() }]} /> : null}
        <div className="pl-pp-row" style={{ marginTop: 6 }}>
          <article className="pl-card pl-vy-ticket" aria-label="The opening">
            <div className="pl-card__strip">
              <span className="pl-label">THE VOYAGE · {company.toUpperCase()}{d.job?.location ? ` · ${String(d.job.location).toUpperCase()}` : ""}</span>
              <span className="pl-label">{d.updatedAt ? `UPDATED ${when(d.updatedAt).toUpperCase()}` : ""}</span>
            </div>
            <div className="pl-card__body">
              <h1 className="pl-pp-working">{d.title || "Untitled role"}</h1>
              <div className="pl-actions">
                <span data-job-status={d.status}><StatusTag kind={STATUS_KIND[d.status]}>{d.statusLabel || d.status}</StatusTag></span>
                {prep?.date ? <span data-prep-countdown={prep.daysLeft}><Stamp tone={soon ? "ink" : "region"} rotate={-4} land={false}>
                  {`${prep.kind === "assessment" ? "ASSESSMENT" : "INTERVIEW"} · ${countdownWords(prep.daysLeft).toUpperCase()}`}</Stamp></span> : null}
                <span className="pl-grow" />
                {d.url ? <a className="pl-btn" href={d.url} target="_blank" rel="noreferrer">Open the posting ↗</a> : null}
              </div>
            </div>
          </article>
          <div className="pl-pp-side">
            <RouteLine label="This application's route" stops={(d.checklist || []).map((s) => ({ name: s.label, state: STEP_STATE[s.state] || "ahead", stage: "build" }))} />
          </div>
        </div>
      </header>

      <div className="pl-page pl-pp-body">
        <BinderTabs label="This application" idBase="vy-tab" selected={tab} onSelect={setTab}
          tabs={tabs.map(([id, label]) => {
            const n = id === "form" ? held : id === "emails" ? (d.emails || []).length : 0;
            return { id, label, sub: n ? `${n}` : undefined };
          })}>
          {tab === "checklist" ? (
            <div data-job-checklist="">
              <SettingsSheet kicker="THE RUN · STOP BY STOP" rows={(d.checklist || []).map((s) => ({
                label: s.label,
                note: [s.step === "form_filled" && s.total ? `${s.filled} of ${s.total}` : null,
                  s.step === "submitted" && s.by ? (s.by === "auto" ? "sent by Apply for me" : "you approved it") : null,
                  s.step === "needs_you" && s.fields?.length ? `${s.fields.slice(0, 3).join(", ")}${s.fields.length > 3 ? "…" : ""}` : null].filter(Boolean).join(" · ") || undefined,
                control: <span className="pl-pp-note">{s.state}</span> }))} />
            </div>
          ) : null}

          {tab === "prep" && prep ? <PrepTab applicationId={d.id} onDate={load} /> : null}

          {tab === "resume" ? (
            <div data-job-resume="">
              {d.resume?.artifactId ? (
                <FactSheet kicker="RÉSUMÉ · TAILORED FOR THIS APPLICATION" rows={[
                  { label: "ATS", value: d.resume.atsScore != null ? String(d.resume.atsScore) : null },
                  { label: "Your base résumé", value: d.resume.baseAtsScore != null ? String(d.resume.baseAtsScore) : null }]}
                  foot={d.runJobId && artifactUrl ? <a className="pl-btn" href={artifactUrl(d.runJobId, "resume")} target="_blank" rel="noreferrer">Open the résumé</a> : null} />
              ) : <Drawer text="No tailored résumé for this one — your base résumé is used." />}
            </div>
          ) : null}

          {tab === "form" ? (
            <div className="pl-pp-row" data-job-form="">
              <div className="pl-pp-main">
                {held > 0 ? (
                  <SettingsSheet kicker={`NEEDS YOU · ${held}`} title="Held for you"
                    rows={[...open.map((q) => ({ label: q, control: <span className="pl-pp-note">question</span> })), ...needs.map((f) => ({ label: f.name || "A field", control: <span className="pl-pp-note">field</span> }))]}
                    actions={<a className={approvable ? "pl-btn" : "pl-btn pl-btn--primary"} href={"/app/auto-apply"}>Answer these in Home</a>}
                    lead="What you answer is saved for next time." />
                ) : null}
                {filled.length === 0 ? <Drawer text="No values filled yet." /> : (
                  <SettingsSheet kicker={`FILLED FOR YOU · ${filled.length} OF ${fields.length}`} rows={filled.map((f) => ({
                    label: f.name, note: SOURCE_WORDS[f.source] || f.provenance || undefined, value: String(f.value) }))} />
                )}
                {approvable ? (
                  <div className="pl-actions">
                    <button type="button" className="pl-btn pl-btn--primary" disabled={pendingBusy} onClick={() => decidePending([d.runJobId], true)}>Approve &amp; send</button>
                    <span className="pl-pp-note" aria-live="polite">{pendingMsg || "These values go to the employer exactly as listed."}</span>
                  </div>
                ) : null}
              </div>
              <div className="pl-pp-side">
                <PlateHero aspect="360 / 220">
                  <VoyageClipboard label={`A clipboard holding this application's form; ${filled.length} lines filled, ${held} held for you`}
                    name={valueOf(/name/i) || "—"} email={valueOf(/e-?mail/i) || "—"} why={`WHY ${company.toUpperCase()}?`.slice(0, 22)} start={valueOf(/start/i) || "—"} />
                </PlateHero>
              </div>
            </div>
          ) : null}

          {tab === "job" ? (
            <div className="pl-card" data-job-posting="">
              <div className="pl-card__strip"><span className="pl-label">THE POSTING · ATLAS TERMS ARE QUIET LINKS</span></div>
              <div className="pl-card__body">
                {d.job?.description
                  ? <div className="pl-body" style={{ whiteSpace: "pre-wrap" }}>
                      {/* ⭐ D114: the posting's published Atlas terms are quiet links; the text is unchanged. */}
                      <AtlasText text={d.job.description} terms={atlasTerms} used={new Set()} />
                    </div>
                  : <p className="pl-pp-note">The posting's text is not stored for this one{d.url ? " — open the posting to read it." : "."}</p>}
              </div>
            </div>
          ) : null}

          {tab === "emails" ? (
            <div className="pl-pp-row" data-job-emails="">
              <div className="pl-pp-main">
                {(d.emails || []).length === 0 ? <Drawer text="No email linked to this application yet. Replies you forward to your draft inbox appear here." />
                  : d.emails.map((m) => (
                    <article key={m.id} className="pl-card">
                      <div className="pl-card__strip"><span className="pl-label">{String(m.category || "LETTER").toUpperCase()}</span><span className="pl-label">{when(m.receivedAt).toUpperCase()}</span></div>
                      <div className="pl-card__body"><b>{m.subject || "(no subject)"}</b>{m.preview ? <span className="pl-pp-note">{m.preview}</span> : null}</div>
                    </article>
                  ))}
              </div>
              <div className="pl-pp-side">
                <PlateHero aspect="360 / 220">
                  <VoyagePostRack label={`A post rack of this application's letters: ${(d.emails || []).length}`} caption={`${company.toUpperCase().slice(0, 16)} · ${(d.emails || []).length} LETTER${(d.emails || []).length === 1 ? "" : "S"}`} />
                </PlateHero>
              </div>
            </div>
          ) : null}
        </BinderTabs>
      </div>

      {!embedded ? (
        <section className="pl-section pl-section--last" aria-labelledby="vy-onward-t">
          <div className="pl-tickets" id="vy-onward-t">
            {prep ? <Ticket tone={soon && !approvable ? "clay-tint" : "plain"} kicker="PROVING GROUND" title="Prepare for it" line="Your stories, the rounds, the questions asked before." go="Open →" href="/app/interview" /> : null}
            <Ticket kicker="THE LEDGER" title="Back to every voyage" line="Home: what's moving, what needs you." go="Open →" href="/app/auto-apply" />
          </div>
        </section>
      ) : null}
    </PlateRoot>
  );
}

// ── D110 · the Prep tab ─────────────────────────────────────────────────────────────────────
function PrepTab({ applicationId, onDate }) {
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

  if (err && !p) return <ErrorLine text={err} onRetry={reload} />;
  if (!p) return <Skeleton label="Loading the prep" height={240} lines={4} />;

  return (
    <div data-job-prep="" className="pl-pp-stack">
      {err ? <p className="pl-pp-err">{err}</p> : null}
      <div data-prep-date="">
        <SettingsSheet kicker={p.kind === "assessment" ? "THE ASSESSMENT" : "THE INTERVIEW"}
          title={p.date ? `${p.date.ymd}${p.date.time ? ` at ${p.date.time}` : ""} — ${countdownWords(p.daysLeft)}` : "No date yet"}
          lead={p.date ? (p.date.source === "you" ? "The date you entered." : `Read from the email (“${p.date.text}”).`) : "The email did not state one plainly — enter it and the countdown starts."}
          actions={<>
            <LabelledField label="Date" type="date" value={dateIn.date} onChange={(v) => setDateIn((x) => ({ ...x, date: v }))} />
            <LabelledField label="Time" type="time" value={dateIn.time} onChange={(v) => setDateIn((x) => ({ ...x, time: v }))} />
            <button type="button" className="pl-btn pl-btn--ink" disabled={busy || !dateIn.date}
              onClick={() => act(async () => { await post(`/api/interview/prep/${applicationId}/date`, "PUT", { date: dateIn.date, time: dateIn.time || null }); onDate?.(); })}>Save the date</button>
            {p.date?.source === "you" ? <button type="button" className="pl-btn" disabled={busy}
              onClick={() => act(async () => { await post(`/api/interview/prep/${applicationId}/date`, "PUT", { date: null }); onDate?.(); })}>Clear</button> : null}
          </>} />
      </div>

      <div data-prep-skills="">
        <SettingsSheet kicker="THE POSTING'S SKILLS AGAINST YOUR PROFILE · ■ YOURS · ⬚ NOT YET" title="Skills"
          lead={!p.skills?.length ? "No skills could be read from this posting." : undefined}
          rows={(p.skills || []).map((s) => ({
            label: s.atlas ? <a href={s.atlas.path} data-atlas-link={s.atlas.slug} data-skill-status={s.status}>{s.name}</a> : <span data-skill-status={s.status}>{s.name}</span>,
            note: s.status !== "have" && s.atlas?.resources?.length > 0
              ? <>{SKILL_WORDS[s.status]} · {s.atlas.resources.map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>{r.title}{r.cost === "free" ? " (free)" : ""} ↗</a>)}</>
              : SKILL_WORDS[s.status],
            control: <span className="pl-pp-mark">{s.status === "have" ? "■" : "⬚"}</span> }))} />
      </div>

      <div data-prep-rounds="">
        <SettingsSheet kicker="LIKELY ROUNDS" title="The rounds" lead={p.rounds?.length ? undefined : "Neither the posting nor the emails name a round."}
          rows={(p.rounds || []).map((r) => ({ label: r.label, note: `read from ${r.evidence.map((e) => `the ${e.from} (“${e.phrase}”)`).join(" and ")}`, control: <span /> }))}>
          {p.platform ? <p className="pl-body"><b>{p.platform.name}:</b> {p.platform.format}</p> : null}
        </SettingsSheet>
      </div>

      <div data-prep-stories="">
        <SettingsSheet kicker={`YOUR STORIES · ${p.stories.length}`} title="Story bank" lead="STAR stories, kept with your account and shown in every interview's prep."
          actions={<>
            <button type="button" className="pl-btn" disabled={busy} onClick={() => act(() => post("/api/interview/stories/from-profile", "POST"))}>Start from my experience</button>
            <button type="button" className="pl-btn" disabled={busy} onClick={() => setEditing({ title: "", situation: "", task: "", action: "", result: "", themes: [] })}>Add a story</button>
          </>}>
          {editing ? <StoryForm story={editing} busy={busy} onCancel={() => setEditing(null)}
            onSave={(s) => act(async () => { if (s.id) await post(`/api/interview/stories/${s.id}`, "PUT", s); else await post("/api/interview/stories", "POST", s); setEditing(null); })} /> : null}
          {p.stories.map((s) => (
            <details key={s.id} className="pl-pp-sealed">
              <summary><b>{s.title}</b> <span className="pl-pp-note">{s.themes.join(" · ")}</span></summary>
              <div className="pl-pp-sealed__body">
                {[["Situation", s.situation], ["Task", s.task], ["Action", s.action], ["Result", s.result]].map(([k, v]) => (
                  <p key={k} className="pl-body"><b>{k}:</b> {v || <span className="pl-pp-note">—</span>}</p>))}
                <div className="pl-actions">
                  <button type="button" className="pl-btn" onClick={() => setEditing(s)}>Edit</button>
                  <button type="button" className="pl-btn pl-btn--dashed" disabled={busy} onClick={() => act(() => post(`/api/interview/stories/${s.id}`, "DELETE"))}>Delete</button>
                </div>
              </div>
            </details>
          ))}
        </SettingsSheet>
      </div>

      <div data-prep-debriefs="">
        <SettingsSheet kicker={`DEBRIEFS · ${p.debriefs.length}`} title="After a round" lead="What was asked and how it went — your own question bank. Only you see it."
          actions={!debrief ? <button type="button" className="pl-btn" onClick={() => setDebrief({ round: "coding", heldOn: "", went: "", notes: "", questions: "" })}>After a round</button> : null}>
          {debrief ? (
            <div className="pl-pp-form">
              <div className="pl-pp-inline">
                <select className="pl-q-select" aria-label="Round" value={debrief.round} onChange={(e) => setDebrief((v) => ({ ...v, round: e.target.value }))}>{ROUND_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <LabelledField label="Held on" type="date" value={debrief.heldOn} onChange={(x) => setDebrief((v) => ({ ...v, heldOn: x }))} />
                <select className="pl-q-select" aria-label="How it went" value={debrief.went} onChange={(e) => setDebrief((v) => ({ ...v, went: e.target.value }))}>{WENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
              <LabelledField label="Questions asked, one per line" multiline value={debrief.questions} onChange={(x) => setDebrief((v) => ({ ...v, questions: x }))} placeholder="The questions asked, one per line" />
              <LabelledField label="Notes" multiline value={debrief.notes} onChange={(x) => setDebrief((v) => ({ ...v, notes: x }))} />
              <div className="pl-actions">
                <button type="button" className="pl-btn pl-btn--ink" disabled={busy} onClick={() => act(async () => {
                  await post("/api/interview/debriefs", "POST", { applicationId, round: debrief.round, heldOn: debrief.heldOn || null, went: debrief.went || null, notes: debrief.notes,
                    questions: debrief.questions.split("\n").map((q) => q.trim()).filter(Boolean) });
                  setDebrief(null);
                })}>Save the debrief</button>
                <button type="button" className="pl-btn" onClick={() => setDebrief(null)}>Cancel</button>
              </div>
            </div>
          ) : null}
          {p.debriefs.map((x) => (
            <div key={x.id} className="pl-settings__row">
              <div className="pl-settings__label">
                <b>{(ROUND_OPTIONS.find(([v]) => v === x.round) || [null, x.round])[1]}</b>
                <span className="pl-settings__note">{[x.heldOn, x.went ? `went ${x.went}` : null].filter(Boolean).join(" · ")}</span>
                {x.questions.length > 0 ? <ul className="pl-pp-list">{x.questions.map((q) => <li key={q.id}>{q.question}</li>)}</ul> : null}
                {x.notes ? <span className="pl-settings__note">{x.notes}</span> : null}
              </div>
            </div>
          ))}
        </SettingsSheet>
      </div>
    </div>
  );
}

function StoryForm({ story, busy, onSave, onCancel }) {
  const [s, setS] = useState({ ...story });
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const toggle = (t) => setS((v) => ({ ...v, themes: v.themes.includes(t) ? v.themes.filter((x) => x !== t) : [...v.themes, t] }));
  return (
    <div data-story-form="" className="pl-pp-form">
      <LabelledField label="Title" value={s.title} onChange={set("title")} />
      {["situation", "task", "action", "result"].map((k) => <LabelledField key={k} label={k[0].toUpperCase() + k.slice(1)} multiline value={s[k]} onChange={set(k)} />)}
      <div className="pl-actions" role="group" aria-label="Themes">
        {THEMES.map((t) => <button key={t} type="button" aria-pressed={s.themes.includes(t)} onClick={() => toggle(t)}
          className={s.themes.includes(t) ? "pl-btn pl-btn--ink" : "pl-btn"}>{t}</button>)}
      </div>
      <div className="pl-actions">
        <button type="button" className="pl-btn pl-btn--ink" disabled={busy || !s.title.trim()} onClick={() => onSave(s)}>Save the story</button>
        <button type="button" className="pl-btn" onClick={onCancel}>Cancel</button>
      </div>
      <span className="pl-pp-note">Only what you did — never a result you did not get.</span>
    </div>
  );
}

export default JobWorkspacePanel;

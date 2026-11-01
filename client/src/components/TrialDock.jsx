// ⭐ D124 · THE TRIAL, ON THE CLIENT (owner 11-01, second amendment: "the trial version needs to be the main frame unless a
// particular account has been granted exclusive access from the admin panel … the whole site is locked out and ends in a
// survey after the 2 drafts with a well curated coming soon message … analytics ready to record user stats and interests").
//
// <TrialGate> wraps the app. For an account that is not in the trial it renders the app and nothing else. For a trial account:
//   · no job profile yet → /try (pick sample A, sample B or their own résumé);
//   · the app, with the dock: Drafts left, Feedback, Something broke?, Finish the trial;
//   · LOCKED (the 2nd Draft sent, or Finish the trial) → the whole page is the survey, then the coming-soon page;
//   · and the analytics: each page opened and each active minute (names and counts, never content).
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";
import { Z } from "../styles/zLayers.js";

const POLL_MS = 45_000;
const LABELS = {
  now: "Now", within_6_months: "Within 6 months", no: "No", yes: "Yes", maybe: "Maybe",
  software: "Software engineering", ml_ai: "ML / AI", data: "Data", frontend_mobile: "Frontend / mobile", infra_devops: "Infra / DevOps / SRE",
  security: "Security", product_other: "Product or other",
  student_new_grad: "Student / new grad", "1_3": "1–3 years", "4_7": "4–7 years", "8_plus": "8+ years",
  no_replies: "No replies", too_many_forms: "Too many forms", not_eligible: "Jobs I'm not eligible for",
  fake_or_stale: "Fake or stale postings", tailoring: "Tailoring résumés", what_to_learn: "Knowing what to learn", other: "Other",
  matched_board: "The matched job board", tailored_resume: "The tailored résumé", filled_and_sent: "Filled and sent for me",
  sponsorship_info: "Sponsorship info", atlas_learning: "Atlas and Learn", inbox: "The Inbox",
  nothing: "Nothing", under_10: "Under $10", "10_20": "$10–20", over_20: "Over $20",
  more_jobs: "More companies and jobs", better_matching: "Better job matching", faster_tailoring: "Faster tailoring",
  more_sites: "Apply on more job sites", interview_prep: "Interview prep", salary_insights: "Salary and offer insights",
  referrals: "Referrals and networking", mobile_app: "A mobile app", browser_extension: "A browser extension",
};
const box = { boxSizing: "border-box", background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)", borderRadius: 6 };
const page = { boxSizing: "border-box", width: "min(680px, calc(100% - 32px))", margin: "40px auto 64px", color: "var(--color-text)" };

function Sheet({ title, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} data-trial-sheet=""
      style={{ position: "fixed", inset: 0, zIndex: Z.TOAST, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
               background: "color-mix(in srgb, var(--color-text) 35%, transparent)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...box, width: "min(560px, 100%)", maxHeight: "calc(100vh - 32px)", overflow: "auto", padding: 20 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Choice({ q, value, onChange }) {
  if (q.type === "select") {
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ ...box, width: "100%", padding: 8, font: "inherit" }}>
        <option value="">Pick one…</option>
        {q.options.map(o => <option key={o} value={o}>{LABELS[o] || o}</option>)}
      </select>
    );
  }
  const many = q.type === "many";
  const options = q.type === "scale" ? Array.from({ length: q.max - q.min + 1 }, (_, i) => String(q.min + i)) : q.options;
  const on = (o) => many ? (value || []).includes(o) : String(value ?? "") === o;
  const toggle = (o) => {
    if (!many) return onChange(q.type === "scale" ? Number(o) : o);
    const cur = value || [];
    onChange(cur.includes(o) ? cur.filter(x => x !== o) : [...cur, o].slice(-q.max));
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => <DepthButton key={o} wrap pressed={on(o)} onClick={() => toggle(o)}>{LABELS[o] || o}</DepthButton>)}
    </div>
  );
}

/** The survey, as the whole page — the trial's ending. Every question optional; the last word is the tester's own. */
function SurveyPage({ survey, onDone }) {
  const [answers, setAnswers] = useState({});
  const [err, setErr] = useState("");
  const set = (k, v) => setAnswers(a => ({ ...a, [k]: v }));
  const send = async () => {
    try { await api("/api/trial/survey", { method: "POST", body: JSON.stringify(answers) }); onDone(); }
    catch (e) { setErr(e.message); }
  };
  const skip = async () => { await api("/api/trial/survey/dismiss", { method: "POST" }).catch(() => {}); onDone(); };
  return (
    <div style={page} data-trial-survey="">
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>That was your trial. Two minutes, then you're done.</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>
        Your answers shape what we build next. Every question is optional. We keep them with your account for 90 days and never
        share your email. <a href="/privacy" target="_blank" rel="noopener">Privacy</a>
      </p>
      {survey.map(q => (
        <div key={q.key} style={{ margin: "18px 0" }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>{q.q}</label>
          {q.type === "text"
            ? <textarea rows={q.key === "thoughts" ? 4 : 2} maxLength={q.max} value={answers[q.key] || ""} onChange={(e) => set(q.key, e.target.value)}
                style={{ ...box, width: "100%", padding: 8, font: "inherit" }}/>
            : q.type === "email"
              ? <input type="email" maxLength={q.max} value={answers[q.key] || ""} onChange={(e) => set(q.key, e.target.value)}
                  style={{ ...box, width: "100%", padding: 8, font: "inherit" }}/>
              : <Choice q={q} value={answers[q.key]} onChange={(v) => set(q.key, v)}/>}
        </div>
      ))}
      {err && <p role="alert" style={{ color: "var(--color-warning)" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <DepthButton onClick={skip}>Skip</DepthButton>
        <DepthButton primary onClick={send}>Send my answers</DepthButton>
      </div>
    </div>
  );
}

/** The coming-soon page: where the trial ends, for good. */
function ComingSoon({ answered }) {
  return (
    <div style={page} data-trial-coming-soon="">
      <h1 style={{ fontSize: 32, lineHeight: 1.2, margin: "0 0 12px" }}>{answered ? "Thank you. That helps more than you know." : "Thank you for trying draft."}</h1>
      <p style={{ fontSize: 17 }}>
        You have seen what draft does: a board matched to your résumé, a résumé tailored to each job, and the application filled
        and sent for you.
      </p>
      <div style={{ ...box, padding: 16, borderLeft: "3px solid var(--color-primary)", margin: "20px 0" }}>
        <strong style={{ display: "block", fontSize: 18, marginBottom: 6 }}>The full version is coming soon</strong>
        <span>
          Unlimited Drafts, FULL AUTO sending on your schedule, the Atlas and Learn to plan what to learn next, and your own Inbox
          for every reply. We are opening it to more people in waves. Your account is already on the list, and we will email you
          when your access is ready.
        </span>
      </div>
      <p style={{ color: "var(--color-text-muted)" }}>Questions or ideas in the meantime? Write to support@jobsviadraft.com.</p>
      <DepthButton onClick={() => api("/api/auth/logout", { method: "POST" }).catch(() => {}).finally(() => { window.location.href = "/"; })}>Sign out</DepthButton>
    </div>
  );
}

/** True below 600 px — the dock folds to one short row there, so it never covers a phone's content (the 11-01 walk). */
function useNarrow() {
  const q = "(max-width: 600px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return undefined;
    const on = () => setNarrow(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return !!narrow;
}

function Dock({ state, onFinish }) {
  const { pathname } = useLocation();
  const narrow = useNarrow();
  const [open, setOpen] = useState(null);   // "feedback" | "broke" | "finish" | null
  const [note, setNote] = useState("");
  const [said, setSaid] = useState("");
  const left = state.draftsUsed == null ? null : Math.max(0, state.drafts - state.draftsUsed);
  const send = async () => {
    const body = open === "broke" ? `Something broke: ${note}` : note;
    try { await api("/api/trial/feedback", { method: "POST", body: JSON.stringify({ body, screen: pathname }) }); setNote(""); setOpen(null); setSaid("Thanks, we got it."); }
    catch (e) { setSaid(e.message); }
  };
  return (
    <>
      <div data-trial-dock="" style={{ position: "fixed", left: 16, bottom: 16, zIndex: Z.TOAST - 1, display: "flex", flexDirection: "column", gap: 8, maxWidth: "calc(100vw - 32px)" }}>
        <div role="note" style={{ ...box, padding: narrow ? "4px 8px" : "8px 12px", fontSize: narrow ? 12 : 13, borderLeft: "3px solid var(--color-primary)", maxWidth: 360 }}>
          Trial: {left == null ? `${state.drafts} Drafts` : `${left} of ${state.drafts} Drafts left`}.
          {state.sample ? (narrow ? ` Sample ${state.sample}: fictional, sends to the practice form.`
            : ` Sample ${state.sample} is a fictional person; its Drafts go to draft's practice form, never to the employer.`) : ""}
        </div>
        {said && <div role="status" style={{ ...box, padding: "8px 12px", fontSize: 13, maxWidth: 360 }}>{said}</div>}
        <div style={{ display: "flex", gap: narrow ? 6 : 8, flexWrap: narrow ? "nowrap" : "wrap" }}>
          <DepthButton wrap size={narrow ? "compact" : "box"} onClick={() => { setSaid(""); setOpen("feedback"); }}>Feedback</DepthButton>
          <DepthButton wrap size={narrow ? "compact" : "box"} onClick={() => { setSaid(""); setOpen("broke"); }}>{narrow ? "Broke?" : "Something broke?"}</DepthButton>
          <DepthButton wrap size={narrow ? "compact" : "box"} onClick={() => setOpen("finish")}>{narrow ? "Finish" : "Finish the trial"}</DepthButton>
        </div>
      </div>
      {(open === "feedback" || open === "broke") && (
        <Sheet title={open === "broke" ? "Something broke? Tell us" : "Feedback"} onClose={() => setOpen(null)}>
          <textarea rows={4} maxLength={2000} value={note} placeholder={open === "broke" ? "What happened, and what did you expect?" : "Anything at all."}
            onChange={(e) => setNote(e.target.value)} style={{ ...box, width: "100%", padding: 8, font: "inherit" }}/>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>We save this with the page you were on ({pathname}).</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <DepthButton onClick={() => setOpen(null)}>Cancel</DepthButton>
            <DepthButton primary disabled={!note.trim()} onClick={send}>Send</DepthButton>
          </div>
        </Sheet>
      )}
      {open === "finish" && (
        <Sheet title="Finish the trial?" onClose={() => setOpen(null)}>
          <p>The site closes for this account and the short survey opens. Use this if your Drafts are stuck or you have seen enough.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <DepthButton onClick={() => setOpen(null)}>Keep going</DepthButton>
            <DepthButton primary onClick={() => { setOpen(null); onFinish(); }}>Finish and take the survey</DepthButton>
          </div>
        </Sheet>
      )}
    </>
  );
}

export default function TrialGate({ children }) {
  const { pathname } = useLocation();
  const [state, setState] = useState(undefined);   // undefined = loading; { trial: false } = the app as is
  const [ended, setEnded] = useState(false);       // the survey was answered or skipped on this page
  const load = useCallback(() => api("/api/trial/state").then(setState).catch(() => setState(s => s ?? { trial: false })), []);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);

  // Analytics: each page opened, and each minute the tab is visible and the trial is open.
  const trial = !!state?.trial;
  const last = useRef(null);
  useEffect(() => {
    if (!trial || last.current === pathname) return;
    last.current = pathname;
    api("/api/trial/event", { method: "POST", body: JSON.stringify({ event: "page", detail: pathname }) }).catch(() => {});
  }, [trial, pathname]);
  useEffect(() => {
    if (!trial || state?.locked) return undefined;
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        api("/api/trial/event", { method: "POST", body: JSON.stringify({ event: "active_minute" }) }).catch(() => {});
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [trial, state?.locked]);

  if (state === undefined) return null;
  if (!state.trial) return children;
  if (!state.hasProfile) return <Navigate to="/try" replace/>;
  if (state.locked) {
    return state.surveyDue && !ended
      ? <SurveyPage survey={state.survey || []} onDone={() => { setEnded(true); load(); }}/>
      : <ComingSoon answered={state.surveyDone}/>;
  }
  return (
    <>
      {children}
      <Dock state={state} onFinish={() => api("/api/trial/finish", { method: "POST" }).then(setState).catch(() => {})}/>
    </>
  );
}

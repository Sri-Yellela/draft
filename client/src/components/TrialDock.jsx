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
import GuidedTour from "./GuidedTour.jsx";

const POLL_MS = 45_000;
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

// ⭐ THE SURVEY IS THE OWNER'S SKETCH (docs/sketches/draft — quick feedback.html): a plain form — a header with a
// progress line, three sections, a card per question, native dropdowns, four 5-star ratings in plain words ("what would
// make this 5 stars?" opens only below 5), follow-ups only when they apply, the required ones asked for before sending.
const STAR_WORDS = ["", "Not useful", "Slightly useful", "Useful", "Very useful", "Exactly what I need"];
const card = { boxSizing: "border-box", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12,
  padding: "18px 20px", marginBottom: 12 };
const field = { boxSizing: "border-box", width: "100%", font: "inherit", color: "var(--color-text)", background: "var(--color-surface-offset)",
  border: "1px solid var(--color-border)", borderRadius: 8, padding: "11px 12px" };
const hint = { display: "block", color: "var(--color-text-muted)", fontSize: 14.5, margin: "0 0 12px", lineHeight: 1.5 };

function Stars({ q, value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }} role="radiogroup" aria-label={`Rate ${q.q.toLowerCase()}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}, ${STAR_WORDS[n]}`}
          data-star={n} onClick={() => onChange(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          style={{ all: "unset", cursor: "pointer", fontSize: 34, lineHeight: 1, color: n <= shown ? "var(--color-warning)" : "var(--color-border)" }}>★</button>
      ))}
      <span style={{ marginLeft: 10, fontSize: 14, color: "var(--color-text-muted)", minWidth: 120 }}>{STAR_WORDS[shown] || ""}</span>
    </div>
  );
}

function Question({ q, answers, set, missing }) {
  const v = answers[q.key];
  const f = q.follow;
  const followOpen = f && v != null && v !== "" && (f.when ? f.when.includes(v) : v < f.below);
  const id = `sq-${q.key}`;
  return (
    <div style={{ ...card, ...(missing ? { borderColor: "var(--color-primary)" } : {}) }} data-survey-q={q.key}>
      <label htmlFor={q.type === "stars" ? undefined : id} style={{ display: "block", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
        {q.q}{q.required ? <span aria-hidden="true" style={{ color: "var(--color-primary)" }}> *</span> : null}
      </label>
      {q.hint && <span style={hint}>{q.hint}</span>}
      {q.type === "select" && (
        <select id={id} value={v || ""} onChange={(e) => set(q.key, e.target.value)} style={field} required={!!q.required}>
          <option value="">Choose one</option>
          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {q.type === "stars" && <Stars q={q} value={v} onChange={(n) => set(q.key, n)}/>}
      {q.type === "text" && (
        <textarea id={id} rows={3} maxLength={q.max} placeholder={q.placeholder || ""} value={v || ""}
          onChange={(e) => set(q.key, e.target.value)} style={{ ...field, minHeight: 78, resize: "vertical" }}/>
      )}
      {q.type === "email" && (
        <input id={id} type="email" maxLength={q.max} placeholder={q.placeholder || ""} value={v || ""}
          onChange={(e) => set(q.key, e.target.value)} style={field}/>
      )}
      {followOpen && (
        <input type="text" maxLength={300} placeholder={f.placeholder} aria-label={f.placeholder} value={answers[f.key] || ""}
          onChange={(e) => set(f.key, e.target.value)} style={{ ...field, marginTop: 12 }} data-survey-follow={f.key}/>
      )}
      {missing && <span role="alert" style={{ display: "block", marginTop: 8, fontSize: 13, color: "var(--color-primary)" }}>Please answer this one.</span>}
    </div>
  );
}

/** The survey, as the whole page — the trial's ending. */
function SurveyPage({ survey, onDone, fieldGuess = null }) {
  const [answers, setAnswers] = useState(() => (fieldGuess ? { field: fieldGuess } : {}));
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState([]);
  const [sent, setSent] = useState(false);
  const set = (k, v) => { setAnswers(a => ({ ...a, [k]: v })); setMissing(m => m.filter(x => x !== k)); };
  const counted = survey.filter(q => q.type === "select" || q.type === "stars");
  const done = counted.filter(q => answers[q.key] != null && answers[q.key] !== "").length;
  const send = async () => {
    const gaps = survey.filter(q => q.required && (answers[q.key] == null || answers[q.key] === "")).map(q => q.key);
    if (gaps.length) {
      setMissing(gaps);
      document.querySelector(`[data-survey-q="${gaps[0]}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    try { await api("/api/trial/survey", { method: "POST", body: JSON.stringify(answers) }); setSent(true); window.scrollTo(0, 0); }
    catch (e) { setErr(e.message); }
  };
  const skip = async () => { await api("/api/trial/survey/dismiss", { method: "POST" }).catch(() => {}); onDone(); };
  if (sent) {
    return (
      <div style={page} data-trial-survey="sent">
        <div style={{ ...card, textAlign: "center", padding: 22 }}>
          <h2 style={{ margin: "0 0 6px" }}>Thank you</h2>
          <p style={{ margin: "0 0 14px", color: "var(--color-text-muted)" }}>That genuinely helps. You can keep using draft with your own résumé any time.</p>
          <DepthButton primary onClick={onDone}>Continue</DepthButton>
        </div>
      </div>
    );
  }
  let section = null;
  return (
    <div style={{ ...page, maxWidth: 680, fontSize: 16, lineHeight: 1.55 }} data-trial-survey="">
      <div style={{ ...card, borderTop: "8px solid var(--color-primary)", padding: "20px 22px", marginBottom: 14 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>Thanks for trying draft</h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>About two minutes. Your honest answers decide what we build next. Nothing here is shared with employers.</p>
        <div style={{ height: 6, background: "var(--color-border)", borderRadius: 3, marginTop: 14, overflow: "hidden" }} aria-hidden="true">
          <i data-survey-progress={done} style={{ display: "block", height: "100%", width: `${counted.length ? Math.round(100 * done / counted.length) : 0}%`,
            background: "var(--color-primary)", transition: "width .25s" }}/>
        </div>
      </div>
      {survey.map(q => {
        const head = q.section && q.section !== section ? (section = q.section) : null;
        return (
          <div key={q.key}>
            {head && <div style={{ margin: "22px 4px 8px", fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
              color: "var(--color-text-muted)" }}>{head}</div>}
            <Question q={q} answers={answers} set={set} missing={missing.includes(q.key)}/>
          </div>
        );
      })}
      {err && <p role="alert" style={{ color: "var(--color-warning)" }}>{err}</p>}
      {missing.length > 0 && <p role="alert" style={{ color: "var(--color-primary)" }}>A few questions marked * still need an answer.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <DepthButton primary onClick={send} data-survey-send="">Send my answers</DepthButton>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          We save your answers with your trial account to improve draft. We never share them with employers.{" "}
          <a href="/privacy" target="_blank" rel="noopener">Privacy</a> · <button type="button" onClick={skip}
            style={{ all: "unset", cursor: "pointer", textDecoration: "underline" }}>Skip the survey</button>
        </p>
      </div>
    </div>
  );
}

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
  const [touring, setTouring] = useState(false);   // D129: the guided tour is on screen, so the dock steps aside
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
      ? <SurveyPage survey={state.survey || []} fieldGuess={state.fieldGuess || null} onDone={() => { setEnded(true); load(); }}/>
      : <ComingSoon answered={state.surveyDone}/>;
  }
  const finish = () => api("/api/trial/finish", { method: "POST" }).then(setState).catch(() => {});
  return (
    <>
      {children}
      {/* D129: the guided tour runs on the real pages until it reaches the survey (or the tester skips it). */}
      <GuidedTour state={state} onFinish={finish} onActive={setTouring}/>
      {!touring && <Dock state={state} onFinish={finish}/>}
    </>
  );
}

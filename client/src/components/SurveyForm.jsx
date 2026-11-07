// ⭐ THE ONE SURVEY FORM (D129 FINAL v2 + D130, owner 11-01) — the standalone page (jobsviadraft.com/survey) renders
// THIS (the trial's in-app survey, its other user, was removed 11-07), with their own questions from the server: a plain, Google-Form-like page — a
// header with a progress line, section headings, a card per question, native dropdowns, labelled 5-star ratings,
// follow-ups only when they apply ("what would make it 5 stars?" below 5), the required ones asked for before sending.
import { useState } from "react";
import DepthButton from "./DepthButton.jsx";

const STAR_WORDS = ["", "Not useful", "Slightly useful", "Useful", "Very useful", "Exactly what I need"];
const card = { boxSizing: "border-box", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12,
  padding: "18px 20px", marginBottom: 12 };
const fieldStyle = { boxSizing: "border-box", width: "100%", font: "inherit", color: "var(--color-text)", background: "var(--color-surface-offset)",
  border: "1px solid var(--color-border)", borderRadius: 8, padding: "11px 12px" };
const hintStyle = { display: "block", color: "var(--color-text-muted)", fontSize: 14.5, margin: "0 0 12px", lineHeight: 1.5 };
export const surveyPage = { boxSizing: "border-box", width: "min(680px, calc(100% - 32px))", margin: "24px auto 64px",
  color: "var(--color-text)", fontSize: 16, lineHeight: 1.55 };
export const surveyCard = card;

function Stars({ q, value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }} role="radiogroup" aria-label={`Rate: ${q.q}`}>
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
      {q.hint && <span style={hintStyle}>{q.hint}</span>}
      {q.type === "select" && (
        <select id={id} value={v || ""} onChange={(e) => set(q.key, e.target.value)} style={fieldStyle} required={!!q.required}>
          <option value="">Choose one</option>
          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {q.type === "stars" && <Stars q={q} value={v} onChange={(n) => set(q.key, n)}/>}
      {q.type === "text" && (q.single
        ? <input id={id} type="text" maxLength={q.max} placeholder={q.placeholder || ""} value={v || ""} autoComplete="name"
            onChange={(e) => set(q.key, e.target.value)} style={fieldStyle}/>
        : <textarea id={id} rows={3} maxLength={q.max} placeholder={q.placeholder || ""} value={v || ""}
            onChange={(e) => set(q.key, e.target.value)} style={{ ...fieldStyle, minHeight: 78, resize: "vertical" }}/>)}
      {q.type === "email" && (
        <input id={id} type="email" maxLength={q.max} placeholder={q.placeholder || ""} value={v || ""}
          autoComplete={q.key === "email" ? "email" : "off"} onChange={(e) => set(q.key, e.target.value)} style={fieldStyle}/>
      )}
      {followOpen && (
        <input type="text" maxLength={300} placeholder={f.placeholder} aria-label={f.placeholder} value={answers[f.key] || ""}
          onChange={(e) => set(f.key, e.target.value)} style={{ ...fieldStyle, marginTop: 12 }} data-survey-follow={f.key}/>
      )}
      {missing && <span role="alert" style={{ display: "block", marginTop: 8, fontSize: 13, color: "var(--color-primary)" }}>Please answer this one.</span>}
    </div>
  );
}

/**
 * @param questions  the server's list (SURVEY or STANDALONE_SURVEY)
 * @param initial    prefilled answers
 * @param title, intro  the header
 * @param onSubmit   async (answers) => void; a thrown error's message is shown
 * @param honeypot   D130: a hidden field a person never fills (a bot does); sent as `website`
 * @param footer     the line under the button (what is saved and why), and any quiet link
 */
export default function SurveyForm({ questions = [], initial = {}, title, intro, onSubmit, honeypot = false, footer = null }) {
  const [answers, setAnswers] = useState(initial);
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState([]);
  const [busy, setBusy] = useState(false);
  const [trap, setTrap] = useState("");
  const set = (k, v) => { setAnswers(a => ({ ...a, [k]: v })); setMissing(m => m.filter(x => x !== k)); };
  const counted = questions.filter(q => q.type === "select" || q.type === "stars" || q.required);
  const done = counted.filter(q => answers[q.key] != null && answers[q.key] !== "").length;
  const send = async () => {
    const gaps = questions.filter(q => q.required && (answers[q.key] == null || String(answers[q.key]).trim() === "")).map(q => q.key);
    if (gaps.length) {
      setMissing(gaps);
      document.querySelector(`[data-survey-q="${gaps[0]}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setBusy(true); setErr("");
    try { await onSubmit(honeypot ? { ...answers, website: trap } : answers); }
    catch (e) { setErr(e.message || "That did not send. Try again."); if (Array.isArray(e.body?.missing)) setMissing(e.body.missing); }
    finally { setBusy(false); }
  };
  let section = null;
  return (
    <div style={surveyPage} data-survey-form="">
      <div style={{ ...card, borderTop: "8px solid var(--color-primary)", padding: "20px 22px", marginBottom: 14 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>{title}</h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{intro}</p>
        <div style={{ height: 6, background: "var(--color-border)", borderRadius: 3, marginTop: 14, overflow: "hidden" }} aria-hidden="true">
          <i data-survey-progress={done} style={{ display: "block", height: "100%", width: `${counted.length ? Math.round(100 * done / counted.length) : 0}%`,
            background: "var(--color-primary)", transition: "width .25s" }}/>
        </div>
      </div>
      {questions.map(q => {
        const head = q.section && q.section !== section ? (section = q.section) : null;
        return (
          <div key={q.key}>
            {head && <div style={{ margin: "22px 4px 8px", fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase",
              color: "var(--color-text-muted)" }}>{head}</div>}
            <Question q={q} answers={answers} set={set} missing={missing.includes(q.key)}/>
          </div>
        );
      })}
      {honeypot && (
        <div aria-hidden="true" style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
          <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} name="website"/></label>
        </div>
      )}
      {err && <p role="alert" style={{ color: "var(--color-warning)" }}>{err}</p>}
      {missing.length > 0 && <p role="alert" style={{ color: "var(--color-primary)" }}>A few questions marked * still need an answer.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <DepthButton primary disabled={busy} onClick={send} data-survey-send="">{busy ? "Sending…" : "Send my answers"}</DepthButton>
        {footer && <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>{footer}</p>}
      </div>
    </div>
  );
}

// ⭐ D142 (owner 11-02) · READINESS — CHECK: where you really stand. /app/atlas/check (the slug "check" is reserved, like
// "learn"). Your skills with their state on the map (claimed → checked → built); an adaptive check per skill — timed,
// extended time, or untimed practice (never penalised) — whose clock is the server's; then an awareness summary by
// concept. ⛔ Not a grade, not a certificate: nothing here is shared. GET /api/readiness, POST /api/readiness/checks.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api.js";

const MODES = [
  { id: "timed", label: "Timed", hint: "The real thing: the timer blocks the easy look-up." },
  { id: "extended", label: "Extended time", hint: "Twice the time on every question — never counted against you." },
  { id: "untimed", label: "Untimed practice", hint: "No clock at all — never counted against you." },
];
const STATE_WORDS = { claimed: "Claimed", checked: "Checked", built: "Built" };

function Timer({ seconds, startedAt }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (seconds == null) return undefined;
    const t = setInterval(() => setLeft(Math.max(0, seconds - Math.floor((Date.now() - startedAt) / 1000))), 250);
    return () => clearInterval(t);
  }, [seconds, startedAt]);
  if (seconds == null) return <span className="atl__quiet">Untimed</span>;
  return <span className="atl-check__timer" data-check-timer={left} aria-live="off">{left}s</span>;
}

export default function ReadinessCheck({ signedIn = true }) {
  const [skills, setSkills] = useState(null);
  const [mode, setMode] = useState("timed");
  const [check, setCheck] = useState(null);       // { checkId, skill, question, number, of, startedAt }
  const [feedback, setFeedback] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const top = useRef(null);
  // ⭐ D172: a skill page's "Prove it" lands here with ?prove=<skill> — that skill is listed first and marked.
  const prove = (new URLSearchParams(useLocation().search).get("prove") || "").trim().toLowerCase();
  const load = () => api("/api/readiness").then(r => setSkills(r.skills)).catch(() => setSkills([]));
  useEffect(() => { if (signedIn) load(); }, [signedIn]);

  if (!signedIn) return <p className="atl__quiet">Sign in to check where you stand on your own skills.</p>;

  async function start(skill) {
    setBusy(true); setError(""); setSummary(null); setFeedback(null);
    try {
      const r = await api("/api/readiness/checks", { method: "POST", body: JSON.stringify({ skill, mode }) });
      setCheck({ ...r, number: 1, startedAt: Date.now() });
      top.current?.scrollIntoView?.({ block: "start" });
    } catch (e) { setError(e.message || "The check could not start."); }
    finally { setBusy(false); }
  }
  async function answer(chosen) {
    if (!check || busy) return;
    setBusy(true);
    try {
      const r = await api(`/api/readiness/checks/${check.checkId}/answer`, { method: "POST", body: JSON.stringify({ questionId: check.question.id, chosen }) });
      setFeedback({ ...r, asked: check.question, chosen });
      if (r.summary) { setSummary(r.summary); setCheck(null); load(); }
      else setCheck(c => ({ ...c, question: r.question, number: r.number, startedAt: Date.now() }));
    } catch (e) { setError(e.message || "That answer was not saved."); }
    finally { setBusy(false); }
  }

  return (
    <section className="atl-check" ref={top} data-readiness="">
      <header className="atl__head">
        <h1 className="atl__title">Check where you stand</h1>
        <p className="atl__lede">A short check on a skill you claim: harder when you're right, easier when you're not. It's for you —
          where you stand today, not a grade or a certificate.</p>
      </header>

      {check && (
        <div className="atl-nav__card" data-check-question={check.question.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span className="atl__quiet">{check.skill} · question {check.number} of up to {check.of}</span>
            <Timer key={check.question.id} seconds={check.question.seconds} startedAt={check.startedAt} />
          </div>
          <p className="atl-check__prompt">{check.question.prompt}</p>
          <ol className="atl-nav__options">
            {check.question.options.map((o, i) => (
              <li key={i}><button type="button" className="atl-nav__option" disabled={busy} onClick={() => answer(i)}><code>{o}</code></button></li>
            ))}
          </ol>
        </div>
      )}

      {feedback && (
        <div className="atl-nav__card" data-check-feedback={feedback.correct ? "right" : "wrong"}>
          <p className="atl-nav__line">
            {feedback.correct ? (feedback.inTime ? "Right." : "Right — but past the timer, so no credit in timed mode.") : `Not quite — the answer is: ${feedback.asked.options[feedback.answer]}`}
          </p>
          {feedback.explanation && <p className="atl__quiet">{feedback.explanation}</p>}
        </div>
      )}

      {summary && (
        <div className="atl-nav__card" data-check-summary="">
          <h2 className="atl-nav__h">{summary.skill}: where you stand</h2>
          <p className="atl-nav__line">{summary.line}</p>
          <p className="atl__quiet">{summary.note}</p>
        </div>
      )}

      {!check && (
        <>
          <div className="atl-nav__card" data-check-modes="">
            <h2 className="atl-nav__h">How you'd like it</h2>
            {MODES.map(m => (
              <label key={m.id} style={{ display: "block", fontSize: 13.5, lineHeight: 1.5 }}>
                <input type="radio" name="check-mode" checked={mode === m.id} onChange={() => setMode(m.id)} /> <strong>{m.label}</strong> — <span className="atl__quiet">{m.hint}</span>
              </label>
            ))}
          </div>
          <div className="atl-nav__card" data-check-skills="">
            <h2 className="atl-nav__h">Your skills</h2>
            {skills == null ? <p className="atl__quiet">Loading…</p> : !skills.length ? <p className="atl__quiet">Add skills to your Profile to check them.</p> : (
              <ul className="atl-nav__steps">
                {(prove ? [...skills].sort((a, b) => (b.skill.toLowerCase() === prove) - (a.skill.toLowerCase() === prove)) : skills).map(s => (
                  <li key={s.key} data-skill-state={s.state} data-prove-target={prove && s.skill.toLowerCase() === prove ? "" : undefined}>
                    <strong>{s.skill}</strong> · {STATE_WORDS[s.state]}{s.lastCheck?.line ? ` — ${s.lastCheck.line}` : ""}{" "}
                    {s.checkAvailable
                      ? <button type="button" className="atl-nav__link" disabled={busy} onClick={() => start(s.skill)}>{s.state === "claimed" ? "Check it" : "Check again"}</button>
                      : <span className="atl__quiet">no check yet</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {error && <p className="atl__quiet" role="alert">{error}</p>}
    </section>
  );
}

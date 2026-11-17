// ⭐ D169 P2 · THE PROOF, IN PLACE — one skill's quick check, or its proof choice, opened where the person is: a row of
// Your skills in Atlas ("Check it · 1 min" / "Add proof") and the ATS panel's "That's true of me" (D152 (8)). Shared, so
// both surfaces open the SAME thing (A93: built once).
//   · QUICK CHECK: 3–5 questions from D150's bank for the skill's Atlas node, D142 Check's rules — the server's clock,
//     Timed / Extended time (×2) / Untimed practice, the last two never penalised; passing moves it to CHECKED.
//   · NO QUESTIONS: proof is a link (D109's validator: https, a real host) → BUILT, or a build (its Learn piece).
//   ⛔ Not a grade, not a certificate. ⛔ A skill not on the résumé stays out of a tailored résumé until this is done.
// Props: skill (its name), atlasBase ("/app/atlas" — where Learn's pieces live), onChange(entry) (the skill's new state,
//   from the server), onClose(), startWith ("check" | "proof" | null — which half opens first).
// API: GET /api/your-skills/prove · POST /api/your-skills/checks (+ /:id/answer) · POST /api/your-skills/proof.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import CardPile from "./CardPile.jsx";   // 46u: draft's card for the question
import { pastelVar } from "../../../shared/pastel.js";
import "./SkillCheck.css";

export const CHECK_MODES = Object.freeze([
  { id: "timed", label: "Timed", hint: "the timer blocks the easy look-up" },
  { id: "extended", label: "Extended time", hint: "twice the time, never counted against you" },
  { id: "untimed", label: "Untimed", hint: "no clock, never counted against you" },
]);

function SkillClock({ seconds, startedAt }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (seconds == null) return undefined;
    const t = setInterval(() => setLeft(Math.max(0, seconds - Math.floor((Date.now() - startedAt) / 1000))), 250);
    return () => clearInterval(t);
  }, [seconds, startedAt]);
  if (seconds == null) return <span className="skc__quiet">untimed</span>;
  return <span className="skc__clock" data-skill-clock={left} aria-live="off">{left}s</span>;
}

/** The proof-link form — D109's kinds; the server validates (https only). */
function SkillProofForm({ skill, kinds, onSaved }) {
  const [kind, setKind] = useState(kinds?.[0]?.kind || "repository");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api("/api/your-skills/proof", { method: "POST", body: JSON.stringify({ skill, url, kind, label }) });
      onSaved?.(r.skill);
    } catch (err) { setError(err.message || "That link was not saved."); }
    finally { setBusy(false); }
  }
  return (
    <form className="skc__proof" onSubmit={save} data-skill-proof-form="">
      <label className="skc__field"><span>Kind</span>
        <select value={kind} onChange={e => setKind(e.target.value)}>
          {(kinds || []).map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>
      </label>
      <label className="skc__field skc__field--wide"><span>Link</span>
        <input type="url" inputMode="url" placeholder="https://github.com/you/project" value={url} onChange={e => setUrl(e.target.value)} required />
      </label>
      <label className="skc__field skc__field--wide"><span>What it is (optional)</span>
        <input type="text" maxLength={60} placeholder="the draft crawler" value={label} onChange={e => setLabel(e.target.value)} />
      </label>
      <button type="submit" className="skc__btn skc__btn--p dbx-depth" disabled={busy || !url.trim()}>Add proof</button>
      <p className="skc__quiet">A link you supply. draft doesn't open it or vouch for it.</p>
      {error && <p className="skc__error" role="alert">{error}</p>}
    </form>
  );
}

export default function SkillCheck({ skill, atlasBase = "/app/atlas", onChange = null, onClose = null, startWith = null }) {
  const [opts, setOpts] = useState(null);
  const [mode, setMode] = useState("timed");
  const [check, setCheck] = useState(null);      // { checkId, question, number, of, startedAt }
  const [feedback, setFeedback] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showProof, setShowProof] = useState(startWith === "proof");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    setOpts(null); setCheck(null); setSummary(null); setFeedback(null); setError("");
    api(`/api/your-skills/prove?skill=${encodeURIComponent(skill)}`)
      .then(r => { if (!off) { setOpts(r); if (!r.checkAvailable) setShowProof(true); } })
      .catch(e => { if (!off) setError(e.message || "This skill could not be read."); });
    return () => { off = true; };
  }, [skill]);

  async function start() {
    setBusy(true); setError(""); setSummary(null); setFeedback(null);
    try {
      const r = await api("/api/your-skills/checks", { method: "POST", body: JSON.stringify({ skill, mode }) });
      setCheck({ ...r, startedAt: Date.now() });
    } catch (e) { setError(e.message || "The check could not start."); }
    finally { setBusy(false); }
  }
  async function answer(chosen) {
    if (!check || busy) return;
    setBusy(true);
    try {
      const r = await api(`/api/your-skills/checks/${check.checkId}/answer`, { method: "POST", body: JSON.stringify({ questionId: check.question.id, chosen }) });
      setFeedback({ ...r, asked: check.question, chosen });
      if (r.summary) { setSummary(r.summary); setCheck(null); if (r.skill) onChange?.(r.skill); }
      else setCheck(c => ({ ...c, question: r.question, number: r.number, startedAt: Date.now() }));
    } catch (e) { setError(e.message || "That answer was not saved."); }
    finally { setBusy(false); }
  }

  const learnHref = opts?.learn ? `${atlasBase}${opts.learn.path}` : null;
  return (
    <section className="skc" data-skill-check={skill} aria-label={`Prove ${skill}`}>
      <header className="skc__head">
        <p className="skc__title">{check ? `Quick check for ${skill}, question ${check.number} of ${check.of}` : `Prove ${skill}`}</p>
        {check ? <SkillClock key={check.question.id} seconds={check.question.seconds} startedAt={check.startedAt} />
          : onClose && <button type="button" className="skc__link" onClick={onClose}>Close</button>}
      </header>

      {!opts && !error && <p className="skc__quiet">Loading…</p>}

      {/* ⭐ 46u (owner 11-17, "use our card design for … trivia"): the question is draft's card in the skill's pastel, the
          questions still to come fanned behind it; answering throws it off for the next. */}
      {check && (
        <CardPile count={check.of} at={check.number - 1} color={pastelVar(skill)} renderFace={(k) => k !== check.number - 1 ? null : (
          <div data-skill-question={check.question.id}>
            <p className="skc__stem">{check.question.stem}</p>
            <div className="skc__opts">
              {check.question.choices.map((c, i) => (
                <button key={i} type="button" className="skc__opt dbx-depth" disabled={busy} onClick={() => answer(i)}>{c}</button>
              ))}
            </div>
          </div>
        )} />
      )}

      {feedback && !summary && (
        <p className="skc__line" data-skill-feedback={feedback.correct ? "right" : "wrong"}>
          {feedback.correct ? (feedback.inTime ? "Right." : "Right, but past the timer.") : `Not quite: ${feedback.asked.choices[feedback.answer]}.`}
          {" "}<span className="skc__quiet">{feedback.correct ? feedback.why : feedback.rightWhy}</span>
        </p>
      )}

      {summary && (
        <div data-skill-summary={summary.passed ? "passed" : "not-yet"}>
          <p className="skc__line">{summary.line}</p>
          <p className="skc__quiet">{summary.note}</p>
          {!summary.passed && <div className="skc__row"><button type="button" className="skc__btn dbx-depth" onClick={start} disabled={busy}>Try again</button>
            <button type="button" className="skc__link" onClick={() => setShowProof(true)}>Add proof instead</button></div>}
        </div>
      )}

      {opts && !check && !summary && (
        <>
          {opts.onResume && <p className="skc__quiet">{skill} is on your résumé already — proving it is for you.</p>}
          {opts.checkAvailable ? (
            <div data-skill-modes="">
              <p className="skc__line">{opts.questions} questions, about a minute. Pass it and {skill} can go into a tailored résumé.</p>
              <div className="skc__modes" role="radiogroup" aria-label="How you'd like it">
                {CHECK_MODES.map(m => (
                  <label key={m.id} className="skc__mode"><input type="radio" name={`skc-mode-${skill}`} checked={mode === m.id} onChange={() => setMode(m.id)} />
                    {" "}{m.label} <span className="skc__quiet">{m.hint}</span></label>
                ))}
              </div>
              <div className="skc__row">
                <button type="button" className="skc__btn skc__btn--p dbx-depth" onClick={start} disabled={busy}>Start the check</button>
                {!showProof && <button type="button" className="skc__link" onClick={() => setShowProof(true)}>Add proof instead</button>}
              </div>
            </div>
          ) : (
            <p className="skc__line" data-skill-no-questions="">
              There are no questions for {skill} yet, so it's proven by a link or a build. Until then it reads not yet checked,
              still counts on your map, and stays out of tailored résumés — an interviewer may ask, so it's offered for Defend practice.
            </p>
          )}
        </>
      )}

      {opts && !check && (showProof || !opts.checkAvailable) && !summary?.passed && (
        <>
          <SkillProofForm skill={skill} kinds={opts.proofKinds} onSaved={(entry) => { onChange?.(entry); onClose?.(); }} />
          {learnHref && <p className="skc__quiet">Or build it: <a className="skc__link" href={learnHref}>{opts.learn.label || "its Learn piece"}</a> — earned, it counts as built.</p>}
        </>
      )}
      {error && <p className="skc__error" role="alert">{error}</p>}
    </section>
  );
}

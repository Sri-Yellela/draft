// ⭐ D185-1 (45s) · "THIS ONE WILL ASK YOU N QUESTIONS" — on the posting panel (and the deck's open posting): the posting's
// OWN application questions (its ATS published the form) that nothing in the profile, saved answers or base résumé
// answers yet, in the employer's wording (GET /api/apply/questions/:jobId — the cache only; nothing drawn until it is read).
// When the owner's answer-drafts switch is on, a free-text one offers Draft an answer: a draft from the résumé only,
// checked (D173), which the person edits and saves as THEIR answer for this employer (POST /api/saved-answers/remember,
// scope 'company') — never saved, never sent by draft on its own.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "./ApplicationQuestions.css";

function DraftOne({ jobId, company, question, onSaved }) {
  const [state, setState] = useState({ kind: "idle" });   // idle · drafting · ready{ text } · saved · error{ msg }
  const draft = async () => {
    setState({ kind: "drafting" });
    try {
      const r = await api(`/api/apply/questions/${encodeURIComponent(jobId)}/draft`, { method: "POST", body: JSON.stringify({ question }) });
      setState({ kind: "ready", text: r.draft, note: r.note });
    } catch (e) { setState({ kind: "error", msg: e.message || "The draft could not be written." }); }
  };
  const save = async () => {
    try {
      await api("/api/saved-answers/remember", { method: "POST", body: JSON.stringify({ question, answer: state.text, company, scope: "company" }) });
      setState({ kind: "saved" }); onSaved?.();
    } catch (e) { setState({ ...state, msg: e.message || "Could not save it." }); }
  };
  if (state.kind === "saved") return <span className="aq__said" role="status">Saved as your answer for {company}.</span>;
  if (state.kind === "ready") return (
    <div className="aq__draft" data-answer-draft="">
      <textarea rows={5} value={state.text} onChange={(e) => setState({ ...state, text: e.target.value })} aria-label={`Your answer to: ${question}`} />
      <p className="aq__said">{state.note}</p>
      <p><button type="button" className="aq__btn" onClick={save} disabled={!state.text.trim()}>Save as my answer</button>{" "}
        <button type="button" className="aq__btn" onClick={() => setState({ kind: "idle" })}>Discard</button></p>
      {state.msg && <p className="aq__said" role="alert">{state.msg}</p>}
    </div>
  );
  return (
    <>
      {" "}<button type="button" className="aq__btn" data-draft-answer="" onClick={draft} disabled={state.kind === "drafting"}>{state.kind === "drafting" ? "Drafting…" : "Draft an answer"}</button>
      {state.kind === "error" && <span className="aq__said" role="alert"> {state.msg}</span>}
    </>
  );
}

export default function ApplicationQuestions({ jobId, company }) {
  const [r, setR] = useState(null);
  const [n, setN] = useState(0);   // a saved answer re-reads the list
  useEffect(() => {
    let live = true;
    setR(null);
    if (!jobId) return undefined;
    api(`/api/apply/questions/${encodeURIComponent(jobId)}`).then(x => live && setR(x)).catch(() => {});
    return () => { live = false; };
  }, [jobId, n]);
  if (!r?.known || !r.count) return null;
  const draftable = new Set(r.drafts ? r.draftable || [] : []);
  return (
    <section className="aq" data-application-questions={r.count} aria-label="Questions this application will ask">
      <p className="aq__k">{r.count === 1 ? "This application will ask you 1 question draft can't answer yet" : `This application will ask you ${r.count} questions draft can't answer yet`}</p>
      <ul className="aq__list">
        {r.questions.map(q => (
          <li key={q.question}><span>{q.question}</span>{q.required ? <span className="aq__req"> · required</span> : null}
            {draftable.has(q.question) && <DraftOne jobId={jobId} company={company} question={q.question} onSaved={() => setN(x => x + 1)} />}</li>
        ))}
      </ul>
    </section>
  );
}

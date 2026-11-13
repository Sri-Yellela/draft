// components/AskDraftThread.jsx — ⭐ A199 (2) (46j, owner 11-13: "these questions in general can move there as its own thread
// with the dropzone id or as a linked local chat to that draft" · "it need not use llm calls" · "run again should trigger
// redraft with a local cached payload plus ask draft companion if the answers cannot be answered from the resume").
//
// ONE held application's questions as a thread in Ask draft (components/AppNav.jsx AskDraftPanel), one at a time, chat-like:
//   · Yes / No and a choice — buttons, no model call;  · a short answer — typed;
//   · a written answer — draft's suggestion from the résumé (POST /api/apply/questions/:jobId/draft), "Use this", or the
//     person's own words for it ("tell draft about it" → redrafted from what they said, `note`) or typed as written.
// "Finish the form" saves the answers to THIS job (POST /api/apply/answers — kept per job, A198 (2)) and re-runs it (free);
// nothing is sent until the person approves it. Draft House's row opens this thread (window event draft:open-questions).
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";

const ask = (jobId, question, note) => api(`/api/apply/questions/${encodeURIComponent(jobId)}/draft`,
  { method: "POST", body: JSON.stringify({ question, ...(note ? { note } : {}) }) });

export default function AskDraftThread({ thread, onSaved, onClose }) {
  const { jobId, company, questions } = thread;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remember, setRemember] = useState({});
  const [sugg, setSugg] = useState({});        // question → { state: loading | ready | none, text, message }
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const endRef = useRef(null);
  const total = questions.length;
  const q = i < total ? questions[i] : null;

  useEffect(() => { setI(0); setAnswers({}); setRemember({}); setSugg({}); setTyped(""); setSaved(null); }, [jobId]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "nearest" }); }, [i, sugg, saved]);
  // A written answer: draft's suggestion, asked for once (the only model call in the thread).
  useEffect(() => {
    if (!q || q.kind !== "draft" || sugg[q.question]) return;
    setSugg(s => ({ ...s, [q.question]: { state: "loading" } }));
    ask(jobId, q.question)
      // A200: an answer with no draft in it is "none" (write it yourself), never an empty suggestion box with "Use this"
      .then(r => setSugg(s => ({ ...s, [q.question]: String(r?.draft || "").trim() ? { state: "ready", text: r.draft } : { state: "none", message: "draft couldn't write this one from your résumé." } })))
      .catch(e => setSugg(s => ({ ...s, [q.question]: { state: "none", message: e?.message || "draft couldn't write this one from your résumé." } })));
  }, [q, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (question, value, keep = true) => {
    setAnswers(a => ({ ...a, [question]: value }));
    setRemember(r => ({ ...r, [question]: keep }));
    setTyped("");
    setI(n => n + 1);
  };
  const redraft = async () => {
    const note = typed.trim();
    if (!q || !note) return;
    setSugg(s => ({ ...s, [q.question]: { state: "loading", note } }));
    try {
      const r = await ask(jobId, q.question, note);
      if (!String(r?.draft || "").trim()) throw new Error("draft couldn't write it from that.");
      setSugg(s => ({ ...s, [q.question]: { state: "ready", text: r.draft, note } })); setTyped("");
    }
    catch (e) { setSugg(s => ({ ...s, [q.question]: { state: "none", message: e?.message || "draft couldn't write it from that.", note } })); }
  };
  const finish = async () => {
    setBusy(true);
    try {
      const r = await api("/api/apply/answers", { method: "POST",
        body: JSON.stringify({ answers, remember, retryJobIds: [String(jobId)], mode: "auto" }) });
      const n = Object.keys(answers).length;
      setSaved({ ok: true, text: r?.message || `Saved ${n} answer${n === 1 ? "" : "s"}. draft is finishing the form again (free) — it comes back ready for your approval. Nothing is sent until you approve it.` });
      onSaved?.(jobId);
    } catch (e) { setSaved({ ok: false, text: e?.message || "Your answers couldn't be saved — try again." }); }
    finally { setBusy(false); }
  };

  const s = q ? sugg[q.question] : null;
  const send = () => { if (q && typed.trim()) answer(q.question, typed.trim(), q.kind !== "draft"); };
  // ⭐ A200 (46k, owner 11-13: "format it and also use the former font and styling … design the chat panel inline with design
  // plan"): the thread wears the held stepper's look (Draft House's dht-step — redrawn here as .appnav-ask__q / __big / __draft,
  // since a page's classes stay in its page): the question large, Yes / No as big depth boxes, one primary action, the
  // answered ones a quiet transcript above. Depth boxes for every control, no pills (D60).
  return (
    <section className="appnav-ask__thread" data-ask-thread={String(jobId)} aria-label={`${company || "This application"} — its questions`}>
      <header className="appnav-ask__threadhead" data-ask-thread-head="">
        <p className="appnav-ask__meta"><b>{company || "This application"}</b> · {total} question{total === 1 ? "" : "s"} only you can settle</p>
        <DepthButton size="compact" data-ask-thread-close="" onClick={onClose}>Close</DepthButton>
      </header>
      <div className="appnav-ask__turns" aria-live="polite">
        {questions.slice(0, i).map(x => (
          <div key={x.question} className="appnav-ask__turn" data-ask-turn="answered">
            <p className="appnav-ask__asked">{x.question}</p>
            <p className="appnav-ask__said">{String(answers[x.question] ?? "").slice(0, 400)}</p>
          </div>
        ))}
        {q && (
          <div className="appnav-ask__turn appnav-ask__card" key={q.question} data-ask-turn="current" data-ask-kind={q.kind}>
            <p className="appnav-ask__meta">{i + 1} of {total}{q.required ? " · required" : ""}</p>
            <p className="appnav-ask__q" data-ask-question="">{q.question}</p>
            {q.kind === "yesno" || q.kind === "choice" ? (
              <div className="appnav-ask__choices" data-many={(q.options?.length || 2) > 3 ? "true" : "false"} role="group" aria-label={q.question}>
                {(q.options?.length ? q.options : ["Yes", "No"]).map(o => (
                  <DepthButton key={o} wrap className="appnav-ask__big" data-ask-choice={o} pressed={answers[q.question] === o} onClick={() => answer(q.question, o)}>{o}</DepthButton>
                ))}
              </div>
            ) : q.kind === "draft" ? (
              <>
                {s?.state === "loading" && <p className="appnav-ask__meta" data-ask-busy="">Writing it from {s.note ? "what you said" : "your résumé"}…</p>}
                {s?.state === "ready" && (
                  <>
                    <p className="appnav-ask__draft" data-ask-suggestion="">{s.text}</p>
                    <div className="appnav-ask__acts">
                      <DepthButton primary data-ask-use="" onClick={() => answer(q.question, s.text, false)}>Use this</DepthButton>
                    </div>
                  </>
                )}
                {s?.state === "none" && <p className="appnav-ask__text" data-ask-no-draft="">{s.message} Tell draft about it below, or type your answer as you want it sent.</p>}
              </>
            ) : null}
            {q.kind !== "yesno" && q.kind !== "choice" && (
              <div className="appnav-ask__form">
                <textarea className="appnav-ask__input" rows={q.kind === "draft" ? 4 : 2} aria-label={q.question} value={typed} maxLength={2000}
                  onChange={e => setTyped(e.target.value)} data-ask-thread-input=""
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && q.kind !== "draft") { e.preventDefault(); send(); } }}
                  placeholder={q.kind === "draft" ? "Your answer, or what draft should know (e.g. I set up Splunk alerts for payments)…" : "Your answer…"} />
                <div className="appnav-ask__acts">
                  <DepthButton primary={q.kind !== "draft" || s?.state !== "ready"} disabled={!typed.trim()} data-ask-send-answer="" onClick={send}>Use as written</DepthButton>
                  {q.kind === "draft" && <DepthButton disabled={!typed.trim() || s?.state === "loading"} onClick={redraft} data-ask-redraft="">Write it from this</DepthButton>}
                </div>
              </div>
            )}
            {i > 0 && <button type="button" className="appnav-ask__link" data-ask-back="" onClick={() => setI(n => Math.max(0, n - 1))}>Back</button>}
          </div>
        )}
        {!q && !saved && (
          <div className="appnav-ask__turn appnav-ask__card" data-ask-turn="done">
            <p className="appnav-ask__q">All answered</p>
            <p className="appnav-ask__meta">draft finishes the form with your {total} answer{total === 1 ? "" : "s"}, then it waits for your approval. Nothing is sent until you approve it.</p>
            <div className="appnav-ask__acts">
              <DepthButton primary disabled={busy} onClick={finish} data-ask-finish="">{busy ? "Saving…" : "Finish the form"}</DepthButton>
              <DepthButton onClick={() => setI(0)} data-ask-review="">Review</DepthButton>
            </div>
          </div>
        )}
        {saved && <p className="appnav-ask__text" role="status" data-ask-saved={saved.ok ? "true" : "false"}>{saved.text}</p>}
        <span ref={endRef} />
      </div>
    </section>
  );
}

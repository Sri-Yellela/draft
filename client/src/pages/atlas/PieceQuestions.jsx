// client/src/pages/atlas/PieceQuestions.jsx — ⭐ D150 T14 (46y) · QUESTIONS INSIDE LEARN: a piece's items from the owner-approved
// bank (GET /api/learn/piece/:id/questions — no answer key leaves the server), one at a time: a due review first, then one never
// answered, then one last answered wrong. A piece is CHECKED when every one of its items was answered right the last time; a
// wrong answer comes back for review (1 → 3 → 7 → 21 days — the daily question's one rule). Nothing new is written here: a
// piece with no approved item shows nothing. Signed out, the questions are counted and sign-in is offered.
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { localDay, MatchAnswer, OrderAnswer } from "./BankAnswers.jsx";
import { pieceCheckLine } from "./libraryModel.js";

export default function PieceQuestions({ pieceId, signedIn = false }) {
  const [d, setD] = useState(null);
  const [cur, setCur] = useState(null);       // the item being asked
  const [r, setR] = useState(null);           // its result, once answered
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const day = localDay();
  useEffect(() => {
    let live = true;
    setD(null); setCur(null); setR(null); setErr("");
    api(`/api/learn/piece/${encodeURIComponent(pieceId)}/questions?day=${day}`)
      .then(x => { if (live) { setD(x); setCur(x.next || null); } }).catch(() => live && setD({ questions: [] }));
    return () => { live = false; };
  }, [pieceId, day, signedIn]);
  if (!d?.questions?.length) return null;
  const q = d.questions.find(x => x.id === cur) || null;
  const answer = async (chosen, response = null) => {
    if (busy || r || !q) return;
    setBusy(true); setErr("");
    try {
      const out = await api(`/api/learn/piece/${encodeURIComponent(pieceId)}/answer`, { method: "POST",
        body: JSON.stringify(response ? { questionId: q.id, response, day } : { questionId: q.id, chosen, day }) });
      setR(out.result);
      setD(x => ({ ...x, state: out.state, next: out.next }));
    } catch (e) { setErr(e.message || "That answer didn't save."); } finally { setBusy(false); }
  };
  const nextOne = () => { setCur(d.next || null); setR(null); };
  const st = d.state;
  return (
    <div className="lrc__box lrc__box--qs" data-learn-questions={pieceId} data-learn-checked={st?.checked ? "true" : "false"}>
      <h3 className="lrc__box-h">Questions · <span data-learn-check-line="">{pieceCheckLine(st, d.questions.length)}</span></h3>
      {!signedIn && <p className="atl__quiet">Sign in to answer them. A lesson is checked when every one of its questions is right.</p>}
      {signedIn && st && st.due.length > 0 && !r && <p className="atl__quiet" data-learn-due={st.due.length}>{st.due.length} to review here.</p>}
      {signedIn && !q && st?.checked && (
        <p className="atl__quiet" data-learn-all-right="">All right. {st.next ? `They come back for review from ${st.next}.` : ""}</p>
      )}
      {signedIn && !q && st && !st.checked && (
        <p className="atl__quiet" data-learn-come-back="">The ones you missed come back for review{st.next ? ` from ${st.next}` : ""}.</p>
      )}
      {signedIn && q && (
        <div className="atl-dq" data-learn-question={q.id}>
          <p className="lrc__q-stem">{q.stem}</p>
          {q.type === "match" && <MatchAnswer key={q.id} q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)} />}
          {q.type === "order" && <OrderAnswer key={q.id} q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)} />}
          {Array.isArray(q.choices) && (
            <div className="atl-dq__choices" role="group" aria-label="Choices">
              {q.choices.map((c, i) => (
                <button key={i} type="button" className="atl-dq__choice" disabled={!!r || busy} onClick={() => answer(i)}
                  data-state={r ? (i === r.correctIndex ? "right" : i === r.chosen ? "wrong" : "") : ""}>{c}</button>
              ))}
            </div>
          )}
          {r && (
            <div className="atl-dq__why" data-learn-why="" role="status">
              {Array.isArray(q.choices)
                ? <><p><b>{r.correct ? "Right." : "Not quite."}</b> {r.why?.chosen}</p>
                    {!r.correct && r.why?.right && <p><b>The stronger move:</b> {r.why.rightChoice} — {r.why.right}</p>}</>
                : <p><b>{r.correct ? "Right." : `${(r.parts || []).filter(Boolean).length} of ${(r.parts || []).length} in place.`}</b>{typeof r.why === "string" ? ` ${r.why}` : ""}</p>}
              {!r.correct && <p className="atl__quiet">It comes back for review tomorrow.</p>}
              {d.next && d.next !== q.id
                ? <button type="button" className="atl-dq__choice atl-dq__go" onClick={nextOne} data-learn-next="">Next question</button>
                : <button type="button" className="atl-dq__choice atl-dq__go" onClick={nextOne} data-learn-next="">Done</button>}
            </div>
          )}
        </div>
      )}
      {err && <p className="atl__quiet" role="alert">{err}</p>}
    </div>
  );
}

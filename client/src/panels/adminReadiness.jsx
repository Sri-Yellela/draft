// ⭐ D142 · Admin → Data → Readiness questions. ⛔ "An answer key that is wrong destroys trust": a question reaches users
// only after a PERSON approves it here. The drafts — the agent's seed among them — wait as drafts; the most-claimed
// skills say where the content is needed first ("start with CHECK for the 10 most-claimed skills").
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, row, quiet, sub } from "./adminKit.jsx";

export function ReadinessTab() {
  const [status, setStatus] = useState("draft");
  const [data, setData] = useState(null);
  const [said, setSaid] = useState("");
  const load = useCallback(() => api(`/api/admin/readiness?status=${status}`).then(setData).catch(e => setSaid(e.message)), [status]);
  useEffect(() => { load(); }, [load]);

  const review = async (id, action) => {
    try { await api(`/api/admin/readiness/questions/${id}/review`, { method: "POST", body: JSON.stringify({ action }) }); setSaid(`Question ${id}: ${action}d.`); load(); }
    catch (e) { setSaid(e.message); }
  };

  return (
    <Panel title="Readiness questions" data-admin-readiness=""
      purpose="The CHECK bank. Nothing reaches a user until you approve it — read the prompt, every option and the answer key.">
      {data && (
        <div style={sub}>
          <strong>Most-claimed skills on Profiles</strong>
          <div style={quiet}>{data.mostClaimed.length ? data.mostClaimed.map(m => `${m.skill} (${m.people} · ${m.live} live / ${m.draft} draft)`).join(" · ") : "No Profile skills yet."}</div>
        </div>
      )}
      <div style={{ ...row, margin: "10px 0" }}>
        {["draft", "live", "retired"].map(s => (
          <DepthButton key={s} onClick={() => setStatus(s)} aria-pressed={status === s}>{s === "draft" ? "Waiting for review" : s === "live" ? "Live" : "Retired"}</DepthButton>
        ))}
        {said && <span style={quiet}>{said}</span>}
      </div>
      {data?.questions?.length === 0 && <div style={quiet}>None.</div>}
      {data?.questions?.map(q => (
        <div key={q.id} style={{ ...sub, marginBottom: 8 }} data-readiness-question={q.id}>
          <div style={quiet}>{q.skill} · {q.concept} · difficulty {q.difficulty} · {q.seconds}s · written by {q.written_by}{q.reviewed_by ? ` · reviewed by ${q.reviewed_by}` : ""}</div>
          <div style={{ whiteSpace: "pre-wrap", fontWeight: 600, margin: "4px 0" }}>{q.prompt}</div>
          <ol style={{ margin: "4px 0", paddingLeft: 20 }}>
            {q.options.map((o, i) => <li key={i} style={{ fontWeight: i === q.answer ? 800 : 400 }}>{o}{i === q.answer ? "  ← the answer key" : ""}</li>)}
          </ol>
          {q.explanation && <div style={quiet}>{q.explanation}</div>}
          <div style={{ ...row, marginTop: 6 }}>
            {q.status !== "live" && <DepthButton onClick={() => review(q.id, "approve")}>Approve — make it live</DepthButton>}
            {q.status !== "draft" && <DepthButton onClick={() => review(q.id, "draft")}>Back to draft</DepthButton>}
            {q.status !== "retired" && <DepthButton onClick={() => review(q.id, "retire")}>Retire</DepthButton>}
          </div>
        </div>
      ))}
    </Panel>
  );
}

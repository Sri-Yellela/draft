// ⭐ D150 T02 · Admin → Data → Question bank — the review desk for the ONE question bank (services/learn/learnQuestions.js).
// ⛔ Nothing reaches the audit, Check, Play, Learn or the guides until a person presses Approve here: read the stem, every
// choice, the answer key and the why for each. Filters: role · level · type · status · flagged. One item open at a time:
// edit it, approve, retire; its answers, correct share, median time and how many picked each choice; the flags (too easy,
// too hard, a choice nobody picks, answered too fast) once it has enough answers.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Btn, Panel, Mark, row, quiet, sub } from "./adminKit.jsx";
import { C } from "../styles/colorTokens.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const LEVELS = ["entry", "early", "mid", "senior", "staff"];
const TYPES = ["scenario", "recall", "explain"];
const STATUS_WORD = { draft: "Waiting for review", live: "Live", retired: "Retired" };
const letter = (i) => String.fromCharCode(65 + i);
const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)} %`);
const fieldBox = { width: "100%", font: "inherit", fontSize: ts(13), padding: "6px 8px", boxSizing: "border-box" };

function Editor({ q, onSave, onCancel }) {
  const [stem, setStem] = useState(q.stem);
  const [choices, setChoices] = useState(q.choices);
  const [why, setWhy] = useState(q.why);
  const [correct, setCorrect] = useState(q.correct);
  const [skills, setSkills] = useState(q.skills.join(", "));
  const [pieces, setPieces] = useState(q.pieces.join(", "));
  const list = (s) => s.split(",").map(x => x.trim()).filter(Boolean);
  const set = (arr, setArr, i, v) => setArr(arr.map((x, j) => (j === i ? v : x)));
  return (
    <div data-question-editor="" style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <label style={quiet}>Stem<textarea style={fieldBox} rows={3} value={stem} onChange={e => setStem(e.target.value)} /></label>
      {choices.map((c, i) => (
        <div key={i} style={{ ...sub, display: "grid", gap: 4 }}>
          <label style={{ ...quiet, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="radio" name={`correct-${q.id}`} checked={correct === i} onChange={() => setCorrect(i)} /> {letter(i)} — the answer key
          </label>
          <input style={fieldBox} value={c} onChange={e => set(choices, setChoices, i, e.target.value)} aria-label={`Choice ${letter(i)}`} />
          <textarea style={fieldBox} rows={2} value={why[i]} onChange={e => set(why, setWhy, i, e.target.value)} aria-label={`Why ${letter(i)}`} />
        </div>
      ))}
      <label style={quiet}>Skills (Atlas slugs, comma-separated)<input style={fieldBox} value={skills} onChange={e => setSkills(e.target.value)} /></label>
      <label style={quiet}>Learn pieces (step ids, comma-separated)<input style={fieldBox} value={pieces} onChange={e => setPieces(e.target.value)} /></label>
      <div style={row}>
        <Btn onClick={() => onSave({ stem, choices, why, correct, skills: list(skills), pieces: list(pieces) })}>Save the edit</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
        {q.status === "live" && <span style={quiet}>Saving sends a live question back to review.</span>}
      </div>
    </div>
  );
}

export function QuestionBankTab() {
  const [filters, setFilters] = useState({ role: "", level: "", type: "", status: "draft", flagged: false });
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(false);
  const [said, setSaid] = useState("");
  const load = useCallback(() => {
    const q = new URLSearchParams();
    for (const k of ["role", "level", "type", "status"]) if (filters[k]) q.set(k, filters[k]);
    if (filters.flagged) q.set("flagged", "1");
    return api(`/api/admin/questions?${q}`).then(setData).catch(e => setSaid(e.message));
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const setF = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setOpen(null); setEditing(false); };

  const review = async (id, action, edits = null) => {
    try {
      await api(`/api/admin/questions/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ action, edits }) });
      setSaid(`${id}: ${action === "approve" ? "approved — live" : action === "retire" ? "retired" : "edited"}.`);
      setEditing(false);
      if (action !== "edit") setOpen(null);
      load();
    } catch (e) { setSaid(e.message); }
  };

  const select = (k, values, label) => (
    <label style={quiet}>{label}{" "}
      <select value={filters[k]} onChange={e => setF(k, e.target.value)}>
        <option value="">any</option>
        {values.map(v => <option key={v} value={v}>{STATUS_WORD[v] || v}</option>)}
      </select>
    </label>
  );

  return (
    <Panel title="Question bank" data-admin-questions=""
      purpose="The one bank the audit, Check, Play, Learn and the guides read. Nothing is live until you approve it — read the stem, every choice, the answer key and the why for each.">
      {data && (
        <div style={{ ...row, marginBottom: 8 }}>
          <span style={quiet}>{data.counts.draft || 0} waiting · {data.counts.live || 0} live · {data.counts.retired || 0} retired</span>
          {data.unknownPieces?.length > 0 && <Mark tone={C.WARNING}>{data.unknownPieces.length} cited Learn piece(s) do not exist: {data.unknownPieces.map(p => p.piece).join(", ")}</Mark>}
        </div>
      )}
      <div style={{ ...row, margin: "6px 0 12px" }}>
        {select("status", ["draft", "live", "retired"], "Status")}
        {select("role", data?.roles || [], "Role")}
        {select("level", LEVELS, "Level")}
        {select("type", TYPES, "Type")}
        <label style={quiet}><input type="checkbox" checked={filters.flagged} onChange={e => setF("flagged", e.target.checked)} /> Flagged only</label>
        {said && <span style={quiet} role="status">{said}</span>}
      </div>
      {data?.items?.length === 0 && <div style={quiet}>None.</div>}
      {data?.items?.map(q => (
        <div key={q.id} style={{ ...sub, marginBottom: 8 }} data-question={q.id}>
          <button type="button" onClick={() => { setOpen(open === q.id ? null : q.id); setEditing(false); }} aria-expanded={open === q.id}
            style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
            <div style={quiet}>{q.id} · {q.role || "any role"} · {q.level || "any level"} · {q.type} · {STATUS_WORD[q.status]}
              {q.stats.answered ? ` · ${q.stats.answered} answered, ${pct(q.stats.correctShare)} right` : ""}</div>
            <div style={{ fontWeight: 600, margin: "4px 0" }}>{q.stem}</div>
            {q.flags.length > 0 && <div style={row}>{q.flags.map(f => <Mark key={f.code} tone={C.WARNING}>{f.text}</Mark>)}</div>}
          </button>
          {open === q.id && !editing && (
            <div data-question-open="">
              {/* ⭐ D154 P2: a match / order item shows its key read-only (edit it in the content file). */}
              {q.type === "match" && <ol style={{ margin: "6px 0", paddingLeft: 22 }} data-question-key="match">{q.left.map((l, i) => (
                <li key={i} style={{ marginBottom: 6 }}><div><b>{l}</b> → {q.right[q.answer[i]]}</div><div style={quiet}>Why: {q.why[i]}</div></li>))}</ol>}
              {q.type === "order" && <ol style={{ margin: "6px 0", paddingLeft: 22 }} data-question-key="order">{q.answer.map((si, k) => (
                <li key={k} style={{ marginBottom: 6 }}><div>{q.steps[si]}</div>{Array.isArray(q.why) && <div style={quiet}>Why: {q.why[si]}</div>}</li>))}
                {typeof q.why === "string" && <div style={quiet}>Why: {q.why}</div>}</ol>}
              {Array.isArray(q.choices) && <ol type="A" style={{ margin: "6px 0", paddingLeft: 22 }}>
                {q.choices.map((c, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: i === q.correct ? 800 : 400 }}>{c}{i === q.correct ? "  ← the answer key" : ""}</div>
                    <div style={quiet}>Why: {q.why[i]}</div>
                    {q.stats.answered > 0 && <div style={quiet}>Picked by {q.stats.choices[i]} ({pct(q.stats.choices[i] / q.stats.answered)})</div>}
                  </li>
                ))}
              </ol>}
              <div style={quiet}>Skills: {q.skills.join(", ") || "—"} · Learn pieces: {q.pieces.join(", ") || "—"}
                {q.stats.medianMs != null ? ` · median ${(q.stats.medianMs / 1000).toFixed(1)} s` : ""}
                {q.reviewedBy ? ` · last reviewed by ${q.reviewedBy}` : ""}</div>
              <div style={{ ...row, marginTop: 8 }}>
                {q.status !== "live" && <Btn onClick={() => review(q.id, "approve")}>Approve — make it live</Btn>}
                {Array.isArray(q.choices) && <Btn onClick={() => setEditing(true)}>Edit</Btn>}
                {q.status !== "retired" && <Btn onClick={() => review(q.id, "retire")}>Retire</Btn>}
              </div>
            </div>
          )}
          {open === q.id && editing && <Editor q={q} onSave={(edits) => review(q.id, "edit", edits)} onCancel={() => setEditing(false)} />}
        </div>
      ))}
    </Panel>
  );
}

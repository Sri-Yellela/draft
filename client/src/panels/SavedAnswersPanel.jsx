// D55 (f) · Settings → Saved answers (docs/AUTOFILL_TARGET.md §8.1 rows 6–7).
// List, edit, delete; export as JSON / CSV; import through the server's five guards (a dry run first);
// and "Test a question" — paste a question, see which saved answer matches and why, or that it would
// stop. Every answer here is the candidate's own; nothing is generated.
import { useCallback, useEffect, useState } from "react";
import { api, authHeaders } from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import { COMPANY_TOKEN } from "../../../shared/savedAnswers.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const KIND_TAGS = [
  ["eligibility", "Attestation"], ["eeo", "EEO"], ["optIn", "Opt-in"],
  ["motivation", "Own words"], ["workedHere", "Work history"], ["template", COMPANY_TOKEN],
];

// ⭐ D96 §4 · the lifecycle: a remembered answer's state, the date it was acknowledged, and its history.
const CATEGORY_WORDS = {
  work_auth: "work authorisation", sponsorship: "sponsorship", visa: "visa", citizenship: "citizenship",
  clearance: "clearance", criminal: "criminal history", eeo: "voluntary disclosure",
};
const SOURCE_WORDS = { you_typed: "you typed it", you_acknowledged: "you acknowledged it", legacy: "saved before the review panel" };
const EVENT_WORDS = { changed: "Changed on the page", acknowledged: "Acknowledged", edited: "Edited in Settings" };
function answerDate(isoString, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", opts);
}
/** "You last reviewed your work-authorisation answers in July" — the quiet 90-day line, or null. */
function reviewLine(reviewDue) {
  if (!reviewDue?.due) return null;
  const what = (reviewDue.categories || []).map(c => CATEGORY_WORDS[c] || c.replace(/_/g, " ")).join(", ") || "eligibility";
  return `You last reviewed your ${what} answers in ${answerDate(reviewDue.lastReviewedAt, { month: "long", year: "numeric" })}. Are they still right?`;
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SavedAnswersPanel() {
  const { theme } = useTheme();
  const [entries, setEntries] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);       // { question, answer, company, previousQuestion }
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [importResult, setImportResult] = useState(null);
  const [testQ, setTestQ] = useState("");
  const [testCompany, setTestCompany] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [lifecycle, setLifecycle] = useState([]);
  const [reviewDue, setReviewDue] = useState(null);
  const [editingKeyed, setEditingKeyed] = useState(null);   // { id, answer }

  const load = useCallback(async () => {
    try {
      const d = await api("/api/saved-answers");
      setEntries(d.entries || []); setLifecycle(d.lifecycle || []); setReviewDue(d.reviewDue || null);
    }
    catch (e) { setMsg(e.message || "Could not load your saved answers."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setBusy(true); setMsg("");
    try { await fn(); } catch (e) { setMsg(e.payload?.error ? `Not saved: ${e.payload.error}` : (e.message || "Something went wrong.")); }
    finally { setBusy(false); }
  };

  const save = () => run(async () => {
    const d = await api("/api/saved-answers", { method: "PUT", body: JSON.stringify(editing) });
    setEntries(d.entries || []); setEditing(null); setMsg("Saved.");
  });
  const remove = (e) => run(async () => {
    const d = await api("/api/saved-answers", { method: "DELETE", body: JSON.stringify({ question: e.question, company: e.company }) });
    setEntries(d.entries || []); setMsg("Deleted.");
  });
  const saveKeyed = () => run(async () => {
    await api(`/api/saved-answers/lifecycle/${editingKeyed.id}`, { method: "PUT", body: JSON.stringify({ answer: editingKeyed.answer }) });
    setEditingKeyed(null); await load(); setMsg("Saved — remembered for next time.");
  });
  const removeKeyed = (row) => run(async () => {
    await api(`/api/saved-answers/lifecycle/${row.id}`, { method: "DELETE" });
    await load(); setMsg("Deleted — the next form that asks will ask you again.");
  });
  const stillRight = () => run(async () => {
    const d = await api("/api/saved-answers/review", { method: "POST", body: JSON.stringify({ action: "confirmed" }) });
    setReviewDue(d.reviewDue || null); setMsg("Thanks — reviewed.");
  });
  const exportAs = (format) => run(async () => {
    const r = await fetch(`/api/saved-answers/export?format=${format}`, { credentials: "include", headers: authHeaders() });
    if (!r.ok) throw new Error(`Export failed (${r.status})`);
    download(`draft-saved-answers.${format}`, await r.text(), format === "csv" ? "text/csv" : "application/json");
  });
  const importFile = (apply) => run(async () => {
    const d = await api("/api/saved-answers/import", {
      method: "POST", body: JSON.stringify({ format: importFormat, content: importText, apply }),
    });
    setImportResult(d);
    if (d.applied) { await load(); setMsg(`Imported ${d.accepted.length}.`); }
  });
  const test = () => run(async () => {
    setTestResult(await api("/api/saved-answers/test", {
      method: "POST", body: JSON.stringify({ question: testQ, company: testCompany || null }),
    }));
  });

  const box = { border: `1px solid ${theme.border}`, borderRadius: 8, padding: "14px 16px", background: theme.surface,
                display: "flex", flexDirection: "column", gap: 10 };
  const input = { width: "100%", padding: "6px 8px", fontSize: ts(12), borderRadius: 4, border: `1px solid ${theme.border}`,
                  background: theme.surface, color: theme.text, boxSizing: "border-box" };
  const btn = { border: `1px solid ${theme.border}`, borderRadius: 6, padding: "5px 10px", background: theme.surface,
                color: theme.text, fontWeight: 700, fontSize: ts(12), cursor: busy ? "wait" : "pointer" };
  const h = { fontWeight: 800, fontSize: ts(14), color: theme.text };
  const sub = { fontSize: ts(12), color: theme.textMuted, lineHeight: 1.5 };

  return (
    <div data-saved-answers-panel="" style={{ maxWidth: 860, margin: "0 auto", padding: "0 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: ts(20), color: theme.text }}>Saved answers</div>
        <div style={sub}>
          Your own answers, reused when a form asks the same question in the same words. Write {COMPANY_TOKEN} where
          the employer's name goes. Work authorisation, EEO and opt-in questions are only ever answered by your answer
          to exactly that wording — never by a similar one — and draft never opts you in.
        </div>
        {msg && <div style={{ ...sub, color: theme.accentText, marginTop: 6 }}>{msg}</div>}
        {reviewLine(reviewDue) && (
          <div data-review-due="" style={{ ...sub, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
            <span style={markStyle(theme.textDim, { kind: "info" })}>Review</span>
            <span>{reviewLine(reviewDue)}</span>
            <button style={btn} disabled={busy} onClick={stillRight}>Still right</button>
          </div>
        )}
      </div>

      {/* ── D96 §4 · Remembered on application pages: state, date acknowledged, history ── */}
      <section style={box} data-lifecycle-answers="">
        <div style={h}>Remembered on application pages</div>
        <div style={sub}>
          Answers you acknowledged in the review panel — used by every later fill and shown in the Copy sheet. Change one
          on a page and it is not used again until you acknowledge the new value. Terms, consent and signature boxes are
          never remembered: those are always your own click.
        </div>
        {lifecycle.length === 0 && <div style={sub}>Nothing remembered from a page yet.</div>}
        {lifecycle.map(row => (
          <div key={row.id} data-lifecycle-row={row.state} style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 8,
                                                                    display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: ts(12), fontWeight: 700, color: theme.text }}>{row.question}</div>
              {editingKeyed?.id === row.id ? (
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <input value={editingKeyed.answer} onChange={e => setEditingKeyed({ ...editingKeyed, answer: e.target.value })} style={{ ...input, maxWidth: 320 }} placeholder="Your answer"/>
                  <button style={btn} disabled={busy || !editingKeyed.answer.trim()} onClick={saveKeyed}>Save and remember</button>
                  <button style={btn} disabled={busy} onClick={() => setEditingKeyed(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{ fontSize: ts(12), color: theme.textMuted, wordBreak: "break-word" }}>
                  {row.state === "acknowledged" ? row.answer : <em>changed on a page — you will be asked again</em>}
                </div>
              )}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3, alignItems: "center" }}>
                <span style={markStyle(row.state === "acknowledged" ? C.SUCCESS : C.WARNING)}>
                  {row.state === "acknowledged" ? "Acknowledged" : "Changed"}
                </span>
                {row.attesting && <span style={markStyle(theme.textDim)}>You are attesting to this</span>}
                <span style={{ fontSize: ts(11), color: theme.textDim }}>
                  {row.state === "acknowledged"
                    ? `${SOURCE_WORDS[row.source] || "saved"} · acknowledged ${answerDate(row.acknowledgedAt)}`
                    : `changed ${answerDate(row.changedAt)}`}
                </span>
              </div>
              {row.history?.length > 0 && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ fontSize: ts(11), color: theme.textMuted, cursor: "pointer" }}>History ({row.history.length})</summary>
                  {row.history.map((ev, i) => (
                    <div key={i} style={{ fontSize: ts(11), color: theme.textMuted, marginTop: 2 }}>
                      {answerDate(ev.at)} · {EVENT_WORDS[ev.event] || ev.event}: {ev.from ?? "—"} → {ev.to ?? "—"}{ev.jobId ? ` · job ${ev.jobId}` : ""}
                    </div>
                  ))}
                </details>
              )}
            </div>
            <button style={btn} disabled={busy} onClick={() => setEditingKeyed({ id: row.id, answer: row.answer || "" })}>Edit</button>
            <button style={{ ...btn, color: C.DANGER }} disabled={busy} onClick={() => removeKeyed(row)}>Delete</button>
          </div>
        ))}
      </section>

      {/* ── Test a question ── */}
      <section style={box} data-test-a-question="">
        <div style={h}>Test a question</div>
        <div style={sub}>Paste a question from a form — see which saved answer would fill it and why, or that it would stop.</div>
        <textarea rows={2} value={testQ} onChange={e => setTestQ(e.target.value)} style={input}
          placeholder="Have you ever worked for Acme before?"/>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input value={testCompany} onChange={e => setTestCompany(e.target.value)} style={{ ...input, maxWidth: 240 }}
            placeholder="Employer (optional)"/>
          <button style={btn} disabled={busy || !testQ.trim()} onClick={test}>Test</button>
        </div>
        {testResult && (
          <div data-test-outcome={testResult.outcome} style={{ fontSize: ts(12), color: theme.text, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontWeight: 800, color: testResult.outcome === "fills" ? C.SUCCESS : testResult.outcome === "guess" ? C.WARNING : C.DANGER }}>
              {testResult.outcome === "fills" ? `Fills: ${testResult.value}` : testResult.outcome === "guess" ? `A guess: ${testResult.value} — it would hold for you` : "No match: it would stop"}
            </div>
            {(testResult.why || []).map((w, i) => <div key={i} style={sub}>{w}</div>)}
          </div>
        )}
      </section>

      {/* ── The list ── */}
      <section style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ ...h, flex: 1 }}>{entries.length} saved answer{entries.length === 1 ? "" : "s"}</div>
          <button style={btn} disabled={busy} onClick={() => setEditing({ question: "", answer: "", company: null })}>Add</button>
          <button style={btn} disabled={busy} onClick={() => exportAs("json")}>Export JSON</button>
          <button style={btn} disabled={busy} onClick={() => exportAs("csv")}>Export CSV</button>
        </div>
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
            <input value={editing.question} onChange={e => setEditing({ ...editing, question: e.target.value })} style={input} placeholder="Question"/>
            <textarea rows={2} value={editing.answer} onChange={e => setEditing({ ...editing, answer: e.target.value })} style={input} placeholder="Your answer"/>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn} disabled={busy || !editing.question.trim()} onClick={save}>Save</button>
              <button style={btn} disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}
        {entries.length === 0 && <div style={sub}>Nothing saved yet. Answers you give in Home with "Save this answer for next time" ticked appear here.</div>}
        {entries.map((e, i) => (
          <div key={`${e.company || ""}::${e.question}`} style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 8,
                                                                  display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: ts(12), fontWeight: 700, color: theme.text }}>{e.question}</div>
              <div style={{ fontSize: ts(12), color: theme.textMuted, wordBreak: "break-word" }}>{e.answer || <em>no answer yet</em>}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                {e.company && <span style={{ fontSize: ts(9), fontWeight: 800, color: theme.textDim }}>ONLY FOR {e.company.toUpperCase()}</span>}
                {KIND_TAGS.filter(([k]) => e.kind?.[k]).map(([k, label]) => (
                  <span key={k} style={markStyle(theme.textDim)}>{label}</span>
                ))}
                {e.acknowledgedAt && <span style={{ fontSize: ts(11), color: theme.textDim }}>acknowledged {answerDate(e.acknowledgedAt)}</span>}
              </div>
            </div>
            <button style={btn} disabled={busy} onClick={() => setEditing({ question: e.question, answer: e.answer, company: e.company, previousQuestion: e.question })}>Edit</button>
            <button style={{ ...btn, color: C.DANGER }} disabled={busy} onClick={() => remove(e)}>Delete</button>
          </div>
        ))}
      </section>

      {/* ── Import ── */}
      <section style={box} data-import="">
        <div style={h}>Import</div>
        <div style={sub}>
          Paste a JSON or CSV export (columns: question, answer, company). It is checked first and nothing is written
          until you press Import. Work-authorisation, EEO and opt-in answers are never imported — answer those on the
          form, in your own words. Keyword-matching rules from other tools are refused: draft matches exact words only.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={importFormat} onChange={e => setImportFormat(e.target.value)} style={{ ...input, maxWidth: 120 }}>
            <option value="json">JSON</option><option value="csv">CSV</option>
          </select>
          <button style={btn} disabled={busy || !importText.trim()} onClick={() => importFile(false)}>Check</button>
          <button style={btn} disabled={busy || !importText.trim() || !importResult?.accepted?.length} onClick={() => importFile(true)}>Import</button>
        </div>
        <textarea rows={5} value={importText} onChange={e => { setImportText(e.target.value); setImportResult(null); }} style={input}/>
        {importResult && (
          <div style={sub} data-import-result="">
            {importResult.accepted.length} would be imported{importResult.applied ? " — done" : ""}; {importResult.rejected.length} refused.
            {importResult.rejected.slice(0, 20).map((r, i) => (
              <div key={i}>Row {r.row ?? "—"}{r.question ? ` "${r.question}"` : ""}: {r.reason}</div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default SavedAnswersPanel;

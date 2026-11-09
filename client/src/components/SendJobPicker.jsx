// ⭐ D180 P2 (45o) · SEND A JOB — the spec: "sending a job is everywhere a posting appears … pick people + an optional note →
// it arrives as a job card in their messages", and for anyone off draft, "a link to the public posting page". Shown only
// while the network is on (the caller asks /api/network/status); the job is the OPEN board's (its id from its public page).
// ⛔ D60: no capsules.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";
import "./SendJobPicker.css";

/** The board id at the end of a public posting path (/jobs/<company>-<title>-<id>), or null. Pure. */
export const boardIdOf = (path) => { const m = /-(\d+)$/.exec(String(path || "")); return m ? Number(m[1]) : null; };

export default function SendJobPicker({ job, onClose }) {
  const [people, setPeople] = useState(null);
  const [chosen, setChosen] = useState(() => new Set());
  const [note, setNote] = useState("");
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const jobId = boardIdOf(job?.publicPath);
  useEffect(() => { api("/api/network").then(n => setPeople(n.connections || [])).catch(() => setPeople([])); }, []);
  const toggle = (h) => setChosen(s => { const n = new Set(s); n.has(h) ? n.delete(h) : n.add(h); return n; });
  const send = async () => {
    setBusy(true); setSaid("");
    let ok = 0;
    for (const h of chosen) {
      try { await api("/api/network/messages", { method: "POST", body: JSON.stringify({ to: h, jobId, text: note || null }) }); ok++; }
      catch (e) { setSaid(e.message || "Some didn't go through."); }
    }
    setBusy(false);
    if (ok) { setSaid(`Sent to ${ok} ${ok === 1 ? "person" : "people"}.`); setTimeout(() => onClose?.(), 1200); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${job.publicPath}`); setSaid("Link copied — anyone can open it."); } catch { setSaid("Copy didn't work here."); }
  };
  return (
    <div className="sjp" role="dialog" aria-label={`Send ${job?.title || "this job"}`} data-send-job-picker="">
      <div className="sjp__head"><b>Send {job?.title}</b><button type="button" className="sjp__close" onClick={onClose}>Close ×</button></div>
      {!jobId && <p className="sjp__quiet">This job has no public page yet, so it can't be sent.</p>}
      {jobId && people === null && <p className="sjp__quiet" role="status">Reading your connections…</p>}
      {jobId && people?.length === 0 && <p className="sjp__quiet">No connections yet — copy the link instead, or connect from Network.</p>}
      {jobId && people?.length > 0 && (
        <ul className="sjp__list">
          {people.map(p => (
            <li key={p.handle}><label><input type="checkbox" checked={chosen.has(p.handle)} onChange={() => toggle(p.handle)} /> {p.name}{p.label ? <span className="sjp__quiet"> · {p.label}</span> : null}</label></li>
          ))}
        </ul>
      )}
      {jobId && people?.length > 0 && <input className="sjp__note" value={note} maxLength={4000} onChange={e => setNote(e.target.value)} placeholder="A note (optional)" aria-label="A note with the job" />}
      <div className="sjp__row">
        {jobId && people?.length > 0 && <DepthButton primary disabled={!chosen.size || busy} onClick={send}>{busy ? "Sending…" : `Send to ${chosen.size || "…"}`}</DepthButton>}
        {job?.publicPath && <DepthButton onClick={copy}>Copy public link</DepthButton>}
        {said && <span className="sjp__quiet" role="status">{said}</span>}
      </div>
    </div>
  );
}

// ⭐ D180 P1 (45o) · Admin → People → Network — the network switch (OFF by default) and its counts. The owner turns it on
// only after counsel has answered the user-content questions (the owner's list D (19)); the switch is audited.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Btn, Panel, row, quiet, sub, field } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const STATUS = [["open", "Open"], ["actioned", "Actioned"], ["dismissed", "Dismissed"]];
const when = (s) => (s ? new Date(s * 1000).toLocaleString() : "—");

/** ⭐ D180 P2 (45o) · the moderation queue — reports from messages, conversations and profiles. Reading a REPORTED message is
 *  the one read of a message outside its two people. Actioned can remove the message for both (its sealed body erased). */
function ReportsQueue() {
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const [said, setSaid] = useState("");
  const load = useCallback(() => api(`/api/admin/network/reports?status=${status}`).then(d => setRows(d.reports)).catch(e => setSaid(e.message)), [status]);
  useEffect(() => { load(); }, [load]);
  const resolve = async (id, next, removeMessage = false) => {
    try { await api(`/api/admin/network/reports/${id}`, { method: "POST", body: JSON.stringify({ status: next, note: notes[id] || null, removeMessage }) }); setSaid(`Report ${id}: ${next}${removeMessage ? ", message removed" : ""}.`); load(); }
    catch (e) { setSaid(e.message); }
  };
  return (
    <div data-network-reports="">
      <div style={{ ...row, margin: "14px 0 8px" }}>
        <b>Reports</b>
        <label style={quiet}>Status <select value={status} onChange={e => setStatus(e.target.value)}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        {said && <span style={quiet} role="status">{said}</span>}
      </div>
      {rows?.length === 0 && <div style={quiet}>None.</div>}
      {rows?.map(r => (
        <div key={r.id} style={{ ...sub, marginBottom: 8 }} data-network-report={r.id}>
          <div style={quiet}>#{r.id} · {when(r.at)} · a {r.kind} · {r.reason} · {r.reportsOnThisPerson} report{r.reportsOnThisPerson === 1 ? "" : "s"} on this person in all</div>
          <div style={{ fontWeight: 600, margin: "4px 0" }}>{r.reported?.handle ? <a href={`/in/${encodeURIComponent(r.reported.handle)}`} target="_blank" rel="noreferrer">{r.reported.name}</a> : r.reported?.name}</div>
          {r.target?.text && <div style={{ whiteSpace: "pre-wrap", fontSize: ts(13) }}>“{r.target.text}”</div>}
          {r.target?.job && <div style={quiet}>A job: {r.target.job.title} · {r.target.job.company}</div>}
          {r.target?.removed && <div style={quiet}>The message was removed.</div>}
          {r.details && <div style={{ fontSize: ts(13) }}>Reporter's note: {r.details}</div>}
          {r.note && <div style={quiet}>Your note: {r.note}</div>}
          <div style={{ ...row, marginTop: 8 }}>
            <input style={{ ...field, flex: "1 1 220px" }} placeholder="Note — what you did (optional)" aria-label={`Note for report ${r.id}`}
              value={notes[r.id] || ""} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
            {r.kind === "message" && !r.target?.removed && r.status !== "actioned" && <Btn onClick={() => resolve(r.id, "actioned", true)}>Remove the message</Btn>}
            {r.status !== "actioned" && <Btn onClick={() => resolve(r.id, "actioned")}>Actioned</Btn>}
            {r.status !== "dismissed" && <Btn onClick={() => resolve(r.id, "dismissed")}>Dismiss</Btn>}
            {r.status !== "open" && <Btn onClick={() => resolve(r.id, "open")}>Re-open</Btn>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NetworkTab() {
  const [d, setD] = useState(null);
  const [said, setSaid] = useState("");
  const load = useCallback(() => api("/api/admin/network").then(setD).catch(e => setSaid(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const flip = async (on) => {
    if (on && !window.confirm("Turn the network on for everyone? Counsel's answers on user content should be in first.")) return;
    try { await api("/api/admin/network", { method: "PUT", body: JSON.stringify({ enabled: on }) }); setSaid(on ? "The network is on." : "The network is off."); load(); }
    catch (e) { setSaid(e.message); }
  };
  return (
    <Panel title="Network" data-admin-network=""
      purpose="Connections between people (D180 P1). OFF until you turn it on — while off nobody sees Network, Connect or a connection's view of a profile.">
      <div style={{ ...row, margin: "6px 0 12px", gap: 16 }}>
        <span data-network-state={d?.enabled ? "on" : "off"}><b>{d ? (d.enabled ? "On" : "Off") : "…"}</b></span>
        {d && <Btn primary={!d.enabled} onClick={() => flip(!d.enabled)}>{d.enabled ? "Turn off" : "Turn on"}</Btn>}
        {said && <span style={quiet} role="status">{said}</span>}
      </div>
      {d?.counts && <div style={quiet}>{d.counts.connections ?? "—"} connections · {d.counts.pending ?? "—"} requests waiting · {d.counts.blocks ?? "—"} blocks · {d.counts.threads ?? "—"} conversations · {d.counts.reportsOpen ?? "—"} open reports</div>}
      <ReportsQueue />
    </Panel>
  );
}

// ⭐ D183 · Admin → People → Profile reports — the moderation queue for public profiles (/in/<handle> → Report).
// Reads GET /api/admin/profile-reports?status=open|dismissed|actioned (routes/publicProfile.js); each report can be
// dismissed, actioned (with a note: what was done) or re-opened. The reporter is never shown — only a salted hash is kept.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, row, quiet, sub, field } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const STATUS = [["open", "Open"], ["actioned", "Actioned"], ["dismissed", "Dismissed"]];
const when = (s) => (s ? new Date(s * 1000).toLocaleString() : "—");

export function ProfileReportsTab() {
  const [status, setStatus] = useState("open");
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState({});
  const [said, setSaid] = useState("");
  const load = useCallback(() => api(`/api/admin/profile-reports?status=${status}`).then(setData).catch(e => setSaid(e.message)), [status]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id, next) => {
    try {
      await api(`/api/admin/profile-reports/${id}`, { method: "POST", body: JSON.stringify({ status: next, note: notes[id] || "" }) });
      setSaid(`Report ${id}: ${next === "open" ? "re-opened" : next}.`);
      load();
    } catch (e) { setSaid(e.message); }
  };

  return (
    <Panel title="Profile reports" data-admin-profile-reports=""
      purpose="Reports people sent from a public profile (/in/<handle> → Report this profile). Open the profile, decide, and leave a note saying what you did. Who reported is never stored — only a one-way hash used for the daily limit.">
      <div style={{ ...row, margin: "6px 0 12px" }}>
        <label style={quiet}>Status{" "}
          <select value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {said && <span style={quiet} role="status">{said}</span>}
      </div>
      {data?.reports?.length === 0 && <div style={quiet}>None.</div>}
      {data?.reports?.map(r => (
        <div key={r.id} style={{ ...sub, marginBottom: 8 }} data-profile-report={r.id}>
          <div style={quiet}>#{r.id} · {when(r.created_at)} · {r.total} report{r.total === 1 ? "" : "s"} on this person in all
            {r.resolved_at ? ` · resolved ${when(r.resolved_at)}` : ""}</div>
          <div style={{ fontWeight: 600, margin: "4px 0" }}>
            <a href={`/in/${encodeURIComponent(r.handle)}`} target="_blank" rel="noreferrer">/in/{r.handle}</a> — {r.reason || "no reason given"}
          </div>
          {r.details && <div style={{ whiteSpace: "pre-wrap", fontSize: ts(13) }}>{r.details}</div>}
          {r.resolved_note && <div style={quiet}>Note: {r.resolved_note}</div>}
          <div style={{ ...row, marginTop: 8 }}>
            <input style={{ ...field, flex: "1 1 240px" }} placeholder="Note — what you did (optional)" aria-label={`Note for report ${r.id}`}
              value={notes[r.id] || ""} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
            {r.status !== "actioned" && <DepthButton onClick={() => resolve(r.id, "actioned")}>Actioned</DepthButton>}
            {r.status !== "dismissed" && <DepthButton onClick={() => resolve(r.id, "dismissed")}>Dismiss</DepthButton>}
            {r.status !== "open" && <DepthButton onClick={() => resolve(r.id, "open")}>Re-open</DepthButton>}
          </div>
        </div>
      ))}
    </Panel>
  );
}

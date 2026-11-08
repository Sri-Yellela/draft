// ⭐ D151 Rule 6 · Admin → System → Diagnostics — what the agent used to ask production's shell for, read here instead
// (GET /api/admin/system/diagnostics): boot, event-loop delay, the slowest endpoints, the board's counts, the database
// and WAL size, the crawler's last runs, the growth alarm. "Issue a 24-hour token" hands out this one read, nothing else.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, row, quiet, sub } from "./adminKit.jsx";

const mb = (b) => (b == null ? "—" : `${(b / 1024 / 1024).toFixed(1)} MB`);
const when = (s) => (s ? new Date((s > 1e11 ? s : s * 1000)).toLocaleString() : "—");

export function DiagnosticsTab() {
  const [d, setD] = useState(null);
  const [tok, setTok] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api("/api/admin/system/diagnostics").then(setD).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const issue = async () => { try { setTok(await api("/api/admin/system/diag-token", { method: "POST", body: "{}" })); } catch (e) { setErr(e.message); } };
  const last = d?.loop?.samples?.slice(-1)[0];
  return (
    <Panel title="Diagnostics" data-admin-diagnostics=""
      purpose="How the server is doing, without shell access to production. Event-loop p99 over 100 ms for five minutes, or a day's runaway growth, also raises an alert on At a glance.">
      {err && <div style={quiet} role="alert">{err}</div>}
      <div style={{ ...row, marginBottom: 8 }}>
        <DepthButton onClick={load}>Refresh</DepthButton>
        <DepthButton onClick={issue}>Issue a 24-hour read token</DepthButton>
        {tok && <span style={quiet}>Token (shown once): <code>{tok.url}</code> · {tok.note}</span>}
      </div>
      {d && <>
        <div style={sub}>
          <b>Event loop</b>{" "}
          <span style={quiet}>{last ? `last minute p50 ${last.p50} ms · p99 ${last.p99} ms · max ${last.max} ms` : "no sample yet (one a minute after boot)"}</span>
          {d.loop.alert && <div role="alert">⚠ {d.loop.alert.subject} — {d.loop.alert.detail}</div>}
        </div>
        <div style={{ ...sub, marginTop: 8 }}>
          <b>Slowest endpoints, last hour</b>
          {d.slowest.lastHour.length === 0 ? <div style={quiet}>No requests timed yet.</div>
            : <table style={{ width: "100%", fontSize: 12 }}><thead><tr><th align="left">Endpoint</th><th>Calls</th><th>p50</th><th>p95</th><th>p99</th></tr></thead>
              <tbody>{d.slowest.lastHour.map(e => <tr key={e.endpoint}><td>{e.endpoint}</td><td align="center">{e.calls}</td><td align="center">{e.p50}</td><td align="center">{e.p95}</td><td align="center">{e.p99}</td></tr>)}</tbody></table>}
        </div>
        <div style={{ ...sub, marginTop: 8 }}>
          <b>Board and database</b>
          <div style={quiet}>{d.board.active?.toLocaleString() ?? "—"} active · {d.board.closed?.toLocaleString() ?? "—"} closed · archive: {d.board.archiveNote}</div>
          <div style={quiet}>database {mb(d.database.bytes)} · WAL {mb(d.database.walBytes)}</div>
          {d.growth && <div role="alert">⚠ {d.growth.subject} — {d.growth.detail}</div>}
        </div>
        <div style={{ ...sub, marginTop: 8 }}>
          <b>Boot</b> <span style={quiet}>{d.boot ? `${d.boot.state} · listen ${d.boot.listenMs ?? "—"} ms · ready ${d.boot.readyMs ?? "—"} ms` : "—"}</span>
          {Array.isArray(d.crawler) && d.crawler.length > 0 && <div style={quiet}>Last runs: {d.crawler.map(r => `${r.run_kind}/${r.source || "—"} ${r.status} ${when(r.started_at)}`).join(" · ")}</div>}
        </div>
      </>}
    </Panel>
  );
}

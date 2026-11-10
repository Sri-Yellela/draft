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

// ⭐ D151 Rule 2 (46c) · the background job system's queue (GET /api/admin/jobs → queueStats): one row per kind — what waits,
// what runs, what failed in the last day, how long the oldest has waited, and the slowest finished job.
export function BackgroundJobsSection() {
  const [kinds, setKinds] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api("/api/admin/jobs").then(r => { setKinds(r.kinds || []); setErr(""); }).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const waited = (ms) => (ms ? `${Math.max(0, Math.round((Date.now() - ms) / 1000))} s` : "—");
  return (
    <Panel title="Background jobs" data-admin-bg-jobs=""
      purpose="The one job system: each kind runs in slices of at most 200 ms, one job per kind and key, retried with backoff and marked failed after 5 tries.">
      {err && <div style={quiet} role="alert">{err}</div>}
      <div style={{ ...row, marginBottom: 8 }}><DepthButton onClick={load}>Refresh</DepthButton></div>
      {kinds && (kinds.length === 0 ? <div style={quiet}>No jobs have run yet.</div>
        : <table style={{ width: "100%", fontSize: 12 }}><thead><tr><th align="left">Kind</th><th>Waiting</th><th>Running</th><th>Failed today</th><th>Oldest waiting</th><th>Slowest</th></tr></thead>
          <tbody>{kinds.map(k => <tr key={k.kind} data-bg-kind={k.kind}><td>{k.kind}</td><td align="center">{k.waiting ?? 0}</td><td align="center">{k.running ?? 0}</td>
            <td align="center">{k.failedDay ? <span role="alert">{k.failedDay}</span> : 0}</td><td align="center">{waited(k.oldestWaiting)}</td>
            <td align="center">{k.slowestMs == null ? "—" : `${k.slowestMs} ms`}</td></tr>)}</tbody></table>)}
    </Panel>
  );
}

// ⭐ D151 Rule 4 (45s) · the nightly archive of closed postings — OFF until turned on here (audited). A closed posting older
// than 120 days that no person's history names moves to the archive whole; restorePosting brings one back.
export function PostingArchiveSection() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/admin/posting-archive").then(setS).catch(e => setErr(e.message)); }, []);
  const flip = async () => { try { setS(await api("/api/admin/posting-archive", { method: "PUT", body: JSON.stringify({ enabled: !s.enabled }) })); } catch (e) { setErr(e.message); } };
  return (
    <Panel title="Archive of closed postings" data-admin-posting-archive=""
      purpose={`Nightly at 04:50 UTC: closed postings older than ${s?.afterDays ?? 120} days that no application, résumé, pick, packet or message points at move to the archive, in slices of 100. Off until you turn it on.`}>
      {err && <div style={quiet} role="alert">{err}</div>}
      {s && <div style={row} data-archive-state={s.enabled ? "on" : "off"}>
        <b>{s.enabled ? "On" : "Off"}</b>
        <DepthButton primary={!s.enabled} onClick={flip}>{s.enabled ? "Turn off" : "Turn on"}</DepthButton>
        <span style={quiet}>{s.archived} archived so far{s.lastRun ? ` · last run ${s.lastRun.status}, ${s.lastRun.slices || 0} slices, ${s.lastRun.duration_ms || 0} ms, ${when(s.lastRun.finished_at)}` : ""}</span>
      </div>}
    </Panel>
  );
}

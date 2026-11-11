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

// ⭐ D187 HB-10 · Admin → System → Hirebase (GET / PUT /api/admin/hirebase): whether anything can be sent (HIREBASE_ENABLED,
// HIREBASE_DRY_RUN — Railway variables), the month / day caps and what is used (Hirebase's own Usage headers), the runs with
// their counts, and the two first runs — the free sizing estimates and the one-page sample (HB-9). Both obey the caps.
export function HirebaseSection() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [caps, setCaps] = useState({ month: "", day: "" });
  const load = useCallback(() => api("/api/admin/hirebase").then(r => { setS(r); setCaps({ month: String(r.caps.month), day: String(r.caps.day) }); setErr(""); })
    .catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const saveCaps = async () => { try { setS(await api("/api/admin/hirebase", { method: "PUT", body: JSON.stringify({ monthCap: caps.month, dayCap: caps.day }) })); } catch (e) { setErr(e.message); } };
  const run = async (what) => {
    setBusy(what); setErr("");
    try { const r = await api(`/api/admin/hirebase/${what}`, { method: "POST", body: "{}" }); setS(r.state); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };
  const mode = !s ? "" : !s.enabled ? "Off — nothing is sent (HIREBASE_ENABLED)" : s.dryRun ? "Dry run — requests are logged, not sent (HIREBASE_DRY_RUN)" : "Live — requests are sent";
  return (
    <Panel title="Hirebase" data-admin-hirebase=""
      purpose="The job-data feed (D187). Every request states its worst-case cost first and is refused past the caps; the sizing estimates are free, the sample costs up to 100 jobs.">
      {err && <div style={quiet} role="alert">{err}</div>}
      {s && <>
        <div style={row} data-hirebase-mode={!s.enabled ? "off" : s.dryRun ? "dry" : "live"}>
          <b>{mode}</b>
          <span style={quiet}>{s.hasKey ? "key set" : "no key"} · our boards {s.skipOurBoards ? "skipped" : "not skipped"} ({s.ourBoards.join(", ")})</span>
        </div>
        <div style={{ ...row, marginTop: 8 }}>
          <span>Used this month <b>{s.used.month}</b> of
            <input aria-label="Month cap (jobs)" style={{ width: 90, margin: "0 6px" }} value={caps.month} onChange={e => setCaps({ ...caps, month: e.target.value })}/>
            · today <b>{s.used.day}</b> of
            <input aria-label="Day cap (jobs)" style={{ width: 70, margin: "0 6px" }} value={caps.day} onChange={e => setCaps({ ...caps, day: e.target.value })}/></span>
          <DepthButton onClick={saveCaps}>Save caps</DepthButton>
          <span style={quiet}>{s.used.fromHeaders ? "from Hirebase's own count" : "draft's count (no usage header yet)"}</span>
        </div>
        <div style={{ ...row, marginTop: 8 }}>
          <DepthButton disabled={!!busy} onClick={() => run("sizing")}>{busy === "sizing" ? "Sizing…" : "Run sizing (free)"}</DepthButton>
          <DepthButton disabled={!!busy} onClick={() => run("sample")}>{busy === "sample" ? "Sampling…" : "Run sample (up to 100 jobs)"}</DepthButton>
          <DepthButton onClick={load}>Refresh</DepthButton>
        </div>
        {s.lastError && <div style={quiet} role="alert">Last error: {s.lastError}</div>}
        {s.runs.length === 0 ? <div style={{ ...quiet, marginTop: 8 }}>No runs yet.</div>
          : <table style={{ width: "100%", fontSize: 12, marginTop: 8 }}><thead><tr><th align="left">Run</th><th>Status</th><th>Units</th><th>New</th><th>Merged</th><th>Held</th><th>Dropped</th><th>When</th></tr></thead>
            <tbody>{s.runs.map(r => <tr key={r.id} data-hirebase-run={r.kind}><td>{r.kind}{r.dry_run ? " (dry)" : ""}</td><td align="center">{r.status}</td>
              <td align="center">{r.units_used}</td><td align="center">{r.counts?.new ?? "—"}</td><td align="center">{r.counts?.merged ?? "—"}</td>
              <td align="center">{r.counts?.held ?? "—"}</td><td align="center">{r.counts?.dropped ?? "—"}</td><td>{when(r.started_at)}</td></tr>)}</tbody></table>}
        {s.runs.find(r => r.kind === "estimate" && r.counts?.estimates) && (
          <div style={{ ...sub, marginTop: 8 }} data-hirebase-sizing="">
            <b>Latest sizing</b>
            {s.runs.find(r => r.kind === "estimate" && r.counts?.estimates).counts.estimates.map(e => <div key={e.label} style={quiet}>{e.label}: {e.count == null ? "— (dry run)" : e.count.toLocaleString()}</div>)}
          </div>
        )}
      </>}
    </Panel>
  );
}

// ⭐ HB-FEED (owner 11-10) · FEED-5: the daily fresh feed — plan, today's paced budget and what is left, the month's pace,
// the split by role family as a table (share · today's slice · pulled · new · merged · held · visa-flagged), the shares
// editable (must total 100 %), the feed switch (OFF until FEED-0's report is clean) and Pause; FEED-0's sample report.
export function HirebaseFeedSection() {
  const [s, setS] = useState(null);
  const [edit, setEdit] = useState({});
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api("/api/admin/hirebase/feed").then(r => { setS(r); setEdit(Object.fromEntries(r.families.map(f => [f.key, String(f.share)]))); setErr(""); })
    .catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const put = async (body) => { try { setS(await api("/api/admin/hirebase/feed", { method: "PUT", body: JSON.stringify(body) })); setErr(""); } catch (e) { setErr(e.message); } };
  const total = Object.values(edit).reduce((a, v) => a + (Number(v) || 0), 0);
  const saveShares = () => put({ shares: Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, Number(v) || 0])) });
  const report = async () => { try { setRep(await api("/api/admin/hirebase/sample-report")); } catch (e) { setErr(e.message); } };
  const b = s?.budget;
  return (
    <Panel title="Hirebase daily feed" data-admin-hirebase-feed=""
      purpose="Fresh jobs only (posted in the past 24 h), pulled once an hour over a window that ends 2 hours back, so no job is paid for twice. Today's budget is the month's allowance less a 5 % reserve, spread over the days left; each family gets its share, visa-sponsored jobs first.">
      {err && <div style={quiet} role="alert">{err}</div>}
      {s && <>
        <div style={row} data-hirebase-feed={s.switches.on ? (s.switches.paused ? "paused" : "on") : "off"}>
          <b>{!s.switches.on ? "Off" : s.switches.paused ? "Paused" : "On"}</b>
          <DepthButton primary={!s.switches.on} onClick={() => put({ on: !s.switches.on })}>{s.switches.on ? "Turn feed off" : "Turn feed on"}</DepthButton>
          {s.switches.on && <DepthButton onClick={() => put({ paused: !s.switches.paused })}>{s.switches.paused ? "Resume" : "Pause feed"}</DepthButton>}
          <span style={quiet}>Plan {s.plan.name} {s.plan.monthJobs.toLocaleString()} · the month cap above must match</span>
        </div>
        <div style={{ ...sub, marginTop: 8 }}>
          <b>Today</b> <span style={quiet}>budget {b.today} · used {b.usedToday} · left {b.leftToday} · this hour {b.hour} · next window {s.window.after.slice(11, 16)}–{s.window.before.slice(11, 16)} UTC</span>
          <div style={quiet}>Month: used {b.usedMonth.toLocaleString()} of {b.usable.toLocaleString()} usable (reserve {b.reserve.toLocaleString()}) · on track would be {b.onTrackBy.toLocaleString()} · {b.daysLeft} days left</div>
        </div>
        <table style={{ width: "100%", fontSize: 12, marginTop: 8 }}>
          <thead><tr><th align="left">Family</th><th>Share %</th><th>Today's slice</th><th>Pulled</th><th>New</th><th>Merged</th><th>Held</th><th>Visa</th></tr></thead>
          <tbody>{s.families.map(f => <tr key={f.key} data-feed-family={f.key}><td>{f.label}</td>
            <td align="center"><input aria-label={`${f.label} share`} style={{ width: 44 }} value={edit[f.key] ?? ""} onChange={e => setEdit({ ...edit, [f.key]: e.target.value })}/></td>
            <td align="center">{f.todaySlice}</td><td align="center">{f.pulled}</td><td align="center">{f.new}</td><td align="center">{f.merged}</td><td align="center">{f.held}</td><td align="center">{f.visa}</td></tr>)}</tbody>
        </table>
        <div style={{ ...row, marginTop: 8 }}>
          <DepthButton disabled={total !== 100} onClick={saveShares}>Save shares</DepthButton>
          <span style={quiet}>{total === 100 ? "Totals 100 %" : `Totals ${total} % — must be 100 %`}</span>
          <DepthButton onClick={load}>Refresh</DepthButton>
          <DepthButton onClick={report}>Sample report</DepthButton>
        </div>
        {rep && <div style={{ ...sub, marginTop: 8 }} data-hirebase-sample-report="">
          {!rep.run ? <div style={quiet}>{rep.note}</div> : <>
            <b>Sample run {rep.run.id}</b> <span style={quiet}>{rep.summary.landed} landed · {rep.summary.new} new · {rep.summary.merged} merged · {rep.summary.notFound} not found · {rep.summary.onBoard} on the board · {rep.summary.unclassified} without a subcategory</span>
            <div style={quiet}>ATS: {Object.entries(rep.summary.ats).map(([k, v]) => `${k} ${v}`).join(" · ")} ({rep.summary.atsWeCrawl} on boards we crawl)</div>
            <div style={quiet}>Levels: {Object.entries(rep.summary.levels).map(([k, v]) => `${k} ${v}`).join(" · ")} · ghost levels: {Object.entries(rep.summary.ghostLevels).map(([k, v]) => `${k} ${v}`).join(" · ")}</div>
            <div style={quiet}>Companies with a record {rep.summary.companyRecords} · technologies {rep.summary.withTechnologies} · team {rep.summary.withTeam} · company data {rep.summary.withCompanyData} · visa-flagged {rep.summary.visaFlagged}</div>
            {rep.summary.ingestLagHours && <div style={quiet}>Hirebase saw them {rep.summary.ingestLagHours.min}–{rep.summary.ingestLagHours.max} h after the posting date (median {rep.summary.ingestLagHours.median} h)</div>}
            <div style={quiet}>{rep.summary.mergedGainNote}</div>
          </>}
        </div>}
      </>}
    </Panel>
  );
}

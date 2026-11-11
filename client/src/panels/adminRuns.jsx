// ⭐ FIRST PRIORITY (A)-2 (45o, owner 11-08) · Admin → System → Runs — the run trace, "FA1 without database access": pick a
// run → one table per pick: the résumé (model, cost, attached when, or why there is none), every field's answer and its
// source (profile / saved answer / routine / held for you), what stopped and why, what was sent, the scheduler's picks and
// summary email, and the request id to search both services' logs by. Read-only.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, row, quiet, sub } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const when = (s) => (s ? new Date(s * 1000).toLocaleString() : "—");
const money = (n) => (n ? `$${Number(n).toFixed(4)}` : "$0");

function JobTrace({ j }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...sub, marginBottom: 10 }} data-run-trace-job={j.runJobId}>
      <div style={{ fontWeight: 600 }}>#{j.runJobId} · {j.title || j.jobId}{j.company ? ` · ${j.company}` : ""}</div>
      <div style={quiet}>Status <b>{j.status}</b>{j.reasonCode ? ` · stopped: ${j.reasonCode}` : ""}{j.reasonDetail ? ` — ${j.reasonDetail}` : ""}</div>
      <div style={{ fontSize: ts(13), margin: "4px 0" }} data-run-trace-resume="">
        Résumé: {j.resume.artifactId != null
          ? <>#{j.resume.artifactId} · {j.resume.model || "model unknown"} · {money(j.resume.costUsd)} over {j.resume.calls} call{j.resume.calls === 1 ? "" : "s"}{j.resume.failedCalls ? ` (${j.resume.failedCalls} failed)` : ""} · attached {when(j.resume.attachedAt)}{j.resume.atsScore != null ? ` · ATS ${j.resume.atsScore}` : ""}</>
          : <b>none{j.resume.missingReason ? ` — ${j.resume.missingReason}` : ""}</b>}
      </div>
      <div style={{ fontSize: ts(13) }} data-run-trace-sent="">Sent: {j.sent.submittedBy ? `${j.sent.submittedBy}${j.sent.verified === true ? " · verified" : j.sent.verified === false ? " · not verified" : ""}` : "nothing"}</div>
      <div style={quiet}>Request id: <code>{j.requestId}</code></div>
      <DepthButton onClick={() => setOpen(o => !o)}>{open ? "Hide" : `Answers (${j.answers.length}) and events (${j.events.length})`}</DepthButton>
      {open && (
        <>
          <table style={{ width: "100%", fontSize: ts(12.5), borderCollapse: "collapse", margin: "8px 0" }} data-run-trace-answers="">
            <thead><tr><th align="left">Field</th><th align="left">Answer</th><th align="left">Source</th></tr></thead>
            <tbody>{j.answers.map((a, i) => (
              <tr key={i}><td>{a.field}</td><td>{a.value == null ? "—" : String(a.value).slice(0, 120)}</td><td>{a.source}{a.confidence != null ? ` · ${a.confidence}` : ""}</td></tr>
            ))}</tbody>
          </table>
          <ol style={{ fontSize: ts(12), margin: 0, paddingLeft: 18 }} data-run-trace-events="">
            {j.events.map((e, i) => <li key={i}>{when(e.at)} · {e.event}{e.message ? ` — ${e.message}` : ""}</li>)}
          </ol>
        </>
      )}
    </div>
  );
}

export function RunsTab() {
  const [runs, setRuns] = useState(null);
  const [trace, setTrace] = useState(null);
  const [said, setSaid] = useState("");
  const load = useCallback(() => api("/api/admin/runs").then(d => setRuns(d.runs)).catch(e => setSaid(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const pick = (id) => api(`/api/admin/runs/${id}`).then(setTrace).catch(e => setSaid(e.message));
  return (
    <Panel title="Runs" data-admin-runs=""
      purpose="Every application run, traced from what the run itself recorded: the picks, each résumé, every answer and where it came from, what stopped and why, what was sent, and the summary email.">
      {said && <div style={quiet} role="status">{said}</div>}
      {!trace && (
        <table style={{ width: "100%", fontSize: ts(13), borderCollapse: "collapse" }} data-admin-runs-list="">
          <thead><tr><th align="left">Run</th><th align="left">Who</th><th align="left">Mode</th><th align="left">Status</th><th align="left">Jobs</th><th align="left">When</th><th /></tr></thead>
          <tbody>{(runs || []).map(r => (
            <tr key={r.id}>
              <td>#{r.id}</td><td>{r.user.username}{r.testAccount ? " (canary)" : ""}</td><td>{r.mode}</td><td>{r.status}</td>
              <td>{r.total} · {r.submitted} sent · {r.held} held · {r.failed} failed</td><td>{when(r.createdAt)}</td>
              <td><DepthButton onClick={() => pick(r.id)}>Trace</DepthButton></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {trace && (
        <div data-admin-run-trace={trace.run.id}>
          <div style={{ ...row, margin: "6px 0 10px" }}>
            <DepthButton onClick={() => setTrace(null)}>‹ All runs</DepthButton>
            <b>Run #{trace.run.id}</b><span style={quiet}>{trace.run.user.username} · {trace.run.mode} · {trace.run.status} · {when(trace.run.createdAt)}</span>
          </div>
          <div style={{ fontSize: ts(13), marginBottom: 8 }}>
            {trace.totals.withResume} of {trace.jobs.length} with a résumé · {trace.totals.sent} sent · model cost {money(trace.totals.costUsd)}
          </div>
          {trace.scheduler ? (
            <div style={{ ...sub, marginBottom: 10 }} data-run-trace-scheduler="">
              The scheduler: run time {when(trace.scheduler.slotAt)} · {trace.scheduler.seen} seen · {trace.scheduler.picked} picked
              {Object.keys(trace.scheduler.leftOut || {}).length ? ` · left out: ${Object.entries(trace.scheduler.leftOut).map(([k, v]) => `${k} ${Array.isArray(v) ? v.length : v}`).join(", ")}` : ""}
              {" · "}message {trace.scheduler.messageAt ? `sent ${when(trace.scheduler.messageAt)}` : "not sent"}
              {" · "}summary email {trace.scheduler.summarySentAt ? `sent ${when(trace.scheduler.summarySentAt)}` : "not sent"}
            </div>
          ) : <div style={quiet}>Not a scheduled run (started by hand) — no picks message or summary email.</div>}
          {trace.jobs.map(j => <JobTrace key={j.runJobId} j={j} />)}
          <div style={quiet}>{trace.logHint}</div>
        </div>
      )}
    </Panel>
  );
}

// ⭐ D150 T16 · Admin → Today → Phase 1 — the milestones measured (services/admin/phase1Measures.js), D131's small-number
// rule: "k of n" until 20, then a %. Each figure beside its target, so the owner can decide to continue or change.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Panel, row, quiet, sub } from "./adminKit.jsx";

const Line = ({ label, value, note }) => (
  <div style={{ ...row, justifyContent: "space-between", padding: "4px 0" }}>
    <span>{label}</span><span><b>{value}</b>{note ? <span style={quiet}> · {note}</span> : null}</span>
  </div>
);

export function Phase1Tab() {
  const [m, setM] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/admin/phase1").then(setM).catch(e => setErr(e.message)); }, []);
  return (
    <Panel title="Phase 1 measures" data-admin-phase1=""
      purpose={`Each milestone against its target. Shares read "k of n" until there are ${m?.smallN ?? 20}, then a percentage.`}>
      {err && <div style={quiet} role="alert">{err}</div>}
      {!m && !err && <div style={quiet} role="status">Reading…</div>}
      {m && <>
        <div style={sub}>
          <b>The audit</b>
          <Line label="Started" value={m.audit.started} />
          <Line label="Finished" value={m.audit.finishShare} note={`${m.audit.finishVerdict} (target ${m.targets.auditFinish})`} />
          <Line label="Kept after finishing" value={m.audit.claimShare} note={`${m.audit.claimVerdict} (target ${m.targets.claimAfterFinish})`} />
          {m.audit.byRole.length > 0 && <div style={{ marginTop: 6 }}>{m.audit.byRole.map(r => (
            <Line key={r.role} label={r.role} value={`${r.started} started · ${r.finishShare} finished`} note={`${r.claimed} kept`} />))}</div>}
          {m.audit.dropOff.length > 0 && <div style={quiet}>Stopped at question: {m.audit.dropOff.map(d => `${d.question} (${d.stopped})`).join(" · ")}</div>}
        </div>
        <div style={{ ...sub, marginTop: 8 }}>
          <b>The question bank, by where it was answered</b>
          {m.bank.surfaces.length === 0 ? <div style={quiet}>No answers yet.</div>
            : m.bank.surfaces.map(s => <Line key={s.surface} label={s.surface} value={`${s.answers} answers`} note={`${s.rightShare} right`} />)}
        </div>
        <div style={{ ...sub, marginTop: 8 }}>
          <b>Debriefs</b>
          <Line label="Debriefs per interview" value={m.debriefs.perInterview} note={`${m.debriefs.verdict} (target ${m.targets.debriefs})`} />
        </div>
        {m.applyChain && <div style={{ ...sub, marginTop: 8 }} data-apply-chain="">
          <b>The apply funnel, last {m.applyChain.days} days</b> <span style={quiet}>(the {m.applyChain.days} before in brackets; each step from the stage above)</span>
          {m.applyChain.stages.map(s => <Line key={s.id} label={s.label} value={`${s.n ?? "—"} (${s.before ?? "—"})`} note={s.fromPrevious !== "—" ? `${s.fromPrevious} of the stage above` : null} />)}
          {m.applyChain.warning && <div role="alert">⚠ {m.applyChain.warning}</div>}
        </div>}
        <div style={{ ...quiet, marginTop: 8 }}>Not built yet, so not measured: {m.notBuilt.join(" · ")}.</div>
      </>}
    </Panel>
  );
}

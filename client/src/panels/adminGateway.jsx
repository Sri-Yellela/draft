// ⭐ D162 G4 (46f) · ADMIN → SYSTEM → USAGE → THE MODEL GATEWAY — every task, where it runs and what serves it now, its
// last 7 days (calls, p50 / p95, errors, fallbacks, cost per call, over budget), and the two moves the gateway exists for:
// a SWITCH applied now, no deploy (shadow a candidate → a cohort % → everyone → promote; drop; clear) and a ROLL BACK of the
// newest change still in force. Every change needs a reason (the server refuses one without); the history says who / when
// / why. routes/modelGateway.js holds the rules — this card only asks. Tasks run in the tools service are listed, not routed.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, Mark, row, quiet, sub, callout, field } from "./adminKit.jsx";

const usd = (n) => `$${(Number(n) || 0).toFixed(4)}`;
const ms = (n) => (n == null ? "—" : `${Math.round(n).toLocaleString()} ms`);
const routeWords = (r) => (r ? `${r.provider || "?"} · ${r.model || "?"}` : "—");
const SWITCHES = [
  ["shadow", "Shadow a candidate (answers are compared, never served)"],
  ["cohort", "Serve the candidate to a %"],
  ["default", "Serve the candidate to everyone"],
  ["promote", "Make the candidate the route"],
  ["drop_candidate", "Drop the candidate"],
  ["clear", "Clear every override (back to the default route)"],
];

function TaskCard({ task, telemetry, providers, onChanged }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [op, setOp] = useState("shadow");
  const [form, setForm] = useState({ provider: providers?.[0] || "", model: "", percent: "10", reason: "" });
  const [said, setSaid] = useState(null);
  const [busy, setBusy] = useState(false);
  const routed = task.runsIn === "draft";
  const load = useCallback(() => api(`/api/admin/model-gateway/tasks/${encodeURIComponent(task.id)}`).then(setDetail).catch((e) => setSaid({ ok: false, text: e.message })), [task.id]);
  useEffect(() => { if (open) load(); }, [open, load]);
  const c = task.route?.candidate || null;

  const change = async () => {
    setBusy(true); setSaid(null);
    const body = { op, reason: form.reason };
    if (op === "shadow") Object.assign(body, { provider: form.provider, model: form.model.trim() });
    if (op === "cohort") body.percent = Number(form.percent);
    try {
      await api(`/api/admin/model-gateway/tasks/${encodeURIComponent(task.id)}/change`, { method: "POST", body: JSON.stringify(body) });
      setSaid({ ok: true, text: "Applied now — the next call uses it." }); setForm(f => ({ ...f, reason: "" })); load(); onChanged();
    } catch (e) { setSaid({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const rollback = async () => {
    const reason = window.prompt(`Roll back the newest change to ${task.id}? Say why (it is kept in the history).`);
    if (!reason || !reason.trim()) return;
    setBusy(true); setSaid(null);
    try {
      await api(`/api/admin/model-gateway/tasks/${encodeURIComponent(task.id)}/rollback`, { method: "POST", body: JSON.stringify({ reason }) });
      setSaid({ ok: true, text: "Rolled back — the next call uses the route before it." }); load(); onChanged();
    } catch (e) { setSaid({ ok: false, text: e.message }); }
    setBusy(false);
  };

  return (
    <div style={{ ...sub, marginBottom: 8 }} data-gateway-task={task.id}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <b>{task.id}</b>{" "}
          {!routed ? <Mark tone={C.INK_MUTED}>runs in the {task.runsIn}</Mark>
            : task.valid === false ? <Mark tone={C.DANGER}>not servable</Mark> : <Mark tone={C.SUCCESS}>{task.route?.layer || "default"}</Mark>}
          <div style={quiet}>{task.what}</div>
          {routed && <div style={{ fontSize: 13 }}>Now: {routeWords(task.route)}{c ? ` · candidate ${routeWords(c)} at ${c.stage}${c.stage === "cohort" ? ` ${c.percent}%` : ""}` : ""}</div>}
          {task.valid === false && task.invalid && <div style={{ ...callout(C.DANGER), marginTop: 6 }}>{task.invalid}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 13 }}>
          {(telemetry || []).length === 0 ? <span style={quiet}>no calls in 7 days</span> : telemetry.map(t => (
            <div key={`${t.provider}|${t.model}`} data-gateway-telemetry="">
              {t.model || "?"}: {t.calls.toLocaleString()} calls · p50 {ms(t.latencyP50Ms)} · p95 {ms(t.latencyP95Ms)} · {usd(t.costPerCallUsd)} a call
              {t.errors ? ` · ${t.errors} errors` : ""}{t.fallbacks ? ` · ${t.fallbacks} fallbacks` : ""}
              {t.overBudget && (t.overBudget.cost || t.overBudget.p50 || t.overBudget.p95) ? <> · <Mark tone={C.WARNING}>over budget</Mark></> : null}
            </div>
          ))}
          {routed && <DepthButton onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? "Close" : "Switch or roll back"}</DepthButton>}
        </div>
      </div>
      {open && routed && (
        <div style={{ marginTop: 10 }} data-gateway-controls="">
          <div style={row}>
            <select aria-label="The change" style={field} value={op} onChange={e => setOp(e.target.value)}>
              {SWITCHES.map(([k, w]) => <option key={k} value={k}>{w}</option>)}
            </select>
            {op === "shadow" && <>
              <select aria-label="Provider" style={field} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
                {(providers || []).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input aria-label="Model" style={field} placeholder="model id" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            </>}
            {op === "cohort" && <input aria-label="Percent" style={{ ...field, width: 80 }} type="number" min="1" max="99" value={form.percent} onChange={e => setForm(f => ({ ...f, percent: e.target.value }))} />}
            <input aria-label="Why" style={{ ...field, flex: "1 1 220px" }} placeholder="Why (kept in the history)" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            <DepthButton primary onClick={change} disabled={busy || !form.reason.trim() || (op === "shadow" && !form.model.trim())}>Apply now</DepthButton>
            <DepthButton onClick={rollback} disabled={busy}>Roll back the newest change</DepthButton>
          </div>
          {said && <div role="status" style={{ ...callout(said.ok ? C.SUCCESS : C.DANGER), marginTop: 8 }}>{said.text}</div>}
          <div style={{ marginTop: 10 }}>
            <div style={quiet}>History (newest first)</div>
            {!detail ? <div style={quiet}>Loading…</div> : (detail.history || []).length === 0 ? <div style={quiet}>No changes — the default route.</div> : (
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }} data-gateway-history="">
                {detail.history.map(h => (
                  <li key={h.id}>{new Date(h.at * 1000).toLocaleString()} · {h.op} · {h.actor || "?"} — {h.reason || "no reason"}{h.undoneAt ? " (rolled back)" : ""}</li>
                ))}
              </ul>
            )}
            {(detail?.evals || []).length > 0 && (
              <>
                <div style={{ ...quiet, marginTop: 8 }}>Evaluations</div>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }} data-gateway-evals="">
                  {detail.evals.map((e, i) => <li key={e.id ?? i}>{e.provider} · {e.model} — {e.passed ? "passed" : "did not pass"}{e.reason ? ` · ${e.reason}` : ""}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ModelGatewaySection() {
  const [g, setG] = useState(null);
  const [tel, setTel] = useState([]);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    api("/api/admin/model-gateway").then((r) => { setG(r); setErr(null); }).catch((e) => setErr(e.message));
    api("/api/admin/model-gateway/telemetry?days=7").then((r) => setTel(r.rows || [])).catch(() => setTel([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!g) return <Panel title="The model gateway" purpose="Loading…" data-model-gateway="">{err && <div style={callout(C.DANGER)}>{err}</div>}</Panel>;
  return (
    <Panel title="The model gateway" data-model-gateway=""
      purpose="Every feature asks for a task, never a model. What serves each task now, its last 7 days, and a switch or roll back applied at once — no deploy. Every change says why.">
      {g.tasks.map(t => <TaskCard key={t.id} task={t} providers={g.providers} telemetry={tel.filter(r => r.task === t.id)} onChanged={load} />)}
    </Panel>
  );
}

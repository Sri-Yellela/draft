// ⭐ A187 Stage 0 (46i) · ADMIN → SYSTEM → USAGE → RUNTIME FLAGS — every flag, what it does, its state now and which layer
// set it (the code's default, the deploy's variable, or this switch), and the two moves: a SWITCH applied now with no deploy
// (a deploy is a ~30 s outage) and a ROLL BACK of the newest change still in force. Every change needs a reason (the server
// refuses one without); the history says who / when / why. routes/flags.js holds the rules — this card only asks.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { Btn, Panel, Mark, row, quiet, sub, callout, field } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";

const LAYER = { default: "the code's default", env: "the deploy's variable", override: "this switch" };

function FlagCard({ flag, onChanged }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [state, setState] = useState(flag.state === "on" ? "off" : "on");
  const [percent, setPercent] = useState("10");
  const [reason, setReason] = useState("");
  const [said, setSaid] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api(`/api/admin/flags/${encodeURIComponent(flag.key)}`).then(setDetail).catch((e) => setSaid({ ok: false, text: e.message })), [flag.key]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const apply = async () => {
    setBusy(true); setSaid(null);
    try {
      await api(`/api/admin/flags/${encodeURIComponent(flag.key)}`, { method: "POST", body: JSON.stringify({ state, reason, ...(state === "cohort" ? { percent: Number(percent) } : {}) }) });
      setSaid({ ok: true, text: "Applied now — no deploy." }); setReason(""); load(); onChanged();
    } catch (e) { setSaid({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const rollback = async () => {
    const why = window.prompt(`Roll back the newest change to ${flag.key}? Say why (it is kept in the history).`);
    if (!why || !why.trim()) return;
    setBusy(true); setSaid(null);
    try {
      await api(`/api/admin/flags/${encodeURIComponent(flag.key)}/rollback`, { method: "POST", body: JSON.stringify({ reason: why }) });
      setSaid({ ok: true, text: "Rolled back." }); load(); onChanged();
    } catch (e) { setSaid({ ok: false, text: e.message }); }
    setBusy(false);
  };

  return (
    <div style={{ ...sub, marginBottom: 8 }} data-flag={flag.key}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <b>{flag.key}</b>{" "}
          <Mark tone={flag.state === "off" ? C.INK_MUTED : C.SUCCESS}>{flag.state}{flag.state === "cohort" ? ` ${flag.percent}%` : ""}</Mark>
          <div style={quiet}>{flag.what}</div>
          <div style={{ fontSize: ts(13) }}>Set by {LAYER[flag.layer] || flag.layer}{flag.env ? ` · the deploy says ${flag.env}${flag.envVar ? ` (${flag.envVar})` : ""}` : ""}</div>
        </div>
        <Btn onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? "Close" : "Switch or roll back"}</Btn>
      </div>
      {open && (
        <div style={{ marginTop: 10 }} data-flag-controls="">
          <div style={row}>
            <select aria-label="New state" style={field} value={state} onChange={e => setState(e.target.value)}>
              <option value="on">On</option>
              <option value="off">Off</option>
              {flag.cohort && <option value="cohort">A % of people</option>}
              <option value="inherit">Back to the deploy's setting</option>
            </select>
            {state === "cohort" && <input aria-label="Percent" style={{ ...field, width: 80 }} type="number" min="1" max="99" value={percent} onChange={e => setPercent(e.target.value)} />}
            <input aria-label="Why" style={{ ...field, flex: "1 1 220px" }} placeholder="Why (kept in the history)" value={reason} onChange={e => setReason(e.target.value)} />
            <Btn primary onClick={apply} disabled={busy || !reason.trim()}>Apply now</Btn>
            <Btn onClick={rollback} disabled={busy}>Roll back the newest change</Btn>
          </div>
          {said && <div role="status" style={{ ...callout(said.ok ? C.SUCCESS : C.DANGER), marginTop: 8 }}>{said.text}</div>}
          <div style={{ marginTop: 10 }}>
            <div style={quiet}>History (newest first)</div>
            {!detail ? <div style={quiet}>Loading…</div> : (detail.history || []).length === 0 ? <div style={quiet}>No changes.</div> : (
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: ts(13) }} data-flag-history="">
                {detail.history.map(h => (
                  <li key={h.id}>{new Date(h.at * 1000).toLocaleString()} · {h.action === "flag_rollback" ? "rolled back" : (h.after ? h.after.state : "inherit")} · {h.actor || "?"} — {h.reason || "no reason"}{h.undone_at ? " (rolled back)" : ""}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FlagsSection() {
  const [flags, setFlags] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => { api("/api/admin/flags").then((r) => { setFlags(r.flags || []); setErr(null); }).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <Panel title="Runtime flags" data-flags=""
      purpose="Switches that take effect at once — no deploy (a deploy is a short outage). Each says which layer set it now: the code's default, the deploy's variable, or this switch. Every change says why.">
      {err && <div style={callout(C.DANGER)}>{err}</div>}
      {!flags ? <div style={quiet}>Loading…</div> : flags.map(f => <FlagCard key={f.key} flag={f} onChanged={load} />)}
    </Panel>
  );
}

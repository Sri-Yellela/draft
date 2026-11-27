// ⛔ D171 FIX 2 · ADMIN → SYSTEM → MODEL USAGE — where the tokens went (owner 11-06: "look at the token and cost today,
// theres also an unknown run at 6am utc … 146,348, costing 0.56$").
//
// One table: per UTC hour × event × model × service × the key that paid × who started it (routes/modelGateway.js
// GET /usage, services/modelUsage.js usageTable). Both services as draft recorded them: draft's own calls and the
// résumé generations the tools service made for draft. A row from before migration 224 says "(not recorded)" — never
// a guess. ONE action: the daily cost alarm (a typed reason, an audit row); over it, Admin → Today raises it too.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { Btn, Panel, Mark, row, quiet, sub, callout, field } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const usd = (n) => `$${(Number(n) || 0).toFixed(n >= 1 ? 2 : 4)}`;
const num = (n) => (Number(n) || 0).toLocaleString();
const RANGES = [[24, "24 h"], [48, "48 h"], [24 * 7, "7 days"]];

export function ModelUsageTab() {
  const [hours, setHours] = useState(48);
  const [u, setU] = useState(null);
  const [err, setErr] = useState(null);
  const [alarm, setAlarm] = useState({ usd: "", reason: "" });
  const [said, setSaid] = useState(null);

  const load = useCallback(() => {
    api(`/api/admin/model-gateway/usage?hours=${hours}`).then((r) => { setU(r); setErr(null); }).catch((e) => setErr(e.message));
  }, [hours]);
  useEffect(() => { load(); }, [load]);

  const saveAlarm = async () => {
    setSaid(null);
    try {
      const r = await api("/api/admin/model-gateway/cost-alarm", { method: "POST",
        body: JSON.stringify({ usd: alarm.usd.trim() === "" ? null : Number(alarm.usd), reason: alarm.reason }) });
      setSaid({ ok: true, text: r.thresholdUsd != null ? `The alarm is ${usd(r.thresholdUsd)} a day.` : "The alarm is off." });
      setAlarm({ usd: "", reason: "" }); load();
    } catch (e) { setSaid({ ok: false, text: e.message }); }
  };

  if (!u) return <Panel title="Model usage" purpose="Loading…" data-model-usage="">{err && <div style={callout(C.DANGER)}>{err}</div>}</Panel>;
  const a = u.alarm;
  const numbers = [
    [usd(a.spentUsd), `spent today (UTC, ${a.day})`, !a.over],
    [a.thresholdUsd != null ? usd(a.thresholdUsd) : "Off", a.source === "env" ? "daily alarm (env)" : "daily alarm", a.thresholdUsd != null],
    [num(u.totals.calls), `model calls, ${hours} h`, true],
    [usd(u.totals.costUsd), `cost, ${hours} h`, true],
  ];
  return (
    <Panel data-model-usage="" title="Model usage"
      purpose="Every model call draft recorded — by hour, model, the key that paid and who started it — so a spend nobody expected is seen here, with its cause."
      code={`D171 FIX 2 · usage_events (started_by, key_label: migration 224) · this process's key: ${u.draftKeyLabel} · the tools service's calls for other clients are in its own ledger, not here`}
      numbers={numbers}>
      {a.over && (
        <div data-cost-alarm="over" style={{ ...callout(C.WARNING), marginBottom: 10 }}>
          <Mark tone={C.WARNING}>Over the alarm</Mark> {usd(a.spentUsd)} today, over {usd(a.thresholdUsd)} — {a.byKey.map((k) => `${k.keyLabel} ${usd(k.costUsd)}`).join(" · ")}
        </div>
      )}
      <div style={{ ...row, marginBottom: 12 }}>
        {RANGES.map(([h, label]) => (
          <Btn key={h} size="compact" primary={h === hours} onClick={() => setHours(h)} data-usage-range={h}>{label}</Btn>
        ))}
      </div>
      {err && <div style={{ ...callout(C.DANGER), marginBottom: 10 }}>{err}</div>}
      {u.rows.length === 0 ? <p style={quiet}>No model call recorded in the last {hours} hours.</p> : (
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <div className="pl-gazetteer pl-gazetteer--dense"><table data-usage-table="" style={{ borderCollapse: "collapse", fontSize: ts(12), minWidth: 720, width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Hour (UTC)", "Event", "Model", "Service", "Key", "Started by", "Calls", "Tokens", "Cost"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {u.rows.map((r) => (
                <tr key={[r.hour, r.eventType, r.model, r.service, r.keyLabel, r.startedBy].join("|")} data-usage-row="">
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{r.hour.slice(5, 16).replace("T", " ")}</td>
                  <td style={{ padding: "5px 8px" }}>{r.eventType}</td>
                  <td style={{ padding: "5px 8px" }}>{r.model}</td>
                  <td style={{ padding: "5px 8px" }}>{r.service === "tools" ? "tools service" : "draft"}</td>
                  <td style={{ padding: "5px 8px" }}>{r.keyLabel}</td>
                  <td style={{ padding: "5px 8px" }}>{r.startedBy}</td>
                  <td style={{ padding: "5px 8px" }}>{num(r.calls)}{r.failed ? <span style={quiet}> ({r.failed} failed)</span> : null}</td>
                  <td style={{ padding: "5px 8px" }}>{num(r.tokens)}</td>
                  <td style={{ padding: "5px 8px" }}>{usd(r.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
      <div style={sub}>
        <h3 style={{ fontSize: ts(14), color: C.INK, margin: "0 0 8px" }}>Daily cost alarm <span style={quiet}>— over it, Admin → Today raises it and the log says so once a day</span></h3>
        <div style={row}>
          <input aria-label="Daily alarm in dollars (empty turns it off)" placeholder="Dollars a day (empty = off)" inputMode="decimal"
            value={alarm.usd} onChange={(e) => setAlarm({ ...alarm, usd: e.target.value })} style={{ ...field, width: 200 }} />
          <input aria-label="Why" placeholder="Why (kept in the audit log)" value={alarm.reason}
            onChange={(e) => setAlarm({ ...alarm, reason: e.target.value })} style={{ ...field, flex: "1 1 220px" }} />
          <Btn primary disabled={alarm.reason.trim().length < 3} onClick={saveAlarm} data-cost-alarm-save="">Set the alarm</Btn>
        </div>
        {said && <div role="status" style={{ ...callout(said.ok ? C.SUCCESS : C.DANGER), marginTop: 8 }}>{said.text}</div>}
      </div>
    </Panel>
  );
}

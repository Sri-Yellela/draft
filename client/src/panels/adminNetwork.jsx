// ⭐ D180 P1 (45o) · Admin → People → Network — the network switch (OFF by default) and its counts. The owner turns it on
// only after counsel has answered the user-content questions (the owner's list D (19)); the switch is audited.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, row, quiet } from "./adminKit.jsx";

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
        {d && <DepthButton primary={!d.enabled} onClick={() => flip(!d.enabled)}>{d.enabled ? "Turn off" : "Turn on"}</DepthButton>}
        {said && <span style={quiet} role="status">{said}</span>}
      </div>
      {d?.counts && <div style={quiet}>{d.counts.connections ?? "—"} connections · {d.counts.pending ?? "—"} requests waiting · {d.counts.blocks ?? "—"} blocks</div>}
    </Panel>
  );
}

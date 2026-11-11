import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { C } from "../styles/colorTokens.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const PLAN_LABELS = {
  BASIC: "Basic",
  PLUS: "Plus",
  PRO: "Pro",
};

const PLAN_COPY = {
  BASIC: "Shared jobs console with baseline Simple Apply, ATS Search, and ATS Sort.",
  PLUS: "Unlock Generate on expanded job cards.",
  PRO: "Unlock Generate and A+ Resume on expanded job cards.",
};

export function PlansPanel({ user, onUserChange }) {
  const { theme } = useTheme();
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState("");

  const load = () => api("/api/plans").then(d => {
    setPlan(d);
    if (d?.planTier && d?.applyMode && onUserChange) {
      onUserChange(u => u ? ({ ...u, planTier:d.planTier, applyMode:d.applyMode, allowedModes:d.allowedModes || [d.applyMode] }) : u);
    }
  }).catch(e => setStatus(e.message));
  useEffect(() => { load(); }, []);

  const requestPlanChange = async (tier) => {
    if (!tier) return;
    setStatus("");
    try {
      await api("/api/plans/request-upgrade", {
        method:"POST",
        body:JSON.stringify({ requestedTier: tier }),
      });
      setStatus("Plan change request sent.");
      load();
    } catch(e) { setStatus(e.message); }
  };

  const current = plan?.planTier || user?.planTier || "BASIC";
  const changeOptions = plan?.changeOptions || (plan?.nextPlan ? [plan.nextPlan] : []);

  return (
    <div style={{ flex:1, overflowY:"auto", padding:24, background:"var(--color-bg)" }}>
      <div style={{ maxWidth:760 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 400,
                      fontSize:ts(24),
                      marginBottom:8 }}>
          Plans
        </div>
        <div style={{ color:"var(--color-text-muted)", marginBottom:20 }}>
          Current plan: <strong style={{ color:"var(--color-text)" }}>{PLAN_LABELS[current]}</strong>. Plans control tool access in the shared jobs console.
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:12 }}>
          {[current, ...changeOptions].filter(Boolean).map(tier => (
            <div key={tier} style={{
              border:`1px solid ${tier === current ? "var(--color-primary)" : "var(--color-border)"}`,
              background:"var(--color-surface)",
              borderRadius:8,
              padding:16,
            }}>
              <div style={{ fontWeight:800, fontSize:ts(16) }}>{PLAN_LABELS[tier]}</div>
              <div style={{ color:"var(--color-text-muted)", fontSize:ts(12), lineHeight:1.5, marginTop:6 }}>
                {PLAN_COPY[tier]}
              </div>
              {tier === current && (
                <div style={{ marginTop:12, fontSize:ts(11), color:"var(--color-primary-text)", fontWeight:700 }}>
                  Active
                </div>
              )}
              {tier !== current && !plan?.pendingRequest && (
                <button onClick={() => requestPlanChange(tier)}
                  style={{ marginTop:14, border:"none", borderRadius:6, padding:"9px 14px",
                           background:"var(--color-primary)", color:C.ON_ACCENT, cursor:"pointer",
                           fontWeight:800 }}>
                  Request {tier === "BASIC" ? "downgrade" : "upgrade"}
                </button>
              )}
              {tier !== current && plan?.pendingRequest?.requested_tier === tier && (
                <div style={{ marginTop:12, fontSize:ts(11), color:"var(--color-warning)", fontWeight:700 }}>
                  Request pending
                </div>
              )}
            </div>
          ))}
        </div>

        {status && <div style={{ marginTop:16, color:"var(--color-text-muted)" }}>{status}</div>}
      </div>
    </div>
  );
}

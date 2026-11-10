// ⭐ A167 (d) · THE ONE-TIME CODE, built once — sign-up's email and phone (AuthScreen) and Settings' phone (PlanSettings).
// Send code → the code box → Confirm → onProof(proof). The proof is what the server accepts (POST /api/auth/register's
// emailProof / phoneProof, POST /api/account/phone); the code itself never leaves this control.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function OtpVerify({ channel, target, proven = false, onProof, onError, disabled = false, style = {} }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // A changed address / number needs its own code.
  useEffect(() => { setSent(false); setCode(""); setMsg(""); }, [target]);
  const word = channel === "sms" ? "Text me a code" : "Email me a code";
  if (proven) return <span data-otp-proven={channel} style={{ fontSize: 12, ...style }}>✓ Confirmed</span>;
  const send = async () => {
    setBusy(true); setMsg("");
    try { await api("/api/verify/start", { method: "POST", body: JSON.stringify({ channel, target }) }); setSent(true); setMsg("Code sent."); }
    catch (e) { setMsg(e.message); onError?.(e.message); } finally { setBusy(false); }
  };
  const check = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api("/api/verify/check", { method: "POST", body: JSON.stringify({ channel, target, code }) });
      onProof?.(r.proof);
    } catch (e) { setMsg(e.message); onError?.(e.message); } finally { setBusy(false); }
  };
  return (
    <span data-otp={channel} style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center", ...style }}>
      {!sent ? (
        <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy || disabled || !String(target || "").trim()} onClick={send}>{word}</button>
      ) : (
        <>
          <input aria-label={channel === "sms" ? "The code we texted" : "The code we emailed"} inputMode="numeric" autoComplete="one-time-code"
            value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 96 }} />
          <button type="button" className="rm-btn rm-btn-sm" disabled={busy || !code.trim()} onClick={check}>Confirm</button>
          <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy} onClick={send}>Send again</button>
        </>
      )}
      {msg && <span role="status" style={{ fontSize: 12 }}>{msg}</span>}
    </span>
  );
}

// ⭐ D94 · ADMIN → SYSTEM → EMAIL HEALTH — hear from Resend when sending breaks, not from a user.
//
// D83's six rules: one sentence of purpose (codes behind the ?) · the numbers on open (the webhook secret set, the
// last event, failed sends this week, suppressed addresses, the domain's verification) · ONE main action — send a
// test to Resend's own safe bounce address (a second for the complaint address) — which proves the whole loop and
// says what it did · the suppression list, searchable, with Remove (a typed reason, an audit row, Undo — never
// silent) · both themes through the tokens, no pills (marks). The alerts themselves also reach Admin → Today.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, Mark, row, quiet, sub, callout, field } from "./adminKit.jsx";

const when = (s) => (s ? new Date(s * 1000).toLocaleString() : "never");

export function EmailHealthTab() {
  const [h, setH] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [said, setSaid] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);   // { email, reason }
  const [undo, setUndo] = useState(null);           // { auditId, email }

  const load = useCallback(() => {
    api("/api/admin/email-health").then(setH).catch((e) => setErr(e.message));
  }, []);
  const search = useCallback((text) => {
    api(`/api/admin/email-health/suppressions?q=${encodeURIComponent(text)}`).then((r) => setRows(r.rows || [])).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); search(""); }, [load, search]);

  const test = async (kind) => {
    setBusy(true); setSaid(null);
    try { const r = await api("/api/admin/email-health/test", { method: "POST", body: JSON.stringify({ kind }) }); setSaid({ ok: r.ok, text: r.said }); }
    catch (e) { setSaid({ ok: false, text: e.message }); }
    finally { setBusy(false); setTimeout(() => { load(); search(q); }, 400); }
  };
  const remove = async () => {
    try {
      const r = await api("/api/admin/email-health/suppressions/remove", { method: "POST", body: JSON.stringify(removing) });
      setUndo({ auditId: r.auditId, email: r.removed }); setRemoving(null); load(); search(q);
    } catch (e) { setErr(e.message); }
  };
  const doUndo = async () => {
    try { await api("/api/admin/email-health/suppressions/undo", { method: "POST", body: JSON.stringify({ auditId: undo.auditId }) }); setUndo(null); load(); search(q); }
    catch (e) { setErr(e.message); }
  };

  if (!h) return <Panel title="Email health" purpose="Loading…" data-email-health="">{err && <div style={callout(C.DANGER)}>{err}</div>}</Panel>;
  const domain = h.domains[0] || null;
  const numbers = [
    [h.secretSet ? "Yes" : "No", "webhook secret set", h.secretSet],
    [h.failedLast7Days, "failed sends, 7 days", h.failedLast7Days === 0],
    [h.suppressed.total, `suppressed (${h.suppressed.newThisWeek} new this week)`, true],
    [domain ? domain.status.replace(/_/g, " ") : "—", domain ? `domain ${domain.name || ""}` : "domain: no report yet", !!domain?.sendingOk],
  ];
  return (
    <Panel data-email-health="" title="Email health"
      purpose="Whether draft's email is getting out — so a broken sending path is seen here, not reported by someone whose password reset never arrived."
      code="D94 · Resend webhook POST /api/hooks/resend (Svix-signed) · events: email.bounced, email.complained, email.failed, email.suppressed, domain.updated · email_events kept 90 days, no recipient stored"
      numbers={numbers}>
      <p style={{ ...quiet, margin: "-6px 0 14px" }}>
        Last event received: {h.lastEvent ? <><b style={{ color: C.INK }}>{h.lastEvent.type}</b> · {when(h.lastEvent.at)}</> : "none yet"}
        {" · "}measured {when(h.measuredAt)}
      </p>
      {h.alerts.map((a, i) => (
        <div key={i} data-email-alert={a.severity} style={{ ...callout(a.severity === "critical" ? C.DANGER : C.WARNING), marginBottom: 10 }}>
          <Mark tone={a.severity === "critical" ? C.DANGER : C.WARNING}>{a.severity === "critical" ? "Act now" : "Watch"}</Mark> {a.detail}
        </div>
      ))}
      {!h.secretSet && <div style={{ ...callout(C.WARNING), marginBottom: 10 }}>The webhook answers 503 until RESEND_WEBHOOK_SECRET is set — no event can arrive.</div>}

      <div style={{ ...sub, marginBottom: 14 }}>
        <div style={row}>
          <DepthButton primary disabled={busy || !h.sendingConfigured} onClick={() => test("bounce")} data-email-test="bounce">Send a test to bounced@resend.dev</DepthButton>
          <DepthButton disabled={busy || !h.sendingConfigured} onClick={() => test("complaint")} data-email-test="complaint">…or to complained@resend.dev</DepthButton>
        </div>
        <p style={{ ...quiet, margin: "8px 0 0" }}>Resend's own test addresses: the send answers with a bounce (or a complaint), the signed hook records it, and the address appears on the list below — the whole loop, proved.{!h.sendingConfigured ? " Sending is not configured here (no RESEND_API_KEY)." : ""}</p>
        {said && <div role="status" style={{ ...callout(said.ok ? C.SUCCESS : C.DANGER), marginTop: 8 }}>{said.text}</div>}
      </div>

      <h3 style={{ fontSize: 14, color: C.INK, margin: "0 0 8px" }}>Suppression list <span style={quiet}>— addresses draft never sends to</span></h3>
      <input aria-label="Search the suppression list" placeholder="Search an address…" value={q} style={{ ...field, width: "100%", maxWidth: 360, marginBottom: 10 }}
        onChange={(e) => { setQ(e.target.value); search(e.target.value); }} />
      {undo && (
        <div role="status" style={{ ...callout(C.INFO), marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>{undo.email} was removed — it may be sent to again. The removal is in the audit log.</span>
          <DepthButton size="compact" onClick={doUndo} data-email-undo="">Undo</DepthButton>
        </div>
      )}
      {err && <div style={{ ...callout(C.DANGER), marginBottom: 10 }}>{err}</div>}
      {rows.length === 0 ? <p style={quiet}>{q ? "No address matches." : "Nothing is suppressed."}</p> : (
        <div style={{ display: "grid", gap: 6 }}>
          {rows.map((r) => (
            <div key={r.email} data-suppression={r.email} style={{ ...sub, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 220px", fontSize: 13, color: C.INK, overflowWrap: "anywhere" }}>{r.email}</span>
              <Mark tone={r.reason === "complaint" ? C.DANGER : C.INK_MUTED}>{r.reason.replace(/_/g, " ")}</Mark>
              <span style={quiet}>{when(r.createdAt)}</span>
              {removing?.email === r.email ? (
                <span style={{ ...row, flexBasis: "100%" }}>
                  <input aria-label={`Why may ${r.email} be sent to again?`} placeholder="Why may it be sent to again? (required)" autoFocus
                    value={removing.reason} onChange={(e) => setRemoving({ ...removing, reason: e.target.value })} style={{ ...field, flex: "1 1 240px" }} />
                  <DepthButton size="compact" primary disabled={removing.reason.trim().length < 3} onClick={remove}>Remove</DepthButton>
                  <DepthButton size="compact" onClick={() => setRemoving(null)}>Cancel</DepthButton>
                </span>
              ) : (
                <DepthButton size="compact" onClick={() => setRemoving({ email: r.email, reason: "" })}>Remove…</DepthButton>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

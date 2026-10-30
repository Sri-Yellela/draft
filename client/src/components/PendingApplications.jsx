// ── A63: THE PENDING TABLE — record a submission, and see whether it verified ─────────────────
//
// Owner, O45c (10-02): a job the user generated a résumé for, opened the posting of, or exported a
// résumé for is PENDING. They record the submission — when, how, and a confirmation — and only once
// it VERIFIES does it move to Submitted (the Applications sheet). Nothing becomes "submitted" on a
// click alone. The rule, and what it does and does not prove, comes from the server
// (services/applicationRecords.js VERIFY_RULE) and is shown above the table, not paraphrased here.
import { useEffect, useState } from "react";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import CompanyLink from "./CompanyLink.jsx";

const NO_TAG = () => {};   // this row IS the Pending list — opening the posting does not tag it again

const ORIGIN = {
  generated: "Résumé generated",
  opened_posting: "Posting opened",
  exported_resume: "Résumé exported",
  manual: "Added by you",
  draft: "Sent by Draft",
};

/** "YYYY-MM-DDTHH:MM" in local time, for a datetime-local input. */
function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function RecordForm({ row, methods, theme, onRecord, busy }) {
  const [f, setF] = useState({
    submittedAt: localNow(), method: row.method || methods[0]?.value || "company_site",
    evidenceUrl: row.evidenceUrl || "", evidenceText: row.evidenceText || "", reference: row.reference || "",
  });
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const field = { fontSize: 12, padding: "5px 8px", borderRadius: 6, border: `1px solid ${theme.border}`,
                  background: "transparent", color: theme.text, width: "100%", boxSizing: "border-box" };
  const label = { fontSize: 11, color: theme.textMuted, display: "flex", flexDirection: "column", gap: 3 };
  return (
    <form data-record-form onSubmit={e => { e.preventDefault(); onRecord(row.jobId, {
      ...f, submittedAt: new Date(f.submittedAt).toISOString() }); }}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 8 }}>
      <label style={label}>When you submitted it
        <input type="datetime-local" required value={f.submittedAt} onChange={set("submittedAt")} style={field} />
      </label>
      <label style={label}>How
        <select value={f.method} onChange={set("method")} style={field}>
          {methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      <label style={label}>Confirmation page URL
        <input type="url" placeholder="https://…" value={f.evidenceUrl} onChange={set("evidenceUrl")} style={field} />
      </label>
      <label style={label}>Confirmation email subject or a line from it
        <input value={f.evidenceText} onChange={set("evidenceText")} style={field}
          placeholder={`e.g. "Thank you for applying to ${row.company || "…"}"`} />
      </label>
      <label style={label}>Application / reference number
        <input value={f.reference} onChange={set("reference")} style={field} placeholder="e.g. R-104233" />
      </label>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button type="submit" disabled={busy} className="rm-btn rm-btn-primary rm-btn-sm">
          {busy ? "Checking…" : "Record and verify"}
        </button>
      </div>
    </form>
  );
}

export default function PendingApplications({ data, theme, onRecord, onWithdraw, busyId, messages = {}, focusJobId = null }) {
  const [open, setOpen] = useState(focusJobId);
  const rows = data?.pending || [];
  // A105 finding 3: History's "Record the submission" arrives WITH its job — that row's form is open and in view, so
  // the user does not hunt for it in the list.
  useEffect(() => {
    if (!focusJobId || !rows.some(r => r.jobId === focusJobId)) return;
    setOpen(focusJobId);
    document.querySelector(`[data-pending-row="${CSS.escape(String(focusJobId))}"]`)?.scrollIntoView?.({ block: "center" });
  }, [focusJobId, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const methods = data?.methods || [];
  const rule = data?.verifyRule;
  return (
    <div data-pending-table style={{ flex: 1, overflowY: "auto", padding: "10px 16px 16px", display: "flex",
                                     flexDirection: "column", gap: 8 }}>
      {rule && (
        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6, border: `1px solid ${theme.border}`,
                      borderRadius: 8, padding: "8px 12px" }}>
          <strong style={{ color: theme.text }}>Pending until verified.</strong> Record when and how you applied, with one of:{" "}
          {rule.evidence.join("; ")}. <br />
          <span>Verified means: {rule.proves} {rule.doesNotProve}</span>
        </div>
      )}
      {!rows.length && (
        <div style={{ textAlign: "center", padding: 32, color: theme.textMuted, fontSize: 13 }}>
          Nothing pending. A job lands here when you generate a résumé for it, open its posting from the board,
          or export a résumé — and leaves when you record a verified submission or say you did not apply.
        </div>
      )}
      {rows.map(row => {
        const busy = busyId === row.jobId;
        const msg = messages[row.jobId];
        const checks = msg?.checks || row.checks;
        return (
          <div key={row.jobId} data-pending-row={row.jobId}
            style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                {/* D38: the ONE company link. No Pending tag here — this row IS the Pending list (onOpen does nothing);
                    the job id is for D99 J11 — the extension opens the posting bound to it. */}
                <CompanyLink company={row.company || row.jobId} href={row.applyUrl || null} jobId={row.jobId} onOpen={NO_TAG} size="row" />
                <span style={{ fontSize: 12, color: theme.textMuted }}> · {row.title || "Untitled role"}</span>
              </div>
              <span style={{ fontSize: 11, color: theme.textMuted }}>{ORIGIN[row.origin] || row.origin}</span>
              <span style={markStyle(C.WARNING)}>
                {row.state === "recorded" ? "Recorded · not verified" : "Pending"}
              </span>
            </div>
            {checks && (
              <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12 }}>
                {checks.map(c => (
                  <li key={c.key} style={{ color: c.ok ? C.SUCCESS : C.DANGER }}>{c.ok ? "✓" : "✗"} {c.detail}</li>
                ))}
              </ul>
            )}
            {msg?.text && <div role="status" style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{msg.text}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="rm-btn rm-btn-secondary rm-btn-sm" disabled={busy}
                onClick={() => setOpen(open === row.jobId ? null : row.jobId)}>
                {open === row.jobId ? "Close" : row.state === "recorded" ? "Add evidence" : "Record submission"}
              </button>
              <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" disabled={busy}
                onClick={() => onWithdraw(row.jobId)}>I did not apply</button>
            </div>
            {open === row.jobId && <RecordForm row={row} methods={methods} theme={theme} busy={busy} onRecord={onRecord} />}
          </div>
        );
      })}
    </div>
  );
}

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
import { ApplyLink } from "./CompanyLink.jsx";   // A157: here re-opening the employer's form is the point
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const NO_TAG = () => {};   // this row IS the Pending list — opening the posting does not tag it again

const ORIGIN = {
  generated: "Résumé generated",
  opened_posting: "Posting opened",
  exported_resume: "Résumé exported",
  manual: "Added by you",
  draft: "Sent by Draft",
};

/** D112 c2 · "Moves in n days" — the server counts the days (services/applicationRecords.js PENDING_MOVE_DAYS). */
export function movesLabel(n) {
  if (n <= 0) return "Moves today";
  return `Moves in ${n} day${n === 1 ? "" : "s"}`;
}

/**
 * ⭐ D112 c2 · THE NOT APPLIED LIST — a pending row moved after 14 quiet days, and one you said you did not
 * apply to. Nothing here was deleted: each row keeps its record and snapshot, and Restore puts it back in
 * Pending with its 14 days restarting.
 */
export function NotAppliedList({ rows = [], theme, onRestore, busyId, moveDays = 14 }) {
  return (
    <div data-not-applied-list="" style={{ flex: 1, overflowY: "auto", padding: "10px 16px 16px", display: "flex",
                                           flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: ts(12), color: theme.textMuted, lineHeight: 1.6 }}>
        A Pending job with nothing recorded for {moveDays} days moves here, and so does one you said you did not
        apply to. Nothing is deleted — Restore puts it back in Pending for another {moveDays} days.
      </div>
      {!rows.length && (
        <div style={{ textAlign: "center", padding: 32, color: theme.textMuted, fontSize: ts(13) }}>Nothing in Not applied.</div>
      )}
      {rows.map(row => (
        <div key={row.jobId} data-not-applied-row={row.jobId}
          style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 12px",
                   display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <ApplyLink company={row.company || row.jobId} href={row.applyUrl || null} jobId={row.jobId} onOpen={NO_TAG} size="row">{row.company || row.jobId}</ApplyLink>
            <span style={{ fontSize: ts(12), color: theme.textMuted }}> · {row.title || "Untitled role"}</span>
          </div>
          <span style={markStyle(C.INK_FAINT)}>
            {row.state === "not_applied" ? `Moved after ${moveDays} days` : "You said you did not apply"}
          </span>
          <button type="button" className="rm-btn rm-btn-secondary rm-btn-sm" data-restore="" disabled={busyId === row.jobId}
            onClick={() => onRestore(row.jobId)}>{busyId === row.jobId ? "Restoring…" : "Restore"}</button>
        </div>
      ))}
    </div>
  );
}

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
  const field = { fontSize: ts(12), padding: "5px 8px", borderRadius: 6, border: `1px solid ${theme.border}`,
                  background: "transparent", color: theme.text, width: "100%", boxSizing: "border-box" };
  const label = { fontSize: ts(11), color: theme.textMuted, display: "flex", flexDirection: "column", gap: 3 };
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

export default function PendingApplications({ data, theme, onRecord, onWithdraw, onWithdrawMany, busyId, messages = {}, focusJobId = null }) {
  const [open, setOpen] = useState(focusJobId);
  const all = data?.pending || [];
  // A105 finding 2: every posting opened lands here (O45c), so clearing has to be cheap — a search, a tick per row,
  // and one press for "opened, never applied". Only PENDING rows clear in bulk; a recorded one keeps its evidence.
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const needle = q.trim().toLowerCase();
  const rows = needle ? all.filter(r => `${r.company || ""} ${r.title || ""}`.toLowerCase().includes(needle)) : all;
  const openedOnly = all.filter(r => r.origin === "opened_posting" && r.state === "pending").map(r => r.jobId);
  const pickedIds = [...picked].filter(id => all.some(r => r.jobId === id && r.state === "pending"));
  const toggle = (id) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearMany = async (ids, what) => {
    if (!ids.length || !onWithdrawMany) return;
    if (!window.confirm(`Take ${ids.length} ${what} out of Pending? Opening a posting again puts it back.`)) return;
    await onWithdrawMany(ids);
    setPicked(new Set());
  };
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
        <div style={{ fontSize: ts(12), color: theme.textMuted, lineHeight: 1.6, border: `1px solid ${theme.border}`,
                      borderRadius: 8, padding: "8px 12px" }}>
          <strong style={{ color: theme.text }}>Pending until verified.</strong> Record when and how you applied, with one of:{" "}
          {rule.evidence.join("; ")}. <br />
          <span>Verified means: {rule.proves} {rule.doesNotProve}</span>
        </div>
      )}
      {all.length > 0 && (
        <div data-pending-bulk="" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pending…" aria-label="Search pending"
            style={{ height: 30, padding: "0 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
                     color: theme.text, fontSize: ts(12), minWidth: 180 }} />
          {openedOnly.length > 0 && (
            <button type="button" className="rm-btn rm-btn-ghost rm-btn-sm" data-dismiss-opened=""
              onClick={() => clearMany(openedOnly, openedOnly.length === 1 ? "posting you only opened" : "postings you only opened")}>
              Dismiss {openedOnly.length} opened, not applied</button>
          )}
          {pickedIds.length > 0 && (
            <button type="button" className="rm-btn rm-btn-secondary rm-btn-sm" data-withdraw-picked=""
              onClick={() => clearMany(pickedIds, pickedIds.length === 1 ? "job" : "jobs")}>I did not apply ({pickedIds.length})</button>
          )}
        </div>
      )}
      {!rows.length && needle && all.length > 0 && (
        <div style={{ textAlign: "center", padding: 16, color: theme.textMuted, fontSize: ts(13) }}>Nothing pending matches “{q}”.</div>
      )}
      {!all.length && (
        <div style={{ textAlign: "center", padding: 32, color: theme.textMuted, fontSize: ts(13) }}>
          Nothing pending. A job lands here when you generate a résumé for it, open its posting from the board,
          or export a résumé — and leaves when you record a verified submission, say you did not apply, or 14 days
          pass with nothing recorded (it moves to Not applied, never deleted).
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
              {row.state === "pending" && (
                <input type="checkbox" aria-label={`Select ${row.company || row.jobId}`} checked={picked.has(row.jobId)}
                  onChange={() => toggle(row.jobId)} style={{ alignSelf: "center" }} />
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                {/* D38: the ONE company link. No Pending tag here — this row IS the Pending list (onOpen does nothing);
                    the job id is for D99 J11 — the extension opens the posting bound to it. */}
                <ApplyLink company={row.company || row.jobId} href={row.applyUrl || null} jobId={row.jobId} onOpen={NO_TAG} size="row">{row.company || row.jobId}</ApplyLink>
                <span style={{ fontSize: ts(12), color: theme.textMuted }}> · {row.title || "Untitled role"}</span>
              </div>
              <span style={{ fontSize: ts(11), color: theme.textMuted }}>{ORIGIN[row.origin] || row.origin}</span>
              {/* D112 c2: a pending row nobody acts on moves to Not applied — say when, never delete it. */}
              {row.movesInDays != null && (
                <span data-moves-in="" style={{ fontSize: ts(11), color: theme.textMuted }}
                  title="After 14 days with nothing recorded it moves to Not applied in Home — kept, and you can Restore it.">
                  {movesLabel(row.movesInDays)}
                </span>
              )}
              <span style={markStyle(C.WARNING)}>
                {row.state === "recorded" ? "Recorded · not verified" : "Pending"}
              </span>
            </div>
            {checks && (
              <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: ts(12) }}>
                {checks.map(c => (
                  <li key={c.key} style={{ color: c.ok ? C.SUCCESS : C.DANGER }}>{c.ok ? "✓" : "✗"} {c.detail}</li>
                ))}
              </ul>
            )}
            {msg?.text && <div role="status" style={{ fontSize: ts(12), color: theme.textMuted, marginTop: 4 }}>{msg.text}</div>}
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

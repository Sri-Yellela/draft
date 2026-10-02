// ── A59: THE LINE — Drafts waiting behind the running one, viewable and editable ──────────────
//
// Owner, O44 (10-02): a Draft made while another is running WAITS IN LINE instead of being refused,
// and every waiting Draft is viewable and editable BEFORE it begins — its place, its job, what the
// run will do and use. The line lives on the server (apply_runs.status='waiting'); this only draws
// it and sends the user's edits. ⛔ A draft that has STARTED is not editable: the server refuses
// with its own sentence (409 run_started) and that sentence is shown, never a generic failure.
import { C } from "../styles/colorTokens.js";
import { SectionHeading } from "../panels/AutoApplyPanelSections.jsx";

const TOOLS = [
  { value: "generate", label: "Generate" },
  { value: "a_plus_resume", label: "A+ Resume" },
];

const btn = (theme, disabled) => ({
  border: `1px solid ${theme.border}`, borderRadius: 6, padding: "3px 9px", background: "transparent",
  color: disabled ? C.INK_FAINT : theme.textMuted, fontWeight: 700, fontSize: 11,
  cursor: disabled ? "default" : "pointer",
});

/**
 * @param line   { waiting: [...], held } from GET /api/apply/runs `line`
 * @param canUseAPlus whether the A+ choice is offered (the server re-checks the entitlement)
 */
export default function WaitingLine({ line, theme, busyId, message, canUseAPlus = true,
                                      onTool, onMove, onRemove }) {
  const waiting = line?.waiting || [];
  if (!waiting.length) return null;
  return (
    <div data-waiting-line>
      <SectionHeading theme={theme} count={waiting.length}
        note="these start in order, one at a time — edit, reorder or remove them until they do">
        Waiting in line
      </SectionHeading>
      {line.held && (
        <div role="status" data-line-held={line.held.reason}
          style={{ fontSize: 12, color: C.WARNING, border: `1px solid ${C.WARNING}`, borderRadius: 8,
                   padding: "6px 10px", margin: "4px 0 8px" }}>
          {line.held.message}
        </div>
      )}
      {message && (
        <div role="status" style={{ fontSize: 12, color: theme.textMuted, margin: "2px 0 8px" }}>{message}</div>
      )}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {waiting.map((run, i) => {
          const busy = busyId === run.id;
          const jobs = run.jobs || [];
          const first = jobs[0];
          return (
            <li key={run.id} data-line-run={run.id}
              style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 12px",
                       display: "flex", gap: 12, alignItems: "flex-start", opacity: busy ? 0.6 : 1 }}>
              <div aria-label={`Place ${run.position} of ${waiting.length}`}
                style={{ fontWeight: 800, fontSize: 13, color: theme.textMuted, minWidth: 22, paddingTop: 1 }}>
                {run.position}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>
                  {first ? `${first.title || "Untitled role"} · ${first.company || "Unknown company"}` : "—"}
                  {jobs.length > 1 && <span style={{ color: theme.textMuted, fontWeight: 600 }}> and {jobs.length - 1} more</span>}
                </div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{run.willDo}</div>
                {run.usesProfile && (
                  <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                    Uses your active profile when it starts — today that is “{run.usesProfile}”.
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                  {run.editable?.tool ? (
                    <label style={{ fontSize: 11.5, color: theme.textMuted, display: "flex", gap: 6, alignItems: "center" }}>
                      Résumé
                      <select value={run.toolType || "generate"} disabled={busy}
                        onChange={e => onTool(run.id, e.target.value)}
                        style={{ fontSize: 11.5, borderRadius: 6, border: `1px solid ${theme.border}`,
                                 background: "transparent", color: theme.text, padding: "2px 4px" }}>
                        {TOOLS.filter(t => canUseAPlus || t.value !== "a_plus_resume" || run.toolType === t.value)
                          .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                  ) : (
                    <span style={{ fontSize: 11.5, color: theme.textMuted }}>Approved as it is — remove it to change it.</span>
                  )}
                  <button type="button" disabled={busy || i === 0} onClick={() => onMove(run.id, -1)}
                    aria-label="Move up" style={btn(theme, busy || i === 0)}>↑</button>
                  <button type="button" disabled={busy || i === waiting.length - 1} onClick={() => onMove(run.id, 1)}
                    aria-label="Move down" style={btn(theme, busy || i === waiting.length - 1)}>↓</button>
                  <button type="button" disabled={busy} onClick={() => onRemove(run.id)}
                    style={btn(theme, busy)}>Remove</button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

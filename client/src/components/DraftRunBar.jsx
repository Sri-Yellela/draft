import "./DraftHouse.css";
import { autoToggle, capUsage, STOP_DOES, STOP_DOES_NOT, HELD_LINE } from "../lib/draftHouseExceptions.js";

// ============================================================
// DraftRunBar — the top of Draft House (D25, the workspace model)
// ============================================================
// Three things, and nothing else: the MODE, the three CAPS with how much of each is used, and the
// user's own ⏸ STOP EVERYTHING. Everything is read from GET /api/apply/run-bar (AutoApplyContext's
// `runBar`) — the bar computes nothing it could disagree with the server about.
//
//   MODE  SEMI (the default) fills, stops, and waits for your approval. FULL AUTO (D100, the user's
//         own choice) sends what matches the Auto settings without asking each time.
//         ⛔ FULL AUTO is VISIBLY LOCKED with its reason unless the server answers `locked: false` —
//         the operator's kill switch. autoToggle() is the only reader, and it reads anything else —
//         no answer, an error, an older server — as locked; the segment then has no handler that
//         could send anything. The pressed segment is the SERVER's `mode.current`, never a guess.
//         ⚙ Auto settings opens the drawer (D102 P4) — filters, cap, times, terms.
//   CAPS  queue ≥ approval ≥ submission, the pipeline's own order, over the trailing 24 hours.
//   STOP  reaches the server (POST /api/apply/hold), which checks it before starting any run. The
//         bar SAYS what it does and does not do, in text — not in a tooltip a phone cannot show.
// ============================================================

export default function DraftRunBar({ runBar, onStop, onMode, onOpenSettings, busy = false, message = "" }) {
  const mode = autoToggle(runBar);
  const current = runBar?.mode?.current === "auto" && mode.selectable ? "auto" : "semi";
  const held = !!runBar?.hold?.held;
  const caps = Array.isArray(runBar?.caps) ? runBar.caps : [];

  return (
    <section className="dh-bar" data-draft-runbar="" data-held={held ? "true" : "false"} aria-label="Run bar">
      <div className="dh-bar__group">
        <span className="dh-bar__label" id="dh-mode-label">Mode</span>
        <div className="dh-mode" role="group" aria-labelledby="dh-mode-label">
          <button type="button" className="dh-mode__seg" aria-pressed={current === "semi"} data-mode="semi"
            disabled={busy || !runBar} onClick={() => current !== "semi" && onMode?.("semi")}
            title="Every application is filled, then waits for your approval before it is sent.">
            SEMI
          </button>
          {/* ⛔ Locked (the operator's kill switch, or no answer): disabled, and its handler is not attached. */}
          <button type="button" className="dh-mode__seg" aria-pressed={current === "auto"} data-mode="auto"
            data-locked={mode.selectable ? "false" : "true"}
            disabled={!mode.selectable || busy} aria-disabled={!mode.selectable}
            aria-describedby={mode.selectable ? undefined : "dh-auto-why"}
            onClick={mode.selectable ? () => current !== "auto" && onMode?.("auto") : undefined}>
            {mode.selectable ? "FULL AUTO" : "🔒 FULL AUTO"}
          </button>
        </div>
        <button type="button" className="dh-btn dh-bar__settings" data-auto-settings-open=""
          onClick={(e) => onOpenSettings?.(e.currentTarget)}>⚙ Auto settings</button>
        {!mode.selectable && (
          <p className="dh-mode__why" id="dh-auto-why" data-auto-locked-reason="">{mode.reason}</p>
        )}
      </div>

      <div className="dh-bar__group">
        <span className="dh-bar__label">Today’s caps · last {runBar?.windowHours ?? 24} h</span>
        <div className="dh-caps">
          {caps.length === 0 && <span className="dh-cap__name">Loading…</span>}
          {caps.map(c => {
            const pct = c.limit > 0 ? Math.min(100, Math.round((c.used / c.limit) * 100)) : 0;
            return (
              <div key={c.id} className="dh-cap" data-cap={c.id} data-full={c.remaining === 0 ? "true" : "false"}
                   title={`${c.label}: ${c.bounds}. ${c.remaining} left.`}>
                <span className="dh-cap__name">{c.label}</span>
                <span className="dh-cap__n">{capUsage(c)}</span>
                <span className="dh-cap__meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dh-stop">
        <button type="button" className="dh-stop__btn" data-stop-everything="" data-held={held ? "true" : "false"}
          disabled={busy || !runBar} onClick={() => onStop?.(!held)}>
          {held ? "▶ Resume" : "⏸ Stop everything"}
        </button>
        {held && <p className="dh-stop__held" role="status">{HELD_LINE}</p>}
        <p className="dh-stop__say" data-stop-says="">{STOP_DOES} {STOP_DOES_NOT}</p>
        {message && <p className="dh-stop__msg" role="status">{message}</p>}
      </div>
    </section>
  );
}

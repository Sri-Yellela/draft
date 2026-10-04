import "./DraftHouse.css";
import { autoToggle, capUsage, STOP_DOES, STOP_DOES_NOT, HELD_LINE } from "../lib/draftHouseExceptions.js";

// ============================================================
// DraftRunBar — the top of Draft House (D25, the workspace model)
// ============================================================
// Three things, and nothing else: the MODE, the three CAPS with how much of each is used, and the
// user's own ⏸ STOP EVERYTHING. Everything is read from GET /api/apply/run-bar (AutoApplyContext's
// `runBar`) — the bar computes nothing it could disagree with the server about.
//
//   MODE  SEMI is what every Draft does today: it fills, stops, and waits for your approval.
//         ⛔ AUTO is VISIBLY LOCKED with its reason unless the server answers `locked: false`.
//         autoToggle() is the only reader, and it reads anything else — no answer, an error, an
//         older server — as locked. There is no client-side way to unlock it, and no click handler
//         on the AUTO segment that could send anything.
//   CAPS  queue ≥ approval ≥ submission, the pipeline's own order, over the trailing 24 hours.
//   STOP  reaches the server (POST /api/apply/hold), which checks it before starting any run. The
//         bar SAYS what it does and does not do, in text — not in a tooltip a phone cannot show.
// ============================================================

export default function DraftRunBar({ runBar, onStop, busy = false, message = "" }) {
  const mode = autoToggle(runBar);
  const held = !!runBar?.hold?.held;
  const caps = Array.isArray(runBar?.caps) ? runBar.caps : [];

  return (
    <section className="dh-bar" data-draft-runbar="" data-held={held ? "true" : "false"} aria-label="Run bar">
      <div className="dh-bar__group">
        <span className="dh-bar__label" id="dh-mode-label">Mode</span>
        <div className="dh-mode" role="group" aria-labelledby="dh-mode-label">
          <button type="button" className="dh-mode__seg" aria-pressed="true" data-mode="semi"
            title="Every application is filled, then waits for your approval before it is sent.">
            SEMI
          </button>
          {/* ⛔ No onClick. While the server says locked this segment is disabled; selectable AUTO is
              a server decision that does not exist yet (D22: AF5 and a supervised full-auto run). */}
          <button type="button" className="dh-mode__seg" aria-pressed="false" data-mode="auto"
            data-locked={mode.selectable ? "false" : "true"}
            disabled={!mode.selectable} aria-disabled={!mode.selectable}
            aria-describedby={mode.selectable ? undefined : "dh-auto-why"}>
            {mode.selectable ? "AUTO" : "🔒 AUTO"}
          </button>
        </div>
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

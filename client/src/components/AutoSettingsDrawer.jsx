// ⭐ D102 P4 · AUTO SETTINGS — the drawer from Draft House's run bar (docs/sketches/pipeline-workspace.html, approved by
// the owner 10-30). With the mode, these settings ARE the user's submit in FULL AUTO (D36 amended), so every value is the
// server's to validate (shared/autoSettings.js, PUT /api/apply/auto-settings — refused whole, never half-stored).
//   Start from my board filters · the daily cap (1–150) · up to four run times · the per-company limit · the pause after
//   an interview or offer · the job profile · ⭐ 10-30 "Agree to a portal's terms for me" (off by default) · what is never
//   sent automatically.
// A right-edge drawer with a scrim; × and Esc close it; focus moves in and returns to the button that opened it.
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Z } from "../styles/zLayers.js";
import { lastBoardFilters, filterLine } from "../lib/boardFilterMemory.js";
import "./DraftHouse.css";

const CAP_MIN = 1, CAP_MAX = 150, MAX_TIMES = 4;
const SPARE_TIMES = ["09:00", "12:00", "17:30", "20:00", "07:00"];

export default function AutoSettingsDrawer({ open, onClose }) {
  const [s, setS] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setMsg("");
    api("/api/apply/auto-settings").then(r => { if (live) setS(r.settings); }).catch(e => live && setMsg(e.message || "Could not load your settings."));
    api("/api/domain-profiles").then(r => { if (live) setProfiles(Array.isArray(r) ? r : (r?.profiles || [])); }).catch(() => {});
    const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [open]);
  useEffect(() => { if (open && s) panel.current?.querySelector("[data-first]")?.focus(); }, [open, s]);

  if (!open) return null;
  const set = (patch) => setS(prev => ({ ...prev, ...patch }));
  const board = lastBoardFilters();
  const boardLine = filterLine(board);

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api("/api/apply/auto-settings", { method: "PUT", body: JSON.stringify({ settings: s }) });
      setS(r.settings);
      onClose?.();
    } catch (e) {
      setMsg(e.message || "Could not save — nothing changed.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="dh-scrim" style={{ zIndex: Z.MODAL_SCRIM }} onClick={onClose} aria-hidden="true" />
      <aside className="dh-drawer" style={{ zIndex: Z.MODAL }} role="dialog" aria-modal="true" aria-labelledby="dh-auto-title" ref={panel} data-auto-settings="">
        <header className="dh-drawer__head">
          <h2 id="dh-auto-title">Auto settings</h2>
          <button type="button" className="dh-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {!s ? <p className="dh-drawer__msg" role="status">{msg || "Loading…"}</p> : (
          <div className="dh-drawer__body">
            <div className="dh-set">
              <button type="button" className="dh-btn" data-first="" disabled={!boardLine}
                onClick={() => set({ filters: board })}>Start from my board filters</button>
              <span className="dh-set__hint">{Object.keys(s.filters || {}).length ? `Now: ${filterLine(s.filters)}`
                : boardLine ? `Your board: ${boardLine}` : "Open the board and filter it first — its filters start here."}</span>
            </div>

            <div className="dh-set">
              <label htmlFor="dh-cap">Daily cap · <b>{s.dailyCap}</b> applications</label>
              <input id="dh-cap" type="range" min={CAP_MIN} max={CAP_MAX} value={s.dailyCap}
                onChange={(e) => set({ dailyCap: Number(e.target.value) })} />
              <span className="dh-set__hint">The {s.dailyCap + 1}th waits for tomorrow, in your time zone.</span>
            </div>

            <div className="dh-set">
              <span className="dh-set__lab">Run times · {s.timeZone}</span>
              <div className="dh-times">
                {s.runTimes.map(t => (
                  <span key={t} className="dh-time">{t}
                    <button type="button" aria-label={`Remove ${t}`} disabled={s.runTimes.length === 1}
                      onClick={() => set({ runTimes: s.runTimes.filter(x => x !== t) })}>✕</button>
                  </span>
                ))}
                {s.runTimes.length < MAX_TIMES && (
                  <button type="button" className="dh-btn" onClick={() => {
                    const next = SPARE_TIMES.find(x => !s.runTimes.includes(x));
                    if (next) set({ runTimes: [...s.runTimes, next].sort() });
                  }}>+ Add a time</button>
                )}
              </div>
              <span className="dh-set__hint">Each run takes the jobs posted since the last.</span>
            </div>

            <div className="dh-set">
              <label className="dh-sw">
                <input type="checkbox" role="switch" checked={s.perCompanyLimit30d != null} aria-checked={s.perCompanyLimit30d != null}
                  onChange={() => set({ perCompanyLimit30d: s.perCompanyLimit30d == null ? 2 : null })} />
                <span className="dh-set__lab">Limit applications per company</span>
              </label>
              {s.perCompanyLimit30d != null ? (
                <label className="dh-set__hint">At most{" "}
                  <input type="number" min={1} max={20} value={s.perCompanyLimit30d} aria-label="Applications per company"
                    onChange={(e) => set({ perCompanyLimit30d: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
                  {" "}to one company in 30 days.</label>
              ) : <span className="dh-set__hint">Off — no per-company limit.</span>}
            </div>

            <div className="dh-set">
              <label className="dh-sw">
                <input type="checkbox" role="switch" checked={!!s.pauseCompanyAfterReply} aria-checked={!!s.pauseCompanyAfterReply}
                  onChange={() => set({ pauseCompanyAfterReply: !s.pauseCompanyAfterReply })} />
                <span className="dh-set__lab">Pause a company after an interview or offer</span>
              </label>
              <span className="dh-set__hint">For 60 days, read from your inbox.</span>
            </div>

            <div className="dh-set">
              <label htmlFor="dh-prof">Job profile</label>
              <select id="dh-prof" value={s.profileId ?? ""} onChange={(e) => set({ profileId: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">The active profile</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name || p.name || `Profile ${p.id}`}</option>)}
              </select>
            </div>

            <div className="dh-set">
              <label className="dh-sw">
                <input type="checkbox" role="switch" checked={!!s.agreeToTerms} aria-checked={!!s.agreeToTerms} data-agree-to-terms=""
                  onChange={() => set({ agreeToTerms: !s.agreeToTerms })} />
                <span className="dh-set__lab">Agree to a portal's terms for me</span>
              </label>
              <span className="dh-set__hint">{s.agreeToTerms
                ? "draft ticks a terms, privacy or data-processing box when an application needs it. Never a signature or a statement that your answers are true."
                : "Off — a terms box waits for you in Needs you."}</span>
            </div>

            <div className="dh-set">
              <span className="dh-set__lab">Never sent automatically</span>
              <span className="dh-set__hint">Postings your Application defaults rule out, a human check (a CAPTCHA), an eligibility
                question you have not answered{s.agreeToTerms ? "" : ", a terms box"} — each waits in Needs you.</span>
            </div>
            {msg && <p className="dh-drawer__msg" role="alert">{msg}</p>}
          </div>
        )}
        <footer className="dh-drawer__foot">
          <button type="button" className="dh-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="dh-btn" data-kind="primary" onClick={save} disabled={!s || busy}>{busy ? "Saving…" : "Save"}</button>
        </footer>
      </aside>
    </>
  );
}

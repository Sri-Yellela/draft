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

const CAP_MAX = 150, MAX_TIMES = 4, CAP_MIN = 1;
const SAVE_AFTER_MS = 500;

// A105 finding 8 (10-30): every change SAVES — no Save / Cancel (it was ⚙ → change → Save). Changes are sent whole
// after a short pause (a dragged slider is one save, not forty); a value the server refuses puts the last saved
// settings back and says why. Done / × / Esc / the scrim close only after the last change is saved.
export default function AutoSettingsDrawer({ open, onClose }) {
  const [s, setS] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState("");
  const [newTime, setNewTime] = useState("");
  const panel = useRef(null);
  const timer = useRef(null);
  const pending = useRef(null);
  const lastSaved = useRef(null);
  const closeRef = useRef(null);

  const flush = async () => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setBusy(true);
    try {
      const r = await api("/api/apply/auto-settings", { method: "PUT", body: JSON.stringify({ settings: next }) });
      lastSaved.current = r.settings;
      setMsg(""); setSaved("Saved");
    } catch (e) {
      if (lastSaved.current) setS(lastSaved.current);
      setSaved("");
      setMsg(`${e.message || "That value was refused"} — your last saved settings are kept.`);
    } finally { setBusy(false); }
  };
  const close = async () => { await flush(); onClose?.(); };
  closeRef.current = close;

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setMsg(""); setSaved("");
    api("/api/apply/auto-settings").then(r => { if (live) { lastSaved.current = r.settings; setS(r.settings); } })
      .catch(e => live && setMsg(e.message || "Could not load your settings."));
    api("/api/domain-profiles").then(r => { if (live) setProfiles(Array.isArray(r) ? r : (r?.profiles || [])); }).catch(() => {});
    const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [open]);
  useEffect(() => { if (open && s) panel.current?.querySelector("[data-first]")?.focus(); }, [open, s]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!open) return null;
  const set = (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    pending.current = next;
    setSaved("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_AFTER_MS);
  };
  const board = lastBoardFilters();
  const boardLine = filterLine(board);

  return (
    <>
      <div className="dh-scrim" style={{ zIndex: Z.MODAL_SCRIM }} onClick={close} aria-hidden="true" />
      <aside className="dh-drawer" style={{ zIndex: Z.MODAL }} role="dialog" aria-modal="true" aria-labelledby="dh-auto-title" ref={panel} data-auto-settings="">
        <header className="dh-drawer__head">
          <h2 id="dh-auto-title">Auto settings</h2>
          <button type="button" className="dh-btn" onClick={close} aria-label="Close">✕</button>
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
                  <span className="dh-time" data-add-time="">
                    <input type="time" aria-label="A run time to add" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    <button type="button" aria-label="Add this time" disabled={!newTime || s.runTimes.includes(newTime)}
                      onClick={() => { set({ runTimes: [...s.runTimes, newTime].sort() }); setNewTime(""); }}>+ Add</button>
                  </span>
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
          <span className="dh-set__hint" role="status" data-save-state="">{busy ? "Saving…" : saved}</span>
          <button type="button" className="dh-btn" data-kind="primary" onClick={close}>Done</button>
        </footer>
      </aside>
    </>
  );
}

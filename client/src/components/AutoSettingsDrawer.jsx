// ⭐ D113 UI U8 (owner 10-31) · SETTINGS — Draft House's ONE drawer, three groups. It was two (D102 P4's Auto settings
// from the run bar, D100's Portals); the tree's header has one Settings button and this is what it opens:
//   When and how much     the daily cap, the run times, how picks arrive, "Show me the form before sending" (D113)
//   Which jobs            Start from my board filters, the per-company limit, the pause after an interview, "Skip stale
//                         or reposted jobs" (D107 P3's thresholds), the job profile, what is never sent automatically
//   Accounts on job sites each portal with its state and Remove, the accounts draft made, Gmail, and "Agree to a job
//                         site's terms for me"
// With the mode these settings ARE the user's submit in FULL AUTO (D36 amended), so every value is the server's to
// validate (shared/autoSettings.js, PUT /api/apply/auto-settings — refused whole, never half-stored).
// A right-edge drawer with a scrim; × and Esc close it; focus moves in and returns to the button that opened it.
import { useEffect, useRef, useState } from "react";
import { api, authContextQuery } from "../lib/api.js";
import { Z } from "../styles/zLayers.js";
import { lastBoardFilters, filterLine } from "../lib/boardFilterMemory.js";
import { capUsage, STOP_DOES, STOP_DOES_NOT } from "../lib/draftHouseExceptions.js";
import "./DraftHouse.css";

const CAP_MAX = 150, MAX_TIMES = 4, CAP_MIN = 1;
const SAVE_AFTER_MS = 500;

// The portals the worker has an account adapter for (apply-worker/lib/accounts.js ADAPTERS).
const ACCOUNT_PORTALS = [{ family: "amazon", host: "amazon.jobs", label: "Amazon Jobs" }];
const PORTAL_STATUS = { active: "Connected", expiring: "Expiring soon", expired: "Expired — reconnect", removed: "Removed",
  requested: "Being created", pending: "Being created", created: "Ready", failed: "Could not be created", stopped: "Waiting for you" };
const when = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString(undefined, { dateStyle: "medium" }) : "");

// A105 finding 8 (10-30): every change SAVES — no Save / Cancel. Changes are sent whole after a short pause (a dragged
// slider is one save, not forty); a value the server refuses puts the last saved settings back and says why. Done / × /
// Esc / the scrim close only after the last change is saved.
// ⭐ D146: a fourth group, View — the table (default) or The Table's full sheet (spreadsheet, by company, board, funnel),
// kept here rather than on the first screen. `listView` / `onListView` are the panel's; the setting is not stored.
export default function AutoSettingsDrawer({ open, onClose, runBar = null, group = null, listView = "table", onListView = null }) {
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
  useEffect(() => {
    if (!open || !s) return;
    const target = group ? panel.current?.querySelector(`[data-settings-group="${group}"]`) : null;
    if (target) target.scrollIntoView?.({ block: "start" });
    (target?.querySelector("button, input, select") || panel.current?.querySelector("[data-first]"))?.focus();
  }, [open, s, group]);
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
  const caps = Array.isArray(runBar?.caps) ? runBar.caps : [];
  const stale = s && (s.staleReposts != null || s.staleOpenDays != null);

  return (
    <>
      <div className="dh-scrim" style={{ zIndex: Z.MODAL_SCRIM }} onClick={close} aria-hidden="true" />
      <aside className="dh-drawer" style={{ zIndex: Z.MODAL }} role="dialog" aria-modal="true" aria-labelledby="dh-settings-title" ref={panel}
        data-auto-settings="" data-settings-drawer="">
        <header className="dh-drawer__head">
          <h2 id="dh-settings-title">Settings</h2>
          <button type="button" className="dh-btn" onClick={close} aria-label="Close">✕</button>
        </header>
        {!s ? <p className="dh-drawer__msg" role="status">{msg || "Loading…"}</p> : (
          <div className="dh-drawer__body">
            {/* ── 1 · WHEN AND HOW MUCH ── */}
            <section className="dh-group" data-settings-group="when" aria-labelledby="dh-g-when">
              <h3 id="dh-g-when" className="dh-group__h">When and how much</h3>
              <div className="dh-set">
                <label htmlFor="dh-cap">Applications a day, at most · <b>{s.dailyCap}</b></label>
                <input id="dh-cap" type="range" min={CAP_MIN} max={CAP_MAX} value={s.dailyCap} data-first=""
                  onChange={(e) => set({ dailyCap: Number(e.target.value) })} />
                <span className="dh-set__hint">The {s.dailyCap + 1}th waits for tomorrow, in your time zone.</span>
                {caps.length > 0 && (
                  <span className="dh-set__hint" data-caps-used="">Last {runBar?.windowHours ?? 24} h: {caps.map(c => `${c.label} ${capUsage(c) ?? "—"}`).join(" · ")}</span>
                )}
              </div>

              <div className="dh-set">
                <span className="dh-set__lab">When to look for new jobs · {s.timeZone}</span>
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
                <span className="dh-set__lab">Picks arrive by</span>
                <span className="dh-set__hint">One email and one notification per run, with Apply and Pass on each pick. Turn either off in Account → Notifications.</span>
              </div>

              {/* What Pause (= Stop everything) does and does NOT do, in text — not only in the button's tooltip. */}
              <div className="dh-set">
                <span className="dh-set__lab">Pause</span>
                <span className="dh-set__hint" data-stop-says="">{STOP_DOES} {STOP_DOES_NOT}</span>
              </div>

              {/* ⭐ D113 answer (1): off by default — a tap on Apply sends. On, the form waits at Ready for your review. */}
              {"showFormBeforeSending" in s && (
                <div className="dh-set" data-show-form-setting="">
                  <label className="dh-sw">
                    <input type="checkbox" role="switch" checked={!!s.showFormBeforeSending} aria-checked={!!s.showFormBeforeSending}
                      onChange={() => set({ showFormBeforeSending: !s.showFormBeforeSending })} />
                    <span className="dh-set__lab">Show me the form before sending</span>
                  </label>
                  <span className="dh-set__hint">{s.showFormBeforeSending
                    ? "Each filled form waits in Ready for your review until you approve it."
                    : "Off — a tap on Apply sends it."}</span>
                </div>
              )}
            </section>

            {/* ── 2 · WHICH JOBS ── */}
            <section className="dh-group" data-settings-group="jobs" aria-labelledby="dh-g-jobs">
              <h3 id="dh-g-jobs" className="dh-group__h">Which jobs</h3>
              <div className="dh-set">
                <button type="button" className="dh-btn" disabled={!boardLine}
                  onClick={() => set({ filters: board })}>Start from my board filters</button>
                <span className="dh-set__hint">{Object.keys(s.filters || {}).length ? `Now: ${filterLine(s.filters)}`
                  : boardLine ? `Your board: ${boardLine}` : "Open the board and filter it first — its filters start here."}</span>
              </div>
              {/* ⭐ D121 P3: off by default. On, picks keep only companies whose public LCA record says they sponsor. */}
              {"onlySponsorRecord" in s && (
                <div className="dh-set" data-only-sponsor-setting="">
                  <label className="dh-sw">
                    <input type="checkbox" role="switch" checked={!!s.onlySponsorRecord} aria-checked={!!s.onlySponsorRecord}
                      onChange={() => set({ onlySponsorRecord: !s.onlySponsorRecord })} />
                    <span className="dh-set__lab">Only companies with a sponsorship record</span>
                  </label>
                  <span className="dh-set__hint">{s.onlySponsorRecord
                    ? "Picks keep only companies that filed certified LCAs in the latest complete fiscal year or the one before. A record of filings, not a promise."
                    : "Off — every company can be picked. If you need sponsorship, companies with a record come first."}</span>
                </div>
              )}

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
                  <span className="dh-set__lab">Skip a company after it interviews me</span>
                </label>
                <span className="dh-set__hint">For 60 days after an interview or offer, read from your inbox.</span>
              </div>

              {/* ⭐ D107 P3 · postings that look never-filled — left out of picks, FULL AUTO and Approve all, still on the board. */}
              <div className="dh-set" data-stale-settings="">
                <label className="dh-sw">
                  <input type="checkbox" role="switch" checked={!!stale} aria-checked={!!stale}
                    onChange={() => set(stale ? { staleReposts: null, staleOpenDays: null } : { staleReposts: 3, staleOpenDays: 90 })} />
                  <span className="dh-set__lab">Skip stale or reposted jobs</span>
                </label>
                {stale ? (
                  <>
                    <label className="dh-set__hint">Reposted{" "}
                      <input type="number" min={1} max={20} value={s.staleReposts ?? 3} aria-label="Reposts before a posting is skipped"
                        onChange={(e) => set({ staleReposts: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
                      {" "}times or more, or open more than{" "}
                      <input type="number" min={14} max={365} value={s.staleOpenDays ?? 90} aria-label="Days open before a posting is skipped"
                        onChange={(e) => set({ staleOpenDays: Math.max(14, Math.min(365, Number(e.target.value) || 14)) })} />
                      {" "}days.</label>
                    <span className="dh-set__hint">They stay on your board; you can still send one yourself.</span>
                  </>
                ) : <span className="dh-set__hint">Off — reposted and long-open jobs are picked like any other.</span>}
              </div>

              <div className="dh-set">
                <label htmlFor="dh-prof">Job profile</label>
                <select id="dh-prof" value={s.profileId ?? ""} onChange={(e) => set({ profileId: e.target.value === "" ? null : Number(e.target.value) })}>
                  <option value="">The active profile</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name || p.name || `Profile ${p.id}`}</option>)}
                </select>
              </div>

              <div className="dh-set">
                <span className="dh-set__lab">Never sent automatically</span>
                <span className="dh-set__hint">Jobs your Application defaults rule out, jobs past the limits above, a human check (a CAPTCHA), an eligibility
                  question you have not answered{s.agreeToTerms ? "" : ", a terms box"} — each waits in Needs you.</span>
              </div>
            </section>

            {/* ── 3 · ACCOUNTS ON JOB SITES (was the Portals drawer, D100) ── */}
            <section className="dh-group" data-settings-group="accounts" aria-labelledby="dh-g-accounts">
              <h3 id="dh-g-accounts" className="dh-group__h">Accounts on job sites</h3>
              <Accounts />
              <div className="dh-set">
                <label className="dh-sw">
                  <input type="checkbox" role="switch" checked={!!s.agreeToTerms} aria-checked={!!s.agreeToTerms} data-agree-to-terms=""
                    onChange={() => set({ agreeToTerms: !s.agreeToTerms })} />
                  <span className="dh-set__lab">Agree to a job site's terms for me</span>
                </label>
                <span className="dh-set__hint">{s.agreeToTerms
                  ? "draft ticks a terms, privacy or data-processing box when an application needs it. Never a signature or a statement that your answers are true."
                  : "Off — a terms box waits for you in Needs you."}</span>
              </div>
            </section>
            {/* ── 4 · VIEW (D146) — how the applications are shown: the table, or the full sheet ── */}
            {onListView && (
              <section className="dh-group" data-settings-group="view" aria-labelledby="dh-g-view">
                <h3 id="dh-g-view" className="dh-group__h">View</h3>
                <div className="dh-set" role="radiogroup" aria-labelledby="dh-g-view">
                  <label className="dh-sw">
                    <input type="radio" name="dh-list-view" value="table" data-list-view="table" checked={listView === "table"}
                      onChange={() => onListView("table")} />
                    <span className="dh-set__lab">The table</span>
                  </label>
                  <span className="dh-set__hint">One row per application; a row opens in place.</span>
                  <label className="dh-sw">
                    <input type="radio" name="dh-list-view" value="sheet" data-list-view="sheet" checked={listView === "sheet"}
                      onChange={() => onListView("sheet")} />
                    <span className="dh-set__lab">The full sheet</span>
                  </label>
                  <span className="dh-set__hint">The spreadsheet you can edit, By company, Board and Funnel, Pending, Not applied and the Inbox.</span>
                </div>
              </section>
            )}
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

// ── D100 · the sign-in portals draft can apply on for the user: sessions they connected (sealed — draft cannot read them)
// and accounts draft's apply worker made for them, each with Remove (the worker destroys the key; an account at the portal
// stays the user's). Creating an account is offered per portal, with its consent said in full, ONLY when the apply worker is
// configured (GET /api/portals `worker`) — nothing is offered that nothing can do. Connecting a signed-in session happens
// from the extension / the Android app (D100 P3), not from this page. Gmail (D112) reads codes and replies.
function Accounts() {
  const [d, setD] = useState(null);
  const [g, setG] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);
  const load = async () => {
    try { setD(await api("/api/portals")); } catch (e) { setMsg(e.message || "Could not load your job-site accounts."); }
  };
  useEffect(() => {
    load();
    api("/api/gmail/status").then(setG).catch(() => setG(null));
  }, []);
  const act = async (key, fn, done) => {
    setBusy(key); setMsg("");
    try { await fn(); if (done) setMsg(done); await load(); }
    catch (e) { setMsg(e.message || "That did not work — nothing changed."); }
    finally { setBusy(null); }
  };
  if (!d) return <p className="dh-set__hint" role="status" data-portals-drawer="">{msg || "Loading…"}</p>;
  const live = (d.portals || []).filter(p => p.status !== "removed");
  const accounts = (d.accounts || []).filter(a => a.status !== "removed");
  const hasAccount = (family) => accounts.some(a => a.portalFamily === family);
  return (
    <div className="dh-accounts" data-portals-drawer="">
      <div className="dh-set">
        <span className="dh-set__lab">Connected sites</span>
        {live.length === 0 ? <span className="dh-set__hint">None yet. Connect one from the draft extension or app while you are signed in to it — draft stores the session sealed and cannot read it.</span>
          : live.map(p => (
            <div key={p.id} className="dh-sw" data-portal={p.id}>
              <span style={{ flex: 1 }}>{p.originHost}<span className="dh-set__hint"> · {PORTAL_STATUS[p.status] || p.status}{p.lastUsedAt ? ` · last used ${when(p.lastUsedAt)}` : ""}</span></span>
              <button type="button" className="dh-btn" disabled={busy === `p${p.id}`}
                onClick={() => act(`p${p.id}`, () => api(`/api/portals/${p.id}`, { method: "DELETE" }), "Removed — its key is destroyed.")}>Remove</button>
            </div>
          ))}
      </div>

      <div className="dh-set">
        <span className="dh-set__lab">Accounts draft made for you</span>
        {accounts.length === 0 ? <span className="dh-set__hint">None.</span> : accounts.map(a => (
          <div key={a.id} className="dh-sw" data-portal-account={a.id}>
            <span style={{ flex: 1 }}>{a.originHost}<span className="dh-set__hint"> · {PORTAL_STATUS[a.status] || a.status}{a.lastStop ? ` · ${a.lastStop}` : ""}</span></span>
            <button type="button" className="dh-btn" disabled={busy === `a${a.id}`}
              onClick={() => act(`a${a.id}`, () => api(`/api/portals/accounts/${a.id}`, { method: "DELETE" }),
                "Removed from draft. The account at the site stays yours — use its “forgot password” to sign in.")}>Remove</button>
          </div>
        ))}
      </div>

      {d.worker ? (
        <div className="dh-set" data-portal-create="">
          <span className="dh-set__lab">Let draft create an account</span>
          {ACCOUNT_PORTALS.filter(p => !hasAccount(p.family)).map(p => (
            <div key={p.family} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="dh-set__hint">draft will create a {p.label} account with your email and a password only its apply service can read. You can always take it over with {p.label}'s “forgot password”.</span>
              <div><button type="button" className="dh-btn" data-kind="primary" disabled={busy === p.family}
                onClick={() => act(p.family, () => api("/api/portals/accounts", { method: "POST",
                  body: JSON.stringify({ portalFamily: p.family, originHost: p.host, consent: true }) }),
                  `${p.label}: draft will create it the next time an application needs it.`)}>Create my {p.label} account</button></div>
            </div>
          ))}
          {ACCOUNT_PORTALS.every(p => hasAccount(p.family)) && <span className="dh-set__hint">Every site draft can make an account on is set up.</span>}
        </div>
      ) : (
        <div className="dh-set"><span className="dh-set__hint" data-portal-worker-off="">Applying on sign-in sites for you is not switched on yet. Those applications wait in Needs you for you to finish.</span></div>
      )}

      {g?.available && (
        <div className="dh-set" data-gmail-setting={g.status}>
          <span className="dh-set__lab">Gmail, for codes and replies</span>
          {g.connected
            ? <span className="dh-set__hint">Connected{g.email ? ` · ${g.email}` : ""}. Disconnect it from The Table's inbox.</span>
            : <a className="dh-btn" href={`/api/gmail/connect?${authContextQuery()}`}>{g.status === "expired" ? "Reconnect Gmail" : "Connect Gmail"}</a>}
        </div>
      )}
      {msg && <p className="dh-drawer__msg" role="status">{msg}</p>}
    </div>
  );
}

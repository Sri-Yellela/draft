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
//
// ⭐ D148 (owner 11-03, settings-declutter.html) RESTYLES IT — the same drawer, the same settings and saves:
//   the title "Auto-apply" + Close · THE MODE FIRST as two choices (Ask me first · Apply for me — the header's
//   switch, the same handlers and lock) · then folds, each ONE line showing its current value, ONE open at a time,
//   opened in place in D145's type (an accent eyebrow + a short headline + its controls) with Done to fold it:
//     When · How many · Which jobs · Before sending · Tell me · Pausing · Accounts (when there is anything in it) ·
//     View (D146, when the panel offers it)
//   and the internal limits off the first screen: "Today: n sent of N · Details".
//
// ⭐ D149 (owner 11-03) REBUILDS IT TO THE SKETCH, values verbatim (DraftHouse.css's D148 block): a 520 px drawer with
//   no footer (Close closes, saving first); the sketch's own switches (role="switch" buttons, were the platform
//   checkbox); "Use my board filters" a switch (was a button; off clears them); "At most N per company" (the number
//   stays editable in its line); the stale thresholds in the stale row's line; "Add a time" the sketch's dashed button;
//   View's two choices drawn like the mode's; "Today: n sent of N." with Details under it. Every handler, value and
//   save is the same.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, authContextQuery } from "../lib/api.js";
import { Z } from "../styles/zLayers.js";
import { lastBoardFilters, filterLine } from "../lib/boardFilterMemory.js";
import { capUsage, STOP_DOES, STOP_DOES_NOT } from "../lib/draftHouseExceptions.js";
import "./DraftHouse.css";
import { SALARY_DEFAULTS, SALARY_PRESETS, SALARY_PRESET_LABELS, salaryAnswerFor } from "../../../shared/salaryAnswer.js";

// ⭐ 46a (owner 11-10): the salary answer's one line on the fold.
const usd = (n) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
function salaryLine(sal) {
  const s = { ...SALARY_DEFAULTS, ...(sal || {}) };
  const noRange = s.whenNoRange === "ask" ? "no range: ask me" : `no range: ${s.amount != null ? usd(s.amount) : "my Profile's number"}`;
  if (s.mode === "fixed") return `always ${usd(s.amount)}`;
  if (s.mode === "position") return `${s.position}% up the posted range · ${noRange}`;
  if (s.mode === "preset") return `${(SALARY_PRESET_LABELS[s.preset] || "").split(" (")[0].toLowerCase()} of the posted range · ${noRange}`;
  return "my Profile's desired salary";
}

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
const RUN_AT = (t) => { const [h, m] = String(t).split(":").map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`; };
const listWords = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] || "");
/** "America/New_York" → "New York time". */
export function zoneWords(tz) {
  const city = String(tz || "").split("/").pop().replace(/_/g, " ");
  return city ? `${city} time` : "";
}
/** ⭐ D148 · each fold's ONE line — its current value, in words. Pure. */
export function foldValues(s, { notify = null, held = false, accounts = null, listView = "table" } = {}) {
  if (!s) return {};
  const times = (s.runTimes || []).map(RUN_AT);
  const jobs = [];
  if (s.onlySponsorRecord) jobs.push("sponsors only");
  if (s.staleReposts != null || s.staleOpenDays != null) jobs.push("skips stale posts");
  // D149 (11-03): the sketch's line is "sponsors only · skips stale posts" with its per-company switch ON — the limit is
  // not on the line (it wrapped the line to two); it shows when the fold opens.
  if (Object.keys(s.filters || {}).length) jobs.push("your board filters");
  const picks = notify?.events?.find(e => e.key === "picks");
  const ch = picks ? [picks.email && "email", picks.push && "notification"].filter(Boolean) : null;
  return {
    when: `${listWords(times)}${times.length ? ", " : ""}${zoneWords(s.timeZone)}`,
    howmany: `up to ${s.dailyCap} a day`,
    jobs: jobs.length ? jobs.join(" · ") : "every match",
    before: [s.showFormBeforeSending ? "show me the form" : "send when I tap Apply", s.agreeToTerms ? "agree to terms for me" : null].filter(Boolean).join(" · "),
    salary: salaryLine(s.salary),
    tell: ch == null ? "set in Account → Notifications" : ch.length ? `by ${ch.join(" and ")}` : "off",
    pausing: [held ? "paused now" : null, s.pauseCompanyAfterReply ? "pause after an interview" : "keeps going after an interview"].filter(Boolean).join(" · "),
    accounts: accounts == null ? "" : `${accounts} connected`,
    view: listView === "sheet" ? "the full sheet" : "the table",
  };
}

// A fold: its one line (a button that opens it in place), and — open — the headline, the controls, Done (D182: no
// eyebrow repeating the fold's title — the headline says what it is).
// ⭐ D149 (11-03): the sketch's .gq — .top (the line), .body (eyebrow · h3 · controls · .done2); Done is the sketch's
// accent button, not the old depth box.
function Fold({ id, title, value, headline, open, onOpen, onDone, children }) {
  return (
    <section className="dh-fold2" data-settings-group={id} data-open={open ? "true" : "false"}>
      <button type="button" className="dh-fold2__top" aria-expanded={open} aria-controls={`dh-fb-${id}`} onClick={onOpen} data-fold-top={id}>
        <b>{title}</b><span data-fold-value="">{value}</span>
      </button>
      {open && (
        <div className="dh-fold2__body" id={`dh-fb-${id}`}>
          <h3 className="dh-fold2__h">{headline}</h3>
          {children}
          <button type="button" className="dh-fold2__done" onClick={onDone} data-fold-done={id}>Done</button>
        </div>
      )}
    </section>
  );
}

// A105 finding 8 (10-30): every change SAVES — no Save / Cancel. Changes are sent whole after a short pause (a dragged
// slider is one save, not forty); a value the server refuses puts the last saved settings back and says why. Done / ×
// / Esc / the scrim close only after the last change is saved.
// ⭐ D146: View — the table (default) or The Table's full sheet, kept here rather than on the first screen.
// ⭐ D148: `mode` ({ fullAuto, selectable, reason }), `onAsk` / `onAuto` (the header switch's own handlers), `held` and
// `onPauseNow` (the timeline's Pause, setStopEverything) — the drawer offers what the header and the timeline offer.
// ⭐ D167: `inline` — a DOM element to draw INTO instead of <body>: Profile → Auto-apply (pages/profile/ProfilePage.jsx)
// shows these same settings as its panel — no scrim, not a dialog, its head left to the page — and a change still
// pending when the panel is left is saved on the way out. The same folds, values, handlers and saves.
export default function AutoSettingsDrawer({ open, onClose, runBar = null, group = null, listView = "table", onListView = null,
                                             mode = null, onAsk = null, onAuto = null, modeBusy = false, held = false, onPauseNow = null,
                                             inline = null }) {
  const [s, setS] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState("");
  const [newTime, setNewTime] = useState("");
  const [adding, setAdding] = useState(false);   // D149: "Add a time" is the sketch's dashed button; pressed, the time box
  const [fold, setFold] = useState(null);
  const [notify, setNotify] = useState(null);
  const [acct, setAcct] = useState(null);   // { connected, anything } — Accounts' own answer
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
    setMsg(""); setSaved(""); setFold(group || null); setAdding(false);
    api("/api/apply/auto-settings").then(r => { if (live) { lastSaved.current = r.settings; setS(r.settings); } })
      .catch(e => live && setMsg(e.message || "Could not load your settings."));
    api("/api/domain-profiles").then(r => { if (live) setProfiles(Array.isArray(r) ? r : (r?.profiles || [])); }).catch(() => {});
    api("/api/notify/settings").then(r => { if (live) setNotify(r?.events ? r : null); }).catch(() => {});
    const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [open, group]);
  useEffect(() => {
    if (!open || !s) return;
    const target = fold ? panel.current?.querySelector(`[data-settings-group="${fold}"] .dh-fold2__body`) : null;
    if (target) target.scrollIntoView?.({ block: "nearest" });
    (target?.querySelector("button, input, select") || panel.current?.querySelector("[data-first]"))?.focus();
    // ⛔ A168 (46b, found by the salary walk): this ran on EVERY change of `s` — each keystroke's save — so typing 145000 into
    // the floor moved focus to the fold's first control after the "1" and saved floor = 1. It runs when a fold opens (and
    // once the settings arrive), never while the person types.
  }, [open, !!s, fold]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => () => { if (inline) closeRef.current?.(); }, [inline]);   // D167: leaving the inline panel saves first

  if (!open) return null;
  const set = (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    pending.current = next;
    setSaved("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_AFTER_MS);
  };
  // "Tell me" writes the SAME preference Account → Notifications writes (the "picks" event, per channel).
  const setPick = async (channel, on) => {
    try { setNotify(await api("/api/notify/prefs", { method: "PUT", body: JSON.stringify({ event: "picks", channel, on }) })); }
    catch (e) { setMsg(e.message || "Could not save that."); }
  };
  const board = lastBoardFilters();
  const boardLine = filterLine(board);
  const caps = Array.isArray(runBar?.caps) ? runBar.caps : [];
  const sent = caps.find(c => c.id === "submission");
  const stale = !!s && (s.staleReposts != null || s.staleOpenDays != null);
  const v = foldValues(s, { notify, held, accounts: acct?.connected ?? null, listView });
  const fp = (id) => ({ open: fold === id, onOpen: () => setFold(f => (f === id ? null : id)), onDone: () => setFold(null) });
  const picks = notify?.events?.find(e => e.key === "picks") || null;
  // ⭐ D149 (11-03): the sketch's own switch (.sw) — a real control: a button with role="switch" + aria-checked, Space /
  // Enter press it, its name from the row's label. Was the platform checkbox. The track's corners are 8, not the sketch's
  // 14: 14 on 28 is a capsule, barred by D60 (8 on 28 = 29 %, inside d60CompactRadius' 30 %).
  const sw = (checked, onChange, extra = {}) => (
    <button type="button" role="switch" className="dh-swb" aria-checked={!!checked} onClick={onChange} {...extra} />
  );
  const times = s?.runTimes?.length || 0;
  const boardOn = !!s && Object.keys(s.filters || {}).length > 0;

  // ⭐ D149: PORTALLED to <body>. Rendered inside the page, the drawer's z-index only ranked within the page's own
  // stacking context, and the Dock (portalled to <body> at Z.NAV) drew over its bottom edge.
  return createPortal(
    <>
      {!inline && <div className="dh-scrim" style={{ zIndex: Z.MODAL_SCRIM }} onClick={close} aria-hidden="true" />}
      <aside className={inline ? "dh-drawer dh-drawer--d148 dh-drawer--inline" : "dh-drawer dh-drawer--d148"} style={inline ? undefined : { zIndex: Z.MODAL }}
        role={inline ? "region" : "dialog"} aria-modal={inline ? undefined : "true"} aria-labelledby="dh-settings-title" ref={panel}
        data-auto-settings="" data-settings-drawer="">
        <header className="dh-drawer__head">
          <h2 id="dh-settings-title">Auto-apply</h2>
          <button type="button" className="dh-close" onClick={close} data-first="" data-settings-close="">Close</button>
        </header>
        {!s ? <p className="dh-drawer__msg" role="status">{msg || "Loading…"}</p> : (
          <div className="dh-drawer__body">
            {/* ── THE MODE, FIRST — two plain choices; the header switch's own handlers and its lock ── */}
            {mode && (
              <div className="dh-mode2" role="group" aria-label="Mode" data-settings-mode="">
                <button type="button" data-mode="ask" aria-pressed={!mode.fullAuto} disabled={modeBusy || !onAsk}
                  onClick={() => { if (mode.fullAuto) onAsk?.(); }}>
                  <b>Ask me first</b><span>nothing is sent until you approve</span>
                </button>
                <button type="button" data-mode="auto" aria-pressed={!!mode.fullAuto} data-locked={mode.selectable ? "false" : "true"}
                  disabled={modeBusy || !mode.selectable || !onAuto} onClick={mode.selectable ? () => { if (!mode.fullAuto) onAuto?.(); } : undefined}>
                  <b>Apply for me</b><span>{mode.selectable ? "good matches are sent on their own" : `locked: ${mode.reason}`}</span>
                </button>
              </div>
            )}

            <Fold id="when" title="When" value={v.when} {...fp("when")}
              headline={`draft looks for new jobs ${times === 1 ? "once" : times === 2 ? "twice" : `${times} times`} a day`}>
              {/* D149: the sketch's .times — a chip per time (its ✕ removes it: behaviour the sketch does not draw), then the
                  dashed "Add a time"; pressed, it becomes the time box and Add. */}
              <div className="dh-times">
                {s.runTimes.map(t => (
                  <span key={t} className="dh-time">{RUN_AT(t)}
                    <button type="button" aria-label={`Remove ${t}`} disabled={s.runTimes.length === 1}
                      onClick={() => set({ runTimes: s.runTimes.filter(x => x !== t) })}>✕</button>
                  </span>
                ))}
                {s.runTimes.length < MAX_TIMES && (adding ? (
                  <span className="dh-time dh-time--add" data-add-time="">
                    <input type="time" aria-label="A run time to add" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    <button type="button" aria-label="Add this time" disabled={!newTime || s.runTimes.includes(newTime)}
                      onClick={() => { set({ runTimes: [...s.runTimes, newTime].sort() }); setNewTime(""); setAdding(false); }}>Add</button>
                  </span>
                ) : (
                  <button type="button" className="dh-time-add" data-add-time-open="" onClick={() => setAdding(true)}>Add a time</button>
                ))}
              </div>
              <p className="dh-fold2__lead dh-fold2__lead--after">Each time, it only looks at jobs posted since the last. Times are in {zoneWords(s.timeZone)} ({s.timeZone}).</p>
            </Fold>

            <Fold id="howmany" title="How many" value={v.howmany} headline="At most this many a day" {...fp("howmany")}>
              <div className="dh-stepper" data-daily-cap="">
                <button type="button" aria-label="Fewer" disabled={s.dailyCap <= CAP_MIN} onClick={() => set({ dailyCap: Math.max(CAP_MIN, s.dailyCap - 1) })}>−</button>
                <b aria-live="polite">{s.dailyCap}</b>
                <button type="button" aria-label="More" disabled={s.dailyCap >= CAP_MAX} onClick={() => set({ dailyCap: Math.min(CAP_MAX, s.dailyCap + 1) })}>+</button>
              </div>
              <p className="dh-fold2__lead dh-fold2__lead--after">Anything over waits for tomorrow.</p>
            </Fold>

            <Fold id="jobs" title="Which jobs" value={v.jobs} headline="Only the jobs worth sending" {...fp("jobs")}>
              {/* ⭐ D121 P3: off by default. On, picks keep only companies whose public LCA record says they sponsor. */}
              {/* D149: the sketch's rows (.tg) — a label, a quiet line under it, the switch on the right. A row whose line
                  holds a number box names its switch with <label htmlFor> so a press on the box never flips the switch. */}
              {"onlySponsorRecord" in s && (
                <label className="dh-tg" data-only-sponsor-setting="">
                  <span>Only companies with a sponsorship record<small>{s.onlySponsorRecord
                    ? "certified LCAs in the latest complete fiscal year or the one before — a record, not a promise"
                    : "off — if you need sponsorship, companies with a record come first"}</small></span>
                  {sw(s.onlySponsorRecord, () => set({ onlySponsorRecord: !s.onlySponsorRecord }))}
                </label>
              )}
              {/* ⭐ D107 P3 · postings that look never-filled — left out of picks, FULL AUTO and Approve all, still on the board. */}
              <div className="dh-tg" data-stale-settings="">
                <span><label htmlFor="dh-sw-stale">Skip stale posts</label>{stale ? (
                  <small>reposted{" "}
                    <input type="number" min={1} max={20} value={s.staleReposts ?? 3} aria-label="Reposts before a posting is skipped"
                      onChange={(e) => set({ staleReposts: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
                    + times or open{" "}
                    <input type="number" min={14} max={365} value={s.staleOpenDays ?? 90} aria-label="Days open before a posting is skipped"
                      onChange={(e) => set({ staleOpenDays: Math.max(14, Math.min(365, Number(e.target.value) || 14)) })} />
                    + days</small>
                ) : <small>off — reposted and long-open jobs are picked like any other</small>}</span>
                {sw(stale, () => set(stale ? { staleReposts: null, staleOpenDays: null } : { staleReposts: 3, staleOpenDays: 90 }), { id: "dh-sw-stale" })}
              </div>
              {/* D149: "Use my board filters" is the sketch's switch — on starts from the board's filters (as the button
                  did), off clears them; it cannot turn on before the board has any. */}
              <label className="dh-tg" data-board-filters-setting="">
                <span>Use my board filters<small>{boardOn ? `Now: ${filterLine(s.filters)}`
                  : boardLine ? `Your board: ${boardLine}` : "Open the board and filter it first — its filters start here."}</small></span>
                {sw(boardOn, () => (boardOn ? set({ filters: {} }) : set({ filters: board })), { disabled: !boardOn && !boardLine })}
              </label>
              <div className="dh-tg" data-per-company-setting="">
                <span><label htmlFor="dh-sw-company">At most {s.perCompanyLimit30d ?? 2} per company</label>{s.perCompanyLimit30d != null ? (
                  <small>in any 30 days · change it:{" "}
                    <input type="number" min={1} max={20} value={s.perCompanyLimit30d} aria-label="Applications per company"
                      onChange={(e) => set({ perCompanyLimit30d: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></small>
                ) : <small>off — no per-company limit</small>}</span>
                {sw(s.perCompanyLimit30d != null, () => set({ perCompanyLimit30d: s.perCompanyLimit30d == null ? 2 : null }), { id: "dh-sw-company" })}
              </div>
              <div className="dh-tg">
                <span><label htmlFor="dh-prof">Job profile</label><small>the résumé and the board it picks from</small></span>
                <select id="dh-prof" className="dh-select" value={s.profileId ?? ""} onChange={(e) => set({ profileId: e.target.value === "" ? null : Number(e.target.value) })}>
                  <option value="">The active profile</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.profile_name || p.name || `Profile ${p.id}`}</option>)}
                </select>
              </div>
              <p className="dh-fold2__lead dh-fold2__lead--after" data-never-sent="">Never sent automatically: jobs your Application defaults rule out, jobs past the limits,
                a human check (a CAPTCHA), an eligibility question you have not answered{s.agreeToTerms ? "" : ", a terms box"} — each waits in Needs you.</p>
            </Fold>

            <Fold id="before" title="Before sending" value={v.before} headline="Check each form yourself?" {...fp("before")}>
              {/* ⭐ D113 answer (1): off by default — a tap on Apply sends. On, the form waits at Ready for your review. */}
              {"showFormBeforeSending" in s && (
                <label className="dh-tg" data-show-form-setting="">
                  <span>Show me the form before sending<small>{s.showFormBeforeSending
                    ? "each filled form waits in Ready for your review until you approve it"
                    : "off — a tap on Apply sends it"}</small></span>
                  {sw(s.showFormBeforeSending, () => set({ showFormBeforeSending: !s.showFormBeforeSending }))}
                </label>
              )}
              <label className="dh-tg">
                <span>Agree to a job site's terms for me<small>{s.agreeToTerms
                  ? "a terms, privacy or data-processing box — never a signature or a statement that your answers are true"
                  : "off — a terms box waits for you in Needs you"}</small></span>
                {sw(s.agreeToTerms, () => set({ agreeToTerms: !s.agreeToTerms }), { "data-agree-to-terms": "" })}
              </label>
            </Fold>

            {/* ⭐ 46a (owner 11-10): how an application answers "What salary do you expect?" — shared/salaryAnswer.js decides,
                on the server, for every application; the example below runs the same function on a sample range. */}
            <Fold id="salary" title="Salary" value={v.salary} headline="What to answer when a form asks your salary" {...fp("salary")}>
              {(() => {
                const sal = { ...SALARY_DEFAULTS, ...(s.salary || {}) };
                const setSal = (patch) => set({ salary: { ...sal, ...patch } });
                const sample = { salary_min_usd: 120000, salary_max_usd: 160000, salary_period: "annual" };
                const ex = salaryAnswerFor(sal, { profileSalary: null, job: sample });
                const modes = [["profile", "My Profile's desired salary", "the number on your Profile — as before"],
                  ["fixed", "A fixed amount", "the same number on every application"],
                  ["position", "A point on the company's range", "a slider from the posting's minimum to its maximum"],
                  ["preset", "A named point on the range", "lower limit, lower end, midpoint, higher end or upper limit"]];
                return (<div data-salary-setting="">
                  {modes.map(([m, label, sub]) => (
                    <label key={m} className="dh-tg" data-salary-mode={m}>
                      <span>{label}<small>{sub}</small></span>
                      <input type="radio" name="dh-salary-mode" checked={sal.mode === m}
                        onChange={() => setSal({ mode: m, ...(m === "fixed" && sal.amount == null ? { amount: 100000 } : {}) })} />
                    </label>
                  ))}
                  {(sal.mode === "fixed" || sal.whenNoRange === "fixed") && sal.mode !== "profile" && (
                    <div className="dh-tg"><span><label htmlFor="dh-sal-amount">{sal.mode === "fixed" ? "The amount" : "When the posting states no range"}</label>
                      <small>a year, in US dollars</small></span>
                      <input id="dh-sal-amount" type="number" min={1} step={1000} value={sal.amount ?? ""} aria-label="Salary amount"
                        onChange={(e) => setSal({ amount: e.target.value === "" ? null : Math.max(1, Number(e.target.value) || 0) })} />
                    </div>
                  )}
                  {sal.mode === "position" && (
                    <div className="dh-tg" data-salary-slider=""><span><label htmlFor="dh-sal-pos">{sal.position}% up the range</label>
                      <small>0 = the posting's minimum · 100 = its maximum</small></span>
                      <input id="dh-sal-pos" type="range" min={0} max={100} step={5} value={sal.position} aria-label="Point on the posted range"
                        onChange={(e) => setSal({ position: Number(e.target.value) })} />
                    </div>
                  )}
                  {sal.mode === "preset" && (
                    <div className="dh-tg"><span><label htmlFor="dh-sal-preset">Which point</label><small>a posted range is two numbers, so its mean and median are its midpoint</small></span>
                      <select id="dh-sal-preset" className="dh-select" value={sal.preset} onChange={(e) => setSal({ preset: e.target.value })}>
                        {Object.keys(SALARY_PRESETS).map(k => <option key={k} value={k}>{SALARY_PRESET_LABELS[k]}</option>)}
                      </select>
                    </div>
                  )}
                  {(sal.mode === "position" || sal.mode === "preset") && (
                    <label className="dh-tg" data-salary-no-range=""><span>When the posting states no range<small>{sal.whenNoRange === "ask"
                      ? "the question waits for you in Needs you" : "answer the amount above (or your Profile's number)"}</small></span>
                      <select className="dh-select" value={sal.whenNoRange} aria-label="When the posting states no range" onChange={(e) => setSal({ whenNoRange: e.target.value })}>
                        <option value="fixed">Answer my amount</option><option value="ask">Ask me</option>
                      </select>
                    </label>
                  )}
                  {sal.mode !== "profile" && (
                    <div className="dh-tg"><span><label htmlFor="dh-sal-floor">Never below</label><small>{sal.floor != null ? "the answer is raised to this when lower" : "off — no floor"}</small></span>
                      <input id="dh-sal-floor" type="number" min={1} step={1000} value={sal.floor ?? ""} placeholder="no floor" aria-label="Salary floor"
                        onChange={(e) => setSal({ floor: e.target.value === "" ? null : Math.max(1, Number(e.target.value) || 0) })} />
                    </div>
                  )}
                  <p className="dh-fold2__lead dh-fold2__lead--after" data-salary-example="">
                    For a posting that says $120,000–$160,000: {ex.value == null ? "left for you" : usd(ex.value)} ({ex.basis}).
                    A salary you saved for a kind of job in Application defaults still wins for that kind of job.</p>
                </div>);
              })()}
            </Fold>

            <Fold id="tell" title="Tell me" value={v.tell} headline="How you hear about new picks" {...fp("tell")}>
              {picks && notify?.email?.offered && (
                <label className="dh-tg" data-picks-channel="email"><span>Email</span>
                  {sw(picks.email, () => setPick("email", !picks.email))}</label>
              )}
              {picks && notify?.push?.offered && (
                <label className="dh-tg" data-picks-channel="push"><span>Notification</span>
                  {sw(picks.push, () => setPick("push", !picks.push))}</label>
              )}
              <p className="dh-fold2__lead dh-fold2__lead--after">{picks
                ? "One per run, with Apply and Pass on each pick — the same choice as Account → Notifications."
                : "One email and one notification per run, with Apply and Pass on each pick. Set them in Account → Notifications."}</p>
            </Fold>

            <Fold id="pausing" title="Pausing" value={v.pausing} headline="Stop when it matters" {...fp("pausing")}>
              <label className="dh-tg">
                <span>Skip a company after it interviews me<small>for 60 days after an interview or offer, read from your inbox</small></span>
                {sw(s.pauseCompanyAfterReply, () => set({ pauseCompanyAfterReply: !s.pauseCompanyAfterReply }))}
              </label>
              {onPauseNow && (
                <button type="button" className="dh-pausebtn" data-pause-now="" data-held={held ? "true" : "false"} disabled={modeBusy || !runBar}
                  onClick={() => onPauseNow(!held)}>{held ? "Resume" : "Pause everything now"}</button>
              )}
              <p className="dh-fold2__lead dh-fold2__lead--pause" data-stop-says="">{STOP_DOES} {STOP_DOES_NOT}</p>
            </Fold>

            {/* ── ACCOUNTS ON JOB SITES (D100) — a fold only when there is anything in it ── */}
            {acct == null && <Accounts onState={setAcct} probe />}
            {acct?.anything && (
              <Fold id="accounts" title="Accounts" value={v.accounts} headline="Job sites draft applies on for you" {...fp("accounts")}>
                <Accounts onState={setAcct} />
              </Fold>
            )}

            {/* ── VIEW (D146) — how the applications are shown: the table, or the full sheet ── */}
            {onListView && (
              <Fold id="view" title="View" value={v.view} headline="How your applications are shown" {...fp("view")}>
                {/* D149: two choices drawn as the sketch draws the mode's two choices (the current one outlined). */}
                <div className="dh-mode2" role="group" aria-label="View">
                  <button type="button" data-list-view="table" aria-pressed={listView === "table"} onClick={() => onListView("table")}>
                    <b>The table</b><span>one row per application; a row opens in place</span>
                  </button>
                  <button type="button" data-list-view="sheet" aria-pressed={listView === "sheet"} onClick={() => onListView("sheet")}>
                    <b>The full sheet</b><span>the spreadsheet: By company, Board and Funnel, Pending, Not applied, the Inbox</span>
                  </button>
                </div>
              </Fold>
            )}

            {/* ── THE INTERNAL LIMITS, off the first screen: one quiet line, the rest behind Details ──
                D149: the sketch's p.detail — "Today: 4 sent of 10." and the Details link under it. */}
            {caps.length > 0 && (
              <details className="dh-limits" data-caps-used="">
                <summary>{sent ? `Today: ${sent.used} sent of ${Math.min(sent.limit, s.dailyCap)}.` : "Today's limits."} <span className="dh-limits__more">Details</span></summary>
                <p data-caps-detail="">Last {runBar?.windowHours ?? 24} h: {caps.map(c => `${c.label} ${capUsage(c) ?? "—"}`).join(" · ")}</p>
              </details>
            )}
            {msg && <p className="dh-drawer__msg" role="alert">{msg}</p>}
          </div>
        )}
        {/* D149: no footer — the sketch closes with Close (every close saves first). The save state is still said, to
            screen readers; a refused value is shown above (role="alert"). */}
        <span className="sr-only" role="status" data-save-state="">{busy ? "Saving…" : saved}</span>
      </aside>
    </>, inline || document.body);
}

// ── D100 · the sign-in portals draft can apply on for the user: sessions they connected (sealed — draft cannot read them)
// and accounts draft's apply worker made for them, each with Remove (the worker destroys the key; an account at the portal
// stays the user's). Creating an account is offered per portal, with its consent said in full, ONLY when the apply worker is
// configured (GET /api/portals `worker`) — nothing is offered that nothing can do. Connecting a signed-in session happens
// from the extension / the Android app (D100 P3), not from this page. Gmail (D112) reads codes and replies.
// ⭐ D148: `onState` reports { connected, anything } so the drawer can name the fold ("2 connected") and hide it when
// there is nothing in it; `probe` renders nothing — it only loads and reports while the fold is unmeasured.
function Accounts({ onState = null, probe = false }) {
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
  const live = (d?.portals || []).filter(p => p.status !== "removed");
  const accounts = (d?.accounts || []).filter(a => a.status !== "removed");
  useEffect(() => {
    if (!d) return;
    onState?.({ connected: live.length + accounts.length, anything: live.length + accounts.length > 0 || !!d.worker || !!g?.available });
  }, [d, g]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (probe) return null;
  if (!d) return <p className="dh-set__hint" role="status" data-portals-drawer="">{msg || "Loading…"}</p>;
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

/**
 * ⭐ D167 · Profile → Connections → Managed portals: the drawer's own Accounts fold (D100 portals, the accounts draft made,
 * Gmail for codes), drawn in the page — the same component, its classes inside this module's own frame.
 */
export function PortalAccounts() {
  return (
    <div className="dh-drawer dh-drawer--d148 dh-drawer--inline" data-profile-portals="">
      <Accounts />
    </div>
  );
}

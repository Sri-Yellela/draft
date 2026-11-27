// ⭐ D197 Wave 2 #17 · M5 (47m, lane person) · THE PASSPORT'S SETTINGS PIECES, in the plate system (docs/revamp/settings.md,
// the approved mock pages/dev/platePages/Settings.jsx and the Passport board's Notifications panel):
//   PassportNotifications   the one operable model — the per-event table (push · email), each cell a switch, the caption says
//                           what the last switch made true (aria-live); Push on this browser is the panel's one clay point
//                           while it is off; the test send; New jobs that fit you (digest · as they arrive · off + the hour).
//                           Every rule is the server's (routes/notify.js, services/notify.js) — the same calls the D112 card made.
//   PassportPlan            Your plan (D197 #17′, the in-app Plans page folded into Settings): the current plan stamped ACTIVE,
//                           each change a request (POST /api/plans/request-upgrade), REQUEST PENDING as a status word.
//   AssistantPrivacy        Ask draft's log and the "improve Atlas" switch (T5), as a settings sheet.
//   CreditDraftChoice       D185-7: answer "draft" to How did you hear about us? — only for jobs found on draft.
// Plate tokens only (plate/person.css's pieces); nothing here reads a model.
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { SettingsSheet } from "../../plate/Person.jsx";
import { Stamp, StatusTag } from "../../plate/Marks.jsx";
import NotificationsLamp from "../../plate/drawings/NotificationsLamp.jsx";

const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
/** The server's base64url public key → the Uint8Array pushManager.subscribe wants. */
function keyBytes(b64u) {
  const s = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64u.length % 4)) % 4));
  return Uint8Array.from(s, (ch) => ch.charCodeAt(0));
}
async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** A plate switch: a 44 × 26 box with its knob (no capsule, D60), role="switch". */
export function PlateSwitch({ on, onChange, label, disabled = false, ...rest }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} disabled={disabled} className="pl-pp-switch"
      data-on={on ? "" : undefined} onClick={() => onChange?.(!on)} {...rest}><span aria-hidden="true" /></button>
  );
}

const MATCH_MODES = [["digest", "Daily digest"], ["instant", "As they arrive"], ["off", "Off"]];
function MatchAlertChoice({ say }) {
  const [s, setS] = useState(null);
  useEffect(() => { api("/api/alerts/matches/settings").then(setS).catch(() => setS(null)); }, []);
  if (!s) return null;
  const save = async (patch) => {
    try { setS(await api("/api/alerts/matches/settings", { method: "PUT", body: JSON.stringify({ ...patch, tzOffsetMin: new Date().getTimezoneOffset() }) })); }
    catch (e) { say(e.message || "Could not save that."); }
  };
  return (
    <div className="pl-settings__row" data-match-alerts="">
      <div className="pl-settings__label"><b>New jobs that fit you</b>
        <span className="pl-settings__note">Only postings that ask for most of your résumé's top skills, still open, from employers that look like they are hiring. At most {s.dailyCap} a day.</span></div>
      <div className="pl-settings__control">
        <select className="pl-q-select" data-match-alert-mode="" aria-label="New jobs that fit you" value={s.mode} onChange={(e) => save({ mode: e.target.value })}>
          {MATCH_MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {s.mode === "digest" ? (
          <select className="pl-q-select" data-match-alert-hour="" aria-label="Digest hour" value={s.hour} onChange={(e) => save({ hour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>)}
          </select>
        ) : null}
      </div>
    </div>
  );
}

export function PassportNotifications() {
  const [state, setState] = useState(null);
  const [here, setHere] = useState(false);   // this browser has a live subscription
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState("");
  const say = (t) => setLine(t);
  const load = useCallback(async () => {
    try { setState(await api("/api/notify/settings")); } catch { setState({ error: true }); }
    try { setHere(!!(await currentSubscription())); } catch { setHere(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!state) return <SettingsSheet state="loading" />;
  if (state.error) return <SettingsSheet state="error" errorText="This setting is unavailable right now." onRetry={load} />;
  const pushOffered = state.push?.offered && pushSupported();
  const emailOffered = !!state.email?.offered;
  const setPref = async (ev, channel, on) => {
    try {
      setState(await api("/api/notify/prefs", { method: "PUT", body: JSON.stringify({ event: ev.key, channel, on }) }));
      const other = channel === "push" ? "email" : "push";
      const otherOn = channel === "push" ? ev.email : ev.push;
      say(`${ev.label}: ${channel} ${on ? "on" : "off"}${(other === "push" ? pushOffered : emailOffered) ? `, ${other} ${otherOn ? "on" : "off"}` : ""}.`);
    } catch (e) { say(e.message || "Could not save that."); }
  };
  // Turning push on asks the browser's own permission from THIS press, registers the service worker, subscribes with the
  // server's key and hands the subscription to draft. Off unsubscribes here and tells draft.
  const setHerePush = async (on) => {
    setBusy(true);
    try {
      if (on) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { say("Your browser is blocking notifications for draft. Allow them in the site settings, then try again."); return; }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription())
          || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(state.push.publicKey) });
        setState(await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) }));
        setHere(true);
        say("Notifications are on for this browser.");
      } else {
        const sub = await currentSubscription();
        if (sub) {
          await api("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) }).then(setState).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
        setHere(false);
        say("Notifications are off for this browser.");
      }
    } catch (e) { say(e.message || "Could not change notifications for this browser."); }
    finally { setBusy(false); }
  };
  const cols = [pushOffered && "push", emailOffered && "email"].filter(Boolean);
  return (
    <SettingsSheet kicker="YOUR PASSPORT · MORE · NOTIFICATIONS" title="Notifications" drawing={<span className="pl-pp-lamp"><NotificationsLamp label="A signal lamp, the notifications emblem" /></span>}
      lead="The bell at the top of draft always shows these. Choose which also reach you outside draft. Notifications never name a company or show your answers — only what happened.">
      {!pushOffered && !emailOffered ? <p className="pl-pp-note" data-notify-none="">Push and email notifications are not switched on for draft yet.</p> : null}
      {pushOffered && !here ? (
        <div className="pl-pp-callout" data-notify-here="">
          <span>Push is off on this browser, so interview reminders only reach you by {emailOffered ? "email" : "the bell"}.</span>
          <button type="button" className="pl-btn pl-btn--primary" disabled={busy} onClick={() => setHerePush(true)}>Turn on push</button>
        </div>
      ) : pushOffered ? (
        <div className="pl-settings__row" data-notify-here="">
          <div className="pl-settings__label"><b>Push notifications on this browser</b>
            <span className="pl-settings__note">{state.push.devices ? `${state.push.devices} browser${state.push.devices === 1 ? "" : "s"} get them` : ""}</span></div>
          <div className="pl-settings__control">
            <PlateSwitch on={here} disabled={busy} label="Push notifications on this browser" onChange={setHerePush} />
            <button type="button" className="pl-btn" disabled={busy} onClick={async () => {
              try { const r = await api("/api/push/test", { method: "POST" }); say(r.sent ? "A test notification was sent." : "No browser took the test notification."); }
              catch (e) { say(e.message || "The test could not be sent."); }
            }}>Send a test notification</button>
          </div>
        </div>
      ) : null}
      {cols.length ? (
        <table className="pl-pp-table" aria-label="Notifications">
          <caption aria-live="polite" data-notify-caption="">{line || "Switch any cell; this line says what changed."}</caption>
          <thead><tr><th scope="col">EVENT</th>{cols.map((c) => <th key={c} scope="col">{c === "push" ? "PUSH" : "EMAIL"}</th>)}</tr></thead>
          <tbody>
            {state.events.map((ev) => (
              <tr key={ev.key}>
                <th scope="row">{ev.label}<span className="pl-settings__note">{ev.what}</span></th>
                {cols.map((c) => (
                  <td key={c}><PlateSwitch on={!!ev[c]} label={`${ev.label} by ${c}`} data-notify-pref={`${ev.key}:${c}`} onChange={(on) => setPref(ev, c, on)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="pl-pp-note" aria-live="polite">{line}</p>}
      <div className="pl-settings__rows"><MatchAlertChoice say={say} /></div>
    </SettingsSheet>
  );
}

const PLAN_LABELS = { BASIC: "Basic", PLUS: "Plus", PRO: "Pro" };
const PLAN_COPY = {
  BASIC: "Your jobs board, today's picks, Applications in Ask me first, and the ATS check.",
  PLUS: "Adds a tailored résumé when you Draft a job.",
  PRO: "Adds the A+ résumé, a deeper rewrite, when you Draft a job.",
};
/** D197 #17′ · Your plan — the in-app Plans page, folded into Settings (the same two calls; the user's modes follow). */
export function PassportPlan({ user, onUserChange }) {
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState("");
  const load = useCallback(() => api("/api/plans").then((d) => {
    setPlan(d);
    if (d?.planTier && d?.applyMode && onUserChange) {
      onUserChange((u) => (u ? ({ ...u, planTier: d.planTier, applyMode: d.applyMode, allowedModes: d.allowedModes || [d.applyMode] }) : u));
    }
  }).catch((e) => setStatus(e.message)), [onUserChange]);
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const request = async (tier) => {
    if (!tier) return;
    setStatus("");
    try { await api("/api/plans/request-upgrade", { method: "POST", body: JSON.stringify({ requestedTier: tier }) }); setStatus("Plan change request sent."); load(); }
    catch (e) { setStatus(e.message); }
  };
  const current = plan?.planTier || user?.planTier || "BASIC";
  const changeOptions = plan?.changeOptions || (plan?.nextPlan ? [plan.nextPlan] : []);
  return (
    <div className="pl-pp-stack" data-your-plan="">
      <p className="pl-body">Current plan: <b>{PLAN_LABELS[current]}</b>. Your plan sets which tools you can use.</p>
      <div className="pl-pp-plans">
        {[current, ...changeOptions].filter(Boolean).map((tier) => (
          <SettingsSheet key={tier} kicker={tier === current ? "YOUR PLAN" : "CHANGE TO"} title={PLAN_LABELS[tier]} lead={PLAN_COPY[tier]}
            drawing={tier === current ? <Stamp tone="lit" rotate={-6} land={false}>ACTIVE</Stamp> : null}
            actions={tier !== current && !plan?.pendingRequest
              ? <button type="button" className="pl-btn pl-btn--ink" onClick={() => request(tier)}>Request {tier === "BASIC" ? "downgrade" : "upgrade"}</button>
              : tier !== current && plan?.pendingRequest?.requested_tier === tier ? <StatusTag kind="held">Request pending</StatusTag> : null} />
        ))}
      </div>
      <p className="pl-pp-note" aria-live="polite">{status}</p>
    </div>
  );
}

// ⭐ T5 (docs/ASSISTANT.md §1): every action Ask draft took — or proposed and you cancelled — and the "improve Atlas"
// switch. The person's own rows only (GET /api/assistant/actions).
export function AssistantPrivacy() {
  const [log, setLog] = useState(null);
  const [improve, setImprove] = useState(null);
  useEffect(() => {
    api("/api/assistant/actions").then((r) => setLog(r.actions || [])).catch(() => setLog([]));
    api("/api/assistant/status").then((r) => setImprove(!!r.improveAtlas)).catch(() => setImprove(null));
  }, []);
  const flip = async () => { try { const r = await api("/api/assistant/settings", { method: "PUT", body: JSON.stringify({ improveAtlas: !improve }) }); setImprove(r.improveAtlas); } catch { /* unchanged */ } };
  return (
    <SettingsSheet kicker="ASK DRAFT" title="What Ask draft did for you" lead="Each one only after you pressed Confirm." data-assistant-privacy=""
      rows={improve === null ? [] : [{ label: "Use my questions to improve Atlas", note: "They are stored without your name or contact details, and never linked to you.",
        control: <PlateSwitch on={improve} label="Use my questions to improve Atlas" onChange={flip} data-assistant-improve="" /> }]}>
      {log?.length === 0 ? <p className="pl-pp-note" data-assistant-log-empty="">Nothing yet.</p> : null}
      {log?.length > 0 ? (
        <ul className="pl-pp-list" data-assistant-log="">
          {log.map((a) => <li key={a.id}>{a.summary || a.tool} — {a.status} · {new Date((a.decided_at || a.proposed_at) * 1000).toLocaleString()}</li>)}
        </ul>
      ) : null}
    </SettingsSheet>
  );
}

// ⭐ D185-7 (45q): the person's own choice — when an application asks how they heard about the job, answer "draft", and
// only for jobs they found on draft (a job they brought in themselves is never credited). Off until they turn it on.
export function CreditDraftChoice() {
  const [on, setOn] = useState(null);
  useEffect(() => { api("/api/profile/credit-draft").then((r) => setOn(!!r.on)).catch(() => setOn(null)); }, []);
  if (on === null) return null;
  const set = async (v) => { try { setOn((await api("/api/profile/credit-draft", { method: "PUT", body: JSON.stringify({ on: v }) })).on); } catch { /* left as it was */ } };
  return (
    <div className="pl-settings__row" data-credit-draft={on ? "on" : "off"}>
      <div className="pl-settings__label"><b>When an application asks <i>How did you hear about us?</i>, answer draft</b>
        <span className="pl-settings__note">Only for jobs you found on draft — never for a job you brought in yourself. Your own saved answer to that question always wins.</span></div>
      <div className="pl-settings__control"><PlateSwitch on={on} label="Answer draft to How did you hear about us?" onChange={set} /></div>
    </div>
  );
}

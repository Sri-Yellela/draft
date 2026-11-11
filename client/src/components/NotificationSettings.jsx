import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import SettingsSection from "./SettingsSection.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// ── Account → Notifications (⭐ D112 item 8) ──────────────────────────────────────────────────────
// Which events reach the person outside draft, and how: a push to this browser (Web Push, VAPID — offered only when the
// server has its three VAPID variables) and/or an email (offered only when the server can send mail). One switch per
// event per channel (D60: a native switch, no capsule). The bell in the top bar always gets every event; these are copies.
// Every rule is the server's (routes/notify.js, services/notify.js); this card asks and shows the answer.

const muted = { color: "var(--color-text-muted)", fontSize: ts(12), lineHeight: 1.5 };
const btnQuiet = { border: `1px solid ${C.BORDER_CONTROL}`, borderRadius: 8, background: "transparent", color: "var(--color-text)",
  padding: "8px 14px", cursor: "pointer", fontWeight: 800, fontSize: ts(12) };

const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The server's base64url public key → the Uint8Array pushManager.subscribe wants. */
function keyBytes(b64u) {
  const s = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64u.length % 4)) % 4));
  return Uint8Array.from(s, ch => ch.charCodeAt(0));
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export default function NotificationSettings({ say }) {
  const [state, setState] = useState(null);
  const [here, setHere] = useState(false);   // this browser has a live subscription
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setState(await api("/api/notify/settings")); } catch { setState({ error: true }); }
    try { setHere(!!(await currentSubscription())); } catch { setHere(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state) return null;
  if (state.error) return <SettingsSection title="Notifications"><div style={muted}>This setting is unavailable right now.</div></SettingsSection>;

  const pushOffered = state.push?.offered && pushSupported();
  const emailOffered = !!state.email?.offered;

  const setPref = async (event, channel, on) => {
    try { setState(await api("/api/notify/prefs", { method: "PUT", body: JSON.stringify({ event, channel, on }) })); }
    catch (e) { say?.("error", e.message || "Could not save that."); }
  };

  // Turning push on asks the browser's own permission from THIS press, registers the service worker, subscribes with the
  // server's key and hands the subscription to draft. Off unsubscribes here and tells draft.
  const setHerePush = async (on) => {
    setBusy(true);
    try {
      if (on) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { say?.("error", "Your browser is blocking notifications for draft. Allow them in the site settings, then try again."); return; }
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription())
          || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(state.push.publicKey) });
        setState(await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) }));
        setHere(true);
        say?.("ok", "Notifications are on for this browser.");
      } else {
        const sub = await currentSubscription();
        if (sub) {
          await api("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) }).then(setState).catch(() => {});
          await sub.unsubscribe().catch(() => {});
        }
        setHere(false);
        say?.("ok", "Notifications are off for this browser.");
      }
    } catch (e) { say?.("error", e.message || "Could not change notifications for this browser."); }
    finally { setBusy(false); }
  };

  if (!pushOffered && !emailOffered) {
    return (
      <SettingsSection title="Notifications" subtitle="Updates arrive in the bell at the top of draft.">
        <div data-notify-none="" style={muted}>Push and email notifications are not switched on for draft yet.</div>
      </SettingsSection>
    );
  }

  const cols = [pushOffered && "push", emailOffered && "email"].filter(Boolean);
  return (
    <SettingsSection title="Notifications" subtitle="The bell at the top of draft always shows these. Choose which also reach you outside draft.">
      {pushOffered && (
        <label data-notify-here="" style={{ display: "flex", gap: 10, alignItems: "center", fontSize: ts(13), cursor: busy ? "wait" : "pointer" }}>
          <input type="checkbox" role="switch" checked={here} aria-checked={here} disabled={busy} onChange={e => setHerePush(e.target.checked)} />
          <span>Push notifications on this browser
            <span style={{ ...muted, marginLeft: 8 }}>{state.push.devices ? `${state.push.devices} browser${state.push.devices === 1 ? "" : "s"} get them` : ""}</span>
          </span>
        </label>
      )}
      <div role="table" aria-label="Notifications" style={{ display: "grid", gridTemplateColumns: `1fr ${cols.map(() => "64px").join(" ")}`, gap: "8px 12px", alignItems: "center", marginTop: 8 }}>
        <div role="columnheader" style={muted}>Event</div>
        {cols.map(c => <div key={c} role="columnheader" style={{ ...muted, textAlign: "center" }}>{c === "push" ? "Push" : "Email"}</div>)}
        {state.events.map(ev => (
          <div key={ev.key} role="row" style={{ display: "contents" }}>
            <div role="cell" style={{ fontSize: ts(13), color: "var(--color-text)" }}>{ev.label}<div style={muted}>{ev.what}</div></div>
            {cols.map(c => (
              <div key={c} role="cell" style={{ textAlign: "center" }}>
                <input type="checkbox" role="switch" data-notify-pref={`${ev.key}:${c}`} checked={!!ev[c]} aria-checked={!!ev[c]}
                  aria-label={`${ev.label} by ${c}`} onChange={e => setPref(ev.key, c, e.target.checked)} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {pushOffered && here && (
        <div style={{ marginTop: 8 }}>
          <button style={btnQuiet} disabled={busy} onClick={async () => {
            try { const r = await api("/api/push/test", { method: "POST" }); say?.(r.sent ? "ok" : "error", r.sent ? "A test notification was sent." : "No browser took the test notification."); }
            catch (e) { say?.("error", e.message || "The test could not be sent."); }
          }}>Send a test notification</button>
        </div>
      )}
      <MatchAlertChoice say={say} />
      <div style={{ ...muted, marginTop: 8 }}>Notifications never name a company or show your answers — only what happened.</div>
    </SettingsSection>
  );
}

// ⭐ D185-2 (45q): how "New jobs that fit you" arrives — a daily digest at the hour chosen (the default), as they arrive
// (at most three messages a day), or off. Either way at most 10 jobs a day. The server holds the rule
// (services/jobs/newMatchAlerts.js); this asks and shows the answer. A native select (D60: no capsule).
const MATCH_MODES = [["digest", "Daily digest"], ["instant", "As they arrive"], ["off", "Off"]];
function MatchAlertChoice({ say }) {
  const [s, setS] = useState(null);
  useEffect(() => { api("/api/alerts/matches/settings").then(setS).catch(() => setS(null)); }, []);
  if (!s) return null;
  const save = async (patch) => {
    try { setS(await api("/api/alerts/matches/settings", { method: "PUT",
      body: JSON.stringify({ ...patch, tzOffsetMin: new Date().getTimezoneOffset() }) })); }
    catch (e) { say?.("error", e.message || "Could not save that."); }
  };
  const label = { fontSize: ts(13), color: "var(--color-text)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
  const sel = { border: `1px solid ${C.BORDER_CONTROL}`, borderRadius: 8, background: "transparent", color: "var(--color-text)", padding: "6px 8px", fontSize: ts(12) };
  return (
    <div data-match-alerts="" style={{ marginTop: 12, display: "grid", gap: 6 }}>
      <label style={label}>New jobs that fit you
        <select style={sel} data-match-alert-mode="" value={s.mode} onChange={e => save({ mode: e.target.value })}>
          {MATCH_MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {s.mode === "digest" && (
          <select style={sel} data-match-alert-hour="" aria-label="Digest hour" value={s.hour} onChange={e => save({ hour: Number(e.target.value) })}>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>)}
          </select>
        )}
      </label>
      <div style={muted}>Only postings that ask for most of your résumé's top skills, still open, from employers that look like they are hiring. At most {s.dailyCap} a day.</div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import SettingsSection from "./SettingsSection.jsx";

// ── Account → Notifications (⭐ D112 item 8) ──────────────────────────────────────────────────────
// Which events reach the person outside draft, and how: a push to this browser (Web Push, VAPID — offered only when the
// server has its three VAPID variables) and/or an email (offered only when the server can send mail). One switch per
// event per channel (D60: a native switch, no capsule). The bell in the top bar always gets every event; these are copies.
// Every rule is the server's (routes/notify.js, services/notify.js); this card asks and shows the answer.

const muted = { color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.5 };
const btnQuiet = { border: `1px solid ${C.BORDER_CONTROL}`, borderRadius: 8, background: "transparent", color: "var(--color-text)",
  padding: "8px 14px", cursor: "pointer", fontWeight: 800, fontSize: 12 };

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
        <label data-notify-here="" style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, cursor: busy ? "wait" : "pointer" }}>
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
            <div role="cell" style={{ fontSize: 13, color: "var(--color-text)" }}>{ev.label}<div style={muted}>{ev.what}</div></div>
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
      <div style={{ ...muted, marginTop: 8 }}>Notifications never name a company or show your answers — only what happened.</div>
    </SettingsSection>
  );
}

// ── D100 · PORTALS — the run bar's drawer (docs/sketches/pipeline-workspace.html, approved 10-30) ──────────────────
// The sign-in portals draft can apply on for the user: sessions they connected (sealed — draft cannot read them) and
// accounts draft's apply worker made for them, each with Remove (the worker destroys the key; an account at the portal
// stays the user's). Creating an account is offered per portal, with its consent said in full, ONLY when the apply
// worker is configured (GET /api/portals `worker`) — nothing is offered that nothing can do.
// Connecting a signed-in session happens from the extension / the Android app (D100 P3), not from this page.
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { Z } from "../styles/zLayers.js";
import "./DraftHouse.css";

// The portals the worker has an account adapter for (apply-worker/lib/accounts.js ADAPTERS).
const ACCOUNT_PORTALS = [{ family: "amazon", host: "amazon.jobs", label: "Amazon Jobs" }];
const STATUS = { active: "Connected", expiring: "Expiring soon", expired: "Expired — reconnect", removed: "Removed",
  requested: "Being created", pending: "Being created", created: "Ready", failed: "Could not be created", stopped: "Waiting for you" };
const when = (sec) => (sec ? new Date(sec * 1000).toLocaleDateString(undefined, { dateStyle: "medium" }) : "");

export default function PortalsDrawer({ open, onClose }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = async () => {
    try { setD(await api("/api/portals")); } catch (e) { setMsg(e.message || "Could not load your portals."); }
  };
  useEffect(() => {
    if (!open) return undefined;
    setMsg(""); load();
    const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;

  const act = async (key, fn, done) => {
    setBusy(key); setMsg("");
    try { await fn(); if (done) setMsg(done); await load(); }
    catch (e) { setMsg(e.message || "That did not work — nothing changed."); }
    finally { setBusy(null); }
  };
  const live = (d?.portals || []).filter(p => p.status !== "removed");
  const accounts = (d?.accounts || []).filter(a => a.status !== "removed");
  const hasAccount = (family) => accounts.some(a => a.portalFamily === family);

  return (
    <>
      <div className="dh-scrim" style={{ zIndex: Z.MODAL_SCRIM }} onClick={onClose} aria-hidden="true" />
      <aside className="dh-drawer" style={{ zIndex: Z.MODAL }} role="dialog" aria-modal="true" aria-labelledby="dh-portals-title" data-portals-drawer="">
        <header className="dh-drawer__head">
          <h2 id="dh-portals-title">Portals</h2>
          <button type="button" className="dh-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {!d ? <p className="dh-drawer__msg" role="status">{msg || "Loading…"}</p> : (
          <div className="dh-drawer__body">
            <div className="dh-set">
              <span className="dh-set__lab">Connected portals</span>
              {live.length === 0 ? <span className="dh-set__hint">None yet. Connect a portal from the draft extension or app while you are signed in to it — draft stores the session sealed and cannot read it.</span>
                : live.map(p => (
                  <div key={p.id} className="dh-sw" data-portal={p.id}>
                    <span style={{ flex: 1 }}>{p.originHost}<span className="dh-set__hint"> · {STATUS[p.status] || p.status}{p.lastUsedAt ? ` · last used ${when(p.lastUsedAt)}` : ""}</span></span>
                    <button type="button" className="dh-btn" disabled={busy === `p${p.id}`}
                      onClick={() => act(`p${p.id}`, () => api(`/api/portals/${p.id}`, { method: "DELETE" }), "Removed — its key is destroyed.")}>Remove</button>
                  </div>
                ))}
            </div>

            <div className="dh-set">
              <span className="dh-set__lab">Accounts draft made for you</span>
              {accounts.length === 0 ? <span className="dh-set__hint">None.</span> : accounts.map(a => (
                <div key={a.id} className="dh-sw" data-portal-account={a.id}>
                  <span style={{ flex: 1 }}>{a.originHost}<span className="dh-set__hint"> · {STATUS[a.status] || a.status}{a.lastStop ? ` · ${a.lastStop}` : ""}</span></span>
                  <button type="button" className="dh-btn" disabled={busy === `a${a.id}`}
                    onClick={() => act(`a${a.id}`, () => api(`/api/portals/accounts/${a.id}`, { method: "DELETE" }),
                      "Removed from draft. The account at the portal stays yours — use its “forgot password” to sign in.")}>Remove</button>
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
                {ACCOUNT_PORTALS.every(p => hasAccount(p.family)) && <span className="dh-set__hint">Every portal draft can make an account on is set up.</span>}
              </div>
            ) : (
              <div className="dh-set"><span className="dh-set__hint" data-portal-worker-off="">Applying on sign-in portals for you is not switched on yet. Those applications wait in Needs you for you to finish.</span></div>
            )}
            {msg && <p className="dh-drawer__msg" role="status">{msg}</p>}
          </div>
        )}
        <footer className="dh-drawer__foot">
          <button type="button" className="dh-btn" data-kind="primary" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </>
  );
}

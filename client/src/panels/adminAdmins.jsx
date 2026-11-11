// ⛔ D95 · ADMIN → SYSTEM → ADMINS — the admin ACCOUNTS (never users): who they are, add one, disable one, last sign-in.
//
// Owner only (the server refuses everyone else). No password is ever shown: a new admin gets a one-time link by
// email and sets their own. The last enabled owner cannot be disabled, so nobody is locked out. While NO admin
// account exists, the legacy admin may create the first one — an owner — which is how the switch is proved.
// D83's six rules: one purpose sentence · the numbers on open · one main action · history in the audit log ·
// both themes through the tokens · marks, never pills (D60).
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, Mark, row, quiet, sub, callout, field } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const when = (s) => (s ? new Date(s * 1000).toLocaleString() : "never");

export function AdminsTab() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [said, setSaid] = useState(null);
  const [email, setEmail] = useState("");
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disabling, setDisabling] = useState(null);   // { publicId, action: "disable" | "enable", reason }
  const [setting, setSetting] = useState(null);       // { publicId, a, b } — the FIRST password, while setting up

  const load = useCallback(() => { setErr(null); api("/api/admin/admins").then(setD).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true); setSaid(null);
    try {
      const r = await api("/api/admin/admins", { method: "POST", body: JSON.stringify({ email, owner }) });
      setSaid({ ok: true, text: r.linkSent ? `${r.admin.email} was added — a sign-in link is on its way to that address.`
        : r.message ? `${r.admin.email} was added. ${r.message}` : `${r.admin.email} was added. The link email did not go out — send it again below.` });
      setEmail(""); setOwner(false); load();
    } catch (e) { setSaid({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const act = async (publicId, what, body = {}) => {
    setErr(null);
    try {
      const r = await api(`/api/admin/admins/${encodeURIComponent(publicId)}/${what}`, { method: "POST", body: JSON.stringify(body) });
      if (what === "link") setSaid({ ok: !!r.linkSent, text: r.linkSent ? "A new sign-in link is on its way." : (r.message || "The link email did not go out.") });
      if (what === "password") setSaid({ ok: true, text: `Password set for ${r.admin.email}. Sign out, then sign in at /admin/login with that email and password.` });
      setSetting(null);
      setDisabling(null); load();
    } catch (e) { setErr(e.message); }
  };

  if (!d) return <Panel title="Admins" purpose="Loading…" data-admins="">{err && <div style={callout(C.DANGER)}>{err}</div>}</Panel>;
  const enabled = d.admins.filter((a) => !a.disabledAt);
  const numbers = [
    [enabled.length, "admin accounts enabled", enabled.length > 0],
    [enabled.filter((a) => a.isOwner).length, "owners", enabled.some((a) => a.isOwner)],
    [d.admins.filter((a) => a.disabledAt).length, "disabled", true],
  ];
  return (
    <Panel data-admins="" title="Admins"
      purpose="The administrator accounts. An admin is never a user account: it has no profile, résumé, draft, ticket or connected app, and signs in here only."
      code="D95 · admin_accounts (adm_…) · admin_sessions (dft_adm_…, the draft_admin cookie, Path=/api/admin) · one-time links (dft_adml_…, 30 min) · every change in admin_audit_log with its actor"
      numbers={numbers}>
      {d.settingUp && !d.emailReady && (
        <div data-admins-no-email="" style={{ ...callout(C.WARNING), marginBottom: 12 }}>
          Email is not set up on this server (<code>RESEND_API_KEY</code>), so no sign-in link can be sent. While no admin account has a
          password yet, set it here with <b>Set the password…</b> — then sign in at /admin/login with that email.
        </div>
      )}
      {d.bootstrap && (
        <div style={{ ...callout(C.INFO), marginBottom: 12 }}>
          No admin account exists yet. The first one you add is an <b>owner</b>. Use an email that no user account uses — a person who is both has two accounts.
        </div>
      )}
      <div style={{ ...sub, marginBottom: 14 }}>
        <div style={row}>
          <input aria-label="The new admin account's email" placeholder="admin email (not a user account's)" value={email} type="email"
            onChange={(e) => setEmail(e.target.value)} style={{ ...field, flex: "1 1 260px" }} />
          {!d.bootstrap && (
            <label style={{ fontSize: ts(12), display: "flex", gap: 6, alignItems: "center", color: C.INK }}>
              <input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} /> owner (can manage admins)
            </label>
          )}
          <DepthButton primary disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={add} data-admin-add="">Add and send a sign-in link</DepthButton>
        </div>
        <p style={{ ...quiet, margin: "8px 0 0" }}>The link works once, for 30 minutes, and sets that admin's own password. No password is ever shown here.</p>
        {said && <div role="status" style={{ ...callout(said.ok ? C.SUCCESS : C.DANGER), marginTop: 8 }}>{said.text}</div>}
      </div>
      {err && <div style={{ ...callout(C.DANGER), marginBottom: 10 }}>{err}</div>}
      {d.admins.length === 0 ? <p style={quiet}>No admin accounts yet.</p> : (
        <div style={{ display: "grid", gap: 6 }}>
          {d.admins.map((a) => (
            <div key={a.publicId} data-admin-row={a.publicId} style={{ ...sub, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 220px", fontSize: ts(13), color: C.INK, overflowWrap: "anywhere" }}>
                {a.email} <span style={quiet}>· {a.publicId}{d.you === a.publicId ? " · you" : ""}</span>
              </span>
              {a.isOwner && <Mark tone={C.INFO}>owner</Mark>}
              {a.disabledAt ? <Mark tone={C.DANGER}>disabled</Mark> : <Mark tone={C.SUCCESS}>enabled</Mark>}
              {!a.passwordSet && !a.disabledAt && <Mark tone={C.WARNING}>no password yet</Mark>}
              <span style={quiet}>last sign-in {when(a.lastSignInAt)}</span>
              {setting?.publicId === a.publicId ? (
                <span style={{ ...row, flexBasis: "100%" }} data-admin-set-first="">
                  <input type="password" autoComplete="new-password" aria-label={`New password for ${a.email}`} placeholder="New password (12 characters or more)" autoFocus
                    value={setting.a} onChange={(e) => setSetting({ ...setting, a: e.target.value })} style={{ ...field, flex: "1 1 200px" }} />
                  <input type="password" autoComplete="new-password" aria-label="The same again" placeholder="The same again"
                    value={setting.b} onChange={(e) => setSetting({ ...setting, b: e.target.value })} style={{ ...field, flex: "1 1 160px" }} />
                  <DepthButton size="compact" primary disabled={setting.a.length < 12 || setting.a !== setting.b}
                    onClick={() => act(a.publicId, "password", { password: setting.a })}>Set the password</DepthButton>
                  <DepthButton size="compact" onClick={() => setSetting(null)}>Cancel</DepthButton>
                </span>
              ) : disabling?.publicId === a.publicId ? (
                <span style={{ ...row, flexBasis: "100%" }}>
                  <input aria-label={`Why ${disabling.action} ${a.email}?`} placeholder="Why? (required — it is in the audit log)" autoFocus value={disabling.reason}
                    onChange={(e) => setDisabling({ ...disabling, reason: e.target.value })} style={{ ...field, flex: "1 1 240px" }} />
                  <DepthButton size="compact" primary disabled={disabling.reason.trim().length < 3}
                    onClick={() => act(a.publicId, disabling.action, { reason: disabling.reason })}>{disabling.action === "disable" ? "Disable — ends every session" : "Enable"}</DepthButton>
                  <DepthButton size="compact" onClick={() => setDisabling(null)}>Cancel</DepthButton>
                </span>
              ) : a.disabledAt ? (
                <DepthButton size="compact" onClick={() => setDisabling({ publicId: a.publicId, action: "enable", reason: "" })}>Enable…</DepthButton>
              ) : (
                <>
                  {d.settingUp && !a.passwordSet && <DepthButton size="compact" primary onClick={() => setSetting({ publicId: a.publicId, a: "", b: "" })}>Set the password…</DepthButton>}
                  <DepthButton size="compact" onClick={() => act(a.publicId, "link")}>Send a sign-in link</DepthButton>
                  {d.you !== a.publicId && <DepthButton size="compact" onClick={() => setDisabling({ publicId: a.publicId, action: "disable", reason: "" })}>Disable…</DepthButton>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

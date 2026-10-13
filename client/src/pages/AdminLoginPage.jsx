// client/src/pages/AdminLoginPage.jsx
//
// ⛔ D95 · THE ADMIN'S OWN SIGN-IN. An admin is an admin ACCOUNT — its own email, its own password, its own session
// (the draft_admin cookie, readable only by /api/admin) — and never a user account. Signing in here never signs this
// browser in as a person, so the extension, a connector's consent screen and the app never see an admin.
//
// While the switch (ADMIN_ACCOUNTS_ENFORCE) is off, the OLD path — the legacy admin users row — stays available
// below, marked as retiring, so the owner can prove the new one first.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, setAuthContext } from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { StampLogo } from "../components/StampLogo.jsx";

function useInputStyle() {
  const { theme } = useTheme();
  return {
    width:"100%", height:42, padding:"0 14px",
    borderRadius:10, border:`1px solid ${theme.border}`,
    background:theme.surface, color:theme.text,
    fontFamily:"'DM Sans',system-ui", fontSize:13,
    outline:"none", boxSizing:"border-box",
    transition:"border-color 0.15s",
  };
}

function AdminCard({ subtitle, children }) {
  const { theme } = useTheme();
  return (
    <div style={{
      minHeight:"100vh", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:theme.bg, fontFamily:"'DM Sans',system-ui,sans-serif",
      padding:24,
    }}>
      <div style={{
        width:"100%", maxWidth:380,
        background:theme.surface, borderRadius:24,
        padding:"36px 32px", boxShadow:theme.shadowXl,
        border:`1px solid ${theme.border}`,
      }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔒</div>
          <StampLogo size="md" />
          <div style={{ fontSize:11, color:theme.textMuted, marginTop:4, fontWeight:700,
                        textTransform:"uppercase", letterSpacing:"0.1em" }}>
            {subtitle}
          </div>
        </div>
        {children}
        <div style={{ textAlign:"center", marginTop:20 }}>
          <Link to="/login"
            style={{ fontSize:12, color:theme.textMuted, textDecoration:"none",
                     transition:"color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.color = theme.text}
            onMouseLeave={e => e.currentTarget.style.color = theme.textMuted}>
            ← Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}

function Note({ tone = "danger", children }) {
  const { theme } = useTheme();
  return (
    <div role={tone === "danger" ? "alert" : "status"} style={{ fontSize:12, color: tone === "danger" ? theme.danger : theme.text, padding:"8px 12px",
                  background:theme.surfaceHigh, borderRadius:8,
                  border:`1px solid ${tone === "danger" ? theme.dangerMuted : theme.border}`,
                  lineHeight:1.5 }}>
      {children}
    </div>
  );
}

function PrimaryButton({ loading, children, ...rest }) {
  const { theme } = useTheme();
  return (
    <button className="dbx-depth" type="submit" disabled={loading} {...rest}
      style={{ width:"100%", padding:"12px 0", border:"none",
               background:theme.gradAccent, color:"var(--c-on-accent)", fontWeight:800,
               fontSize:14, cursor:"pointer", marginTop:4,
               opacity:loading?0.7:1, transition:"opacity 0.2s" }}>
      {children}
    </button>
  );
}

function QuietButton({ children, ...rest }) {
  const { theme } = useTheme();
  return (
    <button className="dbx-depth" type="button" {...rest}
      style={{ background:"transparent", border:`1px solid ${theme.border}`, color:theme.textMuted,
               padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',system-ui" }}>
      {children}
    </button>
  );
}

/**
 * @param {{ onAdminLogin(admin), onLegacyLogin(user), session }} p
 *   session — GET /api/admin/auth/me: { enforced, legacyAvailable, breakGlassAvailable }
 */
export default function AdminLoginPage({ onAdminLogin, onLegacyLogin, session }) {
  const { theme } = useTheme();
  const inputStyle = useInputStyle();
  const [form,    setForm]    = useState({ email:"", password:"" });
  const [error,   setError]   = useState("");
  const [said,    setSaid]    = useState("");
  const [loading, setLoading] = useState(false);
  const [mode,    setMode]    = useState("password");   // password | breakglass | legacy
  const [glass,   setGlass]   = useState("");
  const [legacy,  setLegacy]  = useState({ username:"", password:"" });

  const signIn = async e => {
    e.preventDefault(); setError(""); setSaid(""); setLoading(true);
    try {
      const d = mode === "breakglass"
        ? await api("/api/admin/auth/break-glass", { method:"POST", body:JSON.stringify({ email:form.email, passphrase:glass }) })
        : await api("/api/admin/auth/login", { method:"POST", body:JSON.stringify({ email:form.email, password:form.password }) });
      if (d.admin) onAdminLogin(d.admin);
      else setError(d.error || "Sign-in failed.");
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  const askLink = async () => {
    setError(""); setSaid("");
    if (!form.email.trim()) { setError("Type the admin account's email first."); return; }
    try { const d = await api("/api/admin/auth/link", { method:"POST", body:JSON.stringify({ email:form.email }) }); setSaid(d.said); }
    catch(err) { setError(err.message); }
  };

  // The OLD path, while the switch is off: the legacy admin users row through the user sign-in.
  const legacySignIn = async e => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const d = await api("/api/auth/login", { method:"POST", body:JSON.stringify(legacy) });
      if (d.user?.isAdmin) { setAuthContext(d.authContext); onLegacyLogin(d.user); }
      else if (d.user) setError("That is not an admin. Use the main sign-in page.");
      else setError(d.error || "Login failed");
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <AdminCard subtitle="Admin Access">
      {mode !== "legacy" ? (
        <form onSubmit={signIn} style={{ display:"flex", flexDirection:"column", gap:12 }} data-admin-signin="">
          <input style={inputStyle} placeholder="Admin email" type="email" autoComplete="username" value={form.email}
            onChange={e => setForm(f => ({ ...f, email:e.target.value }))} autoFocus/>
          {mode === "password" ? (
            <input style={inputStyle} placeholder="Password" type="password" autoComplete="current-password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password:e.target.value }))}/>
          ) : (
            <input style={inputStyle} placeholder="Break-glass passphrase" type="password" autoComplete="off" value={glass}
              onChange={e => setGlass(e.target.value)}/>
          )}
          {error && <Note>{error}</Note>}
          {said && <Note tone="info">{said}</Note>}
          <PrimaryButton loading={loading}>{loading ? "Signing in…" : mode === "breakglass" ? "Use the passphrase →" : "Sign In →"}</PrimaryButton>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
            <QuietButton onClick={askLink} data-admin-link="">Email me a sign-in link</QuietButton>
            {session?.breakGlassAvailable && (
              <QuietButton onClick={() => { setMode(m => m === "breakglass" ? "password" : "breakglass"); setError(""); }}>
                {mode === "breakglass" ? "Use a password" : "Locked out?"}
              </QuietButton>
            )}
          </div>
          <div style={{ fontSize:11.5, color:theme.textMuted, lineHeight:1.5, textAlign:"center" }}>
            An admin account is not a user account. Signing in here never signs this browser in as a person.
          </div>
        </form>
      ) : (
        <form onSubmit={legacySignIn} style={{ display:"flex", flexDirection:"column", gap:12 }} data-admin-legacy="">
          <Note tone="info">The old admin sign-in retires when admin accounts are switched on.</Note>
          <input style={inputStyle} placeholder="Username or email" value={legacy.username}
            onChange={e => setLegacy(f => ({ ...f, username:e.target.value }))} autoFocus/>
          <input style={inputStyle} placeholder="Password" type="password" value={legacy.password}
            onChange={e => setLegacy(f => ({ ...f, password:e.target.value }))}/>
          {error && <Note>{error}</Note>}
          <PrimaryButton loading={loading}>{loading ? "Signing in…" : "Sign In (old) →"}</PrimaryButton>
        </form>
      )}
      {session?.legacyAvailable && (
        <div style={{ textAlign:"center", marginTop:14 }}>
          <QuietButton onClick={() => { setMode(m => m === "legacy" ? "password" : "legacy"); setError(""); }}>
            {mode === "legacy" ? "← Admin account sign-in" : "Old admin sign-in (retiring)"}
          </QuietButton>
        </div>
      )}
    </AdminCard>
  );
}

/** /admin/set-password?token=dft_adml_… — the one-time link: set the admin password, and be signed in. */
export function AdminSetPasswordPage({ onAdminLogin }) {
  const inputStyle = useInputStyle();
  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") || "" : "";
  const [pw, setPw] = useState({ a:"", b:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    // the secret leaves the address bar at once; it is still in this page's memory for the POST
    if (token && typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
  }, [token]);

  const submit = async e => {
    e.preventDefault(); setError("");
    if (pw.a.length < 12) { setError("An admin password is at least 12 characters."); return; }
    if (pw.a !== pw.b) { setError("The two passwords differ."); return; }
    setLoading(true);
    try {
      const d = await api("/api/admin/auth/set-password", { method:"POST", body:JSON.stringify({ token, password:pw.a }) });
      if (d.admin) onAdminLogin(d.admin); else setError(d.error || "This link is not valid any more.");
    } catch(err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <AdminCard subtitle="Set your admin password">
      {!token ? <Note>This page needs the link from your email. Ask for a new one on the admin sign-in page.</Note> : (
        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:12 }} data-admin-set-password="">
          <input style={inputStyle} placeholder="New password (12 characters or more)" type="password" autoComplete="new-password"
            value={pw.a} onChange={e => setPw(p => ({ ...p, a:e.target.value }))} autoFocus/>
          <input style={inputStyle} placeholder="The same again" type="password" autoComplete="new-password"
            value={pw.b} onChange={e => setPw(p => ({ ...p, b:e.target.value }))}/>
          {error && <Note>{error}</Note>}
          <PrimaryButton loading={loading}>{loading ? "Saving…" : "Set the password and sign in →"}</PrimaryButton>
        </form>
      )}
    </AdminCard>
  );
}

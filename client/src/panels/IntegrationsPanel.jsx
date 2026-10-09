import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { BRAND } from "../../../shared/brand.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import SettingsSection from "../components/SettingsSection.jsx";

function StatusPill({ status, healthy, theme }) {
  const color = healthy ? C.SUCCESS : status === "missing" || status === "not_connected" ? C.DANGER : C.WARNING;
  return (
    <span style={markStyle(color)}>
      {healthy ? "Active" : String(status || "pending").replace(/_/g, " ")}
    </span>
  );
}

/**
 * A real switch, not a button labelled "Turn on".
 *
 * This is a consent control: it decides whether we may report anything from a page the user reached
 * through their own login. It should read as a setting with a current state, and be operable and
 * announced as one — hence role="switch" and aria-checked rather than a styled div.
 */
function ConsentSwitch({ checked, disabled, onChange, label }) {
  return (
    <button className="dbx-depth"
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position:"relative", width:44, height:24, flex:"none", padding:0,
        cursor: disabled ? "wait" : "pointer",
        border:`1px solid ${checked ? C.SUCCESS : "var(--color-border)"}`,
        background: checked ? C.SUCCESS : "var(--color-surface-offset)",
        opacity: disabled ? 0.6 : 1, transition:"background .15s, border-color .15s",
      }}>
      <span style={{
        position:"absolute", top:2, left: checked ? 22 : 2, width:18, height:18, borderRadius:999,
        background:C.SURFACE_SOLID, boxShadow:C.SHADOW_SM, transition:"left .15s",
      }}/>
    </button>
  );
}

// A93: the section card is components/SettingsSection.jsx (Account draws the same one); the connection
// status rides in its `aside`.
function Section({ title, subtitle, status, children, theme }) {
  const resolvedStatus = status || { healthy: false, status: "missing" };
  return (
    <SettingsSection title={title} subtitle={subtitle}
      aside={<StatusPill theme={theme} status={resolvedStatus.status} healthy={resolvedStatus.healthy}/>}>
      {children}
    </SettingsSection>
  );
}

// ⭐ D86 · CONNECTED APPS — the one persistent home for writing résumés in the user's own ChatGPT or Claude.
// Sign-in runs the other way from "Sign in with OpenAI": the user adds draft INSIDE the host, and the host
// sends them to draft's own consent screen. So this page controls and SHOWS the connection; it cannot make it.
const BYOM_STEPS = {
  claude: (url) => ["In Claude, open Settings → Connectors and choose Add custom connector.", `Paste the plugin link: ${url}`,
    "Claude sends you to draft to sign in and choose Allow."],
  chatgpt: (url) => ["In ChatGPT, open Settings → Apps → Advanced settings and turn on Developer mode (today: Business, Enterprise or Edu workspaces only).",
    `Create an app with the plugin link: ${url}`, "ChatGPT sends you to draft to sign in and choose Allow."],
};
const BYOM_OPEN = { claude: "https://claude.ai/settings/connectors", chatgpt: "https://chatgpt.com/" };
const ACTIVITY_WORDS = {
  get_generation_brief: "read your base résumé for a job", submit_resume: "saved a résumé", score_resume: "scored a résumé",
  list_my_drafts: "listed your drafted jobs", get_my_resumes: "listed your résumés", connect: "was connected", disconnect: "was disconnected",
};
function activityLine(a) {
  const who = a.host === "claude" ? "Claude" : a.host === "chatgpt" ? "ChatGPT" : "An app";
  const what = ACTIVITY_WORDS[a.tool] || a.tool;
  if (a.outcome === "ok") return `${who} ${what}`;
  if (a.outcome === "refused") return a.tool === "submit_resume" ? `${who}'s résumé was refused — nothing was saved` : `${who} was refused (${what})`;
  if (a.outcome === "denied") return `${who} was stopped — switched off or not allowed`;
  return `${who}: draft failed on its side — nothing was saved`;
}

function ConnectedApps({ theme, buttonStyle, secondaryButton }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = () => api("/api/byom").then(setS).catch(() => setS({ error: true }));
  useEffect(() => { load(); }, []);
  if (!s) return null;
  const unavailable = s.error || !s.available;
  const setOn = async (next) => {
    setBusy(true);
    try { await api("/api/byom", { method: "PUT", body: JSON.stringify({ enabled: next }) }); await load(); }
    catch (e) { setNote(e.message || "Could not save that setting."); }
    finally { setBusy(false); }
  };
  const disconnect = async (id) => {
    await api(`/api/byom/connections/${id}`, { method: "DELETE" });
    setNote("Disconnected. Its next call is refused.");
    load();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(s.connectorUrl); setNote("Plugin link copied."); }
    catch { setNote(`Copy this link: ${s.connectorUrl}`); }
  };
  const box = { background:"var(--color-surface-offset)", borderRadius:6, padding:"10px 12px", minWidth:150 };
  return (
    <Section theme={theme} title="Connected apps"
      subtitle="Write your résumés in your own ChatGPT or Claude — draft checks and saves what they write, and makes no model call itself."
      status={unavailable ? { healthy:false, status:"unavailable" } : { healthy: s.enabled, status: s.enabled ? "on" : "off" }}>
      {unavailable ? (
        <div style={{ fontSize:12, color:"var(--color-text-muted)" }} data-byom-unavailable="">
          This is unavailable right now — draft has it switched off. Nothing can connect.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }} data-byom-settings="">
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <ConsentSwitch checked={s.enabled} disabled={busy} onChange={setOn} label="Write my résumés in ChatGPT or Claude" />
            <strong style={{ fontSize:13, color:"var(--color-text)" }}>Write my résumés in ChatGPT or Claude</strong>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <div style={box}><div style={{ fontSize:20, fontWeight:800 }}>{s.usedToday} / {s.dailyCap}</div><div style={{ fontSize:11, color:"var(--color-text-muted)" }}>résumés written this way today</div></div>
            <div style={box}><div style={{ fontSize:20, fontWeight:800 }}>{s.connections.length}</div><div style={{ fontSize:11, color:"var(--color-text-muted)" }}>apps connected</div></div>
          </div>
          <div style={{ fontSize:12, color:"var(--color-text-muted)", lineHeight:1.6 }}>
            A connected app can <strong style={{ color:"var(--color-text)" }}>read your base résumé and the skills you have claimed, and save a résumé</strong>;
            it never sees your contact details, your passwords, your applications or your other jobs; and what leaves draft — the
            résumé content and the job's details (title, company, level, location and matched keywords) — is processed <strong style={{ color:"var(--color-text)" }}>under your own account and that provider's terms</strong>.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:10 }}>
            {["chatgpt", "claude"].map(host => {
              const h = s.hosts[host];
              const conns = s.connections.filter(c => c.host === host);
              return (
                <div key={host} style={{ border:"1px solid var(--color-border)", borderRadius:6, padding:12 }} data-byom-host={host}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <strong>{h.label}</strong>
                    <span style={markStyle(!h.enabled ? C.WARNING : conns.length ? C.SUCCESS : C.INK_FAINT)}>
                      {!h.enabled ? "unavailable" : conns.length ? "connected" : "not connected"}
                    </span>
                  </div>
                  {conns.map(c => (
                    <div key={c.id} style={{ fontSize:12, color:"var(--color-text-muted)", marginBottom:8 }}>
                      Last used {c.last_used_at ? new Date(c.last_used_at * 1000).toLocaleString() : "never"} · {c.resumes} résumé{c.resumes === 1 ? "" : "s"}
                      {c.scopes.includes("resume:write") ? "" : " · read only"}
                      <div style={{ marginTop:6 }}><button style={secondaryButton} onClick={() => disconnect(c.id)} title="Stops its next call at once">Disconnect</button></div>
                    </div>
                  ))}
                  {!conns.length && h.enabled && (
                    <div style={{ fontSize:12, color:"var(--color-text-muted)", lineHeight:1.6 }}>
                      <div style={{ fontWeight:700, color:"var(--color-text)" }}>How to connect — you do this in {h.label}, not here</div>
                      <ol style={{ margin:"6px 0 8px", paddingLeft:18 }}>{BYOM_STEPS[host](s.connectorUrl).map(x => <li key={x}>{x}</li>)}</ol>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button style={buttonStyle} onClick={() => window.open(BYOM_OPEN[host], "_blank", "noopener")}>Open {h.label} to connect</button>
                        <button style={secondaryButton} onClick={copy}>Copy the plugin link</button>
                      </div>
                      {s.privateTesting && <div style={{ marginTop:8, color:C.WARNING }} data-byom-private="">In private testing — draft is not yet listed in {h.label}'s directory.</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {note && <div style={{ fontSize:12, color:"var(--color-text)" }} role="status">{note}</div>}
          <div>
            <div style={{ fontSize:12, fontWeight:700, marginBottom:4 }}>Recent activity</div>
            {s.activity.length ? (
              <ul style={{ margin:0, paddingLeft:18, fontSize:12, color:"var(--color-text-muted)" }} data-byom-activity="">
                {s.activity.map((a, i) => <li key={i}>{new Date(a.at * 1000).toLocaleString()} — {activityLine(a)}</li>)}
              </ul>
            ) : <div style={{ fontSize:12, color:"var(--color-text-muted)" }}>Nothing yet.</div>}
          </div>
        </div>
      )}
    </Section>
  );
}

export function IntegrationsPanel() {
  const { theme } = useTheme();
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState("");
  // null while unknown: an un-migrated deployment answers 503 here, and rendering the switch as OFF
  // in that case would be a claim we cannot support — "off" and "we could not ask" are different.
  const [capture, setCapture] = useState(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureError, setCaptureError] = useState("");

  const load = () => api("/api/integrations/status").then(setStatus).catch(e => setMsg(e.message));

  const loadCapture = () => api("/api/apply/form-schema/consent")
    .then(r => { setCapture(!!r.enabled); setCaptureError(""); })
    .catch(() => { setCapture(null); setCaptureError("unavailable"); });

  useEffect(() => { load(); loadCapture(); }, []);

  const setCaptureConsent = async (next) => {
    setCaptureBusy(true);
    // Optimistic, then reconciled against what the server actually stored — this is the only
    // control here whose state is a permission, so it must not appear to be on when it is not.
    setCapture(next);
    try {
      const r = await api("/api/apply/form-schema/consent", {
        method: "POST", body: JSON.stringify({ enabled: next }),
      });
      setCapture(!!r.enabled);
      setCaptureError("");
      setMsg(r.enabled
        ? "Form learning is on. Only the questions a form asks are sent — never your answers."
        : "Form learning is off. Nothing is sent from application pages.");
    } catch (e) {
      await loadCapture();
      setCaptureError(e.message || "Could not save that setting.");
    } finally {
      setCaptureBusy(false);
    }
  };

  const startOAuth = (provider) => {
    const readiness = status?.oauth?.[provider];
    if (readiness && !readiness.configured) {
      setMsg(`${provider === "linkedin" ? "LinkedIn" : "Google"} OAuth is not configured by the app operator: ${readiness.missing.join(", ")} missing.`);
      return;
    }
    if (provider === "linkedin") {
      window.location.href = "/auth/linkedin";
      return;
    }
    window.location.href = `/api/auth/oauth/${provider}/start?mode=link&returnTo=${encodeURIComponent("/app/integrations")}`;
  };

  const disconnectProvider = async (provider) => {
    await api(`/api/integrations/${provider}`, { method:"DELETE" });
    setMsg(`${provider === "gmail" ? "Gmail" : provider === "linkedin" ? "LinkedIn" : "Google"} disconnected.`);
    load();
  };

  const buttonStyle = { border:"none", borderRadius:6, background:"var(--color-primary)", color:C.ON_ACCENT,
    padding:"8px 12px", cursor:"pointer", fontWeight:800, fontSize:12 };
  const secondaryButton = { ...buttonStyle, background:"var(--color-surface-offset)", color:"var(--color-text)", border:`1px solid ${"var(--color-border)"}` };
  const oauthSectionStatus = (provider, userStatus) => {
    const operator = status?.oauth?.[provider];
    if (operator && !operator.configured) return { healthy:false, status:operator.status || "not_configured" };
    return userStatus;
  };
  const oauthHelp = (provider) => {
    const operator = status?.oauth?.[provider];
    if (!operator) return null;
    if (!operator.configured) return `${provider === "linkedin" ? "LinkedIn" : "Google"} OAuth is not configured: ${operator.missing.join(", ")} missing.`;
    if (operator.warnings?.length) return `Configured with warnings: ${operator.warnings.join(", ")}.`;
    return "OAuth app configuration is ready.";
  };

  if (!status) {
    return <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--color-text-muted)" }}>Loading integrations...</div>;
  }

  return (
    <div style={{ flex:1, overflowY:"auto", background:"var(--color-bg)", padding:"28px 24px 44px" }}>
      <div style={{ maxWidth:980, margin:"0 auto", display:"flex", flexDirection:"column", gap:16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize:28,
            fontWeight: 400, color:"var(--color-text)" }}>
            Integrations
          </div>
          <div style={{ color:"var(--color-text-muted)", fontSize:13, lineHeight:1.6 }}>
            Manage official data providers and profile import connections.
          </div>
        </div>

        {msg && <div style={{ border:`1px solid ${"var(--color-border)"}`, background:"var(--color-surface-offset)",
          color:"var(--color-text)", borderRadius:6, padding:"9px 12px", fontSize:12 }}>{msg}</div>}

        <ConnectedApps theme={theme} buttonStyle={buttonStyle} secondaryButton={secondaryButton} />

        <Section theme={theme} title="LinkedIn Profile Import"
          subtitle="Import your name and email to pre-fill your resume."
          status={oauthSectionStatus("linkedin", status.linkedin)}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={() => startOAuth("linkedin")} disabled={status.oauth?.linkedin?.configured === false} style={buttonStyle}>
              {status.linkedin?.identityLinked ? "Import Again" : "Import from LinkedIn"}
            </button>
            {status.linkedin?.identityLinked && <button onClick={() => disconnectProvider("linkedin")} style={secondaryButton}>Disconnect</button>}
            <span style={{ color:status.oauth?.linkedin?.configured === false ? C.DANGER : "var(--color-text-muted)", fontSize:12 }}>
              {status.linkedin?.identityLinked ? "Profile imported" : oauthHelp("linkedin")}
            </span>
          </div>
        </Section>

        <Section theme={theme} title="Job Feed"
          subtitle="Official API providers for job search results."
          status={{
            healthy: (status.jobSources || []).some(s => s.configured),
            status:  (status.jobSources || []).some(s => s.configured) ? "configured" : "missing",
          }}>
          <div style={{ fontSize:12, color:"var(--color-text-muted)" }}>
            {(status.jobSources || []).some(s => s.configured)
              ? `Job search active — ${(status.jobSources || []).filter(s => s.configured).length} provider(s) configured.`
              : "No job feed providers configured. Contact the app operator."}
          </div>
        </Section>

        {/* The consent control for TASK G4's schema capture. It lives here rather than in the
            profile because it is about what the browser extension may do, not about who the user is.
            The copy states what is sent and what never is — a switch labelled only "form learning"
            would be asking for agreement to something the user cannot evaluate. */}
        <Section theme={theme} title="Form Learning"
          subtitle={`Help ${BRAND} recognise application forms it has seen before.`}
          status={capture === null
            ? { healthy:false, status: captureError ? "unavailable" : "loading" }
            : { healthy: capture, status: capture ? "on" : "off" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <ConsentSwitch
              checked={capture === true}
              disabled={captureBusy || capture === null}
              onChange={setCaptureConsent}
              label="Share the structure of application forms"
            />
            <div style={{ fontSize:12, color:"var(--color-text-muted)", lineHeight:1.6 }}>
              When you use the extension to fill an application — on a page you reached through your
              own sign-in — it can send back{" "}
              <strong style={{ color:"var(--color-text)" }}>the questions that form asks</strong>:
              their wording, their type, the choices in any dropdown, which ones are required, the
              order they appear in, and the form's own internal name for each one. It also records
              which <em>kind</em> of profile field could answer each question — "email", say — never
              the value in yours. The next person applying to that company then gets a form we
              already understand, and fewer questions to answer by hand.
              <div style={{ marginTop:6 }}>
                We never send <strong style={{ color:"var(--color-text)" }}>your answers</strong>,
                anything about you, or anything else on that page. This is off unless you turn it on,
                and you can turn it off at any time.
              </div>
              {capture === null && (
                <div style={{ marginTop:6, color:C.WARNING }}>
                  {captureError
                    ? "This setting is unavailable right now, so it cannot be changed. Nothing is being sent."
                    : "Checking…"}
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section theme={theme} title="Resume and Profile" subtitle="Manual application tracking and resume tools depend on local profile readiness."
          status={{ healthy:status.resume?.healthy && status.profile?.healthy, status:status.resume?.healthy && status.profile?.healthy ? "ready" : "missing_setup" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:10 }}>
            <div style={{ background:"var(--color-surface-offset)", borderRadius:6, padding:10 }}>
              <strong>Base resume</strong><br/><span style={{ color:"var(--color-text-muted)" }}>{status.resume?.name || status.resume?.status}</span>
            </div>
            <div style={{ background:"var(--color-surface-offset)", borderRadius:6, padding:10 }}>
              <strong>Active profile</strong><br/><span style={{ color:"var(--color-text-muted)" }}>{status.profile?.activeProfileName || status.profile?.status}</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

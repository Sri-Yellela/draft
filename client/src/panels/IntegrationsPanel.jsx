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

// ⭐ D86 · CONNECTED APPS — the one persistent home (plugin-ui.html, tab 1). Sign-in runs the other way from
// "Sign in with OpenAI": the user adds draft INSIDE the host, and the host sends them to draft's own consent
// screen. So this page controls and SHOWS the connection; it cannot make it. Everything below the switch is
// dimmed and inert while the switch is off.
const BYOM_OPEN = { claude: "https://claude.ai/settings/connectors", chatgpt: "https://chatgpt.com/" };
const BYOM_TESTER_HOW = {
  claude: "in Claude, Settings → Connectors → Add custom connector, with the plugin link",
  chatgpt: "in ChatGPT, Settings → Apps → developer mode (Business, Enterprise or Edu workspaces only, today), with the plugin link",
};
const ARROW = <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width:14, height:14, fill:"none", stroke:"currentColor", strokeWidth:2, strokeLinecap:"round", strokeLinejoin:"round" }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
const LOCK = <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width:18, height:18, flex:"none", fill:"none", stroke:C.SUCCESS, strokeWidth:2 }}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
function byomAgo(at) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - at);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
const jobOf = (a) => [a.title, a.company].filter(Boolean).join(", ");
/** The sketch's activity row: What, and a Result mark — in words, never résumé content. */
function activityRow(a) {
  const job = jobOf(a);
  const on = job ? ` · ${job}` : "";
  if (a.tool === "draft_submit_resume_patch" && a.outcome === "ok") return { what: `Wrote a résumé${on}`, mark: [C.SUCCESS, `Saved · ${String(a.detail || "").replace("→", " → ")}`] };
  if (a.tool === "draft_submit_resume_patch" && a.outcome === "refused") {
    const why = a.detail === "new_term" ? "a skill not in your résumé" : a.detail === "years_exceed_profile" ? "more years than you stated" : "a check failed";
    return { what: `${a.fixed ? "First try refused" : "Refused"}: ${why}${on}`, mark: a.fixed ? [C.WARNING, "Fixed and resent"] : [C.DANGER, "Refused — nothing saved"] };
  }
  // The server reports each row under the tool's current name (routes/byom.js maps the pre-10-09 names).
  const words = { draft_get_resume_brief: `Read your base résumé${on}`, draft_score_resume_for_job: `Scored your résumé${on}`,
    draft_search_jobs: "Searched your board", draft_get_job: `Read a job${on}`, draft_list_my_drafts: "Listed your drafted jobs",
    draft_list_my_resumes: "Listed your résumés", connect: "Connected", disconnect: "Disconnected" }[a.tool] || a.tool;
  if (a.outcome === "denied") return { what: words, mark: [C.INK_FAINT, "Stopped — switched off"] };
  if (a.outcome === "error") return { what: words, mark: [C.DANGER, "Failed on draft's side"] };
  if (a.outcome === "refused") return { what: words, mark: [C.WARNING, "Refused"] };
  return { what: words, mark: [C.INK_FAINT, "OK"] };
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
  const box = { background:"var(--color-surface-offset)", border:"1px solid var(--color-border)", borderRadius:6, padding:"10px 13px" };
  const num = { display:"block", fontFamily:"var(--font-display)", fontSize:30, lineHeight:1, color:C.ACCENT_INK };
  const dangerButton = { ...secondaryButton, color:C.DANGER };
  return (
    <Section theme={theme} title="Connected apps"
      subtitle="Let ChatGPT or Claude write your résumés using your own subscription. draft keeps the checks and stores the result; the AI provider only does the writing."
      status={unavailable ? { healthy:false, status:"unavailable" } : { healthy: s.enabled, status: s.enabled ? "on" : "off" }}>
      {unavailable ? (
        <div style={{ fontSize:12, color:"var(--color-text-muted)" }} data-byom-unavailable="">
          This is unavailable right now — draft has it switched off. Nothing can connect.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }} data-byom-settings="">
          <div style={{ ...box, display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1 }}>
              <strong style={{ fontSize:14, color:"var(--color-text)" }}>Write my résumés in ChatGPT or Claude</strong>
              <div style={{ fontSize:12, color:"var(--color-text-muted)" }}>Off by default. Turning it on lets you connect an app below — nothing connects by itself.</div>
            </div>
            <ConsentSwitch checked={s.enabled} disabled={busy} onChange={setOn} label="Write my résumés in ChatGPT or Claude" />
          </div>
          <div style={s.enabled ? null : { opacity:.5, pointerEvents:"none" }} aria-disabled={!s.enabled} data-byom-body={s.enabled ? "on" : "off"}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:10, marginBottom:10 }}>
              <div style={box}><b style={num}>{s.usedToday}<small style={{ fontSize:15, color:"var(--color-text-muted)" }}> / {s.dailyCap}</small></b><span style={{ fontSize:11.5, color:"var(--color-text-muted)" }}>résumés written this way today</span></div>
              <div style={box}><b style={num}>{s.connections.length}</b><span style={{ fontSize:11.5, color:"var(--color-text-muted)" }}>apps connected</span></div>
            </div>
            <div style={{ ...box, display:"flex", gap:10, alignItems:"flex-start", fontSize:12.3, lineHeight:1.5, color:"var(--color-text-muted)", marginBottom:10 }}>
              {LOCK}
              <span><strong style={{ color:"var(--color-text)" }}>What an app can do:</strong> read your base résumé and claims, and save a résumé to draft.{" "}
                <strong style={{ color:"var(--color-text)" }}>What it never sees:</strong> your contact details, passwords, applications or other jobs.{" "}
                <strong style={{ color:"var(--color-text)" }}>What leaves draft:</strong> your résumé content and the job's details (title, company, level, location and matched keywords) go to the provider,{" "}
                <strong style={{ color:"var(--color-text)" }}>under your own account and its terms</strong>.</span>
            </div>
            {["chatgpt", "claude"].map(host => {
              const h = s.hosts[host];
              const conn = s.connections.find(c => c.host === host);
              return (
                <div key={host} style={{ border:"1px solid var(--color-border)", borderRadius:6, marginBottom:10, background:"var(--color-surface)" }} data-byom-host={host}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }}>
                    <div aria-hidden="true" style={{ width:44, height:44, borderRadius:6, display:"grid", placeItems:"center", background:C.SURFACE_SOLID,
                      border:"1px solid var(--color-border)", fontFamily:"'Poppins', var(--font-body)", fontStyle:"italic", fontWeight:800, fontSize:17, color:C.INK }}>
                      {host === "chatgpt" ? "G" : "C"}
                    </div>
                    <strong style={{ flex:1, fontSize:15 }}>{h.label}</strong>
                    <span style={markStyle(!h.enabled ? C.WARNING : conn ? C.SUCCESS : C.INK_FAINT)}>{!h.enabled ? "Unavailable" : conn ? "Connected" : "Not connected"}</span>
                  </div>
                  <div style={{ padding:"0 14px 14px 70px", display:"flex", flexDirection:"column", gap:9, fontSize:12.5, color:"var(--color-text-muted)" }}>
                    {!h.enabled ? <div>draft is not accepting connections from {h.label} right now.</div> : conn ? (
                      <>
                        <div>Connected from <strong style={{ color:"var(--color-text)" }}>{h.label}</strong> · last used {conn.last_used_at ? byomAgo(conn.last_used_at) : "never"} · {conn.resumes} résumé{conn.resumes === 1 ? "" : "s"} written{conn.scopes.includes("resume:write") ? "" : " · read only"}.</div>
                        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                          <button style={dangerButton} onClick={() => disconnect(conn.id)}>Disconnect</button>
                          <span style={{ fontSize:11.5 }}>Disconnecting stops its next call at once.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div><strong style={{ color:"var(--color-text)" }}>How to connect — you do this in {h.label}, not here:</strong></div>
                        <ol style={{ margin:0, paddingLeft:18, listStyle:"decimal" }}>
                          <li>Open {h.label} and add the <strong style={{ color:"var(--color-text)" }}>draft</strong> plugin.</li>
                          <li>{h.label} sends you to <strong style={{ color:"var(--color-text)" }}>draft's sign-in and consent screen</strong>.</li>
                          <li>Approve it. This card turns green.</li>
                        </ol>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          <button style={{ ...buttonStyle, display:"inline-flex", alignItems:"center", gap:6 }} onClick={() => window.open(BYOM_OPEN[host], "_blank", "noopener")}>Open {h.label} to connect {ARROW}</button>
                          <button style={secondaryButton} onClick={copy}>Copy the plugin link</button>
                        </div>
                        {s.privateTesting && (
                          <div style={{ fontSize:11.5, color:C.WARNING }} data-byom-private="">
                            ⚠ <strong>In private testing:</strong> the plugin isn't in {h.label}'s public directory yet — the link works for testers only ({BYOM_TESTER_HOW[host]}).
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {note && <div style={{ fontSize:12, color:"var(--color-text)", marginBottom:8 }} role="status">{note}</div>}
            <div style={{ border:"1px solid var(--color-border)", borderRadius:6, padding:"12px 14px", background:"var(--color-surface)" }}>
              <strong style={{ fontSize:14 }}>Recent activity</strong>
              {s.activity.length ? (
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginTop:6 }} data-byom-activity="">
                  <thead><tr>{["When", "App", "What", "Result"].map(x => (
                    <th key={x} style={{ textAlign:"left", padding:"6px 8px", fontSize:11, letterSpacing:".08em", textTransform:"uppercase", color:"var(--color-text-muted)", borderBottom:"1px solid var(--color-border)" }}>{x}</th>
                  ))}</tr></thead>
                  <tbody>{s.activity.map((a, i) => {
                    const r = activityRow(a);
                    return (
                      <tr key={i}>
                        <td style={{ padding:"7px 8px", borderBottom:"1px dashed var(--color-border)", whiteSpace:"nowrap" }}>{byomAgo(a.at)}</td>
                        <td style={{ padding:"7px 8px", borderBottom:"1px dashed var(--color-border)" }}>{a.host === "claude" ? "Claude" : a.host === "chatgpt" ? "ChatGPT" : "A test app"}</td>
                        <td style={{ padding:"7px 8px", borderBottom:"1px dashed var(--color-border)" }}>{r.what}</td>
                        <td style={{ padding:"7px 8px", borderBottom:"1px dashed var(--color-border)" }}><span style={markStyle(r.mark[0])}>{r.mark[1]}</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              ) : <div style={{ fontSize:12, color:"var(--color-text-muted)", marginTop:6 }}>Nothing yet.</div>}
            </div>
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

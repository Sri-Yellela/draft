import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api, authContextQuery, authHeaders, downloadBlob, printResume } from "../lib/api.js";
import { announceAccountChanged, useAccountAvatar } from "../lib/accountAvatar.js";
import { glass } from "../styles/glass.js";
import { C } from "../styles/colorTokens.js";
import ResumeList, { RESUME_ICONS } from "../components/ResumeList.jsx";
import SettingsSection from "../components/SettingsSection.jsx";
import AppearanceSettings from "../components/AppearanceSettings.jsx";

// ── Account (/app/account) ──────────────────────────────────────────────────────────────────────
// Profile and picture, sign-in and security (password, sign-in methods, where you're signed in),
// and your data (export, merge another account in, delete). Every rule lives on the server
// (routes/accountManagement.js); this page only asks and shows the answer.

const PROVIDER_LABEL = { google: "Google", linkedin: "LinkedIn", github: "GitHub" };
const ago = (s) => {
  if (!s) return "";
  const d = Math.max(0, Date.now() / 1000 - s);
  if (d < 90) return "just now";
  if (d < 3600) return `${Math.round(d / 60)} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  return `${Math.round(d / 86400)} days ago`;
};
const oauthUrl = (provider, mode) => {
  const q = new URLSearchParams({ mode, returnTo: "/app/account" }).toString();
  const auth = authContextQuery();
  return `/auth/${provider}?${q}${auth ? `&${auth}` : ""}`;
};

const btn = { border: "none", borderRadius: 8, background: "var(--color-primary)", color: C.ON_ACCENT,
  padding: "8px 14px", cursor: "pointer", fontWeight: 800, fontSize: 12 };
const btnQuiet = { ...btn, background: "transparent", color: "var(--color-text)", border: `1px solid ${C.BORDER_CONTROL}` };
const btnDanger = { ...btn, background: C.DANGER, color: C.ON_ACCENT };
const input = { border: `1px solid ${C.BORDER_CONTROL}`, background: C.SURFACE_INPUT, color: "var(--color-text)",
  borderRadius: 8, padding: "8px 10px", fontSize: 13, minWidth: 0, flex: "1 1 200px" };
const row = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };
const muted = { color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.5 };

/** D73 §B: the user's own marketing consent — the same record the sign-up box and the unsubscribe link write. */
function MarketingSwitch({ say }) {
  const [state, setState] = useState(null);
  useEffect(() => { api("/api/account/marketing").then(setState).catch(() => setState({ error: true })); }, []);
  if (!state) return null;
  if (state.error) return <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>This setting is unavailable right now.</div>;
  const set = async (optIn) => {
    try {
      setState(await api("/api/account/marketing", { method: "PUT", body: JSON.stringify({ optIn }) }));
      say?.("ok", optIn ? "Product news is on." : "Product news is off.");
    } catch (e) { say?.("error", e.message || "Could not save that."); }
  };
  const since = state.optedIn && state.since ? ` — on since ${new Date(state.since * 1000).toLocaleDateString()}` : "";
  return (
    <label data-marketing-switch="" style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={state.optedIn} onChange={e => set(e.target.checked)} />
      <span>Email me product news{since}</span>
    </label>
  );
}

// A93: the section card is components/SettingsSection.jsx — Integrations draws the same one.

function Notice({ kind, children, onClose }) {
  if (!children) return null;
  const color = kind === "error" ? C.DANGER : kind === "ok" ? C.SUCCESS : C.INFO;
  return (
    <div role={kind === "error" ? "alert" : "status"} style={{ border: `1px solid ${color}55`, background: `${color}14`,
      color: "var(--color-text)", borderRadius: 8, padding: "9px 12px", fontSize: 12, display: "flex", gap: 8 }}>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && <button onClick={onClose} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)" }}>×</button>}
    </div>
  );
}

export function AccountPanel({ onSignedOut }) {
  const [account, setAccount] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [notice, setNotice] = useState(null);         // { kind, text }
  const [busy, setBusy] = useState("");
  const { url: avatarUrl } = useAccountAvatar();
  const fileRef = useRef(null);

  const say = (kind, text) => setNotice({ kind, text });
  const load = useCallback(() => api("/api/account").then(setAccount).catch(e => say("error", e.message)), []);
  const loadSessions = useCallback(() => api("/api/account/sessions").then(setSessions).catch(() => {}), []);
  useEffect(() => { load(); loadSessions(); }, [load, loadSessions]);

  // Coming back from Google/LinkedIn/GitHub (link or merge): show what happened, then tidy the URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const err = p.get("oauthError"), status = p.get("oauthStatus"), prov = PROVIDER_LABEL[p.get("oauthProvider")] || "Sign-in";
    if (err) say("error", err);
    else if (status === "merge_ready") say("info", `${prov} confirmed the other account is yours. Review the merge below.`);
    else if (status) say("ok", `${prov} is now linked to this account.`);
    if (err || status) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // One wrapper for every action: busy flag, error shown, account refreshed from the answer.
  const run = async (key, fn, okText) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.account) setAccount(a => ({ ...a, ...r.account }));
      else await load();
      if (okText) say("ok", okText);
      return r;
    } catch (e) {
      say("error", e.message);
      if (e.payload?.error === "reauth_required") await load();
      return null;
    } finally { setBusy(""); }
  };
  const post = (path, body, method = "POST") => api(path, { method, body: body ? JSON.stringify(body) : undefined });

  if (!account) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...muted }}>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : "Loading your account…"}</div>;
  }
  const methods = account.signInMethods || {};
  const methodCount = Object.values(methods).filter(Boolean).length;

  return (
    <div className="rm-account" style={{ flex: 1, overflowY: "auto", padding: "28px 16px 44px" }}>
      {/* A disabled control must LOOK disabled — inline styles cannot reach :disabled. */}
      <style>{".rm-account button:disabled{opacity:.45;cursor:not-allowed}"}</style>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, color: "var(--color-text)" }}>Account</h1>
          <div style={muted}>Your profile, how you sign in, and your data.</div>
        </div>
        {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}

        <ProfileSection account={account} avatarUrl={avatarUrl} fileRef={fileRef} busy={busy} run={run} post={post} />

        {/* D91 P5: Settings → Appearance — the four themes and shape cues, saved to the account. */}
        <div id="appearance"><AppearanceSettings /></div>

        <SettingsSection title="Email" subtitle="Used to sign in and to reset your password.">
          <EmailEditor account={account} busy={busy} run={run} post={post} say={say} />
        </SettingsSection>

        {/* ⭐ D73 §B: product news is opt-in; switching it off here is the same as the email's unsubscribe link. */}
        <SettingsSection title="Product news" subtitle="Occasional email about what's new in draft. Account and policy notices come either way — they are about your account.">
          <MarketingSwitch say={say} />
        </SettingsSection>

        <SettingsSection title="Sign-in & security"
          subtitle={account.recentAuth ? "You signed in recently, so changes below are unlocked."
            : "Some changes ask you to confirm it's you first."}>
          {!account.recentAuth && <ReauthBox account={account} busy={busy} run={run} post={post} methods={methods} />}
          <PasswordEditor account={account} busy={busy} run={run} post={post} />
          <div style={{ borderTop: `1px solid ${C.BORDER}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)" }}>Sign-in methods</div>
            {["google", "linkedin", "github"].map(p => (
              <div key={p} style={{ ...row, justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--color-text)" }}>{PROVIDER_LABEL[p]}
                  <span style={{ ...muted, marginLeft: 8 }}>{methods[p] ? "Connected" : "Not connected"}</span></span>
                {methods[p]
                  ? <button style={btnQuiet} disabled={!!busy || methodCount <= 1}
                      title={methodCount <= 1 ? "Your only way to sign in — set a password or link another first" : ""}
                      onClick={() => run(`unlink-${p}`, () => post(`/api/account/sign-in/${p}`, null, "DELETE"), `${PROVIDER_LABEL[p]} unlinked.`)}>Unlink</button>
                  : <a style={{ ...btnQuiet, textDecoration: "none" }} href={oauthUrl(p, "link")}>Link</a>}
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Where you're signed in" subtitle="Sign out of a browser or app you no longer use.">
          <SessionsList sessions={sessions} busy={busy} run={run} post={post} reload={loadSessions} />
        </SettingsSection>

        <MergeSection account={account} busy={busy} run={run} post={post} say={say} />

        <SettingsSection title="Your data" subtitle="A copy of everything Draft keeps for you, as JSON.">
          <div style={row}>
            <button style={btnQuiet} disabled={!!busy} onClick={() => run("export", async () => {
              const r = await fetch("/api/account/export", { credentials: "include", headers: authHeaders() });
              if (!r.ok) throw new Error("The export could not be made. Try again.");
              await downloadBlob(await r.blob(), `draft-account-${new Date().toISOString().slice(0, 10)}.json`);
              return { account: null };
            }, "Your data was downloaded.")}>Download my data</button>
          </div>
          <BaseResumeOnly />
          <GeneratedResumes busy={busy} run={run} />
        </SettingsSection>

        {/* ⭐ D88 P5: the user's own plan and allowance, read-only. */}
        <AllowanceSection />

        {/* ⭐ D88 P3: contact support, and your requests with their replies. */}
        <HelpSection say={say} />

        <DeleteSection account={account} busy={busy} run={run} post={post} onSignedOut={onSignedOut} />
      </div>
    </div>
  );
}

/**
 * ⭐ D57 · Settings → Your data → Generated résumés — every résumé the user generated, per job: when, and
 * whether it is kept for good (the job was drafted or applied) or a convenience copy that expires
 * ("expires in 40 days"), with download and delete. Deleting frees the job's Résumé button on the board
 * (the server's resume_deleted event).
 */
export function generatedResumeStatus(r) {
  if (r.keptForGood) return r.tie === "applied" ? "Kept — you applied with it" : "Kept — the job is in Draft House";
  if (r.expiresInDays == null) return "";
  return r.expiresInDays <= 0 ? "Expires today" : `Expires in ${r.expiresInDays} day${r.expiresInDays === 1 ? "" : "s"}`;
}

/**
 * ⭐ D66 · "Use my base résumé for applications". On → every application carries the base résumé and
 * no résumé is generated for it (no model call). A plan that forces it says so, and the box is locked.
 */
function BaseResumeOnly() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/settings/base-resume-only").then(setS).catch(() => setS({ error: true })); }, []);
  const toggle = async (on) => {
    setSaving(true); setErr("");
    try { setS(await api("/api/settings/base-resume-only", { method: "PUT", body: JSON.stringify({ on }) })); }
    catch (e) { setErr(e.message || "Could not save that."); }
    finally { setSaving(false); }
  };
  const forced = s?.source === "plan";
  return (
    <div data-base-resume-only="" style={{ borderTop: `1px solid ${C.BORDER}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ ...row, fontWeight: 700, fontSize: 13, color: "var(--color-text)", cursor: forced ? "default" : "pointer" }}>
        <input type="checkbox" checked={!!s?.on} disabled={!s || s.error || saving || forced}
          onChange={(e) => toggle(e.target.checked)} />
        Use my base résumé for applications
      </label>
      <div style={muted}>
        {forced ? "Your plan sends your base résumé with every application."
          : "When this is on, applications carry your base résumé as it is — no résumé is written for each job."}
        {s && !s.error && !s.hasBaseResume ? " You have not added a base résumé yet, so applications would carry none." : ""}
      </div>
      {s?.error && <div style={muted}>This setting could not be loaded just now.</div>}
      {err && <div role="alert" style={{ ...muted, color: C.DANGER }}>{err}</div>}
    </div>
  );
}

function GeneratedResumes({ busy, run }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api("/api/generated-resumes").then(setData).catch(() => setData({ resumes: [], error: true })), []);
  useEffect(() => { load(); }, [load]);
  const list = data?.resumes || [];
  return (
    <div data-generated-resumes="" style={{ borderTop: `1px solid ${C.BORDER}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)" }}>Generated résumés</span>
        <span style={muted} data-generated-count="">{data ? `${list.length} kept` : "Loading…"}</span>
      </div>
      {data && <div style={muted}>A résumé for a job you have not drafted or applied to is kept {data.retentionDays ?? 90} days from when it was generated; once the job is drafted or applied, it is kept for good.</div>}
      {data?.error && <div style={muted}>The list could not be loaded just now.</div>}
      {data && !list.length && !data.error && <div style={muted}>No generated résumés yet — generate one from a job's posting panel.</div>}
      {/* ⭐ D62: the ONE résumé list (ResumeList) — the ATS panel's History is its other home. */}
      {list.length > 0 && (
        <ResumeList showLogo scoreCaption="tailored" rows={list.map(r => ({
          key: r.jobId, company: r.company, title: `${r.company || "Unknown company"}${r.role ? ` — ${r.role}` : ""}`,
          meta: [r.generatedAt ? `Generated ${new Date(r.generatedAt).toLocaleDateString()}` : null, generatedResumeStatus(r)].filter(Boolean).join(" · "),
          score: Number.isFinite(r.atsScore) ? r.atsScore : null,
          actions: [
            { id: "download", label: `Download the résumé for ${r.company || "this job"}`, icon: RESUME_ICONS.download, disabled: !!busy,
              onClick: () => run(`dl-${r.jobId}`, async () => {
                const d = await api(`/api/resumes/${encodeURIComponent(r.jobId)}`);
                printResume(d.html, `Resume_${(r.company || "").replace(/\s+/g, "_")}`);
                return { account: null };
              }) },
            { id: "delete", label: `Delete the résumé for ${r.company || "this job"}`, icon: RESUME_ICONS.remove, disabled: !!busy,
              onClick: async () => {
                if (!window.confirm(`Delete the résumé generated for ${r.company || "this job"}? This can't be undone.`)) return;
                const out = await run(`rm-${r.jobId}`, async () => {
                  await api(`/api/generated-resumes/${encodeURIComponent(r.jobId)}`, { method: "DELETE" });
                  return { account: null };
                }, "Résumé deleted.");
                if (out) load();
              } },
          ],
        }))} />
      )}
    </div>
  );
}

function ProfileSection({ account, avatarUrl, fileRef, busy, run, post }) {
  const [name, setName] = useState(account.displayName || "");
  const initial = (account.displayName || account.username || "?")[0].toUpperCase();
  const upload = (file) => run("avatar", async () => {
    const form = new FormData(); form.append("avatar", file);
    const r = await api("/api/account/avatar", { method: "POST", body: form });
    announceAccountChanged();
    return r;
  }, "Picture updated.");
  return (
    <SettingsSection title="Profile">
      <div style={{ ...row, gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 84, height: 84, borderRadius: "50%", overflow: "hidden", flex: "none",
          background: C.ACCENT, color: C.ON_ACCENT, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 32, boxShadow: C.SHADOW_SM }}>
          {avatarUrl ? <img src={avatarUrl} alt="Your picture" referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}
        </div>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={row}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
            <button style={btnQuiet} disabled={!!busy} onClick={() => fileRef.current?.click()}>
              {busy === "avatar" ? "Uploading…" : account.hasAvatar ? "Change picture" : "Upload picture"}</button>
            {account.hasAvatar && <button style={btnQuiet} disabled={!!busy}
              onClick={() => run("avatar-rm", async () => { const r = await post("/api/account/avatar", null, "DELETE"); announceAccountChanged(); return r; }, "Picture removed.")}>Remove</button>}
          </div>
          <div style={muted}>PNG, JPEG or WebP, up to 2 MB.{!account.hasAvatar && account.providerPicture ? " Until you upload one, your Google picture is shown." : ""}</div>
          <form style={row} onSubmit={e => { e.preventDefault(); run("name", () => post("/api/account/profile", { displayName: name }, "PATCH"), "Name saved."); }}>
            <label style={{ ...muted, width: "100%" }} htmlFor="acct-name">Name</label>
            <input id="acct-name" style={input} value={name} maxLength={120} onChange={e => setName(e.target.value)} />
            <button style={btn} disabled={!!busy || !name.trim() || name.trim() === account.displayName}>Save</button>
          </form>
          <div style={muted}>Username <strong style={{ color: "var(--color-text)" }}>{account.username}</strong> · member since {new Date((account.createdAt || 0) * 1000).toLocaleDateString()}</div>
        </div>
      </div>
    </SettingsSection>
  );
}

function EmailEditor({ account, busy, run, post }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 13, color: "var(--color-text)" }}>{account.email || "No email yet"}
        {account.email && <span style={{ ...muted, marginLeft: 8, color: account.emailVerified ? C.SUCCESS : "var(--color-text-muted)" }}>
          {account.emailVerified ? "Verified" : "Not verified"}</span>}</div>
      {!account.emailConfigured
        ? <div style={muted}>Changing your email needs a code sent by email, which isn't switched on for Draft yet.</div>
        : !sentTo
          ? <form style={row} onSubmit={async e => { e.preventDefault();
              const r = await run("email", () => post("/api/account/email", { email }));
              if (r?.ok) setSentTo(r.sentTo); }}>
              <input style={input} type="email" placeholder={account.email ? "New email address" : "Email address"} value={email}
                onChange={e => setEmail(e.target.value)} aria-label="New email address" />
              <button style={btn} disabled={!!busy || !email}>Send code</button>
            </form>
          : <form style={row} onSubmit={async e => { e.preventDefault();
              const r = await run("email-code", () => post("/api/account/email/confirm", { code }), "Email changed.");
              if (r?.ok) { setSentTo(""); setCode(""); setEmail(""); } }}>
              <span style={{ ...muted, width: "100%" }}>We sent a 6-digit code to {sentTo}.</span>
              <input style={{ ...input, flex: "0 1 140px", letterSpacing: "0.3em" }} inputMode="numeric" maxLength={6} value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Code" />
              <button style={btn} disabled={!!busy || code.length !== 6}>Confirm</button>
              <button type="button" style={btnQuiet} onClick={() => setSentTo("")}>Cancel</button>
            </form>}
    </div>
  );
}

function ReauthBox({ account, busy, run, post, methods }) {
  const [pw, setPw] = useState("");
  const provider = ["google", "linkedin", "github"].find(p => methods[p]);
  return (
    <div style={{ border: `1px dashed ${C.BORDER_STRONG}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 700 }}>Confirm it's you</div>
      {account.signInMethods?.password && (
        <form style={row} onSubmit={async e => { e.preventDefault();
          if (await run("reauth", () => post("/api/account/reauth", { password: pw }), "Confirmed — changes are unlocked for 15 minutes.")) setPw(""); }}>
          <input style={input} type="password" autoComplete="current-password" placeholder="Your password" value={pw}
            onChange={e => setPw(e.target.value)} aria-label="Your password" />
          <button style={btn} disabled={!!busy || !pw}>Confirm</button>
        </form>
      )}
      {provider && <a style={{ ...btnQuiet, textDecoration: "none", alignSelf: "flex-start" }} href={oauthUrl(provider, "login")}>
        Sign in again with {PROVIDER_LABEL[provider]}</a>}
    </div>
  );
}

function PasswordEditor({ account, busy, run, post }) {
  const has = !!account.signInMethods?.password;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm && next !== confirm;
  if (!open) {
    return (
      <div style={{ ...row, justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "var(--color-text)" }}>Password
          <span style={{ ...muted, marginLeft: 8 }}>{has ? "Set" : "Not set — you sign in with " + (["google", "linkedin", "github"].filter(p => account.signInMethods?.[p]).map(p => PROVIDER_LABEL[p]).join(", ") || "a provider")}</span></span>
        <button style={btnQuiet} onClick={() => setOpen(true)}>{has ? "Change password" : "Set a password"}</button>
      </div>
    );
  }
  return (
    <form style={{ display: "flex", flexDirection: "column", gap: 8 }} onSubmit={async e => {
      e.preventDefault();
      const r = await run("password", () => post("/api/account/password", { current, next }),
        has ? "Password changed. Other browsers were signed out." : "Password set. You can now sign in with it too.");
      if (r?.ok) { setOpen(false); setCurrent(""); setNext(""); setConfirm(""); }
    }}>
      {has && <input style={input} type="password" autoComplete="current-password" placeholder="Current password" value={current}
        onChange={e => setCurrent(e.target.value)} aria-label="Current password" />}
      <input style={input} type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={next}
        onChange={e => setNext(e.target.value)} aria-label="New password" />
      <input style={input} type="password" autoComplete="new-password" placeholder="New password again" value={confirm}
        onChange={e => setConfirm(e.target.value)} aria-label="Confirm new password" />
      {mismatch && <div style={{ ...muted, color: C.DANGER }}>The two new passwords don't match.</div>}
      <div style={row}>
        <button style={btn} disabled={!!busy || next.length < 8 || next !== confirm || (has && !current)}>{has ? "Change password" : "Set password"}</button>
        <button type="button" style={btnQuiet} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function SessionsList({ sessions, busy, run, post, reload }) {
  if (!sessions) return <div style={muted}>Loading…</div>;
  const others = sessions.sessions.filter(s => !s.current).length;
  const line = (key, label, sub, action) => (
    <div key={key} style={{ ...row, justifyContent: "space-between", borderTop: `1px solid ${C.BORDER}`, paddingTop: 8 }}>
      <div><div style={{ fontSize: 13, color: "var(--color-text)" }}>{label}</div><div style={muted}>{sub}</div></div>
      {action}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sessions.sessions.map(s => line(s.id, s.device, [s.current ? "This browser" : `Active ${ago(s.lastSeenAt)}`, s.ipHint].filter(Boolean).join(" · "),
        s.current ? <span style={{ ...muted, color: C.SUCCESS, fontWeight: 700 }}>Current</span>
          : <button style={btnQuiet} disabled={!!busy} onClick={async () => { await run(`s-${s.id}`, () => post(`/api/account/sessions/${s.id}`, null, "DELETE"), "Signed out of that browser."); reload(); }}>Sign out</button>))}
      {sessions.apps.map(a => line(`a-${a.id}`, a.app, `Signed in ${ago(a.createdAt)} · active ${ago(a.lastSeenAt)}`,
        <button style={btnQuiet} disabled={!!busy} onClick={async () => { await run(`a-${a.id}`, () => post(`/api/account/apps/${a.id}`, null, "DELETE"), `Signed out of the ${a.app.toLowerCase()}.`); reload(); }}>Sign out</button>))}
      {others > 0 && <div style={row}><button style={btnQuiet} disabled={!!busy}
        onClick={async () => { await run("others", () => post("/api/account/sessions/revoke-others"), "Signed out of every other browser."); reload(); }}>
        Sign out of all other browsers</button></div>}
    </div>
  );
}

const TABLE_LABEL = { user_jobs: "saved or seen jobs", job_applications: "applications", domain_profiles: "job profiles",
  resumes: "tailored resumes", resume_versions: "resume versions", apply_runs: "apply runs", daily_drafts: "daily drafts",
  imported_jobs: "imported jobs", notifications: "notifications", user_integrations: "connections" };

function MergeSection({ account, busy, run, post, say }) {
  const [preview, setPreview] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [pw, setPw] = useState("");
  const ready = account.mergeReady;
  useEffect(() => {
    if (ready && !preview) api("/api/account/merge/preview").then(r => setPreview(r.preview)).catch(() => {});
  }, [ready, preview]);
  const counts = Object.entries(preview?.counts || {}).filter(([t]) => TABLE_LABEL[t]);
  return (
    <SettingsSection title="Merge another account into this one"
      subtitle="Signed up twice — say once with a password and once with Google? Bring the other account's jobs, profiles and sign-in here. The other account is then deleted.">
      {!preview ? (
        <>
          <div style={muted}>First, prove the other account is yours:</div>
          <form style={row} onSubmit={async e => { e.preventDefault();
            const r = await run("merge-verify", () => post("/api/account/merge/verify-password", { identifier, password: pw }));
            if (r?.preview) { setPreview(r.preview); setPw(""); } }}>
            <input style={input} placeholder="Its username or email" value={identifier} onChange={e => setIdentifier(e.target.value)} aria-label="Other account's username or email" />
            <input style={input} type="password" autoComplete="off" placeholder="Its password" value={pw} onChange={e => setPw(e.target.value)} aria-label="Other account's password" />
            <button style={btn} disabled={!!busy || !identifier || !pw}>Check</button>
          </form>
          <div style={row}>
            <span style={muted}>Or, if it signs in with a provider:</span>
            {["google", "linkedin", "github"].map(p => (
              <a key={p} style={{ ...btnQuiet, textDecoration: "none" }} href={oauthUrl(p, "merge")}>Use {PROVIDER_LABEL[p]}</a>))}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--color-text)" }}>
            Merging <strong>{preview.from.username}</strong> (created {new Date(preview.from.createdAt * 1000).toLocaleDateString()})
            into <strong>{account.username}</strong>.</div>
          <div style={muted}>{counts.length
            ? <>It brings: {counts.map(([t, n]) => `${n} ${TABLE_LABEL[t]}`).join(", ")}.</>
            : "That account has no jobs or profiles to bring — only its sign-in."}
            {" "}{Object.entries(preview.from.signInMethods || {}).filter(([k, v]) => v && k !== "password").map(([k]) => `Its ${PROVIDER_LABEL[k]} sign-in will sign in here.`).join(" ")}
            {" "}Where both accounts have the same thing, this account's copy is kept.</div>
          <div style={row}>
            <button style={btnDanger} disabled={!!busy} onClick={async () => {
              const r = await run("merge", () => post("/api/account/merge", { confirm: true }), `Merged. ${preview.from.username} is gone and its data is here.`);
              if (r?.ok) { setPreview(null); announceAccountChanged(); }
            }}>{busy === "merge" ? "Merging…" : "Merge and delete the other account"}</button>
            <button style={btnQuiet} disabled={!!busy} onClick={async () => { await post("/api/account/merge", null, "DELETE").catch(() => {}); setPreview(null); say("info", "Merge cancelled."); }}>Cancel</button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

function DeleteSection({ account, busy, run, post, onSignedOut }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <SettingsSection title="Delete account" tone="danger"
      subtitle="Deletes your account and everything in it — profiles, resumes, applications, history. This can't be undone. Download your data first if you want a copy.">
      {!open
        ? <div style={row}><button style={btnQuiet} onClick={() => setOpen(true)}>Delete my account…</button></div>
        : <form style={row} onSubmit={async e => { e.preventDefault();
            const r = await run("delete", () => post("/api/account/delete", { confirm: typed }));
            if (r?.ok) onSignedOut?.(); }}>
            <span style={{ ...muted, width: "100%" }}>{account.recentAuth ? <>Type your username, <strong>{account.username}</strong>, to confirm.</>
              : "Confirm it's you in Sign-in & security above first, then come back."}</span>
            <input style={input} value={typed} onChange={e => setTyped(e.target.value)} aria-label="Type your username to confirm" disabled={!account.recentAuth} />
            <button style={btnDanger} disabled={!!busy || typed !== account.username || !account.recentAuth}>Delete forever</button>
            <button type="button" style={btnQuiet} onClick={() => { setOpen(false); setTyped(""); }}>Cancel</button>
          </form>}
    </SettingsSection>
  );
}


/**
 * ⭐ D88 P3 · Settings → Help — contact support, and your requests with their replies. The app attaches the page
 * you were on and its version; nothing from your profile or your forms. No attachments (they carry personal data).
 * A reply from us also arrives by email from support@; replying to that email reaches the same inbox.
 */
const HELP_STATUS = { open: "Open — we'll reply", waiting_on_user: "Waiting on you", solved: "Solved" };
function HelpSection({ say }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);           // { category, subject, message } while writing
  const [openId, setOpenId] = useState(null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/api/support/tickets").then(setD).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (window.location.hash === "#help") document.getElementById("help")?.scrollIntoView({ block: "start" }); }, [d]);
  const openThread = async (id) => {
    setOpenId(id); setThread(null);
    try { setThread(await api(`/api/support/tickets/${id}`)); } catch (e) { say("error", e.message); }
  };
  const send = async () => {
    setBusy(true);
    try {
      await api("/api/support/tickets", { method: "POST", body: JSON.stringify({ ...form,
        context: { page: window.location.pathname, appVersion: "web" } }) });
      setForm(null); say("ok", "Sent. We reply here and by email — usually within two days."); load();
    } catch (e) { say("error", e.message); }
    setBusy(false);
  };
  const sendReply = async () => {
    setBusy(true);
    try { await api(`/api/support/tickets/${openId}/messages`, { method: "POST", body: JSON.stringify({ body: reply }) }); setReply(""); await openThread(openId); load(); }
    catch (e) { say("error", e.message); }
    setBusy(false);
  };
  const cats = d?.categories || {};
  const ready = form && cats[form.category] && form.subject.trim().length >= 3 && form.message.trim().length >= 10;
  return (
    <SettingsSection title="Help" subtitle="Ask us anything about your account, résumés, drafts or applications. We reply here and by email.">
      <div id="help" data-help-section="" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!form && <div style={row}><button style={btn} onClick={() => setForm({ category: "", subject: "", message: "" })}>Contact support</button></div>}
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-help-form="">
            <label style={muted}>What is it about?
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...input, display: "block", marginTop: 4 }}>
                <option value="">Choose one…</option>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label style={muted}>Subject
              <input value={form.subject} maxLength={140} onChange={e => setForm({ ...form, subject: e.target.value })} style={{ ...input, display: "block", width: "100%", marginTop: 4, boxSizing: "border-box" }}/></label>
            <label style={muted}>Message
              <textarea rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} style={{ ...input, display: "block", width: "100%", marginTop: 4, boxSizing: "border-box" }}/></label>
            <div style={muted}>We attach your account and the page you're on, nothing else. Please don't include passwords. No attachments.</div>
            {form.category === "privacy_request" && <div style={muted}>You can also download your data or delete your account yourself, right now, further down this page.</div>}
            <div style={row}>
              <button style={btn} disabled={!ready || busy} onClick={send}>{busy ? "Sending…" : "Send"}</button>
              <button style={btnQuiet} disabled={busy} onClick={() => setForm(null)}>Cancel</button>
            </div>
          </div>
        )}
        {d?.tickets?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-text)" }}>Your requests</div>
            {d.tickets.map(t => (
              <div key={t.id} style={{ borderTop: `1px solid ${C.BORDER}`, paddingTop: 8 }}>
                <div style={{ ...row, justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "var(--color-text)" }}><b>{t.subject}</b>
                    <span style={{ ...muted, marginLeft: 8 }}>{HELP_STATUS[t.status] || t.status} · {ago(t.updated_at)}</span></span>
                  <button style={btnQuiet} onClick={() => (openId === t.id ? setOpenId(null) : openThread(t.id))}>{openId === t.id ? "Close" : "Open"}</button>
                </div>
                {openId === t.id && thread && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }} data-help-thread={t.id}>
                    {thread.messages.map(m => (
                      <div key={m.id} style={{ border: `1px solid ${C.BORDER}`, borderRadius: 10, padding: "8px 11px", marginLeft: m.author_type === "user" ? 32 : 0 }}>
                        <div style={muted}>{m.author_type === "user" ? "You" : "draft support"} · {ago(m.created_at)}</div>
                        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--color-text)" }}>{m.body}</div>
                      </div>
                    ))}
                    <textarea rows={3} aria-label="Your reply" value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply…" style={{ ...input, width: "100%", boxSizing: "border-box" }}/>
                    <div style={row}><button style={btn} disabled={busy || reply.trim().length < 2} onClick={sendReply}>Reply</button></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}


/**
 * ⭐ D88 P5 · Settings → Your plan and allowance — the user's own, read-only. ⛔ Never money; never the admin's A+
 * swap; an allowance support raised for you reads as your allowance. (GET /api/account/allowance)
 */
function AllowanceSection() {
  const [d, setD] = useState(null);
  useEffect(() => { api("/api/account/allowance").then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const freeAt = d.drafts?.remaining === 0 && d.drafts.nextFreeAt
    ? new Date(d.drafts.nextFreeAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase() : null;
  return (
    <SettingsSection title="Your plan and allowance" subtitle="What you can use and how much of it is left. Need more? Ask in Help below.">
      <div data-allowance-section="" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 13, color: "var(--color-text)" }}>Plan: <b>{d.plan}</b></div>
        {d.drafts && <div style={{ fontSize: 13, color: "var(--color-text)" }}>
          <b>{d.drafts.remaining} of {d.drafts.limit}</b> drafts left in the last 24 hours{freeAt ? ` — the next frees up at ${freeAt}` : ""}.</div>}
        <div style={muted}>{d.resumesToday} résumé{d.resumesToday === 1 ? "" : "s"} today · {d.resumesMonth} in the last 30 days</div>
        <div style={{ borderTop: `1px solid ${C.BORDER}`, paddingTop: 8, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px" }}>
          {d.features.map(f => <Fragment key={f.key}><span style={{ fontSize: 13, color: "var(--color-text)" }}>{f.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{f.value}</span></Fragment>)}
        </div>
      </div>
    </SettingsSection>
  );
}

export default AccountPanel;

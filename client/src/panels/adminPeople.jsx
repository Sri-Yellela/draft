// client/src/panels/adminPeople.jsx — ⭐ D88 P2 + P4 · Admin → People → Users (D83's map, audit #15a + #17).
//
// One list, one person's page made of modules — Account & status · Plan & usage · Feature access · Activity · Notes.
// Built to D83's six rules with the admin kit. Every write asks for a REASON in the page and leaves an audit row the
// person's Activity shows (routes/adminPeople.js). ⛔ No eligibility or EEO answer, phone or address is ever shown
// (the server sends an allow-list). ⛔ No password is set here (a reset link is sent) and no one is impersonated.
// Decided 10-09 (39d) under the owner's "go with your recommended decisions": no separate sketch — the pattern is
// D83's kit; plan tiers and defaults unchanged; no `support` role yet; no impersonation; delete stays immediate
// behind the typed confirmation.
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import { Panel, Help, Dialog, h2, row, quiet, field, callout } from "./adminKit.jsx";
import { Btn, Table, Err, KV, ago, stamp, usd, num, UserApplications } from "./adminOps.jsx";

const STATUS_TONE = { active: C.SUCCESS, suspended: C.DANGER };
const FILTERS = [["all", "Everyone"], ["active", "Active"], ["suspended", "Suspended"], ["admins", "Admins"], ["override", "With an override"],
  ["inactive30", "Inactive 30 days"], ["new7", "Joined this week"]];
const SORTS = [["recent", "Last active"], ["newest", "Newest"], ["name", "Name"]];
const PLANS = ["BASIC", "PLUS", "PRO"];
const SOURCE_WORDS = { global: "the operator", override: "an override", plan: "the plan", system: "the system default" };

/** An action that changes an account: its own fields, then a reason, then the confirm. */
function ActionDialog({ action, onDone, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries((action.fields || []).map(f => [f.key, f.initial ?? ""])));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const ready = reason.trim().length >= 3 && (action.fields || []).every(f => !f.required || String(values[f.key] ?? "").trim() !== "");
  const go = async () => {
    if (!ready) return;
    setBusy(true); setErr(null);
    try { await action.run({ ...values, reason: reason.trim() }); onDone(); }
    catch (e) { setErr(e.payload?.error || e.message); setBusy(false); }
  };
  return (
    <Dialog title={action.title} confirmLabel={action.label} onCancel={onCancel} onConfirm={go} busy={busy} disabled={!ready}>
      <div style={{ marginBottom: 10 }}>{action.body}</div>
      {(action.fields || []).map(f => (
        <label key={f.key} style={{ display: "block", fontSize: 12, marginBottom: 8 }}>{f.label}
          {f.options
            ? <select value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} style={{ ...field, display: "block", marginTop: 4, width: "100%" }}>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            : <input type={f.type || "text"} value={values[f.key]} min={f.min} max={f.max} placeholder={f.placeholder}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} style={{ ...field, display: "block", marginTop: 4, width: "100%", boxSizing: "border-box" }}/>}
        </label>
      ))}
      <label style={{ display: "block", fontSize: 12 }}>Why (kept with the change)
        <textarea aria-label="Why" rows={2} value={reason} onChange={e => setReason(e.target.value)} autoFocus
          placeholder="e.g. support ticket 12 — asked for more drafts"
          style={{ ...field, display: "block", marginTop: 4, width: "100%", boxSizing: "border-box" }}/></label>
      {!ready && <div style={{ ...quiet, marginTop: 6 }}>A reason of a few words is required.</div>}
      <Err msg={err}/>
    </Dialog>
  );
}

/** A future moment as words: "in 40 min", "in 3h". */
const inWords = (ms) => { const s = Math.max(0, Math.round((ms - Date.now()) / 1000)); return s < 3600 ? `in ${Math.max(1, Math.ceil(s / 60))} min` : `in ${Math.round(s / 3600)}h`; };

// ── the list ────────────────────────────────────────────────────────────────────────────────────────────────────
export function PeopleList({ theme, onOpen }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    setErr(null);
    const qs = new URLSearchParams({ q, filter, sort, page: String(page), pageSize: "25" });
    api(`/api/admin/people?${qs}`).then(setD).catch(e => setErr(e.message));
  }, [q, filter, sort, page]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);
  const c = d?.counts;
  const input = { background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "6px 9px", fontSize: 12 };
  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  return (
    <Panel title="Users" data-people-list=""
      code="D88 user management: the list and each person's page are built from the same modules; every change asks why and is kept in the person's Activity (admin_audit_log)."
      purpose="Everyone with an account. Open a person to see their plan and usage, change what they can use, suspend or restore them, and read every change ever made to their account."
      numbers={c ? [[num(c.total), "accounts"], [num(c.activeWeek), "active this week"], [num(c.suspended), "suspended", c.suspended === 0], [num(c.withOverride), "with an override"]] : []}>
      <Err msg={err}/>
      <div style={{ ...row, marginBottom: 10 }}>
        <input aria-label="Find a person" placeholder="Name, email, username or id" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} style={{ ...input, width: 260 }}/>
        <select aria-label="Show" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={input}>{FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)} style={input}>{SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}</select>
        {d && <span style={quiet}>{num(d.total)} {filter === "all" && !q ? "accounts" : "match"}</span>}
      </div>
      <Table theme={theme} rows={d?.rows || []} empty={d ? "No one matches." : "Loading…"} cols={[
        { key: "username", label: "person", render: r => <span><b>{r.name || r.username}</b>{r.name && <span style={{ color: theme.textMuted }}> · {r.username}</span>}
            {r.email && <div style={{ color: theme.textMuted }}>{r.email}</div>}</span> },
        { key: "plan_tier", label: "plan", render: r => (r.is_admin ? "admin" : (r.plan_tier || "BASIC").toLowerCase()) },
        { key: "status", label: "status", render: r => <span style={markStyle(STATUS_TONE[r.status] || C.INK_FAINT)}>{r.status}</span> },
        { key: "last_active", label: "last active", render: r => (r.last_active ? ago(r.last_active) : "never") },
        { key: "drafts", label: "drafts used", right: true, render: r => (r.drafts ? `${r.drafts.used} / ${r.drafts.limit}` : "—") },
        { key: "resumes_week", label: "résumés · 7 days", right: true },
        { key: "applications", label: "applications", right: true },
        { key: "overrides", label: "", render: r => (r.overrides ? <span style={markStyle(C.WARNING)}>override</span> : "") },
        { key: "open", label: "", render: r => <Btn theme={theme} onClick={() => onOpen(r.id)}>Open</Btn> },
      ]}/>
      {pages > 1 && (
        <div style={{ ...row, marginTop: 10 }}>
          <Btn theme={theme} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</Btn>
          <span style={quiet}>page {page} of {pages}</span>
          <Btn theme={theme} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</Btn>
        </div>
      )}
    </Panel>
  );
}

// ── one person ──────────────────────────────────────────────────────────────────────────────────────────────────
const showValue = (f, v) => (f.kind === "boolean" ? (v ? "on" : "off") : v == null ? "no limit" : String(v));
const ACTION_WORDS = {
  "user.override.set": "set an override", "user.override.clear": "cleared an override", "user.suspend": "suspended the account",
  "user.unsuspend": "restored the account", "user.plan": "changed the plan", "user.note": "added a note",
  "user.sign_out_everywhere": "signed the account out everywhere", "user.reset_link": "sent a password-reset link",
};
const changeLine = (a) => {
  const b = a.before, t = a.after;
  if (a.action.startsWith("user.override")) return `${b?.feature ?? t?.feature}: ${b?.value ?? "—"} (${SOURCE_WORDS[b?.source] || b?.source}) → ${t?.value ?? "—"} (${SOURCE_WORDS[t?.source] || t?.source})`;
  if (a.action === "user.plan") return `${b?.plan} → ${t?.plan}`;
  if (a.action === "user.reset_link") return t?.sent ? "sent" : "not sent";
  return "";
};

export function PersonPage({ theme, id, onBack, onDelete }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [action, setAction] = useState(null);
  const [note, setNote] = useState("");
  const [limits, setLimits] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => { setErr(null); api(`/api/admin/people/${id}`).then(setD).catch(e => setErr(e.message)); }, [id]);
  useEffect(() => { load(); }, [load]);
  const post = (path, body) => api(`/api/admin/people/${id}${path}`, { method: "POST", body: JSON.stringify(body) });
  const done = (text) => () => { setAction(null); setMsg(text); load(); };
  if (!d) return <div><Btn theme={theme} onClick={onBack}>← All users</Btn><Err msg={err}/></div>;
  const a = d.account, u = d.usage;
  const who = a.name || a.username;
  const locked = a.isAdmin || a.system;

  const suspend = () => setAction({ title: a.status === "suspended" ? `Restore ${who}?` : `Suspend ${who}?`, label: a.status === "suspended" ? "Restore the account" : "Suspend the account",
    body: a.status === "suspended" ? "They can sign in and use draft again. Their data was never touched." :
      "They are signed out everywhere at once and cannot sign in or use the API, the extension or a connected app until restored. Nothing is deleted; Restore undoes it.",
    run: (v) => post("/status", { status: a.status === "suspended" ? "active" : "suspended", reason: v.reason }), onDone: done(a.status === "suspended" ? "Restored." : "Suspended.") });
  const changePlan = () => setAction({ title: `Change ${who}'s plan?`, label: "Change the plan",
    body: "The plan decides which tools they get while monetisation is on. Changing it back undoes it.",
    fields: [{ key: "plan", label: "Plan", options: PLANS.filter(p => p !== (a.plan || "BASIC").toUpperCase()).map(p => [p, p.toLowerCase()]), initial: PLANS.find(p => p !== (a.plan || "BASIC").toUpperCase()), required: true }],
    run: (v) => post("/plan", { plan: v.plan, reason: v.reason }), onDone: done("Plan changed.") });
  const signOut = () => setAction({ title: `Sign ${who} out everywhere?`, label: "Sign out everywhere",
    body: `Ends every session and token they hold (${a.sessions} now). They can sign in again at once.`,
    run: (v) => post("/sign-out-everywhere", { reason: v.reason }), onDone: done("Signed out everywhere.") });
  const resetLink = () => setAction({ title: `Send ${who} a password-reset link?`, label: "Send the link",
    body: a.email ? <>A one-time link goes to <b>{a.email}</b>. No password is set or seen here.</> : "They have no email address — nothing can be sent.",
    run: async (v) => { const r = await post("/reset-link", { reason: v.reason }); setMsg(r.sent ? "Reset link sent." : `Not sent: ${r.why}`); },
    onDone: () => { setAction(null); load(); } });
  const setOverride = (f) => setAction({ title: `Change “${f.label}” for ${who}?`, label: "Set the override",
    body: <>Now {showValue(f, f.value)}, from {SOURCE_WORDS[f.source] || f.source}{f.detail ? ` (${f.detail})` : ""}.
      {f.key === "a_plus_default" && <> When on, this user's Generate is silently replaced by the A+ Resume prompt (needs PRO when monetisation is on, else Generate is refused).</>}
      {f.ceiling != null && <> The most it can be is {f.ceiling}.</>} Clear undoes it.</>,
    fields: [
      f.kind === "boolean"
        ? { key: "value", label: "Set to", options: [["true", "on"], ["false", "off"]], initial: f.value ? "false" : "true", required: true }
        : { key: "value", label: f.kind === "limit" ? "Set to (blank = no limit)" : "Set to", type: "number", min: 0, max: f.ceiling ?? undefined, initial: f.value ?? "", required: f.kind !== "limit" },
      { key: "until", label: "Until (optional — blank keeps it until cleared)", type: "date" },
    ],
    run: (v) => post("/overrides", { feature: f.key, reason: v.reason,
      value: f.kind === "boolean" ? v.value === "true" : (v.value === "" ? null : Number(v.value)),
      expiresAt: v.until ? Math.floor(new Date(`${v.until}T23:59:59`).getTime() / 1000) : null }),
    onDone: done(`${f.label}: override set.`) });
  const clearOverride = (f) => setAction({ title: `Clear the override on “${f.label}”?`, label: "Clear it",
    body: `It goes back to what ${f.key === "draft_slots" ? "the system" : "the plan or the system"} says. The override stays in the history.`,
    run: (v) => api(`/api/admin/people/${id}/overrides/${f.key}/clear`, { method: "POST", body: JSON.stringify({ reason: v.reason }) }), onDone: done(`${f.label}: back to the default.`) });
  const addNote = async () => {
    if (!note.trim()) return;
    try { await post("/notes", { body: note }); setNote(""); load(); } catch (e) { setErr(e.message); }
  };
  const openLimits = async () => {
    try { setLimits(await api(`/api/admin/analytics/limits/${id}`) || {}); } catch (e) { setErr(e.message); }
  };

  return (
    <div data-person-page={id}>
      {action && <ActionDialog action={action} onCancel={() => setAction(null)} onDone={() => (action.onDone ? action.onDone() : setAction(null))}/>}
      {limits && <LimitsModal userId={id} username={a.username} initialLimits={limits} theme={theme} onClose={() => setLimits(null)}
        onSave={async (l) => { await api(`/api/admin/analytics/limits/${id}`, { method: "PUT", body: JSON.stringify(l) }); setLimits(null); setMsg("Usage limits saved."); load(); }}/>}
      <div style={{ ...row, marginBottom: 12 }}>
        <Btn theme={theme} onClick={onBack}>← All users</Btn>
        <h2 style={{ ...h2, fontSize: 24 }}>{who}</h2>
        <span style={markStyle(STATUS_TONE[a.status] || C.INK_FAINT)}>{a.status}</span>
        {a.isAdmin && <span style={markStyle(C.INFO)}>admin</span>}
      </div>
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 10 }} role="status">{msg}</div>}

      <Panel title="Account & status" data-module="account"
        code="Module 1. Shown from an allow-list: no eligibility or EEO answer, phone or address — support needs none of them."
        purpose="Who this is and whether they can use draft. Every action here asks why, and the reason is kept in the Activity below."
        numbers={[[a.status === "suspended" ? "Suspended" : "Active", a.status === "suspended" ? `since ${stamp(a.suspendedAt)}` : "can sign in", a.status !== "suspended"],
          [(a.plan || "BASIC").toLowerCase(), "plan"], [a.lastActive ? ago(a.lastActive) : "never", "last active"], [num(a.sessions), "signed-in sessions"]]}>
        {a.status === "suspended" && <div style={{ ...callout(C.DANGER), marginBottom: 10 }}>Suspended: {a.suspendedReason}</div>}
        <KV theme={theme} rows={[
          ["username", `${a.username} (id ${a.id})`], ["email", a.email || "—"], ["joined", stamp(a.createdAt)],
          ["email verified", a.emailVerifiedAt ? stamp(a.emailVerifiedAt) : "not verified"],
          ["their own plugin switch", a.pluginOn ? "on" : "off"], ["product news", a.productNews ? "asked for it" : "no"],
        ]}/>
        <div style={{ ...row, marginTop: 12 }}>
          {!locked && <Btn theme={theme} onClick={suspend}>{a.status === "suspended" ? "Restore…" : "Suspend…"}</Btn>}
          {!locked && <Btn theme={theme} onClick={changePlan}>Change the plan…</Btn>}
          <Btn theme={theme} onClick={signOut}>Sign out everywhere…</Btn>
          <Btn theme={theme} onClick={resetLink}>Send a password-reset link…</Btn>
          {!locked && <Btn theme={theme} danger onClick={() => onDelete(id)}>Delete the account…</Btn>}
        </div>
        {locked && <div style={{ ...quiet, marginTop: 8 }}>{a.system ? "The system account" : "An admin account"} cannot be suspended, re-planned or deleted here.</div>}
      </Panel>

      <Panel title="Plan & usage" data-module="usage"
        code="Module 3. Drafts are the D51 / A63 slots (a Draft or a new résumé uses one, over a rolling 24 hours). The cost is the usage ledger — admin-only; users never see money."
        purpose="What they have used against what they are allowed, and when the next draft frees up."
        numbers={[[u.drafts ? `${u.drafts.used} / ${u.drafts.limit}` : "—", u.drafts?.nextFreeAt && u.drafts.remaining === 0 ? `drafts used · next frees ${inWords(u.drafts.nextFreeAt)}` : "drafts used · 24 hours"],
          [num(u.resumesToday), "résumés today"], [num(u.resumesMonth), "résumés · 30 days"], [num(u.applications), "applications"],
          [num(u.pluginCalls), "plugin calls · 7 days"], [usd(u.costUsd30d), "our cost · 30 days"]]}>
        <div style={row}><Btn theme={theme} onClick={openLimits}>Usage limits (monthly and daily caps)…</Btn></div>
        <div style={{ marginTop: 10 }}><UserApplications userId={id} theme={theme}/></div>
      </Panel>

      <Panel title="Feature access" data-module="features"
        code="Module 4. One resolver decides every value: the operator's switch → this user's override → the plan → the system default (services/entitlementResolver.js). Full auto is decided by the system alone (D36)."
        purpose="What this person can use, how much, and where each answer comes from. An override changes it for them alone, with a reason and, if you like, an end date."
        numbers={[[num(d.features.filter(f => f.override).length), "overrides in force"], [num(d.features.filter(f => f.source === "global").length), "held by the operator's switch"]]}>
        <Table theme={theme} rows={d.features} cols={[
          { key: "label", label: "feature", render: f => <span>{f.label}{f.key === "a_plus_default" && <Help tip="When on, this user's Generate is silently replaced by the A+ Resume prompt."/>}</span> },
          { key: "value", label: "now", render: f => <b>{showValue(f, f.value)}</b> },
          { key: "source", label: "decided by", render: f => <span title={f.detail || ""}>{SOURCE_WORDS[f.source] || f.source}</span> },
          { key: "override", label: "override", render: f => (f.override ? <span>{showValue(f, f.override.value)} — {f.override.reason}{f.override.expiresAt ? ` · until ${stamp(f.override.expiresAt).slice(0, 10)}` : ""}</span> : "—") },
          { key: "act", label: "", render: f => (f.hard ? <span style={quiet}>decided by the system</span>
            : <span style={{ display: "inline-flex", gap: 6 }}><Btn theme={theme} onClick={() => setOverride(f)}>Set…</Btn>{f.override && <Btn theme={theme} onClick={() => clearOverride(f)}>Clear…</Btn>}</span>) },
        ]}/>
      </Panel>

      <Panel title="Activity" data-module="activity"
        code="Module 6. Read from admin_audit_log, which is never edited or deleted: who, what, before → after, and why."
        purpose="Every change an admin has made to this account, newest first."
        numbers={[[num(d.activity.length), "changes recorded"], [d.activity[0] ? ago(d.activity[0].at) : "never", "the last change"]]}>
        <Table theme={theme} rows={d.activity} empty="No admin has changed this account." cols={[
          { key: "at", label: "when", render: r => stamp(r.at) },
          { key: "actor", label: "who", render: r => r.actor || "—" },
          { key: "action", label: "what", render: r => ACTION_WORDS[r.action] || r.action },
          { key: "change", label: "change", render: r => changeLine(r) || "—" },
          { key: "reason", label: "why", render: r => r.reason || "—" },
        ]}/>
      </Panel>

      <Panel title="Notes" data-module="notes" code="Private to admins; the person never sees them." purpose="What the next admin should know about this person."
        numbers={[[num(d.notes.length), "notes"]]}>
        <textarea aria-label="A note" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. asked for more drafts on 10-09; granted until the 16th"
          style={{ ...field, width: "100%", boxSizing: "border-box" }}/>
        <div style={{ ...row, margin: "6px 0 10px" }}><Btn theme={theme} disabled={!note.trim()} onClick={addNote}>Add the note</Btn></div>
        {d.notes.map(n => <div key={n.id} style={{ fontSize: 12, borderTop: `1px solid ${theme.border}`, padding: "6px 0" }}>
          <span style={quiet}>{stamp(n.created_at)} · {n.author || "—"}</span><div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div></div>)}
      </Panel>
    </div>
  );
}

/** Admin → People → Users: the list, or one person (?u= in the URL keeps the place on a reload). */
export function PeopleUsers({ theme, onDelete, reloadKey = 0 }) {
  const [openId, setOpenId] = useState(() => { try { return Number(new URLSearchParams(window.location.search).get("u")) || null; } catch { return null; } });
  const open = (id) => {
    setOpenId(id);
    try { const qs = new URLSearchParams(window.location.search); if (id) qs.set("u", String(id)); else qs.delete("u"); window.history.replaceState(null, "", `${window.location.pathname}?${qs}`); } catch { /* no history */ }
  };
  return openId ? <PersonPage key={`${openId}:${reloadKey}`} theme={theme} id={openId} onBack={() => open(null)} onDelete={onDelete}/>
                : <PeopleList key={reloadKey} theme={theme} onOpen={open}/>;
}

// ── the legacy usage limits (user_limits) — moved from AdminPanel.jsx with the per-user table (D88) ──
// ── LimitsModal ───────────────────────────────────────────────
export function LimitsModal({ userId, username, initialLimits, onSave, onClose, theme }) {
  const [limits, setLimits] = useState({
    monthly_resumes: initialLimits.monthly_resumes ?? "",
    monthly_ats_scores: initialLimits.monthly_ats_scores ?? "",
    monthly_job_scrapes: initialLimits.monthly_job_scrapes ?? "",
    monthly_pdf_exports: initialLimits.monthly_pdf_exports ?? "",
    monthly_apply_runs: initialLimits.monthly_apply_runs ?? "",
    monthly_token_budget: initialLimits.monthly_token_budget ?? "",
    daily_resumes: initialLimits.daily_resumes ?? "",
    daily_job_scrapes: initialLimits.daily_job_scrapes ?? "",
    notes: initialLimits.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const numOrNull = v => v === "" || v == null ? null : parseInt(v);
  const fields = [
    { key:"monthly_resumes",     label:"Monthly resumes",         unit:"resumes/mo" },
    { key:"daily_resumes",       label:"Daily resumes",           unit:"resumes/day" },
    { key:"monthly_ats_scores",  label:"Monthly ATS scores",      unit:"scores/mo" },
    { key:"monthly_job_scrapes", label:"Monthly job scrapes",     unit:"scrapes/mo" },
    { key:"daily_job_scrapes",   label:"Daily job scrapes",       unit:"scrapes/day" },
    { key:"monthly_pdf_exports", label:"Monthly PDF exports",     unit:"exports/mo" },
    { key:"monthly_apply_runs",  label:"Monthly apply runs",      unit:"runs/mo" },
    { key:"monthly_token_budget",label:"Monthly token budget",    unit:"tokens" },
  ];
  const inp = {
    height:36, padding:"0 12px", borderRadius:8, border:`1px solid ${theme.border}`,
    background:theme.surface, color:theme.text, fontSize:12, outline:"none", width:"100%",
    boxSizing:"border-box",
  };
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex",
                  alignItems:"center", justifyContent:"center",
                  background:C.SCRIM }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:theme.surface, borderRadius:16, padding:28,
                    maxWidth:420, width:"90%", maxHeight:"80vh", overflowY:"auto",
                    border:`1px solid ${theme.border}` }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:16, color:theme.text }}>
          Limits: {username}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{ fontSize:11, fontWeight:700, color:theme.textMuted, marginBottom:4 }}>
                {f.label} <span style={{ fontWeight:400 }}>({f.unit}, blank = unlimited)</span>
              </div>
              <input style={inp} type="number" min={0}
                value={limits[f.key]} placeholder="Unlimited"
                onChange={e => setLimits(l => ({ ...l, [f.key]: e.target.value }))}/>
            </div>
          ))}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:theme.textMuted, marginBottom:4 }}>Admin notes</div>
            <textarea style={{ ...inp, height:72, padding:"8px 12px", resize:"vertical" }}
              value={limits.notes} onChange={e => setLimits(l => ({ ...l, notes: e.target.value }))}/>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:20 }}>
          <button className="dbx-depth" onClick={onClose}
            style={{ flex:1, padding:"10px 0", border:`1px solid ${theme.border}`,
                     background:"transparent", color:theme.text, fontWeight:700, fontSize:13, cursor:"pointer" }}>
            Cancel
          </button>
          <button className="dbx-depth" disabled={saving} onClick={async () => {
            setSaving(true);
            await onSave({
              monthly_resumes: numOrNull(limits.monthly_resumes),
              monthly_ats_scores: numOrNull(limits.monthly_ats_scores),
              monthly_job_scrapes: numOrNull(limits.monthly_job_scrapes),
              monthly_pdf_exports: numOrNull(limits.monthly_pdf_exports),
              monthly_apply_runs: numOrNull(limits.monthly_apply_runs),
              monthly_token_budget: numOrNull(limits.monthly_token_budget),
              daily_resumes: numOrNull(limits.daily_resumes),
              daily_job_scrapes: numOrNull(limits.daily_job_scrapes),
              notes: limits.notes || null,
            });
            setSaving(false);
          }}
            style={{ flex:2, padding:"10px 0", border:"none",
                     background:theme.accent, color:C.ON_ACCENT, fontWeight:800, fontSize:13,
                     cursor:"pointer", opacity:saving?0.7:1 }}>
            {saving ? "Saving…" : "Save Limits"}
          </button>
        </div>
      </div>
    </div>
  );
}


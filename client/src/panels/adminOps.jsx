// client/src/panels/adminOps.jsx — A50 steps 2 and 3: the admin surfaces that were curl-only, and
// the daily glance. Minimal, in the admin panel's existing card/table style — NOT a redesign.
//
// ⛔ EVERY MUTATING CONTROL HERE (1) states what it will do before it does it, (2) asks, and (3) has
// no destructive default. The board-fit pass runs only after a dry run of the SAME parameters, and
// the "score" button says how many postings it will score. The kill switch's three states each say
// what they change, and the one that resumes real submissions to employers is the one that asks
// hardest. A51 is why: "Clean Pool" deleted users' Saves and Passes in one unlabelled click.
import { useState, useEffect, useCallback } from "react";
import { api, authContextQuery } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import IngestFunnel from "../components/IngestFunnel.jsx";
import { Panel, Step, Help, Dialog, useConfirm, h2, what, row, quiet, field, callout } from "./adminKit.jsx";
// The second product is named by the one constant that holds its name (shared/brand.js).
import { LEGACY_BRAND } from "../../../shared/brand.js";
import { isAlarm } from "../../../shared/deployEvents.js";

// ── shared bits ───────────────────────────────────────────────────────────────────────────────
const nowSec = () => Math.floor(Date.now() / 1000);

export function ago(ts) {
  if (!ts) return "never";
  const s = nowSec() - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const stamp = ts => (ts ? new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16) + "Z" : "—");
export const usd = n => (n == null ? "—" : `$${Number(n).toFixed(n >= 1 ? 2 : 4)}`);
export const num = n => (n == null ? "—" : Number(n).toLocaleString());
const pct = f => (f == null ? "—" : `${(f * 100).toFixed(1)}%`);

function Card({ theme, title, measured, children, tone }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${tone || theme.border}`, borderRadius: 12,
                  padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: theme.text, textTransform: "uppercase",
                      letterSpacing: "0.06em" }}>{title}</div>
        {measured && <div style={{ fontSize: 10, color: theme.textMuted }}>{measured}</div>}
      </div>
      {children}
    </div>
  );
}

export function KV({ theme, rows }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "4px 12px", fontSize: 12 }}>
      {rows.filter(Boolean).map(([k, v, color]) => (
        <div key={k} style={{ display: "contents" }}>
          <div style={{ color: theme.textMuted }}>{k}</div>
          <div style={{ color: color || theme.text, fontWeight: 600, wordBreak: "break-word" }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

export function Btn({ theme, onClick, disabled, danger, primary, children, title }) {
  const bg = disabled ? "transparent" : danger ? C.DANGER : primary ? C.ACCENT : theme.surfaceHigh;
  const fg = disabled ? theme.textMuted : danger ? C.SURFACE_SOLID : primary ? C.ON_ACCENT : theme.text;
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
               border: `1px solid ${danger && !disabled ? C.DANGER : theme.border}`,
               background: bg, color: fg, cursor: disabled ? "not-allowed" : "pointer" }}>
      {children}
    </button>
  );
}

export function Err({ msg }) {
  if (!msg) return null;
  return <div style={{ color: C.DANGER, fontSize: 12, margin: "8px 0" }}>{msg}</div>;
}

export function Table({ theme, cols, rows, empty = "Nothing recorded." }) {
  if (!rows?.length) return <div style={{ fontSize: 12, color: theme.textMuted }}>{empty}</div>;
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${theme.border}`, borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: theme.surfaceHigh }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: "6px 10px", textAlign: c.right ? "right" : "left",
                                       color: theme.textMuted, whiteSpace: "nowrap", fontWeight: 700 }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${theme.border}` }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: "6px 10px", textAlign: c.right ? "right" : "left",
                                         color: (c.color && c.color(r)) || theme.text, whiteSpace: "nowrap" }}>
                  {c.render ? c.render(r) : (r[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The term-weight refresh health from /api/version, as a sentence. It was Object.entries() joined,
// which printed `lastRun: [object Object]` — the one field an operator reads it for (10-02, 18).
function refreshLine(r) {
  const last = r.lastRun
    ? `last run ${r.lastRun.status ?? "?"}${r.lastRun.at ? ` ${ago(r.lastRun.at)}` : ""}${r.lastRun.error ? ` — ${r.lastRun.error}` : ""}`
    : "no run recorded";
  return `${last} · ${num(r.consecutiveFailures ?? 0)} consecutive failure(s); the refusal comes after ${num(r.failuresBeforeCliff ?? 0)}`;
}

// ── /api/version — the deploy ─────────────────────────────────────────────────────────────────
// ⭐ D83 rebuild #3 (39d) · TODAY → DEPLOYMENTS — audit #2 + #3 as one panel: what this server is running, what
// Railway last did, and whether the two agree (a push that did not deploy reads as a mismatch, not by accident).
// Read-only, so the only control is a quiet Re-read.
export function DeploymentsPanel({ theme }) {
  const [v, setV] = useState(null);
  const [d, setD] = useState(null);
  const [readAt, setReadAt] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    setErr(null);
    api("/api/version").then(x => { setV(x); setReadAt(nowSec()); }).catch(e => setErr(e.message));
    api("/api/admin/deploy-events").then(setD).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  const w = v?.atsWeights;
  const latest = d?.latest || [];
  const deploy = latest.find(e => /deploy/i.test(e.event_type || "")) || latest[0];
  const short = (c) => (c ? String(c).slice(0, 7) : "?");
  const agrees = deploy?.commit_hash && v?.commit ? short(deploy.commit_hash) === short(v.commit) : null;
  const alarm = latest.some(e => isAlarm(e));
  return (
    <Panel title="Deployments" data-admin-deployments=""
      code="/api/version is this server's own answer; the events are Railway's webhook (D76), stored as they arrive. RAILWAY_WEBHOOK_TOKEN signs them."
      purpose="What this server is running, and what Railway last did. If the two disagree, a push has not deployed yet — or failed to."
      numbers={v ? [[short(v.commit), `running · started ${ago(Math.floor(Date.parse(v.startedAt) / 1000))}`, !!v.commit],
        [num(v.migrations?.count), `migrations · last ${v.migrations?.latestApplied ?? "—"}`],
        [deploy ? (deploy.state || deploy.event_type) : "—", deploy ? `Railway, ${ago(deploy.received_at)}` : "no Railway event yet", deploy && !isAlarm(deploy)],
        [agrees == null ? "—" : agrees ? "Yes" : "No", "running = last deployed", agrees === true]] : []}>
      <Err msg={err}/>
      {alarm && <div style={{ ...callout(C.DANGER), marginBottom: 10 }} data-deploy-alarm="">A deploy failed or crashed, or a volume alert fired — the red row below says which.</div>}
      {agrees === false && <div style={{ ...callout(C.WARNING), marginBottom: 10 }}>This server runs {short(v.commit)}; Railway's last event names {short(deploy.commit_hash)}.</div>}
      {v && (
        <KV theme={theme} rows={[
          ["commit", v.commit ? `${v.commit} (${v.commitSource})` : `unknown (${v.commitSource})`, v.commit ? null : C.WARNING],
          ["process started", `${v.startedAt} (${ago(Math.floor(Date.parse(v.startedAt) / 1000))})`],
          ["mobile contract", v.contract ?? "—"],
          ["migrations", `${num(v.migrations?.count)} applied · highest ${v.migrations?.highestNumbered ?? "—"} · last ${v.migrations?.latestApplied ?? "—"}`],
          ["ATS term weights", w ? `${w.state}${w.weightedScoring ? " — weighted scoring" : " — UNWEIGHTED scoring"}${w.ageDays != null ? ` · ${w.ageDays} days old` : ""}${w.corpusSize ? ` · corpus ${num(w.corpusSize)}` : ""}` : "—",
            w && !w.weightedScoring ? C.DANGER : null],
          w?.refresh && ["weight refresh", refreshLine(w.refresh), w.refresh.lastRun?.error ? C.DANGER : null],
          ["monetisation", v.monetisationEnabled ? "ON — plan gates enforced" : "off — every tool open"],
        ]}/>
      )}
      <h3 style={{ ...h2, fontSize: 15, margin: "14px 0 6px" }}>Railway's last event, per service</h3>
      {d && (latest.length
        ? <KV theme={theme} rows={latest.map(e => [
            e.service_name || "?",
            `${e.event_type}${e.commit_hash ? ` · ${short(e.commit_hash)}` : ""} · ${e.environment_name || "?"} · ${ago(e.received_at)}`,
            isAlarm(e) ? C.DANGER : (["success", "deployed", "redeployed"].includes(e.state) ? C.SUCCESS : null),
          ])}/>
        : <div style={quiet}>No event received yet — the webhook is set in Railway → Project Settings → Webhooks, with the header <code>Authorization: Bearer &lt;RAILWAY_WEBHOOK_TOKEN&gt;</code>.</div>)}
      <div style={{ marginTop: 10, ...row }}><Btn theme={theme} onClick={load}>Re-read</Btn>{readAt && <span style={quiet}>read {stamp(readAt)}</span>}</div>
    </Panel>
  );
}

// ⭐ D83 rebuild #3 (39d) · TODAY → DISK AND BACKUPS — audit #4 + #15b. Railway's volume alert is Pro-only; this is
// it: green below 70%, amber to 85%, red above (the server's toneFor — one rule). The D74 tranche line is what 25
// more companies would do, by this database's numbers. Backup now is the one accent; Restore confirms in the page,
// says the current data is saved first, and that restoring that safety copy undoes it.
const DISK_TONE = { green: C.SUCCESS, amber: C.WARNING, red: C.DANGER };
const mbOf = (n) => (n >= 10 * 1073741824 ? `${num(Math.round(n / 1073741824))} GB` : `${num(Math.round((n || 0) / 1048576))} MB`);
const sizeOf = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const BACKUP_TONE = { "auto-daily": C.INFO, manual: C.INK_FAINT, "pre-restore": C.WARNING };
export function DiskPanel({ theme }) {
  const [g, setG] = useState(null);
  const [backups, setBackups] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => {
    setErr(null);
    api("/api/admin/disk").then(setG).catch(e => setErr(e.message));
    api("/api/admin/backups").then(b => setBackups(Array.isArray(b) ? b : [])).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  const backupNow = async () => {
    setBusy("backup"); setErr(null); setMsg(null);
    try { const r = await api("/api/admin/backups", { method: "POST", body: JSON.stringify({ label: "manual" }) }); setMsg(`Backup created: ${r.filename}`); load(); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const restore = async (b) => {
    if (!await ask({ title: "Restore this backup?", label: "Restore it",
      body: <>The database is replaced with <code>{b.filename}</code> ({new Date(b.created).toLocaleString()}). The current data is backed up first, as a
        <b> pre-restore</b> copy — restoring that copy undoes this. The server must be restarted afterwards for the restore to take effect.</> })) return;
    setBusy("restore"); setErr(null); setMsg(null);
    try { const r = await api("/api/admin/backups/restore", { method: "POST", body: JSON.stringify({ filename: b.filename }) }); setMsg(`${r.message} Restart the server now to apply it.`); load(); }
    catch (e) { setErr(`Restore failed: ${e.message}`); }
    setBusy(null);
  };
  const newest = backups?.[0];
  return (
    <Panel title="Disk and backups" data-admin-disk=""
      code="D77: the gauge reads statfs on the data directory. Retention is a byte budget, not a count: at most 30 snapshots and at most 40% of the volume (BACKUP_MAX_COUNT, BACKUP_DISK_SHARE, BACKUP_MAX_BYTES), never fewer than 3 (BACKUP_MIN_KEEP) unless the disk itself cannot hold them."
      purpose="How full the data volume is, and the database backups that can restore it. A daily backup runs at 2:00 server time; the newest of each kind is always kept."
      numbers={g ? [[`${g.usedPct}%`, `of ${mbOf(g.totalBytes)} used · ${mbOf(g.freeBytes)} free`, g.tone === "green"],
        [num(backups?.length ?? g.backups.count), `backups · ${mbOf(g.backups.bytes)} of a ${mbOf(g.backups.budget)} budget`],
        [newest ? ago(Math.floor(new Date(newest.created).getTime() / 1000)) : "never", "the newest backup", !!newest],
        g.tranche25 ? [`${g.tranche25.projectedPct}%`, `after 25 more companies (gate ${g.tranche25.limit}%)`, g.tranche25.projectedPct <= g.tranche25.limit] : null].filter(Boolean) : []}>
      {dialog}
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 8 }}>{msg}</div>}
      {g && g.tone !== "green" && <div style={{ ...callout(DISK_TONE[g.tone] || C.WARNING), marginBottom: 10 }}>The volume is {g.tone} at {g.usedPct}% (amber {g.amberAt}%, red {g.redAt}%).</div>}
      <div style={{ ...row, marginBottom: 12 }}>
        <Btn theme={theme} primary disabled={!!busy} onClick={backupNow}>{busy === "backup" ? "Creating…" : "Back up now"}</Btn>
        <Btn theme={theme} onClick={load}>Re-read</Btn>
      </div>
      {g && <div style={{ ...quiet, marginBottom: 12 }}>Largest files: {(g.largest || []).slice(0, 5).map(f => `${f.path} ${mbOf(f.bytes)}`).join(" · ") || "—"}</div>}
      <Table theme={theme} rows={backups || []} empty="No backups yet — Back up now makes the first one." cols={[
        { key: "filename", label: "file", render: b => <span title={b.filename} style={{ fontFamily: "monospace" }}>{b.filename}</span> },
        { key: "label", label: "kind", render: b => <span style={markStyle(BACKUP_TONE[b.label] || C.INK_FAINT)}>{b.label}</span> },
        { key: "created", label: "created", render: b => new Date(b.created).toLocaleString() },
        { key: "size", label: "size", right: true, render: b => (b.size ? sizeOf(b.size) : "—") },
        { key: "restore", label: "", render: b => <Btn theme={theme} disabled={!!busy} onClick={() => restore(b)}>Restore…</Btn> },
      ]}/>
    </Panel>
  );
}

// ── D78 A · the board's age policy — GET/PUT /api/admin/board-policy, POST …/sweep ─────────────────────
// New postings past the limit are never written (always on). Retiring EXISTING ones waits for the owner's
// "Enforce" after reading this dry run; applied postings are always kept; nothing is deleted.
export function BoardPolicySection({ theme }) {
  // ⭐ D83 rebuild #6 (39d) · THE BOARD → SCOPE AND AGE: the two rules side by side, each with its numbers, its
  // state and its one write — no red button is the loudest thing on the page any more (the audit); every switch and
  // sweep confirms in the page and says what it changes, what undoes it, and that a sweep has no undo button.
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => { setErr(null); api("/api/admin/board-policy").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const put = async (patch) => { try { await api("/api/admin/board-policy", { method: "PUT", body: JSON.stringify(patch) }); load(); } catch (e) { setErr(e.message); } };
  const pct = (x) => (x > 0 && x < 0.005 ? "under 1%" : `${Math.round((x || 0) * 100)}%`);
  const KEPT = "Applied postings are always kept, and nothing is deleted — a retired posting stays in the database, off the board. There is no undo button for a sweep.";
  const sweep = async () => {
    const r = d?.dryRun;
    if (!r || !await ask({ title: `Retire ${num(r.candidates)} old posting${r.candidates === 1 ? "" : "s"}?`, label: `Retire ${num(r.candidates)}`,
      body: <>These are older than {r.limitDays} days — {pct(r.share)} of the active board. {KEPT}</> })) return;
    try {
      const out = await api("/api/admin/board-policy/sweep", { method: "POST", body: JSON.stringify({ apply: true, expectCandidates: r.candidates }) });
      setNote(`Retired ${out.retired}.`); load();
    } catch (e) { setErr(e.message); }
  };
  // D78 B: the computer-science scope — the same contract as the age sweep (dry run, echo the count).
  const scopeSweep = async () => {
    const q = d?.scopeDryRun;
    if (!q || !await ask({ title: `Retire ${num(q.candidates)} out-of-scope posting${q.candidates === 1 ? "" : "s"}?`, label: `Retire ${num(q.candidates)}`,
      body: <>These are outside computer science — {pct(q.share)} of the active board. {KEPT}</> })) return;
    try {
      const out = await api("/api/admin/board-policy/scope-sweep", { method: "POST", body: JSON.stringify({ apply: true, expectCandidates: q.candidates }) });
      setNote(`Retired ${out.retired} out of scope.`); load();
    } catch (e) { setErr(e.message); }
  };
  const toggle = async (key, on, what) => {
    if (!await ask({ title: on ? `Start enforcing ${what}?` : `Stop enforcing ${what}?`, label: on ? "Enforce it" : "Stop enforcing",
      body: on ? <>From now on, existing postings that break it are retired at each crawl and by the 03:30 sweep. Stop enforcing undoes the switch; postings
        already retired stay retired. {KEPT.split(" — ")[0]}.</>
        : <>Nothing more is retired for this rule; the dry run below keeps counting. Postings already retired stay retired.</> })) return;
    put({ [key]: on });
  };
  const p = d?.policy, r = d?.dryRun, q = d?.scopeDryRun;
  const sub = { border: `1px solid ${theme.border}`, borderRadius: 11, padding: "12px 14px", marginBottom: 12 };
  return (
    <Panel title="Scope and age" data-admin-scope=""
      code="D78: the board's scope — computer science only (D78 B, the rule's version is shown) and the 120-day age limit (D78 A). New postings that break either are never written; these switches decide whether EXISTING ones are retired too."
      purpose="Which postings the board keeps: computer-science roles, no older than the age limit. New postings that break a rule are never added; the counts below are what retiring the existing ones would do."
      numbers={p && r && q ? [[`${p.age_limit_days} days`, "the age limit"],
        [num(r.candidates), `older than that · ${pct(r.share)} of the board`],
        [num(q.candidates), `outside computer science · ${pct(q.share)}`],
        [`${p.age_enforce ? "On" : "Off"} · ${p.scope_enforce ? "On" : "Off"}`, "retiring existing ones: age · scope"]] : []}>
      {dialog}
      <Err msg={err}/>
      {note && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 8 }}>{note}</div>}
      {p && r && (
        <div style={sub} data-policy-age="">
          <h3 style={{ ...h2, fontSize: 15, margin: "0 0 6px" }}>Age — {p.age_limit_days} days</h3>
          <div style={{ fontSize: 12, marginBottom: 8, color: p.age_enforce ? C.WARNING : theme.text }}>
            {p.age_enforce ? "Enforced — old postings are retired at the crawl and by the 03:30 sweep." : "Report only — nothing is retired until you enforce."}</div>
          <KV theme={theme} rows={[
            ["would retire", `${num(r.candidates)} (${Object.entries(r.byBasis).map(([k, v]) => `${v} by ${k}`).join(", ") || "—"})`],
            ["by company", r.byCompany.slice(0, 8).map(([c, n]) => `${c} ${n}`).join(" · ") || "—"],
            ["by source", Object.entries(r.bySource).map(([s, n]) => `${s} ${n}`).join(" · ") || "—"],
          ]}/>
          <div style={{ ...row, marginTop: 8 }}>
            <Btn theme={theme} onClick={() => toggle("age_enforce", !p.age_enforce, "the age limit")}>{p.age_enforce ? "Stop enforcing…" : "Enforce on existing postings…"}</Btn>
            {r.candidates > 0 && <Btn theme={theme} onClick={sweep}>Run the sweep now…</Btn>}
          </div>
        </div>
      )}
      {p && q && (
        <div style={sub} data-policy-scope="">
          <h3 style={{ ...h2, fontSize: 15, margin: "0 0 6px" }}>Computer science only<Help tip={`The scope rule, version ${q.version}.`}/></h3>
          <div style={{ fontSize: 12, marginBottom: 8, color: p.scope_enforce ? C.WARNING : theme.text }}>
            {p.scope_enforce ? "Enforced — out-of-scope postings are not written, and existing ones are retired at the crawl and by the 03:30 sweep." : "Report only — nothing is dropped until you enforce."}</div>
          <KV theme={theme} rows={[
            ["would retire", `${num(q.candidates)} of ${num(q.active)}${q.appliedKept ? ` · ${q.appliedKept} applied kept` : ""}`],
            ["by family", Object.entries(q.byFamily).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(" · ") || "—"],
            ["by rule", Object.entries(q.byReason).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(" · ") || "—"],
            ["by company", q.byCompany.slice(0, 8).map(([c, n]) => `${c} ${n}`).join(" · ") || "—"],
          ]}/>
          <div style={{ ...row, marginTop: 8 }}>
            <Btn theme={theme} onClick={() => toggle("scope_enforce", !p.scope_enforce, "the computer-science scope")}>{p.scope_enforce ? "Stop enforcing…" : "Enforce the scope…"}</Btn>
            {q.candidates > 0 && <Btn theme={theme} onClick={scopeSweep}>Run the scope sweep now…</Btn>}
          </div>
        </div>
      )}
      <BoardCategories theme={theme} sub={sub}/>
      <Btn theme={theme} onClick={load}>Re-read</Btn>
    </Panel>
  );
}

// ⛔ D127 P2 · every shown posting in ONE category; the held ones never shown. GET /api/admin/board-categories: the
// counts, the held reasons, and a random sample of up to 20 per category to spot-check — "Wrong category" is the one
// press that logs it (POST …/report → the audit log).
function BoardCategories({ theme, sub }) {
  const [c, setC] = useState(null);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(null);
  const [reported, setReported] = useState({});
  const load = useCallback(() => { api("/api/admin/board-categories").then(setC).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const report = async (jobId) => {
    try { await api("/api/admin/board-categories/report", { method: "POST", body: JSON.stringify({ jobId }) }); setReported(r => ({ ...r, [jobId]: true })); }
    catch (e) { setErr(e.message); }
  };
  if (!c) return <Err msg={err}/>;
  const list = (o) => Object.entries(o).map(([k, n]) => `${k} ${num(n)}`).join(" · ") || "—";
  return (
    <div style={sub} data-board-categories="">
      <h3 style={{ ...h2, fontSize: 15, margin: "0 0 6px" }}>Categories — every professional role, nothing from an unknown one</h3>
      <Err msg={err}/>
      <KV theme={theme} rows={[
        ["on the board", list(c.byCategory)],
        ["engineering by discipline", list(c.byDiscipline)],
        ["held, never shown", `${num(c.held.total)} — ${list(c.held.byReason)}`],
        ["wrong-category reports", `${c.reports.length}`],
      ]}/>
      <div style={{ ...row, marginTop: 8, flexWrap: "wrap" }}>
        {Object.keys(c.sample).map(k => <Btn key={k} theme={theme} primary={open === k} onClick={() => setOpen(open === k ? null : k)}>Spot-check {k}</Btn>)}
      </div>
      {open && (
        <Table theme={theme} empty="No postings in this category." rows={c.sample[open] || []} cols={[
          { key: "title", label: "Posting" }, { key: "company", label: "Company" },
          { key: "reason", label: "Why", render: j => j.reason + (j.discipline ? ` · ${j.discipline}` : "") },
          { key: "job_id", label: "", render: j => (reported[j.job_id] ? "Reported"
            : <Btn theme={theme} onClick={() => report(j.job_id)}>Wrong category</Btn>) },
        ]}/>
      )}
    </div>
  );
}

/** The Admin banner — shown on every admin tab while the disk is amber or red. */
export function DiskBanner() {
  const [g, setG] = useState(null);
  useEffect(() => { api("/api/admin/disk").then(setG).catch(() => {}); }, []);
  if (!g || (g.tone !== "amber" && g.tone !== "red")) return null;
  return (
    <div role="alert" data-disk-banner={g.tone} style={{ margin: "0 0 16px", padding: "10px 14px", borderLeft: `4px solid ${DISK_TONE[g.tone]}`, color: DISK_TONE[g.tone], fontWeight: 700, fontSize: 13 }}>
      The volume is {g.usedPct}% full ({mbOf(g.usedBytes)} of {mbOf(g.totalBytes)}) — {g.tone === "red" ? "free space now" : "plan for it"}. No company tranche is enabled above {g.tranche25?.limit ?? 70}%.
    </div>
  );
}

// ── D75 STEP 0b · Admin → Crawler — the control panel (GET/PUT /api/admin/crawler…) ─────────────────
// Pause / Resume, Dry-run / Live, the schedule and the per-run cap live in DRAFT's database — a press here
// changes them with no redeploy. CRAWLER_PAUSED (the env) is a second, independent kill switch, shown when on.
const CRAWL_TONE = { found: C.SUCCESS, none: C.INK_FAINT, blocked: C.WARNING, error: C.DANGER, dry_run: C.INK_FAINT };
// ⭐ D83 rebuild #2 (39d) · THE BOARD → CRAWLER, to the six rules: the state as numbers on open; ONE accent — Resume,
// and only while paused (Pause and Live are ordinary buttons; Live confirms in the page); the cap, the time and the
// count are real fields with one Save (they were browser prompts); the deny-list's Remove picks from the list itself;
// Flag wrong asks for its note in a dialog.
export function CrawlerTab({ theme }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState(null);
  const [settings, setSettings] = useState(null);       // the editable copy of cap / time / count
  const [deny, setDeny] = useState({ add: "", remove: "" });
  const [flagging, setFlagging] = useState(null);       // { task, note }
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => { setErr(null); api("/api/admin/crawler").then(r => { setD(r); setSettings(null); }).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const put = async (patch) => {
    try { await api("/api/admin/crawler/state", { method: "PUT", body: JSON.stringify(patch) }); load(); } catch (e) { setErr(e.message); }
  };
  const enqueue = async (path, body) => {
    try {
      const r = await api(path, { method: "POST", body: JSON.stringify(body || {}) });
      const q = (r.tasks || []).filter(t => t.status === "queued").length;
      setNote(`${q} queued${r.capped ? ` · ${r.capped} over the per-run cap of ${r.cap}, not queued` : ""}${(r.tasks || []).some(t => t.status !== "queued") ? ` · ${(r.tasks || []).filter(t => t.status !== "queued").length} refused or invalid` : ""}`);
      load();
    } catch (e) { setErr(e.message); }
  };
  const sendFlag = async () => {
    const { task: t, note: n } = flagging;
    try { await api(`/api/admin/crawler/tasks/${t.id}/flag`, { method: "POST", body: JSON.stringify({ wrong: !t.flagged_wrong, note: n }) }); setFlagging(null); load(); }
    catch (e) { setErr(e.message); }
  };
  const goLive = async () => {
    if (await ask({ title: "Switch the crawler to Live?", label: "Go live",
      body: "The worker will request real public pages — robots.txt is honoured and the deny-list wins over every task. Dry-run switches it back." })) put({ mode: "live" });
  };
  const addDeny = async () => {
    const v = deny.add.trim(); if (!v) return;
    if (!await ask({ title: `Deny ${v}?`, label: "Deny it", body: `No task may request ${v}; anything already queued for it is refused. Remove undoes it.` })) return;
    try { await api("/api/admin/crawler/deny", { method: "POST", body: JSON.stringify({ domain: v, reason: "owner" }) }); setDeny({ ...deny, add: "" }); load(); } catch (e) { setErr(e.message); }
  };
  const removeDeny = async () => {
    const v = deny.remove; if (!v) return;
    if (!await ask({ title: `Allow ${v} again?`, label: "Remove from the deny-list", body: `Tasks may request ${v} again. Deny undoes it.` })) return;
    try { await api(`/api/admin/crawler/deny/${encodeURIComponent(v)}`, { method: "DELETE" }); setDeny({ ...deny, remove: "" }); load(); } catch (e) { setErr(e.message); }
  };
  const st = d?.state, b = d?.budget, paused = d?.pause?.paused;
  const s = settings || (st ? { per_run_cap: st.per_run_cap, schedule_hhmm: st.schedule_hhmm, schedule_tasks: st.schedule_tasks } : null);
  const dirty = !!(settings && st && (Number(settings.per_run_cap) !== st.per_run_cap || settings.schedule_hhmm !== st.schedule_hhmm || Number(settings.schedule_tasks) !== st.schedule_tasks));
  const input = { background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12 };
  const lbl = { fontSize: 12, color: theme.textMuted, display: "flex", flexDirection: "column", gap: 4 };
  return (
    <Panel title="Crawler" data-admin-crawler=""
      code="D75: the crawler worker. J1 finds a company's job board from its home page; J2 learns where Apply lands. The switches live in draft's database (STEP 0b), so no redeploy; CRAWLER_PAUSED on the server is a second, harder switch."
      purpose="A separate worker that visits public pages to find a company's job board. It works only while running, sends nothing in Dry-run, and every task it ran waits here with what it found."
      numbers={d ? [[paused ? "Paused" : "Running", paused ? "the worker leases nothing" : "the worker may lease tasks", !paused],
        [st.mode === "live" ? "Live" : "Dry-run", st.mode === "live" ? "requests real public pages" : "no request leaves"],
        [`${num(b.tasksToday)} / ${num(b.dailyCap)}`, `tasks today · ${num(b.pagesToday)} pages · ${num(b.minutesToday)} min`],
        [num(d.candidates.length), "captured companies we cannot crawl"],
        [num(d.wrongAnswers), "answers flagged wrong"]] : []}>
      {dialog}
      {flagging && (
        <Dialog title={flagging.task.flagged_wrong ? `Clear the flag on task ${flagging.task.id}?` : `What is wrong with task ${flagging.task.id}?`}
          confirmLabel={flagging.task.flagged_wrong ? "Clear the flag" : "Flag it wrong"} onCancel={() => setFlagging(null)} onConfirm={sendFlag}>
          <div style={{ marginBottom: 8 }}>{flagging.task.target_host}</div>
          {!flagging.task.flagged_wrong && <textarea aria-label="What is wrong" rows={3} value={flagging.note} autoFocus
            onChange={e => setFlagging({ ...flagging, note: e.target.value })} style={{ ...field, width: "100%", boxSizing: "border-box" }}/>}
        </Dialog>
      )}
      <Err msg={err}/>
      {d && (<>
        <div style={{ ...row, marginBottom: 6 }}>
          {paused
            ? <Btn theme={theme} primary disabled={d.pause.by === "env"} onClick={() => put({ paused: false })}>▶ Resume</Btn>
            : <Btn theme={theme} onClick={() => put({ paused: true })}>❚❚ Pause</Btn>}
          {st.mode === "live"
            ? <Btn theme={theme} onClick={() => put({ mode: "dry" })}>Dry-run — no request leaves</Btn>
            : <Btn theme={theme} onClick={goLive}>Live…</Btn>}
          <span style={quiet}>{d.pause.by === "env" ? "Paused by CRAWLER_PAUSED on the server — Resume here cannot override it." : st.updated_at ? `last changed ${ago(st.updated_at)}` : "never changed"}</span>
        </div>
        <div style={{ fontSize: 12, marginBottom: 14, color: d.worker?.silent ? C.WARNING : theme.textMuted }}>
          {d.worker?.lastSeen ? `The worker last called ${ago(d.worker.lastSeen)} (${d.worker.lastCall})${d.worker.silent ? " — silent since: is it running?" : "."}` : "The worker has never called draft."}
        </div>

        <h3 style={{ ...h2, fontSize: 15, margin: "0 0 8px" }}>Settings</h3>
        <div style={{ ...row, alignItems: "flex-end", marginBottom: 6 }}>
          <label style={lbl}>Tasks per enqueue (1–100)
            <input type="number" min={1} max={100} value={s.per_run_cap} onChange={e => setSettings({ ...s, per_run_cap: e.target.value })} style={{ ...input, width: 90 }}/></label>
          <label style={lbl}>Daily run at (UTC)
            <input type="time" value={s.schedule_hhmm} onChange={e => setSettings({ ...s, schedule_hhmm: e.target.value })} style={input}/></label>
          <label style={lbl}>Tasks per daily run (1–100)
            <input type="number" min={1} max={100} value={s.schedule_tasks} onChange={e => setSettings({ ...s, schedule_tasks: e.target.value })} style={{ ...input, width: 90 }}/></label>
          <Btn theme={theme} disabled={!dirty} onClick={() => put({ per_run_cap: Number(s.per_run_cap), schedule_hhmm: s.schedule_hhmm, schedule_tasks: Number(s.schedule_tasks) })}>Save settings</Btn>
          <Btn theme={theme} onClick={() => put({ schedule_enabled: !st.schedule_enabled })}>{st.schedule_enabled ? "Turn the daily run off" : "Turn the daily run on"}</Btn>
        </div>
        <div style={{ ...quiet, marginBottom: 16 }}>
          {st.schedule_enabled ? `The daily run is on: ${st.schedule_tasks} tasks from the captured companies at ${st.schedule_hhmm} UTC${st.schedule_last_date ? `; last ran ${st.schedule_last_date}` : ""}.` : "The daily run is off."}
        </div>

        <h3 style={{ ...h2, fontSize: 15, margin: "0 0 8px" }}>Queue tasks</h3>
        <div style={{ ...row, marginBottom: 6 }}>
          <Btn theme={theme} disabled={!d.candidates.length} onClick={() => enqueue("/api/admin/crawler/tasks/captures")}>Queue captured companies ({d.candidates.length})</Btn>
        </div>
        <textarea aria-label="Domains to queue" value={paste} onChange={e => setPaste(e.target.value)} rows={3} placeholder="https://company.com — one per line"
          style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 12, padding: 8, background: theme.bg, color: theme.text, border: `1px solid ${theme.border || C.INK_FAINT}`, borderRadius: 6 }}/>
        <div style={{ ...row, marginTop: 6, marginBottom: 6 }}>
          <Btn theme={theme} disabled={!paste.trim()} onClick={() => enqueue("/api/admin/crawler/tasks", { type: "j1_find_board", urls: paste.split(/\s+/).filter(Boolean) })}>Queue pasted domains</Btn>
          {note && <span style={quiet}>{note}</span>}
        </div>

        <h3 style={{ ...h2, fontSize: 15, margin: "16px 0 8px" }}>Queue and results</h3>
        <div style={{ ...quiet, marginBottom: 6 }}>{d.tally.map(t => `${t.type === "j1_find_board" ? "find a board" : "where Apply lands"}: ${t.outcome} ${t.n}`).join(" · ") || "Nothing has run yet."}</div>
        <Table theme={theme} rows={d.tasks} empty="No tasks yet." cols={[
          { key: "id", label: "#" }, { key: "target_host", label: "target" }, { key: "mode", label: "mode", render: t => t.mode || "—" },
          { key: "status", label: "status", render: t => <span style={markStyle(CRAWL_TONE[t.result_status] || C.INK_FAINT)}>{t.result_status || t.status}</span> },
          { key: "why", label: "why", render: t => [t.refused_reason, t.error].filter(Boolean).join(" — ") || "—" },
          { key: "evidence", label: "evidence / landing", render: t => (t.evidence || []).map(e => `${e.url} (${e.how})`).join(" · ") || (t.formOrigin ? `${t.formOrigin} · ${t.stoppedAt}` : "—") },
          { key: "flag", label: "", render: t => <Btn theme={theme} onClick={() => setFlagging({ task: t, note: "" })}>{t.flagged_wrong ? `wrong: ${t.flag_note || "flagged"} — clear…` : "Flag wrong…"}</Btn> },
        ]}/>

        <h3 style={{ ...h2, fontSize: 15, margin: "16px 0 4px" }}>Deny-list</h3>
        <div style={{ ...quiet, marginBottom: 8 }}>Domains no task may request — this wins over every task. {d.denyList.length} listed{d.denyList.length ? `: ${d.denyList.join(" · ")}` : ""}.</div>
        <div style={row}>
          <input aria-label="Domain to deny" placeholder="example.com" value={deny.add} onChange={e => setDeny({ ...deny, add: e.target.value })} style={{ ...input, width: 200 }}/>
          <Btn theme={theme} disabled={!deny.add.trim()} onClick={addDeny}>Deny…</Btn>
          <select aria-label="Domain to allow again" value={deny.remove} onChange={e => setDeny({ ...deny, remove: e.target.value })} style={input} disabled={!d.denyList.length}>
            <option value="">{d.denyList.length ? "Pick a denied domain" : "Nothing denied"}</option>
            {d.denyList.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <Btn theme={theme} disabled={!deny.remove} onClick={removeDeny}>Remove…</Btn>
        </div>
      </>)}
    </Panel>
  );
}

// ── Full-auto kill switch — GET / PUT / DELETE /api/admin/full-auto ────────────────────────────
// Three states, not two (see server.js): forced off, pinned on, inherit the deploy. The panel shows
// which one is in force and WHY, because "disabled: true" alone cannot tell you whether clearing the
// override changes anything. D83 rebuild #7 (39d): the Panel shell, the numbers, the confirms in the page.
export function KillSwitchSection({ theme }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => {
    setErr(null);
    api("/api/admin/full-auto").then(setS).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (kind) => {
    if (!s) return;
    const msg = {
      disable: { title: "Stop full-auto submission?", label: "Stop full-auto",
        body: "Every full-auto run stops submitting at its next job (it is checked per job, not only at the start). Semi mode keeps working. Nothing is deleted; Pin or Clear undoes it." },
      pin: { title: "Pin full-auto ON?", label: "Pin it on",
        body: <>⚠ Real applications will be submitted to employers by full-auto runs. This OVERRIDES the deploy: even if a later deploy sets
          APPLY_FULL_AUTO_DISABLED=1, full-auto stays on until the override is cleared here.</> },
      clear: { title: "Clear the override and follow the deploy?", label: "Clear the override",
        body: <>Full-auto will then be {s.envDefault ? "STOPPED" : "ON"} (APPLY_FULL_AUTO_DISABLED={s.envRaw ?? "unset"}).
          {s.envDefault ? "" : " ⚠ That means real applications resume being submitted."}</> },
    }[kind];
    if (!await ask(msg)) return;
    setBusy(true); setErr(null);
    try {
      const body = kind === "clear" ? undefined : JSON.stringify({ disabled: kind === "disable" });
      setS(await api("/api/admin/full-auto", { method: kind === "clear" ? "DELETE" : "PUT", ...(body ? { body } : {}) }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <Panel title="Full-auto submission" data-admin-killswitch=""
      code="The kill switch (A50, AF residual): app_settings.apply_full_auto_disabled overrides the deploy's APPLY_FULL_AUTO_DISABLED. Read at request time, never cached."
      purpose="Whether full-auto runs may submit applications to employers by themselves. Stopping is the safe direction and never destructive; semi mode is unaffected either way."
      numbers={s ? [[s.disabled ? "Stopped" : "On", s.disabled ? "no run submits by itself" : "runs submit to employers", s.disabled],
        [s.source === "override" ? "Here" : "The deploy", "decides it"],
        [s.envDefault ? "Stopped" : "On", `what the deploy says (APPLY_FULL_AUTO_DISABLED=${s.envRaw ?? "unset"})`]] : []}>
      {dialog}
      <Err msg={err}/>
      {s && (
        <div style={row}>
          <Btn theme={theme} primary disabled={busy || (s.disabled && s.source === "override")} onClick={() => act("disable")}>Stop full-auto…</Btn>
          <Btn theme={theme} disabled={busy || (!s.disabled && s.source === "override")} onClick={() => act("pin")}>Pin full-auto ON…</Btn>
          <Btn theme={theme} disabled={busy || s.source !== "override"} onClick={() => act("clear")}>Clear the override (follow the deploy)…</Btn>
        </div>
      )}
    </Panel>
  );
}

// ── ⛔ D175 FA6 · FULL AUTO's safety checks — GET / POST /api/admin/full-auto/prerequisites ───────────────────────
// FULL AUTO's own sends HOLD (`full_auto_prerequisites`) until all four are green (services/fullAutoGate.js). Two are
// read from the code and the cost alarm; two are tests an admin runs and records here (each good for 30 days).
// Recording asks what was tested (≥ 10 characters) and writes an admin_audit_log row; Clear un-records it.
const FA6_RECORDABLE = ["kill_switch_verified", "never_twice_verified"];
export function FullAutoPrerequisitesSection({ theme }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState({});
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => {
    setErr(null);
    api("/api/admin/full-auto/prerequisites").then(setS).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  const send = async (check, body) => {
    setBusy(true); setErr(null);
    try {
      setS(await api("/api/admin/full-auto/prerequisites", { method: "POST", body: JSON.stringify({ check, ...body }) }));
      setReason(r => ({ ...r, [check]: "" }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const clear = async (c) => {
    if (!await ask({ title: `Clear "${c.label}"?`, label: "Clear it",
      body: "FULL AUTO's own sends hold again until it is recorded anew. Nothing already sent is touched. Audited." })) return;
    send(c.id, { clear: true });
  };
  const red = s ? s.checks.filter(c => !c.ok).length : 0;
  return (
    <Panel title="Full-auto safety checks" data-admin-fullauto-prereqs=""
      code="D175 FA6: services/fullAutoGate.js — routes/apply.js holds an unattended submit (full_auto_prerequisites) and the apply worker leaves such a run queued until every check is green. Recorded tests expire after 30 days."
      purpose="Whether FULL AUTO may send an application nobody pressed Submit on. Approvals and a pick's Apply tap are never held by this."
      numbers={s ? [[s.allOk ? "Green" : "Held", s.allOk ? "unattended sends may go" : `${red} of ${s.checks.length} checks red`, !s.allOk]] : []}>
      {dialog}
      <Err msg={err}/>
      {s && s.checks.map(c => (
        <div key={c.id} data-prereq={c.id} data-prereq-ok={c.ok ? "1" : "0"}>
          <div style={what}><span style={markStyle(c.ok ? C.SUCCESS : C.WARNING)}>{c.ok ? "Green" : "Red"}</span> {c.label}</div>
          <div style={quiet}>{c.why}{c.id === "cost_alarm" && !c.ok ? " — set it in System → Model usage, or MODEL_DAILY_COST_ALARM_USD." : ""}</div>
          {FA6_RECORDABLE.includes(c.id) && (
            <div style={row}>
              <input style={field} value={reason[c.id] || ""} placeholder="What was tested, where, and what happened"
                aria-label={`What was tested for: ${c.label}`}
                onChange={e => setReason(r => ({ ...r, [c.id]: e.target.value }))}/>
              <Btn theme={theme} primary disabled={busy || (reason[c.id] || "").trim().length < 10}
                onClick={() => send(c.id, { reason: reason[c.id] })}>Record as passed</Btn>
              <Btn theme={theme} disabled={busy || !c.ok} onClick={() => clear(c)}>Clear…</Btn>
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}

// ── D123 Tailoring — GET / PUT / DELETE /api/admin/tailoring ───────────────────────────────────
// Owner 11-01: "switch the prompt between lean or the payload from the admin panel, or the model being used from the
// users side". The mode wins over DRAFT_TAILORING (Clear follows the deploy again); the model default and the list a
// person may pick from apply from the next tailoring. No deploy, no restart.
const MODE_TEXT = {
  full: "the whole résumé written by the model (≈ 13¢)",
  lean: "Haiku edits bullets and skills as JSON",
  payload: "the job block + per-employer gists; new bullets only inside a gist",
  code: "no model: Skills, coursework and bullet order by code (0¢)",
};
export function TailoringAdminSection({ theme }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/admin/tailoring").then(setS).catch(e => setErr(e.message)); }, []);
  const send = async (method, body) => {
    setBusy(true); setErr(null);
    try { setS(await api("/api/admin/tailoring", { method, ...(body ? { body: JSON.stringify(body) } : {}) })); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const m = s?.models;
  const toggleOffered = (id) => send("PUT", { modelsOffered: m.offered.includes(id) ? m.offered.filter(x => x !== id) : [...m.offered, id] });
  return (
    <Panel title="Tailoring" data-admin-tailoring=""
      code="D123: app_settings.tailoring_mode overrides DRAFT_TAILORING; tailoring_model_default and tailoring_models_offered pick the model (contract 1.8.0 options.model). Read per generation."
      purpose="Which tailoring call every Generate uses, and which model runs it. A person picks their model in Settings from the ones offered here; anyone who has not picked gets the default."
      numbers={s ? [[s.mode, MODE_TEXT[s.mode] || "", false], [s.source === "override" ? "Here" : s.source === "env" ? "The deploy" : "Default", "decides it"],
        [m.default === "service" ? "Service" : m.default, "default model"]] : []}>
      <Err msg={err}/>
      {s && <>
        <div style={what}>Prompt</div>
        <div style={row}>
          {s.modes.map(mode => (
            <Btn key={mode} theme={theme} primary={s.mode === mode} disabled={busy} title={MODE_TEXT[mode]}
              onClick={() => send("PUT", { mode })}>{mode}</Btn>
          ))}
          <Btn theme={theme} disabled={busy || s.source !== "override"} onClick={() => send("DELETE")}>Follow the deploy (DRAFT_TAILORING={s.envRaw ?? "unset"})</Btn>
        </div>
        <div style={quiet}>{MODE_TEXT[s.mode]}. Lean when nothing is set. Only lean and payload use the model below — the open model is the tools service's configured provider (e.g. Nemotron through RM_TAILOR_PROVIDER=openai-compatible).</div>
        <div style={what}>Default model</div>
        <div style={row}>
          {["service", ...m.choices].map(id => (
            <Btn key={id} theme={theme} primary={m.default === id} disabled={busy} title={m.labels[id]}
              onClick={() => send("PUT", { modelDefault: id })}>{id === "service" ? "service default" : id}</Btn>
          ))}
        </div>
        <div style={what}>Offered to people</div>
        <div style={row}>
          {m.choices.map(id => (
            <Btn key={id} theme={theme} primary={m.offered.includes(id)} disabled={busy} title={m.labels[id]}
              onClick={() => toggleOffered(id)}>{m.offered.includes(id) ? "✓ " : ""}{id}</Btn>
          ))}
        </div>
        <div style={what}>A+ (Sonnet) — your override, for testing</div>
        <div style={row}>
          <Btn theme={theme} primary={s.aPlusOverride} disabled={busy} data-aplus-override={s.aPlusOverride ? "on" : "off"}
            title="On: an A+ request runs the full A+ route on Sonnet. Off: it is served as a Generate with the strategy and model above."
            onClick={() => send("PUT", { aPlus: !s.aPlusOverride })}>{s.aPlusOverride ? "✓ A+ on" : "A+ off"}</Btn>
        </div>
        <div style={quiet}>{s.aPlusOverride
          ? "A+ is ON: every A+ request (PRO accounts, apply runs) calls the full A+ route on Sonnet — about 6¢ a résumé."
          : "A+ is off the default path: an A+ request is served with the strategy and model above. Turn it on to test A+."} Audited.</div>
        <div style={quiet}>"open" works only when the tools service has RM_OPENAI_COMPAT_BASE_URL, RM_OPENAI_COMPAT_API_KEY and RM_OPEN_MODEL; otherwise
          a Generate
          that asks for it fails with the service's refusal (nothing is spent) — configure it there before offering it. A résumé sent to another provider must be named in the privacy policy first.</div>
      </>}
    </Panel>
  );
}

// ── Board-fit precompute — POST /api/admin/board-fit/precompute ───────────────────────────────
// The route is dry-run by default and so is this: Score is unreachable until a dry run of the SAME
// parameters has been read, and its label is the number of postings it will score.
// D83 rebuild #7 (39d): the dry run is harmless, so it runs on open — the numbers need no click.
export function BoardFitSection({ theme }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [force, setForce] = useState(false);
  const [dry, setDry] = useState(null);       // { key, body }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const { ask, dialog } = useConfirm();
  useEffect(() => {
    // id 0 is the 'system' user (migration 075): it has no profile and nothing to rank.
    api("/api/admin/users").then(d => setUsers((Array.isArray(d) ? d : []).filter(u => u.id !== 0))).catch(() => {});
  }, []);
  const key = `${userId}|${force}`;
  const params = () => ({ ...(userId ? { userId: Number(userId) } : {}), ...(force ? { force: true } : {}) });

  const runDry = useCallback(async () => {
    setBusy("dry"); setErr(null); setResult(null);
    try { setDry({ key, body: await api("/api/admin/board-fit/precompute", { method: "POST", body: JSON.stringify({ ...params(), dryRun: true }) }) }); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { runDry(); }, [runDry]);
  const planFresh = dry && dry.key === key;
  const todo = planFresh ? dry.body.summary?.todo ?? 0 : 0;
  const runReal = async () => {
    const profiles = dry.body.summary?.profiles ?? 0;
    if (!await ask({ title: `Score ${num(todo)} posting(s)?`, label: `Score ${num(todo)}`,
      body: <>Across {profiles} profile(s){force ? " — including postings that already had a fresh score" : ""}. This writes only the board's fit cache:
        no model call, no user's data. About {Math.max(1, Math.round(todo * 0.007))} s. Each board's order changes when the pass commits; the next
        nightly pass recomputes the same scores, so there is nothing to undo.</> })) return;
    setBusy("real"); setErr(null);
    try { setResult(await api("/api/admin/board-fit/precompute", { method: "POST", body: JSON.stringify({ ...params(), dryRun: false }) })); setDry(null); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const body = result || (planFresh ? dry.body : null);
  const sum = body?.summary || {};
  const input = { background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12 };
  return (
    <Panel title="Board-fit scoring" data-admin-boardfit=""
      code="The board-fit precompute: the local ATS scorer (no model, D17) fills ats_only_reports for each active profile; the nightly pass does the same. A score is stale when the profile or the posting changed."
      purpose="Each user's board is ranked by how well every posting fits their active profile. The scores are worked out ahead of time; this shows how many are missing or out of date, and fills them in."
      numbers={sum.profiles != null ? [[num(sum.profiles), "active profiles"], [num(sum.todo ?? 0), result ? "were to score" : "postings to score"],
        [result ? num(sum.scored) : "—", result ? "scored just now" : "scored this session"]] : []}>
      {dialog}
      <div style={{ ...row, marginBottom: 10 }}>
        <select aria-label="Whose profiles" value={userId} onChange={e => setUserId(e.target.value)} style={input}>
          <option value="">every user's active profile</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.username} (id {u.id})</option>)}
        </select>
        <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", color: force ? C.WARNING : theme.text }}>
          <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)}/>
          also re-score postings that already have a fresh score (after a term-weight refresh)
        </label>
      </div>
      <div style={row}>
        <Btn theme={theme} disabled={!!busy} onClick={runDry}>{busy === "dry" ? "Counting…" : "Count again"}</Btn>
        <Btn theme={theme} primary disabled={!planFresh || todo === 0 || !!busy} onClick={runReal}>
          {busy === "real" ? "Scoring…" : planFresh ? `Score ${num(todo)} posting(s)…` : "Score…"}
        </Btn>
        <span style={quiet}>
          {dry && !planFresh ? "The choices changed — counting again." : planFresh && todo === 0 ? "Nothing to do — every active posting already has a fresh score." : null}
        </span>
      </div>
      <Err msg={err}/>
      {body && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6, color: result ? C.SUCCESS : theme.text }}>
            {result ? "RAN — " : "COUNTED — nothing was scored or written · "}
            {sum.profiles ?? 0} profile(s) ·{" "}
            {Object.entries(sum.byStatus || {}).map(([k, n]) => `${k} ${n}`).join(", ") || "no profiles"}
            {result ? ` · ${num(sum.scored)} scored` : ` · ${num(sum.todo)} to score`}
          </div>
          <Table theme={theme} rows={body.results || []} cols={[
            { key: "userId", label: "user" },
            { key: "profileId", label: "profile" },
            { key: "status", label: "status", color: r => (r.status === "failed" ? C.DANGER : r.status === "no_basis" ? C.WARNING : null) },
            { key: "active", label: "active", right: true, render: r => num(r.active) },
            { key: "fresh", label: "fresh", right: true, render: r => num(r.fresh) },
            { key: "missing", label: "missing", right: true, render: r => num(r.missing) },
            { key: "stale", label: "out of date", right: true, render: r => num(r.stale) },
            { key: "todo", label: "to score", right: true, render: r => num(r.todo) },
            { key: "scored", label: "scored", right: true, render: r => (r.scored == null ? "—" : num(r.scored)) },
            { key: "why", label: "note", render: r => r.why || r.error || "" },
          ]}/>
        </div>
      )}
    </Panel>
  );
}

// ── Enrichment backlog — RETIRED by D83 (10-08) ──────────────────────────────────────────────
// The "Count the backlog" section that stood here is the panel D83 names as the anti-example: a number shown
// only after a click, a free-text source box, and the real work on another page. Admin → Enrichment
// (panels/adminEnrichment.jsx) is the whole round trip now, its numbers loaded on open.

// ── Job data in and out — /api/admin/job-data (A62) ───────────────────────────────────────────
// The JOBS, not their enrichment (that round trip is Admin → Enrichment). Export the board as
// NDJSON; import postings through the one gateway — dry run first, "Import N" only for the text
// that was planned, every import a batch that can be reverted (dry run, then the matching count).
// D83 rebuild #7 (39d): the one place for postings in and out (audit #8) — a path, Revert beside each batch.
export function JobDataSection({ theme }) {
  const [text, setText] = useState("");
  const [dry, setDry] = useState(null);       // { forText, body }
  const [result, setResult] = useState(null);
  const [batches, setBatches] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const { ask, dialog } = useConfirm();
  const loadBatches = useCallback(() => {
    api("/api/admin/job-data/import/batches").then(d => setBatches(d?.batches || [])).catch(() => {});
  }, []);
  useEffect(() => { loadBatches(); }, [loadBatches]);
  const exportHref = () => {
    const qs = new URLSearchParams();
    const ctx = authContextQuery();
    if (ctx) for (const [k, v] of new URLSearchParams(ctx)) qs.set(k, v);
    return `/api/admin/job-data/export?${qs}`;
  };
  const runDry = async () => {
    setBusy("dry"); setErr(null); setResult(null);
    try { setDry({ forText: text, body: await api("/api/admin/job-data/import", { method: "POST", body: JSON.stringify({ jsonl: text }) }) }); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const plan = dry && dry.forText === text ? dry.body : null;
  const n = plan?.valid ?? 0;
  const runReal = async () => {
    const p = plan.plan;
    if (!await ask({ title: `Import ${num(n)} posting(s)?`, label: `Import ${num(n)}`,
      body: <>{num(p.insert)} new · {num(p.replace)} replace a lower-priority copy · {num(p.attach)} attach to a posting already on the board ·{" "}
        {num(p.outOfMarket)} held off the board (outside the US). {plan.refused.length} line(s) refused. Revert, beside the batch below, retires the new
        rows. {plan.cannotUndo}</> })) return;
    setBusy("real"); setErr(null);
    try {
      setResult(await api("/api/admin/job-data/import", { method: "POST", body: JSON.stringify({ jsonl: text, apply: true }) }));
      setDry(null); loadBatches();
    } catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const revert = async (b) => {
    setErr(null);
    try {
      const d = await api(`/api/admin/job-data/import/batches/${b.id}/revert`, { method: "POST", body: JSON.stringify({}) });
      if (!await ask({ title: `Revert batch ${b.id}?`, label: "Revert it", body: d.note })) return;
      await api(`/api/admin/job-data/import/batches/${b.id}/revert`, { method: "POST", body: JSON.stringify({ expectRows: d.wouldRetire }) });
      loadBatches();
    } catch (e) { setErr(e.payload?.note || e.message); }
  };
  const shown = result || plan;
  const open = batches.filter(b => !b.reverted_at);
  return (
    <Panel title="Job data in and out" data-admin-jobdata=""
      code="A62: the one gateway every posting enters through. Enrichment (a posting's tags and pay) is a different round trip — Admin → The board → Enrichment."
      purpose="Postings themselves, in and out: export the active board as a file, or import postings into it. An import is checked first and becomes a batch you can revert."
      numbers={[[num(batches.length), "import batches"], [num(open.reduce((s, b) => s + (b.inserted || 0), 0)), "postings added by batches still in force"],
        [batches[0] ? ago(batches[0].created_at) : "never", "the last import"]]}>
      {dialog}
      <div style={{ ...row, marginBottom: 12 }}>
        <a className="dbx-depth" href={exportHref()} style={{ fontSize: 12, fontWeight: 700, color: theme.text, padding: "6px 12px", textDecoration: "none" }}>Export the active board (NDJSON) ↓</a>
      </div>
      <Step n={1} state={text.trim() ? "done" : "active"} title="Paste postings — one JSON object per line">
        <div style={quiet}>title, company and url are required; source is one of the known sources (default: import).</div>
        <textarea aria-label="Postings to import" value={text} onChange={e => setText(e.target.value)} rows={5} placeholder='{"title":"…","company":"…","url":"https://…","location":"…","description":"…"}'
          style={{ width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace, monospace", fontSize: 11,
                   background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 8 }}/>
      </Step>
      <Step n={2} state={!text.trim() ? "locked" : plan ? "done" : "active"} title="Check it — writes nothing">
        <div style={row}>
          <Btn theme={theme} disabled={!!busy || !text.trim()} onClick={runDry}>{busy === "dry" ? "Checking…" : "Check the postings"}</Btn>
          {dry && !plan && <span style={quiet}>The text changed since the check — check it again.</span>}
        </div>
        {plan && <div style={{ fontSize: 12 }}>{num(plan.valid)} valid of {num(plan.rows)} · {num(plan.plan.insert)} new · {num(plan.plan.replace)} replace ·
          {" "}{num(plan.plan.attach)} attach · {num(plan.plan.outOfMarket)} outside the US</div>}
        {shown?.refused?.length > 0 && <Err msg={`Refused: ${shown.refused.slice(0, 5).map(r => `line ${r.line}: ${r.reason}`).join(" · ")}${shown.refused.length > 5 ? " …" : ""}`}/>}
      </Step>
      <Step n={3} state={plan && n > 0 ? "active" : result ? "done" : "locked"} title="Import it">
        <div style={row}>
          <Btn theme={theme} primary disabled={!plan || n === 0 || !!busy} onClick={runReal}>
            {busy === "real" ? "Importing…" : plan ? `Import ${num(n)} posting(s)…` : "Import…"}
          </Btn>
          <span style={quiet}>Unlocks for exactly the text that was checked.</span>
        </div>
        {result && <div style={{ fontSize: 12, color: C.SUCCESS }}>Batch {result.batchId}: {num(result.inserted)} inserted · {num(result.attached)} attached · {num(result.held)} held off the board.
          {result.note ? ` ${result.note}` : ""}</div>}
      </Step>
      <Err msg={err}/>
      {batches.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ ...h2, fontSize: 15, margin: "0 0 6px" }}>Past imports</h3>
          <Table theme={theme} rows={batches} cols={[
            { key: "id", label: "batch" },
            { key: "created_at", label: "when", render: r => stamp(r.created_at) },
            { key: "inserted", label: "inserted", right: true },
            { key: "attached", label: "attached", right: true },
            { key: "held_out_of_market", label: "held", right: true },
            { key: "refused", label: "refused", right: true },
            { key: "reverted_at", label: "", render: r => (r.reverted_at
              ? `reverted ${stamp(r.reverted_at)} (${r.reverted_rows})`
              : <Btn theme={theme} onClick={() => revert(r)}>Revert…</Btn>) },
          ]}/>
        </div>
      )}
    </Panel>
  );
}

// ── Company list — /api/admin/companies (A50 step 4) ──────────────────────────────────────────
// The growth lever, as a surface. Add = probe the board first (dead / empty / live, with how many
// postings carry US evidence), then "Add" only for exactly what the probe saw. Disable is reversible.
// Suggestions are slugs users' captures named that are not configured (A45's harvest, from A62).
// D80 E: a company's hiring heat, as a mark (D60: never a pill).
const HEAT_TONE = { hot: C.SUCCESS, warm: C.INK_FAINT, probation: C.INK_FAINT, dormant: C.WARNING };
// ⭐ D83 rebuild #1 (39d) · THE BOARD → COMPANIES AND CANDIDATES, to the six rules: a purpose line with the codes
// behind the ?, the numbers on open, adding a company as three steps (name → probe → add) where the probe is a
// harmless read and Add is the one accent, a confirm in the page that says what changes, and a filter on the list.
const COMPANY_FILTERS = [["all", "All"], ["active", "Being crawled"], ["disabled", "Disabled"], ["dormant", "Dormant"], ["hot", "Hot"]];
export function CompaniesSection({ theme }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ company: "", atsType: "greenhouse", slug: "" });
  const [probe, setProbe] = useState(null);      // { key, body }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all");
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => { api("/api/admin/companies").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const key = `${form.atsType}|${form.slug.trim()}|${form.company.trim()}`;
  const seen = probe && probe.key === key ? probe.body.validation : null;
  const body = () => ({ company: form.company.trim(), atsType: form.atsType, slug: form.slug.trim() });
  const named = !!(form.slug.trim() && form.company.trim());
  const runProbe = async () => {
    setBusy("probe"); setErr(null); setMsg(null);
    try { setProbe({ key, body: await api("/api/admin/companies", { method: "POST", body: JSON.stringify(body()) }) }); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const add = async () => {
    if (!await ask({ title: `Add ${form.company}?`, label: "Add 1 company",
      body: <>This adds <b>1 company</b> — {form.company}, board {form.atsType}/{form.slug}. {seen.message} The next crawl reads it.
        Disable undoes it.</> })) return;
    setBusy("add"); setErr(null);
    try {
      const r = await api("/api/admin/companies", { method: "POST", body: JSON.stringify({ ...body(), confirm: true, expectState: seen.state }) });
      setMsg(r.note); setProbe(null); setForm({ company: "", atsType: form.atsType, slug: "" }); load();
    } catch (e) { setErr(e.payload?.message || e.message); }
    setBusy(null);
  };
  const toggle = async (c) => {
    if (!await ask({ title: `${c.active ? "Disable" : "Enable"} ${c.company}?`, label: c.active ? "Disable 1 company" : "Enable 1 company",
      body: c.active ? <>The crawl stops reading {c.ats_type}/{c.ats_slug}. Its {num(c.active_rows)} postings on the board age out as usual. Enable undoes it.</>
                     : <>The next crawl reads {c.ats_type}/{c.ats_slug} again. Disable undoes it.</> })) return;
    try { await api(`/api/admin/companies/${c.id}`, { method: "PATCH", body: JSON.stringify({ active: !c.active }) }); load(); }
    catch (e) { setErr(e.message); }
  };
  const input = { background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12 };
  const companies = d?.companies || [];
  const active = companies.filter(c => c.active);
  const heat = d?.heat;
  const ql = q.trim().toLowerCase();
  const shown = companies.filter(c => (!ql || `${c.company} ${c.ats_type} ${c.ats_slug}`.toLowerCase().includes(ql))
    && (show === "all" || (show === "active" ? c.active : show === "disabled" ? !c.active : c.heat === show)));
  const stepState = (n) => (n === 1 ? (named ? "done" : "active") : n === 2 ? (!named ? "locked" : seen ? "done" : "active")
    : (!seen ? "locked" : seen.ok ? "active" : "locked"));
  return (
    <Panel title="Companies and candidates" data-admin-companies=""
      code="A50: adding probes the board first · D80: hiring heat — a company is hot when it posted something new and in scope recently · D82: candidates found by discovery (HN weekly, the probe nightly)"
      purpose="The companies whose job boards the crawl reads. Add one after a probe shows its board answers; disable one to stop reading it — enabling it again undoes that."
      numbers={d ? [[num(active.length), "companies being crawled"], [num(active.reduce((s, c) => s + (c.active_rows || 0), 0)), "of their postings on the board"],
        [heat?.hotShare == null ? "—" : `${Math.round(heat.hotShare * 100)}%`, heat?.hotShare == null ? "hot — nothing to judge yet" : `hot — posted in ${heat.hotDays} days (target ${Math.round(heat.target * 100)}%)`, heat?.meetsTarget === true],
        [num(heat?.proposals?.length || 0), "proposed for deactivation"]] : []}>
      {dialog}
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 8 }}>{msg}</div>}

      <h3 style={{ ...h2, fontSize: 15, margin: "4px 0 10px" }}>Add a company</h3>
      <Step n={1} state={stepState(1)} title="Name the board">
        <div style={row}>
          <input aria-label="Company" placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={{ ...input, width: 170 }}/>
          <select aria-label="Board type" value={form.atsType} onChange={e => setForm({ ...form, atsType: e.target.value })} style={input}>
            {(d?.atsTypes || ["greenhouse"]).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input aria-label="Board slug" placeholder="board slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} style={{ ...input, width: 170 }}/>
        </div>
        {d?.suggestions?.length > 0 && (
          <div>
            <div style={quiet}>Boards your users' captures named that the crawl does not read yet — Use fills the fields:</div>
            <Table theme={theme} rows={d.suggestions} cols={[
              { key: "ats_type", label: "board type" }, { key: "ats_slug", label: "slug" },
              { key: "people", label: "people", right: true }, { key: "captures", label: "captures", right: true },
              { key: "use", label: "", render: r => <Btn theme={theme}
                  onClick={() => setForm({ company: form.company || r.ats_slug, atsType: r.ats_type, slug: r.ats_slug })}>Use</Btn> },
            ]}/>
          </div>
        )}
      </Step>
      <Step n={2} state={stepState(2)} title="Probe it — reads the board, changes nothing">
        <div style={row}>
          <Btn theme={theme} disabled={!!busy || !named} onClick={runProbe}>{busy === "probe" ? "Probing…" : "Probe the board"}</Btn>
          {!named && <span style={quiet}>Waits for a company and a slug.</span>}
        </div>
        {seen && <div style={{ fontSize: 12, color: seen.ok ? (seen.state === "live" ? C.SUCCESS : theme.text) : C.DANGER }}>
          {seen.state.toUpperCase()} — {seen.message}
          {seen.sample?.length > 0 && <span style={{ color: theme.textMuted }}> e.g. {seen.sample.map(s => s.title).join(" · ")}</span>}
        </div>}
      </Step>
      <Step n={3} state={stepState(3)} title="Add it">
        <div style={row}>
          <Btn theme={theme} primary disabled={!seen?.ok || !!busy} onClick={add}>{busy === "add" ? "Adding…" : "Add…"}</Btn>
          <span style={quiet}>Unlocks when the probe of exactly these fields answers.</span>
        </div>
      </Step>

      {heat && (
        <div data-company-heat style={{ fontSize: 12, margin: "14px 0 8px", color: heat.meetsTarget === false ? C.WARNING : theme.text }}>
          {heat.hot} hot · {heat.warm} warm · {heat.dormant} dormant · {heat.probation} on probation.
          {heat.proposals.length > 0 && <div style={{ color: C.WARNING, marginTop: 4 }}>
            Proposed for deactivation (no new in-scope posting in {heat.dormantDays} days, or every posting outside the US — press Disable to act): {heat.proposals.map(p => `${p.company} (${p.why})`).join(" · ")}
          </div>}
        </div>
      )}
      <div style={{ ...row, margin: "10px 0 8px" }}>
        <input aria-label="Find a company" placeholder="Find a company or slug" value={q} onChange={e => setQ(e.target.value)} style={{ ...input, width: 220 }}/>
        <select aria-label="Show" value={show} onChange={e => setShow(e.target.value)} style={input}>
          {COMPANY_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span style={quiet}>{shown.length} of {companies.length}</span>
      </div>
      <Table theme={theme} rows={shown} empty={companies.length ? "No company matches." : "No companies configured."} cols={[
        { key: "company", label: "company" }, { key: "ats_type", label: "board type" }, { key: "ats_slug", label: "slug" },
        { key: "active_rows", label: "on board", right: true, render: r => num(r.active_rows) },
        { key: "last_new_at", label: "last new posting", render: r => ago(r.last_new_at) },
        { key: "heat", label: "heat", render: r => r.heat ? <span style={markStyle(HEAT_TONE[r.heat])}>{r.heat}</span> : "—" },
        { key: "active", label: "", render: r => <Btn theme={theme} onClick={() => toggle(r)}>{r.active ? "Disable…" : "Enable…"}</Btn> },
      ]}/>
      <DiscoveryCandidates theme={theme} onAdded={load}/>
    </Panel>
  );
}

// ── D82 C · Candidates — /api/admin/companies/candidates ─────────────────────────────────────
// What the discovery jobs FOUND (HN weekly) and the nightly read-only probe MEASURED, ranked by fresh
// in-scope roles. The jobs never add a company: Approve is dry first (what would be added, what is
// refused and why, the disk gate), then a backup and each add WITH its evidence. Reject keeps the row so
// the next sweep never re-queues it. Status is a mark (D60: never a pill). D83 (39d): the confirms are in the page.
const CANDIDATE_TONE = { new: C.INK_FAINT, probed: C.SUCCESS, approved: C.WARNING, rejected: C.INK_FAINT, added: C.SUCCESS, dormant: C.WARNING };
function DiscoveryCandidates({ theme, onAdded }) {
  const [d, setD] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => { api("/api/admin/companies/candidates").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const ids = [...picked];
  const flip = (id) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const approve = async () => {
    setBusy("approve"); setErr(null); setMsg(null);
    try {
      const dry = await api("/api/admin/companies/candidates/approve", { method: "POST", body: JSON.stringify({ ids }) });
      const refused = dry.refused.map(r => `${r.company || "#" + r.id} (${r.reason})`).join(", ");
      if (!dry.eligible.length) { setErr(`None can be added: ${refused}`); setBusy(null); return; }
      if (!dry.disk?.ok) { setErr(`The disk gate refuses ${dry.eligible.length}: ${dry.disk?.reason}`); setBusy(null); return; }
      if (!await ask({ title: `Add ${dry.eligible.length} compan${dry.eligible.length === 1 ? "y" : "ies"}?`, label: `Add ${dry.eligible.length}`,
        body: <>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{dry.eligible.map(e => <li key={e.id}>{e.company} — {e.cs} in scope (≤ 120 days) of {e.csOpen} open</li>)}</ul>
          {refused && <div>Refused: {refused}</div>}
          <div>A backup is taken first; each add carries its evidence, and Disable reverses it.</div>
        </> })) { setBusy(null); return; }
      const r = await api("/api/admin/companies/candidates/approve", { method: "POST",
        body: JSON.stringify({ ids, confirm: true, expectIds: dry.eligible.map(e => e.id) }) });
      setMsg(`${r.added.length} added${r.failed.length ? `, ${r.failed.length} refused at add` : ""}. ${r.note}`);
      setPicked(new Set()); load(); onAdded?.();
    } catch (e) { setErr(e.payload?.message || e.payload?.error || e.message); }
    setBusy(null);
  };
  const reject = async () => {
    if (!await ask({ title: `Reject ${ids.length} candidate${ids.length === 1 ? "" : "s"}?`, label: `Reject ${ids.length}`,
      body: "They stay in the pool marked rejected, so no sweep queues them again." })) return;
    setBusy("reject"); setErr(null);
    try { const r = await api("/api/admin/companies/candidates/reject", { method: "POST", body: JSON.stringify({ ids }) }); setMsg(`${r.rejected} rejected.`); setPicked(new Set()); load(); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const reset = async (source) => {
    if (!await ask({ title: `Restart the ${source} job?`, label: "Restart it", body: "It runs again at its next scheduled time." })) return;
    try { await api(`/api/admin/companies/candidates/breakers/${source}/reset`, { method: "POST", body: "{}" }); load(); }
    catch (e) { setErr(e.message); }
  };
  const disc = d?.discovery;
  const open = (disc?.breakers || []).filter(b => b.open);
  const pctOf = (v) => (v == null ? "—" : `${v}%`);
  const waiting = (d?.counts?.probed || 0) + (d?.counts?.new || 0);
  return (
    <div data-discovery-candidates style={{ marginTop: 18 }}>
      {dialog}
      <h3 style={{ ...h2, fontSize: 15, margin: "0 0 4px" }}>Candidates<Help tip="D82: found by the weekly Hacker News job and measured by the nightly read-only probe. Nothing is added without Approve."/></h3>
      <p style={{ ...what, margin: "0 0 10px" }}>Companies found by discovery, not yet crawled, ranked by fresh in-scope roles. Tick the ones to add, then Approve — it shows exactly what would be added first.</p>
      <div style={{ fontSize: 12, color: theme.text, marginBottom: 6 }}><b>{num(waiting)}</b> waiting for review
        <span style={{ color: theme.textMuted }}>{Object.entries(d?.counts || {}).map(([k, v]) => ` · ${v} ${k}`).join("")}
        {(disc?.lastRuns || []).map(r => ` · last ${r.source} run ${ago(r.started_at)}: ${r.status}${r.error_text ? ` (${r.error_text})` : ""}`).join("")}</span></div>
      {disc?.paused && <div style={{ fontSize: 12, color: C.WARNING, marginBottom: 6 }}>Discovery is paused (DISCOVERY_PAUSED) — no job runs.</div>}
      {open.map(b => (
        <div key={b.source} data-discovery-breaker style={{ fontSize: 12, color: C.DANGER, marginBottom: 6 }}>
          The {b.source} job is stopped after {b.failures} failures in a row. Last error: {b.last_error || "—"}{" "}
          <Btn theme={theme} onClick={() => reset(b.source)}>Restart…</Btn>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <Btn theme={theme} disabled={!ids.length || !!busy} onClick={approve}>{busy === "approve" ? "Checking…" : `Approve ${ids.length || ""}…`}</Btn>
        <Btn theme={theme} disabled={!ids.length || !!busy} onClick={reject}>{`Reject ${ids.length || ""}…`}</Btn>
      </div>
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 6 }}>{msg}</div>}
      <Table theme={theme} rows={d?.candidates || []} empty="No candidates yet — the discovery job runs weekly." cols={[
        { key: "pick", label: "", render: r => ["probed", "new", "approved"].includes(r.status)
            ? <input type="checkbox" checked={picked.has(r.id)} onChange={() => flip(r.id)} aria-label={`select ${r.company}`}/> : "" },
        { key: "company", label: "company" },
        { key: "board", label: "board", render: r => `${r.ats_type}:${r.ats_slug}` },
        { key: "status", label: "status", render: r => <span style={markStyle(CANDIDATE_TONE[r.status] || C.INK_FAINT)}>{r.status}</span> },
        { key: "cs", label: "in scope ≤120d", right: true, render: r => r.evidence ? `${num(r.evidence.cs)} / ${num(r.evidence.csOpen)}` : "—" },
        { key: "pct30", label: "≤30d", right: true, render: r => pctOf(r.evidence?.pct30) },
        { key: "pct120", label: "≤120d", right: true, render: r => pctOf(r.evidence?.pct120) },
        { key: "us", label: "US", right: true, render: r => pctOf(r.evidence?.usPct) },
        { key: "age", label: "median age", right: true, render: r => r.evidence?.medianAge == null ? "—" : `${r.evidence.medianAge}d` },
        { key: "found", label: "how found", render: r => r.found ? `${r.source} · ${r.found.n_months || 0} mo${r.found.last ? ` (last ${r.found.last})` : ""}${r.found.yc ? ` · YC ${r.found.yc}` : ""}` : r.source },
        { key: "why", label: "verdict", render: r => r.evidence?.bar ? (r.evidence.bar.meets ? "meets the bar" : r.evidence.bar.misses.join(", ")) : (r.status_reason || "—") },
        { key: "sample", label: "titles", render: r => (r.evidence?.sample || []).slice(0, 3).join(" · ") },
      ]}/>
    </div>
  );
}

// ── Slug harvest — /api/admin/slug-harvest (D20) ─────────────────────────────────────────────
// The daily manual sweep's second half: a few SerpApi searches → a pool of ATS boards we do not
// crawl → an export the owner reviews → an import that adds the ones marked "add". Every step is dry
// first. The searches are the free plan's (250 a month), so the run button names how many it spends.
// ⭐ D83 rebuild #4 (39d): the four steps as a path, the one accent on the spend, confirms in the page, Revert
// confirmed and kept beside every import, and the role families in words instead of codes.
// services/harvestQueryPlan.js's families, in words (the audit: "families named as codes").
const FAMILY_WORDS = { data_analyst: "Data analyst", data_eng: "Data engineering", data_sci: "Data science", embedded: "Embedded",
  eng_backend: "Back-end engineering", eng_frontend: "Front-end engineering", eng_fullstack: "Full-stack engineering",
  eng_infra: "Infrastructure", eng_mobile: "Mobile", eng_security: "Security", mgmt_tpm: "Technical programme management",
  ml_ai: "Machine learning and AI", qa: "Quality", custom: "Other searches" };
export const familyWords = (f) => FAMILY_WORDS[f] || String(f || "—").replace(/_/g, " ");
export function SlugHarvestSection({ theme }) {
  const [d, setD] = useState(null);
  const [dry, setDry] = useState(null);
  const [imp, setImp] = useState(null);         // { text, body }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => { api("/api/admin/slug-harvest").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const running = d?.sweeps?.find(s => !s.finished_at);
  useEffect(() => {
    if (!running) return undefined;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [running, load, d]);
  const fail = e => setErr(e.payload?.message || e.payload?.error || e.message);
  const planSweep = async () => {
    setBusy("plan"); setErr(null); setMsg(null);
    try { setDry(await api("/api/admin/slug-harvest/sweep", { method: "POST", body: JSON.stringify({}) })); } catch (e) { fail(e); }
    setBusy(null);
  };
  const runSweep = async () => {
    const n = dry.expectQueries.length;
    if (!await ask({ title: `Spend ${n} search${n === 1 ? "" : "es"}?`, label: `Run ${n}`,
      body: <><ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{dry.expectQueries.map(q => <li key={q}><code>{q}</code></li>)}</ul>
        {dry.quota?.left ?? "?"} searches are left on this month's plan. Searches cannot be refunded; nothing is added to the board by a sweep.</> })) return;
    setBusy("run"); setErr(null);
    try {
      const r = await api("/api/admin/slug-harvest/sweep", { method: "POST", body: JSON.stringify({ confirm: true, expectQueries: dry.expectQueries }) });
      setMsg(`Sweep ${r.sweepId} started — ${r.searches} searches, then each new board is probed.`); setDry(null); load();
    } catch (e) { fail(e); }
    setBusy(null);
  };
  const pickFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy("import"); setErr(null); setMsg(null);
    try {
      const text = await f.text();
      setImp({ text, body: await api("/api/admin/slug-harvest/import", { method: "POST", body: JSON.stringify({ jsonl: text }) }) });
    } catch (e2) { fail(e2); }
    setBusy(null);
  };
  const applyImport = async () => {
    const p = imp.body.plan;
    if (!await ask({ title: "Apply this file?", label: `Add ${p.wouldAdd}, skip ${p.wouldSkip}`,
      body: <>This adds <b>{p.wouldAdd} compan{p.wouldAdd === 1 ? "y" : "ies"}</b> (active — the next crawl reads them) and records {p.wouldSkip} skip{p.wouldSkip === 1 ? "" : "s"}.
        Revert, beside the import below, undoes it.</> })) return;
    setBusy("apply"); setErr(null);
    try {
      const r = await api("/api/admin/slug-harvest/import", { method: "POST", body: JSON.stringify({ jsonl: imp.text, apply: true, expectWrites: p.expectWrites }) });
      setMsg(`Import ${r.importId ?? "—"}: ${r.written} written, ${r.companiesAdded} compan${r.companiesAdded === 1 ? "y" : "ies"} added.`); setImp(null); load();
    } catch (e) { fail(e); }
    setBusy(null);
  };
  const revert = async (i) => {
    setErr(null);
    try {
      const p = await api(`/api/admin/slug-harvest/imports/${i.id}/revert`, { method: "POST", body: JSON.stringify({}) });
      if (!await ask({ title: `Revert import ${i.id}?`, label: "Revert it",
        body: <><ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{p.pairs.map(x => <li key={x.pair}>{x.pair}: {x.now.decision}{x.now.company ? ` · ${x.now.company}` : ""} →{" "}
          {typeof x.after === "string" ? x.after : `${x.after.decision ?? "undecided"}${x.after.company ? ` · ${x.after.company}` : ""}`}</li>)}</ul>
          Companies it added are disabled, never deleted.</> })) return;
      const r = await api(`/api/admin/slug-harvest/imports/${i.id}/revert`, { method: "POST", body: JSON.stringify({ apply: true, expectRestorable: p.restorable }) });
      setMsg(`Reverted import ${i.id}: ${r.restored} pair(s) undecided again, ${r.companiesDisabled} compan${r.companiesDisabled === 1 ? "y" : "ies"} disabled.`); load();
    } catch (e) { fail(e); }
  };
  const plan = d?.plan;
  const pool = d?.pool || [];
  const toReview = pool.reduce((s, p) => s + (p.undecided || 0), 0);
  const added = pool.reduce((s, p) => s + (p.added || 0), 0);
  const hasRun = (d?.sweeps || []).length > 0;
  const stepState = (n) => n === 1 ? (dry ? "done" : "active") : n === 2 ? (!dry ? "locked" : "active")
    : n === 3 ? (hasRun ? (toReview ? "active" : "done") : "locked") : (hasRun ? (imp ? "active" : toReview ? "active" : "done") : "locked");
  return (
    <Panel title="Slug harvest" data-admin-harvest=""
      code="D20 slug harvest · D81 the computer-science query plan. Searches are SerpApi's (SERPAPI_KEY; the free plan is 250 a month). A board is an ATS type plus its slug, e.g. greenhouse:acme."
      purpose="Finds company job boards the crawl does not read yet, by web search. A sweep only fills a pool; you review the pool and import the boards to add — nothing joins the board without that."
      numbers={plan ? [[`${num(plan.usedToday)} / ${num(plan.cap)}`, "searches today"],
        [dry?.quota?.left == null ? "—" : num(dry.quota.left), dry?.quota?.left == null ? "left this month (plan to read it)" : "searches left this month"],
        [num(toReview), "boards waiting for review"], [num(added), "companies added from the harvest"]] : []}>
      {dialog}
      {d && !d.configured && <div style={{ ...callout(C.WARNING), marginBottom: 10 }}>SERPAPI_KEY is not set — no search can run.</div>}
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 8 }}>{msg}</div>}
      <Step n={1} state={stepState(1)} title="Plan today's sweep — reads the quota, spends nothing">
        <div style={row}><Btn theme={theme} disabled={!!busy || !!running || !d?.configured} onClick={planSweep}>{busy === "plan" ? "Reading the quota…" : "Plan today's sweep"}</Btn></div>
        {dry && <div style={{ fontSize: 12 }}>
          {dry.note} {dry.quota && <span style={{ color: theme.textMuted }}>{dry.quota.left ?? "?"} searches left this month.</span>}
          {dry.quotaError && <span style={{ color: C.DANGER }}> {dry.quotaError}.</span>}
          {dry.plan.skipped.length > 0 && <div style={{ color: theme.textMuted }}>Not searched: {dry.plan.skipped.map(x => `${x.q} (${x.reason})`).join(" · ")}</div>}
        </div>}
      </Step>
      <Step n={2} state={stepState(2)} title="Run the searches — this spends them">
        <div style={row}>
          <Btn theme={theme} primary disabled={!dry?.expectQueries?.length || !!busy} onClick={runSweep}>
            {busy === "run" ? "Starting…" : `Run ${dry?.expectQueries?.length ?? 0} search${dry?.expectQueries?.length === 1 ? "" : "es"}…`}</Btn>
          {running && <span style={quiet}>Sweep {running.id} running — {running.searches} search(es) done.</span>}
        </div>
      </Step>
      <Step n={3} state={stepState(3)} title="Export the pool and mark each board add or skip">
        <div style={row}>
          <a className="dbx-depth" href={`/api/admin/slug-harvest/export${authContextQuery() ? `?${authContextQuery()}` : ""}`}
            style={{ fontSize: 12, fontWeight: 700, color: theme.text, padding: "6px 12px", textDecoration: "none" }}>Export for review (JSONL)</a>
          <span style={quiet}>{num(toReview)} boards to review. Set each line's decision to "add" or "skip" in the file.</span>
        </div>
      </Step>
      <Step n={4} state={stepState(4)} title="Import your decisions — checked first, applied on your confirm">
        <div style={row}>
          <label className="dbx-depth" style={{ fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "6px 12px" }}>
            {busy === "import" ? "Checking the file…" : "Choose the file…"}
            <input type="file" accept=".jsonl,.ndjson,.txt" onChange={pickFile} style={{ display: "none" }}/>
          </label>
        </div>
        {imp && <div style={{ fontSize: 12 }}>
          <div style={{ color: imp.body.plan.valid ? theme.text : C.DANGER }}>{imp.body.note}</div>
          {imp.body.plan.rejected.map((r, i) => <div key={i} style={{ color: C.DANGER }}>line {r.line} · {r.pair || "—"} · {r.kind}: {r.error}</div>)}
          {imp.body.plan.valid && imp.body.plan.expectWrites > 0 && <div style={{ marginTop: 6 }}>
            <Btn theme={theme} disabled={!!busy} onClick={applyImport}>{busy === "apply" ? "Applying…" : `Apply: add ${imp.body.plan.wouldAdd}, skip ${imp.body.plan.wouldSkip}…`}</Btn>
          </div>}
        </div>}
      </Step>
      {d?.imports?.length > 0 && <>
        <h3 style={{ ...h2, fontSize: 15, margin: "14px 0 6px" }}>Past imports</h3>
        <Table theme={theme} rows={d.imports} cols={[
          { key: "id", label: "#" }, { key: "imported_at", label: "when", render: r => ago(r.imported_at) },
          { key: "rows_written", label: "decisions", right: true }, { key: "companies_added", label: "added", right: true },
          { key: "reverted_at", label: "", render: r => r.reverted_at ? `reverted ${ago(r.reverted_at)}` : <Btn theme={theme} onClick={() => revert(r)}>Revert…</Btn> },
        ]}/>
      </>}
      <h3 style={{ ...h2, fontSize: 15, margin: "14px 0 6px" }}>What the searches find</h3>
      <Table theme={theme} rows={d?.families || []} cols={[
        { key: "family", label: "role family", render: r => familyWords(r.family) }, { key: "searches", label: "searches", right: true },
        { key: "newPairs", label: "new boards", right: true }, { key: "rate", label: "per search", right: true, render: r => r.rate ?? "—" },
        { key: "exhausted", label: "", render: r => r.exhausted ? <span style={markStyle(C.WARNING)}>stopped — nothing new lately</span> : "" },
      ]}/>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginTop: 12 }}>
        <Table theme={theme} rows={d?.sweeps || []} empty="No sweep yet." cols={[
          { key: "id", label: "sweep" }, { key: "started_at", label: "started", render: r => ago(r.started_at) },
          { key: "searches", label: "searches", right: true }, { key: "ats_links", label: "board links", right: true },
          { key: "new_pairs", label: "new", right: true }, { key: "conversion", label: "per search", right: true, render: r => r.conversion ?? "—" },
          { key: "error", label: "", render: r => r.error ? <span style={{ color: C.DANGER }}>{r.error}</span> : "" },
        ]}/>
        <Table theme={theme} rows={pool} empty="Nothing harvested yet." cols={[
          { key: "ats_type", label: "board type" }, { key: "pairs", label: "boards", right: true }, { key: "live", label: "live", right: true },
          { key: "undecided", label: "to review", right: true }, { key: "added", label: "added", right: true }, { key: "skipped", label: "skipped", right: true },
        ]}/>
      </div>
    </Panel>
  );
}

// ── The tools service — /api/admin/tools-service (A50 step 7) ─────────────────────────────────
// The second service, as draft sees it: is it up, which commit, does draft hold a token. Read-only.
export function ToolsServiceSection({ theme }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => { setErr(null); api("/api/admin/tools-service").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const up = d?.health?.status === 200 && d?.health?.body?.ok === true;
  return (
    <Card theme={theme} title={LEGACY_BRAND} measured={d ? `measured ${ago(d.measuredAt)}` : "measuring…"}>
      <Err msg={err || d?.error}/>
      {d && <KV theme={theme} rows={[
        ["service", up ? "up" : d.health ? `answered ${d.health.status}` : "no answer", up ? C.SUCCESS : C.DANGER],
        ["url", d.url || "no URL configured (see the boot log)"],
        ["commit", d.version?.commit ? String(d.version.commit).slice(0, 7) : "—"],
        ["scorer", d.version?.scorer || "—"],
        ["draft's client", d.configured ? "configured" : "NOT configured — generation and A+ answer 503", d.configured ? null : C.WARNING],
        ["draft holds a token", d.tokenHeld ? "yes" : "no", d.tokenHeld ? null : C.WARNING],
        ["per-client usage", d.usageNote],
      ]}/>}
      <div style={{ marginTop: 8 }}><Btn theme={theme} onClick={load}>Measure again</Btn></div>
    </Card>
  );
}

// ── /api/admin/analytics/spend ─────────────────────────────────────────────────────────────────
// ── /api/admin/users/:id/applications — read-only, inside a user's expanded row ───────────────
export function UserApplications({ userId, theme }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => {
    setErr(null);
    api(`/api/admin/users/${userId}/applications`).then(d => setRows(Array.isArray(d) ? d : [])).catch(e => setErr(e.message));
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {rows == null
        ? <Btn theme={theme} onClick={load}>Show applications</Btn>
        : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 6 }}>
              Applications ({rows.length}) — job_applications, read-only
            </div>
            <Table theme={theme} rows={rows.slice(0, 50)} empty="No applications recorded." cols={[
              { key: "applied_at", label: "applied", render: r => stamp(r.applied_at) },
              { key: "company", label: "company" },
              { key: "role", label: "role" },
              { key: "apply_mode", label: "mode" },
              { key: "auto_status", label: "auto status" },
              { key: "response_outcome", label: "outcome" },
              { key: "source", label: "source" },
            ]}/>
            {rows.length > 50 && <div style={{ fontSize: 11, color: theme.textMuted }}>…{rows.length - 50} more</div>}
          </>
        )}
      <Err msg={err}/>
    </div>
  );
}

// D83 · the Operations tab (eleven unrelated cards in one scroll) is gone: each card is a panel in its group —
// AdminPanel.jsx + adminMap.js say where.

// ── The daily glance — GET /api/admin/glance (+ /api/version for the deploy line) ──────────────
const HEALTH_COLOR = h => (h === "ok" ? C.SUCCESS
  : ["live_search_only", "not_enabled", "paused", "awaiting_first_crawl"].includes(h) ? C.INK_FAINT
  : ["stale", "all_rejected", "out_of_market", "no_results", "never_ran", "no_rows"].includes(h) ? C.WARNING
  : C.DANGER);
// D74 P2 · the crawl age's tone (services/adminGlance.js crawlAge) as a mark colour — never a capsule (D60).
const CRAWL_AGE_COLOR = { ok: C.SUCCESS, amber: C.WARNING, red: C.DANGER, not_crawled: C.INK_FAINT };
function CrawlAgeMark({ r }) {
  const a = r.crawlAge || { tone: "not_crawled" };
  const text = a.tone === "not_crawled" ? "not crawled" : r.lastSuccessAt ? ago(r.lastSuccessAt) : "never";
  return <span title={r.lastSuccessAt ? `last successful crawl ${stamp(r.lastSuccessAt)}` : "no successful crawl recorded"}
    style={markStyle(CRAWL_AGE_COLOR[a.tone] || C.INK_FAINT)}>{text}</span>;
}

export function GlanceTab({ theme }) {
  const [g, setG] = useState(null);
  const [v, setV] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    setErr(null);
    api("/api/admin/glance").then(setG).catch(e => setErr(e.message));
    api("/api/version").then(setV).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  if (err) return <Err msg={err}/>;
  if (!g) return <div style={{ padding: 24, color: theme.textMuted }}>Loading…</div>;
  const { ingestion: ing, enrichment: en, scoring: sc, apply: ap, spend: sp } = g;
  const cell = { flex: "1 1 300px", minWidth: 280 };
  // Red only when something is critical; warnings alone are amber, or a warning reads as an outage.
  const alertTone = ing.alertCounts.critical ? C.DANGER : C.WARNING;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: theme.textMuted }}>
          Computed {stamp(g.measuredAt)} — each box says what its numbers refer to.
        </div>
        <div style={{ flex: 1 }}/>
        <Btn theme={theme} onClick={load}>Re-measure</Btn>
      </div>

      {ing.alertCounts.critical + ing.alertCounts.warn > 0 && (
        <div style={{ border: `1px solid ${alertTone}`, background: ing.alertCounts.critical ? C.DANGER_QUIET : C.WARNING_QUIET,
                      borderRadius: 10, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: alertTone }}>
          <b>{ing.alertCounts.critical} critical · {ing.alertCounts.warn} warning</b> (the same alerts the nightly
          mail reads — Pipeline Health in the DB Inspector has the full list)
          {ing.alerts.slice(0, 4).map((a, i) => (
            <div key={i} style={{ marginTop: 4 }}>{a.severity} · {a.kind} {a.subject} — {a.detail}</div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ ...cell, flex: "2 1 560px" }}>
          <Card theme={theme} title="Ingestion" measured={`last crawl run ${ago(ing.lastCrawlAt)} (${stamp(ing.lastCrawlAt)})`}
            tone={ing.sourcesNeedingAttention.length ? C.WARNING : undefined}>
            {ing.crawlAgeHours && (
              <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>
                Last ok crawl: amber past {ing.crawlAgeHours.amber}h, red past {ing.crawlAgeHours.red}h or never.
              </div>
            )}
            <Table theme={theme} rows={ing.sources} cols={[
              { key: "name", label: "source" },
              { key: "health", label: "health", color: r => HEALTH_COLOR(r.health) },
              { key: "lastRunAt", label: "last run", render: r => ago(r.lastRunAt) },
              { key: "crawlAge", label: "last ok crawl", render: r => <CrawlAgeMark r={r}/> },
              // 10-14: the headline is what is ON THE BOARD (new + changed + unchanged + merged duplicates) beside
              // the fetch — not `written` (new or changed only) beside two gates' refusals, which read
              // "accepted 80 / refused 1,878" on a run that kept 2,408. The funnel below says where the rest went.
              { key: "fetched", label: "fetched", right: true, render: r => num(r.funnel?.fetched) },
              { key: "onBoard", label: "on the board", right: true, render: r => num(r.onBoard) },
              { key: "heldOff", label: "held off", right: true, render: r => num(r.heldOff) },
            ]}/>
            {ing.sources.some(s => s.funnel?.fetched > 0) && (
              <>
                <div style={{ fontSize: 11, color: theme.textMuted, margin: "10px 0 6px" }}>
                  Last run, per source: where every fetched posting went. {ing.funnelNote}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 10 }}>
                  {ing.sources.filter(s => s.funnel?.fetched > 0).map(s => (
                    <IngestFunnel key={s.name} name={s.name} funnel={s.funnel} theme={theme}/>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
        <div style={cell}>
          <Card theme={theme} title="Enrichment" measured={`last enriched ${ago(en.lastEnrichedAt)}`}
            tone={en.columnsAtZero.length ? C.DANGER : undefined}>
            <KV theme={theme} rows={[
              ["backlog (active, has text)", num(en.waiting), en.waiting > 0 ? C.WARNING : null],
              ["skills_json coverage", en.skillsCoverage ? `${en.skillsCoverage.pct}% (${num(en.skillsCoverage.nonNull)} / ${num(en.skillsCoverage.total)})` : "—"],
              ["no description (can't enrich)", num(en.noDescription), en.noDescription ? C.DANGER : null],
              en.columnsAtZero.length > 0 && ["columns at 0%", en.columnsAtZero.join(", "), C.DANGER],
              ["last run", en.lastRun ? `${ago(en.lastRun.at)} · ${String(en.lastRun.health).toUpperCase()} · ${num(en.lastRun.written)} written, ${num(en.lastRun.failed)} failed` : "none recorded",
                en.lastRun?.health === "failed" ? C.DANGER : null],
              ["cost today (UTC)", en.today ? `${usd(en.today.costUsd)} of ${usd(en.today.capUsd)} cap · ${num(en.today.calls)} calls${en.today.failedCalls ? ` · ${en.today.failedCalls} FAILED` : ""}` : "—",
                en.today?.failedCalls ? C.DANGER : null],
            ]}/>
          </Card>
        </div>
        <div style={cell}>
          <Card theme={theme} title="Scoring" measured={`from the same pipeline-health read`}>
            <KV theme={theme} rows={[
              ["enriched ÷ active", pct(sc.enrichedShare)],
              ["expected \"not enough signal\"", sc.expectedDeclineShare == null ? "—" : `≈ ${pct(sc.expectedDeclineShare)} of the board`],
            ]}/>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>{sc.note}</div>
          </Card>
        </div>
        <div style={cell}>
          <Card theme={theme} title="Apply" measured={`last 24h, to ${stamp(ap.measuredAt)}`}>
            <KV theme={theme} rows={[
              ["full-auto", ap.fullAuto ? (ap.fullAuto.disabled ? `stopped (${ap.fullAuto.source})` : `ON (${ap.fullAuto.source})`) : "—",
                ap.fullAuto && !ap.fullAuto.disabled ? C.WARNING : null],
              ["runs in flight", num(ap.runsInFlight)],
              ...((ap.byStatus || []).map(r => [`jobs ${r.status}`, num(r.n), r.status === "failed" ? C.DANGER : null])),
              ap.byStatus && ap.byStatus.length === 0 && ["jobs", "none in 24h"],
            ]}/>
          </Card>
        </div>
        <div style={cell}>
          <Card theme={theme} title="Spend" measured={`today since ${stamp(sp.since)} · newest ledger row ${ago(sp.lastRecordedAt)}`}
            tone={sp.trackingFailuresToday ? C.DANGER : undefined}>
            <KV theme={theme} rows={[
              ["cost today", usd(sp.costUsd)],
              ["model calls", `${num(sp.calls)}${sp.failedCalls ? ` · ${num(sp.failedCalls)} FAILED` : ""}`, sp.failedCalls ? C.DANGER : null],
              sp.trackingFailuresToday ? ["NOT in these totals", `${sp.trackingFailuresToday} tracking failure(s) today`, C.DANGER] : null,
              ...((sp.byPurpose || []).map(r => [`· ${r.purpose}`, `${usd(r.cost_usd)} · ${num(r.calls)} calls${r.failed ? ` · ${r.failed} failed` : ""}`, r.failed ? C.DANGER : null])),
            ]}/>
          </Card>
        </div>
        <div style={cell}>
          <Card theme={theme} title="Deploy" measured="/api/version, read just now">
            {v ? (
              <KV theme={theme} rows={[
                ["commit", v.commit ? `${v.commit} (${v.commitSource})` : "unknown", v.commit ? null : C.WARNING],
                ["up since", `${ago(Math.floor(Date.parse(v.startedAt) / 1000))}`],
                ["highest migration", v.migrations?.highestNumbered ?? "—"],
                ["scoring weights", v.atsWeights?.weightedScoring ? `fresh, ${v.atsWeights.ageDays} days` : (v.atsWeights?.state || "—"),
                  v.atsWeights?.weightedScoring ? null : C.DANGER],
              ]}/>
            ) : <div style={{ fontSize: 12, color: theme.textMuted }}>Loading…</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ⭐ D86 · ADMIN → SYSTEM → PLUGIN — bring-your-own-model résumés, for the operator (plugin-ui.html, tab 5; D83's
// rules: a purpose sentence, numbers on open, one switch that says what off means, the allow-list, the cap, a
// history — never résumé content).
function PluginSwitch({ on, onChange, label, theme }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ position: "relative", width: 50, height: 28, flex: "none", padding: 0, cursor: "pointer", borderRadius: 6,
        border: `1px solid ${on ? C.ACCENT : theme.border}`, background: on ? `color-mix(in srgb, ${C.ACCENT} 30%, ${theme.surfaceHigh})` : theme.surfaceHigh }}>
      <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 20, height: 20, borderRadius: 4,
        background: on ? C.ACCENT : theme.textMuted, transition: "left .2s" }}/>
    </button>
  );
}

const RESULT_WORDS = { new_term: "term not in résumé", years_exceed_profile: "years over the profile", brief_used: "brief already used",
  brief_exhausted: "brief closed", feature_off: "switched off", user_off: "user's switch off", account_off: "off for this account", host_off: "host off", insufficient_scope: "read-only connection" };

export function PluginTab({ theme }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => { setErr(null); api("/api/admin/byom").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const put = async (patch) => {
    try { await api("/api/admin/byom", { method: "PUT", body: JSON.stringify(patch) }); load(); } catch (e) { setErr(e.message); }
  };
  if (!d) return <Err msg={err}/>;
  const { settings: s, numbers: n } = d;
  const killed = !s.enabled;
  const stat = (label, value) => (
    <div style={{ background: theme.surfaceHigh, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "10px 13px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1, color: C.ACCENT_INK }}>{killed ? "—" : (value ?? "—")}</div>
      <div style={{ fontSize: 11.5, color: theme.textMuted }}>{label}</div>
    </div>
  );
  const resultMark = (r) => {
    const why = String(r.detail || "").split(",").map(c => RESULT_WORDS[c]).find(Boolean);
    if (r.outcome === "ok") return <span style={markStyle(C.SUCCESS)}>{r.tool === "draft_submit_resume_patch" ? `Saved · ${String(r.detail || "").replace("→", " → ")}` : "OK"}</span>;
    if (r.outcome === "refused") return <span style={markStyle(C.DANGER)}>Refused{why ? ` — ${why}` : ""}</span>;
    if (r.outcome === "denied") return <span style={markStyle(C.INK_FAINT)}>Stopped{why ? ` — ${why}` : ""}</span>;
    return <span style={markStyle(C.DANGER)}>Failed</span>;
  };
  const hostRow = (h, label) => (
    <div key={h} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: `1px solid ${theme.border}`, borderRadius: 6, marginBottom: 8 }}>
      <span style={{ flex: 1, fontSize: 12.5 }}><b style={{ color: theme.text }}>Allow {label}</b> <span style={{ color: theme.textMuted, fontSize: 12 }}>· host allow-list</span></span>
      <PluginSwitch theme={theme} on={s.hosts[h]} label={`Allow ${label}`} onChange={(on) => put({ hosts: { [h]: on } })}/>
    </div>
  );
  return (
    <div data-admin-plugin="">
      <Err msg={err}/>
      <Card theme={theme} title="Plugin">
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12, maxWidth: 760 }}>
          The bring-your-own-model résumé feature. Turn it off here and every connection stops at once.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
          {stat("users connected", n.usersConnected)}
          {stat("résumés written this week", n.resumesThisWeek)}
          {stat("passed the claim check first time", n.firstTimePass == null ? null : `${n.firstTimePass}%`)}
          {stat("refused and fixed", n.refusedThenFixed)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: theme.surfaceHigh,
          border: `1px solid ${killed ? C.DANGER : theme.border}`, borderRadius: 6, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 14, color: theme.text }}>Feature switch</b>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              {killed
                ? <><span style={markStyle(C.DANGER)}>Stopped</span> — every tool call is refused, the consent screen offers only “Not now”, and Settings shows “unavailable”.</>
                : <><span style={markStyle(C.SUCCESS)}>Running</span> — apps can connect and write résumés.</>}
            </div>
          </div>
          <PluginSwitch theme={theme} on={!killed} label="Feature switch" onChange={(on) => put({ enabled: on })}/>
        </div>
        <div style={killed ? { opacity: .5, pointerEvents: "none" } : null} aria-disabled={killed}>
          {hostRow("chatgpt", "ChatGPT")}
          {hostRow("claude", "Claude")}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "4px 0 14px" }}>
            <label style={{ fontSize: 12, color: theme.textMuted }} htmlFor="byom-cap">Résumés per user per day</label>
            <select id="byom-cap" value={String(s.dailyCap)} onChange={e => put({ dailyCap: Number(e.target.value) })}
              style={{ background: theme.surfaceHigh, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 6, padding: "7px 10px" }}>
              {[...new Set([50, 25, 100, s.dailyCap])].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <span style={{ fontSize: 11, color: theme.textMuted }}>Stops abuse; users see this number.</span>
          </div>
          {/* ⭐ D86/D88 follow-up: who is connected — by the account's email, the host, and when it was last used. */}
          <div style={{ fontSize: 11.5, fontWeight: 800, fontStyle: "italic", color: theme.textMuted, marginBottom: 6 }}>Connected accounts</div>
          <div data-plugin-connections="" style={{ marginBottom: 14 }}>
            <Table theme={theme} rows={d.connections || []} empty="No account is connected." cols={[
              { key: "email", label: "Account", render: r => <>{r.email || <span style={{ color: theme.textMuted }}>no email — {r.username}</span>}
                {r.isAdmin && <> <span style={markStyle(C.DANGER)}>administrator — should not be connected</span></>}</> },
              { key: "hostLabel", label: "Host" },
              { key: "connectedAt", label: "Connected", render: r => ago(r.connectedAt) },
              { key: "lastUsedAt", label: "Last used", render: r => (r.lastUsedAt ? ago(r.lastUsedAt) : "never") },
            ]}/>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, fontStyle: "italic", color: theme.textMuted, marginBottom: 6 }}>Recent tool calls</div>
          <Table theme={theme} rows={d.recent} empty="No calls yet." cols={[
            { key: "at", label: "Time", render: r => ago(r.at) },
            { key: "username", label: "User" },
            { key: "tool", label: "Tool" },
            { key: "outcome", label: "Result", render: resultMark },
          ]}/>
        </div>
      </Card>
    </div>
  );
}

// ⭐ D86 §6 · THE REVIEWER ACCOUNT — the fictional candidate the connector directory reviews with
// (services/reviewerDemo.js). It lives in Admin → People (D88: an account action), under the user list. Create it once with a password (it goes only into the review portal), reset it after a
// review's destructive tests. Every use is in the admin audit log.
export function ReviewerAccount({ theme }) {
  const { ask, dialog } = useConfirm();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const run = async (action) => {
    const reset = action === "reset";
    if (!await ask({ title: reset ? "Reset the reviewer account?" : "Create or refresh the reviewer account?", label: reset ? "Reset it" : "Create it",
      body: reset
        ? <>Removes the reviewer account's saved résumés, briefs and connector activity, and restores its résumé, three claims, cap of 100 and twelve sample postings. Its password and connections stay.</>
        : <>Creates <code>draft-reviewer</code> (Alex Rivera, fictional) with a base résumé, three claims, the plugin on, a cap of 100 a day and twelve sample postings that appear on no board. {pw ? "The password you typed replaces any earlier one." : "With no password, an existing account keeps its own."}</> })) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await api("/api/admin/byom/reviewer", { method: "POST", body: JSON.stringify({ action, ...(pw && !reset ? { password: pw } : {}) }) });
      setMsg(`${reset ? "Reset" : r.created ? "Created" : "Refreshed"}: ${r.username} — ${r.postings} sample postings.`);
      setPw("");
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Card theme={theme} title="Reviewer account">
      {dialog}
      <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12, maxWidth: 760 }}>
        The account the connector directory's reviewers sign in with — a fictional candidate, sample postings with stable ids
        (<code>demo-job-001</code> … <code>demo-job-012</code>), no second factor. Its password goes only into the review portal.
      </div>
      <Err msg={err}/>
      {msg && <div style={{ ...callout(C.SUCCESS), marginBottom: 10 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="password" autoComplete="new-password" aria-label="Reviewer password (12 or more characters)" placeholder="Password, to create it (12+ characters)"
          value={pw} onChange={e => setPw(e.target.value)} style={{ ...field, minWidth: 260 }}/>
        <Btn theme={theme} disabled={busy || (pw && pw.length < 12)} onClick={() => run("seed")}>Create or refresh</Btn>
        <Btn theme={theme} disabled={busy} onClick={() => run("reset")}>Reset demo account</Btn>
      </div>
    </Card>
  );
}

// ⭐ D73 §B 5 · ADMIN → SYSTEM → NOTICES — policy, terms and service notices (D83's rules: a purpose, the
// numbers first, the action stating what it does, a history). Dry run first; a ceiling; test-to-me.
export function NoticesTab({ theme }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({ audience: "all", subject: "", body: "", why: "" });
  const [dry, setDry] = useState(null);
  const [ceiling, setCeiling] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { setErr(null); api("/api/admin/notices").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setDry(null); setResult(null); };
  const run = async (path, body) => {
    setBusy(true); setErr(null);
    try { return await api(path, { method: "POST", body: JSON.stringify(body) }); }
    catch (e) { setErr(e.message); return null; }
    finally { setBusy(false); }
  };
  if (!d) return <Err msg={err}/>;
  const input = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 6, border: `1px solid ${theme.border}`,
    background: theme.surface, color: theme.text, fontSize: 13, fontFamily: "inherit" };
  const ready = form.subject.trim() && form.body.trim() && form.why.trim();
  const needsRaise = dry && dry.overCeiling;
  return (
    <div data-admin-notices="">
      <Err msg={err}/>
      <Card theme={theme} title="Send a notice">
        <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12, maxWidth: 760 }}>
          A policy, terms or service notice to users' account email. It is not marketing: no opt-in is needed, and each one says
          why the user is receiving it. Suppressed addresses (hard bounces, spam complaints) are skipped. Count first — sending refuses
          above the ceiling of {d.defaultCeiling} unless you raise it to at least the count.
          {!d.configured && <span style={{ color: C.WARNING }}> Email is not configured on this server — nothing would be sent.</span>}
        </div>
        <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
          <label style={{ fontSize: 12, color: theme.textMuted }}>Audience
            <select value={form.audience} onChange={set("audience")} style={{ ...input, marginTop: 4 }}>
              {Object.entries(d.audiences).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: theme.textMuted }}>Subject
            <input value={form.subject} onChange={set("subject")} style={{ ...input, marginTop: 4 }} maxLength={140}/></label>
          <label style={{ fontSize: 12, color: theme.textMuted }}>Message (plain text)
            <textarea value={form.body} onChange={set("body")} rows={8} style={{ ...input, marginTop: 4 }}/></label>
          <label style={{ fontSize: 12, color: theme.textMuted }}>Why they receive it (printed at the end)
            <input value={form.why} onChange={set("why")} placeholder="our privacy policy is changing on 1 November" style={{ ...input, marginTop: 4 }}/></label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Btn theme={theme} disabled={busy} onClick={async () => setDry(await run("/api/admin/notices/dry-run", { audience: form.audience }))}>Count recipients (sends nothing)</Btn>
            <Btn theme={theme} disabled={busy || !ready} onClick={async () => setResult(await run("/api/admin/notices/send", { ...form, test: true }))}>Send a test to me</Btn>
            {dry && (
              <span style={{ fontSize: 12, color: theme.text }} data-notice-dry="">
                <b>{dry.recipients}</b> recipient{dry.recipients === 1 ? "" : "s"} · {dry.suppressed} suppressed
                {needsRaise ? <span style={{ color: C.WARNING }}> — above the ceiling of {dry.ceiling}</span> : null}
              </span>
            )}
          </div>
          {dry && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {needsRaise && (
                <label style={{ fontSize: 12, color: theme.textMuted }}>Raise the ceiling to
                  <input value={ceiling} onChange={e => setCeiling(e.target.value)} inputMode="numeric" style={{ ...input, width: 90, marginLeft: 6, display: "inline-block" }}/></label>
              )}
              <Btn theme={theme} danger disabled={busy || !ready || (needsRaise && Number(ceiling) < dry.recipients)}
                onClick={async () => { if (!window.confirm(`Send this notice to ${dry.recipients} people now?`)) return;
                  setResult(await run("/api/admin/notices/send", { ...form, ceiling: needsRaise ? Number(ceiling) : null })); load(); }}>
                Send to {dry.recipients}
              </Btn>
            </div>
          )}
          {result && <div style={{ fontSize: 12, color: theme.text }} role="status">
            {result.test ? "Test" : "Sent"}: {result.sent} sent · {result.skipped} skipped · {result.failed} failed{result.reason ? ` (${result.reason})` : ""}</div>}
        </div>
      </Card>
      <Card theme={theme} title="History — who, when, how many (never the content)">
        <Table theme={theme} rows={d.log} empty="No notices sent yet." cols={[
          { key: "at", label: "When", render: r => ago(r.at) },
          { key: "username", label: "By" },
          { key: "audience", label: "Audience" },
          { key: "recipients", label: "Recipients", right: true },
          { key: "sent", label: "Sent", right: true },
          { key: "skipped", label: "Skipped", right: true },
          { key: "failed", label: "Failed", right: true },
          { key: "test", label: "Test", render: r => (r.test ? "yes" : "") },
        ]}/>
      </Card>
    </div>
  );
}

// ⭐ COST VISIBILITY (owner, 10-09) · Admin → Today → Costs & quotas. What a résumé costs, which model ran, the cache and
// the retry notes live HERE and nowhere a user can see; users see only their drafts left and "about 10–20 seconds".
// The banner is set when the model account ran out of credit or lost its key — users saw only "unavailable".
// D83 rebuild #3 (39d): the Panel shell, the numbers on open, and the ledger's spend (audit #12) in the same panel.
const SPEND_PERIODS = [[1, "Today (UTC)"], [7, "The last 7 days"], [30, "The last 30 days"]];
export function CostsTab({ theme }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const { ask, dialog } = useConfirm();
  const load = useCallback(() => { setErr(null); api("/api/admin/costs").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const s = d?.summary || {};
  const cents = (x) => (x?.cents == null ? "—" : `${Number(x.cents).toFixed(2)}¢ (${x.basis === "ledger" ? `median of ${x.samples}` : "measured at D70 Phase 0"})`);
  const a = d?.fundingAlert;
  const dismiss = async () => {
    if (!await ask({ title: "Dismiss the banner?", label: "Dismiss", body: "It comes back with the next funding failure; nothing else changes." })) return;
    try { await api("/api/admin/costs/funding-alert/clear", { method: "POST" }); load(); } catch (e) { setErr(e.message); }
  };
  return (
    <Panel title="Costs & quotas" data-admin-costs=""
      code="Cost visibility (owner, 10-09): résumé economics are the admin's alone. Figures are the usage ledger (usage_events); a résumé's price is the median of recent delivered calls, or D70 Phase 0's measurement until there are enough."
      purpose="What résumé generation and search cost us, call by call. Users never see these figures — only how many drafts they have left."
      numbers={d ? [[s.generate?.cents == null ? "—" : `${Math.round(s.generate.cents)}¢`, "per Generate résumé"],
        [s.aPlus?.cents == null ? "—" : `${Math.round(s.aPlus.cents)}¢`, "per A+ résumé"],
        [num(d.last24h?.calls), "generation calls, last 24 hours"],
        [usd(d.last24h?.costUsd), "their cost, last 24 hours"],
        [a ? "Failing" : "OK", a ? "the model account needs attention" : "the model account", !a]] : []}>
      {dialog}
      <Err msg={err}/>
      {a && (
        <div style={{ ...callout(C.DANGER), marginBottom: 12 }} data-funding-alert="">
          <b>Generation is failing — the model account needs attention.</b> Since {stamp(a.at)} ({a.where}): <code>{a.message}</code> — users are told only
          that résumé generation is unavailable. Top up or fix the key; the next successful generation clears this.
          <div style={{ marginTop: 8 }}><Btn theme={theme} onClick={dismiss}>Dismiss…</Btn></div>
        </div>
      )}
      {d && <KV theme={theme} rows={[["Generate", cents(s.generate)], ["A+ résumé", cents(s.aPlus)]]}/>}
      <h3 style={{ ...h2, fontSize: 15, margin: "14px 0 6px" }}>Recent generation calls</h3>
      <Table theme={theme} rows={d?.recent || []} cols={[
        { key: "at", label: "When", render: r => ago(r.at) },
        { key: "username", label: "User", render: r => r.username || `#${r.userId}` },
        { key: "purpose", label: "Purpose", render: r => [r.purpose, r.kind].filter(Boolean).join(" · ") },
        { key: "model", label: "Model" },
        { key: "inputTokens", label: "In", right: true, render: r => num(r.inputTokens) },
        { key: "outputTokens", label: "Out", right: true, render: r => num(r.outputTokens) },
        { key: "cacheReadTokens", label: "Cache read", right: true, render: r => num(r.cacheReadTokens) },
        { key: "costUsd", label: "Cost", right: true, render: r => usd(r.costUsd) },
        { key: "success", label: "OK", render: r => (r.success ? "yes" : "no"), color: r => (r.success ? null : C.DANGER) },
        { key: "note", label: "Note (retry reason, failure)", render: r => r.note || "—" },
      ]}/>
      <SpendPart theme={theme}/>
    </Panel>
  );
}

// The ledger's whole spend — every purpose and provider, search included (audit #12, merged into Costs & quotas).
function SpendPart({ theme }) {
  const [days, setDays] = useState(1);
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    const to = nowSec() + 60;
    const from = days === 1 ? to - (to % 86400) : to - days * 86400;
    setErr(null);
    api(`/api/admin/analytics/spend?from=${from}&to=${to}`).then(setD).catch(e => setErr(e.message));
  }, [days]);
  const cov = d?.coverage;
  const input = { background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12 };
  return (
    <div data-admin-spend="" style={{ marginTop: 18 }}>
      <h3 style={{ ...h2, fontSize: 15, margin: "0 0 6px" }}>All spend in the ledger</h3>
      <div style={{ ...row, marginBottom: 10 }}>
        <select aria-label="Period" value={days} onChange={e => setDays(Number(e.target.value))} style={input}>
          {SPEND_PERIODS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}
        </select>
        {d && <span style={quiet}>{stamp(d.range.from)} → now · newest ledger row {ago(d.dataSpan?.newestEventAt)}</span>}
      </div>
      <Err msg={err}/>
      {d && (
        <>
          {d.empty && <div style={{ fontSize: 12, color: C.WARNING, marginBottom: 8 }}>{d.emptyReason}</div>}
          <KV theme={theme} rows={[
            ["cost", usd(d.totals.cost_usd)],
            ["model calls", `${num(d.totals.calls)}${d.totals.failed_calls ? ` · ${num(d.totals.failed_calls)} FAILED` : ""}`,
              d.totals.failed_calls ? C.DANGER : null],
            ["tokens", num(d.totals.total_tokens)],
            ["tracking coverage", cov ? (cov.healthy ? "healthy — " : "GAP — ") + cov.note : "—", cov && !cov.healthy ? C.DANGER : C.SUCCESS],
          ]}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
            <Table theme={theme} rows={d.byPurpose} cols={[
              { key: "purpose", label: "call site (purpose)" },
              { key: "calls", label: "calls", right: true, render: r => num(r.calls) },
              { key: "cost_usd", label: "cost", right: true, render: r => usd(r.cost_usd) },
            ]}/>
            <Table theme={theme} rows={d.byProvider} cols={[
              { key: "provider", label: "provider" },
              { key: "calls", label: "calls", right: true, render: r => num(r.calls) },
              { key: "failed_calls", label: "failed", right: true, render: r => num(r.failed_calls || 0),
                color: r => (r.failed_calls ? C.DANGER : null) },
              { key: "cost_usd", label: "cost", right: true, render: r => usd(r.cost_usd) },
            ]}/>
          </div>
        </>
      )}
    </div>
  );
}


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
const stamp = ts => (ts ? new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 16) + "Z" : "—");
const usd = n => (n == null ? "—" : `$${Number(n).toFixed(n >= 1 ? 2 : 4)}`);
const num = n => (n == null ? "—" : Number(n).toLocaleString());
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

function KV({ theme, rows }) {
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

function Btn({ theme, onClick, disabled, danger, primary, children, title }) {
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

function Err({ msg }) {
  if (!msg) return null;
  return <div style={{ color: C.DANGER, fontSize: 12, margin: "8px 0" }}>{msg}</div>;
}

function Table({ theme, cols, rows, empty = "Nothing recorded." }) {
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
export function DeploySection({ theme }) {
  const [v, setV] = useState(null);
  const [at, setAt] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    setErr(null);
    api("/api/version").then(d => { setV(d); setAt(nowSec()); }).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  const w = v?.atsWeights;
  return (
    <Card theme={theme} title="Deploy — /api/version" measured={at ? `read ${stamp(at)} from this server` : null}>
      <Err msg={err}/>
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
      <div style={{ marginTop: 10 }}><Btn theme={theme} onClick={load}>Re-read</Btn></div>
    </Card>
  );
}

// ── D76 · Railway's events — GET /api/admin/deploy-events ──────────────────────────────────────
// The last event per service, a failed or crashed deploy (or a volume / monitor alert) in red, beside
// this server's own latest migration — so a push that did NOT deploy is visible, not found by accident.
export function DeploymentsSection({ theme }) {
  const [d, setD] = useState(null);
  const [v, setV] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    setErr(null);
    api("/api/admin/deploy-events").then(setD).catch(e => setErr(e.message));
    api("/api/version").then(setV).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const rows = (d?.latest || []).map(e => [
    e.service_name || "?",
    `${e.event_type}${e.commit_hash ? ` · ${String(e.commit_hash).slice(0, 7)}` : ""} · ${e.environment_name || "?"} · ${ago(e.received_at)}`,
    isAlarm(e) ? C.DANGER : (["success", "deployed", "redeployed"].includes(e.state) ? C.SUCCESS : null),
  ]);
  return (
    <Card theme={theme} title="Deployments — Railway's webhook (D76)" measured={v ? `this server: ${v.commit ?? "?"} · migration ${v.migrations?.latestApplied ?? "?"}` : null}>
      <Err msg={err}/>
      {d && (rows.length
        ? <KV theme={theme} rows={rows}/>
        : <div style={{ fontSize: 12, color: C.INK_FAINT }}>No event received yet — the webhook is set in Railway → Project Settings → Webhooks, with the header <code>Authorization: Bearer &lt;RAILWAY_WEBHOOK_TOKEN&gt;</code>.</div>)}
      <div style={{ marginTop: 10 }}><Btn theme={theme} onClick={load}>Re-read</Btn></div>
    </Card>
  );
}

// ── D77 · the disk — GET /api/admin/disk ──────────────────────────────────────────────────────
// Railway's volume alert is Pro-only; this is it. Green below 70%, amber to 85%, red above (the server's
// toneFor — one rule). The D74 tranche line is what 25 more companies would do, by this database's numbers.
const DISK_TONE = { green: C.SUCCESS, amber: C.WARNING, red: C.DANGER };
const mbOf = (n) => `${Math.round((n || 0) / 1048576)} MB`;
export function DiskSection({ theme }) {
  const [g, setG] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => { setErr(null); api("/api/admin/disk").then(setG).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <Card theme={theme} title="Disk — the volume (D77)" measured={g ? `statfs on the data directory · amber ${g.amberAt}% · red ${g.redAt}%` : null}>
      <Err msg={err}/>
      {g && (
        <KV theme={theme} rows={[
          ["used", `${g.usedPct}% — ${mbOf(g.usedBytes)} of ${mbOf(g.totalBytes)} (${mbOf(g.freeBytes)} free)`, DISK_TONE[g.tone] || null],
          ["backups", `${g.backups.count} · ${mbOf(g.backups.bytes)} of a ${mbOf(g.backups.budget)} budget`],
          ["largest", (g.largest || []).slice(0, 5).map(f => `${f.path} ${mbOf(f.bytes)}`).join(" · ") || "—"],
          g.tranche25 && ["25 more companies", `→ ${g.tranche25.projectedPct}% (${g.tranche25.rowsPerCompany} rows / company × ${Math.round(g.tranche25.bytesPerRow / 1024)} KB / row, backups included) · gate ${g.tranche25.limit}%`,
            g.tranche25.projectedPct > g.tranche25.limit ? C.DANGER : null],
        ]}/>
      )}
      <div style={{ marginTop: 10 }}><Btn theme={theme} onClick={load}>Re-read</Btn></div>
    </Card>
  );
}

// ── D78 A · the board's age policy — GET/PUT /api/admin/board-policy, POST …/sweep ─────────────────────
// New postings past the limit are never written (always on). Retiring EXISTING ones waits for the owner's
// "Enforce" after reading this dry run; applied postings are always kept; nothing is deleted.
export function BoardPolicySection({ theme }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);
  const load = useCallback(() => { setErr(null); api("/api/admin/board-policy").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const put = async (patch) => { try { await api("/api/admin/board-policy", { method: "PUT", body: JSON.stringify(patch) }); load(); } catch (e) { setErr(e.message); } };
  const sweep = async () => {
    const r = d?.dryRun;
    if (!r || !window.confirm(`Retire ${r.candidates} posting(s) older than ${r.limitDays} days (${Math.round(r.share * 100)}% of the active board)? Applied postings are kept; nothing is deleted.`)) return;
    try {
      const out = await api("/api/admin/board-policy/sweep", { method: "POST", body: JSON.stringify({ apply: true, expectCandidates: r.candidates }) });
      setNote(`Retired ${out.retired}.`); load();
    } catch (e) { setErr(e.message); }
  };
  // D78 B: the computer-science scope — the same contract as the age sweep (dry run, echo the count).
  const scopeSweep = async () => {
    const q = d?.scopeDryRun;
    if (!q || !window.confirm(`Retire ${q.candidates} out-of-scope posting(s) (${Math.round(q.share * 100)}% of the active board)? Applied postings are kept; nothing is deleted.`)) return;
    try {
      const out = await api("/api/admin/board-policy/scope-sweep", { method: "POST", body: JSON.stringify({ apply: true, expectCandidates: q.candidates }) });
      setNote(`Retired ${out.retired} out of scope.`); load();
    } catch (e) { setErr(e.message); }
  };
  const p = d?.policy, r = d?.dryRun, q = d?.scopeDryRun;
  return (
    <Card theme={theme} title="Board policy — age and scope (D78)" measured={r ? `dry run: ${r.candidates} of ${r.active} active are past ${r.limitDays} days (${Math.round(r.share * 100)}%)` : null}>
      <Err msg={err}/>
      {p && r && (
        <KV theme={theme} rows={[
          ["limit", `${p.age_limit_days} days — new postings older than this are never written`],
          ["existing postings", p.age_enforce ? "ENFORCED — retired at the crawl and by the 03:30 sweep" : "report only — nothing is retired until you enforce", p.age_enforce ? C.WARNING : null],
          ["would retire", `${r.candidates} (${Object.entries(r.byBasis).map(([k, v]) => `${v} by ${k}`).join(", ") || "—"}) · ${Math.round(r.share * 100)}% of the board`],
          ["by company", r.byCompany.slice(0, 8).map(([c, n]) => `${c} ${n}`).join(" · ") || "—"],
          ["by source", Object.entries(r.bySource).map(([s, n]) => `${s} ${n}`).join(" · ") || "—"],
        ]}/>
      )}
      {p && q && (
        <KV theme={theme} rows={[
          ["computer science only", p.scope_enforce ? `ENFORCED (rule v${q.version}) — out-of-scope postings are not written, and are retired at the crawl and by the 03:30 sweep` : `report only (rule v${q.version}) — nothing is dropped until you enforce`, p.scope_enforce ? C.WARNING : null],
          ["would retire", `${q.candidates} of ${q.active} (${Math.round(q.share * 100)}%)${q.appliedKept ? ` · ${q.appliedKept} applied kept` : ""}`],
          ["by family", Object.entries(q.byFamily).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(" · ") || "—"],
          ["by rule", Object.entries(q.byReason).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(" · ") || "—"],
          ["by company", q.byCompany.slice(0, 8).map(([c, n]) => `${c} ${n}`).join(" · ") || "—"],
        ]}/>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {p && <Btn theme={theme} danger={!p.age_enforce} onClick={() => put({ age_enforce: !p.age_enforce })}>{p.age_enforce ? "Stop enforcing" : "Enforce on existing postings"}</Btn>}
        {r && r.candidates > 0 && <Btn theme={theme} onClick={sweep}>Run the sweep now</Btn>}
        {p && <Btn theme={theme} danger={!p.scope_enforce} onClick={() => put({ scope_enforce: !p.scope_enforce })}>{p.scope_enforce ? "Stop enforcing CS scope" : "Enforce CS scope"}</Btn>}
        {q && q.candidates > 0 && <Btn theme={theme} onClick={scopeSweep}>Run the scope sweep now</Btn>}
        <Btn theme={theme} onClick={load}>Re-read</Btn>
      </div>
      {note && <div style={{ fontSize: 12, marginTop: 6, color: theme.textMuted }}>{note}</div>}
    </Card>
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
export function CrawlerTab({ theme }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState(null);
  const load = useCallback(() => { setErr(null); api("/api/admin/crawler").then(setD).catch(e => setErr(e.message)); }, []);
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
  const flag = async (t) => {
    const n = window.prompt(t.flagged_wrong ? "Clear the wrong-answer flag? (OK to clear)" : "What is wrong with this answer?", "");
    if (n === null) return;
    try { await api(`/api/admin/crawler/tasks/${t.id}/flag`, { method: "POST", body: JSON.stringify({ wrong: !t.flagged_wrong, note: n }) }); load(); } catch (e) { setErr(e.message); }
  };
  const st = d?.state, b = d?.budget, paused = d?.pause?.paused;
  return (
    <div>
      <Err msg={err}/>
      {d && (
        <Card theme={theme} title="Crawler — the switches (D75)" measured={st?.updated_at ? `last changed ${ago(st.updated_at)}` : "never changed"}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <Btn theme={theme} primary={paused} danger={!paused} onClick={() => put({ paused: !st.paused })}>
              {st.paused ? "▶ Resume" : "❚❚ Pause"}
            </Btn>
            <span style={{ fontWeight: 700, color: paused ? C.WARNING : C.SUCCESS }}>
              {paused ? `PAUSED${d.pause.by === "env" ? " — by CRAWLER_PAUSED on the server (the second switch)" : ""}` : "RUNNING — the worker may lease tasks"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: theme.textMuted, width: 90 }}>Mode</span>
            <Btn theme={theme} primary={st.mode === "dry"} onClick={() => put({ mode: "dry" })}>Dry-run — no request leaves</Btn>
            <Btn theme={theme} primary={st.mode === "live"} danger={st.mode !== "live"} onClick={() => { if (window.confirm("Live: the worker will request real public pages (robots.txt honoured, deny-list enforced). Continue?")) put({ mode: "live" }); }}>Live</Btn>
          </div>
          <KV theme={theme} rows={[
            // STEP 1c: the worker has no domain and no healthcheck — draft records every call it makes.
            ["worker last seen", d.worker?.lastSeen ? `${ago(d.worker.lastSeen)} — ${d.worker.lastCall}${d.worker.silent ? " · SILENT: is it running?" : ""}` : "never — the worker has not called draft",
              d.worker?.silent ? C.WARNING : C.SUCCESS],
            ["per-run cap", `${st.per_run_cap} tasks per enqueue`],
            ["schedule", st.schedule_enabled ? `daily at ${st.schedule_hhmm} UTC · ${st.schedule_tasks} tasks from the captured companies${st.schedule_last_date ? ` · last ${st.schedule_last_date}` : ""}` : "off"],
            ["today", `${b.tasksToday} of ${b.dailyCap} tasks · ${b.pagesToday} pages · ${b.minutesToday} min`, b.tasksToday >= b.dailyCap ? C.WARNING : null],
            ["wrong answers flagged", String(d.wrongAnswers), d.wrongAnswers ? C.DANGER : null],
          ]}/>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <Btn theme={theme} onClick={() => { const v = window.prompt("Per-run cap (1–100)", String(st.per_run_cap)); if (v) put({ per_run_cap: Number(v) }); }}>Set cap</Btn>
            <Btn theme={theme} onClick={() => put({ schedule_enabled: !st.schedule_enabled })}>{st.schedule_enabled ? "Schedule off" : "Schedule on"}</Btn>
            <Btn theme={theme} onClick={() => { const v = window.prompt("Daily at (HH:MM, UTC)", st.schedule_hhmm); if (v) put({ schedule_hhmm: v }); }}>Set time</Btn>
            <Btn theme={theme} onClick={() => { const v = window.prompt("Tasks per scheduled run (1–100)", String(st.schedule_tasks)); if (v) put({ schedule_tasks: Number(v) }); }}>Set count</Btn>
            <Btn theme={theme} onClick={load}>Re-read</Btn>
          </div>
        </Card>
      )}
      {d && (
        <Card theme={theme} title="Enqueue — J1, find a company's board" measured={`${d.candidates.length} captured compan${d.candidates.length === 1 ? "y" : "ies"} we cannot crawl`}>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4} placeholder="https://company.com — one per line"
            style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 12, padding: 8, background: theme.bg, color: theme.text, border: `1px solid ${theme.border || C.INK_FAINT}`, borderRadius: 6 }}/>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Btn theme={theme} disabled={!paste.trim()} onClick={() => enqueue("/api/admin/crawler/tasks", { type: "j1_find_board", urls: paste.split(/\s+/).filter(Boolean) })}>Queue pasted domains</Btn>
            <Btn theme={theme} disabled={!d.candidates.length} onClick={() => enqueue("/api/admin/crawler/tasks/captures")}>Queue captured companies ({d.candidates.length})</Btn>
          </div>
          {note && <div style={{ fontSize: 12, marginTop: 6, color: theme.textMuted }}>{note}</div>}
        </Card>
      )}
      {d && (
        <Card theme={theme} title="Queue and results" measured={d.tally.map(t => `${t.type === "j1_find_board" ? "J1" : "J2"} ${t.outcome} ${t.n}`).join(" · ") || "empty"}>
          <Table theme={theme} cols={["#", "target", "mode", "status", "evidence / landing", ""]}
            rows={d.tasks.map(t => [
              t.id, t.target_host, t.mode || "—",
              <span key="s" style={{ color: CRAWL_TONE[t.result_status] || theme.text, fontWeight: 700 }}>{t.result_status || t.status}{t.refused_reason ? ` — ${t.refused_reason}` : ""}{t.error ? ` — ${t.error}` : ""}</span>,
              (t.evidence || []).map(e => `${e.url} (${e.how})`).join(" · ") || (t.formOrigin ? `${t.formOrigin} · ${t.stoppedAt}` : "—"),
              <Btn key="f" theme={theme} danger={!t.flagged_wrong} onClick={() => flag(t)}>{t.flagged_wrong ? `wrong: ${t.flag_note || "flagged"}` : "Flag wrong"}</Btn>,
            ])}/>
        </Card>
      )}
      {d && (
        <Card theme={theme} title="Deny-list — wins over every task" measured={`${d.denyList.length} domains`}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>{d.denyList.join(" · ") || "—"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn theme={theme} onClick={async () => { const v = window.prompt("Domain to deny (e.g. example.com) — also refuses anything already queued for it"); if (!v) return;
              try { await api("/api/admin/crawler/deny", { method: "POST", body: JSON.stringify({ domain: v, reason: "owner" }) }); load(); } catch (e) { setErr(e.message); } }}>Add</Btn>
            <Btn theme={theme} onClick={async () => { const v = window.prompt("Domain to remove from the deny-list"); if (!v) return;
              try { await api(`/api/admin/crawler/deny/${encodeURIComponent(v)}`, { method: "DELETE" }); load(); } catch (e) { setErr(e.message); } }}>Remove</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Full-auto kill switch — GET / PUT / DELETE /api/admin/full-auto ────────────────────────────
// Three states, not two (see server.js): forced off, pinned on, inherit the deploy. The panel shows
// which one is in force and WHY, because "disabled: true" alone cannot tell you whether clearing the
// override changes anything.
export function KillSwitchSection({ theme }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setErr(null);
    api("/api/admin/full-auto").then(setS).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (kind) => {
    if (!s) return;
    const msg = {
      disable: "STOP full-auto submission?\n\nWrites app_settings.apply_full_auto_disabled = true. " +
               "Every full-auto run stops submitting at its next job (checked per job, not only at start). " +
               "Semi mode keeps working. Nothing is deleted. Reversible from here.",
      pin:     "PIN full-auto ON?\n\n⚠ Real applications will be submitted to employers by full-auto runs.\n\n" +
               "Writes app_settings.apply_full_auto_disabled = false, which OVERRIDES the deploy: even if a later " +
               `deploy sets APPLY_FULL_AUTO_DISABLED=1, full-auto stays on until this is cleared.`,
      clear:   `CLEAR the override and inherit the deploy?\n\nDeletes the app_settings row. Full-auto will then be ` +
               `${s.envDefault ? "DISABLED" : "ENABLED"} (APPLY_FULL_AUTO_DISABLED=${s.envRaw ?? "unset"}).` +
               (s.envDefault ? "" : "\n\n⚠ That means real applications resume being submitted."),
    }[kind];
    if (!confirm(msg)) return;
    setBusy(true); setErr(null);
    try {
      const body = kind === "clear" ? undefined : JSON.stringify({ disabled: kind === "disable" });
      setS(await api("/api/admin/full-auto", { method: kind === "clear" ? "DELETE" : "PUT", ...(body ? { body } : {}) }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <Card theme={theme} title="Full-auto kill switch" measured={s ? "read at request time — never cached" : null}
      tone={s && !s.disabled ? C.WARNING : undefined}>
      <Err msg={err}/>
      {s && (
        <>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8,
                        color: s.disabled ? C.SUCCESS : C.WARNING }}>
            Full-auto submission is {s.disabled ? "STOPPED" : "ON — runs submit to employers"}
          </div>
          <KV theme={theme} rows={[
            ["decided by", s.source === "override" ? `admin override (app_settings = "${s.override}")` : "the deploy (no override)"],
            ["deploy default", `${s.envDefault ? "disabled" : "enabled"} (APPLY_FULL_AUTO_DISABLED=${s.envRaw ?? "unset"})`],
          ]}/>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Btn theme={theme} primary disabled={busy || (s.disabled && s.source === "override")}
              onClick={() => act("disable")}>Stop full-auto</Btn>
            <Btn theme={theme} danger disabled={busy || (!s.disabled && s.source === "override")}
              onClick={() => act("pin")}>Pin full-auto ON…</Btn>
            <Btn theme={theme} disabled={busy || s.source !== "override"}
              onClick={() => act("clear")}>Clear override (inherit deploy)…</Btn>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>
            Stopping is the safe direction and is never destructive. Semi mode is unaffected either way.
          </div>
        </>
      )}
    </Card>
  );
}

// ── Board-fit precompute — POST /api/admin/board-fit/precompute ───────────────────────────────
// The route is dry-run by default and so is this: Score is unreachable until a dry run of the SAME
// parameters has been read, and its label is the number of postings it will score.
export function BoardFitSection({ theme }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [force, setForce] = useState(false);
  const [dry, setDry] = useState(null);       // { key, body }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    // id 0 is the 'system' user (migration 075): it has no profile and nothing to rank.
    api("/api/admin/users").then(d => setUsers((Array.isArray(d) ? d : []).filter(u => u.id !== 0))).catch(() => {});
  }, []);
  const key = `${userId}|${force}`;
  const params = () => ({ ...(userId ? { userId: Number(userId) } : {}), ...(force ? { force: true } : {}) });

  const runDry = async () => {
    setBusy("dry"); setErr(null); setResult(null);
    try { setDry({ key, body: await api("/api/admin/board-fit/precompute", { method: "POST", body: JSON.stringify({ ...params(), dryRun: true }) }) }); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const planFresh = dry && dry.key === key;
  const todo = planFresh ? dry.body.summary?.todo ?? 0 : 0;
  const runReal = async () => {
    const profiles = dry.body.summary?.profiles ?? 0;
    if (!confirm(`Score ${num(todo)} posting(s) across ${profiles} profile(s)${force ? " (FORCE: fresh rows re-scored too)" : ""}?\n\n` +
                 "Writes the board's fit cache (ats_only_reports) only — zero model calls, no user data touched. " +
                 `~7 ms per posting: roughly ${Math.max(1, Math.round(todo * 0.007))} s. The board's order changes when the pass commits.`)) return;
    setBusy("real"); setErr(null);
    try { setResult(await api("/api/admin/board-fit/precompute", { method: "POST", body: JSON.stringify({ ...params(), dryRun: false }) })); setDry(null); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const body = result || (planFresh ? dry.body : null);
  return (
    <Card theme={theme} title="Board-fit precompute" measured="dry run by default — nothing is scored until you press Score">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <select value={userId} onChange={e => setUserId(e.target.value)}
          style={{ background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`,
                   borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
          <option value="">every user's active profile</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.username} (id {u.id})</option>)}
        </select>
        <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center",
                        color: force ? C.DANGER : theme.text }}>
          <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)}/>
          force — re-score fresh rows too (picks up a term-weight refresh)
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn theme={theme} primary disabled={!!busy} onClick={runDry}>{busy === "dry" ? "Planning…" : "Dry run"}</Btn>
        <Btn theme={theme} danger disabled={!planFresh || todo === 0 || !!busy} onClick={runReal}>
          {busy === "real" ? "Scoring…" : planFresh ? `Score ${num(todo)} posting(s)…` : "Score…"}
        </Btn>
        <span style={{ fontSize: 11, color: theme.textMuted }}>
          {!dry && !result ? "Dry run first — Score unlocks for exactly the parameters it planned."
            : dry && !planFresh ? "Parameters changed since the dry run — run it again."
            : planFresh && todo === 0 ? "Nothing to do — every active posting already has a fresh score."
            : null}
        </span>
      </div>
      <Err msg={err}/>
      {body && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6, color: result ? C.SUCCESS : theme.text }}>
            {result ? "RAN — " : "DRY RUN — nothing was scored or written · "}
            {body.summary?.profiles ?? 0} profile(s) ·{" "}
            {Object.entries(body.summary?.byStatus || {}).map(([k, n]) => `${k} ${n}`).join(", ") || "no profiles"}
            {result ? ` · ${num(body.summary?.scored)} scored` : ` · ${num(body.summary?.todo)} to score`}
          </div>
          <Table theme={theme} rows={body.results || []} cols={[
            { key: "userId", label: "user" },
            { key: "profileId", label: "profile" },
            { key: "status", label: "status", color: r => (r.status === "failed" ? C.DANGER : r.status === "no_basis" ? C.WARNING : null) },
            { key: "active", label: "active", right: true, render: r => num(r.active) },
            { key: "fresh", label: "fresh", right: true, render: r => num(r.fresh) },
            { key: "missing", label: "missing", right: true, render: r => num(r.missing) },
            { key: "stale", label: "stale", right: true, render: r => num(r.stale) },
            { key: "todo", label: "to score", right: true, render: r => num(r.todo) },
            { key: "scored", label: "scored", right: true, render: r => (r.scored == null ? "—" : num(r.scored)) },
            { key: "why", label: "note", render: r => r.why || r.error || "" },
          ]}/>
        </div>
      )}
    </Card>
  );
}

// ── Enrichment backlog — POST /api/admin/enrichment/run, counting only (D17, A80 V4) ──────────
// Was A61's "Enrich N" button: a dry run, then real model calls. D17 (10-03) allows a model for
// résumé generation only, so this section counts the backlog and the board's coverage, and sends
// the operator to the round trip that replaced the button — the DB inspector's "Enrichment Round
// Trip" (export → enrich outside the product → import, every import a revertible batch). The
// route refuses `apply` (410); nothing here can ask it to.
const enrichCols = ["summary", "experience_level", "skills_json", "workplace_type", "salary_min_usd", "enriched_at"];

export function EnrichmentSection({ theme }) {
  const [limit, setLimit] = useState(100);
  const [source, setSource] = useState("");
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const params = () => ({ limit: Number(limit), ...(source.trim() ? { source: source.trim() } : {}) });

  const count = async () => {
    setBusy(true); setErr(null);
    try { setPlan((await api("/api/admin/enrichment/run", { method: "POST", body: JSON.stringify(params()) })).plan); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const cov = plan?.coverageNow;
  return (
    <Card theme={theme} title="Enrichment backlog" measured="counted here — enriched by the export → import round trip, never by a model (D17)">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
          up to
          <input type="number" min={1} max={100} value={limit}
            onChange={e => setLimit(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            style={{ width: 70, background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`,
                     borderRadius: 6, padding: "5px 8px", fontSize: 12 }}/>
        </label>
        <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
          source
          <input value={source} placeholder="any" onChange={e => setSource(e.target.value)}
            style={{ width: 140, background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`,
                     borderRadius: 6, padding: "5px 8px", fontSize: 12 }}/>
        </label>
        <Btn theme={theme} primary disabled={busy} onClick={count}>{busy ? "Counting…" : "Count the backlog"}</Btn>
      </div>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>
        To enrich rows: <a href="/admin/db" style={{ fontWeight: 700, color: C.ACCENT_INK }}>Database → Enrichment Round Trip</a> —
        export the file, fill it outside the product, import it back (dry run first; every import is a batch you can revert).
        New postings stay unenriched until an import covers them.
      </div>
      <Err msg={err}/>
      {plan && (
        <KV theme={theme} rows={[
          ["need enrichment", `${num(plan.candidates)} (of ${num(plan.prefilterCount)} before the content check)`],
          ["listed here", num(plan.wouldSend)],
        ]}/>
      )}
      {cov && (
        <Table theme={theme} rows={enrichCols.map(c => ({ col: c, now: cov.columns?.[c]?.rate }))} cols={[
          { key: "col", label: "board coverage" },
          { key: "now", label: "now", right: true, render: r => pct(r.now) },
        ]}/>
      )}
    </Card>
  );
}

// ── Job data in and out — /api/admin/job-data (A62) ───────────────────────────────────────────
// The JOBS, not their enrichment (that round trip is in the DB inspector). Export the board as
// NDJSON; import postings through the one gateway — dry run first, "Import N" only for the text
// that was planned, every import a batch that can be reverted (dry run, then the matching count).
export function JobDataSection({ theme }) {
  const [text, setText] = useState("");
  const [dry, setDry] = useState(null);       // { forText, body }
  const [result, setResult] = useState(null);
  const [batches, setBatches] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
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
    if (!confirm(`Import ${num(n)} posting(s) through the gateway?\n\n` +
                 `${num(p.insert)} new · ${num(p.replace)} replace a lower-priority copy · ${num(p.attach)} attach to a posting already on the board · ` +
                 `${num(p.outOfMarket)} held off the board (outside the US).\n${plan.refused.length} line(s) refused.\n\n` +
                 "Revertible as a batch (the new rows are retired). " + plan.cannotUndo)) return;
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
      if (!confirm(`Revert batch ${b.id}?\n\n${d.note}`)) return;
      await api(`/api/admin/job-data/import/batches/${b.id}/revert`, { method: "POST", body: JSON.stringify({ expectRows: d.wouldRetire }) });
      loadBatches();
    } catch (e) { setErr(e.payload?.note || e.message); }
  };
  const shown = result || plan;
  return (
    <Card theme={theme} title="Job data — in and out" measured="import is dry by default — nothing is written until you press Import">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <a href={exportHref()} style={{ fontSize: 12, fontWeight: 700, color: C.ACCENT_INK }}>Export the active board (NDJSON) ↓</a>
        <span style={{ fontSize: 11, color: theme.textMuted }}>one posting per line: title, company, url required; source one of the known sources (default import)</span>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder='{"title":"…","company":"…","url":"https://…","location":"…","description":"…"}'
        style={{ width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace, monospace", fontSize: 11,
                 background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 8 }}/>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <Btn theme={theme} primary disabled={!!busy || !text.trim()} onClick={runDry}>{busy === "dry" ? "Planning…" : "Dry run"}</Btn>
        <Btn theme={theme} danger disabled={!plan || n === 0 || !!busy} onClick={runReal}>
          {busy === "real" ? "Importing…" : plan ? `Import ${num(n)} posting(s)…` : "Import…"}
        </Btn>
        <span style={{ fontSize: 11, color: theme.textMuted }}>
          {dry && !plan ? "The text changed since the dry run — run it again." : !dry && !result ? "Dry run first — Import unlocks for exactly the text it planned." : null}
        </span>
      </div>
      <Err msg={err}/>
      {shown && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6, color: result ? C.SUCCESS : theme.text }}>
            {result ? `IMPORTED — batch ${result.batchId}: ${num(result.inserted)} inserted · ${num(result.attached)} attached · ${num(result.held)} held off the board`
                    : `DRY RUN — nothing written · ${num(shown.valid)} valid of ${num(shown.rows)} · ${num(shown.plan.insert)} new · ${num(shown.plan.replace)} replace · ${num(shown.plan.attach)} attach · ${num(shown.plan.outOfMarket)} outside the US`}
          </div>
          {shown.refused?.length > 0 && <Err msg={`Refused: ${shown.refused.slice(0, 5).map(r => `line ${r.line}: ${r.reason}`).join(" · ")}${shown.refused.length > 5 ? " …" : ""}`}/>}
          {result?.note && <div style={{ fontSize: 11, color: theme.textMuted }}>{result.note}</div>}
        </div>
      )}
      {batches.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Table theme={theme} rows={batches} cols={[
            { key: "id", label: "batch" },
            { key: "created_at", label: "when", render: r => stamp(r.created_at) },
            { key: "inserted", label: "inserted", right: true },
            { key: "attached", label: "attached", right: true },
            { key: "held_out_of_market", label: "held", right: true },
            { key: "refused", label: "refused", right: true },
            { key: "reverted_at", label: "", render: r => (r.reverted_at
              ? `reverted ${stamp(r.reverted_at)} (${r.reverted_rows})`
              : <button type="button" onClick={() => revert(r)} style={{ fontSize: 11, cursor: "pointer" }}>Revert…</button>) },
          ]}/>
        </div>
      )}
    </Card>
  );
}

// ── Company list — /api/admin/companies (A50 step 4) ──────────────────────────────────────────
// The growth lever, as a surface. Add = probe the board first (dead / empty / live, with how many
// postings carry US evidence), then "Add" only for exactly what the probe saw. Disable is reversible.
// Suggestions are slugs users' captures named that are not configured (A45's harvest, from A62).
// D80 E: a company's hiring heat, as a mark (D60: never a pill).
const HEAT_TONE = { hot: C.SUCCESS, warm: C.INK_FAINT, probation: C.INK_FAINT, dormant: C.WARNING };
export function CompaniesSection({ theme }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState({ company: "", atsType: "greenhouse", slug: "" });
  const [probe, setProbe] = useState(null);      // { key, body }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = useCallback(() => { api("/api/admin/companies").then(setD).catch(e => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const key = `${form.atsType}|${form.slug.trim()}|${form.company.trim()}`;
  const seen = probe && probe.key === key ? probe.body.validation : null;
  const body = () => ({ company: form.company.trim(), atsType: form.atsType, slug: form.slug.trim() });
  const runProbe = async () => {
    setBusy("probe"); setErr(null); setMsg(null);
    try { setProbe({ key, body: await api("/api/admin/companies", { method: "POST", body: JSON.stringify(body()) }) }); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const add = async () => {
    if (!confirm(`Add ${form.company} (${form.atsType}/${form.slug})?\n\n${seen.message}\n\nThe next crawl reads it.`)) return;
    setBusy("add"); setErr(null);
    try {
      const r = await api("/api/admin/companies", { method: "POST", body: JSON.stringify({ ...body(), confirm: true, expectState: seen.state }) });
      setMsg(r.note); setProbe(null); setForm({ company: "", atsType: form.atsType, slug: "" }); load();
    } catch (e) { setErr(e.payload?.message || e.message); }
    setBusy(null);
  };
  const toggle = async (c) => {
    if (!confirm(`${c.active ? "Disable" : "Enable"} ${c.company} (${c.ats_type}/${c.ats_slug})? ${c.active ? "The crawl stops reading it; rows already on the board age out as usual." : "The next crawl reads it again."}`)) return;
    try { await api(`/api/admin/companies/${c.id}`, { method: "PATCH", body: JSON.stringify({ active: !c.active }) }); load(); }
    catch (e) { setErr(e.message); }
  };
  const input = { background: theme.surfaceHigh, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "5px 8px", fontSize: 12 };
  return (
    <Card theme={theme} title="Companies" measured="adding probes the board first — nothing is added until you press Add">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <input placeholder="Company" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={{ ...input, width: 160 }}/>
        <select value={form.atsType} onChange={e => setForm({ ...form, atsType: e.target.value })} style={input}>
          {(d?.atsTypes || ["greenhouse"]).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input placeholder="board slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} style={{ ...input, width: 160 }}/>
        <Btn theme={theme} primary disabled={!!busy || !form.slug.trim() || !form.company.trim()} onClick={runProbe}>{busy === "probe" ? "Probing…" : "Probe the board"}</Btn>
        <Btn theme={theme} disabled={!seen?.ok || !!busy} onClick={add}>{busy === "add" ? "Adding…" : "Add…"}</Btn>
      </div>
      {seen && <div style={{ fontSize: 12, color: seen.ok ? (seen.state === "live" ? C.SUCCESS : theme.text) : C.DANGER, marginBottom: 8 }}>
        {seen.state.toUpperCase()} — {seen.message}
        {seen.sample?.length > 0 && <span style={{ color: theme.textMuted }}> e.g. {seen.sample.map(s => s.title).join(" · ")}</span>}
      </div>}
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 8 }}>{msg}</div>}
      {d?.suggestions?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>NAMED BY CAPTURES, NOT CONFIGURED</div>
          <Table theme={theme} rows={d.suggestions} cols={[
            { key: "ats_type", label: "ats" }, { key: "ats_slug", label: "slug" },
            { key: "people", label: "people", right: true }, { key: "captures", label: "captures", right: true },
            { key: "use", label: "", render: r => <button type="button" style={{ fontSize: 11, cursor: "pointer" }}
                onClick={() => setForm({ company: form.company || r.ats_slug, atsType: r.ats_type, slug: r.ats_slug })}>Use</button> },
          ]}/>
        </div>
      )}
      {d?.heat && (
        <div data-company-heat style={{ fontSize: 12, marginBottom: 8, color: d.heat.meetsTarget === false ? C.WARNING : theme.text }}>
          Hiring heat (D80): {d.heat.hot} hot · {d.heat.warm} warm · {d.heat.dormant} dormant · {d.heat.probation} on probation —{" "}
          {d.heat.hotShare == null ? "nothing to judge yet" : `${Math.round(d.heat.hotShare * 100)}% posted something new in ${d.heat.hotDays} days (target ${Math.round(d.heat.target * 100)}%)`}
          {d.heat.proposals.length > 0 && <div style={{ color: C.WARNING, marginTop: 4 }}>
            Proposed for deactivation (no new in-scope posting in {d.heat.dormantDays} days — press Disable to act): {d.heat.proposals.map(p => `${p.company} (${p.why})`).join(" · ")}
          </div>}
        </div>
      )}
      <Table theme={theme} rows={d?.companies || []} empty="No companies configured." cols={[
        { key: "company", label: "company" }, { key: "ats_type", label: "ats" }, { key: "ats_slug", label: "slug" },
        { key: "active_rows", label: "on board", right: true, render: r => num(r.active_rows) },
        { key: "last_new_at", label: "last new posting", render: r => ago(r.last_new_at) },
        { key: "heat", label: "heat", render: r => r.heat ? <span style={markStyle(HEAT_TONE[r.heat])}>{r.heat}</span> : "—" },
        { key: "active", label: "", render: r => <button type="button" style={{ fontSize: 11, cursor: "pointer", color: r.active ? theme.text : C.WARNING }}
            onClick={() => toggle(r)}>{r.active ? "Disable…" : "Enable…"}</button> },
      ]}/>
      <DiscoveryCandidates theme={theme} onAdded={load}/>
    </Card>
  );
}

// ── D82 C · Candidates — /api/admin/companies/candidates ─────────────────────────────────────
// What the discovery jobs FOUND (HN weekly) and the nightly read-only probe MEASURED, ranked by fresh
// in-scope roles. The jobs never add a company: Approve is dry first (what would be added, what is
// refused and why, the disk gate), then a backup and each add WITH its evidence. Reject keeps the row so
// the next sweep never re-queues it. Status is a mark (D60: never a pill).
const CANDIDATE_TONE = { new: C.INK_FAINT, probed: C.SUCCESS, approved: C.WARNING, rejected: C.INK_FAINT, added: C.SUCCESS, dormant: C.WARNING };
function DiscoveryCandidates({ theme, onAdded }) {
  const [d, setD] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
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
      if (!confirm(`Add ${dry.eligible.length} company(ies)?\n\n${dry.eligible.map(e => `${e.company} — ${e.cs} in-scope <= 120d of ${e.csOpen}`).join("\n")}` +
                   `${refused ? `\n\nRefused: ${refused}` : ""}\n\nA backup is taken first; each add carries its evidence and Disable reverses it.`)) { setBusy(null); return; }
      const r = await api("/api/admin/companies/candidates/approve", { method: "POST",
        body: JSON.stringify({ ids, confirm: true, expectIds: dry.eligible.map(e => e.id) }) });
      setMsg(`${r.added.length} added${r.failed.length ? `, ${r.failed.length} refused at add` : ""}. ${r.note}`);
      setPicked(new Set()); load(); onAdded?.();
    } catch (e) { setErr(e.payload?.message || e.payload?.error || e.message); }
    setBusy(null);
  };
  const reject = async () => {
    if (!confirm(`Reject ${ids.length} candidate(s)? They stay in the pool as rejected and are never queued again.`)) return;
    setBusy("reject"); setErr(null);
    try { const r = await api("/api/admin/companies/candidates/reject", { method: "POST", body: JSON.stringify({ ids }) }); setMsg(`${r.rejected} rejected.`); setPicked(new Set()); load(); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };
  const reset = async (source) => {
    if (!confirm(`Close the ${source} breaker? The job runs again at its next scheduled time.`)) return;
    try { await api(`/api/admin/companies/candidates/breakers/${source}/reset`, { method: "POST", body: "{}" }); load(); }
    catch (e) { setErr(e.message); }
  };
  const disc = d?.discovery;
  const open = (disc?.breakers || []).filter(b => b.open);
  const pctOf = (v) => (v == null ? "—" : `${v}%`);
  return (
    <div data-discovery-candidates style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>CANDIDATES — FOUND BY DISCOVERY, NOT CONFIGURED (D82)</div>
      {disc?.paused && <div style={{ fontSize: 12, color: C.WARNING, marginBottom: 6 }}>Discovery is paused (DISCOVERY_PAUSED) — no job runs.</div>}
      {open.map(b => (
        <div key={b.source} data-discovery-breaker style={{ fontSize: 12, color: C.DANGER, marginBottom: 6 }}>
          The {b.source} job is stopped: {b.failures} consecutive failures (circuit breaker, after {disc.breakerAfter}). Last error: {b.last_error || "—"}{" "}
          <button type="button" style={{ fontSize: 11, cursor: "pointer" }} onClick={() => reset(b.source)}>Reset…</button>
        </div>
      ))}
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>
        {Object.entries(d?.counts || {}).map(([k, v]) => `${v} ${k}`).join(" · ") || "The pool is empty."}
        {(disc?.lastRuns || []).map(r => ` · last ${r.source} run ${ago(r.started_at)}: ${r.status}${r.error_text ? ` (${r.error_text})` : ""}`).join("")}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <Btn theme={theme} primary disabled={!ids.length || !!busy} onClick={approve}>{busy === "approve" ? "Checking…" : `Approve ${ids.length || ""}…`}</Btn>
        <Btn theme={theme} disabled={!ids.length || !!busy} onClick={reject}>{`Reject ${ids.length || ""}…`}</Btn>
      </div>
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 6 }}>{msg}</div>}
      <Table theme={theme} rows={d?.candidates || []} empty="No candidates yet — the HN job runs weekly." cols={[
        { key: "pick", label: "", render: r => ["probed", "new", "approved"].includes(r.status)
            ? <input type="checkbox" checked={picked.has(r.id)} onChange={() => flip(r.id)} aria-label={`select ${r.company}`}/> : "" },
        { key: "company", label: "company" },
        { key: "board", label: "board", render: r => `${r.ats_type}:${r.ats_slug}` },
        { key: "status", label: "status", render: r => <span style={markStyle(CANDIDATE_TONE[r.status] || C.INK_FAINT)}>{r.status}</span> },
        { key: "cs", label: "in-scope ≤120d", right: true, render: r => r.evidence ? `${num(r.evidence.cs)} / ${num(r.evidence.csOpen)}` : "—" },
        { key: "pct30", label: "≤30d", right: true, render: r => pctOf(r.evidence?.pct30) },
        { key: "pct120", label: "≤120d", right: true, render: r => pctOf(r.evidence?.pct120) },
        { key: "us", label: "US", right: true, render: r => pctOf(r.evidence?.usPct) },
        { key: "age", label: "median age", right: true, render: r => r.evidence?.medianAge == null ? "—" : `${r.evidence.medianAge}d` },
        { key: "found", label: "how found", render: r => r.found ? `${r.source} · ${r.found.n_months || 0} mo${r.found.last ? ` (last ${r.found.last})` : ""}${r.found.yc ? ` · YC ${r.found.yc}` : ""}` : r.source },
        { key: "why", label: "verdict", render: r => r.evidence?.bar ? (r.evidence.bar.meets ? "meets the D80 bar" : r.evidence.bar.misses.join(", ")) : (r.status_reason || "—") },
        { key: "sample", label: "titles", render: r => (r.evidence?.sample || []).slice(0, 3).join(" · ") },
      ]}/>
    </div>
  );
}

// ── Slug harvest — /api/admin/slug-harvest (D20) ─────────────────────────────────────────────
// The daily manual sweep's second half: a few SerpApi searches → a pool of ATS boards we do not
// crawl → an export the owner reviews → an import that adds the ones marked "add". Every step is dry
// first. The searches are the free plan's (250 a month), so the run button names how many it spends.
export function SlugHarvestSection({ theme }) {
  const [d, setD] = useState(null);
  const [dry, setDry] = useState(null);
  const [imp, setImp] = useState(null);         // { text, body }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
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
    if (!confirm(`Spend ${n} SerpApi search${n === 1 ? "" : "es"}?\n\n${dry.expectQueries.join("\n")}\n\n${dry.quota?.left ?? "?"} left this month.`)) return;
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
    if (!confirm(`Apply this file?\n\nAdd ${p.wouldAdd} compan${p.wouldAdd === 1 ? "y" : "ies"} (active; the next crawl reads them), skip ${p.wouldSkip}.`)) return;
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
      const lines = p.pairs.map(x => `${x.pair}: ${x.now.decision}${x.now.company ? ` · ${x.now.company}` : ""} → ${typeof x.after === "string" ? x.after : `${x.after.decision ?? "undecided"}${x.after.company ? ` · ${x.after.company}` : ""}`}`);
      if (!confirm(`Revert import ${i.id}?\n\n${lines.join("\n")}\n\nCompanies are disabled, never deleted.`)) return;
      const r = await api(`/api/admin/slug-harvest/imports/${i.id}/revert`, { method: "POST", body: JSON.stringify({ apply: true, expectRestorable: p.restorable }) });
      setMsg(`Reverted import ${i.id}: ${r.restored} pair(s) undecided again, ${r.companiesDisabled} compan${r.companiesDisabled === 1 ? "y" : "ies"} disabled.`); load();
    } catch (e) { fail(e); }
  };
  const plan = d?.plan;
  return (
    <Card theme={theme} title="Slug harvest"
      measured={plan ? `${plan.usedToday} / ${plan.cap} searches today · nothing runs until you press Run` : "measuring…"}>
      {d && !d.configured && <div style={{ fontSize: 12, color: C.WARNING, marginBottom: 8 }}>SERPAPI_KEY is not set — no search can run.</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <Btn theme={theme} primary disabled={!!busy || !!running || !d?.configured} onClick={planSweep}>{busy === "plan" ? "Reading the quota…" : "Plan today's sweep"}</Btn>
        <Btn theme={theme} disabled={!dry?.expectQueries?.length || !!busy} onClick={runSweep}>
          {busy === "run" ? "Starting…" : `Run ${dry?.expectQueries?.length ?? 0} search${dry?.expectQueries?.length === 1 ? "" : "es"}…`}</Btn>
        <a href={`/api/admin/slug-harvest/export${authContextQuery() ? `?${authContextQuery()}` : ""}`} style={{ fontSize: 12, color: theme.text }}>Export for review (JSONL)</a>
        <label style={{ fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          {busy === "import" ? "Checking the file…" : "Import decisions…"}
          <input type="file" accept=".jsonl,.ndjson,.txt" onChange={pickFile} style={{ display: "none" }}/>
        </label>
      </div>
      {running && <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>Sweep {running.id} running — {running.searches} search(es) done.</div>}
      {dry && <div style={{ fontSize: 12, marginBottom: 8 }}>
        {dry.note} {dry.quota && <span style={{ color: theme.textMuted }}>SerpApi: {dry.quota.left ?? "?"} left this month.</span>}
        {dry.quotaError && <span style={{ color: C.DANGER }}> {dry.quotaError}.</span>}
        {dry.plan.skipped.length > 0 && <div style={{ color: theme.textMuted }}>Not searched: {dry.plan.skipped.map(x => `${x.q} (${x.reason})`).join(" · ")}</div>}
      </div>}
      {imp && <div style={{ fontSize: 12, marginBottom: 8 }}>
        <div style={{ color: imp.body.plan.valid ? theme.text : C.DANGER }}>{imp.body.note}</div>
        {imp.body.plan.rejected.map((r, i) => <div key={i} style={{ color: C.DANGER }}>line {r.line} · {r.pair || "—"} · {r.kind}: {r.error}</div>)}
        {imp.body.plan.valid && imp.body.plan.expectWrites > 0 && <div style={{ marginTop: 6 }}>
          <Btn theme={theme} disabled={!!busy} onClick={applyImport}>{busy === "apply" ? "Applying…" : `Apply: add ${imp.body.plan.wouldAdd}, skip ${imp.body.plan.wouldSkip}…`}</Btn>
        </div>}
      </div>}
      <Err msg={err}/>
      {msg && <div style={{ fontSize: 12, color: C.SUCCESS, marginBottom: 8 }}>{msg}</div>}
      <div style={{ fontSize: 11, fontWeight: 800, margin: "6px 0 4px" }}>NEW BOARDS PER SEARCH, BY ROLE FAMILY</div>
      <Table theme={theme} rows={d?.families || []} cols={[
        { key: "family", label: "family" }, { key: "searches", label: "searches", right: true },
        { key: "newPairs", label: "new boards", right: true }, { key: "rate", label: "per search", right: true, render: r => r.rate ?? "—" },
        { key: "exhausted", label: "", render: r => r.exhausted ? <span style={{ color: C.WARNING }}>stopped — nothing new lately</span> : "" },
      ]}/>
      <div style={{ fontSize: 11, fontWeight: 800, margin: "10px 0 4px" }}>SWEEPS</div>
      <Table theme={theme} rows={d?.sweeps || []} empty="No sweep yet." cols={[
        { key: "id", label: "#" }, { key: "started_at", label: "started", render: r => ago(r.started_at) },
        { key: "searches", label: "searches", right: true }, { key: "ats_links", label: "ATS links", right: true },
        { key: "new_pairs", label: "new", right: true }, { key: "conversion", label: "per search", right: true, render: r => r.conversion ?? "—" },
        { key: "error", label: "", render: r => r.error ? <span style={{ color: C.DANGER }}>{r.error}</span> : "" },
      ]}/>
      <div style={{ fontSize: 11, fontWeight: 800, margin: "10px 0 4px" }}>POOL</div>
      <Table theme={theme} rows={d?.pool || []} empty="Nothing harvested yet." cols={[
        { key: "ats_type", label: "ats" }, { key: "pairs", label: "boards", right: true }, { key: "live", label: "live", right: true },
        { key: "undecided", label: "to review", right: true }, { key: "added", label: "added", right: true }, { key: "skipped", label: "skipped", right: true },
      ]}/>
      {d?.imports?.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 800, margin: "10px 0 4px" }}>IMPORTS</div>
        <Table theme={theme} rows={d.imports} cols={[
          { key: "id", label: "#" }, { key: "imported_at", label: "when", render: r => ago(r.imported_at) },
          { key: "rows_written", label: "decisions", right: true }, { key: "companies_added", label: "added", right: true },
          { key: "reverted_at", label: "", render: r => r.reverted_at ? `reverted ${ago(r.reverted_at)}`
              : <button type="button" style={{ fontSize: 11, cursor: "pointer" }} onClick={() => revert(r)}>Revert…</button> },
        ]}/>
      </>}
    </Card>
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
export function SpendSection({ theme }) {
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
  return (
    <Card theme={theme} title="Spend — /api/admin/analytics/spend"
      measured={d ? `${stamp(d.range.from)} → now · newest ledger row ${ago(d.dataSpan?.newestEventAt)}` : null}
      tone={cov && !cov.healthy ? C.DANGER : undefined}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[[1, "Today (UTC)"], [7, "7 days"], [30, "30 days"]].map(([n, l]) => (
          <Btn key={n} theme={theme} primary={days === n} onClick={() => setDays(n)}>{l}</Btn>
        ))}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginTop: 12 }}>
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
    </Card>
  );
}

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

export function OpsTab({ theme }) {
  return (
    <div>
      <DeploySection theme={theme}/>
      <DeploymentsSection theme={theme}/>
      <DiskSection theme={theme}/>
      <BoardPolicySection theme={theme}/>
      <KillSwitchSection theme={theme}/>
      <BoardFitSection theme={theme}/>
      <EnrichmentSection theme={theme}/>
      <JobDataSection theme={theme}/>
      <CompaniesSection theme={theme}/>
      <SlugHarvestSection theme={theme}/>
      <ToolsServiceSection theme={theme}/>
      <SpendSection theme={theme}/>
    </div>
  );
}

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
              { key: "written", label: "written", right: true, render: r => num(r.written) },
              { key: "unchanged", label: "unchanged", right: true, render: r => num(r.unchanged) },
              { key: "refused", label: "refused", right: true, render: r => num(r.refused) },
            ]}/>
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

// client/src/panels/adminOps.jsx — A50 steps 2 and 3: the admin surfaces that were curl-only, and
// the daily glance. Minimal, in the admin panel's existing card/table style — NOT a redesign.
//
// ⛔ EVERY MUTATING CONTROL HERE (1) states what it will do before it does it, (2) asks, and (3) has
// no destructive default. The board-fit pass runs only after a dry run of the SAME parameters, and
// the "score" button says how many postings it will score. The kill switch's three states each say
// what they change, and the one that resumes real submissions to employers is the one that asks
// hardest. A51 is why: "Clean Pool" deleted users' Saves and Passes in one unlabelled click.
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";

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
          w?.refresh && ["weight refresh", Object.entries(w.refresh).map(([k, val]) => `${k}: ${val ?? "—"}`).join(" · ")],
          ["monetisation", v.monetisationEnabled ? "ON — plan gates enforced" : "off — every tool open"],
        ]}/>
      )}
      <div style={{ marginTop: 10 }}><Btn theme={theme} onClick={load}>Re-read</Btn></div>
    </Card>
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
      <KillSwitchSection theme={theme}/>
      <BoardFitSection theme={theme}/>
      <SpendSection theme={theme}/>
    </div>
  );
}

// ── The daily glance — GET /api/admin/glance (+ /api/version for the deploy line) ──────────────
const HEALTH_COLOR = h => (h === "ok" ? C.SUCCESS
  : ["live_search_only", "not_enabled", "paused", "awaiting_first_crawl"].includes(h) ? C.INK_FAINT
  : ["stale", "all_rejected", "out_of_market", "no_results", "never_ran", "no_rows"].includes(h) ? C.WARNING
  : C.DANGER);

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
            <Table theme={theme} rows={ing.sources} cols={[
              { key: "name", label: "source" },
              { key: "health", label: "health", color: r => HEALTH_COLOR(r.health) },
              { key: "lastRunAt", label: "last run", render: r => ago(r.lastRunAt) },
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

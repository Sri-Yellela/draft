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
// The second product is named by the one constant that holds its name (shared/brand.js).
import { LEGACY_BRAND } from "../../../shared/brand.js";

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
      <Table theme={theme} rows={d?.companies || []} empty="No companies configured." cols={[
        { key: "company", label: "company" }, { key: "ats_type", label: "ats" }, { key: "ats_slug", label: "slug" },
        { key: "active_rows", label: "on board", right: true, render: r => num(r.active_rows) },
        { key: "last_new_at", label: "last new posting", render: r => ago(r.last_new_at) },
        { key: "active", label: "", render: r => <button type="button" style={{ fontSize: 11, cursor: "pointer", color: r.active ? theme.text : C.WARNING }}
            onClick={() => toggle(r)}>{r.active ? "Disable…" : "Enable…"}</button> },
      ]}/>
    </Card>
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

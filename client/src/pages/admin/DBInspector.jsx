// client/src/pages/admin/DBInspector.jsx — Admin DB diagnostic tool (/admin/db)
// (A50: the "SCRAPING — SCHEDULED FOR REMOVAL" banner was stale. This is the diagnostic surface
// almost every defect was found through; nothing schedules its removal.)
import { useState, useEffect, useRef, useCallback } from "react";
import { api, authHeaders, authContextQuery } from "../../lib/api.js";
import { useTheme } from "../../styles/theme.jsx";
import { C } from "../../styles/colorTokens.js";
import { atsBandFor, atsBandLabel } from "../../../../shared/atsBands.js";
import StatCard from "../../components/StatCard.jsx";
import { useConfirm } from "../../panels/adminKit.jsx";
// A50 step 6: the board's bands, not the v3-era 70/50 ramp (under v4 that ramp painted almost every
// score red). Admin still sees the number beside the band — it is a diagnostic tool.
const BAND_COLOR = { strong: C.SUCCESS, moderate: C.WARNING, weak: C.DANGER };
const bandColor = (score) => BAND_COLOR[atsBandFor(score ?? null)] || C.INK_FAINT;

const ACCENT = C.ACCENT;
// ACCENT is the orange, which is 2.96:1 on the paper: a FILL only. Text, edges and strokes use the
// darker ink twin (4.5:1+), the rule UI step 2 set for the logo orange.
const ACCENT_TEXT = C.ACCENT_INK;
// Row-striping tint. Must be a literal color, not `theme.surface + "80"`: theme.surface is the
// STRING "var(--bg-card)", so appending a hex alpha yields "var(--bg-card)80" — invalid CSS that
// browsers drop, meaning the stripe silently never rendered. (I reintroduced that same bug in the
// pipeline-health table by copying the surrounding idiom before spotting it.)
// D91 P6: the raised-panel tone — every text tone is proved on it in every theme (CONTRAST_PAIRS). HOVER was an
// ink / white wash with no declared text pair, and in Contrast Dark it pulled faint and red text below 7:1.
const ROW_STRIPE = C.SURFACE_2;
const TABS = [
  { id: "scrape",   label: "Pipeline Health" },
  { id: "schema",   label: "Schema Explorer" },
  { id: "pool",     label: "User Pool" },
  { id: "review",   label: "Job Review" },
  { id: "trace",    label: "Job Trace" },
  { id: "simulate", label: "Query Simulator" },
];

// ── Shared helpers ────────────────────────────────────────────
function ago(ts) {
  if (!ts) return "—";
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}
function fmt(n) { return n == null ? "—" : Number(n).toLocaleString(); }
function truncate(s, n=40) { if (!s) return "—"; return s.length > n ? s.slice(0,n)+"…" : s; }

// D91 P6: a status colour sits on ITS OWN declared quiet fill (each pair is in CONTRAST_PAIRS and proved in
// every theme). A 13% tint of itself was an undeclared pair — NOT CONFIGURED read 4.42:1 in the matrix's scan.
const PILL_QUIET = new Map([[C.SUCCESS, C.SUCCESS_QUIET], [C.WARNING, C.WARNING_QUIET], [C.DANGER, C.DANGER_QUIET],
  [C.INFO, C.INFO_QUIET], [C.VIOLET, C.VIOLET_QUIET], [C.ACCENT_INK, C.ACCENT_QUIET],
  [C.BAND_STRONG, C.BAND_STRONG_QUIET], [C.BAND_MODERATE, C.BAND_MODERATE_QUIET], [C.BAND_WEAK, C.BAND_WEAK_QUIET]]);
function Pill({ color, children }) {
  return (
    <span style={{
      display:"inline-block", padding:"2px 8px", borderRadius:6,
      // A colour with no quiet fill (INK_FAINT — "NOT ENABLED") takes no tint: it sits on the panel, its proven ground.
      fontSize:10, fontWeight:700, background:PILL_QUIET.get(color) ?? "transparent", color,
      border:`1px solid ${color}44`, letterSpacing:"0.05em",
      // nowrap because a wrapped label breaks OUT of the rounded background rather than growing
      // it — two-line "LIVE SEARCH ONLY" and "NOT CONFIGURED" spilled over the pill's own border,
      // which no assertion on the label text can see. Screenshot-only defect.
      whiteSpace:"nowrap",
    }}>{children}</span>
  );
}

// A93: StatCard is components/StatCard.jsx — AdminPanel and the DB inspector drew the same card.

function Spinner({ theme }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:40, gap:12 }}>
      <div style={{
        width:20, height:20,
        border:`2px solid ${theme.border}`,
        borderTop:`2px solid ${ACCENT_TEXT}`,
        borderRadius:"50%", animation:"spin 0.7s linear infinite",
      }}/>
      <span style={{ color:theme.textMuted, fontSize:12 }}>Loading…</span>
    </div>
  );
}

function ErrBox({ msg, theme }) {
  if (!msg) return null;
  return (
    <div style={{ background:C.DANGER_QUIET, border:`1px solid ${C.DANGER}44`, borderRadius:8,
                  padding:"10px 14px", color:C.DANGER, fontSize:12, margin:"8px 0" }}>
      {msg}
    </div>
  );
}

function KeyValueGrid({ data, theme, highlight }) {
  if (!data) return null;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:"2px 8px", fontSize:11 }}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} style={{ display:"contents" }}>
          <div style={{ fontWeight:700, padding:"3px 0",
                        color: highlight?.includes(k) ? ACCENT_TEXT : theme.textMuted }}>{k}</div>
          <div style={{ padding:"3px 0", wordBreak:"break-all",
                        color: highlight?.includes(k) ? ACCENT_TEXT : theme.text }}>
            {v == null ? <span style={{color:theme.textMuted}}>NULL</span>
                       : String(v).length > 200 ? String(v).slice(0,200)+"…" : String(v)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SchemaMapView({ theme }) {
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 20, y: 20 });
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    api("/api/admin/db/schema/graph").then(setGraph).catch(e => setError(e.message));
  }, []);

  if (error) return <ErrBox msg={error} theme={theme}/>;
  if (!graph) return <Spinner theme={theme}/>;

  const nodeW = 220;
  const colGap = 280;
  const rowGap = 210;
  const positions = {};
  graph.tables.forEach((t, i) => {
    positions[t.name] = {
      x: (i % 4) * colGap,
      y: Math.floor(i / 4) * rowGap,
    };
  });

  const related = new Set();
  if (selected) {
    related.add(selected);
    graph.relationships.forEach(r => {
      if (r.fromTable === selected) related.add(r.toTable);
      if (r.toTable === selected) related.add(r.fromTable);
    });
  }

  const onWheel = (e) => {
    e.preventDefault();
    setScale(s => Math.min(1.8, Math.max(0.45, s + (e.deltaY > 0 ? -0.08 : 0.08))));
  };

  return (
    <div
      onWheel={onWheel}
      onMouseDown={e => setDrag({ x:e.clientX, y:e.clientY, ox:offset.x, oy:offset.y })}
      onMouseMove={e => {
        if (!drag) return;
        setOffset({ x: drag.ox + e.clientX - drag.x, y: drag.oy + e.clientY - drag.y });
      }}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
      style={{
        height:"calc(100vh - 290px)", minHeight:460, overflow:"hidden",
        border:`1px solid ${theme.border}`, borderRadius:10, background:theme.surface,
        position:"relative", cursor:drag ? "grabbing" : "grab",
      }}
    >
      <div style={{
        position:"absolute", top:10, right:10, zIndex:3,
        display:"flex", gap:6, alignItems:"center",
      }}>
        <button onClick={() => setScale(s => Math.min(1.8, s + 0.1))}
          style={{ padding:"4px 9px", borderRadius:6, border:`1px solid ${theme.border}`,
                   background:theme.surfaceHigh, color:theme.text, cursor:"pointer" }}>+</button>
        <button onClick={() => setScale(s => Math.max(0.45, s - 0.1))}
          style={{ padding:"4px 9px", borderRadius:6, border:`1px solid ${theme.border}`,
                   background:theme.surfaceHigh, color:theme.text, cursor:"pointer" }}>-</button>
        <button onClick={() => { setScale(1); setOffset({ x:20, y:20 }); }}
          style={{ padding:"4px 9px", borderRadius:6, border:`1px solid ${theme.border}`,
                   background:theme.surfaceHigh, color:theme.text, cursor:"pointer", fontSize:11 }}>Reset</button>
      </div>

      <div style={{
        transform:`translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        transformOrigin:"0 0", position:"absolute", inset:0,
      }}>
        <svg width="1600" height="1600" style={{ position:"absolute", inset:0, overflow:"visible" }}>
          {graph.relationships.map(r => {
            const a = positions[r.fromTable], b = positions[r.toTable];
            if (!a || !b) return null;
            const active = !selected || related.has(r.fromTable) || related.has(r.toTable);
            return (
              <line key={r.id}
                x1={a.x + nodeW} y1={a.y + 48}
                x2={b.x} y2={b.y + 48}
                stroke={active ? ACCENT_TEXT : theme.border}
                strokeWidth={active ? 2 : 1}
                opacity={active ? 0.75 : 0.25}
              />
            );
          })}
        </svg>

        {graph.tables.map(t => {
          const p = positions[t.name];
          const active = !selected || related.has(t.name);
          return (
            <div key={t.name}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setSelected(selected === t.name ? null : t.name)}
              style={{
                position:"absolute", left:p.x, top:p.y, width:nodeW,
                border:`1px solid ${selected === t.name ? ACCENT_TEXT : theme.border}`,
                borderRadius:8, background:theme.bg, opacity:active ? 1 : 0.35,
                boxShadow:selected === t.name ? `0 0 0 2px ${ACCENT_TEXT}33` : "none",
                overflow:"hidden", cursor:"pointer",
              }}
            >
              <div style={{
                padding:"8px 10px", background:theme.surfaceHigh,
                borderBottom:`1px solid ${theme.border}`, fontWeight:900, fontSize:12,
                display:"flex", justifyContent:"space-between", gap:8,
              }}>
                <span>{t.name}</span>
                <span style={{ color:theme.textMuted, fontSize:10 }}>{fmt(t.rowCount)}</span>
              </div>
              <div style={{ maxHeight:145, overflow:"hidden", padding:"5px 0" }}>
                {t.columns.slice(0, 8).map(c => (
                  <div key={c.name} style={{
                    display:"grid", gridTemplateColumns:"16px 1fr auto",
                    gap:5, padding:"2px 10px", fontSize:10,
                  }}>
                    <span style={{ color:c.primaryKey ? ACCENT_TEXT : theme.textMuted }}>{c.primaryKey ? "PK" : ""}</span>
                    <span style={{ color:c.primaryKey ? ACCENT_TEXT : theme.text }}>{c.name}</span>
                    <span style={{ color:theme.textMuted }}>{c.type || ""}</span>
                  </div>
                ))}
                {t.columns.length > 8 && (
                  <div style={{ padding:"3px 10px", color:theme.textMuted, fontSize:10 }}>
                    +{t.columns.length - 8} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 1: Pipeline Health ───────────────────────────────────
// Repurposed from the old Scrape Monitor, which reported the pre-pivot per-user scraping model
// (domain-profile tagging, ATS scores, search queries). Those numbers stayed healthy-looking
// throughout the production outage — the panel showed 684 rows "existing and looking fine"
// while three independent failures ran undetected. This version answers whether the pipeline
// actually WORKED: per-source freshness, unconfigured providers, and enrichment coverage.

// Health severity ordering is decided server-side; this is only the presentation.
const HEALTH_STYLE = {
  ok:              { color:C.SUCCESS, label:"OK" },
  stale:           { color:C.WARNING, label:"STALE" },
  no_results:      { color:C.WARNING, label:"NO RESULTS" },
  no_rows:         { color:C.WARNING, label:"NO ROWS" },
  never_ran:       { color:C.WARNING, label:"NEVER RAN" },
  failed:          { color:C.DANGER, label:"FAILED" },
  // Deliberately red, not grey: an unconfigured provider reading as a benign "off" is exactly
  // how Jobo went unnoticed for its entire lifetime.
  not_configured:  { color:C.DANGER, label:"NOT CONFIGURED" },
  // A run that reported success and put NOTHING on the board. Red, and ABOVE stale in the route's
  // ordering, because production logged three consecutive days of `status: 'ok'` with `written: 0`.
  // ⛔ Not the same as `written: 0` — a crawl that finds every posting unchanged writes 0 rows and
  // is healthy. That conflation raised two false criticals; the route classifies on
  // written + unchanged + merged now.
  wrote_nothing:   { color:C.DANGER, label:"WROTE NOTHING" },
  // Fetched rows, boarded none, and the classifier refused all of them. Amber, not red: the fetch
  // works and the judgement to make is about the source's yield, not an outage.
  all_rejected:    { color:C.WARNING, label:"ALL REJECTED" },
  // An ACTIVE company slug at zero rows — a dead slug, or postings dropped before the write.
  no_rows_company: { color:C.DANGER, label:"NO ROWS" },
  // Rows exist but none has a description, so enrichJob skips every one of them forever.
  no_descriptions: { color:C.DANGER, label:"NO DESCRIPTIONS" },
  // The one genuinely benign state, and the only grey one. adzuna and serpapi are configured,
  // correct, and outside the crawl — reading them as NEVER RAN put two warnings on the panel that
  // could never be cleared, and a permanent warning is one nobody reads.
  live_search_only:{ color:C.INK_FAINT, label:"LIVE SEARCH ONLY" },
  // Also benign, and also grey. A company seeded after its source's last successful crawl has not
  // had a chance to produce yet; migration 103 added ten at once, and calling those ten failures
  // would have put ten false positives at the top of the alert list on the day it shipped.
  awaiting_first_crawl:{ color:C.INK_FAINT, label:"AWAITING CRAWL" },
  // A44: the slug answers and every posting is held out by the US-only gate. Amber: a decision
  // about the company (keep it for when it hires here, or deactivate), not an outage.
  out_of_market:   { color:C.WARNING, label:"OUTSIDE US" },
  // A44: keyed, in the crawl, no active companies — never enabled (workday, smartrecruiters).
  not_enabled:     { color:C.INK_FAINT, label:"NOT ENABLED" },
  // A44: paused by the owner on purpose (PIPELINE_PAUSED_SOURCES — jobo, wallet exhausted).
  paused:          { color:C.INK_FAINT, label:"PAUSED" },
};

function ScrapeMonitorTab({ theme }) {
  const [health, setHealth] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [filterSource, setFilterSource] = useState("");
  const [copied, setCopied] = useState(null); // 'text' | null

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (filterSource) params.set("source", filterSource);
      const [h, d] = await Promise.all([
        api(`/api/admin/db/pipeline-health`),
        api(`/api/admin/db/scrape-monitor?${params}`),
      ]);
      setHealth(h); setData(d);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filterSource]);

  useEffect(() => { load(); }, [load]);

  const statusLabel = (job) => {
    // The single most important per-row fact post-pivot: a row with no description can never be
    // enriched, so it will never gain skills, summary, salary or visa signals.
    // 10-02 (18): the list carries inactive rows too, and labelled them by enrichment alone — a
    // capture held outside the US read "UNENRICHED", as if it were waiting to be enriched. An
    // inactive row is off the board first; that is what it needs to say.
    if (job.is_active === 0) return job.held_outside_us
      ? { label:"OUTSIDE US", color:C.WARNING } : { label:"INACTIVE", color:C.TEXT_MUTED };
    if (!job.has_description) return { label:"NO DESC", color:C.DANGER };
    if (!job.enriched_at)     return { label:"UNENRICHED", color:C.WARNING };
    return { label:"ENRICHED", color:C.SUCCESS };
  };

  // `live_search_only` is a healthy resting state, not a problem: adzuna and serpapi are
  // configured and correct and the crawl never calls them. Counting them here put two permanent
  // entries in "Sources Healthy" that could never be cleared, which is how a warning stops being
  // read at all.
  const problemSources = (health?.sources || [])
    .filter(s => s.health !== "ok" && s.health !== "live_search_only");
  const worstCoverage  = (health?.enrichment?.coverage || []).filter(c => c.pct === 0).length;
  const alerts         = health?.alerts || [];
  const deadCompanies  = (health?.companies || [])
    .filter(c => c.health !== "ok" && c.health !== "awaiting_first_crawl");

  return (
    <div>
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ fontWeight:800, fontSize:14 }}>Pipeline Health</span>
        <div style={{ flex:1 }}/>
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          style={{ background:theme.surfaceHigh, border:`1px solid ${theme.border}`,
                   borderRadius:6, padding:"5px 10px", color:theme.text, fontSize:11 }}
        >
          <option value="">All sources</option>
          {(data?.sources || []).map(s => (
            <option key={s.source} value={s.source}>{s.source} ({s.n})</option>
          ))}
        </select>
        <button onClick={load}
          style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                   padding:"5px 14px", fontWeight:700, fontSize:11, cursor:"pointer" }}>
          Refresh
        </button>
      </div>

      {/*
        ALERTS, ABOVE EVERYTHING. AC item 2: a configured source producing zero rows is "an ALERT
        — not a quiet entry in a log nobody reads." Every one of this project's three silent
        failures was already visible in a panel below this point; what was missing was anything
        that made you look. So the findings come first, ranked, before the stat cards.

        The healthy state renders too, deliberately. A panel that shows nothing when all is well
        is indistinguishable from one that computed nothing — which is the state this whole route
        was built to stop being possible.
      */}
      {health && (
        alerts.length > 0 ? (
          <div style={{ border:`1px solid ${C.DANGER}`, borderRadius:10, overflow:"hidden", marginBottom:16 }}>
            <div style={{ padding:"8px 14px", background:C.DANGER_QUIET, fontSize:11,
                          fontWeight:800, color:C.DANGER, textTransform:"uppercase",
                          letterSpacing:0.4 }}>
              {health.alertCounts.critical} critical
              {health.alertCounts.warn > 0 && ` · ${health.alertCounts.warn} warning`}
            </div>
            {alerts.map((a, i) => (
              <div key={`${a.kind}-${a.subject}-${i}`} style={{
                display:"grid", gridTemplateColumns:"84px 190px 1fr", gap:10,
                padding:"8px 14px", fontSize:11, alignItems:"baseline",
                // D91 P6: no stripe — a HOVER wash over the alert box lifted the red "critical" to 5.02:1 in
                // Contrast Dark (an undeclared pair). The row's own top rule separates the rows.
                background: "transparent",
                borderTop:`1px solid ${theme.border}`,
              }}>
                <span style={{ fontWeight:800, fontSize:9, letterSpacing:0.5,
                               textTransform:"uppercase",
                               color: a.severity === "critical" ? C.DANGER : C.WARNING }}>
                  {a.severity}
                </span>
                <span style={{ fontFamily:"monospace", color:theme.text }}>
                  <span style={{ color:theme.textMuted }}>{a.kind}</span> {a.subject}
                </span>
                <span style={{ color:theme.textMuted }}>{a.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border:`1px solid ${C.SUCCESS}`, borderRadius:10, marginBottom:16,
                        padding:"8px 14px", fontSize:11, fontWeight:700, color:C.SUCCESS }}>
            No alerts — every configured source wrote rows, every active company produced them,
            and no enrichment column is empty.
          </div>
        )
      )}

      {health && (
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <StatCard label="Active Rows" value={fmt(health.enrichment.activeTotal)} theme={theme}/>
          <StatCard
            label="Sources Healthy"
            value={`${health.sources.length - problemSources.length}/${health.sources.length}`}
            accent={problemSources.length ? C.WARNING : C.SUCCESS}
            sub={problemSources.length ? problemSources.map(s => s.name).join(", ") : "all reporting"}
            theme={theme}/>
          <StatCard
            label="Missing Description"
            value={fmt(health.enrichment.noDescription)}
            accent={health.enrichment.noDescription > 0 ? C.DANGER : C.SUCCESS}
            sub={health.enrichment.activeTotal
              ? `${Math.round((health.enrichment.noDescription / health.enrichment.activeTotal) * 100)}% can never enrich`
              : null}
            theme={theme}/>
          <StatCard
            label="Empty Signals"
            value={`${worstCoverage}/${health.enrichment.coverage.length}`}
            accent={worstCoverage ? C.DANGER : C.SUCCESS}
            sub="enrichment columns at 0%"
            theme={theme}/>
          <StatCard label="Deduped" value={fmt(health.dedup.multiSource)} sub="rows folded from 2+ sources" theme={theme}/>
        </div>
      )}

      {/* Per-source truth: last success, staleness, and whether it wrote anything. */}
      {health?.sources?.length > 0 && (
        <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden", marginBottom:16 }}>
          <div style={{
            display:"grid", gridTemplateColumns:"1.1fr 148px 70px 70px 80px 1fr 100px",
            padding:"8px 14px", background:theme.surfaceHigh,
            fontSize:10, fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.06em", color:theme.textMuted,
          }}>
            <div>Source</div><div>Health</div><div>Active</div><div>No Desc</div>
            <div>Last OK</div><div>Last Run</div><div>Companies</div>
          </div>
          {health.sources.map((s, i) => {
            const hs = HEALTH_STYLE[s.health] || { color:theme.textMuted, label:s.health };
            return (
              <div key={s.name} style={{
                display:"grid", gridTemplateColumns:"1.1fr 148px 70px 70px 80px 1fr 100px",
                padding:"9px 14px", fontSize:12, alignItems:"center",
                borderTop:`1px solid ${theme.border}`,
                background: i%2===0 ? "transparent" : ROW_STRIPE,
              }}>
                <div style={{ fontWeight:600 }}>{s.name}</div>
                <div><Pill color={hs.color}>{hs.label}</Pill></div>
                <div style={{ color:theme.textMuted }}>{fmt(s.active)}</div>
                <div style={{ color: s.noDescription > 0 ? C.DANGER : theme.textMuted }}>
                  {s.active ? fmt(s.noDescription) : "—"}
                </div>
                <div style={{ color: s.health === "stale" ? C.WARNING : theme.textMuted, fontSize:11 }}>
                  {ago(s.lastSuccessAt || s.lastActivityAt)}
                </div>
                <div style={{ color:theme.textMuted, fontSize:11 }}>
                  {s.lastRun
                    ? <span>{s.lastRun.status} · {fmt(s.lastRun.written)} written
                        {/* "ok · 0 written" is what this cell said about two working sources, and
                            it is the whole reason they were classified as outages. A crawl that
                            finds its postings unchanged writes nothing and touches them instead,
                            so the touch count belongs next to the write count, not behind it. */}
                        {s.lastRun.unchanged > 0 && <> · {fmt(s.lastRun.unchanged)} unchanged</>}
                        {(s.lastRun.dropped + s.lastRun.ejected) > 0 &&
                          <> · {fmt(s.lastRun.dropped + s.lastRun.ejected)} refused</>}
                        {s.lastRun.error && <span style={{ color:C.DANGER }}> · {truncate(s.lastRun.error, 60)}</span>}
                      </span>
                    : <span style={{ color:theme.textDim, fontStyle:"italic" }}>no run recorded yet</span>}
                </div>
                <div style={{ color:theme.textMuted, fontSize:11 }}>{s.companies != null ? fmt(s.companies) : "—"}</div>
              </div>
            );
          })}
        </div>
      )}

      {/*
        PER-COMPANY-SLUG — the grain the source table cannot express, and the one that matters.
        greenhouse reported OK with 621 active rows while SIX of its nine active slugs contributed
        zero, because all seven plugins capped the CONCATENATION of their per-company fetches at
        900 postings and severed everything past the cut. lever's three dead slugs only surfaced
        because ALL of them died at once; one of three dying is invisible one row up.

        Unhealthy first, then the rest, because the list is 23 rows and the interesting ones must
        not need scrolling to find.
      */}
      {health?.companies?.length > 0 && (
        <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden", marginBottom:16 }}>
          <div style={{
            display:"grid", gridTemplateColumns:"1.1fr 1fr 130px 70px 70px 80px 90px",
            padding:"8px 14px", background:theme.surfaceHigh,
            fontSize:10, fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.06em", color:theme.textMuted,
          }}>
            <div>Company</div><div>Source / Slug</div><div>Health</div><div>Active</div>
            <div>No Desc</div><div>Enriched</div><div title="When a crawl last returned this company — not when it last posted">Last Seen</div>
          </div>
          {[...deadCompanies,
            ...health.companies.filter(c => c.health === "ok" || c.health === "awaiting_first_crawl"),
          ].map((c, i) => {
            const key = c.health === "no_rows" ? "no_rows_company" : c.health;
            const hs = HEALTH_STYLE[key] || { color:theme.textMuted, label:c.health };
            return (
              <div key={`${c.source}/${c.slug}`} style={{
                display:"grid", gridTemplateColumns:"1.1fr 1fr 130px 70px 70px 80px 90px",
                padding:"9px 14px", fontSize:12, alignItems:"center",
                borderTop:`1px solid ${theme.border}`,
                background: i%2===0 ? "transparent" : ROW_STRIPE,
              }}>
                <div style={{ fontWeight:600 }}>{c.company}</div>
                <div style={{ fontFamily:"monospace", fontSize:11, color:theme.textMuted }}>
                  {c.source}/{c.slug}
                </div>
                <div><Pill color={hs.color}>{hs.label}</Pill></div>
                <div style={{ color: c.active === 0 ? C.DANGER : theme.textMuted }}>{fmt(c.active)}</div>
                <div style={{ color: c.noDescription > 0 ? C.DANGER : theme.textMuted }}>
                  {c.active ? fmt(c.noDescription) : "—"}
                </div>
                <div style={{ color:theme.textMuted }}>{c.active ? fmt(c.enriched) : "—"}</div>
                <div style={{ color: c.health === "stale" ? C.WARNING : theme.textMuted, fontSize:11 }}
                     title={c.quietHours != null ? `Newest posting first seen ${ago(c.lastRowAt)}` : undefined}>
                  {ago(c.lastSeenAt ?? c.lastRowAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enrichment coverage — the panel that would have made the outage obvious. */}
      {health?.enrichment?.coverage?.length > 0 && (
        <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em",
                        color:theme.textMuted, marginBottom:12 }}>
            Enrichment — {fmt(health.enrichment.activeTotal)} active rows
          </div>
          {/* A48: unenriched rows are the ones that score "not enough signal" (~30% of them; enriched
              rows 0%), so skills_json's share below sets how much of the board can get a band. */}
          <div style={{ fontSize:11, color:theme.textMuted, marginBottom:10 }}>
            skills_json is enrichment's read of the posting — rows without it are the ones that score
            “not enough signal”. {fmt(health.enrichment.waitingForEnrichment ?? 0)} active rows wait;
            last enriched {ago(health.enrichment.lastEnrichedAt)}.
          </div>
          {/* D83 audit #20: the per-column coverage bars are Admin → The board → Enrichment's — the third copy is gone. */}
          <a href="/admin?g=board&s=enrichment" style={{ fontSize:12, color:theme.text }}>Coverage per column → Admin → The board → Enrichment</a>
          {health.enrichment.recentRuns.length > 0 && (
            <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${theme.border}`, fontSize:11, color:theme.textMuted }}>
              <span style={{ fontWeight:700 }}>Last enrichment run: </span>
              {(() => {
                const r = health.enrichment.recentRuns[0];
                // `health` is derived from `written`, not from `status`, and BOTH are shown. The
                // recorded status is evidence and must not be hidden — it is what read 'ok' for
                // three consecutive days while every one of 25 rows failed.
                const rs = HEALTH_STYLE[r.health]?.color
                  ?? (r.health === "failed" ? C.DANGER : r.health === "degraded" ? C.WARNING : C.SUCCESS);
                return (
                  <span>
                    {ago(r.started_at)} ·{" "}
                    <span style={{ color:rs, fontWeight:700 }}>{String(r.health).toUpperCase()}</span>
                    {r.health === "failed" && r.status === "ok" &&
                      <span style={{ color:C.DANGER }}> (recorded as “{r.status}”)</span>}
                    {" "}· {fmt(r.written)} enriched, {fmt(r.failed)} failed,
                    {" "}{fmt(r.details?.noSignal ?? 0)} no-signal, {fmt(r.skipped)} skipped (no description)
                    {r.details?.remainingCandidates ? ` · ${fmt(r.details.remainingCandidates)} still queued` : ""}
                    {r.error_text && <span style={{ color:C.DANGER }}> · {truncate(r.error_text, 80)}</span>}
                  </span>
                );
              })()}
            </div>
          )}
          {!health.hasRunLog && (
            <div style={{ marginTop:12, fontSize:11, color:C.WARNING }}>
              pipeline_runs table not present — run migrations to record per-run outcomes.
            </div>
          )}
        </div>
      )}

      {loading && <Spinner theme={theme}/>}
      <ErrBox msg={error} theme={theme}/>

      {data?.jobs?.length > 0 && (
        <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden" }}>
          {/* Header */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"2fr 1.5fr 1fr 70px 70px 60px 90px",
            padding:"8px 14px", background:theme.surfaceHigh,
            fontSize:10, fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.06em", color:theme.textMuted,
          }}>
            <div>Title</div><div>Company</div><div>Source</div>
            <div>Desc</div><div>Skills</div><div>Age</div><div>Status</div>
          </div>

          {data.jobs.map((job, i) => {
            const st = statusLabel(job);
            const isExp = expanded === job.job_id;
            return (
              <div key={job.job_id}>
                <div
                  onClick={() => setExpanded(isExp ? null : job.job_id)}
                  style={{
                    display:"grid",
                    gridTemplateColumns:"2fr 1.5fr 1fr 70px 70px 60px 90px",
                    padding:"9px 14px", cursor:"pointer",
                    background: isExp ? theme.surfaceHigh : i%2===0 ? "transparent" : ROW_STRIPE,
                    borderTop:`1px solid ${theme.border}`,
                    transition:"background 0.1s",
                    fontSize:12,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.surfaceHigh}
                  onMouseLeave={e => e.currentTarget.style.background = isExp ? theme.surfaceHigh : i%2===0 ? "transparent" : ROW_STRIPE}
                >
                  <div style={{ fontWeight:600 }}>{truncate(job.title, 35)}</div>
                  <div style={{ color:theme.textMuted }}>{truncate(job.company, 25)}</div>
                  <div style={{ color:theme.textMuted, fontSize:11 }}>{job.source || "—"}</div>
                  {/* Description length, not a boolean: a 40-char "description" is technically
                      present but useless to enrichment, and only the number shows that. */}
                  <div style={{ color: job.has_description ? theme.textMuted : C.DANGER, fontSize:11 }}>
                    {job.has_description ? fmt(job.description_len) : "none"}
                  </div>
                  <div style={{ color: job.skills_json ? theme.textMuted : theme.textDim, fontSize:11 }}>
                    {job.skills_json ? (() => { try { return JSON.parse(job.skills_json).length; } catch { return "?"; } })() : "—"}
                  </div>
                  <div style={{ color:theme.textMuted, fontSize:11 }}>{ago(job.discovered_at || job.scraped_at)}</div>
                  <div><Pill color={st.color}>{st.label}</Pill></div>
                </div>

                {isExp && (
                  <div style={{ padding:"16px 20px", background:theme.surfaceHigh,
                                borderTop:`1px solid ${theme.border}` }}>
                    <KeyValueGrid
                      data={(() => {
                        const { description, description_truncated, ...rest } = job;
                        return rest;
                      })()}
                      theme={theme}
                      highlight={["source","has_description","description_len","enriched_at","content_hash"]}
                    />

                    {/* Description section */}
                    <div style={{
                      marginTop:16,
                      borderTop:`1px solid ${theme.border}`,
                      paddingTop:12,
                    }}>
                      <div style={{
                        display:"flex", justifyContent:"space-between",
                        alignItems:"center", marginBottom:8,
                      }}>
                        <span style={{
                          fontSize:11, fontWeight:600, textTransform:"uppercase",
                          letterSpacing:"0.08em", color:theme.textMuted,
                        }}>
                          Job Description
                        </span>
                        <div style={{ display:"flex", gap:8 }}>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(job.description || "");
                              setCopied("text");
                              setTimeout(() => setCopied(null), 2000);
                            }}
                            style={{
                              fontSize:11, padding:"3px 10px", borderRadius:6,
                              border:`1px solid ${theme.border}`,
                              background: copied === "text" ? C.SUCCESS_QUIET : theme.surface,
                              color: copied === "text" ? C.SUCCESS : theme.textMuted,
                              cursor:"pointer",
                            }}>
                            {copied === "text" ? "✓ Copied" : "Copy Text"}
                          </button>
                        </div>
                      </div>

                      <div style={{
                        maxHeight:200, overflowY:"auto",
                        fontSize:12, lineHeight:1.6, color:theme.textMuted,
                        background:theme.bg, borderRadius:8,
                        padding:"10px 12px", whiteSpace:"pre-wrap",
                        fontFamily:"monospace",
                        border:`1px solid ${theme.border}`,
                      }}>
                        {job.description
                          ? job.description
                          : <span style={{ color:theme.textDim, fontStyle:"italic" }}>
                              No description available
                            </span>
                        }
                      </div>

                      {job.description_truncated && (
                        <div style={{ fontSize:11, color:C.WARNING, marginTop:4 }}>
                          Description truncated at 10,000 chars. Copy button copies full text.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data?.jobs?.length === 0 && !loading && (
        <div style={{ textAlign:"center", color:theme.textMuted, padding:40 }}>No scraped jobs found.</div>
      )}
    </div>
  );
}

// D83 audit #21 (39d): the enrichment round trip that lived here (EnrichmentTransferPanel, its armed switches and its
// plan / result views) is RETIRED — Admin → The board → Enrichment does the same import, dry run first, with Undo.

function SchemaExplorerTab({ theme }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [recentRows, setRecentRows] = useState(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const [schemaView, setSchemaView] = useState("tables");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api("/api/admin/db/schema")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectTable = async (t) => {
    setSelected(t); setRecentRows(null); setRecentLoading(true);
    try {
      const rows = await api(`/api/admin/db/table-rows/${t.name}`);
      setRecentRows(rows);
    } catch {}
    setRecentLoading(false);
  };

  if (loading) return <Spinner theme={theme}/>;
  if (error) return <ErrBox msg={error} theme={theme}/>;
  if (!data) return null;

  const fmtBytes = (b) => {
    if (b > 1e6) return (b/1e6).toFixed(1)+" MB";
    if (b > 1e3) return (b/1e3).toFixed(1)+" KB";
    return b+" B";
  };

  const fkCols = new Set((selected?.foreignKeys || []).map(fk => fk.from));

  const fetchSchemaExport = async () => {
    const res = await fetch("/api/admin/db/schema/export", { credentials:"include", headers:authHeaders() });
    return res.json();
  };

  return (
    <div>
    {/* Controls bar. flexWrap so the import panel can take a full row of its own below the
        buttons (it sets flexBasis:100% / order:99) instead of squeezing them. */}
    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
      {["tables","map"].map(v => (
        <button key={v} type="button" onClick={() => setSchemaView(v)}
          style={{
            padding:"6px 14px", borderRadius:8,
            border:`1px solid ${schemaView === v ? ACCENT_TEXT : theme.border}`,
            background:schemaView === v ? ACCENT : theme.surfaceHigh,
            color:schemaView === v ? C.ON_ACCENT : theme.text,
            cursor:"pointer", fontSize:12, fontWeight:700,
          }}>
          {v === "tables" ? "Tables" : "Map View"}
        </button>
      ))}
      <button
        type="button"
        onClick={async () => {
          try {
            const d = await fetchSchemaExport();
            await navigator.clipboard.writeText(d.schema);
            setSchemaCopied(true);
            setTimeout(() => setSchemaCopied(false), 3000);
          } catch(e) { console.error("Schema copy failed:", e); }
        }}
        style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"6px 14px", borderRadius:8,
          border:`1px solid ${schemaCopied ? `${C.SUCCESS}66` : theme.border}`,
          background: schemaCopied ? C.SUCCESS_QUIET : theme.surfaceHigh,
          color: schemaCopied ? C.SUCCESS : theme.text,
          cursor:"pointer", fontSize:12, fontWeight:600, transition:"all 0.2s",
        }}>
        {schemaCopied ? "✓ Schema Copied!" : "📋 Copy Full Schema"}
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            const d = await fetchSchemaExport();
            const blob = new Blob([d.schema], { type:"text/plain" });
            const url = URL.createObjectURL(blob);
            Object.assign(document.createElement("a"), {
              href: url,
              download: `resume_master_schema_${new Date().toISOString().slice(0,10)}.sql`,
            }).click();
            URL.revokeObjectURL(url);
          } catch(e) { console.error("Schema download failed:", e); }
        }}
        style={{
          padding:"6px 14px", borderRadius:8,
          border:`1px solid ${theme.border}`,
          background:theme.surfaceHigh, color:theme.text,
          cursor:"pointer", fontSize:12,
        }}>
        ⬇ Download .sql
      </button>
      {/* D83 audit #21: importing enrichment lives in ONE place — Admin → The board → Enrichment (the six steps, Undo on
          every batch). The round trip that used to sit here is retired. */}
      <a href="/admin?g=board&s=enrichment" data-enrichment-moved=""
        style={{ fontSize:12, color:theme.text, alignSelf:"center" }}>Import enrichment → Admin → The board → Enrichment</a>
    </div>
    {schemaView === "map" ? <SchemaMapView theme={theme}/> : (
    <div style={{ display:"flex", gap:0, height:"calc(100vh - 260px)", minHeight:400 }}>
      {/* Left sidebar */}
      <div style={{
        width:220, flexShrink:0, borderRight:`1px solid ${theme.border}`,
        overflowY:"auto", paddingRight:0,
      }}>
        <div style={{ padding:"10px 14px", fontSize:10, fontWeight:700, textTransform:"uppercase",
                      letterSpacing:"0.07em", color:theme.textMuted }}>
          Tables ({data.tables.length})
        </div>
        {data.tables.map(t => (
          <div key={t.name}
            onClick={() => selectTable(t)}
            style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"8px 14px", cursor:"pointer",
              background: selected?.name === t.name ? ACCENT+"22" : "transparent",
              borderLeft: selected?.name === t.name ? `3px solid ${ACCENT_TEXT}` : "3px solid transparent",
              fontSize:12, transition:"all 0.1s",
            }}
            onMouseEnter={e => { if (selected?.name !== t.name) e.currentTarget.style.background = theme.surfaceHigh; }}
            onMouseLeave={e => { if (selected?.name !== t.name) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontWeight:selected?.name===t.name ? 700 : 400, color:theme.text }}>{t.name}</span>
            <span style={{ fontSize:10, color:theme.textMuted, fontWeight:600 }}>{fmt(t.rowCount)}</span>
          </div>
        ))}
        <div style={{ padding:"10px 14px", marginTop:8, borderTop:`1px solid ${theme.border}` }}>
          <div style={{ fontSize:10, color:theme.textMuted, fontWeight:700, textTransform:"uppercase",
                        letterSpacing:"0.07em", marginBottom:4 }}>DB Info</div>
          <div style={{ fontSize:11, color:theme.textMuted }}>
            Size: {fmtBytes(data.dbSizeBytes)}<br/>
            WAL: {data.walMode ? "✓ enabled" : "✗ off"}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, overflowY:"auto", padding:"0 0 0 20px" }}>
        {!selected ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                        height:"100%", color:theme.textMuted, fontSize:13 }}>
            Select a table to inspect
          </div>
        ) : (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <span style={{ fontSize:16, fontWeight:900 }}>{selected.name}</span>
              <span style={{ fontSize:11, color:theme.textMuted }}>{fmt(selected.rowCount)} rows</span>
              <div style={{ flex:1 }}/>
              {/* A plain <a> navigation cannot carry the X-RM-Auth-Context header, so it would be
                  authenticated by the shared cookie alone — the wrong identity in a browser with a
                  second account signed in, and a 403 download in an admin tab whose cookie belongs
                  to a non-admin. The token goes in the query string, which bindAuthContext accepts
                  for exactly this case. */}
              <a href={`/api/admin/db/export/${selected.name}${authContextQuery() ? `?${authContextQuery()}` : ""}`}
                style={{ fontSize:11, color:ACCENT_TEXT, textDecoration:"none", fontWeight:700 }}>
                Export CSV ↓
              </a>
            </div>

            {/* Columns */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:"0.07em", color:theme.textMuted, marginBottom:8 }}>Columns</div>
              <div style={{ border:`1px solid ${theme.border}`, borderRadius:8, overflow:"hidden" }}>
                <div style={{
                  display:"grid", gridTemplateColumns:"30px 1.5fr 1fr 60px 80px 50px",
                  padding:"6px 12px", background:theme.surfaceHigh,
                  fontSize:10, fontWeight:700, textTransform:"uppercase",
                  letterSpacing:"0.06em", color:theme.textMuted,
                }}>
                  <div>#</div><div>Name</div><div>Type</div>
                  <div>Not Null</div><div>Default</div><div>PK</div>
                </div>
                {selected.columns.map(col => (
                  <div key={col.cid} style={{
                    display:"grid", gridTemplateColumns:"30px 1.5fr 1fr 60px 80px 50px",
                    padding:"6px 12px", borderTop:`1px solid ${theme.border}`, fontSize:11,
                    background: fkCols.has(col.name) ? ACCENT+"11" : "transparent",
                  }}>
                    <div style={{ color:theme.textMuted }}>{col.cid}</div>
                    <div style={{ fontWeight:600, color: col.pk ? ACCENT_TEXT : fkCols.has(col.name) ? C.VIOLET : theme.text }}>
                      {col.name} {col.pk ? "🔑" : ""} {fkCols.has(col.name) ? "🔗" : ""}
                    </div>
                    <div style={{ color:theme.textMuted }}>{col.type || "—"}</div>
                    <div style={{ color: col.notnull ? C.SUCCESS : theme.textMuted }}>{col.notnull ? "✓" : "—"}</div>
                    <div style={{ color:theme.textMuted, fontSize:10 }}>{col.dflt_value ?? "—"}</div>
                    <div style={{ color: col.pk ? ACCENT_TEXT : theme.textMuted }}>{col.pk || "—"}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indexes */}
            {selected.indexes.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                              letterSpacing:"0.07em", color:theme.textMuted, marginBottom:8 }}>
                  Indexes ({selected.indexes.length})
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {selected.indexes.map(idx => (
                    <div key={idx.name} style={{
                      display:"flex", gap:10, alignItems:"center", fontSize:11,
                      padding:"5px 10px", background:theme.surfaceHigh, borderRadius:6,
                    }}>
                      {idx.unique && <span style={{ color:ACCENT_TEXT, fontWeight:700 }}>⚡</span>}
                      <span style={{ fontWeight:600 }}>{idx.name}</span>
                      <span style={{ color:theme.textMuted }}>→ ({idx.columns.join(", ")})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Foreign Keys */}
            {selected.foreignKeys.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                              letterSpacing:"0.07em", color:theme.textMuted, marginBottom:8 }}>
                  Foreign Keys
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {selected.foreignKeys.map((fk, i) => (
                    <div key={i} style={{ fontSize:11, padding:"5px 10px",
                                          background:theme.surfaceHigh, borderRadius:6 }}>
                      <span style={{ color:C.VIOLET, fontWeight:600 }}>{fk.from}</span>
                      {" → "}
                      <span style={{ fontWeight:600 }}>{fk.table}.{fk.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Rows */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:"0.07em", color:theme.textMuted, marginBottom:8 }}>
                Recent Rows (last 10)
              </div>
              {recentLoading && <Spinner theme={theme}/>}
              {recentRows?.length > 0 && (() => {
                const cols = Object.keys(recentRows[0]);
                return (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                      <thead>
                        <tr style={{ background:theme.surfaceHigh }}>
                          {cols.map(c => (
                            <th key={c} style={{ padding:"5px 8px", textAlign:"left",
                                                  color:theme.textMuted, fontWeight:700,
                                                  borderBottom:`1px solid ${theme.border}`,
                                                  whiteSpace:"nowrap" }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom:`1px solid ${theme.border}` }}>
                            {cols.map(c => (
                              <td key={c} style={{ padding:"4px 8px", color:theme.text, fontSize:10,
                                                    maxWidth:200, overflow:"hidden", textOverflow:"ellipsis",
                                                    whiteSpace:"nowrap" }}>
                                {row[c] == null ? <span style={{color:theme.textMuted}}>NULL</span>
                                               : truncate(String(row[c]), 60)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Migration History */}
            {data.migrations.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                              letterSpacing:"0.07em", color:theme.textMuted, marginBottom:8 }}>
                  Migration History
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  {data.migrations.map(m => (
                    <div key={m.id} style={{ display:"flex", gap:12, fontSize:11,
                                             padding:"4px 10px", background:theme.surfaceHigh, borderRadius:5 }}>
                      <span style={{ color:C.SUCCESS, fontWeight:700 }}>✓</span>
                      <span style={{ fontWeight:600 }}>{m.id}</span>
                      <span style={{ color:theme.textMuted }}>{m.applied_at ? new Date(m.applied_at*1000).toISOString().slice(0,19).replace("T"," ") : "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    )}
    </div>
  );
}

// ── Tab 3: User Pool Inspector ───────────────────────────────
function UserPoolTab({ theme }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [poolFilter, setPoolFilter] = useState("All");

  useEffect(() => {
    api("/api/admin/users").then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const loadPool = useCallback(async (userId) => {
    if (!userId) return;
    setLoading(true); setError(null); setData(null);
    try { setData(await api(`/api/admin/db/user-pool/${userId}`)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const filteredJobs = data?.sampleJobs?.filter(j => {
    if (poolFilter === "All") return true;
    if (poolFilter === "Correct") return j.status === "CORRECT";
    if (poolFilter === "Wrong") return j.status !== "CORRECT" && j.status !== "NULL_TAG";
    if (poolFilter === "NULL") return j.status === "NULL_TAG";
    return true;
  }) || [];

  const totalJobs = data?.sampleJobs?.length || 0;
  const correctJobs = data?.sampleJobs?.filter(j => j.status === "CORRECT").length || 0;
  const wrongJobs = data?.sampleJobs?.filter(j => j.status !== "CORRECT").length || 0;

  return (
    <div>
      {/* User selector */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:20 }}>
        <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); loadPool(e.target.value); }}
          style={{ background:theme.surfaceHigh, border:`1px solid ${theme.border}`,
                   borderRadius:6, padding:"6px 12px", color:theme.text, fontSize:12, minWidth:240 }}>
          <option value="">Select a user…</option>
          {users.filter(u => !u.is_admin).map(u => (
            <option key={u.id} value={u.id}>{u.username} (id:{u.id})</option>
          ))}
        </select>
        <button onClick={() => loadPool(selectedUser)} disabled={!selectedUser || loading}
          style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                   padding:"6px 16px", fontWeight:700, fontSize:11, cursor:"pointer", opacity:!selectedUser?0.5:1 }}>
          Load
        </button>
      </div>

      {loading && <Spinner theme={theme}/>}
      <ErrBox msg={error} theme={theme}/>

      {data && (
        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:20 }}>
          {/* Left: Profile Summary */}
          <div>
            {data.activeProfile ? (
              <div style={{ border:`1px solid ${ACCENT_TEXT}44`, borderRadius:10, padding:14, marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase",
                              letterSpacing:"0.07em", color:ACCENT_TEXT, marginBottom:8 }}>Active Profile</div>
                <div style={{ fontWeight:800, fontSize:13, marginBottom:4 }}>{data.activeProfile.profile_name}</div>
                <div style={{ fontSize:11, color:theme.textMuted }}>{data.activeProfile.role_family}</div>
                <div style={{ fontSize:11, color:theme.textMuted }}>{data.activeProfile.domain}</div>
                {data.activeProfile.target_titles && (
                  <div style={{ marginTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(() => {
                      try { return JSON.parse(data.activeProfile.target_titles).slice(0,6).map(t => (
                        <Pill key={t} color={ACCENT_TEXT}>{t}</Pill>
                      )); } catch { return null; }
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ border:`1px solid ${C.DANGER}44`, borderRadius:10, padding:14, marginBottom:14,
                            color:C.DANGER, fontSize:12 }}>No active profile</div>
            )}

            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                          letterSpacing:"0.07em", color:theme.textMuted, marginBottom:6 }}>All Profiles</div>
            {data.allProfiles.map(p => (
              <div key={p.id} style={{ padding:"6px 10px", borderRadius:6, marginBottom:4,
                                       background: p.is_active ? ACCENT+"22" : theme.surfaceHigh,
                                       fontSize:11 }}>
                <span style={{ fontWeight:600 }}>{p.profile_name}</span>
                {p.is_active && <span style={{ marginLeft:6, color:ACCENT_TEXT, fontSize:10, fontWeight:700 }}>ACTIVE</span>}
                <br/>
                <span style={{ color:theme.textMuted }}>{p.role_family}</span>
              </div>
            ))}

            {data.searches.length > 0 && (
              <>
                <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                              letterSpacing:"0.07em", color:theme.textMuted, margin:"12px 0 6px" }}>
                  Search Queries
                </div>
                {data.searches.map((s, i) => (
                  <div key={i} style={{ fontSize:11, padding:"4px 10px", background:theme.surfaceHigh,
                                         borderRadius:5, marginBottom:3 }}>
                    <span style={{ fontWeight:600 }}>{s.search_query}</span>
                    <span style={{ color:theme.textMuted, float:"right" }}>{ago(s.last_scraped_at)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Right: Pool Analysis */}
          <div>
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <StatCard label="Total in Pool" value={fmt(totalJobs)} theme={theme}/>
              <StatCard label="Correct" value={fmt(correctJobs)} accent={C.SUCCESS} theme={theme}/>
              <StatCard label="Wrong / NULL" value={fmt(wrongJobs)} accent={wrongJobs > 0 ? C.DANGER : theme.text} theme={theme}/>
            </div>

            {/* Filter pills */}
            <div style={{ display:"flex", gap:6, marginBottom:12 }}>
              {["All","Correct","Wrong","NULL"].map(f => (
                <button className="dbx-depth" key={f} onClick={() => setPoolFilter(f)}
                  style={{
                    padding:"3px 12px", border:`1px solid ${poolFilter===f ? ACCENT_TEXT : theme.border}`,
                    background: poolFilter===f ? ACCENT : "transparent",
                    color: poolFilter===f ? C.ON_ACCENT : theme.text,
                    fontSize:11, fontWeight:700, cursor:"pointer",
                  }}>{f}</button>
              ))}
            </div>

            <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden", marginBottom:16 }}>
              <div style={{
                display:"grid", gridTemplateColumns:"2fr 1.5fr 1.5fr 80px",
                padding:"7px 12px", background:theme.surfaceHigh,
                fontSize:10, fontWeight:700, textTransform:"uppercase",
                letterSpacing:"0.06em", color:theme.textMuted,
              }}>
                <div>Title</div><div>Company</div><div>Tagged Profile</div><div>Status</div>
              </div>
              {filteredJobs.slice(0,50).map((job, i) => {
                const statusColor = job.status === "CORRECT" ? C.SUCCESS
                  : job.status === "NULL_TAG" ? C.WARNING : C.DANGER;
                const statusLabel = job.status === "CORRECT" ? "✓ Correct"
                  : job.status === "NULL_TAG" ? "⚠ NULL" : "✗ Wrong";
                return (
                  <div key={i} style={{
                    display:"grid", gridTemplateColumns:"2fr 1.5fr 1.5fr 80px",
                    padding:"7px 12px", borderTop:`1px solid ${theme.border}`, fontSize:11,
                  }}>
                    <div style={{ fontWeight:600 }}>{truncate(job.title,32)}</div>
                    <div style={{ color:theme.textMuted }}>{truncate(job.company,24)}</div>
                    <div style={{ color:theme.textMuted, fontSize:10 }}>{job.tagged_to_profile || "—"}</div>
                    <div><Pill color={statusColor}>{statusLabel}</Pill></div>
                  </div>
                );
              })}
              {filteredJobs.length === 0 && (
                <div style={{ padding:"20px", textAlign:"center", color:theme.textMuted, fontSize:12 }}>
                  No jobs in this category.
                </div>
              )}
            </div>

            {/* ⛔ This inspector is READ-ONLY over user_jobs. "Clean Pool" was removed (A51, 10-02): it deleted
                a user's Saves and Passes in one click. "Re-tag Pool" was removed (A58, 10-02): pre-pivot pool
                logic that rewrote a user's rows onto their active profile. A Save or a Pass is the user's. */}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Job Trace ─────────────────────────────────────────
function JobTraceTab({ theme, initialJobId }) {
  const [jobId, setJobId] = useState(initialJobId || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const trace = async () => {
    if (!jobId.trim()) return;
    setLoading(true); setError(null); setData(null);
    try { setData(await api(`/api/admin/db/job-trace/${encodeURIComponent(jobId.trim())}`)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const d = data?.diagnosis;
  return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:20 }}>
        <input
          value={jobId} onChange={e => setJobId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && trace()}
          placeholder="Enter Job ID…"
          style={{ background:theme.surfaceHigh, border:`1px solid ${theme.border}`,
                   borderRadius:6, padding:"7px 12px", color:theme.text, fontSize:12, width:360 }}
        />
        <button onClick={trace} disabled={!jobId.trim() || loading}
          style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                   padding:"7px 20px", fontWeight:700, fontSize:12, cursor:"pointer" }}>
          {loading ? "Tracing…" : "Trace"}
        </button>
      </div>

      <ErrBox msg={error} theme={theme}/>
      {loading && <Spinner theme={theme}/>}

      {data && (
        <>
          {/* Job header */}
          <div style={{ background:theme.surfaceHigh, borderRadius:10, padding:14,
                        marginBottom:16, display:"flex", gap:16, alignItems:"flex-start" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, fontSize:15 }}>{data.scraped_job.title}</div>
              <div style={{ color:theme.textMuted, fontSize:12, marginTop:2 }}>
                {data.scraped_job.company} · {data.scraped_job.location}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                {data.scraped_job.employment_type && <Pill color={C.VIOLET}>{data.scraped_job.employment_type}</Pill>}
                {data.scraped_job.work_type && <Pill color={C.INFO}>{data.scraped_job.work_type}</Pill>}
                {data.scraped_job.ats_score != null && (
                  <Pill color={bandColor(data.scraped_job.ats_score)}>
                    {atsBandLabel(atsBandFor(data.scraped_job.ats_score)).short} · {data.scraped_job.ats_score}
                  </Pill>
                )}
              </div>
            </div>
          </div>

          {/* A50 step 5: the lifecycle — crawl, gate, dedup, enrichment, scoring, captures, drafts,
              records, submitted — in time order, each with the reason the system gave. */}
          {data.lifecycle?.events?.length > 0 && (
            <div data-job-lifecycle style={{ border:`1px solid ${theme.border}`, borderRadius:10, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em",
                            color:theme.textMuted, marginBottom:10 }}>
                Lifecycle {data.lifecycle.active ? "" : "· not on the board"}
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <tbody>
                  {data.lifecycle.events.map((e, i) => (
                    <tr key={i} style={{ borderTop:`1px solid ${theme.border}` }}>
                      <td style={{ padding:"5px 8px", whiteSpace:"nowrap", color:theme.textMuted }}>
                        {e.at ? new Date(e.at * 1000).toISOString().replace("T", " ").slice(0, 16) + "Z" : "—"}
                      </td>
                      <td style={{ padding:"5px 8px", fontWeight:700, textTransform:"uppercase", fontSize:10 }}>{e.stage}</td>
                      <td style={{ padding:"5px 8px" }}>{e.what}</td>
                      <td style={{ padding:"5px 8px", color: /STALE|Held|Retired|no column/.test(e.detail || e.what) ? C.WARNING : theme.textMuted }}>{e.detail || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 2x2 grid of cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>

            {/* Card 1: scraped_jobs row */}
            <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, padding:14 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:"0.07em", color:theme.textMuted, marginBottom:10 }}>
                scraped_jobs row
              </div>
              <div style={{ marginBottom:8 }}>
                <span style={{ fontSize:10, color:theme.textMuted }}>domain_profile_id: </span>
                <Pill color={data.scraped_job.domain_profile_id ? C.SUCCESS : C.DANGER}>
                  {data.scraped_job.domain_profile_id ?? "NULL"}
                </Pill>
              </div>
              {data.role_mappings?.length > 0 && (
                <div style={{ marginBottom:8, display:"flex", gap:5, flexWrap:"wrap" }}>
                  {data.role_mappings.map(r => (
                    <Pill key={r.role_key} color={ACCENT_TEXT}>{r.role_key}</Pill>
                  ))}
                </div>
              )}
              <KeyValueGrid
                data={{
                  job_id: data.scraped_job.job_id,
                  title: data.scraped_job.title,
                  company: data.scraped_job.company,
                  search_query: data.scraped_job.search_query,
                  source_platform: data.scraped_job.source_platform,
                  employment_type: data.scraped_job.employment_type,
                  scraped_at: data.scraped_job.scraped_at ? ago(data.scraped_job.scraped_at) : "—",
                  ats_score: data.scraped_job.ats_score,
                  ghost_score: data.scraped_job.ghost_score,
                }}
                theme={theme}
                highlight={["domain_profile_id"]}
              />
            </div>

            {/* Card 2: user_jobs rows */}
            <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, padding:14 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:"0.07em", color:theme.textMuted, marginBottom:10 }}>
                user_jobs ({data.user_jobs.length} users)
              </div>
              {data.user_jobs.length === 0 && (
                <div style={{ color:theme.textMuted, fontSize:12 }}>No user_jobs rows for this job.</div>
              )}
              {data.user_jobs.map((uj, i) => (
                <div key={i} style={{ background:theme.surfaceHigh, borderRadius:7, padding:"8px 10px",
                                       marginBottom:6, fontSize:11 }}>
                  <div style={{ fontWeight:700, marginBottom:4 }}>@{uj.username}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <Pill color={uj.applied?C.SUCCESS:C.INK_FAINT}>{uj.applied?"Applied":"Not applied"}</Pill>
                    {uj.disliked ? <Pill color={C.DANGER}>Disliked</Pill> : null}
                    {uj.starred ? <Pill color={ACCENT_TEXT}>Starred</Pill> : null}
                    <Pill color={uj.domain_profile_id===data.scraped_job.domain_profile_id?C.SUCCESS:C.DANGER}>
                      profile:{uj.domain_profile_id ?? "NULL"}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>

            {/* Card 3: Resumes & Applications */}
            <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, padding:14 }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:"0.07em", color:theme.textMuted, marginBottom:10 }}>
                Resumes & Applications
              </div>
              {data.resumes.length === 0 && data.applications.length === 0 && (
                <div style={{ color:theme.textMuted, fontSize:12 }}>None generated or submitted.</div>
              )}
              {data.resumes.map((r, i) => (
                <div key={i} style={{ background:theme.surfaceHigh, borderRadius:6, padding:"6px 10px",
                                       marginBottom:4, fontSize:11 }}>
                  Resume generated — ATS: {r.ats_score ?? "—"}
                </div>
              ))}
              {data.applications.map((a, i) => (
                <div key={i} style={{ background:C.SUCCESS_QUIET, border:`1px solid ${C.SUCCESS}33`,
                                       borderRadius:6, padding:"6px 10px", marginBottom:4, fontSize:11 }}>
                  Applied by @{a.username} — {a.applied_at ? new Date(a.applied_at*1000).toISOString().slice(0,10) : "—"}
                </div>
              ))}
            </div>

            {/* Card 4: Diagnosis */}
            <div style={{
              border:`1px solid ${d?.isCorrectlyIsolated ? C.SUCCESS : C.DANGER}44`,
              background: d?.isCorrectlyIsolated ? C.SUCCESS_QUIET : C.DANGER_QUIET,
              borderRadius:10, padding:14,
            }}>
              <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                            letterSpacing:"0.07em", color:theme.textMuted, marginBottom:10 }}>
                Diagnosis
              </div>
              {d?.isCorrectlyIsolated ? (
                <div style={{ color:C.SUCCESS, fontWeight:700, marginBottom:8 }}>
                  ✓ Correctly tagged to "{data.domain_profile?.profile_name}" owned by @{d.profileOwner}
                </div>
              ) : (
                <div style={{ color:C.DANGER, fontWeight:700, marginBottom:8 }}>
                  ✗ {d?.hasProfile ? "Profile isolation issue" : "No domain profile tag"}
                </div>
              )}

              {d?.usersWithJob?.length > 0 && (
                <div style={{ fontSize:11, color:theme.textMuted, marginBottom:8 }}>
                  Appears in pools of: {d.usersWithJob.map(u => `@${u}`).join(", ")}
                </div>
              )}

              {d?.issues?.length > 0 && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.DANGER, marginBottom:4 }}>Issues:</div>
                  {d.issues.map((issue, i) => (
                    <div key={i} style={{ fontSize:11, color:C.DANGER, padding:"3px 0",
                                          borderLeft:`2px solid ${C.DANGER}`, paddingLeft:8, marginBottom:4 }}>
                      {issue}
                    </div>
                  ))}
                </div>
              )}

              {data.domain_profile && (
                <div style={{ marginTop:10, fontSize:11, color:theme.textMuted }}>
                  Profile owner: @{data.domain_profile.owner_username}<br/>
                  Profile: {data.domain_profile.profile_name}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab 5: Query Simulator ───────────────────────────────────
function QuerySimulatorTab({ theme }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSql, setShowSql] = useState(false);
  const [rawSql, setRawSql] = useState("SELECT * FROM scraped_jobs ORDER BY scraped_at DESC LIMIT 10;");
  const [rawResults, setRawResults] = useState(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState(null);

  useEffect(() => {
    api("/api/admin/users").then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const simulate = async () => {
    if (!selectedUser) return;
    setLoading(true); setError(null); setData(null);
    try { setData(await api(`/api/admin/db/simulate-jobs/${selectedUser}`)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const runRawQuery = async () => {
    if (!rawSql.trim()) return;
    setRawLoading(true); setRawError(null); setRawResults(null);
    try { setRawResults(await api(`/api/admin/db/raw-query?sql=${encodeURIComponent(rawSql)}`)); }
    catch (e) { setRawError(e.message); }
    finally { setRawLoading(false); }
  };

  const REASON_COLORS = {
    wrong_profile:C.DANGER, applied:C.SUCCESS,
    disliked:C.WARNING, too_old:C.INK_FAINT, resume_generated:C.VIOLET,
  };

  return (
    <div>
      {/* User selector */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:20 }}>
        <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
          style={{ background:theme.surfaceHigh, border:`1px solid ${theme.border}`,
                   borderRadius:6, padding:"6px 12px", color:theme.text, fontSize:12, minWidth:240 }}>
          <option value="">Select a user to simulate…</option>
          {users.filter(u => !u.is_admin).map(u => (
            <option key={u.id} value={u.id}>{u.username} (id:{u.id})</option>
          ))}
        </select>
        <button onClick={simulate} disabled={!selectedUser || loading}
          style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                   padding:"6px 20px", fontWeight:700, fontSize:12, cursor:"pointer",
                   opacity:!selectedUser?0.5:1 }}>
          {loading ? "Simulating…" : "Simulate"}
        </button>
      </div>

      <ErrBox msg={error} theme={theme}/>
      {loading && <Spinner theme={theme}/>}

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <StatCard label="Active Profile" value={data.activeProfile?.profile_name || "None"}
              theme={theme} accent={data.activeProfile ? ACCENT_TEXT : C.DANGER}/>
            <StatCard label="Jobs in Pool" value={fmt(data.totalJobsInPool)} theme={theme}/>
            <StatCard label="Would Show" value={fmt(data.jobsPassingAllFilters)}
              accent={C.SUCCESS} theme={theme}/>
            {/* "Session Sync Adds" removed with the endpoint's 7-day cutoff — session sync was
                the pre-pivot per-user pool top-up and no longer exists. Replaced with the
                profile-derived filter set, which is what actually narrows the board now and is
                the first thing to check when a user reports a missing job. */}
            <StatCard label="Derived Filters"
              value={fmt(Object.keys(data.derivedFilters || {}).length)}
              sub="from profile signals"
              accent={C.VIOLET} theme={theme}/>
            <StatCard label="Filtered Out"
              value={fmt(data.totalJobsInPool - data.jobsPassingAllFilters)}
              accent={C.DANGER} theme={theme}/>
          </div>

          {/* Conditions */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                          letterSpacing:"0.07em", color:theme.textMuted, marginBottom:8 }}>
              WHERE Conditions Applied
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {data.conditions.map((c, i) => (
                <span key={i} style={{
                  padding:"3px 10px", borderRadius:6, fontSize:10, fontWeight:700,
                  background:ACCENT+"22", color:ACCENT_TEXT, border:`1px solid ${ACCENT_TEXT}44`,
                }}>
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Filter reason breakdown */}
          {Object.keys(data.filterReasonCounts).length > 0 && (
            <div style={{ marginBottom:16, display:"flex", gap:8, flexWrap:"wrap" }}>
              <div style={{ fontSize:11, fontWeight:700, color:theme.textMuted, alignSelf:"center" }}>
                Filtered reasons:
              </div>
              {Object.entries(data.filterReasonCounts).map(([reason, count]) => (
                <Pill key={reason} color={REASON_COLORS[reason] || C.INK_FAINT}>
                  {reason}: {count}
                </Pill>
              ))}
            </div>
          )}

          {/* Two-column table */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
            {/* Would Show */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.SUCCESS, marginBottom:8 }}>
                Would Show ({data.jobsPassingAllFilters})
              </div>
              <div style={{ border:`1px solid ${C.SUCCESS}44`, borderRadius:8, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 50px",
                              padding:"6px 10px", background:C.SUCCESS_QUIET,
                              fontSize:10, fontWeight:700, color:theme.textMuted,
                              textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  <div>Title</div><div>Company</div><div>ATS</div>
                </div>
                {data.sampleResults.map((job, i) => (
                  <div key={i} style={{
                    display:"grid", gridTemplateColumns:"2fr 1.5fr 50px",
                    padding:"6px 10px", borderTop:`1px solid ${C.SUCCESS}22`, fontSize:11,
                  }}>
                    <div style={{ fontWeight:600 }}>{truncate(job.title,28)}</div>
                    <div style={{ color:theme.textMuted }}>{truncate(job.company,20)}</div>
                    <div style={{ color:bandColor(job.ats_score) }}>
                      {job.ats_score != null ? `${atsBandLabel(atsBandFor(job.ats_score)).short} ${job.ats_score}` : "—"}
                    </div>
                  </div>
                ))}
                {data.sampleResults.length === 0 && (
                  <div style={{ padding:"16px", textAlign:"center", color:C.SUCCESS, fontSize:12 }}>
                    No jobs would show.
                  </div>
                )}
              </div>
            </div>

            {/* Filtered Out */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.DANGER, marginBottom:8 }}>
                Filtered Out (sample)
              </div>
              <div style={{ border:`1px solid ${C.DANGER}44`, borderRadius:8, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 90px",
                              padding:"6px 10px", background:C.DANGER_QUIET,
                              fontSize:10, fontWeight:700, color:theme.textMuted,
                              textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  <div>Title</div><div>Company</div><div>Reason</div>
                </div>
                {data.sampleFiltered.map((job, i) => (
                  <div key={i} style={{
                    display:"grid", gridTemplateColumns:"2fr 1.5fr 90px",
                    padding:"6px 10px", borderTop:`1px solid ${C.DANGER}22`, fontSize:11,
                  }}>
                    <div style={{ fontWeight:600 }}>{truncate(job.title,28)}</div>
                    <div style={{ color:theme.textMuted }}>{truncate(job.company,20)}</div>
                    <Pill color={REASON_COLORS[job.filterReason]||C.INK_FAINT}>{job.filterReason}</Pill>
                  </div>
                ))}
                {data.sampleFiltered.length === 0 && (
                  <div style={{ padding:"16px", textAlign:"center", color:theme.textMuted, fontSize:12 }}>
                    No filtered jobs.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Raw SQL panel */}
          <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden", marginBottom:24 }}>
            <button
              onClick={() => setShowSql(!showSql)}
              style={{ width:"100%", textAlign:"left", padding:"10px 14px",
                       background:theme.surfaceHigh, border:"none", cursor:"pointer",
                       color:theme.text, fontSize:11, fontWeight:700 }}>
              {showSql ? "▾" : "▸"} Raw SQL Query
            </button>
            {showSql && (
              <div style={{ padding:14 }}>
                <pre style={{ background:C.SURFACE_SOLID, color:C.INK, padding:14, borderRadius:8,
                              fontSize:11, overflowX:"auto", margin:0, lineHeight:1.5 }}>
                  {data.rawSql}
                </pre>
                <button
                  onClick={() => navigator.clipboard.writeText(data.rawSql)}
                  style={{ marginTop:8, background:"transparent", color:theme.text, border:`1px solid ${theme.border}`,
                           borderRadius:6, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                  Copy SQL
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Raw Query Sandbox — always visible */}
      <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, padding:16 }}>
        <div style={{ fontSize:12, fontWeight:800, marginBottom:4 }}>Raw Query Sandbox</div>
        <div style={{ fontSize:11, color:C.WARNING, marginBottom:10 }}>
          SELECT queries only — max 200 rows returned
        </div>
        <textarea
          value={rawSql}
          onChange={e => setRawSql(e.target.value)}
          rows={4}
          style={{
            width:"100%", boxSizing:"border-box",
            background:C.SURFACE_SOLID, color:C.INK,
            border:`1px solid ${theme.border}`, borderRadius:8,
            padding:"10px 12px", fontSize:12, fontFamily:"monospace",
            lineHeight:1.5, resize:"vertical", marginBottom:8,
          }}
        />
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button onClick={runRawQuery} disabled={rawLoading}
            style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                     padding:"6px 18px", fontWeight:700, fontSize:11, cursor:"pointer" }}>
            {rawLoading ? "Running…" : "Run"}
          </button>
          {rawResults && (
            <button onClick={() => {
              if (!rawResults.rows?.length) return;
              const cols = rawResults.columns;
              const csv = [cols.join(","), ...rawResults.rows.map(r => cols.map(c => {
                const v = r[c]; if (v==null) return "";
                const s = String(v);
                return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s;
              }).join(","))].join("\n");
              const blob = new Blob([csv], { type:"text/csv" });
              const url = URL.createObjectURL(blob);
              Object.assign(document.createElement("a"), { href:url, download:"query_results.csv" }).click();
              URL.revokeObjectURL(url);
            }}
              style={{ background:"transparent", color:ACCENT_TEXT, border:`1px solid ${ACCENT_TEXT}44`,
                       borderRadius:6, padding:"6px 18px", fontWeight:700, fontSize:11, cursor:"pointer" }}>
              Export CSV
            </button>
          )}
        </div>

        <ErrBox msg={rawError} theme={theme}/>

        {rawResults && (
          <div>
            <div style={{ fontSize:11, color:theme.textMuted, marginBottom:8 }}>
              {rawResults.count} row{rawResults.count !== 1 ? "s" : ""} returned
            </div>
            {rawResults.rows?.length > 0 && (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                  <thead>
                    <tr style={{ background:theme.surfaceHigh }}>
                      {rawResults.columns.map(c => (
                        <th key={c} style={{ padding:"5px 8px", textAlign:"left", color:theme.textMuted,
                                             fontWeight:700, borderBottom:`1px solid ${theme.border}`,
                                             whiteSpace:"nowrap" }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawResults.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${theme.border}` }}>
                        {rawResults.columns.map(c => (
                          <td key={c} style={{ padding:"4px 8px", color:theme.text, fontSize:10,
                                               maxWidth:200, overflow:"hidden", textOverflow:"ellipsis",
                                               whiteSpace:"nowrap" }}>
                            {row[c] == null ? <span style={{color:theme.textMuted}}>NULL</span>
                                            : truncate(String(row[c]), 60)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main DBInspector ──────────────────────────────────────────
function TableBrowserTab({ theme }) {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/api/admin/db/tables").then(d => {
      const list = d.tables || [];
      setTables(list);
      if (list.length && !selected) setSelected(list[0].name);
    }).catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true); setError(null);
    api(`/api/admin/db/table-data/${selected}?page=${page}&pageSize=25`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected, page]);

  const cols = data?.columns?.map(c => c.name) || [];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:18 }}>
      <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"hidden" }}>
        <div style={{ padding:"10px 12px", background:theme.surfaceHigh,
                      fontSize:10, fontWeight:800, textTransform:"uppercase",
                      letterSpacing:"0.07em", color:theme.textMuted }}>
          Tables
        </div>
        <div style={{ maxHeight:"calc(100vh - 250px)", overflowY:"auto" }}>
          {tables.map(t => (
            <button key={t.name}
              onClick={() => { setSelected(t.name); setPage(1); }}
              style={{
                width:"100%", display:"flex", justifyContent:"space-between",
                padding:"8px 12px", border:"none", borderTop:`1px solid ${theme.border}`,
                background:selected === t.name ? ACCENT+"22" : "transparent",
                color:theme.text, cursor:"pointer", textAlign:"left", fontSize:12,
              }}>
              <span style={{ fontWeight:selected === t.name ? 800 : 500 }}>{t.name}</span>
              <span style={{ color:theme.textMuted }}>{fmt(t.rowCount)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900 }}>{selected || "Select a table"}</div>
            {data && <div style={{ fontSize:11, color:theme.textMuted }}>
              {fmt(data.total)} rows · page {data.page} of {data.totalPages || 1}
            </div>}
          </div>
          <div style={{ flex:1 }}/>
          <button disabled={!data || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${theme.border}`,
                     background:theme.surfaceHigh, color:theme.text, cursor:"pointer",
                     opacity:!data || page <= 1 ? 0.5 : 1 }}>
            Prev
          </button>
          <button disabled={!data || page >= data.totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding:"5px 12px", borderRadius:6, border:`1px solid ${theme.border}`,
                     background:theme.surfaceHigh, color:theme.text, cursor:"pointer",
                     opacity:!data || page >= data.totalPages ? 0.5 : 1 }}>
            Next
          </button>
        </div>

        <ErrBox msg={error} theme={theme}/>
        {loading && <Spinner theme={theme}/>}
        {data && !loading && (
          <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"auto",
                        maxHeight:"calc(100vh - 245px)" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:theme.surfaceHigh, position:"sticky", top:0 }}>
                  {cols.map(c => (
                    <th key={c} style={{ padding:"7px 9px", textAlign:"left",
                                         borderBottom:`1px solid ${theme.border}`,
                                         color:theme.textMuted, whiteSpace:"nowrap" }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${theme.border}` }}>
                    {cols.map(c => (
                      <td key={c} style={{ padding:"6px 9px", maxWidth:260,
                                           whiteSpace:"nowrap", overflow:"hidden",
                                           textOverflow:"ellipsis", color:theme.text }}>
                        {row[c] == null ? <span style={{ color:theme.textMuted }}>NULL</span> : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function JobReviewTab({ theme }) {
  const { ask, dialog } = useConfirm();
  const [data, setData] = useState({ jobs: [], profiles: [] });
  const [query, setQuery] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (query.trim()) params.set("q", query.trim());
    if (roleKey) params.set("roleKey", roleKey);
    setError(null);
    api(`/api/admin/db/job-review?${params.toString()}`)
      .then(setData)
      .catch(e => setError(e.message));
  }, [query, roleKey]);

  useEffect(() => { load(); }, [load]);

  // A58 (b): a re-classification changes which BOARDS show the posting — never anyone's Save or Pass.
  // The confirm says who has a decision on it (read fresh from the server) and what the change does.
  // Since CC1b an UNCLASSIFIED posting is shown on every board, so the old "Hide" un-hid it.
  const [lastChange, setLastChange] = useState(null);   // { logId, title }
  const describeImpact = (im) => im.usersReferencing === 0
    ? "No user has saved, passed or applied to it."
    : `${im.usersReferencing} user(s) have it on record (${im.saved} saved, ${im.passed} passed, ${im.applied} applied). ` +
      "Their saves and passes are NOT changed.";
  const reassign = async (job, nextRoleKey, profileId = "") => {
    setStatus(""); setError(null);
    let impact;
    try { impact = await api(`/api/admin/db/job-review/impact/${encodeURIComponent(job.job_id)}`); }
    catch (e) { setError(e.message); return; }
    const effect = nextRoleKey === "unclassified"
      ? "Unclassify removes its role classification. An unclassified posting is SHOWN ON EVERY BOARD (ranked as unknown) — this does not hide it."
      : `Classify as "${nextRoleKey}": it is then shown on ${nextRoleKey} boards and on no other role's board.`;
    if (!await ask({ title: job.title, label: nextRoleKey === "unclassified" ? "Unclassify it" : `Classify as ${nextRoleKey}`,
      body: <><p style={{ margin:"0 0 8px" }}>{effect}</p><p style={{ margin:"0 0 8px" }}>{describeImpact(impact)}</p>
        The previous classification is logged; Undo last change restores it.</> })) return;
    setSaving(job.job_id);
    try {
      const r = await api("/api/admin/db/job-review/reassign", {
        method: "POST",
        body: JSON.stringify({
          jobId: job.job_id,
          roleKey: nextRoleKey,
          domainProfileId: profileId || null,
        }),
      });
      setStatus(`Updated ${job.title}`);
      setLastChange({ logId: r.logId, title: job.title });
      load();
    } catch(e) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const undoLast = async () => {
    if (!lastChange || !await ask({ title: `Undo the change to "${lastChange.title}"?`, label: "Undo it", body: "Its previous classification is restored." })) return;
    try {
      await api(`/api/admin/db/job-review/undo/${lastChange.logId}`, { method: "POST" });
      setStatus(`Undid the change to ${lastChange.title}`); setLastChange(null); load();
    } catch (e) { setError(e.message); }
  };

  const roleOptions = ["", "engineering", "data", "pm", "finance", "hr", "design", "operations", "marketing", "general", "unclassified"];
  const profilesByRole = () => data.profiles || [];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {dialog}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search title, company, query"
          style={{ padding:"7px 10px", borderRadius:6, border:`1px solid ${theme.border}`,
                   background:theme.surface, color:theme.text, minWidth:240 }}/>
        <select value={roleKey} onChange={e => setRoleKey(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:6, border:`1px solid ${theme.border}`,
                   background:theme.surface, color:theme.text }}>
          {roleOptions.map(r => <option key={r || "all"} value={r}>{r || "all roles"}</option>)}
        </select>
        <button onClick={load}
          style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                   padding:"7px 14px", fontWeight:700, cursor:"pointer" }}>
          Refresh
        </button>
        {status && <span style={{ fontSize:12, color:theme.textMuted }}>{status}</span>}
        {lastChange && (
          <button onClick={undoLast}
            style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                     padding:"5px 10px", fontWeight:700, cursor:"pointer", fontSize:11 }}>
            ↩ Undo last change
          </button>
        )}
      </div>
      <ErrBox msg={error} theme={theme}/>
      <div style={{ border:`1px solid ${theme.border}`, borderRadius:10, overflow:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ background:theme.surfaceHigh }}>
              {["Job", "Current", "Users", "Suggested", "Assign", "Profile", ""].map(h => (
                <th key={h} style={{ padding:"8px 10px", textAlign:"left", color:theme.textMuted,
                                      borderBottom:`1px solid ${theme.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.jobs || []).map(job => {
              const currentRole = (job.role_keys || []).join(", ") || "unclassified";
              const selectedId = job.domain_profile_id || "";
              return (
                <tr key={job.job_id} style={{ borderBottom:`1px solid ${theme.border}` }}>
                  <td style={{ padding:"8px 10px", color:theme.text, minWidth:260 }}>
                    <div style={{ fontWeight:800 }}>{job.title}</div>
                    <div style={{ color:theme.textMuted }}>{job.company} - {job.search_query || "no query"}</div>
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <Pill color={currentRole === "unclassified" ? C.DANGER : ACCENT_TEXT}>{currentRole}</Pill>
                    {job.profile_name && <div style={{ marginTop:4, color:theme.textMuted }}>{job.profile_name}</div>}
                  </td>
                  <td style={{ padding:"8px 10px", color:theme.textMuted }}
                    title="Users with a Save, Pass or application on this posting. A re-classification never changes them.">
                    {job.users_referencing ?? 0}
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <Pill color={job.suggestedRoleKey === "data" ? C.SUCCESS : C.INFO}>{job.suggestedRoleKey}</Pill>
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <select defaultValue={job.suggestedRoleKey}
                      onChange={e => { job._nextRoleKey = e.target.value; }}
                      style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${theme.border}`,
                               background:theme.surface, color:theme.text }}>
                      {/* the suggestion is always one of the choices — a role the list lacked (sales) showed as engineering and saved as sales */}
                      {[...new Set([...roleOptions.filter(Boolean), job.suggestedRoleKey].filter(Boolean))].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:"8px 10px" }}>
                    <select defaultValue={selectedId}
                      onChange={e => { job._nextProfileId = e.target.value; }}
                      style={{ padding:"5px 8px", borderRadius:6, border:`1px solid ${theme.border}`,
                               background:theme.surface, color:theme.text, maxWidth:220 }}>
                      <option value="">No specific profile</option>
                      {profilesByRole().map(p => (
                        <option key={p.id} value={p.id}>{p.profile_name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding:"8px 10px", whiteSpace:"nowrap" }}>
                    <button disabled={saving === job.job_id}
                      onClick={() => reassign(job, job._nextRoleKey || job.suggestedRoleKey, job._nextProfileId ?? selectedId)}
                      style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                               padding:"5px 10px", fontWeight:700, cursor:"pointer", opacity:saving === job.job_id ? 0.5 : 1 }}>
                      Save…
                    </button>
                    <button disabled={saving === job.job_id}
                      onClick={() => reassign(job, "unclassified", "")}
                      title="Removes the classification. Unclassified postings are shown on every board."
                      style={{ marginLeft:6, background:"transparent", color:theme.textMuted,
                               border:`1px solid ${theme.border}`, borderRadius:6,
                               padding:"5px 10px", fontWeight:700, cursor:"pointer" }}>
                      Unclassify
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DBInspector() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("scrape");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTimerRef = useRef(null);
  const [traceJobId, setTraceJobId] = useState(null);

  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (autoRefresh > 0) {
      refreshTimerRef.current = setInterval(() => {
        setRefreshKey(k => k+1);
        setLastUpdated(new Date().toLocaleTimeString());
      }, autoRefresh * 1000);
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [autoRefresh]);

  const doRefresh = () => {
    setRefreshKey(k => k+1);
    setLastUpdated(new Date().toLocaleTimeString());
  };

  return (
    <div style={{
      fontFamily:"'DM Sans',system-ui,sans-serif", fontSize:13,
      background:theme.bg, minHeight:"calc(100vh - 56px)", color:theme.text,
      padding:"20px 24px",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Global controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <a href="/admin"
          style={{ fontSize:12, color:theme.textMuted, textDecoration:"none", fontWeight:600,
                   display:"flex", alignItems:"center", gap:4 }}>
          ← Admin Dashboard
        </a>
        <div style={{ flex:1 }}/>
        {lastUpdated && (
          <span style={{ fontSize:11, color:theme.textMuted }}>Updated: {lastUpdated}</span>
        )}
        {/* D83 (39d): a dropdown of the real values — three small toggles drew as capsules (D60). */}
        <label style={{ fontSize:11, color:theme.textMuted }}>Auto-refresh{" "}
          <select aria-label="Auto-refresh" value={autoRefresh} onChange={e => setAutoRefresh(Number(e.target.value))}
            style={{ padding:"4px 6px", borderRadius:6, border:`1px solid ${theme.border}`, background:theme.surface, color:theme.text, fontSize:11 }}>
            <option value={0}>off</option><option value={30}>every 30 s</option><option value={60}>every 60 s</option>
          </select>
        </label>
        <button onClick={doRefresh}
          style={{ background:"transparent", color:theme.text, border:`1px solid ${theme.border}`, borderRadius:6,
                   padding:"5px 14px", fontWeight:700, fontSize:11, cursor:"pointer" }}>
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        display:"flex", gap:0, borderBottom:`1px solid ${theme.border}`, marginBottom:24,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              background:"transparent", border:"none", cursor:"pointer",
              padding:"10px 18px", fontSize:12, fontWeight:800, letterSpacing:"0.05em",
              textTransform:"uppercase", color: activeTab===t.id ? theme.text : theme.textMuted,
              borderBottom: activeTab===t.id ? `2px solid ${ACCENT_TEXT}` : "2px solid transparent",
              transition:"all 0.15s", position:"relative", top:1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={refreshKey}>
        {activeTab === "scrape" && <ScrapeMonitorTab theme={theme}/>}
        {/* D83 audit #22: the table browser is part of the schema page — one list of tables, not two. */}
        {activeTab === "schema" && <><SchemaExplorerTab theme={theme}/><div style={{ marginTop:24 }}><TableBrowserTab theme={theme}/></div></>}
        {activeTab === "pool" && <UserPoolTab theme={theme}/>}
        {activeTab === "review" && <JobReviewTab theme={theme}/>}
        {activeTab === "trace" && <JobTraceTab theme={theme} initialJobId={traceJobId}/>}
        {activeTab === "simulate" && <QuerySimulatorTab theme={theme}/>}
      </div>
    </div>
  );
}

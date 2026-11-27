// client/src/panels/AdminPanel.jsx — the admin dashboard (/admin). The DB inspector is /admin/db.
// (A50: the "SCRAPING — SCHEDULED FOR REMOVAL" banner and the "Lucy / yellow accent" labels were
// stale — the accent is the brand orange from colorTokens, and this panel was never removed.)
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api }      from "../lib/api.js";
import { useTheme } from "../styles/theme.jsx";
import { C } from "../styles/colorTokens.js";
import { GlanceTab, UserApplications, DiskBanner, CrawlerTab, PluginTab, NoticesTab, CostsTab, DeploymentsPanel, DiskPanel, ReviewerAccount,
         BoardPolicySection, KillSwitchSection, FullAutoPrerequisitesSection, QuickChecksSection, SubmitOutcomesSection, TailoringAdminSection, MatchAlertsSection, OutcomesSection, BoardFitSection, JobDataSection, CompaniesSection, SlugHarvestSection,
         ToolsServiceSection } from "./adminOps.jsx";
import { ADMIN_GROUPS, readAdminPlace, writeAdminPlace } from "./adminMap.js";
import { AdminSection } from "./adminKit.jsx";
import { EnrichmentTab } from "./adminEnrichment.jsx";
import { EmailHealthTab } from "./adminEmail.jsx";
import { ModelUsageTab } from "./adminUsage.jsx";
import { ModelGatewaySection } from "./adminGateway.jsx";   // ⭐ D162 G4 (46f): the gateway's card
import { FlagsSection } from "./adminFlags.jsx";   // ⭐ A187 Stage 0 (46i): runtime flags
import { AdminsTab } from "./adminAdmins.jsx";
import { AtlasTab, AtlasBacklogSection, AtlasCompeteSection } from "./adminAtlas.jsx";
import { TesterDetails } from "./adminTesterDetails.jsx";
import { TestersTab } from "./adminTesters.jsx";
import { AppearanceTab } from "./adminAppearance.jsx";
import { CalibrateTab } from "./adminCalibrate.jsx";
import { ReadinessTab } from "./adminReadiness.jsx";
import { QuestionBankTab } from "./adminQuestions.jsx";
import { ProfileReportsTab } from "./adminReports.jsx";
import { CompanyRecordsTab } from "./adminCompanyRecords.jsx";   // A142
import { NetworkTab } from "./adminNetwork.jsx";   // D180 P1
import { RunsTab } from "./adminRuns.jsx";   // (A)-2
import { Phase1Tab } from "./adminPhase1.jsx";
import { DiagnosticsTab, BackgroundJobsSection, PostingArchiveSection, HirebaseSection, HirebaseFeedSection } from "./adminDiagnostics.jsx";
import { PeopleUsers, SupportQueue } from "./adminPeople.jsx";
import { TYPE } from "../styles/type.js";
// ⭐ D197 #21 M5 (47m): the frame's plate pieces (the area nav, the binder tabs, the kicker, the page title)
import { AreaNav } from "../plate/Shell.jsx";
import { BinderTabs, PageTitle } from "../plate/Plates.jsx";
import { Kickers } from "../plate/Marks.jsx";
import StatCard from "../components/StatCard.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// The orange is 2.96:1 on the paper: a FILL only. Text, edges and strokes use the
// darker ink twin (4.5:1+), the rule UI step 2 set for the logo orange.
const ADMIN_ACCENT_TEXT = C.ACCENT_INK;
// ⭐ D197 #21 (47m): the area nav's icon for each group
const GROUP_ICON = { today: "needs", board: "list", people: "network", data: "library", system: "filters" };

function displayEventSubtype(value) {
  if (value === "CUSTOM_SAMPLER" || value === "A_PLUS") return "A+";
  if (value === "TAILORED" || value === "GENERATE") return "Generate";
  return value;
}

// The raw ledger's columns. The fourth is the call's RESULT — success / error_text from usage_events —
// placed beside the action rather than last, so a failure is visible without scrolling the table.
const LEDGER_COLS = "150px 120px 130px minmax(170px, 1.4fr) 140px repeat(4, 76px) 68px 84px";
// success is NOT NULL DEFAULT 1, so only an explicit 0 is a failure; an absent field (an older
// response shape) is not reported as one.
export const callFailed = (call) => call?.success === 0 || call?.success === false;

// ── DateRange presets ─────────────────────────────────────────
function DateRange({ from, to, onFromChange, onToChange }) {
  const { theme } = useTheme();
  const presets = [
    { label: "Today",    days: 1 },
    { label: "7 days",   days: 7 },
    { label: "30 days",  days: 30 },
    { label: "90 days",  days: 90 },
    { label: "All time", days: 3650 },
  ];
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
      {presets.map(p => {
        const pFrom = Math.floor(Date.now()/1000) - p.days * 86400;
        const active = Math.abs(from - pFrom) < 86401;
        return (
          <button className="pl-btn" key={p.label} onClick={() => { onFromChange(pFrom); onToChange(Math.floor(Date.now()/1000) + 86400); }}
            style={{
              padding:"4px 12px", border:`1px solid ${active ? theme.accent : theme.border}`,
              background: active ? theme.accent : "transparent", color: active ? C.ON_ACCENT : theme.text,
              fontSize:ts(11), fontWeight:700, cursor:"pointer",
            }}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ── MiniLineChart ─────────────────────────────────────────────
function MiniLineChart({ data, width=300, height=80, color=C.VIOLET }) {
  const { theme } = useTheme();
  if (!data || data.length < 2) return (
    <div style={{ width, height, display:"flex", alignItems:"center", justifyContent:"center",
                  color:theme.textDim, fontSize:ts(11) }}>No data</div>
  );
  const values = data.map(d => d.value);
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;
  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((d.value - minV) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} style={{ overflow:"visible" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={pts[pts.length-1].split(",")[0]} cy={pts[pts.length-1].split(",")[1]} r={3} fill={color}/>
    </svg>
  );
}

// ── MiniBarChart ──────────────────────────────────────────────
function MiniBarChart({ data, width=300, height=80, color=C.VIOLET }) {
  const { theme } = useTheme();
  if (!data || data.length === 0) return (
    <div style={{ width, height, display:"flex", alignItems:"center", justifyContent:"center",
                  color:theme.textDim, fontSize:ts(11) }}>No data</div>
  );
  const maxV = Math.max(...data.map(d => d.value), 1);
  const pad = 4;
  const barW = Math.max(4, (width - pad * 2) / data.length - 2);
  return (
    <svg width={width} height={height}>
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / maxV) * (height - pad * 2));
        const x = pad + i * ((width - pad*2) / data.length);
        return (
          <rect key={i} x={x} y={height - pad - bh} width={barW} height={bh}
            fill={color} rx={2} opacity={0.85}/>
        );
      })}
    </svg>
  );
}

// ── StatCard ──────────────────────────────────────────────────
// A93: StatCard is components/StatCard.jsx — AdminPanel and the DB inspector drew the same card.

// ── UsageTab ──────────────────────────────────────────────────
function UsageTab({ theme }) {
  const [from, setFrom] = useState(Math.floor(Date.now()/1000) - 30*86400);
  const [to,   setTo]   = useState(Math.floor(Date.now()/1000) + 86400);
  const [overview, setOverview] = useState(null);
  const [timeseries, setTimeseries] = useState({});
  const [modelCalls, setModelCalls] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tsResumes, tsCost, calls] = await Promise.all([
        api(`/api/admin/analytics/overview?from=${from}&to=${to}`),
        api(`/api/admin/analytics/timeseries?from=${from}&to=${to}&metric=resumes&granularity=day`),
        api(`/api/admin/analytics/timeseries?from=${from}&to=${to}&metric=cost&granularity=day`),
        api(`/api/admin/analytics/model-calls?from=${from}&to=${to}&pageSize=40`),
      ]);
      setOverview(ov);
      setTimeseries({ resumes: tsResumes, cost: tsCost });
      setModelCalls(calls.rows || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && !overview) return (
    <div style={{ padding:32, textAlign:"center", color:theme.textMuted }}>Loading…</div>
  );
  if (!overview) return null;

  const fmtNum = n => n == null ? "—" : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}k` : String(Math.round(n));
  const fmtUsd = n => n == null ? "—" : `$${Number(n).toFixed(4)}`;
  const fmtPct = n => n == null ? "—" : `${(n*100).toFixed(1)}%`;

  const fmtDate = ts => ts ? new Date(ts*1000).toLocaleString() : "-";
  const shortModel = model => (model || "-").replace("claude-", "").replace("-20250514", "").replace("-20251001", "");

  const failedCalls = modelCalls.filter(callFailed).length;

  return (
    <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:20 }}>
      <DateRange from={from} to={to} onFromChange={setFrom} onToChange={setTo}/>

      {/* Stat cards */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <StatCard label="Active Users" value={overview.activeUsers} sub={`of ${overview.totalUsers} total`} theme={theme}/>
        <StatCard label="Resumes Generated" value={overview.totalResumes}
          sub={overview.avgAtsImprovement != null ? `▲${overview.avgAtsImprovement.toFixed(1)} pts ATS avg` : null}
          theme={theme} color={theme.accent}/>
        {/* Was "Jobs Scraped", read from scrape_events — unwritten since cleanup 5.8, so a permanent 0.
            Now the shared crawl: postings first seen in the range, and the crawl runs behind them. */}
        <StatCard label="Postings Discovered"
          value={overview.postingsDiscovered == null ? "—" : fmtNum(overview.postingsDiscovered)}
          sub={overview.crawlRuns == null ? "no pipeline_runs table"
            : `${overview.crawlRuns} crawl runs${overview.crawlRunsFailed ? ` · ${overview.crawlRunsFailed} failed` : ""}`}
          theme={theme}/>
        {/* D83 audit #16: the token, cost and cache tiles are RETIRED here — Today → Costs & quotas holds the figures. */}
        <StatCard label="Avg ATS Δ"
          value={overview.avgAtsImprovement != null ? `+${overview.avgAtsImprovement.toFixed(1)}` : "—"}
          sub={overview.avgAtsScoreBefore != null ? `${overview.avgAtsScoreBefore?.toFixed(0)} → ${overview.avgAtsScoreAfter?.toFixed(0)}` : null}
          theme={theme} color={theme.accent}/>
      </div>

      {/* Charts */}
      <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:280, background:theme.surface, border:`1px solid ${theme.border}`,
                      borderRadius:12, padding:16 }}>
          <div style={{ fontSize:ts(12), fontWeight:700, marginBottom:12, color:theme.text }}>Resumes Generated</div>
          <MiniLineChart data={timeseries.resumes || []} width={300} height={90} color={theme.accent}/>
        </div>
        <div style={{ flex:1, minWidth:280, background:theme.surface, border:`1px solid ${theme.border}`,
                      borderRadius:12, padding:16 }}>
          <div style={{ fontSize:ts(12), fontWeight:700, marginBottom:12, color:theme.text }}>API Cost (USD/day)</div>
          <MiniBarChart data={timeseries.cost || []} width={300} height={90} color={C.DANGER}/>
        </div>
      </div>

      {/* Top event types */}
      {overview.topEventTypes?.length > 0 && (
        <div style={{ background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:ts(12), fontWeight:700, marginBottom:12, color:theme.text }}>Event Breakdown</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {overview.topEventTypes.map(ev => (
              <div key={ev.event_type} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:160, fontSize:ts(12), color:theme.text }}>{ev.event_type}</div>
                <div style={{ flex:1, height:6, background:theme.surfaceHigh, borderRadius:2 }}>
                  <div style={{ height:6, borderRadius:2, background:theme.accent,
                                width: `${Math.min(100, (ev.count / (overview.topEventTypes[0]?.count||1))*100)}%` }}/>
                </div>
                <div style={{ width:50, textAlign:"right", fontSize:ts(12), color:theme.textMuted }}>{ev.count}</div>
                <div style={{ width:70, textAlign:"right", fontSize:ts(11), color:C.DANGER }}>{fmtUsd(ev.cost)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {overview.actionCosts?.length > 0 && (
        <div style={{ background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:12, padding:16 }}>
          <div style={{ fontSize:ts(12), fontWeight:700, marginBottom:12, color:theme.text }}>Cost by Generation Action</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {overview.actionCosts.map((row, idx) => {
              const subtypeLabel = displayEventSubtype(row.event_subtype);
              const label = subtypeLabel ? `${row.event_type} / ${subtypeLabel}` : row.event_type;
              const maxCost = overview.actionCosts[0]?.cost || 1;
              const totalTokens = (row.input_tokens || 0) + (row.output_tokens || 0)
                + (row.cache_read_tokens || 0) + (row.cache_creation_tokens || 0);
              return (
                <div key={`${row.event_type}-${row.event_subtype}-${idx}`} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:220, fontSize:ts(12), color:theme.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {label}
                  </div>
                  <div style={{ flex:1, height:7, background:theme.surfaceHigh, borderRadius:2 }}>
                    <div style={{ height:7, borderRadius:2, background:C.DANGER,
                                  width: `${Math.min(100, (row.cost / maxCost) * 100)}%` }}/>
                  </div>
                  <div style={{ width:55, textAlign:"right", fontSize:ts(11), color:theme.textMuted }}>{row.calls} calls</div>
                  <div style={{ width:80, textAlign:"right", fontSize:ts(11), color:theme.textMuted }}>{fmtNum(totalTokens)} tok</div>
                  <div style={{ width:76, textAlign:"right", fontSize:ts(11), color:C.DANGER }}>{fmtUsd(row.cost)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${theme.border}` }}>
          <div style={{ fontSize:ts(12), fontWeight:700, color:theme.text }}>Generation / Model Call Usage</div>
          <div style={{ fontSize:ts(11), color:theme.textMuted, marginTop:3 }}>
            Most recent tracked model calls. Cache state is derived from stored token fields.
            {/* A50: success / error_text were returned by the route and never drawn, so a run of
                failing calls (the Groq 404 outage) read as an ordinary list of $0 rows. */}
            {failedCalls > 0 && (
              <span style={{ color:C.DANGER, fontWeight:700 }}>
                {" "}{failedCalls} of {modelCalls.length} shown FAILED.
              </span>
            )}
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <div style={{ minWidth:1120 }}>
            <div style={{
              display:"grid",
              gridTemplateColumns:LEDGER_COLS,
              gap:8, padding:"9px 14px", background:theme.surfaceHigh,
              fontSize:ts(10), fontWeight:700, textTransform:"uppercase",
              letterSpacing:"0.06em", color:theme.textMuted,
            }}>
              <div>Time</div><div>User</div><div>Action</div><div>Result</div><div>Model</div>
              <div>Input</div><div>Output</div><div>Cache Read</div><div>Cache Create</div>
              <div>Cache</div><div>Cost</div>
            </div>
            {modelCalls.length === 0 ? (
              <div style={{ padding:"18px 16px", fontSize:ts(12), color:theme.textMuted }}>
                No tracked model calls in this date range.
              </div>
            ) : modelCalls.map(call => (
              <div key={call.id} style={{
                display:"grid",
                gridTemplateColumns:LEDGER_COLS,
                gap:8, padding:"9px 14px", borderTop:`1px solid ${theme.border}`,
                fontSize:ts(11), alignItems:"center", color:theme.textMuted,
                background: callFailed(call) ? C.DANGER_QUIET : "transparent",
              }}>
                <div>{fmtDate(call.created_at)}</div>
                <div style={{ color:theme.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {call.username}
                </div>
                <div style={{ color:theme.text }}>{displayEventSubtype(call.event_subtype) || call.event_type}</div>
                {callFailed(call) ? (
                  <div style={{ color:C.DANGER, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis",
                                whiteSpace:"nowrap" }} title={call.error_text || "failed (no error text recorded)"}>
                    FAILED · {call.error_text || "no error text recorded"}
                  </div>
                ) : (
                  <div style={{ color:C.SUCCESS, fontWeight:700 }}>ok</div>
                )}
                <div title={call.model || ""}>{shortModel(call.model)}</div>
                <div>{fmtNum(call.input_tokens || 0)}</div>
                <div>{fmtNum(call.output_tokens || 0)}</div>
                <div>{fmtNum(call.cache_read_tokens || 0)}</div>
                <div>{fmtNum(call.cache_creation_tokens || 0)}</div>
                <div style={{
                  color: call.cache_state === "warm" || call.cache_state === "partial" ? C.SUCCESS
                    : call.cache_state === "cold_write" ? C.WARNING : theme.textMuted,
                  fontWeight:700,
                }}>
                  {call.cache_state || (call.cached ? "warm" : "cold")}
                </div>
                <div style={{ color:C.DANGER }}>{fmtUsd(call.cost_usd || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// D83 audit #17 + D88 (39d): the per-user analytics table (UsersTab) is RETIRED — its Limits editor and the A+ override
// live on a person's page (panels/adminPeople.jsx), and its token / cost columns are Today → Costs & quotas.

// D83 audit #18: the Cache tab is RETIRED — it measured the prompt cache of draft's own model calls, and since D17
// draft makes none (generation is the tools service's; its cache figures are in Today → Costs & quotas).

function ContactMessagesSection({ theme }) {
  const [messages, setMessages]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [expanded, setExpanded]   = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api(`/api/admin/contact-messages${unreadOnly ? "?unread=1" : ""}`);
      setMessages(Array.isArray(rows) ? rows : []);
    } catch {}
    setLoading(false);
  }, [unreadOnly]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const markRead = async (id) => {
    try {
      await api(`/api/admin/contact-messages/${id}/read`, { method: "PATCH" });
      setMessages(ms => ms.map(m => m.id === id ? { ...m, read: 1 } : m));
    } catch {}
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div style={{ marginBottom: 40 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: ts(14), fontWeight: 800, color: ADMIN_ACCENT_TEXT, margin: 0,
                      letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Contact Messages
        </h2>
        {unreadCount > 0 && (
          <span style={{ background: theme.danger, color: "var(--c-surface-solid)", fontSize: ts(11),
                          fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
            {unreadCount} unread
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: ts(12), color: theme.textMuted, display: "flex",
                           gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={unreadOnly}
              onChange={e => setUnreadOnly(e.target.checked)}/>
            Unread only
          </label>
          <button className="pl-btn" onClick={loadMessages}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`,
                     borderRadius: 16, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: theme.textDim, fontSize: ts(13) }}>
            Loading…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: theme.textDim, fontSize: ts(13) }}>
            No messages yet.
          </div>
        ) : (
          <div className="pl-gazetteer pl-gazetteer--dense"><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Email", "Subject", "Preview", "Date", ""].map(h => (
                  <th key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {messages.map(m => (
                <>
                  <tr key={m.id}
                    style={{ borderBottom: `1px solid ${theme.border}`,
                               background: expanded === m.id ? theme.surfaceHigh : "transparent",
                               cursor: "pointer",
                               opacity: m.read ? 0.65 : 1 }}
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                    <td style={{ padding: "10px 14px", fontSize: ts(13), color: theme.text,
                                  fontWeight: m.read ? 400 : 700 }}>
                      {m.name}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: ts(12), color: theme.textMuted }}>
                      {m.email}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: ts(12), color: theme.textMuted }}>
                      {m.subject || "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: ts(12), color: theme.textDim,
                                  maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis",
                                  whiteSpace: "nowrap" }}>
                      {m.message.slice(0, 80)}{m.message.length > 80 ? "…" : ""}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: ts(11), color: theme.textDim,
                                  whiteSpace: "nowrap" }}>
                      {new Date(m.created_at * 1000).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {!m.read && (
                        <button className="pl-btn"
                          onClick={e => { e.stopPropagation(); markRead(m.id); }}
                          style={{ whiteSpace: "nowrap" }}>
                          Mark read
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === m.id && (
                    <tr key={`exp-${m.id}`} style={{ background: theme.surfaceHigh }}>
                      <td colSpan={6} style={{ padding: "16px 20px" }}>
                        <div style={{ fontSize: ts(13), color: theme.textMuted,
                                       lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                          {m.message}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// The `system` account (id 0, migration 075) is not a person: every background usage record hangs off
// it. No Delete and no plan control are offered for it — and the server refuses both anyway (A58).
export const isSystemAccount = (u) => u?.id === 0 || u?.username === "system";

// A58 (a): deleting a user shows what goes with them — rows per table, from the server — and is armed
// only by typing their username back. The server re-checks the username; this is not the only lock.
function DeleteUserDialog({ preview, onCancel, onDeleted }) {
  const { theme } = useTheme();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const armed = typed === preview.confirmWith && !busy;
  const rows = Object.entries(preview.counts || {}).sort((a, b) => b[1] - a[1]);
  const doDelete = async () => {
    setBusy(true); setErr("");
    try {
      await api(`/api/admin/users/${preview.user.id}`, {
        method:"DELETE", body:JSON.stringify({ confirmUsername: typed }),
      });
      onDeleted(preview.user.id);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex",
                  alignItems:"center", justifyContent:"center", background:C.SCRIM }}
      onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div role="dialog" aria-label={`Delete ${preview.user.username}`}
        style={{ background:theme.surface, borderRadius:16, padding:24, maxWidth:460, width:"90%",
                 maxHeight:"80vh", overflowY:"auto", border:`1px solid ${theme.danger}55` }}>
        <div style={{ fontSize:ts(16), fontWeight:800, marginBottom:8, color:theme.danger }}>
          Delete {preview.user.username}?
        </div>
        <div style={{ fontSize:ts(12), color:theme.textMuted, lineHeight:1.6, marginBottom:12 }}>
          This permanently removes the account and {preview.totalRows.toLocaleString()} row(s) of their data,
          their screenshots and picture, and signs out every session. It cannot be undone.
        </div>
        {rows.length > 0 ? (
          <div className="pl-gazetteer pl-gazetteer--dense"><table style={{ width:"100%", borderCollapse:"collapse", fontSize:ts(12), marginBottom:14 }}>
            <tbody>
              {rows.map(([t, n]) => (
                <tr key={t} style={{ borderBottom:`1px solid ${theme.border}` }}>
                  <td style={{ padding:"4px 6px", color:theme.textMuted, fontFamily:"monospace" }}>{t}</td>
                  <td style={{ padding:"4px 6px", color:theme.text, textAlign:"right", fontWeight:700 }}>{n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <div style={{ fontSize:ts(12), color:theme.textMuted, marginBottom:14 }}>No rows outside the account itself.</div>
        )}
        <label style={{ fontSize:ts(11), fontWeight:700, color:theme.textMuted }}>
          Type <span style={{ fontFamily:"monospace", color:theme.text }}>{preview.confirmWith}</span> to confirm
          <input value={typed} onChange={e => setTyped(e.target.value)} autoFocus
            style={{ display:"block", marginTop:4, height:34, padding:"0 10px", borderRadius:8, width:"100%",
                     boxSizing:"border-box", border:`1px solid ${theme.border}`, background:theme.surface,
                     color:theme.text, fontSize:ts(12) }}/>
        </label>
        {err && <div style={{ marginTop:8, fontSize:ts(12), color:theme.danger }}>{err}</div>}
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button className="pl-btn" onClick={onCancel} disabled={busy}
            style={{ flex:1, padding:"9px 0", border:`1px solid ${theme.border}`,
                     background:"transparent", color:theme.text, fontWeight:700, fontSize:ts(13), cursor:"pointer" }}>
            Cancel
          </button>
          <button className="pl-btn" onClick={doDelete} disabled={!armed}
            style={{ flex:2, padding:"9px 0", border:"none", background:theme.danger,
                     color:C.ON_ACCENT, fontWeight:800, fontSize:ts(13), cursor:armed ? "pointer" : "not-allowed",
                     opacity:armed ? 1 : 0.45 }}>
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const { theme } = useTheme();
  const [users,    setUsers]    = useState([]);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [profileRequests, setProfileRequests] = useState([]);
  const [newU,     setNewU]     = useState({ username:"", password:"" });
  const [status,   setStatus]   = useState("");

  // ⭐ D83 · THE MAP — five groups, each answering one question; a group holds the panels that answer it
  // (adminMap.js). The glance still opens first (A50 step 3): "is the system healthy right now?" needs no click.
  // The place is kept in the URL (?g=&s=) so a link and a reload land on the same panel.
  const [place, setPlace] = useState(() => readAdminPlace(typeof window !== "undefined" ? window.location.search : ""));
  const go = (g, s) => { const p = writeAdminPlace(g, s); setPlace(p);
    try { window.history.replaceState(null, "", `${window.location.pathname}?g=${p.g}&s=${p.s}`); } catch { /* no history */ } };
  const at = (g, s) => place.g === g && place.s === s;
  const openPerson = (id) => { setPlace(writeAdminPlace("people", "users"));
    try { window.history.replaceState(null, "", `${window.location.pathname}?g=people&s=users&u=${id}`); } catch { /* no history */ } };
  const group = ADMIN_GROUPS.find(x => x.id === place.g) || ADMIN_GROUPS[0];

  useEffect(() => { loadUsers(); loadUpgradeRequests(); loadProfileRequests(); }, []);

  const loadUsers   = () => api("/api/admin/users").then(setUsers).catch(() => {});
  const loadUpgradeRequests = () => api("/api/admin/upgrade-requests").then(setUpgradeRequests).catch(() => {});
  const loadProfileRequests = () => api("/api/admin/domain-profile-requests").then(setProfileRequests).catch(() => {});

  const createUser = async e => {
    e.preventDefault();
    try {
      await api("/api/admin/users", { method:"POST", body:JSON.stringify(newU) });
      setNewU({ username:"", password:"" });
      setStatus("✓ User created");
      loadUsers();
    } catch(e2) { setStatus("✗ " + e2.message); }
    setTimeout(() => setStatus(""), 3000);
  };

  // Opens the preview; the delete itself is DeleteUserDialog's, behind the typed username.
  const [deletePreview, setDeletePreview] = useState(null);
  const deleteUser = async id => {
    try { setDeletePreview(await api(`/api/admin/users/${id}/delete-preview`)); }
    catch (e) { alert("Cannot delete: " + e.message); }
  };
  // D88: a delete refreshes the People list and returns to it.
  const [peopleKey, setPeopleKey] = useState(0);
  const onUserDeleted = id => {
    setDeletePreview(null);
    setUsers(u => u.filter(x => x.id !== id));
    try { const qs = new URLSearchParams(window.location.search); qs.delete("u"); window.history.replaceState(null, "", `${window.location.pathname}?${qs}`); } catch { /* no history */ }
    setPeopleKey(k => k + 1);
  };

  const grantUpgradeRequest = async (id) => {
    await api(`/api/admin/upgrade-requests/${id}/grant`, { method:"PATCH" });
    loadUsers();
    loadUpgradeRequests();
  };

  const updateProfileRequestStatus = async (id, status) => {
    await api(`/api/admin/domain-profile-requests/${id}/status`, {
      method:"PATCH",
      body:JSON.stringify({ status }),
    });
    loadProfileRequests();
  };

  return (
    <div data-admin-page="" style={{ overflowY:"auto", height:"100%", boxSizing:"border-box",
                  // ⭐ 46q FULL WIDTH (owner 11-16): the full width with the page gutter (was a centred 1200, 10-02).
                  width:"100%" }}>

      {deletePreview && (
        <DeleteUserDialog preview={deletePreview}
          onCancel={() => setDeletePreview(null)} onDeleted={onUserDeleted}/>
      )}

      {/* ⭐ D197 Wave 2 #21 · M5 (47m) — THE FRAME IN THE PLATE (docs/revamp/admin.md, the mock platePages/Admin.jsx): the five
          groups are the area nav's views (the DB inspector in its More), the group's question the kicker, the disk banner a
          ticket above the tabs, the group's sections the binder tabs. The place in the URL is unchanged (adminMap.js). */}
      <div style={{ padding: "12px var(--page-gutter) 0" }}>{/* D163: the nav inside the page gutter, never flush to the edge */}
      <AreaNav area="Admin" views={ADMIN_GROUPS.map(g => ({ id: g.id, label: g.label, href: `/admin?g=${g.id}`, icon: GROUP_ICON[g.id] || "list" }))}
        current={place.g} more={[{ id: "db", label: "Database inspector", href: "/admin/db" }]}
        onGo={(id, href) => { if (id === "db") window.location.assign(href); else go(id); }}/>
      </div>
      <div style={{ padding:"20px var(--page-gutter) 72px", boxSizing:"border-box", display:"flex", flexDirection:"column", gap:14 }}>
      <Kickers parts={[`ADMIN · ${group.label.toUpperCase()}`, group.question.toUpperCase()]}/>
      <PageTitle as="h1">{group.label}</PageTitle>

      {/* ⛔ D77: the disk banner — every admin tab, while the volume is amber or red. */}
      <DiskBanner/>

      <BinderTabs label={group.label} idBase="pl-admin" tabs={group.sections.map(([id, label]) => ({ id, label }))} selected={place.s}
        onSelect={(id) => go(group.id, id)}>
      <div data-admin-sections="" style={{ display:"flex", flexDirection:"column", gap:14, paddingTop:14, minWidth:0 }}>
      <AdminSection.Provider value={group.sections.find(([id]) => id === place.s)?.[1] || ""}>

      {/* Today — what needs me? */}
      {at("today", "glance") && <GlanceTab theme={theme}/>}
      {at("today", "deploys") && <DeploymentsPanel theme={theme}/>}
      {/* D83 audit #4 + #15b: the volume and its backups, one panel. */}
      {at("today", "disk") && <DiskPanel theme={theme}/>}
      {/* Cost visibility (owner, 10-09): résumé economics are the admin's alone; the ledger's spend in the same panel. */}
      {at("today", "costs") && <CostsTab theme={theme}/>}
      {at("today", "activity") && <UsageTab theme={theme}/>}

      {/* The board — what is on it, and why? */}
      {at("board", "companies") && <CompaniesSection theme={theme}/>}
      {at("board", "scope") && <BoardPolicySection theme={theme}/>}
      {/* D75 STEP 0b: the crawler's control panel — the switches live in draft's database, no redeploy. */}
      {at("board", "crawler") && <CrawlerTab theme={theme}/>}
      {at("board", "harvest") && <SlugHarvestSection theme={theme}/>}
      {/* D83: the enrichment round trip as one page of six steps — numbers on open, Undo on every import. */}
      {at("board", "enrichment") && <EnrichmentTab/>}

      {/* People — who is using it? */}
      {/* D88 P3: the support queue; a ticket links to the person's page. */}
      {at("people", "support") && <SupportQueue theme={theme} onOpenPerson={openPerson}/>}
      {at("people", "messages") && <ContactMessagesSection theme={theme}/>}
      {at("people", "alerts") && <MatchAlertsSection theme={theme}/>}
      {/* D151 Rule 6: the server's health without shell access. */}
      {at("system", "diagnostics") && <><DiagnosticsTab/><BackgroundJobsSection/><PostingArchiveSection/><HirebaseSection/><HirebaseFeedSection/></>}
      {/* D150 T16: the Phase 1 milestones, measured. */}
      {at("today", "outcomes") && <OutcomesSection theme={theme}/>}
      {at("today", "phase1") && <Phase1Tab/>}
      {/* D183: the public profiles' report queue. */}
      {at("people", "network") && <NetworkTab/>}
      {at("system", "runs") && <RunsTab/>}
      {at("people", "reports") && <ProfileReportsTab/>}
      {at("board", "records") && <CompanyRecordsTab/>}
      {/* D131: Testers — the readable page on top; both surveys and People & questions folded beneath it (the D124
          trial's own tables went with the trial, 11-07). */}
      {at("people", "testers") && <>
        <TestersTab/>
        <details data-admin-testers-details="" style={{ marginTop: 28 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, marginBottom: 12 }}>Details: both surveys, people and what they asked</summary>
          <TesterDetails/>
        </details>
      </>}

      {/* Data — what is stored? */}
      {at("data", "jobdata") && <JobDataSection theme={theme}/>}
      {at("data", "scoring") && <BoardFitSection theme={theme}/>}
      {/* D125: the owner calibrates the ATS by hand — the gold set the scorer is held to. */}
      {at("data", "calibrate") && <CalibrateTab/>}
      {/* D142: the readiness bank — nothing reaches a user until a person approves it. */}
      {at("data", "readiness") && <ReadinessTab/>}
      {/* D150 T02: the question bank's review desk — the only way an item becomes live. */}
      {at("data", "questions") && <QuestionBankTab/>}
      {at("data", "database") && (
        <div className="rm-card" data-admin-database="" style={{ maxWidth:640 }}>
          <div style={{ fontWeight:700, fontSize:ts(14), color:theme.text, marginBottom:8 }}>The database, read-only</div>
          <div style={{ fontSize:ts(13), color:theme.textMuted, marginBottom:12 }}>
            Pipeline health, the schema, any table's rows, one posting's path, a user's pool and a read-only query — on their own page.
          </div>
          <a href="/admin/db" className="pl-btn">Open the database inspector →</a>
        </div>
      )}

      {/* D105 P4: the Atlas's nodes — every page starts a draft; publishing here is what makes /atlas/<slug> public. */}
      {at("data", "atlas") && <><AtlasTab/><AtlasBacklogSection/><AtlasCompeteSection/></>}

      {/* System — is it set up right? */}
      {at("system", "switches") && <><KillSwitchSection theme={theme}/><FullAutoPrerequisitesSection theme={theme}/><QuickChecksSection theme={theme}/><SubmitOutcomesSection theme={theme}/><TailoringAdminSection theme={theme}/><PluginTab theme={theme}/></>}
      {at("system", "tools") && <ToolsServiceSection theme={theme}/>}
      {at("system", "usage") && <><ModelUsageTab/><ModelGatewaySection/><FlagsSection/></>}

          <AnimatePresence mode="wait">
            {at("people", "users") && (
              <motion.div key="users"
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>

                {upgradeRequests.filter(r => r.status === "pending").length > 0 && (
                  <div className="rm-card" style={{ marginBottom:24 }}>
                    <div style={{ fontWeight:700, fontSize:ts(14), color:theme.text, marginBottom:12 }}>
                      Pending Upgrade Requests
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {upgradeRequests.filter(r => r.status === "pending").map(r => (
                        <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10,
                                                 padding:"8px 10px", border:`1px solid ${theme.border}`,
                                                 borderRadius:8 }}>
                          <span style={{ flex:1, fontSize:ts(12) }}>
                            <strong>{r.username}</strong> requests {r.requested_tier}
                          </span>
                          <button className="pl-btn pl-btn--primary"
                            onClick={() => grantUpgradeRequest(r.id)}>
                            Grant
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {profileRequests.filter(r => r.status === "pending").length > 0 && (
                  <div className="rm-card" style={{ marginBottom:24 }}>
                    <div style={{ fontWeight:700, fontSize:ts(14), color:theme.text, marginBottom:12 }}>
                      Other Job Profile Requests
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {profileRequests.filter(r => r.status === "pending").map(r => (
                        <div key={r.id} style={{ display:"flex", alignItems:"flex-start", gap:10,
                                                 padding:"10px", border:`1px solid ${theme.border}`,
                                                 borderRadius:8 }}>
                          <span style={{ flex:1, fontSize:ts(12), color:theme.textMuted, lineHeight:1.5 }}>
                            <strong style={{ color:theme.text }}>{r.username}</strong> requests{" "}
                            <strong style={{ color:theme.text }}>{r.desired_title}</strong>
                            {r.role_family ? ` (${r.role_family})` : ""}
                            {(r.target_titles || []).length > 0 && (
                              <span> - aliases: {(r.target_titles || []).slice(0, 4).join(", ")}</span>
                            )}
                            {(r.skills || []).length > 0 && (
                              <span> - skills: {(r.skills || []).slice(0, 4).join(", ")}</span>
                            )}
                            {r.notes ? <span> - note: {r.notes}</span> : null}
                          </span>
                          <button className="pl-btn"
                            onClick={() => updateProfileRequestStatus(r.id, "reviewing")}>
                            Review
                          </button>
                          <button className="pl-btn pl-btn--primary"
                            onClick={() => updateProfileRequestStatus(r.id, "resolved")}>
                            Resolve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* ⭐ D88 P2 + P4: the list, and a person's page made of modules (panels/adminPeople.jsx). */}
                <PeopleUsers theme={theme} onDelete={deleteUser} reloadKey={peopleKey}/>
                <div style={{ marginTop:24 }}/>
                {/* Add an account — a utility, below the list */}
                <div className="rm-card" style={{ marginBottom:24, maxWidth:440 }}>
                  <div style={{ fontWeight:700, fontSize:ts(14), color:theme.text, marginBottom:16 }}>
                    Create User
                  </div>
                  <form onSubmit={createUser} style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <input className="rm-input" value={newU.username}
                      onChange={e => setNewU(u => ({ ...u, username:e.target.value }))}
                      placeholder="Username"/>
                    <input className="rm-input" type="password" value={newU.password}
                      onChange={e => setNewU(u => ({ ...u, password:e.target.value }))}
                      placeholder="Password (min 8 chars)"/>
                    <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:4 }}>
                      <button type="submit" className="pl-btn pl-btn--primary">
                        Create
                      </button>
                      {status && (
                        <span style={{ fontSize:ts(12),
                          color:status.startsWith("✓") ? theme.success : theme.danger }}>
                          {status}
                        </span>
                      )}
                    </div>
                  </form>
                </div>

                {/* ⭐ D86 §6: the connector directory's reviewer account — create and Reset demo account. */}
                <ReviewerAccount theme={theme}/>
              </motion.div>
            )}

            {/* ⭐ D73 §B: policy, terms and service notices — dry run, ceiling, test-to-me. */}
            {at("system", "notices") && (
              <motion.div key="notices"
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>
                <NoticesTab theme={theme}/>
              </motion.div>
            )}

            {/* ⭐ D94: Email health — is draft's email getting out (Resend's failed sends, suppressions, domain). */}
            {at("system", "email") && (
              <motion.div key="email"
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>
                <EmailHealthTab/>
              </motion.div>
            )}

            {/* ⛔ D95: Admins — the admin ACCOUNTS (never users): add, disable, last sign-in. Owner only. */}
            {at("system", "admins") && (
              <motion.div key="admins"
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>
                <AdminsTab/>
              </motion.div>
            )}

            {/* ⭐ D133: Appearance — the Studio theme per surface (the Admin pages' look; offered to users or not). */}
            {at("system", "appearance") && (
              <motion.div key="appearance"
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>
                <AppearanceTab/>
              </motion.div>
            )}
          </AnimatePresence>
      </AdminSection.Provider>
      </div>
      </BinderTabs>
      </div>
    </div>
  );
}

// ⭐ ADMIN → PEOPLE → TESTERS, the details beneath the readable page (adminTesters.jsx): both surveys side by side, and
// People & questions. Moved here from the D124 Admin → Trial panel when the trial was removed (11-07, owner) — the
// trial's own tables (its funnel, the tour's analytics, the own-résumé switch, exclusive access) went with it; the
// research over what testers already gave stays. ⛔ 44b (owner 11-02): People & questions shows each tester's name,
// email and what they wrote, so their questions can be answered (services/testerContacts.js). Admin only.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Btn, Panel, row, quiet, sub, field } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const LABELS = {
  yes: "yes", maybe: "maybe", no: "no", now: "now", within_6_months: "within 6 months",
  software: "software", ml_ai: "ML / AI", data: "data", frontend_mobile: "frontend / mobile", infra_devops: "infra / DevOps",
  security: "security", product_other: "product / other", student_new_grad: "student / new grad", "1_3": "1–3 yrs", "4_7": "4–7 yrs", "8_plus": "8+ yrs",
  no_replies: "no replies", too_many_forms: "too many forms", not_eligible: "not eligible", fake_or_stale: "fake or stale postings",
  tailoring: "tailoring résumés", what_to_learn: "knowing what to learn", other: "other",
  matched_board: "matched board", tailored_resume: "tailored résumé", filled_and_sent: "filled and sent", sponsorship_info: "sponsorship info",
  atlas_learning: "Atlas / Learn", inbox: "Inbox", nothing: "nothing", under_10: "under $10", "10_20": "$10–20", over_20: "over $20",
  more_jobs: "more jobs", better_matching: "better matching", faster_tailoring: "faster tailoring", more_sites: "more job sites",
  interview_prep: "interview prep", salary_insights: "salary insights", referrals: "referrals", mobile_app: "mobile app", browser_extension: "browser extension",
  computing: "computing", engineering: "engineering", management: "management", business: "business", science: "science",
  legal: "legal", arts_media: "design / media", sales: "sales", marketing: "marketing",
  picks: "the picks", filters: "the filters", draft_house: "Home", map: "Your map", learn: "Learn", table: "Home (full sheet)",
};

// ⭐ D130 · BOTH SURVEYS — the trial's and the standalone page's (/survey): THE YC NUMBERS over everyone who answered,
// every shared question side by side (trial · standalone · combined), each source's own questions, and the standalone
// export (contact details only with the box ticked). GET /api/admin/survey/sources, /api/admin/survey/export.csv.
const pct = (x) => (x == null ? "—" : `${x}%`);
// Owner 11-01: "the trial analytics … only updating on admin sign in" — each panel fetched once, on mount. Testers are
// live now, so every panel here re-reads every 30 s while the tab is visible, and at once when it comes back into view.
const LIVE_MS = 30_000;
function useLive(load) {
  useEffect(() => {
    load();
    const tick = () => { if (typeof document === "undefined" || document.visibilityState === "visible") load(); };
    const id = setInterval(tick, LIVE_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [load]);
}
function SurveySources() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [contact, setContact] = useState(false);
  const load = useCallback(() => api("/api/admin/survey/sources").then(setD).catch((e) => setErr(e.message)), []);
  useLive(load);
  if (err) return <Panel title="Both surveys" purpose={err}/>;
  if (!d) return <Panel title="Both surveys" purpose="Loading…"/>;
  const y = d.yc;
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 };
  return (
    <Panel data-admin-surveys="" title="Both surveys"
      purpose="The trial's survey and the standalone one at /survey (no account). The numbers that matter for the application first, then every shared question split by source and combined."
      code="GET /api/admin/survey/sources · /api/admin/survey/export.csv (?contact=1 adds name and email)"
      numbers={[[d.responses.trial, "trial answers"], [d.responses.standalone, "standalone answers"], [d.responses.combined, "in all", true]]}>
      <h3 style={{ margin: "8px 0" }}>The numbers</h3>
      <div style={grid} data-survey-yc="">
        <div style={sub}><b>{y.hoursPerWeek.median ?? "—"} h</b> a week spent applying (median; average {y.hoursPerWeek.average ?? "—"}, n {y.hoursPerWeek.n})</div>
        <div style={sub}><b>{pct(y.paidForHelp.percent)}</b> have paid for job-search help (n {y.paidForHelp.n})</div>
        <div style={sub}><b>{pct(y.betterThanToday.percent)}</b> say draft is much or somewhat better than today (trial, n {y.betterThanToday.n})</div>
        <div style={sub}><b>{pct(y.interested.percent)}</b> interested: as soon as they can or when they start looking (n {y.interested.n})</div>
        <div style={sub}><b>{y.friendsSuggested}</b> friends suggested</div>
        <div style={sub}>Stars, on average: {Object.entries(y.stars).map(([k, v]) => `${k.replace(/^rate_|_/g, " ").trim()} ${v ?? "—"}`).join(" · ")}</div>
      </div>
      <div style={{ ...grid, marginTop: 10 }}>
        <Tally title="What they use today" counts={y.useToday}/>
        <Tally title="Would let a tool send for them" counts={y.trustAutoApply}/>
        <Tally title="What would feel fair to pay" counts={y.pay}/>
        <Tally title="Paid for help, how much" counts={y.paidForHelp.how}/>
        <Tally title="Most frustrating, ranked" counts={Object.fromEntries(y.frustrationRanking)}/>
      </div>
      <h3 style={{ margin: "16px 0 8px" }}>Shared questions: trial · standalone · combined</h3>
      {Object.entries(d.shared).map(([k, v]) => (
        <details key={k} style={{ marginBottom: 6 }} data-survey-shared={k}>
          <summary>{v.question}</summary>
          <div style={{ ...grid, marginTop: 6 }}>
            <Tally title="Trial" counts={v.trial}/><Tally title="Standalone" counts={v.standalone}/><Tally title="Combined" counts={v.combined}/>
          </div>
        </details>
      ))}
      <h3 style={{ margin: "16px 0 8px" }}>Asked in one survey only</h3>
      <div style={grid}>
        {[...Object.entries(d.trialOnly).map(([k, v]) => [k, v, "Trial"]), ...Object.entries(d.standaloneOnly).map(([k, v]) => [k, v, "Standalone"])].map(([k, v, src]) => (
          <Tally key={k} title={`${src}: ${v.question}${v.average != null ? ` (average ${v.average} ★)` : ""}`} counts={v.counts}/>
        ))}
      </div>
      <div style={{ ...row, marginTop: 12 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={contact} onChange={(e) => setContact(e.target.checked)} data-survey-contact=""/> Include name and email
        </label>
        <Btn onClick={() => { window.location.href = `/api/admin/survey/export.csv${contact ? "?contact=1" : ""}`; }}>Download the standalone answers (CSV)</Btn>
        <Btn onClick={load}>Refresh</Btn>
      </div>
    </Panel>
  );
}

function Tally({ title, counts }) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div style={sub}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {entries.length ? entries.map(([k, n]) => <div key={k}>{LABELS[k] || k}: <b>{n}</b></div>) : <span style={quiet}>none yet</span>}
    </div>
  );
}

const when = (s) => (s ? new Date(s * 1000).toLocaleString() : "");

// ── 44b · PEOPLE & QUESTIONS — who each tester is and what they asked (owner 11-02: "a feedback loop … people asking
// questions too"). Name, email, where they are, every dock message and written survey answer; the CSV is the same rows.
const STATUS_TONE = { "survey due": true, "in the trial": false, "survey answered": false, "signed up": false };
function PeopleAndQuestions() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [onlyAsked, setOnlyAsked] = useState(false);
  const load = useCallback(() => api("/api/admin/testers/people").then(setD).catch((e) => setErr(e.message)), []);
  useLive(load);
  if (err) return <Panel title="People & questions" purpose={err}/>;
  if (!d) return <Panel title="People & questions" purpose="Loading…"/>;
  const needle = q.trim().toLowerCase();
  const shown = d.people.filter(p => (!onlyAsked || p.feedback.length || p.written.length)
    && (!needle || [p.name, p.email, ...p.feedback.map(f => f.body), ...p.written.map(w => w.answer)].join(" ").toLowerCase().includes(needle)));
  return (
    <Panel data-admin-testers-people="" title="People & questions"
      purpose="Each tester and survey respondent by name and email, where they are, and everything they wrote to us — so a question can be answered. Accounts tagged test or internal, and admins, are left out."
      code="GET /api/admin/testers/people · /api/admin/testers/people.csv (services/testerContacts.js)"
      numbers={[[d.people.length, "people"], [d.messages, "messages from the dock", d.messages > 0],
                [d.people.filter(p => p.status === "survey due").length, "survey due"], [d.excluded, "left out (test / admin)"]]}>
      {d.retention && <p data-testing-retention="" style={{ fontSize: ts(12.5), color: "var(--color-text-muted)", margin: "0 0 10px" }}>{d.retention.text}</p>}
      <div style={row}>
        <input aria-label="Search names, emails and messages" placeholder="Search names, emails, messages" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, minWidth: 240 }}/>
        <label style={{ ...row, gap: 6 }}><input type="checkbox" checked={onlyAsked} onChange={(e) => setOnlyAsked(e.target.checked)}/> Only people who wrote something</label>
        <Btn onClick={() => { window.location.href = "/api/admin/testers/people.csv"; }}>Download (CSV, with names and emails)</Btn>
      </div>
      <div style={{ marginTop: 12 }}>
        {shown.length ? shown.map((p, i) => (
          <div key={`${p.source}-${p.userId ?? p.email}-${i}`} data-tester-person="" style={{ padding: "10px 0", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ ...row, justifyContent: "space-between" }}>
              <span><b>{p.name || "(no name)"}</b>{" "}
                {p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : <span style={quiet}>(no email)</span>}</span>
              <span style={quiet}>{p.source} · <span style={STATUS_TONE[p.status] ? { fontWeight: 700 } : undefined}>{p.status}</span>
                {p.draftsSent != null ? ` · ${p.draftsSent} sent` : ""}{p.sample ? ` · ${p.sample === "own" ? "own résumé" : `sample ${p.sample}`}` : ""}
                {p.lastActiveAt ? ` · active ${when(p.lastActiveAt)}` : p.surveyAt ? ` · answered ${when(p.surveyAt)}` : ""}</span>
            </div>
            {p.feedback.map((f, k) => (
              <p key={`f${k}`} style={{ margin: "6px 0 0" }}><span style={quiet}>{when(f.at)}{f.screen ? ` · ${f.screen}` : ""} —</span> {f.body}</p>
            ))}
            {p.written.map((w) => (
              <p key={w.key} style={{ margin: "6px 0 0" }}><span style={quiet}>{w.question} —</span> {w.answer}</p>
            ))}
          </div>
        )) : <span style={quiet}>{d.people.length ? "Nobody matches." : "Nobody yet."}</span>}
      </div>
    </Panel>
  );
}

export function TesterDetails() {
  return (
    <>
      <PeopleAndQuestions/>
      <SurveySources/>
    </>
  );
}

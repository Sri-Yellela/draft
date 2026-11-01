// ⭐ D124 · ADMIN → PEOPLE → TRIAL — THE TRIAL IS THE MAIN FRAME (owner 11-01): every account made since migration 205 is a
// trial account unless granted EXCLUSIVE (full) access here. This page is the trial's honest numbers, counts only — the
// funnel, what testers used and how long, what they came for, what the survey said — the access list, and the export of
// the survey's answers WITHOUT emails. No person's content is shown; usernames appear only in the access list.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, row, quiet, sub, field } from "./adminKit.jsx";
import { TOUR_STEPS } from "../../../shared/trialTour.js";

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
  picks: "the picks", filters: "the filters", draft_house: "Draft House", map: "Your map", learn: "Learn", table: "The Table",
  ...Object.fromEntries(TOUR_STEPS.map(x => [x.id, x.title])),
};
const secs = (ms) => (ms == null ? "—" : `${Math.round(ms / 1000)} s`);
const CUTS = ["sample", "field", "device", "speed", "draftsOk"];

// ⭐ D130 · BOTH SURVEYS — the trial's and the standalone page's (/survey): THE YC NUMBERS over everyone who answered,
// every shared question side by side (trial · standalone · combined), each source's own questions, and the standalone
// export (contact details only with the box ticked). GET /api/admin/survey/sources, /api/admin/survey/export.csv.
const pct = (x) => (x == null ? "—" : `${x}%`);
function SurveySources() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [contact, setContact] = useState(false);
  const load = useCallback(() => api("/api/admin/survey/sources").then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
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
        <DepthButton onClick={() => { window.location.href = `/api/admin/survey/export.csv${contact ? "?contact=1" : ""}`; }}>Download the standalone answers (CSV)</DepthButton>
        <DepthButton onClick={load}>Refresh</DepthButton>
      </div>
    </Panel>
  );
}

// ⭐ D129 · THE TOUR'S ANALYTICS — the funnel with each step's median time, where people leave, what they tried, the
// errors they met, each section's usefulness, any answer cut by sample / field / device / speed / drafts, and the CSV.
function TourAnalytics() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState(null);
  const [cut, setCut] = useState({ key: "would_use", by: "sample", out: null });
  const load = useCallback(() => api("/api/admin/trial/analytics").then(setA).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const runCut = async (next) => {
    const c = { ...cut, ...next };
    try { const r = await api(`/api/admin/trial/crosscut?key=${encodeURIComponent(c.key)}&by=${encodeURIComponent(c.by)}`); setCut({ ...c, out: r.cut }); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { runCut({}); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <Panel title="The tour" purpose={err}/>;
  if (!a) return <Panel title="The tour" purpose="Loading…"/>;
  const cellStyle = { padding: "4px 8px", borderTop: "1px solid var(--color-border)" };
  return (
    <Panel data-admin-tour="" title="The tour"
      purpose="Each step of the guided tour: how many reached it, finished it and left there, and the median time it took. Then what testers tried, the errors they met, and the survey cut any way you need."
      code="GET /api/admin/trial/analytics · /crosscut?key=&by= · /export.csv (emails only with ?emails=1)"
      numbers={[[a.testers, "testers"], [a.finished, "finished the tour", true], [secs(a.medianTotalMs), "median time to the survey"]]}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
          <thead><tr>{["Step", "Reached", "Finished", "Left here", "Median time"].map(h => <th key={h} style={{ ...cellStyle, textAlign: "left" }}>{h}</th>)}</tr></thead>
          <tbody>{a.funnel.map(f => (
            <tr key={f.step} data-tour-step={f.step}>
              <td style={cellStyle}>{f.title}</td><td style={cellStyle}>{f.reached}</td><td style={cellStyle}>{f.completed}</td>
              <td style={cellStyle}>{f.abandoned}</td><td style={cellStyle}>{secs(f.medianMs)}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 12 }}>
        <Tally title="Where people left" counts={a.dropOff}/>
        <Tally title="Features tried (testers)" counts={a.interactions}/>
        <Tally title="Errors (step · code)" counts={a.errors}/>
        <div style={sub}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Stars, on average (1–5)</div>
          {Object.entries(a.stars).map(([k, v]) => <div key={k}>{a.questions[k] || k}: <b>{v ?? "—"}</b>{v != null ? " ★" : ""}</div>)}
        </div>
      </div>
      <h3 style={{ margin: "16px 0 8px" }}>Cut an answer</h3>
      <div style={row}>
        <select aria-label="Survey question" value={cut.key} onChange={(e) => runCut({ key: e.target.value })} style={field}>
          {a.cuttable.map(k => <option key={k} value={k}>{a.questions[k] || k}</option>)}
        </select>
        <span>by</span>
        <select aria-label="Cut by" value={cut.by} onChange={(e) => runCut({ by: e.target.value })} style={field}>
          {CUTS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 8 }} data-tour-cut="">
        {cut.out && Object.keys(cut.out).length ? Object.entries(cut.out).map(([g, v]) => (
          v && typeof v.average !== "undefined"
            ? <div key={g} style={sub}><b>{LABELS[g] || g}</b>: average {v.average} (n {v.n})</div>
            : <Tally key={g} title={LABELS[g] || g} counts={v}/>)) : <span style={quiet}>No answers yet.</span>}
      </div>
      <h3 style={{ margin: "16px 0 8px" }}>In their words</h3>
      {Object.keys(a.texts).map(k => (
        <details key={k} style={{ marginBottom: 6 }}>
          <summary>{a.questions[k] || k} ({a.texts[k]?.length || 0})</summary>
          {(a.texts[k] || []).map((x, i) => <p key={i} style={{ margin: "6px 0" }}>{x.text} <span style={quiet}>· {x.sample || "own"}{x.field ? ` · ${x.field}` : ""}</span></p>)}
        </details>
      ))}
      <div style={{ ...row, marginTop: 12 }}>
        <DepthButton onClick={load}>Refresh</DepthButton>
        <DepthButton onClick={() => { window.location.href = "/api/admin/trial/export.csv"; }}>Download CSV (no emails)</DepthButton>
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

export function TrialTab() {
  const [t, setT] = useState(null);
  const [err, setErr] = useState(null);
  const [who, setWho] = useState("");
  const [said, setSaid] = useState("");
  const load = useCallback(() => api("/api/admin/trial").then(setT).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const access = async (target, level) => {
    try {
      const r = await api("/api/admin/trial/access", { method: "POST", body: JSON.stringify({ who: target, access: level }) });
      setSaid(`${r.username}: ${level === "full" ? "full access granted" : level === "trial" ? "now in the trial" : "back to the default"}.`);
      setWho(""); load();
    } catch (e) { setSaid(e.message); }
  };
  const download = async () => {
    const r = await api("/api/admin/trial/export");
    const blob = new Blob([JSON.stringify(r.answers, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "trial-survey.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (err) return <Panel title="Trial" purpose={err}/>;
  if (!t) return <Panel title="Trial" purpose="Loading…"/>;
  const f = t.funnel, s = t.survey;
  return (
    <>
      <Panel data-admin-trial="" title="Trial"
        purpose="The trial is the main frame: every new account gets 2 Drafts, then the site locks into the survey and the coming-soon page. Counted step by step; Drafts from a sample résumé went to draft's practice form, never to an employer."
        code="GET /api/admin/trial — users.trial_at / trial_resume / full_access, apply_run_jobs submitted, trial_surveys, trial_events, practice_submissions"
        numbers={[[f.started, "started"], [f.pickedResume, "picked a résumé"], [f.draft1Sent, "Draft 1 sent"], [f.draft2Sent, "Draft 2 sent"],
                  [f.surveySubmitted, "survey answered", true]]}>
        <p style={quiet}>Picked: {Object.entries(t.picked).map(([k, n]) => `${k === "own" ? "own résumé" : `sample ${k}`} ${n}`).join(" · ")} · finished (locked) {t.locked} ·
          practice-form sends {t.practiceSubmissions} · feedback notes {t.feedback} · "must-have" answers {t.mustHave} · friends suggested {t.referrals}</p>
        <h3 style={{ margin: "16px 0 8px" }}>What they came for</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {Object.entries(s).map(([k, counts]) => <Tally key={k} title={t.questions[k] || k} counts={counts}/>)}
          <Tally title="Role family (their profile)" counts={t.interests.roleFamilies}/>
          <Tally title="Top target titles" counts={t.interests.topTitles}/>
        </div>
        <h3 style={{ margin: "16px 0 8px" }}>What they used</h3>
        <p style={quiet}>Testers active {t.usage.testersActive} · median active minutes {t.usage.medianActiveMinutes ?? "—"}</p>
        <Tally title="Testers who opened each page" counts={t.usage.pages}/>
        <div style={{ ...row, marginTop: 12 }}>
          <DepthButton onClick={load}>Refresh</DepthButton>
          <DepthButton onClick={download}>Export the answers (no emails)</DepthButton>
        </div>
      </Panel>

      <SurveySources/>
      <TourAnalytics/>

      <Panel data-admin-trial-access="" title="Exclusive access"
        purpose="Give one account the whole site with no trial, or put an older account into the trial. Accounts made before the trial began keep full access by default."
        code="POST /api/admin/trial/access { who: id | username | email, access: full | trial | default }">
        <div style={row}>
          <input aria-label="Account id, username or email" placeholder="id, username or email" value={who} onChange={(e) => setWho(e.target.value)} style={{ ...field, minWidth: 240 }}/>
          <DepthButton primary disabled={!who.trim()} onClick={() => access(who, "full")}>Grant full access</DepthButton>
          <DepthButton disabled={!who.trim()} onClick={() => access(who, "trial")}>Put in the trial</DepthButton>
        </div>
        {said && <p role="status" style={quiet}>{said}</p>}
        <div style={{ marginTop: 12 }}>
          {t.access.length ? t.access.map(a => (
            <div key={a.id} style={{ ...row, padding: "6px 0", borderTop: "1px solid var(--color-border)" }}>
              <b>{a.username}</b><span>{a.access === "full" ? "full access" : "in the trial"}</span>
              <span style={quiet}>{when(a.at)}{a.by ? ` · by ${a.by}` : ""}</span>
              <DepthButton onClick={() => access(String(a.id), "default")}>Back to default</DepthButton>
            </div>
          )) : <span style={quiet}>No account has been set by hand.</span>}
        </div>
      </Panel>
    </>
  );
}

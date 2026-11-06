// ⭐ D124 · ADMIN → PEOPLE → TRIAL — THE TRIAL IS THE MAIN FRAME (owner 11-01): every account made since migration 205 is a
// trial account unless granted EXCLUSIVE (full) access here. This page is the trial's honest numbers, counts only — the
// funnel, what testers used and how long, what they came for, what the survey said — the access list, and the export of
// the survey's answers WITHOUT emails. ⛔ 44b (owner 11-02) REVERSES the rest for one panel: People & questions shows each
// tester's name, email and what they wrote, so their questions can be answered (services/testerContacts.js).
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
  picks: "the picks", filters: "the filters", draft_house: "Home", map: "Your map", learn: "Learn", table: "The Table",
  ...Object.fromEntries(TOUR_STEPS.map(x => [x.id, x.title])),
};
const secs = (ms) => (ms == null ? "—" : `${Math.round(ms / 1000)} s`);
const CUTS = ["sample", "field", "device", "speed", "draftsOk"];

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
  useLive(load);
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
        <Tally title="Explore: locked features pressed (testers) — what they want first" counts={Object.fromEntries(a.lockedPresses || [])}/>
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
        <DepthButton onClick={() => { window.location.href = "/api/admin/trial/export.csv?emails=1"; }}>Download CSV with names and emails</DepthButton>
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
  const load = useCallback(() => api("/api/admin/trial/people").then(setD).catch((e) => setErr(e.message)), []);
  useLive(load);
  if (err) return <Panel title="People & questions" purpose={err}/>;
  if (!d) return <Panel title="People & questions" purpose="Loading…"/>;
  const needle = q.trim().toLowerCase();
  const shown = d.people.filter(p => (!onlyAsked || p.feedback.length || p.written.length)
    && (!needle || [p.name, p.email, ...p.feedback.map(f => f.body), ...p.written.map(w => w.answer)].join(" ").toLowerCase().includes(needle)));
  return (
    <Panel data-admin-trial-people="" title="People & questions"
      purpose="Each tester and survey respondent by name and email, where they are, and everything they wrote to us — so a question can be answered. Accounts tagged test or internal, and admins, are left out."
      code="GET /api/admin/trial/people · /api/admin/trial/people.csv (services/testerContacts.js)"
      numbers={[[d.people.length, "people"], [d.messages, "messages from the dock", d.messages > 0],
                [d.people.filter(p => p.status === "survey due").length, "survey due"], [d.excluded, "left out (test / admin)"]]}>
      <div style={row}>
        <input aria-label="Search names, emails and messages" placeholder="Search names, emails, messages" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...field, minWidth: 240 }}/>
        <label style={{ ...row, gap: 6 }}><input type="checkbox" checked={onlyAsked} onChange={(e) => setOnlyAsked(e.target.checked)}/> Only people who wrote something</label>
        <DepthButton onClick={() => { window.location.href = "/api/admin/trial/people.csv"; }}>Download (CSV, with names and emails)</DepthButton>
      </div>
      <div style={{ marginTop: 12 }}>
        {shown.length ? shown.map((p, i) => (
          <div key={`${p.source}-${p.userId ?? p.email}-${i}`} data-trial-person="" style={{ padding: "10px 0", borderTop: "1px solid var(--color-border)" }}>
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

// ⭐ A111 · the trial's "Use my own résumé" pathway: its switch (app setting trial_own_resume, OFF by default — the owner
// turns it on once he has walked it) and the own-résumé testers' fields, live or not (names and counts, never a résumé).
function OwnResumePathway({ own, onChange }) {
  const [said, setSaid] = useState("");
  if (!own) return null;
  const flip = async (on) => {
    try { const r = await api("/api/admin/trial/own-resume", { method: "POST", body: JSON.stringify({ on }) }); setSaid(r.on ? "On: /try offers “Use my own résumé”." : "Off: /try offers the samples only."); onChange(); }
    catch (e) { setSaid(e.message); }
  };
  return (
    <Panel data-admin-trial-own="" title="Use my own résumé"
      purpose="Off by default. On, /try also offers the tester's own résumé (PDF, Word or pasted): its field is read first and only a field with 10 good picks today goes on; any other field is told honestly that it isn't live yet and offered the samples. Drafts are still a demonstration: the practice form, never the employer."
      code="POST /api/admin/trial/own-resume { on } · app_settings.trial_own_resume · trial_events own_resume (the field only)"
      numbers={[[own.on ? "on" : "off", "the switch", own.on], [own.testers, "testers read"], [own.live, "field live"], [own.notLive, "field not live"]]}>
      <div style={row}>
        <DepthButton primary={!own.on} onClick={() => flip(!own.on)} data-admin-own-toggle={own.on ? "on" : "off"}>{own.on ? "Turn it off" : "Turn it on"}</DepthButton>
      </div>
      {said && <p role="status" style={quiet}>{said}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 12 }}>
        <Tally title="Own-résumé testers by field" counts={own.byField}/>
      </div>
      {own.rows?.length > 0 && (
        <div style={{ marginTop: 12 }} data-admin-own-rows="">
          {own.rows.slice(0, 20).map(r => (
            <div key={r.userId} style={{ ...row, padding: "4px 0", borderTop: "1px solid var(--color-border)" }}>
              <b>{r.field}</b><span>{r.level || ""}</span><span>{r.live ? "live" : `not live (${r.picks} picks)`}</span><span style={quiet}>{when(r.at)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function TrialTab() {
  const [t, setT] = useState(null);
  const [err, setErr] = useState(null);
  const [who, setWho] = useState("");
  const [said, setSaid] = useState("");
  const load = useCallback(() => api("/api/admin/trial").then(setT).catch((e) => setErr(e.message)), []);
  useLive(load);

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

      <OwnResumePathway own={t.ownResume} onChange={load}/>
      <PeopleAndQuestions/>
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

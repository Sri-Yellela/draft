// ⭐ D124 · ADMIN → PEOPLE → TRIAL — THE TRIAL IS THE MAIN FRAME (owner 11-01): every account made since migration 205 is a
// trial account unless granted EXCLUSIVE (full) access here. This page is the trial's honest numbers, counts only — the
// funnel, what testers used and how long, what they came for, what the survey said — the access list, and the export of
// the survey's answers WITHOUT emails. No person's content is shown; usernames appear only in the access list.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { Panel, row, quiet, sub, field } from "./adminKit.jsx";

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
};

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
                  [f.surveySubmitted, "survey answered", true], [t.usefulAverage ?? "—", "usefulness (1–5)"]]}>
        <p style={quiet}>Picked: sample A {t.picked.A} · sample B {t.picked.B} · own résumé {t.picked.own} · finished (locked) {t.locked} ·
          practice-form sends {t.practiceSubmissions} · feedback notes {t.feedback} · thoughts written {s.thoughts} · follow-up emails left {t.followupEmails}</p>
        <h3 style={{ margin: "16px 0 8px" }}>What they came for</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <Tally title="Role (survey)" counts={s.targetRole}/>
          <Tally title="Role family (their profile)" counts={t.interests.roleFamilies}/>
          <Tally title="Top target titles" counts={t.interests.topTitles}/>
          <Tally title="Experience" counts={s.experience}/>
          <Tally title="Job-searching" counts={s.searching}/>
          <Tally title="Applications last month" counts={s.sentLastMonth}/>
        </div>
        <h3 style={{ margin: "16px 0 8px" }}>What they thought</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <Tally title="Would use it for real" counts={s.wouldUse}/>
          <Tally title="Would pay a month" counts={s.wouldPay}/>
          <Tally title="Most useful" counts={s.mostUseful}/>
          <Tally title="Improvement wanted first" counts={s.improvement}/>
          <Tally title="Biggest frustrations" counts={s.frustrations}/>
        </div>
        <h3 style={{ margin: "16px 0 8px" }}>What they used</h3>
        <p style={quiet}>Testers active {t.usage.testersActive} · median active minutes {t.usage.medianActiveMinutes ?? "—"}</p>
        <Tally title="Testers who opened each page" counts={t.usage.pages}/>
        <div style={{ ...row, marginTop: 12 }}>
          <DepthButton onClick={load}>Refresh</DepthButton>
          <DepthButton onClick={download}>Export the answers (no emails)</DepthButton>
        </div>
      </Panel>

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

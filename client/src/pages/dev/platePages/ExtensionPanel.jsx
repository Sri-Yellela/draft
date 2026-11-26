// ⭐ D197 Wave 2 #19 · M3 (47j, lane w2-outside) — THE EXTENSION'S ONE PANEL (D191) in plate tokens (docs/revamp/extension.md).
// A synthetic employer posting with its own Apply at the top right, the panel at its real width (380 px) stepped clear of
// it, then the panel's states side by side (job · arriving · ready · signed out · the other-page view) and the /d square.
// Every word and act is extension/jobPanelModel.js's (kept); only the drawing is the plate's. Fixture data only.
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { Kickers, LetterTile, LitSquares, StatusTag } from "../../../plate/Marks.jsx";
import { PageTitle, LegHeader, StatsStrip } from "../../../plate/Plates.jsx";
import { NavSearch } from "../../../plate/Shell.jsx";
import { FloatingPanel, ReopenTab } from "../../../plate/Panels.jsx";

const JOB = { title: "Frontend Engineer II, Checkout", company: "Kestrel Payments", place: "Boston, MA", region: "IV" };

/** The job head: the letter tile (or the logo), the serif title, company · place. */
function JobHead({ job = JOB }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "38px 1fr", gap: 12, alignItems: "center", minWidth: 0 }}>
      <LetterTile name={job.company} region={job.region} size="sm"/>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--pl-serif)", fontSize: "var(--pl-t-num-sm)", lineHeight: 1.1, color: "var(--pl-ink)", overflowWrap: "anywhere" }}>{job.title}</div>
        <div className="pl-muted" style={{ fontSize: "var(--pl-t-meta)", fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          title={`${job.company} · ${job.place}`}>{job.company} · {job.place}</div>
      </div>
    </div>
  );
}

/** How I apply: the résumé (▾ lists the job profiles), Review before I submit, Open by itself — switches with a ✓ word. */
function HowIApply() {
  const [sw, setSw] = useState({ review: true, autoOpen: true });
  const flip = (k) => setSw((s) => ({ ...s, [k]: !s[k] }));
  const toggle = (k, words) => (
    <button type="button" role="switch" aria-checked={sw[k]} className="pl-btn pl-btn--secondary" style={{ justifySelf: "start", minHeight: 44 }} onClick={() => flip(k)}>
      {sw[k] ? "✓ " : ""}{words}
    </button>
  );
  return (
    <div role="group" aria-label="How I apply" style={{ display: "grid", gap: 8, borderTop: "var(--pl-border)", paddingTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="pl-label pl-muted">HOW I APPLY</span>
        <a href="#settings" style={{ fontSize: "var(--pl-t-meta)", fontWeight: 700, color: "var(--pl-ink)" }}>All settings</a>
      </div>
      <button type="button" className="pl-btn pl-btn--paper" aria-haspopup="true" aria-expanded="false" style={{ justifySelf: "start", minHeight: 44 }}>Résumé: Frontend ▾</button>
      {toggle("review", "Review before I submit")}
      {toggle("autoOpen", "Open by itself on job boards")}
    </div>
  );
}

const foot = <a href="#open-draft" style={{ fontWeight: 700, color: "var(--pl-ink)", fontSize: "var(--pl-t-meta)" }}>Open draft ↗</a>;
const go = (label, disabled = false) => <button type="button" className="pl-btn pl-btn--primary" disabled={disabled} style={{ width: "100%" }}>{label}</button>;
const note = (text) => <p className="pl-muted" style={{ margin: 0, textAlign: "center", fontSize: "var(--pl-t-meta)" }}>{text}</p>;

/** The panel in one state (the words are jobPanelModel.js's). */
function ExtPanelBody({ kind, width }) {
  if (kind === "job") return (
    <FloatingPanel width={width} status={{ text: "86% MATCH · FILED H-1B", tone: "ok" }} foot={foot}>
      <JobHead/>{go("Draft this job")}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LitSquares squares={["lit", "lit", "lit", "lit", null]} size={10} label="4 of your 5 top skills"/>
        <span className="pl-label pl-muted">4 OF YOUR 5 TOP SKILLS</span>
      </div>
      <HowIApply/>
    </FloatingPanel>
  );
  if (kind === "arriving") return (
    <FloatingPanel width={width} status={{ text: "CHECKING DRAFT…", tone: "busy" }} foot={foot}><JobHead/>{go("Draft this job")}<HowIApply/></FloatingPanel>
  );
  if (kind === "ready") return (
    <FloatingPanel width={width} status={{ text: "RÉSUMÉ READY · 86% MATCH", tone: "ok" }} foot={foot}><JobHead/>{go("Apply from here")}{note("Fills the form. You press Submit.")}<HowIApply/></FloatingPanel>
  );
  if (kind === "out") return (
    <FloatingPanel width={width} status={{ text: "SPONSORS VISAS · 38 OPEN JOBS", tone: "quiet" }} foot={foot}>
      <JobHead/>{go("Sign in to see your match")}
      <p style={{ margin: 0, textAlign: "center", fontSize: "var(--pl-t-meta)" }}><a href="#sign-up" style={{ fontWeight: 700, color: "var(--pl-ink)" }}>New here? Get started</a></p>
    </FloatingPanel>
  );
  return (
    <FloatingPanel width={width} status={{ text: "YOUR DAY", tone: "quiet" }} foot={foot}>
      <StatsStrip label="Your day" cells={[{ value: 12, label: "NEW MATCHES", href: "#matches" }, { value: 1, label: "NEED YOU", tone: "clay", href: "#needs" }, { value: 3, label: "DRAFTED", href: "#drafted" }]}/>
      <NavSearch placeholder="Search jobs, or ask draft"/>
      <div role="status" aria-live="polite" style={{ fontSize: "var(--pl-t-small)" }}>
        <span className="pl-label pl-muted" style={{ display: "block", marginBottom: 2 }}>FROM YOUR DATA</span>
        Kestrel Payments has filed H-1B petitions every year since FY21.
      </div>
      {note("2 waiting to send from this browser")}
      <HowIApply/>
    </FloatingPanel>
  );
}

/** A synthetic employer posting: its header and its own Apply (top right) — the panel must never cover it. */
function EmployerPage({ children, phone }) {
  return (
    <div style={{ position: "relative", border: "var(--pl-border)", borderRadius: "var(--pl-r-card)", background: "var(--pl-card)", overflow: "hidden", minHeight: phone ? 0 : 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--pl-rule)", background: "var(--pl-paper-warm)" }}>
        <span className="pl-label pl-muted" style={{ flex: 1, overflowWrap: "anywhere" }}>EMPLOYER'S PAGE · BOARDS.EXAMPLE-ATS.COM/KESTREL/JOBS/4182</span>
        <button type="button" className="pl-btn pl-btn--secondary" aria-label="The employer's Apply (not draft's)">Apply</button>
      </div>
      <div style={{ padding: phone ? 16 : "28px 32px", display: "flex", flexDirection: "column", gap: 12, maxWidth: phone ? "none" : 560 }}>
        <span className="pl-label pl-muted">KESTREL PAYMENTS · BOSTON, MA · HYBRID</span>
        <div style={{ fontFamily: "var(--pl-serif)", fontSize: "var(--pl-t-card-xl)", lineHeight: 1.05 }}>Frontend Engineer II, Checkout</div>
        <p className="pl-muted" style={{ margin: 0, fontSize: "var(--pl-t-body)", lineHeight: 1.55 }}>The employer's own posting — its text, its form, its Apply. draft's panel sits over the page, stepped clear of the Apply, and closes to the /d square.</p>
      </div>
      {children}
    </div>
  );
}

export default function ExtensionPanelMock({ width = 1280 }) {
  const phone = width < 640;
  const panelW = phone ? Math.max(300, width - 32) : 380;
  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", padding: phone ? "20px 16px 64px" : "32px 24px 72px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Kickers parts={["D197 · WAVE 2 · #19", "D191", "M3 MOCK", "EXAMPLE DATA"]}/>
          <PageTitle>The extension’s panel</PageTitle>
          <p className="pl-lead">One panel, opening by itself on a recognised board’s posting, drawn from the page first, as long as its content and never over the employer’s Apply. Closed, it is the /d square.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><StatusTag kind="drafted">NOT SHIPPED</StatusTag><StatusTag kind="new">AWAITING M4</StatusTag></div>
        </header>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LegHeader n={1} meta="ON A POSTING · 380 PX · STEPPED CLEAR OF THE APPLY" title="On the employer’s page"/>
          <EmployerPage phone={phone}>
            {phone
              ? <div style={{ padding: 16, display: "flex", justifyContent: "center" }}><ExtPanelBody kind="job" width={panelW}/></div>
              : <div style={{ position: "absolute", left: 32, top: 220 }}><ExtPanelBody kind="job" width={panelW}/></div>}
          </EmployerPage>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LegHeader n={2} meta="EVERY WORD IS JOBPANELMODEL.JS’S" title="Its states"/>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
            {[["arriving", "ARRIVING · PAGE FIRST"], ["ready", "READY · APPLY FROM HERE"], ["out", "SIGNED OUT · THE PUBLIC CARD"], ["other", "ANY OTHER PAGE · YOUR DAY"]].map(([k, label]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <span className="pl-label">{label}</span>
                <ExtPanelBody kind={k} width={panelW}/>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LegHeader n={3} meta="CLOSED · ONE PRESS REOPENS ITS LAST STATE" title="The /d square"/>
          <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}><ReopenTab words="1 needs you" need/><span className="pl-label pl-muted">SOMETHING NEEDS YOU</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}><ReopenTab/><span className="pl-label pl-muted">QUIET</span></div>
          </div>
        </section>
      </div>
    </PlateRoot>
  );
}

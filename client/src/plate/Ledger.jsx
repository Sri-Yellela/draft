// ⭐ D197 Wave 1 #3 (47h) · THE LEDGER — Home in plates, to the approved `Ledger` board (docs/sketches/final/project/
// Ledger.dc.html): the header (D200 Rule 3 — one plain serif line + a mono kicker, the counts that filter), the run (the
// front application's route, Run now, the worker), 01 Needs you (one question at a time + what was filled for you),
// 02 the register, 03 tickets out (D199 C1: the market's old third section lives here now).
// Presentational only: panels/AutoApplyPanel.jsx keeps every read, state and handler (D200 Rule 1 — docs/revamp/ledger.md
// lists where each of today's Home features lives in these pieces).
import PlateRoot from "./PlateRoot.jsx";
import { Kickers } from "./Marks.jsx";
import { LegHeader, StatsStrip } from "./Plates.jsx";
import { Ticket } from "./Tickets.jsx";
import { RegisterKey } from "./Lists.jsx";
import { FactSheet } from "./Cards.jsx";
import { NoData } from "./PlateState.jsx";
import { usePlateMotion } from "./motion.js";
import "./sheets.css";

/** The page's root (paper, the plate tokens) — Home's own blocks that stay in the app's look sit inside it unchanged. */
export function LedgerPage({ children }) {
  return <PlateRoot className="pl-ledgerpage" data-plate-page="ledger">{children}</PlateRoot>;
}

/** The header: the kicker, ONE plain serif line, the summary, the counts (each filters the register), the page's actions. */
export function LedgerHeader({ week, summary, cells = [], actions = null, controls = null, run = null }) {
  return (
    <section className="pl-hero pl-lg-hero" aria-labelledby="lg-title" data-house-header="">
      <div className="pl-hero__main">
        <Kickers parts={["THE LEDGER", "YOUR APPLICATIONS", week ? `WEEK ${week}` : null].filter(Boolean)}/>
        <h1 id="lg-title" className="pl-lg-title" data-ledger-title="">Your applications</h1>
        {summary ? <p className="pl-lg-summary" data-home-summary="">{summary}</p> : null}
        <StatsStrip label="Your applications" cells={cells}/>
        {actions ? <div className="pl-actions pl-lg-actions">{actions}</div> : null}
        {controls}
      </div>
      {run}
    </section>
  );
}

/** One application as a route: six stops, lit only when the worker reported them (plate/ledgerModel.js runStops). */
export function RunRoute({ stops = [], kicker }) {
  const motion = usePlateMotion();
  const ink = { stroke: "var(--pl-ink)" };
  const lastDone = stops.reduce((k, s, i) => (s.state === "done" && (i === 0 || stops[i - 1].state === "done") ? i : k), -1);
  const now = stops.findIndex((s) => s.state === "now");
  const firstOpen = lastDone + 1;
  const x = (i) => stops[i]?.x ?? 60;
  const label = stops.length ? `One application as a route: ${stops.map((s) => `${s.word.toLowerCase()} — ${s.sub}${s.state === "done" ? ", done" : s.state === "now" ? ", waiting for you" : s.state === "underway" ? ", underway" : ""}`).join("; ")}` : "No application on its way yet";
  return (
    <svg role="img" aria-label={label} viewBox="0 0 640 220" width="100%" style={{ display: "block" }}>
      <rect width="640" height="220" style={{ fill: "var(--pl-paper-warm)" }}/>
      <g strokeWidth="0.5" opacity="0.14" style={ink}>
        {Array.from({ length: 33 }, (_, i) => <line key={`x${i}`} x1={i * 20} y1="0" x2={i * 20} y2="220"/>)}
        {Array.from({ length: 12 }, (_, i) => <line key={`y${i}`} x1="0" y1={i * 20} x2="640" y2={i * 20}/>)}
      </g>
      {stops.length ? <>
        {lastDone >= 0 ? <>
          <path d={`M60 120 L${x(lastDone)} 120`} strokeWidth="16" strokeLinecap="round" style={ink}/>
          <path className="at-draw" d={`M60 120 L${x(lastDone)} 120`} strokeWidth="10" strokeLinecap="round" fill="none" style={{ stroke: "var(--pl-lit)" }}/>
        </> : null}
        {lastDone < stops.length - 1 ? <>
          <path d={`M${x(Math.max(0, lastDone))} 120 L580 120`} strokeWidth="16" strokeLinecap="round" style={ink}/>
          <path d={`M${x(Math.max(0, lastDone))} 120 L580 120`} strokeWidth="10" strokeLinecap="round" style={{ stroke: "var(--pl-paper)" }}/>
        </> : null}
        {now > firstOpen ? <path className="at-march" d={`M${x(firstOpen)} 120 L${x(now)} 120`} strokeWidth="3" strokeDasharray="7 7" fill="none" style={{ stroke: "var(--pl-clay)" }}/> : null}
        {stops.map((s) => (
          <g key={s.id}>
            {s.state === "done" ? <>
              <circle cx={s.x} cy="120" r="14" strokeWidth="2" style={{ fill: "var(--pl-lit)", ...ink }}/>
              <path d={`M${s.x - 6} 120 l4 4 8-9`} fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--pl-on-clay)" }}/>
            </> : s.state === "underway" ? <>
              <circle cx={s.x} cy="120" r="14" strokeWidth="2" style={{ fill: "var(--pl-card)", ...ink }}/>
              <circle cx={s.x} cy="120" r="4" style={{ fill: "var(--pl-ink)" }}/>
            </> : s.state === "now" ? <>
              <circle cx={s.x} cy="120" r="17" fill="none" strokeWidth="2" style={{ stroke: "var(--pl-clay)" }}>
                {motion && <><animate attributeName="r" values="17;30" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="2s" repeatCount="indefinite"/></>}
              </circle>
              <circle cx={s.x} cy="120" r="17" strokeWidth="2" style={{ fill: "var(--pl-clay)", ...ink }}/>
              <path d={`M${s.x} 92 L${s.x} 64`} strokeWidth="2" style={ink}/>
              <path d={`M${s.x} 64 L${s.x + 22} 70 L${s.x} 78 Z`} strokeWidth="1.4" style={{ fill: "var(--pl-clay)", ...ink }}/>
            </> : s.state === "fail" ? <>
              <circle cx={s.x} cy="120" r="14" strokeWidth="2" style={{ fill: "var(--pl-card)", stroke: "var(--pl-clay)" }}/>
              <path d={`M${s.x - 5} 115 l10 10 M${s.x + 5} 115 l-10 10`} strokeWidth="2.4" strokeLinecap="round" style={{ stroke: "var(--pl-clay)" }}/>
            </> : (
              <circle cx={s.x} cy="120" r="14" strokeWidth="2" strokeDasharray="4 3" style={{ fill: "var(--pl-paper)", ...ink }}/>
            )}
            <text x={s.x} y="160" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-ink)" }}>{s.word}</text>
            <text x={s.x} y="178" textAnchor="middle" fontSize="12" style={{ fontFamily: "var(--pl-sans)", fill: "var(--pl-ink-soft)" }}>{s.sub}</text>
          </g>
        ))}
      </> : <text x="320" y="124" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-muted)" }}>NOTHING ON ITS WAY YET — DRAFT ONE FROM THE MARKET</text>}
      <text x="20" y="30" fontSize="10" fontWeight="700" letterSpacing="1.4" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-ink)" }}>{kicker}</text>
      <text x="20" y="48" fontStyle="italic" fontSize="15" style={{ fontFamily: "var(--pl-serif)", fill: "var(--pl-muted)" }}>each stop lights only when the worker reports it done</text>
    </svg>
  );
}

/**
 * The run: the route (a press opens that application in the register), Run now (the clay ticket — the scheduled batch at
 * once), the worker (running / paused / stuck, said in words).
 */
export function LedgerRun({ stops = [], kicker = "THE RUN", onOpen, runNow = null, worker = null, message = null }) {
  return (
    <figure className="pl-lg-run" data-ledger-run="">
      <div className="pl-lg-route">
        {onOpen ? <button type="button" className="pl-lg-routebtn" onClick={onOpen} aria-label="Open this application in the register"><RunRoute stops={stops} kicker={kicker}/></button>
          : <RunRoute stops={stops} kicker={kicker}/>}
      </div>
      <div className="pl-lg-runrow">
        {runNow ? (
          <button type="button" className="pl-lg-runnow" data-run-now="" disabled={runNow.disabled} onClick={runNow.onClick} title={runNow.title}>
            <span className="pl-label">{runNow.kicker}</span>
            <span className="pl-lg-runnow__t">{runNow.busy ? "Starting…" : "Run now"}</span>
            <span className="pl-lg-runnow__l">{runNow.line}</span>
          </button>
        ) : null}
        {worker ? (
          <div className="pl-lg-worker" data-worker={worker.state} role={worker.state === "stalled" ? "alert" : undefined} {...(worker.state === "stalled" ? { "data-runner-stalled": "" } : {})}>
            <span className="pl-label">THE WORKER</span>
            <span className="pl-lg-worker__st"><span aria-hidden="true" className={`pl-lg-dot${worker.state === "running" ? " at-tick" : ""}`} data-s={worker.state}/>{worker.line}</span>
            <span className="pl-lg-worker__sub">{worker.sub}</span>
          </div>
        ) : null}
      </div>
      {message}
    </figure>
  );
}

/** 01 · Needs you: the question (the stepper, one at a time) beside what was filled for you. */
export function LedgerNeeds({ meta, title, lead, ask, filled = null }) {
  return (
    <section className="pl-section" data-home-needs="">
      <LegHeader n={1} id="needs" meta={meta} title={title}/>
      {lead ? <p className="pl-lead pl-lead--body">{lead}</p> : null}
      <div className="pl-lg-needs">
        <div className="pl-lg-ask">{ask}</div>
        {filled ? <div className="pl-lg-filled"><FactSheet {...filled}/></div> : null}
      </div>
    </section>
  );
}

/** The done card: every question answered — the board's *Ready to approve*, with the stage's own actions. */
export function LedgerDone({ kicker = "ALL ANSWERED", title = "Ready to approve", line, actions, stamp = "READY", tone = "lit", attrs }) {
  return (
    <article className="pl-lg-done pl-in" data-tone={tone} {...(attrs || { "data-held-all-answered": "" })}>
      <div className="pl-lg-done__text"><span className={`pl-label ${tone === "lit" ? "pl-tone-lit" : "pl-tone-clay"}`}>{kicker}</span><span className="pl-lg-done__t">{title}</span>{line ? <span className="pl-lg-done__l">{line}</span> : null}</div>
      <div className="pl-actions">{actions}</div>
      {stamp ? <span className="pl-lg-ready at-stamp" aria-hidden="true">{stamp}</span> : null}
    </article>
  );
}

/** 02 · the register: the banner, the page's own controls (tabs, filters, find), the register, its key, what follows. */
export function LedgerRegister({ count, lead, banner = null, controls = null, register, after = null }) {
  return (
    <section className="pl-section pl-lg-register" data-ledger-register="">
      <LegHeader n={2} id="register" meta={`THE REGISTER · ${count} APPLICATION${count === 1 ? "" : "S"}`} title="Every application, as it stands"/>
      {lead ? <p className="pl-lead pl-lead--body">{lead}</p> : null}
      {banner}
      {controls}
      {register}
      <RegisterKey/>
      {after}
    </section>
  );
}

/** The blue banner over the register (A181 5c: drafts held before an update, offered a free re-run with the fix). */
export function LedgerBanner({ children, action }) {
  return <div className="pl-lg-banner pl-in" data-held-before-update=""><span className="pl-lg-banner__t">{children}</span>{action}</div>;
}

/** 03 · tickets out — each drawn only when the page can back it. `tickets` = [{ key, kicker, title, line, go, href, onClick, tone }]. */
export function LedgerTickets({ tickets = [] }) {
  return (
    <section className="pl-section pl-section--last" aria-labelledby="lg-onward" data-ledger-tickets="">
      <LegHeader n={3} meta="ONWARD · FROM HOME" title={<span id="lg-onward">Tickets out</span>}/>
      <p className="pl-lead pl-lead--body">Where this page leads next — the market’s tickets now live here too.</p>
      <div className="pl-tickets">
        {tickets.length ? tickets.map(({ key, ...t }) => <Ticket key={key} {...t}/>) : <NoData>NOWHERE ONWARD YET</NoData>}
      </div>
    </section>
  );
}


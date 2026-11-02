// ⭐ D131 · Admin → Testers — the trial and both surveys as one page you can read top to bottom and quote from (owner
// 11-01, sketch `docs/sketches/draft admin — testers.html`: "this is what im talking about"). Read-only; the data is
// GET /api/admin/testers (services/testersReport.js). Every number carries its count; a percentage appears only once a
// question has 20 answers (the server's shareText). The owner's own and test accounts are left out by default — tag an
// account `test` or `internal` in People to leave it out. Built in the admin's tokens until D133's Studio theme lands.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { C } from "../styles/colorTokens.js";

const LIVE_MS = 30_000;
const card = { background: C.SURFACE_SOLID, border: `1px solid ${C.BORDER}`, borderRadius: 14, padding: "16px 18px", minWidth: 0 };
const h2 = { fontSize: 15, textTransform: "uppercase", letterSpacing: ".06em", color: C.INK_MUTED, margin: "26px 0 10px", fontWeight: 700 };
const muted = { fontSize: 13, color: C.INK_MUTED };
const grid = (min) => ({ display: "grid", gap: 12, gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))` });
const well = `color-mix(in srgb, ${C.INK} 8%, transparent)`;
const select = { background: C.SURFACE_SOLID, border: `1px solid ${C.BORDER}`, color: C.INK, borderRadius: 9, padding: "7px 10px", font: "inherit" };

function CardHead({ title, sub }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
      <b style={{ fontSize: 15.5 }}>{title}</b>{sub && <span style={{ fontSize: 12.5, color: C.INK_MUTED }}>{sub}</span>}
    </div>
  );
}

/** Horizontal bars with the count at the end; the first `top` rows in the accent (the one thing that matters). */
export function Bars({ bars, top = 0 }) {
  const max = Math.max(1, ...bars.map(b => b.n));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }} data-testers-bars="">
      {bars.map((b, i) => (
        <div key={b.label} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1.4fr) 2fr 44px", gap: 10, alignItems: "center", fontSize: 13.5 }}>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{b.label}</span>
          <span style={{ height: 12, background: well, borderRadius: 3, overflow: "hidden" }}>
            <i style={{ display: "block", height: "100%", width: `${(100 * b.n) / max}%`, background: i < top && b.n ? C.ACCENT : C.INFO, borderRadius: 3 }}/>
          </span>
          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.INK_MUTED }}>{b.n}</span>
        </div>
      ))}
    </div>
  );
}

function TallyCard({ t, top = 0 }) {
  const label = t.only === "trial" ? " · tried the app" : t.only === "standalone" ? " · survey only" : "";
  return (
    <div style={card}>
      <CardHead title={t.question} sub={`${t.n} answer${t.n === 1 ? "" : "s"}${label}`}/>
      <Bars bars={t.bars} top={top}/>
    </div>
  );
}

function Headline({ h }) {
  return (
    <div style={card} data-testers-headline={h.key}>
      {/* A number reads big; a sentence (the top frustration) at 34 px shouts — it gets the card title's weight at 20 px. */}
      <div style={{ fontSize: String(h.big).length > 12 ? 20 : 34, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.15, overflowWrap: "anywhere" }}>{h.big}</div>
      <div style={{ fontWeight: 700, margin: "4px 0 2px" }}>{h.label}</div>
      <div style={muted}>{h.what}</div>
      {h.frac != null && (
        <div style={{ height: 8, borderRadius: 2, background: well, overflow: "hidden", marginTop: 10 }}>
          <i style={{ display: "block", height: "100%", width: `${Math.round(100 * h.frac)}%`, background: C.SUCCESS }}/>
        </div>
      )}
      {h.sentence && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: C.INK_MUTED, borderTop: `1px dashed ${C.BORDER}`, paddingTop: 8 }}>
          For the application: <q style={{ color: C.INK }}>{h.sentence}</q>
        </div>
      )}
    </div>
  );
}

/**
 * Owner 11-02: "−18 left here" alone said nothing. Each drop-off now reads as who is still going (active in the last
 * 30 min), where the rest stopped (their furthest tour step), and how many met an error.
 */
function WhyLeft({ s }) {
  const w = s.why;
  const stopped = s.left - w.stillGoing;
  return (
    <details data-testers-why="" style={{ gridColumn: "1 / -1", margin: "-2px 0 4px", fontSize: 13 }}>
      <summary style={{ cursor: "pointer", color: C.INK_MUTED }}>
        {s.left} didn't reach “{s.label}”: <b style={{ color: C.INK }}>{w.stillGoing} still going</b> · <b style={{ color: C.WARNING }}>{stopped} stopped</b>
        {w.errored ? <> · <b style={{ color: C.DANGER }}>{w.errored} met an error</b></> : null}
      </summary>
      {w.stoppedAt.length > 0 && <div style={{ marginTop: 6 }}><Bars bars={w.stoppedAt}/></div>}
    </details>
  );
}

function SignupFunnel({ f }) {
  const first = Math.max(1, f.steps[0]?.n || 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testers-funnel="">
      {f.steps.map(s => (
        <div key={s.label} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 150px) 1fr 100px", gap: 10, alignItems: "center", fontSize: 14 }}>
          <span>{s.label}</span>
          <span style={{ height: 26, background: well, borderRadius: 7, overflow: "hidden" }}>
            <i style={{ display: "flex", alignItems: "center", height: "100%", width: `${(100 * s.n) / first}%`, minWidth: s.n ? 28 : 0,
              background: C.SUCCESS, color: C.ON_ACCENT, fontWeight: 800, fontSize: 12.5, paddingLeft: 8, borderRadius: 7, boxSizing: "border-box" }}>{s.n}</i>
          </span>
          <span style={{ fontSize: 12.5, color: C.WARNING }}>{s.left ? `−${s.left} didn't get here` : ""}</span>
          {s.why && <WhyLeft s={s}/>}
        </div>
      ))}
    </div>
  );
}

function StarAverages({ stars }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 12px", alignItems: "center", fontSize: 14 }}>
      {stars.map(s => {
        const full = s.average == null ? 0 : Math.round(s.average);
        return [
          <span key={`${s.label}-l`}>{s.label}</span>,
          <span key={`${s.label}-s`} aria-label={s.average == null ? "no ratings" : `${s.average} of 5 from ${s.n}`}>
            <span style={{ color: C.WARNING, letterSpacing: 2 }}>{"★★★★★".slice(0, full)}</span>
            <span style={{ color: C.BORDER, letterSpacing: 2 }}>{"★★★★★".slice(0, 5 - full)}</span>
            <em style={{ ...muted, fontStyle: "normal", marginLeft: 6, fontSize: 12.5 }}>{s.average == null ? "—" : s.average.toFixed(1)} · {s.n}</em>
          </span>,
        ];
      })}
    </div>
  );
}

export function TestersTab() {
  const [opts, setOpts] = useState({ period: "invites", source: "all", exclude: true });
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [said, setSaid] = useState("");
  const qs = `period=${opts.period}&source=${opts.source}&exclude=${opts.exclude ? 1 : 0}`;
  const load = useCallback(() => api(`/api/admin/testers?${qs}`).then((r) => { setD(r); setErr(null); }).catch((e) => setErr(e.message)), [qs]);
  useEffect(() => {
    load();
    const tick = () => { if (document.visibilityState === "visible") load(); };
    const id = setInterval(tick, LIVE_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [load]);
  const quotes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (d?.quotes || []).filter(x => !needle || `${x.text} ${x.about} ${x.field || ""} ${x.source}`.toLowerCase().includes(needle));
  }, [d, q]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(d.copyText); setSaid("Copied the headline sentences."); }
    catch { setSaid("Copy was blocked by the browser — select the sentences on the cards instead."); }
  };

  if (err && !d) return <div style={card}>Couldn't load the testers page: {err}</div>;
  if (!d) return <div style={card}>Loading…</div>;
  const ex = d.excluded.accounts + d.excluded.surveys;
  return (
    <div data-admin-testers="" style={{ maxWidth: 1180 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: "-.01em" }}>Testers</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select aria-label="When" style={select} value={opts.period} onChange={e => setOpts(o => ({ ...o, period: e.target.value }))}>
            <option value="invites">Since the invites (Nov 1)</option><option value="day">Last 24 hours</option><option value="all">All time</option>
          </select>
          <select aria-label="Who" style={select} value={opts.source} onChange={e => setOpts(o => ({ ...o, source: e.target.value }))}>
            <option value="all">Both surveys</option><option value="trial">Tried the app</option><option value="standalone">Survey only</option>
          </select>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, color: C.INK_MUTED }}>
            <input type="checkbox" checked={opts.exclude} onChange={e => setOpts(o => ({ ...o, exclude: e.target.checked }))}/> Leave out my own and test accounts
          </label>
          <DepthButton onClick={copy} disabled={!d.copyText}>Copy the YC numbers</DepthButton>
          <DepthButton onClick={() => { window.location.href = `/api/admin/testers/export.csv?${qs}`; }}>Export without names or emails</DepthButton>
          <DepthButton onClick={() => { window.location.href = `/api/admin/testers/export.csv?${qs}&contact=1`; }}>Export with names and emails</DepthButton>
        </div>
      </div>
      <p style={{ color: C.INK_MUTED, margin: "2px 0 8px" }}>
        Everyone who tried draft or answered the survey. Read top to bottom: the headline, how far people got, who they are, the problem, what they thought, and their own words.
      </p>
      <p style={{ ...muted, margin: "0 0 10px" }}>
        {opts.exclude ? `Left out: ${d.excluded.accounts} account${d.excluded.accounts === 1 ? "" : "s"} and ${d.excluded.surveys} survey answer${d.excluded.surveys === 1 ? "" : "s"} — admins and accounts tagged "test" or "internal" in People.` : "Including every account."}
        {said && <span role="status" style={{ marginLeft: 8, color: C.INK }}>{said}</span>}
      </p>
      <div role="note" data-testers-banner="" style={{ border: `1px solid ${d.small ? C.WARNING : C.BORDER}`, background: d.small ? C.WARNING_QUIET : "transparent",
        borderRadius: 10, padding: "10px 14px", margin: "6px 0 16px", fontSize: 14 }}>
        {d.small
          ? <><b style={{ color: C.WARNING }}>Only {d.answers} answer{d.answers === 1 ? "" : "s"} so far.</b> Numbers show counts until a question has 20 answers; read them as early signals, not results.</>
          : <><b>{d.people} people</b> {d.periodLabel.toLowerCase()}: {d.tried} tried the app, {d.surveyOnly} answered the survey only.</>}
      </div>

      <h2 style={h2}>The headline</h2>
      <div style={grid(250)}>{d.headline.map(h => <Headline key={h.key} h={h}/>)}</div>

      {d.source !== "standalone" && <>
        <h2 style={h2}>How far people got in the trial</h2>
        <div style={grid(420)}>
          <div style={card}>
            <CardHead title="From sign-up to survey" sub={d.funnel.medianMinutes == null ? "no one has finished yet" : `median ${d.funnel.medianMinutes} min from sign-up to survey`}/>
            <SignupFunnel f={d.funnel}/>
          </div>
          <div style={card}>
            <CardHead title="What they explored after" sub="locked buttons pressed · pages opened"/>
            {d.funnel.locked.length ? <Bars bars={d.funnel.locked.map(x => ({ ...x, label: `Pressed: ${x.label} (locked)` }))} top={1}/> : <span style={muted}>No locked buttons pressed yet.</span>}
            {d.funnel.pages.length > 0 && <div style={{ marginTop: 12 }}><Bars bars={d.funnel.pages.map(x => ({ ...x, label: `Opened ${x.label}` }))}/></div>}
            <div style={{ marginTop: 10, fontSize: 12.5, color: C.INK_MUTED, borderTop: `1px dashed ${C.BORDER}`, paddingTop: 8 }}>The locked buttons people pressed most are what they want first.</div>
          </div>
        </div>
      </>}

      <h2 style={h2}>Who answered</h2>
      <div style={grid(420)}>{d.who.map(t => <TallyCard key={t.key} t={t}/>)}</div>

      <h2 style={h2}>The problem, in their numbers</h2>
      <div style={grid(420)}>{d.problem.map(t => <TallyCard key={t.key} t={t} top={t.key === "frustration" ? 1 : 0}/>)}</div>

      <h2 style={h2}>What they thought</h2>
      <div style={grid(420)}>
        <div style={card}><CardHead title="Stars per part" sub="average · answers"/><StarAverages stars={d.stars}/></div>
        {d.thought.map(t => <TallyCard key={t.key} t={t} top={["compared", "trust_auto", "most_helpful", "idea_most_helpful"].includes(t.key) ? 1 : t.key === "interested" ? 2 : 0}/>)}
      </div>

      <h2 style={h2}>In their own words</h2>
      <div style={card} data-testers-quotes="">
        <input aria-label="Search answers" placeholder="Search what people wrote…" value={q} onChange={e => setQ(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.BORDER}`, background: well, color: C.INK, borderRadius: 9, padding: "8px 10px", marginBottom: 10, font: "inherit" }}/>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {quotes.length ? quotes.map((x, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${C.ACCENT}`, background: well, borderRadius: "0 9px 9px 0", padding: "8px 12px", fontSize: 14 }}>
              “{x.text}”
              <small style={{ display: "block", color: C.INK_MUTED, fontSize: 12, marginTop: 3 }}>
                {[x.source, x.field, x.stars != null ? `${x.stars}★` : null, x.about].filter(Boolean).join(" · ")}
              </small>
            </div>
          )) : <span style={muted}>{d.quotes.length ? "Nothing matches that search." : "No written answers yet."}</span>}
        </div>
      </div>

      <p style={{ ...muted, marginTop: 24, borderTop: `1px dashed ${C.BORDER}`, paddingTop: 10 }}>
        Updates every 30 seconds while this tab is open. Every number shows its count; a percentage appears once a question has 20 or more answers.
        The standalone survey's names and emails are in its own export (below), only with "Include name and email" ticked.
      </p>
    </div>
  );
}

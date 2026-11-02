// ⭐ THE TRIAL'S DEMONSTRATION (owner 11-01): after the 2nd Draft, Draft House replays a complete run for each pick —
// Reading the job → Tailoring your résumé (the sample résumé and its tailored version SIDE BY SIDE, each tailored line
// marked — simulated, no model; GET /api/trial/demo) → Filling the application (the practice form, field by field,
// with the sample's own values — A111: or, on the own-résumé pathway, the tester's own résumé and contact lines) → the consent box, left for the tester (one press) → Sent → Confirmation received.
// Labelled "Demonstration": a replay, nothing reaches an employer. The tour renders this into Draft House's
// #trial-demo-slot and moves the two tiles' rings ("draft:trial-demo-rings"); onDone records the picks as sent by
// demonstration (POST /api/trial/demo/complete).
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";

const PHASES = ["reading", "tailoring", "filling", "consent", "sent", "confirmed"];
const LABEL = { reading: "Reading the job", tailoring: "Tailoring your résumé", filling: "Filling the application",
  consent: "The consent box is yours to tick", sent: "Sent", confirmed: "Confirmation received" };
const RING = { reading: "work", tailoring: "work", filling: "work", consent: "need", sent: "sent", confirmed: "sent" };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function Run({ run, fields, phase, filled, onConsent, active }) {
  const at = PHASES.indexOf(phase);
  const t = run.tailoring || {};
  return (
    <div data-demo-run={run.jobId} data-demo-phase={phase}
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px",
               opacity: active || at >= 0 ? 1 : 0.6 }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{run.title || "The job"}</div>
      <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginBottom: 10 }}>{run.company}</div>
      {PHASES.map((p, k) => (
        <div key={p} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 8, alignItems: "start", fontSize: 14, margin: "4px 0",
                              color: k <= at ? "var(--color-text)" : "var(--color-text-muted)" }}>
          <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: "50%", marginTop: 4,
            border: `2px solid ${k < at ? "var(--c-success)" : k === at ? "var(--color-primary)" : "var(--color-border)"}`,
            background: k < at ? "var(--c-success)" : "transparent" }}/>
          <span>
            {LABEL[p]}{k < at ? " ✓" : ""}
            {p === "tailoring" && k <= at && (
              <span style={{ display: "block", fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }} data-demo-changes="">
                {t.changed ? `${t.changed} lines tailored for this posting${(t.terms || []).length ? `: it leads with ${t.terms.slice(0, 4).join(", ")}` : ""}.`
                  : "The résumé already fit this posting; draft kept it as it was."}
              </span>
            )}
            {p === "filling" && k <= at && (
              <span style={{ display: "block", fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }} data-demo-fields="">
                {fields.slice(0, filled).map(f => <span key={f.label} style={{ display: "block" }}>{f.label}: <b style={{ color: "var(--color-text)" }}>{f.value}</b></span>)}
              </span>
            )}
            {p === "consent" && phase === "consent" && (
              <span style={{ display: "block", marginTop: 6 }}>
                <DepthButton primary onClick={onConsent} data-demo-consent="">Tick “I agree to the terms”</DepthButton>
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NBSP = String.fromCharCode(160);   // an empty résumé line keeps its height
/** A line with the posting's terms in bold. */
function Marked({ text, terms }) {
  if (!terms?.length || !text) return text || NBSP;
  // whole terms only (as services/trialDemo.js `names`): "Go", never the "go" in "Algorithms"
  const re = new RegExp(`((?<![\\w+#.])(?:${terms.map(esc).join("|")})(?![\\w+#]))`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? <b key={i} style={{ color: "var(--color-text)" }}>{part}</b> : part));
}
const HEADING = /^[A-Z][A-Z &]+$/;
function Page({ title, lines, terms, tailored }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>{title}</div>
      <div data-demo-page={tailored ? "tailored" : "sample"}
        style={{ boxSizing: "border-box", height: 300, overflowY: "auto", overflowWrap: "anywhere", padding: "10px 12px", borderRadius: 8,
                 border: "1px solid var(--color-border)", background: "var(--c-surface-solid)", fontSize: 12, lineHeight: 1.45, color: "var(--color-text-muted)" }}>
        {lines.map((l, i) => {
          const text = typeof l === "string" ? l : l.text, change = typeof l === "string" ? null : l.change;
          const tint = change === "added" ? "var(--c-success)" : change === "moved" ? "var(--color-primary)" : null;
          return (
            <div key={i} data-demo-line={change || undefined} title={change === "added" ? "Added for this posting" : change === "moved" ? "Brought forward for this posting" : undefined}
              style={{ whiteSpace: "pre-wrap", fontWeight: HEADING.test(text.trim()) ? 800 : 400, color: HEADING.test(text.trim()) || i === 0 ? "var(--color-text)" : undefined,
                       ...(tint ? { borderLeft: `3px solid ${tint}`, paddingLeft: 6, marginLeft: -9, background: `color-mix(in srgb, ${tint} 12%, transparent)` } : {}) }}>
              {tailored ? <Marked text={text} terms={terms}/> : (text || NBSP)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The sample résumé and the one tailored for this posting, side by side (stacked on a phone). A111: on the own-résumé
 *  pathway it is the tester's OWN résumé (`own`), tailored the same way — nothing added that the résumé does not show. */
function Compare({ run, own = false }) {
  const t = run?.tailoring;
  const box = useRef(null);
  // it opens below the two runs: brought into view so the tester sees the two résumés
  useEffect(() => { box.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [run?.jobId]);
  if (!t?.before) return null;
  return (
    <div ref={box} data-demo-compare={run.jobId} style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Tailoring the résumé for {run.title || "this job"}{run.company ? ` at ${run.company}` : ""}</div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10 }}>
        <span style={{ borderLeft: "3px solid var(--c-success)", paddingLeft: 6, marginRight: 12 }}>added for this posting</span>
        <span style={{ borderLeft: "3px solid var(--color-primary)", paddingLeft: 6, marginRight: 12 }}>brought forward</span>
        <b style={{ color: "var(--color-text)" }}>bold</b> = what the posting asks for. Nothing is added that {own ? "your résumé does not already show" : "the sample did not do"}.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {own ? <Page title="Your résumé" lines={t.before}/> : <Page title="Sample résumé" lines={t.before}/>}
        <Page title="Tailored résumé" lines={t.after} terms={t.terms} tailored/>
      </div>
    </div>
  );
}

/** @param onDone async () => void — called once both runs are confirmed. */
export default function TrialDemo({ onDone }) {
  const [demo, setDemo] = useState(null);
  const [phase, setPhase] = useState({});      // jobId -> phase
  const [filled, setFilled] = useState({});    // jobId -> fields shown
  const [shown, setShown] = useState(null);  // the run whose résumés are side by side
  const consentRef = useRef({});
  const started = useRef(false);

  // The replay's data — asked again until the two picks are there.
  useEffect(() => {
    let alive = true, t = null;
    const load = async () => {
      try { const d = await api("/api/trial/demo"); if (!alive) return; setDemo(d); if (d?.ok && d.runs.length) return; } catch { /* try again */ }
      if (alive) t = setTimeout(load, 3000);
    };
    load();
    return () => { alive = false; clearTimeout(t); };
  }, []);

  const rings = (p) => window.dispatchEvent(new CustomEvent("draft:trial-demo-rings", { detail: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, RING[v]])) }));

  useEffect(() => {
    if (!demo?.ok || started.current || !demo.runs.length) return;
    started.current = true;
    (async () => {
      const set = (id, ph) => setPhase(p => { const n = { ...p, [id]: ph }; rings(n); return n; });
      for (const run of demo.runs) {
        set(run.jobId, "reading"); await wait(2500);
        set(run.jobId, "tailoring");
        setShown(run.jobId);
        await wait(9000);                       // time to read the two résumés side by side
        set(run.jobId, "filling");
        for (let f = 1; f <= (demo.fields || []).length; f++) { setFilled(x => ({ ...x, [run.jobId]: f })); await wait(600); }
        set(run.jobId, "consent");
        await new Promise(r => { consentRef.current[run.jobId] = r; });
        set(run.jobId, "sent"); await wait(1500);
        set(run.jobId, "confirmed"); await wait(1000);
      }
      await onDone?.();
    })();
  }, [demo?.ok]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.dispatchEvent(new CustomEvent("draft:trial-demo-rings", { detail: {} })), []);

  if (!demo) return <div data-trial-demo="" style={{ padding: 12 }}>Getting your two picks ready…</div>;
  if (!demo.ok || !demo.runs.length) return <div data-trial-demo="" style={{ padding: 12 }}>Press Draft on 2 jobs on the Daily Deck to see them run.</div>;
  return (
    <section data-trial-demo="" aria-label="Demonstration" style={{ margin: "0 0 14px" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span data-demo-tag="" style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", borderRadius: 6,
          padding: "2px 8px", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>Demonstration</span>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>A replay of what draft does for each pick: read the job, tailor the résumé, fill the form. Nothing is sent to the employer.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {demo.runs.map(run => (
          <Run key={run.jobId} run={run} fields={demo.fields || []} phase={phase[run.jobId] || "waiting"} filled={filled[run.jobId] || 0}
            active={!!phase[run.jobId]} onConsent={() => consentRef.current[run.jobId]?.()}/>
        ))}
      </div>
      <Compare run={demo.runs.find(r => r.jobId === shown)} own={!!demo.own}/>
    </section>
  );
}

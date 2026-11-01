// ⭐ D121 P3 · THE SPONSORSHIP SIGNAL, DRAWN ONCE — the chip (board cards, Draft House branches) and the block (the job
// page). Both draw the server's ONE signal (services/kb/sponsorshipSignal.js → `job.sponsorship`); nothing here decides
// a level. Status is a MARK (D60): a rectangle with a leading bar, never a capsule.
//   needed  the user's Application defaults say they need sponsorship → the chip is in its colour;
//           otherwise a quiet dim chip (D121 P3: "not needed → a quiet chip"). "Says no" keeps its colour for everyone.
// ⛔ Unknown is drawn as unknown (a dashed mark), never as a no. The block ends with the not-legal-advice line and
// D108's dated "What changed" (official sources only), opened in place.
import { useState } from "react";
import { api } from "../lib/api.js";
import "./SponsorshipSignal.css";

const TONE = { often: "mark--ok", sometimes: "mark--info", no_record: "mark--dim", unknown: "mark--unknown", says_no: "mark--no" };

export function SponsorshipChip({ signal, needed = false, className = "" }) {
  if (!signal?.level) return null;
  const tone = needed || signal.level === "says_no" ? TONE[signal.level] : "mark--dim";
  return (
    <span className={`mark ${tone} spn-chip${className ? ` ${className}` : ""}`} data-sponsorship={signal.level}
      data-sponsorship-needed={needed ? "true" : undefined} title={`${signal.line}. ${signal.notice}`}>
      {signal.label}
    </span>
  );
}

function WhatChanged() {
  const [list, setList] = useState(null);
  const load = (e) => {
    if (!e.currentTarget.open || list) return;
    api("/api/what-changed").then(r => setList(r?.items || [])).catch(() => setList([]));
  };
  return (
    <details className="spn-changed" onToggle={load} data-sponsorship-what-changed="">
      <summary>What changed</summary>
      {list == null ? null : list.length === 0 ? <p className="spn-quiet">Nothing recorded yet.</p> : (
        <ul className="spn-list">
          {list.map((c, i) => <li key={i}><b>{c.happenedOn}</b> {c.text} <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.sourceName}</a></li>)}
        </ul>
      )}
    </details>
  );
}

export function SponsorshipBlock({ signal }) {
  if (!signal?.level) return null;
  const sources = signal.sources || [];
  return (
    <section className="spn-block" data-posting-sponsorship-signal={signal.level} aria-label="Sponsorship">
      <p className="spn-head"><span className="spn-k">Sponsorship</span> <SponsorshipChip signal={signal} needed /></p>
      <ul className="spn-list">
        {signal.level === "says_no" && <li data-sponsorship-fact="says_no">This posting says it won't sponsor.</li>}
        {signal.level === "unknown" && <li data-sponsorship-fact="unknown">No confident match to a public LCA record — unknown, not a no.</li>}
        {(signal.facts || []).map((f, i) => <li key={i} data-sponsorship-fact={f.kind}>{f.text}</li>)}
      </ul>
      {sources.length > 0 && (
        <p className="spn-quiet" data-sponsorship-sources="">
          Sources:{" "}
          {sources.map((s, i) => (
            <span key={i}>{i ? " · " : ""}{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}
              {s.through ? `, through ${s.through}` : s.asOf ? `, file dated ${s.asOf}` : ""}</span>
          ))}
        </p>
      )}
      <p className="spn-quiet" data-sponsorship-notice="">{signal.notice}</p>
      <WhatChanged />
    </section>
  );
}

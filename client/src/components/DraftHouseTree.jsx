import "./DraftHouse.css";
import CompanyBubble from "./CompanyBubble.jsx";
import { ringLabelOf } from "../lib/draftHouseTree.js";

// ============================================================
// DraftHouseTree — THE AUTO-APPLY TIMELINE, a card beside the table (D113's runs, restyled by D146; owner 11-03:
// "i love the pulsing icons against the timeline format but needs restyled in our current approach beside the table")
// ============================================================
// Time runs DOWN: the next run as a dashed square at the top, a Now line, then each run newest first — its time, its
// square, "N looked at · N picked · why these" and its jobs as small CompanyBubbles ringed by stage. Needs you, Ready
// and Working PULSE (styles/rings.js; reduced motion stops it, CompanyBubble.css); sent, replied and stopped are still.
// ⭐ D146: a bubble press opens THAT ROW in the table (onBubble) — the job's details live in the table's row, never in
// a second branch here. A run's square opens its run card in place (renderRunBranch), one at a time.
// Presentational: every piece of state is a prop, so it renders the same in a test as on the page.
// ⛔ D146 (changed on purpose): the filters, the search and the zoom moved to the table's one filter row; the job
// branch, its lead card and its leaves became the table's opened row (components/ApplicationTracker.jsx RowOpen).
// ============================================================

/** The one quiet line of key: which bubbles pulse, which are still. */
export const TIMELINE_KEY = "Pulsing: needs you · ready · working. Still: sent · replied · stopped.";

export default function DraftHouseTree({ view = [], open = null, head = null, onOpen, onBubble, renderRunBranch,
  nextLine = "Next look.", empty = null, footer = null }) {
  let lastDay = null;
  const hasNext = !!view[0]?.run?.future;
  return (
    <section className="dht" data-draft-tree="" data-timeline="" aria-label="Auto-apply timeline">
      {head}
      <div className="dht-trunk">
        {view.map(({ run, items }, i) => {
          const day = run.day !== lastDay ? run.day : null;
          lastDay = run.day;
          const runOpen = open?.type === "run" && open.key === run.key;
          return (
            <div key={run.key} className="dht-runwrap" data-run={run.key} data-future={run.future ? "true" : undefined}>
              {day && <div className="dht-day">{day}</div>}
              {hasNext && i === 1 && <div className="dht-now" aria-hidden="true"><span>Now</span></div>}
              <div className="dht-run">
                <span className="dht-time">{run.time}</span>
                {run.real ? (
                  <button type="button" className="dht-sq" data-open={runOpen ? "true" : undefined} aria-expanded={runOpen}
                    aria-label={`Run, ${run.day} ${run.time}`} onClick={() => onOpen?.({ type: "run", key: run.key })} />
                ) : <span className={run.future ? "dht-sq dht-sq--next" : "dht-sq dht-sq--day"} aria-hidden="true" />}
                <div className="dht-body">
                  {run.future ? <span className="dht-meta" data-next-run="">{nextLine}</span>
                    : run.real ? (
                      <span className="dht-meta" data-run-meta="">{run.seen} looked at · {run.picked} picked ·{" "}
                        <button type="button" onClick={() => onOpen?.({ type: "run", key: run.key })}>{runOpen ? "hide" : "why these"}</button>
                      </span>
                    ) : <span className="dht-meta">{run.nodes.length} drafted by you</span>}
                  {items.map(({ node }) => (
                    <CompanyBubble key={node.key} company={node.company} ring={node.ring} size="sm"
                      dataKey={node.key} vtTitle={node.jobId} label={`${node.company}, ${node.title || "a job"}, ${ringLabelOf(node)}`}
                      onClick={() => onBubble?.(node)} />
                  ))}
                </div>
              </div>
              {runOpen && renderRunBranch?.(run)}
            </div>
          );
        })}
        {empty}
      </div>
      <p className="dht-legend" data-timeline-key="">{TIMELINE_KEY}</p>
      {footer}
    </section>
  );
}

/** A branch: a vertical line with the run card hanging off it. */
export function Branch({ ring = null, children, label }) {
  return <div className="dht-branch" data-branch="" data-ring={ring || undefined} role="group" aria-label={label}>{children}</div>;
}

/** U4 (a) · a run's card: what it looked at, what it picked and left out, by reason. */
export function RunCard({ run, lines = [], onClose, onChangeFilters, onSeeLeftOut, children }) {
  return (
    <div className="dht-node">
      <div className="dht-card" data-run-card="">
        <div className="dht-card__head">
          <div className="dht-card__who">
            <h3>{run.day}, {run.time}</h3>
            <span>Looked at {run.seen} new postings</span>
          </div>
          <button type="button" className="dht-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <p className="dht-say">Picked {run.picked}, left out {run.leftOutTotal}.</p>
        {lines.length > 0 && (
          <div className="dht-why" data-left-out-reasons="">
            {lines.map(l => <div key={l.reason} data-reason={l.reason}><b>{l.n}</b><span>left out: {l.label}</span></div>)}
          </div>
        )}
        <div className="dht-acts">
          <button type="button" className="dh-btn" onClick={onChangeFilters}>Change filters</button>
          <button type="button" className="dh-btn" onClick={onSeeLeftOut} disabled={!run.leftOutTotal}>See what was left out</button>
        </div>
        {children}
      </div>
    </div>
  );
}

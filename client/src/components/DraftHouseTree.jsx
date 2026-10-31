import "./DraftHouse.css";
import CompanyBubble from "./CompanyBubble.jsx";
import { FILTERS } from "../lib/draftHouseTree.js";
import { RINGS } from "../styles/rings.js";

// ============================================================
// DraftHouseTree — the tree that grows inline (D113 UI U3, U4, U6; owner 10-31)
// ============================================================
// Time runs DOWN a trunk: the next run as a dashed square at the top, a Now line, then each run newest
// first — its time, its square, a meta line and its jobs as CompanyBubbles (the bubble standard). A run
// or a bubble opens a BRANCH that grows in place, one at a time (lib/draftHouseTree.js branchStep);
// the branch's contents are the panel's (renderRunBranch / renderJobBranch), built from the parts below.
// Presentational: every piece of state is a prop, so it renders the same in a test as on the page.
// ============================================================

export default function DraftHouseTree({ view = [], filter = "all", zoom = 1, open = null, search = null,
  onFilter, onZoom, onOpen, renderRunBranch, renderJobBranch, nextLine = "Next look.", empty = null }) {
  let lastDay = null;
  const hasNext = !!view[0]?.run?.future;
  return (
    <div className="dht" data-draft-tree="">
      <div className="dht-filters" role="toolbar" aria-label="Show">
        {FILTERS.map(([id, label]) => (
          <button key={id} type="button" className="dht-chip" data-filter={id} aria-pressed={filter === id}
            onClick={() => onFilter?.(id)}>{label}</button>
        ))}
        {/* The search box is the panel's (PanelControls' PanelSearch, shared — never redrawn here). */}
        {search && <span className="dht-search">{search}</span>}
        <span className="dht-zoom" role="group" aria-label="Detail">
          <button type="button" aria-label="Less detail" disabled={zoom <= 0} onClick={() => onZoom?.(Math.max(0, zoom - 1))}>−</button>
          <button type="button" aria-label="More detail" disabled={zoom >= 2} onClick={() => onZoom?.(Math.min(2, zoom + 1))}>+</button>
        </span>
      </div>
      <div className="dht-trunk">
        {view.map(({ run, items }, i) => {
          const day = run.day !== lastDay ? run.day : null;
          lastDay = run.day;
          const runOpen = open?.type === "run" && open.key === run.key;
          const jobOpen = open?.type === "job" ? items.find(x => x.node.key === open.key)?.node : null;
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
                    : zoom > 0 && (run.real ? (
                      <span className="dht-meta" data-run-meta="">{run.seen} looked at · {run.picked} picked ·{" "}
                        <button type="button" onClick={() => onOpen?.({ type: "run", key: run.key })}>{runOpen ? "hide" : "why these"}</button>
                      </span>
                    ) : <span className="dht-meta">{run.nodes.length} drafted by you</span>)}
                  {items.map(({ node, dim }) => {
                    const sel = open?.type === "job" && open.key === node.key;
                    const bubble = (
                      <CompanyBubble key={node.key} company={node.company} ring={node.ring} dim={dim} selected={sel}
                        dataKey={node.key} expanded={sel} vtTitle={node.jobId} label={`${node.company}, ${node.title || "a job"}, ${RINGS[node.ring]?.label || ""}`}
                        onClick={() => onOpen?.({ type: "job", key: node.key })} />
                    );
                    return zoom === 2 ? (
                      <span key={node.key} className="dht-named" data-dim={dim ? "true" : undefined}>{bubble}<span className="dht-name">{node.company}</span></span>
                    ) : bubble;
                  })}
                </div>
              </div>
              {runOpen && renderRunBranch?.(run)}
              {jobOpen && renderJobBranch?.(jobOpen)}
            </div>
          );
        })}
        {empty}
      </div>
      <div className="dht-legend" aria-label="What the rings mean">
        {Object.entries(RINGS).map(([id, r]) => <span key={id} data-ring={id}>{r.label}</span>)}
      </div>
    </div>
  );
}

/** A branch: a vertical line in the ring's colour with nodes hanging off it. */
export function Branch({ ring = null, children, label }) {
  return <div className="dht-branch" data-branch="" data-ring={ring || undefined} role="group" aria-label={label}>{children}</div>;
}

/** U4 (b) · the lead card: bubble, title, company and state; ONE sentence; the next action. */
export function LeadCard({ node, actions = [], onFullPage, fullHref, onClose, children }) {
  const r = RINGS[node.ring];
  return (
    <div className="dht-node">
      <div className="dht-card dht-card--lead" data-lead-card="" data-ring={node.ring}>
        <div className="dht-card__head">
          <CompanyBubble company={node.company} ring={node.ring} size="sm" />
          <div className="dht-card__who">
            <h3>{node.title || "A job"}</h3>
            <span>{node.company} · {r?.label}{node.kind === "reply" && node.status ? `: ${node.status[0].toUpperCase()}${node.status.slice(1)}` : ""}</span>
          </div>
          <button type="button" className="dht-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <p className="dht-say" data-say="">{node.say}</p>
        {children}
        <div className="dht-acts">
          {actions.map(a => a.href ? (
            <a key={a.label} className="dh-btn" data-kind={a.kind} href={a.href} target="_blank" rel="noreferrer" title={a.title}
              onClick={a.onClick}>{a.label}</a>
          ) : (
            <button key={a.label} type="button" className="dh-btn" data-kind={a.kind} title={a.title} disabled={a.disabled}
              data-action={a.id} onClick={a.onClick}>{a.label}</button>
          ))}
          {/* The application's own page (JobWorkspacePanel): a real link, so a modified click opens a tab. */}
          {onFullPage && (
            <a className="dh-btn" href={fullHref} data-open-job-page=""
              onClick={(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); onFullPage(); } }}>Full page</a>
          )}
        </div>
      </div>
    </div>
  );
}

/** A leaf: one level deeper, its body rendered (and its data asked for) only when it is open. */
export function Leaf({ id, label, sub, open = false, onToggle, children }) {
  return (
    <div className="dht-node" data-leaf={id}>
      <button type="button" className="dht-leaf" aria-expanded={open} onClick={() => onToggle?.(id)}>
        <span><b>{label}</b> {sub && <span className="dht-leaf__sub">{sub}</span>}</span>
        <span className="dht-leaf__tw" aria-hidden="true">›</span>
      </button>
      {open && <div className="dht-deep" data-leaf-body={id}>{children}</div>}
    </div>
  );
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

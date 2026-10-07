// client/src/components/PostingPanel.jsx — D32 · THE POSTING HALF OF THE INK PAIR.
//
// ⛔ ZERO MODEL CALLS (D17) — that is why this version was chosen. Every word on it is already on file:
//   MASTHEAD  orange kicker (domain · level · workplace — D29's tags) · serif display title · the company
//             in the logo face · a FOUR-CELL deck strip: Experience · Workstyle · Salary · Posted (D48:
//             Workstyle replaced Where; location is its muted second line).
//             ⭐ A fact not on file is printed as an italic-serif "not stated" — a VALUE, never a blank.
//             The Experience cell tints when the scorer judged the requirement met.
//   BODY      the employer's ORIGINAL description, formatted plainly (shared/postingFormat.js): a drop
//             cap on the first paragraph, THEIR headings as small uppercase labels with a rule under
//             them, THEIR bullets with accent markers — in Georgia, the sketch's reading face (A86). ⛔ No sectioning, no pull quote, no reordering of their words — the posting stays
//             the employer's document.
// ⛔ THE ATS CONTENT IS NOT IN HERE. It is its own card (components/AtsReport.jsx), beside this one.
// This file reads no report section; it is handed, at most, the scorer's experience judgement.
//
// It sits on the pair's surface (styles/inkPair.css) — cream in light, ink in dark, decided by the
// theme and nowhere else. Nothing moves.
import { deckStrip, kickerFor, NOT_STATED } from "../../../shared/postingFacts.js";
import { formatPosting, markTerm } from "../../../shared/postingFormat.js";
import { textForRender } from "../../../shared/postingNormalize.js";
import { requirementPills } from "../../../shared/postingRequirements.js";
import { usePairLink } from "../lib/pairLink.js";
import "../styles/inkPair.css";
import "./PostingPanel.css";

/** Text with the hover link's one term lit — or untouched when nothing is pointed at. */
function Lit({ text, term }) {
  if (!term) return text;
  return markTerm(text, term).map((s, i) => (s.lit ? <mark key={i} className="posting__lit">{s.text}</mark> : s.text));
}

/** The masthead. `showTitle` false where the surface already shows the title (the deck card's heading). */
export function PostingMasthead({ job, experience = null, showTitle = true, vtTitle = null }) {
  const kicker = kickerFor(job);
  const cells = deckStrip(job, { experience });
  return (
    <header className="posting__mast" data-posting-masthead data-titled={showTitle ? "true" : "false"}>
      {kicker.length > 0 && <div className="posting__kicker" data-posting-kicker>{kicker.join(" · ")}</div>}
      {/* vtTitle: the shared-element title name (lib/viewTransitions.js) — passed only by the posting panel, so the
          deck's expanded copy never carries a second element of the same name. */}
      {showTitle && <h2 className="posting__title" data-vt-title={vtTitle ?? undefined}>{job.title}</h2>}
      {showTitle && job.company && <div className="posting__company">{job.company}</div>}
      <dl className="posting__strip" data-posting-strip>
        {cells.map(c => (
          <div key={c.key} className="posting__cell" data-cell={c.key} data-met={c.met ? "true" : "false"}
            data-stated={c.value == null ? "false" : "true"}>
            {/* A cell that reads for itself (Workstyle) keeps its term for screen readers only. */}
            <dt className={c.labelHidden ? "posting__k--sr" : undefined}>{c.label}</dt>
            {/* ⭐ "not stated" is a VALUE — italic serif — never a blank cell. */}
            <dd>{c.value ?? <span className="posting__ns">{NOT_STATED}</span>}</dd>
            {/* D48: Workstyle's location line — muted, beneath the value. */}
            {c.sub && <dd className="posting__sub" data-cell-sub="">{c.sub}</dd>}
          </div>
        ))}
      </dl>
      <PostingRequirements requirements={job.requirements} />
      <PostingDetails fields={job.postingFields} />
    </header>
  );
}

/**
 * ⛔ D59 · THE REQUIREMENTS ROW — muted STATUS PILLS under the deck strip: "U.S. citizens only · Secret
 * clearance · active required". Non-interactive (D48's rule: spans, never buttons), and each is a fact
 * about the POSTING — never about the reader, and never folded into the ATS score.
 */
export function PostingRequirements({ requirements }) {
  const pills = requirementPills(requirements);
  if (!pills.length) return null;
  return (
    <div className="posting__req" data-posting-requirements="" aria-label="The posting's stated requirements">
      <span className="posting__req-k">Requirements</span>
      {pills.map(p => <span key={p.key} className="posting__pill" data-req={p.key} title={p.title}>{p.label}</span>)}
    </div>
  );
}

/** D59 · the label block's other fields, said once here because they left the body. */
export function PostingDetails({ fields }) {
  if (!fields) return null;
  const items = [
    ["Travel", fields.travel], ["Relocation", fields.relocation], ["Employment", fields.employment],
    ["Site", fields.site], ["Req", fields.requisitionId],
  ].filter(([, v]) => v);
  if (!items.length) return null;
  return (
    <p className="posting__details" data-posting-details="">
      {items.map(([k, v], i) => <span key={k}>{i ? " · " : ""}<span className="posting__details-k">{k}</span> {v}</span>)}
    </p>
  );
}

/** The employer's description, as their own blocks, in their own order. */
export function PostingBody({ text }) {
  const link = usePairLink();
  const term = link?.lit || null;
  // ⛔ D59 · RE-CHECKED AT RENDER: a description not yet normalised (or fetched just now) that still
  // carries markup is read through the same normaliser — and is drawn as React TEXT either way, never
  // as injected HTML.
  const blocks = formatPosting(textForRender(text));
  const lead = blocks.findIndex(b => b.type === "p");
  return (
    <div className="posting__body" data-posting-body>
      {blocks.map((b, i) => {
        if (b.type === "h") return <h3 key={i} className="posting__h"><Lit text={b.text.replace(/:\s*$/, "")} term={term} /></h3>;
        if (b.type === "ul") return (
          <ul key={i} className="posting__ul">
            {b.items.map((it, j) => <li key={j}><Lit text={it} term={term} /></li>)}
          </ul>
        );
        return <p key={i} className={i === lead ? "posting__p posting__p--lead" : "posting__p"}><Lit text={b.text} term={term} /></p>;
      })}
    </div>
  );
}

/**
 * THE POSTING PANEL. `text` defaults to the stored description; `children` is what a surface shows
 * when there is none (the board's fetch states, the deck's "open it at the source").
 */
export default function PostingPanel({ job, text = job?.description, experience = null, showTitle = true, vtTitle = null, children = null }) {
  if (!job) return null;
  const body = String(text || "").trim();
  return (
    <article className="posting ink-pair" data-posting-panel>
      <PostingMasthead job={job} experience={experience} showTitle={showTitle} vtTitle={vtTitle} />
      {body ? <PostingBody text={body} /> : <div className="posting__none">{children}</div>}
    </article>
  );
}

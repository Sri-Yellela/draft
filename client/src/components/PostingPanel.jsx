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
import { useState } from "react";
import { deckStrip, kickerFor, NOT_STATED, COULD_NOT_READ } from "../../../shared/postingFacts.js";
import { formatPosting, markTerm } from "../../../shared/postingFormat.js";
import { textForRender } from "../../../shared/postingNormalize.js";
import { ghostLine } from "../../../shared/ghostScore.js";
import { requirementPills } from "../../../shared/postingRequirements.js";
import { applyLine } from "../../../shared/postingLevel.js";
import { usePairLink } from "../lib/pairLink.js";
import { useAtlasTerms } from "../lib/atlasLinks.js";
import { AtlasText } from "./AtlasTerm.jsx";
import { SponsorshipBlock } from "./SponsorshipSignal.jsx";
import "../styles/inkPair.css";
import "./PostingPanel.css";

/** Text with the hover link's one term lit — or untouched when nothing is pointed at. */
function Lit({ text, term }) {
  if (!term) return text;
  return markTerm(text, term).map((s, i) => (s.lit ? <mark key={i} className="posting__lit">{s.text}</mark> : s.text));
}

/** The masthead. `showTitle` false where the surface already shows the title (the deck card's heading). */
export function PostingMasthead({ job, experience = null, showTitle = true, vtTitle = null, layout = "deck", matchBox = null,
                                 matchPanel = null }) {
  if (layout === "panel") return <PanelMasthead job={job} experience={experience} vtTitle={vtTitle} matchBox={matchBox}
    matchPanel={matchPanel} />;
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
            <dd>{c.value ?? <span className="posting__ns">{c.missing === "unread" ? COULD_NOT_READ : NOT_STATED}</span>}</dd>
            {/* D48: Workstyle's location line — muted, beneath the value. */}
            {c.sub && <dd className="posting__sub" data-cell-sub="">{c.sub}</dd>}
          </div>
        ))}
      </dl>
      <PostingRequirements requirements={job.requirements} />
      <PostingDetails fields={job.postingFields} />
      <PostingLiveness liveness={job.liveness} />
      <PostingGhost ghost={job.ghost} />
      <PostingLevel levelRead={job.levelRead} />
      <PostingApplyLine job={job} />
      {/* ⭐ D121: the ONE signal's block when the server sent it; D108's filings line otherwise (an older response). */}
      {job.sponsorship ? <SponsorshipBlock signal={job.sponsorship} /> : <PostingSponsorship fact={job.sponsorshipFact} />}
    </header>
  );
}

/**
 * ⭐ D147 (owner 11-03, fullhouse-declutter.html) · THE OPENED POSTING'S MASTHEAD — the role in the serif, then THE
 * EXISTING FACTS BOX restyled: experience · workstyle · salary · posted, + history / sponsorship / requirements as
 * CELLS only when the data exists (never as blocks before the posting), and at its end THE MATCH BOX (`matchBox`, the
 * one AtsNumberBox → the existing ATS panel). Nothing sits between this and the job description: no kicker and no
 * company line (the header carries the company), no "In short" / ghost / level lines (D137's ghost filter and D104's
 * eligibility already filter the board). A cell with sources behind it (sponsorship) opens them in place on press.
 */
/** ⭐ D149 · the opened posting says its facts in words, as fullhouse-declutter.html does: "5+ years", "9 hours ago". */
export function panelWords(cell, job, now = Date.now()) {
  if (cell.key === "experience" && cell.value) return { ...cell, value: cell.value.replace(/ yrs$/, " years") };
  if (cell.key === "posted" && job?.postedAt) {
    const s = Math.max(0, (now - Date.parse(job.postedAt)) / 1000);
    if (!Number.isFinite(s)) return cell;
    const n = (v, w) => `${v} ${w}${v === 1 ? "" : "s"} ago`;
    const value = s < 3600 ? "just now" : s < 86400 ? n(Math.floor(s / 3600), "hour") : n(Math.floor(s / 86400), "day");
    return { ...cell, value };
  }
  return cell;
}

function PanelMasthead({ job, experience, vtTitle, matchBox, matchPanel = null }) {
  const [open, setOpen] = useState(null);
  const cells = deckStrip(job, { experience }).map(c => panelWords(c, job));
  const extra = [];
  if (job.liveness?.label) extra.push({ key: "history", label: "History", value: job.liveness.label });
  const sig = job.sponsorship?.level ? job.sponsorship : null;
  if (sig) extra.push({ key: "sponsorship", label: "Sponsorship", value: sig.label, more: <SponsorshipBlock signal={sig} /> });
  else if (job.sponsorshipFact?.text) extra.push({ key: "sponsorship", label: "Visa filings", value: "On file", more: <PostingSponsorship fact={job.sponsorshipFact} /> });
  const req = requirementPills(job.requirements);
  if (req.length) extra.push({ key: "requirements", label: "Requirements", value: req.map(p => p.label).join(" · ") });
  // ⛔ D153 (5) / D152 (7) (owner 11-04): a fact that is not on file is LEFT OUT of the opened posting's facts box — no
  // "not stated" cell. (The deck card's strip, above, keeps its own rule.)
  const all = [...cells, ...extra].filter(c => c.value != null);
  const shown = all.find(c => c.key === open && c.more);
  const toggle = (key) => setOpen(o => (o === key ? null : key));
  return (
    <header className="posting__mast posting__mast--panel" data-posting-masthead data-titled="true" data-d147-masthead="">
      <h2 className="posting__title" data-vt-title={vtTitle ?? undefined}>{job.title}</h2>
      <div className="posting__facts" data-posting-facts="">
        <dl className="posting__strip" data-posting-strip>
          {all.map(c => {
            const inner = (<>
              {/* D149: every cell shows its label here (the sketch labels Workstyle too). */}
              <dt>{c.label}</dt>
              <dd>{c.value ?? <span className="posting__ns">{c.missing === "unread" ? COULD_NOT_READ : NOT_STATED}</span>}</dd>
              {c.sub && c.key !== "workstyle" && <dd className="posting__sub" data-cell-sub="">{c.sub}</dd>}
            </>);
            // ⭐ D149: no location line under Workstyle here — the panel's header carries the location (the sketch's cell
            // is the value over its label, nothing more).
            return c.more ? (
              <div key={c.key} className="posting__cell posting__cell--more" data-cell={c.key} data-stated="true" role="button" tabIndex={0}
                aria-expanded={open === c.key} title={`${c.label} — show the sources`} onClick={() => toggle(c.key)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(c.key); } }}>
                {inner}
              </div>
            ) : (
              <div key={c.key} className="posting__cell" data-cell={c.key} data-met={c.met ? "true" : "false"}
                data-stated={c.value == null ? "false" : "true"}>{inner}</div>
            );
          })}
        </dl>
        {matchBox && <div className="posting__match" data-posting-match="">{matchBox}</div>}
      </div>
      {/* ⭐ D152 (8): the slot right under the facts box where the panel's match opens (option A). The posting draws it
          as given — it holds no report and no motion of its own (D32); JobDetailPanel owns both. */}
      {matchPanel}
      {shown && <div className="posting__cell-more" data-cell-more={shown.key}>{shown.more}</div>}
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

/**
 * ⭐ D107 P2 · IS THIS POSTING ALIVE — what the crawl saw: "Reposted 4 times since June" · "Open 94 days" · "New — first
 * seen yesterday". A fact about the posting's history (services/jobs/jobHistory.js), never a score and never a block.
 */
export function PostingLiveness({ liveness }) {
  if (!liveness?.label) return null;
  return (
    <p className="posting__details" data-posting-liveness={liveness.kind}>
      <span className="posting__details-k">History</span> {liveness.label}
    </p>
  );
}

/**
 * ⭐ D137 · THE GHOST SCORE with its evidence — "Likely not hiring · Reposted 4 times since June · Open 94 days". Said for
 * Uncertain and Likely not hiring only; information, never a block (shared/ghostScore.js).
 */
export function PostingGhost({ ghost }) {
  const line = ghostLine(ghost);
  if (!line) return null;
  return (
    <p className="posting__details" data-posting-ghost={ghost.level}>
      <span className="posting__details-k">Hiring?</span> {line}.
    </p>
  );
}

/** ⭐ D106 P1 · the level the posting's text asks for, said when it is two steps from its title. */
export function PostingLevel({ levelRead }) {
  const d = levelRead?.disagreement;
  if (!d) return null;
  return (
    <p className="posting__details" data-posting-level={d.direction}>
      <span className="posting__details-k">Level</span> {d.text}
    </p>
  );
}

/** ⭐ D106 P2 · the one "should I apply" sentence — information, never a block; the ATS number is unchanged. */
export function PostingApplyLine({ job }) {
  const score = Number.isFinite(job?.matchScore) ? job.matchScore : Number.isFinite(job?.baseAtsScore) ? job.baseAtsScore : null;
  const line = applyLine({ score, eligibility: job?.eligibility, liveness: job?.liveness, level: job?.levelRead, sponsorship: job?.sponsorship, ghost: job?.ghost });
  if (!line) return null;
  return (
    <p className="posting__details" data-apply-line={line.verdict}>
      <span className="posting__details-k">In short</span> {line.text}
    </p>
  );
}

/**
 * ⭐ D108 P1 · the company's public filings — "Filed 290 certified LCAs in FY2025 · median $162k" — then the USCIS hub's
 * "1,204 H-1B approvals FY2022 (USCIS)" when present; each run of facts is followed by ITS source and date. A fact about
 * the EMPLOYER, never about the reader's eligibility; absent when the match is not safe.
 */
export function PostingSponsorship({ fact }) {
  if (!fact?.text) return null;
  const parts = Array.isArray(fact.parts) && fact.parts.length ? fact.parts : [{ kind: "lca", text: fact.text, source: fact.source }];
  // Consecutive parts that share a source are said together, then the source once.
  const groups = [];
  for (const part of parts) {
    const last = groups[groups.length - 1];
    if (last && last.source?.name === part.source?.name) last.texts.push(part.text);
    else groups.push({ source: part.source || {}, texts: [part.text] });
  }
  return (
    <p className="posting__details" data-posting-sponsorship="">
      <span className="posting__details-k">Visa filings</span>{" "}
      {groups.map((g, i) => (
        <span key={i} data-sponsorship-source={g.source.name || ""}>
          {i ? " · " : ""}{g.texts.join(" · ")} ·{" "}
          {g.source.url ? <a href={g.source.url} target="_blank" rel="noopener noreferrer">{g.source.name}</a> : g.source.name}
          {g.source.through ? `, through ${g.source.through}` : g.source.asOf ? `, file dated ${g.source.asOf}` : ""}
        </span>
      ))}
    </p>
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

/**
 * The employer's description, as their own blocks, in their own order.
 * ⭐ D114: `jobId` — the posting's published Atlas terms become quiet links (components/AtlasTerm.jsx), each at its
 * first occurrence in the whole posting; the words themselves are unchanged.
 */
export function PostingBody({ text, jobId = null }) {
  const link = usePairLink();
  const term = link?.lit || null;
  const terms = useAtlasTerms(jobId);
  const used = new Set();   // one posting, top to bottom: a term links once
  const lit = (s) => <Lit text={s} term={term} />;
  const words = (s) => <AtlasText text={s} terms={terms} used={used} render={lit} />;
  // ⛔ D59 · RE-CHECKED AT RENDER: a description not yet normalised (or fetched just now) that still
  // carries markup is read through the same normaliser — and is drawn as React TEXT either way, never
  // as injected HTML.
  const blocks = formatPosting(textForRender(text));
  const lead = blocks.findIndex(b => b.type === "p");
  return (
    <div className="posting__body" data-posting-body>
      {blocks.map((b, i) => {
        if (b.type === "h") return <h3 key={i} className="posting__h">{words(b.text.replace(/:\s*$/, ""))}</h3>;
        if (b.type === "ul") return (
          <ul key={i} className="posting__ul">
            {b.items.map((it, j) => <li key={j}>{words(it)}</li>)}
          </ul>
        );
        return <p key={i} className={i === lead ? "posting__p posting__p--lead" : "posting__p"}>{words(b.text)}</p>;
      })}
    </div>
  );
}

/**
 * ⭐ D171 FIX 3 · THE DESCRIPTION ALONE — an application's posting opened from its Home row (components/AttemptPosting.jsx):
 * the opened posting's body look (D147's panel), no masthead (the row already names the role), in a pane that scrolls.
 */
export function PostingText({ text, jobId = null }) {
  const body = String(text || "").trim();
  if (!body) return null;
  return (
    <article className="posting ink-pair posting--panel posting--kept" data-posting-kept="">
      <PostingBody text={body} jobId={jobId} />
    </article>
  );
}

/**
 * THE POSTING PANEL. `text` defaults to the stored description; `children` is what a surface shows
 * when there is none (the board's fetch states, the deck's "open it at the source").
 */
// ⭐ D147: `layout="panel"` is the opened posting (JobDetailPanel) — its masthead is PanelMasthead, and the label
// block's other fields (travel, relocation …) follow the description instead of preceding it. The deck keeps "deck".
export default function PostingPanel({ job, text = job?.description, experience = null, showTitle = true, vtTitle = null, children = null,
                                       layout = "deck", matchBox = null, matchPanel = null }) {
  if (!job) return null;
  const body = String(text || "").trim();
  const panel = layout === "panel";
  return (
    <article className={`posting ink-pair${panel ? " posting--panel" : ""}`} data-posting-panel data-posting-layout={layout}>
      <PostingMasthead job={job} experience={experience} showTitle={showTitle} vtTitle={vtTitle} layout={layout} matchBox={matchBox}
        matchPanel={matchPanel} />
      {/* ⭐ D149 (fullhouse-declutter.html): the accent eyebrow "The posting" heads the description. */}
      {panel && <p className="posting__eyebrow" data-posting-eyebrow="">The posting</p>}
      {body ? <PostingBody text={body} jobId={job.id ?? null} /> : <div className="posting__none">{children}</div>}
      {panel && <div className="posting__after"><PostingDetails fields={job.postingFields} /></div>}
    </article>
  );
}

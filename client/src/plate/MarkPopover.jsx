// ⭐ D200 RULE 2 · EVERY MARK ANSWERS (owner 11-25, 47h; A243's inventory) — on the market a mark that looks like information
// does something when tapped or focused. The `Maps` board's two popovers (the rules) and the stack chip's:
//   · the FILED H-1B stamp → the company's filings (the DOL's certified LCAs for the fiscal year, USCIS approvals, the median
//     wage when there are enough cases), "Past filings, not a promise." + "See the survey sheet →"
//   · a company logo / letter tile → its technographics: the top technologies from its own postings (stackFor, D179 P5a —
//     NOT the old company_technographics table) with your marks (■ on your résumé / ⬚ not yet) + "Their full stack →"
//   · a stack chip → what the mark means for you + "Show openings using it" (the Technology filter)
// A mark with no data says so ("No filings found for Kestrel", "No stack read from their postings yet") — never nothing.
// The data is lib/companyBrief.js (read only when a popover opens). Esc / a tap outside closes; focus returns to the mark.
import { useEffect, useId, useRef, useState } from "react";
import { useCompanyBrief } from "../lib/companyBrief.js";
import { companyPath } from "../lib/companySlug.js";

const stop = (e) => e.stopPropagation();

/** The popover shell: a button around the mark (its accessible name says what it opens) and the card beneath it. */
export function MarkPopover({ label, mark, children, className = "", markClass = "", kind, tabIndex, onOpen }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btn = useRef(null);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  return (
    <span className={`pl-markpop ${className}`.trim()} data-mark-popover={kind} onPointerDown={stop} onClick={stop}>
      <button ref={btn} type="button" className={`pl-markpop__mark ${markClass}`.trim()} aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={label} data-mark={kind} tabIndex={tabIndex}
        onClick={() => setOpen((o) => { if (!o) onOpen?.(); return !o; })}>{mark}</button>
      {open ? <div ref={box} id={id} role="dialog" aria-label={label} className="pl-markpop__card" data-mark-card={kind}>{children(() => setOpen(false))}</div> : null}
    </span>
  );
}

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : null);

/** Pure: the filings card's lines from a brief (lib/companyBrief.js companyBrief) — what the record holds, nothing more. */
export function filingsLines(brief) {
  if (!brief) return null;
  if (!Number.isFinite(brief.filings) || brief.filings <= 0) return { head: `No H-1B filings found for ${brief.name}${brief.fiscalYear ? ` in FY${brief.fiscalYear}` : ""}.`, rows: [] };
  const rows = [`${fmt(brief.filings)} certified LCA${brief.filings === 1 ? "" : "s"} in FY${brief.fiscalYear}`];
  if (brief.uscis?.approvals) rows.push(`${fmt(brief.uscis.approvals)} H-1B approval${brief.uscis.approvals === 1 ? "" : "s"} FY${brief.uscis.fiscalYear} (USCIS)`);
  if (brief.wage?.medianUsd) rows.push(`median wage $${Math.round(brief.wage.medianUsd / 1000)}k`);
  return { head: rows.join(" · "), rows };
}

function Loading({ status, what }) {
  if (status === "loading" || status === "idle") return <p className="pl-markpop__line pl-muted" role="status">Reading {what}…</p>;
  if (status === "none") return <p className="pl-markpop__line">No survey sheet for this company yet.</p>;
  return <p className="pl-markpop__line">{what[0].toUpperCase() + what.slice(1)} didn’t load. Open it again to retry.</p>;
}

/** The FILED H-1B stamp as a button that opens the company's filings. */
export function H1bStampPopover({ company, children, tabIndex }) {
  const [on, setOn] = useState(false);
  const { status, brief } = useCompanyBrief(company, on);
  const href = company ? companyPath(company) : null;
  return (
    <MarkPopover kind="h1b" label={`H-1B filings${company ? ` for ${company}` : ""} — open the record`} mark={children} markClass="pl-markpop__mark--stamp"
      tabIndex={tabIndex} onOpen={() => setOn(true)}>
      {() => (
        <>
          <div className="pl-markpop__strip"><span className="pl-label">{String(company || "THE EMPLOYER").toUpperCase()} · U.S. DOL DATA</span></div>
          <div className="pl-markpop__body">
            {status === "ready" && brief ? (() => {
              const f = filingsLines(brief);
              return <>
                <p className="pl-markpop__line" data-filings="">{f.head}</p>
                <p className="pl-markpop__note">Past filings, not a promise.{brief.source?.through ? ` Through ${brief.source.through}.` : ""}</p>
              </>;
            })() : <Loading status={status} what="the filings"/>}
            {href ? <a className="pl-markpop__go" href={href}>See the survey sheet →</a> : null}
          </div>
        </>
      )}
    </MarkPopover>
  );
}

/** A company's logo / letter tile (or name) as a button that opens its technographics. */
export function CompanyStackPopover({ company, children, tabIndex, markClass = "" }) {
  const [on, setOn] = useState(false);
  const { status, brief } = useCompanyBrief(company, on);
  const href = company ? companyPath(company) : null;
  return (
    <MarkPopover kind="stack" label={`What ${company || "this company"} builds with — open its stack`} mark={children} markClass={markClass}
      tabIndex={tabIndex} onOpen={() => setOn(true)}>
      {() => (
        <>
          <div className="pl-markpop__strip"><span className="pl-label">{String(company || "THE COMPANY").toUpperCase()} · WHAT THEY BUILD WITH</span></div>
          <div className="pl-markpop__body">
            {status === "ready" && brief ? (brief.tech.length ? (
              <ul className="pl-markpop__rows" data-stack-rows="">
                {brief.tech.slice(0, 6).map((t) => (
                  <li key={t.name}><span aria-hidden="true" className="pl-markpop__sq" data-yours={t.yours === "proven" || t.yours === "listed" ? "true" : "false"}/>
                    {t.name}{Number.isFinite(t.postings) ? ` · ${fmt(t.postings)}${Number.isFinite(t.of) ? ` of ${fmt(t.of)}` : ""}` : ""}
                    <span className="pl-sr">{t.yours == null ? "" : t.yours === "missing" ? " (not on your résumé yet)" : " (on your résumé)"}</span></li>
                ))}
              </ul>
            ) : <p className="pl-markpop__line">No stack read from {brief.name}’s postings yet.</p>) : <Loading status={status} what="their stack"/>}
            {href ? <a className="pl-markpop__go" href={href}>Their full stack →</a> : null}
          </div>
        </>
      )}
    </MarkPopover>
  );
}

/** A stack chip as a button: what it means for you, and the Technology filter. */
export function StackChipPopover({ name, yours, children, onFilter, tabIndex }) {
  return (
    <MarkPopover kind="chip" label={`${name}: ${yours ? "on your résumé" : "not on your résumé yet"} — explain`} mark={children}
      markClass="pl-markpop__mark--chip" tabIndex={tabIndex}>
      {(close) => (
        <div className="pl-markpop__body">
          <p className="pl-markpop__line">{yours ? `${name} is on your résumé, and this posting asks for it.` : `This posting asks for ${name}; your résumé doesn’t show it yet.`}</p>
          {onFilter ? <button type="button" className="pl-markpop__go pl-markpop__go--btn" onClick={() => { close(); onFilter(name); }}>Show openings using {name} →</button> : null}
        </div>
      )}
    </MarkPopover>
  );
}

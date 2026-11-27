// ⭐ D197 Wave 2 · #14 (47j, lane w2-public) · CORRESPONDENCE — the network's one new piece: a LETTER (one message in a
// conversation) or a DISPATCH (one post in the feed), on the library's card. The anatomy carries D180's promises in its
// markup: a link a person wrote is plain words, never a link and never fetched (`link` is drawn as text); a proof moment is
// a stamp the person turned on (green = proven, the only green here); a removed message says so; a job travels as an
// onward ticket. Everything else (People as a gazetteer, Send as a ticket, the composer) is composed from library pieces.
import { plateState, NoData } from "./PlateState.jsx";
import { LetterTile, Stamp } from "./Marks.jsx";
import { Ticket } from "./Tickets.jsx";

/**
 * A letter or a dispatch. `kind` = "letter" | "dispatch"; `from` = { name, href } (a public page, or no link); `when` = the
 * mono date words; `text`; `link` = a URL as the person typed it (shown as words); `proof` = { label } (a proof moment);
 * `job` = { title, company, place, href } | false (a sent job that has closed); `removed`; `mine` (a letter you wrote sits
 * on the right edge's tint); `note` = the strip's right-hand words (UNREAD, MUTED); `actions` = the foot's controls (the
 * caller's: Helpful, Comment, Report, Delete for me …); `children` = what opens under it (comments).
 */
export function CorrespondenceLetter({ kind = "letter", from = {}, when, text, link, proof, job, removed = false, mine = false, note, actions, children, ...s }) {
  const gate = plateState(s, { height: 180, radius: "plate", label: kind === "dispatch" ? "Loading the dispatch" : "Loading the letter", lines: 3 });
  if (gate) return gate;
  const who = from.name || "Someone";
  const head = kind === "dispatch" ? `DISPATCH · ${who}` : mine ? "LETTER · YOURS" : `LETTER · FROM ${who}`;
  return (
    <article className="pl-card" data-letter-kind={kind} data-letter-mine={mine ? "" : undefined}
      aria-label={kind === "dispatch" ? `A post by ${who}` : mine ? "A message you sent" : `A message from ${who}`}
      style={mine ? { background: "var(--pl-region-tint)" } : undefined}>
      <div className="pl-card__strip">
        <span className="pl-label" style={{ overflowWrap: "anywhere" }}>{head.toUpperCase()}</span>
        <span className="pl-label pl-muted">{[when, note].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="pl-card__body">
        {kind === "dispatch" || !mine ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
            <LetterTile name={who} size="sm"/>
            {from.href ? <a href={from.href} style={{ fontWeight: 700, color: "var(--pl-ink)", overflowWrap: "anywhere" }}>{who}</a> : <b style={{ overflowWrap: "anywhere" }}>{who}</b>}
          </div>
        ) : null}
        {removed ? <NoData>THIS MESSAGE WAS REMOVED</NoData> : <>
          {proof ? <span><Stamp tone="lit" rotate={-4}>{proof.label}</Stamp></span> : null}
          {text ? <p className="pl-body" style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{text}</p> : null}
          {link ? <p className="pl-body pl-muted" data-letter-link="" style={{ overflowWrap: "anywhere" }}>{link}</p> : null}
          {job === false ? <NoData>THIS JOB IS NO LONGER OPEN</NoData>
            : job ? <Ticket kicker={kind === "dispatch" ? "A JOB, SHARED" : "A JOB, SENT TO YOU"} title={job.title} line={[job.company, job.place].filter(Boolean).join(" · ")} go="Open the job →" href={job.href}/> : null}
        </>}
        {actions ? <><div className="pl-card__rule"/><div className="pl-actions">{actions}</div></> : null}
        {children}
      </div>
    </article>
  );
}

// ⭐ D197 Wave 2 #14 · M5 (47m, lane public) · the three pieces every Correspondence page composes (the approved mock
// `network`): the SEND TICKET (every composer — a letter, a dispatch, a request's note: write, tear, send), the REPORT block
// (the five reasons as answer buttons + Send the report — the same block on a dispatch, a letter and a conversation) and a
// person's NAME (the letter tile + their public page).

/** A person's name in a gazetteer row: the letter tile and the link to their public page (/in/<handle>) when there is one. */
export function PersonName({ name, href }) {
  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", minWidth: 0 }}>
      <LetterTile name={name || "?"} size="sm"/>
      {href ? <a href={href} style={{ fontWeight: 700, color: "var(--pl-ink)", overflowWrap: "anywhere" }}>{name}</a> : <b style={{ overflowWrap: "anywhere" }}>{name}</b>}
    </span>
  );
}

/**
 * The Send ticket: a perforated card — kicker, the addressee, one line, the text field (and any extra fields as children),
 * the tear, then Send (the clay point while it shows, unless `clay` is false) and Cancel. Controlled: `value` / `onChange`.
 */
export function SendTicket({ kicker, to, note, value, onChange, onSend, onCancel, send = "Send", placeholder = "Write a message", rows = 3, maxLength, clay = true, onKeyDown, children, ...data }) {
  return (
    <div className="pl-ticket" style={{ flex: "none" }} {...data}>
      <div className="pl-ticket__head">
        {kicker ? <span className="pl-label">{kicker}</span> : null}
        {to ? <span className="pl-ticket__title">{to}</span> : null}
        {note ? <span className="pl-ticket__line">{note}</span> : null}
        <textarea className="pl-textarea" rows={rows} maxLength={maxLength} placeholder={placeholder} aria-label={placeholder}
          value={value} onChange={(e) => onChange?.(e.target.value)} onKeyDown={onKeyDown}/>
        {children}
      </div>
      <div aria-hidden="true" className="pl-tear"/>
      <span className="pl-ticket__go" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className={`pl-btn ${clay ? "pl-btn--primary" : "pl-btn--ink"}`} onClick={onSend}>{send}</button>
        {onCancel ? <button type="button" className="pl-btn pl-btn--paper" onClick={onCancel}>Cancel</button> : null}
      </span>
    </div>
  );
}

export const REPORT_REASONS = Object.freeze([["spam", "Spam"], ["harassment", "Harassment"], ["scam", "A scam"], ["inappropriate", "Inappropriate"], ["other", "Something else"]]);

/** The report block: "Why are you reporting this?", the five reasons as answer buttons (one pressed), Send the report / Cancel. */
export function ReportBlock({ question = "Why are you reporting this?", reason, onReason, onSend, onCancel, send = "Send the report", ...data }) {
  return (
    <div className="pl-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }} {...data}>
      <span className="pl-label">{question.toUpperCase()}</span>
      <div role="radiogroup" aria-label={question} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {REPORT_REASONS.map(([k, w]) => (
          <button key={k} type="button" role="radio" aria-checked={reason === k} className={`pl-btn ${reason === k ? "pl-btn--ink" : "pl-btn--paper"}`} onClick={() => onReason?.(k)}>{w}</button>
        ))}
      </div>
      <div className="pl-actions">
        <button type="button" className="pl-btn pl-btn--ink" onClick={onSend}>{send}</button>
        <button type="button" className="pl-btn pl-btn--paper" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

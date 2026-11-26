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

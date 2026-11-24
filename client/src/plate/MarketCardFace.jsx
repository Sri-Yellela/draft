// ⭐ D196 P1 · THE MARKET'S CARD FACE IN PLATES — the board's opening ticket, drawn with the library's own `Opening`
// (A93: built once — the gallery, the F5 fixture and the deck render the same component).
// ⭐ D196 FIX-2 / FIX-4 (owner 11-24, 47f): "retain the frame and flip but also make it pixel diffable". DeckView keeps its
// frame (FanCard, the deck's own CardBack behind, the flip); the ticket takes the board's size (the column's width, its own
// height — plate/deckGeometry.js) and the board's whole anatomy, top to bottom: the mono strip (OPENING · posted, LIVE) ·
// the letter tile + company (a link to its survey sheet) + place · the match % top right (40 px serif + mono MATCH) · the
// title (36 px serif, it WRAPS — never clamped, never cut) · pay / type / mode · WORKS WITH · ✓ ON YOUR RÉSUMÉ chips · the
// FILED H-1B stamp when the employer files · the 2 px dashed tear · Pass · Save · Send · Draft this job (the one clay
// button). Those four call DeckView's own decide() / sendTop — never a second implementation (A93, R6). "Open the posting"
// is not on the board's ticket: the title opens the long post (D168), and Enter still does.
// R6: the hooks the deck and its tests read stay: data-deck-face, data-deck-title-line (the title's heading ref and
// view-transition name), data-deck-signal (the match opens the report), data-company-link, data-deck-action="pass" … .
// R2: no logo → the letter tile; no pay → "Pay not posted"; no sponsorship data → no stamp (nothing says "no").
import { Link } from "react-router-dom";
import PlateRoot from "./PlateRoot.jsx";
import { Opening } from "./Tickets.jsx";
import { cardFacts } from "../lib/deckCardFacts.js";
import { companyPath } from "../lib/companySlug.js";
import { TITLE_ATTR } from "../lib/viewTransitions.js";
import { DECISIONS } from "../lib/deckState.js";
import { sectorRegion } from "./marketPlate.js";

const stop = (e) => e.stopPropagation();
export const STACK_MAX = 6;   // the board shows four; six still sits in two rows at 828 px and wraps cleanly below

/** The board's strip words: "POSTED 2 H AGO" · "POSTED 1 DAY AGO" · "POSTED 3 WEEKS AGO" (from cardFacts' "2 hours"). */
export function postedWords(since) {
  const m = /^(\d+)\s+(hour|day|week|month)s?$/.exec(String(since || "").trim());
  if (!m) return since ? `POSTED ${String(since).toUpperCase()} AGO` : null;
  const n = Number(m[1]);
  return m[2] === "hour" ? `POSTED ${n} H AGO` : `POSTED ${n} ${m[2].toUpperCase()}${n === 1 ? "" : "S"} AGO`;
}

/** Pure: the face's data from a dealt card — what the plate face shows, nothing invented. */
export function openingFromCard(card, now = Date.now()) {
  const job = card?.job || {};
  const facts = cardFacts(card, now);
  const matched = new Set((card?.why?.matched || []).map((s) => String(s).toLowerCase()));
  const posted = facts.stats.find((s) => s.key === "posted")?.value || null;
  const sp = job.sponsorship?.level;
  return {
    company: job.company || "",
    place: job.location || null,
    title: job.title || "",
    match: facts.match,
    pay: facts.info.find((f) => f.key === "salary")?.value || null,
    type: facts.info.find((f) => f.key === "type")?.value || null,
    mode: facts.info.find((f) => f.key === "mode")?.value || null,
    posted: postedWords(posted),
    // the board's "LIVE · CHECKED TODAY": a dealt card carries no check date, so it says LIVE only — never a check it can't back
    live: job.isActive !== false ? "LIVE" : null,
    stack: (job.worksWith || []).map((name) => ({ name, yours: matched.has(String(name).toLowerCase()) })),
    sponsors: sp === "often" || sp === "sometimes",
    region: sectorRegion(job.category || job.categoryName || null),
    companyHref: companyPath(job.company) || null,
    logo: job.companyIconUrl || null,
  };
}

/** Pure: the chips that fit — yours first, but always the first one NOT on your résumé when there is one (the gap is the
 *  useful part; cutting it to make room for another ✓ would hide it). */
export function pickStack(stack, max) {
  if (stack.length <= max) return stack;
  const gap = stack.find((t) => !t.yours);
  if (!gap) return stack.slice(0, max);
  const head = stack.filter((t) => t !== gap).slice(0, max - 1);
  return [...head, gap];
}

const SEND_ICON = (
  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12l16-7-6 16-3-7z"/>
  </svg>
);

/** The board's foot: Pass · Save · Send, a spacer, Draft this job. `tab` = -1 on a card that isn't on top. */
export function TicketActions({ onDecide, onSend, tab, title = "" }) {
  const act = (fn) => (e) => { stop(e); fn?.(); };
  const on = title ? ` ${title}` : "";
  return (
    <>
      <button type="button" className="pl-tbtn" data-deck-action="pass" aria-keyshortcuts="X ArrowLeft" tabIndex={tab}
        aria-label={`Pass${on}`} onClick={act(() => onDecide?.(DECISIONS.PASSED))}>Pass</button>
      <button type="button" className="pl-tbtn" data-deck-action="save" aria-keyshortcuts="S" tabIndex={tab}
        aria-label={`Save${on}`} onClick={act(() => onDecide?.(DECISIONS.SAVED))}>Save</button>
      <button type="button" className="pl-tbtn" data-deck-action="send" tabIndex={tab}
        aria-label={`Send${on}`} onClick={act(onSend)}>{SEND_ICON}Send</button>
      <span className="pl-tbtn__gap"/>
      <button type="button" className="pl-tbtn pl-tbtn--draft" data-deck-action="draft" aria-keyshortcuts="D ArrowRight" tabIndex={tab}
        aria-label={`Draft${on}`} onClick={act(() => onDecide?.(DECISIONS.DRAFTED))}>Draft this job</button>
    </>
  );
}

export default function MarketCardFace({ card, headingRef, isFront, onSignal, onOpenPost, onDecide, onSend, size, bare = false }) {
  const o = openingFromCard(card);
  const id = card?.job?.id;
  const tab = isFront ? undefined : -1;
  const tier = size?.width >= 560 ? "lg" : size?.width >= 400 ? "md" : "sm";
  const opening = { ...o, match: null, stack: pickStack(o.stack, STACK_MAX), stampLand: false };
  const match = o.match && !bare ? (
    <button type="button" className="pl-opening__match pl-mface__match" data-deck-signal-row="" data-deck-signal="" data-deck-match={o.match.numeric ? "number" : "band"}
      {...(o.match.numeric ? { "data-deck-score": parseInt(o.match.value, 10) } : null)}
      onClick={isFront ? (e) => { stop(e); onSignal?.(); } : undefined} tabIndex={tab}
      aria-label={`${o.match.value} résumé match — open the full report`}>
      <span className="pl-opening__pct">{o.match.value}</span><span className="pl-label">MATCH</span>
    </button>
  ) : null;
  const company = o.companyHref
    ? <Link className="pl-opening__coname" to={o.companyHref} onClick={stop} onPointerDown={stop} data-company-link="" tabIndex={tab}>{o.company}</Link>
    : <span className="pl-opening__coname">{o.company}</span>;
  return (
    <PlateRoot region={o.region} className="pl-mface" data-deck-face="" data-deck-home-face="plate" data-plate-face="" data-tier={tier}>
      <Opening as="div" opening={opening} company={company} match={match}
        titleTag="h2"
        titleProps={{ id: `deck-title-${id}`, ref: isFront ? headingRef : undefined, tabIndex: -1, "data-deck-title-line": "",
                      ...(isFront ? { [TITLE_ATTR]: id } : null),
                      // the board's ticket has no "Open the posting": the title opens the long post (D168), as Enter does
                      onClick: isFront && onOpenPost ? (e) => { stop(e); onOpenPost(); } : undefined }}
        actions={bare ? null : <TicketActions onDecide={onDecide} onSend={onSend} tab={tab} title={o.title}/>}/>
    </PlateRoot>
  );
}

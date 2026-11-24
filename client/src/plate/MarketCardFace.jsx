// ⭐ D196 P1 · THE MARKET'S CARD FACE IN PLATES — the board's opening ticket (strip, letter tile, serif title, the facts,
// "works with" chips, the H-1B stamp, the tear line) drawn INSIDE the deck's own card.
// ⛔ The owner's three keeps (11-24): the deck card's FORM FACTOR (DeckView / fanGeometry's sizes — 600 × 372 landscape,
// 300 × 420, the phone's 5 : 7), the deck's own CARD BACKS fanned behind it, and the FLIP — all stay DeckView's. This file
// restyles the FACE only: it fills the box it is given (`size`) and nothing scrolls inside it.
// R6: the hooks the deck and its tests read stay on the same elements — data-deck-face, data-deck-title-line (the title's
// heading ref and view-transition name), data-deck-signal (the match opens the report), data-deck-open-posting (Enter),
// data-company-link. R2: a long title clamps to three lines and wraps (never cut mid-word); no logo → the letter tile; no
// pay → "Pay not posted"; no sponsorship data → no stamp (nothing says "no").
import { Link } from "react-router-dom";
import PlateRoot from "./PlateRoot.jsx";
import { LetterTile, StackChip, Stamp } from "./Marks.jsx";
import { cardFacts } from "../lib/deckCardFacts.js";
import { companyPath } from "../lib/companySlug.js";
import { TITLE_ATTR } from "../lib/viewTransitions.js";
import { sectorRegion } from "./marketPlate.js";

const stop = (e) => e.stopPropagation();
const STACK_MAX = { lg: 5, md: 3, sm: 2 };   // what fits in two rows (one on the landscape card) without cutting a chip

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
    posted: posted ? `${posted} ago`.toUpperCase() : null,
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

export default function MarketCardFace({ card, headingRef, isFront, onSignal, onOpenPost, size, landscape, bare = false }) {
  const o = openingFromCard(card);
  const id = card?.job?.id;
  const tier = landscape ? "lg" : size.width < 280 ? "sm" : "md";
  const stack = pickStack(o.stack, STACK_MAX[tier]);
  const match = o.match && !bare ? (
    <button type="button" className="pl-mface__match" data-deck-signal-row="" data-deck-signal="" data-deck-match={o.match.numeric ? "number" : "band"}
      {...(o.match.numeric ? { "data-deck-score": parseInt(o.match.value, 10) } : null)}
      onClick={isFront ? (e) => { stop(e); onSignal?.(); } : undefined} tabIndex={isFront ? undefined : -1}
      aria-label={`${o.match.value} résumé match — open the full report`}>
      <span className="pl-mface__pct">{o.match.value}</span><span className="pl-label">MATCH</span>
    </button>
  ) : null;
  return (
    <PlateRoot region={o.region} className="pl-mface" data-deck-face="" data-deck-home-face={landscape ? "landscape" : "portrait"} data-plate-face=""
      data-tier={tier} style={{ height: size.height }}>
      <div className="pl-mface__strip">
        <span className="pl-label">OPENING{o.posted ? ` · ${o.posted}` : ""}</span>
        {card?.job?.isActive !== false ? <span className="pl-label pl-tone-lit">LIVE</span> : null}
      </div>
      <div className="pl-mface__body">
        <div className="pl-mface__main">
          <div className="pl-mface__top" data-deck-head="">
            <div className="pl-opening__co">
              <LetterTile name={o.company} logo={o.logo} region={o.region} size={tier === "lg" ? "lg" : "sm"}/>
              <div className="pl-mface__who">
                {o.companyHref
                  ? <Link className="pl-opening__coname" to={o.companyHref} onClick={stop} onPointerDown={stop} data-company-link="">{o.company}</Link>
                  : <span className="pl-opening__coname">{o.company}</span>}
                {o.place ? <span className="pl-opening__place" data-deck-location="">{o.place}</span> : null}
              </div>
            </div>
            {match}
          </div>
          <h2 id={`deck-title-${id}`} ref={isFront ? headingRef : undefined} tabIndex={-1} {...(isFront ? { [TITLE_ATTR]: id } : null)}
            data-deck-title-line="" className="pl-mface__title">{o.title}</h2>
          <div className="pl-opening__facts pl-mface__facts" data-deck-info="">
            <b>{o.pay || "Pay not posted"}</b>{o.type ? <span>{o.type}</span> : null}{o.mode ? <span>{o.mode}</span> : null}
          </div>
        </div>
        {stack.length ? (
          <div className="pl-mface__stack" data-works-with="">
            <span className="pl-label pl-muted">WORKS WITH · ✓ ON YOUR RÉSUMÉ</span>
            <div className="pl-stackchips">{stack.map((t) => <StackChip key={t.name} name={t.name} yours={t.yours}/>)}</div>
          </div>
        ) : null}
        {o.sponsors && tier === "lg" ? <span className="pl-mface__stamp"><Stamp land={false}>FILED H-1B</Stamp></span> : null}
      </div>
      <div aria-hidden="true" className="pl-opening__tear"/>
      <div className="pl-mface__foot">
        <button type="button" className="pl-mface__open" data-deck-open-posting="" tabIndex={isFront ? undefined : -1} aria-keyshortcuts="Enter"
          onClick={(e) => { stop(e); onOpenPost?.(); }}>Open the posting →</button>
        {/* the narrower cards carry the stamp in the foot, beside the go-line, so it never covers the chips */}
        {o.sponsors && tier !== "lg" ? <span className="pl-mface__stamp"><Stamp land={false} rotate={-4}>FILED H-1B</Stamp></span> : null}
      </div>
    </PlateRoot>
  );
}

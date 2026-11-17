// client/src/components/CardPile.jsx — ⭐ 46u (owner 11-17: "use our card design for these decks in each course and
// trivia, just dont leave anything bland"; the 46u sketch's deck and question card, https://claude.ai/artifact/EVGbW7AoRqqwKTnRtiGfUD)
// · DRAFT'S CARD, FOR READING: the jobs deck's card (panels/DeckView.jsx FanCard — the 28 px corner, no border, its one
// soft shadow SHADOW_GLASS, opaque) in an item's pastel, with the cards still to come fanned behind it, one card at a time.
// Next throws the front card off the way Pass does on the deck; the answer FLIPS the card (flipKey). Reduced motion: none.
//
// It is NOT the jobs deck: that card carries a posting, its drag-to-decide and its logo back (deck module). This one is the
// same look for a guide's slides, a course's lessons and the questions — one implementation (A93) for all three.
//
//   <CardPile count={n} at={i} color={pastelVar(id)} renderFace={(k) => …} />           a deck: the backs are its next cards
//   <CardPile color={…} backColors={[a, b]} flipKey={answered} renderFace={() => …} />   one card, two others behind it
import { useEffect, useRef, useState } from "react";
import "./CardPile.css";

export const PILE_THROW_MS = 420;

export default function CardPile({ count = 1, at = 0, color, backColors = null, renderFace, flipKey = null, className = "", ...rest }) {
  const [gone, setGone] = useState(null);   // the card just thrown off, drawn while it leaves
  const prev = useRef(at);
  useEffect(() => {
    const was = prev.current;
    prev.current = at;
    if (at <= was) { setGone(null); return undefined; }
    setGone(was);
    const t = setTimeout(() => setGone(null), PILE_THROW_MS);
    return () => clearTimeout(t);
  }, [at]);
  const left = Math.max(0, count - at - 1);
  const backs = (backColors ?? Array.from({ length: left }, () => color)).slice(0, 2);
  return (
    <div className={`cpile${className ? ` ${className}` : ""}`} style={{ "--cpile-c": color }} data-card-pile="" data-pile-backs={backs.length} {...rest}>
      {backs.map((c, k) => <div key={k} className={`cpile__back cpile__back--${k + 1}`} style={{ background: c }} aria-hidden="true" />)}
      <div key={`${at}:${flipKey ?? ""}`} className={`cpile__card${flipKey ? " cpile__card--flip" : " cpile__card--rise"}`} data-pile-card={at}>
        {renderFace(at)}
      </div>
      {gone != null && gone !== at && <div className="cpile__card cpile__card--gone" aria-hidden="true">{renderFace(gone)}</div>}
    </div>
  );
}

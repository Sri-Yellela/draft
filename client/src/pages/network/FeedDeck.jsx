// ⭐ D194 P4 (47c, owner 11-24: "do d194") · A DECK SHARED IN THE FEED PLAYS INLINE — the reel format: a post whose link is a
// Library deck (/atlas/library/<deck>, the address the Library writes) plays that deck in Read mode — captions on, no sound;
// Watch is one press away and, as everywhere (D194), starts muted. The deck is the public one (GET /api/learn/deck/:id —
// approved decks only, its check without the answer); the check itself stays in the Library, linked at the end.
// A93: a decided reuse — DeckPlay is the Atlas module's player, so this file is a member of BOTH modules (modules.manifest.js).
// Its look is the Library's (LibraryPanel.css, loaded with the Atlas page, which App imports eagerly) — not imported here.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import DeckPlay from "../atlas/DeckPlay.jsx";

/** The deck id a post's link names, or null: "/atlas/library/ml-ai-08", "https://…/app/atlas/library/da-f-01?x". */
export function deckIdFromLink(link) {
  const m = String(link || "").match(/\/atlas\/library\/([a-z]+(?:-[a-z]+)*-\d{2})(?=$|[/?#])/);
  return m ? m[1] : null;
}

export default function FeedDeck({ id }) {
  const [deck, setDeck] = useState(null);
  const [mode, setMode] = useState("read");
  useEffect(() => {
    let live = true;
    api(`/api/learn/deck/${encodeURIComponent(id)}`).then(d => { if (live) setDeck(d && Array.isArray(d.slides) ? d : false); }).catch(() => { if (live) setDeck(false); });
    return () => { live = false; };
  }, [id]);
  if (deck === null) return null;
  if (deck === false) return null;   // not an approved deck: the link stays as the post shows it
  const lesson = `/app/atlas/library/${encodeURIComponent(deck.id)}`;
  return (
    <section data-feed-deck={deck.id} aria-label={`A lesson: ${deck.title}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* 47m (D197 #14): inside the dispatch card — plate type (NetworkPage.css is retired) */}
      <p className="pl-body"><Link to={lesson} style={{ fontWeight: 700, color: "var(--pl-ink)" }}>{deck.title}</Link></p>
      <DeckPlay deck={deck} mode={mode === "cards" ? "read" : mode} onMode={(m) => setMode(m === "cards" ? "read" : m)}
        renderCheck={() => <p className="pl-body" data-feed-deck-check=""><Link to={lesson}>Check yourself in the Library</Link></p>} />
    </section>
  );
}

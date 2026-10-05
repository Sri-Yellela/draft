// client/src/lib/pairLink.js — D32's HOVER LINK between the pair's two halves.
//
// While the reader points at (hovers or focuses) a term's box in the score card, the posting beside it
// lights that term where the employer wrote it. ⭐ This is the connection D2's weave tried to draw with
// threads, now free: no threads, no animation, no layout minimum.
//
// ⛔ ONLY ON REQUEST. Nothing is lit until a box is hovered or focused, and it goes dark the moment the
// pointer or focus leaves. There is no timer, no loop and no standing highlight. Where there is no
// provider (the board's side panel, the public tool, the phone's sheet) the boxes do nothing extra —
// the card renders identically everywhere.
import { createContext, createElement, useContext, useMemo, useState } from "react";

const PairLinkContext = createContext(null);

/** Wrap the two halves of a pair. One term at a time, or none. */
export function PairLinkProvider({ children }) {
  const [lit, setLit] = useState(null);
  const value = useMemo(() => ({ lit, light: (term) => setLit(term || null) }), [lit]);
  return createElement(PairLinkContext.Provider, { value }, children);
}

/** null outside a pair — callers must treat that as "no link here". */
export function usePairLink() {
  return useContext(PairLinkContext);
}

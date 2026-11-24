// ⭐ D196 P1 · THE MARKET'S OPENINGS — the board's section 02: the leg header ("Your openings, best first"), binder tabs
// Deck · Terrain · Index on the panel's edge, and the field card beside the deck.
// ⛔ R6: the deck and the board are the app's own (DeckView, the board column with its bubbles and hover buttons, A175's
// requests) passed in as `deck` and `index`. Both stay MOUNTED while another tab shows (BinderTabs `panels`), so a tab
// switch never reloads the board or re-deals the deck.
// Terrain is NOT drawn yet: the ported terrain places each opening by how many of your top skills it matches, and the deck
// doesn't carry that band per opening yet. The tab says so in the "not yet" drawer (R1) rather than drawing positions it
// can't back.
import { useEffect, useMemo, useState } from "react";
import PlateRoot from "./PlateRoot.jsx";
import { BinderTabs, LegHeader } from "./Plates.jsx";
import { FieldCard } from "./Cards.jsx";
import { Drawer } from "./PlateState.jsx";
import { useFrontCard } from "./marketPlate.js";
import { api } from "../lib/api.js";
import { fieldCardView } from "../../../shared/contextualView.js";
import { useAtlasSlugs, atlasHref } from "../lib/atlasLinks.js";

export const MARKET_TABS = Object.freeze([
  { id: "deck", label: "Deck", sub: "ONE AT A TIME" },
  { id: "terrain", label: "Terrain", sub: "BY SKILLS MATCHED" },
  { id: "index", label: "Index", sub: "EVERY OPENING" },
]);

/** The field card for the card on top of the deck: D192's contextual block, fetched once per card (as the ATS card does). */
export function MarketField() {
  const front = useFrontCard();
  const [state, setState] = useState({ jobId: null, status: "idle", contextual: null });
  const [nonce, setNonce] = useState(0);   // Try again
  useEffect(() => {
    if (!front?.jobId) { setState({ jobId: null, status: "idle", contextual: null }); return undefined; }
    let live = true;
    setState({ jobId: front.jobId, status: "loading", contextual: null });
    api(`/api/jobs/${encodeURIComponent(front.jobId)}/contextual`)
      .then((r) => { if (live) setState({ jobId: front.jobId, status: "ready", contextual: r?.contextual || null }); })
      .catch(() => { if (live) setState({ jobId: front.jobId, status: "error", contextual: null }); });
    return () => { live = false; };
  }, [front?.jobId, nonce]);
  const view = useMemo(() => (state.status === "ready" ? fieldCardView({ report: front?.report || null, contextual: state.contextual }) : null),
    [state, front?.report]);
  const techs = useMemo(() => (view?.gaps || []).map((g) => g.tech).filter(Boolean), [view]);
  const slugs = useAtlasSlugs(techs);
  if (!front?.jobId) return <FieldCard state="empty" emptyText="The field card fills in for the opening on top of the deck."/>;
  if (state.status === "loading" || state.status === "idle") return <FieldCard state="loading"/>;
  if (state.status === "error") return <FieldCard state="error" errorText="Why it fits didn't load." onRetry={() => setNonce((n) => n + 1)}/>;
  if (!view) return <FieldCard state="partial" alike={[]} gaps={[]}/>;
  const gaps = view.gaps.map((g) => ({ text: g.text, link: g.tech && slugs[g.tech] ? { label: "Learn it →", href: atlasHref(slugs[g.tech]) } : null }));
  return <FieldCard alike={view.alike} gaps={gaps} figures={view.figures}/>;
}

export default function MarketOpenings({ deck, index, count = null, field = null }) {   // field: the gallery / F5 fixture's own card
  const [tab, setTab] = useState("deck");
  return (
    <PlateRoot className="pl-marketopenings" data-plate-market-openings="">
      <section className="pl-section" aria-labelledby="mk-openings" id="openings">
        <LegHeader n={2} id="mk-openings-head" meta={`OPENINGS${Number.isFinite(count) ? ` · ${count.toLocaleString("en-US")} FIT YOUR BEARING` : ""}`}
          title={<span id="mk-openings">Your openings, best first</span>}/>
        <p className="pl-lead">The ones that match most of you sit on top. Pass, save or send any of them; Draft starts the application and it moves to your ledger.</p>
        <BinderTabs tabs={MARKET_TABS} selected={tab} onSelect={setTab} label="How to look at your openings" idBase="mk-tab"
          panels={{
            deck: <div className="pl-market-deck">{deck}<div className="pl-market-deck__side">{field || <MarketField/>}</div></div>,
            terrain: <Drawer text="The terrain draws each opening by how many of your top skills it matches. It needs that count for every opening on the deck, which the board doesn't send yet — use Deck or Index meanwhile."/>,
            index,
          }}/>
      </section>
    </PlateRoot>
  );
}

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
import { Ticket } from "./Tickets.jsx";
import { useNavigate } from "react-router-dom";
import { companyPath } from "../lib/companySlug.js";
import { Drawer } from "./PlateState.jsx";
import { useFrontCard } from "./marketPlate.js";
import { api } from "../lib/api.js";
import { fieldCardView } from "../../../shared/contextualView.js";
import { POSTING_ON_DECK_EVENT, DECK_POST_SLOT_ID } from "../lib/jobUrl.js";   // ⭐ A240: a posting opened from the Index shows on the Deck tab
import { useAtlasSlugs, atlasHref } from "../lib/atlasLinks.js";

export const MARKET_TABS = Object.freeze([
  { id: "deck", label: "Deck", sub: "ONE AT A TIME" },
  { id: "terrain", label: "Terrain", sub: "BY SKILLS MATCHED" },
  { id: "index", label: "Index", sub: "EVERY OPENING" },
]);

// One request per card on top, shared by the field card and the onward tickets (a failed answer is not kept, so Try again
// asks again).
const contextualCache = new Map();
function contextualFor(jobId) {
  if (!contextualCache.has(jobId)) {
    const p = api(`/api/jobs/${encodeURIComponent(jobId)}/contextual`).then((r) => r?.contextual || null);
    p.catch(() => contextualCache.delete(jobId));
    contextualCache.set(jobId, p);
  }
  return contextualCache.get(jobId);
}

/** The card on top and its field-card view: { front, status: idle | loading | ready | error, view, retry }. */
export function useFrontField() {
  const front = useFrontCard();
  const [state, setState] = useState({ jobId: null, status: "idle", contextual: null });
  const [nonce, setNonce] = useState(0);   // Try again
  useEffect(() => {
    if (!front?.jobId) { setState({ jobId: null, status: "idle", contextual: null }); return undefined; }
    let live = true;
    setState({ jobId: front.jobId, status: "loading", contextual: null });
    contextualFor(front.jobId)
      .then((c) => { if (live) setState({ jobId: front.jobId, status: "ready", contextual: c }); })
      .catch(() => { if (live) setState({ jobId: front.jobId, status: "error", contextual: null }); });
    return () => { live = false; };
  }, [front?.jobId, nonce]);
  const view = useMemo(() => (state.status === "ready" ? fieldCardView({ report: front?.report || null, contextual: state.contextual }) : null),
    [state, front?.report]);
  return { front, status: state.status, view, retry: () => setNonce((n) => n + 1) };
}

/** The field card for the card on top of the deck: D192's contextual block, fetched once per card (as the ATS card does). */
export function MarketField() {
  const { front, status, view, retry } = useFrontField();
  const techs = useMemo(() => (view?.gaps || []).map((g) => g.tech).filter(Boolean), [view]);
  const slugs = useAtlasSlugs(techs);
  if (!front?.jobId) return <FieldCard state="empty" emptyText="The field card fills in for the opening on top of the deck."/>;
  if (status === "loading" || status === "idle") return <FieldCard state="loading"/>;
  if (status === "error") return <FieldCard state="error" errorText="Why it fits didn't load." onRetry={retry}/>;
  if (!view) return <FieldCard state="partial" alike={[]} gaps={[]}/>;
  const gaps = view.gaps.map((g) => ({ text: g.text, link: g.tech && slugs[g.tech] ? { label: "Learn it →", href: atlasHref(slugs[g.tech]) } : null }));
  return <FieldCard alike={view.alike} gaps={gaps} figures={view.figures}/>;
}

/**
 * Section 03, "Tickets out" — where the market leads next, each ticket only when the page can back it:
 *   the ledger (always; its kicker counts what needs you, from the apply pipeline — the dock's own number),
 *   the survey sheet of the company on top of the deck (when there is one),
 *   an interchange to Atlas for the gap the field card names (when that technology has an Atlas page).
 * The board's "Sailor Health is waiting" / "In 4 of your top openings" need a per-application and an across-openings count
 * the page doesn't have; the tickets say what the page knows instead.
 */
export function MarketTickets({ needsYou = 0, ledgerHref = "/app/auto-apply" }) {
  const navigate = useNavigate();
  const { front, view } = useFrontField();
  const gapTech = (view?.gaps || []).map((g) => g.tech).find(Boolean) || null;
  const slugs = useAtlasSlugs(useMemo(() => (gapTech ? [gapTech] : []), [gapTech]));
  const go = (href) => (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); navigate(href); };
  const co = front?.company ? companyPath(front.company) : null;
  const atlas = gapTech && slugs[gapTech] ? atlasHref(slugs[gapTech]) : null;
  const n = Number(needsYou) || 0;
  return (
    <section className="pl-section pl-section--last" aria-labelledby="mk-onward">
      <LegHeader n={3} meta="ONWARD · FROM THE MARKET" title={<span id="mk-onward">Tickets out</span>}/>
      <p className="pl-lead pl-lead--body">Where this page leads next.</p>
      <div className="pl-tickets" data-market-tickets="">
        <Ticket tone={n ? "clay-tint" : "plain"} href={ledgerHref} onClick={go(ledgerHref)}
          kicker={n ? `THE LEDGER · ${n} NEEDS YOU` : "THE LEDGER"}
          title={n ? `${n} ${n === 1 ? "draft needs" : "drafts need"} you` : "Your applications"}
          line={n ? "Answers only you can give, and drafts to approve before they send." : "Everything you’ve drafted, sent and heard back on."}
          go="Open the ledger →"/>
        {co ? <Ticket href={co} onClick={go(co)} kicker={`SURVEY SHEET · ${String(front.company).toUpperCase()}`} title="Who you’d be joining"
          line="Their stack, their hiring, their H-1B history." go="Open the survey sheet →"/> : null}
        {atlas ? <Ticket href={atlas} onClick={go(atlas)} kicker="⇄ INTERCHANGE · ATLAS" title={gapTech}
          line="The opening on top uses it, and your résumé doesn’t show it yet." go="Learn it in Atlas →"/> : null}
      </div>
    </section>
  );
}

export default function MarketOpenings({ deck, index, count = null, field = null, tickets = null, initialTab = "deck" }) {   // field: the gallery / F5 fixture's own card
  const [tab, setTab] = useState(initialTab);
  // ⭐ A240 (47g, walked): an Index row's title opens its posting through the board's one open path (D168), which draws it in
  // the deck's post slot — inside the Deck tab's panel. With Index selected that panel is hidden, so the click showed
  // nothing (measured: the slot open, ?job= set, the posting 0 × 0). Whenever the board draws a posting on the deck, the
  // openings turn to Deck and bring the posting into view.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onDrawn = (e) => {
      if (!e?.detail?.jobId) return;
      setTab((t) => {
        if (t === "deck") return t;
        requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(DECK_POST_SLOT_ID)?.scrollIntoView?.({ block: "start", behavior: "smooth" })));
        return "deck";
      });
    };
    window.addEventListener(POSTING_ON_DECK_EVENT, onDrawn);
    return () => window.removeEventListener(POSTING_ON_DECK_EVENT, onDrawn);
  }, []);
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
      {tickets ? <MarketTickets {...tickets}/> : null}
    </PlateRoot>
  );
}

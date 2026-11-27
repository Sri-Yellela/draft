// ⭐ D196 P1 · THE MARKET'S OPENINGS — the board's section 02: the leg header ("Your openings, best first"), binder tabs
// Deck · Terrain · Index on the panel's edge, and the field card beside the deck.
// ⛔ R6: the deck and the board are the app's own (DeckView, the board column with its bubbles and hover buttons, A175's
// requests) passed in as `deck` and `index`. Both stay MOUNTED while another tab shows (BinderTabs `panels`), so a tab
// switch never reloads the board or re-deals the deck.
// Terrain is NOT drawn yet: the ported terrain places each opening by how many of your top skills it matches, and the deck
// doesn't carry that band per opening yet. The tab says so in the "not yet" drawer (R1) rather than drawing positions it
// can't back.
import { useEffect, useMemo, useState } from "react";
import { BinderTabs, LegHeader } from "./Plates.jsx";
import { FieldCard } from "./Cards.jsx";
import { Ticket } from "./Tickets.jsx";
import { useNavigate } from "react-router-dom";
import { companyPath } from "../lib/companySlug.js";
import { Drawer } from "./PlateState.jsx";
import { useFrontCard } from "./marketPlate.js";
import { fieldCardView } from "../../../shared/contextualView.js";
import { useAtlasSlugs, atlasHref } from "../lib/atlasLinks.js";
import { useCompanyBrief } from "../lib/companyBrief.js";   // ⭐ D199 C6: the company in brief
import FitCard, { fitCardFor, withPartReasons } from "./FitCard.jsx";   // ⭐ D202: the field card ⇄ the ATS card, one card
import { openingSheetHref } from "./OpeningSheet.jsx";   // ⭐ D199 C7: /app/jobs/<id>
import { CompanyStackPopover } from "./MarkPopover.jsx";

export const MARKET_TABS = Object.freeze([
  { id: "deck", label: "Deck", sub: "ONE AT A TIME" },
  { id: "terrain", label: "Terrain", sub: "BY SKILLS MATCHED" },
  { id: "index", label: "Index", sub: "EVERY OPENING" },
]);

// ⭐ D202 (47h): the card on top is read ONCE, through FitCard's own shared read (GET /api/jobs/:id/fit-card, cached in
// plate/FitCard.jsx fitCardFor) — the field card beside the deck and the onward tickets share it (the old /contextual read
// is gone). `withPartReasons` lives with FitCard now; it is re-exported here for the market's tests.
export { withPartReasons };
/** The card on top and its field-card view: { front, status: idle | loading | ready | error, view, retry }. */
export function useFrontField() {
  const front = useFrontCard();
  const [state, setState] = useState({ jobId: null, status: "idle", data: null });
  const [nonce, setNonce] = useState(0);   // Try again
  useEffect(() => {
    if (!front?.jobId) { setState({ jobId: null, status: "idle", data: null }); return undefined; }
    let live = true;
    setState({ jobId: front.jobId, status: "loading", data: null });
    fitCardFor(front.jobId)
      .then((d) => { if (live) setState({ jobId: front.jobId, status: "ready", data: d || null }); })
      .catch(() => { if (live) setState({ jobId: front.jobId, status: "error", data: null }); });
    return () => { live = false; };
  }, [front?.jobId, nonce]);
  const view = useMemo(() => (state.status === "ready" ? withPartReasons(fieldCardView({ report: state.data?.report || front?.report || null, contextual: state.data?.contextual || null }), state.data?.contextual || null) : null),
    [state, front?.report]);
  return { front, status: state.status, view, retry: () => setNonce((n) => n + 1) };
}

// D199 C7: "Open the opening sheet" goes to the sheet's own address (/app/jobs/<id>, OpeningSheet's openingSheetHref).

/** Pure: the brief's facts line — "214 H-1B filed, FY25 · Hiring ↑ 171 % since June · 38 open roles"; a part not held is left out. */
export function briefFacts(brief) {
  if (!brief) return [];
  const out = [];
  if (Number.isFinite(brief.filings)) out.push({ key: "h1b", b: brief.filings > 0 ? brief.filings.toLocaleString("en-US") : "No", t: brief.filings > 0 ? ` H-1B filed${brief.fiscalYear ? `, FY${String(brief.fiscalYear).slice(-2)}` : ""}` : ` H-1B filings found${brief.fiscalYear ? ` in FY${String(brief.fiscalYear).slice(-2)}` : ""}` });
  else out.push({ key: "h1b", b: null, t: "No H-1B record found" });
  if (brief.trend) out.push({ key: "trend", pre: "Hiring ", b: `${brief.trend.dir === "up" ? "↑" : brief.trend.dir === "down" ? "↓" : "→"} ${Math.abs(brief.trend.pct)} %`, t: brief.trend.since ? ` since ${brief.trend.since}` : "" });
  if (Number.isFinite(brief.openJobs)) out.push({ key: "open", b: brief.openJobs.toLocaleString("en-US"), t: ` open role${brief.openJobs === 1 ? "" : "s"}` });
  return out;
}

/** D199 C6 · the field card's foot: the company in brief (filings, the hiring trend, open roles, their top five technologies
 *  with your marks) and "Open the opening sheet →". Reads lib/companyBrief.js (the survey sheet's own answer). */
export function CompanyBrief({ company, jobId }) {
  const { status, brief } = useCompanyBrief(company, !!company);
  return <CompanyBriefView company={company} jobId={jobId} status={status} brief={brief}/>;
}
/** The brief as drawn, from a read already made (the F5 fixture passes the board's example brief). */
export function CompanyBriefView({ company, jobId, status = "idle", brief = null }) {
  return (
    <div className="pl-fieldbrief" data-company-brief="">
      <span className="pl-label pl-muted">THE COMPANY IN BRIEF</span>
      {status === "ready" && brief ? <>
        <div className="pl-fieldbrief__facts">{briefFacts(brief).map((f) => <span key={f.key}>{f.pre || ""}{f.b != null ? <b>{f.b}</b> : null}{f.t}</span>)}</div>
        {brief.tech.length ? (
          <div className="pl-fieldbrief__chips" aria-label={`${brief.name}'s top technologies`}>
            {brief.tech.slice(0, 5).map((t) => {
              const yours = t.yours === "proven" || t.yours === "listed";
              return (
                <CompanyStackPopover key={t.name} company={company}>
                  <span className="pl-fieldbrief__chip" data-yours={yours ? "true" : "false"}><i aria-hidden="true"/>{t.name}
                    <span className="pl-sr">{t.yours == null ? "" : yours ? " (on your résumé)" : " (not on your résumé yet)"}</span></span>
                </CompanyStackPopover>
              );
            })}
          </div>
        ) : <span className="pl-label pl-muted">NO STACK READ FROM THEIR POSTINGS YET</span>}
      </> : status === "loading" || status === "idle" ? <span className="pl-label pl-muted" role="status">READING THE COMPANY…</span>
        : <span className="pl-label pl-muted">{status === "none" ? "NO SURVEY SHEET FOR THIS COMPANY YET" : "THE COMPANY DIDN’T LOAD"}</span>}
      {jobId ? <a className="pl-fieldcard__sheet" href={openingSheetHref(jobId)} data-opening-sheet="">Open the opening sheet →</a> : null}
    </div>
  );
}

/** ⭐ D202 (owner 11-25) · beside the deck, the FitCard for the card on top — the field card ⇄ the ATS card, the same
 *  component as the opening sheet's section 02. Its front carries the market's company in brief (D199 C6). */
export function MarketField() {
  const front = useFrontCard();
  if (!front?.jobId) return <FieldCard state="empty" emptyText="The field card fills in for the opening on top of the deck."/>;
  return <FitCard key={front.jobId} jobId={front.jobId} company={front.company} brief={<CompanyBrief company={front.company} jobId={front.jobId}/>}/>;
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

// ⭐ D199 C1 (owner 11-25: "the 3rd can live in home and the 1st and 2nd can be merged") · the openings are no longer a section
// of their own: they sit inside the market's ONE section (App.jsx MarketSectionSlot), under the bearing and its controls —
// the binder tabs, then the pager (`pager`). "Tickets out" left the market (MarketTickets stays exported for Home's ledger).
// ⭐ D199 C6: the deck ticket keeps its decided width (.pl-market-deck > :first-child, flex 0 1 560px) and the spare width
// goes to the field card (.pl-market-deck__side, flex 1 1 360px).
export default function MarketOpenings({ deck, index, field = null, initialTab = "deck", pager = null }) {   // field: the gallery / F5 fixture's own card
  const [tab, setTab] = useState(initialTab);
  // ⛔ 47m (D199 C7): an Index row opens its opening sheet (/app/jobs/<id>), so the A240 turn-to-Deck listener is gone.
  return (
    <div className="pl-marketopenings" data-plate-market-openings="" id="openings">
      <BinderTabs tabs={MARKET_TABS} selected={tab} onSelect={setTab} label="View openings" idBase="mk-tab"
        panels={{
          deck: <div className="pl-market-deck">{deck}<div className="pl-market-deck__side">{field || <MarketField/>}</div></div>,
          terrain: <Drawer text="The terrain draws each opening by how many of your top skills it matches. It needs that count for every opening on the deck, which the board doesn't send yet — use Deck or Index meanwhile."/>,
          index,
        }}/>
      {pager}
    </div>
  );
}

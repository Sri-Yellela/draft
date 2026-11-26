// ⭐ D197 Wave 2 · #22 · M3 (47j, lane w2-public) · "Off the map" — the 404, its small cousins (Something broke, Being
// redrawn) and the in-page empty / error / partial states, only from the plate library. M1 / M2: docs/revamp/errors.md.
// Served at /dev/plate?page=off-the-map (&w=390); #broke / #busy pick a variant. Example data only.
import { useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { Kickers } from "../../../plate/Marks.jsx";
import { PageTitle, LegHeader } from "../../../plate/Plates.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";
import { Drawer, ErrorLine, NoData, Skeleton } from "../../../plate/PlateState.jsx";
import { PublicNav, UnchartedPlate } from "../../../plate/PublicPages.jsx";
import { PUBLIC_LINKS, isPhone } from "./publicFixtures.jsx";

const VARIANTS = {
  missing: { kicker: ["404", "NO PAGE AT /KESTREL-PAYMENTS-JOBZ"], title: "Off the map", lead: "There's no page at this address — it may have moved, or the link was mistyped.",
    back: { kicker: "THE ONE WAY BACK", title: "Back to the front door", go: "Go →", href: "#home" } },
  broke: { kicker: ["SOMETHING BROKE", "THIS PAGE ONLY"], title: "This page hit a fault", lead: "The rest of draft still works. Reloading usually fixes it; if it doesn't, the market is one step away.",
    back: { kicker: "THE ONE WAY BACK", title: "Reload this page", go: "Reload →", href: "#reload" } },
  busy: { kicker: ["503", "TRY AGAIN IN A MINUTE"], title: "The map is being redrawn", lead: "So many people asked at once that this page is still being drawn. It will be ready in a minute or two.",
    back: { kicker: "THE ONE WAY BACK", title: "Browse every open job", go: "Open jobs →", href: "#jobs" } },
};

export default function OffTheMapMock({ width }) {
  const phone = isPhone(width);
  const [v, setV] = useState(() => (/broke/.test(globalThis.location?.hash || "") ? "broke" : /busy/.test(globalThis.location?.hash || "") ? "busy" : "missing"));
  const d = VARIANTS[v];
  return (
    <PlateRoot region="I" style={{ minHeight: "100vh", fontSize: "var(--pl-t-ui-lg)", lineHeight: 1.5 }}>
      <PublicNav links={PUBLIC_LINKS} phone={phone} clay={false}/>
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 40, paddingTop: 28, paddingBottom: 72 }}>
        <div role="group" aria-label="Variant" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(VARIANTS).map((k) => <button key={k} type="button" className="pl-btn pl-btn--paper" aria-pressed={v === k} onClick={() => setV(k)}>{k === "missing" ? "404" : k === "broke" ? "Something broke" : "Being redrawn (503)"}</button>)}
        </div>
        <section style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center" }} aria-labelledby="otm-title">
          <div style={{ flex: "999 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <Kickers parts={d.kicker}/>
            <PageTitle id="otm-title">{d.title}</PageTitle>
            <p className="pl-lead">{d.lead}</p>
            <div className="pl-tickets" style={{ marginTop: 6 }}>
              <Ticket tone="clay" {...d.back}/>
            </div>
          </div>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <UnchartedPlate label="the edge of the known map" aspect="640 / 420" caption="PLATE · OFF THE MAP · DRAWING TO COME"/>
          </div>
        </section>
        <section aria-label="Other roads" className="pl-tickets">
          <Ticket kicker="THE MARKET" title="Open jobs" line="Every job on draft, open to read." go="Browse →" href="#jobs"/>
          <Ticket kicker="ATLAS · VOL. I" title="Atlas" line="The skills each role asks for, drawn as a map you walk." go="Open Atlas →" href="#atlas"/>
        </section>

        {/* the small cousins: the in-page states every plate component already draws (PlateState.jsx) */}
        <section aria-labelledby="otm-states" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <LegHeader n={1} id="otm-states" meta="INSIDE A PAGE · ONE IMPLEMENTATION (plate/PlateState.jsx)" title="Not yet, a fault, still drawing"/>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}><span className="pl-label pl-muted">EMPTY · WAS EmptyState</span>
              <Drawer text="No jobs on the board yet. Add any job with the extension; it lands under +." action={{ label: "Get the extension", href: "#extension" }}/></div>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}><span className="pl-label pl-muted">ERROR</span>
              <ErrorLine text="The board couldn't load just now." onRetry={() => {}}/></div>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}><span className="pl-label pl-muted">LOADING · NEVER A SPINNER</span>
              <Skeleton label="Loading the board" lines={3}/></div>
            <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}><span className="pl-label pl-muted">PARTIAL</span>
              <NoData>STACK · NO DATA YET</NoData></div>
          </div>
        </section>
      </main>
    </PlateRoot>
  );
}

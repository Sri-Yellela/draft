// ⭐ D197 Wave 2 · #16 · M3 (47j, lane w2-public) · the signed-out market, /jobs — a mock made only from the plate library
// (docs/revamp/public.md §1 is its M1, §6 its brief). Served at /dev/plate?page=public-jobs (&w=390). Example data only.
// Signed out there is NO user data: no match, no résumé marks, no hatching (that is "fits you"), no "you" on the map.
import { useState } from "react";
import { Kickers, FilterChips } from "../../../plate/Marks.jsx";
import { StatsStrip, LegHeader, BinderTabs } from "../../../plate/Plates.jsx";
import { Opening, DeckPile, Ticket, Cartouche } from "../../../plate/Tickets.jsx";
import { Gazetteer } from "../../../plate/Lists.jsx";
import { NavSearch } from "../../../plate/Shell.jsx";
import { MarketMap } from "../../../plate/MarketMap.jsx";
import MarketPager from "../../../plate/MarketPager.jsx";
import { UnchartedPlate } from "../../../plate/PublicPages.jsx";
import { PublicFrame, SECTORS, POSTINGS, isPhone } from "./publicFixtures.jsx";

const TOTAL = 12480;
const INDEX_COLS = [
  { key: "n", label: "#", kind: "num" }, { key: "title", label: "OPENING", kind: "title" }, { key: "company", label: "COMPANY" },
  { key: "place", label: "PLACE" }, { key: "pay", label: "PAY", kind: "mono" }, { key: "posted", label: "POSTED", kind: "mono" },
  { key: "act", label: "", render: () => <span style={{ display: "inline-flex", gap: 6 }}><a className="pl-btn pl-btn--paper" href="#register">Save</a><a className="pl-btn pl-btn--paper" href="#register">Draft</a></span> },
];
const ROLES = [
  { id: "r1", n: "1", title: "Backend engineering", company: "Software engineering", count: "1,612", href: "#role-backend" },
  { id: "r2", n: "2", title: "Full-stack engineering", company: "Software engineering", count: "1,154", href: "#role-fullstack" },
  { id: "r3", n: "3", title: "Frontend engineering", company: "Software engineering", count: "1,008", href: "#role-frontend" },
  { id: "r4", n: "4", title: "Data engineering", company: "Data & AI", count: "742", href: "#role-data-eng" },
  { id: "r5", n: "5", title: "Machine learning engineering", company: "Data & AI", count: "531", href: "#role-ml" },
];
const COMPANIES = [
  { id: "c1", title: "Kestrel Payments", open: "38 open", fresh: "6 new this week", href: "#kestrel" },
  { id: "c2", title: "Northwind Analytics", open: "27 open", fresh: "3 new this week", href: "#northwind" },
  { id: "c3", title: "Halcyon Robotics", open: "19 open", fresh: "—", href: "#halcyon" },
  { id: "c4", title: "Brightline Health", open: "16 open", fresh: "2 new this week", href: "#brightline" },
];
const TECH = [["React", 1840], ["Python", 2206], ["TypeScript", 1512], ["AWS", 1977], ["Go", 604], ["Kafka", 288]]
  .map(([label, count], i) => ({ id: `t${i}`, tag: "TECH", region: "IV", label, count }));

export default function PublicJobsMock({ width }) {
  const phone = isPhone(width);
  const [tab, setTab] = useState("deck");
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);
  const p = POSTINGS[at % POSTINGS.length];
  const pickedName = SECTORS.find((s) => s.id === picked)?.name || null;
  return (
    <PublicFrame width={width} current="jobs">
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 28 }}>
        {/* the one-line header (a working page, D200): what it is in plain words + where / when */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-labelledby="pj-title">
          <Kickers parts={["THE MARKET · OPEN TO EVERYONE", "WEEK 48", "EXAMPLE DATA"]}/>
          <h1 id="pj-title" className="pl-mk-hero__title">{TOTAL.toLocaleString("en-US")} open jobs{pickedName ? ` in ${pickedName}` : ""}</h1>
          <p className="pl-mk-hero__line">Every job on draft, open to read. <a href="#register" style={{ color: "var(--pl-ink)", fontWeight: 700 }}>Sign up</a> to save one, draft your résumé for it, or apply.</p>
          <StatsStrip label="The open board" cells={[
            { value: TOTAL, label: "OPEN JOBS", href: "#jobs" }, { value: 1906, label: "NEW THIS WEEK", href: "#new" },
            { value: 2311, label: "COMPANIES", href: "#companies" }, { value: 4061, label: "FILED H-1B", href: "#sponsor" }]}/>
          <NavSearch placeholder="Company, role, tech or title…"/>
          <Cartouche kicker="THE BEARING · ANYONE'S" source="SIGN UP AND IT SETS ITSELF FROM YOUR RÉSUMÉ"
            parts={["discovering ", { id: "role", text: pickedName ? pickedName.toLowerCase() : "any role", label: "Role. Change it" }, " roles, at ", { id: "level", text: "any", label: "Level. Change it" },
              " level, ", { id: "ws", text: "any", label: "Workstyle. Change it" }, " workstyle, ", { id: "loc", text: "anywhere", label: "Location. Change it" },
              ", using ", { id: "tech", text: "any technology", label: "Technology. Change it" }, "."]}
            actions={picked ? <button type="button" className="pl-btn pl-btn--dashed" onClick={() => setPicked(null)}>Clear all</button> : null}/>
        </section>

        <section aria-labelledby="pj-map">
          <LegHeader n={1} id="pj-map" meta="THE POLITICAL MAP · AREA = OPEN JOBS · CAPITALS = HIRING MOST" title="Where the openings are"/>
          <div style={{ marginTop: 16 }}>
            <MarketMap sectors={SECTORS} picked={picked} figures={{ fit: TOTAL, newToday: 212, filed: 4061 }} onPick={setPicked}
              caption="PLATE · THE MARKET, SIGNED OUT · EXAMPLE DATA"/>
          </div>
        </section>

        <section aria-labelledby="pj-open">
          <LegHeader n={2} id="pj-open" meta="ONE AT A TIME, OR EVERY OPENING · NO MATCH UNTIL YOU SIGN UP" title="Every opening"/>
          <div style={{ marginTop: 16 }}>
            <BinderTabs label="View openings" selected={tab} onSelect={setTab} idBase="pj-tab"
              tabs={[{ id: "deck", label: "Deck", sub: "ONE AT A TIME" }, { id: "index", label: "Index", sub: "EVERY OPENING" }]}>
              {tab === "deck" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
                  <DeckPile>
                    <Opening opening={{ ...p, match: null, type: "Full-time", posted: p.posted.toUpperCase(), live: "LIVE · CHECKED TODAY", companyHref: "#company" }}
                      actions={<>
                        <button type="button" className="pl-btn" onClick={() => setAt(Math.max(0, at - 1))} aria-label="Back">‹</button>
                        <button type="button" className="pl-btn" onClick={() => setAt(at + 1)}>Pass</button>
                        <a className="pl-btn" href="#register">Save</a><a className="pl-btn" href="#posting">Read it</a>
                        <span className="pl-grow"/><a className="pl-btn pl-btn--ink" href="#register">Draft</a>
                      </>}/>
                  </DeckPile>
                  <span className="pl-label pl-muted" aria-live="polite">{(at % POSTINGS.length) + 1} OF {TOTAL.toLocaleString("en-US")}</span>
                </div>
              ) : (
                <Gazetteer label="Every opening" cols={phone ? INDEX_COLS.filter((c) => ["n", "title", "company", "act"].includes(c.key)) : INDEX_COLS}
                  rows={POSTINGS.map((o, i) => ({ ...o, n: String(i + 1), pay: o.pay || "—", href: "#posting" }))}/>
              )}
            </BinderTabs>
          </div>
          <div className="pl-tickets">
            <Ticket tone="clay-tint" kicker="SIGN UP FREE · NO CARD" title="Draft tailors your résumé to each of these" line="…and fills the employer's own form, then waits for you." go="Sign up →" href="#register"/>
          </div>
          <div style={{ marginTop: 16 }}><MarketPager page={1} totalPages={250} total={TOTAL} pageSize={50} onGo={() => {}}/></div>
        </section>

        <section aria-labelledby="pj-gz">
          <LegHeader n={3} id="pj-gz" meta="THE GAZETTEER · EACH ROLE HAS ITS OWN PAGE" title="Popular roles, technologies and companies"/>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 16, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}><UnchartedPlate label="a gazetteer page, grid-lettered" aspect="640 / 420" caption="DRAWING TO COME · THE GAZETTEER"/></div>
            <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              <Gazetteer label="Popular roles" cols={[{ key: "n", label: "#", kind: "num" }, { key: "title", label: "ROLE", kind: "title" }, { key: "company", label: "SECTOR" }, { key: "count", label: "OPEN", kind: "mono" }]} rows={ROLES}/>
              <FilterChips label="Hiring by technology" chips={TECH} onToggle={() => {}}/>
              <Gazetteer label="Companies hiring now" cols={[{ key: "title", label: "COMPANY", kind: "title" }, { key: "open", label: "OPEN", kind: "mono" }, { key: "fresh", label: "THIS WEEK", kind: "mono" }]} rows={COMPANIES}/>
            </div>
          </div>
        </section>

        <section aria-label="Where to go next" className="pl-tickets">
          <Ticket kicker="NO ACCOUNT · NOTHING KEPT" title="Check a résumé" line="Your résumé against one job, read the way an applicant-tracking system reads it." go="Open the ATS check →" href="#ats"/>
          <Ticket kicker="THE 3-MINUTE AUDIT" title="Do you clear the bar?" line="Ten questions for a role, and what closes the distance." go="Take the audit →" href="#audit"/>
          <Ticket kicker="ATLAS · VOL. I" title="Learn what the market asks for" line="The skills each role asks for, drawn as a map you walk." go="Open Atlas →" href="#atlas"/>
        </section>
      </main>
    </PublicFrame>
  );
}

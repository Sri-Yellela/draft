// ⭐ D197 Wave 2 · #16 · M3 (47j, lane w2-public) · the signed-out CHROME in plate — the public nav (signed out, signed in,
// Get started in ink where the page has its own clay point, the phone with its Menu open) and the public footer — shown
// around the heads of the three server-rendered pages it will wear (a posting, a gazetteer sheet, the roadmap). M1: docs/
// revamp/public.md §2–§5b. Served at /dev/plate?page=public-chrome (&w=390). Example data only.
import { PublicNav, UnchartedPlate } from "../../../plate/PublicPages.jsx";
import { Kickers, Stamp, StackChip } from "../../../plate/Marks.jsx";
import { PageTitle, StatsStrip, LegHeader } from "../../../plate/Plates.jsx";
import { Gazetteer, RouteLine } from "../../../plate/Lists.jsx";
import { Ticket } from "../../../plate/Tickets.jsx";
import { PublicFrame, PUBLIC_LINKS, isPhone } from "./publicFixtures.jsx";

const STATIONS = [["SQL", "start"], ["Python", "start"], ["Git and Linux", "start"], ["Data modelling", "build"], ["Warehousing", "build"], ["ETL and ELT", "build"],
  ["Spark", "deepen"], ["Cloud", "deepen"], ["Orchestration (Airflow)", "deepen"], ["Streaming (Kafka)", "master"], ["End-to-end projects", "master"]]
  .map(([name, stage]) => ({ name, stage, state: "ahead" }));

function Variant({ title, children }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="pl-label pl-muted">{title}</span>
      <div style={{ border: "var(--pl-border-dashed)", borderRadius: "var(--pl-r-small)", overflow: "visible" }}>{children}</div>
    </section>
  );
}

export default function PublicChromeMock({ width }) {
  const phone = isPhone(width);
  return (
    <PublicFrame width={width} current="jobs">
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 40, paddingTop: 28 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 18 }} aria-label="The public nav, every state">
          <LegHeader n={1} meta="REPLACES components/NavBar.jsx · EVERY ITEM KEPT (public.md §5b)" title="The public nav"/>
          <Variant title="SIGNED OUT · GET STARTED IS THE PAGE'S ONE CLAY POINT"><PublicNav links={PUBLIC_LINKS} current="atlas" phone={phone}/></Variant>
          <Variant title="SIGNED IN · OPEN DRAFT · ADMIN · SIGN OUT"><PublicNav links={PUBLIC_LINKS} current="about" user={{ admin: true }} phone={phone}/></Variant>
          <Variant title="ON A PAGE WITH ITS OWN CLAY POINT (THE SURVEY SHEET) · GET STARTED IN INK"><PublicNav links={PUBLIC_LINKS} clay={false} phone={phone}/></Variant>
          <Variant title="PHONE · THE MENU OPEN"><div style={{ maxWidth: 390, minHeight: 340 }}><PublicNav links={PUBLIC_LINKS} current="jobs" phone menuOpen/></div></Variant>
        </section>

        {/* a posting's page (server-rendered today, publicJobPage.js) — the opening sheet's head, signed out */}
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-labelledby="pc-post">
          <LegHeader n={2} meta="/<COMPANY>/<ID> · SERVER-RENDERED · JOBPOSTING JSON-LD KEPT" title="A posting, signed out"/>
          <Kickers parts={["OPENING", "KESTREL PAYMENTS", "BOSTON, MA", "POSTED 2 H AGO"]}/>
          <PageTitle id="pc-post">Frontend Engineer II, Checkout</PageTitle>
          <p className="pl-body">Kestrel Payments · Hybrid · Boston, MA · $150k–$180k</p>
          <p className="pl-body pl-muted">Posted by Kestrel Payments on their careers site · <a href="#original">View the original posting ↗</a></p>
          <div className="pl-actions">
            <a className="pl-btn pl-btn--primary" href="#register">Draft this job</a>
            <span className="pl-body pl-muted" style={{ alignSelf: "center" }}>a résumé tailored to it, and the application filled in</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {["React", "TypeScript", "Next.js", "Playwright"].map((n) => <StackChip key={n} name={n} yours={false}/>)}
            <Stamp>FILED H-1B · FY25</Stamp>
          </div>
        </section>

        {/* a gazetteer sheet: the D179 P7 / D185-6 landing pages, with real counts (no thin pages) */}
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-labelledby="pc-gz">
          <LegHeader n={3} meta="/JOBS/SPONSOR-H1B/<ROLE>/IN/<METRO> · ITEMLIST JSON-LD · 404 UNDER 10 JOBS" title="A gazetteer sheet"/>
          <Kickers parts={["GAZETTEER", "SOFTWARE ENGINEERING", "BACKEND", "BOSTON", "EMPLOYERS WITH CERTIFIED H-1B FILINGS"]}/>
          <PageTitle id="pc-gz">Backend engineering jobs in Boston at H-1B filers</PageTitle>
          <StatsStrip label="This page's counts" cells={[{ value: 214, label: "OPEN NOW" }, { value: 31, label: "EMPLOYERS" }, { value: 1880, label: "CERTIFIED FILINGS" }]}/>
          <div className="pl-actions"><a className="pl-btn pl-btn--ink" href="#jobs">Browse and filter all 214</a></div>
          <Gazetteer label="Their H-1B filing history" cols={[{ key: "title", label: "EMPLOYER", kind: "title" }, { key: "cert", label: "CERTIFIED", kind: "mono" }, { key: "latest", label: "LATEST", kind: "mono" }, { key: "open", label: "OPEN HERE", kind: "mono" }]}
            rows={[{ id: "k", title: "Kestrel Payments", cert: "214", latest: "FY25", open: "12" }, { id: "n", title: "Northwind Analytics", cert: "96", latest: "FY25", open: "7" }, { id: "h", title: "Halcyon Robotics", cert: "41", latest: "FY24", open: "3" }]}/>
          <p className="pl-body pl-muted">From the U.S. Department of Labor's public LCA disclosure data. A filing record is history, not a promise that a role is sponsored. Not legal advice.</p>
        </section>

        {/* the roadmap (D193-5): a route sheet */}
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-labelledby="pc-rm">
          <LegHeader n={4} meta="/LEARN/DATA-ENGINEERING-ROADMAP · ITEMLIST JSON-LD · DECK FILES ONLY" title="A route sheet"/>
          <Kickers parts={["ROUTE", "VOL. I", "DATA ENGINEERING"]}/>
          <PageTitle id="pc-rm">Data engineering roadmap 2027</PageTitle>
          <StatsStrip label="The route" cells={[{ value: 11, label: "STATIONS" }, { value: 21, label: "SHORT LESSONS" }]}/>
          <UnchartedPlate label="the route across the terrain" aspect="640 / 300" caption="DRAWING TO COME · THE ROUTE, DRAWN"/>
          <RouteLine label="The stations, in order" stops={STATIONS}/>
          <div className="pl-tickets">
            <Ticket tone="clay-tint" kicker="START HERE · 3 POINTS, THEN SIGN UP" title="Sign up to keep learning" line="Your progress lives on each station — it counts on every route through it." go="Sign up →" href="#register"/>
            <Ticket kicker="THE LIBRARY" title="Every lesson on this route" line="Short decks, read or watched." go="Open the Library →" href="#library"/>
          </div>
        </section>
      </main>
    </PublicFrame>
  );
}

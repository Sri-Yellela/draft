// ⭐ D196 F5 · the regression run's build side — each fixture composes plate components with the SKETCH's example data
// (the same words, counts and order the board shows), so scripts/d196Regress.mjs can diff the build against the board.
// A fixture is never tuned to pass: when a diff fails, the component is fixed (D196 F5), and the fixture keeps the
// board's data.
import PlateRoot from "./PlateRoot.jsx";
import { AreaNav, Dock } from "./Shell.jsx";
import { MemoryRouter } from "react-router-dom";
import MarketCardFace from "./MarketCardFace.jsx";
import PlateBearing from "./PlateBearing.jsx";
import MarketHero from "./MarketHero.jsx";
import MarketOpenings, { MarketTickets } from "./MarketOpenings.jsx";
import { publishFrontCard } from "./marketPlate.js";
import { DRAWINGS } from "./drawings/index.js";
import { FieldCard } from "./Cards.jsx";

const MARKET_VIEWS = [
  { id: "picks", label: "Today’s picks", href: "#picks", icon: "picks" },
  { id: "all", label: "All jobs", href: "#all", icon: "list" },
  { id: "starred", label: "Starred", href: "#starred", icon: "starred" },
  { id: "imported", label: "Imported", href: "#imported", icon: "imported" },
];
// the board's dock: Home 1, Network 3, Profile MC with 9+
const BOARD_DOCK = [
  { id: "auto-apply", label: "Home", href: "#home", icon: "home", badge: 1 },
  { id: "atlas", label: "Atlas", href: "#atlas", icon: "atlas" },
  { id: "interview", label: "Interview", href: "#interview", icon: "interview" },
  { id: "network", label: "Network", href: "#network", icon: "network", badge: 3 },
  { id: "profile", label: "Profile", href: "#profile", initials: "MC", badge: 12 },
];

/** The market board's shell: the dock (the /d tile current) beside the market's area nav (no pill), 1280 wide. */
export function ShellMarket() {
  return (
    <PlateRoot style={{ minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        <Dock items={BOARD_DOCK} ask={{ href: "#ask" }} current="home"/>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <AreaNav area="The market" views={MARKET_VIEWS} current="picks" more={[{ label: "Companies", href: "#co" }]}
            search={{ placeholder: "Company, role, tech…" }} chip={{ kind: "drafts", used: 7, of: 10, href: "#ledger" }}/>
        </div>
      </div>
    </PlateRoot>
  );
}

// the market board's first opening (Kestrel), as a dealt card carries it — posted 2 h before the fixture's clock
const BOARD_CARD = {
  score: 91, why: { matched: ["React", "TypeScript", "Next.js", "Playwright"], missing: ["Datadog RUM"] },
  job: { id: "kestrel-1", company: "Kestrel Payments", location: "Boston, MA", title: "Frontend Engineer II, Checkout",
    postedAt: new Date(Date.now() - 2 * 3600e3).toISOString(), salaryMin: 150000, salaryMax: 180000, contractType: "Full-time", workplaceType: "hybrid",
    worksWith: ["React", "TypeScript", "Next.js", "Playwright", "Datadog RUM"], sponsorship: { level: "often" } },
};
/** The market's card face (P1) in the deck's OWN frames — landscape 600 × 372 and portrait 300 × 420 (the owner's form
 *  factor), corner 26 — side by side with the board's opening (a look, not a pixel gate: the sizes differ on purpose). */
export function MarketFace() {
  const frame = (w, h) => ({ position: "relative", width: w, height: h, borderRadius: 26, overflow: "hidden" });
  return (
    <MemoryRouter>
      <div data-market-face-fixture="" style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24 }}>
        <article style={frame(600, 372)}><MarketCardFace card={BOARD_CARD} isFront size={{ width: 600, height: 372 }} landscape/></article>
        <article style={frame(300, 420)}><MarketCardFace card={BOARD_CARD} isFront size={{ width: 300, height: 420 }} landscape={false}/></article>
      </div>
    </MemoryRouter>
  );
}

/** The bearing (P1) with the board's clauses where the sentence model has them (React, Boston), 1280 wide. */
export function MarketBearing() {
  return (
    <div data-market-bearing-fixture="" style={{ width: 860, padding: 24 }}>
      <PlateBearing params={{ tech: "React", location: "Boston" }} allSlot="all"/>
    </div>
  );
}

/** The market's hero (P1) with the board's figures and best match (Maya Chen's example: 412 · 179 · 167, Kestrel 91 %). */
export function MarketHeroBoard() {
  return (
    <div style={{ maxWidth: 1182 }}>
      <MarketHero figures={{ fit: 412, newToday: 179, filed: 167, strong: 23 }} sector="Software engineering" role="Frontend" level="mid" week={47}
        from="From Maya_Chen.pdf · Boston" place="Boston & Remote" best={{ match: "91%", company: "Kestrel Payments", title: "Frontend Engineer II, Checkout" }} onBest={() => {}} onBearing={() => {}}/>
    </div>
  );
}

/** The openings (P1): the deck's landscape card in its own frame + the board's field card (Kestrel's lines). */
export function MarketOpeningsBoard() {
  return (
    <MemoryRouter>
      <div style={{ width: 1182 }}>
        <MarketOpenings count={412}
          deck={<article style={{ position: "relative", width: 600, height: 372, borderRadius: 26, overflow: "hidden" }}><MarketCardFace card={BOARD_CARD} isFront size={{ width: 600, height: 372 }} landscape/></article>}
          index={<div/>}
          field={<FieldCard alike={["Role and level: frontend, mid — same as yours", "Their stack: React, TypeScript, Next.js all on your résumé", "Duties: “rebuild checkout” ≈ your Toast checkout rebuild"]}
            gaps={[{ text: "They monitor with Datadog RUM.", link: { label: "Learn it →", href: "#atlas" } }]} figures={{ label: "ROLE FIT · STACK · DUTIES", value: "88 · 75 · 72" }}/>}/>
      </div>
    </MemoryRouter>
  );
}

/** Tickets out (P1) with Kestrel on top of the deck and one draft needing you (the interchange needs a fetched gap). */
export function MarketTicketsBoard() {
  publishFrontCard(BOARD_CARD);
  return <MemoryRouter><div style={{ width: 1182 }} className="plate"><MarketTickets needsYou={1}/></div></MemoryRouter>;
}

/** One ported drawing at the board element's width (the regression run passes #name=…&w=… in the address). */
export function PortedDrawing() {
  const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));
  const D = DRAWINGS[q.get("name")];
  const w = Number(q.get("w")) || 600;
  return <PlateRoot><div style={{ position: "relative", width: w, height: q.get("h") ? Number(q.get("h")) : undefined, lineHeight: 0, marginLeft: Number(q.get("ox")) || 0, marginTop: Number(q.get("oy")) || 0 }}>{D ? <D/> : null}</div></PlateRoot>;
}

export const FIXTURES = { ShellMarket, MarketFace, MarketBearing, MarketHeroBoard, MarketOpeningsBoard, MarketTicketsBoard, PortedDrawing };

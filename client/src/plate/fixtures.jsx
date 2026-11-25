// ⭐ D196 F5 · the regression run's build side — each fixture composes plate components with the SKETCH's example data
// (the same words, counts and order the board shows), so scripts/d196Regress.mjs can diff the build against the board.
// A fixture is never tuned to pass: when a diff fails, the component is fixed (D196 F5), and the fixture keeps the
// board's data.
import { useLayoutEffect, useRef, useState } from "react";
import PlateRoot from "./PlateRoot.jsx";
import { AreaNav, Dock } from "./Shell.jsx";
import { MemoryRouter } from "react-router-dom";
import PlateBearing from "./PlateBearing.jsx";
import MarketHero from "./MarketHero.jsx";
import MarketOpenings, { MarketTickets } from "./MarketOpenings.jsx";
import { publishFrontCard } from "./marketPlate.js";
import { DRAWINGS } from "./drawings/index.js";
import { FieldCard } from "./Cards.jsx";
import { PlateDeckStill } from "../panels/DeckView.jsx";
import { MarketIndexTable, RowBubble, indexRow } from "./MarketIndex.jsx";   // FIX-7 / FIX-8   // FIX-2: the Deck tab is the real FanCard, at the board's size
import { Explainer } from "./explainer/Explainer.jsx";
import PILOT_EXPLAINER from "../../../content/explainers/big-o-acted-out/script.json" with { type: "json" };

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
// the board's next two openings (their backs sit behind Kestrel's ticket)
const BOARD_NEXT = [
  { score: 86, why: { matched: ["React", "TypeScript", "GraphQL"], missing: ["D3"] },
    job: { id: "northwind-1", company: "Northwind Analytics", location: "Remote (US)", title: "Software Engineer, Frontend (Dashboards)",
      postedAt: new Date(Date.now() - 5 * 3600e3).toISOString(), salaryMin: 140000, salaryMax: 165000, contractType: "Full-time", remote: true, worksWith: ["React", "TypeScript", "D3", "GraphQL"] } },
  { score: 79, why: { matched: ["React", "TypeScript"], missing: ["WebGL", "Rust"] },
    job: { id: "halcyon-1", company: "Halcyon Robotics", location: "Somerville, MA", title: "UI Engineer, Fleet Console",
      postedAt: new Date(Date.now() - 26 * 3600e3).toISOString(), contractType: "Full-time", workplaceType: "onsite", worksWith: ["React", "TypeScript", "WebGL", "Rust"], sponsorship: { level: "often" } } },
];
const BOARD_FIGURES = { label: "ROLE FIT · STACK · DUTIES", value: "91 · 88 · 80", items: [
  { label: "ROLE FIT", key: "role", value: 91 }, { label: "STACK", key: "stack", value: 88 }, { label: "DUTIES", key: "duties", value: 80 }] };
/** The market's ticket (FIX-2 / FIX-4) alone, as DeckView's plate deck draws it in the board's deck column (826 px — the
 *  board's ticket measures 808 + the backs' 18). */
/** The board element's sub-pixel offset, passed by the regression run (#ox=…&oy=…), as a margin so text lays out on it. */
function subpixel() {
  const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));
  // w = the board ticket's own width: the column is that + the backs' 18 px
  return { marginLeft: Number(q.get("ox")) || 0, marginTop: Number(q.get("oy")) || 0, ...(Number(q.get("w")) ? { width: Number(q.get("w")) + 18 } : null) };
}
export function MarketFace() {
  return (
    <MemoryRouter>
      <div data-market-face-fixture="" className="plate" style={{ width: 826, padding: 24, boxSizing: "content-box", ...subpixel() }}><PlateDeckStill cards={[BOARD_CARD, ...BOARD_NEXT]} of={412}/></div>
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

/** The openings (P1 + FIX-2 / FIX-4 / FIX-5): the deck as DeckView draws it in the plate market (the real FanCard, the
 *  deck's own backs, at the column's width) + the board's field card (Kestrel's lines, its three labelled numbers). */
export function MarketOpeningsBoard() {
  const { marginLeft, marginTop } = subpixel();
  const w = Number(new URLSearchParams((globalThis.location?.hash || "").slice(1)).get("w")) || 1182;   // the board section's width (1182 at 1280, 292 at 390)
  return (
    <MemoryRouter>
      {/* the offset as PADDING: a margin collapses into the section's own 64 px top margin and is lost */}
      <div style={{ width: w, paddingLeft: marginLeft, paddingTop: marginTop, boxSizing: "content-box" }}>
        <MarketOpenings count={412}
          deck={<PlateDeckStill cards={[BOARD_CARD, ...BOARD_NEXT]} of={412}/>}
          index={<div/>}
          field={<FieldCard alike={["Role and level: frontend, mid — same as yours", "Their stack: React, TypeScript, Next.js all on your résumé", "Duties: “rebuild checkout” ≈ your Toast checkout rebuild"]}
            gaps={[{ text: "They monitor with Datadog RUM.", link: { label: "Learn it →", href: "#atlas" } }]} figures={BOARD_FIGURES}/>}/>
      </div>
    </MemoryRouter>
  );
}

// the market board's index rows (its six, as a board job carries them; the stack's ✓ count from the board's own rows)
const INDEX_JOBS = [
  ["Frontend Engineer II, Checkout", "Kestrel Payments", 91, 5, 4, true, "NEW"],
  ["Software Engineer, Frontend (Dashboards)", "Northwind Analytics", 86, 4, 3, false, "NEW"],
  ["UI Engineer, Fleet Console", "Halcyon Robotics", 79, 4, 2, true, "NEW"],
  ["Software Engineer, Design Systems", "Brightline Health", 77, 6, 4, true, "DRAFTED"],
  ["Frontend Engineer", "Sailor Health", 74, 5, 3, true, "NEEDS YOU"],
  ["Web Engineer, Growth", "Orbital Works", 71, 4, 2, false, "SENT"],
];
// what the Index's handlers were called with — read by test/d196IndexBrowser.test.js (the gallery and F5 ignore it)
const note = (kind, id) => { globalThis.__plateIndexCalls = [...(globalThis.__plateIndexCalls || []), `${kind}:${id}`]; };
/** The openings' Index tab (FIX-7 / FIX-8): the Gazetteer over the board's six rows, each with its row bubble. */
export function MarketIndexBoard() {
  const { marginLeft, marginTop } = subpixel();
  const many = Number(new URLSearchParams((globalThis.location?.hash || "").slice(1)).get("rows")) || INDEX_JOBS.length;
  const rows = Array.from({ length: many }, (_, k) => INDEX_JOBS[k % INDEX_JOBS.length]).map(([title, company, score, n, yours, h1b, status], i) => indexRow(
    { jobId: `ix-${i}`, title, company, url: "#", skills: Array.from({ length: n }, (_, k) => `s${k}`), isH1bSponsor: h1b ? true : null }, i,
    { score, status, yours }));
  return (
    <MemoryRouter>
      <div style={{ width: Number(new URLSearchParams((globalThis.location?.hash || "").slice(1)).get("w")) || 1182, paddingLeft: marginLeft, paddingTop: marginTop, boxSizing: "content-box" }}>
        <MarketOpenings count={412} initialTab="index" deck={<div/>}
          index={<MarketIndexTable rows={rows} onOpen={(job) => note("open", job.jobId)}
            bubble={(r) => <RowBubble job={r.job} drafted={r.status === "DRAFTED"} onSave={() => note("save", r.id)} onDraft={() => note("draft", r.id)}/>}/>}/>
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

/** ⭐ D198 E1 (47h, F5): the pilot explainer, as v4's *Explainer · Big O, acted out* draws it — the regression run presses
 *  the beat (and on your turn the right answer) the same way the board's own list is pressed. The market's count is a
 *  real-shaped number: the board shows the template's [N], which the build never draws (masked). */
export function ExplainerBoard() {
  // subpixel: the FRAME lands at the board frame's own fraction (#ox / #oy). Borders snap to device pixels (a 1.5 px border
  // draws 1 px at this scale), so the offset is measured after layout and corrected, never computed from the CSS.
  const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));
  const want = { x: 100 + (Number(q.get("ox")) || 0), y: 100 + (Number(q.get("oy")) || 0) };
  const ref = useRef(null);
  const [at, setAt] = useState({ x: 100, y: 100 });
  useLayoutEffect(() => {
    const f = ref.current?.querySelector(".pl-xp__frame");
    if (!f) return;
    const r = f.getBoundingClientRect();
    const dx = want.x - (r.left + scrollX), dy = want.y - (r.top + scrollY);
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) setAt((p) => ({ x: p.x + dx, y: p.y + dy }));
  });
  return <PlateRoot><div ref={ref} className="plate" data-region="III" style={{ position: "absolute", left: at.x, top: at.y, width: "max-content" }}>
    <Explainer script={PILOT_EXPLAINER} openings={412}/></div></PlateRoot>;
}

export const FIXTURES = { ShellMarket, MarketFace, MarketBearing, MarketHeroBoard, MarketOpeningsBoard, MarketIndexBoard, MarketTicketsBoard, PortedDrawing, ExplainerBoard };

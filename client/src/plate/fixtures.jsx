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
import MarketOpenings, { MarketTickets, CompanyBriefView } from "./MarketOpenings.jsx";
import { MarketSearchRow, MarketSortButton, MarketFilterRow, MarketStatsBox } from "./MarketControls.jsx";   // D199 (47h)
import MarketPager from "./MarketPager.jsx";
import { LegHeader } from "./Plates.jsx";
import { BoardSearch } from "../components/BoardBar.jsx";
import { publishFrontCard } from "./marketPlate.js";
import { DRAWINGS } from "./drawings/index.js";
import { plateSvgs, DRAWING_23_WORDS } from "../../../shared/emailPlates.js";   // ⭐ D197 #18 M5 (47m): the email plates' F5
import { FieldCard } from "./Cards.jsx";
import { PlateDeckStill } from "../panels/DeckView.jsx";
import { MarketIndexTable, RowBubble, indexRow } from "./MarketIndex.jsx";   // FIX-7 / FIX-8   // FIX-2: the Deck tab is the real FanCard, at the board's size
import { Explainer } from "./explainer/Explainer.jsx";
import { FIT_FIXTURES } from "./fitCardFixtures.jsx";   // D202 / D199 C7 (the card lane)
import { SHEET_FIXTURES, useAtBoardFraction } from "./sheetFixtures.jsx";   // 47h (D197 #3 / #4): the ledger and the survey sheet
import { YS_FIXTURES } from "../pages/atlas/yourSurveyFixtures.jsx";   // D200 (a) (the yoursurvey lane): Your survey
import PILOT_EXPLAINER from "../../../content/explainers/big-o-acted-out/script.json" with { type: "json" };
import { AtlasHero, RegionPlates, AtlasFooter, VolumesPanel } from "./AtlasHome.jsx";   // ⭐ D197 #5 (47h, lane atlas)
import { RegionHeader, RegionViews } from "./AtlasRegion.jsx";   // ⭐ D197 #6
import { LibraryAside, LibraryChips, NotesDrawer, LibraryNote, LibrarySource, CollectionHead } from "./AtlasLibrary.jsx";   // ⭐ D197 #7

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
      <PlateBearing params={{ tech: "React", location: "Boston" }} allSlot="all" from={{ name: "Maya_Chen.pdf", at: Date.parse("2026-11-08T15:00:00Z") / 1000 }}/>
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
        <PlateRoot><MarketOpenings count={412}
          deck={<PlateDeckStill cards={[BOARD_CARD, ...BOARD_NEXT]} of={412}/>}
          index={<div/>}
          field={<FieldCard alike={["Role and level: frontend, mid — same as yours", "Their stack: React, TypeScript, Next.js all on your résumé", "Duties: “rebuild checkout” ≈ your Toast checkout rebuild"]}
            gaps={[{ text: "They monitor with Datadog RUM.", link: { label: "Learn it →", href: "#atlas" } }]} figures={BOARD_FIGURES}/>}/></PlateRoot>
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
        {/* D199 C1 (47h): the openings no longer carry their own plate root (they sit in the one section's) — the fixture gives one */}
        <PlateRoot><MarketOpenings count={412} initialTab="index" deck={<div/>}
          index={<MarketIndexTable rows={rows} onOpen={(job) => note("open", job.jobId)}
            bubble={(r) => <RowBubble job={r.job} drafted={r.status === "DRAFTED"} onSave={() => note("save", r.id)} onDraft={() => note("draft", r.id)}/>}/>}/></PlateRoot>
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
/** ⭐ D197 #18 M5 (47m, F5): an email header plate (shared/emailPlates.js — the drawing the PNGs are made from) with Drawing
 *  23's example words, at the board's width (#name = dispatch | run-report | digest, #w / #h / #ox / #oy). */
export function EmailPlateBoard() {
  const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));
  const svg = plateSvgs({ words: DRAWING_23_WORDS })[q.get("name")] || "";
  const w = Number(q.get("w")) || 560;
  return <PlateRoot><div style={{ width: w, lineHeight: 0, marginLeft: Number(q.get("ox")) || 0, marginTop: Number(q.get("oy")) || 0 }}
    dangerouslySetInnerHTML={{ __html: svg.replace('width="560" height="140"', 'width="100%" style="display: block; border-bottom: var(--pl-border)"') }}/></PlateRoot>;
}

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

// ⭐ D197 Wave 1 #1 (47i) · THE SHELL against the approved canvas's `Shell` board (docs/sketches/final/project/Shell.dc.html).
// The live dock is this same Dock (components/AppNav.jsx renders it); its items here are the board's (Home 1 · Atlas ·
// Interview · Network 3 · Profile MC 9+ · — · Ask draft), Profile and Ask draft as the live buttons. The board draws each
// shell inside a 1.5 px-bordered frame at 1280: the frame's inner width is 1229, so the content column beside the rail
// (14 + 84) is 1131 wide — the fixture gives the column the same room, so the area nav lays out as the board's.
const SHELL_DOCK = [
  { id: "auto-apply", label: "Home", href: "#home", icon: "home", badge: 1 },
  { id: "atlas", label: "Atlas", href: "#atlas", icon: "atlas" },
  { id: "interview", label: "Interview", href: "#interview", icon: "interview" },
  { id: "network", label: "Network", href: "#network", icon: "network", badge: 3 },
  { id: "profile", label: "Profile", onPress: () => {}, initials: "MC", badge: 12 },
];
const SHELL_HOME = { id: "today", href: "#market", label: "draft — the market" };
function ShellFrame({ current, children }) {
  const [ref, at] = useAtBoardFraction();
  // the area nav's pair passes the board header's own width (#w, fractional: the frame's 1.5 px border) — the column is it
  const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));
  const col = /header/.test(q.get("sel") || "") && Number(q.get("w")) ? Number(q.get("w")) : 1131;
  return (
    <PlateRoot style={{ minHeight: "100vh" }}>
      <div ref={ref} style={{ width: 98 + col, display: "flex", alignItems: "flex-start", ...at }}>
        <Dock home={SHELL_HOME} items={SHELL_DOCK} ask={{ onPress: () => {} }} current={current}/>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>{children}</div>
      </div>
    </PlateRoot>
  );
}
/** A · DESKTOP · THE MARKET: the rail (the /d tile current) beside the market's area nav (no pill; the drafts chip). */
export function ShellRailMarket() {
  return (
    <ShellFrame current="today">
      <AreaNav area="The market" views={MARKET_VIEWS} current="picks" more={[{ label: "Companies", href: "#co" }]}
        search={{ placeholder: "Company, role, tech…" }} chip={{ kind: "drafts", used: 7, of: 10, href: "#ledger" }}/>
    </ShellFrame>
  );
}
/** C · ATLAS (47h, lane atlas): the rail with Atlas current beside Atlas's area nav — the VOL. I pill, Your map current,
 *  Library · Today's question · League · More, "Make sense of…" and the run chip (4 of 7 days, today clay). */
export function ShellRailAtlas() {
  const views = [{ id: "map", label: "Your map", href: "#map", icon: "map" }, { id: "library", label: "Library", href: "#lib", icon: "library" },
    { id: "question", label: "Today’s question", href: "#q", icon: "question" }, { id: "league", label: "League", href: "#league", icon: "league" }];
  return (
    <ShellFrame current="atlas">
      <AreaNav area="Vol. I" pill={{ tag: "VOL. I", name: "Computing" }} views={views} current="map" more={[{ label: "Your run", href: "#run" }]}
        search={{ placeholder: "Make sense of…" }} chip={{ kind: "run", days: ["lit", "lit", "lit", "lit", "today", null, null], href: "#run" }}/>
    </ShellFrame>
  );
}
/** B · THE LEDGER: the same rail with Home current (the active item: white tile, 1.5 px ink, 3 px shadow, the name in 800). */
export function ShellRailLedger() {
  return <ShellFrame current={SHELL_DOCK[0].id}><div style={{ height: 70 }}/></ShellFrame>;
}
/** D · PHONE: the bottom bar inside the board's 390 px phone frame (1.5 px border → a 387 px bar). The board's bar draws
 *  Profile without its badge; the board's data is kept here (the live bar keeps the badge — the noted disagreement). */
export function ShellPhoneBar() {
  const items = SHELL_DOCK.map((d) => (d.id === "profile" ? { ...d, badge: 0 } : d));
  const [ref, at] = useAtBoardFraction();
  return (
    <PlateRoot style={{ minHeight: "100vh" }}>
      <div ref={ref} style={{ width: 390, ...at }}>
        <Dock home={SHELL_HOME} items={items} current="today" bar/>
      </div>
    </PlateRoot>
  );
}

/** D · PHONE: the top bar over the market's views (the /d tile, the search button; the market has no pill). */
export function ShellPhoneTop() {
  const [ref, at] = useAtBoardFraction();
  return (
    <PlateRoot style={{ minHeight: "100vh" }}>
      <div ref={ref} style={{ width: 390, ...at }}>
        <AreaNav area="The market" views={MARKET_VIEWS} current="picks" phone home={SHELL_HOME} search={{ onOpen: () => {} }}/>
      </div>
    </PlateRoot>
  );
}

// ── ⭐ D199 / D200 (47h) · the APPROVED `Market` board (docs/sketches/final/project/Market.dc.html) — its example data ──
// the board's five sectors (S in its script): counts, the hatch it draws (its rect's height of the slot's box), capitals
export const FINAL_SECTORS = [
  { id: "swe", name: "Software engineering", n: 4812, strong: 192 / 298, capitals: ["Kestrel", "Northwind"], subs: [{ label: "Backend", n: 1612 }, { label: "Frontend", n: 1008 }, { label: "Full-stack", n: 1154 }] },
  { id: "data", name: "Data & AI", n: 2236, strong: 57 / 135, capitals: ["Halcyon"], subs: [] },
  { id: "pm", name: "Project mgmt", n: 1604, strong: 31 / 170, capitals: ["Granite Build"], subs: [] },
  { id: "biz", name: "Business & finance", n: 1415, strong: 30 / 250, capitals: ["Ledgerline"], subs: [] },
  { id: "design", name: "Design", n: 588, strong: 30 / 100, capitals: ["Fieldwork"], subs: [] },
];
export const FINAL_FIGURES = { fit: 11247, newToday: 5, filed: 4061, strong: 4836 };
const FINAL_BRIEF = { name: "Kestrel Payments", filings: 214, fiscalYear: 2025, openJobs: 38, trend: { pct: 171, dir: "up", since: "June" },
  tech: [{ name: "Go", yours: "missing" }, { name: "PostgreSQL", yours: "missing" }, { name: "AWS", yours: "missing" }, { name: "React", yours: "proven" }, { name: "TypeScript", yours: "proven" }] };
const q = () => new URLSearchParams((globalThis.location?.hash || "").slice(1));

/** The board's hero: the one-line header beside the political map (week 48, the board's counts, best match at Halcyon). */
export function MarketHeroFinal() {
  return (
    <MemoryRouter>
      <div style={{ ...subpixel(), width: Number(q().get("w")) || 1182 }}>
        <MarketHero figures={FINAL_FIGURES} week={48} sectors={FINAL_SECTORS} you={0} captionTail="EXAMPLE DATA"
          best={{ match: "79%", company: "Halcyon Robotics", title: "UI Engineer, Fleet Console" }} onBest={() => {}} onBearing={() => {}} onPick={() => {}}/>
      </div>
    </MemoryRouter>
  );
}

/** The board's one section: the leg header, the lead, the cartouche with its controls, the openings (Deck or Index, #tab=),
 *  the pager — the build's own components with the board's data. */
export function MarketSectionFinal() {
  const tab = q().get("tab") || "deck";
  const { marginLeft: ml0, marginTop: mt0 } = subpixel();
  // 47h (D199, F5 at 390): on the phone layout the compared element (#sel) is placed at the board element's own sub-pixel
  // fraction AFTER layout, as ExplainerBoard / useShellAt do — the margins alone carry the fraction of the section, and the
  // section's parts above it (fractional heights) move it off; at 1280 the margins stay as they were
  const [fix, setFix] = useState({ x: 0, y: 0 });
  const tries = useRef(0);
  const [, setFontsIn] = useState(0);   // the fonts arrive after the first layout and move it: measure again then
  useLayoutEffect(() => { let live = true; globalThis.document?.fonts?.ready?.then(() => { if (live) { tries.current = 0; setFontsIn((n) => n + 1); } }); return () => { live = false; }; }, []);
  useLayoutEffect(() => {
    const qq = q(), sel = qq.get("sel");
    if (!sel || (globalThis.innerWidth || 1280) >= 980 || tries.current >= 4) return;
    const el = document.querySelector(sel); if (!el) return;
    const r = el.getBoundingClientRect(), fr = (v) => v - Math.floor(v);
    const up = (v) => (v < 0 ? v + 1 : v);   // only ever forward: a padding can't be negative
    const dx = up(fr(Number(qq.get("ox")) || 0) - fr(r.left + scrollX)), dy = up(fr(Number(qq.get("oy")) || 0) - fr(r.top + scrollY));
    if ((dx > 0.001 && dx < 0.999) || (dy > 0.001 && dy < 0.999)) { tries.current += 1; setFix((p) => ({ x: p.x + dx, y: p.y + dy })); }
  });
  const marginLeft = ml0 + fix.x, marginTop = mt0 + fix.y;
  const card = { ...BOARD_CARD, job: { ...BOARD_CARD.job, checkedAt: Math.floor(Date.now() / 1000) - 600 } };   // the board's LIVE · CHECKED TODAY
  const rows = INDEX_JOBS.map(([title, company, score, n, yours, h1b, status], i) => indexRow(
    { jobId: `ix-${i}`, title, company, url: "#", skills: Array.from({ length: n }, (_, k) => `s${k}`), isH1bSponsor: h1b ? true : null }, i,
    { score, status, yours, saved: i === 1 || i === 3 }));
  return (
    <MemoryRouter>
      {/* the board's content column: the page less its 98 px dock (1182 at 1280, 292 at 390) */}
      <PlateRoot className="pl-marketbearing" style={{ width: Math.min(1182, (globalThis.innerWidth || 1280) - 98), marginLeft, paddingTop: marginTop }}>
        <section className="pl-section" id="bearing" aria-labelledby="mk-bearing" data-market-section="">
          <LegHeader n={1} meta="YOUR BEARING AND OPENINGS · ONE SECTION" title={<span id="mk-bearing">Where you’re headed, and what’s there</span>}/>
          <p className="pl-lead">Set the bearing, search or filter; the counts and the openings follow. Pass, save or send any of them; Draft starts the application and it moves to your ledger.</p>
          <header className="pl-mk-head" data-market-head="">
            <PlateBearing params={{}} allSlot="all">
              <MarketSearchRow search={<BoardSearch placeholder="Search a company, role, technology or title" value=""/>} sort={<MarketSortButton label="Best match"/>}/>
              <MarketFilterRow params={{}}/>
              <MarketStatsBox figures={FINAL_FIGURES} params={{}}/>
            </PlateBearing>
          </header>
          <MarketOpenings initialTab={tab}
            deck={<PlateDeckStill cards={[card, ...BOARD_NEXT]} of={412} pager={{ page: 1, pageSize: 50, total: 412 }}/>}
            index={<MarketIndexTable rows={rows} bubble={(r) => <RowBubble job={r.job} saved={r.saved} drafted={r.status === "DRAFTED"}/>}/>}
            field={<FieldCard alike={["Role and level: frontend, mid — same as yours", "Their stack: React, TypeScript, Next.js all on your résumé", "Duties: “rebuild checkout” ≈ your Toast checkout rebuild"]}
              gaps={[{ text: "They monitor with Datadog RUM.", link: { label: "Learn it →", href: "#atlas" } }]} figures={BOARD_FIGURES} inlineLinks>
              <CompanyBriefView company="Kestrel Payments" jobId="kestrel-1" status="ready" brief={FINAL_BRIEF}/>
            </FieldCard>}
            pager={<MarketPager page={1} totalPages={225} total={11247} pageSize={50}/>}/>
        </section>
      </PlateRoot>
    </MemoryRouter>
  );
}

// ⭐ D197 Wave 1 #5–#7 (47h, lane atlas) · ATLAS'S THREE BOARDS with the boards' own example data (Home · Map · Library).
const AT_REGIONS = [
  ["I", "found", "Foundations", 7, 11, "Signals, logic and the first machines."], ["II", "bits", "[Part 2 name]", 3, 14, "[What this region covers]"],
  ["III", "tree", "Algorithms", 1, 11, "Searching, sorting and the shapes of data."], ["IV", "net", "Systems & networks", 2, 18, "How machines talk, wait and scale."],
  ["V", "lock", "Security & money", 0, 11, "Trust, keys and how payments move."], ["VI", "code", "Languages & media", 0, 5, "Code, sound and pictures as data."],
  ["VII", "world", "The physical world", 0, 23, "Sensors, power and the stuff underneath."], ["VIII", "mind", "Intelligence", 0, 15, "Models that learn, predict and act."],
].map(([roman, kind, name, lit, total, blurb], i) => ({ n: i + 1, roman, kind, name, lit, total, blurb, href: "#map", squares: Array.from({ length: total }, (_, k) => (k < lit ? "lit" : null)) }));
const AT_TAPES = [{ text: "computers.", region: "I" }, { text: "the internet.", region: "IV" }, { text: "money.", region: "V" }, { text: "the physical world.", region: "VII" }, { text: "AI.", region: "VIII" }];
const AT_HERE = Array.from({ length: 11 }, (_, k) => (k < 7 ? "lit" : null));
const AT_FOOTER = [
  { label: "You", links: [{ label: "Your run", href: "#top" }, { label: "Your map", href: "#map" }, { label: "Your skills", href: "#top" }] },
  { label: "Grow", links: [{ label: "Library", href: "#lib" }, { label: "Today’s question", href: "#top" }, { label: "The audit", href: "#top" }, { label: "How it works", href: "#top" }] },
  { label: "Compete", links: [{ label: "League", href: "#top" }, { label: "Challenges", href: "#top" }] },
  { label: "Explore", links: [{ label: "Roles and skills", href: "#top" }, { label: "This week’s market", href: "#top" }, { label: "Glossary", href: "#top" }] },
];
// the compared element (#sel) lands at the board element's own sub-pixel fraction (#ox / #oy), like useShellAt — but the page
// keeps its own width (Atlas's boards are whole 1280 px pages): a relative nudge of under a pixel, measured after layout
function useAtFrac() {
  const q = new URLSearchParams((globalThis.location?.hash || "").slice(1));
  const want = { x: Number(q.get("ox")) || 0, y: Number(q.get("oy")) || 0 }, sel = q.get("sel");
  const ref = useRef(null);
  const [at, setAt] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = sel ? ref.current?.querySelector(sel) : null;
    if (!el) return;
    const r = el.getBoundingClientRect(), fx = (v) => v - Math.floor(v);
    let dx = want.x - fx(r.left + scrollX), dy = want.y - fx(r.top + scrollY);
    if (dx < -0.5) dx += 1; if (dy < -0.5) dy += 1;
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) setAt((p) => ({ x: p.x + dx, y: p.y + dy }));
  });
  return [ref, { position: "relative", left: at.x, top: at.y }];
}
/** Home: Volume I — the hero (its plate and three tags), the eight region plates, the footer, at the board's 1280. */
export function AtlasHomeBoard() {
  return (
    <PlateRoot region="I" style={{ minHeight: "100vh", fontSize: "var(--pl-t-ui-lg)", lineHeight: 1.5 }}>
      <AtlasHero tapes={AT_TAPES} lead="Every field is a territory. Atlas draws it as a map you walk lesson by lesson, and a square lights up only when you can explain what you learned."
        actions={{ primary: { label: "Resume the route", href: "#map" }, secondary: { label: "Open the atlas", href: "#map" } }}
        stats={[{ value: 8, label: "REGIONS" }, { value: 108, label: "LESSONS" }, { value: 13, label: "FIELD NOTES" }]}
        tags={{ here: { kicker: "YOU ARE HERE", line: "Designing the arithmetic brain", squares: AT_HERE },
          next: { kicker: "NEXT · WEBHOOKS", code: ["POST /hook", "200 OK"] },
          ahead: { kicker: "AHEAD · ATTENTION", words: [{ text: "the" }, { text: "cat", hi: true }, { text: "sat" }] } }}
        caption={["PLATE I · VOLUME I, COMPUTING", "— walked   - - ahead   ◆ summit"]}/>
      <RegionPlates regions={AT_REGIONS} note="Each region opens on its own terrain. Squares stay dark until you’ve explained the lesson in your own words."/>
      <AtlasFooter groups={AT_FOOTER}/>
    </PlateRoot>
  );
}
/** Home's VOL. I panel, as the board's pill opens it. */
export function AtlasVolumesBoard() {
  return <PlateRoot style={{ minHeight: "100vh" }}><div style={{ position: "absolute", left: 24, right: 24, top: 78 }}><VolumesPanel regions={AT_REGIONS}/></div></PlateRoot>;
}

// Map: Region IV — the board's fifteen places (state, checks, field notes, where it sits) and its three interchanges
const AT_P = [
  ["net", "How the internet works", "start", "lit", 3, 3, 150, 590, 0], ["cli", "Clients and servers", "start", "lit", 3, 3, 330, 640, 0], ["dns", "DNS", "start", "open", 1, 3, 250, 470, 0],
  ["cors", "CORS", "build", "lit", 3, 3, 420, 370, 1], ["poll", "Polling", "build", "lit", 2, 2, 590, 430, 0], ["http", "HTTP and REST", "build", "open", 2, 4, 480, 540, 0],
  ["tcp", "TCP and UDP", "build", "open", 0, 3, 620, 630, 0], ["hook", "Webhooks", "deepen", "next", 0, 3, 750, 330, 1], ["sse", "Server-Sent Events", "deepen", "later", 0, 4, 880, 450, 1],
  ["ws", "WebSockets", "deepen", "later", 0, 4, 840, 230, 0], ["cache", "Caching", "deepen", "later", 0, 3, 800, 580, 0], ["queue", "Message queues", "master", "later", 0, 3, 1040, 210, 0],
  ["lb", "Load balancing", "master", "later", 0, 3, 1070, 470, 0], ["deploy", "Deploying safely", "master", "later", 0, 3, 1160, 340, 1], ["sum", "Design a system, out loud", "master", "later", 0, 5, 1240, 140, 0],
];
const AT_CHANGE = { http: ["VI", "Languages & media"], hook: ["V", "Security & money"], sum: ["VIII", "Intelligence"] };
const AT_PLACES = AT_P.map(([id, name, stage, state, d, t, x, y, notes]) => ({ id, name, stage, state, x, y, notes, summit: id === "sum",
  grid: `${"ABCDEFG".charAt(Math.floor(x / 200))}${1 + Math.floor(y / 140)}`, notesLabel: notes ? `${notes} reel` : "—",
  checks: { squares: Array.from({ length: t }, (_, i) => i < d), done: d, total: t },
  interchange: AT_CHANGE[id] ? { n: 0, roman: AT_CHANGE[id][0], name: AT_CHANGE[id][1], region: AT_CHANGE[id][0] } : null }));
const AT_EDGES = [["net", "cli"], ["net", "dns"], ["cli", "http"], ["http", "tcp"], ["dns", "cors"], ["cors", "poll"], ["http", "poll"], ["poll", "hook"], ["hook", "sse"], ["hook", "ws"], ["tcp", "cache"],
  ["cache", "lb"], ["ws", "queue"], ["hook", "queue"], ["lb", "deploy"], ["queue", "sum"], ["deploy", "sum"]];
const AT_TRAILS = AT_EDGES.map(([a, b]) => {
  const A = AT_PLACES.find((p) => p.id === a), B = AT_PLACES.find((p) => p.id === b);
  return { id: `${a}>${b}`, d: `M${A.x} ${A.y} Q${(A.x + B.x) / 2} ${(A.y + B.y) / 2 - 30} ${B.x} ${B.y}`,
    kind: A.state === "lit" && B.state === "lit" ? "walked" : A.state === "lit" && B.state === "next" ? "next" : "ahead" };
});
const AT_STAGES = { start: { id: "start", caps: "LOWLANDS · START" }, build: { id: "build", caps: "FOOTHILLS · BUILD" }, deepen: { id: "deepen", caps: "HIGHLANDS · DEEPEN" }, master: { id: "master", caps: "SUMMIT · MASTER" } };
const AT_SMSG = { lit: "Lit. You explained every checkpoint here.", next: "Your next waypoint. The trail from Polling leads here.", open: "Underway. Finish the remaining checks to light it.", later: "Ahead on the route. Reach it from the places before it." };
/** Map: Region IV — the plate header, the waypoint, and the binder tabs (Terrain first; the run presses Route / Index). */
export function AtlasMapBoard() {
  const [ref, at] = useAtFrac();
  const [view, setView] = useState("terrain");
  return (
    <PlateRoot region="IV" style={{ minHeight: "100vh", fontSize: "var(--pl-t-ui-lg)", lineHeight: 1.5 }}><div ref={ref} style={at}>
      <main className="pl-at-region" id="region">
        <RegionHeader emblem="net" roman="IV" name="Systems & networks" lead="How machines talk, wait and scale. Climb from how the internet works to designing a system out loud."
          chips={["15 PLACES", "4 FIELD NOTES", "3 PRIMARY SOURCES"]} lit={4} total={15}
          waypoint={{ grid: "D3", name: "Webhooks", line: "3 checks · from Polling", href: "#hook" }}/>
        <RegionViews views={[{ id: "terrain", label: "Terrain", sub: "explore the ground" }, { id: "route", label: "Route", sub: "ride the line" }, { id: "index", label: "Index", sub: "look up a place" }]}
          view={view} onView={setView} roman="IV" places={AT_PLACES} trails={AT_TRAILS} statusWord={{ lit: "LIT", next: "UP NEXT", open: "UNDERWAY", later: "AHEAD" }}
          card={(p) => ({ grid: p.grid, stage: AT_STAGES[p.stage], name: p.name, checks: p.checks, status: AT_SMSG[p.state], notes: p.notes, href: "#region" })}
          interchangeHref={() => "#region"}/>
      </main>
    </div></PlateRoot>
  );
}

// Library: the board's collections, its fourteen field notes in three drawers, its six primary sources
const AT_R = { found: { roman: "I", name: "Foundations", kind: "found" }, sys: { roman: "IV", name: "Systems & networks", kind: "net" },
  lang: { roman: "VI", name: "Languages & media", kind: "code" }, ai: { roman: "VIII", name: "Intelligence", kind: "mind" } };
const AT_NOTES = [
  ["sys", "Webhooks explained", "INTERVIEW", "How does a", "webhook", "work?", "1:37", "13,059", "The SeniorDev Diaries"], ["sys", "Server-Sent Events", "SYSTEM DESIGN", "Real-time", "without", "polling", "1:41", "4,731", "The SeniorDev Diaries"],
  ["sys", "CORS in under 60 seconds", "INTERVIEW", "Works in Postman,", "fails", "in the browser", "0:57", "1,422", "The SeniorDev Diaries"], ["sys", "Why a CDN feels fast", "INTERVIEW", "Why is a", "CDN", "so fast?", "1:46", "3,090", "The SeniorDev Diaries"],
  ["sys", "8 deployment patterns", "DEVOPS", "8 ways to", "deploy", "safely", "0:08", "17,413", "Afzal Web Solutions"], ["lang", "Log out every tab at once", "REACT", "One logout,", "every tab", "follows", "1:09", "11,113", "The SeniorDev Diaries"],
  ["lang", "array.at(-1) over length − 1", "JAVASCRIPT", "Stop using", "length − 1", "", "0:38", "565", "The SeniorDev Diaries"], ["ai", "How AI answers in a second", "AI", "Predict the", "next token", "again and again", "0:52", "1,113", "The SeniorDev Diaries"],
  ["ai", "MCP, explained", "AI STACK", "45 integrations", "become 14", "", "0:54", "12,059", "The SeniorDev Diaries"], ["ai", "How an AI agent remembers", "AGENTS", "Short-term,", "long-term", "memory", "0:53", "4,832", "The SeniorDev Diaries"],
  ["ai", "Vibe coding vs agentic AI", "AGENTS", "You in the loop, or", "the agent", "", "0:46", "19,322", "The SeniorDev Diaries"], ["ai", "30 AI algorithms to know", "ML", "The", "30 algorithms", "tree", "0:56", "61,263", "The SeniorDev Diaries"],
  ["ai", "15 AI engineer concepts", "ROADMAP", "15 steps to", "AI engineer", "", "0:48", "14,973", "The SeniorDev Diaries"], ["ai", "AI engineering splits into 12 roles", "CAREERS", "One job", "becomes 12", "", "0:56", "45,285", "The SeniorDev Diaries"],
];
const AT_PAPERS = [
  ["found", "I.1 SHA", "A Mathematical Theory of Communication", "C. E. Shannon", 1948, "Bell Sys. Tech. J.", "Where the bit comes from, and how to measure information at all."],
  ["sys", "IV.1 LAM", "Time, Clocks, and the Ordering of Events in a Distributed System", "L. Lamport", 1978, "CACM", "Why machines can’t agree on “now”, and how to order events anyway."],
  ["sys", "IV.2 SAL", "End-to-End Arguments in System Design", "J. Saltzer, D. Reed, D. Clark", 1984, "ACM TOCS", "Which jobs belong at the edges of a network rather than inside it."],
  ["sys", "IV.3 DEA", "MapReduce: Simplified Data Processing on Large Clusters", "J. Dean, S. Ghemawat", 2004, "OSDI", "One big job across thousands of machines, surviving failures."],
  ["sys", "IV.4 DEC", "Dynamo: Amazon’s Highly Available Key-value Store", "G. DeCandia et al.", 2007, "SOSP", "Staying available when parts of the system disagree."],
  ["ai", "VIII.1 VAS", "Attention Is All You Need", "A. Vaswani et al.", 2017, "NeurIPS", "The transformer: the design behind today’s language models."],
];
const AT_CATS = [["notes", "Field notes", "14"], ["sources", "Primary sources", "6"], ["lectures", "Lectures", "—"], ["books", "Books", "—"], ["courses", "Courses elsewhere", "—"],
  ["essays", "Essays", "—"], ["grounds", "Practice grounds", "—"], ["guides", "Guides to follow", "—"], ["glossary", "Glossary", "—"]].map(([id, label, count]) => ({ id, label, icon: id, count }));
const atChips = (pool) => [{ id: "all", tag: "ALL", label: "Every region", count: String(pool.length) },
  ...["found", "sys", "lang", "ai"].filter((k) => pool.some((x) => x[0] === k)).map((k) => ({ id: k, tag: AT_R[k].roman, label: AT_R[k].name, region: AT_R[k].roman, count: String(pool.filter((x) => x[0] === k).length) }))];
/** Library: the side, the chips and the field-note drawers (the board opens on Field notes); #sources → Primary sources. */
export function AtlasLibraryBoard() {
  const [ref, at] = useAtFrac();
  const sources = /sources/.test(globalThis.location?.hash || "");
  const [cat, setCat] = useState(sources ? "sources" : "notes");
  const pool = cat === "sources" ? AT_PAPERS : AT_NOTES;
  return (
    <PlateRoot region="I" style={{ minHeight: "100vh", fontSize: "var(--pl-t-ui-lg)", lineHeight: 1.5 }}><div ref={ref} style={at}>
      <div className="pl-at-lib" id="lib">
        <LibraryAside cats={AT_CATS} current={cat} onCat={setCat}/>
        <main className="pl-at-lmain">
          <LibraryChips chips={atChips(pool)} current="all"/>
          {cat === "notes" ? (
            <div className="pl-at-lview">
              <CollectionHead kicker="COLLECTION · FIELD NOTES" title="Short explainers, filed by region" aside={<span className="pl-at-lhead__note">Each note keeps its transcript and key frames, so a lesson can quote it.</span>}/>
              {["sys", "lang", "ai"].map((k) => {
                const ns = AT_NOTES.filter((n) => n[0] === k);
                return (
                  <NotesDrawer key={k} region={AT_R[k]} count={ns.length}>
                    {ns.map((n, i) => <LibraryNote key={n[1]} code={`FN-${AT_R[k].roman}.${i + 1}`} title={n[1]} kicker={n[2]} pre={n[3]} hl={n[4]} post={n[5]} duration={n[6]}
                      views={`${n[7]} views`} creator={n[8]} progress={0.35} href="#note"/>)}
                  </NotesDrawer>
                );
              })}
            </div>
          ) : (
            <div className="pl-at-lview pl-at-lview--cards">
              <CollectionHead kicker="COLLECTION · PRIMARY SOURCES" title="The originals, on file" aside={<span className="pl-at-lhead__count">0 / 6 EXPLAINED</span>}/>
              <div className="pl-at-srcs">
                {AT_PAPERS.map((p) => <LibrarySource key={p[1]} call={p[1]} title={p[2]} authors={p[3]} venue={`${p[5]} · ${p[4]}`} why={p[6]} region={AT_R[p[0]]}
                  action={{ label: "I can explain it", onClick: () => {} }}/>)}
              </div>
            </div>
          )}
        </main>
      </div>
    </div></PlateRoot>
  );
}

export const FIXTURES = { EmailPlateBoard, ShellRailMarket, ShellRailLedger, ShellPhoneBar, ShellPhoneTop, ShellMarket, MarketFace, MarketBearing, MarketHeroBoard, MarketOpeningsBoard, MarketIndexBoard, MarketTicketsBoard, PortedDrawing, ExplainerBoard, MarketHeroFinal, MarketSectionFinal, AtlasHomeBoard, AtlasVolumesBoard, AtlasMapBoard, AtlasLibraryBoard, ShellRailAtlas, ...FIT_FIXTURES, ...SHEET_FIXTURES, ...YS_FIXTURES };

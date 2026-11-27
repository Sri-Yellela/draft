// ⭐ D105 P4 · THE ATLAS — a dictionary of roles, skills, tools and stacks, linked to each other and to the board.
//
// ONE page, two mounts: PUBLIC at /atlas and /atlas/:slug (no sign-in — useful to anyone, found by search engines;
// `publicChrome` draws the marketing dock and footer), and inside the app at /app/atlas(/:slug) for a signed-in
// reader, under the top bar's Atlas tab (D102's navigation gains one place). `base` is the mount; the slug and the
// search are read from the address, so a link, the back button and a reload all land on the same page.
//
// ⭐ D197 Wave 1 #8 (47m, lane gaz) · D201 · THE GAZETTEER: a term's page (/atlas/<slug>, the old node page) is a Gazetteer
// ENTRY now, drawn in the plate system (pages/atlas/AtlasGazetteer.jsx) — the classic node page, its search, the Glossary,
// Roles and skills, How it works, the shelf and the course pages are retired, and their addresses forward to their homes:
//   /atlas?q=…                 → /atlas/gazetteer?q=…        (an exact name or alias still lands on its entry)
//   /atlas/glossary            → /atlas/gazetteer            (the A–Z)
//   /atlas/roles-and-skills    → /atlas/gazetteer?by=role
//   /atlas/how-it-works        → /atlas/gazetteer?by=stage   (each idea's parts are its entry's Why it works)
//   /atlas/learn#step-<id>     → /atlas/gazetteer/<id>       (a lesson is an entry; no step → the course's circle)
//   /atlas/library/shelf       → /atlas/routes
//   /atlas/library/<course>    → /atlas/routes/<course>      (?view=circle kept: the circle is the route's overview)
// A guide or a deck (/atlas/library/<guide-or-deck>) keeps its page (the deck's Watch is the entry's Watch it).
// docs/revamp/gazetteer.md maps every element that existed to where it does its job now (D200 Rule 1).
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";   // A154 (45s): the Compete switches
import { Navigate, useLocation } from "react-router-dom";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { BRAND } from "../../../../shared/brand.js";
import { FamilyMap } from "./YourMap.jsx";
import SkillMap from "./SkillMap.jsx";   // ⭐ A228: Your map
import PlaceNav from "../../components/PlaceNav.jsx";
import { OverviewPanel, YourSkillsSlot, YourRoutePanel, AuditPanel, AtlasMarketPanel } from "./AtlasPanels.jsx";
import { panelFor, isPanelSlug, PANEL_LABEL, navGroups, panelHref, courseIdOf, gazetteerOf } from "./atlasPanels.js";
import { ChallengesPanel, SharedBar } from "./CompetePanels.jsx";   // A154 / D172 (4) (45s): behind their switches (47m: the league is the Logbook's Standings)
import { LibraryItem } from "./LibraryGuides.jsx";
// ⭐ D197 Wave 2 #11 (47m, M5): Your run → the Logbook, Today's question → the Today card, both on Your map (D203 (1) (3));
// stack exposure → Your survey (D203 (11)). The classic Your run / Today's question / League pages are retired (they forward).
import Logbook, { StackOnTheBoard } from "./Logbook.jsx";
import TodayCard from "./TodayCard.jsx";
import TrackBoard from "./TrackBoard.jsx";
import "./AtlasPage.css";
// ⭐ D197 Wave 1 #5–#7 (47h, lane atlas): Volume I (the front page), a region, the Library — the plate pages
import { AtlasVolumeHome, AtlasRegionPage, AtlasLibraryPage, useAtlasAreaNav } from "./AtlasVolume.jsx";
// ⭐ D197 Wave 1 #8 (47m, lane gaz): the Gazetteer — the index, an entry, Routes and a route
import { GazetteerIndexPage, GazetteerEntryPage, RoutesPage, RoutePage } from "./AtlasGazetteer.jsx";
import { AreaNav } from "../../plate/Shell.jsx";
import PlateRoot from "../../plate/PlateRoot.jsx";

/** The two courses whose old pages are routes now (D201 (2)). */
const ROUTE_COURSES = Object.freeze(["silicon-to-software", "coding-interview-patterns"]);

/** ⭐ D201 (47m): where a retired Atlas address forwards now — pure (the tests read it). null = it has its own page. */
export function forwardOf(base, slug, q = "", search = "", hash = "") {
  const s = String(slug || "");
  if (!s && q) return `${base}/gazetteer?q=${encodeURIComponent(q)}`;
  if (s === "glossary") return `${base}/gazetteer`;
  if (s === "roles-and-skills") return `${base}/gazetteer?by=role`;
  if (s === "how-it-works") return `${base}/gazetteer?by=stage`;
  if (s === "learn") {
    const m = /^#step-(.+)$/.exec(String(hash || ""));
    return m ? `${base}/gazetteer/${m[1]}` : `${base}/routes/silicon-to-software?view=circle`;
  }
  const course = courseIdOf(s);
  if (course === "shelf") return `${base}/routes`;
  if (course && ROUTE_COURSES.includes(course)) {
    const p = new URLSearchParams(search);
    const m = /^#step-(.+)$/.exec(String(hash || ""));
    if (m && p.get("view") === "circle") return `${base}/gazetteer/${m[1]}`;
    return `${base}/routes/${course}${p.get("view") === "circle" ? "?view=circle" : ""}`;
  }
  return null;
}

/** ⭐ D197 #5 (47h): Atlas's area nav on the PUBLIC pages (signed in, the shell draws it): the same views, the VOL. I pill,
 *  and the search that looks up the Gazetteer (/atlas/gazetteer?q=). */
function PublicAtlasNav({ base }) {
  const nav = useAtlasAreaNav({ base, signedIn: false });
  return (
    <PlateRoot className="atl-public-nav" region="I">
      <AreaNav area={nav.area} pill={nav.pill} views={nav.views} current={nav.current} more={nav.more} onGo={nav.onGo}
        search={{ placeholder: nav.placeholder, onSubmit: (t) => { const v = String(t || "").trim(); if (v) nav.onGo("search", `${base}/gazetteer?q=${encodeURIComponent(v)}`); } }}/>
    </PlateRoot>
  );
}

export default function AtlasPage({ base = "/atlas", publicChrome = false }) {
  const location = useLocation();
  const slug = decodeURIComponent(location.pathname.slice(base.length).replace(/^\/+|\/+$/g, "")) || null;
  const q = new URLSearchParams(location.search).get("q") || "";

  // ⭐ D167 · Atlas is a product with its own navigation; signed in, the shell's area nav carries it (D197 #5).
  const signedIn = base.startsWith("/app");
  // ⭐ A154 / D172 (4) (45s): Compete shows only the panels whose switch the owner turned on (GET /api/atlas/compete).
  const [compete, setCompete] = useState(null);
  useEffect(() => {
    let live = true;
    if (!signedIn) return undefined;
    api("/api/atlas/compete").then(r => live && setCompete(r)).catch(() => live && setCompete(null));
    return () => { live = false; };
  }, [signedIn]);

  const forward = forwardOf(base, slug, q, location.search, location.hash);
  const gz = gazetteerOf(slug);
  // ⭐ D116 M7: /atlas/family/<key> is a family's page (a node slug never holds a "/").
  const familyKey = slug && slug.startsWith("family/") ? slug.slice("family/".length) : null;
  // ⭐ A154: /atlas/bar/<code> is a shared Beat-the-bar score (a node slug never holds a "/").
  const barCode = slug && slug.startsWith("bar/") ? slug.slice("bar/".length) : null;
  const courseId = courseIdOf(slug);
  const regionN = slug && /^region\/\d+$/.test(slug) ? Number(slug.slice("region/".length)) : null;
  // A term's entry: any one-segment address that isn't a panel / reserved slug (the old node page's rule).
  const termSlug = slug && !slug.includes("/") && !isPanelSlug(slug) && slug !== "check" ? slug : null;

  useEffect(() => {
    if (termSlug) return;   // the entry sets its own title (its headword)
    const name = gz ? (gz.page === "routes" ? "Routes" : "Gazetteer") : isPanelSlug(slug) ? PANEL_LABEL[panelFor(slug)] : null;
    document.title = name ? `${name} · Atlas · ${BRAND}` : `Atlas · ${BRAND}`;
  }, [slug, termSlug, gz?.page]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (forward) return <Navigate replace to={forward} state={location.state}/>;

  // ⭐ D197 Wave 1 #5–#8: the plate pages — Volume I, a region, the Library, the Gazetteer (index + entries) and Routes. Their
  // navigation is the area nav (the shell's signed in; its plate twin public), so they draw no PlaceNav.
  const plateView = !slug ? "home" : regionN ? "region" : slug === "library" ? "library" : gz ? `${gz.page}${gz.id ? "-one" : ""}` : termSlug ? "entry" : null;
  if (plateView) {
    const page = plateView === "home" ? <AtlasVolumeHome base={base} signedIn={signedIn} compete={compete}/>
      : plateView === "region" ? <AtlasRegionPage base={base} n={regionN} signedIn={signedIn}/>
      : plateView === "library" ? <AtlasLibraryPage base={base} signedIn={signedIn}/>
      : plateView === "gazetteer" ? <GazetteerIndexPage base={base} signedIn={signedIn}/>
      : plateView === "gazetteer-one" ? <GazetteerEntryPage key={gz.id} base={base} signedIn={signedIn} lessonId={gz.id}/>
      : plateView === "routes" ? <RoutesPage base={base} signedIn={signedIn}/>
      : plateView === "routes-one" ? <RoutePage key={gz.id} base={base} signedIn={signedIn} id={gz.id} compete={compete}/>
      : <GazetteerEntryPage key={termSlug} base={base} signedIn={signedIn} slug={termSlug}/>;
    const plate = <div className="atl-plate" data-atlas-page={plateView} data-atlas-panel={plateView === "library" ? "library" : undefined}>{page}</div>;
    if (!publicChrome) return plate;
    return (
      <div className="scroll-dock-page atl-page">
        <ScrollDock variant="marketing" />
        <PublicAtlasNav base={base} />
        {plate}
        <Footer />
      </div>
    );
  }

  // The places that keep their classic panel until their own wave (Your survey, Your run, Your skills, Today's question,
  // The audit, This week's market, League / Challenges, a family, a shared bar, a guide or a deck) — docs/revamp/atlas.md.
  const checking = slug === "check";
  const panel = panelFor(slug, q) === "overview" && signedIn ? "your-map" : panelFor(slug, q);
  const panelOnly = isPanelSlug(slug) && !checking;
  const wide = !!familyKey;
  const body = (
    <main className={`atl atl--panels${wide ? " atl--wide" : ""}`} data-atlas-page={checking ? "check" : familyKey ? "family" : courseId ? "course" : panelOnly ? "panel" : "other"}
      data-atlas-panel={panel}>
     <PlaceNav place="atlas" name="Atlas" eyebrow="Your way through the market" title="Atlas" fill panelId="atlas-panel" nav={!signedIn}
       groups={navGroups(compete).map(g => ({ label: g.group, items: g.panels }))} current={panel} hrefFor={(id) => panelHref(base, id)}>
      {panelOnly && panel === "overview" && <OverviewPanel base={base} />}
      {panel === "your-map" && !familyKey && (
        <div className="atl-pan" data-atlas-panel-body="your-map">
          {/* ⭐ D200 (a) (47h): the page IS Your survey (its own head, SkillMap.jsx); D172 (4) / D178's track board and
              the route (D143's navigator) stay, inside its 05 "Your route, step by step" (routeMore). */}
          <SkillMap base={base} signedIn={signedIn} routeMore={signedIn && (
            <details className="atl-more skm-route-more" data-atlas-route-more="">
              <summary className="atl__link">Fly my route · the track board and the navigator</summary>
              <TrackBoard base={base} signedIn={signedIn} />
              <section className="atl__section" data-atlas-route-in-map=""><YourRoutePanel base={base} signedIn={signedIn} /></section>
            </details>
          )} />
          <PlateRoot region="IV" className="pl-yourmap" data-your-map-parts="">
            {signedIn ? <StackOnTheBoard /> : null}
            <TodayCard base={base} signedIn={signedIn} />
            <Logbook base={base} signedIn={signedIn} compete={compete} />
          </PlateRoot>
        </div>
      )}
      {panel === "your-skills" && <YourSkillsSlot signedIn={signedIn} base={base} />}
      {panel === "todays-question" && <Navigate replace to={`${base}/your-map#today`} />}
      {panel === "the-audit" && <AuditPanel base={base} />}
      {panel === "this-weeks-market" && <AtlasMarketPanel base={base} />}
      {familyKey && <FamilyMap base={base} familyKey={familyKey} />}
      {panel === "your-run" && <Navigate replace to={`${base}/your-map#logbook`} />}
      {/* ⭐ A154 / D172 (4): Compete — drawn only with its switch on; off, the address says so (the server 404s too). */}
      {panel === "league" && (compete?.league ? <Navigate replace to={`${base}/your-map#standings`} /> : <p className="atl__quiet" role="status" data-compete-off="league">{compete ? "This isn't available yet." : signedIn ? "Opening…" : "Sign in to see this week's league."}</p>)}
      {panel === "challenges" && (compete?.challenges ? <ChallengesPanel base={base} /> : <p className="atl__quiet" role="status" data-compete-off="challenges">{compete ? "This isn't available yet." : signedIn ? "Opening…" : "Sign in to see the challenges."}</p>)}
      {barCode && <SharedBar base={base} code={barCode} />}
      {/* ⭐ D172 (2b): /atlas/library/<id> is a guide (a level) or a deck — its page stays (a deck = an entry's Watch it). */}
      {courseId && <LibraryItem base={base} id={courseId} />}
      {!panelOnly && !checking && !familyKey && !courseId && !barCode && slug && (
        <p className="atl__quiet" role="status" data-atlas-missing="">There's no Atlas page by that name. <a href={`${base}/gazetteer`} className="atl__link">Look it up in the Gazetteer</a></p>
      )}
     </PlaceNav>
    </main>
  );
  if (!publicChrome) return body;
  return (
    <div className="scroll-dock-page atl-page">
      <ScrollDock variant="marketing" />
      {body}
      <Footer />
    </div>
  );
}

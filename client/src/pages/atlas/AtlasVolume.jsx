// ⭐ D197 Wave 1 #5–#7 (47h, lane atlas) · ATLAS IN THE PLATE SYSTEM — the three approved boards on real data:
//   /atlas                 Volume I, Atlas's front page (board `Home`)       → AtlasVolumeHome
//   /atlas/region/<n>      a region: Terrain · Route · Index (board `Map`)   → AtlasRegionPage
//   /atlas/library         the Library, outside resources only (`Library`)  → AtlasLibraryPage
// and Atlas's area nav (the shell's ShellAreaNav slot, the Shell board's figure C: the VOL. I pill + its volumes panel ·
// Your map · Library · Today's question · League (with its switch) · More · search · the run chip) → useAtlasAreaNav.
// The data is Atlas's own (pages/atlas/volumeModel.js says where each number comes from); the plate components draw it
// (plate/AtlasHome.jsx · AtlasRegion.jsx · AtlasLibrary.jsx). Nothing that was reachable before is lost (D200 Rule 1):
// every other Atlas place stays at its address and in the nav's More (docs/revamp/atlas.md, "where each row lives now").
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { AtlasHero, RegionPlates, AtlasFooter, VolumesPanel } from "../../plate/AtlasHome.jsx";
import { RegionHeader, RegionViews } from "../../plate/AtlasRegion.jsx";
import { LibraryAside, LibraryShelfView } from "../../plate/AtlasLibrary.jsx";
import { atlasPlaces, volumeOf, volumeStats, VOLUME, regionPlaces, regionTrails, placeStatus, STATUS_WORD, STAGES, libraryOf, COLLECTIONS, collectionView, callNumber } from "./volumeModel.js";
import { learnStepHref, panelHref } from "./atlasPanels.js";

const COURSE_URL = `/api/learn/course/${VOLUME.course}`;
// One load shared by the area nav and the page on the same view (both mount together); a fresh one after 20 s, so a mark
// earned on a lesson shows on the way back.
const shared = new Map();
function loadOnce(key, fn) {
  const hit = shared.get(key);
  if (hit && Date.now() - hit.at < 20000) return hit.p;
  const p = fn().catch((e) => { shared.delete(key); throw e; });
  shared.set(key, { at: Date.now(), p });
  return p;
}

/** The volume's data: { status, course, marks, circle, run, error, retry }. `circle` / `run` only when asked for. */
export function useVolume(signedIn, { circle = false, run = false } = {}) {
  const [s, setS] = useState({ status: "loading", course: null, marks: {}, circle: null, run: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([
      loadOnce("course", () => api(COURSE_URL)),
      signedIn ? loadOnce("earned", () => api("/api/learn/earned")).catch(() => ({ marks: {} })) : Promise.resolve({ marks: {} }),
      circle ? loadOnce("circle", () => api("/api/learn/circle")).catch(() => null) : Promise.resolve(null),
      run && signedIn ? loadOnce("run", () => api("/api/atlas/run")).catch(() => null) : Promise.resolve(null),
    ]).then(([course, earned, c, r]) => live && setS({ status: "ready", course, marks: earned?.marks || {}, circle: c, run: r, error: null }))
      .catch((e) => live && setS((p) => ({ ...p, status: "error", error: e.message })));
    return () => { live = false; };
  }, [signedIn, circle, run, tick]);
  const retry = useCallback(() => { shared.clear(); setTick((t) => t + 1); }, []);
  return { ...s, retry };
}

/** A plain click (not a new tab / window) → the router; anything else is the browser's. */
export const routerGo = (navigate) => (href) => navigate(href);

const regionHref = (base, n, at) => `${base}/region/${n}${at ? `?at=${encodeURIComponent(at)}` : ""}`;
const withHrefs = (base, regions) => regions.map((r) => ({ ...r, href: regionHref(base, r.n) }));

/** The board's five turning words, each on its region's tape. */
const TAPES = [{ text: "computers.", region: "I" }, { text: "the internet.", region: "IV" }, { text: "money.", region: "V" }, { text: "the physical world.", region: "VII" }, { text: "AI.", region: "VIII" }];
const LEAD = "Every field is a territory. Atlas draws it as a map you walk lesson by lesson, and a square lights up only when you can explain what you learned.";
const REGIONS_NOTE = "Each region opens on its own terrain. Squares stay dark until you’ve explained the lesson in your own words.";

/** /atlas — Volume I. */
export function AtlasVolumeHome({ base, signedIn, compete }) {
  const navigate = useNavigate();
  const go = routerGo(navigate);
  const v = useVolume(signedIn);
  const vol = useMemo(() => (v.course ? volumeOf(v.course, v.marks) : null), [v.course, v.marks]);
  const regions = vol ? withHrefs(base, vol.regions) : [];
  const here = vol?.here, next = vol?.next;
  const started = !!vol && (vol.lit > 0 || Object.keys(v.marks || {}).length > 0);
  const summit = here ? v.course.modules[here.module - 1]?.lessons.slice(-1)[0] : null;
  const tags = vol && here ? {
    here: { kicker: started ? "YOU ARE HERE" : "START HERE", line: here.title, href: learnStepHref(base, here.id), onClick: () => go(learnStepHref(base, here.id)),
      squares: here.region.squares },
    ...(next ? { next: { kicker: `NEXT · ${next.title.toUpperCase()}`, line: `Plate ${next.region.roman} · ${next.region.name}`, href: learnStepHref(base, next.id), onClick: () => go(learnStepHref(base, next.id)) } } : {}),
    ...(summit && summit.id !== here.id ? { ahead: { kicker: `AHEAD · ${summit.title.toUpperCase()}`, line: `The summit of ${here.region.name}`, href: regionHref(base, here.module, summit.id), onClick: () => go(regionHref(base, here.module, summit.id)) } } : {}),
  } : {};
  const resume = here ? regionHref(base, here.module, here.id) : regionHref(base, 1);
  return (
    <PlateRoot region="I" className="pl-at-page" data-atlas-volume="">
      <AtlasHero tapes={TAPES} lead={LEAD} onGo={go}
        actions={{ primary: { label: started ? "Resume the route" : "Start the route", href: resume, onClick: () => go(resume) },
          secondary: { label: "Open the atlas", href: regionHref(base, 1), onClick: () => go(regionHref(base, 1)) } }}
        stats={vol ? volumeStats(vol).map((c, i) => ({ ...c, href: [`${base}#pl-at-regions-title`, `${base}/library/${VOLUME.course}`, `${base}/library`][i] })) : []}
        tags={tags} caption={["PLATE I · VOLUME I, COMPUTING", "— walked   - - ahead   ◆ summit"]}/>
      {v.status === "error" ? (
        <p className="pl-at-msg" role="alert">The regions didn’t load. <button type="button" className="pl-btn" onClick={v.retry}>Try again</button></p>
      ) : v.status === "loading" ? (
        <p className="pl-at-msg" role="status">Opening the regions…</p>
      ) : (
        <RegionPlates regions={regions} note={REGIONS_NOTE} onGo={go}/>
      )}
      <AtlasFooter groups={atlasPlaces(base, compete)} onGo={go}/>
    </PlateRoot>
  );
}

/** The run chip's seven days: this week Monday → Sunday from Your run's month (lit = proof that day, today clay). */
export function runWeek(run) {
  const month = run?.month || [];
  if (!month.length) return null;
  const today = month[month.length - 1];
  const wd = (new Date(`${today.day}T12:00:00Z`).getUTCDay() + 6) % 7;   // Monday = 0
  const week = month.slice(-(wd + 1)).map((d) => (d.lit ? "lit" : d.today ? "today" : null));
  while (week.length < 7) week.push(null);
  return week;
}

/** Atlas's area nav (ShellAreaNav's props): the VOL. I pill and its panel, the four views, More, search, the run chip. */
export function useAtlasAreaNav({ base = "/app/atlas", signedIn = true, compete = null } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const v = useVolume(signedIn, { run: true });
  const go = routerGo(navigate);
  const slug = decodeURIComponent(location.pathname.slice(base.length).replace(/^\/+|\/+$/g, ""));
  const vol = v.course ? volumeOf(v.course, v.marks) : null;
  const views = [
    { id: "survey", label: "Your survey", href: panelHref(base, "your-map"), icon: "map" },
    { id: "library", label: "Library", href: panelHref(base, "library"), icon: "library" },
    { id: "question", label: "Today’s question", href: panelHref(base, "todays-question"), icon: "question" },
    ...(compete?.league ? [{ id: "league", label: "League", href: panelHref(base, "league"), icon: "league" }] : []),
  ];
  const current = slug === "your-map" || slug === "your-route" || slug.startsWith("family/") ? "survey"
    : slug === "library" ? "library" : slug === "todays-question" ? "question" : slug === "league" ? "league" : undefined;
  const inViews = new Set(["your-map", "library", "todays-question", "league"]);
  const more = atlasPlaces(base, compete).flatMap((g) => g.links).filter((l) => !inViews.has(l.id));
  const week = runWeek(v.run);
  return {
    area: "Atlas", views, current, more, placeholder: "Make sense of…",
    pill: { tag: `VOL. ${VOLUME.roman}`, name: VOLUME.name,
      panel: <VolumesPanel regions={vol ? withHrefs(base, vol.regions) : []} onGo={go}
        volume={{ tag: `VOL. ${VOLUME.roman}`, name: VOLUME.name, href: base, line: vol ? `${VOLUME.title} · ${vol.regions.length} regions · ${vol.lessons} lessons` : VOLUME.title }}/> },
    chip: week ? { kind: "run", days: week, href: panelHref(base, "your-run"), onGo: go,
      label: `Your run: ${week.filter((d) => d === "lit").length} of 7 days lit this week` } : null,
    onGo: (id, href) => go(href),
  };
}

// ── /atlas/region/<n> ─────────────────────────────────────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: "terrain", label: "Terrain", sub: "explore the ground" },
  { id: "route", label: "Route", sub: "ride the line" },
  { id: "index", label: "Index", sub: "look up a place" },
];

/** A region of Volume I: the plate header (emblem, name, its places, the dial), the next waypoint, then Terrain · Route · Index. */
export function AtlasRegionPage({ base, n, signedIn }) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = routerGo(navigate);
  const v = useVolume(signedIn, { circle: true });
  const params = new URLSearchParams(location.search);
  const view = VIEWS.some((x) => x.id === params.get("view")) ? params.get("view") : "terrain";
  const vol = useMemo(() => (v.course ? volumeOf(v.course, v.marks) : null), [v.course, v.marks]);
  const module = v.course?.modules?.[n - 1] || null;
  const region = vol?.regions?.[n - 1] || null;
  const places = useMemo(() => (module && vol ? regionPlaces(module, v.marks, { circle: v.circle, regions: vol.regions, course: v.course }) : []), [module, vol, v.marks, v.circle, v.course]);
  const trails = useMemo(() => regionTrails(places, v.circle), [places, v.circle]);
  const setView = (id) => { const q = new URLSearchParams(location.search); q.set("view", id); navigate(`${location.pathname}?${q}`, { replace: true }); };
  const at = params.get("at");
  if (v.status === "error") return <PlateRoot className="pl-at-page"><p className="pl-at-msg" role="alert">This region didn’t load. <button type="button" className="pl-btn" onClick={v.retry}>Try again</button></p></PlateRoot>;
  if (v.status === "loading") return <PlateRoot className="pl-at-page"><p className="pl-at-msg" role="status">Opening the region…</p></PlateRoot>;
  if (!module || !region) return <PlateRoot className="pl-at-page"><p className="pl-at-msg" role="status" data-atlas-missing="">There’s no region {n} in Volume I. <a href={base} onClick={(e) => { e.preventDefault(); go(base); }}>Back to Volume I</a></p></PlateRoot>;
  const nextP = places.find((p) => p.state === "next") || null;
  const fromOf = (p) => { const t = trails.find((x) => x.id.endsWith(`>${p.id}`)); return t ? places.find((q) => q.id === t.id.split(">")[0])?.name : null; };
  const notes = places.reduce((a, p) => a + p.notes, 0);
  const placeHref = (p) => learnStepHref(base, p.id);
  const stage = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  return (
    <PlateRoot region={region.roman} className="pl-at-page" data-atlas-region-page={region.n}>
      <main className="pl-at-region" id="region">
        <RegionHeader emblem={region.kind} roman={region.roman} name={region.name} lead={`${region.blurb} Climb from ${places[0]?.name} to ${places[places.length - 1]?.name}.`}
          chips={[`${places.length} PLACES`, `${notes} FIELD NOTES`, `${region.lit} LIT`]} lit={region.lit} total={region.total}
          waypoint={nextP ? { grid: nextP.grid, name: nextP.name, line: `${nextP.checks.total} check${nextP.checks.total === 1 ? "" : "s"}${fromOf(nextP) ? ` · from ${fromOf(nextP)}` : ""}`,
            href: placeHref(nextP), onClick: () => go(placeHref(nextP)) } : null}/>
        <RegionViews views={VIEWS} view={view} onView={setView} roman={region.roman} places={places} trails={trails} initial={at}
          card={(p) => ({ grid: p.grid, stage: stage[p.stage], name: p.name, checks: p.checks, status: placeStatus(p, fromOf(p)), notes: p.notes, href: placeHref(p), onOpen: () => go(placeHref(p)) })}
          statusWord={STATUS_WORD} onInterchange={(ir) => go(regionHref(base, ir.n))} interchangeHref={(ir) => regionHref(base, ir.n)}/>
      </main>
    </PlateRoot>
  );
}

// ── /atlas/library ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The Library: every outside resource the course links to, filed by collection and region (never draft's own lessons). */
export function AtlasLibraryPage({ base, signedIn }) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = routerGo(navigate);
  const v = useVolume(signedIn);
  const params = new URLSearchParams(location.search);
  const cat = COLLECTIONS.some((c) => c.id === params.get("c")) ? params.get("c") : "notes";
  const [mod, setMod] = useState("all");
  const vol = useMemo(() => (v.course ? volumeOf(v.course, v.marks) : null), [v.course, v.marks]);
  const items = useMemo(() => (v.course ? libraryOf(v.course, v.marks, vol) : []), [v.course, v.marks, vol]);
  const [opened, setOpened] = useState({});
  const setCat = (id) => { const q = new URLSearchParams(location.search); q.set("c", id); setMod("all"); navigate(`${location.pathname}?${q}`, { replace: true }); };
  const counts = Object.fromEntries(COLLECTIONS.map((c) => [c.id, items.filter((x) => x.collection === c.id).length]));
  const pool = items.filter((x) => x.collection === cat);
  // ⭐ D117 C8: opening an outside link FROM DRAFT is an earned mark (the course page records it the same way)
  const open = (x) => {
    if (!signedIn) return;
    setOpened((o) => ({ ...o, [x.id]: true }));
    api("/api/learn/opened", { method: "POST", body: JSON.stringify({ id: x.id }), keepalive: true }).catch(() => {});
  };
  const c = COLLECTIONS.find((k) => k.id === cat);
  return (
    <PlateRoot region="I" className="pl-at-page" data-atlas-library="">
      <div className="pl-at-lib" id="lib">
        <LibraryAside cats={COLLECTIONS.map((k) => ({ id: k.id, label: k.label, icon: k.icon, count: k.id === "glossary" ? "—" : v.status === "ready" ? (counts[k.id] ? String(counts[k.id]) : "—") : "…" }))}
          current={cat} onCat={setCat}/>
        <LibraryShelfView status={v.status} error={v.error} onRetry={v.retry} cat={c} view={collectionView(cat)} items={pool.map((x) => ({ ...x, opened: x.opened || !!opened[x.id] }))}
          mod={mod} onMod={setMod} onOpen={open} callNumber={callNumber}
          lessonHref={(x) => learnStepHref(base, x.lesson.id)} onLesson={(x) => go(learnStepHref(base, x.lesson.id))}
          glossaryHref={panelHref(base, "glossary")} onGlossary={() => go(panelHref(base, "glossary"))}
          shelfHref={`${base}/library/shelf`} onShelf={() => go(`${base}/library/shelf`)}/>
      </div>
    </PlateRoot>
  );
}

# Atlas · D197 Wave 1 #5–#7 — where each M1 row lives now (47h, lane atlas)

Built against the approved final canvas boards `Home`, `Map`, `Library` (`docs/sketches/final/project/*.dc.html`) and
the Shell board's figure C (Atlas's area nav). Rows are `docs/revamp/atlas-interview-m1.md`'s. D200 Rule 1: nothing lost —
every row keeps its address, and every address is reachable from the area nav (views or More) and from Volume I's footer.

## What was built

| Page | Address | Board | Code |
|---|---|---|---|
| **Volume I** — Atlas's front page, for everyone (signed in and out) | `/atlas`, `/app/atlas` | `Home` | `plate/AtlasHome.jsx` · `pages/atlas/AtlasVolume.jsx` `AtlasVolumeHome` |
| **A region** — Terrain · Route · Index (the physical map) | `/atlas/region/<1–8>` (`?view=route\|index`, `?at=<lesson>`) | `Map` | `plate/AtlasRegion.jsx` · `AtlasRegionPage` |
| **The Library** — outside resources only | `/atlas/library` (`?c=<collection>`) | `Library` | `plate/AtlasLibrary.jsx` · `AtlasLibraryPage` |
| **Atlas's area nav** | every `/app/atlas…` page (shell); the three plate pages when public | Shell, figure C | `useAtlasAreaNav` → `ShellAreaNav` (App.jsx) / plate `AreaNav` (public) |

The data is Atlas's own, nothing invented (`pages/atlas/volumeModel.js`): the 8 regions = the course *From silicon to
software*'s 8 modules; the places = its 108 lessons; LIT = the one earned rule (`shared/learnStepState.js` via
`libraryModel.lessonState`); a place's checks = its checkpoints (+ build); trails = the circle's *Before this* links;
interchanges = a *Before this* / *After this* link into another region; the Library = every lesson link that is an
outside resource, filed by kind.

**The area nav:** VOL. I · Computing pill (its panel: the volumes + a row per region) · **Your survey** (`/atlas/your-map`,
the yoursurvey lane's page — the route stays) · Library · Today's question · League (only with its switch) · **More**:
Your run · Your skills · Courses and guides · The audit · How it works · Roles and skills · This week's market · Glossary ·
Overview · Challenges (with its switch) · search "Make sense of…" (the dock's search signed in; the Atlas search public) ·
the run chip (this week's lit days, → Your run).

## Where each row lives now

| # | Name | Where now | How you reach it |
|---|---|---|---|
| A0 | Overview | `/atlas/overview` (unchanged page). The mount `/atlas` is Volume I now (was: Overview signed out, Your map signed in) | More → Overview · footer → Explore → Overview |
| A1–A1e | Your map (skill map, treemap, Learn next, move roles, TrackBoard, Navigator) | `/atlas/your-map` unchanged here (the yoursurvey lane rebuilds it as *Your survey*) | area nav **Your survey** · footer → You |
| A1f | Family page | `/atlas/family/<key>` unchanged | from Your survey's links (nav lights Your survey) |
| A2–A2e | Your run | `/atlas/your-run` unchanged | the **run chip** · More · footer |
| A3, A3a | Your skills, readiness check | `/atlas/your-skills`, `/atlas/check` unchanged | More · footer |
| A4 | Library shelf + "N to review" | **moved to `/atlas/library/shelf`** (the same `LibraryShelf`, unchanged) — `/atlas/library` is the outside-resources Library (D201 (4)) | More → Courses and guides · footer → Grow · the Library's empty drawers link it |
| A4a–A4h | Guides, guide / deck pages, the course, the circle, piece questions, patterns, pathways | `/atlas/library/<id>` unchanged | the shelf; Volume I's LESSONS figure → the course; every place card / waypoint / tag → the lesson's circle view (`?view=circle#step-<id>`) |
| A4i | Build-it briefs | inside the pathways (shelf) unchanged | the shelf |
| A5 | How it works | `/atlas/how-it-works` unchanged | More · footer |
| A6–A6c | Today's question (+ reminder, practice progress, stack exposure) | `/atlas/todays-question` unchanged | area nav **Today's question** · footer |
| A7, A7a | The audit, the 3-minute audit | `/atlas/the-audit`, `/audit` unchanged | More · footer |
| A8–A8b | Roles and skills, search, node pages | `/atlas/roles-and-skills`, `/atlas?q=`, `/atlas/<slug>` unchanged | More · footer · public nav search |
| A9 | This week's market | `/atlas/this-weeks-market` unchanged | More · footer |
| A10, A10a | Glossary, AtlasTerm peek | `/atlas/glossary` unchanged | More · footer · the Library's *Glossary* drawer |
| C1–C3 | League, Challenges, shared bar | unchanged, behind their switches | League in the views / Challenges in More, only when switched on · footer → Compete |

**Not reachable:** none. **Changed address:** only the shelf (A4: `/atlas/library` → `/atlas/library/shelf`).

## Board vs behaviour (kept the behaviour, followed the look)

1. **Your map / Your survey** — the boards' "Your map" means the physical map; the coordinator named the view *Your
   survey* (→ `/atlas/your-map`, the skill map). Region pages light no view.
2. **Field notes** — the board's are harvested reels with views and lengths; the Library files the course's **videos**
   there (no length / view counts exist, so none are drawn). A region's *N FIELD NOTES* counts the same videos.
3. **Primary sources** — papers in the course's links (an Article whose title or source says paper / PDF / RFC). Most
   collections are filled from the link kinds (Book · Course · Playlist · Article · Practice / Sandbox / Lab · Guide);
   a collection with nothing in it is an EMPTY DRAWER (the board's), linking to the shelf.
4. **"I can explain it"** — there is no per-source explanation; the button opens the lesson that cites it (where the
   explanation in your own words is written), and EXPLAINED shows when that lesson's checkpoints are explained.
5. **Interchange chip, drawer pull** — the board draws them as capsules; D60 (no pills, ever) wins: 7 px / 3 px corners.
6. **Volume I's callout tags** — the plate drawing is the ported art; the tags carry real lessons (you are here / next /
   the region's summit). Signed out with nothing earned, *YOU ARE HERE* reads *START HERE* and the CTA *Start the route*.
7. **Region II's name** — the board's is a placeholder; the module's own title (*The physical machine*) is used.
8. **Stages** — a region's lessons in order, split in quarters (Start · Build · Deepen · Master); the content has no
   per-lesson level.

## The Gazetteer — Wave 1 #8 / D201 (47m, lane gaz + the coordinator — the 47n record)

| Page | Address | Board | Code |
|---|---|---|---|
| **The index** — Look anything up, Show / Browse, A–Z, the rail | `/atlas/gazetteer` | `GazetteerIndex` | `pages/atlas/AtlasGazetteer.jsx` · `plate/Gazetteer.jsx` + `gazetteer.css` |
| **An entry** — a term or a place: meaning + cross-references, Watch it, Why it works (checkpoints in your own words + the build link), Where it runs, Read more, practice on one scale, the compass, its routes, *More about it* | `/atlas/<slug>`, `/atlas/gazetteer/<lesson>` | `Gazetteer` | the same + `pages/atlas/EntryMore.jsx`, `LearnChecks.jsx` (Explain / BuildLink, shared with LearnCircle) |
| **Routes / one route** — RouteMap, the stops, copy / join / leave, the stamp, challenges behind Compete, crossings | `/atlas/routes`, `/atlas/routes/<id>` | `Route` | `plate/RouteMap.jsx` (RouteMap, RouteLegend, ProjectRoute, `routePoints` / `regionRuns`) |

- The pure model is `pages/atlas/gazetteerModel.js` (entries from the glossary + the two courses, search, A–Z, routes,
  guided routes, pathways, guides and build briefs, stop states, the compass, the practice ladder).
- **Atlas's nav is D201's five** — Your map, Gazetteer, Routes, Library, Your survey — + the run chip; More keeps the rest.
- **The retired addresses forward** (`forwardOf`): `?q=`, glossary, roles-and-skills, how-it-works, learn, library/shelf,
  the two course pages. `learnStepHref` points at the entry. Deleted: AtlasGraph, LessonDeck, LibraryPanel, PathwayArt.
- Tokens added for the Gazetteer's raw values: `--pl-line-bar` (3 px), `--pl-page-gz` (1180 px).

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).

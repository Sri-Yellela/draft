# D178-1 · The old Atlas inside the new one — inventory

Owner 11-07 (D178): *"we need to make sure older features are accounted for and are not left loose."* Every
address, panel, tab and reader-facing API of the Atlas as it stands on 2026-11-07, what it is today, and its home
in the redesign (D178's translation table). `test/d178EveryOldAddressRedirects.test.js` fails when an address, a
panel, a Learn view or a reader-facing route is missing from this file, or when an address stops resolving.

**Today, nothing is loose:** every row's address still opens its feature. ✅ **The redirects are in (45j, the nav
regrouped):** *Your route* → *Your map* (an alias; the navigator is drawn inside Your map, under the track board),
*Overview* → *Your run* when signed in (signed out, Overview stays Atlas's front page), *Learn* → the course's circle
view (`/atlas/library/silicon-to-software?view=circle`, the `#step-<id>` carried). They waited for D178-3 so that the
circle and the navigator's extras were never unreachable, which is the thing D178 forbids.

## Addresses and panels (`/atlas/…` and `/app/atlas/…`)

| Address | What it is today | Its home in the redesign (D178) | Redirect |
|---|---|---|---|
| `/atlas` (`overview`) | Overview panel | **Folded into Your run** (Atlas's front page); market numbers → This week's market | ✅ signed in → Your run; signed out, the front page (45j) |
| `/atlas/your-run` | Your run (D172 (3)) | stays — You · first | — |
| `/atlas/your-map` | the track board (D172 (4)) + the market tree under *See the whole market around you* | stays — the tree moves to **Your skills → Map view**, full width, three states | D178-3 (the tree) |
| `/atlas/your-skills` (`check` alias) | D169's list + map, D142's readiness check | stays; its Map view becomes the radial tree's home | — |
| `/atlas/your-route` (`your-route` alias) | the navigator (D143): aim, route, bridges, progress, elsewhere | **Folded into Your map** (the map IS the route drawn) | ✅ → Your map, the navigator under the track board (45j) |
| `/atlas/library` | the ladder of guides + the course shelf (D172 (2), (2b)) | stays — Grow · first | — |
| `/atlas/library/<course>` | a course: modules → lessons | stays; gains **The circle** view and routes (D178-3) | — |
| `/atlas/library/<guide>` | a guide (a level): its decks | stays | — |
| `/atlas/library/<deck>` | a deck, one slide at a time | stays; the lesson card's deck gesture (D178-3) | — |
| `/atlas/learn` | Learn: four views (below) | **Retired** → the course in the Library, circle view, same piece | ✅ → `/atlas/library/silicon-to-software?view=circle` (45j) |
| `/atlas/learn#step-<id>` | a piece, opened in the circle | → the course's circle view with that piece selected | ✅ the hash carried (45j) |
| `/atlas/todays-question` | Today's question (not built, D154) | stays — Grow | — |
| `/atlas/the-audit` | the audit (D150) | stays — Grow | — |
| `/atlas/roles-and-skills` | roles and skills + search | stays — Explore | — |
| `/atlas/<node slug>` | a skill / role page — one card (D172 (1)) | stays | — |
| `/atlas?q=…` | search | stays (Roles and skills) | — |
| `/atlas/family/<key>` | a family's tree (D116 M7) | → **Your skills → Map**, that family selected | D178-3 |
| `/atlas/this-weeks-market` | This week's market | stays — Explore; gains Overview's market numbers | — |
| `/atlas/glossary` | the glossary | stays — Explore; gains the **concept index** | — |

## Learn's four views (the tabs that were inside `/atlas/learn`) — ✅ all four in their homes (45j); the tabs are retired

| View (`data-learn-tab`) | What it is | Its home (D178) |
|---|---|---|
| `circle` | The circle — 108 pieces, guided routes, the piece card | ✅ **The circle view of the course** (`/atlas/library/silicon-to-software?view=circle`) — LearnView is now the circle only |
| `path` | Learning path — Step 1 → 108 | ✅ **= the Modules view** (`/atlas/library/silicon-to-software`) |
| `patterns` | LeetCode pattern atlas | ✅ **Its own course on the shelf** (`/atlas/library/coding-interview-patterns`), linked from Interview → Drills |
| `concepts` | Concept index | ✅ **Merged into Explore → Glossary** (`/atlas/glossary`), each concept keeping its lesson link (*Learn it*) |

Inside the circle: **guided routes** → routes on the course page; **"Make sense of …" / Make a route** → an ask to
D177; **"Fly my route to senior …"** → *Your map*'s track-board animation (✅ 45j, *Fly my route*).

## Reader-facing APIs (unchanged by the move; each keeps serving its new home)

`GET /api/atlas/search` · `GET /api/atlas/resolve` · `GET /api/atlas/terms/:jobId` · `GET /api/atlas/peek/:slug` ·
`GET /api/atlas/glossary` · `GET /api/atlas/run` · `GET /api/atlas/readiness` (D178-3) · `GET /api/atlas/readiness/compare` (D178-3, Idea E) · `GET /api/atlas/me` · `GET /api/atlas/role-fit` ·
`GET /api/atlas/tree/role/:key` · `GET /api/atlas/tree/family/:key` · `POST /api/atlas/link-event` ·
`GET /api/atlas/node/:slug`

`GET /api/learn/` · `GET /api/learn/circle` · `GET /api/learn/circle/my-route` · `GET /api/learn/course/:id` ·
`GET /api/learn/guides` · `GET /api/learn/deck/:id` · `POST /api/learn/deck/:id/answer` · `GET /api/learn/earned` ·
`POST /api/learn/opened` · `PUT /api/learn/explained` · `PUT /api/learn/built` · `GET /api/learn/progress` ·
`PUT /api/learn/progress` · `POST /api/learn/progress/import`

The curator's tools (`/api/admin/atlas/…`) stay in Admin (D167's map, row 20).

## D178-2 status (11-07)

- ✅ the circle's / wheel's part labels never cropped (`72b35d4`)
- ✅ families count claims and proofs, never a flat "0 of N" (`72b35d4`)
- ⏸ the "search string" videos — 205 of 373 Learn items link to a search, 150 of them required for a lesson's ✓;
  hiding them changes what earns ✓, replacing them is content work — **the owner decides**
